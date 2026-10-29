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

test("a 6-player match starts one squirrel each, all on dry ground", () => {
  const { game } = makeGame(6, 3);
  assert.equal(game.perPlayer, 1, "an old squirrels setting is ignored");
  assert.equal(game.squirrels.length, 6);
  assert.deepEqual(game.squirrels.map((s) => s.p), [0, 1, 2, 3, 4, 5]);
  for (const s of game.squirrels) assert.ok(s.y < R.WATER - 30 && s.ground);
  assert.equal(new Set(game.players.map((p) => p.color)).size, 6);
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

test("turns rotate players and count rounds", () => {
  const { game } = makeGame(3, 2);
  hello(game);
  const seen = [];
  for (let i = 0; i < 7; i++) seen.push(playTurn(game));
  assert.deepEqual(seen.map((t) => [t.cur, t.sq, t.round]), [
    [0, 0, 1], [1, 0, 1], [2, 0, 1],
    [0, 0, 2], [1, 0, 2], [2, 0, 2],
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

test("dead players are skipped", () => {
  const { game } = makeGame(3, 2);
  hello(game);
  // player 1 is out
  game.squirrels.filter((s) => s.p === 1).forEach((s) => { s.dead = true; });
  const seen = [];
  for (let i = 0; i < 5; i++) seen.push(playTurn(game));
  assert.deepEqual(seen.map((t) => [t.cur, t.round]), [
    [0, 1], [2, 1],
    [0, 2], [2, 2],
    [0, 3],
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
  assert.equal(start.squirrels, 1);
  assert.ok(!Number.isNaN(Date.parse(start.date)));
  const end = JSON.parse(logs[1].replace("[squirrels] match abandoned ", ""));
  assert.equal(end.winner, null);
  game.stop();
  assert.equal(logs.length, 2, "logged once");
});

// ---------------------------------------------------------------- toys
test("there are six toys, and each of the six player slots gets a different one", () => {
  const ART = require("../../frontend/games/squirrels-art.js");
  const ids = Object.keys(ART.TOYS);
  assert.equal(ids.length, 6);
  assert.equal(new Set(ids).size, 6);
  const slots = Array.from({ length: 6 }, (_, i) => ART.toyFor(i));
  assert.equal(new Set(slots).size, 6);
  slots.forEach((k) => assert.ok(ART.TOYS[k], `unknown toy ${k}`));
  assert.ok(ids.includes("pig") && ids.includes("spud"));
});

// ---------------------------------------------------------------- weapons (#19)
const me = (game) => game.players[game.cur];
const enemyOf = (game) => game.squirrels.find((s) => s.p !== game.active.p);

// a flat world with the active squirrel at x 400 and one enemy at enemyDx from it
function duel(enemyDx, players = 2) {
  const { game } = makeGame(players, 2);
  hello(game);
  toAim(game);
  flatten(game);
  const s = game.active, them = enemyOf(game);
  game.squirrels.forEach((q, i) => { if (q !== s) Object.assign(q, { x: 1600 + i * 80 }); });
  Object.assign(s, { x: 400 });
  Object.assign(them, { x: 400 + enemyDx });
  game.wind = 0;
  return { game, s, them };
}

test("everyone starts with the four starting weapons, and nothing locked can be picked", () => {
  const { game } = makeGame(3, 2);
  hello(game);
  toAim(game);
  assert.deepEqual(game.unlocked, ["bazooka", "grenade", "blaster", "punch"]);
  for (const w of ["grenade", "blaster", "punch", "bazooka"]) {
    game.setInput(me(game).id, { t: "weapon", w });
    assert.equal(me(game).weapon, w);
  }
  for (const w of ["cluster", "bite", "coconut", "teleport", "napalm", "hbomb", "nope"]) {
    game.setInput(me(game).id, { t: "weapon", w });
    assert.equal(me(game).weapon, "bazooka", w + " is locked");
  }
  const other = game.players.find((p) => p.slot !== game.cur);
  game.setInput(other.id, { t: "weapon", w: "grenade" });
  assert.equal(other.weapon, "bazooka", "only on your own turn");
});

test("rounds 2, 3 and 4 unlock Pinecone, then Bite, then Coconut for everyone, with a banner", () => {
  const { game } = makeGame(2, 2);
  hello(game);
  const seen = [];
  for (let i = 0; i < 8; i++) {
    const before = game.round;
    playTurn(game);
    stepUntil(game, () => game.phase === "aim" && game.round >= before);
    if (game.round !== before) seen.push([game.round, game.unlocked.slice(4)]);
  }
  assert.deepEqual(seen, [
    [2, ["cluster"]],
    [3, ["cluster", "bite"]],
    [4, ["cluster", "bite", "coconut"]],
    [5, ["cluster", "bite", "coconut"]],
  ]);
  assert.deepEqual(R.unlockedFor(4), game.unlocked);
});

test("a kill gives every player a Teleport, and teleporting keeps your attack", () => {
  const { game, s, them } = duel(300, 3);
  them.hp = 10;
  game.setInput(me(game).id, { t: "fire", ang: 0, pow: 0 }); // blaster not picked: too short, nothing happens
  game.setInput(me(game).id, { t: "weapon", w: "blaster" });
  game.setInput(me(game).id, { t: "fire", ang: 0.02, pow: 0.5 });
  assert.ok(them.dead);
  assert.equal(game.turnKills, 1);
  const events = [];
  stepUntil(game, () => { events.push(...game.events); game.events = []; return game.phase === "aim"; });
  assert.deepEqual(game.players.map((p) => p.teleports), [1, 1, 1]);
  assert.ok(events.some((e) => e.k === "banner" && /Teleport/.test(e.sub)));
  assert.ok(events.some((e) => e.k === "unlock" && e.w.includes("teleport")));

  // the next player teleports, then still fires
  flatten(game);
  const p = me(game), a = game.active;
  game.setInput(p.id, { t: "weapon", w: "teleport" });
  assert.equal(p.weapon, "teleport");
  game.setInput(p.id, { t: "fire", x: 1000, y: 400 });
  assert.equal(a.x, 1000);
  assert.equal(p.teleports, 0);
  assert.equal(p.weapon, "bazooka");
  assert.equal(game.phase, "aim", "teleport doesn't use the attack");
  assert.equal(game.fired, false);
  game.setInput(p.id, { t: "fire", x: 1200, y: 700 });  // no charges left: nothing happens
  game.setInput(p.id, { t: "fire", ang: -1, pow: 0.6 });
  assert.equal(game.phase, "flight");
});

test("killing your own squirrel gives nobody a Teleport", () => {
  const { game, s } = duel(600);
  s.hp = 5;
  game.setInput(me(game).id, { t: "fire", ang: Math.PI / 2, pow: 0.3 });   // straight down at your own feet
  assert.ok(stepUntil(game, () => s.dead, 300), "blew itself up");
  assert.equal(game.turnKills, 0);
});

test("a teleport into the ground or the river is refused", () => {
  const { game, s } = duel(300);
  me(game).teleports = 1;
  game.setInput(me(game).id, { t: "weapon", w: "teleport" });
  game.setInput(me(game).id, { t: "fire", x: 800, y: 700 });
  game.setInput(me(game).id, { t: "fire", x: 800, y: R.WATER + 10 });
  assert.equal(s.x, 400);
  assert.equal(me(game).teleports, 1);
});

test("the Nut Blaster hits the first squirrel along its line, in a straight line with no wind", () => {
  const { game, s, them } = duel(500);
  game.wind = 1;
  const b = R.blasterTrace((x, y) => game.solid(x, y), game.squirrels, s, 0);
  assert.equal(b.victim, them);
  // a little off the line misses them
  const miss = R.blasterTrace((x, y) => game.solid(x, y), game.squirrels, s, -0.2);
  assert.equal(miss.victim, null);
  // out of range: nothing
  Object.assign(them, { x: 400 + 1200 });
  assert.equal(R.blasterTrace((x, y) => game.solid(x, y), game.squirrels, s, 0).victim, null);
  Object.assign(them, { x: 900 });
  game.setInput(me(game).id, { t: "weapon", w: "blaster" });
  game.setInput(me(game).id, { t: "fire", ang: 0, pow: 0.5 });
  assert.equal(them.hp, 70);
  assert.ok(them.vx > 0, "knocked back along the line");
  assert.equal(game.phase, "settle");
});

test("the Nut Blaster blows a small crater with splash when it hits the ground", () => {
  const { game, s, them } = duel(40);
  game.setInput(me(game).id, { t: "weapon", w: "blaster" });
  game.setInput(me(game).id, { t: "fire", ang: Math.PI - 0.3, pow: 0.5 });  // down-left, away from them
  assert.equal(game.craters.length, 1);
  assert.equal(game.craters[0].r, 16);
  assert.equal(them.hp, 100);
});

test("the Macadamia Nut Punch does 30, launches the target and makes the puncher hop", () => {
  const { game, s, them } = duel(25);
  game.setInput(me(game).id, { t: "weapon", w: "punch" });
  game.setInput(me(game).id, { t: "fire", x: s.x + 100, y: s.y });
  assert.equal(them.hp, 70);
  assert.equal(them.vx, 5);
  assert.equal(them.vy, -12);
  assert.equal(s.vy, -4.5);
  assert.equal(game.phase, "settle");
});

test("a punch on the other side misses", () => {
  const { game, them } = duel(25);
  game.setInput(me(game).id, { t: "weapon", w: "punch" });
  game.setInput(me(game).id, { t: "fire", x: 100, y: 500 });
  assert.equal(them.hp, 100);
  assert.equal(game.fired, true, "a miss still uses the attack");
});

test("the Rabid Bite does 35 with a strong knockback, once unlocked", () => {
  const { game, s, them } = duel(-25);
  game.setInput(me(game).id, { t: "weapon", w: "bite" });
  assert.equal(me(game).weapon, "bazooka", "locked in round 1");
  game.unlocked = R.unlockedFor(3);
  game.setInput(me(game).id, { t: "weapon", w: "bite" });
  game.setInput(me(game).id, { t: "fire", x: s.x - 50, y: s.y });
  assert.equal(them.hp, 65);
  assert.equal(them.vx, -8);
  assert.equal(them.vy, -6);
});

test("the Pinecone Cluster bursts into 5 pine nuts of 15 each", () => {
  const { game, s } = duel(800);
  game.unlocked = R.unlockedFor(2);
  game.setInput(me(game).id, { t: "weapon", w: "cluster" });
  game.setInput(me(game).id, { t: "fire", ang: -Math.PI / 2 + 0.25, pow: 0.4 });
  assert.equal(game.shots.length, 1);
  stepUntil(game, () => game.shots.length !== 1, 600);
  assert.equal(game.shots.length, 5);
  assert.ok(game.shots.every((p) => p.type === "pine"));
  assert.equal(game.craters[0].r, 32);
  stepUntil(game, () => !game.shots.length, 600);
  assert.equal(game.craters.length, 6);
  assert.ok(game.craters.slice(1).every((c) => c.r === R.PINE.r));
});

test("the Nut Grenade bounces and goes off after 3 seconds", () => {
  const { game } = duel(800);
  game.setInput(me(game).id, { t: "weapon", w: "grenade" });
  game.setInput(me(game).id, { t: "fire", ang: -0.6, pow: 0.3 });
  for (let i = 0; i < 3 * R.FPS - 1; i++) game.step();
  assert.equal(game.shots.length, 1, "still going");
  assert.equal(game.craters.length, 0);
  game.step();
  assert.equal(game.craters.length, 1);
  assert.equal(game.craters[0].r, 50);
});

test("the Coconut Strike drops on the clicked spot for 70", () => {
  const { game, them } = duel(500);
  game.unlocked = R.unlockedFor(4);
  game.setInput(me(game).id, { t: "weapon", w: "coconut" });
  game.setInput(me(game).id, { t: "fire", x: them.x, y: 100 });
  assert.equal(game.shots[0].type, "coconut");
  stepUntil(game, () => game.craters.length > 0, 600);
  assert.equal(game.craters[0].r, 62);
  assert.ok(Math.abs(game.craters[0].x - them.x) < 1);
  assert.ok(them.hp <= 100 - 50 && them.hp > 0, "near full damage");
});

test("the launch speeds match v8", () => {
  assert.equal(R.WEAPONS.bazooka.speed, 23);
  assert.equal(R.WEAPONS.grenade.speed, 19);
  assert.equal(R.WEAPONS.cluster.speed, 21.5);
});

// ---------------------------------------------------------------- the retreat
function firedPunch() {
  const { game, s, them } = duel(600);
  game.setInput(me(game).id, { t: "weapon", w: "punch" });
  game.setInput(me(game).id, { t: "fire", x: s.x + 50, y: s.y });
  stepUntil(game, () => s.ground, 200);
  return { game, s, them };
}

test("after an attack you can walk for up to 5 seconds, then the turn ends", () => {
  const { game, s } = firedPunch();
  const cur = game.cur, start = game.retreatT;
  assert.ok(game.retreating());
  game.setInput(me(game).id, { t: "move", dir: 1 });
  const x0 = s.x;
  game.step(); game.step();
  assert.ok(s.x > x0, "walks during the retreat");
  game.setInput(me(game).id, { t: "fire", ang: 0, pow: 1 });  // no second attack
  assert.equal(game.shots.length, 0);
  game.setInput(me(game).id, { t: "weapon", w: "grenade" });
  assert.equal(me(game).weapon, "punch", "the tray is locked");
  game.setInput(me(game).id, { t: "move", dir: 0 });
  for (let i = 0; i < start; i++) game.step();
  assert.ok(!game.retreating());
  assert.ok(stepUntil(game, () => game.cur !== cur, 200), "the turn ends");
});

test("End turn ends the retreat at once", () => {
  const { game } = firedPunch();
  const cur = game.cur;
  game.setInput(me(game).id, { t: "end" });
  assert.ok(!game.retreating());
  assert.ok(stepUntil(game, () => game.cur !== cur, Math.round(2.5 * R.FPS) + 40));
});

test("running out of steps ends the retreat", () => {
  const { game } = firedPunch();
  game.steps = 0;
  assert.ok(game.retreating());
  for (let i = 0; i < 40; i++) game.step();
  assert.ok(!game.retreating());
  assert.ok(game.retreatT > 0, "before the 5 seconds were up");
});

test("the retreat runs while the shot is still flying", () => {
  const { game, s } = duel(800);
  game.setInput(me(game).id, { t: "fire", ang: -Math.PI / 2 + 0.1, pow: 0.9 });
  assert.equal(game.phase, "flight");
  game.setInput(me(game).id, { t: "move", dir: -1 });
  const x0 = s.x;
  for (let i = 0; i < 10; i++) game.step();
  assert.equal(game.phase, "flight");
  assert.ok(s.x < x0);
  assert.ok(game.snapshot().rt > 0);
});

test("after the blast settles the turn waits 2.5 seconds before the next squirrel", () => {
  const { game } = makeGame();
  hello(game);
  toAim(game);
  game.endTurn();                                   // no shot: settles at once
  let still = 0;
  while (game.phase === "settle" && still < 600) { game.step(); still++; }
  assert.ok(still >= 2.5 * R.FPS, `held ${still} frames`);
  assert.notEqual(game.phase, "settle");
});
