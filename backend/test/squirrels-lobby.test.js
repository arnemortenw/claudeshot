// Rabid Squirrels #20: the three maps, and the toys and map picked in the lobby.
const test = require("node:test");
const assert = require("node:assert/strict");
const R = require("../../frontend/games/squirrels-rules.js");
const SquirrelsGame = require("../games/squirrels");
const rooms = require("../roomManager");

const io = { to: () => ({ emit() {} }) };

// ---------------------------------------------------------------- maps
test("every map generates, the same every time, with its own hazard", () => {
  assert.deepEqual(R.MAP_KEYS, ["oak", "yard", "room"]);
  const hazards = new Set();
  for (const key of R.MAP_KEYS) {
    const mask = R.makeTerrain(key);
    assert.equal(mask.length, R.W * R.H, key);
    assert.ok(mask.some((v) => v), `${key} has solid ground`);
    assert.ok(!R.solid(mask, R.W / 2, 5), `${key} has sky`);
    assert.deepEqual(R.makeTerrain(key), mask, `${key} is the same every time`);
    const hz = R.hazardOf(key);
    assert.ok(hz.lines.length && hz.splash && hz.plop, `${key} has splash and lines`);
    hazards.add(R.MAPS[key].hazard);
  }
  assert.deepEqual([...hazards].sort(), ["lava", "pool", "river"]);
  assert.throws(() => R.makeTerrain("moon"), /unknown map/);
});

test("Backyard BBQ: the pool is open water and the doghouse has a door", () => {
  const yard = R.makeTerrain("yard");
  assert.ok(!R.solid(yard, 600 * R.K, R.WATER - 10), "the pool is open");
  const dy = R.yardGround(368);
  assert.ok(!R.solid(yard, 368 * R.K, (dy - 20) * R.K), "the door is cut out");
  assert.ok(R.solid(yard, 340 * R.K, (dy - 20) * R.K), "the wall beside it is solid");
  assert.ok(R.solid(yard, 368 * R.K, (dy - 70) * R.K), "the roof is solid");
});

test("Kid's Bedroom: lava between the furniture, and the blocks have no seams to fall down", () => {
  const room = R.makeTerrain("room");
  assert.ok(!R.solid(room, 5, R.WATER - 5), "lava left of the bed");
  assert.ok(!R.solid(room, 336 * R.K, R.WATER - 5), "lava between the bed and the blocks");
  // the seam between two letter blocks on the bottom row is solid
  assert.ok(R.solid(room, 402 * R.K, 560 * R.K));
  // the seam between two brick columns is solid
  assert.ok(R.solid(room, 1088 * R.K, 560 * R.K));
});

test("18 squirrels spawn on dry ground, above the hazard, on every map", () => {
  for (const key of R.MAP_KEYS) {
    const mask = R.makeTerrain(key);
    for (const seed of [1, 2, 3, 42, 99, 2026]) {
      const sp = R.spawns(mask, 6, 3, seed);
      assert.equal(sp.length, 18, key);
      for (const s of sp) {
        assert.ok(s.y < R.WATER - 30, `${key} seed ${seed}: dry at ${s.x},${s.y}`);
        assert.ok(R.solid(mask, s.x, s.y + 1), `${key}: standing on something`);
        assert.ok(!R.solid(mask, s.x, s.y - 20), `${key}: room to stand`);
      }
      const xs = sp.map((s) => s.x).sort((a, b) => a - b);
      for (let i = 1; i < xs.length; i++) assert.ok(xs[i] - xs[i - 1] >= R.SPAWN_GAP, `${key}: apart`);
    }
  }
});

// ---------------------------------------------------------------- the match
function makeGame(settings, toys) {
  const room = {
    code: "NUTS", settings,
    players: toys.map((toy, i) => ({ id: "s" + i, name: "P" + (i + 1), toy })),
  };
  return new SquirrelsGame(room, io, () => {}, { seed: 5, log: () => {} });
}

test("the match plays the host's map and each player's toy", () => {
  const g = makeGame({ map: "room", squirrels: 3 }, ["bo", "dino", "ranger"]);
  assert.equal(g.map, "room");
  assert.deepEqual(g.mask, R.makeTerrain("room"));
  assert.equal(g.squirrels.length, 9);
  const init = g.snapshot(true);
  assert.equal(init.map, "room");
  assert.deepEqual(init.players.map((p) => p.toy), ["bo", "dino", "ranger"]);
  // an unknown map or toy falls back
  const h = makeGame({ map: "moon" }, ["nope", "sheriff"]);
  assert.equal(h.map, "oak");
  assert.ok(R.isToy(h.players[0].toy));
});

test("falling into the pool or the lava kills, with that hazard's lines", () => {
  for (const [map, hz] of [["yard", "pool"], ["room", "lava"]]) {
    const g = makeGame({ map }, ["sheriff", "ranger"]);
    const s = g.squirrels[0];
    Object.assign(s, { x: 5, y: R.WATER - 5, ground: false, vx: 0, vy: 5 });
    for (let i = 0; i < 10 && !s.drowned; i++) g.stepSquirrel(s);
    assert.ok(s.drowned && s.dead, `${map}: dead`);
    const ev = g.events;
    assert.ok(ev.some((e) => e.k === "splash" && e.big), `${map}: splash`);
    assert.ok(ev.some((e) => e.k === "pop" && R.HAZARDS[hz].lines.includes(e.text)), `${map}: ${hz} line`);
  }
});

// ---------------------------------------------------------------- the lobby
// socket ids are unique across rooms, as they are on the real server
let nextRoom = 0;
function squirrelsRoom(n) {
  const k = ++nextRoom;
  const room = rooms.createRoom(`h${k}`, "Host", "squirrels", 6);
  for (let i = 1; i < n; i++) rooms.joinRoom(room.code, `g${k}-${i}`, "Guest" + i);
  return room;
}

test("every player joins with a toy of their own while there are free ones", () => {
  const room = squirrelsRoom(4);
  const toys = room.players.map((p) => p.toy);
  assert.equal(new Set(toys).size, 4);
  for (const t of toys) assert.ok(R.isToy(t));
  assert.deepEqual(room.lobby, { map: "oak", squirrels: 2 });
});

test("the server rejects a toy someone has already taken", () => {
  const room = squirrelsRoom(3);
  const [host, g1] = room.players;
  const res = rooms.pickToy(room.code, g1.id, host.toy);
  assert.ok(res.error, "rejected");
  assert.match(res.error, /Host already has that toy/);
  assert.notEqual(g1.toy, host.toy);
  // a free one is fine
  const free = R.TOYS.find((t) => !room.players.some((p) => p.toy === t.key));
  assert.equal(rooms.pickToy(room.code, g1.id, free.key), room);
  assert.equal(g1.toy, free.key);
  // and so is an unknown one: rejected
  assert.ok(rooms.pickToy(room.code, g1.id, "dragon").error);
});

test("once every toy is taken, players 5 and 6 may share one", () => {
  const room = squirrelsRoom(6);
  assert.equal(new Set(room.players.slice(0, R.TOYS.length).map((p) => p.toy)).size, R.TOYS.length);
  const p5 = room.players[4];
  assert.ok(R.isToy(p5.toy), "player 5 got a toy");
  const other = R.TOYS.find((t) => t.key !== p5.toy).key;
  assert.equal(rooms.pickToy(room.code, p5.id, other), room, "a shared toy is allowed when none is free");
  // with three players left a toy is free again, so no more sharing
  for (const id of [room.players[5].id, room.players[2].id, room.players[1].id]) rooms.leaveRoom(id);
  assert.equal(room.players.length, 3);
  const freed = R.TOYS.find((t) => !room.players.some((p) => p.toy === t.key));
  assert.ok(freed, "a toy is free");
  const taken = room.players[0].toy;
  assert.ok(rooms.pickToy(room.code, p5.id, taken).error, "no sharing while a toy is free");
});

test("only the host picks the map and the squirrels per player", () => {
  const room = squirrelsRoom(2);
  const [host, guest] = room.players.map((p) => p.id);
  assert.ok(rooms.setSquirrelsLobby(room.code, guest, { map: "yard" }).error);
  assert.equal(room.lobby.map, "oak");
  assert.equal(rooms.setSquirrelsLobby(room.code, host, { map: "yard", squirrels: 3 }), room);
  assert.deepEqual(room.lobby, { map: "yard", squirrels: 3 });
  assert.ok(rooms.setSquirrelsLobby(room.code, host, { map: "moon" }).error);
  assert.ok(rooms.setSquirrelsLobby(room.code, host, { squirrels: 7 }).error);
});
