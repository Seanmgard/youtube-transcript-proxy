import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { v4 as uuidv4 } from 'uuid'
import { createClient } from '@/lib/supabase/server'
import { getCookieOptions } from '@/utils/supabase/cookies-helper'
import type { Database } from "@/lib/database.types"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

// 25MB limit
const MAX_FILE_SIZE = 25 * 1024 * 1024;

export const maxDuration = 60; // Set max duration to 60 seconds (Vercel hobby plan limit)
export const dynamic = 'force-dynamic'; // Ensure the route is always dynamic

// Helper to wrap data in SSE format
function sseJson(obj: any) {
  return `data: ${JSON.stringify(obj)}\n\n`;
}

// A parsing function that gracefully falls back to an empty quiz if JSON parse fails.
function parseAssistantResponse(response: string, maxQuestions: number = 10) {
  try {
    console.log('Raw response to parse:', response.substring(0, 500) + '...');
    
    // Clean up the response to handle potential formatting issues
    let cleanedResponse = response.trim();
    
    // Remove any markdown code block indicators and language specifiers
    cleanedResponse = cleanedResponse.replace(/```json\s*/g, '').replace(/```\s*/g, '');
    
    // 1) First try direct JSON parsing of the cleaned response
    try {
      return JSON.parse(cleanedResponse);
    } catch (e) {
      console.log('Direct JSON parsing failed, trying alternative methods');
    }
    
    // 2) Look for curly braces to extract JSON object
    const braceMatch = cleanedResponse.match(/(\{[\s\S]*\})/);
    if (braceMatch && braceMatch[1]) {
      const jsonContent = braceMatch[1].trim();
      console.log('Found JSON by braces:', jsonContent.substring(0, 200) + '...');
      if (jsonContent) {
        try {
          return JSON.parse(jsonContent);
        } catch (e) {
          console.log('Failed to parse JSON from brace extraction, trying other methods');
        }
      }
    }

    // 3) Try to fix common JSON issues and try again
    console.log('Attempting to fix and parse JSON');
    const fixedJson = cleanedResponse
      .replace(/(\w+):/g, '"$1":') // Convert unquoted keys to quoted keys
      .replace(/'/g, '"') // Replace single quotes with double quotes
      .replace(/,\s*}/g, '}') // Remove trailing commas
      .replace(/,\s*]/g, ']'); // Remove trailing commas in arrays
    
    try {
      // Try to find a valid JSON object in the fixed text
      const jsonObjectMatch = fixedJson.match(/(\{[\s\S]*\})/);
      if (jsonObjectMatch && jsonObjectMatch[1]) {
        console.log('Found fixed JSON:', jsonObjectMatch[1].substring(0, 200) + '...');
        return JSON.parse(jsonObjectMatch[1]);
      }
    } catch (e) {
      console.log('Failed to parse fixed JSON');
    }

    // If we get here, we couldn't find valid JSON
    console.error('Could not extract valid JSON from response');
    console.log('Raw response:', response);
    
    // Return fallback to avoid crashing
    return {
      title: 'Quiz Generation Error',
      questions: [
        {
          text: 'Unable to generate quiz questions. Please try again with a different PDF or settings.',
          type: 'open_ended',
          correctAnswer: 'N/A'
        }
      ],
      _rawResponse: response.substring(0, 1000), // for debugging, truncated
    };
  } catch (err) {
    console.error('Failed to parse assistant response as JSON:', err);
    console.log('Raw response:', response.substring(0, 1000)); // truncated for log size

    // Return fallback to avoid crashing:
    return {
      title: 'Quiz Generation Error',
      questions: [
        {
          text: 'An error occurred while processing the quiz. Please try again.',
          type: 'open_ended',
          correctAnswer: 'N/A'
        }
      ],
      _rawResponse: response.substring(0, 1000), // for debugging, truncated
    };
  }
}

export async function POST(request: Request) {
  try {
    // Validate required environment variables
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ 
        error: 'OPENAI_API_KEY environment variable is not set. Please add it to your .env.local file.' 
      }, { status: 500 });
    }
    
    if (!process.env.OPENAI_ASSISTANT_ID) {
      return NextResponse.json({ 
        error: 'OPENAI_ASSISTANT_ID environment variable is not set. Please create an OpenAI Assistant and add the ID to your .env.local file.' 
      }, { status: 500 });
    }

    // Set headers for SSE
    const headers = new Headers({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no' // Disable buffering for Nginx
    });

    const cookieStore = cookies();
    const supabase = await createClient();
    
    // Get user info for DB operations
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    let streamInfoMessage = '';
    
    if (userError || !user) {
      streamInfoMessage = 'Generating quiz without saving (user not authenticated).';
    }

    // Parse FormData from the request
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const settingsJson = formData.get('settings') as string;
    
    if (!file) {
      return Response.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!settingsJson) {
      return Response.json({ error: 'No settings provided' }, { status: 400 });
    }

    const settings = JSON.parse(settingsJson);

    if (file.size > MAX_FILE_SIZE) {
      return Response.json({ error: 'File size exceeds 25MB limit' }, { status: 400 });
    }

    // Prepare a text encoder for SSE
    const encoder = new TextEncoder();

    // Create the ReadableStream for SSE
    const readableStream = new ReadableStream({
      async start(controller) {
        // Helper to send SSE JSON to the client
        function sendJson(data: any) {
          try {
            controller.enqueue(encoder.encode(sseJson(data)));
          } catch (err) {
            console.error('Error sending SSE data:', err);
          }
        }

        // Send a keepalive ping every 15 seconds to prevent connection timeouts
        const keepAliveInterval = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(`: keepalive ping\n\n`));
          } catch (err) {
            console.error('Error sending keepalive:', err);
            clearInterval(keepAliveInterval);
          }
        }, 15000);

        try {
          // If we have an info message to send (e.g., for unauthenticated users), send it first
          if (streamInfoMessage) {
            controller.enqueue(new TextEncoder().encode(`data: ${streamInfoMessage}\n\n`));
          }
          
          // Step A: Upload the PDF to OpenAI
          sendJson({ type: 'info', message: 'Uploading your PDF...' });
          
          // Create a new FormData instance
          const uploadFormData = new FormData();
          uploadFormData.append('purpose', 'assistants');
          uploadFormData.append('file', file);

          // Make a direct fetch call to OpenAI's API
          const response = await fetch('https://api.openai.com/v1/files', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${process.env.OPENAI_API_KEY!}`,
            },
            body: uploadFormData,
          });

          if (!response.ok) {
            const error = await response.json();
            throw new Error(`File upload failed: ${error.error?.message || 'Unknown error'}`);
          }

          const fileUpload = await response.json();
          sendJson({ type: 'info', message: `PDF uploaded successfully` });

          // Step B: Create a vector store using direct HTTP call
          sendJson({ type: 'info', message: 'Preparing document for analysis...' });
          const vectorStoreResponse = await fetch('https://api.openai.com/v1/vector_stores', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${process.env.OPENAI_API_KEY!}`,
              'Content-Type': 'application/json',
              'OpenAI-Beta': 'assistants=v2'
            },
            body: JSON.stringify({
              name: `Quiz Generation - ${file.name}`,
            }),
          });

          if (!vectorStoreResponse.ok) {
            const error = await vectorStoreResponse.json();
            throw new Error(`Vector store creation failed: ${error.error?.message || 'Unknown error'}`);
          }

          const vectorStore = await vectorStoreResponse.json();
          sendJson({ type: 'info', message: `Document preparation complete` });

          // Step C: Add the file to the vector store using direct HTTP call
          sendJson({ type: 'info', message: 'Reading through your document...' });
          const addFileResponse = await fetch(`https://api.openai.com/v1/vector_stores/${vectorStore.id}/files`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${process.env.OPENAI_API_KEY!}`,
              'Content-Type': 'application/json',
              'OpenAI-Beta': 'assistants=v2'
            },
            body: JSON.stringify({
              file_id: fileUpload.id,
            }),
          });

          if (!addFileResponse.ok) {
            const error = await addFileResponse.json();
            throw new Error(`Adding file to vector store failed: ${error.error?.message || 'Unknown error'}`);
          }

          sendJson({ type: 'info', message: 'Document processed successfully' });

          // Step D: Update the assistant to use that vector store
          sendJson({ type: 'info', message: 'Setting up quiz generation...' });
          
          let questionTypeInstructions = '';
          if (settings.questionType === 'multiple_choice') {
            questionTypeInstructions = `
QUESTION TYPE REQUIREMENTS:
- Generate ONLY multiple choice questions
- Every single question must be type "multiple_choice"
- Each question must have exactly 4 options
- Never generate open-ended questions`;
          } else if (settings.questionType === 'open_ended') {
            questionTypeInstructions = `
QUESTION TYPE REQUIREMENTS:
- Generate ONLY open-ended questions
- Every single question must be type "open_ended"
- Each question must have a complete answer in correctAnswer field
- Never generate multiple choice questions`;
          } else { // mixed
            questionTypeInstructions = `
QUESTION TYPE REQUIREMENTS:
- Generate a mix of multiple choice and open-ended questions
- Alternate between types: multiple_choice, open-ended, multiple_choice, etc.
- For multiple choice: provide 4 options
- For open-ended: provide complete answers`;
          }
          
          await openai.beta.assistants.update(process.env.OPENAI_ASSISTANT_ID!, {
            instructions: `You are an expert quiz generator. You MUST generate EXACTLY ${settings.numberOfQuestions} questions - no more, no less.

CRITICAL REQUIREMENTS:
- Generate EXACTLY ${settings.numberOfQuestions} questions
- Count your questions as you generate them: 1, 2, 3... up to ${settings.numberOfQuestions}
- Do not stop until you have exactly ${settings.numberOfQuestions} questions
- If you reach ${settings.numberOfQuestions} questions, stop immediately
- Every question must be unique and well-formed
- EVERY question MUST have a correct answer provided

${questionTypeInstructions}

For regular quiz mode:
- Create questions based on the PDF content
- Focus on key concepts and important details

For language learning mode:
- Extract key vocabulary or sentences from the PDF
- Provide accurate translations

FINAL REMINDER: You MUST have exactly ${settings.numberOfQuestions} questions in your final JSON response.
Every question MUST have a correctAnswer field filled with the proper answer.
Return only valid JSON with no formatting or explanations.`,
            model: 'gpt-4o-mini',
            tools: [{ type: 'file_search' }],
            tool_resources: {
              file_search: {
                vector_store_ids: [vectorStore.id],
              },
            },
          });
          sendJson({ type: 'info', message: 'Creating your quiz questions...' });

          // Step E: Create the thread (the "prompt")
          let promptContent = '';
          if (settings.isLanguageLearning) {
            promptContent = `Extract EXACTLY ${settings.numberOfQuestions} ${settings.extractionType} from the PDF. Source: ${settings.sourceLanguage}, Target: ${settings.targetLanguage}. 

YOU MUST GENERATE EXACTLY ${settings.numberOfQuestions} ITEMS - COUNT THEM CAREFULLY: 1, 2, 3... up to ${settings.numberOfQuestions}!

Return JSON format: {"title":"Language Learning Flashcards","questions":[{"text":"source","type":"translation","correctAnswer":"target"}]}

REMEMBER: Your JSON must contain exactly ${settings.numberOfQuestions} questions in the questions array.`;
          } else {
            let typeSpecificInstructions = '';
            let exampleFormat = '';
            
            if (settings.questionType === 'multiple_choice') {
              typeSpecificInstructions = 'CRITICAL: Generate ONLY multiple choice questions. Every question must be type "multiple_choice" with exactly 4 options.';
              exampleFormat = '{"text":"Question?","type":"multiple_choice","options":["A","B","C","D"],"correctAnswer":"A"}';
            } else if (settings.questionType === 'open_ended') {
              typeSpecificInstructions = 'CRITICAL: Generate ONLY open-ended questions. Every question must be type "open_ended" with a complete answer.';
              exampleFormat = '{"text":"Question?","type":"open_ended","correctAnswer":"Complete detailed answer explaining the concept"}';
            } else { // mixed
              typeSpecificInstructions = 'CRITICAL: Generate a mix of multiple choice and open-ended questions. Alternate between types.';
              exampleFormat = '{"text":"Question?","type":"multiple_choice","options":["A","B","C","D"],"correctAnswer":"A"} OR {"text":"Question?","type":"open_ended","correctAnswer":"Complete answer"}';
            }
            
            promptContent = `Create EXACTLY ${settings.numberOfQuestions} questions from the PDF. Difficulty: ${settings.difficulty}. 

YOU MUST GENERATE EXACTLY ${settings.numberOfQuestions} QUESTIONS - COUNT THEM CAREFULLY: 1, 2, 3... up to ${settings.numberOfQuestions}!

${typeSpecificInstructions}

Return JSON format: {"title":"Quiz Title","questions":[${exampleFormat}]}

REMEMBER: Your JSON must contain exactly ${settings.numberOfQuestions} questions in the questions array.
EVERY question must have a filled correctAnswer field with the proper answer.`;
          }

          const thread = await openai.beta.threads.create({
            messages: [
              {
                role: 'user',
                content: promptContent,
              },
            ],
            tool_resources: {
              file_search: {
                vector_store_ids: [vectorStore.id],
              },
            },
          });

          // Step F: Stream from OpenAI
          let bufferAll = '';
          let questionsFound = 0;
          
          openai.beta.threads.runs
            .stream(thread.id, {
              assistant_id: process.env.OPENAI_ASSISTANT_ID!,
              additional_instructions: `CRITICAL: You MUST generate exactly ${settings.numberOfQuestions} questions. Count each question as you create it: 1, 2, 3... up to ${settings.numberOfQuestions}. Do not stop until you have exactly ${settings.numberOfQuestions} questions. If you reach exactly ${settings.numberOfQuestions} questions, stop immediately. Your final JSON response MUST contain exactly ${settings.numberOfQuestions} questions in the questions array. EVERY question must have a complete correctAnswer field - never leave it empty! ${settings.questionType === 'multiple_choice' ? 'ONLY generate multiple_choice questions with 4 options each.' : settings.questionType === 'open_ended' ? 'ONLY generate open_ended questions with complete answers.' : 'Generate a mix of multiple_choice and open_ended questions, alternating between types.'}`,
            })
            .on('textDelta', (textDelta) => {
              const chunk = textDelta.value || '';
              bufferAll += chunk;
              
              // Parse partial content to show progress for longer generations
              try {
                // Look for complete question objects in the accumulated text
                const questionMatches = bufferAll.match(/\{\s*"text"\s*:\s*"[^"]*"[^}]*\}/g);
                if (questionMatches && questionMatches.length > questionsFound) {
                  questionsFound = questionMatches.length;
                  sendJson({ 
                    type: 'progress', 
                    message: `Generated ${questionsFound} of ${settings.numberOfQuestions} questions...`,
                    count: questionsFound,
                    total: settings.numberOfQuestions
                  });
                }
              } catch (e) {
                // Continue if parsing fails
              }
            })
            .on('toolCallCreated', (toolCall) => {
              sendJson({ 
                type: 'info', 
                message: 'Finding the best content for your quiz...' 
              });
            })
            .on('error', (streamErr) => {
              console.error('OpenAI streaming error:', streamErr);
              sendJson({ type: 'error', message: streamErr.message });
              controller.enqueue(encoder.encode('data: [DONE]\n\n'));
              controller.close();
            })
            .on('end', async () => {
              sendJson({ type: 'info', message: 'Almost done! Putting together your quiz...' });

              try {
                // Attempt to parse the full response
                const parsed = parseAssistantResponse(bufferAll, settings.numberOfQuestions);
                const quizTitle = parsed.title || file.name.replace('.pdf', '');
                let questions = parsed.questions || [];

                // Validate that we have the correct number of questions
                if (questions.length !== settings.numberOfQuestions) {
                  sendJson({ 
                    type: 'warning', 
                    message: `Expected ${settings.numberOfQuestions} questions but got ${questions.length}. Adjusting...` 
                  });
                  
                  if (questions.length > settings.numberOfQuestions) {
                    questions = questions.slice(0, settings.numberOfQuestions);
                    sendJson({ 
                      type: 'info', 
                      message: `Trimmed to exactly ${settings.numberOfQuestions} questions.` 
                    });
                  } else if (questions.length < settings.numberOfQuestions && questions.length > 0) {
                    sendJson({ 
                      type: 'warning', 
                      message: `Only generated ${questions.length} questions instead of ${settings.numberOfQuestions}. This may happen with shorter documents.` 
                    });
                  } else {
                    // No valid questions found, this is an error
                    throw new Error(`Failed to generate any valid questions from the document.`);
                  }
                }

                // Step G: Cleanup (don't wait for this)
                Promise.all([
                  openai.files.del(fileUpload.id).catch(() => {}),
                  fetch(`https://api.openai.com/v1/vector_stores/${vectorStore.id}`, {
                    method: 'DELETE',
                    headers: {
                      'Authorization': `Bearer ${process.env.OPENAI_API_KEY!}`,
                      'OpenAI-Beta': 'assistants=v2'
                    },
                  }).catch(() => {})
                ]);

                // Step H: Save to database if user is authenticated (don't wait for this either)
                if (user && user.id) {
                  // Run database save in background
                  checkUserSubscription(user.id, supabase).then(({ isOnPlan }) => {
                    const isPremium = isOnPlan === 'premium';
                    
                    if (isPremium || settings.numberOfQuestions <= 10) {
                      const quizId = uuidv4();
                      const quizData: Database['public']['Tables']['quizzes']['Insert'] = {
                        id: quizId,
                        title: quizTitle,
                        user_id: user.id,
                        questions,
                        settings,
                        is_language_learning: settings.isLanguageLearning || false,
                        source_language: settings.sourceLanguage || null,
                        target_language: settings.targetLanguage || null,
                        extraction_type: settings.extractionType || null
                      };

                      supabase.from('quizzes').insert(quizData);
                    }
                  }).catch(() => {});
                }

                // Send final quiz data immediately
                sendJson({
                  type: 'final',
                  quiz: {
                    title: quizTitle,
                    questions,
                  },
                });
              } catch (parseErr: any) {
                sendJson({
                  type: 'error',
                  message: `Error parsing quiz: ${parseErr.message}`,
                });
              }

              // Clean up the keepalive interval when done
              clearInterval(keepAliveInterval);

              // Signal we are done
              controller.enqueue(encoder.encode('data: [DONE]\n\n'));
              controller.close();
            });

        } catch (err: any) {
          // Clean up the keepalive interval on error
          clearInterval(keepAliveInterval);
          
          console.error('Error in SSE route:', err);
          // Send SSE error
          sendJson({ type: 'error', message: err.message });
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        }
      },
    });

    return new NextResponse(readableStream, { headers });
  } catch (err: any) {
    console.error('Error in generate-quiz route:', err);
    return new NextResponse(JSON.stringify({ message: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Helper function to check user subscription
async function checkUserSubscription(userId: string, supabase: any) {
  try {
    const { data, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      return { isOnPlan: 'free' };
    }

    // Check if subscription is active
    const now = new Date();
    const currentPeriodEnd = new Date(data.current_period_end);
    
    if (data.status === 'active' && currentPeriodEnd > now) {
      return { isOnPlan: 'premium' };
    }

    return { isOnPlan: 'free' };
  } catch (error) {
    console.error('Error checking subscription:', error);
    return { isOnPlan: 'free' };
  }
} 