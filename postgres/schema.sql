
do $$ begin
create role admin;
exception when duplicate_object then raise notice '%, skipping', sqlerrm using errcode = sqlstate;
end $$;

begin;

create schema gieze;
create schema money;
grant usage on schema gieze to admin;
grant usage on schema money to admin;

grant admin to app;

create extension pg_trgm with schema gieze;

set local search_path to gieze;

create type money._amount as (
  amount numeric(6, 3),
  currency text
);

create domain money.amount as money._amount
constraint valid check (
      (value).amount is not null
  and (value).currency is not null
);

create function money.sum_amount(a money.amount, b money.amount) returns money.amount
language sql
immutable
parallel safe
as $$
select (
  (a).amount + (b).amount,
  (b).currency
)::money.amount
$$;

create aggregate money.sum(money.amount)
(
  sfunc = money.sum_amount,
  stype = money.amount,
  initcond = '(0, null)'
);

create function money.multiply(a money.amount, rate numeric) returns money.amount
language sql
immutable
parallel safe
as $$
select (
  (a).amount * rate,
  (a).currency
)::money.amount
$$;

create operator * (
  leftarg = money.amount,
  rightarg = numeric,
  function = money.multiply
);

create function money.substract(a money.amount, b money.amount) returns money.amount
language sql
immutable
parallel safe
as $$
select (
  (a).amount - (b).amount,
  (a).currency
)::money.amount
$$;

create operator - (
  leftarg = money.amount,
  rightarg = money.amount,
  function = money.substract
);

create function money.add(a money.amount, b money.amount) returns money.amount
language sql
immutable
parallel safe
as $$
select (
  (a).amount + (b).amount,
  (a).currency
)::money.amount
$$;

create operator + (
  leftarg = money.amount,
  rightarg = money.amount,
  function = money.add
);

create table client (
  client text not null primary key,
  billing_address text not null,
  shipping_address text default null
);

grant all on table client to admin;

create index client_trgm
on client
using gin (client gin_trgm_ops);

create table product (
  product text not null primary key,
  unit_price_ht money.amount not null,
  tva_rate numeric(5, 5) not null
);

grant all on table product to admin;

create table bl (
  bl bigint not null primary key,
  client text not null references client (client),
  inserted_at timestamptz not null default now(),
  shipped_at date,
  invoiced boolean default false
);

grant all on table bl to admin;

create table bl_line (
  bl bigint not null references bl (bl),
  product text not null references product (product),
  quantity bigint not null check (quantity > 0),
  primary key (bl, product)
);

grant all on table bl_line to admin;

create table invoice (
  invoice bigint not null primary key,
  client text not null,
  address text not null,
  client_address text not null,
  invoiced_at timestamptz not null,
  deadline_at timestamptz not null,
  total_ht money.amount not null,
  total_tva money.amount not null,
  total_ttc money.amount not null,
  month date,
  bank_info text not null,
  legal_infos text not null,
  footer text default null,
  unique (client, month)
);

grant all on table invoice to admin;


create table invoice_line (
  invoice bigint not null references invoice (invoice),
  product text not null,
  quantity bigint not null check (quantity > 0),
  unit_price_ht money.amount not null,
  total_price_ht money.amount not null,
  tva_rate numeric(5, 5) not null,
  total_tva money.amount not null,
  total_price_ttc money.amount not null
);

grant all on table invoice_line to admin;

create view future_invoice_line(client, month, product, quantity, unit_price_ht, total_price_ht, tva_rate, total_tva, total_price_ttc) as
select
  client,
  date_trunc('month', shipped_at)::date,
  product,
  quantity,
  unit_price_ht,
  unit_price_ht * quantity,
  tva_rate,
  (unit_price_ht * quantity) * tva_rate,
  (unit_price_ht * quantity) * (1 + tva_rate)
from bl_line
join bl using (bl)
join product using (product)
where shipped_at is not null;

grant select on future_invoice_line to admin;

create view future_invoice(client, month, total_ht, total_tva, total_ttc) as
select client, date_trunc('month', shipped_at)::date, money.sum(total_price_ht), money.sum(total_tva), money.sum(total_price_ttc)
from client
join bl using (client)
join future_invoice_line using (client)
where shipped_at is not null
and not bl.invoiced
and future_invoice_line.month = date_trunc('month', shipped_at)::date
group by 1, 2
order by 2 asc, 1 asc;

grant select on future_invoice to admin;

create view todo(quantity, product, client) as
select sum(quantity), product, client
from bl_line
join bl using (bl)
where bl.shipped_at is null
group by product, client;

grant select on todo to admin;

create or replace function invoice(client_ text, month_ date) -- should be proc, but postgrest meh
returns void as $$
  set transaction isolation level serializable;
  with fil as (
    select fi.client, fi.month, fi.total_ht, fi.total_tva, fi.total_ttc, fil.product, fil.quantity
    from gieze.future_invoice fi
    join gieze.future_invoice_line fil using (client, month)
    where fi.client = client_
    and fi.month = month_
  ),
  new_invoice as (
    insert into gieze.invoice(invoice, client, month, invoiced_at, deadline_at, total_ht, total_tva, total_ttc, bank_info, legal_infos) select
      (select coalesce(max(invoice) + 1, 1) from gieze.invoice),
      (select client from gieze.client where client = client_), -- not a FK so check manually
      month_,
      now(),
      now() + interval '1 month',
      fil.total_ht,
      fil.total_tva,
      fil.total_ttc,
      'bank info',
      'legal infos'
    from fil
    returning client, month, invoice
  )
  insert into gieze.invoice_line(invoice, product, quantity)
  select ni.invoice, fil.product, fil.quantity
  from new_invoice ni
  join fil using (client, month);

  update bl set invoiced = true
  where date_trunc('month', shipped_at)::date = month_
  and client = client_
  and shipped_at is not null;
$$ language sql;

grant execute on function invoice to admin;

create or replace function he(html text) returns text
language sql strict immutable
as $$
    select replace(replace(replace(replace(replace(html, '&', '&amp;'), '''', '&#39;'), '"', '&quot;'), '>', '&gt;'), '<', '&lt;')
$$;

commit;
