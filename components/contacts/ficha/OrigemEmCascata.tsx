"use client";

import { useQueryClient } from "@tanstack/react-query";

import { SeletorEmPopup } from "@/components/ui/SeletorEmPopup";
import { apiClient } from "@/lib/api/client";
import { Label } from "@/components/ui/label";
import { useT } from "@/hooks/i18n/useT";
import type { CampanhaOpcao } from "@/lib/marketing/origem-opcoes";


export interface ValorDaOrigem {
  origem: string;
  campanha: string;
  conjunto: string;
  anuncio: string;
  lp: string;
  posicionamento: string;
}

export const ORIGEM_VAZIA: ValorDaOrigem = {
  origem: "",
  campanha: "",
  conjunto: "",
  anuncio: "",
  lp: "",
  posicionamento: "",
};

/**
 * A ORIGEM, no mesmo modelo em todo o produto (cadastro do lead, novo lead, importação e card do
 * funil): a FONTE (de onde veio — pode ser uma campanha de anúncio ou não: uma extração de leads,
 * uma indicação, um evento…) e, quando é anúncio, a cascata campanha → conjunto → anúncio → página
 * (puxada do anúncio) e o posicionamento. Os nomes aparecem na tela; os ids ficam por trás.
 */
export function OrigemEmCascata({
  valor,
  aoMudar,
  campanhas,
  posicionamentos,
  fontes,
  carregando,
  desabilitado,
}: {
  valor: ValorDaOrigem;
  aoMudar: (v: ValorDaOrigem) => void;
  campanhas: CampanhaOpcao[];
  posicionamentos: string[];
  fontes: string[];
  carregando?: boolean;
  desabilitado?: boolean;
}) {
  const t = useT();
  const camp = campanhas.find((c) => c.nome === valor.campanha) ?? null;
  const conj = camp?.conjuntos.find((c) => c.nome === valor.conjunto) ?? null;
  const anuncios = conj
    ? conj.anuncios
    : camp
      ? [...camp.conjuntos.flatMap((c) => c.anuncios), ...camp.anuncios_soltos]
      : [];
  const comAtual = (lista: string[], atual: string) =>
    atual && !lista.includes(atual) ? [atual, ...lista] : lista;
  const qc = useQueryClient();
  const opcoes = (lista: string[]) => lista.map((n) => ({ id: n, rotulo: n }));

  /** Toda origem nova é cadastrada e vira opção para os outros leads e oportunidades. */
  async function criarFonte(nome: string): Promise<string | null> {
    try {
      const r = await apiClient.post<{ data: { nome: string } }>(
        "/api/v1/marketing/origem-opcoes/fontes",
        { nome },
      );
      await qc.invalidateQueries({ queryKey: ["origem-opcoes"] });
      return r.data.nome;
    } catch {
      return null;
    }
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="grid gap-1">
        <Label className="text-xs">{t("Origem (fonte)")}</Label>
        <SeletorEmPopup
          rotulo={t("Origem (fonte)")}
          valor={valor.origem}
          opcoes={opcoes(comAtual(fontes, valor.origem.trim()))}
          rotuloVazio={t("Sem origem informada")}
          desabilitado={desabilitado}
          aoEscolher={(v) => aoMudar({ ...valor, origem: v })}
          criar={{
            rotulo: t("Nova origem…"),
            placeholder: t("Nome da origem (ex.: Extração Cartórios BH)"),
            aoCriar: criarFonte,
          }}
        />
      </div>
      <div className="grid gap-1">
        <Label className="text-xs">{t("Campanha")}</Label>
        <SeletorEmPopup
          rotulo={t("Campanha")}
          valor={valor.campanha}
          opcoes={opcoes(comAtual(campanhas.map((c) => c.nome), valor.campanha))}
          rotuloVazio={t("Sem campanha")}
          desabilitado={carregando || desabilitado}
          aoEscolher={(v) => aoMudar({ ...valor, campanha: v, conjunto: "", anuncio: "", lp: "" })}
        />
      </div>
      <div className="grid gap-1">
        <Label className="text-xs">{t("Conjunto de anúncios")}</Label>
        <SeletorEmPopup
          rotulo={t("Conjunto de anúncios")}
          valor={valor.conjunto}
          opcoes={opcoes(comAtual((camp?.conjuntos ?? []).map((c) => c.nome), valor.conjunto))}
          rotuloVazio={camp ? t("Qualquer conjunto") : t("Escolha a campanha")}
          desabilitado={!camp || desabilitado}
          aoEscolher={(v) => aoMudar({ ...valor, conjunto: v, anuncio: "", lp: "" })}
        />
      </div>
      <div className="grid gap-1">
        <Label className="text-xs">{t("Anúncio (criativo)")}</Label>
        <SeletorEmPopup
          rotulo={t("Anúncio (criativo)")}
          valor={valor.anuncio}
          opcoes={opcoes(comAtual(anuncios.map((a) => a.nome), valor.anuncio))}
          rotuloVazio={camp ? t("Sem anúncio") : t("Escolha a campanha")}
          desabilitado={!camp || desabilitado}
          aoEscolher={(v) => {
            const a = anuncios.find((x) => x.nome === v);
            // A página sai do anúncio (o link de destino dele), já preenchida.
            aoMudar({ ...valor, anuncio: v, lp: a?.pagina?.nome ?? valor.lp });
          }}
        />
      </div>
      <div className="grid gap-1">
        <Label className="text-xs">{t("Landing page (do anúncio)")}</Label>
        <SeletorEmPopup
          rotulo={t("Landing page (do anúncio)")}
          valor={valor.lp}
          opcoes={opcoes(comAtual((camp?.paginas ?? []).map((p) => p.nome), valor.lp))}
          rotuloVazio={t("Sem landing page")}
          desabilitado={!camp || desabilitado}
          aoEscolher={(v) => aoMudar({ ...valor, lp: v })}
        />
      </div>
      <div className="grid gap-1">
        <Label className="text-xs">{t("Posicionamento")}</Label>
        <SeletorEmPopup
          rotulo={t("Posicionamento")}
          valor={valor.posicionamento}
          opcoes={opcoes(comAtual(posicionamentos, valor.posicionamento))}
          rotuloVazio={t("Não informado")}
          desabilitado={desabilitado}
          aoEscolher={(v) => aoMudar({ ...valor, posicionamento: v })}
        />
      </div>
    </div>
  );
}
