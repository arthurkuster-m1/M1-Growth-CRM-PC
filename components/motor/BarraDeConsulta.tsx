"use client";

import { CampoDeData } from "@/components/motor/CalendarioDePeriodo";
import { useState, type ReactNode } from "react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SeletorEmPopup, type OpcaoDoPopup } from "@/components/ui/SeletorEmPopup";
import { useT } from "@/hooks/i18n/useT";
import {
  DATAS_RELATIVAS,
  OPERADORES_DO_TIPO,
  PERIODOS_RELATIVOS,
  TIPOS_AGRUPAVEIS,
  semFiltro,
  semValor,
  type ConsultaDaTabela,
  type Filtro,
  type Operador,
  type TipoDeCampo,
} from "@/lib/motor/consulta";
import type { CorDaOpcao } from "@/lib/tarefas/opcoes-de-status";
import { ArrowsDownUp, Funnel, Plus, Rows, Trash } from "@/lib/ui/icons";
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
  /** Botões menores, para caber os três numa linha só (ex.: Campanhas). */
  compacta?: boolean;
  /**
   * Filtro SALVO vira o padrão da visualização (como no Notion): quando passado, não há "Limpar
   * tudo" — o que se muda é um rascunho, e aparecem "Reset" (volta ao salvo) e, para quem pode
   * editar a visualização, "Salvar" (o rascunho passa a ser o padrão).
   */
  salvamento?: {
    alterada: boolean;
    aoResetar: () => void;
    /** Ausente = quem vê não pode salvar na visualização. */
    aoSalvar?: () => void;
  };
}

const SELECT =
  "h-8 min-w-0 rounded-lg border bg-card px-2 text-sm outline-hidden focus-visible:ring-2 focus-visible:ring-primary/40";

/** O seletor em popup no tamanho da barra (no lugar do `<select>` do navegador). */
function Escolha({
  valor,
  opcoes,
  aoEscolher,
  rotulo,
  largura,
  rotuloVazio,
}: {
  valor: string;
  opcoes: readonly OpcaoDoPopup[];
  aoEscolher: (id: string) => void;
  rotulo: string;
  largura: string;
  rotuloVazio?: string;
}) {
  return (
    <SeletorEmPopup
      rotulo={rotulo}
      valor={valor}
      opcoes={opcoes}
      aoEscolher={aoEscolher}
      rotuloVazio={rotuloVazio}
      className={cn("h-8 min-h-8 min-w-0 gap-1 rounded-xl px-2 py-0 text-sm", largura)}
    />
  );
}

function Gatilho({
  icone,
  rotulo,
  quantidade,
  compacta,
}: {
  icone: ReactNode;
  rotulo: string;
  quantidade: number;
  compacta?: boolean;
}) {
  return (
    <PopoverTrigger asChild>
      <button
        type="button"
        className={cn(
          "inline-flex shrink-0 items-center rounded-xl border bg-card whitespace-nowrap transition-colors hover:text-foreground",
          compacta ? "h-8 gap-1.5 px-2.5 text-xs" : "h-9 gap-2 px-3 text-sm",
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
      title={rotulo}
      onClick={aoClicar}
      className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-text-subtle transition-colors hover:bg-secondary hover:text-error-fg"
    >
      <Trash size={14} aria-hidden />
    </button>
  );
}

/** O botão que FECHA o painel: os filtros já valem na hora, e este deixa claro onde se termina. */
function BotaoAplicar({ rotulo, aoClicar }: { rotulo: string; aoClicar: () => void }) {
  return (
    <button
      type="button"
      onClick={aoClicar}
      className="mt-3 h-10 w-full rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
    >
      {rotulo}
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
export function BarraDeConsulta({ campos, consulta, aoMudar, compacta, salvamento }: Props) {
  const t = useT();
  const [abertoFiltro, setAbertoFiltro] = useState(false);
  const [abertoOrdem, setAbertoOrdem] = useState(false);
  const [abertoGrupo, setAbertoGrupo] = useState(false);
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
    ate: t("até (inclusive)"),
    depois: t("depois de"),
    a_partir: t("a partir de (inclusive)"),
    periodo: t("está em"),
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

  const rotuloDaData: Record<string, string> = {
    hoje: t("Hoje"),
    ontem: t("Ontem"),
    amanha: t("Amanhã"),
    inicio_da_semana: t("Início desta semana"),
    fim_da_semana: t("Fim desta semana"),
    inicio_do_mes: t("Início deste mês"),
    fim_do_mes: t("Fim deste mês"),
    esta_semana: t("Esta semana"),
    semana_passada: t("Semana passada"),
    proxima_semana: t("Próxima semana"),
    este_mes: t("Este mês"),
    mes_passado: t("Mês passado"),
    proximo_mes: t("Próximo mês"),
    ultimos_7_dias: t("Últimos 7 dias"),
    proximos_5_dias: t("Próximos 5 dias"),
    proximos_7_dias: t("Próximos 7 dias"),
    ultimos_30_dias: t("Últimos 30 dias"),
    proximos_30_dias: t("Próximos 30 dias"),
  };

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
      const ehPeriodo = f.operador === "periodo";
      const relativos: readonly string[] = ehPeriodo ? PERIODOS_RELATIVOS : DATAS_RELATIVAS;
      const atual = typeof f.valor === "string" ? f.valor : "";
      const relativo = relativos.includes(atual);
      return (
        <span className="flex flex-wrap items-center gap-1">
          <Escolha
            valor={relativo ? atual : atual ? "__exata" : ""}
            rotulo={t("Valor do filtro")}
            largura="w-44"
            rotuloVazio={t("Escolher…")}
            aoEscolher={(id) => {
              if (id === "__exata") alterar(new Date().toISOString().slice(0, 10));
              else alterar(id || undefined);
            }}
            opcoes={[
              ...(ehPeriodo ? [] : [{ id: "__exata", rotulo: t("Data exata…") }]),
              ...relativos.map((r) => ({ id: r, rotulo: rotuloDaData[r] ?? r })),
            ]}
          />
          {!ehPeriodo && atual !== "" && !relativo ? (
            <CampoDeData
              valor={atual}
              rotulo={t("Valor do filtro")}
              aoMudar={(dia) => alterar(dia || undefined)}
              className="h-8 px-2 text-sm"
            />
          ) : null}
        </span>
      );
    }
    // Opção, pessoa e seleção múltipla: escolhe-se entre as existentes.
    const atual = Array.isArray(f.valor) ? (f.valor[0] ?? "") : "";
    return (
      <Escolha
        valor={atual}
        rotulo={t("Valor do filtro")}
        largura="w-40"
        rotuloVazio={t("Escolher…")}
        aoEscolher={(id) => alterar(id ? [id] : undefined)}
        opcoes={campo.opcoes ?? []}
      />
    );
  }

  return (
    // `contents`: os botões entram direto na fila de quem usa a barra, que decide rolar ou quebrar.
    <div className="contents">
      <Popover open={abertoFiltro} onOpenChange={setAbertoFiltro}>
        <Gatilho
          compacta={compacta}
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
                      <Escolha
                        valor={f.juncao ?? "e"}
                        rotulo={t("Ligação com o filtro anterior")}
                        largura="w-16 shrink-0"
                        aoEscolher={(v) =>
                          mudarFiltro(i, { ...f, juncao: v === "ou" ? "ou" : "e" })
                        }
                        opcoes={[
                          { id: "e", rotulo: t("e") },
                          { id: "ou", rotulo: t("ou") },
                        ]}
                      />
                    )}
                    <Escolha
                      valor={f.campo}
                      rotulo={t("Campo do filtro")}
                      largura="w-40"
                      aoEscolher={(v) => trocarCampoDoFiltro(i, v)}
                      opcoes={campos.map((c) => ({ id: c.id, rotulo: c.titulo }))}
                    />
                    <Escolha
                      valor={f.operador}
                      rotulo={t("Condição do filtro")}
                      largura="w-36"
                      aoEscolher={(v) =>
                        mudarFiltro(i, {
                          campo: f.campo,
                          operador: v as Operador,
                          ...(f.juncao ? { juncao: f.juncao } : {}),
                          // Trocar "antes de" por "até" mantém a data; de/para "está em", não.
                          ...(campo.tipo === "data" &&
                          v !== "periodo" &&
                          f.operador !== "periodo" &&
                          !semValor(v as Operador) &&
                          f.valor !== undefined
                            ? { valor: f.valor }
                            : {}),
                        })
                      }
                      opcoes={OPERADORES_DO_TIPO[campo.tipo].map((op) => ({
                        id: op,
                        rotulo: rotuloDoOperador[op],
                      }))}
                    />
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
          <BotaoAplicar rotulo={t("Aplicar")} aoClicar={() => setAbertoFiltro(false)} />
        </PopoverContent>
      </Popover>

      <Popover open={abertoOrdem} onOpenChange={setAbertoOrdem}>
        <Gatilho
          compacta={compacta}
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
                  <Escolha
                    valor={o.campo}
                    rotulo={t("Campo da ordenação")}
                    largura="w-44"
                    aoEscolher={(v) =>
                      aoMudar({
                        ...consulta,
                        ordenacao: ordenacao.map((x, k) => (k === i ? { ...x, campo: v } : x)),
                      })
                    }
                    opcoes={campos.map((c) => ({ id: c.id, rotulo: c.titulo }))}
                  />
                  <Escolha
                    valor={o.direcao}
                    rotulo={t("Direção")}
                    largura="w-36"
                    aoEscolher={(v) =>
                      aoMudar({
                        ...consulta,
                        ordenacao: ordenacao.map((x, k) =>
                          k === i ? { ...x, direcao: v as "asc" | "desc" } : x,
                        ),
                      })
                    }
                    opcoes={[
                      { id: "asc", rotulo: t("Crescente") },
                      { id: "desc", rotulo: t("Decrescente") },
                    ]}
                  />
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
          <BotaoAplicar rotulo={t("Aplicar")} aoClicar={() => setAbertoOrdem(false)} />
        </PopoverContent>
      </Popover>

      <Popover open={abertoGrupo} onOpenChange={setAbertoGrupo}>
        <Gatilho
          compacta={compacta}
          icone={<Rows size={16} aria-hidden />}
          rotulo={t("Agrupar")}
          quantidade={consulta.agrupar ? 1 : 0}
        />
        <PopoverContent align="start" className="w-64 p-3">
          <p className="mb-2 text-xs font-semibold tracking-wider text-text-subtle uppercase">
            {t("Agrupar por")}
          </p>
          <Escolha
            valor={consulta.agrupar ?? ""}
            rotulo={t("Agrupar por")}
            largura="w-full"
            rotuloVazio={t("Sem agrupamento")}
            aoEscolher={(v) => aoMudar({ ...consulta, agrupar: v === "" ? undefined : v })}
            opcoes={agrupaveis.map((c) => ({ id: c.id, rotulo: c.titulo }))}
          />
          {consulta.agrupar && campoDe(consulta.agrupar)?.tipo === "data" ? (
            <>
              <p className="mt-3 mb-2 text-xs font-semibold tracking-wider text-text-subtle uppercase">
                {t("Agrupar datas por")}
              </p>
              <Escolha
                valor={consulta.agruparPor ?? "dia"}
                rotulo={t("Agrupar datas por")}
                largura="w-full"
                aoEscolher={(v) =>
                  aoMudar({
                    ...consulta,
                    agruparPor: v === "semana" || v === "mes" ? v : undefined,
                  })
                }
                opcoes={[
                  { id: "dia", rotulo: t("Dia") },
                  { id: "semana", rotulo: t("Semana") },
                  { id: "mes", rotulo: t("Mês") },
                ]}
              />
            </>
          ) : null}
          {consulta.agrupar ? (
            <>
              <p className="mt-3 mb-2 text-xs font-semibold tracking-wider text-text-subtle uppercase">
                {t("Ordem dos grupos")}
              </p>
              <Escolha
                valor={consulta.ordemDosGrupos ?? "asc"}
                rotulo={t("Ordem dos grupos")}
                largura="w-full"
                aoEscolher={(v) =>
                  aoMudar({ ...consulta, ordemDosGrupos: v === "desc" ? "desc" : undefined })
                }
                opcoes={[
                  { id: "asc", rotulo: t("Do primeiro ao último") },
                  { id: "desc", rotulo: t("Do último ao primeiro") },
                ]}
              />
            </>
          ) : null}
          <BotaoAplicar rotulo={t("Aplicar")} aoClicar={() => setAbertoGrupo(false)} />
        </PopoverContent>
      </Popover>

      {salvamento ? (
        salvamento.alterada ? (
          <>
            <button
              type="button"
              onClick={salvamento.aoResetar}
              title={t("Volta ao filtro salvo desta visualização")}
              className={cn(
                "shrink-0 rounded-xl border px-3 whitespace-nowrap text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground",
                compacta ? "h-8 text-xs" : "h-9 text-sm",
              )}
            >
              {t("Reset")}
            </button>
            {salvamento.aoSalvar ? (
              <button
                type="button"
                onClick={salvamento.aoSalvar}
                title={t("O que está na tela vira o padrão desta visualização")}
                className={cn(
                  "shrink-0 rounded-xl bg-primary px-3 font-medium whitespace-nowrap text-primary-foreground transition-colors hover:bg-[var(--color-accent-hover)]",
                  compacta ? "h-8 text-xs" : "h-9 text-sm",
                )}
              >
                {t("Salvar")}
              </button>
            ) : null}
          </>
        ) : null
      ) : filtros.length + ordenacao.length > 0 || consulta.agrupar ? (
        <button
          type="button"
          onClick={() => aoMudar({})}
          className={cn(
            "shrink-0 rounded-xl px-2 whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground",
            compacta ? "h-8 text-xs" : "h-9 text-sm",
          )}
        >
          {t("Limpar tudo")}
        </button>
      ) : null}
    </div>
  );
}
