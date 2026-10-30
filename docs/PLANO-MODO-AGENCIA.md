# Plano — Modo agência (gestão multi-cliente)

> Pedido do Arthur (30/10/2026). Ele usa o M1 Growth no dia a dia para gerir todos os clientes
> cadastrados como organização: cronograma e tarefas da semana, campanhas, dashboards e tarefas
> da agência, tudo numa visão só, trocando de cliente rápido, sem entrar no perfil de cada um.

## O que já existe (e vamos reaproveitar)
- **Organizações e acesso:** `user_organizations` (papel por organização) + `fn_user_org_ids()` na RLS. Quem é
  membro de várias organizações já lê todas com o mesmo cliente do usuário. Super-admin da plataforma
  (`platform_admins`) enxerga todas.
- **Troca de organização:** `TenantSwitcher` ("Gerenciar organizações"), que recarrega a tela na organização escolhida.
- **Cronograma do cliente:** geral + tarefas da semana (`CronogramaDoCliente`), com a **autoavaliação da semana**
  (nota 0–100 + tópicos; `AutoavaliacaoDaSemana`, só da agência) já pronta.
- **Campanhas de demanda:** `demand_campaigns` com verba, datas, metas e sincronia com o Meta (`demand_campaign_days`).
- **Dashboards** de Marketing e **Tarefas** com a opção "da agência / do cliente".

## O que muda (decisões de desenho)
1. **"Modo agência" é um modo de visualização**, aberto pelo seletor de organização. Mesma barra lateral; Campanhas,
   Dashboards, Cronograma e Tarefas passam a ler **várias organizações ao mesmo tempo**.
2. **Seletor de clientes** ao lado do seletor de empresa, igual ao seletor de campanhas do CRM: um, dois ou todos.
   A escolha fica salva por pessoa.
3. **Quem pode ver o quê = quem é membro.** Acesso do gestor a um cliente = linha em `user_organizations` (papel
   admin/manager). Não criamos uma camada de permissão paralela: a RLS atual já vale para a leitura de várias
   organizações. "Os 5 clientes do gestor de tráfego" = as 5 organizações em que ele é membro; ele escolhe, dessas,
   quais ver no momento. O super-admin vê todas.
4. **Escrita em outra organização** só por rota que recebe `organization_id` explícito e o **valida contra a
   associação do usuário** (nunca confia no corpo). Helper único: `requireAgencyOrg(orgId)`.
5. **Lu Bronze (sem Inbox/CRM):** configuração por organização "Origem dos leads" = `crm` (padrão) ou `meta`
   (conversas iniciadas do gerenciador de anúncios). Com `meta`, leads e CPL das campanhas vêm do Meta.

## Fases (cada uma é um PR que o Arthur valida antes da próxima)
**F0 — Fundação.** Marca da organização da agência, seletor de clientes (multi-seleção com busca), preferência
salva por pessoa, entrada "Modo agência" no menu de organizações, helper `requireAgencyOrg`, e a configuração
"Origem dos leads" por organização.

**F1 — Campanhas de todos os clientes.** Lista agrupada por cliente (como a tabela do Notion que ele usa): prazo
restante, leads, CPL, investido × verba total, com abertura da campanha em página própria. Criar/editar campanha
de qualquer cliente selecionado. Lu Bronze com leads do Meta.

**F2 — Cronograma e tarefas da semana de todos os clientes.** Uma tela, escolhe o cliente (troca sem recarregar)
e edita no lugar. Visão "todas as semanas de todos os projetos". A autoavaliação da semana (0–100% + tópicos)
fica embaixo, só para a agência.

**F3 — Dashboards com troca rápida de cliente.** Mesmos dashboards, com botão de troca de cliente sem entrar no perfil.

**F4 — Tarefas da agência.** Tudo o que está marcado "da agência" nas tarefas da semana dos clientes
selecionados aparece na minha barra de Tarefas, com o cliente indicado.

**F5 — Delegação.** Tela para o super-admin escolher quais organizações cada pessoa da equipe gere (cria/remove
a associação com o papel), e cada pessoa escolher, dentre as dela, o que ver agora.

## Fora do escopo por enquanto
Cobrança por cliente, relatório em PDF para o cliente, e papéis novos além dos quatro atuais.

## Perguntas em aberto
- Aceitar "acesso = associação à organização" (item 3)? É mais simples e seguro; a alternativa é uma camada de
  permissão de agência separada (mais trabalho, mais pontos de falha).
- Ordem das fases: a sugerida começa por Campanhas (F1) por ser o uso diário.
