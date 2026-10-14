import type {
  CollectionAfterChangeHook,
  CollectionAfterDeleteHook,
  GlobalAfterChangeHook,
  PayloadRequest,
} from 'payload'

type Entry = {
  action:
    'publish' | 'withdraw' | 'delete' | 'invite' | 'role' | 'deactivate' | 'reactivate' | 'settings'
  summary: string
  target?: string
}

/** Records an important action. Failures never block the action itself. */
export const audit = async (req: PayloadRequest, entry: Entry) => {
  try {
    await req.payload.create({
      collection: 'audit-log',
      data: { ...entry, actor: req.user ? Number(req.user.id) : null },
      req,
      overrideAccess: true,
    })
  } catch (error) {
    req.payload.logger.error({ err: error, msg: 'Could not write audit log entry' })
  }
}

const label = (doc: Record<string, unknown>) =>
  String(doc.title ?? doc.name ?? doc.alt ?? doc.filename ?? doc.email ?? `#${doc.id}`)

/** Publish and withdraw, for collections with drafts (stories, issues). */
export const auditPublishing =
  (noun: string): CollectionAfterChangeHook =>
  async ({ doc, previousDoc, req, operation }) => {
    const wasPublished = previousDoc?._status === 'published'
    const isPublished = doc._status === 'published'
    if (isPublished && (!wasPublished || operation === 'create')) {
      await audit(req, {
        action: 'publish',
        summary: `Published ${noun} “${label(doc)}”`,
        target: `${noun}:${doc.id}`,
      })
    } else if (wasPublished && !isPublished && req.query?.draft !== 'true') {
      await audit(req, {
        action: 'withdraw',
        summary: `Withdrew ${noun} “${label(doc)}”`,
        target: `${noun}:${doc.id}`,
      })
    }
    return doc
  }

export const auditDelete =
  (noun: string): CollectionAfterDeleteHook =>
  async ({ doc, req }) => {
    await audit(req, {
      action: 'delete',
      summary: `Deleted ${noun} “${label(doc)}”`,
      target: `${noun}:${doc.id}`,
    })
    return doc
  }

export const auditPeople: CollectionAfterChangeHook = async ({
  doc,
  previousDoc,
  req,
  operation,
}) => {
  // Sign-in creates and links accounts without a signed-in user; those are not admin actions.
  if (!req.user) return doc
  const who = `${doc.name} (${doc.email})`
  if (operation === 'create') {
    await audit(req, {
      action: 'invite',
      summary: `Added ${who} as ${doc.role}`,
      target: `person:${doc.id}`,
    })
    return doc
  }
  if (previousDoc?.role !== doc.role) {
    await audit(req, {
      action: 'role',
      summary: `Changed ${who} from ${previousDoc?.role} to ${doc.role}`,
      target: `person:${doc.id}`,
    })
  }
  const before = JSON.stringify([...(previousDoc?.permissions ?? [])].sort())
  const after = JSON.stringify([...(doc.permissions ?? [])].sort())
  if (before !== after) {
    await audit(req, {
      action: 'role',
      summary: `Set ${who}'s exec permissions to ${(doc.permissions ?? []).join(', ') || 'none'}`,
      target: `person:${doc.id}`,
    })
  }
  if ((previousDoc?.active ?? true) !== (doc.active ?? true)) {
    await audit(req, {
      action: doc.active === false ? 'deactivate' : 'reactivate',
      summary: `${doc.active === false ? 'Deactivated' : 'Reactivated'} ${who}`,
      target: `person:${doc.id}`,
    })
  }
  return doc
}

export const auditGlobal =
  (name: string): GlobalAfterChangeHook =>
  async ({ doc, req }) => {
    if (req.user) await audit(req, { action: 'settings', summary: `Updated ${name}` })
    return doc
  }
