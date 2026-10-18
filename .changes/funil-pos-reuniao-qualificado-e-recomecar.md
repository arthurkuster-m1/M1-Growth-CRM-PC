---
impacto: capacidade_nova
secao: adicionado
titulo: "E agora?" depois de uma reunião sem venda, lead que chega qualificado e "Apagar e recomeçar" o funil da campanha
---

Ao registrar "Compareceu e não comprou", o sistema pergunta para onde vai a oportunidade — Em
negociação, Desqualificado ou Não comprou (com o motivo) —, oferecendo só o que o funil dela tem.
Os modelos prontos com reunião ganharam a etapa "Em negociação".

Um formulário que já qualificou a pessoa pode avisar o CRM: enviando `qualificado` (ou
`qualified`, `mql`, `lead_qualificado`) com valor `true`/`sim`/`1` no webhook, o lead já nasce na
etapa de MQL do funil, em vez da primeira.

No funil da campanha há o botão "Apagar e recomeçar": troca o funil por um novo, de um modelo
pronto ou seu. Os formulários da campanha passam para o novo funil; o antigo é apagado se estiver
vazio, e arquivado (com as oportunidades e o histórico) se tiver negócios.

Também: a criação do funil a partir de um modelo com papéis de qualificação não falha mais por causa
da regra da Meta, e os botões "Criar funil da campanha", "Nova estratégia" e "Nova campanha" não
quebram mais o texto em duas linhas.
