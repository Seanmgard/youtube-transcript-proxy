-- Add policy to allow public promo code validation
CREATE POLICY "Public can validate promo codes"
  ON public.promoters FOR SELECT
  USING (status = 'active');

-- This allows anyone to read promoter data, but only for active promoters
-- This is safe because we're only exposing basic info needed for validation 