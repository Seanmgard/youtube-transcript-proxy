import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import { getCookieOptions } from '@/utils/supabase/cookies-helper'

export async function POST(request: Request) {
  try {
    const cookieOptions = await getCookieOptions()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: cookieOptions,
      }
    )
    
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    // Parse request body
    const { quizId } = await request.json()

    if (!quizId) {
      return new NextResponse('Missing required parameters', { status: 400 })
    }

    // Fetch quiz data
    const { data: quiz, error } = await supabase
      .from('quizzes')
      .select('*')
      .eq('id', quizId)
      .eq('user_id', session.user.id)
      .single()

    if (error) {
      console.error('Database error fetching quiz:', error)
      return new NextResponse(`Quiz not found: ${error.message}`, { status: 404 })
    }
    
    if (!quiz) {
      console.error('No quiz found with ID:', quizId)
      return new NextResponse('Quiz not found', { status: 404 })
    }

    // Validate quiz structure
    if (!quiz.questions || !Array.isArray(quiz.questions) || quiz.questions.length === 0) {
      console.error('Invalid quiz structure - missing questions array:', quiz)
      return new NextResponse('Invalid quiz structure', { status: 400 })
    }

    return NextResponse.json({ 
      success: true, 
      quiz
    });
  } catch (error) {
    console.error('Error fetching quiz:', error);
    const errorMessage = error instanceof Error 
      ? `${error.message}\n${error.stack}` 
      : 'Unknown error';
    return new NextResponse(
      `Error fetching quiz: ${errorMessage}`, 
      { status: 500 }
    );
  }
} 