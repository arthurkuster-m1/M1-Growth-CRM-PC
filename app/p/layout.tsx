import type { Metadata } from "next";
import type { ReactNode } from "react";

/**
 * As páginas PÚBLICAS de Marketing (`/p/<token>`): o que a agência entrega ao cliente por link,
 * sem login. Nunca vão para buscador (o link é um segredo ao portador) e não passam o endereço
 * adiante quando alguém clica num link de dentro da página (`referrer: no-referrer`).
 */
export const metadata: Metadata = {
  title: "Marketing",
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
};

export default function PublicoLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
