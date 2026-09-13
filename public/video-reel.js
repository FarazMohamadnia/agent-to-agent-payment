(() => {
  const stage = document.getElementById('stage');
  const narrationEl = document.getElementById('narration');
  const clock = document.getElementById('clock');
  const fill = document.getElementById('progressFill');
  const btn = document.getElementById('btnPlay');
  const voiceOn = document.getElementById('voiceOn');

  let liveResult = null;
  let timer = null;
  let startedAt = 0;
  let total = 180;

  const scenes = [
    {
      at: 0,
      voice:
        "Let's start with what this project actually is. " +
        "Agent Economy is an ETH Global twenty twenty-six hackathon demo of autonomous agent-to-agent commerce. " +
        "In the agent economy, software agents will buy and sell digital services from each other — data, compute, research, and more. " +
        "The hard problem is not simply calling an API. " +
        "It is letting one agent discover another, agree on a price, respect spending limits, prove that payment happened, and only then unlock delivery — without a human coordinating every step in the middle. " +
        "That is exactly what this system demonstrates, end to end. " +
        "A Buyer Agent finds Seller Agents, compares offers, requests a quote, checks its own spending policy, executes a simulated USDC payment, generates a verifiable payment proof, and receives the service result. " +
        "You press start once. The agents complete the commercial loop. " +
        "And before we go further: this is demo mode. No real funds move, there is no custody, and there is no mainnet settlement — so we can focus clearly on the trust and payment architecture between agents.",
      html: `
        <p class="eyebrow">ETHGlobal 2026 · What is this?</p>
        <h1>What is Agent Economy?</h1>
        <p class="lead">Autonomous agent-to-agent commerce: discover, price, policy-check, pay, prove, and deliver — with one human click.</p>
        <div class="flow">
          <span class="chip on">Discover</span>
          <span class="chip on">Compare</span>
          <span class="chip on">Quote</span>
          <span class="chip on">Policy</span>
          <span class="chip on">Mock USDC</span>
          <span class="chip on">Proof</span>
          <span class="chip on">Deliver</span>
        </div>`,
    },
    {
      at: 52,
      voice:
        "Now meet the cast. Our Buyer is Research Agent, starting with ten USDC and a strict spending policy: one USDC maximum per transaction, five USDC daily, and USDC only. On the supply side, three Weather Data Agents offer the same capability at different prices — ten cents, fifteen cents, and twenty cents. That price spread is intentional, so you can see autonomous selection in action.",
      html: `
        <p class="eyebrow">The agents</p>
        <h1>Buyer and Seller agents</h1>
        <div class="grid">
          <div class="card selected">
            <h3>Research Agent</h3>
            <div class="meta">Buyer · discovery + payment</div>
            <div class="price">10.00 USDC</div>
            <div class="meta">Max tx 1.00 · Daily 5.00 · USDC only</div>
          </div>
          <div class="card">
            <h3>Weather Data Agents</h3>
            <div class="meta">Sellers · quote, verify, deliver</div>
            <div class="price">A 0.10 · B 0.15 · C 0.20</div>
          </div>
        </div>`,
    },
    {
      at: 78,
      voice:
        "The buyer’s goal is simple: get weather data for Dubai. It discovers every seller advertising weather data, compares their prices, and selects the cheapest valid provider — Weather Data Agent A at ten cents USDC. This decision engine is deterministic on purpose, so the live demo stays stable for judges — no external model key, no randomness in the critical path.",
      html: `
        <p class="eyebrow">Discovery &amp; decision</p>
        <h1>Select the cheapest valid provider</h1>
        <div class="grid">
          <div class="card selected"><h3>Weather Data Agent A</h3><div class="price">0.10 USDC</div><div class="meta">Selected</div></div>
          <div class="card"><h3>Weather Data Agent B</h3><div class="price">0.15 USDC</div></div>
          <div class="card"><h3>Weather Data Agent C</h3><div class="price">0.20 USDC</div></div>
        </div>`,
    },
    {
      at: 102,
      voice:
        "With a provider chosen, the seller issues a quote: one hundred units for ten cents USDC. Before any value moves, the buyer evaluates its spending policy — is the amount under the per-transaction cap, inside the daily limit, and in the allowed token? All three pass, so the policy status is approved, and payment may proceed.",
      html: `
        <p class="eyebrow">Quote + policy</p>
        <h1>Quote received · Policy APPROVED</h1>
        <div class="grid">
          <div class="card selected"><h3>Quote</h3><div class="price">0.10 USDC</div><div class="meta">100 units · 300s TTL</div></div>
          <div class="card selected"><h3>Spending policy</h3><div class="price" style="font-size:1.15rem">APPROVED ✓</div></div>
        </div>`,
    },
    {
      at: 124,
      async: true,
      voice:
        "Next, the system runs the autonomous transaction against the live backend. Simulated USDC is debited from the buyer and credited to the seller — ten dollars becomes nine ninety on the buyer side, and the seller receives ten cents. A mock transaction hash is recorded, and a signed payment proof is generated so the seller does not have to trust a bare notification.",
      html: `
        <p class="eyebrow">Live settlement</p>
        <h1>Running POST /api/demo/autonomous</h1>
        <pre class="code" id="liveBox">Connecting…</pre>`,
      onEnter: async () => {
        const box = document.getElementById('liveBox');
        try {
          const res = await fetch('/api/demo/autonomous', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ capability: 'weather-data', city: 'Dubai', quantity: 100 }),
          });
          const data = await res.json();
          liveResult = data;
          const lines = (data.timeline || [])
            .filter((t) => t.status === 'done')
            .map((t) => `✓ ${t.label}`)
            .join('\n');
          box.textContent =
            `${lines}\n\nSeller: ${data.result?.seller?.name}\n` +
            `Paid: ${data.result?.payment?.amount} ${data.result?.payment?.currency}\n` +
            `TX: ${data.result?.payment?.transactionHash}\n` +
            `Balance: ${data.result?.buyer?.balanceBefore} → ${data.result?.buyer?.balanceAfter}`;
        } catch (err) {
          box.textContent = `Error: ${err.message}`;
        }
      },
    },
    {
      at: 148,
      voice:
        "The seller now verifies the proof: payment must exist, the amount and currency must match, the receiver must be correct, and the signature must be valid. Only after Payment Verified does delivery unlock. In this demo, the seller returns mock weather for Dubai — thirty-one degrees and sunny — and the buyer receives the result, completing the commercial loop.",
      html: null,
      build: () => {
        const result = liveResult?.result?.serviceResult || {
          city: 'Dubai',
          temperature: 31,
          condition: 'Sunny',
        };
        const pay = liveResult?.result?.payment || {};
        return `
          <p class="eyebrow">Verify → deliver</p>
          <h1>Payment Verified · Service delivered</h1>
          <div class="grid">
            <div class="card selected">
              <h3>Proof</h3>
              <div class="meta">${pay.transactionHash || '0xmock_…'}</div>
              <div class="price">${pay.amount || '0.10'} ${pay.currency || 'USDC'}</div>
            </div>
            <div class="card"><h3>Result</h3><pre class="code" style="max-height:160px;margin:0">${JSON.stringify(result, null, 2)}</pre></div>
          </div>`;
      },
    },
    {
      at: 168,
      voice:
        "So, to close for ETH Global: Agent Economy shows a Buyer Agent discovering a Seller Agent, agreeing on price, obeying spending policy, settling with simulated USDC, proving payment, and receiving a service — with no human coordinating the middle. It is a hackathon demonstration, not production finance. Thank you.",
      html: `
        <p class="eyebrow">Close · ETHGlobal 2026</p>
        <h1>AUTONOMOUS TRANSACTION COMPLETE ✓</h1>
        <p class="lead">Agents traded end-to-end with verifiable mock settlement. Demo only — no real funds.</p>
        <div class="flow">
          <span class="chip on">ETHGlobal 2026</span>
          <span class="chip on">Agent payments</span>
          <span class="chip on">No custody</span>
        </div>`,
    },
  ];

  function fmt(sec) {
    const s = Math.max(0, Math.floor(sec));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }

  function pickVoice() {
    const voices = window.speechSynthesis?.getVoices?.() || [];
    return (
      voices.find((v) => /en-US/i.test(v.lang) && /Samantha/i.test(v.name)) ||
      voices.find((v) => /en-GB/i.test(v.lang) && /Daniel|Reed/i.test(v.name)) ||
      voices.find((v) => /^en/i.test(v.lang)) ||
      null
    );
  }

  function speak(text) {
    if (!voiceOn?.checked || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.96;
    u.pitch = 1;
    const voice = pickVoice();
    if (voice) u.voice = voice;
    window.speechSynthesis.speak(u);
  }

  function setSlide(html, narration) {
    stage.innerHTML = `<section class="slide active">${html}</section>`;
    narrationEl.innerHTML = `<strong>Voiceover:</strong> ${narration}`;
    speak(narration);
  }

  function sceneAt(t) {
    let current = scenes[0];
    for (const s of scenes) {
      if (t >= s.at) current = s;
    }
    return current;
  }

  let lastAt = -1;
  async function tick() {
    const t = Math.min((Date.now() - startedAt) / 1000, total);
    clock.textContent = `${fmt(t)} / 3:00`;
    fill.style.width = `${(t / total) * 100}%`;
    const scene = sceneAt(t);
    if (scene.at !== lastAt) {
      lastAt = scene.at;
      const html = scene.build ? scene.build() : scene.html;
      setSlide(html, scene.voice);
      if (scene.onEnter) await scene.onEnter();
    }
    if (t >= total) {
      clearInterval(timer);
      timer = null;
      btn.disabled = false;
      btn.textContent = 'Replay demo reel';
      window.speechSynthesis?.cancel?.();
    }
  }

  window.speechSynthesis?.getVoices?.();
  window.speechSynthesis?.addEventListener?.('voiceschanged', () => pickVoice());

  btn.addEventListener('click', async () => {
    if (timer) return;
    btn.disabled = true;
    btn.textContent = 'Playing…';
    liveResult = null;
    lastAt = -1;
    window.speechSynthesis?.cancel?.();
    startedAt = Date.now();
    await tick();
    timer = setInterval(tick, 250);
  });
})();
