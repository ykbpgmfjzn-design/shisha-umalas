
-- Enable pg_net for HTTP calls from triggers
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Function to send review email when order is delivered
CREATE OR REPLACE FUNCTION public.send_review_email_on_delivery()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _email TEXT;
  _name TEXT;
  _anon_key TEXT;
BEGIN
  -- Only fire when delivery_status changes to 'delivered'
  IF NEW.delivery_status = 'delivered' AND (OLD.delivery_status IS DISTINCT FROM 'delivered') AND NEW.user_id IS NOT NULL THEN
    -- Get customer email
    SELECT email, full_name INTO _email, _name
    FROM public.profiles
    WHERE id = NEW.user_id;

    IF _email IS NOT NULL THEN
      -- Call send-review-email edge function via pg_net
      PERFORM net.http_post(
        url := 'https://hkgscohedqgxrhmbryww.supabase.co/functions/v1/send-review-email',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhrZ3Njb2hlZHFneHJobWJyeXd3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc3Mjk0NDIsImV4cCI6MjA4MzMwNTQ0Mn0.7P8Lc1wF8RfMGcifIveRBoZ8rH93n1l8LuMjQ0x8SzI'
        ),
        body := jsonb_build_object('email', _email, 'customerName', COALESCE(_name, 'Valued Guest'))
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger on purchases table
CREATE TRIGGER on_delivery_send_review_email
AFTER UPDATE OF delivery_status ON public.purchases
FOR EACH ROW
EXECUTE FUNCTION public.send_review_email_on_delivery();
