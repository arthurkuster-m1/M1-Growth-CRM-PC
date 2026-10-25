-- manifest: **Áudio gravado e reutilizável nas abordagens.** `approach_audios` guarda os arquivos de voz da organização (no bucket `whatsapp-media`, pasta `<org>/audios-da-abordagem/`) e `demand_approach_steps.audio_id` aponta o arquivo que o passo de áudio envia.
create table if not exists public.approach_audios (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  storage_path text not null,
  mime text not null,
  size_bytes integer not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint approach_audios_name_check check (length(btrim(name)) between 1 and 120),
  constraint approach_audios_size_check check (size_bytes between 1 and 16777216)
);
create index if not exists approach_audios_org_idx on public.approach_audios (organization_id, created_at desc);

alter table public.approach_audios enable row level security;
drop policy if exists approach_audios_select on public.approach_audios;
create policy approach_audios_select on public.approach_audios
  for select using (
    (organization_id in (select public.fn_user_org_ids())) or public.fn_is_platform_admin()
  );
revoke all on public.approach_audios from anon;
revoke insert, update, delete, truncate on public.approach_audios from authenticated;
grant select on public.approach_audios to authenticated;

alter table public.demand_approach_steps
  add column if not exists audio_id uuid references public.approach_audios(id) on delete set null;

comment on table public.approach_audios is
  'Arquivos de voz gravados pela organização, reutilizáveis nos passos de áudio das abordagens. O arquivo mora no bucket whatsapp-media; só o servidor escreve.';

notify pgrst, 'reload schema';
