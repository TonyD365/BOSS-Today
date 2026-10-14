import type { Metadata } from 'next'
import React from 'react'

import { StoryCard } from '@/components/site/StoryCard'
import { searchArticles } from '@/lib/data'

export const metadata: Metadata = { title: 'Search', robots: { index: false } }

type Props = { searchParams: Promise<{ q?: string }> }

export default async function SearchPage({ searchParams }: Props) {
  const query = ((await searchParams).q ?? '').trim()
  const results = await searchArticles(query)

  return (
    <div className="listing">
      <header className="listing__header">
        <h1>Search</h1>
        <form className="search-form" action="/search" role="search">
          <label className="visually-hidden" htmlFor="search-page-input">
            Search stories
          </label>
          <input id="search-page-input" type="search" name="q" defaultValue={query} autoFocus />
          <button type="submit">Search</button>
        </form>
      </header>
      {query && results.length === 0 && (
        <p className="listing__empty">No stories match “{query}”.</p>
      )}
      {results.map((article) => (
        <StoryCard key={article.id} article={article} variant="row" showSection />
      ))}
    </div>
  )
}
