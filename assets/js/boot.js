// Intro: a short, wordless boot screen, once per browser session. The agent prints line by line while a
// pixel bar fills, then a pixel dissolve opens onto the site. Click, tap or any key skips it.
(() => {
  const el = document.getElementById('boot'); if (!el) return;
  if (document.documentElement.classList.contains('noboot')) { el.remove(); return; }
  const A = window.AgentPx, reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.documentElement.classList.add('booting');

  // the agent from the saved draft, if there is one
  let traits = { head: 'box', body: 'white', eyes: 'dots', eye: 'lime', top: 'ball', extra: 'card' };
  try { const d = JSON.parse(localStorage.getItem('nfa.draft') || 'null'); if (d && d.traits) traits = A.clean(d.traits); } catch {}
  const img = A.draw(traits, { pose: 'wave' }), s = innerWidth < 500 ? 5 : 6;
  const cv = document.getElementById('bootAgent'); cv.width = img.w * s; cv.height = img.h * s;
  const g = cv.getContext('2d'); g.imageSmoothingEnabled = false;
  const tmp = document.createElement('canvas'); tmp.width = img.w; tmp.height = img.h; tmp.getContext('2d').putImageData(new ImageData(img.data, img.w, img.h), 0, 0);
  function printTo(row) { // rows [0,row) plus a lime scan line
    g.clearRect(0, 0, cv.width, cv.height);
    g.drawImage(tmp, 0, 0, img.w, row, 0, 0, img.w * s, row * s);
    if (row < img.h) { g.fillStyle = '#c8f24a'; g.fillRect(0, row * s, cv.width, s); }
  }

  const bar = document.getElementById('bootBar');
  const T = reduce ? 500 : 1500; let t0 = null, finished = false, raf;
  function frame(t) {
    if (t0 == null) t0 = t; const k = Math.min(1, (t - t0) / T);
    printTo(Math.round(img.h * Math.min(1, k * 1.15)));
    bar.style.width = Math.round(k * 20) * 5 + '%';
    if (k < 1) raf = requestAnimationFrame(frame); else setTimeout(leave, reduce ? 150 : 450);
  }
  function leave() {
    if (finished) return; finished = true; cancelAnimationFrame(raf);
    try { sessionStorage.setItem('nfa.boot', '1'); } catch {}
    removeEventListener('keydown', leave); el.removeEventListener('click', leave);
    if (reduce) { el.classList.add('out'); setTimeout(end, 250); return; }
    // pixel dissolve: cover with paper blocks, then knock them out in random order
    const w = document.getElementById('bootWipe'), B = 28, W = Math.ceil(innerWidth / B), H = Math.ceil(innerHeight / B);
    w.width = W; w.height = H; const x = w.getContext('2d'); x.fillStyle = '#f7f6f2'; x.fillRect(0, 0, W, H);
    el.classList.add('wipe');
    const cells = []; for (let i = 0; i < W * H; i++) cells.push(i);
    for (let i = cells.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [cells[i], cells[j]] = [cells[j], cells[i]]; }
    const D = 480, w0 = performance.now(); let n = 0;
    (function step(t) {
      const want = Math.floor(Math.min(1, (t - w0) / D) * cells.length);
      for (; n < want; n++) x.clearRect(cells[n] % W, (cells[n] / W) | 0, 1, 1);
      if (n < cells.length) requestAnimationFrame(step); else end();
    })(w0);
  }
  function end() { document.documentElement.classList.remove('booting'); el.remove(); }
  addEventListener('keydown', leave); el.addEventListener('click', leave);
  requestAnimationFrame(frame);
  setTimeout(leave, 6000); // never hold the page hostage
})();
