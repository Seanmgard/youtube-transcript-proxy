import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { getCookieOptions } from '@/utils/supabase/cookies-helper'

export async function PUT(request: Request) {
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

    const body = await request.json()
    const { id, questions, title, ...otherFields } = body

    if (!id) {
      return new NextResponse('Quiz ID is required', { status: 400 })
    }

    // Validate questions structure
    if (questions && Array.isArray(questions)) {
      for (const question of questions) {
        if (!question.text || !question.correctAnswer) {
          return new NextResponse('Each question must have text and correctAnswer', { status: 400 })
        }
        
        // Validate image data if present (both new multi-image and legacy single image formats)
        if (question.frontImages && Array.isArray(question.frontImages)) {
          for (const img of question.frontImages) {
            if (!img.url || typeof img.url !== 'string') {
              return new NextResponse('Invalid front image data', { status: 400 })
            }
          }
        }
        
        if (question.backImages && Array.isArray(question.backImages)) {
          for (const img of question.backImages) {
            if (!img.url || typeof img.url !== 'string') {
              return new NextResponse('Invalid back image data', { status: 400 })
            }
          }
        }
        
        // Legacy single image validation
        if (question.frontImage && (!question.frontImage.url || typeof question.frontImage.url !== 'string')) {
          return new NextResponse('Invalid front image data', { status: 400 })
        }
        
        if (question.backImage && (!question.backImage.url || typeof question.backImage.url !== 'string')) {
          return new NextResponse('Invalid back image data', { status: 400 })
        }
      }
    }

    // Update the quiz
    const updateData: any = {}

    if (title) updateData.title = title
    if (questions) updateData.questions = questions
    
    // Add any other fields that were provided
    Object.keys(otherFields).forEach(key => {
      if (otherFields[key] !== undefined) {
        updateData[key] = otherFields[key]
      }
    })

    const { data, error } = await supabase
      .from('quizzes')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', session.user.id)
      .select()
      .single()

    if (error) {
      console.error('Database error:', error)
      return new NextResponse(`Failed to update quiz: ${error.message}`, { status: 500 })
    }

    if (!data) {
      return new NextResponse('Quiz not found or you do not have permission to update it', { status: 404 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error updating quiz:', error)
    return new NextResponse(
      `Error updating quiz: ${error instanceof Error ? error.message : 'Unknown error'}`, 
      { status: 500 }
    )
  }
}

export async function PATCH(request: Request) {
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

    const body = await request.json()
    const { id, questionIndex, updatedQuestion } = body

    if (!id || questionIndex === undefined || !updatedQuestion) {
      return new NextResponse('Quiz ID, question index, and updated question are required', { status: 400 })
    }

    // Validate the updated question
    if (!updatedQuestion.text || !updatedQuestion.correctAnswer) {
      return new NextResponse('Question must have text and correctAnswer', { status: 400 })
    }

    // Validate image data if present (both new multi-image and legacy single image formats)
    if (updatedQuestion.frontImages && Array.isArray(updatedQuestion.frontImages)) {
      for (const img of updatedQuestion.frontImages) {
        if (!img.url || typeof img.url !== 'string') {
          return new NextResponse('Invalid front image data', { status: 400 })
        }
      }
    }
    
    if (updatedQuestion.backImages && Array.isArray(updatedQuestion.backImages)) {
      for (const img of updatedQuestion.backImages) {
        if (!img.url || typeof img.url !== 'string') {
          return new NextResponse('Invalid back image data', { status: 400 })
        }
      }
    }
    
    // Legacy single image validation
    if (updatedQuestion.frontImage && (!updatedQuestion.frontImage.url || typeof updatedQuestion.frontImage.url !== 'string')) {
      return new NextResponse('Invalid front image data', { status: 400 })
    }
    
    if (updatedQuestion.backImage && (!updatedQuestion.backImage.url || typeof updatedQuestion.backImage.url !== 'string')) {
      return new NextResponse('Invalid back image data', { status: 400 })
    }

    // Get the current quiz
    const { data: currentQuiz, error: fetchError } = await supabase
      .from('quizzes')
      .select('questions')
      .eq('id', id)
      .eq('user_id', session.user.id)
      .single()

    if (fetchError) {
      console.error('Error fetching quiz:', fetchError)
      return new NextResponse(`Failed to fetch quiz: ${fetchError.message}`, { status: 500 })
    }

    if (!currentQuiz) {
      return new NextResponse('Quiz not found', { status: 404 })
    }

    const questions = currentQuiz.questions || []
    
    if (questionIndex < 0 || questionIndex >= questions.length) {
      return new NextResponse('Invalid question index', { status: 400 })
    }

    // Update the specific question
    questions[questionIndex] = {
      ...questions[questionIndex],
      ...updatedQuestion,
      id: questions[questionIndex].id || updatedQuestion.id, // Preserve the ID
    }

    // Update the quiz with the modified questions
    const { data, error } = await supabase
      .from('quizzes')
      .update({
        questions
      })
      .eq('id', id)
      .eq('user_id', session.user.id)
      .select()
      .single()

    if (error) {
      console.error('Database error:', error)
      return new NextResponse(`Failed to update question: ${error.message}`, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error updating question:', error)
    return new NextResponse(
      `Error updating question: ${error instanceof Error ? error.message : 'Unknown error'}`, 
      { status: 500 }
    )
  }
} 