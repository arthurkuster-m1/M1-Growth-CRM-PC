"use client";

import { useState, type ReactNode } from "react";

import { useT } from "@/hooks/i18n/useT";
import {
  LADOS_DO_ANTES_DEPOIS,
  TIPOS_DE_BLOCO,
  blocoEmBranco,
  type Bloco,
  type TipoDeBloco,
} from "@/lib/marketing/blocos";
import { CaretDown, CaretUp, Copy, Plus, Trash, X } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";

/**
 * O EDITOR DE BLOCOS — onde a agência escreve a página. Controlado: recebe a lista e avisa a
 * lista nova a cada mudança; quem o usa decide quando gravar (o rascunho é salvo sozinho, depois
 * de uma pausa). Cada bloco tem o seu formulário, e os botões ↑ ↓ ⧉ 🗑 ao lado — funcionam no
 * dedo e no teclado, sem depender de arrastar.
 */
const CAMPO =
  "w-full rounded-xl border bg-background px-3 py-2 text-sm outline-hidden focus:border-primary/60 focus:ring-2 focus:ring-primary/20";

function useNomesDosTipos() {
  const t = useT();
  return (tipo: TipoDeBloco): string => {
    switch (tipo) {
      case "titulo":
        return t("Título");
      case "texto":
        return t("Texto");
      case "destaque":
        return t("Destaque");
      case "lista":
        return t("Lista");
      case "cards":
        return t("Cartões");
      case "metricas":
        return t("Números");
      case "antes-depois":
        return t("Antes e depois");
      case "paleta":
        return t("Paleta de cores");
      case "links":
        return t("Links");
      case "citacao":
        return t("Citação");
      case "separador":
        return t("Quebra de slide");
    }
  };
}

function Rotulo({ texto, children }: { texto: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-muted-foreground">{texto}</span>
      {children}
    </label>
  );
}

function BotaoDeIcone({
  rotulo,
  aoClicar,
  desabilitado,
  perigo,
  children,
}: {
  rotulo: string;
  aoClicar: () => void;
  desabilitado?: boolean;
  perigo?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={rotulo}
      title={rotulo}
      disabled={desabilitado}
      onClick={aoClicar}
      className={cn(
        "grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary disabled:opacity-30",
        perigo && "hover:text-error-fg",
      )}
    >
      {children}
    </button>
  );
}

export function EditorDeBlocos({
  blocos,
  aoMudar,
  novoId,
}: {
  blocos: Bloco[];
  aoMudar: (blocos: Bloco[]) => void;
  novoId: () => string;
}) {
  const t = useT();
  const nomeDoTipo = useNomesDosTipos();
  const [menuAberto, setMenuAberto] = useState(false);

  const trocar = (i: number, novo: Bloco) => aoMudar(blocos.map((b, k) => (k === i ? novo : b)));
  const mover = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= blocos.length) return;
    const copia = [...blocos];
    [copia[i], copia[j]] = [copia[j]!, copia[i]!];
    aoMudar(copia);
  };
  const duplicar = (i: number) => {
    const copia = [...blocos];
    copia.splice(i + 1, 0, { ...structuredClone(blocos[i]!), id: novoId() });
    aoMudar(copia);
  };
  const remover = (i: number) => aoMudar(blocos.filter((_, k) => k !== i));
  const adicionar = (tipo: TipoDeBloco) => {
    aoMudar([...blocos, blocoEmBranco(tipo, novoId())]);
    setMenuAberto(false);
  };

  return (
    <div className="flex flex-col gap-3">
      {blocos.map((b, i) => (
        <section
          key={b.id}
          aria-label={`${nomeDoTipo(b.tipo)} ${i + 1}`}
          className="rounded-2xl border bg-card p-4 shadow-sm"
        >
          <div className="mb-3 flex items-center justify-between gap-2">
            <span className="rounded-md bg-secondary px-2 py-0.5 text-xs font-medium text-muted-foreground">
              {nomeDoTipo(b.tipo)}
            </span>
            <div className="flex items-center">
              <BotaoDeIcone
                rotulo={t("Mover para cima")}
                desabilitado={i === 0}
                aoClicar={() => mover(i, -1)}
              >
                <CaretUp size={14} aria-hidden />
              </BotaoDeIcone>
              <BotaoDeIcone
                rotulo={t("Mover para baixo")}
                desabilitado={i === blocos.length - 1}
                aoClicar={() => mover(i, 1)}
              >
                <CaretDown size={14} aria-hidden />
              </BotaoDeIcone>
              <BotaoDeIcone rotulo={t("Duplicar bloco")} aoClicar={() => duplicar(i)}>
                <Copy size={14} aria-hidden />
              </BotaoDeIcone>
              <BotaoDeIcone rotulo={t("Remover bloco")} perigo aoClicar={() => remover(i)}>
                <Trash size={14} aria-hidden />
              </BotaoDeIcone>
            </div>
          </div>
          <FormularioDoBloco bloco={b} aoMudar={(novo) => trocar(i, novo)} />
        </section>
      ))}

      <div className="relative">
        <button
          type="button"
          aria-expanded={menuAberto}
          onClick={() => setMenuAberto((a) => !a)}
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed text-sm font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
        >
          <Plus size={16} weight="bold" aria-hidden />
          {t("Adicionar bloco")}
        </button>
        {menuAberto ? (
          <div
            role="menu"
            className="absolute right-0 bottom-full left-0 z-20 mb-2 grid grid-cols-2 gap-1 rounded-2xl border bg-popover p-2 shadow-xl sm:grid-cols-3"
          >
            {TIPOS_DE_BLOCO.map((tipo) => (
              <button
                key={tipo}
                type="button"
                role="menuitem"
                onClick={() => adicionar(tipo)}
                className="rounded-xl px-3 py-2 text-left text-sm hover:bg-secondary"
              >
                {nomeDoTipo(tipo)}
              </button>
            ))}
            <button
              type="button"
              aria-label={t("Fechar")}
              onClick={() => setMenuAberto(false)}
              className="col-span-full grid h-8 place-items-center rounded-xl text-muted-foreground hover:bg-secondary"
            >
              <X size={14} aria-hidden />
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function FormularioDoBloco({ bloco, aoMudar }: { bloco: Bloco; aoMudar: (b: Bloco) => void }) {
  const t = useT();

  switch (bloco.tipo) {
    case "titulo":
      return (
        <div className="grid gap-3 sm:grid-cols-[9rem_1fr]">
          <Rotulo texto={t("Tamanho")}>
            <select
              value={bloco.nivel}
              onChange={(e) => aoMudar({ ...bloco, nivel: e.target.value === "2" ? 2 : 1 })}
              className={CAMPO}
            >
              <option value={1}>{t("Seção (novo slide)")}</option>
              <option value={2}>{t("Subtítulo")}</option>
            </select>
          </Rotulo>
          <Rotulo texto={t("Texto do título")}>
            <input
              value={bloco.texto}
              maxLength={200}
              onChange={(e) => aoMudar({ ...bloco, texto: e.target.value })}
              className={CAMPO}
            />
          </Rotulo>
        </div>
      );

    case "texto":
      return (
        <Rotulo texto={t("Texto (uma linha em branco separa os parágrafos)")}>
          <textarea
            value={bloco.texto}
            rows={5}
            maxLength={5000}
            onChange={(e) => aoMudar({ ...bloco, texto: e.target.value })}
            className={cn(CAMPO, "resize-y")}
          />
        </Rotulo>
      );

    case "destaque":
      return (
        <div className="grid gap-3 sm:grid-cols-[9rem_1fr]">
          <Rotulo texto={t("Tom")}>
            <select
              value={bloco.tom}
              onChange={(e) => aoMudar({ ...bloco, tom: e.target.value as typeof bloco.tom })}
              className={CAMPO}
            >
              <option value="info">{t("Informação")}</option>
              <option value="sucesso">{t("Conquista")}</option>
              <option value="atencao">{t("Atenção")}</option>
            </select>
          </Rotulo>
          <Rotulo texto={t("Texto do destaque")}>
            <textarea
              value={bloco.texto}
              rows={3}
              maxLength={5000}
              onChange={(e) => aoMudar({ ...bloco, texto: e.target.value })}
              className={cn(CAMPO, "resize-y")}
            />
          </Rotulo>
        </div>
      );

    case "lista":
      return (
        <div className="grid gap-3 sm:grid-cols-[9rem_1fr]">
          <Rotulo texto={t("Estilo")}>
            <select
              value={bloco.estilo}
              onChange={(e) => aoMudar({ ...bloco, estilo: e.target.value as typeof bloco.estilo })}
              className={CAMPO}
            >
              <option value="marcadores">{t("Marcadores")}</option>
              <option value="numerada">{t("Numerada")}</option>
              <option value="check">{t("Com check")}</option>
            </select>
          </Rotulo>
          <Rotulo texto={t("Itens (um por linha)")}>
            <textarea
              value={bloco.itens.join("\n")}
              rows={Math.max(3, bloco.itens.length + 1)}
              onChange={(e) =>
                aoMudar({ ...bloco, itens: e.target.value.split("\n").slice(0, 40) })
              }
              className={cn(CAMPO, "resize-y")}
            />
          </Rotulo>
        </div>
      );

    case "cards":
      return (
        <ListaEditavel
          itens={bloco.itens}
          aoMudar={(itens) => aoMudar({ ...bloco, itens })}
          novo={{ titulo: "", texto: "" }}
          maximo={12}
          rotuloDeAdicionar={t("Adicionar cartão")}
          renderizar={(item, mudar) => (
            <div className="grid flex-1 gap-2">
              <input
                value={item.titulo}
                maxLength={200}
                placeholder={t("Título do cartão")}
                aria-label={t("Título do cartão")}
                onChange={(e) => mudar({ ...item, titulo: e.target.value })}
                className={CAMPO}
              />
              <textarea
                value={item.texto}
                rows={2}
                maxLength={1200}
                placeholder={t("Texto do cartão")}
                aria-label={t("Texto do cartão")}
                onChange={(e) => mudar({ ...item, texto: e.target.value })}
                className={cn(CAMPO, "resize-y")}
              />
            </div>
          )}
        />
      );

    case "metricas":
      return (
        <ListaEditavel
          itens={bloco.itens}
          aoMudar={(itens) => aoMudar({ ...bloco, itens })}
          novo={{ rotulo: "", valor: "", detalhe: "" }}
          maximo={8}
          rotuloDeAdicionar={t("Adicionar número")}
          renderizar={(item, mudar) => (
            <div className="grid flex-1 gap-2 sm:grid-cols-3">
              <input
                value={item.valor}
                maxLength={40}
                placeholder={t("Valor (ex.: R$ 120 mil)")}
                aria-label={t("Valor")}
                onChange={(e) => mudar({ ...item, valor: e.target.value })}
                className={CAMPO}
              />
              <input
                value={item.rotulo}
                maxLength={200}
                placeholder={t("O que é")}
                aria-label={t("O que é")}
                onChange={(e) => mudar({ ...item, rotulo: e.target.value })}
                className={CAMPO}
              />
              <input
                value={item.detalhe}
                maxLength={200}
                placeholder={t("Detalhe (opcional)")}
                aria-label={t("Detalhe")}
                onChange={(e) => mudar({ ...item, detalhe: e.target.value })}
                className={CAMPO}
              />
            </div>
          )}
        />
      );

    case "antes-depois":
      return (
        <div className="grid gap-3 sm:grid-cols-2">
          {LADOS_DO_ANTES_DEPOIS.map((lado) => (
            <div key={lado} className="grid gap-2 rounded-xl bg-secondary/40 p-3">
              <span className="text-xs font-semibold text-muted-foreground uppercase">
                {lado === "antes" ? t("Antes") : t("Depois")}
              </span>
              <input
                value={bloco[lado].titulo}
                maxLength={200}
                placeholder={t("Título")}
                aria-label={`${lado === "antes" ? t("Antes") : t("Depois")}: ${t("Título")}`}
                onChange={(e) =>
                  aoMudar({ ...bloco, [lado]: { ...bloco[lado], titulo: e.target.value } })
                }
                className={CAMPO}
              />
              <textarea
                value={bloco[lado].texto}
                rows={3}
                maxLength={1500}
                placeholder={t("Texto")}
                aria-label={`${lado === "antes" ? t("Antes") : t("Depois")}: ${t("Texto")}`}
                onChange={(e) =>
                  aoMudar({ ...bloco, [lado]: { ...bloco[lado], texto: e.target.value } })
                }
                className={cn(CAMPO, "resize-y")}
              />
            </div>
          ))}
        </div>
      );

    case "paleta":
      return (
        <ListaEditavel
          itens={bloco.cores}
          aoMudar={(cores) => aoMudar({ ...bloco, cores })}
          novo={{ nome: "", hex: "#366D6F" }}
          maximo={16}
          rotuloDeAdicionar={t("Adicionar cor")}
          renderizar={(item, mudar) => (
            <div className="flex flex-1 items-center gap-2">
              <input
                type="color"
                value={item.hex}
                aria-label={t("Cor")}
                onChange={(e) => mudar({ ...item, hex: e.target.value })}
                className="h-10 w-12 shrink-0 cursor-pointer rounded-lg border bg-background p-1"
              />
              <input
                value={item.nome}
                maxLength={40}
                placeholder={t("Nome da cor")}
                aria-label={t("Nome da cor")}
                onChange={(e) => mudar({ ...item, nome: e.target.value })}
                className={CAMPO}
              />
            </div>
          )}
        />
      );

    case "links":
      return (
        <ListaEditavel
          itens={bloco.itens}
          aoMudar={(itens) => aoMudar({ ...bloco, itens })}
          novo={{ rotulo: "", url: "" }}
          maximo={30}
          rotuloDeAdicionar={t("Adicionar link")}
          renderizar={(item, mudar) => (
            <div className="grid flex-1 gap-2 sm:grid-cols-2">
              <input
                value={item.rotulo}
                maxLength={200}
                placeholder={t("Nome do link")}
                aria-label={t("Nome do link")}
                onChange={(e) => mudar({ ...item, rotulo: e.target.value })}
                className={CAMPO}
              />
              <input
                value={item.url}
                maxLength={500}
                inputMode="url"
                placeholder="https://"
                aria-label={t("Endereço do link")}
                onChange={(e) => mudar({ ...item, url: e.target.value })}
                className={cn(
                  CAMPO,
                  item.url && !/^https?:\/\/\S+$/i.test(item.url) && "border-error",
                )}
              />
            </div>
          )}
        />
      );

    case "citacao":
      return (
        <div className="grid gap-3">
          <Rotulo texto={t("Citação")}>
            <textarea
              value={bloco.texto}
              rows={3}
              maxLength={1000}
              onChange={(e) => aoMudar({ ...bloco, texto: e.target.value })}
              className={cn(CAMPO, "resize-y")}
            />
          </Rotulo>
          <Rotulo texto={t("Quem disse")}>
            <input
              value={bloco.autor}
              maxLength={200}
              onChange={(e) => aoMudar({ ...bloco, autor: e.target.value })}
              className={CAMPO}
            />
          </Rotulo>
        </div>
      );

    case "separador":
      return (
        <p className="text-sm text-muted-foreground">
          {t("Na apresentação, o que vem depois começa num slide novo. Na página, vira uma linha.")}
        </p>
      );
  }
}

/** Uma lista de itens com "adicionar" e "remover" (cartões, números, cores, links). */
function ListaEditavel<T>({
  itens,
  aoMudar,
  novo,
  maximo,
  rotuloDeAdicionar,
  renderizar,
}: {
  itens: T[];
  aoMudar: (itens: T[]) => void;
  novo: T;
  maximo: number;
  rotuloDeAdicionar: string;
  renderizar: (item: T, mudar: (novo: T) => void) => ReactNode;
}) {
  const t = useT();
  return (
    <div className="flex flex-col gap-2">
      {itens.map((item, i) => (
        <div key={i} className="flex items-start gap-2">
          {renderizar(item, (n) => aoMudar(itens.map((x, k) => (k === i ? n : x))))}
          <BotaoDeIcone
            rotulo={t("Remover item")}
            perigo
            aoClicar={() => aoMudar(itens.filter((_, k) => k !== i))}
          >
            <X size={14} aria-hidden />
          </BotaoDeIcone>
        </div>
      ))}
      {itens.length < maximo ? (
        <button
          type="button"
          onClick={() => aoMudar([...itens, structuredClone(novo)])}
          className="inline-flex h-9 w-fit items-center gap-1.5 rounded-lg px-3 text-sm text-primary hover:bg-secondary"
        >
          <Plus size={14} weight="bold" aria-hidden />
          {rotuloDeAdicionar}
        </button>
      ) : null}
    </div>
  );
}
