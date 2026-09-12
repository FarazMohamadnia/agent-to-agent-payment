(() => {
  const state = {
    token: localStorage.getItem('ap_token') || '',
    user: JSON.parse(localStorage.getItem('ap_user') || 'null'),
    clientLogs: [],
  };

  const titles = {
    auth: ['Auth', 'Sign in with seed accounts or register a new user.'],
    catalog: ['Public catalog', 'No auth required — safe fields only.'],
    provider: ['Provider', 'Create and manage listings (PROVIDER role).'],
    buyer: ['Buyer', 'Create order → mock pay → verify → check status.'],
    admin: ['Admin', 'List orders and mark payouts manually.'],
    logs: ['Logs & errors', 'Server activity, client errors, and webhook delivery logs.'],
  };

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  function toast(msg, isError = false) {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.toggle('error', isError);
    el.classList.remove('hidden');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.add('hidden'), 3200);
  }

  function clientLog(level, message, details) {
    const entry = {
      at: new Date().toISOString(),
      level,
      message,
      details,
    };
    state.clientLogs.unshift(entry);
    if (state.clientLogs.length > 200) state.clientLogs.length = 200;
    renderClientLog();
  }

  function renderClientLog() {
    const box = $('#clientLog');
    if (!box) return;
    box.innerHTML = state.clientLogs
      .map(
        (e) => `<div class="log-line ${e.level}"><span class="ts">${e.at}</span>
        [${e.level}] ${escapeHtml(e.message)}
        ${e.details ? `\n${escapeHtml(JSON.stringify(e.details, null, 2))}` : ''}</div>`,
      )
      .join('');
  }

  function escapeHtml(s) {
    return String(s)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;');
  }

  function saveSession() {
    if (state.token) localStorage.setItem('ap_token', state.token);
    else localStorage.removeItem('ap_token');
    if (state.user) localStorage.setItem('ap_user', JSON.stringify(state.user));
    else localStorage.removeItem('ap_user');
    renderSession();
  }

  function renderSession() {
    const box = $('#sessionBox');
    if (!state.user || !state.token) {
      box.innerHTML = '<div class="muted">Not signed in</div>';
      return;
    }
    box.innerHTML = `
      <div><strong>${escapeHtml(state.user.email)}</strong></div>
      <div class="muted">Role: ${escapeHtml(state.user.role)}</div>
      <div class="muted" style="word-break:break-all">id: ${escapeHtml(state.user.id)}</div>
    `;
  }

  async function api(method, path, body, opts = {}) {
    const headers = { Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (state.token && !opts.noAuth) headers.Authorization = `Bearer ${state.token}`;

    clientLog('info', `→ ${method} ${path}`, body);
    let res;
    try {
      res = await fetch(path, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch (err) {
      clientLog('error', `Network error: ${method} ${path}`, { message: String(err) });
      toast('Network error', true);
      throw err;
    }

    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { raw: text };
    }

    if (!res.ok) {
      const msg = data?.error?.message || `HTTP ${res.status}`;
      clientLog('error', `← ${method} ${path} ${res.status}`, data);
      toast(msg, true);
      const error = new Error(msg);
      error.status = res.status;
      error.data = data;
      throw error;
    }

    clientLog('info', `← ${method} ${path} ${res.status}`, data);
    return data;
  }

  function showView(name) {
    $$('.view').forEach((v) => v.classList.add('hidden'));
    $(`#view-${name}`).classList.remove('hidden');
    $$('.nav-btn').forEach((b) => b.classList.toggle('active', b.dataset.view === name));
    const [title, hint] = titles[name];
    $('#viewTitle').textContent = title;
    $('#viewHint').textContent = hint;
    if (name === 'logs') {
      refreshActivity();
      refreshWebhooks().catch(() => {});
    }
  }

  function fillOrderId(id) {
    if (!id) return;
    $('#orderIdInput').value = id;
    const payout = $('#formPayout [name="id"]');
    if (payout) payout.value = id;
  }

  $('#nav').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-view]');
    if (btn) showView(btn.dataset.view);
  });

  $('#btnLogout').addEventListener('click', () => {
    state.token = '';
    state.user = null;
    saveSession();
    toast('Signed out');
    showView('auth');
  });

  $('#formLogin').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = await api('POST', '/api/auth/login', {
      email: fd.get('email'),
      password: fd.get('password'),
    }, { noAuth: true });
    state.token = data.token;
    state.user = data.user;
    saveSession();
    toast('Signed in');
  });

  $$('[data-login]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const form = $('#formLogin');
      form.email.value = btn.dataset.login;
      form.password.value = 'Password123!';
      form.requestSubmit();
    });
  });

  $('#formRegister').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = await api('POST', '/api/auth/register', {
      email: fd.get('email'),
      password: fd.get('password'),
      role: fd.get('role'),
    }, { noAuth: true });
    state.token = data.token;
    state.user = data.user;
    saveSession();
    toast('Account created');
  });

  $('#btnLoadCatalog').addEventListener('click', async () => {
    const data = await api('GET', '/api/public/listings', undefined, { noAuth: true });
    const root = $('#catalogList');
    root.innerHTML = (data.listings || [])
      .map(
        (l) => `<article class="card">
          <h3>${escapeHtml(l.serviceName)}</h3>
          <div class="meta">${escapeHtml(l.description)}</div>
          <div class="meta">${escapeHtml(l.price)} ${escapeHtml(l.currency)} · ${escapeHtml(l.providerServerDomain)}</div>
          <div class="meta">id: ${escapeHtml(l.id)}</div>
          <div class="actions">
            <button type="button" class="btn soft" data-use-listing="${escapeHtml(l.id)}">Use in order</button>
          </div>
        </article>`,
      )
      .join('') || '<div class="muted">No listings</div>';
  });

  $('#catalogList').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-use-listing]');
    if (!btn) return;
    const id = btn.dataset.useListing;
    $('#formCreateOrder [name="listingId"]').value = id;
    $('#formCatalogDetail [name="id"]').value = id;
    showView('buyer');
    toast('Listing selected for order');
  });

  $('#formCatalogDetail').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = new FormData(e.target).get('id');
    const data = await api('GET', `/api/public/listings/${id}`, undefined, { noAuth: true });
    $('#catalogDetail').textContent = JSON.stringify(data, null, 2);
  });

  $('#formCreateListing').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const body = Object.fromEntries(fd.entries());
    const data = await api('POST', '/api/listings', body);
    $('#createListingOut').textContent = JSON.stringify(data, null, 2);
    if (data.listing?.id) {
      $('#formPatchListing [name="id"]').value = data.listing.id;
    }
    toast('Listing created — save the webhook secret');
  });

  $('#btnMineListings').addEventListener('click', async () => {
    const data = await api('GET', '/api/listings/mine');
    $('#mineListings').innerHTML = (data.listings || [])
      .map(
        (l) => `<article class="card">
          <h3>${escapeHtml(l.serviceName)}</h3>
          <div class="meta">${escapeHtml(l.price)} ${escapeHtml(l.currency)} · active=${l.isActive}</div>
          <div class="meta">${escapeHtml(l.id)}</div>
          <div class="actions">
            <button type="button" class="btn soft" data-edit-listing="${escapeHtml(l.id)}">Edit</button>
            <button type="button" class="btn soft" data-use-listing="${escapeHtml(l.id)}">Order</button>
          </div>
        </article>`,
      )
      .join('') || '<div class="muted">No listings</div>';
  });

  $('#mineListings').addEventListener('click', (e) => {
    const edit = e.target.closest('[data-edit-listing]');
    if (edit) {
      $('#formPatchListing [name="id"]').value = edit.dataset.editListing;
      return;
    }
    const use = e.target.closest('[data-use-listing]');
    if (use) {
      $('#formCreateOrder [name="listingId"]').value = use.dataset.useListing;
      showView('buyer');
    }
  });

  $('#formPatchListing').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const id = fd.get('id');
    const body = {};
    if (fd.get('serviceName')) body.serviceName = fd.get('serviceName');
    if (fd.get('isActive') !== '') body.isActive = fd.get('isActive') === 'true';
    const data = await api('PATCH', `/api/listings/${id}`, body);
    toast('Listing updated');
    $('#createListingOut').textContent = JSON.stringify(data, null, 2);
  });

  $('#btnDeactivateListing').addEventListener('click', async () => {
    const id = $('#formPatchListing [name="id"]').value;
    if (!id) return toast('Listing ID required', true);
    const data = await api('DELETE', `/api/listings/${id}`);
    toast('Deactivated');
    $('#createListingOut').textContent = JSON.stringify(data, null, 2);
  });

  $('#formCreateOrder').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = await api('POST', '/api/orders', {
      listingId: fd.get('listingId'),
      buyerDeliveryDomain: fd.get('buyerDeliveryDomain'),
    });
    $('#createOrderOut').textContent = JSON.stringify(data, null, 2);
    fillOrderId(data.order?.id);
    toast('Order created');
  });

  $('#btnMockPay').addEventListener('click', async () => {
    const id = $('#orderIdInput').value.trim();
    if (!id) return toast('Order ID required', true);
    const data = await api('POST', `/api/dev/mock-pay/${id}`);
    $('#orderActionOut').textContent = JSON.stringify(data, null, 2);
    toast('Mock pay recorded');
  });

  $('#btnVerifyPay').addEventListener('click', async () => {
    const id = $('#orderIdInput').value.trim();
    if (!id) return toast('Order ID required', true);
    const data = await api('POST', `/api/orders/${id}/verify-payment`);
    $('#orderActionOut').textContent = JSON.stringify(data, null, 2);
    toast(data.paid ? 'Payment confirmed' : 'Not paid yet');
  });

  $('#btnOrderStatus').addEventListener('click', async () => {
    const id = $('#orderIdInput').value.trim();
    if (!id) return toast('Order ID required', true);
    const data = await api('GET', `/api/orders/${id}/status`);
    $('#orderActionOut').textContent = JSON.stringify(data, null, 2);
  });

  $('#btnAdminOrders').addEventListener('click', async () => {
    const data = await api('GET', '/api/admin/orders');
    $('#adminOrders').innerHTML = (data.orders || [])
      .map(
        (o) => `<article class="card">
          <h3>${escapeHtml(o.status)} · ${escapeHtml(o.amount)} ${escapeHtml(o.currency)}</h3>
          <div class="meta">order: ${escapeHtml(o.id)}</div>
          <div class="meta">ref: ${escapeHtml(o.paymentReference)}</div>
          <div class="meta">listing: ${escapeHtml(o.listingId)}</div>
          <div class="actions">
            <button type="button" class="btn soft" data-pick-order="${escapeHtml(o.id)}">Select</button>
          </div>
        </article>`,
      )
      .join('') || '<div class="muted">No orders</div>';
  });

  $('#adminOrders').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-pick-order]');
    if (!btn) return;
    fillOrderId(btn.dataset.pickOrder);
    toast('Order selected');
  });

  $('#formPayout').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = new FormData(e.target).get('id');
    const data = await api('PATCH', `/api/admin/orders/${id}/payout`);
    $('#payoutOut').textContent = JSON.stringify(data, null, 2);
    toast('Marked payout_sent');
  });

  async function refreshActivity() {
    try {
      const data = await api('GET', '/api/console/activity', undefined, { noAuth: true });
      $('#serverLog').innerHTML = (data.entries || [])
        .map(
          (e) => `<div class="log-line ${e.level}"><span class="ts">${escapeHtml(e.at)}</span>
          [${escapeHtml(e.level)}] ${escapeHtml(e.message)}
          ${e.details ? `\n${escapeHtml(JSON.stringify(e.details))}` : ''}</div>`,
        )
        .join('') || '<div class="muted">Empty</div>';
    } catch {
      /* toast already shown */
    }
  }

  async function refreshWebhooks() {
    const data = await api('GET', '/api/console/webhook-logs');
    $('#webhookLogs').innerHTML = (data.logs || [])
      .map(
        (l) => `<article class="card">
          <h3>${l.success ? 'OK' : 'FAIL'} · HTTP ${l.httpStatus ?? '—'}</h3>
          <div class="meta">${escapeHtml(l.attemptedAt)}</div>
          <div class="meta">${escapeHtml(l.targetUrl)}</div>
          <div class="meta">order: ${escapeHtml(l.orderId)}</div>
          <pre class="code">${escapeHtml(l.responseSnippet || '')}</pre>
        </article>`,
      )
      .join('') || '<div class="muted">No logs (sign in as PROVIDER or ADMIN)</div>';
  }

  $('#btnRefreshActivity').addEventListener('click', () => refreshActivity());
  $('#btnRefreshWebhooks').addEventListener('click', () => refreshWebhooks().catch(() => {}));
  $('#btnClearActivity').addEventListener('click', async () => {
    await api('DELETE', '/api/console/activity', undefined, { noAuth: true });
    refreshActivity();
  });
  $('#btnClearClientLog').addEventListener('click', () => {
    state.clientLogs = [];
    renderClientLog();
  });

  setInterval(() => {
    if ($('#autoRefresh')?.checked && !$('#view-logs').classList.contains('hidden')) {
      refreshActivity();
    }
  }, 4000);

  renderSession();
  renderClientLog();
  showView('auth');
  clientLog('info', 'UI ready. Calling API on the same origin.');
})();
