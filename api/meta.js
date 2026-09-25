// GET /api/meta?a=<asset>          — the NFT's metadata JSON (what wallets and marketplaces read)
// GET /api/meta?k=reg&a=<asset>    — the agent registration document the Metaplex Agent Registry points to
// GET /api/meta?k=robots&a=<asset> — the agent's robots.txt, written from the rules stored on the NFT
const L = require('./_lib');
const A = require('../assets/js/agentpx.js');
module.exports = L.wrap(async (req, res) => {
  const q = L.query(req);
  const asset = L.needAddr(q.a, 'agent address');
  L.limit('meta:' + L.ip(req), 240, 60000);
  const site = L.origin(req);
  const r = await L.rpc('getAccountInfo', [asset, { encoding: 'base64', commitment: 'confirmed' }]);
  const nft = r && r.value ? L.decodeAsset(asset, r.value) : null;
  const attrs = nft ? nft.attrs : {};
  const traits = Object.keys(A.TRAITS).every(k => attrs[k]) ? A.clean(attrs) : A.fromSeed(asset);
  const rules = L.rulesFromAttrs(attrs);
  const name = nft ? nft.name : 'Agent ' + asset.slice(0, 4).toUpperCase();
  const desc = `${name} is a non-fungible agent: an AI agent that lives inside this NFT, with its own wallet on Solana. Sell the NFT and the agent, its wallet and its record go with it. Rules: max $${rules.max} a trade, ${rules.daily} trades a day, only ${rules.allow.join(', ')}.`;
  const cache = nft ? 'public, s-maxage=60, stale-while-revalidate=600' : 'public, s-maxage=10';
  if (q.k === 'robots') {
    res.statusCode = 200; res.setHeader('Content-Type', 'text/plain; charset=utf-8'); res.setHeader('Cache-Control', cache);
    return res.end(L.robotsTxt(name, rules, asset));
  }
  if (q.k === 'reg') {
    return L.send(res, 200, {
      type: 'https://eips.ethereum.org/EIPS/eip-8004#registration-v1', name, description: desc, image: `${site}/api/img?a=${asset}`,
      services: [
        { name: 'web', endpoint: `${site}/a/${asset}` },
        { name: 'chat', endpoint: `${site}/api/chat`, version: 'nfa-1' },
        { name: 'robots', endpoint: `${site}/api/meta?k=robots&a=${asset}` },
      ],
      registrations: [{ agentId: asset, agentRegistry: `solana:mainnet:${L.IDENTITY}` }],
      supportedTrust: [],
    }, cache);
  }
  const L2 = A.LABEL;
  L.send(res, 200, {
    name, symbol: 'NFA', description: desc, image: `${site}/api/img?a=${asset}`, external_url: `${site}/a/${asset}`,
    attributes: [
      { trait_type: 'Head', value: L2.head[traits.head] }, { trait_type: 'Body', value: traits.body }, { trait_type: 'Eyes', value: L2.eyes[traits.eyes] },
      { trait_type: 'Eye colour', value: traits.eye }, { trait_type: 'Top', value: L2.top[traits.top] }, { trait_type: 'Extra', value: L2.extra[traits.extra] },
      { trait_type: 'Max trade (USD)', value: rules.max }, { trait_type: 'Allowed', value: rules.allow.join(', ') }, { trait_type: 'Style', value: rules.style },
    ],
    properties: { category: 'image', files: [{ uri: `${site}/api/img?a=${asset}`, type: 'image/png' }] },
  }, cache);
});
