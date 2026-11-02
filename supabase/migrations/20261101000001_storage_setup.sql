-- Migration: 20261101000001_storage_setup.sql
-- Description: Create private storage buckets and enforce folder isolation via RLS policies.

-- 1. Create Private Buckets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('project-assets', 'project-assets', false, 104857600, ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'video/mp4']),
  ('rendered-videos', 'rendered-videos', false, 524288000, ARRAY['video/mp4'])
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 2. Storage RLS for project-assets: Path must start with auth.uid()
DROP POLICY IF EXISTS "Users can view own project assets" ON storage.objects;
CREATE POLICY "Users can view own project assets"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'project-assets' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users can upload own project assets" ON storage.objects;
CREATE POLICY "Users can upload own project assets"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'project-assets' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users can update own project assets" ON storage.objects;
CREATE POLICY "Users can update own project assets"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'project-assets' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users can delete own project assets" ON storage.objects;
CREATE POLICY "Users can delete own project assets"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'project-assets' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- 3. Storage RLS for rendered-videos: Path must start with auth.uid() or service_role
DROP POLICY IF EXISTS "Users can view own rendered videos" ON storage.objects;
CREATE POLICY "Users can view own rendered videos"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'rendered-videos' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Service role or user can upload rendered videos" ON storage.objects;
CREATE POLICY "Service role or user can upload rendered videos"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'rendered-videos' AND
    (
      (storage.foldername(name))[1] = auth.uid()::text OR
      auth.role() = 'service_role'
    )
  );

DROP POLICY IF EXISTS "Users can delete own rendered videos" ON storage.objects;
CREATE POLICY "Users can delete own rendered videos"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'rendered-videos' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );
