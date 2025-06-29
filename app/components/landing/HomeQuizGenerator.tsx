'use client';

import { useState } from 'react';
import { upload } from '@vercel/blob/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { Loader2 } from 'lucide-react';
import { QuizSettings } from '@/lib/types';

export function HomeQuizGenerator({ onQuizGenerated, onProgressUpdate }: { 
  onQuizGenerated: (quiz: any) => void;
  onProgressUpdate?: (step: number, message: string) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [quizGenerated, setQuizGenerated] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [stepMessage, setStepMessage] = useState('');
  const { toast } = useToast();

  const settings: QuizSettings = {
    numberOfQuestions: 10,
    difficulty: 'medium',
    questionType: 'multiple_choice',
    sourceType: 'file',
  };

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



  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    const validation = validateFile(selectedFile);
    if (!validation.valid) {
      toast({
        title: 'Invalid file',
        description: validation.error,
        variant: 'destructive',
      });
      // Clear the input
      e.target.value = '';
      return;
    }

    setFile(selectedFile);
  };

  const updateProgress = (message: string) => {
    let step = 0;
    let displayMessage = message;
    
    // Map API messages to our step system
    if (message.includes('Uploading') || message.includes('uploaded')) {
      step = 1;
      displayMessage = 'Uploading your document...';
    } else if (message.includes('Preparing') || message.includes('Reading') || message.includes('processed') || message.includes('Fetching')) {
      step = 2;
      displayMessage = 'Analyzing document content...';
    } else if (message.includes('Creating') || message.includes('Setting up') || message.includes('questions') || message.includes('Generating')) {
      step = 3;
      displayMessage = 'Creating your quiz questions...';
    }
    
    setCurrentStep(step);
    setStepMessage(displayMessage);
    
    // Update parent component as well
    if (onProgressUpdate && step > 0) {
      onProgressUpdate(step - 1, displayMessage); // Convert to 0-based index for parent
    }
  };

  // Function to show finalizing step
  const showFinalizingStep = () => {
    setCurrentStep(4);
    setStepMessage('Finalizing your quiz...');
    if (onProgressUpdate) {
      onProgressUpdate(3, 'Finalizing your quiz...');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate file upload
    if (!file) {
      toast({
        title: 'File required',
        description: 'Please select a file to upload',
        variant: 'destructive',
      });
      return;
    }

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
    setCurrentStep(0);
    setStepMessage('');
    // Reset the parent component's quiz state to show loading
    onQuizGenerated({ title: 'Generating Quiz...', questions: [] });

    try {
      // File upload path
      setIsUploading(true);
      updateProgress(`Uploading ${file.name} (${Math.round(file.size / 1024)}KB)...`);
      
      const newBlob = await upload(file.name, file, {
        access: 'public',
        handleUploadUrl: '/api/upload',
        onUploadProgress: (progressEvent) => {
          const percentage = Math.round(progressEvent.percentage);
          setUploadProgress(percentage);
          updateProgress(`Upload progress: ${percentage}%`);
        },
      });

      setIsUploading(false);
      const blobUrl = newBlob.url;
      updateProgress('File uploaded successfully. Starting quiz generation...');

      // Now generate quiz
      const response = await fetch('/api/generate-quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          blobUrl,
          settings,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate quiz');
      }

      if (!response.body) {
        throw new Error('ReadableStream not supported in this environment.');
      }

      // Handle streaming response
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let finalQuiz = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataContent = line.substring(6);
            if (dataContent === '[DONE]') {
              break;
            }
            try {
              const parsed = JSON.parse(dataContent);
              if (parsed.type === 'info' || parsed.type === 'warning' || parsed.type === 'progress' || parsed.type === 'success') {
                updateProgress(parsed.message);
              } else if (parsed.type === 'final') {
                finalQuiz = parsed.quiz;
                showFinalizingStep();
                // Don't break here, wait for complete signal
              } else if (parsed.type === 'error') {
                throw new Error(parsed.message);
              } else if (parsed.type === 'complete') {
                updateProgress(parsed.message);
                break; // Exit the streaming loop
              }
            } catch (e) {
              console.error('Error parsing stream data chunk:', dataContent, e);
            }
          }
        }
      }

      if (finalQuiz) {
        setQuizGenerated(true);
        setCurrentStep(0);
        setStepMessage('');
        // Update the parent component with the generated quiz
        onQuizGenerated(finalQuiz);
        toast({
          title: 'Success',
          description: 'Quiz generated successfully!',
        });
      } else {
        throw new Error('No quiz data received from the server');
      }
    } catch (err: any) {
      console.error('Error generating quiz:', err);
      setCurrentStep(0);
      setStepMessage('');
      toast({
        title: 'Error',
        description: err.message,
        variant: 'destructive',
      });
      // Reset the quiz display on error
      onQuizGenerated(null);
    } finally {
      setIsGenerating(false);
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  return (
    <div className="bg-white shadow-lg rounded-lg p-4 sm:p-6 border border-gray-200 h-full">
      <h2 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6 text-gray-900">Generate Your Quiz!</h2>
      <p className="mb-4 sm:mb-6 text-gray-600 text-sm sm:text-base">
        Upload your learning materials and transform them into practice questions. Give it a try.
      </p>
      
            <form onSubmit={handleSubmit} className="mb-4 sm:mb-6">
        {/* File Upload */}
                  <div className="mb-4">
            <Label htmlFor="file-upload" className="text-sm sm:text-base text-gray-900">Upload your document</Label>
          <Input 
            id="file-upload" 
            type="file" 
            accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.csv" 
            onChange={handleFileChange} 
            className="mt-1"
            disabled={isGenerating}
          />
          <p className="text-xs text-gray-500 mt-1">
            Supported: PDF, Word, PowerPoint, Text files (Max: 50MB)
          </p>
        </div>
        
        <Button
          type="submit"
          disabled={!file || isGenerating}
          className="w-full"
        >
          {isGenerating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {isUploading ? `Uploading... ${uploadProgress}%` : 'Generating...'}
            </>
          ) : (
            'Generate Quiz'
          )}
        </Button>
      </form>

      {/* Progress Display */}
      {isGenerating && (
        <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center space-x-2 sm:space-x-3">
            <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 animate-spin text-blue-600" />
            <div className="flex-1">
              <p className="text-sm sm:text-base font-medium text-blue-900">
                {stepMessage || 'Processing...'}
              </p>
              {isUploading && uploadProgress > 0 && (
                <div className="mt-2">
                  <div className="bg-blue-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                      style={{ width: `${uploadProgress}%` }}
                    ></div>
                  </div>
                  <p className="text-xs text-blue-700 mt-1">{uploadProgress}% uploaded</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Success State */}
      {quizGenerated && !isGenerating && (
        <div className="p-3 sm:p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center space-x-2 sm:space-x-3">
            <div className="h-4 w-4 sm:h-5 sm:w-5 bg-green-600 rounded-full flex items-center justify-center">
              <svg className="h-2 w-2 sm:h-3 sm:w-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
            <p className="text-sm sm:text-base font-medium text-green-900">
              Quiz generated successfully!
            </p>
          </div>
        </div>
      )}
    </div>
  );
} 