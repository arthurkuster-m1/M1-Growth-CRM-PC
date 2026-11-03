import { EmBreveTag } from "@/components/ui/EmBreveTag";

/**
 * A faixa no topo de uma página que ainda está em construção. `texto` já vem traduzido pelo chamador
 * (as páginas são Server Components com o idioma do usuário).
 */
export function FaixaEmBreve({ selo, texto }: { selo: string; texto: string }) {
  return (
    <div
      role="note"
      className="flex flex-wrap items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-sm"
    >
      <EmBreveTag texto={selo} />
      <span className="text-muted-foreground">{texto}</span>
    </div>
  );
}
