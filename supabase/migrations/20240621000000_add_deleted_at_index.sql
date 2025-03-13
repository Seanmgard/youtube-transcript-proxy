-- Add index for deleted_at column to optimize queries
CREATE INDEX IF NOT EXISTS idx_quizzes_deleted_at ON public.quizzes (deleted_at);

-- Add composite index for common query patterns
CREATE INDEX IF NOT EXISTS idx_quizzes_user_created_deleted ON public.quizzes (user_id, created_at, deleted_at);

-- Add a policy to handle soft deletes
CREATE POLICY "Users can soft delete their own quizzes"
ON public.quizzes
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Add RLS policy to ensure users can only see their own non-deleted quizzes by default
CREATE POLICY "Users can view their own non-deleted quizzes"
ON public.quizzes
FOR SELECT
USING (
  auth.uid() = user_id 
  AND deleted_at IS NULL
); 