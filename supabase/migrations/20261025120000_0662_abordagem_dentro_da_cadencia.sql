-- manifest: **A Cadência é a página principal da Prospecção e guarda as abordagens.** Campanhas de Prospecção com páginas escolhidas ganham a página `cadencia` (a página `abordagem` sai da lista; as abordagens em si continuam em `demand_campaign_approaches`).
update public.demand_campaigns
   set optional_tabs = array(
     select distinct t from unnest(array_remove(optional_tabs, 'abordagem') || array['cadencia']) as t
   )
 where channel = 'prospeccao'
   and optional_tabs is not null
   and not ('cadencia' = any (optional_tabs));
notify pgrst, 'reload schema';
