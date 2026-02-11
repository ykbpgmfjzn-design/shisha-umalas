
-- Restrict insert: users can only insert their own activity logs
DROP POLICY "Authenticated users can insert logs" ON public.activity_logs;

CREATE POLICY "Users can insert own activity logs"
ON public.activity_logs
FOR INSERT
WITH CHECK (auth.uid() = user_id);
