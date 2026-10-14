import type { Endpoint, PayloadRequest } from 'payload'

import { RANK, rankOf } from '../access'
import { untitledSlug } from '../hooks/slug'

const json = (body: unknown, status = 200) => Response.json(body, { status })

const EMPTY_STORY = {
  root: {
    type: 'root',
    version: 1,
    direction: null,
    format: '',
    indent: 0,
    children: [
      {
        type: 'paragraph',
        version: 1,
        direction: null,
        format: '',
        indent: 0,
        textFormat: 0,
        textStyle: '',
        children: [],
      },
    ],
  },
}

const idOf = (value: unknown) =>
  value && typeof value === 'object' ? Number((value as { id: unknown }).id) : Number(value)

/** Creates a draft story, optionally from a template. Returns its id. */
export const createStory = async (
  req: PayloadRequest,
  {
    title,
    template,
    section,
    authors,
  }: { title?: string; template?: number | string | null; section?: unknown; authors: number[] },
) => {
  const chosen = template
    ? await req.payload.findByID({
        collection: 'templates',
        id: template,
        depth: 0,
        overrideAccess: true,
        disableErrors: true,
        req,
      })
    : null
  const story = await req.payload.create({
    collection: 'articles',
    draft: true,
    req,
    overrideAccess: true,
    data: {
      title: title?.trim() || 'Untitled story',
      ...(title?.trim() ? {} : { slug: untitledSlug() }),
      summary: '',
      content: (chosen?.content ?? EMPTY_STORY) as never,
      section: section ? idOf(section) : chosen?.section ? idOf(chosen.section) : undefined,
      authors,
      _status: 'draft',
    } as never,
  })
  return story.id
}

/** POST /api/articles/new-story  { template? } — a fresh draft for the signed-in reporter. */
export const newStoryEndpoint: Endpoint = {
  path: '/new-story',
  method: 'post',
  handler: async (req) => {
    if (!req.user || rankOf(req.user) < RANK.reporter)
      return json({ message: 'Sign in first.' }, 401)
    const body = (req.json ? await req.json().catch(() => ({})) : {}) as {
      template?: number | string | null
    }
    try {
      const id = await createStory(req, {
        template: body.template,
        authors: [Number(req.user.id)],
      })
      return json({ ok: true, id })
    } catch (error) {
      return json({ message: error instanceof Error ? error.message : 'Could not create.' }, 400)
    }
  },
}
