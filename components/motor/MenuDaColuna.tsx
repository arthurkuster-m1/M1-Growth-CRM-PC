"use client";

import { useState, type ReactNode } from "react";

import { CampoDeNome } from "@/components/motor/CamposDoEditor";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useT } from "@/hooks/i18n/useT";
import { cn } from "@/lib/utils";

interface Props {
  /** O conteúdo do cabeçalho (ícone + nome): é ele que se clica para abrir o menu. */
  titulo: ReactNode;
  /** O nome editável (propriedades personalizadas). Ausente nas colunas de fábrica. */
  nome?: { valor: string; aoSalvar: (novo: string) => void };
  /** O nome do tipo ("Texto", "Seleção"…), só para informar. */
  tipo?: string;
  aoOcultar?: () => void;
  aoLarguraPadrao?: () => void;
  aoApagar?: () => void;
  /** Editor de opções (propriedades de seleção); ver `SeletorDeOpcao`. */
  renderizarEditor?: (voltar: () => void) => ReactNode;
}

function Item({
  onClick,
  destrutivo,
  children,
}: {
  onClick: () => void;
  destrutivo?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-secondary",
        destrutivo ? "text-error-fg" : "text-foreground",
      )}
    >
      {children}
    </button>
  );
}

/**
 * O menu do cabeçalho de uma coluna — o que o Notion abre ao clicar no nome da propriedade:
 * renomear, editar opções, voltar à largura de fábrica, ocultar, apagar.
 *
 * É um `Popover`, e não um `DropdownMenu`, de propósito: o menu tem um CAMPO DE TEXTO (o
 * nome), e o menu de itens do Radix rouba o foco para a "busca por letra" a cada tecla
 * digitada. O clique no título também não atrapalha o arraste do cabeçalho: o arraste só
 * começa depois de 6px de movimento.
 */
export function MenuDaColuna({
  titulo,
  nome,
  tipo,
  aoOcultar,
  aoLarguraPadrao,
  aoApagar,
  renderizarEditor,
}: Props) {
  const t = useT();
  const [aberto, setAberto] = useState(false);
  const [editando, setEditando] = useState(false);

  const fechando = (acao: () => void) => () => {
    setAberto(false);
    acao();
  };

  const temAcoes = Boolean(renderizarEditor || aoLarguraPadrao || aoOcultar || aoApagar);
  if (!nome && !temAcoes) return <>{titulo}</>;

  return (
    <Popover
      open={aberto}
      onOpenChange={(valor) => {
        setAberto(valor);
        if (!valor) setEditando(false);
      }}
    >
      <PopoverTrigger asChild>
        <button type="button" className="block w-full text-left hover:text-foreground">
          {titulo}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-2">
        {editando && renderizarEditor ? (
          renderizarEditor(() => setEditando(false))
        ) : (
          <div className="space-y-1">
            {nome ? (
              <CampoDeNome
                valor={nome.valor}
                rotulo={t("Nome da propriedade")}
                aoSalvar={nome.aoSalvar}
                className="w-full rounded-md border bg-background px-2 py-1.5 text-sm outline-hidden focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
              />
            ) : null}
            {tipo ? <p className="px-1 pb-1 text-xs text-text-subtle">{tipo}</p> : null}
            {temAcoes ? <div className="border-t pt-1" /> : null}
            {renderizarEditor ? (
              <Item onClick={() => setEditando(true)}>{t("Editar opções")}</Item>
            ) : null}
            {aoLarguraPadrao ? (
              <Item onClick={fechando(aoLarguraPadrao)}>{t("Largura padrão")}</Item>
            ) : null}
            {aoOcultar ? <Item onClick={fechando(aoOcultar)}>{t("Ocultar coluna")}</Item> : null}
            {aoApagar ? (
              <Item destrutivo onClick={fechando(aoApagar)}>
                {t("Apagar propriedade")}
              </Item>
            ) : null}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
