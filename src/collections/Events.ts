import type { CollectionConfig } from 'payload'

import { atLeast } from '../access'
import {
  auditLiveChange,
  refreshBoardAfterChange,
  refreshBoardAfterDelete,
} from '../publishing/board'

/** The school calendar. Changes reach the website within a minute, without a rebuild. */
export const Events: CollectionConfig = {
  slug: 'events',
  labels: { singular: 'Event', plural: 'Calendar' },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'startsAt', 'location'],
    group: 'Live',
    description:
      'Shown on the front page in the week before, and on the Calendar page. Saved changes reach the website within a minute.',
  },
  defaultSort: 'startsAt',
  access: {
    read: atLeast('reporter'),
    // Editors check times and places before they go up.
    create: atLeast('editor'),
    update: atLeast('editor'),
    delete: atLeast('editor'),
  },
  hooks: {
    afterChange: [refreshBoardAfterChange, auditLiveChange('event')],
    afterDelete: [refreshBoardAfterDelete],
  },
  fields: [
    { name: 'title', type: 'text', required: true, maxLength: 120 },
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
        {
          name: 'endsAt',
          type: 'date',
          label: 'Ends',
          admin: { width: '33%', date: { pickerAppearance: 'dayAndTime' } },
        },
        {
          name: 'allDay',
          type: 'checkbox',
          label: 'All day',
          admin: { width: '33%' },
        },
      ],
    },
    { name: 'location', type: 'text', admin: { placeholder: 'Cafeteria' } },
    { name: 'description', type: 'textarea', maxLength: 500 },
    {
      name: 'link',
      type: 'text',
      admin: {
        placeholder: 'https://… or /article/…',
        description: 'Optional: sign-up form or story.',
      },
      validate: (value: unknown) =>
        !value || /^(https?:\/\/|\/)/.test(String(value)) || 'Start with https:// or /',
    },
  ],
}
