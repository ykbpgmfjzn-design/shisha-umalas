-- Fix telegram_subscribers: replace overly permissive policy with admin/owner-only access
DROP POLICY IF EXISTS "Service role can manage subscribers" ON public.telegram_subscribers;

-- Only admins and owners can read telegram subscribers
CREATE POLICY "Admins can manage telegram subscribers"
ON public.telegram_subscribers
FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'owner'::app_role)
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'owner'::app_role)
);