import { ImageResponse } from "next/og";

import { precoEmTexto, ROTULO_DA_ETAPA, type Oferta } from "@/lib/marketing/oferta";

const LARGURA = 1080;
const ALTURA = 1350;

const corta = (t: string, n: number) => {
  const limpo = t.replace(/\s+/g, " ").trim();
  return limpo.length <= n ? limpo : `${limpo.slice(0, n - 1).trimEnd()}…`;
};

/**
 * O CARTÃO-RESUMO da oferta: uma imagem vertical (1080×1350, boa para WhatsApp) com o essencial
 * em uma olhada — o que é, o que inclui, o preço e a garantia. A IA o envia junto com a
 * resposta e o lead pode encaminhá-lo ao sócio. Sai dos mesmos campos da página.
 */
export function cartaoDaOferta(
  titulo: string,
  o: Oferta,
  marca: { nome: string; cor: string },
): ImageResponse {
  const completa = o.nivel === "completa";
  const itens = (completa ? o.entregaveis.map((e) => e.nome) : o.inclui)
    .filter((i) => i.trim() !== "")
    .slice(0, 5)
    .map((i) => corta(i, 70));
  const frase = corta((completa && o.promessa) || o.resumo, 210);
  const garantia = completa && o.garantia ? corta(o.garantia, 170) : "";

  return new ImageResponse(
    <div
      style={{
        width: LARGURA,
        height: ALTURA,
        display: "flex",
        flexDirection: "column",
        background: "#0D1117",
        color: "#F0F6FC",
        padding: 72,
        fontFamily: "sans-serif",
      }}
    >
      <div
        style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 28, color: "#9fb0c0" }}
      >
        <div style={{ width: 14, height: 14, borderRadius: 14, background: marca.cor }} />
        <span>{marca.nome}</span>
        <span style={{ marginLeft: "auto", color: marca.cor, fontWeight: 700 }}>
          {ROTULO_DA_ETAPA[o.etapa].toUpperCase()}
        </span>
      </div>

      <div
        style={{ display: "flex", fontSize: 64, fontWeight: 800, lineHeight: 1.1, marginTop: 48 }}
      >
        {corta(titulo, 70)}
      </div>

      {frase ? (
        <div
          style={{
            display: "flex",
            fontSize: 34,
            lineHeight: 1.35,
            color: "#c9d4e0",
            marginTop: 32,
          }}
        >
          {frase}
        </div>
      ) : null}

      {itens.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 18, marginTop: 44 }}>
          {itens.map((i, k) => (
            <div key={k} style={{ display: "flex", alignItems: "center", gap: 18, fontSize: 32 }}>
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 34,
                  background: marca.cor,
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 22,
                  fontWeight: 800,
                }}
              >
                ✓
              </div>
              <span>{i}</span>
            </div>
          ))}
        </div>
      ) : null}

      <div style={{ display: "flex", flex: 1 }} />

      {garantia ? (
        <div
          style={{
            display: "flex",
            fontSize: 26,
            lineHeight: 1.35,
            color: "#c9d4e0",
            borderLeft: `6px solid ${marca.cor}`,
            paddingLeft: 24,
            marginBottom: 32,
          }}
        >
          {garantia}
        </div>
      ) : null}

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          background: marca.cor,
          borderRadius: 28,
          padding: "28px 40px",
        }}
      >
        <span style={{ fontSize: 26, color: "#ffffffcc" }}>Investimento</span>
        <span style={{ fontSize: 76, fontWeight: 800 }}>{corta(precoEmTexto(o), 40)}</span>
      </div>
    </div>,
    { width: LARGURA, height: ALTURA },
  );
}
