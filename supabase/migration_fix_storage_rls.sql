-- ============================================================================
-- LABURANTE: Fix RLS Storage y Bucket profile-documents
--
-- Problema confirmado en producción:
-- 1. Upload de fotos a profile-photos falla con "new row violates row-level
--    security policy" incluso para usuarios autenticados.
--    Causa: Las políticas INSERT/UPDATE de storage.objects para profile-photos
--    pueden estar en estado inconsistente o faltantes en producción.
--    Este script las recrea de forma idempotente.
--
-- 2. El bucket profile-documents no existe en producción (fetch del endpoint
--    público retorna NoSuchBucket). Los uploads de CV fallan silenciosamente.
--
-- SEGURO: No elimina ni modifica policies existentes para otras tablas.
-- Solo toca storage.objects policies para profile-photos y profile-documents.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Garantizar que el bucket profile-photos existe y es public
-- ----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'profile-photos',
  'profile-photos',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ----------------------------------------------------------------------------
-- 2. Crear bucket profile-documents si no existe (private)
-- ----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'profile-documents',
  'profile-documents',
  false,
  10485760,
  ARRAY[
    'application/pdf',
    'text/plain',
    'text/csv',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ----------------------------------------------------------------------------
-- 3. Recrear políticas de storage.objects para profile-photos (idempotente)
--    DROP IF EXISTS + CREATE garantiza estado limpio sin importar qué había.
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS "Users upload own profile photos" ON storage.objects;
CREATE POLICY "Users upload own profile photos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'profile-photos'
    AND name ~ '^[0-9a-fA-F-]{36}/photo-[^/]+$'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

DROP POLICY IF EXISTS "Public read profile photos" ON storage.objects;
CREATE POLICY "Public read profile photos"
  ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'profile-photos');

DROP POLICY IF EXISTS "Users update own profile photos" ON storage.objects;
CREATE POLICY "Users update own profile photos"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'profile-photos'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  )
  WITH CHECK (
    bucket_id = 'profile-photos'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

DROP POLICY IF EXISTS "Users delete own profile photos" ON storage.objects;
CREATE POLICY "Users delete own profile photos"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'profile-photos'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

-- ----------------------------------------------------------------------------
-- 4. Recrear políticas de storage.objects para profile-documents (idempotente)
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS "Users upload own profile documents" ON storage.objects;
CREATE POLICY "Users upload own profile documents"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'profile-documents'
    AND name ~ '^[0-9a-fA-F-]{36}/resume-[^/]+$'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

DROP POLICY IF EXISTS "Users read authorized profile documents" ON storage.objects;
CREATE POLICY "Users read authorized profile documents"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'profile-documents'
    AND name ~ '^[0-9a-fA-F-]{36}/resume-[^/]+$'
    AND public.can_read_profile_resume_object('profile-documents', storage.objects.name)
  );

DROP POLICY IF EXISTS "Users update own profile documents" ON storage.objects;
CREATE POLICY "Users update own profile documents"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'profile-documents'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  )
  WITH CHECK (
    bucket_id = 'profile-documents'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

DROP POLICY IF EXISTS "Users delete own profile documents" ON storage.objects;
CREATE POLICY "Users delete own profile documents"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'profile-documents'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );
