"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useRef, useState } from "react";

import { SeletorDeData } from "@/components/marketing/cronograma/SeletorDeData";
import { LinhaDoTempoDeCampanhas } from "@/components/marketing/campanhas/LinhaDoTempoDeCampanhas";
import {
  COR_DO_CANAL,
  COR_DO_STATUS,
  rotuloDoCanal,
  rotuloDoStatus,
  textoDoEstado,
} from "@/components/marketing/campanhas/rotulos";
import { AbasDeVisualizacao } from "@/components/motor/AbasDeVisualizacao";
import { BarraDeConsulta, type CampoDaBarra } from "@/components/motor/BarraDeConsulta";
import { AcaoEmMassa, BarraDeSelecao } from "@/components/motor/BarraDeSelecao";
import { CelulaDeCaixa } from "@/components/motor/CelulaDeCaixa";
import { CelulaDeTexto } from "@/components/motor/CelulaDeTexto";
import { ConfigurarVisualizacao } from "@/components/motor/ConfigurarVisualizacao";
import { Etiqueta } from "@/components/motor/Etiqueta";
import { SeletorDeOpcao } from "@/components/motor/SeletorDeOpcao";
import { TabelaDoMotor, type ColunaDoMotor } from "@/components/motor/TabelaDoMotor";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useT } from "@/hooks/i18n/useT";
import { useCampanhasDeDemanda } from "@/hooks/marketing/useCampanhasDeDemanda";
import { useVisoesSalvas } from "@/hooks/motor/useVisoesSalvas";
import { useVisualizacao } from "@/hooks/motor/useVisualizacao";
import { lerNumero } from "@/lib/marketing/calculadora";
import {
  CANAIS_DA_CAMPANHA,
  STATUS_DA_CAMPANHA,
  type CampanhaDeDemanda,
} from "@/lib/marketing/campanhas";
import { FUSO_DO_CRONOGRAMA } from "@/lib/marketing/cronograma";
import { moedaDoNumero } from "@/lib/marketing/produtos-csv";
import {
  aplicarConsulta,
  type CampoConsultavel,
  type ConsultaDaTabela,
} from "@/lib/motor/consulta";
import { moverColuna, resolverColunas, type PreferenciasDaTabela } from "@/lib/motor/layout";
import { alternarId, faixaEntre, podarSelecao } from "@/lib/motor/selecao";
import type { CorDaOpcao } from "@/lib/tarefas/opcoes-de-status";
import { ArrowRight, CalendarBlank, Check, Megaphone, Plus, TextAa, Trash } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";

const ID_DA_PADRAO = "padrao";
const TIPOS_DAS_CAMPANHAS = ["tabela", "galeria", "timeline"] as const;
const BASE = "/app/marketing/geracao-de-demanda/campanhas";
type Vista = "tabela" | "cards" | "timeline";

const CAMPO =
  "h-10 w-full rounded-xl border bg-background px-3 text-sm outline-hidden focus:border-primary/60 focus:ring-2 focus:ring-primary/20";

/**
 * As CAMPANHAS de demanda: uma tabela com o motor das Tarefas (propriedades que se mostram,
 * escondem e reordenam; filtros, ordem e agrupamento; abas salvas; seleção e edição em massa),
 * em três visões — Tabela, Cards e Linha do tempo.
 */
export function CampanhasDeDemanda() {
  const t = useT();
  const router = useRouter();
  const caminho = usePathname();
  const parametros = useSearchParams();
  const { campanhas, funis, podeEditar, carregando, falhou, criar, editar, apagar } =
    useCampanhasDeDemanda();
  const [busca, setBusca] = useState("");
  const [configurando, setConfigurando] = useState(false);
  const [nova, setNova] = useState(false);
  const [selecionadas, setSelecionadas] = useState<Set<string>>(() => new Set());
  const ultimoMarcado = useRef<string | null>(null);

  const padrao = useVisualizacao("campanhas");
  const { visoes, salvarConfig, criarVisao, editarVisao, apagarVisao } = useVisoesSalvas(
    "campanhas",
    podeEditar,
  );
  const visaoAtiva = visoes.find((v) => v.id === parametros.get("v"));
  const ativaId = visaoAtiva?.id ?? ID_DA_PADRAO;
  // O jeito de ver (Tabela, Cards ou Linha do tempo) é da aba salva, como no Notion; a aba
  // "Todas" é sempre a tabela.
  const vista: Vista =
    visaoAtiva?.type === "galeria"
      ? "cards"
      : visaoAtiva?.type === "timeline"
        ? "timeline"
        : "tabela";
  const preferencias: PreferenciasDaTabela = visaoAtiva ? visaoAtiva.config : padrao.preferencias;
  const atualizar = (mudar: (atual: PreferenciasDaTabela) => PreferenciasDaTabela) => {
    if (visaoAtiva) salvarConfig(visaoAtiva.id, mudar(visaoAtiva.config));
    else padrao.atualizar(mudar);
  };
  const escolherAba = (id: string) =>
    router.replace(id === ID_DA_PADRAO ? caminho : `${caminho}?v=${id}`, { scroll: false });

  const nomeDoFunil = (id: string | null) => funis.find((f) => f.id === id)?.name ?? "";
  const opcoesDeCanal = CANAIS_DA_CAMPANHA.map((c) => ({
    id: c,
    rotulo: rotuloDoCanal(t, c),
    cor: COR_DO_CANAL[c] as CorDaOpcao,
  }));
  const opcoesDeStatus = STATUS_DA_CAMPANHA.map((s) => ({
    id: s,
    rotulo: rotuloDoStatus(t, s),
    cor: COR_DO_STATUS[s] as CorDaOpcao,
  }));
  const opcoesDeFunil = funis.map((f) => ({ id: f.id, rotulo: f.name, cor: "gray" as CorDaOpcao }));

  const numeroEditavel = (
    c: CampanhaDeDemanda,
    campo: "budget" | "goal_leads" | "goal_cpl" | "goal_sales" | "goal_revenue",
    exibir: string,
    rotulo: string,
    inteiro = false,
  ) => (
    <CelulaDeTexto
      valor={c[campo] === null ? "" : String(c[campo]).replace(".", ",")}
      exibir={exibir}
      rotulo={rotulo}
      vazioRotulo="—"
      permitirVazio
      inputMode="decimal"
      podeEditar={podeEditar}
      aoSalvar={(texto) => {
        if (texto.trim() === "") return void editar([c.id], { [campo]: null });
        const n = lerNumero(texto);
        if (n === null || n < 0) return;
        void editar([c.id], { [campo]: inteiro ? Math.round(n) : n });
      }}
    />
  );
  const dinheiro = (n: number | null) => (n === null ? "—" : moedaDoNumero(n));

  const celulaDeData = (c: CampanhaDeDemanda, campo: "start_date" | "end_date", rotulo: string) =>
    podeEditar ? (
      <div className="px-1">
        <SeletorDeData
          valor={c[campo] ?? ""}
          rotulo={rotulo}
          placeholder="—"
          aoMudar={(d) => void editar([c.id], { [campo]: d || null })}
          className="h-8 border-transparent bg-transparent text-xs"
        />
      </div>
    ) : (
      <span className="block px-2 text-sm">{c[campo] ?? "—"}</span>
    );

  const colunas: ColunaDoMotor<CampanhaDeDemanda>[] = [
    {
      id: "nome",
      titulo: t("Campanha"),
      icone: <TextAa size={14} aria-hidden />,
      largura: 320,
      semOcultar: true,
      celula: (c) => (
        <div className="flex min-w-0 items-center gap-1">
          <div className="min-w-0 flex-1">
            <CelulaDeTexto
              valor={c.name}
              rotulo={t("Nome da campanha")}
              podeEditar={podeEditar}
              aoSalvar={(name) => void editar([c.id], { name })}
            />
          </div>
          <Link
            href={`${BASE}/${c.id}`}
            className="inline-flex h-7 shrink-0 items-center rounded-md border bg-card px-2 text-[11px] font-medium tracking-wide text-muted-foreground uppercase hover:bg-secondary hover:text-foreground"
          >
            {t("Abrir")}
          </Link>
        </div>
      ),
    },
    {
      id: "canal",
      titulo: t("Canal"),
      icone: <Megaphone size={14} aria-hidden />,
      largura: 170,
      celula: (c) => (
        <SeletorDeOpcao
          opcoes={opcoesDeCanal}
          valorId={c.channel}
          podeEditar={podeEditar}
          rotulo={t("Canal")}
          aoEscolher={(id) => void editar([c.id], { channel: id as CampanhaDeDemanda["channel"] })}
        >
          <Etiqueta cor={COR_DO_CANAL[c.channel]}>{rotuloDoCanal(t, c.channel)}</Etiqueta>
        </SeletorDeOpcao>
      ),
    },
    {
      id: "status",
      titulo: t("Status"),
      icone: <Check size={14} aria-hidden />,
      largura: 150,
      celula: (c) => (
        <SeletorDeOpcao
          opcoes={opcoesDeStatus}
          valorId={c.status}
          podeEditar={podeEditar}
          rotulo={t("Status")}
          aoEscolher={(id) => void editar([c.id], { status: id as CampanhaDeDemanda["status"] })}
        >
          <Etiqueta ponto cor={COR_DO_STATUS[c.status]}>
            {rotuloDoStatus(t, c.status)}
          </Etiqueta>
        </SeletorDeOpcao>
      ),
    },
    {
      id: "funil",
      titulo: t("Funil do lead"),
      icone: <Megaphone size={14} aria-hidden />,
      largura: 190,
      celula: (c) => (
        <SeletorDeOpcao
          opcoes={opcoesDeFunil}
          valorId={c.pipeline_id ?? undefined}
          podeEditar={podeEditar}
          rotulo={t("Funil do lead")}
          aoEscolher={(id) => void editar([c.id], { pipeline_id: id })}
          aoLimpar={() => void editar([c.id], { pipeline_id: null })}
        >
          {c.pipeline_id ? (
            <Etiqueta cor="gray">{nomeDoFunil(c.pipeline_id) || "—"}</Etiqueta>
          ) : (
            <span className="px-2 text-sm text-muted-foreground">—</span>
          )}
        </SeletorDeOpcao>
      ),
    },
    {
      id: "inicio",
      titulo: t("Início"),
      icone: <CalendarBlank size={14} aria-hidden />,
      largura: 170,
      celula: (c) => celulaDeData(c, "start_date", t("Início")),
    },
    {
      id: "fim",
      titulo: t("Fim"),
      icone: <CalendarBlank size={14} aria-hidden />,
      largura: 170,
      celula: (c) =>
        c.continuous ? (
          <span className="px-2 text-sm text-muted-foreground">{t("Contínua")}</span>
        ) : (
          celulaDeData(c, "end_date", t("Fim"))
        ),
    },
    {
      id: "continua",
      titulo: t("Contínua"),
      icone: <Check size={14} aria-hidden />,
      largura: 110,
      padrao: false,
      celula: (c) => (
        <CelulaDeCaixa
          marcada={c.continuous}
          podeEditar={podeEditar}
          rotulo={t("Contínua")}
          aoMudar={(continuous) => void editar([c.id], { continuous })}
        />
      ),
    },
    {
      id: "investimento",
      titulo: t("Investimento"),
      icone: <TextAa size={14} aria-hidden />,
      largura: 170,
      celula: (c) => numeroEditavel(c, "budget", dinheiro(c.budget), t("Investimento")),
    },
    {
      id: "meta-leads",
      titulo: t("Meta de leads"),
      icone: <TextAa size={14} aria-hidden />,
      largura: 140,
      celula: (c) =>
        numeroEditavel(
          c,
          "goal_leads",
          c.goal_leads === null ? "—" : String(c.goal_leads),
          t("Meta de leads"),
          true,
        ),
    },
    {
      id: "estado-atual",
      titulo: t("Estado atual"),
      icone: <TextAa size={14} aria-hidden />,
      largura: 330,
      celula: (c) => (
        <span
          className="block truncate px-2 text-sm tabular-nums"
          title={textoDoEstado(t, c.estado)}
        >
          {textoDoEstado(t, c.estado)}
        </span>
      ),
    },
    {
      id: "meta-cpl",
      titulo: t("Meta de CPL"),
      icone: <TextAa size={14} aria-hidden />,
      largura: 140,
      padrao: false,
      celula: (c) => numeroEditavel(c, "goal_cpl", dinheiro(c.goal_cpl), t("Meta de CPL")),
    },
    {
      id: "meta-vendas",
      titulo: t("Meta de vendas"),
      icone: <TextAa size={14} aria-hidden />,
      largura: 140,
      padrao: false,
      celula: (c) =>
        numeroEditavel(
          c,
          "goal_sales",
          c.goal_sales === null ? "—" : String(c.goal_sales),
          t("Meta de vendas"),
          true,
        ),
    },
    {
      id: "meta-faturamento",
      titulo: t("Meta de faturamento"),
      icone: <TextAa size={14} aria-hidden />,
      largura: 170,
      padrao: false,
      celula: (c) =>
        numeroEditavel(c, "goal_revenue", dinheiro(c.goal_revenue), t("Meta de faturamento")),
    },
    {
      id: "plataforma",
      titulo: t("Campanhas da plataforma"),
      icone: <Megaphone size={14} aria-hidden />,
      largura: 260,
      padrao: false,
      celula: (c) => (
        <span className="block truncate px-2 text-sm text-muted-foreground">
          {c.platform_campaigns.map((p) => p.name).join(", ") || "—"}
        </span>
      ),
    },
    ...(podeEditar
      ? ([
          {
            id: "analise",
            titulo: t("Última análise"),
            icone: <TextAa size={14} aria-hidden />,
            largura: 320,
            celula: (c: CampanhaDeDemanda) => (
              <span className="block truncate px-2 text-sm text-muted-foreground">
                {c.ultima_analise
                  ? `${c.ultima_analise.data.slice(5).split("-").reverse().join("/")} | ${c.ultima_analise.texto}`
                  : "—"}
              </span>
            ),
          },
          {
            id: "planejamento",
            titulo: t("Último planejamento"),
            icone: <TextAa size={14} aria-hidden />,
            largura: 320,
            celula: (c: CampanhaDeDemanda) => (
              <span className="block truncate px-2 text-sm text-muted-foreground">
                {c.ultimo_planejamento
                  ? `${c.ultimo_planejamento.data.slice(5).split("-").reverse().join("/")} | ${c.ultimo_planejamento.texto}`
                  : "—"}
              </span>
            ),
          },
        ] satisfies ColunaDoMotor<CampanhaDeDemanda>[])
      : []),
  ];

  const campos: Array<
    CampoConsultavel<CampanhaDeDemanda> & {
      titulo: string;
      opcoes?: { id: string; rotulo: string; cor?: CorDaOpcao }[];
    }
  > = [
    { id: "nome", titulo: t("Campanha"), tipo: "texto", valorDe: (c) => c.name },
    {
      id: "canal",
      titulo: t("Canal"),
      tipo: "opcao",
      valorDe: (c) => c.channel,
      opcoes: opcoesDeCanal,
      ordemDoValor: (v) => CANAIS_DA_CAMPANHA.indexOf(v as (typeof CANAIS_DA_CAMPANHA)[number]),
      rotuloDoValor: (v) => rotuloDoCanal(t, v as CampanhaDeDemanda["channel"]),
    },
    {
      id: "status",
      titulo: t("Status"),
      tipo: "opcao",
      valorDe: (c) => c.status,
      opcoes: opcoesDeStatus,
      ordemDoValor: (v) => STATUS_DA_CAMPANHA.indexOf(v as (typeof STATUS_DA_CAMPANHA)[number]),
      rotuloDoValor: (v) => rotuloDoStatus(t, v as CampanhaDeDemanda["status"]),
    },
    {
      id: "funil",
      titulo: t("Funil do lead"),
      tipo: "opcao",
      valorDe: (c) => c.pipeline_id,
      opcoes: opcoesDeFunil,
      rotuloDoValor: (v) => nomeDoFunil(v) || v,
    },
    { id: "inicio", titulo: t("Início"), tipo: "data", valorDe: (c) => c.start_date },
    { id: "fim", titulo: t("Fim"), tipo: "data", valorDe: (c) => c.end_date },
    { id: "continua", titulo: t("Contínua"), tipo: "caixa", valorDe: (c) => c.continuous },
    { id: "investimento", titulo: t("Investimento"), tipo: "numero", valorDe: (c) => c.budget },
    { id: "meta-leads", titulo: t("Meta de leads"), tipo: "numero", valorDe: (c) => c.goal_leads },
    { id: "meta-cpl", titulo: t("Meta de CPL"), tipo: "numero", valorDe: (c) => c.goal_cpl },
    {
      id: "meta-vendas",
      titulo: t("Meta de vendas"),
      tipo: "numero",
      valorDe: (c) => c.goal_sales,
    },
    {
      id: "meta-faturamento",
      titulo: t("Meta de faturamento"),
      tipo: "numero",
      valorDe: (c) => c.goal_revenue,
    },
  ];
  const camposDaBarra: CampoDaBarra[] = campos.map((c) => ({
    id: c.id,
    titulo: c.titulo,
    tipo: c.tipo,
    opcoes: c.opcoes,
  }));

  const resolvidas = resolverColunas(colunas, preferencias);
  const mostradas = resolvidas.filter((c) => c.visivel);

  const termo = busca.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  const buscadas = useMemo(
    () =>
      termo
        ? campanhas.filter((c) =>
            `${c.name} ${c.description} ${c.platform_campaigns.map((p) => p.name).join(" ")}`
              .normalize("NFD")
              .replace(/[̀-ͯ]/g, "")
              .toLowerCase()
              .includes(termo),
          )
        : campanhas,
    [campanhas, termo],
  );
  const resultado = useMemo(
    () =>
      aplicarConsulta(buscadas, campos, preferencias, {
        hoje: new Date().toISOString().slice(0, 10),
      }),
    // `campos` é recriado a cada render; as entradas reais são estas.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [buscadas, preferencias, funis],
  );
  const grupos = resultado.grupos?.map((g) => {
    const campo = campos.find((c) => c.id === preferencias.agrupar);
    const rotulo =
      g.chave === ""
        ? t("Sem valor")
        : (campo?.opcoes?.find((o) => o.id === g.chave)?.rotulo ?? g.rotulo);
    return { chave: g.chave || "__vazio", titulo: <strong>{rotulo}</strong>, linhas: g.linhas };
  });

  const idsDaTabela = [...new Set(resultado.linhas.map((c) => c.id))];
  const vivas = podarSelecao(selecionadas, idsDaTabela);
  const idsSelecionados = idsDaTabela.filter((id) => vivas.has(id));
  const selecionar = (id: string, { faixa }: { faixa: boolean }) => {
    setSelecionadas((atual) => {
      const base = podarSelecao(atual, idsDaTabela);
      if (faixa && ultimoMarcado.current) {
        const proximo = new Set(base);
        for (const m of faixaEntre(idsDaTabela, ultimoMarcado.current, id)) proximo.add(m);
        return proximo;
      }
      return alternarId(base, id);
    });
    ultimoMarcado.current = id;
  };

  function mudarConsulta(c: ConsultaDaTabela) {
    atualizar((p) => ({
      ...p,
      filtros: c.filtros?.length ? c.filtros : undefined,
      ordenacao: c.ordenacao?.length ? c.ordenacao : undefined,
      agrupar: c.agrupar,
      agruparPor: c.agrupar && c.agruparPor !== "dia" ? c.agruparPor : undefined,
    }));
  }

  const abas = [
    { id: ID_DA_PADRAO, nome: padrao.preferencias.nome ?? t("Todas"), tipo: "tabela" as const },
    ...visoes.map((v) => ({ id: v.id, nome: v.name, tipo: v.type })),
  ];

  if (carregando) {
    return <div className="h-48 animate-pulse rounded-2xl bg-secondary" aria-busy="true" />;
  }
  if (falhou) {
    return (
      <p className="rounded-xl border border-error/30 bg-error-bg px-4 py-3 text-sm text-error-fg">
        {t("Não foi possível carregar as campanhas.")}
      </p>
    );
  }

  const cartoes = (lista: CampanhaDeDemanda[]) => (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {lista.map((c) => (
        <li key={c.id}>
          <Link
            href={`${BASE}/${c.id}`}
            className="group flex h-full flex-col gap-2 rounded-2xl border-[1.5px] border-primary bg-card p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:bg-primary/5 hover:shadow-md"
          >
            <div className="flex flex-wrap items-center gap-1.5">
              <Etiqueta cor={COR_DO_CANAL[c.channel]}>{rotuloDoCanal(t, c.channel)}</Etiqueta>
              <Etiqueta ponto cor={COR_DO_STATUS[c.status]}>
                {rotuloDoStatus(t, c.status)}
              </Etiqueta>
            </div>
            <h3 className="font-semibold">{c.name}</h3>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <dt>{t("Período")}</dt>
              <dd className="text-foreground">
                {c.continuous
                  ? t("Contínua")
                  : [c.start_date, c.end_date].filter(Boolean).join(" → ") || "—"}
              </dd>
              <dt>{t("Investimento")}</dt>
              <dd className="text-foreground">{dinheiro(c.budget)}</dd>
              <dt>{t("Meta de leads")}</dt>
              <dd className="text-foreground">{c.goal_leads ?? "—"}</dd>
              <dt className="col-span-2 mt-1">{t("Estado atual")}</dt>
              <dd className="col-span-2 text-foreground tabular-nums">
                {textoDoEstado(t, c.estado)}
              </dd>
              {c.pipeline_id ? (
                <>
                  <dt>{t("Funil do lead")}</dt>
                  <dd className="truncate text-foreground">{nomeDoFunil(c.pipeline_id)}</dd>
                </>
              ) : null}
            </dl>
            <span className="mt-auto inline-flex items-center gap-1.5 pt-2 text-sm font-semibold text-primary">
              {t("Abrir")}
              <ArrowRight
                size={14}
                weight="bold"
                className="transition-transform group-hover:translate-x-1"
                aria-hidden
              />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );

  const vazio = campanhas.length === 0;

  return (
    <section aria-label={t("Campanhas")} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold tracking-tight">{t("Campanhas")}</h2>
        {podeEditar ? (
          <button
            type="button"
            onClick={() => setNova(true)}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-primary px-3 text-sm font-medium whitespace-nowrap text-primary-foreground"
          >
            <Plus size={14} weight="bold" aria-hidden />
            {t("Nova campanha")}
          </button>
        ) : null}
      </div>

      {vazio ? (
        <p className="rounded-2xl border border-dashed p-5 text-sm text-muted-foreground">
          {t("Nenhuma campanha ainda. Crie a primeira em “Nova campanha”.")}
        </p>
      ) : (
        <>
          <AbasDeVisualizacao
            abas={abas}
            ativaId={ativaId}
            podeEditar={podeEditar}
            tipos={TIPOS_DAS_CAMPANHAS}
            aoEscolher={escolherAba}
            aoCriar={(nome, tipo) =>
              void criarVisao({ name: nome, type: tipo, config: preferencias }).then(
                (v) => v && escolherAba(v.id),
              )
            }
            aoConfigurar={() => setConfigurando(true)}
          />
          <div className="flex flex-wrap items-center gap-2">
            <label className="relative min-w-0 flex-1 basis-60">
              <span className="sr-only">{t("Buscar")}</span>
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder={t("Buscar campanha")}
                className="h-10 w-full rounded-xl border bg-background px-3 text-sm outline-hidden focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
              />
            </label>
            <BarraDeConsulta
              compacta
              campos={camposDaBarra}
              consulta={{
                filtros: preferencias.filtros,
                ordenacao: preferencias.ordenacao,
                agrupar: preferencias.agrupar,
                agruparPor: preferencias.agruparPor,
              }}
              aoMudar={mudarConsulta}
            />
          </div>

          {vista === "tabela" ? (
            <TabelaDoMotor
              linhas={resultado.linhas}
              idDe={(c) => c.id}
              colunas={mostradas}
              grupos={grupos}
              aoMoverColuna={(movido, alvo) =>
                atualizar((p) => ({
                  ...p,
                  ordem: moverColuna(
                    resolvidas.filter((c) => !c.fixa).map((c) => c.id),
                    movido,
                    alvo,
                  ),
                }))
              }
              aoRedimensionarColuna={(id, largura) =>
                atualizar((p) => ({ ...p, larguras: { ...p.larguras, [id]: largura } }))
              }
              aoReordenar={() => undefined}
              podeReordenar={false}
              selecionadas={vivas}
              aoSelecionar={podeEditar ? selecionar : undefined}
              aoSelecionarTodas={
                podeEditar
                  ? (marcar) => {
                      setSelecionadas(marcar ? new Set(idsDaTabela) : new Set());
                      ultimoMarcado.current = null;
                    }
                  : undefined
              }
              rotuloDaTabela={t("Campanhas")}
              vazio={
                <p className="p-6 text-center text-sm text-muted-foreground">
                  {t("Nenhuma campanha combina com a busca e os filtros.")}
                </p>
              }
            />
          ) : resultado.linhas.length === 0 ? (
            <p className="rounded-2xl border border-dashed p-5 text-sm text-muted-foreground">
              {t("Nenhuma campanha combina com a busca e os filtros.")}
            </p>
          ) : vista === "timeline" ? (
            <LinhaDoTempoDeCampanhas
              campanhas={resultado.linhas}
              base={BASE}
              fuso={FUSO_DO_CRONOGRAMA}
              dias={preferencias.linhaDoTempo?.dias}
              escala={preferencias.linhaDoTempo?.escala}
              aoMudar={
                podeEditar || !visaoAtiva
                  ? (linhaDoTempo) => atualizar((p) => ({ ...p, linhaDoTempo }))
                  : undefined
              }
            />
          ) : grupos ? (
            <div className="flex flex-col gap-6">
              {grupos.map((g) => (
                <section key={g.chave} className="flex flex-col gap-2">
                  <h3 className="text-sm">{g.titulo}</h3>
                  {cartoes([...g.linhas])}
                </section>
              ))}
            </div>
          ) : (
            cartoes(resultado.linhas)
          )}
        </>
      )}

      {podeEditar ? (
        <BarraDeSelecao
          quantidade={idsSelecionados.length}
          aoLimpar={() => setSelecionadas(new Set())}
        >
          <AcaoEmMassa rotulo={t("Status")} icone={<Check size={14} aria-hidden />}>
            {(fechar) => (
              <div>
                {opcoesDeStatus.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => {
                      void editar(idsSelecionados, { status: o.id });
                      fechar();
                    }}
                    className="flex w-full rounded-md px-2 py-1.5 hover:bg-secondary"
                  >
                    <Etiqueta ponto cor={o.cor}>
                      {o.rotulo}
                    </Etiqueta>
                  </button>
                ))}
              </div>
            )}
          </AcaoEmMassa>
          <AcaoEmMassa rotulo={t("Canal")} icone={<Megaphone size={14} aria-hidden />}>
            {(fechar) => (
              <div>
                {opcoesDeCanal.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => {
                      void editar(idsSelecionados, { channel: o.id });
                      fechar();
                    }}
                    className="flex w-full rounded-md px-2 py-1.5 hover:bg-secondary"
                  >
                    <Etiqueta cor={o.cor}>{o.rotulo}</Etiqueta>
                  </button>
                ))}
              </div>
            )}
          </AcaoEmMassa>
          {funis.length > 0 ? (
            <AcaoEmMassa rotulo={t("Funil do lead")} icone={<Megaphone size={14} aria-hidden />}>
              {(fechar) => (
                <div>
                  {opcoesDeFunil.map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => {
                        void editar(idsSelecionados, { pipeline_id: o.id });
                        fechar();
                      }}
                      className="flex w-full rounded-md px-2 py-1.5 text-sm hover:bg-secondary"
                    >
                      {o.rotulo}
                    </button>
                  ))}
                </div>
              )}
            </AcaoEmMassa>
          ) : null}
          <AcaoEmMassa
            rotulo={t("Apagar")}
            icone={<Trash size={14} aria-hidden />}
            destrutivo
            aoClicar={async () => {
              if (
                !window.confirm(t("Apagar as campanhas selecionadas? Isso não pode ser desfeito."))
              ) {
                return;
              }
              await apagar(idsSelecionados);
              setSelecionadas(new Set());
            }}
          />
        </BarraDeSelecao>
      ) : null}

      <ConfigurarVisualizacao
        aberto={configurando}
        aoFechar={() => setConfigurando(false)}
        nome={visaoAtiva?.name ?? padrao.preferencias.nome ?? t("Todas")}
        tipo={visaoAtiva?.type ?? "tabela"}
        tipos={TIPOS_DAS_CAMPANHAS}
        podeEditar={podeEditar}
        ehPadrao={!visaoAtiva}
        aoRenomear={(nome) =>
          visaoAtiva
            ? void editarVisao(visaoAtiva.id, { name: nome })
            : padrao.atualizar((p) => ({ ...p, nome }))
        }
        aoTrocarTipo={(tipo) => visaoAtiva && void editarVisao(visaoAtiva.id, { type: tipo })}
        propriedades={resolvidas.map((c) => ({
          id: c.id,
          titulo: c.titulo,
          icone: c.icone,
          visivel: c.visivel,
          obrigatoria: c.fixa || c.semOcultar,
        }))}
        aoMover={(movido, alvo) =>
          atualizar((p) => ({
            ...p,
            ordem: moverColuna(
              resolvidas.filter((c) => !c.fixa).map((c) => c.id),
              movido,
              alvo,
            ),
          }))
        }
        aoAlternar={(id) => {
          const atual = resolvidas.find((c) => c.id === id);
          if (!atual || atual.fixa || atual.semOcultar) return;
          atualizar((p) => ({ ...p, visiveis: { ...p.visiveis, [id]: !atual.visivel } }));
        }}
        aoMostrarTodas={(mostrar) =>
          atualizar((p) => ({
            ...p,
            visiveis: Object.fromEntries(
              resolvidas.filter((c) => !c.fixa && !c.semOcultar).map((c) => [c.id, mostrar]),
            ),
          }))
        }
        aoApagar={
          visaoAtiva
            ? () => {
                void apagarVisao(visaoAtiva.id);
                setConfigurando(false);
                escolherAba(ID_DA_PADRAO);
              }
            : undefined
        }
      />

      <NovaCampanha
        aberto={nova}
        aoFechar={() => setNova(false)}
        aoCriar={async (entrada) => {
          const c = await criar(entrada);
          if (c) {
            setNova(false);
            router.push(`${BASE}/${c.id}`);
          }
        }}
      />
    </section>
  );
}

function NovaCampanha({
  aberto,
  aoFechar,
  aoCriar,
}: {
  aberto: boolean;
  aoFechar: () => void;
  aoCriar: (e: { name: string; channel: CampanhaDeDemanda["channel"] }) => Promise<void>;
}) {
  const t = useT();
  const [nome, setNome] = useState("");
  const [canal, setCanal] = useState<CampanhaDeDemanda["channel"]>("trafego_pago");
  const [criando, setCriando] = useState(false);
  return (
    <Dialog open={aberto} onOpenChange={(a) => !a && aoFechar()}>
      <DialogContent className="max-w-md gap-4 p-5 sm:rounded-2xl">
        <DialogTitle className="text-base font-semibold">{t("Nova campanha")}</DialogTitle>
        <DialogDescription className="text-sm text-muted-foreground">
          {t("Comece pelo nome e pelo canal. O resto você completa na página da campanha.")}
        </DialogDescription>
        <input
          value={nome}
          maxLength={160}
          autoFocus
          placeholder={t("Ex.: [1º sessão] Campanha R$79,90")}
          aria-label={t("Nome da campanha")}
          onChange={(e) => setNome(e.target.value)}
          className={CAMPO}
        />
        <select
          value={canal}
          aria-label={t("Canal")}
          onChange={(e) => setCanal(e.target.value as CampanhaDeDemanda["channel"])}
          className={CAMPO}
        >
          {CANAIS_DA_CAMPANHA.map((c) => (
            <option key={c} value={c}>
              {rotuloDoCanal(t, c)}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={nome.trim() === "" || criando}
          onClick={async () => {
            setCriando(true);
            await aoCriar({ name: nome.trim(), channel: canal });
            setCriando(false);
            setNome("");
          }}
          className="h-10 rounded-xl bg-primary text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {t("Criar campanha")}
        </button>
      </DialogContent>
    </Dialog>
  );
}
