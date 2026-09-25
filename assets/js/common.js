// Shared helpers for every .nfa page.
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
  // the site's own config (ca / x) — rows render only when set
  const CFG = { ca: '', x: '' };
  function scam() {
    const el = $('#scam'); if (!el) return;
    el.innerHTML = CFG.ca ? `OFFICIAL TOKEN <b>$NFA</b> <code>${esc(CFG.ca)}</code> <button type="button" id="scamCopy">copy</button> — anything else is not ours`
      : '<b>$NFA</b> IS NOT LIVE YET — ANY CA POSTED BEFORE IT SHOWS HERE IS NOT US';
    const b = $('#scamCopy'); if (b) b.onclick = () => copy(CFG.ca, 'Contract address copied');
  }
  window.I = { $, $$, esc, api, fmt, toast, copy, store, countTo, reveal, CFG, scam };
})();
