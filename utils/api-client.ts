import { createClient } from './supabase/client';
import { QuizSettings } from '@/lib/types';

/**
 * Generates a quiz from a PDF file
 * @param file The PDF file to generate a quiz from
 * @param settings The quiz generation settings
 * @returns A ReadableStream for handling the streaming response
 */
export async function generateQuiz(file: File, settings: QuizSettings): Promise<Response> {
  // Get the Supabase client to ensure authentication is included
  const supabase = await createClient();
  
  // Create form data for the request
  const formData = new FormData();
  formData.append('file', file);
  formData.append('settings', JSON.stringify(settings));

  // Make the API request
  const response = await fetch('/api/generate-quiz', {
    method: 'POST',
    body: formData,
    // The cookie with the auth session will be automatically included
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || 'Failed to generate quiz');
  }

  return response;
}

/**
 * Deletes a quiz by ID
 * @param quizId The ID of the quiz to delete
 */
export async function deleteQuiz(quizId: string): Promise<void> {
  // Get the Supabase client to ensure authentication is included
  const supabase = await createClient();
  
  const response = await fetch(`/api/delete-quiz?id=${quizId}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || 'Failed to delete quiz');
  }
}

/**
 * Updates a quiz
 * @param quizId The ID of the quiz to update
 * @param quizData The updated quiz data
 */
export async function updateQuiz(quizId: string, quizData: any): Promise<void> {
  // Get the Supabase client to ensure authentication is included
  const supabase = await createClient();
  
  const response = await fetch('/api/update-quiz', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      id: quizId,
      ...quizData,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || 'Failed to update quiz');
  }
}

/**
 * Exports a quiz to a specific format
 * @param quizId The ID of the quiz to export
 * @param format The format to export to (e.g., 'pdf', 'csv')
 */
export async function exportQuiz(quizId: string, format: string): Promise<Blob> {
  // Get the Supabase client to ensure authentication is included
  const supabase = await createClient();
  
  const response = await fetch(`/api/export-quiz?id=${quizId}&format=${format}`, {
    method: 'GET',
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || 'Failed to export quiz');
  }

  return await response.blob();
}

/**
 * Fetches quiz data from the server
 * @param quizId The ID of the quiz to fetch
 * @returns The quiz data
 */
export async function fetchQuizData(quizId: string) {
  const response = await fetch('/api/send-to-anki', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ quizId })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `Failed to fetch quiz data: ${response.status}`);
  }

  const data = await response.json();
  if (!data.quiz) {
    throw new Error('No quiz data received from server');
  }

  return data.quiz;
}

/**
 * Sends a quiz to Anki
 * @param quizId The ID of the quiz to send to Anki
 * @param deckName The name of the Anki deck to create/use
 * @returns Promise containing the result of the Anki operation
 */
export async function sendToAnki(quizId: string, deckName: string): Promise<{
  success: boolean;
  addedNotes: number;
  message: string;
}> {
  console.log('API CLIENT: Starting sendToAnki...', { quizId, deckName });

  try {
    // First, fetch the quiz data from our API
    console.log('API CLIENT: Fetching quiz data...');
    const quiz = await fetchQuizData(quizId);
    console.log('API CLIENT: Received quiz data:', quiz);

    // Dynamically import the anki-connect module (client-side only)
    console.log('API CLIENT: Importing anki-connect module...');
    const ankiModule = await import('./anki-connect');
    console.log('API CLIENT: anki-connect module imported:', Object.keys(ankiModule));
    
    // Send the quiz to Anki
    console.log('API CLIENT: Sending quiz to Anki...');
    const result = await ankiModule.sendQuizToAnki(quiz, deckName);
    console.log('API CLIENT: Anki result:', result);
    
    return result;
  } catch (error) {
    console.error('API CLIENT: Error in sendToAnki:', error);
    
    // Just rethrow the error - we'll handle specific error messages in the UI
    throw error;
  }
} 