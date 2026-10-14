import { postgresAdapter } from '@payloadcms/db-postgres'
import { nodemailerAdapter } from '@payloadcms/email-nodemailer'
import { BlocksFeature, lexicalEditor } from '@payloadcms/richtext-lexical'
import { cloudStoragePlugin } from '@payloadcms/plugin-cloud-storage'
import { vercelBlobStorage } from '@payloadcms/storage-vercel-blob'
import path from 'path'
import { buildConfig } from 'payload'
import sharp from 'sharp'
import { fileURLToPath } from 'url'

import { YouTube } from './blocks/YouTube'
import { Articles } from './collections/Articles'
import { AuditLog } from './collections/AuditLog'
import { Issues } from './collections/Issues'
import { Media } from './collections/Media'
import { Sections } from './collections/Sections'
import { Users } from './collections/Users'
import { emailConfig } from './lib/email'
import { githubAdapter, githubStorageConfig } from './storage/github'
import { FrontPage } from './globals/FrontPage'
import { Settings } from './globals/Settings'

const github = githubStorageConfig()
const mail = emailConfig()

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
    meta: { titleSuffix: ' — BOSS Today' },
    components: {
      afterLogin: ['@/components/admin/SignIn#SignIn'],
      beforeDashboard: ['@/components/admin/Dashboard#Dashboard'],
      graphics: {
        Logo: '@/components/admin/Brand#Logo',
        Icon: '@/components/admin/Brand#Icon',
      },
    },
    livePreview: {
      breakpoints: [
        { label: 'Phone', name: 'phone', width: 390, height: 844 },
        { label: 'Desktop', name: 'desktop', width: 1280, height: 900 },
      ],
    },
  },
  collections: [Articles, Issues, Sections, Media, Users, AuditLog],
  globals: [FrontPage, Settings],
  editor: lexicalEditor({
    features: ({ defaultFeatures }) => [...defaultFeatures, BlocksFeature({ blocks: [YouTube] })],
  }),
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URL || '',
    },
    migrationDir: path.resolve(dirname, 'migrations'),
  }),
  sharp,
  // Without SMTP settings Payload prints emails to the console (fine for local development).
  email: mail
    ? nodemailerAdapter({
        defaultFromAddress: mail.from,
        defaultFromName: mail.fromName,
        skipVerify: true,
        transportOptions: {
          host: mail.host,
          port: mail.port,
          secure: mail.secure,
          auth: mail.auth,
        },
      })
    : undefined,
  plugins: [
    // Images go to the GitHub image repository when it is configured, otherwise
    // to Vercel Blob, otherwise to ./media during local development. Exactly one
    // storage plugin is registered, and it always adds its fields, so the database
    // schema is the same whichever storage is in use.
    github
      ? cloudStoragePlugin({
          alwaysInsertFields: true,
          collections: {
            media: {
              adapter: githubAdapter(github),
              disableLocalStorage: true,
              disablePayloadAccessControl: true,
              prefix: 'media',
            },
          },
        })
      : vercelBlobStorage({
          enabled: Boolean(process.env.BLOB_READ_WRITE_TOKEN),
          alwaysInsertFields: true,
          collections: { media: true },
          token: process.env.BLOB_READ_WRITE_TOKEN,
          clientUploads: true,
        }),
  ],
})
