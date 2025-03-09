import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';

export async function GET(request: Request) {
  const supabase = createRouteHandlerClient({ cookies });
  const url = new URL(request.url);
  const examId = url.searchParams.get('examId');
  
  try {
    // Get the user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    let query = supabase
      .from('exam_results')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    
    // If examId is provided, filter by it
    if (examId) {
      query = query.eq('exam_id', examId);
    }
    
    const { data: results, error: resultsError } = await query;
    
    if (resultsError) {
      console.error('Error fetching exam results:', resultsError);
      return NextResponse.json({ error: 'Failed to fetch exam results' }, { status: 500 });
    }
    
    return NextResponse.json({ results });
  } catch (error) {
    console.error('Error in GET /api/exam-results:', error);
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
    const { exam_id, score, total_questions, question_results } = await request.json();
    
    if (!exam_id || score === undefined || !total_questions || !question_results) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }
    
    // Create the exam result
    const examResult = {
      id: uuidv4(),
      user_id: user.id,
      exam_id,
      score,
      total_questions,
      question_results,
      completed_at: new Date().toISOString(),
      created_at: new Date().toISOString()
    };
    
    const { data, error } = await supabase
      .from('exam_results')
      .insert(examResult)
      .select()
      .single();
    
    if (error) {
      console.error('Error creating exam result:', error);
      return NextResponse.json({ error: 'Failed to create exam result' }, { status: 500 });
    }
    
    return NextResponse.json({ result: data });
  } catch (error) {
    console.error('Error in POST /api/exam-results:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 