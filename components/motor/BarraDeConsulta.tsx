"use client";

import type { ReactNode } from "react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useT } from "@/hooks/i18n/useT";
import {
  OPERADORES_DO_TIPO,
  TIPOS_AGRUPAVEIS,
  semFiltro,
  semValor,
  type ConsultaDaTabela,
  type Filtro,
  type Operador,
  type TipoDeCampo,
} from "@/lib/motor/consulta";
import type { CorDaOpcao } from "@/lib/tarefas/opcoes-de-status";
import { ArrowsDownUp, Funnel, Plus, Rows, X } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";

/** O que a barra precisa saber de cada campo para montar os menus. */
export interface CampoDaBarra {
  id: string;
  titulo: string;
  tipo: TipoDeCampo;
  /** Para campos de opção, pessoa e seleção: as escolhas possíveis. */
  opcoes?: readonly { id: string; rotulo: string; cor?: CorDaOpcao }[];
}

interface Props {
  campos: readonly CampoDaBarra[];
  consulta: ConsultaDaTabela;
  aoMudar: (consulta: ConsultaDaTabela) => void;
}

const SELECT =
  "h-8 min-w-0 rounded-lg border bg-background px-2 text-sm outline-hidden focus-visible:ring-2 focus-visible:ring-primary/40";

function Gatilho({
  icone,
  rotulo,
  quantidade,
}: {
  icone: ReactNode;
  rotulo: string;
  quantidade: number;
}) {
  return (
    <PopoverTrigger asChild>
      <button
        type="button"
        className={cn(
          "inline-flex h-9 shrink-0 items-center gap-2 rounded-xl border bg-card px-3 text-sm whitespace-nowrap transition-colors hover:text-foreground",
          quantidade > 0 ? "border-primary/40 text-primary" : "text-muted-foreground",
        )}
      >
        {icone}
        {rotulo}
        {quantidade > 0 ? (
          <span className="grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[11px] font-semibold text-primary-foreground">
            {quantidade}
          </span>
        ) : null}
      </button>
    </PopoverTrigger>
  );
}

function BotaoRemover({ rotulo, aoClicar }: { rotulo: string; aoClicar: () => void }) {
  return (
    <button
      type="button"
      aria-label={rotulo}
      onClick={aoClicar}
      className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-text-subtle transition-colors hover:bg-secondary hover:text-foreground"
    >
      <X size={14} aria-hidden />
    </button>
  );
}

function BotaoAdicionar({ rotulo, aoClicar }: { rotulo: string; aoClicar: () => void }) {
  return (
    <button
      type="button"
      onClick={aoClicar}
      className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
    >
      <Plus size={14} aria-hidden />
      {rotulo}
    </button>
  );
}

/** "Filtrar", "Ordenar" e "Agrupar": os três painéis que decidem o que a tabela mostra e em que ordem. */
export function BarraDeConsulta({ campos, consulta, aoMudar }: Props) {
  const t = useT();
  const filtros = consulta.filtros ?? [];
  const ordenacao = consulta.ordenacao ?? [];
  const agrupaveis = campos.filter((c) => TIPOS_AGRUPAVEIS.includes(c.tipo));
  const campoDe = (id: string) => campos.find((c) => c.id === id);

  const rotuloDoOperador: Record<Operador, string> = {
    contem: t("contém"),
    nao_contem: t("não contém"),
    e: t("é"),
    nao_e: t("não é"),
    vazio: t("está vazio"),
    preenchido: t("está preenchido"),
    antes: t("antes de"),
    depois: t("depois de"),
    igual: t("igual a"),
    maior: t("maior que"),
    menor: t("menor que"),
    marcado: t("marcado"),
    desmarcado: t("desmarcado"),
  };

  function mudarFiltro(i: number, novo: Filtro) {
    aoMudar({ ...consulta, filtros: filtros.map((f, k) => (k === i ? novo : f)) });
  }

  function novoFiltro() {
    const campo = campos[0];
    if (!campo) return;
    aoMudar({
      ...consulta,
      filtros: [...filtros, { campo: campo.id, operador: OPERADORES_DO_TIPO[campo.tipo][0]! }],
    });
  }

  function trocarCampoDoFiltro(i: number, id: string) {
    const campo = campoDe(id);
    if (!campo) return;
    mudarFiltro(i, {
      campo: id,
      operador: OPERADORES_DO_TIPO[campo.tipo][0]!,
      ...(filtros[i]?.juncao ? { juncao: filtros[i]!.juncao } : {}),
    });
  }

  function campoDeValor(i: number, f: Filtro, campo: CampoDaBarra) {
    if (semValor(f.operador)) return null;
    const alterar = (valor: Filtro["valor"]) => mudarFiltro(i, { ...f, valor });

    if (campo.tipo === "texto") {
      return (
        <input
          type="text"
          value={typeof f.valor === "string" ? f.valor : ""}
          aria-label={t("Valor do filtro")}
          onChange={(e) => alterar(e.target.value)}
          className={cn(SELECT, "w-32")}
        />
      );
    }
    if (campo.tipo === "numero") {
      return (
        <input
          type="number"
          value={typeof f.valor === "number" ? f.valor : ""}
          aria-label={t("Valor do filtro")}
          onChange={(e) => alterar(e.target.value === "" ? undefined : Number(e.target.value))}
          className={cn(SELECT, "w-28")}
        />
      );
    }
    if (campo.tipo === "data") {
      return (
        <span className="flex items-center gap-1">
          <input
            type="date"
            value={typeof f.valor === "string" && f.valor !== "hoje" ? f.valor : ""}
            aria-label={t("Valor do filtro")}
            onChange={(e) => alterar(e.target.value || undefined)}
            className={cn(SELECT, "w-36")}
          />
          <button
            type="button"
            aria-pressed={f.valor === "hoje"}
            onClick={() => alterar(f.valor === "hoje" ? undefined : "hoje")}
            className={cn(
              "h-8 rounded-lg border px-2 text-sm transition-colors",
              f.valor === "hoje"
                ? "border-primary bg-accent-soft text-primary"
                : "text-muted-foreground hover:bg-secondary",
            )}
          >
            {t("Hoje")}
          </button>
        </span>
      );
    }
    // Opção, pessoa e seleção múltipla: escolhe-se entre as existentes.
    const atual = Array.isArray(f.valor) ? (f.valor[0] ?? "") : "";
    return (
      <select
        value={atual}
        aria-label={t("Valor do filtro")}
        onChange={(e) => alterar(e.target.value ? [e.target.value] : undefined)}
        className={cn(SELECT, "w-36")}
      >
        <option value="">{t("Escolher…")}</option>
        {(campo.opcoes ?? []).map((o) => (
          <option key={o.id} value={o.id}>
            {o.rotulo}
          </option>
        ))}
      </select>
    );
  }

  return (
    // `contents`: os botões entram direto na fila de quem usa a barra, que decide rolar ou quebrar.
    <div className="contents">
      <Popover>
        <Gatilho
          icone={<Funnel size={16} aria-hidden />}
          rotulo={t("Filtrar")}
          quantidade={filtros.length}
        />
        <PopoverContent align="start" className="w-auto max-w-[min(92vw,640px)] p-3">
          {filtros.length === 0 ? (
            <p className="px-2 pb-2 text-sm text-muted-foreground">
              {t("Nenhum filtro. Mostrando tudo.")}
            </p>
          ) : (
            <ul className="space-y-2">
              {filtros.map((f, i) => {
                const campo = campoDe(f.campo);
                if (!campo) return null;
                return (
                  <li key={i} className="flex flex-wrap items-center gap-1.5">
                    {i === 0 ? (
                      <span className="w-14 shrink-0 px-1 text-sm text-muted-foreground">
                        {t("Onde")}
                      </span>
                    ) : (
                      <select
                        value={f.juncao ?? "e"}
                        aria-label={t("Ligação com o filtro anterior")}
                        onChange={(e) =>
                          mudarFiltro(i, {
                            ...f,
                            juncao: e.target.value === "ou" ? "ou" : "e",
                          })
                        }
                        className={cn(SELECT, "w-14 shrink-0")}
                      >
                        <option value="e">{t("e")}</option>
                        <option value="ou">{t("ou")}</option>
                      </select>
                    )}
                    <select
                      value={f.campo}
                      aria-label={t("Campo do filtro")}
                      onChange={(e) => trocarCampoDoFiltro(i, e.target.value)}
                      className={cn(SELECT, "w-36")}
                    >
                      {campos.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.titulo}
                        </option>
                      ))}
                    </select>
                    <select
                      value={f.operador}
                      aria-label={t("Condição do filtro")}
                      onChange={(e) =>
                        mudarFiltro(i, {
                          campo: f.campo,
                          operador: e.target.value as Operador,
                          ...(f.juncao ? { juncao: f.juncao } : {}),
                        })
                      }
                      className={cn(SELECT, "w-32")}
                    >
                      {OPERADORES_DO_TIPO[campo.tipo].map((op) => (
                        <option key={op} value={op}>
                          {rotuloDoOperador[op]}
                        </option>
                      ))}
                    </select>
                    {campoDeValor(i, f, campo)}
                    <BotaoRemover
                      rotulo={t("Remover filtro")}
                      aoClicar={() => aoMudar({ ...consulta, filtros: semFiltro(filtros, i) })}
                    />
                  </li>
                );
              })}
            </ul>
          )}
          <BotaoAdicionar rotulo={t("Adicionar filtro")} aoClicar={novoFiltro} />
        </PopoverContent>
      </Popover>

      <Popover>
        <Gatilho
          icone={<ArrowsDownUp size={16} aria-hidden />}
          rotulo={t("Ordenar")}
          quantidade={ordenacao.length}
        />
        <PopoverContent align="start" className="w-auto max-w-[min(92vw,480px)] p-3">
          {ordenacao.length === 0 ? (
            <p className="px-2 pb-2 text-sm text-muted-foreground">
              {t("Na ordem que você arrastou.")}
            </p>
          ) : (
            <ul className="space-y-2">
              {ordenacao.map((o, i) => (
                <li key={i} className="flex items-center gap-1.5">
                  <select
                    value={o.campo}
                    aria-label={t("Campo da ordenação")}
                    onChange={(e) =>
                      aoMudar({
                        ...consulta,
                        ordenacao: ordenacao.map((x, k) =>
                          k === i ? { ...x, campo: e.target.value } : x,
                        ),
                      })
                    }
                    className={cn(SELECT, "w-40")}
                  >
                    {campos.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.titulo}
                      </option>
                    ))}
                  </select>
                  <select
                    value={o.direcao}
                    aria-label={t("Direção")}
                    onChange={(e) =>
                      aoMudar({
                        ...consulta,
                        ordenacao: ordenacao.map((x, k) =>
                          k === i ? { ...x, direcao: e.target.value as "asc" | "desc" } : x,
                        ),
                      })
                    }
                    className={cn(SELECT, "w-32")}
                  >
                    <option value="asc">{t("Crescente")}</option>
                    <option value="desc">{t("Decrescente")}</option>
                  </select>
                  <BotaoRemover
                    rotulo={t("Remover ordenação")}
                    aoClicar={() =>
                      aoMudar({ ...consulta, ordenacao: ordenacao.filter((_, k) => k !== i) })
                    }
                  />
                </li>
              ))}
            </ul>
          )}
          <BotaoAdicionar
            rotulo={t("Adicionar ordenação")}
            aoClicar={() => {
              const usados = new Set(ordenacao.map((o) => o.campo));
              const campo = campos.find((c) => !usados.has(c.id)) ?? campos[0];
              if (!campo) return;
              aoMudar({
                ...consulta,
                ordenacao: [...ordenacao, { campo: campo.id, direcao: "asc" }],
              });
            }}
          />
        </PopoverContent>
      </Popover>

      <Popover>
        <Gatilho
          icone={<Rows size={16} aria-hidden />}
          rotulo={t("Agrupar")}
          quantidade={consulta.agrupar ? 1 : 0}
        />
        <PopoverContent align="start" className="w-64 p-3">
          <p className="mb-2 text-xs font-semibold tracking-wider text-text-subtle uppercase">
            {t("Agrupar por")}
          </p>
          <select
            value={consulta.agrupar ?? ""}
            aria-label={t("Agrupar por")}
            onChange={(e) =>
              aoMudar({ ...consulta, agrupar: e.target.value === "" ? undefined : e.target.value })
            }
            className={cn(SELECT, "w-full")}
          >
            <option value="">{t("Sem agrupamento")}</option>
            {agrupaveis.map((c) => (
              <option key={c.id} value={c.id}>
                {c.titulo}
              </option>
            ))}
          </select>
          {consulta.agrupar && campoDe(consulta.agrupar)?.tipo === "data" ? (
            <>
              <p className="mt-3 mb-2 text-xs font-semibold tracking-wider text-text-subtle uppercase">
                {t("Agrupar datas por")}
              </p>
              <select
                value={consulta.agruparPor ?? "dia"}
                aria-label={t("Agrupar datas por")}
                onChange={(e) =>
                  aoMudar({
                    ...consulta,
                    agruparPor:
                      e.target.value === "semana" || e.target.value === "mes"
                        ? e.target.value
                        : undefined,
                  })
                }
                className={cn(SELECT, "w-full")}
              >
                <option value="dia">{t("Dia")}</option>
                <option value="semana">{t("Semana")}</option>
                <option value="mes">{t("Mês")}</option>
              </select>
            </>
          ) : null}
        </PopoverContent>
      </Popover>

      {filtros.length + ordenacao.length > 0 || consulta.agrupar ? (
        <button
          type="button"
          onClick={() => aoMudar({})}
          className="h-9 shrink-0 rounded-xl px-2 text-sm whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground"
        >
          {t("Limpar tudo")}
        </button>
      ) : null}
    </div>
  );
}
