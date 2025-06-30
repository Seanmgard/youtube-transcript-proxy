import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function PUT(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const { quizId, title, questions } = body;

    if (!quizId) {
      return NextResponse.json({ error: 'Quiz ID is required' }, { status: 400 });
    }

    // Prepare update data
    const updateData: any = {};
    if (title) updateData.title = title;
    if (questions) updateData.questions = questions;

    // Update the quiz
    const { data: quiz, error } = await supabase
      .from('quizzes')
      .update(updateData)
      .eq('id', quizId)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating quiz:', error);
      return NextResponse.json({ error: 'Failed to update quiz' }, { status: 500 });
    }

    return NextResponse.json({ quiz });
  } catch (error) {
    console.error('Error in PUT /api/update-quiz:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 