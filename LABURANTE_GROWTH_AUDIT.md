# LABURANTE — Auditoría y corrección de Growth Cohorts

Fecha de revisión: 1 de noviembre de 2026

## Estado de publicación

- El commit de integración preservado es `589ccabbc71c051b7d50b62f0222a93377506849` (`feat(admin): integrate weekly growth cohorts`).
- `origin/main` continúa en `3c21887a16abbc32708ee63148df015604e6d4ca`.
- La corrección queda local y todavía no se creó otro commit.
- No se hizo push, no se ejecutó SQL remoto, no se inició ningún deployment y no se modificó la Edge Function `admin-user-activity`.
- `backups/` y el stash original se conservaron.

## Correcciones aplicadas

- Retención: la primera semana registrada se trata como semana inicial parcial; la medición comienza en la semana calendario siguiente. Las semanas anteriores quedan `no_data`, la semana actual y las futuras `in_progress`, y sólo las semanas completas anteriores se miden.
- Semana y cohortes: el servidor calcula la semana en `America/Argentina/Buenos_Aires`; las fronteras de creación usan rangos de timestamp, no conversiones ambiguas.
- Rendimiento: la matriz calcula la actividad agregada en un único recorrido de `user_activity_weeks`; eliminó consultas repetidas por celda y por cohorte. La base de perfiles se materializa una vez para reutilizarla en métricas y cohortes.
- Comparación: el cálculo interno incluye una semana técnica anterior al primer período visible; `previous_size` de la primera fila ya compara contra las altas reales de esa semana, mientras que el panel sigue mostrando exactamente el rango solicitado.
- Actividad reciente: `active_last_week` devuelve `NULL` junto con `active_last_week_state = 'no_data'` cuando la última semana completa precede el inicio de la medición. El panel muestra `Sin datos` y no lo convierte en cero.
- Detalle: `admin_get_growth_cohort_members` conserva orden estable por creación de cuenta y ahora devuelve páginas de hasta 100 elementos, con `total_count`, `limit` y `offset`. El panel solicita 25 por página.
- Paginación: el conteo se calcula sobre un conjunto mínimo de cuentas Auth; `LIMIT/OFFSET` se aplican antes de cargar y calcular atributos, relaciones y actividad de perfiles.
- Activación: los criterios se alinean con la completitud operativa del frontend. La métrica pública usa `status = 'activo'`, que coincide con el directorio de personas; la exposición excepcional de empresas `oculto` en `public_profiles` es sólo identidad de contacto y no se cuenta como perfil público.
- Seguridad: las cuatro funciones usan `SECURITY DEFINER` con `SET search_path = pg_catalog, auth`, verifican `app_metadata.role = 'admin'` cuando corresponde y no consultan `user_metadata`. La tabla no recibe grants directos para `anon`, `authenticated` ni `service_role`; el acceso pasa por funciones explícitas.

## Alcance SQL

- `user_activity` no se modifica: continúa siendo la fuente de recordatorios y la Edge Function de última conexión permanece intacta.
- `user_activity_weeks` es una tabla aditiva con clave `(user_id, week_start)`, FK a `auth.users` y un índice `(week_start, user_id)`. La inserción semanal es idempotente mediante `ON CONFLICT DO NOTHING`.
- No hay backfills, `DELETE`, `UPDATE`, `TRUNCATE`, `DROP`, triggers nuevos ni consultas históricas fabricadas desde `last_sign_in_at`.
- La migración sólo agrega/redefine los RPC de cohortes y creación de cuenta, revoca sus grants públicos y concede ejecución a `authenticated`; no amplía permisos a roles de servicio.
- Las cuentas eliminadas se eliminan también de `user_activity_weeks` por `ON DELETE CASCADE`. Esto evita huérfanos, pero no conserva denominadores históricos frente a bajas.

## Verificación remota previa

La auditoría anterior del proyecto `gmctzgrzwagtsnfkdbte` confirmó el proyecto correcto, la ausencia de estos objetos nuevos y el plan Free/Nano. En esta corrección no se volvió a ejecutar SQL remoto ni se inventa que la migración esté verificada. La comparación contra el esquema real y el historial remoto siguen pendientes de acceso autenticado.

En esta etapa, Supabase CLI no está instalado en el entorno (`SUPABASE_CLI=NOT_FOUND`). Por eso no fue posible ejecutar `supabase migration list`, verificar `20261031120000` en `supabase_migrations.schema_migrations` ni usar `supabase migration repair`. La ejecución manual fue informada por el usuario, pero permanece sin verificación independiente desde las herramientas disponibles.

## Verificación local

- Suite completa: **92/92 pruebas correctas**.
- `npm run build`: **correcto**; sólo produjo advertencias informativas de chunk grande, imports dinámicos inefectivos y sourcemap de Tailwind.
- `git diff --check`: sin errores.
- El build sólo conserva advertencias informativas de chunk grande, imports dinámicos inefectivos y sourcemap de Tailwind.

## Pendientes explícitos

1. Revisar la migración contra el esquema remoto y, sólo con autorización expresa, aplicarla mediante el procedimiento oficial.
2. Recién después, decidir si se publica el commit corregido con push normal y verificar Vercel.
3. Validar funcionalmente en producción con una sesión administrativa, sin pruebas masivas.
