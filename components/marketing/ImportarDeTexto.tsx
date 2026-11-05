"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useT } from "@/hooks/i18n/useT";
import { MAXIMO_DE_BLOCOS, type Bloco } from "@/lib/marketing/blocos";
import { lerTextoDaPagina, TEXTO_DE_EXEMPLO, textoDaPagina } from "@/lib/marketing/texto-estruturado";
import { cn } from "@/lib/utils";

interface Props {
  blocos: Bloco[];
  aoMudar: (blocos: Bloco[]) => void;
  novoId: () => string;
}

const BOTAO =
  "inline-flex h-9 items-center justify-center rounded-xl border border-border bg-card px-3 text-xs font-medium text-text-muted transition-colors hover:border-primary hover:text-primary";

/**
 * IMPORTAR DE TEXTO: escrever (ou colar) a página inteira de uma vez, num texto simples, em vez de
 * preencher bloco por bloco. O formato está em `lib/marketing/texto-estruturado.ts`. O caminho de
 * volta ("Copiar a página como texto") deixa editar fora do app e colar de novo.
 *
 * Tudo ou nada: com qualquer problema nada é importado, e cada problema mostra a linha.
 */
export function ImportarDeTexto({ blocos, aoMudar, novoId }: Props) {
  const t = useT();
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState("");
  const [modo, setModo] = useState<"adicionar" | "substituir">("adicionar");

  const leitura = useMemo(
    () => (texto.trim() ? lerTextoDaPagina(texto, novoId) : null),
    // `novoId` é estável na tela; reler a cada digitação é o ponto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [texto],
  );
  const total = modo === "substituir" ? (leitura?.blocos.length ?? 0) : blocos.length + (leitura?.blocos.length ?? 0);
  const estoura = total > MAXIMO_DE_BLOCOS;
  const pode = !!leitura && leitura.problemas.length === 0 && leitura.blocos.length > 0 && !estoura;

  const importar = () => {
    if (!leitura || !pode) return;
    aoMudar(modo === "substituir" ? leitura.blocos : [...blocos, ...leitura.blocos]);
    toast.success(t("Página importada. Ctrl+Z desfaz."));
    setAberto(false);
    setTexto("");
  };

  const copiar = async () => {
    const { texto: saida, ignorados } = textoDaPagina(blocos);
    try {
      await navigator.clipboard.writeText(saida);
      toast.success(
        ignorados
          ? `${t("Página copiada como texto.")} ${ignorados} ${t("bloco(s) sem forma em texto ficaram de fora.")}`
          : t("Página copiada como texto."),
      );
    } catch {
      toast.error(t("Não foi possível copiar. Use a janela de importar e cole o texto manualmente."));
    }
  };

  return (
    <>
      <div className="flex flex-wrap justify-center gap-2">
        <button type="button" className={BOTAO} onClick={() => setAberto(true)}>
          {t("Importar de texto")}
        </button>
        <button type="button" className={BOTAO} onClick={copiar} disabled={blocos.length === 0}>
          {t("Copiar a página como texto")}
        </button>
      </div>

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="max-h-[90dvh] max-w-2xl gap-3 overflow-y-auto p-5 sm:rounded-2xl">
          <DialogTitle className="text-base font-semibold">{t("Importar a página de um texto")}</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {t("Cole aqui o texto estruturado. Títulos com #, listas com -, e blocos entre ::: (métricas, fluxo, cards, matriz, tabela…). Veja o exemplo.")}
          </DialogDescription>

          <Textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            rows={14}
            spellCheck={false}
            className="font-mono text-xs"
            placeholder={t("Cole o texto aqui")}
            aria-label={t("Texto estruturado da página")}
          />

          <div className="flex flex-wrap items-center gap-3 text-sm">
            <button type="button" className={BOTAO} onClick={() => setTexto(TEXTO_DE_EXEMPLO)}>
              {t("Ver exemplo")}
            </button>
            <label className="flex items-center gap-1.5">
              <input type="radio" checked={modo === "adicionar"} onChange={() => setModo("adicionar")} />
              {t("Adicionar ao fim da página")}
            </label>
            <label className="flex items-center gap-1.5">
              <input type="radio" checked={modo === "substituir"} onChange={() => setModo("substituir")} />
              {t("Substituir a página inteira")}
            </label>
          </div>

          {modo === "substituir" && blocos.length > 0 ? (
            <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
              {t("Os blocos atuais serão trocados (imagens já enviadas também). Ctrl+Z desfaz.")}
            </p>
          ) : null}

          {leitura ? (
            leitura.problemas.length > 0 ? (
              <ul role="alert" className="space-y-1 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-700 dark:text-red-300">
                {leitura.problemas.slice(0, 12).map((p, i) => (
                  <li key={i}>
                    {t("Linha")} {p.linha}: {p.erro}
                  </li>
                ))}
                {leitura.problemas.length > 12 ? (
                  <li>… {leitura.problemas.length - 12} {t("outros problemas")}</li>
                ) : null}
              </ul>
            ) : (
              <p className={cn("text-xs", estoura ? "text-red-600" : "text-text-muted")}>
                {estoura
                  ? t("A página passaria do limite de blocos.")
                  : `${leitura.blocos.length} ${t("bloco(s) prontos para importar.")}`}
              </p>
            )
          ) : null}

          <div className="flex justify-end gap-2">
            <button type="button" className={BOTAO} onClick={() => setAberto(false)}>
              {t("Cancelar")}
            </button>
            <button
              type="button"
              disabled={!pode}
              onClick={importar}
              className="inline-flex h-9 items-center rounded-xl bg-primary px-4 text-sm font-medium text-white disabled:opacity-50"
            >
              {t("Importar")}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
