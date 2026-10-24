"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { chaveDosLotes } from "@/components/marketing/campanhas/LotesDaCampanha";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useT } from "@/hooks/i18n/useT";
import type { PreviaDaImportacao } from "@/lib/leads/previa-da-importacao";
import type { ResumoDaImportacao } from "@/lib/leads/importar-planilha";
import { FileText } from "@/lib/ui/icons";

type Resposta<T> = { data: T } | { error?: { message?: string } };

/**
 * IMPORTAR LEADS na campanha: escolhe a planilha, vê a PRÉVIA (novos, repetidos, já no CRM,
 * inválidos) e só então confirma. Os leads entram no funil da campanha, já com a campanha e o
 * arquivo na origem, e a importação fica no registro de lotes.
 */
export function ImportarLeadsDaCampanha({ campanhaId }: { campanhaId: string }) {
  const t = useT();
  const qc = useQueryClient();
  const entradaRef = useRef<HTMLInputElement>(null);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [previa, setPrevia] = useState<PreviaDaImportacao | null>(null);
  const [resumo, setResumo] = useState<ResumoDaImportacao | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function enviar<T>(f: File, confirmar: boolean): Promise<T | null> {
    const form = new FormData();
    form.append("file", f);
    if (confirmar) form.append("confirmar", "1");
    try {
      const res = await fetch(`/api/v1/demand-campaigns/${campanhaId}/importacao`, {
        method: "POST",
        body: form,
      });
      const json = (await res.json()) as Resposta<T>;
      if (!res.ok || !("data" in json)) {
        setErro(
          ("error" in json ? json.error?.message : undefined) ??
            t("Não consegui ler essa planilha."),
        );
        return null;
      }
      return json.data;
    } catch {
      setErro(t("Não consegui enviar o arquivo."));
      return null;
    }
  }

  function limpar() {
    setArquivo(null);
    setPrevia(null);
    setResumo(null);
    setErro(null);
    if (entradaRef.current) entradaRef.current.value = "";
  }

  async function escolher(f: File) {
    setArquivo(f);
    setPrevia(null);
    setResumo(null);
    setErro(null);
    setOcupado(true);
    const r = await enviar<{ previa: PreviaDaImportacao }>(f, false);
    setOcupado(false);
    if (r) setPrevia(r.previa);
  }

  async function confirmar() {
    if (!arquivo) return;
    setOcupado(true);
    const r = await enviar<{ resumo: ResumoDaImportacao }>(arquivo, true);
    setOcupado(false);
    if (!r) return;
    setResumo(r.resumo);
    setPrevia(null);
    void qc.invalidateQueries({ queryKey: chaveDosLotes(campanhaId) });
    toast.success(`${r.resumo.criados} ${t("leads importados para a campanha")}`);
  }

  const aImportar = previa ? previa.novos + previa.ja_no_crm : 0;

  return (
    <Card className="grid gap-3 rounded-2xl p-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">{t("Importar leads")}</h2>
          <p className="text-sm text-muted-foreground">
            {t(
              "Suba uma planilha (CSV) de contatos que você já tem. Eles entram no funil desta campanha, já com a origem certa.",
            )}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" size="sm" className="rounded-full" asChild>
            <a href="/api/v1/leads/import" download>
              {t("Planilha modelo")}
            </a>
          </Button>
          <Button
            size="sm"
            className="rounded-full"
            disabled={ocupado}
            onClick={() => entradaRef.current?.click()}
          >
            <FileText size={14} aria-hidden />
            {arquivo ? t("Trocar planilha") : t("Escolher planilha")}
          </Button>
        </div>
        <input
          ref={entradaRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          aria-label={t("Escolher planilha")}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void escolher(f);
          }}
        />
      </header>

      {erro ? (
        <p role="alert" className="rounded-xl bg-error-bg px-3 py-2 text-sm text-error-fg">
          {erro}
        </p>
      ) : null}

      {ocupado && !previa ? (
        <p className="text-sm text-muted-foreground">{t("Lendo a planilha…")}</p>
      ) : null}

      {previa && arquivo ? (
        <div className="grid gap-3">
          <p className="text-sm font-medium">
            {arquivo.name} · {previa.total_linhas} {t("linhas")}
          </p>
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Numero rotulo={t("Novos")} valor={previa.novos} destaque />
            <Numero rotulo={t("Já no CRM")} valor={previa.ja_no_crm} />
            <Numero rotulo={t("Repetidos na planilha")} valor={previa.repetidas_na_planilha} />
            <Numero rotulo={t("Recusadas")} valor={previa.invalidas} />
          </dl>
          {previa.erros.length > 0 ? (
            <details className="rounded-xl border p-3 text-sm">
              <summary className="cursor-pointer font-medium">{t("Ver linhas recusadas")}</summary>
              <ul className="mt-2 grid gap-1 text-muted-foreground">
                {previa.erros.map((e) => (
                  <li key={e.linha}>
                    {t("Linha")} {e.linha}: {e.motivo}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button variant="outline" className="rounded-full" onClick={limpar} disabled={ocupado}>
              {t("Cancelar")}
            </Button>
            <Button
              className="rounded-full"
              onClick={() => void confirmar()}
              disabled={ocupado || previa.validas === 0}
            >
              {ocupado ? t("Importando…") : `${t("Importar")} ${aImportar} ${t("leads")}`}
            </Button>
          </div>
        </div>
      ) : null}

      {resumo ? (
        <div className="grid gap-2 rounded-xl bg-success-bg px-4 py-3 text-sm text-success-fg">
          <p className="font-medium">
            {resumo.criados} {t("leads importados")} · {resumo.contatos_criados}{" "}
            {t("contatos novos")}
            {resumo.erros.length > 0 ? ` · ${resumo.erros.length} ${t("recusadas")}` : ""}
          </p>
          {resumo.erros.length > 0 ? (
            <ul className="grid gap-0.5 text-xs">
              {resumo.erros.slice(0, 10).map((e, i) => (
                <li key={`${e.linha}-${i}`}>
                  {t("Linha")} {e.linha}: {e.motivo}
                </li>
              ))}
            </ul>
          ) : null}
          <div>
            <Button size="sm" variant="outline" className="rounded-full" onClick={limpar}>
              {t("Importar outra planilha")}
            </Button>
          </div>
        </div>
      ) : null}
    </Card>
  );
}

function Numero({
  rotulo,
  valor,
  destaque = false,
}: {
  rotulo: string;
  valor: number;
  destaque?: boolean;
}) {
  return (
    <div
      className={
        destaque ? "rounded-xl bg-primary/10 px-3 py-2" : "rounded-xl bg-secondary/60 px-3 py-2"
      }
    >
      <dt className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
        {rotulo}
      </dt>
      <dd className="text-xl font-semibold tabular-nums">{valor}</dd>
    </div>
  );
}
