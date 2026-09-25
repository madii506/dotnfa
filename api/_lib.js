// .nfa server library: http helpers, Solana RPC, Jupiter, Metaplex Core + Agent Registry transaction building.
// Nothing here holds a user's keys. The only key the server ever touches is the brand-new asset keypair,
// which signs the one create instruction and is then thrown away.
const CFG = require('./_config');
const MOCK = () => globalThis.__NFA_MOCK || null;
const now = () => Date.now();

function send(res, code, obj, cache = 'no-store') {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', cache);
  res.end(JSON.stringify(obj));
}
async function body(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch { return {}; } }
  const chunks = []; let size = 0;
  for await (const c of req) { size += c.length; if (size > 200000) break; chunks.push(c); }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); } catch { return {}; }
}
function query(req) { if (req.query) return req.query; return Object.fromEntries(new URL(req.url, 'http://x').searchParams); }
function ip(req) { const h = req.headers || {}; return String(h['x-real-ip'] || (h['x-forwarded-for'] || '').split(',')[0] || '0').trim(); }
function origin(req) {
  const h = req.headers || {}; const host = h['x-forwarded-host'] || h.host || 'localhost';
  const proto = h['x-forwarded-proto'] || (/^(localhost|127\.)/.test(host) ? 'http' : 'https');
  return CFG.origin || `${proto}://${host}`;
}
class Fail extends Error { constructor(reason, msg, code = 400, extra) { super(msg); this.reason = reason; this.code = code; this.extra = extra; } }
function wrap(fn) {
  return async (req, res) => {
    try { await fn(req, res); }
    catch (e) {
      if (e instanceof Fail) return send(res, e.code, { ok: false, reason: e.reason, msg: e.message, ...(e.extra || {}) });
      console.error('[nfa]', e && e.stack || e);
      return send(res, 500, { ok: false, reason: 'server', msg: 'Something broke on our side. Try again in a minute.', detail: String(e && e.message || e).slice(0, 240) });
    }
  };
}
const hits = new Map();
function limit(key, max, ms) {
  if (MOCK() && MOCK().nolimit) return;
  const t = now(), arr = (hits.get(key) || []).filter(x => t - x < ms);
  if (arr.length >= max) throw new Fail('slow_down', 'Too many requests. Wait a few seconds.', 429);
  arr.push(t); hits.set(key, arr); if (hits.size > 5000) hits.clear();
}
const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function b58len(s) {
  if (typeof s !== 'string' || !s || s.length > 64) return -1;
  let b = [0];
  for (const ch of s) { const v = B58.indexOf(ch); if (v < 0) return -1; let c = v; for (let i = 0; i < b.length; i++) { c += b[i] * 58; b[i] = c & 255; c >>= 8; } while (c) { b.push(c & 255); c >>= 8; } }
  for (const ch of s) { if (ch === '1') b.push(0); else break; }
  return b.length;
}
const isAddr = s => b58len(String(s || '').trim()) === 32;
const needAddr = (s, what = 'address') => { s = String(s || '').trim(); if (!isAddr(s)) throw new Fail('bad_address', `That isn't a valid Solana ${what}.`); return s; };

async function getJson(url, opt = {}, ms = 9000) {
  const m = MOCK(); if (m && m.fetch) return m.fetch(url, opt);
  const r = await fetch(url, { ...opt, signal: AbortSignal.timeout(ms) });
  const text = await r.text();
  let j = null; try { j = JSON.parse(text); } catch {}
  if (!r.ok) { const e = new Error('http ' + r.status + ' ' + url.split('?')[0]); e.status = r.status; e.body = j || text.slice(0, 300); throw e; }
  return j;
}

/* Solana RPC. Transport problems fall through to the next endpoint; an answer with an RPC error is returned as-is. */
const RPCS = () => [process.env.RPC_URL, 'https://solana-rpc.publicnode.com', 'https://api.mainnet-beta.solana.com'].filter(Boolean);
async function rpcRaw(method, params = []) {
  const m = MOCK(); if (m && m.rpc) { try { return { result: await m.rpc(method, params) }; } catch (e) { return { error: { message: e.message } }; } }
  let last;
  for (const u of RPCS()) {
    try {
      const j = await getJson(u, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) }, 12000);
      if (j && j.error && /rate|limit|too many|busy|timeout|unavailable|forbidden/i.test(j.error.message || '')) { last = j.error; continue; }
      return j;
    } catch (e) { last = e; }
  }
  throw new Fail('rpc_down', 'Solana is busy right now. Try again in a moment.', 502);
}
async function rpc(method, params = []) {
  const j = await rpcRaw(method, params);
  if (j.error) { const e = new Fail('rpc', j.error.message || 'RPC error', 502); e.data = j.error.data; throw e; }
  return j.result;
}

/* Jupiter */
const JUP = ['https://lite-api.jup.ag', 'https://api.jup.ag'];
async function jup(path, opt = {}) {
  let last;
  for (const h of JUP) {
    const o = { ...opt };
    if (h.includes('//api.') && process.env.JUP_API_KEY) o.headers = { ...(opt.headers || {}), 'x-api-key': process.env.JUP_API_KEY };
    try { return await getJson(h + path, o, 12000); } catch (e) { last = e; if (e.status && e.status < 500 && ![401, 403, 404, 429].includes(e.status)) throw e; }
  }
  throw last || new Error('jupiter unreachable');
}

const SOL = 'So11111111111111111111111111111111111111112';
const USDC = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
// the tokens an agent may be allowed to touch (robots.txt picks from these)
const TOKENS = [
  { mint: SOL, symbol: 'SOL', name: 'Solana', decimals: 9 },
  { mint: USDC, symbol: 'USDC', name: 'USD Coin', decimals: 6 },
  { mint: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN', symbol: 'JUP', name: 'Jupiter', decimals: 6 },
  { mint: 'cbbtcf3aa214zXHbiAZQwf4122FBYbraNdFqgw4iMij', symbol: 'cbBTC', name: 'Coinbase Wrapped BTC', decimals: 8 },
  { mint: '7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs', symbol: 'ETH', name: 'Ether (Portal)', decimals: 8 },
  { mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', symbol: 'BONK', name: 'Bonk', decimals: 5 },
  { mint: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm', symbol: 'WIF', name: 'dogwifhat', decimals: 6 },
  { mint: 'jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL', symbol: 'JTO', name: 'Jito', decimals: 9 },
];
const BY_SYM = Object.fromEntries(TOKENS.map(t => [t.symbol, t]));
const BY_MINT = Object.fromEntries(TOKENS.map(t => [t.mint, t]));

const priceCache = new Map();
async function prices(mints) {
  const out = {}, need = [];
  for (const m of mints) { const c = priceCache.get(m); if (c && now() - c.at < 30e3) out[m] = c.v; else need.push(m); }
  for (let i = 0; i < need.length; i += 50) {
    const chunk = need.slice(i, i + 50);
    try {
      const j = await jup('/price/v3?ids=' + chunk.join(','));
      for (const m of chunk) { const p = j && j[m]; if (p && p.usdPrice != null) { const v = { usd: Number(p.usdPrice), change24h: p.priceChange24h != null ? Number(p.priceChange24h) : null }; priceCache.set(m, { v, at: now() }); out[m] = v; } }
    } catch (e) { console.error('[price]', e.message); }
  }
  return out;
}
const metaCache = new Map();
async function tokenMeta(mints) {
  const out = {}, need = [];
  for (const m of mints) { if (BY_MINT[m]) { out[m] = { symbol: BY_MINT[m].symbol, name: BY_MINT[m].name, decimals: BY_MINT[m].decimals, icon: null }; } const c = metaCache.get(m); if (c && now() - c.at < 6 * 3600e3) out[m] = { ...out[m], ...c.v }; else need.push(m); }
  for (let i = 0; i < need.length; i += 90) {
    try {
      const arr = await jup('/tokens/v2/search?query=' + need.slice(i, i + 90).join(','));
      for (const t of arr || []) { const v = { symbol: t.symbol, name: t.name, icon: t.icon || null, decimals: t.decimals }; metaCache.set(t.id, { v, at: now() }); out[t.id] = { ...(out[t.id] || {}), ...v }; }
    } catch (e) { console.error('[meta]', e.message); }
  }
  return out;
}

/* ---------- Metaplex ---------- */
const CORE = 'CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d';
const IDENTITY = '1DREGFgysWYxLnRnKQnwrxnJQeSMk2HmGaC6whw2B2p';
const ANCHOR = CFG.anchor; // every .nfa mint touches this address with a 0-lamport transfer, so the registry can list them
let _umi = null;
function freshUmi() {
  const { createUmi } = require('@metaplex-foundation/umi-bundle-defaults');
  const { mplCore } = require('@metaplex-foundation/mpl-core');
  const { mplAgentIdentity } = require('@metaplex-foundation/mpl-agent-registry');
  const { mplToolbox } = require('@metaplex-foundation/mpl-toolbox');
  return createUmi('https://solana-rpc.publicnode.com').use(mplCore()).use(mplAgentIdentity()).use(mplToolbox());
}
function mx() { return _umi || (_umi = freshUmi()); }
// a Umi whose identity and payer is the user's wallet, as a signer that never signs here (the wallet signs later)
function umiFor(owner) {
  const { createNoopSigner, signerIdentity } = require('@metaplex-foundation/umi');
  const u = freshUmi(); const me = createNoopSigner(umiPk(owner)); u.use(signerIdentity(me)); return { umi: u, me };
}
const umiPk = s => require('@metaplex-foundation/umi').publicKey(s);
function signerPda(asset) { const { findAssetSignerPda } = require('@metaplex-foundation/mpl-core'); return String(findAssetSignerPda(mx(), { asset: umiPk(asset) })[0]); }
function identityPda(asset) { const { findAgentIdentityV1Pda } = require('@metaplex-foundation/mpl-agent-registry'); return String(findAgentIdentityV1Pda(mx(), { asset: umiPk(asset) })[0]); }

// read a Core asset straight from its account
function decodeAsset(address, acct) {
  if (!acct || acct.owner !== CORE) return null;
  const { deserializeAssetV1 } = require('@metaplex-foundation/mpl-core');
  const { lamports } = require('@metaplex-foundation/umi');
  const data = Buffer.from(acct.data[0], 'base64');
  if (data[0] !== 1) return null; // 1 = AssetV1
  try {
    const a = deserializeAssetV1({ publicKey: umiPk(address), data: new Uint8Array(data), executable: false, owner: umiPk(CORE), lamports: lamports(acct.lamports) });
    const attrs = {}; for (const x of (a.attributes && a.attributes.attributeList) || []) attrs[x.key] = x.value;
    const ua = a.updateAuthority || {};
    return { address, name: a.name, uri: a.uri, owner: String(a.owner), updateAuthority: ua.address ? String(ua.address) : null, collection: ua.type === 'Collection' ? String(ua.address) : null, attrs, attrAuthority: a.attributes ? a.attributes.authority && a.attributes.authority.type : null, identity: !!(a.agentIdentities && a.agentIdentities.length) };
  } catch (e) { console.error('[decode]', e.message); return null; }
}
async function getAssets(addresses) {
  const out = {};
  for (let i = 0; i < addresses.length; i += 100) {
    const chunk = addresses.slice(i, i + 100);
    const r = await rpc('getMultipleAccounts', [chunk, { encoding: 'base64', commitment: 'confirmed' }]);
    (r && r.value || []).forEach((acct, j) => { out[chunk[j]] = decodeAsset(chunk[j], acct); });
  }
  return out;
}

/* robots.txt: the rules live on the NFT as attributes, so they travel with it */
const STYLES = ['careful', 'steady', 'bold'];
function cleanRules(r = {}) {
  const allow = (Array.isArray(r.allow) ? r.allow : String(r.allow || '').split(',')).map(s => String(s).trim()).filter(s => BY_SYM[s]);
  return {
    max: Math.max(1, Math.min(10000, Math.round(Number(r.max) || 25))),
    allow: allow.length ? [...new Set(allow)] : ['SOL', 'USDC'],
    daily: Math.max(1, Math.min(50, Math.round(Number(r.daily) || 5))),
    style: STYLES.includes(r.style) ? r.style : 'steady',
  };
}
function rulesFromAttrs(a = {}) { return cleanRules({ max: a['robots.max_trade_usd'], allow: a['robots.allow'], daily: a['robots.daily_trades'], style: a['robots.style'] }); }
function attrList(traits, rules) {
  return [
    ...Object.entries(traits).map(([key, value]) => ({ key, value: String(value) })),
    { key: 'robots.max_trade_usd', value: String(rules.max) },
    { key: 'robots.allow', value: rules.allow.join(',') },
    { key: 'robots.daily_trades', value: String(rules.daily) },
    { key: 'robots.style', value: rules.style },
  ];
}
function robotsTxt(name, rules, asset) {
  return [
    `# robots.txt for ${name}`, `# a non-fungible agent. rules live on the NFT and move with it.`, `# asset: ${asset || '(not minted yet)'}`, '',
    'User-agent: ' + (name || 'agent').replace(/\s+/g, '-').toLowerCase(),
    ...rules.allow.map(s => `Allow: /trade/${s}`),
    'Disallow: /trade/*', `Max-trade-usd: ${rules.max}`, `Max-trades-per-day: ${rules.daily}`, `Style: ${rules.style}`,
    'Disallow: /withdraw/*   # only the owner can move funds out', '',
  ].join('\n');
}

/* build a transaction with Umi, return it as base64 for the wallet, plus a server-side simulation */
async function finish(builder, { payer, extraSigners = [], simulateAccounts = [], cuLimit = 200000, alts = [], memo = '' }) {
  const umi = mx();
  if (memo) { const { addMemo } = require('@metaplex-foundation/mpl-toolbox'); builder = builder.add(addMemo(umi, { memo })); }
  const { setComputeUnitLimit, setComputeUnitPrice } = require('@metaplex-foundation/mpl-toolbox');
  const { toWeb3JsTransaction } = require('@metaplex-foundation/umi-web3js-adapters');
  const { createNoopSigner } = require('@metaplex-foundation/umi');
  const pay = createNoopSigner(umiPk(payer));
  let b = builder.prepend(setComputeUnitPrice(umi, { microLamports: 60000 })).prepend(setComputeUnitLimit(umi, { units: cuLimit })).setFeePayer(pay);
  if (alts.length) b = b.setAddressLookupTables(alts);
  const bh = await rpc('getLatestBlockhash', [{ commitment: 'confirmed' }]);
  let tx = b.setBlockhash(bh.value.blockhash).build(umi);
  for (const s of extraSigners) tx = await s.signTransaction(tx);
  const w3 = toWeb3JsTransaction(tx);
  const bytes = w3.serialize();
  if (bytes.length > 1232) throw new Fail('too_big', `That transaction is ${bytes.length} bytes; Solana allows 1232. Try a simpler route.`);
  const b64 = Buffer.from(bytes).toString('base64');
  const sim = await simulate(b64, simulateAccounts);
  return { tx: b64, size: bytes.length, blockhash: bh.value.blockhash, lastValidBlockHeight: bh.value.lastValidBlockHeight, sim };
}
async function simulate(b64, accounts = []) {
  const j = await rpcRaw('simulateTransaction', [b64, { encoding: 'base64', sigVerify: false, replaceRecentBlockhash: true, commitment: 'confirmed', ...(accounts.length ? { accounts: { encoding: 'base64', addresses: accounts } } : {}) }]);
  if (j.error) return { ok: false, err: j.error.message, logs: [] };
  const v = j.result.value;
  return { ok: !v.err, err: v.err ? JSON.stringify(v.err) : null, units: v.unitsConsumed, logs: (v.logs || []).slice(-14), accounts: (v.accounts || []).map(a => a ? { lamports: a.lamports, owner: a.owner } : null) };
}
// plain-English reason for a failed simulation
function explain(sim) {
  const t = (sim.err || '') + ' ' + (sim.logs || []).join(' ');
  if (/insufficient lamports|InsufficientFundsForRent|0x1\b|insufficient funds/i.test(t)) return 'Not enough SOL for this. Top up and try again.';
  if (/AccountNotFound|could not find account/i.test(t)) return 'Your wallet has no SOL yet, so Solana can\'t pay the fee.';
  if (/slippage|0x1771|6001/i.test(t)) return 'The price moved too much while checking. Try again.';
  if (/exceeded CUs|compute/i.test(t)) return 'The route is too heavy to run from inside the agent. Try a smaller amount or SOL/USDC.';
  return 'Solana rejected this in the dry run, so nothing was sent. ' + (sim.err ? '(' + sim.err.slice(0, 120) + ')' : '');
}

module.exports = { umiFor, freshUmi, CFG, send, body, query, ip, origin, Fail, wrap, limit, isAddr, needAddr, getJson, rpc, rpcRaw, jup, SOL, USDC, TOKENS, BY_SYM, BY_MINT, prices, tokenMeta, CORE, IDENTITY, ANCHOR, mx, umiPk, signerPda, identityPda, decodeAsset, getAssets, cleanRules, rulesFromAttrs, attrList, robotsTxt, finish, simulate, explain, now, STYLES };
