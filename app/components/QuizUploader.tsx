'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Slider } from '@/app/components/ui/slider';
import { RadioGroup, RadioGroupItem } from '@/app/components/ui/radio-group';
import { useToast } from '@/app/components/ui/use-toast';
import { QuizSettings, Question } from '@/lib/types';
import { Loader2 } from 'lucide-react';
import { useSubscription } from '@/hooks/useSubscription';
import { useAuth } from '@/app/providers/AuthProvider';
import { generateQuiz } from '@/utils/api-client';

interface QuizUploaderProps {
  onQuizGenerated?: (quiz: any) => void;
  initialQuiz?: {
    title: string;
    questions: Question[];
  };
  onSaveComplete?: () => void;
}

export default function QuizUploader({ onQuizGenerated, initialQuiz, onSaveComplete }: QuizUploaderProps) {
  const [supabase, setSupabase] = useState<any>(null);
  const { toast } = useToast();
  const { isOnPlan } = useSubscription();
  const { user } = useAuth();
  const isPremium = isOnPlan('premium');
  const maxQuestions = isPremium ? 30 : 10;
  
  const [file, setFile] = useState<File | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [streamingResponse, setStreamingResponse] = useState('');
  const [generatedQuiz, setGeneratedQuiz] = useState<{
    title: string;
    questions: Question[];
  } | null>(null);

  const [settings, setSettings] = useState<QuizSettings>({
    numberOfQuestions: Math.min(5, maxQuestions),
    difficulty: 'medium',
    questionType: 'multiple_choice',
  });

  useEffect(() => {
    const initSupabase = async () => {
      const client = await createClient();
      setSupabase(client);
    };
    
    initSupabase();
  }, []);

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
    // optional: check size <= 25MB

    setFile(selectedFile);
    setGeneratedQuiz(null);
  };

  const formatQuizContent = (quiz: { title: string; questions: any[] }) => {
    return (
      <div>
        <h2 className="text-xl font-bold mb-4">{quiz.title}</h2>
        {quiz.questions.map((q, i) => (
          <div key={i} className="mb-6">
            <div className="font-medium">
              {i + 1}. {q.text}
            </div>
            {q.type === 'multiple_choice' && q.options && (
              <ul className="mt-2 space-y-1">
                {q.options.map((opt: string, idx: number) => (
                  <li key={idx} className="flex items-center">
                    <span className={`${opt === q.correctAnswer ? 'bg-green-100 dark:bg-green-900/30 px-2 py-1 rounded-md' : ''}`}>
                      • {opt}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {q.correctAnswer && q.type !== 'multiple_choice' && (
              <div className="mt-2 text-sm">
                <strong>Answer: </strong>
                <span className="bg-green-100 dark:bg-green-900/30 px-2 py-1 rounded-md">
                  {q.correctAnswer}
                </span>
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  const saveQuizToSupabase = async (quiz: any) => {
    if (!supabase) {
      console.error('Supabase client not initialized');
      toast({
        title: 'Error',
        description: 'Could not connect to the database. Please try again.',
        variant: 'destructive',
      });
      return;
    }

    try {
      if (!user) {
        console.error('No authenticated user found');
        toast({
          title: 'Authentication Error',
          description: 'Please sign in again to save your quiz.',
          variant: 'destructive',
        });
        return;
      }

      const { error: dbError } = await supabase
        .from('quizzes')
        .insert({
          title: quiz.title,
          questions: quiz.questions,
          settings,
          pdf_url: '',
          user_id: user.id
        });

      if (dbError) {
        console.error('Error saving quiz:', dbError);
        
        // Check if the error is related to the quiz limit
        if (dbError.message && dbError.message.includes('monthly quiz limit')) {
          toast({
            title: 'Monthly Quiz Limit Reached',
            description: 'You have reached your monthly quiz limit. Upgrade to Premium for unlimited quizzes.',
            variant: 'destructive',
            duration: 10000, // Show for 10 seconds
          });
          
          // We'll use a custom dialog instead of window.confirm
          // to avoid blocking the UI
          const upgradeDialog = document.createElement('div');
          upgradeDialog.id = 'quiz-limit-dialog'; // Add ID to check if it already exists
          
          // Only show the dialog if it doesn't already exist
          if (!document.getElementById('quiz-limit-dialog')) {
            upgradeDialog.className = 'fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-50';
            upgradeDialog.innerHTML = `
              <div class="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg max-w-md w-full">
                <h3 class="text-lg font-medium mb-4">Quiz Limit Reached</h3>
                <div class="mb-6">You have reached your monthly quiz limit. Would you like to upgrade to Premium for unlimited quizzes?</div>
                <div class="flex justify-end space-x-4">
                  <button id="cancel-upgrade" class="px-4 py-2 border rounded-md">Cancel</button>
                  <button id="confirm-upgrade" class="px-4 py-2 bg-blue-600 text-white rounded-md">OK</button>
                </div>
              </div>
            `;
            
            document.body.appendChild(upgradeDialog);
            
            document.getElementById('confirm-upgrade')?.addEventListener('click', () => {
              window.location.href = '/dashboard/subscription';
              document.body.removeChild(upgradeDialog);
            });
            
            document.getElementById('cancel-upgrade')?.addEventListener('click', () => {
              document.body.removeChild(upgradeDialog);
            });
          }
        } 
        // Check if the error is related to the question count limit
        else if (dbError.message && dbError.message.includes('up to 10 questions')) {
          toast({
            title: 'Question Limit Reached',
            description: 'Free users can only create quizzes with up to 10 questions. Upgrade to Premium for larger quizzes.',
            variant: 'destructive',
            duration: 10000, // Show for 10 seconds
          });
          
          // We'll use a custom dialog instead of window.confirm
          // to avoid blocking the UI
          const upgradeDialog = document.createElement('div');
          upgradeDialog.id = 'question-limit-dialog'; // Add ID to check if it already exists
          
          // Only show the dialog if it doesn't already exist
          if (!document.getElementById('question-limit-dialog')) {
            upgradeDialog.className = 'fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-50';
            upgradeDialog.innerHTML = `
              <div class="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg max-w-md w-full">
                <h3 class="text-lg font-medium mb-4">Question Limit Reached</h3>
                <div class="mb-6">Free users can only create quizzes with up to 10 questions. Would you like to upgrade to Premium for larger quizzes?</div>
                <div class="flex justify-end space-x-4">
                  <button id="cancel-upgrade" class="px-4 py-2 border rounded-md">Cancel</button>
                  <button id="confirm-upgrade" class="px-4 py-2 bg-blue-600 text-white rounded-md">OK</button>
                </div>
              </div>
            `;
            
            document.body.appendChild(upgradeDialog);
            
            document.getElementById('confirm-upgrade')?.addEventListener('click', () => {
              window.location.href = '/dashboard/subscription';
              document.body.removeChild(upgradeDialog);
            });
            
            document.getElementById('cancel-upgrade')?.addEventListener('click', () => {
              document.body.removeChild(upgradeDialog);
            });
          }
        } 
        else {
          toast({
            title: 'Warning',
            description: 'Quiz generated but failed to save to database: ' + dbError.message,
            variant: 'destructive',
          });
        }
      } else {
        toast({
          title: 'Success',
          description: 'Quiz generated and saved successfully',
        });
      }
    } catch (error) {
      console.error('Error saving quiz:', error);
      toast({
        title: 'Warning',
        description: 'Quiz generated but failed to save to database',
        variant: 'destructive',
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!file) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please upload a PDF file"
      });
      return;
    }

    setIsGenerating(true);
    
    // Notify parent component that generation has started
    if (onQuizGenerated) {
      onQuizGenerated({ loading: true });
    }

    try {
      const response = await generateQuiz(file, settings);

      if (!response.body) {
        throw new Error('ReadableStream not supported in this environment.');
      }

      const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();

      let finalQuiz: { title: string; questions: Question[] } | null = null;
      let done = false;
      let accumulatedContent = '';
      let currentQuiz: { title: string; questions: Question[] } = { 
        title: 'Generating Quiz...', 
        questions: [] 
      };

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        if (readerDone) {
          done = true;
          break;
        }

        const chunkText = value;
        const lines = chunkText.split('\n');

        for (const line of lines) {
          if (line.startsWith('data:')) {
            const jsonString = line.replace(/^data:\s*/, '').trim();

            if (jsonString === '[DONE]') {
              done = true;
              break;
            }

            try {
              const parsed = JSON.parse(jsonString);

              if (parsed.type === 'delta') {
                // Accumulate content
                accumulatedContent += parsed.chunk;
                
                // Try to extract any complete questions from the accumulated content
                try {
                  // Look for complete question objects in the accumulated content
                  const questionMatch = accumulatedContent.match(/\{[^{]*"text"[^}]*\}/g);
                  if (questionMatch) {
                    const questions = questionMatch.map(q => {
                      try {
                        return JSON.parse(q);
                      } catch {
                        return null;
                      }
                    }).filter(q => q !== null);

                    if (questions.length > 0) {
                      // Process each question to ensure it has the necessary properties
                      const processedQuestions = questions.map(q => {
                        // If this is a multiple choice question and it has options
                        if (q.type === 'multiple_choice' && q.options) {
                          // Make sure options is an array
                          const options = Array.isArray(q.options) ? q.options : [];
                          return { ...q, options };
                        }
                        return q;
                      });
                      
                      // Update the current quiz with the processed questions
                      currentQuiz.questions = processedQuestions;
                      setStreamingResponse(JSON.stringify(currentQuiz));
                      
                      // Update parent component with partial results
                      if (onQuizGenerated) {
                        onQuizGenerated(currentQuiz);
                      }
                    }
                  }

                  // Look for title if not already set
                  const titleMatch = accumulatedContent.match(/"title"\s*:\s*"([^"]*)"/);
                  if (titleMatch && titleMatch[1]) {
                    currentQuiz.title = titleMatch[1];
                    setStreamingResponse(JSON.stringify(currentQuiz));
                    
                    // Update parent with title
                    if (onQuizGenerated) {
                      onQuizGenerated(currentQuiz);
                    }
                  }
                } catch {
                  // If we can't parse it yet, just continue accumulating
                }
              } else if (parsed.type === 'error') {
                setStreamingResponse(JSON.stringify({ 
                  title: 'Error', 
                  questions: [{ text: parsed.message, type: 'error' }] 
                }));
                
                // Notify parent of error
                if (onQuizGenerated) {
                  onQuizGenerated({ 
                    title: 'Error', 
                    questions: [{ text: parsed.message, type: 'error' }] 
                  });
                }
                
                // Check if the error is related to the quiz limit
                if (parsed.message && parsed.message.includes('monthly quiz limit')) {
                  toast({
                    title: 'Monthly Quiz Limit Reached',
                    description: 'You have reached your monthly quiz limit. Upgrade to Premium for unlimited quizzes.',
                    variant: 'destructive',
                    duration: 10000, // Show for 10 seconds
                  });
                  
                  // We'll use a custom dialog instead of window.confirm
                  // to avoid blocking the UI
                  const upgradeDialog = document.createElement('div');
                  upgradeDialog.className = 'fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-50';
                  upgradeDialog.innerHTML = `
                    <div class="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg max-w-md w-full">
                      <h3 class="text-lg font-medium mb-4">Quiz Limit Reached</h3>
                      <div class="mb-6">You have reached your monthly quiz limit. Would you like to upgrade to Premium for unlimited quizzes?</div>
                      <div class="flex justify-end space-x-4">
                        <button id="cancel-upgrade" class="px-4 py-2 border rounded-md">Cancel</button>
                        <button id="confirm-upgrade" class="px-4 py-2 bg-blue-600 text-white rounded-md">OK</button>
                      </div>
                    </div>
                  `;
                  
                  document.body.appendChild(upgradeDialog);
                  
                  document.getElementById('confirm-upgrade')?.addEventListener('click', () => {
                    window.location.href = '/dashboard/subscription';
                    document.body.removeChild(upgradeDialog);
                  });
                  
                  document.getElementById('cancel-upgrade')?.addEventListener('click', () => {
                    document.body.removeChild(upgradeDialog);
                  });
                } 
                // Check if the error is related to the question count limit
                else if (parsed.message && parsed.message.includes('up to 10 questions')) {
                  toast({
                    title: 'Question Limit Reached',
                    description: 'Free users can only create quizzes with up to 10 questions. Upgrade to Premium for larger quizzes.',
                    variant: 'destructive',
                    duration: 10000, // Show for 10 seconds
                  });
                  
                  // We'll use a custom dialog instead of window.confirm
                  // to avoid blocking the UI
                  const upgradeDialog = document.createElement('div');
                  upgradeDialog.className = 'fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-50';
                  upgradeDialog.innerHTML = `
                    <div class="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg max-w-md w-full">
                      <h3 class="text-lg font-medium mb-4">Question Limit Reached</h3>
                      <div class="mb-6">Free users can only create quizzes with up to 10 questions. Would you like to upgrade to Premium for larger quizzes?</div>
                      <div class="flex justify-end space-x-4">
                        <button id="cancel-upgrade" class="px-4 py-2 border rounded-md">Cancel</button>
                        <button id="confirm-upgrade" class="px-4 py-2 bg-blue-600 text-white rounded-md">OK</button>
                      </div>
                    </div>
                  `;
                  
                  document.body.appendChild(upgradeDialog);
                  
                  document.getElementById('confirm-upgrade')?.addEventListener('click', () => {
                    window.location.href = '/dashboard/subscription';
                    document.body.removeChild(upgradeDialog);
                  });
                  
                  document.getElementById('cancel-upgrade')?.addEventListener('click', () => {
                    document.body.removeChild(upgradeDialog);
                  });
                }
              } else if (parsed.type === 'final') {
                finalQuiz = parsed.quiz;
                setStreamingResponse(JSON.stringify(parsed.quiz));
                
                // Update parent with final quiz
                if (onQuizGenerated) {
                  onQuizGenerated(parsed.quiz);
                }
                
                // Save the quiz to Supabase if user is authenticated
                if (user) {
                  await saveQuizToSupabase(parsed.quiz);
                } else {
                  toast({
                    title: 'Not Signed In',
                    description: 'Sign in to save your quizzes and track your progress.',
                    variant: 'default',
                    duration: 5000,
                  });
                }
              }
            } catch (err) {
              console.error('Failed to parse SSE chunk:', err);
            }
          }
        }
      }
      reader.releaseLock();

      if (finalQuiz) {
        toast({
          title: 'Quiz Generated',
          description: `Title: ${finalQuiz.title}`,
        });
      }
    } catch (err: any) {
      console.error('Error generating quiz:', err);
      toast({
        title: 'Error',
        description: err.message,
        variant: 'destructive',
      });
      
      // Notify parent of error
      if (onQuizGenerated) {
        onQuizGenerated({ 
          title: 'Error', 
          questions: [{ text: err.message, type: 'error' }] 
        });
      }
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* File Upload */}
      <div>
        <Label htmlFor="pdf-upload" className="block mb-2">Upload PDF</Label>
        <Input
          id="pdf-upload"
          type="file"
          accept=".pdf"
          onChange={handleFileChange}
          className="cursor-pointer"
        />
      </div>

      {/* Quiz Settings */}
      <div className="grid grid-cols-1 gap-6">
        {/* Number of Questions */}
        <div>
          <div className="flex justify-between mb-2">
            <Label>Number of Questions</Label>
            <span className="text-sm text-gray-500">
              {settings.numberOfQuestions} questions
              {!isPremium && (
                <span className="ml-1 text-xs text-amber-500">
                  (Max {maxQuestions} for free users)
                </span>
              )}
            </span>
          </div>
          <Slider
            value={[settings.numberOfQuestions]}
            min={1}
            max={maxQuestions}
            step={1}
            onValueChange={(value) => setSettings({ ...settings, numberOfQuestions: value[0] })}
          />
        </div>

        {/* Difficulty Level */}
        <div>
          <Label className="block mb-2">Difficulty Level</Label>
          <RadioGroup
            value={settings.difficulty}
            onValueChange={(value) => setSettings({ ...settings, difficulty: value as 'easy' | 'medium' | 'hard' })}
            className="flex flex-col space-y-1"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="easy" id="easy" />
              <Label htmlFor="easy">Easy</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="medium" id="medium" />
              <Label htmlFor="medium">Medium</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="hard" id="hard" />
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
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="multiple_choice" id="multiple_choice" />
              <Label htmlFor="multiple_choice">Multiple Choice</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="open_ended" id="open_ended" />
              <Label htmlFor="open_ended">Open Ended</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="mixed" id="mixed" />
              <Label htmlFor="mixed">Mixed</Label>
            </div>
          </RadioGroup>
        </div>
      </div>

      {/* Generate Button */}
      <div className="pt-2">
        <Button 
          type="submit" 
          className="w-full"
          disabled={!file || isGenerating}
          onClick={handleSubmit}
        >
          {isGenerating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Generating Quiz...
            </>
          ) : 'Generate Quiz'}
        </Button>
      </div>

      {/* We don't need to show the streaming response here anymore since it will be shown in the preview panel */}
      {!onQuizGenerated && streamingResponse && (
        <div className="mt-4 p-4 bg-gray-50 rounded-lg dark:bg-gray-700">
          {(() => {
            try {
              const parsed = JSON.parse(streamingResponse);
              setGeneratedQuiz(parsed);
              return formatQuizContent(parsed);
            } catch (e) {
              return <div>Processing...</div>;
            }
          })()}
        </div>
      )}
    </div>
  );
}
