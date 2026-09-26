// POST /api/task — give your agent a task, get a working product back.
// {name, traits, rules, kind: site|tool|game|doc, brief}            → a new product
// {name, traits, rules, kind, brief, prev: <html>, change: <text>}   → a revised product
// The agent writes ONE self-contained HTML file and it streams back as plain text while it's written.
// The page runs it in a sandboxed frame (scripts only, no same-origin), so it can't touch the site or a wallet.
const L = require('./_lib');
const A = require('../assets/js/agentpx.js');
const MODELS = ['openai/gpt-4.1-mini', 'google/gemini-2.5-flash'];
const KINDS = {
  site: 'a website or landing page: a strong hero, real sections, real copy (no lorem ipsum), a clear call to action',
  tool: 'an interactive tool, calculator or dashboard that actually computes things from what the user enters',
  game: 'a small playable browser game with a score, a restart button, and both keyboard and touch controls',
  doc: 'a one-page document (brief, plan, report or guide) that is well structured, easy to read and prints cleanly',
};
const TONE = { careful: 'calm, minimal and precise', steady: 'clean, balanced and friendly', bold: 'loud, high-contrast and playful' };
const clean = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, ' ').slice(0, n);
const rgb = c => `rgb(${c.join(',')})`;

function system(ag, kind) {
  const t = ag.traits, accent = rgb(A.BODY[t.body] || A.BODY.white), eye = rgb(A.EYE[t.eye] || A.EYE.lime);
  return [
    `You are ${ag.name}, an AI agent at nfa, the first company that runs on NFTs: every worker is an AI agent that lives inside an NFT and its owner controls it.`,
    `Your owner submitted a task. Deliver a WORKING product: ${KINDS[kind]}.`,
    'Output rules, all mandatory:',
    '- Output ONLY one complete HTML document, starting with <!doctype html>. No markdown fences, no explanations before or after.',
    '- All CSS and JavaScript inline. No external requests of any kind: no CDNs, web fonts, remote images, fetch, XHR or websockets. Draw graphics with inline SVG, CSS or canvas.',
    '- Do not use localStorage, sessionStorage, cookies or IndexedDB; keep state in memory. It runs inside a sandboxed iframe with scripts only.',
    '- Every button and control must work. Responsive from 360px phones to wide screens. Polished, modern design.',
    `- Design tone: ${TONE[ag.rules.style] || TONE.steady}. Use ${accent} as a main accent colour and ${eye} as a highlight where it fits.`,
    `- Add a small footer line: "Built by ${ag.name} · nfa".`,
    '- Keep it under about 500 lines.',
    '- Never build: login or payment pages that imitate a real company, anything asking for a seed phrase, private key or password, wallet drainers, malware, scams, promises of guaranteed returns, content about real private people, or adult content. If asked for any of that, build a simple page that says the agent declined the task and why.',
  ].join('\n');
}

async function* gateway(token, messages) {
  const m = globalThis.__NFA_MOCK; if (m && m.stream) { yield* m.stream(messages); return; }
  let lastErr;
  for (const model of MODELS) {
    let r;
    try {
      r = await fetch('https://ai-gateway.vercel.sh/v1/chat/completions', {
        method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token },
        body: JSON.stringify({ model, stream: true, max_tokens: 7000, temperature: 0.6, messages }), signal: AbortSignal.timeout(110000),
      });
    } catch (e) { lastErr = e; continue; }
    if (!r.ok || !r.body) { lastErr = new Error('gateway ' + r.status + ' ' + (await r.text().catch(() => '')).slice(0, 200)); continue; }
    const dec = new TextDecoder(); let buf = '', any = false;
    for await (const chunk of r.body) {
      buf += dec.decode(chunk, { stream: true });
      let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
        if (!line.startsWith('data:')) continue;
        const d = line.slice(5).trim(); if (d === '[DONE]') return;
        try { const j = JSON.parse(d); const t = j.choices && j.choices[0] && j.choices[0].delta && j.choices[0].delta.content; if (t) { any = true; yield t; } } catch {}
      }
    }
    if (any) return;
  }
  throw lastErr || new Error('no model answered');
}

module.exports = async (req, res) => {
  let started = false;
  try {
    if (req.method !== 'POST') throw new L.Fail('method', 'POST only.', 405);
    L.limit('task:' + L.ip(req), 8, 15 * 60000);
    const b = await L.body(req);
    const kind = KINDS[b.kind] ? b.kind : 'site';
    const brief = clean(b.brief, 700).trim();
    if (brief.length < 8) throw new L.Fail('brief', 'Describe the task in a sentence or two.');
    const ag = { name: clean(b.name, 32).trim() || 'Agent', traits: A.clean(b.traits || {}), rules: L.cleanRules(b.rules || {}) };
    const prev = clean(b.prev, 60000), change = clean(b.change, 500).trim();
    if (prev && change.length < 3) throw new L.Fail('change', 'Say what to change.');
    const token = req.headers['x-vercel-oidc-token'] || process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN;
    const m = globalThis.__NFA_MOCK;
    if (!token && !(m && m.stream)) throw new L.Fail('no_ai', 'The agents are offline right now. Try again later.', 503);
    const messages = [{ role: 'system', content: system(ag, kind) }, { role: 'user', content: `Task (${kind}): ${brief}` }];
    if (prev) messages.push({ role: 'assistant', content: prev }, { role: 'user', content: `Revise the product above. Change request: ${change}\nReturn the complete updated HTML document only.` });

    const it = gateway(token, messages);
    const first = await it.next(); // fail with a clean JSON error if no model answers at all
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Accel-Buffering', 'no');
    started = true;
    if (!first.done) res.write(first.value);
    for (;;) { const n = await it.next(); if (n.done) break; res.write(n.value); }
    res.end();
  } catch (e) {
    if (started) { try { res.end('\n<!--NFA_ERROR The agent stopped early. Try again.-->'); } catch {} return; }
    if (e instanceof L.Fail) return L.send(res, e.code, { ok: false, reason: e.reason, msg: e.message });
    console.error('[task]', e && e.stack || e);
    L.send(res, 502, { ok: false, reason: 'ai_down', msg: 'The agent couldn\'t take the task right now. Try again in a minute.' });
  }
};
