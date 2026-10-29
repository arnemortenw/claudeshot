const test = require("node:test");
const assert = require("node:assert/strict");
const SquirrelsGame = require("../games/squirrels");
const R = require("../../frontend/games/squirrels-rules.js");

const io = { to: () => ({ emit() {} }) };
const OAK = R.makeTerrain("oak");

function makeGame(players = 2, squirrels = 2, seed = 7) {
  const room = {
    code: "NUTS",
    settings: { squirrels },
    players: Array.from({ length: players }, (_, i) => ({ id: "s" + i, name: "P" + (i + 1) })),
  };
  const logs = [];
  const ended = [];
  const game = new SquirrelsGame(room, io, (scores) => ended.push(scores), { seed, log: (l) => logs.push(l) });
  return { game, room, logs, ended };
}

// a flat world: solid from groundY down, so walking tests don't depend on the map
function flatten(game, groundY = 600) {
  game.mask = new Uint8Array(R.W * R.H);
  game.mask.fill(1, groundY * R.W);
  game.squirrels.forEach((s, i) => { Object.assign(s, { x: 100 + i * 150, y: groundY - 1, vx: 0, vy: 0, ground: true }); });
}

function stepUntil(game, cond, max = 5000) {
  for (let i = 0; i < max; i++) { if (cond()) return true; game.step(); }
  return cond();
}

const toAim = (game) => assert.ok(stepUntil(game, () => game.phase === "aim" || game.phase === "over"), "never reached aim");

function hello(game) {
  for (const p of game.players) game.setInput(p.id, { t: "hello" });
}

// ---------------------------------------------------------------- terrain
test("the Moonlit Oak terrain is solid ground with a river gap", () => {
  assert.equal(OAK.length, R.W * R.H);
  assert.equal(R.W, 2100);
  assert.equal(R.H, 1120);
  assert.equal(R.WATER, 1050);
  assert.ok(R.solid(OAK, 300, R.H - 100), "deep ground is solid");
  assert.ok(!R.solid(OAK, 300, 20), "the sky is air");
  // the river gap runs from 850 to 935 design units
  assert.ok(!R.solid(OAK, 890 * R.K, R.WATER - 10), "the river gap is open");
  // the tunnel through the trunk is cut out
  assert.ok(!R.solid(OAK, 620 * R.K, 377 * R.K), "the tunnel is open");
  assert.ok(R.solid(OAK, 620 * R.K, 300 * R.K), "the trunk above the tunnel is solid");
  // the same seed-free shapes every time
  assert.deepEqual(R.makeTerrain("oak"), OAK);
});

test("a crater carves a round hole and nothing outside it", () => {
  const mask = OAK.slice();
  const cx = 300, cy = R.H - 200, r = 40;
  assert.ok(R.solid(mask, cx, cy));
  R.crater(mask, cx, cy, r);
  assert.ok(!R.solid(mask, cx, cy), "the centre is gone");
  assert.ok(!R.solid(mask, cx + r - 2, cy), "inside the rim is gone");
  assert.ok(R.solid(mask, cx + r + 2, cy), "outside the rim stays");
  assert.ok(R.solid(mask, cx, cy - r - 2), "above the rim stays");
  assert.equal(R.crater(mask, -500, -500, 10), null, "off the map does nothing");
});

// ---------------------------------------------------------------- spawning
test("spawns put 2 to 6 players with 2 or 3 squirrels each on dry ground, apart", () => {
  for (let players = 2; players <= 6; players++) {
    for (const per of [2, 3]) {
      for (const seed of [1, 2, 99]) {
        const sp = R.spawns(OAK, players, per, seed);
        assert.equal(sp.length, players * per);
        for (let p = 0; p < players; p++) {
          assert.deepEqual(sp.filter((s) => s.player === p).map((s) => s.index).sort(), Array.from({ length: per }, (_, i) => i));
        }
        for (const s of sp) {
          assert.ok(s.y < R.WATER - 30, `dry: ${s.y}`);
          assert.ok(R.solid(OAK, s.x, s.y + 1), "standing on something");
          assert.ok(!R.solid(OAK, s.x, s.y), "not inside the ground");
        }
        const xs = sp.map((s) => s.x).sort((a, b) => a - b);
        for (let i = 1; i < xs.length; i++) assert.ok(xs[i] - xs[i - 1] >= R.SPAWN_GAP, "no overlap");
        // left to right, the players alternate
        const byX = sp.slice().sort((a, b) => a.x - b.x);
        for (let i = 1; i < byX.length; i++) assert.notEqual(byX[i].player, byX[i - 1].player);
      }
    }
  }
});

test("a 6-player match with 3 squirrels each starts all 18 on dry ground", () => {
  const { game } = makeGame(6, 3);
  assert.equal(game.squirrels.length, 18);
  for (const s of game.squirrels) assert.ok(s.y < R.WATER - 30 && s.ground);
  assert.equal(new Set(game.players.map((p) => p.color)).size, 6);
  const { game: two } = makeGame(2, "nonsense");
  assert.equal(two.perPlayer, 2, "defaults to 2 squirrels each");
});

// ---------------------------------------------------------------- moving
test("walking costs steps and stops at 150 without ending the turn", () => {
  const { game } = makeGame();
  hello(game);
  toAim(game);
  flatten(game);
  const s = game.active;
  game.setInput(game.players[game.cur].id, { t: "move", dir: 1 });
  const x0 = s.x;
  for (let i = 0; i < 200; i++) game.step();
  assert.equal(game.steps, 0);
  assert.ok(Math.abs(s.x - x0 - R.MAX_STEPS) < 2, `walked ${s.x - x0}`);
  const x1 = s.x;
  for (let i = 0; i < 60; i++) game.step();
  assert.equal(s.x, x1, "no more walking");
  assert.equal(game.phase, "aim", "the turn goes on");
});

test("a jump costs 20 steps and the arrows steer in the air", () => {
  const { game } = makeGame();
  hello(game);
  toAim(game);
  flatten(game);
  const id = game.players[game.cur].id, s = game.active;
  s.face = 1;
  game.setInput(id, { t: "jump" });
  assert.equal(game.steps, R.MAX_STEPS - R.JUMP_COST);
  assert.equal(s.ground, false);
  game.setInput(id, { t: "move", dir: -1 });
  game.step(); game.step();
  assert.ok(s.vx < 2.6, "steering slows the jump");
  assert.ok(game.steps < R.MAX_STEPS - R.JUMP_COST, "steering costs steps");
  assert.ok(stepUntil(game, () => s.ground, 300), "lands");
  game.setInput(id, { t: "move", dir: 0 });
  game.steps = 10;
  game.setInput(id, { t: "jump" });
  assert.equal(s.ground, true, "too tired to jump");
  assert.equal(game.steps, 10);
});

test("only the player whose turn it is can act", () => {
  const { game } = makeGame();
  hello(game);
  toAim(game);
  const other = game.players.find((p) => p.slot !== game.cur);
  game.setInput(other.id, { t: "end" });
  assert.equal(game.phase, "aim");
  game.setInput(game.players[game.cur].id, { t: "end" });
  assert.equal(game.phase, "settle");
});

// ---------------------------------------------------------------- turns
function playTurn(game) {
  toAim(game);
  const t = { cur: game.cur, sq: game.active.n, round: game.round };
  game.endTurn();
  return t;
}

test("turns rotate players, squirrels within a player, and count rounds", () => {
  const { game } = makeGame(3, 2);
  hello(game);
  const seen = [];
  for (let i = 0; i < 7; i++) seen.push(playTurn(game));
  assert.deepEqual(seen.map((t) => [t.cur, t.sq, t.round]), [
    [0, 0, 1], [1, 0, 1], [2, 0, 1],
    [0, 1, 2], [1, 1, 2], [2, 1, 2],
    [0, 0, 3],
  ]);
});

test("the turn ends at 30 seconds", () => {
  const { game } = makeGame();
  hello(game);
  toAim(game);
  for (let i = 0; i < R.TURN_SECONDS * R.FPS - 1; i++) game.step();
  assert.equal(game.phase, "aim");
  game.step();
  assert.equal(game.phase, "settle");
});

test("dead squirrels and dead players are skipped", () => {
  const { game } = makeGame(3, 2);
  hello(game);
  // player 0's first squirrel is dead: it plays its second one
  game.squirrels.find((s) => s.p === 0 && s.n === 0).dead = true;
  // player 1 is out
  game.squirrels.filter((s) => s.p === 1).forEach((s) => { s.dead = true; });
  const seen = [];
  for (let i = 0; i < 5; i++) seen.push(playTurn(game));
  assert.deepEqual(seen.map((t) => [t.cur, t.sq, t.round]), [
    [0, 1, 1], [2, 0, 1],
    [0, 1, 2], [2, 1, 2],
    [0, 1, 3],
  ]);
});

test("a player who dies mid-round doesn't hold the round up", () => {
  const { game } = makeGame(3, 2);
  hello(game);
  playTurn(game);                       // player 0
  game.squirrels.filter((s) => s.p === 2).forEach((s) => { s.dead = true; });
  const t = playTurn(game);             // player 1
  assert.deepEqual([t.cur, t.round], [1, 1]);
  const n = playTurn(game);             // round 2 starts with player 0
  assert.deepEqual([n.cur, n.round], [0, 2]);
});

// ---------------------------------------------------------------- win
test("the match ends when one player is left, and ranks everyone", () => {
  const { game, logs, ended } = makeGame(3, 2);
  hello(game);
  toAim(game);
  game.players[0].dealt = 50;
  game.squirrels.filter((s) => s.p === 1).forEach((s) => game.kill(s));
  game.frame += 100;
  game.squirrels.filter((s) => s.p === 0).forEach((s) => game.kill(s));
  game.endTurn();
  assert.ok(stepUntil(game, () => game.phase === "over"));
  assert.equal(game.winner.name, "P3");
  assert.deepEqual(game.results.map((r) => [r.name, r.place, r.winner]), [["P3", 1, true], ["P1", 2, false], ["P2", 3, false]]);
  assert.match(logs.at(-1), /^\[squirrels\] match end .*"room":"NUTS".*"winner":"P3"/);
  assert.match(logs.at(-1), /"date":"\d{4}-\d\d-\d\dT/);
  assert.equal(ended.length, 0, "the winner banner shows first");
  stepUntil(game, () => ended.length > 0, 1000);
  assert.deepEqual(ended[0].map((s) => s.name), ["P3", "P1", "P2"]);
  assert.ok(ended[0][0].score > ended[0][1].score);
});

test("nobody wins when the last squirrels go down together", () => {
  const { game } = makeGame(2, 2);
  hello(game);
  toAim(game);
  game.squirrels.forEach((s) => game.kill(s));
  game.endTurn();
  assert.ok(stepUntil(game, () => game.phase === "over"));
  assert.equal(game.winner, null);
  assert.equal(game.results.length, 2);
});

// ---------------------------------------------------------------- drowning
test("a squirrel that falls in the river drowns", () => {
  const { game } = makeGame(2, 2);
  const s = game.squirrels[0];
  Object.assign(s, { x: 890 * R.K, y: R.WATER - 200, ground: false, vx: 0, vy: 0 });
  stepUntil(game, () => s.drowned, 300);
  assert.ok(s.drowned && s.dead);
  assert.equal(s.hp, 0);
  assert.ok(game.events.some((e) => e.k === "splash"));
});

// ---------------------------------------------------------------- the bazooka
test("the Acorn Bazooka carves a crater and hurts whoever is near", () => {
  const { game } = makeGame(2, 2);
  hello(game);
  toAim(game);
  flatten(game);
  const me = game.active, them = game.squirrels.find((s) => s.p !== me.p);
  Object.assign(them, { x: me.x + 300, y: me.y });
  game.wind = 0;
  // straight down at your own feet hurts you, not them
  game.setInput(game.players[game.cur].id, { t: "fire", ang: Math.PI / 2, pow: 0.5 });
  assert.equal(game.phase, "flight");
  stepUntil(game, () => game.phase !== "flight", 600);
  assert.equal(game.craters.length, 1);
  assert.ok(me.hp < 100 && me.hp > 0);
  assert.equal(them.hp, 100);
  assert.equal(game.players[me.p].dealt, 0, "self damage doesn't count");
});

test("a too-short drag doesn't fire", () => {
  const { game } = makeGame();
  hello(game);
  toAim(game);
  game.setInput(game.players[game.cur].id, { t: "fire", ang: 0, pow: 0.05 });
  assert.equal(game.phase, "aim");
});

// ---------------------------------------------------------------- logging
test("a match logs its start, and its abandon when stopped early", () => {
  const { game, logs } = makeGame(2, 3);
  game.start();
  game.stop();
  assert.equal(logs.length, 2);
  assert.match(logs[0], /^\[squirrels\] match start /);
  const start = JSON.parse(logs[0].replace("[squirrels] match start ", ""));
  assert.equal(start.room, "NUTS");
  assert.deepEqual(start.players, ["P1", "P2"]);
  assert.equal(start.squirrels, 3);
  assert.ok(!Number.isNaN(Date.parse(start.date)));
  const end = JSON.parse(logs[1].replace("[squirrels] match abandoned ", ""));
  assert.equal(end.winner, null);
  game.stop();
  assert.equal(logs.length, 2, "logged once");
});
