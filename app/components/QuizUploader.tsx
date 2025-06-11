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
  onStreamingUpdate?: (text: string) => void;
  initialQuiz?: {
    title: string;
    questions: Question[];
  };
  onSaveComplete?: () => void;
}

interface CurrentQuiz {
  title: string;
  questions: Question[];
}

export default function QuizUploader({ onQuizGenerated, onStreamingUpdate, initialQuiz, onSaveComplete }: QuizUploaderProps) {
  const [supabase, setSupabase] = useState<any>(null);
  const { toast } = useToast();
  const { isOnPlan } = useSubscription();
  const { user } = useAuth();
  const isPremium = isOnPlan('premium');
  const maxQuestions = isPremium ? 50 : 10;
  
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
    isLanguageLearning: false,
    sourceLanguage: '',
    targetLanguage: '',
    extractionType: 'words'
  });

  // Add state for available languages
  const availableLanguages = [
    { code: 'en', name: 'English' },
    { code: 'es', name: 'Spanish' },
    { code: 'fr', name: 'French' },
    { code: 'de', name: 'German' },
    { code: 'it', name: 'Italian' },
    { code: 'pt', name: 'Portuguese' },
    { code: 'ru', name: 'Russian' },
    { code: 'zh', name: 'Chinese' },
    { code: 'ja', name: 'Japanese' },
    { code: 'ko', name: 'Korean' }
  ];

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
                    <span className={`${opt === q.correctAnswer ? 'bg-green-100 dark:bg-green-900/30 px-2 py-1 rounded-md w-full' : ''}`}>
                      {String.fromCharCode(97 + idx)}. {opt}
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

  // Create a Web Worker to handle the quiz generation in the background
  const createQuizWorker = () => {
    const workerCode = `
      self.onmessage = async function(e) {
        const { file, settings, baseUrl } = e.data;
        
        try {
          const formData = new FormData();
          formData.append('file', file);
          formData.append('settings', JSON.stringify(settings));
          
          const response = await fetch(baseUrl + '/api/generate-quiz', {
            method: 'POST',
            body: formData
          });

          if (!response.body) {
            throw new Error('ReadableStream not supported');
          }

          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            
            const chunk = decoder.decode(value);
            self.postMessage({ type: 'chunk', data: chunk });
          }
          
          self.postMessage({ type: 'done' });
        } catch (error) {
          self.postMessage({ type: 'error', error: error.message });
        }
      };
    `;

    const blob = new Blob([workerCode], { type: 'application/javascript' });
    return new Worker(URL.createObjectURL(blob));
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
    
    // Clear any previous streaming text
    if (onStreamingUpdate) {
      onStreamingUpdate('');
    }
    
    if (onQuizGenerated) {
      onQuizGenerated({ loading: true });
    }

    const timeoutId = setTimeout(() => {
      if (isGenerating) {
        setIsGenerating(false);
        toast({
          title: 'Generation Timeout',
          description: 'Quiz generation is taking longer than expected. Please try again.',
          variant: 'destructive',
        });
        
        if (onQuizGenerated) {
          onQuizGenerated({ 
            title: 'Error', 
            questions: [{ 
              text: 'Quiz generation timed out. Please try again.',
              type: 'error',
              correctAnswer: ''
            }] 
          });
        }
      }
    }, 120000);

    try {
      const worker = createQuizWorker();
      let lastInfoMessage = '';

      worker.onmessage = async (e) => {
        if (e.data.type === 'error') {
          console.error('Worker error:', e.data.error);
          setIsGenerating(false);
          clearTimeout(timeoutId);
          toast({
            title: 'Error',
            description: e.data.error,
            variant: 'destructive',
          });
          worker.terminate();
          return;
        }

        if (e.data.type === 'chunk') {
          const lines = e.data.data.split('\n');
          
          for (const line of lines) {
            if (line.startsWith('data:')) {
              const jsonString = line.replace(/^data:\s*/, '').trim();
              
              if (jsonString === '[DONE]') {
                setIsGenerating(false);
                clearTimeout(timeoutId);
                worker.terminate();
                return;
              }
              
              try {
                const parsed = JSON.parse(jsonString);
                
                if (parsed.type === 'info') {
                  // Show progress updates to user
                  lastInfoMessage = parsed.message;
                  if (onStreamingUpdate) {
                    onStreamingUpdate(parsed.message);
                  }
                } else if (parsed.type === 'progress') {
                  // Show question generation progress
                  if (onStreamingUpdate) {
                    onStreamingUpdate(parsed.message);
                  }
                } else if (parsed.type === 'warning') {
                  // Show warning messages
                  if (onStreamingUpdate) {
                    onStreamingUpdate(parsed.message);
                  }
                } else if (parsed.type === 'final') {
                  const finalQuiz = parsed.quiz as CurrentQuiz;
                  setStreamingResponse(JSON.stringify(finalQuiz));
                  setGeneratedQuiz(finalQuiz);
                  
                  // Clear streaming text when final quiz is ready
                  if (onStreamingUpdate) {
                    onStreamingUpdate('');
                  }
                  
                  if (onQuizGenerated) {
                    onQuizGenerated(finalQuiz);
                  }

                  if (user) {
                    await saveQuizToSupabase(finalQuiz);
                  }

                  toast({
                    title: 'Success',
                    description: `Quiz "${finalQuiz.title}" generated successfully`,
                  });
                }
              } catch (err) {
                console.warn('Failed to parse chunk:', err);
              }
            }
          }
        }

        if (e.data.type === 'done') {
          setIsGenerating(false);
          clearTimeout(timeoutId);
          worker.terminate();
        }
      };

      // Get the base URL for API requests
      const baseUrl = window.location.origin;

      // Start the worker with the base URL
      worker.postMessage({ file, settings, baseUrl });

      // Add a visibilitychange listener just to show the user it's still working
      const visibilityHandler = () => {
        if (document.visibilityState === 'visible' && isGenerating) {
          toast({
            title: 'Still Working',
            description: 'Quiz generation is continuing in the background.',
            variant: 'default',
          });
        }
      };
      
      document.addEventListener('visibilitychange', visibilityHandler);
      
      // Clean up the visibility handler when done
      return () => {
        document.removeEventListener('visibilitychange', visibilityHandler);
      };

    } catch (err: any) {
      console.error('Error generating quiz:', err);
      setIsGenerating(false);
      clearTimeout(timeoutId);
      toast({
        title: 'Error',
        description: err.message,
        variant: 'destructive',
      });
      
      if (onQuizGenerated) {
        onQuizGenerated({ 
          title: 'Error', 
          questions: [{ 
            text: err.message,
            type: 'error',
            correctAnswer: ''
          }] 
        });
      }
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

      {/* Language Learning Toggle */}
      <div className="flex items-center space-x-2">
        <Label htmlFor="language-learning" className="cursor-pointer">Language Learning Mode</Label>
        <input
          type="checkbox"
          id="language-learning"
          checked={settings.isLanguageLearning}
          onChange={(e) => setSettings({ ...settings, isLanguageLearning: e.target.checked })}
          className="h-4 w-4 rounded border-gray-300"
        />
      </div>

      {/* Language Learning Settings */}
      {settings.isLanguageLearning && (
        <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
          {/* Source Language */}
          <div>
            <Label htmlFor="source-language">Document Language</Label>
            <select
              id="source-language"
              value={settings.sourceLanguage}
              onChange={(e) => setSettings({ ...settings, sourceLanguage: e.target.value })}
              className="w-full mt-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select language</option>
              {availableLanguages.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.name}
                </option>
              ))}
            </select>
          </div>

          {/* Target Language */}
          <div>
            <Label htmlFor="target-language">Translation Language</Label>
            <select
              id="target-language"
              value={settings.targetLanguage}
              onChange={(e) => setSettings({ ...settings, targetLanguage: e.target.value })}
              className="w-full mt-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select language</option>
              {availableLanguages.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.name}
                </option>
              ))}
            </select>
          </div>

          {/* Extraction Type */}
          <div>
            <Label className="block mb-2">Extract</Label>
            <RadioGroup
              value={settings.extractionType}
              onValueChange={(value) => setSettings({ ...settings, extractionType: value as 'words' | 'sentences' })}
              className="flex flex-col space-y-1"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="words" id="words" />
                <Label htmlFor="words">Individual Words</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="sentences" id="sentences" />
                <Label htmlFor="sentences">Full Sentences</Label>
              </div>
            </RadioGroup>
          </div>
        </div>
      )}

      {/* Number of Questions - Moved outside of quiz settings to be visible in both modes */}
      <div>
        <div className="flex justify-between mb-2">
          <Label>Number of {settings.isLanguageLearning ? 'Flashcards' : 'Questions'}</Label>
          <span className="text-sm text-gray-500">
            {settings.numberOfQuestions} {settings.isLanguageLearning ? 'flashcards' : 'questions'}
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

      {/* Quiz Settings */}
      {!settings.isLanguageLearning && (
        <div className="grid grid-cols-1 gap-6">
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
      )}

      <div className="pt-2">
        <Button 
          type="submit" 
          className="w-full"
          disabled={!file || isGenerating || (settings.isLanguageLearning && (!settings.sourceLanguage || !settings.targetLanguage))}
          onClick={handleSubmit}
        >
          {isGenerating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Generating {settings.isLanguageLearning ? 'Flashcards' : 'Quiz'}...
            </>
          ) : `Generate ${settings.isLanguageLearning ? 'Flashcards' : 'Quiz'}`}
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
