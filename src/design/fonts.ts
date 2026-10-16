/**
 * Fonts for the designer: free Google Fonts (SIL Open Font License), chosen
 * to suit a newspaper. Only the fonts a design uses are loaded on the site.
 */
export type DesignFont = {
  id: string
  label: string
  family: string
  /** Google Fonts css2 family parameter. */
  google: string
  kind: 'serif' | 'sans' | 'display' | 'hand' | 'mono'
}

export const FONTS: DesignFont[] = [
  {
    id: 'newsreader',
    label: 'Newsreader',
    family: "'Newsreader', Georgia, serif",
    google: 'Newsreader:ital,opsz,wght@0,6..72,400..700;1,6..72,400..700',
    kind: 'serif',
  },
  {
    id: 'franklin',
    label: 'Libre Franklin',
    family: "'Libre Franklin', Arial, sans-serif",
    google: 'Libre+Franklin:ital,wght@0,400..700;1,400..700',
    kind: 'sans',
  },
  {
    id: 'masthead',
    label: 'Manufacturing Consent',
    family: "'Manufacturing Consent', serif",
    google: 'Manufacturing+Consent',
    kind: 'display',
  },
  {
    id: 'playfair',
    label: 'Playfair Display',
    family: "'Playfair Display', Georgia, serif",
    google: 'Playfair+Display:ital,wght@0,400..900;1,400..900',
    kind: 'serif',
  },
  {
    id: 'merriweather',
    label: 'Merriweather',
    family: "'Merriweather', Georgia, serif",
    google: 'Merriweather:ital,wght@0,400;0,700;1,400;1,700',
    kind: 'serif',
  },
  {
    id: 'lora',
    label: 'Lora',
    family: "'Lora', Georgia, serif",
    google: 'Lora:ital,wght@0,400..700;1,400..700',
    kind: 'serif',
  },
  {
    id: 'source-serif',
    label: 'Source Serif 4',
    family: "'Source Serif 4', Georgia, serif",
    google: 'Source+Serif+4:ital,opsz,wght@0,8..60,400..700;1,8..60,400..700',
    kind: 'serif',
  },
  {
    id: 'inter',
    label: 'Inter',
    family: "'Inter', Arial, sans-serif",
    google: 'Inter:ital,wght@0,400..800;1,400..800',
    kind: 'sans',
  },
  {
    id: 'roboto',
    label: 'Roboto',
    family: "'Roboto', Arial, sans-serif",
    google: 'Roboto:ital,wght@0,400;0,700;1,400;1,700',
    kind: 'sans',
  },
  {
    id: 'montserrat',
    label: 'Montserrat',
    family: "'Montserrat', Arial, sans-serif",
    google: 'Montserrat:ital,wght@0,400..800;1,400..800',
    kind: 'sans',
  },
  {
    id: 'oswald',
    label: 'Oswald',
    family: "'Oswald', Arial Narrow, sans-serif",
    google: 'Oswald:wght@400..700',
    kind: 'display',
  },
  {
    id: 'bebas',
    label: 'Bebas Neue',
    family: "'Bebas Neue', Impact, sans-serif",
    google: 'Bebas+Neue',
    kind: 'display',
  },
  {
    id: 'anton',
    label: 'Anton',
    family: "'Anton', Impact, sans-serif",
    google: 'Anton',
    kind: 'display',
  },
  {
    id: 'caveat',
    label: 'Caveat',
    family: "'Caveat', cursive",
    google: 'Caveat:wght@400..700',
    kind: 'hand',
  },
  {
    id: 'marker',
    label: 'Permanent Marker',
    family: "'Permanent Marker', cursive",
    google: 'Permanent+Marker',
    kind: 'hand',
  },
  {
    id: 'mono',
    label: 'Roboto Mono',
    family: "'Roboto Mono', monospace",
    google: 'Roboto+Mono:ital,wght@0,400..700;1,400..700',
    kind: 'mono',
  },
]

const byId = new Map(FONTS.map((font) => [font.id, font]))

export const DEFAULT_SERIF = 'newsreader'
export const DEFAULT_SANS = 'franklin'

export const fontFamily = (id: string) => (byId.get(id) ?? byId.get(DEFAULT_SERIF)!).family

export const isFont = (id: unknown): id is string => typeof id === 'string' && byId.has(id)

/** One stylesheet link for the given fonts. */
export const fontsUrl = (ids: Iterable<string>) => {
  const families = [...new Set(ids)].filter(isFont).map((id) => `family=${byId.get(id)!.google}`)
  return families.length > 0
    ? `https://fonts.googleapis.com/css2?${families.join('&')}&display=swap`
    : null
}
