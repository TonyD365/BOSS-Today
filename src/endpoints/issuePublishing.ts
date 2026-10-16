import {
  APIError,
  commitTransaction,
  type Endpoint,
  initTransaction,
  killTransaction,
  type Payload,
  type PayloadRequest,
} from 'payload'

import { canPublishIssues, hasPermission } from '../access'
import { audit } from '../hooks/audit'
import {
  assertDeployBudget,
  deploysThisMonth,
  ISSUE_DEPLOY_LIMIT,
  triggerDeploy,
} from '../publishing/deploy'
import { bannerStoreConfigured, publicBanner, storeBanner } from '../publishing/banner'
import { getProgress } from '../publishing/progress'
import {
  commentProblem,
  describeProblems,
  publishingProblems,
  unresolvedComments,
} from '../publishing/readiness'

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
  /** Why it can't be published yet, if anything. */
  problems: string[]
}

/** Everything that the next issue will put on the public site. */
export const pendingChanges = async (
  payload: Payload,
  issueId?: number | string,
  req?: PayloadRequest,
) => {
  const [articles, sections, tags, pages, frontPage, settings, banner, design, issue] =
    await Promise.all([
      payload.find({
        collection: 'articles',
        draft: true,
        where: { workflow: { equals: 'approved' } },
        depth: 1,
        limit: 500,
        sort: 'updatedAt',
        overrideAccess: true,
        req,
        select: {
          title: true,
          summary: true,
          content: true,
          section: true,
          authors: true,
          updatedAt: true,
          _status: true,
        },
      }),
      payload.find({
        collection: 'sections',
        draft: true,
        where: { _status: { equals: 'draft' } },
        limit: 100,
        overrideAccess: true,
        req,
      }),
      payload.find({
        collection: 'tags',
        draft: true,
        where: { _status: { equals: 'draft' } },
        limit: 500,
        overrideAccess: true,
        req,
      }),
      payload.find({
        collection: 'pages',
        draft: true,
        where: { _status: { equals: 'draft' } },
        limit: 100,
        depth: 0,
        overrideAccess: true,
        req,
        select: { title: true, updatedAt: true, design: true },
      }),
      payload.findGlobal({ slug: 'front-page', draft: true, depth: 0, overrideAccess: true, req }),
      payload.findGlobal({ slug: 'settings', draft: true, depth: 0, overrideAccess: true, req }),
      payload.findGlobal({ slug: 'banner', draft: true, depth: 0, overrideAccess: true, req }),
      payload.findGlobal({ slug: 'site-design', draft: true, depth: 0, overrideAccess: true, req }),
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

  const openComments = await unresolvedComments(
    payload,
    articles.docs.map((article) => article.id),
    req,
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
    problems: [
      ...publishingProblems(article),
      ...(openComments.get(String(article.id))
        ? [commentProblem(openComments.get(String(article.id))!)]
        : []),
    ],
  }))

  return {
    issue,
    stories,
    sections: sections.docs.map((section) => ({
      id: section.id,
      name: section.name,
      updatedAt: section.updatedAt,
    })),
    tags: tags.docs.map((tag) => ({ id: tag.id, name: tag.name, updatedAt: tag.updatedAt })),
    frontPage: frontPage._status === 'draft',
    settings: settings._status === 'draft',
    banner: banner._status === 'draft',
    design: design._status === 'draft',
    /** The desktop canvas changed after someone last looked at the phone layout. */
    pages: pages.docs.map((page) => ({
      id: page.id,
      title: page.title,
      updatedAt: page.updatedAt,
    })),
    /** A canvas changed on desktop after someone last looked at its phone layout. */
    designPhoneUnchecked:
      (design._status === 'draft' &&
        [design.design, design.header, design.footer].some(phoneUnchecked)) ||
      pages.docs.some((page) => phoneUnchecked(page.design)),
  }
}

const phoneUnchecked = (value: unknown) => {
  const d = value as { desktopChangedAt?: string | null; phoneCheckedAt?: string | null } | null
  return Boolean(
    d?.desktopChangedAt && (!d.phoneCheckedAt || d.phoneCheckedAt < d.desktopChangedAt),
  )
}

/** Sections, tags, pages, front page, settings or banner changes waiting to go live. */
const hasStructureChanges = (pending: Awaited<ReturnType<typeof pendingChanges>>) =>
  pending.sections.length > 0 ||
  pending.tags.length > 0 ||
  pending.pages.length > 0 ||
  pending.frontPage ||
  pending.settings ||
  pending.banner ||
  pending.design

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
        tags: pending.tags,
        pages: pending.pages,
        frontPage: pending.frontPage,
        settings: pending.settings,
        banner: pending.banner,
        design: pending.design,
        designPhoneUnchecked: pending.designPhoneUnchecked,
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
      if (body.action !== 'sent-back' && story.problems.length > 0) {
        return json(
          {
            message: `“${story.title}” can’t be published yet: ${describeProblems(story.problems)} Send it back or fix it first.`,
          },
          409,
        )
      }
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
      const hasStructure = hasStructureChanges(pending)
      if (hasStructure && !body.structureChecked) {
        return json({ message: 'Confirm the other changes going live too.' }, 409)
      }
      if (pending.stories.length === 0 && !hasStructure && (issue.stories ?? []).length === 0) {
        return json({ message: 'There is nothing to publish.' }, 409)
      }

      if (!body.declaration) {
        return json({ message: 'Agree to the publisher’s declaration before publishing.' }, 409)
      }

      // Check everything before changing anything, so an issue never half-publishes.
      const notReady = pending.stories.filter((story) => story.problems.length > 0)
      if (notReady.length > 0) {
        return json(
          {
            message: `Nothing was published. Fix or send back: ${notReady
              .map((story) => `“${story.title}” (${describeProblems(story.problems)})`)
              .join(' ')}`,
          },
          409,
        )
      }

      if (issue.printEdition && (issue.stories ?? []).length === 0) {
        return json(
          {
            message:
              'Nothing was published. The print edition has no stories: open the issue and click “Add all waiting stories”, or untick “Print edition” for a web-only issue.',
          },
          409,
        )
      }

      if (pending.banner && !bannerStoreConfigured()) {
        return json(
          {
            message:
              'Nothing was published. A banner change is waiting, but the banner store (Cloudflare KV) is not set up yet. Ask the super admin to set it up.',
          },
          409,
        )
      }

      await assertDeployBudget(req.payload, 'issue', req)

      let bannerToStore: ReturnType<typeof publicBanner> | undefined

      // All of the changes below succeed together or not at all.
      const ownsTransaction = await initTransaction(req)
      try {
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
        for (const tag of pending.tags) {
          await req.payload.update({
            collection: 'tags',
            id: tag.id,
            data: { _status: 'published' },
            req,
            overrideAccess: true,
            context,
          })
        }
        for (const page of pending.pages) {
          await req.payload.update({
            collection: 'pages',
            id: page.id,
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
        if (pending.design) {
          await req.payload.updateGlobal({
            slug: 'site-design',
            data: { _status: 'published' },
            req,
            overrideAccess: true,
            context,
          })
        }
        const banner = pending.banner
          ? await req.payload.updateGlobal({
              slug: 'banner',
              data: { _status: 'published' },
              req,
              overrideAccess: true,
              context,
            })
          : null

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
        if (ownsTransaction) await commitTransaction(req)
        if (banner) bannerToStore = publicBanner(banner)
      } catch (error) {
        await killTransaction(req)
        throw new APIError(
          `Nothing was published. ${error instanceof Error ? error.message : 'Something went wrong.'}`,
          error instanceof APIError ? error.status : 400,
          undefined,
          true,
        )
      }

      // The banner isn't part of the static pages; it goes to Cloudflare KV.
      let bannerWarning: string | undefined
      if (bannerToStore !== undefined) {
        try {
          await storeBanner(bannerToStore)
        } catch (error) {
          bannerWarning = `The banner didn’t reach the website: ${error instanceof Error ? error.message : 'unknown error'} Open the banner and click “Publish banner now” to try again.`
        }
      }

      const deploy = await triggerDeploy(req, { reason: 'issue', issue: issue.id })
      return json({ ok: true, published: pending.stories.length, deploy, bannerWarning })
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

/** GET /api/deployments/:id/progress — how far Cloudflare has got with one rebuild. */
export const deploymentProgressEndpoint: Endpoint = {
  path: '/:id/progress',
  method: 'get',
  handler: async (req) => {
    if (!canPublishIssues(req.user)) return json({ message: 'You need the Issue permission.' }, 403)
    try {
      const record = await req.payload.findByID({
        collection: 'deployments',
        id: req.routeParams?.id as string,
        depth: 0,
        overrideAccess: true,
        disableErrors: true,
      })
      if (!record) return json({ message: 'Rebuild not found.' }, 404)
      const progress = await getProgress(req.payload, record)
      return json({
        id: record.id,
        reason: record.reason,
        createdAt: record.createdAt,
        siteUrl: process.env.PUBLIC_SITE_URL ?? null,
        ...progress,
      })
    } catch (error) {
      return errorResponse(error)
    }
  },
}

/** GET /api/deployments/latest[?issue=ID] — the most recent rebuild that reached Cloudflare. */
export const latestDeploymentEndpoint: Endpoint = {
  path: '/latest',
  method: 'get',
  handler: async (req) => {
    if (!canPublishIssues(req.user)) return json({ message: 'You need the Issue permission.' }, 403)
    const { docs } = await req.payload.find({
      collection: 'deployments',
      where: {
        and: [
          { status: { equals: 'triggered' } },
          ...(req.searchParams.get('issue')
            ? [{ issue: { equals: req.searchParams.get('issue') } }]
            : []),
        ],
      },
      sort: '-createdAt',
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    return json({ id: docs[0]?.id ?? null })
  },
}
