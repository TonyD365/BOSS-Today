# BOSS Today

The student newspaper of Bur Oak Secondary School.

- **Site and admin**: Next.js + Payload CMS (admin at `/admin`)
- **Database**: PostgreSQL (Neon in production)
- **Sign-in**: Google, invite-only for staff
- **Hosting**: Vercel

Design plans awaiting approval are in [docs/plans](docs/plans).

## Run locally

```bash
npm install
cp .env.example .env        # then set PAYLOAD_SECRET (openssl rand -hex 32)
npm run db:local            # local Postgres on port 5433 — keep it running
npm run payload migrate     # in a second terminal
npm run dev                 # → http://localhost:3000
```

`npm run seed` creates the default sections. `SEED_DEMO=1 npm run seed` also adds placeholder stories for checking the layout.

## Deploy to Vercel

1. Import this repository at vercel.com/new.
2. In the project's **Storage** tab, add **Neon** (sets `DATABASE_URL`) and **Blob** (sets `BLOB_READ_WRITE_TOKEN`).
3. Add the environment variables below, then redeploy.

| Variable | Value |
|---|---|
| `PAYLOAD_SECRET` | Output of `openssl rand -hex 32` |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | From Google Cloud Console (see below) |
| `SUPER_ADMIN_EMAILS` | Your Google address; you become the super admin |
| `ALLOWED_EMAIL_DOMAINS` | Optional. Defaults to `gapps.yrdsb.ca,yrdsb.ca` |
| `ALLOW_READER_SIGNUP` | Optional. `true` lets any student create a reader account |
| `SITE_URL` | Optional. e.g. `https://boss-today.vercel.app` |

Every push to `main` deploys. The build runs database migrations first (`npm run ci`).

## Google sign-in

1. Google Cloud Console → APIs & Services → Credentials → Create credentials → OAuth client ID → Web application.
2. Authorized redirect URIs: `https://<your-domain>/auth/google/callback` (and `http://localhost:3000/auth/google/callback` for local use).
3. Copy the client ID and secret into the environment variables.

Only people listed under **People** in the admin can sign in (plus anyone in `SUPER_ADMIN_EMAILS`). Accounts must be on the school domains unless they are super admins.

## Roles

Reader → Reporter → Editor → Exec → Super admin. Execs get any of four permissions (front page, print, staff, media) from the super admin. See [docs/plans/01-user-roles.md](docs/plans/01-user-roles.md).

Stories move through Draft → In review → Changes requested → Published → Withdrawn using the panel in each story's sidebar.

## Changing the data model

After editing anything in `src/collections`, run `npm run migrate:create -- <name>` and commit the new files in `src/migrations`.
