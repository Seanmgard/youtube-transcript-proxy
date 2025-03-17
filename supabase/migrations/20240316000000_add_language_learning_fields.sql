-- Add language learning fields to quizzes table
ALTER TABLE public.quizzes
ADD COLUMN IF NOT EXISTS is_language_learning BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS source_language TEXT,
ADD COLUMN IF NOT EXISTS target_language TEXT,
ADD COLUMN IF NOT EXISTS extraction_type TEXT;

-- Add settings column if it doesn't exist
ALTER TABLE public.quizzes
ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}'::jsonb;

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_quizzes_is_language_learning ON public.quizzes (is_language_learning);
CREATE INDEX IF NOT EXISTS idx_quizzes_source_language ON public.quizzes (source_language);
CREATE INDEX IF NOT EXISTS idx_quizzes_target_language ON public.quizzes (target_language);

-- Add comments for documentation
COMMENT ON COLUMN public.quizzes.is_language_learning IS 'Whether this quiz is for language learning';
COMMENT ON COLUMN public.quizzes.source_language IS 'The language of the source text';
COMMENT ON COLUMN public.quizzes.target_language IS 'The language to translate to';
COMMENT ON COLUMN public.quizzes.extraction_type IS 'Type of content to extract (words or sentences)';
COMMENT ON COLUMN public.quizzes.settings IS 'JSON object containing quiz generation settings'; 