export interface QuizSettings {
  topic: string;
  numQuestions?: number;
  difficulty?: 'easy' | 'medium' | 'hard';
  questionType?: 'multiple-choice' | 'true-false' | 'fill-in-the-blank';
  content?: string;
  fileContent?: string;
  fileName?: string;
}

export interface Question {
  id: string;
  question: string;
  options: string[];
  answer: string;
  explanation?: string;
}

export interface Quiz {
  id: string;
  title: string;
  description?: string;
  questions: Question[];
  created_at: string;
  updated_at: string;
  user_id: string;
  subject?: string;
  category?: string;
} 