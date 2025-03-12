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

  // Render quiz cards
  const renderQuizCards = () => {
    if (loading) {
      return (
        <div className="flex justify-center items-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      );
    }

    if (quizzes.length === 0) {
      return (
        <div className="text-center py-8">
          <p className="text-gray-500 dark:text-gray-400">No quizzes found</p>
          <Link href="/dashboard">
            <Button className="mt-4">Create a Quiz</Button>
          </Link>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {quizzes.map((quiz) => (
          <div 
            key={quiz.id} 
            className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm hover:shadow-md transition-shadow overflow-hidden"
          >
            <div className="p-4">
              <div className="flex flex-col h-full">
                <div className="flex-1">
                  <h3 className="font-medium text-lg mb-2 line-clamp-2">{quiz.title}</h3>
                  
                  <div className="flex flex-wrap gap-2 mb-3">
                    {quiz.subject ? (
                      <span 
                        className="inline-flex items-center px-2 py-1 rounded-full text-xs"
                        style={{ 
                          backgroundColor: quiz.color || '#e2e8f0',
                          color: quiz.color ? getContrastColor(quiz.color) : '#000000'
                        }}
                      >
                        {quiz.subject}
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200">
                        Uncategorized
                      </span>
                    )}
                  </div>
                  
                  <div className="space-y-1 text-sm text-gray-500 dark:text-gray-400">
                    <div className="flex items-center">
                      <Calendar className="h-4 w-4 mr-2" />
                      <span>{new Date(quiz.created_at).toLocaleDateString()}</span>
                    </div>
                    <div className="flex items-center">
                      <FileText className="h-4 w-4 mr-2" />
                      <span>{quiz.questions.length} questions</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex flex-wrap gap-2 mt-4 justify-end">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          variant="outline" 
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => openQuizDetails(quiz)}
                        >
                          <FileText className="h-4 w-4" />
                          <span className="sr-only">View</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>View Quiz</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          variant="outline" 
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => startEditing(quiz)}
                        >
                          <Edit className="h-4 w-4" />
                          <span className="sr-only">Edit</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Edit Quiz</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          variant="outline" 
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => startCategorizing(quiz)}
                        >
                          <Tag className="h-4 w-4" />
                          <span className="sr-only">Categorize</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Categorize</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          variant="outline" 
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => handleExport(quiz, 'doc')}
                          disabled={exporting === `${quiz.id}-doc`}
                        >
                          {exporting === `${quiz.id}-doc` ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <BookmarkPlus className="h-4 w-4" />
                          )}
                          <span className="sr-only">Export</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Export as DOCX</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          variant="outline" 
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => openDeleteConfirmation(quiz)}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                          <span className="sr-only">Delete</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Delete Quiz</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
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
    <div className="space-y-6">
      {renderQuizCards()}
      
      {!showAll && quizzes.length > 0 && (
        <div className="flex justify-center mt-4">
          <Link href="/dashboard/history">
            <Button variant="outline">View All Quizzes</Button>
          </Link>
        </div>
      )}
      
      {/* Quiz Details Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedQuiz?.title}</DialogTitle>
            <DialogDescription>
              Created on {selectedQuiz && new Date(selectedQuiz.created_at).toLocaleDateString()}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            {selectedQuiz && (
              <div className="space-y-8">
                {selectedQuiz.questions.map((question, index) => (
                  <div key={index} className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                    <h3 className="font-medium mb-3">
                      {index + 1}. {question.text}
                    </h3>
                    
                    {question.type === 'multiple_choice' && question.options && (
                      <ul className="space-y-2">
                        {question.options.map((option, optIndex) => (
                          <li key={optIndex} className="flex items-center">
                            <span className={`${option === question.correctAnswer ? 'bg-green-100 dark:bg-green-900/30 px-2 py-1 rounded-md' : ''}`}>
                              {String.fromCharCode(65 + optIndex)}. {option}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                    
                    {question.type !== 'multiple_choice' && (
                      <div className="mt-2">
                        <strong>Answer: </strong>
                        <span className="bg-green-100 dark:bg-green-900/30 px-2 py-1 rounded-md">
                          {question.correctAnswer}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          
          <DialogFooter className="flex flex-wrap gap-2 justify-end">
            <Button 
              variant="outline" 
              onClick={() => setIsDialogOpen(false)}
            >
              Close
            </Button>
            <Button 
              variant="outline" 
              onClick={() => selectedQuiz && startEditing(selectedQuiz)}
            >
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </Button>
            <Button 
              variant="outline" 
              onClick={() => selectedQuiz && handleExport(selectedQuiz, 'doc')}
              disabled={exporting === `${selectedQuiz?.id}-doc`}
            >
              {exporting === `${selectedQuiz?.id}-doc` ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <BookmarkPlus className="mr-2 h-4 w-4" />
              )}
              Export as DOCX
            </Button>
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
    </div>
  )
} 