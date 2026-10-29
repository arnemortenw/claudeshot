const test = require("node:test");
const assert = require("node:assert/strict");
const SquirrelsGame = require("../games/squirrels");
const R = require("../../frontend/games/squirrels-rules.js");

const io = { to: () => ({ emit() {} }) };

function makeGame(players = 2, map = "oak", seed = 7) {
  const room = {
    code: "NUTS",
    settings: { map },
    players: Array.from({ length: players }, (_, i) => ({ id: "s" + i, name: "P" + (i + 1) })),
  };
  return new SquirrelsGame(room, io, () => {}, { seed, log: () => {} });
}

function stepUntil(game, cond, max = 5000) {
  for (let i = 0; i < max; i++) { if (cond()) return true; game.step(); }
  return cond();
}

// A started match on a flat world: ground from y 600 down, the active
// squirrel at x 400 and the others far off to the right.
function flatMatch(players = 2) {
  const game = makeGame(players);
  for (const p of game.players) game.setInput(p.id, { t: "hello" });
  assert.ok(stepUntil(game, () => game.phase === "aim"));
  game.mask = new Uint8Array(R.W * R.H);
  game.mask.fill(1, 600 * R.W);
  game.squirrels.forEach((s, i) => Object.assign(s, { x: 1400 + i * 120, y: 599, vx: 0, vy: 0, ground: true }));
  Object.assign(game.active, { x: 400 });
  game.wind = 0;
  game.pickups = [];
  game.events = [];
  return game;
}
const me = (game) => game.players[game.cur];

test("every map has a Napalm and an H-Bomb crate, resting on solid ground above the hazard", () => {
  const spots = {
    oak: { napalm: [620, 360], hbomb: [588, 60] },
    yard: { napalm: [945, 400], hbomb: [1150, 100] },
    room: { napalm: [215, 370], hbomb: [1122, 100] },
    ark: { napalm: [210, 515], hbomb: [735, 60] },
  };
  for (const map of R.MAP_KEYS) {
    const game = makeGame(6, map);
    assert.deepEqual(game.pickups.map((pk) => pk.type), ["napalm", "hbomb"], map);
    for (const pk of game.pickups) {
      const [x, y] = spots[map][pk.type];
      assert.equal(pk.x, x * R.K, `${map} ${pk.type} x`);
      assert.ok(pk.y >= y * R.K, `${map} ${pk.type} drops down, not up`);
      assert.ok(!pk.taken, `${map} ${pk.type} is there`);
      assert.ok(R.solid(game.mask, pk.x, pk.y + 1) && !R.solid(game.mask, pk.x, pk.y), `${map} ${pk.type} rests on the terrain`);
      assert.ok(pk.y < R.WATER - 30, `${map} ${pk.type} is above the hazard`);
      for (const s of game.squirrels) assert.ok(!R.touchesPickup(s, pk), `${map}: ${s.name} doesn't start on the ${pk.type}`);
    }
  }
});

test("a squirrel that touches a crate takes it for its own player only", () => {
  const game = flatMatch(3);
  const other = game.squirrels.find((s) => s.p !== game.cur);
  game.pickups = [{ type: "napalm", x: other.x + 10, y: 599, taken: false }];
  game.step();
  assert.ok(game.pickups[0].taken);
  const owner = game.players[other.p];
  assert.equal(owner.found.napalm, 1);
  for (const p of game.players) if (p !== owner) assert.equal(p.found.napalm, 0);
  assert.ok(game.events.some((e) => e.k === "found" && e.w === "napalm" && e.slot === owner.slot));
  const snap = game.snapshot(false);
  assert.equal(snap.fd[owner.slot].napalm, 1);
  assert.equal(snap.pk[0].taken, true);
  // the player whose turn it is can't fire it
  game.setInput(me(game).id, { t: "weapon", w: "napalm" });
  assert.equal(me(game).weapon, "bazooka");
});

test("a crate drops onto the ground, and one that falls into the hazard is lost", () => {
  const game = flatMatch();
  game.pickups = [{ type: "hbomb", x: 1000, y: 300, taken: false }];
  stepUntil(game, () => R.solid(game.mask, 1000, game.pickups[0].y + 1), 400);
  assert.equal(game.pickups[0].y, 599);
  // a crater opens under it: it falls, into the river
  for (let y = 600; y < R.H; y++) game.mask.fill(0, y * R.W + 900, y * R.W + 1100);
  game.events = [];
  assert.ok(stepUntil(game, () => game.pickups[0].taken, 600));
  assert.ok(game.players.every((p) => p.found.hbomb === 0), "nobody gets it");
  assert.ok(game.events.some((e) => e.k === "pop" && /sank/.test(e.text)));
});

test("a found pickup is used up when fired", () => {
  const game = flatMatch();
  const p = me(game);
  p.found.napalm = 1;
  game.setInput(p.id, { t: "weapon", w: "napalm" });
  assert.equal(p.weapon, "napalm");
  game.setInput(p.id, { t: "fire", ang: -1.2, pow: 0.5 });
  assert.equal(game.shots[0].type, "napalm");
  assert.equal(p.found.napalm, 0);
  assert.equal(p.weapon, "bazooka");
  assert.ok(!game.has(p, "napalm"));
});

test("the Napalm does 12, leaves 14 burning pistachios that burn 4 every 20 frames for about 3 s", () => {
  const game = flatMatch();
  const p = me(game), them = game.squirrels.find((s) => s.p !== game.cur);
  Object.assign(them, { x: 1000 });
  p.found.napalm = 1;
  game.setInput(p.id, { t: "weapon", w: "napalm" });
  game.setInput(p.id, { t: "fire", ang: 0, pow: 0.3 });
  // drop it right on top of them
  Object.assign(game.shots[0], { x: 1000, y: 560, vx: 0, vy: 2 });
  stepUntil(game, () => game.craters.length > 0, 60);
  assert.equal(game.craters[0].r, 22);
  const flames = game.shots.filter((s) => s.type === "flame");
  assert.equal(flames.length, 14);
  assert.ok(flames.every((f) => f.life >= R.FLAME.life && f.life < R.FLAME.life + R.FLAME.jitter));

  // the blast throws them clear: put them back in the fire, then count the burn
  Object.assign(them, { x: 1000, y: 599, vx: 0, vy: 0, ground: true, hp: 100 });
  for (const f of game.shots) Object.assign(f, { x: 1000, y: 597, vx: 0, vy: 0, stuck: true });
  const life = Math.max(...game.shots.map((f) => f.life));
  stepUntil(game, () => !game.shots.length, 400);
  const ticks = Math.floor(life / R.FLAME.every);
  assert.ok(them.dead, `14 pistachios × 4 × ${ticks} ticks burns them out`);

  // one pistachio alone: 4 per 20 frames
  const g2 = flatMatch();
  const t2 = g2.squirrels.find((s) => s.p !== g2.cur);
  Object.assign(t2, { x: 1000, hp: 100 });
  g2.shots.push({ type: "flame", x: 1005, y: 597, vx: 0, vy: 0, t: 0, life: 180, stuck: true, owner: g2.active, fuse: 0 });
  for (let i = 0; i < 20; i++) g2.step();
  assert.equal(t2.hp, 96);
  for (let i = 0; i < 160; i++) g2.step();
  assert.equal(t2.hp, 100 - 4 * 9, "9 ticks in 3 seconds");
  assert.equal(g2.shots.length, 0, "burnt out");
  // standing just out of reach: no burn
  g2.shots.push({ type: "flame", x: 1000 + R.FLAME.reach + 4, y: 587, vx: 0, vy: 0, t: 0, life: 40, stuck: true, owner: g2.active, fuse: 0 });
  for (let i = 0; i < 40; i++) g2.step();
  assert.equal(t2.hp, 64);
});

test("the H-Bomb kills every squirrel within 240 px, the thrower's too, and leaves a radius-150 crater", () => {
  const game = flatMatch(4);
  const p = me(game), s = game.active;
  const others = game.squirrels.filter((q) => q !== s);
  Object.assign(s, { x: 900 });
  Object.assign(others[0], { x: 1000 + 230 });   // just inside
  Object.assign(others[1], { x: 1000 - 100 + 0.5 });
  Object.assign(others[2], { x: 1000 + 260 });   // just outside
  p.found.hbomb = 1;
  game.setInput(p.id, { t: "weapon", w: "hbomb" });
  game.setInput(p.id, { t: "fire", ang: -0.3, pow: 0.2 });
  Object.assign(game.shots[0], { x: 1000, y: 570, vx: 0, vy: 2, t: 99 });
  game.events = [];
  stepUntil(game, () => game.craters.length > 0, 60);
  assert.equal(game.craters[0].r, 150);
  assert.ok(game.events.some((e) => e.k === "nuke"));
  assert.ok(s.dead, "the thrower is in range");
  assert.ok(others[0].dead && others[1].dead);
  assert.ok(!others[2].dead && others[2].hp === 100, "outside the radius: untouched");
  assert.ok(!R.solid(game.mask, 1000, 570 + 140), "a huge crater");
  assert.equal(p.found.hbomb, 0);
});
