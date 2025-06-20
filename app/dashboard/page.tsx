'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/providers/AuthProvider';
import { useSupabase } from '@/utils/supabase/client';
import QuizUploader from '@/app/components/QuizUploader';
import QuizHistory from '@/components/QuizHistory';
import { Loader2, FileDown, FileText, Send, Download, Check, Upload, Eye, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useToast } from '@/components/ui/use-toast';
import { useSubscription } from '@/hooks/useSubscription';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/app/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { generateQuiz } from '@/utils/api-client';
import { QuizSettings } from '@/lib/types';
import { AnkiExportDialog } from '@/app/components/AnkiExportDialog';

export default function Dashboard() {
  const [currentQuiz, setCurrentQuiz] = useState<any>(null);
  const [streamingText, setStreamingText] = useState<string>('');
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [quizRestored, setQuizRestored] = useState<boolean>(false);
  const { user } = useAuth();
  const { supabase, loading: supabaseLoading } = useSupabase();
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<string | null>(null);
  const { toast } = useToast();
  const { fetchSubscription, isOnPlan } = useSubscription();
  const [isAnkiDialogOpen, setIsAnkiDialogOpen] = useState(false);
  const [ankiDeckName, setAnkiDeckName] = useState('');
  const [sendingToAnki, setSendingToAnki] = useState(false);
  const [selectedQuizId, setSelectedQuizId] = useState<string | null>(null);

  // Load quiz from localStorage on component mount
  useEffect(() => {
    const savedQuiz = localStorage.getItem('currentQuiz');
    if (savedQuiz) {
      try {
        const parsedQuiz = JSON.parse(savedQuiz);
        // Only restore if it's a completed quiz (not loading state)
        if (parsedQuiz && !parsedQuiz.loading) {
          setCurrentQuiz(parsedQuiz);
          setQuizRestored(true);
        }
      } catch (error) {
        console.error('Error parsing saved quiz:', error);
        localStorage.removeItem('currentQuiz');
      }
    }
    setLoading(false);
  }, []);

  // Save quiz to localStorage whenever currentQuiz changes
  useEffect(() => {
    if (currentQuiz && !currentQuiz.loading) {
      localStorage.setItem('currentQuiz', JSON.stringify(currentQuiz));
    }
  }, [currentQuiz]);

  useEffect(() => {
    if (!supabase) return;
    
    const fetchUser = async () => {
      try {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error) {
          console.error('Error fetching user:', error);
          // Redirect to sign-in page if there's an authentication error
          window.location.href = '/auth/sign-in';
          return;
        }
        
        if (!user) {
          window.location.href = '/auth/sign-in';
          return;
        }
        
        // Use a static flag to track if we've already attempted to fetch the subscription
        // This prevents multiple fetch attempts during component re-renders
        if (!fetchUser.hasAttemptedFetch) {
          fetchUser.hasAttemptedFetch = true;
          
          // Fetch subscription data safely
          try {
            await fetchSubscription(true).catch(err => {
              console.error('Error fetching subscription:', err);
            });
          } catch (err) {
            console.error('Error in subscription effect:', err);
          }
        }
        
        setLoading(false);
      } catch (error) {
        console.error('Unexpected error:', error);
        setLoading(false);
      }
    };
    
    // Add the static property to the function
    fetchUser.hasAttemptedFetch = false;
    
    fetchUser();
  }, [supabase, fetchSubscription]);

  // Check for Stripe redirect parameters
  useEffect(() => {
    if (!user) return;
    
    const urlParams = new URLSearchParams(window.location.search);
    const success = urlParams.get('success');
    
    if (success === 'true') {
      // If redirected from successful payment, refresh subscription data
      fetchSubscription();
      
      // Show success toast
      toast({
        title: "Payment successful!",
        description: "Your subscription has been updated. Enjoy your premium features!",
      });
      
      // Clean up URL parameters
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [user, toast, fetchSubscription]);

  const handleQuizGenerated = (quiz: any) => {
    if (quiz.loading) {
      // Clear any saved quiz when starting new generation
      localStorage.removeItem('currentQuiz');
      setQuizRestored(false);
      setIsStreaming(true);
      setStreamingText('');
      setCurrentQuiz(quiz);
    } else {
      setIsStreaming(false);
      setCurrentQuiz(quiz);
      setQuizRestored(false);
      // Quiz will be automatically saved to localStorage by the useEffect
    }
  };

  // Helper function to clear the current quiz
  const clearCurrentQuiz = () => {
    setCurrentQuiz(null);
    setQuizRestored(false);
    localStorage.removeItem('currentQuiz');
  };

  // New function to handle streaming updates
  const handleStreamingUpdate = (text: string) => {
    setStreamingText(text);
    setIsStreaming(true);
  };

  // Function to handle exporting the quiz
  const handleExport = async (format: 'doc' | 'csv') => {
    if (!currentQuiz || currentQuiz.loading || currentQuiz.title === 'Error') {
      toast({
        title: "Cannot export",
        description: "Please generate a valid quiz first",
        variant: "destructive",
      });
      return;
    }

    if (!user) {
      toast({
        title: "Authentication required",
        description: "Please sign in to export quizzes",
        variant: "destructive",
      });
      return;
    }

    try {
      setExporting(format);
      
      // First save the quiz if it's not already saved
      let quizId = currentQuiz.id;
      
      if (!quizId) {
        // Save the quiz first
        const { data, error } = await supabase
          .from('quizzes')
          .insert({
            title: currentQuiz.title,
            questions: currentQuiz.questions,
            settings: currentQuiz.settings || {
              numberOfQuestions: currentQuiz.questions.length,
              difficulty: 'medium',
              questionType: currentQuiz.questions[0]?.type || 'multiple_choice',
            },
            user_id: user.id,
          })
          .select('id')
          .single();
          
        if (error) {
          throw new Error(`Failed to save quiz: ${error.message}`);
        }
        
        quizId = data.id;
        
        // Update the current quiz with the ID
        setCurrentQuiz({
          ...currentQuiz,
          id: quizId
        });
      }
      
      const response = await fetch(`/api/export-quiz?id=${quizId}&format=${format}`, {
        method: 'GET',
      });

      if (!response.ok) {
        throw new Error(`Failed to export quiz: ${response.statusText}`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      if (format === 'doc') {
        a.download = `${currentQuiz.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.docx`;
      } else if (format === 'csv') {
        a.download = `${currentQuiz.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.csv`;
      }
      document.body.appendChild(a);
      a.click();

      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      // Show success indicator for 2 seconds
      setExporting('success');
      setTimeout(() => {
        setExporting(null);
      }, 2000);
    } catch (error) {
      console.error('Error exporting quiz:', error);
      toast({
        title: "Export failed",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
      setExporting(null);
    }
  };

  // Function to open Anki export dialog
  const handleSendToAnki = async () => {
    if (!currentQuiz || currentQuiz.loading || currentQuiz.title === 'Error') {
      toast({
        title: "Cannot send to Anki",
        description: "Please generate a valid quiz first",
        variant: "destructive",
      });
      return;
    }

    if (!user) {
      toast({
        title: "Authentication required",
        description: "Please sign in to send quizzes to Anki",
        variant: "destructive",
      });
      return;
    }

    // First save the quiz if it's not already saved
    let quizId = currentQuiz.id;
    
    if (!quizId) {
      try {
        setExporting('anki-save');
        
        // Save the quiz first
        const { data, error } = await supabase
          .from('quizzes')
          .insert({
            title: currentQuiz.title,
            questions: currentQuiz.questions,
            settings: currentQuiz.settings || {
              numberOfQuestions: currentQuiz.questions.length,
              difficulty: 'medium',
              questionType: currentQuiz.questions[0]?.type || 'multiple_choice',
            },
            user_id: user.id,
          })
          .select('id')
          .single();
          
        if (error) {
          throw new Error(`Failed to save quiz: ${error.message}`);
        }
        
        quizId = data.id;
        
        // Update the current quiz with the ID
        setCurrentQuiz({
          ...currentQuiz,
          id: quizId
        });
      } catch (error) {
        console.error('Error saving quiz:', error);
        toast({
          title: "Failed to save quiz",
          description: error instanceof Error ? error.message : "An unknown error occurred",
          variant: "destructive",
        });
        setExporting(null);
        return;
      } finally {
        setExporting(null);
      }
    }
    
    // Open the Anki dialog with the quiz ID
    setSelectedQuizId(quizId);
    setIsAnkiDialogOpen(true);
  };

  const sendToAnki = async () => {
    if (!currentQuiz || !ankiDeckName.trim()) return;
    
    try {
      setSendingToAnki(true);
      setExporting('anki-send');
      
      toast({
        title: "Sending to Anki",
        description: "Connecting to Anki...",
      });
      
      const response = await fetch('/api/send-to-anki', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          quizId: currentQuiz.id,
          deckName: ankiDeckName.trim()
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Failed to send quiz to Anki');
      }

      const result = await response.json();
      
      toast({
        title: "Success",
        description: result.message || `Quiz sent to Anki deck "${ankiDeckName}"`,
      });
      
      setIsAnkiDialogOpen(false);
    } catch (error) {
      console.error('Error sending to Anki:', error);
      
      // Check if the error is related to connection issues
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const isConnectionError = errorMessage.includes('Could not connect to Anki') || 
                               errorMessage.includes('Failed to fetch');
      
      toast({
        title: "Failed to send to Anki",
        description: (
          <div>
            <p>{isConnectionError ? 
              "Could not connect to Anki. Please make sure:" : 
              errorMessage}
            </p>
            {isConnectionError && (
              <ul className="list-disc pl-5 mt-2 text-sm">
                <li>Anki is running on your computer</li>
                <li>The Anki-Connect plugin is installed</li>
                <li>You've restarted Anki after installing the plugin</li>
              </ul>
            )}
            <p className="mt-2">
              <a href="/dashboard/anki-setup" className="underline">
                View setup instructions
              </a>
            </p>
          </div>
        ),
        variant: "destructive",
        duration: 10000,
      });
    } finally {
      setSendingToAnki(false);
      setExporting(null);
    }
  };

  const openAnkiDialog = (quizId: string) => {
    console.log('Opening Anki dialog for quiz:', quizId);
    setSelectedQuizId(quizId);
    setIsAnkiDialogOpen(true);
  };

  const closeAnkiDialog = () => {
    console.log('Closing Anki dialog');
    setIsAnkiDialogOpen(false);
  };

  // Function to render the quiz content
  const renderQuizContent = () => {
    if (!currentQuiz) {
      return (
        <div className="text-gray-500 text-center">
          <p className="mb-2">Your quiz will appear here after generation</p>
          <p className="text-sm">Configure your settings and click "Generate Quiz" to begin</p>
        </div>
      );
    }

    if (currentQuiz.loading || isStreaming) {
      return (
        <div className="space-y-4">
          <div className="flex items-center mb-4">
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            <span className="text-sm text-gray-600">Generating your quiz...</span>
          </div>
          
          {/* Progress message display */}
          {streamingText && (
            <div className="space-y-3">
              <div className={`p-4 rounded-lg border ${
                streamingText.includes('Generated') && streamingText.includes('of') 
                  ? 'bg-green-50 border-green-200' 
                  : streamingText.includes('Expected') || streamingText.includes('Only generated')
                  ? 'bg-yellow-50 border-yellow-200'
                  : 'bg-blue-50 border-blue-200'
              }`}>
                <div className={`text-sm font-medium ${
                  streamingText.includes('Generated') && streamingText.includes('of')
                    ? 'text-green-900'
                    : streamingText.includes('Expected') || streamingText.includes('Only generated')
                    ? 'text-yellow-900' 
                    : 'text-blue-900'
                }`}>
                  {streamingText}
                </div>
              </div>
              <div className="text-xs text-gray-500 italic">
                Please wait while we process your PDF and generate questions...
              </div>
            </div>
          )}
          
          {!streamingText && (
            <div className="text-center text-gray-500">
              <p className="text-sm">This may take a minute depending on the document size</p>
            </div>
          )}
        </div>
      );
    }

    if (currentQuiz.title === 'Error') {
      return (
        <div className="text-red-500 text-center">
          <p className="font-semibold mb-2">Error generating quiz</p>
          <p className="text-sm">{currentQuiz.questions[0]?.text || 'Unknown error'}</p>
        </div>
      );
    }

    // Separate questions and answers
    const questions = currentQuiz.questions || [];

    return (
      <div className="space-y-4">
        {/* Header with title and clear button */}
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-gray-900">{currentQuiz.title}</h3>
            {quizRestored && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                Restored
              </span>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={clearCurrentQuiz}
            className="text-gray-500 hover:text-gray-700 text-xs"
          >
            Clear Quiz
          </Button>
        </div>
        
        {/* Questions Section */}
        <div className="space-y-4">
          {questions.map((question: any, index: number) => (
            <div key={index} className="border-b border-gray-100 pb-4 last:border-b-0">
              <p className="text-base font-medium text-gray-900 mb-2">
                {index + 1}. {question.text}
              </p>
              
              {question.type === 'multiple_choice' && question.options && (
                <div className="ml-4 space-y-1">
                  {question.options.map((option: string, optIndex: number) => (
                    <div key={optIndex} className="text-sm text-gray-700">
                      {String.fromCharCode(97 + optIndex)}) {option}
                    </div>
                  ))}
                </div>
              )}
              
              <div className="mt-2 ml-4">
                <span className="text-sm font-medium text-gray-600">Answer: </span>
                {question.type === 'multiple_choice' && question.options ? (
                  (() => {
                    // Try to find the correct answer using multiple matching strategies
                    let correctIndex = -1;
                    let correctText = question.correctAnswer;
                    
                    // Strategy 1: Direct match with full option text
                    correctIndex = question.options.findIndex((option: string) => 
                      option.trim().toLowerCase() === question.correctAnswer.trim().toLowerCase()
                    );
                    
                    // Strategy 2: If correctAnswer is just a letter (A, B, C, D), convert to index
                    if (correctIndex === -1) {
                      const answerLetter = question.correctAnswer.trim().toUpperCase();
                      if (answerLetter.match(/^[A-D]$/)) {
                        correctIndex = answerLetter.charCodeAt(0) - 65; // A=0, B=1, C=2, D=3
                        if (correctIndex >= 0 && correctIndex < question.options.length) {
                          correctText = question.options[correctIndex];
                        }
                      }
                    }
                    
                    // Strategy 3: If correctAnswer starts with a letter and parenthesis, extract the option
                    if (correctIndex === -1) {
                      const letterMatch = question.correctAnswer.match(/^([A-D])\)\s*(.+)$/i);
                      if (letterMatch) {
                        correctIndex = letterMatch[1].toUpperCase().charCodeAt(0) - 65;
                        correctText = letterMatch[2];
                      }
                    }
                    
                    const answerLetter = correctIndex !== -1 ? String.fromCharCode(65 + correctIndex) : '';
                    
                    return (
                      <span className="text-sm text-gray-900">
                        {answerLetter && <span className="font-semibold">{answerLetter}) </span>}
                        {correctText}
                      </span>
                    );
                  })()
                ) : (
                  <span className="text-sm text-gray-900">{question.correctAnswer}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {!user || loading || supabaseLoading ? (
        <div className="flex justify-center items-center h-[70vh]">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : (
        <>
          {/* Enhanced Header Section */}
          <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 p-6 rounded-xl border border-blue-100">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold mb-2 text-gray-900">Welcome back!</h1>
                <p className="text-gray-600">
                  Upload your materials to generate your quiz.
                  <br />
                  Use the selections below to refine your choices.
                </p>
              </div>
              <div className="hidden md:block">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center">
                  <FileText className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="bg-white rounded-lg shadow-md border border-gray-100 overflow-hidden">
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 px-4 sm:px-6 py-4 border-b border-green-100">
                <h2 className="text-lg sm:text-xl font-semibold text-gray-900 flex items-center">
                  <Upload className="w-5 h-5 mr-2 text-green-600" />
                  Create New Quiz
                </h2>
              </div>
              <div className="p-4 sm:p-6">
                <QuizUploader 
                  onQuizGenerated={handleQuizGenerated}
                  onStreamingUpdate={handleStreamingUpdate}
                />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-md border border-gray-100 overflow-hidden">
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-3 sm:px-4 lg:px-6 py-3 sm:py-4 border-b border-blue-100 overflow-hidden">
                <div className="min-w-0 w-full">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    {/* Title - with overflow protection */}
                    <div className="min-w-0 flex-1">
                      <h2 className="text-base sm:text-lg lg:text-xl font-semibold text-gray-900 flex items-center truncate">
                        <Eye className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-blue-600 flex-shrink-0" />
                        <span className="truncate">Quiz Preview</span>
                      </h2>
                    </div>
                    
                    {/* Export Button - with strict width constraints */}
                    {currentQuiz && !currentQuiz.loading && currentQuiz.title !== 'Error' && (
                      <div className="flex-shrink-0 w-full sm:w-auto sm:max-w-[120px] lg:max-w-none relative">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button 
                              variant="outline" 
                              size="sm"
                              disabled={exporting !== null && exporting !== 'success'}
                              className="w-full sm:w-auto bg-white hover:bg-blue-50 text-xs sm:text-sm px-2 sm:px-3 h-8"
                            >
                              {exporting === 'success' ? (
                                <>
                                  <Check className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-1 text-green-600" />
                                  <span className="hidden sm:inline ml-1">Exported</span>
                                  <span className="sm:hidden">✓</span>
                                </>
                              ) : exporting ? (
                                <>
                                  <Loader2 className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-1 animate-spin" />
                                  <span className="hidden sm:inline ml-1">Exporting...</span>
                                  <span className="sm:hidden">...</span>
                                </>
                              ) : (
                                <>
                                  <FileDown className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-1" />
                                  <span className="hidden sm:inline ml-1">Export</span>
                                  <span className="sm:hidden">Export</span>
                                </>
                              )}
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent 
                            align="start" 
                            side="bottom"
                            sideOffset={4}
                            alignOffset={-800}
                            className="w-48 sm:w-56 z-[9999]"
                            avoidCollisions={true}
                          >
                            <DropdownMenuItem 
                              onClick={() => handleExport('doc')}
                              disabled={exporting !== null && exporting !== 'success'}
                              className="flex items-center px-3 py-2 text-sm cursor-pointer hover:bg-gray-100 rounded-md"
                            >
                              <FileText className="mr-2 h-4 w-4 text-gray-600" />
                              <div>
                                <div className="font-medium">Word Document</div>
                                <div className="text-xs text-gray-500">Download as .docx file</div>
                              </div>
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => handleExport('csv')}
                              disabled={exporting !== null && exporting !== 'success'}
                              className="flex items-center px-3 py-2 text-sm cursor-pointer hover:bg-gray-100 rounded-md"
                            >
                              <Download className="mr-2 h-4 w-4 text-gray-600" />
                              <div>
                                <div className="font-medium">CSV Spreadsheet</div>
                                <div className="text-xs text-gray-500">Download as .csv file</div>
                              </div>
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={handleSendToAnki}
                              disabled={exporting !== null && exporting !== 'success'}
                              className="flex items-center px-3 py-2 text-sm cursor-pointer hover:bg-gray-100 rounded-md"
                            >
                              <Send className="mr-2 h-4 w-4 text-gray-600" />
                              <div>
                                <div className="font-medium">Anki Export</div>
                                <div className="text-xs text-gray-500">Send directly to Anki</div>
                              </div>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="h-[500px] p-4 sm:p-6 bg-white overflow-y-auto border-r-4 border-r-blue-200">
                {renderQuizContent()}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md border border-gray-100 overflow-hidden">
            <div className="bg-gradient-to-r from-purple-50 to-pink-50 px-6 py-4 border-b border-purple-100">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold text-gray-900 flex items-center">
                  <Clock className="w-5 h-5 mr-2 text-purple-600" />
                  Recent Quizzes
                </h2>
                <Link href="/dashboard/history">
                  <Button variant="outline" className="hover:bg-purple-50">View All</Button>
                </Link>
              </div>
            </div>
            <div className="p-6">
              <QuizHistory limit={5} />
            </div>
          </div>
        </>
      )}

      {/* Replace the old Anki Dialog with our new AnkiExportDialog component */}
      {selectedQuizId && (
        <AnkiExportDialog
          isOpen={isAnkiDialogOpen}
          onClose={closeAnkiDialog}
          quizId={selectedQuizId}
        />
      )}
    </div>
  );
} 