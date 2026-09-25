// Inventory: connect Phantom or Solflare and see what the wallet really holds, straight from Solana.
(() => {
  const { $, esc, api, fmt, toast, copy, store, countTo } = I;
  const A = window.AgentPx, WL = window.Wallet;
  I.scam();
  A.paint($('#navmark'), { head: 'box', body: 'white', eyes: 'dots', eye: 'lime', top: 'ball', extra: 'card' }, { scale: 1, shadow: false, pose: 'still' });
  WL.button($('#walletBtn'));
  const stage = Stage($('#stage'), { traits: { head: 'box', body: 'white', eyes: 'dots', eye: 'lime', top: 'ball', extra: 'card' } });
  let data = null, sel = null;

  function connectButtons() {
    $('#connectBox').innerHTML = WL.OFFER().filter(p => p.id !== 'backpack' || p.p).map(p => p.p
      ? `<button class="wbtn" type="button" data-id="${p.id}"><span class="wlogo ${p.id}"></span>Connect ${p.name}<small class="det">detected</small></button>`
      : `<a class="wbtn" href="${p.url}" target="_blank" rel="noopener"><span class="wlogo ${p.id}"></span>Get ${p.name}<small class="det">install ↗</small></a>`).join('');
    $('#connectBox').onclick = async e => { const b = e.target.closest('button[data-id]'); if (!b) return; b.disabled = true; await WL.connect(b.dataset.id); b.disabled = false; };
  }
  function pick(a) {
    sel = a; stage.set(a.traits);
    $('#stName').textContent = a.name; $('#stSub').textContent = `1 in ${fmt.int(a.odds)} · ${a.made ? 'minted on .nfa' : 'registered agent'}`;
    document.querySelectorAll('#agentWall .ag').forEach(el => el.classList.toggle('sel', el.dataset.a === a.asset));
    stage.say(`${a.name}, reporting. Open my passport to run me.`);
  }
  async function load() {
    const addr = WL.W.address;
    if (!addr) {
      $('#connectBox').hidden = false; $('#who').hidden = true; ['agents', 'tokens', 'other'].forEach(id => $('#' + id).hidden = true);
      $('#stName').textContent = 'Your inventory'; $('#stSub').textContent = 'connect a wallet'; ['stAgents', 'stTotal', 'stSol'].forEach(id => $('#' + id).textContent = '—');
      connectButtons(); return;
    }
    $('#connectBox').hidden = true; $('#who').hidden = false;
    $('#who').innerHTML = `<div class="kv"><span>Wallet</span><b>${esc(addr)}</b><button type="button" id="cp">copy</button></div><div class="acts2"><button class="btn ghost sm" type="button" id="out">Disconnect</button><button class="btn ghost sm" type="button" id="re">Refresh</button></div>`;
    $('#cp').onclick = () => copy(addr, 'Address copied'); $('#out').onclick = () => WL.disconnect(); $('#re').onclick = () => load();
    $('#agentWall').innerHTML = '<div class="empty"><span class="spin"></span> Reading your wallet on Solana…</div>'; $('#agents').hidden = false;
    const known = store.get('mine', []).join(',');
    const r = await api(`inventory?owner=${addr}${known ? '&known=' + known : ''}`);
    if (!r.ok) { $('#agentWall').innerHTML = `<div class="empty"><b>Couldn't read the chain.</b>${esc(r.msg || '')} <button class="btn sm ghost" type="button" id="retry">Retry</button></div>`; $('#retry').onclick = load; return; }
    data = r;
    $('#stAgents').textContent = r.agents.length; $('#stTotal').textContent = fmt.usd(r.total);
    const s = r.tokens.find(t => t.symbol === 'SOL'); $('#stSol').textContent = s ? fmt.amt(s.amount) : '0';
    // agents
    if (!r.agents.length) {
      $('#agentWall').innerHTML = `<div class="empty"><b>No agents in this wallet yet.</b>Mint on .nfa isn't live yet. You can build yours now; it's saved in this browser. <a class="btn sm" href="/#create" style="margin-top:12px">Create yours →</a></div>`;
      stage.say('Empty inventory. Let\'s fix that.');
    } else {
      const g = document.createElement('div'); g.className = 'wall';
      r.agents.forEach((a, i) => {
        const c = document.createElement('a'); c.className = 'ag'; c.href = '/a/' + a.asset; c.dataset.a = a.asset; c.style.animationDelay = (i * 40) + 'ms';
        c.innerHTML = `<canvas></canvas><b>${esc(a.name)}</b><small>1 in ${fmt.int(a.odds)}</small>${a.made ? '' : '<span class="ext">REGISTERED</span>'}`;
        A.paint(c.querySelector('canvas'), a.traits, { scale: 2, shadow: false, pose: 'still' });
        c.addEventListener('click', e => { if (sel && sel.asset === a.asset) return; e.preventDefault(); pick(a); });
        g.appendChild(c);
      });
      $('#agentWall').innerHTML = `<p class="fine" style="margin:0 0 14px">Tap an agent to put it on the stage; tap again to open its passport. Read by ${esc(r.source)}.</p>`; $('#agentWall').appendChild(g);
      pick(r.agents[0]);
    }
    // tokens
    $('#tokens').hidden = false; countTo($('#tokTotal'), r.total, { f: v => fmt.usd(v) });
    $('#tokList').innerHTML = r.tokens.filter(h => h.amount > 0 || h.symbol === 'SOL').map(h => `<div class="h">${h.icon ? `<img src="${esc(h.icon)}" alt="" loading="lazy" onerror="this.outerHTML='<span class=ph>${esc(h.symbol.slice(0, 2))}</span>'">` : `<span class="ph">${esc(h.symbol.slice(0, 2))}</span>`}<div><b>${esc(h.symbol)}</b><small>${fmt.amt(h.amount)}${h.price ? ' · ' + fmt.usd(h.price, h.price < 1 ? 4 : 2) : ' · no price'}</small></div><div class="r">${h.usd != null ? fmt.usd(h.usd) : '—'}</div></div>`).join('');
    // other Core NFTs
    $('#other').hidden = !r.otherCount;
    if (r.otherCount) $('#otherList').innerHTML = `<p class="fine" style="margin:0 0 10px">${r.otherCount} other Metaplex Core NFT${r.otherCount > 1 ? 's' : ''} in this wallet that aren't agents.</p><div class="hold">${r.other.map(o => `<div class="h"><span class="ph">NFT</span><div><b>${esc(o.name)}</b><small>${esc(fmt.short(o.asset))}</small></div><a class="r" href="https://solscan.io/token/${o.asset}" target="_blank" rel="noopener" style="font-size:12px">view ↗</a></div>`).join('')}</div>`;
  }
  WL.on(load);
  connectButtons();
  WL.reconnect().then(() => { if (!WL.W.address) load(); });
  setTimeout(() => { if (!WL.W.address) stage.say('Connect Phantom or Solflare. I\'ll show you what you really hold.'); }, 800);
})();
