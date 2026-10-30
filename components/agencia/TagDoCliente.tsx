import { estiloDaTagDoCliente } from "@/lib/agencia/cor-do-cliente";
import { cn } from "@/lib/utils";

/** O nome do cliente como uma tag na cor que a agência escolheu para ele — para achar cada um de relance. */
export function TagDoCliente({
  nome,
  cor,
  className,
  grande = false,
}: {
  nome: string;
  cor: string;
  className?: string;
  grande?: boolean;
}) {
  return (
    <span
      style={estiloDaTagDoCliente(cor)}
      className={cn(
        "inline-flex max-w-full items-center truncate rounded-lg border font-semibold",
        grande ? "px-3 py-1 text-base" : "px-2 py-0.5 text-xs",
        className,
      )}
    >
      <span className="truncate">{nome}</span>
    </span>
  );
}
