-- manifest: **Visualização de fábrica "Próximos passos".** Cria, em cada organização, a aba Próximos passos nas Oportunidades (quem tem o próximo passo marcado nos próximos 5 dias, o mais próximo primeiro), sem duplicar a que já existe pelo nome. Só dados; nenhuma tabela muda.

do $visao$
declare
  o record;
begin
  for o in select id from public.organizations loop
    if not exists (
      select 1 from public.crm_saved_views
       where organization_id = o.id and screen_key = 'oportunidades' and name = 'Próximos passos'
    ) then
      insert into public.crm_saved_views (organization_id, screen_key, name, type, config)
      values (o.id, 'oportunidades', 'Próximos passos', 'tabela', $cfg${"ordem":["nome","proxima-acao","proxima-acao-em","cliente","telefone","etapa","responsavel","ligar","inbox","acao","previsto","campanha","radar","sem-resposta","op-tempo-na-etapa","op-ultima-atividade","tentativas","resultado-rapido","whatsapp","instagram","cadencia","previsao","entrou-no-funil","produtos","pago","op-interesse","origem","anuncio","lp","posicionamento","op-utm-fonte","op-utm-meio","op-utm-campanha","op-utm-termo","op-utm-conteudo","op-atribuido-em","op-criado-por","op-retomada","op-etapa-da-perda","op-motivo-da-perda","op-dias-ate-perder","op-tags"],"visiveis":{"nome":true,"cliente":true,"telefone":true,"etapa":true,"campanha":false,"responsavel":true,"radar":false,"sem-resposta":false,"op-tempo-na-etapa":false,"op-ultima-atividade":false,"tentativas":false,"resultado-rapido":false,"ligar":true,"whatsapp":false,"instagram":false,"inbox":true,"acao":true,"proxima-acao":true,"proxima-acao-em":true,"cadencia":false,"previsao":false,"entrou-no-funil":false,"produtos":false,"pago":false,"op-interesse":false,"previsto":true,"origem":false,"anuncio":false,"lp":false,"posicionamento":false,"op-utm-fonte":false,"op-utm-meio":false,"op-utm-campanha":false,"op-utm-termo":false,"op-utm-conteudo":false,"op-atribuido-em":false,"op-criado-por":false,"op-retomada":false,"op-etapa-da-perda":false,"op-motivo-da-perda":false,"op-dias-ate-perder":false,"op-tags":false},"filtros":[{"campo":"proxima-acao-em","operador":"periodo","valor":"proximos_5_dias"}],"ordenacao":[{"campo":"proxima-acao-em","direcao":"asc"}]}$cfg$::jsonb);
    end if;
  end loop;
end
$visao$;

notify pgrst, 'reload schema';
