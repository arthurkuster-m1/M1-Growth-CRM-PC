---
impacto: capacidade_nova
secao: adicionado
titulo: Gravar e ouvir o áudio da abordagem na tela, e ver o custo da IA da continuação
---

No passo de áudio do fluxo da abordagem agora dá para **gravar a voz direto no navegador** ("Gravar
agora") e **ouvir** o áudio escolhido ("Ouvir") sem sair da tela. A gravação do navegador (webm) é
convertida ao guardar para ogg com Opus, que também serve à API oficial. Arquivos wav, webm que não
puderam ser convertidos e ogg que não seja Opus continuam valendo no número não oficial e são
recusados no oficial.

O painel "Continuação da conversa" passa a mostrar o **custo da IA** gasto nas mensagens que a IA
escreve depois da resposta do lead.

Atualização: aplica a migration 0668 (custo da IA da continuação) pelo `update.sh`.
