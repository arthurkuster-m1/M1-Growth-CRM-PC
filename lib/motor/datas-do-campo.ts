import { chaveDoDia, inicioDoDia, partesNoFuso } from "@/lib/inicio/datas";

/**
 * Data e hora de um campo editável, SEMPRE no fuso da organização.
 *
 * O `<input type="datetime-local">` fala "AAAA-MM-DDTHH:mm" sem fuso: o que a pessoa
 * digita é a hora do relógio da empresa, e não a do navegador dela. Estas duas
 * funções fazem a ida e a volta entre esse texto e o instante ISO que o banco guarda.
 */
const doisDigitos = (n: number) => String(n).padStart(2, "0");

/** ISO → texto do input (hora de parede no fuso). Vazio se não houver data. */
export function paraCampoLocal(iso: string | null | undefined, fuso: string): string {
  if (!iso) return "";
  const p = partesNoFuso(new Date(iso), fuso);
  return `${p.ano}-${doisDigitos(p.mes)}-${doisDigitos(p.dia)}T${doisDigitos(p.hora)}:${doisDigitos(p.minuto)}`;
}

/** Texto do input → ISO em UTC, ou `null` se o texto não for uma data/hora válida. */
export function deCampoLocal(valor: string, fuso: string): string | null {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})$/.exec(valor.trim());
  if (!m) return null;
  const minutos = Number(m[2]) * 60 + Number(m[3]);
  const instante = inicioDoDia(m[1]!, fuso).getTime() + minutos * 60_000;
  return Number.isFinite(instante) ? new Date(instante).toISOString() : null;
}

/**
 * O rótulo curto da célula: "5 out. 14:00", ou "5 out." quando a hora é meia-noite
 * exata (prazo sem horário). O ano só aparece fora do ano corrente.
 */
export function rotuloDaData(iso: string, fuso: string, tag: string, agora: Date): string {
  const alvo = new Date(iso);
  const mesmoAno = partesNoFuso(alvo, fuso).ano === partesNoFuso(agora, fuso).ano;
  const dia = new Intl.DateTimeFormat(tag, {
    day: "numeric",
    month: "short",
    ...(mesmoAno ? {} : { year: "numeric" }),
    timeZone: fuso,
  }).format(alvo);
  const p = partesNoFuso(alvo, fuso);
  if (p.hora === 0 && p.minuto === 0) return dia;
  const hora = new Intl.DateTimeFormat(tag, {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: fuso,
  }).format(alvo);
  return `${dia} ${hora}`;
}

/** Hoje no fuso, como chave — para marcar "atrasada" sem depender do navegador. */
export function hojeNoFuso(agora: Date, fuso: string): string {
  return chaveDoDia(agora, fuso);
}
