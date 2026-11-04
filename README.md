# Vedoy Collabs

Professional collaboration, jobs and creator marketplace.

## Product areas
- Discover: posts, projects, creators and job opportunities, with search and saved filters.
- Profile: portfolio, education, skills, work experience, verified links, visibility controls.
- Work: listings, applications, status tracking, team invitations and project workspaces.
- Messaging: conversations, abuse reporting, blocking and notification preferences.
- Business: organization accounts, hiring roles, candidate management and Growth Sales assignments.
- Trust: verification status, moderation queue, account recovery, privacy export and deletion.
- Monetization: optional subscription, time-limited boosts and transparent receipts.

## Architecture
Next.js App Router, TypeScript, Supabase Auth/Postgres/Storage with strict RLS, Stripe server-side checkout and webhooks, responsive mobile-first interface.

## Launch priorities
P0: authentication, profiles, org boundaries, listing/application workflow, private messaging, report/block, accessible UI, security tests.
P1: discovery ranking, notifications, portfolio, saved searches, Growth integration.
P2: identity verification, paid boosts, subscriptions, analytics, fraud controls.

## Release requirements
No direct client writes to financial or verification status; verify webhooks; rate-limit sensitive endpoints; store audit events; paginate feeds; test tenant isolation and IDOR; monitor errors and latency; add backups and retention policies; verify consent and lawful basis for recruiting data.

## Existing integration strategy
Growth remains source of truth for its existing booking, team and business data. Collabs publishes opportunities and exchanges scoped identifiers through authenticated server APIs. Do not duplicate service catalog or prices. Sellers can access Sales assignments only after training and admin approval.

Status: specification committed, implementation not yet completed.
