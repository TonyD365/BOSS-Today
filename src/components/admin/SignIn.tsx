import React from 'react'

const messages: Record<string, string> = {
  'not-invited':
    'That Google account is not on the staff list. Ask an exec to add your Gmail address first.',
  'wrong-domain': 'That Google account is not allowed to sign in here.',
  deactivated: 'This account has been deactivated. Ask an exec if you think this is a mistake.',
  unauthorized: 'Your account does not have access to the staff area.',
  'not-configured': 'Google sign-in has not been set up yet. Use your email and password instead.',
  'sign-in-failed': 'Google sign-in did not complete. Please try again.',
}

type Props = { searchParams?: Record<string, string | string[] | undefined> }

/** Shown under Payload's email-and-password form: the Google option and any sign-in error. */
export function SignIn({ searchParams }: Props) {
  const code = typeof searchParams?.error === 'string' ? searchParams.error : undefined
  const message = code ? (messages[code] ?? messages['sign-in-failed']) : undefined

  return (
    <div style={{ display: 'grid', gap: 16, marginTop: 8 }}>
      {message && (
        <p role="alert" style={{ margin: 0, color: 'var(--theme-error-500)', textAlign: 'center' }}>
          {message}
        </p>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, opacity: 0.6, fontSize: 13 }}>
        <span style={{ flex: 1, height: 1, background: 'var(--theme-elevation-150)' }} />
        or
        <span style={{ flex: 1, height: 1, background: 'var(--theme-elevation-150)' }} />
      </div>
      <GoogleButton />
    </div>
  )
}

export function GoogleButton() {
  return (
    <a
      href="/auth/google"
      style={{
        display: 'block',
        padding: '10px 16px',
        borderRadius: 4,
        border: '1px solid var(--theme-elevation-250)',
        color: 'var(--theme-text)',
        fontWeight: 600,
        textAlign: 'center',
        textDecoration: 'none',
      }}
    >
      Sign in with Google
    </a>
  )
}
