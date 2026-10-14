'use client'

import React, { useSyncExternalStore } from 'react'

const subscribe = () => () => {}
const today = () => new Intl.DateTimeFormat('en-CA', { dateStyle: 'full' }).format(new Date())

/** Today's date, rendered in the browser so cached pages never show a stale day. */
export function Today() {
  const label = useSyncExternalStore(subscribe, today, () => '')
  return <time>{label}</time>
}
