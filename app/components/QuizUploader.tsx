'use client';

import { useState, useRef } from 'react';
import { upload } from '@vercel/blob/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { Loader2 } from 'lucide-react';
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

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!inputFileRef.current?.files?.[0]) {
      toast({
        title: 'No file selected',
        description: 'Please choose a file to upload.',
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

    setIsUploading(true);
    setIsGenerating(true);
    onQuizGenerated({ loading: true });

    try {
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
      onStreamingUpdate('File uploaded successfully. Starting quiz generation...');

      const response = await fetch('/api/generate-quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          blobUrl: newBlob.url,
          settings,
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
                        // Don't break here, wait for complete signal
                    } else if (parsed.type === 'error') {
                        throw new Error(parsed.message);
                    } else if (parsed.type === 'complete') {
                        console.log('✅ QuizUploader: Received complete signal');
                        onStreamingUpdate(parsed.message);
                        done = true; // Set done flag to exit the outer loop
                        break; // Exit the inner loop
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
        {/* File Upload */}
        <div>
          <Label htmlFor="file-upload" className="block mb-2">Upload Document</Label>
          <Input
            id="file-upload"
            ref={inputFileRef}
            type="file"
            accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.csv"
            onChange={handleFileChange}
            disabled={isGenerating}
            className="cursor-pointer"
          />
          <p className="text-xs text-gray-500 mt-1 space-y-1">
            <span className="block sm:inline">
              <strong className="text-gray-600">Supported formats:</strong>
            </span>
            <span className="block sm:inline sm:ml-1">
              PDF, Word (.doc/.docx), PowerPoint (.ppt/.pptx), Text (.txt/.csv)
            </span>
            <span className="block mt-1">
              <strong className="text-gray-600">Maximum file size:</strong> 50MB
            </span>
            <span className="hidden sm:block text-amber-600 mt-1">
              💡 Larger files may take longer to process
            </span>
          </p>
        </div>

        {/* Number of Questions */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <Label>Number of Questions</Label>
            <span className="text-sm text-gray-500">
              {settings.numberOfQuestions} questions
            </span>
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

        {/* Difficulty Level */}
        <div>
          <Label className="block mb-2">Difficulty</Label>
          <RadioGroup
            value={settings.difficulty}
            onValueChange={(value) => setSettings({ ...settings, difficulty: value as 'easy' | 'medium' | 'hard' })}
            className="flex flex-col space-y-1"
            disabled={isGenerating}
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="easy" id="easy" disabled={isGenerating} />
              <Label htmlFor="easy">Easy</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="medium" id="medium" disabled={isGenerating} />
              <Label htmlFor="medium">Medium</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="hard" id="hard" disabled={isGenerating} />
              <Label htmlFor="hard">Hard</Label>
            </div>
          </RadioGroup>
        </div>

        {/* Question Type */}
        <div>
          <Label className="block mb-2">Question Type</Label>
          <RadioGroup
            value={settings.questionType}
            onValueChange={(value) => setSettings({ ...settings, questionType: value as 'multiple_choice' | 'open_ended' | 'mixed' })}
            className="flex flex-col space-y-1"
            disabled={isGenerating}
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="multiple_choice" id="multiple_choice" disabled={isGenerating} />
              <Label htmlFor="multiple_choice">Multiple Choice</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="open_ended" id="open_ended" disabled={isGenerating} />
              <Label htmlFor="open_ended">Open Ended</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="mixed" id="mixed" disabled={isGenerating} />
              <Label htmlFor="mixed">Mixed</Label>
            </div>
          </RadioGroup>
        </div>
      </div>

      {/* Generate Quiz Button */}
      <div className="mt-4">
        <Button 
          type="submit" 
          className="w-full"
          disabled={isGenerating}
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
