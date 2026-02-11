-- Fix payment_method for orders that have xendit_invoice_id set but payment_method is not 'doku'
UPDATE public.purchases 
SET payment_method = 'doku'
WHERE xendit_invoice_id IS NOT NULL 
  AND xendit_invoice_id != ''
  AND (payment_method IS NULL OR payment_method != 'doku');