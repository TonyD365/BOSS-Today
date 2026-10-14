import { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-postgres'

/**
 * Five starter templates. Each prompt starts with "TK" (newsroom shorthand for
 * "to come"); a story can't be approved until every TK is replaced. Editors can
 * change or delete these afterwards. Nothing is added if templates exist.
 */
const text = (value: string, format = 0) => ({
  type: 'text',
  version: 1,
  text: value,
  format,
  detail: 0,
  mode: 'normal',
  style: '',
})
const block = (type: 'paragraph' | 'heading', value: string) => ({
  type,
  version: 1,
  direction: 'ltr',
  format: '',
  indent: 0,
  ...(type === 'heading' ? { tag: 'h2' } : { textFormat: 0, textStyle: '' }),
  children: [text(value)],
})
const story = (parts: [string | null, string][]) => ({
  root: {
    type: 'root',
    version: 1,
    direction: 'ltr',
    format: '',
    indent: 0,
    children: parts.flatMap(([heading, prompt]) => [
      ...(heading ? [block('heading', heading)] : []),
      block('paragraph', prompt),
    ]),
  },
})

const TEMPLATES = [
  {
    name: 'Game Recap',
    section: 'sports',
    description: 'A school team’s game: the result, how it happened, what’s next.',
    content: story([
      [
        null,
        'TK: The result in one sentence: who won, the final score, and the moment that decided it.',
      ],
      [null, 'TK: Why this game mattered (standings, rivalry, playoffs).'],
      ['How it happened', 'TK: Two or three key plays, in order, with names and grades.'],
      [
        'What they said',
        'TK: A quote from a player and one from the coach, with full names and roles.',
      ],
      ['What’s next', 'TK: The next game: opponent, date, time and place.'],
    ]),
  },
  {
    name: 'Event Coverage',
    section: 'student-life',
    description: 'An assembly, show, fundraiser or other school event.',
    content: story([
      [null, 'TK: What happened, where and when, in one or two sentences.'],
      [null, 'TK: Who organised it and why.'],
      [
        'The event',
        'TK: What it was like: details a reader couldn’t guess, numbers (attendance, money raised).',
      ],
      [
        'What people said',
        'TK: Quotes from an organiser and someone who attended, with full names and grades.',
      ],
      ['Why it matters', 'TK: What comes next, or what it means for students.'],
    ]),
  },
  {
    name: 'Profile',
    section: null,
    description: 'A student, teacher or staff member worth getting to know.',
    content: story([
      [null, 'TK: Open with a scene or a telling detail about the person.'],
      [null, 'TK: Who they are and why we’re writing about them now.'],
      ['Background', 'TK: How they got here: the story behind them.'],
      ['In their words', 'TK: Their best quotes, with context.'],
      [null, 'TK: End with a quote or detail that sums them up.'],
    ]),
  },
  {
    name: 'Op-Ed',
    section: 'opinion',
    description: 'An argument for a point of view. Clearly labelled as opinion.',
    content: story([
      [null, 'TK: Your argument in one or two sentences.'],
      ['Why', 'TK: Your first reason, with evidence (facts, numbers, sources).'],
      [null, 'TK: Your second reason, with evidence.'],
      [
        'The other side',
        'TK: The strongest argument against you, stated fairly, and your answer to it.',
      ],
      ['What should happen', 'TK: What you want readers or the school to do.'],
    ]),
  },
  {
    name: 'Club Spotlight',
    section: 'student-life',
    description: 'One of Bur Oak’s clubs: what it does and how to join.',
    content: story([
      [null, 'TK: What makes this club worth reading about, in one or two sentences.'],
      ['What they do', 'TK: Activities, competitions or projects, with examples.'],
      [
        'The people',
        'TK: Quotes from the club’s leaders and a member, with full names and grades.',
      ],
      ['How to join', 'TK: When and where they meet, the teacher supervisor, and how to sign up.'],
    ]),
  },
]

export async function up({ payload, req }: MigrateUpArgs): Promise<void> {
  const existing = await payload.count({ collection: 'templates', req, overrideAccess: true })
  if (existing.totalDocs > 0) return
  const sections = await payload.find({
    collection: 'sections',
    draft: true,
    limit: 100,
    depth: 0,
    req,
    overrideAccess: true,
    select: { slug: true },
  })
  const sectionId = (slug: string | null) =>
    slug ? sections.docs.find((section) => section.slug === slug)?.id : undefined

  for (const template of TEMPLATES) {
    await payload.create({
      collection: 'templates',
      req,
      overrideAccess: true,
      data: {
        name: template.name,
        description: template.description,
        section: sectionId(template.section),
        content: template.content as never,
      },
    })
  }
}

export async function down({ payload, req }: MigrateDownArgs): Promise<void> {
  await payload.delete({
    collection: 'templates',
    where: { name: { in: TEMPLATES.map((template) => template.name) } },
    req,
    overrideAccess: true,
  })
}
