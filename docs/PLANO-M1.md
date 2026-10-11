# PLANO DO M1 GROWTH CRM

Atualizado em 11/10/2026. Este é o plano-mãe. O plano detalhado da aba Marketing continua em
`docs/PLANO-MARKETING-M1.md` (histórico). Os itens abaixo não precisam seguir a ordem: vamos
trabalhando em cima, conforme a prioridade do Arthur.

## 1. HISTÓRICO — o que já foi feito

### Tarefas
- Tabela estilo Notion (propriedades, filtros, agrupamento, ordenação, edição em massa), quadro,
  visualizações salvas e compartilhadas, modelos de tarefa e tarefas repetidas, data estilo Notion.
- Ligada ao Início; tela antiga de tarefas do CRM removida.

### Infraestrutura e acesso
- App no ar em https://www.infra-assessoria-m1.cloud (Caddy → Next.js, serviço `m1-app`).
- **Deploy pelo GitHub:** `git push` → build no GitHub (~2 min) → a VPS puxa e ativa (~20 s), com
  volta automática. Workflows e testes herdados do projeto original removidos.
- WhatsApp (WAHA + Redis) preparado em Docker; Google Agenda ligada (OAuth).
- Login com Google ligado; e-mails de acesso em português (modelos do próprio app), enviados pelo
  Brevo com o domínio próprio; confirmação de e-mail religada.
- PWA com ícone próprio.

### Marketing (aba completa)
- Painel (hub) e menu: Início, Tarefas, Marketing, Atendimento.
- Motor de páginas: blocos (título, texto, lista, cartões, números, antes/depois, paleta, links,
  citação, imagem, imagem+texto, pirâmide/funil, fluxo, matriz SWOT, ficha, tabela, calculadora da
  meta, oferta), modo Página e Apresentar, rascunho/publicado, histórico manual, publicação em
  massa, link sem login com navegação, "ver como cliente", abre em "Ver página" quando publicada.
- Diagnóstico: Mapeamento do funil, Posicionamento, Branding.
- Produto e oferta: Estudo de persona (5 subpáginas), Análise de concorrência (modelo enxuto +
  5 concorrentes), Planejamento empresarial (enxuto, com calculadora).
- **Produtos e ofertas = única fonte de produto e preço da IA.** Oferta publicada vira produto no
  catálogo que a IA consulta; imagens/cartão-resumo enviados junto; escada de valor manual +
  automática. Tela antiga de catálogo removida.
- Prompts do método salvos em `docs/metodo-m1-referencia/`.
- **Cronograma do cliente** (frente 2, no ar): metas com tipo (R$, quantidade com unidade, %) e
  barra de progresso; fases em seta com várias ações-chave dentro; gráfico em janela de semanas
  que anda para sempre (setas ou arrastando), com arquivar concluídas; tarefas da semana
  (agência × cliente) vindas da base de Tarefas; histórico com o motivo dos adiamentos; fechar a
  semana; imagem baixável e link sem login nos temas claro e escuro (usa os tokens do app);
  semana começa no domingo; seletor de data em português. Coluna "Cronograma" na tela de
  Tarefas (gestão) e card na galeria pública: feitos.
- **Redução do Log Ingestion do Supabase** (feito no código): login conferido localmente
  (`getClaims`, sem ir ao Supabase a cada requisição), memória de 20 s para permissões e contexto
  de suporte, polling do Inbox espaçado. Conferir o consumo depois de alguns dias.

## 2. PEQUENOS AJUSTES PENDENTES

| Item | Situação |
|---|---|
| Páginas legais (política de privacidade e termos) | **Quase pronto.** Texto com o operador "Assessoria M1", seção do login com Google e links no login/cadastro estão no ar. Falta: e-mail público de contato (`LGPD_DPO_EMAIL`), CNPJ (`OPERADOR_CNPJ`, opcional) e o Arthur enviar o app para verificação no Google Cloud |
| Publicar as ofertas da Assessoria M1 | **Feito** (publicadas e sincronizadas com o catálogo da IA) |
| Nome da fase 02 ("Produto e Oferta") | **Decidido: "Mercado e Oferta"** |
| Religar a confirmação de e-mail no cadastro | **Feito** |
| Pendências antigas do menu: nome "Dono" → nome real, seletor de empresa, redirecionamento pós-onboarding | **Manter** (fazer junto da frente 12/14) |
| Oferta de teste `vfap33` (R$ 15,00) | **Manter por enquanto** — tudo cadastrado é teste; o Arthur revisa tudo quando o app for finalizado |
| Página `onboarding` antiga publicada | **Feito** (apagada, com o rascunho e o link) |

## 3. O PLANO (15 frentes, sem ordem fixa)

1. **Dashboards atualizados — tudo em um lugar só.** Reunir tráfego (Meta/Google), vendas,
   faturamento e a meta × realizado do Planejamento. Hoje existem `/app/metrics`, `/app/ads/meta`,
   `/app/faturamento` e o placeholder de Marketing.
2. **Cronograma.** O Arthur já tem o HTML pronto: adaptar ao motor de tarefas (dono = agência ou
   cliente; visão semanal).
3. **IA ajudante.** Rascunho de página a partir do Kick Off e dos prompts do método
   (precisa de chave de IA). Botão "Gerar rascunho" nas páginas.
4. **Geração de demanda.** Registro de campanhas, criativos e textos com status; o Arthur tem uma
   base e quer estruturar melhor.
5. **Inbox.** Ajustes visuais e conexões com outros bancos (detalhar "outros bancos").
6. **Equipe.** Pessoas, papéis e interface por empresa.
7. **Prospecção.** Scraping de leads + campanhas de disparo automático (API oficial e não oficial)
   com análise de dados automática por ação e por mensagem. Base existente: `/app/prospecting`.
8. **CRM — o mais trabalhoso.** Visualizações + funis + base de leads + base de vendas + conexão com
   dashboards + trackeamento impecável + disparos de CAPI + movimentação automática de leads
   (estilo Tintim). Cuidado: leads alimentam Inbox, automações, follow-up, IA e webhooks.
9. **Conexões e webhooks.** Formulários e landing pages do Arthur entrando como leads.
10. **Agenda.** Ajustes visuais e de UX.
11. **Agentes de IA.** Revisar agentes e a fonte de conhecimento (ofertas já alimentam o catálogo).
12. **Configurações gerais.**
13. **Barra de pesquisa.** Evoluir a paleta de comandos (⌘K).
14. **Visão multi-tenant de ADM.** Organização e visualizações (área `/admin`).
15. **Gestão financeira completa.** Contas, fluxo de caixa, DRE, recorrência (hoje há `/app/faturamento`).

### Ligações entre as frentes
- 8 (CRM) alimenta 1 (dashboards), 7 (prospecção) e 9 (conexões): vale desenhar o modelo de lead e
  de venda antes de mexer em cada um.
- 3 (IA ajudante) melhora depois de 1 (números reais para citar).
- 15 (financeiro) e 8 (base de vendas) compartilham a mesma fonte de venda/receita.

## 4. FECHAMENTO DO PROJETO (depois dos planos)
1. Limpeza total do que veio do projeto original (docs, testes e2e, instalador, imagem Docker,
   pastas e volumes antigos, linhas de cron apontando para pasta inexistente).
2. Instalador (`instalar-vps.sh`) e roteiro de migração para a VPS nova; testar em VPS limpa;
   migrar com o atual no ar. Antes: cópia segura do `.env.local` (chaves que cifram dados do banco).
