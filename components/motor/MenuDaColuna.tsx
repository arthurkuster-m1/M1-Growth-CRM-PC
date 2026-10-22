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
  /**
   * Ordenar pela coluna: a direção em vigor (se for esta coluna) e o que fazer ao escolher.
   * `null` tira a ordenação.
   */
  ordenacao?: {
    atual: "asc" | "desc" | null;
    aoEscolher: (direcao: "asc" | "desc" | null) => void;
  };
  /** Editor de opções (propriedades de seleção); ver `SeletorDeOpcao`. */
  renderizarEditor?: (voltar: () => void) => ReactNode;
}

function Item({
  onClick,
  destrutivo,
  ativo,
  children,
}: {
  onClick: () => void;
  destrutivo?: boolean;
  ativo?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-secondary",
        destrutivo ? "text-error-fg" : "text-foreground",
        ativo && "bg-accent-soft font-medium text-primary",
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
  ordenacao,
  renderizarEditor,
}: Props) {
  const t = useT();
  const [aberto, setAberto] = useState(false);
  const [editando, setEditando] = useState(false);

  const fechando = (acao: () => void) => () => {
    setAberto(false);
    acao();
  };

  const temAcoes = Boolean(
    ordenacao || renderizarEditor || aoLarguraPadrao || aoOcultar || aoApagar,
  );
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
      <PopoverContent
        align="start"
        className={cn("p-2", editando ? "w-[min(30rem,calc(100vw-2rem))]" : "w-64")}
      >
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
            {ordenacao ? (
              <>
                <Item
                  ativo={ordenacao.atual === "asc"}
                  onClick={fechando(() => ordenacao.aoEscolher("asc"))}
                >
                  {t("Ordenar crescente")}
                </Item>
                <Item
                  ativo={ordenacao.atual === "desc"}
                  onClick={fechando(() => ordenacao.aoEscolher("desc"))}
                >
                  {t("Ordenar decrescente")}
                </Item>
                {ordenacao.atual ? (
                  <Item onClick={fechando(() => ordenacao.aoEscolher(null))}>
                    {t("Remover ordenação")}
                  </Item>
                ) : null}
                {renderizarEditor || aoLarguraPadrao || aoOcultar || aoApagar ? (
                  <div className="border-t pt-1" />
                ) : null}
              </>
            ) : null}
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
