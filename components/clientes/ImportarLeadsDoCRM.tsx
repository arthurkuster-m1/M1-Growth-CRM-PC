"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { showApiError } from "@/components/feedback/ApiErrorToast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useT } from "@/hooks/i18n/useT";
import { campoDaColuna, normalizarCabecalho } from "@/lib/leads/colunas-da-planilha";
import {
  COLUNAS_DO_LEAD,
  csvDe,
  lerTextoDeTabela,
  textoDoArquivo,
  xlsDe,
} from "@/lib/leads/tabela-de-importacao";
import { Trash, UploadSimple } from "@/lib/ui/icons";

import type { FunilDoPopup, EtapaDoPopup } from "./NovoLeadDoCRM";
import {
  enviarLeadsParaOCRM,
  useCamposDosFunis,
  type ResumoDaImportacaoDoCRM,
} from "./usarFunisComCampos";

const LINHAS_INICIAIS = 10;
const MAX_LINHAS = 500;

const vazia = (n: number) => Array.from({ length: n }, () => "");

function baixar(nome: string, conteudo: string, tipo: string) {
  const url = URL.createObjectURL(new Blob([conteudo], { type: tipo }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * IMPORTAR LEADS, no CRM: um popup com três jeitos — escolher um arquivo CSV, baixar o modelo
 * (CSV ou XLS) ou preencher/colar a tabela, que já traz uma coluna para cada campo do cadastro.
 * O arquivo e o que se cola caem na MESMA tabela, para conferir antes de enviar; o servidor
 * valida linha a linha e diz o que foi recusado e por quê.
 */
export function ImportarLeadsDoCRM({
  aberto,
  aoFechar,
  funis,
  etapas,
  funilInicial,
}: {
  aberto: boolean;
  aoFechar: () => void;
  funis: FunilDoPopup[];
  etapas: EtapaDoPopup[];
  funilInicial: string | null;
}) {
  const t = useT();
  const queryClient = useQueryClient();
  const { camposDoFunil } = useCamposDosFunis(aberto);
  const arquivoRef = useRef<HTMLInputElement>(null);

  // Começa SEM funil: os contatos ficam só guardados (sem funil e sem venda).
  const [funilId, setFunilId] = useState(funilInicial && false ? funilInicial : "");
  const [etapaId, setEtapaId] = useState("");
  const [colunasExtras, setColunasExtras] = useState<string[]>([]);
  const [novaColuna, setNovaColuna] = useState("");
  const definicoes = funilId ? camposDoFunil(funilId) : [];

  const colunas = useMemo(
    () => [
      ...COLUNAS_DO_LEAD.map((c) => ({ id: c.id as string, rotulo: t(c.rotulo), cabecalho: c.rotulo })),
      ...definicoes.map((d) => ({ id: `campo:${d.key}`, rotulo: d.label, cabecalho: d.label })),
      ...colunasExtras
        .filter((nome) => !definicoes.some((d) => d.label.toLowerCase() === nome.toLowerCase()))
        .map((nome) => ({ id: `extra:${nome}`, rotulo: nome, cabecalho: nome })),
    ],
    // `t` é identidade; as definições mudam com o funil.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [funilId, definicoes.length, colunasExtras],
  );
  const [linhas, setLinhas] = useState<string[][]>(() =>
    Array.from({ length: LINHAS_INICIAIS }, () => vazia(COLUNAS_DO_LEAD.length)),
  );
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [resumo, setResumo] = useState<(ResumoDaImportacaoDoCRM & { mapa: number[] }) | null>(null);

  const etapasAbertas = etapas.filter((e) => e.pipeline_id === funilId && !e.is_won && !e.is_lost);
  const ncols = colunas.length;
  // Linhas com alguma célula preenchida (as que serão enviadas).
  const preenchidas = linhas
    .map((l, i) => ({ l, i }))
    .filter(({ l }) => l.some((c) => c.trim() !== ""));

  /** Cada linha tem sempre `ncols` células (o funil pode ter mudado as colunas). */
  const ajustada = (l: string[]) =>
    l.length === ncols ? l : [...l.slice(0, ncols), ...vazia(Math.max(0, ncols - l.length))];

  function editar(r: number, c: number, valor: string) {
    setLinhas((atual) =>
      atual.map((l, i) => {
        if (i !== r) return l;
        const nova = ajustada(l).slice();
        nova[c] = valor;
        return nova;
      }),
    );
  }

  /** Cola uma tabela inteira a partir da célula (r, c), crescendo a lista se precisar. */
  function colar(r: number, c: number, texto: string) {
    const bloco = lerTextoDeTabela(texto);
    setLinhas((atual) => {
      const copia = atual.map(ajustada).map((l) => l.slice());
      bloco.forEach((cels, dr) => {
        const alvo = r + dr;
        while (copia.length <= alvo && copia.length < MAX_LINHAS) copia.push(vazia(ncols));
        if (alvo >= copia.length) return;
        cels.forEach((v, dc) => {
          if (c + dc < ncols) copia[alvo]![c + dc] = v.trim();
        });
      });
      return copia;
    });
  }

  function aoEscolherArquivo(f: File | undefined) {
    if (!f) return;
    setErro(null);
    setAviso(null);
    setResumo(null);
    void f.arrayBuffer().then((bytes) => {
      const celulas = lerTextoDeTabela(textoDoArquivo(bytes));
      if (celulas.length < 2) {
        setErro(t("O arquivo está vazio ou sem linhas de dados."));
        return;
      }
      const cab = celulas[0]!;
      // Cada coluna do arquivo vai para a coluna da tabela que tem o mesmo nome.
      const destino = cab.map((titulo) => {
        const campo = campoDaColuna(titulo);
        if (campo) return colunas.findIndex((c) => c.id === campo);
        const alvo = normalizarCabecalho(titulo);
        return colunas.findIndex(
          (c) => c.id.startsWith("campo:") && normalizarCabecalho(c.cabecalho) === alvo,
        );
      });
      // Coluna que não é do cadastro vira coluna personalizada (campo personalizado do lead).
      const novas = cab
        .map((c) => c.trim())
        .filter((c, i) => destino[i] === -1 && c !== "")
        .filter((c, i, a) => a.indexOf(c) === i);
      const todasExtras = [...new Set([...colunasExtras, ...novas])];
      const colunasFinais = [
        ...colunas.filter((c) => !c.id.startsWith("extra:")),
        ...todasExtras
          .filter((nome) => !definicoes.some((d) => d.label.toLowerCase() === nome.toLowerCase()))
          .map((nome) => ({ id: `extra:${nome}`, rotulo: nome, cabecalho: nome })),
      ];
      setColunasExtras(todasExtras);
      const destinoFinal = cab.map((titulo) => {
        const campo = campoDaColuna(titulo);
        if (campo) return colunasFinais.findIndex((c) => c.id === campo);
        const alvo = normalizarCabecalho(titulo);
        return colunasFinais.findIndex(
          (c) =>
            (c.id.startsWith("campo:") || c.id.startsWith("extra:")) &&
            normalizarCabecalho(c.cabecalho) === alvo,
        );
      });
      const nCols = colunasFinais.length;
      const dados = celulas.slice(1, MAX_LINHAS + 1).map((cels) => {
        const l = vazia(nCols);
        cels.forEach((v, i) => {
          const d = destinoFinal[i];
          if (d !== undefined && d >= 0) l[d] = v.trim();
        });
        return l;
      });
      setLinhas(
        dados.length >= LINHAS_INICIAIS
          ? dados
          : [...dados, ...Array.from({ length: LINHAS_INICIAIS - dados.length }, () => vazia(nCols))],
      );
      setAviso(
        `${dados.length} ${t("linhas lidas do arquivo.")}` +
          (novas.length > 0
            ? ` ${t("Colunas novas viraram campos personalizados:")} ${novas.join(", ")}.`
            : "") +
          (celulas.length - 1 > MAX_LINHAS ? ` ${t("Só as primeiras 500 linhas entram por vez.")}` : ""),
      );
    });
    if (arquivoRef.current) arquivoRef.current.value = "";
  }

  function baixarModelo(formato: "csv" | "xls") {
    const exemplos: Record<string, string> = {
      titulo: "Maria Silva",
      telefone: "(11) 99999-8888",
      email: "maria@exemplo.com",
      origem: "Meta Ads",
      campanha: "",
      conjunto: "",
      anuncio: "",
      landing_page: "",
      posicionamento: "",
      funil: funis.find((f) => f.id === funilId)?.name ?? "",
      etapa: etapasAbertas[0]?.name ?? "",
      produto: "",
      valor: "1.500,00",
      status_da_venda: "Interesse",
      previsao: "30/12/2026",
      descricao: "Pediu orçamento",
      etiquetas: "vip; recompra",
      nascimento: "15/03/1990",
    };
    const exemplo = colunas.map((c) => exemplos[c.id] ?? "");
    const tabela = [colunas.map((c) => c.cabecalho), exemplo];
    if (formato === "csv") baixar("modelo-de-leads.csv", csvDe(tabela), "text/csv;charset=utf-8");
    else baixar("modelo-de-leads.xls", xlsDe(tabela), "application/vnd.ms-excel");
  }

  async function adicionar() {
    if (preenchidas.length === 0) {
      setErro(t("Preencha ao menos uma linha."));
      return;
    }
    setEnviando(true);
    setErro(null);
    setResumo(null);
    try {
      const r = await enviarLeadsParaOCRM({
        pipeline_id: funilId || null,
        stage_id: funilId && etapaId ? etapaId : null,
        celulas: [
          colunas.map((c) => c.cabecalho),
          ...preenchidas.map(({ l }) => ajustada(l).map((c) => c.trim())),
        ],
      });
      void queryClient.invalidateQueries({ queryKey: ["clientes"] });
      if (r.erros.length === 0) {
        toast.success(
          `${r.contatos_criados} ${t("novos")} · ${r.contatos_atualizados} ${t("atualizados")} · ${r.cards_criados} ${t("no funil")}`,
        );
        setLinhas(Array.from({ length: LINHAS_INICIAIS }, () => vazia(ncols)));
        aoFechar();
        return;
      }
      setResumo({ ...r, mapa: preenchidas.map(({ i }) => i + 1) });
    } catch (e) {
      showApiError(e);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={(a) => !a && aoFechar()}>
      <DialogContent className="flex max-h-[92vh] flex-col overflow-hidden sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>{t("Importar leads")}</DialogTitle>
          <DialogDescription>
            {t(
              "Envie um arquivo CSV, ou preencha a tabela abaixo — dá para colar direto do Excel ou do Google Sheets.",
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label>{t("Funil padrão")}</Label>
            <Select
              value={funilId || "__sem__"}
              onValueChange={(v) => {
                setFunilId(v === "__sem__" ? "" : v);
                setEtapaId("");
                // Colunas do funil novo: as células personalizadas recomeçam.
                setLinhas((atual) => atual.map((l) => l.slice(0, COLUNAS_DO_LEAD.length)));
              }}
            >
              <SelectTrigger className="w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__sem__">{t("Sem funil — só guardar os contatos")}</SelectItem>
                {funis.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {funilId ? (
          <div className="space-y-1.5">
            <Label>{t("Etapa padrão")}</Label>
            <Select value={etapaId || "inicial"} onValueChange={(v) => setEtapaId(v === "inicial" ? "" : v)}>
              <SelectTrigger className="w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="inicial">{t("Primeira etapa do funil")}</SelectItem>
                {etapasAbertas.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          ) : null}

          <input
            ref={arquivoRef}
            type="file"
            accept=".csv,text/csv,text/plain"
            className="hidden"
            aria-label={t("Escolher arquivo CSV")}
            onChange={(e) => aoEscolherArquivo(e.target.files?.[0])}
          />
          <div className="ml-auto flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => arquivoRef.current?.click()}>
              <UploadSimple size={16} aria-hidden className="mr-1.5" />
              {t("Importar arquivo CSV")}
            </Button>
            <Button type="button" variant="outline" onClick={() => baixarModelo("csv")}>
              {t("Modelo CSV")}
            </Button>
            <Button type="button" variant="outline" onClick={() => baixarModelo("xls")}>
              {t("Modelo XLS")}
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            value={novaColuna}
            maxLength={60}
            placeholder={t("Nova coluna personalizada (ex.: Renda, Cidade)")}
            aria-label={t("Nome da nova coluna personalizada")}
            onChange={(e) => setNovaColuna(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && novaColuna.trim()) {
                setColunasExtras((a) => (a.includes(novaColuna.trim()) ? a : [...a, novaColuna.trim()]));
                setNovaColuna("");
              }
            }}
            className="h-9 w-72 rounded-xl border bg-background px-3 text-sm outline-hidden focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!novaColuna.trim()}
            onClick={() => {
              setColunasExtras((a) => (a.includes(novaColuna.trim()) ? a : [...a, novaColuna.trim()]));
              setNovaColuna("");
            }}
          >
            {t("+ Adicionar coluna")}
          </Button>
        </div>
        {aviso ? <p className="text-xs text-muted-foreground">{aviso}</p> : null}
        <p className="text-xs text-muted-foreground">
          {t(
            "Só o nome e o telefone ou o e-mail são obrigatórios: sem funil, o lead fica guardado (sem venda). Funil, etapa, produto e valor são opcionais. Telefone sem código do país vale como Brasil (+55). Datas: DD/MM/AAAA.",
          )}
        </p>

        <div className="min-h-0 flex-1 overflow-auto rounded-xl border">
          <table className="w-full min-w-max border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-secondary text-xs text-muted-foreground">
              <tr>
                <th className="w-10 px-2 py-2 text-center font-medium">#</th>
                {colunas.map((c, i) => (
                  <th key={c.id} className="min-w-36 px-2 py-2 text-left font-medium whitespace-nowrap">
                    {c.rotulo}
                    {i === 0 ? " *" : ""}
                  </th>
                ))}
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {linhas.map((linha, r) => {
                const l = ajustada(linha);
                return (
                  <tr key={r} className="border-t">
                    <td className="px-2 text-center text-xs text-muted-foreground tabular-nums">{r + 1}</td>
                    {colunas.map((c, ci) => (
                      <td key={c.id} className="p-0">
                        <input
                          value={l[ci] ?? ""}
                          aria-label={`${c.rotulo} ${r + 1}`}
                          onChange={(e) => editar(r, ci, e.target.value)}
                          onPaste={(e) => {
                            const texto = e.clipboardData.getData("text");
                            // Uma célula só: deixa o navegador colar normalmente.
                            if (!/[\t\n\r]/.test(texto.trim())) return;
                            e.preventDefault();
                            colar(r, ci, texto);
                          }}
                          className="h-9 w-full bg-transparent px-2 outline-hidden focus:bg-background focus:ring-2 focus:ring-primary/30 focus:ring-inset"
                        />
                      </td>
                    ))}
                    <td className="px-1">
                      <button
                        type="button"
                        aria-label={t("Apagar linha")}
                        onClick={() =>
                          setLinhas((a) => (a.length > 1 ? a.filter((_, i) => i !== r) : a))
                        }
                        className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-error-fg"
                      >
                        <Trash size={14} aria-hidden />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={MAX_LINHAS <= linhas.length}
            onClick={() => setLinhas((a) => [...a, ...Array.from({ length: 5 }, () => vazia(ncols))].slice(0, MAX_LINHAS))}
          >
            {t("+ Adicionar 5 linhas")}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setLinhas(Array.from({ length: LINHAS_INICIAIS }, () => vazia(ncols)));
              setResumo(null);
              setAviso(null);
            }}
          >
            {t("Limpar tabela")}
          </Button>
          <span className="text-xs text-muted-foreground">
            {preenchidas.length} {t("linhas preenchidas")}
          </span>
        </div>

        {erro ? (
          <p role="alert" className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm">
            {erro}
          </p>
        ) : null}

        {resumo ? (
          <div className="max-h-40 overflow-y-auto rounded-xl border p-3 text-sm" role="status">
            <p className="font-medium">
              {resumo.contatos_criados} {t("novos")} · {resumo.contatos_atualizados} {t("atualizados")} ·{" "}
              {resumo.cards_criados} {t("no funil")} · {resumo.sem_funil} {t("só guardados")} ·{" "}
              {resumo.erros.length} {t("avisos")}
            </p>
            <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
              {resumo.erros.map((e, i) => (
                <li key={`${e.linha}-${i}`}>
                  {t("Linha")} {resumo.mapa[e.linha - 2] ?? e.linha - 1}: {e.motivo}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={aoFechar} disabled={enviando}>
            {resumo ? t("Fechar") : t("Cancelar")}
          </Button>
          <Button type="button" onClick={() => void adicionar()} disabled={enviando || preenchidas.length === 0}>
            {enviando ? t("Adicionando…") : t("Adicionar Leads ao CRM")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
