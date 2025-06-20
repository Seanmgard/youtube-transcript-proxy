'use client';

import { useState, useEffect, useCallback, KeyboardEvent } from 'react';
import { Loader2, ArrowLeft, ThumbsUp, ThumbsDown, RotateCcw, ChevronLeft, ChevronRight, Check, X, CheckCircle, XCircle, AlertCircle, FileText, Send } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import Link from 'next/link';
import { Quiz, Question, LearningProgress, QuestionStat } from '@/lib/types';
import { useToast } from '@/app/components/ui/use-toast';
import { Progress } from "@/app/components/ui/progress";
import { v4 as uuidv4 } from 'uuid';
import { useSupabase } from '@/utils/supabase/client';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/app/providers/AuthProvider';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from '@/app/components/ui/dialog'
import { Input } from '@/app/components/ui/input'
import { Label } from '@/app/components/ui/label'
import { AnkiExportDialog } from '@/app/components/AnkiExportDialog'

export default function LearnQuizPage() {
  // Use the useParams hook to get route parameters in a client component
  const params = useParams();
  const quizId = params.quizId as string;
  const [user, setUser] = useState<any>(null);
  const [contentLoading, setContentLoading] = useState(true);
  const [savingProgress, setSavingProgress] = useState(false);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [learningProgress, setLearningProgress] = useState<LearningProgress | null>(null);
  const [questionStats, setQuestionStats] = useState<Record<string, QuestionStat>>({});
  const [flipped, setFlipped] = useState(false);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const { supabase, loading: supabaseLoading, error: supabaseError } = useSupabase();
  const { toast } = useToast();
  const router = useRouter();
  const { user: authUser } = useAuth();
  const [isMobileOrTablet, setIsMobileOrTablet] = useState(false);
  const [ankiDeckName, setAnkiDeckName] = useState('');
  const [isAnkiDialogOpen, setIsAnkiDialogOpen] = useState(false);
  const [sendingToAnki, setSendingToAnki] = useState(false);
  
  // Combine loading states
  const isLoading = contentLoading || supabaseLoading;

  useEffect(() => {
    const fetchQuizAndProgress = async () => {
      // Wait for supabase to be initialized
      if (!supabase) return;
      
      try {
        // Use the user from AuthProvider if available, otherwise get from Supabase
        let currentUser = authUser;
        
        if (!currentUser) {
          const { data: { user }, error: userError } = await supabase.auth.getUser();
          
          if (userError) {
            console.error("User authentication error:", userError);
            toast({
              title: "Authentication error",
              description: "Please sign in again to continue",
              variant: "destructive",
            });
            router.push('/auth/sign-in');
            return;
          }
          
          currentUser = user;
        }
        
        if (!currentUser) {
          console.log("No authenticated user found");
          toast({
            title: "Not signed in",
            description: "Please sign in to view this quiz",
            variant: "destructive",
          });
          router.push('/auth/sign-in');
          return;
        }
        
        setUser(currentUser);
        console.log("Current user:", currentUser);
        console.log("Quiz ID:", quizId);

        // Fetch quiz
        const { data: quizData, error: quizError } = await supabase
          .from('quizzes')
          .select('*')
          .eq('id', quizId)
          .eq('user_id', currentUser.id)
          .single();

        if (quizError) {
          console.error("Error fetching quiz:", quizError);
          
          // Check if the quiz was not found
          if (quizError.code === 'PGRST116') {
            toast({
              title: "Quiz not found",
              description: "This quiz may have been deleted or you don't have access to it",
              variant: "destructive",
            });
            
            // Redirect back to the learn page
            router.push('/dashboard/learn');
            return;
          }
          
          toast({
            title: "Error loading quiz",
            description: quizError.message || "Could not find the requested quiz",
            variant: "destructive",
          });
          router.push('/dashboard/learn');
          return;
        }
        
        console.log("Fetched quiz:", quizData);
        
        // Normalize quiz data to handle field name mismatches
        const normalizedQuiz = {
          id: quizData.id,
          title: quizData.title,
          user_id: quizData.user_id,
          created_at: quizData.created_at,
          pdf_url: quizData.pdf_url || '',
          questions: (quizData.questions || []).map((q: any) => ({
            ...q,
            // Ensure both field naming conventions are available
            id: q.id || `q-${uuidv4()}`,
            quizId: quizId,
            text: q.text || q.question || '',
            correctAnswer: q.correctAnswer || q.answer || '',
            type: q.type || 'open_ended',
            options: q.options || [] // Ensure options field exists
          })),
          settings: quizData.settings || {
            numberOfQuestions: quizData.questions?.length || 0,
            difficulty: 'medium',
            questionType: 'mixed'
          }
        };
        
        console.log("Normalized quiz:", normalizedQuiz);
        console.log("Normalized questions:", normalizedQuiz.questions);
        setQuiz(normalizedQuiz);

        // Fetch learning progress
        const { data: progressData, error: progressError } = await supabase
          .from('learning_progress')
          .select('*')
          .eq('quiz_id', quizId)
          .eq('user_id', currentUser.id)
          .single();

        if (progressError) {
          console.log("Progress error:", progressError);
          if (progressError.code === 'PGRST116') {
            // No progress found, create a new one
            console.log("Creating new progress for quiz");
            const newProgress: LearningProgress = {
              id: uuidv4(),
              user_id: currentUser.id,
              quiz_id: quizId,
              last_studied: new Date().toISOString(),
              completed_sessions: 0,
              mastery_percentage: 0,
              question_stats: []
            };

            // Initialize question stats for each question
            const stats: Record<string, QuestionStat> = {};
            normalizedQuiz.questions.forEach((question: Question) => {
              const questionId = question.id || `q-${uuidv4()}`;
              stats[questionId] = {
                question_id: questionId,
                correct_count: 0,
                incorrect_count: 0,
                last_result: false,
                last_studied: '',
                confidence_level: 'low'
              };
            });

            setLearningProgress(newProgress);
            setQuestionStats(stats);
          } else {
            console.error("Error fetching learning progress:", progressError);
            toast({
              title: "Warning",
              description: "Could not load your previous progress",
              variant: "default",
            });
            
            // Create a new progress object anyway
            const newProgress: LearningProgress = {
              id: uuidv4(),
              user_id: currentUser.id,
              quiz_id: quizId,
              last_studied: new Date().toISOString(),
              completed_sessions: 0,
              mastery_percentage: 0,
              question_stats: []
            };
            
            const stats: Record<string, QuestionStat> = {};
            normalizedQuiz.questions.forEach((question: Question) => {
              const questionId = question.id || `q-${uuidv4()}`;
              stats[questionId] = {
                question_id: questionId,
                correct_count: 0,
                incorrect_count: 0,
                last_result: false,
                last_studied: '',
                confidence_level: 'low'
              };
            });
            
            setLearningProgress(newProgress);
            setQuestionStats(stats);
          }
        } else {
          console.log("Fetched progress:", progressData);
          setLearningProgress(progressData);
          
          // Convert question stats array to record for easier lookup
          const stats: Record<string, QuestionStat> = {};
          progressData.question_stats.forEach((stat: QuestionStat) => {
            stats[stat.question_id] = stat;
          });
          setQuestionStats(stats);
        }
      } catch (error: any) {
        console.error('Error fetching quiz:', error);
        toast({
          title: "Error loading quiz",
          description: error.message || "There was a problem loading the quiz data.",
          variant: "destructive",
        });
        router.push('/dashboard/learn');
      } finally {
        setContentLoading(false);
      }
    };

    fetchQuizAndProgress();
  }, [quizId, supabase, toast, router, authUser]);

  const saveProgress = async () => {
    if (!learningProgress || !quiz || !supabase) return;
    
    try {
      setSavingProgress(true);
      
      // Update learning progress to track viewed cards instead of correct answers
      const updatedProgress = {
        ...learningProgress,
        last_studied: new Date().toISOString(),
        completed_sessions: learningProgress.completed_sessions + 1,
        mastery_percentage: 100, // Since we're not tracking correctness anymore
        question_stats: Object.values(questionStats)
      };
      
      // Save to database
      const { error } = await supabase
        .from('learning_progress')
        .upsert(updatedProgress);
      
      if (error) {
        console.error("Error saving progress:", error);
        toast({
          title: "Error",
          description: "Could not save your progress",
          variant: "destructive",
        });
        return;
      }
      
      setLearningProgress(updatedProgress);
      
      toast({
        title: "Progress saved",
        description: "Your learning progress has been updated.",
      });
    } catch (error: any) {
      console.error('Error saving progress:', error);
      toast({
        title: "Error saving progress",
        description: error.message || "There was a problem saving your progress.",
        variant: "destructive",
      });
    } finally {
      setSavingProgress(false);
    }
  };

  // Update this function to track card views instead of correct/incorrect answers
  const updateCardStats = useCallback(() => {
    if (!quiz) return;
    
    const currentQuestion = quiz.questions[currentQuestionIndex];
    const questionId = currentQuestion.id;
    
    // Update question stats
    const updatedStats = { ...questionStats };
    
    if (!updatedStats[questionId]) {
      updatedStats[questionId] = {
        question_id: questionId,
        correct_count: 0,
        incorrect_count: 0,
        last_result: true,
        last_studied: '',
        confidence_level: 'medium'
      };
    }
    
    // Mark as viewed
    updatedStats[questionId].last_studied = new Date().toISOString();
    updatedStats[questionId].confidence_level = 'medium';
    
    setQuestionStats(updatedStats);
  }, [quiz, currentQuestionIndex, questionStats]);

  const handleNextQuestion = () => {
    if (!quiz) return;
    
    // Update stats for current card
    updateCardStats();
    
    if (currentQuestionIndex < quiz.questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      setShowAnswer(false);
      setFlipped(false);
    } else {
      saveProgress();
    }
  };

  const handlePrevQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
      setShowAnswer(false);
      setFlipped(false);
    }
  };

  const resetQuiz = () => {
    setCurrentQuestionIndex(0);
    setShowAnswer(false);
    setFlipped(false);
  };

  const handleFlip = useCallback(() => {
    // When flipping to see the answer, update the stats
    if (!flipped) {
      updateCardStats();
    }
    setFlipped(!flipped);
  }, [flipped, updateCardStats]);

  // Update handleNextAfterReview to use the new logic
  const handleNextAfterReview = () => {
    // Reset for next question
    setFlipped(false);
    setShowAnswer(false);
    
    // Move to next question
    if (quiz && currentQuestionIndex < quiz.questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else {
      // End of quiz, save progress
      saveProgress();
    }
  };

  // Add keyboard event handler for space bar
  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLDivElement> | KeyboardEvent<Document>) => {
    if (e.code === 'Space' || e.key === ' ') {
      e.preventDefault();
      handleFlip();
    }
  }, [handleFlip]);

  // Add global keyboard event listener
  useEffect(() => {
    // Add global event listener for space bar
    document.addEventListener('keydown', handleKeyDown as any);
    
    // Cleanup
    return () => {
      document.removeEventListener('keydown', handleKeyDown as any);
    };
  }, [handleKeyDown]);

  // Add useEffect for mobile detection
  useEffect(() => {
    const checkDevice = () => {
      const userAgent = navigator.userAgent.toLowerCase();
      const isMobile = /iphone|ipad|ipod|android|blackberry|windows phone/g.test(userAgent);
      setIsMobileOrTablet(isMobile);
    };

    checkDevice();
    window.addEventListener('resize', checkDevice);
    return () => window.removeEventListener('resize', checkDevice);
  }, []);

  const handleExport = async (quiz: Quiz, format: 'doc' | 'csv' | 'anki') => {
    try {
      const response = await fetch(`/api/export-quiz?id=${quiz.id}&format=${format}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Export failed: ${response.statusText}`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${quiz.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: 'Export Successful',
        description: `Quiz exported as ${format.toUpperCase()} successfully`,
      });
    } catch (error) {
      console.error('Error exporting quiz:', error);
      toast({
        title: 'Export Failed',
        description: error instanceof Error ? error.message : 'Failed to export quiz',
        variant: 'destructive',
      });
    }
  };

  const handleAnkiExport = (quiz: Quiz) => {
    if (isMobileOrTablet) {
      toast({
        title: "Desktop Only Feature",
        description: "Exporting to Anki is only available on desktop computers. Please use your computer to export to Anki.",
        variant: "default",
        duration: 5000,
      });
      return;
    }
    // Instead of exporting as a file, open the Anki Connect dialog
    openAnkiDialog();
  };

  const openAnkiDialog = () => {
    console.log('Opening Anki dialog for quiz:', quiz?.id);
    setIsAnkiDialogOpen(true);
  };

  const closeAnkiDialog = () => {
    console.log('Closing Anki dialog');
    setIsAnkiDialogOpen(false);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-[70vh]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!quiz) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh]">
        <h2 className="text-2xl font-bold mb-4">Quiz not found</h2>
        <p className="mb-6">The quiz you're looking for doesn't exist or you don't have access to it.</p>
        <Link href="/dashboard/learn">
          <Button>Back to Learn</Button>
        </Link>
      </div>
    );
  }

  const currentQuestion = quiz.questions[currentQuestionIndex];
  const totalQuestions = quiz.questions.length;
  const progress = ((currentQuestionIndex + 1) / totalQuestions) * 100;

  // Debug current question
  console.log("Current question:", currentQuestion);
  console.log("Current question index:", currentQuestionIndex);
  console.log("Total questions:", totalQuestions);
  console.log("Question type:", currentQuestion?.type);
  console.log("Has options:", !!currentQuestion?.options);
  console.log("Options:", currentQuestion?.options);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-2 mb-6">
        <Link href="/dashboard/learn">
          <Button variant="outline" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">{quiz.title}</h1>
      </div>

      <div className="p-6 bg-white rounded-lg shadow-md">
        <div className="flex justify-between items-center mb-4">
          <div className="text-sm text-gray-600">
            Question {currentQuestionIndex + 1} of {totalQuestions}
          </div>
          <Button variant="outline" size="sm" onClick={resetQuiz}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset
          </Button>
        </div>

        <Progress 
          value={progress} 
          className="h-2 mb-4 bg-gray-100" 
          style={{ "--progress-foreground": "rgb(21, 128, 61)" } as React.CSSProperties}
        />

        {/* Flashcard */}
        <div
          className={`relative w-full rounded-lg border bg-white text-gray-900 shadow-sm perspective-1000 ${flipped ? 'rotate-y-180' : ''} transform-style-preserve-3d transition-all duration-500 cursor-pointer`}
          style={{ minHeight: '190px', height: '270px', maxHeight: '270px' }}
          onClick={handleFlip}
          tabIndex={0}
          role="button"
          aria-pressed={flipped}
          aria-label="Flashcard, press space or click to flip"
        >
          {/* Front of card (Question) */}
          <div className={`absolute w-full h-full backface-hidden ${!flipped ? 'visible' : 'invisible'} overflow-auto p-6 bg-white`}>
            <h3 className="font-medium text-sm text-gray-700 mb-1">Question {currentQuestionIndex + 1}</h3>
            <p className="mb-2 text-gray-900">{currentQuestion?.text}</p>
            
            {currentQuestion?.type === 'multiple_choice' && currentQuestion?.options && (
              <>
                <p className="text-xs text-gray-600 mb-1">Options:</p>
                <ul className="space-y-1 mb-2">
                  {currentQuestion.options.map((option, index) => (
                    <li key={index} className="text-sm py-1 px-3 rounded-md bg-gray-50 text-gray-700">
                      {option}
                    </li>
                  ))}
                </ul>
              </>
            )}
            
            <div className="mt-4 text-center text-xs text-gray-500">
              Click or press space to see answer
            </div>
          </div>
          
          {/* Back of card (Answer) */}
          <div className={`absolute w-full h-full backface-hidden rotate-y-180 ${flipped ? 'visible' : 'invisible'} overflow-auto p-6 flex flex-col bg-white`}>
            <h3 className="font-medium text-sm text-gray-700 mb-1">Answer</h3>
            
            <div className="flex-grow flex items-center justify-center">
              {currentQuestion?.type === 'multiple_choice' && currentQuestion?.options ? (
                (() => {
                  // Try to find the correct answer using multiple matching strategies
                  let correctIndex = -1;
                  let correctText = currentQuestion.correctAnswer;
                  
                  // Strategy 1: Direct match with full option text
                  correctIndex = currentQuestion.options.findIndex((option: string) => 
                    option.trim().toLowerCase() === currentQuestion.correctAnswer.trim().toLowerCase()
                  );
                  
                  // Strategy 2: If correctAnswer is just a letter (A, B, C, D), convert to index
                  if (correctIndex === -1) {
                    const answerLetter = currentQuestion.correctAnswer.trim().toUpperCase();
                    if (answerLetter.match(/^[A-D]$/)) {
                      correctIndex = answerLetter.charCodeAt(0) - 65; // A=0, B=1, C=2, D=3
                      if (correctIndex >= 0 && correctIndex < currentQuestion.options.length) {
                        correctText = currentQuestion.options[correctIndex];
                      }
                    }
                  }
                  
                  // Strategy 3: If correctAnswer starts with a letter and parenthesis, extract the option
                  if (correctIndex === -1) {
                    const letterMatch = currentQuestion.correctAnswer.match(/^([A-D])\)\s*(.+)$/i);
                    if (letterMatch) {
                      correctIndex = letterMatch[1].toUpperCase().charCodeAt(0) - 65;
                      correctText = letterMatch[2];
                    }
                  }
                  
                  const answerLetter = correctIndex !== -1 ? String.fromCharCode(65 + correctIndex) : '';
                  
                  return (
                    <div className="text-center">
                      {answerLetter && (
                        <div className="text-lg font-bold text-blue-600 mb-2">
                          {answerLetter})
                        </div>
                      )}
                      <p className="text-sm font-medium text-gray-900">{correctText}</p>
                    </div>
                  );
                })()
              ) : (
                <p className="text-sm font-medium text-gray-900">{currentQuestion?.correctAnswer}</p>
              )}
            </div>
            
            <div className="mt-4 text-center text-xs text-gray-500">
              Click or press space to see question
            </div>
          </div>
        </div>

        <div className="flex justify-between mt-4">
          <Button
            variant="outline"
            onClick={handlePrevQuestion}
            disabled={currentQuestionIndex === 0}
          >
            <ChevronLeft className="h-4 w-4 mr-2" />
            Previous
          </Button>
          
          <Button
            onClick={handleNextAfterReview}
          >
            Next
            <ChevronRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </div>

      <div className="p-6 bg-white rounded-lg shadow-md">
        <h2 className="text-xl font-semibold mb-4 text-gray-900">Your Progress</h2>
        
        <div className="space-y-4">
          <div>
            <div className="flex justify-between text-sm mb-1 text-gray-700">
              <span>Cards Viewed</span>
              <span>{Object.values(questionStats).filter(stat => stat.last_studied).length} of {quiz.questions.length}</span>
            </div>
            <Progress 
              value={(Object.values(questionStats).filter(stat => stat.last_studied).length / quiz.questions.length) * 100} 
              className="h-2 bg-gray-100" 
              style={{ "--progress-foreground": "rgb(21, 128, 61)" } as React.CSSProperties}
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <h3 className="text-sm font-medium mb-1 text-gray-700">Completed Sessions</h3>
              <p className="text-2xl font-bold text-gray-900">{learningProgress?.completed_sessions || 0}</p>
            </div>
            
            <div className="p-4 bg-gray-50 rounded-lg">
              <h3 className="text-sm font-medium mb-1 text-gray-700">Last Studied</h3>
              <p className="text-sm text-gray-600">
                {learningProgress?.last_studied 
                  ? new Date(learningProgress.last_studied).toLocaleDateString() 
                  : 'Never'}
              </p>
            </div>
          </div>
          
          <Button 
            onClick={saveProgress}
            disabled={savingProgress}
            className="w-full"
          >
            {savingProgress ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : 'Save Progress'}
          </Button>
        </div>
      </div>

      <div className="p-6 bg-white rounded-lg shadow-md">
        <h2 className="text-xl font-semibold mb-4 text-gray-900">Export Quiz</h2>
        
        <div className="space-y-4">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              if (quiz) {
                handleAnkiExport(quiz);
              }
            }}
            className={`flex items-center bg-white text-black border border-gray-200 hover:bg-gray-50 ${
              isMobileOrTablet 
                ? 'opacity-60 cursor-help' 
                : ''
            }`}
          >
            {isMobileOrTablet && (
              <AlertCircle className="h-4 w-4 mr-1 text-gray-400" />
            )}
            {!isMobileOrTablet && (
              <Send className="h-4 w-4 mr-1" />
            )}
            Export to Anki
          </Button>
        </div>
      </div>

      {/* Replace the old Anki Dialog with our new AnkiExportDialog component */}
      {quiz && (
        <AnkiExportDialog
          isOpen={isAnkiDialogOpen}
          onClose={closeAnkiDialog}
          quizId={quiz.id}
        />
      )}
    </div>
  );
}