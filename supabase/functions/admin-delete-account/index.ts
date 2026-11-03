import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const SITE_URL = Deno.env.get('SITE_URL') || 'https://laburante.ar'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function cors(request: Request) {
  const origin = request.headers.get('Origin') || ''
  const allowed = origin === SITE_URL || origin === 'https://laburante.ar' || origin === 'https://www.laburante.ar' || origin.endsWith('.vercel.app')
  return {
    'Access-Control-Allow-Origin': allowed ? origin : SITE_URL,
    'Vary': 'Origin',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, baggage, sentry-trace',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store, max-age=0',
  }
}

function response(request: Request, body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: cors(request) })
}

/**
 * Enumeración recursiva y eliminación en lotes para un prefijo de Storage.
 * Mantiene offset = 0 para no saltar archivos al purgar listas dinámicas.
 */
async function cleanStorageFolder(admin: any, bucket: string, folder: string) {
  const limit = 1000

  // 1. Purgar recursivamente archivos
  while (true) {
    const { data: items, error: listError } = await admin.storage
      .from(bucket)
      .list(folder, { limit, offset: 0, sortBy: { column: 'name', order: 'asc' } })

    if (listError) {
      // Si el bucket no existe en el entorno, retornar sin bloquear
      if (listError.message?.includes('Bucket not found') || listError.status === 404) return
      throw listError
    }

    if (!items || items.length === 0) break

    const filesToRemove: string[] = []

    for (const item of items) {
      if (item.id === null) {
        // Carpeta anidada: limpiar recursivamente
        await cleanStorageFolder(admin, bucket, `${folder}/${item.name}`)
      } else {
        filesToRemove.push(`${folder}/${item.name}`)
      }
    }

    if (filesToRemove.length === 0) break

    const { error: removeError } = await admin.storage
      .from(bucket)
      .remove(filesToRemove)

    if (removeError) throw removeError
  }

  // 2. Verificación de seguridad: comprobar que no queden objetos
  const { data: remaining, error: checkError } = await admin.storage
    .from(bucket)
    .list(folder, { limit: 1, offset: 0 })

  if (!checkError && remaining && remaining.length > 0) {
    throw new Error(`La carpeta ${bucket}/${folder} todavía contiene ${remaining.length} objeto(s).`)
  }
}

Deno.serve(async (request) => {
  let stage = 'request'
  let operationId: string | null = null

  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors(request) })
  if (request.method !== 'POST') return response(request, { error: 'method_not_allowed' }, 405)
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    return response(request, { error: 'server_configuration_error' }, 503)
  }

  try {
    // 1. Autenticación y Autorización
    stage = 'authentication'
    const authorization = request.headers.get('Authorization') || ''
    if (!authorization.startsWith('Bearer ')) return response(request, { error: 'unauthorized' }, 401)

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const { data: authData, error: authError } = await userClient.auth.getUser()
    if (authError || !authData.user) return response(request, { error: 'unauthorized' }, 401)

    stage = 'authorization'
    const callerRole = (authData.user.app_metadata as Record<string, unknown>)?.role
    if (callerRole !== 'admin') {
      return response(request, { error: 'unauthorized_admin_access' }, 403)
    }

    // 2. Validación de Payload
    stage = 'body_validation'
    let body: { target_user_id?: unknown; deletion_reason?: unknown } = {}
    try {
      body = await request.json()
    } catch {
      return response(request, { error: 'invalid_json' }, 400)
    }

    const { target_user_id, deletion_reason } = body

    if (typeof target_user_id !== 'string' || !UUID_REGEX.test(target_user_id)) {
      return response(request, { error: 'invalid_target_user_id' }, 400)
    }

    if (typeof deletion_reason !== 'string' || deletion_reason.trim().length < 10) {
      return response(request, { error: 'deletion_reason_min_length_10' }, 400)
    }

    // Prevenir autoeliminación
    if (target_user_id === authData.user.id) {
      return response(request, { error: 'cannot_delete_own_admin_account' }, 400)
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    // 3. Proteger la última cuenta administradora
    const { data: targetUserObj, error: targetUserErr } = await admin.auth.admin.getUserById(target_user_id)
    if (!targetUserErr && targetUserObj?.user) {
      const isTargetAdmin = (targetUserObj.user.app_metadata as Record<string, unknown>)?.role === 'admin'
      if (isTargetAdmin) {
        // Contar administradores totales
        const { data: allUsers, error: listUsersErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
        if (!listUsersErr && allUsers?.users) {
          const adminCount = allUsers.users.filter((u: any) => u.app_metadata?.role === 'admin').length
          if (adminCount <= 1) {
            return response(request, { error: 'cannot_delete_last_admin_account' }, 400)
          }
        }
      }
    }

    // FASE 1: Preparación en PostgreSQL (idempotente)
    stage = 'db_preparation'
    const { data: prepData, error: prepError } = await admin.rpc('admin_prepare_account_deletion', {
      p_target_user_id: target_user_id,
      p_admin_user_id: authData.user.id,
      p_reason: deletion_reason.trim(),
    })

    if (prepError) {
      return response(request, { error: `Error en preparación de base de datos: ${prepError.message}`, phase: 'preparation', retryable: true }, 502)
    }

    operationId = prepData?.operation_id || null

    // FASE 2: Purga y Desacoplamiento de Storage
    stage = 'storage_cleanup'
    try {
      // 2.a. Purgar fotos de perfil en profile-photos
      await cleanStorageFolder(admin, 'profile-photos', target_user_id)

      // 2.b. Purgar documentos de perfil en profile-documents si existieran
      await cleanStorageFolder(admin, 'profile-documents', target_user_id)

      // 2.c. Desacoplar adjuntos de tickets de soporte
      // Conservar los archivos asegurando que ningún objeto retenga owner_id apuntando al usuario
      const { data: userAttachments } = await admin
        .from('support_attachments')
        .select('id, storage_path, user_id')
        .eq('user_id', target_user_id)

      if (userAttachments && userAttachments.length > 0) {
        for (const att of userAttachments) {
          const originalPath = att.storage_path
          const archivedPath = `archived/${att.id}/${originalPath.split('/').pop()}`

          // Copiar objeto usando el cliente privilegiado (service_role no asigna owner_id a usuarios)
          const { error: copyErr } = await admin.storage
            .from('support-attachments')
            .copy(originalPath, archivedPath)

          if (!copyErr) {
            // Actualizar referencia en la base de datos
            await admin
              .from('support_attachments')
              .update({ storage_path: archivedPath, user_id: null })
              .eq('id', att.id)

            // Remover el objeto original
            await admin.storage
              .from('support-attachments')
              .remove([originalPath])
          } else {
            // Si copy falla (por ejemplo mismo path o política), desvincular el user_id de la tabla
            await admin
              .from('support_attachments')
              .update({ user_id: null })
              .eq('id', att.id)
          }
        }
      }

      if (operationId) {
        await admin.rpc('admin_complete_deletion_audit', {
          p_operation_id: operationId,
          p_status: 'storage_cleared',
        })
      }
    } catch (storageErr: any) {
      if (operationId) {
        await admin.rpc('admin_complete_deletion_audit', {
          p_operation_id: operationId,
          p_status: 'failed_storage',
          p_error_details: storageErr.message || 'Fallo desconocido en Storage',
        })
      }
      return response(request, {
        error: `Fallo en limpieza de Storage: ${storageErr.message}`,
        phase: 'storage',
        operation_id: operationId,
        retryable: true,
      }, 502)
    }

    // FASE 3: Finalización en PostgreSQL (elimina perfiles públicos)
    stage = 'db_finalization'
    const { error: finalDbError } = await admin.rpc('admin_finalize_account_deletion', {
      p_target_user_id: target_user_id,
      p_operation_id: operationId,
    })

    if (finalDbError) {
      if (operationId) {
        await admin.rpc('admin_complete_deletion_audit', {
          p_operation_id: operationId,
          p_status: 'failed_db',
          p_error_details: finalDbError.message,
        })
      }
      return response(request, {
        error: `Fallo al finalizar en base de datos: ${finalDbError.message}`,
        phase: 'database',
        operation_id: operationId,
        retryable: true,
      }, 502)
    }

    // FASE 4: Eliminación Definitiva en Supabase Auth
    stage = 'auth_deletion'
    const { error: deleteAuthError } = await admin.auth.admin.deleteUser(target_user_id)

    if (deleteAuthError) {
      // Si el usuario ya no existe en Auth (por reintento o corte previo), considerarlo exitoso
      const isAlreadyGone = deleteAuthError.message?.includes('User not found') || (deleteAuthError as any).status === 404
      if (!isAlreadyGone) {
        if (operationId) {
          await admin.rpc('admin_complete_deletion_audit', {
            p_operation_id: operationId,
            p_status: 'failed_auth',
            p_error_details: deleteAuthError.message,
          })
        }
        return response(request, {
          error: `Fallo al eliminar identidad de Auth: ${deleteAuthError.message}`,
          phase: 'auth',
          operation_id: operationId,
          retryable: true,
        }, 502)
      }
    }

    // Registrar finalización exitosa
    if (operationId) {
      await admin.rpc('admin_complete_deletion_audit', {
        p_operation_id: operationId,
        p_status: 'completed',
      })
    }

    return response(request, {
      success: true,
      target_user_id,
      operation_id: operationId,
      message: 'Cuenta, identidades y dependencias eliminadas con éxito.',
    }, 200)

  } catch (err: any) {
    return response(request, {
      error: `Error no capturado en etapa ${stage}: ${err.message || 'Error desconocido'}`,
      phase: stage,
      operation_id: operationId,
      retryable: true,
    }, 500)
  }
})
