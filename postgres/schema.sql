
do $$ begin
create role admin;
exception when duplicate_object then raise notice '%, skipping', sqlerrm using errcode = sqlstate;
end $$;

begin;

drop schema if exists gieze cascade;
drop schema if exists money cascade;
create schema gieze;
create schema money;
grant usage on schema gieze to admin;
grant usage on schema money to admin;

grant admin to app;

create extension pg_trgm with schema gieze;

set local search_path to gieze;

create type money._amount as (
  amount numeric(6, 2),
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
  client text not null references client (client) on delete cascade,
  inserted_at timestamptz not null default now(),
  shipped_at date,
  invoiced boolean default false
);

grant all on table bl to admin;

create table bl_line (
  bl bigint not null references bl (bl) on delete cascade,
  product text not null references product (product) on delete cascade,
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
  invoice bigint not null references invoice (invoice) on delete cascade,
  bl text not null,
  product text not null,
  quantity bigint not null check (quantity > 0),
  shipped_at date not null,
  unit_price_ht money.amount not null,
  total_price_ht money.amount not null,
  tva_rate numeric(5, 5) not null,
  total_tva money.amount not null,
  total_price_ttc money.amount not null,
  primary key (invoice, bl, product)
);

grant all on table invoice_line to admin;

create view future_invoice_line(client, month, bl, shipped_at, product, quantity, unit_price_ht, total_price_ht, tva_rate, total_tva, total_price_ttc) as
select
  client,
  date_trunc('month', shipped_at)::date,
  bl.bl,
  shipped_at,
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
where bl.shipped_at is not null
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

create view invoice_line_detail(invoice, bl, shipped_at, details) as
select invoice, bl, shipped_at, jsonb_agg(il)
from invoice_line il
group by 1, 2, 3;

grant select on invoice_line_detail to admin;

create or replace function invoice(client_ text, month_ date) -- should be proc, but postgrest meh
returns void as $$
  -- set transaction isolation level serializable;
 with new_invoice as (
    insert into gieze.invoice(invoice, client, address, client_address, month, invoiced_at, deadline_at, total_ht, total_tva, total_ttc, bank_info, legal_infos) 
    select
      (select coalesce(max(invoice) + 1, 1) from gieze.invoice),
      (select client from gieze.client where client = fi.client), -- not a FK so check manually
      (select billing_address from gieze.client where client = fi.client), -- not a FK so check manually
      (select shipping_address from gieze.client where client = fi.client), -- not a FK so check manually
      fi.month,
      now(),
      now() + interval '1 month',
      fi.total_ht,
      fi.total_tva,
      fi.total_ttc,
      'bank info',
      'legal infos'
    from gieze.future_invoice fi
    where fi.client = client_
    and fi.month = month_
    returning client, month, invoice
  )
  insert into gieze.invoice_line(invoice, bl, shipped_at, product, quantity, unit_price_ht, total_price_ht, tva_rate, total_tva, total_price_ttc)
  select ni.invoice, fil.bl, fil.shipped_at, fil.product, fil.quantity,  unit_price_ht, total_price_ht, tva_rate, total_tva, total_price_ttc
  from new_invoice ni
  join gieze.future_invoice_line fil using (client, month);
  
  update bl set invoiced = true
  where date_trunc('month', shipped_at)::date = month_
  and client = client_
  and shipped_at is not null;
$$ language sql;

grant execute on function invoice to admin;

commit;
