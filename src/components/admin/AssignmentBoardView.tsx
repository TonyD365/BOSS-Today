import { DefaultTemplate } from '@payloadcms/next/templates'
import { Gutter } from '@payloadcms/ui'
import type { AdminViewServerProps } from 'payload'
import React from 'react'

import { RANK, rankOf } from '@/access'
import type { Article, Section, User } from '@/payload-types'

import { AssignmentBoard, type BoardCard, type Column } from './AssignmentBoard'

const idOf = (value: unknown) =>
  value && typeof value === 'object' ? Number((value as { id: unknown }).id) : Number(value)

/** Where a card sits follows its story; finished stories leave the board. */
const columnFor = (
  reporters: number[],
  story: Pick<Article, 'workflow'> | undefined,
): Column | 'done' => {
  if (!story) return reporters.length === 0 ? 'open' : 'writing'
  switch (story.workflow) {
    case 'review':
      return 'review'
    case 'approved':
      return 'waiting'
    case 'published':
    case 'withdrawn':
      return 'done'
    default:
      return 'writing'
  }
}

const STAGE: Record<string, string> = {
  draft: 'Draft',
  changes: 'Changes requested',
  review: 'In review',
  approved: 'Waiting for the next issue',
}

/** /admin/assignment-board — who is writing what, and when it is due. */
export async function AssignmentBoardView({
  initPageResult,
  params,
  searchParams,
}: AdminViewServerProps) {
  const { req, permissions, visibleEntities, locale } = initPageResult
  const user = req.user
  const rank = rankOf(user)
  const allowed = rank >= RANK.reporter

  let cards: BoardCard[] = []
  let done = 0
  let templates: { id: number; name: string; description: string | null }[] = []
  if (allowed) {
    const { payload } = req
    const [assignments, templateDocs] = await Promise.all([
      payload.find({
        collection: 'assignments',
        sort: 'deadline',
        limit: 500,
        depth: 1,
        overrideAccess: true,
      }),
      payload.find({
        collection: 'templates',
        sort: 'name',
        limit: 100,
        depth: 0,
        overrideAccess: true,
        select: { name: true, description: true },
      }),
    ])
    templates = templateDocs.docs.map(({ id, name, description }) => ({
      id,
      name,
      description: description ?? null,
    }))
    const storyIds = assignments.docs
      .map((doc) => doc.article)
      .filter(Boolean)
      .map(idOf)
    const stories = storyIds.length
      ? (
          await payload.find({
            collection: 'articles',
            where: { id: { in: storyIds } },
            draft: true,
            depth: 0,
            limit: storyIds.length,
            overrideAccess: true,
            select: { workflow: true },
          })
        ).docs
      : []
    const storyById = new Map(stories.map((story) => [story.id, story]))

    for (const doc of assignments.docs) {
      const reporters = (doc.reporters ?? []).filter(
        (person): person is User => typeof person === 'object' && person !== null,
      )
      const story = doc.article ? storyById.get(idOf(doc.article)) : undefined
      const column = columnFor(
        reporters.map((person) => person.id),
        story,
      )
      if (column === 'done') {
        done++
        continue
      }
      const section = typeof doc.section === 'object' ? (doc.section as Section | null) : null
      const editor = typeof doc.editor === 'object' ? (doc.editor as User | null) : null
      cards.push({
        id: doc.id,
        title: doc.title,
        brief: doc.brief ?? null,
        section: section ? { id: section.id, name: section.name } : null,
        reporters: reporters.map((person) => ({ id: person.id, name: person.name })),
        editor: editor ? editor.name : null,
        deadline: doc.deadline,
        storyId: story?.id ?? null,
        stage: story
          ? (STAGE[story.workflow ?? 'draft'] ?? 'Draft')
          : reporters.length
            ? 'Not started'
            : 'Unclaimed',
        column,
      })
    }
    cards = cards.sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
  }

  return (
    <DefaultTemplate
      i18n={req.i18n}
      locale={locale}
      params={params}
      payload={req.payload}
      permissions={permissions}
      searchParams={searchParams}
      user={user ?? undefined}
      visibleEntities={visibleEntities}
    >
      <Gutter>
        {allowed ? (
          <AssignmentBoard
            cards={cards}
            done={done}
            me={Number(user!.id)}
            isEditor={rank >= RANK.editor}
            templates={templates}
          />
        ) : (
          <p style={{ marginTop: 40 }}>Only newsroom staff can see the assignment board.</p>
        )}
      </Gutter>
    </DefaultTemplate>
  )
}
