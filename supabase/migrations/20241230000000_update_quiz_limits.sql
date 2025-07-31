-- Update quiz limit for free users from 10 to 5 quizzes per month
CREATE OR REPLACE FUNCTION public.check_quiz_limit()
RETURNS TRIGGER AS $$
DECLARE
  user_plan_type TEXT;
  monthly_quiz_count INTEGER;
  quiz_limit INTEGER := 5; -- Free user limit (updated from 10 to 5)
BEGIN
  -- Get the user's subscription plan type
  SELECT plan_type INTO user_plan_type
  FROM public.subscriptions
  WHERE user_id = NEW.user_id
  LIMIT 1;
  
  -- If the user is on a premium plan, allow the quiz creation
  IF user_plan_type = 'premium' THEN
    RETURN NEW;
  END IF;
  
  -- Count ALL quizzes created by the user in the current month, including deleted ones
  SELECT COUNT(*) INTO monthly_quiz_count
  FROM public.quizzes
  WHERE 
    user_id = NEW.user_id AND
    created_at >= date_trunc('month', CURRENT_DATE) AND
    created_at < date_trunc('month', CURRENT_DATE) + INTERVAL '1 month';
  
  -- If the user has reached their limit, prevent the quiz creation
  IF monthly_quiz_count >= quiz_limit THEN
    RAISE EXCEPTION 'You have reached your monthly quiz limit. Please upgrade to Premium for unlimited quizzes.';
  END IF;
  
  -- Also check if the quiz has more than 10 questions for free users
  IF NEW.settings->>'numberOfQuestions' IS NOT NULL AND 
     (NEW.settings->>'numberOfQuestions')::integer > 10 THEN
    RAISE EXCEPTION 'Free users can only create quizzes with up to 10 questions. Please upgrade to Premium for larger quizzes.';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 