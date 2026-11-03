# Inventário da limpeza — para o Arthur aprovar (fase 2 do plano MVP)

Gerado em 03/11/2026. **Nada foi apagado.** Este documento lista o que eu proponho tirar, o que proponho manter e o que preciso que você decida.
Os números vêm do git (arquivos e linhas versionados) e de busca por referências no código; **não medi uso real** (não há telemetria de tela),
então tudo que é "de funcionalidade" passa por você.

## Como ler
- **Apagar** = proponho remover, sem risco para o MVP. **Perguntar** = depende de você. **Manter** = fica (frente do plano, lei ou necessário).
- **Limpar não deixa o app mais rápido por si só** (código sem uso quase não pesa na execução) e **não encolhe o histórico do GitHub** (o histórico guarda tudo,
  o que também significa que **qualquer coisa apagada dá para recuperar**). Os ganhos reais são: repositório menor e mais fácil de entender, build
  e testes mais curtos, menos coisa para a IA e para você se perder, e menos superfície de erro e de segurança.
- A limpeza será em **lotes pequenos, um PR por lote**, com `typecheck` e testes verdes, e **você aprova cada lote antes**.

## Panorama (o que o repositório tem hoje)
| Parte | Arquivos | Linhas | Observação |
| --- | --- | --- | --- |
| Código do app (`app`, `components`, `lib`, `hooks`, `workers`) | ~3.970 | ~690 mil | O produto de verdade |
| Testes (`tests`) | 2.010 | 416 mil | Cercas e provas; ficam, mas saem os de funcionalidade removida |
| Documentos (`docs`) | 353 | 187 mil | Muita herança do projeto original |
| **Evidências (`evidence`)** | **829** | 357 mil | **~94 MB de capturas e rastros** de rodadas do projeto original |
| Banco (`supabase`) | 556 | 128 mil | Baseline + migrations: **não mexer** |
| Instalação e scripts (`hostgator-setup-kit`, `scripts`, `deploy`, `infra`, `docker`…) | ~160 | ~35 mil | Parte é herança, parte é a nossa |
| Processo do projeto original (`triagem`, `loop`, `.agents`, `.claude`, `plan`, `tasks`…) | ~170 | ~25 mil | Triagem de PR de contribuidor, "gov-loop" |

---

## Lote 1 — Peso morto, sem risco (proponho APAGAR já)
Não roda no app nem na instalação.

| Item | O que é | Tamanho | Recomendação |
| --- | --- | --- | --- |
| `evidence/` das rodadas antigas | Capturas e rastros de triagens e funcionalidades do projeto original (`triagem-*`, `ia-360-*`, `comunidade-360`, `casos-vivos`, `canais`, `wave3-pulso`…) | ~94 MB, ~830 arquivos | **Apagar** quase tudo. **Manter** só o que for da M1 (ex.: `calendario`, `automacoes-de-tag`, `ficha-do-inbox`, `celular-quase-nativo-20261005`) — me diga se quer guardar mais |
| Traduções | `README.en.md`, `README.es.md`, `CONTRIBUTING.en.md`, `docs/white-label.en/es.md` | 5 arquivos | **Apagar** (o produto fala só português) |
| Docs herdados | `docs/handoffs` (30), `docs/superpowers` (50), `docs/stories` (16), `docs/research` (22), `docs/evidence` (21), `docs/presentation`, `docs/decola-ai`, `docs/growth`, `docs/handoff`, `docs/deploy-hostgator`, `docs/design` | ~170 arquivos | **Apagar**. **Manter:** `PLANO-*`, `GUIA-*`, `MODELO-*`, `ROTEIRO-*`, `INVENTARIO-*`, `CONTEXTO-M1.md`, `metodo-m1-referencia`, `testing`, `doctrine`, `adr`, `current-state`, `threat-model`, `runbooks` (limpando o que for de HostGator) |
| Relatórios soltos | `RELATORIO-W1-GATILHOS.md`, `docs/vendaval-*`, `docs/alertas-de-seguranca-triados.md`, `docs/audits` | poucos | **Apagar** |
| Pastas de experimento | `experiments/`, `extensoes/` (catálogo demonstrativo), `plan/`, `tasks/` | ~600 KB | **Apagar** (conferir antes que `extensoes/` não é lido pelo catálogo de extensões do app) |

## Lote 2 — Processo do projeto original (proponho APAGAR; reescrevo o que for útil)
Era o fluxo de quem **contribui** com o DeskcommCRM. Num fork seu, com você e eu, não faz sentido.

| Item | O que é | Recomendação |
| --- | --- | --- |
| `triagem/` (23 arquivos) | Manual de triagem de PR de contribuidor | **Apagar** |
| `loop/` (42 arquivos) | "gov-loop": sessões automáticas de governança de atendimento | **Apagar** |
| `.agents/` e `.claude/skills/` (cerca de 110 arquivos) | Guias e skills do projeto original (`triagem-de-pr`, `deskcomm-contribuir`, `deskcomm-gov-loop`, instalar, cliente-novo, métricas, prompt…) | **Apagar** os de contribuição/triagem. **Reescrever** 2 ou 3 guias nossos (doutrina do M1 e como operar) no lugar |
| `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `.github/ISSUE_TEMPLATE`, `.github/PULL_REQUEST_TEMPLATE.md`, `dependabot.yml` | Comunidade e contribuidores | **Apagar** (manter `SECURITY.md` ajustado) |
| `AGENTS.md`, `CLAUDE.md`, `ARCHITECTURE.md`, `VISION.md` | Doutrina e visão do projeto original | **Manter e reescrever** depois da limpeza: `CLAUDE.md` e `CONTEXTO-M1.md` guiam as sessões; `VISION.md` fala em open source/HostGator |

## Lote 3 — Telas e funções fora do foco da M1 (a maioria eu perguntaria)
Código do app. "Links de fora" = quantas vezes o resto do app aponta para a tela.

| Item | Tamanho | Situação | Minha recomendação |
| --- | --- | --- | --- |
| **Comandas** (`/app/comandas`, `lib/comandas`) | 21 arq., ~4,2 mil linhas | **Sem porta no menu, sem módulo, 0 links**: tela órfã de comércio/restaurante | **Apagar** |
| **Galeria do design system** (`/app/design-system`) | 2 arq., 717 linhas | Ferramenta de desenvolvedor, 0 links | **Apagar** |
| **Vitrine da Agenda** (`/vitrine-agenda`) | 2 arq. | Já marcada para sair no plano-mãe | **Apagar** |
| **Honorários** (módulo opcional) | 13 arq., ~2,2 mil linhas, 5 testes | Advocacia; módulo desligado | **Apagar** (se você não atende escritório de advocacia) |
| **Nuvemshop** (integração de loja) | 10 arq., ~1,5 mil linhas | E-commerce; a M1 não usa | **Perguntar:** algum cliente vende na Nuvemshop? Se não, **apagar** |
| **Redirects antigos** (`/app/activities`, `/analise`, `/metrics`, `/faturamento`, `/vendas`, `/leads`) | 6 arq. minúsculos | Só redirecionam para telas novas "por links salvos" | **Apagar** (instalação nova não tem link salvo) |
| **CRM B2B** (Empresas e Pessoas, módulo desligado) | 23 arq., ~2,9 mil linhas | Para vender a empresas | **Perguntar:** você vai usar "Empresas/Pessoas" no CRM? |
| **Banco externo / "outros bancos"** (`/app/integracao-dados`, `lib/external-db`) | 31 arq., ~4,3 mil linhas | Liga o CRM a um banco de dados do cliente | **Perguntar:** é o que você chamou de "conexões com outros bancos" no Inbox? Se não usa, **apagar** |
| **Voz e ligação por IA** (`voice-agent`, Asterisk, `lib/voip`, `lib/voice`, `/app/calls`) | 47 arq., ~6,2 mil linhas | Telefonia com agente de voz | **Perguntar:** você usa o botão **Ligar** do CRM? Se for só discador/WhatsApp, o agente de voz e o Asterisk saem |
| **Chamadas pelo WhatsApp** (`lib/wacalls`) | 12 arq., ~1,6 mil linhas | Ligação via WhatsApp | **Perguntar** (junto com a voz) |
| **Extensões** (catálogo, instalação, telas, `lib/extensions`) | ~114 arq., ~18,6 mil linhas | Plataforma de extensões declarativas | **Manter por ora**: a frente "módulos por nicho" pode usá-la; decidir quando desenharmos os módulos |
| **MCP** (CRM exposto como ferramentas) | 70 arq., ~15 mil linhas | Integração para IA e sistemas externos | **Manter** (frente de IA) |
| **LGPD** | 71 arq., ~14,8 mil linhas, 55 testes | Exportar e anonimizar dados | **Manter** (obrigação legal) |

## O que NÃO entra na limpeza
- **Área de IA (suspensa, não apagada):** `lib/agent-engine` (~35 mil linhas), `lib/ai` (~26 mil), `lib/escalacao`, `lib/propostas`, o servidor MCP. Voltam na próxima atualização.
- **Follow-ups e automações** (`lib/followup`, `lib/automation`): são a frente 19.
- **Banco** (`supabase/baseline.sql` e as 556 migrations): é a fonte da instalação nova. **Não apagar tabelas nem migrations.**
- **Cercas e testes dos gates** que protegem multi-tenant, auditoria, RLS e marca.

## Lote 4 — Instalação herdada (ADIAR até o instalador da M1 existir)
Hoje o plano usa o modo `single-server` do kit para subir na VPS Oracle. **Não apagar antes de a fase 3 ter terminado.**

| Item | O que é | Recomendação |
| --- | --- | --- |
| `hostgator-setup-kit/` (24 arq., ~13,5 mil linhas) | Instalador do projeto original (HostGator): `install`, `update`, `backup`, `restore`, `reset-password`… | **Adiar:** vira a base do instalador da M1; depois removo o que é de HostGator e traduzo o resto |
| `docker-compose.*.yml` (7 variantes), `Dockerfile*`, `Caddyfile*`, `ubuntu-*-installer.sh`, `desinstalar_docker.sh` | Formas de instalar | **Adiar:** na VPS ficam só as que usamos (single-server) |
| `infra/executor-proprio` | Máquina própria de CI do projeto original | **Apagar** (o CI da M1 é o GitHub) |
| `deploy/vps/` | **Nossa** instalação atual (serviço, build automático, rotinas) | **Manter** |

## Lote 5 — Dependências (medir antes de decidir)
Na hora da limpeza rodo `depcheck`/`knip` e listo **pacotes sem uso** (o gerenciador do projeto é o `pnpm`). Suspeitos: tudo que só a voz, a
Nuvemshop e as Comandas usavam. Resultado vem num lote próprio, com o tamanho do `node_modules` e da imagem antes e depois.

## O que cada lote entrega
| Lote | Mexe no app? | Risco | Ganho |
| --- | --- | --- | --- |
| 1 (peso morto) | Não | Nenhum | Repositório ~100 MB menor na árvore de trabalho; menos ruído |
| 2 (processo herdado) | Não | Baixo | Menos arquivos e skills confusos; `CLAUDE.md` mais claro |
| 3 (funcionalidades) | **Sim** | Médio (por isso testes e PR por item) | Menos código, build e testes mais curtos, menos telas "fantasma" |
| 4 (instalação) | Não | Médio | Só depois da VPS nova |
| 5 (dependências) | Sim | Baixo | Imagem e instalação menores |

## Ordem que eu sugiro
1. **Você aprova o Lote 1 e o 2** (não mexem no app) → eu executo no mesmo dia.
2. **Você responde as perguntas do Lote 3** → eu executo item a item.
3. Lote 5 (dependências) junto com o 3.
4. Lote 4 só depois da VPS nova.

## Perguntas para você (marque só o que quiser guardar)
1. **Evidências:** guardo só as 4 pastas da M1 listadas, ou quer outras?
2. **Ligar:** você usa o botão **Ligar** (telefonia) no CRM? E ligação por **WhatsApp**?
3. **Nuvemshop:** algum cliente vende por lá?
4. **Empresas e Pessoas (B2B):** vai usar?
5. **"Outros bancos"** (integração de dados): é o que você queria no Inbox, ou pode sair?
6. **Honorários** (advocacia): algum cliente desse tipo?
7. **Extensões:** manter como base dos módulos por nicho?
