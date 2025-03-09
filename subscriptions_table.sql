-- Create the subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users NOT NULL,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  stripe_price_id TEXT,
  status TEXT NOT NULL,
  plan_type TEXT NOT NULL CHECK (plan_type IN ('free', 'basic', 'premium')),
  current_period_start TIMESTAMP WITH TIME ZONE,
  current_period_end TIMESTAMP WITH TIME ZONE,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own subscriptions"
  ON subscriptions FOR SELECT
  USING (auth.uid() = user_id);

-- Create a function to set the default subscription for new users
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

-- Trigger the function every time a user is created
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Add subscription_id to profiles table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'subscription_id'
  ) THEN
    ALTER TABLE profiles ADD COLUMN subscription_id UUID REFERENCES subscriptions(id);
  END IF;
END $$; 