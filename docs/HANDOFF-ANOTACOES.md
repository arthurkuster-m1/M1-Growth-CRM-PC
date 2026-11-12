# Handoff — módulo "Anotações" (bloco de notas estilo Notion)

> Para replicar este módulo em outro projeto. Origem: repositório `arthurkuster-m1/M1-Growth-CRM-PC`
> (branch `main`). Commits de referência, em ordem: `9f1d318` (A1: árvore, rotas, lixeira, menu) ·
> `7cff7c4` (editor BlockNote + subpáginas como cartões) · `74319a5` (seleção de várias linhas e
> cabeçalho de tabela) · `269e4c0` (blocos visuais) · `13aed06` (A2: busca, favoritos, recentes,
> Caixa de entrada). `git show <hash> --stat` mostra os arquivos de cada etapa.
>
> **Ignore** os arquivos `*anotacao*` de contatos/oportunidades/agenda (`app/api/v1/contacts/[id]/anotacoes`,
> `components/contacts/ficha/AnotacoesDoLead.tsx`, migrations 0502/0677/0678): são outra coisa, só têm o nome parecido.

## 1. O que o módulo é
Um bloco de notas por organização (empresa), em **páginas e subpáginas**, escrito num editor de
blocos igual ao Notion: página em branco onde se clica e escreve, `/` abre o menu de blocos, `+` na
lateral da linha faz o mesmo, alça para arrastar, selecionar várias linhas com o mouse. Serve para
guardar informação importante e para "jogar" coisas para analisar depois.

Existem duas portas para a mesma tela: a de cada cliente (`/app/anotacoes`, menu lateral logo abaixo
de Financeiro) e a do Modo Agência (`/app/agencia/anotacoes`, último item do menu, abaixo de
Configurações; guarda na organização ativa).

## 2. Decisões de desenho (não refazer sem motivo)
1. **Editor = BlockNote** (`@blocknote/core`, `@blocknote/react`, `@blocknote/mantine`, versão 0.57; licença
   MPL-2.0 — **não usar os pacotes `@blocknote/xl-*`**, que são GPL/pagos). Carregado com `next/dynamic`
   (`ssr: false`) só ao abrir uma página. Um editor próprio foi descartado: muito mais trabalho e pior.
2. **O documento é guardado como o BlockNote entrega** (lista de blocos) em `notes_pages.blocks` (jsonb).
   O servidor só valida o formato mínimo (cada bloco com `id` e `type`, até 3000 na raiz) e o banco
   limita o tamanho (400 KB). `lib/anotacoes/documento.ts`.
3. **Árvore por `parent_id`** + `position numeric` (ponto médio ao reordenar; renumera se a lacuna acabar).
   Um *trigger* de guarda no banco recusa pai de outra organização, ciclo e profundidade > 12.
4. **Subpágina = bloco-cartão** (`type: "subpagina"`, `props.pageId`) dentro do corpo da mãe, arrastável.
   Regras (todas no cliente, em `EditorDeNotas.tsx` + `documento.ts`):
   - ao abrir a mãe, os cartões são **ajustados às filhas vivas da árvore** (`ajustarCartoes`): tira cartão de
     página que não é mais filha/está na lixeira/repetido e acrescenta no fim um cartão para filha sem cartão;
   - a ordem dos cartões no texto **define a ordem da barra lateral** (atualiza `position`);
   - **apagar o cartão manda a subpágina para a lixeira** (com "Desfazer");
   - o título/ícone do cartão vem da árvore (contexto React), então renomear reflete na hora.
5. **Visibilidade por página** (`visible_to_client`, padrão `false`). A agência (papel `manager`+) lê e escreve
   tudo; os demais membros leem só o que está liberado e fora da lixeira. **Quem esconde é a RLS**, não a rota.
   Subpágina nova herda a visibilidade da mãe; há ação "liberar/esconder também as subpáginas".
6. **Lixeira** por `deleted_at` (a página e a subárvore, com o mesmo instante). Restaurar traz de volta quem foi
   junto; se a mãe continua apagada, a página volta para a raiz. "Apagar de vez" só vale para o que já está na
   lixeira.
7. **Autosave** após 900 ms de pausa e ao sair da página (`hooks/anotacoes/useNota.ts`). Sem rascunho/publicar.
   Gravar conteúdo/título **não audita** (encheria o log); mover, visibilidade, lixeira, restaurar, apagar,
   criar e capturar auditam.
8. **Busca sem acento**: três colunas (`search_text`, `search_fold`, `title_fold`) mantidas **pela rota PATCH**
   (não por trigger SQL), a partir do documento (`lib/anotacoes/busca.ts`). O mapa de acentos é uma tabela
   explícita e é o MESMO da migration 0687 — se mudar um, mude o outro.
9. **Estado por pessoa** (`notes_user_state`): favorita e último acesso → listas "Favoritas" e "Recentes".
   RLS: cada pessoa só vê o próprio.
10. **Caixa de entrada**: uma página por organização com `kind = 'inbox'` (índice único), criada na primeira
    captura (ou tirada da lixeira). A "Captura rápida" acrescenta um parágrafo com data/hora (fuso da
    organização) no fim, em SQL-seguro via rota `POST /api/v1/anotacoes/captura`. Depois da captura, o cliente
    remove a página do cache e remonta o editor (`key` com contador) para não sobrescrever o que entrou.
11. **Blocos visuais** (`components/anotacoes/blocos-visuais.tsx`): `destaque` (texto de verdade, 3 tons), `fluxo`,
    `matriz` (2x2/SWOT), `cartoes`, `metricas`, `piramide` (pirâmide/funil). Os não-textuais guardam a lista como
    **JSON numa prop de texto (`dados`)**, lida com cuidado (`lerLista`: JSON ruim vira o padrão, nunca quebra).
    Campos dentro do bloco ficam num `Isolado` que para os eventos de teclado/mouse antes de chegarem ao editor.
12. **Seleção de várias linhas**: arrastar no espaço em branco desenha um retângulo (marquee) e chama
    `editor.setSelection(primeiro, último)`; arrastar por cima do texto de vários blocos pinta os blocos inteiros
    (CSS gerado a partir de `editor.getSelection()`). `editor-de-notas.css` tem o realce e o cabeçalho de tabela.
13. **Tabela** nasce com `headerRows: 1` (item "Tabela" do menu `/` é sobrescrito); `th` ganha fundo e negrito no CSS.
14. **Imagens**: `uploadFile` do editor envia para o endpoint de upload de imagens que o projeto já tinha
    (aqui `POST /api/v1/marketing/imagens`, só png/jpg até 5 MB) e devolve a URL servida. Vídeo/áudio/arquivo
    foram **removidos** do esquema e do menu.

## 3. Mapa de arquivos
**Banco** (migration + apêndice idempotente no fim do `baseline.sql`, se o projeto usar esse padrão):
`0686_anotacoes.sql` (tabela `notes_pages`, trigger de guarda, RLS) · `0687_anotacoes_busca_e_estado.sql`
(`kind`, colunas de busca, `notes_user_state`).

**Lógica pura** (`lib/anotacoes/`): `paginas.ts` (tipos, schemas Zod, `montarArvore`, `idsDaSubarvore`,
`caminhoDaNota`, `estaDentroDe`, altura/profundidade) · `documento.ts` (formato do documento, `lerDocumento`,
`cartoesDoDocumento`, `ajustarCartoes`) · `busca.ts` (`dobrar`, `termoDeBusca`, `textoDoDocumento`, `camposDeBusca`,
`trechoDaBusca`).

**Rotas** (`app/api/v1/anotacoes/`): `route.ts` (GET árvore, POST criar) · `[id]/route.ts` (GET página, PATCH
conteúdo/título/ícone/lugar/visibilidade, DELETE lixeira ou definitivo) · `[id]/restaurar/route.ts` ·
`[id]/estado/route.ts` (PUT favorita/aberta) · `estado/route.ts` (GET favoritas/recentes) · `busca/route.ts` ·
`captura/route.ts`.

**Hooks** (`hooks/anotacoes/`): `useArvoreDeNotas` (lista + criar/mudar/apagar/restaurar, tudo otimista com volta) ·
`useNota` (página aberta + autosave) · `useEstadoDasNotas` · `useBuscaDeNotas`.

**Telas e componentes** (`components/anotacoes/`): `Anotacoes.tsx` (a tela: lateral + página; a página aberta fica na URL
`?p=`) · `ArvoreDeNotas.tsx` (árvore, `@dnd-kit` para reordenar entre irmãs) · `PaginaDeNota.tsx` ·
`EditorDeNotas.tsx` + `EditorDeNotasCarregavel.tsx` (BlockNote) · `blocos-visuais.tsx` · `editor-de-notas.css` ·
`AtalhosDeNotas.tsx` · `CapturaRapida.tsx` · `LixeiraDeNotas.tsx` · `MoverNota.tsx` · `SeletorDeIcone.tsx`.
Páginas: `app/app/anotacoes/page.tsx` e `app/app/agencia/anotacoes/page.tsx`.

**Menu**: item em `components/shell/Sidebar.tsx` (abaixo de Financeiro), `lib/agencia/menu.ts` (último grupo do
Modo Agência), entrada em `lib/navigation/catalogo.ts` e `registry.ts` (ícone `Note`), códigos em `lib/audit/actions.ts`
(`notes_page.created|moved|visibility_changed|trashed|restored|deleted|captured`).

**Testes** (`tests/unit/`): `anotacoes-arvore`, `anotacoes-documento`, `anotacoes-busca`, `anotacoes-editor`
(monta o editor no jsdom com pontes de `matchMedia`/`ResizeObserver`/`Range`; cobre cartões, blocos visuais e dado ruim).

## 4. O que este módulo assume do projeto de origem (mapear no destino)
| Assumido | Onde aparece | No destino |
|---|---|---|
| Multi-tenant por `organization_id` + RLS | todas as tabelas | adaptar nomes; **RLS é obrigatória** |
| Funções SQL `fn_user_org_ids()`, `fn_role_at_least(org, 'manager')`, `fn_is_platform_admin()`, `fn_is_platform_admin_full()`, `fn_set_updated_at()` | migration 0686/0687 | usar os equivalentes do destino (ou criá-los) |
| Papéis `viewer < agent < manager < admin`; "agência" = `manager`+ | RLS e rotas | mapear para os papéis do destino |
| `requireRole`, `requireSupportWrite`, `ok/fail`, `audit()` | todas as rotas | usar os do destino; manter a ordem (checar permissão antes de qualquer efeito) |
| `createClient()` (Supabase com a sessão do usuário, sob RLS) | rotas | idem. **Não usar chave de serviço** |
| `apiClient`, `showApiError`, `useT`, `toast` (sonner), `useTheme`, `cn` | hooks/componentes | idem |
| shadcn: `dialog`, `alert-dialog`, `dropdown-menu`, `popover`, `switch` | componentes | gerar os que faltarem |
| `lib/motor/ordem.ts` (`posicaoEntre`, `lacunaAcabou`, `renumerar`) | `ArvoreDeNotas.tsx` | copiar (é puro) |
| Endpoint de upload de imagem (`/api/v1/marketing/imagens`) e `lib/marketing/imagens.ts` | `EditorDeNotas.tsx` | apontar para o upload do destino, ou **tirar o bloco de imagem** do esquema |
| Fuso da organização (`lib/tempo/fusos.ts`, `authz.org.timezone`) | `captura/route.ts` | idem, ou usar um fuso fixo |
| `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`, `zod` v4, React 19, Next 16, Tailwind 4 | tudo | conferir versões |
| Tokens de cor `info/success/warning/error` `-bg`/`-fg`, `bg-card`, `bg-secondary`, `text-primary` | blocos visuais | trocar pelas classes do destino |

## 5. Regras de segurança que NÃO podem se perder
- `organization_id` e o papel **vêm da sessão**, nunca do corpo. Toda consulta filtra `organization_id`.
- Ler: agência vê tudo; demais membros só `visible_to_client and deleted_at is null` (política `notes_pages_select`).
- Escrever: só a agência (política `notes_pages_write`, `using` e `with check`).
- `notes_user_state`: `user_id = auth.uid()` **e** organização do usuário, nos dois lados da política.
- Função nova no schema `public`: `revoke execute ... from public, anon`.
- O `href` de links do editor é validado pelo BlockNote/Tiptap (bloqueia `javascript:`); manter assim.
- Nunca aplicar migration em banco de outro projeto. Cada projeto aplica no próprio banco.

## 6. Armadilhas já encontradas
- **Regras do React** (`react-hooks`): hooks não podem ser chamados em `render: (props) => {}` de bloco
  customizado — por isso cada bloco é um componente nomeado (`RenderDoFluxo`, …). Não ler `ref.current` durante o
  render; para o estado inicial use `useState(() => …)`.
- O editor só lê o conteúdo inicial **uma vez**: use `key={id}` para trocar de página (e o contador de captura).
- `insertOrUpdateBlockForSlashMenu` / `replaceBlocks` com tipos customizados exigem `as never` no TypeScript.
- jsdom não tem `matchMedia`, `ResizeObserver`, `Range.getBoundingClientRect/getClientRects`, `elementFromPoint`:
  stubar no teste (ver `anotacoes-editor.test.tsx`).
- `next build` com 3 GB de heap estoura na etapa de tipos; rodar `tsc` à parte com 6 GB.
- Página antiga no formato de outro editor não casa com `lerDocumento` e abre em branco — decidir no destino se
  precisa de conversão.
- O teste de varredura do `resourceId` do audit reprova `resourceId: id.data`; use uma variável com nome terminado
  em `Id` (`notaId`).
- Ao mexer no tema/cores, testes de contraste do projeto de origem fixam números — revisar se o destino tiver.

## 7. Ordem sugerida de implementação no destino
1. Banco: migration 0686 + 0687 adaptadas (um arquivo por etapa; testar a RLS com `ROLLBACK`).
2. `lib/anotacoes/*` (cópia quase literal) + testes.
3. Rotas + auditoria (códigos novos).
4. Hooks e componentes sem o editor (árvore, página com título, lixeira) → rodar.
5. Editor BlockNote + cartões de subpágina → rodar e testar no navegador.
6. Blocos visuais, tabela com cabeçalho, seleção de várias linhas.
7. Busca, favoritos/recentes, Caixa de entrada.
8. Menu/porta de navegação, texto em português, `typecheck`, lint e testes.

## 8. Como verificar que ficou igual
Abrir uma página, clicar no papel e escrever · digitar `/` e criar Subpágina, Fluxo, Matriz e Tabela · arrastar o
cartão da subpágina e ver a ordem da lateral mudar · apagar o cartão e ver a subpágina na lixeira (e restaurar) ·
arrastar o mouse no branco por cima de vários blocos · liberar uma página ao cliente e entrar como cliente (só ela
aparece) · capturar um texto e achá-lo na busca sem digitar o acento.
