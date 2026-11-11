/**
 * O TEXTO ESTRUTURADO das páginas de Marketing: um jeito de escrever (ou colar) a página inteira
 * de uma vez, sem mexer bloco por bloco. Quem lê é `lerTextoDaPagina`; quem escreve a partir de
 * uma página já montada é `textoDaPagina` (o caminho de volta, para editar fora e colar de novo).
 *
 * O formato (Markdown simples + blocos entre `:::`):
 *
 *   # Título grande      ## Título médio      ### Título pequeno
 *   Um parágrafo de texto (linhas seguidas formam um parágrafo; linha em branco separa).
 *   - item de lista           1. item numerado          [ ] item de checklist
 *   > atenção: um destaque    (tons: info, sucesso, atencao; sem tom = info)
 *   ---                       (uma linha divisória)
 *
 *   ::: metricas              rótulo | valor | detalhe (o detalhe é opcional)
 *   ::: fluxo                 título | texto           (as etapas, na ordem)
 *   ::: cards                 título | texto
 *   ::: matriz swot           4 linhas: título | texto (use `::: matriz` para a versão neutra)
 *   ::: piramide              título | texto, do topo para a base (`::: funil` = o funil)
 *   ::: tabela                a 1ª linha são as colunas; as demais, as linhas: a | b | c
 *   ::: citacao               texto | autor
 *   ::: toggle                título | texto (o texto aparece ao abrir)
 *   ::: links                 rótulo | https://endereço
 *   ::: imagem                legenda | tamanho | alinhamento | arquivo (só a legenda é obrigatória)
 *   ::: imagem-texto esquerda título | texto | arquivo   (ou `direita`: de que lado fica a imagem)
 *   ::: antes-depois          2 linhas (antes, depois): título | texto | arquivo
 *   ::: paleta                nome | #cor
 *   ::: ficha                 a linha sem `|` é a introdução; as demais: rótulo | https://endereço | destaque
 *   ::: calculadora           meta, ticket, conversao, cpl, margem, retencao — uma por linha: chave | valor
 *   |||                       (sozinha, entre dois blocos: o bloco seguinte fica AO LADO do anterior)
 *   ::: oferta                campo | valor, uma linha por campo (o produto; veja texto-da-oferta.ts)
 *   :::                       (fecha o bloco)
 *
 * Dentro do texto, `**negrito**` e `*itálico*` valem em qualquer bloco.
 *
 * `|` separa as colunas; para um `|` dentro do texto, escreva `\|`. Uma linha que deve começar com
 * `#`, `-`, `>` ou `:::` mas ser texto comum leva uma `\` na frente.
 *
 * Tudo ou nada: se QUALQUER linha tiver problema, nada é importado e cada problema vem com o
 * número da linha — truncar em silêncio perderia texto do cliente sem ninguém ver.
 */
import {
  ALINHAMENTOS,
  blocoSchema,
  LARGURAS_DA_IMAGEM,
  MAXIMO_DE_BLOCOS,
  MAXIMO_DE_COLUNAS,
  type Bloco,
} from "@/lib/marketing/blocos";
import { linhasDaOferta, ofertaDeLinhas } from "@/lib/marketing/texto-da-oferta";

export interface ProblemaDoTexto {
  linha: number;
  erro: string;
}

export interface LeituraDoTexto {
  blocos: Bloco[];
  problemas: ProblemaDoTexto[];
}

type Tom = "info" | "sucesso" | "atencao";

/** Divide uma linha em colunas por `|`, respeitando `\|`. */
function colunas(linha: string): string[] {
  const saida: string[] = [];
  let atual = "";
  for (let i = 0; i < linha.length; i++) {
    const c = linha[i]!;
    if (c === "\\" && linha[i + 1] === "|") {
      atual += "|";
      i++;
    } else if (c === "|") {
      saida.push(atual.trim());
      atual = "";
    } else atual += c;
  }
  saida.push(atual.trim());
  return saida;
}

const escapar = (s: string) =>
  s
    .replace(/\r?\n+/g, " ")
    .replace(/\|/g, "\\|")
    .trim();

function mensagemDoErro(erro: { issues: Array<{ path: PropertyKey[]; message: string }> }): string {
  const i = erro.issues[0];
  if (!i) return "bloco inválido";
  const campo = i.path.filter((p) => typeof p === "string").join(" › ");
  const m = /(?:at most|<=)\s*(\d+)/i.exec(i.message);
  if (m) return `${campo || "texto"}: passou do limite de ${m[1]} (caracteres ou itens)`;
  return campo ? `${campo}: ${i.message}` : i.message;
}

export function lerTextoDaPagina(texto: string, novoId: () => string): LeituraDoTexto {
  const linhas = texto.replace(/^﻿/, "").split(/\r?\n/);
  const blocos: Bloco[] = [];
  const problemas: ProblemaDoTexto[] = [];

  // Blocos que vieram depois de uma linha `|||`: ficam ao lado do anterior.
  const aoLado = new Set<number>();
  let juntarOProximo = false;
  const aceitar = (candidato: unknown, linha: number) => {
    const r = blocoSchema.safeParse(candidato);
    if (r.success) {
      if (juntarOProximo && blocos.length > 0) aoLado.add(blocos.length);
      juntarOProximo = false;
      blocos.push(r.data);
    } else problemas.push({ linha, erro: mensagemDoErro(r.error) });
  };

  let paragrafo: string[] = [];
  let inicioParagrafo = 0;
  const fecharParagrafo = () => {
    if (paragrafo.length)
      aceitar({ id: novoId(), tipo: "texto", texto: paragrafo.join("\n") }, inicioParagrafo);
    paragrafo = [];
  };

  for (let n = 0; n < linhas.length; n++) {
    const bruta = linhas[n]!;
    const linha = bruta.trim();
    const numero = n + 1;

    if (linha === "") {
      fecharParagrafo();
      continue;
    }

    if (linha === "|||") {
      fecharParagrafo();
      if (blocos.length === 0 && !problemas.length) {
        problemas.push({ linha: numero, erro: "`|||` precisa de um bloco antes dele" });
      }
      juntarOProximo = true;
      continue;
    }

    // Escape: "\# isto é texto".
    if (linha.startsWith("\\")) {
      if (!paragrafo.length) inicioParagrafo = numero;
      paragrafo.push(linha.slice(1));
      continue;
    }

    // ── bloco entre ::: ─────────────────────────────────────────────────
    if (linha.startsWith(":::")) {
      fecharParagrafo();
      const cabecalho = linha.slice(3).trim().toLowerCase();
      if (!cabecalho) {
        problemas.push({ linha: numero, erro: "`:::` sozinho fecha um bloco que não foi aberto" });
        continue;
      }
      const [tipoBruto = "", ...resto] = cabecalho.split(/\s+/);
      const corpo: Array<{ n: number; t: string }> = [];
      let fechou = false;
      while (++n < linhas.length) {
        const l = linhas[n]!.trim();
        if (l === ":::") {
          fechou = true;
          break;
        }
        if (l !== "") corpo.push({ n: n + 1, t: l });
      }
      if (!fechou) {
        problemas.push({
          linha: numero,
          erro: `o bloco "${tipoBruto}" não foi fechado com \`:::\``,
        });
        break;
      }
      const cols = corpo.map((c) => colunas(c.t));
      const id = novoId();
      switch (tipoBruto) {
        case "metricas":
          aceitar(
            {
              id,
              tipo: "metricas",
              itens: cols.map((c) => ({
                rotulo: c[0] ?? "",
                valor: c[1] ?? "",
                detalhe: c[2] ?? "",
              })),
            },
            numero,
          );
          break;
        case "fluxo":
          aceitar(
            {
              id,
              tipo: "fluxo",
              itens: cols.map((c) => ({ titulo: c[0] ?? "", texto: c[1] ?? "" })),
            },
            numero,
          );
          break;
        case "cards":
          aceitar(
            {
              id,
              tipo: "cards",
              itens: cols.map((c) => ({ titulo: c[0] ?? "", texto: c[1] ?? "" })),
            },
            numero,
          );
          break;
        case "matriz": {
          if (cols.length !== 4) {
            problemas.push({
              linha: numero,
              erro: `a matriz precisa de 4 linhas (tem ${cols.length})`,
            });
            break;
          }
          aceitar(
            {
              id,
              tipo: "matriz",
              estilo: resto[0] === "swot" ? "swot" : "neutro",
              celulas: cols.map((c) => ({ titulo: c[0] ?? "", texto: c[1] ?? "" })),
            },
            numero,
          );
          break;
        }
        case "piramide":
        case "funil":
          aceitar(
            {
              id,
              tipo: "piramide",
              forma: tipoBruto === "funil" ? "funil" : "piramide",
              itens: cols.map((c) => ({ titulo: c[0] ?? "", texto: c[1] ?? "" })),
            },
            numero,
          );
          break;
        case "tabela": {
          if (!cols.length) {
            problemas.push({
              linha: numero,
              erro: "a tabela precisa ao menos da linha das colunas",
            });
            break;
          }
          const [cabeca = [], ...linhasDaTabela] = cols;
          aceitar(
            {
              id,
              tipo: "tabela",
              colunas: cabeca,
              linhas: linhasDaTabela.map((l) => cabeca.map((_, i) => l[i] ?? "")),
            },
            numero,
          );
          break;
        }
        case "citacao":
          aceitar(
            { id, tipo: "citacao", texto: cols[0]?.[0] ?? "", autor: cols[0]?.[1] ?? "" },
            numero,
          );
          break;
        case "toggle":
          aceitar(
            { id, tipo: "toggle", titulo: cols[0]?.[0] ?? "", texto: cols[0]?.[1] ?? "" },
            numero,
          );
          break;
        case "links":
          aceitar(
            {
              id,
              tipo: "links",
              itens: cols.map((c) => ({ rotulo: c[0] ?? "", url: c[1] ?? "" })),
            },
            numero,
          );
          break;
        case "imagem": {
          const [legenda = "", largura = "", alinhamento = "", arquivo = ""] = cols[0] ?? [];
          aceitar(
            {
              id,
              tipo: "imagem",
              arquivo,
              legenda,
              largura: (LARGURAS_DA_IMAGEM as readonly string[]).includes(largura)
                ? largura
                : "grande",
              alinhamento: (ALINHAMENTOS as readonly string[]).includes(alinhamento)
                ? alinhamento
                : "centro",
            },
            numero,
          );
          break;
        }
        case "imagem-texto":
          aceitar(
            {
              id,
              tipo: "imagem-texto",
              lado: resto[0] === "direita" ? "direita" : "esquerda",
              titulo: cols[0]?.[0] ?? "",
              texto: cols[0]?.[1] ?? "",
              arquivo: cols[0]?.[2] ?? "",
            },
            numero,
          );
          break;
        case "antes-depois": {
          if (cols.length !== 2) {
            problemas.push({
              linha: numero,
              erro: `o antes e depois precisa de 2 linhas (tem ${cols.length})`,
            });
            break;
          }
          const lado = (c: string[] = []) => ({
            titulo: c[0] ?? "",
            texto: c[1] ?? "",
            ...(c[2] ? { imagem: c[2] } : {}),
          });
          aceitar(
            { id, tipo: "antes-depois", antes: lado(cols[0]), depois: lado(cols[1]) },
            numero,
          );
          break;
        }
        case "paleta":
          aceitar(
            { id, tipo: "paleta", cores: cols.map((c) => ({ nome: c[0] ?? "", hex: c[1] ?? "" })) },
            numero,
          );
          break;
        case "ficha": {
          const links = cols.filter((c) => c.length > 1);
          const intro = cols
            .filter((c) => c.length === 1)
            .map((c) => c[0])
            .join("\n");
          aceitar(
            {
              id,
              tipo: "ficha",
              intro,
              links: links.map((c) => ({
                rotulo: c[0] ?? "",
                url: c[1] ?? "",
                destaque: c[2] === "destaque",
              })),
            },
            numero,
          );
          break;
        }
        case "calculadora": {
          const valores: Record<string, string> = {};
          for (const c of cols) if (c[0]) valores[c[0].toLowerCase()] = c[1] ?? "";
          aceitar(
            {
              id,
              tipo: "calculadora",
              meta: valores.meta ?? "",
              ticket: valores.ticket ?? "",
              conversao: valores.conversao ?? "",
              cpl: valores.cpl ?? "",
              margem: valores.margem ?? "",
              retencao: valores.retencao ?? "",
            },
            numero,
          );
          break;
        }
        case "oferta": {
          const { candidato, erros } = ofertaDeLinhas(cols, id);
          if (erros.length > 0) for (const erro of erros) problemas.push({ linha: numero, erro });
          else aceitar(candidato, numero);
          break;
        }
        default:
          problemas.push({
            linha: numero,
            erro: `tipo de bloco desconhecido: "${tipoBruto}" (use metricas, fluxo, cards, matriz, piramide, funil, tabela, citacao, toggle, links, imagem, imagem-texto, antes-depois, paleta, ficha, calculadora ou oferta)`,
          });
      }
      continue;
    }

    // ── título ─────────────────────────────────────────────────────────
    const titulo = /^(#{1,3})\s+(.*)$/.exec(linha);
    if (titulo) {
      fecharParagrafo();
      aceitar(
        { id: novoId(), tipo: "titulo", nivel: titulo[1]!.length, texto: titulo[2]!.trim() },
        numero,
      );
      continue;
    }

    // ── separador ──────────────────────────────────────────────────────
    if (/^-{3,}$/.test(linha)) {
      fecharParagrafo();
      aceitar({ id: novoId(), tipo: "separador" }, numero);
      continue;
    }

    // ── destaque ───────────────────────────────────────────────────────
    if (linha.startsWith(">")) {
      fecharParagrafo();
      const partes: string[] = [];
      const inicio = numero;
      let l = linha;
      for (;;) {
        partes.push(l.replace(/^>\s?/, ""));
        const prox = linhas[n + 1]?.trim();
        if (prox && prox.startsWith(">")) {
          n++;
          l = prox;
        } else break;
      }
      let tom: Tom = "info";
      const m = /^(info|sucesso|atencao|atenção)\s*:\s*/i.exec(partes[0]!);
      if (m) {
        tom = m[1]!.toLowerCase().replace("ç", "c").replace("ã", "a") as Tom;
        partes[0] = partes[0]!.slice(m[0].length);
      }
      aceitar({ id: novoId(), tipo: "destaque", tom, texto: partes.join("\n") }, inicio);
      continue;
    }

    // ── lista ──────────────────────────────────────────────────────────
    const marcador = /^(?:(-|\*)\s+|(\d+)[.)]\s+|\[( |x|X)\]\s+)(.*)$/.exec(linha);
    if (marcador) {
      fecharParagrafo();
      const estilo = marcador[2] ? "numerada" : marcador[3] !== undefined ? "check" : "marcadores";
      const itens: string[] = [marcador[4]!.trim()];
      const inicio = numero;
      for (;;) {
        const prox = linhas[n + 1]?.trim() ?? "";
        const m2 = /^(?:(-|\*)\s+|(\d+)[.)]\s+|\[( |x|X)\]\s+)(.*)$/.exec(prox);
        const mesmo =
          m2 && (m2[2] ? "numerada" : m2[3] !== undefined ? "check" : "marcadores") === estilo;
        if (!m2 || !mesmo) break;
        itens.push(m2[4]!.trim());
        n++;
      }
      aceitar({ id: novoId(), tipo: "lista", estilo, itens }, inicio);
      continue;
    }

    // ── parágrafo ──────────────────────────────────────────────────────
    if (!paragrafo.length) inicioParagrafo = numero;
    paragrafo.push(linha);
  }
  fecharParagrafo();

  // `|||` coloca o bloco ao lado do anterior (até MAXIMO_DE_COLUNAS por linha).
  let linhaAtual: string | undefined;
  let naLinha = 0;
  blocos.forEach((b, i) => {
    if (!aoLado.has(i)) {
      linhaAtual = undefined;
      naLinha = 1;
      return;
    }
    if (naLinha >= MAXIMO_DE_COLUNAS) {
      linhaAtual = undefined;
      naLinha = 1;
      return;
    }
    const anterior = blocos[i - 1]!;
    linhaAtual ??= anterior.linha ?? novoId();
    anterior.linha = linhaAtual;
    b.linha = linhaAtual;
    naLinha++;
  });

  if (blocos.length > MAXIMO_DE_BLOCOS) {
    problemas.push({
      linha: 1,
      erro: `a página passaria do limite de ${MAXIMO_DE_BLOCOS} blocos (tem ${blocos.length})`,
    });
  }
  return { blocos: problemas.length ? [] : blocos, problemas };
}

/** O caminho de volta: a página como texto estruturado. Blocos sem forma em texto são contados. */
export function textoDaPagina(blocos: Bloco[]): { texto: string; ignorados: number } {
  const saida: string[] = [];
  let ignorados = 0;
  const bloco = (tipo: string, linhas: string[]) =>
    saida.push([`::: ${tipo}`, ...linhas, ":::"].join("\n"));
  const protege = (s: string) => (/^(#|-|\*|>|:::|\[|\d+[.)]\s|\\)/.test(s.trim()) ? `\\${s}` : s);

  let anterior: Bloco | undefined;
  for (const b of blocos) {
    // Bloco que divide a linha com o anterior: uma linha `|||` antes dele.
    if (anterior && b.linha && anterior.linha === b.linha) saida.push("|||");
    anterior = b;
    switch (b.tipo) {
      case "titulo":
        saida.push(`${"#".repeat(b.nivel)} ${b.texto}`);
        break;
      case "texto":
        saida.push(
          b.texto
            .split(/\n{2,}/)
            .map((p) => p.split("\n").map(protege).join("\n"))
            .join("\n\n"),
        );
        break;
      case "destaque":
        saida.push(
          b.texto
            .split("\n")
            .map((l, i) => `> ${i === 0 ? `${b.tom}: ` : ""}${l}`)
            .join("\n"),
        );
        break;
      case "lista":
        saida.push(
          b.itens
            .map((i, k) =>
              b.estilo === "numerada"
                ? `${k + 1}. ${i}`
                : b.estilo === "check"
                  ? `[ ] ${i}`
                  : `- ${i}`,
            )
            .join("\n"),
        );
        break;
      case "separador":
        saida.push("---");
        break;
      case "metricas":
        bloco(
          "metricas",
          b.itens.map((i) =>
            [i.rotulo, i.valor, i.detalhe].map(escapar).join(" | ").replace(/ \| $/, ""),
          ),
        );
        break;
      case "fluxo":
      case "cards":
        bloco(
          b.tipo,
          b.itens.map((i) => [i.titulo, i.texto].map(escapar).join(" | ")),
        );
        break;
      case "piramide":
        bloco(
          b.forma,
          b.itens.map((i) => [i.titulo, i.texto].map(escapar).join(" | ")),
        );
        break;
      case "matriz":
        bloco(
          b.estilo === "swot" ? "matriz swot" : "matriz",
          b.celulas.map((i) => [i.titulo, i.texto].map(escapar).join(" | ")),
        );
        break;
      case "tabela":
        bloco(
          "tabela",
          [b.colunas, ...b.linhas].map((l) => l.map(escapar).join(" | ")),
        );
        break;
      case "citacao":
        bloco("citacao", [[b.texto, b.autor].map(escapar).join(" | ")]);
        break;
      case "toggle":
        bloco("toggle", [[b.titulo, b.texto].map(escapar).join(" | ")]);
        break;
      case "links":
        bloco(
          "links",
          b.itens.map((i) => [i.rotulo, i.url].map(escapar).join(" | ")),
        );
        break;
      case "imagem":
        // O arquivo vai pelo nome (a imagem fica guardada na empresa): colar na mesma empresa
        // traz a imagem de volta; vazio = ainda sem imagem.
        bloco("imagem", [
          [b.legenda, b.largura, b.alinhamento, b.arquivo].map(escapar).join(" | "),
        ]);
        break;
      case "imagem-texto":
        bloco(`imagem-texto ${b.lado}`, [[b.titulo, b.texto, b.arquivo].map(escapar).join(" | ")]);
        break;
      case "antes-depois":
        bloco(
          "antes-depois",
          [b.antes, b.depois].map((l) =>
            [l.titulo, l.texto, l.imagem ?? ""].map(escapar).join(" | ").replace(/ \| $/, ""),
          ),
        );
        break;
      case "paleta":
        bloco(
          "paleta",
          b.cores.map((c) => [c.nome, c.hex].map(escapar).join(" | ")),
        );
        break;
      case "ficha":
        bloco("ficha", [
          ...(b.intro.trim() ? b.intro.split(/\n+/).map(escapar) : []),
          ...b.links.map((l) =>
            [l.rotulo, l.url, ...(l.destaque ? ["destaque"] : [])].map(escapar).join(" | "),
          ),
        ]);
        break;
      case "calculadora":
        bloco(
          "calculadora",
          (["meta", "ticket", "conversao", "cpl", "margem", "retencao"] as const).map(
            (k) => `${k} | ${escapar(b[k])}`,
          ),
        );
        break;
      case "oferta":
        // As imagens do produto não cabem em texto: o resto sai, e as imagens são contadas.
        bloco("oferta", linhasDaOferta(b));
        if (b.imagens?.length) ignorados++;
        break;
      default:
        ignorados++;
    }
  }
  return { texto: saida.join("\n\n") + (saida.length ? "\n" : ""), ignorados };
}

/** Um exemplo curto, para a pessoa ver o formato (e que passa na própria leitura). */
export const TEXTO_DE_EXEMPLO = `# Onde estamos hoje
A empresa vende há 5 anos para clínicas. O faturamento está estável.

::: metricas
Faturamento dos últimos 12 meses | R$ 480 mil | estável
Ticket médio | R$ 1.200
Conversão de lead em venda | 8%
Custo por lead | R$ 22
:::

# O funil atual
::: fluxo
Advertising | Meta Ads, R$ 3 mil por mês
Vendas | Atendimento pelo WhatsApp em até 1 hora
:::

# Forças, fraquezas, oportunidades e ameaças
::: matriz swot
Forças | Equipe experiente
Fraquezas | Sem acompanhamento de leads
Oportunidades | Cidades vizinhas sem concorrência
Ameaças | Concorrente novo com preço menor
:::

> atencao: O maior gargalo hoje é a demora na primeira resposta.

- Responder em até 5 minutos
- Criar follow-up de 3 dias
`;
