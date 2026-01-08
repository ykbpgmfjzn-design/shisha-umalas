-- Create feedback table
CREATE TABLE public.feedback (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

-- Users can insert their own feedback
CREATE POLICY "Users can insert own feedback" 
ON public.feedback 
FOR INSERT 
WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Users can view own feedback
CREATE POLICY "Users can view own feedback" 
ON public.feedback 
FOR SELECT 
USING (auth.uid() = user_id);

-- Admins can view all feedback
CREATE POLICY "Admins can view all feedback" 
ON public.feedback 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Owners can view all feedback
CREATE POLICY "Owners can view all feedback" 
ON public.feedback 
FOR SELECT 
USING (has_role(auth.uid(), 'owner'::app_role));

-- Admins can delete feedback
CREATE POLICY "Admins can delete feedback" 
ON public.feedback 
FOR DELETE 
USING (has_role(auth.uid(), 'admin'::app_role));