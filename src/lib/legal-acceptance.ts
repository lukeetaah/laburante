import { supabase } from './supabase'
import { CURRENT_TERMS_VERSION } from './constants'
import { captureAppError } from './sentry'

export interface LegalAcceptanceRecord {
  id?: string
  user_id: string
  terms_version: string
  is_of_legal_age: boolean
  accepted_at: string
}

/**
 * Verifica si un usuario autenticado ya aceptó la versión vigente de los Términos y Condiciones.
 * Comprueba primero la tabla legal_acceptances, y como fallback de alta compatibilidad antes
 * de correr la migración, examina user_metadata.
 */
export async function checkUserTermsAcceptance(
  userId: string,
  userMetadata?: Record<string, any>
): Promise<{ accepted: boolean; version?: string }> {
  if (!userId) return { accepted: false }

  try {
    const { data, error } = await (supabase.from('legal_acceptances') as any)
      .select('terms_version, is_of_legal_age, accepted_at')
      .eq('user_id', userId)
      .eq('terms_version', CURRENT_TERMS_VERSION)
      .maybeSingle()

    if (!error && data) {
      return { accepted: Boolean(data.is_of_legal_age), version: data.terms_version }
    }

    // Fallback: verificar si en user_metadata ya se registró la versión vigente
    if (userMetadata) {
      const metaVersion = userMetadata.terms_accepted_version || userMetadata.legal_terms_version
      const metaAge = userMetadata.is_of_legal_age
      if (metaVersion === CURRENT_TERMS_VERSION && metaAge === true) {
        return { accepted: true, version: metaVersion }
      }
    }

    return { accepted: false }
  } catch (err) {
    console.warn('checkUserTermsAcceptance exception:', err)
    // Fallback a metadata en caso de error de conexión o tabla aún no migrada
    if (userMetadata?.terms_accepted_version === CURRENT_TERMS_VERSION && userMetadata?.is_of_legal_age === true) {
      return { accepted: true, version: userMetadata.terms_accepted_version }
    }
    return { accepted: false }
  }
}

/**
 * Persiste la evidencia de aceptación de Términos y Condiciones y declaración de mayoría de edad.
 * Guarda en la tabla legal_acceptances y sincroniza user_metadata en auth.
 */
export async function recordLegalAcceptance(
  userId: string,
  termsVersion: string = CURRENT_TERMS_VERSION
): Promise<{ success: boolean; error?: string }> {
  if (!userId) return { success: false, error: 'Usuario no identificado' }

  try {
    const payload = {
      user_id: userId,
      terms_version: termsVersion,
      is_of_legal_age: true,
      accepted_at: new Date().toISOString(),
    }

    // 1. Intentar insertar en la tabla dedicada
    const { error: dbError } = await (supabase.from('legal_acceptances') as any)
      .upsert(payload, { onConflict: 'user_id,terms_version' })

    if (dbError) {
      console.warn('Could not insert into legal_acceptances table (might be pending migration):', dbError.message)
    }

    // 2. Persistir en user_metadata como respaldo inmutable en auth
    try {
      await supabase.auth.updateUser({
        data: {
          terms_accepted_version: termsVersion,
          terms_accepted_at: new Date().toISOString(),
          is_of_legal_age: true,
        },
      })
    } catch (metaErr) {
      console.warn('Failed to update user_metadata for legal acceptance:', metaErr)
    }

    return { success: true }
  } catch (err: any) {
    captureAppError(err, 'record_legal_acceptance')
    return { success: false, error: err?.message || 'Error al guardar la aceptación legal' }
  }
}
