import type { Metadata } from 'next'
import React from 'react'

export const metadata: Metadata = { title: 'Newsroom', robots: { index: false } }

/**
 * Readers use the public site on Cloudflare Pages; when PUBLIC_SITE_URL is set,
 * this address redirects there (see next.config.ts). This page only shows
 * before that is configured.
 */
export default function NewsroomHome() {
  return (
    <div className="empty">
      <h1>BOSS Today newsroom</h1>
      <p>This is where staff write and publish. The public website is built from here.</p>
      <a href="/admin">Staff sign-in</a>
    </div>
  )
}
