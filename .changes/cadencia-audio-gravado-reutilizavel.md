---
impacto: capacidade_nova
secao: adicionado
titulo: Áudio gravado por você nas abordagens de WhatsApp, reutilizável
---

No passo de áudio do fluxo da abordagem agora é possível enviar o arquivo de voz que você gravou
(ogg, mp3, m4a, wav, aac ou amr, até 8 MB) e escolher o mesmo arquivo em outras abordagens, a
partir de uma biblioteca de áudios da empresa. Quando o lead responde e o passo seguinte é um
áudio, o painel "Continuação da conversa" mostra "Aprovar e enviar o áudio": o arquivo sai como
mensagem de áudio na conversa. Em número da API oficial, wav e webm são recusados antes do envio (a lista avisa quais arquivos não servem lá). Passo de áudio sem arquivo avisa no desenho e não envia nada.

Atualização: aplica a migration 0667 (biblioteca de áudios) pelo `update.sh`.
