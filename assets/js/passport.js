// An agent's passport: its NFT, registry entry, wallet, rules and record, all read from Solana.
(() => {
  const { $, $$, esc, api, fmt, toast, copy, countTo } = I;
  const A = window.AgentPx, WL = window.Wallet;
  I.scam();
  A.paint($('#navmark'), { head: 'box', body: 'white', eyes: 'dots', eye: 'lime', top: 'ball', extra: 'card' }, { scale: 1, shadow: false, pose: 'still' });
  WL.button($('#walletBtn'));
  const asset = (location.pathname.match(/\/a\/([1-9A-HJ-NP-Za-km-z]{32,44})/) || [])[1] || new URLSearchParams(location.search).get('a');
  const S = { ag: null, chat: [], pane: 'talk', market: null, busy: false };
  const stage = Stage($('#stage'), { traits: A.fromSeed(asset || 'x') });
  const isOwner = () => S.ag && WL.W.address === S.ag.owner;
  const sol = h => h.find(x => x.symbol === 'SOL');

  if (!asset) { $('#pName').textContent = 'No agent'; $('#headMsg').innerHTML = '<div class="note bad">This link has no agent address in it. <a href="/#hall">Browse the hall →</a></div>'; return; }

  async function load(first) {
    const r = await api('agent?a=' + asset);
    if (!r.ok) {
      if (first && new URLSearchParams(location.search).get('new')) { $('#stName').textContent = 'Confirming…'; stage.say('Give Solana a second. I\'m being written down.'); setTimeout(() => load(true), 2500); return; }
      $('#pName').textContent = 'Not found'; $('#stName').textContent = 'Not found'; $('#stSub').textContent = fmt.short(asset);
      $('#headMsg').innerHTML = `<div class="note bad">${esc(r.msg || 'Could not read this agent.')}</div>`; return;
    }
    S.ag = r.agent; render(first);
  }
  function render(first) {
    const g = S.ag;
    document.title = g.name + ' · .nfa';
    stage.set(g.traits, first);
    $('#stName').textContent = g.name; $('#stSub').textContent = `1 in ${fmt.int(g.odds)} · ${g.made ? 'minted on .nfa' : 'external agent'}`;
    $('#stMax').textContent = '$' + g.rules.max; $('#stDay').textContent = `${g.tradesToday} / ${g.rules.daily}`;
    $('#stBal').textContent = fmt.usd(g.total);
    $('#pName').textContent = g.name;
    $('#badges').innerHTML = [
      g.registered ? '<span class="badge on">✓ Metaplex Agent Registry</span>' : '<span class="badge">Not in the Agent Registry</span>',
      '<span class="badge on">Metaplex Core</span>', g.made ? '<span class="badge">made on .nfa</span>' : '<span class="badge">external</span>',
      isOwner() ? '<span class="badge on">You own this</span>' : '',
    ].join('');
    $('#kv').innerHTML = [
      ['Agent (NFT)', g.asset, `https://solscan.io/token/${g.asset}`], ['Owner', g.owner, `https://solscan.io/account/${g.owner}`],
      ['Its wallet', g.wallet, `https://solscan.io/account/${g.wallet}`], ['Registry entry', g.registered ? g.identity : '—', g.registered ? `https://solscan.io/account/${g.identity}` : null],
    ].map(([k, v, u]) => `<div class="kv"><span>${k}</span><b>${esc(v)}</b>${u ? `<a href="${u}" target="_blank" rel="noopener">view ↗</a>` : '<span></span>'}</div>`).join('');
    // wallet
    countTo($('#total'), g.total, { f: v => fmt.usd(v) });
    $('#walletAddr').innerHTML = `${esc(fmt.short(g.wallet))} <button class="btn sm ghost" type="button" id="cpW" style="height:26px;padding:0 9px;font-size:11px">copy</button>`;
    $('#cpW').onclick = () => copy(g.wallet, 'Agent wallet copied');
    $('#hold').innerHTML = g.holdings.filter(h => h.amount > 0 || h.symbol === 'SOL').map(h => `<div class="h">${h.icon ? `<img src="${esc(h.icon)}" alt="" loading="lazy" onerror="this.outerHTML='<span class=ph>${esc(h.symbol.slice(0, 2))}</span>'">` : `<span class="ph">${esc(h.symbol.slice(0, 2))}</span>`}<div><b>${esc(h.symbol)}</b><small>${fmt.amt(h.amount)}${h.price ? ' · ' + fmt.usd(h.price, h.price < 1 ? 4 : 2) : ''}</small></div><div class="r">${h.usd != null ? fmt.usd(h.usd) : '—'}</div></div>`).join('')
      || '<div class="empty"><b>Empty wallet.</b>Send it some SOL to get started.</div>';
    $('#walletActs').innerHTML = isOwner() ? '<button class="btn" type="button" id="fundB">Fund it</button><button class="btn ghost" type="button" id="wdB">Withdraw to me</button>'
      : `<button class="btn ghost" type="button" id="fundB">Send it SOL</button>${WL.W.address ? '' : '<button class="btn ghost" type="button" id="connB">Connect the owner wallet</button>'}`;
    $('#fundB').onclick = () => moveModal('fund'); const wd = $('#wdB'); if (wd) wd.onclick = () => moveModal('withdraw'); const cb = $('#connB'); if (cb) cb.onclick = () => WL.picker();
    pane(S.pane);
    // activity
    const K = { mint: ['M', 'Minted'], fund: ['+', 'Funded'], withdraw: ['−', 'Withdrawn to owner'], trade: ['⇄', 'Traded'], rules: ['R', 'robots.txt rewritten'], transfer: ['→', 'Handed to a new owner'] };
    $('#acts').innerHTML = g.activity.length ? g.activity.map(x => { const k = K[x.kind] || ['•', 'Transaction']; return `<div class="act ${x.ok ? '' : 'bad'}"><span class="k">${k[0]}</span><span>${k[1]}${x.ok ? '' : ' (failed)'} <span style="color:var(--mute)">· ${fmt.ago(x.at)}</span></span><a href="https://solscan.io/tx/${x.sig}" target="_blank" rel="noopener">${fmt.short(x.sig)} ↗</a></div>`; }).join('')
      : '<div class="empty"><b>No activity yet.</b>Everything it does will show up here, straight from Solana.</div>';
    // record
    const site = location.origin;
    $('#rec').innerHTML = [
      ['robots.txt', `<a href="/api/meta?k=robots&a=${g.asset}" target="_blank" rel="noopener">${site}/api/meta?k=robots&a=${fmt.short(g.asset)}</a> · rules ${g.rulesOnChain ? 'stored on the NFT' : 'default (none on the NFT)'}${g.rulesByOwner ? ', owner-controlled' : ''}`],
      ['Metadata', `<a href="${esc(g.uri)}" target="_blank" rel="noopener">${esc(g.uri.length > 60 ? g.uri.slice(0, 58) + '…' : g.uri)}</a>`],
      ['Registration', g.registered ? `<a href="/api/meta?k=reg&a=${g.asset}" target="_blank" rel="noopener">registration file</a> on program <code>1DREG…B2p</code>` : 'Not registered with the Agent Registry.'],
      ['Traits', Object.entries(g.traits).map(([k, v]) => `<code>${k}: ${esc(v)}</code>`).join(' ')],
      ['Trade it', `<a href="https://www.tensor.trade/item/${g.asset}" target="_blank" rel="noopener">Tensor ↗</a> · <a href="https://magiceden.io/item-details/${g.asset}" target="_blank" rel="noopener">Magic Eden ↗</a> · the wallet goes with it`],
    ].map(([k, v]) => `<div><b>${k}</b><p>${v}</p></div>`).join('');
  }

  /* ---------- panes ---------- */
  const ownerOnly = what => `<div class="empty"><b>Only the owner can ${what}.</b>${WL.W.address ? 'The connected wallet doesn\'t own this agent.' : '<button class="btn sm" type="button" data-conn>Connect wallet</button>'}</div>`;
  function pane(p) {
    S.pane = p; $$('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.p === p));
    const el = $('#pane'), g = S.ag; $('#actMsg').innerHTML = '';
    if (p === 'talk') {
      el.innerHTML = `<div class="chat" id="chat">${(S.chat.length ? S.chat : [{ role: 'it', text: `Hi, I'm ${g.name}. Ask me what's in my wallet, what my rules let me do, or ask for a status note.` }]).map(m => `<div class="msg ${m.role === 'me' ? 'mine' : 'its'}">${esc(m.text)}</div>`).join('')}</div>
        <div class="ask"><input class="in" id="q" maxlength="300" placeholder="Ask ${esc(g.name)}…" aria-label="Message"><button class="btn" id="send" type="button">Send</button></div>
        <div class="chips2">${['Status note', 'What\'s in your wallet?', 'What can you trade?', 'What happens if I sell you?'].map(s => `<button type="button">${esc(s)}</button>`).join('')}</div>`;
      const go = async (text, report) => {
        text = (text || $('#q').value).trim(); if (!text && !report) return; $('#q').value = '';
        S.chat.push({ role: 'me', text: report ? 'Status note, please.' : text }); pane('talk'); stage.say('…', 0);
        const r = await api('chat', { a: asset, mode: report ? 'report' : 'chat', messages: S.chat });
        const reply = r.ok ? r.note : fallback(text, report);
        S.chat.push({ role: 'it', text: reply }); pane('talk'); stage.say(reply.length > 110 ? reply.slice(0, 108) + '…' : reply, 6000);
      };
      $('#send').onclick = () => go(); $('#q').onkeydown = e => { if (e.key === 'Enter') go(); };
      $('.chips2', el).onclick = e => { const b = e.target.closest('button'); if (!b) return; if (b.textContent === 'Status note') go('', true); else go(b.textContent); };
      const c = $('#chat'); c.scrollTop = c.scrollHeight; return;
    }
    if (p === 'trade') {
      if (!isOwner()) { el.innerHTML = ownerOnly('trade from its wallet'); bindConn(el); return; }
      const allow = g.rules.allow, have = s => { const h = g.holdings.find(x => x.symbol === s); return h ? h.amount : 0; };
      const from0 = allow.find(s => have(s) > 0) || allow[0], to0 = allow.find(s => s !== from0);
      el.innerHTML = `<div class="trade"><label class="field"><span>From</span><select class="in" id="tFrom">${allow.map(s => `<option ${s === from0 ? 'selected' : ''}>${s}</option>`).join('')}</select></label><button class="sw2" id="tSwap" type="button" aria-label="Swap direction">⇄</button><label class="field"><span>To</span><select class="in" id="tTo">${allow.map(s => `<option ${s === to0 ? 'selected' : ''}>${s}</option>`).join('')}</select></label></div>
        <label class="field" style="margin-top:12px"><span>Amount</span><input class="in mono" id="tAmt" inputmode="decimal" placeholder="0.0" autocomplete="off"></label>
        <div class="fine" id="tInfo"></div>
        <div class="acts2"><button class="btn" id="tGo" type="button">Check route</button></div>
        <p class="fine">Only tokens in its robots.txt appear here. Size and daily limits are checked before your wallet sees anything, then the swap is dry-run from inside the agent's wallet.</p>`;
      const info = async () => {
        const f = $('#tFrom').value, v = parseFloat($('#tAmt').value); const h = have(f);
        if (!S.market) { const m = await api('market'); if (m.ok) S.market = m.tokens; }
        const t = (S.market || []).find(x => x.symbol === f); const usd = t && t.price && v ? v * t.price : null;
        $('#tInfo').innerHTML = `Agent holds ${fmt.amt(h)} ${esc(f)} · ${usd != null ? `this is ${fmt.usd(usd)} of a $${g.rules.max} limit${usd > g.rules.max ? ' <b style="color:var(--red)">— over the limit</b>' : ''}` : 'enter an amount'} · ${g.tradesToday}/${g.rules.daily} trades today`;
      };
      $('#tAmt').oninput = info; $('#tFrom').onchange = info; $('#tSwap').onclick = () => { const a = $('#tFrom').value; $('#tFrom').value = $('#tTo').value; $('#tTo').value = a; info(); };
      $('#tGo').onclick = () => run({ op: 'trade', from: $('#tFrom').value, to: $('#tTo').value, amount: $('#tAmt').value }, $('#tGo'));
      info(); return;
    }
    if (p === 'rules') {
      if (!isOwner()) { el.innerHTML = `<div class="file"><div class="bar"><i></i><i></i><i></i><span>robots.txt</span></div><pre id="rtxt">loading…</pre></div>`; fetch(`/api/meta?k=robots&a=${asset}`).then(r => r.text()).then(t => { $('#rtxt').textContent = t; }); return; }
      const R = JSON.parse(JSON.stringify(g.rules)); const TOKS = ['SOL', 'USDC', 'JUP', 'cbBTC', 'ETH', 'BONK', 'WIF', 'JTO'];
      el.innerHTML = `<div class="ctl"><div class="range"><div class="top"><span>Max per trade</span><b id="rMaxV"></b></div><input type="range" id="rMax" min="5" max="500" step="5"></div>
        <div class="range"><div class="top"><span>Trades a day</span><b id="rDayV"></b></div><input type="range" id="rDay" min="1" max="20"></div>
        <div class="opt"><span>May touch</span><div class="tok" id="rTok">${TOKS.map(s => `<button type="button" data-s="${s}">${s}</button>`).join('')}</div></div>
        <div class="opt"><span>Style</span><div class="seg" id="rStyle">${['careful', 'steady', 'bold'].map(v => `<button type="button" data-v="${v}">${v[0].toUpperCase() + v.slice(1)}</button>`).join('')}</div></div></div>
        <div class="acts2"><button class="btn" id="rGo" type="button">Write to the NFT</button></div>`;
      const ui = () => { $('#rMax').value = R.max; $('#rMaxV').textContent = '$' + R.max; $('#rDay').value = R.daily; $('#rDayV').textContent = R.daily; $$('#rTok button').forEach(b => b.classList.toggle('on', R.allow.includes(b.dataset.s))); $$('#rStyle button').forEach(b => b.classList.toggle('on', b.dataset.v === R.style)); };
      $('#rMax').oninput = e => { R.max = +e.target.value; ui(); }; $('#rDay').oninput = e => { R.daily = +e.target.value; ui(); };
      $('#rTok').onclick = e => { const b = e.target.closest('button'); if (!b) return; const s = b.dataset.s; if (R.allow.includes(s)) { if (R.allow.length > 2) R.allow = R.allow.filter(x => x !== s); else toast('Keep at least two.'); } else R.allow.push(s); ui(); };
      $('#rStyle').onclick = e => { const b = e.target.closest('button'); if (b) { R.style = b.dataset.v; ui(); } };
      $('#rGo').onclick = () => run({ op: 'rules', rules: R }, $('#rGo'));
      ui(); return;
    }
    if (p === 'give') {
      if (!isOwner()) { el.innerHTML = ownerOnly('hand it over'); bindConn(el); return; }
      el.innerHTML = `<p style="margin:0 0 14px;color:var(--ink2)">Send ${esc(g.name)} to another wallet. Its wallet, balance, rules and history go with it, and you lose control of all of them.</p>
        <label class="field"><span>New owner</span><input class="in mono" id="gTo" placeholder="Solana wallet address" autocomplete="off"></label>
        <div class="acts2"><button class="btn" id="gGo" type="button">Check and hand over</button></div>`;
      $('#gGo').onclick = () => run({ op: 'transfer', to: $('#gTo').value.trim() }, $('#gGo'));
    }
  }
  const bindConn = el => { const b = el.querySelector('[data-conn]'); if (b) b.onclick = () => WL.picker(); };
  $('#tabs').onclick = e => { const b = e.target.closest('button'); if (b) pane(b.dataset.p); };

  function fallback(q, report) {
    const g = S.ag, s = sol(g.holdings);
    if (report) return `My wallet holds ${fmt.usd(g.total)}${s ? `, including ${fmt.amt(s.amount)} SOL` : ''}. robots.txt lets me trade ${g.rules.allow.join(', ')}, up to $${g.rules.max} a trade and ${g.rules.daily} a day; ${g.tradesToday} done today.\nSuggest: nothing today. (My AI voice is offline, so this is numbers only.)`;
    if (/sell|transfer|hand/i.test(q)) return 'If you sell me, the new owner gets me, my wallet, my balance, my rules and my history. Nothing to migrate.';
    if (/trade|can you/i.test(q)) return `I may trade ${g.rules.allow.join(', ')}, up to $${g.rules.max} a trade, ${g.rules.daily} trades a day. Use the Trade tab; you sign every one.`;
    return `My wallet holds ${fmt.usd(g.total)}. My AI voice is offline right now, so that's the numbers-only answer.`;
  }

  /* ---------- fund / withdraw ---------- */
  function moveModal(kind) {
    if (!WL.W.address) return WL.picker();
    const g = S.ag, box = document.createElement('div'); box.className = 'modal';
    const toks = kind === 'fund' ? ['SOL', 'USDC'] : g.holdings.filter(h => h.amount > 0).map(h => h.symbol);
    if (!toks.length) return toast('The agent\'s wallet is empty.');
    box.innerHTML = `<div class="sheet"><button class="x" aria-label="Close">×</button><h3>${kind === 'fund' ? `Send to ${esc(g.name)}` : 'Withdraw to you'}</h3>
      <label class="field"><span>Token</span><select class="in" id="mTok">${toks.map(s => `<option>${esc(s)}</option>`).join('')}</select></label>
      <label class="field"><span>Amount</span><input class="in mono" id="mAmt" inputmode="decimal" placeholder="0.0" autocomplete="off"></label>
      <div class="fine" id="mInfo"></div><button class="btn" id="mGo" type="button">${kind === 'fund' ? 'Check and send' : 'Check and withdraw'}</button><div id="mMsg"></div></div>`;
    document.body.appendChild(box); requestAnimationFrame(() => box.classList.add('on'));
    const shut = () => { box.classList.remove('on'); setTimeout(() => box.remove(), 200); };
    box.addEventListener('click', e => { if (e.target === box || e.target.closest('.x')) shut(); });
    const inf = () => { const s = $('#mTok', box).value, h = g.holdings.find(x => x.symbol === s); $('#mInfo', box).textContent = kind === 'withdraw' ? `The agent holds ${fmt.amt(h ? h.amount : 0)} ${s}${s === 'SOL' ? ' (0.001 SOL stays for rent)' : ''}.` : 'From your connected wallet.'; };
    $('#mTok', box).onchange = inf; inf();
    $('#mGo', box).onclick = async () => { const ok = await run({ op: kind, token: $('#mTok', box).value, amount: $('#mAmt', box).value }, $('#mGo', box), $('#mMsg', box)); if (ok) setTimeout(shut, 1200); };
  }

  /* ---------- the one path every action takes: build + dry run → sign → send → confirm ---------- */
  async function run(body, btn, msgEl = $('#actMsg')) {
    if (!WL.W.address) { WL.picker(); return false; }
    if (S.busy) return false; S.busy = true;
    const label = btn.textContent; btn.disabled = true; btn.innerHTML = '<span class="spin"></span> Dry run on mainnet…';
    msgEl.innerHTML = '';
    try {
      const r = await api('agent', { ...body, a: asset, owner: WL.W.address });
      if (!r.ok) throw new Error(r.msg);
      msgEl.innerHTML = `<div class="note info">Dry run passed: ${esc(r.what)}.${r.quote ? ` About ${fmt.amt(r.quote.out)} out, ${(r.quote.impact * 100).toFixed(2)}% price impact.` : ''} Sign in your wallet.</div>`;
      btn.innerHTML = '<span class="spin"></span> Waiting for your wallet…';
      let signed; try { signed = await WL.sign(r.tx); } catch { throw new Error('You didn\'t sign, so nothing happened.'); }
      btn.innerHTML = '<span class="spin"></span> Sending…';
      const sig = await WL.send(signed);
      btn.innerHTML = '<span class="spin"></span> Confirming…';
      const st = await WL.confirm(sig);
      if (st !== 'confirmed') throw new Error(st === 'failed' ? 'Solana rejected it after sending. Nothing moved.' : 'Still confirming; check Solscan in a minute.');
      msgEl.innerHTML = `<div class="note ok">Done: ${esc(r.what)}. <a href="https://solscan.io/tx/${sig}" target="_blank" rel="noopener">view ↗</a></div>`;
      stage.say({ trade: 'Trade done. Inside the rules.', fund: 'Thanks. Wallet topped up.', withdraw: 'Sent back to you.', rules: 'New robots.txt written onto me.', transfer: 'Off to a new owner. Bye!' }[body.op] || 'Done.');
      S.busy = false; btn.disabled = false; btn.textContent = label;
      setTimeout(() => load(false), 1500);
      return true;
    } catch (e) {
      msgEl.innerHTML = `<div class="note bad">${esc(e.message || 'Something went wrong.')}</div>`;
      if (/robots\.txt/.test(e.message)) stage.say('My robots.txt says no.');
    }
    S.busy = false; btn.disabled = false; btn.textContent = label;
    return false;
  }

  WL.on(() => { if (S.ag) render(false); });
  load(true);
  WL.reconnect();
  setInterval(() => { if (!document.hidden && !S.busy) load(false); }, 30000);
  setTimeout(() => S.ag && stage.say(`I'm ${S.ag.name}. ${isOwner() ? 'You own me.' : 'Say hi.'}`), 1200);
})();
