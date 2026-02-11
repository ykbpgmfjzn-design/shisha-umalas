ALTER TABLE public.purchases ADD COLUMN payment_method text DEFAULT 'cash';
COMMENT ON COLUMN public.purchases.payment_method IS 'Payment method: cash, edc_machine, bank_transfer';