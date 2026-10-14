import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import React from 'react'

import { ArticleBody } from '@/components/site/ArticleBody'
import { getSettings } from '@/lib/data'

export const revalidate = 600

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings()
  return { title: 'About', description: settings.tagline }
}

export default async function AboutPage() {
  const settings = await getSettings()
  if (!settings.about) notFound()

  return (
    <article className="article">
      <header className="article__header">
        <h1>About {settings.siteName}</h1>
        <p className="article__summary">{settings.tagline}</p>
      </header>
      <ArticleBody className="article__body" content={settings.about} />
    </article>
  )
}
