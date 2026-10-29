-- Korelaztiot (קורלציות): urban correlation lab, Ashdod Municipality. Project ASHDODMAP, prefix kr_.
-- Public read for published rows; writes only through security definer functions that check an editor key.
create table if not exists public.kr_editor_keys (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  key_hash text not null unique,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);
alter table public.kr_editor_keys enable row level security;

create table if not exists public.kr_findings (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  x_key text not null,
  y_key text not null,
  unit_type text not null default 'h3-8',
  control_key text,
  stats jsonb not null default '{}'::jsonb,
  summary text,
  note text,
  status text not null default 'published' check (status in ('draft','published')),
  author text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
comment on table public.kr_findings is 'קורלציות: ממצאים שמורים מהמעבדה העירונית, עיריית אשדוד';
alter table public.kr_findings enable row level security;
-- no "drop policy": it triggers a confirmation prompt; create only when missing
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'kr_findings' and policyname = 'kr_findings_read') then
    create policy kr_findings_read on public.kr_findings for select to anon, authenticated using (status = 'published' and deleted_at is null);
  end if;
end $$;

create table if not exists public.kr_updates (
  id uuid primary key default gen_random_uuid(),
  version text not null,
  title text not null,
  body text,
  kind text not null default 'feature' check (kind in ('feature','data','fix')),
  published_at timestamptz not null default now(),
  deleted_at timestamptz
);
alter table public.kr_updates enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'kr_updates' and policyname = 'kr_updates_read') then
    create policy kr_updates_read on public.kr_updates for select to anon, authenticated using (deleted_at is null);
  end if;
end $$;

create or replace function public.kr_editor(p_key text) returns text
language sql stable security definer set search_path = public, extensions as $$
  select label from public.kr_editor_keys
  where key_hash = encode(extensions.digest(coalesce(p_key, ''), 'sha256'), 'hex') and revoked_at is null
  limit 1;
$$;

create or replace function public.kr_save_finding(p_key text, p_id uuid, p_data jsonb) returns public.kr_findings
language plpgsql security definer set search_path = public as $$
declare ed text := public.kr_editor(p_key); r public.kr_findings;
begin
  if ed is null then raise exception 'not_authorized' using errcode = '42501'; end if;
  insert into public.kr_findings as f (id, title, x_key, y_key, unit_type, control_key, stats, summary, note, status, author, updated_at)
  values (coalesce(p_id, gen_random_uuid()), coalesce(nullif(p_data->>'title',''), 'ממצא'), p_data->>'x_key', p_data->>'y_key',
          coalesce(p_data->>'unit_type','h3-8'), nullif(p_data->>'control_key',''), coalesce(p_data->'stats','{}'::jsonb),
          p_data->>'summary', p_data->>'note', coalesce(p_data->>'status','published'), ed, now())
  on conflict (id) do update set title = excluded.title, x_key = excluded.x_key, y_key = excluded.y_key, unit_type = excluded.unit_type,
    control_key = excluded.control_key, stats = excluded.stats, summary = excluded.summary, note = excluded.note,
    status = excluded.status, updated_at = now(), deleted_at = null
  returning * into r;
  return r;
end; $$;

create or replace function public.kr_remove_finding(p_key text, p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if public.kr_editor(p_key) is null then raise exception 'not_authorized' using errcode = '42501'; end if;
  update public.kr_findings set deleted_at = now() where id = p_id;
end; $$;

create or replace function public.kr_save_update(p_key text, p_id uuid, p_data jsonb) returns public.kr_updates
language plpgsql security definer set search_path = public as $$
declare r public.kr_updates;
begin
  if public.kr_editor(p_key) is null then raise exception 'not_authorized' using errcode = '42501'; end if;
  insert into public.kr_updates as u (id, version, title, body, kind, published_at)
  values (coalesce(p_id, gen_random_uuid()), coalesce(p_data->>'version',''), coalesce(p_data->>'title',''), p_data->>'body',
          coalesce(p_data->>'kind','feature'), coalesce((p_data->>'published_at')::timestamptz, now()))
  on conflict (id) do update set version = excluded.version, title = excluded.title, body = excluded.body, kind = excluded.kind, published_at = excluded.published_at, deleted_at = null
  returning * into r;
  return r;
end; $$;

revoke all on function public.kr_editor(text) from public;
grant execute on function public.kr_editor(text) to anon, authenticated;
grant execute on function public.kr_save_finding(text, uuid, jsonb), public.kr_remove_finding(text, uuid), public.kr_save_update(text, uuid, jsonb) to anon, authenticated;
grant select on public.kr_findings, public.kr_updates to anon, authenticated;

-- editor key hash only; the key itself is never stored
insert into public.kr_editor_keys (label, key_hash) values ('ענת שטיבלמן', 'dfa64d82de1b9b8a71bc83c1a68aa5e547f51f777af61a9161e58daf2c785706') on conflict (key_hash) do nothing;

-- the key table is read only by the security definer functions; keep it out of the public API schema
revoke all on table public.kr_editor_keys from anon, authenticated;
