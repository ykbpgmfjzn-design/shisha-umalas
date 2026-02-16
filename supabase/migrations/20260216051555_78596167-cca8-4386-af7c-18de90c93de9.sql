-- Allow anonymous users to insert feedback
DROP POLICY IF EXISTS "Anyone can submit feedback" ON public.feedback;
CREATE POLICY "Anyone can submit feedback"
  ON public.feedback
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Also ensure anon can read approved feedback for the public reviews section
DROP POLICY IF EXISTS "Anyone can read approved feedback" ON public.feedback;
CREATE POLICY "Anyone can read approved feedback"
  ON public.feedback
  FOR SELECT
  TO anon, authenticated
  USING (is_approved = true);