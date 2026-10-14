import Link from 'next/link'
import React from 'react'

import type { Section } from '@/payload-types'

import { Today } from './Today'

export function Header({ sections }: { sections: Section[] }) {
  return (
    <header className="site-header">
      <div className="site-header__top">
        <div className="site-header__date">
          <Today />
          <span>Bur Oak Secondary School</span>
        </div>
        <Link className="masthead" href="/" aria-label="BOSS Today — home">
          BOSS Today
        </Link>
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
              <Link href={`/section/${section.slug}`}>{section.name}</Link>
            </li>
          ))}
          <li>
            <Link href="/issues">Issues</Link>
          </li>
        </ul>
      </nav>
    </header>
  )
}
