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
| Team/user management (admin only) | `src/app/admin/users/` |
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
- **Tracking tokens** are never queryable by `anon`. The track page looks them up server-side.
- **Current limits** (from `request.ts`): 10 files, 100 MB each (JPG/PNG/PDF/Word); up to 5
  photographers and 3 videographers; up to 10 handheld, 4 headset, and 10 wired mics. Event dates
  can't be in the past.

## Configuration

Env vars live in **Vercel → Project → Settings → Environment Variables** (and `.env.local` for local
dev, which is not in the repo). `.env.example` only documents them.

- **Supabase Auth also sends mail through Gmail SMTP** (Dashboard → Authentication → SMTP
  Settings), using the same Gmail account. Invites and magic links fail when that password is
  stale, with "Error sending invite email" in the UI.
- `EMAIL_TO` is where new-request notifications go. Live value: `tpa.mmcc@gmail.com` (set in Vercel
  2026-10-18). `EMAIL_USER`/`EMAIL_PASS` belong to the *sending* account and are separate.
- Supabase project ref: `nbalilmcrgfgvfwepbhk` (see `.mcp.json`; the MCP server is disabled
  locally in `.claude/settings.local.json`).

## Log

Newest first. PRs #1–#9 are merged to `main`.

- **2026-10-21:** Admins can remove team members (trash icon on the Team page, with a confirm
  dialog). `removeProfile` deletes the auth user; FKs null out assignment and history. Same rule as
  role changes: admin-only, never yourself (`canRemoveProfile`).
- **2026-10-21:** Deleted the pending staff account `jigbpatel2001@gmail.com` (asked to remove
  "Jigisha Patel") via SQL on `auth.users`. Its one assigned request is now unassigned.
- **2026-10-21:** An admin's invite to `tpa.mmcc@gmail.com` failed with "Error sending invite
  email". Auth logs show the same Gmail `535 BadCredentials`: Supabase Auth's custom SMTP uses the
  stale password too. No partial account was left behind.

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
- [ ] **Fix SMTP login:** create a new Gmail App Password for the `EMAIL_USER` account, set it as
      `EMAIL_PASS` in Vercel, redeploy, **and** paste it into Supabase → Authentication → SMTP
      Settings. Until then, no email is sent and invites fail (Telegram still works).
- [ ] Then re-send the invite to `tpa.mmcc@gmail.com`.
- [ ] Then confirm a submission arrives at `tpa.mmcc@gmail.com`. Check with
      `select channel, template, recipient, status, last_error from notification_log order by created_at desc limit 6;`
- [ ] Maybe later: version releases (git tags and GitHub Releases, with the `package.json`
      version kept in step; currently `0.2.0`).
