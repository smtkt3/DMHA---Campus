import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'DMHA — Smart Learning App & Campus OS',
    short_name: 'DMHA OS',
    description:
      'Unified Desktop & Mobile Smart Learning App for DMHA Administration, Faculty, Guardians, and Students.',
    start_url: '/',
    display: 'standalone',
    background_color: '#0f172a',
    theme_color: '#0f172a',
    orientation: 'any',
    categories: ['education', 'productivity'],
    icons: [
      {
        src: '/favicon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
    ],
    shortcuts: [
      {
        name: 'DMHA Command Center',
        short_name: 'Dashboard',
        description: 'Open DMHA Smart Learning App',
        url: '/',
      },
    ],
  }
}
