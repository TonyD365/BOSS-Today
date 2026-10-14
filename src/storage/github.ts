import type { Adapter, GeneratedAdapter } from '@payloadcms/plugin-cloud-storage/types'

/**
 * Stores uploads as files in a GitHub repository and serves them from
 * GitHub Pages (or any CDN in front of the repository).
 *
 * GITHUB_IMAGES_REPO      owner/repo, e.g. boss-today/images
 * GITHUB_IMAGES_TOKEN     fine-grained token with Contents: read & write on that repo
 * GITHUB_IMAGES_BRANCH    default: main
 * GITHUB_IMAGES_BASE_URL  default: https://<owner>.github.io/<repo>
 */
export type GitHubStorageConfig = {
  repo: string
  token: string
  branch: string
  baseUrl: string
  apiUrl: string
}

export const githubStorageConfig = (): GitHubStorageConfig | null => {
  const repo = process.env.GITHUB_IMAGES_REPO?.trim()
  const token = process.env.GITHUB_IMAGES_TOKEN?.trim()
  if (!repo || !token) return null
  const [owner, name] = repo.split('/')
  return {
    repo,
    token,
    branch: process.env.GITHUB_IMAGES_BRANCH?.trim() || 'main',
    baseUrl: (
      process.env.GITHUB_IMAGES_BASE_URL?.trim() || `https://${owner}.github.io/${name}`
    ).replace(/\/$/, ''),
    apiUrl: (process.env.GITHUB_API_URL?.trim() || 'https://api.github.com').replace(/\/$/, ''),
  }
}

const encodePath = (path: string) => path.split('/').map(encodeURIComponent).join('/')

/** Commits to one branch must not overlap, so every write waits its turn. */
let queue: Promise<unknown> = Promise.resolve()
const serially = <T>(task: () => Promise<T>): Promise<T> => {
  const run = queue.then(task, task)
  queue = run.catch(() => undefined)
  return run
}

export const githubAdapter =
  (config: GitHubStorageConfig): Adapter =>
  ({ prefix = 'media' }): GeneratedAdapter => {
    const pathFor = (filename: string, docPrefix?: string) =>
      [docPrefix ?? prefix, filename].filter(Boolean).join('/')

    const api = async (path: string, init: RequestInit = {}, query = '') =>
      fetch(`${config.apiUrl}/repos/${config.repo}/contents/${encodePath(path)}${query}`, {
        ...init,
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${config.token}`,
          'X-GitHub-Api-Version': '2022-11-28',
          ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        },
      })

    const currentSha = async (path: string): Promise<string | undefined> => {
      const response = await api(path, {}, `?ref=${encodeURIComponent(config.branch)}`)
      if (response.status === 404) return undefined
      if (!response.ok) throw new Error(`GitHub: could not read ${path} (${response.status})`)
      return ((await response.json()) as { sha?: string }).sha
    }

    const put = async (path: string, content: string) => {
      for (let attempt = 0; attempt < 3; attempt++) {
        const sha = attempt === 0 ? undefined : await currentSha(path)
        const response = await api(path, {
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
        const response = await api(path, {
          method: 'DELETE',
          body: JSON.stringify({ message: `Delete ${path}`, sha, branch: config.branch }),
        })
        if (response.ok || response.status === 404) return
        if (response.status !== 409 && response.status !== 422) {
          throw new Error(`GitHub: delete of ${path} failed (${response.status})`)
        }
      }
    }

    const urlFor = (filename: string, docPrefix?: string) =>
      `${config.baseUrl}/${encodePath(pathFor(filename, docPrefix))}`

    return {
      name: 'github',
      generateURL: ({ filename, prefix: docPrefix }) => urlFor(filename, docPrefix),
      handleUpload: ({ file, data }) =>
        serially(() => put(pathFor(file.filename, data?.prefix), file.buffer.toString('base64'))),
      handleDelete: ({ filename, doc }) => serially(() => remove(pathFor(filename, doc.prefix))),
      // Image URLs point straight at the CDN, so this is only a fallback for direct API requests.
      staticHandler: (_req, { params }) =>
        Response.redirect(urlFor(params.filename, params.prefix), 302),
    }
  }
