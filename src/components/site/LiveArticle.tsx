'use client'

import { useLivePreview } from '@payloadcms/live-preview-react'
import React from 'react'

import type { Article } from '@/payload-types'

import { ArticleView } from './ArticleView'

/** Re-renders the story on every keystroke in the editor next to it. */
export function LiveArticle({ initialData }: { initialData: Article }) {
  const { data } = useLivePreview<Article>({
    initialData,
    serverURL: typeof window === 'undefined' ? '' : window.location.origin,
    depth: 2,
  })
  return <ArticleView article={data} />
}
