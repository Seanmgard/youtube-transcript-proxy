-- Create the learning_progress table
CREATE TABLE IF NOT EXISTS public.learning_progress (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  quiz_id uuid NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  progress jsonb DEFAULT '{}'::jsonb,
  score integer DEFAULT 0,
  completed boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, quiz_id)
);

-- Enable RLS
ALTER TABLE public.learning_progress ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own learning progress"
  ON public.learning_progress
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own learning progress"
  ON public.learning_progress
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own learning progress"
  ON public.learning_progress
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own learning progress"
  ON public.learning_progress
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create an index on user_id and quiz_id for better query performance
CREATE INDEX IF NOT EXISTS learning_progress_user_id_idx ON public.learning_progress(user_id);
CREATE INDEX IF NOT EXISTS learning_progress_quiz_id_idx ON public.learning_progress(quiz_id); 