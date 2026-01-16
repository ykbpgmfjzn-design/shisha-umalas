-- Add photo_url column to feedback table
ALTER TABLE public.feedback ADD COLUMN photo_url TEXT;

-- Create storage bucket for feedback photos
INSERT INTO storage.buckets (id, name, public) 
VALUES ('feedback-photos', 'feedback-photos', true);

-- Allow anyone to view feedback photos (public bucket)
CREATE POLICY "Anyone can view feedback photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'feedback-photos');

-- Allow authenticated users to upload their own feedback photos
CREATE POLICY "Users can upload feedback photos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'feedback-photos' 
  AND auth.uid() IS NOT NULL
);

-- Allow users to delete their own feedback photos
CREATE POLICY "Users can delete own feedback photos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'feedback-photos' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);