'use client';

import React, { useState, useEffect } from 'react';
import 'katex/dist/katex.min.css';
import { InlineMath, BlockMath } from 'react-katex';

interface SummaryRendererProps {
  content: string;
}

export default function SummaryRenderer({ content }: SummaryRendererProps) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Preprocess content to fix LaTeX formatting issues and make math look professional
  const preprocessLatex = (text: string): string => {
    let processed = text;
    
    // Remove any visible $$ signs that shouldn't be shown to users
    processed = processed.replace(/^\$\$\s*$/gm, '');
    processed = processed.replace(/\$\$\s*\n\s*\$\$/g, '');
    
    // AGGRESSIVE LATEX CLEANUP - Fix all malformed patterns
    
    // Fix variables with subscripts that are missing proper formatting
    processed = processed.replace(/\b([A-Z]+)([a-z]+)-(\d+)\b/g, '$1_{$2-$3}');
    processed = processed.replace(/\b([A-Z]+)([a-z])(\d+)\b/g, '$1_{$2$3}');
    processed = processed.replace(/\bCPIm-(\d+)\b/g, 'CPI_{m-$1}');
    processed = processed.replace(/\bRefCPI([^,\s]*),m\b/g, 'RefCPI_{$1,m}');
    
    // Remove ALL \text{} commands from equations and replace with plain text
    processed = processed.replace(/\$\$([^$]*)\$\$/g, (match, content) => {
      let cleanContent = content.trim();
      if (!cleanContent || cleanContent.length < 2) return '';
      
      // Remove ALL \text{} wrappers completely
      cleanContent = cleanContent.replace(/\\text\{([^}]+)\}/g, '$1');
      
      // Fix nested \text patterns
      while (cleanContent.includes('\\text{')) {
        cleanContent = cleanContent.replace(/\\text\{([^}]+)\}/g, '$1');
      }
      
      // Fix basic spacing and operators
      cleanContent = cleanContent.replace(/\s*\^\s*/g, '^');
      cleanContent = cleanContent.replace(/\s*_\s*/g, '_');
      cleanContent = cleanContent.replace(/\\\(/g, '(');
      cleanContent = cleanContent.replace(/\\\)/g, ')');
      cleanContent = cleanContent.replace(/\\?\{/g, '{');
      cleanContent = cleanContent.replace(/\\?\}/g, '}');
      
      // Add proper subscripts for common patterns
      cleanContent = cleanContent.replace(/([A-Z]+)([a-z]+)-(\d+)/g, '$1_{$2-$3}');
      cleanContent = cleanContent.replace(/([A-Z]+)([a-z])(\d+)/g, '$1_{$2$3}');
      cleanContent = cleanContent.replace(/CPI([^_\s]*)-(\d+)/g, 'CPI_{$1-$2}');
      cleanContent = cleanContent.replace(/RefCPI([^,\s]*),m/g, 'RefCPI_{$1,m}');
      
      // Fix subscripts and superscripts
      cleanContent = cleanContent.replace(/([A-Za-z]+)_([A-Za-z0-9\-,]+)/g, '$1_{$2}');
      cleanContent = cleanContent.replace(/([A-Za-z]+)\^([A-Za-z0-9\-,]+)/g, '$1^{$2}');
      
      // Use proper LaTeX symbols
      cleanContent = cleanContent.replace(/\s*[×\*]\s*/g, ' \\times ');
      cleanContent = cleanContent.replace(/\+\s*/g, ' + ');
      cleanContent = cleanContent.replace(/\s*-\s*/g, ' - ');
      cleanContent = cleanContent.replace(/\s*=\s*/g, ' = ');
      cleanContent = cleanContent.replace(/infinity/g, '\\infty');
      cleanContent = cleanContent.replace(/σ/g, '\\sigma');
      
      // Clean up multiple spaces
      cleanContent = cleanContent.replace(/\s+/g, ' ').trim();
      
      return `$$${cleanContent}$$`;
    });
    
    // Fix standalone equations that should be in display math
    processed = processed.replace(/^([a-zA-Z_][a-zA-Z0-9_]*\s*=\s*[^$\n]*\\sqrt\{[^}]*\}[^$\n]*)$/gm, '$$$$1$$');
    processed = processed.replace(/^([a-zA-Z_][a-zA-Z0-9_]*\s*=\s*[^$\n]*σ[^$\n]*)$/gm, '$$$$1$$');
    processed = processed.replace(/^([a-zA-Z_][a-zA-Z0-9_]*\s*=\s*[^$\n]*\\[a-zA-Z][^$\n]*)$/gm, '$$$$1$$');
    
    // Clean up escaped parentheses around variables
    processed = processed.replace(/•\s*\\?\\\(([^)]+)\\\)\s*is\s*/g, '• $$$1$$ is ');
    processed = processed.replace(/•\s*\\?\\\(([^)]+)\\\)\s*and\s*\\?\\\(([^)]+)\\\)\s*are\s*/g, '• $$$1$$ and $$$2$$ are ');
    processed = processed.replace(/\\\(([A-Za-z_][A-Za-z0-9_]*)\\\)/g, '$$$1$$');
    
    // Fix cases where formulas are missing
    processed = processed.replace(/(formula|equation|expression):\s*\n\s*\$\$\s*\n/gi, '$1:\n\n*[Formula content appears to be missing from source]*\n\n');
    
    // Fix malformed LaTeX expressions that are just numbers
    processed = processed.replace(/\$\$\s*(\d+)\s*\$\$/g, '**$1**');
    
    // Handle standalone mathematical expressions
    processed = processed.replace(/^([A-Za-z]\s*=\s*[^$\n]+(?:e\^|\\|∫|\*|σ)[^$\n]*)$/gm, '$$$$1$$');
    
    // Clean up any remaining escaped parentheses
    processed = processed.replace(/\\?\\\(([^)]+)\\\)/g, '$$$1$$');
    
    // Fix cases where LaTeX commands are outside dollar signs
    processed = processed.replace(/([^$])(\\frac\{[^}]+\}\{[^}]+\}|\\times|\\cdot|\\pm|\\geq|\\leq|\\neq|\\int|\\sum|\\alpha|\\beta|\\gamma|\\delta|\\epsilon|\\theta|\\lambda|\\mu|\\pi|\\sigma|\\tau|\\phi|\\chi|\\psi|\\omega|\\infty|\\sqrt)/g, '$1$$$2$$');
    
    // Final cleanup
    processed = processed.replace(/\$\$\$+/g, '$$');
    processed = processed.replace(/\$\$\s*\$\$/g, '');
    
    return processed;
  };

  const formatContent = (text: string) => {
    // First preprocess LaTeX formatting
    const processedText = preprocessLatex(text);
    
    // Additional preprocessing for headers and structure
    let headerProcessed = processedText;
    
    // AGGRESSIVE header cleanup - fix all malformed patterns
    // Remove any <> prefixes from headers
    headerProcessed = headerProcessed.replace(/^<>#+\s*/gm, '## ');
    headerProcessed = headerProcessed.replace(/^<>## /gm, '## ');
    headerProcessed = headerProcessed.replace(/^<># /gm, '# ');
    headerProcessed = headerProcessed.replace(/^<>([#]+\s*)/gm, '$1');
    
    // Clean up any line that starts with <> followed by hash
    headerProcessed = headerProcessed.replace(/^<>\s*(#+\s*.*)/gm, '$1');
    
    // Fix standard chapter formatting
    headerProcessed = headerProcessed.replace(/^##\s*Chapter\s*(\d+):\s*/gm, '## Chapter $1: ');
    headerProcessed = headerProcessed.replace(/^#\s*Chapter\s*(\d+):\s*/gm, '## Chapter $1: ');
    
    // Handle headers that might have extra characters or formatting
    headerProcessed = headerProcessed.replace(/^([^#\n]*)(#+\s*Chapter\s*\d+:.*)/gm, '$2');
    headerProcessed = headerProcessed.replace(/^([^#\n]*)(#+\s*[A-Z][^:\n]*:.*)/gm, '$2');
    
    // Clean up any stray HTML-like tags in headers
    headerProcessed = headerProcessed.replace(/^(<[^>]*>)*(#+\s*)/gm, '$2');
    headerProcessed = headerProcessed.replace(/^[<>]*\s*(#+\s*)/gm, '$1');
    
    // Final pass: any remaining <> at start of lines with headers
    headerProcessed = headerProcessed.replace(/^<>(.*)$/gm, '$1');
    
    // Filter out meta-commentary lines AND non-content sections
    const lines = headerProcessed.split('\n').filter(line => {
      const trimmed = line.trim().toLowerCase();
      return !(
        // Meta-commentary and AI artifacts
        trimmed.includes('thank you for your detailed instructions') ||
        trimmed.includes('i need to first determine') ||
        trimmed.includes('step 1:') ||
        trimmed.includes('starting document scan') ||
        trimmed.includes('let me first analyze') ||
        trimmed.includes('this is only a portion') ||
        trimmed.includes('for the full-length guide') ||
        trimmed.includes('if you need the rest') ||
        trimmed.includes('let me know, and i will proceed') ||
        trimmed.includes('i will begin this process') ||
        trimmed.includes('once this is done, i will begin') ||
        trimmed.includes('i understand you want') ||
        trimmed.includes('let me create') ||
        trimmed.includes('i will now create') ||
        trimmed.includes('here is the comprehensive') ||
        trimmed.includes('based on your instructions') ||
        // Potential hallucination indicators
        trimmed.includes('this document appears to be') ||
        trimmed.includes('while this document') ||
        trimmed.includes('it seems this document') ||
        trimmed.includes('from what i can see') ||
        trimmed.includes('based on the title') ||
        trimmed.includes('this appears to cover') ||
        trimmed.startsWith('note:') ||
        trimmed.startsWith('disclaimer:') ||
        trimmed.startsWith('important:') ||
        // Non-content sections
        trimmed.includes('bibliography') ||
        trimmed.includes('list of references') ||
        trimmed.includes('references') ||
        trimmed.includes('about the author') ||
        trimmed.includes('about the series editor') ||
        trimmed.includes('list of figures') ||
        trimmed.includes('list of tables') ||
        trimmed.includes('list of abbreviations') ||
        trimmed.includes('index') ||
        trimmed.includes('appendices') ||
        trimmed.includes('appendix') ||
        // Skip lines that are just citations or figure references
        /^figure \d+\.\d+:/.test(trimmed) ||
        /^table \d+:/.test(trimmed) ||
        /source: .+, .+ research\.?$/.test(trimmed) ||
        // Skip author bio sections
        (trimmed.includes('jessica james') && trimmed.includes('quantitative')) ||
        (trimmed.includes('michael leister') && trimmed.includes('expert')) ||
        (trimmed.includes('christoph rieger') && trimmed.includes('economist')) ||
        (trimmed.includes('moorad choudhry') && trimmed.includes('prominent')) ||
        // Remove visible dollar signs that shouldn't be shown
        trimmed === '$$' ||
        trimmed === '$' ||
        /^\$\$\s*$/.test(trimmed)
      );
    });

    // Also filter out entire sections that are non-content
    const filteredLines: string[] = [];
    let skipSection = false;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim().toLowerCase();
      
      // Check if we're entering a non-content section
      if (line.startsWith('## bibliography') || 
          line.startsWith('## references') ||
          line.startsWith('## about the author') ||
          line.startsWith('## about the series editor') ||
          line.startsWith('## list of figures') ||
          line.startsWith('## list of tables') ||
          line.startsWith('## list of abbreviations') ||
          line.startsWith('## index') ||
          line.startsWith('## appendices') ||
          line.startsWith('## appendix')) {
        skipSection = true;
        continue;
      }
      
      // Check if we're entering a new content section (reset skip)
      if (line.startsWith('## ') && !skipSection) {
        skipSection = false;
      } else if (line.startsWith('## ') && skipSection) {
        // This might be a new content section, check if it's actually content
        if (!line.includes('bibliography') && 
            !line.includes('references') &&
            !line.includes('about the author') &&
            !line.includes('index') &&
            !line.includes('appendix')) {
          skipSection = false;
        } else {
          continue;
        }
      }
      
      if (!skipSection) {
        filteredLines.push(lines[i]);
      }
    }
    
    const formattedElements: React.ReactNode[] = [];

    filteredLines.forEach((line, index) => {
      const trimmedLine = line.trim();
      
      // Skip empty lines
      if (!trimmedLine) {
        formattedElements.push(<div key={`empty-${index}`} className="h-2"></div>);
        return;
      }

      // Headers
      if (trimmedLine.startsWith('# ')) {
        const headerText = trimmedLine.substring(2);
        formattedElements.push(
          <h1 key={index} className="text-3xl font-bold text-gray-900 mt-8 mb-4 pb-3 border-b-2 border-blue-500">
            {formatInlineText(headerText)}
          </h1>
        );
      } else if (trimmedLine.startsWith('## ')) {
        const headerText = trimmedLine.substring(3);
        formattedElements.push(
          <h2 key={index} className="text-2xl font-bold text-gray-900 mt-6 mb-3 pb-2 border-b border-gray-300">
            {formatInlineText(headerText)}
          </h2>
        );
      } else if (trimmedLine.startsWith('### ')) {
        const headerText = trimmedLine.substring(4);
        formattedElements.push(
          <h3 key={index} className="text-xl font-bold text-gray-900 mt-5 mb-2">
            {formatInlineText(headerText)}
          </h3>
        );
      } else if (trimmedLine.startsWith('#### ')) {
        const headerText = trimmedLine.substring(5);
        formattedElements.push(
          <h4 key={index} className="text-lg font-semibold text-gray-900 mt-4 mb-2">
            {formatInlineText(headerText)}
          </h4>
        );
      }
      // Unordered lists (-, *, +)
      else if (/^[-*+]\s/.test(trimmedLine)) {
        const content = trimmedLine.substring(2);
        formattedElements.push(
          <ul key={index} className="ml-6 mb-3">
            <li className="text-gray-700 leading-relaxed mb-1 list-disc">
              {formatInlineText(content)}
            </li>
          </ul>
        );
      }
      // Numbered lists
      else if (/^\d+\.\s/.test(trimmedLine)) {
        const content = trimmedLine.replace(/^\d+\.\s/, '');
        formattedElements.push(
          <ol key={index} className="ml-6 mb-3">
            <li className="text-gray-700 leading-relaxed mb-1 list-decimal">
              {formatInlineText(content)}
            </li>
          </ol>
        );
      }
      // Blockquotes
      else if (trimmedLine.startsWith('> ')) {
        const content = trimmedLine.substring(2);
        formattedElements.push(
          <blockquote key={index} className="border-l-4 border-gray-400 pl-4 italic text-gray-600 my-4 bg-gray-50 py-2">
            {formatInlineText(content)}
          </blockquote>
        );
      }
      // Code blocks (```code```)
      else if (trimmedLine.startsWith('```') && trimmedLine.endsWith('```') && trimmedLine.length > 6) {
        const code = trimmedLine.slice(3, -3);
        formattedElements.push(
          <pre key={index} className="bg-gray-100 rounded-lg p-4 overflow-x-auto my-4">
            <code className="text-sm font-mono text-gray-800">{code}</code>
          </pre>
        );
      }
      // Tables (basic support for | delimited)
      else if (trimmedLine.includes('|') && trimmedLine.split('|').length > 2) {
        const cells = trimmedLine.split('|').map(cell => cell.trim()).filter(cell => cell);
        formattedElements.push(
          <div key={index} className="overflow-x-auto my-4">
            {cells.map((cell, cellIndex) => (
              <div key={cellIndex} className="inline-block border border-gray-300 px-3 py-2 bg-gray-50 text-sm">
                {formatInlineText(cell)}
              </div>
            ))}
          </div>
        );
      }
      // Special formatting for definitions (Term: Definition)
      else if (trimmedLine.includes(': ') && trimmedLine.startsWith('**') && trimmedLine.includes('**:')) {
        const [term, ...definitionParts] = trimmedLine.split(': ');
        const definition = definitionParts.join(': ');
        formattedElements.push(
          <div key={index} className="mb-3 p-3 bg-blue-50 rounded-lg border-l-4 border-blue-400">
            <div className="font-bold text-blue-900 mb-1">{formatInlineText(term.replace(/\*\*/g, ''))}</div>
            <div className="text-gray-700 leading-relaxed">{formatInlineText(definition)}</div>
          </div>
        );
      }
      // Regular paragraphs
      else {
        formattedElements.push(
          <p key={index} className="text-gray-700 leading-relaxed mb-4">
            {formatInlineText(trimmedLine)}
          </p>
        );
      }
    });

    return formattedElements;
  };

  const formatInlineText = (text: string): React.ReactNode => {
    // Split text by math expressions and process each part
    const parts: React.ReactNode[] = [];
    let currentIndex = 0;

    // First handle block math ($$...$$) - more permissive regex
    const blockMathRegex = /\$\$([^$]*?)\$\$/g;
    let match;
    
    // Reset regex
    blockMathRegex.lastIndex = 0;
    
    while ((match = blockMathRegex.exec(text)) !== null) {
      // Add text before the math
      if (match.index > currentIndex) {
        const beforeText = text.slice(currentIndex, match.index);
        parts.push(processTextWithInlineMath(beforeText, parts.length));
      }
      
      // Add the block math
      const mathContent = match[1].trim();
      if (mathContent && mathContent.length > 0) {
        try {
          // Clean up the math content before rendering
          let cleanMath = mathContent;
          
          // Remove any remaining escaping issues
          cleanMath = cleanMath.replace(/\\\(/g, '(').replace(/\\\)/g, ')');
          cleanMath = cleanMath.replace(/\\?\{/g, '{').replace(/\\?\}/g, '}');
          
          // Fix common issues
          cleanMath = cleanMath.replace(/\s*\^\s*/g, '^');
          cleanMath = cleanMath.replace(/\s*_\s*/g, '_');
          
          parts.push(
            <div key={`block-math-${parts.length}`} className="my-6 flex justify-center">
              <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                <BlockMath math={cleanMath} />
              </div>
            </div>
          );
        } catch (e) {
          console.warn('Invalid block LaTeX:', mathContent, e);
          // More subtle fallback that still looks professional
          parts.push(
            <div key={`block-math-fallback-${parts.length}`} className="my-4 text-center">
              <div className="bg-gray-50 p-3 rounded border border-gray-200 font-mono text-sm">
                {mathContent}
              </div>
            </div>
          );
        }
      }
      
      currentIndex = match.index + match[0].length;
    }
    
    // Add remaining text
    if (currentIndex < text.length) {
      const remainingText = text.slice(currentIndex);
      parts.push(processTextWithInlineMath(remainingText, parts.length));
    }

    return parts.length === 1 ? parts[0] : <>{parts}</>;
  };

  const processTextWithInlineMath = (text: string, keyPrefix: number): React.ReactNode => {
    const parts: React.ReactNode[] = [];
    let currentIndex = 0;

    // Handle inline math ($...$) - avoid matching $$ patterns
    const inlineMathRegex = /(?<!\$)\$([^$\n]+?)\$(?!\$)/g;
    let match;
    
    // Reset regex
    inlineMathRegex.lastIndex = 0;
    
    while ((match = inlineMathRegex.exec(text)) !== null) {
      // Add text before the math
      if (match.index > currentIndex) {
        const beforeText = text.slice(currentIndex, match.index);
        parts.push(processRegularText(beforeText, `${keyPrefix}-${parts.length}`));
      }
      
      // Add the inline math
      const mathContent = match[1].trim();
      if (mathContent) {
        try {
          parts.push(
            <InlineMath key={`inline-math-${keyPrefix}-${parts.length}`} math={mathContent} />
          );
        } catch (e) {
          console.warn('Invalid inline LaTeX:', mathContent, e);
          // Fallback if LaTeX is invalid
          parts.push(
            <code key={`inline-math-fallback-${keyPrefix}-${parts.length}`} className="bg-red-100 px-1 py-0.5 rounded text-sm">
              ${mathContent}$
            </code>
          );
        }
      }
      
      currentIndex = match.index + match[0].length;
    }
    
    // Add remaining text
    if (currentIndex < text.length) {
      const remainingText = text.slice(currentIndex);
      parts.push(processRegularText(remainingText, `${keyPrefix}-${parts.length}`));
    }

    return parts.length === 1 ? parts[0] : <>{parts}</>;
  };

  const processRegularText = (text: string, key: string): React.ReactNode => {
    // Handle bold text **text**
    let formatted = text.replace(/\*\*(.+?)\*\*/g, '<strong class="font-bold text-gray-900">$1</strong>');
    
    // Handle italic text *text*
    formatted = formatted.replace(/(?<!\*)\*([^*]+?)\*(?!\*)/g, '<em class="italic text-gray-800">$1</em>');
    
    // Handle inline code `code`
    formatted = formatted.replace(/`(.+?)`/g, '<code class="bg-gray-100 px-2 py-1 rounded text-sm font-mono text-gray-800">$1</code>');
    
    // Return as JSX
    return <span key={key} dangerouslySetInnerHTML={{ __html: formatted }} />;
  };

  // Prevent hydration issues by only rendering on client
  if (!isClient) {
    return (
      <div className="prose prose-lg max-w-none">
        <div className="space-y-1">
          <div className="animate-pulse">Loading study guide...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="prose prose-lg max-w-none">
      <div className="space-y-1">
        {formatContent(content)}
      </div>
    </div>
  );
}