import { postgresAdapter } from '@payloadcms/db-postgres'
import { BlocksFeature, lexicalEditor } from '@payloadcms/richtext-lexical'
import { cloudStoragePlugin } from '@payloadcms/plugin-cloud-storage'
import { vercelBlobStorage } from '@payloadcms/storage-vercel-blob'
import path from 'path'
import { buildConfig } from 'payload'
import sharp from 'sharp'
import { fileURLToPath } from 'url'

import { YouTube } from './blocks/YouTube'
import { Articles } from './collections/Articles'
import { Assignments } from './collections/Assignments'
import { AuditLog } from './collections/AuditLog'
import { Comments } from './collections/Comments'
import { Deployments } from './collections/Deployments'
import { IssueChecks } from './collections/IssueChecks'
import { Issues } from './collections/Issues'
import { Media } from './collections/Media'
import { Sections } from './collections/Sections'
import { Tags } from './collections/Tags'
import { Templates } from './collections/Templates'
import { Users } from './collections/Users'
import { githubAdapter, githubStorageConfig } from './storage/github'
import { siteExportEndpoint } from './endpoints/siteExport'
import { Banner } from './globals/Banner'
import { FrontPage } from './globals/FrontPage'
import { Settings } from './globals/Settings'

const github = githubStorageConfig()

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
      afterNavLinks: ['@/components/admin/NavLinks#NavLinks'],
      views: {
        dashboard: { Component: '@/components/admin/DashboardView#DashboardView' },
        // No email is sent from this site, so password help means asking an exec,
        // and the first account comes from a super admin's Google sign-in.
        forgot: { Component: '@/components/admin/AccessHelp#PasswordHelp', path: '/forgot' },
        assignmentBoard: {
          Component: '@/components/admin/AssignmentBoardView#AssignmentBoardView',
          path: '/assignment-board',
          meta: { title: 'Assignment board' },
        },
        newStory: {
          Component: '@/components/admin/NewStoryView#NewStoryView',
          path: '/new-story',
          meta: { title: 'New story' },
        },
        publishIssue: {
          Component: '@/components/admin/PublishIssue#PublishIssue',
          path: '/publish-issue',
          meta: { title: 'Review & publish' },
        },
        createFirstUser: {
          Component: '@/components/admin/AccessHelp#FirstSignIn',
          path: '/create-first-user',
        },
      },
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
  collections: [
    Articles,
    Assignments,
    Comments,
    Templates,
    Issues,
    Sections,
    Tags,
    Media,
    Users,
    AuditLog,
    IssueChecks,
    Deployments,
  ],
  globals: [FrontPage, Banner, Settings],
  endpoints: [siteExportEndpoint],
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
