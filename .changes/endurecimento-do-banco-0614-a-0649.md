---
impacto: nada_mudou
secao: corrigido
titulo: Endurecimento do banco nas tabelas e funções novas, e excluir uma organização com oportunidades volta a funcionar
---

Fecha o que as migrations 0614 a 0649 deixaram aberto: o acesso anônimo às tabelas novas, funções
que qualquer usuário logado conseguia chamar sem precisar (gatilhos e rotinas da lixeira), uma função
da agenda que não conferia a organização de quem chamava e sete funções sem caminho de busca fixo.
Também corrige a exclusão de uma organização que tinha oportunidades, que falhava por causa do
histórico do ciclo de vida. O `update.sh` aplica tudo sozinho.
