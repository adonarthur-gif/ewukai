import type {
  Metadata,
} from 'next'

import { Suspense } from 'react'

import {
  Geist,
  Geist_Mono,
} from 'next/font/google'

import './globals.css'

import AppNavigationServer from '@/components/app-navigation-server'
import ServiceWorkerRegister from '@/components/pwa/service-worker-register'

const geistSans =
  Geist({
    variable:
      '--font-geist-sans',

    subsets: [
      'latin',
    ],
  })

const geistMono =
  Geist_Mono({
    variable:
      '--font-geist-mono',

    subsets: [
      'latin',
    ],
  })

export const metadata:
  Metadata = {
    title: {
      default:
        'EWUKAI',

      template:
        '%s | EWUKAI',
    },

    description:
      'Plateforme de gestion des mutuelles, associations, membres, cotisations et recouvrements.',
  }

export default function RootLayout({
  children,
}: Readonly<{
  children:
    React.ReactNode
}>) {
  return (
    <html
      lang="fr"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >

      <body className="flex min-h-full flex-col bg-slate-50 text-slate-900">

        <ServiceWorkerRegister />

        <Suspense
          fallback={
            <div
              aria-hidden="true"
              className="h-16 shrink-0 border-b border-slate-200 bg-white"
            />
          }
        >
          <AppNavigationServer />
        </Suspense>

        <div className="min-h-0 flex-1">
          {children}
        </div>

      </body>

    </html>
  )
}