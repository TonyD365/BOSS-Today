'use client'

import React, { useSyncExternalStore } from 'react'

const subscribe = () => () => {}
const today = () => new Intl.DateTimeFormat('en-CA', { dateStyle: 'full' }).format(new Date())

/**
 * Today's date, filled in by the browser so prebuilt pages never show a stale
 * day. On the static site, /assets/site.js fills [data-today].
 */
export function Today() {
  const label = useSyncExternalStore(subscribe, today, () => '')
  return <time data-today>{label}</time>
}
