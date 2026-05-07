-- =============================================
-- DASH-CLIENTS SUPABASE SCHEMA
-- Run this in your Supabase SQL Editor
-- =============================================

-- Profiles (extends auth.users)
create table if not exists public.profiles (
  id          uuid references auth.users on delete cascade primary key,
  email       text not null,
  full_name   text,
  role        text not null default 'client' check (role in ('admin', 'client')),
  avatar_url  text,
  stripe_account_id text,
  stripe_charges_enabled boolean not null default false,
  stripe_details_submitted boolean not null default false,
  created_at  timestamptz default now() not null
);

alter table public.profiles enable row level security;
alter table public.profiles add column if not exists stripe_account_id text;
alter table public.profiles add column if not exists stripe_charges_enabled boolean not null default false;
alter table public.profiles add column if not exists stripe_details_submitted boolean not null default false;

-- Clients
create table if not exists public.clients (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  email            text not null,
  company          text,
  profile_id       uuid references public.profiles(id) on delete set null,
  admin_id         uuid references public.profiles(id) on delete cascade not null,
  invite_token     text unique default encode(gen_random_bytes(32), 'hex'),
  invite_accepted  boolean default false not null,
  stripe_customer_id text,
  stripe_connected_at timestamptz,
  created_at       timestamptz default now() not null
);

alter table public.clients enable row level security;
alter table public.clients add column if not exists   stripe_customer_id text,
alter table public.clients add column if not exists   stripe_connected_at timestamptz,

-- Invite codes
create table if not exists public.invite_codes (
  token            text primary key,
  client_id        uuid not null unique references public.clients(id) on delete cascade,
  admin_id         uuid references public.profiles(id) on delete cascade,
  name             text not null,
  email            text not null,
  company          text,
  invite_accepted  boolean default false not null,
  created_at       timestamptz default now() not null
);

alter table public.invite_codes enable row level security;

alter table public.invite_codes
  add column if not exists admin_id uuid references public.profiles(id) on delete cascade;

update public.invite_codes i
set admin_id = c.admin_id
from public.clients c
where i.client_id = c.id
  and i.admin_id is null;

create policy "invite_codes_read" on public.invite_codes
  for select using (true);

-- Notes
create table if not exists public.note_groups (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid references public.clients(id) on delete cascade not null,
  name        text not null,
  position_x  float default 80 not null,
  position_y  float default 80 not null,
  width       float default 520 not null,
  height      float default 340 not null,
  created_at  timestamptz default now() not null
);

alter table public.note_groups enable row level security;

create table if not exists public.notes (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid references public.clients(id) on delete cascade not null,
  author_id   uuid references public.profiles(id) on delete cascade not null,
  content     text default '' not null,
  color       text default 'yellow' check (color in ('yellow','pink','blue','green','purple','orange')),
  note_type   text default 'note' not null check (note_type in ('note','invoice')),
  title       text,
  amount_cents integer,
  currency    text,
  due_date    date,
  payment_status text default 'draft' not null check (payment_status in ('draft','sent','paid','void')),
  stripe_invoice_id text,
  stripe_invoice_url text,
  locked_by   uuid references public.profiles(id) on delete set null,
  position_x  float default 100 not null,
  position_y  float default 100 not null,
  is_complete boolean default false not null,
  group_id    uuid,
  rotation    float default 0 not null,
  z_index     integer default 0 not null,
  created_at  timestamptz default now() not null,
  updated_at  timestamptz default now() not null
);

alter table public.clients add column if not exists stripe_customer_id text;
alter table public.clients add column if not exists stripe_connected_at timestamptz;

alter table public.notes add column if not exists note_type text default 'note';
alter table public.notes add column if not exists title text;
alter table public.notes add column if not exists amount_cents integer;
alter table public.notes add column if not exists currency text;
alter table public.notes add column if not exists due_date date;
alter table public.notes add column if not exists payment_status text default 'draft';
alter table public.notes add column if not exists stripe_invoice_id text;
alter table public.notes add column if not exists stripe_invoice_url text;
alter table public.notes add column if not exists locked_by uuid references public.profiles(id) on delete set null;

update public.notes set note_type = 'note' where note_type is null;
update public.notes set payment_status = 'draft' where payment_status is null;

alter table public.notes
  alter column note_type set default 'note',
  alter column note_type set not null,
  alter column payment_status set default 'draft',
  alter column payment_status set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'notes_note_type_check'
      and conrelid = 'public.notes'::regclass
  ) then
    alter table public.notes
      add constraint notes_note_type_check check (note_type in ('note','invoice'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'notes_payment_status_check'
      and conrelid = 'public.notes'::regclass
  ) then
    alter table public.notes
      add constraint notes_payment_status_check check (payment_status in ('draft','sent','paid','void'));
  end if;
end
$$;

alter table public.notes enable row level security;

-- Note attachments
create table if not exists public.note_attachments (
  id            uuid primary key default gen_random_uuid(),
  note_id       uuid references public.notes(id) on delete cascade not null,
  storage_path  text not null,
  file_name     text not null,
  file_type     text not null check (file_type in ('image','video')),
  file_size     bigint,
  created_at    timestamptz default now() not null
);

alter table public.note_attachments enable row level security;

-- =============================================
-- TRIGGERS
-- =============================================

-- Public invite lookup: resolves a single pending or accepted invite by token
create or replace function public.get_client_by_invite_token(p_token text)
returns table (
  id uuid,
  name text,
  email text,
  company text,
  invite_accepted boolean
)
language sql
security definer
set search_path = public
as $$
  select c.id, c.name, c.email, c.company, c.invite_accepted
  from public.clients c
  where c.invite_token = p_token
  limit 1;
$$;

grant execute on function public.get_client_by_invite_token(text) to anon, authenticated;

create or replace function public.consume_invite_code(p_token text)
returns table (
  client_id uuid,
  profile_id uuid,
  admin_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  invite_row public.invite_codes%rowtype;
  resolved_admin_id uuid;
begin
  select *
  into invite_row
  from public.invite_codes
  where token = p_token
  limit 1;

  if not found then
    return;
  end if;

  resolved_admin_id := coalesce(
    invite_row.admin_id,
    (select c.admin_id from public.clients c where c.id = invite_row.client_id)
  );

  update public.clients
  set profile_id = auth.uid(),
      invite_accepted = true,
      admin_id = coalesce(admin_id, resolved_admin_id),
      invite_token = invite_row.token
  where id = invite_row.client_id;

  update public.invite_codes
  set invite_accepted = true,
      admin_id = coalesce(admin_id, resolved_admin_id)
  where token = p_token;

  return query
  select invite_row.client_id, auth.uid(), resolved_admin_id;
end;
$$;

grant execute on function public.consume_invite_code(text) to authenticated;

create or replace function public.sync_invite_code()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.invite_codes (
    token,
    client_id,
    admin_id,
    name,
    email,
    company,
    invite_accepted
  )
  values (
    new.invite_token,
    new.id,
    new.admin_id,
    new.name,
    new.email,
    new.company,
    new.invite_accepted
  )
  on conflict (client_id) do update
    set token = excluded.token,
        admin_id = excluded.admin_id,
        name = excluded.name,
        email = excluded.email,
        company = excluded.company,
        invite_accepted = excluded.invite_accepted;

  return new;
end;
$$;

drop trigger if exists on_clients_sync_invite_code on public.clients;
create trigger on_clients_sync_invite_code
  after insert or update of name, email, company, invite_token, invite_accepted, profile_id on public.clients
  for each row execute procedure public.sync_invite_code();

insert into public.invite_codes (token, client_id, admin_id, name, email, company, invite_accepted)
select invite_token, id, admin_id, name, email, company, invite_accepted
from public.clients
where invite_token is not null
on conflict (client_id) do update
  set token = excluded.token,
      admin_id = excluded.admin_id,
      name = excluded.name,
      email = excluded.email,
      company = excluded.company,
      invite_accepted = excluded.invite_accepted;

-- Auto-create profile on user signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'role', 'client')
  )
  on conflict (id) do nothing;

  -- Link profile to client record if this email was invited
  update public.clients
  set profile_id = new.id, invite_accepted = true
  where email = new.email and invite_accepted = false;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Auto-update updated_at on notes
create or replace function public.handle_updated_at()
returns trigger language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_notes_updated on public.notes;
create trigger on_notes_updated
  before update on public.notes
  for each row execute procedure public.handle_updated_at();

-- =============================================
-- ROW LEVEL SECURITY POLICIES
-- =============================================

-- Profiles: users can read all profiles, update only their own
drop policy if exists "profiles_read" on public.profiles;
create policy "profiles_read" on public.profiles
  for select using (true);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

-- Clients: admin can CRUD their clients; linked client can read their own record
drop policy if exists "clients_admin_all" on public.clients;
create policy "clients_admin_all" on public.clients
  for all using (
    auth.uid() = admin_id
  );

drop policy if exists "clients_client_read" on public.clients;
create policy "clients_client_read" on public.clients
  for select using (
    auth.uid() = profile_id
  );

-- Notes: admin can CRUD notes for their clients; client can CRUD notes on their own client record
drop policy if exists "note_groups_admin_all" on public.note_groups;
create policy "note_groups_admin_all" on public.note_groups
  for all using (
    exists (
      select 1 from public.clients c
      where c.id = note_groups.client_id and c.admin_id = auth.uid()
    )
  );

drop policy if exists "note_groups_client_all" on public.note_groups;
create policy "note_groups_client_all" on public.note_groups
  for all using (
    exists (
      select 1 from public.clients c
      where c.id = note_groups.client_id and c.profile_id = auth.uid()
    )
  );

drop policy if exists "notes_admin_all" on public.notes;
create policy "notes_admin_all" on public.notes
  for all using (
    exists (
      select 1 from public.clients c
      where c.id = notes.client_id and c.admin_id = auth.uid()
    )
  );

drop policy if exists "notes_client_all" on public.notes;
create policy "notes_client_all" on public.notes
  for all using (
    exists (
      select 1 from public.clients c
      where c.id = notes.client_id and c.profile_id = auth.uid()
    )
  );

drop policy if exists "notes_locked_update_guard" on public.notes;
create policy "notes_locked_update_guard" on public.notes
  as restrictive
  for update
  using (locked_by is null or auth.uid() = locked_by)
  with check (locked_by is null or auth.uid() = locked_by);

drop policy if exists "notes_locked_delete_guard" on public.notes;
create policy "notes_locked_delete_guard" on public.notes
  as restrictive
  for delete
  using (locked_by is null or auth.uid() = locked_by);

-- Note attachments: inherit access from notes
drop policy if exists "attachments_admin_all" on public.note_attachments;
create policy "attachments_admin_all" on public.note_attachments
  for all using (
    exists (
      select 1 from public.notes n
      join public.clients c on c.id = n.client_id
      where n.id = note_attachments.note_id and c.admin_id = auth.uid()
    )
  );

drop policy if exists "attachments_client_all" on public.note_attachments;
create policy "attachments_client_all" on public.note_attachments
  for all using (
    exists (
      select 1 from public.notes n
      join public.clients c on c.id = n.client_id
      where n.id = note_attachments.note_id and c.profile_id = auth.uid()
    )
  );

drop policy if exists "attachments_locked_update_guard" on public.note_attachments;
create policy "attachments_locked_update_guard" on public.note_attachments
  as restrictive
  for update
  using (
    exists (
      select 1 from public.notes n
      where n.id = note_attachments.note_id
        and (n.locked_by is null or n.locked_by = auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.notes n
      where n.id = note_attachments.note_id
        and (n.locked_by is null or n.locked_by = auth.uid())
    )
  );

drop policy if exists "attachments_locked_delete_guard" on public.note_attachments;
create policy "attachments_locked_delete_guard" on public.note_attachments
  as restrictive
  for delete
  using (
    exists (
      select 1 from public.notes n
      where n.id = note_attachments.note_id
        and (n.locked_by is null or n.locked_by = auth.uid())
    )
  );

drop policy if exists "attachments_locked_insert_guard" on public.note_attachments;
create policy "attachments_locked_insert_guard" on public.note_attachments
  as restrictive
  for insert
  with check (
    exists (
      select 1 from public.notes n
      where n.id = note_attachments.note_id
        and (n.locked_by is null or n.locked_by = auth.uid())
    )
  );

-- =============================================
-- STORAGE BUCKETS
-- =============================================

-- Create storage bucket for note attachments
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'note-attachments',
  'note-attachments',
  true,
  52428800, -- 50MB
  array['image/jpeg','image/png','image/gif','image/webp','video/mp4','video/quicktime','video/webm']
)
on conflict (id) do nothing;

-- Storage policies
drop policy if exists "attachments_storage_read" on storage.objects;
create policy "attachments_storage_read" on storage.objects
  for select using (bucket_id = 'note-attachments');

drop policy if exists "attachments_storage_insert" on storage.objects;
create policy "attachments_storage_insert" on storage.objects
  for insert with check (
    bucket_id = 'note-attachments' and auth.role() = 'authenticated'
  );

drop policy if exists "attachments_storage_delete" on storage.objects;
create policy "attachments_storage_delete" on storage.objects
  for delete using (
    bucket_id = 'note-attachments' and auth.uid()::text = (storage.foldername(name))[1]
  );

-- =============================================
-- REALTIME
-- =============================================

-- Enable realtime on notes table
alter publication supabase_realtime add table if not exists public.note_groups;
alter publication supabase_realtime add table if not exists public.notes;
alter publication supabase_realtime add table if not exists public.note_attachments;
