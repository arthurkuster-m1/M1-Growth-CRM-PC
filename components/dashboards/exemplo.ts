/**
 * DADOS DE EXEMPLO dos dashboards (fase D0: protótipo visual). Determinísticos — o mesmo período
 * gera sempre os mesmos números — e NUNCA vêm do banco. Quando cada dashboard ligar nos dados
 * reais, estas funções saem e a tela passa a ler a API.
 */
import { somarDias } from "@/lib/inicio/datas";

function gerador(semente: number) {
  let s = semente >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const hash = (texto: string) =>
  [...texto].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 7);

/** Os dias do período (no máximo 92, para o protótipo não pesar). */
export function diasDoPeriodo(de: string, ate: string): string[] {
  const dias: string[] = [];
  for (let d = de; d <= ate && dias.length < 92; d = somarDias(d, 1)) dias.push(d);
  return dias;
}

export interface DiaDeTrafego {
  data: string;
  impressoes: number;
  alcance: number;
  cliques: number;
  viewsLP: number;
  leads: number;
  investimento: number;
  vendas: number;
  recebido: number;
}

export function trafegoDeExemplo(de: string, ate: string, campanha: string): DiaDeTrafego[] {
  const r = gerador(hash(`${de}|${ate}|${campanha}`));
  const fator = campanha === "todas" ? 1 : 0.55;
  return diasDoPeriodo(de, ate).map((data) => {
    const impressoes = Math.round((52000 + r() * 30000) * fator);
    const alcance = Math.round(impressoes * (0.72 + r() * 0.1));
    const cliques = Math.round(impressoes * (0.012 + r() * 0.01));
    const viewsLP = Math.round(cliques * (0.62 + r() * 0.18));
    const leads = Math.round(viewsLP * (0.1 + r() * 0.09));
    const investimento = Math.round((780 + r() * 520) * fator * 100) / 100;
    const vendas = r() > 0.55 ? Math.round(1 + r() * 2) : 0;
    const recebido = vendas * Math.round(1200 + r() * 1800);
    return { data, impressoes, alcance, cliques, viewsLP, leads, investimento, vendas, recebido };
  });
}

export interface CampanhaDeExemplo {
  nome: string;
  canal: string;
  investido: number;
  leads: number;
  vendas: number;
  recebido: number;
}

export const CAMPANHAS_DE_EXEMPLO: CampanhaDeExemplo[] = [
  { nome: "[06] Seletiva OUT/26 — Belo Horizonte", canal: "Meta Ads", investido: 3780.73, leads: 71, vendas: 4, recebido: 12400 },
  { nome: "[02] Remarketing — Visitantes da LP", canal: "Meta Ads", investido: 1240.5, leads: 38, vendas: 5, recebido: 9800 },
  { nome: "[04] Captação — Lead Ads", canal: "Meta Ads", investido: 2105.2, leads: 96, vendas: 2, recebido: 4100 },
  { nome: "[01] Institucional — Vídeo", canal: "Meta Ads", investido: 860.0, leads: 12, vendas: 0, recebido: 0 },
];

export const CRIATIVOS_DE_EXEMPLO = [
  { nome: "SEN01 — Depoimento cliente", ctr: 2.4, cpl: 38.2, leads: 54, vendas: 3, recebido: 8900 },
  { nome: "SEN02 — Antes e depois", ctr: 1.9, cpl: 46.8, leads: 41, vendas: 2, recebido: 4200 },
  { nome: "VID01 — Explicação 30s", ctr: 1.2, cpl: 71.4, leads: 17, vendas: 0, recebido: 0 },
  { nome: "EST03 — Carrossel oferta", ctr: 2.1, cpl: 41.5, leads: 33, vendas: 2, recebido: 5100 },
];

export function receitaMensalDeExemplo() {
  return [
    { mes: "Mai", recebido: 18200, previsto: 0, saiu: 6400 },
    { mes: "Jun", recebido: 22100, previsto: 0, saiu: 7100 },
    { mes: "Jul", recebido: 19800, previsto: 0, saiu: 6900 },
    { mes: "Ago", recebido: 26400, previsto: 0, saiu: 8200 },
    { mes: "Set", recebido: 31300, previsto: 0, saiu: 8800 },
    { mes: "Out", recebido: 28900, previsto: 9100, saiu: 8000 },
    { mes: "Nov", recebido: 0, previsto: 14200, saiu: 0 },
    { mes: "Dez", recebido: 0, previsto: 11800, saiu: 0 },
  ];
}

export const LEADS_PARADOS_DE_EXEMPLO = [
  { nome: "Mariana Costa", dono: "Carla", parado: "9 dias", canal: "WhatsApp" },
  { nome: "Rafael Nogueira", dono: "Sem dono", parado: "8 dias", canal: "Instagram" },
  { nome: "Studio Aurora", dono: "Carla", parado: "26 h", canal: "WhatsApp" },
  { nome: "João Pedro Alves", dono: "Diego", parado: "31 h", canal: "Formulário" },
  { nome: "Clínica Vitta", dono: "Diego", parado: "27 h", canal: "WhatsApp" },
];

export const ATENDENTES_DE_EXEMPLO = [
  { nome: "Carla Mendes", conversas: 86, respondidas: 84, tempo: "6 min", sla: 94, vendas: 9 },
  { nome: "Diego Santos", conversas: 74, respondidas: 69, tempo: "14 min", sla: 82, vendas: 6 },
  { nome: "Atendente IA", conversas: 212, respondidas: 212, tempo: "12 s", sla: 100, vendas: 3 },
  { nome: "Paula Rocha", conversas: 41, respondidas: 33, tempo: "47 min", sla: 61, vendas: 2 },
];

/** Mapa de calor: 7 dias × 12 faixas (08h–20h), volume de conversas iniciadas. */
export function calorDeExemplo(): number[][] {
  const r = gerador(42);
  return Array.from({ length: 7 }, (_, d) =>
    Array.from({ length: 12 }, (_, h) => {
      const base = d === 0 || d === 6 ? 3 : 12;
      const pico = h >= 3 && h <= 5 ? 1.8 : h >= 9 ? 1.4 : 1;
      return Math.round(base * pico * (0.5 + r()));
    }),
  );
}
