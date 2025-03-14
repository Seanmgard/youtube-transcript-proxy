'use client';

interface AnkiConnectRequest {
  action: string;
  version: number;
  params: any;
}

interface AnkiNote {
  deckName: string;
  modelName: string;
  fields: {
    Front: string;
    Back: string;
  };
  options: {
    allowDuplicate: boolean;
    duplicateScope: string;
  };
  tags: string[];
}

// Check if we're in a browser environment
const isBrowser = typeof window !== 'undefined';
console.log('ANKI-CONNECT: Browser environment check:', { isBrowser });

// Function to detect if we're in a secure context (HTTPS)
const isSecureContext = isBrowser && window.isSecureContext;
console.log('ANKI-CONNECT: Secure context check:', { isSecureContext });

// Always use HTTP for local connections, regardless of the page's protocol
// This is because Anki-Connect doesn't support HTTPS by default
const ANKI_CONNECT_URL = 'http://127.0.0.1:8765';

async function invokeAnkiConnect(action: string, params = {}) {
  console.log(`ANKI-CONNECT: Invoking Anki-Connect action: ${action}`, params);
  
  if (!isBrowser) {
    console.error('ANKI-CONNECT: Not in browser environment');
    throw new Error('Anki-Connect can only be used in a browser environment');
  }
  
  try {
    console.log(`ANKI-CONNECT: Connecting to Anki-Connect at: ${ANKI_CONNECT_URL}`);
    
    const requestBody = {
      action,
      version: 6,
      params
    };
    
    console.log('ANKI-CONNECT: Request body:', JSON.stringify(requestBody));
    
    const response = await fetch(ANKI_CONNECT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    console.log('ANKI-CONNECT: Response status:', response.status);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    console.log(`ANKI-CONNECT: Response for ${action}:`, result);

    if (result.error) {
      throw new Error(`Anki-Connect error: ${result.error}`);
    }
    return result;
  } catch (error) {
    console.error(`ANKI-CONNECT: Error for ${action}:`, error);
    
    // Provide more helpful error messages
    if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
      console.error('ANKI-CONNECT: Connection error detected');
      
      // Check if we're in a secure context but trying to access an insecure resource
      if (isSecureContext) {
        throw new Error(
          'Could not connect to Anki. This may be due to mixed content restrictions.\n\n' +
          'Please make sure:\n' +
          '1. Anki is running on your computer\n' +
          '2. The Anki-Connect plugin is installed\n' +
          '3. You\'ve configured Anki-Connect to allow connections from this website\n' +
          '4. You\'ve allowed mixed content in your browser for this site\n\n' +
          'To allow mixed content, look for a shield icon in your browser\'s address bar.'
        );
      } else {
        throw new Error(
          'Could not connect to Anki. Please make sure:\n' +
          '1. Anki is running on your computer\n' +
          '2. The Anki-Connect plugin is installed\n' +
          '3. You\'ve configured Anki-Connect to allow connections from this website\n' +
          '4. You\'re using this feature from your browser, not a mobile device'
        );
      }
    }
    
    throw error;
  }
}

// Test Anki connection
export async function testAnkiConnection() {
  console.log('ANKI-CONNECT: Testing connection to Anki...');
  try {
    const result = await invokeAnkiConnect('version', {});
    console.log('ANKI-CONNECT: Connection test successful:', result);
    return true;
  } catch (error) {
    console.error('ANKI-CONNECT: Connection test failed:', error);
    return false;
  }
}

export async function createDeck(deckName: string) {
  console.log('ANKI-CONNECT: Creating deck:', deckName);
  return invokeAnkiConnect('createDeck', { deck: deckName });
}

export async function addNotes(notes: AnkiNote[]) {
  console.log('ANKI-CONNECT: Adding notes, count:', notes.length);
  return invokeAnkiConnect('addNotes', { notes });
}

export async function sendQuizToAnki(quiz: any, deckName: string) {
  console.log('ANKI-CONNECT: Starting to send quiz to Anki...', { deckName, quizId: quiz.id });

  try {
    // First test the connection
    console.log('ANKI-CONNECT: Testing connection...');
    const isConnected = await testAnkiConnection();
    console.log('ANKI-CONNECT: Connection test result:', isConnected);
    
    if (!isConnected) {
      throw new Error('Could not connect to Anki. Please make sure Anki is running with AnkiConnect installed.');
    }

    // Prepare notes for Anki
    console.log('ANKI-CONNECT: Preparing notes from quiz questions...');
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
    
    console.log('ANKI-CONNECT: Prepared notes count:', notes.length);

    // Create deck first
    console.log('ANKI-CONNECT: Creating deck:', deckName);
    await createDeck(deckName);
    
    // Add notes to deck
    console.log('ANKI-CONNECT: Adding notes to deck...');
    const result = await addNotes(notes);
    console.log('ANKI-CONNECT: Notes added, result:', result);
    
    return {
      success: true,
      addedNotes: result.result.length,
      message: `Successfully added ${result.result.length} cards to Anki deck "${deckName}"`
    };
  } catch (error) {
    console.error('ANKI-CONNECT: Error in sendQuizToAnki:', error);
    throw error;
  }
} 