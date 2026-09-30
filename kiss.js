/* kiss — huit règles simples, un seul script, zéro dépendance.
   Chaque simulation ne tourne que lorsqu'elle est visible à l'écran. */
(() => {
  'use strict';
  const root = document.documentElement;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const rnd = Math.random;
  const fr = (n, d = 0) => n.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });

  /* ---------- Couleurs (lues dans le CSS, donc suivent le thème) ---------- */
  let C = {};
  const hex = (h) => { h = h.replace('#', ''); if (h.length === 3) h = [...h].map((c) => c + c).join(''); const n = parseInt(h, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const readColors = () => {
    const cs = getComputedStyle(root);
    for (const k of ['canvas', 'fg', 'fg-2', 'muted', 'line', 'sun', 'coral', 'bg']) C[k] = cs.getPropertyValue('--' + k).trim();
    C.dark = root.dataset.theme !== 'light';
  };
  readColors();

  /* ---------- Petit moteur commun ---------- */
  const sims = [];
  function Sim(id, def) {
    const cv = document.getElementById(id);
    if (!cv) return null;
    const fig = cv.closest('figure') || cv.parentElement;
    const s = {
      cv, fig, def, ctx: cv.getContext('2d', def.ctx || {}), W: 0, H: 0, d: 1, p: {},
      running: def.play !== false && !reduce, busy: false, visible: false,
    };
    fig.querySelectorAll('[data-p]').forEach((el) => {
      const k = el.dataset.p;
      const read = () => { s.p[k] = el.tagName === 'SELECT' ? el.value : +el.value; };
      read();
      el.addEventListener('input', () => { read(); def.param && def.param(s, k); });
    });
    s.stat = fig.querySelector('[data-stat]');
    s.say = (t) => { if (s.stat && s.stat.textContent !== t) s.stat.textContent = t; };
    const play = fig.querySelector('[data-act="play"]');
    s.sync = () => { if (play) { play.textContent = s.running ? 'pause' : 'lecture'; play.dataset.state = s.running ? 'running' : 'paused'; } };
    fig.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', () => {
      if (b.dataset.act === 'play') { s.running = !s.running; s.sync(); } else def.act && def.act(s, b.dataset.act, b);
    }));
    s.sync();
    s.resize = () => {
      const r = cv.getBoundingClientRect();
      const d = Math.min(window.devicePixelRatio || 1, def.maxDpr || 2);
      const w = Math.max(2, Math.round(r.width * d)), h = Math.max(2, Math.round(r.height * d));
      if (w === s.W && h === s.H) return;
      s.W = cv.width = w; s.H = cv.height = h; s.d = d;
      def.init(s);
    };
    if (def.pointer) {
      let down = false;
      const pos = (e) => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * s.W / r.width, (e.clientY - r.top) * s.H / r.height]; };
      cv.addEventListener('pointerdown', (e) => { down = true; cv.setPointerCapture(e.pointerId); def.pointer(s, ...pos(e), 'down'); });
      cv.addEventListener('pointermove', (e) => { if (down) def.pointer(s, ...pos(e), 'move'); });
      cv.addEventListener('pointerup', () => { down = false; });
      cv.addEventListener('pointercancel', () => { down = false; });
    }
    sims.push(s);
    return s;
  }

  const io = new IntersectionObserver((es) => {
    for (const e of es) { const s = sims.find((x) => x.cv === e.target); if (s) s.visible = e.isIntersecting; }
  }, { rootMargin: '80px' });
  const ro = new ResizeObserver((es) => { for (const e of es) { const s = sims.find((x) => x.cv === e.target); if (s) s.resize(); } });

  const loop = (t) => {
    for (const s of sims) if (s.visible && (s.running || s.busy) && s.W) s.def.tick(s, t);
    requestAnimationFrame(loop);
  };

  /* ================= 0. Héros : une vie lente en fond ================= */
  Sim('hero-cv', {
    maxDpr: 1,
    init(s) {
      s.cell = 12; s.cols = Math.ceil(s.W / s.cell); s.rows = Math.ceil(s.H / s.cell);
      s.a = new Uint8Array(s.cols * s.rows); s.b = new Uint8Array(s.a.length); s.f = 0; s.g = 0;
      for (let i = 0; i < s.a.length; i++) s.a[i] = rnd() < 0.18 ? 1 : 0;
      this.draw(s);
    },
    soup(s) {
      const x0 = (rnd() * (s.cols - 14)) | 0, y0 = (rnd() * (s.rows - 14)) | 0;
      for (let y = 0; y < 12; y++) for (let x = 0; x < 12; x++) if (rnd() < 0.4) s.a[(y0 + y) * s.cols + x0 + x] = 1;
    },
    tick(s) {
      if (++s.f % 9) return;
      lifeStep(s.a, s.b, s.cols, s.rows); [s.a, s.b] = [s.b, s.a];
      if (++s.g % 30 === 0) this.soup(s);
      this.draw(s);
    },
    draw(s) {
      const { ctx, cell, cols, a } = s;
      ctx.clearRect(0, 0, s.W, s.H);
      ctx.fillStyle = C.muted; ctx.globalAlpha = 0.35;
      for (let i = 0; i < a.length; i++) if (a[i]) ctx.fillRect((i % cols) * cell + 1, ((i / cols) | 0) * cell + 1, cell - 2, cell - 2);
      ctx.globalAlpha = 1;
    },
    redraw(s) { this.draw(s); },
  });

  /* Pas du jeu de la vie (grille torique) ; renvoie le nombre de cellules vivantes */
  function lifeStep(a, b, cols, rows, born) {
    let alive = 0;
    for (let y = 0; y < rows; y++) {
      const ym = ((y - 1 + rows) % rows) * cols, y0 = y * cols, yp = ((y + 1) % rows) * cols;
      for (let x = 0; x < cols; x++) {
        const xm = (x - 1 + cols) % cols, xp = (x + 1) % cols;
        const n = a[ym + xm] + a[ym + x] + a[ym + xp] + a[y0 + xm] + a[y0 + xp] + a[yp + xm] + a[yp + x] + a[yp + xp];
        const i = y0 + x, v = n === 3 || (n === 2 && a[i]) ? 1 : 0;
        b[i] = v; alive += v;
        if (born) born[i] = v && !a[i] ? 1 : 0;
      }
    }
    return alive;
  }

  /* ================= 1. Le jeu de la vie ================= */
  Sim('cv-vie', {
    init(s) {
      s.cell = Math.max(4, Math.round(7 * s.d));
      s.cols = Math.floor(s.W / s.cell); s.rows = Math.floor(s.H / s.cell);
      s.ox = ((s.W - s.cols * s.cell) / 2) | 0; s.oy = ((s.H - s.rows * s.cell) / 2) | 0;
      const n = s.cols * s.rows;
      s.a = new Uint8Array(n); s.b = new Uint8Array(n); s.born = new Uint8Array(n);
      this.act(s, 'reset');
    },
    act(s, a) {
      if (a === 'reset') { for (let i = 0; i < s.a.length; i++) s.a[i] = rnd() < 0.24 ? 1 : 0; s.born.fill(0); }
      if (a === 'clear') { s.a.fill(0); s.born.fill(0); }
      s.gen = 0; s.acc = 0; this.draw(s);
    },
    tick(s) {
      s.acc += s.p.speed / 60;
      let steps = 0;
      while (s.acc >= 1 && steps < 4) { s.acc -= 1; steps++; s.alive = lifeStep(s.a, s.b, s.cols, s.rows, s.born); [s.a, s.b] = [s.b, s.a]; s.gen++; }
      if (steps) this.draw(s);
    },
    draw(s) {
      const { ctx, cell, cols, a, born, ox, oy } = s, g = cell > 5 ? 1 : 0;
      ctx.fillStyle = C.canvas; ctx.fillRect(0, 0, s.W, s.H);
      let alive = 0;
      for (let pass = 0; pass < 2; pass++) {
        ctx.fillStyle = pass ? C.sun : C.fg;
        for (let i = 0; i < a.length; i++) {
          if (!a[i] || (born[i] ? 0 : 1) === pass) continue;
          alive++;
          ctx.fillRect(ox + (i % cols) * cell, oy + ((i / cols) | 0) * cell, cell - g, cell - g);
        }
      }
      s.say(`génération ${fr(s.gen)} · ${fr(alive)} vivantes`);
    },
    pointer(s, x, y, phase) {
      const cx = Math.floor((x - s.ox) / s.cell), cy = Math.floor((y - s.oy) / s.cell);
      if (cx < 0 || cy < 0 || cx >= s.cols || cy >= s.rows) return;
      const i = cy * s.cols + cx;
      if (phase === 'down') s.paint = s.a[i] ? 0 : 1;
      s.a[i] = s.paint; s.born[i] = s.paint;
      this.draw(s);
    },
    redraw(s) { this.draw(s); },
  });

  /* ================= 2. La fourmi de Langton ================= */
  const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  Sim('cv-fourmi', {
    init(s) {
      s.cell = Math.max(2, Math.round(3 * s.d));
      s.cols = Math.floor(s.W / s.cell); s.rows = Math.floor(s.H / s.cell);
      s.ox = ((s.W - s.cols * s.cell) / 2) | 0; s.oy = ((s.H - s.rows * s.cell) / 2) | 0;
      s.g = new Uint8Array(s.cols * s.rows);
      this.act(s, 'reset');
    },
    act(s, a) {
      if (a !== 'reset') return;
      s.g.fill(0); s.x = s.cols >> 1; s.y = s.rows >> 1; s.dir = 0; s.n = 0;
      this.redraw(s);
    },
    cellAt(s, x, y, col) { s.ctx.fillStyle = col; s.ctx.fillRect(s.ox + x * s.cell, s.oy + y * s.cell, s.cell, s.cell); },
    tick(s) {
      const { g, cols, rows } = s;
      for (let k = 0; k < s.p.speed; k++) {
        const i = s.y * cols + s.x;
        s.dir = g[i] ? (s.dir + 3) & 3 : (s.dir + 1) & 3;
        g[i] ^= 1;
        this.cellAt(s, s.x, s.y, g[i] ? C.fg : C.canvas);
        s.x = (s.x + DIRS[s.dir][0] + cols) % cols; s.y = (s.y + DIRS[s.dir][1] + rows) % rows;
        s.n++;
      }
      this.cellAt(s, s.x, s.y, C.sun);
      const phase = s.n < 500 ? 'symétrie' : s.n < 10000 ? 'chaos' : 'autoroute ?';
      s.say(`pas ${fr(s.n)} · ${phase}`);
    },
    redraw(s) {
      const { ctx, g, cols } = s;
      ctx.fillStyle = C.canvas; ctx.fillRect(0, 0, s.W, s.H);
      ctx.fillStyle = C.fg;
      for (let i = 0; i < g.length; i++) if (g[i]) ctx.fillRect(s.ox + (i % cols) * s.cell, s.oy + ((i / cols) | 0) * s.cell, s.cell, s.cell);
      this.cellAt(s, s.x, s.y, C.sun);
      s.say(`pas ${fr(s.n)}`);
    },
  });

  /* ================= 3. Automates élémentaires ================= */
  const rtable = document.getElementById('rtable');
  function drawRuleTable(rule) {
    if (!rtable) return;
    let h = '';
    for (let k = 7; k >= 0; k--) {
      const bits = [(k >> 2) & 1, (k >> 1) & 1, k & 1], out = (rule >> k) & 1;
      h += `<div class="rt"><div class="row">${bits.map((b) => `<i class="${b ? 'on' : ''}"></i>`).join('')}</div><div class="row out"><i class="${out ? 'on' : ''}"></i></div></div>`;
    }
    rtable.innerHTML = h;
  }
  Sim('cv-regle', {
    play: false,
    init(s) {
      s.cell = Math.max(2, Math.round(3 * s.d));
      s.cols = Math.floor(s.W / s.cell); s.rows = Math.floor(s.H / s.cell);
      s.ox = ((s.W - s.cols * s.cell) / 2) | 0;
      this.start(s, false);
    },
    start(s, random) {
      s.hist = new Uint8Array(s.cols * s.rows);
      s.row = new Uint8Array(s.cols);
      if (random) for (let i = 0; i < s.cols; i++) s.row[i] = rnd() < 0.5 ? 1 : 0; else s.row[s.cols >> 1] = 1;
      s.y = 0; s.busy = true;
      drawRuleTable(+s.p.rule);
      s.ctx.fillStyle = C.canvas; s.ctx.fillRect(0, 0, s.W, s.H);
      if (reduce) while (s.busy) this.tick(s);
    },
    act(s, a) { this.start(s, a === 'random'); },
    param(s) { this.start(s, false); },
    tick(s) {
      const rule = +s.p.rule, { cols, cell, ctx } = s;
      ctx.fillStyle = C.fg;
      for (let k = 0; k < 3 && s.y < s.rows; k++, s.y++) {
        const r = s.row, nx = new Uint8Array(cols);
        s.hist.set(r, s.y * cols);
        for (let x = 0; x < cols; x++) {
          if (r[x]) ctx.fillRect(s.ox + x * cell, s.y * cell, cell, cell);
          const idx = (r[(x - 1 + cols) % cols] << 2) | (r[x] << 1) | r[(x + 1) % cols];
          nx[x] = (rule >> idx) & 1;
        }
        s.row = nx;
      }
      if (s.y >= s.rows) s.busy = false;
    },
    redraw(s) {
      const { ctx, hist, cols, cell } = s;
      ctx.fillStyle = C.canvas; ctx.fillRect(0, 0, s.W, s.H);
      ctx.fillStyle = C.fg;
      for (let i = 0; i < s.y * cols; i++) if (hist[i]) ctx.fillRect(s.ox + (i % cols) * cell, ((i / cols) | 0) * cell, cell, cell);
    },
  });

  /* ================= 4. La nuée (boids) ================= */
  Sim('cv-nuee', {
    init(s) {
      const n = Math.round(Math.min(160, Math.max(60, (s.W * s.H) / (s.d * s.d) / 2400)));
      s.b = Array.from({ length: n }, () => {
        const a = rnd() * Math.PI * 2;
        return { x: rnd() * s.W, y: rnd() * s.H, vx: Math.cos(a) * 2 * s.d, vy: Math.sin(a) * 2 * s.d, hue: rnd() < 0.12 };
      });
      s.ctx.fillStyle = C.canvas; s.ctx.fillRect(0, 0, s.W, s.H);
      if (!s.running) this.draw(s);
    },
    act(s, a) { if (a === 'reset') this.init(s); },
    tick(s) {
      const { b, W, H, d } = s, R = 48 * d, R2 = R * R, RS = 16 * d, RS2 = RS * RS;
      const ws = s.p.sep, wa = s.p.ali, wc = s.p.coh, vmax = 2.6 * d, vmin = 1.1 * d;
      for (const p of b) {
        let n = 0, ax = 0, ay = 0, cx = 0, cy = 0, sx = 0, sy = 0;
        for (const o of b) {
          if (o === p) continue;
          let dx = o.x - p.x, dy = o.y - p.y;
          dx -= W * Math.round(dx / W); dy -= H * Math.round(dy / H);
          const d2 = dx * dx + dy * dy;
          if (d2 > R2) continue;
          n++; ax += o.vx; ay += o.vy; cx += dx; cy += dy;
          if (d2 < RS2 && d2 > 0.01) { const f = RS / d2; sx -= dx * f; sy -= dy * f; }
        }
        if (n) {
          p.vx += (ax / n - p.vx) * 0.06 * wa + (cx / n) * 0.0035 * wc;
          p.vy += (ay / n - p.vy) * 0.06 * wa + (cy / n) * 0.0035 * wc;
        }
        p.vx += sx * 0.045 * ws + (rnd() - 0.5) * 0.06 * d;
        p.vy += sy * 0.045 * ws + (rnd() - 0.5) * 0.06 * d;
        const sp = Math.hypot(p.vx, p.vy) || 1;
        const k = sp > vmax ? vmax / sp : sp < vmin ? vmin / sp : 1;
        p.vx *= k; p.vy *= k;
      }
      for (const p of b) { p.x = (p.x + p.vx + W) % W; p.y = (p.y + p.vy + H) % H; }
      this.draw(s);
    },
    draw(s) {
      const { ctx, b, d } = s, [r, g, bl] = hex(C.canvas);
      ctx.fillStyle = `rgba(${r},${g},${bl},0.28)`; ctx.fillRect(0, 0, s.W, s.H);
      const L = 7 * d, Wd = 3.2 * d;
      for (const hueOn of [false, true]) {
        ctx.fillStyle = hueOn ? C.sun : C.fg;
        ctx.beginPath();
        for (const p of b) {
          if (p.hue !== hueOn) continue;
          const sp = Math.hypot(p.vx, p.vy) || 1, ux = p.vx / sp, uy = p.vy / sp;
          ctx.moveTo(p.x + ux * L, p.y + uy * L);
          ctx.lineTo(p.x - ux * L * 0.6 - uy * Wd, p.y - uy * L * 0.6 + ux * Wd);
          ctx.lineTo(p.x - ux * L * 0.6 + uy * Wd, p.y - uy * L * 0.6 - ux * Wd);
          ctx.closePath();
        }
        ctx.fill();
      }
    },
    redraw(s) { s.ctx.fillStyle = C.canvas; s.ctx.fillRect(0, 0, s.W, s.H); this.draw(s); },
  });

  /* ================= 5. Le tournesol ================= */
  const GOLD = 180 * (3 - Math.sqrt(5)); // 137,507…°
  Sim('cv-tournesol', {
    play: false,
    init(s) {
      s.N = 1100; s.c = (0.47 * Math.min(s.W, s.H)) / Math.sqrt(s.N);
      this.act(s, 'reset');
    },
    act(s, a, btn) {
      if (a === 'golden') {
        s.p.angle = GOLD;
        const inp = s.fig.querySelector('[data-p="angle"]'); if (inp) inp.value = GOLD.toFixed(2);
        this.full(s); return;
      }
      if (a === 'reset') { s.n = 0; s.busy = true; this.clear(s); this.label(s); if (reduce) this.full(s); }
    },
    param(s) { this.full(s); },
    label(s) {
      const off = s.p.angle - GOLD;
      s.say(Math.abs(off) < 0.006 ? `${fr(GOLD, 3)}° — angle d'or` : `${fr(s.p.angle, 2)}° (${off > 0 ? '+' : '−'}${fr(Math.abs(off), 2)}°)`);
    },
    clear(s) { s.ctx.fillStyle = C.canvas; s.ctx.fillRect(0, 0, s.W, s.H); },
    dot(s, i) {
      const { ctx, c, N } = s, a = (i * s.p.angle * Math.PI) / 180, r = c * Math.sqrt(i);
      const t = Math.sqrt(i / N), [r1, g1, b1] = hex(C.sun), [r2, g2, b2] = hex(C.coral);
      ctx.fillStyle = `rgb(${r1 + (r2 - r1) * t | 0},${g1 + (g2 - g1) * t | 0},${b1 + (b2 - b1) * t | 0})`;
      ctx.beginPath(); ctx.arc(s.W / 2 + r * Math.cos(a), s.H / 2 + r * Math.sin(a), c * 0.42, 0, 6.2832); ctx.fill();
    },
    full(s) { this.clear(s); for (let i = 1; i <= s.N; i++) this.dot(s, i); s.n = s.N; s.busy = false; this.label(s); },
    tick(s) {
      for (let k = 0; k < 9 && s.n < s.N; k++) this.dot(s, ++s.n);
      if (s.n >= s.N) s.busy = false;
    },
    redraw(s) { this.clear(s); for (let i = 1; i <= s.n; i++) this.dot(s, i); },
  });

  /* ================= 6. Mandelbrot ================= */
  Sim('cv-mandelbrot', {
    play: false, maxDpr: 1.5,
    init(s) {
      if (!s.view) s.view = { x: -0.62, y: 0, w: 3.1, zoom: 1 };
      s.img = s.ctx.createImageData(s.W, s.H);
      this.palette(s); this.start(s);
    },
    palette(s) {
      const stops = [C.canvas, C.coral, C.sun, C.fg, C.sun, C.coral].map(hex);
      s.pal = new Uint8Array(256 * 3);
      for (let i = 0; i < 256; i++) {
        const t = (i / 256) * stops.length, k = Math.floor(t), f = t - k, a = stops[k], b = stops[(k + 1) % stops.length];
        for (let c = 0; c < 3; c++) s.pal[i * 3 + c] = a[c] + (b[c] - a[c]) * f;
      }
      s.inside = hex(C.dark ? C.canvas : C.fg);
    },
    start(s) {
      s.y = 0; s.busy = true;
      s.maxIt = Math.min(1500, Math.round(110 + 45 * Math.log2(s.view.zoom)));
      s.say(`zoom ×${fr(s.view.zoom)}`);
      if (reduce) while (s.busy) this.tick(s);
    },
    act(s, a) {
      if (a === 'reset') s.view = { x: -0.62, y: 0, w: 3.1, zoom: 1 };
      if (a === 'out' && s.view.zoom > 1) { s.view.w *= 3; s.view.zoom /= 3; }
      this.start(s);
    },
    pointer(s, x, y, phase) {
      if (phase !== 'down') return;
      const v = s.view, sc = v.w / Math.min(s.W, s.H);
      v.x += (x - s.W / 2) * sc; v.y += (y - s.H / 2) * sc; v.w /= 3; v.zoom *= 3;
      this.start(s);
    },
    tick(s) {
      const { W, H, img, pal, maxIt } = s, data = img.data, v = s.view, sc = v.w / Math.min(W, H);
      const t0 = performance.now(), y0 = s.y, [ir, ig, ib] = s.inside;
      while (s.y < H && performance.now() - t0 < 11) {
        const ci = v.y + (s.y - H / 2) * sc;
        for (let x = 0; x < W; x++) {
          const cr = v.x + (x - W / 2) * sc;
          let zr = 0, zi = 0, zr2 = 0, zi2 = 0, it = 0;
          // Cardioïde et bulbe principal : dedans, sans calcul
          const q = (cr - 0.25) ** 2 + ci * ci;
          if (q * (q + (cr - 0.25)) <= 0.25 * ci * ci || (cr + 1) ** 2 + ci * ci <= 0.0625) it = maxIt;
          else while (zr2 + zi2 <= 256 && it < maxIt) { zi = 2 * zr * zi + ci; zr = zr2 - zi2 + cr; zr2 = zr * zr; zi2 = zi * zi; it++; }
          const o = (s.y * W + x) * 4;
          if (it >= maxIt) { data[o] = ir; data[o + 1] = ig; data[o + 2] = ib; }
          else {
            const mu = it + 1 - Math.log2(Math.log(zr2 + zi2) / 2);
            const pi = (Math.floor(((Math.sqrt(Math.max(mu, 0)) * 0.035) % 1) * 255)) * 3;
            data[o] = pal[pi]; data[o + 1] = pal[pi + 1]; data[o + 2] = pal[pi + 2];
          }
          data[o + 3] = 255;
        }
        s.y++;
      }
      s.ctx.putImageData(img, 0, 0, 0, y0, W, s.y - y0);
      if (s.y >= H) s.busy = false;
    },
    redraw(s) { this.palette(s); this.start(s); },
  });

  /* ================= 7. La planche de Galton ================= */
  const binom = (n, k) => { let r = 1; for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i; return r; };
  Sim('cv-galton', {
    init(s) {
      s.R = 12; s.gx = (s.W * 0.78) / s.R; s.gy = Math.min(s.gx * 0.8, (s.H * 0.5) / s.R);
      s.top = s.H * 0.07; s.base = s.H * 0.97; s.binTop = s.top + (s.R + 0.6) * s.gy;
      if (!s.bins) this.act(s, 'reset'); else this.draw(s);
    },
    act(s, a) { if (a === 'reset') { s.bins = new Array(s.R + 1).fill(0); s.balls = []; s.total = 0; s.f = 0; this.draw(s); } },
    param(s) { this.act(s, 'reset'); },
    px(s, k, j) { return s.W / 2 + (j - k / 2) * s.gx; },
    tick(s) {
      if (++s.f % 2 === 0 && s.balls.length < 90) s.balls.push({ k: 0, j: 0, t: 0, dir: rnd() < s.p.p ? 1 : 0 });
      for (let i = s.balls.length - 1; i >= 0; i--) {
        const b = s.balls[i];
        b.t += 0.16;
        if (b.t >= 1) {
          b.t = 0; b.j += b.dir; b.k++;
          if (b.k >= s.R) { s.bins[b.j]++; s.total++; s.balls.splice(i, 1); continue; }
          b.dir = rnd() < s.p.p ? 1 : 0;
        }
      }
      this.draw(s);
    },
    draw(s) {
      const { ctx, R, gx, gy, top, bins, d } = s;
      ctx.fillStyle = C.canvas; ctx.fillRect(0, 0, s.W, s.H);
      // clous
      ctx.fillStyle = C.muted;
      for (let k = 0; k < R; k++) for (let j = 0; j <= k; j++) { ctx.beginPath(); ctx.arc(this.px(s, k, j), top + k * gy, 1.6 * d, 0, 6.2832); ctx.fill(); }
      // bacs
      const binH = s.base - s.binTop, maxC = Math.max(1, ...bins), exp = bins.map((_, k) => s.total * binom(R, k) * s.p.p ** k * (1 - s.p.p) ** (R - k));
      const unit = Math.min(3.2 * d, binH / Math.max(maxC, ...exp, 1));
      ctx.fillStyle = C.fg;
      for (let k = 0; k <= R; k++) {
        const x = this.px(s, R, k), h = bins[k] * unit;
        ctx.fillRect(x - gx * 0.38, s.base - h, gx * 0.76, h);
      }
      ctx.strokeStyle = C.line; ctx.lineWidth = d;
      ctx.beginPath(); ctx.moveTo(this.px(s, R, 0) - gx / 2, s.base + 0.5 * d); ctx.lineTo(this.px(s, R, R) + gx / 2, s.base + 0.5 * d); ctx.stroke();
      // courbe théorique
      if (s.total > 0) {
        ctx.strokeStyle = C.coral; ctx.lineWidth = 2 * d; ctx.beginPath();
        exp.forEach((e, k) => { const x = this.px(s, R, k), y = s.base - e * unit; k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
        ctx.stroke();
      }
      // billes
      ctx.fillStyle = C.sun;
      for (const b of s.balls) {
        const x0 = this.px(s, b.k, b.j), x1 = this.px(s, b.k + 1, b.j + b.dir), t = b.t;
        const x = x0 + (x1 - x0) * t, y = top + (b.k + t * t) * gy - Math.sin(t * Math.PI) * gy * 0.35;
        ctx.beginPath(); ctx.arc(x, y - 3 * d, 2.6 * d, 0, 6.2832); ctx.fill();
      }
      s.say(`${fr(s.total)} bille${s.total > 1 ? 's' : ''}`);
    },
    redraw(s) { this.draw(s); },
  });

  /* ================= 8. Le jeu du chaos ================= */
  const JUMP = { 3: 0.5, 4: 0.5, 5: 0.618, 6: 2 / 3 };
  Sim('cv-chaos', {
    init(s) { this.act(s, 'reset'); },
    act(s, a) {
      if (a !== 'reset') return;
      const n = +s.p.shape, R = Math.min(s.W, s.H) * 0.46, cx = s.W / 2, cy = s.H / 2 + (n === 3 ? R * 0.12 : 0);
      s.v = Array.from({ length: n }, (_, k) => {
        const a = -Math.PI / 2 + (k * 2 * Math.PI) / n + (n === 4 ? Math.PI / 4 : 0);
        return [cx + R * Math.cos(a), cy + R * Math.sin(a)];
      });
      s.x = cx; s.y = cy; s.count = 0; s.warm = 0;
      const { ctx } = s;
      ctx.fillStyle = C.canvas; ctx.fillRect(0, 0, s.W, s.H);
      ctx.fillStyle = C.muted;
      for (const [x, y] of s.v) { ctx.beginPath(); ctx.arc(x, y, 3 * s.d, 0, 6.2832); ctx.fill(); }
      s.say('0 point');
      if (reduce) for (let i = 0; i < 60; i++) this.tick(s, 0, true);
    },
    param(s) { this.act(s, 'reset'); },
    tick(s, _t, force) {
      if (s.count > 220000) { s.running = false; s.sync(); return; }
      const { ctx, v } = s, jump = JUMP[v.length], d = Math.max(1, s.d * 0.9);
      const cols = [C.sun, C.coral, C.fg, C.sun, C.coral, C.fg];
      const buckets = v.map(() => []);
      for (let k = 0; k < 700; k++) {
        const i = (rnd() * v.length) | 0;
        s.x += (v[i][0] - s.x) * jump; s.y += (v[i][1] - s.y) * jump;
        if (++s.warm > 20) { buckets[i].push(s.x, s.y); s.count++; }
      }
      ctx.globalAlpha = 0.75;
      buckets.forEach((pts, i) => { ctx.fillStyle = cols[i]; for (let k = 0; k < pts.length; k += 2) ctx.fillRect(pts[k], pts[k + 1], d, d); });
      ctx.globalAlpha = 1;
      s.say(`${fr(s.count)} points`);
    },
    redraw(s) { this.act(s, 'reset'); },
  });

  /* ---------- Démarrage ---------- */
  for (const s of sims) { io.observe(s.cv); ro.observe(s.cv); }
  requestAnimationFrame(loop);

  /* ---------- Thème ---------- */
  const btn = document.querySelector('.theme');
  const syncTheme = () => {
    const light = root.dataset.theme === 'light';
    btn.setAttribute('aria-pressed', String(light));
    btn.querySelector('.sr').textContent = light ? 'Thème sombre' : 'Thème clair';
    document.querySelector('meta[name="theme-color"]').content = light ? '#f6f2e9' : '#0f0e0c';
  };
  syncTheme();
  btn.addEventListener('click', () => {
    root.dataset.theme = root.dataset.theme === 'light' ? 'dark' : 'light';
    try { localStorage.setItem('kiss-theme', root.dataset.theme); } catch (e) { /* pas de stockage : tant pis */ }
    syncTheme(); readColors();
    for (const s of sims) if (s.W && s.def.redraw) s.def.redraw(s);
  });

  /* ---------- Navigation : section courante ---------- */
  const links = [...document.querySelectorAll('.top nav a')];
  const navIo = new IntersectionObserver((es) => {
    for (const e of es) if (e.isIntersecting) {
      links.forEach((a) => a.classList.toggle('on', a.hash === '#' + e.target.id));
      const on = links.find((a) => a.classList.contains('on')), ol = on && on.closest('ol');
      if (ol && ol.scrollWidth > ol.clientWidth) ol.scrollTo({ left: on.offsetLeft - ol.clientWidth / 2 + on.offsetWidth / 2, behavior: reduce ? 'auto' : 'smooth' });
    }
  }, { rootMargin: '-45% 0px -50% 0px' });
  document.querySelectorAll('section.xp').forEach((sec) => navIo.observe(sec));
})();
