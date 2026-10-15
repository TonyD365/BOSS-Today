import { createHash } from 'crypto'
import type { Endpoint, Payload, PayloadRequest } from 'payload'

import { RANK, rankOf } from '../access'

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  Response.json(body, { status, headers })

export const BODY_LIMIT = 3000
const PER_NETWORK_PER_HOUR = 5
const PER_EMAIL_PER_DAY = 3
const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR
const KINDS = ['letter', 'tip', 'correction'] as const
type Kind = (typeof KINDS)[number]

/** The public site is on another host and posts as text/plain, so no preflight is needed. */
const corsHeaders = (): Record<string, string> => {
  const site = process.env.PUBLIC_SITE_URL?.trim().replace(/\/$/, '')
  return { 'Access-Control-Allow-Origin': site || '*', Vary: 'Origin' }
}

/** An unreadable code for the sender's network that changes daily and is cleared after a day. */
const networkCode = (req: PayloadRequest) => {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip')?.trim() ||
    'unknown'
  const day = new Date().toISOString().slice(0, 10)
  return createHash('sha256')
    .update(`${day}:${ip}:${process.env.PAYLOAD_SECRET ?? ''}`)
    .digest('hex')
}

const verifyTurnstile = async (token: string, req: PayloadRequest) => {
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim()
  if (!secret) return 'not-configured' as const
  const form = new URLSearchParams({ secret, response: token })
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  if (ip) form.set('remoteip', ip)
  try {
    const response = await fetch(
      process.env.TURNSTILE_VERIFY_URL?.trim() ||
        'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      { method: 'POST', body: form },
    )
    const result = (await response.json().catch(() => ({}))) as { success?: boolean }
    return result.success ? ('ok' as const) : ('failed' as const)
  } catch {
    return 'failed' as const
  }
}

const readBody = async (req: PayloadRequest): Promise<Record<string, unknown>> => {
  try {
    const text = typeof req.text === 'function' ? await req.text() : ''
    const parsed = text ? JSON.parse(text) : {}
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

const str = (value: unknown, max: number) =>
  typeof value === 'string' ? value.replace(/\s+$/g, '').trim().slice(0, max) : ''

/**
 * Clears what we said we wouldn't keep: network codes after a day, contact
 * details 180 days after a submission was dealt with, and spam after 30 days.
 */
export const cleanupSubmissions = async (payload: Payload) => {
  const now = Date.now()
  await payload.update({
    collection: 'submissions',
    where: {
      and: [
        { ipHash: { exists: true } },
        { createdAt: { less_than: new Date(now - DAY).toISOString() } },
      ],
    },
    data: { ipHash: null },
    overrideAccess: true,
  })
  await payload.update({
    collection: 'submissions',
    where: {
      and: [
        { status: { in: ['used', 'replied', 'declined'] } },
        { updatedAt: { less_than: new Date(now - 180 * DAY).toISOString() } },
        { email: { exists: true } },
      ],
    },
    data: { email: null, contactRemovedAt: new Date().toISOString() },
    overrideAccess: true,
  })
  await payload.delete({
    collection: 'submissions',
    where: {
      and: [
        { status: { equals: 'spam' } },
        { updatedAt: { less_than: new Date(now - 30 * DAY).toISOString() } },
      ],
    },
    overrideAccess: true,
  })
}

/**
 * POST /api/submissions/submit — from the Contact page on the public site.
 * Real name and email are required; Turnstile keeps out bots, and senders are
 * limited per network and per email address.
 */
export const submitEndpoint: Endpoint = {
  path: '/submit',
  method: 'post',
  handler: async (req) => {
    const headers = corsHeaders()
    const reply = (body: unknown, status = 200) => json(body, status, headers)
    const body = await readBody(req)

    // A field people can't see; bots fill it in. Pretend it worked.
    if (str(body.website, 200)) return reply({ ok: true })

    const kind = KINDS.includes(body.kind as Kind) ? (body.kind as Kind) : null
    const text = str(body.body, BODY_LIMIT + 1)
    const name = str(body.name, 101)
    const email = str(body.email, 255).toLowerCase()
    const affiliation = str(body.affiliation, 80)
    const articleSlug = str(body.article, 120)

    const problems: string[] = []
    if (!kind) problems.push('Choose what you are sending.')
    if (!text) problems.push('Write your message.')
    else if (text.length > BODY_LIMIT) problems.push(`Keep it under ${BODY_LIMIT} characters.`)
    if (!name || name.split(/\s+/).length < 2 || name.length > 100) {
      problems.push('Give your first and last name.')
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) problems.push('Give a valid email address.')
    if (body.consent !== true) problems.push('Tick the box to agree to how we handle submissions.')
    if (problems.length > 0) return reply({ message: problems.join(' ') }, 400)

    const check = await verifyTurnstile(str(body.token, 4096), req)
    if (check === 'not-configured') {
      return reply({ message: 'Submissions aren’t open yet. Please try again later.' }, 503)
    }
    if (check === 'failed') {
      return reply(
        { message: 'We couldn’t confirm you’re not a robot. Reload the page and try again.' },
        400,
      )
    }

    const { payload } = req
    const ipHash = networkCode(req)
    const [fromNetwork, fromEmail] = await Promise.all([
      payload.count({
        collection: 'submissions',
        where: {
          and: [
            { ipHash: { equals: ipHash } },
            { createdAt: { greater_than: new Date(Date.now() - HOUR).toISOString() } },
          ],
        },
        overrideAccess: true,
      }),
      payload.count({
        collection: 'submissions',
        where: {
          and: [
            { email: { equals: email } },
            { createdAt: { greater_than: new Date(Date.now() - DAY).toISOString() } },
          ],
        },
        overrideAccess: true,
      }),
    ])
    if (fromNetwork.totalDocs >= PER_NETWORK_PER_HOUR) {
      return reply(
        { message: 'Too many submissions from your network. Try again in an hour.' },
        429,
      )
    }
    if (fromEmail.totalDocs >= PER_EMAIL_PER_DAY) {
      return reply({ message: 'You’ve sent the most we accept in a day. Try again tomorrow.' }, 429)
    }

    const article = articleSlug
      ? (
          await payload.find({
            collection: 'articles',
            where: {
              and: [{ slug: { equals: articleSlug } }, { _status: { equals: 'published' } }],
            },
            limit: 1,
            depth: 0,
            overrideAccess: true,
            select: { title: true },
          })
        ).docs[0]
      : undefined

    await payload.create({
      collection: 'submissions',
      overrideAccess: true,
      data: {
        kind: kind!,
        body: text,
        name,
        email,
        affiliation: affiliation || null,
        article: article?.id ?? null,
        status: 'new',
        ipHash,
      },
    })
    await cleanupSubmissions(payload).catch((error) =>
      payload.logger.error({ err: error, msg: 'Submission clean-up failed' }),
    )
    return reply({ ok: true })
  },
}

const loadForEditor = async (req: PayloadRequest) => {
  if (rankOf(req.user) < RANK.editor) return { error: json({ message: 'Editors only.' }, 403) }
  const submission = await req.payload.findByID({
    collection: 'submissions',
    id: req.routeParams?.id as string,
    depth: 0,
    overrideAccess: true,
    disableErrors: true,
  })
  if (!submission) return { error: json({ message: 'Submission not found.' }, 404) }
  return { submission }
}

const opening = (text: string, words = 8) => {
  const parts = text.split(/\s+/).filter(Boolean)
  return parts.slice(0, words).join(' ') + (parts.length > words ? '…' : '')
}

const paragraph = (text: string) => ({
  type: 'paragraph',
  version: 1,
  direction: 'ltr',
  format: '',
  indent: 0,
  textFormat: 0,
  children: [{ type: 'text', version: 1, text, format: 0, detail: 0, mode: 'normal', style: '' }],
})

/**
 * POST /api/submissions/:id/to-story — turns a confirmed letter into a draft
 * story for the Letters (or Opinion) section, credited to its writer.
 */
export const submissionToStoryEndpoint: Endpoint = {
  path: '/:id/to-story',
  method: 'post',
  handler: async (req) => {
    const { submission, error } = await loadForEditor(req)
    if (error) return error
    if (submission.kind !== 'letter') {
      return json({ message: 'Only letters become stories. Turn tips into assignments.' }, 409)
    }
    if (!submission.emailConfirmed || !submission.identityConfirmed) {
      return json(
        {
          message:
            'Confirm the writer first: email them from your own address, and once they reply tick “Email confirmed” and “Identity confirmed”, then save.',
        },
        409,
      )
    }
    if (submission.story) {
      return json({
        ok: true,
        id: typeof submission.story === 'object' ? submission.story.id : submission.story,
      })
    }
    const sections = await req.payload.find({
      collection: 'sections',
      where: { slug: { in: ['letters', 'opinion'] } },
      draft: true,
      depth: 0,
      limit: 2,
      overrideAccess: true,
    })
    const section =
      sections.docs.find((doc) => doc.slug === 'letters') ??
      sections.docs.find((doc) => doc.slug === 'opinion')
    const byline = `${submission.name}${submission.affiliation ? `, ${submission.affiliation}` : ''}`
    const story = await req.payload.create({
      collection: 'articles',
      draft: true,
      overrideAccess: true,
      req,
      data: {
        title: `Letter: ${opening(submission.body)}`,
        summary: `A letter to the editor from ${byline}.`,
        guestByline: byline,
        content: {
          root: {
            type: 'root',
            version: 1,
            direction: 'ltr',
            format: '',
            indent: 0,
            children: [
              ...submission.body
                .split(/\n\s*\n/)
                .map((part) => part.trim())
                .filter(Boolean)
                .map((part) => paragraph(part)),
            ],
          },
        } as never,
        section: section?.id,
        authors: [Number(req.user!.id)],
        _status: 'draft',
      } as never,
    })
    await req.payload.update({
      collection: 'submissions',
      id: submission.id,
      data: { story: story.id, status: 'used', handledBy: Number(req.user!.id) },
      overrideAccess: true,
      req,
    })
    return json({ ok: true, id: story.id })
  },
}

/** POST /api/submissions/:id/to-assignment — puts a tip on the assignment board. */
export const submissionToAssignmentEndpoint: Endpoint = {
  path: '/:id/to-assignment',
  method: 'post',
  handler: async (req) => {
    const { submission, error } = await loadForEditor(req)
    if (error) return error
    if (submission.assignment) {
      return json({
        ok: true,
        id:
          typeof submission.assignment === 'object'
            ? submission.assignment.id
            : submission.assignment,
      })
    }
    const assignment = await req.payload.create({
      collection: 'assignments',
      overrideAccess: true,
      req,
      data: {
        title: `Tip: ${opening(submission.body)}`,
        // Reporters see assignments, so the reader's contact details stay here.
        brief: `${submission.body}\n\nFrom reader submission #${submission.id}. Ask an editor for the contact details.`,
        editor: Number(req.user!.id),
        deadline: new Date(Date.now() + 7 * DAY).toISOString(),
      },
    })
    await req.payload.update({
      collection: 'submissions',
      id: submission.id,
      data: {
        assignment: assignment.id,
        status: submission.status === 'new' ? 'inProgress' : submission.status,
        handledBy: Number(req.user!.id),
      },
      overrideAccess: true,
      req,
    })
    return json({ ok: true, id: assignment.id })
  },
}
