"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { CustomFieldsEditor } from "@/components/contacts/CustomFieldsEditor";
import { showApiError } from "@/components/feedback/ApiErrorToast";
import { CampoDeData } from "@/components/motor/CalendarioDePeriodo";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useActiveOrg } from "@/hooks/auth/AuthProvider";
import { useT } from "@/hooks/i18n/useT";
import { simboloDaMoeda, MOEDA_PADRAO } from "@/lib/money";
import { enviarLeadsParaOCRM, useCamposDosFunis } from "./usarFunisComCampos";

export interface FunilDoPopup {
  id: string;
  name: string;
}
export interface EtapaDoPopup {
  id: string;
  pipeline_id: string;
  name: string;
  is_won: boolean;
  is_lost: boolean;
}

const ORIGENS = ["Instagram", "Facebook", "Google", "WhatsApp", "Indicação", "Site", "Evento", "Outro"];

/** Os cabeçalhos que o servidor reconhece (ver `lib/leads/colunas-da-planilha.ts`). */
const CAB = {
  nome: "Nome",
  telefone: "Telefone",
  email: "E-mail",
  valor: "Valor",
  origem: "Origem",
  etapa: "Etapa",
  previsao: "Previsão de fechamento",
  etiquetas: "Etiquetas",
  obs: "Observações",
};

/** O valor de um campo personalizado, no texto que a planilha usa. */
function comoTexto(v: unknown): string {
  if (Array.isArray(v)) return v.join("|");
  if (typeof v === "boolean") return v ? "sim" : "não";
  if (v === null || v === undefined) return "";
  return String(v);
}

/**
 * NOVO LEAD, no CRM: a ficha de cadastro num popup em foco. Uma pessoa = um lead: o telefone (ou
 * o e-mail) acha a pessoa que já existe, e se ela já está no funil as informações são juntadas
 * no negócio dela. Passa pelo MESMO caminho da importação por planilha (uma linha só).
 */
export function NovoLeadDoCRM({
  aberto,
  aoFechar,
  funis,
  etapas,
  funilInicial,
}: {
  aberto: boolean;
  aoFechar: () => void;
  funis: FunilDoPopup[];
  etapas: EtapaDoPopup[];
  funilInicial: string | null;
}) {
  const t = useT();
  const org = useActiveOrg();
  const queryClient = useQueryClient();
  const { camposDoFunil } = useCamposDosFunis(aberto);

  const [funilId, setFunilId] = useState(funilInicial ?? funis[0]?.id ?? "");
  const [etapaId, setEtapaId] = useState("");
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [valor, setValor] = useState("");
  const [origem, setOrigem] = useState("");
  const [previsao, setPrevisao] = useState("");
  const [etiquetas, setEtiquetas] = useState("");
  const [obs, setObs] = useState("");
  const [campos, setCampos] = useState<Record<string, unknown>>({});
  const [enviando, setEnviando] = useState(false);
  const [problemas, setProblemas] = useState<string[]>([]);

  const etapasAbertas = etapas.filter((e) => e.pipeline_id === funilId && !e.is_won && !e.is_lost);
  const definicoes = camposDoFunil(funilId);
  const simbolo = simboloDaMoeda(org?.currency ?? MOEDA_PADRAO);

  function limpar() {
    setNome("");
    setTelefone("");
    setEmail("");
    setValor("");
    setOrigem("");
    setPrevisao("");
    setEtiquetas("");
    setObs("");
    setCampos({});
    setEtapaId("");
    setProblemas([]);
  }

  async function criar() {
    if (nome.trim().length < 2) {
      setProblemas([t("Escreva o nome do lead.")]);
      return;
    }
    if (!funilId) {
      setProblemas([t("Escolha o funil.")]);
      return;
    }
    setEnviando(true);
    setProblemas([]);
    try {
      const cabecalho = [
        CAB.nome,
        CAB.telefone,
        CAB.email,
        CAB.valor,
        CAB.origem,
        CAB.previsao,
        CAB.etiquetas,
        CAB.obs,
        ...definicoes.map((d) => d.label),
      ];
      const linha = [
        nome.trim(),
        telefone.trim(),
        email.trim(),
        valor.trim(),
        origem.trim(),
        previsao,
        etiquetas.replace(/,/g, ";"),
        obs.trim(),
        ...definicoes.map((d) => comoTexto(campos[d.key])),
      ];
      const r = await enviarLeadsParaOCRM({
        pipeline_id: funilId,
        ...(etapaId ? { stage_id: etapaId } : {}),
        celulas: [cabecalho, linha],
      });
      if (r.criados === 0) {
        setProblemas(
          r.erros.length > 0 ? r.erros.map((e) => e.motivo) : [t("Não consegui criar o lead.")],
        );
        return;
      }
      if (r.erros.length > 0) toast.warning(r.erros.map((e) => e.motivo).join(" · "));
      toast.success(t("Lead criado"));
      void queryClient.invalidateQueries({ queryKey: ["clientes"] });
      limpar();
      aoFechar();
    } catch (e) {
      showApiError(e);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={(a) => !a && aoFechar()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("Novo lead")}</DialogTitle>
          <DialogDescription>
            {t("Cadastre uma pessoa no CRM. Se ela já existir, as informações são juntadas.")}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5">
          <section className="grid gap-3 rounded-2xl border border-l-4 border-l-blue-500 p-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>{t("Funil")}</Label>
              <Select
                value={funilId}
                onValueChange={(v) => {
                  setFunilId(v);
                  setEtapaId("");
                  setCampos({});
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("Escolha o funil")} />
                </SelectTrigger>
                <SelectContent>
                  {funis.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t("Etapa")}</Label>
              <Select value={etapaId || "inicial"} onValueChange={(v) => setEtapaId(v === "inicial" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="inicial">{t("Primeira etapa do funil")}</SelectItem>
                  {etapasAbertas.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </section>

          <section className="grid gap-3 rounded-2xl border border-l-4 border-l-green-500 p-4 sm:grid-cols-2">
            <h3 className="text-sm font-semibold sm:col-span-2">{t("Contato")}</h3>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="nl-nome">{t("Nome")} *</Label>
              <Input id="nl-nome" value={nome} onChange={(e) => setNome(e.target.value)} autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nl-tel">{t("Telefone (WhatsApp)")}</Label>
              <Input
                id="nl-tel"
                inputMode="tel"
                placeholder="(11) 99999-8888"
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nl-email">{t("E-mail")}</Label>
              <Input
                id="nl-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </section>

          <section className="grid gap-3 rounded-2xl border border-l-4 border-l-purple-500 p-4 sm:grid-cols-2">
            <h3 className="text-sm font-semibold sm:col-span-2">{t("Negócio")}</h3>
            <div className="space-y-1.5">
              <Label htmlFor="nl-valor">
                {t("Valor")} ({simbolo})
              </Label>
              <Input
                id="nl-valor"
                inputMode="decimal"
                placeholder="0,00"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("Previsão de fechamento")}</Label>
              <CampoDeData
                valor={previsao}
                aoMudar={setPrevisao}
                rotulo={t("Previsão de fechamento")}
                className="w-full"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nl-origem">{t("Origem")}</Label>
              <Input
                id="nl-origem"
                list="nl-origens"
                placeholder={t("Ex.: Instagram, indicação…")}
                value={origem}
                onChange={(e) => setOrigem(e.target.value)}
              />
              <datalist id="nl-origens">
                {ORIGENS.map((o) => (
                  <option key={o} value={o} />
                ))}
              </datalist>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nl-tags">{t("Etiquetas (separadas por vírgula)")}</Label>
              <Input
                id="nl-tags"
                placeholder="vip, recompra"
                value={etiquetas}
                onChange={(e) => setEtiquetas(e.target.value)}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="nl-obs">{t("Observações")}</Label>
              <Textarea id="nl-obs" rows={3} value={obs} onChange={(e) => setObs(e.target.value)} />
            </div>
          </section>

          {definicoes.length > 0 ? (
            <section className="grid gap-3 rounded-2xl border border-l-4 border-l-orange-500 p-4">
              <h3 className="text-sm font-semibold">{t("Campos do funil")}</h3>
              <CustomFieldsEditor fields={definicoes} value={campos} onChange={setCampos} mode="lead" />
            </section>
          ) : null}

          {problemas.length > 0 ? (
            <div role="alert" className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm">
              {problemas.map((p) => (
                <p key={p}>{p}</p>
              ))}
            </div>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={aoFechar} disabled={enviando}>
              {t("Cancelar")}
            </Button>
            <Button type="button" onClick={() => void criar()} disabled={enviando}>
              {enviando ? t("Criando…") : t("Criar lead")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
