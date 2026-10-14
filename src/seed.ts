/**
 * `npm run seed` creates the default sections.
 * `SEED_DEMO=1 npm run seed` also adds placeholder staff, stories and an issue
 * so the layout can be checked locally. Never run the demo seed in production.
 */
import config from '@payload-config'
import { getPayload } from 'payload'
import sharp from 'sharp'

const sections = [
  ['News', 'What is happening at Bur Oak and in the community.'],
  ['Opinion', 'Columns, editorials and letters from students.'],
  ['Student Life', 'Clubs, events and the people behind them.'],
  ['Sports', 'Scores, seasons and athletes.'],
  ['Arts & Culture', 'Music, theatre, visual art, books and film.'],
  ['Science & Tech', 'Discoveries, projects and the tools we use.'],
] as const

const paragraph = (text: string) => ({
  type: 'paragraph',
  version: 1,
  direction: 'ltr' as const,
  format: '' as const,
  indent: 0,
  textFormat: 0,
  children: [{ type: 'text', version: 1, text, format: 0, detail: 0, mode: 'normal', style: '' }],
})

const body = (paragraphs: string[]) => ({
  root: {
    type: 'root',
    version: 1,
    direction: 'ltr' as const,
    format: '' as const,
    indent: 0,
    children: paragraphs.map(paragraph),
  },
})

const filler = [
  'This is placeholder text for checking the layout. Replace it with a real story before publishing anything.',
  'A second paragraph gives the columns something to wrap. Newspaper body copy is set justified with a first-line indent, so several sentences per paragraph show the rhythm of the page more honestly than a single line would.',
  'Quotes, numbers and names would normally appear here. For now the words only need to fill the space so that headlines, bylines and rules can be judged against a realistic amount of text.',
  'The final paragraph closes the sample. Every placeholder story uses the same four paragraphs, repeated, which is enough to see how a page breaks across columns.',
]

const placeholderImage = async (hue: number) =>
  sharp({
    create: {
      width: 1600,
      height: 1067,
      channels: 3,
      background: { r: 120 + (hue % 90), g: 140 + ((hue * 2) % 70), b: 150 + ((hue * 3) % 60) },
    },
  })
    .jpeg({ quality: 70 })
    .toBuffer()

const run = async () => {
  const payload = await getPayload({ config })

  const sectionIds: number[] = []
  for (const [index, [name, description]] of sections.entries()) {
    const existing = await payload.find({
      collection: 'sections',
      where: { name: { equals: name } },
      limit: 1,
    })
    const doc =
      existing.docs[0] ??
      (await payload.create({
        collection: 'sections',
        data: { name, description, order: (index + 1) * 10, slug: '' },
      }))
    sectionIds.push(doc.id)
  }
  payload.logger.info(`Sections ready (${sectionIds.length}).`)

  if (process.env.SEED_DEMO !== '1') return
  if (process.env.VERCEL_ENV === 'production') {
    throw new Error('Refusing to add demo content to production.')
  }

  const staff = await Promise.all(
    ['Sample Writer One', 'Sample Writer Two'].map(async (name, index) => {
      const email = `sample-writer-${index + 1}@example.com`
      const found = await payload.find({
        collection: 'users',
        where: { email: { equals: email } },
        limit: 1,
      })
      return (
        found.docs[0] ??
        (await payload.create({
          collection: 'users',
          data: {
            email,
            name,
            role: 'writer',
            title: 'Staff Writer',
            bio: 'Placeholder staff profile.',
          },
        }))
      )
    }),
  )

  const articleIds: number[] = []
  for (let index = 0; index < 18; index++) {
    const sectionIndex = index % sections.length
    const title = `Placeholder headline ${index + 1} for the ${sections[sectionIndex][0]} section`
    const found = await payload.find({
      collection: 'articles',
      where: { title: { equals: title } },
      limit: 1,
    })
    if (found.docs[0]) {
      articleIds.push(found.docs[0].id)
      continue
    }
    const data = await placeholderImage((index * 47) % 360)
    const image = await payload.create({
      collection: 'media',
      data: { alt: 'Placeholder image', caption: 'Placeholder caption.', credit: 'Sample' },
      file: {
        data,
        mimetype: 'image/jpeg',
        name: `placeholder-${index + 1}.jpg`,
        size: data.length,
      },
    })
    const article = await payload.create({
      collection: 'articles',
      data: {
        title,
        summary:
          'Placeholder summary: one or two sentences that tell the reader why this story matters.',
        content: body([...filler, ...filler, ...filler]),
        section: sectionIds[sectionIndex],
        authors: [staff[index % staff.length].id],
        heroImage: image.id,
        placement: index === 0 ? 'lead' : index < 4 ? 'featured' : 'standard',
        publishedAt: new Date(Date.now() - index * 36e5).toISOString(),
        _status: 'published',
      },
    })
    articleIds.push(article.id)
  }

  const issues = await payload.find({ collection: 'issues', limit: 1 })
  if (issues.totalDocs === 0) {
    await payload.create({
      collection: 'issues',
      data: {
        title: 'Sample Issue',
        volume: 1,
        number: 1,
        date: new Date().toISOString(),
        articles: articleIds.slice(0, 8),
        printEdition: true,
        paperSize: 'letter',
        _status: 'published',
      },
    })
  }
  payload.logger.info(`Demo content ready (${articleIds.length} stories).`)
}

await run()
process.exit(0)
