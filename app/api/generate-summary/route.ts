import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { put } from '@vercel/blob';
import { createClient } from '@/utils/supabase/server';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Helper function to extract file extension from URL
function getFileExtensionFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const extension = pathname.split('.').pop()?.toLowerCase();
    return extension || 'pdf';
  } catch {
    return 'pdf';
  }
}

// Helper function to generate prompts based on document type
function getPromptForDocumentType(category: 'small' | 'medium' | 'large', type: string, targetWords: number): string {
  const basePrompt = `You are DOCUGUIDE, a smart document analyzer creating focused study guides.

CRITICAL OUTPUT FORMAT: 
- PURE MARKDOWN ONLY - NO JSON WHATSOEVER
- OUTPUT ONLY RAW MARKDOWN TEXT
- NO SOURCES, CITATIONS, OR REFERENCES OF ANY KIND
- DO NOT include any source attributions, footnotes, or citations

DOCUMENT STRUCTURE PRESERVATION:
- MAINTAIN the exact structure from the original document
- Use ACTUAL chapter titles and headings from the source
- Follow the document's original organization

CRITICAL ANTI-REPETITION RULES:
- DO NOT repeat the same information multiple times
- COVER each topic only ONCE in appropriate detail
- AVOID redundant explanations of the same concepts

MATHEMATICAL FORMATTING:
- ALL EQUATIONS: Put formulas in $$formula$$ blocks
- SIMPLE SYNTAX: Use clean, basic LaTeX
- EXAMPLE: $$Forward Price = Spot Price + Repo Costs - Income$$

FORMATTING REQUIREMENTS:
- Start with document title as # header
- Use ## for chapter titles from the document
- **Bold key terms and concepts**
- Use bullet points and numbered lists
- Reference figures/tables mentioned
- NO CITATIONS OR SOURCE REFERENCES ANYWHERE`;

  if (category === 'small') {
    return `${basePrompt}

TARGET: Create a focused ${targetWords}-word study guide that captures the main points without over-elaboration.

APPROACH FOR SHORT DOCUMENTS:
- Focus on KEY CONCEPTS and main takeaways
- Provide CONCISE explanations (100-200 words per major point)
- Include essential terms and core examples
- Avoid unnecessary elaboration - be precise and focused
- Cover each slide/section with appropriate brevity

CRITICAL: This is a SHORT document - don't over-expand. Focus on main ideas, key concepts, and essential information. Be thorough but concise.

Begin with the document title and cover the content efficiently.`;
  } else if (category === 'medium') {
    return `${basePrompt}

TARGET: Create a comprehensive ${targetWords}-word study guide with balanced detail.

APPROACH FOR MEDIUM DOCUMENTS:
- Provide DETAILED explanations of concepts (300-500 words per major section)
- Include comprehensive terms and multiple examples
- Connect concepts across sections
- Balance thoroughness with efficiency

Begin with the document title and provide detailed coverage of each section.`;
  } else {
    return `${basePrompt}

TARGET: Create an exhaustive ${targetWords}-word study guide with comprehensive coverage.

APPROACH FOR LARGE DOCUMENTS:
- Provide EXHAUSTIVE explanations (800-1500 words per major section)
- Include all terminology, examples, and derivations
- Deep academic-level treatment
- Complete coverage of all concepts

Begin with the document title and provide comprehensive coverage of all content.`;
  }
}

async function createFileWithExtension(fileBuffer: Buffer, originalName: string, blobUrl: string): Promise<OpenAI.FileObject> {
  const extension = getFileExtensionFromUrl(blobUrl);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const fileName = `summary_document_${timestamp}.${extension}`;
  
  console.log(`📋 Creating OpenAI file: ${fileName} (${fileBuffer.length} bytes)`);
  
  const file = new File([fileBuffer], fileName, {
    type: extension === 'pdf' ? 'application/pdf' : 
          extension === 'docx' ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' :
          extension === 'pptx' ? 'application/vnd.openxmlformats-officedocument.presentationml.presentation' :
          extension === 'csv' ? 'text/csv' :
          'application/octet-stream'
  });

  return await openai.files.create({
    file: file,
    purpose: 'assistants'
  });
}

export async function POST(request: NextRequest) {
  try {
    // Check for required environment variables - use the SAME assistant as quiz
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
      console.log('✅ OpenAI Assistant validated successfully for summary');
    } catch (assistantError) {
      console.error('❌ OpenAI Assistant validation failed:', assistantError);
      return NextResponse.json({ 
        error: `OpenAI Assistant not found. Please check your OPENAI_ASSISTANT_ID environment variable.` 
      }, { status: 500 });
    }

    const { fileUrl, fileName, transcriptText, videoTitle, sourceType } = await request.json();
    
    // Validate input based on source type
    if (sourceType === 'youtube') {
      if (!transcriptText) {
        return NextResponse.json({ error: 'Transcript text is required for YouTube videos' }, { status: 400 });
      }
    } else {
    if (!fileUrl) {
      return NextResponse.json({ error: 'File URL is required' }, { status: 400 });
      }
    }

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        const sendText = (text: string) => {
          controller.enqueue(encoder.encode(text));
        };

        try {
          let documentCategory: 'small' | 'medium' | 'large';
          let targetWordCount: number;
          let maxContinuations: number;
          let promptType: string;
          let fileUpload: any = null;
          let thread: any;

          if (sourceType === 'youtube') {
            console.log('📺 Generate Summary - Processing YouTube transcript:', videoTitle);
            
            // Determine approach based on transcript length
            const transcriptWordCount = transcriptText.split(/\s+/).length;
            console.log(`📊 Transcript word count: ${transcriptWordCount} words`);
            
            if (transcriptWordCount < 1000) {
              documentCategory = 'small';
              // Aim for roughly 40% of transcript length but at least 300 words
              targetWordCount = Math.max(Math.round(transcriptWordCount * 0.4), 300);
              maxContinuations = 1;
              promptType = 'concise';
            } else if (transcriptWordCount < 5000) {
              documentCategory = 'medium';
              targetWordCount = Math.round(transcriptWordCount * 0.4); // ~40 % of transcript words
              maxContinuations = 4;
              promptType = 'balanced';
            } else {
              documentCategory = 'large';
              targetWordCount = Math.round(transcriptWordCount * 0.35); // slightly smaller ratio for very long
              maxContinuations = 10;
              promptType = 'comprehensive';
            }

            // Hard caps
            targetWordCount = Math.min(targetWordCount, 12000);

            
            sendText(`📺 Processing ${documentCategory} YouTube video (${transcriptWordCount} words)...\n\n`);

            // Create thread with transcript text directly
            const fidelityRules = `STRICT FIDELITY RULES:\n- ONLY use information present in the transcript.\n- DO NOT add outside knowledge, historical background, or speculative context.\n- If a detail is not explicitly in the transcript, OMIT it.\n- Maintain the conversational tone where appropriate.`;

            const youtubePrompt = `${getPromptForDocumentType(documentCategory, promptType, targetWordCount)}\n\n${fidelityRules}\n\nVIDEO TRANSCRIPT:\n"""\n${transcriptText}\n"""\n\nGenerate the study guide now.`;

            thread = await openai.beta.threads.create({
              messages: [{
                role: 'user',
                content: youtubePrompt
              }]
            });
          } else {
          console.log('📄 Generate Summary - Processing file:', fileName);

          // Get file information to determine generation approach
          const fileResponse = await fetch(fileUrl);
          const fileSize = parseInt(fileResponse.headers.get('content-length') || '0');
          const fileSizeKB = Math.round(fileSize / 1024);
          
          console.log(`📊 File size: ${fileSizeKB}KB`);
          
          if (fileSizeKB < 200) {
            // Small documents (< 200KB) - likely short presentations, brief docs
            documentCategory = 'small';
            targetWordCount = 2000;
            maxContinuations = 3;
            promptType = 'concise';
          } else if (fileSizeKB < 2000) {
            // Medium documents (200KB - 2MB) - moderate documents, longer presentations
            documentCategory = 'medium';
            targetWordCount = 8000;
            maxContinuations = 8;
            promptType = 'balanced';
          } else {
            // Large documents (> 2MB) - extensive documents, books, large reports
            documentCategory = 'large';
            targetWordCount = 20000;
            maxContinuations = 25;
            promptType = 'comprehensive';
          }
          
          console.log(`📋 Document category: ${documentCategory}, Target words: ${targetWordCount}, Max continuations: ${maxContinuations}`);

          sendText(`📄 Processing ${documentCategory} document (${fileSizeKB}KB)...\n\n`);

                  // Upload file to OpenAI
        const fileBuffer = Buffer.from(await fileResponse.arrayBuffer());
            fileUpload = await createFileWithExtension(fileBuffer, fileName, fileUrl);
        console.log(`📋 File uploaded: ${fileUpload.id}`);

          // Create thread with appropriate message based on document size
            thread = await openai.beta.threads.create({
            messages: [{
              role: 'user',
              content: getPromptForDocumentType(documentCategory, promptType, targetWordCount),
              attachments: [{ file_id: fileUpload.id, tools: [{ type: 'file_search' }] }]
            }]
          });
          }

          // Generation loop with adaptive thresholds
          let runningWordCount = 0;
          let continuationCount = 0;
          let fullStudyGuide = '';

          while (continuationCount <= maxContinuations) {
            // Create initial run or continuation run
            let run;
                          if (continuationCount === 0) {
                run = openai.beta.threads.runs.stream(thread.id, {
                  assistant_id: process.env.OPENAI_ASSISTANT_ID!,
                  max_completion_tokens: 16000 // Maximum tokens for very detailed content
                });
            } else {
              // Continuation runs - different approach for YouTube vs files
              if (sourceType === 'youtube') {
                await openai.beta.threads.messages.create(thread.id, {
                  role: 'user',
                  content: `Continue with the NEXT major section from the YouTube video transcript in appropriate detail.

CRITICAL FORMAT REMINDER:
- PURE MARKDOWN ONLY - NO JSON STRUCTURES
- NO SOURCES, CITATIONS, OR REFERENCES OF ANY KIND
- DO NOT include any source attributions, footnotes, or citations
- Continue with content appropriate to video length (don't over-elaborate for short videos)
- Use clear section titles as ## or ### headings
- AVOID repeating information already covered
- Extract key concepts, examples, and details from the next part of the transcript
- Use focused explanations suitable for video scope

LATEX FORMATTING REQUIREMENTS:
- SIMPLE EQUATIONS: $$Forward Price = Spot Price + Repo Costs - Income$$
- CLEAN VARIABLES: $SAP$ not \(SAP\) for variable names
- NO NESTED TEXT: Never use \text{\text{...}}
- BASIC OPERATORS: Use simple + - = operators
- Put ALL mathematical expressions inside $$...$$ blocks

Continue analyzing the next section of the video transcript now, maintaining appropriate detail level for the video length.`
                });
              } else {
                // File-based continuation - re-attach document and give continuation instructions
              await openai.beta.threads.messages.create(thread.id, {
                role: 'user',
                content: `Continue with the NEXT major section in appropriate detail for this document length.

CRITICAL FORMAT REMINDER:
- PURE MARKDOWN ONLY - NO JSON STRUCTURES
- NO SOURCES, CITATIONS, OR REFERENCES OF ANY KIND
- DO NOT include any source attributions, footnotes, or citations
- Continue with content appropriate to document size (don't over-elaborate for short docs)
- Use the EXACT chapter/section title from the document as ## or ### heading
- PRESERVE the original document's structure and organization
- AVOID repeating information already covered
- Extract key concepts, examples, and details from that section
- Use focused explanations suitable for document scope

LATEX FORMATTING REQUIREMENTS:
- SIMPLE EQUATIONS: $$Forward Price = Spot Price + Repo Costs - Income$$
- CLEAN VARIABLES: $SAP$ not \(SAP\) for variable names
- NO NESTED TEXT: Never use \text{\text{...}}
- BASIC OPERATORS: Use simple + - = operators
- Put ALL mathematical expressions inside $$...$$ blocks

DOCUMENT ACCESS: The document remains attached - use it as your ONLY source.

Resume with the next major section now, using its EXACT title from the document and maintaining appropriate detail level for the document size.`,
                attachments: [{ file_id: fileUpload.id, tools: [{ type: 'file_search' }] }]
              });
              }

                              run = openai.beta.threads.runs.stream(thread.id, {
                  assistant_id: process.env.OPENAI_ASSISTANT_ID!,
                  max_completion_tokens: 16000 // Maximum tokens for very detailed content
                });
            }

            let partContent = '';
            let foundContinue = false;

            // Stream the response for this part
            for await (const delta of run) {
              if (delta.event === 'thread.message.delta' && delta.data.delta.content) {
                for (const content of delta.data.delta.content) {
                  if (content.type === 'text' && content.text?.value) {
                    const text = content.text.value;
                    partContent += text;
                    sendText(text);

                    // Check for continuation marker
                    if (text.includes('<<CONTINUE TO NEXT SECTION>>') || text.includes('<<CONTINUE>>')) {
                      foundContinue = true;
                    }
                  }
                }
              }
            }

            // Remove the continuation marker from the output
            if (foundContinue) {
              partContent = partContent.replace(/<<CONTINUE TO NEXT SECTION>>/g, '');
              partContent = partContent.replace(/<<CONTINUE>>/g, '');
            }

            // Add this part to the complete summary
            fullStudyGuide += partContent + '\n\n';
            
            // Count words in this part
            const partWordCount = partContent.split(/\s+/).filter(word => word.length > 0).length;
            runningWordCount += partWordCount;

            // Determine if we should continue based on document category
            const outputIsShort = runningWordCount < targetWordCount;
            const shouldContinue = foundContinue || (outputIsShort && partWordCount > 200);

            if (shouldContinue && continuationCount < maxContinuations) {
              continuationCount++;
              await new Promise(resolve => setTimeout(resolve, 3000)); // Longer delay for stability
            } else {
              break;
            }
          }

          // Clean up (only if we uploaded a file)
          if (fileUpload) {
          try {
            await openai.files.del(fileUpload.id);
            console.log(`🗑️ Cleaned up file: ${fileUpload.id}`);
          } catch (cleanupError) {
            console.error('Failed to cleanup file:', cleanupError);
            }
          }

          controller.close();
        } catch (error) {
          console.error('Summary generation error:', error);
          sendText(`\n❌ Error generating study guide: ${error instanceof Error ? error.message : 'Unknown error'}\n`);
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
      },
    });

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Failed to generate summary' },
      { status: 500 }
    );
  }
} 