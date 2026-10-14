import React from 'react'

import { Footer } from '@/components/site/Footer'
import { Header } from '@/components/site/Header'
import { getSections } from '@/lib/data'

export const revalidate = 600

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const sections = await getSections()
  return (
    <div className="site">
      <Header sections={sections} />
      <main>{children}</main>
      <Footer sections={sections} />
    </div>
  )
}
