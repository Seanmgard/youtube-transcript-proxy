import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { Document, Packer, Paragraph, TextRun, HeadingLevel, PageBreak } from 'docx'
import { getCookieOptions } from '@/utils/supabase/cookies-helper'

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
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const quizId = searchParams.get('id')
    const format = searchParams.get('format')

    if (!quizId || !format) {
      return new NextResponse('Missing parameters', { status: 400 })
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

    if (!quiz.settings || typeof quiz.settings !== 'object') {
      console.error('Invalid quiz structure - missing settings:', quiz)
      return new NextResponse('Invalid quiz structure', { status: 400 })
    }

    let content: any = null
    let filename = `quiz-${quizId}`
    let contentType = 'text/plain'

    switch (format) {
      case 'doc':
        try {
          console.log('Generating DOC format for quiz:', quizId);
          const docxInfo = await generateDocFormat(quiz)
          content = docxInfo.content
          filename = docxInfo.filename
          contentType = docxInfo.contentType
          console.log('DOC format generated successfully');
        } catch (error) {
          console.error('Error generating DOC format:', error)
          const errorMessage = error instanceof Error 
            ? `${error.message}\n${error.stack}` 
            : 'Unknown error';
          return new NextResponse(`Error generating DOC format: ${errorMessage}`, { status: 500 })
        }
        break
      case 'csv':
        try {
          content = generateCsvFormat(quiz)
        } catch (error) {
          console.error('Error generating CSV format:', error)
          return new NextResponse(`Error generating CSV format: ${error instanceof Error ? error.message : 'Unknown error'}`, { status: 500 })
        }
        filename += '.csv'
        contentType = 'text/csv'
        break
      case 'anki':
        try {
          content = generateAnkiFormat(quiz)
        } catch (error) {
          console.error('Error generating Anki format:', error)
          return new NextResponse(`Error generating Anki format: ${error instanceof Error ? error.message : 'Unknown error'}`, { status: 500 })
        }
        filename += '.txt'
        contentType = 'text/plain'
        break
      default:
        return new NextResponse('Invalid format', { status: 400 })
    }

    return new NextResponse(content, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error('Error exporting quiz:', error)
    const errorMessage = error instanceof Error 
      ? `${error.message}\n${error.stack}` 
      : 'Unknown error';
    return new NextResponse(
      `Error exporting quiz: ${errorMessage}`, 
      { status: 500 }
    )
  }
}

async function generateDocFormat(quiz: any) {
  try {
    // Create paragraphs for questions and answers
    const questionParagraphs: Paragraph[] = [];
    
    // Add questions
    for (let i = 0; i < quiz.questions.length; i++) {
      const question = quiz.questions[i];
      
      // Add question text
      questionParagraphs.push(
        new Paragraph({
          text: `${i + 1}. ${question.text}`,
        })
      );
      
      // Add options for multiple choice
      if (question.type === 'multiple_choice' && question.options) {
        for (let j = 0; j < question.options.length; j++) {
          questionParagraphs.push(
            new Paragraph({
              text: `   ${String.fromCharCode(97 + j)}) ${question.options[j]}`,
            })
          );
        }
      }
      
      // Add empty line after each question
      questionParagraphs.push(new Paragraph({}));
    }
    
    // Create answer key paragraphs
    const answerKeyParagraphs: Paragraph[] = [
      // Page break before answer key
      new Paragraph({
        children: [new PageBreak()],
      }),
      
      // Answer key header
      new Paragraph({
        text: "Answer Key",
      }),
      
      new Paragraph({}),
    ];
    
    // Add answers
    for (let i = 0; i < quiz.questions.length; i++) {
      const question = quiz.questions[i];
      let answerText = '';
      
      if (question.type === 'multiple_choice' && question.options) {
        // Find which option matches the correct answer
        const correctIndex = question.options.findIndex((option: string) => option === question.correctAnswer);
        if (correctIndex !== -1) {
          const letter = String.fromCharCode(97 + correctIndex).toUpperCase();
          answerText = `${letter}) ${question.correctAnswer}`;
        } else {
          // Fallback if we can't find the exact match
          answerText = question.correctAnswer;
        }
      } else {
        // For open-ended questions, just show the answer
        answerText = question.correctAnswer;
      }
      
      answerKeyParagraphs.push(
        new Paragraph({
          text: `${i + 1}. ${answerText}`,
        })
      );
    }
    
    // Create a simple document with minimal formatting
    const doc = new Document({
      sections: [{
        properties: {},
        children: [
          // Title
          new Paragraph({
            text: quiz.title,
          }),
          
          // Empty line
          new Paragraph({}),
          
          // Basic quiz info
          new Paragraph({
            text: `Created: ${new Date(quiz.created_at).toLocaleDateString()}`,
          }),
          new Paragraph({
            text: `Difficulty: ${quiz.settings.difficulty}`,
          }),
          new Paragraph({
            text: `Question Type: ${quiz.settings.questionType}`,
          }),
          new Paragraph({
            text: `Number of Questions: ${quiz.questions.length}`,
          }),
          
          // Empty line
          new Paragraph({}),
          
          // Add all question paragraphs
          ...questionParagraphs,
          
          // Add all answer key paragraphs
          ...answerKeyParagraphs,
        ],
      }],
    });

    // Generate the document as a buffer
    const buffer = await Packer.toBuffer(doc);

    return {
      content: buffer,
      filename: `${quiz.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.docx`,
      contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    };
  } catch (error) {
    console.error('Error in generateDocFormat:', error);
    throw error;
  }
}

function generateCsvFormat(quiz: any) {
  // Optimized format for Quizlet: Clean Term,Definition pairs for effective flashcard study
  let content = 'Term,Definition\n';

  quiz.questions.forEach((q: any) => {
    // Properly escape for CSV format
    // Double quotes need to be escaped with another double quote
    let term = '';
    let definition = q.correctAnswer.replace(/"/g, '""');

    switch (q.type) {
      case 'multiple_choice':
        // For multiple choice: Just use the question text as term, correct answer as definition
        // This promotes active recall without giving away options
        term = q.text.replace(/"/g, '""');
        break;
        
      case 'cloze':
        // For cloze deletion: Show text with blanks as term, missing word(s) as definition
        if (q.clozeText) {
          // Convert {{c1::answer}} format to blanks for Quizlet
          term = q.clozeText.replace(/\{\{c1::(.*?)\}\}/g, '_____').replace(/"/g, '""');
        } else if (q.originalText) {
          // If we have original text, create a blank version
          term = q.originalText.replace(new RegExp(q.correctAnswer.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '_____').replace(/"/g, '""');
        } else {
          // Fallback: use question text
          term = q.text.replace(/"/g, '""');
        }
        break;
        
      case 'open_ended':
      default:
        // For open-ended questions: Use question text as-is
        term = q.text.replace(/"/g, '""');
        break;
    }

    // Wrap in quotes to handle commas and newlines
    content += `"${term}","${definition}"\n`;
  });

  return content;
}

function generateAnkiFormat(quiz: any) {
  // Anki format: question;answer (or cloze text for cloze deletion)
  let content = '';

  quiz.questions.forEach((q: any) => {
    if (q.type === 'cloze') {
      // For cloze deletion, use the cloze text directly
      // Anki will import this as a cloze deletion card
      let clozeText = (q.clozeText || q.text).replace(/;/g, '\\;');
      content += `${clozeText}\n`;
    } else {
      // For other question types, use standard question;answer format
      let question = q.text.replace(/;/g, '\\;');
      let answer = q.correctAnswer.replace(/;/g, '\\;');

      if (q.type === 'multiple_choice') {
        question += '\n' + q.options.map((opt: string, i: number) => 
          `${String.fromCharCode(97 + i)}) ${opt.replace(/;/g, '\\;')}`
        ).join('\n');
      }

      content += `${question};${answer}\n`;
    }
  });

  return content;
}

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

    // ... rest of the function remains unchanged
    // ... existing code ...
  } catch (error) {
    // ... existing code ...
  }
} 