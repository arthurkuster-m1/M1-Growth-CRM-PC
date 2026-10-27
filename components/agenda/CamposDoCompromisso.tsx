"use client";

import * as React from "react";
import { toast } from "sonner";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useT } from "@/hooks/i18n/useT";
import { ROTULO_DO_LOCAL } from "@/lib/agenda/propriedades-do-compromisso";
import { ArrowSquareOut, Copy, PencilSimple } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";

/** Um campo da página: o nome em cima, pequeno, e o valor numa caixa — nada de coluna estreita. */
export function Campo({
  rotulo,
  children,
  className,
}: {
  rotulo: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <div className="mb-1 text-xs font-medium text-text-muted">{rotulo}</div>
      <div className="flex min-h-10 items-center rounded-xl border border-border bg-card px-3 py-1 text-sm">
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}

export type CorDaTag = "azul" | "amarelo" | "verde" | "vermelho" | "cinza" | "roxo";

const CLASSE_DA_COR: Record<CorDaTag, string> = {
  azul: "border-blue-500/60 bg-blue-500/15 text-blue-700 dark:text-blue-300",
  amarelo: "border-yellow-500/70 bg-yellow-500/15 text-yellow-800 dark:text-yellow-300",
  verde: "border-green-500/60 bg-green-500/15 text-green-700 dark:text-green-300",
  vermelho: "border-red-500/60 bg-red-500/15 text-red-700 dark:text-red-300",
  cinza: "border-gray-400/70 bg-gray-500/15 text-gray-700 dark:text-gray-300",
  roxo: "border-purple-500/60 bg-purple-500/15 text-purple-700 dark:text-purple-300",
};

/** Uma etiqueta colorida; com `editavel`, o lápis avisa que dá para mudar. */
export const Tag = React.forwardRef<
  HTMLSpanElement,
  {
    cor?: CorDaTag;
    /** Uma cor própria (hex), como a da etapa do funil; vence a `cor`. */
    hex?: string | null;
    editavel?: boolean;
    children: React.ReactNode;
    className?: string;
  } & React.HTMLAttributes<HTMLSpanElement>
>(function Tag({ cor = "cinza", hex, editavel, children, className, ...resto }, ref) {
  const proprio = hex && /^#[0-9a-fA-F]{6}$/.test(hex);
  return (
    <span
      ref={ref}
      {...resto}
      style={
        proprio ? { backgroundColor: `${hex}26`, borderColor: `${hex}99`, color: hex } : undefined
      }
      className={cn(
        "inline-flex max-w-full items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold whitespace-nowrap",
        !proprio && CLASSE_DA_COR[cor],
        editavel && "cursor-pointer hover:brightness-95",
        className,
      )}
    >
      <span className="truncate">{children}</span>
      {editavel ? <PencilSimple size={11} aria-hidden className="shrink-0 opacity-70" /> : null}
    </span>
  );
});

/** A lista de opções de uma etiqueta editável (o menu que abre ao clicar nela). */
export function MenuDeOpcoes({
  gatilho,
  opcoes,
  alinhar = "start",
}: {
  gatilho: React.ReactNode;
  opcoes: Array<{
    id: string;
    rotulo: string;
    desabilitado?: boolean;
    dica?: string;
    aoEscolher: () => void;
  }>;
  alinhar?: "start" | "end";
}) {
  const [aberto, setAberto] = React.useState(false);
  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        <button type="button" className="max-w-full rounded-lg">
          {gatilho}
        </button>
      </PopoverTrigger>
      <PopoverContent align={alinhar} className="w-64 p-1.5">
        {opcoes.map((o) => (
          <button
            key={o.id}
            type="button"
            disabled={o.desabilitado}
            title={o.dica}
            onClick={() => {
              setAberto(false);
              o.aoEscolher();
            }}
            className="flex min-h-9 w-full items-center rounded-md px-2 text-left text-sm hover:bg-secondary disabled:opacity-50"
          >
            {o.rotulo}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

const TIPOS_DE_LOCAL = ["in_person", "video_link", "phone", "whatsapp"] as const;
const ROTULO_DO_TIPO_DE_LOCAL: Record<string, string> = {
  in_person: "Presencial",
  video_link: "Link",
  phone: "Telefone",
  whatsapp: "WhatsApp",
  google_meet: "Google Meet",
};
const DICA_DO_CAMPO: Record<string, string> = {
  in_person: "Endereço",
  video_link: "Link da reunião",
  phone: "Telefone",
  whatsapp: "Número ou conversa",
  google_meet: "Link do Meet",
};

/**
 * O LOCAL do compromisso, editável: a etiqueta escolhe o tipo (Presencial, Link, Telefone,
 * WhatsApp) e o campo ao lado é o endereço ou o link — grava ao sair do campo ou no Enter. O link
 * do Google Meet nasce da integração: aparece como está (ou "Gerando…" / "Falha ao gerar") e só se
 * troca mudando o tipo.
 */
export function LocalEditavel({
  tipo,
  detalhes,
  linkDoMeet,
  estadoDoLink,
  podeEditar,
  aoSalvar,
}: {
  tipo: string | null;
  detalhes: string | null;
  linkDoMeet: string | null;
  estadoDoLink: string | null;
  podeEditar: boolean;
  aoSalvar: (tipo: (typeof TIPOS_DE_LOCAL)[number], detalhes: string) => void;
}) {
  const t = useT();
  const kind = tipo ?? "in_person";
  const ehMeet = kind === "google_meet";
  const [rascunho, setRascunho] = React.useState<string | null>(null);
  const textoDoMeet =
    linkDoMeet ??
    (estadoDoLink === "failed"
      ? t("Falha ao gerar o link")
      : estadoDoLink === "pending"
        ? t("Gerando o link…")
        : (detalhes ?? ""));
  const valor = ehMeet ? textoDoMeet : (rascunho ?? detalhes ?? "");
  const lerComoLink = kind === "video_link" || ehMeet;
  const alvoParaAbrir = ehMeet
    ? linkDoMeet
    : lerComoLink
      ? /^https?:\/\//i.test(valor)
        ? valor
        : null
      : kind === "in_person" && valor
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(valor)}`
        : null;
  const tipoEfetivo = TIPOS_DE_LOCAL.includes(kind as never)
    ? (kind as (typeof TIPOS_DE_LOCAL)[number])
    : "video_link";

  const gravar = () => {
    if (rascunho === null) return;
    const limpo = rascunho.trim();
    setRascunho(null);
    if (limpo !== (detalhes ?? "")) aoSalvar(tipoEfetivo, limpo);
  };

  const etiqueta = (
    <Tag cor="roxo" editavel={podeEditar}>
      {t(ROTULO_DO_TIPO_DE_LOCAL[kind] ?? ROTULO_DO_LOCAL[kind] ?? kind)}
    </Tag>
  );

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2 sm:flex-nowrap">
      {podeEditar ? (
        <MenuDeOpcoes
          gatilho={etiqueta}
          opcoes={TIPOS_DE_LOCAL.map((k) => ({
            id: k,
            rotulo: t(ROTULO_DO_TIPO_DE_LOCAL[k] ?? k),
            desabilitado: k === kind,
            // Trocar o tipo guarda o que já estava escrito: quem passou de Presencial para Link edita
            // o texto logo em seguida.
            aoEscolher: () => aoSalvar(k, ehMeet ? "" : (detalhes ?? "")),
          }))}
        />
      ) : (
        etiqueta
      )}
      {ehMeet || !podeEditar ? (
        <span className={cn("min-w-0 flex-1 truncate", !valor && "text-text-muted")}>
          {valor || t("Sem link ou endereço")}
        </span>
      ) : (
        <input
          value={valor}
          maxLength={500}
          aria-label={t(DICA_DO_CAMPO[kind] ?? "Endereço")}
          placeholder={t(DICA_DO_CAMPO[kind] ?? "Endereço")}
          onChange={(e) => setRascunho(e.target.value)}
          onBlur={gravar}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
            if (e.key === "Escape") {
              setRascunho(null);
              e.currentTarget.blur();
            }
          }}
          className="min-w-0 flex-1 basis-40 rounded-lg border border-transparent bg-transparent px-2 py-1 text-sm outline-hidden hover:border-border focus:border-primary/50 focus:bg-background focus:ring-2 focus:ring-primary/20"
        />
      )}
      {valor ? (
        <span className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            aria-label={t("Copiar")}
            title={t("Copiar")}
            className="grid h-7 w-7 place-items-center rounded-lg hover:bg-secondary"
            onClick={() => {
              void navigator.clipboard?.writeText(valor);
              toast.success(t("Copiado."));
            }}
          >
            <Copy size={15} aria-hidden />
          </button>
          {alvoParaAbrir ? (
            <a
              href={alvoParaAbrir}
              target="_blank"
              rel="noreferrer"
              aria-label={t("Abrir")}
              title={t("Abrir")}
              className="grid h-7 w-7 place-items-center rounded-lg hover:bg-secondary"
            >
              <ArrowSquareOut size={15} aria-hidden />
            </a>
          ) : null}
        </span>
      ) : null}
    </div>
  );
}
