import { APIError } from 'payload'

import type { Banner } from '../payload-types'

/**
 * The banner lives in Cloudflare KV, not in the static pages, so putting it up
 * or taking it down never rebuilds the site. A Pages Function
 * (functions/api/banner.js) serves it to readers' browsers.
 */
export const BANNER_KEY = 'banner'

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

const kv = () => {
  const token = process.env.CLOUDFLARE_API_TOKEN?.trim()
  const account = process.env.CLOUDFLARE_ACCOUNT_ID?.trim()
  const namespace = process.env.CLOUDFLARE_KV_NAMESPACE_ID?.trim()
  if (!token || !account || !namespace) return null
  const base = (
    process.env.CLOUDFLARE_API_BASE?.trim() || 'https://api.cloudflare.com/client/v4'
  ).replace(/\/$/, '')
  return {
    url: `${base}/accounts/${account}/storage/kv/namespaces/${namespace}/values/${BANNER_KEY}`,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  }
}

export const bannerStoreConfigured = () => kv() !== null

/** Writes the banner readers see. Throws if Cloudflare can't be reached. */
export const storeBanner = async (banner: PublicBanner | null) => {
  const api = kv()
  if (!api) {
    throw new APIError(
      'The banner store is not set up: CLOUDFLARE_KV_NAMESPACE_ID, CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN are needed on Vercel.',
      503,
      undefined,
      true,
    )
  }
  let status = 0
  try {
    const response = await fetch(api.url, {
      method: 'PUT',
      headers: api.headers,
      body: JSON.stringify(banner ?? {}),
    })
    status = response.status
    if (response.ok) return
  } catch {
    // Reported below.
  }
  throw new APIError(
    `Cloudflare didn’t accept the banner${status ? ` (${status})` : ''}. Check that the API token can edit Workers KV.`,
    502,
    undefined,
    true,
  )
}
