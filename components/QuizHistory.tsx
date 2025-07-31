'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/app/providers/AuthProvider'
import { useSupabase } from '@/utils/supabase/client'
import { Button } from '@/components/ui/button'
import { Quiz } from '@/lib/types'
import { useToast } from '@/components/ui/use-toast'
import { Loader2, Edit, Trash2, Tag, Calendar, FileText, BarChart3, Clock, Check, AlertCircle, Send } from 'lucide-react'
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
import Link from 'next/link'
import { AnkiExportDialog } from '@/app/components/AnkiExportDialog'
import ClozeEditor from '@/app/components/ClozeEditor'

// Add the getContrastColor utility function
function getContrastColor(hexColor: string): string {
  // Default to dark text if no color is provided
  if (!hexColor) return '#374151';
  
  // Convert hex to RGB
  const r = parseInt(hexColor.slice(1, 3), 16);
  const g = parseInt(hexColor.slice(3, 5), 16);
  const b = parseInt(hexColor.slice(5, 7), 16);
  
  // Calculate relative luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  
  // Return white for dark backgrounds, dark gray for light backgrounds
  return luminance > 0.5 ? '#374151' : '#FFFFFF';
}

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
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [selectedQuiz, setSelectedQuiz] = useState<Quiz | null>(null)
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [isMobileOrTablet, setIsMobileOrTablet] = useState(false);
  const [ankiDeckName, setAnkiDeckName] = useState('');
  const [isAnkiDialogOpen, setIsAnkiDialogOpen] = useState(false);
  const [sendingToAnki, setSendingToAnki] = useState(false);
  const [isMobileAnkiWarningOpen, setIsMobileAnkiWarningOpen] = useState(false);
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null);
  const [editingTitleValue, setEditingTitleValue] = useState('');
  const [isMobileDownloadOpen, setIsMobileDownloadOpen] = useState(false);
  const [selectedMobileQuiz, setSelectedMobileQuiz] = useState<Quiz | null>(null);

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
            questionType: 'multiple_choice'
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
        title: "❌ Export Failed",
        description: `${error instanceof Error ? error.message : 'Failed to export quiz'}. Please try again or contact support.`,
        className: "border-red-200 bg-red-50 text-red-900",
        variant: 'destructive',
        duration: 5000,
      });
    }
  };

  const handleAnkiExport = (quiz: Quiz) => {
    if (isMobileOrTablet) {
      setIsMobileAnkiWarningOpen(true);
      return;
    }
    // Instead of exporting as a file, open the Anki Connect dialog
    openSendToAnkiDialog(quiz);
  };

  const openSendToAnkiDialog = (quiz: Quiz) => {
    console.log('Opening Anki dialog for quiz:', quiz.id);
    setSelectedQuiz(quiz);
    setIsAnkiDialogOpen(true);
  };

  const closeAnkiDialog = () => {
    console.log('Closing Anki dialog');
    setIsAnkiDialogOpen(false);
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
        title: "🗑️ Quiz Deleted",
        description: `${quizToDelete.title} has been permanently removed from your library.`,
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

  const openQuizDetails = (quiz: Quiz) => {
    setSelectedQuiz(quiz);
    setIsDialogOpen(true);
  };

  const closeQuizDetails = () => {
    setSelectedQuiz(null);
    setIsDialogOpen(false);
    // Cancel any ongoing title editing when closing the modal
    if (editingTitleId) {
      cancelEditingTitle();
    }
  };

  const startEditingTitle = (quiz: Quiz) => {
    // Disable quiz renaming on mobile devices
    if (isMobileOrTablet) {
      toast({
        title: "Desktop Only Feature",
        description: "Quiz renaming is only available on desktop computers. Please use your computer to rename quizzes.",
        variant: "default",
        duration: 4000,
      });
      return;
    }
    
    setEditingTitleId(quiz.id);
    setEditingTitleValue(quiz.title);
  };

  const cancelEditingTitle = () => {
    setEditingTitleId(null);
    setEditingTitleValue('');
  };

  const saveTitle = async (quizId: string) => {
    if (!editingTitleValue.trim()) {
      toast({
        title: 'Error',
        description: 'Title cannot be empty',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSaving(true);
      const response = await fetch('/api/update-quiz', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          quizId,
          title: editingTitleValue.trim(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update quiz title');
      }

      const result = await response.json();
      
      // Update the quiz in the local state
      setQuizzes(prevQuizzes => 
        prevQuizzes.map(quiz => 
          quiz.id === quizId 
            ? { ...quiz, title: result.quiz.title }
            : quiz
        )
      );

      // Also update selectedQuiz if it's currently open
      if (selectedQuiz?.id === quizId) {
        setSelectedQuiz(prev => prev ? { ...prev, title: result.quiz.title } : null);
      }

      setEditingTitleId(null);
      setEditingTitleValue('');

      toast({
        title: 'Success',
        description: 'Quiz title updated successfully',
        className: "border-green-200 bg-green-50 text-green-900",
      });
    } catch (error) {
      console.error('Error updating quiz title:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update quiz title',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
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
            className={`group p-4 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer ${
              quiz.subject && quiz.color 
                ? 'border-l-4' 
                : 'bg-gray-50'
            }`}
            style={quiz.subject && quiz.color ? {
              borderLeftColor: quiz.color,
              backgroundColor: `${quiz.color}20`,
            } : {}}
            onClick={() => {
              if (isMobileOrTablet) {
                // Mobile: Show mobile-friendly download dialog
                setSelectedMobileQuiz(quiz);
                setIsMobileDownloadOpen(true);
              } else {
                // Desktop: Show full quiz details
                openQuizDetails(quiz);
              }
            }}
          >
            <div className="flex flex-col">
              {quiz.subject && (
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
              )}
              
              <div className="space-y-1">
                {editingTitleId === quiz.id ? (
                  <div className="flex items-center gap-2">
                    <Input
                      value={editingTitleValue}
                      onChange={(e) => setEditingTitleValue(e.target.value)}
                      className="font-semibold text-lg"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          saveTitle(quiz.id);
                        } else if (e.key === 'Escape') {
                          cancelEditingTitle();
                        }
                      }}
                      onClick={(e) => e.stopPropagation()}
                      autoFocus
                      placeholder="Enter quiz title..."
                    />
                    <Button
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        saveTitle(quiz.id);
                      }}
                      disabled={saving}
                      className="h-9 px-3 bg-green-600 hover:bg-green-700 text-white"
                    >
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        cancelEditingTitle();
                      }}
                      className="h-9 px-3"
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {isMobileOrTablet ? (
                      // Mobile: Non-clickable title
                      <div className="px-2 py-1">
                        <h3 className="font-semibold text-lg">
                          {quiz.title}
                        </h3>
                      </div>
                    ) : (
                      // Desktop: Clickable title for editing
                      <div 
                        className="inline-flex items-center gap-2 cursor-pointer rounded-md px-2 py-1 hover:bg-blue-50 hover:border-blue-200 border border-transparent transition-all group/edit"
                        onClick={(e) => {
                          e.stopPropagation();
                          startEditingTitle(quiz);
                        }}
                        title="Click to edit quiz title"
                      >
                        <h3 className="font-semibold text-lg group-hover/edit:text-blue-600 transition-colors">
                          {quiz.title}
                        </h3>
                        <Edit className="h-4 w-4 opacity-0 group-hover/edit:opacity-100 transition-opacity text-blue-500" />
                      </div>
                    )}
                    {!isMobileOrTablet && (
                      <p className="text-xs text-gray-500 ml-2 opacity-0 group-hover/edit:opacity-100 transition-opacity">
                        Click title to edit
                      </p>
                    )}
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-x-4 mt-1">
                <p className="text-sm text-gray-500 flex items-center">
                  <Calendar className="h-3.5 w-3.5 mr-1" />
                  {new Date(quiz.created_at).toLocaleDateString()}
                </p>
                <p className="text-sm text-gray-500 flex items-center">
                  <FileText className="h-3.5 w-3.5 mr-1" />
                  {quiz.questions.length} questions
                </p>
                <p className="text-sm text-gray-500 flex items-center">
                  <BarChart3 className="h-3.5 w-3.5 mr-1" />
                  {quiz.settings.difficulty} difficulty
                </p>
                <p className="text-sm text-gray-500 flex items-center">
                  <Clock className="h-3.5 w-3.5 mr-1" />
                  {quiz.settings.questionType} questions
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Quiz Details - Desktop Dialog */}
      {!isMobileOrTablet && (
        <Dialog open={isDialogOpen} onOpenChange={closeQuizDetails}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col bg-white">
            <DialogHeader className="border-b pb-4">
              <DialogTitle className="space-y-2">
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
                <div className="space-y-2">
                  {editingTitleId === selectedQuiz?.id ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Input
                          value={editingTitleValue}
                          onChange={(e) => setEditingTitleValue(e.target.value)}
                          className="text-xl font-semibold"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              saveTitle(selectedQuiz.id);
                            } else if (e.key === 'Escape') {
                              cancelEditingTitle();
                            }
                          }}
                          autoFocus
                          placeholder="Enter quiz title..."
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          onClick={() => saveTitle(selectedQuiz.id)}
                          disabled={saving}
                          className="bg-green-600 hover:bg-green-700 text-white"
                        >
                          {saving ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin mr-2" />
                              Saving...
                            </>
                          ) : (
                            <>
                              <Check className="h-4 w-4 mr-2" />
                              Save Changes
                            </>
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={cancelEditingTitle}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div 
                        className="inline-flex items-center gap-3 cursor-pointer rounded-lg px-3 py-2 hover:bg-blue-50 hover:border-blue-200 border-2 border-transparent transition-all group/modal-edit"
                        onClick={() => selectedQuiz && startEditingTitle(selectedQuiz)}
                        title="Click to edit quiz title"
                      >
                        <div className="text-xl font-semibold text-gray-900 group-hover/modal-edit:text-blue-600 transition-colors">
                          {selectedQuiz?.title}
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover/modal-edit:opacity-100 transition-opacity">
                          <Edit className="h-5 w-5 text-blue-500" />
                          <span className="text-sm text-blue-600 font-medium">Edit</span>
                        </div>
                      </div>
                      <p className="text-sm text-gray-500 ml-3 opacity-0 group-hover/modal-edit:opacity-100 transition-opacity">
                        Click title above to rename this quiz
                      </p>
                    </div>
                  )}
                </div>
              </DialogTitle>
              <DialogDescription className="flex flex-wrap gap-4 text-gray-500">
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

            <div className="flex-1 overflow-y-auto py-4">
              <div className="space-y-4">
                {!selectedQuiz ? (
                  <div className="text-center py-8">
                    <p className="text-gray-500">Loading quiz details...</p>
                  </div>
                ) : !selectedQuiz.questions || selectedQuiz.questions.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-500">No questions found in this quiz.</p>
                  </div>
                ) : (
                  selectedQuiz.questions.map((question, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-4 bg-white shadow-sm">
                    <div className="flex items-start mb-3">
                      <span className="inline-flex items-center justify-center w-6 h-6 text-xs font-semibold text-white bg-blue-600 rounded-full mr-3 mt-0.5 flex-shrink-0">
                        {index + 1}
                      </span>
                      <p className="text-sm font-medium text-gray-900 leading-relaxed">
                        {question.type === 'cloze' 
                          ? (question as any).clozeText?.replace(/\{\{c1::(.*?)\}\}/g, '_______________')
                          : question.text
                        }
                      </p>
                    </div>
                    
                    {question.type === 'cloze' && (
                      <ClozeEditor 
                        question={question} 
                        quizId={selectedQuiz?.id}
                        allQuestions={selectedQuiz?.questions}
                        onUpdate={(updatedQuestion: any) => {
                          if (!selectedQuiz) return;
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
                      <div className="ml-9 space-y-2">
                        {question.options.map((option, optIndex) => {
                          let isCorrect = option === question.correctAnswer;
                          
                          if (!isCorrect) {
                            const answerLetter = question.correctAnswer.trim().toUpperCase();
                            if (answerLetter.match(/^[A-D]$/)) {
                              const letterIndex = answerLetter.charCodeAt(0) - 65;
                              isCorrect = optIndex === letterIndex;
                            }
                          }
                          
                          const optionLetter = String.fromCharCode(65 + optIndex);
                          
                          return (
                            <div key={optIndex} className={`flex items-start p-2 rounded-md transition-colors ${
                              isCorrect 
                                ? 'bg-green-50 border border-green-200' 
                                : 'bg-gray-50 hover:bg-gray-100'
                            }`}>
                              <span className={`inline-flex items-center justify-center w-5 h-5 text-xs font-medium rounded-full mr-2 mt-0.5 flex-shrink-0 ${
                                isCorrect 
                                  ? 'bg-green-600 text-white' 
                                  : 'bg-gray-300 text-gray-700'
                              }`}>
                                {optionLetter}
                              </span>
                              <span className={`text-sm ${
                                isCorrect 
                                  ? 'text-green-800 font-medium' 
                                  : 'text-gray-700'
                              }`}>
                                {option}
                              </span>
                              {isCorrect && (
                                <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                  Correct
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                    
                    {question.type === 'open_ended' && question.correctAnswer && (
                      <div className="ml-9 mt-3">
                        <div className="bg-green-50 border border-green-200 rounded-md p-3">
                          <div className="flex items-start">
                            <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-medium bg-green-600 text-white rounded-full mr-2 mt-0.5 flex-shrink-0">
                              ✓
                            </span>
                            <div>
                              <p className="text-xs font-medium text-green-800 mb-1">Answer:</p>
                              <p className="text-sm text-green-700 leading-relaxed">
                                {question.correctAnswer}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {question.type === 'cloze' && (
                      <div className="ml-9 mt-3">
                        <div className="bg-green-50 border border-green-200 rounded-md p-3">
                          <div className="flex items-start">
                            <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-medium bg-green-600 text-white rounded-full mr-2 mt-0.5 flex-shrink-0">
                              ✓
                            </span>
                            <div>
                              <p className="text-xs font-medium text-green-800 mb-1">Answer:</p>
                              <p className="text-sm text-green-700 leading-relaxed">
                                {question.correctAnswer}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))
                )}
              </div>
            </div>

            <DialogFooter className="border-t pt-4 bg-gray-50">
              <div className="flex flex-row justify-end space-x-2 w-full">
                <div className="flex space-x-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      if (selectedQuiz) {
                        handleExport(selectedQuiz, 'doc');
                      }
                    }}
                    className="flex items-center"
                  >
                    <FileText className="h-3 w-3 mr-1" />
                    Export DOC
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      if (selectedQuiz) {
                        handleExport(selectedQuiz, 'csv');
                      }
                    }}
                    className="flex items-center"
                  >
                    <FileText className="h-3 w-3 mr-1" />
                    Export CSV
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      if (selectedQuiz) {
                        handleAnkiExport(selectedQuiz);
                      }
                    }}
                    className="flex items-center bg-white text-black border border-gray-200 hover:bg-gray-50"
                  >
                    <Send className="h-3 w-3 mr-1" />
                    Export to Anki
                  </Button>
                </div>
                
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    if (selectedQuiz) {
                      openDeleteConfirmation(selectedQuiz);
                    }
                  }}
                  className="flex items-center text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="h-3 w-3 mr-1" />
                  Delete Quiz
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

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

      {/* Anki Dialog */}
      {selectedQuiz && (
        <AnkiExportDialog
          isOpen={isAnkiDialogOpen}
          onClose={closeAnkiDialog}
          quizId={selectedQuiz.id}
        />
      )}

      {/* Mobile Anki Warning Dialog */}
      <Dialog open={isMobileAnkiWarningOpen} onOpenChange={setIsMobileAnkiWarningOpen}>
        <DialogContent className="sm:max-w-md mx-auto max-w-[90vw] rounded-2xl">
          <DialogHeader className="text-center pb-4">
            <div className="mx-auto w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-4">
              <Send className="h-6 w-6 text-blue-600" />
            </div>
            <DialogTitle className="text-xl font-semibold text-gray-900">
              Desktop Only Feature
            </DialogTitle>
            <DialogDescription className="text-base text-gray-600 mt-2">
              Anki export requires desktop connectivity and is not available on mobile devices.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <h4 className="font-medium text-blue-900 mb-2">To export to Anki:</h4>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Use a desktop or laptop computer</li>
                <li>• Install Anki desktop application</li>
                <li>• Install the Anki-Connect plugin</li>
                <li>• Access QuizLab AI from your computer</li>
              </ul>
            </div>
            
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
              <h4 className="font-medium text-gray-900 mb-2">Alternative options:</h4>
              <ul className="text-sm text-gray-700 space-y-1">
                <li>• Export as CSV (optimized for Quizlet flashcards)</li>
                <li>• Export as Word document for manual import</li>
                <li>• Study directly in QuizLab AI's Learn section</li>
              </ul>
            </div>
          </div>

          <DialogFooter className="mt-6">
            <Button 
              onClick={() => setIsMobileAnkiWarningOpen(false)}
              className="w-full rounded-lg"
            >
              Got it
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mobile Download Options Dialog */}
      <Dialog open={isMobileDownloadOpen} onOpenChange={(open) => {
        setIsMobileDownloadOpen(open);
        if (!open) setSelectedMobileQuiz(null);
      }}>
        <DialogContent className="sm:max-w-md mx-auto max-w-[90vw] rounded-2xl bg-white">
          <DialogHeader className="text-center pb-6">
            <div className="mx-auto w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mb-4">
              <FileText className="h-8 w-8 text-white" />
            </div>
            <DialogTitle className="text-xl font-semibold text-gray-900 mb-2">
              {selectedMobileQuiz?.title}
            </DialogTitle>
            <DialogDescription className="text-sm text-gray-600">
              Choose how you'd like to download this quiz
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-3 pb-6">
            {/* Word Document Option */}
            <Button
              onClick={() => {
                if (selectedMobileQuiz) {
                  handleExport(selectedMobileQuiz, 'doc');
                  setIsMobileDownloadOpen(false);
                }
              }}
              className="w-full h-16 rounded-xl bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-start px-6 gap-4 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <div className="w-10 h-10 bg-white bg-opacity-20 rounded-lg flex items-center justify-center">
                <FileText className="h-5 w-5" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-lg">Word Document</p>
                <p className="text-blue-100 text-sm">Perfect for editing and printing</p>
              </div>
            </Button>

            {/* CSV Option */}
            <Button
              onClick={() => {
                if (selectedMobileQuiz) {
                  handleExport(selectedMobileQuiz, 'csv');
                  setIsMobileDownloadOpen(false);
                }
              }}
              className="w-full h-16 rounded-xl bg-green-600 hover:bg-green-700 text-white flex items-center justify-start px-6 gap-4 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <div className="w-10 h-10 bg-white bg-opacity-20 rounded-lg flex items-center justify-center">
                <BarChart3 className="h-5 w-5" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-lg">CSV File</p>
                <p className="text-green-100 text-sm">Optimized for Quizlet flashcards</p>
              </div>
            </Button>
          </div>

          <DialogFooter className="pt-4 border-t border-gray-100">
            <Button 
              onClick={() => {
                setIsMobileDownloadOpen(false);
                setSelectedMobileQuiz(null);
              }}
              variant="outline"
              className="w-full h-12 rounded-xl text-gray-700 border-gray-200 hover:bg-gray-50"
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
} 