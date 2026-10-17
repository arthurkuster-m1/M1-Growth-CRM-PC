"use client";

import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";

import { useRolagemLivre } from "@/lib/ui/rolagem-livre";
import { cn } from "@/lib/utils";

/**
 * No celular o popover é MODAL: a tela de trás não rola nem recebe toque enquanto ele está
 * aberto (o foco é o popover). No computador continua leve, sem travar a página.
 */
function useTelaPequena(): boolean {
  const [pequena, setPequena] = React.useState(false);
  React.useEffect(() => {
    // Sem matchMedia (testes, navegadores antigos): fica como computador.
    if (typeof window.matchMedia !== "function") return;
    const m = window.matchMedia("(max-width: 639px)");
    const atualizar = () => setPequena(m.matches);
    atualizar();
    m.addEventListener("change", atualizar);
    return () => m.removeEventListener("change", atualizar);
  }, []);
  return pequena;
}

const Popover = ({
  modal,
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Root>) => {
  const pequena = useTelaPequena();
  return <PopoverPrimitive.Root modal={modal ?? pequena} {...props} />;
};
Popover.displayName = "Popover";

const PopoverTrigger = PopoverPrimitive.Trigger;

const PopoverAnchor = PopoverPrimitive.Anchor;

const PopoverContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ className, align = "center", sideOffset = 4, ...props }, ref) => {
  // A roda do mouse rola a lista mesmo quando o popup abre por cima de um diálogo.
  const refComRolagem = useRolagemLivre(ref);
  return (
  <PopoverPrimitive.Portal>
    <PopoverPrimitive.Content
      ref={refComRolagem}
      align={align}
      sideOffset={sideOffset}
      className={cn(
        "ds-painel z-50 w-72 origin-(--radix-popover-content-transform-origin) rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-hidden",
        className,
      )}
      {...props}
    />
  </PopoverPrimitive.Portal>
  );
});
PopoverContent.displayName = PopoverPrimitive.Content.displayName;

export { Popover, PopoverTrigger, PopoverContent, PopoverAnchor };
