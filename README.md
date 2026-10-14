# BOSS Today

The student newspaper of Bur Oak Secondary School.

- **Newsroom (admin)**: Next.js + Payload CMS on Vercel, at `/admin`
- **Public site**: static pages on Cloudflare Pages, rebuilt when an issue is published
- **Database**: PostgreSQL (Neon)
- **Images**: GitHub Pages (or Vercel Blob)

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

## How publishing works

Stories move Draft → In review → Waiting for the next issue. Nothing reaches the public site until someone with the **Issue** permission opens an issue and chooses **Review & publish**: they must open and tick every waiting story (each tick is recorded with their name, the story version and the time), may send stories back instead, and sign the publisher's declaration. Publishing then puts every waiting story, plus any section, front page and site-settings drafts, live at once and asks Cloudflare Pages to rebuild the site.

An **emergency withdrawal** (Issue permission, reason required) takes a story down immediately and rebuilds the site.

Rebuilds are counted in **Site rebuilds**: publishing stops at 400 a month and withdrawals may use up to 490, below Cloudflare's free limit of 500 builds. Sign-offs live in **Issue sign-offs** and cannot be edited or deleted.

## Deploy

### 1. Newsroom on Vercel

1. Import this repository at vercel.com/new.
2. In the project's **Storage** tab, add **Neon** (sets `DATABASE_URL`) and, unless you use GitHub for images, **Blob** (sets `BLOB_READ_WRITE_TOKEN`).
3. Add the environment variables below, then redeploy. The build runs database migrations first (`npm run ci`).

| Variable                                   | Value                                                               |
| ------------------------------------------ | ------------------------------------------------------------------- |
| `PAYLOAD_SECRET`                           | Output of `openssl rand -hex 32`                                    |
| `SUPER_ADMIN_EMAILS`                       | Your Google address; you become the super admin                     |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | From Google Cloud Console (see below); needed for the first sign-in |
| `SITE_EXPORT_TOKEN`                        | Another `openssl rand -hex 32`; also set on Cloudflare              |
| `PUBLIC_SITE_URL`                          | The Cloudflare Pages address, once it exists                        |
| `CLOUDFLARE_DEPLOY_HOOK_URL`               | From Cloudflare (step 2)                                            |
| `SITE_URL`                                 | Optional. This host's address, e.g. `https://bosstoday.vercel.app`  |
| `ALLOWED_EMAIL_DOMAINS`                    | Optional. Limits Google sign-in to these domains                    |

### 2. Public site on Cloudflare Pages

1. Cloudflare dashboard → Workers & Pages → Create → Pages → connect the `BOSS-Today` repository.
2. Build settings: framework preset **None**, build command `npm run build:site`, output directory `site-dist`.
3. Environment variables: `CMS_URL` (the Vercel address), `SITE_EXPORT_TOKEN` (same value as on Vercel), `PUBLIC_SITE_URL` (this Pages address), `NODE_VERSION` = `22`.
4. Settings → Builds → turn **off** automatic production deployments, so the site only rebuilds when the newsroom asks (and code pushes don't use up builds).
5. Settings → Builds → **Deploy hooks** → add one for the `main` branch and copy its URL into Vercel's `CLOUDFLARE_DEPLOY_HOOK_URL`. Treat it like a password.
6. Set `PUBLIC_SITE_URL` on Vercel too and redeploy Vercel, so old reader links redirect to Pages.

To try the static build locally: `CMS_URL=http://localhost:3000 SITE_EXPORT_TOKEN=… npm run build:site`, then serve `site-dist`.

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
