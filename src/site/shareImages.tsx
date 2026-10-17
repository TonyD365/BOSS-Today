/**
 * Pictures made while the site is built: the preview shown when a link is
 * shared (one per story, and one for the site), and the site's icons. Drawn
 * with satori (layout and text) and sharp (photos and PNG output), so nothing
 * runs on the newsroom server.
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import React from 'react'
import satori from 'satori'
import sharp from 'sharp'

export const SHARE_WIDTH = 1200
export const SHARE_HEIGHT = 630

const INK = '#121212'

/** The masthead's thick-and-thin rule (satori can't draw double borders). */
const Rule = ({ width, color = INK }: { width: number | string; color?: string }) => (
  <div style={{ display: 'flex', flexDirection: 'column', width }}>
    <div style={{ display: 'flex', height: 3, background: color }} />
    <div style={{ display: 'flex', height: 1, marginTop: 3, background: color }} />
  </div>
)
const PAPER = '#ffffff'

type Font = { name: string; data: Buffer; weight: 400 | 600 | 700; style: 'normal' }
let fonts: Font[] | null = null

const loadFonts = async () => {
  if (fonts) return fonts
  const dir = path.join(process.cwd(), 'src/site/fonts')
  const read = (file: string) => fs.readFile(path.join(dir, file))
  fonts = [
    {
      name: 'Masthead',
      data: await read('ManufacturingConsent.ttf'),
      weight: 400,
      style: 'normal',
    },
    { name: 'Serif', data: await read('Newsreader-Bold.ttf'), weight: 700, style: 'normal' },
    { name: 'Sans', data: await read('LibreFranklin-SemiBold.ttf'), weight: 600, style: 'normal' },
  ]
  return fonts
}

const toPng = async (node: React.ReactElement, width: number, height: number) => {
  const svg = await satori(node, { width, height, fonts: await loadFonts() })
  return sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer()
}

/** A photo as a JPEG data URL, cropped to fill the box (satori can't read WebP). */
const photo = async (url: string, width: number, height: number) => {
  try {
    const response = await fetch(url)
    if (!response.ok) return null
    const jpeg = await sharp(Buffer.from(await response.arrayBuffer()))
      .resize(width, height, { fit: 'cover' })
      .jpeg({ quality: 82 })
      .toBuffer()
    return `data:image/jpeg;base64,${jpeg.toString('base64')}`
  } catch {
    return null
  }
}

/** Shorter headlines get bigger type. */
const headlineSize = (title: string) =>
  title.length < 40 ? 68 : title.length < 70 ? 58 : title.length < 110 ? 48 : 40

const clip = (text: string, max: number) =>
  text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text

/** The preview for one story: its photo with the headline over it, or the headline alone. */
export const storyShareImage = async ({
  siteName,
  title,
  section,
  imageUrl,
}: {
  siteName: string
  title: string
  section: string | null
  imageUrl: string | null
}) => {
  const image = imageUrl ? await photo(imageUrl, SHARE_WIDTH, SHARE_HEIGHT) : null
  const headline = clip(title, 140)
  const color = image ? PAPER : INK
  return toPng(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        position: 'relative',
        background: PAPER,
        color,
      }}
    >
      {image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={image}
          width={SHARE_WIDTH}
          height={SHARE_HEIGHT}
          style={{ position: 'absolute', top: 0, left: 0 }}
          alt=""
        />
      )}
      {image && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: SHARE_WIDTH,
            height: SHARE_HEIGHT,
            display: 'flex',
            backgroundImage:
              'linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.05) 30%, rgba(0,0,0,0.35) 55%, rgba(0,0,0,0.88) 100%)',
          }}
        />
      )}
      <div
        style={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          width: '100%',
          padding: '44px 60px 52px',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              paddingBottom: 14,
            }}
          >
            <span style={{ fontFamily: 'Masthead', fontSize: 52 }}>{siteName}</span>
            {section && (
              <span
                style={{
                  fontFamily: 'Sans',
                  fontSize: 22,
                  letterSpacing: 2,
                  textTransform: 'uppercase',
                }}
              >
                {section}
              </span>
            )}
          </div>
          <Rule width="100%" color={color} />
        </div>
        <div
          style={{
            display: 'flex',
            fontFamily: 'Serif',
            fontSize: headlineSize(headline),
            lineHeight: 1.08,
            maxWidth: 1080,
          }}
        >
          {headline}
        </div>
      </div>
    </div>,
    SHARE_WIDTH,
    SHARE_HEIGHT,
  )
}

/** The preview for pages without their own picture. */
export const siteShareImage = ({ siteName, tagline }: { siteName: string; tagline: string }) =>
  toPng(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: PAPER,
        color: INK,
      }}
    >
      <Rule width={1000} />
      <span style={{ fontFamily: 'Masthead', fontSize: 150, margin: '36px 0 24px' }}>
        {siteName}
      </span>
      <Rule width={1000} />
      <span style={{ fontFamily: 'Sans', fontSize: 28, marginTop: 30, color: '#444' }}>
        {clip(tagline, 90)}
      </span>
    </div>,
    SHARE_WIDTH,
    SHARE_HEIGHT,
  )

/** The square mark used as the browser and home screen icon: a blackletter B. */
export const iconImage = (size: number, letter: string) =>
  toPng(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: INK,
        color: PAPER,
        borderRadius: size >= 180 ? 0 : size * 0.18,
      }}
    >
      <span style={{ fontFamily: 'Masthead', fontSize: size * 0.78, marginTop: size * 0.04 }}>
        {letter}
      </span>
    </div>,
    size,
    size,
  )
