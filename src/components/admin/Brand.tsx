import React from 'react'

const masthead: React.CSSProperties = {
  fontFamily: "'Manufacturing Consent', 'Old English Text MT', serif",
  fontWeight: 400,
  lineHeight: 1,
  color: 'var(--theme-text)',
  whiteSpace: 'nowrap',
}

/** Large masthead on the sign-in screen. */
export function Logo() {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ ...masthead, fontSize: 56 }}>BOSS Today</div>
      <div style={{ marginTop: 6, fontSize: 13, opacity: 0.7 }}>Staff newsroom</div>
    </div>
  )
}

/** Small mark in the admin navigation. */
export function Icon() {
  return <span style={{ ...masthead, fontSize: 26 }}>B</span>
}
