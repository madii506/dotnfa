// GET /api/registry?v=here  — agents minted on nfa (every mint touches the nfa anchor address, so the chain lists them)
// GET /api/registry?v=all   — the newest agents registered on Metaplex's Agent Registry by anyone on Solana
const L = require('./_lib');
const A = require('../assets/js/agentpx.js');
const cache = new Map();
async function assetsFrom(address, program, pos, limit) {
  const sigs = await L.rpc('getSignaturesForAddress', [address, { limit, commitment: 'confirmed' }]).catch(() => []);
  const ok = (sigs || []).filter(s => !s.err);
  const found = [];
  for (let i = 0; i < ok.length; i += 6) {
    const part = await Promise.all(ok.slice(i, i + 6).map(s => L.rpc('getTransaction', [s.signature, { encoding: 'json', maxSupportedTransactionVersion: 0, commitment: 'confirmed' }]).then(t => ({ s, t })).catch(() => null)));
    for (const x of part) {
      if (!x || !x.t) continue;
      const m = x.t.transaction.message, keys = [...m.accountKeys, ...((x.t.meta && x.t.meta.loadedAddresses && [...x.t.meta.loadedAddresses.writable, ...x.t.meta.loadedAddresses.readonly]) || [])];
      for (const ix of m.instructions) {
        if (keys[ix.programIdIndex] !== program) continue;
        const a = keys[ix.accounts[pos]]; if (a && !found.some(f => f.asset === a)) found.push({ asset: a, at: x.s.blockTime ? x.s.blockTime * 1000 : null, sig: x.s.signature });
        break;
      }
    }
  }
  return found;
}
module.exports = L.wrap(async (req, res) => {
  const q = L.query(req);
  const view = q.v === 'all' ? 'all' : 'here';
  L.limit('reg:' + L.ip(req), 40, 60000);
  const c = cache.get(view);
  let items;
  if (c && L.now() - c.at < 45000) items = c.v;
  else {
    const list = view === 'here' ? await assetsFrom(L.ANCHOR, L.CORE, 0, 60) : await assetsFrom(L.IDENTITY, L.IDENTITY, 1, 30);
    const nfts = await L.getAssets(list.map(x => x.asset));
    items = list.map(x => {
      const n = nfts[x.asset]; if (!n) return null;
      const made = /\/api\/meta\?a=/.test(n.uri || '');
      const traits = Object.keys(A.TRAITS).every(k => n.attrs[k]) ? A.clean(n.attrs) : A.fromSeed(x.asset);
      return { asset: x.asset, name: n.name, owner: n.owner, made, traits, rules: made ? L.rulesFromAttrs(n.attrs) : null, at: x.at, uri: n.uri };
    }).filter(Boolean);
    cache.set(view, { v: items, at: L.now() });
  }
  let out = items;
  if (q.owner) { const o = L.needAddr(q.owner, 'wallet'); out = items.filter(x => x.owner === o); }
  L.send(res, 200, { ok: true, view, count: out.length, items: out, anchor: L.ANCHOR, at: L.now() }, 'public, s-maxage=20');
});
