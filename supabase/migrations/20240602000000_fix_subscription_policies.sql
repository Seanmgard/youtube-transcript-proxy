-- Add missing RLS policies for subscriptions table

-- Create an INSERT policy for the subscriptions table
CREATE POLICY IF NOT EXISTS "Users can insert their own subscriptions"
  ON subscriptions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create an UPDATE policy for the subscriptions table
CREATE POLICY IF NOT EXISTS "Users can update their own subscriptions"
  ON subscriptions FOR UPDATE
  USING (auth.uid() = user_id);

-- Ensure the trigger for new users is properly set up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert a new row into the profiles table
  INSERT INTO public.profiles (id, email, first_name, last_name, updated_at)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'first_name', NEW.raw_user_meta_data->>'last_name', now());
  
  -- Insert a free subscription for the new user
  INSERT INTO public.subscriptions (user_id, status, plan_type)
  VALUES (NEW.id, 'active', 'free');
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure the trigger is properly set up
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user(); 