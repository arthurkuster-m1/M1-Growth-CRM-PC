"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { showApiError } from "@/components/feedback/ApiErrorToast";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useT } from "@/hooks/i18n/useT";
import { apiClient } from "@/lib/api/client";
import { campoDaColuna, normalizarCabecalho } from "@/lib/leads/colunas-da-planilha";
import {
  COLUNAS_DO_LEAD,
  csvDe,
  lerTextoDeTabela,
  textoDoArquivo,
  xlsDe,
} from "@/lib/leads/tabela-de-importacao";
import {
  ArrowDown,
  ArrowUp,
  Plus,
  SlidersHorizontal,
  Trash,
  UploadSimple,
  X,
} from "@/lib/ui/icons";

import type { FunilDoPopup, EtapaDoPopup } from "./NovoLeadDoCRM";
import {
  enviarLeadsParaOCRM,
  useCamposDosFunis,
  type ResumoDaImportacaoDoCRM,
} from "./usarFunisComCampos";

const LINHAS_INICIAIS = 5;
const MAX_LINHAS = 500;

/** Sempre na tabela, nesta ordem: o nome e a forma de achar a pessoa (telefone ou e-mail). */
const FIXAS = ["titulo", "telefone", "email"] as const;

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
  const { camposDoFunil, rotulosDeTodosOsCampos } = useCamposDosFunis(aberto);
  const arquivoRef = useRef<HTMLInputElement>(null);

  // Começa SEM funil: os contatos ficam só guardados (sem funil e sem venda).
  const [funilId, setFunilId] = useState(funilInicial && false ? funilInicial : "");
  const [etapaId, setEtapaId] = useState("");
  const [colunasExtras, setColunasExtras] = useState<string[]>([]);
  const [novaColuna, setNovaColuna] = useState("");
  const definicoes = funilId ? camposDoFunil(funilId) : [];

  // TODAS as propriedades que cabem na tabela: as do cadastro do lead (as mesmas da tabela de
  // Clientes), os campos do funil escolhido e os campos personalizados.
  const todas = [
    ...COLUNAS_DO_LEAD.map((c) => ({
      id: c.id as string,
      rotulo: t(c.rotulo),
      cabecalho: c.rotulo,
    })),
    ...definicoes.map((d) => ({ id: `campo:${d.key}`, rotulo: d.label, cabecalho: d.label })),
    ...colunasExtras
      .filter((nome) => !definicoes.some((d) => d.label.toLowerCase() === nome.toLowerCase()))
      .map((nome) => ({ id: `extra:${nome}`, rotulo: nome, cabecalho: nome })),
  ];
  // As que a pessoa escolheu, na ordem dela. Começa com nome, telefone e e-mail.
  const [escolhidas, setEscolhidas] = useState<string[]>([...FIXAS]);
  const colunas = escolhidas
    .map((id) => todas.find((c) => c.id === id))
    .filter((c): c is (typeof todas)[number] => c !== undefined);
  const [linhas, setLinhas] = useState<string[][]>(() =>
    Array.from({ length: LINHAS_INICIAIS }, () => vazia(FIXAS.length)),
  );
  /** Quanto custou captar esta lista (opcional): vai para o investimento e o CPL da fonte. */
  const [custo, setCusto] = useState("");
  const [fonteDoCusto, setFonteDoCusto] = useState("");
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

  /** Muda quais colunas aparecem e em que ordem, levando junto o que já foi digitado. */
  function aplicarColunas(novos: string[]) {
    const antigos = colunas.map((c) => c.id);
    setLinhas((atual) =>
      atual.map((l) =>
        novos.map((id) => {
          const i = antigos.indexOf(id);
          return i >= 0 ? (l[i] ?? "") : "";
        }),
      ),
    );
    setEscolhidas(novos);
  }
  function adicionarColuna(id: string) {
    if (!escolhidas.includes(id)) aplicarColunas([...escolhidas, id]);
  }
  function tirarColuna(id: string) {
    if ((FIXAS as readonly string[]).includes(id)) return;
    aplicarColunas(escolhidas.filter((x) => x !== id));
  }
  function moverColuna(id: string, passo: -1 | 1) {
    const i = escolhidas.indexOf(id);
    const j = i + passo;
    if (i < FIXAS.length || j < FIXAS.length || j >= escolhidas.length) return;
    const novo = [...escolhidas];
    [novo[i], novo[j]] = [novo[j]!, novo[i]!];
    aplicarColunas(novo);
  }
  function criarColunaPersonalizada(nome: string) {
    const limpo = nome.trim();
    if (!limpo) return;
    if (!colunasExtras.includes(limpo)) setColunasExtras((a) => [...a, limpo]);
    const id = `extra:${limpo}`;
    if (!escolhidas.includes(id)) {
      // A coluna nova ainda não está em `todas` neste render: monta as linhas à mão.
      const antigos = colunas.map((c) => c.id);
      const novos = [...escolhidas, id];
      setLinhas((atual) =>
        atual.map((l) =>
          novos.map((x) => (antigos.indexOf(x) >= 0 ? (l[antigos.indexOf(x)] ?? "") : "")),
        ),
      );
      setEscolhidas(novos);
    }
  }

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
      const acharEm = (lista: Array<{ id: string; cabecalho: string }>, titulo: string) => {
        const campo = campoDaColuna(titulo);
        if (campo) return lista.find((c) => c.id === campo)?.id ?? null;
        const alvo = normalizarCabecalho(titulo);
        return (
          lista.find(
            (c) =>
              (c.id.startsWith("campo:") || c.id.startsWith("extra:")) &&
              normalizarCabecalho(c.cabecalho) === alvo,
          )?.id ?? null
        );
      };
      // Coluna do arquivo que não é do cadastro vira coluna personalizada (campo personalizado do lead).
      const novas = cab
        .map((c) => c.trim())
        .filter((c) => c !== "" && acharEm(todas, c) === null)
        .filter((c, i, a) => a.indexOf(c) === i);
      const todasExtras = [...new Set([...colunasExtras, ...novas])];
      const listaFinal = [
        ...todas.filter((c) => !c.id.startsWith("extra:")),
        ...todasExtras
          .filter((nome) => !definicoes.some((d) => d.label.toLowerCase() === nome.toLowerCase()))
          .map((nome) => ({ id: `extra:${nome}`, rotulo: nome, cabecalho: nome })),
      ];
      setColunasExtras(todasExtras);
      const destinoDe = cab.map((titulo) => acharEm(listaFinal, titulo));
      // As colunas do arquivo entram na tabela; as que a pessoa já tinha escolhida continuam.
      const finais = [...escolhidas];
      for (const id of destinoDe) if (id && !finais.includes(id)) finais.push(id);
      const nCols = finais.length;
      const dados = celulas.slice(1, MAX_LINHAS + 1).map((cels) => {
        const l = vazia(nCols);
        cels.forEach((v, i) => {
          const id = destinoDe[i];
          const d = id ? finais.indexOf(id) : -1;
          if (d >= 0) l[d] = v.trim();
        });
        return l;
      });
      setEscolhidas(finais);
      setLinhas(
        dados.length >= LINHAS_INICIAIS
          ? dados
          : [
              ...dados,
              ...Array.from({ length: LINHAS_INICIAIS - dados.length }, () => vazia(nCols)),
            ],
      );
      setAviso(
        `${dados.length} ${t("linhas lidas do arquivo.")}` +
          (novas.length > 0
            ? ` ${t("Colunas novas viraram campos personalizados:")} ${novas.join(", ")}.`
            : "") +
          (celulas.length - 1 > MAX_LINHAS
            ? ` ${t("Só as primeiras 500 linhas entram por vez.")}`
            : ""),
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
      const valorDoCusto = Number(custo.replace(/\./g, "").replace(",", "."));
      if (Number.isFinite(valorDoCusto) && valorDoCusto > 0 && fonteDoCusto.trim()) {
        try {
          await apiClient.post("/api/v1/dashboards/prospeccao/custos", {
            source: fonteDoCusto.trim(),
            amount: valorDoCusto,
            note: `${t("Importação de")} ${preenchidas.length} ${t("leads")}`,
            funil_id: funilId || null,
          });
          setCusto("");
          void queryClient.invalidateQueries({ queryKey: ["dashboard-prospeccao"] });
        } catch {
          toast.error(
            t("Os leads entraram, mas o custo não foi lançado (só gerente lança custo)."),
          );
        }
      }
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
      <DialogContent className="flex max-h-[92vh] w-[calc(100vw-1.5rem)] max-w-full flex-col overflow-x-hidden overflow-y-auto sm:max-w-5xl sm:overflow-hidden">
        <DialogHeader>
          <DialogTitle>{t("Importar leads")}</DialogTitle>
          <DialogDescription>
            {t(
              "Envie um arquivo CSV, ou preencha a tabela abaixo — dá para colar direto do Excel ou do Google Sheets.",
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-0 space-y-1.5 max-sm:w-full">
            <Label>{t("Funil padrão")}</Label>
            <Select
              value={funilId || "__sem__"}
              onValueChange={(v) => {
                setFunilId(v === "__sem__" ? "" : v);
                setEtapaId("");
                // Os campos do funil anterior saem da tabela (cada funil tem os seus).
                aplicarColunas(escolhidas.filter((id) => !id.startsWith("campo:")));
              }}
            >
              <SelectTrigger className="w-full sm:w-64">
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
              <Select
                value={etapaId || "inicial"}
                onValueChange={(v) => setEtapaId(v === "inicial" ? "" : v)}
              >
                <SelectTrigger className="w-full sm:w-52">
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

          <div className="space-y-1.5">
            <Label>{t("Custo desta lista (opcional)")}</Label>
            <div className="flex gap-2">
              <Input
                value={fonteDoCusto}
                maxLength={60}
                list="fontes-do-custo-da-importacao"
                placeholder={t("Fonte (igual à origem)")}
                aria-label={t("Fonte do custo")}
                className="w-40"
                onChange={(e) => setFonteDoCusto(e.target.value)}
              />
              <datalist id="fontes-do-custo-da-importacao">
                {["Extração de leads", "Importação de planilha", "Base de clientes", "Evento"].map(
                  (f) => (
                    <option key={f} value={f} />
                  ),
                )}
              </datalist>
              <Input
                value={custo}
                inputMode="decimal"
                placeholder="R$"
                aria-label={t("Custo")}
                className="w-28"
                onChange={(e) => setCusto(e.target.value)}
              />
            </div>
          </div>

          <input
            ref={arquivoRef}
            type="file"
            accept=".csv,text/csv,text/plain"
            className="hidden"
            aria-label={t("Escolher arquivo CSV")}
            onChange={(e) => aoEscolherArquivo(e.target.files?.[0])}
          />
          <div className="ml-auto flex flex-wrap gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button type="button" variant="outline" data-testid="colunas-da-importacao">
                  <SlidersHorizontal size={16} aria-hidden className="mr-1.5" />
                  {t("Colunas")} ({colunas.length})
                </Button>
              </PopoverTrigger>
              <PopoverContent
                align="end"
                collisionPadding={8}
                className="max-h-[var(--radix-popover-content-available-height)] w-[min(94vw,420px)] overflow-y-auto overscroll-contain p-3"
              >
                <p className="mb-2 text-xs text-muted-foreground">
                  {t(
                    "Escolha as propriedades da tabela e a ordem delas. Nome, telefone e e-mail estão sempre aqui.",
                  )}
                </p>
                <ul className="mb-3 grid gap-1">
                  {colunas.map((c, i) => {
                    const fixa = i < FIXAS.length;
                    return (
                      <li
                        key={c.id}
                        className="flex min-h-9 items-center gap-1 rounded-lg bg-secondary/50 pr-1 pl-3 text-sm"
                      >
                        <span className="min-w-0 flex-1 truncate">{c.rotulo}</span>
                        {fixa ? (
                          <span className="pr-2 text-xs text-muted-foreground">{t("sempre")}</span>
                        ) : (
                          <>
                            <button
                              type="button"
                              aria-label={`${t("Subir")} ${c.rotulo}`}
                              disabled={i <= FIXAS.length}
                              onClick={() => moverColuna(c.id, -1)}
                              className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-card disabled:opacity-30"
                            >
                              <ArrowUp size={14} aria-hidden />
                            </button>
                            <button
                              type="button"
                              aria-label={`${t("Descer")} ${c.rotulo}`}
                              disabled={i === colunas.length - 1}
                              onClick={() => moverColuna(c.id, 1)}
                              className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-card disabled:opacity-30"
                            >
                              <ArrowDown size={14} aria-hidden />
                            </button>
                            <button
                              type="button"
                              aria-label={`${t("Tirar")} ${c.rotulo}`}
                              onClick={() => tirarColuna(c.id)}
                              className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-card hover:text-error-fg"
                            >
                              <X size={14} aria-hidden />
                            </button>
                          </>
                        )}
                      </li>
                    );
                  })}
                </ul>
                {(() => {
                  const jaTem = new Set(escolhidas);
                  const livres = todas.filter((c) => !jaTem.has(c.id));
                  const rotulosJa = new Set(todas.map((c) => c.rotulo.toLowerCase()));
                  const existentes = rotulosDeTodosOsCampos.filter(
                    (r) => !rotulosJa.has(r.toLowerCase()),
                  );
                  return (
                    <div className="grid gap-2">
                      <p className="text-xs font-medium text-muted-foreground">
                        {t("Adicionar propriedade")}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {livres.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => adicionarColuna(c.id)}
                            className="rounded-full border px-2.5 py-0.5 text-xs hover:bg-secondary"
                          >
                            + {c.rotulo}
                          </button>
                        ))}
                        {existentes.map((r) => (
                          <button
                            key={`ex:${r}`}
                            type="button"
                            onClick={() => criarColunaPersonalizada(r)}
                            className="rounded-full border border-dashed px-2.5 py-0.5 text-xs hover:bg-secondary"
                          >
                            + {r}
                          </button>
                        ))}
                      </div>
                      <div className="mt-1 flex gap-2">
                        <input
                          value={novaColuna}
                          maxLength={60}
                          placeholder={t("Novo campo personalizado (ex.: Idade, Faturamento)")}
                          aria-label={t("Nome do novo campo personalizado")}
                          onChange={(e) => setNovaColuna(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && novaColuna.trim()) {
                              criarColunaPersonalizada(novaColuna);
                              setNovaColuna("");
                            }
                          }}
                          className="h-9 min-w-0 flex-1 rounded-xl border bg-card px-3 text-sm outline-hidden focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={!novaColuna.trim()}
                          onClick={() => {
                            criarColunaPersonalizada(novaColuna);
                            setNovaColuna("");
                          }}
                        >
                          <Plus size={14} weight="bold" aria-hidden className="mr-1" />
                          {t("Criar")}
                        </Button>
                      </div>
                    </div>
                  );
                })()}
              </PopoverContent>
            </Popover>
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

        {aviso ? <p className="text-xs text-muted-foreground">{aviso}</p> : null}
        <p className="text-xs text-muted-foreground">
          {t(
            "Só o nome e o telefone ou o e-mail são obrigatórios: sem funil, o lead fica guardado (sem venda). Quem já existe (mesmo telefone ou e-mail) é ATUALIZADO: o que estava vazio é preenchido, links e campos personalizados são gravados e as tags são somadas. Funil, etapa, produto e valor são opcionais. Telefone sem código do país vale como Brasil (+55). Datas: DD/MM/AAAA.",
          )}
        </p>

        <div className="min-h-[18rem] flex-1 overflow-auto rounded-xl border sm:min-h-0">
          <table className="w-full min-w-max border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-secondary text-xs text-muted-foreground">
              <tr>
                <th className="w-10 px-2 py-2 text-center font-medium">#</th>
                {colunas.map((c, i) => (
                  <th
                    key={c.id}
                    className="min-w-36 px-2 py-2 text-left font-medium whitespace-nowrap"
                  >
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
                    <td className="px-2 text-center text-xs text-muted-foreground tabular-nums">
                      {r + 1}
                    </td>
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
            onClick={() =>
              setLinhas((a) =>
                [...a, ...Array.from({ length: 5 }, () => vazia(ncols))].slice(0, MAX_LINHAS),
              )
            }
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
              {resumo.contatos_criados} {t("novos")} · {resumo.contatos_atualizados}{" "}
              {t("atualizados")} · {resumo.cards_criados} {t("no funil")} · {resumo.sem_funil}{" "}
              {t("só guardados")} · {resumo.erros.length} {t("avisos")}
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
          <Button
            type="button"
            onClick={() => void adicionar()}
            disabled={enviando || preenchidas.length === 0}
          >
            {enviando ? t("Adicionando…") : t("Adicionar Leads ao CRM")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
