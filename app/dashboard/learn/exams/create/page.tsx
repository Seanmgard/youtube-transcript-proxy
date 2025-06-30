'use client';

import { useState, useEffect } from 'react';
import { Loader2, ArrowLeft, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Quiz } from '@/lib/types';
import { useToast } from '@/components/ui/use-toast';
import { useRouter } from 'next/navigation';
import { useSupabase } from '@/utils/supabase/client';
import { useAuth } from '@/app/providers/AuthProvider';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { v4 as uuidv4 } from 'uuid';

export default function CreateExamPage() {
  const [user, setUser] = useState<any>(null);
  const [contentLoading, setContentLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [selectedQuizIds, setSelectedQuizIds] = useState<string[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const { supabase, loading: supabaseLoading, error: supabaseError } = useSupabase();
  const { toast } = useToast();
  const router = useRouter();
  const { user: authUser } = useAuth();
  
  // Combine loading states
  const isLoading = contentLoading || supabaseLoading;

  useEffect(() => {
    if (!supabase) return;
    
    const fetchUserAndQuizzes = async () => {
      try {
        setContentLoading(true);
        
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
            description: "Please sign in to create an exam",
            variant: "destructive",
          });
          router.push('/auth/sign-in');
          return;
        }
        
        setUser(currentUser);

        // Fetch user's quizzes
        const { data: quizzesData, error: quizzesError } = await supabase
          .from('quizzes')
          .select('*')
          .eq('user_id', currentUser.id)
          .order('created_at', { ascending: false });

        if (quizzesError) {
          console.error("Error fetching quizzes:", quizzesError);
          toast({
            title: "Error loading quizzes",
            description: quizzesError.message,
            variant: "destructive",
          });
          return;
        }
        
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
        
        setQuizzes(normalizedQuizzes);
      } catch (error: any) {
        console.error('Error fetching data:', error);
        toast({
          title: "Error loading data",
          description: error.message || "There was a problem loading your quizzes.",
          variant: "destructive",
        });
      } finally {
        setContentLoading(false);
      }
    };

    fetchUserAndQuizzes();
  }, [supabase, toast, router, authUser]);

  const handleQuizToggle = (quizId: string) => {
    setSelectedQuizIds(prev => {
      if (prev.includes(quizId)) {
        return prev.filter(id => id !== quizId);
      } else {
        return [...prev, quizId];
      }
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title) {
      toast({
        title: "Missing title",
        description: "Please provide a title for your exam",
        variant: "destructive",
      });
      return;
    }
    
    if (selectedQuizIds.length === 0) {
      toast({
        title: "No quizzes selected",
        description: "Please select at least one quiz for your exam",
        variant: "destructive",
      });
      return;
    }
    
    try {
      setSubmitting(true);
      
      // Create the exam using Supabase client directly
      const examData = {
        id: uuidv4(),
        user_id: user.id,
        title,
        description: description || '',
        quiz_ids: selectedQuizIds,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      const { data, error } = await supabase
        .from('exams')
        .insert(examData)
        .select()
        .single();
      
      if (error) {
        console.error('Error creating exam:', error);
        throw new Error(error.message || 'Failed to create exam');
      }
      
      toast({
        title: "Exam created",
        description: "Your exam has been created successfully",
      });
      
      // Redirect to the newly created exam instead of the learn page
      router.push(`/dashboard/learn/exams/${examData.id}`);
    } catch (error: any) {
      console.error('Error creating exam:', error);
      toast({
        title: "Error creating exam",
        description: error.message || "There was a problem creating your exam",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-[70vh]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-2 mb-6">
        <Link href="/dashboard/learn">
          <Button variant="outline" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-3xl font-bold">Create Exam</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="p-6 bg-white rounded-lg shadow-md dark:bg-gray-800">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Exam Details</h2>
            <div className="flex gap-2">
              <Link href="/dashboard/learn">
                <Button variant="outline" type="button">
                  Cancel
                </Button>
              </Link>
              <Button 
                type="submit" 
                disabled={submitting || selectedQuizIds.length === 0}
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : 'Create Exam'}
              </Button>
            </div>
          </div>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter exam title"
                required
              />
            </div>
            
            <div>
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Enter exam description"
                rows={3}
              />
            </div>
          </div>
        </div>
        
        <div className="p-6 bg-white rounded-lg shadow-md dark:bg-gray-800">
          <h2 className="text-xl font-semibold mb-4">Select Quizzes</h2>
          
          {quizzes.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500 dark:text-gray-400">No quizzes available.</p>
              <p className="text-gray-500 dark:text-gray-400 mt-2">Create quizzes first to include them in your exam.</p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-gray-500 mb-4">
                Select the quizzes you want to include in this exam. All questions from the selected quizzes will be included.
              </p>
              
              <div className="grid grid-cols-1 gap-2">
                {quizzes.map((quiz) => (
                  <div 
                    key={quiz.id} 
                    className={`p-4 rounded-lg border ${
                      selectedQuizIds.includes(quiz.id) 
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                        : 'border-gray-200 dark:border-gray-700'
                    }`}
                  >
                    <div className="flex items-start">
                      <Checkbox
                        id={`quiz-${quiz.id}`}
                        checked={selectedQuizIds.includes(quiz.id)}
                        onCheckedChange={() => handleQuizToggle(quiz.id)}
                        className="mr-3 mt-1"
                      />
                      <div>
                        <Label 
                          htmlFor={`quiz-${quiz.id}`}
                          className="font-medium cursor-pointer"
                        >
                          {quiz.title}
                        </Label>
                        <div className="text-sm text-gray-500 mt-1">
                          {quiz.questions.length} questions • Created on {new Date(quiz.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="mt-4 text-sm text-gray-500">
                {selectedQuizIds.length} {selectedQuizIds.length === 1 ? 'quiz' : 'quizzes'} selected
              </div>
            </div>
          )}
        </div>
      </form>
    </div>
  );
} 