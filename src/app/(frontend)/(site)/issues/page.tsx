import type { Metadata } from 'next'
import Link from 'next/link'
import React from 'react'

import { getIssues } from '@/lib/data'
import { editionLabel, editionPath, formatDate } from '@/lib/format'

export const revalidate = 600
export const metadata: Metadata = { title: 'Issues' }

export default async function IssuesPage() {
  const issues = await getIssues()

  return (
    <div className="listing">
      <header className="listing__header">
        <h1>Issues</h1>
        <p>Every edition of BOSS Today, newest first.</p>
      </header>
      {issues.length === 0 && <p className="listing__empty">No issues have been published yet.</p>}
      <ul className="issue-list">
        {issues.map((issue) => (
          <li key={issue.id}>
            <Link className="issue-list__title" href={editionPath(issue)}>
              {issue.title}
            </Link>
            <span className="issue-list__meta">
              {editionLabel(issue)} · {formatDate(issue.date)}
            </span>
            {issue.printEdition && (
              <Link className="issue-list__print" href={`${editionPath(issue)}/print`}>
                Print edition
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
