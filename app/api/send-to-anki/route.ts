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

    // Parse request body
    const { quizId, deckName } = await request.json()

    if (!quizId || !deckName) {
      return new NextResponse('Missing required parameters', { status: 400 })
    }

    // Fetch quiz data
    const { data: quiz, error } = await supabase
      .from('quizzes')
      .select('*')
      .eq('id', quizId)
      .eq('user_id', session.user.id)
      .single()

    if (error) {
      console.error('Database error fetching quiz:', error)
      return new NextResponse(`Quiz not found: ${error.message}`, { status: 404 })
    }
    
    if (!quiz) {
      console.error('No quiz found with ID:', quizId)
      return new NextResponse('Quiz not found', { status: 404 })
    }

    // Validate quiz structure
    if (!quiz.questions || !Array.isArray(quiz.questions) || quiz.questions.length === 0) {
      console.error('Invalid quiz structure - missing questions array:', quiz)
      return new NextResponse('Invalid quiz structure', { status: 400 })
    }

    // Prepare notes for Anki
    const notes = quiz.questions.map((question: any) => {
      let front = question.text;
      
      // For multiple choice questions, include the options
      if (question.type === 'multiple_choice' && question.options) {
        front += '<br><br>' + question.options.map((opt: string, i: number) => 
          `${String.fromCharCode(97 + i)}) ${opt}`
        ).join('<br>');
      }
      
      return {
        deckName: deckName,
        modelName: "Basic",
        fields: {
          Front: front,
          Back: question.correctAnswer
        },
        options: {
          allowDuplicate: false,
          duplicateScope: "deck"
        },
        tags: [`quizlab-${quiz.id}`, "quizlab"]
      };
    });

    // Try to create the deck first if it doesn't exist
    const createDeckResponse = await fetch('http://localhost:8765', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        action: 'createDeck',
        version: 6,
        params: {
          deck: deckName
        }
      })
    }).catch(error => {
      console.error('Connection error:', error);
      throw new Error(
        'Could not connect to Anki. Please make sure Anki is running with the Anki-Connect plugin installed. ' +
        'Visit /dashboard/anki-setup for setup instructions.'
      );
    });

    // Parse the response even if the HTTP status is not OK
    const createDeckData = await createDeckResponse.json();
    
    // Check for Anki-Connect specific errors
    if (createDeckData.error) {
      console.error('Anki-Connect error creating deck:', createDeckData.error);
      throw new Error(`Anki-Connect error: ${createDeckData.error}`);
    }

    // Send notes to Anki
    const response = await fetch('http://localhost:8765', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        action: 'addNotes',
        version: 6,
        params: {
          notes: notes
        }
      })
    }).catch(error => {
      console.error('Connection error:', error);
      throw new Error(
        'Could not connect to Anki. Please make sure Anki is running with the Anki-Connect plugin installed. ' +
        'Visit /dashboard/anki-setup for setup instructions.'
      );
    });

    // Parse the response even if the HTTP status is not OK
    const result = await response.json();
    
    // Check if there was an error in the Anki-Connect response
    if (result.error) {
      console.error('Anki-Connect error:', result.error);
      throw new Error(`Anki-Connect error: ${result.error}`);
    }

    return NextResponse.json({ 
      success: true, 
      message: `Successfully added ${result.result.length} cards to Anki deck "${deckName}"`,
      addedNotes: result.result.length
    });
  } catch (error) {
    console.error('Error sending quiz to Anki:', error);
    const errorMessage = error instanceof Error 
      ? `${error.message}\n${error.stack}` 
      : 'Unknown error';
    return new NextResponse(
      `Error sending quiz to Anki: ${errorMessage}`, 
      { status: 500 }
    );
  }
} 