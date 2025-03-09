-- Create feature_suggestions table
CREATE TABLE IF NOT EXISTS public.feature_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add RLS policies
ALTER TABLE public.feature_suggestions ENABLE ROW LEVEL SECURITY;

-- Allow users to view their own suggestions
CREATE POLICY "Users can view their own suggestions"
  ON public.feature_suggestions
  FOR SELECT
  USING (auth.uid() = user_id);

-- Allow users to insert their own suggestions
CREATE POLICY "Users can insert their own suggestions"
  ON public.feature_suggestions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Allow admins to view all suggestions
CREATE POLICY "Admins can view all suggestions"
  ON public.feature_suggestions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- Allow admins to update all suggestions
CREATE POLICY "Admins can update all suggestions"
  ON public.feature_suggestions
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update updated_at timestamp
CREATE TRIGGER set_updated_at
BEFORE UPDATE ON public.feature_suggestions
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at(); 