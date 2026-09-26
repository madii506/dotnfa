// Shared helpers for every nfa page.
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  async function api(path, data) {
    const opt = data ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) } : { cache: 'no-store' };
    let r, j;
    try { r = await fetch('/api/' + path, opt); } catch { return { ok: false, reason: 'offline', msg: 'You look offline. Check your connection.' }; }
    try { j = await r.json(); } catch { j = { ok: false, reason: 'server', msg: 'Something broke on our side. Try again in a minute.' }; }
    if (!r.ok && j.ok !== false) j.ok = false;
    return j;
  }
  const fmt = {
    usd: (n, d = 2) => n == null || isNaN(n) ? '—' : '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }),
    amt: n => n == null ? '—' : n >= 1000 ? n.toLocaleString('en-US', { maximumFractionDigits: 0 }) : n >= 1 ? n.toLocaleString('en-US', { maximumFractionDigits: 4 }) : n === 0 ? '0' : n.toPrecision(3),
    short: a => a ? a.slice(0, 4) + '…' + a.slice(-4) : '',
    ago: t => { if (!t) return '—'; const s = (Date.now() - t) / 1000; if (s < 60) return 'just now'; if (s < 3600) return Math.floor(s / 60) + 'm ago'; if (s < 86400) return Math.floor(s / 3600) + 'h ago'; return Math.floor(s / 86400) + 'd ago'; },
    int: n => Number(n).toLocaleString('en-US'),
  };
  function toast(t, ms = 3000) { let e = $('.toast'); if (!e) { e = document.createElement('div'); e.className = 'toast'; e.setAttribute('role', 'status'); document.body.appendChild(e); } e.textContent = t; e.classList.add('on'); clearTimeout(e._h); e._h = setTimeout(() => e.classList.remove('on'), ms); }
  async function copy(t, label = 'Copied') { try { await navigator.clipboard.writeText(t); toast(label); } catch { toast('Copy failed. Select it and copy by hand.'); } }
  const store = {
    get(k, d) { try { const v = localStorage.getItem('nfa.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem('nfa.' + k, JSON.stringify(v)); } catch {} },
    del(k) { try { localStorage.removeItem('nfa.' + k); } catch {} },
  };
  function countTo(el, to, { ms = 900, f = v => fmt.int(Math.round(v)) } = {}) {
    const from = Number(el.dataset.v || 0); el.dataset.v = to; const t0 = performance.now();
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { el.textContent = f(to); return; }
    const step = t => { const k = Math.min(1, (t - t0) / ms), e = 1 - Math.pow(1 - k, 3); el.textContent = f(from + (to - from) * e); if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }
  function reveal() {
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('vis'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px' });
    $$('.rv').forEach(el => io.observe(el));
    const sweep = () => $$('.rv:not(.vis)').forEach(el => { const r = el.getBoundingClientRect(); if (r.top < innerHeight * .95) el.classList.add('vis'); });
    addEventListener('hashchange', sweep); setTimeout(sweep, 400);
  }

  // the pixel wordmark "nfa": drawn from a tiny bitmap so it stays crisp and lowercase at any size
  const GLYPH = {
    '.': ['...', '...', '...', '...', '...', '...', '...', '...', '###', '###', '###'],
    n: ['.......', '.......', '.......', '.......', '##.###.', '#######', '###..##', '##...##', '##...##', '##...##', '##...##'],
    f: ['..####', '.#####', '.##...', '.##...', '######', '######', '.##...', '.##...', '.##...', '.##...', '.##...'],
    a: ['.......', '.......', '.......', '.......', '.#####.', '.######', '.....##', '.######', '##...##', '#######', '.######'],
  };
  function logo(cv, unit = 12, { ink = '#111113', shade = '#c8f24a', text = 'nfa' } = {}) {
    if (!cv) return;
    const gl = [...text].map(c => GLYPH[c]).filter(Boolean);
    const w = gl.reduce((n, g) => n + g[0].length + 2, 0) - 2, h = 11;
    cv.width = (w + 1) * unit; cv.height = (h + 1) * unit;
    const g = cv.getContext('2d'); g.clearRect(0, 0, cv.width, cv.height);
    const plot = (dx, dy, col) => { g.fillStyle = col; let x0 = 0; for (const G of gl) { G.forEach((row, y) => [...row].forEach((c, x) => { if (c === '#') g.fillRect((x0 + x + dx) * unit, (y + dy) * unit, unit, unit); })); x0 += G[0].length + 2; } };
    if (shade) plot(1, 1, shade); plot(0, 0, ink);
    cv.style.width = cv.width + 'px'; cv.style.height = cv.height + 'px';
  }
  // mobile menu: the ☰ button opens a sheet with the nav links (and the wallet button stays in the bar)
  function nav() {
    const b = $('.nav .burger'); if (!b) return;
    b.onclick = () => {
      const box = document.createElement('div'); box.className = 'modal menu';
      box.innerHTML = `<div class="sheet"><button class="x" aria-label="Close">×</button><h3>Menu</h3>${$$('.nav .links a, .nav .more a, .nav .xlink').map(a => `<a class="wbtn" href="${esc(a.getAttribute('href'))}"${a.target ? ' target="_blank" rel="noopener"' : ''}>${esc(a.dataset.label || a.textContent)}<small class="det">▶</small></a>`).join('')}</div>`;
      document.body.appendChild(box); requestAnimationFrame(() => box.classList.add('on'));
      const close = () => { box.classList.remove('on'); setTimeout(() => box.remove(), 200); };
      box.onclick = e => { if (e.target === box || e.target.closest('.x') || e.target.closest('a')) close(); };
    };
  }
  $$('canvas[data-logo]').forEach(c => logo(c, +c.dataset.logo || 3, { shade: c.dataset.shade === 'none' ? null : '#c8f24a', ink: c.dataset.ink || '#111113' }));
  // the site's own config (ca / x) — rows render only when set
  const CFG = { ca: '', x: 'https://x.com/nfallm_' };
  function scam() {
    const el = $('#scam'); if (!el) return;
    el.innerHTML = CFG.ca ? `OFFICIAL TOKEN <b>$NFA</b> <code>${esc(CFG.ca)}</code> <button type="button" id="scamCopy">copy</button> — anything else is not ours`
      : '<b>$NFA</b> IS NOT LIVE YET — ANY CA POSTED BEFORE IT SHOWS HERE IS NOT US';
    const b = $('#scamCopy'); if (b) b.onclick = () => copy(CFG.ca, 'Contract address copied');
  }
  window.I = { $, $$, esc, api, fmt, toast, copy, store, countTo, reveal, CFG, scam, logo, nav };
  nav();
})();
