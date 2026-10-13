"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

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

interface Contexto {
  marcar: (chave: string, sujo: boolean) => void;
  /** Roda `seguir` já, ou depois de o usuário aceitar perder o que não salvou. */
  tentar: (seguir: () => void) => void;
}

const AvisoContext = createContext<Contexto | null>(null);

/**
 * "SAIR SEM SALVAR?" da ficha. As partes que têm algo digitado e ainda não salvo se registram
 * (`useAvisarSeNaoSalvo`); trocar de aba, clicar num link da tela ou fechar a página pergunta
 * antes de perder o que foi escrito.
 */
export function AvisoDeNaoSalvoProvider({ children }: { children: ReactNode }) {
  const t = useT();
  const router = useRouter();
  const sujos = useRef(new Set<string>());
  const [pendente, setPendente] = useState<(() => void) | null>(null);

  const marcar = useCallback((chave: string, sujo: boolean) => {
    if (sujo) sujos.current.add(chave);
    else sujos.current.delete(chave);
  }, []);
  const tentar = useCallback((seguir: () => void) => {
    if (sujos.current.size === 0) seguir();
    else setPendente(() => seguir);
  }, []);

  // Fechar ou recarregar a página.
  useEffect(() => {
    const aviso = (e: BeforeUnloadEvent) => {
      if (sujos.current.size === 0) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", aviso);
    return () => window.removeEventListener("beforeunload", aviso);
  }, []);

  // Clicar num link do próprio sistema (menu, voltar para a lista…).
  useEffect(() => {
    const aoClicar = (e: MouseEvent) => {
      if (sujos.current.size === 0 || e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const href = a.getAttribute("href") ?? "";
      if (!href.startsWith("/") || href.startsWith("//")) return;
      e.preventDefault();
      e.stopPropagation();
      setPendente(() => () => router.push(href));
    };
    document.addEventListener("click", aoClicar, true);
    return () => document.removeEventListener("click", aoClicar, true);
  }, [router]);

  const valor = useMemo(() => ({ marcar, tentar }), [marcar, tentar]);
  return (
    <AvisoContext.Provider value={valor}>
      {children}
      <AlertDialog open={pendente !== null} onOpenChange={(a) => !a && setPendente(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("Sair sem salvar?")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("Você vai perder o progresso: o que foi digitado e não foi salvo some.")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("Continuar editando")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const seguir = pendente;
                sujos.current.clear();
                setPendente(null);
                seguir?.();
              }}
            >
              {t("Sair sem salvar")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AvisoContext.Provider>
  );
}

/** Marca esta parte da tela como "tem coisa não salva" enquanto `sujo` for verdadeiro. */
export function useAvisarSeNaoSalvo(chave: string, sujo: boolean): void {
  const ctx = useContext(AvisoContext);
  useEffect(() => {
    ctx?.marcar(chave, sujo);
    return () => ctx?.marcar(chave, false);
  }, [ctx, chave, sujo]);
}

/** Para trocar de aba (ou qualquer saída): pergunta antes se houver algo não salvo. */
export function useSairComAviso(): (seguir: () => void) => void {
  const ctx = useContext(AvisoContext);
  return useCallback((seguir) => (ctx ? ctx.tentar(seguir) : seguir()), [ctx]);
}
