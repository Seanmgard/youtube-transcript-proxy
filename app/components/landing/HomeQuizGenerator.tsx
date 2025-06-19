'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { generateQuiz } from '@/utils/api-client';
import { QuizSettings } from '@/lib/types';

export function HomeQuizGenerator({ onQuizGenerated, onProgressUpdate }: { 
  onQuizGenerated: (quiz: any) => void;
  onProgressUpdate?: (step: number, message: string) => void;
}) {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [quizGenerated, setQuizGenerated] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [stepMessage, setStepMessage] = useState('');

  // Progressive steps for user feedback
  const steps = [
    { step: 1, message: 'Uploading your PDF...' },
    { step: 2, message: 'Analyzing document content...' },
    { step: 3, message: 'Creating your quiz questions...' },
    { step: 4, message: 'Finalizing your quiz...' }
  ];

  // Fixed settings for the demo
  const settings: QuizSettings = {
    numberOfQuestions: 2,
    difficulty: 'medium',
    questionType: 'multiple_choice',
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
      'application/msword', // .doc
      'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
      'application/vnd.ms-powerpoint' // .ppt
    ];

    if (!allowedTypes.includes(selectedFile.type)) {
      toast({
        title: 'Invalid file type',
        description: 'Please upload a PDF, Word document (.doc/.docx), or PowerPoint presentation (.ppt/.pptx)',
        variant: 'destructive',
      });
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
      displayMessage = 'Uploading your PDF...';
    } else if (message.includes('Preparing') || message.includes('Reading') || message.includes('processed')) {
      step = 2;
      displayMessage = 'Analyzing document content...';
    } else if (message.includes('Creating') || message.includes('Setting up') || message.includes('questions')) {
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
    if (!file) return;

    setIsGenerating(true);
    setCurrentStep(0);
    setStepMessage('');
    // Reset the parent component's quiz state to show loading
    onQuizGenerated({ title: 'Generating Quiz...', questions: [] });

    try {
      const response = await generateQuiz(file, settings);

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
            const jsonString = line.substring(6).trim();
            
            // Special case for the end of stream marker
            if (jsonString === '[DONE]') {
              continue; // Skip this line, it's just signaling the end of the stream
            }
            
            // Skip empty lines or non-JSON content
            if (!jsonString || !jsonString.startsWith('{')) {
              continue;
            }
            
            try {
              const data = JSON.parse(jsonString);
              
              if (data.type === 'info' && data.message) {
                // Update progress based on the API message
                updateProgress(data.message);
              }
              
              if (data.type === 'final' && data.quiz) {
                // Show finalizing step before displaying quiz
                showFinalizingStep();
                
                // Add a short delay to show the finalizing step
                await new Promise(resolve => setTimeout(resolve, 800));
                
                finalQuiz = {
                  title: data.quiz.title || file.name.replace('.pdf', ''),
                  questions: data.quiz.questions || []
                };
              }
              
              // You can handle other event types here if needed
              // e.g., data.type === 'info', data.type === 'delta', etc.
            } catch (parseErr) {
              // Skip malformed JSON lines silently - this is normal in streaming
              console.debug('Skipping non-JSON line:', jsonString.substring(0, 50) + '...');
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
    }
  };

  return (
    <div className="bg-white shadow-lg rounded-lg p-4 sm:p-6 border border-gray-200 h-full">
      <h2 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6 text-gray-900">Generate Your Quiz!</h2>
      <p className="mb-4 sm:mb-6 text-gray-600 text-sm sm:text-base">
        Transform your learning materials into practice questions. Give it a try.
      </p>
      
      {/* File Upload */}
      <form onSubmit={handleSubmit} className="mb-4 sm:mb-6">
        <div className="mb-4">
          <Label htmlFor="file-upload" className="text-sm sm:text-base text-gray-900">Drop files here to upload</Label>
          <Input id="file-upload" type="file" accept=".pdf,.doc,.docx,.ppt,.pptx" onChange={handleFileChange} className="mt-1" />
          <p className="text-xs text-gray-500 mt-1">Supported: PDF, Word, PowerPoint</p>
        </div>
        
        <Button
          type="submit"
          disabled={!file || isGenerating}
          className="w-full"
        >
          {isGenerating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Generating...
            </>
          ) : (
            'Generate Quiz'
          )}
        </Button>
      </form>

      {/* Progress Display */}
      {isGenerating && currentStep > 0 && (
        <div className="mb-4 sm:mb-6">
          <div className={`p-4 rounded-lg border ${
            currentStep === 3 
              ? 'bg-green-50 border-green-200' 
              : 'bg-blue-50 border-blue-200'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <div className={`text-sm font-medium ${
                currentStep === 3 ? 'text-green-900' : 'text-blue-900'
              }`}>
                Step {currentStep} of 4
              </div>
              <div className={`text-xs ${
                currentStep === 3 ? 'text-green-600' : 'text-blue-600'
              }`}>
                {Math.round((currentStep / 4) * 100)}% Complete
              </div>
            </div>
            <div className={`text-sm ${
              currentStep === 3 ? 'text-green-800' : 'text-blue-800'
            }`}>
              {stepMessage}
            </div>
            
            {/* Progress Bar */}
            <div className="mt-3">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full transition-all duration-500 ease-out ${
                    currentStep === 3 ? 'bg-green-500' : 'bg-blue-500'
                  }`}
                  style={{ width: `${(currentStep / 4) * 100}%` }}
                ></div>
              </div>
            </div>
          </div>
          <div className="text-xs text-gray-500 italic mt-2">
            Please wait while we process your PDF and generate questions...
          </div>
        </div>
      )}

      {/* Call-to-Action Section - Only shown after quiz generation */}
      {quizGenerated && (
        <div className="mt-4 sm:mt-6 bg-gray-50 rounded-lg p-3 sm:p-4 text-sm sm:text-base">
          <div className="text-center py-2 sm:py-3">
            <p className="mb-4 text-gray-600 text-sm sm:text-base">
              Want to create more comprehensive quizzes with customizable settings?
            </p>
            <Link href="/auth/sign-up">
              <Button>Sign Up for Free</Button>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
} 