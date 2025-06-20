-- Create exams table
CREATE TABLE IF NOT EXISTS public.exams (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  quiz_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Create exam_results table for performance tracking
CREATE TABLE IF NOT EXISTS public.exam_results (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  exam_id uuid NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  score integer NOT NULL DEFAULT 0,
  total_questions integer NOT NULL DEFAULT 0,
  question_results jsonb NOT NULL DEFAULT '[]'::jsonb,
  completed_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Create quiz_attempts table for individual quiz performance tracking
CREATE TABLE IF NOT EXISTS public.quiz_attempts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  quiz_id uuid NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  score integer NOT NULL DEFAULT 0,
  total_questions integer NOT NULL DEFAULT 0,
  question_results jsonb NOT NULL DEFAULT '[]'::jsonb,
  time_spent_seconds integer DEFAULT 0,
  completed_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Update learning_progress table to include more detailed tracking
ALTER TABLE public.learning_progress 
ADD COLUMN IF NOT EXISTS last_studied timestamptz,
ADD COLUMN IF NOT EXISTS completed_sessions integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS mastery_percentage integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS question_stats jsonb DEFAULT '[]'::jsonb;

-- Enable RLS on new tables
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for exams
CREATE POLICY IF NOT EXISTS "Users can view their own exams"
  ON public.exams
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can insert their own exams"
  ON public.exams
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can update their own exams"
  ON public.exams
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can delete their own exams"
  ON public.exams
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create RLS policies for exam_results
CREATE POLICY IF NOT EXISTS "Users can view their own exam results"
  ON public.exam_results
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can insert their own exam results"
  ON public.exam_results
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can update their own exam results"
  ON public.exam_results
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can delete their own exam results"
  ON public.exam_results
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create RLS policies for quiz_attempts
CREATE POLICY IF NOT EXISTS "Users can view their own quiz attempts"
  ON public.quiz_attempts
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can insert their own quiz attempts"
  ON public.quiz_attempts
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can update their own quiz attempts"
  ON public.quiz_attempts
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can delete their own quiz attempts"
  ON public.quiz_attempts
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_exams_user_id ON public.exams(user_id);
CREATE INDEX IF NOT EXISTS idx_exams_created_at ON public.exams(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_exam_results_user_id ON public.exam_results(user_id);
CREATE INDEX IF NOT EXISTS idx_exam_results_exam_id ON public.exam_results(exam_id);
CREATE INDEX IF NOT EXISTS idx_exam_results_completed_at ON public.exam_results(completed_at DESC);

CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user_id ON public.quiz_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_quiz_id ON public.quiz_attempts(quiz_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_completed_at ON public.quiz_attempts(completed_at DESC);

-- Add trigger to update the updated_at column for exams
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_exams_updated_at 
    BEFORE UPDATE ON public.exams 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE public.exams IS 'Stores user-created exams that combine multiple quizzes';
COMMENT ON TABLE public.exam_results IS 'Stores results from completed exams for performance tracking';
COMMENT ON TABLE public.quiz_attempts IS 'Stores individual quiz attempt results for detailed performance analytics';

COMMENT ON COLUMN public.exams.quiz_ids IS 'Array of quiz IDs included in this exam';
COMMENT ON COLUMN public.exam_results.question_results IS 'Detailed results for each question in the exam';
COMMENT ON COLUMN public.quiz_attempts.question_results IS 'Detailed results for each question in the quiz attempt';
COMMENT ON COLUMN public.quiz_attempts.time_spent_seconds IS 'Time spent on the quiz attempt in seconds'; 