-- ============================================================================
-- MIGRATION: Solución Definitiva para Eliminación de Reseñas y Notificaciones
-- ============================================================================

-- 1. Purgar de inmediato todas las reseñas anónimas de prueba
DELETE FROM public.recommendations
 WHERE from_user_id IS NULL;

-- 2. Asegurar permisos de tabla en public.recommendations
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recommendations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recommendations TO service_role;

-- 3. Políticas RLS en public.recommendations
ALTER TABLE public.recommendations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read visible recommendations" ON public.recommendations;
CREATE POLICY "Public read visible recommendations"
  ON public.recommendations FOR SELECT
  USING (status = 'visible');

DROP POLICY IF EXISTS "Owners and authors can read recommendations" ON public.recommendations;
CREATE POLICY "Owners and authors can read recommendations"
  ON public.recommendations FOR SELECT
  USING (
    auth.uid() = to_profile_id 
    OR auth.uid() = from_user_id
    OR COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
  );

DROP POLICY IF EXISTS "Admins can read all recommendations" ON public.recommendations;
CREATE POLICY "Admins can read all recommendations"
  ON public.recommendations FOR SELECT
  USING (
    COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
  );

DROP POLICY IF EXISTS "Anyone can create recommendation" ON public.recommendations;
CREATE POLICY "Anyone can create recommendation"
  ON public.recommendations FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = from_user_id AND auth.uid() <> to_profile_id);

DROP POLICY IF EXISTS "Owners, authors and admins can update recommendations" ON public.recommendations;
DROP POLICY IF EXISTS "Owners and authors can update recommendations" ON public.recommendations;
DROP POLICY IF EXISTS "Admins can update all recommendations" ON public.recommendations;
CREATE POLICY "Owners, authors and admins can update recommendations"
  ON public.recommendations FOR UPDATE
  USING (
    auth.uid() = to_profile_id 
    OR auth.uid() = from_user_id
    OR COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
  )
  WITH CHECK (
    auth.uid() = to_profile_id 
    OR auth.uid() = from_user_id
    OR COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
  );

DROP POLICY IF EXISTS "Authors can delete recommendations" ON public.recommendations;
DROP POLICY IF EXISTS "Authors, owners and admins can delete recommendations" ON public.recommendations;
CREATE POLICY "Authors, owners and admins can delete recommendations"
  ON public.recommendations FOR DELETE
  USING (
    auth.uid() = from_user_id
    OR auth.uid() = to_profile_id
    OR COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
  );

-- 4. RPC SECURITY DEFINER para eliminar reseñas de forma 100% segura
CREATE OR REPLACE FUNCTION public.delete_recommendation(target_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_catalog
AS $$
DECLARE
  rec RECORD;
  caller_id UUID;
  caller_role TEXT;
BEGIN
  caller_id := auth.uid();
  caller_role := COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '');

  SELECT id, from_user_id, to_profile_id INTO rec
    FROM public.recommendations
   WHERE id = target_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reseña no encontrada';
  END IF;

  -- Solo el autor, el dueño del perfil o un admin pueden eliminarla
  IF caller_id = rec.from_user_id 
     OR caller_id = rec.to_profile_id 
     OR caller_role = 'admin' THEN
    DELETE FROM public.recommendations WHERE id = target_id;
    RETURN TRUE;
  ELSE
    RAISE EXCEPTION 'No tenés permisos para eliminar esta reseña';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_recommendation(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_recommendation(UUID) TO authenticated;

-- 5. RPC Administrativa para eliminar reseña
CREATE OR REPLACE FUNCTION public.admin_delete_recommendation(target_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_catalog
AS $$
BEGIN
  IF COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') <> 'admin' THEN
    RAISE EXCEPTION 'Solo un administrador puede ejecutar esta acción';
  END IF;

  DELETE FROM public.recommendations WHERE id = target_id;
  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_delete_recommendation(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_delete_recommendation(UUID) TO authenticated;

-- 6. RPC para limpiar reseñas anónimas
CREATE OR REPLACE FUNCTION public.admin_cleanup_anonymous_reviews(target_profile_id UUID DEFAULT NULL)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_catalog
AS $$
DECLARE
  del_count INTEGER := 0;
BEGIN
  IF target_profile_id IS NOT NULL THEN
    DELETE FROM public.recommendations
     WHERE to_profile_id = target_profile_id
       AND from_user_id IS NULL;
  ELSE
    DELETE FROM public.recommendations
     WHERE from_user_id IS NULL;
  END IF;
  GET DIAGNOSTICS del_count = ROW_COUNT;
  RETURN del_count;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_cleanup_anonymous_reviews(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_cleanup_anonymous_reviews(UUID) TO authenticated;

-- 7. Permisos de DELETE en public.notifications para usuarios autenticados
GRANT DELETE ON public.notifications TO authenticated;

DROP POLICY IF EXISTS "Users can delete their own notifications" ON public.notifications;
CREATE POLICY "Users can delete their own notifications"
  ON public.notifications FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- 8. RPCs para descartar y limpiar notificaciones de forma garantizada
CREATE OR REPLACE FUNCTION public.delete_my_notification(notification_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_catalog
AS $$
BEGIN
  DELETE FROM public.notifications
   WHERE id = notification_id
     AND user_id = auth.uid();
  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_my_notification(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_my_notification(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.clear_my_archived_notifications()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_catalog
AS $$
DECLARE
  del_count INTEGER := 0;
BEGIN
  DELETE FROM public.notifications
   WHERE user_id = auth.uid()
     AND read = TRUE;
  GET DIAGNOSTICS del_count = ROW_COUNT;
  RETURN del_count;
END;
$$;

REVOKE ALL ON FUNCTION public.clear_my_archived_notifications() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.clear_my_archived_notifications() TO authenticated;

-- 9. Recargar caché de esquema de PostgREST
NOTIFY pgrst, 'reload schema';
