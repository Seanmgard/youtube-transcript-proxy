'use client';

import React from 'react';

interface SummaryRendererProps {
  content: string;
}

export default function SummaryRenderer({ content }: SummaryRendererProps) {
  // Process the content to improve formatting
  const processedContent = processContent(content);

  return (
    <div className="prose prose-lg max-w-none">
      <div 
        className="study-guide-content"
        dangerouslySetInnerHTML={{ __html: processedContent }}
      />
    </div>
  );
}

// Process content to improve formatting
function processContent(content: string): string {
  let processed = content;

  // Convert markdown to HTML with enhanced formatting
  processed = convertMarkdownToHTML(processed);
  
  // Add custom CSS classes for better styling
  processed = addCustomStyling(processed);
    
    return processed;
}

// Convert markdown to HTML with enhanced formatting
function convertMarkdownToHTML(content: string): string {
  let html = content;

  // Headers
  html = html.replace(/^### (.*$)/gim, '<h3 class="text-xl font-bold text-gray-900 mt-6 mb-3">$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2 class="text-2xl font-bold text-gray-900 mt-8 mb-4">$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1 class="text-3xl font-bold text-gray-900 mt-10 mb-6">$1</h1>');

  // Bold text
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-gray-900">$1</strong>');

  // Italic text
  html = html.replace(/\*(.*?)\*/g, '<em class="italic">$1</em>');

  // Formulas (LaTeX)
  html = html.replace(/\$\$(.*?)\$\$/g, '<span class="font-mono bg-gray-100 px-2 py-1 rounded text-sm">$$$1$$</span>');

  // Tables
  html = html.replace(/\|(.+)\|/g, (match) => {
    const cells = match.split('|').map(cell => cell.trim()).filter(cell => cell);
    if (cells.length > 1) {
      const cellHtml = cells.map(cell => `<td class="border border-gray-300 px-3 py-2">${cell}</td>`).join('');
      return `<tr>${cellHtml}</tr>`;
    }
    return match;
  });

  // Convert table rows to proper table structure
  const tableRegex = /(<tr>.*?<\/tr>)+/g;
  html = html.replace(tableRegex, (match) => {
    const rows = match.match(/<tr>.*?<\/tr>/g) || [];
    if (rows.length > 2) { // At least header + separator + data
      return `<table class="border-collapse border border-gray-300 my-4 w-full">${rows.join('')}</table>`;
    }
    return match;
  });

  // Bullet points with enhanced hierarchy
  html = processBulletPoints(html);

      // Numbered lists
  html = html.replace(/^(\d+)\.\s+(.*$)/gim, '<li class="list-decimal list-inside mb-1">$2</li>');
  
  // Wrap numbered lists in ol
  html = html.replace(/(<li class="list-decimal.*?<\/li>)+/g, (match) => {
    return `<ol class="list-decimal list-inside ml-4 mb-4">${match}</ol>`;
  });

  // Paragraphs
  html = html.replace(/^(?!<[a-z])(.*$)/gim, '<p class="mb-3 leading-relaxed">$1</p>');

  // Clean up empty paragraphs
  html = html.replace(/<p class="mb-3 leading-relaxed"><\/p>/g, '');

  return html;
}

// Process bullet points with proper hierarchy
function processBulletPoints(content: string): string {
  const lines = content.split('\n');
  const processedLines: string[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    
    if (trimmed.startsWith('-')) {
      const bulletContent = trimmed.substring(1).trim();
      
      // Determine indentation level
      const originalIndent = line.length - line.trimStart().length;
      const indentLevel = Math.floor(originalIndent / 2);
      
      // Create appropriate CSS classes based on hierarchy
      let cssClass = 'list-disc list-inside mb-1';
      let containerClass = 'ml-4 mb-3';
      
      if (indentLevel === 1) {
        cssClass = 'list-disc list-inside mb-1 text-gray-700';
        containerClass = 'ml-6 mb-2';
      } else if (indentLevel === 2) {
        cssClass = 'list-disc list-inside mb-1 text-gray-600 text-sm';
        containerClass = 'ml-8 mb-1';
      } else if (indentLevel >= 3) {
        cssClass = 'list-disc list-inside mb-1 text-gray-500 text-sm';
        containerClass = 'ml-10 mb-1';
      }
      
      // Convert the bullet point to HTML
      const bulletHtml = `<li class="${cssClass}">${bulletContent}</li>`;
      
      // Check if this is part of a list or starts a new one
      const prevLine = i > 0 ? lines[i - 1] : '';
      const nextLine = i < lines.length - 1 ? lines[i + 1] : '';
      
      const isStartOfList = !prevLine.trim().startsWith('-');
      const isEndOfList = !nextLine.trim().startsWith('-');
      
      if (isStartOfList) {
        processedLines.push(`<ul class="${containerClass}">`);
      }
      
      processedLines.push(bulletHtml);
      
      if (isEndOfList) {
        processedLines.push('</ul>');
      }
    } else {
      processedLines.push(line);
    }
  }
  
  return processedLines.join('\n');
}

// Add custom styling
function addCustomStyling(content: string): string {
  // Add custom CSS classes for better visual hierarchy
  let styled = content;
  
  // Style main concepts (bold terms at top level)
  styled = styled.replace(
    /<strong class="font-semibold text-gray-900">([A-Z][^<]+)<\/strong>/g,
    '<strong class="font-bold text-blue-900 text-lg">$1</strong>'
  );
  
  // Style sub-concepts (bold terms in sub-bullets)
  styled = styled.replace(
    /<li class="list-disc list-inside mb-1 text-gray-700"><strong class="font-semibold text-gray-900">([^<]+)<\/strong>/g,
    '<li class="list-disc list-inside mb-1 text-gray-700"><strong class="font-semibold text-gray-800">$1</strong>'
  );
  
  // Style formulas
  styled = styled.replace(
    /<span class="font-mono bg-gray-100 px-2 py-1 rounded text-sm">\$\$([^$]+)\$\$<\/span>/g,
    '<span class="font-mono bg-blue-50 border border-blue-200 px-3 py-2 rounded text-sm text-blue-900">$$$1$$</span>'
  );
  
  // Style paragraph headers (bold terms that are section titles)
  styled = styled.replace(
    /<p class="mb-3 leading-relaxed"><strong class="font-semibold text-gray-900">([^<]+)<\/strong>/g,
    '<p class="mb-3 leading-relaxed"><strong class="font-bold text-blue-900 text-lg">$1</strong>'
  );
  
  // Add special styling for section breaks
  styled = styled.replace(
    /<p class="mb-3 leading-relaxed"><\/p>\n<p class="mb-3 leading-relaxed"><strong class="font-bold text-blue-900 text-lg">([^<]+)<\/strong>/g,
    '<div class="my-6 border-t border-gray-200 pt-4"></div><p class="mb-3 leading-relaxed"><strong class="font-bold text-blue-900 text-lg">$1</strong>'
  );
  
  return styled;
}