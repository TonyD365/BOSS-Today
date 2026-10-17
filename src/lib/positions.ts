/**
 * Newsroom positions (plan 03). Each has the access it usually needs; the
 * super admin still sets access by hand, the newsroom only suggests it.
 */
export type Role = 'reporter' | 'editor' | 'exec'
export type Permission = 'issue' | 'design' | 'print' | 'staff' | 'media'

export const POSITION_GROUPS = [
  'Masthead',
  'Section editors',
  'Copy and standards',
  'Visuals',
  'Print and design',
  'Digital and multimedia',
  'Operations',
  'Reporters and writers',
] as const
export type PositionGroup = (typeof POSITION_GROUPS)[number]

type Position = {
  value: string
  label: string
  group: PositionGroup
  role: Role
  permissions: Permission[]
}

const ALL: Permission[] = ['issue', 'design', 'print', 'staff', 'media']

export const POSITIONS: Position[] = [
  {
    value: 'editor-in-chief',
    label: 'Editor-in-Chief',
    group: 'Masthead',
    role: 'exec',
    permissions: ALL,
  },
  {
    value: 'managing-editor',
    label: 'Managing Editor',
    group: 'Masthead',
    role: 'exec',
    permissions: ['staff', 'print'],
  },
  {
    value: 'faculty-advisor',
    label: 'Faculty Advisor',
    group: 'Masthead',
    role: 'exec',
    permissions: ALL,
  },
  {
    value: 'news-editor',
    label: 'News Editor',
    group: 'Section editors',
    role: 'editor',
    permissions: [],
  },
  {
    value: 'opinion-editor',
    label: 'Opinion Editor',
    group: 'Section editors',
    role: 'editor',
    permissions: [],
  },
  {
    value: 'student-life-editor',
    label: 'Student Life Editor',
    group: 'Section editors',
    role: 'editor',
    permissions: [],
  },
  {
    value: 'sports-editor',
    label: 'Sports Editor',
    group: 'Section editors',
    role: 'editor',
    permissions: [],
  },
  {
    value: 'arts-culture-editor',
    label: 'Arts & Culture Editor',
    group: 'Section editors',
    role: 'editor',
    permissions: [],
  },
  {
    value: 'science-tech-editor',
    label: 'Science & Tech Editor',
    group: 'Section editors',
    role: 'editor',
    permissions: [],
  },
  {
    value: 'copy-chief',
    label: 'Copy Chief',
    group: 'Copy and standards',
    role: 'editor',
    permissions: [],
  },
  {
    value: 'copy-editor',
    label: 'Copy Editor',
    group: 'Copy and standards',
    role: 'editor',
    permissions: [],
  },
  {
    value: 'fact-checker',
    label: 'Fact-Checker',
    group: 'Copy and standards',
    role: 'editor',
    permissions: [],
  },
  {
    value: 'standards-editor',
    label: 'Standards Editor',
    group: 'Copy and standards',
    role: 'editor',
    permissions: [],
  },
  {
    value: 'photo-editor',
    label: 'Photo Editor',
    group: 'Visuals',
    role: 'exec',
    permissions: ['media'],
  },
  {
    value: 'staff-photographer',
    label: 'Staff Photographer',
    group: 'Visuals',
    role: 'reporter',
    permissions: [],
  },
  {
    value: 'graphics-editor',
    label: 'Graphics & Illustration Editor',
    group: 'Visuals',
    role: 'reporter',
    permissions: [],
  },
  {
    value: 'print-editor',
    label: 'Print Editor',
    group: 'Print and design',
    role: 'exec',
    permissions: ['print'],
  },
  {
    value: 'layout-designer',
    label: 'Layout Designer',
    group: 'Print and design',
    role: 'reporter',
    permissions: [],
  },
  {
    value: 'digital-editor',
    label: 'Digital Editor',
    group: 'Digital and multimedia',
    role: 'exec',
    permissions: ['design'],
  },
  {
    value: 'video-producer',
    label: 'Video Producer',
    group: 'Digital and multimedia',
    role: 'reporter',
    permissions: [],
  },
  {
    value: 'social-media-editor',
    label: 'Social Media Editor',
    group: 'Digital and multimedia',
    role: 'reporter',
    permissions: [],
  },
  {
    value: 'recruitment-coordinator',
    label: 'Recruitment & Training Coordinator',
    group: 'Operations',
    role: 'exec',
    permissions: ['staff'],
  },
  {
    value: 'web-tech-lead',
    label: 'Web & Tech Lead',
    group: 'Operations',
    role: 'exec',
    permissions: ALL,
  },
  {
    value: 'archivist',
    label: 'Archivist',
    group: 'Operations',
    role: 'reporter',
    permissions: [],
  },
  {
    value: 'senior-reporter',
    label: 'Senior Reporter',
    group: 'Reporters and writers',
    role: 'reporter',
    permissions: [],
  },
  {
    value: 'staff-writer',
    label: 'Staff Writer',
    group: 'Reporters and writers',
    role: 'reporter',
    permissions: [],
  },
  {
    value: 'columnist',
    label: 'Columnist',
    group: 'Reporters and writers',
    role: 'reporter',
    permissions: [],
  },
  {
    value: 'junior-reporter',
    label: 'Junior Reporter',
    group: 'Reporters and writers',
    role: 'reporter',
    permissions: [],
  },
  {
    value: 'contributing-writer',
    label: 'Contributing Writer',
    group: 'Reporters and writers',
    role: 'reporter',
    permissions: [],
  },
]

const byValue = new Map(POSITIONS.map((p, i) => [p.value, { ...p, order: i }]))

export const positionLabel = (value: string) => byValue.get(value)?.label ?? value

/** "Sports Editor and Columnist". */
export const positionTitle = (values: string[]) => {
  const labels = values.filter((v) => byValue.has(v)).map(positionLabel)
  return labels.length <= 1
    ? (labels[0] ?? '')
    : `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`
}

/** Where someone is listed: their most senior position's group and place. */
export const placeOf = (values: string[] | null | undefined) => {
  const known = (values ?? []).map((v) => byValue.get(v)).filter((p) => p !== undefined)
  if (known.length === 0) return null
  const first = known.sort((a, b) => a.order - b.order)[0]
  return { group: first.group, order: first.order }
}

const RANK: Record<Role, number> = { reporter: 1, editor: 2, exec: 3 }

/** The access these positions usually need: the highest role and every permission. */
export const suggestedAccess = (values: string[]) => {
  const known = values.map((v) => byValue.get(v)).filter((p) => p !== undefined)
  if (known.length === 0) return null
  const role = known.reduce<Role>(
    (best, p) => (RANK[p.role] > RANK[best] ? p.role : best),
    'reporter',
  )
  const permissions = [...new Set(known.flatMap((p) => p.permissions))]
  return { role, permissions }
}
