/**
 * Cloudflare Pages Function: GET /api/live
 *
 * Everything on the public site that changes between issues, in one response:
 * { banner, mostRead }. Values come from the BANNER KV namespace (bound in the
 * Pages project settings) and are cached at each Cloudflare location for a
 * minute, so KV is read a few times a minute at most however busy the site is.
 * Without the binding, or on any error, readers just don't see these extras.
 */
const KEYS = { banner: 'banner', mostRead: 'mostread' }
const MAX_AGE = 60

const parse = (value) => {
  try {
    return value ? JSON.parse(value) : null
  } catch {
    return null
  }
}

export async function onRequestGet({ request, env, waitUntil }) {
  const cache = typeof caches !== 'undefined' ? caches.default : null
  const cacheKey = new Request(new URL('/api/live', request.url).toString())
  const cached = cache ? await cache.match(cacheKey) : null
  if (cached) return cached

  const body = {}
  if (env.BANNER) {
    await Promise.all(
      Object.entries(KEYS).map(async ([name, key]) => {
        try {
          body[name] = parse(await env.BANNER.get(key))
        } catch {
          body[name] = null
        }
      }),
    )
  }
  const response = new Response(JSON.stringify(body), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': `public, max-age=${MAX_AGE}`,
    },
  })
  if (cache) waitUntil(cache.put(cacheKey, response.clone()))
  return response
}
