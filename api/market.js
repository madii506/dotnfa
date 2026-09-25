// GET /api/market — live prices for the tokens an agent's robots.txt can allow.
const L = require('./_lib');
module.exports = L.wrap(async (req, res) => {
  L.limit('mk:' + L.ip(req), 60, 60000);
  const px = await L.prices(L.TOKENS.map(t => t.mint));
  L.send(res, 200, { ok: true, tokens: L.TOKENS.map(t => ({ ...t, price: px[t.mint] ? px[t.mint].usd : null, change24h: px[t.mint] ? px[t.mint].change24h : null })), at: L.now() }, 'public, s-maxage=20');
});
