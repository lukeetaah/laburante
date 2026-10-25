BEGIN;

DO $$
DECLARE
  function_name text;
  required_function text;
  missing_functions text[] := ARRAY[]::text[];
BEGIN
  FOREACH required_function IN ARRAY ARRAY[
    'admin_approve_whatsapp_verification(uuid,text)',
    'admin_expire_pending_recommendations()',
    'admin_get_auth_users_verification_status(text)',
    'admin_get_user_emails(uuid[])',
    'admin_process_incomplete_profile_reminders(integer)',
    'admin_reply_support_ticket(uuid,text,boolean)',
    'admin_update_support_ticket(uuid,text,text,text)',
    'create_anonymous_review_notification()',
    'enforce_candidate_inquiry_transition()',
    'enforce_company_plan_approval()',
    'enforce_job_request_transition()',
    'prevent_client_whatsapp_verification()',
    'protect_profile_verification_fields()',
    'protect_recommendation_identity()',
    'protect_verified_whatsapp_contact_method()',
    'validate_recommendation_anti_fraud()',
    'validate_recommendation_update()'
  ]
  LOOP
    IF to_regprocedure('public.' || required_function) IS NULL THEN
      missing_functions := array_append(missing_functions, required_function);
    END IF;
  END LOOP;

  IF cardinality(missing_functions) > 0 THEN
    RAISE EXCEPTION 'No se puede aplicar ACL completion: faltan funciones obligatorias: %', array_to_string(missing_functions, ', ');
  END IF;

  FOREACH function_name IN ARRAY ARRAY[
    'admin_approve_whatsapp_verification(uuid,text)',
    'admin_expire_pending_recommendations()',
    'admin_get_auth_users_verification_status(text)',
    'admin_get_user_emails(uuid[])',
    'admin_process_incomplete_profile_reminders(integer)',
    'admin_reply_support_ticket(uuid,text,boolean)',
    'admin_update_support_ticket(uuid,text,text,text)'
  ]
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon', function_name);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', function_name);
  END LOOP;

  FOREACH function_name IN ARRAY ARRAY[
    'create_anonymous_review_notification()',
    'enforce_candidate_inquiry_transition()',
    'enforce_company_plan_approval()',
    'enforce_job_request_transition()',
    'prevent_client_whatsapp_verification()',
    'protect_profile_verification_fields()',
    'protect_recommendation_identity()',
    'protect_verified_whatsapp_contact_method()',
    'validate_recommendation_anti_fraud()',
    'validate_recommendation_update()'
  ]
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon, authenticated', function_name);
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';

COMMIT;
