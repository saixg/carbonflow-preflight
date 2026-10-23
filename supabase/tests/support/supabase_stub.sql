-- TEST-ONLY stand-in for the parts of Supabase that migrations depend on.
-- Never applied to a real project; real Supabase provides these objects.
create schema auth;
create schema extensions;

create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text
);

create function auth.uid() returns uuid
language sql stable
as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;

grant usage on schema public, auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
