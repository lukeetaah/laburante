  /*
    LABURANTE — preflight SQL de producción (SOLO LECTURA)

    Propósito:
      Inspeccionar el esquema real antes de ejecutar las migraciones:
        - 20261025170000_profile_photos_listing_hardening.sql
        - 20261025173000_security_advisor_acl_completion.sql
        - 20261025180000_admin_last_sign_in_by_ids.sql (migración de soporte)
        - 20261025181000_admin_profile_presence_counts.sql
        - 20261025182000_harden_legacy_credentials_rpc.sql
        - 20261025190000_revoke_legacy_credentials_rpc_after_cutover.sql

    Seguridad:
      Este archivo contiene únicamente SELECT y expresiones de catálogo.
      No contiene CREATE, ALTER, DROP, INSERT, UPDATE, DELETE, GRANT,
      REVOKE, NOTIFY, DO, CALL ni invocaciones de funciones de aplicación.
      No devuelve valores de auth.users, correos, contraseñas, tokens ni datos
      personales; inspecciona sólo existencia, metadatos, firmas y privilegios.

    Uso:
      1. Abrí Supabase SQL Editor con una conexión de lectura autorizada.
      2. Ejecutá cada bloque SELECT por separado.
      3. Guardá los resultados sin incluir valores de usuarios.
      4. No ejecutes las migraciones hasta resolver todos los BLOCK y revisar
         manualmente los REVIEW/NOT_VERIFIABLE.
      5. No uses este archivo como migración: es un diagnóstico previo.

    Criterio:
      PASS            condición comprobada por el catálogo.
      BLOCK           incompatibilidad que impide avanzar con seguridad.
      REVIEW          resultado compatible pero requiere decisión humana.
      NOT_VERIFIABLE  el catálogo no puede comprobar el requisito operativo.
  */

  -- ============================================================================
  -- 0. Contexto de la conexión
  -- ============================================================================

  SELECT
    'PASS' AS verdict,
    current_database() AS database_name,
    current_user AS executing_role,
    session_user AS session_role,
    version() AS server_version;

  -- ============================================================================
  -- A1. Bucket profile-photos: existencia y configuración efectiva
  -- ============================================================================

  SELECT
    CASE
      WHEN b.id IS NULL THEN 'REVIEW'
      WHEN b.public IS DISTINCT FROM TRUE THEN 'BLOCK'
      WHEN b.file_size_limit IS DISTINCT FROM 5242880 THEN 'REVIEW'
      WHEN b.allowed_mime_types IS DISTINCT FROM ARRAY['image/jpeg', 'image/png', 'image/webp']::text[] THEN 'REVIEW'
      ELSE 'PASS'
    END AS verdict,
    CASE
      WHEN b.id IS NULL THEN 'El bucket no existe; la migration lo crearía, pero falta validar dependencias y lectura pública.'
      WHEN b.public IS DISTINCT FROM TRUE THEN 'La migration cambiaría el bucket a público; revisar impacto antes de continuar.'
      WHEN b.file_size_limit IS DISTINCT FROM 5242880 THEN 'El límite actual difiere del límite que la migration impondrá.'
      WHEN b.allowed_mime_types IS DISTINCT FROM ARRAY['image/jpeg', 'image/png', 'image/webp']::text[] THEN 'Los MIME actuales difieren de los que la migration impondrá.'
      ELSE 'Configuración actual coincide con la migration.'
    END AS finding,
    b.id,
    b.name,
    b.public,
    b.file_size_limit,
    b.allowed_mime_types
  FROM (VALUES ('profile-photos'::text)) AS expected(bucket_id)
  LEFT JOIN storage.buckets AS b ON b.id = expected.bucket_id;

  -- ============================================================================
  -- A2. Storage: todas las políticas que podrían afectar profile-photos
  -- ============================================================================

  SELECT
    CASE
      WHEN p.policyname IN (
        'Public read profile photos',
        'Public list profile photos',
        'Users can upload profile photos',
        'Users upload own profile photos',
        'Users can update own profile photos',
        'Users update own profile photos',
        'Users can delete own profile photos',
        'Users delete own profile photos'
      ) THEN 'EXPECTED_NAME'
      ELSE 'ALTERNATIVE_NAME_REVIEW'
    END AS policy_name_status,
    p.schemaname,
    p.tablename,
    p.policyname,
    p.permissive,
    p.roles,
    p.cmd,
    p.qual,
    p.with_check
  FROM pg_policies AS p
  WHERE p.schemaname = 'storage'
    AND p.tablename = 'objects'
    AND (
      coalesce(p.qual, '') ILIKE '%profile-photos%'
      OR coalesce(p.with_check, '') ILIKE '%profile-photos%'
    )
  ORDER BY p.policyname;

  -- A2b. Todas las políticas de storage.objects, incluidas las genéricas.
  --      Una política sin filtro bucket_id puede afectar profile-photos aunque
  --      su expresión no mencione el bucket explícitamente.

  SELECT
    'REVIEW' AS verdict,
    p.schemaname,
    p.tablename,
    p.policyname,
    p.permissive,
    p.roles,
    p.cmd,
    p.qual,
    p.with_check
  FROM pg_policies AS p
  WHERE p.schemaname = 'storage'
    AND p.tablename = 'objects'
  ORDER BY p.policyname;

  -- ============================================================================
  -- A3. Storage: acceso conocido por URL versus enumeración de objetos
  --      La lectura de una URL conocida puede provenir de bucket.public = true;
  --      no requiere una política SELECT que mencione profile-photos.
  --      La enumeración/listado no se deduce de esta consulta: queda REVIEW.
  -- ============================================================================

  SELECT
    'REVIEW' AS verdict,
    ops.cmd AS operation,
    CASE
      WHEN ops.cmd <> 'SELECT' THEN 'NOT_APPLICABLE_KNOWN_URL_READ'
      WHEN b.public IS TRUE THEN 'PASS_CATALOG_EVIDENCE_KNOWN_URL_READ'
      WHEN b.public IS FALSE THEN 'BLOCK_CATALOG_EVIDENCE_BUCKET_NOT_PUBLIC'
      ELSE 'REVIEW_BUCKET_NOT_FOUND_OR_NOT_VISIBLE'
    END AS known_url_read_catalog_evidence,
    CASE
      WHEN ops.cmd = 'SELECT' THEN 'REVIEW_MANUAL_LISTING_TEST_REQUIRED'
      ELSE 'NOT_APPLICABLE_OBJECT_LISTING'
    END AS object_listing_evidence,
    CASE
      WHEN ops.cmd IN ('INSERT', 'UPDATE', 'DELETE') THEN 'REVIEW_WRITE_POLICY_SCOPE_MANUAL_REQUIRED'
      ELSE 'NOT_APPLICABLE_WRITE_PERMISSION'
    END AS write_policy_evidence,
    count(*) FILTER (
      WHERE p.policyname IS NOT NULL
        AND (
          coalesce(p.qual, '') ILIKE '%profile-photos%'
          OR coalesce(p.with_check, '') ILIKE '%profile-photos%'
        )
    ) AS bucket_text_policy_count,
    CASE
      WHEN count(*) FILTER (
        WHERE p.policyname IS NOT NULL
          AND (
            coalesce(p.qual, '') ILIKE '%profile-photos%'
            OR coalesce(p.with_check, '') ILIKE '%profile-photos%'
          )
      ) = 0 THEN 'NOT_DETERMINED_NO_BUCKET_TEXT_MATCH'
      ELSE 'REVIEW_BUCKET_TEXT_MATCH_ONLY'
    END AS bucket_specific_policy_evidence,
    count(p.policyname) AS all_storage_object_policy_count,
    string_agg(p.policyname, ' | ' ORDER BY p.policyname) AS all_storage_object_policy_names,
    string_agg(
      CASE WHEN p.policyname IS NOT NULL THEN concat(
          p.policyname,
          ' [roles=', coalesce(array_to_string(p.roles, ','), 'NULL'),
          '; qual=', coalesce(p.qual, 'NULL'),
          '; with_check=', coalesce(p.with_check, 'NULL'), ']'
        ) END,
      ' || ' ORDER BY p.policyname
    ) AS policy_expressions_for_manual_review
  FROM (VALUES
    ('SELECT'::text),
    ('INSERT'::text),
    ('UPDATE'::text),
    ('DELETE'::text)
  ) AS ops(cmd)
  LEFT JOIN pg_policies AS p
    ON p.schemaname = 'storage'
   AND p.tablename = 'objects'
   AND (upper(p.cmd) = ops.cmd OR upper(p.cmd) = 'ALL')
  LEFT JOIN LATERAL (
    SELECT b.public
    FROM storage.buckets AS b
    WHERE b.id = 'profile-photos'
  ) AS b ON TRUE
  GROUP BY ops.cmd, b.public
  ORDER BY CASE ops.cmd
    WHEN 'SELECT' THEN 1
    WHEN 'INSERT' THEN 2
    WHEN 'UPDATE' THEN 3
    WHEN 'DELETE' THEN 4
  END;

  -- ============================================================================
  -- A4. Storage: candidatos desconocidos y expresiones que requieren revisión
  --      No se declara PASS cuando no hay coincidencias: una política genérica
  --      puede no mencionar profile-photos y aun así afectar el bucket.
  -- ============================================================================

  SELECT
    'REVIEW' AS verdict,
    count(*) FILTER (WHERE p.policyname IS NOT NULL) AS all_storage_object_policy_count,
    count(*) FILTER (
      WHERE p.policyname IS NOT NULL
        AND p.policyname NOT IN (
          'Public read profile photos',
          'Public list profile photos',
          'Users can upload profile photos',
          'Users upload own profile photos',
          'Users can update own profile photos',
          'Users update own profile photos',
          'Users can delete own profile photos',
          'Users delete own profile photos'
        )
    ) AS unknown_name_candidate_count,
    string_agg(
      concat(
        p.policyname,
        ' [cmd=', coalesce(p.cmd, 'NULL'),
        '; roles=', coalesce(array_to_string(p.roles, ','), 'NULL'),
        '; qual=', coalesce(p.qual, 'NULL'),
        '; with_check=', coalesce(p.with_check, 'NULL'), ']'
      ),
      ' || ' ORDER BY p.policyname
    ) AS every_storage_object_policy_for_manual_inspection,
    'No se puede demostrar ausencia de acceso amplio sólo por nombre o texto; revisar todas las expresiones y probar listado por separado.' AS manual_review_required
  FROM pg_policies AS p
  WHERE p.schemaname = 'storage'
    AND p.tablename = 'objects';

  -- ============================================================================
  -- A5. Storage: buckets y políticas relacionadas que no son profile-photos
  --     Esto detecta dependencias de flujos legacy que no deben borrarse.
  -- ============================================================================

  SELECT
    'REVIEW' AS verdict,
    p.policyname,
    p.cmd,
    p.roles,
    p.qual,
    p.with_check
  FROM pg_policies AS p
  WHERE p.schemaname = 'storage'
    AND p.tablename = 'objects'
    AND (
      coalesce(p.qual, '') ILIKE '%profile-assets%'
      OR coalesce(p.with_check, '') ILIKE '%profile-assets%'
      OR coalesce(p.qual, '') ILIKE '%profile-documents%'
      OR coalesce(p.with_check, '') ILIKE '%profile-documents%'
    )
  ORDER BY p.policyname;

  SELECT
    'REVIEW' AS verdict,
    b.id,
    b.name,
    b.public,
    b.file_size_limit,
    b.allowed_mime_types
  FROM storage.buckets AS b
  WHERE b.id IN ('profile-assets', 'profile-documents', 'support-attachments')
  ORDER BY b.id;

  -- ============================================================================
  -- B1. Funciones requeridas por ACL completion: existencia de firma exacta
  -- ============================================================================

  WITH expected(signature) AS (
    VALUES
      ('admin_approve_whatsapp_verification(uuid,text)'),
      ('admin_expire_pending_recommendations()'),
      ('admin_get_auth_users_verification_status(text)'),
      ('admin_get_user_emails(uuid[])'),
      ('admin_process_incomplete_profile_reminders(integer)'),
      ('admin_reply_support_ticket(uuid,text,boolean)'),
      ('admin_update_support_ticket(uuid,text,text,text)'),
      ('create_anonymous_review_notification()'),
      ('enforce_candidate_inquiry_transition()'),
      ('enforce_company_plan_approval()'),
      ('enforce_job_request_transition()'),
      ('prevent_client_whatsapp_verification()'),
      ('protect_profile_verification_fields()'),
      ('protect_recommendation_identity()'),
      ('protect_verified_whatsapp_contact_method()'),
      ('validate_recommendation_anti_fraud()'),
      ('validate_recommendation_update()')
  ),
  resolved AS (
    SELECT
      signature,
      to_regprocedure('public.' || signature)::oid AS function_oid
    FROM expected
  )
  SELECT
    CASE WHEN r.function_oid IS NULL THEN 'BLOCK' ELSE 'PASS' END AS verdict,
    r.signature,
    p.oid IS NOT NULL AS exists_exact_signature
  FROM resolved AS r
  LEFT JOIN pg_proc AS p ON p.oid = r.function_oid
  ORDER BY r.signature;

  -- ============================================================================
  -- B2. Funciones nuevas y RPC legacy: existencia de firma exacta
  --     La ausencia de una función que la migration CREATE OR REPLACE debe
  --     crear es esperable; la ausencia de una RPC legacy es BLOCK.
  -- ============================================================================

  WITH expected(signature, object_kind) AS (
    VALUES
      ('admin_get_last_sign_in_at(uuid[])', 'new_function'),
      ('admin_get_profile_presence_counts()', 'new_function'),
      ('admin_get_user_email(uuid)', 'legacy_rpc'),
      ('admin_update_user_credentials(uuid,text,text)', 'legacy_rpc')
  ),
  resolved AS (
    SELECT
      signature,
      object_kind,
      to_regprocedure('public.' || signature)::oid AS function_oid
    FROM expected
  )
  SELECT
    CASE
      WHEN r.function_oid IS NOT NULL THEN 'PASS'
      WHEN r.object_kind = 'new_function' THEN 'REVIEW'
      ELSE 'BLOCK'
    END AS verdict,
    r.signature,
    r.object_kind,
    p.oid IS NOT NULL AS exists_exact_signature
  FROM resolved AS r
  LEFT JOIN pg_proc AS p ON p.oid = r.function_oid
  ORDER BY r.signature;

  -- ============================================================================
  -- B3. Propietario, SECURITY DEFINER, volatility y search_path
  -- ============================================================================

  WITH expected(signature) AS (
    VALUES
      ('admin_approve_whatsapp_verification(uuid,text)'),
      ('admin_expire_pending_recommendations()'),
      ('admin_get_auth_users_verification_status(text)'),
      ('admin_get_last_sign_in_at(uuid[])'),
      ('admin_get_profile_presence_counts()'),
      ('admin_get_user_email(uuid)'),
      ('admin_get_user_emails(uuid[])'),
      ('admin_process_incomplete_profile_reminders(integer)'),
      ('admin_reply_support_ticket(uuid,text,boolean)'),
      ('admin_update_support_ticket(uuid,text,text,text)'),
      ('admin_update_user_credentials(uuid,text,text)'),
      ('create_anonymous_review_notification()'),
      ('enforce_candidate_inquiry_transition()'),
      ('enforce_company_plan_approval()'),
      ('enforce_job_request_transition()'),
      ('prevent_client_whatsapp_verification()'),
      ('protect_profile_verification_fields()'),
      ('protect_recommendation_identity()'),
      ('protect_verified_whatsapp_contact_method()'),
      ('validate_recommendation_anti_fraud()'),
      ('validate_recommendation_update()')
  ),
  resolved AS (
    SELECT
      signature,
      to_regprocedure('public.' || signature)::oid AS function_oid
    FROM expected
  )
  SELECT
    CASE
      WHEN p.oid IS NULL AND r.signature IN (
        'admin_get_last_sign_in_at(uuid[])',
        'admin_get_profile_presence_counts()'
      ) THEN 'REVIEW'
      WHEN p.oid IS NULL THEN 'BLOCK'
      WHEN p.prosecdef IS DISTINCT FROM TRUE
        AND r.signature IN (
          'admin_get_last_sign_in_at(uuid[])',
          'admin_get_profile_presence_counts()',
          'admin_get_user_email(uuid)',
          'admin_get_user_emails(uuid[])',
          'admin_update_user_credentials(uuid,text,text)'
        ) THEN 'BLOCK'
      WHEN NOT EXISTS (
        SELECT 1
        FROM unnest(coalesce(p.proconfig, ARRAY[]::text[])) AS cfg
        WHERE cfg LIKE 'search_path=%'
      ) THEN 'REVIEW'
      ELSE 'PASS'
    END AS verdict,
    r.signature,
    p.oid IS NOT NULL AS exists_exact_signature,
    coalesce(pg_get_userbyid(p.proowner), 'UNKNOWN') AS owner,
    p.prosecdef AS security_definer,
    p.provolatile AS volatility,
    p.proconfig AS configuration
  FROM resolved AS r
  LEFT JOIN pg_proc AS p ON p.oid = r.function_oid
  ORDER BY r.signature;

  -- ============================================================================
  -- B4. Privilegios efectivos de PUBLIC, anon, authenticated y server roles
  -- ============================================================================

  WITH expected(signature) AS (
    VALUES
      ('admin_approve_whatsapp_verification(uuid,text)'),
      ('admin_expire_pending_recommendations()'),
      ('admin_get_auth_users_verification_status(text)'),
      ('admin_get_last_sign_in_at(uuid[])'),
      ('admin_get_profile_presence_counts()'),
      ('admin_get_user_email(uuid)'),
      ('admin_get_user_emails(uuid[])'),
      ('admin_process_incomplete_profile_reminders(integer)'),
      ('admin_reply_support_ticket(uuid,text,boolean)'),
      ('admin_update_support_ticket(uuid,text,text,text)'),
      ('admin_update_user_credentials(uuid,text,text)'),
      ('create_anonymous_review_notification()'),
      ('enforce_candidate_inquiry_transition()'),
      ('enforce_company_plan_approval()'),
      ('enforce_job_request_transition()'),
      ('prevent_client_whatsapp_verification()'),
      ('protect_profile_verification_fields()'),
      ('protect_recommendation_identity()'),
      ('protect_verified_whatsapp_contact_method()'),
      ('validate_recommendation_anti_fraud()'),
      ('validate_recommendation_update()')
  ),
  resolved AS (
    SELECT
      signature,
      to_regprocedure('public.' || signature)::oid AS function_oid
    FROM expected
  )
  SELECT
    r.signature,
    CASE WHEN r.function_oid IS NULL THEN 'BLOCK' ELSE 'REVIEW' END AS verdict,
    CASE x.grantee
      WHEN 0 THEN 'PUBLIC'
      ELSE coalesce(pg_get_userbyid(x.grantee), 'ROLE_OID_' || x.grantee::text)
    END AS grantee,
    x.privilege_type,
    x.is_grantable
  FROM resolved AS r
  JOIN pg_proc AS p ON p.oid = r.function_oid
  CROSS JOIN LATERAL aclexplode(
    coalesce(p.proacl, acldefault('f', p.proowner))
  ) AS x
  ORDER BY r.signature, grantee, x.privilege_type;

  -- B4b. Contrato específico de admin_get_last_sign_in_at(uuid[]).
  --       Antes de aplicar 20261025180000 la función puede no existir (REVIEW).
  --       Después debe ser SECURITY DEFINER, usar el search_path esperado,
  --       conceder EXECUTE sólo a service_role y no a PUBLIC/anon/authenticated.

  WITH target AS (
    SELECT to_regprocedure('public.admin_get_last_sign_in_at(uuid[])')::oid AS function_oid
  ),
  function_acl AS (
    SELECT
      p.oid,
      p.prosecdef,
      p.proconfig,
      bool_or(x.grantee = 0 AND x.privilege_type = 'EXECUTE') AS public_execute,
      bool_or(
        x.grantee IN (
          SELECT oid FROM pg_roles WHERE rolname IN ('anon', 'authenticated')
        )
        AND x.privilege_type = 'EXECUTE'
      ) AS client_execute,
      bool_or(
        x.grantee IN (
          SELECT oid FROM pg_roles WHERE rolname = 'service_role'
        )
        AND x.privilege_type = 'EXECUTE'
      ) AS service_execute
    FROM target AS t
    LEFT JOIN pg_proc AS p ON p.oid = t.function_oid
    LEFT JOIN LATERAL aclexplode(
      coalesce(p.proacl, acldefault('f', p.proowner))
    ) AS x ON TRUE
    GROUP BY p.oid, p.prosecdef, p.proconfig
  )
  SELECT
    CASE
      WHEN oid IS NULL THEN 'REVIEW'
      WHEN prosecdef IS DISTINCT FROM TRUE THEN 'BLOCK'
      WHEN NOT EXISTS (
        SELECT 1
        FROM unnest(coalesce(proconfig, ARRAY[]::text[])) AS cfg
        WHERE cfg = 'search_path=pg_catalog, auth'
      ) THEN 'BLOCK'
      WHEN coalesce(public_execute, FALSE) OR coalesce(client_execute, FALSE) THEN 'BLOCK'
      WHEN coalesce(service_execute, FALSE) IS FALSE THEN 'BLOCK'
      ELSE 'PASS'
    END AS verdict,
    'admin_get_last_sign_in_at(uuid[])' AS signature,
    oid IS NOT NULL AS function_exists,
    prosecdef AS security_definer,
    proconfig AS configuration,
    coalesce(public_execute, FALSE) AS public_execute,
    coalesce(client_execute, FALSE) AS anon_or_authenticated_execute,
    coalesce(service_execute, FALSE) AS service_role_execute
  FROM function_acl;

  -- ============================================================================
  -- B5. Dependencias de catálogo de las funciones inspeccionadas
  --     No ejecuta las funciones; sólo muestra objetos referenciados por ellas.
  --     classid/objid/objsubid identifican la función; refclassid/refobjid/
  --     refobjsubid identifican el objeto referenciado.
  --     LIMITACIÓN: pg_depend no registra de forma exhaustiva todas las
  --     referencias escritas dentro del cuerpo de una función PL/pgSQL.
  --     La salida se etiqueta como catalog_dependency_only y requiere revisión
  --     manual del cuerpo/origen para afirmar cobertura completa.
  -- ============================================================================

  WITH expected(signature) AS (
    VALUES
      ('admin_approve_whatsapp_verification(uuid,text)'),
      ('admin_expire_pending_recommendations()'),
      ('admin_get_auth_users_verification_status(text)'),
      ('admin_get_last_sign_in_at(uuid[])'),
      ('admin_get_profile_presence_counts()'),
      ('admin_get_user_email(uuid)'),
      ('admin_get_user_emails(uuid[])'),
      ('admin_process_incomplete_profile_reminders(integer)'),
      ('admin_reply_support_ticket(uuid,text,boolean)'),
      ('admin_update_support_ticket(uuid,text,text,text)'),
      ('admin_update_user_credentials(uuid,text,text)'),
      ('create_anonymous_review_notification()'),
      ('enforce_candidate_inquiry_transition()'),
      ('enforce_company_plan_approval()'),
      ('enforce_job_request_transition()'),
      ('prevent_client_whatsapp_verification()'),
      ('protect_profile_verification_fields()'),
      ('protect_recommendation_identity()'),
      ('protect_verified_whatsapp_contact_method()'),
      ('validate_recommendation_anti_fraud()'),
      ('validate_recommendation_update()')
  ),
  resolved AS (
    SELECT
      signature,
      to_regprocedure('public.' || signature)::oid AS function_oid
    FROM expected
  )
  SELECT
    'REVIEW' AS verdict,
    'catalog_dependency_only' AS dependency_scope,
    r.signature,
    d.classid,
    d.objid,
    d.objsubid,
    d.refclassid,
    d.refobjid,
    d.refobjsubid,
    d.deptype,
    identified.object_type AS referenced_object_type,
    identified.referenced_schema_name,
    identified.referenced_object_name,
    identified.referenced_identity AS referenced_object_identity
  FROM resolved AS r
  LEFT JOIN pg_depend AS d
    ON d.classid = 'pg_proc'::regclass
   AND d.objid = r.function_oid
   AND d.deptype IN ('n', 'i')
  LEFT JOIN LATERAL pg_identify_object(
    d.refclassid,
    d.refobjid,
    d.refobjsubid
  ) AS identified(object_type, referenced_schema_name, referenced_object_name, referenced_identity) ON TRUE
  ORDER BY r.signature, d.refclassid, d.refobjid, d.refobjsubid;

  -- B5b. Funciones sin dependencia de catálogo visible.
  --      Una fila aquí es REVIEW, no prueba de ausencia de dependencias.

  WITH expected(signature) AS (
    VALUES
      ('admin_approve_whatsapp_verification(uuid,text)'),
      ('admin_expire_pending_recommendations()'),
      ('admin_get_auth_users_verification_status(text)'),
      ('admin_get_last_sign_in_at(uuid[])'),
      ('admin_get_profile_presence_counts()'),
      ('admin_get_user_email(uuid)'),
      ('admin_get_user_emails(uuid[])'),
      ('admin_process_incomplete_profile_reminders(integer)'),
      ('admin_reply_support_ticket(uuid,text,boolean)'),
      ('admin_update_support_ticket(uuid,text,text,text)'),
      ('admin_update_user_credentials(uuid,text,text)'),
      ('create_anonymous_review_notification()'),
      ('enforce_candidate_inquiry_transition()'),
      ('enforce_company_plan_approval()'),
      ('enforce_job_request_transition()'),
      ('prevent_client_whatsapp_verification()'),
      ('protect_profile_verification_fields()'),
      ('protect_recommendation_identity()'),
      ('protect_verified_whatsapp_contact_method()'),
      ('validate_recommendation_anti_fraud()'),
      ('validate_recommendation_update()')
  ),
  resolved AS (
    SELECT
      signature,
      to_regprocedure('public.' || signature)::oid AS function_oid
    FROM expected
  )
  SELECT
    CASE WHEN p.oid IS NULL THEN 'BLOCK' ELSE 'REVIEW' END AS verdict,
    'No catalog dependency row was found; this is not proof of no dependencies.' AS finding,
    r.signature,
    p.oid IS NOT NULL AS function_exists,
    l.lanname AS language,
    p.prokind,
    p.proconfig
  FROM resolved AS r
  LEFT JOIN pg_proc AS p ON p.oid = r.function_oid
  LEFT JOIN pg_language AS l ON l.oid = p.prolang
  WHERE p.oid IS NULL
     OR NOT EXISTS (
       SELECT 1
       FROM pg_depend AS d
       WHERE d.classid = 'pg_proc'::regclass
         AND d.objid = p.oid
         AND d.deptype IN ('n', 'i')
     )
  ORDER BY r.signature;

  -- ============================================================================
  -- C1. Tablas y columnas mínimas para las funciones nuevas y el frontend
  -- ============================================================================

  WITH required(schema_name, table_name, column_name) AS (
    VALUES
      ('public', 'profiles', 'id'),
      ('public', 'profiles', 'provincia'),
      ('public', 'profiles', 'localidad'),
      ('public', 'profiles', 'status'),
      ('public', 'profiles', 'account_type'),
      ('public', 'profiles', 'intent'),
      ('public', 'profiles', 'photo_url'),
      ('public', 'profiles', 'resume_url'),
      ('auth', 'users', 'id'),
      ('auth', 'users', 'created_at'),
      ('auth', 'users', 'last_sign_in_at'),
      ('storage', 'buckets', 'id'),
      ('storage', 'buckets', 'name'),
      ('storage', 'buckets', 'public'),
      ('storage', 'buckets', 'file_size_limit'),
      ('storage', 'buckets', 'allowed_mime_types'),
      ('storage', 'objects', 'name'),
      ('storage', 'objects', 'bucket_id'),
      ('storage', 'objects', 'owner_id')
  ),
  available AS (
    SELECT
      c.table_schema,
      c.table_name,
      c.column_name,
      c.data_type,
      c.udt_schema,
      c.udt_name
    FROM information_schema.columns AS c
    WHERE c.table_schema IN ('public', 'auth', 'storage')
  )
  SELECT
    CASE WHEN a.column_name IS NULL THEN 'BLOCK' ELSE 'PASS' END AS verdict,
    r.schema_name,
    r.table_name,
    r.column_name,
    a.data_type,
    a.udt_schema,
    a.udt_name
  FROM required AS r
  LEFT JOIN available AS a
    ON a.table_schema = r.schema_name
   AND a.table_name = r.table_name
   AND a.column_name = r.column_name
  ORDER BY r.schema_name, r.table_name, r.column_name;

  -- ============================================================================
  -- C2. Existencia y seguridad de tablas/vistas relacionadas
  -- ============================================================================

  SELECT
    n.nspname AS schema_name,
    c.relname AS object_name,
    c.relkind,
    c.relrowsecurity AS row_security_enabled,
    c.relforcerowsecurity AS row_security_forced,
    CASE
      WHEN c.oid IS NULL THEN 'BLOCK'
      WHEN c.relkind IN ('v', 'm') THEN 'REVIEW'
      ELSE 'PASS'
    END AS verdict
  FROM (VALUES
    ('public'::name, 'profiles'::name),
    ('auth'::name, 'users'::name),
    ('storage'::name, 'buckets'::name),
    ('storage'::name, 'objects'::name)
  ) AS expected(schema_name, object_name)
  LEFT JOIN pg_namespace AS ns
    ON ns.nspname = expected.schema_name
  LEFT JOIN pg_class AS c
    ON c.relnamespace = ns.oid
   AND c.relname = expected.object_name
  LEFT JOIN pg_namespace AS n ON n.oid = c.relnamespace
  ORDER BY expected.schema_name, expected.object_name;

  -- ============================================================================
  -- C3. Triggers y dependencias de profiles/storage.objects
  -- ============================================================================

  SELECT
    'REVIEW' AS verdict,
    n.nspname AS schema_name,
    c.relname AS table_name,
    t.tgname AS trigger_name,
    pg_get_triggerdef(t.oid) AS trigger_definition,
    pg_get_function_identity_arguments(t.tgfoid) AS trigger_function_arguments,
    pn.nspname AS trigger_function_schema,
    p.proname AS trigger_function_name
  FROM pg_trigger AS t
  JOIN pg_class AS c ON c.oid = t.tgrelid
  JOIN pg_namespace AS n ON n.oid = c.relnamespace
  JOIN pg_proc AS p ON p.oid = t.tgfoid
  JOIN pg_namespace AS pn ON pn.oid = p.pronamespace
  WHERE NOT t.tgisinternal
    AND (n.nspname, c.relname) IN (
      ('public', 'profiles'),
      ('storage', 'objects')
    )
  ORDER BY n.nspname, c.relname, t.tgname;

  -- ============================================================================
  -- D1. Compatibilidad del bucket con los valores que impondría la migration
  -- ============================================================================

  SELECT
    CASE
      WHEN b.id IS NULL THEN 'REVIEW'
      WHEN b.public IS DISTINCT FROM TRUE THEN 'BLOCK'
      WHEN b.file_size_limit IS DISTINCT FROM 5242880 THEN 'REVIEW'
      WHEN b.allowed_mime_types IS DISTINCT FROM ARRAY['image/jpeg', 'image/png', 'image/webp']::text[] THEN 'REVIEW'
      ELSE 'PASS'
    END AS verdict,
    '20261025170000_profile_photos_listing_hardening.sql' AS migration,
    b.public AS current_public,
    TRUE AS proposed_public,
    b.file_size_limit AS current_file_size_limit,
    5242880 AS proposed_file_size_limit,
    b.allowed_mime_types AS current_allowed_mime_types,
    ARRAY['image/jpeg', 'image/png', 'image/webp']::text[] AS proposed_allowed_mime_types
  FROM storage.buckets AS b
  WHERE b.id = 'profile-photos'
  UNION ALL
  SELECT
    'REVIEW',
    '20261025170000_profile_photos_listing_hardening.sql',
    NULL,
    TRUE,
    NULL,
    5242880,
    NULL,
    ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
  WHERE NOT EXISTS (
    SELECT 1 FROM storage.buckets WHERE id = 'profile-photos'
  );

  -- ============================================================================
  -- D2. Compatibilidad de ACL: ausencia de firmas no puede pasar inadvertida
  -- ============================================================================

  WITH expected(signature) AS (
    VALUES
      ('admin_approve_whatsapp_verification(uuid,text)'),
      ('admin_expire_pending_recommendations()'),
      ('admin_get_auth_users_verification_status(text)'),
      ('admin_get_user_emails(uuid[])'),
      ('admin_process_incomplete_profile_reminders(integer)'),
      ('admin_reply_support_ticket(uuid,text,boolean)'),
      ('admin_update_support_ticket(uuid,text,text,text)'),
      ('create_anonymous_review_notification()'),
      ('enforce_candidate_inquiry_transition()'),
      ('enforce_company_plan_approval()'),
      ('enforce_job_request_transition()'),
      ('prevent_client_whatsapp_verification()'),
      ('protect_profile_verification_fields()'),
      ('protect_recommendation_identity()'),
      ('protect_verified_whatsapp_contact_method()'),
      ('validate_recommendation_anti_fraud()'),
      ('validate_recommendation_update()')
  ),
  resolved AS (
    SELECT signature, to_regprocedure('public.' || signature)::oid AS function_oid
    FROM expected
  )
  SELECT
    CASE WHEN count(*) FILTER (WHERE function_oid IS NULL) = 0 THEN 'PASS' ELSE 'BLOCK' END AS verdict,
    count(*) AS expected_function_count,
    count(*) FILTER (WHERE function_oid IS NULL) AS missing_function_count,
    string_agg(signature, ' | ' ORDER BY signature) FILTER (WHERE function_oid IS NULL) AS missing_signatures
  FROM resolved;

  -- ============================================================================
  -- D3. Compatibilidad de funciones nuevas y RPC legacy
  -- ============================================================================

  WITH expected(signature, migration_name, condition) AS (
    VALUES
      ('admin_get_profile_presence_counts()', '20261025181000_admin_profile_presence_counts.sql', 'profiles/status/account_type/intent/provincia'),
      ('admin_get_last_sign_in_at(uuid[])', '20261025180000_admin_last_sign_in_by_ids.sql', 'auth.users.id/last_sign_in_at'),
      ('admin_get_user_email(uuid)', '20261025182000_harden_legacy_credentials_rpc.sql', 'RPC legacy de lectura'),
      ('admin_update_user_credentials(uuid,text,text)', '20261025182000_harden_legacy_credentials_rpc.sql', 'RPC legacy de credenciales'),
      ('admin_update_user_credentials(uuid,text,text)', '20261025190000_revoke_legacy_credentials_rpc_after_cutover.sql', 'cutover frontend/Edge concluido')
  ),
  resolved AS (
    SELECT
      signature,
      migration_name,
      condition,
      to_regprocedure('public.' || signature)::oid AS function_oid
    FROM expected
  )
  SELECT
    CASE
      WHEN function_oid IS NULL
        AND migration_name IN (
          '20261025181000_admin_profile_presence_counts.sql',
          '20261025180000_admin_last_sign_in_by_ids.sql'
        ) THEN 'REVIEW'
      WHEN function_oid IS NULL THEN 'BLOCK'
      WHEN migration_name = '20261025190000_revoke_legacy_credentials_rpc_after_cutover.sql' THEN 'REVIEW'
      ELSE 'PASS'
    END AS verdict,
    signature,
    migration_name,
    condition,
    function_oid IS NOT NULL AS exists_exact_signature
  FROM resolved
  ORDER BY migration_name, signature;

  -- ============================================================================
  -- D4. Estado operativo que el catálogo no puede verificar
  -- ============================================================================

  SELECT
    'NOT_VERIFIABLE' AS verdict,
    check_name,
    required_evidence
  FROM (VALUES
    ('new_edge_functions_deployed',
     'Confirmar en Supabase Functions que admin-user-activity, admin-profile-presence y admin-update-user-credentials están desplegadas y en la versión compatible.'),
    ('frontend_cutover_complete',
     'Confirmar en Vercel que el frontend activo usa admin-update-user-credentials y envía profile_ids a admin-user-activity.'),
    ('no_legacy_clients',
     'Confirmar que no quedan bundles, previews o clientes antiguos invocando admin_update_user_credentials.'),
    ('real_storage_photo_test',
     'Probar en staging una foto válida, una sustitución y un fallo controlado de guardado sin usar datos reales.'),
    ('security_advisor_refresh',
     'Volver a consultar Supabase Security Advisor después del despliegue y guardar el resultado.')
  ) AS pending(check_name, required_evidence);

  -- ============================================================================
  -- E1. Estado del flujo de credenciales y transición segura
  -- ============================================================================

  SELECT
    CASE
      WHEN p.oid IS NULL THEN 'BLOCK'
      WHEN x.grantee = 0 OR x.grantee IN (
        SELECT oid FROM pg_roles WHERE rolname IN ('anon', 'authenticated')
      ) THEN 'REVIEW'
      ELSE 'PASS'
    END AS verdict,
    'legacy_admin_update_user_credentials' AS flow,
    CASE x.grantee
      WHEN 0 THEN 'PUBLIC'
      ELSE coalesce(pg_get_userbyid(x.grantee), 'ROLE_OID_' || x.grantee::text)
    END AS grantee,
    x.privilege_type,
    x.is_grantable
  FROM pg_proc AS p
  CROSS JOIN LATERAL aclexplode(
    coalesce(p.proacl, acldefault('f', p.proowner))
  ) AS x
  WHERE p.oid = to_regprocedure('public.admin_update_user_credentials(uuid,text,text)')::oid
  UNION ALL
  SELECT
    CASE WHEN to_regprocedure('public.admin_update_user_credentials(uuid,text,text)') IS NULL THEN 'BLOCK' ELSE 'REVIEW' END,
    'legacy_admin_update_user_credentials',
    'CATALOG',
    NULL,
    NULL
  WHERE NOT EXISTS (
    SELECT 1
    FROM pg_proc
    WHERE oid = to_regprocedure('public.admin_update_user_credentials(uuid,text,text)')::oid
  );

  -- ============================================================================
  -- F1. Inspección SQL de seguridad: funciones SECURITY DEFINER con search_path
  -- ============================================================================

  SELECT
    CASE
      WHEN p.prosecdef IS DISTINCT FROM TRUE THEN 'REVIEW'
      WHEN NOT EXISTS (
        SELECT 1
        FROM unnest(coalesce(p.proconfig, ARRAY[]::text[])) AS cfg
        WHERE cfg LIKE 'search_path=%'
      ) THEN 'BLOCK'
      WHEN EXISTS (
        SELECT 1
        FROM unnest(coalesce(p.proconfig, ARRAY[]::text[])) AS cfg
        WHERE cfg LIKE 'search_path=public%'
      ) THEN 'REVIEW'
      ELSE 'PASS'
    END AS verdict,
    n.nspname AS schema_name,
    p.proname AS function_name,
    pg_get_function_identity_arguments(p.oid) AS identity_arguments,
    p.prosecdef AS security_definer,
    p.proconfig AS configuration,
    coalesce(pg_get_userbyid(p.proowner), 'UNKNOWN') AS owner
  FROM pg_proc AS p
  JOIN pg_namespace AS n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND (
      p.prosecdef
      OR p.proname IN (
        'admin_get_last_sign_in_at',
        'admin_get_profile_presence_counts',
        'admin_get_user_email',
        'admin_get_user_emails',
        'admin_update_user_credentials'
      )
    )
  ORDER BY p.proname, identity_arguments;

  -- ============================================================================
  -- F2. Inspección SQL de seguridad: vistas y RLS relevantes
  -- ============================================================================

  SELECT
    'REVIEW' AS verdict,
    n.nspname AS schema_name,
    c.relname AS object_name,
    c.relkind,
    c.relrowsecurity AS row_security_enabled,
    c.relforcerowsecurity AS row_security_forced
  FROM pg_class AS c
  JOIN pg_namespace AS n ON n.oid = c.relnamespace
  WHERE n.nspname IN ('public', 'auth', 'storage')
    AND c.relkind IN ('r', 'v', 'm')
    AND c.relname IN ('profiles', 'users', 'objects', 'buckets')
  ORDER BY n.nspname, c.relname;

  -- F2b. Políticas RLS de objetos públicos y administrativos relevantes.

  SELECT
    'REVIEW' AS verdict,
    p.schemaname,
    p.tablename,
    p.policyname,
    p.permissive,
    p.roles,
    p.cmd,
    p.qual,
    p.with_check
  FROM pg_policies AS p
  WHERE (p.schemaname = 'public' AND p.tablename = 'profiles')
     OR (p.schemaname = 'storage' AND p.tablename IN ('objects', 'buckets'))
  ORDER BY p.schemaname, p.tablename, p.policyname;

  -- ============================================================================
  -- F3. Privilegios de tablas relevantes
  -- ============================================================================

  SELECT
    table_schema,
    table_name,
    grantee,
    privilege_type,
    is_grantable
  FROM information_schema.role_table_grants
  WHERE (table_schema, table_name) IN (
    ('public', 'profiles'),
    ('auth', 'users'),
    ('storage', 'buckets'),
    ('storage', 'objects')
  )
  AND (
    lower(grantee) IN ('public', 'anon', 'authenticated', 'service_role')
    OR lower(grantee) = lower(current_user)
  )
  ORDER BY table_schema, table_name, lower(grantee), privilege_type;

  -- ============================================================================
  -- F4. Security Advisor no se reemplaza por catálogo SQL
  -- ============================================================================

  SELECT
    'NOT_VERIFIABLE' AS verdict,
    'security_advisor_panel' AS check_name,
    'Revisar manualmente Supabase Dashboard > Security Advisor; este script no puede confirmar el estado de recomendaciones, extensiones ni configuración del proyecto.'
      AS required_evidence;
