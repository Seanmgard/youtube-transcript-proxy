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
    openSendToAnkiDialog(quiz);
  };

  const openSendToAnkiDialog = (quiz: Quiz) => {
    setSelectedQuiz(quiz);
    setAnkiDeckName(quiz.title.replace(/[^a-z0-9]/gi, ' ').trim());
    setIsAnkiDialogOpen(true);
  };

  const handleSendToAnki = async () => {
    if (!selectedQuiz || !ankiDeckName.trim()) return;
    
    try {
      setSendingToAnki(true);
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
          quizId: selectedQuiz.id,
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

  const openQuizDetails = (quiz: Quiz) => {
    setSelectedQuiz(quiz);
    setIsDialogOpen(true);
  };

  const closeQuizDetails = () => {
    setSelectedQuiz(null);
    setIsDialogOpen(false);
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
            className={`p-4 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer ${
              quiz.subject && quiz.color 
                ? 'border-l-4' 
                : 'bg-gray-50'
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
              
              <div>
                <h3 className="font-semibold">{quiz.title}</h3>
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
          </div>
        ))}
      </div>

      {/* Quiz Details Dialog */}
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
              <div className="text-xl font-semibold text-gray-900">{selectedQuiz?.title}</div>
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
            <div className="space-y-6">
              {selectedQuiz?.questions.map((question, index) => (
                <div key={index} className="p-4 bg-gray-50 rounded-lg">
                  <p className="font-medium text-gray-900 mb-3">
                    {index + 1}. {question.text}
                  </p>
                  {question.type === 'multiple_choice' && question.options && (
                    <ul className="space-y-2 ml-6">
                      {question.options.map((option, optIndex) => (
                        <li key={optIndex} className="flex items-start">
                          <span className={`${
                            option === question.correctAnswer 
                              ? 'bg-green-50 text-green-700 px-2 py-1 rounded-md' 
                              : 'text-gray-600'
                          }`}>
                            • {option}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {question.correctAnswer && question.type !== 'multiple_choice' && (
                    <div className="mt-3 ml-6">
                      <strong className="text-gray-700">Answer: </strong>
                      <span className="bg-green-50 text-green-700 px-2 py-1 rounded-md">
                        {question.correctAnswer}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <DialogFooter className="border-t pt-4 bg-gray-50">
            <div className="flex justify-between w-full">
              <div className="flex items-center space-x-2">
                <Button size="sm" variant="outline" onClick={closeQuizDetails}>
                  Close
                </Button>
                <div className="border-l h-4 mx-2" />
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
                  <FileText className="h-4 w-4 mr-1" />
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
                  <FileText className="h-4 w-4 mr-1" />
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
                  Send to Anki
                </Button>
              </div>
              <div className="flex items-center space-x-2">
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
                  <Trash2 className="h-4 w-4 mr-1" />
                  Delete Quiz
                </Button>
              </div>
            </div>
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

      {/* Anki Dialog */}
      <Dialog open={isAnkiDialogOpen} onOpenChange={() => {
        setIsAnkiDialogOpen(false);
        setSelectedQuiz(null);
      }}>
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
    </>
  )
} 