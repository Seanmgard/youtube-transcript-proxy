'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/providers/AuthProvider';
import { useSupabase } from '@/utils/supabase/client';
import QuizUploader from '@/app/components/QuizUploader';
import QuizHistory from '@/components/QuizHistory';
import { Loader2, FileDown, FileText, Send, Download, Check, Upload, Eye, Clock, Edit, ZoomIn } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import Link from 'next/link';
import { useToast } from '@/app/components/ui/use-toast';
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
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/app/components/ui/tabs';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/app/components/ui/card';
import { generateQuiz } from '@/utils/api-client';
import { QuizSettings, Question } from '@/lib/types';
import { AnkiExportDialog } from '@/app/components/AnkiExportDialog';
import ClozeEditor from '@/app/components/ClozeEditor';
import { QuestionEditor } from '@/app/components/QuestionEditor';
import { ImageZoomModal } from '@/app/components/ImageZoomModal';

export default function Dashboard() {
  const [currentQuiz, setCurrentQuiz] = useState<any>(null);
  const [streamingText, setStreamingText] = useState<string>('');
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [quizRestored, setQuizRestored] = useState<boolean>(false);
  const [questionsGenerated, setQuestionsGenerated] = useState(0);
  const [totalQuestionsTarget, setTotalQuestionsTarget] = useState(0);
  const [generationPhase, setGenerationPhase] = useState<'preparing' | 'generating' | 'completing' | 'completed'>('preparing');
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
  const [isQuestionEditorOpen, setIsQuestionEditorOpen] = useState(false);
  const [editingQuestionIndex, setEditingQuestionIndex] = useState<number | null>(null);
  const [zoomedImage, setZoomedImage] = useState<{
    url: string;
    alt: string;
    title: string;
  } | null>(null);

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
    console.log('📄 Dashboard: handleQuizGenerated called with:', quiz);
    if (quiz.loading) {
      // Clear any saved quiz when starting new generation
      localStorage.removeItem('currentQuiz');
      setQuizRestored(false);
      setIsStreaming(true);
      setStreamingText('');
      setCurrentQuiz(quiz);
      setQuestionsGenerated(0);
      setTotalQuestionsTarget(0);
      setGenerationPhase('preparing');
    } else {
      console.log('📄 Dashboard: Setting quiz as current quiz:', quiz);
      // Immediately display the quiz
      setGenerationPhase('completed');
      setIsStreaming(false);
      setCurrentQuiz(quiz);
      setQuizRestored(false);
      setStreamingText(''); // Clear any streaming text
      // Quiz will be automatically saved to localStorage by the useEffect
    }
  };

  // Helper function to clear the current quiz
  const clearCurrentQuiz = () => {
    setCurrentQuiz(null);
    setQuizRestored(false);
    setIsStreaming(false); // Also reset streaming state
    setQuestionsGenerated(0);
    setTotalQuestionsTarget(0);
    setGenerationPhase('preparing');
    setStreamingText('');
    localStorage.removeItem('currentQuiz');
  };

  // New function to handle streaming updates
  const handleStreamingUpdate = (text: string) => {
    setStreamingText(text);
    
    // Extract question progress from progress messages
    const progressMatch = text.match(/(\d+)\/(\d+) questions completed|Progress update: (\d+)\/(\d+)/);
    if (progressMatch) {
      const current = parseInt(progressMatch[1] || progressMatch[3]);
      const total = parseInt(progressMatch[2] || progressMatch[4]);
      setQuestionsGenerated(current);
      setTotalQuestionsTarget(total);
      setGenerationPhase('generating');
    }
    
    // Extract target from preparation messages
    const targetMatch = text.match(/create (\d+) questions|generate (\d+) questions/i);
    if (targetMatch) {
      const target = parseInt(targetMatch[1] || targetMatch[2]);
      setTotalQuestionsTarget(target);
    }
    
    // Handle completion - immediately switch to completed when quiz is ready
    if (text.includes('Your quiz is ready!') || text.includes('Generated successfully!')) {
      console.log('📄 Dashboard: Quiz completed, switching to display mode');
      setGenerationPhase('completed');
      setIsStreaming(false);
      return; // Exit early to prevent setting streaming to true
    } else if (text.includes('Error:')) {
      // Stop streaming on error
      setIsStreaming(false);
      setGenerationPhase('completed');
      return;
    } 
    
    // Only set streaming to true if we're not completed
    if (generationPhase !== 'completed') {
      setIsStreaming(true);
    }
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

  // Question Editor functions
  const openQuestionEditor = (questionIndex: number) => {
    setEditingQuestionIndex(questionIndex);
    setIsQuestionEditorOpen(true);
  };

  const closeQuestionEditor = () => {
    setIsQuestionEditorOpen(false);
    setEditingQuestionIndex(null);
  };

  const handleQuestionSave = async (updatedQuestion: Question) => {
    if (!currentQuiz || editingQuestionIndex === null) return;

    try {
      // Update the question in the current quiz
      const updatedQuestions = [...currentQuiz.questions];
      updatedQuestions[editingQuestionIndex] = updatedQuestion;
      
      const updatedQuiz = {
        ...currentQuiz,
        questions: updatedQuestions
      };

      // If the quiz is saved (has an ID), update it in the database
      if (currentQuiz.id) {
        const response = await fetch('/api/update-quiz', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            id: currentQuiz.id,
            questionIndex: editingQuestionIndex,
            updatedQuestion
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to save question to database');
        }
      }

      setCurrentQuiz(updatedQuiz);
      closeQuestionEditor();
      
      toast({
        title: "Question updated",
        description: "Your question has been successfully updated!",
      });
    } catch (error) {
      console.error('Error saving question:', error);
      toast({
        title: "Error",
        description: "Failed to save question. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Function to render the quiz content
  const renderQuizContent = () => {
    console.log('🎨 Dashboard: renderQuizContent called - currentQuiz:', currentQuiz, 'isStreaming:', isStreaming);
    
    if (!currentQuiz) {
      return (
        <div className="text-gray-500 text-center">
          <p className="mb-2">Your quiz will appear here after generation</p>
          <p className="text-sm">Configure your settings and click "Generate Quiz" to begin</p>
        </div>
      );
    }

    if (currentQuiz.loading || (isStreaming && generationPhase !== 'completed')) {
      return (
        <div className="space-y-4">
          {/* Progress Header */}
          <div className="flex items-center mb-4">
            <Loader2 className="h-4 w-4 animate-spin mr-2 text-blue-600" />
            <span className="text-sm font-medium text-gray-700">
              {generationPhase === 'preparing' && 'Preparing quiz generation...'}
              {generationPhase === 'generating' && `Generating questions (${questionsGenerated}/${totalQuestionsTarget})`}
            </span>
          </div>
          
          {/* Progress message display */}
          {streamingText && (
            <div className="space-y-3">
              <div className={`p-4 rounded-lg border transition-all duration-300 ${
                generationPhase === 'generating' && questionsGenerated > 0
                  ? 'bg-emerald-50 border-emerald-200' 
                  : streamingText.includes('Expected') || streamingText.includes('Only generated')
                  ? 'bg-yellow-50 border-yellow-200'
                  : 'bg-blue-50 border-blue-200'
              }`}>
                <div className={`text-sm font-medium ${
                  generationPhase === 'generating' && questionsGenerated > 0
                    ? 'text-emerald-800'
                    : streamingText.includes('Expected') || streamingText.includes('Only generated')
                    ? 'text-yellow-900' 
                    : 'text-blue-900'
                }`}>
                  {streamingText}
                </div>
              </div>
              <div className="text-xs text-gray-500 italic">
                Please wait while we process your document and generate questions. Larger files may take a bit longer.
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
              <div className="flex justify-between items-start mb-2">
                <p className="text-base font-medium text-gray-900 flex-1">
                  {index + 1}. {question.type === 'cloze' 
                    ? (question.clozeText?.replace(/\{\{c1::(.*?)\}\}/g, '_______________') || question.text)
                    : question.text
                  }
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openQuestionEditor(index)}
                  className="ml-2 flex items-center gap-1 text-xs h-8 px-2"
                >
                  <Edit className="h-3 w-3" />
                  Edit
                </Button>
              </div>
              
              {/* Display front images if available */}
              {(question.frontImages?.length || question.frontImage) && (
                <div className="mb-3 ml-4 flex gap-2 flex-wrap">
                  {/* Handle new multi-image format */}
                  {question.frontImages?.map((image: any, imgIndex: number) => (
                    <div key={imgIndex} className="relative inline-block p-2 bg-gray-50 rounded-lg border group cursor-pointer hover:shadow-md transition-all duration-200">
                      <img
                        src={image.url}
                        alt={image.alt || `Question image ${imgIndex + 1}`}
                        className={`rounded object-contain transition-all duration-200 ${
                          image.size === 'small' ? 'max-h-20' :
                          image.size === 'large' ? 'max-h-40' :
                          'max-h-32'
                        }`}
                        onClick={() => setZoomedImage({
                          url: image.url,
                          alt: image.alt || `Question image ${imgIndex + 1}`,
                          title: `Question Image ${question.frontImages?.length > 1 ? imgIndex + 1 : ''}`
                        })}
                      />
                      {/* Zoom icon */}
                      <div className="absolute top-1 right-1 bg-white/80 backdrop-blur-sm rounded-full p-1 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        <ZoomIn className="h-3 w-3 text-gray-600" />
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        Question Image {question.frontImages?.length > 1 ? imgIndex + 1 : ''}
                      </p>
                    </div>
                  ))}
                  
                  {/* Handle legacy single image format */}
                  {question.frontImage && !question.frontImages && (
                    <div className="relative inline-block p-2 bg-gray-50 rounded-lg border group cursor-pointer hover:shadow-md transition-all duration-200">
                      <img
                        src={question.frontImage.url}
                        alt={question.frontImage.alt || 'Question image'}
                        className={`rounded object-contain transition-all duration-200 ${
                          question.frontImage.size === 'small' ? 'max-h-20' :
                          question.frontImage.size === 'large' ? 'max-h-40' :
                          'max-h-32'
                        }`}
                        onClick={() => setZoomedImage({
                          url: question.frontImage.url,
                          alt: question.frontImage.alt || 'Question image',
                          title: 'Question Image'
                        })}
                      />
                      {/* Zoom icon */}
                      <div className="absolute top-1 right-1 bg-white/80 backdrop-blur-sm rounded-full p-1 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        <ZoomIn className="h-3 w-3 text-gray-600" />
                      </div>
                      <p className="text-xs text-gray-500 mt-1">Question Image</p>
                    </div>
                  )}
                </div>
              )}
              
              {question.type === 'cloze' && (
                <ClozeEditor 
                  question={question} 
                  quizId={currentQuiz?.id}
                  allQuestions={questions}
                  onUpdate={(updatedQuestion: any) => {
                    const updatedQuestions = [...questions];
                    updatedQuestions[index] = updatedQuestion;
                    // Update currentQuiz with new questions
                    setCurrentQuiz((prev: any) => prev ? {...prev, questions: updatedQuestions} : null);
                  }}
                />
              )}
              
              {question.type === 'multiple_choice' && question.options && (
                <div className="ml-4 space-y-1">
                  {question.options.map((option: string, optIndex: number) => (
                    <div key={optIndex} className="text-sm text-gray-700">
                      {String.fromCharCode(97 + optIndex)}) {option}
                    </div>
                  ))}
                </div>
              )}

              {/* Display back images if available */}
              {(question.backImages?.length || question.backImage) && (
                <div className="mb-3 ml-4 flex gap-2 flex-wrap">
                  {/* Handle new multi-image format */}
                  {question.backImages?.map((image: any, imgIndex: number) => (
                    <div key={imgIndex} className="relative inline-block p-2 bg-gray-50 rounded-lg border group cursor-pointer hover:shadow-md transition-all duration-200">
                      <img
                        src={image.url}
                        alt={image.alt || `Answer image ${imgIndex + 1}`}
                        className={`rounded object-contain transition-all duration-200 ${
                          image.size === 'small' ? 'max-h-20' :
                          image.size === 'large' ? 'max-h-40' :
                          'max-h-32'
                        }`}
                        onClick={() => setZoomedImage({
                          url: image.url,
                          alt: image.alt || `Answer image ${imgIndex + 1}`,
                          title: `Answer Image ${question.backImages?.length > 1 ? imgIndex + 1 : ''}`
                        })}
                      />
                      {/* Zoom icon */}
                      <div className="absolute top-1 right-1 bg-white/80 backdrop-blur-sm rounded-full p-1 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        <ZoomIn className="h-3 w-3 text-gray-600" />
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        Answer Image {question.backImages?.length > 1 ? imgIndex + 1 : ''}
                      </p>
                    </div>
                  ))}
                  
                  {/* Handle legacy single image format */}
                  {question.backImage && !question.backImages && (
                    <div className="relative inline-block p-2 bg-gray-50 rounded-lg border group cursor-pointer hover:shadow-md transition-all duration-200">
                      <img
                        src={question.backImage.url}
                        alt={question.backImage.alt || 'Answer image'}
                        className={`rounded object-contain transition-all duration-200 ${
                          question.backImage.size === 'small' ? 'max-h-20' :
                          question.backImage.size === 'large' ? 'max-h-40' :
                          'max-h-32'
                        }`}
                        onClick={() => setZoomedImage({
                          url: question.backImage.url,
                          alt: question.backImage.alt || 'Answer image',
                          title: 'Answer Image'
                        })}
                      />
                      {/* Zoom icon */}
                      <div className="absolute top-1 right-1 bg-white/80 backdrop-blur-sm rounded-full p-1 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        <ZoomIn className="h-3 w-3 text-gray-600" />
                      </div>
                      <p className="text-xs text-gray-500 mt-1">Answer Image</p>
                    </div>
                  )}
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

      {/* Question Editor Dialog */}
      {editingQuestionIndex !== null && currentQuiz?.questions[editingQuestionIndex] && (
        <QuestionEditor
          question={currentQuiz.questions[editingQuestionIndex]}
          isOpen={isQuestionEditorOpen}
          onClose={closeQuestionEditor}
          onSave={handleQuestionSave}
        />
      )}

      {/* Image Zoom Modal */}
      {zoomedImage && (
        <ImageZoomModal
          isOpen={!!zoomedImage}
          onClose={() => setZoomedImage(null)}
          imageUrl={zoomedImage.url}
          imageAlt={zoomedImage.alt}
          imageTitle={zoomedImage.title}
        />
      )}
    </div>
  );
} 