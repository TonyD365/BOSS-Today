import type { SerializedEditorState } from '@payloadcms/richtext-lexical/lexical'
import { RichText } from '@payloadcms/richtext-lexical/react'
import React from 'react'

import { youtubeId } from '@/lib/youtube'

type Props = { content: unknown; className?: string; print?: boolean }

type YouTubeFields = { url?: string; caption?: string | null }

/** Renders a story. Videos play on the web and become a link on paper. */
export function ArticleBody({ content, className, print = false }: Props) {
  return (
    <RichText
      className={className}
      data={content as SerializedEditorState}
      converters={({ defaultConverters }) => ({
        ...defaultConverters,
        blocks: {
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
