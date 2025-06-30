'use client';

import { useState, useEffect, useCallback, KeyboardEvent } from 'react';
import { Loader2, ArrowLeft, ThumbsUp, ThumbsDown, RotateCcw, ChevronLeft, ChevronRight, Check, X, CheckCircle, XCircle, AlertCircle, FileText, Send, Eye, EyeOff, Settings, Lightbulb, Brain, Zap, Trophy, Target, Edit } from 'lucide-react';
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
import ClozeEditor from '@/app/components/ClozeEditor';

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
  const [showOptions, setShowOptions] = useState(true); // New state for toggle
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null); // Track selected answer
  const { supabase, loading: supabaseLoading, error: supabaseError } = useSupabase();
  const { toast } = useToast();
  const router = useRouter();
  const { user: authUser } = useAuth();
  const [isMobileOrTablet, setIsMobileOrTablet] = useState(false);
  const [ankiDeckName, setAnkiDeckName] = useState('');
  const [isAnkiDialogOpen, setIsAnkiDialogOpen] = useState(false);
  const [sendingToAnki, setSendingToAnki] = useState(false);
  const [editingCloze, setEditingCloze] = useState(false);
  
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
            options: q.options || [], // Ensure options field exists
            // Preserve cloze deletion specific fields
            clozeText: q.clozeText || q.cloze_text || '',
            originalText: q.originalText || q.original_text || q.text || q.question || ''
          })),
          settings: quizData.settings || {
            numberOfQuestions: quizData.questions?.length || 0,
            difficulty: 'medium',
            questionType: 'multiple_choice'
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
        title: "💾 Progress Saved",
        description: "Your learning progress has been successfully updated and synced.",
        className: "border-green-200 bg-green-50 text-green-900",
        duration: 3000,
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

  const handleOptionClick = (option: string, index: number) => {
    if (!currentQuestion) return;
    
    setSelectedAnswer(option);
    
    // Check if answer is correct
    let correct = false;
    
    // Strategy 1: Direct match with full option text
    if (option.trim().toLowerCase() === currentQuestion.correctAnswer.trim().toLowerCase()) {
      correct = true;
    } else {
      // Strategy 2: If correctAnswer is just a letter (A, B, C, D), convert to index
      const answerLetter = currentQuestion.correctAnswer.trim().toUpperCase();
      if (answerLetter.match(/^[A-D]$/)) {
        const correctIndex = answerLetter.charCodeAt(0) - 65;
        if (index === correctIndex) {
          correct = true;
        }
      } else {
        // Strategy 3: If correctAnswer starts with a letter and parenthesis, extract the option
        const letterMatch = currentQuestion.correctAnswer.match(/^([A-D])\)\s*(.+)$/i);
        if (letterMatch) {
          const correctIndex = letterMatch[1].toUpperCase().charCodeAt(0) - 65;
          if (index === correctIndex) {
            correct = true;
          }
        }
      }
    }
    
    setIsCorrect(correct);
    
    // Add a small delay before flipping to show the color feedback
    setTimeout(() => {
      handleFlip();
    }, 500);
  };

  const handleFlip = useCallback(() => {
    // When flipping to see the answer, update the stats
    if (!flipped) {
      updateCardStats();
    }
    setFlipped(!flipped);
    
    // Reset selection when flipping back to question
    if (flipped) {
      setSelectedAnswer(null);
      setIsCorrect(null);
    }
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
    if ((e.code === 'Space' || e.key === ' ') && !editingCloze) {
      e.preventDefault();
      handleFlip();
    }
  }, [handleFlip, editingCloze]);

  // Add global keyboard event listener
  useEffect(() => {
    // Add global event listener for space bar
    document.addEventListener('keydown', handleKeyDown as any);
    
    // Cleanup
    return () => {
      document.removeEventListener('keydown', handleKeyDown as any);
    };
  }, [handleKeyDown]);

  // Ensure card returns to front when editing ends
  useEffect(() => {
    if (!editingCloze) {
      setFlipped(false);
    }
  }, [editingCloze]);

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

      // Professional success notification
      const formatName = format === 'doc' ? 'Word Document' : format === 'csv' ? 'CSV File' : format.toUpperCase();
      toast({
        title: "✅ Export Completed",
        description: `${quiz.title} has been exported as ${formatName}. Check your downloads folder.`,
        className: "border-green-200 bg-green-50 text-green-900",
        duration: 4000,
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

  const handleClozeUpdate = async (updatedQuestion: any) => {
    if (!quiz || !supabase) return;
    
    try {
      const updatedQuestions = [...quiz.questions];
      updatedQuestions[currentQuestionIndex] = updatedQuestion;
      
      // Update local state immediately for better UX
      setQuiz({
        ...quiz,
        questions: updatedQuestions
      });
      
      // Save to database
      const response = await fetch('/api/update-quiz', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          quizId: quiz.id,
          questions: updatedQuestions
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save changes');
      }

      toast({
        title: "✅ Cloze Updated",
        description: "Your cloze deletion has been saved successfully.",
        className: "border-green-200 bg-green-50 text-green-900",
        duration: 3000,
      });
      
      // Immediately exit editing mode and return to front of card
      setEditingCloze(false);
      setFlipped(false);
      
      // Force a small delay to ensure state changes are applied
      setTimeout(() => {
        setFlipped(false);
      }, 100);
      
    } catch (error) {
      console.error('Error saving cloze changes:', error);
      toast({
        title: "Error",
        description: "Failed to save changes. Please try again.",
        variant: "destructive",
      });
      
      // Don't close the editor if save failed
    }
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      <div className="space-y-4 md:space-y-6 max-w-4xl mx-auto px-3 md:px-4 py-4 md:py-6">
        {/* Header */}
        <div className="mb-3 md:mb-6">
          {/* Top Row - Back button and title */}
          <div className="flex items-center gap-2 md:gap-3 mb-2 md:mb-4">
        <Link href="/dashboard/learn">
              <Button variant="outline" size="icon" className="rounded-full shadow-md hover:shadow-lg transition-shadow w-8 h-8 md:w-10 md:h-10">
                <ArrowLeft className="h-3 w-3 md:h-4 md:w-4" />
          </Button>
        </Link>
            <div className="min-w-0 flex-1">
              <h1 className="text-base md:text-2xl font-bold text-gray-900 truncate">{quiz.title}</h1>
            </div>
      </div>

          {/* Bottom Row - Controls (mobile: simplified, desktop: full) */}
          <div className="flex items-center justify-between">
            {/* Mobile: Just the options toggle */}
            <div className="md:hidden">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowOptions(!showOptions)}
                className={`rounded-full px-3 py-1.5 text-xs transition-colors ${
                  showOptions 
                    ? 'bg-blue-100 text-blue-600 border-blue-300' 
                    : 'bg-gray-100 text-gray-600 border-gray-300'
                }`}
              >
                {showOptions ? <Eye className="h-3 w-3 mr-1" /> : <EyeOff className="h-3 w-3 mr-1" />}
                {showOptions ? 'Hide Options' : 'Show Options'}
              </Button>
          </div>
            
            {/* Desktop: Full controls */}
            <div className="hidden md:flex items-center gap-3">
              <div className="flex items-center gap-2 bg-white rounded-full px-4 py-2 shadow-md">
                <Settings className="h-4 w-4 text-gray-600" />
                <span className="text-sm font-medium text-gray-700">Answer Choices</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowOptions(!showOptions)}
                  className={`rounded-full p-2 transition-colors ${
                    showOptions 
                      ? 'bg-blue-100 text-blue-600 hover:bg-blue-200' 
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {showOptions ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                </Button>
              </div>
              
              <Button variant="outline" size="sm" onClick={resetQuiz} className="rounded-full shadow-md px-3 py-2">
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset
          </Button>
            </div>
            
            {/* Mobile: Reset button */}
            <div className="md:hidden">
              <Button variant="outline" size="sm" onClick={resetQuiz} className="rounded-full shadow-md px-3 py-1.5">
                <RotateCcw className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="bg-white rounded-xl md:rounded-2xl shadow-lg p-3 md:p-6 mb-3 md:mb-6">
          <div className="flex justify-between items-center mb-2 md:mb-3">
            <div className="flex items-center gap-1 md:gap-2">
              <Target className="h-3 w-3 md:h-5 md:w-5 text-indigo-600" />
              <span className="text-xs md:text-sm font-semibold text-gray-700">
                {currentQuestionIndex + 1} of {totalQuestions}
              </span>
            </div>
            <div className="text-xs md:text-sm text-gray-600">
              {Math.round(progress)}%
            </div>
        </div>

        <Progress 
          value={progress} 
            className="h-1.5 md:h-3 bg-gray-100 rounded-full overflow-hidden" 
            style={{ 
              "--progress-foreground": "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" 
            } as React.CSSProperties}
          />
        </div>

        {/* Enhanced Flashcard */}
        <div className="relative">
          <div
            className={`relative w-full rounded-xl md:rounded-3xl bg-gradient-to-br from-white to-gray-50 shadow-2xl border border-gray-100 perspective-1000 ${flipped ? 'rotate-y-180' : ''} transform-style-preserve-3d transition-all duration-700 ${!editingCloze ? 'cursor-pointer hover:shadow-3xl active:scale-[0.98]' : 'cursor-default'} touch-manipulation`}
            style={{ 
              minHeight: isMobileOrTablet ? (showOptions && currentQuestion?.type === 'multiple_choice' ? '620px' : '450px') : '400px', 
              height: isMobileOrTablet ? 'auto' : '450px',
              maxHeight: isMobileOrTablet ? 'none' : '450px' 
            }}
          onClick={!editingCloze ? handleFlip : undefined}
          tabIndex={!editingCloze ? 0 : -1}
          role={!editingCloze ? "button" : undefined}
          aria-pressed={!editingCloze ? flipped : undefined}
          aria-label={!editingCloze ? "Flashcard, press space or click to flip" : undefined}
        >
          {/* Front of card (Question) */}
            <div className={`absolute w-full h-full backface-hidden ${!flipped ? 'visible' : 'invisible'} ${isMobileOrTablet ? 'overflow-hidden' : 'overflow-auto'} rounded-xl md:rounded-3xl`}>
              <div className="p-4 md:p-6 h-full flex flex-col" style={{ minHeight: isMobileOrTablet ? (showOptions && currentQuestion?.type === 'multiple_choice' ? '620px' : '450px') : 'auto' }}>
                {/* Question Header */}
                <div className="flex items-center justify-between mb-4 md:mb-4 flex-shrink-0">
                  <div className="flex items-center gap-1.5 md:gap-2">
                    <div className="w-5 h-5 md:w-7 md:h-7 rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 flex items-center justify-center">
                      <Lightbulb className="h-2.5 w-2.5 md:h-3.5 md:w-3.5 text-white" />
                    </div>
                    <span className="font-semibold text-gray-700 text-xs md:text-xs uppercase tracking-wide">
                      #{currentQuestionIndex + 1}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-xs text-gray-500 bg-gray-100 px-2 md:px-2.5 py-1 rounded-full">
                      {currentQuestion?.type === 'multiple_choice' ? 'Multiple Choice' : 
                       currentQuestion?.type === 'cloze' ? 'Cloze Deletion' : 'Open Ended'}
                    </div>
                    {currentQuestion?.type === 'cloze' && !editingCloze && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingCloze(true);
                        }}
                        className="text-xs h-6 px-2"
                      >
                        <Edit className="h-3 w-3 mr-1" />
                        Edit
                      </Button>
                    )}
                  </div>
                </div>
                
                {/* Cloze Editor (when editing) */}
                {editingCloze && currentQuestion?.type === 'cloze' && (
                  <div className="mb-4">
                    <ClozeEditor
                      key={`cloze-editor-${currentQuestionIndex}-${editingCloze}`}
                      question={currentQuestion}
                      quizId={quiz?.id}
                      allQuestions={quiz?.questions}
                      onUpdate={handleClozeUpdate}
                      autoEdit={true}
                      onCancel={() => {
                        setEditingCloze(false);
                        setFlipped(false);
                      }}
                    />
                  </div>
                )}
                
                {/* Question Text */}
                {!editingCloze && (
                  <div className="flex-grow flex flex-col justify-start">
                    <h2 className="text-lg md:text-lg font-semibold text-gray-900 leading-relaxed mb-4 md:mb-4 text-center px-1 md:px-2">
                      {currentQuestion?.type === 'cloze' 
                        ? (currentQuestion as any).clozeText?.replace(/\{\{c1::(.*?)\}\}/g, '_______________') || currentQuestion?.text
                        : currentQuestion?.text
                      }
                    </h2>
                    
                    {/* Multiple Choice Options (if enabled) */}
                    {showOptions && currentQuestion?.type === 'multiple_choice' && currentQuestion?.options && (
                      <div className="space-y-3 mt-2">
                        <div className="flex items-center gap-2 mb-3">
                          <div className="w-2.5 h-2.5 md:w-3 md:h-3 rounded bg-gradient-to-r from-green-400 to-blue-500"></div>
                          <span className="text-xs md:text-xs font-medium text-gray-600">Choose the best answer:</span>
                        </div>
                        <div className="grid gap-2.5 md:gap-2">
                          {currentQuestion.options.map((option, index) => {
                            const isSelected = selectedAnswer === option;
                            const isCorrectAnswer = isSelected && isCorrect === true;
                            const isWrongAnswer = isSelected && isCorrect === false;
                            
                            return (
                              <div
                                key={index}
                                onClick={() => handleOptionClick(option, index)}
                                className={`flex items-start gap-3 p-3 md:p-3 rounded-lg border transition-all duration-200 cursor-pointer ${
                                  isCorrectAnswer
                                    ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-300 shadow-md'
                                    : isWrongAnswer
                                    ? 'bg-gradient-to-r from-red-50 to-rose-50 border-red-300 shadow-md'
                                    : 'bg-gradient-to-r from-gray-50 to-gray-100 border-gray-200 hover:from-blue-50 hover:to-indigo-50 hover:border-blue-200'
                                }`}
                              >
                                <div className={`w-6 h-6 md:w-6 md:h-6 rounded-full border-2 flex items-center justify-center font-semibold text-xs flex-shrink-0 mt-0.5 md:mt-0 ${
                                  isCorrectAnswer
                                    ? 'bg-green-500 border-green-500 text-white'
                                    : isWrongAnswer
                                    ? 'bg-red-500 border-red-500 text-white'
                                    : 'bg-white border-gray-300 text-gray-600'
                                }`}>
                                  {isCorrectAnswer ? (
                                    <Check className="h-3 w-3" />
                                  ) : isWrongAnswer ? (
                                    <X className="h-3 w-3" />
                                  ) : (
                                    String.fromCharCode(65 + index)
                                  )}
                                </div>
                                <span className={`text-sm md:text-sm flex-1 leading-relaxed ${
                                  isCorrectAnswer
                                    ? 'text-green-800 font-medium'
                                    : isWrongAnswer
                                    ? 'text-red-800 font-medium'
                                    : 'text-gray-700'
                                }`}>
                      {option}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                
                {/* Flip Instruction */}
                {!editingCloze && (
                  <div className="text-center mt-4 md:mt-4 flex-shrink-0">
                    <div className="inline-flex items-center gap-1.5 md:gap-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white px-3 md:px-3 py-1.5 rounded-full text-xs font-medium">
                      <Zap className="h-3 w-3 md:h-3.5 md:w-3.5" />
                      <span className="hidden sm:inline">Click or press Space to reveal answer</span>
                      <span className="sm:hidden">Tap to reveal answer</span>
                    </div>
                  </div>
                )}
            </div>
          </div>
          
          {/* Back of card (Answer) */}
            <div className={`absolute w-full h-full backface-hidden rotate-y-180 ${flipped ? 'visible' : 'invisible'} ${isMobileOrTablet ? 'overflow-hidden' : 'overflow-auto'} rounded-xl md:rounded-3xl`}>
              <div 
                className={`p-4 md:p-6 h-full flex flex-col ${
                  isCorrect === true 
                    ? 'bg-gradient-to-br from-green-50 to-emerald-50' 
                    : isCorrect === false
                    ? 'bg-gradient-to-br from-red-50 to-rose-50'
                    : 'bg-gradient-to-br from-green-50 to-emerald-50'
                }`}
                style={{ minHeight: isMobileOrTablet ? (showOptions && currentQuestion?.type === 'multiple_choice' ? '620px' : '450px') : 'auto' }}
              >
                {/* Answer Header */}
                <div className="flex items-center justify-between mb-4 md:mb-4 flex-shrink-0">
                  <div className="flex items-center gap-1.5 md:gap-2">
                    <div className={`w-5 h-5 md:w-7 md:h-7 rounded-full flex items-center justify-center ${
                      isCorrect === true 
                        ? 'bg-gradient-to-r from-green-500 to-emerald-600' 
                        : isCorrect === false
                        ? 'bg-gradient-to-r from-red-500 to-rose-600'
                        : 'bg-gradient-to-r from-green-500 to-emerald-600'
                    }`}>
                      {isCorrect === true ? (
                        <CheckCircle className="h-2.5 w-2.5 md:h-3.5 md:w-3.5 text-white" />
                      ) : isCorrect === false ? (
                        <XCircle className="h-2.5 w-2.5 md:h-3.5 md:w-3.5 text-white" />
                      ) : (
                        <CheckCircle className="h-2.5 w-2.5 md:h-3.5 md:w-3.5 text-white" />
                      )}
                    </div>
                    <span className="font-semibold text-gray-700 text-xs md:text-xs uppercase tracking-wide">
                      {isCorrect === true ? 'Correct!' : isCorrect === false ? 'Incorrect' : 'Answer'}
                    </span>
                  </div>
                  <div className={`text-xs font-medium px-2 md:px-2.5 py-1 rounded-full ${
                    isCorrect === true 
                      ? 'text-green-700 bg-green-100' 
                      : isCorrect === false
                      ? 'text-red-700 bg-red-100'
                      : 'text-green-700 bg-green-100'
                  }`}>
                    {isCorrect === true ? 'Great!' : isCorrect === false ? 'Try Again' : 'Solution'}
                  </div>
                </div>
                
                {/* Answer Content */}
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
                        <div className="text-center max-w-md">
                      {answerLetter && (
                            <div className={`w-14 h-14 rounded-full flex items-center justify-center text-white text-xl font-bold mx-auto mb-3 shadow-lg ${
                              isCorrect === true 
                                ? 'bg-gradient-to-r from-green-500 to-emerald-600' 
                                : isCorrect === false
                                ? 'bg-gradient-to-r from-red-500 to-rose-600'
                                : 'bg-gradient-to-r from-green-500 to-emerald-600'
                            }`}>
                              {answerLetter}
                        </div>
                      )}
                          <p className="text-base font-semibold text-gray-900 leading-relaxed">
                            {correctText}
                          </p>
                          {isCorrect === false && selectedAnswer && (
                            <div className="mt-3 p-3 bg-white rounded-lg border border-red-200">
                              <p className="text-sm text-red-700">
                                <span className="font-medium">You selected:</span> {selectedAnswer}
                              </p>
                            </div>
                          )}
                    </div>
                  );
                })()
              ) : (
                <div className="text-center max-w-md">
                  {currentQuestion?.type === 'cloze' ? (
                    <>
                      <div className="mb-4 p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
                        <div className="text-sm text-gray-600 mb-2 font-medium">Complete sentence:</div>
                        <div className="text-base text-gray-900 leading-relaxed">
                          {(currentQuestion as any).originalText || currentQuestion?.text}
                        </div>
                      </div>
                      <div className={`w-14 h-14 rounded-full flex items-center justify-center text-white mx-auto mb-4 shadow-lg ${
                        isCorrect === true 
                          ? 'bg-gradient-to-r from-green-500 to-emerald-600' 
                          : isCorrect === false
                          ? 'bg-gradient-to-r from-red-500 to-rose-600'
                          : 'bg-gradient-to-r from-green-500 to-emerald-600'
                      }`}>
                        {isCorrect === true ? (
                          <Check className="h-7 w-7" />
                        ) : isCorrect === false ? (
                          <X className="h-7 w-7" />
                        ) : (
                          <Check className="h-7 w-7" />
                        )}
                      </div>
                      <div className={`p-4 rounded-lg border shadow-sm ${
                        isCorrect === true 
                          ? 'bg-green-50 border-green-200' 
                          : isCorrect === false
                          ? 'bg-red-50 border-red-200'
                          : 'bg-green-50 border-green-200'
                      }`}>
                        <div className={`text-sm font-medium mb-1 ${
                          isCorrect === true 
                            ? 'text-green-700' 
                            : isCorrect === false
                            ? 'text-red-700'
                            : 'text-green-700'
                        }`}>
                          Answer:
                        </div>
                        <p className={`text-lg font-semibold ${
                          isCorrect === true 
                            ? 'text-green-900' 
                            : isCorrect === false
                            ? 'text-red-900'
                            : 'text-green-900'
                        }`}>
                          {currentQuestion?.correctAnswer}
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className={`w-14 h-14 rounded-full flex items-center justify-center text-white mx-auto mb-3 shadow-lg ${
                        isCorrect === true 
                          ? 'bg-gradient-to-r from-green-500 to-emerald-600' 
                          : isCorrect === false
                          ? 'bg-gradient-to-r from-red-500 to-rose-600'
                          : 'bg-gradient-to-r from-green-500 to-emerald-600'
                      }`}>
                        {isCorrect === true ? (
                          <Check className="h-7 w-7" />
                        ) : isCorrect === false ? (
                          <X className="h-7 w-7" />
                        ) : (
                          <Check className="h-7 w-7" />
                        )}
                      </div>
                      <p className="text-base font-semibold text-gray-900 leading-relaxed">
                        {currentQuestion?.correctAnswer}
                      </p>
                    </>
                  )}
                </div>
              )}
            </div>
            
                {/* Flip Back Instruction */}
                <div className="text-center mt-4 md:mt-4 flex-shrink-0">
                  <div className={`inline-flex items-center gap-1.5 md:gap-2 text-white px-3 md:px-3 py-1.5 rounded-full text-xs font-medium ${
                    isCorrect === true 
                      ? 'bg-gradient-to-r from-green-500 to-emerald-600' 
                      : isCorrect === false
                      ? 'bg-gradient-to-r from-red-500 to-rose-600'
                      : 'bg-gradient-to-r from-green-500 to-emerald-600'
                  }`}>
                    <RotateCcw className="h-3 w-3 md:h-3.5 md:w-3.5" />
                    <span className="hidden sm:inline">Click or press Space to see question</span>
                    <span className="sm:hidden">Tap to see question</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Controls */}
        <div className="flex justify-between items-center gap-2 md:gap-4">
          <Button
            variant="outline"
            onClick={handlePrevQuestion}
            disabled={currentQuestionIndex === 0}
            className="rounded-full px-4 md:px-6 py-2.5 md:py-3 shadow-md hover:shadow-lg transition-all disabled:opacity-50 min-w-0 flex-shrink-0"
          >
            <ChevronLeft className="h-4 w-4 md:h-5 md:w-5 md:mr-2" />
            <span className="hidden md:inline">Previous</span>
          </Button>
          
          <div className="flex items-center gap-1 md:gap-2 text-xs md:text-sm text-gray-600 bg-white rounded-full px-3 md:px-4 py-2 shadow-md flex-1 justify-center min-w-0">
            <Trophy className="h-3 w-3 md:h-4 md:w-4 flex-shrink-0" />
            <span className="truncate text-center">
              <span className="hidden sm:inline">Keep going! You're doing great.</span>
              <span className="sm:hidden">Keep going!</span>
            </span>
          </div>
          
          <Button
            onClick={handleNextAfterReview}
            className="rounded-full px-4 md:px-6 py-2.5 md:py-3 shadow-md hover:shadow-lg transition-all bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 min-w-0 flex-shrink-0"
          >
            <span className="hidden md:inline">Next</span>
            <ChevronRight className="h-4 w-4 md:h-5 md:w-5 md:ml-2" />
          </Button>
        </div>

        {/* Enhanced Progress Section */}
        <div className="bg-white rounded-2xl shadow-lg p-4 md:p-8">
          <div className="flex items-center gap-2 md:gap-3 mb-4 md:mb-6">
            <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 flex items-center justify-center">
              <Target className="h-4 w-4 md:h-5 md:w-5 text-white" />
            </div>
            <h2 className="text-lg md:text-xl font-semibold text-gray-900">Your Progress</h2>
      </div>

          <div className="space-y-6">
          <div>
              <div className="flex justify-between text-sm mb-2 text-gray-700">
                <span className="font-medium">Cards Viewed</span>
                <span className="font-semibold">
                  {Object.values(questionStats).filter(stat => stat.last_studied).length} of {quiz.questions.length}
                </span>
            </div>
            <Progress 
              value={(Object.values(questionStats).filter(stat => stat.last_studied).length / quiz.questions.length) * 100} 
                className="h-3 bg-gray-100 rounded-full" 
                style={{ 
                  "--progress-foreground": "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" 
                } as React.CSSProperties}
            />
          </div>
          
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
              <div className="p-4 md:p-6 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-100">
                <div className="flex items-center gap-2 md:gap-3 mb-2">
                  <div className="w-6 h-6 md:w-8 md:h-8 rounded-full bg-blue-500 flex items-center justify-center">
                    <Trophy className="h-3 w-3 md:h-4 md:w-4 text-white" />
                  </div>
                  <h3 className="text-xs md:text-sm font-semibold text-blue-900">Completed Sessions</h3>
                </div>
                <p className="text-xl md:text-2xl font-bold text-blue-900">{learningProgress?.completed_sessions || 0}</p>
            </div>
            
              <div className="p-4 md:p-6 bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border border-green-100">
                <div className="flex items-center gap-2 md:gap-3 mb-2">
                  <div className="w-6 h-6 md:w-8 md:h-8 rounded-full bg-green-500 flex items-center justify-center">
                    <CheckCircle className="h-3 w-3 md:h-4 md:w-4 text-white" />
                  </div>
                  <h3 className="text-xs md:text-sm font-semibold text-green-900">Last Studied</h3>
                </div>
                <p className="text-sm font-medium text-green-800">
                {learningProgress?.last_studied 
                  ? new Date(learningProgress.last_studied).toLocaleDateString() 
                    : 'Today'}
              </p>
            </div>
          </div>
          
          <Button 
            onClick={saveProgress}
            disabled={savingProgress}
              className="w-full rounded-xl py-4 text-lg font-semibold bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 shadow-lg hover:shadow-xl transition-all"
          >
            {savingProgress ? (
              <>
                  <Loader2 className="h-5 w-5 mr-3 animate-spin" />
                  Saving Progress...
                </>
              ) : (
                <>
                  <CheckCircle className="h-5 w-5 mr-3" />
                  Save Progress
                </>
              )}
          </Button>
        </div>
      </div>

        {/* Export Section */}
        <div className="bg-white rounded-2xl shadow-lg p-4 md:p-8">
          <div className="flex items-center gap-2 md:gap-3 mb-4 md:mb-6">
            <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-gradient-to-r from-purple-500 to-pink-600 flex items-center justify-center">
              <Send className="h-4 w-4 md:h-5 md:w-5 text-white" />
            </div>
            <h2 className="text-lg md:text-xl font-semibold text-gray-900">Export Quiz</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
          <Button
              size="lg"
              variant="outline"
              onClick={() => {
                if (quiz) {
                  handleExport(quiz, 'doc');
                }
              }}
              className="flex items-center justify-center rounded-xl py-3 md:py-4 border-2 border-blue-200 hover:bg-blue-50 hover:border-blue-300 text-sm md:text-base"
            >
              <FileText className="h-4 w-4 md:h-5 md:w-5 mr-1 md:mr-2 text-blue-600" />
              <span className="font-semibold">
                <span className="hidden sm:inline">Word Document</span>
                <span className="sm:hidden">Word</span>
              </span>
            </Button>
            
            <Button
              size="lg"
              variant="outline"
              onClick={() => {
                if (quiz) {
                  handleExport(quiz, 'csv');
                }
              }}
              className="flex items-center justify-center rounded-xl py-3 md:py-4 border-2 border-green-200 hover:bg-green-50 hover:border-green-300 text-sm md:text-base"
            >
              <FileText className="h-4 w-4 md:h-5 md:w-5 mr-1 md:mr-2 text-green-600" />
              <span className="font-semibold">
                <span className="hidden sm:inline">CSV File</span>
                <span className="sm:hidden">CSV</span>
              </span>
            </Button>
            
            <Button
              size="lg"
            variant="outline"
            onClick={() => {
              if (quiz) {
                handleAnkiExport(quiz);
              }
            }}
              className={`flex items-center justify-center rounded-xl py-3 md:py-4 border-2 text-sm md:text-base ${
              isMobileOrTablet 
                  ? 'opacity-60 cursor-help border-gray-200 hover:bg-gray-50' 
                  : 'border-purple-200 hover:bg-purple-50 hover:border-purple-300'
            }`}
          >
            {isMobileOrTablet && (
                <AlertCircle className="h-4 w-4 md:h-5 md:w-5 mr-1 md:mr-2 text-gray-400" />
            )}
            {!isMobileOrTablet && (
                <Send className="h-4 w-4 md:h-5 md:w-5 mr-1 md:mr-2 text-purple-600" />
            )}
              <span className="font-semibold">
                <span className="hidden sm:inline">Anki Export</span>
                <span className="sm:hidden">Anki</span>
              </span>
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
    </div>
  );
}