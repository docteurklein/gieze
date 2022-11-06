import {html, render} from 'https://unpkg.com/lit-html?module';
import {unsafeHTML} from 'https://unpkg.com/lit-html/directives/unsafe-html.js?module';

let map = {
  bls: bls => bls.map(bl => html`<card class="bl">
    <h3>#${bl.bl}</h3>
    ${new Intl.DateTimeFormat().format(new Date(bl.inserted_at))}
    ${bl.client}
    ${bl.bl_line.map(line => html`<div class="bl">${line.quantity} ${line.product}</div>`)}
    <form method="POST" action="/api/bl_line" data-upsert>
      <input type="hidden" name="bl" value="${bl.bl}" />
      <input type="text" name="product" list="products_list" placeholder="product" />
      <input type="number" name="quantity" placeholder="quantity" />
      <input type="submit" />
    </form>
    <form data-method="PATCH" action="/api/bl?bl=eq.${bl.bl}">
      <input type="date" name="shipped_at" placeholder="shipped at" />
      <input type="submit" value="Mark as shipped" />
    </form>
  </card>`),
  future_invoices: invoices => invoices.map(invoice => html`<card class="invoice">
    <h3>#${invoice.client}</h3>
    ${invoice.month}
    ${invoice.lines.map(line => html`<div class="invoice">${line.quantity} ${line.product}</div>`)}
    <form method="POST" action="/rpc/invoice?client=${invoice.client}">
      <input type="submit" value="Invoice!" />
    </form>
  </card>`),
  todo: values => values.map(value => html`<div>
    ${value.quantity}
    ${value.product}
  </div>`),
  _: values => values.map(value => html`<div>${JSON.stringify(value)}</div>`),
};

function interpolate(template, params) {
  const keys = Object.keys(params);
  const keyVals = Object.values(params);
  return new Function(...keys, `return html\`${template}\``)(...keyVals);
}

function setup(root) {
  root.querySelectorAll('[data-fetch][data-template]').forEach(async e => {
    let data = await (await fetch(e.getAttribute('data-fetch'))).json();
    let template = document.querySelector(e.getAttribute('data-template'));
    let doc = new DOMParser().parseFromString(template.innerHTML, "text/html");
    render((data => interpolate(doc.documentElement.textContent, {data: data, html: html}))(data), e);
    setup(e);
  });
  root.querySelectorAll('[data-fetch][data-map]').forEach(async e => {
    let values = await (await fetch(e.getAttribute('data-fetch'))).json();
    render(map[e.getAttribute('data-map')](values), e);
    setup(e);
  });
  root.querySelectorAll('datalist[data-fetch][data-key]').forEach(async e => {
    let values = await (await fetch(e.getAttribute('data-fetch'))).json();
    values.forEach(value => {
      let option = document.createElement('option');
      option.value = value[e.getAttribute('data-key')];
      e.appendChild(option);
    });
  });
  root.addEventListener('submit', async event => {
    event.preventDefault();
    const data = new FormData(event.target);
    const values = Object.fromEntries(data.entries());
    let res = await fetch(event.target.action, {method: event.target.getAttribute('data-method') || event.target.method, headers: {
      'Content-Type': 'application/json',
      'Prefer': event.target.hasAttribute('data-upsert') ? 'resolution=merge-duplicates' : ''
    }, body: JSON.stringify(values)});
    res.ok && window.location.reload();
    let body = await res.json();
    res.ok || event.target.append(body.message);
  });
}

setup(document);
