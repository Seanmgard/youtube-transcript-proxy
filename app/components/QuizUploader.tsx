'use client';

import { useState, useRef } from 'react';
import { upload } from '@vercel/blob/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, Upload, Video } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Slider } from '@/components/ui/slider';
import { QuizSettings } from '@/lib/types';

interface QuizUploaderProps {
  onQuizGenerated: (quiz: any) => void;
  onStreamingUpdate: (text: string) => void;
}

export default function QuizUploader({ onQuizGenerated, onStreamingUpdate }: QuizUploaderProps) {
  const inputFileRef = useRef<HTMLInputElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [fileName, setFileName] = useState('');
  const [settings, setSettings] = useState<QuizSettings>({
    numberOfQuestions: 10,
    difficulty: 'medium',
    questionType: 'multiple_choice',
    sourceType: 'file',
  });
  const { toast } = useToast();

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
        error: 'Please upload a PDF, Word document (.doc/.docx), PowerPoint presentation (.ppt/.pptx), or text file (.txt/.csv)'
      };
    }

    // Check file extension as additional validation
    const fileName = file.name.toLowerCase();
    const allowedExtensions = ['.pdf', '.doc', '.docx', '.ppt', '.pptx', '.txt', '.csv'];
    const hasValidExtension = allowedExtensions.some(ext => fileName.endsWith(ext));
    
    if (!hasValidExtension) {
      return {
        valid: false,
        error: 'File must have a valid extension: .pdf, .doc, .docx, .ppt, .pptx, .txt, or .csv'
      };
    }

    return { valid: true };
  };

  const handleFileUploadClick = () => {
    if (inputFileRef.current && !isGenerating) {
      inputFileRef.current.click();
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const validation = validateFile(file);
      if (!validation.valid) {
        toast({
          title: 'Invalid file',
          description: validation.error,
          variant: 'destructive',
        });
        // Clear the input
        if (inputFileRef.current) {
          inputFileRef.current.value = '';
        }
        setFileName('');
        return;
      }
      setFileName(file.name);
    } else {
      setFileName('');
    }
  };

  const handleYouTubeClick = () => {
    // TODO: Show modal for YouTube URL input when feature is enabled
    toast({
      title: 'Coming Soon',
      description: 'YouTube video support will be available soon!',
    });
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    
    // Validate file upload
    if (!fileName) {
      toast({
        title: 'No file selected',
        description: 'Please choose a file to upload.',
        variant: 'destructive',
      });
      return;
    }

    if (!inputFileRef.current?.files?.[0]) {
      toast({
        title: 'File error',
        description: 'Please select a file again.',
        variant: 'destructive',
      });
      return;
    }

    const file = inputFileRef.current.files[0];
    
    // Re-validate file before upload
    const validation = validateFile(file);
    if (!validation.valid) {
      toast({
        title: 'Invalid file',
        description: validation.error,
        variant: 'destructive',
      });
      return;
    }

    setIsGenerating(true);
    onQuizGenerated({ loading: true });

    try {
      // File upload path
      setIsUploading(true);
      onStreamingUpdate(`Uploading ${file.name} (${Math.round(file.size / 1024)}KB)...`);
      
      const newBlob = await upload(file.name, file, {
        access: 'public',
        handleUploadUrl: '/api/upload',
        onUploadProgress: (progressEvent) => {
          const percentage = Math.round(progressEvent.percentage);
          setUploadProgress(percentage);
          onStreamingUpdate(`Upload progress: ${percentage}%`);
        },
      });

      setIsUploading(false);
      const blobUrl = newBlob.url;
      onStreamingUpdate('File uploaded successfully. Starting quiz generation...');

      const response = await fetch('/api/generate-quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          blobUrl,
          settings: { ...settings, sourceType: 'file' },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate quiz');
      }

      if (!response.body) {
        throw new Error('The response body is empty.');
      }
      
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let done = false;
      let fullResponse = '';

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) {
          const chunk = decoder.decode(value, { stream: true });
          fullResponse += chunk;
          
          const lines = fullResponse.split('\n\n');
          fullResponse = lines.pop() || '';
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
                const dataContent = line.substring(6);
                if (dataContent === '[DONE]') {
                    break;
                }
                try {
                    const parsed = JSON.parse(dataContent);
                    if (parsed.type === 'info' || parsed.type === 'warning' || parsed.type === 'progress' || parsed.type === 'success') {
                        onStreamingUpdate(parsed.message);
                    } else if (parsed.type === 'final') {
                        console.log('🎯 QuizUploader: Received final quiz data:', parsed.quiz);
                        onQuizGenerated(parsed.quiz);
                        onStreamingUpdate('Quiz generation completed!');
                    } else if (parsed.type === 'error') {
                        throw new Error(parsed.message);
                    } else if (parsed.type === 'complete') {
                        console.log('✅ QuizUploader: Received complete signal');
                        onStreamingUpdate(parsed.message);
                        done = true;
                        break;
                    } else {
                        console.log('🔄 QuizUploader: Received fallback quiz data:', parsed);
                        onQuizGenerated(parsed);
                    }
                } catch (e) {
                    console.error('Error parsing stream data chunk:', dataContent, e);
                }
            }
          }
        }
      }

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
      console.error('Quiz generation error:', error);
      toast({
        title: 'Error Generating Quiz',
        description: errorMessage,
        variant: 'destructive',
      });
      onQuizGenerated({ title: 'Error', questions: [{ text: errorMessage }] });
      onStreamingUpdate(`Error: ${errorMessage}`);
    } finally {
      setIsGenerating(false);
      setIsUploading(false);
      setUploadProgress(0);
      setFileName('');
      if (inputFileRef.current) {
        inputFileRef.current.value = '';
      }
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col h-full">
      <div className="space-y-4 flex-1">
        {/* Content Source Selection with Integrated Actions */}
        <div>
          <Label className="block mb-3 text-base font-medium">Choose Content Source</Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* File Upload Option */}
            <button
              type="button"
              onClick={handleFileUploadClick}
              disabled={isGenerating}
              className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Upload className="h-8 w-8 text-gray-400 mb-2" />
              <span className="text-sm font-medium text-gray-700">Upload File</span>
              <span className="text-xs text-gray-500 mt-1">PDF, Word, PowerPoint, Text</span>
              {fileName && (
                <span className="text-xs text-green-600 mt-2 font-medium max-w-full truncate">
                  ✓ {fileName}
                </span>
              )}
            </button>

            {/* YouTube Option */}
            <div className="relative">
              <button
                type="button"
                onClick={handleYouTubeClick}
                disabled={true}
                className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-gray-200 rounded-lg bg-gray-50 cursor-not-allowed opacity-60 w-full"
              >
                <Video className="h-8 w-8 text-gray-400 mb-2" />
                <span className="text-sm font-medium text-gray-500">YouTube Video</span>
                <span className="text-xs text-gray-400 mt-1">Paste video URL</span>
              </button>
              <div className="absolute -top-2 -right-2">
                <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-amber-100 text-amber-800 rounded-full">
                  Coming Soon
                </span>
              </div>
            </div>
          </div>

          {/* File Info */}
          {fileName && (
            <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
              <div className="text-sm text-green-800">
                <strong>Selected:</strong> {fileName}
              </div>
              <div className="text-xs text-green-600 mt-1">
                Ready to generate quiz • Max 50MB • PDF, Word, PowerPoint, Text files supported
              </div>
            </div>
          )}
        </div>

        {/* Hidden file input */}
        <input
          ref={inputFileRef}
          type="file"
          accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.csv"
          onChange={handleFileChange}
          className="hidden"
        />

        {/* Quiz Settings */}
        <div className="space-y-4">
          {/* Number of Questions */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <Label className="text-sm font-medium">Questions</Label>
              <span className="text-sm text-gray-500">{settings.numberOfQuestions}</span>
            </div>
            <Slider
              value={[settings.numberOfQuestions]}
              min={5}
              max={50}
              step={1}
              onValueChange={(value) => setSettings({ ...settings, numberOfQuestions: value[0] })}
              disabled={isGenerating}
            />
          </div>

          {/* Difficulty & Question Type in a Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Difficulty Level */}
            <div>
              <Label className="block mb-2 text-sm font-medium">Difficulty</Label>
              <RadioGroup
                value={settings.difficulty}
                onValueChange={(value) => setSettings({ ...settings, difficulty: value as 'easy' | 'medium' | 'hard' })}
                className="space-y-1"
                disabled={isGenerating}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="easy" id="easy" disabled={isGenerating} />
                  <Label htmlFor="easy" className="text-sm">Easy</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="medium" id="medium" disabled={isGenerating} />
                  <Label htmlFor="medium" className="text-sm">Medium</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="hard" id="hard" disabled={isGenerating} />
                  <Label htmlFor="hard" className="text-sm">Hard</Label>
                </div>
              </RadioGroup>
            </div>

            {/* Question Type */}
            <div>
              <Label className="block mb-2 text-sm font-medium">Question Type</Label>
              <RadioGroup
                value={settings.questionType}
                onValueChange={(value) => setSettings({ ...settings, questionType: value as 'multiple_choice' | 'open_ended' | 'mixed' })}
                className="space-y-1"
                disabled={isGenerating}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="multiple_choice" id="multiple_choice" disabled={isGenerating} />
                  <Label htmlFor="multiple_choice" className="text-sm">Multiple Choice</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="open_ended" id="open_ended" disabled={isGenerating} />
                  <Label htmlFor="open_ended" className="text-sm">Open Ended</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="mixed" id="mixed" disabled={isGenerating} />
                  <Label htmlFor="mixed" className="text-sm">Mixed</Label>
                </div>
              </RadioGroup>
            </div>
          </div>
        </div>
      </div>

      {/* Generate Quiz Button */}
      <div className="mt-4 pt-4 border-t">
        <Button 
          type="submit" 
          className="w-full h-11"
          disabled={isGenerating || !fileName}
        >
          {isGenerating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {isUploading ? `Uploading... ${uploadProgress}%` : 'Generating Quiz...'}
            </>
          ) : 'Generate Quiz'}
        </Button>
      </div>
    </form>
  );
}
