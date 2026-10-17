import { APIError, type Endpoint } from 'payload'

import { canPublishIssues, RANK, rankOf } from '../access'
import { audit } from '../hooks/audit'
import { assertDeployBudget, triggerDeploy } from '../publishing/deploy'
import {
  commentProblem,
  describeProblems,
  publishingProblems,
  unresolvedComments,
} from '../publishing/readiness'

export const WORKFLOW_STATES = [
  'draft',
  'review',
  'changes',
  'approved',
  'published',
  'takedown',
  'withdrawn',
] as const
export type WorkflowState = (typeof WORKFLOW_STATES)[number]

export type WorkflowAction = 'submit' | 'return' | 'approve' | 'takedown' | 'keep' | 'withdraw'

const json = (body: unknown, status = 200) => Response.json(body, { status })

const errorMessage = (error: unknown) =>
  error instanceof APIError || error instanceof Error ? error.message : 'Could not save.'

/**
 * POST /api/articles/:id/workflow  { action, note? }
 *
 *   draft / changes / withdrawn ──submit──▶ review ──approve──▶ approved ──(issue published)──▶ published
 *                                            │                    │                                  │
 *                                            └──────return────────┴──▶ changes            withdraw ──┘
 *
 *   published ──takedown──▶ takedown ──(issue published)──▶ withdrawn;  takedown ──keep──▶ published
 *
 * Nothing here puts a story on the public site or takes one off: that happens
 * when an issue is published. Emergency withdrawal is the one action that
 * changes the site immediately.
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

    const saveDraft = async (data: Record<string, unknown>) => {
      try {
        await req.payload.update({
          collection: 'articles',
          id,
          data,
          draft: true,
          req,
          overrideAccess: true,
          context: { workflowAction: body.action, workflowNote: note || null, draftSave: true },
        })
        return json({ ok: true })
      } catch (error) {
        return json({ message: errorMessage(error) }, 400)
      }
    }

    switch (body.action) {
      case 'submit':
        if (!isAuthor && !isEditor) {
          return json({ message: 'Only the authors can submit this story.' }, 403)
        }
        if (!['draft', 'changes', 'withdrawn'].includes(state)) {
          return json({ message: 'This story is already in review or approved.' }, 409)
        }
        return saveDraft({ workflow: 'review' })

      case 'return':
        if (!isEditor) return json({ message: 'Only editors can send stories back.' }, 403)
        if (!['review', 'approved'].includes(state)) {
          return json(
            { message: 'Only stories in review or waiting for the issue can be sent back.' },
            409,
          )
        }
        {
          // Comments on the text can stand in for a note.
          const open = (await unresolvedComments(req.payload, [id], req)).get(String(id)) ?? 0
          if (!note && open === 0) {
            return json(
              {
                message: 'Add a note or comment on the text so the reporter knows what to change.',
              },
              400,
            )
          }
          return saveDraft({
            workflow: 'changes',
            reviewNotes: note || 'See the comments on the story.',
          })
        }

      case 'approve':
        if (!isEditor) return json({ message: 'Only editors can approve stories.' }, 403)
        if (state === 'approved')
          return json({ message: 'Already waiting for the next issue.' }, 409)
        if (state === 'takedown')
          return json(
            { message: 'This story is set to come down. Choose “Keep it on the site” first.' },
            409,
          )
        {
          const problems = publishingProblems(latest)
          const open = (await unresolvedComments(req.payload, [id], req)).get(String(id)) ?? 0
          if (open > 0) problems.push(commentProblem(open))
          if (problems.length > 0) {
            return json({ message: `Can’t approve yet: ${describeProblems(problems)}` }, 400)
          }
        }
        return saveDraft({ workflow: 'approved', reviewNotes: null })

      case 'takedown': {
        if (!isEditor) return json({ message: 'Only editors can take stories down.' }, 403)
        if (state === 'takedown') return json({ message: 'Already coming down.' }, 409)
        const live = await req.payload.findByID({
          collection: 'articles',
          id,
          depth: 0,
          overrideAccess: true,
          disableErrors: true,
        })
        if (live?._status !== 'published') {
          return json({ message: 'Only stories on the public site can be taken down.' }, 409)
        }
        if (!note) return json({ message: 'Say why it is coming down.' }, 400)
        return saveDraft({ workflow: 'takedown', reviewNotes: note })
      }

      case 'keep':
        if (!isEditor) return json({ message: 'Only editors can change this.' }, 403)
        if (state !== 'takedown') return json({ message: 'This story isn’t coming down.' }, 409)
        return saveDraft({ workflow: 'published', reviewNotes: null })

      case 'withdraw': {
        if (!canPublishIssues(user)) {
          return json(
            { message: 'Only people with the Issue permission can withdraw stories.' },
            403,
          )
        }
        const live = await req.payload.findByID({
          collection: 'articles',
          id,
          depth: 0,
          overrideAccess: true,
          disableErrors: true,
        })
        if (live?._status !== 'published') {
          return json({ message: 'Only stories on the public site can be withdrawn.' }, 409)
        }
        if (!note) return json({ message: 'Give a reason for the withdrawal.' }, 400)
        try {
          await assertDeployBudget(req.payload, 'withdrawal', req)
          await req.payload.update({
            collection: 'articles',
            id,
            data: { _status: 'draft', workflow: 'withdrawn' },
            req,
            overrideAccess: true,
            context: { workflowAction: 'withdraw', workflowNote: note, withdrawal: true },
          })
          await audit(req, {
            action: 'withdraw',
            summary: `Emergency withdrawal of “${latest.title}”: ${note}`,
            target: `story:${id}`,
          })
          const deploy = await triggerDeploy(req, {
            reason: 'withdrawal',
            note: `${latest.title}: ${note}`,
          })
          return json({ ok: true, deploy })
        } catch (error) {
          const status = error instanceof APIError ? error.status : 400
          return json({ message: errorMessage(error) }, status)
        }
      }

      default:
        return json({ message: 'Unknown action.' }, 400)
    }
  },
}
