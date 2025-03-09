import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';

export async function GET(request: Request) {
  const supabase = createRouteHandlerClient({ cookies });
  
  try {
    // Get the user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Get all exams for the user
    const { data: exams, error: examsError } = await supabase
      .from('exams')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    
    if (examsError) {
      console.error('Error fetching exams:', examsError);
      return NextResponse.json({ error: 'Failed to fetch exams' }, { status: 500 });
    }
    
    return NextResponse.json({ exams });
  } catch (error) {
    console.error('Error in GET /api/exams:', error);
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
    const { title, description, quiz_ids } = await request.json();
    
    if (!title || !quiz_ids || !Array.isArray(quiz_ids) || quiz_ids.length === 0) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }
    
    // Create the exam
    const exam = {
      id: uuidv4(),
      user_id: user.id,
      title,
      description: description || '',
      quiz_ids,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    const { data, error } = await supabase
      .from('exams')
      .insert(exam)
      .select()
      .single();
    
    if (error) {
      console.error('Error creating exam:', error);
      return NextResponse.json({ error: 'Failed to create exam' }, { status: 500 });
    }
    
    return NextResponse.json({ exam: data });
  } catch (error) {
    console.error('Error in POST /api/exams:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 