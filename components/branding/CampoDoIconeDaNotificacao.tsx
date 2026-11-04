"use client";

/**
 * O campo do ÍCONE DA NOTIFICAÇÃO — a imagem de onde sai a silhueta que o Android desenha na barra
 * de status. Subir, ver e remover. Só na instalação.
 *
 * É uma imagem À PARTE do ícone do aplicativo: o ícone do app é um ladrilho com fundo (a "fotinho"
 * do app no celular), e a silhueta dele seria um quadrado cheio. Aqui vai o logo SEM ladrilho — de
 * fundo branco ou transparente; o fundo some e o desenho vira branco. Sem arquivo, vale o logo de
 * fundo branco subido no campo de cima.
 *
 * Mesma rota do logo (`/api/v1/marca/logo`, `peca=notificacao`): gate, teto, farejador de bytes
 * (PNG ou JPG, SVG recusado) e a ordem sobe → grava → apaga. A prévia mostra a silhueta REAL
 * (`/notification-badge`) sobre fundo escuro, como a barra de status a pinta.
 */

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { TAMANHO_MAXIMO_DO_LOGO } from "@/lib/branding/logo";
import { useT } from "@/hooks/i18n/useT";

interface Props {
  /** A imagem da notificação gravada, já como URL pública. `url: null` = nenhuma. */
  readonly iconeDaCamada: { readonly url: string | null };
  /** O logo de fundo branco em vigor (a alternativa quando não há imagem própria). */
  readonly logoDeFundoBranco: string | null;
}

const ERRO_EM_PORTUGUES: Record<string, string> = {
  unauthenticated: "Sua sessão expirou. Entre de novo para trocar o ícone da notificação.",
  forbidden_role: "Você não tem permissão para trocar o ícone da notificação.",
  mfa_required: "Confirme o segundo fator nesta sessão e tente de novo.",
  rate_limited: "Muitas trocas seguidas. Tente de novo em alguns minutos.",
};

export function CampoDoIconeDaNotificacao({ iconeDaCamada, logoDeFundoBranco }: Props) {
  const t = useT();
  const router = useRouter();
  const entrada = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);
  const [, startTransition] = useTransition();
  const [gravado, setGravado] = useState<string | null>(iconeDaCamada.url);
  const [ultimoDoServidor, setUltimoDoServidor] = useState(iconeDaCamada);
  // Muda a cada troca: obriga o navegador a buscar a silhueta nova (a rota tem cache de 60 s).
  const [versao, setVersao] = useState(() => Date.now());
  if (iconeDaCamada !== ultimoDoServidor) {
    setUltimoDoServidor(iconeDaCamada);
    setGravado(iconeDaCamada.url);
  }

  async function razaoDaFalha(resposta: Response): Promise<string> {
    const corpo = (await resposta.json().catch(() => null)) as {
      error?: { code?: string; message?: string };
    } | null;
    return t(
      ERRO_EM_PORTUGUES[corpo?.error?.code ?? ""] ??
        corpo?.error?.message ??
        "Não consegui trocar o ícone da notificação agora.",
    );
  }

  async function urlDaResposta(resposta: Response): Promise<string | null | undefined> {
    const corpo = (await resposta.json().catch(() => null)) as {
      data?: { logo_url?: string | null };
    } | null;
    return corpo?.data?.logo_url;
  }

  async function enviar(arquivo: File) {
    setEnviando(true);
    try {
      const corpo = new FormData();
      corpo.set("escopo", "instalacao");
      corpo.set("peca", "notificacao");
      corpo.set("file", arquivo);
      const resposta = await fetch("/api/v1/marca/logo", { method: "POST", body: corpo });
      if (!resposta.ok) {
        toast.error(await razaoDaFalha(resposta));
        return;
      }
      toast.success(t("Ícone da notificação atualizado."));
      const url = await urlDaResposta(resposta);
      if (url !== undefined) setGravado(url);
      setVersao(Date.now());
      startTransition(() => router.refresh());
    } finally {
      setEnviando(false);
      if (entrada.current) entrada.current.value = "";
    }
  }

  async function remover() {
    setEnviando(true);
    try {
      const resposta = await fetch("/api/v1/marca/logo?escopo=instalacao&peca=notificacao", {
        method: "DELETE",
      });
      if (!resposta.ok) {
        toast.error(await razaoDaFalha(resposta));
        return;
      }
      toast.success(t("Ícone da notificação removido."));
      const url = await urlDaResposta(resposta);
      if (url !== undefined) setGravado(url);
      setVersao(Date.now());
      startTransition(() => router.refresh());
    } finally {
      setEnviando(false);
    }
  }

  const usando = gravado ? "arquivo" : logoDeFundoBranco ? "logo" : "inicial";

  return (
    <div className="space-y-2" data-campo-do-icone-da-notificacao="">
      <Label htmlFor="icone-da-notificacao">{t("Ícone da notificação")}</Label>
      <div className="flex flex-wrap items-center gap-3">
        {/* A prévia é a silhueta que o Android vai pintar: branco sobre fundo escuro. */}
        <div
          data-previa-da-notificacao={usando}
          className="flex size-10 shrink-0 items-center justify-center rounded-sm bg-neutral-800"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/notification-badge?v=${versao}`}
            alt={t("Ícone da notificação")}
            className="size-7 object-contain"
          />
        </div>
        <input
          ref={entrada}
          id="icone-da-notificacao"
          type="file"
          accept="image/png,image/jpeg"
          disabled={enviando}
          onChange={(e) => {
            const arquivo = e.target.files?.[0];
            if (arquivo) void enviar(arquivo);
          }}
          className="max-w-xs text-sm file:mr-3 file:cursor-pointer file:rounded-xl file:border file:border-border file:bg-surface-elevated file:px-3 file:py-1.5 file:text-sm"
        />
        {gravado ? (
          <Button
            type="button"
            variant="outline"
            onClick={() => void remover()}
            disabled={enviando}
          >
            {t("Usar o logo de fundo branco")}
          </Button>
        ) : null}
      </div>
      <p className="text-xs text-text-muted">
        {usando === "arquivo"
          ? t("Usando a imagem enviada aqui.")
          : usando === "logo"
            ? t("Sem imagem própria: usando o logo de fundo branco enviado acima.")
            : t("Sem imagem e sem logo: usando a inicial do nome.")}{" "}
        {t(
          "Envie o logo de fundo branco ou transparente, sem moldura de app: o fundo some e o desenho vira branco na barra de status. PNG ou JPG, até",
        )}{" "}
        {Math.round(TAMANHO_MAXIMO_DO_LOGO / 1024)} KB.
      </p>
    </div>
  );
}
