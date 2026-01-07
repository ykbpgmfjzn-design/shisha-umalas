-- Add payment status and xendit invoice tracking to purchases table
ALTER TABLE public.purchases 
ADD COLUMN payment_status text DEFAULT 'pending',
ADD COLUMN xendit_invoice_id text,
ADD COLUMN xendit_invoice_url text,
ADD COLUMN paid_at timestamp with time zone;

-- Create index for faster webhook lookups
CREATE INDEX idx_purchases_xendit_invoice_id ON public.purchases(xendit_invoice_id);

-- Allow service role to update payment status (for webhooks)
CREATE POLICY "Service role can update payment status"
ON public.purchases
FOR UPDATE
USING (true)
WITH CHECK (true);