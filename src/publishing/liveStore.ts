import { APIError } from 'payload'

/**
 * Small pieces of the public site that change between issues (the banner,
 * Most read) live in Cloudflare Workers KV rather than in the built pages, so
 * updating them never rebuilds the site. A Pages Function (functions/api/live.js)
 * serves them to readers' browsers.
 */
export type LiveKey = 'banner' | 'mostread' | 'board' | `live:${string}`

const kv = () => {
  const token = process.env.CLOUDFLARE_API_TOKEN?.trim()
  const account = process.env.CLOUDFLARE_ACCOUNT_ID?.trim()
  const namespace = process.env.CLOUDFLARE_KV_NAMESPACE_ID?.trim()
  if (!token || !account || !namespace) return null
  const base = (
    process.env.CLOUDFLARE_API_BASE?.trim() || 'https://api.cloudflare.com/client/v4'
  ).replace(/\/$/, '')
  return {
    url: (key: LiveKey) =>
      `${base}/accounts/${account}/storage/kv/namespaces/${namespace}/values/${encodeURIComponent(key)}`,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  }
}

export const liveStoreConfigured = () => kv() !== null

/** Writes one value readers see. Throws if Cloudflare can't be reached. */
export const putLive = async (key: LiveKey, value: unknown) => {
  const api = kv()
  if (!api) {
    throw new APIError(
      'The live store is not set up: CLOUDFLARE_KV_NAMESPACE_ID, CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN are needed on Vercel.',
      503,
      undefined,
      true,
    )
  }
  let status = 0
  try {
    const response = await fetch(api.url(key), {
      method: 'PUT',
      headers: api.headers,
      body: JSON.stringify(value ?? {}),
    })
    status = response.status
    if (response.ok) return
  } catch {
    // Reported below.
  }
  throw new APIError(
    `Cloudflare didn’t accept the update${status ? ` (${status})` : ''}. Check that the API token can edit Workers KV.`,
    502,
    undefined,
    true,
  )
}
