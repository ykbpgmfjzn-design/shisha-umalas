-- Add is_approved column for moderation
ALTER TABLE public.feedback ADD COLUMN is_approved BOOLEAN DEFAULT false;

-- Drop old policy that allowed viewing 5-star reviews
DROP POLICY IF EXISTS "Anyone can view 5-star public reviews" ON public.feedback;

-- Create new policy that only shows approved reviews
CREATE POLICY "Anyone can view approved reviews" 
ON public.feedback 
FOR SELECT 
USING (rating = 5 AND message IS NOT NULL AND name IS NOT NULL AND is_approved = true);