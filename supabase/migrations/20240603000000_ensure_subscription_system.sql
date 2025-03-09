-- Ensure the subscriptions table exists
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  stripe_price_id TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  plan_type TEXT NOT NULL DEFAULT 'free',
  current_period_start TIMESTAMP WITH TIME ZONE,
  current_period_end TIMESTAMP WITH TIME ZONE,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Create policies for the subscriptions table
-- SELECT policy
CREATE POLICY IF NOT EXISTS "Users can view their own subscriptions"
  ON subscriptions FOR SELECT
  USING (auth.uid() = user_id);

-- INSERT policy
CREATE POLICY IF NOT EXISTS "Users can insert their own subscriptions"
  ON subscriptions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- UPDATE policy
CREATE POLICY IF NOT EXISTS "Users can update their own subscriptions"
  ON subscriptions FOR UPDATE
  USING (auth.uid() = user_id);

-- Ensure the profiles table has the subscription_id column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'profiles'
    AND column_name = 'subscription_id'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Ensure the profiles table has the is_admin column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'profiles'
    AND column_name = 'is_admin'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN is_admin BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

-- Create or replace the function to handle new users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  new_subscription_id UUID;
BEGIN
  -- Insert a new row into the profiles table
  INSERT INTO public.profiles (id, email, first_name, last_name, updated_at)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'first_name', NEW.raw_user_meta_data->>'last_name', now());
  
  -- Insert a free subscription for the new user
  INSERT INTO public.subscriptions (user_id, status, plan_type)
  VALUES (NEW.id, 'active', 'free')
  RETURNING id INTO new_subscription_id;
  
  -- Update the profile with the subscription ID
  UPDATE public.profiles
  SET subscription_id = new_subscription_id
  WHERE id = NEW.id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure the trigger is properly set up
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create a function to ensure all users have a subscription
CREATE OR REPLACE FUNCTION public.ensure_all_users_have_subscription()
RETURNS TABLE (user_id UUID, subscription_id UUID, created BOOLEAN) AS $$
DECLARE
  user_record RECORD;
  new_subscription_id UUID;
BEGIN
  FOR user_record IN 
    SELECT p.id 
    FROM public.profiles p
    LEFT JOIN public.subscriptions s ON p.id = s.user_id
    WHERE s.id IS NULL
  LOOP
    -- Create a new subscription for the user
    INSERT INTO public.subscriptions (user_id, status, plan_type)
    VALUES (user_record.id, 'active', 'free')
    RETURNING id INTO new_subscription_id;
    
    -- Return the result
    user_id := user_record.id;
    subscription_id := new_subscription_id;
    created := TRUE;
    RETURN NEXT;
  END LOOP;
  
  RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 