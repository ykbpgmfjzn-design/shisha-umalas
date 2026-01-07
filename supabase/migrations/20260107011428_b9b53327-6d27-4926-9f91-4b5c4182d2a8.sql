-- Add RLS policies for admin access to profiles
CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update all profiles" ON public.profiles
  FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

-- Add RLS policies for admin access to purchases
CREATE POLICY "Admins can view all purchases" ON public.purchases
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert purchases for any user" ON public.purchases
  FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update all purchases" ON public.purchases
  FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete purchases" ON public.purchases
  FOR DELETE USING (public.has_role(auth.uid(), 'admin'));
