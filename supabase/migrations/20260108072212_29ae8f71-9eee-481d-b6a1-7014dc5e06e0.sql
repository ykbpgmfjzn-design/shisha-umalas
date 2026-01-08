-- Создаем enum для типов активности
CREATE TYPE public.activity_type AS ENUM (
  'auth',           -- авторизация, выход
  'order',          -- создание, изменение заказов
  'payment',        -- оплата
  'profile',        -- изменение профиля
  'admin',          -- действия админа
  'feedback',       -- отзывы
  'reservation'     -- бронирования
);

-- Создаем таблицу логов активности
CREATE TABLE public.activity_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  activity_type activity_type NOT NULL,
  action TEXT NOT NULL,
  details JSONB DEFAULT '{}',
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Создаем индексы для быстрого поиска
CREATE INDEX idx_activity_logs_user_id ON public.activity_logs(user_id);
CREATE INDEX idx_activity_logs_type ON public.activity_logs(activity_type);
CREATE INDEX idx_activity_logs_created_at ON public.activity_logs(created_at DESC);

-- Включаем RLS
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Только владелец может просматривать все логи
CREATE POLICY "Owners can view all activity logs"
ON public.activity_logs
FOR SELECT
USING (has_role(auth.uid(), 'owner'::app_role));

-- Админы тоже могут видеть логи
CREATE POLICY "Admins can view all activity logs"
ON public.activity_logs
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Любой аутентифицированный пользователь может создавать логи (для записи своих действий)
CREATE POLICY "Authenticated users can insert logs"
ON public.activity_logs
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Функция для записи лога активности
CREATE OR REPLACE FUNCTION public.log_activity(
  _activity_type activity_type,
  _action TEXT,
  _details JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  log_id UUID;
BEGIN
  INSERT INTO public.activity_logs (user_id, activity_type, action, details)
  VALUES (auth.uid(), _activity_type, _action, _details)
  RETURNING id INTO log_id;
  
  RETURN log_id;
END;
$$;