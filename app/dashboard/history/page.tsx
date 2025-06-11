'use client';

import { useState, useEffect } from 'react';
import QuizHistory from '@/components/QuizHistory';
import { useAuth } from '@/app/providers/AuthProvider';
import { useSupabase } from '@/utils/supabase/client';
import { Loader2, BookOpen, Clock, BarChart3, Calendar, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function HistoryPage() {
  const { user } = useAuth();
  const { supabase, loading: supabaseLoading } = useSupabase();
  const [stats, setStats] = useState({
    totalQuizzes: 0,
    totalQuestions: 0,
    avgDifficulty: 'medium',
    recentActivity: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !supabase) return;

    const fetchStats = async () => {
      try {
        const { data: quizzes, error } = await supabase
          .from('quizzes')
          .select('*')
          .eq('user_id', user.id);

        if (error) throw error;

        if (quizzes && quizzes.length > 0) {
          const totalQuestions = quizzes.reduce((sum: number, quiz: any) => {
            return sum + (quiz.questions?.length || 0);
          }, 0);

          // Calculate recent activity (last 7 days)
          const sevenDaysAgo = new Date();
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
          const recentQuizzes = quizzes.filter((quiz: any) => 
            new Date(quiz.created_at) > sevenDaysAgo
          );

          // Calculate most common difficulty
          const difficulties = quizzes.map((quiz: any) => quiz.settings?.difficulty || 'medium');
          const difficultyCount = difficulties.reduce((acc: Record<string, number>, diff: string) => {
            acc[diff] = (acc[diff] || 0) + 1;
            return acc;
          }, {} as Record<string, number>);
          const mostCommonDifficulty = Object.keys(difficultyCount).reduce((a, b) => 
            difficultyCount[a] > difficultyCount[b] ? a : b
          );

          setStats({
            totalQuizzes: quizzes.length,
            totalQuestions,
            avgDifficulty: mostCommonDifficulty,
            recentActivity: recentQuizzes.length
          });
        }
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [user, supabase]);

  if (supabaseLoading || !user) {
    return (
      <div className="flex justify-center items-center h-[70vh]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header Section */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-8 rounded-xl border border-blue-100">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-3">Quiz History</h1>
            <p className="text-lg text-gray-600">
              Track your learning journey and manage your generated quizzes
            </p>
          </div>
          <div className="hidden md:block">
            <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center">
              <BookOpen className="w-8 h-8 text-white" />
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="bg-white shadow-md hover:shadow-lg transition-shadow border-l-4 border-l-blue-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Quizzes</CardTitle>
            <BookOpen className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">
              {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : stats.totalQuizzes}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Quizzes created
            </p>
          </CardContent>
        </Card>

        <Card className="bg-white shadow-md hover:shadow-lg transition-shadow border-l-4 border-l-green-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Questions</CardTitle>
            <BarChart3 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">
              {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : stats.totalQuestions}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Questions generated
            </p>
          </CardContent>
        </Card>

        <Card className="bg-white shadow-md hover:shadow-lg transition-shadow border-l-4 border-l-orange-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Preferred Difficulty</CardTitle>
            <Clock className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900 capitalize">
              {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : stats.avgDifficulty}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Most common setting
            </p>
          </CardContent>
        </Card>

        <Card className="bg-white shadow-md hover:shadow-lg transition-shadow border-l-4 border-l-purple-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Recent Activity</CardTitle>
            <TrendingUp className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">
              {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : stats.recentActivity}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Quizzes this week
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quiz History Section */}
      <Card className="bg-white shadow-lg">
        <CardHeader className="border-b border-gray-100 bg-gray-50">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl font-semibold text-gray-900">Your Quizzes</CardTitle>
              <CardDescription className="text-gray-600 mt-1">
                Click on any quiz to view details, export, or manage
              </CardDescription>
            </div>
            <Calendar className="h-5 w-5 text-gray-400" />
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <QuizHistory />
        </CardContent>
      </Card>
    </div>
  );
} 