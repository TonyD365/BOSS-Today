import React from 'react'

const messages: Record<string, string> = {
  'not-invited':
    'That Google account is not on the staff list. Ask an admin to add your school email first.',
  'wrong-domain': 'Please sign in with your school Google account (@gapps.yrdsb.ca or @yrdsb.ca).',
  deactivated: 'This account has been deactivated. Ask an exec if you think this is a mistake.',
  unauthorized: 'Your account does not have access to the staff area.',
  'not-configured': 'Google sign-in has not been set up yet. See the README for the steps.',
  'sign-in-failed': 'Sign-in did not complete. Please try again.',
}

type Props = { searchParams?: Record<string, string | string[] | undefined> }

export function GoogleSignIn({ searchParams }: Props) {
  const code = typeof searchParams?.error === 'string' ? searchParams.error : undefined
  const message = code ? (messages[code] ?? messages['sign-in-failed']) : undefined

  return (
    <div style={{ display: 'grid', gap: 16, textAlign: 'center' }}>
      <p style={{ margin: 0 }}>BOSS Today staff sign in with their school Google account.</p>
      {message && (
        <p role="alert" style={{ margin: 0, color: 'var(--theme-error-500)' }}>
          {message}
        </p>
      )}
      <a
        href="/auth/google"
        style={{
          display: 'block',
          padding: '12px 16px',
          borderRadius: 4,
          background: 'var(--theme-elevation-800)',
          color: 'var(--theme-elevation-0)',
          fontWeight: 600,
          textDecoration: 'none',
        }}
      >
        Sign in with Google
      </a>
    </div>
  )
}
