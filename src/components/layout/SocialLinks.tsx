function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-none stroke-current stroke-[1.8]">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" className="fill-current stroke-none" />
    </svg>
  )
}

function TikTokIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-current">
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.14V2h-3.45v13.67a2.9 2.9 0 1 1-2-2.77V9.4a6.36 6.36 0 1 0 5.45 6.27V8.26a8.16 8.16 0 0 0 4.78 1.53V6.69h-1.01Z" />
    </svg>
  )
}

const SOCIAL_LINKS = [
  {
    href: 'https://www.instagram.com/laburante.ar/',
    label: 'Instagram oficial de LABURANTE',
    Icon: InstagramIcon,
  },
  {
    href: 'https://www.tiktok.com/@laburante.ar',
    label: 'TikTok oficial de LABURANTE',
    Icon: TikTokIcon,
  },
]

export default function SocialLinks() {
  return (
    <div className="mt-5" aria-label="Redes sociales oficiales">
      <p className="text-xs font-semibold text-[var(--color-laburante-text-secondary)]">Seguinos</p>
      <div className="mt-2 flex gap-2">
        {SOCIAL_LINKS.map(({ href, label, Icon }) => (
          <a
            key={href}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={label}
            className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-xl border border-[var(--color-laburante-border)] text-[var(--color-laburante-text-secondary)] transition-colors hover:border-[var(--color-laburante-text)] hover:text-[var(--color-laburante-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-laburante-indigo)] focus-visible:ring-offset-2"
          >
            <Icon />
          </a>
        ))}
      </div>
    </div>
  )
}
