"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { useT } from "@/hooks/i18n/useT";
import { Microphone, Play } from "@/lib/ui/icons";

const BOTAO =
  "inline-flex h-9 items-center justify-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors hover:bg-secondary disabled:opacity-50";

/** O formato que o navegador sabe gravar; o servidor converte webm em ogg (Opus) ao guardar. */
function formatoDaGravacao(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  return ["audio/ogg;codecs=opus", "audio/webm;codecs=opus", "audio/mp4"].find((m) =>
    MediaRecorder.isTypeSupported(m),
  );
}

const extensaoDe = (tipo: string) =>
  tipo.includes("ogg") ? "ogg" : tipo.includes("mp4") ? "m4a" : "webm";

/**
 * Grava a voz pelo microfone do navegador e entrega o arquivo para a biblioteca. Não envia nada a
 * ninguém: o áudio só sai quando o passo do fluxo roda e a pessoa aprova.
 */
export function GravadorDeAudio({
  aoGravar,
  ocupado,
}: {
  aoGravar: (arquivo: File, nome: string) => void;
  ocupado: boolean;
}) {
  const t = useT();
  const [gravando, setGravando] = useState(false);
  const [segundos, setSegundos] = useState(0);
  const [nome, setNome] = useState("");
  const gravador = useRef<MediaRecorder | null>(null);
  const fluxo = useRef<MediaStream | null>(null);
  const pedacos = useRef<Blob[]>([]);
  const descartar = useRef(false);

  useEffect(() => {
    if (!gravando) return;
    const relogio = setInterval(() => setSegundos((s) => s + 1), 1000);
    return () => clearInterval(relogio);
  }, [gravando]);

  const soltarMicrofone = () => {
    fluxo.current?.getTracks().forEach((faixa) => faixa.stop());
    fluxo.current = null;
  };

  // Sair da tela no meio da gravação não pode deixar o microfone aberto.
  useEffect(
    () => () => {
      descartar.current = true;
      if (gravador.current?.state === "recording") gravador.current.stop();
      soltarMicrofone();
    },
    [],
  );

  async function comecar() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      fluxo.current = stream;
      const formato = formatoDaGravacao();
      const rec = new MediaRecorder(stream, formato ? { mimeType: formato } : undefined);
      pedacos.current = [];
      descartar.current = false;
      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) pedacos.current.push(e.data);
      };
      rec.onstop = () => {
        soltarMicrofone();
        setGravando(false);
        setSegundos(0);
        if (descartar.current || pedacos.current.length === 0) return;
        const tipo = rec.mimeType || formato || "audio/webm";
        const blob = new Blob(pedacos.current, { type: tipo });
        const agora = new Date().toLocaleString("pt-BR", {
          dateStyle: "short",
          timeStyle: "short",
        });
        const titulo = nome.trim() || `${t("Gravação")} ${agora}`;
        aoGravar(new File([blob], `${titulo}.${extensaoDe(tipo)}`, { type: tipo }), titulo);
        setNome("");
      };
      gravador.current = rec;
      rec.start();
      setGravando(true);
    } catch {
      soltarMicrofone();
      toast.error(t("Não consegui acessar o microfone. Verifique a permissão do navegador."));
    }
  }

  const para = () => gravador.current?.stop();
  const cancela = () => {
    descartar.current = true;
    gravador.current?.stop();
  };
  const tempo = `${Math.floor(segundos / 60)}:${String(segundos % 60).padStart(2, "0")}`;

  if (typeof navigator !== "undefined" && !navigator.mediaDevices?.getUserMedia) return null;
  return (
    <div className="grid gap-2 rounded-xl border border-dashed p-3">
      {gravando ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-2 text-sm font-medium" role="status">
            <span className="size-2 animate-pulse rounded-full bg-error" aria-hidden />
            {t("Gravando")} {tempo}
          </span>
          <button type="button" className={BOTAO} onClick={para}>
            {t("Parar e guardar")}
          </button>
          <button type="button" className={BOTAO} onClick={cancela}>
            {t("Descartar")}
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <input
            className="h-9 min-w-40 flex-1 rounded-xl border bg-card px-3 text-sm outline-hidden focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
            maxLength={100}
            placeholder={t("Nome da gravação (opcional)")}
            aria-label={t("Nome da gravação")}
            value={nome}
            disabled={ocupado}
            onChange={(e) => setNome(e.target.value)}
          />
          <button type="button" className={BOTAO} disabled={ocupado} onClick={() => void comecar()}>
            <Microphone size={16} aria-hidden /> {t("Gravar agora")}
          </button>
        </div>
      )}
    </div>
  );
}

/** Ouvir um áudio da biblioteca: pede o endereço de vida curta só quando a pessoa clica. */
export function OuvirAudio({
  audioId,
  buscarUrl,
}: {
  audioId: string;
  buscarUrl: (id: string) => Promise<string>;
}) {
  const t = useT();
  const [url, setUrl] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [anterior, setAnterior] = useState(audioId);
  if (anterior !== audioId) {
    setAnterior(audioId);
    setUrl(null);
  }
  if (url) {
    return <audio controls autoPlay src={url} className="w-full" aria-label={t("Ouvir o áudio")} />;
  }
  return (
    <button
      type="button"
      className={`${BOTAO} w-fit`}
      disabled={carregando}
      onClick={() => {
        setCarregando(true);
        buscarUrl(audioId)
          .then(setUrl)
          .catch(() => undefined)
          .finally(() => setCarregando(false));
      }}
    >
      <Play size={16} aria-hidden /> {carregando ? t("Abrindo…") : t("Ouvir")}
    </button>
  );
}
