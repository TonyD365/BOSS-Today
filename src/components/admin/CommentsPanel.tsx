'use client'

import { Button, useAuth, useDocumentInfo, useFormFields } from '@payloadcms/ui'
import React, { useCallback, useEffect, useRef, useState } from 'react'

type Person = { id: number; name?: string }
type Comment = {
  id: number
  parent?: number | { id: number } | null
  quote?: string | null
  anchor?: number | null
  body: string
  author?: Person | number | null
  resolved?: boolean | null
  resolvedBy?: Person | number | null
  createdAt: string
}
type Thread = Comment & { replies: Comment[] }
type PanelUser = { id: number; role?: string; isSuperAdmin?: boolean }

const HIGHLIGHT = 'boss-comment'
const ACTIVE = 'boss-comment-active'

const idOf = (value: unknown) =>
  value && typeof value === 'object' ? Number((value as { id: unknown }).id) : Number(value)
const nameOf = (value: unknown) =>
  value && typeof value === 'object' ? ((value as Person).name ?? 'Someone') : 'Someone'
const when = (value: string) =>
  new Intl.DateTimeFormat('en-CA', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))

/** The story editor on the page (Lexical marks its root). */
const editorRoot = () =>
  document.querySelector<HTMLElement>(
    '.field-type.richText [data-lexical-editor="true"], [data-lexical-editor="true"]',
  )

/**
 * Every letter of the editor's text, ignoring spaces, with where it sits in the
 * page. Passages are matched without spaces so line breaks and formatting
 * don't stop a comment from finding its text.
 */
const letters = (root: HTMLElement) => {
  const chars: { node: Text; offset: number }[] = []
  let text = ''
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  for (let node = walker.nextNode() as Text | null; node; node = walker.nextNode() as Text | null) {
    const value = node.data
    for (let i = 0; i < value.length; i++) {
      if (/\s/.test(value[i])) continue
      chars.push({ node, offset: i })
      text += value[i]
    }
  }
  return { chars, text }
}

const squash = (value: string) => value.replace(/\s+/g, '')

/** The range for a thread's passage, choosing the match nearest where it was written. */
const locate = (
  map: ReturnType<typeof letters>,
  quote: string | null | undefined,
  anchor: number | null | undefined,
): Range | null => {
  const needle = squash(quote ?? '')
  if (!needle) return null
  let best = -1
  for (let at = map.text.indexOf(needle); at !== -1; at = map.text.indexOf(needle, at + 1)) {
    if (best === -1 || Math.abs(at - (anchor ?? 0)) < Math.abs(best - (anchor ?? 0))) best = at
  }
  if (best === -1) return null
  const start = map.chars[best]
  const end = map.chars[best + needle.length - 1]
  const range = document.createRange()
  range.setStart(start.node, start.offset)
  range.setEnd(end.node, end.offset + 1)
  return range
}

type HighlightRegistry = {
  set: (name: string, value: unknown) => void
  delete: (name: string) => void
}
const highlights = (): HighlightRegistry | null =>
  typeof CSS !== 'undefined' && 'highlights' in CSS
    ? ((CSS as unknown as { highlights: HighlightRegistry }).highlights ?? null)
    : null
const makeHighlight = (ranges: Range[]) =>
  new (window as unknown as { Highlight: new (...r: Range[]) => unknown }).Highlight(...ranges)

/** Every comment on a story, grouped into threads with their replies. */
const fetchThreads = async (article: number | string): Promise<Thread[]> => {
  const query = new URLSearchParams({
    'where[article][equals]': String(article),
    depth: '1',
    limit: '500',
    sort: 'createdAt',
  })
  const response = await fetch(`/api/comments?${query}`, { credentials: 'include' })
  if (!response.ok) return []
  const { docs } = (await response.json()) as { docs: Comment[] }
  return docs
    .filter((doc) => !doc.parent)
    .map((root) => ({
      ...root,
      replies: docs.filter((doc) => doc.parent && idOf(doc.parent) === root.id),
    }))
}

/**
 * Comments on passages of the story, like a shared document. They are stored
 * apart from the story itself, so they can never reach the website or print;
 * the yellow marks exist only in this browser.
 */
export function CommentsPanel() {
  const { id } = useDocumentInfo()
  const { user } = useAuth<PanelUser>()
  const content = useFormFields(([fields]) => fields.content?.value)
  const [threads, setThreads] = useState<Thread[]>([])
  const [selection, setSelection] = useState<{ quote: string; anchor: number } | null>(null)
  const [draft, setDraft] = useState<{ quote: string; anchor: number; body: string } | null>(null)
  const [replies, setReplies] = useState<Record<number, string>>({})
  const [active, setActive] = useState<number | null>(null)
  const [missing, setMissing] = useState<Set<number>>(new Set())
  const [showResolved, setShowResolved] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const ranges = useRef(new Map<number, Range>())

  const load = useCallback(async () => {
    if (id) setThreads(await fetchThreads(id))
  }, [id])

  useEffect(() => {
    let cancelled = false
    if (id) {
      fetchThreads(id)
        .then((loaded) => {
          if (!cancelled) setThreads(loaded)
        })
        .catch(() => undefined)
    }
    return () => {
      cancelled = true
    }
  }, [id])

  // Remember the last passage selected inside the story editor.
  useEffect(() => {
    const onChange = () => {
      const root = editorRoot()
      const current = document.getSelection()
      if (!root || !current || current.rangeCount === 0 || current.isCollapsed) return
      const range = current.getRangeAt(0)
      if (!root.contains(range.commonAncestorContainer)) return
      const quote = current.toString().trim()
      if (!squash(quote)) return
      const before = document.createRange()
      before.setStart(root, 0)
      before.setEnd(range.startContainer, range.startOffset)
      setSelection({ quote: quote.slice(0, 600), anchor: squash(before.toString()).length })
    }
    document.addEventListener('selectionchange', onChange)
    return () => document.removeEventListener('selectionchange', onChange)
  }, [])

  // Mark open threads' passages in the editor, again whenever the text changes.
  useEffect(() => {
    const timer = setTimeout(() => {
      const root = editorRoot()
      const registry = highlights()
      if (!root) return
      const map = letters(root)
      const found = new Map<number, Range>()
      const lost = new Set<number>()
      for (const thread of threads) {
        if (!thread.quote) continue
        const range = locate(map, thread.quote, thread.anchor)
        if (range) found.set(thread.id, range)
        else lost.add(thread.id)
      }
      ranges.current = found
      setMissing(lost)
      if (!registry) return
      const open = threads.filter((thread) => !thread.resolved && found.has(thread.id))
      registry.set(HIGHLIGHT, makeHighlight(open.map((thread) => found.get(thread.id)!)))
      const activeRange = active ? found.get(active) : undefined
      if (activeRange) registry.set(ACTIVE, makeHighlight([activeRange]))
      else registry.delete(ACTIVE)
    }, 250)
    return () => clearTimeout(timer)
  }, [threads, content, active])

  useEffect(
    () => () => {
      highlights()?.delete(HIGHLIGHT)
      highlights()?.delete(ACTIVE)
    },
    [],
  )

  if (!id) {
    return (
      <Box>
        <p style={hint}>Save the story first to add comments.</p>
      </Box>
    )
  }

  const send = async (url: string, method: string, body: unknown) => {
    setBusy(true)
    setError(null)
    try {
      const response = await fetch(url, {
        method,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const result = (await response.json().catch(() => ({}))) as {
        message?: string
        errors?: { message?: string }[]
      }
      if (!response.ok) {
        setError(result.errors?.[0]?.message ?? result.message ?? 'Could not save the comment.')
        return false
      }
      await load()
      return true
    } finally {
      setBusy(false)
    }
  }

  const focus = (thread: Thread) => {
    setActive(thread.id)
    const range = ranges.current.get(thread.id)
    const target = range?.startContainer.parentElement
    target?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  const open = threads.filter((thread) => !thread.resolved)
  const resolved = threads.filter((thread) => thread.resolved)
  const listed = showResolved ? [...open, ...resolved] : open

  return (
    <Box>
      <strong style={{ fontSize: 13 }}>
        Comments{open.length ? ` (${open.length} open)` : ''}
      </strong>

      {!draft ? (
        <Button
          buttonStyle="secondary"
          size="small"
          margin={false}
          disabled={!selection || busy}
          onClick={() => selection && setDraft({ ...selection, body: '' })}
        >
          {selection ? 'Comment on selected text' : 'Select text in the story to comment'}
        </Button>
      ) : (
        <div style={{ display: 'grid', gap: 6 }}>
          <Quote text={draft.quote} />
          <textarea
            rows={3}
            autoFocus
            value={draft.body}
            onChange={(event) => setDraft({ ...draft, body: event.target.value })}
            placeholder="What should change?"
            style={textarea}
          />
          <div style={{ display: 'flex', gap: 6 }}>
            <Button
              buttonStyle="primary"
              size="small"
              margin={false}
              disabled={busy || !draft.body.trim()}
              onClick={async () => {
                const ok = await send('/api/comments', 'POST', {
                  article: id,
                  quote: draft.quote,
                  anchor: draft.anchor,
                  body: draft.body.trim(),
                })
                if (ok) {
                  setDraft(null)
                  setSelection(null)
                }
              }}
            >
              Comment
            </Button>
            <Button
              buttonStyle="secondary"
              size="small"
              margin={false}
              disabled={busy}
              onClick={() => setDraft(null)}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {error && <p style={{ ...hint, color: 'var(--theme-error-500)', opacity: 1 }}>{error}</p>}

      {listed.length === 0 && <p style={hint}>No open comments.</p>}
      {listed.map((thread) => (
        <div
          key={thread.id}
          onClick={() => focus(thread)}
          style={{
            display: 'grid',
            gap: 6,
            padding: 10,
            borderRadius: 4,
            cursor: 'pointer',
            opacity: thread.resolved ? 0.6 : 1,
            border: `1px solid ${active === thread.id ? 'var(--theme-warning-500)' : 'var(--theme-elevation-150)'}`,
          }}
        >
          {thread.quote && <Quote text={thread.quote} />}
          {missing.has(thread.id) && thread.quote && (
            <span style={{ ...hint, fontStyle: 'italic' }}>The original text has changed.</span>
          )}
          {[thread, ...thread.replies].map((comment) => (
            <div key={comment.id} style={{ fontSize: 13 }}>
              <div style={{ fontSize: 12, opacity: 0.7 }}>
                <b>{nameOf(comment.author)}</b> · {when(comment.createdAt)}
              </div>
              <div style={{ whiteSpace: 'pre-wrap' }}>{comment.body}</div>
            </div>
          ))}
          {thread.resolved ? (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12 }}>
              <span style={{ opacity: 0.7 }}>Resolved by {nameOf(thread.resolvedBy)}</span>
              <button
                type="button"
                style={textButton}
                disabled={busy}
                onClick={(event) => {
                  event.stopPropagation()
                  send(`/api/comments/${thread.id}`, 'PATCH', { resolved: false })
                }}
              >
                Reopen
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 6 }} onClick={(event) => event.stopPropagation()}>
              <textarea
                rows={1}
                value={replies[thread.id] ?? ''}
                onChange={(event) => setReplies({ ...replies, [thread.id]: event.target.value })}
                placeholder="Reply"
                style={textarea}
              />
              <div style={{ display: 'flex', gap: 10 }}>
                {(replies[thread.id] ?? '').trim() && (
                  <button
                    type="button"
                    style={textButton}
                    disabled={busy}
                    onClick={async () => {
                      const ok = await send('/api/comments', 'POST', {
                        article: id,
                        parent: thread.id,
                        body: replies[thread.id].trim(),
                      })
                      if (ok) setReplies({ ...replies, [thread.id]: '' })
                    }}
                  >
                    Reply
                  </button>
                )}
                <button
                  type="button"
                  style={textButton}
                  disabled={busy}
                  onClick={() => send(`/api/comments/${thread.id}`, 'PATCH', { resolved: true })}
                >
                  Resolve
                </button>
              </div>
            </div>
          )}
        </div>
      ))}

      {resolved.length > 0 && (
        <button type="button" style={textButton} onClick={() => setShowResolved(!showResolved)}>
          {showResolved ? 'Hide resolved' : `Show resolved (${resolved.length})`}
        </button>
      )}
      {user && open.length > 0 && (
        <p style={hint}>A story can’t be approved while comments are open.</p>
      )}
    </Box>
  )
}

function Box({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="comments-panel"
      style={{
        display: 'grid',
        gap: 10,
        marginBottom: 24,
        padding: 12,
        border: '1px solid var(--theme-elevation-150)',
        borderRadius: 4,
      }}
    >
      {children}
    </div>
  )
}

function Quote({ text }: { text: string }) {
  return (
    <span
      style={{
        fontSize: 12,
        fontStyle: 'italic',
        paddingLeft: 8,
        borderLeft: '3px solid var(--theme-warning-500)',
        opacity: 0.85,
      }}
    >
      “{text.length > 140 ? `${text.slice(0, 140)}…` : text}”
    </span>
  )
}

const hint: React.CSSProperties = { margin: 0, fontSize: 12, opacity: 0.7 }
const textarea: React.CSSProperties = { width: '100%', font: 'inherit', fontSize: 13, padding: 6 }
const textButton: React.CSSProperties = {
  padding: 0,
  border: 0,
  background: 'none',
  color: 'inherit',
  font: 'inherit',
  fontSize: 12,
  fontWeight: 600,
  textDecoration: 'underline',
  cursor: 'pointer',
}
