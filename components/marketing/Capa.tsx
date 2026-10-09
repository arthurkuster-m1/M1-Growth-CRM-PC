import type { ReactNode } from "react";

import { BASE_DA_COR } from "@/lib/motor/cores";
import type { TomDaCapa } from "@/lib/marketing/modulos";
import { cn } from "@/lib/utils";

/**
 * A CAPA de um cartão (e do topo de uma página) de Marketing: um degradê na cor do tom, dois
 * círculos translúcidos e o ícone grande, apagado, no canto — o "cover" do Notion, mas
 * desenhado em CSS (sem imagem para baixar, igual em claro e escuro).
 *
 * Quando a página ganhar capa própria (uma foto enviada pela agência), é aqui que ela entra.
 */
export function Capa({
  tom,
  icone,
  className,
  children,
}: {
  tom: TomDaCapa;
  icone: ReactNode;
  className?: string;
  children?: ReactNode;
}) {
  const base = BASE_DA_COR[tom];
  return (
    <div
      aria-hidden={children ? undefined : true}
      style={{
        backgroundImage: `linear-gradient(135deg, color-mix(in srgb, ${base} 90%, #000) 0%, color-mix(in srgb, ${base} 62%, #fff) 100%)`,
      }}
      className={cn("relative isolate overflow-hidden text-white", className)}
    >
      <span className="pointer-events-none absolute -top-10 -left-8 h-36 w-36 rounded-full bg-white/10" />
      <span className="pointer-events-none absolute -right-10 -bottom-14 h-44 w-44 rounded-full bg-black/10" />
      <span className="pointer-events-none absolute right-5 bottom-3 text-white/25 [&>svg]:h-20 [&>svg]:w-20">
        {icone}
      </span>
      {children}
    </div>
  );
}
