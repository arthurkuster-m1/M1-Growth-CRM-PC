"use client";

import { useEffect, useState } from "react";

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { SeletorDeData } from "@/components/marketing/cronograma/SeletorDeData";
import { useT } from "@/hooks/i18n/useT";
import {
  FUSO_DO_CRONOGRAMA,
  situacaoDaTarefa,
  type LadoDaTarefa,
  type TarefaDoCronograma,
} from "@/lib/marketing/cronograma";
import { chaveDoDia } from "@/lib/inicio/datas";
import { Plus, X } from "@/lib/ui/icons";

const CAMPO =
  "w-full rounded-xl border bg-background px-3 py-2 text-sm outline-hidden focus:border-primary/60 focus:ring-2 focus:ring-primary/20";

/** "2026-10-27" → ISO ao meio-dia de Brasília (uma data "só dia", sem virar o dia anterior). */
export const isoDoDia = (dia: string): string => `${dia}T12:00:00-03:00`;
const diaDoIso = (iso: string | null): string =>
  iso ? chaveDoDia(new Date(iso), FUSO_DO_CRONOGRAMA) : "";

type Decisao = {
  task_id: string;
  acao: "concluir" | "adiar" | "manter" | "cancelar";
  novo_prazo?: string | null;
  motivo?: string;
};

interface Acoes {
  adicionar: (t: {
    id?: string;
    title?: string;
    due_date?: string | null;
    lado: LadoDaTarefa;
  }) => Promise<unknown>;
  editar: (
    id: string,
    t: { lado?: LadoDaTarefa | null; due_date?: string | null; status?: string; motivo?: string },
  ) => Promise<unknown>;
  fechar: (d: Decisao[]) => Promise<unknown>;
  disponiveis: (
    q: string,
  ) => Promise<Array<{ id: string; title: string; due_date: string | null }>>;
}

/** Edição da semana: incluir/criar tarefas, mudar lado, concluir, adiar com motivo e fechar a semana. */
export function EdicaoDaSemana({
  tarefas,
  inicioDaSemana,
  acoes,
}: {
  tarefas: TarefaDoCronograma[];
  inicioDaSemana: string;
  acoes: Acoes;
}) {
  const t = useT();
  const [titulo, setTitulo] = useState("");
  const [dia, setDia] = useState(inicioDaSemana);
  const [lado, setLado] = useState<LadoDaTarefa>("agencia");
  const [busca, setBusca] = useState("");
  const [achadas, setAchadas] = useState<
    Array<{ id: string; title: string; due_date: string | null }>
  >([]);
  const [adiando, setAdiando] = useState<TarefaDoCronograma | null>(null);
  const [fechando, setFechando] = useState(false);

  useEffect(() => {
    setDia(inicioDaSemana);
  }, [inicioDaSemana]);

  useEffect(() => {
    let vivo = true;
    const espera = setTimeout(() => {
      void acoes
        .disponiveis(busca)
        .then((l) => vivo && setAchadas(l))
        .catch(() => undefined);
    }, 250);
    return () => {
      vivo = false;
      clearTimeout(espera);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busca, tarefas.length]);

  const abertas = tarefas.filter((x) => x.status !== "done" && x.status !== "cancelled");

  return (
    <div className="grid gap-4">
      <fieldset className="grid gap-3 rounded-2xl border bg-card p-4">
        <legend className="px-2 text-sm font-semibold">{t("Tarefas desta semana")}</legend>
        {tarefas.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("Nenhuma tarefa nesta semana ainda.")}</p>
        ) : null}
        {tarefas.map((x) => {
          const situacao = situacaoDaTarefa(x);
          return (
            <div
              key={x.id}
              className="grid gap-2 rounded-xl bg-secondary/40 p-3 sm:grid-cols-[1fr_auto]"
            >
              <div>
                <p className="text-sm font-medium">{x.title}</p>
                <p className="text-xs text-muted-foreground">
                  {t("Prazo")}: {diaDoIso(x.due_date).split("-").reverse().join("/") || "—"}
                  {x.adiamentos > 0 ? ` · ${t("adiada")} ${x.adiamentos}x` : ""}
                  {situacao === "atrasada" ? ` · ${t("atrasada")}` : ""}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={x.lado}
                  aria-label={t("Quem faz")}
                  onChange={(e) =>
                    void acoes.editar(x.id, { lado: e.target.value as LadoDaTarefa })
                  }
                  className="h-9 rounded-lg border bg-background px-2 text-sm"
                >
                  <option value="agencia">{t("Agência")}</option>
                  <option value="cliente">{t("Cliente")}</option>
                </select>
                <select
                  value={x.status === "cancelled" ? "pending" : x.status}
                  aria-label={t("Situação")}
                  onChange={(e) => void acoes.editar(x.id, { status: e.target.value })}
                  className="h-9 rounded-lg border bg-background px-2 text-sm"
                >
                  <option value="pending">{t("A fazer")}</option>
                  <option value="in_progress">{t("Em andamento")}</option>
                  <option value="done">{t("Concluída")}</option>
                </select>
                {x.status !== "done" ? (
                  <button
                    type="button"
                    onClick={() => setAdiando(x)}
                    className="h-9 rounded-lg border px-3 text-sm hover:bg-secondary"
                  >
                    {t("Adiar")}
                  </button>
                ) : null}
                <button
                  type="button"
                  aria-label={t("Tirar da semana")}
                  title={t("Tirar da semana")}
                  onClick={() => void acoes.editar(x.id, { lado: null })}
                  className="grid h-9 w-9 place-items-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-error-fg"
                >
                  <X size={14} aria-hidden />
                </button>
              </div>
            </div>
          );
        })}
        {abertas.length > 0 ? (
          <button
            type="button"
            onClick={() => setFechando(true)}
            className="h-10 w-fit rounded-xl border-[1.5px] border-primary px-4 text-sm font-semibold text-primary hover:bg-primary/10"
          >
            {t("Fechar a semana")}
          </button>
        ) : null}
      </fieldset>

      <fieldset className="grid gap-3 rounded-2xl border bg-card p-4">
        <legend className="px-2 text-sm font-semibold">{t("Nova tarefa")}</legend>
        <div className="grid gap-2 sm:grid-cols-[2fr_1fr_1fr_auto]">
          <input
            value={titulo}
            maxLength={255}
            placeholder={t("O que precisa ser feito")}
            aria-label={t("O que precisa ser feito")}
            onChange={(e) => setTitulo(e.target.value)}
            className={CAMPO}
          />
          <SeletorDeData
            valor={dia}
            rotulo={t("Prazo")}
            placeholder={t("Prazo")}
            aoMudar={setDia}
          />
          <select
            value={lado}
            onChange={(e) => setLado(e.target.value as LadoDaTarefa)}
            className={CAMPO}
          >
            <option value="agencia">{t("Agência")}</option>
            <option value="cliente">{t("Cliente")}</option>
          </select>
          <button
            type="button"
            disabled={titulo.trim() === "" || dia === ""}
            onClick={async () => {
              await acoes.adicionar({ title: titulo.trim(), due_date: isoDoDia(dia), lado });
              setTitulo("");
            }}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-primary px-3 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            <Plus size={14} weight="bold" aria-hidden />
            {t("Criar")}
          </button>
        </div>

        <div className="mt-2 grid gap-2">
          <input
            value={busca}
            placeholder={t("Ou busque uma tarefa que já existe na base")}
            aria-label={t("Ou busque uma tarefa que já existe na base")}
            onChange={(e) => setBusca(e.target.value)}
            className={CAMPO}
          />
          {achadas.slice(0, 6).map((a) => (
            <div
              key={a.id}
              className="flex items-center justify-between gap-2 rounded-lg bg-secondary/40 px-3 py-2 text-sm"
            >
              <span className="min-w-0 truncate">{a.title}</span>
              <button
                type="button"
                onClick={() =>
                  void acoes.adicionar({
                    id: a.id,
                    lado,
                    ...(a.due_date ? {} : { due_date: isoDoDia(dia) }),
                  })
                }
                className="h-8 shrink-0 rounded-lg border px-3 text-xs hover:bg-secondary"
              >
                {t("Incluir na semana")}
              </button>
            </div>
          ))}
        </div>
      </fieldset>

      <DialogoDeAdiar
        tarefa={adiando}
        aoFechar={() => setAdiando(null)}
        aoConfirmar={async (novo, motivo) => {
          if (adiando) await acoes.editar(adiando.id, { due_date: isoDoDia(novo), motivo });
          setAdiando(null);
        }}
      />
      <DialogoDeFechamento
        aberto={fechando}
        tarefas={abertas}
        aoFechar={() => setFechando(false)}
        aoConfirmar={async (d) => {
          await acoes.fechar(d);
          setFechando(false);
        }}
      />
    </div>
  );
}

function DialogoDeAdiar({
  tarefa,
  aoFechar,
  aoConfirmar,
}: {
  tarefa: TarefaDoCronograma | null;
  aoFechar: () => void;
  aoConfirmar: (novoDia: string, motivo: string) => Promise<void>;
}) {
  const t = useT();
  const [dia, setDia] = useState("");
  const [motivo, setMotivo] = useState("");
  useEffect(() => {
    setDia(diaDoIso(tarefa?.due_date ?? null));
    setMotivo("");
  }, [tarefa]);
  return (
    <Dialog open={tarefa !== null} onOpenChange={(o) => (o ? null : aoFechar())}>
      <DialogContent className="max-w-md">
        <DialogTitle>{t("Adiar tarefa")}</DialogTitle>
        <DialogDescription>{tarefa?.title}</DialogDescription>
        <div className="grid gap-3">
          <label className="block">
            <span className="mb-1 block text-xs text-muted-foreground">{t("Novo prazo")}</span>
            <SeletorDeData valor={dia} rotulo={t("Novo prazo")} aoMudar={setDia} limpavel={false} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-muted-foreground">
              {t("Por que foi adiada? (fica guardado no histórico)")}
            </span>
            <textarea
              value={motivo}
              rows={3}
              maxLength={500}
              onChange={(e) => setMotivo(e.target.value)}
              className={CAMPO}
            />
          </label>
          <button
            type="button"
            disabled={dia === "" || motivo.trim() === ""}
            onClick={() => void aoConfirmar(dia, motivo.trim())}
            className="h-10 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {t("Confirmar novo prazo")}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DialogoDeFechamento({
  aberto,
  tarefas,
  aoFechar,
  aoConfirmar,
}: {
  aberto: boolean;
  tarefas: TarefaDoCronograma[];
  aoFechar: () => void;
  aoConfirmar: (d: Decisao[]) => Promise<void>;
}) {
  const t = useT();
  const [d, setD] = useState<
    Record<string, { acao: Decisao["acao"]; dia: string; motivo: string }>
  >({});
  useEffect(() => {
    if (aberto) {
      setD(
        Object.fromEntries(
          tarefas.map((x) => [
            x.id,
            { acao: "manter" as const, dia: diaDoIso(x.due_date), motivo: "" },
          ]),
        ),
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto]);

  const pronto = tarefas.every((x) => {
    const v = d[x.id];
    if (!v) return false;
    if (v.acao === "adiar") return v.dia !== "" && v.motivo.trim() !== "";
    if (v.acao === "cancelar") return v.motivo.trim() !== "";
    return true;
  });

  return (
    <Dialog open={aberto} onOpenChange={(o) => (o ? null : aoFechar())}>
      <DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto">
        <DialogTitle>{t("Fechar a semana")}</DialogTitle>
        <DialogDescription>
          {t(
            "O que aconteceu com cada tarefa que ainda está aberta? O motivo fica guardado no histórico.",
          )}
        </DialogDescription>
        <div className="grid gap-3">
          {tarefas.map((x) => {
            const v = d[x.id] ?? { acao: "manter" as const, dia: "", motivo: "" };
            const set = (p: Partial<typeof v>) => setD({ ...d, [x.id]: { ...v, ...p } });
            return (
              <div key={x.id} className="grid gap-2 rounded-xl border p-3">
                <p className="text-sm font-medium">{x.title}</p>
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      ["concluir", t("Concluída")],
                      ["manter", t("Continua aberta")],
                      ["adiar", t("Adiar")],
                      ["cancelar", t("Cancelar")],
                    ] as const
                  ).map(([valor, rotulo]) => (
                    <button
                      key={valor}
                      type="button"
                      aria-pressed={v.acao === valor}
                      onClick={() => set({ acao: valor })}
                      className={`h-8 rounded-lg border px-3 text-xs ${
                        v.acao === valor
                          ? "border-primary bg-primary/10 font-semibold text-primary"
                          : "hover:bg-secondary"
                      }`}
                    >
                      {rotulo}
                    </button>
                  ))}
                </div>
                {v.acao === "adiar" ? (
                  <SeletorDeData
                    valor={v.dia}
                    rotulo={t("Novo prazo")}
                    aoMudar={(d) => set({ dia: d })}
                    limpavel={false}
                  />
                ) : null}
                {v.acao === "adiar" || v.acao === "cancelar" ? (
                  <textarea
                    value={v.motivo}
                    rows={2}
                    maxLength={500}
                    placeholder={t("Por quê?")}
                    aria-label={t("Por quê?")}
                    onChange={(e) => set({ motivo: e.target.value })}
                    className={CAMPO}
                  />
                ) : null}
              </div>
            );
          })}
          <button
            type="button"
            disabled={!pronto || tarefas.length === 0}
            onClick={() =>
              void aoConfirmar(
                tarefas.map((x) => {
                  const v = d[x.id]!;
                  return {
                    task_id: x.id,
                    acao: v.acao,
                    novo_prazo: v.acao === "adiar" ? isoDoDia(v.dia) : undefined,
                    motivo: v.motivo.trim() || undefined,
                  };
                }),
              )
            }
            className="h-10 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {t("Fechar a semana")}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
