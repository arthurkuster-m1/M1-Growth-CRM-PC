-- manifest: **Notas da campanha em blocos e período das metas automático.** O texto da campanha (agora "Notas", com o editor de blocos) passa a caber 20.000 caracteres, e `goal_period` deixa de ser escolha: campanha com início e fim vale pela campanha toda, contínua (ou sem fim) renova todo mês.

alter table public.demand_campaigns drop constraint if exists demand_campaigns_texts_check;
alter table public.demand_campaigns add constraint demand_campaigns_texts_check
  check (length(description) <= 20000 and length(idea) <= 4000 and length(objective) <= 2000
         and length(platform) <= 40 and length(sheet_url) <= 500);

update public.demand_campaigns
   set goal_period = case when continuous or end_date is null then 'mensal' else 'total' end
 where goal_period is distinct from (case when continuous or end_date is null then 'mensal' else 'total' end);

notify pgrst, 'reload schema';
