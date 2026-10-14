import { APIError, type Endpoint, type Payload, type PayloadRequest } from 'payload'

import { canPublishIssues, hasPermission } from '../access'
import { audit } from '../hooks/audit'
import {
  assertDeployBudget,
  deploysThisMonth,
  ISSUE_DEPLOY_LIMIT,
  triggerDeploy,
} from '../publishing/deploy'

const json = (body: unknown, status = 200) => Response.json(body, { status })

/** What the publisher signs. Stored word for word with their name and the time. */
export const DECLARATION =
  'I have read every story in this issue in full and checked it for accuracy, fairness, privacy and school policy. I am responsible for publishing it.'

const errorResponse = (error: unknown) =>
  json(
    { message: error instanceof Error ? error.message : 'Something went wrong.' },
    error instanceof APIError ? error.status : 400,
  )

type WaitingStory = {
  id: number
  title: string
  section: string | null
  authors: string[]
  updatedAt: string
  inIssue: boolean
  live: boolean
}

/** Everything that the next issue will put on the public site. */
export const pendingChanges = async (
  payload: Payload,
  issueId?: number | string,
  req?: PayloadRequest,
) => {
  const [articles, sections, frontPage, settings, issue] = await Promise.all([
    payload.find({
      collection: 'articles',
      draft: true,
      where: { workflow: { equals: 'approved' } },
      depth: 1,
      limit: 500,
      sort: 'updatedAt',
      overrideAccess: true,
      req,
      select: { title: true, section: true, authors: true, updatedAt: true, _status: true },
    }),
    payload.find({
      collection: 'sections',
      draft: true,
      where: { _status: { equals: 'draft' } },
      limit: 100,
      overrideAccess: true,
      req,
    }),
    payload.findGlobal({ slug: 'front-page', draft: true, depth: 0, overrideAccess: true, req }),
    payload.findGlobal({ slug: 'settings', draft: true, depth: 0, overrideAccess: true, req }),
    issueId
      ? payload.findByID({
          collection: 'issues',
          id: issueId,
          draft: true,
          depth: 0,
          overrideAccess: true,
          req,
        })
      : Promise.resolve(undefined),
  ])

  const inIssue = new Set(
    (issue?.stories ?? []).map((story) =>
      String(typeof story.article === 'object' ? story.article?.id : story.article),
    ),
  )

  const stories: WaitingStory[] = articles.docs.map((article) => ({
    id: article.id,
    title: article.title,
    section: typeof article.section === 'object' ? (article.section?.name ?? null) : null,
    authors: (article.authors ?? []).map((author) =>
      typeof author === 'object' ? author.name : `#${author}`,
    ),
    updatedAt: article.updatedAt,
    inIssue: inIssue.has(String(article.id)),
    live: article._status === 'published',
  }))

  return {
    issue,
    stories,
    sections: sections.docs.map((section) => ({
      id: section.id,
      name: section.name,
      updatedAt: section.updatedAt,
    })),
    frontPage: frontPage._status === 'draft',
    settings: settings._status === 'draft',
  }
}

const canManageIssue = (user: unknown) => canPublishIssues(user) || hasPermission(user, 'print')

/** GET /api/issues/:id/review — the checklist shown before publishing. */
export const issueReviewEndpoint: Endpoint = {
  path: '/:id/review',
  method: 'get',
  handler: async (req) => {
    if (!canPublishIssues(req.user)) return json({ message: 'You need the Issue permission.' }, 403)
    try {
      const pending = await pendingChanges(req.payload, req.routeParams?.id as string, req)
      if (!pending.issue) return json({ message: 'Issue not found.' }, 404)
      return json({
        issue: {
          id: pending.issue.id,
          title: pending.issue.title,
          volume: pending.issue.volume,
          number: pending.issue.number,
          printEdition: pending.issue.printEdition,
          published: pending.issue._status === 'published',
        },
        stories: pending.stories,
        sections: pending.sections,
        frontPage: pending.frontPage,
        settings: pending.settings,
        deploys: { used: await deploysThisMonth(req.payload, req), limit: ISSUE_DEPLOY_LIMIT },
        checked: (
          await req.payload.find({
            collection: 'issue-checks',
            where: {
              and: [
                { issue: { equals: pending.issue.id } },
                { checkedBy: { equals: req.user!.id } },
                { kind: { equals: 'checked' } },
              ],
            },
            limit: 0,
            pagination: false,
            depth: 0,
            overrideAccess: true,
            req,
          })
        ).docs.map((check) => ({
          article: typeof check.article === 'object' ? check.article?.id : check.article,
          version: check.articleVersion,
          at: check.createdAt,
        })),
        declaration: DECLARATION,
      })
    } catch (error) {
      return errorResponse(error)
    }
  },
}

/** POST /api/issues/:id/add-waiting — adds every approved story not yet in the issue. */
export const issueAddWaitingEndpoint: Endpoint = {
  path: '/:id/add-waiting',
  method: 'post',
  handler: async (req) => {
    if (!canManageIssue(req.user))
      return json({ message: 'You need the Issue or Print permission.' }, 403)
    try {
      const pending = await pendingChanges(req.payload, req.routeParams?.id as string, req)
      if (!pending.issue) return json({ message: 'Issue not found.' }, 404)
      const toAdd = pending.stories.filter((story) => !story.inIssue)
      if (toAdd.length > 0) {
        await req.payload.update({
          collection: 'issues',
          id: pending.issue.id,
          draft: true,
          req,
          overrideAccess: true,
          context: { draftSave: true },
          data: {
            stories: [
              ...(pending.issue.stories ?? []).map((story) => ({
                ...story,
                article: typeof story.article === 'object' ? story.article?.id : story.article,
              })),
              ...toAdd.map((story) => ({
                article: story.id,
                width: 'column' as const,
                showImage: true,
              })),
            ],
          },
        })
      }
      return json({ ok: true, added: toAdd.length })
    } catch (error) {
      return errorResponse(error)
    }
  },
}

/**
 * POST /api/issues/:id/check  { article, updatedAt, action: 'checked' | 'sent-back', note? }
 *
 * Records, at server time, that the signed-in publisher read and ticked one
 * story (or sent it back). Sending back also returns the story to its reporter.
 */
export const issueCheckEndpoint: Endpoint = {
  path: '/:id/check',
  method: 'post',
  handler: async (req) => {
    const user = req.user
    if (!user || !canPublishIssues(user))
      return json({ message: 'You need the Issue permission.' }, 403)
    const issueId = req.routeParams?.id as string
    const body = (req.json ? await req.json().catch(() => ({})) : {}) as {
      article?: number | string
      updatedAt?: string
      action?: 'checked' | 'sent-back'
      note?: string
    }
    const note = typeof body.note === 'string' ? body.note.trim().slice(0, 2000) : ''

    try {
      const pending = await pendingChanges(req.payload, issueId, req)
      if (!pending.issue) return json({ message: 'Issue not found.' }, 404)
      if (pending.issue._status === 'published')
        return json({ message: 'This issue is already published.' }, 409)
      const story = pending.stories.find((item) => String(item.id) === String(body.article))
      if (!story) return json({ message: 'That story is no longer waiting for this issue.' }, 409)
      if (story.updatedAt !== body.updatedAt) {
        return json(
          { message: 'This story changed since you opened the list. Reload and read it again.' },
          409,
        )
      }

      if (body.action === 'sent-back') {
        if (!note) return json({ message: 'Say what needs fixing.' }, 400)
        await req.payload.update({
          collection: 'articles',
          id: story.id,
          data: { workflow: 'changes', reviewNotes: note },
          draft: true,
          req,
          overrideAccess: true,
          context: { workflowAction: 'return', workflowNote: note, draftSave: true },
        })
      }

      await req.payload.create({
        collection: 'issue-checks',
        req,
        overrideAccess: true,
        data: {
          kind: body.action === 'sent-back' ? 'sent-back' : 'checked',
          summary: `${body.action === 'sent-back' ? 'Sent back' : 'Checked'} “${story.title}” for ${pending.issue.title}`,
          issue: pending.issue.id,
          article: story.id,
          articleVersion: story.updatedAt,
          checkedBy: Number(user.id),
          note: note || null,
        },
      })
      return json({ ok: true })
    } catch (error) {
      return errorResponse(error)
    }
  },
}

/**
 * POST /api/issues/:id/publish  { checked: [{ id, updatedAt }], structureChecked }
 *
 * The publisher must have read and ticked every waiting story; anything changed
 * after it was ticked has to be checked again. Then everything goes live at once
 * and the public site is rebuilt.
 */
export const issuePublishEndpoint: Endpoint = {
  path: '/:id/publish',
  method: 'post',
  handler: async (req) => {
    if (!canPublishIssues(req.user)) return json({ message: 'You need the Issue permission.' }, 403)
    const body = (req.json ? await req.json().catch(() => ({})) : {}) as {
      structureChecked?: boolean
      declaration?: boolean
    }

    try {
      const pending = await pendingChanges(req.payload, req.routeParams?.id as string, req)
      const issue = pending.issue
      if (!issue) return json({ message: 'Issue not found.' }, 404)
      if (issue._status === 'published') {
        return json(
          { message: 'This issue is already published. Start a new issue for new stories.' },
          409,
        )
      }

      // Every waiting story must have been ticked by this publisher, in its current version.
      const checks = await req.payload.find({
        collection: 'issue-checks',
        where: {
          and: [
            { issue: { equals: issue.id } },
            { checkedBy: { equals: req.user!.id } },
            { kind: { equals: 'checked' } },
          ],
        },
        limit: 0,
        pagination: false,
        depth: 0,
        overrideAccess: true,
        req,
      })
      const checkedVersions = new Set(
        checks.docs.map(
          (check) =>
            `${typeof check.article === 'object' ? check.article?.id : check.article}@${check.articleVersion}`,
        ),
      )
      const unchecked = pending.stories.filter(
        (story) => !checkedVersions.has(`${story.id}@${story.updatedAt}`),
      )
      if (unchecked.length > 0) {
        return json(
          {
            message: `Read and tick every story first. Not yet checked in its current version: ${unchecked
              .map((story) => story.title)
              .join(', ')}.`,
          },
          409,
        )
      }
      const hasStructure = pending.sections.length > 0 || pending.frontPage || pending.settings
      if (hasStructure && !body.structureChecked) {
        return json({ message: 'Confirm the section, front page and settings changes too.' }, 409)
      }
      if (pending.stories.length === 0 && !hasStructure && (issue.stories ?? []).length === 0) {
        return json({ message: 'There is nothing to publish.' }, 409)
      }

      if (!body.declaration) {
        return json({ message: 'Agree to the publisher’s declaration before publishing.' }, 409)
      }

      await assertDeployBudget(req.payload, 'issue', req)

      const context = { issuePublish: true }
      for (const story of pending.stories) {
        await req.payload.update({
          collection: 'articles',
          id: story.id,
          data: { _status: 'published' },
          req,
          overrideAccess: true,
          context,
        })
      }
      for (const section of pending.sections) {
        await req.payload.update({
          collection: 'sections',
          id: section.id,
          data: { _status: 'published' },
          req,
          overrideAccess: true,
          context,
        })
      }
      if (pending.frontPage) {
        await req.payload.updateGlobal({
          slug: 'front-page',
          data: { _status: 'published' },
          req,
          overrideAccess: true,
          context,
        })
      }
      if (pending.settings) {
        await req.payload.updateGlobal({
          slug: 'settings',
          data: { _status: 'published' },
          req,
          overrideAccess: true,
          context,
        })
      }

      // The print edition keeps only stories that are now live.
      const live = await req.payload.find({
        collection: 'articles',
        where: { _status: { equals: 'published' } },
        depth: 0,
        limit: 0,
        pagination: false,
        overrideAccess: true,
        req,
        select: { title: true },
      })
      const liveIds = new Set(live.docs.map((doc) => String(doc.id)))
      await req.payload.update({
        collection: 'issues',
        id: issue.id,
        req,
        overrideAccess: true,
        context,
        data: {
          _status: 'published',
          publishedBy: Number(req.user!.id),
          publishedAt: new Date().toISOString(),
          stories: (issue.stories ?? [])
            .map((story) => ({
              ...story,
              article: typeof story.article === 'object' ? story.article?.id : story.article,
            }))
            .filter((story) => story.article && liveIds.has(String(story.article))),
        },
      })

      await req.payload.create({
        collection: 'issue-checks',
        req,
        overrideAccess: true,
        data: {
          kind: 'published',
          summary: `Published “${issue.title}” (${pending.stories.length} stories)`,
          issue: issue.id,
          checkedBy: Number(req.user!.id),
          declaration: DECLARATION,
          note:
            pending.stories
              .map((story) => `#${story.id} ${story.title} @ ${story.updatedAt}`)
              .join('\n') || null,
        },
      })

      await audit(req, {
        action: 'publish',
        summary: `Published issue “${issue.title}” with ${pending.stories.length} new or updated stories`,
        target: `issue:${issue.id}`,
      })
      const deploy = await triggerDeploy(req, { reason: 'issue', issue: issue.id })
      return json({ ok: true, published: pending.stories.length, deploy })
    } catch (error) {
      return errorResponse(error)
    }
  },
}

/** POST /api/deployments/rebuild — rebuilds the site without publishing anything new. */
export const rebuildEndpoint: Endpoint = {
  path: '/rebuild',
  method: 'post',
  handler: async (req) => {
    if (!canPublishIssues(req.user)) return json({ message: 'You need the Issue permission.' }, 403)
    try {
      const deploy = await triggerDeploy(req, { reason: 'rebuild' })
      return json({ ok: true, deploy })
    } catch (error) {
      return errorResponse(error)
    }
  },
}
