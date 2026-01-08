-- Restore admin role for sadstal@gmail.com
INSERT INTO public.user_roles (user_id, role)
SELECT p.id, 'admin'::app_role
FROM public.profiles p
WHERE p.email = 'sadstal@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;