import { Link } from 'react-router-dom'
import { MapPin, Briefcase, Sparkles } from 'lucide-react'
import type { ProfileWithDetails } from '@/stores/profile-store'
import { formatModality } from '@/lib/profile-format'

interface ProfileCardProps {
  profile: ProfileWithDetails
}

export default function ProfileCard({ profile }: ProfileCardProps) {
  return (
    <article className="group relative rounded-2xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)] p-6 transition-all duration-200 hover:border-[var(--color-laburante-border-hover)] hover:shadow-md hover:-translate-y-0.5 flex flex-col justify-between">
      <div>
        {/* Header: Name + Location */}
        <div className="flex items-start gap-4 mb-3">
          <div className="h-12 w-12 overflow-hidden rounded-full bg-[var(--color-laburante-surface-alt)] border border-[var(--color-laburante-border)] flex items-center justify-center font-heading font-bold text-lg text-[var(--color-laburante-text)] flex-shrink-0">
            {profile.photo_url ? <img src={profile.photo_url} alt={`Foto de ${profile.name}`} className="h-full w-full object-cover" /> : profile.name.charAt(0)}
          </div>
          <div className="min-w-0 flex-1 pr-14">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h3 className="font-heading text-lg font-bold text-[var(--color-laburante-text)] truncate group-hover:text-[var(--color-laburante-indigo)] transition-colors">
                {profile.name}
              </h3>
              {profile.whatsapp_verified && (
                <span
                  className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200"
                  title="Número de WhatsApp verificado por LABURANTE"
                >
                  ✓ Verificado
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-[var(--color-laburante-text-secondary)] mt-0.5">
              <MapPin size={13} className="text-[var(--color-laburante-accent)] flex-shrink-0" />
              <span className="truncate">{profile.localidad}, {profile.provincia}</span>
            </div>
          </div>
        </div>

        {/* Bio summary */}
        {profile.bio && (
          <p className="text-sm text-[var(--color-laburante-text-secondary)] line-clamp-2 leading-relaxed mb-4">
            {profile.bio}
          </p>
        )}

        {/* Skills / Categories Badges */}
        {profile.skills && profile.skills.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {profile.skills.slice(0, 4).map((skill, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-md bg-[var(--color-laburante-surface-alt)] text-[var(--color-laburante-text-secondary)] border border-[var(--color-laburante-border)]/60 font-medium"
              >
                {skill}
              </span>
            ))}
            {profile.skills.length > 4 && (
              <span className="text-xs px-2 py-1 text-[var(--color-laburante-text-muted)]">
                +{profile.skills.length - 4}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Footer: Modality + View Profile CTA */}
      <div className="pt-4 border-t border-[var(--color-laburante-border)]/70 flex items-center justify-between text-xs mt-2">
        <div className="flex items-center gap-1.5 text-[var(--color-laburante-text-muted)] font-medium">
          <Briefcase size={13} />
          <span>{formatModality(profile.modalidad, profile.hybrid_presencial_pct, profile.hybrid_remoto_pct)}</span>
        </div>
        <Link
          to={`/p/${profile.slug}`}
          className="font-heading font-semibold text-sm text-[var(--color-laburante-indigo)] group-hover:underline flex items-center gap-1"
        >
          Ver perfil →
        </Link>
      </div>
    </article>
  )
}
