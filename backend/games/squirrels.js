// Rabid Squirrels - the match referee. The server runs the whole match: the
// terrain and its craters, every squirrel's physics, the shot, damage, wind,
// whose turn it is and who wins. Clients only draw what it sends and send the
// active player's keys and aim.
//
// Ported from design v8 (prototypes/rabid-squirrel-worms-style-game/index.html
// on damian/rabid-squirrel-worms-style-game). Physics runs at 60 frames a
// second, like the prototype, so its numbers carry over unchanged.
//
// Inputs arrive on "squirrels-input" as { t, ... }:
//   hello                 the client is loaded; it gets "squirrels-init" back
//   move { dir }          -1, 0 or 1: the arrow keys held down
//   jump                  Space
//   aim { ang, pow }      the slingshot drag while it is held, so others see it
//   fire { ang, pow }     let go: fires the Acorn Bazooka
//   end                   End turn (the button or Enter)
// Only the player whose turn it is can move, aim, fire or end the turn.
// Out: "squirrels-init" to one client, "squirrels-state" to the room 30 times
// a second, and "squirrels-over" with the ranking when the match ends.

const R = require("../../frontend/games/squirrels-rules.js");

const STEP_MS = 1000 / R.FPS;
const SEND_EVERY = 2;                    // frames per state broadcast (30 a second)
const LOAD_FRAMES = 10 * R.FPS;          // wait this long at most for every laptop to load
const BANNER_FRAMES = 80;                // "Kari's turn" before the clock starts
const ROUND_FRAMES = 84;                 // "Round 2" between rounds
const SETTLE_FRAMES = 55;                // everything still this long ends the turn
const SETTLE_MAX = 10 * R.FPS;           // ... or this long after the shot, whatever happens
const FLIGHT_MAX = 15 * R.FPS;           // a shot that never lands is dropped
const OVER_FRAMES = 5 * R.FPS;           // the winner banner before the results screen
const POINTS = [10, 6, 5, 4, 3, 2];

const pick = (a, rnd) => a[Math.floor(rnd() * a.length)];
const LINES = {
  turn: ["is foaming at the mouth", "smells fear", "is twitching violently", "wants violence", "is extremely calm (lie)", "has not blinked in days"],
  hit: ["MY TAIL!", "Rabies!", "SKREEE!", "Worth it.", "Ow, my nuts", "Again!"],
  self: ["Oops.", "Meant that.", "Friendly fire!"],
  death: ["I regret nothing!", "Tell my acorns I loved them…", "Hide the nuts…", "SQUEEEEE—"],
  drown: ["glub glub", "Can't… swim…", "Squirrels float, right?"],
  timeout: ["got distracted by a nut.", "forgot what a bazooka is.", "is busy foaming."],
};

const r1 = (v) => Math.round(v * 10) / 10;

class SquirrelsGame {
  // opts (for tests): { seed, rnd, log }
  constructor(room, io, onEnd, opts = {}) {
    this.room = room;
    this.io = io;
    this.onEnd = onEnd;
    this.seed = opts.seed != null ? opts.seed : (Math.random() * 0xffffffff) >>> 0;
    this.rnd = opts.rnd || R.mulberry(this.seed ^ 0x5eed);
    this.log = opts.log || ((line) => console.log(line));
    this.timer = null;
    this.ended = false;
    this.finished = false;
    this.events = [];

    const s = parseInt(room.settings && room.settings.squirrels, 10);
    this.perPlayer = s === 3 ? 3 : 2;
    this.map = "oak";

    this.players = room.players.slice(0, R.MAX_PLAYERS).map((p, i) => ({
      slot: i, uid: "p" + (i + 1), id: p.id, name: p.name,
      color: R.PLAYER_COLORS[i], next: 0, outAt: null, dealt: 0, ready: false,
    }));

    this.mask = R.makeTerrain(this.map);
    this.craters = [];
    this.squirrels = R.spawns(this.mask, this.players.length, this.perPlayer, this.seed)
      .sort((a, b) => a.player - b.player || a.index - b.index)
      .map((sp, i) => ({
        i, p: sp.player, n: sp.index, name: R.SQUIRREL_NAMES[sp.player][sp.index],
        x: sp.x, y: sp.y, vx: 0, vy: 0, hp: 100, dead: false, drowned: false,
        ground: true, jumping: false, face: sp.x < R.W / 2 ? 1 : -1, dealt: 0,
      }));

    this.frame = 0;
    this.phase = "loading";
    this.phaseT = 0;
    this.settleT = 0;
    this.cur = -1;           // the slot whose turn it is
    this.active = null;      // the squirrel that moves this turn
    this.round = 1;
    this.played = new Set();
    this.turnNo = 0;
    this.wind = 0;
    this.timeLeft = 0;       // frames
    this.steps = R.MAX_STEPS;
    this.dir = 0;
    this.aim = null;
    this.shot = null;
    this.outOfSteps = false;
    this.winner = null;
  }

  // ---------------------------------------------------------------- lifecycle
  start() {
    this.log(`[squirrels] match start ${JSON.stringify({
      room: this.room.code, date: new Date().toISOString(),
      players: this.players.map((p) => p.name), squirrels: this.perPlayer, map: this.map,
    })}`);
    let last = Date.now(), acc = 0, n = 0;
    this.timer = setInterval(() => {
      const now = Date.now();
      acc = Math.min(acc + now - last, STEP_MS * 6);
      last = now;
      while (acc >= STEP_MS) {
        this.step();
        acc -= STEP_MS;
        if (++n % SEND_EVERY === 0) this.broadcast();
      }
    }, STEP_MS);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    if (!this.ended) {
      this.ended = true;
      this.logEnd("match abandoned", null);
    }
  }

  updatePlayerId(oldId, newId) {
    for (const p of this.players) if (p.id === oldId) p.id = newId;
  }

  logEnd(what, winner) {
    this.log(`[squirrels] ${what} ${JSON.stringify({
      room: this.room.code, date: new Date().toISOString(),
      players: this.players.map((p) => p.name), winner: winner ? winner.name : null, rounds: this.round,
    })}`);
  }

  present(p) {
    return this.room.players.some((q) => q.id === p.id);
  }

  // ---------------------------------------------------------------- input
  setInput(socketId, data) {
    if (!data || typeof data !== "object") return;
    const p = this.players.find((q) => q.id === socketId);
    if (!p) return;
    if (data.t === "hello") {
      p.ready = true;
      this.io.to(socketId).emit("squirrels-init", this.snapshot(true));
      return;
    }
    if (p.slot !== this.cur || this.phase !== "aim" || !this.active || this.active.dead) return;
    const s = this.active;
    if (data.t === "move") {
      const d = Number(data.dir);
      this.dir = d > 0 ? 1 : d < 0 ? -1 : 0;
    } else if (data.t === "jump") {
      this.jump(s);
    } else if (data.t === "aim") {
      const a = this.readAim(data);
      this.aim = a;
      if (a) s.face = Math.cos(a.ang) >= 0 ? 1 : -1;
    } else if (data.t === "fire") {
      const a = this.readAim(data);
      if (a && a.pow * R.POWER_DRAG >= R.MIN_DRAG) this.fire(a.ang, a.pow);
    } else if (data.t === "end") {
      this.endTurn("Turn skipped");
    }
  }

  readAim(data) {
    const ang = Number(data.ang), pow = Number(data.pow);
    if (!Number.isFinite(ang) || !Number.isFinite(pow)) return null;
    return { ang, pow: Math.max(0, Math.min(1, pow)) };
  }

  // ---------------------------------------------------------------- turns
  playerAlive(slot) {
    return this.squirrels.some((s) => s.p === slot && !s.dead);
  }

  alivePlayers() {
    return this.players.filter((p) => this.playerAlive(p.slot));
  }

  // The next player after `from` with a squirrel left. Players who have left
  // the room are skipped while someone still here can play.
  nextPlayer(from) {
    const n = this.players.length;
    const anyHere = this.players.some((p) => this.playerAlive(p.slot) && this.present(p));
    for (let k = 1; k <= n; k++) {
      const t = (((from + k) % n) + n) % n;
      if (!this.playerAlive(t)) continue;
      if (anyHere && !this.present(this.players[t])) continue;
      return t;
    }
    return -1;
  }

  setPhase(ph) {
    this.phase = ph;
    this.phaseT = 0;
    this.settleT = 0;
  }

  beginTurn(t) {
    const p = this.players[t];
    this.cur = t;
    this.played.add(t);
    const mine = this.squirrels.filter((s) => s.p === t);
    for (let k = 0; k < mine.length; k++) {
      const idx = (p.next + k) % mine.length;
      if (!mine[idx].dead) {
        this.active = mine[idx];
        p.next = (idx + 1) % mine.length;
        break;
      }
    }
    this.wind = Math.round((this.rnd() * 2 - 1) * 10) / 10;
    this.timeLeft = R.TURN_SECONDS * R.FPS;
    this.steps = R.MAX_STEPS;
    this.dir = 0;
    this.aim = null;
    this.outOfSteps = false;
    this.turnNo++;
    this.setPhase("banner");
    const inRound = this.alivePlayers().length;
    this.emitEvent({ k: "banner", big: `${p.name}'s turn`, color: p.color, ms: 1500,
      sub: `Round ${this.round} · turn ${this.played.size} of ${inRound} · ${this.active.name} ${pick(LINES.turn, this.rnd)}` });
  }

  // After a turn: the win check, then the next player, with a round banner
  // when everyone still in has had their turn.
  finishTurn() {
    const alive = this.alivePlayers();
    if (alive.length <= 1) return this.endMatch(alive[0] || null);
    const nt = this.nextPlayer(this.cur);
    if (nt <= this.cur) {
      this.round++;
      this.played.clear();
      this.setPhase("round");
      this.emitEvent({ k: "banner", big: `Round ${this.round}`, sub: "Everyone gets one turn", color: "#f7c948", ms: 1400 });
      return;
    }
    this.beginTurn(nt);
  }

  endTurn(msg) {
    if (this.phase !== "aim") return;
    const s = this.active;
    if (msg && s && !s.dead) this.pop(s.x, s.y - 92, msg, this.players[s.p].color, 14);
    this.dir = 0;
    this.aim = null;
    this.setPhase("settle");
  }

  endMatch(winner) {
    this.setPhase("over");
    this.winner = winner;
    this.ended = true;
    this.dir = 0;
    this.aim = null;
    this.logEnd("match end", winner);
    if (winner) this.emitEvent({ k: "banner", big: `${winner.name} wins!`, sub: "Last squirrels standing", color: winner.color, ms: 99999 });
    else this.emitEvent({ k: "banner", big: "Nobody wins", sub: "The nuts win.", color: "#f0f0f0", ms: 99999 });
    this.results = this.rank();
    this.io.to(this.room.code).emit("squirrels-over", { winner: winner ? winner.name : null, rows: this.results });
  }

  // The winner first, then everyone else by how long they lasted, then by
  // damage dealt.
  rank() {
    const order = this.players.slice().sort((a, b) => {
      if (a === this.winner) return -1;
      if (b === this.winner) return 1;
      const ao = a.outAt == null ? Infinity : a.outAt, bo = b.outAt == null ? Infinity : b.outAt;
      return bo - ao || b.dealt - a.dealt;
    });
    return order.map((p, i) => {
      const left = this.squirrels.filter((s) => s.p === p.slot && !s.dead);
      return {
        name: p.name, color: p.color, place: i + 1, winner: p === this.winner,
        left: left.map((s) => ({ name: s.name, hp: Math.round(s.hp) })),
        dealt: Math.round(p.dealt), points: POINTS[i] || 0,
      };
    });
  }

  finish() {
    if (this.finished) return;
    this.finished = true;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.onEnd(this.results.map((r) => ({ name: r.name, score: r.points })));
  }

  // ---------------------------------------------------------------- the frame
  step() {
    this.frame++;
    this.phaseT++;
    const s = this.active;
    const aiming = this.phase === "aim";   // the clock starts the frame after the banner

    if (this.phase === "loading") {
      const waiting = this.players.some((p) => !p.ready && this.present(p));
      if (!waiting || this.phaseT > LOAD_FRAMES) this.beginTurn(this.nextPlayer(-1));
    } else if (this.phase === "banner") {
      if (this.phaseT > BANNER_FRAMES) this.setPhase("aim");
    } else if (this.phase === "round") {
      if (this.phaseT > ROUND_FRAMES) {
        const nt = this.nextPlayer(this.cur);
        if (nt < 0) return this.endMatch(null);
        this.beginTurn(nt);
      }
    } else if (this.phase === "over") {
      if (this.phaseT > OVER_FRAMES) this.finish();
    }

    if (aiming && s) {
      if (s.ground) {
        if (this.dir) this.walk(s, this.dir);
      } else if (this.dir && s.jumping && this.steps > 0) {
        s.vx = Math.max(-3.2, Math.min(3.2, s.vx + this.dir * 0.3));
        s.face = this.dir;
        this.steps = Math.max(0, this.steps - R.AIR_STEER_COST);
      }
      this.timeLeft--;
      if (this.timeLeft <= 0) { this.timeLeft = 0; this.endTurn(`${s.name} ${pick(LINES.timeout, this.rnd)}`); }
      else if (s.dead) this.endTurn();
    }

    for (const q of this.squirrels) this.stepSquirrel(q);
    if (this.shot) this.stepShot(this.shot);

    if (this.phase === "flight" && (!this.shot || this.phaseT > FLIGHT_MAX)) {
      this.shot = null;
      this.setPhase("settle");
    }
    if (this.phase === "settle") {
      const still = !this.shot && this.squirrels.every((q) => q.drowned || (q.ground && q.vy === 0));
      this.settleT = still ? this.settleT + 1 : 0;
      if (this.settleT > SETTLE_FRAMES || this.phaseT > SETTLE_MAX) this.finishTurn();
    }
  }

  // ---------------------------------------------------------------- physics
  solid(x, y) {
    return R.solid(this.mask, x, y);
  }

  stepSquirrel(s) {
    if (s.drowned) return;
    if (s.ground) {
      if (!this.solid(s.x, s.y + 1)) s.ground = false;
      else return;
    }
    s.vy += R.G;
    const steps = Math.ceil(Math.max(Math.abs(s.vx), Math.abs(s.vy), 1));
    for (let i = 0; i < steps; i++) {
      const nx = s.x + s.vx / steps, ny = s.y + s.vy / steps;
      if (this.solid(nx, s.y - 12)) s.vx *= -0.3;
      else s.x = nx;
      if (s.vy < 0 && this.solid(s.x, ny - 34)) {
        s.vy = 0;
      } else if (s.vy > 0 && this.solid(s.x, ny)) {
        const impact = s.vy;
        s.vy = 0; s.vx = 0; s.ground = true; s.jumping = false;
        if (impact > 10) this.hurt(s, Math.round((impact - 10) * 5), null);
        break;
      } else s.y = ny;
    }
    let k = 0;
    while (this.solid(s.x, s.y) && k++ < 20) s.y--;
    if (s.y > R.WATER || s.x < -30 || s.x > R.W + 30) this.drown(s);
  }

  // One frame of walking: climbs up to STEP_UP px, follows the ground down,
  // and costs steps. Out of steps stops the squirrel but not the turn.
  walk(s, dir) {
    s.face = dir;
    if (!s.ground) return false;
    if (this.steps <= 0) {
      if (!this.outOfSteps) { this.outOfSteps = true; this.pop(s.x, s.y - 92, "Out of steps!", this.players[s.p].color, 15); }
      return false;
    }
    const nx = s.x + dir * R.WALK_STEP;
    let ny = s.y, up = 0;
    while (this.solid(nx, ny) && up < R.STEP_UP) { ny--; up++; }
    if (this.solid(nx, ny) || this.solid(nx, ny - 22)) return false;
    this.steps = Math.max(0, this.steps - R.WALK_STEP);
    s.x = nx; s.y = ny;
    let down = 0;
    while (!this.solid(s.x, s.y + 1) && down < R.STEP_UP) { s.y++; down++; }
    if (!this.solid(s.x, s.y + 1)) s.ground = false;
    return true;
  }

  jump(s) {
    if (!s.ground) return false;
    if (this.steps < R.JUMP_COST) { this.pop(s.x, s.y - 92, "Too tired to jump", this.players[s.p].color, 14); return false; }
    this.steps -= R.JUMP_COST;
    s.vy = -7; s.vx = s.face * 2.6; s.ground = false; s.jumping = true;
    return true;
  }

  fire(ang, pow) {
    const s = this.active;
    s.face = Math.cos(ang) >= 0 ? 1 : -1;
    const l = R.launch(s, ang, pow, "bazooka");
    this.shot = { type: "bazooka", ...l, t: 0, owner: s };
    this.dir = 0;
    this.aim = null;
    this.setPhase("flight");
  }

  stepShot(p) {
    const w = R.WEAPONS[p.type];
    p.t++;
    p.vy += R.G;
    if (w.wind) p.vx += this.wind * R.WIND_PUSH;
    const steps = Math.ceil(Math.max(Math.abs(p.vx), Math.abs(p.vy), 1));
    for (let i = 0; i < steps; i++) {
      const nx = p.x + p.vx / steps, ny = p.y + p.vy / steps;
      const hitSq = this.squirrels.some((s) => !s.drowned && !(s === p.owner && p.t < 12) && Math.hypot(s.x - nx, s.y - 22 - ny) < 17);
      if (this.solid(nx, ny) || hitSq) {
        this.shot = null;
        this.explode(nx, ny, w.r, w.dmg, p.owner);
        return;
      }
      p.x = nx; p.y = ny;
    }
    if (p.y > R.WATER) {
      this.shot = null;
      this.emitEvent({ k: "splash", x: r1(p.x), big: false });
      this.pop(p.x, R.WATER - 30, "plop.", "#9fd3ea", 14);
    } else if (p.x < -300 || p.x > R.W + 300) {
      this.shot = null;
    }
  }

  explode(x, y, r, dmg, owner) {
    R.crater(this.mask, x, y, r);
    const c = { i: this.craters.length, x: r1(x), y: r1(y), r };
    this.craters.push(c);
    this.emitEvent({ k: "crater", ...c });
    for (const s of this.squirrels) {
      if (s.drowned) continue;
      const dx = s.x - x, dy = (s.y - 20) - y, dist = Math.hypot(dx, dy) || 1, reach = r * 1.6;
      if (dist > reach) continue;
      const f = 1 - dist / reach;
      this.hurt(s, Math.round(dmg * (0.25 + 0.75 * f)), owner);
      s.vx = (dx / dist) * f * 9;
      s.vy = Math.min(-2.5, (dy / dist) * f * 9 - 4 * f);
      s.ground = false;
      s.jumping = false;
    }
  }

  hurt(s, dmg, by) {
    if (s.dead || dmg <= 0) return;
    s.hp = Math.max(0, s.hp - dmg);
    if (by && by.p !== s.p) { by.dealt += dmg; this.players[by.p].dealt += dmg; }
    const color = this.players[s.p].color;
    this.pop(s.x, s.y - 66, `-${dmg}`, "#fff", 22);
    if (s.hp <= 0) {
      this.kill(s);
      this.pop(s.x, s.y - 92, pick(LINES.death, this.rnd), color, 15);
    } else if (this.rnd() < 0.7) {
      this.pop(s.x, s.y - 92, by === s ? pick(LINES.self, this.rnd) : pick(LINES.hit, this.rnd), color, 14);
    }
  }

  drown(s) {
    if (s.drowned) return;
    s.drowned = true;
    s.vx = 0; s.vy = 0;
    this.emitEvent({ k: "splash", x: r1(s.x), big: true });
    if (!s.dead) {
      s.hp = 0;
      this.kill(s);
      this.pop(s.x, R.WATER - 50, pick(LINES.drown, this.rnd), this.players[s.p].color, 15);
    }
  }

  kill(s) {
    s.dead = true;
    s.hp = 0;
    const p = this.players[s.p];
    if (p.outAt == null && !this.playerAlive(s.p)) p.outAt = this.frame;
  }

  // ---------------------------------------------------------------- out
  pop(x, y, text, color, size) {
    this.emitEvent({ k: "pop", x: r1(x), y: r1(y), text, color, size });
  }

  emitEvent(e) {
    this.events.push(e);
  }

  snapshot(full) {
    const out = {
      ph: this.phase, f: this.frame, cur: this.cur, act: this.active ? this.active.i : -1,
      round: this.round, played: [...this.played], turnNo: this.turnNo,
      timer: Math.ceil(this.timeLeft / R.FPS), steps: r1(this.steps), wind: this.wind,
      sq: this.squirrels.map((s) => ({ x: r1(s.x), y: r1(s.y), hp: Math.round(s.hp), dead: s.dead, drowned: s.drowned, face: s.face })),
      shot: this.shot ? { x: r1(this.shot.x), y: r1(this.shot.y), vx: r1(this.shot.vx), vy: r1(this.shot.vy) } : null,
      aim: this.aim, nc: this.craters.length,
    };
    if (full) {
      out.map = this.map;
      out.perPlayer = this.perPlayer;
      out.players = this.players.map((p) => ({ slot: p.slot, uid: p.uid, id: p.id, name: p.name, color: p.color }));
      out.names = this.squirrels.map((s) => ({ p: s.p, n: s.n, name: s.name }));
      out.craters = this.craters;
      if (this.phase === "over") out.over = { winner: this.winner ? this.winner.name : null, rows: this.results };
    }
    return out;
  }

  broadcast() {
    const st = this.snapshot(false);
    st.ev = this.events;
    this.events = [];
    this.io.to(this.room.code).emit("squirrels-state", st);
  }
}

SquirrelsGame.R = R;
module.exports = SquirrelsGame;
