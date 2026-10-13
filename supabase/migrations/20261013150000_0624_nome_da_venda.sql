-- manifest: **Nome da venda.** `crm_sales.name` (texto curto, até 120 caracteres, vazio por padrão): o nome que a pessoa dá à venda. Quando vazio, a tela continua mostrando os produtos juntados (`product_name`), então nada muda para as vendas que já existem; `product_name` segue sendo a lista de produtos da venda, montada pelo gatilho dos itens.

alter table public.crm_sales
  add column if not exists name text not null default '';

alter table public.crm_sales
  drop constraint if exists crm_sales_name_len;
alter table public.crm_sales
  add constraint crm_sales_name_len check (char_length(name) <= 120);
