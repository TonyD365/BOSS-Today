import Link from 'next/link'
import React from 'react'

import { Logo } from './Brand'
import { GoogleButton } from './SignIn'

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'grid', gap: 20, maxWidth: 420, margin: '0 auto', textAlign: 'center' }}>
      <Logo />
      <h2 style={{ margin: 0 }}>{title}</h2>
      {children}
    </div>
  )
}

/** Replaces "forgot password": nothing is emailed from this site. */
export function PasswordHelp() {
  return (
    <Panel title="Forgot your password?">
      <p style={{ margin: 0 }}>
        Ask an exec with the Staff permission to set a new password for you in{' '}
        <strong>People</strong>. Once you are signed in, you can change it from your account page.
      </p>
      <p style={{ margin: 0 }}>
        If your email is a Google account, you can also sign in with Google.
      </p>
      <GoogleButton />
      <Link href="/admin/login">Back to sign in</Link>
    </Panel>
  )
}

/** Replaces Payload's "create first user", which would let anyone claim an empty site. */
export function FirstSignIn() {
  return (
    <Panel title="Set up BOSS Today">
      <p style={{ margin: 0 }}>
        No one has signed in yet. The super admin (the address in <code>SUPER_ADMIN_EMAILS</code>)
        signs in with Google first, then adds everyone else under <strong>People</strong>.
      </p>
      <GoogleButton />
    </Panel>
  )
}
