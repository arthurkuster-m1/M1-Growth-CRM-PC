"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { rotuloDoMeio } from "@/components/marketing/campanhas/rotulos";
import { useConfirmar } from "@/components/marketing/campanhas/useConfirmar";
import { SelectDoApp } from "@/components/ui/SelectDoApp";
import { useT } from "@/hooks/i18n/useT";
import { paraEntrada, useCadenciaDaCampanha } from "@/hooks/marketing/useCadencia";
import { useAbordagensDaCampanha } from "@/hooks/marketing/useCampanhasDeDemanda";
import {
  DIAS_PARA_RESPONDER_DEPOIS_DO_ULTIMO_PASSO,
  MAXIMO_DE_PASSOS,
  ordenarPassos,
  type EntradaDaCadencia,
  type PassoDaCadencia,
} from "@/lib/cadencia/cadencia";
import { MEIOS_DA_ABORDAGEM } from "@/lib/marketing/abordagens";
import { ArrowDown, ArrowUp, Plus, Trash } from "@/lib/ui/icons";

const CAMPO =
  "h-10 rounded-xl border bg-card px-3 text-sm outline-hidden focus:border-primary/60 focus:ring-2 focus:ring-primary/20 disabled:opacity-60";
const BOTAO =
  "inline-flex h-9 items-center justify-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors hover:bg-secondary disabled:opacity-50";
const BOTAO_CHEIO =
  "inline-flex h-9 items-center justify-center gap-2 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50";

const PASSO_NOVO = (dia: number): PassoDaCadencia => ({
  day_offset: dia,
  medium: "whatsapp",
  approach_id: null,
  note: "",
});

/**
 * A CADÊNCIA da campanha de prospecção: a linha do tempo "no dia D+N, por tal meio, com tal
 * abordagem". O lead que entra na etapa Abordagem começa a cadência; responder (registrar contato)
 * a encerra; esgotar sem resposta leva o lead ao destino escolhido no fim do desenho.
 */
export function CadenciaDaCampanha({
  campanhaId,
  podeEditar,
}: {
  campanhaId: string;
  podeEditar: boolean;
}) {
  const t = useT();
  const { confirmar, dialogo } = useConfirmar();
  const {
    dados,
    carregando,
    salvar,
    aplicarModelo,
    salvarComoModelo,
    apagarModelo,
    inscreverQuemJaEstaEmAbordagem,
  } = useCadenciaDaCampanha(campanhaId);
  const { abordagens } = useAbordagensDaCampanha(campanhaId);
  const [rascunho, setRascunho] = useState<EntradaDaCadencia | null>(null);
  const [nomeDoModelo, setNomeDoModelo] = useState("");
  const [gravando, setGravando] = useState(false);

  const original = dados ? paraEntrada(dados.cadencia) : null;
  useEffect(() => {
    if (original) setRascunho(original);
    // O servidor mudou (salvou, aplicou modelo): o rascunho recomeça dele.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dados]);

  if (carregando || !dados || !rascunho || !original) {
    return <p className="text-sm text-muted-foreground">{t("Carregando…")}</p>;
  }
  const sujo = JSON.stringify(rascunho) !== JSON.stringify(original);
  const bloqueado = !podeEditar;
  const passos = rascunho.steps;
  const trocar = (i: number, p: Partial<PassoDaCadencia>) =>
    setRascunho({ ...rascunho, steps: passos.map((x, j) => (j === i ? { ...x, ...p } : x)) });
  const mover = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= passos.length) return;
    const nova = [...passos];
    [nova[i], nova[j]] = [nova[j]!, nova[i]!];
    setRascunho({ ...rascunho, steps: nova });
  };
  const gravar = async () => {
    setGravando(true);
    const certo = await salvar({ ...rascunho, steps: ordenarPassos(passos) });
    setGravando(false);
    if (certo) toast.success(t("Cadência salva."));
  };
  const etapasDeDestino = dados.etapas.filter((e) => !e.is_won);

  return (
    <section className="grid min-w-0 gap-4">
      <div className="grid gap-1 rounded-2xl border bg-card p-4 shadow-sm">
        <h2 className="text-base font-semibold">{t("Cadência de abordagem")}</h2>
        <p className="text-sm text-muted-foreground">
          {t(
            "Todo lead que entra na etapa Abordagem começa esta cadência. Registrar um contato a encerra; se o último passo passar sem resposta, o lead vai para o destino escolhido no fim.",
          )}
        </p>
        <p className="text-xs text-muted-foreground">
          {dados.cadencia.ativos > 0
            ? t("{n} leads em cadência agora.").replace("{n}", String(dados.cadencia.ativos))
            : t("Nenhum lead em cadência agora.")}
        </p>
      </div>

      {passos.length === 0 ? (
        <p className="rounded-2xl border border-dashed bg-card p-6 text-center text-sm text-muted-foreground">
          {t("Ainda não há passos. Adicione o primeiro ou use um modelo.")}
        </p>
      ) : (
        <ol className="grid gap-0">
          {passos.map((p, i) => (
            <li key={i} className="grid grid-cols-[2.25rem_minmax(0,1fr)] gap-3">
              <div className="flex flex-col items-center">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/10 font-mono text-xs font-semibold text-primary">
                  {i + 1}
                </span>
                {i < passos.length - 1 ? <span className="w-px flex-1 bg-border" /> : null}
              </div>
              <div className="mb-3 grid gap-2 rounded-2xl border bg-card p-3 shadow-sm">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-[7rem_minmax(0,1fr)_minmax(0,1fr)]">
                  <label className="grid gap-1 text-xs text-muted-foreground">
                    {t("Dia (D+)")}
                    <input
                      type="number"
                      min={0}
                      max={365}
                      className={CAMPO}
                      disabled={bloqueado}
                      value={p.day_offset}
                      onChange={(e) =>
                        trocar(i, {
                          day_offset: Math.min(
                            365,
                            Math.max(0, Math.floor(Number(e.target.value) || 0)),
                          ),
                        })
                      }
                    />
                  </label>
                  <label className="grid gap-1 text-xs text-muted-foreground">
                    {t("Meio de contato")}
                    <SelectDoApp
                      className={CAMPO}
                      disabled={bloqueado}
                      value={p.medium}
                      onChange={(e) =>
                        trocar(i, { medium: e.target.value as PassoDaCadencia["medium"] })
                      }
                    >
                      {MEIOS_DA_ABORDAGEM.map((m) => (
                        <option key={m} value={m}>
                          {rotuloDoMeio(t, m)}
                        </option>
                      ))}
                    </SelectDoApp>
                  </label>
                  <label className="col-span-2 grid gap-1 text-xs text-muted-foreground sm:col-span-1">
                    {t("Abordagem")}
                    <SelectDoApp
                      className={CAMPO}
                      disabled={bloqueado}
                      value={p.approach_id ?? ""}
                      onChange={(e) => trocar(i, { approach_id: e.target.value || null })}
                    >
                      <option value="">{t("Sem abordagem definida")}</option>
                      {abordagens.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </SelectDoApp>
                  </label>
                </div>
                <input
                  className={`${CAMPO} w-full`}
                  disabled={bloqueado}
                  maxLength={500}
                  placeholder={t("Observação (opcional)")}
                  aria-label={t("Observação")}
                  value={p.note}
                  onChange={(e) => trocar(i, { note: e.target.value })}
                />
                {podeEditar ? (
                  <div className="flex justify-end gap-1">
                    <button
                      type="button"
                      aria-label={t("Subir passo")}
                      disabled={i === 0}
                      onClick={() => mover(i, -1)}
                      className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-secondary disabled:opacity-40"
                    >
                      <ArrowUp size={14} aria-hidden />
                    </button>
                    <button
                      type="button"
                      aria-label={t("Descer passo")}
                      disabled={i === passos.length - 1}
                      onClick={() => mover(i, 1)}
                      className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-secondary disabled:opacity-40"
                    >
                      <ArrowDown size={14} aria-hidden />
                    </button>
                    <button
                      type="button"
                      aria-label={t("Apagar passo")}
                      onClick={() =>
                        setRascunho({ ...rascunho, steps: passos.filter((_, j) => j !== i) })
                      }
                      className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-secondary hover:text-error-fg"
                    >
                      <Trash size={14} aria-hidden />
                    </button>
                  </div>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      )}

      {podeEditar ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={BOTAO}
            disabled={passos.length >= MAXIMO_DE_PASSOS}
            onClick={() =>
              setRascunho({
                ...rascunho,
                steps: [
                  ...passos,
                  PASSO_NOVO(passos.length > 0 ? passos[passos.length - 1]!.day_offset + 2 : 0),
                ],
              })
            }
          >
            <Plus size={14} aria-hidden />
            {t("Adicionar passo")}
          </button>
        </div>
      ) : null}

      <div className="grid gap-2 rounded-2xl border bg-card p-4 shadow-sm">
        <h3 className="text-sm font-semibold">{t("Se o lead não responder")}</h3>
        <p className="text-xs text-muted-foreground">
          {t("Depois do último passo o lead ainda tem {n} dias para responder.").replace(
            "{n}",
            String(DIAS_PARA_RESPONDER_DEPOIS_DO_ULTIMO_PASSO),
          )}
        </p>
        <SelectDoApp
          className={`${CAMPO} max-w-sm`}
          disabled={bloqueado}
          aria-label={t("Destino do lead sem resposta")}
          value={rascunho.end_action === "etapa" ? (rascunho.end_stage_id ?? "") : "perdido"}
          onChange={(e) =>
            e.target.value === "perdido"
              ? setRascunho({ ...rascunho, end_action: "perdido", end_stage_id: null })
              : setRascunho({ ...rascunho, end_action: "etapa", end_stage_id: e.target.value })
          }
        >
          <option value="perdido">{t("Mover para Perdido")}</option>
          {etapasDeDestino
            .filter((e) => !e.is_lost)
            .map((e) => (
              <option key={e.id} value={e.id}>
                {t("Mover para {etapa}").replace("{etapa}", e.name)}
              </option>
            ))}
        </SelectDoApp>
      </div>

      {podeEditar ? (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={BOTAO_CHEIO}
            disabled={!sujo || gravando}
            onClick={gravar}
          >
            {t("Salvar cadência")}
          </button>
          {sujo ? (
            <button type="button" className={BOTAO} onClick={() => setRascunho(original)}>
              {t("Descartar mudanças")}
            </button>
          ) : null}
          {!sujo && passos.length > 0 ? (
            <button
              type="button"
              className={BOTAO}
              onClick={async () => {
                const n = await inscreverQuemJaEstaEmAbordagem();
                if (n !== null) {
                  toast.success(
                    n === 0
                      ? t("Nenhum lead novo para inscrever.")
                      : t("{n} leads inscritos.").replace("{n}", String(n)),
                  );
                }
              }}
            >
              {t("Inscrever quem já está em Abordagem")}
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-3 rounded-2xl border bg-card p-4 shadow-sm">
        <h3 className="text-sm font-semibold">{t("Modelos da empresa")}</h3>
        {dados.modelos.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            {t(
              "Nenhum modelo ainda. Salve esta cadência como modelo para reaproveitar em outras campanhas.",
            )}
          </p>
        ) : (
          <ul className="grid gap-2">
            {dados.modelos.map((m) => (
              <li
                key={m.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2"
              >
                <span className="text-sm">
                  {m.name}{" "}
                  <span className="text-xs text-muted-foreground">
                    · {m.passos} {t("passos")}
                  </span>
                </span>
                {podeEditar ? (
                  <span className="flex gap-2">
                    <button
                      type="button"
                      className={BOTAO}
                      onClick={async () => {
                        if (
                          passos.length > 0 &&
                          !(await confirmar(
                            t("Trocar os passos desta cadência pelos do modelo?"),
                            t("Trocar"),
                          ))
                        ) {
                          return;
                        }
                        if (await aplicarModelo(m.id)) toast.success(t("Modelo aplicado."));
                      }}
                    >
                      {t("Usar nesta campanha")}
                    </button>
                    <button
                      type="button"
                      aria-label={t("Apagar modelo")}
                      className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground hover:bg-secondary hover:text-error-fg"
                      onClick={async () => {
                        if (await confirmar(t("Apagar este modelo?"), t("Apagar"))) {
                          await apagarModelo(m.id);
                        }
                      }}
                    >
                      <Trash size={14} aria-hidden />
                    </button>
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        {podeEditar && !sujo && passos.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            <input
              className={`${CAMPO} min-w-0 flex-1 sm:max-w-xs`}
              maxLength={160}
              placeholder={t("Nome do modelo")}
              aria-label={t("Nome do modelo")}
              value={nomeDoModelo}
              onChange={(e) => setNomeDoModelo(e.target.value)}
            />
            <button
              type="button"
              className={BOTAO}
              disabled={nomeDoModelo.trim().length === 0}
              onClick={async () => {
                if (await salvarComoModelo(nomeDoModelo.trim())) {
                  setNomeDoModelo("");
                  toast.success(t("Modelo salvo."));
                }
              }}
            >
              {t("Salvar como modelo")}
            </button>
          </div>
        ) : null}
      </div>
      {dialogo}
    </section>
  );
}
