import React from 'react'

import type { SiteSettings } from '@/lib/data'
import type { Section } from '@/payload-types'

type Props = {
  sections: Pick<Section, 'id' | 'name' | 'slug'>[]
  settings: Pick<SiteSettings, 'siteName' | 'tagline' | 'footerNote' | 'socialLinks' | 'about'>
  /** Where staff sign in; the public site lives on a different host from the admin. */
  staffUrl?: string
}

export function Footer({ sections, settings, staffUrl = '/admin' }: Props) {
  return (
    <footer className="site-footer">
      <a className="masthead masthead--small" href="/">
        {settings.siteName}
      </a>
      <ul>
        {sections.map((section) => (
          <li key={section.id}>
            <a href={`/section/${section.slug}`}>{section.name}</a>
          </li>
        ))}
        <li>
          <a href="/issues">Issues</a>
        </li>
        {settings.about && (
          <li>
            <a href="/about">About</a>
          </li>
        )}
        {(settings.socialLinks ?? []).map((link) => (
          <li key={link.url}>
            <a href={link.url} rel="noreferrer" target="_blank">
              {link.label}
            </a>
          </li>
        ))}
        <li>
          <a href={staffUrl}>Staff sign-in</a>
        </li>
      </ul>
      <p>
        {settings.tagline} {settings.footerNote}
      </p>
    </footer>
  )
}
