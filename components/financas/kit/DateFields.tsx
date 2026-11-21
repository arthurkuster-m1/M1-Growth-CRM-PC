"use client";

import { useEffect, useRef, useState } from "react";
import {
  CalendarBlank,
  CaretDoubleLeft,
  CaretDoubleRight,
  CaretLeft,
  CaretRight,
} from "@/lib/ui/icons";
import { cx } from "./cx";
import { usePopover } from "./popover";
import {
  DIAS_SEMANA,
  MESES_CURTOS,
  brParaISO,
  diasDoCalendario,
  hojeISO,
  isoParaBR,
  mascaraData,
  somarDias,
  somarMeses,
  tituloDoMes,
} from "./calendario";

type Alteracao = { target: { value: string }; currentTarget: { value: string } };
type Comum = {
  id?: string;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean | "true" | "false";
};
const evento = (value: string): Alteracao => ({ target: { value }, currentTarget: { value } });

const dataLonga = (iso: string) => {
  const [a = 0, m = 0, d = 0] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(a, m - 1, d));
};

/**
 * Data no padrão do Design System: dá para DIGITAR (com máscara dd/mm/aaaa, bom para o teclado numérico do celular)
 * ou abrir o calendário. O valor é sempre "AAAA-MM-DD".
 */
export function DateField({
  value,
  onChange,
  id,
  disabled,
  className,
  botaoForaDoTab,
  ...aria
}: Comum & {
  value: string;
  onChange: (e: Alteracao) => void;
  /** o botão do calendário não entra na ordem do Tab (tabelas editáveis: Tab vai direto ao campo seguinte; Alt+↓ ainda abre o calendário) */ botaoForaDoTab?: boolean;
}) {
  const caixa = useRef<HTMLDivElement>(null);
  const campo = useRef<HTMLInputElement>(null);
  const { ref: pop, aberto, setAberto } = usePopover(caixa, { largura: 304 });
  const [texto, setTexto] = useState(isoParaBR(value));
  const focado = useRef(false);
  const inicial = brParaISO(value) ?? hojeISO();
  const [vis, setVis] = useState(() => ({
    ano: +inicial.slice(0, 4),
    mes0: +inicial.slice(5, 7) - 1,
  }));
  const [foco, setFoco] = useState(inicial);
  /** o título do calendário abre o seletor de mês/ano: dias → meses → anos (troca de ano rápida) */
  const [visao, setVisao] = useState<"dias" | "meses" | "anos">("dias");
  const [blocoAnos, setBlocoAnos] = useState(0);

  useEffect(() => {
    if (!focado.current) setTexto(isoParaBR(value));
  }, [value]);
  useEffect(() => {
    if (aberto && visao === "dias")
      pop.current?.querySelector<HTMLElement>(`[data-iso="${foco}"]`)?.focus();
  }, [aberto, foco, vis, pop, visao]);
  // nas telas de mês/ano o botão clicado some: leva o foco para dentro do calendário, senão o Esc fecharia tudo de uma vez
  useEffect(() => {
    if (aberto && visao !== "dias")
      pop.current
        ?.querySelector<HTMLElement>('.fi-cal__mes[aria-pressed="true"], .fi-cal__mes')
        ?.focus();
  }, [aberto, visao, blocoAnos, pop]);

  function abrir() {
    if (disabled) return;
    const base = brParaISO(value) ?? hojeISO();
    setFoco(base);
    setVis({ ano: +base.slice(0, 4), mes0: +base.slice(5, 7) - 1 });
    setVisao("dias");
    setAberto(true);
  }
  function fechar(devolverFoco: boolean) {
    setAberto(false);
    if (devolverFoco) campo.current?.focus();
  }
  function escolher(iso: string) {
    onChange(evento(iso));
    setTexto(isoParaBR(iso));
    fechar(true);
  }
  function irPara(iso: string) {
    setFoco(iso);
    setVis({ ano: +iso.slice(0, 4), mes0: +iso.slice(5, 7) - 1 });
  }
  function mudarMes(n: number) {
    irPara(somarMeses(foco, n));
  }
  function mudarAno(n: number) {
    irPara(somarMeses(foco, 12 * n));
  }
  const escolherMes = (mes0: number) => {
    irPara(somarMeses(foco, mes0 - (+foco.slice(5, 7) - 1)));
    setVisao("dias");
  };
  const escolherAno = (ano: number) => {
    irPara(somarMeses(foco, 12 * (ano - +foco.slice(0, 4))));
    setVisao("meses");
  };
  const inicioBlocoAnos = vis.ano - 5 + blocoAnos * 12;

  function aoDigitar(bruto: string) {
    const t = /^\d{4}-\d{2}-\d{2}$/.test(bruto.trim())
      ? isoParaBR(bruto.trim())
      : mascaraData(bruto);
    setTexto(t);
    const iso = brParaISO(t);
    if (iso && iso !== value) onChange(evento(iso)); // data completa e válida: já vale
  }

  function aoTeclarNoCalendario(e: React.KeyboardEvent) {
    const passos: Record<string, () => void> = {
      ArrowLeft: () => irPara(somarDias(foco, -1)),
      ArrowRight: () => irPara(somarDias(foco, 1)),
      ArrowUp: () => irPara(somarDias(foco, -7)),
      ArrowDown: () => irPara(somarDias(foco, 7)),
      PageUp: () => (e.shiftKey ? mudarAno(-1) : mudarMes(-1)),
      PageDown: () => (e.shiftKey ? mudarAno(1) : mudarMes(1)),
      Home: () =>
        irPara(
          somarDias(
            foco,
            -new Date(+foco.slice(0, 4), +foco.slice(5, 7) - 1, +foco.slice(8, 10)).getDay(),
          ),
        ),
      End: () =>
        irPara(
          somarDias(
            foco,
            6 - new Date(+foco.slice(0, 4), +foco.slice(5, 7) - 1, +foco.slice(8, 10)).getDay(),
          ),
        ),
    };
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      if (visao !== "dias") setVisao("dias");
      else fechar(true);
    } else if (visao === "dias" && passos[e.key]) {
      e.preventDefault();
      passos[e.key]?.();
    }
  }

  const dias = diasDoCalendario(vis.ano, vis.mes0);
  const hoje = hojeISO();
  return (
    <>
      <div
        ref={caixa}
        className={cx("fi-datefield", aberto && "is-open", className)}
        aria-invalid={aria["aria-invalid"]}
      >
        <input
          ref={campo}
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder="dd/mm/aaaa"
          maxLength={10}
          disabled={disabled}
          data-value={value}
          value={texto}
          aria-label={aria["aria-label"]}
          aria-describedby={aria["aria-describedby"]}
          aria-invalid={aria["aria-invalid"]}
          onFocus={() => {
            focado.current = true;
          }}
          onBlur={() => {
            focado.current = false;
            setTexto(isoParaBR(value));
          }}
          onChange={(e) => aoDigitar(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown" && e.altKey) {
              e.preventDefault();
              abrir();
            }
          }}
        />
        <button
          type="button"
          className="fi-datefield__btn"
          tabIndex={botaoForaDoTab ? -1 : undefined}
          aria-label="Abrir calendário"
          aria-haspopup="dialog"
          aria-expanded={aberto}
          disabled={disabled}
          onClick={() => (aberto ? fechar(false) : abrir())}
        >
          <CalendarBlank size={20} />
        </button>
      </div>
      <div
        ref={pop}
        popover="auto"
        role="dialog"
        aria-label="Calendário"
        className="fi-pop fi-cal"
        onKeyDown={aoTeclarNoCalendario}
      >
        {visao === "dias" && (
          <>
            <div className="fi-cal__topo">
              <span className="fi-cal__navs">
                <button
                  type="button"
                  className="fi-cal__nav"
                  aria-label="Ano anterior"
                  title="Ano anterior"
                  onClick={() => mudarAno(-1)}
                >
                  <CaretDoubleLeft size={16} weight="bold" />
                </button>
                <button
                  type="button"
                  className="fi-cal__nav"
                  aria-label="Mês anterior"
                  onClick={() => mudarMes(-1)}
                >
                  <CaretLeft size={18} weight="bold" />
                </button>
              </span>
              <button
                type="button"
                className="fi-cal__titulo fi-cal__titulo--botao"
                aria-live="polite"
                aria-label={`${tituloDoMes(vis.ano, vis.mes0)}. Escolher mês e ano`}
                onClick={() => {
                  setVisao("meses");
                }}
              >
                {tituloDoMes(vis.ano, vis.mes0)}
              </button>
              <span className="fi-cal__navs">
                <button
                  type="button"
                  className="fi-cal__nav"
                  aria-label="Próximo mês"
                  onClick={() => mudarMes(1)}
                >
                  <CaretRight size={18} weight="bold" />
                </button>
                <button
                  type="button"
                  className="fi-cal__nav"
                  aria-label="Próximo ano"
                  title="Próximo ano"
                  onClick={() => mudarAno(1)}
                >
                  <CaretDoubleRight size={16} weight="bold" />
                </button>
              </span>
            </div>
            <div className="fi-cal__grade" role="group" aria-label={tituloDoMes(vis.ano, vis.mes0)}>
              {DIAS_SEMANA.map((d, i) => (
                <span key={i} className="fi-cal__semana" aria-label={d.longo}>
                  {d.curto}
                </span>
              ))}
              {dias.map((d) => (
                <button
                  key={d.iso}
                  type="button"
                  data-iso={d.iso}
                  tabIndex={d.iso === foco ? 0 : -1}
                  aria-label={dataLonga(d.iso)}
                  aria-pressed={d.iso === value}
                  className={cx("fi-cal__dia", !d.noMes && "is-fora", d.iso === hoje && "is-hoje")}
                  onClick={() => escolher(d.iso)}
                >
                  {d.dia}
                </button>
              ))}
            </div>
          </>
        )}
        {visao === "meses" && (
          <>
            <div className="fi-cal__topo">
              <button
                type="button"
                className="fi-cal__nav"
                aria-label="Ano anterior"
                onClick={() => mudarAno(-1)}
              >
                <CaretLeft size={18} weight="bold" />
              </button>
              <button
                type="button"
                className="fi-cal__titulo fi-cal__titulo--botao"
                aria-label={`${vis.ano}. Escolher o ano`}
                onClick={() => {
                  setBlocoAnos(0);
                  setVisao("anos");
                }}
              >
                {vis.ano}
              </button>
              <button
                type="button"
                className="fi-cal__nav"
                aria-label="Próximo ano"
                onClick={() => mudarAno(1)}
              >
                <CaretRight size={18} weight="bold" />
              </button>
            </div>
            <div className="fi-cal__meses" role="group" aria-label={`Meses de ${vis.ano}`}>
              {MESES_CURTOS.map((m, i) => (
                <button
                  key={m}
                  type="button"
                  className="fi-cal__mes"
                  aria-pressed={i === vis.mes0 && vis.ano === +value.slice(0, 4)}
                  aria-label={`${tituloDoMes(vis.ano, i)}`}
                  onClick={() => escolherMes(i)}
                >
                  {m}
                </button>
              ))}
            </div>
          </>
        )}
        {visao === "anos" && (
          <>
            <div className="fi-cal__topo">
              <button
                type="button"
                className="fi-cal__nav"
                aria-label="Anos anteriores"
                onClick={() => setBlocoAnos((b) => b - 1)}
              >
                <CaretLeft size={18} weight="bold" />
              </button>
              <span className="fi-cal__titulo">
                {inicioBlocoAnos} – {inicioBlocoAnos + 11}
              </span>
              <button
                type="button"
                className="fi-cal__nav"
                aria-label="Próximos anos"
                onClick={() => setBlocoAnos((b) => b + 1)}
              >
                <CaretRight size={18} weight="bold" />
              </button>
            </div>
            <div className="fi-cal__meses" role="group" aria-label="Anos">
              {Array.from({ length: 12 }, (_, i) => inicioBlocoAnos + i).map((a) => (
                <button
                  key={a}
                  type="button"
                  className="fi-cal__mes"
                  aria-pressed={a === vis.ano}
                  aria-label={`Ano ${a}`}
                  onClick={() => {
                    setBlocoAnos(0);
                    escolherAno(a);
                  }}
                >
                  {a}
                </button>
              ))}
            </div>
          </>
        )}
        <div className="fi-cal__rodape">
          <button type="button" className="fi-cal__hoje" onClick={() => escolher(hoje)}>
            {vis.ano === +hoje.slice(0, 4) && vis.mes0 === +hoje.slice(5, 7) - 1 && visao === "dias"
              ? "Hoje"
              : "Voltar para hoje"}
          </button>
          <span className="t-caption t-muted fi-cal__dica">
            Toque no mês/ano para trocar rápido
          </span>
        </div>
      </div>
    </>
  );
}

/** Mês e ano ("AAAA-MM") com seletor de mês no padrão do Design System. */
export function MonthField({
  value,
  onChange,
  id,
  disabled,
  className,
  ...aria
}: Comum & { value: string; onChange: (e: Alteracao) => void }) {
  const gatilho = useRef<HTMLButtonElement>(null);
  const { ref: pop, aberto, setAberto } = usePopover(gatilho, { largura: 264 });
  const valido = /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
  const [ano, setAno] = useState(valido ? +value.slice(0, 4) : new Date().getFullYear());
  const [foco, setFoco] = useState(valido ? +value.slice(5, 7) - 1 : new Date().getMonth());

  useEffect(() => {
    if (aberto) pop.current?.querySelector<HTMLElement>(`[data-mes="${foco}"]`)?.focus();
  }, [aberto, foco, pop]);

  function abrir() {
    if (disabled) return;
    if (valido) {
      setAno(+value.slice(0, 4));
      setFoco(+value.slice(5, 7) - 1);
    }
    setAberto(true);
  }
  function fechar(devolverFoco: boolean) {
    setAberto(false);
    if (devolverFoco) gatilho.current?.focus();
  }
  function escolher(m0: number) {
    onChange(evento(`${ano}-${String(m0 + 1).padStart(2, "0")}`));
    fechar(true);
  }

  function aoTeclar(e: React.KeyboardEvent) {
    const passo: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -3,
      ArrowDown: 3,
    };
    if (e.key in passo) {
      e.preventDefault();
      setFoco((f) => Math.min(11, Math.max(0, f + passo[e.key]!)));
    } else if (e.key === "PageUp") {
      e.preventDefault();
      setAno((a) => a - 1);
    } else if (e.key === "PageDown") {
      e.preventDefault();
      setAno((a) => a + 1);
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      fechar(true);
    }
  }

  const rotulo = valido ? tituloDoMes(+value.slice(0, 4), +value.slice(5, 7) - 1) : "Escolher mês";
  return (
    <>
      <button
        ref={gatilho}
        id={id}
        type="button"
        disabled={disabled}
        data-value={value}
        aria-haspopup="dialog"
        aria-expanded={aberto}
        aria-label={aria["aria-label"]}
        aria-describedby={aria["aria-describedby"]}
        aria-invalid={aria["aria-invalid"]}
        className={cx("fi-selectbox", aberto && "is-open", className)}
        onClick={() => (aberto ? fechar(false) : abrir())}
      >
        <span className={cx("fi-selectbox__texto", !valido && "is-vazio")}>{rotulo}</span>
        <CalendarBlank size={18} className="fi-selectbox__seta" aria-hidden />
      </button>
      <div
        ref={pop}
        popover="auto"
        role="dialog"
        aria-label="Seletor de mês"
        className="fi-pop fi-cal"
        onKeyDown={aoTeclar}
      >
        <div className="fi-cal__topo">
          <button
            type="button"
            className="fi-cal__nav"
            aria-label="Ano anterior"
            onClick={() => setAno((a) => a - 1)}
          >
            <CaretLeft size={18} weight="bold" />
          </button>
          <span className="fi-cal__titulo" aria-live="polite">
            {ano}
          </span>
          <button
            type="button"
            className="fi-cal__nav"
            aria-label="Próximo ano"
            onClick={() => setAno((a) => a + 1)}
          >
            <CaretRight size={18} weight="bold" />
          </button>
        </div>
        <div className="fi-cal__meses" role="group" aria-label={`Meses de ${ano}`}>
          {MESES_CURTOS.map((m, i) => (
            <button
              key={m}
              type="button"
              data-mes={i}
              tabIndex={i === foco ? 0 : -1}
              aria-pressed={valido && +value.slice(0, 4) === ano && +value.slice(5, 7) - 1 === i}
              className="fi-cal__mes"
              onClick={() => escolher(i)}
            >
              {m}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

/**
 * Navegação de mês com saltos rápidos: « −1 ano · ‹ −1 mês · [título: abre o seletor de mês/ano] · › +1 mês · » +1 ano.
 * O seletor mostra os 12 meses do ano, troca de ano com setas, abre uma grade de anos e tem "Mês atual".
 */
export function NavegadorDeMes({
  value,
  onChange,
  rotulo = "Mês",
}: {
  value: string;
  onChange: (mes: string) => void;
  rotulo?: string;
}) {
  const gatilho = useRef<HTMLButtonElement>(null);
  const { ref: pop, aberto, setAberto } = usePopover(gatilho, { largura: 288 });
  const ano0 = +value.slice(0, 4),
    mes0 = +value.slice(5, 7) - 1;
  const [ano, setAno] = useState(ano0);
  const [visao, setVisao] = useState<"meses" | "anos">("meses");
  const [bloco, setBloco] = useState(0);
  const mover = (n: number) => onChange(somarMeses(`${value}-01`, n).slice(0, 7));
  const hojeMes = hojeISO().slice(0, 7);
  const titulo = tituloDoMes(ano0, mes0);
  const inicioAnos = ano - 5 + bloco * 12;

  useEffect(() => {
    if (aberto)
      pop.current
        ?.querySelector<HTMLElement>('.fi-cal__mes[aria-pressed="true"], .fi-cal__mes')
        ?.focus();
  }, [aberto, visao, bloco, pop]);
  function abrir() {
    setAno(ano0);
    setVisao("meses");
    setBloco(0);
    setAberto(true);
  }
  const escolher = (m: number) => {
    onChange(`${ano}-${String(m + 1).padStart(2, "0")}`);
    setAberto(false);
    gatilho.current?.focus();
  };
  function aoTeclar(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      if (visao === "anos") setVisao("meses");
      else {
        setAberto(false);
        gatilho.current?.focus();
      }
    }
  }

  return (
    <>
      <div className="fi-monthnav" role="group" aria-label={rotulo}>
        <button
          type="button"
          className="fi-monthnav__btn"
          aria-label="Um ano antes"
          title="Um ano antes"
          onClick={() => mover(-12)}
        >
          <CaretDoubleLeft size={18} weight="bold" />
        </button>
        <button
          type="button"
          className="fi-monthnav__btn"
          aria-label="Mês anterior"
          onClick={() => mover(-1)}
        >
          <CaretLeft size={20} weight="bold" />
        </button>
        <button
          ref={gatilho}
          type="button"
          className="fi-monthnav__titulo"
          aria-haspopup="dialog"
          aria-expanded={aberto}
          aria-label={`${titulo}. Escolher mês e ano`}
          onClick={() => (aberto ? setAberto(false) : abrir())}
        >
          {titulo}
        </button>
        <button
          type="button"
          className="fi-monthnav__btn"
          aria-label="Próximo mês"
          onClick={() => mover(1)}
        >
          <CaretRight size={20} weight="bold" />
        </button>
        <button
          type="button"
          className="fi-monthnav__btn"
          aria-label="Um ano depois"
          title="Um ano depois"
          onClick={() => mover(12)}
        >
          <CaretDoubleRight size={18} weight="bold" />
        </button>
      </div>
      <div
        ref={pop}
        popover="auto"
        role="dialog"
        aria-label="Escolher mês e ano"
        className="fi-pop fi-cal"
        onKeyDown={aoTeclar}
      >
        {visao === "meses" ? (
          <>
            <div className="fi-cal__topo">
              <button
                type="button"
                className="fi-cal__nav"
                aria-label="Ano anterior"
                onClick={() => setAno((a) => a - 1)}
              >
                <CaretLeft size={18} weight="bold" />
              </button>
              <button
                type="button"
                className="fi-cal__titulo fi-cal__titulo--botao"
                aria-label={`${ano}. Escolher o ano`}
                onClick={() => {
                  setBloco(0);
                  setVisao("anos");
                }}
              >
                {ano}
              </button>
              <button
                type="button"
                className="fi-cal__nav"
                aria-label="Próximo ano"
                onClick={() => setAno((a) => a + 1)}
              >
                <CaretRight size={18} weight="bold" />
              </button>
            </div>
            <div className="fi-cal__meses" role="group" aria-label={`Meses de ${ano}`}>
              {MESES_CURTOS.map((m, i) => (
                <button
                  key={m}
                  type="button"
                  className="fi-cal__mes"
                  aria-pressed={ano === ano0 && i === mes0}
                  aria-label={tituloDoMes(ano, i)}
                  onClick={() => escolher(i)}
                >
                  {m}
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="fi-cal__topo">
              <button
                type="button"
                className="fi-cal__nav"
                aria-label="Anos anteriores"
                onClick={() => setBloco((b) => b - 1)}
              >
                <CaretLeft size={18} weight="bold" />
              </button>
              <span className="fi-cal__titulo">
                {inicioAnos} – {inicioAnos + 11}
              </span>
              <button
                type="button"
                className="fi-cal__nav"
                aria-label="Próximos anos"
                onClick={() => setBloco((b) => b + 1)}
              >
                <CaretRight size={18} weight="bold" />
              </button>
            </div>
            <div className="fi-cal__meses" role="group" aria-label="Anos">
              {Array.from({ length: 12 }, (_, i) => inicioAnos + i).map((a) => (
                <button
                  key={a}
                  type="button"
                  className="fi-cal__mes"
                  aria-pressed={a === ano}
                  aria-label={`Ano ${a}`}
                  onClick={() => {
                    setAno(a);
                    setBloco(0);
                    setVisao("meses");
                  }}
                >
                  {a}
                </button>
              ))}
            </div>
          </>
        )}
        <div className="fi-cal__rodape">
          <button
            type="button"
            className="fi-cal__hoje"
            onClick={() => {
              onChange(hojeMes);
              setAberto(false);
              gatilho.current?.focus();
            }}
          >
            {value === hojeMes ? "Mês atual" : "Voltar para o mês atual"}
          </button>
        </div>
      </div>
    </>
  );
}
