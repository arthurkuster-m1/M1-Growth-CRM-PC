"use client";

import { CampoDeData } from "@/components/motor/CalendarioDePeriodo";
import { SeletorDeHora } from "@/components/motor/SeletorDeHora";
import { useT } from "@/hooks/i18n/useT";
import { cn } from "@/lib/utils";

/**
 * DATA E HORA no desenho do app, no lugar do `<input type="datetime-local">` do sistema.
 *
 * Mesmo formato do campo nativo: `valor` e `aoMudar` falam `YYYY-MM-DDTHH:mm` (hora local de quem
 * olha) ou vazio. O dia vem do calendário do app (`CampoDeData`) e a hora das colunas do app
 * (`SeletorDeHora`); sem hora escolhida, vale 00:00.
 */
export function CampoDeDataEHoraLocal({
  valor,
  aoMudar,
  rotulo,
  placeholder,
  desabilitado,
  className,
}: {
  valor: string;
  aoMudar: (v: string) => void;
  rotulo: string;
  placeholder?: string;
  desabilitado?: boolean;
  className?: string;
}) {
  const t = useT();
  const [dia = "", hora = ""] = valor.split("T");
  return (
    <div className={cn("flex min-w-0 items-center gap-2", className)}>
      <CampoDeData
        valor={dia}
        rotulo={rotulo}
        placeholder={placeholder ?? t("Escolher data")}
        desabilitado={desabilitado}
        aoMudar={(d) => aoMudar(d ? `${d}T${hora || "00:00"}` : "")}
        className="min-w-0 flex-1"
      />
      {dia ? (
        <SeletorDeHora valor={hora || "00:00"} aoMudar={(h) => aoMudar(`${dia}T${h}`)} />
      ) : null}
    </div>
  );
}

/** Um instante ISO como `YYYY-MM-DDTHH:mm` na hora local de quem olha ('' se não houver). */
export function isoParaCampoLocal(iso: string | undefined | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
