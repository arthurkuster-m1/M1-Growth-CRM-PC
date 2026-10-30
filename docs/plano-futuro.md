# Plano futuro (coisas decididas, ainda não oferecidas ao cliente)

Itens que existem no código mas estão **escondidos da visão do cliente** por decisão do dono do produto,
até serem estudados e entrarem no plano de verdade.

## Trunk SIP (voz por IA)

- **Estado:** a tela (`/app/settings/voip-trunk`) e a rota continuam no código, mas a porta saiu do menu
  de Configurações e da busca (⌘K). Só se chega por endereço.
- **Por quê:** o dono quer oferecer isso no futuro, mas ainda não sabe como vai funcionar para o cliente.
- **Para estudar:** como o cliente contrata o provedor SIP, o que a IA faz na chamada, custo por minuto e
  o que o servidor precisa ter (hoje o recurso aparece em "Recursos opcionais" como "Tronco SIP", desligado).
- **Para voltar a mostrar:** devolver a entrada `/app/settings/voip-trunk` ao `lib/navigation/catalogo.ts`
  (grupo `organizacao`, seção "Dados e acesso") e tirar a linha correspondente da allowlist de
  `tests/unit/navegacao-completude.test.ts`.
