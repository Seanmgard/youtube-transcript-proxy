import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createClient } from '@/lib/supabase/server';
import type { Database } from "@/lib/database.types";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

function sseJson(obj: any) {
  return `data: ${JSON.stringify(obj)}\n\n`;
}

function validateAndCompleteQuestions(questions: any[], targetCount: number): any[] {
  const validQuestions = questions.filter(q =>
    q && typeof q.text === 'string' && q.text.trim().length > 0 &&
    q.type && q.correctAnswer && typeof q.correctAnswer === 'string' &&
    q.correctAnswer.trim().length > 0 &&
    !q.text.toLowerCase().includes('please review the document') &&
    !q.text.toLowerCase().includes('based on that information') &&
    !q.text.toLowerCase().includes('unique questions') &&
    q.text.includes('?') && // Must be a proper question
    q.text.length > 15 // Must be substantial
  );

  // Only return valid questions, don't pad with generic ones
  return validQuestions.slice(0, targetCount);
}

function parseAssistantResponse(response: string, maxQuestions: number): any {
  console.log('🔍 Parsing final assistant response...');
  
  try {
    // First try to parse the response as JSON (it should already be formatted)
    const parsed = JSON.parse(response);
    if (parsed && parsed.questions && Array.isArray(parsed.questions)) {
      console.log(`✅ Successfully parsed ${parsed.questions.length} questions from final response`);
      const validatedQuestions = validateAndCompleteQuestions(parsed.questions, maxQuestions);
      return {
        title: parsed.title || 'Generated Quiz',
        questions: validatedQuestions
      };
    }
  } catch (e) {
    console.log('Final response is not valid JSON, attempting text extraction...');
  }
  
  // Fallback to original parsing logic
  try {
    // Try to find and extract JSON from the response
    let cleanedResponse = response.trim();
    
    // Remove markdown code blocks
    cleanedResponse = cleanedResponse.replace(/```json\s*|```/g, '');
    
    // Try to find JSON object in the response
    const jsonMatch = cleanedResponse.match(/(\{[\s\S]*\})/);
    
    if (jsonMatch && jsonMatch[1]) {
      console.log('🎯 Found JSON in response, attempting to parse...');
      const parsed = JSON.parse(jsonMatch[1]);
      
      if (parsed && parsed.questions && Array.isArray(parsed.questions)) {
        console.log(`✅ Successfully parsed ${parsed.questions.length} questions`);
        const validatedQuestions = validateAndCompleteQuestions(parsed.questions, maxQuestions);
        return {
          title: parsed.title || 'Generated Quiz',
          questions: validatedQuestions
        };
      } else {
        console.log('❌ Parsed JSON but missing questions array');
      }
    } else {
      console.log('❌ No JSON found in response');
    }
    
    // If JSON parsing fails, try to extract questions from plain text
    console.log('🔧 Attempting to extract questions from plain text...');
    const textQuestions = extractQuestionsFromText(response, maxQuestions);
    if (textQuestions.length > 0) {
      console.log(`✅ Extracted ${textQuestions.length} questions from text`);
      return {
        title: 'Generated Quiz',
        questions: textQuestions
      };
    }
    
  } catch (e) {
    console.error("❌ Failed to parse assistant response:", e);
    console.log('Raw response:', response.substring(0, 500) + '...');
  }

  console.log('⚠️ Using fallback questions');
  const fallbackQuestions = generateFallbackQuestions(maxQuestions);
  return { title: 'Quiz Generation Error', questions: fallbackQuestions };
}

function extractQuestionsFromText(text: string, maxQuestions: number): any[] {
  const questions: any[] = [];
  
  // Try to extract questions from numbered list format
  const questionPattern = /(\d+\.?\s*)(.*?)(?=\d+\.|$)/g;
  let match;
  
  while ((match = questionPattern.exec(text)) !== null && questions.length < maxQuestions) {
    const questionText = match[2]?.trim();
    if (questionText && questionText.length > 10 && !questionText.toLowerCase().includes('please review')) {
      questions.push({
        text: questionText,
        type: 'open_ended',
        correctAnswer: 'Based on the document content'
      });
    }
  }
  
  return questions;
}

function generateFallbackQuestions(count: number): any[] {
  const fallbackQuestions = [];
  for (let i = 0; i < count; i++) {
    fallbackQuestions.push({
      text: `Question ${i + 1}: What is the main topic discussed in this section of the document?`,
      type: 'open_ended',
      correctAnswer: 'Please refer to the specific section of the document for detailed information.'
    });
  }
  return fallbackQuestions;
}

async function generateQuestionsWithRetry(openai: OpenAI, threadId: string, assistantId: string, sendJson: Function, targetCount: number): Promise<string> {
  let allQuestions: any[] = [];
  let attempts = 0;
  const maxAttempts = 3; // Increase attempts for larger files
  
  // Send initial progress
  sendJson({ 
    type: 'progress', 
    message: `🔬 Starting quiz generation - analyzing content for educational value...` 
  });
  
  while (allQuestions.length < targetCount && attempts < maxAttempts) {
    attempts++;
    const remaining = targetCount - allQuestions.length;
    
    try {
      sendJson({ 
        type: 'progress', 
        message: `📝 Creating ${remaining} high-quality educational questions...` 
      });
      
      // Simulate progress updates for better UX
      let simulatedProgress = allQuestions.length;
      const progressMessages = [
        '🔍 Analyzing content for key concepts and learning objectives...',
        '📚 Identifying important definitions and formulas...',
        '🧩 Crafting questions to test understanding...',
        '✏️ Refining questions for educational value...',
        '🎯 Ensuring questions focus on core subject matter...',
        '📝 Finalizing high-quality educational questions...'
      ];
      let messageIndex = 0;
      
      const progressInterval = setInterval(() => {
        if (simulatedProgress < targetCount) {
          // Alternate between progress count and descriptive messages
          if (messageIndex % 2 === 0) {
            simulatedProgress++;
            sendJson({ 
              type: 'progress', 
              message: `📊 Progress: ${simulatedProgress}/${targetCount} questions crafted (${Math.round((simulatedProgress/targetCount)*100)}%)` 
            });
          } else {
            const msgIdx = Math.floor(messageIndex / 2) % progressMessages.length;
            sendJson({ 
              type: 'progress', 
              message: progressMessages[msgIdx]
            });
          }
          messageIndex++;
        }
      }, 1200); // Update every 1.2 seconds for smoother progression
      
      // Add a message to the thread for this batch
      await openai.beta.threads.messages.create(threadId, {
        role: 'user',
        content: `Generate exactly ${remaining} high-quality questions based on the document content. I need exactly ${remaining} questions to reach my target of ${targetCount} total questions.

CRITICAL REQUIREMENTS:
- Each question must be a complete, well-formed question ending with "?"
- Base every question on specific content from the document
- Avoid generic phrases like "based on that information" or "unique questions"
- Generate exactly ${remaining} questions, no more, no less
- Each question should test understanding of different document sections

Return in JSON format:
{
  "title": "Quiz on [Document Topic]",
  "questions": [
    {
      "text": "What specific concept does the document explain about [topic]?",
      "type": "multiple_choice",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": "Option A"
    }
  ]
}`
      });
      
      const stream = openai.beta.threads.runs.stream(threadId, { assistant_id: assistantId });
      
      let bufferAll = '';
      for await (const event of stream) {
        if (event.event === 'thread.message.delta') {
          const content = event.data.delta.content?.[0];
          if (content?.type === 'text' && content.text?.value) {
            bufferAll += content.text.value;
          }
        }
      }
      
      clearInterval(progressInterval); // Stop simulated progress
      
      // Parse the batch response
      const batchQuestions = parseQuestionsFromResponse(bufferAll);
      
      if (batchQuestions.length > 0) {
        // Add valid questions
        const validQuestions = batchQuestions.filter(q =>
          q && typeof q.text === 'string' && q.text.trim().length > 0 &&
          q.type && q.correctAnswer && typeof q.correctAnswer === 'string' &&
          q.correctAnswer.trim().length > 0 &&
          !q.text.toLowerCase().includes('please review the document') &&
          !q.text.toLowerCase().includes('based on that information') &&
          !q.text.toLowerCase().includes('unique questions') &&
          q.text.includes('?') && // Must be a proper question
          q.text.length > 15 // Must be substantial
        );
        
        allQuestions = [...allQuestions, ...validQuestions];
        const currentTotal = allQuestions.length;
        
        sendJson({ 
          type: 'progress', 
          message: `✅ Created ${validQuestions.length} educational questions (${currentTotal}/${targetCount} total)` 
        });
        
        if (currentTotal >= targetCount) {
          sendJson({ 
            type: 'success', 
            message: `🎉 Excellent! Successfully generated all ${targetCount} educational questions focused on the core subject matter!` 
          });
          break; // Exit the loop when we have enough questions
        }
      } else {
        clearInterval(progressInterval);
        sendJson({ 
          type: 'warning', 
          message: `Attempt ${attempts} didn't generate valid questions. Trying again...` 
        });
      }
      
    } catch (error) {
      console.error(`Batch ${attempts} failed:`, error);
      sendJson({ 
        type: 'warning', 
        message: `Encountered an issue generating questions. Trying again... (Attempt ${attempts}/${maxAttempts})` 
      });
    }
  }
  
  // Check if we got enough questions
  if (allQuestions.length === 0) {
    throw new Error('Unable to generate any valid questions from the document. Please try uploading a different document with more text content.');
  }
  
  if (allQuestions.length < targetCount) {
    sendJson({ 
      type: 'warning', 
      message: `Generated ${allQuestions.length} out of ${targetCount} requested questions. Retrying to get the remaining ${targetCount - allQuestions.length} questions...` 
    });
    
    // Try one more time for the remaining questions if we're close
    if (allQuestions.length >= Math.floor(targetCount * 0.7)) { // If we have at least 70%
      try {
        const remaining = targetCount - allQuestions.length;
        await openai.beta.threads.messages.create(threadId, {
          role: 'user',
          content: `I need exactly ${remaining} more questions to reach ${targetCount} total. Generate ${remaining} additional questions based on different parts of the document.`
        });
        
        const stream = openai.beta.threads.runs.stream(threadId, { assistant_id: assistantId });
        let bufferAll = '';
        for await (const event of stream) {
          if (event.event === 'thread.message.delta') {
            const content = event.data.delta.content?.[0];
            if (content?.type === 'text' && content.text?.value) {
              bufferAll += content.text.value;
            }
          }
        }
        
        const additionalQuestions = parseQuestionsFromResponse(bufferAll);
        const validAdditional = additionalQuestions.filter(q =>
          q && typeof q.text === 'string' && q.text.trim().length > 0 &&
          q.type && q.correctAnswer && typeof q.correctAnswer === 'string' &&
          q.correctAnswer.trim().length > 0 &&
          !q.text.toLowerCase().includes('please review the document') &&
          !q.text.toLowerCase().includes('based on that information') &&
          !q.text.toLowerCase().includes('unique questions') &&
          q.text.includes('?') && q.text.length > 15
        );
        
        allQuestions = [...allQuestions, ...validAdditional];
      } catch (retryError) {
        console.error('Retry attempt failed:', retryError);
      }
    }
  }
  
  // Format the final response
  const finalResponse = {
    title: "Generated Quiz",
    questions: allQuestions.slice(0, targetCount) // Ensure we don't exceed target
  };
  
  return JSON.stringify(finalResponse);
}

function parseQuestionsFromResponse(response: string): any[] {
  const questions: any[] = [];
  
  try {
    // Try to parse as JSON first
    let cleanedResponse = response.trim().replace(/```json\s*|```/g, '');
    const jsonMatch = cleanedResponse.match(/(\{[\s\S]*\})/);
    
    if (jsonMatch && jsonMatch[1]) {
      const parsed = JSON.parse(jsonMatch[1]);
      if (parsed.questions && Array.isArray(parsed.questions)) {
        return parsed.questions.filter((q: any) => 
          q && q.text && !q.text.toLowerCase().includes('please review the document')
        );
      }
    }
  } catch (e) {
    console.log('JSON parsing failed, trying text extraction...');
  }
  
  // Fallback to text extraction
  const questionPattern = /(\d+\.?\s*)(.*?)(?=\d+\.|$)/g;
  let match;
  
  while ((match = questionPattern.exec(response)) !== null) {
    const questionText = match[2]?.trim();
    if (questionText && questionText.length > 10 && !questionText.toLowerCase().includes('please review')) {
      questions.push({
        text: questionText,
        type: 'open_ended',
        correctAnswer: 'Based on the document content'
      });
    }
  }
  
  return questions;
}

function getFileExtensionFromUrl(url: string): string {
  // Extract filename from URL
  const urlPath = new URL(url).pathname;
  const filename = urlPath.split('/').pop() || '';
  const extension = filename.split('.').pop()?.toLowerCase() || '';
  return extension;
}

function createFileWithExtension(blob: Blob, originalUrl: string): File {
  const extension = getFileExtensionFromUrl(originalUrl);
  const filename = `uploaded_file.${extension}`;
  
  // Map file extensions to MIME types
  const mimeTypeMap: { [key: string]: string } = {
    'pdf': 'application/pdf',
    'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'ppt': 'application/vnd.ms-powerpoint',
    'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'txt': 'text/plain',
    'csv': 'text/csv',
  };
  
  const mimeType = mimeTypeMap[extension] || blob.type || 'application/octet-stream';
  
  return new File([blob], filename, { type: mimeType });
}

export async function POST(request: Request) {
  try {
    // Check for required environment variables
    const requiredEnvVars = {
      'OPENAI_API_KEY': process.env.OPENAI_API_KEY,
      'OPENAI_ASSISTANT_ID': process.env.OPENAI_ASSISTANT_ID,
      'BLOB_READ_WRITE_TOKEN': process.env.BLOB_READ_WRITE_TOKEN
    };

    const missingVars = Object.entries(requiredEnvVars)
      .filter(([_, value]) => !value)
      .map(([key, _]) => key);

    if (missingVars.length > 0) {
      console.error('Missing environment variables:', missingVars);
      return NextResponse.json({ 
        error: `Missing required environment variables: ${missingVars.join(', ')}. Please configure them in your deployment settings.` 
      }, { status: 500 });
    }

    // Validate that the assistant exists
    try {
      await openai.beta.assistants.retrieve(process.env.OPENAI_ASSISTANT_ID!);
      console.log('✅ OpenAI Assistant validated successfully');
    } catch (assistantError) {
      console.error('❌ OpenAI Assistant validation failed:', assistantError);
      return NextResponse.json({ 
        error: `OpenAI Assistant not found. Please check your OPENAI_ASSISTANT_ID environment variable.` 
      }, { status: 500 });
    }

    const headers = new Headers({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no'
    });

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
    }

    const { blobUrl, settings, transcriptText } = await request.json();
    
    // Handle YouTube transcript or file upload
    if (settings.sourceType === 'youtube' && transcriptText) {
      // YouTube transcript path - no file validation needed
      if (!transcriptText || !settings) {
        return NextResponse.json({ error: 'Missing transcript text or settings for YouTube quiz generation' }, { status: 400 });
      }
    } else {
      // File upload path - validate blob URL and file type
      if (!blobUrl || !settings) {
        return NextResponse.json({ error: 'Missing blobUrl or settings' }, { status: 400 });
      }

      // Validate the blob URL has a proper file extension
      const fileExtension = getFileExtensionFromUrl(blobUrl);
      const allowedExtensions = ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'txt', 'csv'];
      
      if (!fileExtension || !allowedExtensions.includes(fileExtension)) {
        return NextResponse.json({ 
          error: `Invalid file type. Supported formats: ${allowedExtensions.join(', ')}` 
        }, { status: 400 });
      }
    }

    const readableStream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        const sendJson = (data: any) => controller.enqueue(encoder.encode(sseJson(data)));
        const keepAliveInterval = setInterval(() => controller.enqueue(encoder.encode(':keepalive\n\n')), 15000);

        try {
          let thread;
          let fileUpload = null;
          
          if (settings.sourceType === 'youtube' && transcriptText) {
            // Handle YouTube transcript
            sendJson({ type: 'info', message: '🎬 Processing video transcript for educational content...' });
            sendJson({ type: 'info', message: '🧠 AI is identifying key concepts and learning objectives...' });
            sendJson({ type: 'progress', message: `🎯 Crafting ${settings.numberOfQuestions} educational questions focused on the subject matter...` });
            
            thread = await openai.beta.threads.create({
              messages: [{
                role: 'user',
                content: `Analyze the following YouTube video transcript thoroughly and generate exactly ${settings.numberOfQuestions} high-quality educational quiz questions.

VIDEO TRANSCRIPT:
${transcriptText}

CRITICAL CONTENT FOCUS REQUIREMENTS:
- ONLY create questions about the MAIN SUBJECT MATTER and educational content of the video
- Focus EXCLUSIVELY on concepts, theories, formulas, definitions, processes, and factual information being taught
- COMPLETELY IGNORE any mentions of: 
  * Homework policies, grading, administrative details
  * Teaching methods, classroom procedures, study tips
  * Problem-solving strategies or general advice (e.g., "use a calculator", "check your work")
  * Personal anecdotes, technical difficulties, or classroom management
  * Speaker's opinions on non-academic matters
  * General educational advice or meta-learning concepts
- Questions must be about SPECIFIC ACADEMIC CONTENT that can be found in textbooks
- Prioritize substantive subject matter that students need to learn and memorize
- Focus on the "what" and "how" of the academic discipline, not the "how to study" or "how to approach problems"

TRANSCRIPT ANALYSIS INSTRUCTIONS:
- Identify the core academic subject being taught (e.g., mathematics, science, history, etc.)
- Extract key concepts, definitions, formulas, theories, and important facts
- Focus on learning objectives and educational takeaways
- Look for explanations of processes, problem-solving methods, and conceptual understanding

QUESTION REQUIREMENTS:
- Generate exactly ${settings.numberOfQuestions} questions (difficulty: ${settings.difficulty}, type: ${settings.questionType})
- Each question must test understanding of SPECIFIC ACADEMIC FACTS, CONCEPTS, OR FORMULAS
- Questions should be about content that would appear in a textbook or academic curriculum
- Focus ONLY on subject-specific knowledge (definitions, formulas, theorems, facts, processes)
- NEVER ask about teaching methods, study strategies, or classroom procedures
- NEVER ask about what students "should do" when solving problems
- NEVER use phrases like "What does the speaker emphasize/suggest/recommend/advise"
- NEVER ask about the instructor's opinions, preferences, or teaching approach
- Each question must be a complete, well-formed question ending with "?"
- Questions should test memorization and understanding of academic content, not study skills or pedagogical methods

EXAMPLES OF GOOD QUESTIONS (if this were a statistics video):
- "What is the definition of probability as explained in the lecture?"
- "What is the formula for calculating combinations?"
- "What is the difference between permutations and combinations?"
- "What does the multiplication principle state?"
- "How is conditional probability defined?"

EXAMPLES OF BAD QUESTIONS TO AVOID (DO NOT CREATE THESE TYPES):
- "What should be done if a problem involves tedious calculations?"
- "What is the recommended method for checking answers?"
- "What does the speaker suggest when approaching difficult problems?"
- "What does the speaker emphasize about checking answers in mathematical problems?"
- "How should students verify their work?"
- "What advice does the instructor give about problem-solving?"
- "What is the speaker's stance on homework submission policies?"
- "What study methods are recommended?"
- "What does the instructor recommend for difficult calculations?"
- "What approach does the speaker suggest for complex problems?"

JSON FORMAT (REQUIRED):
{
  "title": "Quiz on [Main Academic Subject]",
  "questions": [
    {
      "text": "What [academic concept/definition/formula] was explained in the video?",
      "type": "${settings.questionType === 'mixed' ? 'multiple_choice' : settings.questionType}",
      "options": ["Academic option A", "Academic option B", "Academic option C", "Academic option D"],
      "correctAnswer": "Academic option A"
    }
  ]
}

FINAL INSTRUCTION: Before creating each question, ask yourself these validation questions:
1. "Is this question about a specific academic fact, concept, definition, or formula that would be in a textbook?"
2. "Does this question ask about WHAT something is, rather than what the speaker thinks/suggests/emphasizes?"
3. "Would this question be appropriate for testing knowledge of the subject matter itself, not teaching methods?"

If the answer to ANY of these is no, DO NOT include that question.

Generate exactly ${settings.numberOfQuestions} questions focused ONLY on objective academic content:`
              }]
            });
          } else {
            // Handle file upload
            sendJson({ type: 'info', message: 'Fetching uploaded file...' });
            
            const fileResponse = await fetch(blobUrl);
            if (!fileResponse.ok) {
              throw new Error(`Failed to fetch file from blob storage: ${fileResponse.statusText}`);
            }
            
            const fileBlob = await fileResponse.blob();
            
            // Validate file size (should be under 50MB for processing)
            const maxSize = 50 * 1024 * 1024; // 50MB
            if (fileBlob.size > maxSize) {
              throw new Error(`File size (${Math.round(fileBlob.size / 1024 / 1024)}MB) exceeds the 50MB limit for AI processing.`);
            }
            
            const file = createFileWithExtension(fileBlob, blobUrl);
            
            sendJson({ type: 'info', message: `📄 Processing ${file.name} (${Math.round(fileBlob.size / 1024)}KB)...` });
            sendJson({ type: 'info', message: '🚀 Uploading to AI for analysis...' });
            
            fileUpload = await openai.files.create({ 
              file, 
              purpose: 'assistants' 
            });

            sendJson({ type: 'info', message: '🧠 AI is reading your document...' });
            sendJson({ type: 'progress', message: `🎯 Getting ready to create ${settings.numberOfQuestions} questions just for you...` });
            
            thread = await openai.beta.threads.create({
              messages: [{
                  role: 'user',
                content: `Analyze the attached document thoroughly and generate exactly ${settings.numberOfQuestions} high-quality quiz questions.

DOCUMENT ANALYSIS INSTRUCTIONS:
- Read through the ENTIRE document carefully, including all sections
- For large documents, ensure questions cover different parts/sections
- Extract specific facts, concepts, and details from the document content

QUESTION REQUIREMENTS:
- Generate exactly ${settings.numberOfQuestions} questions (difficulty: ${settings.difficulty}, type: ${settings.questionType})
- Each question must be a complete, well-formed question ending with "?"
- Base every question on specific information found in the document
- Avoid generic phrases like "based on that information", "unique questions", or "please review"
- Questions should be substantial (at least 15 characters)
- Test understanding of different document sections/topics

JSON FORMAT (REQUIRED):
{
  "title": "Quiz on [Main Document Topic]",
  "questions": [
    {
      "text": "What specific [concept/fact] does the document explain about [topic]?",
      "type": "${settings.questionType === 'mixed' ? 'multiple_choice' : settings.questionType}",
      "options": ["Specific option A", "Specific option B", "Specific option C", "Specific option D"],
      "correctAnswer": "Specific option A"
    }
  ]
}

Generate exactly ${settings.numberOfQuestions} questions now based on the document content:`,
                attachments: [{ file_id: fileUpload.id, tools: [{ type: 'file_search' }] }]
              }]
            });
          }

          const responseText = await generateQuestionsWithRetry(openai, thread.id, process.env.OPENAI_ASSISTANT_ID!, sendJson, settings.numberOfQuestions);
          const parsed = parseAssistantResponse(responseText, settings.numberOfQuestions);

          sendJson({ type: 'info', message: '💾 Saving your quiz to the database...' });

          if (user.id) {
            try {
              await supabase.from('quizzes').insert({
                title: parsed.title,
                questions: parsed.questions,
                settings: settings,
                user_id: user.id
              });
              sendJson({ type: 'info', message: '✅ Quiz saved successfully!' });
            } catch (dbError) {
              console.error("DB save error:", dbError);
              sendJson({ type: 'warning', message: '⚠️ Quiz generated but failed to save to database.' });
            }
          }

          sendJson({ type: 'final', quiz: parsed });

          // Clean up the uploaded file from OpenAI (only if it was uploaded)
          if (fileUpload) {
            try {
              await openai.files.del(fileUpload.id);
              sendJson({ type: 'info', message: '🧹 Cleanup completed.' });
            } catch (cleanupError) {
              console.error("Cleanup error:", cleanupError);
            }
          }

          // Send completion signal
          sendJson({ type: 'complete', message: '🎉 Your quiz is ready! Generated successfully!' });

        } catch (err: any) {
          console.error("Error in SSE stream:", err);
          sendJson({ type: 'error', message: err.message });
        } finally {
          clearInterval(keepAliveInterval);
          controller.close();
        }
      }
    });

    return new NextResponse(readableStream, { headers });
  } catch (err: any) {
    console.error("Error in POST route:", err);
    return new NextResponse(JSON.stringify({ message: err.message }), { status: 500 });
  }
} 