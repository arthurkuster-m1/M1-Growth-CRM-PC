-- manifest: Blocos editáveis por compromisso (calendar_appointments.blocos): nulo = vale o modelo de blocos do tipo; preenchido = o que foi adaptado só naquele compromisso.
alter table public.calendar_appointments
  add column if not exists blocos jsonb;

comment on column public.calendar_appointments.blocos is
  'Blocos do editor da página do compromisso (mesmo formato dos blocos de Marketing). Nulo = ainda não adaptado: a página mostra o modelo do tipo. Validado por blocosSchema na rota.';
