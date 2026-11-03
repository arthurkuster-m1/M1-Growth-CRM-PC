# Novo onboarding do M1 — desenho e estado

Criado em 03/11/2026. O onboarding antigo (boas-vindas, WhatsApp, treinar a IA, funil, "ver ele atender", equipe) girava em torno de um
"funcionário de IA" e foi suspenso junto com a área de agentes. O novo é **curto e neutro**: deixa a empresa pronta para uso e entrega a pessoa
no app. Quem configura de verdade (funil, WhatsApp, Meta, equipe) é a agência, pelo plano MVP, não o dono do cliente.

## Quem passa por ele
- **Só o dono da empresa** (papel Adm), **na primeira entrada**, uma vez por empresa (`organizations.onboarded_at`).
- **Não** passam: funcionário que entra antes do dono, o **Super Adm da agência** olhando a empresa do cliente, e o modo acompanhamento.
- O dono recebe o convite criado em `/admin` › Tenants › Nova empresa (a empresa já nasce com o nome que você deu).

## As telas (feito em 03/11)
1. **Seu negócio** — nome da empresa (já vem preenchido), "O que vocês fazem? (opcional)", **fuso horário** e **aceite dos Termos de Uso e da Política de
   Privacidade** (obrigatório). Grava o nome, o fuso e a data do aceite.
2. **Sua equipe** — convidar pessoas por e-mail (opcional; dá para pular). Se o e-mail não estiver configurado, mostra o link de cada convite para copiar.
3. **Tudo pronto** — resumo (o que foi feito e o que foi pulado) e **Por onde começar**: Início, Clientes (CRM), Agenda e Tarefas. O botão "Começar a usar" marca a
   empresa como configurada e leva ao app.

## O que reaproveitei (testado) e o que ficou de lado
- Reaproveitei as ações de servidor já testadas: aceite (nome, fuso e Termos), convites e conclusão. Só troquei os textos e a ordem.
- Os passos antigos **continuam no código**, desligados por `lib/onboarding/suspenso.ts` (`ONBOARDING_ANTIGO_SUSPENSO`): WhatsApp, IA, funil e "ver ele atender".

## Para conversar amanhã (04/11) — o desenho é seu
> Guardadas aqui a pedido do Arthur; nada será alterado até a conversa.
1. **Mais algum dado** que o dono deveria dar logo no início (telefone, site, instagram, número de funcionários, meta de leads do mês)?
2. **Um passo de "conectar"** para o cliente (Google Agenda e Meta Ads) ou isso fica sempre com a agência?
3. **Tour guiado** de 30 segundos no Início (setas apontando as 4 telas) em vez do cartão "Por onde começar"?
4. **E o onboarding do próprio funcionário** (Membro) na primeira entrada: nada, ou um aviso curto de boas-vindas?
5. **Convite do dono com 24 h**: passar para **7 dias**?

## Pendências técnicas
- **Roteiro e2e**: `tests/e2e/vps-fresh-onboarding.spec.ts` (jornada J1, a P0 da instalação nova) está **suspenso (`describe.skip`)**, porque percorria o fluxo antigo. Reescrever para o fluxo novo e **rodar na stack completa** antes do go-live.
- O espanhol/inglês não são mais mantidos (o produto fala só português).
