"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { CustomFieldsEditor } from "@/components/contacts/CustomFieldsEditor";
import {
  ORIGEM_VAZIA,
  OrigemEmCascata,
  type ValorDaOrigem,
} from "@/components/contacts/ficha/OrigemEmCascata";
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
import { useCatalogoDeProdutos } from "@/hooks/vendas/useCatalogoDeProdutos";
import { apiClient } from "@/lib/api/client";
import type { CampanhaOpcao } from "@/lib/marketing/origem-opcoes";
import { MOEDA_PADRAO, simboloDaMoeda } from "@/lib/money";
import { Plus, X } from "@/lib/ui/icons";
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

const SEM_FUNIL = "__sem_funil__";

/** O valor de um campo do funil, no texto que a planilha usa. */
function comoTexto(v: unknown): string {
  if (Array.isArray(v)) return v.join("|");
  if (typeof v === "boolean") return v ? "sim" : "não";
  if (v === null || v === undefined) return "";
  return String(v);
}

/**
 * NOVO LEAD: a ficha de cadastro num popup. Um lead é a PESSOA — basta o nome e o telefone ou o
 * e-mail, e ela fica guardada sem funil e sem venda (uma base de contatos). Se quiser, o mesmo
 * cadastro já põe a pessoa num funil (com etapa) e registra a venda (produto, valor, status,
 * previsão). A mesma pessoa nunca vira dois leads: se já existe, é completada.
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
  /** Mantido por compatibilidade: o popup agora abre SEM funil (só guarda o contato). */
  funilInicial: string | null;
}) {
  const t = useT();
  const org = useActiveOrg();
  const queryClient = useQueryClient();
  const { camposDoFunil, produtoPrincipalDoFunil } = useCamposDosFunis(aberto);
  const { produtos } = useCatalogoDeProdutos(aberto);

  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [origem, setOrigem] = useState<ValorDaOrigem>(ORIGEM_VAZIA);
  const opcoesDeOrigem = useQuery({
    queryKey: ["origem-opcoes"],
    enabled: aberto,
    staleTime: 60_000,
    queryFn: async () =>
      (
        await apiClient.get<{
          data: { campanhas: CampanhaOpcao[]; posicionamentos: string[]; fontes: string[] };
        }>("/api/v1/marketing/origem-opcoes")
      ).data,
  });
  const [etiquetas, setEtiquetas] = useState("");
  const [nascimento, setNascimento] = useState("");
  // Começa SEM funil; quem quer, escolhe.
  const [funilId, setFunilId] = useState(funilInicial ? SEM_FUNIL : SEM_FUNIL);
  const [etapaId, setEtapaId] = useState("");
  const [produtoId, setProdutoId] = useState("");
  const [valor, setValor] = useState("");
  const [statusDaVenda, setStatusDaVenda] = useState("interesse");
  const [previsao, setPrevisao] = useState("");
  const [descricao, setDescricao] = useState("");
  const [camposDoFunilValores, setCamposDoFunilValores] = useState<Record<string, unknown>>({});
  const [livres, setLivres] = useState<Array<{ nome: string; valor: string }>>([]);
  const [enviando, setEnviando] = useState(false);
  const [problemas, setProblemas] = useState<string[]>([]);

  const comFunil = funilId !== SEM_FUNIL;
  const etapasAbertas = etapas.filter((e) => e.pipeline_id === funilId && !e.is_won && !e.is_lost);
  const definicoes = comFunil ? camposDoFunil(funilId) : [];
  const simbolo = simboloDaMoeda(org?.currency ?? MOEDA_PADRAO);

  function limpar() {
    setNome("");
    setTelefone("");
    setEmail("");
    setOrigem(ORIGEM_VAZIA);
    setEtiquetas("");
    setNascimento("");
    setFunilId(SEM_FUNIL);
    setEtapaId("");
    setProdutoId("");
    setValor("");
    setStatusDaVenda("interesse");
    setPrevisao("");
    setDescricao("");
    setCamposDoFunilValores({});
    setLivres([]);
    setProblemas([]);
  }

  async function criar() {
    if (nome.trim().length < 2) {
      setProblemas([t("Escreva o nome.")]);
      return;
    }
    if (!telefone.trim() && !email.trim()) {
      setProblemas([t("Preencha o telefone ou o e-mail — é assim que a pessoa é encontrada.")]);
      return;
    }
    setEnviando(true);
    setProblemas([]);
    try {
      const cab: string[] = [
        "Nome",
        "Telefone",
        "E-mail",
        "Origem",
        "Campanha",
        "Conjunto",
        "Anúncio",
        "Landing page",
        "Posicionamento",
        "Etiquetas",
        "Nascimento",
      ];
      const lin: string[] = [
        nome.trim(),
        telefone.trim(),
        email.trim(),
        origem.origem.trim(),
        origem.campanha,
        origem.conjunto,
        origem.anuncio,
        origem.lp,
        origem.posicionamento,
        etiquetas.replace(/,/g, ";"),
        nascimento,
      ];
      if (comFunil) {
        const produto = produtos.find((p) => p.id === produtoId);
        cab.push("Produto", "Valor da venda", "Status da venda", "Previsão de fechamento", "Observações");
        lin.push(produto?.nome ?? "", valor.trim(), statusDaVenda, previsao, descricao.trim());
        for (const d of definicoes) {
          cab.push(d.label);
          lin.push(comoTexto(camposDoFunilValores[d.key]));
        }
      }
      for (const c of livres) {
        if (c.nome.trim() && c.valor.trim()) {
          cab.push(c.nome.trim());
          lin.push(c.valor.trim());
        }
      }
      const r = await enviarLeadsParaOCRM({
        pipeline_id: comFunil ? funilId : null,
        stage_id: comFunil && etapaId ? etapaId : null,
        celulas: [cab, lin],
      });
      const entrou = r.contatos_criados + r.contatos_atualizados + r.cards_criados > 0;
      if (!entrou) {
        setProblemas(
          r.erros.length > 0 ? r.erros.map((e) => e.motivo) : [t("Não consegui cadastrar.")],
        );
        return;
      }
      if (r.erros.length > 0) toast.warning(r.erros.map((e) => e.motivo).join(" · "));
      toast.success(
        r.contatos_atualizados > 0 && r.contatos_criados === 0
          ? t("Lead já existia: as informações foram completadas")
          : r.cards_criados > 0
            ? t("Lead cadastrado no funil")
            : t("Lead guardado (sem funil)"),
      );
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
      <DialogContent className="max-h-[90vh] w-[calc(100vw-1.5rem)] max-w-full overflow-x-hidden overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("Novo lead")}</DialogTitle>
          <DialogDescription>
            {t(
              "Basta o nome e o telefone ou o e-mail: o lead fica guardado, sem funil e sem venda. O resto é opcional.",
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="grid min-w-0 gap-5">
          <section className="grid min-w-0 gap-3 rounded-2xl border border-l-4 border-l-blue-500 p-4 sm:grid-cols-2">
            <h3 className="text-sm font-semibold sm:col-span-2">{t("Contato")}</h3>
            <div className="min-w-0 space-y-1.5 sm:col-span-2">
              <Label htmlFor="nl-nome">{t("Nome")} *</Label>
              <Input id="nl-nome" value={nome} onChange={(e) => setNome(e.target.value)} autoFocus />
            </div>
            <div className="min-w-0 space-y-1.5">
              <Label htmlFor="nl-tel">{t("Telefone (WhatsApp)")}</Label>
              <Input
                id="nl-tel"
                inputMode="tel"
                placeholder="(11) 99999-8888"
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
              />
            </div>
            <div className="min-w-0 space-y-1.5">
              <Label htmlFor="nl-email">{t("E-mail")}</Label>
              <Input
                id="nl-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <p className="text-xs text-muted-foreground sm:col-span-2">
              {t("Preencha ao menos um dos dois (telefone ou e-mail).")}
            </p>
          </section>

          <section className="grid min-w-0 gap-3 rounded-2xl border border-l-4 border-l-orange-500 p-4">
            <h3 className="text-sm font-semibold">{t("Origem")}</h3>
            <OrigemEmCascata
              valor={origem}
              aoMudar={setOrigem}
              campanhas={opcoesDeOrigem.data?.campanhas ?? []}
              posicionamentos={opcoesDeOrigem.data?.posicionamentos ?? []}
              fontes={opcoesDeOrigem.data?.fontes ?? []}
              carregando={opcoesDeOrigem.isLoading}
            />
            <p className="text-xs text-muted-foreground">
              {t(
                "A origem pode ser uma campanha de anúncio ou só uma fonte (uma extração de leads, uma indicação, um evento…). Pode deixar em branco.",
              )}
            </p>
          </section>

          <section className="grid min-w-0 gap-3 rounded-2xl border border-l-4 border-l-red-500 p-4 sm:grid-cols-2">
            <h3 className="text-sm font-semibold sm:col-span-2">{t("Tags e nascimento")}</h3>
            <div className="min-w-0 space-y-1.5">
              <Label htmlFor="nl-tags">{t("Tags (separadas por vírgula)")}</Label>
              <Input
                id="nl-tags"
                placeholder="vip, base-2025"
                value={etiquetas}
                onChange={(e) => setEtiquetas(e.target.value)}
              />
            </div>
            <div className="min-w-0 space-y-1.5">
              <Label>{t("Nascimento")}</Label>
              <CampoDeData valor={nascimento} aoMudar={setNascimento} rotulo={t("Nascimento")} className="w-full" />
            </div>
          </section>

          <section className="grid min-w-0 gap-3 rounded-2xl border border-l-4 border-l-purple-500 p-4 sm:grid-cols-2">
            <h3 className="text-sm font-semibold sm:col-span-2">{t("Funil e venda (opcional)")}</h3>
            <div className="min-w-0 space-y-1.5">
              <Label>{t("Funil")}</Label>
              <Select
                value={funilId}
                onValueChange={(v) => {
                  setFunilId(v);
                  setEtapaId("");
                  setCamposDoFunilValores({});
                  // O funil já sabe o produto principal: puxa sozinho (e o valor, se vazio).
                  const principal = produtos.find((p) => p.id === produtoPrincipalDoFunil(v));
                  setProdutoId(principal?.id ?? "");
                  if (principal && principal.valor > 0 && valor.trim() === "") {
                    setValor(principal.valor.toFixed(2).replace(".", ","));
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SEM_FUNIL}>{t("Sem funil — só guardar o contato")}</SelectItem>
                  {funis.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {comFunil ? (
              <div className="min-w-0 space-y-1.5">
                <Label>{t("Etapa")}</Label>
                <Select
                  value={etapaId || "inicial"}
                  onValueChange={(v) => setEtapaId(v === "inicial" ? "" : v)}
                >
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
            ) : (
              <p className="text-xs text-muted-foreground sm:col-span-2">
                {t("Sem funil, o lead não tem venda. Escolha um funil para registrar a venda dele.")}
              </p>
            )}

            {comFunil ? (
              <>
                <div className="min-w-0 space-y-1.5">
                  <Label>{t("Produto")}</Label>
                  <Select
                    value={produtoId || "nenhum"}
                    onValueChange={(v) => {
                      const id = v === "nenhum" ? "" : v;
                      setProdutoId(id);
                      const p = produtos.find((x) => x.id === id);
                      if (p && p.valor > 0 && valor.trim() === "") {
                        setValor(p.valor.toFixed(2).replace(".", ","));
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nenhum">{t("Ainda sem produto")}</SelectItem>
                      {produtos.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="min-w-0 space-y-1.5">
                  <Label htmlFor="nl-valor">
                    {t("Valor da venda")} ({simbolo})
                  </Label>
                  <Input
                    id="nl-valor"
                    inputMode="decimal"
                    placeholder="0,00"
                    value={valor}
                    onChange={(e) => setValor(e.target.value)}
                  />
                </div>
                <div className="min-w-0 space-y-1.5">
                  <Label>{t("Status da venda")}</Label>
                  <Select value={statusDaVenda} onValueChange={setStatusDaVenda}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="interesse">{t("Interesse")}</SelectItem>
                      <SelectItem value="comprometida">{t("Comprometida")}</SelectItem>
                      <SelectItem value="concluida">{t("Concluída")}</SelectItem>
                      <SelectItem value="cancelada">{t("Cancelada")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="min-w-0 space-y-1.5">
                  <Label>{t("Previsão de fechamento")}</Label>
                  <CampoDeData
                    valor={previsao}
                    aoMudar={setPrevisao}
                    rotulo={t("Previsão de fechamento")}
                    className="w-full"
                  />
                </div>
                <div className="min-w-0 space-y-1.5 sm:col-span-2">
                  <Label htmlFor="nl-obs">{t("Observações da venda")}</Label>
                  <Textarea
                    id="nl-obs"
                    rows={2}
                    value={descricao}
                    onChange={(e) => setDescricao(e.target.value)}
                  />
                </div>
                {definicoes.length > 0 ? (
                  <div className="min-w-0 space-y-1.5 sm:col-span-2">
                    <Label>{t("Campos do funil")}</Label>
                    <CustomFieldsEditor
                      fields={definicoes}
                      value={camposDoFunilValores}
                      onChange={setCamposDoFunilValores}
                      mode="lead"
                    />
                  </div>
                ) : null}
              </>
            ) : null}
          </section>

          <section className="grid min-w-0 gap-3 rounded-2xl border border-l-4 border-l-pink-500 p-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">{t("Campos personalizados (opcional)")}</h3>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setLivres((a) => [...a, { nome: "", valor: "" }])}
              >
                <Plus size={14} weight="bold" aria-hidden className="mr-1" />
                {t("Adicionar campo")}
              </Button>
            </div>
            {livres.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                {t("Qualquer informação a mais sobre a pessoa (renda, cidade, interesse…).")}
              </p>
            ) : (
              <ul className="grid gap-2">
                {livres.map((c, i) => (
                  <li key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2">
                    <Input
                      value={c.nome}
                      maxLength={60}
                      placeholder={t("Nome do campo")}
                      onChange={(e) =>
                        setLivres((a) => a.map((x, k) => (k === i ? { ...x, nome: e.target.value } : x)))
                      }
                    />
                    <Input
                      value={c.valor}
                      maxLength={500}
                      placeholder={t("Valor")}
                      onChange={(e) =>
                        setLivres((a) => a.map((x, k) => (k === i ? { ...x, valor: e.target.value } : x)))
                      }
                    />
                    <button
                      type="button"
                      aria-label={t("Remover campo")}
                      onClick={() => setLivres((a) => a.filter((_, k) => k !== i))}
                      className="grid h-9 w-9 place-items-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-error-fg"
                    >
                      <X size={14} aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

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
              {enviando ? t("Salvando…") : comFunil ? t("Cadastrar no funil") : t("Guardar lead")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
