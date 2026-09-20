-- ============================================================================
-- MIGRATION: Moderación y Control de Reseñas para Administradores
-- ============================================================================

-- 1. Purgar reseñas anónimas de prueba existentes en el perfil de Ciro
DELETE FROM public.recommendations
 WHERE to_profile_id = 'f6ae1bf3-577d-4848-aff7-8af78131032b'
   AND from_user_id IS NULL;

-- 2. Permitir a administradores leer todas las reseñas sin importar su estado
DROP POLICY IF EXISTS "Admins can read all recommendations" ON public.recommendations;
CREATE POLICY "Admins can read all recommendations"
  ON public.recommendations FOR SELECT
  USING (
    COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
  );

-- 3. Permitir a administradores actualizar/moderar cualquier reseña
DROP POLICY IF EXISTS "Admins can update all recommendations" ON public.recommendations;
CREATE POLICY "Admins can update all recommendations"
  ON public.recommendations FOR UPDATE
  USING (
    COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
  )
  WITH CHECK (
    COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
  );

-- 4. Permitir eliminar reseñas a:
--    - El autor original (from_user_id)
--    - El titular del perfil receptor (to_profile_id) para proteger su perfil
--    - El administrador (role = 'admin')
DROP POLICY IF EXISTS "Authors can delete recommendations" ON public.recommendations;
DROP POLICY IF EXISTS "Authors, owners and admins can delete recommendations" ON public.recommendations;
CREATE POLICY "Authors, owners and admins can delete recommendations"
  ON public.recommendations FOR DELETE
  USING (
    auth.uid() = from_user_id
    OR auth.uid() = to_profile_id
    OR COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
  );

-- 5. RPC Administrativa para moderar reseña (visible, oculto, etc.)
CREATE OR REPLACE FUNCTION public.admin_moderate_recommendation(
  target_id UUID,
  target_status TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') <> 'admin' THEN
    RAISE EXCEPTION 'Solo un administrador puede moderar reseñas';
  END IF;

  IF target_status NOT IN ('visible', 'oculto', 'pendiente', 'reportado') THEN
    RAISE EXCEPTION 'Estado no válido';
  END IF;

  UPDATE public.recommendations
     SET status = target_status
   WHERE id = target_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_moderate_recommendation(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_moderate_recommendation(UUID, TEXT) TO authenticated;

-- 6. RPC Administrativa para eliminar reseña
CREATE OR REPLACE FUNCTION public.admin_delete_recommendation(
  target_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') <> 'admin' THEN
    RAISE EXCEPTION 'Solo un administrador puede eliminar reseñas';
  END IF;

  DELETE FROM public.recommendations
   WHERE id = target_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_delete_recommendation(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_delete_recommendation(UUID) TO authenticated;

-- 7. RPC para purgar reseñas anónimas
CREATE OR REPLACE FUNCTION public.admin_cleanup_anonymous_reviews(
  target_profile_id UUID DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  deleted_count INTEGER := 0;
BEGIN
  IF COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') <> 'admin' THEN
    RAISE EXCEPTION 'Solo un administrador puede realizar esta limpieza';
  END IF;

  IF target_profile_id IS NOT NULL THEN
    DELETE FROM public.recommendations
     WHERE to_profile_id = target_profile_id
       AND from_user_id IS NULL;
  ELSE
    DELETE FROM public.recommendations
     WHERE from_user_id IS NULL;
  END IF;

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_cleanup_anonymous_reviews(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_cleanup_anonymous_reviews(UUID) TO authenticated;
