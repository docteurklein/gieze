begin;

create schema gieze;
grant usage on schema gieze to anonymous;

grant anonymous to app;

create extension pg_trgm with schema gieze;

set local search_path to gieze;

create table client (
  client text not null primary key
);

grant all on table client to anonymous;

create index client_trgm
on client
using gin (client gin_trgm_ops);

create table product (
  product text not null primary key
);

grant all on table product to anonymous;

create table bl (
  bl bigint not null primary key,
  client text not null references client (client),
  inserted_at timestamptz not null default now(),
  shipped_at timestamptz
);

grant all on table bl to anonymous;

create table bl_line (
  bl bigint not null references bl (bl),
  product text not null references product (product),
  quantity bigint not null check (quantity > 0),
  primary key (bl, product)
);

grant all on table bl_line to anonymous;

create view future_invoice(client, month, lines) as
with agg_line(client, quantity, product, month) as (
  select client, sum(quantity), product, date_trunc('month', shipped_at) from bl_line join bl using (bl) where shipped_at is not null group by client, product, 4
)
select client, to_char(to_date(date_part('month', shipped_at)::text, 'MM'), 'Month'), array_agg(row_to_json(agg_line))
from client
join bl using (client)
join agg_line using (client)
where shipped_at is not null
and agg_line.month = date_trunc('month', shipped_at)
group by 1, 2, date_trunc('month', shipped_at)
order by date_trunc('month', shipped_at) asc;

grant select on future_invoice to anonymous;

create table invoice (
  invoice bigint not null primary key,
  client text not null
);

grant all on table invoice to anonymous;

create table invoice_line (
  invoice bigint not null references invoice (invoice),
  product text not null,
  quantity bigint not null check (quantity > 0),
  primary key (invoice, product)
);

grant all on table invoice_line to anonymous;

create view todo(quantity, product) as
select sum(quantity), product
from bl_line
join bl using (bl)
where bl.shipped_at is null
group by product;

grant select on todo to anonymous;

-- create or replace function he(html text) returns text
-- language sql strict immutable
-- as $$
--     select replace(replace(replace(replace(replace(html, '&', '&amp;'), '''', '&#39;'), '"', '&quot;'), '>', '&gt;'), '<', '&lt;')
-- $$;
-- 
-- create or replace function "index.html"() returns text
-- language sql strict stable
-- set search_path to gieze
-- as $$
-- with bl_trs as (select string_agg(format('<tr><td>%s</td><td>%s</td><td>%s</td></tr>', he(bl.bl::text), he(bl.client), ''), '') bls from bl left join bl_line using (bl) group by bl, client),
-- todo_trs as (select string_agg(format('<tr><td>%s</td><td>%s</td></tr>', he(quantity::text), he(product)), '') todo_trs from todo),
-- next_bl(next_bl) as (select max(bl) + 1 from bl),
-- future_invoices as (select string_agg(format('<tr><td>%s</td><td>%s</td><td><a href="/rpc/invoice.html?invoice=%s">Générer</a></td></tr>', he(invoice.client), he(invoice.products), invoice.client), '') future_invoices from future_invoice invoice),
-- invoice_trs as (select string_agg(format('<tr><td>%s</td><td>%s</td><td><a href="/rpc/invoice.html?invoice=%s</td></tr>', he(invoice.invoice::text), he(invoice.client), invoice.invoice::text), '') invoices from invoice),
-- client_options as (select string_agg(format('<option>%s</option>', he(client)), '') clients from client),
-- product_options as (select string_agg(format('<option>%s</option>', he(product)), '') products from product)
-- select format($html$
-- <html>
--   <head>
--     <link rel="stylesheet" href="https://unpkg.com/boltcss/bolt.css">
--     <script async src="https://unpkg.com/htmx.org@1.8.2/dist/htmx.js"></script>
--     <script async src="https://unpkg.com/htmx.org/dist/ext/client-side-templates.js"></script>
--     <script async src="https://unpkg.com/mustache@latest"></script>
--     <meta charset="utf-8">
--   </head>
--   <body hx-ext="client-side-templates">
--     <h1>La Gièze</h1>
--     <h2>Bons de livraison</h2>
--     <form method="POST" action="/bl" hx-post="/bl" hx-target="#bl-result">
--       <input type="number" name="bl" value="%s" />
--       <datalist id="clients">
-- 	%s
--       </datalist>
--       <input type="text" name="client" list="clients" />
--       <datalist id="products">
-- 	%s
--       </datalist>
--       <input type="submit" />
--     </form>
--     <div id="bl-result"></div>
-- 
--     <template id="foo">
--       <p> and  and </> htmx - high power tools for html and </p>
--     </template>
--     <table>
--      %s
--     </table> 
--     <h2>TODO</h2>
--     <table>
--      %s
--     </table> 
--     <h2>Future factures</h2>
--     <table>
--      %s
--     </table> 
--     <h2>Factures</h2>
--     <table>
--      %s
--     </table> 
--   </body>
-- </html>
-- $html$, next_bl, clients, products, bls, todo_trs, future_invoices, invoices) from next_bl, client_options, product_options, bl_trs, todo_trs, future_invoices, invoice_trs;
-- $$;

commit;
