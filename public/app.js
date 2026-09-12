(() => {
  const state = {
    token: localStorage.getItem('ap_token') || '',
    user: JSON.parse(localStorage.getItem('ap_user') || 'null'),
    clientLogs: [],
    phaseRunning: false,
    autoRunning: false,
  };

  const titles = {
    autonomous: [
      'Autonomous Agent Demo',
      'One-click Agent-to-Agent commerce — discover, pay, prove, deliver (mock USDC only).',
    ],
    auth: ['Auth', 'Sign in with seed accounts or register a new user.'],
    phased: [
      'Architecture Walkthrough',
      '11-phase technical demo of the payment validation platform.',
    ],
    catalog: ['Public catalog', 'No auth required — safe fields only.'],
    provider: ['Provider', 'Create and manage listings (PROVIDER role).'],
    buyer: ['Buyer', 'Create order → mock pay → verify → check status.'],
    admin: ['Admin', 'List orders and mark payouts manually.'],
    logs: ['Logs & errors', 'Server activity, client errors, and webhook delivery logs.'],
  };

  const PHASE_DEFS = [
    {
      id: 'provider_auth',
      title: '1. Provider Agent onboarding',
      desc: 'Register Provider Agent (email + password → JWT).',
    },
    {
      id: 'listing',
      title: '2. Create service listing',
      desc: 'Provider lists a service with payout address + webhook sink URL.',
    },
    {
      id: 'catalog',
      title: '3. Public discovery',
      desc: 'Unauthenticated catalog browse (no secrets / payout exposed).',
    },
    {
      id: 'buyer_auth',
      title: '4. Buyer Agent onboarding',
      desc: 'Register Buyer Agent and obtain JWT.',
    },
    {
      id: 'order',
      title: '5. Create order',
      desc: 'Buyer creates order with delivery domain → paymentReference issued.',
    },
    {
      id: 'mock_pay',
      title: '6. Simulate payment',
      desc: 'MockPaymentVerifier marks payment received for this order.',
    },
    {
      id: 'verify',
      title: '7. Verify + confirmation',
      desc: 'Platform verifies payment, issues signed confirmation, notifies provider webhook.',
    },
    {
      id: 'status',
      title: '8. Provider polls status',
      desc: 'Provider independently confirms order is paid via status API.',
    },
    {
      id: 'validation',
      title: '9. Negative validation checks',
      desc: 'Reject unauthorized access and double-payment confirmation.',
    },
    {
      id: 'admin',
      title: '10. Admin payout mark',
      desc: 'Admin marks payout_sent (manual MVP payout recording).',
    },
    {
      id: 'webhooks',
      title: '11. Webhook evidence',
      desc: 'Inspect sink + delivery logs proving provider notification.',
    },
  ];

  let phaseState = PHASE_DEFS.map((p) => ({
    ...p,
    status: 'pending',
    result: null,
    error: null,
  }));

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
    const entry = { at: new Date().toISOString(), level, message, details };
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
    const token = opts.token !== undefined ? opts.token : state.token;
    if (token && !opts.noAuth) headers.Authorization = `Bearer ${token}`;

    if (!opts.quiet) clientLog('info', `→ ${method} ${path}`, body);
    let res;
    try {
      res = await fetch(path, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch (err) {
      clientLog('error', `Network error: ${method} ${path}`, { message: String(err) });
      if (!opts.quiet) toast('Network error', true);
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
      if (!opts.quiet) toast(msg, true);
      const error = new Error(msg);
      error.status = res.status;
      error.data = data;
      throw error;
    }

    if (!opts.quiet) clientLog('info', `← ${method} ${path} ${res.status}`, data);
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
    if (name === 'phased') renderPhases();
    if (name === 'autonomous') loadAutonomousDashboard();
  }

  function fillOrderId(id) {
    if (!id) return;
    $('#orderIdInput').value = id;
    const payout = $('#formPayout [name="id"]');
    if (payout) payout.value = id;
  }

  function renderPhases() {
    const root = $('#phaseList');
    root.innerHTML = phaseState
      .map((p) => {
        const payload = p.error
          ? { error: p.error }
          : p.result;
        return `<article class="phase-card ${p.status}" data-phase="${p.id}">
          <div class="phase-head">
            <div class="phase-title">${escapeHtml(p.title)}</div>
            <span class="phase-badge">${escapeHtml(p.status)}</span>
          </div>
          <div class="phase-desc">${escapeHtml(p.desc)}</div>
          ${
            payload
              ? `<pre class="code">${escapeHtml(JSON.stringify(payload, null, 2))}</pre>`
              : ''
          }
        </article>`;
      })
      .join('');
  }

  function setPhase(id, status, result, error) {
    const p = phaseState.find((x) => x.id === id);
    if (!p) return;
    p.status = status;
    if (result !== undefined) p.result = result;
    if (error !== undefined) p.error = error;
    renderPhases();
    const card = $(`.phase-card[data-phase="${id}"]`);
    if (card) card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function resetPhases() {
    phaseState = PHASE_DEFS.map((p) => ({
      ...p,
      status: 'pending',
      result: null,
      error: null,
    }));
    $('#phasedStatus').textContent = 'Idle';
    $('#phaseSummary').textContent = 'Click “Run architecture walkthrough” to start.';
    renderPhases();
  }

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  async function expectFail(fn, expectedStatus) {
    try {
      await fn();
      throw new Error(`Expected failure with status ${expectedStatus}, but call succeeded`);
    } catch (err) {
      if (err.status === expectedStatus) {
        return { ok: true, status: err.status, error: err.data?.error || err.message };
      }
      throw err;
    }
  }

  async function runPhasedDemo() {
    if (state.phaseRunning) return;
    state.phaseRunning = true;
    $('#btnRunPhased').disabled = true;
    resetPhases();
    $('#phasedStatus').textContent = 'Running…';

    const stamp = Date.now();
    const password = 'Password123!';
    const providerEmail = `provider.agent.${stamp}@demo.local`;
    const buyerEmail = `buyer.agent.${stamp}@demo.local`;
    const adminEmail = `admin.agent.${stamp}@demo.local`;
    const webhookUrl = `${window.location.origin}/api/dev/webhook-sink`;
    const ctx = {};

    const q = { quiet: true };

    try {
      await api('DELETE', '/api/dev/webhook-sink', undefined, { ...q, noAuth: true });

      // 1 Provider auth
      setPhase('provider_auth', 'running');
      await sleep(200);
      const providerReg = await api(
        'POST',
        '/api/auth/register',
        { email: providerEmail, password, role: 'PROVIDER' },
        { ...q, noAuth: true },
      );
      ctx.provider = providerReg;
      setPhase('provider_auth', 'pass', {
        email: providerReg.user.email,
        role: providerReg.user.role,
        userId: providerReg.user.id,
        tokenPreview: `${providerReg.token.slice(0, 24)}…`,
      });

      // 2 Listing
      setPhase('listing', 'running');
      await sleep(200);
      const listingRes = await api(
        'POST',
        '/api/listings',
        {
          serviceName: `Agent Weather API ${stamp}`,
          description: 'Phased demo listing between two agents',
          providerServerDomain: 'https://provider-agent.example.com',
          price: '7.50',
          currency: 'USDT',
          payoutAddress: `payout-agent-${stamp}`,
          providerWebhookUrl: webhookUrl,
        },
        { ...q, token: providerReg.token },
      );
      ctx.listing = listingRes.listing;
      setPhase('listing', 'pass', {
        listingId: listingRes.listing.id,
        price: listingRes.listing.price,
        currency: listingRes.listing.currency,
        webhookUrl: listingRes.listing.providerWebhookUrl,
        webhookSecretSaved: Boolean(listingRes.listing.providerWebhookSecret),
      });

      // 3 Catalog
      setPhase('catalog', 'running');
      await sleep(200);
      const catalog = await api('GET', '/api/public/listings', undefined, { ...q, noAuth: true });
      const found = (catalog.listings || []).find((l) => l.id === listingRes.listing.id);
      if (!found) throw new Error('New listing not visible in public catalog');
      if ('payoutAddress' in found || 'providerWebhookSecret' in found) {
        throw new Error('Public catalog leaked sensitive fields');
      }
      setPhase('catalog', 'pass', {
        totalActive: catalog.listings.length,
        foundListing: {
          id: found.id,
          serviceName: found.serviceName,
          price: found.price,
        },
        secretsHidden: true,
      });

      // 4 Buyer auth
      setPhase('buyer_auth', 'running');
      await sleep(200);
      const buyerReg = await api(
        'POST',
        '/api/auth/register',
        { email: buyerEmail, password, role: 'BUYER' },
        { ...q, noAuth: true },
      );
      ctx.buyer = buyerReg;
      setPhase('buyer_auth', 'pass', {
        email: buyerReg.user.email,
        role: buyerReg.user.role,
        userId: buyerReg.user.id,
      });

      // 5 Order
      setPhase('order', 'running');
      await sleep(200);
      const orderRes = await api(
        'POST',
        '/api/orders',
        {
          listingId: listingRes.listing.id,
          buyerDeliveryDomain: 'https://buyer-agent.example.com/inbox',
        },
        { ...q, token: buyerReg.token },
      );
      ctx.order = orderRes.order;
      fillOrderId(orderRes.order.id);
      setPhase('order', 'pass', {
        orderId: orderRes.order.id,
        paymentReference: orderRes.order.paymentReference,
        amount: orderRes.order.amount,
        currency: orderRes.order.currency,
        status: orderRes.order.status,
        expiresAt: orderRes.order.expiresAt,
      });

      // 6 Mock pay
      setPhase('mock_pay', 'running');
      await sleep(200);
      const mockPay = await api(
        'POST',
        `/api/dev/mock-pay/${orderRes.order.id}`,
        undefined,
        { ...q, noAuth: true },
      );
      setPhase('mock_pay', 'pass', mockPay);

      // 7 Verify
      setPhase('verify', 'running');
      await sleep(200);
      const verify = await api(
        'POST',
        `/api/orders/${orderRes.order.id}/verify-payment`,
        undefined,
        { ...q, token: buyerReg.token },
      );
      if (!verify.paid || verify.order?.status !== 'paid') {
        throw new Error('Payment verification did not mark order as paid');
      }
      if (!verify.order?.confirmationToken) {
        throw new Error('Confirmation token missing after payment');
      }
      setPhase('verify', 'pass', {
        paid: verify.paid,
        status: verify.order.status,
        confirmationTokenPreview: `${verify.order.confirmationToken.slice(0, 32)}…`,
        paidAt: verify.order.paidAt,
      });

      // 8 Provider status
      setPhase('status', 'running');
      await sleep(200);
      const status = await api(
        'GET',
        `/api/orders/${orderRes.order.id}/status`,
        undefined,
        { ...q, token: providerReg.token },
      );
      setPhase('status', 'pass', {
        status: status.order.status,
        confirmationPresent: Boolean(status.order.confirmationToken),
        buyerDeliveryDomain: status.order.buyerDeliveryDomain,
      });

      // 9 Validation negatives
      setPhase('validation', 'running');
      await sleep(200);
      const stranger = await api(
        'POST',
        '/api/auth/register',
        {
          email: `stranger.${stamp}@demo.local`,
          password,
          role: 'BUYER',
        },
        { ...q, noAuth: true },
      );
      const denied = await expectFail(
        () =>
          api('GET', `/api/orders/${orderRes.order.id}/status`, undefined, {
            ...q,
            token: stranger.token,
          }),
        403,
      );
      const doublePay = await expectFail(
        () =>
          api('POST', `/api/orders/${orderRes.order.id}/verify-payment`, undefined, {
            ...q,
            token: buyerReg.token,
          }),
        409,
      );
      setPhase('validation', 'pass', {
        strangerDenied: denied,
        doublePaymentRejected: doublePay,
      });

      // 10 Admin payout
      setPhase('admin', 'running');
      await sleep(200);
      const adminReg = await api(
        'POST',
        '/api/auth/register',
        { email: adminEmail, password, role: 'ADMIN' },
        { ...q, noAuth: true },
      );
      const payout = await api(
        'PATCH',
        `/api/admin/orders/${orderRes.order.id}/payout`,
        undefined,
        { ...q, token: adminReg.token },
      );
      if (payout.order?.status !== 'payout_sent') {
        throw new Error('Admin payout mark failed');
      }
      setPhase('admin', 'pass', {
        adminEmail: adminReg.user.email,
        orderStatus: payout.order.status,
      });

      // 11 Webhooks
      setPhase('webhooks', 'running');
      await sleep(200);
      const sink = await api('GET', '/api/dev/webhook-sink', undefined, { ...q, noAuth: true });
      const logs = await api('GET', '/api/console/webhook-logs', undefined, {
        ...q,
        token: providerReg.token,
      });
      const orderLogs = (logs.logs || []).filter((l) => l.orderId === orderRes.order.id);
      const sinkHit = (sink.entries || []).some(
        (e) => e.body?.orderId === orderRes.order.id || e.rawBody?.includes(orderRes.order.id),
      );
      if (!sinkHit && orderLogs.length === 0) {
        throw new Error('No webhook delivery evidence found');
      }
      setPhase('webhooks', 'pass', {
        sinkEntries: (sink.entries || []).slice(0, 3),
        deliveryLogsForOrder: orderLogs.slice(0, 5),
        providerNotified: sinkHit || orderLogs.some((l) => l.success),
      });

      // Leave session on buyer for convenience
      state.token = buyerReg.token;
      state.user = buyerReg.user;
      saveSession();

      const summary = {
        ok: true,
        providerEmail,
        buyerEmail,
        listingId: listingRes.listing.id,
        orderId: orderRes.order.id,
        paymentReference: orderRes.order.paymentReference,
        finalStatus: 'payout_sent',
        phasesPassed: phaseState.filter((p) => p.status === 'pass').length,
        phasesTotal: phaseState.length,
      };
      $('#phaseSummary').textContent = JSON.stringify(summary, null, 2);
      $('#phasedStatus').textContent = 'Passed';
      toast('Phased demo completed successfully');
      clientLog('info', 'Phased demo completed', summary);
    } catch (err) {
      const running = phaseState.find((p) => p.status === 'running');
      if (running) {
        setPhase(running.id, 'fail', null, {
          message: err.message,
          status: err.status,
          data: err.data,
        });
      }
      $('#phasedStatus').textContent = 'Failed';
      $('#phaseSummary').textContent = JSON.stringify(
        {
          ok: false,
          failedPhase: running?.id || null,
          message: err.message,
          status: err.status,
          data: err.data,
        },
        null,
        2,
      );
      toast(err.message || 'Phased demo failed', true);
      clientLog('error', 'Phased demo failed', {
        message: err.message,
        status: err.status,
        data: err.data,
      });
    } finally {
      state.phaseRunning = false;
      $('#btnRunPhased').disabled = false;
    }
  }

  // Navigation
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

  $('#btnRunPhased').addEventListener('click', () => runPhasedDemo());
  $('#btnResetPhased').addEventListener('click', () => {
    if (state.phaseRunning) return;
    resetPhases();
  });

  async function loadAutonomousDashboard() {
    try {
      const agentsRes = await api('GET', '/api/agents', undefined, { noAuth: true, quiet: true });
      const buyer = (agentsRes.agents || []).find((a) => a.type === 'BUYER');
      const buyerEl = $('#buyerCardBody');
      if (buyer) {
        buyerEl.innerHTML = `
          <div><strong>${escapeHtml(buyer.name)}</strong></div>
          <div class="meta">Wallet: ${escapeHtml(buyer.walletAddress)}</div>
          <div class="meta">Balance: <strong>${escapeHtml(buyer.balance)} ${escapeHtml(buyer.currency)}</strong></div>
          <div class="meta">Max transaction: ${escapeHtml(buyer.spendingPolicy?.maxTransaction || '—')} ${escapeHtml(buyer.currency)}</div>
          <div class="meta">Daily limit: ${escapeHtml(buyer.spendingPolicy?.dailyLimit || '—')} (spent ${escapeHtml(buyer.spendingPolicy?.dailySpent || '0')})</div>
          <div class="meta">Allowed token: ${escapeHtml(buyer.spendingPolicy?.allowedToken || 'USDC')}</div>
        `;
      } else {
        buyerEl.innerHTML = '<div class="muted">Run <code>npm run seed</code> to load Research Agent.</div>';
      }

      const offersRes = await api('GET', '/api/offers', undefined, { noAuth: true, quiet: true });
      const offers = offersRes.offers || [];
      $('#offersList').innerHTML = offers.length
        ? offers
            .map(
              (o) => `<article class="card">
              <h3>${escapeHtml(o.agentName)}</h3>
              <div class="meta">${escapeHtml(o.serviceName)} · ${escapeHtml(o.capability)}</div>
              <div class="meta"><strong>${escapeHtml(o.price)} ${escapeHtml(o.currency)}</strong>${o.unitLabel ? ` / ${escapeHtml(o.unitLabel)}` : ''}</div>
            </article>`,
            )
            .join('')
        : '<div class="muted">No offers — seed the database.</div>';
    } catch (err) {
      $('#buyerCardBody').textContent = err.message;
    }
  }

  function renderTimeline(steps) {
    const root = $('#autoTimeline');
    root.innerHTML = (steps || [])
      .map((s) => {
        const data = s.data
          ? `<div class="tl-data">${escapeHtml(JSON.stringify(s.data, null, 2))}</div>`
          : '';
        return `<div class="tl-item ${escapeHtml(s.status)}">
          <div class="tl-label">${escapeHtml(s.label)}</div>
          <div class="tl-meta">${escapeHtml(s.status)}${s.at ? ` · ${escapeHtml(s.at)}` : ''}</div>
          ${data}
        </div>`;
      })
      .join('');
  }

  async function runAutonomous() {
    if (state.autoRunning) return;
    state.autoRunning = true;
    $('#btnAutonomous').disabled = true;
    $('#autoStatus').textContent = 'Running…';
    $('#autoProof').textContent = 'Running…';
    $('#autoResult').textContent = 'Running…';
    renderTimeline([]);
    try {
      const data = await api(
        'POST',
        '/api/demo/autonomous',
        { capability: 'weather-data', city: 'Dubai', quantity: 100 },
        { noAuth: true },
      );
      renderTimeline(data.timeline || []);
      $('#autoProof').textContent = JSON.stringify(data.result?.paymentProof || data, null, 2);
      $('#autoResult').textContent = JSON.stringify(data.result?.serviceResult || {}, null, 2);
      $('#autoStatus').textContent = data.ok ? 'Completed ✓' : 'Failed';
      toast(data.ok ? 'Autonomous transaction complete' : 'Failed');
      await loadAutonomousDashboard();
    } catch (err) {
      $('#autoStatus').textContent = 'Failed';
      $('#autoProof').textContent = JSON.stringify(
        { error: err.message, data: err.data },
        null,
        2,
      );
    } finally {
      state.autoRunning = false;
      $('#btnAutonomous').disabled = false;
    }
  }

  $('#btnAutonomous').addEventListener('click', () => runAutonomous());
  $('#btnRefreshAgents').addEventListener('click', () => loadAutonomousDashboard());

  // Auth
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

  // Catalog
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

  // Provider
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

  // Buyer
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

  // Admin
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
  resetPhases();
  showView('autonomous');
  clientLog('info', 'UI ready. DEMO MODE — NO REAL FUNDS.');
})();
