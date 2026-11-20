"use client";

import { useState } from "react";

import { Botao, Folha } from "@/components/anotacoes/kit-visual";
import { useT } from "@/hooks/i18n/useT";
import { FileText } from "@/lib/ui/icons";

const ICONES = [
  "📝",
  "📌",
  "📚",
  "📖",
  "📋",
  "📊",
  "📕",
  "📘",
  "🗂️",
  "✏️",
  "✒️",
  "💡",
  "🎯",
  "✅",
  "⭐",
  "✨",
  "🔥",
  "⚡",
  "🚀",
  "⚠️",
  "❗",
  "❓",
  "🚨",
  "❌",
  "⛔",
  "🚫",
  "📞",
  "🗓️",
  "📅",
  "⏰",
  "💰",
  "💵",
  "🔑",
  "🔒",
  "🛠️",
  "🧠",
  "🧬",
  "🧲",
  "🎨",
  "🎬",
  "📷",
  "🏠",
  "👤",
  "👥",
  "🤝",
  "🛒",
  "🔍",
  "🍼",
  "🏋️",
  "🙏",
  "✝️",
  "🧭",
  "🗺️",
  "📍",
  "🌎",
  "🌄",
  "🌪️",
  "🥂",
  "🍎",
  "🍴",
  "🎄",
  "⚔️",
  "🛡️",
];

/** O ícone da página (um emoji): toque, escolha ou tire. Sem permissão de editar, só mostra. */
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
    <span className="an-icone-grande">{icone}</span>
  ) : (
    <FileText size={32} className="an-t-mudo" aria-hidden />
  );
  if (!podeEditar) return <span className="an-icone-caixa">{conteudo}</span>;
  return (
    <>
      <button
        type="button"
        className="an-icone-caixa is-botao"
        onClick={() => setAberto(true)}
        aria-label={t("Escolher o ícone da página")}
        title={t("Escolher o ícone")}
        data-testid="icone-pagina"
      >
        {conteudo}
      </button>
      <Folha open={aberto} onClose={() => setAberto(false)} title={t("Ícone da página")}>
        <div className="an-icones" role="listbox" aria-label={t("Ícones")}>
          {ICONES.map((i) => (
            <button
              key={i}
              type="button"
              role="option"
              aria-selected={i === icone}
              className={i === icone ? "is-atual" : undefined}
              onClick={() => {
                aoEscolher(i);
                setAberto(false);
              }}
            >
              {i}
            </button>
          ))}
        </div>
        {icone ? (
          <Botao
            variant="ghost"
            block
            onClick={() => {
              aoEscolher(null);
              setAberto(false);
            }}
          >
            {t("Tirar o ícone")}
          </Botao>
        ) : null}
      </Folha>
    </>
  );
}
