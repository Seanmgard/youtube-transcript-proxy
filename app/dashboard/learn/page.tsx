"use client";

import React, { useState, useEffect } from "react";
import { Loader2, ArrowLeft, BookOpen, BarChart3, Clock, Calendar, Tag, FileText, Plus, Trophy, Play, ArrowRight, Brain, Target, Zap, Star, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { Quiz, LearningProgress, Exam } from '@/lib/types';
import { useToast } from '@/components/ui/use-toast';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useRouter } from 'next/navigation';
import { useSupabase } from '@/utils/supabase/client';
import { useAuth } from '@/app/providers/AuthProvider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PerformanceDashboard } from './components/PerformanceDashboard';
import { QuizTestComponent } from './components/QuizTestComponent';
import { LongFormatTestComponent } from './components/LongFormatTestComponent';

function getContrastColor(hexColor: string): string {
  const r = parseInt(hexColor.slice(1, 3), 16);
  const g = parseInt(hexColor.slice(3, 5), 16);
  const b = parseInt(hexColor.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? '#000000' : '#FFFFFF';
}

export default function LearnPage() {
  const [user, setUser] = useState<any>(null);
  const [contentLoading, setContentLoading] = useState(true);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [learningProgress, setLearningProgress] = useState<Record<string, LearningProgress>>({});
  const [selectedQuizForTest, setSelectedQuizForTest] = useState<Quiz | null>(null);
  const [selectedQuizIds, setSelectedQuizIds] = useState<string[]>([]);
  const [showLongFormatTest, setShowLongFormatTest] = useState(false);
  const [testQuestions, setTestQuestions] = useState<any[]>([]);
  const [testTitle, setTestTitle] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(9);
  const { supabase, loading: supabaseLoading, error: supabaseError } = useSupabase();
  const { toast } = useToast();
  const router = useRouter();
  const { user: authUser } = useAuth();
  
  const isLoading = contentLoading || supabaseLoading;

  const totalPages = Math.ceil(quizzes.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const displayedQuizzes = quizzes.slice(startIndex, endIndex);

  const handleItemsPerPageChange = (value: string) => {
    setItemsPerPage(parseInt(value));
    setCurrentPage(1);
  };

  const goToNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const goToPreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  useEffect(() => {
    if (!supabase) return;
    
    const cleanupOrphanedProgress = async () => {
      try {
        const response = await fetch('/api/cleanup-progress', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          credentials: 'same-origin'
        });

        if (response.ok) {
          const data = await response.json();
          if (data.cleaned > 0) {
            console.log(`Cleaned up ${data.cleaned} orphaned learning progress records`);
          }
        } else {
          console.error('Failed to clean up orphaned progress records');
        }
      } catch (error) {
        console.error('Error cleaning up orphaned progress:', error);
      }
    };
    
    const fetchUserAndQuizzes = async () => {
      try {
        setContentLoading(true);
        
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
            description: "Please sign in to view your quizzes",
            variant: "destructive",
          });
          router.push('/auth/sign-in');
          return;
        }
        
        setUser(currentUser);
        console.log("Current user:", currentUser);

        console.log("Fetching quizzes for user ID:", currentUser.id);
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
        
        console.log("Fetched quizzes:", quizzesData);
        console.log("Number of quizzes found:", quizzesData?.length || 0);
        
        if (quizzesData && quizzesData.length > 0) {
          console.log("First quiz structure:", JSON.stringify(quizzesData[0], null, 2));
          
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
        } else {
          setQuizzes([]);
        }

        console.log("Fetching learning progress for user ID:", currentUser.id);
        const { data: progressData, error: progressError } = await supabase
          .from('learning_progress')
          .select('*')
          .eq('user_id', currentUser.id);

        if (progressError) {
          console.error('Error fetching learning progress:', progressError);
          toast({
            title: "Warning",
            description: "Could not load learning progress data",
            variant: "default",
          });
        } else {
          console.log("Learning progress data:", progressData);
          const progressRecord: Record<string, LearningProgress> = {};
          
          if (progressData) {
            const quizIds = new Set(quizzesData?.map((q: any) => q.id) || []);
            progressData.forEach((progress: any) => {
              if (quizIds.has(progress.quiz_id)) {
                progressRecord[progress.quiz_id] = progress;
              } else {
                console.log(`Skipping progress for deleted quiz: ${progress.quiz_id}`);
              }
            });
          }
          
          setLearningProgress(progressRecord);
        }

        try {
          console.log("Fetching exams for user ID:", currentUser.id);
          const { data: examsData, error: examsError } = await supabase
            .from('exams')
            .select('*')
            .eq('user_id', currentUser.id)
            .order('created_at', { ascending: false });

          if (examsError) {
            console.error("Error fetching exams:", examsError);
            toast({
              title: "Warning",
              description: "Could not load exam data",
              variant: "default",
            });
          } else {
            console.log("Fetched exams:", examsData);
            setExams(examsData || []);
          }
        } catch (error) {
          console.error('Error fetching exams:', error);
          toast({
            title: "Warning",
            description: "Could not load exam data",
            variant: "default",
          });
        }

        await cleanupOrphanedProgress();
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

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-[70vh]">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link href="/dashboard">
              <Button variant="outline" size="icon" className="rounded-full shadow-md hover:shadow-lg transition-shadow">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-1">Learn</h1>
              <p className="text-gray-600">Study with flashcards and practice tests</p>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-2 bg-white rounded-full px-4 py-2 shadow-md">
            <Brain className="h-5 w-5 text-indigo-600" />
            <span className="text-sm font-medium text-gray-700">Study Mode</span>
          </div>
        </div>

        <Tabs defaultValue="quizzes" className="w-full">
          <TabsList className="mb-6 bg-white/80 backdrop-blur-sm border border-gray-200 p-1 rounded-xl shadow-sm w-full grid grid-cols-3 md:flex md:w-auto">
            <TabsTrigger 
              value="quizzes" 
              className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white px-3 md:px-6 py-2.5 rounded-lg font-medium transition-all flex items-center justify-center gap-1 md:gap-2 text-xs md:text-sm"
            >
              <BookOpen className="w-3 h-3 md:w-4 md:h-4" />
              <span className="hidden sm:inline">Flashcards</span>
              <span className="sm:hidden">Cards</span>
            </TabsTrigger>
            <TabsTrigger 
              value="exams"
              className="data-[state=active]:bg-blue-600 data-[state=active]:text-white px-3 md:px-6 py-2.5 rounded-lg font-medium transition-all flex items-center justify-center gap-1 md:gap-2 text-xs md:text-sm"
            >
              <FileText className="w-3 h-3 md:w-4 md:h-4" />
              <span className="hidden sm:inline">Practice Tests</span>
              <span className="sm:hidden">Tests</span>
            </TabsTrigger>
            <TabsTrigger 
              value="performance"
              className="data-[state=active]:bg-purple-600 data-[state=active]:text-white px-3 md:px-6 py-2.5 rounded-lg font-medium transition-all flex items-center justify-center gap-1 md:gap-2 text-xs md:text-sm"
            >
              <Trophy className="w-3 h-3 md:w-4 md:h-4" />
              <span className="hidden sm:inline">Performance</span>
              <span className="sm:hidden">Stats</span>
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="quizzes" className="space-y-6">
            {quizzes.length === 0 ? (
              <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
                <div className="w-20 h-20 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <BookOpen className="h-10 w-10 text-indigo-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">No study materials yet</h3>
                <p className="text-gray-600 mb-6 max-w-md mx-auto">Generate your first quiz to start learning with our interactive flashcard system!</p>
                <Link href="/dashboard">
                  <Button className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white px-8 py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all">
                    <Plus className="w-5 h-5 mr-2" />
                    Create Your First Quiz
                  </Button>
                </Link>
              </div>
            ) : (
              <>
                <div className="hidden md:block bg-white rounded-xl shadow-md p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">
                      Showing {startIndex + 1}-{Math.min(endIndex, quizzes.length)} of {quizzes.length} quizzes
                    </span>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-600">Items per page:</span>
                        <select 
                          value={itemsPerPage.toString()} 
                          onChange={(e) => handleItemsPerPageChange(e.target.value)}
                          className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        >
                          <option value="6">6</option>
                          <option value="9">9</option>
                          <option value="12">12</option>
                          <option value="18">18</option>
                          <option value="24">24</option>
                        </select>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={goToPreviousPage}
                          disabled={currentPage === 1}
                          className="rounded-lg disabled:opacity-50"
                        >
                          <ChevronLeft className="h-4 w-4 mr-1" />
                          Previous
                        </Button>
                        
                        <div className="flex items-center gap-1 px-4 py-2 bg-indigo-50 rounded-lg">
                          <span className="text-sm font-medium text-indigo-700">
                            Page {currentPage} of {totalPages}
                          </span>
                        </div>
                        
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={goToNextPage}
                          disabled={currentPage === totalPages}
                          className="rounded-lg disabled:opacity-50"
                        >
                          Next
                          <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                  {displayedQuizzes.map((quiz) => {
                    const progress = learningProgress[quiz.id];
                    const masteryPercentage = progress?.mastery_percentage || 0;
                    const lastStudied = progress?.last_studied 
                      ? new Date(progress.last_studied).toLocaleDateString() 
                      : 'Never studied';
                    
                    return (
                      <Card 
                        key={quiz.id} 
                        className="group hover:shadow-xl transition-all duration-300 border-0 shadow-lg bg-white rounded-2xl overflow-hidden"
                      >
                        <div className="p-4 md:p-6">
                          {quiz.subject && (
                            <div className="mb-3 md:mb-4">
                              <Badge
                                variant="secondary"
                                className="rounded-full px-2 md:px-3 py-1 text-xs font-medium"
                                style={{ 
                                  backgroundColor: quiz.color ? `${quiz.color}20` : '#f1f5f9', 
                                  color: quiz.color || '#64748b',
                                  border: `1px solid ${quiz.color ? `${quiz.color}40` : '#e2e8f0'}`
                                }}
                              >
                                <Tag className="h-3 w-3 mr-1" />
                                {quiz.subject}
                              </Badge>
                            </div>
                          )}
                          
                          <h3 className="font-semibold text-base md:text-lg text-gray-900 mb-2 md:mb-3 line-clamp-2 group-hover:text-indigo-600 transition-colors leading-tight">
                            {quiz.title}
                          </h3>
                          
                          <div className="flex items-center gap-3 md:gap-4 text-xs md:text-sm text-gray-500 mb-3 md:mb-4">
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              <span className="truncate">{quiz.questions?.length || 0} cards</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              <span className="truncate">{new Date(quiz.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                            </div>
                          </div>
                          
                          <div className="mb-3 md:mb-4">
                            <div className="flex justify-between items-center mb-1 md:mb-2">
                              <span className="text-xs md:text-sm font-medium text-gray-600">Progress</span>
                              <span className="text-xs md:text-sm font-semibold text-indigo-600">{masteryPercentage}%</span>
                            </div>
                            <Progress 
                              value={masteryPercentage} 
                              className="h-2 bg-gray-100 rounded-full" 
                            />
                            <p className="text-xs text-gray-500 mt-1 md:mt-2 truncate">
                              Last studied: <span className="font-medium">{lastStudied}</span>
                            </p>
                          </div>
                          
                          <Link href={`/dashboard/learn/${quiz.id}`} className="block">
                            <Button className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl font-medium shadow-md hover:shadow-lg transition-all py-2 md:py-3 text-sm md:text-base">
                              {progress ? (
                                <>
                                  <Play className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
                                  <span className="hidden sm:inline">Continue Learning</span>
                                  <span className="sm:hidden">Continue</span>
                                </>
                              ) : (
                                <>
                                  <Zap className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
                                  <span className="hidden sm:inline">Start Learning</span>
                                  <span className="sm:hidden">Start</span>
                                </>
                              )}
                            </Button>
                          </Link>
                        </div>
                      </Card>
                    );
                  })}
                </div>
                
                {totalPages > 1 && (
                  <div className="flex items-center justify-center bg-white rounded-xl shadow-md p-4">
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={goToPreviousPage}
                        disabled={currentPage === 1}
                        className="rounded-lg disabled:opacity-50"
                      >
                        <ChevronLeft className="h-4 w-4 mr-1" />
                        Previous
                      </Button>
                      
                      <div className="flex items-center gap-1 px-4 py-2 bg-indigo-50 rounded-lg">
                        <span className="text-sm font-medium text-indigo-700">
                          Page {currentPage} of {totalPages}
                        </span>
                      </div>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={goToNextPage}
                        disabled={currentPage === totalPages}
                        className="rounded-lg disabled:opacity-50"
                      >
                        Next
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </TabsContent>
          
          <TabsContent value="exams" className="space-y-4 md:space-y-6">
            <div className="bg-white rounded-2xl shadow-lg p-4 md:p-8">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 md:mb-8 space-y-4 md:space-y-0">
                <div>
                  <h2 className="text-xl md:text-2xl font-bold text-gray-900 flex items-center gap-2 md:gap-3">
                    <div className="w-8 h-8 md:w-10 md:h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center">
                      <FileText className="w-4 h-4 md:w-5 md:h-5 text-white" />
                    </div>
                    Practice Tests
                  </h2>
                  <p className="text-sm md:text-base text-gray-600 mt-1 md:mt-2">Combine multiple quizzes into comprehensive practice exams</p>
                </div>
                <Link href="/dashboard/learn/exams/create" className="flex-shrink-0">
                  <Button className="w-full md:w-auto bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-4 md:px-6 py-2.5 md:py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all text-sm md:text-base">
                    <Plus className="h-4 w-4 md:h-5 md:w-5 mr-1 md:mr-2" />
                    Create Exam
                  </Button>
                </Link>
              </div>
              
              {exams.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-20 h-20 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <FileText className="h-10 w-10 text-blue-600" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-3">No practice tests yet</h3>
                  <p className="text-gray-600 mb-6 max-w-md mx-auto">Create comprehensive practice exams by combining your quizzes!</p>
                  <Link href="/dashboard/learn/exams/create">
                    <Button className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-8 py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all">
                      <Plus className="w-5 h-5 mr-2" />
                      Create Your First Exam
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {exams.map((exam) => (
                    <Card key={exam.id} className="group hover:shadow-xl transition-all duration-300 border-0 shadow-lg bg-white rounded-2xl overflow-hidden">
                      <div className="p-6">
                        <h3 className="font-semibold text-lg text-gray-900 mb-2 line-clamp-2 group-hover:text-blue-600 transition-colors">
                          {exam.title}
                        </h3>
                        <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                          {exam.description || 'Comprehensive practice exam'}
                        </p>
                        
                        <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
                          <div className="flex items-center gap-1">
                            <FileText className="h-3 w-3" />
                            {exam.quiz_ids.length} {exam.quiz_ids.length === 1 ? 'quiz' : 'quizzes'}
                          </div>
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(exam.created_at).toLocaleDateString()}
                          </div>
                        </div>
                        
                        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4 mb-4">
                          <p className="text-sm text-blue-700">
                            This exam combines {exam.quiz_ids.length} {exam.quiz_ids.length === 1 ? 'quiz' : 'quizzes'} for comprehensive testing.
                          </p>
                        </div>
                        
                        <Link href={`/dashboard/learn/exams/${exam.id}`} className="block">
                          <Button className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-medium shadow-md hover:shadow-lg transition-all">
                            <Target className="w-4 h-4 mr-2" />
                            Take Exam
                          </Button>
                        </Link>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="performance" className="space-y-6">
            <div className="bg-white rounded-2xl shadow-lg p-8">
              <div className="flex items-center gap-3 mb-8">
                <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-600 rounded-full flex items-center justify-center">
                  <Trophy className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Performance Analytics</h2>
                  <p className="text-gray-600">Track your learning progress and achievements</p>
                </div>
              </div>
              <PerformanceDashboard />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
} 