-- Public Media Kit access exposes only explicitly published creator information.
-- Deliberate SECURITY DEFINER: existing profile RLS permits only self-read.
-- The function is restricted to a known minimal projection and publication checks.
create or replace function public.collabs_public_media_kit(p_slug text)
returns jsonb
language sql stable security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'slug', k.slug,
    'tagline', k.tagline,
    'about', k.about,
    'niches', k.niches,
    'platforms', k.platforms,
    'packages', k.packages,
    'highlights', k.highlights,
    'display_name', p.display_name,
    'headline', p.headline,
    'location', p.location,
    'avatar_url', p.avatar_url,
    'banner_url', p.banner_url,
    'skills', p.skills,
    'roles', p.roles,
    'portfolio', p.portfolio,
    'social_links', p.social_links,
    'verified_identity', exists (
      select 1 from public.collabs_verifications v where v.user_id = k.user_id
    )
  )
  from public.collabs_media_kits k
  join public.collabs_profiles p on p.user_id = k.user_id
  where k.slug = p_slug
    and k.published = true
    and p.is_public = true
    and length(p_slug) between 3 and 50
  limit 1;
$$;
revoke all on function public.collabs_public_media_kit(text) from public;
grant execute on function public.collabs_public_media_kit(text) to anon, authenticated;