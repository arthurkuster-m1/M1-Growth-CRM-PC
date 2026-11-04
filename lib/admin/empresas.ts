import type { EmpresaDoResumo } from "@/hooks/useResumoDasEmpresas";
import type { CorDaOpcao } from "@/lib/tarefas/opcoes-de-status";
import type { CampoConsultavel, TipoDeCampo } from "@/lib/motor/consulta";

/**
 * AS PROPRIEDADES DE UMA EMPRESA no Modo agência. Uma lista só descreve cada propriedade para a
 * tabela, para o cartão e para o filtro — assim as três não discordam. `nome` é o título (sempre
 * visível, com o botão "Abrir"); as demais são escolhidas por quem usa, separadamente na tabela e
 * nos cartões.
 */
export type IdDaPropriedade =
  | "slug"
  | "situacao"
  | "usuarios_ativos"
  | "campanhas_ativas"
  | "investimento"
  | "leads"
  | "vendas"
  | "faturamento"
  | "entrada"
  | "mensalidade"
  | "proximo_pagamento";

export interface PropriedadeDaEmpresa {
  id: IdDaPropriedade;
  /** Português, passa por `t()` na tela. */
  titulo: string;
  tipo: TipoDeCampo;
  largura: number;
  /** Aparece sem a pessoa ter escolhido nada, na tabela / nos cartões. */
  padraoNaTabela: boolean;
  padraoNoCartao: boolean;
  opcoes?: ReadonlyArray<{ id: string; rotulo: string; cor: CorDaOpcao }>;
}

export const SITUACOES = [
  { id: "active", rotulo: "Ativa", cor: "green" },
  { id: "onboarding", rotulo: "Onboarding", cor: "blue" },
  { id: "suspended", rotulo: "Suspensa", cor: "orange" },
  { id: "redacted", rotulo: "Anonimizada", cor: "red" },
] as const satisfies ReadonlyArray<{ id: string; rotulo: string; cor: CorDaOpcao }>;

export const MENSALIDADES = [
  { id: "pago", rotulo: "Pago", cor: "green" },
  { id: "pendente", rotulo: "Pendente", cor: "red" },
] as const satisfies ReadonlyArray<{ id: string; rotulo: string; cor: CorDaOpcao }>;

export const PROPRIEDADES_DA_EMPRESA: readonly PropriedadeDaEmpresa[] = [
  {
    id: "slug",
    titulo: "Slug",
    tipo: "texto",
    largura: 150,
    padraoNaTabela: true,
    padraoNoCartao: false,
  },
  {
    id: "situacao",
    titulo: "Situação",
    tipo: "opcao",
    largura: 130,
    padraoNaTabela: true,
    padraoNoCartao: true,
    opcoes: SITUACOES,
  },
  {
    id: "usuarios_ativos",
    titulo: "Usuários ativos",
    tipo: "numero",
    largura: 130,
    padraoNaTabela: true,
    padraoNoCartao: true,
  },
  {
    id: "campanhas_ativas",
    titulo: "Campanhas ativas",
    tipo: "numero",
    largura: 150,
    padraoNaTabela: true,
    padraoNoCartao: true,
  },
  {
    id: "investimento",
    titulo: "Investimento em marketing",
    tipo: "numero",
    largura: 190,
    padraoNaTabela: true,
    padraoNoCartao: true,
  },
  {
    id: "leads",
    titulo: "Leads",
    tipo: "numero",
    largura: 100,
    padraoNaTabela: true,
    padraoNoCartao: true,
  },
  {
    id: "vendas",
    titulo: "Vendas",
    tipo: "numero",
    largura: 100,
    padraoNaTabela: true,
    padraoNoCartao: true,
  },
  {
    id: "faturamento",
    titulo: "Faturamento",
    tipo: "numero",
    largura: 150,
    padraoNaTabela: true,
    padraoNoCartao: true,
  },
  {
    id: "entrada",
    titulo: "Data de entrada",
    tipo: "data",
    largura: 140,
    padraoNaTabela: true,
    padraoNoCartao: false,
  },
  {
    id: "mensalidade",
    titulo: "Status da mensalidade",
    tipo: "opcao",
    largura: 170,
    padraoNaTabela: true,
    padraoNoCartao: true,
    opcoes: MENSALIDADES,
  },
  {
    id: "proximo_pagamento",
    titulo: "Próximo pagamento",
    tipo: "data",
    largura: 160,
    padraoNaTabela: true,
    padraoNoCartao: false,
  },
];

/** O valor de uma propriedade como o FILTRO e a ordenação o leem (dinheiro em reais). */
export function valorDaPropriedade(e: EmpresaDoResumo, id: IdDaPropriedade | "nome") {
  switch (id) {
    case "nome":
      return e.nome;
    case "slug":
      return e.slug;
    case "situacao":
      return e.situacao;
    case "usuarios_ativos":
      return e.usuarios_ativos;
    case "campanhas_ativas":
      return e.campanhas_ativas;
    case "investimento":
      return e.investimento_cents / 100;
    case "leads":
      return e.leads;
    case "vendas":
      return e.vendas;
    case "faturamento":
      return e.faturamento_cents / 100;
    case "entrada":
      return e.entrada;
    case "mensalidade":
      return e.mensalidade;
    case "proximo_pagamento":
      return e.proximo_pagamento;
  }
}

/** Os campos que a barra de filtro e a ordenação enxergam: o nome e todas as propriedades. */
export function camposConsultaveis(
  t: (s: string) => string,
): Array<CampoConsultavel<EmpresaDoResumo> & { titulo: string }> {
  const rotuloDe = (lista: readonly { id: string; rotulo: string }[] | undefined) => (v: string) =>
    t(lista?.find((o) => o.id === v)?.rotulo ?? v);
  return [
    { id: "nome", titulo: t("Nome"), tipo: "texto", valorDe: (e) => e.nome },
    ...PROPRIEDADES_DA_EMPRESA.map((p) => ({
      id: p.id,
      titulo: t(p.titulo),
      tipo: p.tipo,
      valorDe: (e: EmpresaDoResumo) => valorDaPropriedade(e, p.id),
      ...(p.opcoes ? { rotuloDoValor: rotuloDe(p.opcoes) } : {}),
    })),
  ];
}

export function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  const letras = (partes.length > 1 ? [partes[0], partes[1]] : [partes[0] ?? "?"]).map(
    (p) => p?.[0] ?? "",
  );
  return letras.join("").toUpperCase().slice(0, 2);
}
