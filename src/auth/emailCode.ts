import { createHmac, randomInt, timingSafeEqual } from 'crypto'

export const CODE_MINUTES = 10
export const MAX_ATTEMPTS = 5
export const RESEND_SECONDS = 60

export const newCode = () => String(randomInt(0, 1_000_000)).padStart(6, '0')

/** Codes are stored only as a keyed hash, tied to the address they were sent to. */
export const hashCode = (secret: string, email: string, code: string) =>
  createHmac('sha256', secret).update(`${email}:${code}`).digest('hex')

export const sameHash = (a: string, b: string) =>
  a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b))

/** Rejects requests that another site sent on the visitor's behalf. */
export const isSameOrigin = (request: Request) => {
  const origin = request.headers.get('origin')
  if (!origin) return false
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host')
  try {
    return new URL(origin).host === host
  } catch {
    return false
  }
}

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
