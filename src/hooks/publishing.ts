import { APIError, type CollectionBeforeChangeHook, type GlobalBeforeChangeHook } from 'payload'

type Args = {
  data: Record<string, unknown>
  originalDoc?: Record<string, unknown>
  context: Record<string, unknown>
  query?: Record<string, unknown>
}

const forbid = (message: string) => new APIError(message, 403, undefined, true)

/**
 * Content only goes live when an issue is published (context.issuePublish) and
 * only comes down through an emergency withdrawal (context.withdrawal).
 */
const check = (noun: string, { data, originalDoc, context, query }: Args) => {
  if (data._status === 'published' && !context.issuePublish) {
    throw forbid(`${noun} goes live when the next issue is published.`)
  }
  const unpublishing =
    originalDoc?._status === 'published' &&
    data._status === 'draft' &&
    query?.draft !== 'true' &&
    !context.draftSave &&
    !context.withdrawal
  if (unpublishing) {
    throw forbid(
      `Published ${noun.toLowerCase()} can only be taken down with an emergency withdrawal.`,
    )
  }
}

export const guardPublishing =
  (noun: string): CollectionBeforeChangeHook =>
  ({ data, originalDoc, context, req }) => {
    check(noun, { data, originalDoc, context, query: req.query })
    return data
  }

export const guardGlobalPublishing =
  (noun: string): GlobalBeforeChangeHook =>
  ({ data, originalDoc, context, req }) => {
    check(noun, { data, originalDoc, context, query: req.query })
    return data
  }
