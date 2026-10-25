"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { CaixaRedonda } from "@/components/ui/CaixaRedonda";
import { useAudiosDaAbordagem } from "@/hooks/marketing/useAudiosDaAbordagem";
import { useFluxoDaAbordagem } from "@/hooks/marketing/useCadencia";
import { useT } from "@/hooks/i18n/useT";
import {
  MAXIMO_DE_PASSOS_DO_FLUXO,
  PASSO_NOVO_DO_FLUXO,
  TIPOS_DE_PASSO_DO_FLUXO,
  avisosDoFluxo,
  continuarAposResposta,
  simularConversa,
  type EstadoDaSimulacao,
  type PassoDoFluxo,
  type TipoDePassoDoFluxo,
} from "@/lib/cadencia/fluxo-da-abordagem";
import {
  ArrowRight,
  ChatCircle,
  Clock,
  Microphone,
  Play,
  Sparkle,
  Trash,
  UserCircle,
} from "@/lib/ui/icons";
import { cn } from "@/lib/utils";

const CAMPO =
  "h-10 rounded-xl border bg-card px-3 text-sm outline-hidden focus:border-primary/60 focus:ring-2 focus:ring-primary/20 disabled:opacity-60";
const AREA =
  "w-full rounded-xl border bg-card px-3 py-2 text-sm outline-hidden focus:border-primary/60 focus:ring-2 focus:ring-primary/20 disabled:opacity-60";
const BOTAO =
  "inline-flex h-9 items-center justify-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors hover:bg-secondary disabled:opacity-50";
const BOTAO_CHEIO =
  "inline-flex h-9 items-center justify-center gap-2 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50";

const ICONE: Record<TipoDePassoDoFluxo, React.ReactNode> = {
  mensagem: <ChatCircle size={18} aria-hidden />,
  audio: <Microphone size={18} aria-hidden />,
  aguardar: <Clock size={18} aria-hidden />,
  encaminhar: <UserCircle size={18} aria-hidden />,
};

type PassoEditavel = PassoDoFluxo & { k: number };
const paraEditavel = (p: PassoDoFluxo[]): PassoEditavel[] => p.map((x, i) => ({ ...x, k: i + 1 }));
const semChave = (p: PassoEditavel[]): PassoDoFluxo[] => p.map(({ k: _k, ...resto }) => resto);

/**
 * O FLUXO DE CONVERSA da abordagem de WhatsApp: cartões ligados por setas — mensagem, áudio
 * gravado, aguardar a resposta, encaminhar ao atendente — mais a SIMULAÇÃO do que sairia. Nada é
 * enviado: o desenho é o que a execução (com aprovação de cada disparo) vai seguir.
 */
export function FluxoDaAbordagem({
  campanhaId,
  abordagemId,
  ideiaCentral,
  podeEditar,
  aoEditarIdeia,
}: {
  campanhaId: string;
  abordagemId: string;
  ideiaCentral: string;
  podeEditar: boolean;
  aoEditarIdeia: (ideia: string) => void;
}) {
  const t = useT();
  const { passos: salvos, carregando, salvar } = useFluxoDaAbordagem(campanhaId, abordagemId);
  const { audios, enviar: enviarAudio } = useAudiosDaAbordagem(true);
  const [aberto, setAberto] = useState(false);
  const [rascunho, setRascunho] = useState<PassoEditavel[] | null>(null);
  const [selecionado, setSelecionado] = useState<number | null>(null);
  const [ideia, setIdeia] = useState(ideiaCentral);
  const [simulacao, setSimulacao] = useState<EstadoDaSimulacao | null>(null);
  const [gravando, setGravando] = useState(false);
  const [proxima, setProxima] = useState(1000);

  useEffect(() => setIdeia(ideiaCentral), [ideiaCentral]);
  useEffect(() => {
    if (salvos) setRascunho(paraEditavel(salvos));
  }, [salvos]);

  const contexto = { nomeDoLead: t("Maria (exemplo)"), ideiaCentral: ideia };
  const resumo =
    salvos === null
      ? ""
      : salvos.length === 0
        ? t("sem fluxo desenhado")
        : `${salvos.length} ${salvos.length === 1 ? t("passo") : t("passos")}`;

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="flex w-full items-center justify-between gap-2 rounded-2xl border border-dashed px-4 py-3 text-left text-sm hover:bg-secondary"
      >
        <span className="font-medium">{t("Fluxo de conversa do WhatsApp")}</span>
        <span className="text-xs text-muted-foreground">{carregando ? "…" : resumo}</span>
      </button>
    );
  }
  if (carregando || !rascunho || !salvos) {
    return <p className="text-sm text-muted-foreground">{t("Carregando…")}</p>;
  }

  const passoAberto = rascunho.find((p) => p.k === selecionado) ?? null;
  const sujo = JSON.stringify(semChave(rascunho)) !== JSON.stringify(salvos);
  const avisos = avisosDoFluxo(semChave(rascunho), ideia);
  const bloqueado = !podeEditar;
  const trocar = (k: number, patch: Partial<PassoDoFluxo>) =>
    setRascunho(rascunho.map((p) => (p.k === k ? { ...p, ...patch } : p)));
  const adicionar = (kind: TipoDePassoDoFluxo) => {
    if (rascunho.length >= MAXIMO_DE_PASSOS_DO_FLUXO) return;
    const k = proxima;
    setProxima(k + 1);
    const novo = { ...PASSO_NOVO_DO_FLUXO(kind), k };
    const depoisDe = rascunho.findIndex((p) => p.k === selecionado);
    const lista = [...rascunho];
    lista.splice(depoisDe >= 0 ? depoisDe + 1 : lista.length, 0, novo);
    setRascunho(lista);
    setSelecionado(k);
    setSimulacao(null);
  };
  const mover = (k: number, d: -1 | 1) => {
    const i = rascunho.findIndex((p) => p.k === k);
    const j = i + d;
    if (i < 0 || j < 0 || j >= rascunho.length) return;
    const lista = [...rascunho];
    [lista[i], lista[j]] = [lista[j]!, lista[i]!];
    setRascunho(lista);
    setSimulacao(null);
  };
  const rotulo = (k: TipoDePassoDoFluxo) =>
    k === "mensagem"
      ? t("Mensagem")
      : k === "audio"
        ? t("Áudio")
        : k === "aguardar"
          ? t("Aguardar resposta")
          : t("Encaminhar ao atendente");
  const resumoDoCartao = (p: PassoDoFluxo) =>
    p.kind === "mensagem"
      ? p.ai_personalize
        ? t("A IA personaliza")
        : p.body || t("(vazia)")
      : p.kind === "audio"
        ? p.audio_label || t("(sem nome)")
        : p.kind === "aguardar"
          ? p.wait_hours
            ? `${t("até")} ${p.wait_hours} h`
            : t("sem prazo")
          : t("Entrega a conversa");

  return (
    <div className="grid gap-3 rounded-2xl border border-primary/30 p-3">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-semibold">{t("Fluxo de conversa do WhatsApp")}</h4>
        <button type="button" className={BOTAO} onClick={() => setAberto(false)}>
          {t("Fechar")}
        </button>
      </div>

      <label className="grid gap-1 text-xs text-muted-foreground">
        {t("Ideia central (a IA escreve a mensagem de cada lead a partir dela)")}
        <textarea
          rows={3}
          maxLength={1500}
          disabled={bloqueado}
          className={AREA}
          value={ideia}
          onChange={(e) => setIdeia(e.target.value)}
          onBlur={() => ideia !== ideiaCentral && aoEditarIdeia(ideia)}
        />
      </label>

      <div className="overflow-x-auto">
        <ol className="flex min-w-max items-center gap-0" aria-label={t("Fluxo de conversa")}>
          <li className="flex items-center">
            <span className="grid h-10 place-items-center rounded-full bg-secondary px-3 text-xs font-semibold">
              {t("Início")}
            </span>
            <ArrowRight size={14} className="mx-1 text-muted-foreground" aria-hidden />
          </li>
          {rascunho.map((p, i) => (
            <li key={p.k} className="flex items-center">
              <button
                type="button"
                aria-pressed={selecionado === p.k}
                onClick={() => setSelecionado(selecionado === p.k ? null : p.k)}
                className={cn(
                  "grid w-36 gap-1 rounded-2xl border px-3 py-2 text-left transition-colors",
                  selecionado === p.k ? "border-primary bg-primary/10" : "hover:bg-secondary",
                )}
              >
                <span className="flex items-center gap-1.5 text-xs font-semibold">
                  {ICONE[p.kind]}
                  {rotulo(p.kind)}
                </span>
                <span className="line-clamp-2 min-h-8 text-[11px] text-muted-foreground">
                  {resumoDoCartao(p)}
                </span>
              </button>
              {i < rascunho.length - 1 ? (
                <ArrowRight size={14} className="mx-1 text-muted-foreground" aria-hidden />
              ) : null}
            </li>
          ))}
        </ol>
        {rascunho.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            {t("Comece pelo primeiro passo: em geral a mensagem de abertura.")}
          </p>
        ) : null}
      </div>

      {podeEditar ? (
        <div className="flex flex-wrap gap-2">
          {TIPOS_DE_PASSO_DO_FLUXO.map((k) => (
            <button
              key={k}
              type="button"
              className={BOTAO}
              disabled={rascunho.length >= MAXIMO_DE_PASSOS_DO_FLUXO}
              onClick={() => adicionar(k)}
            >
              {ICONE[k]}+ {rotulo(k)}
            </button>
          ))}
        </div>
      ) : null}

      {passoAberto ? (
        <div className="grid gap-2 rounded-xl border bg-card p-3">
          <p className="text-sm font-semibold">{rotulo(passoAberto.kind)}</p>
          {passoAberto.kind === "mensagem" ? (
            <>
              <label className="flex items-center gap-2 text-sm">
                <CaixaRedonda
                  disabled={bloqueado}
                  checked={passoAberto.ai_personalize}
                  onChange={(e) => trocar(passoAberto.k, { ai_personalize: e.target.checked })}
                />
                <Sparkle size={14} aria-hidden />
                {t("A IA escreve uma mensagem diferente para cada lead")}
              </label>
              <textarea
                rows={3}
                maxLength={1500}
                disabled={bloqueado}
                className={AREA}
                placeholder={
                  passoAberto.ai_personalize
                    ? t("Instrução extra para a IA (opcional)")
                    : t("Texto da mensagem. Use {{primeiro_nome}}.")
                }
                value={passoAberto.body}
                onChange={(e) => trocar(passoAberto.k, { body: e.target.value })}
              />
            </>
          ) : null}
          {passoAberto.kind === "audio" ? (
            <div className="grid gap-2">
              <select
                className={`${CAMPO} w-full`}
                disabled={bloqueado}
                aria-label={t("Áudio gravado")}
                value={passoAberto.audio_id ?? ""}
                onChange={(e) => {
                  const escolhido = audios.find((a) => a.id === e.target.value);
                  trocar(passoAberto.k, {
                    audio_id: escolhido?.id ?? null,
                    audio_label: escolhido?.name ?? "",
                  });
                }}
              >
                <option value="">{t("Escolha um áudio gravado")}</option>
                {audios.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
              {passoAberto.audio_id && !audios.some((a) => a.id === passoAberto.audio_id) ? (
                <p className="text-xs text-warning-fg">
                  {t("O arquivo deste passo saiu da biblioteca. Escolha outro ou envie de novo.")}
                </p>
              ) : null}
              {!bloqueado ? (
                <label className={`${BOTAO} w-fit cursor-pointer`}>
                  <Microphone size={16} aria-hidden />
                  {enviarAudio.isPending ? t("Enviando…") : t("Enviar arquivo de voz")}
                  <input
                    type="file"
                    accept="audio/*,.ogg,.opus,.mp3,.m4a,.wav,.aac,.amr"
                    className="sr-only"
                    disabled={enviarAudio.isPending}
                    onChange={(e) => {
                      const arquivo = e.target.files?.[0];
                      e.target.value = "";
                      if (!arquivo) return;
                      enviarAudio.mutate(
                        { file: arquivo },
                        {
                          onSuccess: (novo) => {
                            trocar(passoAberto.k, { audio_id: novo.id, audio_label: novo.name });
                            toast.success(t("Áudio guardado na biblioteca."));
                          },
                        },
                      );
                    }}
                  />
                </label>
              ) : null}
              <p className="text-xs text-muted-foreground">
                {t(
                  "Grave o áudio no celular, envie o arquivo aqui e reutilize em outras abordagens. Vai até 8 MB.",
                )}
              </p>
            </div>
          ) : null}
          {passoAberto.kind === "aguardar" ? (
            <label className="flex flex-wrap items-center gap-2 text-sm">
              {t("Esperar a resposta por até")}
              <input
                type="number"
                min={1}
                max={720}
                disabled={bloqueado}
                className={`${CAMPO} w-24 tabular-nums`}
                value={passoAberto.wait_hours ?? ""}
                onChange={(e) =>
                  trocar(passoAberto.k, {
                    wait_hours: e.target.value
                      ? Math.min(720, Math.max(1, Math.floor(Number(e.target.value))))
                      : null,
                  })
                }
              />
              {t("horas (vazio = sem prazo)")}
            </label>
          ) : null}
          {passoAberto.kind === "encaminhar" ? (
            <p className="text-sm text-muted-foreground">
              {t("A conversa passa para o atendente responsável pelo lead.")}
            </p>
          ) : null}
          {podeEditar ? (
            <div className="flex items-center justify-end gap-1">
              <button type="button" className={BOTAO} onClick={() => mover(passoAberto.k, -1)}>
                ←
              </button>
              <button type="button" className={BOTAO} onClick={() => mover(passoAberto.k, 1)}>
                →
              </button>
              <button
                type="button"
                aria-label={t("Apagar passo")}
                className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground hover:bg-secondary hover:text-error-fg"
                onClick={() => {
                  setRascunho(rascunho.filter((p) => p.k !== passoAberto.k));
                  setSelecionado(null);
                  setSimulacao(null);
                }}
              >
                <Trash size={16} aria-hidden />
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {avisos.length > 0 ? (
        <ul className="grid gap-1 rounded-xl bg-secondary px-3 py-2 text-xs text-muted-foreground">
          {avisos.map((a) => (
            <li key={a}>• {t(a)}</li>
          ))}
        </ul>
      ) : null}

      {podeEditar ? (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={BOTAO_CHEIO}
            disabled={!sujo || gravando}
            onClick={async () => {
              setGravando(true);
              const certo = await salvar(semChave(rascunho));
              setGravando(false);
              if (certo) toast.success(t("Fluxo salvo."));
            }}
          >
            {t("Salvar fluxo")}
          </button>
          {sujo ? (
            <button
              type="button"
              className={BOTAO}
              onClick={() => {
                setRascunho(paraEditavel(salvos));
                setSimulacao(null);
              }}
            >
              {t("Descartar mudanças")}
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-2 rounded-xl border bg-secondary/40 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold">{t("Simulação (nada é enviado)")}</p>
          <button
            type="button"
            className={BOTAO}
            disabled={rascunho.length === 0}
            onClick={() => setSimulacao(simularConversa(semChave(rascunho), contexto))}
          >
            <Play size={14} aria-hidden />
            {simulacao ? t("Recomeçar") : t("Simular")}
          </button>
        </div>
        {simulacao ? (
          <>
            <ul className="grid gap-1.5" aria-label={t("Conversa simulada")}>
              {simulacao.bolhas.map((b, i) => (
                <li
                  key={i}
                  className={cn(
                    "max-w-[85%] rounded-2xl px-3 py-2 text-sm",
                    b.de === "nos" && "bg-primary/10",
                    b.de === "lead" && "ml-auto bg-card",
                    b.de === "sistema" && "bg-transparent text-xs text-muted-foreground",
                  )}
                >
                  {b.texto}
                </li>
              ))}
            </ul>
            {simulacao.esperandoEm !== null ? (
              <button
                type="button"
                className={`${BOTAO} w-fit`}
                onClick={() =>
                  setSimulacao(continuarAposResposta(semChave(rascunho), contexto, simulacao))
                }
              >
                {t("O lead respondeu")}
              </button>
            ) : (
              <p className="text-xs text-muted-foreground">{t("Fim do fluxo.")}</p>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}
