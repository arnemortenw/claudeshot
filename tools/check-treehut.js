#!/usr/bin/env node
// Referee checks for Drey's Treehut (backend/games/treehut.js) and its shared
// rules (frontend/games/treehut-rules.js).
//
// Drives the game with a fake socket.io, a fake room and a hand-cranked clock.
//   node tools/check-treehut.js

const fs = require("fs");
const path = require("path");
const TreehutGame = require("../backend/games/treehut.js");
const R = require("../frontend/games/treehut-rules.js");

let NOW = 1_000_000;
const realNow = Date.now;
Date.now = () => NOW;

let passed = 0;
const failures = [];
function check(name, cond, detail) {
  if (cond) passed++;
  else failures.push(name + (detail !== undefined ? "  -> " + JSON.stringify(detail) : ""));
}

// Everyone has read the briefing unless { briefing: true } keeps them on it.
function makeGame(names, opts = {}) {
  const log = [];
  const io = { to: (to) => ({ emit: (ev, data) => log.push({ to, ev, data: JSON.parse(JSON.stringify(data)) }) }) };
  const room = { code: "TEST", players: names.map((n, i) => ({ id: "s" + (i + 1), name: n })), settings: {} };
  let ended = null;
  const game = new TreehutGame(room, io, (scores) => { ended = scores; });
  game.start();
  clearInterval(game.timer);           // we crank the clock ourselves
  if (!opts.briefing) room.players.forEach((p) => game.setInput(p.id, { t: "enter" }));
  const g = {
    game, room, log,
    get ended() { return ended; },
    input: (sid, data) => { NOW += R.MOVE_MS; game.setInput(sid, data); },
    tick: () => game.tick(),
    state: () => [...log].reverse().find((e) => e.ev === "treehut-state").data,
    events: (ev, to) => log.filter((e) => e.ev === ev && (to === undefined || e.to === to)),
    me: (sid) => game.players.get(sid),
    score: (sid) => ({ ...game.players.get(sid).score }),
    total: (sid) => { const s = game.players.get(sid).score; return s.challenge + s.clue + s.helping; },
    // walk one player next to (or onto) a tile, one step at a time
    walkTo(sid, tx, ty, onto) {
      const p = game.players.get(sid);
      const room = game.roomIdx;
      const goal = (x, y) => onto ? x === tx && y === ty : Math.max(Math.abs(x - tx), Math.abs(y - ty)) <= 1;
      const key = (x, y) => x + "," + y;
      const prev = new Map([[key(p.x, p.y), null]]);
      const q = [[p.x, p.y]];
      let end = null;
      while (q.length) {
        const [x, y] = q.shift();
        if (goal(x, y)) { end = [x, y]; break; }
        for (const [dir, [dx, dy]] of Object.entries(R.DIRS)) {
          const nx = x + dx, ny = y + dy;
          if (prev.has(key(nx, ny)) || !R.walkable(room, nx, ny, game.doorOpen, game.picked)) continue;
          prev.set(key(nx, ny), [x, y, dir]);
          q.push([nx, ny]);
        }
      }
      if (!end) throw new Error(`no path to ${tx},${ty}`);
      const dirs = [];
      for (let k = key(end[0], end[1]); prev.get(k); ) { const [x, y, d] = prev.get(k); dirs.unshift(d); k = key(x, y); }
      dirs.forEach((d) => g.input(sid, { t: "move", dir: d }));
    },
    inspect(sid, id) {
      const o = R.findObject(game.roomIdx, id);
      g.walkTo(sid, o.x, o.y);
      g.input(sid, { t: "inspect", id });
    },
    throughDoor(sid) {
      const [x, y] = R.doorTile(game.roomIdx);
      g.walkTo(sid, x, y, true);
    },
  };
  return g;
}

// ================================================================ rules
{
  check("three rooms, 15 x 11", R.ROOMS.length === 3 && R.ROOMS.every((r) => r.map.length === R.ROWS && r.map.every((row) => row.length === R.COLS)));
  check("15 minute clock", R.GAME_MS === 15 * 60 * 1000);
  check("points: challenge 30, clue 15, helping 10", R.POINTS.challenge === 30 && R.POINTS.clue === 15 && R.POINTS.helping === 10);
  check("six start tiles per room, all walkable and apart",
    R.ROOMS.every((r, i) => r.starts.length === R.MAX_PLAYERS &&
      new Set(r.starts.map((s) => s.join())).size === R.MAX_PLAYERS &&
      r.starts.every(([x, y]) => R.walkable(i, x, y, false, {}))));
  check("Pantry and Nook have a door, the Vault does not", R.doorTile(0) && R.doorTile(1) && !R.doorTile(2));
  check("every room challenge is defined", R.ROOMS.every((r, i) => r.challenges.every((c) => R.CHALLENGES[c] && R.CHALLENGES[c].room === i)));
  check("every object clue is defined", R.ROOMS.every((r) => r.objects.every((o) => !o.clue || R.CLUES[o.clue])));
  check("four map pieces in the Nook", R.ROOMS[1].objects.filter((o) => o.piece !== undefined).length === R.MAP_PIECES);
  check("four suspects", R.SUSPECTS.length === 4);

  // no answer, anywhere in the shared file
  const src = fs.readFileSync(path.join(__dirname, "../frontend/games/treehut-rules.js"), "utf8");
  check("no lock code in the shared rules", !/acorn\s*,\s*leaf\s*,\s*mushroom/i.test(src));
  check("no bookmark word in the shared rules", !/\bNEST\b/i.test(src));
  check("no thief or answers in the shared rules", !/\b(thief|answers?)\s*:/i.test(src));
}

// ================================================================ moving
{
  NOW = 2_000_000;
  const g = makeGame(["Ada", "Bo"]);
  const a = g.me("s1");
  check("players start on their tiles", a.x === 3 && a.y === 5 && g.me("s2").x === 4 && g.me("s2").y === 4);
  check("state goes out on start", g.events("treehut-state").length >= 1 && g.state().timeLeftMs === R.GAME_MS);

  g.input("s1", { t: "move", dir: "down" });
  check("one step moves one tile", a.x === 3 && a.y === 6 && g.state().players[0].y === 6);
  g.game.setInput("s1", { t: "move", dir: "down" });
  check("steps faster than a walk are ignored", a.y === 6);

  a.x = 1; a.y = 5;
  g.input("s1", { t: "move", dir: "left" });
  check("walls block", a.x === 1 && a.y === 5);
  a.x = 4; a.y = 1;
  g.input("s1", { t: "move", dir: "up" });
  check("a window blocks", a.x === 4 && a.y === 1);
  a.x = 2; a.y = 7;
  g.input("s1", { t: "move", dir: "down" });
  check("a solid barrel blocks", a.x === 2 && a.y === 7);
  a.x = 13; a.y = 5;
  g.input("s1", { t: "move", dir: "right" });
  check("a locked door blocks", a.x === 13 && g.game.roomIdx === 0);
  a.x = 5; a.y = 3;
  g.input("s1", { t: "move", dir: "up" });
  check("clue items on the floor can be stood on", a.x === 5 && a.y === 2);
  g.input("s1", { t: "move", dir: "nowhere" });
  g.input("s1", null);
  g.input("ghost", { t: "move", dir: "up" });
  check("bad moves are ignored", a.x === 5 && a.y === 2);
  g.game.stop();
}

// ================================================================ pantry
{
  NOW = 3_000_000;
  const g = makeGame(["Ada", "Bo", "Cy"]);

  // clues
  g.inspect("s2", "prints");
  check("a clue scores 15 for the finder", g.score("s2").clue === 15 && g.state().clues[0].id === "prints" && g.state().clues[0].by === "p2");
  g.inspect("s1", "prints");
  check("a clue scores only once", g.score("s1").clue === 0 && g.score("s2").clue === 15 && g.state().clues.length === 1);

  // inspecting from afar does nothing
  const a = g.me("s1");
  a.x = 10; a.y = 8;
  g.input("s1", { t: "inspect", id: "hair" });
  check("inspect needs you next to the object", g.state().clues.length === 1 && g.score("s1").clue === 0);
  g.input("s1", { t: "inspect", id: "desk" });
  check("objects in other rooms can't be inspected", g.state().clues.length === 1);

  // barrel rules are read for everyone
  g.inspect("s3", "b2");
  check("a read barrel rule is shared, with its reader", g.state().readRules[1] === "p3");
  g.inspect("s1", "b2");
  check("the first reader keeps it", g.state().readRules[1] === "p3");

  // wrong answers change nothing
  const snap = () => { const s = g.game.getState(); delete s.timeLeftMs; return JSON.stringify(s); };
  const before = snap();
  g.input("s1", { t: "answer", challenge: "barrels", value: ["leaf", "acorn", "mushroom"] });
  g.input("s1", { t: "answer", challenge: "jars", value: "9" });
  g.input("s1", { t: "answer", challenge: "book", value: "NEST" });
  check("wrong answers change nothing", snap() === before);
  check("a wrong answer is told only to who answered", g.events("treehut-wrong", "s1").length === 2 && g.events("treehut-wrong", "TEST").length === 0);
  check("an answer for another room does nothing", g.events("treehut-wrong").length === 2 && !g.game.solved.book);

  // hints: only after an ask, never your own
  g.input("s2", { t: "give-hint", challenge: "barrels" });
  check("an unasked hint scores nothing", g.score("s2").helping === 0 && !g.state().hints.barrels);
  g.input("s1", { t: "ask-hint", challenge: "barrels" });
  check("an ask shows for everyone", g.state().hintAsks.barrels === "p1");
  g.input("s1", { t: "give-hint", challenge: "barrels" });
  check("you can't answer your own ask", g.score("s1").helping === 0 && !g.state().hints.barrels);
  g.input("s2", { t: "give-hint", challenge: "barrels", text: "  acorn first,   mushroom last " });
  const h = g.state().hints.barrels;
  check("give-hint after an ask scores 10", g.score("s2").helping === 10 && h.by === "p2" && h.askedBy === "p1" && h.text === "acorn first, mushroom last");
  g.input("s3", { t: "give-hint", challenge: "barrels" });
  g.input("s1", { t: "ask-hint", challenge: "barrels" });
  g.input("s3", { t: "give-hint", challenge: "barrels" });
  check("one hint per challenge", g.score("s3").helping === 0 && g.score("s2").helping === 10);
  g.input("s2", { t: "ask-hint", challenge: "jars" });
  g.input("s3", { t: "give-hint", challenge: "jars" });
  check("an empty hint uses the suggested one", g.state().hints.jars.text === R.CHALLENGES.jars.hint && g.score("s3").helping === 10);

  // right answers
  g.input("s1", { t: "answer", challenge: "barrels", value: ["acorn", "leaf", "mushroom"] });
  check("a right answer scores 30 for the solver", g.score("s1").challenge === 30 && g.state().solved.barrels === "p1");
  check("the door stays shut after one of two", !g.state().doorOpen);
  g.input("s2", { t: "answer", challenge: "barrels", value: "acorn,leaf,mushroom" });
  check("a solved challenge can't be solved again", g.score("s2").challenge === 0);
  g.input("s3", { t: "answer", challenge: "jars", value: " 3 " });
  check("the second answer scores 30 and opens the door", g.score("s3").challenge === 30 && g.state().doorOpen);

  // the whole party walks through together
  g.throughDoor("s2");
  const st = g.state();
  check("stepping through the door takes everyone to the Nook", st.room === 1 && !st.doorOpen &&
    st.players.every((p, i) => p.x === R.ROOMS[1].starts[i][0] && p.y === R.ROOMS[1].starts[i][1]));

  // ============================================================== nook
  g.input("s1", { t: "rotate-piece", piece: 0 });
  check("an unfound piece can't be turned", g.state().mapTurns[0] === 90);
  g.inspect("s1", "mp1");
  g.inspect("s2", "mp2");
  g.inspect("s3", "mp3");
  check("map pieces score 15 each for the finder", g.score("s1").clue === 15 && g.score("s3").clue === 15 && g.score("s2").clue === 30);
  check("a picked piece leaves the floor", g.state().picked.mp1 === true && g.state().mapPieces[0] === "p1");
  g.inspect("s1", "mp1");
  check("a piece scores once", g.score("s1").clue === 15);
  g.input("s1", { t: "answer", challenge: "map" });
  check("the map can't be done with pieces missing", !g.game.solved.map);
  g.inspect("s1", "mp4");
  // start turns 90, 180, 0, 270
  g.input("s1", { t: "rotate-piece", piece: 0 });
  g.input("s1", { t: "rotate-piece", piece: 0 });
  g.input("s1", { t: "rotate-piece", piece: 0 });
  g.input("s2", { t: "rotate-piece", piece: 1 });
  check("turning shows for everyone", g.state().mapTurns[0] === 0 && g.state().mapTurns[1] === 270);
  g.input("s2", { t: "answer", challenge: "map" });
  check("a crooked map is a wrong answer", !g.game.solved.map && g.events("treehut-wrong", "s2").length === 1);
  g.input("s2", { t: "rotate-piece", piece: 1 });
  g.input("s3", { t: "rotate-piece", piece: 3 });
  const s3Before = g.total("s3");
  g.input("s3", { t: "answer", challenge: "map" });
  check("the map solves: 30 and the map clue for the solver", g.game.solved.map === "p3" && g.total("s3") === s3Before + 45 &&
    g.state().clues.some((c) => c.id === "map" && c.by === "p3"));
  g.input("s1", { t: "rotate-piece", piece: 0 });
  check("a solved map can't be turned", g.state().mapTurns[0] === 0);
  check("door still shut with the book unsolved", !g.state().doorOpen);
  g.inspect("s2", "bag");
  check("the bag gives no clue by itself", !g.state().clues.some((c) => c.id === "receipt"));
  g.input("s2", { t: "answer", challenge: "book", value: "nest" });
  check("the bookmark code solves: 30 and the receipt for the solver", g.game.solved.book === "p2" &&
    g.state().clues.some((c) => c.id === "receipt" && c.by === "p2") && g.state().doorOpen);
  g.throughDoor("s1");
  check("into the Vault", g.state().room === 2);

  // ============================================================== vault
  g.inspect("s1", "feather");
  g.inspect("s3", "slip");
  check("vault clues score", g.state().clues.some((c) => c.id === "feather" && c.by === "p1") && g.state().clues.some((c) => c.id === "alibi" && c.by === "p3"));
  g.input("s1", { t: "rule-out", suspect: "magpie" });
  check("rule-out shows who", g.state().ruledOut.magpie === "p1");
  g.input("s2", { t: "rule-out", suspect: "magpie" });
  check("rule-out toggles back", !g.state().ruledOut.magpie);
  g.input("s1", { t: "rule-out", suspect: "nobody" });
  g.input("s1", { t: "vote", suspect: "nobody" });
  check("unknown suspects are ignored", Object.keys(g.state().ruledOut).length === 0 && Object.keys(g.state().votes).length === 0);
  g.game.stop();
}

// ================================================================ votes
function vaultGame(names) {
  const g = makeGame(names);
  g.game.roomIdx = 2;
  g.game.placeParty();
  return g;
}
{
  NOW = 4_000_000;
  const g = makeGame(["Ada", "Bo"]);
  g.input("s1", { t: "vote", suspect: "fox" });
  check("no voting before the Vault", Object.keys(g.state().votes).length === 0);
  g.game.stop();
}
{
  NOW = 5_000_000;
  const g = vaultGame(["Ada", "Bo", "Cy", "Di", "Ed"]);
  g.input("s1", { t: "vote", suspect: "fox" });
  g.input("s2", { t: "vote", suspect: "owl" });
  g.input("s3", { t: "vote", suspect: "fox" });
  g.input("s4", { t: "vote", suspect: "badger" });
  check("2 of 5 is not a majority", !g.game.over && g.state().votes.p1 === "fox");
  g.input("s2", { t: "vote", suspect: "badger" });
  check("votes can change", g.state().votes.p2 === "badger" && !g.game.over);
  g.input("s5", { t: "vote", suspect: "fox" });
  const over = g.events("treehut-over");
  check("3 of 5 for the fox ends as solved", over.length === 1 && over[0].data.outcome === "solved" && over[0].data.accused === "fox");
  check("fox voters score helping", ["s1", "s3", "s5"].every((s) => g.score(s).helping === 10) && ["s2", "s4"].every((s) => g.score(s).helping === 0));
  const rows = over[0].data.players;
  check("the end table has every player's breakdown", rows.length === 5 && rows.every((r) => r.total === r.challenge + r.clue + r.helping && Array.isArray(r.notes)));
  g.input("s2", { t: "vote", suspect: "fox" });
  g.input("s2", { t: "chat", text: "hi" });
  check("input after the end is ignored", g.state().votes.p2 === "badger" && g.events("treehut-chat").length === 0);
  check("onEnd waits for the end screen", g.ended === null);
  NOW += R.END_SCREEN_MS;
  g.tick();
  check("onEnd after the end screen, with every player", g.ended && g.ended.length === 5 &&
    g.ended.every((e) => typeof e.name === "string" && typeof e.score === "number") &&
    g.ended.find((e) => e.name === "Ada").score === 10);
}
{
  NOW = 6_000_000;
  const g = vaultGame(["Ada", "Bo", "Cy", "Di", "Ed"]);
  g.input("s1", { t: "vote", suspect: "owl" });
  g.input("s2", { t: "vote", suspect: "owl" });
  g.input("s3", { t: "vote", suspect: "fox" });
  g.input("s4", { t: "vote", suspect: "owl" });
  const over = g.events("treehut-over");
  check("a wrong majority ends as wrong", over.length === 1 && over[0].data.outcome === "wrong" && over[0].data.accused === "owl");
  check("no helping for a wrong case", [1, 2, 3, 4, 5].every((i) => g.score("s" + i).helping === 0));
  g.game.stop();
}
{
  NOW = 7_000_000;
  const g = vaultGame(["Ada", "Bo", "Cy", "Di"]);
  g.input("s1", { t: "vote", suspect: "fox" });
  g.input("s2", { t: "vote", suspect: "fox" });
  check("2 of 4 is not a majority", !g.game.over);
  g.room.players.splice(3, 1);           // Di leaves
  g.input("s3", { t: "vote", suspect: "owl" });
  check("a majority counts the players still here", g.game.over && g.game.over.outcome === "solved");
  g.game.stop();
}

// ================================================================ clock
{
  NOW = 8_000_000;
  const g = makeGame(["Ada", "Bo", "Cy"]);
  g.inspect("s2", "prints");
  NOW = 8_000_000 + 60_000;
  g.tick();
  check("the clock counts down", g.state().timeLeftMs === R.GAME_MS - 60_000);
  NOW = 8_000_000 + R.GAME_MS;
  g.tick();
  const over = g.events("treehut-over");
  check("the clock running out ends the case", over.length === 1 && over[0].data.outcome === "timeout" && over[0].data.accused === null);
  check("time's up table has every player", over[0].data.players.length === 3);
  NOW += R.END_SCREEN_MS;
  g.tick();
  check("the clock ending calls onEnd with every player", g.ended && g.ended.map((e) => e.name).sort().join() === "Ada,Bo,Cy" &&
    g.ended[0].name === "Bo" && g.ended[0].score === 15);
  check("the game stops after onEnd", g.game.stopped);
}

// ================================================================ reconnect, chat
{
  NOW = 9_000_000;
  const g = makeGame(["Ada", "Bo"]);
  g.game.updatePlayerId("s2", "s2b");
  g.room.players[1].id = "s2b";
  g.input("s2b", { t: "move", dir: "down" });
  check("a reconnect keeps the player", g.me("s2b").uid === "p2" && g.me("s2b").y === 5 && !g.me("s2"));
  g.input("s1", { t: "chat", text: "  look   under the bed " + "x".repeat(300) });
  const c = g.events("treehut-chat")[0];
  check("chat goes to the room, trimmed", c && c.to === "TEST" && c.data.uid === "p1" && c.data.text.startsWith("look under the bed") && c.data.text.length === R.MAX_CHAT);
  g.input("s1", { t: "chat", text: "   " });
  check("empty chat is dropped", g.events("treehut-chat").length === 1);
  g.game.stop();
}

// ================================================================ nothing leaks
{
  NOW = 10_000_000;
  const g = makeGame(["Ada", "Bo", "Cy"]);
  // play a whole case and collect every message sent
  g.inspect("s1", "b1"); g.inspect("s1", "b2"); g.inspect("s1", "b3");
  g.input("s1", { t: "answer", challenge: "barrels", value: ["acorn", "leaf", "mushroom"] });
  g.input("s2", { t: "answer", challenge: "jars", value: "3" });
  g.throughDoor("s1");
  ["mp1", "mp2", "mp3", "mp4"].forEach((id) => g.inspect("s1", id));
  [0, 0, 0, 1, 1, 3].forEach((piece) => g.input("s1", { t: "rotate-piece", piece }));
  g.input("s1", { t: "answer", challenge: "map" });
  g.input("s3", { t: "answer", challenge: "book", value: "NEST" });
  g.throughDoor("s1");
  const duringPlay = JSON.stringify(g.log);
  check("a whole case reaches the Vault", g.game.roomIdx === 2 && Object.keys(g.game.solved).length === 4);
  check("no answer is sent while playing", !/acorn,leaf,mushroom|NEST|"thief"/.test(duringPlay) && !/answer/i.test(duringPlay));
  ["s1", "s2"].forEach((s) => g.input(s, { t: "vote", suspect: "fox" }));
  check("and the fox ends it", g.game.over && g.game.over.outcome === "solved");
  g.game.stop();
}

// ================================================================ briefing
{
  NOW = 11_000_000;
  const g = makeGame(["Ada", "Bo", "Cy"], { briefing: true });
  check("the briefing starts with nobody in", g.state().players.every((p) => !p.entered) && g.state().briefingLeftMs === 60_000);
  NOW += 30_000;
  g.tick();
  check("the clock waits at 15:00 while the party reads", g.state().timeLeftMs === R.GAME_MS && g.state().briefingLeftMs === 30_000);
  g.game.setInput("s1", { t: "enter" });
  g.game.setInput("s1", { t: "enter" });
  g.game.setInput("s2", { t: "enter" });
  check("players who entered show as entered", g.state().players.filter((p) => p.entered).map((p) => p.name).join() === "Ada,Bo");
  NOW += 10_000;
  g.tick();
  check("the clock still waits for the last reader", g.state().timeLeftMs === R.GAME_MS);
  g.input("s1", { t: "move", dir: "down" });
  check("players who entered can already walk", g.me("s1").y === 6);
  g.game.setInput("s3", { t: "enter" });
  check("the clock starts when everyone has entered", g.state().briefingLeftMs === 0 && g.game.endsAt === NOW + R.GAME_MS);
  NOW += 5_000;
  g.tick();
  check("and then counts down", g.state().timeLeftMs === R.GAME_MS - 5_000);
  g.game.stop();
}
{
  NOW = 12_000_000;
  const g = makeGame(["Ada", "Bo"], { briefing: true });
  g.game.setInput("s1", { t: "enter" });
  NOW += 59_000;
  g.tick();
  check("before 60 seconds the clock waits", g.state().timeLeftMs === R.GAME_MS);
  NOW += 1_000;
  g.tick();
  check("after 60 seconds the clock starts anyway", g.game.endsAt === NOW + R.GAME_MS && g.state().briefingLeftMs === 0);
  check("the slow reader is still not entered", g.state().players.find((p) => p.name === "Bo").entered === false);
  NOW += 1_000;
  g.tick();
  check("the clock runs while they finish reading", g.state().timeLeftMs === R.GAME_MS - 1_000);
  g.game.setInput("s2", { t: "enter" });
  check("entering late does not move the clock", g.game.endsAt === NOW - 1_000 + R.GAME_MS && g.state().players.every((p) => p.entered));
  g.game.stop();
}
{
  NOW = 13_000_000;
  const g = makeGame(["Ada", "Bo"], { briefing: true });
  g.game.setInput("s1", { t: "enter" });
  g.room.players = g.room.players.filter((p) => p.id !== "s2");   // Bo leaves while reading
  g.tick();
  check("a player who left is not waited for", g.state().briefingLeftMs === 0 && g.game.endsAt === NOW + R.GAME_MS);
  g.game.stop();
}

Date.now = realNow;
if (failures.length) {
  for (const f of failures) console.log("  x " + f);
  console.log(`FAIL  ${failures.length} of ${passed + failures.length} Treehut checks failed`);
  process.exit(1);
}
console.log(`PASS  all ${passed} Treehut checks passed`);
