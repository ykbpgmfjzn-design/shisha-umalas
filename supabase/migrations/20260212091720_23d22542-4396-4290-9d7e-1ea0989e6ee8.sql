-- Allow admins to upload avatars for any user
CREATE POLICY "Admins can upload avatars"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'avatars'
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role))
);

-- Allow admins to update avatars for any user
CREATE POLICY "Admins can update avatars"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'avatars'
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role))
);

-- Allow admins to delete avatars for any user
CREATE POLICY "Admins can delete avatars"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'avatars'
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role))
);