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
  { chave: "produtos-e-ofertas", fase: "produto-e-oferta", tom: "purple", icone: "Package" },
  { chave: "lead-magnets", fase: "produto-e-oferta", tom: "purple", icone: "Magnet" },
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
