"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useT } from "@/hooks/i18n/useT";
import { useSalvarReguaAbandono } from "@/hooks/metrics/useAtritoMetrics";

/**
 * A régua do abandono, VISÍVEL e editável ao lado do número que ela governa
 * (invariante 6: ver + mudar + falha visível; e cap. 3.4 regra 4: a régua viaja
 * com o número). Só manager+ edita — redefinir o que conta como perda é decisão
 * de quem responde pelo resultado, não de quem opera.
 */
export function ReguaDoAbandono({ horas, padrao, podeEditar }: { horas: number; padrao: number; podeEditar: boolean }) {
  const t = useT();
  const [valor, setValor] = useState(String(horas));
  const salvar = useSalvarReguaAbandono();
  const n = Number(valor);
  const valido = Number.isInteger(n) && n >= 1 && n <= 24 * 90;
  const sujo = String(horas) !== valor.trim();

  if (!podeEditar) {
    return (
      <p className="text-xs text-muted-foreground">
        {t("Uma conversa conta como perdida no silêncio após")} <strong>{horas}h</strong>{" "}
        {t("sem resposta")}
        {horas === padrao ? ` ${t("(padrão do sistema)")}` : ""}.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      <span>{t("Contar como perdida no silêncio após")}</span>
      <Input
        className="h-7 w-20 text-xs"
        value={valor}
        inputMode="numeric"
        aria-label={t("Horas de silêncio até considerar a conversa perdida")}
        onChange={(e) => setValor(e.target.value)}
      />
      <span>{t("horas sem resposta.")}</span>
      {sujo ? (
        <Button
          size="sm"
          variant="outline"
          className="h-7"
          disabled={!valido || salvar.isPending}
          onClick={() => salvar.mutate(n)}
        >
          {salvar.isPending ? t("Salvando…") : t("Salvar")}
        </Button>
      ) : null}
      {sujo && !valido ? (
        <span className="text-destructive">{t("Use um número inteiro entre 1 e 2160.")}</span>
      ) : null}
      {/* Falha VISÍVEL: sem isto, um erro de escrita deixaria a tela mostrando o
          valor digitado como se tivesse sido salvo. */}
      {salvar.isError ? (
        <span className="text-destructive">{t("Não foi possível salvar. Tente de novo.")}</span>
      ) : null}
      {horas === padrao && !sujo ? <span>{t("(padrão do sistema)")}</span> : null}
    </div>
  );
}

