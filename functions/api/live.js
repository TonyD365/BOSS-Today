/**
 * Cloudflare Pages Function: GET /api/live[?blog=slug]
 *
 * Everything on the public site that changes between issues: the banner, Most
 * read and the board (scores, calendar, live coverage list), or one live
 * coverage's updates. Values come from the BANNER KV namespace (bound in the
 * Pages project settings) and are cached at each Cloudflare location briefly,
 * so KV is read a few times a minute at most however busy the site is.
 * Without the binding, or on any error, readers just don't see these extras.
 */
const KEYS = { banner: 'banner', mostRead: 'mostread', board: 'board' }

const parse = (value) => {
  try {
    return value ? JSON.parse(value) : null
  } catch {
    return null
  }
}

const read = async (env, key) => {
  try {
    return parse(await env.BANNER.get(key))
  } catch {
    return null
  }
}

export async function onRequestGet({ request, env, waitUntil }) {
  const url = new URL(request.url)
  const blog = (url.searchParams.get('blog') || '').toLowerCase()
  if (blog && !/^[a-z0-9-]{1,100}$/.test(blog)) {
    return new Response('{}', { status: 400, headers: { 'Content-Type': 'application/json' } })
  }
  // Live coverage refreshes faster than the rest.
  const maxAge = blog ? 15 : 60
  const cache = typeof caches !== 'undefined' ? caches.default : null
  const cacheKey = new Request(
    new URL(blog ? `/api/live?blog=${blog}` : '/api/live', request.url).toString(),
  )
  const cached = cache ? await cache.match(cacheKey) : null
  if (cached) return cached

  const body = {}
  if (env.BANNER) {
    if (blog) {
      body.blog = await read(env, `live:${blog}`)
    } else {
      await Promise.all(
        Object.entries(KEYS).map(async ([name, key]) => {
          body[name] = await read(env, key)
        }),
      )
    }
  }
  const response = new Response(JSON.stringify(body), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': `public, max-age=${maxAge}`,
    },
  })
  if (cache) waitUntil(cache.put(cacheKey, response.clone()))
  return response
}
