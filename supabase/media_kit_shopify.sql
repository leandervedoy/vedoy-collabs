-- Vedoy Collabs: Creator Media Kit + Shopify campaign integration
-- Additive migration. Existing Collabs profiles, messages, projects and Growth Shopify data stay unchanged.

create table if not exists public.collabs_media_kits (
  user_id uuid primary key references auth.users(id) on delete cascade,
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{2,49}$'),
  tagline text not null default '' check (char_length(tagline) <= 180),
  about text not null default '' check (char_length(about) <= 2400),
  niches text[] not null default '{}',
  platforms jsonb not null default '[]'::jsonb check (jsonb_typeof(platforms) = 'array'),
  packages jsonb not null default '[]'::jsonb check (jsonb_typeof(packages) = 'array'),
  highlights jsonb not null default '[]'::jsonb check (jsonb_typeof(highlights) = 'array'),
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists collabs_media_kits_published_idx
  on public.collabs_media_kits(slug) where published = true;

alter table public.collabs_media_kits enable row level security;
revoke all on public.collabs_media_kits from anon, authenticated;
grant select, insert, update on public.collabs_media_kits to authenticated;
create policy collabs_media_kits_owner_select on public.collabs_media_kits for select
  to authenticated using (user_id = (select auth.uid()));
create policy collabs_media_kits_owner_insert on public.collabs_media_kits for insert
  to authenticated with check (user_id = (select auth.uid()));
create policy collabs_media_kits_owner_update on public.collabs_media_kits for update
  to authenticated using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Never accessible through the client Data API. Tokens are encrypted on the Node server.
-- This connection does not replace Growth's existing shopify_store_connections table.
create table if not exists public.collabs_shopify_connections (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  shop_domain text not null unique
    check (shop_domain ~ '^[a-z0-9][a-z0-9-]*\.myshopify\.com$'),
  encrypted_access_token text not null,
  encrypted_refresh_token text,
  access_expires_at timestamptz,
  refresh_expires_at timestamptz,
  scopes text not null default 'read_products',
  status text not null default 'connected'
    check (status in ('connected', 'revoked', 'error')),
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists collabs_shopify_owner_idx on public.collabs_shopify_connections(owner_id);
alter table public.collabs_shopify_connections enable row level security;
revoke all on public.collabs_shopify_connections from anon,authenticated;
-- Service role only. Never grant token-column access to authenticated.

create table if not exists public.collabs_product_campaigns (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  shop_domain text not null,
  product_gid text not null check (product_gid ~ '^gid://shopify/Product/[0-9]+$'),
  product_title text not null check (char_length(product_title) between 1 and 200),
  product_handle text not null default '',
  product_image_url text,
  brief text not null default '' check (char_length(brief) <= 4000),
  deliverables text[] not null default '{}',
  budget_nok integer not null default 0 check (budget_nok between 0 and 10000000),
  status text not null default 'draft' check(status in ('draft','open','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists collabs_campaigns_open_idx
  on public.collabs_product_campaigns(created_at desc) where status='open';
create index if not exists collabs_campaigns_owner_idx
  on public.collabs_product_campaigns(owner_id,created_at desc);
alter table public.collabs_product_campaigns enable row level security;
revoke all on public.collabs_product_campaigns from anon,authenticated;
grant select on public.collabs_product_campaigns to authenticated;
create policy collabs_campaigns_read on public.collabs_product_campaigns for select
  to authenticated using (status='open' or owner_id=(select auth.uid()));
-- Only server-validated actions may create/edit campaigns. No direct client write grant.

create table if not exists public.collabs_campaign_applications (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.collabs_product_campaigns(id) on delete cascade,
  creator_id uuid not null references auth.users(id) on delete cascade,
  pitch text not null check(char_length(pitch) between 10 and 1500),
  status text not null default 'new' check(status in ('new','shortlisted','declined')),
  created_at timestamptz not null default now(),
  unique(campaign_id,creator_id)
);
create index if not exists collabs_campaign_applications_campaign_idx
  on public.collabs_campaign_applications(campaign_id,created_at desc);
alter table public.collabs_campaign_applications enable row level security;
revoke all on public.collabs_campaign_applications from anon,authenticated;
grant select,insert on public.collabs_campaign_applications to authenticated;
create policy collabs_campaign_applications_read on public.collabs_campaign_applications for select
  to authenticated using (
    creator_id=(select auth.uid()) or exists(
      select 1 from public.collabs_product_campaigns c
      where c.id=campaign_id and c.owner_id=(select auth.uid())
    )
  );
create policy collabs_campaign_applications_apply on public.collabs_campaign_applications for insert
  to authenticated with check (
    creator_id=(select auth.uid()) and status='new'
    and exists (
      select 1 from public.collabs_product_campaigns c
      where c.id=campaign_id and c.status='open' and c.owner_id<>(select auth.uid())
    )
  );
