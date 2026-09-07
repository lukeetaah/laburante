import { createClient } from '@supabase/supabase-js'

const DEFAULT_SUPABASE_URL = 'https://gmctzgrzwagtsnfkdbte.supabase.co'
const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_85aRA1-Pdo6qgj9ocOVfmQ_psmh0nFq'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY

export const supabase = createClient<any>(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  }
)
