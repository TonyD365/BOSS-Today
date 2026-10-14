import type { CollectionAfterChangeHook, CollectionAfterDeleteHook } from 'payload'

// The public site is statically cached; any content change refreshes it.
const revalidateSite = async () => {
  try {
    const { revalidatePath } = await import('next/cache')
    revalidatePath('/', 'layout')
  } catch {
    // Not running inside Next (seed script, migrations) — nothing to refresh.
  }
}

export const revalidateAfterChange: CollectionAfterChangeHook = async ({ doc }) => {
  await revalidateSite()
  return doc
}

export const revalidateAfterDelete: CollectionAfterDeleteHook = async ({ doc }) => {
  await revalidateSite()
  return doc
}
