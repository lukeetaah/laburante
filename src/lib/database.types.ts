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
          account_type?: 'persona' | 'empresa'
          company_plan?: 'gratis' | 'pago'
          resume_url?: string | null
          resume_name?: string | null
          bio: string | null
          provincia: string
          localidad: string
          zona_trabajo: string | null
          disponibilidad: 'disponible' | 'ocupado' | 'no_disponible'
          modalidad: 'presencial' | 'remoto' | 'ambas'
          hybrid_presencial_pct?: number | null
          hybrid_remoto_pct?: number | null
          status: 'activo' | 'oculto' | 'suspendido' | 'eliminado'
          whatsapp_verified?: boolean
          whatsapp_verified_at?: string | null
          notify_whatsapp?: boolean
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
          status: 'pendiente' | 'visible' | 'oculto' | 'reportado'
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
      job_requests: {
        Row: {
          id: string
          client_id: string | null
          client_name: string
          client_contact: string
          client_location: string | null
          profile_id: string
          title: string
          description: string
          urgency: 'urgente' | 'esta_semana' | 'proximos_dias' | 'a_coordinar'
          preferred_date: string | null
          photos: string[]
          status: 'solicitado' | 'presupuestado' | 'aceptado' | 'en_progreso' | 'completado' | 'cancelado'
          budget_amount: string | null
          budget_details: string | null
          budget_estimated_time: string | null
          budget_created_at: string | null
          cancel_reason: string | null
          cancelled_by: 'cliente' | 'profesional' | null
          client_outcome: string | null
          professional_outcome: string | null
          outcome_note: string | null
          outcome_updated_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['job_requests']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['job_requests']['Insert']>
      }
      account_deletions: {
        Row: {
          id: string
          user_id: string | null
          user_email: string | null
          profile_name: string
          profile_slug: string
          reason: string
          explanation: string
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['account_deletions']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['account_deletions']['Insert']>
      }
      notifications: {
        Row: {
          id: string
          user_id: string
          title: string
          message: string
          type: 'job' | 'budget' | 'status' | 'review' | 'system'
          link: string | null
          read: boolean
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['notifications']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['notifications']['Insert']>
      }
      whatsapp_verification_requests: {
        Row: {
          id: string
          profile_id: string
          profile_name: string
          profile_slug: string
          phone_declared: string
          code: string
          status: 'pendiente' | 'aprobado' | 'rechazado'
          reviewed_at: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['whatsapp_verification_requests']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['whatsapp_verification_requests']['Insert']>
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
export type JobRequest = Database['public']['Tables']['job_requests']['Row']
export type JobRequestStatus = JobRequest['status']
export type JobRequestUrgency = JobRequest['urgency']
export type AccountDeletion = Database['public']['Tables']['account_deletions']['Row']
export type InAppNotification = Database['public']['Tables']['notifications']['Row']
export type WhatsAppVerificationRequest = Database['public']['Tables']['whatsapp_verification_requests']['Row']
