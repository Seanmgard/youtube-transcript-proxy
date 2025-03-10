'use client';

import React, { useState, useRef, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/components/ui/use-toast';
import { QuizSettings, Question } from '@/lib/types';

export default function QuizUploader() {
  const [supabase, setSupabase] = useState<any>(null);
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [streamingResponse, setStreamingResponse] = useState('');
  const [rawStreamingText, setRawStreamingText] = useState('');
  const [showRawStream, setShowRawStream] = useState(true);
  const [generatedQuiz, setGeneratedQuiz] = useState<{
    title: string;
    questions: Question[];
  } | null>(null);
  const streamEndRef = useRef<HTMLDivElement>(null);

  const [settings, setSettings] = useState<QuizSettings>({
    numberOfQuestions: 5,
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

  // Auto-scroll to bottom of streaming text
  useEffect(() => {
    if (streamEndRef.current && showRawStream) {
      streamEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [rawStreamingText, showRawStream]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setIsGenerating(true);
    setStreamingResponse('');
    setRawStreamingText('');
    setShowRawStream(true);
    setGeneratedQuiz(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('settings', JSON.stringify(settings));

      const response = await fetch('/api/generate-quiz', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to generate quiz');
      }

      if (!response.body) {
        throw new Error('ReadableStream not supported in this environment.');
      }

      const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();

      let finalQuiz: { title: string; questions: Question[] } | null = null;
      let done = false;
      let accumulatedContent = '';
      
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

              if (parsed.type === 'info') {
                // Display info messages to the user
                toast({
                  title: 'Info',
                  description: parsed.message,
                });
                // Add info messages to raw stream
                setRawStreamingText(prev => prev + `\n[Info] ${parsed.message}\n`);
              } else if (parsed.type === 'delta') {
                // Accumulate content for JSON parsing
                accumulatedContent += parsed.chunk;
                
                // Update raw streaming text for ChatGPT-like experience
                setRawStreamingText(prev => prev + parsed.chunk);
                
                // Don't try to parse JSON until we get the final result
                // This ensures we show the raw streaming text as it comes in
              } else if (parsed.type === 'error') {
                setRawStreamingText(prev => prev + `\n[Error] ${parsed.message}\n`);
                setStreamingResponse(JSON.stringify({ 
                  title: 'Error', 
                  questions: [{ text: parsed.message, type: 'error' }] 
                }));
              } else if (parsed.type === 'warning') {
                setRawStreamingText(prev => prev + `\n[Warning] ${parsed.message}\n`);
              } else if (parsed.type === 'final') {
                // We've received the final, properly formatted quiz
                // Switch from raw stream to formatted output
                finalQuiz = parsed.quiz;
                setStreamingResponse(JSON.stringify(parsed.quiz));
                setShowRawStream(false);
                
                // Save the quiz to Supabase
                try {
                  if (!supabase) {
                    throw new Error('Supabase client not initialized');
                  }
                  
                  const { data: { user } } = await supabase.auth.getUser();
                  if (!user) {
                    throw new Error('User not authenticated');
                  }

                  const { error: dbError } = await supabase
                    .from('quizzes')
                    .insert({
                      title: parsed.quiz.title,
                      questions: parsed.quiz.questions,
                      settings,
                      pdf_url: '',
                      user_id: user.id
                    });

                  if (dbError) {
                    console.error('Error saving quiz:', dbError);
                    toast({
                      title: 'Warning',
                      description: 'Quiz generated but failed to save to database: ' + dbError.message,
                      variant: 'destructive',
                    });
                  } else {
                    toast({
                      title: 'Success',
                      description: 'Quiz generated and saved successfully',
                    });
                  }
                } catch (dbError) {
                  console.error('Error saving quiz:', dbError);
                  toast({
                    title: 'Warning',
                    description: 'Quiz generated but failed to save to database',
                    variant: 'destructive',
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
      } else if (accumulatedContent) {
        // If we didn't get a final quiz but have accumulated content,
        // try to parse it as a fallback
        try {
          // Clean the accumulated content to try to make it valid JSON
          let cleanedContent = accumulatedContent.trim();
          
          // Remove any markdown code block indicators
          cleanedContent = cleanedContent.replace(/```json\s*/g, '').replace(/```\s*/g, '');
          
          // Try to find a complete JSON object
          const jsonMatch = cleanedContent.match(/(\{[\s\S]*\})/);
          if (jsonMatch && jsonMatch[1]) {
            const parsedQuiz = JSON.parse(jsonMatch[1]);
            setStreamingResponse(JSON.stringify(parsedQuiz));
            setShowRawStream(false);
          }
        } catch (err) {
          console.error('Failed to parse accumulated content:', err);
        }
      }
    } catch (err: any) {
      console.error('Error generating quiz:', err);
      toast({
        title: 'Error',
        description: err.message,
        variant: 'destructive',
      });
      setShowRawStream(false);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Settings Form */}
      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* File Upload */}
        <div className="md:col-span-4">
          <Label htmlFor="pdf-upload">Upload PDF</Label>
          <Input id="pdf-upload" type="file" accept=".pdf" onChange={handleFileChange} className="mt-1" />
        </div>

        {/* Number of Questions */}
        <div>
          <Label>Number of Questions</Label>
          <Slider
            value={[settings.numberOfQuestions]}
            onValueChange={(value) => {
              // Ensure the value is properly set and capped at the maximum
              const numQuestions = Math.max(1, Math.min(30, value[0]));
              setSettings({ ...settings, numberOfQuestions: numQuestions });
            }}
            min={1}
            max={30}
            step={1}
            className="mt-2"
          />
          <p className="text-sm text-gray-500 mt-1">
            {settings.numberOfQuestions} questions
          </p>
        </div>

        {/* Difficulty Level */}
        <div>
          <Label>Difficulty Level</Label>
          <RadioGroup
            value={settings.difficulty}
            onValueChange={(val: 'easy' | 'medium' | 'hard') =>
              setSettings({ ...settings, difficulty: val })
            }
            className="mt-2 space-y-1"
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
          <Label>Question Type</Label>
          <RadioGroup
            value={settings.questionType}
            onValueChange={(val: 'multiple_choice' | 'open_ended' | 'mixed') =>
              setSettings({ ...settings, questionType: val })
            }
            className="mt-2 space-y-1"
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

        {/* Generate Button */}
        <div className="md:col-span-1 flex items-end">
          <Button
            type="submit"
            disabled={!file || isGenerating}
            className="w-full"
          >
            {isGenerating ? 'Generating...' : 'Generate Quiz'}
          </Button>
        </div>
      </form>

      {/* Quiz Preview */}
      <div className="mt-8 bg-gray-50 dark:bg-gray-700 rounded-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Quiz Preview</h3>
          {isGenerating && streamingResponse && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setShowRawStream(!showRawStream)}
              className="text-xs"
            >
              {showRawStream ? 'Show Formatted' : 'Show Raw Stream'}
            </Button>
          )}
        </div>
        
        {!isGenerating && !streamingResponse ? (
          <div className="text-center py-8">
            <h4 className="text-xl font-semibold mb-2">Awaiting Instructions</h4>
            <p className="text-gray-600 dark:text-gray-400">
              We are ready to produce your practice questions
            </p>
          </div>
        ) : isGenerating && showRawStream ? (
          <div className="bg-gray-900 text-green-400 p-4 rounded-md font-mono text-sm overflow-auto max-h-[500px]">
            <pre className="whitespace-pre-wrap">{rawStreamingText || 'Waiting for response...'}</pre>
            <div ref={streamEndRef} />
          </div>
        ) : streamingResponse ? (
          (() => {
            try {
              const parsed = JSON.parse(streamingResponse);
              return formatQuizContent(parsed);
            } catch {
              return (
                <div className="animate-pulse flex space-x-4">
                  <div className="flex-1 space-y-4 py-1">
                    <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                    <div className="space-y-2">
                      <div className="h-4 bg-gray-200 rounded"></div>
                      <div className="h-4 bg-gray-200 rounded w-5/6"></div>
                    </div>
                  </div>
                </div>
              );
            }
          })()
        ) : (
          <div className="text-center py-8">
            <div className="animate-spin h-8 w-8 border-4 border-indigo-500 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">
              Generating quiz...
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
