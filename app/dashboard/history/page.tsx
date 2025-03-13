'use client';

import QuizHistory from '@/components/QuizHistory';
import { useAuth } from '@/app/providers/AuthProvider';
import { useSupabase } from '@/utils/supabase/client';
import { Loader2 } from 'lucide-react';

export default function HistoryPage() {
  const { user } = useAuth();
  const { loading: supabaseLoading } = useSupabase();

  if (supabaseLoading || !user) {
    return (
      <div className="flex justify-center items-center h-[70vh]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold mb-2">Quiz History</h1>
        <p className="text-gray-600">
          View and manage all your generated quizzes.
        </p>
      </div>

      <div className="bg-white rounded-lg shadow-md">
        <QuizHistory />
      </div>
    </div>
  );
} 