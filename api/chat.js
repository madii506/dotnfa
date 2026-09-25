// POST /api/chat {a, messages, mode} — talk to an agent. It speaks from its own on-chain facts: name, traits,
// robots.txt, wallet and activity. mode 'report' writes a short status note with at most one suggested action.
// Uses the Vercel AI Gateway when the project has it; otherwise the page shows a numbers-only reply.
const L = require('./_lib');
const { readAgent } = require('./agent');
const MODELS = ['anthropic/claude-haiku-4.5', 'openai/gpt-4.1-mini', 'google/gemini-2.5-flash'];
const clean = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u001f]/g, ' ').slice(0, n);
module.exports = L.wrap(async (req, res) => {
  if (req.method !== 'POST') throw new L.Fail('method', 'POST only.', 405);
  L.limit('chat:' + L.ip(req), 20, 60000);
  const b = await L.body(req);
  const asset = L.needAddr(b.a, 'agent address');
  const ag = await readAgent(asset);
  if (!ag) throw new L.Fail('not_found', 'No agent at that address.', 404);
  const token = req.headers['x-vercel-oidc-token'] || process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN;
  const m = globalThis.__NFA_MOCK;
  if (!token && !(m && m.fetch)) return L.send(res, 200, { ok: false, reason: 'no_ai', msg: 'AI isn\'t switched on for this site yet.' });
  const px = await L.prices(L.TOKENS.map(t => t.mint));
  const facts = {
    name: ag.name, traits: ag.traits, oneIn: ag.odds, owner: ag.owner.slice(0, 4) + '…' + ag.owner.slice(-4), registeredWithMetaplex: ag.registered,
    robots: ag.rules, tradesToday: ag.tradesToday,
    wallet: { total_usd: +ag.total.toFixed(2), holdings: ag.holdings.slice(0, 8).map(h => ({ symbol: h.symbol, amount: +h.amount.toPrecision(6), usd: h.usd != null ? +h.usd.toFixed(2) : null })) },
    recent: ag.activity.slice(0, 6).map(x => ({ kind: x.kind || 'tx', ok: x.ok, ago_min: x.at ? Math.round((Date.now() - x.at) / 60000) : null })),
    prices: Object.fromEntries(L.TOKENS.filter(t => ag.rules.allow.includes(t.symbol)).map(t => [t.symbol, px[t.mint] ? { usd: px[t.mint].usd, change24h: px[t.mint].change24h } : null])),
  };
  const persona = `You are ${clean(ag.name, 32)}, a non-fungible agent: a small pixel robot that lives inside a Metaplex Core NFT on Solana, with its own wallet (a PDA only your owner can move money out of). Your look: ${ag.traits.head} head, ${ag.traits.body} body, ${ag.traits.eyes} eyes, ${ag.traits.top} on top, ${ag.traits.extra}. You are one of one (about 1 in ${ag.odds} looks). Your robots.txt: trade at most $${ag.rules.max} at a time, ${ag.rules.daily} trades a day, only ${ag.rules.allow.join(', ')}, style ${ag.rules.style}. If your owner sells the NFT, you, your wallet and your record go to the new owner.`;
  const rules = 'Use ONLY the facts given; never invent balances, prices, trades or news. Never promise profit. You cannot move money yourself: every trade is built on the site and signed by your owner. Plain English, short sentences, a little personality, no emojis.';
  const report = b.mode === 'report';
  const history = report ? [] : (Array.isArray(b.messages) ? b.messages : []).slice(-8).map(x => ({ role: x.role === 'me' ? 'user' : 'assistant', content: clean(x.text, 600) })).filter(x => x.content);
  const system = report
    ? `${persona} Write a status note to your owner in 3 to 5 short sentences: what is in your wallet, how the tokens you are allowed to trade moved today, and what robots.txt lets you do. End with one line starting "Suggest:" naming at most ONE trade that fits robots.txt (from, to, dollar size) or "Suggest: nothing today." ${rules} Facts (JSON): ${JSON.stringify(facts)}`
    : `${persona} Chat with your owner in 2 to 4 short sentences. ${rules} If they ask you to trade, say which tab on your page does it. Facts (JSON): ${JSON.stringify(facts)}`;
  for (const model of MODELS) {
    try {
      const messages = [{ role: 'system', content: system }, ...(history.length ? history : [{ role: 'user', content: report ? 'Status?' : 'Hi' }])];
      const j = await L.getJson('https://ai-gateway.vercel.sh/v1/chat/completions', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token }, body: JSON.stringify({ model, max_tokens: report ? 280 : 220, temperature: 0.6, messages }) }, 20000);
      const note = j && j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
      if (note) return L.send(res, 200, { ok: true, note: String(note).trim().slice(0, 1400), model, source: 'ai' });
    } catch (e) { console.error('[chat]', model, e.status || '', e.message); }
  }
  L.send(res, 200, { ok: false, reason: 'ai_down', msg: 'The agent\'s voice is offline for a minute.' });
});
