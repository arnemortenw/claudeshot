// Rabid Squirrels - shared rules. Loaded by BOTH the browser (window.SQUIRRELS_RULES)
// and the Node server (require), so the server's terrain and the one every
// laptop draws are the same pixels.
//
// The world is 2100 x 1120 px. Maps are drawn in 1200 x 640 design units and
// scaled up by K = 1.75. The terrain is a mask of solid pixels (1) and air (0);
// explosions carve craters out of it. The hazard (the river on Moonlit Oak)
// starts 70 px above the bottom and kills whatever falls in.
//
// Ported from design v8 (prototypes/rabid-squirrel-worms-style-game/index.html
// on damian/rabid-squirrel-worms-style-game). The prototype drew the terrain
// with canvas paths and read the mask back from the pixels; here the same
// shapes are tested point by point, so the server needs no canvas.

(function (root, factory) {
  const rules = factory();
  if (typeof module === "object" && module.exports) module.exports = rules;
  else root.SQUIRRELS_RULES = rules;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const SW = 1200, SH = 640;               // design units (and the client's canvas)
  const K = 1.75;
  const W = SW * K, H = SH * K;            // 2100 x 1120 world px
  const WATER = H - 70;                    // the hazard line
  const G = 0.3;                           // gravity, px per frame per frame
  const FPS = 60;
  const TURN_SECONDS = 30;
  const MAX_STEPS = 150;
  const JUMP_COST = 20;
  const WALK_STEP = 1.3;                   // px per frame, and steps per frame of walking
  const AIR_STEER_COST = 0.6;
  const STEP_UP = 7;                       // a walking squirrel climbs up to this many px
  const SIZE = 0.85;                       // squirrel drawing scale
  const MIN_SQUIRRELS = 2, MAX_SQUIRRELS = 3;
  const MIN_PLAYERS = 2, MAX_PLAYERS = 6;
  const SPAWN_GAP = 60;                    // px between two squirrels at the start
  const POWER_DRAG = 170;                  // a drag this long (canvas px) is full power
  const MIN_DRAG = 20;                     // shorter drags don't fire

  const PLAYER_COLORS = ["#f7c948", "#e94560", "#4fc3f7", "#7bc043", "#b06cff", "#ff8c42"];

  const SQUIRREL_NAMES = [
    ["Bucky", "Foamy", "Nibbles"],
    ["Chomper", "Twitchy", "Skree"],
    ["Hazel", "Snapper", "Pecan"],
    ["Rascal", "Gnasher", "Pip"],
    ["Fuzz", "Biter", "Acorn"],
    ["Squeaks", "Frothy", "Nutjob"],
  ];

  const WEAPONS = {
    bazooka: { name: "Acorn Bazooka", icon: "🌰", dmg: 45, r: 40, speed: 23, wind: true,
      how: "Acorn Bazooka · drag back to aim, let go to fire. The wind pushes it" },
  };
  const WIND_PUSH = 0.045;                 // per frame, times the wind (-1 .. 1)

  const MAPS = {
    oak: { name: "Moonlit Oak", hazard: "river" },
  };

  // ---------------------------------------------------------------- seeded rng
  function mulberry(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ---------------------------------------------------------------- geometry
  // Curves are flattened into polylines; a stroke with round caps is solid
  // within half its line width of the polyline.
  function quad(p0, c, p1, n = 24) {
    const out = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n, u = 1 - t;
      out.push([u * u * p0[0] + 2 * u * t * c[0] + t * t * p1[0], u * u * p0[1] + 2 * u * t * c[1] + t * t * p1[1]]);
    }
    return out;
  }
  function cubic(p0, c1, c2, p1, n = 32) {
    const out = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n, u = 1 - t;
      out.push([
        u * u * u * p0[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * p1[0],
        u * u * u * p0[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * p1[1],
      ]);
    }
    return out;
  }
  function bounds(pts, pad) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    return [x0 - pad, y0 - pad, x1 + pad, y1 + pad];
  }
  function segDist2(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
    let t = l2 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const ex = ax + dx * t - px, ey = ay + dy * t - py;
    return ex * ex + ey * ey;
  }
  const shape = {
    stroke(pts, lw) {
      const r2 = (lw / 2) * (lw / 2);
      // one small box per segment: much quicker than testing every segment everywhere
      const segs = [];
      for (let i = 1; i < pts.length; i++) {
        const [ax, ay] = pts[i - 1], [bx, by] = pts[i];
        segs.push({ box: bounds([pts[i - 1], pts[i]], lw / 2), at: (x, y) => segDist2(x, y, ax, ay, bx, by) <= r2 });
      }
      return { box: bounds(pts, lw / 2), parts: segs };
    },
    poly(pts) {
      const n = pts.length, px = new Float64Array(n), py = new Float64Array(n);
      pts.forEach(([x, y], i) => { px[i] = x; py[i] = y; });
      return { box: bounds(pts, 0), at(x, y) {
        let inside = false;
        for (let i = 0, j = n - 1; i < n; j = i++) {
          const yi = py[i], yj = py[j];
          if ((yi > y) !== (yj > y) && x < ((px[j] - px[i]) * (y - yi)) / (yj - yi) + px[i]) inside = !inside;
        }
        return inside;
      } };
    },
    ellipse(cx, cy, rx, ry, upperOnly) {
      return { box: [cx - rx, cy - ry, cx + rx, upperOnly ? cy : cy + ry], at(x, y) {
        if (upperOnly && y > cy) return false;
        const dx = (x - cx) / rx, dy = (y - cy) / ry;
        return dx * dx + dy * dy <= 1;
      } };
    },
    roundRect(x, y, w, h, r) {
      r = Math.min(r, w / 2, h / 2);
      return { box: [x, y, x + w, y + h], at(px, py) {
        if (px < x || px > x + w || py < y || py > y + h) return false;
        const cx = Math.max(x + r, Math.min(x + w - r, px)), cy = Math.max(y + r, Math.min(y + h - r, py));
        return (px - cx) * (px - cx) + (py - cy) * (py - cy) <= r * r;
      } };
    },
  };

  // ---------------------------------------------------------------- Moonlit Oak
  // The ground line, in design units. The river gap is at x 850..935.
  function oakGround(x) {
    let y = 430 + Math.sin(x / 170) * 45 + Math.sin(x / 53 + 1) * 12;
    const dd = Math.abs(x - 615);
    if (dd < 190) { const w = dd < 120 ? 1 : 1 - (dd - 120) / 70; y = y * (1 - w) + 415 * w; }
    if (x < 40) y += (40 - x) * 6;
    if (x > 1160) y += (x - 1160) * 6;
    if (x > 850 && x < 935) y = SH + 60;
    return y;
  }
  const OAK_GRASS = 4.5;                   // the grass stroke sits this far above the ground line

  // Everything solid on the map except the ground, in drawing order. "cut"
  // shapes erase what was drawn before them, like destination-out.
  function oakShapes() {
    const f = oakGround;
    const trunk = [[505, 432]]
      .concat(quad([505, 432], [565, 410], [575, 330]).slice(1))
      .concat([[592, 140], [643, 140], [660, 330]])
      .concat(quad([660, 330], [672, 410], [732, 432]).slice(1));
    const ly = Math.min(f(945), f(1000)) - 46;
    const out = [
      ["add", shape.poly(trunk)],
      ["add", shape.stroke(quad([605, 262], [530, 230], [452, 232]), 18)],
      ["add", shape.stroke(quad([638, 218], [720, 190], [808, 196]), 18)],
      ["add", shape.stroke([[612, 150], [588, 96]], 11)],
      ["cut", shape.roundRect(560, 345, 120, 64, 28)],          // the tunnel through the trunk
      ["cut", shape.ellipse(1070, f(1070) + 48, 56, 22)],       // a burrow under the right hill
    ];
    for (const [x, s] of [[268, 1], [1048, 0.8]]) {             // giant mushrooms
      const gy = f(x);
      out.push(["add", shape.roundRect(x - 8 * s, gy - 62 * s, 16 * s, 66 * s, 5)]);
      out.push(["add", shape.ellipse(x, gy - 60 * s, 40 * s, 24 * s, true)]);
    }
    out.push(["add", shape.stroke(cubic([92, f(92) + 8], [100, f(92) - 125], [222, f(230) - 125], [232, f(232) + 8]), 22)]); // rock arch
    out.push(["add", shape.stroke(quad([578, 338], [520, 318], [452, 328]), 14)]);       // low branch
    out.push(["add", shape.ellipse(945, f(945) - 14, 14, 20)]);                          // log shelter
    out.push(["add", shape.ellipse(1000, f(1000) - 14, 14, 20)]);
    out.push(["add", shape.roundRect(922, ly - 12, 100, 22, 11)]);
    return out;
  }

  // The solid mask for a map: W*H bytes, row by row. Pixel (x, y) is tested at
  // its centre, in design units.
  function makeTerrain(mapKey = "oak") {
    if (mapKey !== "oak") throw new Error("unknown map " + mapKey);
    const mask = new Uint8Array(W * H);
    for (let x = 0; x < W; x++) {
      const top = (oakGround((x + 0.5) / K) - OAK_GRASS) * K;
      if (top >= H) continue;
      for (let y = Math.max(0, Math.ceil(top - 0.5)); y < H; y++) mask[y * W + x] = 1;
    }
    const paint = (op, sh) => {
      if (sh.parts) { for (const part of sh.parts) paint(op, part); return; }
      const [bx0, by0, bx1, by1] = sh.box;
      const x0 = Math.max(0, Math.floor(bx0 * K) - 1), x1 = Math.min(W - 1, Math.ceil(bx1 * K) + 1);
      const y0 = Math.max(0, Math.floor(by0 * K) - 1), y1 = Math.min(H - 1, Math.ceil(by1 * K) + 1);
      const v = op === "add" ? 1 : 0;
      for (let y = y0; y <= y1; y++) {
        const dy = (y + 0.5) / K;
        for (let x = x0; x <= x1; x++) if (sh.at((x + 0.5) / K, dy)) mask[y * W + x] = v;
      }
    };
    for (const [op, sh] of oakShapes()) paint(op, sh);
    return mask;
  }

  function solid(mask, x, y) {
    x |= 0; y |= 0;
    if (x < 0 || x >= W || y < 0) return false;
    if (y >= H) return true;
    return mask[y * W + x] > 0;
  }

  // Carves a round crater. Returns the bounding box it touched, or null.
  function crater(mask, cx, cy, r) {
    const x0 = Math.max(0, (cx - r) | 0), x1 = Math.min(W - 1, (cx + r + 1) | 0);
    const y0 = Math.max(0, (cy - r) | 0), y1 = Math.min(H - 1, (cy + r + 1) | 0);
    if (x1 < x0 || y1 < y0) return null;
    const r2 = r * r;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const dx = x - cx, dy = y - cy;
      if (dx * dx + dy * dy < r2) mask[y * W + x] = 0;
    }
    return [x0, y0, x1, y1];
  }

  // The first air pixel above the first solid one, looking down from the sky.
  function dropY(mask, x) {
    let y = 0;
    while (y < H && !solid(mask, x, y)) y++;
    return y - 1;
  }

  // Where a squirrel may start: on top of the terrain, well above the hazard,
  // with room to stand.
  function standable(mask, x) {
    const y = dropY(mask, x);
    if (y > WATER - 30 || y < 40) return null;
    for (let k = 1; k <= 30; k++) if (solid(mask, x, y - k)) return null;
    return y;
  }

  // Spreads players x perPlayer squirrels over dry ground. The slots run left
  // to right and go to the players in turn (a, b, c, a, b, c, ...), so no player
  // starts bunched up, and no two squirrels are closer than SPAWN_GAP.
  // Returns [{ player, index, x, y }] with player and index counted from 0.
  function spawns(mask, players, perPlayer, seed = 1) {
    const rnd = mulberry(seed);
    const n = players * perPlayer;
    const cols = [];
    for (let x = 30; x < W - 30; x += 2) {
      const y = standable(mask, x);
      if (y != null) cols.push([x, y]);
    }
    if (!cols.length) throw new Error("no dry ground to spawn on");
    // which player gets the leftmost slot rotates with the seed
    const offset = Math.floor(rnd() * players);
    const chosen = [];
    for (let i = 0; i < n; i++) {
      // aim for an even spread over the dry columns, nudged a little at random
      const want = Math.min(cols.length - 1, Math.floor(((i + 0.5 + (rnd() - 0.5) * 0.5) / n) * cols.length));
      let best = null;
      for (let d = 0; d < cols.length && !best; d++) {
        for (const j of [want + d, want - d]) {
          if (j < 0 || j >= cols.length) continue;
          const [x] = cols[j];
          if (chosen.every((c) => Math.abs(c.x - x) >= SPAWN_GAP)) { best = cols[j]; break; }
        }
      }
      if (!best) throw new Error("not enough dry ground for " + n + " squirrels");
      chosen.push({ x: best[0], y: best[1] });
    }
    chosen.sort((a, b) => a.x - b.x);
    return chosen.map((c, i) => ({ player: (i + offset) % players, index: Math.floor(i / players), x: c.x, y: c.y }));
  }

  // Angle and power (0..1) of a slingshot drag from (x0, y0) back to (x1, y1).
  function aimFromDrag(x0, y0, x1, y1) {
    const dx = x0 - x1, dy = y0 - y1, len = Math.hypot(dx, dy);
    return { ang: Math.atan2(dy, dx), pow: Math.min(1, len / POWER_DRAG), len };
  }

  // Where a shot leaves the squirrel, and how fast.
  function launch(s, ang, pow, weapon = "bazooka") {
    const w = WEAPONS[weapon], sp = 3 + pow * w.speed;
    return { x: s.x + Math.cos(ang) * 16, y: s.y - 24 + Math.sin(ang) * 16, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp };
  }

  return {
    SW, SH, K, W, H, WATER, G, FPS, TURN_SECONDS, MAX_STEPS, JUMP_COST, WALK_STEP, AIR_STEER_COST, STEP_UP,
    SIZE, MIN_SQUIRRELS, MAX_SQUIRRELS, MIN_PLAYERS, MAX_PLAYERS, SPAWN_GAP, POWER_DRAG, MIN_DRAG,
    PLAYER_COLORS, SQUIRREL_NAMES, WEAPONS, WIND_PUSH, MAPS, OAK_GRASS,
    mulberry, oakGround, makeTerrain, solid, crater, dropY, standable, spawns, aimFromDrag, launch,
  };
});
