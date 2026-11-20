/** Datas ISO ("AAAA-MM-DD") sem fuso: tudo em data local, nunca UTC. */
const pad = (n: number) => String(n).padStart(2, "0");

export const DIAS_SEMANA = [
  { curto: "D", longo: "domingo" },
  { curto: "S", longo: "segunda-feira" },
  { curto: "T", longo: "terça-feira" },
  { curto: "Q", longo: "quarta-feira" },
  { curto: "Q", longo: "quinta-feira" },
  { curto: "S", longo: "sexta-feira" },
  { curto: "S", longo: "sábado" },
];
export const MESES_CURTOS = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
];

export const hojeISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/** "2026-10-05" → "05/10/2026" ("" se não for uma data). */
export const isoParaBR = (iso: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(iso)
    ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`
    : "";

/** "05/10/2026" ou "2026-10-05" → ISO; data impossível (31/02) → null. */
export function brParaISO(texto: string): string | null {
  const t = texto.trim();
  let a: number, m: number, d: number;
  let x = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  if (x) {
    a = +x[1]!;
    m = +x[2]!;
    d = +x[3]!;
  } else {
    x = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(t);
    if (!x) return null;
    d = +x[1]!;
    m = +x[2]!;
    a = +x[3]!;
  }
  const dt = new Date(a, m - 1, d);
  if (dt.getFullYear() !== a || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null;
  return `${a}-${pad(m)}-${pad(d)}`;
}

/** Máscara enquanto digita: "05102026" → "05/10/2026". Aceita colar já com barras. */
export function mascaraData(texto: string): string {
  const d = texto.replace(/\D/g, "").slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

export function somarDias(iso: string, n: number): string {
  const [a = 0, m = 0, d = 0] = iso.split("-").map(Number);
  const dt = new Date(a, m - 1, d + n);
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}

export function somarMeses(iso: string, n: number): string {
  const [a = 0, m = 0, d = 0] = iso.split("-").map(Number);
  const alvo = new Date(a, m - 1 + n, 1);
  const ultimo = new Date(alvo.getFullYear(), alvo.getMonth() + 1, 0).getDate();
  return `${alvo.getFullYear()}-${pad(alvo.getMonth() + 1)}-${pad(Math.min(d, ultimo))}`; // 31/03 − 1 mês = 28/02
}

export type DiaDoCalendario = { iso: string; dia: number; noMes: boolean; diaSemana: number };
/** 6 semanas (42 dias), começando no domingo, para o mês (mes0 = 0..11). */
export function diasDoCalendario(ano: number, mes0: number): DiaDoCalendario[] {
  const primeiro = new Date(ano, mes0, 1);
  const inicio = new Date(ano, mes0, 1 - primeiro.getDay());
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + i);
    return {
      iso: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
      dia: d.getDate(),
      noMes: d.getMonth() === mes0,
      diaSemana: d.getDay(),
    };
  });
}

export function tituloDoMes(ano: number, mes0: number): string {
  const t = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(
    new Date(ano, mes0, 1),
  );
  return t.charAt(0).toUpperCase() + t.slice(1);
}
