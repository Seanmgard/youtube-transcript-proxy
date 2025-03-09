import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { v4 as uuidv4 } from 'uuid'
import { createClient } from '@/utils/supabase/server'
import { getCookieOptions } from '@/utils/supabase/cookies-helper'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

// 25MB limit
const MAX_FILE_SIZE = 25 * 1024 * 1024;

// Helper to wrap data in SSE format
function sseJson(obj: any) {
  return `data: ${JSON.stringify(obj)}\n\n`;
}

// Helper to send raw text chunks in a more readable format
function formatRawChunk(chunk: string) {
  // Replace any JSON-like structures with more readable versions
  return chunk;
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

    // 4) Last resort: Try to manually construct a valid quiz object
    console.log('Attempting to manually extract quiz data');
    try {
      // Look for title
      const titleMatch = cleanedResponse.match(/"title"\s*:\s*"([^"]*)"/);
      const title = titleMatch ? titleMatch[1] : 'Extracted Quiz';
      
      // Look for questions
      const questions = [];
      let questionRegex = /"text"\s*:\s*"([^"]*)"/g;
      let questionMatch;
      
      while ((questionMatch = questionRegex.exec(cleanedResponse)) !== null && questions.length < maxQuestions) {
        const questionText = questionMatch[1];
        const matchIndex = questionMatch.index;
        
        // Try to find options near this question if it's multiple choice
        const optionsMatch = cleanedResponse.substring(matchIndex).match(/"options"\s*:\s*\[(.*?)\]/);
        
        if (optionsMatch) {
          // It's a multiple choice question
          const optionsStr = optionsMatch[1];
          const options = optionsStr.split(',').map(opt => 
            opt.trim().replace(/^"/, '').replace(/"$/, '')
          );
          
          // Try to find correct answer
          const correctMatch = cleanedResponse.substring(matchIndex).match(/"correctAnswer"\s*:\s*"([^"]*)"/);
          const correctAnswer = correctMatch ? correctMatch[1] : options[0];
          
          questions.push({
            text: questionText,
            type: 'multiple_choice',
            options,
            correctAnswer
          });
        } else {
          // It's an open-ended question
          const correctMatch = cleanedResponse.substring(matchIndex).match(/"correctAnswer"\s*:\s*"([^"]*)"/);
          const correctAnswer = correctMatch ? correctMatch[1] : '';
          
          questions.push({
            text: questionText,
            type: 'open_ended',
            correctAnswer
          });
        }
      }
      
      if (questions.length > 0) {
        console.log(`Manually extracted ${questions.length} questions`);
        return { title, questions };
      }
    } catch (e) {
      console.log('Failed to manually extract quiz data:', e);
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
    const cookieStore = cookies();
    const supabase = await createClient();
    
    // Initialize streamInfoMessage variable
    let streamInfoMessage: string | null = null;
    
    // Check if user is authenticated
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    
    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const settingsString = formData.get('settings') as string;
    const settings = JSON.parse(settingsString);
    
    // For unauthenticated users, limit to 10 questions
    if (!user) {
      if (settings.numberOfQuestions > 10) {
        settings.numberOfQuestions = 10;
        // We'll send this message to the client
        const infoMessage = {
          type: 'info',
          message: 'Free users are limited to 10 questions. Sign up for a free account to generate more!'
        };
        
        // Make sure numberOfQuestions is at least 1 and at most 10 for unauthenticated users
        settings.numberOfQuestions = Math.max(1, Math.min(10, settings.numberOfQuestions));
        
        // We'll send this info in the stream
        streamInfoMessage = JSON.stringify(infoMessage);
      }
    } else {
      // For authenticated users, ensure numberOfQuestions is between 1 and 30
      settings.numberOfQuestions = Math.max(1, Math.min(30, settings.numberOfQuestions));
    }
    
    // Validate file
    if (!file || !file.type.includes('pdf')) {
      return Response.json({ error: 'Please upload a PDF file' }, { status: 400 });
    }
    
    // Check file size (25MB limit)
    if (file.size > 25 * 1024 * 1024) {
      return Response.json({ error: 'File size exceeds 25MB limit' }, { status: 400 });
    }

    // Prepare a text encoder for SSE
    const encoder = new TextEncoder();

    // Create the ReadableStream for SSE
    const readableStream = new ReadableStream({
      async start(controller) {
        // Helper to send SSE JSON to the client
        function sendJson(data: any) {
          controller.enqueue(encoder.encode(sseJson(data)));
        }

        try {
          // If we have an info message to send (e.g., for unauthenticated users), send it first
          if (streamInfoMessage) {
            controller.enqueue(new TextEncoder().encode(`data: ${streamInfoMessage}\n\n`));
          }
          
          // Step A: Upload the PDF to OpenAI
          sendJson({ type: 'info', message: 'Uploading file to OpenAI...' });
          const bytes = await file.arrayBuffer();
          const buffer = Buffer.from(bytes);

          const fileUpload = await openai.files.create({
            file: new File([buffer], file.name, { type: 'application/pdf' }),
            purpose: 'assistants',
          });
          sendJson({ type: 'info', message: `File uploaded: ${fileUpload.id}` });

          // Step B: Create a vector store
          sendJson({ type: 'info', message: 'Creating vector store...' });
          const vectorStore = await openai.beta.vectorStores.create({
            name: `Quiz Generation - ${file.name}`,
          });
          sendJson({ type: 'info', message: `Vector store created: ${vectorStore.id}` });

          // Step C: Add the file to the vector store
          sendJson({ type: 'info', message: 'Indexing PDF in vector store...' });
          await openai.beta.vectorStores.fileBatches.uploadAndPoll(vectorStore.id, {
            files: [new File([buffer], file.name, { type: 'application/pdf' })],
          });
          sendJson({ type: 'info', message: 'File indexed in vector store.' });

          // Step D: Update the assistant to use that vector store
          sendJson({ type: 'info', message: 'Configuring assistant...' });
          await openai.beta.assistants.update(process.env.OPENAI_ASSISTANT_ID!, {
            instructions:
              'You are an expert quiz generator. When provided with a PDF file, thoroughly analyze its content and create thoughtful, challenging quiz questions based on the material. Focus on key concepts, important details, and relationships between ideas. Ensure questions test understanding rather than just recall. Your questions should be thought-provoking and require critical thinking. ALWAYS generate EXACTLY the number of questions requested - this is critical. Return only valid JSON with no markdown formatting or explanations.',
            model: 'gpt-4o-mini',
            tools: [{ type: 'file_search' }],
            tool_resources: {
              file_search: {
                vector_store_ids: [vectorStore.id],
              },
            },
          });
          sendJson({ type: 'info', message: 'Assistant updated with vector store.' });

          // Step E: Create the thread (the "prompt")
          sendJson({ type: 'info', message: 'Generating quiz from PDF...' });
          const thread = await openai.beta.threads.create({
            messages: [
              {
                role: 'user',
                content: `
Create a quiz with EXACTLY ${settings.numberOfQuestions} questions based on the PDF content.

Requirements:
- Difficulty: ${settings.difficulty}
- Format: ${settings.questionType}
- EXACTLY ${settings.numberOfQuestions} questions
- Response must be valid JSON only

Be concise and direct. Focus on key concepts from the PDF.
For multiple choice, provide 4 options with 1 correct answer.

Return JSON in this format:
{
  "title": "Quiz Title",
  "questions": [
    {
      "text": "Question text?",
      "type": "multiple_choice",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": "Option A"
    }
  ]
}

If no content found: {"title":"No Content Found","questions":[]}
`,
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
          openai.beta.threads.runs
            .stream(thread.id, {
              assistant_id: process.env.OPENAI_ASSISTANT_ID!,
              additional_instructions: `
Read the PDF thoroughly but efficiently to generate questions quickly.
Generate EXACTLY ${settings.numberOfQuestions} questions.
Your response must be a single, valid JSON object with no markdown formatting, no code blocks, and no explanations.
For multiple choice questions, ensure options are plausible but clearly distinguishable.
Count your questions before finalizing to ensure you have exactly ${settings.numberOfQuestions}.
Be concise and direct in your response to improve speed.

Example format (follow this exactly):
{"title":"Quiz Title","questions":[{"text":"Question?","type":"multiple_choice","options":["A","B","C","D"],"correctAnswer":"A"}]}
`,
            })
            .on('textDelta', (textDelta) => {
              const chunk = textDelta.value || '';
              bufferAll += chunk;

              // Send partial chunk to client as SSE
              // This is what will be displayed in the raw streaming view
              sendJson({ type: 'delta', chunk: formatRawChunk(chunk) });
            })
            .on('toolCallCreated', (toolCall) => {
              // Inform the client that the assistant is searching the document
              sendJson({ 
                type: 'info', 
                message: 'Searching through the document...' 
              });
            })
            .on('toolCallDone', (toolCall) => {
              if (toolCall.type === 'file_search') {
                // Inform the client that the search is complete
                sendJson({ 
                  type: 'info', 
                  message: 'Document search complete, generating questions...' 
                });
              }
            })
            .on('end', async () => {
              // All tokens have streamed in
              sendJson({ type: 'info', message: 'Streaming complete. Parsing final quiz...' });

              try {
                // Attempt to parse the full response
                const parsed = parseAssistantResponse(bufferAll, settings.numberOfQuestions);
                const quizTitle = parsed.title || file.name.replace('.pdf', '');
                let questions = parsed.questions || [];

                // Validate that we have the correct number of questions
                if (questions.length !== settings.numberOfQuestions) {
                  sendJson({ 
                    type: 'warning', 
                    message: `Expected ${settings.numberOfQuestions} questions but received ${questions.length}. Attempting to fix...` 
                  });
                  
                  // If we have more questions than requested, trim the array
                  if (questions.length > settings.numberOfQuestions) {
                    questions = questions.slice(0, settings.numberOfQuestions);
                    sendJson({ 
                      type: 'info', 
                      message: `Trimmed excess questions to match the requested ${settings.numberOfQuestions}.` 
                    });
                  }
                  // If we have fewer questions than requested, we'll use what we have
                  else if (questions.length > 0) {
                    sendJson({ 
                      type: 'info', 
                      message: `Proceeding with ${questions.length} questions instead of the requested ${settings.numberOfQuestions}.` 
                    });
                  }
                }

                // Step G: Cleanup (try-catch to avoid break if fails)
                try {
                  await openai.files.del(fileUpload.id);
                  await openai.beta.vectorStores.del(vectorStore.id);
                } catch (cleanupErr) {
                  console.warn('Resource cleanup error:', cleanupErr);
                }

                // Step H: Insert quiz in DB only if user is authenticated
                if (user && user.id) {
                  try {
                    // First check if the user has reached their monthly quiz limit
                    const { isOnPlan } = await checkUserSubscription(user.id, supabase);
                    const isPremium = isOnPlan === 'premium';
                    
                    if (!isPremium) {
                      // Count quizzes created by the user in the current month
                      const now = new Date();
                      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
                      const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                      
                      // Format dates for Supabase query
                      const startDate = firstDayOfMonth.toISOString();
                      const endDate = lastDayOfMonth.toISOString();
                      
                      const { count, error: countError } = await supabase
                        .from('quizzes')
                        .select('*', { count: 'exact', head: true })
                        .eq('user_id', user.id)
                        .gte('created_at', startDate)
                        .lte('created_at', endDate);
                      
                      if (countError) {
                        console.error('Error checking quiz count:', countError);
                        sendJson({
                          type: 'warning',
                          message: `Error checking quiz limit: ${countError.message}`,
                        });
                        return;
                      }
                      
                      // Check if user has reached the limit
                      if (count && count >= 10) {
                        sendJson({
                          type: 'error',
                          message: 'You have reached your monthly quiz limit. Please upgrade to Premium for unlimited quizzes.',
                        });
                        return;
                      }
                      
                      // Check if the quiz has more than 10 questions for free users
                      if (settings.numberOfQuestions > 10) {
                        sendJson({
                          type: 'error',
                          message: 'Free users can only create quizzes with up to 10 questions. Please upgrade to Premium for larger quizzes.',
                        });
                        return;
                      }
                    }
                    
                    // Now insert the quiz
                    const quizId = uuidv4();
                    const { error: dbError } = await supabase
                      .from('quizzes')
                      .insert({
                        id: quizId,
                        title: quizTitle,
                        user_id: user.id,
                        questions,
                        settings,
                        pdf_url: '',
                        created_at: new Date().toISOString(),
                      });

                    if (dbError) {
                      console.error('DB insert error:', dbError);
                      sendJson({
                        type: 'warning',
                        message: `Quiz generated but DB insert failed: ${dbError.message}`,
                      });
                    } else {
                      sendJson({
                        type: 'info',
                        message: 'Quiz saved successfully!',
                      });
                    }
                  } catch (checkError) {
                    console.error('Error checking subscription:', checkError);
                    sendJson({
                      type: 'warning',
                      message: `Error checking subscription: ${checkError}`,
                    });
                  }
                }

                // Send final quiz data
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
                  message: `Error parsing final quiz: ${parseErr.message}`,
                });
              }

              // Signal we are done
              controller.enqueue(encoder.encode('data: [DONE]\n\n'));
              controller.close();
            })
            .on('error', (streamErr) => {
              console.error('OpenAI streaming error:', streamErr);
              sendJson({ type: 'error', message: streamErr.message });
              controller.enqueue(encoder.encode('data: [DONE]\n\n'));
              controller.close();
            });
        } catch (err: any) {
          console.error('Error in SSE route:', err);
          // Send SSE error
          sendJson({ type: 'error', message: err.message });
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        }
      },
    });

    // Return SSE response
    return new Response(readableStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
      },
    });
  } catch (outerError: any) {
    console.error('Outer error (before streaming):', outerError);
    // Fallback: return JSON error
    return NextResponse.json(
      {
        success: false,
        message: outerError.message || 'An unexpected error occurred',
      },
      { status: 500 }
    );
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
    
    if (error) {
      console.error('Error fetching subscription:', error);
      return { isOnPlan: 'free' };
    }
    
    const isSubscriptionActive = data?.status === 'active' || data?.status === 'trialing';
    const isOnPlan = data?.plan_type === 'premium' && isSubscriptionActive ? 'premium' : 'free';
    
    return { isOnPlan };
  } catch (error) {
    console.error('Error in checkUserSubscription:', error);
    return { isOnPlan: 'free' };
  }
}
