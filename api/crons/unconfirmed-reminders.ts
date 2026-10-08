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

    // 2. Procesar recordatorios de confirmación y perfiles
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
    })
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Cron execution failed' })
  }
}
