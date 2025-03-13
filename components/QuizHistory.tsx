'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/app/providers/AuthProvider'
import { useSupabase } from '@/utils/supabase/client'
import { Button } from '@/components/ui/button'
import { Quiz } from '@/lib/types'
import { useToast } from '@/components/ui/use-toast'
import { Loader2, Edit, Trash2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog"
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

interface QuizHistoryProps {
  limit?: number;
}

export default function QuizHistory({ limit }: QuizHistoryProps) {
  const [quizzes, setQuizzes] = useState<Quiz[]>([])
  const [loading, setLoading] = useState(true)
  const { user } = useAuth()
  const { supabase, loading: supabaseLoading } = useSupabase()
  const { toast } = useToast()
  const [editingQuiz, setEditingQuiz] = useState<Quiz | null>(null)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [quizToDelete, setQuizToDelete] = useState<Quiz | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

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

        // Fetch quizzes with proper error handling
        console.log("Fetching quizzes for user ID:", user.id);
        const { data: quizzesData, error: quizzesError } = await supabase
          .from('quizzes')
          .select('*')
          .eq('user_id', user.id)
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
      const response = await fetch(`/api/export-quiz?id=${quiz.id}&format=${format}`, {
        method: 'GET',
      })

      if (!response.ok) throw new Error('Failed to export quiz')

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `quiz-${quiz.id}.${format}`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error('Error exporting quiz:', error)
    }
  }

  const startEditing = (quiz: Quiz) => {
    setEditingQuiz(JSON.parse(JSON.stringify(quiz))); // Deep copy
  };

  const cancelEditing = () => {
    setEditingQuiz(null);
  };

  const updateQuizTitle = (value: string) => {
    if (editingQuiz) {
      setEditingQuiz({
        ...editingQuiz,
        title: value
      });
    }
  };

  const updateQuestionText = (index: number, value: string) => {
    if (editingQuiz) {
      const updatedQuestions = [...editingQuiz.questions];
      updatedQuestions[index] = {
        ...updatedQuestions[index],
        text: value
      };
      setEditingQuiz({
        ...editingQuiz,
        questions: updatedQuestions
      });
    }
  };

  const updateQuestionAnswer = (index: number, value: string) => {
    if (editingQuiz) {
      const updatedQuestions = [...editingQuiz.questions];
      updatedQuestions[index] = {
        ...updatedQuestions[index],
        correctAnswer: value
      };
      setEditingQuiz({
        ...editingQuiz,
        questions: updatedQuestions
      });
    }
  };

  const updateQuestionOptions = (index: number, optionIndex: number, value: string) => {
    if (editingQuiz) {
      const updatedQuestions = [...editingQuiz.questions];
      const options = [...(updatedQuestions[index].options || [])];
      options[optionIndex] = value;
      updatedQuestions[index] = {
        ...updatedQuestions[index],
        options
      };
      setEditingQuiz({
        ...editingQuiz,
        questions: updatedQuestions
      });
    }
  };

  const setCorrectAnswer = (index: number, optionIndex: number) => {
    if (editingQuiz) {
      const updatedQuestions = [...editingQuiz.questions];
      const options = updatedQuestions[index].options || [];
      updatedQuestions[index] = {
        ...updatedQuestions[index],
        correctAnswer: options[optionIndex]
      };
      setEditingQuiz({
        ...editingQuiz,
        questions: updatedQuestions
      });
    }
  };

  const saveQuiz = async () => {
    if (!editingQuiz) return;
    
    try {
      setSaving(true);
      
      const { error } = await supabase
        .from('quizzes')
        .update({
          title: editingQuiz.title,
          questions: editingQuiz.questions
        })
        .eq('id', editingQuiz.id);
      
      if (error) throw error;
      
      setQuizzes(quizzes.map(q => q.id === editingQuiz.id ? editingQuiz : q));
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
      
      const { error } = await supabase
        .from('quizzes')
        .delete()
        .eq('id', quizToDelete.id);
      
      if (error) throw error;
      
      setQuizzes(quizzes.filter(q => q.id !== quizToDelete.id));
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
            className="p-4 bg-gray-50 rounded-lg dark:bg-gray-700"
          >
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-semibold">{quiz.title}</h3>
                <p className="text-sm text-gray-500">
                  Created: {new Date(quiz.created_at).toLocaleDateString()}
                </p>
                <p className="text-sm text-gray-500">
                  {quiz.questions.length} questions • {quiz.settings.difficulty} difficulty
                </p>
              </div>
              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => startEditing(quiz)}
                >
                  <Edit className="h-4 w-4 mr-1" />
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openDeleteConfirmation(quiz)}
                  className="text-red-500 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Delete
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleExport(quiz, 'doc')}
                >
                  Export DOC
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleExport(quiz, 'csv')}
                >
                  Export CSV
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleExport(quiz, 'anki')}
                >
                  Export Anki
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Edit Quiz Dialog */}
      <Dialog open={!!editingQuiz} onOpenChange={(open: boolean) => !open && cancelEditing()}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader className="pb-4">
            <DialogTitle>Edit Quiz</DialogTitle>
          </DialogHeader>
          {editingQuiz && (
            <div className="space-y-4 overflow-y-auto pr-4 flex-grow">
              <div>
                <Label htmlFor="title" className="text-base font-semibold">Quiz Title</Label>
                <Input
                  id="title"
                  value={editingQuiz.title}
                  onChange={(e) => updateQuizTitle(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div className="space-y-4">
                {editingQuiz.questions.map((question, index) => (
                  <div key={index} className="space-y-3 p-3 border rounded-lg bg-gray-50 dark:bg-gray-800">
                    <div className="flex items-center justify-between mb-2">
                      <Label className="text-base font-semibold">Question {index + 1}</Label>
                    </div>
                    
                    <div className="space-y-1">
                      <Label className="text-sm">Question Text</Label>
                      <Textarea
                        value={question.text}
                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => updateQuestionText(index, e.target.value)}
                        className="mt-1"
                        rows={2}
                      />
                    </div>

                    {question.type === 'open_ended' ? (
                      <div className="space-y-1">
                        <Label className="text-sm">Answer</Label>
                        <Textarea
                          value={question.correctAnswer || ''}
                          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => updateQuestionAnswer(index, e.target.value)}
                          className="mt-1"
                          rows={2}
                        />
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Label className="text-sm">Answer Options</Label>
                        {(question.options || []).map((option, optionIndex) => (
                          <div key={optionIndex} className="flex items-center space-x-2">
                            <Input
                              value={option}
                              onChange={(e) => updateQuestionOptions(index, optionIndex, e.target.value)}
                              className="flex-grow"
                              placeholder={`Option ${optionIndex + 1}`}
                            />
                            <Button
                              type="button"
                              variant={question.correctAnswer === option ? "default" : "outline"}
                              size="sm"
                              onClick={() => setCorrectAnswer(index, optionIndex)}
                              className="w-16 shrink-0"
                            >
                              {question.correctAnswer === option ? "✓" : "Set"}
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          <DialogFooter className="mt-4 pt-2 border-t">
            <Button variant="outline" onClick={cancelEditing}>
              Cancel
            </Button>
            <Button onClick={saveQuiz} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Quiz</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this quiz? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={cancelDelete}>
              Cancel
            </Button>
            <Button
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