# BOSS Today

The student newspaper of Bur Oak Secondary School.

- **Newsroom (admin)**: Next.js + Payload CMS on Vercel, at `/admin`
- **Public site**: static pages on Cloudflare Pages, rebuilt when an issue is published
- **Database**: PostgreSQL (Neon)
- **Images**: private GitHub repository for drafts, public one on GitHub Pages for published images (or Vercel Blob)

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
| `CLOUDFLARE_KV_NAMESPACE_ID`               | From Cloudflare (step 2.8); where the banner and Most read are kept |
| `TURNSTILE_SECRET_KEY`                     | From Cloudflare Turnstile (step 2.9); checks Contact page senders   |
| `CLOUDFLARE_ANALYTICS_SITE_TAG`            | From Cloudflare Web Analytics (step 2.10)                           |
| `CRON_SECRET`                              | Another `openssl rand -hex 32`; protects the daily job              |
| `SITE_URL`                                 | Optional. This host's address, e.g. `https://bosstoday.vercel.app`  |
| `ALLOWED_EMAIL_DOMAINS`                    | Optional. Limits Google sign-in to these domains                    |

### 2. Public site on Cloudflare Pages

1. Cloudflare dashboard → Workers & Pages → Create → Pages → connect the `BOSS-Today` repository.
2. Build settings: framework preset **None**, build command `npm run build:site`, output directory `site-dist`.
3. Environment variables: `CMS_URL` (the Vercel address), `SITE_EXPORT_TOKEN` (same value as on Vercel), `PUBLIC_SITE_URL` (this Pages address), `NODE_VERSION` = `22`.
4. Settings → Builds → turn **off** automatic production deployments, so the site only rebuilds when the newsroom asks (and code pushes don't use up builds).
5. Settings → Builds → **Deploy hooks** → add one for the `main` branch and copy its URL into Vercel's `CLOUDFLARE_DEPLOY_HOOK_URL`. Treat it like a password.
6. Set `PUBLIC_SITE_URL` on Vercel too and redeploy Vercel, so old reader links redirect to Pages.
7. Optional, to see rebuild progress in the newsroom: Cloudflare → My Profile → API Tokens → Create token → custom token with **Account → Cloudflare Pages → Read**. On Vercel set `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` (shown on the Workers & Pages overview) and `CLOUDFLARE_PAGES_PROJECT` (the project name), then redeploy.

8. **Banner and Most read** (needed before anyone publishes a banner). These aren't built into the pages; a small Pages Function (`functions/api/live.js`) serves them from Workers KV, so changing them never rebuilds the site.
   1. Workers & Pages → **KV** → Create a namespace, e.g. `boss-today-banner`. Copy its **ID**.
   2. The Pages project → Settings → **Bindings** → Add → KV namespace: variable name `BANNER`, the namespace above. Redeploy Pages once so the binding takes effect.
   3. Edit the API token from step 7 (or create one) to also have **Account → Workers KV Storage → Edit**.
   4. On Vercel set `CLOUDFLARE_KV_NAMESPACE_ID` (the ID), plus `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` if not already set, then redeploy.

9. **Contact page.** Cloudflare → Turnstile → Add widget, with the Pages address (and any custom domain) as hostnames, mode Managed. Put the **site key** in the Pages environment as `TURNSTILE_SITE_KEY` and the **secret key** on Vercel as `TURNSTILE_SECRET_KEY`. Without the site key the Contact page isn't built. Submissions go straight to the newsroom and don't rebuild the site.
10. **Readership.** The Pages project → Metrics → enable **Web Analytics**. Then open Analytics & Logs → Web Analytics → the site's metrics; the page address contains `siteTag~in=…`. Copy that value into Vercel as `CLOUDFLARE_ANALYTICS_SITE_TAG`. Add **Account → Account Analytics → Read** to the API token. Set `CRON_SECRET` on Vercel: Vercel Cron calls `/api/cron/daily` each morning (vercel.json), and the dashboard also refreshes readership hourly while editors use it.

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

Open an issue, tick **Print edition**, pick a paper size and set each story's width. In the newsroom, `/issues/<vol>-<no>/print` shows the typeset pages for proofing. The PDF readers download is made when Cloudflare builds the public site (`src/site/print.tsx`, headless Chromium via `@sparticuz/chromium`; locally your installed Chrome, or set `CHROME_PATH`), so it costs the newsroom host nothing. An unchanged issue's PDF is copied from the live site instead of being made again. If Chromium can't run, the build still succeeds and the issue links to a printable page.

## Site designer

`/admin/site-designer` (sidebar: **Site designer**) lays out the front page on a free canvas, like Canva: drag, resize, rotate, flip, group, align and distribute, snap to guides or a grid, layers, undo/redo, copy/paste, right-click menu and Canva's shortcuts. Text is edited in place, with bold/italic/underline/colour/size on parts of it, lists, shadow, outline, background and curved text. Shapes take colours or gradients; story cards, lists, Most read, Scores, This week, LIVE and the latest issue fill themselves from the site.

- **Phones** get their own canvas. Anything not placed by hand is stacked automatically, and a coloured band keeps whatever sits on it. The issue checklist warns when the desktop changed after the phone layout was last checked.
- **Saving** is automatic after each change, as a draft that goes live with the next issue; someone with the Issue permission can **Publish now** (one rebuild). One person edits at a time (a lock that lapses after two minutes; others can take over). Text that's hard to read is refused, with a suggested colour. Earlier designs are under Site Design → Versions.
- The design is data (`src/design`): the server cleans every save, and the same renderer draws the designer's canvas and the static front page. Until a design is published, the site uses the classic front page.
- The **Design** permission (formerly Front Page; holders were carried over) covers the designer, sections, the classic front page and site settings, and can be given to editors.

## Scores, calendar and live coverage

Under **Live** in the newsroom: **Scores & schedule** (reporters and up), **Calendar** (editors and up) and **Live coverage** (Issue permission only, since it skips the issue sign-off). Every save rewrites the `board` key in Workers KV, and live coverage its own `live:<slug>` key; `functions/api/live.js` serves them and the browser draws the front page boxes and `/scores/`, `/calendar/` and `/live/?s=<slug>`. Nothing is rebuilt. If KV can't be reached, the save is refused with the reason, so the website never quietly falls behind. Each change is in the audit log.

## Images on GitHub

Uploads are converted to WebP (at most 2400px wide). With `GITHUB_DRAFTS_REPO`, `GITHUB_IMAGES_REPO` and `GITHUB_IMAGES_TOKEN` set, images live in two repositories:

- **Drafts (private).** Every upload is committed here. Staff see these images through the newsroom (`/api/media/file/…`, signed in only); the public never can.
- **Public (GitHub Pages).** Before each site rebuild (an issue, a withdrawal or Rebuild site) the newsroom copies in exactly the images that published content uses (`src/storage/publicImages.ts`). If something has to come out, for example a withdrawn story's photo, the repository is rewritten as one fresh commit so the image is gone from its history too. Caches and forks made before that can't be recalled, so check photos before publishing.

Without these settings, Vercel Blob is used; locally, files go to `./media`.

1. Create a **private** repository (e.g. `BOSS-Today-media-drafts`) and a **public** one (e.g. `BOSS-Today-images`), both with a README so they have a `main` branch.
2. In the public one, Settings → Pages → Deploy from a branch → `main`, `/ (root)`. (The newsroom adds `.nojekyll` itself.)
3. Create a fine-grained token with **Contents: Read and write** on both repositories only.
4. Set `GITHUB_DRAFTS_REPO`, `GITHUB_IMAGES_REPO` (both `owner/repo`) and `GITHUB_IMAGES_TOKEN` on Vercel and redeploy.

If the images can't be copied, the site isn't rebuilt (so it never shows broken images) and the newsroom says so; Rebuild site tries again. GitHub recommends keeping a repository under 1 GB (about 2,000 published photos with their sizes). On Vercel a single upload must be under 4.5 MB.

## Changing the data model

After editing anything in `src/collections`, run `npm run migrate:create -- <name>` and commit the new files in `src/migrations`.
