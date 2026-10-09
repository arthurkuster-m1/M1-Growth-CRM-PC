"use client";

import { useState } from "react";

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { useT } from "@/hooks/i18n/useT";
import { useCelular } from "@/hooks/motor/useCelular";
import { rotuloDaData } from "@/lib/motor/datas-do-campo";
import type { OpcaoDeStatus } from "@/lib/tarefas/opcoes-de-status";
import {
  FREQUENCIAS_DE_REPETICAO,
  type DadosDoModelo,
  type EntradaDeModelo,
  type FrequenciaDeRepeticao,
  type ModeloDeTarefa,
} from "@/lib/tarefas/modelos";
import { PRIORIDADES_DA_TAREFA, type PrioridadeDaTarefa } from "@/lib/tarefas/tipos";
import { ArrowsClockwise, CaretLeft, Plus, Trash } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";

interface Props {
  aberto: boolean;
  aoFechar: () => void;
  modelos: ModeloDeTarefa[];
  opcoesDeStatus: readonly OpcaoDeStatus[];
  membros: readonly { id: string; nome: string }[];
  fuso: string;
  tag: string;
  agora: Date;
  podeEditar: boolean;
  /** Abre direto o formulário de um modelo novo (vindo do menu "+ ▾"). */
  comecarNovo?: boolean;
  aoCriar: (entrada: EntradaDeModelo) => Promise<ModeloDeTarefa | undefined>;
  aoEditar: (id: string, entrada: EntradaDeModelo) => Promise<ModeloDeTarefa | undefined>;
  aoApagar: (id: string) => Promise<boolean>;
}

/** Como "Início" e "Prazo" se escolhem: sem data, no dia da criação, ou N dias depois. */
type ModoDeData = "nenhum" | "hoje" | "dias";

interface Rascunho {
  name: string;
  title: string;
  description: string;
  priority: PrioridadeDaTarefa;
  status_option_id: string;
  assigned_to: string;
  inicioModo: ModoDeData;
  inicioDias: number;
  prazoModo: ModoDeData;
  prazoDias: number;
  prazoHora: string | null;
  repeat_enabled: boolean;
  repeat_frequency: FrequenciaDeRepeticao;
  repeat_weekdays: number[];
  repeat_day_of_month: number;
  repeat_time: string;
}

const modoDe = (dias: number | null | undefined): ModoDeData =>
  dias === null || dias === undefined ? "nenhum" : dias === 0 ? "hoje" : "dias";
const diasDe = (modo: ModoDeData, dias: number): number | null =>
  modo === "nenhum" ? null : modo === "hoje" ? 0 : dias;

function rascunhoDe(m?: ModeloDeTarefa): Rascunho {
  return {
    name: m?.name ?? "",
    title: m?.title ?? "",
    description: m?.description ?? "",
    priority: m?.priority ?? "medium",
    status_option_id: m?.status_option_id ?? "",
    assigned_to: m?.assigned_to ?? "",
    inicioModo: modoDe(m?.start_offset_days),
    inicioDias: m?.start_offset_days && m.start_offset_days > 0 ? m.start_offset_days : 1,
    prazoModo: modoDe(m?.due_offset_days),
    prazoDias: m?.due_offset_days && m.due_offset_days > 0 ? m.due_offset_days : 1,
    prazoHora: m?.due_time ?? null,
    repeat_enabled: m?.repeat_enabled ?? false,
    repeat_frequency: m?.repeat_frequency ?? "weekly",
    repeat_weekdays: m?.repeat_weekdays?.length ? m.repeat_weekdays : [0],
    repeat_day_of_month: m?.repeat_day_of_month ?? 1,
    repeat_time: m?.repeat_time ?? "07:00",
  };
}

function entradaDe(r: Rascunho): EntradaDeModelo {
  return {
    name: r.name.trim() || r.title.trim(),
    title: r.title.trim(),
    description: r.description.trim() || null,
    priority: r.priority,
    status_option_id: r.status_option_id || null,
    assigned_to: r.assigned_to || null,
    start_offset_days: diasDe(r.inicioModo, r.inicioDias),
    due_offset_days: diasDe(r.prazoModo, r.prazoDias),
    due_time: r.prazoModo === "nenhum" ? null : r.prazoHora,
    repeat_enabled: r.repeat_enabled,
    repeat_frequency: r.repeat_enabled ? r.repeat_frequency : null,
    repeat_weekdays: r.repeat_enabled && r.repeat_frequency === "weekly" ? r.repeat_weekdays : [],
    repeat_day_of_month:
      r.repeat_enabled && r.repeat_frequency === "monthly" ? r.repeat_day_of_month : null,
    repeat_time: r.repeat_time,
  };
}

const CAMPO =
  "h-10 w-full rounded-xl border bg-background px-3 text-sm outline-hidden focus:border-primary/60 focus:ring-2 focus:ring-primary/20";

/**
 * MODELOS DE TAREFA — a lista dos modelos e o formulário de cada um. Um modelo é a tarefa
 * "de molde"; ligando "Repetir", o servidor cria a tarefa sozinho ("toda segunda às 7h, para
 * a Ana"). Abre pelo "+ ▾" ao lado de "Nova tarefa".
 */
export function ModelosDeTarefa(props: Props) {
  const celular = useCelular();
  const t = useT();
  const corpo = <Corpo {...props} />;

  if (celular) {
    return (
      <Sheet open={props.aberto} onOpenChange={(a) => !a && props.aoFechar()}>
        <SheetContent
          side="bottom"
          className="max-h-[94dvh] gap-3 overflow-y-auto rounded-t-3xl p-4 pb-8"
        >
          <SheetTitle className="text-center text-base font-semibold">
            {t("Modelos de tarefa")}
          </SheetTitle>
          <SheetDescription className="sr-only">
            {t("Tarefas de molde, com repetição opcional")}
          </SheetDescription>
          {corpo}
        </SheetContent>
      </Sheet>
    );
  }
  return (
    <Dialog open={props.aberto} onOpenChange={(a) => !a && props.aoFechar()}>
      <DialogContent className="max-h-[90dvh] max-w-lg gap-4 overflow-y-auto p-5 sm:rounded-2xl">
        <DialogTitle className="text-base font-semibold">{t("Modelos de tarefa")}</DialogTitle>
        <DialogDescription className="sr-only">
          {t("Tarefas de molde, com repetição opcional")}
        </DialogDescription>
        {corpo}
      </DialogContent>
    </Dialog>
  );
}

function Corpo({
  modelos,
  opcoesDeStatus,
  membros,
  fuso,
  tag,
  agora,
  podeEditar,
  comecarNovo,
  aoCriar,
  aoEditar,
  aoApagar,
}: Props) {
  const t = useT();
  const [editando, setEditando] = useState<string | "novo" | null>(comecarNovo ? "novo" : null);
  const [r, setR] = useState<Rascunho>(() => rascunhoDe());
  const [salvando, setSalvando] = useState(false);
  const [confirmarApagar, setConfirmarApagar] = useState(false);

  const nomesDosDias = Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat(tag, { weekday: "short", timeZone: "UTC" })
      .format(new Date(Date.UTC(2026, 9, 5 + i, 12)))
      .replace(".", ""),
  );
  const mudar = (p: Partial<Rascunho>) => setR((atual) => ({ ...atual, ...p }));

  function resumoDaRepeticao(
    m: Pick<
      DadosDoModelo,
      "repeat_frequency" | "repeat_weekdays" | "repeat_day_of_month" | "repeat_time"
    >,
  ) {
    if (m.repeat_frequency === "daily") return `${t("Todo dia às")} ${m.repeat_time}`;
    if (m.repeat_frequency === "weekly") {
      const dias = m.repeat_weekdays.map((d) => nomesDosDias[d]).join(", ");
      return `${t("Toda semana:")} ${dias} ${t("às")} ${m.repeat_time}`;
    }
    return `${t("Todo mês, no dia")} ${m.repeat_day_of_month} ${t("às")} ${m.repeat_time}`;
  }

  function abrir(id: string | "novo") {
    setR(rascunhoDe(id === "novo" ? undefined : modelos.find((m) => m.id === id)));
    setConfirmarApagar(false);
    setEditando(id);
  }

  async function salvar() {
    if (!r.title.trim()) return;
    setSalvando(true);
    const entrada = entradaDe(r);
    const salvo = editando === "novo" ? await aoCriar(entrada) : await aoEditar(editando!, entrada);
    setSalvando(false);
    if (salvo) setEditando(null);
  }

  // ── lista ────────────────────────────────────────────────────────────────────────────
  if (editando === null) {
    return (
      <div className="flex min-w-0 flex-col gap-3">
        {modelos.length === 0 ? (
          <p className="rounded-2xl bg-secondary/60 px-4 py-6 text-center text-sm text-muted-foreground">
            {t("Nenhum modelo ainda. Crie um para repetir uma tarefa ou criá-la com um clique.")}
          </p>
        ) : (
          <ul className="divide-y rounded-2xl bg-secondary/60">
            {modelos.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => abrir(m.id)}
                  className="flex min-h-14 w-full flex-col items-start justify-center gap-0.5 px-4 py-2 text-left hover:bg-secondary"
                >
                  <span className="max-w-full truncate text-sm font-medium">{m.name}</span>
                  {m.repeat_enabled ? (
                    <span className="flex max-w-full items-center gap-1 truncate text-xs text-primary">
                      <ArrowsClockwise size={12} aria-hidden />
                      {resumoDaRepeticao(m)}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">{t("Não repete")}</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
        {podeEditar ? (
          <button
            type="button"
            onClick={() => abrir("novo")}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-primary text-sm font-medium text-primary-foreground shadow-sm hover:bg-[var(--color-accent-hover)]"
          >
            <Plus size={16} weight="bold" aria-hidden />
            {t("Novo modelo")}
          </button>
        ) : null}
      </div>
    );
  }

  // ── formulário ───────────────────────────────────────────────────────────────────────
  const atual = editando === "novo" ? undefined : modelos.find((m) => m.id === editando);
  const campo = (rotulo: string, filho: React.ReactNode, id: string) => (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs text-muted-foreground">
        {rotulo}
      </label>
      {filho}
    </div>
  );
  const seletorDeData = (
    id: string,
    rotulo: string,
    modo: ModoDeData,
    dias: number,
    aoMudarModo: (m: ModoDeData) => void,
    aoMudarDias: (n: number) => void,
  ) =>
    campo(
      rotulo,
      <div className="flex gap-2">
        <select
          id={id}
          value={modo}
          disabled={!podeEditar}
          onChange={(e) => aoMudarModo(e.target.value as ModoDeData)}
          className={cn(CAMPO, "min-w-0 flex-1")}
        >
          <option value="nenhum">{t("Sem data")}</option>
          <option value="hoje">{t("No dia em que for criada")}</option>
          <option value="dias">{t("Alguns dias depois")}</option>
        </select>
        {modo === "dias" ? (
          <input
            type="number"
            min={-365}
            max={730}
            value={dias}
            disabled={!podeEditar}
            aria-label={t("Quantos dias depois")}
            onChange={(e) => aoMudarDias(Math.trunc(Number(e.target.value) || 0))}
            className={cn(CAMPO, "w-20 shrink-0")}
          />
        ) : null}
      </div>,
      id,
    );

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <button
        type="button"
        onClick={() => setEditando(null)}
        className="inline-flex h-8 w-fit items-center gap-1 rounded-lg pr-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <CaretLeft size={14} aria-hidden />
        {t("Modelos")}
      </button>

      {campo(
        t("Nome do modelo"),
        <input
          id="modelo-nome"
          value={r.name}
          maxLength={60}
          readOnly={!podeEditar}
          placeholder={t("Ex.: Revisão semanal")}
          onChange={(e) => mudar({ name: e.target.value })}
          className={CAMPO}
        />,
        "modelo-nome",
      )}
      {campo(
        t("Título da tarefa"),
        <input
          id="modelo-titulo"
          value={r.title}
          maxLength={255}
          readOnly={!podeEditar}
          onChange={(e) => mudar({ title: e.target.value })}
          className={CAMPO}
        />,
        "modelo-titulo",
      )}
      {campo(
        t("Descrição"),
        <textarea
          id="modelo-descricao"
          value={r.description}
          maxLength={5000}
          rows={3}
          readOnly={!podeEditar}
          onChange={(e) => mudar({ description: e.target.value })}
          className={cn(CAMPO, "h-auto resize-y py-2")}
        />,
        "modelo-descricao",
      )}

      <div className="grid grid-cols-2 gap-2">
        {campo(
          t("Prioridade"),
          <select
            id="modelo-prioridade"
            value={r.priority}
            disabled={!podeEditar}
            onChange={(e) => mudar({ priority: e.target.value as PrioridadeDaTarefa })}
            className={CAMPO}
          >
            {PRIORIDADES_DA_TAREFA.map((p) => (
              <option key={p} value={p}>
                {p === "low"
                  ? t("Baixa")
                  : p === "medium"
                    ? t("Média")
                    : p === "high"
                      ? t("Alta")
                      : t("Urgente")}
              </option>
            ))}
          </select>,
          "modelo-prioridade",
        )}
        {campo(
          t("Status"),
          <select
            id="modelo-status"
            value={r.status_option_id}
            disabled={!podeEditar}
            onChange={(e) => mudar({ status_option_id: e.target.value })}
            className={CAMPO}
          >
            <option value="">{t("O primeiro")}</option>
            {opcoesDeStatus.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>,
          "modelo-status",
        )}
      </div>
      {campo(
        t("Responsável"),
        <select
          id="modelo-responsavel"
          value={r.assigned_to}
          disabled={!podeEditar}
          onChange={(e) => mudar({ assigned_to: e.target.value })}
          className={CAMPO}
        >
          <option value="">{t("Ninguém")}</option>
          {membros.map((m) => (
            <option key={m.id} value={m.id}>
              {m.nome}
            </option>
          ))}
        </select>,
        "modelo-responsavel",
      )}

      {seletorDeData(
        "modelo-inicio",
        t("Início"),
        r.inicioModo,
        r.inicioDias,
        (inicioModo) => mudar({ inicioModo }),
        (inicioDias) => mudar({ inicioDias }),
      )}
      {seletorDeData(
        "modelo-prazo",
        t("Prazo"),
        r.prazoModo,
        r.prazoDias,
        (prazoModo) => mudar({ prazoModo }),
        (prazoDias) => mudar({ prazoDias }),
      )}
      {r.prazoModo !== "nenhum" ? (
        <div className="flex min-h-10 items-center justify-between gap-3 rounded-xl bg-secondary/60 px-4">
          <span className="text-sm">{t("Incluir hora no prazo")}</span>
          <div className="flex items-center gap-2">
            {r.prazoHora !== null ? (
              <input
                type="time"
                aria-label={t("Horário")}
                value={r.prazoHora}
                disabled={!podeEditar}
                onChange={(e) => mudar({ prazoHora: e.target.value || "17:00" })}
                className="h-9 rounded-lg border bg-background px-2 text-sm"
              />
            ) : null}
            <Switch
              checked={r.prazoHora !== null}
              disabled={!podeEditar}
              aria-label={t("Incluir hora no prazo")}
              onCheckedChange={(ligado) => mudar({ prazoHora: ligado ? "17:00" : null })}
            />
          </div>
        </div>
      ) : null}

      <div className="rounded-2xl bg-secondary/60 p-3">
        <div className="flex min-h-10 items-center justify-between gap-3">
          <span className="flex items-center gap-2 text-sm font-medium">
            <ArrowsClockwise size={16} aria-hidden />
            {t("Repetir")}
          </span>
          <Switch
            checked={r.repeat_enabled}
            disabled={!podeEditar}
            aria-label={t("Repetir")}
            onCheckedChange={(repeat_enabled) => mudar({ repeat_enabled })}
          />
        </div>
        {r.repeat_enabled ? (
          <div className="mt-2 flex flex-col gap-3">
            {campo(
              t("Frequência"),
              <select
                id="modelo-frequencia"
                value={r.repeat_frequency}
                disabled={!podeEditar}
                onChange={(e) =>
                  mudar({ repeat_frequency: e.target.value as FrequenciaDeRepeticao })
                }
                className={CAMPO}
              >
                {FREQUENCIAS_DE_REPETICAO.map((f) => (
                  <option key={f} value={f}>
                    {f === "daily"
                      ? t("Todo dia")
                      : f === "weekly"
                        ? t("Toda semana")
                        : t("Todo mês")}
                  </option>
                ))}
              </select>,
              "modelo-frequencia",
            )}
            {r.repeat_frequency === "weekly" ? (
              <div role="group" aria-label={t("Dias da semana")} className="flex flex-wrap gap-1.5">
                {nomesDosDias.map((nome, d) => {
                  const ligado = r.repeat_weekdays.includes(d);
                  return (
                    <button
                      key={d}
                      type="button"
                      aria-pressed={ligado}
                      disabled={!podeEditar}
                      onClick={() =>
                        mudar({
                          repeat_weekdays: ligado
                            ? r.repeat_weekdays.filter((x) => x !== d)
                            : [...r.repeat_weekdays, d].sort((a, b) => a - b),
                        })
                      }
                      className={cn(
                        "h-9 min-w-11 rounded-lg border px-2 text-sm capitalize transition-colors",
                        ligado
                          ? "border-primary bg-primary/10 font-medium text-primary"
                          : "text-muted-foreground hover:bg-secondary",
                      )}
                    >
                      {nome}
                    </button>
                  );
                })}
              </div>
            ) : null}
            {r.repeat_frequency === "monthly"
              ? campo(
                  t("Dia do mês"),
                  <input
                    id="modelo-dia-do-mes"
                    type="number"
                    min={1}
                    max={31}
                    value={r.repeat_day_of_month}
                    disabled={!podeEditar}
                    onChange={(e) =>
                      mudar({
                        repeat_day_of_month: Math.min(
                          31,
                          Math.max(1, Math.trunc(Number(e.target.value) || 1)),
                        ),
                      })
                    }
                    className={cn(CAMPO, "w-24")}
                  />,
                  "modelo-dia-do-mes",
                )
              : null}
            {campo(
              t("Criar a tarefa às"),
              <input
                id="modelo-hora"
                type="time"
                value={r.repeat_time}
                disabled={!podeEditar}
                onChange={(e) => mudar({ repeat_time: e.target.value || "07:00" })}
                className={cn(CAMPO, "w-32")}
              />,
              "modelo-hora",
            )}
            <p className="text-xs text-muted-foreground">
              {resumoDaRepeticao({
                repeat_frequency: r.repeat_frequency,
                repeat_weekdays: r.repeat_weekdays,
                repeat_day_of_month: r.repeat_day_of_month,
                repeat_time: r.repeat_time,
              })}
              {atual?.next_run_at && atual.repeat_enabled
                ? ` · ${t("Próxima:")} ${rotuloDaData(atual.next_run_at, fuso, tag, agora)}`
                : ""}
            </p>
          </div>
        ) : null}
      </div>

      {podeEditar ? (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button
            type="button"
            disabled={
              salvando ||
              !r.title.trim() ||
              (r.repeat_enabled &&
                r.repeat_frequency === "weekly" &&
                r.repeat_weekdays.length === 0)
            }
            onClick={() => void salvar()}
            className="h-10 flex-1 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm hover:bg-[var(--color-accent-hover)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t("Salvar modelo")}
          </button>
          {atual ? (
            confirmarApagar ? (
              <button
                type="button"
                onClick={async () => {
                  if (await aoApagar(atual.id)) setEditando(null);
                }}
                className="h-10 rounded-xl bg-error px-4 text-sm font-medium text-white"
              >
                {t("Confirmar: apagar")}
              </button>
            ) : (
              <button
                type="button"
                aria-label={t("Apagar modelo")}
                onClick={() => setConfirmarApagar(true)}
                className="grid h-10 w-10 place-items-center rounded-xl border text-error-fg hover:bg-error-bg"
              >
                <Trash size={16} aria-hidden />
              </button>
            )
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
