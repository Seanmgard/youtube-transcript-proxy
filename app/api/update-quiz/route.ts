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

    // Parse the request body
    const { quizId, title, questions } = await request.json()

    if (!quizId || !title || !questions) {
      return new NextResponse('Missing required fields', { status: 400 })
    }

    // Verify the quiz belongs to the user
    const { data: existingQuiz, error: fetchError } = await supabase
      .from('quizzes')
      .select('id')
      .eq('id', quizId)
      .eq('user_id', session.user.id)
      .single()

    if (fetchError || !existingQuiz) {
      return new NextResponse('Quiz not found or access denied', { status: 404 })
    }

    // Update the quiz
    const { error: updateError } = await supabase
      .from('quizzes')
      .update({
        title,
        questions
      })
      .eq('id', quizId)

    if (updateError) {
      console.error('Error updating quiz:', updateError)
      return new NextResponse(`Failed to update quiz: ${updateError.message}`, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in update-quiz API:', error)
    const errorMessage = error instanceof Error 
      ? `${error.message}\n${error.stack}` 
      : 'Unknown error'
    return new NextResponse(`Error updating quiz: ${errorMessage}`, { status: 500 })
  }
} 