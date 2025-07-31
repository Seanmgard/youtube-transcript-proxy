import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Simple document section structure
interface DocumentSection {
  id: string;
  title: string;
  content: string;
  level: number; // 1 = chapter, 2 = section, 3 = subsection
  pageNumber?: number;
}

interface ParsedDocument {
  title: string;
  sections: DocumentSection[];
  totalPages: number;
  wordCount: number;
}

// Extract file extension from URL
function getFileExtension(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    return pathname.split('.').pop()?.toLowerCase() || 'pdf';
  } catch {
    return 'pdf';
  }
}

// Parse document using OpenAI vision/file capabilities
async function parseDocument(fileBuffer: Buffer, fileName: string): Promise<ParsedDocument> {
  console.log(`📄 Parsing document: ${fileName}`);
  
  try {
    // Upload file to OpenAI for processing
    const file = new File([fileBuffer], fileName, { type: 'application/pdf' });
    const fileUpload = await openai.files.create({
      file: file,
      purpose: 'assistants'
    });

    // Create assistant for document parsing
    const assistant = await openai.beta.assistants.create({
      name: "Document Parser",
      instructions: `Extract ALL content from this document in chronological order. Preserve the exact structure including:

- Document title
- All chapters, sections, and subsections with their exact titles
- All body text, maintaining paragraph structure
- All tables (convert to markdown format)
- Descriptions of any images or figures
- All formulas and equations
- Page numbers where possible

Output should be organized chronologically as it appears in the document. Mark section levels clearly:
- # for main chapters/parts
- ## for major sections
- ### for subsections

Include ALL content - do not summarize or skip anything during extraction.`,
      model: "gpt-4o",
      tools: [{ type: "file_search" }],
      temperature: 0
    });

    // Create thread and extract content
    const thread = await openai.beta.threads.create({
      messages: [{
        role: 'user',
        content: `Please extract ALL content from this document in chronological order. Preserve the exact structure and include everything - chapters, sections, text, tables, figures. Do not summarize during extraction, just extract all content as-is.`,
        attachments: [{ file_id: fileUpload.id, tools: [{ type: 'file_search' }] }]
      }]
    });

    // Run extraction
    const run = await openai.beta.threads.runs.create(thread.id, {
      assistant_id: assistant.id,
      max_completion_tokens: 32000
    });

    // Wait for completion
    let runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
    while (runStatus.status === 'in_progress' || runStatus.status === 'queued') {
      await new Promise(resolve => setTimeout(resolve, 1000));
      runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
    }

    if (runStatus.status !== 'completed') {
      throw new Error(`Document parsing failed with status: ${runStatus.status}`);
    }

    // Get extracted content
    const messages = await openai.beta.threads.messages.list(thread.id);
    const assistantMessage = messages.data.find(msg => msg.role === 'assistant');
    
    if (!assistantMessage || assistantMessage.content[0].type !== 'text') {
      throw new Error('Failed to extract document content');
    }

    const extractedContent = assistantMessage.content[0].text.value;

    // Clean up OpenAI resources
    await Promise.all([
      openai.files.del(fileUpload.id),
      openai.beta.assistants.del(assistant.id)
    ]);

    // Parse the extracted content into structured sections
    const parsedDocument = parseExtractedContent(extractedContent, fileName);
    
    console.log(`✅ Parsed document: ${parsedDocument.sections.length} sections, ${parsedDocument.wordCount} words`);
    return parsedDocument;

  } catch (error) {
    console.error('Document parsing error:', error);
    throw new Error(`Failed to parse document: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Parse extracted content into structured sections
function parseExtractedContent(content: string, fileName: string): ParsedDocument {
  const lines = content.split('\n');
  const sections: DocumentSection[] = [];
  let currentSection: DocumentSection | null = null;
  let sectionCounter = 0;
  let currentContent = '';
  let documentTitle = fileName.replace(/\.[^/.]+$/, '');

  // First pass - extract document title
  for (let i = 0; i < Math.min(20, lines.length); i++) {
    const trimmedLine = lines[i].trim();
    if (trimmedLine.length > 5 && trimmedLine.length < 100 && 
        !trimmedLine.match(/^(Chapter|Section|Part)\s+\d+/i) && 
        !trimmedLine.startsWith('#') &&
        !trimmedLine.includes('.pdf') &&
        trimmedLine.match(/^[A-Z]/) &&
        !trimmedLine.includes('|')) {
      documentTitle = trimmedLine;
      break;
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();

    // Enhanced chapter/section detection
    let isHeader = false;
    let headerLevel = 2;
    let headerTitle = '';

    // Priority 1: Clear chapter markers
    const chapterMatch = trimmedLine.match(/^(Chapter|CHAPTER)\s+(\d+)[\.:]\s*(.*)$/i);
    if (chapterMatch) {
      isHeader = true;
      headerLevel = 1; // Main chapter
      headerTitle = chapterMatch[3] ? `Chapter ${chapterMatch[2]}: ${chapterMatch[3]}` : `Chapter ${chapterMatch[2]}`;
    }

    // Priority 2: Part/Section markers  
    const partMatch = trimmedLine.match(/^(Part|PART|Section|SECTION)\s+(\d+)[\.:]\s*(.*)$/i);
    if (!isHeader && partMatch) {
      isHeader = true;
      headerLevel = 1; // Main section
      headerTitle = partMatch[3] ? `${partMatch[1]} ${partMatch[2]}: ${partMatch[3]}` : `${partMatch[1]} ${partMatch[2]}`;
    }

    // Priority 3: Markdown headers
    const markdownMatch = trimmedLine.match(/^(#{1,3})\s+(.+)$/);
    if (!isHeader && markdownMatch) {
      isHeader = true;
      headerLevel = markdownMatch[1].length;
      headerTitle = markdownMatch[2];
    }

    // Priority 4: Numbered sections (but be more selective)
    const numberedMatch = trimmedLine.match(/^(\d+\.)\s+([A-Z][^.]*[^.])$/);
    if (!isHeader && numberedMatch && numberedMatch[2].length > 10 && numberedMatch[2].length < 80) {
      isHeader = true;
      headerLevel = 2; // Subsection
      headerTitle = numberedMatch[2];
    }

    // Priority 5: All caps headers (likely main sections)
    if (!isHeader && trimmedLine.length > 5 && trimmedLine.length < 60 && 
        trimmedLine === trimmedLine.toUpperCase() &&
        trimmedLine.match(/^[A-Z\s]+$/) &&
        currentContent.length > 300) {
      isHeader = true;
      headerLevel = 1; // Treat as main section
      headerTitle = trimmedLine.charAt(0) + trimmedLine.slice(1).toLowerCase();
    }

    if (isHeader) {
      // Save previous section if it exists and has substantial content
      if (currentSection && currentContent.trim().length > 100) {
        currentSection.content = currentContent.trim();
        sections.push(currentSection);
      }

      // Create new section
      currentSection = {
        id: `section_${sectionCounter++}`,
        title: headerTitle,
        content: '',
        level: headerLevel,
        pageNumber: Math.floor(sectionCounter / 2) + 1
      };
      currentContent = '';
    } else {
      // Skip very short lines that are likely artifacts
      if (trimmedLine.length > 2) {
        currentContent += line + '\n';
      }
    }
  }

  // Add final section
  if (currentSection && currentContent.trim().length > 100) {
    currentSection.content = currentContent.trim();
    sections.push(currentSection);
  }

  // If we have very few sections, the detection might have failed
  // Create a single comprehensive section
  if (sections.length < 2) {
    sections.length = 0; // Clear any partial sections
    sections.push({
      id: 'full_document',
      title: 'Complete Document Content',
      content: content,
      level: 1,
      pageNumber: 1
    });
  }

  console.log(`📊 Detected structure: ${sections.filter(s => s.level === 1).length} main chapters/sections, ${sections.length} total sections`);

  const totalWords = sections.reduce((sum, section) => 
    sum + section.content.split(/\s+/).length, 0);

  return {
    title: documentTitle,
    sections: sections,
    totalPages: Math.ceil(totalWords / 300),
    wordCount: totalWords
  };
}

// Generate comprehensive study guide section by section
async function generateStudyGuide(
  document: ParsedDocument, 
  sendText: (text: string) => void
): Promise<void> {
  
  console.log(`📚 Generating study guide for: ${document.title}`);
  console.log(`📊 Document structure: ${document.sections.filter(s => s.level === 1).length} main sections, ${document.sections.length} total sections`);

  // Send document title
  sendText(`# ${document.title}\n\n`);

  // Group sections by main chapters/parts
  const mainSections = document.sections.filter(section => section.level === 1);
  const subSections = document.sections.filter(section => section.level > 1);

  // If we have clear main sections (like chapters), process them with their subsections
  if (mainSections.length > 1) {
    sendText(`*This study guide covers ${mainSections.length} main sections with comprehensive detail for exam preparation.*\n\n`);

    for (let i = 0; i < mainSections.length; i++) {
      const mainSection = mainSections[i];
      
      // Find subsections that belong to this main section
      const relatedSubSections = subSections.filter(sub => {
        const subIndex = document.sections.indexOf(sub);
        const mainIndex = document.sections.indexOf(mainSection);
        const nextMainIndex = i < mainSections.length - 1 ? 
          document.sections.indexOf(mainSections[i + 1]) : document.sections.length;
        
        return subIndex > mainIndex && subIndex < nextMainIndex;
      });

      // Combine main section content with subsections
      const fullSectionContent = [
        mainSection.content,
        ...relatedSubSections.map(sub => `\n\n### ${sub.title}\n\n${sub.content}`)
      ].join('\n');

      // Generate comprehensive summary for this complete section
      sendText(`## ${mainSection.title}\n\n`);
      
      const summary = await generateComprehensiveSectionSummary(
        mainSection.title,
        fullSectionContent,
        document.title,
        i + 1,
        mainSections.length
      );

      sendText(summary);
      sendText('\n\n');

      // Brief pause to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  } else {
    // Process all sections sequentially if no clear main structure
    sendText(`*This study guide provides comprehensive coverage of all key concepts and details.*\n\n`);

    for (let i = 0; i < document.sections.length; i++) {
      const section = document.sections[i];
      
      sendText(`## ${section.title}\n\n`);
      
      const summary = await generateComprehensiveSectionSummary(
        section.title,
        section.content,
        document.title,
        i + 1,
        document.sections.length
      );

      sendText(summary);
      sendText('\n\n');

      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }

  sendText(`---\n\n**Study Guide Complete**: This comprehensive guide covers all essential concepts, terms, data, and examples needed for exam success.\n`);
}

// Generate detailed summary for a section without artificial subsections
async function generateComprehensiveSectionSummary(
  sectionTitle: string,
  sectionContent: string,
  documentTitle: string,
  currentSectionNum: number,
  totalSections: number
): Promise<string> {

  const prompt = `You are creating an EXTREMELY comprehensive study guide section for exam mastery.

DOCUMENT: ${documentTitle}
SECTION: ${sectionTitle} (${currentSectionNum} of ${totalSections})

CONTENT TO ANALYZE:
${sectionContent}

CRITICAL STUDY GUIDE REQUIREMENTS:

🎯 **COMPREHENSIVE COVERAGE**: Extract and present EVERY piece of information including:
- All key terms, concepts, definitions, and technical vocabulary
- All numerical data, statistics, percentages, dates, names, and facts  
- All formulas, equations, and mathematical expressions
- All tables, charts, figures, and visual elements
- All processes, methodologies, procedures, and step-by-step instructions
- All examples, case studies, and illustrations
- All cause-and-effect relationships and connections

📝 **PROFESSIONAL FORMATTING REQUIREMENTS** (CRITICAL):

**Section Organization**: Start each major concept with a clear paragraph introduction, then use structured bullet points:

**Main Concept Title** (as a paragraph heading)
Brief overview paragraph explaining the concept and its significance.

- **Key Sub-concept**: Definition and primary explanation
  - Supporting detail with specific data or examples
  - Additional context or clarification
- **Related Sub-concept**: Connected information
  - Supporting detail
  - Specific example or data point

**Next Main Concept Title** (as a paragraph heading)
Brief overview paragraph explaining this concept.

- **Key Sub-concept**: Definition and explanation
  - Supporting detail
  - Specific example

**Key Terms**: Use **bold** for EVERY important term, concept, definition, or technical word when first mentioned

**Formulas**: Present ALL mathematical content as: $$formula$$ with explanation

**Tables**: Convert ALL tables to perfect markdown format:
| Column 1 | Column 2 | Column 3 |
|----------|----------|----------|
| Data     | Data     | Data     |

**Sequential Information**: Use numbered lists ONLY for:
1. Step-by-step processes
2. Chronological events  
3. Ordered procedures

🚫 **WHAT NOT TO DO**:
- Do NOT say "this section explains" or "the chapter discusses"
- Do NOT use meta-commentary about the content
- Do NOT summarize - present the actual information directly
- Do NOT skip any details, no matter how minor
- Do NOT attach section headings to bullet points
- Do NOT create flat bullet lists - use proper hierarchy with paragraphs

✅ **WHAT TO DO**:
- Present information directly as study material
- Write as if teaching the concepts directly
- Include every single detail that could appear on an exam
- Use paragraph introductions for major concepts
- Use proper hierarchical bullet structure with clear indentation
- Make every key term bold and define it immediately
- Keep main points concise but comprehensive
- Use sub-bullets for supporting details and examples
- Separate major concepts with clear paragraph breaks

📊 **CONTENT DEPTH**: 
- Provide 600-1000 words of substantive, detailed content
- Include every definition, formula, table, and data point
- Cover all processes and methodologies step-by-step
- Describe all visual elements (charts, graphs, diagrams) in detail
- Present information students need for 100% exam success

EXAMPLE FORMAT:
**Stablecoins** represent digital currencies designed to maintain stable value relative to traditional assets.

**Reference Currency**
Stablecoins are pegged to specific reference currencies to maintain price stability.

- **U.S. Dollar**: Most commonly used reference currency
  - Provides stability against traditional financial markets
  - Widely accepted for global transactions
- **Other Currencies**: Euro, yen, and other major currencies
  - Used for regional market access
  - Provides diversification options

**Market Growth**
The stablecoin market has experienced explosive growth in recent years.

- **Current Valuation**: $230-250 billion as of early 2025
  - Represents significant market presence
  - Continued growth trajectory expected
- **Growth Factors**: Integration into global financial systems
  - Increasing institutional adoption
  - Regulatory clarity in major markets

**Historical Context**
Stablecoins evolved from niche concept to cornerstone of cryptocurrency ecosystem.

- **Initial Development**: Early skepticism due to volatility concerns
  - Gradual acceptance as reliable medium of exchange
  - Recognition as store of value
- **Modern Role**: Central to DeFi and traditional finance integration
  - Bridge between crypto and traditional markets
  - Essential for institutional adoption

Present ALL content in this professional, hierarchical format with clear section breaks and proper organization.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an expert study guide creator. Your role is to extract and present ALL information from source material in comprehensive detail for exam preparation.

CRITICAL INSTRUCTIONS:
- Present information directly, not commentary about the information
- Bold EVERY key term, concept, and important word
- Use paragraph introductions for major concepts before bullet points
- Use proper hierarchical bullet structure with clear indentation levels
- Include ALL formulas in $$formula$$ format
- Convert ALL tables to proper markdown
- Describe ALL visual elements in detail
- Cover every single detail that could appear on an exam
- Use numbered lists only for sequential processes
- Write 600-1000 words of substantive content per section
- Maintain clear hierarchy: paragraph intro → main bullets → sub-bullets → examples
- Separate major concepts with clear paragraph breaks
- Never attach section headings to bullet points

NEVER write "this chapter explains" or "the section covers" - instead present the actual information directly as study material.`
        },
        {
          role: "user", 
          content: prompt
        }
      ],
      max_tokens: 3000,
      temperature: 0.1
    });

    const rawContent = response.choices[0].message.content || '';
    
    // Post-process the content to improve formatting
    return postProcessStudyGuideContent(rawContent);

  } catch (error) {
    console.error('Error generating section summary:', error);
    return `**${sectionTitle}**\n\n${sectionContent.substring(0, 1500)}...\n\n*[Summary generation failed for this section]*`;
  }
}

// Post-process content to improve formatting and structure
function postProcessStudyGuideContent(content: string): string {
  let processed = content;
  
  // Fix bullet point hierarchy and indentation
  processed = fixBulletPointHierarchy(processed);
  
  // Clean up formula formatting
  processed = fixFormulaFormatting(processed);
  
  // Clean up table formatting
  processed = fixTableFormatting(processed);
  
  // Remove any remaining meta-commentary
  processed = removeMetaCommentary(processed);
  
  // Clean up whitespace and formatting
  processed = cleanUpFormatting(processed);
  
  // Fix section organization and paragraph breaks
  processed = fixSectionOrganization(processed);
  
  return processed;
}

// Fix section organization and paragraph breaks
function fixSectionOrganization(content: string): string {
  let processed = content;
  
  // Ensure major concepts have proper paragraph breaks
  processed = processed.replace(/\n\*\*([^*]+)\*\*\n/g, '\n\n**$1**\n\n');
  
  // Fix headings that are attached to bullet points
  processed = processed.replace(/([^.]*\.)\s*-\s*\*\*([^*]+)\*\*:/g, '$1\n\n**$2**\n\n');
  
  // Ensure proper spacing around bullet lists
  processed = processed.replace(/\n- /g, '\n\n- ');
  
  // Fix bullet points that start immediately after headers
  processed = processed.replace(/\*\*([^*]+)\*\*\n- /g, '**$1**\n\n- ');
  
  // Clean up multiple consecutive blank lines
  processed = processed.replace(/\n{4,}/g, '\n\n\n');
  
  return processed;
}

// Fix bullet point hierarchy and indentation
function fixBulletPointHierarchy(content: string): string {
  const lines = content.split('\n');
  const processedLines: string[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    
    // Skip empty lines
    if (!trimmed) {
      processedLines.push(line);
      continue;
    }
    
    // Check if this is a bullet point
    if (trimmed.startsWith('-') || trimmed.startsWith('*') || trimmed.startsWith('•')) {
      const bulletContent = trimmed.substring(1).trim();
      
      // Determine the appropriate indentation level based on content
      let indentLevel = 0;
      
      // Main concepts (bold terms that start with capital letters or are longer)
      if (bulletContent.match(/^\*\*[A-Z][^*]+\*\*:/) || 
          bulletContent.match(/^\*\*[A-Z][^*]+\*\*\s*$/) ||
          bulletContent.length > 60 && bulletContent.match(/^\*\*[^*]+\*\*/)) {
        indentLevel = 0; // Main bullet
      }
      // Sub-concepts (shorter, supporting details, or contain colons)
      else if (bulletContent.match(/^\*\*[a-z][^*]+\*\*:/) ||
               bulletContent.length < 60 ||
               bulletContent.includes(':')) {
        indentLevel = 2; // Sub-bullet
      }
      // Examples and specific details
      else if (bulletContent.length < 40 ||
               bulletContent.match(/^\d+\./) ||
               bulletContent.includes('example') ||
               bulletContent.includes('data') ||
               bulletContent.includes('formula') ||
               bulletContent.includes('specifically') ||
               bulletContent.includes('including')) {
        indentLevel = 4; // Sub-sub-bullet
      }
      // Very specific details and clarifications
      else if (bulletContent.length < 25 ||
               bulletContent.match(/^[a-z]/) ||
               bulletContent.includes('note') ||
               bulletContent.includes('clarification') ||
               bulletContent.includes('additionally') ||
               bulletContent.includes('furthermore')) {
        indentLevel = 6; // Sub-sub-sub-bullet
      }
      
      // Apply indentation
      const indent = '  '.repeat(indentLevel);
      processedLines.push(`${indent}- ${bulletContent}`);
    } else {
      // Non-bullet lines (paragraphs, headers, etc.)
      processedLines.push(line);
    }
  }
  
  return processedLines.join('\n');
}

// Fix formula formatting
function fixFormulaFormatting(content: string): string {
  // Ensure formulas are properly formatted with $$ and have explanations
  let processed = content;
  
  // Find and fix formulas that aren't properly formatted
  processed = processed.replace(/(\w+)\s*=\s*([^$\n]+)/g, (match, variable, formula) => {
    // If this looks like a mathematical formula, format it properly
    if (formula.includes('+') || formula.includes('-') || formula.includes('*') || 
        formula.includes('/') || formula.includes('^') || formula.includes('∑') ||
        formula.includes('∫') || formula.includes('√')) {
      return `**${variable}**: $${formula}$`;
    }
    return match;
  });
  
  // Ensure all formulas have proper spacing
  processed = processed.replace(/\$\$([^$]+)\$\$/g, '$$$1$$');
  
  return processed;
}

// Fix table formatting
function fixTableFormatting(content: string): string {
  const lines = content.split('\n');
  const processedLines: string[] = [];
  let i = 0;
  
  while (i < lines.length) {
    const line = lines[i];
    
    // Check if this looks like a table
    if (line.includes('|')) {
      const tableLines = [];
      let j = i;
      
      // Collect all consecutive lines that might be part of a table
      while (j < lines.length && (lines[j].includes('|') || lines[j].trim() === '')) {
        if (lines[j].includes('|')) {
          tableLines.push(lines[j]);
        } else if (lines[j].trim() === '' && tableLines.length > 0) {
          break;
        }
        j++;
      }
      
      if (tableLines.length >= 2) {
        // Format the table properly
        const formattedTable = formatTableLines(tableLines);
        processedLines.push(...formattedTable);
        i = j;
      } else {
        processedLines.push(line);
        i++;
      }
    } else {
      processedLines.push(line);
      i++;
    }
  }
  
  return processedLines.join('\n');
}

// Format table lines properly
function formatTableLines(tableLines: string[]): string[] {
  if (tableLines.length === 0) return [];
  
  // Parse all rows and find the maximum number of columns
  const rows: string[][] = [];
  let maxColumns = 0;
  
  for (const line of tableLines) {
    const cells = line.split('|')
      .map(cell => cell.trim())
      .filter(cell => cell !== '');
    
    if (cells.length > 0) {
      rows.push(cells);
      maxColumns = Math.max(maxColumns, cells.length);
    }
  }
  
  if (rows.length === 0) return [];
  
  // Ensure all rows have the same number of columns
  for (const row of rows) {
    while (row.length < maxColumns) {
      row.push('');
    }
  }
  
  // Format as proper markdown table
  const formattedRows: string[] = [];
  
  // Add header row
  const headerRow = '| ' + rows[0].join(' | ') + ' |';
  formattedRows.push(headerRow);
  
  // Add separator row
  const separatorRow = '| ' + Array(maxColumns).fill('------').join(' | ') + ' |';
  formattedRows.push(separatorRow);
  
  // Add data rows
  for (let i = 1; i < rows.length; i++) {
    const dataRow = '| ' + rows[i].join(' | ') + ' |';
    formattedRows.push(dataRow);
  }
  
  return ['', ...formattedRows, ''];
}

// Remove meta-commentary
function removeMetaCommentary(content: string): string {
  let processed = content;
  
  // Remove phrases that indicate meta-commentary
  const metaPhrases = [
    /this section explains/gi,
    /this chapter discusses/gi,
    /the document covers/gi,
    /this part describes/gi,
    /the text mentions/gi,
    /according to the/gi,
    /the chapter shows/gi,
    /this material presents/gi
  ];
  
  metaPhrases.forEach(phrase => {
    processed = processed.replace(phrase, '');
  });
  
  return processed;
}

// Clean up overall formatting
function cleanUpFormatting(content: string): string {
  let processed = content;
  
  // Remove excessive blank lines
  processed = processed.replace(/\n\s*\n\s*\n\s*\n/g, '\n\n\n');
  
  // Ensure proper spacing around headers
  processed = processed.replace(/\n(#{1,6}\s+[^\n]+)\n/g, '\n\n$1\n\n');
  
  // Fix double spaces
  processed = processed.replace(/\s{2,}/g, ' ');
  
  // Ensure proper spacing around bullet points
  processed = processed.replace(/\n(\s*-[^\n]+)\n/g, '\n$1\n');
  
  return processed.trim();
}

export async function POST(request: NextRequest) {
  try {
    // Check environment variables
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ 
        error: 'OpenAI API key not configured' 
      }, { status: 500 });
    }

    const { fileUrl, fileName } = await request.json();
    
    if (!fileUrl) {
      return NextResponse.json({ 
        error: 'File URL is required' 
      }, { status: 400 });
    }

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        const sendText = (text: string) => {
          controller.enqueue(encoder.encode(text));
        };

        try {
          console.log('📄 Starting study guide generation for:', fileName);

          // Download and parse document
          const fileResponse = await fetch(fileUrl);
          if (!fileResponse.ok) {
            throw new Error('Failed to download file');
          }

          const fileBuffer = Buffer.from(await fileResponse.arrayBuffer());
          const parsedDocument = await parseDocument(fileBuffer, fileName);
          
          // Generate comprehensive study guide
          await generateStudyGuide(parsedDocument, sendText);
          
          controller.close();
          
        } catch (error) {
          console.error('Study guide generation error:', error);
          sendText(`\n❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}\n`);
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
      { error: 'Failed to generate study guide' },
      { status: 500 }
    );
  }
} 