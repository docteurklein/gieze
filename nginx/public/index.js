import {html, render} from '/vendor/lit-html.js';

let map = {
  bls: bls => bls.map(bl => html`<card class="bl">
    <h3>#${bl.bl}</h3>
    ${new Intl.DateTimeFormat().format(new Date(bl.inserted_at))}
    ${bl.client}
    ${bl.bl_line.map(line => html`<div class="line">${line.quantity} ${line.product}</div>`)}
    <form data-fetch method="POST" action="https://gxusbjyqxzhewnzyecur.supabase.co//bl_line" data-upsert>
      <input type="hidden" name="bl" value="${bl.bl}" />
      <input type="text" name="product" list="products_list" placeholder="product" />
      <input type="number" name="quantity" placeholder="quantity" />
      <input type="submit" />
    </form>
    <form data-fetch data-method="PATCH" action="https://gxusbjyqxzhewnzyecur.supabase.co//bl?bl=eq.${bl.bl}">
      <input type="date" name="shipped_at" placeholder="shipped at" value=${bl.shipped_at} />
      <input type="submit" value="Mark as shipped" />
    </form>
  </card>`),
  future_invoices: invoices => invoices.map(invoice => html`<card class="invoice">
    <h3>#${invoice.client}</h3>
    ${invoice.month}
    ${invoice.lines.map(line => html`<div class="line">${line.quantity} ${line.product}</div>`)}
    <form data-fetch method="POST" action="https://gxusbjyqxzhewnzyecur.supabase.co//rpc/invoice">
      <input type="hidden" name="client_" value="${invoice.client}"/>
      <input type="hidden" name="month_" value="${invoice.month}"/>
      <input type="submit" value="Invoice!" />
    </form>
  </card>`),
  invoices: invoices => invoices.map(invoice => html`<card class="invoice">
    <h3>#${invoice.invoice}</h3>
    for month ${invoice.month}
    ${invoice.invoiced_at}
    ${invoice.invoice_line.map(line => html`<div class="line">${line.quantity} ${line.product}</div>`)}
    <iframe srcdoc="${(template_as_string(html`<!DOCTYPE html>
      <html>
	<head>
	<meta charset="utf-8">
	<link rel="stylesheet" href="https://unpkg.com/boltcss/bolt.css">
	<link rel="stylesheet" href="/index.css">
	</head>
	<body>
	<img src="http://0.0.0.0:8080/images/logo-gieze.png"/>
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
    return clients.map(client => html`<li>
      ${client.client}
      ${client.billing_address}
      ${client.shipping_address}
    </li>`);
  },
  'admin-products': values => {
    if (values.length == 0) return html`No product yet`;
    return values.map(value => html`<li>
      ${value.product}
    </li>`);
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

function setup(root) {
  root.querySelectorAll('[data-fetch][data-map]').forEach(async e => {
    let values = await (await fetch(e.getAttribute('data-fetch'), {headers: {authorization: `bearer ${localStorage.getItem('auth')}`}})).json();
    render(map[e.getAttribute('data-map')](values), e);
    setup(e);
  });
  root.querySelectorAll('datalist[data-fetch][data-key]').forEach(async e => {
    let values = await (await fetch(e.getAttribute('data-fetch'), {headers: {authorization: `bearer ${localStorage.getItem('auth')}`}})).json();
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
    let res = await fetch(event.target.action, {method: event.target.getAttribute('data-method') || event.target.method, headers: {
      'Content-Type': 'application/json',
      'Prefer': event.target.hasAttribute('data-upsert') ? 'resolution=merge-duplicates' : '',
      authorization: `bearer ${localStorage.getItem('auth')}`,
    }, body: JSON.stringify(values)});
    res.ok && window.location.reload();
    res.json().then(body => event.target.append(body.details || body.message || ''));
  });
}

if ('auth' in window) {
  auth.addEventListener('change', (event) => {
    localStorage.setItem('auth', event.target.value);
  });
}

setup(document);
