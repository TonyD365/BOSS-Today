import type { SiteInfo } from './render'

type Link = { label: string; href: string }

/**
 * What the header and footer site parts show: the navigation (sections,
 * Issues, and pages chosen for it) and the footer links. Shared by the
 * designer preview and the public build so both list the same things.
 */
export const siteInfo = (input: {
  name: string
  tagline: string
  footerNote: string
  sections: { name: string; slug: string }[]
  pages: {
    title: string
    slug: string
    showInNav?: boolean | null
    showInFooter?: boolean | null
  }[]
  socialLinks: { label: string; url: string }[]
  hasTags: boolean
  hasStaff: boolean
  hasContact: boolean
  hasAbout: boolean
  cmsUrl: string
}): SiteInfo => {
  const page = (p: { title: string; slug: string }): Link => ({
    label: p.title,
    href: `/p/${p.slug}/`,
  })
  const nav: Link[] = [
    ...input.sections.map((s) => ({ label: s.name, href: `/section/${s.slug}/` })),
    { label: 'Issues', href: '/issues/' },
    ...input.pages.filter((p) => p.showInNav).map(page),
  ]
  const links: Link[] = [
    ...(input.hasAbout ? [{ label: 'About', href: '/about/' }] : []),
    ...input.pages.filter((p) => p.showInFooter).map(page),
    ...(input.hasTags ? [{ label: 'Topics', href: '/tags/' }] : []),
    { label: 'Scores', href: '/scores/' },
    { label: 'Calendar', href: '/calendar/' },
    ...(input.hasStaff ? [{ label: 'Our Staff', href: '/staff/' }] : []),
    ...(input.hasContact ? [{ label: 'Contact us', href: '/contact/' }] : []),
    { label: 'Our standards', href: '/standards/' },
    { label: 'RSS', href: '/subscribe/' },
    ...input.socialLinks.map((l) => ({ label: l.label, href: l.url })),
  ]
  return {
    name: input.name,
    tagline: input.tagline,
    footerNote: input.footerNote,
    nav,
    links,
    staffUrl: `${input.cmsUrl.replace(/\/$/, '')}/admin`,
  }
}
