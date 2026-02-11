
ALTER TABLE public.purchases RENAME COLUMN xendit_invoice_id TO doku_invoice_id;
ALTER TABLE public.purchases RENAME COLUMN xendit_invoice_url TO doku_invoice_url;

-- Rename the index too
DROP INDEX IF EXISTS idx_purchases_xendit_invoice_id;
CREATE INDEX idx_purchases_doku_invoice_id ON public.purchases(doku_invoice_id);
