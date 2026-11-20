-- manifest: **Notificações: marcar como lida e preferências no servidor.** (1) Cada pessoa pode marcar as PRÓPRIAS notificações como lidas: `grant update (lida_em)` em `notificacoes` para `authenticated` + política de update só nas linhas dela (`user_id = auth.uid()` nas organizações dela) — nenhuma outra coluna é alterável pela sessão. (2) Tabela `notificacoes_preferencias` (pessoa × organização × categoria): `na_tela` e `no_celular`, para a escolha valer em todo aparelho e o servidor parar de mandar push do que a pessoa desligou. Sem linha = ligado. Cada pessoa lê e grava só as dela. Aditiva e idempotente.

-- 0698 — NOTIFICAÇÕES: LIDAS E PREFERÊNCIAS

-- ── 1. Marcar como lida ─────────────────────────────────────────────────────
grant update (lida_em) on public.notificacoes to authenticated;

drop policy if exists notificacoes_marcar_lida on public.notificacoes;
create policy notificacoes_marcar_lida on public.notificacoes
  for update
  using (user_id = auth.uid() and organization_id in (select public.fn_user_org_ids()))
  with check (user_id = auth.uid() and organization_id in (select public.fn_user_org_ids()));

create index if not exists notificacoes_pessoa_nao_lidas
  on public.notificacoes (user_id, organization_id)
  where lida_em is null;

-- ── 2. Preferências por pessoa ──────────────────────────────────────────────
create table if not exists public.notificacoes_preferencias (
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  categoria text not null,
  na_tela boolean not null default true,
  no_celular boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (user_id, organization_id, categoria)
);

alter table public.notificacoes_preferencias drop constraint if exists notificacoes_preferencias_categoria_check;
alter table public.notificacoes_preferencias add constraint notificacoes_preferencias_categoria_check
  check (categoria in ('mensagem', 'lead_novo', 'lead_atribuido', 'mencao', 'tarefa', 'atendimento', 'crm', 'sistema', 'ligacao'));

alter table public.notificacoes_preferencias enable row level security;

drop policy if exists notificacoes_preferencias_da_pessoa on public.notificacoes_preferencias;
create policy notificacoes_preferencias_da_pessoa on public.notificacoes_preferencias
  using (user_id = auth.uid() and organization_id in (select public.fn_user_org_ids()))
  with check (user_id = auth.uid() and organization_id in (select public.fn_user_org_ids()));

revoke all on public.notificacoes_preferencias from anon;
grant select, insert, update on public.notificacoes_preferencias to authenticated;

comment on table public.notificacoes_preferencias is
  'Preferência de notificação por pessoa e categoria (0698): na_tela (aviso no canto) e no_celular (push). Sem linha = ligado. O servidor não manda push de categoria com no_celular = false.';

notify pgrst, 'reload schema';
