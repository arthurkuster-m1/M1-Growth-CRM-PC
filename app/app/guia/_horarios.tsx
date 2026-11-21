"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { useT } from "@/hooks/i18n/useT";
import { CHAVE_DO_GUIA } from "@/hooks/guia/useDiagnosticoDoGuia";
import { apiClient } from "@/lib/api/client";
import {
  DIAS_DA_SEMANA,
  JORNADA_PADRAO,
  janelasDaAgenda,
  janelasDaJornada,
  resumoDasJanelas,
  validarJornada,
} from "@/lib/guia/horarios";
import { registrarDesfazer } from "@/lib/motor/desfazer";
import { FUSOS_OFERECIDOS, FUSO_PADRAO } from "@/lib/tempo/fusos";

interface Atendente {
  user_id: string;
  name: string | null;
  role: string | null;
  schedule: unknown;
}

const CAMPO = "h-9 rounded-lg border bg-background px-2.5 text-sm";
const BOTAO =
  "h-9 rounded-xl border px-3 text-sm font-medium transition-colors hover:bg-secondary disabled:opacity-60";

/**
 * O ASSISTENTE DE HORÁRIOS (passo P42), numa gaveta dentro do Guia: "que dias e horários vocês
 * atendem?" e, com um clique, grava a jornada de cada pessoa escolhida pela MESMA rota que a tela
 * de Equipe usa — sem lógica nova de gravação. Tem Ctrl+Z (devolve as jornadas de antes).
 */
export function AssistenteDeHorarios({
  aberto,
  aoFechar,
}: {
  aberto: boolean;
  aoFechar: () => void;
}) {
  const t = useT();
  const qc = useQueryClient();
  const roster = useQuery({
    queryKey: ["guia", "atendentes"],
    queryFn: async () =>
      (await apiClient.get<{ data: Atendente[] }>("/api/v1/attendants/availability")).data,
    enabled: aberto,
    staleTime: 0,
  });
  const equipe = roster.data ?? [];

  const [dias, setDias] = useState<number[]>([...JORNADA_PADRAO.dias]);
  const [inicio, setInicio] = useState(JORNADA_PADRAO.inicio);
  const [fim, setFim] = useState(JORNADA_PADRAO.fim);
  const [fuso, setFuso] = useState(FUSO_PADRAO);
  const [escolhidos, setEscolhidos] = useState<string[] | null>(null);
  const [salvando, setSalvando] = useState(false);

  // Por padrão, toda a equipe de atendimento; a pessoa desmarca quem não entra.
  const marcados = escolhidos ?? equipe.map((a) => a.user_id);
  const erro = validarJornada({ dias, inicio, fim });

  const alternarDia = (dow: number) =>
    setDias((a) => (a.includes(dow) ? a.filter((x) => x !== dow) : [...a, dow]));
  const alternarPessoa = (id: string) =>
    setEscolhidos(marcados.includes(id) ? marcados.filter((x) => x !== id) : [...marcados, id]);

  const gravar = (id: string, schedule: unknown) =>
    apiClient.patch(`/api/v1/attendants/availability/${id}`, { schedule });

  async function salvar() {
    if (erro) return toast.error(t(erro));
    if (marcados.length === 0) return toast.error(t("Escolha pelo menos uma pessoa."));
    const novo = { timezone: fuso, windows: janelasDaJornada({ dias, inicio, fim }) };
    const antes = new Map(equipe.map((a) => [a.user_id, a.schedule ?? {}]));
    setSalvando(true);
    const r = await Promise.allSettled(marcados.map((id) => gravar(id, novo)));
    setSalvando(false);
    const certos = marcados.filter((_, i) => r[i]!.status === "fulfilled");
    const falhas = marcados.length - certos.length;
    if (certos.length > 0) {
      registrarDesfazer({
        rotulo: t("Horários de atendimento"),
        desfazer: async () => {
          await Promise.all(certos.map((id) => gravar(id, antes.get(id) ?? {})));
          await qc.invalidateQueries({ queryKey: CHAVE_DO_GUIA });
        },
      });
      await qc.invalidateQueries({ queryKey: CHAVE_DO_GUIA });
    }
    if (falhas === 0) {
      toast.success(
        `${t("Horários salvos para")} ${certos.length} ${certos.length === 1 ? t("pessoa") : t("pessoas")}. ${t("Ctrl+Z desfaz.")}`,
      );
      aoFechar();
    } else {
      toast.error(
        certos.length > 0
          ? `${t("Salvei para")} ${certos.length}, ${t("mas não consegui para")} ${falhas}. ${t("Tente de novo para essas.")}`
          : t("Não foi possível salvar os horários."),
      );
    }
  }

  return (
    <Sheet open={aberto} onOpenChange={(a) => !a && aoFechar()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <div className="grid gap-4 p-5">
          <div>
            <SheetTitle className="text-base font-semibold">
              {t("Horários de atendimento")}
            </SheetTitle>
            <SheetDescription className="text-xs text-muted-foreground">
              {t(
                "Fora desses horários a pessoa não recebe novas conversas pelo roteamento. Quem não tem horário definido fica sempre disponível.",
              )}
            </SheetDescription>
          </div>

          <fieldset className="grid gap-2 text-sm">
            <legend className="mb-1 font-medium">{t("Dias de atendimento")}</legend>
            <div className="flex flex-wrap gap-2">
              {DIAS_DA_SEMANA.map((d) => (
                <label
                  key={d.dow}
                  className={`flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs ${dias.includes(d.dow) ? "border-primary bg-secondary" : ""}`}
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={dias.includes(d.dow)}
                    onChange={() => alternarDia(d.dow)}
                  />
                  {t(d.curto)}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="grid grid-cols-2 gap-3">
            <label className="grid gap-1 text-sm">
              <span className="font-medium">{t("Das")}</span>
              <input
                type="time"
                value={inicio}
                onChange={(e) => setInicio(e.target.value)}
                className={CAMPO}
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-medium">{t("Até")}</span>
              <input
                type="time"
                value={fim}
                onChange={(e) => setFim(e.target.value)}
                className={CAMPO}
              />
            </label>
          </div>
          <label className="grid gap-1 text-sm">
            <span className="font-medium">{t("Fuso horário")}</span>
            <select value={fuso} onChange={(e) => setFuso(e.target.value)} className={CAMPO}>
              {FUSOS_OFERECIDOS.map((f) => (
                <option key={f.codigo} value={f.codigo}>
                  {f.rotulo}
                </option>
              ))}
            </select>
          </label>

          <fieldset className="grid gap-1.5 text-sm">
            <legend className="mb-1 font-medium">{t("Para quem")}</legend>
            {roster.isLoading ? (
              <p className="text-xs text-muted-foreground">{t("Carregando a equipe…")}</p>
            ) : equipe.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                {t("Ninguém da equipe de atendimento encontrado.")}
              </p>
            ) : (
              equipe.map((a) => {
                const janelas = janelasDaAgenda(a.schedule);
                return (
                  <label key={a.user_id} className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={marcados.includes(a.user_id)}
                      onChange={() => alternarPessoa(a.user_id)}
                    />
                    <span>
                      {a.name?.trim() || t("Sem nome")}
                      <span className="block text-xs text-muted-foreground">
                        {t("Hoje")}: {t(resumoDasJanelas(janelas))}
                      </span>
                    </span>
                  </label>
                );
              })
            )}
          </fieldset>

          {erro ? <p className="text-xs text-warning-fg">{t(erro)}</p> : null}
          <div className="flex gap-2">
            <button
              type="button"
              className={`${BOTAO} bg-primary text-primary-foreground`}
              disabled={salvando || !!erro || marcados.length === 0}
              onClick={() => void salvar()}
            >
              {salvando ? t("Salvando…") : t("Salvar horários")}
            </button>
            <button type="button" className={BOTAO} onClick={aoFechar}>
              {t("Cancelar")}
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
