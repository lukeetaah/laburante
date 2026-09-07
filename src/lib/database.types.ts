// Database types for Supabase — auto-generated placeholder
// Run `supabase gen types typescript` to generate real types from schema

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          name: string
          slug: string
          photo_url: string | null
          bio: string | null
          provincia: string
          localidad: string
          zona_trabajo: string | null
          disponibilidad: 'disponible' | 'ocupado' | 'no_disponible'
          modalidad: 'presencial' | 'remoto' | 'ambas'
          status: 'activo' | 'oculto' | 'suspendido' | 'eliminado'
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['profiles']['Row'], 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>
      }
      categories: {
        Row: {
          id: string
          name: string
          slug: string
          icon: string | null
          parent_id: string | null
        }
        Insert: Omit<Database['public']['Tables']['categories']['Row'], 'id'>
        Update: Partial<Database['public']['Tables']['categories']['Insert']>
      }
      profile_categories: {
        Row: {
          profile_id: string
          category_id: string
        }
        Insert: Database['public']['Tables']['profile_categories']['Row']
        Update: Partial<Database['public']['Tables']['profile_categories']['Insert']>
      }
      skills: {
        Row: {
          id: string
          profile_id: string
          name: string
        }
        Insert: Omit<Database['public']['Tables']['skills']['Row'], 'id'>
        Update: Partial<Database['public']['Tables']['skills']['Insert']>
      }
      services: {
        Row: {
          id: string
          profile_id: string
          title: string
          description: string | null
          precio_orientativo: string | null
        }
        Insert: Omit<Database['public']['Tables']['services']['Row'], 'id'>
        Update: Partial<Database['public']['Tables']['services']['Insert']>
      }
      contact_methods: {
        Row: {
          id: string
          profile_id: string
          type: 'whatsapp' | 'telefono' | 'email' | 'instagram' | 'linkedin' | 'web' | 'portfolio'
          value: string
          is_public: boolean
          consent_at: string
        }
        Insert: Omit<Database['public']['Tables']['contact_methods']['Row'], 'id'>
        Update: Partial<Database['public']['Tables']['contact_methods']['Insert']>
      }
      recommendations: {
        Row: {
          id: string
          from_user_id: string | null
          from_name: string
          to_profile_id: string
          text: string
          context: string | null
          created_at: string
          status: 'visible' | 'oculto' | 'reportado'
        }
        Insert: Omit<Database['public']['Tables']['recommendations']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['recommendations']['Insert']>
      }
      reports: {
        Row: {
          id: string
          reporter_id: string | null
          profile_id: string
          reason: 'datos_falsos' | 'spam' | 'fraude' | 'ofensivo' | 'acoso' | 'suplantacion' | 'datos_sin_autorizacion' | 'otro'
          description: string | null
          status: 'pendiente' | 'revisado' | 'resuelto'
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['reports']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['reports']['Insert']>
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}

// Helper types
export type Profile = Database['public']['Tables']['profiles']['Row']
export type Category = Database['public']['Tables']['categories']['Row']
export type ContactMethod = Database['public']['Tables']['contact_methods']['Row']
export type Recommendation = Database['public']['Tables']['recommendations']['Row']
export type Report = Database['public']['Tables']['reports']['Row']
export type Service = Database['public']['Tables']['services']['Row']
export type Skill = Database['public']['Tables']['skills']['Row']
