// @ts-nocheck
import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function POST(request: Request) {
  try {
    // Create a new supabase client
    const supabase = await createClient();

    // Get the current user using getUser() for better security
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      console.error('Authentication error:', userError);
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Get all quizzes for the user
    const { data: quizzes, error: quizzesError } = await supabase
      .from('quizzes')
      .select('id')
      .eq('user_id', user.id);

    if (quizzesError) {
      console.error('Error fetching quizzes:', quizzesError);
      return NextResponse.json(
        { error: 'Failed to fetch quizzes: ' + quizzesError.message },
        { status: 500 }
      );
    }

    // Get all learning progress records for the user
    const { data: progressRecords, error: progressError } = await supabase
      .from('learning_progress')
      .select('id, quiz_id')
      .eq('user_id', user.id);

    if (progressError) {
      console.error('Error fetching learning progress:', progressError);
      return NextResponse.json(
        { error: 'Failed to fetch learning progress: ' + progressError.message },
        { status: 500 }
      );
    }

    // Create a set of valid quiz IDs
    const validQuizIds = new Set(quizzes.map(quiz => quiz.id));

    // Find orphaned progress records (those with quiz_id not in validQuizIds)
    const orphanedRecords = progressRecords.filter(record => !validQuizIds.has(record.quiz_id));

    if (orphanedRecords.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: 'No orphaned progress records found',
        cleaned: 0
      });
    }

    // Delete orphaned records
    const orphanedIds = orphanedRecords.map(record => record.id);
    const { error: deleteError } = await supabase
      .from('learning_progress')
      .delete()
      .in('id', orphanedIds);

    if (deleteError) {
      console.error('Error deleting orphaned records:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete orphaned records: ' + deleteError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Orphaned progress records cleaned up successfully',
      cleaned: orphanedRecords.length
    });
  } catch (error) {
    console.error('Error in cleanup-progress route:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 