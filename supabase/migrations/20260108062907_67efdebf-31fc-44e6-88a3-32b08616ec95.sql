-- Назначить роль owner пользователю sadstal@gmail.com
INSERT INTO public.user_roles (user_id, role)
VALUES ('366653e9-859c-4dec-8e58-98002c9d971f', 'owner')
ON CONFLICT (user_id, role) DO NOTHING;