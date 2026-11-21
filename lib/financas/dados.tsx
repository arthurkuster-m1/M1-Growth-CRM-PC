"use client";

/**
 * A camada de dados das Finanças no navegador — os MESMOS nomes de função que as telas da família
 * (`familia-kuster/src/lib/financas/dados.tsx`) usam, mas chamando a API do CRM (`/api/v1/financas/*`)
 * em vez do banco: lá a RLS por família bastava; aqui toda escrita passa por rota com piso de gerente,
 * Zod e auditoria. O cálculo (mês, ano, faturas…) continua nos arquivos puros de `lib/financas/`.
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { apiClient } from "@/lib/api/client";

import type {
  Categoria,
  ConferenciaFatura,
  Conta,
  GrupoCategoria,
  Lancamento,
  NovoLancamento,
  PatrimonioDoMes,
  Saldo,
  TipoConta,
} from "./tipos";
import { hoje as hojeIso } from "./formato";
import type { Existente } from "./importacao";
import type { PlanoMeta, PlanoTeto } from "./teto";

export type {
  Categoria,
  ConferenciaFatura,
  Conta,
  DestinoConferencia,
  GrupoCategoria,
  Lancamento,
  NovoLancamento,
  PatrimonioDoMes,
  Saldo,
  StatusLancamento,
  TipoConta,
  TipoLancamento,
} from "./tipos";
export { ERRO_PAGO_FUTURO, patchPagar } from "./pagar";

const BASE = "/api/v1/financas";
const dado = async <T,>(p: Promise<{ data: T }>): Promise<T> => (await p).data;
const diaUm = (mes: string) => `${mes}-01`;

/* ───── Lançamentos ───── */
const lerLancamentos = (consulta: Record<string, string | number>) =>
  dado(
    apiClient.get<{ data: Lancamento[] }>(
      `${BASE}/lancamentos?${new URLSearchParams(Object.entries(consulta).map(([k, v]) => [k, String(v)]))}`,
    ),
  );

export const listarLancamentos = (de: string, ate: string) =>
  lerLancamentos({ modo: "periodo", de, ate });
export const listarRecentes = (n: number) => lerLancamentos({ modo: "recentes", n });
export const listarDaFatura = (contaId: string, mes: string) =>
  lerLancamentos({ modo: "fatura", conta: contaId, mes });
/** Tudo que forma as faturas dos cartões desde `desdeMes`: compras (pelo mês da fatura) e pagamentos (transferências PARA o cartão, pela data). */
export const listarMovimentoDosCartoes = (ids: string[], desdeMes: string) =>
  ids.length === 0
    ? Promise.resolve([] as Lancamento[])
    : lerLancamentos({ modo: "cartoes", ids: ids.join(","), desde: desdeMes });
/** Lançamentos que pertencem a uma fatura (mês do pagamento), de qualquer data de compra. */
export const listarPorFatura = (mes: string) => lerLancamentos({ modo: "por_fatura", mes });
/** Lançamentos que contam nos meses [deMes, ateMes): os de conta pela DATA e os de cartão pela FATURA (o cálculo separa). */
export const listarParaHistorico = (deMes: string, ateMes: string) =>
  lerLancamentos({ modo: "historico", de: deMes, ate: ateMes });

export async function criarLancamentos(lista: NovoLancamento[]): Promise<Lancamento[]> {
  return dado(
    apiClient.post<{ data: Lancamento[] }>(`${BASE}/lancamentos`, { lancamentos: lista }),
  );
}
export async function criarLancamento(n: NovoLancamento): Promise<Lancamento> {
  const [criado] = await criarLancamentos([n]);
  return criado!;
}
export async function atualizarLancamento(
  id: string,
  patch: Partial<NovoLancamento>,
): Promise<Lancamento> {
  return dado(apiClient.patch<{ data: Lancamento }>(`${BASE}/lancamentos/${id}`, patch));
}
export async function excluirLancamento(id: string): Promise<void> {
  await apiClient.delete(`${BASE}/lancamentos/${id}`);
}

/* ───── Importação em massa ───── */
export type LancamentoImportado = NovoLancamento & { import_hash: string };
export const listarParaImportacao = (de: string, ate: string) =>
  lerLancamentos({ modo: "importacao", de, ate }) as unknown as Promise<Existente[]>;

export class ErroImportacao extends Error {
  constructor(
    mensagem: string,
    public inseridas: number,
  ) {
    super(mensagem);
  }
}
/**
 * Grava em lotes de 100 (o servidor pula as linhas que já entraram, pela impressão digital): pode ser repetida à
 * vontade — o que já entrou não entra de novo.
 */
export async function importarLancamentos(
  linhas: LancamentoImportado[],
): Promise<{ inseridas: number; repetidas: number }> {
  let inseridas = 0;
  let repetidas = 0;
  try {
    for (let i = 0; i < linhas.length; i += 100) {
      const r = await dado(
        apiClient.post<{ data: { inseridas: number; repetidas: number } }>(
          `${BASE}/lancamentos/importar`,
          { lancamentos: linhas.slice(i, i + 100) },
        ),
      );
      inseridas += r.inseridas;
      repetidas += r.repetidas;
    }
  } catch (e) {
    throw new ErroImportacao((e as Error).message, inseridas);
  }
  return { inseridas, repetidas };
}

/* ───── Saldos e patrimônio ───── */
export const listarSaldos = () => dado(apiClient.get<{ data: Saldo[] }>(`${BASE}/saldos`));
/** Saldo de cada conta no início do mês. `previstos` soma o que ainda não aconteceu (para meses futuros). */
export const listarSaldosNoInicio = (mes: string, previstos: boolean) =>
  dado(
    apiClient.get<{ data: Record<string, number> }>(
      `${BASE}/saldos?no_inicio=${mes}${previstos ? "&previstos=1" : ""}`,
    ),
  );
/** Patrimônio no FIM de cada um dos `meses` meses que terminam em `ateMes` (contas e cartões separados). */
export const patrimonioMensal = (ateMes: string, meses: number) =>
  dado(
    apiClient.get<{ data: PatrimonioDoMes[] }>(`${BASE}/patrimonio?ate=${ateMes}&meses=${meses}`),
  );

/** Saldo de abertura de um mês ("AAAA-MM") — null se não houver registro (o mês herda o fechamento do anterior). */
export async function obterAbertura(contaId: string, mes: string): Promise<number | null> {
  return (
    await dado(
      apiClient.get<{ data: { saldo_cents: number | null } }>(
        `${BASE}/abertura?conta=${contaId}&mes=${mes}`,
      ),
    )
  ).saldo_cents;
}
export const listarAberturas = (mes: string) =>
  dado(
    apiClient.get<{ data: { account_id: string; saldo_cents: number }[] }>(
      `${BASE}/abertura?mes=${mes}`,
    ),
  );
export async function salvarAbertura(contaId: string, mes: string, cents: number): Promise<void> {
  await apiClient.put(`${BASE}/abertura`, { conta: contaId, mes, saldo_cents: cents });
}
export async function removerAbertura(contaId: string, mes: string): Promise<void> {
  await apiClient.put(`${BASE}/abertura`, { conta: contaId, mes, saldo_cents: null });
}

/* ───── Contas e cartões ───── */
export type DadosConta = Partial<Omit<Conta, "id">> & { nome: string; tipo: TipoConta };
export const criarConta = (d: DadosConta) =>
  dado(apiClient.post<{ data: Conta }>(`${BASE}/contas`, d));
export const atualizarConta = (id: string, d: Partial<DadosConta>) =>
  dado(apiClient.patch<{ data: Conta }>(`${BASE}/contas/${id}`, d));

/* ───── Categorias e grupos ───── */
export type DadosCategoria = Partial<Omit<Categoria, "id" | "grupo" | "orcamento_anual_cents">> & {
  nome: string;
  tipo: "entrada" | "saida";
};
export const criarCategoria = (d: DadosCategoria) =>
  dado(apiClient.post<{ data: Categoria }>(`${BASE}/categorias`, d));
export const atualizarCategoria = (id: string, d: Partial<DadosCategoria>) =>
  dado(apiClient.patch<{ data: Categoria }>(`${BASE}/categorias/${id}`, d));
/** Quantos lançamentos usam a categoria — zero = nunca foi usada e pode ser excluída. */
export async function usosDaCategoria(id: string): Promise<number> {
  return (await dado(apiClient.get<{ data: { usos: number } }>(`${BASE}/categorias/${id}/usos`)))
    .usos;
}
/** Só funciona para categoria sem uso (o banco recusa se houver lançamento ligado a ela). */
export async function excluirCategoria(id: string): Promise<void> {
  await apiClient.delete(`${BASE}/categorias/${id}`);
}
export const criarGrupo = (nome: string, ordem: number) =>
  dado(apiClient.post<{ data: GrupoCategoria }>(`${BASE}/grupos`, { nome: nome.trim(), ordem }));
export const atualizarGrupo = (id: string, d: Partial<Pick<GrupoCategoria, "nome" | "ordem">>) =>
  dado(apiClient.patch<{ data: GrupoCategoria }>(`${BASE}/grupos/${id}`, d));
/** As categorias do grupo ficam SEM grupo (o banco faz isso: on delete set null). */
export async function excluirGrupo(id: string): Promise<void> {
  await apiClient.delete(`${BASE}/grupos/${id}`);
}

/* ───── Teto e meta do mês ───── */
export type PlanoOrcamento = PlanoTeto & PlanoMeta;
const config = (corpo: Record<string, unknown>) =>
  apiClient.put(`${BASE}/config`, corpo).then(() => undefined);
export const salvarTetoPadrao = (cents: number) => config({ teto_padrao_cents: cents });
export const salvarTetoDoMes = (mes: string, cents: number) =>
  config({ teto_do_mes: { mes, valor_cents: cents } });
export const removerTetoDoMes = (mes: string) =>
  config({ teto_do_mes: { mes, valor_cents: null } });
export const salvarMetaPadrao = (cents: number) => config({ meta_padrao_cents: cents });
export const salvarMetaDoMes = (mes: string, cents: number) =>
  config({ meta_do_mes: { mes, valor_cents: cents } });
export const removerMetaDoMes = (mes: string) =>
  config({ meta_do_mes: { mes, valor_cents: null } });
export const salvarContaDasVendas = (contaId: string | null) =>
  config({ conta_vendas_id: contaId });

/* ───── Conferência de fatura (o total que o banco diz) ───── */
export async function obterConferenciaFatura(
  contaId: string,
  mes: string,
): Promise<ConferenciaFatura | null> {
  return (
    (await dado(
      apiClient.get<{ data: ConferenciaFatura | null }>(
        `${BASE}/conferencia-fatura?conta=${contaId}&mes=${mes}`,
      ),
    )) ?? null
  );
}
export async function salvarConferenciaFatura(
  contaId: string,
  mes: string,
  totalBancoCents: number,
): Promise<void> {
  await apiClient.put(`${BASE}/conferencia-fatura`, {
    conta: contaId,
    mes,
    total_banco_cents: totalBancoCents,
  });
}
export async function removerConferenciaFatura(contaId: string, mes: string): Promise<void> {
  await apiClient.put(`${BASE}/conferencia-fatura`, {
    conta: contaId,
    mes,
    total_banco_cents: null,
  });
}

/* ───── Conferência de saldo: o que o banco diz × o que o app calcula ───── */
/**
 * Registra a conferência. A diferença (real − sistema) vira um lançamento pago hoje: rendimento positivo →
 * entrada em "Rendimentos"; qualquer outra diferença → "Ajuste de saldo" (entrada ou saída). "ignorar" só
 * guarda o registro, sem mexer no saldo. Quem faz tudo é a rota (um passo só, com a categoria do sistema).
 */
export async function registrarConferencia(a: {
  contaId: string;
  saldoSistema: number;
  saldoReal: number;
  destino: "rendimento" | "ajuste" | "ignorar";
  nota?: string;
}): Promise<void> {
  await apiClient.post(`${BASE}/conferencia`, {
    conta: a.contaId,
    data: hojeIso(),
    saldo_sistema_cents: a.saldoSistema,
    saldo_real_cents: a.saldoReal,
    destino: a.destino,
    nota: a.nota?.trim() || null,
  });
}

/* ───── Provedor: contas, categorias e plano à mão em todas as telas ───── */
type Base = {
  contas: Conta[];
  grupos: GrupoCategoria[];
  categorias: Categoria[];
  config: { teto_padrao_cents: number; meta_padrao_cents: number; conta_vendas_id: string | null };
  plano: PlanoOrcamento;
};
const CHAVE_BASE = ["financas", "base"] as const;

type Ctx = {
  carregando: boolean;
  erro: string | null;
  /** O banco ainda não recebeu a migration das Finanças. */
  faltaMigration: boolean;
  contas: Conta[];
  categorias: Categoria[];
  grupos: GrupoCategoria[];
  config: Base["config"];
  plano: PlanoOrcamento;
  conta: (id: string | null) => Conta | undefined;
  categoria: (id: string | null) => Categoria | undefined;
  /** Por ano não há orçamento de categoria (só o teto do mês): devolve as mesmas categorias, para as telas da família. */
  categoriasDoAno: (ano: number) => Categoria[];
  /** Aplica uma nova ordem na tela na hora (depois de arrastar), sem esperar o banco responder. */
  aplicarOrdem: (alvo: "categoria" | "grupo", plano: { id: string; ordem: number }[]) => void;
  /** Põe uma categoria recém-criada na lista na hora (sem esperar a recarga), para já poder ser escolhida. */
  incluirCategoria: (c: Omit<Categoria, "grupo"> & { grupo?: string | null }) => void;
  recarregar: () => void;
};
const FinCtx = createContext<Ctx | null>(null);

/** O modelo final não tem categoria "esporádica": o único orçamento de gastos é o teto do mês. */
const SEM_ESPORADICAS = new Set<string>();
const SEM_PLANO: PlanoOrcamento = { tetoPadrao: 0, tetos: {}, metaPadrao: 0, metas: {} };
const SEM_CONFIG: Base["config"] = {
  teto_padrao_cents: 0,
  meta_padrao_cents: 0,
  conta_vendas_id: null,
};

export function FinancasProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const consulta = useQuery({
    queryKey: CHAVE_BASE,
    queryFn: () => dado(apiClient.get<{ data: Base }>(`${BASE}/base`)),
    staleTime: 60_000,
    retry: false,
  });

  const valor = useMemo<Ctx>(() => {
    const b = consulta.data;
    const contas = b?.contas ?? [];
    const categorias = b?.categorias ?? [];
    const cm = new Map(contas.map((c) => [c.id, c]));
    const km = new Map(categorias.map((c) => [c.id, c]));
    const alterar = (f: (b: Base) => Base) =>
      queryClient.setQueryData<Base>(CHAVE_BASE, (atual) => (atual ? f(atual) : atual));
    const ordenar = <T extends { ordem: number; nome: string }>(l: T[]) =>
      [...l].sort((a, c) => a.ordem - c.ordem || a.nome.localeCompare(c.nome));
    return {
      carregando: consulta.isLoading,
      erro: consulta.error ? (consulta.error as Error).message : null,
      faltaMigration:
        (consulta.error as { code?: string } | null)?.code === "financas_sem_migration",
      contas,
      categorias,
      grupos: b?.grupos ?? [],
      config: b?.config ?? SEM_CONFIG,
      plano: b?.plano ?? SEM_PLANO,
      categoriasDoAno: () => categorias,
      conta: (id) => (id ? cm.get(id) : undefined),
      categoria: (id) => (id ? km.get(id) : undefined),
      aplicarOrdem: (alvo, plano) =>
        alterar((x) => {
          const nova = new Map(plano.map((p) => [p.id, p.ordem]));
          return alvo === "categoria"
            ? {
                ...x,
                categorias: ordenar(
                  x.categorias.map((c) => (nova.has(c.id) ? { ...c, ordem: nova.get(c.id)! } : c)),
                ),
              }
            : {
                ...x,
                grupos: ordenar(
                  x.grupos.map((g) => (nova.has(g.id) ? { ...g, ordem: nova.get(g.id)! } : g)),
                ),
              };
        }),
      incluirCategoria: (c) =>
        alterar((x) => {
          if (x.categorias.some((k) => k.id === c.id)) return x;
          const grupo = c.group_id
            ? (x.grupos.find((g) => g.id === c.group_id)?.nome ?? null)
            : null;
          return { ...x, categorias: ordenar([...x.categorias, { ...c, grupo }]) };
        }),
      recarregar: () => void queryClient.invalidateQueries({ queryKey: CHAVE_BASE }),
    };
  }, [consulta.data, consulta.error, consulta.isLoading, queryClient]);

  return <FinCtx.Provider value={valor}>{children}</FinCtx.Provider>;
}

export function useFinancas(): Ctx {
  const c = useContext(FinCtx);
  if (!c) throw new Error("useFinancas fora do FinancasProvider");
  return c;
}

/**
 * O teto e a meta do mês (padrão + exceções) — vêm junto da base. `faltaTabela` fica por compatibilidade
 * com as telas da família: aqui a falta da migration já barra a tela inteira.
 */
export function usePlano() {
  const { plano, carregando, erro, recarregar } = useFinancas();
  return {
    ...plano,
    esporadicas: SEM_ESPORADICAS,
    carregando,
    erro,
    faltaTabela: false,
    recarregar,
  };
}

/**
 * Hook de lista de lançamentos de um período, com recarga manual.
 * `carregando` só vale na primeira busca de cada período (deps): numa recarga manual (depois de editar,
 * pagar…) a lista antiga fica na tela até a nova chegar, sem piscar nem perder a posição da rolagem e os filtros.
 */
export function useLista(buscar: () => Promise<Lancamento[]>, deps: unknown[]) {
  const chave = JSON.stringify(deps);
  const [estado, setEstado] = useState<{
    chave: string | null;
    erro: string | null;
    itens: Lancamento[];
  }>({ chave: null, erro: null, itens: [] });
  const [versao, setVersao] = useState(0);
  const recarregar = useCallback(() => setVersao((v) => v + 1), []);
  useEffect(() => {
    let vivo = true;
    buscar().then(
      (itens) => vivo && setEstado({ chave, erro: null, itens }),
      (e: Error) =>
        vivo &&
        setEstado((x) => ({ chave, erro: e.message, itens: x.chave === chave ? x.itens : [] })),
    );
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave, versao]);
  const atual = estado.chave === chave;
  return {
    carregando: !atual,
    erro: atual ? estado.erro : null,
    itens: atual ? estado.itens : [],
    recarregar,
  };
}

export const useLancamentosDoMes = (de: string, ate: string) =>
  useLista(() => listarLancamentos(de, ate), [de, ate]);

/** Mês "AAAA-MM" → dia 1 (para quem monta consulta à mão). */
export { diaUm };
