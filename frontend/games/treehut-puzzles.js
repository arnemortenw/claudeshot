// Drey's Treehut - the challenge windows. Draggable Tibia-style windows over the
// room for the barrel lock, the pantry ledger, the Bookshop ARK bag and the torn
// map, the "Give hint" prompts teammates get when someone asks the party, and
// the door's "Open!".
//
// The server decides everything: an answer goes out as "answer", a map piece is
// turned with "rotate-piece", hints go out as "ask-hint" / "give-hint". Windows
// redraw from treehut-state, so every tab shows the same solver, rules read,
// map turns and hints. A wrong answer comes back on "treehut-wrong" to the one
// who answered and only shows that window's failure line.
//
// treehut-client.js makes one with TREEHUT_PUZZLES.create(api) and calls
// open(cid), update(state) and wrong(cid).
(function () {
  "use strict";

  const CSS = `
.th-win{position:absolute;z-index:5;min-width:300px;max-width:520px;max-height:calc(100% - 12px);display:flex;flex-direction:column;
  background:var(--stone);border:2px solid;border-color:var(--edge-hi) var(--edge-lo) var(--edge-lo) var(--edge-hi);box-shadow:0 6px 24px rgba(0,0,0,.7);}
.th-win.wide{max-width:600px;}
.th-win .th-ptitle{font-size:12px;padding:4px 8px;cursor:move;user-select:none;}
.th-win .x{cursor:pointer;color:var(--muted);padding:0 2px;}
.th-win .x:hover{color:#fff;}
.th-wbody{padding:10px 12px;overflow:auto;min-height:0;}
.th-wbody p{margin:0 0 8px;}
.th-wact{display:flex;gap:6px;justify-content:flex-end;padding:0 12px 10px;}
.th .th-btn.primary{color:var(--gold);font-weight:bold;}
.th .th-btn:disabled{opacity:.45;cursor:default;}
.th-inset{background:#1d1c1a;padding:8px;border:1px solid;border-color:var(--edge-lo) var(--edge-hi) var(--edge-hi) var(--edge-lo);}
.th input.th-txt{background:#121110;color:#fff;font:inherit;padding:4px 6px;width:100%;outline:none;letter-spacing:1px;border-radius:0;
  border:1px solid;border-color:var(--edge-lo) var(--edge-hi) var(--edge-hi) var(--edge-lo);}
.th-fb{margin-top:6px;min-height:16px;font-weight:bold;}
.th-fb.bad{color:var(--red);}
.th-fb.good{color:var(--green);}
.th-hintline{color:var(--hp);font-style:italic;margin-top:6px;}
.th-rule{margin:2px 0;}
.th-rule.unread{color:var(--muted);}
.th-rule small{color:var(--muted);}
.th-lock{display:flex;gap:10px;justify-content:center;margin:6px 0;}
.th-sym{width:64px;height:64px;cursor:pointer;background:#1d1c1a;display:flex;align-items:center;justify-content:center;
  border:2px solid;border-color:var(--edge-lo) var(--edge-hi) var(--edge-hi) var(--edge-lo);}
.th-sym:hover{background:#2b2a27;}
.th-sym canvas{image-rendering:pixelated;}
.th-ledger{font-family:Georgia,serif;color:#e6d9b0;}
.th-ledger table{width:100%;border-collapse:collapse;font-size:12px;}
.th-ledger td+td{text-align:right;}
.th-ledger .note{margin-top:6px;font-style:italic;color:#c9b27a;}
.th-bookmark{text-align:center;font-family:"Courier New",monospace;font-size:14px;color:#f2e6c0;letter-spacing:2px;margin-bottom:8px;}
.th-book{display:grid;grid-template-columns:1fr 1fr;background:#e9dcb8;color:#3a2a18;font-family:Georgia,serif;font-size:13px;
  border:3px solid #6b3f1d;box-shadow:inset 0 0 18px rgba(80,50,20,.35);}
.th-book .pg{padding:14px 16px;min-height:190px;}
.th-book .pg+.pg{border-left:2px solid #c9b586;}
.th-book h4{font-size:13px;margin:0 0 8px;}
.th-book ol{padding-left:18px;margin:0;font-size:12.5px;}
.th-book li{margin:2px 0;}
.th-book li::marker{font-size:10px;color:#8a7650;}
.th-book .aside{font-family:Verdana,sans-serif;font-size:11px;margin-top:8px;}
.th-book input.th-txt{background:#fff;color:#3a2a18;text-transform:uppercase;text-align:center;font-size:14px;}
.th-receipt{background:#f6f3ea;color:#222;font-family:"Courier New",monospace;font-size:12px;padding:10px 12px;max-width:230px;margin:4px auto 0;box-shadow:0 2px 6px rgba(0,0,0,.5);}
.th-receipt .c{text-align:center;}
.th-receipt hr{border:none;border-top:1px dashed #777;margin:6px 0;}
.th-receipt mark{background:#ffe58a;}
.th-mapgrid{display:grid;grid-template-columns:repeat(2,110px);gap:2px;justify-content:center;margin:6px 0;}
.th-mappiece{width:110px;height:80px;cursor:pointer;transition:transform .25s;background:#1d1c1a;}
.th-mappiece.missing{cursor:default;display:flex;align-items:center;justify-content:center;color:var(--muted);font-size:11px;border:1px dashed #555;}
.th-mappiece.by{outline:2px solid var(--c);outline-offset:-2px;}
.th-asks{position:absolute;z-index:6;top:8px;right:8px;display:flex;flex-direction:column;gap:6px;width:270px;}
.th-ask{background:var(--stone);padding:8px;border:2px solid;border-color:var(--edge-hi) var(--edge-lo) var(--edge-lo) var(--edge-hi);box-shadow:0 4px 16px rgba(0,0,0,.6);}
.th-ask p{margin:0 0 6px;}
.th-ask b{color:#ffa0e0;}
.th-ask .row{display:flex;gap:4px;justify-content:flex-end;margin-top:6px;}
.th .th-ch[data-c]{cursor:pointer;}
.th .th-ch[data-c]:hover .th-label{color:#fff;}
.th-ch .ask{color:#ffa0e0;font-size:10px;display:block;}
`;

  const WRONG = {
    barrels: "The lock does not budge.",
    jars: "Drey counts again… that is not it.",
    book: "The little lock stays shut.",
    map: "The path does not join up yet.",
  };

  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  window.TREEHUT_PUZZLES = { create };

  // api: { s, R, A, view, send, state, myUid, nameOf, look, logLine, floatOver, floatAt }
  function create(api) {
    const { s, R, A, view, send } = api;
    const S = () => api.state();
    const who = (uid) => { const n = api.nameOf(uid); return n === "You" ? "you" : n; };

    const style = document.createElement("style");
    style.textContent = CSS;
    document.head.appendChild(style);
    const asksEl = document.createElement("div");
    asksEl.className = "th-asks";
    view.appendChild(asksEl);
    s.cleanups.push(() => { style.remove(); stopDrag(); });

    let win = null;              // { cid, el, key, fb }
    let lock = ["acorn", "acorn", "acorn"];
    let seen = null;             // what update() has already announced
    let shownRoom = -1;

    // ---------------------------------------------------------------- windows
    const WINDOWS = { barrels: barrelsWin, jars: jarsWin, book: bookWin, map: mapWin };

    function open(cid) {
      const st = S();
      if (!st || st.over || !WINDOWS[cid] || R.CHALLENGES[cid].room !== st.room) return false;
      if (win && win.cid === cid) return true;
      close();
      const el = document.createElement("div");
      el.className = "th-win";
      el.innerHTML = `<div class="th-ptitle"><span data-w="title"></span><span class="x" title="Close">✕</span></div><div class="th-wbody" data-w="body"></div><div class="th-wact" data-w="act"></div>`;
      el.querySelector(".x").onclick = close;
      el.querySelector(".th-ptitle").onmousedown = (e) => startDrag(e, el);
      view.appendChild(el);
      win = { cid, el, key: "", fb: null };
      paint(true);
      el.style.left = Math.max(8, (view.clientWidth - el.offsetWidth) / 2) + "px";
      el.style.top = Math.max(6, (view.clientHeight - el.offsetHeight) / 2 - 20) + "px";
      if (cid === "book" && !st.solved.book) api.logLine("ev", "You open the Bookshop ARK shopping bag.", false);
      return true;
    }

    function close() {
      if (!win) return;
      win.el.remove();
      win = null;
    }

    // What a window shows, so it only redraws when that changes.
    function keyOf(cid, st) {
      const k = [st.solved[cid] || "", JSON.stringify(st.hints[cid] || null), st.hintAsks[cid] || ""];
      if (cid === "barrels") k.push(JSON.stringify(st.readRules));
      if (cid === "map") k.push(JSON.stringify(st.mapPieces), st.mapTurns.join());
      k.push(st.players.map((p) => p.name).join());
      return k.join("|");
    }

    function paint(force) {
      const st = S();
      if (!win || !st) return;
      const key = keyOf(win.cid, st);
      if (!force && key === win.key) return;
      win.key = key;
      if (st.solved[win.cid]) win.fb = null;
      const body = win.el.querySelector('[data-w="body"]');
      const input = body.querySelector("input");
      const kept = input ? { v: input.value, focus: document.activeElement === input } : null;

      const w = WINDOWS[win.cid](st);
      win.el.classList.toggle("wide", !!w.wide);
      win.el.querySelector('[data-w="title"]').textContent = w.title;
      body.innerHTML = w.html + solvedHTML(win.cid, st) + hintHTML(win.cid, st) + '<div class="th-fb" data-w="fb"></div>';
      const act = win.el.querySelector('[data-w="act"]');
      act.innerHTML = "";
      for (const a of [askButton(win.cid, st)].concat(w.actions)) {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "th-btn" + (a.primary ? " primary" : "");
        b.textContent = a.label;
        b.disabled = !!a.disabled;
        b.onclick = a.fn;
        act.appendChild(b);
      }
      const inp = body.querySelector("input");
      if (inp && kept && !inp.disabled) { inp.value = kept.v; if (kept.focus) inp.focus(); }
      if (w.mount) w.mount(body);
      showFb();
    }

    function setFb(text, cls) { if (win) { win.fb = { text, cls }; showFb(); } }
    function showFb() {
      const el = win && win.el.querySelector('[data-w="fb"]');
      if (!el) return;
      el.className = "th-fb" + (win.fb ? " " + win.fb.cls : "");
      el.textContent = win.fb ? win.fb.text : "";
    }

    function solvedHTML(cid, st) {
      const by = st.solved[cid];
      return by ? `<div class="th-fb good">Solved by ${esc(who(by))}.</div>` : "";
    }
    function hintHTML(cid, st) {
      const h = st.hints[cid];
      return h ? `<div class="th-hintline">${esc(api.nameOf(h.by))} (hint): ${esc(h.text)}</div>` : "";
    }
    function askButton(cid, st) {
      const asked = st.hintAsks[cid];
      const label = st.hints[cid] ? "Hint given"
        : asked === api.myUid() ? "Waiting for a hint…"
        : asked ? `${api.nameOf(asked)} asked for a hint`
        : "Ask party for a hint";
      return { label, disabled: !!(st.hints[cid] || asked || st.solved[cid]), fn: () => send("ask-hint", { challenge: cid }) };
    }

    function answer(cid, value) {
      const st = S();
      if (!st || st.solved[cid]) return;
      setFb("", "");
      send("answer", { challenge: cid, value });
    }

    // ---- the barrel lock: three carved rules, three symbol slots
    function barrelsWin(st) {
      const solved = !!st.solved.barrels;
      const rules = [0, 1, 2].map((i) => {
        const by = st.readRules[i];
        const o = R.ROOMS[0].objects.find((x) => x.rule === i);
        return by === undefined
          ? `<div class="th-rule unread">${i + 1}. Not read yet. Inspect the barrel.</div>`
          : `<div class="th-rule">${i + 1}. ${esc(o.look.replace("Carved on the barrel: ", ""))} <small>(${esc(api.nameOf(by))})</small></div>`;
      }).join("");
      return {
        title: "Barrel lock on the stair door",
        html: `<p>Set three different symbols. Each barrel in the pantry has one rule carved into it.</p>
          <div class="th-inset" style="margin-bottom:8px">${rules}</div>
          <div class="th-lock">${lock.map((_, i) => `<div class="th-sym" data-i="${i}" title="Click to change"><canvas width="48" height="48"></canvas></div>`).join("")}</div>
          <p style="text-align:center;color:var(--muted);font-size:11px">Click a slot to change its symbol. Symbols: ${R.SYMBOLS.join(", ")}.</p>`,
        actions: [{ label: "Try the lock", primary: true, disabled: solved, fn: () => answer("barrels", lock.slice()) }],
        mount(body) {
          body.querySelectorAll(".th-sym").forEach((d) => {
            const i = +d.dataset.i, c = d.querySelector("canvas").getContext("2d");
            const draw = () => { c.clearRect(0, 0, 48, 48); A.drawSymbol(c, lock[i], 6, 6, 3); };
            draw();
            d.onclick = () => {
              if (S().solved.barrels) return;
              lock[i] = R.SYMBOLS[(R.SYMBOLS.indexOf(lock[i]) + 1) % R.SYMBOLS.length];
              draw();
            };
          });
        },
      };
    }

    // ---- the pantry ledger: the table, the margin note and a number
    function jarsWin(st) {
      const solved = !!st.solved.jars;
      const rows = R.LEDGER.rows.map(([a, b]) => `<tr><td>${esc(a)}</td><td>${esc(b)}</td></tr>`).join("");
      const go = () => {
        const v = win && win.el.querySelector("input");
        if (v && v.value.trim()) answer("jars", v.value.trim());
      };
      return {
        title: "Drey's pantry ledger",
        html: `<div class="th-inset th-ledger"><table>${rows}</table><div class="note">${esc(R.LEDGER.note)}</div></div>
          <p style="margin-top:8px">Compare the ledger with the full jars on the shelves. How many full jars did the thief take?</p>
          <input class="th-txt" placeholder="Number of jars" inputmode="numeric" maxlength="4" ${solved ? "disabled" : ""}>`,
        actions: [{ label: "Answer", primary: true, disabled: solved, fn: go }],
        mount(body) { const i = body.querySelector("input"); if (i) i.onkeydown = (e) => { if (e.key === "Enter") go(); }; },
      };
    }

    // ---- the Bookshop ARK bag: pages 14 and 15, the bookmark and a word lock
    function bookWin(st) {
      const B = R.BOOK, solved = !!st.solved.book;
      const page = (p) => `<h4>${p.page} · ${esc(p.heading)}</h4><ol>${p.lines.map((l) => `<li>${esc(l)}</li>`).join("")}</ol>`;
      const receipt = `<div class="th-receipt"><div class="c"><b>BOOKSHOP ARK</b><br>Back alley branch</div><hr>
          1 x Collector's Guide to<br>&nbsp;&nbsp;&nbsp;&nbsp;Precious Nuts ... 349,-<br>
          <mark>STAFF DISCOUNT -30%</mark> .. -105,-<hr>
          Card: <mark>ARK STAFF ****17</mark><br>Time: <mark>last night 23:48</mark><hr>
          <div class="c">Thank you, come again!</div></div>
          <p class="aside">The receipt was in the locked pouch.</p>`;
      const go = () => {
        const v = win && win.el.querySelector("input");
        if (v && v.value.trim()) answer("book", v.value.trim().toUpperCase());
      };
      return {
        title: "Bookshop ARK shopping bag",
        wide: true,
        html: `<p>Inside the bag is a new book: <b>"${esc(B.title)}"</b>. A bookmark sticks out, with four groups of numbers written on it.</p>
          <div class="th-inset th-bookmark">${B.bookmark.map((g) => g.join("·")).join(" &nbsp; ")}</div>
          <div class="th-book">
            <div class="pg">${page(B.pages[0])}</div>
            <div class="pg">${solved ? receipt : page(B.pages[1]) +
              `<p class="aside">A pouch in the back cover has a ${B.lockLength}-letter word lock.</p>
               <input class="th-txt" placeholder="${"_".repeat(B.lockLength)}" maxlength="${B.lockLength}" autocomplete="off">`}</div>
          </div>`,
        actions: [solved ? { label: "Close", primary: true, fn: close } : { label: "Open the lock", primary: true, fn: go }],
        mount(body) { const i = body.querySelector("input"); if (i) i.onkeydown = (e) => { if (e.key === "Enter") go(); }; },
      };
    }

    // ---- the torn map: the pieces found so far, click to turn
    function mapWin(st) {
      const have = st.mapPieces, n = Object.keys(have).length, all = n === R.MAP_PIECES, solved = !!st.solved.map;
      const pieces = [];
      for (let i = 0; i < R.MAP_PIECES; i++) {
        const by = have[i] !== undefined && st.players.find((p) => p.uid === have[i]);
        pieces.push(have[i] !== undefined
          ? `<canvas class="th-mappiece${by ? " by" : ""}" data-i="${i}" width="110" height="80" title="Found by ${esc(api.nameOf(have[i]))}. Click to turn."
              style="--c:${by ? by.color : "#888"};transform:${turn(solved ? 0 : st.mapTurns[i])}"></canvas>`
          : '<div class="th-mappiece missing">missing</div>');
      }
      return {
        title: "Torn map on the desk",
        html: `<p>${solved ? "The pieces fit together." : all ? "Turn each piece until the red path joins up."
            : `Find all ${R.MAP_PIECES} pieces of the torn map first. The party has ${n} of ${R.MAP_PIECES}.`}</p>
          <div class="th-mapgrid">${pieces.join("")}</div>`,
        actions: [{ label: "Done", primary: true, disabled: !all || solved, fn: () => answer("map") }],
        mount(body) {
          body.querySelectorAll("canvas.th-mappiece").forEach((cv) => {
            const i = +cv.dataset.i;
            paintMapPiece(cv.getContext("2d"), i);
            cv.onclick = () => { if (!S().solved.map) send("rotate-piece", { piece: i }); };
          });
        },
      };
    }

    // a piece turned on its side is shrunk to stay inside its own cell
    function turn(deg) { return `rotate(${deg}deg)` + (deg % 180 ? " scale(0.727)" : ""); }

    function paintMapPiece(c, i) {
      const ox = (i % 2) * 110, oy = Math.floor(i / 2) * 80;
      c.fillStyle = "#e4cf98"; c.fillRect(0, 0, 110, 80);
      c.save(); c.translate(-ox, -oy);
      // the whole map is 220x160
      c.fillStyle = "#8bb06a"; c.beginPath(); c.arc(40, 40, 28, 0, 7); c.fill();
      c.fillStyle = "#6b411d"; c.fillRect(34, 26, 12, 26); c.fillStyle = "#3f7a2a"; c.beginPath(); c.arc(40, 24, 16, 0, 7); c.fill();
      c.fillStyle = "#7fb9e6"; c.fillRect(0, 96, 220, 12);
      c.fillStyle = "#9a7a4a"; c.fillRect(150, 112, 50, 34); c.fillStyle = "#5a3818"; c.fillRect(146, 104, 58, 10);
      c.fillStyle = "#1b1b1b"; c.beginPath(); c.arc(175, 128, 9, 0, 7); c.fill();
      c.fillStyle = "#fff"; c.font = "bold 7px Verdana"; c.fillText("ARK", 168, 131);
      c.strokeStyle = "#b0281c"; c.lineWidth = 3; c.setLineDash([6, 4]);
      c.beginPath(); c.moveTo(48, 52); c.bezierCurveTo(110, 60, 70, 120, 120, 120); c.lineTo(150, 128); c.stroke();
      c.setLineDash([]);
      c.fillStyle = "#3a2a18"; c.font = "bold 9px Georgia"; c.fillText("Drey's treehut", 12, 80); c.fillText("X", 140, 130);
      c.restore();
      c.strokeStyle = "#a88a52"; c.lineWidth = 2; c.strokeRect(1, 1, 108, 78);
    }

    // ---------------------------------------------------------------- dragging
    let drag = null;
    function startDrag(e, el) {
      if (e.button !== 0 || e.target.classList.contains("x")) return;
      e.preventDefault();
      const ox = e.clientX - el.offsetLeft, oy = e.clientY - el.offsetTop;
      const mv = (ev) => {
        const x = Math.min(view.clientWidth - 40, Math.max(40 - el.offsetWidth, ev.clientX - ox));
        const y = Math.min(view.clientHeight - 24, Math.max(0, ev.clientY - oy));
        el.style.left = x + "px"; el.style.top = y + "px";
      };
      const up = () => stopDrag();
      drag = { mv, up };
      window.addEventListener("mousemove", mv);
      window.addEventListener("mouseup", up);
    }
    function stopDrag() {
      if (!drag) return;
      window.removeEventListener("mousemove", drag.mv);
      window.removeEventListener("mouseup", drag.up);
      drag = null;
    }
    s.on(document, "keydown", (e) => { if (e.key === "Escape" && win) close(); });

    // ---------------------------------------------------------------- hint prompts
    function paintAsks(st) {
      const me = api.myUid();
      const pending = Object.entries(st.hintAsks).filter(([cid, uid]) => uid !== me && !st.solved[cid] && !st.hints[cid]);
      const want = new Set(pending.map(([cid]) => cid));
      asksEl.querySelectorAll(".th-ask").forEach((el) => { if (!want.has(el.dataset.c)) el.remove(); });
      for (const [cid, uid] of pending) {
        if (asksEl.querySelector(`.th-ask[data-c="${cid}"]`)) continue;
        const c = R.CHALLENGES[cid];
        const el = document.createElement("div");
        el.className = "th-ask";
        el.dataset.c = cid;
        el.innerHTML = `<p><b>${esc(api.nameOf(uid))}</b> asks the party for a hint on "${esc(c.name)}".</p>
          <input class="th-txt" maxlength="${R.MAX_CHAT}" value="${esc(c.hint)}" title="Your hint; change it if you like">
          <div class="row"><button type="button" class="th-btn" data-a="look">Look</button><button type="button" class="th-btn primary" data-a="give">Give hint</button></div>`;
        const give = () => send("give-hint", { challenge: cid, text: el.querySelector("input").value });
        el.querySelector('[data-a="give"]').onclick = give;
        el.querySelector('[data-a="look"]').onclick = () => open(cid);
        el.querySelector("input").onkeydown = (e) => { if (e.key === "Enter") give(); };
        asksEl.appendChild(el);
      }
    }

    // ---------------------------------------------------------------- news
    function update(st) {
      const first = !seen;
      if (first) seen = { asks: new Set(), hints: new Set(), door: st.doorOpen, room: st.room };
      if (st.room !== shownRoom) {
        shownRoom = st.room;
        close();
        lock = ["acorn", "acorn", "acorn"];
        seen.door = st.doorOpen;
        seen.asks.clear();
      }
      if (st.over) close();

      for (const [cid, uid] of Object.entries(st.hintAsks)) {
        const k = cid + uid;
        if (seen.asks.has(k)) continue;
        seen.asks.add(k);
        if (!first) api.logLine("party", `${api.nameOf(uid)} asked the party for a hint on "${R.CHALLENGES[cid].name}".`, true);
      }
      for (const [cid, h] of Object.entries(st.hints)) {
        if (seen.hints.has(cid)) continue;
        seen.hints.add(cid);
        if (!first) {
          api.logLine("party", `${api.nameOf(h.by)} (hint on "${R.CHALLENGES[cid].name}"): ${h.text}`, true);
          api.floatOver(h.by, "+" + R.POINTS.helping + " helping", "#7be07b");
        }
      }
      if (st.doorOpen && !seen.door) {
        const next = R.ROOMS[st.room + 1];
        if (next) api.logLine("ev", `*click* The door to ${next.name} is open! Walk through it.`, true);
        const d = R.doorTile(st.room);
        if (d) api.floatAt(d[0], d[1], "Open!", "#4ee04e");
      }
      seen.door = st.doorOpen;

      paint(false);
      paintAsks(st);
    }

    function wrong(cid) {
      const line = WRONG[cid] || "That is not it.";
      if (win && win.cid === cid) setFb(line, "bad");
      else api.look(line);
    }

    return { open, close, update, wrong };
  }
})();
