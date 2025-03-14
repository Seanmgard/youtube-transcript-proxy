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

async function invokeAnkiConnect(action: string, params = {}) {
  const response = await fetch('http://127.0.0.1:8765', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      action,
      version: 6,
      params
    })
  });

  const result = await response.json();
  if (result.error) {
    throw new Error(`Anki-Connect error: ${result.error}`);
  }
  return result;
}

export async function createDeck(deckName: string) {
  return invokeAnkiConnect('createDeck', { deck: deckName });
}

export async function addNotes(notes: AnkiNote[]) {
  return invokeAnkiConnect('addNotes', { notes });
}

export async function sendQuizToAnki(quiz: any, deckName: string) {
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

  // Create deck first
  await createDeck(deckName);
  
  // Add notes to deck
  const result = await addNotes(notes);
  
  return {
    success: true,
    addedNotes: result.result.length,
    message: `Successfully added ${result.result.length} cards to Anki deck "${deckName}"`
  };
} 