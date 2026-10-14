import { APIError, type CollectionBeforeChangeHook, type CollectionConfig } from 'payload'

import { atLeast, isSuperAdminUser, RANK, rankOf } from '../access'

const forbid = (message: string) => new APIError(message, 403, undefined, true)

const idOf = (value: unknown) =>
  String(value && typeof value === 'object' ? (value as { id: unknown }).id : value)

const authorsOf = async (
  req: Parameters<CollectionBeforeChangeHook>[0]['req'],
  article: unknown,
) => {
  const story = await req.payload.findByID({
    collection: 'articles',
    id: idOf(article),
    draft: true,
    depth: 0,
    overrideAccess: true,
    disableErrors: true,
    req,
    select: { authors: true },
  })
  if (!story) throw new APIError('Story not found.', 404, undefined, true)
  return (story.authors ?? []).map(idOf)
}

/**
 * Comments are written by the story's authors and editors. Once written, only
 * the text (by its writer) and whether the thread is resolved can change.
 */
const enforceCommentRules: CollectionBeforeChangeHook = async ({
  data,
  originalDoc,
  operation,
  req,
}) => {
  const user = req.user
  if (!user) throw forbid('Sign in first.')
  const isEditor = rankOf(user) >= RANK.editor
  const me = String(user.id)

  if (operation === 'create') {
    const authors = await authorsOf(req, data.article)
    if (!isEditor && !authors.includes(me)) {
      throw forbid('Only the story’s authors and editors can comment on it.')
    }
    if (data.parent) {
      const parent = await req.payload.findByID({
        collection: 'comments',
        id: idOf(data.parent),
        depth: 0,
        overrideAccess: true,
        disableErrors: true,
        req,
      })
      if (!parent || idOf(parent.article) !== idOf(data.article)) {
        throw new APIError('That comment is not on this story.', 400, undefined, true)
      }
      if (parent.parent) data.parent = Number(idOf(parent.parent))
      data.quote = null
      data.anchor = null
    }
    data.author = Number(user.id)
    data.resolved = false
    data.resolvedBy = null
    data.resolvedAt = null
    return data
  }

  // Updates: the thread's place and writer never change.
  const keep = (value: unknown) =>
    value === null || value === undefined ? null : Number(idOf(value))
  data.article = keep(originalDoc?.article)
  data.parent = keep(originalDoc?.parent)
  data.author = keep(originalDoc?.author)
  data.quote = originalDoc?.quote ?? null
  data.anchor = originalDoc?.anchor ?? null

  const isWriter = idOf(originalDoc?.author) === me
  if ((data.body ?? '').trim() !== (originalDoc?.body ?? '').trim() && !isWriter) {
    throw forbid('Only the person who wrote a comment can change it.')
  }
  if (Boolean(data.resolved) !== Boolean(originalDoc?.resolved)) {
    if (originalDoc?.parent) throw forbid('Resolve the whole thread, not a reply.')
    const authors = await authorsOf(req, originalDoc?.article)
    if (!isWriter && !isEditor && !authors.includes(me)) {
      throw forbid('Only the commenter, the story’s authors or an editor can resolve this.')
    }
    data.resolvedBy = data.resolved ? Number(user.id) : null
    data.resolvedAt = data.resolved ? new Date().toISOString() : null
  } else {
    data.resolvedBy = keep(originalDoc?.resolvedBy)
    data.resolvedAt = originalDoc?.resolvedAt ?? null
  }
  return data
}

/** Notes on a passage of a story, like comments in a shared document. Never published. */
export const Comments: CollectionConfig = {
  slug: 'comments',
  labels: { singular: 'Comment', plural: 'Comments' },
  admin: {
    useAsTitle: 'body',
    group: 'Newsroom',
    hidden: true,
    defaultColumns: ['body', 'article', 'author', 'resolved', 'createdAt'],
  },
  defaultSort: 'createdAt',
  access: {
    read: ({ req }) => {
      const rank = rankOf(req.user)
      if (rank >= RANK.editor) return true
      if (rank < RANK.reporter || !req.user) return false
      return { 'article.authors': { in: [req.user.id] } }
    },
    create: atLeast('reporter'),
    update: atLeast('reporter'),
    // Kept as a record of the editing conversation.
    delete: ({ req }) => isSuperAdminUser(req.user),
  },
  hooks: { beforeChange: [enforceCommentRules] },
  fields: [
    {
      name: 'article',
      type: 'relationship',
      relationTo: 'articles',
      required: true,
      index: true,
      admin: { allowCreate: false },
    },
    {
      name: 'parent',
      type: 'relationship',
      relationTo: 'comments',
      index: true,
      admin: { allowCreate: false, description: 'Set for replies.' },
    },
    {
      name: 'quote',
      type: 'text',
      maxLength: 600,
      admin: { description: 'The passage the thread is about.' },
    },
    {
      name: 'anchor',
      type: 'number',
      admin: { description: 'Where the passage started, counted in letters, ignoring spaces.' },
    },
    { name: 'body', type: 'textarea', required: true, maxLength: 4000 },
    { name: 'author', type: 'relationship', relationTo: 'users', admin: { allowCreate: false } },
    { name: 'resolved', type: 'checkbox', defaultValue: false, index: true },
    {
      name: 'resolvedBy',
      type: 'relationship',
      relationTo: 'users',
      admin: { allowCreate: false },
    },
    { name: 'resolvedAt', type: 'date' },
  ],
}
