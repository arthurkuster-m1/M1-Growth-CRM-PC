-- Prova do caminho completo (excluir 1, excluir vários em lote, ver na Lixeira, restaurar) COMO
-- USUÁRIO LOGADO (`authenticated`, JWT do agente), no banco com o baseline aplicado.
-- Uso: psql -d <banco> -v ON_ERROR_STOP=0 -f prova.sql
\set VERBOSITY terse
\pset format aligned
\pset footer off

\echo '== 0. Semente (como dono do banco): 1 empresa, 1 agente, 3 clientes, cada um com lead, tarefa, conversa, mensagem e histórico'
insert into auth.users (id, email) values ('eeeeeeee-1111-4000-8000-000000000001','agente@prova.test') on conflict do nothing;
insert into public.organizations (id, slug, legal_name, display_name) values ('eeeeeeee-0000-4000-8000-000000000001','prova-lixeira','Prova','Prova') on conflict do nothing;
insert into public.user_organizations (user_id, organization_id, role, accepted_at) values ('eeeeeeee-1111-4000-8000-000000000001','eeeeeeee-0000-4000-8000-000000000001','agent',now()) on conflict do nothing;
insert into public.channel_sessions (id, organization_id, waha_session_name, webhook_secret_encrypted) values ('eeeeeeee-2222-4000-8000-000000000001','eeeeeeee-0000-4000-8000-000000000001','prova','\x00'::bytea) on conflict do nothing;
do $$
declare o uuid := 'eeeeeeee-0000-4000-8000-000000000001'; s uuid := 'eeeeeeee-2222-4000-8000-000000000001';
  p uuid; e1 uuid; e2 uuid; c uuid; l uuid; cv uuid; i int;
begin
  insert into public.crm_pipelines (organization_id, name, slug) values (o,'Funil','funil-prova') returning id into p;
  insert into public.crm_stages (organization_id, pipeline_id, name, slug, position) values (o,p,'Novo','novo',1) returning id into e1;
  insert into public.crm_stages (organization_id, pipeline_id, name, slug, position) values (o,p,'Contato','contato',2) returning id into e2;
  for i in 1..3 loop
    insert into public.contacts (organization_id, display_name, phone_number) values (o,'Cliente '||i,'+551199999000'||i) returning id into c;
    insert into public.crm_leads (organization_id, pipeline_id, stage_id, title, contact_id) values (o,p,e1,'Lead '||i,c) returning id into l;
    update public.crm_leads set stage_id = e2 where id = l;
    insert into public.crm_tasks (organization_id, title, contact_id, lead_id) values (o,'Tarefa '||i,c,l);
    insert into public.conversations (organization_id, contact_id, channel_session_id) values (o,c,s) returning id into cv;
    insert into public.messages (organization_id, conversation_id, channel_session_id, contact_id, type, direction, body) values (o,cv,s,c,'text','inbound','oi '||i);
  end loop;
end $$;

create or replace view pg_temp.retrato as
select (select count(*) from public.contacts where organization_id='eeeeeeee-0000-4000-8000-000000000001') as clientes,
       (select count(*) from public.crm_leads where organization_id='eeeeeeee-0000-4000-8000-000000000001') as leads,
       (select count(*) from public.crm_tasks where organization_id='eeeeeeee-0000-4000-8000-000000000001') as tarefas,
       (select count(*) from public.conversations where organization_id='eeeeeeee-0000-4000-8000-000000000001') as conversas,
       (select count(*) from public.messages where organization_id='eeeeeeee-0000-4000-8000-000000000001') as mensagens,
       (select count(*) from public.crm_historico_de_estados where organization_id='eeeeeeee-0000-4000-8000-000000000001') as historico,
       (select count(*) from public.crm_lixeira where organization_id='eeeeeeee-0000-4000-8000-000000000001') as na_lixeira;
grant select on pg_temp.retrato to public;
select * from pg_temp.retrato;

set role authenticated;
select set_config('request.jwt.claims','{"sub":"eeeeeeee-1111-4000-8000-000000000001"}',false) as login_do_agente \gset

\echo
\echo '== 1. Apagar 1 lead/cliente (como a rota DELETE /api/v1/contacts/[id])'
select public.fn_excluir_cliente_para_lixeira(c.id, c.organization_id) as excluiu from public.contacts c where c.display_name = 'Cliente 1';
select * from pg_temp.retrato;

\echo
\echo '== 2. Apagar VÁRIOS em lote (como a rota POST /api/v1/clientes/lote): Clientes 2 e 3'
select c.display_name, public.fn_excluir_cliente_para_lixeira(c.id, c.organization_id) as excluiu from public.contacts c where c.display_name in ('Cliente 2','Cliente 3') order by 1;
select * from pg_temp.retrato;

\echo
\echo '== 3. Ver na Lixeira (leitura sob RLS, como a tela /app/lixeira)'
select nome, telefone, resumo ->> 'oportunidades' as oportunidades, resumo ->> 'mensagens' as mensagens from public.crm_lixeira order by nome;

\echo
\echo '== 4. Restaurar um (Cliente 1) e depois os outros dois em lote (como POST /api/v1/lixeira/[id]/restaurar)'
select l.nome, public.fn_restaurar_cliente_da_lixeira(l.id, l.organization_id) is not null as restaurou from public.crm_lixeira l order by l.nome;
select * from pg_temp.retrato;

\echo
\echo '== 5. Quem não pode: viewer, outra empresa e sem login recebem 42501; internas fechadas'
reset role;
insert into auth.users (id, email) values ('eeeeeeee-1111-4000-8000-000000000002','viewer@prova.test'),('eeeeeeee-1111-4000-8000-000000000003','outra@prova.test') on conflict do nothing;
insert into public.organizations (id, slug, legal_name, display_name) values ('eeeeeeee-0000-4000-8000-000000000002','prova-lixeira-b','Prova B','Prova B') on conflict do nothing;
insert into public.user_organizations (user_id, organization_id, role, accepted_at) values
 ('eeeeeeee-1111-4000-8000-000000000002','eeeeeeee-0000-4000-8000-000000000001','viewer',now()),
 ('eeeeeeee-1111-4000-8000-000000000003','eeeeeeee-0000-4000-8000-000000000002','admin',now()) on conflict do nothing;
\set VERBOSITY verbose
set role authenticated;
select set_config('request.jwt.claims','{"sub":"eeeeeeee-1111-4000-8000-000000000002"}',false) as x \gset
\echo '-- viewer da empresa A tenta excluir:'
select public.fn_excluir_cliente_para_lixeira(c.id, c.organization_id) from public.contacts c limit 1;
select set_config('request.jwt.claims','{"sub":"eeeeeeee-1111-4000-8000-000000000003"}',false) as x \gset
\echo '-- admin da empresa B aponta para a empresa A:'
select public.fn_excluir_cliente_para_lixeira(c.id, 'eeeeeeee-0000-4000-8000-000000000001') from public.contacts c limit 1;
select set_config('request.jwt.claims','{}',false) as x \gset
\echo '-- sem login:'
select public.fn_excluir_cliente_para_lixeira(c.id, c.organization_id) from public.contacts c limit 1;
\echo '-- chamar uma função interna direto:'
select public.fn_historico_apagar_do_contato('eeeeeeee-0000-4000-8000-000000000001', c.id) from public.contacts c limit 1;
reset role;
\echo
\echo '-- privilégio de execução (authenticated | anon):'
select p.oid::regprocedure::text as funcao,
       has_function_privilege('authenticated', p.oid, 'execute') as authenticated,
       has_function_privilege('anon', p.oid, 'execute') as anon,
       p.prosecdef as definer
from pg_proc p
where p.proname in ('fn_historico_apagar_do_contato','fn_historico_inserir_da_lixeira','fn_recalcula_cliente_restaurado','fn_excluir_cliente_para_lixeira','fn_restaurar_cliente_da_lixeira')
order by 1;
