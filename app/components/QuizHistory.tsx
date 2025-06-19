'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Button } from '@/app/components/ui/button'
import { Quiz, Question } from '@/lib/types'
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from '@/app/components/ui/dialog'
import { Calendar, FileText, Clock, BarChart3, Loader2, Edit, Save, Send, Tag, BookmarkPlus, Trash2, AlertTriangle } from 'lucide-react'
import { useToast } from '@/app/components/ui/use-toast'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/app/components/ui/tooltip"
import { Input } from '@/app/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/app/components/ui/label'
import Link from 'next/link'
import SubjectManager, { Subject } from './SubjectManager'
import { User, SupabaseClient } from '@supabase/supabase-js'
import { useAuth } from '@/app/providers/AuthProvider'
import { useSupabase } from '@/utils/supabase/client'
import { AnkiExportDialog } from './AnkiExportDialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/app/components/ui/dropdown-menu"

// Helper function to determine text color based on background color
const getContrastColor = (hexColor: string): string => {
  // Remove the hash if it exists
  const hex = hexColor.replace('#', '');
  
  // Convert hex to RGB
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  
  // Calculate luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  
  // Return black for light colors, white for dark colors
  return luminance > 0.5 ? '#000000' : '#FFFFFF';
};

export default function QuizHistory({ limit }: { limit?: number }) {
  const [quizzes, setQuizzes] = useState<Quiz[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedQuiz, setSelectedQuiz] = useState<Quiz | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [exporting, setExporting] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [isAnkiDialogOpen, setIsAnkiDialogOpen] = useState(false)
  const [ankiDeckName, setAnkiDeckName] = useState('')
  const [sendingToAnki, setSendingToAnki] = useState(false)
  const { toast } = useToast()
  const [editSubject, setEditSubject] = useState<Subject | null>(null)
  const [categorizingQuiz, setCategorizingQuiz] = useState<Quiz | null>(null)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [quizToDelete, setQuizToDelete] = useState<Quiz | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const { user } = useAuth()
  const { supabase, loading: supabaseLoading } = useSupabase()
  const [isMobileOrTablet, setIsMobileOrTablet] = useState(false)

  // Add useEffect for mobile detection
  useEffect(() => {
    // Check if device is mobile or tablet
    const checkDevice = () => {
      const userAgent = navigator.userAgent.toLowerCase();
      const isMobile = /iphone|ipad|ipod|android|blackberry|windows phone/g.test(userAgent);
      setIsMobileOrTablet(isMobile);
    };

    checkDevice();
    window.addEventListener('resize', checkDevice);
    return () => window.removeEventListener('resize', checkDevice);
  }, []);

  // Combine loading states
  const isLoading = loading || supabaseLoading;

  useEffect(() => {
    if (!user || !supabase) {
      console.log('Missing user or supabase client:', { user: !!user, supabase: !!supabase });
      return;
    }

    const fetchQuizzes = async () => {
      try {
        setLoading(true);
        console.log('Current user:', { id: user.id, email: user.email });
        
        // First verify the session is valid
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) {
          throw new Error(`Session error: ${sessionError.message}`);
        }
        
        if (!session) {
          console.log('No active session, attempting to refresh...');
          const { error: refreshError } = await supabase.auth.refreshSession();
          if (refreshError) {
            throw new Error(`Session refresh error: ${refreshError.message}`);
          }
        }

        // Fetch quizzes with proper error handling, excluding soft-deleted quizzes
        console.log("Fetching quizzes for user ID:", user.id);
        const { data: quizzesData, error: quizzesError } = await supabase
          .from('quizzes')
          .select('*')
          .eq('user_id', user.id)
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
          .limit(limit || 50);

        if (quizzesError) {
          console.error("Error fetching quizzes:", quizzesError);
          throw new Error(`Database error: ${quizzesError.message}`);
        }

        if (!quizzesData || quizzesData.length === 0) {
          console.log('No quizzes found for user:', user.id);
          setQuizzes([]);
          return;
        }

        // Log the first quiz to check the structure
        console.log("First quiz structure:", JSON.stringify(quizzesData[0], null, 2));
        
        // Normalize quiz data to handle field name mismatches
        const normalizedQuizzes = quizzesData.map((quiz: any) => ({
          id: quiz.id,
          title: quiz.title,
          user_id: quiz.user_id,
          created_at: quiz.created_at,
          pdf_url: quiz.pdf_url || '',
          questions: quiz.questions || [],
          settings: quiz.settings || {
            numberOfQuestions: quiz.questions?.length || 0,
            difficulty: 'medium',
            questionType: 'mixed'
          },
          subject: quiz.subject || '',
          color: quiz.color || ''
        }));
        
        console.log("Normalized quizzes:", normalizedQuizzes);
        setQuizzes(normalizedQuizzes);
        
      } catch (error) {
        console.error('Error in fetchQuizzes:', error);
        toast({
          title: 'Error loading quizzes',
          description: error instanceof Error ? error.message : 'Failed to load quiz history',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchQuizzes();
  }, [user, supabase, toast, limit]);

  const handleExport = async (quiz: Quiz, format: 'doc' | 'csv' | 'anki') => {
    try {
      setExporting(`${quiz.id}-${format}`)
      toast({
        title: "Exporting quiz",
        description: `Preparing ${format.toUpperCase()} export...`,
      })
      
      const response = await fetch(`/api/export-quiz?id=${quiz.id}&format=${format}`, {
        method: 'GET',
      })

      if (!response.ok) {
        throw new Error(`Failed to export quiz: ${response.statusText}`)
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      if (format === 'doc') {
        a.download = `${quiz.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.docx`;
      } else if (format === 'csv') {
        a.download = `${quiz.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.csv`;
      } else if (format === 'anki') {
        a.download = `${quiz.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.txt`;
      }
      document.body.appendChild(a)
      a.click()

      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      
      toast({
        title: "Export successful",
        description: `Your quiz has been exported as ${format.toUpperCase()}`,
      })
    } catch (error) {
      console.error('Error exporting quiz:', error)
      toast({
        title: "Export failed",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      })
    } finally {
      setExporting(null)
    }
  }

  const openQuizDetails = (quiz: Quiz) => {
    setSelectedQuiz(quiz);
    setCategorizingQuiz(null);
    setIsDialogOpen(true);
  }

  const startCategorizing = (quiz: Quiz) => {
    setCategorizingQuiz(quiz);
    setIsDialogOpen(true);
    
    // Initialize the subject if the quiz already has one
    if (quiz.subject && quiz.color) {
      setEditSubject({
        id: 'temp-id',
        name: quiz.subject,
        color: quiz.color,
        user_id: '',
        created_at: ''
      });
    } else {
      setEditSubject(null);
    }
  };

  const saveCategorizationOnly = async () => {
    if (!categorizingQuiz) return;
    
    try {
      setSaving(true);
      
      const { error } = await supabase
        .from('quizzes')
        .update({
          subject: editSubject?.name || null,
          color: editSubject?.color || null
        })
        .eq('id', categorizingQuiz.id);
      
      if (error) throw error;
      
      // Update the local state with proper type casting
      const updatedQuiz: Quiz = {
        ...categorizingQuiz,
        subject: editSubject?.name,
        color: editSubject?.color
      };
      
      setQuizzes(quizzes.map(q => q.id === categorizingQuiz.id ? updatedQuiz : q));
      setSelectedQuiz(updatedQuiz);
      setCategorizingQuiz(null);
      
      toast({
        title: 'Success',
        description: 'Quiz categorized successfully',
      });
    } catch (error) {
      console.error('Error categorizing quiz:', error);
      toast({
        title: 'Error',
        description: 'Failed to categorize quiz',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const cancelCategorizing = () => {
    setCategorizingQuiz(null);
    setEditSubject(null);
  };

  const openDeleteConfirmation = (quiz: Quiz) => {
    setQuizToDelete(quiz);
    setIsDeleteDialogOpen(true);
  };

  const cancelDelete = () => {
    setQuizToDelete(null);
    setIsDeleteDialogOpen(false);
  };

  const handleDelete = async (quiz: Quiz) => {
    if (!quiz) return;
    try {
      setDeleting(true);
      const { error } = await supabase
        .from('quizzes')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', quiz.id);
      
      if (error) throw error;
      
      // Remove from UI
      setQuizzes(quizzes.filter(q => q.id !== quiz.id));
      setIsDeleteDialogOpen(false);
      setQuizToDelete(null);
      
      toast({
        title: 'Success',
        description: 'Quiz deleted successfully',
      });
    } catch (error) {
      console.error('Error deleting quiz:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete quiz',
        variant: 'destructive',
      });
    } finally {
      setDeleting(false);
    }
  };

  const deleteQuestion = (questionIndex: number) => {
    if (selectedQuiz && selectedQuiz.questions.length > 1) {
      const updatedQuestions = [...selectedQuiz.questions];
      updatedQuestions.splice(questionIndex, 1);
      
      setSelectedQuiz({
        ...selectedQuiz,
        questions: updatedQuestions
      });
      
      // Adjust current question index if needed
      if (questionIndex >= updatedQuestions.length) {
        setCurrentQuestionIndex(updatedQuestions.length - 1);
      }
      
      toast({
        title: 'Question deleted',
        description: 'The question has been removed from the quiz.',
      });
    } else {
      toast({
        title: 'Cannot delete question',
        description: 'A quiz must have at least one question.',
        variant: 'destructive',
      });
    }
  };

  const addNewQuestion = () => {
    if (selectedQuiz) {
      // Create a new question based on the quiz's question type setting
      const questionType = selectedQuiz.settings.questionType === 'mixed' 
        ? 'multiple_choice' // Default to multiple choice for mixed quizzes
        : selectedQuiz.settings.questionType;
      
      const newQuestion: Question = {
        id: `temp-${Date.now()}`, // Temporary ID
        quizId: selectedQuiz.id,
        text: '',
        type: questionType as 'multiple_choice' | 'open_ended',
        correctAnswer: '',
      };
      
      // Add options if it's multiple choice
      if (questionType === 'multiple_choice') {
        newQuestion.options = ['', '', '', ''];
      }
      
      const updatedQuestions = [...selectedQuiz.questions, newQuestion];
      
      setSelectedQuiz({
        ...selectedQuiz,
        questions: updatedQuestions
      });
      
      // Navigate to the new question
      setCurrentQuestionIndex(updatedQuestions.length - 1);
      
      toast({
        title: 'Question added',
        description: 'A new question has been added to the quiz.',
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

    // Set the selected quiz and open the dialog
    setSelectedQuiz(quiz);
    setIsAnkiDialogOpen(true);
  };

  const closeAnkiDialog = () => {
    setIsAnkiDialogOpen(false);
    setSelectedQuiz(null);
  };

  if (loading) {
    return <div className="text-center py-4">Loading your quiz history...</div>
  }

  if (quizzes.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500 dark:text-gray-400">No quizzes generated yet. Upload a PDF to get started!</p>
      </div>
    )
  }

  return (
    <>
    <div className="space-y-4">
      {quizzes.map((quiz) => (
        <div
          key={quiz.id}
          className={`p-4 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors ${
            quiz.subject && quiz.color 
              ? 'border-l-4' 
              : 'bg-gray-50 dark:bg-gray-700'
          }`}
          style={quiz.subject && quiz.color ? {
            borderLeftColor: quiz.color,
            backgroundColor: `${quiz.color}20`,
          } : {}}
        >
          <div className="flex flex-col">
            {quiz.subject ? (
              <div className="mb-2">
                <div 
                  className="inline-flex items-center px-3 py-1 rounded-md text-sm"
                  style={{ 
                    backgroundColor: quiz.color || '#E5E7EB', 
                    color: quiz.color ? getContrastColor(quiz.color) : '#374151' 
                  }}
                >
                  <Tag className="h-3 w-3 mr-2" />
                  {quiz.subject}
                </div>
              </div>
            ) : null}
            
          <div className="flex justify-between items-start">
            <div>
              <h3 className="font-semibold">{quiz.title}</h3>
                <div className="flex flex-wrap gap-x-4 mt-1">
                  <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center">
                    <Calendar className="h-3.5 w-3.5 mr-1" />
                    {new Date(quiz.created_at).toLocaleDateString()}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center">
                    <FileText className="h-3.5 w-3.5 mr-1" />
                    {quiz.questions.length} questions
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center">
                    <BarChart3 className="h-3.5 w-3.5 mr-1" />
                    {quiz.settings.difficulty} difficulty
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center">
                    <Clock className="h-3.5 w-3.5 mr-1" />
                    {quiz.settings.questionType} questions
                  </p>
                </div>
              </div>
            </div>
            
            {/* Action Buttons - Touch scrollable on mobile */}
            <div className="mt-4 -mb-1 overflow-x-auto scrollbar-none md:overflow-x-visible">
              <div className="flex space-x-2 min-w-max md:min-w-0 touch-pan-x">
                {!quiz.subject ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs text-gray-500 hover:text-primary whitespace-nowrap"
                    onClick={(e) => {
                      e.stopPropagation();
                      startCategorizing(quiz);
                    }}
                  >
                    <BookmarkPlus className="h-3 w-3 mr-1" />
                    Add Subject
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="whitespace-nowrap"
                    onClick={(e) => {
                      e.stopPropagation();
                      startCategorizing(quiz);
                    }}
                  >
                    <Tag className="mr-2 h-3 w-3" />
                    Edit Subject
                  </Button>
                )}

                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          openDeleteConfirmation(quiz);
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Delete quiz</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      <FileText className="mr-2 h-3 w-3" />
                      Export
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem 
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleExport(quiz, 'doc');
                      }}
                    >
                      Export as DOCX
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleExport(quiz, 'csv');
                      }}
                    >
                      Export as CSV
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleAnkiExport(quiz);
                      }}
                      className="flex items-center"
                    >
                      <Send className="mr-2 h-4 w-4" />
                      Export to Anki
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>

    <Dialog 
      open={isDialogOpen} 
      onOpenChange={(open) => {
        setIsDialogOpen(open);
        if (!open) {
          setCurrentQuestionIndex(0);
        }
      }}
    >
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {categorizingQuiz ? (
              <div className="flex items-center justify-between">
                <span className="flex-1 mr-4">{categorizingQuiz.title}</span>
                <span className="text-sm text-gray-500">Categorize Quiz</span>
              </div>
            ) : (
              <>
                {selectedQuiz?.subject && (
                  <div className="mb-2">
                    <div 
                      className="inline-flex items-center px-3 py-1 rounded-md text-sm"
                      style={{ 
                        backgroundColor: selectedQuiz.color || '#E5E7EB', 
                        color: selectedQuiz.color ? getContrastColor(selectedQuiz.color) : '#374151' 
                      }}
                    >
                      <Tag className="h-3 w-3 mr-2" />
                      {selectedQuiz.subject}
                    </div>
                  </div>
                )}
                <div className="text-xl font-semibold">{selectedQuiz?.title}</div>
              </>
            )}
          </DialogTitle>
          <DialogDescription className="flex flex-wrap gap-x-4 mt-1">
            <span className="flex items-center">
              <Calendar className="h-3.5 w-3.5 mr-1" />
              Created: {selectedQuiz && new Date(selectedQuiz.created_at).toLocaleDateString()}
            </span>
            <span className="flex items-center">
              <FileText className="h-3.5 w-3.5 mr-1" />
              {selectedQuiz?.questions.length} questions
            </span>
            <span className="flex items-center">
              <BarChart3 className="h-3.5 w-3.5 mr-1" />
              {selectedQuiz?.settings.difficulty} difficulty
            </span>
            <span className="flex items-center">
              <Clock className="h-3.5 w-3.5 mr-1" />
              {selectedQuiz?.settings.questionType} questions
            </span>
          </DialogDescription>
        </DialogHeader>
        
        <div className="overflow-y-auto flex-grow pr-2 mt-4">
          {categorizingQuiz ? (
            <div className="space-y-4">
              <div className="border rounded-md p-4">
                <h3 className="text-lg font-medium mb-4">Categorize Quiz</h3>
                <p className="text-sm text-gray-500 mb-4">
                  Add a subject and color to organize your quizzes. This helps you find related quizzes more easily.
                </p>
                <SubjectManager
                  onSelectSubject={setEditSubject}
                  selectedSubjectId={editSubject?.id}
                />
              </div>
              
              <div className="flex justify-end space-x-2 mt-4">
                <Button variant="outline" onClick={cancelCategorizing}>
                  Cancel
                </Button>
                <Button onClick={saveCategorizationOnly} disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Tag className="mr-2 h-4 w-4" />
                      Save Categorization
                    </>
                  )}
                </Button>
              </div>
            </div>
          ) : (
            // View mode
            selectedQuiz?.questions.map((question, index) => (
              <div key={index} className="mb-6">
                <p className="font-medium mb-2">
                  {index + 1}. {question.text}
                </p>
                {question.type === 'multiple_choice' && question.options && (
                  <ul className="space-y-1 ml-6">
                    {question.options.map((option, optIndex) => {
                      // Check if this option is the correct answer using multiple strategies
                      let isCorrect = option === question.correctAnswer;
                      
                      if (!isCorrect) {
                        // Check if correctAnswer is just a letter (A, B, C, D)
                        const answerLetter = question.correctAnswer.trim().toUpperCase();
                        if (answerLetter.match(/^[A-D]$/)) {
                          const letterIndex = answerLetter.charCodeAt(0) - 65;
                          isCorrect = optIndex === letterIndex;
                        }
                      }
                      
                      return (
                        <li key={optIndex} className="flex items-start">
                          <span className={`${isCorrect ? 'bg-green-100 dark:bg-green-900/30 px-2 py-1 rounded-md' : ''}`}>
                            • {option}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
                {question.correctAnswer && question.type !== 'multiple_choice' && (
                  <div className="mt-2 ml-6">
                    <strong>Answer: </strong>
                    <span className="bg-green-100 dark:bg-green-900/30 px-2 py-1 rounded-md">
                      {question.correctAnswer}
                    </span>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
        
        <DialogFooter className="mt-4">
          <div className="flex space-x-2">
            {categorizingQuiz ? (
              null
            ) : (
              <>
                <Button variant="outline" size="sm" onClick={() => setIsDialogOpen(false)}>
                  Close
                </Button>
                
                <Button 
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setCategorizingQuiz(selectedQuiz);
                  }}
                >
                  <BookmarkPlus className="mr-2 h-4 w-4" />
                  Categorize
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  className="text-red-500 hover:text-red-700 hover:bg-red-50"
                  onClick={() => openDeleteConfirmation(selectedQuiz!)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Quiz
                </Button>
                
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={exporting === `${selectedQuiz?.id}-doc`}
                        onClick={() => selectedQuiz && handleExport(selectedQuiz, 'doc')}
                      >
                        {exporting === `${selectedQuiz?.id}-doc` ? (
                          <>
                            <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                            Exporting...
                          </>
                        ) : 'Export DOC'}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Export as a Word document (.docx)</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={exporting === `${selectedQuiz?.id}-csv`}
                        onClick={() => selectedQuiz && handleExport(selectedQuiz, 'csv')}
                      >
                        {exporting === `${selectedQuiz?.id}-csv` ? (
                          <>
                            <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                            Exporting...
                          </>
                        ) : 'Export CSV'}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Export as CSV (compatible with Quizlet)</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={sendingToAnki}
                        onClick={() => selectedQuiz && handleAnkiExport(selectedQuiz)}
                      >
                        {sendingToAnki ? (
                          <>
                            <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                            Sending...
                          </>
                        ) : (
                          <>
                            <Send className="mr-2 h-3 w-3" />
                            Export to Anki
                          </>
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Export directly to Anki (requires Anki with Anki-Connect plugin)</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Replace the old Anki Deck Dialog with our new AnkiExportDialog component */}
    {selectedQuiz && (
      <AnkiExportDialog
        isOpen={isAnkiDialogOpen}
        onClose={closeAnkiDialog}
        quizId={selectedQuiz.id}
      />
    )}

    {/* Delete Confirmation Dialog */}
    <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete Quiz</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete this quiz? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={cancelDelete}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => handleDelete(quizToDelete!)}
            disabled={deleting}
          >
            {deleting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Deleting...
              </>
            ) : (
              'Delete Quiz'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </>
)
} 