"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";

import { showApiError } from "@/components/feedback/ApiErrorToast";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useT } from "@/hooks/i18n/useT";
import { apiClient } from "@/lib/api/client";
import {
  MAXIMO_DE_LINHAS,
  lerPlanilha,
  modeloDaPlanilha,
  ofertaDaLinha,
  type LinhaDaPlanilha,
} from "@/lib/marketing/produtos-csv";
import { cn } from "@/lib/utils";

interface Resultado {
  criados: number;
  pulados: Array<{ linha: number; nome: string }>;
  problemas: Array<{ linha: number; erro: string }>;
  publicados: boolean;
}

/** Baixa o modelo de planilha (CSV com `;`, que o Excel em português abre direto). */
export function baixarModeloDeProdutos() {
  const blob = new Blob([modeloDaPlanilha()], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "modelo-de-produtos.csv";
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * IMPORTAR PRODUTOS por planilha: baixa o modelo, a pessoa preenche (ou exporta do outro
 * sistema), envia, vê a PRÉVIA com o que está certo e o que precisa corrigir, e confirma.
 * Cada linha vira uma oferta simples; quem já existe pelo nome é pulado.
 */
export function ImportarProdutos({
  aberto,
  aoFechar,
  modulo,
}: {
  aberto: boolean;
  aoFechar: () => void;
  modulo: string;
}) {
  const t = useT();
  const queryClient = useQueryClient();
  const entrada = useRef<HTMLInputElement>(null);
  const [arquivo, setArquivo] = useState<string | null>(null);
  const [linhas, setLinhas] = useState<LinhaDaPlanilha[]>([]);
  const [erroDoArquivo, setErroDoArquivo] = useState<string | null>(null);
  const [ignoradas, setIgnoradas] = useState<string[]>([]);
  const [publicar, setPublicar] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<Resultado | null>(null);

  const conferidas = linhas.map((l, i) => ({
    linha: i + 2,
    nome: l.nome ?? "",
    r: ofertaDaLinha(l, () => "x"),
  }));
  const validas = conferidas.filter((c) => c.r.ok);
  const comErro = conferidas.filter((c) => !c.r.ok);

  function limpar() {
    setArquivo(null);
    setLinhas([]);
    setErroDoArquivo(null);
    setIgnoradas([]);
    setResultado(null);
    if (entrada.current) entrada.current.value = "";
  }

  async function aoEscolherArquivo(f: File | undefined) {
    if (!f) return;
    setResultado(null);
    if (f.size > 2_000_000) {
      setErroDoArquivo(t("O arquivo é grande demais. Divida a planilha em partes."));
      return;
    }
    const lida = lerPlanilha(await f.text());
    setArquivo(f.name);
    setIgnoradas(lida.ignoradas);
    if (lida.erro === "sem_nome") {
      setLinhas([]);
      setErroDoArquivo(t("Não encontrei a coluna “nome”. Use o modelo de planilha."));
      return;
    }
    if (lida.erro || lida.linhas.length === 0) {
      setLinhas([]);
      setErroDoArquivo(t("A planilha está vazia."));
      return;
    }
    if (lida.linhas.length > MAXIMO_DE_LINHAS) {
      setLinhas([]);
      setErroDoArquivo(t("A planilha tem mais de 300 linhas. Envie em partes."));
      return;
    }
    setErroDoArquivo(null);
    setLinhas(lida.linhas);
  }

  async function importar() {
    setEnviando(true);
    try {
      const r = await apiClient.post<{ data: Resultado }>("/api/v1/marketing/ofertas/importar", {
        linhas,
        publicar,
      });
      setResultado(r.data);
      await queryClient.invalidateQueries({ queryKey: ["marketing-subpaginas", modulo] });
    } catch (e) {
      showApiError(e);
    } finally {
      setEnviando(false);
    }
  }

  function fechar() {
    limpar();
    aoFechar();
  }

  return (
    <Dialog open={aberto} onOpenChange={(a) => !a && fechar()}>
      <DialogContent className="max-h-[88dvh] max-w-xl gap-4 overflow-y-auto p-5 sm:rounded-2xl">
        <DialogTitle className="text-base font-semibold">
          {t("Importar produtos por planilha")}
        </DialogTitle>
        <DialogDescription className="text-sm text-muted-foreground">
          {t(
            "Cada linha da planilha vira um produto ou serviço. Você completa os detalhes depois, só nos que valem a pena.",
          )}
        </DialogDescription>

        {resultado ? (
          <div className="grid gap-3 text-sm">
            <p className="rounded-xl bg-success-bg px-3 py-2 text-success-fg">
              {resultado.criados} {t("produtos criados")}
              {resultado.publicados
                ? ` · ${t("já publicados para a IA")}`
                : ` · ${t("em rascunho")}`}
            </p>
            {resultado.pulados.length > 0 ? (
              <div className="rounded-xl bg-secondary/60 px-3 py-2">
                <p className="font-medium">
                  {resultado.pulados.length} {t("já existiam e foram pulados")}
                </p>
                <ul className="mt-1 list-disc pl-5 text-xs text-muted-foreground">
                  {resultado.pulados.slice(0, 8).map((p) => (
                    <li key={p.linha}>
                      {t("Linha")} {p.linha}: {p.nome}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {resultado.problemas.length > 0 ? (
              <div className="rounded-xl bg-warning-bg px-3 py-2 text-warning-fg">
                <p className="font-medium">
                  {resultado.problemas.length} {t("linhas não entraram")}
                </p>
                <ul className="mt-1 list-disc pl-5 text-xs">
                  {resultado.problemas.slice(0, 8).map((p) => (
                    <li key={p.linha}>
                      {t("Linha")} {p.linha}: {p.erro}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <button
              type="button"
              onClick={fechar}
              className="h-10 rounded-xl bg-primary text-sm font-medium text-primary-foreground"
            >
              {t("Concluir")}
            </button>
          </div>
        ) : (
          <>
            <div className="grid gap-2 rounded-2xl bg-secondary/60 p-3 text-sm">
              <p className="font-medium">{t("1. Baixe o modelo e preencha")}</p>
              <p className="text-xs text-muted-foreground">
                {t(
                  "Só o nome é obrigatório. Em “inclui”, separe os itens com |. Etapa: isca, entrada, principal, expansão ou recorrência.",
                )}
              </p>
              <button
                type="button"
                onClick={baixarModeloDeProdutos}
                className="h-9 w-fit rounded-xl border bg-card px-3 text-sm font-medium hover:bg-secondary"
              >
                {t("Baixar modelo de planilha")}
              </button>
            </div>

            <div className="grid gap-2 rounded-2xl bg-secondary/60 p-3 text-sm">
              <p className="font-medium">{t("2. Envie a planilha preenchida")}</p>
              <input
                ref={entrada}
                type="file"
                accept=".csv,.txt,text/csv"
                aria-label={t("Arquivo da planilha")}
                onChange={(e) => void aoEscolherArquivo(e.target.files?.[0])}
                className="text-sm file:mr-3 file:h-9 file:rounded-xl file:border file:bg-card file:px-3 file:text-sm file:font-medium"
              />
              {erroDoArquivo ? (
                <p className="rounded-lg bg-error-bg px-3 py-2 text-error-fg">{erroDoArquivo}</p>
              ) : null}
            </div>

            {linhas.length > 0 ? (
              <div className="grid gap-3 text-sm">
                <p className="font-medium">
                  {arquivo}: {validas.length} {t("prontos")}
                  {comErro.length > 0 ? ` · ${comErro.length} ${t("com problema")}` : ""}
                </p>
                {ignoradas.length > 0 ? (
                  <p className="text-xs text-muted-foreground">
                    {t("Colunas ignoradas")}: {ignoradas.join(", ")}
                  </p>
                ) : null}
                {comErro.length > 0 ? (
                  <ul className="rounded-xl bg-warning-bg px-3 py-2 text-xs text-warning-fg">
                    {comErro.slice(0, 8).map((c) => (
                      <li key={c.linha}>
                        {t("Linha")} {c.linha}
                        {c.nome ? ` (${c.nome})` : ""}: {c.r.ok ? "" : c.r.erro}
                      </li>
                    ))}
                    {comErro.length > 8 ? <li>…</li> : null}
                  </ul>
                ) : null}
                <div className="max-h-40 overflow-auto rounded-xl border">
                  <table className="w-full text-xs">
                    <thead className="bg-secondary/60 text-left">
                      <tr>
                        <th className="px-2 py-1.5">{t("Nome")}</th>
                        <th className="px-2 py-1.5">{t("Preço")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {validas.slice(0, 20).map((c) =>
                        c.r.ok ? (
                          <tr key={c.linha} className="border-t">
                            <td className="px-2 py-1.5">{c.r.titulo}</td>
                            <td className="px-2 py-1.5">{c.r.oferta.preco.valor || "—"}</td>
                          </tr>
                        ) : null,
                      )}
                    </tbody>
                  </table>
                </div>
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={publicar}
                    onChange={(e) => setPublicar(e.target.checked)}
                    className="mt-1"
                  />
                  <span>
                    {t("Publicar ao importar")}
                    <span className="block text-xs text-muted-foreground">
                      {t(
                        "A IA passa a enxergar estes produtos e preços na hora. Desmarcado, eles entram em rascunho para você revisar.",
                      )}
                    </span>
                  </span>
                </label>
                <button
                  type="button"
                  disabled={enviando || validas.length === 0}
                  onClick={() => void importar()}
                  className={cn(
                    "h-10 rounded-xl bg-primary text-sm font-medium text-primary-foreground disabled:opacity-50",
                  )}
                >
                  {enviando
                    ? t("Importando…")
                    : `${t("Importar")} ${validas.length} ${t("produtos")}`}
                </button>
              </div>
            ) : null}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
