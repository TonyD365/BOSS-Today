import { APIError, type CollectionBeforeOperationHook, type CollectionConfig } from 'payload'

import { atLeast, withPermission } from '../access'
import { auditDelete } from '../hooks/audit'
import { githubImagesConfig } from '../storage/github'

/**
 * On Vercel the disk is read-only, so uploads need Vercel Blob or the GitHub
 * image repository. Say so plainly instead of failing with "mkdir 'media'".
 */
const requireStorage: CollectionBeforeOperationHook = ({ operation, req }) => {
  const uploading = (operation === 'create' || operation === 'update') && Boolean(req.file)
  const configured = Boolean(githubImagesConfig() || process.env.BLOB_READ_WRITE_TOKEN?.trim())
  if (uploading && process.env.VERCEL && !configured) {
    throw new APIError(
      'Image storage isn’t set up yet, so images can’t be uploaded. Ask the super admin to connect Vercel Blob (Vercel → Storage → Blob) or the GitHub image repository, then redeploy.',
      503,
      undefined,
      true,
    )
  }
}

export const Media: CollectionConfig = {
  slug: 'media',
  admin: { useAsTitle: 'alt', group: 'Newsroom' },
  hooks: { beforeOperation: [requireStorage], afterDelete: [auditDelete('image')] },
  access: {
    // With the GitHub repositories, readers get published images from the public
    // one and the files here include drafts, so only staff can fetch them.
    read: (args) => (githubImagesConfig() ? atLeast('reporter')(args) : true),
    create: atLeast('reporter'),
    update: atLeast('reporter'),
    delete: withPermission('media'),
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      required: true,
      admin: { description: 'Describe the image for readers who cannot see it.' },
    },
    { name: 'caption', type: 'text' },
    { name: 'credit', type: 'text', admin: { description: 'Photographer or source.' } },
  ],
  upload: {
    mimeTypes: ['image/*'],
    // Store WebP no wider than 2400px: sharp enough for print, small enough for the image repo.
    resizeOptions: { width: 2400, withoutEnlargement: true },
    formatOptions: { format: 'webp', options: { quality: 82 } },
    imageSizes: [
      {
        name: 'thumb',
        formatOptions: { format: 'webp', options: { quality: 78 } },
        width: 400,
        withoutEnlargement: true,
      },
      {
        name: 'card',
        formatOptions: { format: 'webp', options: { quality: 78 } },
        width: 800,
        withoutEnlargement: true,
      },
      {
        name: 'hero',
        formatOptions: { format: 'webp', options: { quality: 78 } },
        width: 1600,
        withoutEnlargement: true,
      },
    ],
  },
}
