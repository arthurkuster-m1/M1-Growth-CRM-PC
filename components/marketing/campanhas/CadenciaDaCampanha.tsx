"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { CartaoDaAbordagem } from "@/components/marketing/campanhas/AbordagensDaCampanha";
import { FluxoDaAbordagem } from "@/components/marketing/campanhas/FluxoDaAbordagem";
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
import { Plus, Trash } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";

const CAMPO =
  "h-10 rounded-xl border bg-card px-3 text-sm outline-hidden focus:border-primary/60 focus:ring-2 focus:ring-primary/20 disabled:opacity-60";
const BOTAO =
  "inline-flex h-9 items-center justify-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors hover:bg-secondary disabled:opacity-50";
const BOTAO_CHEIO =
  "inline-flex h-9 items-center justify-center gap-2 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50";

/** Um passo em edição: a chave é só da tela (a ordem muda quando o dia muda). */
type PassoEditavel = PassoDaCadencia & { k: number };
interface Rascunho {
  end_action: EntradaDaCadencia["end_action"];
  end_stage_id: string | null;
  steps: PassoEditavel[];
}

const FIM = -1;
const rotuloDoDia = (dia: number) => (dia === 0 ? "D0" : `D+${dia}`);

function paraRascunho(e: EntradaDaCadencia): Rascunho {
  return { ...e, steps: e.steps.map((s, i) => ({ ...s, k: i + 1 })) };
}
const paraEntradaDaApi = (r: Rascunho): EntradaDaCadencia => ({
  end_action: r.end_action,
  end_stage_id: r.end_stage_id,
  steps: ordenarPassos(r.steps).map(({ k: _k, ...passo }) => passo),
});

/**
 * A CADÊNCIA da campanha de prospecção, página principal dela: uma LINHA DO TEMPO horizontal
 * (D0, D+2…) com um nó por passo; clicar no nó abre a configuração embaixo (dia, meio, abordagem,
 * observação). As abordagens nascem aqui, no passo, e se reaproveitam em outros passos. O lead que
 * entra em "Abordagem" começa a cadência; registrar contato a encerra; esgotar sem resposta leva ao
 * destino escolhido no último nó.
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
  const {
    abordagens,
    criar: criarAbordagem,
    editar: editarAbordagem,
    apagar: apagarAbordagem,
  } = useAbordagensDaCampanha(campanhaId);
  const [rascunho, setRascunho] = useState<Rascunho | null>(null);
  const [aberto, setAberto] = useState<number | null>(null);
  const [nomeDoModelo, setNomeDoModelo] = useState("");
  const [nomeDaNova, setNomeDaNova] = useState("");
  const [gravando, setGravando] = useState(false);
  const proximaChave = useRef(1000);
  const abordagensRef = useRef<HTMLDivElement | null>(null);

  const original = dados ? paraEntrada(dados.cadencia) : null;
  useEffect(() => {
    if (original) setRascunho(paraRascunho(original));
    // O servidor mudou (salvou, aplicou modelo): o rascunho recomeça dele.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dados]);

  if (carregando || !dados || !rascunho || !original) {
    return <p className="text-sm text-muted-foreground">{t("Carregando…")}</p>;
  }
  const sujo = JSON.stringify(paraEntradaDaApi(rascunho)) !== JSON.stringify(original);
  const bloqueado = !podeEditar;
  const passos = rascunho.steps;
  const ordenados = [...passos].sort((a, b) => a.day_offset - b.day_offset);
  const selecionado = aberto === FIM ? null : (passos.find((p) => p.k === aberto) ?? null);
  const abordagemPorId = new Map(abordagens.map((a) => [a.id, a] as const));
  const nomeDoDestino =
    rascunho.end_action === "etapa"
      ? (dados.etapas.find((e) => e.id === rascunho.end_stage_id)?.name ?? t("uma etapa"))
      : t("Perdido");

  const trocar = (k: number, p: Partial<PassoDaCadencia>) =>
    setRascunho({ ...rascunho, steps: passos.map((x) => (x.k === k ? { ...x, ...p } : x)) });
  const adicionar = () => {
    const k = proximaChave.current++;
    const ultimo = ordenados[ordenados.length - 1];
    setRascunho({
      ...rascunho,
      steps: [
        ...passos,
        {
          k,
          day_offset: ultimo ? ultimo.day_offset + 2 : 0,
          medium: ultimo?.medium ?? "whatsapp",
          approach_id: null,
          note: "",
        },
      ],
    });
    setAberto(k);
  };
  const gravar = async () => {
    setGravando(true);
    const certo = await salvar(paraEntradaDaApi(rascunho));
    setGravando(false);
    if (certo) toast.success(t("Cadência salva."));
  };
  const etapasDeDestino = dados.etapas.filter((e) => !e.is_won);
  const usos = (id: string) =>
    ordenados.filter((p) => p.approach_id === id).map((p) => rotuloDoDia(p.day_offset));
  const linkDoCrm = dados.cadencia.funil_id
    ? `/app/clientes?visao=oportunidades&funil=${dados.cadencia.funil_id}&cadencia=ativa`
    : "/app/clientes?visao=oportunidades&cadencia=ativa";

  return (
    <section className="grid min-w-0 gap-4">
      <div className="grid gap-1 rounded-2xl border bg-card p-4 shadow-sm">
        <h2 className="text-base font-semibold">{t("Cadência de abordagem")}</h2>
        <p className="text-sm text-muted-foreground">
          {t(
            "Todo lead que passa para a etapa Abordagem começa esta cadência. Registrar um contato a encerra; se o último passo passar sem resposta, o lead vai para o destino escolhido no fim.",
          )}
        </p>
        {dados.cadencia.ativos > 0 ? (
          <Link href={linkDoCrm} className="w-fit text-sm font-medium text-primary hover:underline">
            {t("{n} leads em cadência agora — ver no CRM").replace(
              "{n}",
              String(dados.cadencia.ativos),
            )}
          </Link>
        ) : (
          <p className="text-xs text-muted-foreground">{t("Nenhum lead em cadência agora.")}</p>
        )}
      </div>

      <div className="overflow-x-auto rounded-2xl border bg-card p-4 shadow-sm">
        <ol
          className="flex min-w-max items-start gap-0"
          aria-label={t("Linha do tempo da cadência")}
        >
          {ordenados.map((p, i) => {
            const ab = p.approach_id ? abordagemPorId.get(p.approach_id) : null;
            const indice = i;
            const leads = dados.cadencia.por_passo[indice] ?? 0;
            const ativo = aberto === p.k;
            return (
              <li key={p.k} className="flex items-start">
                <button
                  type="button"
                  aria-pressed={ativo}
                  onClick={() => setAberto(ativo ? null : p.k)}
                  className={cn(
                    "grid w-36 justify-items-center gap-1 rounded-2xl border px-3 py-3 text-center transition-colors",
                    ativo ? "border-primary bg-primary/10" : "hover:bg-secondary",
                  )}
                >
                  <span className="grid h-10 min-w-10 place-items-center rounded-full bg-primary px-2 font-mono text-xs font-semibold text-primary-foreground">
                    {rotuloDoDia(p.day_offset)}
                  </span>
                  <span className="text-xs font-medium">{rotuloDoMeio(t, p.medium)}</span>
                  <span className="line-clamp-2 min-h-8 text-[11px] text-muted-foreground">
                    {ab?.name ?? t("sem abordagem")}
                  </span>
                  {leads > 0 ? (
                    <span className="rounded-full bg-secondary px-2 text-[11px] font-semibold tabular-nums">
                      {leads} {leads === 1 ? t("lead") : t("leads")}
                    </span>
                  ) : null}
                </button>
                <span aria-hidden className="mt-9 h-px w-6 shrink-0 bg-border" />
              </li>
            );
          })}
          <li className="flex items-start">
            <button
              type="button"
              aria-pressed={aberto === FIM}
              onClick={() => setAberto(aberto === FIM ? null : FIM)}
              className={cn(
                "grid w-36 justify-items-center gap-1 rounded-2xl border border-dashed px-3 py-3 text-center transition-colors",
                aberto === FIM ? "border-primary bg-primary/10" : "hover:bg-secondary",
              )}
            >
              <span className="grid h-10 min-w-10 place-items-center rounded-full bg-secondary px-2 text-xs font-semibold">
                {t("Fim")}
              </span>
              <span className="text-xs font-medium">{t("Sem resposta")}</span>
              <span className="line-clamp-2 min-h-8 text-[11px] text-muted-foreground">
                → {nomeDoDestino}
              </span>
              {dados.cadencia.aguardando > 0 ? (
                <span className="rounded-full bg-secondary px-2 text-[11px] font-semibold tabular-nums">
                  {dados.cadencia.aguardando} {t("aguardando")}
                </span>
              ) : null}
            </button>
            {podeEditar && passos.length < MAXIMO_DE_PASSOS ? (
              <>
                <span aria-hidden className="mt-9 h-px w-6 shrink-0 bg-border" />
                <button
                  type="button"
                  aria-label={t("Adicionar passo")}
                  onClick={adicionar}
                  className="mt-4 grid h-10 w-10 shrink-0 place-items-center rounded-full border border-dashed text-muted-foreground hover:bg-secondary"
                >
                  <Plus size={16} aria-hidden />
                </button>
              </>
            ) : null}
          </li>
        </ol>
        {passos.length === 0 ? (
          <p className="mt-3 text-center text-sm text-muted-foreground">
            {t("Ainda não há passos. Adicione o primeiro (+) ou use um modelo.")}
          </p>
        ) : null}
      </div>

      {selecionado ? (
        <div className="grid gap-3 rounded-2xl border border-primary/30 bg-card p-4 shadow-sm">
          <h3 className="text-sm font-semibold">
            {t("Passo")} {rotuloDoDia(selecionado.day_offset)}
          </h3>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-[7rem_minmax(0,1fr)_minmax(0,1fr)]">
            <label className="grid gap-1 text-xs text-muted-foreground">
              {t("Dia (D+)")}
              <input
                type="number"
                min={0}
                max={365}
                className={CAMPO}
                disabled={bloqueado}
                value={selecionado.day_offset}
                onChange={(e) =>
                  trocar(selecionado.k, {
                    day_offset: Math.min(365, Math.max(0, Math.floor(Number(e.target.value) || 0))),
                  })
                }
              />
            </label>
            <label className="grid gap-1 text-xs text-muted-foreground">
              {t("Meio de contato")}
              <SelectDoApp
                className={CAMPO}
                disabled={bloqueado}
                value={selecionado.medium}
                onChange={(e) =>
                  trocar(selecionado.k, { medium: e.target.value as PassoDaCadencia["medium"] })
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
                value={selecionado.approach_id ?? ""}
                onChange={(e) => trocar(selecionado.k, { approach_id: e.target.value || null })}
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
          {podeEditar ? (
            <div className="flex flex-wrap items-center gap-2">
              <input
                className={`${CAMPO} min-w-0 flex-1 sm:max-w-xs`}
                maxLength={160}
                placeholder={t("Nome de uma nova abordagem")}
                aria-label={t("Nome de uma nova abordagem")}
                value={nomeDaNova}
                onChange={(e) => setNomeDaNova(e.target.value)}
              />
              <button
                type="button"
                className={BOTAO}
                disabled={nomeDaNova.trim().length === 0}
                onClick={async () => {
                  const nova = await criarAbordagem({
                    name: nomeDaNova.trim(),
                    medium: selecionado.medium,
                  });
                  if (nova) {
                    trocar(selecionado.k, { approach_id: nova.id });
                    setNomeDaNova("");
                    toast.success(t("Abordagem criada. Escreva o roteiro dela abaixo."));
                    abordagensRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }
                }}
              >
                <Plus size={14} aria-hidden />
                {t("Criar abordagem para este passo")}
              </button>
            </div>
          ) : null}
          <input
            className={`${CAMPO} w-full`}
            disabled={bloqueado}
            maxLength={500}
            placeholder={t("Observação do passo (opcional)")}
            aria-label={t("Observação")}
            value={selecionado.note}
            onChange={(e) => trocar(selecionado.k, { note: e.target.value })}
          />
          {podeEditar ? (
            <div className="flex justify-end">
              <button
                type="button"
                aria-label={t("Apagar passo")}
                className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground hover:bg-secondary hover:text-error-fg"
                onClick={() => {
                  setRascunho({ ...rascunho, steps: passos.filter((x) => x.k !== selecionado.k) });
                  setAberto(null);
                }}
              >
                <Trash size={16} aria-hidden />
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {aberto === FIM ? (
        <div className="grid gap-2 rounded-2xl border border-primary/30 bg-card p-4 shadow-sm">
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
      ) : null}

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
            <button
              type="button"
              className={BOTAO}
              onClick={() => {
                setRascunho(paraRascunho(original));
                setAberto(null);
              }}
            >
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

      <div
        ref={abordagensRef}
        className="grid scroll-mt-4 gap-3 rounded-2xl border bg-card p-4 shadow-sm"
      >
        <h3 className="text-sm font-semibold">{t("Abordagens da campanha")}</h3>
        <p className="text-xs text-muted-foreground">
          {t(
            "O roteiro de cada abordagem. A mesma abordagem pode ser usada em vários passos. Ligação é só o roteiro; no WhatsApp você também desenha o fluxo de conversa.",
          )}
        </p>
        {abordagens.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("Ainda não há abordagens. Crie uma a partir de um passo.")}
          </p>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {abordagens.map((a) => (
              <div key={a.id} className="grid gap-1">
                <p className="text-xs text-muted-foreground">
                  {usos(a.id).length > 0
                    ? `${t("Usada em")} ${usos(a.id).join(", ")}`
                    : t("Ainda não usada em nenhum passo")}
                </p>
                <CartaoDaAbordagem
                  a={a}
                  podeEditar={podeEditar}
                  editar={(patch) => void editarAbordagem(a.id, patch)}
                  apagar={() => void apagarAbordagem(a.id)}
                />
                {a.medium === "whatsapp" ? (
                  <FluxoDaAbordagem
                    campanhaId={campanhaId}
                    abordagemId={a.id}
                    ideiaCentral={a.central_idea ?? ""}
                    podeEditar={podeEditar}
                    aoEditarIdeia={(central_idea) => void editarAbordagem(a.id, { central_idea })}
                  />
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>

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
