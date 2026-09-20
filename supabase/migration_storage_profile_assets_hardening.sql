-- Storage hardening for profile-assets bucket:
-- 1. Enforces 10 MB maximum file size limit (10485760 bytes).
-- 2. Restricts allowed MIME types to profile photos and resumes/presentations
--    currently accepted by the platform frontend.
-- 3. Idempotent and safe: preserves existing public visibility and policies.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'profile-assets',
  'profile-assets',
  true,
  10485760,
  ARRAY[
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf',
    'text/plain',
    'text/csv',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;
