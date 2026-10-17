'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { makeElement, pageStarter } from '@/design/defaults'
import { DEFAULT_SANS, FONTS, fontsUrl } from '@/design/fonts'
import { canvasSize, type DArticle, type DesignData, type DImage } from '@/design/render'
import { plainParagraphs } from '@/design/richtext'
import { chromeProblems, cleanDesign, contrastProblems } from '@/design/sanitize'
import {
  type Design,
  type DesignElement,
  type ElementType,
  type Geometry,
  SHAPES,
  type ShapeKind,
  ARTICLE_PARTS,
  type ArticlePart,
  type PageTemplate,
  SITE_PARTS,
  TEMPLATE_KINDS,
  TEMPLATE_SLOTS,
  type TemplateKind,
  type TemplateSlot,
  type Templates,
} from '@/design/types'

import { DeployProgress } from '../DeployProgress'
import { IconPicker } from './IconPicker'
import { Inspector } from './Inspector'
import { SITE_PART_NAMES } from './names'
import {
  addElement,
  type Align,
  align,
  distribute,
  duplicates,
  expandGroups,
  geometryMap,
  group,
  type Order,
  pasteElements,
  removeElements,
  reorder,
  setGeometry,
  ungroup,
  updateElements,
  type View,
} from './operations'
import { Stage } from './Stage'
import { TemplatePicker } from './TemplatePicker'
import { format, formatColor, formatSize } from './textEditing'
import '@/design/design.css'
import './designer.css'

/** What the designer is editing: the front page, header or footer, or a custom page. */
export type Target =
  | { kind: 'global'; field: 'design' | 'header' | 'footer' }
  | { kind: 'page'; id: number; title: string }
  | { kind: 'template'; template: TemplateKind; slot: TemplateSlot }

const TARGET_NAMES = { design: 'Front page', header: 'Header', footer: 'Footer' } as const

export const TEMPLATE_NAMES: Record<TemplateKind, string> = {
  article: 'Story pages',
  section: 'Section pages',
  tag: 'Topic pages',
  author: 'Author pages',
  issue: 'Issue pages',
  other: 'Other pages (search, scores, calendar…)',
}
const SLOT_NAMES: Record<TemplateSlot, string> = {
  above: 'Above the content',
  side: 'Beside the content',
  below: 'Below the content',
}
const ARTICLE_PART_NAMES: Record<ArticlePart, string> = {
  summary: 'Summary',
  byline: 'Byline and date',
  reading: 'Reading time',
  share: 'Share buttons',
  tags: 'Topics',
  authors: 'About the author',
}

const targetUrl = (t: Target) =>
  t.kind === 'page'
    ? `/admin/site-designer?page=${t.id}`
    : t.kind === 'template'
      ? `/admin/site-designer?template=${t.template}&slot=${t.slot}`
      : t.field === 'design'
        ? '/admin/site-designer'
        : `/admin/site-designer?part=${t.field}`

type Props = {
  target: Target
  /** Editing the header: the footer as saved (or null for the classic one), and the other way round. */
  other: Design | null
  /** Every page template as saved, and the settings of the one being edited. */
  templates: Templates
  template: PageTemplate | null
  initial: Design
  published: boolean
  /** False when nothing has been saved yet and the canvas shows the classic page. */
  saved: boolean
  canEdit: boolean
  canPublishNow: boolean
}

const HISTORY = 100

/** What an element shows rather than how it looks; copying a style leaves these alone. */
const CONTENT_KEYS: Partial<Record<ElementType, string[]>> = {
  text: ['paragraphs'],
  image: ['mediaId', 'link', 'crop'],
  story: ['source', 'articleId', 'sectionId', 'index'],
  list: ['kind', 'sectionId', 'title', 'count'],
  widget: ['kind', 'title', 'count'],
  site: ['kind'],
  icon: ['name', 'paths'],
  table: ['rows'],
}

/** When each design in the history was made, for the History panel. */
const madeAt = new WeakMap<Design, number>()

const describeChange = (before: Design, after: Design) => {
  const a = before.desktop.elements
  const b = after.desktop.elements
  const kept = new Set(a.map((el) => el.id))
  if (a.length > 0 && b.length > 0 && !b.some((el) => kept.has(el.id)))
    return 'Replaced the whole layout'
  if (b.length > a.length)
    return `Added ${b.length - a.length === 1 ? 'an item' : `${b.length - a.length} items`}`
  if (b.length < a.length)
    return `Deleted ${a.length - b.length === 1 ? 'an item' : `${a.length - b.length} items`}`
  const old = new Map(a.map((el) => [el.id, JSON.stringify(el)]))
  const changed = b.filter((el) => old.get(el.id) !== JSON.stringify(el))
  if (changed.length === 0) {
    if (JSON.stringify(before.guides) !== JSON.stringify(after.guides)) return 'Moved a guide'
    if (JSON.stringify(before.phone) !== JSON.stringify(after.phone)) return 'Phone layout'
    return 'Page settings'
  }
  if (changed.length > 1) return `Changed ${changed.length} items`
  return `Changed ${label(changed[0])}`
}
const empty: DesignData = { articles: [], byId: {}, media: {}, issue: null }

/** The site designer: a Canva-style canvas for the front page. */
export function Designer({
  target,
  other,
  templates: initialTemplates,
  template: initialTemplate,
  initial,
  published,
  saved,
  canEdit,
  canPublishNow,
}: Props) {
  const [design, setDesign] = useState<Design>(initial)
  const [past, setPast] = useState<Design[]>([])
  const [future, setFuture] = useState<Design[]>([])
  const [selection, setSelection] = useState<string[]>([])
  const [view, setView] = useState<View>('desktop')
  const [zoom, setZoom] = useState(0.6)
  const [fit, setFit] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [overflow, setOverflow] = useState<Set<string>>(new Set())
  const [data, setData] = useState<DesignData>(empty)
  const [sections, setSections] = useState<{ id: number; name: string }[]>([])
  const [pages, setPages] = useState<{ id: number; title: string }[]>([])
  const [showGrid, setShowGrid] = useState(false)
  const [rulers, setRulers] = useState(false)
  const [menu, setMenu] = useState<{ x: number; y: number; id: string | null } | null>(null)
  const [status, setStatus] = useState<'saved' | 'unsaved' | 'saving' | 'error'>('saved')
  const [message, setMessage] = useState<string | null>(null)
  const [lock, setLock] = useState<{ ok: boolean; heldBy?: string }>({ ok: canEdit })
  const [deploymentId, setDeploymentId] = useState<number | null>(null)
  const [isPublished, setIsPublished] = useState(published)
  const [hasSaved, setHasSaved] = useState(saved)
  // Only changes someone makes are saved; boxes resizing to fit their text are not.
  const [dirty, setDirty] = useState(false)
  const [clipboard, setClipboard] = useState<DesignElement[]>([])
  const [iconsOpen, setIconsOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [templatesOpen, setTemplatesOpen] = useState(false)
  const [copiedStyle, setCopiedStyle] = useState<{
    type: ElementType
    style: Record<string, unknown>
  } | null>(null)
  const stageBox = useRef<HTMLDivElement>(null)
  const savedJson = useRef(JSON.stringify(initial))
  const leaving = useRef(false)
  const templates = useRef(initialTemplates)
  const [tpl, setTpl] = useState(initialTemplate)

  const readOnly = !canEdit || !lock.ok
  const shown = status === 'saved' && dirty ? 'unsaved' : status
  const size = canvasSize(design, view)
  const geometry = useMemo(() => geometryMap(design, view), [design, view])
  const problems = useMemo(() => contrastProblems(design), [design])
  const selected = design.desktop.elements.filter((el) => selection.includes(el.id))

  // --- History
  const commit = useCallback((next: Design, before: Design) => {
    setPast((p) => [...p.slice(-HISTORY + 1), before])
    setFuture([])
    madeAt.set(next, Date.now())
    setDesign(next)
    setDirty(true)
  }, [])
  const chrome = target.kind === 'global' && target.field !== 'design' ? target.field : null
  const chromeRules = (d: Design) =>
    chrome === 'header'
      ? chromeProblems(d, other)
      : chrome === 'footer'
        ? chromeProblems(other, d)
        : []
  const change = (fn: (d: Design) => Design) => {
    if (readOnly) return
    const next = fn(design)
    // The navigation and staff sign-in can be restyled and moved, never removed.
    const broken = chromeRules(next)
    if (broken.length > 0 && chromeRules(design).length === 0) {
      setMessage(broken[0])
      return
    }
    commit(next, design)
  }
  const undo = () => {
    if (past.length === 0) return
    setFuture((f) => [design, ...f])
    setDesign(past[past.length - 1])
    setPast((p) => p.slice(0, -1))
    setDirty(true)
  }
  const redo = () => {
    if (future.length === 0) return
    setPast((p) => [...p, design])
    setDesign(future[0])
    setFuture((f) => f.slice(1))
    setDirty(true)
  }

  // --- Live content for the canvas
  useEffect(() => {
    fetch('/api/globals/site-design/preview-data', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then(
        (
          body: {
            data: DesignData
            sections: { id: number; name: string }[]
            pages: { id: number; title: string }[]
          } | null,
        ) => {
          if (!body) return
          setSections(body.sections)
          setPages(body.pages ?? [])
          setData((d) => ({ ...body.data, media: { ...body.data.media, ...d.media } }))
        },
      )
      .catch(() => undefined)
    const ids = initial.desktop.elements.flatMap((el) =>
      el.type === 'image' && el.props.mediaId ? [el.props.mediaId] : [],
    )
    if (ids.length > 0) {
      fetch(`/api/media?where[id][in]=${ids.join(',')}&limit=${ids.length}&depth=0`, {
        credentials: 'include',
      })
        .then((r) => (r.ok ? r.json() : { docs: [] }))
        .then(
          (body: {
            docs: { id: number; url: string; alt: string; sizes?: { card?: { url?: string } } }[]
          }) => {
            const media: Record<number, DImage> = {}
            for (const m of body.docs)
              media[m.id] = { url: m.sizes?.card?.url ?? m.url, alt: m.alt }
            setData((d) => ({ ...d, media: { ...d.media, ...media } }))
          },
        )
        .catch(() => undefined)
    }
  }, [initial])

  // --- One editor at a time
  const claimLock = useCallback(
    async (takeOver = false) => {
      if (!canEdit) return
      const response = await fetch('/api/globals/site-design/lock', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ takeOver }),
      }).catch(() => null)
      const body = (await response?.json().catch(() => ({}))) as { ok?: boolean; heldBy?: string }
      setLock({ ok: Boolean(body?.ok), heldBy: body?.heldBy })
    },
    [canEdit],
  )
  useEffect(() => {
    if (!canEdit) return
    // Claiming the lock is a request to the server; it sets state when the reply comes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    claimLock()
    const timer = setInterval(() => claimLock(), 30_000)
    const release = () =>
      navigator.sendBeacon?.(
        '/api/globals/site-design/lock',
        new Blob([JSON.stringify({ release: true })], { type: 'application/json' }),
      )
    window.addEventListener('pagehide', release)
    return () => {
      clearInterval(timer)
      window.removeEventListener('pagehide', release)
      release()
    }
  }, [canEdit, claimLock])

  /** All templates, with this canvas in its slot (an empty canvas clears the slot). */
  const withSlot = useCallback(
    (clean: Design, settings = tpl): Templates => {
      if (target.kind !== 'template' || !settings) return templates.current
      return {
        ...templates.current,
        [target.template]: {
          ...settings,
          [target.slot]: clean.desktop.elements.length > 0 ? clean : null,
        },
      }
    },
    [target, tpl],
  )

  // --- Saving: automatically, a moment after each change
  const save = useCallback(async () => {
    const json = JSON.stringify(design)
    if (!dirty || json === savedJson.current || readOnly) return
    if (problems.length > 0) {
      setStatus('error')
      setMessage('Not saved: some text is hard to read. See “Readability” below.')
      return
    }
    setStatus('saving')
    const clean = cleanDesign(design)
    const response = await fetch(
      target.kind === 'page'
        ? `/api/pages/${target.id}?draft=true`
        : '/api/globals/site-design?draft=true',
      {
        method: target.kind === 'page' ? 'PATCH' : 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          target.kind === 'template'
            ? {
                templates: withSlot(clean),
                _status: 'draft',
              }
            : { [target.kind === 'page' ? 'design' : target.field]: clean, _status: 'draft' },
        ),
      },
    ).catch(() => null)
    const body = (await response?.json().catch(() => ({}))) as {
      errors?: { message?: string }[]
      message?: string
    }
    if (!response?.ok) {
      setStatus('error')
      setMessage(
        body?.errors?.[0]?.message ?? body?.message ?? 'Could not save. Check your connection.',
      )
      if (response?.status === 423) claimLock()
      return
    }
    savedJson.current = json
    if (target.kind === 'template') templates.current = withSlot(clean)
    setDirty(false)
    setHasSaved(true)
    setStatus('saved')
    setMessage(null)
    setIsPublished(false)
  }, [design, dirty, problems.length, readOnly, claimLock, target, withSlot])

  const saveSettings = async (next: PageTemplate) => {
    if (readOnly || target.kind !== 'template') return
    setTpl(next)
    setStatus('saving')
    const all = withSlot(cleanDesign(design), next)
    const response = await fetch('/api/globals/site-design?draft=true', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ templates: all, _status: 'draft' }),
    }).catch(() => null)
    if (!response?.ok) {
      setStatus('error')
      setMessage('Could not save the template settings.')
      return
    }
    templates.current = all
    setStatus('saved')
    setHasSaved(true)
    setIsPublished(false)
  }

  // --- Switching to another part of the site, or making a new page
  const open = async (next: Target | 'new') => {
    if (dirty) await save()
    leaving.current = true
    if (next !== 'new') {
      window.location.href = targetUrl(next)
      return
    }
    const title = window.prompt('What is the new page called? (e.g. About us, Join us)')?.trim()
    if (!title) return
    const response = await fetch('/api/pages?draft=true', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, design: pageStarter(title), _status: 'draft' }),
    }).catch(() => null)
    const body = (await response?.json().catch(() => ({}))) as {
      doc?: { id: number }
      errors?: { message?: string }[]
      message?: string
    }
    if (!response?.ok || !body.doc) {
      setMessage(body?.errors?.[0]?.message ?? body?.message ?? 'Could not make the page.')
      return
    }
    window.location.href = targetUrl({ kind: 'page', id: body.doc.id, title })
  }

  useEffect(() => {
    if (!dirty) return
    const timer = setTimeout(save, 2500)
    return () => clearTimeout(timer)
  }, [dirty, design, save])

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty && !leaving.current) e.preventDefault()
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  // --- Zoom to fit
  useEffect(() => {
    if (!fit || !stageBox.current) return
    const box = stageBox.current
    const measure = () => setZoom(Math.min(1, Math.max(0.1, (box.clientWidth - 48) / size.width)))
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(box)
    return () => observer.disconnect()
  }, [fit, size.width])

  // --- Actions
  const visibleCenter = (): { x: number; y: number } => {
    const box = stageBox.current
    if (!box) return { x: 100, y: 100 }
    return {
      x: Math.max(0, (box.scrollLeft + box.clientWidth / 2) / zoom - 150),
      y: Math.max(0, (box.scrollTop + box.clientHeight / 3) / zoom),
    }
  }

  const add = (type: ElementType, props: Record<string, unknown> = {}) => {
    if (readOnly) return
    const at = visibleCenter()
    const el = makeElement(
      type,
      view === 'desktop' ? at : { x: 40, y: design.desktop.height - 400 },
      props,
    )
    const phoneAt: Geometry | undefined =
      view === 'phone'
        ? { x: 16, y: at.y, w: 358, h: Math.round((el.h * 358) / el.w), rotation: 0, hidden: false }
        : undefined
    change((d) => addElement(d, el, view, phoneAt))
    setSelection([el.id])
    if (type === 'text') setTimeout(() => setEditingId(el.id), 50)
  }

  const removeSelected = () => {
    if (selection.length === 0) return
    change((d) => removeElements(d, selection, view))
    setSelection([])
  }

  const copy = () => setClipboard(structuredClone(selected))
  // Copy style / paste style, like Canva's format painter.
  const copyStyle = () => {
    if (selected.length !== 1) return
    const el = selected[0]
    const skip = new Set(CONTENT_KEYS[el.type] ?? [])
    const style = Object.fromEntries(Object.entries(el.props).filter(([key]) => !skip.has(key)))
    setCopiedStyle({ type: el.type, style: { ...structuredClone(style), opacity: el.opacity } })
    setMessage(null)
  }
  const pasteStyle = () => {
    if (!copiedStyle || readOnly) return
    const targets = selected.filter((el) => el.type === copiedStyle.type).map((el) => el.id)
    if (targets.length === 0) {
      setMessage(`That style is for ${copiedStyle.type} items; select one of those to paste it.`)
      return
    }
    const { opacity, ...props } = copiedStyle.style
    change((d) =>
      updateElements(
        d,
        targets,
        (el) =>
          ({
            ...el,
            opacity: opacity as number,
            props: { ...el.props, ...props },
          }) as DesignElement,
      ),
    )
  }
  // Going back to any point in the history; later steps stay available to redo.
  const jumpTo = (index: number) => {
    setFuture((f) => [...past.slice(index + 1), design, ...f])
    setDesign(past[index])
    setPast((p) => p.slice(0, index))
    setDirty(true)
  }
  const paste = () => {
    if (clipboard.length === 0 || readOnly) return
    const copies = duplicates(clipboard)
    setClipboard(copies)
    const result = pasteElements(design, copies)
    commit(result.design, design)
    setSelection(result.ids)
  }
  const duplicate = () => {
    if (selected.length === 0 || readOnly) return
    const result = pasteElements(design, duplicates(selected))
    commit(result.design, design)
    setSelection(result.ids)
  }
  const doOrder = (order: Order) => selection.length && change((d) => reorder(d, selection, order))
  const doAlign = (how: Align) =>
    selection.length &&
    change((d) => align(d, view, selection, how, { w: size.width, h: size.height }))
  const toggleLock = () =>
    selection.length &&
    change((d) =>
      updateElements(d, selection, (el) => ({ ...el, locked: !selected.every((s) => s.locked) })),
    )
  const toggleHidden = (ids = selection) => {
    if (ids.length === 0) return
    if (view === 'phone') {
      const hidden = ids.every((id) => geometry.get(id)?.hidden)
      change((d) =>
        setGeometry(d, view, Object.fromEntries(ids.map((id) => [id, { hidden: !hidden }]))),
      )
    } else {
      const els = design.desktop.elements.filter((el) => ids.includes(el.id))
      const hidden = els.every((el) => el.hidden)
      change((d) => updateElements(d, ids, (el) => ({ ...el, hidden: !hidden })))
    }
  }
  const selectAll = () =>
    setSelection(design.desktop.elements.filter((el) => !el.locked).map((el) => el.id))

  // --- Keyboard shortcuts (the same as Canva's where they exist)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target.closest('input, textarea, select, [contenteditable="true"]')) return
      const mod = e.metaKey || e.ctrlKey
      const key = e.key.toLowerCase()
      if (mod && key === 'z') {
        e.preventDefault()
        if (e.shiftKey) redo()
        else undo()
      } else if (mod && key === 'y') {
        e.preventDefault()
        redo()
      } else if (mod && key === 's') {
        e.preventDefault()
        save()
      } else if (mod && e.altKey && key === 'c') {
        e.preventDefault()
        copyStyle()
      } else if (mod && e.altKey && key === 'v') {
        e.preventDefault()
        pasteStyle()
      } else if (mod && key === 'c') copy()
      else if (mod && key === 'v') {
        e.preventDefault()
        paste()
      } else if (mod && key === 'd') {
        e.preventDefault()
        duplicate()
      } else if (mod && key === 'a') {
        e.preventDefault()
        selectAll()
      } else if (mod && key === 'g') {
        e.preventDefault()
        if (e.shiftKey) change((d) => ungroup(d, selection))
        else if (selection.length > 1) change((d) => group(d, selection))
      } else if (mod && (e.key === ']' || e.key === '[')) {
        e.preventDefault()
        doOrder(
          e.key === ']' ? (e.shiftKey ? 'front' : 'forward') : e.shiftKey ? 'back' : 'backward',
        )
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selection.length) {
          e.preventDefault()
          removeSelected()
        }
      } else if (e.key === 'Escape') {
        setSelection([])
        setMenu(null)
      } else if (e.key.startsWith('Arrow') && selection.length && !readOnly) {
        e.preventDefault()
        const step = e.shiftKey ? 10 : 1
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0
        const changes = Object.fromEntries(
          selection.flatMap((id) => {
            const g = geometry.get(id)
            const el = design.desktop.elements.find((x) => x.id === id)
            return g && !el?.locked ? [[id, { x: g.x + dx, y: g.y + dy }]] : []
          }),
        )
        change((d) => setGeometry(d, view, changes))
      } else if (!mod && key === 't') add('text', { paragraphs: plainParagraphs('Add a heading') })
      else if (!mod && key === 'r') add('shape', { kind: 'rect' })
      else if (!mod && key === 'o') add('shape', { kind: 'ellipse' })
      else if (!mod && key === 'l') add('shape', { kind: 'line' })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const publishNow = async () => {
    const reason = window.prompt(
      'Publish the saved design now? This rebuilds the website and uses one of this month’s rebuilds.\n\nWhy can’t it wait for the next issue?',
    )
    if (!reason?.trim()) return
    await save()
    const response = await fetch('/api/globals/site-design/publish-now', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    })
    const body = (await response.json().catch(() => ({}))) as {
      message?: string
      deploy?: { id?: number; status?: string; message?: string }
    }
    if (!response.ok) {
      setMessage(body.message ?? 'Could not publish.')
      return
    }
    setIsPublished(true)
    if (body.deploy?.id && body.deploy.status === 'triggered') setDeploymentId(body.deploy.id)
    setMessage(body.deploy?.message ?? 'Published. The website is rebuilding.')
  }

  const textTools = editingId
    ? (() => {
        const editor = () => document.querySelector<HTMLElement>(`[data-editing-id="${editingId}"]`)
        const keep = (e: React.MouseEvent) => e.preventDefault()
        return (
          <div className="dz-texttools" onMouseDown={keep}>
            <button
              type="button"
              tabIndex={0}
              onClick={() => format('bold')}
              title="Bold (selected text)"
            >
              <b>B</b>
            </button>
            <button type="button" tabIndex={0} onClick={() => format('italic')} title="Italic">
              <i>I</i>
            </button>
            <button
              type="button"
              tabIndex={0}
              onClick={() => format('underline')}
              title="Underline"
            >
              <u>U</u>
            </button>
            <button
              type="button"
              tabIndex={0}
              onClick={() => format('strikeThrough')}
              title="Strikethrough"
            >
              <s>S</s>
            </button>
            <button
              type="button"
              tabIndex={0}
              onClick={() => format('insertUnorderedList')}
              title="Bulleted list"
            >
              • List
            </button>
            <button
              type="button"
              tabIndex={0}
              onClick={() => format('insertOrderedList')}
              title="Numbered list"
            >
              1. List
            </button>
            <label title="Colour of the selected text">
              A
              <input type="color" tabIndex={0} onChange={(e) => formatColor(e.target.value)} />
            </label>
            <select
              tabIndex={0}
              defaultValue=""
              title="Size of the selected text"
              onChange={(e) => {
                const ed = editor()
                if (ed && e.target.value) formatSize(ed, Number(e.target.value), zoom)
                e.target.value = ''
              }}
            >
              <option value="">Size</option>
              {[12, 14, 16, 18, 20, 24, 28, 32, 40, 48, 56, 64, 72, 96].map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <span className="dz-hint">Select text, then format it. Esc to finish.</span>
          </div>
        )
      })()
    : null

  const layers = [...design.desktop.elements].reverse()
  const stories: DArticle[] = Object.values(data.byId)

  return (
    <div className="dz">
      <link rel="stylesheet" href={fontsUrl(FONTS.map((f) => f.id)) ?? ''} />
      <header className="dz-toolbar">
        <div className="dz-tools">
          <select
            className="dz-target"
            aria-label="Which part of the site"
            value={
              target.kind === 'page'
                ? `page-${target.id}`
                : target.kind === 'template'
                  ? `tpl-${target.template}`
                  : target.field
            }
            onChange={(e) => {
              const v = e.target.value
              if (v === 'new') open('new')
              else if (v.startsWith('tpl-'))
                open({ kind: 'template', template: v.slice(4) as TemplateKind, slot: 'above' })
              else if (v.startsWith('page-')) {
                const id = Number(v.slice(5))
                open({ kind: 'page', id, title: pages.find((p) => p.id === id)?.title ?? '' })
              } else open({ kind: 'global', field: v as 'design' | 'header' | 'footer' })
            }}
          >
            <optgroup label="Every page">
              <option value="header">Header</option>
              <option value="footer">Footer</option>
            </optgroup>
            <optgroup label="Pages">
              <option value="design">Front page</option>
              {target.kind === 'page' && !pages.some((p) => p.id === target.id) && (
                <option value={`page-${target.id}`}>{target.title}</option>
              )}
              {pages.map((p) => (
                <option key={p.id} value={`page-${p.id}`}>
                  {p.title}
                </option>
              ))}
              {canEdit && <option value="new">+ New page…</option>}
            </optgroup>
            <optgroup label="Page templates">
              {TEMPLATE_KINDS.map((kind) => (
                <option key={kind} value={`tpl-${kind}`}>
                  {TEMPLATE_NAMES[kind]}
                </option>
              ))}
            </optgroup>
          </select>
          {target.kind === 'page' && (
            <a
              className="dz-link"
              href={`/admin/collections/pages/${target.id}`}
              target="_blank"
              rel="noreferrer"
              title="Title, address, and whether it’s in the navigation or footer"
            >
              Page settings
            </a>
          )}
          <span className="dz-sep" />
          <span className="dz-tools__label">Add</span>
          <button
            type="button"
            onClick={() => add('text', { paragraphs: plainParagraphs('Add a heading'), size: 48 })}
            title="Heading (T)"
          >
            Heading
          </button>
          <button
            type="button"
            onClick={() =>
              add('text', {
                paragraphs: plainParagraphs('Add a subheading'),
                size: 24,
                font: DEFAULT_SANS,
              })
            }
          >
            Subheading
          </button>
          <button
            type="button"
            onClick={() =>
              add('text', {
                paragraphs: plainParagraphs('Add some body text'),
                size: 16,
                weight: 400,
              })
            }
          >
            Body text
          </button>
          <select
            value=""
            onChange={(e) => {
              if (e.target.value) add('shape', { kind: e.target.value as ShapeKind })
            }}
            aria-label="Add a shape"
            disabled={readOnly}
          >
            <option value="">Shape…</option>
            {SHAPES.map((s) => (
              <option key={s} value={s}>
                {s[0].toUpperCase() + s.slice(1)}
              </option>
            ))}
          </select>
          <button type="button" onClick={() => add('image')}>
            Image
          </button>
          <button type="button" onClick={() => setIconsOpen(true)} disabled={readOnly}>
            Icon
          </button>
          <button type="button" onClick={() => add('table')}>
            Table
          </button>
          <button type="button" onClick={() => add('story')}>
            Story
          </button>
          <button type="button" onClick={() => add('list', { kind: 'latest', title: 'Latest' })}>
            List
          </button>
          <select
            value=""
            onChange={(e) => {
              const kind = e.target.value
              if (kind)
                add('widget', {
                  kind,
                  title: {
                    scores: 'Scores',
                    events: 'This week at Bur Oak',
                    live: '',
                    issue: 'Latest issue',
                  }[kind],
                })
            }}
            aria-label="Add a box"
            disabled={readOnly}
          >
            <option value="">Box…</option>
            <option value="scores">Scores</option>
            <option value="events">This week</option>
            <option value="live">LIVE link</option>
            <option value="issue">Latest issue</option>
          </select>
          <select
            value=""
            onChange={(e) => {
              if (e.target.value) add('site', { kind: e.target.value })
            }}
            aria-label="Add a site part"
            disabled={readOnly}
          >
            <option value="">Site part…</option>
            {SITE_PARTS.map((kind) => (
              <option key={kind} value={kind}>
                {SITE_PART_NAMES[kind]}
              </option>
            ))}
          </select>
        </div>
        <div className="dz-tools">
          <button type="button" onClick={undo} disabled={past.length === 0} title="Undo (Ctrl+Z)">
            ↶
          </button>
          <button
            type="button"
            onClick={redo}
            disabled={future.length === 0}
            title="Redo (Ctrl+Shift+Z)"
          >
            ↷
          </button>
          <button
            type="button"
            onClick={() => setTemplatesOpen(true)}
            title="Start from a template"
          >
            Templates
          </button>
          <button
            type="button"
            className={historyOpen ? 'dz-on' : ''}
            onClick={() => setHistoryOpen(!historyOpen)}
            title="History: go back to any earlier step"
          >
            History
          </button>
          <span className="dz-sep" />
          <button
            type="button"
            className={view === 'desktop' ? 'dz-on' : ''}
            onClick={() => setView('desktop')}
          >
            Desktop
          </button>
          <button
            type="button"
            className={view === 'phone' ? 'dz-on' : ''}
            onClick={() => {
              setView('phone')
              setSelection([])
            }}
          >
            Phone
          </button>
          <span className="dz-sep" />
          <select
            value={fit ? 'fit' : String(zoom)}
            onChange={(e) => {
              if (e.target.value === 'fit') setFit(true)
              else {
                setFit(false)
                setZoom(Number(e.target.value))
              }
            }}
            aria-label="Zoom"
          >
            <option value="fit">Fit</option>
            {[0.25, 0.5, 0.75, 1, 1.5, 2].map((z) => (
              <option key={z} value={z}>
                {z * 100}%
              </option>
            ))}
          </select>
          <button
            type="button"
            className={showGrid ? 'dz-on' : ''}
            onClick={() => setShowGrid(!showGrid)}
            title="Grid and snapping to it"
          >
            Grid
          </button>
          <button
            type="button"
            className={rulers ? 'dz-on' : ''}
            onClick={() => setRulers(!rulers)}
            title="Rulers: drag from them to add guide lines"
            disabled={view !== 'desktop'}
          >
            Rulers
          </button>
          <span className="dz-sep" />
          <span className={`dz-status dz-status--${shown}`}>
            {shown === 'saved' && !hasSaved
              ? target.kind === 'template'
                ? 'Empty: nothing shows here until you add something.'
                : `The classic ${target.kind === 'page' ? 'page' : TARGET_NAMES[target.field].toLowerCase()}. Nothing is saved until you change something.`
              : shown === 'saved'
                ? isPublished
                  ? 'Saved · live'
                  : 'Saved · goes live with the next issue'
                : shown === 'saving'
                  ? 'Saving…'
                  : shown === 'unsaved'
                    ? 'Unsaved changes'
                    : 'Not saved'}
          </span>
          {canPublishNow && hasSaved && !isPublished && shown === 'saved' && (
            <button type="button" className="dz-primary" onClick={publishNow}>
              Publish now
            </button>
          )}
        </div>
        {/* Always takes the same space, so the canvas never jumps when something is selected. */}
        <div className="dz-context">
          {editingId ? (
            textTools
          ) : selection.length > 0 && !readOnly ? (
            <div className="dz-tools dz-tools--selection">
              <button type="button" onClick={() => doAlign('left')} title="Align left">
                ⇤
              </button>
              <button type="button" onClick={() => doAlign('hcenter')} title="Align centre">
                ↔
              </button>
              <button type="button" onClick={() => doAlign('right')} title="Align right">
                ⇥
              </button>
              <button type="button" onClick={() => doAlign('top')} title="Align top">
                ⤒
              </button>
              <button type="button" onClick={() => doAlign('vmiddle')} title="Align middle">
                ↕
              </button>
              <button type="button" onClick={() => doAlign('bottom')} title="Align bottom">
                ⤓
              </button>
              {selection.length > 2 && (
                <>
                  <button
                    type="button"
                    onClick={() => change((d) => distribute(d, view, selection, 'x'))}
                    title="Space evenly across"
                  >
                    ⇹ across
                  </button>
                  <button
                    type="button"
                    onClick={() => change((d) => distribute(d, view, selection, 'y'))}
                    title="Space evenly down"
                  >
                    ⇳ down
                  </button>
                </>
              )}
              <span className="dz-sep" />
              {selection.length > 1 && (
                <button
                  type="button"
                  onClick={() => change((d) => group(d, selection))}
                  title="Group (Ctrl+G)"
                >
                  Group
                </button>
              )}
              {selected.some((el) => el.groupId) && (
                <button
                  type="button"
                  onClick={() => change((d) => ungroup(d, selection))}
                  title="Ungroup (Ctrl+Shift+G)"
                >
                  Ungroup
                </button>
              )}
              <button
                type="button"
                onClick={() => doOrder('front')}
                title="Bring to front (Ctrl+Shift+])"
              >
                Front
              </button>
              <button type="button" onClick={() => doOrder('forward')} title="Forward (Ctrl+])">
                Forward
              </button>
              <button type="button" onClick={() => doOrder('backward')} title="Backward (Ctrl+[)">
                Backward
              </button>
              <button
                type="button"
                onClick={() => doOrder('back')}
                title="Send to back (Ctrl+Shift+[)"
              >
                Back
              </button>
              <span className="dz-sep" />
              <button type="button" onClick={duplicate} title="Duplicate (Ctrl+D)">
                Duplicate
              </button>
              {selected.length === 1 && (
                <button type="button" onClick={copyStyle} title="Copy style (Ctrl+Alt+C)">
                  Copy style
                </button>
              )}
              {copiedStyle && (
                <button type="button" onClick={pasteStyle} title="Paste style (Ctrl+Alt+V)">
                  Paste style
                </button>
              )}
              <button type="button" onClick={toggleLock}>
                {selected.every((el) => el.locked) ? 'Unlock' : 'Lock'}
              </button>
              <button type="button" onClick={() => toggleHidden()}>
                {view === 'phone' ? 'Hide on phone' : 'Hide'}
              </button>
              <button type="button" className="dz-danger" onClick={removeSelected} title="Delete">
                {view === 'phone' ? 'Remove from phone' : 'Delete'}
              </button>
            </div>
          ) : (
            <span className="dz-hint">
              {readOnly
                ? 'Viewing only.'
                : 'Click something to arrange it, double-click text to edit it, drag on empty space to select several.'}
            </span>
          )}
        </div>
      </header>

      {!canEdit && (
        <p className="dz-banner">
          You can look, but you need the Design permission to make changes.
        </p>
      )}
      {canEdit && !lock.ok && (
        <p className="dz-banner">
          {lock.heldBy ?? 'Someone else'} is editing the design right now, so you can only look.{' '}
          <button type="button" className="dz-link" onClick={() => claimLock(true)}>
            Take over
          </button>
        </p>
      )}
      {target.kind === 'template' && tpl && (
        <div className="dz-banner dz-template">
          <span className="dz-tools">
            {TEMPLATE_SLOTS.map((slot) => (
              <button
                key={slot}
                type="button"
                className={slot === target.slot ? 'dz-on' : ''}
                onClick={() => open({ ...target, slot })}
              >
                {SLOT_NAMES[slot]}
              </button>
            ))}
          </span>
          <span className="dz-hint">
            The content itself ({TEMPLATE_NAMES[target.template].toLowerCase()}) is laid out
            automatically between these, so it can be any length. Every page of this kind changes.
          </span>
          <fieldset className="dz-tools" disabled={readOnly}>
            <label>
              Content width{' '}
              <select
                value={tpl.width}
                onChange={(e) =>
                  saveSettings({ ...tpl, width: e.target.value as PageTemplate['width'] })
                }
              >
                <option value="narrow">Narrow</option>
                <option value="medium">As now</option>
                <option value="wide">Wide</option>
              </select>
            </label>
            <label>
              Position{' '}
              <select
                value={tpl.align}
                onChange={(e) =>
                  saveSettings({ ...tpl, align: e.target.value as PageTemplate['align'] })
                }
              >
                <option value="center">Centred</option>
                <option value="left">Left</option>
              </select>
            </label>
            <label>
              Sidebar on the{' '}
              <select
                value={tpl.sidePosition}
                onChange={(e) =>
                  saveSettings({
                    ...tpl,
                    sidePosition: e.target.value as PageTemplate['sidePosition'],
                  })
                }
              >
                <option value="right">Right</option>
                <option value="left">Left</option>
              </select>
            </label>
            {(['headFont', 'bodyFont'] as const).map((key) => (
              <label key={key}>
                {key === 'headFont' ? 'Headings' : 'Text'}{' '}
                <select
                  value={tpl[key] ?? ''}
                  onChange={(e) => saveSettings({ ...tpl, [key]: e.target.value || null })}
                >
                  <option value="">As now</option>
                  {FONTS.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </fieldset>
          {target.template === 'article' && (
            <fieldset className="dz-tools" disabled={readOnly}>
              <span className="dz-tools__label">Show</span>
              {ARTICLE_PARTS.map((part) => (
                <label key={part}>
                  <input
                    type="checkbox"
                    checked={!tpl.hide.includes(part)}
                    onChange={(e) =>
                      saveSettings({
                        ...tpl,
                        hide: e.target.checked
                          ? tpl.hide.filter((h) => h !== part)
                          : [...tpl.hide, part],
                      })
                    }
                  />{' '}
                  {ARTICLE_PART_NAMES[part]}
                </label>
              ))}
              <label>
                <input
                  type="checkbox"
                  checked={tpl.imageFirst}
                  onChange={(e) => saveSettings({ ...tpl, imageFirst: e.target.checked })}
                />{' '}
                Picture above the headline
              </label>
            </fieldset>
          )}
        </div>
      )}
      {message && <p className="dz-banner dz-banner--error">{message}</p>}
      {deploymentId && (
        <div className="dz-banner">
          <DeployProgress deploymentId={deploymentId} />
        </div>
      )}

      <div className="dz-body">
        <aside className="dz-layers" aria-label="Layers">
          {historyOpen && (
            <div className="dz-history">
              <h3>History</h3>
              <ol>
                {past.map((d, i) => (
                  <li key={i}>
                    <button
                      type="button"
                      className="dz-layer"
                      onClick={() => jumpTo(i)}
                      disabled={readOnly}
                    >
                      {i === 0 ? 'Opened' : describeChange(past[i - 1], d)}
                      {madeAt.get(d) && (
                        <span className="dz-history__time">
                          {new Date(madeAt.get(d)!).toLocaleTimeString('en-CA', {
                            hour: 'numeric',
                            minute: '2-digit',
                          })}
                        </span>
                      )}
                    </button>
                  </li>
                ))}
                <li className="dz-on">
                  <span className="dz-layer">
                    {past.length === 0 ? 'Opened' : describeChange(past[past.length - 1], design)}{' '}
                    (now)
                  </span>
                </li>
              </ol>
              {future.length > 0 && (
                <p className="dz-hint">{future.length} undone step(s) can be redone.</p>
              )}
            </div>
          )}
          <h3>Layers</h3>
          <ol>
            {layers.map((el) => {
              const hidden = el.hidden || geometry.get(el.id)?.hidden
              return (
                <li key={el.id} className={selection.includes(el.id) ? 'dz-on' : ''}>
                  <button
                    type="button"
                    className="dz-layer"
                    onClick={(e) =>
                      setSelection(
                        e.shiftKey ? [...selection, el.id] : expandGroups(design, [el.id]),
                      )
                    }
                  >
                    {el.groupId ? '▣ ' : ''}
                    {el.name || label(el)}
                  </button>
                  <button
                    type="button"
                    className="dz-icon"
                    onClick={() => toggleHidden([el.id])}
                    title={hidden ? 'Show' : 'Hide'}
                    disabled={readOnly}
                  >
                    {hidden ? '◌' : '●'}
                  </button>
                  <button
                    type="button"
                    className="dz-icon"
                    onClick={() =>
                      change((d) =>
                        updateElements(d, [el.id], (x) => ({ ...x, locked: !x.locked })),
                      )
                    }
                    title={el.locked ? 'Unlock' : 'Lock'}
                    disabled={readOnly}
                  >
                    {el.locked ? '🔒' : '🔓'}
                  </button>
                </li>
              )
            })}
          </ol>
          {problems.length > 0 && (
            <div className="dz-problems">
              <h3>Readability</h3>
              {problems.map((pr, i) => (
                <div key={i} className="dz-problem">
                  <button
                    type="button"
                    className="dz-link"
                    onClick={() => {
                      setSelection([pr.id])
                      setView(pr.view)
                    }}
                  >
                    {pr.label} ({pr.view})
                  </button>
                  <span>
                    Contrast {pr.ratio}:1, needs {pr.needed}:1.
                  </span>
                  <button
                    type="button"
                    className="dz-button"
                    disabled={readOnly}
                    onClick={() =>
                      change((d) =>
                        updateElements(d, [pr.id], (el) => {
                          if (el.type === 'table' && pr.label === 'Table header') {
                            return { ...el, props: { ...el.props, headerColor: pr.suggestion } }
                          }
                          if (el.type === 'text') {
                            return {
                              ...el,
                              props: {
                                ...el.props,
                                color: el.props.color === pr.color ? pr.suggestion : el.props.color,
                                paragraphs: el.props.paragraphs.map((p) => ({
                                  ...p,
                                  runs: p.runs.map((r) =>
                                    r.color === pr.color ? { ...r, color: pr.suggestion } : r,
                                  ),
                                })),
                              },
                            }
                          }
                          return {
                            ...el,
                            props: { ...el.props, color: pr.suggestion },
                          } as DesignElement
                        }),
                      )
                    }
                  >
                    Use{' '}
                    <span
                      className="dz-swatch dz-swatch--inline"
                      style={{ background: pr.suggestion }}
                    />{' '}
                    {pr.suggestion}
                  </button>
                </div>
              ))}
            </div>
          )}
          {overflow.size > 0 && (
            <p className="dz-warn">
              {overflow.size} {overflow.size === 1 ? 'box is' : 'boxes are'} too small for{' '}
              {overflow.size === 1 ? 'its' : 'their'} content (outlined in red). Make{' '}
              {overflow.size === 1 ? 'it' : 'them'} bigger or show less.
            </p>
          )}
        </aside>

        <div
          className="dz-stage"
          ref={stageBox}
          onPointerDown={(e) => {
            if (e.target === e.currentTarget) setSelection([])
          }}
        >
          <div className={`dz-frame dz-frame--${view}`}>
            <Stage
              design={design}
              view={view}
              data={data}
              zoom={zoom}
              selection={selection}
              onSelect={setSelection}
              onPreview={setDesign}
              onCommit={commit}
              onAdjust={setDesign}
              editingId={editingId}
              onEditText={setEditingId}
              onContextMenu={(at, id) => setMenu({ ...at, id })}
              readOnly={readOnly}
              showGrid={showGrid}
              rulers={rulers && view === 'desktop'}
              overflow={overflow}
              onOverflow={setOverflow}
            />
          </div>
          {view === 'desktop' && !readOnly && (
            <button
              type="button"
              className="dz-link dz-addpage"
              onClick={() =>
                change((d) => ({ ...d, desktop: { ...d.desktop, height: d.desktop.height + 400 } }))
              }
            >
              + Make the page longer
            </button>
          )}
        </div>

        <aside className="dz-side">
          <Inspector
            design={design}
            view={view}
            selected={selected}
            geometry={geometry}
            readOnly={readOnly}
            ctx={{
              sections,
              stories,
              media: data.media,
              onMedia: (id, image) =>
                setData((d) => ({ ...d, media: { ...d.media, [id]: image } })),
            }}
            onProps={(ids, props) =>
              change((d) =>
                updateElements(
                  d,
                  ids,
                  (el) => ({ ...el, props: { ...el.props, ...props } }) as DesignElement,
                ),
              )
            }
            onElement={(ids, c) =>
              change((d) => updateElements(d, ids, (el) => ({ ...el, ...c }) as DesignElement))
            }
            onGeometry={(id, c) => change((d) => setGeometry(d, view, { [id]: c }))}
            onDesign={(fn) => change(fn)}
            onMarkPhoneChecked={() =>
              change((d) => ({ ...d, phoneCheckedAt: new Date().toISOString() }))
            }
            onResetPhone={() => {
              if (
                window.confirm('Put every element back where the automatic phone layout puts it?')
              ) {
                change((d) => ({ ...d, phone: { ...d.phone, overrides: {} } }))
              }
            }}
          />
        </aside>
      </div>

      {templatesOpen && (
        <TemplatePicker
          current={cleanDesign(design)}
          data={data}
          sections={sections}
          canEdit={!readOnly}
          onClose={() => setTemplatesOpen(false)}
          onUse={(next) => {
            change(() => ({
              ...next,
              desktop: {
                ...next.desktop,
                ...(design.desktop.width ? { width: design.desktop.width } : {}),
              },
              guides: design.guides,
            }))
            setSelection([])
          }}
        />
      )}
      {iconsOpen && (
        <IconPicker
          onClose={() => setIconsOpen(false)}
          onPick={(name, paths) => {
            setIconsOpen(false)
            add('icon', { name, paths })
          }}
        />
      )}
      {menu && (
        <div
          className="dz-menu-backdrop"
          onPointerDown={() => setMenu(null)}
          onContextMenu={(e) => {
            e.preventDefault()
            setMenu(null)
          }}
        >
          <div
            className="dz-menu"
            style={{ left: menu.x, top: menu.y }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            {(
              [
                ['Copy', 'Ctrl+C', copy, selection.length > 0],
                ['Paste', 'Ctrl+V', paste, clipboard.length > 0 && !readOnly],
                ['Duplicate', 'Ctrl+D', duplicate, selection.length > 0 && !readOnly],
                ['Copy style', 'Ctrl+Alt+C', copyStyle, selected.length === 1],
                [
                  'Paste style',
                  'Ctrl+Alt+V',
                  pasteStyle,
                  Boolean(copiedStyle) && selection.length > 0 && !readOnly,
                ],
                ['Delete', 'Del', removeSelected, selection.length > 0 && !readOnly],
                null,
                [
                  'Bring to front',
                  'Ctrl+Shift+]',
                  () => doOrder('front'),
                  selection.length > 0 && !readOnly,
                ],
                [
                  'Bring forward',
                  'Ctrl+]',
                  () => doOrder('forward'),
                  selection.length > 0 && !readOnly,
                ],
                [
                  'Send backward',
                  'Ctrl+[',
                  () => doOrder('backward'),
                  selection.length > 0 && !readOnly,
                ],
                [
                  'Send to back',
                  'Ctrl+Shift+[',
                  () => doOrder('back'),
                  selection.length > 0 && !readOnly,
                ],
                null,
                [
                  'Group',
                  'Ctrl+G',
                  () => change((d) => group(d, selection)),
                  selection.length > 1 && !readOnly,
                ],
                [
                  'Ungroup',
                  'Ctrl+Shift+G',
                  () => change((d) => ungroup(d, selection)),
                  selected.some((el) => el.groupId) && !readOnly,
                ],
                [
                  selected.every((el) => el.locked) ? 'Unlock' : 'Lock',
                  '',
                  toggleLock,
                  selection.length > 0 && !readOnly,
                ],
                [
                  'Edit text',
                  'Double-click',
                  () => setEditingId(selection[0]),
                  selected.length === 1 && selected[0].type === 'text' && !readOnly,
                ],
                null,
                ['Select all', 'Ctrl+A', selectAll, true],
              ] as ([string, string, () => void, boolean] | null)[]
            ).map((item, i) =>
              item ? (
                <button
                  key={i}
                  type="button"
                  disabled={!item[3]}
                  onClick={() => {
                    item[2]()
                    setMenu(null)
                  }}
                >
                  <span>{item[0]}</span>
                  <kbd>{item[1]}</kbd>
                </button>
              ) : (
                <hr key={i} />
              ),
            )}
          </div>
        </div>
      )}
    </div>
  )
}

const label = (el: DesignElement) => {
  if (el.type === 'text') {
    const text = el.props.paragraphs
      .map((p) => p.runs.map((r) => r.text).join(''))
      .join(' ')
      .trim()
    return text ? `“${text.slice(0, 24)}${text.length > 24 ? '…' : ''}”` : 'Text'
  }
  if (el.type === 'shape') return el.props.kind[0].toUpperCase() + el.props.kind.slice(1)
  if (el.type === 'story')
    return el.props.source === 'pick' ? 'Story (chosen)' : `Story #${el.props.index}`
  if (el.type === 'list')
    return { latest: 'Latest', mostread: 'Most read', section: 'Section list' }[el.props.kind]
  if (el.type === 'widget')
    return { scores: 'Scores', events: 'This week', live: 'LIVE link', issue: 'Latest issue' }[
      el.props.kind
    ]
  if (el.type === 'site') return SITE_PART_NAMES[el.props.kind]
  if (el.type === 'table') return `Table (${el.props.rows.length} rows)`
  if (el.type === 'icon') return `Icon: ${el.props.name.replace(/-/g, ' ')}`
  return 'Image'
}
