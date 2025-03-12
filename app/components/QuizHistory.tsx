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
import { SupabaseClient, User } from '@supabase/supabase-js'

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

interface QuizHistoryProps {
  showAll?: boolean;
  user: User;
  supabase: SupabaseClient;
}

export default function QuizHistory({ showAll = false, user, supabase }: QuizHistoryProps) {
  const [quizzes, setQuizzes] = useState<Quiz[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedQuiz, setSelectedQuiz] = useState<Quiz | null>(null)
  const [editingQuiz, setEditingQuiz] = useState<Quiz | null>(null)
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

  useEffect(() => {
    if (!user || !supabase) return;

    const fetchQuizzes = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('quiz_history')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(showAll ? 50 : 5);

        if (error) {
          console.error('Error fetching quiz history:', error);
          return;
        }

        setQuizzes(data || []);
      } catch (error) {
        console.error('Error in fetchQuizzes:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchQuizzes();
  }, [user, supabase, showAll]);

  // Add a new useEffect to refresh the session when the component mounts
  useEffect(() => {
    if (!supabase) return;
    
    const refreshSession = async () => {
      try {
        // Try to refresh the session silently
        await supabase.auth.refreshSession();
      } catch (error) {
        console.error('Error refreshing session:', error);
        // Don't show a toast here, as we'll handle auth errors in fetchQuizzes
      }
    };

    refreshSession();
  }, [supabase]);

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
    setEditingQuiz(null);
    setCategorizingQuiz(null);
    setIsDialogOpen(true);
  }

  const startEditing = (quiz: Quiz) => {
    if (!quiz) return;
    
    // Create a deep copy of the quiz to edit
    setEditingQuiz(JSON.parse(JSON.stringify(quiz)));
    
    // Reset the current question index to 0
    setCurrentQuestionIndex(0);
    
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

  const cancelEditing = () => {
    setEditingQuiz(null);
  }

  const updateQuizTitle = (value: string) => {
    if (editingQuiz) {
      setEditingQuiz({
        ...editingQuiz,
        title: value
      })
    }
  }

  const updateQuestionText = (index: number, value: string) => {
    if (editingQuiz) {
      const updatedQuestions = [...editingQuiz.questions]
      updatedQuestions[index] = {
        ...updatedQuestions[index],
        text: value
      }
      setEditingQuiz({
        ...editingQuiz,
        questions: updatedQuestions
      })
    }
  }

  const updateQuestionOption = (questionIndex: number, optionIndex: number, value: string) => {
    if (editingQuiz) {
      const updatedQuestions = [...editingQuiz.questions]
      const question = updatedQuestions[questionIndex]
      
      if (question.type === 'multiple_choice' && question.options) {
        const updatedOptions = [...question.options]
        updatedOptions[optionIndex] = value
        
        // If this option was the correct answer, update the correct answer too
        let correctAnswer = question.correctAnswer
        if (question.correctAnswer === question.options[optionIndex]) {
          correctAnswer = value
        }
        
        updatedQuestions[questionIndex] = {
          ...question,
          options: updatedOptions,
          correctAnswer: correctAnswer
        }
        
        setEditingQuiz({
          ...editingQuiz,
          questions: updatedQuestions
        })
      }
    }
  }

  const updateCorrectAnswer = (questionIndex: number, value: string) => {
    if (editingQuiz) {
      const updatedQuestions = [...editingQuiz.questions]
      updatedQuestions[questionIndex] = {
        ...updatedQuestions[questionIndex],
        correctAnswer: value
      }
      setEditingQuiz({
        ...editingQuiz,
        questions: updatedQuestions
      })
    }
  }

  const saveQuiz = async () => {
    if (!editingQuiz) return;
    
    try {
      setSaving(true);
      
      const { error } = await supabase
        .from('quizzes')
        .update({
          title: editingQuiz.title,
          questions: editingQuiz.questions,
          subject: editSubject?.name || null,
          color: editSubject?.color || null
        })
        .eq('id', editingQuiz.id);
      
      if (error) throw error;
      
      // Update the local state with proper type casting
      const updatedQuiz: Quiz = {
        ...editingQuiz,
        subject: editSubject?.name,
        color: editSubject?.color
      };
      
      setQuizzes(quizzes.map(q => q.id === editingQuiz.id ? updatedQuiz : q));
      setSelectedQuiz(updatedQuiz);
      setEditingQuiz(null);
      
      toast({
        title: 'Success',
        description: 'Quiz updated successfully',
      });
    } catch (error) {
      console.error('Error updating quiz:', error);
      toast({
        title: 'Error',
        description: 'Failed to update quiz',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const openSendToAnkiDialog = (quiz: Quiz) => {
    setSelectedQuiz(quiz)
    setAnkiDeckName(quiz.title.replace(/[^a-z0-9]/gi, ' ').trim())
    setIsAnkiDialogOpen(true)
  }

  const handleSendToAnki = async () => {
    if (!selectedQuiz || !ankiDeckName.trim()) return
    
    try {
      setSendingToAnki(true)
      toast({
        title: "Sending to Anki",
        description: "Connecting to Anki...",
      })
      
      const response = await fetch('/api/send-to-anki', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          quizId: selectedQuiz.id,
          deckName: ankiDeckName.trim()
        })
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(errorText || 'Failed to send quiz to Anki')
      }

      const result = await response.json()
      
      toast({
        title: "Success",
        description: result.message || `Quiz sent to Anki deck "${ankiDeckName}"`,
      })
      
      setIsAnkiDialogOpen(false)
    } catch (error) {
      console.error('Error sending to Anki:', error)
      toast({
        title: "Failed to send to Anki",
        description: error instanceof Error 
          ? error.message 
          : "Make sure Anki is running with the Anki-Connect plugin installed",
        variant: "destructive",
      })
    } finally {
      setSendingToAnki(false)
    }
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

  const deleteQuiz = async () => {
    if (!quizToDelete) return;
    
    try {
      setDeleting(true);
      
      // Call the API endpoint to delete the quiz
      const response = await fetch(`/api/delete-quiz?id=${quizToDelete.id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'same-origin' // Use same-origin to ensure cookies are sent
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        
        if (response.status === 401) {
          toast({
            title: 'Authentication Error',
            description: 'Your session has expired. Please sign in again.',
            variant: 'destructive',
          });
          // Redirect to login
          window.location.href = '/auth/sign-in';
          return;
        }
        
        throw new Error(errorData.error || `Failed to delete quiz (${response.status})`);
      }
      
      // Update the local state by removing the deleted quiz
      setQuizzes(quizzes.filter(q => q.id !== quizToDelete.id));
      
      // Close dialogs and reset state
      setIsDeleteDialogOpen(false);
      if (selectedQuiz?.id === quizToDelete.id) {
        setIsDialogOpen(false);
        setSelectedQuiz(null);
      }
      setQuizToDelete(null);
      
      toast({
        title: 'Success',
        description: 'Quiz deleted successfully',
      });
    } catch (error) {
      console.error('Error deleting quiz:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete quiz',
        variant: 'destructive',
      });
    } finally {
      setDeleting(false);
    }
  };

  const deleteQuestion = (questionIndex: number) => {
    if (editingQuiz && editingQuiz.questions.length > 1) {
      const updatedQuestions = [...editingQuiz.questions];
      updatedQuestions.splice(questionIndex, 1);
      
      setEditingQuiz({
        ...editingQuiz,
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
    if (editingQuiz) {
      // Create a new question based on the quiz's question type setting
      const questionType = editingQuiz.settings.questionType === 'mixed' 
        ? 'multiple_choice' // Default to multiple choice for mixed quizzes
        : editingQuiz.settings.questionType;
      
      const newQuestion: Question = {
        id: `temp-${Date.now()}`, // Temporary ID
        quizId: editingQuiz.id,
        text: '',
        type: questionType as 'multiple_choice' | 'open_ended',
        correctAnswer: '',
      };
      
      // Add options if it's multiple choice
      if (questionType === 'multiple_choice') {
        newQuestion.options = ['', '', '', ''];
      }
      
      const updatedQuestions = [...editingQuiz.questions, newQuestion];
      
      setEditingQuiz({
        ...editingQuiz,
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
            className={`p-4 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors cursor-pointer ${
              quiz.subject && quiz.color 
                ? 'border-l-4' 
                : 'bg-gray-50 dark:bg-gray-700'
            }`}
            style={quiz.subject && quiz.color ? {
              borderLeftColor: quiz.color,
              backgroundColor: `${quiz.color}20`, // Add 20% opacity to the color
            } : {}}
            onClick={() => openQuizDetails(quiz)}
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
            
            <div className="flex justify-between items-center mt-4">
              {!quiz.subject ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs text-gray-500 hover:text-primary"
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
                  onClick={(e) => {
                    e.stopPropagation();
                    startCategorizing(quiz);
                  }}
                >
                  <Tag className="mr-2 h-3 w-3" />
                  Edit Subject
                </Button>
              )}
              <div className="flex space-x-2 ml-auto">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
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

                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={exporting === `${quiz.id}-doc`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleExport(quiz, 'doc');
                        }}
                      >
                        {exporting === `${quiz.id}-doc` ? (
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
                        disabled={exporting === `${quiz.id}-csv`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleExport(quiz, 'csv');
                        }}
                      >
                        {exporting === `${quiz.id}-csv` ? (
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
                        disabled={sendingToAnki && selectedQuiz?.id === quiz.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          openSendToAnkiDialog(quiz);
                        }}
                      >
                        {sendingToAnki && selectedQuiz?.id === quiz.id ? (
                          <>
                            <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                            Sending...
                          </>
                        ) : (
                          <>
                            <Send className="mr-2 h-3 w-3" />
                            Send to Anki
                          </>
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Send directly to Anki (requires Anki with Anki-Connect plugin)</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
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
          setEditingQuiz(null);
          setCategorizingQuiz(null);
          setCurrentQuestionIndex(0);
        }
      }}
    >
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {editingQuiz ? (
              <Input 
                value={editingQuiz.title} 
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateQuizTitle(e.target.value)}
                className="font-bold text-xl"
              />
            ) : categorizingQuiz ? (
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
          {editingQuiz ? (
            <div className="space-y-4">
              <div>
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={editingQuiz.title}
                  onChange={(e) => updateQuizTitle(e.target.value)}
                  className="mt-1"
                />
              </div>
              
              <div className="border rounded-md p-4">
                <SubjectManager
                  onSelectSubject={setEditSubject}
                  selectedSubjectId={editSubject?.id}
                />
              </div>
              
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center">
                  <h3 className="text-lg font-medium">Questions</h3>
                  <span className="ml-2 text-sm text-gray-500">
                    {currentQuestionIndex + 1} of {editingQuiz.questions.length}
                  </span>
                </div>
                <div className="flex space-x-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setCurrentQuestionIndex(Math.max(0, currentQuestionIndex - 1))}
                    disabled={currentQuestionIndex === 0}
                  >
                    Previous
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setCurrentQuestionIndex(Math.min(editingQuiz.questions.length - 1, currentQuestionIndex + 1))}
                    disabled={currentQuestionIndex === editingQuiz.questions.length - 1}
                  >
                    Next
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={addNewQuestion}
                  >
                    Add Question
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => deleteQuestion(currentQuestionIndex)}
                    disabled={editingQuiz.questions.length <= 1}
                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                  >
                    Delete Question
                  </Button>
                </div>
              </div>
              
              <div className="mb-6 p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                <div className="mb-3">
                  <label className="block text-sm font-medium mb-1">Question {currentQuestionIndex + 1}</label>
                  <Textarea 
                    value={editingQuiz.questions[currentQuestionIndex].text} 
                    onChange={(e) => updateQuestionText(currentQuestionIndex, e.target.value)}
                    className="w-full"
                    rows={2}
                    placeholder="Enter your question here..."
                  />
                </div>
                
                {editingQuiz.questions[currentQuestionIndex].type === 'multiple_choice' && 
                 editingQuiz.questions[currentQuestionIndex].options && (
                  <div className="mb-3">
                    <label className="block text-sm font-medium mb-1">Options</label>
                    {editingQuiz.questions[currentQuestionIndex].options.map((option, optIndex) => (
                      <div key={optIndex} className="flex items-center mb-2">
                        <span className="mr-2">{String.fromCharCode(97 + optIndex)})</span>
                        <Input 
                          value={option} 
                          onChange={(e) => updateQuestionOption(currentQuestionIndex, optIndex, e.target.value)}
                          className="flex-grow"
                          placeholder={`Option ${String.fromCharCode(97 + optIndex)}`}
                        />
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant={option === editingQuiz.questions[currentQuestionIndex].correctAnswer ? "default" : "outline"}
                                size="sm"
                                className="ml-2"
                                onClick={() => updateCorrectAnswer(currentQuestionIndex, option)}
                              >
                                {option === editingQuiz.questions[currentQuestionIndex].correctAnswer ? "Correct" : "Set as correct"}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Mark this as the correct answer</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    ))}
                  </div>
                )}
                
                {editingQuiz.questions[currentQuestionIndex].type !== 'multiple_choice' && (
                  <div className="mb-3">
                    <label className="block text-sm font-medium mb-1">Correct Answer</label>
                    <Input 
                      value={editingQuiz.questions[currentQuestionIndex].correctAnswer} 
                      onChange={(e) => updateCorrectAnswer(currentQuestionIndex, e.target.value)}
                      className="w-full"
                      placeholder="Enter the correct answer"
                    />
                  </div>
                )}
              </div>
              
              <div className="flex justify-end space-x-2 mt-4">
                <Button variant="outline" onClick={() => setEditingQuiz(null)}>
                  Cancel
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={saveQuiz}
                  disabled={saving}
                >
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Save Changes
                    </>
                  )}
                </Button>
              </div>
            </div>
          ) : categorizingQuiz ? (
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
                    {question.options.map((option, optIndex) => (
                      <li key={optIndex} className="flex items-start">
                        <span className={`${option === question.correctAnswer ? 'bg-green-100 dark:bg-green-900/30 px-2 py-1 rounded-md' : ''}`}>
                          • {option}
                        </span>
                      </li>
                    ))}
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
            {editingQuiz ? (
              <>
                <Button
                  variant="default"
                  size="sm"
                  onClick={saveQuiz}
                  disabled={saving}
                >
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Save Changes
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={cancelEditing}
                  disabled={saving}
                >
                  Cancel
                </Button>
              </>
            ) : categorizingQuiz ? (
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
                    setEditingQuiz(null);
                  }}
                >
                  <BookmarkPlus className="mr-2 h-4 w-4" />
                  Categorize
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    startEditing(selectedQuiz!);
                    setCurrentQuestionIndex(0); // Reset the current question index
                  }}
                  disabled={!selectedQuiz}
                >
                  <Edit className="mr-2 h-4 w-4" />
                  Edit Quiz
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
                        onClick={() => selectedQuiz && openSendToAnkiDialog(selectedQuiz)}
                      >
                        {sendingToAnki ? (
                          <>
                            <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                            Sending...
                          </>
                        ) : (
                          <>
                            <Send className="mr-2 h-3 w-3" />
                            Send to Anki
                          </>
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Send directly to Anki (requires Anki with Anki-Connect plugin)</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Anki Deck Dialog */}
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
            onClick={handleSendToAnki}
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
            onClick={deleteQuiz}
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