import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import React from 'react'

import { ArticleView } from '@/components/site/ArticleView'
import { getArticle } from '@/lib/data'
import { asMedia } from '@/lib/format'

export const revalidate = 600
export const generateStaticParams = () => []

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const article = await getArticle((await params).slug)
  if (!article) return {}
  const image = asMedia(article.heroImage)
  return {
    title: article.title,
    description: article.summary,
    openGraph: {
      type: 'article',
      title: article.title,
      description: article.summary,
      publishedTime: article.publishedAt ?? undefined,
      images: image?.url ? [image.sizes?.hero?.url ?? image.url] : undefined,
    },
  }
}

export default async function ArticlePage({ params }: Props) {
  const article = await getArticle((await params).slug)
  if (!article) notFound()

  return <ArticleView article={article} />
}
