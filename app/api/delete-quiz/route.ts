import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const quizId = searchParams.get('id');

    if (!quizId) {
      return NextResponse.json(
        { error: 'Quiz ID is required' },
        { status: 400 }
      );
    }

    // Create a new supabase client
    const supabase = await createClient();

    // Get the current user using getUser() for better security
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError) {
      console.error('Authentication error:', userError);
      return NextResponse.json(
        { error: 'Authentication failed: ' + userError.message },
        { status: 401 }
      );
    }
    
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Check if the quiz belongs to the user
    const { data: quiz, error: quizError } = await supabase
      .from('quizzes')
      .select('user_id')
      .eq('id', quizId)
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
      .eq('quiz_id', quizId);
      
    if (progressError) {
      console.error('Error deleting learning progress:', progressError);
      // Continue with quiz deletion even if progress deletion fails
    }

    // Delete the quiz
    const { error: deleteError } = await supabase
      .from('quizzes')
      .delete()
      .eq('id', quizId);

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