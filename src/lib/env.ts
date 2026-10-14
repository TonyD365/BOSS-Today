/** Reads a comma-separated environment variable as a lower-case list. */
export const envList = (value: string | undefined): string[] =>
  (value ?? '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)

/** Super admins are fixed in deployment config so nobody can lock everyone out. */
export const superAdminEmails = () =>
  envList(process.env.SUPER_ADMIN_EMAILS ?? process.env.ADMIN_EMAILS)
