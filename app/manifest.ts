import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'EWUKAI - Gestion des organisations',
    short_name: 'EWUKAI',
    description: 'Plateforme de gestion des mutuelles, associations, ONG et organisations.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#F8FAFC',
    theme_color: '#047857',
    icons: [
      {
        src: '/branding/ewukai-mark-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/branding/ewukai-mark-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  }
}
