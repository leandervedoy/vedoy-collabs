# Vedoy Collabs x ChatGPT

## What is implemented
- Collabs KI dashboard at `/ai`, linked from the desktop navigation.
- Authenticated proposal endpoint `POST /api/ai`, with four scoped tasks:
  1. Media Kit copy suggestions derived from the user's own profile.
  2. Creator matching over opt-in public Collabs profiles (excluding blocked users).
  3. Shopify product campaign briefs using verified product records from the user's connected store.
  4. Personalized outreach message drafts for public creators.
- AI returns structured JSON proposals. Nothing is sent, published, or written automatically.
- Private read-only MCP-compatible endpoint at `POST /api/mcp` with `initialize`, `tools/list`, `tools/call` and `ping`. Tools: `find_creators`, `find_creator_campaigns`, `get_public_media_kit`.

## Integration safety
- All AI tasks require a valid Supabase user JWT. Shopify product reads are scoped to that user's connected shop.
- OpenAI credentials remain server-only. `store:false` is supplied to the Responses API. Do not pass private customer details or secrets in prompts.
- AI is explicitly disabled by default with `COLLABS_AI_ENABLED=false`.
- Results are displayed as drafts with no automatic actions; creator match IDs are constrained to actual candidates.
- The MCP endpoint requires a separate long bearer secret. The bridge only returns published/opt-in information, and provides no write tools.
- **The static bearer bridge is a private integration prototype, not a production ChatGPT OAuth connector.** Before allowing third parties or public ChatGPT distribution, implement OAuth 2.1 authorization code + PKCE, protected resource metadata, per-user consent/scopes, quota controls, telemetry and hardened error handling.
- Production needs a durable per-user rate limiter and API spending cap; the present request path is intended for trusted limited testing only.

## Deployment configuration
See `.env.example`. You will need an OpenAI project API key, valid supported Responses model ID, Supabase service key, and working base app environment variables.

## Prerequisites/blockers
- The Media Kit / Shopify migrations on the parent branch were not deployed; the live Supabase schema lacks `collabs_media_kits` and campaign tables. Do not enable these modules until migrations are reviewed, applied and verified.
- Shopify OAuth callback requires valid app credentials, approved redirect URI and secure hosted URL.
- No Vercel deployment or ChatGPT app publication was completed.
- Repository end-to-end build, integration/auth tests, privacy review and UX QA are outstanding.
- Do not merge this branch into production until deployment and security reviews pass.

## First test plan
1. Verify preview build/typecheck.
2. In test Supabase, create two opted-in public Collabs creator profiles and one private profile; verify the public/private visibility boundary.
3. Call MCP with and without bearer token; verify unauthorized requests fail, and public tools cannot mutate data.
4. Test media kit and outreach suggestions with a low-value test user, checking unsupported claims are not invented.
5. With a test Shopify shop, generate a campaign brief; confirm no products/prices are modified.
6. Enable rate limits, audit logs and OAuth before any public distribution.

## Official references
- https://developers.openai.com/apps-sdk/build/mcp-server
- https://developers.openai.com/apps-sdk/build/auth
- https://platform.openai.com/docs/api-reference/responses
