import type { Article, Media, Section } from '@/payload-types'

import { toAuthor, type Author } from './author'

const TIME_ZONE = 'America/Toronto'

export const formatDate = (value?: string | null): string =>
  value
    ? new Intl.DateTimeFormat('en-CA', { dateStyle: 'long', timeZone: TIME_ZONE }).format(
        new Date(value),
      )
    : ''

export const articleAuthors = (article: Article): Author[] =>
  (article.authors ?? []).map(toAuthor).filter((author): author is Author => Boolean(author))

export const articleSection = (article: Article): Section | undefined =>
  typeof article.section === 'object' ? article.section : undefined

export const asMedia = (value: unknown): Media | undefined =>
  value && typeof value === 'object' ? (value as Media) : undefined

export const editionLabel = (issue: { volume: number; number: number }) =>
  `Vol. ${issue.volume}, No. ${issue.number}`

export const editionPath = (issue: { volume: number; number: number }) =>
  `/issues/${issue.volume}-${issue.number}`
