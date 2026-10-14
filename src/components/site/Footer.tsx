import Link from 'next/link'
import React from 'react'

import type { SiteSettings } from '@/lib/data'
import type { Section } from '@/payload-types'

export function Footer({ sections, settings }: { sections: Section[]; settings: SiteSettings }) {
  return (
    <footer className="site-footer">
      <Link className="masthead masthead--small" href="/">
        {settings.siteName}
      </Link>
      <ul>
        {sections.map((section) => (
          <li key={section.id}>
            <Link href={`/section/${section.slug}`}>{section.name}</Link>
          </li>
        ))}
        <li>
          <Link href="/issues">Issues</Link>
        </li>
        {settings.about && (
          <li>
            <Link href="/about">About</Link>
          </li>
        )}
        {(settings.socialLinks ?? []).map((link) => (
          <li key={link.id ?? link.url}>
            <a href={link.url} rel="noreferrer" target="_blank">
              {link.label}
            </a>
          </li>
        ))}
        <li>
          <Link href="/admin">Staff sign-in</Link>
        </li>
      </ul>
      <p>
        {settings.tagline} {settings.footerNote}
      </p>
    </footer>
  )
}
