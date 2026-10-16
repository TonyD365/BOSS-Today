import type { CollectionConfig } from 'payload'

import { atLeast } from '../access'
import {
  auditLiveChange,
  refreshBoardAfterChange,
  refreshBoardAfterDelete,
} from '../publishing/board'

/**
 * School teams' games. Scores go to the website within a minute of saving,
 * through Cloudflare KV, without a rebuild.
 */
export const Games: CollectionConfig = {
  slug: 'games',
  labels: { singular: 'Game', plural: 'Scores & schedule' },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['team', 'opponent', 'startsAt', 'status', 'ourScore', 'theirScore'],
    group: 'Live',
    description:
      'Saved changes reach the website within a minute, without a rebuild. Mark a game Live while it is on and Final when it ends.',
  },
  defaultSort: '-startsAt',
  access: {
    read: atLeast('reporter'),
    create: atLeast('reporter'),
    update: atLeast('reporter'),
    delete: atLeast('editor'),
  },
  hooks: {
    beforeChange: [
      ({ data }) => {
        data.title = `${data.team ?? 'Bur Oak'} vs ${data.opponent ?? 'TBD'}`
        return data
      },
    ],
    afterChange: [refreshBoardAfterChange, auditLiveChange('game')],
    afterDelete: [refreshBoardAfterDelete],
  },
  fields: [
    { name: 'title', type: 'text', admin: { hidden: true } },
    {
      type: 'row',
      fields: [
        {
          name: 'team',
          type: 'text',
          required: true,
          admin: { width: '50%', placeholder: 'Senior Boys Basketball' },
        },
        {
          name: 'opponent',
          type: 'text',
          required: true,
          admin: { width: '50%', placeholder: 'Markville SS' },
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'startsAt',
          type: 'date',
          required: true,
          index: true,
          label: 'Starts',
          admin: { width: '34%', date: { pickerAppearance: 'dayAndTime' } },
        },
        { name: 'location', type: 'text', admin: { width: '33%', placeholder: 'Bur Oak gym' } },
        {
          name: 'home',
          type: 'radio',
          defaultValue: 'home',
          options: [
            { label: 'Home', value: 'home' },
            { label: 'Away', value: 'away' },
          ],
          admin: { width: '33%', layout: 'horizontal' },
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'status',
          type: 'select',
          required: true,
          defaultValue: 'scheduled',
          options: [
            { label: 'Scheduled', value: 'scheduled' },
            { label: 'Live', value: 'live' },
            { label: 'Final', value: 'final' },
            { label: 'Postponed or cancelled', value: 'cancelled' },
          ],
          admin: { width: '34%' },
        },
        {
          name: 'ourScore',
          type: 'number',
          label: 'Bur Oak score',
          min: 0,
          admin: { width: '33%' },
        },
        {
          name: 'theirScore',
          type: 'number',
          label: 'Their score',
          min: 0,
          admin: { width: '33%' },
        },
      ],
    },
    {
      name: 'note',
      type: 'text',
      maxLength: 120,
      admin: { placeholder: 'e.g. 2nd period, OT, Semifinal' },
    },
    {
      name: 'recap',
      type: 'relationship',
      relationTo: 'articles',
      label: 'Game recap story',
      admin: {
        allowCreate: false,
        description: 'Linked from the score once the story is published.',
      },
    },
  ],
}
