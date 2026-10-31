-- manifest: **Comentários da campanha.** `demand_campaigns.comments` (texto livre, preenchido à mão na tabela de Campanhas). A "Última otimização" não precisa de coluna: sai das notas `otimizacao` que já existem.
alter table public.demand_campaigns add column if not exists comments text not null default '';
comment on column public.demand_campaigns.comments is 'Comentários livres da agência sobre a campanha (tabela de Campanhas).';
