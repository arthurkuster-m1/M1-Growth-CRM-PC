"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { useT } from "@/hooks/i18n/useT";
import { CHAVE_DO_GUIA } from "@/hooks/guia/useDiagnosticoDoGuia";
import { apiClient } from "@/lib/api/client";
import { ApiError } from "@/lib/api/types";
import {
  MODELOS_DE_VENDA,
  NICHOS,
  OBJETIVOS,
  type ModeloDeVenda,
  type Nicho,
  type Objetivo,
  type PerfilGravado,
} from "@/lib/guia/tipos";

import { centavosDoTexto } from "@/lib/guia/perfil";

import { rotuloDoModelo, rotuloDoNicho, rotuloDoObjetivo } from "./_rotulos";

const CAMPO = "h-10 rounded-xl border bg-background px-3 text-sm";

const reais = (cents: number | null) =>
  cents === null
    ? ""
    : (cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

/** O formulário do perfil do cliente (grava em `guia_perfil`). */
export function FormularioDoPerfil({ perfil }: { perfil: PerfilGravado | null }) {
  const t = useT();
  const qc = useQueryClient();
  const [nicho, setNicho] = useState<Nicho | "">(perfil?.nicho ?? "");
  const [modelos, setModelos] = useState<ModeloDeVenda[]>(perfil?.modelos ?? []);
  const [jaTemOferta, setJaTemOferta] = useState(perfil?.jaTemOferta ?? false);
  const [objetivo, setObjetivo] = useState<Objetivo | "">(perfil?.objetivo ?? "");
  const [ticket, setTicket] = useState(reais(perfil?.ticketMedioCents ?? null));
  const [metaLeads, setMetaLeads] = useState(perfil?.metaLeadsMes?.toString() ?? "");
  const [site, setSite] = useState(perfil?.siteUrl ?? "");
  const [instagram, setInstagram] = useState(perfil?.instagramUrl ?? "");
  const [google, setGoogle] = useState(perfil?.googleNegocioUrl ?? "");
  const [salvando, setSalvando] = useState(false);

  const alternar = (m: ModeloDeVenda) =>
    setModelos((a) => (a.includes(m) ? a.filter((x) => x !== m) : [...a, m]));

  async function salvar() {
    if (!nicho) return toast.error(t("Escolha o nicho do cliente."));
    const ticketCents = centavosDoTexto(ticket);
    if (ticketCents === undefined) return toast.error(t("Ticket médio inválido."));
    const meta = metaLeads.trim() === "" ? null : Number(metaLeads);
    if (meta !== null && (!Number.isInteger(meta) || meta < 0)) {
      return toast.error(t("Meta de leads inválida."));
    }
    setSalvando(true);
    try {
      await apiClient.put("/api/v1/guia/perfil", {
        nicho,
        modelos,
        jaTemOferta,
        objetivo: objetivo || null,
        ticketMedioCents: ticketCents,
        metaLeadsMes: meta,
        siteUrl: site.trim() || null,
        instagramUrl: instagram.trim() || null,
        googleNegocioUrl: google.trim() || null,
      });
      await qc.invalidateQueries({ queryKey: CHAVE_DO_GUIA });
      toast.success(t("Perfil salvo."));
    } catch (e) {
      toast.error(
        e instanceof ApiError && e.status === 422
          ? t("Confira os campos: os links precisam começar com http:// ou https://.")
          : t("Não foi possível salvar o perfil."),
      );
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-sm">
          <span className="font-medium">{t("Nicho")}</span>
          <select
            value={nicho}
            onChange={(e) => setNicho(e.target.value as Nicho | "")}
            className={CAMPO}
          >
            <option value="">{t("Escolha…")}</option>
            {NICHOS.map((n) => (
              <option key={n} value={n}>
                {rotuloDoNicho(t, n)}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium">{t("Objetivo principal")}</span>
          <select
            value={objetivo}
            onChange={(e) => setObjetivo(e.target.value as Objetivo | "")}
            className={CAMPO}
          >
            <option value="">{t("Não definido")}</option>
            {OBJETIVOS.map((o) => (
              <option key={o} value={o}>
                {rotuloDoObjetivo(t, o)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <fieldset className="grid gap-1.5 text-sm">
        <legend className="mb-1 font-medium">{t("Como vende")}</legend>
        {MODELOS_DE_VENDA.map((m) => (
          <label key={m} className="flex items-center gap-2">
            <input type="checkbox" checked={modelos.includes(m)} onChange={() => alternar(m)} />
            {rotuloDoModelo(t, m)}
          </label>
        ))}
      </fieldset>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={jaTemOferta}
          onChange={(e) => setJaTemOferta(e.target.checked)}
        />
        {t("Já tem oferta pronta e quer começar pela campanha")}
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-sm">
          <span className="font-medium">{t("Ticket médio (R$)")}</span>
          <input
            value={ticket}
            onChange={(e) => setTicket(e.target.value)}
            inputMode="decimal"
            className={CAMPO}
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium">{t("Meta de leads por mês")}</span>
          <input
            value={metaLeads}
            onChange={(e) => setMetaLeads(e.target.value)}
            inputMode="numeric"
            className={CAMPO}
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium">{t("Site")}</span>
          <input
            value={site}
            onChange={(e) => setSite(e.target.value)}
            placeholder="https://"
            className={CAMPO}
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium">{t("Instagram")}</span>
          <input
            value={instagram}
            onChange={(e) => setInstagram(e.target.value)}
            placeholder="https://"
            className={CAMPO}
          />
        </label>
        <label className="grid gap-1 text-sm sm:col-span-2">
          <span className="font-medium">{t("Google Meu Negócio")}</span>
          <input
            value={google}
            onChange={(e) => setGoogle(e.target.value)}
            placeholder="https://"
            className={CAMPO}
          />
        </label>
      </div>

      <div>
        <button
          type="button"
          onClick={salvar}
          disabled={salvando}
          className="h-10 rounded-xl bg-primary px-5 text-sm font-medium text-primary-foreground disabled:opacity-60"
        >
          {salvando ? t("Salvando…") : t("Salvar perfil")}
        </button>
      </div>
    </div>
  );
}
