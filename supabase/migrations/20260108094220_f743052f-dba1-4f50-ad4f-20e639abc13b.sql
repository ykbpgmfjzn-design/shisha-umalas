-- Add location column to reservations table
ALTER TABLE public.reservations 
ADD COLUMN location TEXT;