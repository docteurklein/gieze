import {html, render} from '/vendor/lit-html.js';

let baseUrl = 'https://gxusbjyqxzhewnzyecur.supabase.co/rest/v1';
let apikey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4dXNianlxeHpoZXduenllY3VyIiwicm9sZSI6ImFub24iLCJpYXQiOjE2Njc0MjAyNzYsImV4cCI6MTk4Mjk5NjI3Nn0.55SXH7OoAt-7wpyIjJkj6OjqPcU4B3aCFYEoev76Ym8';

let map = {
  bls: bls => bls.map(bl => html`<card class="bl">
    <h3>#${bl.bl}</h3>
    ${new Intl.DateTimeFormat().format(new Date(bl.inserted_at))}
    ${bl.client}
    ${bl.bl_line.map(line => html`<div class="line">${line.quantity} ${line.product}</div>`)}
    <form data-fetch method="POST" action="/bl_line" data-upsert>
      <input type="hidden" name="bl" value="${bl.bl}" />
      <input type="text" name="product" list="products_list" placeholder="product" />
      <input type="number" name="quantity" placeholder="quantity" />
      <input type="submit" value="Ajouter" />
    </form>
    <form data-fetch data-method="PATCH" action="/bl?bl=eq.${bl.bl}">
      <input type="date" name="shipped_at" placeholder="shipped at" value=${bl.shipped_at} />
      <input type="submit" value="Livrer" />
    </form>
  </card>`),
  future_invoices: invoices => invoices.map(invoice => html`<card class="invoice">
    <h3>#${invoice.client}</h3>
    ${invoice.month}
    ${invoice.future_invoice_line.map(line => html`<div class="line">${line.quantity} ${line.product}</div>`)}
    <form data-fetch method="POST" action="/rpc/invoice">
      <input type="hidden" name="client_" value="${invoice.client}"/>
      <input type="hidden" name="month_" value="${invoice.month}"/>
      <input type="submit" value="Facturer" />
    </form>
  </card>`),
  invoices: invoices => invoices.map(invoice => html`<card class="invoice">
    <h3>#${invoice.invoice}</h3>
    for month ${invoice.month}<br/>
    <p>
      ${invoice.invoice_line.map(line => html`<div class="line">${line.quantity} ${line.product}</div>`)}
    </p>
    <iframe srcdoc="${(template_as_string(html`<!DOCTYPE html>
      <html>
      	<head>
        	<meta charset="utf-8">
        	<link rel="stylesheet" href="https://unpkg.com/boltcss/bolt.css">
        	<link rel="stylesheet" href="/index.css">
      	</head>
      	<body>
        	<img src="/images/logo-gieze.png"/>
          <h1>${invoice.client} #${invoice.invoice}</h1>
        	${invoice.invoice_line.map(line => html`<div class="line">${line.quantity} ${line.product}</div>`)}
      	</body>
      </html>
    `, invoice))}"></iframe>
  </card>`),
  todo: values => {
    if (values.length == 0) return html`All done :)`;
    return values.map(value => html`<li>
      ${value.quantity}
      ${value.product}
      ${value.client}
    </li>`);
  },
  'admin-clients': clients => {
    if (clients.length == 0) return html`No client yet`;
    return clients.map(client => html`
      <form data-fetch method="POST" action="/client" data-upsert>
        <input type="text" name="client" list="clients_list" placeholder="client" value="${client.client}" />
        <input type="text" name="billing_address" placeholder="Addresse de facturation" value="${client.billing_address}" />
        <input type="text" name="shipping_address" placeholder="Addresse de livraison" value="${client.shipping_address}" />
        <input type="submit" value="Editer" />
      </form>
      <form data-fetch data-method="DELETE" action="/client?client=eq.${client.client}">
        <input type="submit" value="Effacer!" onclick="return confirm('Effacer?')" />
      </form>
    `);
  },
  'admin-products': values => {
    if (values.length == 0) return html`No product yet`;
    return values.map(value => html`
      <form data-fetch method="POST" action="/product" data-upsert>
        <input type="text" name="product" list="products_list" placeholder="product" value="${value.product}" />
        <input type="text" name="unit_price_ht" placeholder="prix unitaire HT" value="(${`${value.unit_price_ht.amount}, '${value.unit_price_ht.currency}')`}" />
        <input type="text" name="tva_rate" placeholder="Taux TVA" value="${value.tva_rate}" />
        <input type="submit" value="Editer" />
      </form>
      <form data-fetch data-method="DELETE" action="/product?product=eq.${value.product}">
        <input type="submit" value="Effacer!" onclick="return confirm('Effacer?')" />
      </form>
    `);
  },
  _: values => values.map(value => html`<div>${JSON.stringify(value)}</div>`),
};

function template_as_string(data) {
    const {strings, values} = data;
    const value_list = [...values, ''];  // + last empty part
    let output = '';
    for (let i = 0; i < strings.length; i++) {
        let v = value_list[i];
        if (v._$litType$ !== undefined) {
            v = template_as_string(v);  // embedded Template
        } else if (v instanceof Array) {
            // array of strings or templates.
            let new_v = '';
            for (const inner_v of [...v]) {
                new_v += template_as_string(inner_v);
            }
            v = new_v;
        }
        output += strings[i] + v;
    }
    return output;
}

function interpolate(template, params) {
  const keys = Object.keys(params);
  const keyVals = Object.values(params);
  return new Function(...keys, `return html\`${template}\``)(...keyVals);
}

async function fetchjson(url) {
  return (await fetch(baseUrl + url, {
    headers: {
      authorization: `Bearer ${localStorage.getItem('auth')}`,
      apikey: apikey,
      'Accept-Profile': 'gieze',
      'Content-Profile': 'gieze',
    }
  })).json();
}

function setup(root) {
  if ('auth' in window) {
    auth.addEventListener('change', (event) => {
      localStorage.setItem('auth', event.target.value);
    });
  }
  root.querySelectorAll('[data-fetch][data-map]').forEach(async e => {
    let values = await fetchjson(e.getAttribute('data-fetch'));
    render(map[e.getAttribute('data-map')](values), e);
    setup(e);
  });
  root.querySelectorAll('datalist[data-fetch][data-key]').forEach(async e => {
    let values = await fetchjson(e.getAttribute('data-fetch'));
    values.forEach(value => {
      let option = document.createElement('option');
      option.value = value[e.getAttribute('data-key')];
      e.appendChild(option);
    });
  });
  root.addEventListener('submit', async event => {
    if (!event.target.hasAttribute('data-fetch')) {
      return;
    }
    event.preventDefault();
    const data = new FormData(event.target);
    const values = Object.fromEntries(data.entries());
    let method = event.target.getAttribute('data-method') || event.target.method;
    let res = await fetch(baseUrl + event.target.getAttribute('action'), {
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Prefer': event.target.hasAttribute('data-upsert') ? 'resolution=merge-duplicates' : '',
        authorization: `bearer ${localStorage.getItem('auth')}`,
        apikey: apikey,
        'Accept-Profile': 'gieze',
        'Content-Profile': 'gieze',
      },
      body: ['post', 'put', 'patch'].includes(method.toLowerCase()) ? JSON.stringify(values) : null
    });
    res.ok && window.location.reload();
    res.json().then(body => event.target.append(body.details || body.message || ''));
  });
}

setup(document);
