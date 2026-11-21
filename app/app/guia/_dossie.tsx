"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { useT } from "@/hooks/i18n/useT";
import { passoPorId } from "@/lib/guia/catalogo";
import { MAXIMO_DA_PERGUNTA, type TamanhoDoDossie } from "@/lib/guia/dossie";
import { PROMPTS, montarPrompt, promptPorId } from "@/lib/guia/prompts";

import {
  baixarMarkdown,
  buscarDossie,
  copiarTexto,
  nomeParaArquivo,
  type DossieDaApi,
} from "./_copiar";

const BOTAO =
  "h-9 rounded-xl border px-3 text-sm font-medium transition-colors hover:bg-secondary disabled:opacity-60";

/**
 * "Dossiê e IA": gera o documento que uma IA lê para conhecer o projeto, e o prompt pronto para
 * colar na IA da própria pessoa. O resultado volta pela Estratégia › Importar de texto.
 */
export function DossieEIa() {
  const t = useT();
  const [tamanho, setTamanho] = useState<TamanhoDoDossie>("completo");
  const [pergunta, setPergunta] = useState("");
  const [dossie, setDossie] = useState<DossieDaApi | null>(null);
  const [gerando, setGerando] = useState(false);
  const [promptId, setPromptId] = useState("consultor");

  const prompt = promptPorId(promptId) ?? PROMPTS[0]!;
  const paginaDoPasso = prompt.passos[0] ? passoPorId(prompt.passos[0])?.onde : undefined;

  async function gerar(): Promise<DossieDaApi | null> {
    setGerando(true);
    try {
      const d = await buscarDossie(tamanho, pergunta);
      setDossie(d);
      return d;
    } catch {
      toast.error(t("Não foi possível gerar o dossiê agora."));
      return null;
    } finally {
      setGerando(false);
    }
  }

  async function copiar(texto: string, aviso: string) {
    if (await copiarTexto(texto)) toast.success(aviso);
    else toast.error(t("Não foi possível copiar. Use Baixar e abra o arquivo."));
  }

  async function copiarPrompt() {
    const d = dossie ?? (await gerar());
    if (d) await copiar(montarPrompt(prompt, d.markdown), t("Prompt copiado. Cole na sua IA."));
  }

  return (
    <div className="flex flex-col gap-5" data-testid="guia-dossie">
      <p className="rounded-xl border border-dashed px-4 py-3 text-xs text-muted-foreground">
        {t(
          "O dossiê reúne o perfil, a estratégia, as ofertas, as campanhas e o estado do Guia, tudo calculado pelo sistema. Nenhum dado pessoal de lead entra. Cole numa IA da sua conta para pedir análises e rascunhos.",
        )}
      </p>

      <section
        aria-label={t("Dossiê do projeto")}
        className="grid gap-3 rounded-2xl border bg-card p-4"
      >
        <h2 className="text-base font-semibold">{t("Dossiê do projeto")}</h2>
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <label className="flex items-center gap-1.5">
            <input
              type="radio"
              checked={tamanho === "completo"}
              onChange={() => setTamanho("completo")}
            />
            {t("Completo")}
          </label>
          <label className="flex items-center gap-1.5">
            <input
              type="radio"
              checked={tamanho === "resumido"}
              onChange={() => setTamanho("resumido")}
            />
            {t("Resumido (cabe em qualquer IA)")}
          </label>
        </div>
        <label className="grid gap-1 text-sm">
          <span className="font-medium">{t("Pergunta atual (opcional)")}</span>
          <textarea
            value={pergunta}
            onChange={(e) => setPergunta(e.target.value)}
            maxLength={MAXIMO_DA_PERGUNTA}
            rows={2}
            placeholder={t("O que você quer decidir agora?")}
            className="rounded-xl border bg-background px-3 py-2 text-sm"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={BOTAO} disabled={gerando} onClick={() => void gerar()}>
            {gerando ? t("Gerando…") : dossie ? t("Gerar de novo") : t("Gerar dossiê")}
          </button>
          {dossie ? (
            <>
              <button
                type="button"
                className={BOTAO}
                onClick={() => void copiar(dossie.markdown, t("Dossiê copiado."))}
              >
                {t("Copiar dossiê")}
              </button>
              <button
                type="button"
                className={BOTAO}
                onClick={() =>
                  baixarMarkdown(
                    `dossie-${nomeParaArquivo(dossie.empresa)}-${dossie.geradoEm.slice(0, 10)}.md`,
                    dossie.markdown,
                  )
                }
              >
                {t("Baixar .md")}
              </button>
            </>
          ) : null}
        </div>
        {dossie ? (
          <>
            <p className="text-xs text-muted-foreground">
              {dossie.caracteres.toLocaleString("pt-BR")} {t("caracteres")} · ≈{" "}
              {dossie.tokensAproximados.toLocaleString("pt-BR")} {t("tokens")} · {t("gerado em")}{" "}
              {dossie.geradoEm.slice(0, 10)}
            </p>
            <pre
              className="max-h-96 overflow-auto rounded-xl bg-secondary p-3 text-xs whitespace-pre-wrap"
              tabIndex={0}
            >
              {dossie.markdown}
            </pre>
          </>
        ) : null}
      </section>

      <section
        aria-label={t("Prompt pronto")}
        className="grid gap-3 rounded-2xl border bg-card p-4"
      >
        <h2 className="text-base font-semibold">{t("Prompt pronto para a sua IA")}</h2>
        <label className="grid gap-1 text-sm">
          <span className="font-medium">{t("O que você quer pedir")}</span>
          <select
            value={promptId}
            onChange={(e) => setPromptId(e.target.value)}
            className="h-10 rounded-xl border bg-background px-3 text-sm"
          >
            {PROMPTS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.titulo}
              </option>
            ))}
          </select>
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={BOTAO}
            disabled={gerando}
            onClick={() => void copiarPrompt()}
          >
            {t("Copiar prompt (com o dossiê)")}
          </button>
          {paginaDoPasso && prompt.viraPagina ? (
            <Link href={paginaDoPasso.href} className={`${BOTAO} inline-flex items-center`}>
              {t("Abrir a página para colar o resultado")}
            </Link>
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground">
          {prompt.viraPagina
            ? t(
                "Cole o prompt na sua IA, copie a resposta e, na página da Estratégia, use Importar de texto. Nada é publicado sozinho: entra como rascunho para você revisar.",
              )
            : t(
                "Cole o prompt na sua IA e siga as ações que ela sugerir; use Criar tarefa nos passos do Guia.",
              )}
        </p>
      </section>
    </div>
  );
}
