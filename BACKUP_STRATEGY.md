# Estrategia de Backups y Resguardo de Datos — LABURANTE

## A. Diagnóstico de la Infraestructura Actual
* **Plan Supabase**: **Free Tier** (`lukeetaah@gmail.com's Org Free`).
* **Backups Nativos**:
  * Supabase en plan Free realiza backups diarios automáticos con retención limitada a 7 días, pero gestionados internamente sin capacidad de PITR (Point-in-Time Recovery).
  * No hay acceso a dumps automáticos programados fuera de Supabase desde la UI en el plan Free.
* **Storage (`profile-assets`)**:
  * Los objetos en Supabase Storage (fotos y CVs) **NO** están incluidos en los backups de la base de datos PostgreSQL.
* **Procedimiento de contingencia**: No existía procedimiento formal de restauración externa documentado.

---

## B. Qué nos Falta
1. **Copias de seguridad independientes de Supabase**: Si el proyecto sufre suspensión, pausa por inactividad o fallo de región, los datos deben estar resguardados externamente.
2. **Resguardo de Storage**: Sincronización de los archivos de `storage.objects` (`profile-assets`).
3. **Prueba periódica de restauración**: Comprobar mensualmente que un dump puede restaurarse en una base local o de testing.

---

## C. Solución Externa de Bajo Costo Recomendada
1. **Automatización vía GitHub Actions**:
   * Workflow programado (cron nocturno `0 3 * * *`) que ejecuta Supabase CLI:
     ```bash
     npx supabase db dump --project-ref gmctzgrzwagtsnfkdbte --data-only -f backup-$(date +%F).sql
     ```
   * O mediante `pg_dump` con la cadena de conexión de Supabase (`db.gmctzgrzwagtsnfkdbte.supabase.co`).
2. **Almacenamiento Seguro**:
   * Cifrado con GPG utilizando una clave pública antes de guardar.
   * Destino: Cloudflare R2 (10 GB gratuitos al mes, sin costo de egreso) o bucket S3 privado.
   * Retención: 30 días con rotación automática.
3. **Seguridad**:
   * `DB_PASSWORD` y `SUPABASE_ACCESS_TOKEN` alojados exclusivamente en GitHub Repository Secrets.
   * Cero secretos en código ni en logs.

---

## D. Procedimiento de Restauración Paso a Paso
1. **Descarga y Descifrado**:
   ```bash
   gpg --decrypt backup-YYYY-MM-DD.sql.gpg > restore.sql
   ```
2. **Restauración en Supabase (o base local)**:
   ```bash
   # En base local o de contingencia:
   psql -h db.gmctzgrzwagtsnfkdbte.supabase.co -U postgres -d postgres -f restore.sql
   ```
3. **Validación post-restauración**:
   * Comprobar recuento de tablas: `SELECT count(*) FROM public.profiles;`
   * Verificar integridad de RLS y autenticación.

---

## E. Comprobación Periódica (Testing)
* **Frecuencia**: Primer lunes de cada mes.
* **Prueba**:
  1. Descargar el último dump.
  2. Restaurarlo en un contenedor Docker local de Supabase (`npx supabase start`).
  3. Ejecutar los tests de consulta de perfiles y login simulado.
  4. Registrar fecha y resultado en el log de infraestructura.
