import * as squirelly from "https://esm.sh/squirrelly";

let baseUrl = 'https://gxusbjyqxzhewnzyecur.supabase.co/rest/v1';
let apikey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4dXNianlxeHpoZXduenllY3VyIiwicm9sZSI6ImFub24iLCJpYXQiOjE2Njc0MjAyNzYsImV4cCI6MTk4Mjk5NjI3Nn0.55SXH7OoAt-7wpyIjJkj6OjqPcU4B3aCFYEoev76Ym8';

const querystring = new URLSearchParams(window.location.search);

squirelly.filters.define('date', str => new Date(str).toLocaleDateString());
squirelly.filters.define('querystring', name => querystring.get(name));

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
  root.querySelectorAll('[data-fetch][data-template]').forEach(async e => {
    let value = await fetchjson(squirelly.render(e.getAttribute('data-fetch')));
    const template = e.innerHTML;
    const rendered = squirelly.render(template, value);
    var dom = document.createElement("div");
    dom.innerHTML = rendered;
    e.replaceWith(dom);
    setup(e);
  });
  root.querySelectorAll('template[data-fetch][data-iframe]').forEach(async e => {
    let value = await fetchjson(squirelly.render(e.getAttribute('data-fetch')));
    const template = e.content;
    const rendered = squirelly.render(template.innerHTML, value);
    var dom = document.createElement("iframe");
    dom.srcdoc = rendered;
    e.replaceWith(dom);
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
