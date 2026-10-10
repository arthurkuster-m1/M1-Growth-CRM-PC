import { z } from "zod";

/**
 * OS BLOCOS de uma página de Marketing — a "linguagem" em que a agência escreve e que o
 * cliente lê. Uma página é uma lista ordenada de blocos; o MESMO conteúdo vira duas telas:
 * a página (rolagem) e a apresentação (slide a slide, ver `slides.ts`).
 *
 * É dado puro, validado aqui (Zod) tanto no servidor (ao gravar) quanto na leitura (a tela
 * ignora o que não entende em vez de quebrar). Os tetos existem para uma página não virar
 * depósito de arquivo: o banco também limita o tamanho do jsonb.
 *
 * ⚠️ A FORMA de `TIPOS_DE_BLOCO` é requisito de instrumento, não estilo (`const X = [...] as const`).
 */
export const TIPOS_DE_BLOCO = [
  "titulo",
  "texto",
  "destaque",
  "lista",
  "cards",
  "metricas",
  "antes-depois",
  "paleta",
  "links",
  "citacao",
  "imagem",
  "imagem-texto",
  "piramide",
  "fluxo",
  "matriz",
  "separador",
] as const;
export type TipoDeBloco = (typeof TIPOS_DE_BLOCO)[number];

export const MAXIMO_DE_BLOCOS = 150;

/** Os dois lados do bloco "antes e depois" (as chaves do dado, não texto de tela). */
export const LADOS_DO_ANTES_DEPOIS = ["antes", "depois"] as const;

/** Onde o bloco fica na linha (as chaves do dado; o rótulo de tela vem do editor). */
export const ALINHAMENTOS = ["esquerda", "centro", "direita"] as const;
export type Alinhamento = (typeof ALINHAMENTOS)[number];

/** A forma do bloco de níveis: pirâmide (base larga embaixo) ou funil (largo em cima). */
export const FORMAS_DOS_NIVEIS = ["piramide", "funil"] as const;
/** O estilo da matriz 2x2: SWOT clássico (S, W, O, T com cores) ou neutra. */
export const ESTILOS_DA_MATRIZ = ["swot", "neutro"] as const;

/** O quanto da largura uma imagem ocupa. */
export const LARGURAS_DA_IMAGEM = ["pequena", "media", "grande", "total"] as const;
export type LarguraDaImagem = (typeof LARGURAS_DA_IMAGEM)[number];

/** De que lado fica a imagem no bloco "imagem + texto". */
export const LADOS_DA_IMAGEM = ["esquerda", "direita"] as const;

/**
 * A imagem de um bloco é só o NOME do arquivo (`<uuid>.<png|jpg>`) — a empresa dona vem da
 * sessão (ou do link), nunca do conteúdo. Assim uma página não consegue apontar para a imagem
 * de outra empresa. Vazio = ainda sem imagem (o rascunho em construção).
 */
export const NOME_DE_IMAGEM =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(?:png|jpg)$/;
const arquivoDeImagem = z.string().refine((a) => a === "" || NOME_DE_IMAGEM.test(a), {
  message: "Imagem inválida.",
});
const alinhamento = z.enum(ALINHAMENTOS).optional();

const id = z.string().min(1).max(40);
const curto = z.string().trim().max(200);
const longo = z.string().max(5000);
const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);
/** Vazio é aceito (o rascunho ainda sendo escrito); preenchido, só http(s) — nunca `javascript:`. */
const enderecoWeb = z
  .string()
  .trim()
  .max(500)
  .refine((u) => u === "" || /^https?:\/\/[^\s]+$/i.test(u), { message: "Use um link http(s)." });

export const blocoSchema = z.discriminatedUnion("tipo", [
  z.object({
    id,
    tipo: z.literal("titulo"),
    nivel: z.union([z.literal(1), z.literal(2)]),
    texto: curto,
    alinhamento,
  }),
  z.object({ id, tipo: z.literal("texto"), texto: longo, alinhamento }),
  z.object({
    id,
    tipo: z.literal("destaque"),
    tom: z.enum(["info", "sucesso", "atencao"]),
    texto: longo,
  }),
  z.object({
    id,
    tipo: z.literal("lista"),
    estilo: z.enum(["marcadores", "numerada", "check"]),
    itens: z.array(curto).max(40),
  }),
  z.object({
    id,
    tipo: z.literal("cards"),
    itens: z.array(z.object({ titulo: curto, texto: longo.max(1200) })).max(12),
  }),
  z.object({
    id,
    tipo: z.literal("metricas"),
    itens: z
      .array(z.object({ rotulo: curto, valor: z.string().trim().max(40), detalhe: curto }))
      .max(8),
  }),
  z.object({
    id,
    tipo: z.literal("antes-depois"),
    antes: z.object({ titulo: curto, texto: longo.max(1500), imagem: arquivoDeImagem.optional() }),
    depois: z.object({ titulo: curto, texto: longo.max(1500), imagem: arquivoDeImagem.optional() }),
  }),
  z.object({
    id,
    tipo: z.literal("paleta"),
    cores: z.array(z.object({ nome: curto.max(40), hex })).max(16),
  }),
  z.object({
    id,
    tipo: z.literal("links"),
    itens: z.array(z.object({ rotulo: curto, url: enderecoWeb })).max(30),
  }),
  z.object({ id, tipo: z.literal("citacao"), texto: longo.max(1000), autor: curto, alinhamento }),
  z.object({
    id,
    tipo: z.literal("imagem"),
    arquivo: arquivoDeImagem,
    legenda: curto,
    largura: z.enum(LARGURAS_DA_IMAGEM),
    alinhamento: z.enum(ALINHAMENTOS),
  }),
  z.object({
    id,
    tipo: z.literal("imagem-texto"),
    arquivo: arquivoDeImagem,
    titulo: curto,
    texto: longo.max(2500),
    lado: z.enum(LADOS_DA_IMAGEM),
  }),
  z.object({
    id,
    tipo: z.literal("piramide"),
    forma: z.enum(FORMAS_DOS_NIVEIS),
    /** Do TOPO para a base (pirâmide) ou do topo largo para a ponta (funil). */
    itens: z.array(z.object({ titulo: curto, texto: longo.max(600) })).max(8),
  }),
  z.object({
    id,
    tipo: z.literal("fluxo"),
    itens: z.array(z.object({ titulo: curto, texto: curto })).max(24),
  }),
  z.object({
    id,
    tipo: z.literal("matriz"),
    estilo: z.enum(ESTILOS_DA_MATRIZ),
    /** Na ordem: alto-esquerda, alto-direita, baixo-esquerda, baixo-direita. */
    celulas: z.array(z.object({ titulo: curto, texto: longo.max(1500) })).max(4),
  }),
  z.object({ id, tipo: z.literal("separador") }),
]);

export type Bloco = z.infer<typeof blocoSchema>;

export const blocosSchema = z.array(blocoSchema).max(MAXIMO_DE_BLOCOS);

/**
 * Lê uma lista de blocos vinda do banco SEM nunca quebrar a tela: o bloco inválido (um tipo
 * que mudou de forma, um dado antigo) é descartado, e os demais seguem.
 */
export function lerBlocos(bruto: unknown): Bloco[] {
  if (!Array.isArray(bruto)) return [];
  const saida: Bloco[] = [];
  for (const candidato of bruto.slice(0, MAXIMO_DE_BLOCOS)) {
    const lido = blocoSchema.safeParse(candidato);
    if (lido.success) saida.push(lido.data);
  }
  return saida;
}

/** Um bloco novo, em branco, do tipo pedido (o que o "+ Adicionar bloco" cria). */
export function blocoEmBranco(tipo: TipoDeBloco, novoId: string): Bloco {
  switch (tipo) {
    case "titulo":
      return { id: novoId, tipo, nivel: 1, texto: "" };
    case "texto":
      return { id: novoId, tipo, texto: "" };
    case "destaque":
      return { id: novoId, tipo, tom: "info", texto: "" };
    case "lista":
      return { id: novoId, tipo, estilo: "marcadores", itens: [""] };
    case "cards":
      return {
        id: novoId,
        tipo,
        itens: [
          { titulo: "", texto: "" },
          { titulo: "", texto: "" },
        ],
      };
    case "metricas":
      return { id: novoId, tipo, itens: [{ rotulo: "", valor: "", detalhe: "" }] };
    case "antes-depois":
      return {
        id: novoId,
        tipo,
        antes: { titulo: "", texto: "" },
        depois: { titulo: "", texto: "" },
      };
    case "paleta":
      return { id: novoId, tipo, cores: [{ nome: "", hex: "#366D6F" }] };
    case "links":
      return { id: novoId, tipo, itens: [{ rotulo: "", url: "" }] };
    case "citacao":
      return { id: novoId, tipo, texto: "", autor: "" };
    case "imagem":
      return {
        id: novoId,
        tipo,
        arquivo: "",
        legenda: "",
        largura: "grande",
        alinhamento: "centro",
      };
    case "imagem-texto":
      return { id: novoId, tipo, arquivo: "", titulo: "", texto: "", lado: "esquerda" };
    case "piramide":
      return {
        id: novoId,
        tipo,
        forma: "piramide",
        itens: [
          { titulo: "", texto: "" },
          { titulo: "", texto: "" },
          { titulo: "", texto: "" },
        ],
      };
    case "fluxo":
      return {
        id: novoId,
        tipo,
        itens: [
          { titulo: "", texto: "" },
          { titulo: "", texto: "" },
          { titulo: "", texto: "" },
        ],
      };
    case "matriz":
      return {
        id: novoId,
        tipo,
        estilo: "swot",
        celulas: [
          { titulo: "Forças", texto: "" },
          { titulo: "Fraquezas", texto: "" },
          { titulo: "Oportunidades", texto: "" },
          { titulo: "Ameaças", texto: "" },
        ],
      };
    case "separador":
      return { id: novoId, tipo };
  }
}
