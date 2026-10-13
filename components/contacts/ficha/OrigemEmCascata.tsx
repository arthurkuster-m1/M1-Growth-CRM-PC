"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useT } from "@/hooks/i18n/useT";
import type { CampanhaOpcao } from "@/lib/marketing/origem-opcoes";

const SELECT_ORIGEM = "h-9 w-full rounded-lg border bg-background px-2 text-sm disabled:opacity-60";
const NOVA_FONTE = "__nova_fonte__";

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
  const fonteConhecida = valor.origem === "" || fontes.includes(valor.origem);

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <div className="grid gap-1">
        <Label className="text-xs">{t("Origem (fonte)")}</Label>
        <select
          className={SELECT_ORIGEM}
          disabled={desabilitado}
          value={fonteConhecida ? valor.origem : NOVA_FONTE}
          onChange={(e) => {
            const v = e.target.value;
            if (v === NOVA_FONTE) aoMudar({ ...valor, origem: " " });
            else aoMudar({ ...valor, origem: v });
          }}
        >
          <option value="">{t("Sem origem informada")}</option>
          {fontes.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
          <option value={NOVA_FONTE}>{t("Outra fonte… (digitar)")}</option>
        </select>
        {!fonteConhecida ? (
          <Input
            value={valor.origem.trim() === "" ? "" : valor.origem}
            maxLength={60}
            placeholder={t("Nome da fonte (ex.: Extração Cartórios BH)")}
            disabled={desabilitado}
            onChange={(e) => aoMudar({ ...valor, origem: e.target.value })}
            className="h-9"
            autoFocus
          />
        ) : null}
      </div>
      <div className="grid gap-1">
        <Label className="text-xs">{t("Campanha")}</Label>
        <select
          className={SELECT_ORIGEM}
          value={valor.campanha}
          disabled={carregando || desabilitado}
          onChange={(e) =>
            aoMudar({ ...valor, campanha: e.target.value, conjunto: "", anuncio: "", lp: "" })
          }
        >
          <option value="">{t("Sem campanha")}</option>
          {comAtual(campanhas.map((c) => c.nome), valor.campanha).map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-1">
        <Label className="text-xs">{t("Conjunto de anúncios")}</Label>
        <select
          className={SELECT_ORIGEM}
          value={valor.conjunto}
          disabled={!camp || desabilitado}
          onChange={(e) => aoMudar({ ...valor, conjunto: e.target.value, anuncio: "", lp: "" })}
        >
          <option value="">{camp ? t("Qualquer conjunto") : t("Escolha a campanha")}</option>
          {comAtual((camp?.conjuntos ?? []).map((c) => c.nome), valor.conjunto).map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-1">
        <Label className="text-xs">{t("Anúncio (criativo)")}</Label>
        <select
          className={SELECT_ORIGEM}
          value={valor.anuncio}
          disabled={!camp || desabilitado}
          onChange={(e) => {
            const a = anuncios.find((x) => x.nome === e.target.value);
            // A página sai do anúncio (o link de destino dele), já preenchida.
            aoMudar({ ...valor, anuncio: e.target.value, lp: a?.pagina?.nome ?? valor.lp });
          }}
        >
          <option value="">{camp ? t("Sem anúncio") : t("Escolha a campanha")}</option>
          {comAtual(anuncios.map((a) => a.nome), valor.anuncio).map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-1">
        <Label className="text-xs">{t("Landing page (do anúncio)")}</Label>
        <select
          className={SELECT_ORIGEM}
          value={valor.lp}
          disabled={!camp || desabilitado}
          onChange={(e) => aoMudar({ ...valor, lp: e.target.value })}
        >
          <option value="">{t("Sem landing page")}</option>
          {comAtual((camp?.paginas ?? []).map((p) => p.nome), valor.lp).map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-1">
        <Label className="text-xs">{t("Posicionamento")}</Label>
        <select
          className={SELECT_ORIGEM}
          value={valor.posicionamento}
          disabled={desabilitado}
          onChange={(e) => aoMudar({ ...valor, posicionamento: e.target.value })}
        >
          <option value="">{t("Não informado")}</option>
          {comAtual(posicionamentos, valor.posicionamento).map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
