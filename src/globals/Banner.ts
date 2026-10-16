import type { GlobalConfig } from 'payload'

import { canPublishIssues, hasPermission } from '../access'
import { publishBannerNowEndpoint } from '../endpoints/bannerPublishing'
import { auditGlobal } from '../hooks/audit'
import { guardGlobalPublishing } from '../hooks/publishing'

/**
 * A notice across the top of every page. It goes live with the next issue, or
 * straight away when someone with the Issue permission publishes it on its own.
 * Readers get it from Cloudflare KV (see src/publishing/banner.ts), never from
 * the built pages, so it costs no rebuilds.
 */
export const Banner: GlobalConfig = {
  slug: 'banner',
  label: 'Banner',
  admin: {
    group: 'Site',
    description:
      'A notice across the top of every page, such as a school closure. It goes live with the next issue, or use “Publish banner now” for something urgent; neither rebuilds the website. Leave the text empty to show no banner.',
    components: {
      elements: {
        PublishButton: '@/components/admin/Hidden#Hidden',
        UnpublishButton: '@/components/admin/Hidden#Hidden',
      },
    },
  },
  versions: { drafts: true, max: 10 },
  endpoints: [publishBannerNowEndpoint],
  access: {
    read: () => true,
    update: ({ req }) => canPublishIssues(req.user) || hasPermission(req.user, 'design'),
  },
  hooks: {
    beforeChange: [guardGlobalPublishing('The banner')],
    afterChange: [auditGlobal('banner')],
  },
  fields: [
    {
      name: 'text',
      type: 'text',
      maxLength: 140,
      admin: { placeholder: 'School is closed today because of snow.' },
    },
    {
      name: 'link',
      type: 'text',
      admin: { placeholder: 'https://… or /article/…', description: 'Optional.' },
      validate: (value: unknown) =>
        !value || /^(https?:\/\/|\/)/.test(String(value)) || 'Start with https:// or /',
    },
    {
      name: 'style',
      type: 'radio',
      defaultValue: 'info',
      options: [
        { label: 'Normal', value: 'info' },
        { label: 'Urgent (red)', value: 'urgent' },
      ],
    },
    {
      name: 'expiresAt',
      type: 'date',
      label: 'Hide after',
      admin: {
        date: { pickerAppearance: 'dayAndTime' },
        description:
          'Readers’ browsers hide the banner at this time by themselves, without a rebuild. Leave empty to keep it up until you remove it.',
      },
    },
    {
      name: 'publishNow',
      type: 'ui',
      admin: {
        position: 'sidebar',
        components: { Field: '@/components/admin/PublishBannerNow#PublishBannerNow' },
      },
    },
  ],
}
