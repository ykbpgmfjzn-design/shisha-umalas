
-- Create storage bucket for customer photos
INSERT INTO storage.buckets (id, name, public) VALUES ('customer-photos', 'customer-photos', true);

-- Allow authenticated users to upload
CREATE POLICY "Authenticated users can upload customer photos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'customer-photos' AND auth.uid() IS NOT NULL);

-- Allow public read
CREATE POLICY "Customer photos are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'customer-photos');

-- Allow authenticated users to delete their uploads
CREATE POLICY "Authenticated users can delete customer photos"
ON storage.objects FOR DELETE
USING (bucket_id = 'customer-photos' AND auth.uid() IS NOT NULL);
