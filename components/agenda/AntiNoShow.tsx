"use client";

import { useState } from "react";
import { toast } from "sonner";

import { useConfirmar } from "@/components/marketing/campanhas/useConfirmar";
import { CaixaRedonda } from "@/components/ui/CaixaRedonda";
import { useAntiNoShow, type TipoParaOFluxo } from "@/hooks/agenda/useAntiNoShow";
import { useT } from "@/hooks/i18n/useT";
import type { EntradaDoFluxo } from "@/lib/agenda/anti-no-show";
import type { PassoDeLembrete } from "@/lib/agenda/lembretes";
import { Plus, Trash } from "@/lib/ui/icons";

const CAMPO =
  "h-10 rounded-xl border bg-card px-3 text-sm outline-hidden focus:border-primary/60 focus:ring-2 focus:ring-primary/20 disabled:opacity-60";
const BOTAO =
  "inline-flex h-9 items-center justify-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors hover:bg-secondary disabled:opacity-50";
const BOTAO_CHEIO =
  "inline-flex h-9 items-center justify-center gap-2 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50";

function antecedencia(t: (s: string) => string, minutos: number): string {
  if (minutos >= 1440 && minutos % 1440 === 0) return `${minutos / 1440} ${t("d")}`;
  if (minutos >= 60 && minutos % 60 === 0) return `${minutos / 60} h`;
  return `${minutos} min`;
}

function CartaoDoFluxo({
  inicial,
  tipos,
  fluxosDosOutrosTipos,
  podeEditar,
  aoSalvar,
  aoApagar,
  aoSalvarMensagens,
}: {
  inicial: EntradaDoFluxo;
  tipos: TipoParaOFluxo[];
  /** Tipo → nome do OUTRO fluxo a que já pertence (escolhê-lo aqui tira de lá). */
  fluxosDosOutrosTipos: ReadonlyMap<string, string>;
  podeEditar: boolean;
  aoSalvar: (e: EntradaDoFluxo) => Promise<boolean>;
  aoApagar?: () => Promise<void>;
  aoSalvarMensagens: (tipoId: string, passos: PassoDeLembrete[]) => Promise<boolean>;
}) {
  const t = useT();
  const [f, setF] = useState(inicial);
  /** As mensagens em edição, por tipo (só o que a pessoa mexeu). */
  const [mensagens, setMensagens] = useState<Record<string, PassoDeLembrete[]>>({});
  const [gravando, setGravando] = useState(false);
  const sujo = JSON.stringify(f) !== JSON.stringify(inicial);
  const bloqueado = !podeEditar;
  const alternarTipo = (id: string) =>
    setF({
      ...f,
      event_type_ids: f.event_type_ids.includes(id)
        ? f.event_type_ids.filter((x) => x !== id)
        : [...f.event_type_ids, id],
    });

  return (
    <article className="grid gap-4 rounded-2xl border bg-card p-4 shadow-sm">
      <input
        className={`${CAMPO} w-full text-base font-semibold`}
        disabled={bloqueado}
        maxLength={160}
        aria-label={t("Nome do fluxo")}
        value={f.name}
        onChange={(e) => setF({ ...f, name: e.target.value })}
      />

      <section className="grid gap-2">
        <h3 className="text-sm font-semibold">{t("Onde se aplica")}</h3>
        {tipos.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t("Nenhum tipo de compromisso ativo.")}</p>
        ) : (
          <ul className="grid gap-1 sm:grid-cols-2">
            {tipos.map((x) => {
              const outro = fluxosDosOutrosTipos.get(x.id);
              return (
                <li key={x.id}>
                  <label className="flex cursor-pointer items-start gap-2 rounded-xl border px-3 py-2 text-sm">
                    <CaixaRedonda
                      className="mt-0.5"
                      disabled={bloqueado}
                      checked={f.event_type_ids.includes(x.id)}
                      onChange={() => alternarTipo(x.id)}
                    />
                    <span className="grid">
                      <span className="font-medium">{x.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {x.lembretes.length > 0
                          ? `${t("Lembretes")}: ${x.lembretes.map((m) => antecedencia(t, m.minutes)).join(", ")} ${t("antes")}`
                          : t("Sem lembrete ao cliente")}
                        {outro && !f.event_type_ids.includes(x.id)
                          ? ` · ${t("hoje no fluxo")} “${outro}”`
                          : ""}
                      </span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
        <p className="text-xs text-muted-foreground">
          {t(
            "O aviso ao cliente é o lembrete de cada tipo (editado em Tipos de atendimento). Um tipo tem no máximo um fluxo.",
          )}
        </p>
      </section>

      <section className="grid gap-2">
        <h3 className="text-sm font-semibold">{t("Se o cliente não confirmar")}</h3>
        <label className="flex flex-wrap items-center gap-2 text-sm">
          <CaixaRedonda
            disabled={bloqueado}
            checked={f.call_hours_before !== null}
            onChange={(e) => setF({ ...f, call_hours_before: e.target.checked ? 3 : null })}
          />
          {t("Criar tarefa de ligar para o responsável")}
          <input
            type="number"
            min={1}
            max={72}
            className={`${CAMPO} w-20 tabular-nums`}
            disabled={bloqueado || f.call_hours_before === null}
            aria-label={t("Horas antes do compromisso")}
            value={f.call_hours_before ?? ""}
            onChange={(e) =>
              setF({
                ...f,
                call_hours_before: Math.min(
                  72,
                  Math.max(1, Math.floor(Number(e.target.value) || 1)),
                ),
              })
            }
          />
          {t("horas antes")}
        </label>
      </section>

      <section className="grid gap-2">
        <h3 className="text-sm font-semibold">{t("O que fica na oportunidade")}</h3>
        <label className="flex flex-wrap items-center gap-2 text-sm">
          {t("Quando o cliente confirmar, marcar a tag")}
          <input
            className={`${CAMPO} w-40`}
            disabled={bloqueado}
            maxLength={30}
            placeholder={t("(nenhuma)")}
            value={f.confirm_tag}
            onChange={(e) => setF({ ...f, confirm_tag: e.target.value })}
          />
        </label>
        <label className="flex flex-wrap items-center gap-2 text-sm">
          {t("Quando faltar, marcar a tag")}
          <input
            className={`${CAMPO} w-40`}
            disabled={bloqueado}
            maxLength={30}
            placeholder={t("(nenhuma)")}
            value={f.no_show_tag}
            onChange={(e) => setF({ ...f, no_show_tag: e.target.value })}
          />
          <span className="text-xs text-muted-foreground">
            {t("(soma um contador a cada falta)")}
          </span>
        </label>
        <label className="flex flex-wrap items-center gap-2 text-sm">
          <CaixaRedonda
            disabled={bloqueado}
            checked={f.remarcar_days !== null}
            onChange={(e) => setF({ ...f, remarcar_days: e.target.checked ? 1 : null })}
          />
          {t("Quando faltar, voltar a oportunidade à fila para remarcar em")}
          <input
            type="number"
            min={0}
            max={30}
            className={`${CAMPO} w-20 tabular-nums`}
            disabled={bloqueado || f.remarcar_days === null}
            aria-label={t("Dias úteis para remarcar")}
            value={f.remarcar_days ?? ""}
            onChange={(e) =>
              setF({
                ...f,
                remarcar_days: Math.min(30, Math.max(0, Math.floor(Number(e.target.value) || 0))),
              })
            }
          />
          {t("dias úteis")}
        </label>
        {f.remarcar_days !== null ? (
          <label className="flex flex-wrap items-center gap-2 pl-7 text-sm">
            {t("Tentar remarcar até")}
            <input
              type="number"
              min={1}
              max={6}
              className={`${CAMPO} w-20 tabular-nums`}
              disabled={bloqueado}
              aria-label={t("Tentativas de remarcar")}
              value={f.remarcar_attempts}
              onChange={(e) =>
                setF({
                  ...f,
                  remarcar_attempts: Math.min(
                    6,
                    Math.max(1, Math.floor(Number(e.target.value) || 1)),
                  ),
                })
              }
            />
            {t("vezes, a cada")}
            <input
              type="number"
              min={1}
              max={14}
              className={`${CAMPO} w-20 tabular-nums`}
              disabled={bloqueado}
              aria-label={t("Dias úteis entre as tentativas")}
              value={f.remarcar_interval_days}
              onChange={(e) =>
                setF({
                  ...f,
                  remarcar_interval_days: Math.min(
                    14,
                    Math.max(1, Math.floor(Number(e.target.value) || 1)),
                  ),
                })
              }
            />
            {t("dias úteis sem resposta")}
          </label>
        ) : null}
      </section>

      {tipos.some((x) => f.event_type_ids.includes(x.id) && x.lembrete_ligado) ? (
        <section className="grid gap-3">
          <h3 className="text-sm font-semibold">{t("Mensagens dos lembretes")}</h3>
          <p className="text-xs text-muted-foreground">
            {t(
              "É o texto que o cliente recebe antes do compromisso, o mesmo de Tipos de atendimento. Vazio usa a mensagem padrão. Use {nome}, {data} e {hora}.",
            )}
          </p>
          {tipos
            .filter((x) => f.event_type_ids.includes(x.id) && x.lembrete_ligado)
            .map((x) => {
              const passos = mensagens[x.id] ?? x.lembretes;
              const mexeu = mensagens[x.id] !== undefined;
              return (
                <div key={x.id} className="grid gap-2 rounded-xl border p-3">
                  <p className="text-sm font-medium">{x.name}</p>
                  {passos.map((p, i) => (
                    <label key={p.minutes} className="grid gap-1 text-xs text-muted-foreground">
                      {antecedencia(t, p.minutes)} {t("antes")}
                      <textarea
                        rows={2}
                        maxLength={1000}
                        disabled={bloqueado}
                        className="w-full rounded-xl border bg-card px-3 py-2 text-sm text-foreground outline-hidden focus:border-primary/60 focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
                        value={p.body}
                        onChange={(e) =>
                          setMensagens({
                            ...mensagens,
                            [x.id]: passos.map((q, j) =>
                              j === i ? { ...q, body: e.target.value } : q,
                            ),
                          })
                        }
                      />
                    </label>
                  ))}
                  {podeEditar && mexeu ? (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className={BOTAO_CHEIO}
                        onClick={async () => {
                          if (await aoSalvarMensagens(x.id, passos)) {
                            setMensagens(({ [x.id]: _tirado, ...resto }) => resto);
                            toast.success(t("Mensagens salvas."));
                          }
                        }}
                      >
                        {t("Salvar mensagens")}
                      </button>
                      <button
                        type="button"
                        className={BOTAO}
                        onClick={() => setMensagens(({ [x.id]: _tirado, ...resto }) => resto)}
                      >
                        {t("Descartar")}
                      </button>
                    </div>
                  ) : null}
                </div>
              );
            })}
        </section>
      ) : null}

      {podeEditar ? (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={BOTAO_CHEIO}
            disabled={!sujo || gravando || f.name.trim().length === 0}
            onClick={async () => {
              setGravando(true);
              const certo = await aoSalvar({
                ...f,
                name: f.name.trim(),
                confirm_tag: f.confirm_tag.trim(),
                no_show_tag: f.no_show_tag.trim(),
              });
              setGravando(false);
              if (certo) toast.success(t("Fluxo salvo."));
            }}
          >
            {t("Salvar fluxo")}
          </button>
          {sujo ? (
            <button type="button" className={BOTAO} onClick={() => setF(inicial)}>
              {t("Descartar mudanças")}
            </button>
          ) : null}
          {aoApagar ? (
            <button
              type="button"
              aria-label={t("Apagar fluxo")}
              className="ml-auto grid h-9 w-9 place-items-center rounded-full text-muted-foreground hover:bg-secondary hover:text-error-fg"
              onClick={() => void aoApagar()}
            >
              <Trash size={16} aria-hidden />
            </button>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

/**
 * A aba ANTI NO-SHOW da Agenda: fluxos que dizem, por tipo de compromisso, o que a equipe faz para
 * o cliente não faltar e o que fica marcado na oportunidade quando ele confirma ou falta.
 */
export function AntiNoShow({ podeEditar }: { podeEditar: boolean }) {
  const t = useT();
  const { confirmar, dialogo } = useConfirmar();
  const { dados, carregando, criar, salvar, apagar, salvarMensagens } = useAntiNoShow();
  const [novo, setNovo] = useState<EntradaDoFluxo | null>(null);

  if (carregando || !dados) {
    return <p className="text-sm text-muted-foreground">{t("Carregando…")}</p>;
  }
  const nomeDoFluxoDoTipo = (idDoFluxoAtual: string | null) => {
    const m = new Map<string, string>();
    for (const fl of dados.fluxos) {
      if (fl.id === idDoFluxoAtual) continue;
      for (const tipo of fl.event_type_ids) m.set(tipo, fl.name);
    }
    return m;
  };

  return (
    <section className="grid gap-4">
      <div className="grid gap-1">
        <h2 className="text-base font-semibold">{t("Fluxos anti no-show")}</h2>
        <p className="text-sm text-muted-foreground">
          {t(
            "Cada fluxo vale para os tipos de compromisso que você marcar. Ele cuida do que a equipe faz quando o cliente não confirma e do que fica na oportunidade quando ele confirma ou falta.",
          )}
        </p>
      </div>

      {dados.fluxos.map((fl) => (
        <CartaoDoFluxo
          key={`${fl.id}:${JSON.stringify(fl)}`}
          inicial={{
            name: fl.name,
            call_hours_before: fl.call_hours_before,
            confirm_tag: fl.confirm_tag,
            no_show_tag: fl.no_show_tag,
            remarcar_days: fl.remarcar_days,
            remarcar_attempts: fl.remarcar_attempts,
            remarcar_interval_days: fl.remarcar_interval_days,
            event_type_ids: fl.event_type_ids,
          }}
          tipos={dados.tipos}
          fluxosDosOutrosTipos={nomeDoFluxoDoTipo(fl.id)}
          podeEditar={podeEditar}
          aoSalvar={(e) => salvar(fl.id, e)}
          aoSalvarMensagens={salvarMensagens}
          aoApagar={async () => {
            if (
              await confirmar(
                t("Apagar este fluxo? Os tipos voltam à regra de sempre."),
                t("Apagar"),
              )
            ) {
              await apagar(fl.id);
            }
          }}
        />
      ))}

      {novo ? (
        <CartaoDoFluxo
          inicial={novo}
          aoSalvarMensagens={salvarMensagens}
          tipos={dados.tipos}
          fluxosDosOutrosTipos={nomeDoFluxoDoTipo(null)}
          podeEditar={podeEditar}
          aoSalvar={async (e) => {
            const certo = await criar(e);
            if (certo) setNovo(null);
            return certo;
          }}
        />
      ) : dados.fluxos.length === 0 ? (
        <p className="rounded-2xl border border-dashed bg-card p-6 text-center text-sm text-muted-foreground">
          {t("Ainda não há fluxos. Crie o primeiro a partir do modelo.")}
        </p>
      ) : null}

      {podeEditar && !novo ? (
        <div>
          <button
            type="button"
            className={BOTAO}
            onClick={() =>
              setNovo({ ...dados.modelo, name: t("Anti no-show"), event_type_ids: [] })
            }
          >
            <Plus size={14} aria-hidden />
            {t("Novo fluxo")}
          </button>
        </div>
      ) : null}
      {dialogo}
    </section>
  );
}
