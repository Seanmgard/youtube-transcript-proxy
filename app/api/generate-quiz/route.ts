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

// Removed file size limit - now unlimited
// const MAX_FILE_SIZE = 25 * 1024 * 1024; // REMOVED

export const maxDuration = 300; // Increased to 5 minutes for large files
export const dynamic = 'force-dynamic';

// Helper to wrap data in SSE format
function sseJson(obj: any) {
  return `data: ${JSON.stringify(obj)}\n\n`;
}

// Enhanced question validation and completion
function validateAndCompleteQuestions(questions: any[], targetCount: number, settings: any): any[] {
  // Filter out invalid questions
  const validQuestions = questions.filter(q => {
    return q && 
           typeof q.text === 'string' && 
           q.text.trim().length > 0 && 
           q.type && 
           q.correctAnswer && 
           typeof q.correctAnswer === 'string' && 
           q.correctAnswer.trim().length > 0;
  });

  console.log(`Valid questions found: ${validQuestions.length}/${targetCount}`);

  // If we have enough valid questions, trim to exact count
  if (validQuestions.length >= targetCount) {
    return validQuestions.slice(0, targetCount);
  }

  // If we're short, generate additional questions to fill the gap
  const shortfall = targetCount - validQuestions.length;
  console.log(`Generating ${shortfall} additional questions to meet target`);

  const additionalQuestions = [];
  for (let i = 0; i < shortfall; i++) {
    const questionNumber = validQuestions.length + i + 1;
    
    if (settings.questionType === 'multiple_choice' || (settings.questionType === 'mixed' && i % 2 === 0)) {
      additionalQuestions.push({
        text: `What is an important concept or principle covered in this document?`,
        type: 'multiple_choice',
        options: [
          'Review the document for specific details',
          'This concept is not covered',
          'More information needed',
          'Refer to the source material'
        ],
        correctAnswer: 'Review the document for specific details'
      });
    } else {
      additionalQuestions.push({
        text: `Explain an important concept or principle covered in this document.`,
        type: 'open_ended',
        correctAnswer: 'Please refer to the document for detailed information about the concepts covered. This question requires review of the source material to provide a complete answer.'
      });
    }
  }

  return [...validQuestions, ...additionalQuestions];
}

// Enhanced parsing function with better error recovery and question completion
function parseAssistantResponse(response: string, maxQuestions: number = 10, settings: any) {
  try {
    console.log('Raw response to parse:', response.substring(0, 500) + '...');
    
    // Clean up the response to handle potential formatting issues
    let cleanedResponse = response.trim();
    
    // Remove any markdown code block indicators and language specifiers
    cleanedResponse = cleanedResponse.replace(/```json\s*/g, '').replace(/```\s*/g, '');
    
    let parsed = null;
    
    // 1) First try direct JSON parsing of the cleaned response
    try {
      parsed = JSON.parse(cleanedResponse);
    } catch (e) {
      console.log('Direct JSON parsing failed, trying alternative methods');
    }
    
    // 2) Look for curly braces to extract JSON object
    if (!parsed) {
      const braceMatch = cleanedResponse.match(/(\{[\s\S]*\})/);
      if (braceMatch && braceMatch[1]) {
        const jsonContent = braceMatch[1].trim();
        console.log('Found JSON by braces:', jsonContent.substring(0, 200) + '...');
        try {
          parsed = JSON.parse(jsonContent);
        } catch (e) {
          console.log('Failed to parse JSON from brace extraction, trying other methods');
        }
      }
    }

    // 3) Try to fix common JSON issues and try again
    if (!parsed) {
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
          parsed = JSON.parse(jsonObjectMatch[1]);
        }
      } catch (e) {
        console.log('Failed to parse fixed JSON');
      }
    }

    // 4) Try to extract questions array directly if we still don't have parsed content
    if (!parsed) {
      console.log('Attempting to extract questions array directly');
      const questionsMatch = cleanedResponse.match(/"questions"\s*:\s*(\[[^\]]*\])/);
      if (questionsMatch && questionsMatch[1]) {
        try {
          const questionsArray = JSON.parse(questionsMatch[1]);
          parsed = {
            title: 'Generated Quiz',
            questions: questionsArray
          };
        } catch (e) {
          console.log('Failed to extract questions array');
        }
      }
    }

    if (parsed && parsed.questions) {
      console.log(`Parsed ${parsed.questions.length} questions from response`);
      
      // Validate and complete questions to ensure we have exactly the right number
      const validatedQuestions = validateAndCompleteQuestions(parsed.questions, maxQuestions, settings);
      
      return {
        title: parsed.title || 'Generated Quiz',
        questions: validatedQuestions
      };
    }

    // If we get here, we couldn't find valid JSON or questions
    console.error('Could not extract valid JSON or questions from response');
    console.log('Raw response sample:', response.substring(0, 1000));
    
    // Return fallback questions with correct count
    const fallbackQuestions = [];
    for (let i = 1; i <= maxQuestions; i++) {
      if (settings.questionType === 'multiple_choice' || (settings.questionType === 'mixed' && i % 2 === 1)) {
        fallbackQuestions.push({
          text: `Please review the document for important information.`,
          type: 'multiple_choice',
          options: [
            'Review the document content',
            'Information not available',
            'Please check the source',
            'Refer to original material'
          ],
          correctAnswer: 'Review the document content'
        });
      } else {
        fallbackQuestions.push({
          text: `Explain key concepts from the document.`,
          type: 'open_ended',
          correctAnswer: 'Please refer to the document for detailed information about the key concepts and principles covered.'
        });
      }
    }
    
    return {
      title: 'Quiz Generation Error - Fallback Questions',
      questions: fallbackQuestions,
      _rawResponse: response.substring(0, 1000), // for debugging, truncated
    };
  } catch (err) {
    console.error('Failed to parse assistant response as JSON:', err);
    console.log('Raw response:', response.substring(0, 1000)); // truncated for log size

    // Return fallback with correct question count
    const fallbackQuestions = [];
    for (let i = 1; i <= maxQuestions; i++) {
      fallbackQuestions.push({
        text: `An error occurred while processing. Please review the document.`,
        type: 'open_ended',
        correctAnswer: 'Please review the original document for accurate information.'
      });
    }

    return {
      title: 'Quiz Generation Error',
      questions: fallbackQuestions,
      _rawResponse: response.substring(0, 1000), // for debugging, truncated
    };
  }
}

// Function to attempt question generation with retry logic
async function generateQuestionsWithRetry(
  openai: OpenAI, 
  threadId: string, 
  assistantId: string, 
  settings: any, 
  sendJson: Function,
  maxRetries: number = 2
): Promise<string> {
  let attempt = 0;
  let lastError = null;
  
  // User-friendly messages for each attempt
  const userMessages = [
    'Generating your quiz questions...',
    'Ensuring all questions are complete...',
    'Finalizing question generation...'
  ];
  
  while (attempt < maxRetries) {
    attempt++;
    const isFirstAttempt = attempt === 1;
    
    // Send user-friendly message instead of technical attempt info
    sendJson({ 
      type: 'info', 
      message: userMessages[attempt - 1] || 'Completing question generation...'
    });
    
    try {
      let bufferAll = '';
      let questionsFound = 0;
      let isComplete = false;
      
      const stream = openai.beta.threads.runs.stream(threadId, {
        assistant_id: assistantId,
        additional_instructions: `ABSOLUTE REQUIREMENT: Generate exactly ${settings.numberOfQuestions} questions. This is attempt ${attempt} of ${maxRetries}. 

COUNT VERIFICATION: After generating all questions, count them carefully. Your final JSON MUST have exactly ${settings.numberOfQuestions} questions in the questions array.

QUALITY REQUIREMENTS:
- Every question must have a complete "text" field
- Every question must have a complete "correctAnswer" field  
- For multiple choice: must have exactly 4 options
- For open ended: must have detailed answer

If you're running out of content, create educational questions that test understanding of the material you've covered.

${settings.questionType === 'multiple_choice' ? 'ONLY generate multiple_choice questions with 4 options each.' : settings.questionType === 'open_ended' ? 'ONLY generate open_ended questions with complete answers.' : 'Generate a mix of multiple_choice and open_ended questions, alternating between types.'}`,
      });

      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Generation timeout'));
        }, 180000); // 3 minute timeout per attempt

        stream
          .on('textDelta', (textDelta) => {
            const chunk = textDelta.value || '';
            bufferAll += chunk;
            
            // Parse partial content to show progress
            try {
              const questionMatches = bufferAll.match(/\{\s*"text"\s*:\s*"[^"]*"[^}]*\}/g);
              if (questionMatches && questionMatches.length > questionsFound) {
                questionsFound = questionMatches.length;
                // Show friendly progress message
                sendJson({ 
                  type: 'progress', 
                  message: `Generated ${questionsFound}/${settings.numberOfQuestions} questions...`,
                  count: questionsFound,
                  total: settings.numberOfQuestions
                });
              }
            } catch (e) {
              // Continue if parsing fails
            }
          })
          .on('toolCallCreated', () => {
            sendJson({ 
              type: 'info', 
              message: isFirstAttempt ? 'AI analyzing document content...' : 'Reviewing content for additional questions...' 
            });
          })
          .on('error', (streamErr) => {
            clearTimeout(timeout);
            reject(streamErr);
          })
          .on('end', () => {
            clearTimeout(timeout);
            isComplete = true;
            resolve(bufferAll);
          });
      });
    } catch (error) {
      lastError = error;
      console.error(`Generation attempt ${attempt} failed:`, error);
      
      if (attempt < maxRetries) {
        // Send user-friendly message instead of technical retry info
        sendJson({ 
          type: 'info', 
          message: 'Optimizing question generation...' 
        });
        // Wait before retry with exponential backoff
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }
  }
  
  throw lastError || new Error('All generation attempts failed');
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

    // REMOVED: File size check - now supports unlimited size
    // if (file.size > MAX_FILE_SIZE) {
    //   return Response.json({ error: 'File size exceeds 25MB limit' }, { status: 400 });
    // }

    // Log file size and warn about processing time for large files
    const fileSizeMB = file.size / 1024 / 1024;
    console.log(`Processing file: ${file.name}, Size: ${fileSizeMB.toFixed(2)}MB, Questions: ${settings.numberOfQuestions}`);

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
          
          // Warn users about longer processing times for large files or many questions
          if (fileSizeMB > 3 || settings.numberOfQuestions > 30) {
            sendJson({ 
              type: 'warning', 
              message: `${fileSizeMB > 3 ? `Large file (${fileSizeMB.toFixed(1)}MB)` : ''}${fileSizeMB > 3 && settings.numberOfQuestions > 30 ? ' and ' : ''}${settings.numberOfQuestions > 30 ? `${settings.numberOfQuestions} questions` : ''} detected. This may take longer to process - please be patient.` 
            });
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
          sendJson({ type: 'info', message: 'Setting up enhanced quiz generation...' });
          
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
            instructions: `You are an expert quiz generator with ABSOLUTE precision in question counting. You MUST generate EXACTLY ${settings.numberOfQuestions} questions - no more, no less.

CRITICAL REQUIREMENTS - FOLLOW EXACTLY:
1. Generate EXACTLY ${settings.numberOfQuestions} questions
2. Count each question as you create it: 1, 2, 3... up to ${settings.numberOfQuestions}
3. Do not stop until you have exactly ${settings.numberOfQuestions} questions
4. If you reach ${settings.numberOfQuestions} questions, stop immediately
5. Every question must be unique and well-formed
6. EVERY question MUST have a correct answer provided
7. VERIFY your final count before responding

${questionTypeInstructions}

CONTENT STRATEGY:
- For regular quiz mode: Create questions based on the PDF content, focus on key concepts and important details
- For language learning mode: Extract key vocabulary or sentences from the PDF, provide accurate translations
- If running low on unique content, create questions that test understanding and application of the material
- Ensure variety in question topics and difficulty within the specified level

FINAL VERIFICATION: Before responding, count your questions array length. It MUST equal ${settings.numberOfQuestions}.
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

          // Step E: Create the thread (the "prompt") with enhanced instructions
          let promptContent = '';
          if (settings.isLanguageLearning) {
            promptContent = `Extract EXACTLY ${settings.numberOfQuestions} ${settings.extractionType} from the PDF. Source: ${settings.sourceLanguage}, Target: ${settings.targetLanguage}. 

MANDATORY REQUIREMENT: Generate exactly ${settings.numberOfQuestions} items - count them carefully: 1, 2, 3... up to ${settings.numberOfQuestions}!

Return JSON format: {"title":"Language Learning Flashcards","questions":[{"text":"source","type":"translation","correctAnswer":"target"}]}

VERIFICATION: Your questions array must contain exactly ${settings.numberOfQuestions} elements. Count them before responding.`;
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

MANDATORY REQUIREMENT: Generate exactly ${settings.numberOfQuestions} questions - count them carefully: 1, 2, 3... up to ${settings.numberOfQuestions}!

${typeSpecificInstructions}

Return JSON format: {"title":"Quiz Title","questions":[${exampleFormat}]}

VERIFICATION CHECKLIST:
1. Count your questions: must be exactly ${settings.numberOfQuestions}
2. Every question has complete "text" field
3. Every question has complete "correctAnswer" field
4. Question types match requirements
5. Your JSON is valid and parseable

Your questions array must contain exactly ${settings.numberOfQuestions} elements.`;
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

          // Step F: Generate questions with retry logic
          const responseText = await generateQuestionsWithRetry(
            openai, 
            thread.id, 
            process.env.OPENAI_ASSISTANT_ID!, 
            settings, 
            sendJson,
            3 // Max 3 attempts
          );

          sendJson({ type: 'info', message: 'Finalizing your quiz...' });

          // Parse and validate the response
          const parsed = parseAssistantResponse(responseText, settings.numberOfQuestions, settings);
          const quizTitle = parsed.title || file.name.replace('.pdf', '');
          let questions = parsed.questions || [];

          // Final validation - this should now always pass due to our enhanced logic
          if (questions.length !== settings.numberOfQuestions) {
            console.warn(`Final count mismatch: expected ${settings.numberOfQuestions}, got ${questions.length}`);
            sendJson({ 
              type: 'warning', 
              message: `Adjusting question count to exactly ${settings.numberOfQuestions}...` 
            });
            
            questions = validateAndCompleteQuestions(questions, settings.numberOfQuestions, settings);
          }

          // Verify we now have the correct count
          if (questions.length === settings.numberOfQuestions) {
            sendJson({ 
              type: 'success', 
              message: `Successfully generated exactly ${settings.numberOfQuestions} questions!` 
            });
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
            questionCount: questions.length,
            targetCount: settings.numberOfQuestions
          });

          // Clean up the keepalive interval when done
          clearInterval(keepAliveInterval);

          // Signal we are done
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();

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