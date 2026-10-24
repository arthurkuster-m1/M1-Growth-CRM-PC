---
impacto: capacidade_nova
secao: adicionado
titulo: Verificar quais empresas extraídas têm WhatsApp antes de abordar
---

Na lista de empresas da prospecção há o botão "Verificar WhatsApp": escolha uma conexão de
WhatsApp comum e o sistema pergunta, em lotes e com pausa entre as consultas, se o número de
cada empresa marcada existe no WhatsApp. A consulta não envia mensagem. Cada empresa passa a
mostrar "Tem WhatsApp", "Sem WhatsApp" ou "Não consegui verificar" (com botão para tentar de
novo), e o filtro de qualidade ganha "Só com WhatsApp confirmado".

Empresa cujo número foi provado sem WhatsApp é pulada na fila, com o motivo registrado. Quem não
foi verificado, ou ficou incerto, segue como antes.

Atualização: aplica a migration 0658 (resultado da verificação por empresa) pelo `update.sh`.
