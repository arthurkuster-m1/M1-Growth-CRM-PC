"use client";

import { SelectDoApp } from "@/components/ui/SelectDoApp";
import { useState, type ReactNode } from "react";

import { CampoDeMoeda } from "@/components/marketing/CampoDeMoeda";
import { EditorDeOferta } from "@/components/marketing/EditorDeOferta";
import { SeletorDeImagem } from "@/components/marketing/SeletorDeImagem";
import { useT } from "@/hooks/i18n/useT";
import {
  ALINHAMENTOS,
  ESTILOS_DA_MATRIZ,
  FORMAS_DOS_NIVEIS,
  LADOS_DA_IMAGEM,
  LADOS_DO_ANTES_DEPOIS,
  LARGURAS_DA_IMAGEM,
  TIPOS_DE_BLOCO,
  blocoEmBranco,
  type Bloco,
  type TipoDeBloco,
} from "@/lib/marketing/blocos";
import { CaretDown, CaretRight, CaretUp, Copy, Plus, Trash, X } from "@/lib/ui/icons";
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
      case "imagem":
        return t("Imagem");
      case "imagem-texto":
        return t("Imagem com texto");
      case "piramide":
        return t("Pirâmide ou funil");
      case "fluxo":
        return t("Fluxo (passo a passo)");
      case "matriz":
        return t("Matriz 2x2 (SWOT)");
      case "ficha":
        return t("Ficha com links");
      case "tabela":
        return t("Tabela");
      case "calculadora":
        return t("Calculadora da meta");
      case "oferta":
        return t("Oferta");
      case "separador":
        return t("Quebra de slide");
    }
  };
}

function useRotulosDeAlinhamento() {
  const t = useT();
  return (a: (typeof ALINHAMENTOS)[number]): string =>
    a === "esquerda" ? t("Esquerda") : a === "centro" ? t("Centro") : t("Direita");
}

function SeletorDeAlinhamento({
  valor,
  aoMudar,
}: {
  valor: (typeof ALINHAMENTOS)[number];
  aoMudar: (a: (typeof ALINHAMENTOS)[number]) => void;
}) {
  const t = useT();
  const rotulo = useRotulosDeAlinhamento();
  return (
    <Rotulo texto={t("Alinhamento")}>
      <SelectDoApp
        value={valor}
        onChange={(e) => aoMudar(e.target.value as (typeof ALINHAMENTOS)[number])}
        className={CAMPO}
      >
        {ALINHAMENTOS.map((a) => (
          <option key={a} value={a}>
            {rotulo(a)}
          </option>
        ))}
      </SelectDoApp>
    </Rotulo>
  );
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

/**
 * A COR DE CADA TIPO DE BLOCO na edição: a barra da lateral, o fundo suave e a etiqueta. Cores
 * diferentes por tipo deixam a página inteira legível de relance (texto, destaque, dados, mídia…).
 */
const COR_DO_TIPO: Record<string, { barra: string; fundo: string; etiqueta: string }> = {
  titulo: {
    barra: "border-l-violet-500",
    fundo: "bg-violet-500/5",
    etiqueta: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
  },
  texto: {
    barra: "border-l-blue-500",
    fundo: "bg-blue-500/5",
    etiqueta: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  },
  destaque: {
    barra: "border-l-amber-500",
    fundo: "bg-amber-500/5",
    etiqueta: "bg-amber-500/15 text-amber-800 dark:text-amber-300",
  },
  citacao: {
    barra: "border-l-amber-500",
    fundo: "bg-amber-500/5",
    etiqueta: "bg-amber-500/15 text-amber-800 dark:text-amber-300",
  },
  lista: {
    barra: "border-l-emerald-500",
    fundo: "bg-emerald-500/5",
    etiqueta: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  },
  cards: {
    barra: "border-l-emerald-500",
    fundo: "bg-emerald-500/5",
    etiqueta: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  },
  fluxo: {
    barra: "border-l-emerald-500",
    fundo: "bg-emerald-500/5",
    etiqueta: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  },
  metricas: {
    barra: "border-l-cyan-500",
    fundo: "bg-cyan-500/5",
    etiqueta: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300",
  },
  tabela: {
    barra: "border-l-cyan-500",
    fundo: "bg-cyan-500/5",
    etiqueta: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300",
  },
  matriz: {
    barra: "border-l-cyan-500",
    fundo: "bg-cyan-500/5",
    etiqueta: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300",
  },
  calculadora: {
    barra: "border-l-cyan-500",
    fundo: "bg-cyan-500/5",
    etiqueta: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300",
  },
  imagem: {
    barra: "border-l-pink-500",
    fundo: "bg-pink-500/5",
    etiqueta: "bg-pink-500/15 text-pink-700 dark:text-pink-300",
  },
  "imagem-texto": {
    barra: "border-l-pink-500",
    fundo: "bg-pink-500/5",
    etiqueta: "bg-pink-500/15 text-pink-700 dark:text-pink-300",
  },
  paleta: {
    barra: "border-l-pink-500",
    fundo: "bg-pink-500/5",
    etiqueta: "bg-pink-500/15 text-pink-700 dark:text-pink-300",
  },
  oferta: {
    barra: "border-l-orange-500",
    fundo: "bg-orange-500/5",
    etiqueta: "bg-orange-500/15 text-orange-700 dark:text-orange-300",
  },
  links: {
    barra: "border-l-sky-500",
    fundo: "bg-sky-500/5",
    etiqueta: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  },
  ficha: {
    barra: "border-l-sky-500",
    fundo: "bg-sky-500/5",
    etiqueta: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  },
  "antes-depois": {
    barra: "border-l-rose-500",
    fundo: "bg-rose-500/5",
    etiqueta: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
  },
  piramide: {
    barra: "border-l-rose-500",
    fundo: "bg-rose-500/5",
    etiqueta: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
  },
  separador: {
    barra: "border-l-slate-400",
    fundo: "bg-slate-500/5",
    etiqueta: "bg-slate-500/15 text-slate-700 dark:text-slate-300",
  },
};
const COR_PADRAO = COR_DO_TIPO.texto!;

/** Uma linha de texto do bloco, para identificá-lo quando está fechado (só o título/começo). */
function resumoDoBloco(b: Bloco): string {
  const x = b as unknown as Record<string, unknown>;
  const curto = (v: string) => {
    const limpo = v.replace(/\s+/g, " ").trim();
    return limpo.length > 110 ? `${limpo.slice(0, 107)}…` : limpo;
  };
  for (const campo of ["texto", "titulo", "legenda", "nome", "autor"]) {
    const v = x[campo];
    if (typeof v === "string" && v.trim() !== "") return curto(v);
  }
  for (const campo of ["itens", "cores", "celulas"]) {
    const lista = x[campo];
    if (Array.isArray(lista) && lista.length > 0) {
      const primeiro = lista[0] as unknown;
      const nome =
        typeof primeiro === "string"
          ? primeiro
          : ((primeiro as Record<string, unknown> | null)?.titulo ??
            (primeiro as Record<string, unknown> | null)?.rotulo ??
            (primeiro as Record<string, unknown> | null)?.nome ??
            (primeiro as Record<string, unknown> | null)?.texto ??
            "");
      const base = typeof nome === "string" ? curto(nome) : "";
      return base ? `${base}${lista.length > 1 ? ` (+${lista.length - 1})` : ""}` : `${lista.length}`;
    }
  }
  return "";
}

export function EditorDeBlocos({
  blocos,
  aoMudar,
  novoId,
  tituloDaPagina,
  chaveDaPagina,
}: {
  blocos: Bloco[];
  aoMudar: (blocos: Bloco[]) => void;
  novoId: () => string;
  /** O título da página (entra no texto para a IA das ofertas). */
  tituloDaPagina?: string;
  /** A chave da página (a pré-visualização do cartão da oferta usa). */
  chaveDaPagina?: string;
}) {
  const t = useT();
  const nomeDoTipo = useNomesDosTipos();
  const [menuAberto, setMenuAberto] = useState(false);
  // Os blocos abrem para editar e fecham para a visão geral (só o título). Começam fechados.
  const [abertos, setAbertos] = useState<ReadonlySet<string>>(new Set());
  const alternar = (id: string) =>
    setAbertos((a) => {
      const novo = new Set(a);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });

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
    const novo = blocoEmBranco(tipo, novoId());
    aoMudar([...blocos, novo]);
    setAbertos((a) => new Set(a).add(novo.id));
    setMenuAberto(false);
  };

  return (
    <div className="flex flex-col gap-3">
      {blocos.length > 1 ? (
        <div className="flex flex-wrap items-center justify-end gap-2 text-xs">
          <span className="mr-auto text-muted-foreground">
            {abertos.size}/{blocos.length} {t("abertos")}
          </span>
          <button
            type="button"
            onClick={() => setAbertos(new Set(blocos.map((b) => b.id)))}
            className="h-8 rounded-lg border px-3 font-medium hover:bg-secondary"
          >
            {t("Abrir todos")}
          </button>
          <button
            type="button"
            onClick={() => setAbertos(new Set())}
            className="h-8 rounded-lg border px-3 font-medium hover:bg-secondary"
          >
            {t("Fechar todos")}
          </button>
        </div>
      ) : null}
      {blocos.map((b, i) => (
        <section
          key={b.id}
          aria-label={`${nomeDoTipo(b.tipo)} ${i + 1}`}
          className={cn(
            "rounded-2xl border border-l-4 p-4 shadow-sm",
            (COR_DO_TIPO[b.tipo] ?? COR_PADRAO).barra,
            (COR_DO_TIPO[b.tipo] ?? COR_PADRAO).fundo,
          )}
        >
          <div className={cn("flex items-center justify-between gap-2", abertos.has(b.id) && "mb-3")}>
            <button
              type="button"
              aria-expanded={abertos.has(b.id)}
              onClick={() => alternar(b.id)}
              className="flex min-w-0 flex-1 items-center gap-2 rounded-lg text-left"
            >
              {abertos.has(b.id) ? (
                <CaretDown size={14} weight="bold" aria-hidden className="shrink-0" />
              ) : (
                <CaretRight size={14} weight="bold" aria-hidden className="shrink-0" />
              )}
              <span
                className={cn(
                  "shrink-0 rounded-md px-2.5 py-0.5 text-xs font-semibold",
                  (COR_DO_TIPO[b.tipo] ?? COR_PADRAO).etiqueta,
                )}
              >
                {nomeDoTipo(b.tipo)}
              </span>
              {!abertos.has(b.id) ? (
                <span className="min-w-0 truncate text-sm text-muted-foreground">
                  {resumoDoBloco(b)}
                </span>
              ) : null}
            </button>
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
          {abertos.has(b.id) ? (
            <FormularioDoBloco
              bloco={b}
              aoMudar={(novo) => trocar(i, novo)}
              tituloDaPagina={tituloDaPagina}
              chaveDaPagina={chaveDaPagina}
            />
          ) : null}
        </section>
      ))}

      <div className="relative">
        <button
          type="button"
          aria-expanded={menuAberto}
          onClick={() => setMenuAberto((a) => !a)}
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-primary/40 bg-primary/5 text-sm font-medium text-primary transition-colors hover:border-primary hover:bg-primary/10"
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

function FormularioDoBloco({
  bloco,
  aoMudar,
  tituloDaPagina,
  chaveDaPagina,
}: {
  bloco: Bloco;
  aoMudar: (b: Bloco) => void;
  tituloDaPagina?: string;
  chaveDaPagina?: string;
}) {
  const t = useT();

  switch (bloco.tipo) {
    case "titulo":
      return (
        <div className="grid gap-3 sm:grid-cols-[9rem_9rem_1fr]">
          <Rotulo texto={t("Tamanho")}>
            <SelectDoApp
              value={bloco.nivel}
              onChange={(e) => aoMudar({ ...bloco, nivel: e.target.value === "2" ? 2 : 1 })}
              className={CAMPO}
            >
              <option value={1}>{t("Seção (novo slide)")}</option>
              <option value={2}>{t("Subtítulo")}</option>
            </SelectDoApp>
          </Rotulo>
          <SeletorDeAlinhamento
            valor={bloco.alinhamento ?? "esquerda"}
            aoMudar={(alinhamento) => aoMudar({ ...bloco, alinhamento })}
          />
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
        <div className="grid gap-3">
          <Rotulo texto={t("Texto (uma linha em branco separa os parágrafos)")}>
            <textarea
              value={bloco.texto}
              rows={5}
              maxLength={5000}
              onChange={(e) => aoMudar({ ...bloco, texto: e.target.value })}
              className={cn(CAMPO, "resize-y")}
            />
          </Rotulo>
          <div className="sm:w-40">
            <SeletorDeAlinhamento
              valor={bloco.alinhamento ?? "esquerda"}
              aoMudar={(alinhamento) => aoMudar({ ...bloco, alinhamento })}
            />
          </div>
        </div>
      );

    case "destaque":
      return (
        <div className="grid gap-3 sm:grid-cols-[9rem_1fr]">
          <Rotulo texto={t("Tom")}>
            <SelectDoApp
              value={bloco.tom}
              onChange={(e) => aoMudar({ ...bloco, tom: e.target.value as typeof bloco.tom })}
              className={CAMPO}
            >
              <option value="info">{t("Informação")}</option>
              <option value="sucesso">{t("Conquista")}</option>
              <option value="atencao">{t("Atenção")}</option>
            </SelectDoApp>
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
            <SelectDoApp
              value={bloco.estilo}
              onChange={(e) => aoMudar({ ...bloco, estilo: e.target.value as typeof bloco.estilo })}
              className={CAMPO}
            >
              <option value="marcadores">{t("Marcadores")}</option>
              <option value="numerada">{t("Numerada")}</option>
              <option value="check">{t("Com check")}</option>
            </SelectDoApp>
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
              <SeletorDeImagem
                arquivo={bloco[lado].imagem ?? ""}
                aoMudar={(imagem) => aoMudar({ ...bloco, [lado]: { ...bloco[lado], imagem } })}
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
            <div className="flex flex-1 flex-wrap items-center gap-2">
              <input
                type="color"
                value={item.hex}
                aria-label={t("Cor")}
                onChange={(e) => mudar({ ...item, hex: e.target.value })}
                className="h-10 w-12 shrink-0 cursor-pointer rounded-lg border bg-background p-1"
              />
              <CampoDeHex hex={item.hex} aoMudar={(hex) => mudar({ ...item, hex })} />
              <input
                value={item.nome}
                maxLength={40}
                placeholder={t("Nome da cor")}
                aria-label={t("Nome da cor")}
                onChange={(e) => mudar({ ...item, nome: e.target.value })}
                className={cn(CAMPO, "min-w-32 flex-1")}
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

    case "piramide":
      return (
        <div className="grid gap-3">
          <Rotulo texto={t("Forma")}>
            <SelectDoApp
              value={bloco.forma}
              onChange={(e) => aoMudar({ ...bloco, forma: e.target.value as typeof bloco.forma })}
              className={cn(CAMPO, "sm:w-56")}
            >
              {FORMAS_DOS_NIVEIS.map((f) => (
                <option key={f} value={f}>
                  {f === "piramide" ? t("Pirâmide (topo estreito)") : t("Funil (topo largo)")}
                </option>
              ))}
            </SelectDoApp>
          </Rotulo>
          <p className="text-xs text-muted-foreground">
            {t("Do topo para a base, na ordem em que aparecem.")}
          </p>
          <ListaEditavel
            itens={bloco.itens}
            aoMudar={(itens) => aoMudar({ ...bloco, itens })}
            novo={{ titulo: "", texto: "" }}
            maximo={8}
            rotuloDeAdicionar={t("Adicionar nível")}
            renderizar={(item, mudar) => (
              <div className="grid flex-1 gap-2">
                <input
                  value={item.titulo}
                  maxLength={200}
                  placeholder={t("Nome do nível")}
                  aria-label={t("Nome do nível")}
                  onChange={(e) => mudar({ ...item, titulo: e.target.value })}
                  className={CAMPO}
                />
                <textarea
                  value={item.texto}
                  rows={2}
                  maxLength={600}
                  placeholder={t("Descrição")}
                  aria-label={t("Descrição")}
                  onChange={(e) => mudar({ ...item, texto: e.target.value })}
                  className={cn(CAMPO, "resize-y")}
                />
              </div>
            )}
          />
        </div>
      );

    case "fluxo":
      return (
        <ListaEditavel
          itens={bloco.itens}
          aoMudar={(itens) => aoMudar({ ...bloco, itens })}
          novo={{ titulo: "", texto: "" }}
          maximo={24}
          rotuloDeAdicionar={t("Adicionar etapa")}
          renderizar={(item, mudar) => (
            <div className="grid flex-1 gap-2 sm:grid-cols-2">
              <input
                value={item.titulo}
                maxLength={200}
                placeholder={t("Nome da etapa")}
                aria-label={t("Nome da etapa")}
                onChange={(e) => mudar({ ...item, titulo: e.target.value })}
                className={CAMPO}
              />
              <input
                value={item.texto}
                maxLength={200}
                placeholder={t("Detalhe (opcional)")}
                aria-label={t("Detalhe")}
                onChange={(e) => mudar({ ...item, texto: e.target.value })}
                className={CAMPO}
              />
            </div>
          )}
        />
      );

    case "tabela":
      return (
        <div className="grid gap-2">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[28rem] border-separate border-spacing-1">
              <thead>
                <tr>
                  {bloco.colunas.map((c, i) => (
                    <th key={i} className="font-normal">
                      <div className="flex items-center gap-1">
                        <input
                          value={c}
                          maxLength={60}
                          aria-label={`${t("Coluna")} ${i + 1}`}
                          onChange={(e) =>
                            aoMudar({
                              ...bloco,
                              colunas: bloco.colunas.map((x, k) => (k === i ? e.target.value : x)),
                            })
                          }
                          className={cn(CAMPO, "font-semibold")}
                        />
                        {bloco.colunas.length > 1 ? (
                          <BotaoDeIcone
                            rotulo={t("Remover coluna")}
                            perigo
                            aoClicar={() =>
                              aoMudar({
                                ...bloco,
                                colunas: bloco.colunas.filter((_, k) => k !== i),
                                linhas: bloco.linhas.map((l) => l.filter((_, k) => k !== i)),
                              })
                            }
                          >
                            <X size={14} aria-hidden />
                          </BotaoDeIcone>
                        ) : null}
                      </div>
                    </th>
                  ))}
                  <th />
                </tr>
              </thead>
              <tbody>
                {bloco.linhas.map((linha, r) => (
                  <tr key={r}>
                    {bloco.colunas.map((_, i) => (
                      <td key={i}>
                        <input
                          value={linha[i] ?? ""}
                          maxLength={300}
                          aria-label={`${t("Linha")} ${r + 1}, ${t("Coluna")} ${i + 1}`}
                          onChange={(e) =>
                            aoMudar({
                              ...bloco,
                              linhas: bloco.linhas.map((l, k) =>
                                k === r
                                  ? bloco.colunas.map((__, c) =>
                                      c === i ? e.target.value : (l[c] ?? ""),
                                    )
                                  : l,
                              ),
                            })
                          }
                          className={CAMPO}
                        />
                      </td>
                    ))}
                    <td>
                      <BotaoDeIcone
                        rotulo={t("Remover linha")}
                        perigo
                        aoClicar={() =>
                          aoMudar({ ...bloco, linhas: bloco.linhas.filter((_, k) => k !== r) })
                        }
                      >
                        <X size={14} aria-hidden />
                      </BotaoDeIcone>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap gap-2">
            {bloco.linhas.length < 40 ? (
              <button
                type="button"
                onClick={() =>
                  aoMudar({ ...bloco, linhas: [...bloco.linhas, bloco.colunas.map(() => "")] })
                }
                className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm text-primary hover:bg-secondary"
              >
                <Plus size={14} weight="bold" aria-hidden />
                {t("Adicionar linha")}
              </button>
            ) : null}
            {bloco.colunas.length < 8 ? (
              <button
                type="button"
                onClick={() =>
                  aoMudar({
                    ...bloco,
                    colunas: [...bloco.colunas, ""],
                    linhas: bloco.linhas.map((l) => [
                      ...bloco.colunas.map((_, k) => l[k] ?? ""),
                      "",
                    ]),
                  })
                }
                className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm text-primary hover:bg-secondary"
              >
                <Plus size={14} weight="bold" aria-hidden />
                {t("Adicionar coluna")}
              </button>
            ) : null}
          </div>
        </div>
      );

    case "oferta":
      return (
        <EditorDeOferta
          bloco={bloco}
          titulo={tituloDaPagina ?? ""}
          chave={chaveDaPagina}
          aoMudar={aoMudar}
        />
      );

    case "calculadora":
      return (
        <div className="grid gap-3">
          <p className="text-xs text-muted-foreground">
            {t(
              "Preencha o que souber. Vendas, leads, investimento e retorno são calculados sozinhos.",
            )}
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            {(
              [
                ["meta", t("Meta de faturamento (R$)"), "8000"],
                ["ticket", t("Ticket médio (R$)"), "1500"],
                ["conversao", t("Conversão de lead em venda (%)"), "10"],
                ["cpl", t("Custo por lead (R$)"), "25"],
                ["margem", t("Margem de contribuição (%)"), "60"],
                ["retencao", t("Meses de retenção do cliente"), "6"],
              ] as const
            ).map(([campo, rotulo, exemplo]) => (
              <Rotulo key={campo} texto={rotulo}>
                {campo === "meta" || campo === "ticket" || campo === "cpl" ? (
                  <CampoDeMoeda
                    valor={bloco[campo]}
                    aoMudar={(v) => aoMudar({ ...bloco, [campo]: v })}
                    className={CAMPO}
                  />
                ) : (
                  <input
                    value={bloco[campo]}
                    maxLength={24}
                    inputMode="decimal"
                    placeholder={exemplo}
                    onChange={(e) => aoMudar({ ...bloco, [campo]: e.target.value })}
                    className={CAMPO}
                  />
                )}
              </Rotulo>
            ))}
          </div>
        </div>
      );

    case "ficha":
      return (
        <div className="grid gap-3">
          <Rotulo texto={t("Introdução")}>
            <textarea
              value={bloco.intro}
              rows={3}
              maxLength={1500}
              onChange={(e) => aoMudar({ ...bloco, intro: e.target.value })}
              className={cn(CAMPO, "resize-y")}
            />
          </Rotulo>
          <ListaEditavel
            itens={bloco.links}
            aoMudar={(links) => aoMudar({ ...bloco, links })}
            novo={{ rotulo: "", url: "", destaque: false }}
            maximo={12}
            rotuloDeAdicionar={t("Adicionar link")}
            renderizar={(item, mudar) => (
              <div className="grid flex-1 gap-2 sm:grid-cols-[1fr_1.4fr_auto]">
                <input
                  value={item.rotulo}
                  maxLength={60}
                  placeholder={t("Nome (ex.: Site, Instagram)")}
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
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={item.destaque}
                    onChange={(e) => mudar({ ...item, destaque: e.target.checked })}
                  />
                  {t("Botão em destaque")}
                </label>
              </div>
            )}
          />
        </div>
      );

    case "matriz":
      return (
        <div className="grid gap-3">
          <Rotulo texto={t("Estilo")}>
            <SelectDoApp
              value={bloco.estilo}
              onChange={(e) => aoMudar({ ...bloco, estilo: e.target.value as typeof bloco.estilo })}
              className={cn(CAMPO, "sm:w-56")}
            >
              {ESTILOS_DA_MATRIZ.map((x) => (
                <option key={x} value={x}>
                  {x === "swot" ? t("SWOT (com cores)") : t("Neutro")}
                </option>
              ))}
            </SelectDoApp>
          </Rotulo>
          <div className="grid gap-3 sm:grid-cols-2">
            {bloco.celulas.map((c, i) => (
              <div key={i} className="grid gap-2 rounded-xl bg-secondary/40 p-3">
                <input
                  value={c.titulo}
                  maxLength={200}
                  placeholder={t("Título")}
                  aria-label={`${t("Título")} ${i + 1}`}
                  onChange={(e) =>
                    aoMudar({
                      ...bloco,
                      celulas: bloco.celulas.map((x, k) =>
                        k === i ? { ...x, titulo: e.target.value } : x,
                      ),
                    })
                  }
                  className={CAMPO}
                />
                <textarea
                  value={c.texto}
                  rows={3}
                  maxLength={1500}
                  placeholder={t("Texto")}
                  aria-label={`${t("Texto")} ${i + 1}`}
                  onChange={(e) =>
                    aoMudar({
                      ...bloco,
                      celulas: bloco.celulas.map((x, k) =>
                        k === i ? { ...x, texto: e.target.value } : x,
                      ),
                    })
                  }
                  className={cn(CAMPO, "resize-y")}
                />
              </div>
            ))}
          </div>
        </div>
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
          <div className="sm:w-40">
            <SeletorDeAlinhamento
              valor={bloco.alinhamento ?? "esquerda"}
              aoMudar={(alinhamento) => aoMudar({ ...bloco, alinhamento })}
            />
          </div>
        </div>
      );

    case "imagem":
      return (
        <div className="grid gap-3">
          <SeletorDeImagem
            arquivo={bloco.arquivo}
            aoMudar={(arquivo) => aoMudar({ ...bloco, arquivo })}
          />
          <Rotulo texto={t("Legenda (opcional)")}>
            <input
              value={bloco.legenda}
              maxLength={200}
              onChange={(e) => aoMudar({ ...bloco, legenda: e.target.value })}
              className={CAMPO}
            />
          </Rotulo>
          <div className="grid gap-3 sm:grid-cols-2">
            <Rotulo texto={t("Largura")}>
              <SelectDoApp
                value={bloco.largura}
                onChange={(e) =>
                  aoMudar({ ...bloco, largura: e.target.value as typeof bloco.largura })
                }
                className={CAMPO}
              >
                {LARGURAS_DA_IMAGEM.map((l) => (
                  <option key={l} value={l}>
                    {l === "pequena"
                      ? t("Pequena")
                      : l === "media"
                        ? t("Média")
                        : l === "grande"
                          ? t("Grande")
                          : t("Largura total")}
                  </option>
                ))}
              </SelectDoApp>
            </Rotulo>
            <SeletorDeAlinhamento
              valor={bloco.alinhamento}
              aoMudar={(alinhamento) => aoMudar({ ...bloco, alinhamento })}
            />
          </div>
        </div>
      );

    case "imagem-texto":
      return (
        <div className="grid gap-3">
          <SeletorDeImagem
            arquivo={bloco.arquivo}
            aoMudar={(arquivo) => aoMudar({ ...bloco, arquivo })}
          />
          <Rotulo texto={t("Imagem fica à")}>
            <SelectDoApp
              value={bloco.lado}
              onChange={(e) => aoMudar({ ...bloco, lado: e.target.value as typeof bloco.lado })}
              className={cn(CAMPO, "sm:w-40")}
            >
              {LADOS_DA_IMAGEM.map((l) => (
                <option key={l} value={l}>
                  {l === "esquerda" ? t("Esquerda") : t("Direita")}
                </option>
              ))}
            </SelectDoApp>
          </Rotulo>
          <Rotulo texto={t("Título")}>
            <input
              value={bloco.titulo}
              maxLength={200}
              onChange={(e) => aoMudar({ ...bloco, titulo: e.target.value })}
              className={CAMPO}
            />
          </Rotulo>
          <Rotulo texto={t("Texto")}>
            <textarea
              value={bloco.texto}
              rows={4}
              maxLength={2500}
              onChange={(e) => aoMudar({ ...bloco, texto: e.target.value })}
              className={cn(CAMPO, "resize-y")}
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

/**
 * O código da cor em hexadecimal (#RRGGBB): digitar ou colar o código escolhe a cor, e o seletor
 * ao lado continua valendo. Enquanto o código está incompleto não muda a cor; ao sair do campo,
 * volta para o último código válido.
 */
function CampoDeHex({ hex, aoMudar }: { hex: string; aoMudar: (hex: string) => void }) {
  const t = useT();
  const [digitado, setDigitado] = useState<string | null>(null);
  const valor = digitado ?? hex.toUpperCase();
  const invalido = digitado !== null && !/^#?[0-9a-fA-F]{6}$/.test(digitado.trim());
  return (
    <input
      value={valor}
      maxLength={7}
      spellCheck={false}
      autoCapitalize="characters"
      placeholder="#366D6F"
      aria-label={t("Código da cor (hexadecimal)")}
      aria-invalid={invalido}
      onChange={(e) => {
        const texto = e.target.value.trim();
        setDigitado(texto);
        if (/^#?[0-9a-fA-F]{6}$/.test(texto)) {
          aoMudar(`#${texto.replace("#", "")}`.toUpperCase());
          setDigitado(null);
        }
      }}
      onBlur={() => setDigitado(null)}
      className={cn(CAMPO, "w-28 font-mono uppercase", invalido && "border-error")}
    />
  );
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
