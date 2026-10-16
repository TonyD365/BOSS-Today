'use client'

import { useDocumentInfo } from '@payloadcms/ui'
import React from 'react'

/** The Site Design page in the admin: a way into the designer. */
export function DesignSummary() {
  const { hasPublishedDoc, unpublishedVersionCount } = useDocumentInfo()
  return (
    <div style={{ display: 'grid', gap: 10, margin: '8px 0 24px', maxWidth: 640 }}>
      <a
        href="/admin/site-designer"
        style={{
          justifySelf: 'start',
          padding: '10px 16px',
          borderRadius: 4,
          background: 'var(--theme-elevation-800)',
          color: 'var(--theme-elevation-0)',
          fontWeight: 600,
          textDecoration: 'none',
        }}
      >
        Open the site designer →
      </a>
      <p style={{ margin: 0, fontSize: 13, opacity: 0.8 }}>
        {hasPublishedDoc
          ? unpublishedVersionCount
            ? 'There are saved changes that go live with the next issue.'
            : 'The website shows the latest saved design.'
          : 'No design is live yet; the website uses the classic front page until one is published.'}{' '}
        Earlier published designs are under the Versions tab above, where you can restore one (as a
        draft).
      </p>
    </div>
  )
}
