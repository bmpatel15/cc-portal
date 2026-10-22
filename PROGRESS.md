# Progress

Working memory for this project. Read this first instead of re-reading the whole codebase, and
update the **Log** and **Open items** at the end of every change. `README.md` covers setup and the
design decisions in more depth.

_Last updated: 2026-10-21_

## What this is

Content Request Portal: an internal app where people request support from three teams (**Audio**,
**Photo/Video**, **Content Creation**). Requesters fill a guided wizard, get a tracking link, and
are emailed on every status change. Staff work the queue at `/admin`.

Stack: Next.js 15 (App Router), React 19, TypeScript, Supabase (Postgres, Storage, Auth), Tailwind
with shadcn/ui, Zod, Nodemailer (SMTP), Telegram Bot API. Hosted on Vercel (with a daily cron).
There's no test suite. Verify with `npm run lint` and `npm run build`.

## Where things live

| Concern | File(s) |
| --- | --- |
| **Every form question, limits, enums** (single source of truth) | `src/lib/schemas/request.ts` |
| Human-readable labels, detail formatting | `src/lib/schemas/labels.ts` |
| Wizard UI, one file per step | `src/components/request-form/` (`steps/*.tsx`, `request-wizard.tsx`, `form-model.ts`, `steps/choices.ts`) |
| Submit endpoint | `src/app/api/requests/route.ts` → `createRequest` in `src/lib/requests/service.ts` |
| Request reads/writes, status changes, assignment | `src/lib/requests/service.ts` |
| Who may do what (authority, not RLS) | `src/lib/requests/permissions.ts` |
| Admin board and detail dialog, server actions | `src/app/admin/` (`requests-board.tsx`, `request-detail-dialog.tsx`, `actions.ts`) |
| Team/user management: invite, role, revoke, remove (admin only) | `src/app/admin/users/`, `src/lib/profiles/service.ts` |
| Analytics dashboard, CSV/PDF export | `src/app/admin/analytics/`, `src/lib/analytics/`, `src/app/api/admin/analytics/export/route.ts` |
| Public tracking page | `src/app/track/[token]/page.tsx` |
| File uploads (signed URLs, rate-limited) and file access | `src/app/api/uploads/sign/route.ts`, `src/lib/uploads/signature.ts`, `src/app/api/files/[id]/route.ts`, `src/lib/files.ts` |
| Notifications: queue, claim, send, retry | `src/lib/notifications/dispatch.ts` (MAX_ATTEMPTS = 5) |
| Email transport, staff recipient | `src/lib/notifications/email.ts` |
| Message bodies | `src/lib/notifications/templates.ts`, `telegram.ts` |
| Retry cron (daily 06:00 UTC) | `src/app/api/cron/dispatch-notifications/route.ts`, `vercel.json` |
| Env var validation | `src/lib/env.ts` (template: `.env.example`) |
| Auth: magic link, password, middleware | `src/app/login/`, `src/app/auth/`, `src/app/account/password/`, `src/middleware.ts`, `src/lib/auth/` |
| Database schema (apply in order) | `supabase/migrations/0001`–`0008` |

## How it works (key rules)

- **Adding or changing a question:** edit `request.ts` (schema plus any `MAX_*` constant or enum),
  then the matching step in `steps/`, then `labels.ts` if it needs a display label. The API and the
  emails pick it up automatically through `formatDetails`.
- **Notifications:** each submission queues 3 rows in `notification_log`: a Telegram message to
  staff, an email to staff (`EMAIL_TO`), and a confirmation to the submitter. Delivery runs inline;
  the cron only retries failures. Rows are claimed before sending so nothing goes out twice.
  `staff_*` recipients are re-read from env **at send time**, so changing `EMAIL_TO` also reroutes
  queued retries.
- **Permissions:** the dashboard uses the service-role client, so RLS does not apply to it. Every
  mutation must call `permissions.ts`. Staff claim unassigned work and move it forward only
  (`pending → in_progress → review → complete`). Admins can reassign, reopen, and cancel.
- **Team:** accounts exist only by admin invite (no self sign-up). Admins can change role, revoke
  (suspend) or remove (delete) anyone but themselves. Removing deletes the auth user; requests they
  held go back to unassigned and their history stays with no name attached.
- **Tracking tokens** are never queryable by `anon`. The track page looks them up server-side.
- **Current limits** (from `request.ts`): 10 files, 100 MB each (JPG/PNG/PDF/Word); up to 5
  photographers and 3 videographers; up to 10 handheld, 4 headset, and 10 wired mics. Event dates
  can't be in the past.

## Releases

Semantic versions, kept in step across `package.json`, a git tag, and a GitHub Release. Bump
**patch** for fixes, **minor** for new features, **major** for breaking changes. From a clean,
up-to-date `main`:

```sh
npm version minor -m "Release %s"   # bumps package.json + lockfile, commits, tags vX.Y.Z
git push --follow-tags
```

Pushing the tag runs `.github/workflows/release.yml`. It checks that the tag matches
`package.json` and publishes a Release whose notes list the PRs merged since the last tag. Vercel
deploys from `main` as usual, so releases are labels, not deploy triggers.

If a tag is pushed but no Release appears (check `gh run list --workflow release.yml`), push the
tag again: `git push origin :refs/tags/vX.Y.Z && git push origin vX.Y.Z`. This happened once with
v0.3.0, whose tag was pushed together with the commit that first added the workflow.

## Configuration

Env vars live in **Vercel → Project → Settings → Environment Variables** (and `.env.local` for local
dev, which is not in the repo). `.env.example` only documents them.

- **Email goes out two ways, both through Gmail SMTP as `tpa.mmcc@gmail.com`:**
  - App emails (request notifications, status updates): Vercel `EMAIL_USER`/`EMAIL_PASS`.
  - Invites and magic links: **Supabase → Authentication → SMTP Settings** (Username and Sender
    `tpa.mmcc@gmail.com`, host `smtp.gmail.com`, port 465).
  - Both use the same Gmail App Password. An App Password only works with the account that made
    it. If it changes, update **both** places. A wrong one shows as Gmail `535 BadCredentials`
    (in `notification_log.last_error` for app emails, in Supabase auth logs for invites; the UI
    says "Error sending invite email").
- `EMAIL_TO` is where new-request notifications go. Live value: `tpa.mmcc@gmail.com`.
- Supabase project ref: `nbalilmcrgfgvfwepbhk` (see `.mcp.json`). The Supabase MCP is enabled
  locally in `.claude/settings.local.json`, so Claude can query tables and auth logs directly.
- **Team (2026-10-21):** two active admins, `bpatel501@gmail.com` and `anuvrutti3035@gmail.com`.

## Log

Newest first. PRs #1–#10 are merged to `main`.

- **v0.3.0 (2026-10-21):** First GitHub Release, covering PRs #1–#10. Added the release workflow
  and tagged `v0.2.0` at fa3e1db (analytics layer) as the starting point. Published at
  https://github.com/bmpatel15/cc-portal/releases/tag/v0.3.0.

- **2026-10-21:** Email fully working again. Request emails were fixed first, with a new App
  Password in Vercel `EMAIL_PASS` (sending from 11:56 UTC). Invites still failed with `535` because
  Supabase's SMTP Username was not `tpa.mmcc@gmail.com`, the account that owns the App Password.
  After fixing that, invites have sent since 23:40 UTC.
- **PR #10 (2026-10-21):** Admins can remove team members (trash icon on the Team page, with a
  confirm dialog). `removeProfile` deletes the auth user; FKs null out assignment and history.
  Same rule as role changes: admin-only, never yourself (`canRemoveProfile`). Verified live.
- **2026-10-21:** Removed `jigbpatel2001@gmail.com` (asked to remove "Jigisha Patel"), first via
  SQL. It was later re-invited and removed again from the Team page. Its one assigned request is
  unassigned.
- **2026-10-18:** Test submission: Telegram sent; both emails (staff to `tpa.mmcc@gmail.com`,
  submitter confirmation) failed with Gmail `535-5.7.8 BadCredentials`. The SMTP login
  (`EMAIL_USER`/`EMAIL_PASS`) has been rejected since at least 2026-10-11; the last successful email
  was 2026-09-09. Recipient routing is correct. Diagnosed via the Supabase MCP (enabled in
  `.claude/settings.local.json`) by querying `notification_log`.
- **2026-10-18:** `EMAIL_TO=tpa.mmcc@gmail.com` set in Vercel and redeployed (by the user).
- **2026-10-18:** Created this file. Set the staff recipient to `tpa.mmcc@gmail.com` in
  `.env.example` (commit c929573).
- **PR #9:** Reject past event dates; cap mic requests at what the team has in stock.
- **PR #8:** Photo/video caps on staff numbers; "Other" free text for purpose and video type.
- **PR #7:** Event date only (no time); audio can request wired and wireless mics together.
- **PR #6:** Normalise case and spacing variants of department names (migration 0008).
- **PR #5:** File route's sign-in redirect is no longer publicly cacheable.
- **PR #4:** Review fixes: verified upload signatures, wizard fallback with no team, board totals,
  PostgREST search quoting, analytics age buckets and CSV numbers, stale branch answers.
- **PR #3:** Department dropdown.
- **PR #2:** Split event date and time (time later removed in #7).
- **PR #1:** Private attachments, notification claiming (no duplicates), upload rate limit,
  partial-failure uploads.

## Open items

- [x] Set `EMAIL_TO=tpa.mmcc@gmail.com` in Vercel and redeploy. Done 2026-10-18.
- [x] New Gmail App Password set as `EMAIL_PASS` in Vercel. App emails work (2026-10-21).
- [x] Supabase Auth SMTP: Username/Sender `tpa.mmcc@gmail.com` + same App Password. Fixed
      2026-10-21.
- [x] Confirmed submissions arrive at `tpa.mmcc@gmail.com` (2026-10-21). To check delivery:
      `select channel, template, recipient, status, last_error from notification_log order by created_at desc limit 6;`
- [x] Version releases set up (2026-10-21). See **Releases**.
