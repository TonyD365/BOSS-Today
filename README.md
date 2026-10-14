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
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | From Google Cloud Console (see below); needed for the first sign-in |
| `SUPER_ADMIN_EMAILS` | Your Google address; you become the super admin |
| `ALLOWED_EMAIL_DOMAINS` | Optional. Limits Google sign-in to these domains |
| `ALLOW_READER_SIGNUP` | Optional. `true` lets any student create a reader account |
| `SITE_URL` | Optional. e.g. `https://boss-today.vercel.app` |

Every push to `main` deploys. The build runs database migrations first (`npm run ci`).

## Signing in

Staff sign in at `/admin` with their email and password, or with Google (personal Gmail works). Both are invite-only: an exec with the Staff permission adds each person under **People** with a starting password, and they can change it from their account page. Nothing is emailed from the site, so forgotten passwords are reset by an exec.

Five wrong passwords lock an account for 10 minutes. Unticking **Active** signs a person out everywhere.

The first account is the super admin's: with an empty database, sign in with Google using the address in `SUPER_ADMIN_EMAILS`. (Payload's usual "create first user" screen is disabled so nobody else can claim an empty site.)

YRDSB blocks unapproved Google apps for student accounts (`admin_policy_enforced`), so students use a password or a personal Gmail unless the site goes through the board's Digital Tools Approval Process.

### Google

1. Google Cloud Console → APIs & Services → Credentials → Create credentials → OAuth client ID → Web application.
2. Authorized redirect URIs: `https://<your-domain>/auth/google/callback` (and `http://localhost:3000/auth/google/callback` for local use).
3. Copy the client ID and secret into the environment variables.

Only people listed under **People** in the admin can sign in with Google (plus anyone in `SUPER_ADMIN_EMAILS`).

## Roles

Reader → Reporter → Editor → Exec → Super admin. Execs get any of four permissions (front page, print, staff, media) from the super admin. See [docs/plans/01-user-roles.md](docs/plans/01-user-roles.md).

Stories move through Draft → In review → Changes requested → Published → Withdrawn using the panel in each story's sidebar.

## Print editions

Open an issue, tick **Print edition**, pick a paper size and set each story's width. `/issues/<vol>-<no>/print` shows the typeset pages and `/issues/<vol>-<no>/pdf` downloads them as a PDF (rendered with headless Chromium; locally it uses your installed Chrome, or set `CHROME_PATH`).

## Images on GitHub

Uploads are converted to WebP (at most 2400px wide) and, when `GITHUB_IMAGES_REPO` and `GITHUB_IMAGES_TOKEN` are set, committed to that repository and served from GitHub Pages. Without them, Vercel Blob is used; locally, files go to `./media`.

1. Create a **public** repository for images, e.g. `boss-today-images`, with a `.nojekyll` file at the root.
2. Settings → Pages → Deploy from branch → `main`, folder `/ (root)`.
3. Create a fine-grained personal access token limited to that repository with **Contents: Read and write**.
4. Set `GITHUB_IMAGES_REPO` (`owner/repo`) and `GITHUB_IMAGES_TOKEN` on Vercel and redeploy.

Limits to keep in mind: new images take about a minute to appear while Pages rebuilds; GitHub recommends keeping a repository under 1 GB (roughly 4,000 photos after compression), so start a new repository each school year if needed; on Vercel a single upload must be under 4.5 MB when using GitHub storage.

## Changing the data model

After editing anything in `src/collections`, run `npm run migrate:create -- <name>` and commit the new files in `src/migrations`.
