// Rabid Squirrels - shared rules. Loaded by BOTH the browser (window.SQUIRRELS_RULES)
// and the Node server (require), so the server's terrain and the one every
// laptop draws are the same pixels.
//
// The world is 2100 x 1120 px. Maps are drawn in 1200 x 640 design units and
// scaled up by K = 1.75. The terrain is a mask of solid pixels (1) and air (0);
// explosions carve craters out of it. The hazard (river, paddling pool or lava)
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
  const SQUIRRELS_PER_PLAYER = 1;          // every player is one toy squirrel
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

  // Every weapon in the tray, from design v8. kind says how it's aimed:
  //   shot     drag back and let go; flies in an arc (wind if `wind`)
  //   beam     drag back and let go; a straight line, no arc, no wind
  //   melee    click; hits whoever is right next to you, on the side you click
  //   strike   click a spot; drops from the sky there
  //   teleport click a spot; moves you there and doesn't use your attack
  const WEAPONS = {
    bazooka:  { name: "Acorn Bazooka", short: "Bazooka", icon: "🌰", kind: "shot", dmg: 45, r: 40, speed: 23, wind: true, dmgText: "45 dmg",
      how: "Acorn Bazooka · drag back to aim, let go to fire. The wind pushes it" },
    grenade:  { name: "Nut Grenade", short: "Grenade", icon: "💣", kind: "shot", dmg: 55, r: 50, speed: 19, fuse: 3 * 60, bounce: true, dmgText: "55 dmg",
      how: "Nut Grenade · bounces, goes off after 3 seconds" },
    blaster:  { name: "Nut Blaster", short: "Blaster", icon: "🔫", kind: "beam", dmg: 30, r: 16, splash: 18, range: 1100, dmgText: "30 dmg",
      how: "Nut Blaster · drag back to point, let go: a straight blast. No arc, no wind" },
    punch:    { name: "Macadamia Nut Punch", short: "Mac Punch", icon: "👊", kind: "melee", dmg: 30, kx: 5, ky: -12, hop: true, shout: "POW!", miss: "*punches the air*", dmgText: "30 + launch",
      how: "Macadamia Nut Punch · click to uppercut whoever is right next to you. Sends them flying" },
    cluster:  { name: "Pinecone Cluster", short: "Pinecone", icon: "🌲", kind: "shot", dmg: 25, r: 32, speed: 21.5, wind: true, split: 5, dmgText: "25 + 5×15",
      how: "Pinecone Cluster · bursts into 5 pine nuts on impact" },
    bite:     { name: "Rabid Bite", short: "Bite", icon: "🦷", kind: "melee", dmg: 35, kx: 8, ky: -6, shout: "CHOMP!", miss: "*bites the air*", dmgText: "35 dmg",
      how: "Rabid Bite · click to bite whoever is right next to you. Huge knockback" },
    coconut:  { name: "Coconut Strike", short: "Coconut", icon: "🥥", kind: "strike", dmg: 70, r: 62, dmgText: "70 dmg",
      how: "Coconut Strike · click a spot, a coconut drops from the sky" },
    teleport: { name: "Teleport", short: "Teleport", icon: "✨", kind: "teleport", dmgText: "no dmg",
      how: "Teleport · click anywhere to pop up there. You still get your shot" },
    napalm:   { name: "Pistachio Napalm", short: "Napalm", icon: "🔥", kind: "shot", pickup: true, dmgText: "12 + fire",
      how: "Pistachio Napalm · found on the map" },
    hbomb:    { name: "Golden Hazelnut H-Bomb", short: "H-Bomb", icon: "☢️", kind: "shot", pickup: true, dmgText: "instant kill",
      how: "Golden Hazelnut H-Bomb · found on the map" },
  };
  const WIND_PUSH = 0.045;                 // per frame, times the wind (-1 .. 1)

  // The toys a player picks in the lobby, in the order the picker shows them.
  // Their colours and drawing live in squirrels-art.js under the same keys.
  const TOYS = [
    { key: "sheriff", name: "Sheriff Scratch", line: "“There’s a rabid squirrel in my boot!”" },
    { key: "ranger", name: "Space Ranger Nutz", line: "“To the nut pile and beyond!”" },
    { key: "dino", name: "Rexie Nutkin", line: "“I’m a very anxious rabid dinosaur.”" },
    { key: "bo", name: "Bo Squeak", line: "“Baa. Baa. Bite.”" },
    { key: "pig", name: "Porky Nutbank", line: "“Insert nut. Lose a finger.”" },
    { key: "spud", name: "Mr. Nut Head", line: "“Some assembly required. Mostly rabies.”" },
  ];
  const isToy = (key) => TOYS.some((t) => t.key === key);

  // What kills at the bottom of each map: its colours, the word on a shot
  // that falls in, and what a squirrel says on the way down.
  const HAZARDS = {
    river: { name: "River", icon: "🌊", fill: "rgba(15,52,96,.92)", line: "rgba(126,200,227,.6)", splash: "#9fd3ea", burst: "#4fc3f7",
      plop: "plop.", words: ["SPLOOSH!", "GLUB!", "SPLASH!"], lines: ["glub glub", "Can’t… swim…", "Squirrels float, right?"] },
    pool: { name: "Paddling pool", icon: "🏊", fill: "rgba(64,180,240,.82)", line: "rgba(225,250,255,.95)", splash: "#d6f6ff", burst: "#40b4f0",
      plop: "sploosh.", words: ["SPLOOSH!", "CANNONBALL!", "SPLASH!"], lines: ["Not the paddling pool!", "glub glub", "Cannonbaaall—"] },
    lava: { name: "The floor is lava", icon: "🔥", fill: "lava", line: "#ffd25a", splash: "#ffb347", burst: "#ff6a1a",
      plop: "tssss.", words: ["TSSSS!", "SIZZLE!", "FWOOSH!"], lines: ["The floor is LAVA!", "Hot hot hot!", "Toasted nut."] },
  };

  const MAPS = {
    oak: { name: "Moonlit Oak", hazard: "river", order: 0,
      blurb: "A hollow oak, a rock arch, a log shelter, branch ledges and mushrooms." },
    yard: { name: "Backyard BBQ", hazard: "pool", order: 1,
      blurb: "Doghouse, picnic table, sandbox, gnome, fence, grill and the pool." },
    room: { name: "Kid’s Bedroom", hazard: "lava", order: 2,
      blurb: "Blanket fort, letter blocks, a book tent, the toy box and shelves." },
  };
  const MAP_KEYS = Object.keys(MAPS);
  const hazardOf = (mapKey) => HAZARDS[(MAPS[mapKey] || MAPS.oak).hazard];

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

  // Points along an ellipse from angle a0 to a1 (canvas angles: y points down),
  // turned by rot around (ox, oy) when given.
  function arc(cx, cy, rx, ry, a0, a1, n = 24, rot = 0, ox = 0, oy = 0) {
    const out = [], cr = Math.cos(rot), sr = Math.sin(rot);
    for (let i = 0; i <= n; i++) {
      const a = a0 + ((a1 - a0) * i) / n, x = cx + Math.cos(a) * rx, y = cy + Math.sin(a) * ry;
      out.push([ox + x * cr - y * sr, oy + x * sr + y * cr]);
    }
    return out;
  }
  const rect = (x, y, w, h) => shape.roundRect(x, y, w, h, 0);

  // ---------------------------------------------------------------- Backyard BBQ
  // The lawn, in design units. The paddling pool is the gap at x 515..685.
  function yardGround(x) {
    let y = 458 + Math.sin(x / 210 + 0.5) * 28 + Math.sin(x / 70) * 6;
    if (x < 30) y += (30 - x) * 6;
    if (x > 1170) y += (x - 1170) * 6;
    if (x > 515 && x < 685) y = SH + 60;
    return y;
  }

  function yardShapes() {
    const f = yardGround, out = [];
    const add = (sh) => out.push(["add", sh]);
    for (const [x, gy] of [[498, f(498)], [682, f(702)]]) add(shape.roundRect(x, gy - 30, 20, SH - gy + 30, 10)); // pool walls
    const sy = f(240);                                                                          // sandbox
    add(shape.poly([[160, sy + 6], [160, sy - 22]].concat(quad([160, sy - 22], [240, sy - 74], [320, sy - 22]).slice(1), [[320, sy + 6]])));
    add(shape.roundRect(148, sy - 36, 16, 56, 3));
    add(shape.roundRect(316, sy - 36, 16, 56, 3));
    add(shape.poly([[262, sy - 54], [290, sy - 54], [286, sy - 30], [266, sy - 30]]));          // bucket
    const gx = 430, gy = f(430);                                                                // garden gnome
    add(shape.poly([[412, gy + 4], [448, gy + 4], [441, gy - 34], [419, gy - 34]]));
    add(shape.ellipse(gx, gy - 40, 9, 8));
    add(shape.poly([[418, gy - 38], [442, gy - 38], [430, gy - 12]]));
    add(shape.poly([[418, gy - 44], [442, gy - 44], [426, gy - 90]]));
    const fy = f(830);                                                                          // picket fence
    add(rect(756, fy - 74, 106, 9));
    add(rect(756, fy - 36, 106, 9));
    for (let x = 760; x < 860; x += 22) {
      const py = f(x + 7);
      add(rect(x, py - 94, 14, 104));
      add(shape.poly([[x, py - 94], [x + 7, py - 106], [x + 14, py - 94]]));
    }
    const by = f(1040);                                                                         // grill
    add(shape.stroke([[1010, by + 4], [1026, by - 48]], 5));
    add(shape.stroke([[1070, by + 4], [1054, by - 48]], 5));
    add(shape.poly(arc(1040, by - 52, 42, 26, 0, Math.PI)));
    add(shape.poly(arc(42, 0, 42, 24, Math.PI, Math.PI * 2, 24, -1.15, 998, by - 52)));
    add(rect(998, by - 54, 84, 3));
    add(shape.roundRect(1012, by - 62, 22, 9, 4));
    add(shape.roundRect(1042, by - 62, 24, 9, 4));
    const py = f(96);                                                                           // flower pot
    for (const [x, h] of [[86, -64], [96, -74], [106, -60]]) {
      add(shape.stroke([[96, py - 26], [x, py + h]], 3));
      for (let a = 0; a < 5; a++) add(shape.ellipse(x + Math.cos(a * 1.26) * 5, py + h + Math.sin(a * 1.26) * 5, 4, 4));
    }
    add(shape.poly([[78, py - 30], [114, py - 30], [108, py + 4], [84, py + 4]]));
    add(rect(76, py - 32, 40, 7));
    const dy = f(368);                                                                          // doghouse with a door to duck into
    add(rect(334, dy - 60, 68, 66));
    add(shape.poly([[322, dy - 56], [368, dy - 98], [414, dy - 56]]));
    out.push(["cut", shape.poly([[352, dy - 2], [352, dy - 26]].concat(arc(368, dy - 26, 16, 16, Math.PI, Math.PI * 2), [[384, dy - 2]]))]);
    const ty = f(945);                                                                          // picnic table
    add(shape.stroke([[905, f(905) + 4], [932, ty - 50]], 7));
    add(shape.stroke([[985, f(985) + 4], [958, ty - 50]], 7));
    add(shape.roundRect(888, ty - 60, 114, 11, 3));
    const fy2 = f(1150);                                                                        // bird feeder pole
    add(rect(1146, fy2 - 200, 8, 206));
    add(shape.roundRect(1122, fy2 - 208, 56, 9, 2));
    return out;
  }

  // ---------------------------------------------------------------- Kid's Bedroom
  // No ground: everything stands up out of the lava. The letter blocks and the
  // toy bricks are solid all the way across, so no squirrel slips down a seam.
  const ROOM_BOOKS = [[180, 34, "#c0392b"], [166, 28, "#2e86de"], [172, 40, "#27ae60"], [150, 26, "#f1c40f"], [160, 36, "#8e44ad"], [140, 30, "#e67e22"]];
  const ROOM_BOOK_JIG = [3, 6, 1, 5, 2, 7];
  // The book tower, bottom up: [x, y, w, h, colour] in design units.
  function roomBooks() {
    let y = 600;
    return ROOM_BOOKS.map(([w, h, col], i) => { y -= h; return [606 + (i % 2 ? 12 : 0) + ROOM_BOOK_JIG[i], y, w, h, col]; });
  }
  // The letter-block pyramid: [x, y, size, row, i].
  function roomBlocks() {
    const out = [];
    for (let row = 0; row < 4; row++) for (let i = 0; i < 4 - row; i++) out.push([350 + row * 26 + i * 52, 548 - row * 52, 52, row, i]);
    return out;
  }
  // The toy-brick stairs: one column per step, [x, top, rows].
  function roomBricks() {
    return [0, 1, 2].map((col) => { const rows = 3 + col * 2; return [1034 + col * 54, 600 - 30 * rows, rows]; });
  }

  function roomShapes() {
    const out = [], add = (sh) => out.push(["add", sh]);
    add(shape.roundRect(12, 300, 26, SH, 8));                                                   // bed
    add(shape.roundRect(300, 372, 22, SH, 6));
    add(shape.roundRect(30, 436, 284, 20, 4));
    add(shape.roundRect(30, 398, 284, 42, 10));
    add(shape.roundRect(122, 391, 192, 74, 10));
    add(shape.ellipse(82, 392, 44, 16));
    for (const [x, y, s] of roomBlocks()) add(rect(x, y, s, s));                                // letter blocks
    for (const [x, d] of [[430, 1], [630, -1]]) add(shape.poly([[x, 262], [x + d * 22, 262], [x, 302]])); // low shelf
    add(shape.roundRect(400, 250, 260, 14, 3));
    add(shape.roundRect(450, 226, 58, 18, 6));                                                  // toy car
    add(shape.roundRect(462, 213, 32, 15, 5));
    add(shape.ellipse(464, 244, 7, 7));
    add(shape.ellipse(496, 244, 7, 7));
    add(shape.ellipse(600, 230, 27, 19));                                                       // piggy bank
    add(shape.ellipse(625, 228, 7, 8));
    add(rect(584, 240, 7, 10));
    add(rect(608, 240, 7, 10));
    add(shape.poly([[586, 214], [592, 202], [598, 214]]));
    add(rect(608, 600, 180, SH - 600));                                                         // book tower
    for (const [x, y, w, h] of roomBooks()) add(shape.roundRect(x, y, w, h, 4));
    add(shape.poly([[838, 440], [1008, 440], [1022, 384], [852, 370]]));                        // toy box, lid open
    add(shape.roundRect(950, 358, 26, 90, 12));                                                 // its rocket
    add(shape.poly([[950, 368], [976, 368], [963, 336]]));
    add(shape.roundRect(828, 436, 184, SH, 6));
    for (const [x, top, , ] of roomBricks()) add(rect(x, top, x < 1140 ? 54 : 52, SH - top)); // brick stairs
    for (const [x, top, rows] of roomBricks()) { add(rect(x + 8, top - 6, 13, 7)); add(rect(x + 31, top - 6, 13, 7)); }
    add(shape.stroke(quad([128, 394], [215, 248], [302, 394]), 12));                            // blanket fort
    add(shape.stroke([[628, 404], [697, 338], [766, 404]], 8));                                 // book tent
    add(shape.poly([[1070, 182], [1092, 182], [1070, 214]]));                                   // high shelf
    add(shape.roundRect(1060, 170, 130, 12, 3));
    return out;
  }

  const TERRAIN = {
    oak: { ground: oakGround, shapes: oakShapes },
    yard: { ground: yardGround, shapes: yardShapes },
    room: { ground: null, shapes: roomShapes },
  };

  // The solid mask for a map: W*H bytes, row by row. Pixel (x, y) is tested at
  // its centre, in design units.
  function makeTerrain(mapKey = "oak") {
    const T = TERRAIN[mapKey];
    if (!T) throw new Error("unknown map " + mapKey);
    const mask = new Uint8Array(W * H);
    if (T.ground) for (let x = 0; x < W; x++) {
      const top = (T.ground((x + 0.5) / K) - OAK_GRASS) * K;
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
    for (const [op, sh] of T.shapes()) paint(op, sh);
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
  // with room to stand and ground about level on both sides (not the tip of
  // a gnome's hat or a fence picket).
  function standable(mask, x) {
    const y = dropY(mask, x);
    if (y > WATER - 30 || y < 40) return null;
    for (let k = 1; k <= 30; k++) if (solid(mask, x, y - k)) return null;
    for (const dx of [-12, 12]) if (Math.abs(dropY(mask, x + dx) - y) > 8) return null;
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

  // ---------------------------------------------------------------- weapons
  const ORDER = ["bazooka", "grenade", "blaster", "punch", "cluster", "bite", "coconut", "teleport", "napalm", "hbomb"];
  const START = ["bazooka", "grenade", "blaster", "punch"];
  const ROUND_UNLOCKS = ["cluster", "bite", "coconut"];   // at the start of rounds 2, 3 and 4
  const PINE = { dmg: 15, r: 24 };         // each of the cluster's pine nuts
  const RETREAT_SECONDS = 5;
  const MELEE_REACH = 40;                  // px in front of the squirrel

  // The weapons everyone has at the start of a round.
  function unlockedFor(round) {
    return START.concat(ROUND_UNLOCKS.slice(0, Math.max(0, round - 1)));
  }

  // What's written on a locked slot.
  function lockText(w) {
    if (w === "teleport") return "Kill to unlock";
    if (WEAPONS[w].pickup) return "Find on map";
    return `Round ${ROUND_UNLOCKS.indexOf(w) + 2}`;
  }

  // The Nut Blaster's line from squirrel s at angle ang: walks out 2 px at a
  // time and stops at the first squirrel or solid pixel, the hazard, the map's
  // edge or the end of its range. isSolid(x, y) tests the terrain.
  // Returns { x0, y0, x, y, victim } with victim a squirrel or null.
  function blasterTrace(isSolid, squirrels, s, ang) {
    const dx = Math.cos(ang), dy = Math.sin(ang);
    const x0 = s.x + dx * 18, y0 = s.y - 24 + dy * 18;
    let x = x0, y = y0, victim = null;
    for (let t = 0; t < WEAPONS.blaster.range; t += 2) {
      x = x0 + dx * t; y = y0 + dy * t;
      if (y > WATER || x < 0 || x > W || y < 0) break;
      victim = squirrels.find((q) => q !== s && !q.drowned && !q.dead && Math.hypot(q.x - x, q.y - 22 - y) < 15) || null;
      if (victim || isSolid(x, y)) break;
    }
    return { x0, y0, x, y, victim };
  }

  // Who a punch or bite from s, facing face (1 or -1), reaches.
  function meleeVictims(squirrels, s, face) {
    return squirrels.filter((q) => q !== s && !q.drowned && !q.dead &&
      (q.x - s.x) * face > -4 && (q.x - s.x) * face < MELEE_REACH && Math.abs(q.y - s.y) < 30);
  }

  return {
    SW, SH, K, W, H, WATER, G, FPS, TURN_SECONDS, MAX_STEPS, JUMP_COST, WALK_STEP, AIR_STEER_COST, STEP_UP,
    SIZE, SQUIRRELS_PER_PLAYER, MIN_PLAYERS, MAX_PLAYERS, SPAWN_GAP, POWER_DRAG, MIN_DRAG,
    PLAYER_COLORS, SQUIRREL_NAMES, WEAPONS, WIND_PUSH, MAPS, OAK_GRASS,
    mulberry, oakGround, makeTerrain, solid, crater, dropY, standable, spawns, aimFromDrag, launch,
    ORDER, START, ROUND_UNLOCKS, PINE, RETREAT_SECONDS, MELEE_REACH, unlockedFor, lockText, blasterTrace, meleeVictims,
    TOYS, isToy, HAZARDS, MAP_KEYS, hazardOf, yardGround, roomBooks, roomBlocks, roomBricks,
  };
});
