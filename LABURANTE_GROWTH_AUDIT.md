# LABURANTE — Auditoría de crecimiento y retención

Fecha de revisión: 31 de octubre de 2026

## Estado de integración

- `main` se actualizó por fast-forward desde `ae854e5` hasta `3c21887`, alineado con `origin/main`.
- No había commits locales divergentes; había 27 commits remotos pendientes.
- Los cambios locales se respaldaron antes de integrar en `backups/integration-preflight-20261031-143013` y se conservaron en `stash@{0}` (`pre-integration-20261031`).
- Los conflictos se resolvieron preservando los cambios remotos de seguridad, búsqueda, perfiles y auditoría administrativa, y reinsertando el sistema de crecimiento en el panel.
- No se ejecutaron SQL remotos ni despliegues.

## Resultado del sistema

- Adquisición: semana de creación de `auth.users.created_at`.
- Activación: fotografía actual del perfil completo, visible, WhatsApp verificado y oferta de servicios; no se presenta como conversión histórica de siete días.
- Retención: presencia autenticada registrada por semana mediante `record_my_weekly_activity()`; no usa `last_sign_in_at` como sustituto.
- W1: primera semana posterior a la semana de alta. Semanas futuras: `En curso`; semanas anteriores al comienzo de la instrumentación: `Sin datos`.
- Instrumentación: una fila máxima por usuario y semana mediante `(user_id, week_start)`, con identidad, zona horaria y semana calculadas en servidor.
- Origen: `No registrado`; el esquema auditado no conserva UTM, referidos, canal ni método de registro confiable.
- Detalle: utiliza la misma base de cohortes que la matriz, con estado actual del perfil, creación, último ingreso y actividad en la semana seleccionada.

## Integración con el panel existente

- La Edge Function `admin-user-activity` y el RPC auditado `admin_get_last_sign_in_at` quedaron intactos para el último ingreso.
- Se agregó un RPC administrativo separado, limitado por IDs y lote de 5000, para `auth.users.created_at`.
- El listado de usuarios permite ordenar por creación de cuenta reciente/antigua o último ingreso reciente/antiguo/nunca, con desempate estable.
- El análisis de cohortes se carga como módulo separado y no reemplaza los controles administrativos existentes.

## Auditoría SQL y límites

- `user_activity` no se modifica: sigue siendo la fuente de recordatorios.
- `user_activity_weeks` está aislada por RLS, sin acceso directo para `anon` ni `authenticated`; las escrituras pasan por una función `SECURITY DEFINER` autenticada.
- Las funciones administrativas verifican `app_metadata.role = 'admin'` y revocan el acceso público.
- No hay emails, cron, proveedores externos ni nuevas tablas de costos variables por usuario. El costo operativo previsto es una escritura idempotente semanal y consultas administrativas bajo demanda.
- Las cuentas eliminadas no pueden reconstruirse históricamente con el esquema existente: la relación a `auth.users` usa `ON DELETE CASCADE`. Esta limitación queda visible en el panel y debe aceptarse explícitamente antes de publicar si se necesita conservar denominadores históricos frente a bajas.
- El esquema histórico comienza en la primera semana en que se registre actividad después de aplicar la migración; no se fabrican semanas anteriores desde `last_sign_in_at`.

## Verificación local

- Suite completa: **83/83 pruebas correctas**.
- `npm run build`: **correcto**.
- `git diff --check`: **sin errores**.
- El build sólo conserva advertencias informativas preexistentes de chunk grande, imports dinámicos inefectivos y sourcemap de Tailwind.

## Bloqueo de publicación

Antes de publicar hay que verificar en el proyecto Supabase correcto el esquema, las funciones, grants, RLS y una escritura real de prueba. En este entorno no está disponible una conexión administrativa/CLI verificable al proyecto, por lo que la migración `supabase/migrations/20261031120000_weekly_growth_cohorts.sql` permanece sin aplicar y no se desplegaron funciones ni frontend.
