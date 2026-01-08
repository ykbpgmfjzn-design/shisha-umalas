-- Разрешить shisha_master просматривать все заказы
CREATE POLICY "Shisha masters can view all purchases"
ON public.purchases
FOR SELECT
USING (has_role(auth.uid(), 'shisha_master'::app_role));

-- Разрешить shisha_master обновлять статус заказов
CREATE POLICY "Shisha masters can update purchases"
ON public.purchases
FOR UPDATE
USING (has_role(auth.uid(), 'shisha_master'::app_role));

-- Разрешить shisha_master видеть профили пользователей для заказов
CREATE POLICY "Shisha masters can view profiles"
ON public.profiles
FOR SELECT
USING (has_role(auth.uid(), 'shisha_master'::app_role));