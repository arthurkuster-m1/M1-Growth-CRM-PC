-- manifest: **Primeira compra no lead.** `contacts.first_purchase_on` (data) — campo padrão do lead; hoje preenchido à mão, e será derivado do banco de Vendas (a menor data de venda paga) quando ele existir.

alter table public.contacts
  add column if not exists first_purchase_on date;

comment on column public.contacts.first_purchase_on is
  'Data da primeira compra do lead. Campo padrão do CRM; a sessão de Vendas passa a derivá-la da menor data de venda paga.';

notify pgrst, 'reload schema';
