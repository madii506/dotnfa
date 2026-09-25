// GET  /api/agent?a=<asset>            — read one agent from chain: the NFT, its registry entry, its wallet, its activity.
// POST /api/agent {op, a, owner, ...}  — build (and dry-run) one owner action. Your wallet signs; nothing is sent here.
//   op: fund {token, amount} · withdraw {token, amount} · trade {from, to, amount} · rules {rules} · transfer {to}
const L = require('./_lib');
const A = require('../assets/js/agentpx.js');
const TOKEN = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA', T22 = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';
const JUP_PROGRAM = 'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4';
const cache = new Map();

async function holdings(wallet) {
  const opts = { encoding: 'jsonParsed', commitment: 'confirmed' };
  const [bal, a, b] = await Promise.all([
    L.rpc('getBalance', [wallet, { commitment: 'confirmed' }]),
    L.rpc('getTokenAccountsByOwner', [wallet, { programId: TOKEN }, opts]).catch(() => ({ value: [] })),
    L.rpc('getTokenAccountsByOwner', [wallet, { programId: T22 }, opts]).catch(() => ({ value: [] })),
  ]);
  const list = [{ mint: L.SOL, amount: ((bal && bal.value) || 0) / 1e9, decimals: 9, program: 'system' }];
  for (const [arr, prog] of [[a, TOKEN], [b, T22]]) for (const acc of (arr && arr.value) || []) {
    const info = acc.account && acc.account.data && acc.account.data.parsed && acc.account.data.parsed.info; if (!info) continue;
    const amt = Number(info.tokenAmount.uiAmountString || 0); if (info.tokenAmount.decimals === 0) continue;
    list.push({ mint: info.mint, amount: amt, decimals: info.tokenAmount.decimals, program: prog, account: acc.pubkey });
  }
  const mints = list.map(x => x.mint);
  const [meta, px] = await Promise.all([L.tokenMeta(mints), L.prices(mints)]);
  const out = list.filter(x => x.mint === L.SOL || x.amount > 0).map(x => {
    const m = meta[x.mint] || {}, p = px[x.mint];
    return { ...x, symbol: m.symbol || x.mint.slice(0, 4) + '…', name: m.name || 'Unknown token', icon: m.icon || null, price: p ? p.usd : null, usd: p ? x.amount * p.usd : null };
  }).sort((p, q) => (q.usd || 0) - (p.usd || 0));
  return { list: out, total: out.reduce((s, h) => s + (h.usd || 0), 0) };
}
async function activity(asset, wallet) {
  const [w, a] = await Promise.all([
    L.rpc('getSignaturesForAddress', [wallet, { limit: 20, commitment: 'confirmed' }]).catch(() => []),
    L.rpc('getSignaturesForAddress', [asset, { limit: 10, commitment: 'confirmed' }]).catch(() => []),
  ]);
  const seen = new Map();
  for (const s of [...(w || []), ...(a || [])]) if (!seen.has(s.signature)) seen.set(s.signature, s);
  return [...seen.values()].sort((x, y) => (y.blockTime || 0) - (x.blockTime || 0)).slice(0, 20).map(s => {
    const memo = String(s.memo || ''); const k = (memo.match(/nfa:(\w+)/) || [])[1] || null;
    return { sig: s.signature, at: s.blockTime ? s.blockTime * 1000 : null, ok: !s.err, kind: k };
  });
}
async function readAgent(asset) {
  const c = cache.get(asset); if (c && L.now() - c.at < 8000) return c.v;
  const wallet = L.signerPda(asset), identity = L.identityPda(asset);
  const r = await L.rpc('getMultipleAccounts', [[asset, identity], { encoding: 'base64', commitment: 'confirmed' }]);
  const [acct, idAcct] = (r && r.value) || [];
  const nft = L.decodeAsset(asset, acct);
  if (!nft) return null;
  const traitKeys = Object.keys(A.TRAITS);
  const hasTraits = traitKeys.every(k => nft.attrs[k]);
  const traits = hasTraits ? A.clean(nft.attrs) : A.fromSeed(asset);
  const rules = L.rulesFromAttrs(nft.attrs);
  const [hold, act] = await Promise.all([holdings(wallet), activity(asset, wallet)]);
  const dayAgo = L.now() - 864e5;
  const v = {
    asset, name: nft.name, uri: nft.uri, owner: nft.owner, updateAuthority: nft.updateAuthority, wallet, identity,
    registered: !!(idAcct && idAcct.owner === L.IDENTITY) || nft.identity, made: /\/api\/meta\?a=/.test(nft.uri || ''), native: hasTraits,
    traits, odds: A.odds(traits), rules, rulesOnChain: !!nft.attrs['robots.max_trade_usd'], rulesByOwner: nft.attrAuthority === 'Owner',
    holdings: hold.list, total: hold.total, activity: act, tradesToday: act.filter(x => x.kind === 'trade' && x.ok && x.at && x.at > dayAgo).length,
  };
  cache.set(asset, { v, at: L.now() }); if (cache.size > 300) cache.clear();
  return v;
}

/* ---------- owner actions ---------- */
async function ata(owner, mint, program = TOKEN) {
  const { findAssociatedTokenPda } = require('@metaplex-foundation/mpl-toolbox');
  return String(findAssociatedTokenPda(L.mx(), { owner: L.umiPk(owner), mint: L.umiPk(mint), tokenProgramId: L.umiPk(program) })[0]);
}
const ixFromJup = ix => ({ programId: L.umiPk(ix.programId), keys: ix.accounts.map(k => ({ pubkey: L.umiPk(k.pubkey), isSigner: k.isSigner, isWritable: k.isWritable })), data: new Uint8Array(Buffer.from(ix.data, 'base64')) });
async function loadAlts(addresses) {
  if (!addresses || !addresses.length) return [];
  const r = await L.rpc('getMultipleAccounts', [addresses, { encoding: 'base64', commitment: 'confirmed' }]);
  const out = [];
  (r.value || []).forEach((acct, i) => {
    if (!acct) return; const d = Buffer.from(acct.data[0], 'base64'); const addrs = [];
    for (let o = 56; o + 32 <= d.length; o += 32) addrs.push(L.umiPk(new Uint8Array(d.subarray(o, o + 32))));
    out.push({ publicKey: L.umiPk(addresses[i]), addresses: addrs });
  });
  return out;
}

async function build(req, b) {
  const op = String(b.op || '');
  const asset = L.needAddr(b.a, 'agent address');
  const owner = L.needAddr(b.owner, 'wallet');
  const ag = await readAgent(asset);
  if (!ag) throw new L.Fail('not_found', 'No agent at that address.', 404);
  if (op !== 'fund' && ag.owner !== owner) throw new L.Fail('not_owner', 'Only the wallet that owns this agent can do that. Connect the owner wallet.', 403);
  const { transactionBuilder, sol, createNoopSigner } = require('@metaplex-foundation/umi');
  const core = require('@metaplex-foundation/mpl-core');
  const tb = require('@metaplex-foundation/mpl-toolbox');
  const { umi, me } = L.umiFor(owner);
  const pda = ag.wallet, pdaSigner = createNoopSigner(L.umiPk(pda));
  const exec = inner => core.execute(umi, { asset: { publicKey: L.umiPk(asset) }, instructions: inner, authority: me, payer: me });
  const tok = s => { const t = L.BY_SYM[s]; if (!t) throw new L.Fail('token', 'That token isn\'t supported.'); return t; };
  const amt = (x, max) => { const v = Number(x); if (!(v > 0) || !isFinite(v)) throw new L.Fail('amount', 'Enter an amount above zero.'); if (max != null && v > max + 1e-12) throw new L.Fail('amount', 'That\'s more than there is.'); return v; };
  const held = sym => (ag.holdings.find(h => h.symbol === sym && (sym !== 'SOL' || h.mint === L.SOL)) || { amount: 0 });

  if (op === 'fund') {
    const t = tok(b.token || 'SOL');
    if (t.symbol === 'SOL') {
      const v = amt(b.amount); if (v > 50) throw new L.Fail('amount', 'Fund up to 50 SOL at a time.');
      return { memo: 'nfa:fund', b: transactionBuilder().add(tb.transferSol(umi, { source: me, destination: L.umiPk(pda), amount: sol(v) })), cu: 30000, what: `Send ${v} SOL to ${ag.name}'s wallet` };
    }
    const v = amt(b.amount); const units = BigInt(Math.round(v * 10 ** t.decimals));
    const from = await ata(owner, t.mint), to = await ata(pda, t.mint);
    return { memo: 'nfa:fund', b: transactionBuilder()
      .add(tb.createIdempotentAssociatedToken(umi, { payer: me, ata: L.umiPk(to), owner: L.umiPk(pda), mint: L.umiPk(t.mint) }))
      .add(tb.transferTokensChecked(umi, { source: L.umiPk(from), destination: L.umiPk(to), mint: L.umiPk(t.mint), authority: me, amount: units, decimals: t.decimals })), cu: 60000, what: `Send ${v} ${t.symbol} to ${ag.name}'s wallet` };
  }
  if (op === 'withdraw') {
    const sym = String(b.token || 'SOL');
    if (sym === 'SOL') {
      const have = held('SOL').amount; const keep = 0.001;
      const v = amt(b.amount, Math.max(0, have - keep));
      return { memo: 'nfa:withdraw', b: exec(tb.transferSol(umi, { source: pdaSigner, destination: me.publicKey, amount: sol(v) })), cu: 80000, what: `Move ${v} SOL from the agent back to you` };
    }
    const h = ag.holdings.find(x => x.symbol === sym && x.mint !== L.SOL); if (!h) throw new L.Fail('token', `The agent holds no ${sym}.`);
    const v = amt(b.amount, h.amount); const units = BigInt(Math.round(v * 10 ** h.decimals));
    const from = h.account, to = await ata(owner, h.mint, h.program);
    return { memo: 'nfa:withdraw', b: transactionBuilder()
      .add(tb.createIdempotentAssociatedToken(umi, { payer: me, ata: L.umiPk(to), owner: me.publicKey, mint: L.umiPk(h.mint), tokenProgram: L.umiPk(h.program) }))
      .add(exec(tb.transferTokensChecked(umi, { source: L.umiPk(from), destination: L.umiPk(to), mint: L.umiPk(h.mint), authority: pdaSigner, amount: units, decimals: h.decimals, tokenProgram: L.umiPk(h.program) }))), cu: 120000, what: `Move ${v} ${sym} from the agent back to you` };
  }
  if (op === 'trade') {
    const from = tok(b.from), to = tok(b.to);
    if (from.symbol === to.symbol) throw new L.Fail('pair', 'Pick two different tokens.');
    const R = ag.rules;
    if (!R.allow.includes(from.symbol) || !R.allow.includes(to.symbol)) throw new L.Fail('robots', `robots.txt says no: ${ag.name} may only touch ${R.allow.join(', ')}.`);
    if (ag.tradesToday >= R.daily) throw new L.Fail('robots', `robots.txt says no: ${R.daily} trades a day, and ${ag.tradesToday} are done.`);
    const topup = from.symbol === 'SOL' ? Math.max(0, Math.min(5, Number(b.topup) || 0)) : 0; // optional: send SOL in first, same transaction
    const have = held(from.symbol).amount + topup - (from.symbol === 'SOL' ? 0.003 : 0);
    const v = amt(b.amount, Math.max(0, have));
    const px = await L.prices([from.mint]); const usd = px[from.mint] ? v * px[from.mint].usd : null;
    if (usd == null) throw new L.Fail('price', 'No live price for that token right now, so robots.txt can\'t check the size.');
    if (usd > R.max) throw new L.Fail('robots', `robots.txt says no: max $${R.max} a trade, this is $${usd.toFixed(2)}.`);
    const raw = String(BigInt(Math.floor(v * 10 ** from.decimals)));
    const q = await L.jup(`/swap/v1/quote?inputMint=${from.mint}&outputMint=${to.mint}&amount=${raw}&slippageBps=${R.style === 'bold' ? 150 : R.style === 'careful' ? 50 : 100}&maxAccounts=22&restrictIntermediateTokens=true`);
    if (!q || !q.outAmount) throw new L.Fail('route', 'Jupiter found no route for that pair right now.');
    const si = await L.jup('/swap/v1/swap-instructions', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ quoteResponse: q, userPublicKey: pda, wrapAndUnwrapSol: false, useSharedAccounts: true, skipUserAccountsRpcCalls: true, dynamicComputeUnitLimit: false }) });
    if (!si || !si.swapInstruction) throw new L.Fail('route', 'Jupiter didn\'t return a swap for that route.');
    const WSOL = L.SOL;
    let x = transactionBuilder();
    if (topup > 0) x = x.add(tb.transferSol(umi, { source: me, destination: L.umiPk(pda), amount: sol(topup) }));
    // the agent's token accounts (you pay their rent once; they belong to the agent)
    for (const m of new Set([from.mint, to.mint])) x = x.add(tb.createIdempotentAssociatedToken(umi, { payer: me, ata: L.umiPk(await ata(pda, m)), owner: L.umiPk(pda), mint: L.umiPk(m) }));
    if (from.mint === WSOL) {
      const wsol = await ata(pda, WSOL);
      x = x.add(exec(tb.transferSol(umi, { source: pdaSigner, destination: L.umiPk(wsol), amount: sol(v) }))).add(tb.syncNative(umi, { account: L.umiPk(wsol) }));
    }
    x = x.add(exec([ixFromJup(si.swapInstruction)]));
    if (to.mint === WSOL || from.mint === WSOL) {
      const wsol = await ata(pda, WSOL);
      x = x.add(exec(tb.closeToken(umi, { account: L.umiPk(wsol), destination: L.umiPk(pda), owner: pdaSigner })));
    }
    const alts = await loadAlts(si.addressLookupTableAddresses);
    const outUi = Number(q.outAmount) / 10 ** to.decimals;
    return { memo: 'nfa:trade', b: x, alts, cu: 700000, what: `Swap ${v} ${from.symbol} for about ${outUi.toPrecision(5)} ${to.symbol} inside the agent's wallet`, quote: { out: outUi, usd, impact: Number(q.priceImpactPct || 0) } };
  }
  if (op === 'rules') {
    if (!ag.rulesByOwner) throw new L.Fail('rules', 'This agent\'s rules can only be changed by its update authority.');
    const rules = L.cleanRules(b.rules || {});
    return { memo: 'nfa:rules', b: core.updatePlugin(umi, { asset: L.umiPk(asset), plugin: { type: 'Attributes', attributeList: L.attrList(ag.traits, rules) }, authority: me, payer: me }), cu: 60000, what: 'Write the new robots.txt onto the NFT' };
  }
  if (op === 'transfer') {
    const to = L.needAddr(b.to, 'wallet');
    if (to === owner) throw new L.Fail('to', 'That\'s already the owner.');
    const r = await L.rpc('getAccountInfo', [asset, { encoding: 'base64', commitment: 'confirmed' }]);
    const { deserializeAssetV1 } = core; const { lamports } = require('@metaplex-foundation/umi');
    const full = deserializeAssetV1({ publicKey: L.umiPk(asset), data: new Uint8Array(Buffer.from(r.value.data[0], 'base64')), executable: false, owner: L.umiPk(L.CORE), lamports: lamports(r.value.lamports) });
    return { memo: 'nfa:transfer', b: core.transfer(umi, { asset: full, newOwner: L.umiPk(to), authority: me, payer: me }), cu: 80000, what: `Hand ${ag.name}, its wallet and its record to ${to.slice(0, 4)}…${to.slice(-4)}` };
  }
  throw new L.Fail('op', 'Unknown action.');
}

module.exports = L.wrap(async (req, res) => {
  if (req.method === 'POST') {
    L.limit('op:' + L.ip(req), 30, 60000);
    const b = await L.body(req);
    const p = await build(req, b);
    const out = await L.finish(p.b, { payer: b.owner, alts: p.alts || [], cuLimit: p.cu, memo: p.memo });
    if (!out.sim.ok) throw new L.Fail('sim', L.explain(out.sim), 400, { sim: out.sim });
    cache.delete(b.a);
    return L.send(res, 200, { ok: true, op: b.op, what: p.what, quote: p.quote || null, tx: out.tx, size: out.size, lastValidBlockHeight: out.lastValidBlockHeight, sim: { units: out.sim.units } });
  }
  const q = L.query(req);
  const asset = L.needAddr(q.a, 'agent address');
  L.limit('ag:' + L.ip(req), 90, 60000);
  const v = await readAgent(asset);
  if (!v) throw new L.Fail('not_found', 'No agent at that address. It may still be confirming, or it isn\'t a Metaplex Core asset.', 404);
  L.send(res, 200, { ok: true, agent: v });
});
module.exports.readAgent = readAgent;
module.exports.holdings = holdings;
