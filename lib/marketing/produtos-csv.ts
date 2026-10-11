import { lerNumero } from "@/lib/marketing/calculadora";
import {
  ETAPAS_DA_OFERTA,
  TIPOS_DE_PRECO,
  type EtapaDaOferta,
  type Bloco,
} from "@/lib/marketing/blocos";

/**
 * A PLANILHA DE PRODUTOS (CSV): o jeito rápido de cadastrar muitos produtos e serviços, ou de
 * migrar de outro sistema. Cada linha vira uma oferta SIMPLES (ficha curta); a agência completa
 * depois, página a página, só o que vale a pena.
 *
 * Tudo aqui é puro: ler o CSV, entender os nomes de coluna e de valor como a pessoa escreve
 * (sem acento, maiúscula ou minúscula) e montar o bloco da oferta. A rota de importação roda a
 * MESMA conversão no servidor — a tela só mostra a prévia.
 */

export type Oferta = Extract<Bloco, { tipo: "oferta" }>;

export const MAXIMO_DE_LINHAS = 300;

/** As colunas do modelo, na ordem em que a planilha de exemplo as traz. */
export const COLUNAS_DO_MODELO = [
  "nome",
  "resumo",
  "etapa",
  "tipo_de_preco",
  "preco",
  "setup",
  "carro_chefe",
  "inclui",
  "para_quem",
  "prazo",
  "condicoes",
] as const;
export type ColunaDoModelo = (typeof COLUNAS_DO_MODELO)[number];

/** Como a planilha chama cada coluna (além do nome do modelo), já normalizado. */
const APELIDOS: Record<string, ColunaDoModelo> = {
  nome: "nome",
  produto: "nome",
  servico: "nome",
  titulo: "nome",
  nome_do_produto: "nome",
  resumo: "resumo",
  descricao: "resumo",
  etapa: "etapa",
  etapa_da_escada: "etapa",
  tipo_de_preco: "tipo_de_preco",
  tipo_preco: "tipo_de_preco",
  cobranca: "tipo_de_preco",
  preco: "preco",
  valor: "preco",
  preco_r: "preco",
  setup: "setup",
  taxa_de_setup: "setup",
  implantacao: "setup",
  carro_chefe: "carro_chefe",
  destaque: "carro_chefe",
  inclui: "inclui",
  o_que_inclui: "inclui",
  entregas: "inclui",
  para_quem: "para_quem",
  publico: "para_quem",
  publico_alvo: "para_quem",
  prazo: "prazo",
  condicoes: "condicoes",
  condicoes_de_pagamento: "condicoes",
};

export const semAcento = (texto: string) =>
  texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

const chaveDeColuna = (cabecalho: string) =>
  semAcento(cabecalho)
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

/** O texto do CSV em linhas de campos; aceita `;` `,` ou tabulação, aspas e BOM. */
export function campos(texto: string): string[][] {
  const limpo = texto.replace(/^﻿/, "");
  const primeira = limpo.split(/\r?\n/, 1)[0] ?? "";
  const delimitador = [";", "\t", ","]
    .map((d) => ({ d, n: primeira.split(d).length }))
    .sort((a, b) => b.n - a.n)[0]!.d;
  const linhas: string[][] = [];
  let campo = "";
  let linha: string[] = [];
  let aspas = false;
  for (let i = 0; i < limpo.length; i++) {
    const c = limpo[i]!;
    if (aspas) {
      if (c === '"' && limpo[i + 1] === '"') {
        campo += '"';
        i++;
      } else if (c === '"') aspas = false;
      else campo += c;
    } else if (c === '"') aspas = true;
    else if (c === delimitador) {
      linha.push(campo);
      campo = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && limpo[i + 1] === "\n") i++;
      linha.push(campo);
      campo = "";
      linhas.push(linha);
      linha = [];
    } else campo += c;
  }
  if (campo !== "" || linha.length > 0) {
    linha.push(campo);
    linhas.push(linha);
  }
  return linhas.filter((l) => l.some((c) => c.trim() !== ""));
}

export type LinhaDaPlanilha = Partial<Record<ColunaDoModelo, string>>;

export interface PlanilhaLida {
  linhas: LinhaDaPlanilha[];
  /** Colunas da planilha que não foram reconhecidas (ignoradas). */
  ignoradas: string[];
  erro: string | null;
}

/** Lê o CSV e entrega as linhas já com os nomes de coluna do modelo. */
export function lerPlanilha(texto: string): PlanilhaLida {
  const tabela = campos(texto);
  if (tabela.length === 0) return { linhas: [], ignoradas: [], erro: "vazia" };
  const cabecalho = tabela[0]!.map(chaveDeColuna);
  const mapa = cabecalho.map((c) => APELIDOS[c]);
  if (!mapa.includes("nome")) return { linhas: [], ignoradas: [], erro: "sem_nome" };
  const ignoradas = tabela[0]!.filter((_, i) => !mapa[i] && tabela[0]![i]!.trim() !== "");
  const linhas = tabela.slice(1).map((l) => {
    const saida: LinhaDaPlanilha = {};
    l.forEach((valor, i) => {
      const coluna = mapa[i];
      if (coluna && saida[coluna] === undefined) saida[coluna] = valor.trim();
    });
    return saida;
  });
  return { linhas, ignoradas, erro: null };
}

const ETAPAS: Record<string, EtapaDaOferta> = {
  isca: "isca",
  "isca digital": "isca",
  gratuito: "isca",
  entrada: "entrada",
  principal: "principal",
  expansao: "expansao",
  upsell: "expansao",
  recorrencia: "recorrencia",
  recorrente: "recorrencia",
};
const TIPOS: Record<string, (typeof TIPOS_DE_PRECO)[number]> = {
  unico: "unico",
  "unico (pagamento unico)": "unico",
  "pagamento unico": "unico",
  avulso: "unico",
  mensal: "mensal",
  mensalidade: "mensal",
  "setup + mensal": "setup-mensal",
  "setup+mensal": "setup-mensal",
  "setup-mensal": "setup-mensal",
  "setup e mensal": "setup-mensal",
  "sob consulta": "sob-consulta",
  "sob-consulta": "sob-consulta",
  gratuito: "gratuito",
  gratis: "gratuito",
};
const SIM = new Set(["sim", "s", "x", "1", "true", "verdadeiro", "yes"]);
const NAO = new Set(["", "nao", "n", "0", "false", "falso", "no"]);

/** O dinheiro como a tela mostra: R$ 1.500,00. */
export const moedaDoNumero = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }).replace(/ /g, " ");

export type ResultadoDaLinha =
  { ok: true; titulo: string; oferta: Oferta } | { ok: false; erro: string };

/** Uma linha da planilha como oferta simples; `erro` diz o que corrigir, em português. */
export function ofertaDaLinha(l: LinhaDaPlanilha, novoId: () => string): ResultadoDaLinha {
  const titulo = (l.nome ?? "").trim();
  if (titulo === "") return { ok: false, erro: "Falta o nome." };
  if (titulo.length > 200) return { ok: false, erro: "O nome passa de 200 letras." };

  const etapaBruta = semAcento(l.etapa ?? "");
  const etapa = etapaBruta === "" ? "principal" : ETAPAS[etapaBruta];
  if (!etapa) {
    return {
      ok: false,
      erro: `Etapa desconhecida: "${l.etapa}". Use ${ETAPAS_DA_OFERTA.join(", ")}.`,
    };
  }

  const precoBruto = (l.preco ?? "").trim();
  const preco = precoBruto === "" ? null : lerNumero(precoBruto);
  if (precoBruto !== "" && preco === null) {
    return { ok: false, erro: `Preço inválido: "${precoBruto}".` };
  }
  const setupBruto = (l.setup ?? "").trim();
  const setup = setupBruto === "" ? null : lerNumero(setupBruto);
  if (setupBruto !== "" && setup === null) {
    return { ok: false, erro: `Setup inválido: "${setupBruto}".` };
  }

  const tipoBruto = semAcento(l.tipo_de_preco ?? "");
  let tipo: (typeof TIPOS_DE_PRECO)[number];
  if (tipoBruto === "") {
    tipo =
      setup !== null && preco !== null ? "setup-mensal" : preco === null ? "sob-consulta" : "unico";
  } else {
    const lido = TIPOS[tipoBruto];
    if (!lido) {
      return {
        ok: false,
        erro: `Tipo de preço desconhecido: "${l.tipo_de_preco}". Use único, mensal, setup + mensal, sob consulta ou gratuito.`,
      };
    }
    tipo = lido;
  }

  const chefeBruto = semAcento(l.carro_chefe ?? "");
  if (!SIM.has(chefeBruto) && !NAO.has(chefeBruto)) {
    return { ok: false, erro: `Carro-chefe deve ser sim ou não (veio "${l.carro_chefe}").` };
  }

  const inclui = (l.inclui ?? "")
    .split(/[|\n]/)
    .map((i) => i.trim().slice(0, 200))
    .filter(Boolean)
    .slice(0, 14);

  const oferta: Oferta = {
    id: novoId(),
    tipo: "oferta",
    nivel: "simples",
    etapa,
    carroChefe: SIM.has(chefeBruto),
    resumo: (l.resumo ?? "").slice(0, 800),
    paraQuem: (l.para_quem ?? "").slice(0, 600),
    naoEParaQuem: "",
    inclui: inclui.length > 0 ? inclui : [""],
    naoInclui: [],
    prazo: (l.prazo ?? "").slice(0, 200),
    preco: {
      tipo,
      valor: preco === null ? "" : moedaDoNumero(preco),
      setup: setup === null ? "" : moedaDoNumero(setup),
      condicoes: (l.condicoes ?? "").slice(0, 400),
    },
    faq: [],
    nuncaPrometer: [],
    promessa: "",
    entregaveis: [],
    bonus: [],
    custoDaInacao: "",
    garantia: "",
    escassez: "",
    objecoes: [],
  };
  return { ok: true, titulo, oferta };
}

/** O modelo para baixar: cabeçalho e dois exemplos, com `;` e BOM para abrir bem no Excel. */
export function modeloDaPlanilha(): string {
  const linhas = [
    [...COLUNAS_DO_MODELO],
    [
      "Diagnóstico gratuito",
      "Conversa de 30 minutos para entender o negócio e apontar os próximos passos",
      "isca",
      "gratuito",
      "",
      "",
      "não",
      "Análise do funil|Plano de ação em 3 passos",
      "Donos de clínica que querem vender mais",
      "7 dias",
      "",
    ],
    [
      "Gestão de tráfego pago",
      "Anúncios no Meta e no Google com relatório mensal",
      "principal",
      "setup + mensal",
      "1500,00",
      "500,00",
      "sim",
      "Criativos|Relatório mensal|Reunião de resultados",
      "Clínicas com ticket acima de R$ 500",
      "Contrato de 3 meses",
      "Pix ou cartão",
    ],
  ];
  const escapa = (c: string) => (/[;"\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c);
  return `﻿${linhas.map((l) => l.map(escapa).join(";")).join("\r\n")}\r\n`;
}
