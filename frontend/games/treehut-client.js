// Drey's Treehut - the client. A Tibia-style frame around one shared room:
// a top bar with the room and the clock, the room canvas (15x11 tiles), a side
// panel (Rooms, Party with live scores, Challenges, Clue bag) and a console
// with Default/Party tabs and chat.
//
// The server (backend/games/treehut.js) holds the truth and broadcasts
// "treehut-state". This file draws it, walks you there one tile step at a time
// ("move"), and asks to inspect what you click ("inspect"). The rooms come from
// treehut-rules.js, the art from treehut-art.js, the start screen from
// treehut-start.js.
//
// Exposes the two globals the platform expects: initTreehutClient /
// cleanupTreehutClient.
(function () {
  "use strict";

  const STEP_MS = 190;          // one tile step; the server allows one every MOVE_MS
  const STEP_WAIT_MS = 700;     // give up waiting for the server to confirm a step after this
  const LOOK_MS = 3200;         // how long the green "You see..." line stays
  const MAX_LOG = 120;

  let session = null;

  window.initTreehutClient = function (socket, myId, room) {
    if (session) session.dispose();
    session = createSession(socket);
    boot(session, room);
  };

  window.cleanupTreehutClient = function () {
    if (session) session.dispose();
    session = null;
  };

  function createSession(socket) {
    const s = { socket, disposed: false, raf: 0, timers: [], dom: [], sock: [], cleanups: [] };
    s.on = (target, type, fn, opts) => { target.addEventListener(type, fn, opts); s.dom.push([target, type, fn, opts]); };
    s.listen = (event, fn) => { socket.on(event, fn); s.sock.push([event, fn]); };
    s.later = (fn, ms) => { const id = setTimeout(fn, ms); s.timers.push(id); return id; };
    s.dispose = () => {
      if (s.disposed) return;
      s.disposed = true;
      cancelAnimationFrame(s.raf);
      s.timers.forEach(clearTimeout);
      s.dom.forEach(([t, ty, fn, o]) => t.removeEventListener(ty, fn, o));
      s.sock.forEach(([e, fn]) => socket.off(e, fn));
      s.cleanups.forEach((fn) => { try { fn(); } catch (e) { /* best effort */ } });
      const area = document.getElementById("game-area");
      if (area) area.innerHTML = "";
    };
    return s;
  }

  // ------------------------------------------------------------------ styles
  // Everything is under .th so the site's .card/.btn styles never leak in.
  const CSS = `
body.th-active .container{max-width:99vw !important;width:99vw !important;padding:0.4rem !important;}
body.th-active .page-center{padding:0 !important;}
body.th-active .game-area-card{padding:0.4rem !important;max-width:none !important;gap:0.4rem !important;}
body.th-active .logo,body.th-active .tagline,body.th-active #round-indicator{display:none !important;}
body.th-active #game-area{width:100%;}
.th{--stone:#3b3a37;--stone-dark:#262523;--edge-hi:#77746c;--edge-lo:#141312;--text:#d8d2c0;--muted:#8f897a;
  --gold:#f0c040;--green:#4ee04e;--npc:#8fd0ff;--event:#f4e04a;--red:#e8604a;--ch:#f0c040;--cl:#6fc3ff;--hp:#7be07b;
  display:grid;grid-template-columns:1fr 236px;grid-template-rows:auto 1fr 168px;gap:4px;padding:4px;
  height:calc(100vh - 6.5rem);min-height:600px;background:var(--stone-dark);color:var(--text);
  font:12px/1.35 Verdana,Tahoma,sans-serif;text-align:left;border-radius:4px;}
.th *,.th *::before,.th *::after{box-sizing:border-box;}
.th-panel{background:var(--stone);border:1px solid;border-color:var(--edge-hi) var(--edge-lo) var(--edge-lo) var(--edge-hi);box-shadow:inset 0 0 0 1px #2c2b28;}
.th-ptitle{background:linear-gradient(#4c4a45,#353430);border-bottom:1px solid var(--edge-lo);padding:2px 6px;font-size:11px;color:#e6dfc8;letter-spacing:.3px;display:flex;justify-content:space-between;align-items:center;}
.th-ptitle span{color:var(--muted);}
.th-pbody{padding:6px;}
.th-top{grid-column:1/3;display:flex;align-items:center;gap:14px;padding:4px 10px;}
.th-title{font-weight:bold;color:var(--gold);text-shadow:1px 1px 0 #000;}
.th-timer{margin-left:auto;display:flex;align-items:center;gap:8px;}
.th-timer small{color:var(--muted);font-size:11px;}
.th-timebar{width:180px;height:12px;background:#1a1918;border:1px solid;border-color:var(--edge-lo) var(--edge-hi) var(--edge-hi) var(--edge-lo);}
.th-timebar i{display:block;height:100%;background:linear-gradient(#5fd35f,#2f9a2f);transition:width .5s linear;}
.th-timebar.low i{background:linear-gradient(#f07a5a,#b8341c);}
.th-time{font-weight:bold;min-width:44px;text-align:right;text-shadow:1px 1px 0 #000;}
.th-time.low{color:var(--red);}
.th-view{position:relative;overflow:hidden;display:flex;align-items:center;justify-content:center;background:#000;min-height:0;}
.th-view canvas{image-rendering:pixelated;image-rendering:crisp-edges;cursor:pointer;display:block;}
.th-look{position:absolute;left:0;right:0;bottom:18px;text-align:center;color:var(--green);font-weight:bold;font-size:13px;
  text-shadow:1px 1px 0 #000,-1px -1px 0 #000,1px -1px 0 #000,-1px 1px 0 #000;pointer-events:none;transition:opacity .4s;opacity:0;padding:0 12px;}
.th-float{position:absolute;pointer-events:none;font-weight:bold;font-size:12px;text-shadow:1px 1px 0 #000,-1px -1px 0 #000,1px -1px 0 #000,-1px 1px 0 #000;
  transform:translate(-50%,-100%);white-space:nowrap;animation:thRise 1.6s ease-out forwards;}
@keyframes thRise{from{opacity:1;margin-top:0}to{opacity:0;margin-top:-28px}}
.th-side{grid-row:2/4;grid-column:2;display:flex;flex-direction:column;gap:4px;overflow:auto;min-height:0;}
.th-rooms{display:flex;gap:4px;}
.th-chip{flex:1;text-align:center;padding:4px 2px;font-size:10px;background:#1d1c1a;color:var(--muted);
  border:1px solid;border-color:var(--edge-lo) var(--edge-hi) var(--edge-hi) var(--edge-lo);}
.th-chip.done{color:var(--hp);}
.th-chip.here{color:var(--gold);border-color:var(--gold);}
.th-chip b{display:block;font-size:13px;font-weight:normal;}
.th-prow{display:grid;grid-template-columns:12px 1fr auto;gap:6px;align-items:center;padding:3px 2px;}
.th-prow .dot{width:10px;height:10px;border:1px solid #000;}
.th-prow .nm{color:#e8e2cc;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.th-prow .nm.me{color:var(--gold);}
.th-prow.gone .nm{color:var(--muted);text-decoration:line-through;}
.th-prow .rd{display:block;color:var(--muted);font-size:10px;font-style:italic;}
.th-prow .pts{font-weight:bold;color:#fff;font-size:11px;}
.th-bar{grid-column:2/4;height:4px;display:flex;background:#1a1918;}
.th-bar i{display:block;height:100%;transition:width .4s;}
.th-legend{display:flex;gap:8px;font-size:10px;color:var(--muted);margin-top:4px;}
.th-legend span::before{content:"";display:inline-block;width:8px;height:8px;margin-right:3px;vertical-align:-1px;background:var(--c);}
.th-ch{display:flex;gap:6px;align-items:flex-start;padding:3px 2px;}
.th-ch .box{flex:none;width:13px;height:13px;margin-top:1px;background:#1d1c1a;color:var(--green);font-size:11px;line-height:11px;text-align:center;font-weight:bold;
  border:1px solid;border-color:var(--edge-lo) var(--edge-hi) var(--edge-hi) var(--edge-lo);}
.th-ch.done .th-label{color:var(--muted);text-decoration:line-through;}
.th-ch .by{color:var(--muted);font-size:10px;display:block;}
.th-door{margin-top:4px;padding:4px;text-align:center;font-size:11px;background:#1d1c1a;}
.th-door.open{color:var(--green);}
.th-slots{display:grid;grid-template-columns:repeat(4,1fr);gap:3px;}
.th-slot{aspect-ratio:1;background:#1d1c1a;position:relative;display:flex;align-items:center;justify-content:center;
  border:1px solid;border-color:var(--edge-lo) var(--edge-hi) var(--edge-hi) var(--edge-lo);}
.th-slot canvas{image-rendering:pixelated;width:40px;height:40px;}
.th-slot .who{position:absolute;right:1px;bottom:1px;width:7px;height:7px;border:1px solid #000;}
.th-console{grid-column:1;grid-row:3;display:flex;flex-direction:column;min-height:0;}
.th-tabs{display:flex;gap:2px;padding:3px 4px 0;background:var(--stone-dark);}
.th-tab{padding:2px 10px;background:#2f2e2b;color:var(--muted);cursor:pointer;font-size:11px;
  border:1px solid;border-bottom:none;border-color:var(--edge-hi) var(--edge-lo) transparent var(--edge-hi);}
.th-tab.on{background:var(--stone);color:#fff;}
.th-log{flex:1;overflow-y:auto;padding:4px 8px;background:#191817;font-size:11.5px;min-height:0;}
.th-log div{white-space:pre-wrap;}
.th-log .t{color:#6f6a5e;margin-right:6px;}
.th-log .ev{color:var(--event);}
.th-log .npc{color:var(--npc);}
.th-log .look{color:var(--green);}
.th-log .chat{color:#e6e6e6;}
.th-log .party{color:#ffa0e0;}
.th-log .warn{color:var(--red);}
.th-chatin{display:flex;gap:4px;padding:3px 4px;background:var(--stone);}
.th-chatin input{flex:1;background:#121110;color:#fff;font:inherit;padding:4px 6px;outline:none;
  border:1px solid;border-color:var(--edge-lo) var(--edge-hi) var(--edge-hi) var(--edge-lo);}
.th-btn{background:linear-gradient(#55534d,#3a3935);color:#eee6cc;padding:4px 12px;font:inherit;cursor:pointer;min-width:64px;
  border:1px solid;border-color:var(--edge-hi) var(--edge-lo) var(--edge-lo) var(--edge-hi);}
.th-btn:hover{background:linear-gradient(#625f58,#45433e);}
.th-tip{position:fixed;z-index:50;pointer-events:none;max-width:220px;background:#1d1c1a;border:1px solid #77746c;padding:5px 7px;font:11px/1.35 Verdana,sans-serif;color:#d8d2c0;text-align:left;}
`;

  const HTML = `
<div class="th-panel th-top">
  <span class="th-title">Drey's Treehut</span>
  <span data-el="roomName"></span>
  <div class="th-timer">
    <small>Time left</small>
    <div class="th-timebar" data-el="timebar"><i data-el="timefill" style="width:100%"></i></div>
    <span class="th-time" data-el="time">15:00</span>
  </div>
</div>
<div class="th-panel th-view" data-el="view">
  <canvas data-el="canvas" width="480" height="352"></canvas>
  <div class="th-look" data-el="look"></div>
</div>
<div class="th-side">
  <div class="th-panel"><div class="th-ptitle">Rooms</div><div class="th-pbody"><div class="th-rooms" data-el="rooms"></div></div></div>
  <div class="th-panel"><div class="th-ptitle">Party <span>score</span></div><div class="th-pbody">
    <div data-el="party"></div>
    <div class="th-legend"><span style="--c:var(--ch)">Challenges</span><span style="--c:var(--cl)">Clues</span><span style="--c:var(--hp)">Helping</span></div>
  </div></div>
  <div class="th-panel"><div class="th-ptitle">Challenges in this room</div><div class="th-pbody"><div data-el="challenges"></div><div class="th-door" data-el="door"></div></div></div>
  <div class="th-panel" style="flex:1"><div class="th-ptitle">Clue bag <span data-el="clueCount">0</span></div><div class="th-pbody"><div class="th-slots" data-el="slots"></div></div></div>
</div>
<div class="th-panel th-console">
  <div class="th-tabs"><span class="th-tab on" data-tab="all">Default</span><span class="th-tab" data-tab="party">Party</span></div>
  <div class="th-log" data-el="log"></div>
  <form class="th-chatin" data-el="chatForm"><input data-el="chatInput" maxlength="200" autocomplete="off" placeholder="Say something to your party, e.g. &quot;check the barrels&quot;"><button class="th-btn">Send</button></form>
</div>`;

  // ------------------------------------------------------------------ boot
  function boot(s, room) {
    const R = window.TREEHUT_RULES, A = window.TREEHUT_ART, T = A.T;
    const W = R.COLS * T, H = R.ROWS * T;

    const style = document.createElement("style");
    style.textContent = CSS;
    document.head.appendChild(style);
    document.body.classList.add("th-active");
    const tip = document.createElement("div");
    tip.className = "th-tip"; tip.hidden = true;
    document.body.appendChild(tip);
    s.cleanups.push(() => { document.body.classList.remove("th-active"); style.remove(); tip.remove(); });

    const area = document.getElementById("game-area");
    area.innerHTML = "";
    const root = document.createElement("div");
    root.className = "th";
    root.innerHTML = HTML;
    area.appendChild(root);
    const $ = {};
    root.querySelectorAll("[data-el]").forEach((el) => { $[el.dataset.el] = el; });
    const canvas = $.canvas, ctx = canvas.getContext("2d");
    const start = window.TREEHUT_START.mount($.view, send);
    s.cleanups.push(() => start.destroy());

    // ---------------------------------------------------------------- state
    let S = null;                    // the latest treehut-state
    let shownRoom = -1;
    let timeAt = 0;                  // when S.timeLeftMs was true, local clock
    const pos = new Map();           // uid -> { x, y, fx, fy, t, face }: drawn position, sliding between tiles
    let path = [];                   // my remaining steps, [[x, y], ...]
    let then = null;                 // what to do at the end of the walk
    let target = null;               // the tile I clicked
    let lastSent = 0;
    let awaiting = null;             // the tile my last walk step should land on
    let viewScale = 1;
    const seen = { clues: new Set(), pieces: new Set(), solved: new Set(), rules: new Set() };

    const meP = () => S && S.players.find((p) => p.id === s.socket.id);
    const byUid = (uid) => S && S.players.find((p) => p.uid === uid);
    const nameOf = (uid) => { const p = byUid(uid); if (!p) return "Someone"; return p.id === s.socket.id ? "You" : p.name; };
    const picked = () => (S ? S.picked : {});

    // ---------------------------------------------------------------- server
    s.listen("treehut-state", (st) => {
      const first = !S;
      S = st;
      S.players.sort((a, b) => +a.uid.slice(1) - +b.uid.slice(1));   // join order, p1 first
      start.update(st, st.players.find((p) => p.id === s.socket.id));
      timeAt = performance.now();
      if (st.room !== shownRoom) enterRoom(first);
      noteNews(first);
      for (const p of st.players) {
        const q = pos.get(p.uid);
        if (!q || q.room !== st.room) pos.set(p.uid, { x: p.x, y: p.y, fx: p.x, fy: p.y, t: 0, face: 1, room: st.room });
        else if (q.x !== p.x || q.y !== p.y) {
          const now = performance.now();
          const k = Math.min(1, (now - q.t) / STEP_MS);
          q.fx = q.fx + (q.x - q.fx) * k; q.fy = q.fy + (q.y - q.fy) * k;
          if (p.x !== q.x) q.face = p.x > q.x ? -1 : 1;
          q.x = p.x; q.y = p.y; q.t = now;
        }
      }
      // my walk: drop the step the server has taken, give up when it said no
      const me = meP();
      if (me && path.length && me.x === path[0][0] && me.y === path[0][1]) {
        path.shift();
        if (!path.length) arrive();
      }
      renderSide();
    });

    s.listen("treehut-chat", ({ uid, name, text }) => {
      const mine = S && byUid(uid) && byUid(uid).id === s.socket.id;
      logLine(mine ? "chat" : "party", `${name}: ${text}`, true);
      floatOver(uid, text.length > 26 ? text.slice(0, 24) + "…" : text, mine ? "#f0c040" : "#ffd0f0");
    });

    s.listen("treehut-over", (over) => {
      const line = over.outcome === "solved" ? "Case solved! The thief is caught."
        : over.outcome === "wrong" ? "The party named the wrong neighbour. The thief got away."
        : "Time is up. The thief got away.";
      logLine("ev", line, true);
      look(line);
    });

    function send(t, data) { s.socket.emit("treehut-input", Object.assign({ t }, data)); }

    function enterRoom(first) {
      const room = R.ROOMS[S.room];
      shownRoom = S.room;
      path = []; then = null; target = null; awaiting = null;
      if (first) {
        logLine("ev", "You climb up into Drey's treehut. Find out who stole the golden hazelnut!", true);
        logLine("ev", "Click to walk, click things to inspect them. Arrow keys or WASD move too.", false);
      } else {
        logLine("ev", `The party enters ${room.name}.`, true);
      }
      room.drey.forEach((l, i) => s.later(() => npc(l), 900 + i * 1400));
    }

    // Console lines for what changed since the last state.
    function noteNews(first) {
      for (const c of S.clues) {
        if (seen.clues.has(c.id)) continue;
        seen.clues.add(c.id);
        if (!first) {
          logLine("ev", `${nameOf(c.by)} found a clue: ${R.CLUES[c.id].name}.`, true);
          floatOver(c.by, "+" + R.POINTS.clue + " clue", "#6fc3ff");
        }
      }
      for (const [i, uid] of Object.entries(S.mapPieces)) {
        if (seen.pieces.has(i)) continue;
        seen.pieces.add(i);
        if (!first) {
          logLine("ev", `${nameOf(uid)} found a map piece (${Object.keys(S.mapPieces).length} of ${R.MAP_PIECES}).`, true);
          floatOver(uid, "+" + R.POINTS.clue + " clue", "#6fc3ff");
        }
      }
      for (const [i, uid] of Object.entries(S.readRules)) {
        if (seen.rules.has(i)) continue;
        seen.rules.add(i);
        if (!first && uid !== (meP() || {}).uid) {
          const o = R.ROOMS[0].objects.find((x) => x.rule === +i);
          if (o) logLine("party", `${nameOf(uid)} read a barrel: ${o.look.replace("Carved on the barrel: ", "")}`, true);
        }
      }
      for (const [cid, uid] of Object.entries(S.solved)) {
        if (seen.solved.has(cid)) continue;
        seen.solved.add(cid);
        if (!first) {
          logLine("ev", `${nameOf(uid)} solved: ${R.CHALLENGES[cid].name}.`, true);
          floatOver(uid, "+" + R.POINTS.challenge + " challenge", "#f0c040");
        }
      }
    }

    // ---------------------------------------------------------------- walking
    // Players never block each other, so only the room decides where you can go.
    function canWalk(x, y) {
      return x >= 0 && y >= 0 && x < R.COLS && y < R.ROWS && R.walkable(S.room, x, y, S.doorOpen, picked());
    }

    function bfs(sx, sy, tx, ty) {
      const key = (x, y) => y * R.COLS + x;
      const prev = new Map([[key(sx, sy), -1]]);
      const q = [[sx, sy]];
      while (q.length) {
        const [x, y] = q.shift();
        if (x === tx && y === ty) {
          const out = [];
          let k = key(x, y);
          while (prev.get(k) !== -1) { out.unshift([k % R.COLS, Math.floor(k / R.COLS)]); k = prev.get(k); }
          return out;
        }
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, ny = y + dy, k = key(nx, ny);
          if (prev.has(k) || !canWalk(nx, ny)) continue;
          prev.set(k, key(x, y)); q.push([nx, ny]);
        }
      }
      return null;
    }

    function walkTo(tx, ty, after) {
      const me = meP();
      if (!me) return false;
      const p = bfs(me.x, me.y, tx, ty);
      if (!p) return false;
      path = p; then = after || null;
      if (!path.length) arrive();
      return true;
    }

    // Walk to the nearest tile next to an object (diagonals count), then act.
    function walkNextTo(o, after) {
      const me = meP();
      if (!me) return;
      if (R.near(me.x, me.y, o)) { path = []; then = null; target = null; after(); return; }
      let best = null;
      const spots = o.solid ? [] : [[0, 0]];
      spots.push([0, 1], [1, 0], [-1, 0], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]);
      for (const [dx, dy] of spots) {
        const nx = o.x + dx, ny = o.y + dy;
        if (!canWalk(nx, ny) || R.tileAt(S.room, nx, ny) === "D") continue;
        const p = bfs(me.x, me.y, nx, ny);
        if (p && (!best || p.length < best.length)) best = p;
      }
      if (best) { path = best; then = after; }
      else look("You cannot reach that.");
    }

    function arrive() {
      target = null;
      const fn = then; then = null;
      if (fn) fn();
    }

    // Send the next step once the server has confirmed the last one, so a slow
    // answer never doubles a step.
    function stepWalk(now) {
      if (!path.length || !S || S.over) return;
      if (now - lastSent < STEP_MS) return;
      const me = meP();
      if (!me) return;
      if (awaiting && !(me.x === awaiting[0] && me.y === awaiting[1]) && now - lastSent < STEP_WAIT_MS) return;
      awaiting = null;
      const [nx, ny] = path[0];
      const dx = nx - me.x, dy = ny - me.y;
      if (Math.abs(dx) + Math.abs(dy) !== 1 || !canWalk(nx, ny)) {
        // knocked off the path (a lost step, or the room changed): find a new one
        const end = path[path.length - 1], after = then;
        path = [];
        if (!walkTo(end[0], end[1], after)) target = null;
        return;
      }
      const dir = dx === 1 ? "right" : dx === -1 ? "left" : dy === 1 ? "down" : "up";
      send("move", { dir });
      lastSent = now;
      awaiting = [nx, ny];
    }

    // ---------------------------------------------------------------- acting
    function inspect(o) {
      if (o.look) look(o.look);
      if (o.npc) { (R.ROOMS[S.room].drey || []).forEach((l, i) => s.later(() => npc(l), i * 900)); return; }
      send("inspect", { id: o.id });
    }

    function tileFromEvent(e) {
      const r = canvas.getBoundingClientRect();
      return [Math.floor((e.clientX - r.left) / r.width * R.COLS), Math.floor((e.clientY - r.top) / r.height * R.ROWS)];
    }

    function lockedDoorText() {
      const left = R.ROOMS[S.room].challenges.filter((c) => !S.solved[c]).length;
      return `The door is locked. Solve ${left} more challenge${left === 1 ? "" : "s"} to open it.`;
    }

    s.on(canvas, "click", (e) => {
      if (!S || S.over) return;
      const [x, y] = tileFromEvent(e);
      const o = R.objectAt(S.room, x, y, picked());
      if (o) { target = [x, y]; walkNextTo(o, () => inspect(o)); return; }
      const t = R.tileAt(S.room, x, y);
      if (t === "D") {
        if (!S.doorOpen) { look(lockedDoorText()); return; }
        target = [x, y]; walkTo(x, y); return;
      }
      if (t === "W" || t === "B" || t === "#") {
        look(t === "B" ? "You see a broken window. Someone came in this way."
          : t === "W" ? "You see a window. It does not close properly." : "You see the wooden wall of the treehut.");
        return;
      }
      target = [x, y];
      if (!walkTo(x, y)) { target = null; look("There is no way."); }
    });

    s.on(canvas, "mousemove", (e) => {
      if (!S) return;
      const [x, y] = tileFromEvent(e);
      canvas.style.cursor = R.objectAt(S.room, x, y, picked()) ? "help" : "pointer";
    });

    const KEYS = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right", w: "up", s: "down", a: "left", d: "right", W: "up", S: "down", A: "left", D: "right" };
    s.on(document, "keydown", (e) => {
      if (!S || S.over) return;
      const tag = e.target && e.target.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      const dir = KEYS[e.key];
      if (!dir) return;
      e.preventDefault();
      const me = meP();
      if (!me) return;
      path = []; then = null; target = null; awaiting = null;
      const now = performance.now();
      if (now - lastSent < STEP_MS) return;
      const [dx, dy] = R.DIRS[dir];
      const nx = me.x + dx, ny = me.y + dy;
      if (canWalk(nx, ny)) { send("move", { dir }); lastSent = now; return; }
      if (R.tileAt(S.room, nx, ny) === "D") { look(lockedDoorText()); return; }
      const o = R.objectAt(S.room, nx, ny, picked());
      if (o) inspect(o);
    });

    // ---------------------------------------------------------------- console
    let tab = "all";
    const lines = [];
    function stamp() { const d = new Date(); return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; }
    function esc(t) { return String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
    function logLine(cls, text, isParty) {
      lines.push({ cls, text, isParty, t: stamp() });
      if (lines.length > MAX_LOG * 2) lines.splice(0, lines.length - MAX_LOG);
      paintLog();
    }
    function paintLog() {
      $.log.innerHTML = lines.filter((l) => tab === "all" || l.isParty).slice(-MAX_LOG)
        .map((l) => `<div class="${l.cls}"><span class="t">${l.t}</span>${esc(l.text)}</div>`).join("");
      $.log.scrollTop = $.log.scrollHeight;
    }
    function npc(text) { logLine("npc", "Drey: " + text, false); }

    root.querySelectorAll(".th-tab").forEach((t) => s.on(t, "click", () => {
      root.querySelectorAll(".th-tab").forEach((x) => x.classList.toggle("on", x === t));
      tab = t.dataset.tab;
      paintLog();
    }));
    s.on($.chatForm, "submit", (e) => {
      e.preventDefault();
      const v = $.chatInput.value.trim();
      if (!v) return;
      send("chat", { text: v });
      $.chatInput.value = "";
    });

    let lookTimer = 0;
    function look(text) {
      $.look.textContent = text;
      $.look.style.opacity = 1;
      clearTimeout(lookTimer);
      lookTimer = s.later(() => { $.look.style.opacity = 0; }, LOOK_MS);
      logLine("look", text, false);
    }

    function floatAt(tx, ty, text, color) {
      const r = canvas.getBoundingClientRect(), v = $.view.getBoundingClientRect();
      const d = document.createElement("div");
      d.className = "th-float"; d.textContent = text; d.style.color = color;
      d.style.left = (r.left - v.left + (tx * T + 16) * viewScale) + "px";
      d.style.top = (r.top - v.top + (ty * T - 10) * viewScale) + "px";
      $.view.appendChild(d);
      s.later(() => d.remove(), 1700);
    }
    function floatOver(uid, text, color) {
      const q = pos.get(uid);
      if (q && S && q.room === S.room) floatAt(q.x, q.y, text, color);
    }

    // ---------------------------------------------------------------- side panel
    function renderSide() {
      const room = R.ROOMS[S.room];
      $.roomName.textContent = `Room ${S.room + 1} of ${R.ROOMS.length}: ${room.name}`;

      $.rooms.innerHTML = R.ROOMS.map((r, i) => {
        const done = i < S.room || (i === S.room && (S.doorOpen || S.solved.accuse));
        const here = i === S.room;
        return `<div class="th-chip${done ? " done" : ""}${here ? " here" : ""}"><b>${done ? "✔" : i > S.room ? "🔒" : "●"}</b>${esc(r.short)}</div>`;
      }).join("");

      const max = Math.max(60, ...S.players.map((p) => p.score.total));
      $.party.innerHTML = S.players.map((p) => {
        const mine = p.id === s.socket.id;
        return `<div class="th-prow${p.here ? "" : " gone"}" title="${p.here ? "" : "Left the game"}"><span class="dot" style="background:${p.color}"></span>` +
          `<span class="nm${mine ? " me" : ""}">${esc(p.name)}${mine ? " (you)" : ""}${p.here && !p.entered ? '<span class="rd">reading the briefing</span>' : ""}</span><span class="pts">${p.score.total}</span>` +
          `<span class="th-bar">${[["challenge", "ch"], ["clue", "cl"], ["helping", "hp"]].map(([k, v]) =>
            `<i style="width:${p.score[k] / max * 100}%;background:var(--${v})"></i>`).join("")}</span></div>`;
      }).join("");

      $.challenges.innerHTML = room.challenges.map((cid) => {
        const c = R.CHALLENGES[cid], by = S.solved[cid];
        const extra = cid === "map" && !by ? ` (${Object.keys(S.mapPieces).length}/${R.MAP_PIECES} pieces)` : "";
        return `<div class="th-ch${by ? " done" : ""}"><span class="box">${by ? "✓" : ""}</span>` +
          `<span><span class="th-label">${esc(c.name)}${extra}</span>${by ? `<span class="by">by ${esc(nameOf(by) === "You" ? "you" : nameOf(by))}</span>` : ""}</span></div>`;
      }).join("");
      if (!R.doorTile(S.room)) {
        $.door.className = "th-door";
        $.door.textContent = S.solved.accuse ? "Case closed" : "Last room: name the thief";
      } else {
        const n = room.challenges.filter((c) => S.solved[c]).length;
        $.door.className = "th-door" + (S.doorOpen ? " open" : "");
        $.door.textContent = S.doorOpen ? "Door open: walk through it →" : `🔒 Door locked: ${n} of ${room.challenges.length} solved`;
      }

      renderSlots();
    }

    let slotKey = "";
    function renderSlots() {
      const key = S.clues.map((c) => c.id + c.by).join("|") + "|" + S.players.map((p) => p.color).join("");
      if (key === slotKey) return;
      slotKey = key;
      $.clueCount.textContent = S.clues.length;
      const cells = [];
      for (let i = 0; i < 8; i++) {
        const c = S.clues[i];
        const by = c && byUid(c.by);
        cells.push(c ? `<div class="th-slot" data-c="${c.id}"><canvas width="32" height="32"></canvas><i class="who" style="background:${by ? by.color : "#888"}"></i></div>` : '<div class="th-slot"></div>');
      }
      $.slots.innerHTML = cells.join("");
      $.slots.querySelectorAll(".th-slot[data-c]").forEach((el) => {
        const id = el.dataset.c, c = R.CLUES[id];
        A.drawIcon(el.querySelector("canvas").getContext("2d"), c.icon);
        const found = S.clues.find((x) => x.id === id);
        const html = `<b style="color:#6fc3ff">${esc(c.name)}</b><br>${esc(c.text)}<br><span style="color:#8f897a">Found by ${esc(nameOf(found.by))}</span>`;
        el.onmouseenter = (e) => { tip.innerHTML = html; tip.hidden = false; moveTip(e); };
        el.onmousemove = moveTip;
        el.onmouseleave = () => { tip.hidden = true; };
        el.onclick = () => look(`${c.name}: ${c.text}`);
      });
    }
    function moveTip(e) {
      tip.style.left = Math.min(innerWidth - 230, e.clientX + 12) + "px";
      tip.style.top = e.clientY + 12 + "px";
    }

    function renderTime(now) {
      const left = Math.max(0, S.timeLeftMs - (S.over || S.briefingLeftMs ? 0 : now - timeAt));
      const sec = Math.ceil(left / 1000);
      $.time.textContent = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
      $.timefill.style.width = (left / R.GAME_MS * 100) + "%";
      const low = left < 120000;
      $.timebar.classList.toggle("low", low);
      $.time.classList.toggle("low", low);
    }

    // ---------------------------------------------------------------- drawing
    function fit() {
      const vw = $.view.clientWidth - 8, vh = $.view.clientHeight - 8;
      viewScale = Math.max(0.5, Math.min(vw / W, vh / H));
      canvas.style.width = W * viewScale + "px";
      canvas.style.height = H * viewScale + "px";
    }
    s.on(window, "resize", fit);
    if (window.ResizeObserver) {
      const ro = new ResizeObserver(fit);
      ro.observe($.view);
      s.cleanups.push(() => ro.disconnect());
    }
    fit();

    function outlined(txt, x, y, col) {
      ctx.fillStyle = "#000";
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) ctx.fillText(txt, x + dx, y + dy);
      ctx.fillStyle = col; ctx.fillText(txt, x, y);
    }

    function drawObj(o, t) {
      A.OBJ_ART[o.type](ctx, o.x * T, o.y * T, o, t);
      // a sparkle on clues nobody has found yet, and on map pieces still lying there
      const unfound = (o.clue && !S.clues.some((c) => c.id === o.clue)) || o.piece !== undefined;
      if (unfound && Math.floor(t / 300 + o.x) % 6 === 0) {
        ctx.fillStyle = "#fff8c0";
        ctx.fillRect(o.x * T + 24, o.y * T + 6, 2, 2); ctx.fillRect(o.x * T + 23, o.y * T + 7, 4, 0.5);
      }
      if (o.npc) {
        ctx.font = "bold 9px Verdana"; ctx.textAlign = "center";
        outlined("Drey", o.x * T + 16, o.y * T - 2, "#8fd0ff");
        ctx.textAlign = "left";
      }
    }

    function drawPlayer(p, q, now) {
      const k = Math.min(1, (now - q.t) / STEP_MS);
      const px = (q.fx + (q.x - q.fx) * k) * T, py = (q.fy + (q.y - q.fy) * k) * T;
      const mine = p.id === s.socket.id;
      const moving = k < 1 || (mine && path.length > 0);
      const bob = moving ? Math.floor(now / 120) % 2 : 0;
      ctx.globalAlpha = p.here ? 1 : 0.4;
      ctx.fillStyle = "rgba(0,0,0,.3)"; ctx.fillRect(px + 8, py + 27, 18, 3);
      A.drawSprite(ctx, A.SQUIRREL, A.PAL_SQ, px, py - bob, 2, q.face < 0, p.color);
      // name and colour strip, like Tibia's name and health bar
      ctx.font = "bold 9px Verdana"; ctx.textAlign = "center";
      outlined(p.name, px + 16, py - 7, mine ? "#f0c040" : "#4ee04e");
      ctx.textAlign = "left";
      ctx.fillStyle = "#000"; ctx.fillRect(px + 4, py - 5, 26, 4);
      ctx.fillStyle = p.color; ctx.fillRect(px + 5, py - 4, 24, 2);
      ctx.globalAlpha = 1;
    }

    function draw(now) {
      if (!S) {
        ctx.fillStyle = "#000"; ctx.fillRect(0, 0, W, H);
        ctx.font = "bold 14px Verdana"; ctx.textAlign = "center";
        outlined("Climbing up to the treehut…", W / 2, H / 2, "#d8d2c0");
        ctx.textAlign = "left";
        return;
      }
      const room = R.ROOMS[S.room];
      for (let y = 0; y < R.ROWS; y++) for (let x = 0; x < R.COLS; x++) {
        const c = room.map[y][x], X = x * T, Y = y * T;
        if (c === ".") A.drawFloor(ctx, X, Y, x * 31 + y * 17 + S.room);
        else if (c === "D") A.drawDoor(ctx, X, Y, S.doorOpen ? "open" : "locked");
        else if (c === "W") A.drawWindow(ctx, X, Y, false);
        else if (c === "B") A.drawWindow(ctx, X, Y, true);
        else A.drawWall(ctx, X, Y, x * 13 + y * 7, y < R.ROWS - 1 && room.map[y + 1][x] === ".");
      }
      // light from the window
      ctx.fillStyle = "rgba(255,240,190,.05)"; ctx.fillRect(3 * T, T, 4 * T, 4 * T);

      const objs = room.objects.filter((o) => !S.picked[o.id]);
      objs.filter((o) => o.floor).forEach((o) => A.OBJ_ART[o.type](ctx, o.x * T, o.y * T, o, now));
      const things = objs.filter((o) => !o.floor).map((o) => ({ y: o.y, d: () => drawObj(o, now) }));
      for (const p of S.players) {
        const q = pos.get(p.uid);
        if (!q) continue;
        const k = Math.min(1, (now - q.t) / STEP_MS);
        things.push({ y: q.fy + (q.y - q.fy) * k + 0.01 + (p.id === s.socket.id ? 0.001 : 0), d: () => drawPlayer(p, q, now) });
      }
      things.sort((a, b) => a.y - b.y).forEach((th) => th.d());

      if (target) {
        ctx.strokeStyle = "rgba(255,255,255,.6)"; ctx.lineWidth = 1;
        ctx.strokeRect(target[0] * T + 0.5, target[1] * T + 0.5, T - 1, T - 1);
      }
      // vignette
      const g = ctx.createRadialGradient(W / 2, H / 2, 120, W / 2, H / 2, 320);
      g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(0,0,0,.35)");
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }

    function frame(now) {
      if (s.disposed) return;
      stepWalk(now);
      draw(now);
      if (S) renderTime(now);
      s.raf = requestAnimationFrame(frame);
    }
    s.raf = requestAnimationFrame(frame);
  }
})();
