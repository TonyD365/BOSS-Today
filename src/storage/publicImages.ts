import type { Payload, PayloadRequest } from 'payload'

import { exportAllArticles, exportLiveBlogs, exportMeta } from '../publishing/siteContent'
import {
  encodePath,
  github,
  type GitHubImagesConfig,
  githubImagesConfig,
  MEDIA_DIR,
  readFile,
  serially,
} from './github'

/**
 * Keeps the public image repository in step with the public site: it holds
 * exactly the images that published content uses. Run before every rebuild.
 *
 * New images are copied from the private drafts repository in one commit.
 * When anything has to go (a story withdrawn, an image replaced), the
 * repository is rewritten as a single fresh commit, so withdrawn images don't
 * linger in its history either.
 */

type MediaLike = {
  filename?: string | null
  prefix?: string | null
  url?: string | null
  thumbnailURL?: string | null
  sizes?: Record<string, { filename?: string | null; url?: string | null } | null> | null
}

const isMedia = (value: unknown): value is MediaLike =>
  Boolean(value) &&
  typeof value === 'object' &&
  typeof (value as MediaLike).filename === 'string' &&
  ('mimeType' in (value as object) || 'sizes' in (value as object))

const pathOf = (filename: string, prefix?: string | null) =>
  [prefix || MEDIA_DIR, filename].join('/')

/** Every image file (each size too) that a piece of public content shows. */
export const collectImageFiles = (value: unknown, into = new Set<string>()) => {
  if (Array.isArray(value)) {
    for (const item of value) collectImageFiles(item, into)
  } else if (isMedia(value)) {
    into.add(pathOf(value.filename!, value.prefix))
    for (const size of Object.values(value.sizes ?? {})) {
      if (size?.filename) into.add(pathOf(size.filename, value.prefix))
    }
  } else if (value && typeof value === 'object') {
    for (const item of Object.values(value)) collectImageFiles(item, into)
  }
  return into
}

/** Points images at the public repository (GitHub Pages) when it is set up. */
export const publicizeMedia = <T>(value: T, config = githubImagesConfig()): T => {
  if (!config) return value
  const url = (filename: string, prefix?: string | null) =>
    `${config.baseUrl}/${encodePath(pathOf(filename, prefix))}`
  const walk = (item: unknown): unknown => {
    if (Array.isArray(item)) return item.map(walk)
    if (isMedia(item)) {
      const sizes = Object.fromEntries(
        Object.entries(item.sizes ?? {}).map(([name, size]) => [
          name,
          size?.filename ? { ...size, url: url(size.filename, item.prefix) } : size,
        ]),
      )
      const original = url(item.filename!, item.prefix)
      return {
        ...item,
        url: original,
        thumbnailURL: sizes.thumb?.url ?? original,
        sizes,
      }
    }
    if (item && typeof item === 'object') {
      return Object.fromEntries(Object.entries(item).map(([key, inner]) => [key, walk(inner)]))
    }
    return item
  }
  return walk(value) as T
}

type TreeEntry = { path: string; mode: string; type: string; sha: string }

const call = async <T>(config: GitHubImagesConfig, path: string, init?: RequestInit) => {
  const response = await github(config, path, init)
  if (!response.ok) {
    throw new Error(
      `GitHub ${init?.method ?? 'GET'} ${path} failed (${response.status}) ${(await response.text()).slice(0, 200)}`,
    )
  }
  return (await response.json()) as T
}

/** Runs tasks a few at a time. */
const pool = async <T, R>(items: T[], size: number, task: (item: T) => Promise<R>) => {
  const results: R[] = []
  for (let index = 0; index < items.length; index += size) {
    results.push(...(await Promise.all(items.slice(index, index + size).map(task))))
  }
  return results
}

export type ImageSyncResult = {
  configured: boolean
  added: number
  removed: number
  rewritten: boolean
  missing: string[]
}

export const syncPublicImages = (
  payload: Payload,
  req?: PayloadRequest,
): Promise<ImageSyncResult> =>
  serially(async () => {
    const config = githubImagesConfig()
    if (!config) return { configured: false, added: 0, removed: 0, rewritten: false, missing: [] }

    const [meta, articles, live] = await Promise.all([
      exportMeta(payload, ''),
      exportAllArticles(payload),
      exportLiveBlogs(payload, req),
    ])
    const needed = collectImageFiles([meta, articles, live])

    const repo = `/repos/${config.public}`
    const branch = encodeURIComponent(config.branch)
    const head = await call<{ object: { sha: string } }>(config, `${repo}/git/ref/heads/${branch}`)
    const commit = await call<{ tree: { sha: string } }>(
      config,
      `${repo}/git/commits/${head.object.sha}`,
    )
    const tree = await call<{ tree: TreeEntry[]; truncated?: boolean }>(
      config,
      `${repo}/git/trees/${commit.tree.sha}?recursive=1`,
    )
    if (tree.truncated) throw new Error('The public image repository is too large to list.')

    const files = tree.tree.filter((entry) => entry.type === 'blob')
    const current = new Map(files.map((entry) => [entry.path, entry]))
    const isImage = (path: string) => path.startsWith(`${MEDIA_DIR}/`)
    const toAdd = [...needed].filter((path) => !current.has(path))
    const toRemove = files.filter((entry) => isImage(entry.path) && !needed.has(entry.path))
    const needsNoJekyll = !current.has('.nojekyll')
    if (toAdd.length === 0 && toRemove.length === 0 && !needsNoJekyll) {
      return { configured: true, added: 0, removed: 0, rewritten: false, missing: [] }
    }

    // Copy new files from the drafts repository as blobs in the public one.
    const missing: string[] = []
    const added = (
      await pool(toAdd, 5, async (path) => {
        const bytes = await readFile(config, config.drafts, path)
        if (!bytes) {
          missing.push(path)
          return null
        }
        const blob = await call<{ sha: string }>(config, `${repo}/git/blobs`, {
          method: 'POST',
          body: JSON.stringify({ content: bytes.toString('base64'), encoding: 'base64' }),
        })
        return { path, mode: '100644', type: 'blob', sha: blob.sha }
      })
    ).filter((entry): entry is TreeEntry => entry !== null)
    if (needsNoJekyll) {
      // Tells GitHub Pages to serve files as they are, without building a site.
      const blob = await call<{ sha: string }>(config, `${repo}/git/blobs`, {
        method: 'POST',
        body: JSON.stringify({ content: '', encoding: 'utf-8' }),
      })
      added.push({ path: '.nojekyll', mode: '100644', type: 'blob', sha: blob.sha })
    }

    if (added.length === 0 && toRemove.length === 0) {
      if (missing.length > 0) {
        payload.logger.warn({ msg: 'Images missing from the drafts repository', missing })
      }
      return { configured: true, added: 0, removed: 0, rewritten: false, missing }
    }

    const rewrite = toRemove.length > 0
    const removing = new Set(toRemove.map((entry) => entry.path))
    const newTree = await call<{ sha: string }>(config, `${repo}/git/trees`, {
      method: 'POST',
      body: JSON.stringify(
        rewrite
          ? {
              // A complete tree with no history: what stays, plus what's new.
              tree: [
                ...files
                  .filter((entry) => !removing.has(entry.path))
                  .map(({ path, mode, type, sha }) => ({ path, mode, type, sha })),
                ...added,
              ],
            }
          : { base_tree: commit.tree.sha, tree: added },
      ),
    })
    const message = rewrite
      ? `Public images as of ${new Date().toISOString()} (history cleared after removing ${toRemove.length} files)`
      : `Publish ${added.length} image files`
    const next = await call<{ sha: string }>(config, `${repo}/git/commits`, {
      method: 'POST',
      body: JSON.stringify({
        message,
        tree: newTree.sha,
        parents: rewrite ? [] : [head.object.sha],
      }),
    })
    await call(config, `${repo}/git/refs/heads/${branch}`, {
      method: 'PATCH',
      body: JSON.stringify({ sha: next.sha, force: rewrite }),
    })

    if (missing.length > 0) {
      payload.logger.warn({ msg: 'Images missing from the drafts repository', missing })
    }
    return {
      configured: true,
      added: added.length - (needsNoJekyll ? 1 : 0),
      removed: toRemove.length,
      rewritten: rewrite,
      missing,
    }
  })
