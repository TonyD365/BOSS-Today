import type { SitePart } from '@/design/types'

/** What each site part is called in the designer. */
export const SITE_PART_NAMES: Record<SitePart, string> = {
  nav: 'Navigation bar',
  search: 'Search box',
  date: 'Today’s date',
  theme: 'Light/dark switch',
  sitename: 'Site name',
  staff: 'Staff sign-in',
  links: 'Footer links',
  tagline: 'Tagline',
}
