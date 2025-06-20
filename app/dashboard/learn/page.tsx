'use client';

import { useState, useEffect } from 'react';
import { Loader2, ArrowLeft, BookOpen, BarChart3, Clock, Calendar, Tag, FileText, Plus, Trophy, Play, ArrowRight } from 'lucide-react';
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

// Add a helper function to determine text color based on background color
function getContrastColor(hexColor: string): string {
  // Convert hex to RGB
  const r = parseInt(hexColor.slice(1, 3), 16);
  const g = parseInt(hexColor.slice(3, 5), 16);
  const b = parseInt(hexColor.slice(5, 7), 16);
  
  // Calculate luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  
  // Return black or white based on luminance
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
  const [showAllQuizzes, setShowAllQuizzes] = useState(false);
  const { supabase, loading: supabaseLoading, error: supabaseError } = useSupabase();
  const { toast } = useToast();
  const router = useRouter();
  const { user: authUser } = useAuth();
  
  // Combine loading states
  const isLoading = contentLoading || supabaseLoading;

  // Mobile pagination settings
  const QUIZZES_PER_PAGE_MOBILE = 7;
  const QUIZZES_PER_PAGE_DESKTOP = 12;

  // Determine quizzes to show based on device and pagination
  const getDisplayedQuizzes = () => {
    if (typeof window === 'undefined') return quizzes; // SSR safety
    
    const isMobile = window.innerWidth < 768;
    const perPage = isMobile ? QUIZZES_PER_PAGE_MOBILE : QUIZZES_PER_PAGE_DESKTOP;
    
    if (showAllQuizzes || !isMobile) {
      return quizzes;
    }
    
    return quizzes.slice(0, perPage);
  };

  const displayedQuizzes = getDisplayedQuizzes();
  const hasMoreQuizzes = quizzes.length > QUIZZES_PER_PAGE_MOBILE;

  useEffect(() => {
    if (!supabase) return;
    
    // Add a function to clean up orphaned learning progress records
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
            description: "Please sign in to view your quizzes",
            variant: "destructive",
          });
          router.push('/auth/sign-in');
          return;
        }
        
        setUser(currentUser);
        console.log("Current user:", currentUser);

        // Fetch user's quizzes
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
        
        // Check if quizzes have the expected structure
        if (quizzesData && quizzesData.length > 0) {
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
        } else {
          setQuizzes([]);
        }

        // Fetch learning progress for each quiz
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
          // Convert array to record for easier lookup
          const progressRecord: Record<string, LearningProgress> = {};
          
          // Only include progress for quizzes that still exist
          if (progressData) {
            const quizIds = new Set(quizzesData?.map((q: any) => q.id) || []);
            progressData.forEach((progress: any) => {
              // Only add progress for quizzes that still exist
              if (quizIds.has(progress.quiz_id)) {
                progressRecord[progress.quiz_id] = progress;
              } else {
                console.log(`Skipping progress for deleted quiz: ${progress.quiz_id}`);
                // Optionally clean up orphaned progress records
                // This could be done in a separate function to avoid slowing down the page load
              }
            });
          }
          
          setLearningProgress(progressRecord);
        }

        // Fetch exams
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

        // Clean up orphaned progress records
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
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header Section */}
      <div className="bg-gradient-to-r from-emerald-50 to-teal-50 p-4 md:p-8 rounded-xl border border-emerald-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 md:gap-4">
            <Link href="/dashboard">
              <Button variant="outline" size="icon" className="bg-white hover:bg-gray-50 h-8 w-8 md:h-10 md:w-10">
                <ArrowLeft className="h-3 w-3 md:h-4 md:w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl md:text-4xl font-bold text-gray-900 mb-1 md:mb-3">Learn</h1>
              <p className="text-sm md:text-lg text-gray-600">
                Study your materials with flashcards and practice tests
              </p>
            </div>
          </div>
          <div className="hidden md:block">
            <div className="w-16 h-16 bg-emerald-600 rounded-full flex items-center justify-center">
              <BookOpen className="w-8 h-8 text-white" />
            </div>
          </div>
        </div>
      </div>

      <Tabs defaultValue="quizzes" className="w-full">
        <TabsList className="mb-6 bg-white border border-gray-200 p-1 rounded-lg shadow-sm w-full md:w-auto">
          <TabsTrigger 
            value="quizzes" 
            className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white px-3 md:px-6 py-2 rounded-md font-medium transition-all text-xs md:text-sm flex-1 md:flex-initial"
          >
            <BookOpen className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
            <span className="hidden sm:inline">Flashcards</span>
            <span className="sm:hidden">Cards</span>
          </TabsTrigger>
          <TabsTrigger 
            value="exams"
            className="data-[state=active]:bg-blue-600 data-[state=active]:text-white px-3 md:px-6 py-2 rounded-md font-medium transition-all text-xs md:text-sm flex-1 md:flex-initial"
          >
            <FileText className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
            <span className="hidden sm:inline">Test Yourself</span>
            <span className="sm:hidden">Tests</span>
          </TabsTrigger>
          <TabsTrigger 
            value="performance"
            className="data-[state=active]:bg-purple-600 data-[state=active]:text-white px-3 md:px-6 py-2 rounded-md font-medium transition-all text-xs md:text-sm flex-1 md:flex-initial"
          >
            <Trophy className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
            <span className="hidden sm:inline">Performance</span>
            <span className="sm:hidden">Stats</span>
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="quizzes" className="space-y-6">
          <Card className="bg-white shadow-lg border-0">
            <CardHeader className="border-b border-gray-100 bg-gradient-to-r from-emerald-50 to-emerald-100">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl font-semibold text-gray-900 flex items-center">
                    <BookOpen className="w-5 h-5 mr-2 text-emerald-600" />
                    Your Study Materials
                  </CardTitle>
                  <CardDescription className="text-gray-600 mt-1">
                    Review your generated quizzes as interactive flashcards
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4 md:p-8">
              {quizzes.length === 0 ? (
                <div className="text-center py-8 md:py-12">
                  <div className="w-12 h-12 md:w-16 md:h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <BookOpen className="h-6 w-6 md:h-8 md:w-8 text-gray-400" />
                  </div>
                  <h3 className="text-base md:text-lg font-medium text-gray-900 mb-2">No study materials yet</h3>
                  <p className="text-sm md:text-base text-gray-500 mb-4">Generate a quiz from the dashboard to get started with studying!</p>
                  <Link href="/dashboard">
                    <Button className="bg-emerald-600 hover:bg-emerald-700 text-sm md:text-base">
                      <Plus className="w-3 h-3 md:w-4 md:h-4 mr-2" />
                      Create Your First Quiz
                    </Button>
                  </Link>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                    {displayedQuizzes.map((quiz) => {
                      const progress = learningProgress[quiz.id];
                      const masteryPercentage = progress?.mastery_percentage || 0;
                      const lastStudied = progress?.last_studied 
                        ? new Date(progress.last_studied).toLocaleDateString() 
                        : 'Never studied';
                      
                      return (
                        <Card 
                          key={quiz.id} 
                          className={`hover:shadow-lg transition-all duration-200 border-0 shadow-md ${
                            quiz.subject && quiz.color ? 'border-l-4' : ''
                          }`}
                          style={quiz.subject && quiz.color ? {
                            borderLeftColor: quiz.color,
                            backgroundColor: `${quiz.color}08`, // Lighter opacity
                          } : {}}
                        >
                          <CardHeader className="pb-2 md:pb-3 p-4 md:p-6">
                            <div className="mb-2 min-h-[24px] md:min-h-[28px]">
                              {quiz.subject && (
                                <div 
                                  className="inline-flex items-center px-2 md:px-3 py-1 rounded-full text-xs font-medium"
                                  style={{ 
                                    backgroundColor: quiz.color || '#E5E7EB', 
                                    color: quiz.color ? getContrastColor(quiz.color) : '#374151' 
                                  }}
                                >
                                  <Tag className="h-2 w-2 md:h-3 md:w-3 mr-1" />
                                  {quiz.subject}
                                </div>
                              )}
                            </div>
                            <CardTitle className="line-clamp-2 text-base md:text-lg font-semibold text-gray-900">
                              {quiz.title}
                            </CardTitle>
                            <div className="flex flex-wrap gap-x-2 md:gap-x-4 mt-2">
                              <span className="text-xs text-gray-500 flex items-center">
                                <Calendar className="h-2 w-2 md:h-3 md:w-3 mr-1" />
                                {new Date(quiz.created_at).toLocaleDateString()}
                              </span>
                              <span className="text-xs text-gray-500 flex items-center">
                                <Clock className="h-2 w-2 md:h-3 md:w-3 mr-1" />
                                {quiz.questions?.length || 0} cards
                              </span>
                            </div>
                          </CardHeader>
                          <CardContent className="pb-3 md:pb-4 px-4 md:px-6">
                            <div className="space-y-2 md:space-y-3">
                              <div className="flex justify-between text-xs md:text-sm font-medium">
                                <span className="text-gray-600">Progress</span>
                                <span className="text-emerald-600">{masteryPercentage}%</span>
                              </div>
                              <Progress 
                                value={masteryPercentage} 
                                className="h-1.5 md:h-2 bg-gray-100" 
                                style={{ "--progress-foreground": "rgb(5, 150, 105)" } as React.CSSProperties}
                              />
                              <p className="text-xs text-gray-500">
                                Last studied: <span className="font-medium">{lastStudied}</span>
                              </p>
                            </div>
                          </CardContent>
                          <CardFooter className="pt-0 p-4 md:p-6">
                            <Link href={`/dashboard/learn/${quiz.id}`} className="w-full">
                              <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs md:text-sm h-8 md:h-10">
                                {progress ? (
                                  <>
                                    <BookOpen className="w-3 h-3 md:w-4 md:h-4 mr-2" />
                                    <span className="hidden sm:inline">Continue Learning</span>
                                    <span className="sm:hidden">Continue</span>
                                  </>
                                ) : (
                                  <>
                                    <Plus className="w-3 h-3 md:w-4 md:h-4 mr-2" />
                                    <span className="hidden sm:inline">Start Learning</span>
                                    <span className="sm:hidden">Start</span>
                                  </>
                                )}
                              </Button>
                            </Link>
                          </CardFooter>
                        </Card>
                      );
                    })}
                  </div>
                  
                  {/* Show More Button for Mobile */}
                  {hasMoreQuizzes && !showAllQuizzes && (
                    <div className="mt-6 text-center md:hidden">
                      <Button 
                        variant="outline" 
                        onClick={() => setShowAllQuizzes(true)}
                        className="w-full md:w-auto"
                      >
                        Show All {quizzes.length} Quizzes
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="exams" className="space-y-6">
          <Card className="bg-white shadow-lg border-0">
            <CardHeader className="border-b border-gray-100 bg-gradient-to-r from-blue-50 to-emerald-100">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl font-semibold text-gray-900 flex items-center">
                    <FileText className="w-5 h-5 mr-2 text-emerald-600" />
                    Comprehensive Exams
                  </CardTitle>
                  <CardDescription className="text-gray-600 mt-1">
                    Combine multiple quizzes into comprehensive practice exams
                  </CardDescription>
                </div>
                <Link href="/dashboard/learn/exams/create">
                  <Button className="bg-emerald-600 hover:bg-emerald-700">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Exam
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="p-8">
              {exams.length === 0 ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <FileText className="h-8 w-8 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No exams created yet</h3>
                  <p className="text-gray-500 mb-4">Create comprehensive practice exams by combining your quizzes!</p>
                  <Link href="/dashboard/learn/exams/create">
                    <Button className="bg-emerald-600 hover:bg-emerald-700">
                      <Plus className="w-4 h-4 mr-2" />
                      Create Your First Exam
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {exams.map((exam) => (
                    <Card key={exam.id} className="hover:shadow-lg transition-all duration-200 border-0 shadow-md">
                      <CardHeader className="pb-3">
                        <CardTitle className="line-clamp-2 text-lg font-semibold text-gray-900">
                          {exam.title}
                        </CardTitle>
                        <CardDescription className="text-sm text-gray-600">
                          {exam.description || 'Practice exam'}
                        </CardDescription>
                        <div className="flex flex-wrap gap-x-4 mt-2">
                          <span className="text-xs text-gray-500 flex items-center">
                            <Calendar className="h-3 w-3 mr-1" />
                            {new Date(exam.created_at).toLocaleDateString()}
                          </span>
                          <span className="text-xs text-gray-500 flex items-center">
                            <FileText className="h-3 w-3 mr-1" />
                            {exam.quiz_ids.length} {exam.quiz_ids.length === 1 ? 'quiz' : 'quizzes'}
                          </span>
                        </div>
                      </CardHeader>
                      <CardContent className="pb-4">
                        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                          <p className="text-sm text-emerald-800">
                            This exam combines {exam.quiz_ids.length} {exam.quiz_ids.length === 1 ? 'quiz' : 'quizzes'} for comprehensive testing.
                          </p>
                        </div>
                      </CardContent>
                      <CardFooter className="pt-0">
                        <Link href={`/dashboard/learn/exams/${exam.id}`} className="w-full">
                          <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white">
                            <BarChart3 className="w-4 h-4 mr-2" />
                            Take Exam
                          </Button>
                        </Link>
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="space-y-6">
          <PerformanceDashboard />
        </TabsContent>
      </Tabs>
    </div>
  );
} 