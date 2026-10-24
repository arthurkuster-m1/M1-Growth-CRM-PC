---
impacto: capacidade_nova
secao: adicionado
titulo: Importar leads e extração em modo volume dentro da campanha de prospecção, com registro de todos os lotes
---

Na página Extração de leads da campanha de Prospecção:

- **Importar leads:** suba uma planilha (CSV), veja a prévia (quantos são novos, já estão no CRM,
  repetidos na planilha ou foram recusados) e só então confirme. Os leads entram no funil da
  campanha, já ligados a ela e com o nome do arquivo na origem.
- **Extração em modo volume:** ao lado da extração completa, o modo volume busca o máximo de
  empresas possível (até 500 e US$ 25 por busca), sem enriquecer com e-mails e redes. A completa
  segue com os limites de sempre (100 empresas, US$ 10).
- **Registro:** uma tabela no fim da página guarda toda extração e toda importação da campanha,
  com a data, os termos (ou o arquivo), a cidade, o resultado e o custo.

A caixa de seleção "Enriquecer…" e as da lista de empresas passam a ser redondas, como no resto
do sistema.

Atualização: aplica a migration 0657 (tabela das importações) pelo `update.sh`.
