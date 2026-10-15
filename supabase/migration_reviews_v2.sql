-- LABURANTE - Reseñas puntuadas y vinculadas a experiencias verificables
--
-- Esta migración es aditiva e idempotente. No elimina perfiles, usuarios,
-- reseñas ni relaciones históricas. Las reseñas existentes reciben 5 estrellas
-- porque el propietario indicó que todas las históricas corresponden a cinco.

BEGIN;

ALTER TABLE public.recommendations
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rating SMALLINT,
  ADD COLUMN IF NOT EXISTS job_request_id UUID;

ALTER TABLE public.recommendations
  DROP CONSTRAINT IF EXISTS recommendations_rating_check;

-- Las instalaciones anteriores pueden tener un trigger de UPDATE que impide
-- cambiar campos de identidad. El backfill es una operación única de
-- migración, no una edición de usuario. Bloqueamos la tabla y quitamos solo
-- ese trigger durante el backfill; la transacción que ejecuta esta migración
-- lo restaura si algo falla antes de terminar.
LOCK TABLE public.recommendations IN ACCESS EXCLUSIVE MODE;
DROP TRIGGER IF EXISTS validate_recommendation_update_trigger
  ON public.recommendations;

-- Backfill exclusivo: solo filas históricas sin puntuación.
UPDATE public.recommendations
   SET rating = 5
 WHERE rating IS NULL;

ALTER TABLE public.recommendations
  ALTER COLUMN rating DROP DEFAULT,
  ALTER COLUMN rating SET NOT NULL;

ALTER TABLE public.recommendations
  ADD CONSTRAINT recommendations_rating_check
  CHECK (rating BETWEEN 1 AND 5) NOT VALID;
ALTER TABLE public.recommendations
  VALIDATE CONSTRAINT recommendations_rating_check;

DO $$
BEGIN
  IF to_regclass('public.job_requests') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conrelid = 'public.recommendations'::regclass
        AND conname = 'recommendations_job_request_id_fkey'
    ) THEN
      ALTER TABLE public.recommendations
        ADD CONSTRAINT recommendations_job_request_id_fkey
        FOREIGN KEY (job_request_id) REFERENCES public.job_requests(id)
        ON DELETE SET NULL NOT VALID;
    END IF;
    ALTER TABLE public.recommendations
      VALIDATE CONSTRAINT recommendations_job_request_id_fkey;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_recommendations_profile_rating
  ON public.recommendations(to_profile_id, status, rating);
CREATE INDEX IF NOT EXISTS idx_recommendations_job_request
  ON public.recommendations(job_request_id)
  WHERE job_request_id IS NOT NULL;

-- No se descartan duplicados históricos si existieran. La RPC y el lock de
-- transacción mantienen la regla para nuevas reseñas; el índice se crea si la
-- base no contiene inconsistencias en esta relación.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.recommendations
    WHERE job_request_id IS NOT NULL
    GROUP BY from_user_id, job_request_id
    HAVING COUNT(*) > 1
  ) THEN
    EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS recommendations_one_per_experience ON public.recommendations(from_user_id, job_request_id) WHERE job_request_id IS NOT NULL';
  ELSE
    RAISE WARNING 'No se creó el índice único de reseñas por experiencia: existen duplicados históricos que requieren revisión manual.';
  END IF;
END $$;

-- La identidad y la experiencia nunca se reciben del cliente como autoridad.
CREATE OR REPLACE FUNCTION public.validate_recommendation_anti_fraud()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
DECLARE
  v_actor_id UUID := auth.uid();
  v_is_admin BOOLEAN := COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin';
  v_author_name TEXT;
  v_target_status public.profile_status;
  v_job RECORD;
  v_confirmed_at TIMESTAMPTZ;
  v_created_at TIMESTAMPTZ;
  v_recent_reviews INTEGER;
  v_duplicate_content INTEGER;
BEGIN
  IF v_is_admin THEN
    RETURN NEW;
  END IF;
  IF v_actor_id IS NULL THEN RAISE EXCEPTION 'unauthenticated_review'; END IF;

  NEW.from_user_id := v_actor_id;
  IF NEW.from_user_id = NEW.to_profile_id THEN
    RAISE EXCEPTION 'self_review_not_allowed';
  END IF;
  IF NEW.rating IS NULL OR NEW.rating NOT BETWEEN 1 AND 5 THEN
    RAISE EXCEPTION 'review_rating_invalid';
  END IF;

  SELECT status INTO v_target_status FROM public.profiles WHERE id = NEW.to_profile_id;
  IF v_target_status IS NULL OR v_target_status <> 'activo' THEN
    RAISE EXCEPTION 'target_profile_inactive';
  END IF;

  SELECT name INTO v_author_name
    FROM public.profiles
   WHERE id = v_actor_id AND status = 'activo';
  IF v_author_name IS NULL OR trim(v_author_name) = '' THEN
    RAISE EXCEPTION 'author_profile_required';
  END IF;
  NEW.from_name := trim(v_author_name);

  IF NEW.job_request_id IS NULL THEN
    RAISE EXCEPTION 'completed_job_required';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('review_job_' || NEW.job_request_id::text));

  SELECT j.client_id, j.profile_id, j.status
    INTO v_job
    FROM public.job_requests j
   WHERE j.id = NEW.job_request_id
   FOR SHARE;
  IF NOT FOUND
     OR v_job.client_id IS DISTINCT FROM v_actor_id
     OR v_job.profile_id IS DISTINCT FROM NEW.to_profile_id
     OR v_job.status <> 'completado' THEN
    RAISE EXCEPTION 'review_experience_not_verified';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.recommendations r
     WHERE r.from_user_id = v_actor_id
       AND r.job_request_id = NEW.job_request_id
  ) THEN
    RAISE EXCEPTION 'review_already_exists_for_experience';
  END IF;

  SELECT email_confirmed_at, created_at INTO v_confirmed_at, v_created_at
    FROM auth.users WHERE id = v_actor_id;
  IF v_confirmed_at IS NULL THEN RAISE EXCEPTION 'email_confirmation_required_for_reviews'; END IF;
  IF v_created_at > NOW() - INTERVAL '5 minutes' THEN RAISE EXCEPTION 'account_too_new_for_reviews'; END IF;

  SELECT COUNT(*) INTO v_recent_reviews
    FROM public.recommendations r
   WHERE r.from_user_id = v_actor_id
     AND r.created_at > NOW() - INTERVAL '1 hour';
  IF v_recent_reviews >= 3 THEN RAISE EXCEPTION 'review_rate_limit_hourly_exceeded'; END IF;

  SELECT COUNT(*) INTO v_duplicate_content
    FROM public.recommendations r
   WHERE r.from_user_id = v_actor_id
     AND md5(trim(lower(r.text))) = md5(trim(lower(NEW.text)))
     AND r.created_at > NOW() - INTERVAL '7 days';
  IF v_duplicate_content > 0 THEN RAISE EXCEPTION 'duplicate_review_content'; END IF;

  NEW.status := 'pendiente';
  NEW.created_at := NOW();
  NEW.expires_at := NOW() + INTERVAL '30 days';
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_recommendation_anti_fraud_trigger ON public.recommendations;
CREATE TRIGGER validate_recommendation_anti_fraud_trigger
  BEFORE INSERT ON public.recommendations
  FOR EACH ROW EXECUTE FUNCTION public.validate_recommendation_anti_fraud();

CREATE OR REPLACE FUNCTION public.validate_recommendation_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
DECLARE
  v_actor_id UUID := auth.uid();
  v_is_admin BOOLEAN := COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin';
  v_is_service_role BOOLEAN := COALESCE(auth.jwt() ->> 'role', '') = 'service_role';
  v_is_author BOOLEAN := v_actor_id IS NOT NULL AND v_actor_id = OLD.from_user_id;
  v_is_recipient BOOLEAN := v_actor_id IS NOT NULL AND v_actor_id = OLD.to_profile_id;
BEGIN
  IF NEW.from_user_id IS DISTINCT FROM OLD.from_user_id
     OR NEW.to_profile_id IS DISTINCT FROM OLD.to_profile_id
     OR NEW.from_name IS DISTINCT FROM OLD.from_name
     OR NEW.job_request_id IS DISTINCT FROM OLD.job_request_id
     OR NEW.rating IS DISTINCT FROM OLD.rating
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'review_identity_or_rating_immutable';
  END IF;
  IF v_is_admin OR v_is_service_role THEN RETURN NEW; END IF;

  IF v_is_author AND NOT v_is_recipient THEN
    IF NEW.status IS DISTINCT FROM OLD.status THEN RAISE EXCEPTION 'author_cannot_change_status'; END IF;
    RETURN NEW;
  END IF;
  IF v_is_recipient THEN
    IF NEW.text IS DISTINCT FROM OLD.text OR NEW.context IS DISTINCT FROM OLD.context THEN
      RAISE EXCEPTION 'recipient_cannot_edit_content';
    END IF;
    IF NEW.status IS DISTINCT FROM OLD.status AND NOT (
      (OLD.status = 'pendiente' AND NEW.status = 'visible')
      OR (OLD.status = 'visible' AND NEW.status = 'oculto')
      OR (OLD.status = 'oculto' AND NEW.status = 'visible')
    ) THEN
      RAISE EXCEPTION 'invalid_status_transition_for_recipient';
    END IF;
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'unauthorized_recommendation_update';
END;
$$;

DROP TRIGGER IF EXISTS validate_recommendation_update_trigger ON public.recommendations;
CREATE TRIGGER validate_recommendation_update_trigger
  BEFORE UPDATE ON public.recommendations
  FOR EACH ROW EXECUTE FUNCTION public.validate_recommendation_update();

-- Única vía de alta para clientes autenticados. La función deriva actor,
-- nombre, estado y fecha, y vuelve a verificar la experiencia en una sola TX.
CREATE OR REPLACE FUNCTION public.submit_review(
  p_target_profile_id UUID,
  p_job_request_id UUID,
  p_rating SMALLINT,
  p_text TEXT,
  p_context TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
DECLARE
  v_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'unauthenticated_review'; END IF;
  IF p_text IS NULL OR char_length(trim(p_text)) < 10 THEN RAISE EXCEPTION 'review_text_too_short'; END IF;
  INSERT INTO public.recommendations (to_profile_id, job_request_id, rating, text, context)
  VALUES (p_target_profile_id, p_job_request_id, p_rating, trim(p_text), NULLIF(trim(p_context), ''))
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_review(UUID, UUID, SMALLINT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_review(UUID, UUID, SMALLINT, TEXT, TEXT) TO authenticated;

REVOKE INSERT ON public.recommendations FROM anon, authenticated;
ALTER TABLE public.recommendations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.recommendations FROM PUBLIC;
REVOKE ALL ON public.recommendations FROM anon;
GRANT SELECT, UPDATE, DELETE ON public.recommendations TO authenticated;
DROP POLICY IF EXISTS "Anyone can create recommendation" ON public.recommendations;
DROP POLICY IF EXISTS "Authenticated users can create recommendation" ON public.recommendations;

DO $$
BEGIN
  IF to_regclass('public.public_profile_recommendations') IS NULL THEN
    EXECUTE $view$
      CREATE VIEW public.public_profile_recommendations AS
      SELECT r.id, r.to_profile_id, r.from_name, r.text, r.context,
             r.created_at, r.status, (r.from_user_id = auth.uid()) AS is_author,
             r.rating
        FROM public.recommendations r
        JOIN public.profiles p ON p.id = r.to_profile_id
       WHERE p.status = 'activo' AND r.status = 'visible' AND r.from_user_id IS NOT NULL
    $view$;
  ELSE
    EXECUTE $view$
      CREATE OR REPLACE VIEW public.public_profile_recommendations AS
      SELECT r.id, r.to_profile_id, r.from_name, r.text, r.context,
             r.created_at, r.status, (r.from_user_id = auth.uid()) AS is_author,
             r.rating
        FROM public.recommendations r
        JOIN public.profiles p ON p.id = r.to_profile_id
       WHERE p.status = 'activo' AND r.status = 'visible' AND r.from_user_id IS NOT NULL
    $view$;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.public_profile_reputation') IS NULL THEN
    EXECUTE $view$
      CREATE VIEW public.public_profile_reputation AS
      SELECT p.id AS profile_id,
             COALESCE(AVG(r.rating) FILTER (WHERE r.status = 'visible'), 0)::numeric AS average_rating,
             COUNT(r.id) FILTER (WHERE r.status = 'visible' AND r.rating BETWEEN 1 AND 5)::bigint AS review_count
        FROM public.profiles p
        LEFT JOIN public.recommendations r ON r.to_profile_id = p.id
       WHERE p.status = 'activo'
       GROUP BY p.id
    $view$;
  ELSE
    EXECUTE $view$
      CREATE OR REPLACE VIEW public.public_profile_reputation AS
      SELECT p.id AS profile_id,
             COALESCE(AVG(r.rating) FILTER (WHERE r.status = 'visible'), 0)::numeric AS average_rating,
             COUNT(r.id) FILTER (WHERE r.status = 'visible' AND r.rating BETWEEN 1 AND 5)::bigint AS review_count
        FROM public.profiles p
        LEFT JOIN public.recommendations r ON r.to_profile_id = p.id
       WHERE p.status = 'activo'
       GROUP BY p.id
    $view$;
  END IF;
END $$;

REVOKE ALL ON public.public_profile_recommendations, public.public_profile_reputation FROM PUBLIC;
GRANT SELECT ON public.public_profile_recommendations, public.public_profile_reputation TO anon, authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
