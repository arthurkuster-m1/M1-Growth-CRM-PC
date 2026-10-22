"use client";

import { useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { BlocoDaFicha, SeloDaFicha } from "@/components/contacts/ficha/BlocoDaFicha";
import { AbasDeVisualizacao } from "@/components/motor/AbasDeVisualizacao";
import { BarraDeConsulta, type CampoDaBarra } from "@/components/motor/BarraDeConsulta";
import { AcaoEmMassa, BarraDeSelecao } from "@/components/motor/BarraDeSelecao";
import { CampoDeData } from "@/components/motor/CalendarioDePeriodo";
import { Etiqueta } from "@/components/motor/Etiqueta";
import { TabelaDoMotor, type ColunaDoMotor } from "@/components/motor/TabelaDoMotor";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NumeroQueCabe } from "@/components/ui/NumeroQueCabe";
import { SeletorEmPopup } from "@/components/ui/SeletorEmPopup";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { aplicarConsulta, type CampoConsultavel, type ConsultaDaTabela } from "@/lib/motor/consulta";
import { proximaOrdenacao } from "@/lib/motor/ordenar-por-coluna";
import { alternarId, faixaEntre } from "@/lib/motor/selecao";
import { CORES_DA_OPCAO, type CorDaOpcao } from "@/lib/tarefas/opcoes-de-status";
import {
  ArrowRight,
  Bell,
  CalendarBlank,
  CaretLeft,
  ChartBar,
  ChatCircle,
  Check,
  Funnel,
  Gear,
  House,
  Info,
  Kanban,
  MagnifyingGlass,
  Megaphone,
  Phone,
  Plus,
  Rows,
  Star,
  Tag,
  Target,
  Trash,
  Users,
  Warning,
} from "@/lib/ui/icons";
import { cn } from "@/lib/utils";

/* ──────────────────────────── blocos de apoio da página ──────────────────────────── */

function Secao({
  id,
  titulo,
  descricao,
  children,
}: {
  id: string;
  titulo: string;
  descricao?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-20 rounded-2xl border bg-card p-5 shadow-sm">
      <h2 className="text-base font-semibold tracking-tight">{titulo}</h2>
      {descricao ? <p className="mt-0.5 max-w-3xl text-sm text-muted-foreground">{descricao}</p> : null}
      <div className="mt-4 grid gap-5">{children}</div>
    </section>
  );
}

const Legenda = ({ children }: { children: ReactNode }) => (
  <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{children}</p>
);

const ACCENT = ["50", "100", "200", "300", "400", "500", "600", "700", "800", "900", "950"];

function Amostra({ nome, variavel, claro }: { nome: string; variavel: string; claro?: boolean }) {
  return (
    <div className="grid gap-1.5 text-center">
      <div
        className={cn("h-14 rounded-xl border", claro ? "border-border" : "border-transparent")}
        style={{ backgroundColor: `var(${variavel})` }}
      />
      <span className="text-[11px] text-muted-foreground">{nome}</span>
    </div>
  );
}

/* ───────────────────────── a tabela estilo Notion (modelo) ───────────────────────── */

interface Linha {
  id: string;
  titulo: string;
  status: string;
  prioridade: string;
  prazo: string;
}

const STATUS = [
  { id: "nao-iniciada", rotulo: "Não iniciada", cor: "gray" as CorDaOpcao },
  { id: "em-andamento", rotulo: "Em andamento", cor: "blue" as CorDaOpcao },
  { id: "concluida", rotulo: "Concluída", cor: "green" as CorDaOpcao },
];
const PRIORIDADES = [
  { id: "alta", rotulo: "Alta", cor: "red" as CorDaOpcao },
  { id: "media", rotulo: "Média", cor: "yellow" as CorDaOpcao },
  { id: "baixa", rotulo: "Baixa", cor: "gray" as CorDaOpcao },
];
const LINHAS_INICIAIS: Linha[] = [
  { id: "1", titulo: "Revisão semanal das campanhas", status: "concluida", prioridade: "media", prazo: "2026-10-19" },
  { id: "2", titulo: "Ligar para os leads de ontem", status: "em-andamento", prioridade: "alta", prazo: "2026-10-23" },
  { id: "3", titulo: "Atualizar a oferta principal", status: "nao-iniciada", prioridade: "media", prazo: "2026-10-28" },
  { id: "4", titulo: "Subir os criativos novos", status: "nao-iniciada", prioridade: "baixa", prazo: "2026-10-30" },
  { id: "5", titulo: "Reunião de resultado com o cliente", status: "em-andamento", prioridade: "alta", prazo: "2026-10-24" },
];

function TabelaModelo() {
  const [linhas, setLinhas] = useState<Linha[]>(LINHAS_INICIAIS);
  const [consulta, setConsulta] = useState<ConsultaDaTabela>({});
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());
  const [ultimo, setUltimo] = useState<string | null>(null);
  const [abas, setAbas] = useState([
    { id: "todas", nome: "Todas", tipo: "tabela" as const },
    { id: "minhas", nome: "Em andamento", tipo: "tabela" as const },
  ]);
  const [ativa, setAtiva] = useState("todas");

  const campos: Array<CampoConsultavel<Linha> & { titulo: string; opcoes?: { id: string; rotulo: string; cor?: CorDaOpcao }[] }> = [
    { id: "titulo", titulo: "Título", tipo: "texto", valorDe: (l) => l.titulo },
    { id: "status", titulo: "Status", tipo: "opcao", valorDe: (l) => l.status, opcoes: STATUS },
    { id: "prioridade", titulo: "Prioridade", tipo: "opcao", valorDe: (l) => l.prioridade, opcoes: PRIORIDADES },
    { id: "prazo", titulo: "Prazo", tipo: "data", valorDe: (l) => l.prazo },
  ];
  const camposDaBarra: CampoDaBarra[] = campos.map((c) => ({ id: c.id, titulo: c.titulo, tipo: c.tipo, opcoes: c.opcoes }));

  const resultado = useMemo(
    () => aplicarConsulta(linhas, campos, consulta, { hoje: new Date().toISOString().slice(0, 10) }),
    // `campos` é recriado a cada render; as entradas reais são estas.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [linhas, consulta],
  );
  const grupos = resultado.grupos?.map((g) => {
    const campo = campos.find((c) => c.id === consulta.agrupar);
    const rotulo = g.chave === "" ? "Sem valor" : (campo?.opcoes?.find((o) => o.id === g.chave)?.rotulo ?? g.rotulo);
    return { chave: g.chave || "__vazio", titulo: <strong>{rotulo}</strong>, linhas: g.linhas };
  });
  const ids = resultado.linhas.map((l) => l.id);

  const colunas: ColunaDoMotor<Linha>[] = [
    {
      id: "titulo",
      titulo: "Título",
      largura: 300,
      semOcultar: true,
      celula: (l) => <span className="block truncate px-2 text-sm font-medium">{l.titulo}</span>,
    },
    {
      id: "status",
      titulo: "Status",
      largura: 160,
      celula: (l) => {
        const o = STATUS.find((s) => s.id === l.status)!;
        return (
          <span className="block px-2">
            <Etiqueta ponto cor={o.cor}>
              {o.rotulo}
            </Etiqueta>
          </span>
        );
      },
    },
    {
      id: "prioridade",
      titulo: "Prioridade",
      largura: 130,
      celula: (l) => {
        const o = PRIORIDADES.find((s) => s.id === l.prioridade)!;
        return (
          <span className="block px-2">
            <Etiqueta cor={o.cor}>{o.rotulo}</Etiqueta>
          </span>
        );
      },
    },
    {
      id: "prazo",
      titulo: "Prazo",
      largura: 130,
      celula: (l) => <span className="block px-2 text-sm tabular-nums">{l.prazo.split("-").reverse().join("/")}</span>,
    },
  ];

  return (
    <div className="grid gap-3">
      <AbasDeVisualizacao
        abas={abas}
        ativaId={ativa}
        podeEditar
        tipos={["tabela"]}
        aoEscolher={setAtiva}
        aoCriar={(nome, tipo) => {
          const id = `v-${abas.length}`;
          setAbas([...abas, { id, nome, tipo: tipo as "tabela" }]);
          setAtiva(id);
        }}
        aoConfigurar={() => toast.info("Aqui abre “Configurar visualização”: nome, ordem das abas e propriedades.")}
      />
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative min-w-0 flex-1 basis-60">
          <span className="sr-only">Buscar</span>
          <MagnifyingGlass size={16} aria-hidden className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground" />
          <input
            placeholder="Buscar tarefa"
            className="h-10 w-full rounded-xl border bg-background pr-3 pl-9 text-sm outline-hidden focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
          />
        </label>
        <BarraDeConsulta compacta campos={camposDaBarra} consulta={consulta} aoMudar={setConsulta} />
      </div>
      <TabelaDoMotor
        linhas={resultado.linhas}
        idDe={(l) => l.id}
        colunas={colunas}
        grupos={grupos}
        ordenacao={consulta.ordenacao}
        colunasOrdenaveis={new Set(campos.map((c) => c.id))}
        aoOrdenarPor={(coluna) => setConsulta({ ...consulta, ordenacao: proximaOrdenacao(consulta.ordenacao, coluna) })}
        podeReordenar={!consulta.ordenacao?.length && !consulta.agrupar}
        aoReordenar={(id, destino) =>
          setLinhas((atual) => {
            const item = atual.find((l) => l.id === id);
            if (!item) return atual;
            const resto = atual.filter((l) => l.id !== id);
            resto.splice(destino, 0, item);
            return resto;
          })
        }
        selecionadas={selecionadas}
        aoSelecionar={(id, { faixa }) => {
          setSelecionadas((atual) => {
            if (faixa && ultimo) {
              const novo = new Set(atual);
              for (const m of faixaEntre(ids, ultimo, id)) novo.add(m);
              return novo;
            }
            return alternarId(atual, id);
          });
          setUltimo(id);
        }}
        aoSelecionarTodas={(marcar) => setSelecionadas(marcar ? new Set(ids) : new Set())}
        rotuloDaTabela="Tarefas de exemplo"
        vazio={<p className="p-6 text-center text-sm text-muted-foreground">Nenhuma linha combina com os filtros.</p>}
      />
      <BarraDeSelecao quantidade={selecionadas.size} aoLimpar={() => setSelecionadas(new Set())}>
        <AcaoEmMassa rotulo="Status" icone={<Check size={14} aria-hidden />}>
          {(fechar) => (
            <div>
              {STATUS.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => {
                    setLinhas((a) => a.map((l) => (selecionadas.has(l.id) ? { ...l, status: o.id } : l)));
                    fechar();
                  }}
                  className="flex w-full rounded-md px-2 py-1.5 hover:bg-secondary"
                >
                  <Etiqueta ponto cor={o.cor}>
                    {o.rotulo}
                  </Etiqueta>
                </button>
              ))}
            </div>
          )}
        </AcaoEmMassa>
        <AcaoEmMassa
          rotulo="Apagar"
          icone={<Trash size={14} aria-hidden />}
          destrutivo
          aoClicar={() => {
            setLinhas((a) => a.filter((l) => !selecionadas.has(l.id)));
            setSelecionadas(new Set());
          }}
        />
      </BarraDeSelecao>
      <p className="text-xs text-muted-foreground">
        Teste: clique no título de uma coluna para ordenar · marque linhas (Shift marca um intervalo) · arraste a alça da
        esquerda para reordenar · use Filtrar, Ordenar e Agrupar.
      </p>
    </div>
  );
}

/* ─────────────────────────────────── a página ─────────────────────────────────── */

const ICONES = [House, Kanban, CalendarBlank, Megaphone, ChatCircle, Users, ChartBar, Target, Tag, Phone, Bell, Star, Gear, Funnel, Rows];

const INDICE = [
  ["principios", "Princípios"],
  ["cores", "Cores"],
  ["estados", "Estados"],
  ["botoes", "Botões"],
  ["campos", "Campos e toggles"],
  ["tipografia", "Tipografia"],
  ["forma", "Forma e espaço"],
  ["cartoes", "Cartões e blocos"],
  ["avisos", "Avisos e números"],
  ["tabela", "Tabela estilo Notion"],
  ["janelas", "Janelas e navegação"],
  ["icones", "Ícones"],
];

export function DesignSystemClient() {
  const [data, setData] = useState("");
  const [seletor, setSeletor] = useState("alta");
  const [toggles, setToggles] = useState({ a: true, b: false, c: true });
  const [chips, setChips] = useState<string[]>(["Ligação"]);
  const [dialogo, setDialogo] = useState(false);

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-5 pb-16">
      <header className="grid gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Design System</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          A linguagem visual do M1 Growth CRM. Tudo aqui são os componentes reais do app: o que estiver nesta página é a
          regra para todas as telas.
        </p>
        <nav aria-label="Seções" className="mt-2 flex flex-wrap gap-1.5">
          {INDICE.map(([id, nome]) => (
            <a key={id} href={`#${id}`} className="rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground hover:bg-secondary hover:text-foreground">
              {nome}
            </a>
          ))}
        </nav>
      </header>

      <Secao id="principios" titulo="Princípios" descricao="O que decide qualquer dúvida de desenho.">
        <ul className="grid gap-2 text-sm sm:grid-cols-2">
          {[
            ["Visual e espaçamento primeiro", "App leve, simples de usar. Menos é mais: se uma informação não ajuda na decisão, sai da tela."],
            ["Espaço para o que importa", "Tabelas e informações cruciais ganham a largura toda; cabeçalhos e comandos ocupam o mínimo."],
            ["Toda tabela segue o modelo Notion", "Filtrar, Agrupar e Ordenar · abas de visualização · ordenar clicando na coluna · seleção e edição em massa · arrastar para reordenar."],
            ["Toggles e tópicos bem separados", "Opção liga/desliga é sempre um toggle. Cada assunto num cartão com a barra colorida ao lado."],
            ["Arredondado, de ponta a ponta", "Botões, campos, chips e caixas de seleção redondos. Sem cantos vivos."],
            ["O espelho é Início e Estratégia", "Dúvida de estilo? Faça como as páginas Início e Estratégia."],
          ].map(([t, d]) => (
            <li key={t} className="rounded-xl border bg-background p-3">
              <p className="font-semibold">{t}</p>
              <p className="mt-0.5 text-muted-foreground">{d}</p>
            </li>
          ))}
        </ul>
      </Secao>

      <Secao id="cores" titulo="Cores" descricao="O destaque é o verde-azulado do M1. O 600 é o botão e o link; em áreas grandes, nada passa do 600.">
        <div className="grid gap-2">
          <Legenda>Destaque (accent)</Legenda>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-11">
            {ACCENT.map((n) => (
              <Amostra key={n} nome={n} variavel={`--color-accent-${n}`} />
            ))}
          </div>
        </div>
        <div className="grid gap-2">
          <Legenda>Superfícies e texto</Legenda>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            <Amostra nome="Fundo" variavel="--color-bg" claro />
            <Amostra nome="Cartão" variavel="--color-surface" claro />
            <Amostra nome="Elevada" variavel="--color-surface-elevated" claro />
            <Amostra nome="Borda" variavel="--color-border" claro />
            <Amostra nome="Texto suave" variavel="--color-text-muted" />
            <Amostra nome="Texto" variavel="--color-text" />
          </div>
        </div>
        <div className="grid gap-2">
          <Legenda>Cores de etiqueta (status, prioridade, tags)</Legenda>
          <div className="flex flex-wrap gap-2">
            {CORES_DA_OPCAO.map((c) => (
              <Etiqueta key={c} cor={c} ponto>
                {c}
              </Etiqueta>
            ))}
          </div>
        </div>
      </Secao>

      <Secao id="estados" titulo="Estados" descricao="Cor diz o estado, sempre com a mesma palavra-chave em todo o app.">
        <div className="flex flex-wrap gap-2">
          <Etiqueta ponto cor="green">Sucesso</Etiqueta>
          <Etiqueta ponto cor="orange">Atenção</Etiqueta>
          <Etiqueta ponto cor="red">Erro</Etiqueta>
          <Etiqueta ponto cor="blue">Informação</Etiqueta>
          <Etiqueta ponto cor="purple">Destaque</Etiqueta>
          <Etiqueta ponto cor="gray">Neutro</Etiqueta>
        </div>
        <div className="grid gap-1.5">
          <Legenda>Campanha</Legenda>
          <div className="flex flex-wrap gap-2">
            <Etiqueta ponto cor="gray">Planejada</Etiqueta>
            <Etiqueta ponto cor="green">Ativa</Etiqueta>
            <Etiqueta ponto cor="orange">Pausada</Etiqueta>
            <Etiqueta ponto cor="red">Encerrada</Etiqueta>
          </div>
          <Legenda>Oportunidade</Legenda>
          <div className="flex flex-wrap gap-2">
            <Etiqueta ponto cor="blue">Interesse</Etiqueta>
            <Etiqueta ponto cor="yellow">Comprometida</Etiqueta>
            <Etiqueta ponto cor="green">Concluída</Etiqueta>
            <Etiqueta ponto cor="red">Cancelada</Etiqueta>
          </div>
          <Legenda>Radar</Legenda>
          <div className="flex flex-wrap gap-2">
            <Etiqueta ponto cor="red">Crítico</Etiqueta>
            <Etiqueta ponto cor="orange">Em risco</Etiqueta>
            <Etiqueta ponto cor="blue">Em voo</Etiqueta>
            <Etiqueta ponto cor="green">Em dia</Etiqueta>
          </div>
        </div>
      </Secao>

      <Secao id="botoes" titulo="Botões" descricao="Um botão principal por contexto. Cantos arredondados, altura 40 (36 nos pequenos), texto em uma linha só.">
        <div className="flex flex-wrap items-center gap-3">
          <Button className="rounded-xl"><Plus size={16} aria-hidden className="mr-1.5" />Principal</Button>
          <Button variant="outline" className="rounded-xl">Secundário</Button>
          <Button variant="ghost" className="rounded-xl">Fantasma</Button>
          <Button variant="destructive" className="rounded-xl"><Trash size={16} aria-hidden className="mr-1.5" />Excluir</Button>
          <Button size="sm" className="rounded-xl">Pequeno</Button>
          <Button disabled className="rounded-xl">Desativado</Button>
          <button type="button" aria-label="Configurar" className="grid h-10 w-10 place-items-center rounded-xl border bg-card text-muted-foreground hover:bg-secondary hover:text-foreground">
            <Gear size={18} aria-hidden />
          </button>
        </div>
        <div className="grid gap-2">
          <Legenda>Voltar (um só desenho para o app inteiro)</Legenda>
          <span className="inline-flex h-9 w-fit items-center gap-1.5 rounded-xl border bg-card px-3 text-sm font-medium text-muted-foreground shadow-sm">
            <CaretLeft size={14} weight="bold" aria-hidden />
            Voltar para [TESTE] TP
          </span>
        </div>
        <div className="grid gap-2">
          <Legenda>Chips que ligam e desligam</Legenda>
          <div className="flex flex-wrap gap-1.5">
            {["Ligação", "WhatsApp", "Instagram", "E-mail"].map((c) => {
              const ligado = chips.includes(c);
              return (
                <button
                  key={c}
                  type="button"
                  aria-pressed={ligado}
                  onClick={() => setChips((a) => (ligado ? a.filter((x) => x !== c) : [...a, c]))}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                    ligado ? "border-primary/40 bg-primary/10 text-primary" : "text-muted-foreground hover:bg-secondary",
                  )}
                >
                  {c}
                </button>
              );
            })}
          </div>
        </div>
      </Secao>

      <Secao id="campos" titulo="Campos e toggles" descricao="Campo de texto, seletor em popup, data e interruptor. Nunca o seletor ou o calendário nativos do navegador.">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <label className="grid gap-1 text-xs font-medium text-muted-foreground">
            Texto
            <Input placeholder="Nome do lead" className="h-10 rounded-xl" />
          </label>
          <div className="grid gap-1 text-xs font-medium text-muted-foreground">
            Seletor
            <SeletorEmPopup
              rotulo="Prioridade"
              valor={seletor}
              opcoes={PRIORIDADES}
              aoEscolher={setSeletor}
              className="min-h-10 rounded-xl"
            />
          </div>
          <div className="grid gap-1 text-xs font-medium text-muted-foreground">
            Data
            <CampoDeData valor={data} aoMudar={setData} rotulo="Prazo" className="w-full" />
          </div>
          <label className="grid gap-1 text-xs font-medium text-muted-foreground sm:col-span-2 lg:col-span-3">
            Texto longo
            <Textarea rows={2} placeholder="Observações" className="rounded-xl" />
          </label>
        </div>
        <div className="grid gap-1 rounded-2xl border bg-background p-3 sm:max-w-md">
          <Legenda>Toggles (opção liga/desliga)</Legenda>
          {(
            [
              ["a", "Avisar a equipe na Central"],
              ["b", "Exigir motivo de ganho"],
              ["c", "Mostrar o melhor horário para ligar"],
            ] as const
          ).map(([k, rotulo]) => (
            <label key={k} className="flex items-center justify-between gap-3 rounded-xl px-1 py-1.5 text-sm">
              <span>{rotulo}</span>
              <Switch checked={toggles[k]} onCheckedChange={(v) => setToggles((t) => ({ ...t, [k]: v }))} aria-label={rotulo} />
            </label>
          ))}
        </div>
      </Secao>

      <Secao id="tipografia" titulo="Tipografia" descricao="Montserrat, com Atkinson de reserva. Números e códigos em fonte mono quando precisam alinhar.">
        <div className="grid gap-2">
          <p className="text-2xl font-semibold tracking-tight">Título da página · 24</p>
          <p className="text-lg font-semibold tracking-tight">Título de seção · 18</p>
          <p className="text-base font-semibold">Título de cartão · 16</p>
          <p className="text-sm">Texto padrão da interface · 14</p>
          <p className="text-xs text-muted-foreground">Legenda, data e apoio · 12</p>
          <p className="font-mono text-sm tabular-nums">R$ 1.250,00 · 0042 · 19/10/2026</p>
        </div>
      </Secao>

      <Secao id="forma" titulo="Forma e espaço" descricao="Uma régua só: o que é de cada tamanho.">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Cartões e blocos", "rounded-2xl", "rounded-2xl"],
            ["Botões e campos", "rounded-xl", "rounded-xl"],
            ["Etiquetas pequenas", "rounded-md", "rounded-md"],
            ["Chips e avatares", "rounded-full", "rounded-full"],
          ].map(([nome, cls, rotulo]) => (
            <div key={nome} className="grid gap-1.5">
              <div className={cn("h-16 border bg-secondary/60", cls)} />
              <p className="text-xs font-medium">{nome}</p>
              <p className="font-mono text-[11px] text-muted-foreground">{rotulo}</p>
            </div>
          ))}
        </div>
        <div className="grid gap-1.5 text-sm text-muted-foreground">
          <p><strong className="text-foreground">Espaçamento:</strong> 4 · 8 · 12 · 16 · 24 · 32. Entre cartões, 16; dentro do cartão, 16 a 20; entre campos, 12.</p>
          <p><strong className="text-foreground">Sombra:</strong> leve (<code className="font-mono">shadow-sm</code>) nos cartões; forte (<code className="font-mono">shadow-xl</code>) só em barras e janelas flutuantes.</p>
          <p><strong className="text-foreground">Largura:</strong> telas de tabela usam a largura toda; telas de leitura e formulário, até 1152 px.</p>
        </div>
      </Secao>

      <Secao id="cartoes" titulo="Cartões e blocos" descricao="Cada assunto num cartão, com a barra colorida ao lado. A cor identifica o assunto, não decora.">
        <div className="grid gap-4 lg:grid-cols-2">
          <BlocoDaFicha titulo="Oportunidades" cor="purple" acao={<Button size="sm" className="rounded-xl"><Plus size={14} aria-hidden className="mr-1" />Nova</Button>}>
            <p className="text-sm text-muted-foreground">Conteúdo do tópico, com respiro e uma ação no canto.</p>
          </BlocoDaFicha>
          <BlocoDaFicha titulo="Histórico" cor="blue" recolhivel={{ texto: "3 registros", selos: <SeloDaFicha cor="blue">3</SeloDaFicha> }}>
            <p className="text-sm text-muted-foreground">Bloco que abre e fecha: fechado ocupa uma linha.</p>
          </BlocoDaFicha>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {(
            [
              ["LTV atual", "R$ 12.480,00", "border-l-green-500"],
              ["A receber", "R$ 3.200,00", "border-l-blue-500"],
              ["Vendas", "8", "border-l-purple-500"],
              ["Faturamento", "R$ 3.456.789,00", "border-l-orange-500"],
            ] as const
          ).map(([rotulo, valor, barra]) => (
            <div key={rotulo} className={cn("rounded-2xl border border-l-4 bg-card p-4 shadow-sm", barra)}>
              <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{rotulo}</p>
              <p className="mt-1 text-xl font-semibold tabular-nums">
                <NumeroQueCabe>{valor}</NumeroQueCabe>
              </p>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">Números de cartão sempre em uma linha: a fonte encolhe e, de 1 milhão para cima, abrevia (3,5 mi).</p>
      </Secao>

      <Secao id="avisos" titulo="Avisos e números" descricao="Aviso depois de uma ação: curto, com ícone, na cor do estado.">
        <div className="grid gap-2">
          {(
            [
              ["bg-info-bg text-info-fg", <Info key="i" size={16} aria-hidden />, "Os números vêm da plataforma no momento em que você clica em Atualizar."],
              ["bg-success-bg text-success-fg", <Check key="c" size={16} aria-hidden />, "Campanha criada com sucesso."],
              ["bg-warning-bg text-warning-fg", <Warning key="w" size={16} aria-hidden />, "O orçamento passa de 90% antes do fim do período."],
              ["bg-error-bg text-error-fg", <Warning key="e" size={16} aria-hidden />, "Este telefone já está cadastrado em outro lead."],
            ] as const
          ).map(([cls, icone, texto]) => (
            <p key={texto} className={cn("flex items-center gap-2 rounded-xl px-3 py-2 text-sm", cls)}>
              {icone}
              {texto}
            </p>
          ))}
        </div>
      </Secao>

      <Secao
        id="tabela"
        titulo="Tabela estilo Notion"
        descricao="O modelo de toda tabela do app: Filtrar · Ordenar · Agrupar, abas de visualização, ordenar clicando na coluna, seleção e edição em massa e arrastar para reordenar. Esta é uma tabela de verdade, com dados de exemplo."
      >
        <TabelaModelo />
      </Secao>

      <Secao id="janelas" titulo="Janelas e navegação" descricao="Janela central com título, texto de apoio e rodapé fixo; avisos rápidos no canto.">
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" className="rounded-xl" onClick={() => setDialogo(true)}>Abrir uma janela</Button>
          <Button variant="outline" className="rounded-xl" onClick={() => toast.success("Ação registrada no histórico")}>Aviso de sucesso</Button>
          <Button variant="outline" className="rounded-xl" onClick={() => toast.error("Não foi possível salvar. Tente de novo.")}>Aviso de erro</Button>
        </div>
        <Dialog open={dialogo} onOpenChange={setDialogo}>
          <DialogContent className="max-w-md rounded-2xl">
            <DialogHeader>
              <DialogTitle>Título da janela</DialogTitle>
              <DialogDescription>Uma frase que explica o que acontece aqui.</DialogDescription>
            </DialogHeader>
            <Input placeholder="Campo" className="h-10 rounded-xl" />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" className="rounded-xl" onClick={() => setDialogo(false)}>Cancelar</Button>
              <Button className="rounded-xl" onClick={() => setDialogo(false)}>Salvar</Button>
            </div>
          </DialogContent>
        </Dialog>
        <p className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-primary">Abrir <ArrowRight size={14} aria-hidden /></p>
      </Secao>

      <Secao id="icones" titulo="Ícones" descricao="Phosphor, sempre de @/lib/ui/icons. 16 px nos botões, 14 nas etiquetas, 18 na navegação.">
        <div className="flex flex-wrap gap-4 text-muted-foreground">
          {ICONES.map((Icone, i) => (
            <Icone key={i} size={22} aria-hidden />
          ))}
        </div>
      </Secao>
    </div>
  );
}
