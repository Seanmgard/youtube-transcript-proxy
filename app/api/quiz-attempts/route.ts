import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';

export async function GET(request: Request) {
  const supabase = createRouteHandlerClient({ cookies });
  const url = new URL(request.url);
  const quizId = url.searchParams.get('quizId');
  const limit = url.searchParams.get('limit');
  
  try {
    // Get the user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    let query = supabase
      .from('quiz_attempts')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    
    // If quizId is provided, filter by it
    if (quizId) {
      query = query.eq('quiz_id', quizId);
    }
    
    // If limit is provided, apply it
    if (limit) {
      const limitNum = parseInt(limit);
      if (!isNaN(limitNum) && limitNum > 0) {
        query = query.limit(limitNum);
      }
    }
    
    const { data: attempts, error: attemptsError } = await query;
    
    if (attemptsError) {
      console.error('Error fetching quiz attempts:', attemptsError);
      return NextResponse.json({ error: 'Failed to fetch quiz attempts' }, { status: 500 });
    }
    
    return NextResponse.json({ attempts });
  } catch (error) {
    console.error('Error in GET /api/quiz-attempts:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const supabase = createRouteHandlerClient({ cookies });
  
  try {
    // Get the user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Get the request body
    const { quiz_id, score, total_questions, question_results, time_spent_seconds } = await request.json();
    
    if (!quiz_id || score === undefined || !total_questions || !question_results) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }
    
    // Create the quiz attempt
    const quizAttempt = {
      id: uuidv4(),
      user_id: user.id,
      quiz_id,
      score,
      total_questions,
      question_results,
      time_spent_seconds: time_spent_seconds || 0,
      completed_at: new Date().toISOString(),
      created_at: new Date().toISOString()
    };
    
    const { data, error } = await supabase
      .from('quiz_attempts')
      .insert(quizAttempt)
      .select()
      .single();
    
    if (error) {
      console.error('Error creating quiz attempt:', error);
      return NextResponse.json({ error: 'Failed to create quiz attempt' }, { status: 500 });
    }
    
    return NextResponse.json({ attempt: data });
  } catch (error) {
    console.error('Error in POST /api/quiz-attempts:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET stats for a specific quiz
export async function PATCH(request: Request) {
  const supabase = createRouteHandlerClient({ cookies });
  const url = new URL(request.url);
  const quizId = url.searchParams.get('quizId');
  
  try {
    // Get the user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    if (!quizId) {
      return NextResponse.json({ error: 'Quiz ID is required' }, { status: 400 });
    }
    
    // Get quiz attempts for statistics
    const { data: attempts, error: attemptsError } = await supabase
      .from('quiz_attempts')
      .select('*')
      .eq('user_id', user.id)
      .eq('quiz_id', quizId)
      .order('created_at', { ascending: false });
    
    if (attemptsError) {
      console.error('Error fetching quiz attempts for stats:', attemptsError);
      return NextResponse.json({ error: 'Failed to fetch quiz stats' }, { status: 500 });
    }
    
    // Calculate statistics
    const totalAttempts = attempts.length;
    const scores = attempts.map(attempt => (attempt.score / attempt.total_questions) * 100);
    const averageScore = totalAttempts > 0 ? scores.reduce((a, b) => a + b, 0) / totalAttempts : 0;
    const bestScore = totalAttempts > 0 ? Math.max(...scores) : 0;
    const lastAttemptDate = totalAttempts > 0 ? attempts[0].completed_at : null;
    const totalTimeSpent = attempts.reduce((total, attempt) => total + (attempt.time_spent_seconds || 0), 0);
    
    // Get improvement trend (last 5 attempts)
    const recentAttempts = attempts.slice(0, 5).reverse(); // Oldest to newest
    const trend = recentAttempts.length > 1 ? 
      recentAttempts[recentAttempts.length - 1].score - recentAttempts[0].score : 0;
    
    const stats = {
      totalAttempts,
      averageScore: Math.round(averageScore * 100) / 100,
      bestScore: Math.round(bestScore * 100) / 100,
      lastAttemptDate,
      totalTimeSpent,
      improvementTrend: trend,
      recentAttempts: recentAttempts.map(attempt => ({
        score: (attempt.score / attempt.total_questions) * 100,
        date: attempt.completed_at,
        timeSpent: attempt.time_spent_seconds
      }))
    };
    
    return NextResponse.json({ stats });
  } catch (error) {
    console.error('Error in PATCH /api/quiz-attempts:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 