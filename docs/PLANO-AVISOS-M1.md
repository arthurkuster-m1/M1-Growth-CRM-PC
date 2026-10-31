# PLANO — Central de avisos, alertas e notificações

Criado em 31/10/2026 (pedido do Arthur). Plano à parte, frente 16 do `docs/PLANO-M1.md`.

## Como está hoje
- **Central de avisos** = tabela `agent_inbox_items` (~40 tipos: `handoff`, `budget_warning`, `appointment_outcome_required`,
  `message_send_stuck`, `qr_rescan`, `followup_dead`, `capabilities_missing`, parcelas vencidas — `other` com `ref_kind =
  parcelas_vencidas` —, etc.). Gravidade `info | warn | critical`; situação `open | ack | resolved`. 71 arquivos leem/escrevem.
- **Onde aparece:** menu **Agentes de IA › Alertas** (`/app/ai/inbox`, "O que a IA encontrou e precisa de uma decisão sua"),
  hoje dentro do grupo de IA — por isso quem não usa IA nem vê.
- **Sino do topo** (`AlertsBell`) e **notificações do navegador/celular** (mensagens, ligações, CRM; sons; Configurações ›
  Notificações) são outra camada, que não conversa com a Central.
- **Avisos que criamos nesta rodada:** parcelas vencidas (um por empresa, diário).

## O que revisar (checklist)
1. **Inventário:** listar os ~40 tipos, quem os cria, quando, e se ainda existe o fluxo por trás (alguns são de funcionalidades
   que o M1 não usa: WhatsApp oficial, propostas, voz...).
2. **Cada aviso:** texto em português claro, gravidade certa, o botão/ação (abre a tela certa?), quando se resolve sozinho,
   e se vira ruído (muito frequente) ou silêncio (nunca dispara).
3. **Destinatário:** hoje é da empresa toda; definir quem vê o quê (agência × cliente; atendente × gerente).
4. **Canais:** o que merece sino, push, e-mail; o que fica só na Central.
5. **Lugar:** tirar a Central de "Agentes de IA" — proposta: item próprio no menu (ou dentro do sino, com página cheia).
6. **Modo agência:** uma Central que junta os avisos de todos os clientes (hoje cada empresa tem a sua).
7. **Ruído:** agrupar avisos repetidos, "silenciar este tipo", resolver em massa.

## Proposta de desenho (para aprovar)
- Um só lugar: **sino → painel rápido** (últimos avisos, por gravidade) e **página "Avisos"** no menu principal (fora de IA),
  com filtros por tipo, gravidade, cliente e situação.
- Cada aviso: título, o que aconteceu, **uma ação** (abrir a tela certa) e "Resolver"/"Adiar".
- Preferências por pessoa: quais tipos notificar e por qual canal (substitui a tela de Notificações solta).

## Perguntas para o Arthur
1. Quais avisos você considera essenciais hoje? Quais pode apagar?
2. A página "Avisos" fica no menu principal ou só no sino?
3. No Modo agência: uma Central única de todos os clientes, ou uma por cliente?
4. Quer aviso por e-mail ou WhatsApp para algum tipo (ex.: parcela vencida, verba estourando)?
