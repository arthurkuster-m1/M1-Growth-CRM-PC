"use client";

import { useRef, useState } from "react";

import { useT } from "@/hooks/i18n/useT";
import { BASE_DAS_IMAGENS_DO_PAINEL, TAMANHO_MAXIMO_DA_IMAGEM } from "@/lib/marketing/imagens";
import { Plus } from "@/lib/ui/icons";

/**
 * Escolher uma imagem do computador (ou da galeria do celular): sobe na hora, mostra a prévia e
 * devolve só o NOME do arquivo. Troca e remoção são do bloco — o arquivo antigo fica no bucket
 * (poucos KB de custo; apagar exigiria saber se outra página ainda o usa).
 */
export function SeletorDeImagem({
  arquivo,
  aoMudar,
}: {
  arquivo: string;
  aoMudar: (arquivo: string) => void;
}) {
  const t = useT();
  const entrada = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function enviar(file: File) {
    setErro(null);
    if (file.size > TAMANHO_MAXIMO_DA_IMAGEM) {
      setErro(t("A imagem precisa ter até 5 MB."));
      return;
    }
    setEnviando(true);
    try {
      const form = new FormData();
      form.set("file", file);
      const resposta = await fetch("/api/v1/marketing/imagens", { method: "POST", body: form });
      const corpo = (await resposta.json().catch(() => null)) as {
        data?: { arquivo?: string };
        error?: { message?: string };
      } | null;
      if (!resposta.ok || !corpo?.data?.arquivo) {
        setErro(corpo?.error?.message ?? t("Erro ao enviar a imagem."));
        return;
      }
      aoMudar(corpo.data.arquivo);
    } catch {
      setErro(t("Erro ao enviar a imagem."));
    } finally {
      setEnviando(false);
      if (entrada.current) entrada.current.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {arquivo ? (
        // eslint-disable-next-line @next/next/no-img-element -- prévia da imagem da agência
        <img
          src={`${BASE_DAS_IMAGENS_DO_PAINEL}${arquivo}`}
          alt=""
          className="max-h-48 w-fit max-w-full rounded-xl border object-contain"
        />
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={entrada}
          type="file"
          accept="image/png,image/jpeg"
          className="sr-only"
          aria-label={t("Escolher imagem")}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void enviar(f);
          }}
        />
        <button
          type="button"
          disabled={enviando}
          onClick={() => entrada.current?.click()}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium hover:bg-secondary disabled:opacity-50"
        >
          <Plus size={14} weight="bold" aria-hidden />
          {enviando ? t("Enviando…") : arquivo ? t("Trocar imagem") : t("Escolher imagem")}
        </button>
        {arquivo ? (
          <button
            type="button"
            onClick={() => aoMudar("")}
            className="inline-flex h-9 items-center rounded-lg px-3 text-sm text-muted-foreground hover:bg-secondary hover:text-error-fg"
          >
            {t("Remover imagem")}
          </button>
        ) : null}
      </div>
      {erro ? (
        <p role="alert" className="text-xs text-error-fg">
          {erro}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">{t("PNG ou JPG, até 5 MB.")}</p>
      )}
    </div>
  );
}
