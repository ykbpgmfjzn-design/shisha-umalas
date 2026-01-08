-- Allow accounting role to view all purchases
CREATE POLICY "Accounting can view all purchases" 
ON public.purchases 
FOR SELECT 
USING (has_role(auth.uid(), 'accounting'::app_role));

-- Allow accounting role to view all profiles (needed to see user info)
CREATE POLICY "Accounting can view all profiles" 
ON public.profiles 
FOR SELECT 
USING (has_role(auth.uid(), 'accounting'::app_role));