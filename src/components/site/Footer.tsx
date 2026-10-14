import Link from 'next/link'
import React from 'react'

import type { Section } from '@/payload-types'

export function Footer({ sections }: { sections: Section[] }) {
  return (
    <footer className="site-footer">
      <Link className="masthead masthead--small" href="/">
        BOSS Today
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
        <li>
          <Link href="/admin">Staff sign-in</Link>
        </li>
      </ul>
      <p>The student newspaper of Bur Oak Secondary School. Written and edited by students.</p>
    </footer>
  )
}
