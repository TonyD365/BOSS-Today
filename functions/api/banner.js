/**
 * Cloudflare Pages Function: GET /api/banner
 *
 * Returns the site banner from the BANNER KV namespace (bound in the Pages
 * project settings). The newsroom writes it; nothing here needs a rebuild.
 * Without the binding, or on any error, readers simply see no banner.
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
