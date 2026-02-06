-- Create table for Telegram subscribers
CREATE TABLE public.telegram_subscribers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  chat_id BIGINT NOT NULL UNIQUE,
  username TEXT,
  first_name TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.telegram_subscribers ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (for edge functions)
CREATE POLICY "Service role can manage subscribers" 
ON public.telegram_subscribers 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Create index for faster lookups
CREATE INDEX idx_telegram_subscribers_active ON public.telegram_subscribers(is_active) WHERE is_active = true;

-- Add trigger for updated_at
CREATE TRIGGER update_telegram_subscribers_updated_at
BEFORE UPDATE ON public.telegram_subscribers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();