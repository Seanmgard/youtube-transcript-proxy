import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import { getCookieOptions } from '@/utils/supabase/cookies-helper'
import { LearningProgress } from '@/lib/types'

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
    const progress: LearningProgress = await request.json()

    if (!progress.quiz_id || !progress.user_id) {
      return new NextResponse('Missing required fields', { status: 400 })
    }

    // Verify the user is updating their own progress
    if (progress.user_id !== session.user.id) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    // Check if progress exists
    const { data: existingProgress, error: checkError } = await supabase
      .from('learning_progress')
      .select('id')
      .eq('quiz_id', progress.quiz_id)
      .eq('user_id', session.user.id)
      .single()

    console.log("Checking for existing progress:", { quiz_id: progress.quiz_id, user_id: session.user.id });
    console.log("Check result:", { existingProgress, checkError });

    if (checkError && checkError.code === 'PGRST116') {
      // Insert new progress
      console.log("Inserting new progress:", progress);
      const { error: insertError } = await supabase
        .from('learning_progress')
        .insert(progress)
        
      if (insertError) {
        console.error('Error inserting learning progress:', insertError);
        return new NextResponse(`Failed to save progress: ${insertError.message}`, { status: 500 })
      }
      console.log("Progress inserted successfully");
    } else {
      // Update existing progress
      console.log("Updating existing progress:", progress);
      const { error: updateError } = await supabase
        .from('learning_progress')
        .update(progress)
        .eq('id', progress.id)
        
      if (updateError) {
        console.error('Error updating learning progress:', updateError);
        return new NextResponse(`Failed to update progress: ${updateError.message}`, { status: 500 })
      }
      console.log("Progress updated successfully");
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in learning-progress API:', error)
    const errorMessage = error instanceof Error 
      ? `${error.message}\n${error.stack}` 
      : 'Unknown error'
    return new NextResponse(`Error saving learning progress: ${errorMessage}`, { status: 500 })
  }
}

export async function GET(request: Request) {
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
      console.log("No authenticated session found");
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const quizId = searchParams.get('quizId')
    console.log("GET learning progress for user:", session.user.id, "quizId:", quizId);

    if (quizId) {
      // Get progress for a specific quiz
      console.log("Fetching progress for specific quiz:", quizId);
      const { data, error } = await supabase
        .from('learning_progress')
        .select('*')
        .eq('quiz_id', quizId)
        .eq('user_id', session.user.id)
        .single()

      if (error) {
        console.log("Error fetching progress:", error);
        if (error.code === 'PGRST116') {
          // No progress found
          console.log("No progress found for quiz:", quizId);
          return NextResponse.json(null)
        }
        throw error
      }

      console.log("Progress found:", data);
      return NextResponse.json(data)
    } else {
      // Get all progress for the user
      console.log("Fetching all progress for user:", session.user.id);
      const { data, error } = await supabase
        .from('learning_progress')
        .select('*')
        .eq('user_id', session.user.id)

      if (error) {
        console.log("Error fetching all progress:", error);
        throw error
      }

      console.log("All progress found:", data?.length || 0, "records");
      return NextResponse.json(data || [])
    }
  } catch (error) {
    console.error('Error in learning-progress API:', error)
    const errorMessage = error instanceof Error 
      ? `${error.message}\n${error.stack}` 
      : 'Unknown error'
    return new NextResponse(`Error fetching learning progress: ${errorMessage}`, { status: 500 })
  }
} 