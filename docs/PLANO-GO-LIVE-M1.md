# Plano de go-live do M1 Growth CRM (colocar para rodar com clientes reais)

Criado em 01/11/2026. É o plano de **operação**: o produto já tem funcionalidade de sobra, o que falta para
atender cliente real é infraestrutura, segurança dos dados e prova de uso. Ligado à frente 18 do
`docs/PLANO-M1.md`. Quem faz cada item: **[A]** Arthur (precisa de conta, cartão ou decisão),
**[C]** Claude (código, scripts e conferências).

Regra: não abrir para cliente antes das fases 1 a 3 estarem marcadas. A fase 4 (piloto) é o teste de verdade.

## Fase 1 — Dados e segurança (bloqueia tudo)

- [ ] **[A]** Criar um projeto Supabase de **produção** (região sa-east-1), separado do de teste, em plano **Pro**
      (backup diário e sem pausa por inatividade). Avaliar o complemento de recuperação a qualquer momento (PITR).
- [ ] **[C]** Aplicar o `supabase/baseline.sql` no projeto novo e rodar `bootstrap-owner` (o que o `install.sh` faz),
      com `ON_ERROR_STOP=1`, e conferir o isolamento entre organizações (RLS) com os testes de invariantes.
- [ ] **[A]** Gerar chaves e senhas **novas** (as de teste foram coladas em chat): Supabase (anon, service role,
      senha do banco), chave de cifra dos segredos (`NUVEMSHOP_OAUTH_ENCRYPTION_KEY`), chave da WAHA, `.env` de produção
      só na VPS, nunca no GitHub.
- [ ] **[C]** Roteiro de **restauração**: script que faz `pg_dump` diário para um armazenamento externo
      (Cloudflare R2 ou Backblaze B2) e um teste de restaurar num banco descartável. Backup que nunca foi
      restaurado não conta como backup.
- [ ] **[A]** Google Cloud: acompanhar a verificação do app (hoje em modo teste só aceita e-mails cadastrados à mão).
      Sem ela, cliente novo não conecta a Agenda do Google.
- [ ] **[C]** Revisar permissões: quem é `admin`, `manager`, `agent` e `viewer` em cada tela do Modo agência, e
      confirmar que o cliente nunca vê dados da agência nem de outro cliente.

## Fase 2 — Servidor estável

- [ ] **[A]** Contratar a VPS recomendada abaixo (datacenter no Brasil) e apontar o domínio (DNS).
- [ ] **[C]** Instalador `instalar-vps.sh` / roteiro de migração para a VPS nova: Caddy (HTTPS automático),
      serviço `systemd` do app, `worker` e `scheduler`, Redis, WAHA, firewall, swap e atualização por
      imagem publicada (o fluxo atual `build-m1` → release → `m1-puxar-build.timer`).
- [ ] **[C]** **Auditar as rotinas em segundo plano** (cron): listar tudo o que o `scheduler` deveria chamar
      (lembretes de compromisso, follow-up, sincronia da Agenda, parcelas vencidas, retenção, recuperar mensagens
      travadas) e confirmar uma a uma que está agendada e executando na VPS. Hoje o contexto avisa que só parte roda.
- [ ] **[A]** Criar monitor externo de queda (UptimeRobot, gratuito) apontando para `/api/v1/health`, com aviso no
      seu celular. **[C]** Ligar o Sentry (envio de erros) com os dados sanitizados.
- [ ] **[C]** Ensaio de recuperação: reiniciar a VPS e conferir que tudo volta sozinho (app, WAHA, Redis, crons).

## Fase 3 — WhatsApp e canais

- [ ] **[A]** Decidir o WhatsApp: **WAHA Plus** (pago, vários números, mesmo risco de banimento) ou **API oficial da
      Meta** (custo por conversa, sem risco de banimento, exige templates e aprovação). Vale a oficial para os
      disparos e o WAHA só para atendimento, se o custo permitir.
- [ ] **[C]** Anti-banimento ligado e conferido: limite de envio, janela 7h–22h, aquecimento do número, opt-out.
- [ ] **[A]** Chave de IA (Vercel AI Gateway) com **limite de gasto** configurado, para um cliente não estourar o custo.
- [ ] **[C]** Conferir o e-mail transacional (Resend ou SMTP): convite, confirmação de cadastro e recuperação de senha
      chegando na caixa de entrada, não no spam.

## Fase 4 — Piloto (a prova de verdade)

- [ ] **[A]** Escolher **1 ou 2 clientes de confiança** e rodar 2 semanas sem cobrar.
- [ ] **[C]** Percurso de cliente novo do zero, pela tela, em ambiente limpo: criar conta, onboarding, conectar o
      WhatsApp, primeiro lead, primeira venda, convidar alguém. Registrar os achados em `docs/testing/user-journey-map.md`.
- [ ] **[A]** Diário de problemas do piloto (print + o que esperava). **[C]** Corrigir na causa, no mesmo dia.
- [ ] Critério para seguir: nenhum erro de dado cruzado entre clientes, nenhuma queda sem aviso, backup restaurado
      com sucesso pelo menos uma vez.

## Fase 5 — Abrir para os demais

- [ ] **[C]** Visão de todos os clientes no `/admin` (frente 14): quem usa, quem parou, quem está com erro,
      consumo de IA e de WhatsApp por cliente.
- [ ] **[A]** Termos de uso, política de privacidade e contrato com cláusula de LGPD (as páginas públicas já existem;
      falta o contrato comercial e o DPO).
- [ ] **[A]** Definir cobrança (Stripe, Asaas ou Pix recorrente) e o que acontece quando o cliente para de pagar.
- [ ] **[C]** Rotina de atualização sem parada: aviso, janela e volta atrás automática (já existe no `puxar-build`).

## Fica para depois do lançamento

IA ajudante (frente 3), barra de pesquisa (13), configurações gerais (12), financeiro completo (15), Hotmart, Lead Ads
nativo e eventos de CAPI. Nenhum bloqueia o uso diário; entram por demanda dos clientes do piloto.

---

## Recomendação de VPS

**Princípio:** o **banco fica no Supabase** (não na VPS) e o app é construído no GitHub, então a VPS só executa. O que
pesa de verdade é o **WhatsApp**: cada número conectado na WAHA consome memória própria (na casa de 300 a 500 MB cada,
a conferir na prática), e é isso que decide o tamanho.

| Estágio | Clientes / números | Configuração | Observação |
| --- | --- | --- | --- |
| **Piloto** | 1–2 clientes, até 3 números | **4 vCPU, 8 GB RAM, 80–100 GB NVMe** | A VPS atual (2 núcleos, 7,8 GB) aguenta o piloto se o build continuar no GitHub; o gargalo é CPU quando vários atendem ao mesmo tempo. |
| **Operação** (recomendado para começar de verdade) | 5–10 clientes, até ~8 números | **4–6 vCPU, 16 GB RAM, 160 GB NVMe** | Folga para a WAHA, o worker e picos. É o ponto de partida que eu contrataria. |
| **Crescimento** | 10–30 clientes, 10+ números | **WAHA em uma VPS própria** (4 vCPU, 8 GB) + app em outra (4 vCPU, 8 GB) | Separar evita que um número travado derrube o app. Mais de um nó WAHA também diminui o risco de banimento em cascata. |

Detalhes que importam mais que o tamanho:

1. **Datacenter no Brasil** (São Paulo). O banco está em sa-east-1; um servidor na Europa adiciona cerca de 200 ms em cada
   consulta e deixa o app visivelmente lento. Por isso eu descartaria opções baratas só europeias.
2. **Sistema:** Ubuntu 24.04 LTS, com atualizações de segurança automáticas, **swap de 2 a 4 GB** (rede de segurança, não
   para o dia a dia) e disco **NVMe**.
3. **Firewall:** abrir só 22 (SSH, só com chave, sem senha), 80 e 443. WAHA, Redis e o app ficam em `localhost`; só o
   Caddy fala com a internet.
4. **Backup da VPS:** snapshot semanal do provedor (custa pouco) **mais** o backup do banco para fora, descrito na fase 1.
   O que está na VPS é reconstruível; os dados estão no Supabase.
5. **Custo de referência** (a confirmar no site de cada provedor, os preços variam): VPS de 4 vCPU/8 GB costuma ficar na
   faixa de R$ 80 a R$ 150 por mês e a de 16 GB, de R$ 150 a R$ 300; Supabase Pro, cerca de US$ 25 por mês.
6. **Quando subir de nível:** CPU acima de 70% por mais de 10 minutos, memória livre abaixo de 1,5 GB, ou mais de 6 números
   conectados.

**Minha recomendação final:** comece com **4 vCPU / 16 GB / 160 GB NVMe em São Paulo**. A diferença de preço para a de 8 GB
é pequena perto do custo de uma queda no meio do atendimento de um cliente, e você só precisa dividir o servidor em dois
quando passar de uns 10 números.
