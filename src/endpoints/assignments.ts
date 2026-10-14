import type { Endpoint } from 'payload'

import { RANK, rankOf } from '../access'
import { createStory } from './newStory'

const json = (body: unknown, status = 200) => Response.json(body, { status })

const idOf = (value: unknown) =>
  value && typeof value === 'object' ? Number((value as { id: unknown }).id) : Number(value)

const load = (req: Parameters<Endpoint['handler']>[0]) =>
  req.payload.findByID({
    collection: 'assignments',
    id: req.routeParams?.id as string,
    depth: 0,
    overrideAccess: true,
    disableErrors: true,
    req,
  })

/** POST /api/assignments/:id/claim — a reporter takes an assignment nobody has yet. */
export const assignmentClaimEndpoint: Endpoint = {
  path: '/:id/claim',
  method: 'post',
  handler: async (req) => {
    if (!req.user || rankOf(req.user) < RANK.reporter)
      return json({ message: 'Sign in first.' }, 401)
    const assignment = await load(req)
    if (!assignment) return json({ message: 'Assignment not found.' }, 404)
    if ((assignment.reporters ?? []).length > 0) {
      return json({ message: 'Someone is already writing this.' }, 409)
    }
    await req.payload.update({
      collection: 'assignments',
      id: assignment.id,
      data: { reporters: [Number(req.user.id)] },
      req,
      overrideAccess: true,
    })
    return json({ ok: true })
  },
}

/**
 * POST /api/assignments/:id/start  { template? }
 *
 * Creates the story for an assignment (headline, section and authors filled
 * in) and links it, or returns the story that already exists.
 */
export const assignmentStartEndpoint: Endpoint = {
  path: '/:id/start',
  method: 'post',
  handler: async (req) => {
    const user = req.user
    if (!user || rankOf(user) < RANK.reporter) return json({ message: 'Sign in first.' }, 401)
    const assignment = await load(req)
    if (!assignment) return json({ message: 'Assignment not found.' }, 404)
    if (assignment.article) return json({ ok: true, id: idOf(assignment.article) })

    const reporters = (assignment.reporters ?? []).map(idOf)
    const isEditor = rankOf(user) >= RANK.editor
    if (!reporters.includes(Number(user.id)) && !isEditor) {
      return json({ message: 'Claim this assignment first.' }, 403)
    }
    const body = (req.json ? await req.json().catch(() => ({})) : {}) as {
      template?: number | string | null
    }
    try {
      const id = await createStory(req, {
        title: assignment.title,
        template: body.template,
        section: assignment.section,
        authors: reporters.length > 0 ? reporters : [Number(user.id)],
      })
      await req.payload.update({
        collection: 'assignments',
        id: assignment.id,
        data: {
          article: id,
          ...(reporters.length === 0 ? { reporters: [Number(user.id)] } : {}),
        },
        req,
        overrideAccess: true,
      })
      return json({ ok: true, id })
    } catch (error) {
      return json({ message: error instanceof Error ? error.message : 'Could not start.' }, 400)
    }
  },
}
