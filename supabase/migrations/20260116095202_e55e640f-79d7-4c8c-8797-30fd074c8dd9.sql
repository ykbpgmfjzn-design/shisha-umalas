-- Add name column to feedback table for public reviews
ALTER TABLE public.feedback ADD COLUMN name TEXT;

-- Create policy to allow anyone to read 5-star feedback with text (for public reviews section)
CREATE POLICY "Anyone can view 5-star public reviews" 
ON public.feedback 
FOR SELECT 
USING (rating = 5 AND message IS NOT NULL AND name IS NOT NULL);