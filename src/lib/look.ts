import { contrast, isColor, readableNear } from '../design/color'
import { fontFamily, FONTS, isFont } from '../design/fonts'

/**
 * The site's look, from Site settings: three colours and three fonts used by
 * every page that isn't drawn in the designer. Dark mode keeps its own dark
 * paper and text and gets a lighter version of the accent colour.
 */
export type Look = {
  accent: string
  ink: string
  paper: string
  serif: string
  sans: string
  masthead: string
}

export const DEFAULT_LOOK: Look = {
  accent: '#326891',
  ink: '#121212',
  paper: '#ffffff',
  serif: 'newsreader',
  sans: 'franklin',
  masthead: 'masthead',
}

const DARK_PAPER = '#121212'

export const cleanLook = (value: unknown): Look => {
  const raw = (value ?? {}) as Record<string, unknown>
  const color = (key: 'accent' | 'ink' | 'paper') =>
    isColor(raw[key]) ? String(raw[key]).toLowerCase() : DEFAULT_LOOK[key]
  const font = (key: 'serif' | 'sans' | 'masthead') =>
    isFont(raw[key]) ? String(raw[key]) : DEFAULT_LOOK[key]
  return {
    accent: color('accent'),
    ink: color('ink'),
    paper: color('paper'),
    serif: font('serif'),
    sans: font('sans'),
    masthead: font('masthead'),
  }
}

/** Text and links must stay readable on the chosen paper. */
export const lookProblems = (look: Look) => {
  const problems: string[] = []
  if (contrast(look.ink, look.paper) < 7)
    problems.push(
      `Text colour ${look.ink} is hard to read on ${look.paper}. Try ${readableNear(look.ink, look.paper, 7)}.`,
    )
  if (contrast(look.accent, look.paper) < 4.5)
    problems.push(
      `Link colour ${look.accent} is hard to read on ${look.paper}. Try ${readableNear(look.accent, look.paper, 4.5)}.`,
    )
  return problems
}

/** CSS variables for the look; `light` goes before the dark theme, `dark` after it. */
export const lookCss = (look: Look) => {
  const light = `:root {
  --ink: ${look.ink};
  --rule-strong: ${look.ink};
  --paper: ${look.paper};
  --accent: ${look.accent};
  --font-serif: ${fontFamily(look.serif)};
  --font-sans: ${fontFamily(look.sans)};
  --font-masthead: ${fontFamily(look.masthead)};
}`
  const darkAccent = readableNear(look.accent, DARK_PAPER, 4.5)
  const dark = `@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) { --accent: ${darkAccent}; }
}
:root[data-theme='dark'] { --accent: ${darkAccent}; }`
  return { light, dark }
}

export const lookFonts = (look: Look) => [look.serif, look.sans, look.masthead]

export const FONT_OPTIONS = FONTS.map((font) => ({ label: font.label, value: font.id }))
