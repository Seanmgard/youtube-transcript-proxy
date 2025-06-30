export interface Quiz {
  id: string;
  title: string;
  user_id: string;
  created_at: string;
  pdf_url: string;
  questions: Question[];
  settings: QuizSettings;
  subject?: string;
  color?: string;
}

export interface Question {
  id: string;
  quizId: string;
  text: string;
  type: 'multiple_choice' | 'open_ended' | 'cloze';
  options?: string[];
  correctAnswer: string;
  clozeText?: string; // For cloze deletion: text with {{c1::answer}} format
  originalText?: string; // For cloze deletion: original text without cloze markers
}

export interface QuizSettings {
  numberOfQuestions: number;
  difficulty: 'easy' | 'medium' | 'hard';
  questionType: 'multiple_choice' | 'open_ended' | 'cloze';
  sourceType?: 'file' | 'youtube';
  youtubeUrl?: string;
  isLanguageLearning?: boolean;
  sourceLanguage?: string;
  targetLanguage?: string;
  extractionType?: 'words' | 'sentences';
}

export interface UserProfile {
  id: string;
  email: string;
  name?: string;
  avatarUrl?: string;
  created_at: string;
}

// Learning progress tracking interfaces
export interface LearningProgress {
  id: string;
  user_id: string;
  quiz_id: string;
  last_studied: string;
  completed_sessions: number;
  mastery_percentage: number;
  question_stats: QuestionStat[];
}

export interface QuestionStat {
  question_id: string;
  correct_count: number;
  incorrect_count: number;
  last_result: boolean;
  last_studied: string;
  confidence_level: 'low' | 'medium' | 'high';
}

// Exam-related interfaces
export interface Exam {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  quiz_ids: string[];
  created_at: string;
  updated_at: string;
}

export interface ExamResult {
  id: string;
  user_id: string;
  exam_id: string;
  score: number;
  total_questions: number;
  question_results: QuestionResult[];
  completed_at: string;
  created_at: string;
}

export interface QuizAttempt {
  id: string;
  user_id: string;
  quiz_id: string;
  score: number;
  total_questions: number;
  question_results: QuestionResult[];
  time_spent_seconds: number;
  completed_at: string;
  created_at: string;
}

export interface QuestionResult {
  question_id: string;
  quiz_id: string;
  user_answer: string;
  correct_answer: string;
  is_correct: boolean;
  question_text?: string;
  options?: string[];
  type?: string;
} 