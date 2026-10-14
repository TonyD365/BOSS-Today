'use client'

import React, { useState } from 'react'

const field: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  border: '1px solid var(--theme-elevation-250)',
  borderRadius: 4,
  background: 'var(--theme-input-bg, var(--theme-elevation-0))',
  color: 'var(--theme-text)',
  font: 'inherit',
}

const primary: React.CSSProperties = {
  padding: '10px 16px',
  border: 0,
  borderRadius: 4,
  background: 'var(--theme-elevation-800)',
  color: 'var(--theme-elevation-0)',
  font: 'inherit',
  fontWeight: 600,
  cursor: 'pointer',
}

const post = async (url: string, body: unknown) => {
  const response = await fetch(url, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const result = (await response.json().catch(() => ({}))) as {
    message?: string
    redirect?: string
  }
  if (!response.ok) throw new Error(result.message ?? 'Something went wrong. Try again.')
  return result
}

/** Two steps: enter your school email, then the 6-digit code it receives. */
export function EmailCodeForm() {
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const sendCode = async (event?: React.FormEvent) => {
    event?.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const result = await post('/auth/email/start', { email })
      setNotice(result.message ?? null)
      setStep('code')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const verify = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const result = await post('/auth/email/verify', { email, code })
      window.location.assign(result.redirect ?? '/admin')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setBusy(false)
    }
  }

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {step === 'email' ? (
        <form onSubmit={sendCode} style={{ display: 'grid', gap: 10 }}>
          <label htmlFor="signin-email" style={{ fontWeight: 600 }}>
            School email
          </label>
          <input
            id="signin-email"
            type="email"
            autoComplete="email"
            required
            placeholder="123456@gapps.yrdsb.ca"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            style={field}
          />
          <button type="submit" disabled={busy} style={primary}>
            {busy ? 'Sending…' : 'Email me a sign-in code'}
          </button>
        </form>
      ) : (
        <form onSubmit={verify} style={{ display: 'grid', gap: 10 }}>
          {notice && <p style={{ margin: 0, fontSize: 14 }}>{notice}</p>}
          <label htmlFor="signin-code" style={{ fontWeight: 600 }}>
            6-digit code
          </label>
          <input
            id="signin-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9 ]*"
            maxLength={7}
            required
            autoFocus
            value={code}
            onChange={(event) => setCode(event.target.value)}
            style={{ ...field, fontSize: 22, letterSpacing: 6, textAlign: 'center' }}
          />
          <button type="submit" disabled={busy} style={primary}>
            {busy ? 'Checking…' : 'Sign in'}
          </button>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
            <button type="button" onClick={() => setStep('email')} style={linkButton}>
              Use a different email
            </button>
            <button type="button" disabled={busy} onClick={() => sendCode()} style={linkButton}>
              Send a new code
            </button>
          </div>
        </form>
      )}
      {error && (
        <p role="alert" style={{ margin: 0, color: 'var(--theme-error-500)', fontSize: 14 }}>
          {error}
        </p>
      )}
    </div>
  )
}

const linkButton: React.CSSProperties = {
  padding: 0,
  border: 0,
  background: 'none',
  color: 'var(--theme-text)',
  textDecoration: 'underline',
  cursor: 'pointer',
  font: 'inherit',
}
