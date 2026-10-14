import { APIError, type Endpoint } from 'payload'

import { RANK, rankOf } from '../access'

export const WORKFLOW_STATES = ['draft', 'review', 'changes', 'published', 'withdrawn'] as const
export type WorkflowState = (typeof WORKFLOW_STATES)[number]

export type WorkflowAction = 'submit' | 'return' | 'publish' | 'withdraw'

const json = (body: unknown, status = 200) => Response.json(body, { status })

/**
 * POST /api/articles/:id/workflow  { action, note? }
 *
 * draft / changes / withdrawn ──submit──▶ review ──publish──▶ published ──withdraw──▶ withdrawn
 *                                          │
 *                                          └──return──▶ changes
 */
export const articleWorkflowEndpoint: Endpoint = {
  path: '/:id/workflow',
  method: 'post',
  handler: async (req) => {
    const user = req.user
    const rank = rankOf(user)
    if (!user || rank < RANK.reporter) return json({ message: 'Sign in first.' }, 401)

    const id = req.routeParams?.id as string
    const body = (req.json ? await req.json().catch(() => ({})) : {}) as {
      action?: WorkflowAction
      note?: string
    }
    const note = typeof body.note === 'string' ? body.note.trim().slice(0, 2000) : ''

    const latest = await req.payload.findByID({
      collection: 'articles',
      id,
      draft: true,
      depth: 0,
      overrideAccess: true,
      disableErrors: true,
    })
    if (!latest) return json({ message: 'Story not found.' }, 404)

    const state = (latest.workflow ?? 'draft') as WorkflowState
    const isAuthor = (latest.authors ?? []).some(
      (author) => String(typeof author === 'object' ? author.id : author) === String(user.id),
    )
    const isEditor = rank >= RANK.editor

    const run = async (data: Record<string, unknown>, draft: boolean) => {
      try {
        await req.payload.update({
          collection: 'articles',
          id,
          data,
          draft,
          req,
          overrideAccess: true,
          context: { workflowAction: body.action, workflowNote: note || null },
        })
        return json({ ok: true })
      } catch (error) {
        const message =
          error instanceof APIError || error instanceof Error ? error.message : 'Could not save.'
        return json({ message }, 400)
      }
    }

    switch (body.action) {
      case 'submit':
        if (!isAuthor && !isEditor)
          return json({ message: 'Only the authors can submit this story.' }, 403)
        if (!['draft', 'changes', 'withdrawn'].includes(state)) {
          return json({ message: 'This story is already in review or published.' }, 409)
        }
        return run({ workflow: 'review' }, true)

      case 'return':
        if (!isEditor) return json({ message: 'Only editors can return stories.' }, 403)
        if (state !== 'review')
          return json({ message: 'Only stories in review can be returned.' }, 409)
        if (!note) return json({ message: 'Add a note so the reporter knows what to change.' }, 400)
        return run({ workflow: 'changes', reviewNotes: note }, true)

      case 'publish':
        if (!isEditor) return json({ message: 'Only editors can publish.' }, 403)
        return run({ _status: 'published', reviewNotes: null }, false)

      case 'withdraw':
        if (!isEditor) return json({ message: 'Only editors can withdraw stories.' }, 403)
        if (latest._status !== 'published' && state !== 'published') {
          return json({ message: 'Only published stories can be withdrawn.' }, 409)
        }
        return run({ _status: 'draft', workflow: 'withdrawn' }, false)

      default:
        return json({ message: 'Unknown action.' }, 400)
    }
  },
}
