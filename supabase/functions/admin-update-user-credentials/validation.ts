export type CredentialUpdateInput = {
  target_user_id?: unknown
  new_email?: unknown
  new_password?: unknown
  reason?: unknown
}
export function validateCredentialUpdate(input: CredentialUpdateInput) {
  const targetUserId = typeof input.target_user_id === 'string' ? input.target_user_id : ''
  const email = typeof input.new_email === 'string' ? input.new_email.trim().toLowerCase() : ''
  const password = typeof input.new_password === 'string' ? input.new_password : ''
  const reason = typeof input.reason === 'string' ? input.reason.trim() : ''

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(targetUserId)) {
    return { error: 'invalid_target_user' as const }
  }
  if (!email && !password) return { error: 'missing_credential_change' as const }
  if (password && password.length < 6) return { error: 'weak_password' as const }
  if (reason.length < 3 || reason.length > 1000) return { error: 'missing_audit_reason' as const }

  return {
    error: null,
    targetUserId,
    email: email || null,
    password: password || null,
    reason,
  }
}
