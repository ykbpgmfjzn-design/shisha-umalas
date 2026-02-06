-- Add delivery_status column to purchases table
ALTER TABLE public.purchases 
ADD COLUMN delivery_status text NOT NULL DEFAULT 'pending';

-- Add comment for clarity
COMMENT ON COLUMN public.purchases.delivery_status IS 'Delivery status: pending, preparing, delivered, cancelled';
COMMENT ON COLUMN public.purchases.payment_status IS 'Payment status: pending (unpaid), paid';

-- Update existing records: if payment_status is 'delivered', set delivery_status to 'delivered' and payment_status to 'paid'
UPDATE public.purchases 
SET delivery_status = 'delivered', payment_status = 'paid'
WHERE payment_status = 'delivered';

-- Update existing records: if payment_status is 'preparing', set delivery_status to 'preparing'
UPDATE public.purchases 
SET delivery_status = 'preparing'
WHERE payment_status = 'preparing';

-- Update existing records: if payment_status is 'cancelled', set delivery_status to 'cancelled'
UPDATE public.purchases 
SET delivery_status = 'cancelled'
WHERE payment_status = 'cancelled';