'use client';

import React, { useState } from 'react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/app/components/ui/use-toast';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter 
} from '@/app/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/app/components/ui/radio-group';
import { Question } from '@/lib/types';
import { MultiImageUploader } from './MultiImageUploader';
import { Edit3, Save, X, Plus, Trash2, Sparkles, BookOpen } from 'lucide-react';

interface QuestionEditorProps {
  question: Question;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedQuestion: Question) => void;
}

export function QuestionEditor({ question, isOpen, onClose, onSave }: QuestionEditorProps) {
  const [editedQuestion, setEditedQuestion] = useState<Question>({ ...question });
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  const handleSave = async () => {
    setIsSaving(true);
    try {
      if (!editedQuestion.text.trim()) {
        toast({
          title: 'Validation Error',
          description: 'Question text is required.',
          variant: 'destructive',
        });
        return;
      }

      if (!editedQuestion.correctAnswer.trim()) {
        toast({
          title: 'Validation Error',
          description: 'Correct answer is required.',
          variant: 'destructive',
        });
        return;
      }

      if (editedQuestion.type === 'multiple_choice' && (!editedQuestion.options || editedQuestion.options.length < 2)) {
        toast({
          title: 'Validation Error',
          description: 'Multiple choice questions need at least 2 options.',
          variant: 'destructive',
        });
        return;
      }

      onSave(editedQuestion);
      toast({
        title: 'Question Updated',
        description: 'Your question has been successfully updated.',
      });
      onClose();
    } catch (error) {
      console.error('Error saving question:', error);
      toast({
        title: 'Error',
        description: 'Failed to save question. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddOption = () => {
    if (!editedQuestion.options) {
      setEditedQuestion({ ...editedQuestion, options: [''] });
    } else {
      setEditedQuestion({
        ...editedQuestion,
        options: [...editedQuestion.options, '']
      });
    }
  };

  const handleRemoveOption = (index: number) => {
    if (editedQuestion.options && editedQuestion.options.length > 2) {
      const newOptions = editedQuestion.options.filter((_, i) => i !== index);
      setEditedQuestion({ ...editedQuestion, options: newOptions });
    }
  };

  const handleOptionChange = (index: number, value: string) => {
    if (editedQuestion.options) {
      const newOptions = [...editedQuestion.options];
      newOptions[index] = value;
      setEditedQuestion({ ...editedQuestion, options: newOptions });
    }
  };

  const handleTypeChange = (type: 'multiple_choice' | 'open_ended' | 'cloze') => {
    const updatedQuestion = { ...editedQuestion, type };
    
    if (type === 'multiple_choice' && !updatedQuestion.options) {
      updatedQuestion.options = ['', '', '', ''];
    }
    
    setEditedQuestion(updatedQuestion);
  };

  // Helper function to convert old single image format to new multi-image format
  const convertToMultiImages = (singleImage: any) => {
    if (!singleImage) return [];
    return [singleImage];
  };

  // Helper function to get current images (handles both old and new formats)
  const getCurrentFrontImages = () => {
    if (editedQuestion.frontImages) return editedQuestion.frontImages;
    if ((editedQuestion as any).frontImage) return convertToMultiImages((editedQuestion as any).frontImage);
    return [];
  };

  const getCurrentBackImages = () => {
    if (editedQuestion.backImages) return editedQuestion.backImages;
    if ((editedQuestion as any).backImage) return convertToMultiImages((editedQuestion as any).backImage);
    return [];
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[95vh] overflow-y-auto bg-gradient-to-br from-white to-gray-50">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-xl">
            <div className="p-2 rounded-xl bg-gradient-to-r from-blue-500 to-purple-600">
              <BookOpen className="h-6 w-6 text-white" />
            </div>
            <div>
              <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Edit Your Flashcard
              </span>
              <div className="flex items-center gap-2 mt-1">
                <Sparkles className="h-4 w-4 text-yellow-500" />
                <span className="text-sm text-gray-600 font-normal">Make it perfect for studying!</span>
              </div>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div>
            <Label className="text-base font-medium">Question Type</Label>
            <RadioGroup
              value={editedQuestion.type}
              onValueChange={handleTypeChange}
              className="flex gap-6 mt-2"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="multiple_choice" id="mc" />
                <Label htmlFor="mc">Multiple Choice</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="open_ended" id="oe" />
                <Label htmlFor="oe">Open Ended</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="cloze" id="cloze" />
                <Label htmlFor="cloze">Cloze Deletion</Label>
              </div>
            </RadioGroup>
          </div>

          <div>
            <Label htmlFor="question-text" className="text-base font-medium">
              Question Text
            </Label>
            <Textarea
              id="question-text"
              value={editedQuestion.text}
              onChange={(e) => setEditedQuestion({ ...editedQuestion, text: e.target.value })}
              placeholder="Enter your question here..."
              className="mt-2"
              rows={3}
            />
          </div>

          <MultiImageUploader
            label="Question Side Images"
            currentImages={getCurrentFrontImages()}
            onImagesChange={(images) => {
              const updatedQuestion = { ...editedQuestion };
              updatedQuestion.frontImages = images;
              // Remove old single image field
              delete (updatedQuestion as any).frontImage;
              setEditedQuestion(updatedQuestion);
            }}
            maxImages={2}
            side="front"
            className="w-full"
          />

          {editedQuestion.type === 'multiple_choice' && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <Label className="text-base font-medium">Answer Options</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddOption}
                  className="flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Add Option
                </Button>
              </div>
              <div className="space-y-3">
                {editedQuestion.options?.map((option, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      value={option}
                      onChange={(e) => handleOptionChange(index, e.target.value)}
                      placeholder={`Option ${String.fromCharCode(65 + index)}`}
                      className="flex-1"
                    />
                    {editedQuestion.options && editedQuestion.options.length > 2 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleRemoveOption(index)}
                        className="px-3"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <Label htmlFor="correct-answer" className="text-base font-medium">
              Correct Answer
            </Label>
            <Input
              id="correct-answer"
              value={editedQuestion.correctAnswer}
              onChange={(e) => setEditedQuestion({ ...editedQuestion, correctAnswer: e.target.value })}
              placeholder="Enter the correct answer..."
              className="mt-2"
            />
          </div>

          <MultiImageUploader
            label="Answer Side Images"
            currentImages={getCurrentBackImages()}
            onImagesChange={(images) => {
              const updatedQuestion = { ...editedQuestion };
              updatedQuestion.backImages = images;
              // Remove old single image field
              delete (updatedQuestion as any).backImage;
              setEditedQuestion(updatedQuestion);
            }}
            maxImages={2}
            side="back"
            className="w-full"
          />

          {editedQuestion.type === 'cloze' && (
            <>
              <div>
                <Label htmlFor="cloze-text" className="text-base font-medium">
                  Cloze Text (with {`{{c1::answer}}`} format)
                </Label>
                <Textarea
                  id="cloze-text"
                  value={editedQuestion.clozeText || ''}
                  onChange={(e) => setEditedQuestion({ ...editedQuestion, clozeText: e.target.value })}
                  placeholder="Enter text with {{c1::word to hide}} format..."
                  className="mt-2"
                  rows={2}
                />
              </div>
              
              <div>
                <Label htmlFor="original-text" className="text-base font-medium">
                  Original Text (complete sentence)
                </Label>
                <Textarea
                  id="original-text"
                  value={editedQuestion.originalText || ''}
                  onChange={(e) => setEditedQuestion({ ...editedQuestion, originalText: e.target.value })}
                  placeholder="Enter the complete sentence without any formatting..."
                  className="mt-2"
                  rows={2}
                />
              </div>
            </>
          )}
        </div>

        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <>
                <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 