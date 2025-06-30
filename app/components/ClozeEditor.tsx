'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Edit, Check, X, RotateCcw, Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

interface ClozeEditorProps {
  question: {
    id?: string;
    text: string;
    type: string;
    clozeText?: string;
    originalText?: string;
    correctAnswer: string;
  };
  quizId?: string;
  allQuestions?: any[];
  onUpdate: (updatedQuestion: any) => void;
  autoEdit?: boolean; // New prop to automatically start editing
  onCancel?: () => void; // New prop to handle cancel action
}

export default function ClozeEditor({ question, quizId, allQuestions, onUpdate, autoEdit = false, onCancel }: ClozeEditorProps) {
  const [isEditing, setIsEditing] = useState(autoEdit);
  const [saving, setSaving] = useState(false);
  const [selectedText, setSelectedText] = useState('');
  const [words, setWords] = useState<string[]>(() => {
    // Initialize words immediately if autoEdit is true
    if (autoEdit) {
      const getInitialText = () => {
        let originalText = question.originalText;
        
        if (!originalText && question.clozeText) {
          originalText = question.clozeText.replace(/\{\{c1::(.*?)\}\}/g, '$1');
        }
        
        if (!originalText) {
          originalText = question.text;
        }
        
        if (!originalText && question.correctAnswer) {
          originalText = `Fill in the blank: ${question.correctAnswer}`;
        }
        
        return originalText || '';
      };
      
      const initialText = getInitialText();
      return initialText ? initialText.split(/(\s+)/) : [];
    }
    return [];
  });
  const [selectedIndices, setSelectedIndices] = useState<number[]>(() => {
    // Initialize selected indices if autoEdit is true and we have words
    if (autoEdit && question.correctAnswer) {
      const getInitialText = () => {
        let originalText = question.originalText;
        
        if (!originalText && question.clozeText) {
          originalText = question.clozeText.replace(/\{\{c1::(.*?)\}\}/g, '$1');
        }
        
        if (!originalText) {
          originalText = question.text;
        }
        
        if (!originalText && question.correctAnswer) {
          originalText = `Fill in the blank: ${question.correctAnswer}`;
        }
        
        return originalText || '';
      };
      
      const initialText = getInitialText();
      if (initialText) {
        const wordArray = initialText.split(/(\s+)/);
        const answerWords = question.correctAnswer.split(/\s+/);
        const indices: number[] = [];
        
        for (let i = 0; i < wordArray.length; i++) {
          const word = wordArray[i].trim();
          if (word && answerWords.some(answerWord => 
            word.toLowerCase().includes(answerWord.toLowerCase()) || 
            answerWord.toLowerCase().includes(word.toLowerCase())
          )) {
            indices.push(i);
          }
        }
        return indices;
      }
    }
    return [];
  });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<number | null>(null);
  const { toast } = useToast();

  const getOriginalText = () => {
    // Get the original text - prioritize originalText, then try to reconstruct from clozeText, finally fall back to text
    let originalText = question.originalText;
    
    if (!originalText && question.clozeText) {
      // If we have clozeText but no originalText, reconstruct it by replacing cloze markers with the answer
      originalText = question.clozeText.replace(/\{\{c1::(.*?)\}\}/g, '$1');
    }
    
    if (!originalText) {
      // Final fallback to question.text
      originalText = question.text;
    }
    
    // If still no text, create a fallback from the correct answer
    if (!originalText && question.correctAnswer) {
      originalText = `Fill in the blank: ${question.correctAnswer}`;
    }
    
    return originalText || '';
  };

  const startEditing = () => {
    setIsEditing(true);
    
    const originalText = getOriginalText();
    
    if (!originalText) {
      console.error('❌ ClozeEditor - No text available for editing!');
      // Reset all state and exit editing mode
      setIsEditing(false);
      setWords([]);
      setSelectedIndices([]);
      return;
    }
    
    const wordArray = originalText.split(/(\s+)/); // Split by spaces but keep spaces
    setWords(wordArray);
    
    // Find currently selected indices based on correctAnswer
    if (question.correctAnswer) {
      const answerWords = question.correctAnswer.split(/\s+/);
      const indices: number[] = [];
      
      for (let i = 0; i < wordArray.length; i++) {
        const word = wordArray[i].trim();
        if (word && answerWords.some(answerWord => 
          word.toLowerCase().includes(answerWord.toLowerCase()) || 
          answerWord.toLowerCase().includes(word.toLowerCase())
        )) {
          indices.push(i);
        }
      }
      setSelectedIndices(indices);
    }
  };

  // Auto-start editing when autoEdit is true or when question changes
  useEffect(() => {
    if (autoEdit && !isEditing) {
      startEditing();
    }
  }, [autoEdit, question.text, question.clozeText, question.originalText]);

  const handleMouseDown = (index: number) => {
    const word = words[index].trim();
    if (!word) return;
    
    setIsDragging(true);
    setDragStart(index);
    
    // Start with this word selected
    setSelectedIndices(prev => {
      if (prev.includes(index)) {
        return prev.filter(i => i !== index);
      } else {
        return [...prev, index].sort((a, b) => a - b);
      }
    });
  };

  const handleMouseEnter = (index: number) => {
    if (!isDragging || dragStart === null) return;
    
    const word = words[index].trim();
    if (!word) return;
    
    // Select range from dragStart to current index
    const start = Math.min(dragStart, index);
    const end = Math.max(dragStart, index);
    
    const rangeIndices: number[] = [];
    for (let i = start; i <= end; i++) {
      if (words[i].trim()) { // Only include non-empty words
        rangeIndices.push(i);
      }
    }
    
    setSelectedIndices(rangeIndices);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setDragStart(null);
  };

  const handleTouchStart = (index: number, e: React.TouchEvent) => {
    e.preventDefault();
    handleMouseDown(index);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    
    e.preventDefault();
    const touch = e.touches[0];
    const element = document.elementFromPoint(touch.clientX, touch.clientY);
    
    if (element && element instanceof HTMLElement && element.dataset.wordIndex) {
      const index = parseInt(element.dataset.wordIndex);
      handleMouseEnter(index);
    }
  };

  const handleTouchEnd = () => {
    handleMouseUp();
  };

  const toggleWordSelection = (index: number) => {
    const word = words[index].trim();
    if (!word) return; // Skip spaces and punctuation
    
    setSelectedIndices(prev => {
      if (prev.includes(index)) {
        return prev.filter(i => i !== index);
      } else {
        return [...prev, index].sort((a, b) => a - b);
      }
    });
  };

  const saveChanges = async () => {
    if (selectedIndices.length === 0) return;
    
    setSaving(true);
    
    try {
      // Get selected text
      const selectedWords = selectedIndices.map(i => words[i].trim()).filter(w => w);
      const newCorrectAnswer = selectedWords.join(' ');
      
      // Create new cloze text
      const newClozeText = words.map((word, index) => {
        if (selectedIndices.includes(index) && word.trim()) {
          // If this is the first selected word, wrap all selected words
          if (index === selectedIndices[0]) {
            const allSelectedText = selectedIndices.map(i => words[i].trim()).filter(w => w).join(' ');
            return `{{c1::${allSelectedText}}}`;
          }
          return ''; // Other selected words are replaced by empty string
        }
        return word;
      }).join('').replace(/\s+/g, ' ').trim();

      const updatedQuestion = {
        ...question,
        clozeText: newClozeText,
        correctAnswer: newCorrectAnswer,
        originalText: words.join('') // This preserves the exact spacing
      };

      // Update local state immediately
      onUpdate(updatedQuestion);

      // Save to database if we have quizId and allQuestions
      if (quizId && allQuestions) {
        const updatedQuestions = allQuestions.map(q => 
          q.id === question.id ? updatedQuestion : q
        );

        const response = await fetch('/api/update-quiz', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            quizId,
            questions: updatedQuestions
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to save changes');
        }

        toast({
          title: "✅ Cloze Updated",
          description: "Your cloze deletion has been saved successfully.",
          className: "border-green-200 bg-green-50 text-green-900",
          duration: 3000,
        });
      }

      setIsEditing(false);
    } catch (error) {
      console.error('Error saving cloze changes:', error);
      toast({
        title: "Error",
        description: "Failed to save changes. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setSelectedIndices([]);
    setWords([]);
    // Notify parent component to exit editing mode
    if (onCancel) {
      onCancel();
    }
  };

  const resetToOriginal = () => {
    // Reset to original cloze deletion using the same logic as startEditing
    const originalText = getOriginalText();
    
    if (!originalText) {
      setWords(['No text available for editing']);
      setSelectedIndices([]);
      return;
    }
    
    const wordArray = originalText.split(/(\s+)/);
    setWords(wordArray);
    setSelectedIndices([]);
  };

  if (!isEditing) {
    // If we're not editing and autoEdit is true, there might be an issue
    // Return null to avoid showing confusing UI
    if (autoEdit) {
      return null;
    }
    
    return (
      <div className="mt-2 ml-4">
        <Button
          variant="outline"
          size="sm"
          onClick={startEditing}
          className="text-xs"
        >
          <Edit className="h-3 w-3 mr-1" />
          Edit Cloze
        </Button>
      </div>
    );
  }

  return (
    <div 
      className="mt-3 ml-4 p-4 bg-blue-50 border border-blue-200 rounded-lg"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Current Question Display */}
      <div className="mb-4 p-3 bg-white rounded-lg border border-gray-200">
        <div className="text-sm font-medium text-gray-700 mb-2">Current Question:</div>
        <div className="text-base text-gray-900">
          {question.clozeText?.replace(/\{\{c1::(.*?)\}\}/g, '_______________') || question.text}
        </div>
        <div className="mt-2 text-sm text-gray-600">
          <span className="font-medium">Answer: </span>
          <span className="bg-green-100 px-2 py-1 rounded">{question.correctAnswer}</span>
        </div>
      </div>

      <div className="mb-3">
        <p className="text-sm font-medium text-blue-900 mb-2">
          Click individual words or drag to select multiple words to hide:
        </p>
        <div 
          className="text-base leading-relaxed select-none"
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchEnd={handleTouchEnd}
          onTouchMove={handleTouchMove}
          onClick={(e) => e.stopPropagation()}
        >
          {words.length === 0 ? (
            <div className="text-gray-500 italic">Loading text for editing...</div>
          ) : (
            words.map((word, index) => {
              const isSelected = selectedIndices.includes(index);
              const isSpace = !word.trim();
              
              if (isSpace) {
                return <span key={index}>{word}</span>;
              }
              
              return (
                <span
                  key={index}
                  data-word-index={index}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    handleMouseDown(index);
                  }}
                  onMouseEnter={() => handleMouseEnter(index)}
                  onTouchStart={(e) => handleTouchStart(index, e)}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!isDragging) toggleWordSelection(index);
                  }}
                  className={`cursor-pointer px-1 py-0.5 rounded transition-all duration-200 ${
                    isSelected
                      ? 'bg-blue-600 text-white shadow-sm'
                      : isDragging
                      ? 'hover:bg-blue-300'
                      : 'hover:bg-blue-200'
                  } ${isDragging ? 'user-select-none' : ''}`}
                  style={{ userSelect: 'none', WebkitUserSelect: 'none', touchAction: 'none' }}
                >
                  {word}
                </span>
              );
            })
          )}
        </div>
      </div>
      
      {selectedIndices.length > 0 && (
        <div className="mb-3 space-y-2">
          <div className="p-2 bg-white rounded border">
            <p className="text-sm text-gray-600">Selected for deletion:</p>
            <p className="font-medium text-blue-900">
              {selectedIndices.map(i => words[i].trim()).filter(w => w).join(' ')}
            </p>
          </div>
          <div className="p-2 bg-green-50 rounded border border-green-200">
            <p className="text-sm text-green-700 font-medium">Preview:</p>
            <p className="text-base text-green-900">
              {words.map((word, index) => {
                if (selectedIndices.includes(index) && word.trim()) {
                  if (index === selectedIndices[0]) {
                    return '_______________';
                  }
                  return '';
                }
                return word;
              }).join('').replace(/\s+/g, ' ').trim()}
            </p>
          </div>
        </div>
      )}
      
      <div className="flex gap-2">
        <Button
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            saveChanges();
          }}
          disabled={selectedIndices.length === 0 || saving}
          className="bg-green-600 hover:bg-green-700"
        >
          {saving ? (
            <>
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Check className="h-3 w-3 mr-1" />
              Save
            </>
          )}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={(e) => {
            e.stopPropagation();
            cancelEditing();
          }}
          disabled={saving}
        >
          <X className="h-3 w-3 mr-1" />
          Cancel
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={(e) => {
            e.stopPropagation();
            resetToOriginal();
          }}
          disabled={saving}
        >
          <RotateCcw className="h-3 w-3 mr-1" />
          Reset
        </Button>
      </div>
    </div>
  );
} 