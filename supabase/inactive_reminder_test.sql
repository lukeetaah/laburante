-- Pruebas reproducibles para una base descartable.
-- Ejecutar con psql desde un rol local que pueda hacer SET ROLE:
--   psql -v actor_id='...' -v other_user_id='...' \
--     -f supabase/inactive_reminder_test.sql
-- No ejecutar contra producción. Todo termina en ROLLBACK.

\set ON_ERROR_STOP on
BEGIN;

SELECT set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', :'actor_id',
    'role', 'authenticated',
    'app_metadata', json_build_object('role', 'user')
  )::TEXT,
  true
);
SET LOCAL ROLE authenticated;

-- La primera llamada registra actividad; la segunda dentro de 24 h no escribe.
SELECT public.touch_my_activity() AS first_touch \gset
SELECT public.touch_my_activity() AS second_touch \gset
DO $$
BEGIN
  IF :'first_touch' <> 't' OR :'second_touch' <> 'f' THEN
    RAISE EXCEPTION 'TEST FAILED: límite de actividad de 24 horas';
  END IF;
END;
$$;

-- Una cuenta autenticada no puede modificar actividad ajena ni insertar filas.
DO $$
BEGIN
  BEGIN
    INSERT INTO public.user_activity (user_id, last_activity_at)
    VALUES (:'other_user_id'::UUID, NOW());
    RAISE EXCEPTION 'TEST FAILED: INSERT directo de actividad aceptado';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'TEST FAILED:%' THEN RAISE; END IF;
  END;
END;
$$;

ROLLBACK;
