// .nfa home, game edition: a character creator (look → rules → mint), a quest log and a hall of agents.
(() => {
  const { $, $$, esc, api, fmt, toast, store } = I;
  const A = window.AgentPx, WL = window.Wallet;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  I.reveal();
  A.paint($('#navmark'), { head: 'box', body: 'white', eyes: 'dots', eye: 'lime', top: 'ball', extra: 'card' }, { scale: 1, shadow: false, pose: 'still' });
  WL.button($('#walletBtn'));
  const logoUnit = () => innerWidth < 420 ? 7 : innerWidth < 1020 ? 8 : 9;
  I.logo($('#logo'), logoUnit());

  // quest icons: 12×12 bitmaps. # ink, o lime, w paper
  const ICONS = {
    nft: ['....####....', '....#..#....', '..########..', '..#oooooo#..', '..#ooo#oo#..', '..#oo##oo#..', '..#ooo#oo#..', '..#ooo#oo#..', '..#oo###o#..', '..#oooooo#..', '..########..', '............'],
    id: ['............', '############', '#wwwwwwwwww#', '#w###wwwwww#', '#w#o#w####w#', '#w###wwwwww#', '#wwwww###ww#', '#w###wwwwww#', '#wwwwwwwwww#', '############', '............', '............'],
    bag: ['............', '..########..', '.#wwwwwwww#.', '############', '#oooooooooo#', '#ooooooo####', '#oooooo#ww##', '#oooooo#w###', '#ooooooo####', '#oooooooooo#', '############', '............'],
    up: ['.........##.', '.........##.', '......##.##.', '......##.##.', '...##.##.##.', '...##.##.##.', 'oo.##.##.##.', 'oo.##.##.##.', 'oo.##.##.##.', 'oo.##.##.##.', '############', '............'],
    swap: ['............', '.......#....', '.......##...', '##########..', '.......##...', '.......#....', '....o.......', '...oo.......', '..oooooooooo', '...oo.......', '....o.......', '............'],
  };
  $$('canvas[data-ic]').forEach(c => {
    const B = ICONS[c.dataset.ic], u = 5; c.width = c.height = 12 * u; const g = c.getContext('2d');
    B.forEach((row, y) => [...row].forEach((ch, x) => { if (ch === '.') return; g.fillStyle = ch === '#' ? '#111113' : ch === 'o' ? '#c8f24a' : '#fffdf7'; g.fillRect(x * u, y * u, u, u); }));
  });

  // rarity tiers from the odds of the exact look (calibrated on 200k random rolls: ~50/25/15/8/2 %)
  const TIERS = [[20000, 'common'], [50000, 'uncommon'], [100000, 'rare'], [250000, 'epic'], [Infinity, 'legendary']];
  const tier = o => TIERS.find(([m]) => o < m)[1];

  const saved = store.get('draft', null);
  const S = {
    traits: saved && saved.traits ? A.clean(saved.traits) : { head: 'box', body: 'white', eyes: 'dots', eye: 'lime', top: 'ball', extra: 'card' },
    rules: saved && saved.rules ? saved.rules : { max: 25, allow: ['SOL', 'USDC', 'JUP'], daily: 5, style: 'steady' },
    name: saved && saved.name || '', fund: 0, busy: false,
  };
  const save = () => store.set('draft', { traits: S.traits, rules: S.rules, name: S.name });

  /* ---------- the hero agent: pixel agent on a pixel pedestal ---------- */
  const hero = $('.hero-agent'), cv = $('#agentCv'), ped = $('#pedestal'), bub = $('#bub');
  S.live = false; // mint switch, read from the server below
  let blink = false, bob = 0, wave = true, talkT = 0;
  const scale = () => innerWidth < 420 ? 5 : innerWidth < 1020 ? 6 : innerHeight < 760 ? 7 : 8;
  function paintAgent() {
    const s = scale();
    A.paint(cv, S.traits, { scale: s, blink, bob, pose: wave ? 'wave' : 'still', shadow: false });
    const feet = A.draw(S.traits, { pose: 'still' }).feet;
    cv.style.marginBottom = -((A.H - feet) * s + 3 * s) + 'px';
    paintPedestal(s);
  }
  function paintPedestal(s) {
    const w = 52, h = 11; if (ped.width !== w * s) { ped.width = w * s; ped.height = h * s; }
    const g = ped.getContext('2d'); g.imageSmoothingEnabled = false; g.clearRect(0, 0, ped.width, ped.height);
    const r = (x, y, ww, hh, c) => { g.fillStyle = c; g.fillRect(x * s, y * s, ww * s, hh * s); };
    const INK = '#111113', TOP = '#c8f24a', TOP2 = '#b4e02e', SIDE = '#e7e4db', SIDE2 = '#d6d2c6';
    // top face: a flattened disc with stepped corners
    r(8, 0, 36, 1, INK); r(4, 1, 4, 1, INK); r(44, 1, 4, 1, INK); r(2, 2, 2, 1, INK); r(48, 2, 2, 1, INK);
    r(8, 1, 36, 1, TOP); r(4, 2, 44, 1, TOP); r(1, 3, 1, 2, INK); r(50, 3, 1, 2, INK); r(2, 3, 48, 2, TOP);
    r(4, 3, 6, 1, TOP2); r(42, 3, 6, 1, TOP2);
    r(2, 5, 48, 1, INK);
    // the side
    r(1, 5, 1, 3, INK); r(50, 5, 1, 3, INK); r(2, 6, 48, 2, SIDE); r(2, 6, 6, 2, SIDE2); r(44, 6, 6, 2, SIDE2);
    for (let x = 10; x < 42; x += 8) r(x, 6, 1, 2, SIDE2);
    r(2, 8, 2, 1, INK); r(48, 8, 2, 1, INK); r(4, 8, 44, 1, SIDE2); r(4, 9, 44, 1, INK);
    g.fillStyle = 'rgba(17,17,19,.08)'; g.fillRect(8 * s, 10 * s, 36 * s, s);
  }
  function pop() { if (reduce) return; hero.classList.remove('pop'); void hero.offsetWidth; hero.classList.add('pop'); }
  function say(text, ms = 3600) { if (!bub) return; bub.textContent = text; bub.classList.add('on'); clearTimeout(talkT); talkT = setTimeout(() => bub.classList.remove('on'), ms); }
  let tick = 0;
  if (!reduce) setInterval(() => {
    if (document.hidden) return; tick++; bob = tick % 2;
    if (tick % 7 === 0) { blink = true; setTimeout(() => { blink = false; paintAgent(); }, 160); }
    if (tick % 11 === 0) wave = !wave;
    paintAgent();
  }, 700);
  addEventListener('resize', () => { paintAgent(); sky.size(); I.logo($('#logo'), logoUnit()); });

  function rarity() {
    const o = A.odds(S.traits), t = tier(o), el = $('#rarity');
    el.className = 'rarity r-' + t;
    el.innerHTML = `<b>${t.toUpperCase()}</b><span>1 IN ${fmt.int(o)}</span>`;
  }
  function refresh(line, doPop = true) {
    paintAgent(); if (doPop) pop();
    rarity(); robots(); summary(); save(); if (window.__parts) window.__parts();
    if (line) say(line);
  }

  /* ---------- sky: drifting pixel clouds and a strip of ground, behind everything ---------- */
  const sky = (() => {
    const c = $('#sky'), g = c.getContext('2d'), P = 6; let W = 0, H = 0, clouds = [], sparks = [];
    const CL = ['#ebe8df', '#e4e0d5'];
    function cloud(x, y, k) { return { x, y, k, v: .02 + Math.random() * .03, parts: [[0, 2, 10 * k, 3], [2, 1, 6 * k, 1], [3 * k, 0, 3 * k, 1], [1, 5, 10 * k - 2, 1]] }; }
    function size() {
      W = Math.ceil(c.clientWidth / P); H = Math.ceil(c.clientHeight / P); c.width = W; c.height = H;
      clouds = []; const n = Math.max(4, Math.round(W / 40));
      for (let i = 0; i < n; i++) clouds.push(cloud(Math.random() * W, 4 + Math.random() * (H * .55), 1 + Math.round(Math.random() * 1.4)));
      sparks = Array.from({ length: Math.round(W / 26) }, () => ({ x: Math.random() * W, y: Math.random() * H * .7, t: Math.random() * 100 }));
      draw();
    }
    function draw() {
      g.clearRect(0, 0, W, H);
      for (const cl of clouds) {
        const x = Math.round(cl.x), y = Math.round(cl.y);
        g.fillStyle = CL[0]; cl.parts.slice(0, 3).forEach(([a, b, w, h]) => g.fillRect(x + a, y + b, w, h));
        g.fillStyle = CL[1]; const [a, b, w, h] = cl.parts[3]; g.fillRect(x + a, y + b, w, h);
      }
      for (const s of sparks) { const on = (s.t | 0) % 40 < 6; if (!on) continue; g.fillStyle = '#c8f24a'; g.fillRect(s.x | 0, (s.y | 0) - 1, 1, 3); g.fillRect((s.x | 0) - 1, s.y | 0, 3, 1); }
      // ground: grass line, tufts, dirt checker
      const gy = H - 4;
      g.fillStyle = '#111113'; g.fillRect(0, gy - 1, W, 1);
      g.fillStyle = '#c8f24a'; g.fillRect(0, gy, W, 1);
      for (let x = 0; x < W; x++) { if ((x * 7) % 11 === 0) { g.fillStyle = '#b4e02e'; g.fillRect(x, gy - 2, 1, 1); } }
      for (let y = gy + 1; y < H; y++) for (let x = (y % 2); x < W; x += 2) { g.fillStyle = '#e7e4db'; g.fillRect(x, y, 1, 1); }
    }
    let last = 0;
    function loop(t) {
      requestAnimationFrame(loop);
      if (document.hidden || t - last < 66) return; last = t;
      for (const cl of clouds) { cl.x += cl.v; if (cl.x > W + 4) { cl.x = -12 * cl.k; cl.y = 4 + Math.random() * (H * .55); } }
      for (const s of sparks) s.t += .5;
      draw();
    }
    size(); if (!reduce) requestAnimationFrame(loop);
    return { size };
  })();

  /* ---------- 1 · LOOK: ◀ value ▶ selectors ---------- */
  const GROUPS = [
    { k: 'head', t: 'HEAD' }, { k: 'body', t: 'BODY', col: A.BODY }, { k: 'eyes', t: 'EYES' },
    { k: 'eye', t: 'EYE COLOUR', col: A.EYE }, { k: 'top', t: 'ON TOP' }, { k: 'extra', t: 'EXTRA' },
  ];
  const LINES = {
    head: { box: 'Classic box. Solid choice.', tv: 'Telly head. I pick up signals.', pill: 'Pill head. Smooth operator.', dome: 'Dome. Aerodynamic thinking.', tall: 'Tall head. More room for rules.' },
    top: { ball: 'Antenna up.', twin: 'Two antennas, twice the signal.', ears: 'Ears on. I hear the market.', fin: 'The fin is for speed.', halo: 'A halo. Rare. I\'ll behave.', none: 'Bare. Minimalist.' },
    extra: { card: 'The 1/1 card: proof I\'m the only one.', scarf: 'Scarf on. It gets cold on-chain.', bowtie: 'Bow tie. Business agent.', phones: 'Headphones. Market noise, cancelled.' },
  };
  const rgb = c => `rgb(${c.join(',')})`;
  const cap = s => s[0].toUpperCase() + s.slice(1);
  const label = (k, v) => (A.LABEL[k] && A.LABEL[k][v]) || cap(v);
  $('#sel').innerHTML = GROUPS.map(g => `<div class="selrow" data-k="${g.k}"><span>${g.t}</span><button class="arw" type="button" data-d="-1" aria-label="Previous ${g.t.toLowerCase()}">◀</button><div class="val" aria-live="polite"></div><button class="arw" type="button" data-d="1" aria-label="Next ${g.t.toLowerCase()}">▶</button></div>`).join('');
  function selUi() {
    GROUPS.forEach(g => {
      const v = S.traits[g.k], list = A.TRAITS[g.k], i = list.indexOf(v);
      $(`.selrow[data-k="${g.k}"] .val`).innerHTML = `${g.col ? `<i style="background:${rgb(g.col[v])}"></i>` : ''}${esc(label(g.k, v))}<small>${i + 1}/${list.length}</small>`;
    });
  }
  $('#sel').addEventListener('click', e => {
    const b = e.target.closest('.arw'); if (!b) return;
    const k = b.closest('.selrow').dataset.k, list = A.TRAITS[k];
    const v = list[(list.indexOf(S.traits[k]) + +b.dataset.d + list.length) % list.length];
    S.traits[k] = v; selUi();
    refresh((LINES[k] && LINES[k][v]) || (k === 'body' ? `${cap(v)} it is.` : k === 'eye' ? 'New eyes. Everything looks different.' : 'Noted.'));
  });
  $('#rand').onclick = () => { S.traits = A.fromSeed(Math.random().toString(36)); selUi(); const t = tier(A.odds(S.traits)); refresh(t === 'legendary' || t === 'epic' ? `${t.toUpperCase()}! Keep me.` : 'New me. How do I look?'); };

  /* ---------- tabs ---------- */
  const TAB_SAY = { look: 'Dress me up. Every pick changes the odds.', rules: 'Write my robots.txt. I follow it.', mint: 'One transaction and I\'m real.' };
  function tab(t, talk = true) {
    $$('#panel .ptabs button').forEach(b => { const on = b.dataset.t === t; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
    $$('#panel .tab').forEach(p => { p.hidden = p.dataset.t !== t; });
    if (talk) say(TAB_SAY[t]);
    if (innerWidth < 1020 && talk) $('#panel').scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  }
  $('#panel .ptabs').onclick = e => { const b = e.target.closest('button'); if (b) tab(b.dataset.t); };
  $('#next1').onclick = () => tab('rules'); $('#back1').onclick = () => tab('look'); $('#next2').onclick = () => tab('mint');

  /* ---------- 2 · RULES ---------- */
  const TOKS = ['SOL', 'USDC', 'JUP', 'cbBTC', 'ETH', 'BONK', 'WIF', 'JTO'];
  $('#rTok').innerHTML = TOKS.map(s => `<button type="button" data-s="${s}">${s}</button>`).join('');
  function ruleUi() {
    const R = S.rules;
    $('#rMax').value = R.max; $('#rMaxV').textContent = '$' + R.max; $('#rMaxM').style.width = (R.max / 500 * 100) + '%';
    $('#rDay').value = R.daily; $('#rDayV').textContent = R.daily; $('#rDayM').style.width = (R.daily / 20 * 100) + '%';
    $$('#rTok button').forEach(b => b.classList.toggle('on', R.allow.includes(b.dataset.s)));
    $$('#rStyle button').forEach(b => b.classList.toggle('on', b.dataset.v === R.style));
  }
  $('#rMax').oninput = e => { S.rules.max = +e.target.value; ruleUi(); refresh(null, false); };
  $('#rMax').onchange = () => say(`Max $${S.rules.max} a trade. Written in stone. Well, in an NFT.`);
  $('#rDay').oninput = e => { S.rules.daily = +e.target.value; ruleUi(); refresh(null, false); };
  $('#rDay').onchange = () => say(`${S.rules.daily} trade${S.rules.daily > 1 ? 's' : ''} a day, max.`);
  $('#rTok').onclick = e => {
    const b = e.target.closest('button'); if (!b) return; const s = b.dataset.s;
    if (S.rules.allow.includes(s)) { if (S.rules.allow.length <= 2) return toast('Keep at least two tokens so it can trade between them.'); S.rules.allow = S.rules.allow.filter(x => x !== s); say(`No ${s}. Got it.`); }
    else { S.rules.allow = [...S.rules.allow, s]; say(`${s} is allowed now.`); }
    ruleUi(); refresh(null, false);
  };
  $('#rStyle').onclick = e => { const b = e.target.closest('button'); if (!b) return; S.rules.style = b.dataset.v; ruleUi(); refresh({ careful: 'Careful. Tight slippage, small moves.', steady: 'Steady. The sensible default.', bold: 'Bold. Wider slippage. Still inside the rules.' }[S.rules.style], false); };
  function robots() {
    const n = (S.name || 'your-agent').replace(/\s+/g, '-').toLowerCase();
    const L = [
      ['c', `# robots.txt for ${S.name || 'your agent'}`], ['c', '# rules live on the NFT and move with it'], ['', ''],
      ['k', 'User-agent: ', n], ...S.rules.allow.map(s => ['k', 'Allow: ', '/trade/' + s]), ['k', 'Disallow: ', '/trade/*'],
      ['k', 'Max-trade-usd: ', String(S.rules.max)], ['k', 'Max-trades-per-day: ', String(S.rules.daily)], ['k', 'Style: ', S.rules.style],
      ['k', 'Disallow: ', '/withdraw/*   # only the owner moves funds out'],
    ];
    $('#robots').innerHTML = L.map(([c, a, b]) => c === 'c' ? `<span class="c">${esc(a)}</span>` : c === 'k' ? `<span class="k">${esc(a)}</span><span class="v">${esc(b)}</span>` : '').join('\n');
  }

  /* ---------- 3 · MINT ---------- */
  const NAMES = ['Pixel', 'Nib', 'Ledger', 'Rook', 'Tally', 'Vesper', 'Moth', 'Dot', 'Kilo', 'Bit', 'Juno', 'Sprocket', 'Wren', 'Cobalt', 'Mint', 'Quill', 'Orbit', 'Pip'];
  $('#nameIn').value = S.name;
  $('#nameIn').oninput = e => { S.name = e.target.value.slice(0, 32); refresh(null, false); };
  $('#nameIn').onchange = () => S.name && say(`${S.name}. I like it.`);
  $('#rollName').onclick = () => { S.name = NAMES[Math.floor(Math.random() * NAMES.length)] + ' ' + (Math.floor(Math.random() * 90) + 10); $('#nameIn').value = S.name; refresh(`${S.name}? Sure.`, false); };
  $('#fundSeg').onclick = e => { const b = e.target.closest('button'); if (!b) return; S.fund = +b.dataset.v; $$('#fundSeg button').forEach(x => x.classList.toggle('on', x === b)); summary(); if (S.fund) say(`${S.fund} SOL to start. I'll keep it safe.`); };
  let quote = null;
  function summary(cost) {
    if (cost !== undefined) quote = cost;
    const t = S.traits, c = quote, o = A.odds(t);
    $('#sum').innerHTML = [
      ['NAME', esc(S.name || 'Agent ####')], ['RARITY', `${tier(o).toUpperCase()} · 1 in ${fmt.int(o)}`],
      ['LOOK', `${esc(label('head', t.head))} · ${esc(t.body)} · ${esc(label('eyes', t.eyes))}`], ['ROBOTS.TXT', `$${S.rules.max} · ${S.rules.daily}/day · ${S.rules.allow.length} tokens`],
      ['STARTS WITH', S.fund ? S.fund + ' SOL' : 'empty wallet'], ['YOU PAY', c ? c.total.toFixed(5) + ' SOL' : '≈ 0.006 SOL + fee'],
    ].map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join('');
  }
  const mintBtn = $('#mintBtn');
  const mintLabel = () => {
    mintBtn.disabled = S.busy || !S.live;
    mintBtn.textContent = !S.live ? 'MINT NOT LIVE YET' : S.busy ? '… WORKING' : WL.W.address ? '▶ MINT THIS AGENT' : '▶ CONNECT WALLET TO MINT';
    const w = $('#wrow');
    w.innerHTML = WL.W.address
      ? `<span class="on"><i></i>${esc(fmt.short(WL.W.address))}</span><button class="pbtn ghost sm" type="button" data-w="menu">Switch</button>`
      : `<span><i></i>Not connected</span><button class="pbtn sm" type="button" data-w="connect">Connect wallet</button>`;
  };
  $('#wrow').onclick = e => { const b = e.target.closest('[data-w]'); if (!b) return; b.dataset.w === 'connect' ? WL.picker() : $('#walletBtn').click(); };
  WL.on(() => { mintLabel(); if (WL.W.address) say('Wallet connected. Ready when you are.'); });
  const STEPS = [['build', 'Build the transaction'], ['sim', 'Dry run on Solana mainnet'], ['sign', 'Sign in your wallet'], ['send', 'Send to Solana'], ['conf', 'Confirmed on-chain']];
  function steps(state, note = {}) {
    const el = $('#steps'); el.hidden = false;
    el.innerHTML = STEPS.map(([k, t], i) => { const s = state[k] || ''; return `<li class="${s}"><span class="s">${s === 'ok' ? '✓' : s === 'bad' ? '!' : i + 1}</span><span>${t}</span><small>${esc(note[k] || '')}</small></li>`; }).join('');
  }
  async function mint() {
    if (S.busy) return; S.busy = true; mintLabel(); $('#mintMsg').innerHTML = '';
    const st = { build: 'run' }, note = {}; steps(st, note);
    try {
      const r = await api('mint', { owner: WL.W.address, name: S.name, traits: S.traits, rules: S.rules, fund: S.fund });
      if (!r.ok) { st.build = r.reason === 'sim' ? 'ok' : 'bad'; if (r.reason === 'sim') st.sim = 'bad'; steps(st, note); if (r.cost) summary(r.cost); throw new Error(r.msg); }
      st.build = 'ok'; st.sim = 'ok'; note.sim = `${fmt.int(r.sim.units)} CU · ${r.size} bytes`; st.sign = 'run'; summary(r.cost); steps(st, note);
      say('Dry run passed. Your wallet will ask you to sign.');
      let signed; try { signed = await WL.sign(r.tx); } catch { st.sign = 'bad'; steps(st, note); throw new Error('You didn\'t sign, so nothing happened. No SOL was spent.'); }
      st.sign = 'ok'; st.send = 'run'; steps(st, note);
      const sig = await WL.send(signed); st.send = 'ok'; note.send = fmt.short(sig); st.conf = 'run'; steps(st, note);
      const res = await WL.confirm(sig);
      if (res !== 'confirmed') { st.conf = res === 'failed' ? 'bad' : 'run'; steps(st, note); throw new Error(res === 'failed' ? 'Solana rejected it after sending. Nothing was minted.' : 'Still confirming. Check it on Solscan in a minute.'); }
      st.conf = 'ok'; steps(st, note);
      store.set('mine', [...new Set([r.asset, ...store.get('mine', [])])].slice(0, 50));
      say(`I exist! ${r.name}, one of one.`, 6000);
      $('#mintMsg').innerHTML = `<div class="note ok"><b>${esc(r.name)} is minted.</b> Its wallet: <span class="mono">${esc(fmt.short(r.wallet))}</span>. <a href="/a/${r.asset}">Open its passport →</a> · <a href="https://solscan.io/tx/${sig}" target="_blank" rel="noopener">transaction ↗</a></div>`;
      setTimeout(() => { location.href = '/a/' + r.asset + '?new=1'; }, 2600);
    } catch (e) {
      $('#mintMsg').innerHTML = `<div class="note bad">${esc(e.message || 'Something went wrong.')}</div>`;
      say('Not this time. Nothing was spent unless it says so.');
    }
    S.busy = false; mintLabel();
  }
    mintBtn.onclick = () => { if (!S.live) return; WL.W.address ? mint() : WL.picker(); };
  api('meta?k=site').then(r => {
    S.live = !!(r && r.ok && r.mintLive);
    $('#hMint').textContent = S.live ? 'LIVE' : 'NOT LIVE YET';
    $('#mintHint').textContent = S.live ? 'No .nfa fee. You pay Solana\'s rent for the NFT and its registry entry, plus the network fee. It\'s dry-run on mainnet first.'
      : 'Mint isn\'t live yet. Build your agent now; the draft stays saved in this browser. When mint opens, this button turns on.';
    mintLabel();
  });
  $('#navMint').onclick = e => { e.preventDefault(); tab('look', false); $('#create').scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' }); say(TAB_SAY.mint); };

  /* ---------- HALL ---------- */
  let view = 'all';
  function agx(x, i) {
    const o = A.odds(x.traits), t = tier(o);
    const c = document.createElement('a'); c.className = 'agx'; c.href = '/a/' + x.asset; c.style.animationDelay = (i * 35) + 'ms';
    c.innerHTML = `<canvas></canvas><i class="floor"></i><b>${esc(x.name)}</b><span class="rt r-${t}">${x.made ? t.toUpperCase() : 'EXTERNAL'}</span><small>${esc(fmt.short(x.owner))}${x.at ? ' · ' + fmt.ago(x.at) : ''}</small>`;
    A.paint(c.querySelector('canvas'), x.traits, { scale: 2, shadow: false, pose: 'still' });
    return c;
  }
  async function loadWall(opts = {}) {
    const wall = $('#wall'); wall.innerHTML = '<div class="empty"><span class="spin"></span></div>';
    const r = await api(`registry?v=${view}${opts.owner ? '&owner=' + opts.owner : ''}`);
    if (!r.ok) { wall.innerHTML = `<div class="empty"><b>Couldn't read the chain.</b>${esc(r.msg || '')} <button class="pbtn sm" type="button" id="retry">Retry</button></div>`; $('#retry').onclick = () => loadWall(opts); return; }
    if (!r.items.length) {
      wall.innerHTML = view === 'here' && !opts.owner ? `<div class="empty"><b>No agents minted here yet.</b>${S.live ? 'The first one in the hall could be yours.' : 'Mint on .nfa isn\'t live yet.'} Mints are found through <a href="https://solscan.io/account/${r.anchor}" target="_blank" rel="noopener">the anchor address ↗</a>.</div>`
        : view === 'here' ? `<div class="empty"><b>Nothing here yet.</b>Mint on .nfa isn't live yet.</div>`
        : `<div class="empty"><b>Nothing found.</b>${opts.owner ? 'That wallet owns no agents here.' : 'No recent registrations came back.'}</div>`;
      return;
    }
    const g = document.createElement('div'); g.className = 'hall';
    r.items.slice(0, 48).forEach((x, i) => g.appendChild(agx(x, i)));
    wall.innerHTML = ''; wall.appendChild(g);
  }
  $('#hallTabs').onclick = e => { const b = e.target.closest('button'); if (!b) return; view = b.dataset.v; $$('#hallTabs button').forEach(x => x.classList.toggle('on', x === b)); loadWall(); };
  $('#lookBtn').onclick = async () => {
    const v = $('#lookIn').value.trim(); if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(v)) return toast('Paste a Solana address.');
    const r = await api('agent?a=' + v);
    if (r.ok) location.href = '/a/' + v; else loadWall({ owner: v });
  };
  $('#lookIn').onkeydown = e => { if (e.key === 'Enter') $('#lookBtn').click(); };
  const io = new IntersectionObserver(es => {
    if (!es.some(e => e.isIntersecting)) return; io.disconnect();
    const m = location.hash.match(/owner=([1-9A-HJ-NP-Za-km-z]{32,44})/); loadWall(m ? { owner: m[1] } : {});
  }, { rootMargin: '300px' });
  io.observe($('#hall'));


  /* ---------- facts strip: math from the trait weights, plus one live read of the registry ---------- */
  const KEYS = Object.keys(A.TRAITS);
  const LOOKS = KEYS.reduce((n, k) => n * A.TRAITS[k].length, 1);
  const rarest = {}; KEYS.forEach(k => { const w = A.WEIGHT[k]; rarest[k] = A.TRAITS[k][w.indexOf(Math.min(...w))]; });
  $('#hLooks').textContent = fmt.int(LOOKS);
  $('#hRare').textContent = '1 in ' + fmt.int(A.odds(rarest));
  api('registry?v=all').then(r => { const t = r && r.ok && r.items.length ? Math.max(...r.items.map(x => x.at || 0)) : 0; $('#hReg').textContent = t ? fmt.ago(t) : '—'; });

  /* ---------- parts: every trait value with its drop rate; tap to put it on ---------- */
  const PG = [['head', 'HEAD'], ['body', 'BODY'], ['eyes', 'EYES'], ['eye', 'EYE COLOUR'], ['top', 'ON TOP'], ['extra', 'EXTRA']];
  let pk = 'head';
  $('#partTabs').innerHTML = PG.map(([k, t]) => `<button type="button" data-k="${k}" class="${k === pk ? 'on' : ''}">${t}</button>`).join('');
  const rate = (k, v) => { const w = A.WEIGHT[k], i = A.TRAITS[k].indexOf(v); return w[i] / w.reduce((a, b) => a + b, 0); };
  const rtier = p => p < .06 ? 'legendary' : p < .1 ? 'epic' : p < .15 ? 'rare' : p < .25 ? 'uncommon' : 'common';
  function parts() {
    const g = $('#partGrid'); g.innerHTML = '';
    A.TRAITS[pk].forEach((v, i) => {
      const t = { ...S.traits, [pk]: v }, p = rate(pk, v), on = S.traits[pk] === v;
      const el = document.createElement('button'); el.type = 'button'; el.className = 'agx part' + (on ? ' on' : ''); el.style.animationDelay = (i * 30) + 'ms';
      el.innerHTML = `<canvas></canvas><i class="floor"></i><b>${esc(label(pk, v))}</b><span class="rt r-${rtier(p)}">${(p * 100).toFixed(1)}% DROP</span><small>${on ? 'EQUIPPED' : 'TAP TO EQUIP'}</small>`;
      A.paint(el.querySelector('canvas'), t, { scale: 2, shadow: false, pose: 'still' });
      el.onclick = () => { S.traits[pk] = v; selUi(); refresh(); parts(); tab('look', false); $('#create').scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' }); };
      g.appendChild(el);
    });
  }
  $('#partTabs').onclick = e => { const b = e.target.closest('button'); if (!b) return; pk = b.dataset.k; $$('#partTabs button').forEach(x => x.classList.toggle('on', x === b)); parts(); };
  // share of all random rolls that land in each tier (exact, over all 43,200 looks)
  const share = {};
  (function rec(i, t, p) {
    if (i === KEYS.length) { const o = A.odds(t.eye === 'lime' && t.body === 'lime' ? { ...t, eye: 'white' } : t); const k = tier(o); share[k] = (share[k] || 0) + p; return; }
    const k = KEYS[i]; A.TRAITS[k].forEach(v => rec(i + 1, { ...t, [k]: v }, p * rate(k, v)));
  })(0, {}, 1);
  const RANGE = { common: 'under 1 in 20,000', uncommon: '1 in 20k – 50k', rare: '1 in 50k – 100k', epic: '1 in 100k – 250k', legendary: '1 in 250,000+' };
  $('#tiers').innerHTML = `<div class="th">RARITY TIERS<small>share of random rolls</small></div>` + TIERS.map(([, t]) => `<div class="tr r-${t}"><b>${t.toUpperCase()}</b><span class="bar2"><i style="width:${Math.max(2, share[t] * 100 / .5)}%"></i></span><em>${(share[t] * 100).toFixed(1)}%</em><small>${RANGE[t]}</small></div>`).join('');
  let partsKey = JSON.stringify(S.traits); parts();
  window.__parts = () => { const j = JSON.stringify(S.traits); if (j !== partsKey) { partsKey = j; parts(); } };

  /* ---------- nav highlight ---------- */
  const links = $$('.nav .links a');
  const spy = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) links.forEach(a => a.classList.toggle('on', a.getAttribute('href') === '#' + e.target.id)); }), { rootMargin: '-45% 0px -50% 0px' });
  $$('main > section[id]').forEach(s => spy.observe(s));

  selUi(); ruleUi(); summary(); mintLabel(); refresh(null, false);
  WL.reconnect();
  setTimeout(() => say('Hi. I\'m a non-fungible agent. Build me.', 4200), 700);
})();
