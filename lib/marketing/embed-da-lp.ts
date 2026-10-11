/**
 * A pré-visualização da LP é um `<iframe>`. O navegador só mostra a página lá dentro se o
 * servidor dela permitir: `X-Frame-Options` e o `frame-ancestors` do `Content-Security-Policy`
 * mandam. Aqui mora a conta pura (testada): dados os cabeçalhos da página e a origem do painel,
 * ela pode aparecer? E, se não, o que está bloqueando.
 */
export type VereditoDoEmbed =
  | { pode: true; motivo: "sem_restricao" | "liberada" }
  | {
      pode: false;
      motivo: "x_frame_options" | "frame_ancestors";
      detalhe: string;
    };

export function origemDe(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

export function analisarCabecalhosDeEmbed(
  cabecalhos: { get(nome: string): string | null },
  origemDoPainel: string,
): VereditoDoEmbed {
  const csp = cabecalhos.get("content-security-policy") ?? "";
  // O `frame-ancestors` vale mesmo quando há outras diretivas; várias políticas vêm separadas
  // por vírgula e a mais restritiva vence — conferimos todas.
  const politicas = csp
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  for (const politica of politicas) {
    const diretiva = politica
      .split(";")
      .map((d) => d.trim())
      .find((d) => d.toLowerCase().startsWith("frame-ancestors"));
    if (!diretiva) continue;
    const fontes = diretiva
      .split(/\s+/)
      .slice(1)
      .map((f) => f.toLowerCase());
    const aceita = fontes.some(
      (f) =>
        f === "*" ||
        f === origemDoPainel.toLowerCase() ||
        f === "https:" ||
        (f.startsWith("*.") && new URL(origemDoPainel).hostname.endsWith(f.slice(1))),
    );
    if (!aceita) {
      return { pode: false, motivo: "frame_ancestors", detalhe: diretiva };
    }
  }

  const xfo = (cabecalhos.get("x-frame-options") ?? "").trim();
  if (xfo !== "") {
    const valor = xfo.toLowerCase();
    // Só `DENY` e `SAMEORIGIN` aparecem na prática; ALLOW-FROM foi aposentado e os navegadores
    // modernos o ignoram (tratam como sem restrição) — mas CSP acima já foi conferido.
    if (valor === "deny" || valor === "sameorigin") {
      return { pode: false, motivo: "x_frame_options", detalhe: xfo };
    }
  }
  return {
    pode: true,
    motivo: csp !== "" || xfo !== "" ? "liberada" : "sem_restricao",
  };
}
