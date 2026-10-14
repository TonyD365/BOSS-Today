import Link from 'next/link'
import React from 'react'

import type { Author } from '@/lib/author'

export function Byline({ authors, linked = true }: { authors: Author[]; linked?: boolean }) {
  if (authors.length === 0) return null
  return (
    <span className="byline">
      By{' '}
      {authors.map((author, index) => (
        <React.Fragment key={author.id}>
          {index > 0 && (index === authors.length - 1 ? ' and ' : ', ')}
          {linked && author.slug ? (
            <Link href={`/author/${author.slug}`}>{author.name}</Link>
          ) : (
            author.name
          )}
        </React.Fragment>
      ))}
    </span>
  )
}
