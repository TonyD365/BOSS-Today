import React from 'react'

import { Footer } from '@/components/site/Footer'
import { Header } from '@/components/site/Header'
import { getSections, getSettings } from '@/lib/data'

export const revalidate = 600

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const [sections, settings] = await Promise.all([getSections(), getSettings()])
  return (
    <div className="site">
      <Header sections={sections} settings={settings} />
      <main>{children}</main>
      <Footer sections={sections} settings={settings} />
    </div>
  )
}
