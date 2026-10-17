import type { SerializedEditorState } from '@payloadcms/richtext-lexical/lexical'
import { RichText } from '@payloadcms/richtext-lexical/react'
import React from 'react'

import { youtubeId } from '@/lib/youtube'
import type { Media } from '@/payload-types'

import { Picture } from './Picture'

type Props = { content: unknown; className?: string; print?: boolean }

type YouTubeFields = { url?: string; caption?: string | null }
type GalleryFields = { images?: (number | Media)[] | null; title?: string | null }

/** Renders a story. Videos play on the web and become a link on paper. */
export function ArticleBody({ content, className, print = false }: Props) {
  return (
    <RichText
      className={className}
      data={content as SerializedEditorState}
      converters={({ defaultConverters }) => ({
        ...defaultConverters,
        blocks: {
          gallery: ({ node }: { node: { fields: GalleryFields } }) => {
            const images = (node.fields.images ?? []).filter(
              (image): image is Media => typeof image === 'object' && Boolean(image?.url),
            )
            if (images.length === 0) return null
            // On paper, the first four in a grid; on the web, a row to swipe through.
            const shown = print ? images.slice(0, 4) : images
            return (
              <figure className={print ? 'gallery gallery--print' : 'gallery'}>
                {node.fields.title && <p className="gallery__title">{node.fields.title}</p>}
                <ol
                  className="gallery__track"
                  tabIndex={0}
                  aria-label={node.fields.title || 'Photo gallery'}
                >
                  {shown.map((image, index) => (
                    <li key={`${image.id}-${index}`} className="gallery__item">
                      <Picture media={image} sizes="(max-width: 720px) 90vw, 640px" />
                      {(image.caption || image.credit) && (
                        <span className="gallery__caption">
                          {image.caption}{' '}
                          {image.credit && <span className="credit">{image.credit}</span>}
                        </span>
                      )}
                      <span className="gallery__count">
                        {index + 1} / {images.length}
                      </span>
                    </li>
                  ))}
                </ol>
                {!print && (
                  <figcaption className="gallery__hint">
                    Swipe or scroll for more photos →
                  </figcaption>
                )}
              </figure>
            )
          },
          youtube: ({ node }: { node: { fields: YouTubeFields } }) => {
            const id = youtubeId(node.fields.url ?? '')
            if (!id) return null
            if (print) {
              return (
                <p className="video-note">
                  Video{node.fields.caption ? `: ${node.fields.caption}` : ''} — youtu.be/{id}
                </p>
              )
            }
            return (
              <figure className="video">
                <iframe
                  src={`https://www.youtube-nocookie.com/embed/${id}`}
                  title={node.fields.caption || 'YouTube video'}
                  loading="lazy"
                  allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                  referrerPolicy="strict-origin-when-cross-origin"
                />
                {node.fields.caption && <figcaption>{node.fields.caption}</figcaption>}
              </figure>
            )
          },
        },
      })}
    />
  )
}
