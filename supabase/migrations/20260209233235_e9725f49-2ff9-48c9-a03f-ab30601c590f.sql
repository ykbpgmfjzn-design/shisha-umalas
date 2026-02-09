
-- Add customer_name for walk-in customers
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS customer_name TEXT;

-- Make user_id nullable for walk-in orders
ALTER TABLE public.purchases ALTER COLUMN user_id DROP NOT NULL;

-- Allow shisha masters to insert purchases (manual orders)
CREATE POLICY "Shisha masters can insert purchases"
ON public.purchases
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'shisha_master'::app_role));

-- Allow owners to insert purchases
CREATE POLICY "Owners can insert purchases"
ON public.purchases
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'owner'::app_role));

-- Allow owners full access to purchases
CREATE POLICY "Owners can view all purchases"
ON public.purchases
FOR SELECT
USING (has_role(auth.uid(), 'owner'::app_role));

CREATE POLICY "Owners can update all purchases"
ON public.purchases
FOR UPDATE
USING (has_role(auth.uid(), 'owner'::app_role));
