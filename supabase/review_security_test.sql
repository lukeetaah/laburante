-- Pruebas reproducibles de reseñas para una base descartable.
-- Requiere psql y tres variables que apunten a un fixture existente:
--   psql -v actor_id='...' -v target_id='...' -v job_id='...' \
--     -f supabase/review_security_test.sql
--
-- El job debe estar en estado `completado`, pertenecer a actor_id como
-- client_id, apuntar a target_id como profile_id y no tener una reseña del
-- actor. El script no debe ejecutarse contra producción.

\set ON_ERROR_STOP on
BEGIN;

-- Simula el contexto JWT de una persona autenticada no administrativa.
SELECT set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', :'actor_id',
    'role', 'authenticated',
    'app_metadata', json_build_object('role', 'user')
  )::TEXT,
  true
);

-- La sesión de prueba debe tener permiso para asumir este rol localmente
-- (por ejemplo, el rol postgres del entorno descartable).
SET LOCAL ROLE authenticated;

-- La única alta autorizada crea una reseña pendiente y deriva actor/nombre.
SELECT public.submit_review(
  :'target_id'::UUID,
  :'job_id'::UUID,
  5,
  'Fixture de reseña válida para pruebas de seguridad.'
) AS review_id \gset

SELECT id, from_user_id, to_profile_id, job_request_id, rating, status
  FROM public.recommendations
 WHERE id = :'review_id'::UUID
   AND from_user_id = :'actor_id'::UUID
   AND to_profile_id = :'target_id'::UUID
   AND job_request_id = :'job_id'::UUID
   AND rating = 5
   AND status = 'pendiente';

-- Las puntuaciones fuera del rango deben fallar en backend.
DO $$
BEGIN
  BEGIN
    PERFORM public.submit_review(
      :'target_id'::UUID,
      :'job_id'::UUID,
      0,
      'Esta llamada debe fallar por rating inválido.'
    );
    RAISE EXCEPTION 'TEST FAILED: rating inválido fue aceptado';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'TEST FAILED:%' THEN RAISE; END IF;
  END;
END;
$$;

-- La misma persona no puede reseñar dos veces la misma experiencia.
DO $$
BEGIN
  BEGIN
    PERFORM public.submit_review(
      :'target_id'::UUID,
      :'job_id'::UUID,
      4,
      'Esta llamada debe fallar por reseña duplicada.'
    );
    RAISE EXCEPTION 'TEST FAILED: duplicado fue aceptado';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'TEST FAILED:%' THEN RAISE; END IF;
  END;
END;
$$;

-- El rol autenticado no tiene INSERT directo sobre la tabla.
DO $$
BEGIN
  BEGIN
    INSERT INTO public.recommendations (to_profile_id, rating, text)
    VALUES (:'target_id'::UUID, 3, 'Esta llamada debe fallar por privilegios.');
    RAISE EXCEPTION 'TEST FAILED: INSERT directo fue aceptado';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'TEST FAILED:%' THEN RAISE; END IF;
  END;
END;
$$;

-- Autor, destinatario, experiencia, fecha y rating son inmutables.
DO $$
BEGIN
  BEGIN
    UPDATE public.recommendations
       SET rating = 1
     WHERE id = :'review_id'::UUID;
    RAISE EXCEPTION 'TEST FAILED: rating mutable fue aceptado';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'TEST FAILED:%' THEN RAISE; END IF;
  END;
END;
$$;

ROLLBACK;
