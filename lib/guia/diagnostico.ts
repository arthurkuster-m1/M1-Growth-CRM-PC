/**
 * O DIAGNÓSTICO — função PURA: perfil + sinais (+ o que alguém marcou à mão) → o estado de cada
 * passo do mapa, a prontidão e os próximos passos. Sem banco, sem relógio global (a data entra
 * como parâmetro), sem IA: o mesmo dado dá sempre a mesma resposta.
 *
 * Regras (as mesmas do plano, §5):
 *  - Cada passo recebe uma classe (E/R/O/-) da matriz do mapa para o perfil do cliente.
 *  - O estado vem do detector; uma marcação à mão ("feito"/"dispensado") sempre vence o detector
 *    (detector errado nunca trava ninguém).
 *  - Passo feito há mais que `venceDias` volta como `desatualizado`.
 *  - `bloqueado` = ainda não foi feito e um antecessor ESSENCIAL (para este perfil) está pendente.
 *    Antecessor recomendado/opcional nunca bloqueia; antecessor "não verificado" também não.
 *  - Os próximos passos mostram só essenciais enquanto houver algum a fazer; recomendado só depois.
 *  - Sem perfil só a fase de cadastros é avaliada, e o primeiro passo é preencher o perfil.
 *  - Leitura que falhou vira "não verificado": fica fora da prontidão e nunca finge "feito".
 */
import { PASSOS, classificar } from "./catalogo";
import {
  FASES,
  type Classificacao,
  type Diagnostico,
  type EstadoDoPasso,
  type FaseDoGuia,
  type PassoDiagnosticado,
  type PassoDoMapa,
  type Perfil,
  type ProntidaoDaFase,
  type RegistroManual,
  type Sinais,
} from "./tipos";

export const MAXIMO_DE_PROXIMOS = 5;

const MS_POR_DIA = 86_400_000;

/** Para classificar a fase de cadastros quando ainda não há perfil (as classes dela não variam). */
const PERFIL_NEUTRO: Perfil = { nicho: "servico", modelos: [], jaTemOferta: false };

/** Quanto cada classe pesa na prontidão. Opcional não conta: não pode puxar a nota para baixo. */
const PESO: Record<Classificacao, number> = { E: 3, R: 1, O: 0, "-": 0 };
/** Quanto de um passo "vale" em cada estado. */
const VALOR: Partial<Record<EstadoDoPasso, number>> = {
  feito: 1,
  desatualizado: 0.5,
  em_andamento: 0.25,
  falta: 0,
  bloqueado: 0,
};

export interface EntradaDoDiagnostico {
  perfil: Perfil | null;
  sinais: Sinais;
  /** O que alguém marcou à mão, por id do passo (a G2 lê da tabela; a G1 passa vazio). */
  manuais?: Readonly<Record<string, RegistroManual>>;
  /** "Agora", para o prazo de validade. */
  agora: Date;
  /** Só os testes trocam o catálogo. */
  catalogo?: readonly PassoDoMapa[];
}

const diasDesde = (iso: string, agora: Date): number | null => {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : Math.floor((agora.getTime() - t) / MS_POR_DIA);
};

const SATISFAZ_DEPENDENCIA = new Set<EstadoDoPasso>([
  "feito",
  "desatualizado",
  "dispensado",
  "nao_se_aplica",
  "nao_verificado",
]);

export function diagnosticar(entrada: EntradaDoDiagnostico): Diagnostico {
  const { perfil, sinais, agora } = entrada;
  const manuais = entrada.manuais ?? {};
  const catalogo = entrada.catalogo ?? PASSOS;
  const avaliados = perfil ? catalogo : catalogo.filter((p) => p.fase === "cadastros");
  const perfilEfetivo = perfil ?? PERFIL_NEUTRO;

  const porId = new Map<string, PassoDiagnosticado>();

  avaliados.forEach((passo, ordem) => {
    const classificacao = classificar(passo, perfilEfetivo);
    const base = {
      id: passo.id,
      fase: passo.fase,
      titulo: passo.titulo,
      porque: passo.porque,
      classificacao,
      confianca: passo.confianca,
      onde: passo.onde,
      aguardando: [] as string[],
      ordem,
    };

    if (classificacao === "-") {
      porId.set(passo.id, {
        ...base,
        estado: "nao_se_aplica",
        evidencia: "Não se aplica a este perfil",
        manual: false,
        quando: null,
      });
      return;
    }

    const marca = manuais[passo.id];
    if (marca?.estado === "dispensado") {
      porId.set(passo.id, {
        ...base,
        estado: "dispensado",
        evidencia: marca.motivo ? `Dispensado: ${marca.motivo}` : "Dispensado",
        manual: true,
        quando: marca.em ?? null,
      });
      return;
    }

    let estado: EstadoDoPasso;
    let evidencia: string;
    let quando: string | null;
    let manual = false;

    if (marca?.estado === "feito") {
      estado = "feito";
      evidencia = "Marcado como feito à mão";
      quando = marca.em ?? null;
      manual = true;
    } else if (passo.detectar) {
      const d = passo.detectar(sinais, perfil);
      estado = d.estado;
      evidencia = d.evidencia;
      quando = d.quando ?? null;
    } else {
      estado = "falta";
      evidencia = "Passo manual: ainda não foi marcado como feito";
      quando = null;
    }

    if (
      estado === "feito" &&
      passo.venceDias !== undefined &&
      quando &&
      (!passo.venceSe || passo.venceSe(sinais))
    ) {
      const dias = diasDesde(quando, agora);
      if (dias !== null && dias > passo.venceDias) {
        estado = "desatualizado";
        evidencia = `${evidencia} — há ${dias} dias (o prazo é ${passo.venceDias})`;
      }
    }

    porId.set(passo.id, { ...base, estado, evidencia, manual, quando });
  });

  // Bloqueio: na ordem do catálogo (todo antecessor vem antes), então o estado final dele já existe.
  for (const passo of avaliados) {
    const d = porId.get(passo.id);
    if (!d || d.estado !== "falta") continue;
    const aguardando = passo.depende.filter((id) => {
      const dep = porId.get(id);
      return !!dep && dep.classificacao === "E" && !SATISFAZ_DEPENDENCIA.has(dep.estado);
    });
    if (aguardando.length > 0) porId.set(passo.id, { ...d, estado: "bloqueado", aguardando });
  }

  const passos = avaliados.map((p) => porId.get(p.id) as PassoDiagnosticado);
  const conta = new Map(avaliados.map((p) => [p.id, p.contaNaProntidao !== false]));

  // Prontidão.
  const porFase = Object.fromEntries(
    FASES.map((f) => [f, { pct: null, feitos: 0, total: 0 } as ProntidaoDaFase]),
  ) as Record<FaseDoGuia, ProntidaoDaFase>;
  const soma: Record<string, { ganho: number; peso: number }> = {};
  let ganhoGeral = 0;
  let pesoGeral = 0;
  for (const p of passos) {
    const peso = PESO[p.classificacao];
    const valor = VALOR[p.estado];
    if (!conta.get(p.id) || peso === 0 || valor === undefined) continue;
    const f = (soma[p.fase] ??= { ganho: 0, peso: 0 });
    f.ganho += peso * valor;
    f.peso += peso;
    ganhoGeral += peso * valor;
    pesoGeral += peso;
    porFase[p.fase].total += 1;
    if (p.estado === "feito") porFase[p.fase].feitos += 1;
  }
  for (const f of FASES) {
    const s = soma[f];
    porFase[f].pct = s ? Math.round((s.ganho / s.peso) * 100) : null;
  }

  // Próximos: o que falta antes do que venceu, depois a ordem do mapa. Só aparece recomendado quando
  // não sobra nenhum essencial a fazer agora — foco: informação com propósito, não a lista inteira.
  const acionaveis = passos.filter(
    (p) => p.estado === "falta" || p.estado === "em_andamento" || p.estado === "desatualizado",
  );
  const essenciais = acionaveis.filter((p) => p.classificacao === "E");
  const candidatos = (
    essenciais.length > 0 ? essenciais : acionaveis.filter((p) => p.classificacao === "R")
  ).sort(
    (a, b) =>
      (a.estado === "desatualizado" ? 1 : 0) - (b.estado === "desatualizado" ? 1 : 0) ||
      FASES.indexOf(a.fase) - FASES.indexOf(b.fase) ||
      a.ordem - b.ordem,
  );

  return {
    perfilPendente: perfil === null,
    passos,
    proximos: candidatos.slice(0, MAXIMO_DE_PROXIMOS),
    prontidao: {
      geral: pesoGeral > 0 ? Math.round((ganhoGeral / pesoGeral) * 100) : null,
      porFase,
    },
    naoVerificados: passos.filter((p) => p.estado === "nao_verificado").map((p) => p.id),
  };
}
