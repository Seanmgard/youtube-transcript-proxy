'use client';

import { useState, useRef, useEffect } from 'react';
import { upload } from '@vercel/blob/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, Upload, Video, Crown } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Slider } from '@/components/ui/slider';
import { QuizSettings } from '@/lib/types';
import { useSubscription } from '@/hooks/useSubscription';
import { SummarySettings } from './SummarySettings';
import GenerationLoadingStatus from './GenerationLoadingStatus';

interface QuizUploaderProps {
  onQuizGenerated: (quiz: any) => void;
  onSummaryGenerated?: (summary: string) => void;
  onStreamingUpdate: (text: string) => void;
  onSettingsChange?: (settings: QuizSettings) => void;
}

export default function QuizUploader({ onQuizGenerated, onSummaryGenerated, onStreamingUpdate, onSettingsChange }: QuizUploaderProps) {
  const inputFileRef = useRef<HTMLInputElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [fileName, setFileName] = useState('');
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [summaryCompleted, setSummaryCompleted] = useState(false);
  const [currentStep, setCurrentStep] = useState('');
  const [settings, setSettings] = useState<QuizSettings>({
    numberOfQuestions: 10,
    difficulty: 'medium',
    questionType: 'multiple_choice',
    sourceType: 'file',
    summary: {
      enabled: true
    }
  });
  const { toast } = useToast();
  const { isOnPlan } = useSubscription();
  
  // Set question limits based on subscription
  const isPremium = isOnPlan('premium');
  const maxQuestions = isPremium ? 50 : 10;

  // Notify parent component when settings change
  useEffect(() => {
    onSettingsChange?.(settings);
  }, [settings, onSettingsChange]);

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
    setQuizCompleted(false);
    setSummaryCompleted(false);
    setCurrentStep('Preparing to upload document...');
    onQuizGenerated({ loading: true });

    try {
      // File upload path
      setIsUploading(true);
      setCurrentStep(`Uploading ${file.name} (${Math.round(file.size / 1024)}KB)...`);
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
      
      // Start quiz generation
      setCurrentStep('File uploaded successfully. Starting quiz generation...');
      onStreamingUpdate('File uploaded successfully. Starting quiz generation...');

      const quizResponse = await fetch('/api/generate-quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          blobUrl,
          settings: { ...settings, sourceType: 'file' },
        }),
      });

      if (!quizResponse.ok) {
        const errorData = await quizResponse.json();
        throw new Error(errorData.error || 'Failed to generate quiz');
      }

      // Handle quiz generation stream
      if (!quizResponse.body) {
        throw new Error('The response body is empty.');
      }
      
      const quizReader = quizResponse.body.getReader();
      const decoder = new TextDecoder();
      let done = false;
      let fullResponse = '';

      while (!done) {
        const { value, done: readerDone } = await quizReader.read();
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
                  setQuizCompleted(true);
                  setCurrentStep('Quiz generation completed!');
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

      // If summary is enabled and we're on premium, generate summary
      if (settings.summary?.enabled && isPremium) {
        setCurrentStep('Starting comprehensive study guide generation...');
        onStreamingUpdate('Starting summary generation...');
        
        const summaryResponse = await fetch('/api/generate-summary', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileUrl: blobUrl, fileName: file.name }),
        });

        if (!summaryResponse.ok) {
          const errorData = await summaryResponse.json();
          throw new Error(errorData.error || 'Failed to generate summary');
        }

        if (!summaryResponse.body) {
          throw new Error('The summary response body is empty.');
        }

        // Handle summary generation stream
        const summaryReader = summaryResponse.body.getReader();
        let summaryText = '';

        while (true) {
          const { value, done: summaryDone } = await summaryReader.read();
          if (summaryDone) break;
          
          const chunk = decoder.decode(value);
          summaryText += chunk;
          if (onSummaryGenerated) {
            onSummaryGenerated(summaryText);
          }
        }

        setSummaryCompleted(true);
        setCurrentStep('Study guide generation completed!');
        onStreamingUpdate('Summary generation completed!');
      } else {
        // If summary is not enabled, mark it as completed
        setSummaryCompleted(true);
      }

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
      console.error('Generation error:', error);
      toast({
        title: 'Error',
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
    <>
      <GenerationLoadingStatus
        isGenerating={isGenerating}
        isUploading={isUploading}
        uploadProgress={uploadProgress}
        quizCompleted={quizCompleted}
        summaryCompleted={summaryCompleted}
        summaryEnabled={!!(settings.summary?.enabled && isPremium)}
        currentStep={currentStep}
      />
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

        {/* Generation Settings */}
        <div className="bg-gray-50 rounded-lg p-4 space-y-3">
          {/* Content Generation Options */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Question Type */}
            <div className="bg-white rounded-md p-3 border border-gray-200 h-full flex flex-col">
              <Label className="block mb-2 text-sm font-medium text-gray-900">Question Type</Label>
              <RadioGroup
                value={settings.questionType}
                onValueChange={(value) => setSettings({ ...settings, questionType: value as 'multiple_choice' | 'open_ended' | 'cloze' })}
                className="space-y-1 flex-1"
                disabled={isGenerating}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="multiple_choice" id="multiple_choice" disabled={isGenerating} />
                  <Label htmlFor="multiple_choice" className="text-xs text-gray-700">Multiple Choice</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="open_ended" id="open_ended" disabled={isGenerating} />
                  <Label htmlFor="open_ended" className="text-xs text-gray-700">Open Ended</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="cloze" id="cloze" disabled={isGenerating} />
                  <Label htmlFor="cloze" className="text-xs text-gray-700">Cloze Deletion</Label>
                </div>
              </RadioGroup>
            </div>

            {/* Summary Settings */}
            <div className="bg-white rounded-md p-3 border border-gray-200 h-full flex flex-col">
              <SummarySettings
                settings={settings.summary || { enabled: false }}
                onSettingsChange={(summarySettings) => {
                  setSettings({ ...settings, summary: summarySettings });
                }}
                isPremium={isPremium}
                disabled={isGenerating}
              />
            </div>
          </div>

          {/* Number of Questions */}
          <div className="bg-white rounded-md p-3 border border-gray-200">
            <div className="flex justify-between items-center mb-2">
              <Label className="text-sm font-medium text-gray-900">Questions</Label>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-700">{settings.numberOfQuestions}</span>
                {!isPremium && (
                  <div className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded">
                    <Crown className="h-3 w-3" />
                    <span>Free: Max {maxQuestions}</span>
                  </div>
                )}
                {isPremium && (
                  <div className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
                    <Crown className="h-3 w-3" />
                    <span>Premium: Max {maxQuestions}</span>
                  </div>
                )}
              </div>
            </div>
            <Slider
              value={[settings.numberOfQuestions]}
              min={5}
              max={maxQuestions}
              step={1}
              onValueChange={(value) => {
                const newValue = Math.min(value[0], maxQuestions);
                setSettings({ ...settings, numberOfQuestions: newValue });
              }}
              disabled={isGenerating}
            />
            {!isPremium && settings.numberOfQuestions >= maxQuestions && (
              <p className="text-xs text-amber-600 mt-2 bg-amber-50 p-2 rounded border border-amber-200">
                Upgrade to Premium for up to 50 questions per quiz
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Generate Button */}
      <div className="mt-4 pt-4 border-t">
        <Button 
          type="submit" 
          className="w-full h-11"
          disabled={isGenerating || !fileName}
        >
          {isGenerating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {isUploading ? `Uploading... ${uploadProgress}%` : 'Generating...'}
            </>
          ) : 'Generate Quiz' + (settings.summary?.enabled ? ' & Summary' : '')}
        </Button>
      </div>
    </form>
    </>
  );
}
