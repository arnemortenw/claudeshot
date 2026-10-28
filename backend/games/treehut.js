// Drey's Treehut - the case referee. One truth the whole party shares: where
// everyone stands, which room they are in, what is solved and by whom, the
// clues and who found them, hints, votes, the clock and each player's score.
//
// The answers live only in this file and never go out to a client. The rooms,
// clues and points are shared with the client in frontend/games/treehut-rules.js.
//
// Inputs arrive on "treehut-input" as { t, ... }:
//   move { dir }               one tile step: up, down, left, right
//   inspect { id }             an object you stand next to
//   answer { challenge, value } barrels (3 symbols), jars (a number), book (a word), map (no value)
//   rotate-piece { piece }     turn a found map piece 90 degrees
//   ask-hint { challenge }     ask the party for a hint
//   give-hint { challenge, text } answer someone's ask (text is optional)
//   rule-out { suspect }       toggle a suspect ruled out on the case board
//   vote { suspect }           vote for the thief, in the Vault
//   chat { text }
//   enter                      done reading the briefing (Enter the treehut or Skip)
// Out: "treehut-state" to the room, "treehut-chat", "treehut-wrong" to the one
// who answered wrong, and "treehut-over" when the case ends.

const R = require("../../frontend/games/treehut-rules.js");

const TICK_MS = 1000;
const BRIEFING_MS = 60_000;   // the clock starts when everyone has entered, or after this

// Never sent to clients.
const ANSWERS = {
  barrels: "acorn,leaf,mushroom",
  jars: "3",
  book: "NEST",
};
const MAP_START_TURNS = [90, 180, 0, 270];   // solved when every piece is back at 0
const THIEF = "fox";

function cleanText(v) {
  if (typeof v !== "string") return "";
  return v.replace(/\s+/g, " ").trim().slice(0, R.MAX_CHAT);
}

// The end screen's one-line title: what a player helped with most.
function titleFor(row) {
  if (row.total === 0) return "Moral support";
  const best = [["challenge", "Puzzle cracker"], ["clue", "Sharp nose"], ["helping", "Team glue"]]
    .reduce((a, b) => (row[b[0]] > row[a[0]] ? b : a));
  return best[1];
}

class TreehutGame {
  constructor(room, io, onEnd) {
    this.room = room;
    this.io = io;
    this.onEnd = onEnd;
    this.timer = null;
    this.stopped = false;

    this.players = new Map();          // socket id -> player
    room.players.slice(0, R.MAX_PLAYERS).forEach((p, i) => {
      this.players.set(p.id, {
        uid: "p" + (i + 1),
        id: p.id,
        name: p.name,
        color: R.PLAYER_COLORS[i % R.PLAYER_COLORS.length],
        slot: i,
        entered: false,
        x: 0, y: 0,
        lastMoveAt: 0,
        score: { challenge: 0, clue: 0, helping: 0 },
        notes: [],
      });
    });

    this.roomIdx = 0;
    this.doorOpen = false;
    this.solved = {};        // challenge -> uid
    this.clues = [];         // { id, by }
    this.readRules = {};     // barrel rule index -> uid
    this.mapPieces = {};     // piece index -> uid
    this.mapTurns = MAP_START_TURNS.slice();
    this.picked = {};        // object id -> true, map pieces lifted off the floor
    this.hintAsks = {};      // challenge -> uid who asked
    this.hints = {};         // challenge -> { by, askedBy, text }
    this.ruledOut = {};      // suspect -> uid
    this.votes = {};         // uid -> suspect

    this.startedAt = null;
    this.briefingUntil = null;     // while set, the party is reading the briefing and the clock waits
    this.endsAt = null;
    this.over = null;
    this.overAt = null;

    this.placeParty();
  }

  start() {
    this.briefingUntil = Date.now() + BRIEFING_MS;
    this.broadcast();
    this.timer = setInterval(() => this.tick(), TICK_MS);
  }

  stop() {
    this.stopped = true;
    clearInterval(this.timer);
    this.timer = null;
  }

  updatePlayerId(oldId, newId) {
    const p = this.players.get(oldId);
    if (!p) return;
    this.players.delete(oldId);
    p.id = newId;
    this.players.set(newId, p);
    this.broadcast();
    if (this.over) this.io.to(newId).emit("treehut-over", { ...this.over, endsIn: Math.max(0, this.overAt + R.END_SCREEN_MS - Date.now()) });
  }

  tick() {
    if (this.stopped) return;
    const now = Date.now();
    if (this.over) {
      if (now >= this.overAt + R.END_SCREEN_MS) {
        this.stop();
        this.onEnd(this.over.players.map((p) => ({ name: p.name, score: p.total })));
      }
      return;
    }
    if (this.briefingUntil) {
      if (now >= this.briefingUntil || this.everyoneEntered()) this.startClock();
      else this.broadcast();
      return;
    }
    if (now >= this.endsAt) return this.end("timeout");
    this.broadcast();
  }

  everyoneEntered() {
    const here = [...this.players.values()].filter((p) => this.present(p));
    return here.length > 0 && here.every((p) => p.entered);
  }

  startClock() {
    this.briefingUntil = null;
    this.startedAt = Date.now();
    this.endsAt = this.startedAt + R.GAME_MS;
    this.broadcast();
  }

  enter(p) {
    if (p.entered) return;
    p.entered = true;
    if (this.briefingUntil && this.everyoneEntered()) this.startClock();
    else this.broadcast();
  }

  // ---------------------------------------------------------------- input
  setInput(socketId, data) {
    if (this.stopped || this.over || !data || typeof data !== "object") return;
    const p = this.players.get(socketId);
    if (!p) return;
    switch (data.t) {
      case "move": return this.move(p, data.dir);
      case "inspect": return this.inspect(p, data.id);
      case "answer": return this.answer(p, data.challenge, data.value);
      case "rotate-piece": return this.rotatePiece(p, data.piece);
      case "ask-hint": return this.askHint(p, data.challenge);
      case "give-hint": return this.giveHint(p, data.challenge, data.text);
      case "rule-out": return this.ruleOut(p, data.suspect);
      case "vote": return this.vote(p, data.suspect);
      case "chat": return this.chat(p, data.text);
      case "enter": return this.enter(p);
    }
  }

  move(p, dir) {
    const d = R.DIRS[dir];
    if (!d) return;
    const now = Date.now();
    if (now - p.lastMoveAt < R.MOVE_MS) return;
    const nx = p.x + d[0], ny = p.y + d[1];
    if (!R.walkable(this.roomIdx, nx, ny, this.doorOpen, this.picked)) return;
    p.lastMoveAt = now;
    if (R.tileAt(this.roomIdx, nx, ny) === "D") return this.nextRoom();
    p.x = nx; p.y = ny;
    this.broadcast();
  }

  inspect(p, id) {
    const o = typeof id === "string" && R.findObject(this.roomIdx, id);
    if (!o || o.floor || this.picked[o.id] || !R.near(p.x, p.y, o)) return;
    let changed = false;
    if (o.piece !== undefined) {
      this.picked[o.id] = true;
      this.mapPieces[o.piece] = p.uid;
      this.addScore(p, "clue", "Found a map piece");
      changed = true;
    } else if (o.clue) {
      changed = this.gainClue(o.clue, p);
    } else if (o.rule !== undefined && this.readRules[o.rule] === undefined) {
      this.readRules[o.rule] = p.uid;
      changed = true;
    }
    if (changed) this.broadcast();
  }

  answer(p, cid, value) {
    const c = R.CHALLENGES[cid];
    if (!c || cid === "accuse" || c.room !== this.roomIdx || this.solved[cid]) return;
    if (this.isRight(cid, value)) {
      this.solve(cid, p);
      this.broadcast();
    } else {
      this.io.to(p.id).emit("treehut-wrong", { challenge: cid });
    }
  }

  isRight(cid, value) {
    if (cid === "barrels") {
      const v = Array.isArray(value) ? value.join(",") : value;
      return typeof v === "string" && v.replace(/\s+/g, "").toLowerCase() === ANSWERS.barrels;
    }
    if (cid === "jars") return (typeof value === "string" || typeof value === "number") && String(value).trim() === ANSWERS.jars;
    if (cid === "book") return typeof value === "string" && value.trim().toUpperCase() === ANSWERS.book;
    if (cid === "map") {
      return Object.keys(this.mapPieces).length === R.MAP_PIECES && this.mapTurns.every((t) => t % 360 === 0);
    }
    return false;
  }

  rotatePiece(p, piece) {
    if (this.roomIdx !== R.CHALLENGES.map.room || this.solved.map) return;
    if (!Number.isInteger(piece) || this.mapPieces[piece] === undefined) return;
    this.mapTurns[piece] = (this.mapTurns[piece] + 90) % 360;
    this.broadcast();
  }

  askHint(p, cid) {
    const c = R.CHALLENGES[cid];
    if (!c || c.room !== this.roomIdx || this.solved[cid] || this.hints[cid] || this.hintAsks[cid]) return;
    this.hintAsks[cid] = p.uid;
    this.broadcast();
  }

  // Only an asked-for hint counts, from someone other than the asker, once per challenge.
  giveHint(p, cid, text) {
    const c = R.CHALLENGES[cid];
    if (!c || c.room !== this.roomIdx || this.solved[cid] || this.hints[cid]) return;
    const askedBy = this.hintAsks[cid];
    if (!askedBy || askedBy === p.uid) return;
    this.hints[cid] = { by: p.uid, askedBy, text: cleanText(text) || c.hint };
    delete this.hintAsks[cid];
    this.addScore(p, "helping", `Gave a hint on "${c.name}"`);
    this.broadcast();
  }

  ruleOut(p, sid) {
    if (!R.SUSPECTS.some((s) => s.id === sid)) return;
    if (this.ruledOut[sid]) delete this.ruledOut[sid];
    else this.ruledOut[sid] = p.uid;
    this.broadcast();
  }

  vote(p, sid) {
    if (this.roomIdx !== R.CHALLENGES.accuse.room) return;
    if (!R.SUSPECTS.some((s) => s.id === sid)) return;
    this.votes[p.uid] = sid;
    this.broadcast();
    this.maybeDecide(p);
  }

  chat(p, text) {
    const t = cleanText(text);
    if (!t) return;
    this.io.to(this.room.code).emit("treehut-chat", { uid: p.uid, name: p.name, text: t });
  }

  // ---------------------------------------------------------------- the case
  addScore(p, kind, note) {
    p.score[kind] += R.POINTS[kind];
    p.notes.push({ kind, points: R.POINTS[kind], text: note });
  }

  gainClue(id, p) {
    if (this.clues.some((c) => c.id === id)) return false;
    this.clues.push({ id, by: p.uid });
    this.addScore(p, "clue", `Found "${R.CLUES[id].name}"`);
    return true;
  }

  solve(cid, p) {
    this.solved[cid] = p.uid;
    delete this.hintAsks[cid];
    this.addScore(p, "challenge", `Solved "${R.CHALLENGES[cid].name}"`);
    for (const [id, clue] of Object.entries(R.CLUES)) if (clue.from === cid) this.gainClue(id, p);
    const here = R.ROOMS[this.roomIdx];
    if (R.doorTile(this.roomIdx) && here.challenges.every((c) => this.solved[c])) this.doorOpen = true;
  }

  // Whoever steps through the open door takes the whole party along.
  nextRoom() {
    this.roomIdx++;
    this.doorOpen = false;
    this.hintAsks = {};
    this.placeParty();
    this.broadcast();
  }

  placeParty() {
    const starts = R.ROOMS[this.roomIdx].starts;
    for (const p of this.players.values()) {
      [p.x, p.y] = starts[p.slot % starts.length];
    }
  }

  present(p) {
    return this.room.players.some((rp) => rp.id === p.id);
  }

  // Most of the players still in the room naming one suspect ends the case.
  maybeDecide(decider) {
    const voters = [...this.players.values()].filter((p) => this.present(p));
    const counts = {};
    for (const p of voters) {
      const v = this.votes[p.uid];
      if (v) counts[v] = (counts[v] || 0) + 1;
    }
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    if (!top || top[1] <= voters.length / 2) return;
    const [named] = top;
    if (named === THIEF) {
      this.solved.accuse = decider.uid;
      for (const p of this.players.values()) {
        if (this.votes[p.uid] === THIEF) this.addScore(p, "helping", "Voted for the right thief");
      }
      this.end("solved", named);
    } else {
      this.end("wrong", named);
    }
  }

  end(outcome, accused) {
    if (this.over) return;
    const now = Date.now();
    const players = [...this.players.values()]
      .map((p) => ({
        uid: p.uid,
        name: p.name,
        color: p.color,
        challenge: p.score.challenge,
        clue: p.score.clue,
        helping: p.score.helping,
        total: p.score.challenge + p.score.clue + p.score.helping,
        notes: p.notes.slice(),
      }))
      .map((row) => ({ ...row, title: titleFor(row) }))
      .sort((a, b) => b.total - a.total);
    this.over = {
      outcome,                                  // solved | wrong | timeout
      accused: accused || null,
      thief: THIEF,
      elapsedMs: this.startedAt ? Math.min(R.GAME_MS, now - this.startedAt) : 0,
      solvedCount: Object.keys(this.solved).length,
      challengeCount: Object.keys(R.CHALLENGES).length,
      players,
      endsIn: R.END_SCREEN_MS,
    };
    this.overAt = now;
    this.broadcast();
    this.io.to(this.room.code).emit("treehut-over", this.over);
  }

  // ---------------------------------------------------------------- out
  getState() {
    const now = Date.now();
    return {
      room: this.roomIdx,
      doorOpen: this.doorOpen,
      timeLeftMs: !this.endsAt ? R.GAME_MS : this.over ? Math.max(0, this.endsAt - this.overAt) : Math.max(0, this.endsAt - now),
      briefingLeftMs: this.briefingUntil ? Math.max(0, this.briefingUntil - now) : 0,
      players: [...this.players.values()].map((p) => ({
        uid: p.uid,
        id: p.id,
        name: p.name,
        color: p.color,
        x: p.x,
        y: p.y,
        here: this.present(p),
        entered: p.entered,
        score: { ...p.score, total: p.score.challenge + p.score.clue + p.score.helping },
      })),
      solved: { ...this.solved },
      clues: this.clues.map((c) => ({ ...c })),
      readRules: { ...this.readRules },
      mapPieces: { ...this.mapPieces },
      mapTurns: this.mapTurns.slice(),
      picked: { ...this.picked },
      hintAsks: { ...this.hintAsks },
      hints: JSON.parse(JSON.stringify(this.hints)),
      ruledOut: { ...this.ruledOut },
      votes: { ...this.votes },
      over: this.over ? this.over.outcome : null,
    };
  }

  broadcast() {
    this.io.to(this.room.code).emit("treehut-state", this.getState());
  }
}

module.exports = TreehutGame;
