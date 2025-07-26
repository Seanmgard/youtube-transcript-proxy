'use client';

import { useState } from 'react';
import { useAuth } from '@/app/providers/AuthProvider';
import { useSupabase } from '@/utils/supabase/client';
import { upload } from '@vercel/blob/client';
import { Loader2, Upload, FileText, Download, Copy } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { useToast } from '@/app/components/ui/use-toast';
import { useSubscription } from '@/hooks/useSubscription';
import { Label } from '@/app/components/ui/label';
import SummaryRenderer from '@/app/components/SummaryRenderer';
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';

export default function SummaryPage() {
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [summary, setSummary] = useState('');
  const [streamingText, setStreamingText] = useState('');
  const { user } = useAuth();
  const { supabase } = useSupabase();
  const { toast } = useToast();
  const { isOnPlan } = useSubscription();
  const isPremium = isOnPlan('premium');

  const validateFile = (file: File): { valid: boolean; error?: string } => {
    // Check file size (50MB limit)
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      return {
        valid: false,
        error: `File size (${Math.round(file.size / 1024 / 1024)}MB) exceeds the 50MB limit. Please use a smaller file.`
      };
    }

    // Check file type
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
      'application/msword', // .doc
      'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
      'application/vnd.ms-powerpoint', // .ppt
      'text/plain', // .txt
      'text/csv', // .csv
    ];

    if (!allowedTypes.includes(file.type)) {
      return {
        valid: false,
        error: 'Please upload a supported file type: PDF, Word (.docx, .doc), PowerPoint (.pptx, .ppt), or text files (.txt, .csv).'
      };
    }

    return { valid: true };
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      const validation = validateFile(selectedFile);
      if (!validation.valid) {
        toast({
          title: "Invalid File",
          description: validation.error,
          variant: "destructive",
        });
        event.target.value = '';
        return;
      }
      setFile(selectedFile);
      setFileName(selectedFile.name);
    }
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(summary);
      toast({
        title: "Copied!",
        description: "Summary copied to clipboard",
      });
    } catch (error) {
      toast({
        title: "Copy failed",
        description: "Unable to copy to clipboard",
        variant: "destructive",
      });
    }
  };

  const downloadSummary = async () => {
    try {
      // Convert markdown to Word document paragraphs
      const lines = summary.split('\n');
      const children: (Paragraph)[] = [];

      for (const line of lines) {
        if (line.trim() === '') {
          children.push(new Paragraph({ children: [new TextRun('')] }));
        } else if (line.startsWith('# ')) {
          children.push(new Paragraph({
            children: [new TextRun({ text: line.substring(2), bold: true, size: 32 })],
            heading: HeadingLevel.HEADING_1
          }));
        } else if (line.startsWith('## ')) {
          children.push(new Paragraph({
            children: [new TextRun({ text: line.substring(3), bold: true, size: 28 })],
            heading: HeadingLevel.HEADING_2
          }));
        } else if (line.startsWith('### ')) {
          children.push(new Paragraph({
            children: [new TextRun({ text: line.substring(4), bold: true, size: 24 })],
            heading: HeadingLevel.HEADING_3
          }));
        } else if (line.startsWith('**') && line.endsWith('**')) {
          children.push(new Paragraph({
            children: [new TextRun({ text: line.slice(2, -2), bold: true })]
          }));
        } else if (line.startsWith('- ') || line.startsWith('* ')) {
          children.push(new Paragraph({
            children: [new TextRun({ text: '• ' + line.substring(2) })],
            indent: { left: 400 }
          }));
        } else {
          // Handle bold text within paragraphs
          const parts = line.split(/(\*\*.*?\*\*)/);
          const textRuns = parts.map(part => {
            if (part.startsWith('**') && part.endsWith('**')) {
              return new TextRun({ text: part.slice(2, -2), bold: true });
            } else {
              return new TextRun({ text: part });
            }
          });
          
          children.push(new Paragraph({ children: textRuns }));
        }
      }

      const doc = new Document({
        sections: [{
          properties: {},
          children: children
        }]
      });

      const buffer = await Packer.toBlob(doc);
      const url = URL.createObjectURL(buffer);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${fileName.replace(/\.[^/.]+$/, '')}_summary.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "Downloaded!",
        description: "Summary downloaded as Word document",
      });
    } catch (error) {
      toast({
        title: "Download failed",
        description: "Unable to download summary",
        variant: "destructive",
      });
    }
  };

  const generateSummary = async (event: React.FormEvent) => {
    event.preventDefault();
    
    if (!file || !user || !isPremium) return;

    setIsGenerating(true);
    setUploadProgress(0);
    setIsUploading(true);
    setSummary('');
    setStreamingText('');

    try {
      // Upload file to Vercel Blob
      const { url: blobUrl } = await upload(file.name, file, {
        access: 'public',
        handleUploadUrl: '/api/upload',
        onUploadProgress: ({ percentage }) => {
          setUploadProgress(percentage);
          if (percentage === 100) {
            setIsUploading(false);
          }
        },
      });

      // Start summary generation
      const response = await fetch('/api/generate-summary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ blobUrl }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate summary');
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No reader available');
      }

      let fullSummary = '';
      let currentStreamingText = '';

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;

        const chunk = new TextDecoder().decode(value);
        
        // Check if this is a status update (contains phrases like "Creating comprehensive study guide...")
        if (chunk.includes('Creating comprehensive') || 
            chunk.includes('Uploading document') || 
            chunk.includes('Processing document') ||
            chunk.includes('⚠️ Generating detailed')) {
          setStreamingText(chunk.trim());
        } else {
          // This is actual summary content
          fullSummary += chunk;
          setSummary(fullSummary);
          setStreamingText('');
        }
      }

    } catch (error) {
      console.error('Error:', error);
      toast({
        title: "Generation Failed",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
      setIsUploading(false);
      setUploadProgress(0);
      setStreamingText('');
    }
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
          Document Summary Generator
        </h1>
        <p className="text-gray-600 text-sm sm:text-base">
          Generate comprehensive study guides from your documents using AI
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upload Section */}
        <div className="bg-white rounded-lg shadow-md border border-gray-100 p-4 sm:p-6">
          <div className="mb-4">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2">
              Upload Document
            </h2>
            <p className="text-sm text-gray-600">
              Supported formats: PDF, Word, PowerPoint, TXT, CSV (Max 50MB)
            </p>
          </div>

          <form onSubmit={generateSummary} className="space-y-4">
            <div>
              <Label htmlFor="file-upload" className="block text-sm font-medium text-gray-700 mb-2">
                Choose File
              </Label>
              <div className="relative">
                <input
                  id="file-upload"
                  type="file"
                  onChange={handleFileChange}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  accept=".pdf,.docx,.doc,.pptx,.ppt,.txt,.csv"
                  disabled={isGenerating}
                />
              </div>
              {fileName && (
                <p className="mt-2 text-sm text-gray-600">
                  Selected: {fileName}
                </p>
              )}
            </div>

            <Button
              type="submit"
              disabled={!file || isGenerating || !isPremium}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isUploading ? `Uploading... ${uploadProgress}%` : 'Generating Summary...'}
                </>
              ) : 'Generate Summary'}
            </Button>

            {!isPremium && (
              <p className="text-sm text-amber-600 text-center mt-2">
                Summary generation is a premium feature. Please upgrade to access this feature.
              </p>
            )}
          </form>
        </div>

        {/* Summary Display Section */}
        <div className="bg-white rounded-lg shadow-md border border-gray-100 overflow-hidden">
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-4 sm:px-6 py-4 border-b border-blue-100">
            <div className="flex items-center justify-between">
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900 flex items-center">
                <FileText className="w-5 h-5 mr-2 text-blue-600" />
                Study Guide
              </h2>
              {summary && (
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={copyToClipboard}
                    className="text-xs"
                  >
                    <Copy className="w-3 h-3 mr-1" />
                    Copy
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={downloadSummary}
                    className="text-xs"
                  >
                    <Download className="w-3 h-3 mr-1" />
                    Download
                  </Button>
                </div>
              )}
            </div>
          </div>
          <div className="p-4 sm:p-6">
            <div className="h-[600px] overflow-y-auto">
              {!summary && !isGenerating && (
                <div className="text-gray-500 text-center h-full flex flex-col justify-center">
                  <FileText className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                  <p className="mb-2 text-lg">Your study guide will appear here</p>
                  <p className="text-sm">Upload a document and click "Generate Summary" to begin</p>
                </div>
              )}

              {isGenerating && streamingText && (
                <div className="space-y-4">
                  <div className="flex items-center">
                    <Loader2 className="h-4 w-4 animate-spin mr-2 text-blue-600" />
                    <span className="text-sm font-medium text-gray-700">{streamingText}</span>
                  </div>
                </div>
              )}

              {summary && (
                <SummaryRenderer content={summary} />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 