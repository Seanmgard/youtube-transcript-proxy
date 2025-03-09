-- Add avatar_url column to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Update RLS policies to allow users to update their own avatar_url
CREATE POLICY update_own_avatar ON profiles
    FOR UPDATE TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id); 