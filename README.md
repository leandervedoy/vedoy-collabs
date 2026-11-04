# Vedoy Collabs — Creator Discovery MVP

Vedoy Collabs is a Next.js 14 + React + TypeScript application backed by the **existing Vedoy Supabase** project. The app lives on the `feature/professional-foundation` branch while it is reviewed.

## Implemented UI
- Email/password registration and login with Supabase Auth.
- Responsive creator directory with text, role, skill and location search.
- Creator profiles: biography, interests, skills, portfolio URLs, social links, availability and image URLs.
- Public/private profile toggle; private profile fields are not returned in discovery.
- Save and unsave creators; separate saved-creators view.
- Private contact requests with a personal note, recipient approval/decline and a 20-per-24-hour database limit.
- On acceptance, an existing Collabs match is created; conversation uses existing `collabs_messages` table.
- Messages and optional Realtime channel updates.
- Project listings, search and applications with existing Collabs tables.
- Report and block creators; block prevents contact and new messages.

The discovery screen deliberately uses **real data only**. There are no fake creators or fabricated engagement statistics.

## Database and security
Connected to the existing project `niedmgyyougvgiiuwcvw`. On Nov 4, 2026, migration `collabs_creator_discovery_contact_20261104` was applied to that project:
- New tables: `collabs_blocks`, `collabs_saved_creators`, `collabs_contact_requests`, `collabs_creator_reports`.
- RLS owner-only policies for blocks, saved profiles and reports; participant-only policies for requests.
- SQL RPC `collabs_find_creators` returns only an explicit whitelist of publicly shared fields and filters blocked profiles.
- SQL RPC `collabs_respond_to_contact` atomically accepts/declines requests and creates a match.
- Restrictive messaging policy prevents new messages across blocks.
- Authenticated-only grants on sensitive RPCs.

Never set service-role/secret keys in the frontend. Do not use user metadata to determine admin access.

## Local development
Copy `.env.example` into `.env.local`, then supply the Supabase **publishable** API key from your project. Do not commit the key file.

```bash
npm install
npm run dev
```

Open http://localhost:3000. Before rollout, run `npm run typecheck` and `npm run build`.

## Deployment status
**Not deployed.** Vercel returned HTTP 403 (no permission to create a project in Vedoy team). A Vercel preview needs an authorized connection and these two environment variables:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Only approved production tests should expose this app to the public.

## Additional release gates
- Verify a two-account flow: signup, public creator discovery, request, accept, message, block, report.
- Set up spam protection/CAPTCHA, email notifications, accessibility and load tests.
- Build moderation review screen, image uploads with storage RLS, business/organization accounts, profiles with rich education and experience fields, and payments.
- Define privacy, retention, deletion, handling of job applicants and Norwegian marketing rules.
- Connect Vedoy Growth service catalog via an authenticated backend API rather than copying customer records.
- Add monitoring, backup recovery runbooks and CI release checks.

This is a functional **implementation foundation**, not a verified production release.
