/**
 * OS MÓDULOS DA ESTRATÉGIA DE MARKETING — o método da agência, em fases.
 *
 * Só a ESTRUTURA mora aqui (chave, fase, cor da capa, ícone, rota): é o que o banco passa a
 * guardar quando as páginas forem editáveis (`marketing_pages.module_key`). O TEXTO de cada
 * módulo (título, descrição) mora na tela, em `t()`, para passar pela tradução.
 *
 * A estrutura segue o painel "Profile do Cliente" do Notion do Arthur:
 *   01 Diagnóstico · 02 Produto e Oferta · 03 Geração de Demanda.
 */
export const FASES_DA_ESTRATEGIA = [
  "diagnostico",
  "produto-e-oferta",
  "geracao-de-demanda",
] as const;
export type FaseDaEstrategia = (typeof FASES_DA_ESTRATEGIA)[number];

/** A cor da capa (e da etiqueta da fase), dentre as cores do motor de tabelas. */
export type TomDaCapa =
  "orange" | "purple" | "blue" | "green" | "pink" | "red" | "yellow" | "brown" | "gray";

export interface ModuloDaEstrategia {
  chave: string;
  fase: FaseDaEstrategia;
  tom: TomDaCapa;
  /** Nome do ícone em `lib/ui/icons`. */
  icone:
    | "Rocket"
    | "Funnel"
    | "Compass"
    | "Eye"
    | "Palette"
    | "UsersThree"
    | "Binoculars"
    | "Briefcase"
    | "Package"
    | "Magnet"
    | "Lightbulb"
    | "Target"
    | "Megaphone"
    | "Handshake"
    | "ShareNetwork"
    | "InstagramLogo";
}

export const TOM_DA_FASE: Record<FaseDaEstrategia, TomDaCapa> = {
  diagnostico: "orange",
  "produto-e-oferta": "purple",
  "geracao-de-demanda": "blue",
};

export const MODULOS_DA_ESTRATEGIA: readonly ModuloDaEstrategia[] = [
  // 01 | Diagnóstico
  { chave: "mapeamento-do-funil", fase: "diagnostico", tom: "orange", icone: "Funnel" },
  { chave: "posicionamento-zmot", fase: "diagnostico", tom: "orange", icone: "Compass" },
  { chave: "identidade-da-marca", fase: "diagnostico", tom: "orange", icone: "Palette" },
  // 02 | Produto e Oferta
  { chave: "estudo-de-persona", fase: "produto-e-oferta", tom: "purple", icone: "UsersThree" },
  {
    chave: "analise-de-concorrencia",
    fase: "produto-e-oferta",
    tom: "purple",
    icone: "Binoculars",
  },
  {
    chave: "planejamento-empresarial",
    fase: "produto-e-oferta",
    tom: "purple",
    icone: "Briefcase",
  },
  // 03 | Geração de Demanda
  { chave: "estrategia-de-marketing", fase: "geracao-de-demanda", tom: "blue", icone: "Lightbulb" },
  { chave: "trafego-pago", fase: "geracao-de-demanda", tom: "blue", icone: "Target" },
  { chave: "outbound-marketing", fase: "geracao-de-demanda", tom: "blue", icone: "Megaphone" },
  { chave: "programas-de-indicacao", fase: "geracao-de-demanda", tom: "blue", icone: "Handshake" },
  { chave: "social-media", fase: "geracao-de-demanda", tom: "blue", icone: "InstagramLogo" },
  {
    chave: "parcerias-e-influenciadores",
    fase: "geracao-de-demanda",
    tom: "blue",
    icone: "ShareNetwork",
  },
];

export const moduloPorChave = (chave: string): ModuloDaEstrategia | undefined =>
  MODULOS_DA_ESTRATEGIA.find((m) => m.chave === chave);

export const modulosDaFase = (fase: FaseDaEstrategia): ModuloDaEstrategia[] =>
  MODULOS_DA_ESTRATEGIA.filter((m) => m.fase === fase);

/**
 * SUBPÁGINAS — páginas filhas de um módulo (ex.: as várias personas dentro de "Estudo de
 * persona", a pesquisa de mercado, a árvore de situações incômodas…). Cada uma é uma página
 * comum (`marketing_pages`) cuja chave é `<módulo>--<tipo>` (uma só) ou `<módulo>--<tipo>-<id>`
 * (várias do mesmo tipo). A lista de tipos permitidos mora aqui; o título é da agência.
 */
export interface TipoDeSubpagina {
  tipo: string;
  /** Pode haver várias do mesmo tipo (ex.: uma persona por perfil de cliente ideal). */
  repetivel: boolean;
  icone: ModuloDaEstrategia["icone"];
}

export const SUBPAGINAS_DOS_MODULOS: Readonly<Record<string, readonly TipoDeSubpagina[]>> = {
  "estudo-de-persona": [
    { tipo: "pesquisa-de-mercado", repetivel: false, icone: "Binoculars" },
    { tipo: "persona", repetivel: true, icone: "UsersThree" },
    { tipo: "arvore-de-situacoes", repetivel: false, icone: "Target" },
    { tipo: "arquitetura-de-premissas", repetivel: false, icone: "Lightbulb" },
    { tipo: "porques", repetivel: false, icone: "Compass" },
  ],
  "analise-de-concorrencia": [
    { tipo: "pesquisa-de-mercado", repetivel: false, icone: "Binoculars" },
    { tipo: "perguntas-chave", repetivel: false, icone: "Lightbulb" },
    { tipo: "concorrente", repetivel: true, icone: "Target" },
  ],
};

export const tiposDeSubpagina = (modulo: string): readonly TipoDeSubpagina[] =>
  SUBPAGINAS_DOS_MODULOS[modulo] ?? [];

const FORMA_DO_ID_DE_SUBPAGINA = /^[a-z0-9]{4,12}$/;

/** A chave de uma subpágina. `id` só para os tipos repetíveis. */
export function chaveDeSubpagina(modulo: string, tipo: string, id?: string): string {
  return id ? `${modulo}--${tipo}-${id}` : `${modulo}--${tipo}`;
}

export interface ChaveLida {
  /** O módulo (a página-mãe). */
  modulo: string;
  /** `null` = é a página do próprio módulo. */
  tipo: string | null;
}

/** Lê a chave de uma página: um módulo, ou uma subpágina de um tipo permitido. `null` = inválida. */
export function lerChaveDePagina(chave: string): ChaveLida | null {
  if (moduloPorChave(chave)) return { modulo: chave, tipo: null };
  const corte = chave.indexOf("--");
  if (corte < 1) return null;
  const modulo = chave.slice(0, corte);
  const resto = chave.slice(corte + 2);
  if (!moduloPorChave(modulo)) return null;
  for (const t of tiposDeSubpagina(modulo)) {
    if (resto === t.tipo && !t.repetivel) return { modulo, tipo: t.tipo };
    if (t.repetivel && resto.startsWith(`${t.tipo}-`)) {
      if (FORMA_DO_ID_DE_SUBPAGINA.test(resto.slice(t.tipo.length + 1))) {
        return { modulo, tipo: t.tipo };
      }
    }
  }
  return null;
}
