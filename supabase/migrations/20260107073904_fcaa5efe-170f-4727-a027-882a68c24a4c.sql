-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Service role can update payment status" ON public.purchases;