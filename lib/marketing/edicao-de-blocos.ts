import {
  ALINHAMENTOS,
  blocoEmBranco,
  ESTILOS_DA_MATRIZ,
  FORMAS_DOS_NIVEIS,
  LADOS_DA_IMAGEM,
  LARGURAS_DA_IMAGEM,
  MAXIMO_DE_COLUNAS,
  NIVEIS_DA_OFERTA,
  type Bloco,
  type TipoDeBloco,
} from "@/lib/marketing/blocos";

/**
 * As peças puras da EDIÇÃO VISUAL dos blocos de Marketing: trocar o tipo de um bloco
 * (guardando o texto), as propriedades de tamanho/alinhamento/tom que o botão direito oferece, e
 * mover/duplicar/apagar vários de uma vez. A tela (`EditorVisualDeBlocos`) só desenha e avisa.
 */

/** Para onde converter: o tipo e, quando o tipo tem variações (título 1/2/3, lista), qual. */
export interface AlvoDeConversao {
  tipo: TipoDeBloco;
  nivel?: 1 | 2 | 3;
  estilo?: "marcadores" | "numerada" | "check";
  /** O nome curto do alvo, em português (a tela traduz). */
  rotulo: string;
  /** Glifo do menu. */
  glifo: string;
  /** O dígito do atalho Ctrl+Shift+<dígito>; ausente nos blocos sem atalho. */
  atalho?: string;
}

/** Os dez blocos de texto, com o mesmo atalho do editor de blocos da descrição. */
export const ALVOS_BASICOS: readonly AlvoDeConversao[] = [
  { tipo: "titulo", nivel: 1, rotulo: "Título 1", glifo: "H1", atalho: "1" },
  { tipo: "titulo", nivel: 2, rotulo: "Título 2", glifo: "H2", atalho: "2" },
  { tipo: "titulo", nivel: 3, rotulo: "Título 3", glifo: "H3", atalho: "3" },
  { tipo: "lista", estilo: "check", rotulo: "Lista de tarefas", glifo: "☑", atalho: "4" },
  { tipo: "lista", estilo: "marcadores", rotulo: "Lista com marcadores", glifo: "•", atalho: "5" },
  { tipo: "lista", estilo: "numerada", rotulo: "Lista numerada", glifo: "1.", atalho: "6" },
  { tipo: "toggle", rotulo: "Lista recolhível (toggle)", glifo: "▸", atalho: "7" },
  { tipo: "citacao", rotulo: "Citação", glifo: "❝", atalho: "8" },
  { tipo: "destaque", rotulo: "Destaque (callout)", glifo: "💡", atalho: "9" },
  { tipo: "texto", rotulo: "Texto", glifo: "Aa", atalho: "0" },
];

/** Os blocos visuais, sem atalho. */
export const ALVOS_VISUAIS: readonly AlvoDeConversao[] = [
  { tipo: "cards", rotulo: "Cartões", glifo: "▦" },
  { tipo: "metricas", rotulo: "Números", glifo: "123" },
  { tipo: "antes-depois", rotulo: "Antes e depois", glifo: "⇄" },
  { tipo: "paleta", rotulo: "Paleta de cores", glifo: "◐" },
  { tipo: "links", rotulo: "Links", glifo: "↗" },
  { tipo: "imagem", rotulo: "Imagem", glifo: "▨" },
  { tipo: "imagem-texto", rotulo: "Imagem com texto", glifo: "▤" },
  { tipo: "piramide", rotulo: "Pirâmide ou funil", glifo: "△" },
  { tipo: "fluxo", rotulo: "Fluxo (passo a passo)", glifo: "→" },
  { tipo: "matriz", rotulo: "Matriz 2x2 (SWOT)", glifo: "⊞" },
  { tipo: "ficha", rotulo: "Ficha com links", glifo: "☰" },
  { tipo: "tabela", rotulo: "Tabela", glifo: "▥" },
  { tipo: "calculadora", rotulo: "Calculadora da meta", glifo: "÷" },
  { tipo: "oferta", rotulo: "Oferta", glifo: "★" },
  { tipo: "separador", rotulo: "Quebra de slide", glifo: "―" },
];

export const TODOS_OS_ALVOS: readonly AlvoDeConversao[] = [...ALVOS_BASICOS, ...ALVOS_VISUAIS];

export function alvoDoAtalho(digito: string): AlvoDeConversao | undefined {
  return ALVOS_BASICOS.find((a) => a.atalho === digito);
}

/** O texto corrido de um bloco (o que se leva para o novo tipo ao converter). */
export function textoDoBloco(b: Bloco): string {
  switch (b.tipo) {
    case "titulo":
    case "texto":
    case "destaque":
    case "citacao":
      return b.texto;
    case "toggle":
      return [b.titulo, b.texto].filter(Boolean).join("\n");
    case "lista":
      return b.itens.join("\n");
    case "imagem-texto":
      return [b.titulo, b.texto].filter(Boolean).join("\n");
    case "cards":
    case "piramide":
      return b.itens
        .flatMap((i) => [i.titulo, i.texto])
        .filter(Boolean)
        .join("\n");
    case "fluxo":
      return b.itens
        .flatMap((i) => [i.titulo, i.texto])
        .filter(Boolean)
        .join("\n");
    case "metricas":
      return b.itens
        .flatMap((i) => [i.valor, i.rotulo])
        .filter(Boolean)
        .join("\n");
    case "links":
      return b.itens
        .map((i) => i.rotulo)
        .filter(Boolean)
        .join("\n");
    case "matriz":
      return b.celulas
        .flatMap((c) => [c.titulo, c.texto])
        .filter(Boolean)
        .join("\n");
    default:
      return "";
  }
}

const linhas = (texto: string) =>
  texto
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

/**
 * Converte o bloco para outro tipo MANTENDO o id (a seleção continua nele) e o texto que couber.
 * Tipos visuais (cartões, tabela…) nascem em branco: o conteúdo antigo se perde, e o Ctrl+Z
 * devolve.
 */
export function converterBloco(b: Bloco, alvo: AlvoDeConversao): Bloco {
  return { ...converterSemLinha(b, alvo), ...(b.linha ? { linha: b.linha } : {}) } as Bloco;
}

function converterSemLinha(b: Bloco, alvo: AlvoDeConversao): Bloco {
  const texto = textoDoBloco(b);
  const alinhamento = "alinhamento" in b ? b.alinhamento : undefined;
  const novo = blocoEmBranco(alvo.tipo, b.id);
  switch (novo.tipo) {
    case "titulo":
      return {
        ...novo,
        nivel: alvo.nivel ?? 1,
        texto: linhas(texto).join(" ").slice(0, 200),
        ...(alinhamento ? { alinhamento } : {}),
      };
    case "texto":
      return { ...novo, texto: texto.slice(0, 5000), ...(alinhamento ? { alinhamento } : {}) };
    case "destaque":
      return { ...novo, tom: b.tipo === "destaque" ? b.tom : "info", texto: texto.slice(0, 5000) };
    case "citacao":
      return {
        ...novo,
        texto: texto.slice(0, 1000),
        autor: b.tipo === "citacao" ? b.autor : "",
        ...(alinhamento ? { alinhamento } : {}),
      };
    case "toggle": {
      const [primeira = "", ...resto] = linhas(texto);
      return { ...novo, titulo: primeira.slice(0, 200), texto: resto.join("\n\n").slice(0, 5000) };
    }
    case "lista": {
      const itens = linhas(texto)
        .slice(0, 40)
        .map((l) => l.slice(0, 200));
      return { ...novo, estilo: alvo.estilo ?? "marcadores", itens: itens.length ? itens : [""] };
    }
    default:
      return novo;
  }
}

/** O bloco já é exatamente este alvo (o menu marca a opção atual). */
export function ehOAlvo(b: Bloco, alvo: AlvoDeConversao): boolean {
  if (b.tipo !== alvo.tipo) return false;
  if (b.tipo === "titulo") return b.nivel === (alvo.nivel ?? 1);
  if (b.tipo === "lista") return b.estilo === (alvo.estilo ?? "marcadores");
  return true;
}

// ── propriedades (tamanho, alinhamento, tom…) ────────────────────────────────────

export interface PropriedadeDoBloco {
  campo: string;
  rotulo: string;
  opcoes: { valor: string | number; rotulo: string }[];
  atual: string | number;
}

const ROTULO_DO_ALINHAMENTO: Record<(typeof ALINHAMENTOS)[number], string> = {
  esquerda: "Esquerda",
  centro: "Centro",
  direita: "Direita",
};
const opcoesDeAlinhamento = ALINHAMENTOS.map((valor) => ({
  valor,
  rotulo: ROTULO_DO_ALINHAMENTO[valor],
}));

/** O que o botão direito oferece para ajustar o bloco (vazio = nada além de tipo/editar). */
export function propriedadesDoBloco(b: Bloco): PropriedadeDoBloco[] {
  switch (b.tipo) {
    case "titulo":
      return [
        {
          campo: "nivel",
          rotulo: "Tamanho",
          opcoes: [
            { valor: 1, rotulo: "Seção (novo slide)" },
            { valor: 2, rotulo: "Subtítulo" },
            { valor: 3, rotulo: "Título pequeno" },
          ],
          atual: b.nivel,
        },
        {
          campo: "alinhamento",
          rotulo: "Alinhamento",
          opcoes: opcoesDeAlinhamento,
          atual: b.alinhamento ?? "esquerda",
        },
      ];
    case "texto":
    case "citacao":
      return [
        {
          campo: "alinhamento",
          rotulo: "Alinhamento",
          opcoes: opcoesDeAlinhamento,
          atual: b.alinhamento ?? "esquerda",
        },
      ];
    case "destaque":
      return [
        {
          campo: "tom",
          rotulo: "Tom",
          opcoes: [
            { valor: "info", rotulo: "Informação" },
            { valor: "sucesso", rotulo: "Conquista" },
            { valor: "atencao", rotulo: "Atenção" },
          ],
          atual: b.tom,
        },
      ];
    case "imagem":
      return [
        {
          campo: "largura",
          rotulo: "Tamanho",
          opcoes: LARGURAS_DA_IMAGEM.map((valor) => ({
            valor,
            rotulo: {
              pequena: "Pequena",
              media: "Média",
              grande: "Grande",
              total: "Largura total",
            }[valor],
          })),
          atual: b.largura,
        },
        {
          campo: "alinhamento",
          rotulo: "Alinhamento",
          opcoes: opcoesDeAlinhamento,
          atual: b.alinhamento,
        },
      ];
    case "imagem-texto":
      return [
        {
          campo: "lado",
          rotulo: "Lado da imagem",
          opcoes: LADOS_DA_IMAGEM.map((valor) => ({
            valor,
            rotulo: valor === "esquerda" ? "Esquerda" : "Direita",
          })),
          atual: b.lado,
        },
      ];
    case "piramide":
      return [
        {
          campo: "forma",
          rotulo: "Forma",
          opcoes: FORMAS_DOS_NIVEIS.map((valor) => ({
            valor,
            rotulo: valor === "piramide" ? "Pirâmide" : "Funil",
          })),
          atual: b.forma,
        },
      ];
    case "matriz":
      return [
        {
          campo: "estilo",
          rotulo: "Estilo",
          opcoes: ESTILOS_DA_MATRIZ.map((valor) => ({
            valor,
            rotulo: valor === "swot" ? "SWOT (com cores)" : "Neutra",
          })),
          atual: b.estilo,
        },
      ];
    case "oferta":
      return [
        {
          campo: "nivel",
          rotulo: "Detalhe",
          opcoes: NIVEIS_DA_OFERTA.map((valor) => ({
            valor,
            rotulo: valor === "simples" ? "Ficha curta" : "Oferta completa",
          })),
          atual: b.nivel,
        },
      ];
    default:
      return [];
  }
}

export function aplicarPropriedade(b: Bloco, campo: string, valor: string | number): Bloco {
  return { ...b, [campo]: valor } as Bloco;
}

// ── vários blocos de uma vez ─────────────────────────────────────────────────────

export function removerBlocos(blocos: Bloco[], ids: ReadonlySet<string>): Bloco[] {
  return normalizarLinhas(blocos.filter((b) => !ids.has(b.id)));
}

export function duplicarBlocos(
  blocos: Bloco[],
  ids: ReadonlySet<string>,
  novoId: () => string,
): Bloco[] {
  return blocos.flatMap((b) => {
    if (!ids.has(b.id)) return [b];
    // A cópia vai para a linha de baixo (não vira mais uma coluna).
    const { linha: _linha, ...copia } = structuredClone(b);
    return [b, { ...copia, id: novoId() } as Bloco];
  });
}

/** Leva os blocos escolhidos (na ordem em que estão) para antes/depois de `alvo`. */
export function moverBlocos(
  blocos: Bloco[],
  ids: ReadonlySet<string>,
  alvo: string,
  depois: boolean,
): Bloco[] {
  if (ids.has(alvo)) return blocos;
  const levados = blocos.filter((b) => ids.has(b.id));
  const resto = blocos.filter((b) => !ids.has(b.id));
  const i = resto.findIndex((b) => b.id === alvo);
  if (i < 0 || !levados.length) return blocos;
  resto.splice(depois ? i + 1 : i, 0, ...levados);
  return resto;
}

// ── colunas: blocos lado a lado ──────────────────────────────────────────────────

/** Separa a lista em "linhas": blocos seguidos com a mesma `linha` formam uma só (as colunas). */
export function agruparPorLinha<T extends Bloco>(blocos: readonly T[]): T[][] {
  const grupos: T[][] = [];
  for (const b of blocos) {
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && b.linha && ultimo[0]!.linha === b.linha) ultimo.push(b);
    else grupos.push([b]);
  }
  return grupos;
}

/** Tira a marca de coluna de quem ficou sozinho na linha (e de quem passa do máximo de colunas). */
export function normalizarLinhas(blocos: Bloco[]): Bloco[] {
  const solta = new Set<string>();
  for (const g of agruparPorLinha(blocos)) {
    g.forEach((b, i) => {
      if (b.linha && (g.length === 1 || i >= MAXIMO_DE_COLUNAS)) solta.add(b.id);
    });
  }
  if (!solta.size) return blocos;
  return blocos.map((b) => {
    if (!solta.has(b.id)) return b;
    const { linha: _linha, ...resto } = b;
    return resto as Bloco;
  });
}

/** Põe os blocos escolhidos lado a lado, juntos onde está o primeiro deles. */
export function juntarEmLinha(
  blocos: Bloco[],
  ids: ReadonlySet<string>,
  novaLinha: string,
): Bloco[] {
  const levados = blocos.filter((b) => ids.has(b.id));
  if (levados.length < 2 || levados.length > MAXIMO_DE_COLUNAS) return blocos;
  const primeiro = blocos.findIndex((b) => ids.has(b.id));
  const antes = blocos.slice(0, primeiro).filter((b) => !ids.has(b.id)).length;
  const resto = blocos.filter((b) => !ids.has(b.id));
  resto.splice(antes, 0, ...levados.map((b) => ({ ...b, linha: novaLinha }) as Bloco));
  return normalizarLinhas(resto);
}

/** Põe o bloco como mais uma coluna ao lado do bloco de cima (ou o junta à linha dele). */
export function juntarComOAnterior(blocos: Bloco[], id: string, novaLinha: string): Bloco[] {
  const i = blocos.findIndex((b) => b.id === id);
  const anterior = blocos[i - 1];
  if (i < 1 || !anterior) return blocos;
  const linha = anterior.linha ?? novaLinha;
  const colunas = blocos.filter((b) => b.linha === linha).length;
  if (anterior.linha && colunas >= MAXIMO_DE_COLUNAS) return blocos;
  return blocos.map((b) => (b.id === id || b.id === anterior.id ? ({ ...b, linha } as Bloco) : b));
}

/** Tira os blocos escolhidos da linha em que estão (voltam a ocupar a largura toda). */
export function separarDaLinha(blocos: Bloco[], ids: ReadonlySet<string>): Bloco[] {
  return normalizarLinhas(
    blocos.map((b) => {
      if (!ids.has(b.id) || !b.linha) return b;
      const { linha: _linha, ...resto } = b;
      return resto as Bloco;
    }),
  );
}
