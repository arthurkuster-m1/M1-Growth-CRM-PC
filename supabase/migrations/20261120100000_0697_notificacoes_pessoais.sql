-- manifest: **Notificações por pessoa.** Tabela `public.notificacoes`: cada notificação (mensagem nova, lead novo, lead atribuído, menção, tarefa, atendimento, aviso do CRM, erro de sistema) vira UMA linha por destinatário, com título, texto, até dois botões (`acoes`: rótulo + link) e a marca `tag`. É a mesma linha que alimenta o push no celular e o aviso na tela (Realtime), então os dois dizem sempre a mesma coisa e só chegam a quem deve receber. Só o servidor escreve (sem grant de escrita para `authenticated`); cada pessoa lê só as dela (RLS `user_id = auth.uid()` nas organizações dela). Dedup por evento e pessoa. Entra no Realtime. Aditiva e idempotente.

-- 0697 — NOTIFICAÇÕES POR PESSOA
--
-- Antes: o push de mensagem nova ia para o celular de TODA a organização, o aviso na tela era
-- montado no navegador olhando qualquer linha nova de `messages`/`crm_leads`, e o texto dos dois
-- era montado em lugares diferentes. Agora o servidor decide QUEM recebe e O QUE diz, grava aqui,
-- e daqui saem o push e o aviso na tela.

create table if not exists public.notificacoes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  categoria text not null,
  titulo text not null,
  corpo text not null default '',
  acoes jsonb not null default '[]'::jsonb,
  tag text,
  origem_evento uuid,
  lida_em timestamptz,
  created_at timestamptz not null default now()
);

alter table public.notificacoes drop constraint if exists notificacoes_categoria_check;
alter table public.notificacoes add constraint notificacoes_categoria_check
  check (categoria in ('mensagem', 'lead_novo', 'lead_atribuido', 'mencao', 'tarefa', 'atendimento', 'crm', 'sistema'));
alter table public.notificacoes drop constraint if exists notificacoes_titulo_check;
alter table public.notificacoes add constraint notificacoes_titulo_check
  check (char_length(titulo) between 1 and 200);
alter table public.notificacoes drop constraint if exists notificacoes_corpo_check;
alter table public.notificacoes add constraint notificacoes_corpo_check
  check (char_length(corpo) <= 400);
alter table public.notificacoes drop constraint if exists notificacoes_acoes_check;
alter table public.notificacoes add constraint notificacoes_acoes_check
  check (jsonb_typeof(acoes) = 'array' and jsonb_array_length(acoes) <= 2);

-- O mesmo evento reprocessado não entrega duas vezes à mesma pessoa. Índice inteiro (não parcial)
-- para o `on conflict (origem_evento, user_id) do nothing` do servidor; sem evento (null) nunca colide.
create unique index if not exists notificacoes_evento_pessoa_unico
  on public.notificacoes (origem_evento, user_id);

create index if not exists notificacoes_pessoa_recentes
  on public.notificacoes (user_id, organization_id, created_at desc);

alter table public.notificacoes enable row level security;

-- Cada pessoa só vê as próprias, e só nas organizações dela.
drop policy if exists notificacoes_da_pessoa on public.notificacoes;
create policy notificacoes_da_pessoa on public.notificacoes
  for select
  using (user_id = auth.uid() and organization_id in (select public.fn_user_org_ids()));

-- Só o servidor (service_role) escreve.
revoke all on public.notificacoes from anon;
revoke insert, update, delete, truncate on public.notificacoes from authenticated;
grant select on public.notificacoes to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notificacoes'
  ) then
    execute 'alter publication supabase_realtime add table public.notificacoes';
  end if;
end $$;

comment on table public.notificacoes is
  'Notificação por pessoa (0697): uma linha por destinatário, com título, texto e até dois botões (acoes). Alimenta o push e o aviso na tela. Só o servidor escreve; cada pessoa lê só as dela.';

notify pgrst, 'reload schema';
