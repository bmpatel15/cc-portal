# Content Request Portal

Internal portal for requesting support from the Audio, Photo/Video, and Content Creation teams.
Requesters submit through a guided wizard, get a tracking link, and receive an email whenever their
request moves. Staff work the queue from an authenticated dashboard.

## Stack

- **Next.js 15** (App Router) · **React 19** · **TypeScript**
- **Supabase** — Postgres (requests, files, status history, notification queue), Storage, Auth
- **Tailwind CSS** + **shadcn/ui** (Radix primitives)
- **Zod** — one schema validates the wizard, the API, and produces the types
- **Nodemailer** (SMTP) and the **Telegram Bot API** for notifications

## Getting started

```bash
npm install
cp .env.example .env.local   # then fill in the values
npm run dev
```

### 1. Apply the database schema

Run `supabase/migrations/0001_init.sql` against your project — either with the Supabase CLI
(`supabase db push`) or by pasting it into the SQL editor. It is safe to re-run.

This creates `requests`, `request_files`, `request_status_history`, `notification_log`, and
`profiles`, enables row level security on all of them, and syncs the `cc-portal` storage bucket.

### 2. Grant yourself staff access

Sign in once at `/login` to create your `auth.users` row (a `profiles` row is created automatically
by trigger), then promote it:

```sql
update public.profiles set role = 'admin' where email = 'you@example.org';
```

### 3. Configure the notification cron

`vercel.json` schedules `/api/cron/dispatch-notifications` hourly. Vercel sends `CRON_SECRET` as a
bearer token automatically. On the Hobby plan crons run at most once per day — if you need faster
retries, raise the frequency on a paid plan.

Delivery is attempted inline at submission time, so the cron is a safety net for failures, not the
primary path.

## How it fits together

| Path | Purpose |
| --- | --- |
| `/` | The request wizard |
| `/track/[token]` | Public status page — no login, reached by the link in the confirmation email |
| `/admin` | Staff queue, filters, and status updates |
| `/login` | Magic-link sign-in for staff |
| `POST /api/requests` | Validates and stores a request, then queues notifications |
| `POST /api/uploads/sign` | Mints a signed URL so the browser uploads straight to Storage |
| `GET /api/cron/dispatch-notifications` | Retries unsent notifications |

### Key design decisions

**One schema, everywhere.** `src/lib/schemas/request.ts` defines every question as a discriminated
union on `team`. The wizard, the API route, and the TypeScript types all derive from it, so a field
that exists in the form cannot be dropped on the way to the database.

**Persistence before delivery.** `POST /api/requests` stores the request and *then* queues
notifications. A failing SMTP or Telegram call is recorded in `notification_log` and retried; it can
never destroy a submission.

**Uploads bypass the server.** Files go straight from the browser to Supabase Storage using
short-lived signed URLs, so large artwork never streams through a serverless function.

**Tracking tokens are never exposed to `anon`.** RLS denies anonymous access to every table. The
tracking page looks the request up server-side with the service role, so no policy makes
`tracking_token` directly queryable.

## Scripts

```bash
npm run dev     # development server
npm run build   # production build
npm run lint    # eslint
npm start       # serve the production build
```
