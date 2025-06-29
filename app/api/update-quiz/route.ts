import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function PUT(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
    }

    const { quizId, title } = await request.json();

    if (!quizId || !title || title.trim().length === 0) {
      return NextResponse.json({ error: 'Quiz ID and title are required' }, { status: 400 });
    }

    // Validate title length
    if (title.trim().length > 200) {
      return NextResponse.json({ error: 'Title is too long (max 200 characters)' }, { status: 400 });
    }

    // Update the quiz title, but only if the user owns the quiz
    const { data, error } = await supabase
      .from('quizzes')
      .update({ title: title.trim() })
      .eq('id', quizId)
      .eq('user_id', user.id)
      .select('id, title')
      .single();

    if (error) {
      console.error('Error updating quiz:', error);
      return NextResponse.json({ error: 'Failed to update quiz' }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: 'Quiz not found or access denied' }, { status: 404 });
    }

    return NextResponse.json({ 
      success: true, 
      quiz: data,
      message: 'Quiz title updated successfully' 
    });

  } catch (error) {
    console.error('Error in update-quiz route:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 