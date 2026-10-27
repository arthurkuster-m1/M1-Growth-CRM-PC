# PLANO DE REDES SOCIAIS

Registrado em 28/10/2026. **Só plano: nada disto foi construído.** A execução começa depois, em
outras sessões. Decisão do Arthur: **sem parceiros externos** — tudo direto pelas APIs oficiais da
Meta (Instagram e Facebook) e do Google (YouTube). TikTok fica para depois dessas duas.

## 1. Onde estamos hoje

- Conexões > **Redes sociais** funciona por um intermediário externo (Zernio): cola-se a chave dele,
  escolhe-se o perfil e autoriza-se cada rede. Código em `lib/channels/social/` e
  `app/api/v1/channels/social`, tela em `components/connections/RedesSociaisClient.tsx`.
- Só **Instagram e Facebook** recebem mensagens na Inbox por esse caminho. As outras 13 redes do
  catálogo só ficam vinculadas, sem receber nem publicar.
- Não existe hoje: analisar posts, responder comentários, programar ou publicar posts.
- Já temos um app da Meta (`META_APP_ID`) usado pelo WhatsApp oficial e pelo Meta Ads, e OAuth do
  Google (Agenda e Ads). Falta o projeto/credenciais do YouTube.

## 2. Ordem de execução (decidida)

1. **Análise de dados** (posts, alcance, engajamento) → números nos Dashboards.
2. **Responder DMs** (Instagram e Messenger) → reaproveita a Inbox.
3. **Responder comentários** (Instagram, Facebook, YouTube).
4. **Programar e publicar posts** (Instagram, Facebook; YouTube por último).

Antes de tudo, uma **fundação** comum (seção 4).

## 3. O que cada API oficial oferece

### Meta (Instagram e Facebook)

| Capacidade | API | Observações |
|---|---|---|
| Insights de posts e conta | API de insights do Instagram e das páginas | Alcance, engajamento, salvamentos. Conta Business ou Creator ligada a uma página do Facebook. |
| DMs | API de mensagens do Instagram e do Messenger | Só chegam mensagens de quem escreveu primeiro. Resposta livre dentro de 24 h (extensão a 7 dias em alguns casos). |
| Comentários | API de comentários do Instagram e do Facebook | Recebidos por webhook. |
| Publicar | API de publicação do Instagram (feed, Reels, Stories) | Fluxo criar-e-publicar, com limite diário de publicações; a agenda fica no CRM, que dispara na hora. Facebook tem agendamento nativo na página. |

Exigências: login do Facebook (OAuth) por empresa; **revisão do app pela Meta** para cada permissão
(com vídeo de uso); verificação do negócio; política de privacidade e exclusão de dados públicas. Em
desenvolvimento só funcionam contas de testadores — dá para construir e testar sem aprovação. A
revisão leva de dias a semanas e é a maior incerteza de prazo.

### YouTube (Google)

| Capacidade | API | Observações |
|---|---|---|
| Métricas de vídeos e canal | YouTube Data API + YouTube Analytics API | Visualizações, retenção, inscritos, receita. |
| Comentários | YouTube Data API | Não há DM no YouTube. |
| Publicar / agendar | YouTube Data API (envio de vídeo, data de publicação) | Envio gasta muita cota diária; o vídeo sobe privado e vira público na hora marcada. |

Exigências: projeto próprio no Google Cloud; verificação do app (permissões sensíveis); **auditoria
de conformidade do YouTube** para vídeos públicos (sem ela saem privados); pedido de aumento de
cota para uso em escala.

### TikTok (depois)

API oficial própria; a publicação exige auditoria à parte (sem ela, posts privados).

## 4. Fundação (primeira entrega, antes das fases)

- Entrar com o Facebook, conectar página e conta do Instagram, guardar tokens com segurança
  (cifrados), renovar e detectar expiração/reconexão.
- Tabela de contas sociais por organização (RLS), com estado de saúde e permissões concedidas.
- Webhooks da Meta (verificação + assinatura) para DMs e comentários.
- A tela Redes sociais passa a mostrar só o que funciona de verdade, e sai da dependência do
  intermediário atual (migração das contas já vinculadas).
- Modo de desenvolvimento primeiro (testadores), em paralelo ao pedido de revisão da Meta.

## 5. Fases

| Fase | Entrega | Depende de |
|---|---|---|
| 0 | Fundação (seção 4) | App Meta, páginas de privacidade |
| 1 | Análise: insights de Instagram/Facebook + métricas do YouTube; painel nos Dashboards | Permissões de insights (Meta) e escopo de leitura (Google) |
| 2 | DMs do Instagram e do Messenger na Inbox, com resposta | Revisão das permissões de mensagens |
| 3 | Comentários: ver e responder (Instagram, Facebook, YouTube) | Webhook de comentários; cota do YouTube |
| 4 | Programar e publicar posts (Instagram, Facebook; YouTube depois) | Revisão de publicação; auditoria do YouTube |

Cada fase segue as doutrinas do projeto: migration + baseline, RLS por organização, auditoria das
mutações, prova pela tela e registro no roteiro de testes.

## 6. Decisões e pendências do Arthur

- [ ] Reaproveitar o app da Meta atual ou criar outro só para redes sociais (separar isola a revisão
  do WhatsApp).
- [ ] A empresa já tem verificação de negócio na Meta e página pública de política de privacidade?
- [ ] Projeto no Google Cloud para o YouTube (já existe um?).
- [ ] O que acontece com as contas já vinculadas pelo intermediário atual na migração.

## 7. Riscos

- Prazo da revisão da Meta e da auditoria do YouTube (fora do nosso controle).
- Cota do YouTube e limite diário de publicações do Instagram restringem a programação.
- Tokens da Meta expiram: sem renovação e aviso de reconexão, a conta some em silêncio.
- DMs só dentro da janela de 24 h; fora dela, só o que a Meta permitir.
