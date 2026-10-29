// Rabid Squirrels - the map art. Ported from design v8: each map's sky or
// wallpaper, its scenery and the look of its terrain, plus the hazard at the
// bottom. The shapes that are solid come from SQUIRRELS_RULES; the art here is
// painted, then kept only where the shared mask is solid, so what you see is
// what the server hits. Loaded by the lobby (map thumbnails) and the match,
// after squirrels-rules.js and squirrels-art.js, as window.SQUIRRELS_MAPS.

(function () {
  const R = window.SQUIRRELS_RULES;
  const { SW, SH, K, W, H, WATER } = R;
  const mix = window.SQUIRRELS_ART.mix;

  function ell(c, x, y, rx, ry, rot = 0) { c.beginPath(); c.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); }
  function rr(c, x, y, w, h, r) { c.beginPath(); c.roundRect ? c.roundRect(x, y, w, h, r) : c.rect(x, y, w, h); }
  const hash = (x, y) => ((Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1 + 1) % 1;
  function cloud(c, x, y, s, col) {
    c.fillStyle = col;
    [[0, 0, 22], [24, -8, 26], [50, 0, 20], [24, 6, 22], [-18, 6, 14], [68, 6, 13]].forEach(([dx, dy, rad]) => { c.beginPath(); c.arc(x + dx * s, y + dy * s, rad * s, 0, 7); c.fill(); });
  }

  // ---------------------------------------------------------------- Moonlit Oak
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


  // ---------------------------------------------------------------- Backyard BBQ
  function bgYard(b, r) {
    const g = b.createLinearGradient(0, 0, 0, MH); g.addColorStop(0, "#5bb8f5"); g.addColorStop(1, "#d8f1ff");
    b.fillStyle = g; b.fillRect(0, 0, MW, MH);
    const sun = b.createRadialGradient(1060, 90, 10, 1060, 90, 110); sun.addColorStop(0, "rgba(255,240,170,1)"); sun.addColorStop(0.35, "rgba(255,226,122,.9)"); sun.addColorStop(1, "rgba(255,226,122,0)");
    b.fillStyle = sun; b.fillRect(900, 0, 300, 240);
    for (let i = 0; i < 6; i++) cloud(b, 80 + i * 200 + r() * 60, 60 + r() * 90, 0.8 + r() * 0.6, "rgba(255,255,255,.9)");
    b.fillStyle = "#c65a4a"; b.fillRect(40, 200, 300, MH);
    b.fillStyle = "#5b3530"; b.beginPath(); b.moveTo(18, 205); b.lineTo(190, 100); b.lineTo(362, 205); b.fill();
    b.fillStyle = "#f4efe2"; [[80, 255], [230, 255]].forEach(([x, y]) => { b.fillRect(x - 4, y - 4, 78, 68); });
    b.fillStyle = "#ffe9a8"; [[80, 255], [230, 255]].forEach(([x, y]) => { b.fillRect(x, y, 70, 60); });
    b.fillStyle = "#f4efe2"; [[80, 255], [230, 255]].forEach(([x, y]) => { b.fillRect(x + 33, y, 4, 60); b.fillRect(x, y + 28, 70, 4); });
    b.fillStyle = "#3f8a3f"; b.fillRect(1100, 250, 18, 300); b.beginPath(); b.arc(1110, 240, 70, 0, 7); b.fill();
    b.fillStyle = "#4c9a4a"; for (let x = -20; x < MW + 40; x += 38 + r() * 20) { b.beginPath(); b.arc(x, 470, 30 + r() * 18, 0, 7); b.fill(); }
    b.fillRect(0, 470, MW, MH);
  }
  function terrainYard(c, r) {
    const f = R.yardGround;
    ground(c, f, ["#7a5434", "#3f2a19", "#4fae43", "#7fd16a"]);
    // the paddling pool's inflatable walls
    [[498, f(498)], [682, f(702)]].forEach(([x, gy]) => {
      const top = gy - 30; c.save(); rr(c, x, top, 20, MH - top, 10); c.clip();
      c.fillStyle = "#3fa3e8"; c.fillRect(x, top, 20, MH); c.fillStyle = "#fff"; for (let y = top + 8; y < MH; y += 18) c.fillRect(x, y, 20, 8);
      c.restore();
    });
    // sandbox
    const sy = f(240);
    c.fillStyle = "#f0d68a"; c.beginPath(); c.moveTo(160, sy + 6); c.lineTo(160, sy - 22); c.quadraticCurveTo(240, sy - 74, 320, sy - 22); c.lineTo(320, sy + 6); c.closePath(); c.fill();
    c.fillStyle = "rgba(160,120,50,.35)"; for (let i = 0; i < 40; i++) { const x = 170 + r() * 140; ell(c, x, sy - 10 - r() * 25, 1.4, 1.4); c.fill(); }
    c.fillStyle = "#9b6a3c"; rr(c, 148, sy - 36, 16, 56, 3); c.fill(); rr(c, 316, sy - 36, 16, 56, 3); c.fill();
    c.fillStyle = "#e94560"; c.beginPath(); c.moveTo(262, sy - 54); c.lineTo(290, sy - 54); c.lineTo(286, sy - 30); c.lineTo(266, sy - 30); c.closePath(); c.fill();
    // garden gnome
    const gx = 430, gy = f(430);
    c.fillStyle = "#3f6fd1"; c.beginPath(); c.moveTo(412, gy + 4); c.lineTo(448, gy + 4); c.lineTo(441, gy - 34); c.lineTo(419, gy - 34); c.closePath(); c.fill();
    c.fillStyle = "#f2c6a0"; ell(c, gx, gy - 40, 9, 8); c.fill();
    c.fillStyle = "#ffffff"; c.beginPath(); c.moveTo(418, gy - 38); c.lineTo(442, gy - 38); c.lineTo(430, gy - 12); c.closePath(); c.fill();
    c.fillStyle = "#e88f7a"; ell(c, gx + 3, gy - 41, 3, 3); c.fill();
    c.fillStyle = "#d93a3a"; c.beginPath(); c.moveTo(418, gy - 44); c.lineTo(442, gy - 44); c.lineTo(426, gy - 90); c.closePath(); c.fill();
    // picket fence
    const fy = f(830);
    c.fillStyle = "#e9e4d8"; c.fillRect(756, fy - 74, 106, 9); c.fillRect(756, fy - 36, 106, 9);
    for (let x = 760; x < 860; x += 22) { const py = f(x + 7); c.fillStyle = "#f6f3ea"; c.fillRect(x, py - 94, 14, 104); c.beginPath(); c.moveTo(x, py - 94); c.lineTo(x + 7, py - 106); c.lineTo(x + 14, py - 94); c.fill(); c.fillStyle = "rgba(0,0,0,.08)"; c.fillRect(x + 10, py - 94, 4, 104); }
    // grill
    const by = f(1040);
    c.strokeStyle = "#2b2b2b"; c.lineWidth = 5; c.lineCap = "round";
    c.beginPath(); c.moveTo(1010, by + 4); c.lineTo(1026, by - 48); c.moveTo(1070, by + 4); c.lineTo(1054, by - 48); c.stroke();
    c.fillStyle = "#2d2d2d"; c.beginPath(); c.ellipse(1040, by - 52, 42, 26, 0, 0, Math.PI); c.closePath(); c.fill();
    c.save(); c.translate(998, by - 52); c.rotate(-1.15); c.beginPath(); c.ellipse(42, 0, 42, 24, 0, Math.PI, Math.PI * 2); c.closePath(); c.fill(); c.restore();
    c.fillStyle = "#9a9a9a"; c.fillRect(998, by - 54, 84, 3);
    c.fillStyle = "#b5542c"; rr(c, 1012, by - 62, 22, 9, 4); c.fill(); rr(c, 1042, by - 62, 24, 9, 4); c.fill();
    // flower pot
    const py = f(96);
    c.strokeStyle = "#3f8a3f"; c.lineWidth = 3; [[86, -64], [96, -74], [106, -60]].forEach(([x, h]) => { c.beginPath(); c.moveTo(96, py - 26); c.lineTo(x, py + h); c.stroke(); });
    [[86, -64, "#ff6fa5"], [96, -74, "#ffd23f"], [106, -60, "#c084fc"]].forEach(([x, h, col]) => { c.fillStyle = col; for (let a = 0; a < 5; a++) { ell(c, x + Math.cos(a * 1.26) * 5, py + h + Math.sin(a * 1.26) * 5, 4, 4); c.fill(); } c.fillStyle = "#fff3b0"; ell(c, x, py + h, 2.5, 2.5); c.fill(); });
    c.fillStyle = "#c8643b"; c.beginPath(); c.moveTo(78, py - 30); c.lineTo(114, py - 30); c.lineTo(108, py + 4); c.lineTo(84, py + 4); c.closePath(); c.fill();
    c.fillStyle = "#a84f2c"; c.fillRect(76, py - 32, 40, 7);
    // cover: a doghouse to duck into, a picnic table and the tall bird feeder
    const dy = f(368);
    c.fillStyle = "#b5523b"; c.fillRect(334, dy - 60, 68, 66);
    c.fillStyle = "#6b3a2a"; c.beginPath(); c.moveTo(322, dy - 56); c.lineTo(368, dy - 98); c.lineTo(414, dy - 56); c.closePath(); c.fill();
    c.save(); c.globalCompositeOperation = "destination-out"; c.beginPath(); c.moveTo(352, dy - 2); c.lineTo(352, dy - 26); c.arc(368, dy - 26, 16, Math.PI, 0); c.lineTo(384, dy - 2); c.closePath(); c.fill(); c.restore();
    const ty = f(945);
    c.strokeStyle = "#8a5a2b"; c.lineWidth = 7; c.lineCap = "round";
    c.beginPath(); c.moveTo(905, f(905) + 4); c.lineTo(932, ty - 50); c.moveTo(985, f(985) + 4); c.lineTo(958, ty - 50); c.stroke();
    c.fillStyle = "#a86d35"; rr(c, 888, ty - 60, 114, 11, 3); c.fill();
    for (let i = 0; i < 9; i++) { c.fillStyle = i % 2 ? "#fff" : "#e94560"; c.fillRect(890 + i * 12.2, ty - 60, 12.2, 5); }
    const fy2 = f(1150);
    c.fillStyle = "#7a7a7a"; c.fillRect(1146, fy2 - 200, 8, 206);
    c.fillStyle = "#8a5a2b"; rr(c, 1122, fy2 - 208, 56, 9, 2); c.fill();
  }

  // ---------------------------------------------------------------- Kid's Bedroom
  function bgRoom(b, r) {
    const g = b.createLinearGradient(0, 0, 0, MH); g.addColorStop(0, "#5ea9e6"); g.addColorStop(1, "#7cbdf0");
    b.fillStyle = g; b.fillRect(0, 0, MW, MH);
    // cloud wallpaper
    for (let row = 0; row < 4; row++) for (let i = 0; i < 7; i++) cloud(b, i * 190 + (row % 2) * 95 + r() * 20 - 20, 50 + row * 150 + r() * 20, 0.75, "rgba(255,255,255,.92)");
    // the window at night
    b.fillStyle = "#f4f0e6"; b.fillRect(812, 62, 236, 186);
    const sky = b.createLinearGradient(0, 70, 0, 240); sky.addColorStop(0, "#1b2a5a"); sky.addColorStop(1, "#3a5a9a");
    b.fillStyle = sky; b.fillRect(822, 72, 216, 166);
    b.fillStyle = "#f5e9c8"; b.beginPath(); b.arc(990, 110, 16, 0, 7); b.fill();
    for (let i = 0; i < 14; i++) { b.fillStyle = "rgba(255,255,255,.8)"; b.fillRect(826 + r() * 205, 76 + r() * 155, 1.6, 1.6); }
    b.fillStyle = "#f4f0e6"; b.fillRect(927, 72, 6, 166); b.fillRect(822, 152, 216, 6);
    // the rocket poster
    b.fillStyle = "#f7c948"; b.fillRect(84, 70, 130, 170); b.fillStyle = "#16213e"; b.fillRect(92, 78, 114, 154);
    b.fillStyle = "#e94560"; b.beginPath(); b.moveTo(149, 98); b.lineTo(170, 150); b.lineTo(128, 150); b.closePath(); b.fill(); b.fillStyle = "#f0f0f0"; b.fillRect(134, 150, 30, 50); b.fillStyle = "#ff9f43"; b.beginPath(); b.moveTo(136, 200); b.lineTo(162, 200); b.lineTo(149, 222); b.fill();
    b.fillStyle = "#e8e2d6"; b.fillRect(0, 560, MW, MH);
  }
  function block(c, x, y, s, col, ch) {
    c.fillStyle = mix(col, -0.35); c.fillRect(x, y, s, s);          // the seam between blocks is solid, so it shows
    c.fillStyle = col; rr(c, x + 1, y + 1, s - 2, s - 2, 6); c.fill();
    c.strokeStyle = mix(col, -0.28); c.lineWidth = 3; rr(c, x + 6, y + 6, s - 12, s - 12, 4); c.stroke();
    c.fillStyle = "#fff"; c.font = `900 ${s * 0.5}px Nunito, Segoe UI, sans-serif`; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(ch, x + s / 2, y + s / 2 + 2);
  }
  function terrainRoom(c, r) {
    // bed
    c.fillStyle = "#a0662f"; rr(c, 12, 300, 26, MH, 8); c.fill(); rr(c, 300, 372, 22, MH, 6); c.fill();
    c.fillStyle = "#8a5526"; rr(c, 30, 436, 284, 20, 4); c.fill();
    c.fillStyle = "#f4f6fb"; rr(c, 30, 398, 284, 42, 10); c.fill();
    c.fillStyle = "#3b6fd1"; rr(c, 122, 391, 192, 74, 10); c.fill();
    c.fillStyle = "#f7c948"; [150, 196, 242, 288].forEach((x) => c.fillRect(x, 391, 9, 74));
    c.fillStyle = "#ffffff"; ell(c, 82, 392, 44, 16); c.fill();
    // letter blocks
    const cols = ["#e94560", "#f7c948", "#3a8bfd", "#4caf50", "#ff8c42", "#9b59b6"], letters = "NUTSABCDEF";
    R.roomBlocks().forEach(([x, y, s], k) => block(c, x, y, s, cols[k % 6], letters[k % 10]));
    // low shelf with a toy car and a piggy bank
    c.fillStyle = "#8a5526"; [[430, 1], [630, -1]].forEach(([x, d]) => { c.beginPath(); c.moveTo(x, 262); c.lineTo(x + d * 22, 262); c.lineTo(x, 302); c.closePath(); c.fill(); });
    c.fillStyle = "#b3773a"; rr(c, 400, 250, 260, 14, 3); c.fill();
    c.fillStyle = "#e94560"; rr(c, 450, 226, 58, 18, 6); c.fill(); c.fillStyle = "#ff8fa3"; rr(c, 462, 213, 32, 15, 5); c.fill();
    c.fillStyle = "#222"; ell(c, 464, 244, 7, 7); c.fill(); ell(c, 496, 244, 7, 7); c.fill();
    c.fillStyle = "#f6a5c0"; ell(c, 600, 230, 27, 19); c.fill(); ell(c, 625, 228, 7, 8); c.fill(); c.fillRect(584, 240, 7, 10); c.fillRect(608, 240, 7, 10);
    c.beginPath(); c.moveTo(586, 214); c.lineTo(592, 202); c.lineTo(598, 214); c.fill();
    c.fillStyle = "#222"; c.fillRect(592, 213, 14, 3);
    // book tower
    c.fillStyle = "#c0392b"; c.fillRect(608, 600, 180, MH - 600);
    R.roomBooks().forEach(([x, y, w, h, col]) => {
      c.fillStyle = col; rr(c, x, y, w, h, 4); c.fill();
      c.fillStyle = "rgba(255,255,255,.3)"; c.fillRect(x + 10, y + 4, 4, h - 8); c.fillRect(x + w - 14, y + 4, 4, h - 8);
      c.fillStyle = "rgba(0,0,0,.18)"; c.fillRect(x + w * 0.35, y + h * 0.3, w * 0.3, h * 0.4);
    });
    // toy box with a rocket poking out
    c.fillStyle = "#6d4523"; c.beginPath(); c.moveTo(838, 440); c.lineTo(1008, 440); c.lineTo(1022, 384); c.lineTo(852, 370); c.closePath(); c.fill();
    c.fillStyle = "#f4f6fb"; rr(c, 950, 358, 26, 90, 12); c.fill();
    c.fillStyle = "#e94560"; c.beginPath(); c.moveTo(950, 368); c.lineTo(976, 368); c.lineTo(963, 336); c.closePath(); c.fill();
    c.fillStyle = "#3a8bfd"; ell(c, 963, 388, 6, 6); c.fill();
    c.fillStyle = "#c98a3f"; rr(c, 828, 436, 184, MH, 6); c.fill();
    c.fillStyle = "rgba(80,45,15,.35)"; for (let yy = 466; yy < 600; yy += 32) c.fillRect(828, yy, 184, 3);
    c.fillStyle = "#9aa3ad"; [[828, 436], [994, 436]].forEach(([x, yy]) => c.fillRect(x, yy, 18, 18));
    // toy-brick stairs
    const bc = ["#e94560", "#3a8bfd", "#f7c948"];
    R.roomBricks().forEach(([x, top, rows], col) => {
      c.fillStyle = "#3b2a1a"; c.fillRect(x, top, 54, MH - top);
      for (let j = 0; j < rows; j++) { c.fillStyle = bc[(col + j) % 3]; rr(c, x, 600 - 30 * (j + 1), 52, 28, 3); c.fill(); }
      c.fillStyle = bc[(col + rows - 1) % 3]; rr(c, x + 8, top - 6, 13, 7, 2); c.fill(); rr(c, x + 31, top - 6, 13, 7, 2); c.fill();
    });
    // cover: a blanket fort over the bed, an open book as a tent, and the high shelf
    c.lineCap = "round"; c.strokeStyle = "#e94560"; c.lineWidth = 12;
    c.beginPath(); c.moveTo(128, 394); c.quadraticCurveTo(215, 248, 302, 394); c.stroke();
    c.strokeStyle = "#ffd6de"; c.lineWidth = 3; c.setLineDash([9, 9]); c.beginPath(); c.moveTo(128, 394); c.quadraticCurveTo(215, 248, 302, 394); c.stroke(); c.setLineDash([]);
    c.lineJoin = "round"; c.strokeStyle = "#2e86de"; c.lineWidth = 8;
    c.beginPath(); c.moveTo(628, 404); c.lineTo(697, 338); c.lineTo(766, 404); c.stroke();
    c.strokeStyle = "#fffdf4"; c.lineWidth = 3; c.beginPath(); c.moveTo(638, 404); c.lineTo(697, 348); c.lineTo(756, 404); c.stroke();
    c.fillStyle = "#8a5526"; c.beginPath(); c.moveTo(1070, 182); c.lineTo(1092, 182); c.lineTo(1070, 214); c.closePath(); c.fill();
    c.fillStyle = "#b3773a"; rr(c, 1060, 170, 130, 12, 3); c.fill();
  }

  // ---------------------------------------------------------------- ARK Nyåpning
  // The ARK bookstore on opening day (design v3 of the new map). The back of
  // the store is washed out and soft, everything solid gets a black ink
  // outline (see inkOf), and the hollows behind cover are dark, so you can
  // tell what you can stand on from what is only wallpaper.
  const ARK = R.ARK;
  function bgArk(b, r) {
    b.fillStyle = "#f3f0ea"; b.fillRect(0, 0, MW, MH);
    // the waffle ceiling
    b.fillStyle = "#2b2b2e"; b.fillRect(0, 0, MW, 78);
    b.strokeStyle = "#47474c"; b.lineWidth = 2;
    for (let x = 0; x < MW; x += 16) { b.beginPath(); b.moveTo(x, 0); b.lineTo(x + 6, 78); b.stroke(); }
    for (let y = 6; y < 78; y += 14) { b.beginPath(); b.moveTo(0, y); b.lineTo(MW, y); b.stroke(); }
    b.fillStyle = "#e7e5df"; b.fillRect(0, 78, MW, 22);
    b.fillStyle = "rgba(0,0,0,.12)"; b.fillRect(0, 100, MW, 4);
    // exit sign, track lights and downlights
    b.fillStyle = "#1f9d55"; rr(b, 40, 108, 70, 28, 3); b.fill();
    b.fillStyle = "#fff"; b.font = "900 20px Arial"; b.textAlign = "center"; b.textBaseline = "middle"; b.fillText("← 🏃", 75, 123);
    b.fillStyle = "#cfcfcf"; b.fillRect(250, 186, 700, 4);
    for (let x = 280; x < 940; x += 70) { b.fillStyle = "#e5e5e5"; rr(b, x, 190, 14, 18, 3); b.fill(); }
    for (let x = 150; x < 1100; x += 110) { const g = b.createRadialGradient(x, 104, 2, x, 104, 40); g.addColorStop(0, "rgba(255,250,220,.9)"); g.addColorStop(1, "rgba(255,250,220,0)"); b.fillStyle = g; b.fillRect(x - 40, 100, 80, 40); }
    // the back shelves, full of books
    b.fillStyle = "#2c5aa0"; b.fillRect(250, 222, 760, 18);
    b.fillStyle = "#fff"; b.font = "900 11px Arial"; [330, 520, 710, 900].forEach((x) => b.fillText("ROMANER", x, 232));
    b.fillStyle = "#fbfaf7"; b.fillRect(250, 240, 760, 308);
    for (let row = 0; row < 5; row++) {
      const y = 250 + row * 58;
      b.fillStyle = "#d9d6cf"; b.fillRect(250, y + 50, 760, 6);
      for (let x = 256; x < 1004;) {
        const w = 7 + r() * 9, h = 34 + r() * 14;
        b.fillStyle = ["#2a6fb0", "#c0392b", "#f39c12", "#16a085", "#8e44ad", "#2c3e50", "#e84393", "#f1c40f"][(r() * 8) | 0];
        b.fillRect(x, y + 50 - h, w - 1, h); x += w;
      }
    }
    for (let x = 250; x <= 1010; x += 152) { b.fillStyle = "#e3e0d8"; b.fillRect(x, 240, 6, 308); }
    // the greeting-card wall
    b.fillStyle = "#e9dcc4"; b.fillRect(1010, 230, 90, 318);
    for (let y = 240; y < 540; y += 26) for (let x = 1014; x < 1096; x += 20) { b.fillStyle = ["#ffd166", "#ef476f", "#06d6a0", "#118ab2", "#fff"][(r() * 5) | 0]; b.fillRect(x, y, 16, 22); }
    // the dark shaft under the floor, down to the shredder
    b.fillStyle = "#1b1b1f"; b.fillRect(0, ARK.floor, MW, MH - ARK.floor);
    b.fillStyle = "#2c2c33"; for (let y = ARK.floor + 8; y < MH; y += 12) b.fillRect(0, y, MW, 3);
    // the background sits far back: washed out, cooler and a little soft
    const flat = document.createElement("canvas"); flat.width = b.canvas.width; flat.height = b.canvas.height;
    flat.getContext("2d").drawImage(b.canvas, 0, 0);
    b.clearRect(0, 0, MW, MH); b.filter = "saturate(.35) brightness(.72) contrast(.8) blur(1.2px)"; b.drawImage(flat, 0, 0); b.filter = "none";
    b.fillStyle = "rgba(40,52,80,.28)"; b.fillRect(0, 0, MW, MH);
  }
  function decoArk(c) {
    // the wires the boards and the sign hang from
    c.strokeStyle = "#6f6f74"; c.lineWidth = 2;
    [[160, 0, 300], [260, 0, 300], [880, 0, 316], [980, 0, 316], [520, 0, 160], [690, 0, 160], [735, 0, 102]].forEach(([x, y0, y1]) => { c.beginPath(); c.moveTo(x, y0); c.lineTo(x, y1); c.stroke(); });
    // the hollows behind the cover are in deep shadow, so hiding spots read as holes
    c.fillStyle = "rgba(10,10,20,.62)";
    [[116, 500, 188, 48], [896, 514, 158, 34], [552, 260, 156, 288]].forEach(([x, y, w, h]) => c.fillRect(x, y, w, h));
  }
  function saleSkirt(c, x, y, w, h) {
    c.fillStyle = "#ffd400"; c.fillRect(x, y, w, h);
    c.fillStyle = "#e30613"; c.font = `400 ${h * 0.62}px Bangers, Impact, sans-serif`; c.textAlign = "center"; c.textBaseline = "middle";
    for (let k = 0; k < 2; k++) c.fillText("ARK NYÅPNING!", x + w * (k ? 0.75 : 0.25), y + h / 2 + 1);
    c.fillStyle = "#111"; c.fillRect(x, y, w, 2); c.fillRect(x, y + h - 2, w, 2);
  }
  function saleDot(c, cx, cy, rad, txt) {
    c.fillStyle = "#ff6a13"; c.beginPath(); c.arc(cx, cy, rad, 0, 7); c.fill();
    c.strokeStyle = "#fff"; c.lineWidth = 2; c.beginPath(); c.arc(cx, cy, rad - 3, 0, 7); c.stroke();
    c.fillStyle = "#fff"; c.font = `400 ${rad * 0.85}px Bangers, Impact, sans-serif`; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(txt, cx, cy + 1);
  }
  function arkLetterPath(c, kind, d) {
    if (kind === "poly") { c.beginPath(); d.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); }
    else if (kind === "rect") { c.beginPath(); c.rect(...d); }
    else rr(c, ...d);
  }
  function terrainArk(c, r) {
    const F = ARK.floor;
    // the shop floor: light wood under a red carpet, with two holes down to the shredder
    let x0 = 0;
    [...ARK.gaps, [MW, MW]].forEach(([a, b]) => {
      c.fillStyle = "#d9b47e"; c.fillRect(x0, F, a - x0, MH - F + 60);
      c.fillStyle = "rgba(120,80,30,.25)"; for (let y = F + 22; y < MH + 60; y += 16) c.fillRect(x0, y, a - x0, 2);
      for (let x = x0 + 30; x < a; x += 60) c.fillRect(x, F + 14, 2, MH);
      c.fillStyle = "#c8102e"; c.fillRect(x0, F, a - x0, 12); c.fillStyle = "#e0243f"; c.fillRect(x0, F, a - x0, 4);
      x0 = b;
    });
    // yellow balloon columns on grey bins
    for (const bx of [40, 1160]) { c.fillStyle = "#5b6670"; rr(c, bx - 30, 504, 60, 44, 4); c.fill(); c.fillStyle = "#6e7a84"; c.fillRect(bx - 30, 504, 60, 6); }
    for (const [cx, y] of R.arkBalloons()) {
      const g = c.createRadialGradient(cx - 7, y - 8, 3, cx, y, 24);
      g.addColorStop(0, "#fff7a8"); g.addColorStop(0.35, "#ffd400"); g.addColorStop(1, "#d9a800");
      c.fillStyle = g; ell(c, cx, y, 23, 21); c.fill();
    }
    // the sale tables: legs, a top and the sign skirt, hollow underneath
    c.fillStyle = "#e9e7e2"; c.fillRect(98, 470, 18, F - 470); c.fillRect(304, 470, 18, F - 470);
    c.fillStyle = "#f7f6f3"; rr(c, 90, 440, 240, 30, 3); c.fill(); c.fillStyle = "#d8d5ce"; c.fillRect(90, 466, 240, 4);
    saleSkirt(c, 90, 470, 240, 30);
    c.fillStyle = "#e9e7e2"; c.fillRect(878, 484, 18, F - 484); c.fillRect(1054, 484, 18, F - 484);
    c.fillStyle = "#f7f6f3"; rr(c, 870, 456, 210, 30, 3); c.fill();
    saleSkirt(c, 870, 486, 210, 28);
    // the card spinner
    c.fillStyle = "#9aa0a6"; c.fillRect(493, 470, 6, F - 470); c.fillRect(480, 542, 32, 6);
    c.fillStyle = "#e9dcc4"; rr(c, 476, 380, 40, 92, 3); c.fill();
    for (let y = 384; y < 466; y += 18) for (let x = 479; x < 512; x += 12) { c.fillStyle = ["#ffd166", "#ef476f", "#06d6a0", "#118ab2"][(r() * 4) | 0]; c.fillRect(x, y, 10, 15); }
    // the 10-kroner shelf: orange sides, four shelves, open in front
    c.fillStyle = "#ff8a1f"; c.fillRect(540, 250, 12, F - 250); c.fillRect(708, 250, 12, F - 250);
    c.fillStyle = "#ffb04a"; [250, 330, 410, 490].forEach((y) => c.fillRect(540, y, 180, 10));
    c.fillStyle = "#ff8a1f"; rr(c, 540, 206, 180, 46, 3); c.fill();
    saleDot(c, 585, 229, 19, "10"); saleDot(c, 675, 229, 19, "10");
    c.fillStyle = "#fff"; c.font = "900 11px Arial"; c.textAlign = "center"; c.fillText("KR", 630, 232);
    // the books on the tables and in the shelf
    for (const [x, y, w, h, col] of R.arkBooks()) { c.fillStyle = col; rr(c, x, y, w, h, 1.5); c.fill(); c.fillStyle = "rgba(255,255,255,.35)"; c.fillRect(x + 2, y + 2, w - 6, 1.5); }
    // the hanging −40% boards
    for (const [x, y, w] of ARK.boards) {
      c.fillStyle = "#ffd400"; c.fillRect(x, y, w, 26); c.fillStyle = "#111"; c.fillRect(x, y + 24, w, 2);
      c.fillStyle = "#e30613"; c.font = "400 16px Bangers, Impact, sans-serif"; c.textAlign = "left"; c.textBaseline = "middle"; c.fillText("HELE BUTIKKEN", x + 6, y + 13);
      saleDot(c, x + w + 4, y + 12, 22, "−40%");
    }
    // THE ENEMY: the ARK sign, letters with a teal side, and the orange logo
    c.fillStyle = "#3a3f44"; c.fillRect(480, 160, 220, 6);
    for (const [fill, dx] of [["#0b5d6b", 4], ["#e9fbff", 0]]) {
      c.save(); c.translate(dx, dx);
      for (const [op, kind, d] of R.arkLetters()) {
        c.globalCompositeOperation = op === "cut" ? "destination-out" : "source-over";
        c.fillStyle = fill; arkLetterPath(c, kind, d); c.fill();
      }
      c.restore();
    }
    const [lx, ly, lr] = ARK.logo;
    c.fillStyle = "#ff6a13"; c.beginPath(); c.arc(lx, ly, lr, 0, 7); c.fill();
    c.strokeStyle = "#fff"; c.lineWidth = 2.5; c.beginPath(); c.arc(lx, ly, lr - 4, 0, 7); c.stroke();
  }

  // A thick black outline round everything solid, with a drop shadow onto the
  // background, at world size. Rebuilt whenever a crater changes the terrain.
  function inkOf(L) {
    const mk = () => { const c = document.createElement("canvas"); c.width = W; c.height = H; return c; };
    const ink = L.inkTmp || (L.inkTmp = mk()), k = ink.getContext("2d");
    k.globalCompositeOperation = "source-over"; k.clearRect(0, 0, W, H);
    for (let a = 0; a < 16; a++) { const ang = (a * Math.PI) / 8; k.drawImage(L.t, Math.cos(ang) * 3.5 * K, Math.sin(ang) * 3.5 * K); }
    k.globalCompositeOperation = "source-in"; k.fillStyle = "#111"; k.fillRect(0, 0, W, H);
    const out = L.ink || mk(), o = out.getContext("2d");
    o.clearRect(0, 0, W, H);
    o.globalAlpha = 0.45; o.drawImage(ink, 7 * K, 8 * K); o.globalAlpha = 1; o.drawImage(ink, 0, 0);
    return (L.ink = out);
  }

  // The sign's own life, drawn by the match over the terrain, in world px.
  const solidD = (mask, x, y) => R.solid(mask, x * K, y * K);
  function arkLogoAlive(mask) {
    const [lx, ly] = ARK.logo;
    let n = 0;
    for (let dx = -12; dx <= 12; dx += 6) for (let dy = -12; dy <= 12; dy += 6) n += solidD(mask, lx + dx, ly + dy) ? 1 : 0;
    return n > 12;
  }
  // How much of the sign is still there, 0..1, counted on a coarse grid.
  function arkSignPx(mask) {
    const [x0, y0, x1, y1] = ARK.sign;
    let n = 0;
    for (let x = x0; x < x1; x += 3) for (let y = y0; y < y1; y += 3) n += solidD(mask, x, y) ? 1 : 0;
    return n;
  }
  // The logo's eyes follow (tx, ty), world px, and blink now and then.
  function drawArkEyes(ctx, mask, tx, ty, frame) {
    if (!arkLogoAlive(mask)) return;
    const [lx, ly] = ARK.logo, blink = frame % 180 < 6;
    ctx.save(); ctx.scale(K, K); tx /= K; ty /= K;
    for (const dx of [-12, 12]) {
      const ex = lx + dx, ey = ly - 2;
      ctx.fillStyle = "#fff"; ell(ctx, ex, ey, 8, blink ? 1.5 : 9); ctx.fill();
      if (!blink) { const a = Math.atan2(ty - ey, tx - ex); ctx.fillStyle = "#111"; ell(ctx, ex + Math.cos(a) * 4, ey + Math.sin(a) * 4, 3.5, 3.5); ctx.fill(); }
      ctx.strokeStyle = "#111"; ctx.lineWidth = 4; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(ex - Math.sign(dx) * 9, ey - 15); ctx.lineTo(ex + Math.sign(dx) * 8, ey - 8); ctx.stroke();
    }
    ctx.strokeStyle = "#111"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(lx - 10, ly + 18); ctx.quadraticCurveTo(lx, ly + 12, lx + 10, ly + 18); ctx.stroke();
    ctx.restore();
  }
  // What the sign says, in a speech bubble off its logo.
  function drawArkBubble(ctx, mask, text) {
    if (!arkLogoAlive(mask)) return;
    const [lx, ly, lr] = ARK.logo;
    ctx.save(); ctx.scale(K, K);
    ctx.font = "400 22px Bangers, Impact, sans-serif";
    // beside the logo, low enough to stay clear of the HUD panels in the whole-map view
    const w = ctx.measureText(text).width + 26, x = Math.min(MW - w - 10, lx + lr + 18), y = ly - 26;
    ctx.fillStyle = "#fff"; ctx.strokeStyle = "#111"; ctx.lineWidth = 3; ctx.lineJoin = "round";
    rr(ctx, x, y, w, 36, 6); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + 2, y + 8); ctx.lineTo(lx + lr - 2, ly - 4); ctx.lineTo(x + 2, y + 24); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#fff"; ctx.fillRect(x - 1, y + 10, 6, 12);
    ctx.fillStyle = "#e30613"; ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillText(text, x + 13, y + 19);
    ctx.restore();
  }
  // The kid on top of the K, peeing on the logo, like the car-window sticker.
  // He's scenery: shots go through him, and once the K under him is blown
  // away he's gone.
  function drawArkKid(ctx, mask, frame) {
    const x = ARK.kid.x;
    let y = 60;
    while (y < 140 && !solidD(mask, x, y)) y++;
    if (y >= 125) return;
    const c = ctx, t = frame, S = 1.5, [sx, sy] = ARK.kid.stream, ox = x + 9 * S, oy = y - 21 * S;
    c.save(); c.scale(K, K); c.lineJoin = "round"; c.lineCap = "round";
    // the stream: an arc onto the logo, dashes running down it, and splashes
    if (arkLogoAlive(mask)) {
      c.strokeStyle = "rgba(255,214,0,.9)"; c.lineWidth = 3.5; c.setLineDash([7, 4]); c.lineDashOffset = -t * 0.9;
      c.beginPath(); c.moveTo(ox, oy); c.quadraticCurveTo(ox + 26, oy - 22, sx, sy); c.stroke(); c.setLineDash([]);
      c.fillStyle = "#ffd600";
      for (let k = 0; k < 4; k++) { const a = -2.4 + k * 0.5 + Math.sin(t / 4 + k) * 0.2, d = 5 + ((t + k * 5) % 12) * 0.7; ell(c, sx + Math.cos(a) * d, sy + Math.sin(a) * d, 1.8, 1.8); c.fill(); }
      c.fillStyle = "rgba(255,214,0,.55)"; ell(c, sx + 4, sy + 6, 7, 3); c.fill();
    }
    c.strokeStyle = "#111"; c.lineWidth = 2.5 / S;
    c.translate(x, y); c.scale(S, S); c.translate(-x, -y);
    // sneakers, legs and shorts
    c.fillStyle = "#fff"; rr(c, x - 9, y - 5, 10, 5, 2); c.fill(); c.stroke(); rr(c, x + 1, y - 5, 10, 5, 2); c.fill(); c.stroke();
    c.fillStyle = "#f2c59b"; c.fillRect(x - 6, y - 14, 4, 9); c.fillRect(x + 3, y - 14, 4, 9);
    c.fillStyle = "#2d2d2d"; rr(c, x - 8, y - 22, 17, 10, 2); c.fill(); c.stroke();
    // striped shirt, leaning back a little
    c.save(); c.translate(x, y - 22); c.rotate(-0.12);
    rr(c, -9, -17, 18, 18, 4); c.save(); c.clip();
    for (let k = 0; k < 6; k++) { c.fillStyle = k % 2 ? "#111" : "#d7263d"; c.fillRect(-9, -17 + k * 3, 18, 3); }
    c.restore(); rr(c, -9, -17, 18, 18, 4); c.stroke();
    c.fillStyle = "#f2c59b"; ell(c, 10, -5, 3, 3); c.fill(); c.stroke();
    // head: big grin, eye squeezed shut, spiky hair
    c.fillStyle = "#f2c59b"; ell(c, 2, -26, 9, 9); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(4, -22); c.quadraticCurveTo(8, -18, 11, -23); c.stroke();
    c.beginPath(); c.moveTo(5, -29); c.lineTo(9, -28); c.stroke();
    c.fillStyle = "#ffcf3f"; c.beginPath(); c.moveTo(-9, -27);
    [[-12, -36], [-5, -33], [-6, -42], [0, -35], [3, -44], [5, -35], [11, -40], [9, -31], [11, -28]].forEach(([px, py]) => c.lineTo(px, py));
    c.closePath(); c.fill(); c.stroke();
    c.restore();
    c.restore();
  }

  // The returns shredder along the bottom, in world px: dark steel, hazard
  // stripes, turning blades and paper confetti drifting up out of the holes.
  function drawShredder(ctx, frame) {
    const t = frame, HZ = WATER / K, B = H / K + 40;
    ctx.save(); ctx.scale(K, K);
    const g = ctx.createLinearGradient(0, HZ, 0, B); g.addColorStop(0, "#3a3d44"); g.addColorStop(1, "#16171a");
    ctx.fillStyle = g; ctx.fillRect(-40, HZ, MW + 80, B - HZ);
    ctx.fillStyle = "#ffd400";
    for (let x = -40 + ((t * 0.6) % 40); x < MW + 40; x += 40) { ctx.beginPath(); ctx.moveTo(x, HZ); ctx.lineTo(x + 20, HZ); ctx.lineTo(x + 8, HZ + 10); ctx.lineTo(x - 12, HZ + 10); ctx.fill(); }
    ctx.fillStyle = "#111"; ctx.fillRect(-40, HZ + 10, MW + 80, 3);
    for (let x = -22; x < MW + 22; x += 22) {
      const a = t * 0.15 + x;
      ctx.fillStyle = "#9aa3ad"; ctx.beginPath(); ctx.arc(x + 11, HZ + 26, 9, 0, 7); ctx.fill();
      ctx.fillStyle = "#cfd6dd";
      for (let k = 0; k < 4; k++) { const ang = a + (k * Math.PI) / 2; ctx.beginPath(); ctx.moveTo(x + 11, HZ + 26); ctx.lineTo(x + 11 + Math.cos(ang) * 11, HZ + 26 + Math.sin(ang) * 11); ctx.lineTo(x + 11 + Math.cos(ang + 0.5) * 7, HZ + 26 + Math.sin(ang + 0.5) * 7); ctx.fill(); }
    }
    ARK.gaps.forEach(([a, b], gi) => {
      for (let k = 0; k < 6; k++) { const p = (t * 0.8 + k * 23 + gi * 11) % 70; ctx.fillStyle = ["#fff", "#ffd400", "#ef476f"][k % 3]; ctx.fillRect(a + 10 + ((k * 37) % (b - a - 20)), HZ - p * 0.6, 5, 2); }
    });
    ctx.restore();
  }

  const ART = {
    oak: { bg: bgNight, deco: decoOak, terrain: terrainOak, noise: 0.2, dirt: [0x6b, 0x44, 0x23] },
    yard: { bg: bgYard, deco: null, terrain: terrainYard, noise: 0.14, dirt: [0x6b, 0x48, 0x2c] },
    room: { bg: bgRoom, deco: null, terrain: terrainRoom, noise: 0.05, dirt: [0x8a, 0x55, 0x26] },
    ark: { bg: bgArk, deco: decoArk, terrain: terrainArk, noise: 0.04, dirt: [0xd9, 0xb4, 0x7e], ink: true },
  };

  // Paints a map, then keeps the terrain art only where the shared mask is
  // solid. Solid pixels the art left empty get plain dirt, so nothing solid is
  // invisible.
  function buildTerrain(mapKey) {
    const art = ART[mapKey] || ART.oak;
    const mk = (w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; };
    const bg = mk(SW, SH), deco = mk(W, H), t = mk(W, H), r = R.mulberry(11);
    const dc = deco.getContext("2d"), tc = t.getContext("2d", { willReadFrequently: true });
    dc.scale(K, K); tc.scale(K, K);
    const bc = bg.getContext("2d");
    art.bg(bc, r); if (art.deco) art.deco(dc, r); art.terrain(tc, r);
    // pop-art halftone over the sky, denser towards the top
    for (let y = 4; y < SH; y += 8) for (let x = (y / 8) % 2 ? 4 : 0; x < SW; x += 8) {
      bc.fillStyle = `rgba(255,255,255,${0.05 * (1 - y / SH)})`; bc.beginPath(); bc.arc(x, y, 1.6, 0, 7); bc.fill();
    }
    tc.setTransform(1, 0, 0, 1, 0, 0);
    const mask = R.makeTerrain(mapKey);
    const img = tc.getImageData(0, 0, W, H), d = img.data, amt = art.noise, [dr, dg, db] = art.dirt;
    for (let j = 0; j < W * H; j++) {
      const i = j * 4;
      if (!mask[j]) { d[i + 3] = 0; continue; }
      if (d[i + 3] < 110) { d[i] = dr; d[i + 1] = dg; d[i + 2] = db; }
      const k = 1 - amt / 2 + hash(j % W, (j / W) | 0) * amt;
      d[i] = Math.min(255, d[i] * k); d[i + 1] = Math.min(255, d[i + 1] * k); d[i + 2] = Math.min(255, d[i + 2] * k); d[i + 3] = 255;
    }
    tc.putImageData(img, 0, 0);
    const L = { map: mapKey, bg, deco, t, tc, img, mask, ink: null };
    if (art.ink) inkOf(L);
    return L;
  }

  // The hazard along the bottom, in world px: river, pool or lava, with a
  // gentle wave. Lava gets a glow above it.
  function drawHazard(ctx, hz, frame) {
    if (hz.fill === "shredder") return drawShredder(ctx, frame);
    const t = frame / 30;
    if (hz.fill === "lava") {
      const glow = ctx.createLinearGradient(0, WATER - 70, 0, WATER); glow.addColorStop(0, "rgba(255,120,30,0)"); glow.addColorStop(1, "rgba(255,120,30,.35)");
      ctx.fillStyle = glow; ctx.fillRect(-60, WATER - 70, W + 120, 70);
      const lg = ctx.createLinearGradient(0, WATER - 6, 0, H); lg.addColorStop(0, "#ffb02e"); lg.addColorStop(0.3, "#ff6a1a"); lg.addColorStop(1, "#b3200c");
      ctx.fillStyle = lg;
    } else ctx.fillStyle = hz.fill;
    ctx.beginPath(); ctx.moveTo(-60, H + 60);
    for (let x = -60; x <= W + 60; x += 16) ctx.lineTo(x, WATER + Math.sin(x * 0.03 + t) * 4);
    ctx.lineTo(W + 60, H + 60); ctx.fill();
    ctx.strokeStyle = hz.line; ctx.lineWidth = 2; ctx.beginPath();
    for (let x = -60; x <= W + 60; x += 16) ctx.lineTo(x, WATER + Math.sin(x * 0.03 + t) * 4);
    ctx.stroke();
  }

  // A small picture of the whole map with its hazard, for the lobby.
  const thumbs = {};
  function thumb(mapKey) {
    if (thumbs[mapKey]) return thumbs[mapKey];
    const L = buildTerrain(mapKey), c = document.createElement("canvas");
    c.width = 480; c.height = 256;
    const g = c.getContext("2d"), s = 480 / W;
    [L.bg, L.deco, L.ink, L.t].forEach((src) => src && g.drawImage(src, 0, 0, 480, 256));
    const hz = R.hazardOf(mapKey);
    g.fillStyle = hz.fill === "lava" ? "#ff6a1a" : hz.fill === "shredder" ? "#2b2d33" : hz.fill; g.fillRect(0, WATER * s, 480, 256 - WATER * s);
    if (mapKey === "ark") { g.save(); g.scale(s, s); drawArkKid(g, L.mask, 0); drawArkEyes(g, L.mask, R.ARK.logo[0] * K, (R.ARK.logo[1] + 80) * K, 10); g.restore(); }
    g.fillStyle = hz.line; g.fillRect(0, WATER * s, 480, 1.5);
    return (thumbs[mapKey] = c);
  }

  window.SQUIRRELS_MAPS = { buildTerrain, drawHazard, thumb, inkOf, arkLogoAlive, arkSignPx, drawArkEyes, drawArkBubble, drawArkKid };
})();
