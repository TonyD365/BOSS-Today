import type { CollectionConfig } from 'payload'

import { canPublishIssues, isSuperAdminUser } from '../access'
import {
  deploymentProgressEndpoint,
  latestDeploymentEndpoint,
  rebuildEndpoint,
} from '../endpoints/issuePublishing'

/** Every request to rebuild the public site. Written by the server only. */
export const Deployments: CollectionConfig = {
  slug: 'deployments',
  labels: { singular: 'Site rebuild', plural: 'Site rebuilds' },
  admin: {
    useAsTitle: 'reason',
    defaultColumns: ['createdAt', 'reason', 'status', 'buildStatus', 'actor', 'issue'],
    group: 'Admin',
    hidden: ({ user }) => !canPublishIssues(user),
    description:
      'Each publish, withdrawal or urgent banner rebuilds the public site on Cloudflare Pages. Publishing stops at 400 rebuilds a month; withdrawals may use up to 490.',
  },
  defaultSort: '-createdAt',
  endpoints: [rebuildEndpoint, latestDeploymentEndpoint, deploymentProgressEndpoint],
  access: {
    read: ({ req }) => isSuperAdminUser(req.user) || canPublishIssues(req.user),
    create: () => false,
    update: () => false,
    delete: () => false,
  },
  fields: [
    {
      name: 'reason',
      type: 'select',
      required: true,
      options: [
        { label: 'Issue published', value: 'issue' },
        { label: 'Emergency withdrawal', value: 'withdrawal' },
        { label: 'Manual rebuild', value: 'rebuild' },
        { label: 'Banner published now', value: 'banner' },
      ],
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      index: true,
      options: [
        { label: 'Triggered', value: 'triggered' },
        { label: 'Failed', value: 'failed' },
        { label: 'Not configured', value: 'not-configured' },
      ],
    },
    { name: 'httpStatus', type: 'number' },
    {
      name: 'buildStatus',
      type: 'select',
      label: 'Build',
      options: [
        { label: 'Queued', value: 'queued' },
        { label: 'Building', value: 'building' },
        { label: 'Live', value: 'live' },
        { label: 'Failed', value: 'failed' },
        { label: 'Canceled', value: 'canceled' },
      ],
    },
    { name: 'cloudflareId', type: 'text', label: 'Cloudflare deployment' },
    { name: 'finishedAt', type: 'date', admin: { date: { pickerAppearance: 'dayAndTime' } } },
    { name: 'note', type: 'textarea' },
    { name: 'issue', type: 'relationship', relationTo: 'issues', admin: { allowCreate: false } },
    { name: 'actor', type: 'relationship', relationTo: 'users', admin: { allowCreate: false } },
  ],
}
