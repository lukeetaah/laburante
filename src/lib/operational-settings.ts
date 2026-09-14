import { useEffect, useState } from 'react'
import { SITE_CONFIG } from '@/lib/constants'
import { supabase } from '@/lib/supabase'

export interface OperationalSettings {
  officialWhatsApp: string
  officialWhatsAppFormatted: string
  source: 'remote' | 'fallback'
}

const DEFAULT_SETTINGS: OperationalSettings = {
  officialWhatsApp: SITE_CONFIG.officialWhatsApp,
  officialWhatsAppFormatted: SITE_CONFIG.officialWhatsAppFormatted,
  source: 'fallback',
}

function formatWhatsApp(value: string) {
  const digits = value.replace(/\D/g, '')
  if (digits === '5491178202409') return '+54 9 11 7820-2409'
  return digits ? `+${digits}` : SITE_CONFIG.officialWhatsAppFormatted
}

export async function getOperationalSettings(): Promise<OperationalSettings> {
  try {
    const { data, error } = await (supabase.from('admin_settings') as any)
      .select('key, value')
      .in('key', ['official_whatsapp'])

    if (error || !data) return DEFAULT_SETTINGS

    const byKey = new Map((data as any[]).map((item) => [item.key, item.value]))
    const officialWhatsApp = String(byKey.get('official_whatsapp') || '').replace(/\D/g, '')
    if (!officialWhatsApp) return DEFAULT_SETTINGS
    const settings = {
      officialWhatsApp,
      officialWhatsAppFormatted: formatWhatsApp(officialWhatsApp),
      source: 'remote' as const,
    }
    return settings
  } catch {
    return DEFAULT_SETTINGS
  }
}

export async function saveOperationalSetting(key: 'official_whatsapp', value: string) {
  const cleanValue = value.replace(/\D/g, '')
  const { error } = await (supabase.from('admin_settings') as any).upsert({
    key,
    value: cleanValue,
    description: 'Numero oficial usado para verificaciones y contacto administrativo por WhatsApp.',
    is_public: true,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'key' })
  return { error }
}

export function useOperationalSettings() {
  const [settings, setSettings] = useState<OperationalSettings>(DEFAULT_SETTINGS)

  useEffect(() => {
    let active = true
    getOperationalSettings().then((nextSettings) => {
      if (active) setSettings(nextSettings)
    })
    return () => { active = false }
  }, [])

  return settings
}
