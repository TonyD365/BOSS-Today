import { withPayload } from '@payloadcms/next/withPayload'
import type { NextConfig } from 'next'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(__filename)

const publicSite = process.env.PUBLIC_SITE_URL?.replace(/\/$/, '')

// Reader pages live on the static public site; old links to this host go there.
const READER_PATHS = [
  '/',
  '/article/:path*',
  '/section/:path*',
  '/author/:path*',
  '/issues',
  '/issues/:edition',
  '/search',
  '/about',
]

const nextConfig: NextConfig = {
  async redirects() {
    if (!publicSite) return []
    return READER_PATHS.map((source) => ({
      source,
      destination: `${publicSite}${source.replace(/:path\*/, ':path*')}`,
      permanent: false,
    }))
  },
  // Headless Chromium for PDF export is loaded at runtime, never bundled.
  serverExternalPackages: ['@sparticuz/chromium', 'puppeteer-core'],
  outputFileTracingIncludes: {
    '/issues/*/pdf': ['./node_modules/@sparticuz/chromium/bin/**'],
  },
  images: {
    localPatterns: [
      {
        pathname: '/api/media/file/**',
      },
    ],
  },
  webpack: (webpackConfig) => {
    webpackConfig.resolve.extensionAlias = {
      '.cjs': ['.cts', '.cjs'],
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
    }

    return webpackConfig
  },
  turbopack: {
    root: path.resolve(dirname),
  },
}

export default withPayload(nextConfig, { devBundleServerPackages: false })
