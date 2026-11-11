"use client";

import {
  ArrowsClockwise,
  CheckCircle,
  FileCsv,
  Plus,
  Table,
  Warning,
  XCircle,
} from "@phosphor-icons/react";
import { useQueryClient } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { showApiError } from "@/components/feedback/ApiErrorToast";
import type { LinhaGrade } from "@/components/marketing/produtos/GradeDeColagem";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useT } from "@/hooks/i18n/useT";
import { apiClient } from "@/lib/api/client";
import {
  LINHAS_INICIAIS,
  linhaVazia,
  linhasDeMatriz,
  matrizDoTexto,
  situacoesDasLinhas,
} from "@/lib/marketing/produtos-colagem";
import {
  MAXIMO_DE_LINHAS,
  modeloDaPlanilha,
  type LinhaDaPlanilha,
} from "@/lib/marketing/produtos-csv";
import { cn } from "@/lib/utils";

// A grade usa `window`: carrega só no navegador, e só quando a janela abre.
const GradeDeColagem = dynamic(() => import("@/components/marketing/produtos/GradeDeColagem"), {
  ssr: false,
  loading: () => <div className="h-40 animate-pulse rounded-xl bg-secondary" aria-busy="true" />,
});

interface Resultado {
  criados: number;
  pulados: Array<{ linha: number; nome: string }>;
  problemas: Array<{ linha: number; erro: string }>;
  publicados: boolean;
}

const vazias = (n: number): LinhaDaPlanilha[] => Array.from({ length: n }, () => ({}));

/** Baixa o modelo de planilha (CSV com `;`, que o Excel em português abre direto). */
export function baixarModeloDeProdutos() {
  const blob = new Blob([modeloDaPlanilha()], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "modelo-de-produtos.csv";
  a.click();
  URL.revokeObjectURL(url);
}

/** O arquivo como texto: UTF-8, ou Windows-1252 (o CSV do Excel em português costuma vir assim). */
async function lerTexto(arquivo: File): Promise<string> {
  const buf = await arquivo.arrayBuffer();
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buf).replace(/^﻿/, "");
  } catch {
    return new TextDecoder("windows-1252").decode(buf);
  }
}

const BOTAO_SECUNDARIO =
  "inline-flex h-9 items-center gap-1.5 rounded-xl border bg-card px-3 text-sm font-medium hover:bg-secondary disabled:opacity-50";

const SELO = {
  ok: "bg-success-bg text-success-fg",
  aviso: "bg-warning-bg text-warning-fg",
  erro: "bg-error-bg text-error-fg",
  dup: "bg-secondary text-muted-foreground",
} as const;

/**
 * IMPORTAR PRODUTOS colando direto na tabela, como no app Finanças: copie as linhas da planilha
 * (Ctrl+V na grade, ou “Colar da planilha”) e cada linha mostra na hora a SITUAÇÃO dela — pronta,
 * com aviso, com erro ou já existente. Só grava quando você clicar em Importar; as linhas com erro
 * ficam na tabela para corrigir. Quem já existe pelo nome é pulado, então repetir não duplica.
 */
export function ImportarProdutos({
  aberto,
  aoFechar,
  modulo,
  existentes,
}: {
  aberto: boolean;
  aoFechar: () => void;
  modulo: string;
  /** Os nomes dos produtos que o cliente já tem. */
  existentes: readonly string[];
}) {
  const t = useT();
  const queryClient = useQueryClient();
  const arquivoRef = useRef<HTMLInputElement>(null);
  const [linhas, setLinhas] = useState<LinhaDaPlanilha[]>(() => vazias(LINHAS_INICIAIS));
  const [colando, setColando] = useState(false);
  const [textoColado, setTextoColado] = useState("");
  const [publicar, setPublicar] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [limpar, setLimpar] = useState(false);
  const [verTodos, setVerTodos] = useState(false);

  const situacoes = useMemo(() => situacoesDasLinhas(linhas, existentes), [linhas, existentes]);
  const linhasGrade = useMemo<LinhaGrade[]>(
    () =>
      linhas.map((l, i) => {
        const s = situacoes[i];
        return s ? { ...l, __tom: s.tom, __texto: s.texto } : l;
      }),
    [linhas, situacoes],
  );

  const contagem = useMemo(() => {
    const c = { ok: 0, avisos: 0, erros: 0, repetidas: 0 };
    for (const s of situacoes) {
      if (!s) continue;
      if (s.tom === "erro") c.erros++;
      else if (s.tom === "dup") c.repetidas++;
      else {
        c.ok++;
        if (s.tom === "aviso") c.avisos++;
      }
    }
    return c;
  }, [situacoes]);

  const problemas = useMemo(() => {
    const lista: Array<{ i: number; tom: string; texto: string }> = [];
    situacoes.forEach((s, i) => {
      if (s && (s.tom === "erro" || s.tom === "aviso")) lista.push({ i, ...s });
    });
    return lista;
  }, [situacoes]);

  function adicionarMatriz(matriz: string[][]) {
    const lida = linhasDeMatriz(matriz);
    if (lida.linhas.length === 0) {
      setAviso(t("Não encontrei linhas para adicionar."));
      return;
    }
    const total = lida.linhas.length + linhas.filter((l) => !linhaVazia(l)).length;
    if (total > MAXIMO_DE_LINHAS) {
      setAviso(t("A tabela passaria de 300 linhas. Importe em partes."));
      return;
    }
    setLinhas((atual) => [...atual.filter((l) => !linhaVazia(l)), ...lida.linhas, ...vazias(5)]);
    setAviso(
      lida.ignoradas.length > 0 ? `${t("Colunas ignoradas")}: ${lida.ignoradas.join(", ")}` : null,
    );
    setResultado(null);
    toast.success(`${lida.linhas.length} ${t("linhas adicionadas")}`);
  }

  async function aoEscolherArquivo(f: File | undefined) {
    if (!f) return;
    if (f.size > 2_000_000) {
      setAviso(t("O arquivo é grande demais. Divida a planilha em partes."));
      return;
    }
    adicionarMatriz(matrizDoTexto(await lerTexto(f)));
  }

  async function importar() {
    const paraEnviar = linhas.filter((_, i) => situacoes[i]?.importavel);
    if (paraEnviar.length === 0) return;
    setEnviando(true);
    try {
      const r = await apiClient.post<{ data: Resultado }>("/api/v1/marketing/ofertas/importar", {
        linhas: paraEnviar,
        publicar,
      });
      setResultado(r.data);
      // Some da tabela o que entrou (ou já existia); ficam só as linhas com erro, para corrigir.
      setLinhas((atual) => {
        const mantidas = atual.filter((_, i) => situacoes[i]?.tom === "erro");
        return [...mantidas, ...vazias(Math.max(LINHAS_INICIAIS - mantidas.length, 5))];
      });
      await queryClient.invalidateQueries({ queryKey: ["marketing-subpaginas", modulo] });
      toast.success(t("Importação concluída"));
    } catch (e) {
      showApiError(e);
    } finally {
      setEnviando(false);
    }
  }

  function fechar() {
    setLinhas(vazias(LINHAS_INICIAIS));
    setResultado(null);
    setAviso(null);
    setColando(false);
    setTextoColado("");
    setLimpar(false);
    aoFechar();
  }

  return (
    <Dialog open={aberto} onOpenChange={(a) => !a && fechar()}>
      <DialogContent className="max-h-[92dvh] max-w-6xl gap-3 overflow-y-auto p-5 sm:rounded-2xl">
        <DialogTitle className="text-base font-semibold">{t("Importar produtos")}</DialogTitle>
        <DialogDescription className="text-sm text-muted-foreground">
          {t(
            "Cole da planilha (Ctrl+V na tabela) ou digite. Cada linha vira um produto ou serviço, e a última coluna diz a situação dela. Só grava quando você clicar em Importar. Só o nome é obrigatório.",
          )}
        </DialogDescription>

        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className={BOTAO_SECUNDARIO} onClick={() => setColando((v) => !v)}>
            <Table size={16} aria-hidden />
            {t("Colar da planilha")}
          </button>
          <button
            type="button"
            className={BOTAO_SECUNDARIO}
            onClick={() => arquivoRef.current?.click()}
          >
            <FileCsv size={16} aria-hidden />
            {t("Importar CSV")}
          </button>
          <input
            ref={arquivoRef}
            type="file"
            accept=".csv,.tsv,.txt,text/csv,text/plain"
            hidden
            aria-label={t("Arquivo da planilha")}
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              void aoEscolherArquivo(f);
            }}
          />
          <button type="button" className={BOTAO_SECUNDARIO} onClick={baixarModeloDeProdutos}>
            {t("Baixar modelo")}
          </button>
        </div>

        {colando ? (
          <div className="grid gap-2 rounded-2xl bg-secondary/60 p-3">
            <p className="text-xs text-muted-foreground">
              {t(
                "Copie as linhas na planilha (pode incluir o cabeçalho: nome, resumo, etapa, tipo de preço, preço, setup, carro-chefe, inclui, para quem, prazo, condições) e cole abaixo. Sem cabeçalho, vale essa ordem. Etapa: isca, entrada, principal, expansão ou recorrência.",
              )}
            </p>
            <textarea
              aria-label={t("Texto colado")}
              rows={7}
              value={textoColado}
              onChange={(e) => setTextoColado(e.target.value)}
              placeholder={
                "nome\tresumo\tetapa\ttipo de preço\tpreço\nGestão de tráfego\tAnúncios no Meta e no Google\tprincipal\tmensal\t1500,00"
              }
              className="w-full rounded-xl border bg-card p-2 font-mono text-xs"
            />
            <button
              type="button"
              disabled={!textoColado.trim()}
              onClick={() => {
                adicionarMatriz(matrizDoTexto(textoColado));
                setTextoColado("");
                setColando(false);
              }}
              className="h-10 rounded-xl bg-primary text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              {t("Adicionar à tabela")}
            </button>
          </div>
        ) : null}

        {aviso ? (
          <p className="rounded-xl bg-warning-bg px-3 py-2 text-xs text-warning-fg" role="status">
            {aviso}
          </p>
        ) : null}

        {aberto ? (
          <GradeDeColagem
            linhas={linhasGrade}
            aoMudar={(v) => {
              setLinhas(v);
              setResultado(null);
            }}
          />
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-2" data-testid="resumo">
          <div className="flex flex-wrap items-center gap-2 text-xs font-medium">
            <span
              className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1", SELO.ok)}
            >
              <CheckCircle size={14} weight="fill" aria-hidden />
              {contagem.ok} {contagem.ok === 1 ? t("pronta") : t("prontas")}
            </span>
            {contagem.avisos > 0 ? (
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2.5 py-1",
                  SELO.aviso,
                )}
              >
                <Warning size={14} weight="fill" aria-hidden />
                {contagem.avisos} {t("com aviso")}
              </span>
            ) : null}
            {contagem.erros > 0 ? (
              <span
                className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1", SELO.erro)}
              >
                <XCircle size={14} weight="fill" aria-hidden />
                {contagem.erros} {t("com erro")}
              </span>
            ) : null}
            {contagem.repetidas > 0 ? (
              <span
                className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1", SELO.dup)}
              >
                <ArrowsClockwise size={14} aria-hidden />
                {contagem.repetidas} {t("já existem ou se repetem")}
              </span>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className={BOTAO_SECUNDARIO}
              onClick={() => setLinhas((l) => [...l, ...vazias(5)])}
            >
              <Plus size={14} weight="bold" aria-hidden />
              {t("5 linhas")}
            </button>
            {limpar ? (
              <button
                type="button"
                className="inline-flex h-9 items-center rounded-xl bg-error-bg px-3 text-sm font-medium text-error-fg"
                onClick={() => {
                  setLinhas(vazias(LINHAS_INICIAIS));
                  setLimpar(false);
                  setResultado(null);
                  setAviso(null);
                }}
              >
                {t("Confirmar: limpar tabela")}
              </button>
            ) : (
              <button
                type="button"
                className="inline-flex h-9 items-center rounded-xl px-3 text-sm text-muted-foreground hover:bg-secondary"
                onClick={() => setLimpar(true)}
              >
                {t("Limpar tabela")}
              </button>
            )}
          </div>
        </div>

        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={publicar}
            onChange={(e) => setPublicar(e.target.checked)}
            className="mt-1"
          />
          <span>
            {t("Publicar ao importar")}
            <span className="block text-xs text-muted-foreground">
              {t(
                "A IA passa a enxergar estes produtos e preços na hora. Desmarcado, eles entram em rascunho para você revisar.",
              )}
            </span>
          </span>
        </label>

        <button
          type="button"
          disabled={enviando || contagem.ok === 0}
          onClick={() => void importar()}
          className="h-11 rounded-xl bg-primary text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {enviando
            ? t("Importando…")
            : `${t("Importar")} ${contagem.ok} ${contagem.ok === 1 ? t("produto") : t("produtos")}`}
        </button>

        {contagem.erros > 0 && contagem.ok > 0 ? (
          <p className="text-xs text-muted-foreground">
            {contagem.erros}{" "}
            {t("linha(s) com erro não serão gravadas: ficam na tabela para você corrigir.")}
          </p>
        ) : null}

        {problemas.length > 0 ? (
          <div className="grid gap-1 rounded-2xl border p-3" data-testid="problemas">
            <p className="text-sm font-semibold">{t("Linhas para conferir")}</p>
            <ul className="grid gap-1 text-xs">
              {(verTodos ? problemas : problemas.slice(0, 6)).map((x) => (
                <li key={x.i} className={x.tom === "erro" ? "text-error-fg" : "text-warning-fg"}>
                  <strong>
                    {t("Linha")} {x.i + 1}
                  </strong>{" "}
                  {x.texto}
                </li>
              ))}
            </ul>
            {problemas.length > 6 ? (
              <button
                type="button"
                className="w-fit text-xs text-muted-foreground underline"
                onClick={() => setVerTodos((v) => !v)}
              >
                {verTodos ? t("Mostrar menos") : `${t("Mostrar todas")} (${problemas.length})`}
              </button>
            ) : null}
          </div>
        ) : null}

        {resultado ? (
          <div className="grid gap-2 text-sm" data-testid="relatorio">
            <p className="rounded-xl bg-success-bg px-3 py-2 text-success-fg">
              {resultado.criados} {t("produtos criados")}
              {resultado.publicados
                ? ` · ${t("já publicados para a IA")}`
                : ` · ${t("em rascunho")}`}
            </p>
            {resultado.pulados.length > 0 ? (
              <p className="rounded-xl bg-secondary/60 px-3 py-2 text-xs">
                {resultado.pulados.length} {t("já existiam e foram pulados")}
              </p>
            ) : null}
            {resultado.problemas.length > 0 ? (
              <ul className="rounded-xl bg-warning-bg px-3 py-2 text-xs text-warning-fg">
                {resultado.problemas.slice(0, 8).map((p) => (
                  <li key={p.linha}>
                    {t("Linha")} {p.linha}: {p.erro}
                  </li>
                ))}
              </ul>
            ) : null}
            <button
              type="button"
              onClick={fechar}
              className="h-10 rounded-xl border bg-card text-sm font-medium hover:bg-secondary"
            >
              {t("Concluir")}
            </button>
          </div>
        ) : null}

        <p className="text-xs text-muted-foreground">
          {t(
            "Dica: Ctrl+Z desfaz na tabela; arraste o quadradinho do canto da seleção para preencher várias células. Para colar muitas linhas, o computador é mais confortável.",
          )}
        </p>
      </DialogContent>
    </Dialog>
  );
}
