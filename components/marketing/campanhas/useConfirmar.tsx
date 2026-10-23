"use client";

import { useCallback, useState, type ReactNode } from "react";

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
import { useT } from "@/hooks/i18n/useT";

/**
 * O "TEM CERTEZA?" do app: no lugar da janela do navegador (`window.confirm`, que aparece como
 * aviso do sistema), um diálogo do próprio app. Uso: `const { confirmar, dialogo } = useConfirmar();`
 * renderize `{dialogo}` uma vez e chame `if (await confirmar("Apagar?")) …`.
 */
export function useConfirmar(): {
  confirmar: (texto: string, rotuloDoBotao?: string) => Promise<boolean>;
  dialogo: ReactNode;
} {
  const t = useT();
  const [pedido, setPedido] = useState<{
    texto: string;
    botao: string | null;
    resolver: (v: boolean) => void;
  } | null>(null);

  const confirmar = useCallback(
    (texto: string, botao?: string) =>
      new Promise<boolean>((resolver) => setPedido({ texto, botao: botao ?? null, resolver })),
    [],
  );
  const responder = (v: boolean) => {
    pedido?.resolver(v);
    setPedido(null);
  };

  const dialogo = (
    <AlertDialog open={pedido !== null} onOpenChange={(aberto) => !aberto && responder(false)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("Confirmar")}</AlertDialogTitle>
          <AlertDialogDescription>{pedido?.texto}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("Cancelar")}</AlertDialogCancel>
          <AlertDialogAction onClick={() => responder(true)}>
            {pedido?.botao ?? t("Confirmar")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
  return { confirmar, dialogo };
}
