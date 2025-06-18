-- Create promoters table
CREATE TABLE IF NOT EXISTS public.promoters (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  first_name TEXT,
  last_name TEXT,
  company TEXT,
  promotion_code TEXT UNIQUE NOT NULL,
  commission_rate DECIMAL(5,4) DEFAULT 0.2500, -- 25% default
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
  payment_email TEXT, -- For commission payouts
  total_referrals INTEGER DEFAULT 0,
  total_commission_earned DECIMAL(10,2) DEFAULT 0.00,
  total_commission_paid DECIMAL(10,2) DEFAULT 0.00,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create referrals table to track code usage
CREATE TABLE IF NOT EXISTS public.referrals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  promoter_id UUID NOT NULL REFERENCES public.promoters(id) ON DELETE CASCADE,
  referred_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  promo_code TEXT NOT NULL,
  subscription_amount DECIMAL(10,2), -- The subscription amount
  commission_rate DECIMAL(5,4), -- Rate at time of referral
  commission_amount DECIMAL(10,2), -- Calculated commission
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'cancelled', 'refunded')),
  stripe_subscription_id TEXT, -- For tracking Stripe subscriptions
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create commission_payments table for tracking payouts
CREATE TABLE IF NOT EXISTS public.commission_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  promoter_id UUID NOT NULL REFERENCES public.promoters(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  period_start TIMESTAMP WITH TIME ZONE NOT NULL,
  period_end TIMESTAMP WITH TIME ZONE NOT NULL,
  payment_method TEXT, -- 'stripe', 'paypal', 'bank_transfer', etc.
  payment_reference TEXT, -- External payment ID
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'paid', 'failed')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.promoters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_payments ENABLE ROW LEVEL SECURITY;

-- Create policies for promoters table
CREATE POLICY "Promoters can view their own data"
  ON promoters FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all promoters"
  ON promoters FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND is_admin = true
    )
  );

CREATE POLICY "Admins can insert promoters"
  ON promoters FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND is_admin = true
    )
  );

CREATE POLICY "Admins can update promoters"
  ON promoters FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- Create policies for referrals table
CREATE POLICY "Promoters can view their referrals"
  ON referrals FOR SELECT
  USING (
    promoter_id IN (
      SELECT id FROM public.promoters WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all referrals"
  ON referrals FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND is_admin = true
    )
  );

CREATE POLICY "System can insert referrals"
  ON referrals FOR INSERT
  WITH CHECK (true); -- Will be controlled by API logic

CREATE POLICY "System can update referrals"
  ON referrals FOR UPDATE
  USING (true); -- Will be controlled by API logic

-- Create policies for commission_payments table
CREATE POLICY "Promoters can view their payments"
  ON commission_payments FOR SELECT
  USING (
    promoter_id IN (
      SELECT id FROM public.promoters WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage all payments"
  ON commission_payments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_promoters_code ON public.promoters(promotion_code);
CREATE INDEX IF NOT EXISTS idx_promoters_status ON public.promoters(status);
CREATE INDEX IF NOT EXISTS idx_referrals_promoter_id ON public.referrals(promoter_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referred_user_id ON public.referrals(referred_user_id);
CREATE INDEX IF NOT EXISTS idx_referrals_promo_code ON public.referrals(promo_code);
CREATE INDEX IF NOT EXISTS idx_referrals_stripe_subscription_id ON public.referrals(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_commission_payments_promoter_id ON public.commission_payments(promoter_id);

-- Create function to generate unique promotion codes
CREATE OR REPLACE FUNCTION generate_promo_code(base_name TEXT DEFAULT NULL)
RETURNS TEXT AS $$
DECLARE
  code TEXT;
  exists_check BOOLEAN;
BEGIN
  LOOP
    -- Generate code based on base_name or random
    IF base_name IS NOT NULL THEN
      code := UPPER(base_name) || '-' || UPPER(substr(md5(random()::text), 1, 6));
    ELSE
      code := 'PROMO-' || UPPER(substr(md5(random()::text), 1, 8));
    END IF;
    
    -- Check if code already exists
    SELECT EXISTS(SELECT 1 FROM public.promoters WHERE promotion_code = code) INTO exists_check;
    
    -- If code doesn't exist, return it
    IF NOT exists_check THEN
      RETURN code;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Create function to update promoter stats
CREATE OR REPLACE FUNCTION update_promoter_stats(promoter_uuid UUID)
RETURNS void AS $$
BEGIN
  UPDATE public.promoters 
  SET 
    total_referrals = (
      SELECT COUNT(*) FROM public.referrals 
      WHERE promoter_id = promoter_uuid AND status = 'active'
    ),
    total_commission_earned = (
      SELECT COALESCE(SUM(commission_amount), 0) FROM public.referrals 
      WHERE promoter_id = promoter_uuid AND status = 'active'
    ),
    updated_at = now()
  WHERE id = promoter_uuid;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update promoter stats when referrals change
CREATE OR REPLACE FUNCTION trigger_update_promoter_stats()
RETURNS TRIGGER AS $$
BEGIN
  -- Update stats for the affected promoter
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    PERFORM update_promoter_stats(NEW.promoter_id);
  END IF;
  
  IF TG_OP = 'DELETE' THEN
    PERFORM update_promoter_stats(OLD.promoter_id);
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_referrals_update_stats ON public.referrals;
CREATE TRIGGER trigger_referrals_update_stats
  AFTER INSERT OR UPDATE OR DELETE ON public.referrals
  FOR EACH ROW EXECUTE FUNCTION trigger_update_promoter_stats(); 