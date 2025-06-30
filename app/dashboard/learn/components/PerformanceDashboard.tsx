'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/app/components/ui/dialog";
import { 
  TrendingUp, 
  TrendingDown, 
  Target, 
  Clock, 
  Calendar, 
  BarChart3, 
  Award,
  Brain,
  Zap,
  RefreshCw,
  CheckCircle,
  XCircle,
  Eye
} from 'lucide-react';
import { useSupabase } from '@/utils/supabase/client';
import { useAuth } from '@/app/providers/AuthProvider';
import { useToast } from '@/components/ui/use-toast';
import { QuizAttempt, ExamResult, Quiz, Exam, QuestionResult } from '@/lib/types';

interface PerformanceStats {
  totalQuizAttempts: number;
  totalExamAttempts: number;
  averageQuizScore: number;
  averageExamScore: number;
  bestQuizScore: number;
  bestExamScore: number;
  totalTimeSpent: number;
  streakDays: number;
  improvementTrend: number;
  recentActivity: Array<{
    type: 'quiz' | 'exam';
    title: string;
    score: number;
    date: string;
    id: string;
    quizId?: string;
    examId?: string;
  }>;
}

interface Props {
  className?: string;
}

export function PerformanceDashboard({ className }: Props) {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<PerformanceStats | null>(null);
  const [quizAttempts, setQuizAttempts] = useState<QuizAttempt[]>([]);
  const [examResults, setExamResults] = useState<ExamResult[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [selectedActivity, setSelectedActivity] = useState<{
    type: 'quiz' | 'exam';
    id: string;
    title: string;
    score: number;
    totalQuestions: number;
    questionResults: QuestionResult[];
    date: string;
    timeSpent?: number;
  } | null>(null);
  const [showResultsDialog, setShowResultsDialog] = useState(false);
  const { supabase } = useSupabase();
  const { user } = useAuth();
  const { toast } = useToast();
  const [questionTextMap, setQuestionTextMap] = useState<Record<string, string>>({});

  useEffect(() => {
    if (user && supabase) {
      fetchPerformanceData();
    }
  }, [user, supabase]);

  const fetchPerformanceData = async () => {
    if (!supabase || !user) return;

    try {
      setLoading(true);

      // Fetch quiz attempts
      const { data: attemptsData, error: attemptsError } = await supabase
        .from('quiz_attempts')
        .select('*')
        .eq('user_id', user.id)
        .order('completed_at', { ascending: false })
        .limit(100);

      if (attemptsError) {
        console.error('Error fetching quiz attempts:', attemptsError);
      } else {
        setQuizAttempts(attemptsData || []);
      }

      // Fetch exam results
      const { data: resultsData, error: resultsError } = await supabase
        .from('exam_results')
        .select('*')
        .eq('user_id', user.id)
        .order('completed_at', { ascending: false })
        .limit(100);

      if (resultsError) {
        console.error('Error fetching exam results:', resultsError);
      } else {
        setExamResults(resultsData || []);
      }

      // Fetch quizzes for mapping
      const { data: quizzesData, error: quizzesError } = await supabase
        .from('quizzes')
        .select('id, title, questions')
        .eq('user_id', user.id);

      if (quizzesError) {
        console.error('Error fetching quizzes:', quizzesError);
      } else {
        setQuizzes(quizzesData || []);
      }

      // Fetch exams for mapping
      const { data: examsData, error: examsError } = await supabase
        .from('exams')
        .select('id, title, quiz_ids')
        .eq('user_id', user.id);

      if (examsError) {
        console.error('Error fetching exams:', examsError);
      } else {
        setExams(examsData || []);
      }

      // Build a map of question_id to question text
      const questionMap: Record<string, string> = {};
      if (quizzesData) {
        quizzesData.forEach((quiz: any) => {
          (quiz.questions || []).forEach((q: any) => {
            questionMap[q.id] = q.text || q.question || '';
          });
        });
      }

      setQuestionTextMap(questionMap);

      // Calculate statistics
      calculateStats(attemptsData || [], resultsData || [], quizzesData || [], examsData || []);

    } catch (error) {
      console.error('Error fetching performance data:', error);
      toast({
        title: "Error loading performance data",
        description: "There was a problem loading your performance statistics.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (
    attempts: QuizAttempt[], 
    results: ExamResult[], 
    quizzesList: Quiz[], 
    examsList: Exam[]
  ) => {
    // Quiz statistics
    const quizScores = attempts.map(attempt => (attempt.score / attempt.total_questions) * 100);
    const averageQuizScore = quizScores.length > 0 ? quizScores.reduce((a, b) => a + b, 0) / quizScores.length : 0;
    const bestQuizScore = quizScores.length > 0 ? Math.max(...quizScores) : 0;

    // Exam statistics  
    const examScores = results.map(result => (result.score / result.total_questions) * 100);
    const averageExamScore = examScores.length > 0 ? examScores.reduce((a, b) => a + b, 0) / examScores.length : 0;
    const bestExamScore = examScores.length > 0 ? Math.max(...examScores) : 0;

    // Time spent
    const totalTimeSpent = attempts.reduce((total, attempt) => total + (attempt.time_spent_seconds || 0), 0);

    // Improvement trend (last 10 vs first 10 attempts)
    const allActivities = [
      ...attempts.map(a => ({ score: (a.score / a.total_questions) * 100, date: a.completed_at })),
      ...results.map(r => ({ score: (r.score / r.total_questions) * 100, date: r.completed_at }))
    ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let improvementTrend = 0;
    if (allActivities.length >= 10) {
      const first10 = allActivities.slice(0, 10);
      const last10 = allActivities.slice(-10);
      const firstAvg = first10.reduce((sum, a) => sum + a.score, 0) / first10.length;
      const lastAvg = last10.reduce((sum, a) => sum + a.score, 0) / last10.length;
      improvementTrend = lastAvg - firstAvg;
    }

    // Calculate streak days
    const today = new Date();
    let streakDays = 0;
    const activityDates = new Set();
    
    [...attempts, ...results].forEach(activity => {
      const activityDate = new Date(activity.completed_at).toDateString();
      activityDates.add(activityDate);
    });

    // Check consecutive days working backwards from today
    for (let i = 0; i < 30; i++) {
      const checkDate = new Date(today);
      checkDate.setDate(today.getDate() - i);
      const dateString = checkDate.toDateString();
      
      if (activityDates.has(dateString)) {
        streakDays++;
      } else if (i > 0) {
        // If we find a gap and it's not today, break the streak
        break;
      }
    }

    // Recent activity
    const recentActivity = [
      ...attempts.slice(0, 5).map(attempt => {
        const quiz = quizzesList.find(q => q.id === attempt.quiz_id);
        return {
          type: 'quiz' as const,
          title: quiz?.title || 'Unknown Quiz',
          score: (attempt.score / attempt.total_questions) * 100,
          date: attempt.completed_at,
          id: attempt.id,
          quizId: attempt.quiz_id
        };
      }),
      ...results.slice(0, 5).map(result => {
        const exam = examsList.find(e => e.id === result.exam_id);
        return {
          type: 'exam' as const,
          title: exam?.title || (result.exam_id ? 'Unknown Exam' : 'Practice Test'),
          score: (result.score / result.total_questions) * 100,
          date: result.completed_at,
          id: result.id,
          examId: result.exam_id
        };
      })
    ]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 10);

    setStats({
      totalQuizAttempts: attempts.length,
      totalExamAttempts: results.length,
      averageQuizScore: Math.round(averageQuizScore * 100) / 100,
      averageExamScore: Math.round(averageExamScore * 100) / 100,
      bestQuizScore: Math.round(bestQuizScore * 100) / 100,
      bestExamScore: Math.round(bestExamScore * 100) / 100,
      totalTimeSpent,
      streakDays,
      improvementTrend: Math.round(improvementTrend * 100) / 100,
      recentActivity
    });
  };

  const handleActivityClick = async (activity: any) => {
    try {
      if (activity.type === 'quiz') {
        const attempt = quizAttempts.find(a => a.id === activity.id);
        if (attempt) {
          setSelectedActivity({
            type: 'quiz',
            id: attempt.id,
            title: activity.title,
            score: attempt.score,
            totalQuestions: attempt.total_questions,
            questionResults: attempt.question_results,
            date: attempt.completed_at,
            timeSpent: attempt.time_spent_seconds
          });
          setShowResultsDialog(true);
        }
      } else if (activity.type === 'exam') {
        const result = examResults.find(r => r.id === activity.id);
        if (result) {
          setSelectedActivity({
            type: 'exam',
            id: result.id,
            title: activity.title,
            score: result.score,
            totalQuestions: result.total_questions,
            questionResults: result.question_results,
            date: result.completed_at
          });
          setShowResultsDialog(true);
        }
      }
    } catch (error) {
      console.error('Error loading activity details:', error);
      toast({
        title: "Error loading results",
        description: "Could not load the detailed results for this activity.",
        variant: "destructive",
      });
    }
  };

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreBadgeVariant = (score: number) => {
    if (score >= 90) return 'default';
    if (score >= 70) return 'secondary';
    return 'destructive';
  };

  if (loading) {
    return (
      <div className={`space-y-4 ${className}`}>
        <Card>
          <CardContent className="p-6">
            <div className="animate-pulse space-y-4">
              <div className="h-4 bg-gray-200 rounded w-1/4"></div>
              <div className="h-8 bg-gray-200 rounded"></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="h-20 bg-gray-200 rounded"></div>
                <div className="h-20 bg-gray-200 rounded"></div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className={`space-y-4 ${className}`}>
        <Card>
          <CardContent className="p-6 text-center">
            <Brain className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Performance Data Yet</h3>
            <p className="text-gray-500 mb-4">
              Start taking quizzes and exams to see your performance statistics here.
            </p>
            <Button onClick={fetchPerformanceData} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh Data
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className={`space-y-4 md:space-y-6 ${className}`}>
      {/* Overview Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <Card>
          <CardContent className="p-3 md:p-4">
            <div className="flex flex-col md:flex-row items-center md:space-x-2">
              <Target className="h-4 w-4 md:h-5 md:w-5 text-blue-600 mb-1 md:mb-0" />
              <div className="text-center md:text-left">
                <p className="text-xs md:text-sm font-medium">Total Attempts</p>
                <p className="text-lg md:text-2xl font-bold">
                  {stats.totalQuizAttempts + stats.totalExamAttempts}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3 md:p-4">
            <div className="flex flex-col md:flex-row items-center md:space-x-2">
              <Award className="h-4 w-4 md:h-5 md:w-5 text-yellow-600 mb-1 md:mb-0" />
              <div className="text-center md:text-left">
                <p className="text-xs md:text-sm font-medium">Best Score</p>
                <p className="text-lg md:text-2xl font-bold">
                  {Math.max(stats.bestQuizScore, stats.bestExamScore).toFixed(0)}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3 md:p-4">
            <div className="flex flex-col md:flex-row items-center md:space-x-2">
              <Clock className="h-4 w-4 md:h-5 md:w-5 text-green-600 mb-1 md:mb-0" />
              <div className="text-center md:text-left">
                <p className="text-xs md:text-sm font-medium">Time Spent</p>
                <p className="text-lg md:text-2xl font-bold">
                  {formatTime(stats.totalTimeSpent)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3 md:p-4">
            <div className="flex flex-col md:flex-row items-center md:space-x-2">
              <Zap className="h-4 w-4 md:h-5 md:w-5 text-purple-600 mb-1 md:mb-0" />
              <div className="text-center md:text-left">
                <p className="text-xs md:text-sm font-medium">Streak</p>
                <p className="text-lg md:text-2xl font-bold">
                  {stats.streakDays} day{stats.streakDays !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-3 text-xs md:text-sm">
          <TabsTrigger value="overview" className="px-2 md:px-4 py-2">
            <span className="hidden sm:inline">Overview</span>
            <span className="sm:hidden">Stats</span>
          </TabsTrigger>
          <TabsTrigger value="progress" className="px-2 md:px-4 py-2">Progress</TabsTrigger>
          <TabsTrigger value="activity" className="px-2 md:px-4 py-2">
            <span className="hidden sm:inline">Recent Activity</span>
            <span className="sm:hidden">Activity</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-3 md:space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            {/* Quiz Performance */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <BarChart3 className="h-5 w-5 mr-2" />
                  Quiz Performance
                </CardTitle>
                <CardDescription>
                  Your performance on individual quizzes
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Average Score</span>
                    <span className={getScoreColor(stats.averageQuizScore)}>
                      {stats.averageQuizScore.toFixed(1)}%
                    </span>
                  </div>
                  <Progress value={stats.averageQuizScore} className="h-2" />
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Best Score</span>
                    <span className={getScoreColor(stats.bestQuizScore)}>
                      {stats.bestQuizScore.toFixed(1)}%
                    </span>
                  </div>
                  <Progress value={stats.bestQuizScore} className="h-2" />
                </div>

                <div className="flex justify-between text-sm pt-2 border-t">
                  <span>Total Attempts</span>
                  <span className="font-medium">{stats.totalQuizAttempts}</span>
                </div>
              </CardContent>
            </Card>

            {/* Exam Performance */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Award className="h-5 w-5 mr-2" />
                  Exam Performance
                </CardTitle>
                <CardDescription>
                  Your performance on comprehensive exams
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Average Score</span>
                    <span className={getScoreColor(stats.averageExamScore)}>
                      {stats.averageExamScore.toFixed(1)}%
                    </span>
                  </div>
                  <Progress value={stats.averageExamScore} className="h-2" />
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Best Score</span>
                    <span className={getScoreColor(stats.bestExamScore)}>
                      {stats.bestExamScore.toFixed(1)}%
                    </span>
                  </div>
                  <Progress value={stats.bestExamScore} className="h-2" />
                </div>

                <div className="flex justify-between text-sm pt-2 border-t">
                  <span>Total Attempts</span>
                  <span className="font-medium">{stats.totalExamAttempts}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="progress" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                {stats.improvementTrend >= 0 ? (
                  <TrendingUp className="h-5 w-5 mr-2 text-green-600" />
                ) : (
                  <TrendingDown className="h-5 w-5 mr-2 text-red-600" />
                )}
                Improvement Trend
              </CardTitle>
              <CardDescription>
                Your progress over time based on recent performance
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center">
                <div className={`text-3xl font-bold ${
                  stats.improvementTrend >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {stats.improvementTrend >= 0 ? '+' : ''}{stats.improvementTrend.toFixed(1)}%
                </div>
                <p className="text-gray-500 mt-2">
                  {stats.improvementTrend >= 0 
                    ? 'You\'re improving! Keep up the great work.' 
                    : 'Consider reviewing areas where you\'re struggling.'}
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Calendar className="h-5 w-5 mr-2" />
                Recent Activity
              </CardTitle>
              <CardDescription>
                Your latest quiz and exam attempts - click to view detailed results
              </CardDescription>
            </CardHeader>
            <CardContent>
              {stats.recentActivity.length === 0 ? (
                <p className="text-center text-gray-500 py-4">
                  No recent activity. Start taking quizzes or exams!
                </p>
              ) : (
                <div className="space-y-3">
                  {stats.recentActivity.map((activity, index) => (
                    <div 
                      key={index} 
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors"
                      onClick={() => handleActivityClick(activity)}
                    >
                      <div className="flex items-center space-x-3">
                        <Badge variant={activity.type === 'quiz' ? 'default' : 'secondary'}>
                          {activity.type}
                        </Badge>
                        <div>
                          <p className="font-medium text-sm">{activity.title}</p>
                          <p className="text-xs text-gray-500">
                            {new Date(activity.date).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge variant={getScoreBadgeVariant(activity.score)}>
                          {activity.score.toFixed(0)}%
                        </Badge>
                        <Eye className="h-4 w-4 text-gray-400" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Results Dialog */}
      <Dialog open={showResultsDialog} onOpenChange={setShowResultsDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <BarChart3 className="h-5 w-5 mr-2" />
              {selectedActivity?.title} - Results
            </DialogTitle>
            <DialogDescription>
              Detailed results from {selectedActivity?.type === 'quiz' ? 'quiz attempt' : 'exam'} on {selectedActivity?.date && new Date(selectedActivity.date).toLocaleDateString()}
            </DialogDescription>
          </DialogHeader>
          
          {selectedActivity && (
            <div className="space-y-6">
              {/* Score Summary */}
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="text-3xl font-bold mb-2">
                  {selectedActivity.score} / {selectedActivity.totalQuestions}
                </div>
                <div className={`text-xl font-semibold ${getScoreColor(selectedActivity.score)}`}>
                  {Math.round((selectedActivity.score / selectedActivity.totalQuestions) * 100)}%
                </div>
                {selectedActivity.timeSpent && (
                  <div className="text-sm text-gray-500 mt-2">
                    Time: {formatTime(selectedActivity.timeSpent)}
                  </div>
                )}
              </div>

              {/* Question Review */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Question Review</h3>
                {selectedActivity.questionResults.map((result, index) => (
                  <Card key={index} className={`border-l-4 ${result.is_correct ? 'border-l-green-500' : 'border-l-red-500'}`}> 
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-start">
                        <CardTitle className="text-base">Question {index + 1}</CardTitle>
                        {result.is_correct ? (
                          <div className="flex items-center text-green-600">
                            <CheckCircle className="h-4 w-4 mr-1" />
                            <span className="text-sm">Correct</span>
                          </div>
                        ) : (
                          <div className="flex items-center text-red-600">
                            <XCircle className="h-4 w-4 mr-1" />
                            <span className="text-sm">Incorrect</span>
                          </div>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="space-y-2 text-sm">
                        <div className="font-medium text-gray-900 mb-1">
                          {result.question_text || questionTextMap[result.question_id] || (
                            <div>
                              <span className="italic text-gray-500">Question {index + 1}</span>
                              <div className="text-sm text-gray-400 mt-1">
                                (Original question text not available - this was from an older test)
                              </div>
                            </div>
                          )}
                        </div>
                        
                        {/* Always show answers, even if question data is missing */}
                        <div className="space-y-2">
                          <div>
                            <span className="font-medium">Your answer: </span>
                            <span className={result.is_correct ? 'text-green-600' : 'text-red-600'}>
                              {result.user_answer || '(No answer provided)'}
                            </span>
                          </div>
                          {!result.is_correct && (
                            <div>
                              <span className="font-medium">Correct answer: </span>
                              <span className="text-green-600">{result.correct_answer}</span>
                            </div>
                          )}
                        </div>

                        {/* Show options if available */}
                        {result.type === 'multiple_choice' && result.options && result.options.length > 0 && (
                          <div className="space-y-1 text-sm mt-3">
                            <div className="font-medium text-gray-700">Options:</div>
                            {result.options.map((option, optionIndex) => {
                              const isUserSelected = option === result.user_answer;
                              const isCorrectOption = option === result.correct_answer;
                              return (
                                <div key={optionIndex} className={`p-2 rounded ${isCorrectOption ? 'bg-green-100 text-green-800 border border-green-300' : isUserSelected ? 'bg-red-100 text-red-800 border border-red-300' : 'bg-gray-50'}`}>
                                  {String.fromCharCode(65 + optionIndex)}) {option}
                                  {isCorrectOption && <span className="float-right">✓</span>}
                                  {isUserSelected && !isCorrectOption && <span className="float-right">✗</span>}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
} 