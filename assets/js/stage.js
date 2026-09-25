// The stage: the pixel agent that stays on screen while the page scrolls. It idles, blinks and talks. Nothing around it.
(function () {
  const A = window.AgentPx;
  function Stage(root, opt = {}) {
    const who = root.querySelector('.who'), cv = who.querySelector('canvas');
    const bub = root.querySelector('.bub');
    let traits = opt.traits || A.fromSeed('nfa'), blink = false, bob = 0, wave = true, talkT = 0;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    function scale() { const h = root.clientHeight, w = root.clientWidth; return Math.max(3, Math.min(10, Math.floor(Math.min(h * (innerWidth < 860 ? .62 : .5) / A.H, w * .55 / A.W)))); }
    function paint() { A.paint(cv, traits, { scale: scale(), blink, bob, pose: wave ? 'wave' : 'still', shadow: true }); }
    function set(t, pop = true) { traits = A.clean(t); paint(); if (pop && !reduce) { who.classList.remove('pop'); void who.offsetWidth; who.classList.add('pop'); } }
    function say(text, ms = 3600) { if (!bub) return; bub.textContent = text; bub.classList.add('on'); clearTimeout(talkT); talkT = setTimeout(() => bub.classList.remove('on'), ms); }
    // idle: bob every 700ms, blink now and then, wave sometimes
    let tick = 0;
    if (!reduce) setInterval(() => {
      if (document.hidden) return; tick++;
      bob = tick % 2 ? 1 : 0;
      if (tick % 7 === 0) { blink = true; setTimeout(() => { blink = false; paint(); }, 160); }
      if (tick % 11 === 0) wave = !wave;
      paint();
    }, 700);
    addEventListener('resize', paint);
    paint();
    return { set, say, get traits() { return traits; }, paint };
  }
  window.Stage = Stage;
})();
