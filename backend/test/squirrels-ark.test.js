// Rabid Squirrels: ARK Nyåpning, the fourth map. The ARK bookstore, its sign
// the enemy, and a returns shredder under the floor.
const test = require("node:test");
const assert = require("node:assert/strict");
const R = require("../../frontend/games/squirrels-rules.js");
const SquirrelsGame = require("../games/squirrels");

const io = { to: () => ({ emit() {} }) };
const ARK = R.makeTerrain("ark");
const at = (x, y) => R.solid(ARK, x * R.K, y * R.K);   // design units

function makeGame(players, seed) {
  const room = { code: "ARKK", settings: { map: "ark" }, players: Array.from({ length: players }, (_, i) => ({ id: "s" + i, name: "P" + (i + 1) })) };
  return new SquirrelsGame(room, io, () => {}, { seed, log: () => {} });
}

test("ARK Nyåpning is the fourth map, over the returns shredder", () => {
  assert.equal(R.MAPS.ark.name, "ARK Nyåpning");
  assert.equal(R.MAPS.ark.order, 3);
  const hz = R.hazardOf("ark");
  assert.equal(hz.name, "Returns shredder");
  assert.deepEqual(hz.words, ["SHRED!", "PULPED!", "RETURNED!"]);
});

test("the ARK sign, its letters and its logo are solid; the holes in the A and R and between the A's legs are not", () => {
  for (const [x, y] of [[518, 140], [566, 130], [646, 130], [735, 136], [600, 163]]) assert.ok(at(x, y), `solid at ${x},${y}`);
  for (const [x, y] of [[518, 128], [518, 155], [589, 117], [735, 60]]) assert.ok(!at(x, y), `air at ${x},${y}`);
});

test("the cover is hollow: under the sale tables and inside the 10-kroner shelf", () => {
  assert.ok(at(210, 455), "the left table top");
  assert.ok(!at(210, 525), "a gap under the left table");
  assert.ok(!at(970, 530), "a gap under the right table");
  for (const y of [290, 370, 450, 520]) assert.ok(!at(630, y), `a compartment in the shelf at y ${y}`);
  for (const y of [255, 335, 415, 495]) assert.ok(at(630, y), `a shelf at y ${y}`);
});

test("the floor has two holes down to the shredder", () => {
  for (const x of [200, 600, 1000]) assert.ok(at(x, 560), `floor at x ${x}`);
  for (const x of [435, 830]) {
    for (let y = 0; y < 600; y += 4) if (at(x, y)) assert.fail(`the hole at x ${x} is open all the way down, but y ${y} is solid`);
  }
});

test("nobody starts on the sign or the balloons, for 2 to 6 players", () => {
  for (let players = 2; players <= 6; players++) for (let seed = 1; seed <= 8; seed++) {
    const game = makeGame(players, seed);
    assert.equal(game.squirrels.length, players);
    for (const s of game.squirrels) {
      const x = s.x / R.K;
      assert.ok(!R.MAPS.ark.noSpawn.some(([a, b]) => x >= a && x <= b), `seed ${seed}: ${s.name} at x ${Math.round(x)}`);
      assert.ok(s.y < R.WATER - 30, `seed ${seed}: ${s.name} is above the shredder`);
    }
  }
});

test("the Napalm lands under the left sale table and the H-Bomb on top of the logo", () => {
  const game = makeGame(4, 3);
  const nap = game.pickups.find((p) => p.type === "napalm"), bomb = game.pickups.find((p) => p.type === "hbomb");
  assert.ok(Math.abs(nap.y / R.K - R.ARK.floor) < 2, `napalm rests on the floor under the table (y ${nap.y / R.K})`);
  assert.ok(at(210, 455), "with the table above it");
  const logoTop = R.ARK.logo[1] - R.ARK.logo[2];
  assert.ok(Math.abs(bomb.y / R.K - logoTop) < 3, `H-Bomb rests on the logo (y ${bomb.y / R.K})`);
});
