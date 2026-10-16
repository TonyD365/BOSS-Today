import type { Adapter, GeneratedAdapter } from '@payloadcms/plugin-cloud-storage/types'

/**
 * Images live in two GitHub repositories:
 *
 * - a private drafts repository, where every upload goes. Staff see these
 *   through the newsroom (signed in), never directly.
 * - a public repository served by GitHub Pages, holding only images that
 *   published content uses. It is filled when an issue is published and
 *   emptied of anything withdrawn (see publicImages.ts).
 *
 * GITHUB_DRAFTS_REPO      owner/repo (private)
 * GITHUB_IMAGES_REPO      owner/repo (public, with GitHub Pages on)
 * GITHUB_IMAGES_TOKEN     fine-grained token, Contents: read & write on both
 * GITHUB_IMAGES_BRANCH    default: main (both repositories)
 * GITHUB_IMAGES_BASE_URL  default: https://<owner>.github.io/<public repo>
 */
export type GitHubImagesConfig = {
  token: string
  branch: string
  apiUrl: string
  drafts: string
  public: string
  baseUrl: string
}

export const MEDIA_DIR = 'media'

export const githubImagesConfig = (): GitHubImagesConfig | null => {
  const drafts = process.env.GITHUB_DRAFTS_REPO?.trim()
  const publicRepo = process.env.GITHUB_IMAGES_REPO?.trim()
  const token = process.env.GITHUB_IMAGES_TOKEN?.trim()
  if (!drafts || !publicRepo || !token) return null
  const [owner, name] = publicRepo.split('/')
  return {
    token,
    drafts,
    public: publicRepo,
    branch: process.env.GITHUB_IMAGES_BRANCH?.trim() || 'main',
    baseUrl: (
      process.env.GITHUB_IMAGES_BASE_URL?.trim() || `https://${owner}.github.io/${name}`
    ).replace(/\/$/, ''),
    apiUrl: (process.env.GITHUB_API_URL?.trim() || 'https://api.github.com').replace(/\/$/, ''),
  }
}

export const encodePath = (path: string) => path.split('/').map(encodeURIComponent).join('/')

/** A GitHub REST call with the images token. */
export const github = (config: GitHubImagesConfig, path: string, init: RequestInit = {}) =>
  fetch(`${config.apiUrl}${path}`, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${config.token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers as Record<string, string> | undefined),
    },
  })

/** The raw bytes of a file in one of the image repositories, or null if it isn't there. */
export const readFile = async (config: GitHubImagesConfig, repo: string, path: string) => {
  const response = await github(
    config,
    `/repos/${repo}/contents/${encodePath(path)}?ref=${encodeURIComponent(config.branch)}`,
    { headers: { Accept: 'application/vnd.github.raw' } },
  )
  if (response.status === 404) return null
  if (!response.ok) throw new Error(`GitHub: could not read ${path} (${response.status})`)
  return Buffer.from(await response.arrayBuffer())
}

/** Commits to one branch must not overlap, so every write waits its turn. */
let queue: Promise<unknown> = Promise.resolve()
export const serially = <T>(task: () => Promise<T>): Promise<T> => {
  const run = queue.then(task, task)
  queue = run.catch(() => undefined)
  return run
}

const TYPES: Record<string, string> = {
  webp: 'image/webp',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  avif: 'image/avif',
  svg: 'image/svg+xml',
}

/** Uploads go to the private drafts repository; the newsroom serves them to staff. */
export const draftsAdapter =
  (config: GitHubImagesConfig): Adapter =>
  ({ prefix = MEDIA_DIR }): GeneratedAdapter => {
    const pathFor = (filename: string, docPrefix?: string) =>
      [docPrefix ?? prefix, filename].filter(Boolean).join('/')
    const contents = (path: string) => `/repos/${config.drafts}/contents/${encodePath(path)}`

    const currentSha = async (path: string): Promise<string | undefined> => {
      const response = await github(
        config,
        `${contents(path)}?ref=${encodeURIComponent(config.branch)}`,
      )
      if (response.status === 404) return undefined
      if (!response.ok) throw new Error(`GitHub: could not read ${path} (${response.status})`)
      return ((await response.json()) as { sha?: string }).sha
    }

    const put = async (path: string, content: string) => {
      for (let attempt = 0; attempt < 3; attempt++) {
        const sha = attempt === 0 ? undefined : await currentSha(path)
        const response = await github(config, contents(path), {
          method: 'PUT',
          body: JSON.stringify({
            message: `Upload ${path}`,
            content,
            branch: config.branch,
            ...(sha ? { sha } : {}),
          }),
        })
        if (response.ok) return
        // 409/422: the file exists or the branch moved — fetch the sha and retry.
        if (response.status !== 409 && response.status !== 422) {
          throw new Error(
            `GitHub: upload of ${path} failed (${response.status}) ${await response.text()}`,
          )
        }
      }
      throw new Error(`GitHub: upload of ${path} kept conflicting`)
    }

    const remove = async (path: string) => {
      for (let attempt = 0; attempt < 3; attempt++) {
        const sha = await currentSha(path)
        if (!sha) return
        const response = await github(config, contents(path), {
          method: 'DELETE',
          body: JSON.stringify({ message: `Delete ${path}`, sha, branch: config.branch }),
        })
        if (response.ok || response.status === 404) return
        if (response.status !== 409 && response.status !== 422) {
          throw new Error(`GitHub: delete of ${path} failed (${response.status})`)
        }
      }
    }

    return {
      name: 'github-drafts',
      handleUpload: ({ file, data }) =>
        serially(() => put(pathFor(file.filename, data?.prefix), file.buffer.toString('base64'))),
      handleDelete: ({ filename, doc }) => serially(() => remove(pathFor(filename, doc.prefix))),
      // Payload checks the Media read access (staff only) before calling this.
      staticHandler: async (_req, { params }) => {
        const file = await readFile(config, config.drafts, pathFor(params.filename, params.prefix))
        if (!file) return new Response('Not found', { status: 404 })
        const extension = params.filename.split('.').pop()?.toLowerCase() ?? ''
        return new Response(new Uint8Array(file), {
          headers: {
            'Content-Type': TYPES[extension] ?? 'application/octet-stream',
            'Cache-Control': 'private, max-age=86400',
          },
        })
      },
    }
  }
