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
            <a href={`/author/${author.slug}`}>{author.name}</a>
          ) : (
            author.name
          )}
        </React.Fragment>
      ))}
    </span>
  )
}
