import React from 'react'

import { EmailCodeForm } from './EmailCodeForm'

const messages: Record<string, string> = {
  'not-invited':
    'That account is not on the staff list. Ask an exec to add your school email first.',
  'wrong-domain': 'Please use your school account (@gapps.yrdsb.ca or @yrdsb.ca).',
  deactivated: 'This account has been deactivated. Ask an exec if you think this is a mistake.',
  unauthorized: 'Your account does not have access to the staff area.',
  'not-configured': 'Google sign-in has not been set up yet. Use the email code instead.',
  'sign-in-failed': 'Sign-in did not complete. Please try again.',
}

type Props = { searchParams?: Record<string, string | string[] | undefined> }

/** Staff sign in with a one-time code sent to their school email, or with Google. */
export function SignIn({ searchParams }: Props) {
  const code = typeof searchParams?.error === 'string' ? searchParams.error : undefined
  const message = code ? (messages[code] ?? messages['sign-in-failed']) : undefined

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      {message && (
        <p role="alert" style={{ margin: 0, color: 'var(--theme-error-500)', textAlign: 'center' }}>
          {message}
        </p>
      )}
      <EmailCodeForm />
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, opacity: 0.6, fontSize: 13 }}>
        <span style={{ flex: 1, height: 1, background: 'var(--theme-elevation-150)' }} />
        or
        <span style={{ flex: 1, height: 1, background: 'var(--theme-elevation-150)' }} />
      </div>
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
    </div>
  )
}
