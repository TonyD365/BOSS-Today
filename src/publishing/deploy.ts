import { APIError, type Payload, type PayloadRequest } from 'payload'

import { syncPublicImages } from '../storage/publicImages'
import { deploymentIdFromHook } from './progress'

/** Cloudflare Pages allows 500 builds a month on the free plan; we stop well short of it. */
export const ISSUE_DEPLOY_LIMIT = 400
/** Emergency withdrawals may dip into the reserve between 400 and this. */
export const WITHDRAWAL_DEPLOY_LIMIT = 490

export type DeployReason = 'issue' | 'withdrawal' | 'rebuild' | 'design'

const TIME_ZONE = 'America/Toronto'

/** Milliseconds the time zone is ahead of UTC at a given moment. */
const zoneOffset = (date: Date) => {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: TIME_ZONE,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
      .formatToParts(date)
      .map((part) => [part.type, part.value]),
  )
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  )
  return asUtc - date.getTime()
}

/** Midnight on the 1st of the current month, Toronto time. */
export const monthStart = (now = new Date()) => {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit' })
      .formatToParts(now)
      .map((part) => [part.type, part.value]),
  )
  const guess = Date.UTC(Number(parts.year), Number(parts.month) - 1, 1)
  return new Date(guess - zoneOffset(new Date(guess)))
}

export const deploysThisMonth = async (payload: Payload, req?: PayloadRequest) => {
  const { totalDocs } = await payload.count({
    collection: 'deployments',
    where: {
      and: [
        { status: { equals: 'triggered' } },
        { createdAt: { greater_than_equal: monthStart().toISOString() } },
      ],
    },
    req,
    overrideAccess: true,
  })
  return totalDocs
}

const limitFor = (reason: DeployReason) =>
  reason === 'withdrawal' ? WITHDRAWAL_DEPLOY_LIMIT : ISSUE_DEPLOY_LIMIT

/** Throws before anything is changed if this month's deploy budget is used up. */
export const assertDeployBudget = async (
  payload: Payload,
  reason: DeployReason,
  req?: PayloadRequest,
) => {
  const used = await deploysThisMonth(payload, req)
  const limit = limitFor(reason)
  if (used >= limit) {
    throw new APIError(
      reason === 'withdrawal'
        ? `The site has been rebuilt ${used} times this month, including the emergency reserve. Ask the super admin for help.`
        : `The site has already been rebuilt ${used} times this month (limit ${limit}). Publishing resumes on the 1st.`,
      429,
      undefined,
      true,
    )
  }
  return { used, limit }
}

/**
 * Asks Cloudflare Pages to rebuild the public site and records the attempt.
 * Only successful triggers count toward the monthly limit.
 */
export const triggerDeploy = async (
  req: PayloadRequest,
  { reason, issue, note }: { reason: DeployReason; issue?: number | string; note?: string },
) => {
  const { payload } = req
  await assertDeployBudget(payload, reason, req)

  // The public image repository must hold every image the rebuilt site will show.
  let imageError: string | undefined
  try {
    await syncPublicImages(payload)
  } catch (error) {
    imageError = error instanceof Error ? error.message : String(error)
    payload.logger.error({ err: error, msg: 'Could not update the public image repository' })
  }

  const hook = process.env.CLOUDFLARE_DEPLOY_HOOK_URL?.trim()
  let status: 'triggered' | 'failed' | 'not-configured' = 'not-configured'
  let httpStatus: number | undefined
  let cloudflareId: string | undefined
  if (imageError) {
    status = 'failed'
  } else if (hook) {
    try {
      const response = await fetch(hook, { method: 'POST' })
      httpStatus = response.status
      status = response.ok ? 'triggered' : 'failed'
      cloudflareId = deploymentIdFromHook(await response.json().catch(() => null))
    } catch {
      status = 'failed'
    }
  }

  const record = await payload.create({
    collection: 'deployments',
    data: {
      reason,
      status,
      httpStatus,
      cloudflareId: cloudflareId ?? null,
      buildStatus: status === 'triggered' ? 'queued' : null,
      note: imageError
        ? `Not rebuilt: images could not be published (${imageError})`
        : (note ?? null),
      issue: issue ? Number(issue) : null,
      actor: req.user ? Number(req.user.id) : null,
    },
    req,
    overrideAccess: true,
  })

  return {
    id: record.id,
    status,
    message: imageError
      ? 'The images for the website could not be published, so the site was not rebuilt. Try “Rebuild site” on the dashboard; if it keeps failing, check the GitHub image settings.'
      : undefined,
    used: await deploysThisMonth(payload, req),
    limit: ISSUE_DEPLOY_LIMIT,
  }
}
