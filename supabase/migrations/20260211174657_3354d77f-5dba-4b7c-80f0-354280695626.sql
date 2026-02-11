
-- Drop the overly permissive policy
DROP POLICY "Anyone can read settings" ON public.app_settings;

-- Non-sensitive settings readable by authenticated users
CREATE POLICY "Authenticated users can read non-sensitive settings"
ON public.app_settings
FOR SELECT
USING (
  key IN ('delivery_time_minutes')
  AND auth.uid() IS NOT NULL
);

-- Financial/sensitive settings only for admin and owner
CREATE POLICY "Admins and owners can read all settings"
ON public.app_settings
FOR SELECT
USING (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner')
);
