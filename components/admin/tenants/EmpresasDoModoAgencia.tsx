"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";

import { BarraDeConsulta, type CampoDaBarra } from "@/components/motor/BarraDeConsulta";
import { SeletorDePeriodo } from "@/components/motor/CalendarioDePeriodo";
import { useAtalhosDePeriodo } from "@/components/motor/atalhos-de-periodo";
import { Etiqueta } from "@/components/motor/Etiqueta";
import { TabelaDoMotor, type ColunaDoMotor } from "@/components/motor/TabelaDoMotor";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { useTagDeIdioma } from "@/hooks/i18n/useLocaleDeData";
import { useT } from "@/hooks/i18n/useT";
import { useVisualizacao } from "@/hooks/motor/useVisualizacao";
import { useResumoDasEmpresas, type EmpresaDoResumo } from "@/hooks/useResumoDasEmpresas";
import {
  camposConsultaveis,
  iniciais,
  MENSALIDADES,
  PROPRIEDADES_DA_EMPRESA,
  SITUACOES,
  valorDaPropriedade,
  type IdDaPropriedade,
  type PropriedadeDaEmpresa,
} from "@/lib/admin/empresas";
import { corDoCliente } from "@/lib/agencia/cor-do-cliente";
import { formatCentsBRL } from "@/lib/money";
import { aplicarConsulta, normalizarConsulta, type ConsultaDaTabela } from "@/lib/motor/consulta";
import {
  alternarVisibilidade,
  moverColuna,
  resolverColunas,
  type PreferenciasDaTabela,
} from "@/lib/motor/layout";
import { Buildings, Check, Plus, Rows, SlidersHorizontal, SquaresFour } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";

type Visao = "tabela" | "cartoes";

/** Chaves das preferências: cada visão tem as SUAS (colunas e filtros), uma não mexe na outra. */
const CHAVE: Record<Visao, string> = {
  tabela: "admin-empresas-tabela",
  cartoes: "admin-empresas-cards",
};

const BOTAO_ABRIR =
  "inline-flex h-7 shrink-0 items-center rounded-md border bg-card px-2 text-[11px] font-medium tracking-wide text-muted-foreground uppercase hover:bg-secondary hover:text-foreground";

export function EmpresasDoModoAgencia({
  selecionados = [],
  aoNovaEmpresa,
}: {
  /** Os ids marcados no seletor de empresas do Modo agência; vazio = todas. */
  selecionados?: readonly string[];
  aoNovaEmpresa?: () => void;
}) {
  const t = useT();
  const tag = useTagDeIdioma();
  const { atalhos, hoje, max } = useAtalhosDePeriodo();
  const mes = atalhos.find((a) => a.id === "mes");
  const [periodo, setPeriodo] = useState({ de: mes?.de ?? hoje, ate: mes?.ate ?? hoje });
  // A visão escolhida (tabela ou cartões) fica na conta, como as demais preferências.
  const visaoSalva = useVisualizacao("admin-empresas-visao");
  const visao: Visao = visaoSalva.preferencias.visualizacao === "galeria" ? "cartoes" : "tabela";
  const prefs = useVisualizacao(CHAVE[visao]);
  const preferencias = prefs.preferencias;

  const { data, isLoading } = useResumoDasEmpresas(periodo.de, periodo.ate, selecionados);
  const campos = useMemo(() => camposConsultaveis(t), [t]);
  const camposDaBarra: CampoDaBarra[] = useMemo(
    () =>
      campos.map((c) => {
        const p = PROPRIEDADES_DA_EMPRESA.find((x) => x.id === c.id);
        return {
          id: c.id,
          titulo: c.titulo,
          tipo: c.tipo,
          ...(p?.opcoes
            ? { opcoes: p.opcoes.map((o) => ({ id: o.id, rotulo: t(o.rotulo), cor: o.cor })) }
            : {}),
        };
      }),
    [campos, t],
  );

  const consulta: ConsultaDaTabela = {
    filtros: preferencias.filtros,
    ordenacao: preferencias.ordenacao,
    agrupar: preferencias.agrupar,
    agruparPor: preferencias.agruparPor,
    ordemDosGrupos: preferencias.ordemDosGrupos,
  };
  const mudarConsulta = (nova: ConsultaDaTabela) =>
    prefs.atualizar((p) => {
      const {
        filtros: _f,
        ordenacao: _o,
        agrupar: _a,
        agruparPor: _ap,
        ordemDosGrupos: _og,
        ...resto
      } = p;
      return { ...resto, ...normalizarConsulta(nova) };
    });

  const resultado = useMemo(
    () => aplicarConsulta(data?.linhas ?? [], campos, consulta, { hoje }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      data,
      campos,
      preferencias.filtros,
      preferencias.ordenacao,
      preferencias.agrupar,
      preferencias.agruparPor,
      preferencias.ordemDosGrupos,
      hoje,
    ],
  );

  // Propriedades desta visão: o que a pessoa escolheu ou o padrão (tabela e cartões têm padrões próprios).
  const definicoes = PROPRIEDADES_DA_EMPRESA.map((p) => ({
    ...p,
    padrao: visao === "tabela" ? p.padraoNaTabela : p.padraoNoCartao,
  }));
  const resolvidas = resolverColunas(definicoes, preferencias);

  const dinheiro = (cents: number) => formatCentsBRL(cents);
  const dia = (iso: string | null) =>
    iso
      ? new Intl.DateTimeFormat(tag, { dateStyle: "short", timeZone: "UTC" }).format(new Date(iso))
      : "—";

  function mostrar(e: EmpresaDoResumo, id: IdDaPropriedade): ReactNode {
    switch (id) {
      case "slug":
        return <code className="font-mono text-xs">{e.slug}</code>;
      case "situacao": {
        const s = SITUACOES.find((x) => x.id === e.situacao);
        return <Etiqueta cor={s?.cor ?? "gray"}>{t(s?.rotulo ?? e.situacao)}</Etiqueta>;
      }
      case "investimento":
        return dinheiro(e.investimento_cents);
      case "faturamento":
        return dinheiro(e.faturamento_cents);
      case "entrada":
        return dia(e.entrada);
      case "proximo_pagamento":
        return dia(e.proximo_pagamento);
      case "mensalidade": {
        const m = MENSALIDADES.find((x) => x.id === e.mensalidade);
        return m ? <Etiqueta cor={m.cor}>{t(m.rotulo)}</Etiqueta> : "—";
      }
      default:
        return String(valorDaPropriedade(e, id) ?? "—");
    }
  }

  const colunas: ColunaDoMotor<EmpresaDoResumo>[] = [
    {
      id: "nome",
      titulo: t("Nome"),
      largura: 300,
      fixa: true,
      semOcultar: true,
      celula: (e) => (
        <div className="flex min-w-0 items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-sm font-medium">{e.nome}</span>
          <Link href={`/admin/tenants/${e.id}`} className={BOTAO_ABRIR}>
            {t("Abrir")}
          </Link>
        </div>
      ),
    },
    ...resolvidas
      .filter((c) => c.visivel)
      .map<ColunaDoMotor<EmpresaDoResumo>>((c) => ({
        id: c.id,
        titulo: t(c.titulo),
        largura: c.largura,
        celula: (e) => mostrar(e, c.id),
      })),
  ];

  function ordenarPor(colunaId: string) {
    const atual = preferencias.ordenacao?.[0];
    const proxima =
      atual?.campo !== colunaId
        ? [{ campo: colunaId, direcao: "asc" as const }]
        : atual.direcao === "asc"
          ? [{ campo: colunaId, direcao: "desc" as const }]
          : [];
    mudarConsulta({ ...consulta, ordenacao: proxima });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{t("Empresas")}</h1>
          <p className="mt-1 text-sm text-text-muted">
            {isLoading
              ? t("Carregando...")
              : `${resultado.linhas.length} ${resultado.linhas.length === 1 ? t("empresa") : t("empresas")}`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SeletorDePeriodo
            de={periodo.de}
            ate={periodo.ate}
            aoMudar={setPeriodo}
            rotulo={t("Período dos números")}
            atalhos={atalhos}
            max={max}
          />
          {aoNovaEmpresa ? (
            <Button size="sm" onClick={aoNovaEmpresa}>
              <Plus size={16} aria-hidden />
              {t("Nova empresa")}
            </Button>
          ) : (
            <Button asChild size="sm">
              <Link href="/admin/tenants/new">
                <Plus size={16} aria-hidden />
                {t("Nova empresa")}
              </Link>
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div
          role="group"
          aria-label={t("Visualização")}
          className="inline-flex rounded-lg border bg-card p-0.5"
        >
          {(
            [
              ["cartoes", t("Cartões"), SquaresFour],
              ["tabela", t("Tabela"), Rows],
            ] as const
          ).map(([id, rotulo, Icone]) => (
            <button
              key={id}
              type="button"
              aria-pressed={visao === id}
              onClick={() =>
                visaoSalva.atualizar((p) => ({
                  ...p,
                  visualizacao: id === "cartoes" ? "galeria" : "tabela",
                }))
              }
              className={cn(
                "inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium",
                visao === id
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icone size={14} aria-hidden />
              {rotulo}
            </button>
          ))}
        </div>
        <BarraDeConsulta
          compacta
          campos={camposDaBarra}
          consulta={consulta}
          aoMudar={mudarConsulta}
        />
        <SeletorDePropriedades
          resolvidas={resolvidas}
          aoAlternar={(id) => prefs.atualizar((p) => alternarVisibilidade(p, resolvidas, id))}
        />
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full rounded-2xl" />
      ) : resultado.linhas.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card py-16 text-center text-text-muted">
          <Buildings size={36} weight="duotone" className="opacity-40" aria-hidden />
          <p className="text-sm font-medium">{t("Nenhuma empresa encontrada")}</p>
          <p className="max-w-xs text-xs opacity-70">
            {t("Ajuste os filtros ou crie uma nova empresa.")}
          </p>
        </div>
      ) : visao === "tabela" ? (
        <TabelaDoMotor
          linhas={resultado.linhas}
          idDe={(e) => e.id}
          colunas={colunas}
          aoMoverColuna={(movido, alvo) =>
            prefs.atualizar((p) => ({
              ...p,
              ordem: moverColuna(
                resolvidas.map((c) => c.id),
                movido,
                alvo,
              ),
            }))
          }
          aoRedimensionarColuna={(id, largura) =>
            prefs.atualizar((p) => ({ ...p, larguras: { ...p.larguras, [id]: largura } }))
          }
          aoOrdenarPor={ordenarPor}
          ordenacao={preferencias.ordenacao}
          colunasOrdenaveis={new Set(campos.map((c) => c.id))}
          aoReordenar={() => undefined}
          podeReordenar={false}
          rotuloDaTabela={t("Empresas")}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {resultado.linhas.map((e) => (
            <CartaoDaEmpresa
              key={e.id}
              e={e}
              propriedades={resolvidas.filter((c) => c.visivel)}
              mostrar={mostrar}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CartaoDaEmpresa({
  e,
  propriedades,
  mostrar,
}: {
  e: EmpresaDoResumo;
  propriedades: readonly PropriedadeDaEmpresa[];
  mostrar: (e: EmpresaDoResumo, id: IdDaPropriedade) => ReactNode;
}) {
  const t = useT();
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className="flex size-10 shrink-0 items-center justify-center rounded-xl text-sm font-semibold text-white"
          style={{ backgroundColor: corDoCliente(e.cor, e.id) }}
        >
          {iniciais(e.nome)}
        </span>
        <div className="min-w-0 flex-1 truncate text-sm font-semibold">{e.nome}</div>
        <Link href={`/admin/tenants/${e.id}`} className={BOTAO_ABRIR}>
          {t("Abrir")}
        </Link>
      </div>
      {propriedades.length > 0 ? (
        <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
          {propriedades.map((p) => (
            <div key={p.id} className="min-w-0">
              <dt className="text-text-muted">{t(p.titulo)}</dt>
              <dd className="truncate font-medium">{mostrar(e, p.id)}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  );
}

/** "Propriedades": escolhe o que aparece. Vale só para a visão aberta (tabela OU cartões). */
function SeletorDePropriedades({
  resolvidas,
  aoAlternar,
}: {
  resolvidas: ReadonlyArray<PropriedadeDaEmpresa & { visivel: boolean }>;
  aoAlternar: (id: IdDaPropriedade) => void;
}) {
  const t = useT();
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5">
          <SlidersHorizontal size={14} aria-hidden />
          {t("Propriedades")}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-2">
        <p className="px-2 pb-1 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
          {t("Mostrar nesta visualização")}
        </p>
        <ul>
          {resolvidas.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                role="checkbox"
                aria-checked={p.visivel}
                onClick={() => aoAlternar(p.id)}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-secondary"
              >
                <span
                  className={cn(
                    "grid size-4 place-items-center rounded border",
                    p.visivel
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border-strong",
                  )}
                >
                  {p.visivel ? <Check size={11} weight="bold" aria-hidden /> : null}
                </span>
                {t(p.titulo)}
              </button>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

export type { PreferenciasDaTabela };
