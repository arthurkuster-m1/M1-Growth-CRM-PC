"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useT } from "@/hooks/i18n/useT";
import { apiClient } from "@/lib/api/client";
import {
  aplicarVariaveis,
  linkDoWhatsapp,
  type DadosDaMensagem,
} from "@/lib/leads/mensagem-de-prospeccao";
import { CaretDown, WhatsappLogo } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";

interface ModeloDeMensagem {
  id: string;
  title: string;
  body: string;
}

const CHAVE_DO_ULTIMO = "m1.whatsapp.modelo";

function lerUltimo(): string {
  try {
    return window.localStorage.getItem(CHAVE_DO_ULTIMO) ?? "";
  } catch {
    return "";
  }
}

/**
 * O WhatsApp da prospecção: o botão abre a conversa já com a MENSAGEM PRONTA (um dos modelos de
 * mensagem, com as variáveis trocadas); a seta escolhe outro modelo ou abre sem mensagem. O
 * último modelo usado fica lembrado neste navegador.
 */
export function BotaoWhatsApp({
  telefone,
  dados,
  className,
}: {
  telefone: string | null | undefined;
  dados: DadosDaMensagem;
  className?: string;
}) {
  const t = useT();
  const [aberto, setAberto] = useState(false);
  const [escolhido, setEscolhido] = useState<string>(() => lerUltimo());
  const modelos = useQuery({
    queryKey: ["message-templates", "prospeccao"],
    staleTime: 60_000,
    queryFn: async () =>
      (await apiClient.get<{ data: ModeloDeMensagem[] }>("/api/v1/message-templates")).data,
  });
  const lista = modelos.data ?? [];
  const atual = lista.find((m) => m.id === escolhido) ?? null;
  const link = (m: ModeloDeMensagem | null) =>
    linkDoWhatsapp(telefone, m ? aplicarVariaveis(m.body, dados) : undefined);

  if (!linkDoWhatsapp(telefone)) {
    return <span className="block px-2 text-sm text-muted-foreground">—</span>;
  }

  function escolher(id: string) {
    setEscolhido(id);
    try {
      window.localStorage.setItem(CHAVE_DO_ULTIMO, id);
    } catch {
      /* o navegador pode bloquear: segue sem lembrar */
    }
  }

  return (
    <span className={cn("mx-2 inline-flex items-stretch", className)}>
      <a
        href={link(atual) ?? "#"}
        target="_blank"
        rel="noopener noreferrer"
        title={atual ? `${t("Mensagem:")} ${atual.title}` : t("Abrir o WhatsApp sem mensagem")}
        className="inline-flex h-8 items-center gap-1.5 rounded-l-lg border px-2.5 text-xs font-medium hover:bg-secondary"
      >
        <WhatsappLogo size={14} aria-hidden />
        WhatsApp
      </a>
      <Popover open={aberto} onOpenChange={setAberto}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={t("Escolher a mensagem do WhatsApp")}
            className="inline-flex h-8 items-center rounded-r-lg border border-l-0 px-1.5 hover:bg-secondary"
          >
            <CaretDown size={12} aria-hidden />
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-72 p-1.5">
          <p className="px-2 pt-1 pb-1 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
            {t("Mensagem pronta")}
          </p>
          <div className="max-h-64 space-y-0.5 overflow-y-auto">
            <button
              type="button"
              onClick={() => {
                escolher("");
                setAberto(false);
              }}
              className={cn(
                "flex w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-secondary",
                escolhido === "" && "bg-secondary",
              )}
            >
              {t("Sem mensagem")}
            </button>
            {lista.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  escolher(m.id);
                  setAberto(false);
                }}
                className={cn(
                  "flex w-full flex-col rounded-md px-2 py-1.5 text-left hover:bg-secondary",
                  escolhido === m.id && "bg-secondary",
                )}
              >
                <span className="text-sm font-medium">{m.title}</span>
                <span className="line-clamp-2 text-xs text-muted-foreground">
                  {aplicarVariaveis(m.body, dados)}
                </span>
              </button>
            ))}
            {lista.length === 0 && !modelos.isLoading ? (
              <p className="px-2 py-1.5 text-xs text-muted-foreground">
                {t("Nenhum modelo ainda. Crie em Inbox › Modelos de mensagem.")}
              </p>
            ) : null}
          </div>
          <p className="mt-1 border-t px-2 pt-1.5 text-[11px] text-muted-foreground">
            {t("Variáveis: {nome}, {primeiro_nome}, {produto}, {campanha}, {responsavel}")}
          </p>
        </PopoverContent>
      </Popover>
    </span>
  );
}
