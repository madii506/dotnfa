// GET /api/inventory?owner=<wallet>[&known=a,b,c] — everything a wallet really holds, read from Solana:
// its agents (Metaplex Core NFTs that are nfa agents or registered on the Agent Registry), its other Core NFTs,
// and its tokens with live prices. Read-only; nothing to sign.
const L = require('./_lib');
const A = require('../assets/js/agentpx.js');
const { holdings } = require('./agent');
const cache = new Map();

// all Core assets owned by a wallet: one filtered program scan (key = AssetV1, owner at byte 1)
async function ownedCore(owner) {
  const r = await L.rpcRaw('getProgramAccounts', [L.CORE, { encoding: 'base64', commitment: 'confirmed', filters: [{ memcmp: { offset: 0, bytes: '2' } }, { memcmp: { offset: 1, bytes: owner } }] }]);
  if (r.error || !Array.isArray(r.result)) return null;
  return r.result.map(x => L.decodeAsset(x.pubkey, x.account)).filter(Boolean);
}
// fallback when the RPC refuses a program scan: recent nfa mints plus any addresses this browser remembers
async function fallback(owner, known) {
  const sigs = await L.rpc('getSignaturesForAddress', [L.ANCHOR, { limit: 200, commitment: 'confirmed' }]).catch(() => []);
  const addrs = new Set(known);
  for (let i = 0; i < Math.min(sigs.length, 60); i += 6) {
    const part = await Promise.all(sigs.slice(i, i + 6).filter(s => !s.err).map(s => L.rpc('getTransaction', [s.signature, { encoding: 'json', maxSupportedTransactionVersion: 0, commitment: 'confirmed' }]).catch(() => null)));
    for (const t of part) { if (!t) continue; const m = t.transaction.message; const ix = m.instructions.find(x => m.accountKeys[x.programIdIndex] === L.CORE); if (ix) addrs.add(m.accountKeys[ix.accounts[0]]); }
  }
  const got = await L.getAssets([...addrs]);
  return Object.values(got).filter(n => n && n.owner === owner);
}

module.exports = L.wrap(async (req, res) => {
  const q = L.query(req);
  const owner = L.needAddr(q.owner, 'wallet');
  const known = String(q.known || '').split(',').map(s => s.trim()).filter(L.isAddr).slice(0, 30);
  L.limit('inv:' + L.ip(req), 30, 60000);
  const c = cache.get(owner);
  if (c && L.now() - c.at < 10000 && !known.length) return L.send(res, 200, c.v);
  let nfts = await ownedCore(owner).catch(() => null), source = 'program scan';
  if (!nfts) { nfts = await fallback(owner, known); source = 'recent nfa mints'; }
  const agents = [], other = [];
  for (const n of nfts) {
    const made = /\/api\/meta\?a=/.test(n.uri || '');
    if (!made && !n.identity) { other.push({ asset: n.address, name: n.name }); continue; }
    const traits = Object.keys(A.TRAITS).every(k => n.attrs[k]) ? A.clean(n.attrs) : A.fromSeed(n.address);
    agents.push({ asset: n.address, name: n.name, made, registered: n.identity, traits, odds: A.odds(traits), rules: L.rulesFromAttrs(n.attrs), wallet: L.signerPda(n.address) });
  }
  const bag = await holdings(owner);
  const v = { ok: true, owner, source, agents, other: other.slice(0, 40), otherCount: other.length, tokens: bag.list, total: bag.total, at: L.now() };
  cache.set(owner, { v, at: L.now() }); if (cache.size > 200) cache.clear();
  L.send(res, 200, v);
});
