// GET /api/img?a=<asset>[&s=768]          — the agent's picture, drawn from the traits stored on its NFT
// GET /api/img?t=<head.body.eyes.eye.top.extra> — a preview for traits that aren't minted yet
const L = require('./_lib');
const A = require('../assets/js/agentpx.js');
const { agentPng } = require('./_png');
module.exports = L.wrap(async (req, res) => {
  const q = L.query(req);
  const size = [256, 512, 768, 1024].includes(Number(q.s)) ? Number(q.s) : 768;
  let traits, cache = 'public, s-maxage=86400, stale-while-revalidate=604800';
  if (q.t) {
    const [head, body, eyes, eye, top, extra] = String(q.t).split('.');
    traits = A.clean({ head, body, eyes, eye, top, extra });
  } else {
    const asset = L.needAddr(q.a, 'agent address');
    L.limit('img:' + L.ip(req), 240, 60000);
    const r = await L.rpc('getAccountInfo', [asset, { encoding: 'base64', commitment: 'confirmed' }]);
    const nft = r && r.value ? L.decodeAsset(asset, r.value) : null;
    const attrs = nft ? nft.attrs : {};
    traits = Object.keys(A.TRAITS).every(k => attrs[k]) ? A.clean(attrs) : A.fromSeed(asset);
    if (!nft) cache = 'public, s-maxage=30';
  }
  const png = agentPng(A, traits, { size });
  res.statusCode = 200; res.setHeader('Content-Type', 'image/png'); res.setHeader('Cache-Control', cache);
  res.end(png);
});
