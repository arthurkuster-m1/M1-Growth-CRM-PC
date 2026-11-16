"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";

import { showApiError } from "@/components/feedback/ApiErrorToast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useT } from "@/hooks/i18n/useT";
import { apiClient } from "@/lib/api/client";
import { DotsThree, EyeSlash, Trash } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";

type Acao = "ocultar" | "mostrar" | "apagar";

async function enviar(chave: string, acao: Acao) {
  await apiClient.post("/api/v1/marketing/estrategia/ocultas", { chave, acao });
}

/**
 * O menu "⋯" de uma página, fase ou atalho da Estratégia: OCULTAR (guarda tudo, volta quando
 * quiser) ou APAGAR O CONTEÚDO (some de vez; ao trazer de volta a página nasce do zero). Só quem
 * gerencia (gerente em diante) vê este menu — quem chama já decide isso.
 */
export function MenuDeOcultar({
  chave,
  rotulo,
  podeApagar,
  tipo,
  flutuante = false,
}: {
  chave: string;
  /** O nome que aparece nos avisos ("Estudo de persona", "01 | Diagnóstico"). */
  rotulo: string;
  /** Atalhos não têm conteúdo próprio: só se ocultam. */
  podeApagar: boolean;
  tipo: "fase" | "pagina" | "atalho";
  /** Sobre um cartão: aparece ao passar o mouse (e sempre no toque). */
  flutuante?: boolean;
}) {
  const t = useT();
  const router = useRouter();
  const [confirmando, setConfirmando] = useState(false);
  const [trabalhando, setTrabalhando] = useState(false);

  async function ocultar() {
    try {
      await enviar(chave, "ocultar");
      router.refresh();
      toast(`${rotulo} ${t("ficou oculto")}`, {
        action: {
          label: t("Desfazer"),
          onClick: () => {
            void enviar(chave, "mostrar").then(() => router.refresh(), showApiError);
          },
        },
      });
    } catch (e) {
      showApiError(e);
    }
  }

  async function apagar() {
    setTrabalhando(true);
    try {
      await enviar(chave, "apagar");
      setConfirmando(false);
      router.refresh();
      toast.success(
        `${rotulo}: ${t("conteúdo apagado. Para usar de novo, traga de volta em Adicionar página.")}`,
      );
    } catch (e) {
      showApiError(e);
    } finally {
      setTrabalhando(false);
    }
  }

  const aviso: ReactNode =
    tipo === "fase"
      ? t(
          "O conteúdo de todas as páginas desta fase (rascunhos, publicado e histórico) será apagado, menos Produtos e ofertas. Isso não volta. Se você só quer tirar da vista, use Ocultar.",
        )
      : t(
          "O conteúdo desta página e das subpáginas dela (rascunho, publicado e histórico) será apagado. Isso não volta. Se você só quer tirar da vista, use Ocultar.",
        );

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={`${t("Opções de")} ${rotulo}`}
            data-testid={`menu-${chave}`}
            className={cn(
              "grid h-8 w-8 place-items-center rounded-lg border bg-card/95 text-muted-foreground shadow-sm hover:bg-secondary hover:text-foreground",
              flutuante &&
                "absolute top-2 right-2 z-10 md:opacity-0 md:group-hover/ctl:opacity-100 md:focus-visible:opacity-100 md:data-[state=open]:opacity-100",
            )}
          >
            <DotsThree size={18} weight="bold" aria-hidden />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onSelect={() => void ocultar()}>
            <EyeSlash size={15} aria-hidden className="mr-2" />
            {t("Ocultar desta aba")}
          </DropdownMenuItem>
          {podeApagar ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-error-fg focus:text-error-fg"
                onSelect={() => setConfirmando(true)}
              >
                <Trash size={15} aria-hidden className="mr-2" />
                {t("Apagar o conteúdo…")}
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmando} onOpenChange={(a) => !trabalhando && setConfirmando(a)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("Apagar")} {rotulo}?
            </AlertDialogTitle>
            <AlertDialogDescription>{aviso}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={trabalhando}>{t("Cancelar")}</AlertDialogCancel>
            <AlertDialogAction
              disabled={trabalhando}
              onClick={(e) => {
                e.preventDefault();
                void apagar();
              }}
              className="bg-error text-white hover:brightness-95"
            >
              {trabalhando ? t("Apagando…") : t("Apagar o conteúdo")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
