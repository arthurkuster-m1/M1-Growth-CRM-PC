"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
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
import { LinkVoltar } from "@/components/ui/LinkVoltar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useT } from "@/hooks/i18n/useT";
import { apiClient } from "@/lib/api/client";
import {
  resumirConferencia,
  type ConferenciaDaImportacao,
  type SituacaoDaLinha,
} from "@/lib/leads/conferencia-da-importacao";
import { campoDaColuna, normalizarCabecalho } from "@/lib/leads/colunas-da-planilha";
import {
  COLUNAS_DO_LEAD,
  csvDe,
  lerTextoDeTabela,
  textoDoArquivo,
} from "@/lib/leads/tabela-de-importacao";
import { ClipboardText, Plus, UploadSimple } from "@/lib/ui/icons";

import { enviarLeadsParaOCRM, type ResumoDaImportacaoDoCRM } from "../usarFunisComCampos";
import type { LinhaDeLead, LinhaGrade } from "./GradeDeLeads";
import { SeletorDeColunas } from "./SeletorDeColunas";
import { colunasQueFaltam, moverColuna, ocultarColuna } from "@/lib/leads/ordem-das-colunas";
import { celulaUnicaAlterada, useHistorico } from "./usar-historico";

// A grade usa `window`: carrega só no navegador.
const GradeDeLeads = dynamic(() => import("./GradeDeLeads"), {
  ssr: false,
  loading: () => <div className="h-64 animate-pulse rounded-xl bg-secondary" aria-busy="true" />,
});

const MAX_LINHAS = 500;
const LINHAS_INICIAIS = 8;
const ATRASO_DA_CONFERENCIA_MS = 500;
/** O que aparece de saída: nome, telefone, e-mail e, logo depois, a data e o horário da entrada. */
const PADRAO = ["titulo", "telefone", "email", "data_entrada", "hora_entrada", "origem"];

interface Opcoes {
  funis: Array<{ id: string; name: string; campos: Array<{ key: string; label: string }> }>;
  etapas: Array<{
    id: string;
    pipeline_id: string;
    name: string;
    is_won: boolean;
    is_lost: boolean;
  }>;
}

const vazias = (n: number): LinhaDeLead[] => Array.from({ length: n }, () => ({}));

function baixar(nome: string, conteudo: string, tipo: string) {
  const url = URL.createObjectURL(new Blob([conteudo], { type: tipo }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * IMPORTAR LEADS em massa — uma PÁGINA (não mais um popup), no mesmo jeito da importação em massa
 * de veículos do app Gestão de Frota: uma grade estilo Excel onde se cola a planilha (Ctrl+V),
 * seleciona várias células, copia, recorta, apaga e desfaz (Ctrl+Z). Cada linha mostra, no fim,
 * a SITUAÇÃO dela: se está tudo certo e exatamente o que vai acontecer e onde o lead entra. Embaixo,
 * a revisão de tudo. Só grava ao clicar em Importar — e só se nenhuma linha estiver com erro.
 */
export function ImportarLeadsPagina() {
  const t = useT();
  const router = useRouter();
  const queryClient = useQueryClient();
  const arquivoRef = useRef<HTMLInputElement>(null);

  const opcoes = useQuery({
    queryKey: ["clientes", "importar", "opcoes"],
    staleTime: 60_000,
    queryFn: async () =>
      (await apiClient.get<{ data: Opcoes }>("/api/v1/clientes/importar/opcoes")).data,
  });
  const funis = useMemo(() => opcoes.data?.funis ?? [], [opcoes.data]);
  const etapas = useMemo(() => opcoes.data?.etapas ?? [], [opcoes.data]);

  const [funilId, setFunilId] = useState("");
  const [etapaId, setEtapaId] = useState("");
  const { estado, mudar, desfazer, refazer, podeDesfazer, podeRefazer } = useHistorico(() => ({
    linhas: vazias(LINHAS_INICIAIS),
    visiveis: PADRAO,
    extras: [],
  }));
  const { linhas, visiveis, extras } = estado;
  const [colando, setColando] = useState(false);
  const [quantasLinhas, setQuantasLinhas] = useState("5");
  const [texto, setTexto] = useState("");
  const [custo, setCusto] = useState("");
  const [fonteDoCusto, setFonteDoCusto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ResumoDaImportacaoDoCRM | null>(null);

  const funil = funis.find((f) => f.id === funilId) ?? null;
  const etapasAbertas = etapas.filter((e) => e.pipeline_id === funilId && !e.is_won && !e.is_lost);

  // TODAS as colunas possíveis: as do cadastro do lead, os campos do funil e os personalizados.
  const todas = useMemo(
    () => [
      ...COLUNAS_DO_LEAD.map((c) => ({
        id: c.id as string,
        rotulo: t(c.rotulo),
        cabecalho: c.rotulo,
      })),
      ...(funil?.campos ?? []).map((d) => ({
        id: `campo:${d.key}`,
        rotulo: d.label,
        cabecalho: d.label,
      })),
      ...extras
        .filter(
          (nome) =>
            !(funil?.campos ?? []).some((d) => d.label.toLowerCase() === nome.toLowerCase()),
        )
        .map((nome) => ({ id: `extra:${nome}`, rotulo: nome, cabecalho: nome })),
    ],
    // `t` é estável entre renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [funil, extras],
  );
  const colunas = useMemo(
    () =>
      visiveis
        .map((id) => todas.find((c) => c.id === id))
        .filter((c): c is (typeof todas)[number] => c !== undefined),
    [visiveis, todas],
  );
  const sugeridas = useMemo(
    () => [...new Set(funis.flatMap((f) => f.campos.map((c) => c.label)))],
    [funis],
  );

  const ids = colunas.map((c) => c.id);
  // Qualquer coluna pode ser ocultada; mas sem o Nome e sem Telefone ou E-mail não há o que importar.
  const faltam = colunasQueFaltam(ids);
  const semColunasObrigatorias = faltam.nome || faltam.contato;
  const textoDoQueFalta = [
    faltam.nome ? t("Nome") : null,
    faltam.contato ? t("Telefone ou E-mail") : null,
  ]
    .filter(Boolean)
    .join(` ${t("e")} `);
  const celulaDe = (l: LinhaDeLead, id: string) => (l[id] ?? "").trim();
  const preenchida = (l: LinhaDeLead) => ids.some((id) => celulaDe(l, id) !== "");

  // ---- A CONFERÊNCIA (o servidor simula a importação e diz o que vai acontecer em cada linha) ----
  // Cada linha tem uma chave pelo conteúdo (e pela ordem entre iguais), para a situação acompanhar
  // a linha mesmo quando outras são apagadas ou inseridas.
  const chavesDasLinhas = useMemo(() => {
    const vistos = new Map<string, number>();
    return linhas.map((l) => {
      const base = ids.map((id) => celulaDe(l, id)).join("\u0001");
      const n = (vistos.get(base) ?? 0) + 1;
      vistos.set(base, n);
      return `${n}|${base}`;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linhas, visiveis]);

  const [situacoes, setSituacoes] = useState<Map<string, SituacaoDaLinha>>(new Map());
  const [erroDaTabela, setErroDaTabela] = useState<string | null>(null);
  const senha = useRef(0);
  const conteudoParaConferir = useMemo(() => {
    const cabecalho = colunas.map((c) => c.cabecalho);
    const idx: number[] = [];
    const cels: string[][] = [];
    linhas.forEach((l, i) => {
      if (!preenchida(l)) return;
      idx.push(i);
      cels.push(ids.map((id) => celulaDe(l, id)));
    });
    return { cabecalho, idx, cels };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linhas, visiveis, todas]);

  useEffect(() => {
    const { cabecalho, idx, cels } = conteudoParaConferir;
    // Sem linhas preenchidas não há o que conferir (a revisão nem mostra o erro antigo).
    if (idx.length === 0 || semColunasObrigatorias) return;
    const minha = ++senha.current;
    const espera = setTimeout(() => {
      void apiClient
        .post<{ data: ConferenciaDaImportacao }>("/api/v1/clientes/importar/conferir", {
          celulas: [cabecalho, ...cels],
          pipeline_id: funilId || null,
          stage_id: funilId && etapaId ? etapaId : null,
        })
        .then((r) => {
          if (minha !== senha.current) return;
          const mapa = new Map<string, SituacaoDaLinha>();
          for (const s of r.data.linhas) {
            const i = idx[s.linha - 2];
            if (i !== undefined) mapa.set(chavesDasLinhas[i]!, s);
          }
          setSituacoes(mapa);
          setErroDaTabela(null);
        })
        .catch((e: unknown) => {
          if (minha !== senha.current) return;
          setSituacoes(new Map());
          setErroDaTabela(e instanceof Error ? e.message : t("Não consegui conferir as linhas."));
        });
    }, ATRASO_DA_CONFERENCIA_MS);
    return () => clearTimeout(espera);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conteudoParaConferir, funilId, etapaId, semColunasObrigatorias]);

  const dados: LinhaGrade[] = useMemo(
    () =>
      linhas.map((l, i) => {
        if (!preenchida(l)) return { ...l, __tom: "ign" as const };
        if (semColunasObrigatorias) {
          return {
            ...l,
            __tom: "aviso" as const,
            __texto: `${t("Mostre na tabela a coluna")} ${textoDoQueFalta} ${t("para importar")}`,
          };
        }
        const s = situacoes.get(chavesDasLinhas[i]!);
        return s
          ? { ...l, __tom: s.tom, __texto: s.texto }
          : { ...l, __tom: "esperando" as const, __texto: t("Conferindo…") };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [linhas, situacoes, chavesDasLinhas, visiveis, semColunasObrigatorias],
  );
  const linhasConferidas = semColunasObrigatorias
    ? []
    : dados.flatMap((d, i) => {
        const s = situacoes.get(chavesDasLinhas[i]!);
        return s && d.__tom !== "ign" && d.__tom !== "esperando" ? [s] : [];
      });
  const esperando = dados.some((d) => d.__tom === "esperando");
  const resumo = resumirConferencia(linhasConferidas);
  const totalPreenchidas = linhas.filter(preenchida).length;
  const nomeDoDestino = (d: string | null) => d ?? t("Só guardados nos contatos (sem funil)");

  // ---- Mexer nas colunas e nas linhas ----
  /** Avisa o que mudou e oferece o desfazer (o mesmo do Ctrl+Z). */
  function avisarComDesfazer(mensagem: string) {
    toast(mensagem, { action: { label: t("Desfazer"), onClick: desfazer } });
  }

  function criarColunaPersonalizada(nome: string) {
    const limpo = nome.trim();
    if (!limpo) return;
    const id = `extra:${limpo}`;
    mudar({
      extras: extras.includes(limpo) ? extras : [...extras, limpo],
      visiveis: visiveis.includes(id) ? visiveis : [...visiveis, id],
    });
  }

  /** Põe uma tabela (com ou sem cabeçalho) na grade, no fim do que já foi digitado. */
  function entrarMatriz(matriz: string[][]) {
    const dadosBrutos = matriz.filter((l) => l.some((c) => c.trim() !== ""));
    if (dadosBrutos.length === 0) {
      setErro(t("Não encontrei linhas nesse texto."));
      return;
    }
    setErro(null);
    const primeira = dadosBrutos[0]!;
    const reconhecidas = primeira.filter((c) => campoDaColuna(c) !== null).length;
    const temCabecalho = reconhecidas >= 2;

    let destino: Array<string | null>;
    let novosVisiveis = visiveis;
    let novosExtras = extras;
    if (temCabecalho) {
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
      // Coluna do arquivo que não é do cadastro vira coluna personalizada (campo do lead).
      const novas = primeira
        .map((c) => c.trim())
        .filter((c) => c !== "" && acharEm(todas, c) === null)
        .filter((c, i, a) => a.indexOf(c) === i);
      novosExtras = [...new Set([...extras, ...novas])];
      const listaFinal = [
        ...todas.filter((c) => !c.id.startsWith("extra:")),
        ...novosExtras
          .filter(
            (nome) =>
              !(funil?.campos ?? []).some((d) => d.label.toLowerCase() === nome.toLowerCase()),
          )
          .map((nome) => ({ id: `extra:${nome}`, cabecalho: nome })),
      ];
      destino = primeira.map((titulo) => acharEm(listaFinal, titulo));
      novosVisiveis = [...visiveis];
      for (const id of destino) if (id && !novosVisiveis.includes(id)) novosVisiveis.push(id);
      if (novas.length > 0) {
        setAviso(`${t("Colunas novas viraram campos personalizados:")} ${novas.join(", ")}.`);
      } else setAviso(null);
    } else {
      destino = visiveis;
      setAviso(null);
    }

    const corpo = temCabecalho ? dadosBrutos.slice(1) : dadosBrutos;
    const novas: LinhaDeLead[] = corpo.slice(0, MAX_LINHAS).map((cels) => {
      const l: LinhaDeLead = {};
      cels.forEach((v, i) => {
        const id = destino[i];
        if (id && v.trim() !== "") l[id] = v.trim();
      });
      return l;
    });
    if (corpo.length > MAX_LINHAS) {
      setAviso((a) => `${a ?? ""} ${t("Só as primeiras 500 linhas entram por vez.")}`.trim());
    }
    const base = linhas.filter((l) => Object.values(l).some((v) => (v ?? "").trim() !== ""));
    mudar({
      extras: novosExtras,
      visiveis: novosVisiveis,
      linhas: [...base, ...novas, ...vazias(3)].slice(0, MAX_LINHAS + 3),
    });
  }

  /** Põe linhas em branco no fim da tabela, para preencher à mão (até o limite de uma importação). */
  function adicionarLinhas() {
    const n = Math.min(100, Math.max(1, Math.floor(Number(quantasLinhas)) || 1));
    const espaco = MAX_LINHAS + 3 - linhas.length;
    if (espaco <= 0) {
      toast.error(
        `${t("A tabela já está no limite de")} ${MAX_LINHAS} ${t("linhas por importação.")}`,
      );
      return;
    }
    mudar({ linhas: [...linhas, ...vazias(Math.min(n, espaco))] });
    if (n > espaco) {
      toast.info(
        `${t("Só couberam")} ${espaco} ${t("linhas: o limite é de")} ${MAX_LINHAS} ${t("por importação.")}`,
      );
    }
    // Leva a vista para as linhas novas.
    requestAnimationFrame(() => {
      const rolagem = document.querySelector<HTMLElement>(".leads-grade .dsg-container");
      if (rolagem) rolagem.scrollTop = rolagem.scrollHeight;
    });
  }

  function aoEscolherArquivo(f: File | undefined) {
    if (!f) return;
    void f.arrayBuffer().then(
      (bytes) => entrarMatriz(lerTextoDeTabela(textoDoArquivo(bytes))),
      () =>
        setErro(
          t(
            "Não consegui ler esse arquivo. Use CSV ou TXT separado por vírgula, ponto e vírgula ou tab.",
          ),
        ),
    );
    if (arquivoRef.current) arquivoRef.current.value = "";
  }

  function baixarModelo() {
    const exemplos: Record<string, string> = {
      titulo: "Maria Silva",
      telefone: "(11) 99999-8888",
      email: "maria@exemplo.com",
      data_entrada: "16/11/2026",
      hora_entrada: "14:30",
      origem: "Meta Ads",
      funil: funil?.name ?? "",
      etapa: etapasAbertas[0]?.name ?? "",
      valor: "1.500,00",
      status_da_venda: "Interesse",
      previsao: "30/12/2026",
      descricao: "Pediu orçamento",
      etiquetas: "vip; recompra",
      nascimento: "15/03/1990",
    };
    baixar(
      "modelo-de-leads.csv",
      csvDe([colunas.map((c) => c.cabecalho), colunas.map((c) => exemplos[c.id] ?? "")]),
      "text/csv;charset=utf-8",
    );
  }

  function removerLinhasComErro() {
    const comErro = new Set(dados.flatMap((d, i) => (d.__tom === "erro" ? [i] : [])));
    if (comErro.size === 0) return;
    avisarComDesfazer(`${comErro.size} ${t("linhas com erro removidas")}`);
    const resto = linhas.filter((_, i) => !comErro.has(i));
    mudar({ linhas: resto.length > 0 ? resto : vazias(LINHAS_INICIAIS) });
  }

  async function importar() {
    const prontas = linhas.filter(preenchida);
    if (prontas.length === 0) return;
    setEnviando(true);
    setErro(null);
    try {
      const r = await enviarLeadsParaOCRM({
        pipeline_id: funilId || null,
        stage_id: funilId && etapaId ? etapaId : null,
        celulas: [
          colunas.map((c) => c.cabecalho),
          ...prontas.map((l) => ids.map((id) => celulaDe(l, id))),
        ],
      });
      void queryClient.invalidateQueries({ queryKey: ["clientes"] });
      const valorDoCusto = Number(custo.replace(/\./g, "").replace(",", "."));
      if (Number.isFinite(valorDoCusto) && valorDoCusto > 0 && fonteDoCusto.trim()) {
        try {
          await apiClient.post("/api/v1/dashboards/prospeccao/custos", {
            source: fonteDoCusto.trim(),
            amount: valorDoCusto,
            note: `${t("Importação de")} ${prontas.length} ${t("leads")}`,
            funil_id: funilId || null,
          });
          void queryClient.invalidateQueries({ queryKey: ["dashboard-prospeccao"] });
        } catch {
          toast.error(
            t("Os leads entraram, mas o custo não foi lançado (só gerente lança custo)."),
          );
        }
      }
      const frase =
        `${r.contatos_criados} ${t("novos")} · ${r.contatos_atualizados} ${t("atualizados")} · ${r.cards_criados} ${t("no funil")}` +
        (r.lps_criadas > 0 ? ` · ${r.lps_criadas} ${t("LPs cadastradas")}` : "");
      if (r.erros.length === 0) {
        toast.success(frase);
        router.push("/app/clientes");
        return;
      }
      mudar({ linhas: vazias(LINHAS_INICIAIS) });
      setResultado(r);
    } catch (e) {
      showApiError(e);
      setErro(t("Nada foi confirmado. Confira a tabela e tente de novo."));
    } finally {
      setEnviando(false);
    }
  }

  const podeImportar =
    !enviando &&
    !esperando &&
    !semColunasObrigatorias &&
    resumo.prontas > 0 &&
    resumo.comErro === 0;

  return (
    <div className="mx-auto flex w-full max-w-[1800px] flex-col gap-4 p-4 sm:px-8 sm:py-6 2xl:px-12">
      <LinkVoltar href="/app/clientes">{t("CRM")}</LinkVoltar>
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{t("Importar leads em massa")}</h1>
        <p className="text-sm text-muted-foreground">
          {t(
            "Cole a tabela do Excel ou do Google Sheets direto na grade (Ctrl+V), ou use os botões. Só o nome e o telefone ou o e-mail são obrigatórios. Cada linha mostra no fim o que vai acontecer com o lead.",
          )}
        </p>
      </header>

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-0 space-y-1.5 max-sm:w-full">
          <Label>{t("Funil padrão")}</Label>
          <Select
            value={funilId || "__sem__"}
            onValueChange={(v) => {
              setFunilId(v === "__sem__" ? "" : v);
              setEtapaId("");
              // Os campos do funil anterior saem da tabela (cada funil tem os seus).
              mudar({ visiveis: visiveis.filter((id) => !id.startsWith("campo:")) });
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
              className="w-56 min-w-0"
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
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <SeletorDeColunas
          todas={todas}
          visiveis={visiveis}
          sugeridas={sugeridas}
          aoMudar={(novas) => mudar({ visiveis: novas })}
          aoCriarPersonalizada={criarColunaPersonalizada}
        />
        <Button type="button" variant="outline" onClick={() => setColando(true)}>
          <ClipboardText size={16} aria-hidden className="mr-1.5" />
          {t("Colar texto")}
        </Button>
        <input
          ref={arquivoRef}
          type="file"
          accept=".csv,.txt,.tsv,text/csv,text/plain"
          className="hidden"
          aria-label={t("Escolher arquivo CSV")}
          onChange={(e) => aoEscolherArquivo(e.target.files?.[0])}
        />
        <Button type="button" variant="outline" onClick={() => arquivoRef.current?.click()}>
          <UploadSimple size={16} aria-hidden className="mr-1.5" />
          {t("Abrir CSV")}
        </Button>
        <Button type="button" variant="outline" onClick={baixarModelo}>
          {t("Modelo CSV")}
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={totalPreenchidas === 0}
          onClick={() => {
            avisarComDesfazer(t("Tabela limpa"));
            mudar({ linhas: vazias(LINHAS_INICIAIS) });
            setResultado(null);
            setAviso(null);
          }}
        >
          {t("Limpar")}
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={!podeDesfazer}
          onClick={desfazer}
          title="Ctrl+Z"
        >
          {t("Desfazer")}
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={!podeRefazer}
          onClick={refazer}
          title="Ctrl+Y"
        >
          {t("Refazer")}
        </Button>
        <span className="text-xs text-muted-foreground">
          {totalPreenchidas} {t("linhas preenchidas")}
        </span>
      </div>

      {aviso ? <p className="text-xs text-muted-foreground">{aviso}</p> : null}

      <GradeDeLeads
        aoMoverColuna={(movido, alvo) => mudar({ visiveis: moverColuna(visiveis, movido, alvo) })}
        aoOcultarColuna={(id) => mudar({ visiveis: ocultarColuna(visiveis, id) })}
        colunas={colunas.map((c) => ({
          id: c.id,
          rotulo: c.rotulo,
          obrigatoria: c.id === "titulo",
        }))}
        linhas={dados}
        aoMudar={(v) =>
          mudar({ linhas: v.slice(0, MAX_LINHAS + 3) }, celulaUnicaAlterada(linhas, v))
        }
      />
      <div className="flex flex-wrap items-center gap-2" data-testid="adicionar-linhas">
        <Button type="button" variant="outline" size="sm" onClick={adicionarLinhas}>
          <Plus size={14} weight="bold" aria-hidden className="mr-1" />
          {t("Adicionar linhas")}
        </Button>
        <Input
          type="number"
          min={1}
          max={100}
          inputMode="numeric"
          value={quantasLinhas}
          aria-label={t("Quantas linhas adicionar")}
          className="h-9 w-20"
          onChange={(e) => setQuantasLinhas(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") adicionarLinhas();
          }}
        />
        <span className="text-xs text-muted-foreground">
          {linhas.length} {t("linhas na tabela")} · {t("limite de")} {MAX_LINHAS}{" "}
          {t("por importação")}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">
        {t(
          "Dicas: clique e arraste para selecionar várias células · Ctrl+C / Ctrl+X / Ctrl+V copiam, recortam e colam (um valor copiado preenche todas as células selecionadas) · Delete limpa · Ctrl+Z desfaz e Ctrl+Y refaz · arraste o quadradinho do canto da seleção para preencher · botão direito: inserir, duplicar ou excluir linhas.",
        )}
      </p>

      {/* A REVISÃO de tudo, antes de gravar. */}
      <section
        aria-label={t("Revisão")}
        aria-live="polite"
        data-testid="revisao-da-importacao"
        className="rounded-2xl border bg-card p-4"
      >
        <h2 className="text-sm font-semibold">{t("Revisão antes de importar")}</h2>
        {totalPreenchidas === 0 ? (
          <p className="mt-1 text-sm text-muted-foreground">
            {t("Cole ou digite os leads na tabela: aqui aparece, em resumo, o que vai acontecer.")}
          </p>
        ) : semColunasObrigatorias ? (
          <p className="mt-1 text-sm text-warning-fg" data-testid="faltam-colunas">
            {t("Para importar, deixe na tabela a coluna")} <b>{textoDoQueFalta}</b>
            {". "}
            {t("Abra o botão Colunas e ligue-a.")}
          </p>
        ) : esperando ? (
          <p className="mt-1 text-sm text-muted-foreground">{t("Conferindo as linhas…")}</p>
        ) : (
          <div className="mt-2 grid gap-2 text-sm">
            <p>
              <b>{resumo.prontas}</b> {resumo.prontas === 1 ? t("lead pronto") : t("leads prontos")}
              {resumo.comAviso > 0 ? (
                <>
                  {" "}
                  ·{" "}
                  <span className="text-warning-fg">
                    {resumo.comAviso} {t("com aviso")}
                  </span>
                </>
              ) : null}
              {resumo.comErro > 0 ? (
                <>
                  {" "}
                  ·{" "}
                  <b className="text-error-fg">
                    {resumo.comErro} {t("com erro")}
                  </b>
                </>
              ) : null}
            </p>
            {resumo.prontas > 0 ? (
              <ul className="grid gap-1 text-muted-foreground">
                <li>
                  {resumo.contatosNovos} {t("contatos novos serão criados")} ·{" "}
                  {resumo.contatosAtualizados}{" "}
                  {t("já existem e serão atualizados (nada é apagado)")}
                </li>
                {resumo.destinos.map((d) => (
                  <li key={d.destino ?? "sem"}>
                    <b className="text-foreground">{d.quantidade}</b> → {nomeDoDestino(d.destino)}
                  </li>
                ))}
                {resumo.lpsNovas.length > 0 ? (
                  <li>
                    {t("Landing pages que ainda não existem e serão cadastradas:")}{" "}
                    <b className="text-foreground">{resumo.lpsNovas.join(", ")}</b>
                    {resumo.campanhasNovas.length > 0
                      ? ` (${t("em campanhas novas:")} ${resumo.campanhasNovas.join(", ")})`
                      : ""}
                  </li>
                ) : null}
              </ul>
            ) : null}
            {resumo.comErro > 0 ? (
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-muted-foreground">
                  {t(
                    "Corrija ou apague as linhas com erro para liberar o botão. Ou tudo entra, ou nada entra.",
                  )}
                </p>
                <Button type="button" size="sm" variant="outline" onClick={removerLinhasComErro}>
                  {t("Remover as linhas com erro")}
                </Button>
              </div>
            ) : null}
          </div>
        )}
        {erroDaTabela && totalPreenchidas > 0 && !semColunasObrigatorias ? (
          <p role="alert" className="mt-2 text-sm text-error-fg">
            {erroDaTabela}
          </p>
        ) : null}
        {erro ? (
          <p role="alert" className="mt-2 text-sm text-error-fg">
            {erro}
          </p>
        ) : null}
        <div className="mt-3 flex flex-wrap justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => router.push("/app/clientes")}
            disabled={enviando}
          >
            {t("Cancelar")}
          </Button>
          <Button type="button" size="lg" disabled={!podeImportar} onClick={() => void importar()}>
            {enviando
              ? t("Importando…")
              : `${t("Importar")} ${resumo.prontas} ${resumo.prontas === 1 ? t("lead") : t("leads")}`}
          </Button>
        </div>
      </section>

      {resultado ? (
        <div className="rounded-2xl border p-4 text-sm" role="status">
          <p className="font-medium">
            {resultado.contatos_criados} {t("novos")} · {resultado.contatos_atualizados}{" "}
            {t("atualizados")} · {resultado.cards_criados} {t("no funil")} · {resultado.sem_funil}{" "}
            {t("só guardados")}
            {resultado.lps_criadas > 0
              ? ` · ${resultado.lps_criadas} ${t("LPs cadastradas")}`
              : ""}{" "}
            · {resultado.erros.length} {t("avisos")}
          </p>
          <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
            {resultado.erros.map((e, i) => (
              <li key={`${e.linha}-${i}`}>
                {t("Linha")} {e.linha - 1}: {e.motivo}
              </li>
            ))}
          </ul>
          <Button type="button" className="mt-3" onClick={() => router.push("/app/clientes")}>
            {t("Ir para o CRM")}
          </Button>
        </div>
      ) : null}

      <Dialog open={colando} onOpenChange={setColando}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("Colar do Excel")}</DialogTitle>
            <DialogDescription>
              {t(
                "Copie as células no Excel ou no Google Sheets (com ou sem a linha de títulos) e cole aqui. Com títulos, as colunas entram sozinhas.",
              )}
            </DialogDescription>
          </DialogHeader>
          <Textarea
            rows={9}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            aria-label={t("Texto colado")}
          />
          <div className="flex justify-end">
            <Button
              type="button"
              disabled={!texto.trim()}
              onClick={() => {
                entrarMatriz(lerTextoDeTabela(texto));
                setTexto("");
                setColando(false);
              }}
            >
              {t("Adicionar à grade")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
