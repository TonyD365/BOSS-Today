import type { Banner } from '../payload-types'
import { liveStoreConfigured, putLive } from './liveStore'

/**
 * The banner lives in Cloudflare KV, not in the static pages, so putting it up
 * or taking it down never rebuilds the site (see liveStore.ts).
 */
export type PublicBanner = {
  text: string
  link: string | null
  style: 'info' | 'urgent'
  expiresAt: string | null
  updatedAt: string
}

/** What readers see: nothing at all when the text is empty. */
export const publicBanner = (doc: Partial<Banner>): PublicBanner | null =>
  doc.text?.trim()
    ? {
        text: doc.text.trim(),
        link: doc.link || null,
        style: doc.style === 'urgent' ? 'urgent' : 'info',
        expiresAt: doc.expiresAt ?? null,
        updatedAt: new Date().toISOString(),
      }
    : null

export const bannerStoreConfigured = liveStoreConfigured

/** Writes the banner readers see. Throws if Cloudflare can't be reached. */
export const storeBanner = (banner: PublicBanner | null) => putLive('banner', banner ?? {})
