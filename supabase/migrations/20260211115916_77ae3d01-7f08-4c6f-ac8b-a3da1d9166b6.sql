
ALTER TABLE public.purchases ADD COLUMN shisha_master_id uuid REFERENCES auth.users(id) DEFAULT NULL;
COMMENT ON COLUMN public.purchases.shisha_master_id IS 'ID of the shisha master who prepared this order';

CREATE INDEX idx_purchases_shisha_master ON public.purchases(shisha_master_id);
