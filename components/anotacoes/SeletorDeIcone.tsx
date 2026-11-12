"use client";

import { useState } from "react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useT } from "@/hooks/i18n/useT";
import { FileText } from "@/lib/ui/icons";

const ICONES = [
  "📝",
  "📌",
  "📎",
  "📚",
  "📖",
  "📋",
  "📊",
  "📈",
  "💡",
  "🎯",
  "✅",
  "⭐",
  "🔥",
  "🚀",
  "⚠️",
  "❗",
  "❓",
  "💬",
  "📞",
  "📧",
  "🗓️",
  "⏰",
  "💰",
  "🧾",
  "🔑",
  "🔒",
  "🛠️",
  "🧠",
  "🎨",
  "🎬",
  "📷",
  "🌐",
  "🏢",
  "👤",
  "👥",
  "🤝",
  "🛒",
  "🏷️",
  "📦",
  "🔍",
];

/** O ícone da página (um emoji): clica, escolhe ou tira. Sem permissão de editar, só mostra. */
export function SeletorDeIcone({
  icone,
  podeEditar,
  aoEscolher,
}: {
  icone: string | null;
  podeEditar: boolean;
  aoEscolher: (icone: string | null) => void;
}) {
  const t = useT();
  const [aberto, setAberto] = useState(false);
  const conteudo = icone ? (
    <span className="text-4xl leading-none">{icone}</span>
  ) : (
    <FileText size={32} className="text-muted-foreground" aria-hidden />
  );
  if (!podeEditar) return <span className="grid h-11 w-11 place-items-center">{conteudo}</span>;
  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={t("Escolher ícone")}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-xl hover:bg-secondary"
        >
          {conteudo}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-3">
        <div className="grid grid-cols-10 gap-1">
          {ICONES.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => {
                aoEscolher(e);
                setAberto(false);
              }}
              className="grid h-6 w-6 place-items-center rounded text-base hover:bg-secondary"
            >
              {e}
            </button>
          ))}
        </div>
        {icone ? (
          <button
            type="button"
            onClick={() => {
              aoEscolher(null);
              setAberto(false);
            }}
            className="mt-3 text-xs text-muted-foreground hover:text-foreground hover:underline"
          >
            {t("Tirar ícone")}
          </button>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
