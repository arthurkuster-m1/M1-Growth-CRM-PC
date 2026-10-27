-- manifest: **Radar com as colunas certas.** A aba Radar das Oportunidades, criada com só filtro e ordem, passa a mostrar as colunas que servem a esse trabalho (radar, tempo parado, próxima ação, botões de agir), sem mexer nas que já foram ajustadas. Só dados.

-- A visualização "Radar" criada antes desta migration só tinha filtro e ordem (as colunas eram as de
-- fábrica da tabela). Aqui ela ganha as colunas que servem ao Radar. Só toca nas que ainda não têm
-- colunas escolhidas, então não desfaz o que alguém já ajustou.
update public.crm_saved_views
   set config = $cfg${"ordem":["nome","radar","sem-resposta","op-ultima-atividade","op-tempo-na-etapa","etapa","ligar","inbox","acao","cliente","telefone","responsavel","tentativas","resultado-rapido","proxima-acao","proxima-acao-em","previsto","campanha","whatsapp","instagram","cadencia","previsao","entrou-no-funil","produtos","pago","op-interesse","origem","anuncio","lp","posicionamento","op-utm-fonte","op-utm-meio","op-utm-campanha","op-utm-termo","op-utm-conteudo","op-atribuido-em","op-criado-por","op-retomada","op-etapa-da-perda","op-motivo-da-perda","op-dias-ate-perder","op-tags"],"visiveis":{"nome":true,"cliente":true,"telefone":true,"etapa":true,"campanha":false,"responsavel":true,"radar":true,"sem-resposta":true,"op-tempo-na-etapa":true,"op-ultima-atividade":true,"tentativas":true,"resultado-rapido":true,"ligar":true,"whatsapp":false,"instagram":false,"inbox":true,"acao":true,"proxima-acao":true,"proxima-acao-em":true,"cadencia":false,"previsao":false,"entrou-no-funil":false,"produtos":false,"pago":false,"op-interesse":false,"previsto":true,"origem":false,"anuncio":false,"lp":false,"posicionamento":false,"op-utm-fonte":false,"op-utm-meio":false,"op-utm-campanha":false,"op-utm-termo":false,"op-utm-conteudo":false,"op-atribuido-em":false,"op-criado-por":false,"op-retomada":false,"op-etapa-da-perda":false,"op-motivo-da-perda":false,"op-dias-ate-perder":false,"op-tags":false},"filtros":[{"campo":"radar","operador":"e","valor":["critico","em_risco"]}],"ordenacao":[{"campo":"radar","direcao":"asc"},{"campo":"sem-resposta","direcao":"desc"}]}$cfg$::jsonb,
       updated_at = now()
 where screen_key = 'oportunidades'
   and name = 'Radar'
   and not (config ? 'ordem');

notify pgrst, 'reload schema';
