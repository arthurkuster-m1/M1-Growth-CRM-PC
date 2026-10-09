import Link from "next/link";

/** O topo das páginas públicas: a marca do cliente (logo ou nome) e o aviso de "somente leitura". */
export function CabecalhoPublico({
  nome,
  logoUrl,
  somenteLeitura,
  voltar,
}: {
  nome: string;
  logoUrl: string | null;
  somenteLeitura: string;
  /** Presente nas páginas de módulo: leva ao painel do link. */
  voltar?: { href: string; rotulo: string };
}) {
  return (
    <header className="border-b bg-card/80 backdrop-blur-sm">
      <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- logo da marca, endereço vindo do storage
            <img src={logoUrl} alt={nome} className="h-8 w-auto max-w-[8rem] object-contain" />
          ) : null}
          <span className="truncate text-sm font-semibold">{nome}</span>
        </div>
        <div className="flex items-center gap-3">
          {voltar ? (
            <Link
              href={voltar.href}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {voltar.rotulo}
            </Link>
          ) : null}
          <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-muted-foreground">
            {somenteLeitura}
          </span>
        </div>
      </div>
    </header>
  );
}
