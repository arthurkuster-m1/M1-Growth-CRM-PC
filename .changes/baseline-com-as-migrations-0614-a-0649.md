---
impacto: exige_acao
secao: corrigido
titulo: Instalação nova e atualização do banco voltam a funcionar — o baseline passa a incluir as migrations 0614 a 0649
---

O arquivo de instalação do banco (`supabase/baseline.sql`) não trazia 36 migrations do núcleo do
CRM (oportunidade única, vendas e pagamentos, ciclo de vida, lixeira de clientes, taxas de
pagamento, confirmação do cliente no compromisso e outras). Numa instalação nova, o instalador
parava com `column l.notes does not exist`. Agora o baseline as inclui, na ordem, e a instalação e
a atualização terminam sem erro. Quem já mantém o banco aplicando as migrations uma a uma não
precisa fazer nada; quem atualiza pelo `update.sh` deve rodá-lo de novo, para que a reaplicação
traga também as travas e permissões que ficavam de fora das tabelas novas.

## Requer atenção

Rode o `update.sh` uma vez depois de atualizar: ele reaplica o baseline e planta, nas tabelas
novas, as travas do modo somente leitura do suporte e as permissões que antes ficavam de fora.
