/** Pulls the video id out of any common YouTube link, or returns undefined. */
export const youtubeId = (value: string): string | undefined => {
  try {
    const url = new URL(value.trim())
    const host = url.hostname.replace(/^www\.|^m\./, '')
    let id: string | null | undefined
    if (host === 'youtu.be') id = url.pathname.split('/')[1]
    else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
      const [, kind, rest] = url.pathname.split('/')
      id =
        kind === 'watch'
          ? url.searchParams.get('v')
          : ['embed', 'shorts', 'live'].includes(kind)
            ? rest
            : null
    }
    return id && /^[\w-]{11}$/.test(id) ? id : undefined
  } catch {
    return undefined
  }
}
