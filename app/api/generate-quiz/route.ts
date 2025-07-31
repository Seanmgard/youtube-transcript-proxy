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
  const validQuestions = questions.filter(q => {
    // Basic validation for all question types
    const basicValid = q && typeof q.text === 'string' && q.text.trim().length > 0 &&
      q.type && q.correctAnswer && typeof q.correctAnswer === 'string' &&
      q.correctAnswer.trim().length > 0 &&
      !q.text.toLowerCase().includes('please review the document') &&
      !q.text.toLowerCase().includes('based on that information') &&
      !q.text.toLowerCase().includes('unique questions') &&
      q.text.length > 15; // Must be substantial

    if (!basicValid) return false;

    // Type-specific validation
    if (q.type === 'cloze') {
      // For cloze deletion, validate clozeText and originalText
      return q.clozeText && typeof q.clozeText === 'string' &&
             q.clozeText.includes('{{c1::') &&
             q.originalText && typeof q.originalText === 'string';
    } else {
      // For other question types, must be a proper question
      return q.text.includes('?');
    }
  });

  // Only return valid questions, don't pad with generic ones
  return validQuestions.slice(0, targetCount);
}

function extractMeaningfulTitle(aiTitle: string | null | undefined, fallbackFileName?: string): string {
  console.log('📝 TITLE DEBUG: Raw AI title received:', aiTitle);
  console.log('📝 TITLE DEBUG: Fallback filename:', fallbackFileName);
  
  // Use AI-generated title if it exists and isn't completely generic
  if (aiTitle && aiTitle.trim().length > 0) {
    let cleanTitle = aiTitle.trim();
    console.log('📝 TITLE DEBUG: Cleaned AI title:', cleanTitle);
    
    // Remove instructional text that might be included in the response
    cleanTitle = cleanTitle.replace(/^(Create a specific, descriptive title that reflects|Generate a specific, descriptive title|Title:|TITLE:)/i, '').trim();
    console.log('📝 TITLE DEBUG: After removing instructions:', cleanTitle);
    
    // Only filter out the most obviously generic titles - be much less restrictive
    const exactGenericTitles = [
      'generated quiz', 'quiz generation error', 'untitled', 'document quiz',
      '[main academic subject]', '[main document topic]', 'main academic subject', 'main document topic',
      'academic subject', 'document topic', 'quiz title', 'untitled quiz', 'quiz'
    ];
    const isExactlyGeneric = exactGenericTitles.some(generic => cleanTitle.toLowerCase() === generic);
    console.log('📝 TITLE DEBUG: Is exactly generic?', isExactlyGeneric);
    
    // Also check if it's just instructional text
    const isInstructional = cleanTitle.toLowerCase().includes('create a specific') || 
                           cleanTitle.toLowerCase().includes('generate a specific') ||
                           cleanTitle.toLowerCase().includes('reflects the main topics') ||
                           cleanTitle.toLowerCase().includes('e.g.');
    console.log('📝 TITLE DEBUG: Is instructional?', isInstructional);
    
    if (!isExactlyGeneric && !isInstructional && cleanTitle.length > 3) {
      // Clean up the title
      cleanTitle = cleanTitle.replace(/[()]/g, '').trim(); // Remove parentheses
      cleanTitle = cleanTitle.replace(/^['"]|['"]$/g, '').trim(); // Remove quotes
      
      // If it doesn't already end with "Quiz", add it
      if (!cleanTitle.toLowerCase().endsWith('quiz')) {
        cleanTitle += ' Quiz';
      }
      console.log('📝 TITLE DEBUG: Final processed title:', cleanTitle);
      return cleanTitle;
    }
  }
  
  console.log('📝 TITLE DEBUG: AI title rejected, trying filename fallback');
  
  // Fallback to filename-based title only for clean filenames
  if (fallbackFileName && fallbackFileName.length < 50 && !fallbackFileName.includes('%')) {
    const cleanFileName = fallbackFileName
      .replace(/\.(pdf|doc|docx|ppt|pptx|txt|csv)$/i, '') // Remove file extension
      .replace(/[_-]/g, ' ') // Replace underscores and hyphens with spaces
      .replace(/([a-z])([A-Z])/g, '$1 $2') // Add space between camelCase
      .split(' ')
      .filter(word => word.length > 2) // Remove very short words
      .slice(0, 3) // Keep only first 3 meaningful words
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ')
      .trim();
    
    if (cleanFileName.length > 0) {
      console.log('📝 TITLE DEBUG: Using filename-based title:', `${cleanFileName} Quiz`);
      return `${cleanFileName} Quiz`;
    }
  }
  
  // Final fallback
  console.log('📝 TITLE DEBUG: Using final fallback: Generated Quiz');
  return 'Generated Quiz';
}

function parseAssistantResponse(response: string, maxQuestions: number, fallbackFileName?: string): any {
  console.log('🔍 Parsing final assistant response...');
  
  try {
    // First try to parse the response as JSON (it should already be formatted)
    const parsed = JSON.parse(response);
    if (parsed && parsed.questions && Array.isArray(parsed.questions)) {
      console.log(`✅ Successfully parsed ${parsed.questions.length} questions from final response`);
      const validatedQuestions = validateAndCompleteQuestions(parsed.questions, maxQuestions);
      return {
        title: extractMeaningfulTitle(parsed.title, fallbackFileName),
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
          title: extractMeaningfulTitle(parsed.title, fallbackFileName),
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
        title: extractMeaningfulTitle(null, fallbackFileName),
        questions: textQuestions
      };
    }
    
  } catch (e) {
    console.error("❌ Failed to parse assistant response:", e);
    console.log('Raw response:', response.substring(0, 500) + '...');
  }

  console.log('⚠️ Using fallback questions');
  const fallbackQuestions = generateFallbackQuestions(maxQuestions);
  return { title: extractMeaningfulTitle('Quiz Generation Error', fallbackFileName), questions: fallbackQuestions };
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

async function generateQuestionsWithRetry(openai: OpenAI, threadId: string, assistant: any, sendJson: Function, targetCount: number, settings: any): Promise<string> {
  let allQuestions: any[] = [];
  let aiGeneratedTitle: string | null = null; // Track the AI-generated title
  let attempts = 0;
  const maxAttempts = 3; // Increase attempts for larger files
  
  // Send initial progress
  sendJson({ 
    type: 'progress', 
    message: settings.questionType === 'cloze'
      ? `🔬 Starting cloze deletion generation - analyzing content for key terms and definitions...`
      : `🔬 Starting quiz generation - analyzing content for educational value...` 
  });
  
  while (allQuestions.length < targetCount && attempts < maxAttempts) {
    attempts++;
    const remaining = targetCount - allQuestions.length;
    
    try {
      sendJson({ 
        type: 'progress', 
        message: settings.questionType === 'cloze' 
          ? `📝 Creating ${remaining} high-quality cloze deletion cards...` 
          : `📝 Creating ${remaining} high-quality educational questions...` 
      });
      
      // Simulate progress updates for better UX
      let simulatedProgress = allQuestions.length;
      const progressMessages = settings.questionType === 'cloze' ? [
        '🔍 Analyzing content for key terms and definitions...',
        '📚 Identifying important phrases and concepts for cloze deletion...',
        '🧩 Creating fill-in-the-blank sentences from document text...',
        '✏️ Marking key terms with {{c1::}} deletion format...',
        '🎯 Ensuring cloze deletions focus on core subject matter...',
        '📝 Finalizing high-quality cloze deletion cards...'
      ] : [
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
              message: settings.questionType === 'cloze'
                ? `📊 Progress: ${simulatedProgress}/${targetCount} cloze cards crafted (${Math.round((simulatedProgress/targetCount)*100)}%)`
                : `📊 Progress: ${simulatedProgress}/${targetCount} questions crafted (${Math.round((simulatedProgress/targetCount)*100)}%)` 
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
        content: settings.questionType === 'cloze' 
          ? `I need exactly ${remaining} more cloze deletion cards. Extract ${remaining} additional sentences from the content and convert to cloze format.

CLOZE DELETION GUIDELINES:
- Make deletions VARIABLE in length - mix single words, phrases, and longer segments
- Prioritize meaningful chunks like: full concepts, technical terms, numerical values, key phrases, definitions
- VARY DELETION POSITIONS - place deletions at the beginning, middle, and end of sentences
- For mathematical formulas, use LaTeX formatting (e.g., $E = mc^2$, $\\frac{a}{b}$, $\\sqrt{x}$)
- CRITICAL: Make questions SELF-CONTAINED - do NOT reference "Equation (3)", "Exhibit 2", "Table 1", "Figure 4", etc.
- If mentioning a formula/equation, include the FULL equation in the question text
- Replace references like "Equation (4)" with the actual equation or descriptive text
- Examples of good deletions (showing various positions):
  * Beginning: "{{c1::Mitochondria}} are the powerhouse organelles of the cell"
  * Middle: "The cell uses {{c1::ATP}} as its primary energy currency"
  * End: "DNA replication occurs during {{c1::the S phase}}"
  * Mid-sentence process: "Photosynthesis {{c1::converts carbon dioxide and water into glucose}} using sunlight"
  * Mathematical: "The area formula {{c1::A = πr²}} calculates the area of a circle"
  * Mid-sentence concept: "When calculating {{c1::compound interest}}, the principal amount grows exponentially"

FORMAT REQUIRED:
{
  "title": "${aiGeneratedTitle || '[Subject Topic]'}",
  "questions": [
    {
      "text": "Brief description",
      "type": "cloze",
      "clozeText": "Sentence with {{c1::meaningful deletion}} marked",
      "originalText": "Sentence with meaningful deletion unmarked",
      "correctAnswer": "meaningful deletion"
    }
  ]
}

IMPORTANT: Only create "type": "cloze" - no multiple choice questions!`
          : `Generate exactly ${remaining} high-quality questions based on the document content. I need exactly ${remaining} questions to reach my target of ${targetCount} total questions.

CRITICAL REQUIREMENTS:
- Each question must be a complete, well-formed question ending with "?"
- Base every question on specific content from the document
- Avoid generic phrases like "based on that information" or "unique questions"
- Generate exactly ${remaining} questions, no more, no less
- Each question should test understanding of different document sections

Return in JSON format:
{
  "title": "[Main Topic]",
  "questions": [
    {
      "text": "What specific concept does the document explain about [topic]?",
      "type": "${settings.questionType}",
      ${settings.questionType === 'multiple_choice' ? '"options": ["Option A", "Option B", "Option C", "Option D"],' : ''}
      "correctAnswer": "Option A"
    }
  ]
}`
      });
      
      const stream = openai.beta.threads.runs.stream(threadId, { assistant_id: assistant.id });
      
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
      const batchResult = parseQuestionsFromResponse(bufferAll);
      
      // Capture the title from the first successful response
      if (!aiGeneratedTitle && batchResult.title) {
        aiGeneratedTitle = batchResult.title;
        console.log('🔍 TITLE DEBUG: Captured AI title from response:', aiGeneratedTitle);
      }
      
      if (batchResult.questions.length > 0) {
        // Add valid questions using the same validation logic
        const validQuestions = validateAndCompleteQuestions(batchResult.questions, batchResult.questions.length);
        
        allQuestions = [...allQuestions, ...validQuestions];
        const currentTotal = allQuestions.length;
        
        sendJson({ 
          type: 'progress', 
          message: settings.questionType === 'cloze'
            ? `✅ Created ${validQuestions.length} cloze deletion cards (${currentTotal}/${targetCount} total)`
            : `✅ Created ${validQuestions.length} educational questions (${currentTotal}/${targetCount} total)` 
        });
        
        if (currentTotal >= targetCount) {
          sendJson({ 
            type: 'success', 
            message: settings.questionType === 'cloze'
              ? `🎉 Excellent! Successfully generated all ${targetCount} cloze deletion cards focused on the core subject matter!`
              : `🎉 Excellent! Successfully generated all ${targetCount} educational questions focused on the core subject matter!` 
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
          content: settings.questionType === 'cloze'
            ? `Extract exactly ${remaining} more sentences and convert to cloze format with VARIABLE deletion lengths (mix single words, phrases, and longer segments). 

IMPORTANT: 
- VARY DELETION POSITIONS - place deletions at beginning, middle, and end of sentences
- For math formulas, use LaTeX formatting (e.g., $E = mc^2$, $\\frac{a}{b}$)
- Make questions SELF-CONTAINED - do NOT reference "Equation (3)", "Exhibit 2", "Table 1", etc. 
- Include FULL equations/formulas in the text if referenced

Return JSON with title: "${aiGeneratedTitle || '[Subject Topic]'}", and questions array with "type": "cloze", clozeText with {{c1::meaningful deletion}}, originalText, and correctAnswer fields.`
            : `I need exactly ${remaining} more questions to reach ${targetCount} total. Generate ${remaining} additional questions based on different parts of the document.`
        });
        
        const stream = openai.beta.threads.runs.stream(threadId, { assistant_id: assistant.id });
        let bufferAll = '';
        for await (const event of stream) {
          if (event.event === 'thread.message.delta') {
            const content = event.data.delta.content?.[0];
            if (content?.type === 'text' && content.text?.value) {
              bufferAll += content.text.value;
            }
          }
        }
        
        const additionalResult = parseQuestionsFromResponse(bufferAll);
        const validAdditional = validateAndCompleteQuestions(additionalResult.questions, additionalResult.questions.length);
        
        allQuestions = [...allQuestions, ...validAdditional];
      } catch (retryError) {
        console.error('Retry attempt failed:', retryError);
      }
    }
  }
  
  // Format the final response
  const finalResponse = {
    title: aiGeneratedTitle || "Generated Quiz", // Use AI title if captured, fallback otherwise
    questions: allQuestions.slice(0, targetCount) // Ensure we don't exceed target
  };
  
  console.log('🔍 TITLE DEBUG: Final response title:', finalResponse.title);
  return JSON.stringify(finalResponse);
}

function parseQuestionsFromResponse(response: string): { questions: any[], title?: string } {
  const questions: any[] = [];
  let title: string | undefined = undefined;
  
  console.log('🔍 PARSING DEBUG: Raw response:', response.substring(0, 200) + '...');
  
  try {
    // Try to parse as JSON first
    let cleanedResponse = response.trim().replace(/```json\s*|```/g, '');
    const jsonMatch = cleanedResponse.match(/(\{[\s\S]*\})/);
    
    if (jsonMatch && jsonMatch[1]) {
      const parsed = JSON.parse(jsonMatch[1]);
      console.log('🔍 PARSING DEBUG: Parsed JSON:', parsed);
      
      if (parsed.questions && Array.isArray(parsed.questions)) {
        const filteredQuestions = parsed.questions.filter((q: any) => 
          q && q.text && !q.text.toLowerCase().includes('please review the document')
        );
        console.log('🔍 PARSING DEBUG: Extracted title from JSON:', parsed.title);
        return {
          questions: filteredQuestions,
          title: parsed.title
        };
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
  
  console.log('🔍 PARSING DEBUG: Returning fallback with questions:', questions.length);
  return { questions, title: undefined };
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

    // Check subscription and enforce question limits
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('plan_type')
      .eq('user_id', user.id)
      .single();
    
    const isPremium = subscription?.plan_type === 'premium';
    const maxQuestions = isPremium ? 50 : 10;
    
    if (settings.numberOfQuestions > maxQuestions) {
      return NextResponse.json({ 
        error: `Free users are limited to ${maxQuestions} questions per quiz. Upgrade to Premium for up to 50 questions.` 
      }, { status: 403 });
    }
    
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
          let assistant: any = null;
          
          if (settings.sourceType === 'youtube' && transcriptText) {
            // Handle YouTube transcript
            sendJson({ type: 'info', message: '🎬 Processing video transcript for educational content...' });
            sendJson({ type: 'info', message: '🧠 AI is identifying key concepts and learning objectives...' });
            sendJson({ type: 'progress', message: `🎯 Crafting ${settings.numberOfQuestions} educational questions focused on the subject matter...` });
            
            thread = await openai.beta.threads.create({
              messages: [{
                role: 'user',
                content: settings.questionType === 'cloze' 
                  ? `Extract exactly ${settings.numberOfQuestions} sentences from this YouTube transcript and convert them to cloze deletion format for Anki flashcards.

VIDEO TRANSCRIPT:
${transcriptText}

CLOZE DELETION STRATEGY:
1. Find ${settings.numberOfQuestions} important sentences from the content that contain key facts, definitions, formulas, or concepts
2. Use sentences EXACTLY as they appear in the source material, with minimal modifications
3. Each cloze card must have EXACTLY ONE deletion marked with {{c1::text}}
4. NEVER create multiple deletions in the same sentence (no scattered blanks)
5. Focus deletion on the most educational part: key terms, definitions, processes, formulas, numerical values
6. Ensure the sentence makes sense as a standalone statement without document context
7. For mathematical formulas, use LaTeX formatting (e.g., $E = mc^2$, $\\frac{a}{b}$, $\\sqrt{x}$)
8. CRITICAL: Make questions SELF-CONTAINED - do NOT reference "Equation (3)", "Exhibit 2", "Table 1", "Figure 4", etc.
9. If mentioning a formula/equation, include the FULL equation in the question text
10. Replace references like "Equation (4)" with the actual equation or descriptive text

SINGLE DELETION EXAMPLES (ONE per sentence):
- Single word: "The {{c1::mitochondria}} produces energy for the cell"
- Short phrase: "Water boils at {{c1::100 degrees Celsius}}"  
- Medium phrase: "Photosynthesis converts {{c1::carbon dioxide and water into glucose}}"
- Key concept: "The investment horizon should match your {{c1::risk tolerance}}"
- Definition: "{{c1::Compound interest}} allows your money to grow exponentially over time"
- Mathematical: "The area of a circle is calculated using {{c1::A = πr²}}"

SELF-CONTAINED EXAMPLES:
- BAD: "Equation (4) is the standard formula for determining the {{c1::after-tax standard deviation}}"
- GOOD: "The formula σ_AT = σ_BT × (1-T) is used to determine the {{c1::after-tax standard deviation}}"
- BAD: "The total return in Exhibit 2 is the {{c1::pre-tax geometric total return}}"
- GOOD: "When calculating investment performance, the total return is the {{c1::pre-tax geometric total return}}"

REQUIRED FORMAT - Return this exact JSON structure:
{
  "title": "[Subject Topic]",
  "questions": [
    {
      "text": "Brief description of concept",
      "type": "cloze",
      "clozeText": "The {{c1::meaningful deletion segment}} creates educational value.",
      "originalText": "The meaningful deletion segment creates educational value.",
      "correctAnswer": "meaningful deletion segment"
    }
  ]
}

EXAMPLES FROM YOUR GUIDELINES:
- If transcript says: "Photosynthesis converts carbon dioxide and water into glucose using sunlight"
- Create: "clozeText": "Photosynthesis converts {{c1::carbon dioxide and water into glucose}} using sunlight"
- correctAnswer: "carbon dioxide and water into glucose"

- If transcript says: "The formula for the area of a circle is pi times radius squared"  
- Create: "clozeText": "{{c1::The formula for the area of a circle}} is pi times radius squared"
- correctAnswer: "The formula for the area of a circle"

IMPORTANT: Only use "type": "cloze" - do NOT create multiple choice questions!`
                  : `Analyze the following YouTube video transcript thoroughly and generate exactly ${settings.numberOfQuestions} high-quality educational quiz questions.

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
- ONLY use information that is explicitly stated or directly explained in the video transcript
- DO NOT include external knowledge, outside references, or information not covered in the video

QUESTION REQUIREMENTS:
- Generate exactly ${settings.numberOfQuestions} questions (difficulty: ${settings.difficulty}, type: ${settings.questionType})
- Each question must test understanding of SPECIFIC ACADEMIC FACTS, CONCEPTS, OR FORMULAS
- CRITICAL: Each question must be UNIQUE - do not repeat the same question with different wording
- CRITICAL: Do not ask about the same concept/fact multiple times in different ways
- Questions should be about content that would appear in a textbook or academic curriculum
- Focus ONLY on subject-specific knowledge (definitions, formulas, theorems, facts, processes)
- NEVER ask about teaching methods, study strategies, or classroom procedures
- NEVER ask about what students "should do" when solving problems
- NEVER use phrases like "What does the speaker emphasize/suggest/recommend/advise"
- NEVER ask about the instructor's opinions, preferences, or teaching approach
- Each question must be a complete, well-formed question ending with "?"
- Questions should test memorization and understanding of academic content, not study skills or pedagogical methods
- Ensure variety in topics covered from different parts of the video transcript

CONTENT RESTRICTION REQUIREMENTS:
- Questions must ONLY test knowledge that can be answered using information in the video transcript
- DO NOT ask questions that require external knowledge beyond what's explained in the video
- DO NOT reference outside sources, textbooks, or general knowledge not mentioned in the video
- If the video doesn't provide enough context for a concept, do not create questions about it

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
  "title": "Statistics Probability Theory",
  "questions": [
    {
      "text": "What [academic concept/definition/formula] was explained in the video?",
      "type": "${settings.questionType}",
      ${settings.questionType === 'multiple_choice' ? '"options": ["Academic option A", "Academic option B", "Academic option C", "Academic option D"],' : ''}
      "correctAnswer": "Academic option A"
    }
  ]
}

TITLE REQUIREMENT: 
- Generate a SPECIFIC, DESCRIPTIVE title that reflects the actual content analyzed (e.g., "Algebra Quadratic Equations", "Biology Cell Structure", "History Roman Empire")
- DO NOT use placeholder text like "[Main Academic Subject]" or "[Main Document Topic]"
- The title should be 2-5 words describing the specific academic topic(s) covered
- Base the title on the key concepts, subject matter, and topics identified in the video

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
                content: settings.questionType === 'cloze'
                  ? `Extract exactly ${settings.numberOfQuestions} sentences from the attached document and convert them to cloze deletion format for Anki flashcards.

CLOZE DELETION STRATEGY:
1. Read the attached document carefully
2. Find ${settings.numberOfQuestions} important sentences from the content that contain key facts, definitions, formulas, or concepts
3. Use sentences EXACTLY as they appear in the source material, with minimal modifications
4. Each cloze card must have EXACTLY ONE deletion marked with {{c1::text}}
5. NEVER create multiple deletions in the same sentence (no scattered blanks)
6. Focus deletion on the most educational part: key terms, definitions, processes, formulas, numerical values
7. Ensure the sentence makes sense as a standalone statement without document context
8. For mathematical formulas, use LaTeX formatting (e.g., $E = mc^2$, $\\frac{a}{b}$, $\\sqrt{x}$)
9. CRITICAL: Make questions SELF-CONTAINED - do NOT reference "Equation (3)", "Exhibit 2", "Table 1", "Figure 4", etc.
10. If mentioning a formula/equation, include the FULL equation in the question text
11. Replace references like "Equation (4)" with the actual equation or descriptive text

SINGLE DELETION EXAMPLES (ONE per sentence):
- Single word: "The {{c1::mitochondria}} produces energy for the cell"
- Short phrase: "Water boils at {{c1::100 degrees Celsius}}"  
- Medium phrase: "Photosynthesis converts {{c1::carbon dioxide and water into glucose}}"
- Key concept: "The investment horizon should match your {{c1::risk tolerance}}"
- Definition: "{{c1::Compound interest}} allows your money to grow exponentially over time"
- Mathematical: "The area of a circle is calculated using {{c1::A = πr²}}"

SELF-CONTAINED EXAMPLES:
- BAD: "Equation (4) is the standard formula for determining the {{c1::after-tax standard deviation}}"
- GOOD: "The formula σ_AT = σ_BT × (1-T) is used to determine the {{c1::after-tax standard deviation}}"
- BAD: "The total return in Exhibit 2 is the {{c1::pre-tax geometric total return}}"
- GOOD: "When calculating investment performance, the total return is the {{c1::pre-tax geometric total return}}"

REQUIRED FORMAT - Return this exact JSON structure:
{
  "title": "[Subject Topic]",
  "questions": [
    {
      "text": "Brief description of concept",
      "type": "cloze",
      "clozeText": "The {{c1::variable length meaningful deletion}} enhances learning.",
      "originalText": "The variable length meaningful deletion enhances learning.",
      "correctAnswer": "variable length meaningful deletion"
    }
  ]
}

CORRECT FORMAT EXAMPLES:
- BAD (multiple deletions): "Her horizon is {{c1::shorter}}, only {{c2::three years}}, and she wants growth"
- GOOD (single deletion): "Her horizon for the education account is shorter, only {{c1::three years}}"
- BAD (external reference): "Equation (4) shows the {{c1::after-tax return calculation}}"
- GOOD (self-contained): "The after-tax return is calculated using {{c1::σ_AT = σ_BT × (1-T)}}"
- BAD (too modified): "Investment accounts require {{c1::proper planning}}"  
- GOOD (faithful to source): "The education account has a shorter time horizon of {{c1::three years}}"

IMPORTANT: Only use "type": "cloze" - do NOT create multiple choice questions!`
                  : `Analyze the attached document thoroughly and generate exactly ${settings.numberOfQuestions} high-quality quiz questions.

DOCUMENT ANALYSIS INSTRUCTIONS:
- Read through the ENTIRE document carefully, including all sections
- For large documents, ensure questions cover different parts/sections
- Extract specific facts, concepts, and details from the document content
- ONLY use information that is explicitly stated or directly derivable from the uploaded document
- DO NOT include external knowledge, outside references, or information not contained in the document

QUESTION REQUIREMENTS:
- Generate exactly ${settings.numberOfQuestions} questions (difficulty: ${settings.difficulty}, type: ${settings.questionType})
- Each question must be a complete, well-formed question ending with "?"
- Base every question on specific information found in the document
- CRITICAL: Each question must be UNIQUE - do not repeat the same question with different wording
- CRITICAL: Do not ask about the same concept/fact multiple times in different ways
- Avoid generic phrases like "based on that information", "unique questions", or "please review"
- Questions should be substantial (at least 15 characters)
- Test understanding of different document sections/topics
- Ensure variety in topics covered - don't focus too heavily on one section

CONTENT RESTRICTION REQUIREMENTS:
- Questions must ONLY test knowledge that can be answered using information in the uploaded document
- DO NOT ask questions that require external knowledge beyond what's in the document
- DO NOT reference outside sources, general knowledge, or industry standards not mentioned in the document
- If the document doesn't provide enough context for a concept, do not create questions about it

JSON FORMAT (REQUIRED):
{
  "title": "Cell Biology Mitosis",
  "questions": [
    {
      "text": "What specific [concept/fact] does the document explain about [topic]?",
      "type": "${settings.questionType}",
      ${settings.questionType === 'multiple_choice' ? '"options": ["Specific option A", "Specific option B", "Specific option C", "Specific option D"],' : ''}
      "correctAnswer": "Specific option A"
    }
  ]
}

TITLE REQUIREMENT: 
- Generate a SPECIFIC, DESCRIPTIVE title that reflects the actual content analyzed (e.g., "Chemistry Molecular Bonds", "Literature Shakespeare Analysis", "Economics Supply Demand")  
- DO NOT use placeholder text like "[Main Document Topic]" or "[Main Academic Subject]"
- The title should be 2-5 words describing the specific academic topic(s) covered
- Base the title on the key concepts, subject matter, and topics identified in the document

Generate exactly ${settings.numberOfQuestions} questions now based on the document content:`,
                attachments: [{ file_id: fileUpload.id, tools: [{ type: 'file_search' }] }]
              }]
            });
          }

          // Create temporary assistant with gpt-4.1 for better document processing
          assistant = await openai.beta.assistants.create({
            name: "Quiz Generator",
            instructions: `You are a quiz generator that creates high-quality educational questions from documents. Always use the attached document as your ONLY source of information. Generate questions that test understanding of the specific content provided.`,
            model: "gpt-4-1106-preview", // This is gpt-4.1
            tools: [{ type: "file_search" }]
          });

          const responseText = await generateQuestionsWithRetry(openai, thread.id, assistant, sendJson, settings.numberOfQuestions, settings);
          // Extract filename for meaningful title generation
          const originalFileName = settings.sourceType === 'youtube' ? 'YouTube Video' : 
                                  (blobUrl ? new URL(blobUrl).pathname.split('/').pop() || 'uploaded_file' : 'uploaded_file');
          const parsed = parseAssistantResponse(responseText, settings.numberOfQuestions, originalFileName);

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

          // Clean up the uploaded file and assistant from OpenAI
          if (fileUpload) {
            try {
              await openai.files.del(fileUpload.id);
              sendJson({ type: 'info', message: '🧹 File cleanup completed.' });
            } catch (cleanupError) {
              console.error("File cleanup error:", cleanupError);
            }
          }
          
          // Clean up the temporary assistant
          try {
            await openai.beta.assistants.del(assistant.id);
            console.log(`🗑️ Cleaned up assistant: ${assistant.id}`);
          } catch (cleanupError) {
            console.error('Failed to cleanup assistant:', cleanupError);
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