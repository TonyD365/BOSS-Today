import { APIError, type Field, type GlobalBeforeChangeHook, type GlobalConfig } from 'payload'

import { withPermission } from '../access'
import { auditGlobal } from '../hooks/audit'
import { cleanLook, DEFAULT_LOOK, FONT_OPTIONS, lookProblems } from '../lib/look'
import { defaultStandards } from '../lib/standards'
import { guardGlobalPublishing } from '../hooks/publishing'

const revalidate = async () => {
  try {
    const { revalidatePath } = await import('next/cache')
    revalidatePath('/', 'layout')
  } catch {
    // Not running inside Next.
  }
}

/** Site-wide text that editors can change without touching code. */
const isEmpty = (value: unknown) => {
  const children = (value as { root?: { children?: { children?: unknown[] }[] } } | null)?.root
    ?.children
  return !children || children.every((child) => (child.children ?? []).length === 0)
}

const colorField = (name: string, label: string, defaultValue: string): Field => ({
  name,
  type: 'text',
  label,
  defaultValue,
  admin: { width: '33%', placeholder: defaultValue, description: 'A colour like #326891' },
  validate: (value: unknown) =>
    !value || /^#[0-9a-f]{6}$/i.test(String(value)) || 'Use a colour like #326891',
})

const fontField = (name: string, label: string, defaultValue: string): Field => ({
  name,
  type: 'select',
  label,
  defaultValue,
  options: FONT_OPTIONS,
  admin: { width: '33%' },
})

/** Refuses colours that would make the site hard to read. */
const checkLook: GlobalBeforeChangeHook = ({ data }) => {
  if (!data.look) return data
  const problems = lookProblems(cleanLook(data.look))
  if (problems.length > 0) throw new APIError(problems.join(' '), 400, undefined, true)
  return data
}

export const Settings: GlobalConfig = {
  slug: 'settings',
  label: 'Site Settings',
  admin: {
    group: 'Site',
    description: 'Changes go live with the next issue.',
    components: {
      elements: {
        PublishButton: '@/components/admin/Hidden#Hidden',
        UnpublishButton: '@/components/admin/Hidden#Hidden',
      },
    },
  },
  versions: { drafts: true, max: 10 },
  access: {
    read: () => true,
    update: withPermission('design'),
  },
  hooks: {
    beforeChange: [guardGlobalPublishing('Site settings'), checkLook],
    afterChange: [revalidate, auditGlobal('site settings')],
  },
  fields: [
    { name: 'siteName', type: 'text', required: true, defaultValue: 'BOSS Today' },
    {
      name: 'tagline',
      type: 'text',
      defaultValue: 'The student newspaper of Bur Oak Secondary School.',
    },
    {
      name: 'about',
      type: 'richText',
      label: 'About page',
      admin: { description: 'Shown at /about. Leave empty to hide the page.' },
    },
    {
      name: 'googleVerification',
      type: 'text',
      label: 'Google Search Console code',
      admin: {
        description:
          'From Google Search Console → Add property → URL prefix → HTML tag: paste only the content="…" value. Lets you see how the site does in Google search.',
      },
      validate: (value: unknown) =>
        !value ||
        /^[A-Za-z0-9_-]{10,100}$/.test(String(value)) ||
        'Paste only the code between the quotes.',
    },
    {
      name: 'look',
      type: 'group',
      label: 'Look',
      admin: {
        description:
          'Colours and fonts for every page not drawn in the site designer. Dark mode keeps its own dark background and gets a lighter link colour automatically.',
      },
      fields: [
        {
          type: 'row',
          fields: [
            colorField('accent', 'Links and highlights', DEFAULT_LOOK.accent),
            colorField('ink', 'Text', DEFAULT_LOOK.ink),
            colorField('paper', 'Background', DEFAULT_LOOK.paper),
          ],
        },
        {
          type: 'row',
          fields: [
            fontField('serif', 'Headlines and stories', DEFAULT_LOOK.serif),
            fontField('sans', 'Labels, bylines and menus', DEFAULT_LOOK.sans),
            fontField('masthead', 'Masthead', DEFAULT_LOOK.masthead),
          ],
        },
      ],
    },
    {
      name: 'standards',
      type: 'richText',
      label: 'Editorial standards',
      admin: {
        description:
          'Shown at /standards: how the paper works (independence, accuracy, corrections, sources…). Starts with a suggested draft; edit it to match how your newsroom works.',
      },
      hooks: { afterRead: [({ value }) => (isEmpty(value) ? defaultStandards : value)] },
    },
    {
      name: 'joinUs',
      type: 'richText',
      label: 'Join us',
      admin: {
        description:
          'Shown at the bottom of the Our Staff page: how to join the newsroom. Leave empty to hide it.',
      },
    },
    {
      name: 'socialLinks',
      type: 'array',
      labels: { singular: 'Link', plural: 'Social links' },
      fields: [
        {
          type: 'row',
          fields: [
            { name: 'label', type: 'text', required: true, admin: { placeholder: 'Instagram' } },
            { name: 'url', type: 'text', required: true, admin: { placeholder: 'https://…' } },
          ],
        },
      ],
    },
    {
      name: 'footerNote',
      type: 'text',
      defaultValue: 'Written and edited by students.',
    },
  ],
}
