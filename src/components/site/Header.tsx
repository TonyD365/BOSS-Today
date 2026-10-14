import React from 'react'

import type { SiteSettings } from '@/lib/data'
import type { Section } from '@/payload-types'

import { Today } from './Today'

type Props = {
  sections: Pick<Section, 'id' | 'name' | 'slug'>[]
  settings: Pick<SiteSettings, 'siteName'>
}

export function Header({ sections, settings }: Props) {
  return (
    <header className="site-header">
      <div className="site-header__top">
        <div className="site-header__date">
          <Today />
          <span>Bur Oak Secondary School</span>
        </div>
        <a className="masthead" href="/" aria-label={`${settings.siteName} — home`}>
          {settings.siteName}
        </a>
        <form className="site-header__search" action="/search" role="search">
          <label className="visually-hidden" htmlFor="site-search">
            Search
          </label>
          <input id="site-search" type="search" name="q" placeholder="Search" />
        </form>
      </div>
      <nav className="site-nav" aria-label="Sections">
        <ul>
          {sections.map((section) => (
            <li key={section.id}>
              <a href={`/section/${section.slug}`}>{section.name}</a>
            </li>
          ))}
          <li>
            <a href="/issues">Issues</a>
          </li>
        </ul>
      </nav>
    </header>
  )
}
