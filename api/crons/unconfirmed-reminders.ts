/// <reference types="node" />

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const cronSecret = process.env.CRON_SECRET || ''
  const authHeader = req.headers['authorization'] || ''
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://gmctzgrzwagtsnfkdbte.supabase.co'
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

  try {
    // 1. Mantenimiento automático diario: Expirar reseñas pendientes de más de 30 días
    let expiredReviewsCount = 0
    if (serviceKey) {
      try {
        const expireRes = await fetch(`${supabaseUrl}/rest/v1/rpc/expire_pending_recommendations`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': serviceKey,
            'Authorization': `Bearer ${serviceKey}`,
          },
        })
        if (expireRes.ok) {
          expiredReviewsCount = await expireRes.json().catch(() => 0)
        }
      } catch (expireErr) {
        console.warn('Advertencia no crítica al expirar reseñas en cron diario:', expireErr)
      }
    }

    // 2. Preparar y despachar recordatorios de usuarios confirmados sin
    // actividad real. El lote y la deduplicación ocurren en PostgreSQL; este
    // cron solo reutiliza el proveedor de email ya existente.
    const inactiveReminderResult = {
      queued: 0,
      sent: 0,
      skipped: 0,
      failed: 0,
      unavailable: !serviceKey,
    }
    if (serviceKey) {
      try {
        const queueRes = await fetch(`${supabaseUrl}/rest/v1/rpc/process_inactive_user_reminders_batch`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': serviceKey,
            'Authorization': `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({ p_limit: 25 }),
        })
        const queued = await queueRes.json().catch(() => [])
        if (queueRes.ok && Array.isArray(queued)) {
          inactiveReminderResult.queued = queued.length
          for (const reminder of queued) {
            const emailRes = await fetch(`${supabaseUrl}/functions/v1/send-notification-email`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-cron-secret': cronSecret,
              },
              body: JSON.stringify({ notification_id: reminder.notification_id }),
            })
            const emailData = await emailRes.json().catch(() => ({}))
            const status = emailRes.ok && emailData?.status === 'sent'
              ? 'sent'
              : emailRes.ok && ['skipped', 'already_processing'].includes(emailData?.status)
                ? 'skipped'
                : 'failed'

            if (status === 'sent') inactiveReminderResult.sent++
            if (status === 'skipped') inactiveReminderResult.skipped++
            if (status === 'failed') inactiveReminderResult.failed++
            await fetch(`${supabaseUrl}/rest/v1/inactive_user_reminders?id=eq.${encodeURIComponent(reminder.reminder_id)}`, {
              method: 'PATCH',
              headers: {
                'Content-Type': 'application/json',
                'Prefer': 'return=minimal',
                'apikey': serviceKey,
                'Authorization': `Bearer ${serviceKey}`,
              },
              body: JSON.stringify({
                status,
                sent_at: status === 'sent' ? new Date().toISOString() : null,
                last_error: status === 'failed' ? (emailData?.error || emailData?.reason || `email_http_${emailRes.status}`) : null,
                updated_at: new Date().toISOString(),
              }),
            }).catch(() => {})
          }
        } else {
          inactiveReminderResult.failed++
        }
      } catch (inactiveErr) {
        console.warn('Advertencia no crítica en recordatorios de inactividad:', inactiveErr)
        inactiveReminderResult.failed++
      }
    }

    // 3. Procesar recordatorios de confirmación y perfiles
    const response = await fetch(`${supabaseUrl}/functions/v1/process-unconfirmed-reminders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-cron-secret': cronSecret,
        ...(serviceKey ? { 'Authorization': `Bearer ${serviceKey}` } : {}),
      },
    })

    const data = await response.json().catch(() => ({}))
    return res.status(response.status).json({
      ...data,
      expired_reviews: expiredReviewsCount,
      inactive_reminders: inactiveReminderResult,
    })
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Cron execution failed' })
  }
}
