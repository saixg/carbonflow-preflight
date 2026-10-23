-- Private documents bucket. Object path layout:
--   <org_id>/staging/<random>     user uploads land here (signed URL or member session)
--   <org_id>/sha256/<hash>        final content-addressed object, written by the worker only
-- Users can read their org's objects and create staging objects. They cannot update or delete anything;
-- the worker (service role) hashes, copies to the final path without overwriting, and clears staging.

create function private.org_from_path(p_name text)
returns uuid
language sql immutable set search_path = ''
as $$
  select case
    when split_part(p_name, '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then split_part(p_name, '/', 1)::uuid
  end
$$;
revoke all on function private.org_from_path(text) from public;
grant execute on function private.org_from_path(text) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documents', 'documents', false, 52428800,
  array['application/pdf',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/csv']
)
on conflict (id) do nothing;

create policy documents_objects_read on storage.objects for select to authenticated
  using (bucket_id = 'documents' and private.is_member(private.org_from_path(name)));

create policy documents_objects_stage on storage.objects for insert to authenticated
  with check (
    bucket_id = 'documents'
    and split_part(name, '/', 2) = 'staging'
    and private.has_role(private.org_from_path(name), array['owner', 'admin', 'member']::public.org_role[])
  );
