import React from 'react'

import type { Media } from '@/payload-types'

type Props = { media?: Media; sizes: string; priority?: boolean; className?: string }

/** Responsive image built from the sizes generated at upload time. */
export function Picture({ media, sizes, priority, className }: Props) {
  if (!media?.url) return null
  const candidates = [media.sizes?.thumb, media.sizes?.card, media.sizes?.hero]
    .filter((size) => size?.url && size.width)
    .map((size) => `${size!.url} ${size!.width}w`)
  if (media.width) candidates.push(`${media.url} ${media.width}w`)

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className={className}
      src={media.sizes?.card?.url ?? media.url}
      srcSet={candidates.length > 0 ? candidates.join(', ') : undefined}
      sizes={sizes}
      alt={media.alt}
      width={media.width ?? undefined}
      height={media.height ?? undefined}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
    />
  )
}
