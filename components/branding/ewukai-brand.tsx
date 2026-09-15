import Image from 'next/image'
import Link from 'next/link'

// ============================================================
// EWUKAI
// IDENTITE DE MARQUE REUTILISABLE
// ============================================================

type EwukaiBrandProps = {
  variant?: 'compact' | 'hero'
  href?: string
  className?: string
  showTagline?: boolean
}

export default function EwukaiBrand({
  variant = 'compact',
  href = '/',
  className = '',
  showTagline = false,
}: EwukaiBrandProps) {
  const isHero = variant === 'hero'

  const content = (
    <div
      className={`inline-flex items-center ${
        isHero ? 'flex-col gap-3 text-center' : 'gap-3'
      } ${className}`}
    >
      <span
        className={`relative flex shrink-0 items-center justify-center overflow-hidden bg-white shadow-lg shadow-black/10 ring-1 ring-slate-200/80 ${
          isHero
            ? 'h-20 w-20 rounded-[1.6rem] p-1 sm:h-24 sm:w-24'
            : 'h-12 w-12 rounded-2xl p-0.5'
        }`}
      >
        <Image
          src="/branding/ewukai-mark.png"
          alt="Symbole EWUKAI"
          width={isHero ? 96 : 48}
          height={isHero ? 96 : 48}
          priority={isHero}
          className="h-full w-full object-contain"
        />
      </span>

      <span className={isHero ? 'block' : 'block text-left'}>
        <span
          className={`block font-black tracking-[0.12em] ${
            isHero
              ? 'text-xl text-white sm:text-2xl'
              : 'text-base text-slate-950'
          }`}
        >
          EWUKAI
        </span>

        {showTagline && (
          <span
            className={`mt-1 block font-semibold ${
              isHero
                ? 'text-xs text-slate-300 sm:text-sm'
                : 'text-[10px] text-slate-500'
            }`}
          >
            La plateforme de gestion des organisations
          </span>
        )}
      </span>
    </div>
  )

  if (!href) {
    return content
  }

  return (
    <Link
      href={href}
      aria-label="Retour à l’accueil EWUKAI"
      className="inline-flex"
    >
      {content}
    </Link>
  )
}
