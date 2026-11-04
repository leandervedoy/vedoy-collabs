# Vedoy Collabs — Creator discovery MVP

A mobile-first Next.js app for discovering creators, reviewing portfolios, requesting contact, messaging only after approval, and posting collaboration projects.

## Implemented UI
- Magic-link email sign-in with Supabase Auth.
- Creator search: text, role, skill, location and availability; 24 results per page.
- Public profiles, verified status, portfolio and external social links.
- Private profile opt-out, editable creator bio, skills, roles and portfolio.
- Save creator, follow creator, report and block.
- Contact request (accept/decline); approved requests become existing Collabs matches.
- Private messages using existing Collabs messages and match RLS.
- Projects: post and apply to collaborate.
- Mobile navigation and responsive desktop layout.

## Data model
Uses the **existing Vedoy Supabase** project and its collabs_profiles, collabs_find_creators, collabs_contact_requests, collabs_respond_to_contact, collabs_saved_creators, collabs_blocks, collabs_creator_reports, collabs_projects, collabs_applications, collabs_matches and collabs_messages. The only additive migration committed here is collabs_creator_follows. Never re-apply full schema from an older prototype.

## Environment
Copy .env.example to .env.local; set the Supabase URL and **publishable** key. Never commit secret/service-role keys. Configure email magic-link redirect domains in Supabase Auth before testing on preview/production URLs.

## Run
- Node.js 22+
- npm install
- npm run typecheck
- npm run build
- npm run dev

## Release checklist / known limitations
- GitHub CI introduced but end-to-end build not yet confirmed.
- Magic-link login, RLS requests, matching, and chat must be tested with two real test accounts.
- Messages currently refresh when a thread is opened; realtime subscriptions/push notifications not yet implemented.
- Creator metrics from Instagram, TikTok, YouTube, etc. are **not** integrated or verified.
- Reports are stored for moderation; no operator dashboard or case management yet.
- Paid campaigns, brand verification, pricing packages, invoicing and creator contracts are not live.
- Deploy behind testing until accessibility, browser QA, abuse controls and privacy review pass.

## Suggested product roadmap
Creator media kits, verified social metrics through authorized APIs, branded briefs, outreach pipeline, collaboration contracts, deliverable approvals, notifications, saved searches, team workspaces and Vedoy Growth connectivity.

Branch: feature/creator-mvp. This is a working implementation draft, **not a production release**.
