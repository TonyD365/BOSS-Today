import Link from 'next/link'
import React from 'react'

import { StoryCard } from '@/components/site/StoryCard'
import { getFrontPage } from '@/lib/data'

export const revalidate = 600

export default async function HomePage() {
  const { lead, featured, latest, bySection } = await getFrontPage()

  if (!lead) {
    return (
      <div className="empty">
        <h1>The first edition is on its way.</h1>
        <p>No stories have been published yet. Staff can sign in to start writing.</p>
        <Link href="/admin">Staff sign-in</Link>
      </div>
    )
  }

  return (
    <>
      <section className="front" aria-label="Top stories">
        <div className="front__main">
          <StoryCard article={lead} variant="lead" showSection />
          {featured.length > 0 && (
            <div className="front__featured">
              {featured.map((article) => (
                <StoryCard key={article.id} article={article} showSection />
              ))}
            </div>
          )}
        </div>
        {latest.length > 0 && (
          <aside className="front__rail" aria-label="Latest">
            <h2 className="rail-title">Latest</h2>
            {latest.map((article) => (
              <StoryCard key={article.id} article={article} variant="compact" showSection />
            ))}
          </aside>
        )}
      </section>

      {bySection.map(({ section, articles }) => (
        <section className="section-block" key={section.id} aria-label={section.name}>
          <h2 className="section-block__title">
            <Link href={`/section/${section.slug}`}>{section.name}</Link>
          </h2>
          <div className="section-block__grid">
            {articles.map((article, index) => (
              <StoryCard key={article.id} article={article} showImage={index === 0} />
            ))}
          </div>
        </section>
      ))}
    </>
  )
}
