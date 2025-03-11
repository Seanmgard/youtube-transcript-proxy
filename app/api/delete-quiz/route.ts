import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/lib/database.types';

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const quizIdParam = searchParams.get('id');

    if (!quizIdParam) {
      return NextResponse.json(
        { error: 'Quiz ID is required' },
        { status: 400 }
      );
    }

    // Explicitly type quizId as string to match Database type
    const quizId: Database['public']['Tables']['quizzes']['Row']['id'] = quizIdParam;

    const supabase = await createClient();

    // Get the current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      console.error('Authentication error:', userError);
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Check if the quiz belongs to the user
    const { data: quiz, error: quizError } = await supabase
      .from('quizzes')
      .select('user_id')
      .eq('id', quizId as string)
      .single();

    if (quizError) {
      console.error('Error fetching quiz:', quizError);
      return NextResponse.json(
        { error: 'Quiz not found' },
        { status: 404 }
      );
    }

    if (quiz.user_id !== user.id) {
      return NextResponse.json(
        { error: 'You do not have permission to delete this quiz' },
        { status: 403 }
      );
    }

    // Delete learning progress first (foreign key constraint)
    const { error: progressError } = await supabase
      .from('learning_progress')
      .delete()
      .eq('quiz_id', quizId as string);
      
    if (progressError) {
      console.error('Error deleting learning progress:', progressError);
      // Continue with quiz deletion even if progress deletion fails
    }

    // Delete the quiz
    const { error: deleteError } = await supabase
      .from('quizzes')
      .delete()
      .eq('id', quizId as string);

    if (deleteError) {
      console.error('Error deleting quiz:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete quiz: ' + deleteError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, message: 'Quiz deleted successfully' });
  } catch (error) {
    console.error('Error in delete-quiz route:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 