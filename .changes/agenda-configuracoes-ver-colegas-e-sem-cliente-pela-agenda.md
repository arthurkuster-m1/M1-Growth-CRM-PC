---
impacto: exige_acao
secao: alterado
titulo: Configurações da Agenda mais claras, "ver a agenda dos colegas" e fim de "Clientes pela agenda"
---

Em Configurações › Agenda: a regra de resultado da reunião ganhou textos que explicam que vale
para depois da reunião; o campo que soltava sozinho o horário de um pedido não confirmado saiu (se
for preciso soltar, o atendente cancela à mão); a opção "Clientes pela agenda" foi removida —
cliente é quem tem venda. Nova opção "Atendentes podem ver a agenda dos colegas": desligada, cada
atendente vê só a própria agenda e gerentes e administradores veem todas. As duas opções da agenda
dos colegas passam a ser só do administrador.

## Requer atenção

Atualize o banco: a migration 0671 cria a opção de ver a agenda dos colegas e desliga "Clientes pela
agenda" nas organizações que a tinham ligada (o `update.sh` aplica o `baseline.sql`). As etiquetas
"cliente" já gravadas continuam nos contatos; só deixam de ser criadas novas.
