-- Create quiz_attempts table for individual quiz performance tracking (if it doesn't exist)
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

-- Update learning_progress table to include more detailed tracking (only add missing columns)
ALTER TABLE public.learning_progress 
ADD COLUMN IF NOT EXISTS last_studied timestamptz,
ADD COLUMN IF NOT EXISTS completed_sessions integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS mastery_percentage integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS question_stats jsonb DEFAULT '[]'::jsonb;

-- Enable RLS on quiz_attempts table
ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for quiz_attempts (using DO block to handle existing policies)
DO $$
BEGIN
    -- Create policies only if they don't exist
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'quiz_attempts' AND policyname = 'Users can view their own quiz attempts') THEN
        CREATE POLICY "Users can view their own quiz attempts"
          ON public.quiz_attempts
          FOR SELECT
          USING (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'quiz_attempts' AND policyname = 'Users can insert their own quiz attempts') THEN
        CREATE POLICY "Users can insert their own quiz attempts"
          ON public.quiz_attempts
          FOR INSERT
          WITH CHECK (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'quiz_attempts' AND policyname = 'Users can update their own quiz attempts') THEN
        CREATE POLICY "Users can update their own quiz attempts"
          ON public.quiz_attempts
          FOR UPDATE
          USING (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'quiz_attempts' AND policyname = 'Users can delete their own quiz attempts') THEN
        CREATE POLICY "Users can delete their own quiz attempts"
          ON public.quiz_attempts
          FOR DELETE
          USING (auth.uid() = user_id);
    END IF;
END $$;

-- Create indexes for better performance (only if they don't exist)
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user_id ON public.quiz_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_quiz_id ON public.quiz_attempts(quiz_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_completed_at ON public.quiz_attempts(completed_at DESC);

-- Add comments for documentation
COMMENT ON TABLE public.quiz_attempts IS 'Stores individual quiz attempt results for detailed performance analytics';
COMMENT ON COLUMN public.quiz_attempts.question_results IS 'Detailed results for each question in the quiz attempt';
COMMENT ON COLUMN public.quiz_attempts.time_spent_seconds IS 'Time spent on the quiz attempt in seconds'; 