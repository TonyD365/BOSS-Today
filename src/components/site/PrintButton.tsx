'use client'

import React from 'react'

export function PrintButton() {
  return (
    <button type="button" className="button" onClick={() => window.print()}>
      Print or save as PDF
    </button>
  )
}
