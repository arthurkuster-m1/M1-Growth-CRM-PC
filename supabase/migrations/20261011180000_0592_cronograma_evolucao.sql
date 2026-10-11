-- manifest: **Cronograma que anda para sempre, metas com tipo e semana no domingo.** `marketing_cronograma_itens.arquivado` (esconde o concluído sem apagar) e teto de semanas de 26 para 520; `marketing_cronograma_metas` ganha `tipo` (moeda|numero|percentual), `unidade`, `valor_alvo` e `valor_atual` numéricos (o progresso e a formatação deixam de depender de texto livre); a semana do cronograma passa a começar no domingo (`data_inicio` já gravada recua para o domingo).

-- ============================================================================
-- 0592 — EVOLUÇÃO DO CRONOGRAMA
--
-- 1) O cronograma não termina: a tela mostra uma janela de semanas que anda para os dois lados
--    (`total_semanas` passa a ser "quantas semanas cabem na tela"), e as ações guardam o número
--    da semana — por isso o teto de 26 vira 520 (10 anos). `arquivado` tira do gráfico o que já
--    foi concluído sem perder o registro; reaparece ao desarquivar.
-- 2) Metas com tipo: o alvo e o atual viram NÚMEROS, e o tipo (moeda, número com unidade,
--    percentual) decide a formatação e a conta de progresso. As colunas de texto (`alvo`,
--    `atual`) ficam como estavam, só que a tela deixa de usá-las.
-- 3) A semana começa no domingo: `data_inicio` (antes a segunda-feira da semana 1) recua para o
--    domingo da mesma semana.
-- ============================================================================

alter table public.marketing_cronograma_itens
  add column if not exists arquivado boolean not null default false;

alter table public.marketing_cronograma_itens drop constraint if exists marketing_cronograma_itens_semanas_check;
alter table public.marketing_cronograma_itens
  add constraint marketing_cronograma_itens_semanas_check
  check (semana_inicio >= 1 and semana_fim >= semana_inicio and semana_fim <= 520);

alter table public.marketing_cronograma_metas
  add column if not exists tipo text not null default 'numero',
  add column if not exists unidade text not null default '',
  add column if not exists valor_alvo numeric,
  add column if not exists valor_atual numeric;

alter table public.marketing_cronograma_metas drop constraint if exists marketing_cronograma_metas_tipo_check;
alter table public.marketing_cronograma_metas
  add constraint marketing_cronograma_metas_tipo_check
  check (tipo in ('moeda', 'numero', 'percentual') and length(unidade) <= 20);

-- Leitura do texto antigo ("R$ 15.000,00", "1.200 leads", "35%") para número.
create or replace function pg_temp.numero_do_texto(p text) returns numeric language plpgsql as $f$
declare
  s text := substring(coalesce(p, '') from '-?\d[\d.,]*');
begin
  if s is null then return null; end if;
  if position(',' in s) > 0 then
    s := replace(replace(s, '.', ''), ',', '.');
  elsif s ~ '^\d{1,3}(\.\d{3})+$' then
    s := replace(s, '.', '');
  end if;
  return s::numeric;
exception when others then
  return null;
end
$f$;

-- Só preenche o que ainda não foi preenchido: reaplicar a migração não desfaz edição nova.
update public.marketing_cronograma_metas m
   set tipo = case
         when m.alvo ~* 'r\$' or m.atual ~* 'r\$' then 'moeda'
         when m.alvo like '%\%%' or m.atual like '%\%%' then 'percentual'
         else 'numero' end,
       valor_alvo = pg_temp.numero_do_texto(m.alvo),
       valor_atual = pg_temp.numero_do_texto(m.atual)
 where m.valor_alvo is null and m.valor_atual is null and (m.alvo <> '' or m.atual <> '');

-- A semana começa no domingo (extract(dow): 0 = domingo). Idempotente: um domingo não se move.
update public.marketing_cronograma_config
   set data_inicio = data_inicio - extract(dow from data_inicio)::int
 where data_inicio is not null and extract(dow from data_inicio) <> 0;

comment on column public.marketing_cronograma_itens.arquivado is
  'Ação concluída que a agência tirou do gráfico. Não apaga: volta ao desarquivar.';
comment on column public.marketing_cronograma_metas.tipo is
  'Como o valor é lido e mostrado: moeda (R$), numero (com `unidade`, ex.: leads) ou percentual.';
comment on column public.marketing_cronograma_config.data_inicio is
  'O domingo da semana 1 (a semana do cronograma começa no domingo). Nulo = só "S1, S2…", sem datas.';
comment on column public.marketing_cronograma_config.total_semanas is
  'Quantas semanas cabem na tela do cronograma geral (a janela anda para os dois lados; o cronograma não termina).';

notify pgrst, 'reload schema';
