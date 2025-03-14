'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/app/providers/AuthProvider';
import { useSupabase } from '@/utils/supabase/client';
import QuizUploader from '@/app/components/QuizUploader';
import QuizHistory from '@/components/QuizHistory';
import { Loader2, FileDown, FileText, Send, Download } from 'lucide-react';
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

export default function Dashboard() {
  const [currentQuiz, setCurrentQuiz] = useState<any>(null);
  const { user } = useAuth();
  const { supabase, loading: supabaseLoading } = useSupabase();
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<string | null>(null);
  const { toast } = useToast();
  const { fetchSubscription, isOnPlan } = useSubscription();
  const [isAnkiDialogOpen, setIsAnkiDialogOpen] = useState(false);
  const [ankiDeckName, setAnkiDeckName] = useState('');
  const [sendingToAnki, setSendingToAnki] = useState(false);

  useEffect(() => {
    setLoading(false);
  }, []);

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
    setCurrentQuiz(quiz);
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
      toast({
        title: "Exporting quiz",
        description: `Preparing ${format.toUpperCase()} export...`,
      });
      
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
      
      toast({
        title: "Export successful",
        description: `Your quiz has been exported as ${format.toUpperCase()}`,
      });
    } catch (error) {
      console.error('Error exporting quiz:', error);
      toast({
        title: "Export failed",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    } finally {
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
    
    // Set the default deck name and open the dialog
    setAnkiDeckName(currentQuiz.title.replace(/[^a-z0-9]/gi, ' ').trim());
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
      toast({
        title: "Failed to send to Anki",
        description: error instanceof Error 
          ? error.message 
          : "Make sure Anki is running with the Anki-Connect plugin installed",
        variant: "destructive",
      });
    } finally {
      setSendingToAnki(false);
      setExporting(null);
    }
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

    if (currentQuiz.loading) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-gray-500">
          <Loader2 className="h-8 w-8 animate-spin mb-4" />
          <p>Generating your quiz...</p>
          <p className="text-sm mt-2">This may take a minute depending on the document size</p>
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
      <div className="pr-2">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-md font-semibold">{currentQuiz.title}</h3>
          
          {/* Export Dropdown Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="outline" 
                size="sm"
                disabled={exporting !== null}
                className="flex items-center"
              >
                {exporting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Exporting...
                  </>
                ) : (
                  <>
                    <FileDown className="mr-2 h-4 w-4" />
                    Export
                  </>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem 
                onClick={() => handleExport('doc')}
                disabled={exporting !== null}
                className="cursor-pointer"
              >
                <FileText className="mr-2 h-4 w-4" />
                Export as Word (.docx)
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => handleExport('csv')}
                disabled={exporting !== null}
                className="cursor-pointer"
              >
                <FileText className="mr-2 h-4 w-4" />
                Export as CSV (Quizlet)
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={handleSendToAnki}
                disabled={exporting !== null}
                className="cursor-pointer"
              >
                <Send className="mr-2 h-4 w-4" />
                Send to Anki
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        
        {/* Questions and Options Section */}
        <div className="mb-4">
          <h4 className="text-sm font-medium mb-2 text-gray-600">Questions</h4>
          {questions.map((question: any, index: number) => (
            <div key={index} className="mb-3">
              <p className="text-sm font-medium mb-1">
                {index + 1}. {question.text}
              </p>
              {question.type === 'multiple_choice' && question.options && (
                <ul className="space-y-0.5 ml-4 text-sm">
                  {question.options.map((option: string, optIndex: number) => (
                    <li key={optIndex} className="flex items-start">
                      <span className="text-xs">• {option}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
        
        {/* Answers Section */}
        {questions.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-2 text-gray-600 border-t pt-2">Answers</h4>
            {questions.map((question: any, index: number) => (
              <div key={index} className="mb-2">
                <p className="text-xs">
                  <span className="font-medium">{index + 1}.</span> {question.correctAnswer}
                </p>
              </div>
            ))}
          </div>
        )}
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
          <div>
            <h1 className="text-3xl font-bold mb-2">Welcome back!</h1>
            <p className="text-gray-600">
              Upload your materials to generate your quiz.
              <br />
              Use the selections below to refine your choices.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="p-6 bg-white rounded-lg shadow-md">
              <h2 className="text-xl font-semibold mb-4">Create New Quiz</h2>
              <QuizUploader 
                onQuizGenerated={handleQuizGenerated} 
                key={isOnPlan('premium') ? 'premium' : 'free'} 
              />
            </div>

            <div className="p-6 bg-white rounded-lg shadow-md">
              <h2 className="text-xl font-semibold mb-4">Quiz Preview</h2>
              <div className="h-[400px] p-6 bg-gray-50 rounded-lg overflow-auto">
                {renderQuizContent()}
              </div>
            </div>
          </div>

          <div className="p-6 bg-white rounded-lg shadow-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Recent Quizzes</h2>
              <Link href="/dashboard/history">
                <Button variant="outline">View All</Button>
              </Link>
            </div>
            <QuizHistory limit={5} />
          </div>
        </>
      )}

      {/* Anki Dialog */}
      <Dialog open={isAnkiDialogOpen} onOpenChange={setIsAnkiDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Send to Anki</DialogTitle>
            <DialogDescription>
              Enter the name of the Anki deck where you want to send this quiz.
              Make sure Anki is running with the Anki-Connect plugin installed.
              <Link href="/dashboard/anki-setup" className="text-blue-600 dark:text-blue-400 hover:underline block mt-2">
                Learn how to set up Anki integration
              </Link>
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="deckName" className="text-right">
                Deck Name
              </Label>
              <Input
                id="deckName"
                value={ankiDeckName}
                onChange={(e) => setAnkiDeckName(e.target.value)}
                className="col-span-3"
                placeholder="Enter deck name"
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsAnkiDialogOpen(false)}
              disabled={sendingToAnki}
            >
              Cancel
            </Button>
            <Button 
              type="button" 
              onClick={sendToAnki}
              disabled={!ankiDeckName.trim() || sendingToAnki}
            >
              {sendingToAnki ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                'Send to Anki'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
} 