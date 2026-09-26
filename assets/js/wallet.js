// Wallets: Phantom, Backpack, Solflare. nfa only asks them to sign; it never sees a key.
(function () {
  const { api, toast, store } = window.I;
  const ALL = [
    { id: 'phantom', name: 'Phantom', url: 'https://phantom.com/download', deep: u => `https://phantom.app/ul/browse/${encodeURIComponent(u)}?ref=${encodeURIComponent(location.origin)}`, get: () => (window.phantom && window.phantom.solana) || (window.solana && window.solana.isPhantom && window.solana) },
    { id: 'solflare', name: 'Solflare', url: 'https://solflare.com/download', deep: u => `https://solflare.com/ul/v1/browse/${encodeURIComponent(u)}?ref=${encodeURIComponent(location.origin)}`, get: () => window.solflare && window.solflare.isSolflare && window.solflare },
    { id: 'backpack', name: 'Backpack', optional: true, get: () => window.backpack && (window.backpack.solana || window.backpack) },
  ];
  const PROVIDERS = () => ALL.map(p => ({ ...p, p: p.get() })).filter(p => p.p);
  // the two we always offer, installed or not, plus any other installed wallet
  const OFFER = () => ALL.map(p => ({ ...p, p: p.get() })).filter(p => !p.optional || p.p);
  const W = { provider: null, address: null, id: null, listeners: [] };
  const MOBILE = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  // follow account switches and disconnects made inside the wallet itself
  function watch(p) {
    if (!p || !p.on || p._nfaWatch) return; p._nfaWatch = true;
    try {
      p.on('accountChanged', pk => { if (W.provider !== p) return; if (pk) { W.address = pk.toString(); emit(); } else disconnect(); });
      p.on('disconnect', () => { if (W.provider === p) { W.provider = null; W.address = null; W.id = null; emit(); } });
    } catch {}
  }
  const emit = () => W.listeners.forEach(f => { try { f(W); } catch {} });
  async function loadWeb3() {
    if (window.solanaWeb3) return window.solanaWeb3;
    await new Promise((res, rej) => { const s = document.createElement('script'); s.src = '/assets/vendor/web3.min.js'; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
    return window.solanaWeb3;
  }
  const b64ToBytes = b => Uint8Array.from(atob(b), c => c.charCodeAt(0));
  const bytesToB64 = u => { let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };
  async function connect(id) {
    const pr = PROVIDERS().find(p => p.id === id); if (!pr) { toast('That wallet isn\'t installed in this browser.'); return false; }
    try {
      const r = await pr.p.connect();
      W.provider = pr.p; W.address = ((r && r.publicKey) || pr.p.publicKey).toString(); W.id = id; watch(pr.p);
      store.set('wallet', id); emit(); toast('Connected ' + I.fmt.short(W.address)); return true;
    } catch { toast('The wallet didn\'t connect.'); return false; }
  }
  async function reconnect() {
    const id = store.get('wallet'); if (!id) return;
    const pr = PROVIDERS().find(p => p.id === id); if (!pr) return;
    try { const r = await pr.p.connect({ onlyIfTrusted: true }); const pk = ((r && r.publicKey) || pr.p.publicKey || '').toString(); if (pk) { W.provider = pr.p; W.address = pk; W.id = id; watch(pr.p); emit(); } } catch {}
  }
  async function disconnect() { try { await W.provider && W.provider.disconnect && W.provider.disconnect(); } catch {} W.provider = null; W.address = null; W.id = null; store.del('wallet'); emit(); }
  // the wallet adds its signature to a transaction the server built (and, for a mint, already signed with the new asset key)
  async function sign(b64) {
    if (!W.provider) throw new Error('Connect a wallet first.');
    const W3 = await loadWeb3();
    const tx = W3.VersionedTransaction.deserialize(b64ToBytes(b64));
    const s = await W.provider.signTransaction(tx);
    return bytesToB64(s.serialize());
  }
  async function send(signedB64) { const r = await api('tx', { raw: signedB64 }); if (!r.ok) throw new Error(r.msg || 'Sending failed.'); return r.sig; }
  async function confirm(sig, tries = 45) {
    for (let k = 0; k < tries; k++) { await new Promise(r => setTimeout(r, 1400)); const r = await api('tx?sig=' + encodeURIComponent(sig)); if (r.ok && r.status !== 'pending') return r.status; }
    return 'pending';
  }
  function picker(onDone) {
    const list = OFFER();
    const box = document.createElement('div'); box.className = 'modal'; box.setAttribute('role', 'dialog');
    box.innerHTML = `<div class="sheet"><button class="x" aria-label="Close">×</button><h3>Connect a wallet</h3>
      ${list.map(p => p.p ? `<button class="wbtn" data-id="${p.id}"><span class="wlogo ${p.id}"></span>${p.name}<small class="det">detected</small></button>`
        : MOBILE && p.deep ? `<a class="wbtn" href="${p.deep(location.href)}"><span class="wlogo ${p.id}"></span>Open in ${p.name}<small class="det">app ↗</small></a>`
        : `<a class="wbtn" href="${p.url}" target="_blank" rel="noopener"><span class="wlogo ${p.id}"></span>${p.name}<small class="det">install ↗</small></a>`).join('')}
      <p class="fine">Your wallet signs; nfa never sees your keys. Every transaction is dry-run on mainnet before your wallet sees it.</p></div>`;
    document.body.appendChild(box); requestAnimationFrame(() => box.classList.add('on'));
    const close = () => { box.classList.remove('on'); setTimeout(() => box.remove(), 200); };
    box.addEventListener('click', async e => {
      if (e.target === box || e.target.closest('.x')) return close();
      const b = e.target.closest('.wbtn'); if (!b) return;
      const ok = await connect(b.dataset.id); close(); if (ok && onDone) onDone();
    });
  }
  function button(el) {
    const paint = () => { if (W.address) { el.innerHTML = `<span class="dot"></span>${I.esc(I.fmt.short(W.address))}`; el.classList.add('on'); el.classList.remove('lime'); } else { el.innerHTML = '<span class="dot off"></span>Connect wallet'; el.classList.remove('on'); } };
    el.onclick = () => {
      if (!W.address) return picker();
      const box = document.createElement('div'); box.className = 'modal';
      box.innerHTML = `<div class="sheet"><button class="x" aria-label="Close">×</button><h3>${I.esc(I.fmt.short(W.address))}</h3><button class="wbtn" data-a="mine">My inventory</button><button class="wbtn" data-a="copy">Copy address</button><a class="wbtn" href="https://solscan.io/account/${W.address}" target="_blank" rel="noopener">View on Solscan<small class="det">↗</small></a><button class="wbtn" data-a="out">Disconnect</button></div>`;
      document.body.appendChild(box); requestAnimationFrame(() => box.classList.add('on'));
      const shut = () => { box.classList.remove('on'); setTimeout(() => box.remove(), 200); };
      box.onclick = async e => { if (e.target === box || e.target.closest('.x')) return shut(); const a = e.target.closest('[data-a]'); if (!a) return; if (a.dataset.a === 'copy') I.copy(W.address, 'Address copied'); if (a.dataset.a === 'out') await disconnect(); if (a.dataset.a === 'mine') location.href = '/inventory'; shut(); };
    };
    W.listeners.push(paint); paint();
  }
  window.Wallet = { W, MOBILE, PROVIDERS, OFFER, connect, reconnect, disconnect, sign, send, confirm, picker, button, on: f => W.listeners.push(f), loadWeb3 };
})();
