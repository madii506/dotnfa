// Site settings. ca and x stay empty until they exist; the page only shows them once set.
module.exports = {
  name: 'nfa',
  ticker: '$NFA',
  ca: '',
  x: '',
  // mint stays off until the env var NFA_MINT_LIVE=1 is set on Vercel (and the site is redeployed)
  mintLive: process.env.NFA_MINT_LIVE === '1',
  origin: process.env.SITE_ORIGIN || '',
  // registry anchor: a plain address with no key behind it. Every mint sends it 0 lamports so mints can be listed.
  anchor: 'BdTMq5DaUn8EvNjmgjyYkwZhbTgQPuhu8kuWi3zgb27y',
};
