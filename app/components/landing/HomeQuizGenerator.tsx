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

export function HomeQuizGenerator({ onQuizGenerated }: { onQuizGenerated: (quiz: any) => void }) {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [quizGenerated, setQuizGenerated] = useState(false);

  // Fixed settings for the demo
  const settings: QuizSettings = {
    numberOfQuestions: 3,
    difficulty: 'medium',
    questionType: 'multiple_choice',
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (selectedFile.type !== 'application/pdf') {
      toast({
        title: 'Invalid file type',
        description: 'Please upload a PDF file',
        variant: 'destructive',
      });
      return;
    }

    setFile(selectedFile);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setIsGenerating(true);
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
            // Special case for the end of stream marker
            if (line === 'data: [DONE]') {
              continue; // Skip this line, it's just signaling the end of the stream
            }
            
            try {
              const data = JSON.parse(line.substring(6));
              
              if (data.type === 'final' && data.quiz) {
                finalQuiz = {
                  title: data.quiz.title || file.name.replace('.pdf', ''),
                  questions: data.quiz.questions || []
                };
              }
              
              // You can handle other event types here if needed
              // e.g., data.type === 'info', data.type === 'delta', etc.
            } catch (parseErr) {
              console.error('Error parsing SSE data:', parseErr);
              // Skip this line if it's not valid JSON
            }
          }
        }
      }

      if (finalQuiz) {
        setQuizGenerated(true);
        // Update the parent component with the generated quiz
        onQuizGenerated(finalQuiz);
        
        toast({
          title: 'Quiz Generated',
          description: 'Your quiz has been generated successfully. Sign up to view more!',
        });
      } else {
        throw new Error('No quiz data received from the server');
      }
    } catch (err: any) {
      console.error('Error generating quiz:', err);
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
          <Label htmlFor="pdf-upload" className="text-sm sm:text-base text-gray-900">Drop files here to upload</Label>
          <Input id="pdf-upload" type="file" accept=".pdf" onChange={handleFileChange} className="mt-1" />
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