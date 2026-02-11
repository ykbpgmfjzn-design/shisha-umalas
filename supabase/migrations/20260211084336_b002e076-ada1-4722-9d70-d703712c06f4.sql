-- Add created_by column to track which staff member created the order
ALTER TABLE public.purchases ADD COLUMN created_by uuid REFERENCES auth.users(id);

-- Create index for leaderboard queries
CREATE INDEX idx_purchases_created_by ON public.purchases(created_by);
