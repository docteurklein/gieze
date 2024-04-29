import {html, when, render} from 'https://cdn.jsdelivr.net/gh/lit/dist@3/all/lit-all.min.js';
import * as squirelly from "https://esm.sh/squirrelly";

let baseUrl = 'https://gxusbjyqxzhewnzyecur.supabase.co/rest/v1';
let apikey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4dXNianlxeHpoZXduenllY3VyIiwicm9sZSI6ImFub24iLCJpYXQiOjE2Njc0MjAyNzYsImV4cCI6MTk4Mjk5NjI3Nn0.55SXH7OoAt-7wpyIjJkj6OjqPcU4B3aCFYEoev76Ym8';

function to_html(invoice) {
  return html``;
}

let map = {

    bls: (bls) => bls.map(bl => html`
    <card class="bl">
      <h3>#${bl.bl}</h3>
      ${new Date(bl.inserted_at).toLocaleDateString()}
      ${bl.client}
      ${bl.bl_line.map(line => html`<div class="line"> ${line.product} x${line.quantity}</div>`)}
      ${when(bl.shipped_at,
        () => html`Livré le ${new Date(bl.shipped_at).toLocaleDateString()}`,
        () => html`
          <form data-fetch method="POST" action="/bl_line" data-upsert>
            <fieldset class="grid">
              <input type="hidden" name="bl" value="${bl.bl}" />
              <input type="number" name="quantity" placeholder="quantité" />
              <input type="text" name="product" list="products_list" placeholder="produit" />
              <input type="submit" value="Ajouter" />
            </fieldset>
          </form>
          <form data-fetch data-method="PATCH" action="/bl?bl=eq.${bl.bl}">
            <fieldset class="grid">
              <input type="date" name="shipped_at" placeholder="Livré le" value=${bl.shipped_at} />
              <input type="submit" value="Livrer" />
            </fieldset>
          </form>
        `
      )}
    </card>
  `),

  future_invoices: invoices => invoices.map(invoice => html`
  `),

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

squirelly.filters.define("date", str => new Date(str).toLocaleDateString());

function setup(root) {
  root.querySelectorAll('[data-fetch][data-map]').forEach(async e => {
    let value = await fetchjson(e.getAttribute('data-fetch'));
    render(map[e.getAttribute('data-map')](value, e), e);
    setup(e);
  });
  root.querySelectorAll('[data-fetch][data-template]').forEach(async e => {
    let value = await fetchjson(e.getAttribute('data-fetch'));
    const template = e.innerHTML;
    const rendered = squirelly.render(template, value);
    var dom = document.createElement("div");
    dom.innerHTML = rendered;
    e.replaceWith(dom);
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

if ('auth' in window) {
  window.auth.addEventListener('submit', (event) => {
    const data = new FormData(event.target);
    localStorage.setItem('auth', data.get('password'));
    event.preventDefault();
    window.location.reload();
  });
}

setup(document);
