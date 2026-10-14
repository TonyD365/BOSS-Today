import type { Metadata } from 'next'
import { Libre_Franklin, Manufacturing_Consent, Newsreader } from 'next/font/google'
import React from 'react'

import './styles.css'

const masthead = Manufacturing_Consent({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-masthead',
})
const serif = Newsreader({
  subsets: ['latin'],
  style: ['normal', 'italic'],
  variable: '--font-serif',
})
const sans = Libre_Franklin({ subsets: ['latin'], variable: '--font-sans' })

export const metadata: Metadata = {
  title: { default: 'BOSS Today', template: '%s — BOSS Today' },
  description: 'The student newspaper of Bur Oak Secondary School.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${masthead.variable} ${serif.variable} ${sans.variable}`}>
      <body>{children}</body>
    </html>
  )
}
