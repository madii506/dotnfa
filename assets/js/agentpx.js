// nfa pixel agents. One function draws any agent from its traits into a small RGBA grid.
// Shared by the browser (canvas) and the server (PNG for the NFT image), so both always match.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.AgentPx = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const W = 44, H = 60;
  const OUT = [13, 14, 17];
  const BODY = {
    white: [241, 241, 238], bone: [228, 222, 208], graphite: [96, 99, 110], black: [46, 47, 54], lime: [200, 242, 74],
    orange: [255, 128, 38], pink: [255, 160, 205], sky: [140, 206, 255], cobalt: [58, 88, 255], red: [255, 70, 70],
  };
  const EYE = { lime: [200, 242, 74], white: [246, 246, 240], orange: [255, 150, 60], pink: [255, 150, 205], sky: [140, 214, 255], red: [255, 80, 80] };
  const TRAITS = {
    head: ['box', 'tv', 'pill', 'dome', 'tall'],
    body: Object.keys(BODY),
    eyes: ['dots', 'bars', 'happy', 'sleepy', 'one', 'cross'],
    eye: Object.keys(EYE),
    top: ['ball', 'twin', 'ears', 'fin', 'halo', 'none'],
    extra: ['card', 'scarf', 'bowtie', 'phones'],
  };
  const LABEL = {
    head: { box: 'Box', tv: 'Telly', pill: 'Pill', dome: 'Dome', tall: 'Tall' },
    eyes: { dots: 'Dots', bars: 'Bars', happy: 'Happy', sleepy: 'Sleepy', one: 'Scanner', cross: 'Crossed' },
    top: { ball: 'Antenna', twin: 'Twin', ears: 'Ears', fin: 'Fin', halo: 'Halo', none: 'Bare' },
    extra: { card: '1/1 card', scarf: 'Scarf', bowtie: 'Bow tie', phones: 'Headphones' },
  };
  // weights make some traits rarer than others
  const WEIGHT = {
    head: [30, 20, 20, 18, 12], body: [22, 12, 10, 12, 10, 9, 8, 7, 5, 5], eyes: [30, 20, 16, 14, 12, 8],
    eye: [34, 22, 14, 12, 10, 8], top: [34, 18, 16, 12, 5, 15], extra: [55, 18, 15, 12],
  };

  const mix = (c, d, t) => [0, 1, 2].map(i => Math.round(c[i] + (d[i] - c[i]) * t));
  const shade = c => mix(c, [0, 0, 0], 0.17);
  const light = c => mix(c, [255, 255, 255], 0.3);

  function fnv(s) { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h >>> 0; }
  function rng(seed) { let x = fnv(String(seed)) || 1; return () => { x ^= x << 13; x >>>= 0; x ^= x >> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; }; }
  function pick(r, list, w) { const t = w.reduce((a, b) => a + b, 0); let v = r() * t; for (let i = 0; i < list.length; i++) { v -= w[i]; if (v <= 0) return list[i]; } return list[list.length - 1]; }
  function fromSeed(seed) {
    const r = rng('nfa:' + seed); const t = {};
    for (const k of Object.keys(TRAITS)) t[k] = pick(r, TRAITS[k], WEIGHT[k]);
    if (t.eye === 'lime' && t.body === 'lime') t.eye = 'white';
    return t;
  }
  function odds(t) { // chance of this exact look, from the weights
    let p = 1; for (const k of Object.keys(TRAITS)) { const i = TRAITS[k].indexOf(t[k]); const w = WEIGHT[k]; if (i < 0) continue; p *= w[i] / w.reduce((a, b) => a + b, 0); }
    return Math.max(1, Math.round(1 / p));
  }
  function clean(t) { const o = {}; for (const k of Object.keys(TRAITS)) o[k] = TRAITS[k].includes(t && t[k]) ? t[k] : TRAITS[k][0]; return o; }

  function draw(tr, opt = {}) {
    const t = clean(tr);
    const buf = new Uint8ClampedArray(W * H * 4);
    const own = new Uint8Array(W * H); // part id per pixel, 0 = empty
    let PID = 1; const touched = [];
    const put = (x, y, c, a = 255) => { x |= 0; y |= 0; if (x < 0 || y < 0 || x >= W || y >= H) return; const i = (y * W + x) * 4; buf[i] = c[0]; buf[i + 1] = c[1]; buf[i + 2] = c[2]; buf[i + 3] = a; own[y * W + x] = PID; touched.push(y * W + x); };
    // draw a part; with ink, the pixels of earlier parts that touch it become outline (so parts read separately)
    const part = (ink, fn) => {
      PID++; touched.length = 0; fn(); if (!ink) return;
      const me = PID, mine = new Set(touched);
      for (const k of mine) { const x = k % W, y = (k / W) | 0;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue; const n = ny * W + nx; if (own[n] && own[n] !== me && own[n] !== 1) { const i = n * 4; buf[i] = OUT[0]; buf[i + 1] = OUT[1]; buf[i + 2] = OUT[2]; own[n] = 1; } }
      }
    };
    const get = (x, y) => own[y * W + x] > 0;
    const rect = (x0, y0, w, h, c) => { for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) put(x, y, c); };
    const inR = (x, y, x0, y0, w, h, r) => {
      const cx = x < x0 + r ? x0 + r : x > x0 + w - 1 - r ? x0 + w - 1 - r : x, cy = y < y0 + r ? y0 + r : y > y0 + h - 1 - r ? y0 + h - 1 - r : y;
      return (x - cx) ** 2 + (y - cy) ** 2 <= r * r + r * 0.6;
    };
    // a shaded rounded block: light top-left rim, dark right/bottom band
    const block = (x0, y0, w, h, r, c, rt = r) => {
      for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
        const rr = y < y0 + h / 2 ? rt : r;
        if (!inR(x, y, x0, y0, w, h, rr)) continue;
        const fx = (x - x0) / (w - 1), fy = (y - y0) / (h - 1);
        let col = c;
        if (fx > 0.8 || fy > 0.84) col = shade(c);
        else if ((fx < 0.12 || fy < 0.12) && !(fx < 0.12 && fy > 0.7)) col = light(c);
        put(x, y, col);
      }
    };
    const B = BODY[t.body], E = EYE[t.eye], dark = [30, 31, 37], dark2 = [52, 54, 62];
    const cx = 22;
    // --- head geometry
    const G = { box: [26, 18, 5, 5], tv: [28, 18, 2, 2], pill: [28, 16, 8, 8], dome: [24, 19, 3, 10], tall: [20, 22, 5, 5] }[t.head];
    const hw = G[0], hh = G[1], hx = cx - (hw >> 1), hy = 16 - (t.head === 'tall' ? 3 : 0) + (t.head === 'pill' ? 1 : 0);
    const bodyY = hy + hh + 2, bw = 16, bh = 12, bx = cx - (bw >> 1);
    const wave = opt.pose !== 'still';
    // legs + feet
    part(false, () => { rect(bx + 3, bodyY + bh - 1, 4, 6, dark); rect(bx + bw - 7, bodyY + bh - 1, 4, 6, dark); rect(bx + 3, bodyY + bh, 1, 5, dark2); });
    part(true, () => { block(bx + 1, bodyY + bh + 5, 7, 3, 1, B); block(bx + bw - 8, bodyY + bh + 5, 7, 3, 1, B); });
    // left arm hangs
    part(false, () => { block(bx - 3, bodyY + 2, 4, 9, 1, B); });
    part(false, () => { rect(bx - 4, bodyY + 10, 5, 4, dark); put(bx - 3, bodyY + 10, dark2); });
    // body
    part(true, () => block(bx, bodyY, bw, bh, 3, B));
    part(false, () => rect(cx - 3, bodyY - 2, 6, 2, dark)); // neck
    // extras on the chest
    part(false, () => {
      if (t.extra === 'card') {
        const lime = [200, 242, 74];
        put(cx - 3, bodyY, lime); put(cx - 2, bodyY + 1, lime); put(cx + 2, bodyY, lime); put(cx + 1, bodyY + 1, lime);
        const kx = cx - 5, ky = bodyY + 2; rect(kx, ky, 11, 7, [17, 18, 23]);
        const g1 = ['010', '110', '010', '010', '111'], gs = ['001', '001', '010', '100', '100'];
        [[g1, 1], [gs, 4], [g1, 7]].forEach(([g, ox]) => g.forEach((row, yy) => [...row].forEach((v, xx) => { if (v === '1') put(kx + ox + xx, ky + 1 + yy, [247, 246, 242]); })));
      } else if (t.extra === 'scarf') {
        const sc = t.body === 'lime' ? [255, 128, 38] : [200, 242, 74];
        rect(bx + 1, bodyY, bw - 2, 3, sc); rect(bx + 1, bodyY + 2, bw - 2, 1, shade(sc)); rect(cx + 3, bodyY + 3, 3, 5, sc); put(cx + 5, bodyY + 7, shade(sc));
      } else if (t.extra === 'bowtie') {
        const sc = t.body === 'red' ? [17, 18, 23] : [255, 70, 70];
        rect(cx - 4, bodyY + 1, 3, 4, sc); rect(cx + 1, bodyY + 1, 3, 4, sc); rect(cx - 1, bodyY + 2, 2, 2, shade(sc));
      }
    });
    // antenna / top (behind the head)
    const top = hy;
    const ball = (x, y) => { rect(x - 1, y - 1, 3, 3, E); put(x - 1, y - 1, light(E)); };
    part(false, () => {
      if (t.top === 'ball') { rect(cx - 1, top - 6, 1, 6, dark); ball(cx - 1, top - 7); }
      if (t.top === 'twin') { for (let i = 0; i < 6; i++) { put(cx - 5 - (i >> 1), top - 1 - i, dark); put(cx + 4 + (i >> 1), top - 1 - i, dark); } ball(cx - 8, top - 8); ball(cx + 7, top - 8); }
      if (t.top === 'ears') { for (let i = 0; i < 5; i++) { rect(hx + 3 + i, top - 5 + i, 5 - i, 1, B); rect(hx + hw - 8, top - 5 + i, 5 - i, 1, B); } }
      if (t.top === 'fin') { block(cx - 2, top - 5, 4, 7, 1, t.body === 'black' ? [200, 242, 74] : [46, 47, 54]); }
      if (t.top === 'halo') { for (let x = -7; x <= 7; x++) { const y = Math.round(Math.sqrt(Math.max(0, 1 - (x / 7.5) ** 2)) * 2); put(cx + x, top - 6 - y, [255, 214, 90]); put(cx + x, top - 6 + y, [255, 214, 90]); } }
    });
    // head
    part(true, () => { block(hx, hy, hw, hh, G[2], B, G[3]); });
    part(false, () => {
      if (t.head === 'tv') { rect(hx - 2, hy + 6, 2, 6, dark); rect(hx + hw, hy + 6, 2, 6, dark); }
      if (t.extra === 'phones') { const p = t.body === 'black' ? [200, 242, 74] : [46, 47, 54]; rect(hx - 2, hy + 5, 3, 8, p); rect(hx + hw - 1, hy + 5, 3, 8, p); for (let x = hx + 1; x < hx + hw - 1; x++) { const f = (x - hx) / (hw - 1) * 2 - 1; put(x, hy - 1 - Math.round((1 - f * f) * 2), p); } }
    });
    // visor + eyes
    const vx = hx + (t.head === 'pill' ? 5 : 3), vw = hw - (t.head === 'pill' ? 10 : 6), vy = hy + (t.head === 'dome' ? 6 : 4), vh = hh - (t.head === 'dome' ? 10 : 8) - (t.head === 'tall' ? 3 : 0);
    const vis = [18, 19, 25];
    part(false, () => { for (let y = vy; y < vy + vh; y++) for (let x = vx; x < vx + vw; x++) if (inR(x, y, vx, vy, vw, vh, 2)) put(x, y, y === vy ? [44, 46, 56] : vis); });
    const ey = vy + (vh >> 1) - 1, ex1 = vx + Math.round(vw * 0.28) - 1, ex2 = vx + Math.round(vw * 0.72) - 2;
    const eye = (x, y) => {
      if (t.eyes === 'dots') { rect(x, y, 3, 3, E); put(x, y, light(E)); }
      if (t.eyes === 'bars') { rect(x + 1, y - 1, 2, 5, E); }
      if (t.eyes === 'happy') { put(x, y + 2, E); put(x + 1, y + 1, E); put(x + 2, y, E); put(x + 3, y + 1, E); put(x + 4, y + 2, E); }
      if (t.eyes === 'sleepy') { put(x, y + 1, E); put(x + 1, y + 2, E); put(x + 2, y + 2, E); put(x + 3, y + 2, E); put(x + 4, y + 1, E); }
      if (t.eyes === 'cross') { put(x, y, E); put(x + 2, y, E); put(x + 1, y + 1, E); put(x, y + 2, E); put(x + 2, y + 2, E); }
    };
    part(false, () => {
      if (opt.blink && t.eyes !== 'happy' && t.eyes !== 'sleepy') { rect(ex1, ey + 1, t.eyes === 'one' ? vw - 6 - (ex1 - vx - 3) : 3, 1, E); if (t.eyes !== 'one') rect(ex2, ey + 1, 3, 1, E); return; }
      if (t.eyes === 'one') { rect(vx + 3, ey + 1, vw - 6, 2, E); put(vx + 3, ey + 1, light(E)); }
      else if (t.eyes === 'happy' || t.eyes === 'sleepy') { eye(ex1 - 1, ey); eye(ex2 - 1, ey); }
      else { eye(ex1, ey); eye(ex2, ey); }
    });
    // right arm last so it reads in front: waving, or hanging
    if (wave) {
      part(true, () => { for (let i = 0; i < 7; i++) { const ax = bx + bw - 1 + Math.round(i * 0.75), ay = bodyY + 3 - i; rect(ax, ay, 3, 2, B); put(ax + 2, ay + 1, shade(B)); } });
      part(true, () => { rect(bx + bw + 3, bodyY - 8, 5, 4, dark); put(bx + bw + 4, bodyY - 8, dark2); });
    } else {
      part(true, () => block(bx + bw - 1, bodyY + 2, 4, 9, 1, B));
      part(false, () => { rect(bx + bw - 1, bodyY + 10, 5, 4, dark); });
    }
    // 1px outline around the whole silhouette
    const edge = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (get(x, y)) continue;
      if ((x > 0 && get(x - 1, y)) || (x < W - 1 && get(x + 1, y)) || (y > 0 && get(x, y - 1)) || (y < H - 1 && get(x, y + 1))) edge.push([x, y]);
    }
    for (const [x, y] of edge) { const i = (y * W + x) * 4; buf[i] = OUT[0]; buf[i + 1] = OUT[1]; buf[i + 2] = OUT[2]; buf[i + 3] = 255; }
    return { w: W, h: H, data: buf, feet: bodyY + bh + 8 };
  }

  // paint onto a canvas at an integer scale (browser)
  function paint(canvas, traits, opt = {}) {
    const s = opt.scale || 6, pad = opt.pad || 0;
    const img = draw(traits, opt);
    canvas.width = (img.w + pad * 2) * s; canvas.height = (img.h + pad * 2) * s;
    const g = canvas.getContext('2d'); g.imageSmoothingEnabled = false;
    if (opt.bg) { g.fillStyle = opt.bg; g.fillRect(0, 0, canvas.width, canvas.height); }
    if (opt.shadow !== false) { g.fillStyle = opt.shadowColor || 'rgba(17,17,19,.09)'; const fy = (img.feet + pad) * s, fw = 24 * s; g.fillRect((canvas.width - fw) / 2, fy - s, fw, s * 2); g.fillRect((canvas.width - fw) / 2 + s * 2, fy + s, fw - s * 4, s); }
    const tmp = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(img.w, img.h) : Object.assign(document.createElement('canvas'), { width: img.w, height: img.h });
    tmp.getContext('2d').putImageData(new ImageData(img.data, img.w, img.h), 0, 0);
    g.drawImage(tmp, pad * s, (pad + (opt.bob || 0)) * s, img.w * s, img.h * s);
    return canvas;
  }

  return { W, H, TRAITS, LABEL, BODY, EYE, WEIGHT, fromSeed, draw, paint, odds, clean, fnv };
});
