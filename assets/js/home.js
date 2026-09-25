// .nfa home: build an agent on the left, give it rules, mint it, browse the registry.
(() => {
  const { $, $$, esc, api, fmt, toast, store, countTo } = I;
  const A = window.AgentPx, WL = window.Wallet;
  I.scam(); I.reveal();
  A.paint($('#navmark'), { head: 'box', body: 'white', eyes: 'dots', eye: 'lime', top: 'ball', extra: 'card' }, { scale: 1, shadow: false, pose: 'still' });
  WL.button($('#walletBtn'));

  const saved = store.get('draft', null);
  const S = {
    traits: saved && saved.traits ? A.clean(saved.traits) : { head: 'box', body: 'white', eyes: 'dots', eye: 'lime', top: 'ball', extra: 'card' },
    rules: saved && saved.rules ? saved.rules : { max: 25, allow: ['SOL', 'USDC', 'JUP'], daily: 5, style: 'steady' },
    name: saved && saved.name || '', fund: 0, busy: false, market: null,
  };
  const stage = Stage($('#stage'), { traits: S.traits });
  const save = () => store.set('draft', { traits: S.traits, rules: S.rules, name: S.name });
  const LINES = {
    head: { box: 'Classic box. Solid choice.', tv: 'Telly head. I pick up signals.', pill: 'Pill head. Smooth operator.', dome: 'Dome. Aerodynamic thinking.', tall: 'Tall head. More room for rules.' },
    top: { ball: 'Antenna up.', twin: 'Two antennas, twice the signal.', ears: 'Ears on. I hear the market.', fin: 'The fin is for speed.', halo: 'A halo. Rare. I\'ll behave.', none: 'Bare. Minimalist.' },
    extra: { card: 'The 1/1 card: proof I\'m the only one.', scarf: 'Scarf on. It gets cold on-chain.', bowtie: 'Bow tie. Business agent.', phones: 'Headphones. Market noise, cancelled.' },
  };

  function paintStage(pop = true, line) {
    stage.set(S.traits, pop);
    $('#stName').textContent = S.name || 'Your agent';
    const o = A.odds(S.traits);
    $('#stOdds').textContent = '1 in ' + fmt.int(o); countTo($('#odds'), o, { f: v => fmt.int(Math.round(v)) });
    $('#stMax').textContent = '$' + S.rules.max; $('#stAllow').textContent = S.rules.allow.join(' ');
    if (line) stage.say(line);
    save(); robots(); summary();
  }

  /* ---------- 02 build ---------- */
  const GROUPS = [
    { k: 'head', t: 'Head', kind: 'seg' }, { k: 'body', t: 'Body', kind: 'sw', col: A.BODY }, { k: 'eyes', t: 'Eyes', kind: 'seg' },
    { k: 'eye', t: 'Eye colour', kind: 'sw', col: A.EYE }, { k: 'top', t: 'On top', kind: 'seg' }, { k: 'extra', t: 'Extra', kind: 'seg' },
  ];
  const rgb = c => `rgb(${c.join(',')})`;
  $('#opts').innerHTML = GROUPS.map(g => `<div class="opt rv" data-k="${g.k}"><span>${g.t}</span><div class="${g.kind}">${A.TRAITS[g.k].map(v => g.kind === 'sw'
    ? `<button type="button" data-v="${v}" title="${v}" aria-label="${g.t} ${v}" style="background:${rgb(g.col[v])}"></button>`
    : `<button type="button" data-v="${v}">${esc((A.LABEL[g.k] || {})[v] || v)}</button>`).join('')}</div></div>`).join('')
    + `<div class="opt rv"><span>Or</span><div class="seg"><button type="button" id="rand">Roll a random one</button></div></div>`;
  function marks() { GROUPS.forEach(g => $$(`.opt[data-k="${g.k}"] button`).forEach(b => b.classList.toggle('on', b.dataset.v === S.traits[g.k]))); }
  $('#opts').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.id === 'rand') { S.traits = A.fromSeed(Math.random().toString(36)); marks(); return paintStage(true, 'New me. How do I look?'); }
    const k = b.closest('.opt').dataset.k; S.traits[k] = b.dataset.v; marks();
    paintStage(true, (LINES[k] && LINES[k][b.dataset.v]) || (k === 'body' ? `${b.dataset.v[0].toUpperCase() + b.dataset.v.slice(1)} it is.` : k === 'eye' ? 'New eyes. Everything looks different.' : 'Noted.'));
  });
  marks(); $$('#opts .rv').forEach(el => el.classList.add('vis'));

  /* ---------- 03 robots.txt ---------- */
  const TOKS = ['SOL', 'USDC', 'JUP', 'cbBTC', 'ETH', 'BONK', 'WIF', 'JTO'];
  $('#ruleCtl').innerHTML = `
    <div class="range"><div class="top"><span>Max per trade</span><b id="rMaxV"></b></div><input type="range" id="rMax" min="5" max="500" step="5" aria-label="Max per trade in dollars"></div>
    <div class="range"><div class="top"><span>Trades a day</span><b id="rDayV"></b></div><input type="range" id="rDay" min="1" max="20" step="1" aria-label="Trades per day"></div>
    <div class="opt"><span>May touch</span><div class="tok" id="rTok">${TOKS.map(s => `<button type="button" data-s="${s}">${s}</button>`).join('')}</div></div>
    <div class="opt"><span>Style</span><div class="seg" id="rStyle"><button type="button" data-v="careful">Careful</button><button type="button" data-v="steady">Steady</button><button type="button" data-v="bold">Bold</button></div></div>`;
  function ruleUi() {
    $('#rMax').value = S.rules.max; $('#rMaxV').textContent = '$' + S.rules.max; $('#rDay').value = S.rules.daily; $('#rDayV').textContent = S.rules.daily;
    $$('#rTok button').forEach(b => b.classList.toggle('on', S.rules.allow.includes(b.dataset.s)));
    $$('#rStyle button').forEach(b => b.classList.toggle('on', b.dataset.v === S.rules.style));
  }
  $('#rMax').oninput = e => { S.rules.max = +e.target.value; ruleUi(); paintStage(false); };
  $('#rMax').onchange = () => stage.say(`Max $${S.rules.max} a trade. Written in stone. Well, in an NFT.`);
  $('#rDay').oninput = e => { S.rules.daily = +e.target.value; ruleUi(); paintStage(false); };
  $('#rDay').onchange = () => stage.say(`${S.rules.daily} trade${S.rules.daily > 1 ? 's' : ''} a day, max.`);
  $('#rTok').onclick = e => {
    const b = e.target.closest('button'); if (!b) return; const s = b.dataset.s;
    if (S.rules.allow.includes(s)) { if (S.rules.allow.length <= 2) return toast('Keep at least two tokens so it can trade between them.'); S.rules.allow = S.rules.allow.filter(x => x !== s); stage.say(`No ${s}. Got it.`); }
    else { S.rules.allow = [...S.rules.allow, s]; stage.say(`${s} is allowed now.`); }
    ruleUi(); paintStage(false);
  };
  $('#rStyle').onclick = e => { const b = e.target.closest('button'); if (!b) return; S.rules.style = b.dataset.v; ruleUi(); paintStage(false, { careful: 'Careful. Tight slippage, small moves.', steady: 'Steady. The sensible default.', bold: 'Bold. Wider slippage. Still inside the rules.' }[S.rules.style]); };
  function robots() {
    const n = (S.name || 'your-agent').replace(/\s+/g, '-').toLowerCase();
    $('#fileName').textContent = `robots.txt — ${S.name || 'your agent'}`;
    const L = [
      ['c', `# robots.txt for ${S.name || 'your agent'}`], ['c', '# a non-fungible agent. rules live on the NFT and move with it.'], ['', ''],
      ['k', 'User-agent: ', n], ...S.rules.allow.map(s => ['k', 'Allow: ', '/trade/' + s]), ['k', 'Disallow: ', '/trade/*'],
      ['k', 'Max-trade-usd: ', String(S.rules.max)], ['k', 'Max-trades-per-day: ', String(S.rules.daily)], ['k', 'Style: ', S.rules.style],
      ['k', 'Disallow: ', '/withdraw/*   # only the owner can move funds out'],
    ];
    $('#robots').innerHTML = L.map(([c, a, b]) => c === 'c' ? `<span class="c">${esc(a)}</span>` : c === 'k' ? `<span class="k">${esc(a)}</span><span class="v">${esc(b)}</span>` : '').join('\n');
  }
  ruleUi();

  /* ---------- 04 mint ---------- */
  const NAMES = ['Pixel', 'Nib', 'Ledger', 'Rook', 'Tally', 'Vesper', 'Moth', 'Dot', 'Kilo', 'Bit', 'Juno', 'Sprocket', 'Wren', 'Cobalt', 'Mint', 'Quill', 'Orbit', 'Pip'];
  $('#nameIn').value = S.name;
  $('#nameIn').oninput = e => { S.name = e.target.value.slice(0, 32); $('#stName').textContent = S.name || 'Your agent'; robots(); summary(); save(); };
  $('#nameIn').onchange = () => S.name && stage.say(`${S.name}. I like it.`);
  $('#rollName').onclick = () => { S.name = NAMES[Math.floor(Math.random() * NAMES.length)] + ' ' + String(Math.floor(Math.random() * 90) + 10); $('#nameIn').value = S.name; $('#stName').textContent = S.name; robots(); summary(); save(); stage.say(`${S.name}? Sure.`); };
  $('#fundSeg').onclick = e => { const b = e.target.closest('button'); if (!b) return; S.fund = +b.dataset.v; $$('#fundSeg button').forEach(x => x.classList.toggle('on', x === b)); summary(); if (S.fund) stage.say(`${S.fund} SOL to start. I'll keep it safe.`); };
  let quote = null;
  function summary(cost) {
    if (cost !== undefined) quote = cost;
    const t = S.traits, c = quote;
    $('#sum').innerHTML = [
      ['Name', esc(S.name || 'Agent ####')], ['Look', `${esc(A.LABEL.head[t.head])} · ${t.body} · ${esc(A.LABEL.eyes[t.eyes])}`],
      ['robots.txt', `$${S.rules.max} · ${S.rules.daily}/day · ${S.rules.allow.length} tokens`], ['Starts with', S.fund ? S.fund + ' SOL' : 'empty wallet'],
      ['Rent (Solana)', c ? c.rent.toFixed(5) + ' SOL' : '≈ 0.0052 SOL'], ['Total you pay', c ? c.total.toFixed(5) + ' SOL' : 'shown after the dry run'],
    ].map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join('');
  }
  summary();
  const mintBtn = $('#mintBtn');
  function mintLabel() { mintBtn.disabled = S.busy; mintBtn.textContent = WL.W.address ? 'Mint this agent' : 'Connect wallet to mint'; }
  WL.on(mintLabel); mintLabel();
  const STEPS = [['build', 'Build the transaction'], ['sim', 'Dry run on Solana mainnet'], ['sign', 'Sign in your wallet'], ['send', 'Send to Solana'], ['conf', 'Confirmed on-chain']];
  function steps(state, note = {}) {
    const el = $('#steps'); el.hidden = false;
    el.innerHTML = STEPS.map(([k, t], i) => { const s = state[k] || ''; return `<li class="${s}"><span class="s">${s === 'ok' ? '✓' : s === 'bad' ? '!' : i + 1}</span><span>${t}</span><small>${esc(note[k] || '')}</small></li>`; }).join('');
  }
  mintBtn.onclick = async () => {
    if (!WL.W.address) return WL.picker();
    if (S.busy) return; S.busy = true; mintLabel(); $('#mintMsg').innerHTML = '';
    const st = { build: 'run' }, note = {}; steps(st, note);
    try {
      const r = await api('mint', { owner: WL.W.address, name: S.name, traits: S.traits, rules: S.rules, fund: S.fund });
      if (!r.ok) { st.build = r.reason === 'sim' ? 'ok' : 'bad'; if (r.reason === 'sim') st.sim = 'bad'; steps(st, note); if (r.cost) summary(r.cost); throw new Error(r.msg); }
      st.build = 'ok'; st.sim = 'ok'; note.sim = `${fmt.int(r.sim.units)} compute units · ${r.size} bytes`; st.sign = 'run'; summary(r.cost); steps(st, note);
      stage.say('Dry run passed. Your wallet will ask you to sign.');
      let signed; try { signed = await WL.sign(r.tx); } catch (e) { st.sign = 'bad'; steps(st, note); throw new Error('You didn\'t sign, so nothing happened. No SOL was spent.'); }
      st.sign = 'ok'; st.send = 'run'; steps(st, note);
      const sig = await WL.send(signed); st.send = 'ok'; note.send = fmt.short(sig); st.conf = 'run'; steps(st, note);
      const res = await WL.confirm(sig);
      if (res !== 'confirmed') { st.conf = res === 'failed' ? 'bad' : 'run'; steps(st, note); throw new Error(res === 'failed' ? 'Solana rejected it after sending. Nothing was minted.' : 'Still confirming. Check it on Solscan in a minute.'); }
      st.conf = 'ok'; steps(st, note);
      store.set('mine', [...new Set([r.asset, ...store.get('mine', [])])].slice(0, 50));
      stage.say(`I exist! ${r.name}, one of one.`, 6000);
      $('#mintMsg').innerHTML = `<div class="note ok"><b>${esc(r.name)} is minted.</b> Its wallet: <span class="mono">${esc(fmt.short(r.wallet))}</span>. <a href="/a/${r.asset}">Open its passport →</a> · <a href="https://solscan.io/tx/${sig}" target="_blank" rel="noopener">transaction ↗</a></div>`;
      setTimeout(() => { location.href = '/a/' + r.asset + '?new=1'; }, 2600);
    } catch (e) {
      $('#mintMsg').innerHTML = `<div class="note bad">${esc(e.message || 'Something went wrong.')}</div>`;
      stage.say('Not this time. Nothing was spent unless it says so.');
    }
    S.busy = false; mintLabel();
  };

  /* ---------- 05 registry ---------- */
  let view = 'here';
  function card(x) {
    const c = document.createElement('a'); c.className = 'ag'; c.href = '/a/' + x.asset;
    c.innerHTML = `<canvas></canvas><b>${esc(x.name)}</b><small>${esc(fmt.short(x.owner))}${x.at ? ' · ' + fmt.ago(x.at) : ''}</small>${x.made ? '' : '<span class="ext">EXTERNAL</span>'}`;
    A.paint(c.querySelector('canvas'), x.traits, { scale: 2, shadow: false, pose: 'still' });
    return c;
  }
  async function loadWall(opts = {}) {
    const wall = $('#wall'); wall.innerHTML = '<div class="empty"><span class="spin"></span></div>';
    let r;
    if (view === 'mine') {
      if (!WL.W.address) { wall.innerHTML = '<div class="empty"><b>Connect a wallet</b>to see the agents it owns.</div>'; return; }
      r = await api('registry?v=here&owner=' + WL.W.address);
    } else if (opts.owner) r = await api(`registry?v=${view}&owner=${opts.owner}`);
    else r = await api('registry?v=' + view);
    if (!r.ok) { wall.innerHTML = `<div class="empty"><b>Couldn't read the chain.</b>${esc(r.msg || '')} <button class="btn sm ghost" type="button" id="retry">Retry</button></div>`; $('#retry').onclick = () => loadWall(opts); return; }
    if (!r.items.length) {
      wall.innerHTML = view === 'here' && !opts.owner ? `<div class="empty"><b>No agents minted here yet.</b>The first one on the wall could be yours. Mints are found through <a href="https://solscan.io/account/${r.anchor}" target="_blank" rel="noopener">the anchor address ↗</a>.</div>`
        : `<div class="empty"><b>Nothing found.</b>${opts.owner || view === 'mine' ? 'That wallet owns no agents minted here.' : 'No recent registrations came back.'}</div>`;
      return;
    }
    const g = document.createElement('div'); g.className = 'wall';
    r.items.slice(0, 48).forEach((x, i) => { const c = card(x); c.style.animationDelay = (i * 35) + 'ms'; g.appendChild(c); });
    wall.innerHTML = ''; wall.appendChild(g);
  }
  $('.tabs').onclick = e => { const b = e.target.closest('button'); if (!b) return; view = b.dataset.v; $$('.tabs button').forEach(x => x.classList.toggle('on', x === b)); loadWall(); };
  $('#lookBtn').onclick = async () => {
    const v = $('#lookIn').value.trim(); if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(v)) return toast('Paste a Solana address.');
    const r = await api('agent?a=' + v);
    if (r.ok) location.href = '/a/' + v; else loadWall({ owner: v });
  };
  $('#lookIn').onkeydown = e => { if (e.key === 'Enter') $('#lookBtn').click(); };
  WL.on(() => { if (view === 'mine') loadWall(); });
  const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { io.disconnect(); const m = location.hash.match(/owner=([1-9A-HJ-NP-Za-km-z]{32,44})/); if (m) { view = 'here'; loadWall({ owner: m[1] }); } else loadWall(); } }, { rootMargin: '300px' });
  io.observe($('#registry'));

  /* ---------- stage talks as you scroll ---------- */
  $$('.row[data-say]').forEach(r => r.addEventListener('mouseenter', () => stage.say(r.dataset.say)));
  const SAY = { top: 'Hi. I\'m a non-fungible agent. Scroll, I\'ll explain.', what: 'NFT, agent, wallet. All three.', build: 'Dress me up. Every pick changes the odds.', rules: 'Write my robots.txt. I follow it.', mint: 'One transaction and I\'m real.', registry: 'These are my cousins. All on-chain.', hood: 'No magic. Just Solana programs.', faq: 'Ask me anything. Well, read the answers.' };
  const links = $$('.nav .links a');
  let lastSec = '';
  const spy = new IntersectionObserver(es => {
    es.forEach(e => {
      if (!e.isIntersecting) return; const id = e.target.id;
      links.forEach(a => a.classList.toggle('on', a.getAttribute('href') === '#' + id));
      if (id !== lastSec && SAY[id]) { lastSec = id; stage.say(SAY[id]); }
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  $$('main > section[id]').forEach(s => spy.observe(s));

  paintStage(false);
  WL.reconnect();
  setTimeout(() => stage.say(SAY.top, 4200), 700);
})();
