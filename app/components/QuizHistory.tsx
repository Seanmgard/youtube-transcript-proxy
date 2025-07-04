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
import { AnkiExportDialog } from '@/app/components/AnkiExportDialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/app/components/ui/dropdown-menu"
import ClozeEditor from '@/app/components/ClozeEditor'

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
      
      // Professional success notification
      const formatName = format === 'doc' ? 'Word Document' : format === 'csv' ? 'CSV File' : format.toUpperCase();
      toast({
        title: "✅ Export Completed",
        description: `${quiz.title} has been exported as ${formatName}. Check your downloads folder.`,
        className: "border-green-200 bg-green-50 text-green-900",
        duration: 4000,
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
        title: "📚 Quiz Categorized",
        description: `${categorizingQuiz.title} has been successfully organized under "${editSubject?.name}" subject.`,
        className: "border-green-200 bg-green-50 text-green-900",
        duration: 3000,
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
        title: "🗑️ Quiz Deleted",
        description: `${quiz.title} has been permanently removed from your library.`,
        className: "border-green-200 bg-green-50 text-green-900",
        duration: 3000,
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
        title: "❌ Question Removed",
        description: "The question has been successfully removed from the quiz.",
        className: "border-orange-200 bg-orange-50 text-orange-900",
        duration: 3000,
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
      const questionType = selectedQuiz.settings.questionType || 'multiple_choice';
      
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
        title: "➕ Question Added",
        description: "A new question has been successfully added to the quiz.",
        className: "border-green-200 bg-green-50 text-green-900",
        duration: 3000,
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
        <p className="text-gray-500">No quizzes generated yet. Upload a PDF to get started!</p>
      </div>
    )
  }

  return (
    <>
    <div className="space-y-4">
      {quizzes.map((quiz) => (
        <div
          key={quiz.id}
          className={`p-4 rounded-lg hover:bg-gray-100 transition-colors ${
            quiz.subject && quiz.color 
              ? 'border-l-4' 
              : 'bg-gray-50'
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
              <div className="flex-1">
                <h3 className="font-medium text-gray-900 mb-1">{quiz.title}</h3>
                <div className="flex flex-wrap gap-x-4 mt-1">
                  <p className="text-sm text-gray-600 flex items-center">
                    <Calendar className="h-3.5 w-3.5 mr-1" />
                    {new Date(quiz.created_at).toLocaleDateString()}
                  </p>
                  <p className="text-sm text-gray-600 flex items-center">
                    <Clock className="h-3.5 w-3.5 mr-1" />
                    {quiz.questions?.length || 0} questions
                  </p>
                  <p className="text-sm text-gray-600 flex items-center">
                    <BarChart3 className="h-3.5 w-3.5 mr-1" />
                    {quiz.settings?.difficulty || 'Medium'}
                  </p>
                  <p className="text-sm text-gray-600 flex items-center">
                    <FileText className="h-3.5 w-3.5 mr-1" />
                    {quiz.settings?.questionType || 'Multiple Choice'}
                  </p>
                </div>
              </div>

              {/* Action Buttons - Touch scrollable on mobile */}
              <div className="mt-4 -mb-1 overflow-x-auto scrollbar-none md:overflow-x-visible">
                <div className="flex space-x-2 min-w-max md:min-w-0 touch-pan-x">
                  {!quiz.subject ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs text-gray-600 hover:text-gray-900 whitespace-nowrap"
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
                      className="text-gray-700 border-gray-300 hover:bg-gray-50 whitespace-nowrap"
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
                          className="text-red-600 border-red-300 hover:bg-red-50"
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
                      <Button variant="outline" size="sm" className="text-gray-700 border-gray-300 hover:bg-gray-50">
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
                        className="text-gray-900 hover:bg-gray-100"
                      >
                        Export as DOCX
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleExport(quiz, 'csv');
                        }}
                        className="text-gray-900 hover:bg-gray-100"
                      >
                        Export as CSV
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleAnkiExport(quiz);
                        }}
                        className="flex items-center text-gray-900 hover:bg-gray-100"
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
      <DialogContent className="max-w-[95vw] sm:max-w-3xl max-h-[95vh] sm:max-h-[80vh] overflow-hidden flex flex-col mx-4 sm:mx-auto">
        <DialogHeader className="px-4 sm:px-6 pb-4">
          <DialogTitle>
            {categorizingQuiz ? (
              <div className="flex items-center justify-between">
                <span className="flex-1 mr-4 text-lg sm:text-xl">{categorizingQuiz.title}</span>
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
                <div className="text-lg sm:text-xl font-semibold">{selectedQuiz?.title}</div>
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
        
        <div className="overflow-y-auto flex-grow px-4 sm:px-6 pr-2 sm:pr-8 mt-4">
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
                <p className="font-medium mb-2 text-gray-900">
                  {index + 1}. {question.type === 'cloze' 
                    ? (question as any).clozeText?.replace(/\{\{c1::(.*?)\}\}/g, '_______________')
                    : question.text
                  }
                </p>
                
                {question.type === 'cloze' && (
                  <ClozeEditor 
                    question={question} 
                    quizId={selectedQuiz.id}
                    allQuestions={selectedQuiz.questions}
                    onUpdate={(updatedQuestion: any) => {
                      const updatedQuestions = [...selectedQuiz.questions];
                      updatedQuestions[index] = updatedQuestion;
                      // Update the selectedQuiz
                      setSelectedQuiz({
                        ...selectedQuiz,
                        questions: updatedQuestions
                      });
                      // Also update the main quizzes list
                      setQuizzes(quizzes.map(q => 
                        q.id === selectedQuiz.id 
                          ? {...q, questions: updatedQuestions}
                          : q
                      ));
                    }}
                  />
                )}
                
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
                          <span className={`text-gray-800 ${isCorrect ? 'bg-green-100 px-2 py-1 rounded-md font-medium' : ''}`}>
                            • {option}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
                {question.type === 'cloze' && (
                  <div className="mt-3 ml-6">
                    <div className="mb-2 p-3 bg-gray-50 border rounded-lg">
                      <p className="text-sm text-gray-700 mb-1 font-medium">Original text:</p>
                      <p className="text-gray-900">
                        {(question as any).originalText || question.text}
                      </p>
                    </div>
                    <div>
                      <strong className="text-gray-800">Answer: </strong>
                      <span className="bg-green-100 px-2 py-1 rounded-md text-gray-900 font-medium">
                        {question.correctAnswer}
                      </span>
                    </div>
                  </div>
                )}
                {question.correctAnswer && question.type !== 'multiple_choice' && question.type !== 'cloze' && (
                  <div className="mt-2 ml-6">
                    <strong className="text-gray-800">Answer: </strong>
                    <span className="bg-green-100 px-2 py-1 rounded-md text-gray-900 font-medium">
                      {question.correctAnswer}
                    </span>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
        
        <DialogFooter className="mt-4 px-4 sm:px-6 pt-4 border-t">
          <div className="flex flex-col space-y-2 sm:flex-row sm:space-y-0 sm:space-x-2 w-full">
            {categorizingQuiz ? (
              null
            ) : (
              <>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setIsDialogOpen(false)}
                  className="w-full sm:w-auto order-last sm:order-first"
                >
                  Close
                </Button>
                
                <Button 
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setCategorizingQuiz(selectedQuiz);
                  }}
                  className="w-full sm:w-auto"
                >
                  <BookmarkPlus className="mr-2 h-3 w-3" />
                  <span className="hidden sm:inline">Categorize</span>
                  <span className="sm:hidden">Add Subject</span>
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  className="text-red-500 hover:text-red-700 hover:bg-red-50 w-full sm:w-auto"
                  onClick={() => openDeleteConfirmation(selectedQuiz!)}
                >
                  <Trash2 className="mr-2 h-3 w-3" />
                  <span className="hidden sm:inline">Delete Quiz</span>
                  <span className="sm:hidden">Delete</span>
                </Button>
                
                {/* Export Buttons Row */}
                <div className="flex space-x-2 w-full sm:w-auto">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={exporting === `${selectedQuiz?.id}-doc`}
                          onClick={() => selectedQuiz && handleExport(selectedQuiz, 'doc')}
                          className="flex-1 sm:flex-initial"
                        >
                          {exporting === `${selectedQuiz?.id}-doc` ? (
                            <>
                              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                              <span className="hidden sm:inline">Exporting...</span>
                              <span className="sm:hidden">DOC</span>
                            </>
                          ) : (
                            <>
                              <span className="hidden sm:inline">Export DOC</span>
                              <span className="sm:hidden">DOC</span>
                            </>
                          )}
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
                          className="flex-1 sm:flex-initial"
                        >
                          {exporting === `${selectedQuiz?.id}-csv` ? (
                            <>
                              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                              <span className="hidden sm:inline">Exporting...</span>
                              <span className="sm:hidden">CSV</span>
                            </>
                          ) : (
                            <>
                              <span className="hidden sm:inline">Export CSV</span>
                              <span className="sm:hidden">CSV</span>
                            </>
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Export as CSV (optimized for Quizlet flashcards)</p>
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
                          className="flex-1 sm:flex-initial"
                        >
                          {sendingToAnki ? (
                            <>
                              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                              <span className="hidden sm:inline">Sending...</span>
                              <span className="sm:hidden">Anki</span>
                            </>
                          ) : (
                            <>
                              <Send className="mr-1 h-3 w-3" />
                              <span className="hidden sm:inline">Export to Anki</span>
                              <span className="sm:hidden">Anki</span>
                            </>
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Export directly to Anki (requires Anki with Anki-Connect plugin)</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
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