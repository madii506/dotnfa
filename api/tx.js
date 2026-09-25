// POST /api/tx {raw} — relay a transaction your wallet already signed.  GET /api/tx?sig= — is it confirmed yet?
const L = require('./_lib');
module.exports = L.wrap(async (req, res) => {
  if (req.method === 'POST') {
    L.limit('send:' + L.ip(req), 20, 60000);
    const b = await L.body(req);
    const raw = String(b.raw || '');
    if (!/^[A-Za-z0-9+/=]{100,3000}$/.test(raw)) throw new L.Fail('bad_tx', 'That isn\'t a signed transaction.');
    const j = await L.rpcRaw('sendTransaction', [raw, { encoding: 'base64', skipPreflight: false, maxRetries: 5, preflightCommitment: 'confirmed' }]);
    if (j.error) {
      const logs = (j.error.data && j.error.data.logs) || [];
      throw new L.Fail('send', L.explain({ err: j.error.message, logs }), 400, { logs: logs.slice(-10) });
    }
    return L.send(res, 200, { ok: true, sig: j.result });
  }
  const sig = String(L.query(req).sig || '');
  if (!/^[1-9A-HJ-NP-Za-km-z]{64,90}$/.test(sig)) throw new L.Fail('bad_sig', 'Not a transaction signature.');
  L.limit('tx:' + L.ip(req), 150, 60000);
  const r = await L.rpc('getSignatureStatuses', [[sig], { searchTransactionHistory: true }]);
  const s = r && r.value && r.value[0];
  const status = !s ? 'pending' : s.err ? 'failed' : (s.confirmationStatus === 'finalized' || s.confirmationStatus === 'confirmed') ? 'confirmed' : 'pending';
  L.send(res, 200, { ok: true, status, err: s && s.err ? JSON.stringify(s.err) : null });
});
