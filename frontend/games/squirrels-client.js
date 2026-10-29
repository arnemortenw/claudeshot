// Rabid Squirrels - the client. Draws what the server sends: the Moonlit Oak
// terrain with every crater, the squirrels, the shot and the HUD. Sends the
// active player's keys and slingshot aim on "squirrels-input".
//
// The terrain's shape comes from SQUIRRELS_RULES.makeTerrain, the same mask
// the server plays on, so what you see is what the shot hits. The art is
// ported from design v8 and only coloured in where that mask is solid.
//
// For now the whole hill is on screen at once. The follow camera, toy art and
// the full HUD come in the next piece.

(function () {
  const R = window.SQUIRRELS_RULES;
  const { SW, SH, K, W, H, WATER, G, SIZE } = R;
  const Z = SW / W;                         // world to canvas
  const FONT = "Bangers, Impact, 'Arial Black', sans-serif";
  const SEND_AIM_MS = 60;

  let S = null;                             // everything for the running match

  // ---------------------------------------------------------------- art helpers
  function ell(c, x, y, rx, ry, rot = 0) { c.beginPath(); c.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); }
  function rr(c, x, y, w, h, r) { c.beginPath(); c.roundRect ? c.roundRect(x, y, w, h, r) : c.rect(x, y, w, h); }
  function mix(hex, amt) {
    const n = parseInt(hex.slice(1), 16), t = amt < 0 ? 0 : 255, p = Math.abs(amt);
    const c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => Math.round(v + (t - v) * p));
    return `rgb(${c[0]},${c[1]},${c[2]})`;
  }
  const hash = (x, y) => ((Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1 + 1) % 1;

  // ---------------------------------------------------------------- Moonlit Oak art (design v8)
  const MW = SW, MH = SH;
  function ground(c, f, cols) {
    const g = c.createLinearGradient(0, 330, 0, MH); g.addColorStop(0, cols[0]); g.addColorStop(1, cols[1]);
    c.fillStyle = g; c.beginPath(); c.moveTo(0, MH + 60);
    for (let x = 0; x <= MW; x += 4) c.lineTo(x, Math.min(f(x), MH + 60));
    c.lineTo(MW, MH + 60); c.closePath(); c.fill();
    c.lineCap = "round"; c.lineJoin = "round";
    [[12, cols[2], 3], [5, cols[3], -2]].forEach(([lw, col, off]) => {
      c.strokeStyle = col; c.lineWidth = lw; c.beginPath(); let pen = false;
      for (let x = 0; x <= MW; x += 4) { const y = f(x) + off; if (y > MH - 10) { pen = false; continue; } pen ? c.lineTo(x, y) : c.moveTo(x, y); pen = true; }
      c.stroke();
    });
  }
  function nightSky(b, r) {
    const g = b.createLinearGradient(0, 0, 0, MH);
    g.addColorStop(0, "#141428"); g.addColorStop(0.55, "#26355f"); g.addColorStop(1, "#5a3d5c");
    b.fillStyle = g; b.fillRect(0, 0, MW, MH);
    for (let i = 0; i < 80; i++) { b.fillStyle = `rgba(255,255,255,${0.2 + r() * 0.5})`; b.fillRect(r() * MW, r() * MH * 0.45, 1.5, 1.5); }
  }
  function bgNight(b, r) {
    nightSky(b, r);
    b.fillStyle = "#f5e9c8"; b.beginPath(); b.arc(380, 150, 32, 0, 7); b.fill();
    b.fillStyle = "#1f2b50"; b.beginPath(); b.arc(367, 140, 27, 0, 7); b.fill();
    [[0.62, "#1d2748", 70], [0.7, "#18203b", 52]].forEach(([base, col, sz]) => {
      b.fillStyle = col;
      for (let x = -20; x < MW + 20; x += sz * 0.55 + r() * sz * 0.5) {
        const h = sz * (1.4 + r() * 1.3), y = MH * base + Math.sin(x * 0.01) * 20;
        b.beginPath(); b.moveTo(x, y - h); b.lineTo(x - sz * 0.42, y); b.lineTo(x + sz * 0.42, y); b.fill();
        b.fillRect(x - 3, y - 2, 6, MH);
      }
      b.fillRect(0, MH * base + 20, MW, MH);
    });
  }
  function decoOak(c, r) {
    c.fillStyle = "#140d07"; rr(c, 560, 345, 120, 64, 28); c.fill();
    [[615, 128, 98, 0], [515, 172, 62, 1], [718, 150, 72, 1], [560, 90, 58, 0], [676, 92, 62, 1], [455, 212, 40, 0], [800, 186, 46, 0]].forEach(([x, y, rad, k]) => {
      c.fillStyle = k ? "#1e3a28" : "#244a31"; c.beginPath(); c.arc(x, y, rad, 0, 7); c.fill();
      c.fillStyle = "rgba(140,200,140,.10)"; c.beginPath(); c.arc(x - rad * 0.25, y - rad * 0.3, rad * 0.6, 0, 7); c.fill();
    });
    for (let i = 0; i < 30; i++) { c.fillStyle = `rgba(255,240,140,${0.5 + r() * 0.5})`; c.beginPath(); c.arc(430 + r() * 400, 60 + r() * 200, 1 + r() * 1.2, 0, 7); c.fill(); }
  }
  function terrainOak(c, r) {
    const f = R.oakGround;
    ground(c, f, ["#8a5530", "#3e2414", "#4e8d36", "#6ab04c"]);
    for (let i = 0; i < 16; i++) { const x = r() * MW, y = f(x) + 35 + r() * 140; if (y > MH) continue; c.fillStyle = r() > 0.5 ? "#5d5a58" : "#6e6a66"; ell(c, x, y, 8 + r() * 14, 6 + r() * 9, r()); c.fill(); }
    const bark = c.createLinearGradient(530, 0, 700, 0); bark.addColorStop(0, "#3f2613"); bark.addColorStop(0.5, "#7a4f2a"); bark.addColorStop(1, "#3f2613");
    c.fillStyle = bark; c.beginPath(); c.moveTo(505, 432); c.quadraticCurveTo(565, 410, 575, 330); c.lineTo(592, 140); c.lineTo(643, 140); c.lineTo(660, 330); c.quadraticCurveTo(672, 410, 732, 432); c.closePath(); c.fill();
    c.strokeStyle = "rgba(30,15,5,.45)"; c.lineWidth = 2; for (let i = 0; i < 7; i++) { const x = 590 + i * 9; c.beginPath(); c.moveTo(x, 150); c.quadraticCurveTo(x + (i % 2 ? 6 : -6), 250, x - 4 + i, 330); c.stroke(); }
    c.lineCap = "round"; c.strokeStyle = "#5b391c";
    c.lineWidth = 18; c.beginPath(); c.moveTo(605, 262); c.quadraticCurveTo(530, 230, 452, 232); c.stroke();
    c.beginPath(); c.moveTo(638, 218); c.quadraticCurveTo(720, 190, 808, 196); c.stroke();
    c.lineWidth = 11; c.beginPath(); c.moveTo(612, 150); c.lineTo(588, 96); c.stroke();
    c.save(); c.globalCompositeOperation = "destination-out"; rr(c, 560, 345, 120, 64, 28); c.fill(); ell(c, 1070, f(1070) + 48, 56, 22); c.fill(); c.restore();
    [[268, 1], [1048, 0.8]].forEach(([x, s]) => {
      const gy = f(x);
      c.fillStyle = "#efe6d6"; rr(c, x - 8 * s, gy - 62 * s, 16 * s, 66 * s, 5); c.fill();
      c.fillStyle = "#d64545"; c.beginPath(); c.ellipse(x, gy - 60 * s, 40 * s, 24 * s, 0, Math.PI, 0); c.closePath(); c.fill();
      c.fillStyle = "#fff"; [[-20, -70], [4, -78], [22, -68], [-6, -66]].forEach(([dx, dy]) => { ell(c, x + dx * s, gy + dy * s, 5 * s, 3.5 * s); c.fill(); });
    });
    c.lineCap = "round"; c.strokeStyle = "#6e6a66"; c.lineWidth = 22;
    c.beginPath(); c.moveTo(92, f(92) + 8); c.bezierCurveTo(100, f(92) - 125, 222, f(230) - 125, 232, f(232) + 8); c.stroke();
    c.strokeStyle = "#5b391c"; c.lineWidth = 14; c.beginPath(); c.moveTo(578, 338); c.quadraticCurveTo(520, 318, 452, 328); c.stroke();
    const ly = Math.min(f(945), f(1000)) - 46;
    c.fillStyle = "#6e6a66"; ell(c, 945, f(945) - 14, 14, 20); c.fill(); ell(c, 1000, f(1000) - 14, 14, 20); c.fill();
    c.fillStyle = "#6b4423"; rr(c, 922, ly - 12, 100, 22, 11); c.fill();
    c.fillStyle = "#c99a62"; ell(c, 1019, ly - 1, 5, 10); c.fill();
  }

  // Paints the map art, then keeps it only where the shared mask is solid.
  // Solid pixels the art left empty get plain dirt, so nothing solid is invisible.
  function buildTerrain() {
    const mk = (w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; };
    const bg = mk(SW, SH), deco = mk(W, H), t = mk(W, H), r = R.mulberry(11);
    const dc = deco.getContext("2d"), tc = t.getContext("2d", { willReadFrequently: true });
    dc.scale(K, K); tc.scale(K, K);
    const bc = bg.getContext("2d");
    bgNight(bc, r); decoOak(dc, r); terrainOak(tc, r);
    // pop-art halftone over the sky, denser towards the top
    for (let y = 4; y < SH; y += 8) for (let x = (y / 8) % 2 ? 4 : 0; x < SW; x += 8) {
      bc.fillStyle = `rgba(255,255,255,${0.05 * (1 - y / SH)})`; bc.beginPath(); bc.arc(x, y, 1.6, 0, 7); bc.fill();
    }
    tc.setTransform(1, 0, 0, 1, 0, 0);
    const mask = R.makeTerrain("oak");
    const img = tc.getImageData(0, 0, W, H), d = img.data, amt = 0.2;
    for (let j = 0; j < W * H; j++) {
      const i = j * 4;
      if (!mask[j]) { d[i + 3] = 0; continue; }
      if (d[i + 3] < 110) { d[i] = 0x6b; d[i + 1] = 0x44; d[i + 2] = 0x23; }
      const k = 1 - amt / 2 + hash(j % W, (j / W) | 0) * amt;
      d[i] = Math.min(255, d[i] * k); d[i + 1] = Math.min(255, d[i + 1] * k); d[i + 2] = Math.min(255, d[i + 2] * k); d[i + 3] = 255;
    }
    tc.putImageData(img, 0, 0);
    return { bg, deco, t, tc, img, mask };
  }

  function carve(c) {
    const T = S.terrain, d = T.img.data, { x: cx, y: cy, r } = c;
    R.crater(T.mask, cx, cy, r);
    const x0 = Math.max(0, (cx - r - 6) | 0), x1 = Math.min(W - 1, (cx + r + 6) | 0);
    const y0 = Math.max(0, (cy - r - 6) | 0), y1 = Math.min(H - 1, (cy + r + 6) | 0);
    if (x1 < x0 || y1 < y0) return;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const j = y * W + x, i = j * 4;
      if (!T.mask[j]) { d[i + 3] = 0; continue; }
      const dist = Math.hypot(x - cx, y - cy);
      if (dist < r + 6) { d[i] *= 0.72; d[i + 1] *= 0.68; d[i + 2] *= 0.66; }
    }
    T.tc.putImageData(T.img, 0, 0, x0, y0, x1 - x0 + 1, y1 - y0 + 1);
  }

  // ---------------------------------------------------------------- squirrels
  // A plain rabid squirrel on a stand in its player's colour. The toys come later.
  function drawSquirrel(c, color, face, t, blink) {
    const OL = "rgba(48,24,8,.9)", fur = "#c97b3d", dark = "#8e4f22", muzzle = "#f3d3a4";
    c.save();
    c.fillStyle = mix(color, -0.4); ell(c, 0, 1.2, 15, 4.6); c.fill();
    c.fillStyle = color; ell(c, 0, -0.5, 15, 4); c.fill();
    c.scale(face, 1);
    c.lineWidth = 1.2; c.strokeStyle = OL; c.lineJoin = "round";
    c.beginPath(); c.moveTo(-4, -10); c.bezierCurveTo(-27, -8, -31, -41, -18, -53); c.bezierCurveTo(-8, -61, 5, -53, -4, -46); c.bezierCurveTo(-12, -42, -14, -27, -2, -20); c.closePath();
    c.fillStyle = dark; c.fill(); c.stroke();
    c.fillStyle = dark; rr(c, -3, -8, 6, 8, 2.5); c.fill(); c.stroke(); rr(c, 5, -8, 6, 8, 2.5); c.fill(); c.stroke();
    ell(c, 3, -18, 10.5, 12); c.fillStyle = fur; c.fill(); c.stroke();
    ell(c, 6, -17, 5.5, 8); c.fillStyle = muzzle; c.fill();
    ell(c, 1.5, -50, 3.6, 6.8, -0.35); c.fillStyle = fur; c.fill(); c.stroke();
    ell(c, 8, -38, 12.5, 12.5); c.fillStyle = fur; c.fill(); c.stroke();
    ell(c, 14.5, -33.5, 7.6, 6); c.fillStyle = muzzle; c.fill(); c.stroke();
    ell(c, 21.2, -36.2, 2.9, 2.2); c.fillStyle = "#2b1408"; c.fill();
    if (blink) { c.lineWidth = 1.6; c.beginPath(); c.moveTo(9, -41.5); c.lineTo(17.5, -41.5); c.stroke(); }
    else {
      ell(c, 13.2, -42, 4.7, 5.9); c.fillStyle = "#fff"; c.fill(); c.stroke();
      ell(c, 14.4, -41.4, 3, 3.2); c.fillStyle = "#c0392b"; c.fill();
      ell(c, 14.8, -41.3, 1.6, 1.8); c.fillStyle = "#111"; c.fill();
    }
    c.lineWidth = 2.4; c.strokeStyle = "#3a1a0a"; c.beginPath(); c.moveTo(9.2, -49.2); c.lineTo(17.6, -46.4); c.stroke();
    c.fillStyle = "#fff"; c.strokeStyle = "rgba(150,200,230,.9)"; c.lineWidth = 0.6;
    for (let i = 0; i < 4; i++) { const a = t / 9 + i * 1.6; ell(c, 20 + Math.cos(a) * 2.6, -27 + Math.sin(a * 1.3) * 1.6 + i * 0.8, 1.4, 1.4); c.fill(); c.stroke(); }
    c.restore();
  }
  function drawGrave(c, color) {
    c.fillStyle = mix(color, -0.4); ell(c, 0, 1.2, 13, 4); c.fill();
    c.fillStyle = color; ell(c, 0, -0.4, 13, 3.6); c.fill();
    c.strokeStyle = "#4a4f5c"; c.lineWidth = 1.4;
    c.beginPath(); c.moveTo(-10, -1); c.lineTo(-10, -18); c.quadraticCurveTo(-10, -32, 0, -32); c.quadraticCurveTo(10, -32, 10, -18); c.lineTo(10, -1); c.closePath();
    c.fillStyle = "#9aa0ad"; c.fill(); c.stroke();
    c.fillStyle = "#4a4f5c"; c.font = `8px ${FONT}`; c.textAlign = "center"; c.fillText("RIP", 0, -15);
  }

  // ---------------------------------------------------------------- page
  const CSS = `
  body.sq-active .page-center{padding:0.6rem 1rem !important;}
  body.sq-active .game-area-card{padding:0.6rem !important;}
  body.sq-active .logo,body.sq-active .tagline,body.sq-active #round-indicator{display:none !important;}
  body.sq-active #game-area{width:100%;}
  @font-face{font-family:"Bangers";src:url("assets/fonts/Bangers-Regular.ttf") format("truetype");font-display:swap;}
  .sq-wrap{width:100%;max-width:min(1200px,calc((100vh - 200px) * 1.875));min-width:640px;margin:0 auto;font-family:${FONT};text-align:left;letter-spacing:.04em;}
  .sq-teams{display:flex;flex-wrap:wrap;gap:.55rem;margin-bottom:.6rem;}
  .sq-team{flex:1 1 150px;background:#fffbe8;color:#111;border-radius:4px;padding:.35rem .6rem .45rem;border:3px solid #111;box-shadow:4px 4px 0 #111;transition:transform .15s;}
  .sq-team.turn{background:var(--c);transform:rotate(-1.5deg) translateY(-2px);box-shadow:6px 6px 0 #111;}
  .sq-team.out{opacity:.4;filter:grayscale(1);}
  .sq-team .tn{display:flex;align-items:center;gap:.4rem;font-size:1.35rem;line-height:1;}
  .sq-team .tn i{width:14px;height:14px;border-radius:50%;background:var(--c);border:2px solid #111;}
  .sq-team .tn small{margin-left:auto;font-size:.95rem;background:#e94560;color:#fff;padding:0 .35rem;border:2px solid #111;transform:rotate(4deg);}
  .sq-row{display:flex;align-items:center;gap:.35rem;font-size:.95rem;margin-top:.2rem;line-height:1;}
  .sq-row .n{width:62px;overflow:hidden;white-space:nowrap;}
  .sq-row .bar{flex:1;height:10px;background:#fff;border:2px solid #111;border-radius:2px;overflow:hidden;}
  .sq-row .bar b{display:block;height:100%;background:var(--c);transition:width .4s;}
  .sq-team.turn .sq-row .bar b{background:#111;}
  .sq-row .hp{width:28px;text-align:right;}
  .sq-row.dead{opacity:.45;text-decoration:line-through;}
  .sq-stage{position:relative;width:100%;aspect-ratio:1200/640;border-radius:6px;overflow:hidden;border:4px solid #111;box-shadow:7px 7px 0 #111;user-select:none;touch-action:none;}
  .sq-stage canvas{display:block;width:100%;height:100%;cursor:crosshair;}
  .sq-hud{position:absolute;inset:0;pointer-events:none;color:#111;}
  .sq-top{position:absolute;top:10px;left:50%;transform:translateX(-50%);display:flex;gap:.6rem;align-items:stretch;}
  .sq-timer{width:64px;height:64px;border-radius:50%;background:#f7c948;display:grid;place-items:center;font-size:2.3rem;line-height:1;border:4px solid #111;box-shadow:4px 4px 0 #111;color:#111;padding-top:3px;}
  .sq-timer.low{background:#e94560;color:#fff;animation:sq-shake .25s infinite alternate;}
  .sq-timer.idle{background:#d8d2c0;}
  @keyframes sq-shake{from{transform:rotate(-6deg) scale(1.05);}to{transform:rotate(6deg) scale(1.12);}}
  .sq-box{background:#fffbe8 radial-gradient(rgba(0,0,0,.13) 1.2px,transparent 1.4px) 0 0/7px 7px;border:3px solid #111;box-shadow:4px 4px 0 #111;border-radius:3px;padding:.3rem .65rem;font-size:1.05rem;line-height:1;text-align:center;min-width:130px;display:flex;flex-direction:column;justify-content:center;gap:.3rem;}
  .sq-meter{position:relative;height:10px;background:#fff;border:2px solid #111;border-radius:2px;}
  .sq-meter b{position:absolute;top:0;height:100%;background:#4fc3f7;}
  .sq-wind .sq-meter::after{content:"";position:absolute;left:50%;top:-4px;bottom:-4px;width:3px;margin-left:-1px;background:#111;}
  .sq-steps .sq-meter b{left:0;background:#7bc043;}
  .sq-round{min-width:0;background-color:#e94560;color:#fff;font-size:1.25rem;align-items:center;transform:rotate(-2deg);text-shadow:2px 2px 0 #111;}
  .sq-dots{display:flex;gap:.3rem;}
  .sq-dots i{width:12px;height:12px;border-radius:50%;border:2px solid #111;background:#fff;box-sizing:border-box;}
  .sq-dots i.done{background:var(--c);opacity:.6;}
  .sq-dots i.now{background:var(--c);transform:scale(1.35);}
  .sq-watch{position:absolute;bottom:50px;left:50%;transform:translateX(-50%) rotate(-1deg);font-size:1.3rem;background:#fffbe8;border:3px solid #111;box-shadow:3px 3px 0 #111;padding:.15rem .8rem;color:#111;white-space:nowrap;opacity:0;transition:opacity .2s;}
  .sq-watch.show{opacity:1;}
  .sq-banner{position:absolute;left:50%;top:40%;transform:translate(-50%,-50%) scale(.6) rotate(-4deg);text-align:center;opacity:0;transition:opacity .2s,transform .3s cubic-bezier(.3,1.8,.5,1);white-space:nowrap;}
  .sq-banner.show{opacity:1;transform:translate(-50%,-50%) scale(1) rotate(-4deg);}
  .sq-banner .big{display:inline-block;font-size:5rem;line-height:1;padding:.15em .45em .05em;background:#fffbe8 radial-gradient(rgba(233,69,96,.35) 2px,transparent 2.4px) 0 0/10px 10px;border:5px solid #111;box-shadow:8px 8px 0 #111;-webkit-text-stroke:3px #111;paint-order:stroke fill;text-shadow:4px 4px 0 #111;}
  .sq-banner .sub{display:inline-block;font-size:1.5rem;margin-top:.7rem;background:#111;color:#fff;padding:.15rem .7rem;transform:rotate(3deg);}
  .sq-how{position:absolute;bottom:12px;left:50%;transform:translateX(-50%);font-size:1.05rem;background:#111;color:#fff;padding:.2rem .8rem;white-space:nowrap;border:2px solid #fff;}
  .sq-keys{position:absolute;top:12px;left:12px;font-size:.82rem;color:#111;line-height:1.15;background:#fffbe8;border:3px solid #111;box-shadow:3px 3px 0 #111;padding:.3rem .55rem;}
  .sq-end{position:absolute;right:14px;bottom:14px;pointer-events:auto;background:#e94560;color:#fff;border:3px solid #111;border-radius:3px;font:inherit;font-size:1.45rem;letter-spacing:.05em;padding:.25rem .9rem .1rem;cursor:pointer;box-shadow:4px 4px 0 #111;transform:rotate(-2deg);text-shadow:2px 2px 0 #111;}
  .sq-end:hover{transform:rotate(-2deg) scale(1.06);}
  .sq-end:active{transform:rotate(-2deg) translate(3px,3px);box-shadow:1px 1px 0 #111;}
  .sq-reconnect{position:absolute;inset:0;z-index:5;display:none;place-items:center;background:rgba(10,12,30,.55);pointer-events:auto;}
  .sq-reconnect.show{display:grid;}
  .sq-reconnect div{text-align:center;color:#111;background:#fffbe8;border:5px solid #111;box-shadow:8px 8px 0 #111;padding:.6rem 1.4rem .4rem;transform:rotate(-3deg);}
  .sq-reconnect big{display:block;font-size:3.4rem;line-height:1;color:#4fc3f7;-webkit-text-stroke:3px #111;paint-order:stroke fill;text-shadow:4px 4px 0 #111;}
  .sq-reconnect small{display:block;font-size:1.2rem;margin-top:.3rem;}
  .sq-below{display:flex;justify-content:space-between;color:#c9d1dd;font-size:1.05rem;margin-top:.7rem;}
  `;

  function el(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  const esc = (s) => String(s).replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));

  function buildPage(room) {
    const area = document.getElementById("game-area");
    area.innerHTML = "";
    const style = el("style"); style.textContent = CSS; document.head.appendChild(style);
    document.body.classList.add("sq-active");
    const wrap = el("div", "sq-wrap");
    wrap.innerHTML = `
      <div class="sq-teams" id="sq-teams"></div>
      <div class="sq-stage" id="sq-stage">
        <canvas id="sq-cv" width="${SW}" height="${SH}"></canvas>
        <div class="sq-hud">
          <div class="sq-top">
            <div class="sq-timer idle" id="sq-timer">30</div>
            <div class="sq-box sq-wind"><span id="sq-wind-label">WIND</span><div class="sq-meter"><b id="sq-wind-bar"></b></div></div>
            <div class="sq-box sq-round"><span id="sq-round-label">ROUND 1</span><span class="sq-dots" id="sq-dots"></span></div>
            <div class="sq-box sq-steps"><span id="sq-steps-label">STEPS</span><div class="sq-meter"><b id="sq-steps-bar"></b></div></div>
          </div>
          <div class="sq-watch" id="sq-watch"></div>
          <div class="sq-banner" id="sq-banner"><div class="big" id="sq-banner-big"></div><div class="sub" id="sq-banner-sub"></div></div>
          <div class="sq-keys">← → walk · Space jump<br>Drag to aim · Enter ends turn</div>
          <div class="sq-how" id="sq-how">${R.WEAPONS.bazooka.icon} ${R.WEAPONS.bazooka.how}</div>
          <button class="sq-end" id="sq-end" style="display:none">End turn ⏎</button>
        </div>
        <div class="sq-reconnect" id="sq-reconnect"><div><big>RECONNECTING…</big><small id="sq-reconnect-sub"></small></div></div>
      </div>
      <div class="sq-below"><span id="sq-below">Room ${esc(room.code)} · Moonlit Oak</span><span>🌊 The river kills · last player standing wins</span></div>`;
    area.appendChild(wrap);
    return { style, wrap };
  }

  // ---------------------------------------------------------------- state from the server
  function onInit(data) {
    S.players = data.players;
    S.names = data.names;
    S.perPlayer = data.perPlayer;
    S.me = (S.players.find((p) => p.id === S.socket.id) || S.players.find((p) => p.name === S.myName) || {}).slot;
    if (S.me == null) S.me = -1;
    // craters we haven't carved yet
    for (const c of data.craters) if (c.i === S.carved) { carve(c); S.carved++; }
    S.syncing = false;
    buildTeams();
    onState(data);
    if (data.over) onOver(data.over);
    const who = S.players.map((p) => esc(p.name)).join(" vs ");
    document.getElementById("sq-below").innerHTML = `Room ${esc(S.room.code)} · ${who} · ${S.perPlayer} squirrels each · Moonlit Oak`;
  }

  function onState(st) {
    if (!S.players) return;
    for (const e of st.ev || []) onEvent(e);
    if (st.nc > S.carved && !S.syncing) { S.syncing = true; S.socket.emit("squirrels-input", { t: "hello" }); }
    const prevTurn = S.st && S.st.turnNo;
    S.st = st;
    // the squirrels' drawn positions chase the server's
    st.sq.forEach((q, i) => {
      const d = S.disp[i];
      if (!d || Math.hypot(d.x - q.x, d.y - q.y) > 90) S.disp[i] = { x: q.x, y: q.y };
    });
    if (!st.shot) S.shotDisp = null;
    else if (!S.shotDisp || Math.hypot(S.shotDisp.x - st.shot.x, S.shotDisp.y - st.shot.y) > 120) S.shotDisp = { x: st.shot.x, y: st.shot.y };
    if (prevTurn !== st.turnNo || st.ph !== "aim") S.drag = null;
    if (!myTurn() && S.dir) S.dir = 0;
    renderHud();
  }

  function onEvent(e) {
    if (e.k === "crater") {
      if (e.i === S.carved) { carve(e); S.carved++; }
      boomParticles(e.x, e.y, e.r);
      S.shake = Math.min(18, 6 + e.r / 4);
      addBurst(e.x, e.y, pickWord(BOOM_WORDS), "#f7c948", "#e94560", e.r);
    } else if (e.k === "pop") {
      S.popups.push({ x: e.x, y: e.y, text: e.text, color: e.color, size: e.size, life: 90 });
    } else if (e.k === "splash") {
      if (e.big) addBurst(e.x, WATER, pickWord(SPLASH_WORDS), "#4fc3f7", "#fffbe8", 30);
      for (let i = 0; i < (e.big ? 24 : 12); i++) S.particles.push({ x: e.x, y: WATER, vx: (Math.random() - 0.5) * 5, vy: -Math.random() * 6, life: 50, color: "#9fd3ea", size: 3, g: 0.25 });
    } else if (e.k === "banner") {
      showBanner(e.big, e.sub, e.color, e.ms);
    }
  }

  // Comic sound-effect bursts: a jagged star with a big outlined word on top.
  const BOOM_WORDS = ["WHAM!", "KA-BOOM!", "POW!", "BLAM!", "KRAK!", "THWACK!"];
  const SPLASH_WORDS = ["SPLOOSH!", "GLUB!", "SPLASH!"];
  const pickWord = (a) => a[Math.floor(Math.random() * a.length)];
  // x, y is the impact in world px; r how big it was. The burst goes beside it.
  function addBurst(x, y, word, fill, ring, r = 40) {
    S.bursts.push({ x, y, r, word, fill, ring, life: 100, rot: (Math.random() - 0.5) * 0.3, seed: Math.random() * 100 });
  }
  function star(ctx, r, spikes, jag, seed) {
    ctx.beginPath();
    for (let i = 0; i < spikes * 2; i++) {
      const a = (i / (spikes * 2)) * Math.PI * 2;
      const rad = i % 2 ? r * jag : r * (0.92 + 0.16 * Math.abs(Math.sin(seed + i * 1.7)));
      ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad * 0.72);
    }
    ctx.closePath();
  }
  // The burst sits beside the impact, never on it, so everyone still sees the
  // crater, the damage and who goes flying. Squirrels fly away from a blast, so
  // it takes the side away from the nearest squirrel (or the side with more
  // room), stays clear of the HUD at the top, and speed lines point at the hit.
  function placeBurst(b, R) {
    const ix = b.x * Z, iy = b.y * Z;
    const clear = Math.max(80, b.r * Z * 1.6 + 40);       // keep this far from the impact
    const fits = (cx) => cx - R >= 8 && cx + R <= SW - 8;
    let side = ix < SW / 2 ? 1 : -1;
    let near = null, nd = 160;
    (S.st ? S.st.sq : []).forEach((q) => {
      const d = Math.hypot(q.x - b.x, q.y - 20 - b.y);
      if (!q.drowned && d < nd) { nd = d; near = q; }
    });
    if (near && Math.abs(near.x - b.x) > 2) side = near.x > b.x ? -1 : 1;
    let cx = ix + side * (clear + R);
    if (!fits(cx)) { side = -side; cx = ix + side * (clear + R); }
    cx = Math.max(R + 8, Math.min(SW - R - 8, cx));
    const cy = Math.max(120 + R * 0.72, Math.min(SH - 90 - R * 0.72, iy - 85));
    return { cx, cy, ix, iy, side };
  }
  function drawBurst(ctx, b) {
    b.life--;
    const t = 100 - b.life, k = t < 6 ? 0.4 + t * 0.12 : 1 + (t - 6) * 0.002;
    ctx.save();
    ctx.font = `36px ${FONT}`;
    const r = Math.max(56, ctx.measureText(b.word).width * 0.72), R = r * 1.15;
    if (!b.at) b.at = placeBurst(b, R);
    const { cx, cy, ix, iy } = b.at;
    ctx.globalAlpha = Math.max(0, Math.min(1, b.life / 15));
    // speed lines from the burst towards the impact, stopping short of it
    const dx = ix - cx, dy = iy - cy, d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d;
    const from = R * 0.95, to = d - Math.max(55, b.r * Z * 1.6 + 18);
    if (to > from + 8) {
      ctx.strokeStyle = "#111"; ctx.lineCap = "round";
      [-14, 0, 14].forEach((off, i) => {
        const px = -uy * off, py = ux * off, end = to - (i === 1 ? 0 : 12);
        ctx.lineWidth = i === 1 ? 4 : 3;
        ctx.beginPath(); ctx.moveTo(cx + ux * from + px, cy + uy * from + py); ctx.lineTo(cx + ux * end + px, cy + uy * end + py); ctx.stroke();
      });
    }
    ctx.translate(cx, cy); ctx.rotate(b.rot); ctx.scale(k, k);
    ctx.lineJoin = "miter";
    star(ctx, r * 1.15, 14, 0.7, b.seed); ctx.fillStyle = b.ring; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = "#111"; ctx.stroke();
    star(ctx, r * 0.9, 12, 0.72, b.seed + 3); ctx.fillStyle = b.fill; ctx.fill(); ctx.lineWidth = 3; ctx.stroke();
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillStyle = "#111"; ctx.fillText(b.word, 3, 5);
    ctx.lineWidth = 6; ctx.lineJoin = "round"; ctx.strokeText(b.word, 0, 2);
    ctx.fillStyle = "#fff"; ctx.fillText(b.word, 0, 2);
    ctx.restore();
    ctx.textBaseline = "alphabetic";
  }

  function onOver(over) {
    try { sessionStorage.setItem("squirrelsResults", JSON.stringify(over)); } catch (e) { /* private mode */ }
  }

  function boomParticles(x, y, r) {
    for (let i = 0; i < r; i++) {
      const a = Math.random() * 6.28, sp = Math.random() * 7;
      S.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 2, life: 40 + Math.random() * 30, color: i % 3 ? "#7a4a2a" : "#5c8f3a", size: 1.5 + Math.random() * 2.5, g: 0.25 });
    }
    for (let i = 0; i < r / 3; i++) S.particles.push({ x, y, vx: (Math.random() - 0.5) * 3, vy: (Math.random() - 0.5) * 3, life: 30, color: i % 2 ? "#ffd166" : "#ff7b39", size: 4 + Math.random() * r / 7, g: 0, fire: true });
  }

  const myTurn = () => S.st && S.st.ph === "aim" && S.st.cur === S.me && S.me >= 0;
  const send = (data) => S.socket.emit("squirrels-input", data);
  const playerAlive = (slot) => S.st.sq.some((q, i) => S.names[i].p === slot && !q.dead);

  // ---------------------------------------------------------------- HUD
  function buildTeams() {
    const box = document.getElementById("sq-teams");
    box.innerHTML = S.players.map((p) => `
      <div class="sq-team" id="sq-team${p.slot}" style="--c:${p.color}">
        <div class="tn"><i></i>${esc(p.name)}${p.slot === S.me ? "<small>YOU</small>" : ""}</div>
        ${S.names.map((n, i) => n.p === p.slot ? `<div class="sq-row" id="sq-row${i}"><span class="n">${esc(n.name)}</span><span class="bar"><b></b></span><span class="hp"></span></div>` : "").join("")}
      </div>`).join("");
  }

  function renderHud() {
    const st = S.st, $ = (id) => document.getElementById(id);
    S.players.forEach((p) => {
      const box = $("sq-team" + p.slot);
      box.classList.toggle("turn", st.cur === p.slot && st.ph !== "over" && st.ph !== "loading");
      box.classList.toggle("out", !playerAlive(p.slot));
    });
    st.sq.forEach((q, i) => {
      const row = $("sq-row" + i);
      row.classList.toggle("dead", q.dead);
      row.querySelector("b").style.width = q.hp + "%";
      row.querySelector(".hp").textContent = q.hp;
    });
    const live = st.ph === "aim";
    const tm = $("sq-timer");
    tm.textContent = live || st.ph === "banner" ? st.timer : "–";
    tm.classList.toggle("low", live && st.timer <= 5);
    tm.classList.toggle("idle", !live);
    const w = st.wind;
    $("sq-wind-label").textContent = w === 0 ? "NO WIND" : `WIND ${w < 0 ? "◀" : ""} ${Math.abs(w * 10).toFixed(0)} ${w > 0 ? "▶" : ""}`;
    const bar = $("sq-wind-bar"); bar.style.width = Math.abs(w) * 50 + "%"; bar.style.left = w < 0 ? (50 + w * 50) + "%" : "50%";
    $("sq-round-label").textContent = `ROUND ${st.round}`;
    const dots = S.players.map((p) => playerAlive(p.slot)
      ? `<i title="${esc(p.name)}" class="${p.slot === st.cur && st.ph !== "over" ? "now" : st.played.includes(p.slot) ? "done" : ""}" style="--c:${p.color}"></i>` : "").join("");
    if ($("sq-dots").innerHTML !== dots) $("sq-dots").innerHTML = dots;
    $("sq-steps-label").textContent = `👣 STEPS ${Math.ceil(st.steps)}`;
    $("sq-steps-bar").style.width = (st.steps / R.MAX_STEPS) * 100 + "%";
    $("sq-end").style.display = myTurn() ? "" : "none";
    const cur = S.players[st.cur];
    const msg = st.ph === "loading" ? "Waiting for everyone to load…"
      : st.ph === "aim" ? (st.cur === S.me ? "Your turn — everyone is watching" : `${cur.name} is aiming…`)
      : st.ph === "flight" ? "Incoming!" : "";
    $("sq-watch").textContent = msg;
    $("sq-watch").classList.toggle("show", !!msg);
  }

  // A lost connection covers the stage until socket.io is back; game.js then
  // rejoins the room and the match is drawn afresh from the server.
  function setReconnecting(on) {
    const box = document.getElementById("sq-reconnect");
    if (!box) return;
    if (on) {
      document.getElementById("sq-reconnect-sub").textContent = myTurn() ? "Hang on, your turn is waiting" : "Hang on, getting you back in";
      S.keys = {};
      S.drag = null;
      S.dir = 0;
    }
    box.classList.toggle("show", on);
  }

  let bannerTimer = null;
  function showBanner(big, sub, color, ms) {
    const b = document.getElementById("sq-banner");
    if (!b) return;
    document.getElementById("sq-banner-big").textContent = big;
    document.getElementById("sq-banner-big").style.color = color;
    document.getElementById("sq-banner-sub").textContent = sub;
    b.classList.add("show");
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => b.classList.remove("show"), ms);
  }

  // ---------------------------------------------------------------- input
  function toCanvas(e) {
    const b = S.cv.getBoundingClientRect();
    return { x: ((e.clientX - b.left) / b.width) * SW, y: ((e.clientY - b.top) / b.height) * SH };
  }
  function currentAim() {
    const d = S.drag;
    return d ? R.aimFromDrag(d.x0, d.y0, d.x1, d.y1) : null;
  }

  function onKeyDown(e) {
    if (!S || e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
    if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Space"].includes(e.code)) e.preventDefault();
    S.keys[e.code] = true;
    if (!myTurn()) return;
    if (e.code === "Space" && !e.repeat) send({ t: "jump" });
    if (e.code === "Enter" && !e.repeat) send({ t: "end" });
    updateDir();
  }
  function onKeyUp(e) {
    if (!S) return;
    S.keys[e.code] = false;
    updateDir();
  }
  function onBlur() {
    if (!S) return;
    S.keys = {};
    updateDir();
  }
  function updateDir() {
    const k = S.keys;
    const dir = myTurn() ? (k.ArrowRight || k.KeyD ? 1 : 0) - (k.ArrowLeft || k.KeyA ? 1 : 0) : 0;
    if (dir !== S.dir) { S.dir = dir; send({ t: "move", dir }); }
  }

  function onPointerDown(e) {
    if (!myTurn()) return;
    const p = toCanvas(e);
    S.drag = { x0: p.x, y0: p.y, x1: p.x, y1: p.y };
    S.cv.setPointerCapture(e.pointerId);
  }
  function onPointerMove(e) {
    if (!S.drag) return;
    const p = toCanvas(e);
    S.drag.x1 = p.x; S.drag.y1 = p.y;
    const now = performance.now(), a = currentAim();
    if (a.len > 10 && now - S.aimSent > SEND_AIM_MS) { S.aimSent = now; send({ t: "aim", ang: a.ang, pow: a.pow }); }
  }
  function onPointerUp() {
    const a = currentAim();
    S.drag = null;
    if (!a || !myTurn()) return;
    if (a.len >= R.MIN_DRAG) send({ t: "fire", ang: a.ang, pow: a.pow });
    else send({ t: "aim", ang: a.ang, pow: 0 });
  }

  // ---------------------------------------------------------------- render
  function render() {
    const ctx = S.ctx, st = S.st, T = S.terrain;
    S.frame++;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(T.bg, 0, 0, SW, SH);
    if (!st) { S.raf = requestAnimationFrame(render); return; }

    // drawn positions ease towards the server's
    st.sq.forEach((q, i) => { const d = S.disp[i]; d.x += (q.x - d.x) * 0.4; d.y += (q.y - d.y) * 0.4; });
    if (st.shot && S.shotDisp) { S.shotDisp.x += (st.shot.x - S.shotDisp.x) * 0.5; S.shotDisp.y += (st.shot.y - S.shotDisp.y) * 0.5; }

    const sh = S.shake > 0.5 ? S.shake : 0;
    ctx.setTransform(Z, 0, 0, Z, (Math.random() - 0.5) * sh, (Math.random() - 0.5) * sh);
    ctx.drawImage(T.deco, 0, 0);
    ctx.drawImage(T.t, 0, 0);

    const act = st.act >= 0 ? st.sq[st.act] : null, actD = act ? S.disp[st.act] : null;
    // the aim: yours from your drag, anyone else's as the server relays it
    const aim = myTurn() ? (S.drag ? currentAim() : null) : st.ph === "aim" ? st.aim : null;
    if (act && aim && aim.pow > 0 && (!aim.len || aim.len > 10)) drawAim(ctx, actD, aim);

    if (act && st.ph === "aim") {
      const left = st.steps / R.MAX_STEPS;
      ctx.fillStyle = "rgba(0,0,0,.6)"; rr(ctx, actD.x - 22, actD.y + 8, 44, 7, 3.5); ctx.fill();
      ctx.fillStyle = "#7ec8e3"; rr(ctx, actD.x - 21, actD.y + 9, 42 * left, 5, 2.5); ctx.fill();
    }

    st.sq.forEach((q, i) => {
      if (q.drowned) return;
      const d = S.disp[i], color = S.players[S.names[i].p].color;
      ctx.save(); ctx.translate(d.x, d.y); ctx.scale(SIZE * 1.25, SIZE * 1.25);
      if (q.dead) drawGrave(ctx, color);
      else {
        const bob = i === st.act && st.ph !== "over" ? Math.sin(S.frame / 6) * 0.8 : 0;
        ctx.translate(0, bob);
        drawSquirrel(ctx, color, q.face, S.frame + i * 17, (S.frame + i * 37) % 220 < 7);
      }
      ctx.restore();
    });

    if (st.shot && S.shotDisp) {
      const p = S.shotDisp;
      if (S.frame % 2 === 0) S.particles.push({ x: p.x, y: p.y, vx: 0, vy: -0.3, life: 30, color: "rgba(220,220,230,.5)", size: 3, g: 0, smoke: true });
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(Math.atan2(st.shot.vy, st.shot.vx)); ctx.scale(1.4, 1.4);
      ctx.strokeStyle = "rgba(48,24,8,.9)"; ctx.lineWidth = 1;
      ell(ctx, 1, 0, 7, 5); ctx.fillStyle = "#a0612e"; ctx.fill(); ctx.stroke();
      ell(ctx, -5, 0, 3, 6); ctx.fillStyle = "#5e3a1a"; ctx.fill(); ctx.stroke();
      ctx.restore();
    }

    S.particles.forEach((p) => {
      p.x += p.vx; p.y += p.vy; p.vy += p.g; p.life--;
      if (p.smoke) p.size *= 1.03; if (p.fire) p.size *= 1.012;
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life / 25));
      ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, 7); ctx.fill();
    });
    ctx.globalAlpha = 1;
    S.particles = S.particles.filter((p) => p.life > 0);

    // the river
    const t = S.frame / 30;
    ctx.fillStyle = "rgba(15,52,96,.92)";
    ctx.beginPath(); ctx.moveTo(-60, H + 60);
    for (let x = -60; x <= W + 60; x += 16) ctx.lineTo(x, WATER + Math.sin(x * 0.03 + t) * 4);
    ctx.lineTo(W + 60, H + 60); ctx.fill();
    ctx.strokeStyle = "rgba(126,200,227,.6)"; ctx.lineWidth = 2; ctx.beginPath();
    for (let x = -60; x <= W + 60; x += 16) ctx.lineTo(x, WATER + Math.sin(x * 0.03 + t) * 4);
    ctx.stroke();

    // screen space: name tags and popups
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.textAlign = "center";
    st.sq.forEach((q, i) => {
      if (q.drowned) return;
      const d = S.disp[i], color = S.players[S.names[i].p].color;
      const x = d.x * Z, y = (d.y - 74 * SIZE) * Z;
      ctx.font = `15px ${FONT}`;
      const label = q.dead ? S.names[i].name : `${S.names[i].name} ${q.hp}`, lw = ctx.measureText(label).width + 14;
      // a comic caption box: cream, black border, hard shadow
      ctx.fillStyle = "#111"; ctx.fillRect(x - lw / 2 + 3, y - 17 + 3, lw, 20);
      ctx.fillStyle = q.dead ? "#d8d2c0" : "#fffbe8"; ctx.fillRect(x - lw / 2, y - 17, lw, 20);
      ctx.lineWidth = 2; ctx.strokeStyle = "#111"; ctx.strokeRect(x - lw / 2, y - 17, lw, 20);
      ctx.fillStyle = color; ctx.fillRect(x - lw / 2, y + 1, lw, 2);
      ctx.fillStyle = "#111"; ctx.fillText(label, x, y - 1.5);
      if (i === st.act && (st.ph === "aim" || st.ph === "banner")) {
        const by = y - 24 + Math.sin(S.frame / 8) * 4;
        ctx.beginPath(); ctx.moveTo(x - 10, by - 13); ctx.lineTo(x + 10, by - 13); ctx.lineTo(x, by); ctx.closePath();
        ctx.fillStyle = color; ctx.fill(); ctx.lineWidth = 2.5; ctx.stroke();
      }
    });
    S.bursts.forEach((b) => drawBurst(ctx, b));
    S.bursts = S.bursts.filter((b) => b.life > 0);
    S.popups.forEach((p) => {
      p.y -= 0.5; p.life--;
      const grow = p.life > 80 ? 1 + (p.life - 80) / 20 : 1;     // pops in big, then settles
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life / 30));
      ctx.font = `${Math.round(p.size * 1.6 * grow)}px ${FONT}`;
      ctx.lineJoin = "round";
      ctx.fillStyle = "#111"; ctx.fillText(p.text, p.x * Z + 3, p.y * Z + 3);
      ctx.lineWidth = 6; ctx.strokeStyle = "#111"; ctx.strokeText(p.text, p.x * Z, p.y * Z);
      ctx.fillStyle = p.text[0] === "-" ? "#f7c948" : p.color; ctx.fillText(p.text, p.x * Z, p.y * Z);
    });
    ctx.globalAlpha = 1;
    S.popups = S.popups.filter((p) => p.life > 0);

    if (myTurn() && !S.drag && act) {
      const hint = "Drag back to aim · let go to fire";
      ctx.font = `18px ${FONT}`;
      const hw = ctx.measureText(hint).width + 24;
      const x = Math.max(hw / 2 + 8, Math.min(SW - hw / 2 - 8, actD.x * Z));
      // above the squirrel, or below it when the HUD is in the way
      let y = (actD.y - 74 * SIZE) * Z - 64;
      if (y < 80) y = actD.y * Z + 26;
      ctx.fillStyle = "#111"; ctx.fillRect(x - hw / 2 + 3, y + 3, hw, 28);
      ctx.fillStyle = "#f7c948"; ctx.fillRect(x - hw / 2, y, hw, 28);
      ctx.lineWidth = 2.5; ctx.strokeStyle = "#111"; ctx.strokeRect(x - hw / 2, y, hw, 28);
      ctx.fillStyle = "#111"; ctx.fillText(hint, x, y + 21);
    }

    S.shake *= 0.85;
    S.raf = requestAnimationFrame(render);
  }

  // The slingshot band, the first part of the path (no wind) and the power bar.
  function drawAim(ctx, s, aim) {
    const w = R.WEAPONS.bazooka, sp = 3 + aim.pow * w.speed, ang = aim.ang;
    const hx = s.x, hy = s.y - 24, back = (aim.pow * R.POWER_DRAG * 0.3) / Z;
    ctx.strokeStyle = "rgba(160,100,50,.95)"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(hx - 6, hy - 6); ctx.lineTo(hx - Math.cos(ang) * back, hy - Math.sin(ang) * back); ctx.lineTo(hx + 6, hy + 6); ctx.stroke();
    let px = hx + Math.cos(ang) * 16, py = hy + Math.sin(ang) * 16, vx = Math.cos(ang) * sp, vy = Math.sin(ang) * sp;
    for (let i = 0; i < 26; i++) {
      vy += G; px += vx; py += vy;
      if (i % 2) continue;
      ctx.fillStyle = `rgba(255,255,255,${0.9 - i / 30})`; ctx.beginPath(); ctx.arc(px, py, (2.6 - i / 14) * 1.6, 0, 7); ctx.fill();
    }
    ctx.fillStyle = "rgba(0,0,0,.6)"; rr(ctx, hx - 30, hy + 40, 60, 10, 5); ctx.fill();
    ctx.fillStyle = aim.pow > 0.85 ? "#e94560" : "#f7c948"; rr(ctx, hx - 28, hy + 42, 56 * aim.pow, 6, 3); ctx.fill();
  }

  // ---------------------------------------------------------------- entry points
  window.initSquirrelsClient = function (socket, myId, room) {
    cleanupSquirrelsClient();
    try { sessionStorage.removeItem("squirrelsResults"); } catch (e) { /* private mode */ }
    const page = buildPage(room);
    const cv = document.getElementById("sq-cv");
    S = {
      socket, room, myName: sessionStorage.getItem("myName"), page, cv, ctx: cv.getContext("2d"),
      terrain: buildTerrain(), carved: 0, syncing: false, players: null, names: null, me: -1,
      st: null, disp: [], shotDisp: null, particles: [], popups: [], bursts: [], shake: 0, frame: 0,
      keys: {}, dir: 0, drag: null, aimSent: 0, raf: 0,
    };
    S.handlers = {
      init: onInit, state: onState, over: onOver,
      keydown: onKeyDown, keyup: onKeyUp, blur: onBlur,
      end: () => { if (myTurn()) send({ t: "end" }); },
      disconnect: () => setReconnecting(true),
      connect: () => setReconnecting(false),
    };
    socket.on("squirrels-init", S.handlers.init);
    socket.on("squirrels-state", S.handlers.state);
    socket.on("squirrels-over", S.handlers.over);
    socket.on("disconnect", S.handlers.disconnect);
    socket.on("connect", S.handlers.connect);
    window.addEventListener("keydown", S.handlers.keydown);
    window.addEventListener("keyup", S.handlers.keyup);
    window.addEventListener("blur", S.handlers.blur);
    cv.addEventListener("pointerdown", onPointerDown);
    cv.addEventListener("pointermove", onPointerMove);
    cv.addEventListener("pointerup", onPointerUp);
    cv.addEventListener("pointercancel", () => { if (S) S.drag = null; });
    document.getElementById("sq-end").addEventListener("click", S.handlers.end);
    if (document.fonts && document.fonts.load) document.fonts.load(`40px Bangers`).catch(() => {});
    send({ t: "hello" });
    S.raf = requestAnimationFrame(render);
  };

  window.cleanupSquirrelsClient = function () {
    if (!S) return;
    cancelAnimationFrame(S.raf);
    clearTimeout(bannerTimer);
    S.socket.off("squirrels-init", S.handlers.init);
    S.socket.off("squirrels-state", S.handlers.state);
    S.socket.off("squirrels-over", S.handlers.over);
    S.socket.off("disconnect", S.handlers.disconnect);
    S.socket.off("connect", S.handlers.connect);
    window.removeEventListener("keydown", S.handlers.keydown);
    window.removeEventListener("keyup", S.handlers.keyup);
    window.removeEventListener("blur", S.handlers.blur);
    S.page.style.remove();
    document.body.classList.remove("sq-active");
    S.page.wrap.remove();
    S = null;
  };
})();
