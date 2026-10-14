import type { Payload } from 'payload'

/**
 * Reads build progress from the Cloudflare API. Needs a token with
 * "Cloudflare Pages: Read" on the account; without it, progress is simply
 * unavailable and everything else still works.
 */
const cloudflare = () => {
  const token = process.env.CLOUDFLARE_API_TOKEN?.trim()
  const account = process.env.CLOUDFLARE_ACCOUNT_ID?.trim()
  const project = process.env.CLOUDFLARE_PAGES_PROJECT?.trim()
  if (!token || !account || !project) return null
  const base = (
    process.env.CLOUDFLARE_API_BASE?.trim() || 'https://api.cloudflare.com/client/v4'
  ).replace(/\/$/, '')
  return {
    url: (path: string) => `${base}/accounts/${account}/pages/projects/${project}${path}`,
    headers: { Authorization: `Bearer ${token}` },
  }
}

export const STAGES = ['queued', 'initialize', 'clone_repo', 'build', 'deploy'] as const

export const STAGE_LABELS: Record<(typeof STAGES)[number], string> = {
  queued: 'Waiting in line',
  initialize: 'Starting up',
  clone_repo: 'Fetching the code',
  build: 'Building every page',
  deploy: 'Putting it online',
}

type Stage = { name: string; status: string; started_on?: string | null; ended_on?: string | null }
type CloudflareDeployment = {
  id: string
  url?: string
  created_on?: string
  latest_stage?: Stage
  stages?: Stage[]
}

export type BuildStatus = 'queued' | 'building' | 'live' | 'failed' | 'canceled'

export type Progress = {
  available: boolean
  status?: BuildStatus
  stage?: string
  stageLabel?: string
  percent?: number
  stages?: { name: string; label: string; status: string }[]
  startedAt?: string
  finishedAt?: string | null
  message?: string
}

const summarize = (deployment: CloudflareDeployment): Progress => {
  const latest = deployment.latest_stage
  const index = Math.max(0, STAGES.indexOf((latest?.name ?? 'queued') as (typeof STAGES)[number]))
  const failed = latest?.status === 'failure'
  const canceled = latest?.status === 'canceled'
  const live = latest?.name === 'deploy' && latest.status === 'success'
  const status: BuildStatus = live
    ? 'live'
    : failed
      ? 'failed'
      : canceled
        ? 'canceled'
        : index === 0
          ? 'queued'
          : 'building'
  const done = latest?.status === 'success' ? 1 : latest?.status === 'active' ? 0.5 : 0
  const byName = new Map((deployment.stages ?? []).map((stage) => [stage.name, stage]))

  return {
    available: true,
    status,
    stage: latest?.name,
    stageLabel: STAGE_LABELS[STAGES[index]],
    percent: live ? 100 : Math.round(((index + done) / STAGES.length) * 100),
    stages: STAGES.map((name) => ({
      name,
      label: STAGE_LABELS[name],
      status: byName.get(name)?.status ?? 'idle',
    })),
    startedAt: deployment.created_on,
    finishedAt: live || failed || canceled ? (latest?.ended_on ?? null) : null,
  }
}

/** The Cloudflare deployment id from a deploy hook response, if it gives one. */
export const deploymentIdFromHook = (body: unknown): string | undefined => {
  const id = (body as { result?: { id?: unknown } } | null)?.result?.id
  return typeof id === 'string' && id ? id : undefined
}

/** Finds the Cloudflare build for one of our rebuild records, then reports its stages. */
export const getProgress = async (
  payload: Payload,
  record: { id: number; cloudflareId?: string | null; createdAt: string; status: string },
): Promise<Progress> => {
  if (record.status !== 'triggered') {
    return { available: false, message: 'This rebuild was not sent to Cloudflare.' }
  }
  const api = cloudflare()
  if (!api) {
    return {
      available: false,
      message:
        'Progress needs CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_PAGES_PROJECT. Check the Cloudflare dashboard instead.',
    }
  }

  let id = record.cloudflareId ?? undefined
  if (!id) {
    // Older hooks don't return an id: take the first build created after we asked.
    const response = await fetch(api.url('/deployments?per_page=10'), { headers: api.headers })
    if (!response.ok) return { available: false, message: `Cloudflare said ${response.status}.` }
    const list = ((await response.json()) as { result?: CloudflareDeployment[] }).result ?? []
    const after = new Date(record.createdAt).getTime() - 30_000
    const claimed = await payload.find({
      collection: 'deployments',
      where: { cloudflareId: { in: list.map((item) => item.id) } },
      limit: 0,
      pagination: false,
      depth: 0,
      overrideAccess: true,
    })
    const taken = new Set(claimed.docs.map((doc) => doc.cloudflareId))
    const match = list
      .filter((item) => !taken.has(item.id))
      .filter((item) => item.created_on && new Date(item.created_on).getTime() >= after)
      .sort((a, b) => new Date(a.created_on!).getTime() - new Date(b.created_on!).getTime())[0]
    if (!match) {
      // A new build can take a moment to appear; an old one may have scrolled out of the list.
      const age = Date.now() - new Date(record.createdAt).getTime()
      return age < 10 * 60_000
        ? { available: true, status: 'queued', percent: 0, stageLabel: STAGE_LABELS.queued }
        : {
            available: false,
            message:
              'This rebuild can’t be matched to a Cloudflare build any more. Check the Cloudflare dashboard.',
          }
    }
    id = match.id
    await payload.update({
      collection: 'deployments',
      id: record.id,
      data: { cloudflareId: id },
      overrideAccess: true,
    })
  }

  const response = await fetch(api.url(`/deployments/${encodeURIComponent(id)}`), {
    headers: api.headers,
  })
  if (!response.ok) return { available: false, message: `Cloudflare said ${response.status}.` }
  const deployment = ((await response.json()) as { result: CloudflareDeployment }).result
  const progress = summarize(deployment)

  if (
    progress.status === 'live' ||
    progress.status === 'failed' ||
    progress.status === 'canceled'
  ) {
    await payload.update({
      collection: 'deployments',
      id: record.id,
      data: {
        buildStatus: progress.status,
        finishedAt: progress.finishedAt ?? new Date().toISOString(),
      },
      overrideAccess: true,
    })
  }
  return progress
}
