import type { Categoria, Conta, NovoLancamento, TipoLancamento } from "./tipos";
import { faturaPadrao, mesSeguinte, parseValor } from "./formato";

/** Uma linha como vem da tabela/CSV: tudo texto, do jeito que a pessoa colou. */
export type LinhaCrua = {
  data?: string;
  conta?: string;
  categoria?: string;
  valor?: string;
  nota?: string;
  tipo?: string;
  destino?: string;
  fatura?: string;
  situacao?: string;
};
export type CampoLinha = keyof LinhaCrua;

export type ContextoImportacao = {
  contas: Conta[];
  categorias: Categoria[];
  anoRef: number;
  tipoPadrao: TipoLancamento;
  hoje: string;
};

export type ResultadoLinha =
  | { estado: "vazia" }
  | { estado: "ignorada"; motivo: string }
  | {
      estado: "erro";
      erros: string[];
      categoriaFaltando?: { nome: string; tipo: "entrada" | "saida" };
    }
  | { estado: "abertura"; conta: Conta; mes: string; cents: number; avisos: string[] }
  | { estado: "ok"; lancamento: NovoLancamento; avisos: string[]; chave: string };

export const normalizar = (s: string | null | undefined) =>
  (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim().toLowerCase();

const pad = (n: number) => String(n).padStart(2, "0");

/** "01/10", "1/10/26", "01/10/2026", "2026-10-01" → "AAAA-MM-DD". Data impossível → null. */
export function parseData(texto: string, anoRef: number): string | null {
  const t = texto.trim();
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t);
  let a: number, mes: number, d: number;
  if (m) {
    a = +m[1]!;
    mes = +m[2]!;
    d = +m[3]!;
  } else {
    m = /^(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2}|\d{4}))?$/.exec(t);
    if (!m) return null;
    d = +m[1]!;
    mes = +m[2]!;
    a = m[3] ? (m[3].length === 2 ? 2000 + +m[3] : +m[3]) : anoRef;
  }
  const dt = new Date(a, mes - 1, d);
  if (dt.getFullYear() !== a || dt.getMonth() !== mes - 1 || dt.getDate() !== d) return null;
  return `${a}-${pad(mes)}-${pad(d)}`;
}

export function parseTipo(texto: string): TipoLancamento | null | "invalido" {
  const t = normalizar(texto);
  if (!t) return null;
  if (["saida", "saidas", "s", "despesa", "gasto"].includes(t)) return "saida";
  if (["entrada", "entradas", "e", "receita"].includes(t)) return "entrada";
  if (["transferencia", "transferencias", "transf", "transf.", "t"].includes(t))
    return "transferencia";
  return "invalido";
}

export function parseSituacao(
  texto: string,
): "pago" | "pendente" | "cancelado" | null | "invalido" {
  const t = normalizar(texto);
  if (!t) return null;
  if (["pago", "paga", "p", "ok"].includes(t)) return "pago";
  if (["previsto", "prevista", "pendente", "previsao"].includes(t)) return "pendente";
  if (["cancelado", "cancelada"].includes(t)) return "cancelado";
  return "invalido";
}

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
/** "2026-11", "11/2026", "nov/2026", "nov/26", "novembro de 2026", "nov" → "AAAA-MM". */
export function parseFatura(texto: string, anoRef: number): string | null {
  const t = normalizar(texto)
    .replace(/\s+de\s+/, "/")
    .replace(/\s+/g, "/");
  let m = /^(\d{4})-(\d{1,2})$/.exec(t);
  if (m && +m[2]! >= 1 && +m[2]! <= 12) return `${m[1]}-${pad(+m[2]!)}`;
  m = /^(\d{1,2})\/(\d{4})$/.exec(t);
  if (m && +m[1]! >= 1 && +m[1]! <= 12) return `${m[2]}-${pad(+m[1]!)}`;
  m = /^([a-z]{3})[a-z]*(?:\/(\d{2}|\d{4}))?$/.exec(t);
  if (m) {
    const i = MESES.indexOf(m[1]!);
    if (i < 0) return null;
    const a = m[2] ? (m[2].length === 2 ? 2000 + +m[2] : +m[2]) : anoRef;
    return `${a}-${pad(i + 1)}`;
  }
  return null;
}

/** "R$ 1.234,56", "-R$ 61,78", "(12,50)", " R$  13.227,20 " → centavos com sinal. Vazio ou ilegível → null. */
export function parseValorComSinal(texto: string): number | null {
  let t = texto.replace(/\u00a0/g, " ").trim();
  if (!t) return null;
  let neg = false;
  if (/^[-−–]/.test(t)) {
    neg = true;
    t = t.slice(1).trim();
  } else if (/^\(.*\)$/.test(t)) {
    neg = true;
    t = t.slice(1, -1).trim();
  }
  const c = parseValor(t);
  return c == null ? null : (neg ? -c : c) + 0; // + 0 troca -0 por 0
}

export function acharConta(nome: string, contas: Conta[]): Conta | undefined {
  const n = normalizar(nome);
  if (!n) return undefined;
  return (
    contas.find((c) => normalizar(c.nome) === n) ??
    (() => {
      const p = contas.filter((c) => normalizar(c.nome).startsWith(n));
      return p.length === 1 ? p[0] : undefined;
    })()
  );
}

/** Procura a categoria pelo nome, preferindo a do mesmo tipo; aceita a do outro tipo (estorno de despesa, por exemplo). */
export function acharCategoria(
  nome: string,
  tipo: "entrada" | "saida",
  categorias: Categoria[],
): { cat: Categoria; outroTipo: boolean } | undefined {
  const n = normalizar(nome);
  if (!n) return undefined;
  const iguais = categorias.filter((c) => normalizar(c.nome) === n);
  const mesmo = iguais.find((c) => c.tipo === tipo);
  if (mesmo) return { cat: mesmo, outroTipo: false };
  return iguais[0] ? { cat: iguais[0], outroTipo: true } : undefined;
}

const vazio = (s: string | undefined) => !s || !s.trim();

export function validarLinha(l: LinhaCrua, ctx: ContextoImportacao): ResultadoLinha {
  if (Object.values(l).every(vazio)) return { estado: "vazia" };
  const erros: string[] = [];
  const avisos: string[] = [];

  const data = vazio(l.data) ? null : parseData(l.data!, ctx.anoRef);
  if (!data)
    erros.push(
      vazio(l.data)
        ? "Falta a data."
        : `Data inválida: "${l.data!.trim()}" (use 05/10 ou 05/10/2026).`,
    );

  const conta = acharConta(l.conta ?? "", ctx.contas);
  if (vazio(l.conta)) erros.push("Falta a conta.");
  else if (!conta)
    erros.push(`A conta "${l.conta!.trim()}" não existe (cadastre em Configurações).`);
  else if (conta.tipo === "bem") erros.push(`"${conta.nome}" é um bem e não recebe lançamentos.`);

  let tipo: TipoLancamento = ctx.tipoPadrao;
  const t = parseTipo(l.tipo ?? "");
  if (t === "invalido")
    erros.push(`Tipo inválido: "${l.tipo!.trim()}" (saída, entrada ou transferência).`);
  else if (t) tipo = t;

  const valorBruto = vazio(l.valor) ? null : parseValorComSinal(l.valor!);
  if (!vazio(l.valor) && valorBruto === null) erros.push(`Valor inválido: "${l.valor!.trim()}".`);

  // "Caixa" na planilha = saldo de abertura do mês daquela conta; não é entrada (senão o mês fica inflado).
  if (normalizar(l.categoria) === "caixa" && tipo === "entrada") {
    if (!data || !conta || valorBruto === null || erros.length)
      return erros.length
        ? { estado: "erro", erros }
        : { estado: "erro", erros: ["Falta o valor do saldo."] };
    return {
      estado: "abertura",
      conta,
      mes: data.slice(0, 7),
      cents: valorBruto,
      avisos: ["Vira saldo de abertura do mês, não entrada."],
    };
  }

  // Linha sem valor (ou zerada) não é lançamento, mesmo que outra coisa esteja errada nela: é ignorada.
  if (vazio(l.valor)) return { estado: "ignorada", motivo: "sem valor" };
  if (valorBruto === 0) return { estado: "ignorada", motivo: "valor zero" };

  const cents = valorBruto == null ? 0 : Math.abs(valorBruto);
  let tipoFinal = tipo;
  if (valorBruto != null && valorBruto < 0) {
    if (tipo === "transferencia")
      erros.push("Transferência não pode ter valor negativo (troque origem e destino).");
    else {
      tipoFinal = tipo === "saida" ? "entrada" : "saida";
      avisos.push(
        tipo === "saida"
          ? "Valor negativo: lançado como entrada (estorno/crédito)."
          : "Valor negativo: lançado como saída.",
      );
    }
  }

  let account_destino_id: string | null = null;
  let category_id: string | null = null;
  let categoriaFaltando: { nome: string; tipo: "entrada" | "saida" } | undefined;
  if (tipoFinal === "transferencia") {
    const destino = acharConta(l.destino ?? "", ctx.contas);
    if (vazio(l.destino)) erros.push("Transferência precisa da conta de destino.");
    else if (!destino) erros.push(`A conta de destino "${l.destino!.trim()}" não existe.`);
    else if (conta && destino.id === conta.id)
      erros.push("Origem e destino precisam ser contas diferentes.");
    else account_destino_id = destino.id;
    if (!vazio(l.categoria)) avisos.push("Categoria ignorada (transferência não tem categoria).");
  } else {
    if (vazio(l.categoria)) erros.push("Falta a categoria.");
    else {
      const achada = acharCategoria(l.categoria!, tipoFinal, ctx.categorias);
      if (!achada) {
        erros.push(`A categoria "${l.categoria!.trim()}" não existe.`);
        categoriaFaltando = { nome: l.categoria!.trim(), tipo: tipoFinal };
      } else {
        category_id = achada.cat.id;
        if (achada.outroTipo)
          avisos.push(
            `"${achada.cat.nome}" é categoria de ${achada.cat.tipo === "saida" ? "saída" : "entrada"}: usada para ${tipoFinal === "entrada" ? "estornar" : "ajustar"}.`,
          );
      }
    }
  }

  let status: "pago" | "pendente" | "cancelado" = "pago";
  const s = parseSituacao(l.situacao ?? "");
  if (s === "invalido")
    erros.push(`Situação inválida: "${l.situacao!.trim()}" (pago, previsto ou cancelado).`);
  else if (s) status = s;
  if (data && status === "pago" && data > ctx.hoje) {
    status = "pendente";
    avisos.push("Data futura: marcado como previsto.");
  }

  let fatura_mes: string | null = null;
  if (conta?.tipo === "cartao" && tipoFinal !== "transferencia" && data) {
    if (!vazio(l.fatura)) {
      const f = parseFatura(l.fatura!, ctx.anoRef);
      if (!f) erros.push(`Fatura inválida: "${l.fatura!.trim()}" (ex.: nov/2026).`);
      else fatura_mes = `${f}-01`;
    } else fatura_mes = `${faturaPadrao(data, conta.dia_fechamento, conta.dia_vencimento)}-01`;
  } else if (!vazio(l.fatura) && conta) avisos.push("Fatura ignorada (a conta não é cartão).");

  if (erros.length || !data || !conta) return { estado: "erro", erros, categoriaFaltando };
  const nota = l.nota?.trim() || null;
  const lancamento: NovoLancamento = {
    data,
    valor_cents: cents,
    tipo: tipoFinal,
    status,
    nota,
    category_id,
    account_id: conta.id,
    account_destino_id,
    fatura_mes,
  };
  const chave = [
    data,
    tipoFinal,
    cents,
    conta.id,
    account_destino_id ?? "",
    category_id ?? "",
    normalizar(nota),
    fatura_mes ?? "",
  ].join("|");
  return { estado: "ok", lancamento, avisos, chave };
}

/* ───── Cabeçalho e colunas (colar da planilha ou ler CSV) ───── */
export const CAMPOS_PADRAO: CampoLinha[] = [
  "data",
  "conta",
  "categoria",
  "valor",
  "nota",
  "tipo",
  "destino",
  "fatura",
  "situacao",
];
const SINONIMOS: Record<string, CampoLinha> = {
  data: "data",
  c: "conta",
  conta: "conta",
  cartao: "conta",
  categoria: "categoria",
  entradas: "categoria",
  saidas: "categoria",
  valor: "valor",
  nota: "nota",
  anotacao: "nota",
  obs: "nota",
  observacao: "nota",
  descricao: "nota",
  tipo: "tipo",
  destino: "destino",
  para: "destino",
  fatura: "fatura",
  situacao: "situacao",
  status: "situacao",
};

/** Matriz de texto (TSV colado ou CSV) → linhas cruas. Reconhece cabeçalho; "Entradas"/"Saídas" no cabeçalho definem o tipo. */
export function linhasDeMatriz(matriz: string[][]): {
  linhas: LinhaCrua[];
  tipoDoCabecalho?: TipoLancamento;
  temCabecalho: boolean;
} {
  const rows = matriz.filter((r) => r.some((c) => c && c.trim()));
  if (rows.length === 0) return { linhas: [], temCabecalho: false };
  const cab = rows[0]!.map(normalizar);
  const temCabecalho = cab.includes("data");
  let mapa: (CampoLinha | null)[] = CAMPOS_PADRAO.slice(0, Math.max(rows[0]!.length, 5));
  let tipoDoCabecalho: TipoLancamento | undefined;
  if (temCabecalho) {
    const usados = new Set<CampoLinha>();
    mapa = cab.map((h) => {
      const c = SINONIMOS[h];
      if (c && !usados.has(c)) {
        usados.add(c);
        if (h === "entradas") tipoDoCabecalho = "entrada";
        if (h === "saidas") tipoDoCabecalho = "saida";
        return c;
      }
      return null;
    });
    // colunas sem título reconhecível (ex.: o valor na planilha) seguem a ordem padrão se o campo ainda estiver livre
    mapa = mapa.map(
      (c, i) =>
        c ??
        (CAMPOS_PADRAO[i] && !usados.has(CAMPOS_PADRAO[i])
          ? (usados.add(CAMPOS_PADRAO[i]), CAMPOS_PADRAO[i])
          : null),
    );
  }
  const dados = temCabecalho ? rows.slice(1) : rows;
  const linhas = dados.map((r) => {
    const l: LinhaCrua = {};
    r.forEach((cel, i) => {
      const c = mapa[i];
      if (c) l[c] = (cel ?? "").toString();
    });
    return l;
  });
  return { linhas, tipoDoCabecalho, temCabecalho };
}

/* ───── Duplicatas ───── */
/** Cada lançamento ganha uma "impressão digital"; linhas idênticas no mesmo arquivo recebem #1, #2… (duas compras iguais no mesmo dia são legítimas). */
export function chavesComOcorrencia(chaves: string[]): string[] {
  const vistos = new Map<string, number>();
  return chaves.map((c) => {
    const n = (vistos.get(c) ?? 0) + 1;
    vistos.set(c, n);
    return `${c}|#${n}`;
  });
}

export async function sha256Hex(texto: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export type Existente = {
  data: string;
  valor_cents: number;
  account_id: string | null;
  tipo: TipoLancamento;
  import_hash: string | null;
};
export const chaveParecida = (e: {
  data: string;
  valor_cents: number;
  account_id: string | null;
  tipo: string;
}) => `${e.data}|${e.valor_cents}|${e.account_id ?? ""}|${e.tipo}`;

export { mesSeguinte };
