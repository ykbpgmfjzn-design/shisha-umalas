-- Add status column to track reservation status
-- We'll create a proper reservations table to store reservation status

CREATE TABLE public.reservations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  activity_log_id UUID REFERENCES public.activity_logs(id),
  reservation_date DATE NOT NULL,
  reservation_time TEXT NOT NULL,
  party_size INTEGER NOT NULL DEFAULT 2,
  hookah_count INTEGER NOT NULL DEFAULT 1,
  phone TEXT NOT NULL,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, confirmed, cancelled
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Admins can manage reservations"
ON public.reservations
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner'));

CREATE POLICY "Accounting can view reservations"
ON public.reservations
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'accounting'));

CREATE POLICY "Users can view own reservations"
ON public.reservations
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own reservations"
ON public.reservations
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_reservations_updated_at
BEFORE UPDATE ON public.reservations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();