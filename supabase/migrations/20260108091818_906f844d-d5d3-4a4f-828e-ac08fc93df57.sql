-- Create table for training materials
CREATE TABLE public.training_materials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  file_url TEXT NOT NULL,
  file_type TEXT NOT NULL, -- 'video', 'document', 'image'
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.training_materials ENABLE ROW LEVEL SECURITY;

-- Policies: Admin/Owner can manage, shisha_master can view
CREATE POLICY "Admins can manage training materials"
ON public.training_materials
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner'));

CREATE POLICY "Shisha masters can view training materials"
ON public.training_materials
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'shisha_master'));

-- Create trigger for updated_at
CREATE TRIGGER update_training_materials_updated_at
BEFORE UPDATE ON public.training_materials
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for training materials
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'training-materials',
  'training-materials',
  true,
  52428800, -- 50MB limit
  ARRAY['video/mp4', 'video/webm', 'video/quicktime', 'application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
);

-- Storage policies
CREATE POLICY "Anyone authenticated can view training files"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'training-materials');

CREATE POLICY "Admins can upload training files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'training-materials' AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner')));

CREATE POLICY "Admins can delete training files"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'training-materials' AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner')));