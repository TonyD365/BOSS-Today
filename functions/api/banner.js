/**
 * Cloudflare Pages Function: GET /api/banner
 *
 * Kept for pages built before /api/live existed. New pages use /api/live.
 */
export async function onRequestGet({ env }) {
  let value = null
  try {
    value = env.BANNER ? await env.BANNER.get('banner', { cacheTtl: 60 }) : null
  } catch {
    value = null
  }
  return new Response(value || '{}', {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=60',
    },
  })
}
