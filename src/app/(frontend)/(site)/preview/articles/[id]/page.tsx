import config from '@payload-config'
import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import React from 'react'

import { RANK, rankOf } from '@/access'
import { LiveArticle } from '@/components/site/LiveArticle'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Preview', robots: { index: false } }

type Props = { params: Promise<{ id: string }> }

/** Staff-only preview of the latest draft, shown beside the editor. */
export default async function ArticlePreviewPage({ params }: Props) {
  const { id } = await params
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await headers() })
  if (rankOf(user) < RANK.reporter) notFound()

  const article = await payload.findByID({
    collection: 'articles',
    id,
    draft: true,
    depth: 2,
    user,
    overrideAccess: false,
    disableErrors: true,
  })
  if (!article) notFound()

  return (
    <>
      <p className="preview-banner">Preview — this is how the story will look once published.</p>
      <LiveArticle initialData={article} />
    </>
  )
}
