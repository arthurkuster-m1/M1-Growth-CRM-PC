"use client";

import { CriarCategoriaSheet } from "./FormCategoria";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@/components/financas/rota";
import { somarDias } from "@/components/financas/kit/calendario";
import { lerTabela } from "@/lib/financas/csv";
import {
  DataSheetGrid,
  createTextColumn,
  keyColumn,
  textColumn,
  type DataSheetGridRef,
} from "react-datasheet-grid";
import { ListaCell, OpcoesCelulas } from "@/components/financas/kit/ListaCelula";
import "react-datasheet-grid/dist/style.css";
import {
  ArrowsClockwise,
  Bank,
  CheckCircle,
  FileCsv,
  Minus,
  Plus,
  Table,
  Warning,
  XCircle,
} from "@/lib/ui/icons";
import {
  Badge,
  Button,
  Card,
  Field,
  MonthField,
  Segmented,
  Select,
  Sheet,
  Textarea,
  brl,
  useToast,
  type OpcaoBusca,
} from "@/components/financas/kit";
import {
  ErroImportacao,
  criarCategoria,
  importarLancamentos,
  listarAberturas,
  listarParaImportacao,
  salvarAbertura,
  useFinancas,
  type LancamentoImportado,
  type TipoLancamento,
} from "@/lib/financas/dados";
import { mesQueCai } from "@/lib/financas/mesDoLancamento";
import {
  calcularExpressao,
  centavosParaCampo,
  dataBR,
  datasDaFatura,
  hoje,
  mesAnterior,
  mesAtual,
  mesCurto,
  mesSeguinte,
} from "@/lib/financas/formato";
import {
  chaveParecida,
  chavesComOcorrencia,
  linhasDeMatriz,
  sha256Hex,
  validarLinha,
  type CampoLinha,
  type LinhaCrua,
  type ResultadoLinha,
} from "@/lib/financas/importacao";

const LINHAS_INICIAIS = 5;
const vazias = (n: number): LinhaCrua[] => Array.from({ length: n }, () => ({}));
const ROTULO_TIPO: Record<TipoLancamento, string> = {
  saida: "Saídas",
  entrada: "Entradas",
  transferencia: "Transferências",
};

type Info = { jaImportada?: boolean; parecida?: boolean; substitui?: number };
/** A situação de cada linha viaja DENTRO dos dados (campos __): a grade só repassa a linha atual, então nunca mostra um resultado velho. */
type LinhaGrade = LinhaCrua & { __tom?: string; __texto?: string };
const semMeta = ({ __tom, __texto, ...resto }: LinhaGrade): LinhaCrua => {
  void __tom;
  void __texto;
  return resto;
};
const ICONE_TOM: Record<string, React.ReactNode> = {
  erro: <XCircle size={15} weight="fill" />,
  ign: <Minus size={15} />,
  dup: <ArrowsClockwise size={15} />,
  aviso: <Warning size={15} weight="fill" />,
  info: <Bank size={15} weight="fill" />,
  ok: <CheckCircle size={15} weight="fill" />,
};
const classeLinha = ({ rowData }: { rowData: LinhaGrade; rowIndex: number }) =>
  rowData.__tom ? `fi-massa__linha is-${rowData.__tom}` : undefined;

/** Situação da linha: coluna comum no fim da tabela (rola junto com as outras; NÃO fica congelada). */
const COLUNA_STATUS = {
  id: "status",
  title: "Situação da linha",
  minWidth: 300,
  basis: 340,
  grow: 1,
  disabled: true,
  component: ({ rowData }: { rowData: LinhaGrade }) =>
    rowData.__tom ? (
      <span className={`fi-massa__status is-${rowData.__tom}`} title={rowData.__texto}>
        {ICONE_TOM[rowData.__tom]}
        <span>{rowData.__texto}</span>
      </span>
    ) : null,
  copyValue: ({ rowData }: { rowData: LinhaGrade }) => rowData.__texto ?? "",
  pasteValue: ({ rowData }: { rowData: LinhaGrade }) => rowData,
  deleteValue: ({ rowData }: { rowData: LinhaGrade }) => rowData,
  isCellEmpty: ({ rowData }: { rowData: LinhaGrade }) => !rowData.__tom,
};

/* ───── Células com lista: mostram as opções que já existem, para não escrever errado ───── */
type CampoLista = "conta" | "categoria" | "tipo" | "destino" | "fatura" | "situacao";

/** Coluna de texto da planilha. A biblioteca usa null para célula vazia; nossas linhas usam undefined — o cast só concilia os dois. */
/* eslint-disable @typescript-eslint/no-explicit-any */
const coluna = (key: CampoLinha, title: string, minWidth: number, maxWidth?: number) =>
  keyColumn<LinhaCrua, any>(key, {
    ...(textColumn as any),
    title,
    minWidth,
    ...(maxWidth ? { maxWidth } : {}),
  });
const colunaLista = (key: CampoLista, title: string, minWidth: number, maxWidth?: number) =>
  keyColumn<LinhaCrua, any>(key, {
    ...(textColumn as any),
    component: ListaCell,
    columnData: { chave: key },
    disableKeys: true,
    title,
    minWidth,
    ...(maxWidth ? { maxWidth } : {}),
  });
/** Valor: aceita conta como no Excel ("=16+105,80"); ao sair da célula (Enter, Tab ou clique fora) vira o resultado ("121,80"). */
const colunaValor = () =>
  keyColumn<LinhaCrua, any>("valor", {
    ...(createTextColumn({
      continuousUpdates: false,
      parseUserInput: (v: string) => {
        if (!v.trim().startsWith("=")) return v;
        const r = calcularExpressao(v);
        return r === null || r < 0 ? v : centavosParaCampo(Math.round(r * 100)) || "0";
      },
    }) as any),
    title: "Valor",
    minWidth: 110,
  });
const COLUNAS: any[] = [
  coluna("data", "Data", 88, 100),
  colunaLista("conta", "Conta / Cartão", 130),
  colunaLista("categoria", "Categoria", 140),
  colunaValor(),
  coluna("nota", "Anotação", 150),
  colunaLista("tipo", "Tipo", 100, 120),
  colunaLista("destino", "Destino (transf.)", 130),
  colunaLista("fatura", "Fatura", 100, 120),
  colunaLista("situacao", "Situação", 100, 120),
  COLUNA_STATUS,
];
/* eslint-enable @typescript-eslint/no-explicit-any */

type CampoAplicavel = "conta" | "fatura" | "situacao" | "tipo" | "categoria";

async function lerTexto(arquivo: File): Promise<string> {
  const buf = await arquivo.arrayBuffer();
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buf).replace(/^﻿/, "");
  } catch {
    return new TextDecoder("windows-1252").decode(buf);
  } // CSV do Excel em português costuma vir assim
}

export function Massa() {
  const { contas, categorias, recarregar } = useFinancas();
  const toast = useToast();
  const gridRef = useRef<DataSheetGridRef>(null);

  const [linhas, setLinhas] = useState<LinhaCrua[]>(() => vazias(LINHAS_INICIAIS));
  const [tipoPadrao, setTipoPadrao] = useState<TipoLancamento>("saida");
  const [mesRef, setMesRef] = useState(mesAtual());
  // A grade zera a seleção quando você clica fora (por exemplo em "Aplicar"), então a última seleção é lembrada,
  // e o alvo da aplicação em massa é uma escolha EXPLÍCITA — nunca "todas" por acidente.
  const [selecao, setSelecao] = useState<{ min: number; max: number } | null>(null);
  const [alvo, setAlvo] = useState<"selecionadas" | "todas">("todas");
  const [campo, setCampo] = useState<CampoAplicavel>("conta");
  const [valorAplicar, setValorAplicar] = useState("");
  const [colando, setColando] = useState(false);
  const [textoColado, setTextoColado] = useState("");
  const [info, setInfo] = useState<Map<number, Info>>(new Map());
  const [importando, setImportando] = useState(false);
  const [relatorio, setRelatorio] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [limpar, setLimpar] = useState(false);
  const arquivoRef = useRef<HTMLInputElement>(null);

  const anoRef = Number(mesRef.slice(0, 4)) || new Date().getFullYear();
  const contasUteis = useMemo(() => contas.filter((c) => c.ativa && c.tipo !== "bem"), [contas]);
  const ctx = useMemo(
    () => ({ contas, categorias, anoRef, tipoPadrao, hoje: hoje() }),
    [contas, categorias, anoRef, tipoPadrao],
  );
  const resultados = useMemo<ResultadoLinha[]>(
    () => linhas.map((l) => validarLinha(l, ctx)),
    [linhas, ctx],
  );

  /* Duplicatas: impressão digital de cada linha válida × o que já existe no banco no mesmo período. */
  const chaveOk = resultados
    .map((r, i) =>
      r.estado === "ok"
        ? `${i}:${r.chave}:${r.lancamento.data}:${r.lancamento.valor_cents}:${r.lancamento.account_id}:${r.lancamento.tipo}`
        : r.estado === "abertura"
          ? `${i}:ab:${r.conta.id}:${r.mes}:${r.cents}`
          : "",
    )
    .join("¦");
  const hashesRef = useRef<Map<number, string>>(new Map());
  useEffect(() => {
    let vivo = true;
    const t = setTimeout(async () => {
      const oks = resultados
        .map((r, i) => ({ r, i }))
        .filter(
          (x): x is { r: Extract<ResultadoLinha, { estado: "ok" }>; i: number } =>
            x.r.estado === "ok",
        );
      const aberturas = resultados
        .map((r, i) => ({ r, i }))
        .filter(
          (x): x is { r: Extract<ResultadoLinha, { estado: "abertura" }>; i: number } =>
            x.r.estado === "abertura",
        );
      const novo = new Map<number, Info>();
      hashesRef.current = new Map();
      try {
        if (oks.length) {
          const hashes = await Promise.all(
            chavesComOcorrencia(oks.map((x) => x.r.chave)).map(sha256Hex),
          );
          oks.forEach((x, k) => hashesRef.current.set(x.i, hashes[k]!));
          const datas = oks.map((x) => x.r.lancamento.data).sort();
          const existentes = await listarParaImportacao(
            datas[0]!,
            somarDias(datas[datas.length - 1]!, 1),
          );
          const hs = new Set(existentes.map((e) => e.import_hash).filter(Boolean));
          const par = new Set(existentes.map(chaveParecida));
          oks.forEach((x, k) => {
            const inf: Info = {};
            if (hs.has(hashes[k]!)) inf.jaImportada = true;
            else if (par.has(chaveParecida(x.r.lancamento))) inf.parecida = true;
            if (inf.jaImportada || inf.parecida) novo.set(x.i, inf);
          });
        }
        for (const m of [...new Set(aberturas.map((a) => a.r.mes))]) {
          const ex = new Map((await listarAberturas(m)).map((a) => [a.account_id, a.saldo_cents]));
          aberturas
            .filter((a) => a.r.mes === m)
            .forEach((a) => {
              const atual = ex.get(a.r.conta.id);
              if (atual === a.r.cents) novo.set(a.i, { jaImportada: true });
              else if (atual !== undefined) novo.set(a.i, { substitui: atual });
            });
        }
      } catch {
        /* sem checagem de duplicata: a gravação continua protegida pelo banco */
      }
      if (vivo) setInfo(novo);
    }, 350);
    return () => {
      vivo = false;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chaveOk]);

  const contagem = useMemo(() => {
    const c = { ok: 0, avisos: 0, erros: 0, ignoradas: 0, repetidas: 0, aberturas: 0 };
    resultados.forEach((r, i) => {
      const inf = info.get(i);
      if (r.estado === "erro") c.erros++;
      else if (r.estado === "ignorada") c.ignoradas++;
      else if (r.estado === "abertura") {
        if (inf?.jaImportada) c.repetidas++;
        else c.aberturas++;
      } else if (r.estado === "ok") {
        if (inf?.jaImportada) c.repetidas++;
        else {
          c.ok++;
          if (r.avisos.length || inf?.parecida) c.avisos++;
        }
      }
    });
    return c;
  }, [resultados, info]);

  const faltantes = useMemo(() => {
    const m = new Map<string, { nome: string; tipo: "entrada" | "saida" }>();
    resultados.forEach((r) => {
      if (r.estado === "erro" && r.categoriaFaltando)
        m.set(
          `${r.categoriaFaltando.tipo}:${r.categoriaFaltando.nome.toLowerCase()}`,
          r.categoriaFaltando,
        );
    });
    return [...m.values()];
  }, [resultados]);

  const adicionarMatriz = useCallback(
    (matriz: string[][]) => {
      const { linhas: novas, tipoDoCabecalho } = linhasDeMatriz(matriz);
      if (novas.length === 0) {
        setErro("Não encontrei linhas para adicionar.");
        return;
      }
      const marcadas = tipoDoCabecalho
        ? novas.map((l) => ({ ...l, tipo: l.tipo || tipoDoCabecalho }))
        : novas;
      setLinhas((atual) => {
        const semVazias = atual.filter((l) => Object.values(l).some((v) => v && v.trim()));
        return [...semVazias, ...marcadas, ...vazias(5)];
      });
      setErro(null);
      setRelatorio(null);
      setSelecao(null);
      setAlvo("todas");
      toast(
        `${novas.length} linha${novas.length > 1 ? "s" : ""} adicionada${novas.length > 1 ? "s" : ""}${tipoDoCabecalho ? ` (${ROTULO_TIPO[tipoDoCabecalho].toLowerCase()})` : ""}`,
      );
    },
    [toast],
  );

  async function aoEscolherArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const arq = e.target.files?.[0];
    e.target.value = "";
    if (!arq) return;
    try {
      const txt = await lerTexto(arq);
      adicionarMatriz(lerTabela(txt));
    } catch {
      setErro(
        "Não consegui ler esse arquivo. Use CSV ou TXT separado por vírgula, ponto e vírgula ou tab.",
      );
    }
  }

  const opcoesGrade = useMemo<Record<CampoLista, OpcaoBusca[]>>(() => {
    const contasOp = contasUteis.map((c) => ({
      value: c.nome,
      label: c.nome,
      sub: c.tipo === "cartao" ? "cartão" : undefined,
    }));
    const meses = [-1, 0, 1, 2, 3, 4].map((d) => {
      let m = mesRef;
      if (d < 0) m = mesAnterior(m);
      for (let k = 0; k < d; k++) m = mesSeguinte(m);
      return { value: m, label: mesCurto(m) };
    });
    return {
      conta: contasOp,
      destino: contasOp,
      categoria: categorias
        .filter((c) => c.ativa && c.grupo !== "Sistema")
        .map((c) => ({
          value: c.nome,
          label: c.nome,
          sub: c.tipo === "entrada" ? "entrada" : undefined,
        })),
      tipo: [
        { value: "saída", label: "Saída" },
        { value: "entrada", label: "Entrada" },
        { value: "transferência", label: "Transferência" },
      ],
      fatura: meses,
      situacao: [
        { value: "pago", label: "Pago" },
        { value: "previsto", label: "Previsto" },
        { value: "cancelado", label: "Cancelado" },
      ],
    };
  }, [contasUteis, categorias, mesRef]);

  const opcoesAplicar = useMemo<{ v: string; l: string }[]>(() => {
    switch (campo) {
      case "conta":
        return contasUteis.map((c) => ({
          v: c.nome,
          l: c.tipo === "cartao" ? `${c.nome} (cartão)` : c.nome,
        }));
      case "categoria":
        return categorias
          .filter((c) => c.ativa && c.grupo !== "Sistema")
          .map((c) => ({ v: c.nome, l: `${c.nome}${c.tipo === "entrada" ? " (entrada)" : ""}` }));
      case "situacao":
        return [
          { v: "pago", l: "Pago" },
          { v: "previsto", l: "Previsto" },
          { v: "cancelado", l: "Cancelado" },
        ];
      case "tipo":
        return [
          { v: "saída", l: "Saída" },
          { v: "entrada", l: "Entrada" },
          { v: "transferência", l: "Transferência" },
        ];
      case "fatura": {
        const base = mesRef;
        return [-1, 0, 1, 2, 3, 4].map((d) => {
          let m = base;
          if (d < 0) {
            const [a = 0, n = 0] = base.split("-").map(Number);
            m = n === 1 ? `${a - 1}-12` : `${a}-${String(n - 1).padStart(2, "0")}`;
          }
          for (let k = 0; k < d; k++) m = mesSeguinte(m);
          return { v: m, l: mesCurto(m) };
        });
      }
    }
  }, [campo, contasUteis, categorias, mesRef]);
  useEffect(() => {
    setValorAplicar(opcoesAplicar[0]?.v ?? "");
  }, [opcoesAplicar]);

  function aplicar() {
    if (!valorAplicar) return;
    const sel = alvo === "selecionadas" ? selecao : null;
    if (alvo === "selecionadas" && !sel) return;
    setLinhas((atual) =>
      atual.map((l, i) => {
        const naSelecao = sel
          ? i >= sel.min && i <= sel.max
          : Object.values(l).some((v) => v && v.trim());
        return naSelecao ? { ...l, [campo as CampoLinha]: valorAplicar } : l;
      }),
    );
  }

  const [criandoCat, setCriandoCat] = useState<{ nome: string; tipo: "saida" | "entrada" } | null>(
    null,
  );

  async function criarFaltantes() {
    try {
      for (const f of faltantes)
        await criarCategoria({
          nome: f.nome,
          tipo: f.tipo,
          ordem:
            Math.max(0, ...categorias.filter((c) => c.tipo === f.tipo).map((c) => c.ordem)) + 10,
        });
      recarregar();
      toast(
        `${faltantes.length} categoria${faltantes.length > 1 ? "s" : ""} criada${faltantes.length > 1 ? "s" : ""}`,
      );
    } catch (e) {
      setErro((e as Error).message);
    }
  }

  async function importar() {
    setImportando(true);
    setErro(null);
    setRelatorio(null);
    try {
      const lancamentos: LancamentoImportado[] = [];
      const aberturas = new Map<string, { conta: string; mes: string; cents: number }>();
      const indices = new Set<number>();
      resultados.forEach((r, i) => {
        const inf = info.get(i);
        if (r.estado === "ok" && !inf?.jaImportada) {
          const h = hashesRef.current.get(i);
          if (h) {
            lancamentos.push({ ...r.lancamento, import_hash: h });
            indices.add(i);
          }
        }
        if (r.estado === "abertura" && !inf?.jaImportada) {
          aberturas.set(`${r.conta.id}:${r.mes}`, {
            conta: r.conta.id,
            mes: r.mes,
            cents: r.cents,
          });
          indices.add(i);
        }
      });
      const semImpressao = resultados.some(
        (r, i) => r.estado === "ok" && !info.get(i)?.jaImportada && !hashesRef.current.get(i),
      );
      if (semImpressao)
        throw new Error(
          "Ainda estou conferindo as linhas. Espere um instante e clique em Importar de novo.",
        );
      const { inseridas, repetidas } = await importarLancamentos(lancamentos);
      for (const a of aberturas.values()) await salvarAbertura(a.conta, a.mes, a.cents);
      // some da tabela o que já está no banco (importado, repetido, ignorado); ficam só as linhas com erro, para corrigir
      setLinhas((atual) => {
        const mantidas = atual.filter((_, i) => resultados[i]!.estado === "erro");
        return [...mantidas, ...vazias(Math.max(LINHAS_INICIAIS - mantidas.length, 5))];
      });
      const partes = [
        `${inseridas} lançamento${inseridas === 1 ? "" : "s"} importado${inseridas === 1 ? "" : "s"}`,
      ];
      if (aberturas.size)
        partes.push(`${aberturas.size} saldo${aberturas.size > 1 ? "s" : ""} de abertura`);
      if (repetidas + contagem.repetidas)
        partes.push(
          `${repetidas + contagem.repetidas} já existia${repetidas + contagem.repetidas > 1 ? "m" : ""} (não duplicou)`,
        );
      if (contagem.erros) partes.push(`${contagem.erros} com erro continuam na tabela`);
      setRelatorio(partes.join(" · "));
      setSelecao(null);
      setAlvo("todas");
      toast("Importação concluída");
    } catch (e) {
      const m = (e as Error).message;
      setErro(
        e instanceof ErroImportacao && e.inseridas > 0
          ? `${m} — ${e.inseridas} já foram gravados. É seguro tentar de novo: o que já entrou não entra duas vezes.`
          : m,
      );
    } finally {
      setImportando(false);
    }
  }

  const textoStatus = useCallback(
    (i: number): { tom: string; texto: string } | null => {
      const r = resultados[i];
      const inf = info.get(i);
      if (!r || r.estado === "vazia") return null;
      if (r.estado === "erro")
        return {
          tom: "erro",
          texto: r.erros[0] + (r.erros.length > 1 ? ` (+${r.erros.length - 1})` : ""),
        };
      if (r.estado === "ignorada") return { tom: "ign", texto: `Ignorada (${r.motivo})` };
      if (inf?.jaImportada) return { tom: "dup", texto: "Já importada" };
      if (r.estado === "abertura")
        return {
          tom: "info",
          texto: `Saldo de abertura de ${mesCurto(r.mes)}: ${brl(r.cents)}${inf?.substitui !== undefined ? ` (substitui ${brl(inf.substitui)})` : ""}`,
        };
      if (inf?.parecida) return { tom: "aviso", texto: "Parecida com um lançamento que já existe" };
      const lan = r.lancamento,
        conta = contas.find((c) => c.id === lan.account_id);
      const cartao = lan.fatura_mes && conta?.tipo === "cartao" ? conta : undefined;
      const mesCai = mesQueCai({
        data: lan.data,
        tipo: lan.tipo,
        conta,
        faturaMes: lan.fatura_mes,
      });
      const paga = cartao
        ? datasDaFatura(mesCai, cartao.dia_fechamento, cartao.dia_vencimento).paga
        : null;
      const onde =
        lan.tipo === "transferencia"
          ? `transferência em ${mesCurto(mesCai)} (não conta como entrada nem saída)`
          : `cai em ${mesCurto(mesCai)}${cartao ? ` (fatura${paga ? `, paga em ${dataBR(paga, true)}` : ""})` : ""}`;
      if (r.avisos.length) return { tom: "aviso", texto: `${r.avisos[0]} · ${onde}` };
      return { tom: "ok", texto: `Pronta · ${onde}` };
    },
    [resultados, info, contas],
  );

  const linhasGrade = useMemo<LinhaGrade[]>(
    () =>
      linhas.map((l, i) => {
        const s = textoStatus(i);
        return s ? { ...l, __tom: s.tom, __texto: s.texto } : l;
      }),
    [linhas, textoStatus],
  );

  const problemas = useMemo(
    () =>
      resultados
        .map((r, i) => ({ i, s: textoStatus(i) }))
        .filter((x) => x.s && (x.s.tom === "erro" || x.s.tom === "aviso")) as {
        i: number;
        s: { tom: string; texto: string };
      }[],
    [resultados, textoStatus],
  );
  const [verTodos, setVerTodos] = useState(false);
  const totalLinhasValidas = contagem.ok + contagem.aberturas;
  const nSel = selecao ? selecao.max - selecao.min + 1 : 0;

  return (
    <OpcoesCelulas.Provider value={opcoesGrade}>
      <div className="fi-stack">
        <div className="fi-row fi-row--between fi-row--wrap">
          <p className="t-body t-muted" style={{ flex: 1, minWidth: 240 }}>
            Cole da planilha (Ctrl+V) ou digite. Nas colunas de{" "}
            <strong>Conta, Categoria, Tipo, Fatura e Situação</strong> aparece a lista do que já
            existe. Copie uma célula (Ctrl+C), selecione as de baixo e cole (Ctrl+V) para repetir.
            Só grava quando você clicar em Importar.
          </p>
          <div className="fi-row fi-row--wrap">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setColando(true)}
              icon={<Table size={16} />}
            >
              Colar da planilha
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => arquivoRef.current?.click()}
              icon={<FileCsv size={16} />}
            >
              Importar CSV
            </Button>
            <input
              ref={arquivoRef}
              type="file"
              accept=".csv,.tsv,.txt,text/csv,text/plain"
              hidden
              aria-label="Arquivo CSV"
              onChange={(e) => void aoEscolherArquivo(e)}
            />
          </div>
        </div>
        <Card className="fi-stack">
          <div className="fi-massa__barra">
            <div className="fi-field">
              <span className="fi-label">Linhas sem tipo são</span>
              <Segmented
                value={tipoPadrao}
                onChange={setTipoPadrao}
                options={[
                  { value: "saida", label: "Saídas" },
                  { value: "entrada", label: "Entradas" },
                  { value: "transferencia", label: "Transf." },
                ]}
              />
            </div>
            <Field label="Mês de referência" hint={`Datas sem ano (05/10) usam ${anoRef}`}>
              <MonthField
                value={mesRef}
                onChange={(e) => setMesRef(e.target.value || mesAtual())}
              />
            </Field>
          </div>
          <div className="fi-massa__aplicar" role="group" aria-label="Aplicar em várias linhas">
            <Segmented
              value={alvo}
              onChange={setAlvo}
              options={[
                {
                  value: "selecionadas",
                  label: selecao ? `Selecionadas (${nSel})` : "Selecionadas",
                },
                { value: "todas", label: "Todas as preenchidas" },
              ]}
            />
            <Select
              aria-label="Campo"
              value={campo}
              onChange={(e) => setCampo(e.target.value as CampoAplicavel)}
            >
              <option value="conta">Conta / Cartão</option>
              <option value="fatura">Fatura</option>
              <option value="situacao">Situação</option>
              <option value="tipo">Tipo</option>
              <option value="categoria">Categoria</option>
            </Select>
            <Select
              aria-label="Valor a aplicar"
              value={valorAplicar}
              onChange={(e) => setValorAplicar(e.target.value)}
            >
              {opcoesAplicar.map((o) => (
                <option key={o.v} value={o.v}>
                  {o.l}
                </option>
              ))}
            </Select>
            <Button size="sm" onClick={aplicar} disabled={alvo === "selecionadas" && !selecao}>
              Aplicar
            </Button>
          </div>
        </Card>

        {faltantes.length > 0 && (
          <Card className="fi-stack" data-testid="faltantes">
            <div className="fi-row fi-row--between fi-row--wrap">
              <span className="t-body">
                Faltam {faltantes.length} categoria{faltantes.length > 1 ? "s" : ""}. Crie cada uma
                escolhendo grupo e cor, ou todas de uma vez com o padrão.
              </span>
              {faltantes.length > 1 && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => void criarFaltantes()}
                  icon={<Plus size={16} weight="bold" />}
                >
                  Criar todas
                </Button>
              )}
            </div>
            <ul className="fi-faltantes">
              {faltantes.map((f) => (
                <li key={`${f.tipo}|${f.nome}`}>
                  <span>
                    <strong>{f.nome}</strong>{" "}
                    <span className="t-caption t-muted">
                      {f.tipo === "entrada" ? "entrada" : "saída"}
                    </span>
                  </span>
                  <Button
                    size="sm"
                    variant="secondary"
                    aria-label={`Criar categoria ${f.nome}`}
                    onClick={() => setCriandoCat({ nome: f.nome, tipo: f.tipo })}
                    icon={<Plus size={16} weight="bold" />}
                  >
                    Criar categoria
                  </Button>
                </li>
              ))}
            </ul>
          </Card>
        )}

        <div className="fi-massa" data-testid="grade">
          <DataSheetGrid<LinhaGrade>
            ref={gridRef}
            value={linhasGrade}
            onChange={(v) => {
              setLinhas(v.map(semMeta));
              setRelatorio(null);
            }}
            columns={COLUNAS}
            createRow={() => ({})}
            rowClassName={classeLinha}
            onSelectionChange={({ selection }) => {
              if (selection) {
                setSelecao({
                  min: Math.min(selection.min.row, selection.max.row),
                  max: Math.max(selection.min.row, selection.max.row),
                });
                setAlvo("selecionadas");
              }
            }}
            onActiveCellChange={({ cell }) => {
              if (cell) {
                setSelecao((atual) =>
                  atual && atual.min <= cell.row && cell.row <= atual.max && atual.min !== atual.max
                    ? atual
                    : { min: cell.row, max: cell.row },
                );
                setAlvo("selecionadas");
              }
            }}
            height={Math.min(560, 44 + 38 * (linhas.length + 1))}
            rowHeight={38}
            addRowsComponent={false}
            autoAddRow
          />
        </div>

        <div className="fi-row fi-row--between fi-row--wrap">
          <div className="fi-row fi-row--wrap" data-testid="resumo">
            <Badge tone="success">
              <CheckCircle size={14} weight="fill" />
              {contagem.ok} pronta{contagem.ok === 1 ? "" : "s"}
            </Badge>
            {contagem.aberturas > 0 && (
              <Badge tone="info">
                <Bank size={14} weight="fill" />
                {contagem.aberturas} saldo{contagem.aberturas > 1 ? "s" : ""} de abertura
              </Badge>
            )}
            {contagem.avisos > 0 && (
              <Badge tone="warning">
                <Warning size={14} weight="fill" />
                {contagem.avisos} com aviso
              </Badge>
            )}
            {contagem.erros > 0 && (
              <Badge tone="error">
                <XCircle size={14} weight="fill" />
                {contagem.erros} com erro
              </Badge>
            )}
            {contagem.repetidas > 0 && (
              <Badge tone="neutral">
                <ArrowsClockwise size={14} />
                {contagem.repetidas} já importada{contagem.repetidas > 1 ? "s" : ""}
              </Badge>
            )}
            {contagem.ignoradas > 0 && (
              <Badge tone="neutral">
                {contagem.ignoradas} ignorada{contagem.ignoradas > 1 ? "s" : ""}
              </Badge>
            )}
          </div>
          <div className="fi-row fi-row--wrap">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setLinhas((l) => [...l, ...vazias(5)])}
              icon={<Plus size={16} weight="bold" />}
            >
              5 linhas
            </Button>
            {limpar ? (
              <Button
                variant="danger"
                size="sm"
                onClick={() => {
                  setLinhas(vazias(LINHAS_INICIAIS));
                  setLimpar(false);
                  setRelatorio(null);
                  setErro(null);
                  setSelecao(null);
                  setAlvo("todas");
                }}
              >
                Confirmar: limpar tabela
              </Button>
            ) : (
              <Button variant="ghost" size="sm" onClick={() => setLimpar(true)}>
                Limpar tabela
              </Button>
            )}
            <Button
              size="lg"
              loading={importando}
              disabled={totalLinhasValidas === 0}
              onClick={() => void importar()}
            >
              Importar {totalLinhasValidas} linha{totalLinhasValidas === 1 ? "" : "s"}
            </Button>
          </div>
        </div>

        {contagem.erros > 0 && totalLinhasValidas > 0 && (
          <p className="t-body-sm t-muted">
            As {contagem.erros} linha{contagem.erros > 1 ? "s" : ""} com erro não serão gravadas:
            ficam na tabela para você corrigir.
          </p>
        )}
        {problemas.length > 0 && (
          <Card className="fi-stack" data-testid="problemas" style={{ gap: 8 }}>
            <h3 className="t-h3">Linhas para conferir</h3>
            <ul className="fi-problemas">
              {(verTodos ? problemas : problemas.slice(0, 6)).map((x) => (
                <li key={x.i} className={`is-${x.s.tom}`}>
                  <strong>Linha {x.i + 1}</strong> {x.s.texto}
                </li>
              ))}
            </ul>
            {problemas.length > 6 && (
              <Button variant="ghost" size="sm" onClick={() => setVerTodos((v) => !v)}>
                {verTodos ? "Mostrar menos" : `Mostrar todas (${problemas.length})`}
              </Button>
            )}
          </Card>
        )}
        {erro && (
          <p className="fi-error-text" role="alert">
            {erro}
          </p>
        )}
        {relatorio && (
          <Card className="fi-row fi-row--between fi-row--wrap" data-testid="relatorio">
            <span className="t-body">
              <CheckCircle
                size={18}
                weight="fill"
                style={{ verticalAlign: "-3px", color: "var(--color-success-fg)" }}
              />{" "}
              {relatorio}
            </span>
            <Link className="fi-btn fi-btn--secondary fi-btn--sm" to="/financas/lancamentos">
              Ver em Lançamentos
            </Link>
          </Card>
        )}
        <p className="t-caption t-muted">
          Dica: arraste o quadradinho do canto da seleção para preencher várias células de uma vez.
          A tabela rola para o lado (no celular também); para colar muitas linhas, o computador é
          mais confortável.
        </p>

        <Sheet open={colando} onClose={() => setColando(false)} title="Colar da planilha">
          <p className="t-body-sm t-muted">
            Copie as linhas na planilha (pode incluir o cabeçalho: se ele disser "Entradas" ou
            "Saídas", o tipo é reconhecido) e cole abaixo.
          </p>
          <Textarea
            aria-label="Texto colado"
            rows={10}
            value={textoColado}
            onChange={(e) => setTextoColado(e.target.value)}
            placeholder={
              "Data\tC\tSaídas\tValor\tNota\n01/10\tAK\tSaúde\tR$ 536,24\tBike Ergométrica"
            }
          />
          <Button
            size="lg"
            block
            disabled={!textoColado.trim()}
            onClick={() => {
              adicionarMatriz(lerTabela(textoColado, "\t"));
              setTextoColado("");
              setColando(false);
            }}
          >
            Adicionar à tabela
          </Button>
        </Sheet>
        <CriarCategoriaSheet
          aberto={criandoCat !== null}
          nome={criandoCat?.nome ?? ""}
          tipo={criandoCat?.tipo ?? "saida"}
          onClose={() => setCriandoCat(null)}
          onCriada={() => recarregar()}
        />
      </div>
    </OpcoesCelulas.Provider>
  );
}
