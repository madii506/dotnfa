// POST /api/mint — build the mint for a new non-fungible agent.
// One transaction: create the Core NFT (traits + robots.txt as attributes, owned by you), register it with
// Metaplex's Agent Registry, optionally put SOL in the agent's own wallet, and touch the .nfa anchor so it shows
// in the registry. The server makes a fresh asset keypair, signs only the create with it, dry-runs the whole
// thing on mainnet and hands it back. Your wallet signs and pays; nothing is sent until you approve it.
const L = require('./_lib');
const C = require('./_config');
const A = require('../assets/js/agentpx.js');
const clean = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, n);
const BAD = /\b(nigg|fagg|retard|kike|chink|spic)\w*/i;

module.exports = L.wrap(async (req, res) => {
  if (req.method !== 'POST') throw new L.Fail('method', 'POST only.', 405);
  if (!C.mintLive) throw new L.Fail('not_live', 'Mint isn\'t live yet. Nothing was built or charged.', 403);
  L.limit('mint:' + L.ip(req), 12, 60000);
  const b = await L.body(req);
  const owner = L.needAddr(b.owner, 'wallet');
  const traits = A.clean(b.traits || {});
  const rules = L.cleanRules(b.rules || {});
  let name = clean(b.name, 32);
  if (BAD.test(name)) throw new L.Fail('name', 'Pick a different name.');
  const fund = Math.max(0, Math.min(5, Number(b.fund) || 0));

  const { generateSigner, sol, transactionBuilder } = require('@metaplex-foundation/umi');
  const { create } = require('@metaplex-foundation/mpl-core');
  const { registerIdentityV1 } = require('@metaplex-foundation/mpl-agent-registry');
  const { transferSol } = require('@metaplex-foundation/mpl-toolbox');
  const { umi, me } = L.umiFor(owner);
  const asset = generateSigner(umi);
  const addr = String(asset.publicKey);
  if (!name) name = 'Agent ' + addr.slice(0, 4).toUpperCase();
  const site = L.origin(req);
  const wallet = L.signerPda(addr), identity = L.identityPda(addr);

  let tb = transactionBuilder()
    .add(create(umi, {
      asset, payer: me, owner: me.publicKey, updateAuthority: me.publicKey, name, uri: `${site}/api/meta?a=${addr}`,
      plugins: [{ type: 'Attributes', attributeList: L.attrList(traits, rules), authority: { type: 'Owner' } }],
    }))
    .add(registerIdentityV1(umi, { asset: asset.publicKey, payer: me, authority: me, agentRegistrationUri: `${site}/api/meta?k=reg&a=${addr}` }))
    .add(transferSol(umi, { source: me, destination: L.umiPk(L.ANCHOR), amount: sol(0) }));
  if (fund > 0) tb = tb.add(transferSol(umi, { source: me, destination: L.umiPk(wallet), amount: sol(fund) }));

  const out = await L.finish(tb, { payer: owner, extraSigners: [asset], simulateAccounts: [addr, identity, owner], cuLimit: 140000, memo: 'nfa:mint' });
  const [ac, id, ow] = out.sim.accounts || [];
  const rent = (ac ? ac.lamports : 0) + (id ? id.lamports : 0);
  const fee = 5000 * 2 + Math.ceil(140000 * 60000 / 1e6);
  const cost = { rent: rent / 1e9, fee: fee / 1e9, fund, total: (rent + fee) / 1e9 + fund };
  if (!out.sim.ok) {
    const bal = await L.rpc('getBalance', [owner, { commitment: 'confirmed' }]).catch(() => null);
    const have = bal && bal.value != null ? bal.value / 1e9 : null;
    throw new L.Fail('sim', have != null && have < cost.total + 0.001 ? `Your wallet has ${have.toFixed(4)} SOL. Minting needs about ${(cost.total + 0.001).toFixed(4)} SOL.` : L.explain(out.sim), 400, { sim: out.sim, cost });
  }
  L.send(res, 200, { ok: true, asset: addr, wallet, identity, name, traits, rules, tx: out.tx, size: out.size, lastValidBlockHeight: out.lastValidBlockHeight, cost, sim: { units: out.sim.units } });
});
