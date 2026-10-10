"use client";

import { useState, type ReactNode } from "react";
import { toast } from "sonner";

import { SeletorDeImagem } from "@/components/marketing/SeletorDeImagem";
import { useT } from "@/hooks/i18n/useT";
import { ETAPAS_DA_OFERTA, TIPOS_DE_PRECO, type Bloco } from "@/lib/marketing/blocos";
import { ofertaParaTexto, type Oferta } from "@/lib/marketing/oferta";
import { Plus, X } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";

const CAMPO =
  "w-full rounded-xl border bg-background px-3 py-2 text-sm outline-hidden focus:border-primary/60 focus:ring-2 focus:ring-primary/20";

function Rotulo({ texto, children }: { texto: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-muted-foreground">{texto}</span>
      {children}
    </label>
  );
}

/** Uma lista de textos curtos, um por linha de campo, com adicionar e remover. */
function ListaDeTextos({
  itens,
  aoMudar,
  maximo,
  adicionar,
  placeholder,
}: {
  itens: string[];
  aoMudar: (itens: string[]) => void;
  maximo: number;
  adicionar: string;
  placeholder: string;
}) {
  const t = useT();
  return (
    <div className="flex flex-col gap-2">
      {itens.map((item, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            value={item}
            maxLength={200}
            placeholder={placeholder}
            aria-label={placeholder}
            onChange={(e) => aoMudar(itens.map((x, k) => (k === i ? e.target.value : x)))}
            className={CAMPO}
          />
          <button
            type="button"
            aria-label={t("Remover item")}
            onClick={() => aoMudar(itens.filter((_, k) => k !== i))}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-error-fg"
          >
            <X size={14} aria-hidden />
          </button>
        </div>
      ))}
      {itens.length < maximo ? (
        <button
          type="button"
          onClick={() => aoMudar([...itens, ""])}
          className="inline-flex h-9 w-fit items-center gap-1.5 rounded-lg px-3 text-sm text-primary hover:bg-secondary"
        >
          <Plus size={14} weight="bold" aria-hidden />
          {adicionar}
        </button>
      ) : null}
    </div>
  );
}

/** Uma lista de pares (ex.: entregável com valor, pergunta e resposta). */
function ListaDePares<T extends Record<string, string>>({
  itens,
  aoMudar,
  novo,
  maximo,
  adicionar,
  campos,
}: {
  itens: T[];
  aoMudar: (itens: T[]) => void;
  novo: T;
  maximo: number;
  adicionar: string;
  campos: Array<{ chave: keyof T & string; rotulo: string; longo?: boolean; estreito?: boolean }>;
}) {
  const t = useT();
  return (
    <div className="flex flex-col gap-3">
      {itens.map((item, i) => (
        <div key={i} className="flex items-start gap-2 rounded-xl bg-secondary/40 p-3">
          <div className="grid flex-1 gap-2 sm:grid-cols-[1fr_auto]">
            {campos.map((c) =>
              c.longo ? (
                <textarea
                  key={c.chave}
                  value={item[c.chave]}
                  rows={2}
                  maxLength={600}
                  placeholder={c.rotulo}
                  aria-label={c.rotulo}
                  onChange={(e) =>
                    aoMudar(
                      itens.map((x, k) => (k === i ? { ...x, [c.chave]: e.target.value } : x)),
                    )
                  }
                  className={cn(CAMPO, "resize-y sm:col-span-2")}
                />
              ) : (
                <input
                  key={c.chave}
                  value={item[c.chave]}
                  maxLength={c.estreito ? 24 : 200}
                  placeholder={c.rotulo}
                  aria-label={c.rotulo}
                  onChange={(e) =>
                    aoMudar(
                      itens.map((x, k) => (k === i ? { ...x, [c.chave]: e.target.value } : x)),
                    )
                  }
                  className={cn(CAMPO, c.estreito && "sm:w-36")}
                />
              ),
            )}
          </div>
          <button
            type="button"
            aria-label={t("Remover item")}
            onClick={() => aoMudar(itens.filter((_, k) => k !== i))}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-error-fg"
          >
            <X size={14} aria-hidden />
          </button>
        </div>
      ))}
      {itens.length < maximo ? (
        <button
          type="button"
          onClick={() => aoMudar([...itens, structuredClone(novo)])}
          className="inline-flex h-9 w-fit items-center gap-1.5 rounded-lg px-3 text-sm text-primary hover:bg-secondary"
        >
          <Plus size={14} weight="bold" aria-hidden />
          {adicionar}
        </button>
      ) : null}
    </div>
  );
}

function Grupo({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <fieldset className="grid gap-3 rounded-2xl border p-4">
      <legend className="px-2 text-sm font-semibold">{titulo}</legend>
      {children}
    </fieldset>
  );
}

/**
 * O FORMULÁRIO da oferta: campos, e não blocos livres, porque a página do cliente e o texto
 * para a IA saem dos mesmos campos. A oferta começa SIMPLES (ficha curta); "Oferta completa"
 * abre promessa, valor empilhado, garantia, escassez e objeções.
 */
export function EditorDeOferta({
  bloco,
  titulo,
  chave,
  aoMudar,
}: {
  bloco: Oferta;
  titulo: string;
  /** A chave da página: liga a pré-visualização do cartão-resumo. */
  chave?: string;
  aoMudar: (b: Bloco) => void;
}) {
  const t = useT();
  const [copiado, setCopiado] = useState(false);
  const completa = bloco.nivel === "completa";
  const set = <K extends keyof Oferta>(k: K, v: Oferta[K]) => aoMudar({ ...bloco, [k]: v });
  const rotuloDaEtapa = (e: (typeof ETAPAS_DA_OFERTA)[number]) =>
    e === "isca"
      ? t("Isca")
      : e === "entrada"
        ? t("Produto de entrada")
        : e === "principal"
          ? t("Produto principal")
          : e === "expansao"
            ? t("Expansão")
            : t("Recorrência");
  const rotuloDoPreco = (p: (typeof TIPOS_DE_PRECO)[number]) =>
    p === "unico"
      ? t("Pagamento único")
      : p === "mensal"
        ? t("Mensal")
        : p === "setup-mensal"
          ? t("Setup + mensalidade")
          : p === "sob-consulta"
            ? t("Sob consulta")
            : t("Gratuito");

  async function copiarParaIA() {
    try {
      await navigator.clipboard.writeText(ofertaParaTexto(titulo, bloco));
      setCopiado(true);
      toast.success(t("Texto para a IA copiado."));
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      toast.info(t("Não foi possível copiar."));
    }
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div
          role="group"
          aria-label={t("Nível da oferta")}
          className="inline-flex rounded-xl bg-secondary p-0.5"
        >
          {(["simples", "completa"] as const).map((n) => (
            <button
              key={n}
              type="button"
              aria-pressed={bloco.nivel === n}
              onClick={() => set("nivel", n)}
              className={cn(
                "h-8 rounded-[10px] px-3 text-sm font-medium transition-colors",
                bloco.nivel === n
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {n === "simples" ? t("Produto simples") : t("Oferta completa")}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => void copiarParaIA()}
          className="ml-auto h-9 rounded-xl border px-3 text-sm font-medium hover:bg-secondary"
        >
          {copiado ? t("Copiado") : t("Copiar texto para a IA")}
        </button>
      </div>

      <Grupo titulo={t("O que é")}>
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <Rotulo texto={t("Etapa na escada de valor")}>
            <select
              value={bloco.etapa}
              onChange={(e) => set("etapa", e.target.value as Oferta["etapa"])}
              className={CAMPO}
            >
              {ETAPAS_DA_OFERTA.map((e) => (
                <option key={e} value={e}>
                  {rotuloDaEtapa(e)}
                </option>
              ))}
            </select>
          </Rotulo>
          <label className="flex items-end gap-2 pb-2 text-sm">
            <input
              type="checkbox"
              checked={bloco.carroChefe}
              onChange={(e) => set("carroChefe", e.target.checked)}
            />
            {t("É o carro-chefe")}
          </label>
        </div>
        <Rotulo texto={t("Resumo: o que é, em poucas linhas")}>
          <textarea
            value={bloco.resumo}
            rows={3}
            maxLength={800}
            onChange={(e) => set("resumo", e.target.value)}
            className={cn(CAMPO, "resize-y")}
          />
        </Rotulo>
        <div className="grid gap-3 sm:grid-cols-2">
          <Rotulo texto={t("Para quem é")}>
            <textarea
              value={bloco.paraQuem}
              rows={3}
              maxLength={600}
              onChange={(e) => set("paraQuem", e.target.value)}
              className={cn(CAMPO, "resize-y")}
            />
          </Rotulo>
          <Rotulo texto={t("Para quem não é")}>
            <textarea
              value={bloco.naoEParaQuem}
              rows={3}
              maxLength={600}
              onChange={(e) => set("naoEParaQuem", e.target.value)}
              className={cn(CAMPO, "resize-y")}
            />
          </Rotulo>
        </div>
      </Grupo>

      {completa ? (
        <Grupo titulo={t("A promessa")}>
          <Rotulo texto={t("Promessa em uma frase (resultado, prazo e o que não precisa fazer)")}>
            <textarea
              value={bloco.promessa}
              rows={3}
              maxLength={500}
              onChange={(e) => set("promessa", e.target.value)}
              className={cn(CAMPO, "resize-y")}
            />
          </Rotulo>
        </Grupo>
      ) : null}

      {completa ? (
        <>
          <Grupo titulo={t("O que a pessoa recebe")}>
            <ListaDePares
              itens={bloco.entregaveis}
              aoMudar={(v) => set("entregaveis", v)}
              novo={{ nome: "", descricao: "", valor: "" }}
              maximo={10}
              adicionar={t("Adicionar entregável")}
              campos={[
                { chave: "nome", rotulo: t("Nome do entregável") },
                { chave: "valor", rotulo: t("Valor de referência (R$)"), estreito: true },
                { chave: "descricao", rotulo: t("O que é e que problema resolve"), longo: true },
              ]}
            />
          </Grupo>
          <Grupo titulo={t("Bônus")}>
            <ListaDePares
              itens={bloco.bonus}
              aoMudar={(v) => set("bonus", v)}
              novo={{ nome: "", descricao: "", valor: "" }}
              maximo={6}
              adicionar={t("Adicionar bônus")}
              campos={[
                { chave: "nome", rotulo: t("Nome do bônus") },
                { chave: "valor", rotulo: t("Valor de referência (R$)"), estreito: true },
                { chave: "descricao", rotulo: t("Que objeção ou medo ele resolve"), longo: true },
              ]}
            />
          </Grupo>
        </>
      ) : (
        <Grupo titulo={t("O que está incluído")}>
          <ListaDeTextos
            itens={bloco.inclui}
            aoMudar={(v) => set("inclui", v)}
            maximo={14}
            adicionar={t("Adicionar item")}
            placeholder={t("O que está incluído")}
          />
        </Grupo>
      )}

      <Grupo titulo={t("O que não está incluído")}>
        <ListaDeTextos
          itens={bloco.naoInclui}
          aoMudar={(v) => set("naoInclui", v)}
          maximo={8}
          adicionar={t("Adicionar item")}
          placeholder={t("O que não está incluído")}
        />
      </Grupo>

      <Grupo titulo={t("Preço e prazo")}>
        <div className="grid gap-3 sm:grid-cols-3">
          <Rotulo texto={t("Como é cobrado")}>
            <select
              value={bloco.preco.tipo}
              onChange={(e) =>
                set("preco", { ...bloco.preco, tipo: e.target.value as Oferta["preco"]["tipo"] })
              }
              className={CAMPO}
            >
              {TIPOS_DE_PRECO.map((p) => (
                <option key={p} value={p}>
                  {rotuloDoPreco(p)}
                </option>
              ))}
            </select>
          </Rotulo>
          {bloco.preco.tipo === "setup-mensal" ? (
            <Rotulo texto={t("Setup (R$)")}>
              <input
                value={bloco.preco.setup}
                maxLength={24}
                placeholder="R$ 3.500"
                onChange={(e) => set("preco", { ...bloco.preco, setup: e.target.value })}
                className={CAMPO}
              />
            </Rotulo>
          ) : null}
          {bloco.preco.tipo !== "sob-consulta" && bloco.preco.tipo !== "gratuito" ? (
            <Rotulo
              texto={bloco.preco.tipo === "unico" ? t("Valor (R$)") : t("Valor por mês (R$)")}
            >
              <input
                value={bloco.preco.valor}
                maxLength={24}
                placeholder="R$ 1.500"
                onChange={(e) => set("preco", { ...bloco.preco, valor: e.target.value })}
                className={CAMPO}
              />
            </Rotulo>
          ) : null}
          <Rotulo texto={t("Prazo de entrega")}>
            <input
              value={bloco.prazo}
              maxLength={200}
              onChange={(e) => set("prazo", e.target.value)}
              className={CAMPO}
            />
          </Rotulo>
        </div>
        <Rotulo texto={t("Condições (contrato, pagamento, o que muda o valor)")}>
          <textarea
            value={bloco.preco.condicoes}
            rows={2}
            maxLength={400}
            onChange={(e) => set("preco", { ...bloco.preco, condicoes: e.target.value })}
            className={cn(CAMPO, "resize-y")}
          />
        </Rotulo>
        {completa ? (
          <Rotulo texto={t("O custo de não fazer nada")}>
            <textarea
              value={bloco.custoDaInacao}
              rows={2}
              maxLength={500}
              onChange={(e) => set("custoDaInacao", e.target.value)}
              className={cn(CAMPO, "resize-y")}
            />
          </Rotulo>
        ) : null}
      </Grupo>

      {completa ? (
        <>
          <Grupo titulo={t("Garantia e escassez")}>
            <Rotulo texto={t("Garantia (o texto exato que a IA deve citar)")}>
              <textarea
                value={bloco.garantia}
                rows={3}
                maxLength={900}
                onChange={(e) => set("garantia", e.target.value)}
                className={cn(CAMPO, "resize-y")}
              />
            </Rotulo>
            <Rotulo texto={t("Escassez ou urgência (precisa ser real)")}>
              <textarea
                value={bloco.escassez}
                rows={2}
                maxLength={600}
                onChange={(e) => set("escassez", e.target.value)}
                className={cn(CAMPO, "resize-y")}
              />
            </Rotulo>
          </Grupo>
          <Grupo titulo={t("Objeções e respostas aprovadas")}>
            <ListaDePares
              itens={bloco.objecoes}
              aoMudar={(v) => set("objecoes", v)}
              novo={{ objecao: "", resposta: "" }}
              maximo={10}
              adicionar={t("Adicionar objeção")}
              campos={[
                { chave: "objecao", rotulo: t("A objeção (como o cliente fala)") },
                { chave: "resposta", rotulo: t("A resposta aprovada"), longo: true },
              ]}
            />
          </Grupo>
        </>
      ) : null}

      <Grupo titulo={t("Perguntas frequentes")}>
        <ListaDePares
          itens={bloco.faq}
          aoMudar={(v) => set("faq", v)}
          novo={{ pergunta: "", resposta: "" }}
          maximo={10}
          adicionar={t("Adicionar pergunta")}
          campos={[
            { chave: "pergunta", rotulo: t("Pergunta") },
            { chave: "resposta", rotulo: t("Resposta"), longo: true },
          ]}
        />
      </Grupo>

      <Grupo titulo={t("Imagens que a IA envia junto")}>
        <p className="text-xs text-muted-foreground">
          {t(
            "Com imagem, a IA envia a imagem com o preço. Sem imagem, envia só o texto e o preço. Produto físico costuma pedir foto; serviço, em geral, não.",
          )}
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {(bloco.imagens ?? []).map((arquivo, i) => (
            <SeletorDeImagem
              key={i}
              arquivo={arquivo}
              aoMudar={(novo) =>
                set(
                  "imagens",
                  (bloco.imagens ?? []).flatMap((x, k) => (k === i ? (novo ? [novo] : []) : [x])),
                )
              }
            />
          ))}
          {(bloco.imagens ?? []).length < 4 ? (
            <SeletorDeImagem
              arquivo=""
              aoMudar={(novo) => novo && set("imagens", [...(bloco.imagens ?? []), novo])}
            />
          ) : null}
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={bloco.cartaoResumo === true}
            onChange={(e) => set("cartaoResumo", e.target.checked)}
          />
          {t("Enviar também um cartão-resumo da oferta (gerado automaticamente)")}
        </label>
        {bloco.cartaoResumo === true && chave ? (
          <a
            href={`/api/v1/marketing/ofertas/${chave}/cartao`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-fit text-sm font-medium text-primary hover:underline"
          >
            {t("Ver o cartão (salve a página antes)")}
          </a>
        ) : null}
      </Grupo>

      <Grupo titulo={t("Para a IA: o que nunca prometer")}>
        <ListaDeTextos
          itens={bloco.nuncaPrometer}
          aoMudar={(v) => set("nuncaPrometer", v)}
          maximo={8}
          adicionar={t("Adicionar limite")}
          placeholder={t("Ex.: nunca prometer resultado garantido em menos de 30 dias")}
        />
      </Grupo>
    </div>
  );
}
