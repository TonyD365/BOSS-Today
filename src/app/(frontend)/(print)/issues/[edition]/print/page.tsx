import config from '@payload-config'
import type { Metadata } from 'next'
import { headers } from 'next/headers'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import React from 'react'

import { RANK, rankOf } from '@/access'
import { PAPER, PrintEdition } from '@/components/print/PrintEdition'
import { PrintButton } from '@/components/site/PrintButton'
import { getIssue, getSettings, getStaffBox, issueStories } from '@/lib/data'
import { editionPath } from '@/lib/format'

import '@/components/print/print.css'

export const metadata: Metadata = { title: 'Print edition', robots: { index: false } }

type Props = { params: Promise<{ edition: string }> }

/**
 * The newsroom's proof of an issue's print edition. Readers get the PDF from
 * the public site, which is generated when Cloudflare builds it.
 */
export default async function PrintEditionPage({ params }: Props) {
  const { edition } = await params

  // Staff can proof an issue before it is published; readers only get published ones.
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await headers() })
  const isStaff = rankOf(user) >= RANK.reporter

  const issue = await getIssue(edition, { includeDrafts: isStaff })
  if (!issue || (!issue.printEdition && !isStaff)) notFound()

  const [settings, staff] = await Promise.all([
    getSettings(),
    issue.showStaffBox !== false ? getStaffBox() : Promise.resolve([]),
  ])
  const paperSize = issue.paperSize ?? 'letter'

  return (
    <PrintEdition
      issue={issue}
      stories={issueStories(issue, isStaff)}
      siteName={settings.siteName}
      staff={staff}
      toolbar={
        <>
          <Link href={editionPath(issue)}>← Back to the issue</Link>
          <span>
            {issue._status !== 'published' && <strong>Draft proof · </strong>}
            {paperSize.toUpperCase()} · {PAPER[paperSize].columns} columns
          </span>
          <span className="print-toolbar__actions">
            <PrintButton />
          </span>
        </>
      }
    />
  )
}
