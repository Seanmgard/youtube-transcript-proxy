-- Create subjects table
CREATE TABLE subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Add RLS policies
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;

-- Policy to allow users to select their own subjects
CREATE POLICY "Users can view their own subjects" ON subjects
  FOR SELECT USING (auth.uid() = user_id);

-- Policy to allow users to insert their own subjects
CREATE POLICY "Users can insert their own subjects" ON subjects
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policy to allow users to update their own subjects
CREATE POLICY "Users can update their own subjects" ON subjects
  FOR UPDATE USING (auth.uid() = user_id);

-- Policy to allow users to delete their own subjects
CREATE POLICY "Users can delete their own subjects" ON subjects
  FOR DELETE USING (auth.uid() = user_id);

-- Create index on user_id for faster queries
CREATE INDEX idx_subjects_user_id ON subjects (user_id);

-- Add comment to table
COMMENT ON TABLE subjects IS 'Stores subject categories for quizzes'; 