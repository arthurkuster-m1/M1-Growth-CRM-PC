"use client";

import { useRef, useState, type ReactNode } from "react";

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
import { BASE_DAS_IMAGENS_DO_PAINEL, TAMANHO_MAXIMO_DA_IMAGEM } from "@/lib/marketing/imagens";
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
      <select
        value={valor}
        onChange={(e) => aoMudar(e.target.value as (typeof ALINHAMENTOS)[number])}
        className={CAMPO}
      >
        {ALINHAMENTOS.map((a) => (
          <option key={a} value={a}>
            {rotulo(a)}
          </option>
        ))}
      </select>
    </Rotulo>
  );
}

/**
 * Escolher uma imagem do computador (ou da galeria do celular): sobe na hora, mostra a prévia e
 * devolve só o NOME do arquivo. Troca e remoção são do bloco — o arquivo antigo fica no bucket
 * (poucos KB de custo; apagar exigiria saber se outra página ainda o usa).
 */
function SeletorDeImagem({
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
        <div className="grid gap-3 sm:grid-cols-[9rem_9rem_1fr]">
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
            <select
              value={bloco.forma}
              onChange={(e) => aoMudar({ ...bloco, forma: e.target.value as typeof bloco.forma })}
              className={cn(CAMPO, "sm:w-56")}
            >
              {FORMAS_DOS_NIVEIS.map((f) => (
                <option key={f} value={f}>
                  {f === "piramide" ? t("Pirâmide (topo estreito)") : t("Funil (topo largo)")}
                </option>
              ))}
            </select>
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
            <select
              value={bloco.estilo}
              onChange={(e) => aoMudar({ ...bloco, estilo: e.target.value as typeof bloco.estilo })}
              className={cn(CAMPO, "sm:w-56")}
            >
              {ESTILOS_DA_MATRIZ.map((x) => (
                <option key={x} value={x}>
                  {x === "swot" ? t("SWOT (com cores)") : t("Neutro")}
                </option>
              ))}
            </select>
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
              <select
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
              </select>
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
            <select
              value={bloco.lado}
              onChange={(e) => aoMudar({ ...bloco, lado: e.target.value as typeof bloco.lado })}
              className={cn(CAMPO, "sm:w-40")}
            >
              {LADOS_DA_IMAGEM.map((l) => (
                <option key={l} value={l}>
                  {l === "esquerda" ? t("Esquerda") : t("Direita")}
                </option>
              ))}
            </select>
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
