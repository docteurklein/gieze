import * as squirelly from "https://esm.sh/squirrelly";

let baseUrl = 'https://gxusbjyqxzhewnzyecur.supabase.co/rest/v1';
let apikey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4dXNianlxeHpoZXduenllY3VyIiwicm9sZSI6ImFub24iLCJpYXQiOjE2Njc0MjAyNzYsImV4cCI6MTk4Mjk5NjI3Nn0.55SXH7OoAt-7wpyIjJkj6OjqPcU4B3aCFYEoev76Ym8';

const querystring = new URLSearchParams(window.location.search);

squirelly.filters.define('date', str => new Date(str).toLocaleDateString());
squirelly.filters.define('querystring', name => querystring.get(name));

async function postgrest(url, config) {
  return await fetch(baseUrl + url, {
    method: config.method,
    headers: {
      authorization: `Bearer ${localStorage.getItem('auth')}`,
      apikey: apikey,
      'Accept-Profile': 'gieze',
      'Content-Profile': 'gieze',
      ...config.headers,
    },
    body: ['post', 'put', 'patch'].includes(config.method.toLowerCase()) ? config.body : null
  });
}

function setup(root) {
  root.querySelectorAll('script[type="x-template"][id]').forEach(e => {
    const compiled =  squirelly.compile(e.innerHTML);
    squirelly.templates.define(e.id, compiled);
  });

  root.querySelectorAll(':not(form)[data-template]').forEach(async e => {
    let value = {};
    if (e.hasAttribute('data-fetch')) {
      let method = e.getAttribute('data-method') || 'GET';
      value = await (await postgrest(squirelly.render(e.getAttribute('data-fetch')), {
        method, 
      })).json();
    }
    render(e, value);
  });
}

function render(e, value) {
  const rendered = squirelly.templates.get(e.getAttribute('data-template'))(value, squirelly.defaultConfig);
  // e.insertAdjacentHTML('afterend', rendered);
  e.innerHTML = rendered;
  setup(e);
}

document.addEventListener('submit', async event => {
  if (!event.target.hasAttribute('data-intercept')) {
    return;
  }
  event.preventDefault();
  const data = new FormData(event.target);
  const values = Object.fromEntries(data.entries());
  let method = event.target.getAttribute('data-method') || event.target.method;

  let response = await postgrest(event.target.getAttribute('action'), {
    method: method,
    headers: {
      'Content-Type': 'application/json',
      'Prefer': event.target.hasAttribute('data-upsert') ? 'resolution=merge-duplicates' : '',
    },
    body: JSON.stringify(values),
  });

  if (response.ok && event.target.getAttribute('data-success') === 'redirect') {
    window.location.reload();
    return;
  }
  let res = await response.clone().json() .catch(_ => response.text());
  render(event.target, {
    response,
    res,
    values,
  });
});

if ('auth' in window) {
  window.auth.addEventListener('submit', (event) => {
    const data = new FormData(event.target);
    localStorage.setItem('auth', data.get('password'));
    event.preventDefault();
    window.location.reload();
  });
}

setup(document);
