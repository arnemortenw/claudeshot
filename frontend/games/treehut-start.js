// Drey's Treehut - the start screen (approved design v4). An overlay on the room
// view: page 1 is the stolen golden hazelnut, Drey's plea, the case facts and
// who is playing; three onboarding pages follow (look around, solve it together,
// everyone's help counts), with Skip, Back, Next and dots.
//
// Enter the treehut or Skip sends "enter". The server starts the 15-minute clock
// when every player has entered, or 60 seconds after the game starts.
//
// Loaded after treehut-art.js. treehut-client.js mounts it:
//   const start = TREEHUT_START.mount(viewEl, send)
//   start.update(state, me)   on every treehut-state
//   start.destroy()           on cleanup
(function () {
  "use strict";

  const CSS = `
.th-onb{position:absolute;inset:0;z-index:20;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.72);}
.th-onb-card{width:min(680px,94%);max-height:94%;overflow:auto;background:var(--stone);
  border:2px solid;border-color:var(--edge-hi) var(--edge-lo) var(--edge-lo) var(--edge-hi);}
.th-onb-card .th-ptitle{font-size:13px;padding:5px 10px;}
.th-onb h3{margin:0;font-family:inherit;letter-spacing:0;}
.th-onb-body{padding:16px 18px 12px;min-height:330px;display:flex;flex-direction:column;}
.th-onb-step{display:none;flex:1;}
.th-onb-step.on{display:block;animation:thOnbIn .25s ease-out;}
@keyframes thOnbIn{from{opacity:0;transform:translateX(12px)}to{opacity:1;transform:none}}
.th-onb-hero{display:grid;grid-template-columns:220px 1fr;gap:18px;align-items:center;}
.th-nut{position:relative;height:230px;display:flex;align-items:center;justify-content:center;overflow:hidden;
  background:radial-gradient(circle at 50% 45%,#3a2f1a 0%,#1d1c1a 70%);
  border:1px solid;border-color:var(--edge-lo) var(--edge-hi) var(--edge-hi) var(--edge-lo);}
.th-nut::before{content:"";position:absolute;width:170px;height:170px;border-radius:50%;top:18px;
  background:radial-gradient(circle,rgba(255,214,90,.45) 0%,rgba(255,214,90,0) 65%);animation:thGlow 2.4s ease-in-out infinite;}
@keyframes thGlow{50%{transform:scale(1.12);opacity:.6}}
.th-nut canvas{position:relative;image-rendering:pixelated;}
.th-nut-stamp{position:absolute;top:14px;right:10px;transform:rotate(10deg);border:2px solid #d0402c;color:var(--red);
  font-weight:bold;font-size:14px;letter-spacing:3px;padding:2px 10px;background:rgba(20,10,8,.55);text-shadow:1px 1px 0 #000;}
.th-nut-caption{position:absolute;bottom:6px;left:0;right:0;text-align:center;font-size:10.5px;color:var(--muted);}
.th-onb-hero h3{color:var(--gold);font-size:17px;text-shadow:1px 1px 0 #000;margin-bottom:8px;}
.th-onb-talk{display:flex;gap:12px;align-items:flex-start;margin-bottom:6px;}
.th-onb-talk canvas{flex:none;image-rendering:pixelated;background:#1d1c1a;border:1px solid var(--edge-lo);}
.th-onb-talk .say{color:var(--npc);font-size:13px;}
.th-onb-facts{margin-top:10px;font-size:11px;color:var(--muted);}
.th-onb-facts b{color:#e8e2cc;font-weight:normal;}
.th-onb-who{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;}
.th-onb-who span{display:flex;align-items:center;gap:6px;padding:4px 8px;background:#1d1c1a;font-size:11px;}
.th-onb-who i{width:10px;height:10px;border:1px solid #000;}
.th-onb-step h3.t{color:var(--gold);font-size:15px;text-shadow:1px 1px 0 #000;margin-bottom:10px;}
.th-tips{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;}
.th-tipc{background:#1d1c1a;padding:10px;font-size:11.5px;color:var(--muted);}
.th-tipc b{display:block;color:#e8e2cc;font-size:12.5px;margin:6px 0 3px;}
.th-demo{height:72px;display:flex;align-items:center;justify-content:center;gap:6px;position:relative;overflow:hidden;
  background:#2a2622;border:1px solid var(--edge-lo);}
.th-demo canvas{image-rendering:pixelated;}
.th-demo.chat{flex-direction:column;align-items:flex-start;padding:6px 8px;font-size:10.5px;gap:3px;}
.th-demo .say-green{color:var(--green);font-weight:bold;font-size:10.5px;text-shadow:1px 1px 0 #000;position:absolute;bottom:4px;left:0;right:0;text-align:center;}
.th-demo .pts{display:flex;flex-direction:column;gap:3px;width:85%;font-size:10px;}
.th-demo .pts span{display:flex;justify-content:space-between;}
.th-demo .pts b{display:inline;margin:0;font-size:10.5px;color:inherit;}
.th-demo .th-timebar{width:80%;}
.th-onb-foot{display:flex;align-items:center;gap:8px;margin-top:14px;}
.th-onb-dots{display:flex;gap:5px;margin-right:auto;}
.th-onb-dots i{width:8px;height:8px;background:#1d1c1a;border:1px solid var(--edge-hi);cursor:pointer;}
.th-onb-dots i.on{background:var(--gold);border-color:var(--gold);}
.th-onb-wait{color:var(--muted);font-size:11px;}
.th-onb-foot .th-btn{white-space:nowrap;flex:none;}
.th-btn.primary{color:var(--gold);font-weight:bold;}
.th-btn:disabled{opacity:.45;cursor:default;}
`;

  const LABELS = ["How to play →", "Next →", "Next →", "Enter the treehut"];

  function esc(t) { return String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }

  function html(R) {
    const P = R.POINTS;
    return `<div class="th-onb-card"><div class="th-ptitle"><span style="color:#e6dfc8">The case of the missing golden hazelnut</span><span>2 to ${R.MAX_PLAYERS} players · ${R.GAME_MS / 60000} minutes</span></div>
<div class="th-onb-body">
  <div class="th-onb-step on">
    <div class="th-onb-hero">
      <div class="th-nut"><canvas data-k="nut" width="160" height="200"></canvas><span class="th-nut-stamp">STOLEN</span>
        <span class="th-nut-caption">Drey's golden hazelnut, last seen in the vault</span></div>
      <div>
        <h3>Drey's golden hazelnut is gone</h3>
        <div class="th-onb-talk"><canvas data-k="drey" width="48" height="48"></canvas>
          <div class="say">Drey: "Friends! Last night someone climbed into my treehut and took it from the vault. One of only three in the world. Please find out who did it, before the trail goes cold!"</div></div>
        <div class="th-onb-facts">Taken <b>last night, before midnight</b> · Way in: <b>a window</b> · Suspects: <b>${R.SUSPECTS.length} neighbours</b></div>
        <div class="th-onb-who" data-el="who"></div>
      </div>
    </div>
  </div>
  <div class="th-onb-step">
    <h3 class="t">1 · Look around</h3>
    <div class="th-tips">
      <div class="th-tipc"><div class="th-demo"><canvas data-k="walk" width="96" height="64"></canvas></div><b>Click to walk</b>Click the floor to walk there. Arrow keys or WASD work too.</div>
      <div class="th-tipc"><div class="th-demo"><canvas data-k="look" width="64" height="64"></canvas><span class="say-green">You see a barrel…</span></div><b>Click things to inspect</b>What you see shows in green, and in the log below.</div>
      <div class="th-tipc"><div class="th-demo"><canvas data-k="sparkle" width="64" height="64"></canvas></div><b>Clues sparkle</b>Pick them up. They go into the shared clue bag on the right.</div>
    </div>
  </div>
  <div class="th-onb-step">
    <h3 class="t">2 · Solve it together</h3>
    <div class="th-tips">
      <div class="th-tipc"><div class="th-demo"><canvas data-k="door" width="64" height="64"></canvas></div><b>${R.ROOMS.length} rooms, locked doors</b>Solve every challenge in a room to open the next one.</div>
      <div class="th-tipc"><div class="th-demo chat" data-el="chat"></div><b>Talk and share hints</b>Some clues are split up, so you'll need what the others found. Ask for hints, give them.</div>
      <div class="th-tipc"><div class="th-demo"><canvas data-k="suspects" width="140" height="48"></canvas></div><b>Name the thief</b>In the last room, rule suspects out and vote. A wrong name ends the case.</div>
    </div>
  </div>
  <div class="th-onb-step">
    <h3 class="t">3 · Everyone's help counts</h3>
    <div class="th-tips">
      <div class="th-tipc"><div class="th-demo"><div class="pts"><span style="color:var(--ch)">Solve a challenge <b>+${P.challenge}</b></span><span style="color:var(--cl)">Find a clue <b>+${P.clue}</b></span><span style="color:var(--hp)">Help someone <b>+${P.helping}</b></span></div></div><b>Your score</b>You score for what you solve, what you find and how you help others.</div>
      <div class="th-tipc"><div class="th-demo"><div class="th-timebar"><i style="width:62%"></i></div></div><b>${R.GAME_MS / 60000} minutes</b>When time runs out, the thief gets away. Scores still count.</div>
      <div class="th-tipc"><div class="th-demo"><canvas data-k="smallnut" width="48" height="48"></canvas></div><b>Bring it home</b>Name the right thief and Drey gets his hazelnut back.</div>
    </div>
  </div>
  <div class="th-onb-foot">
    <div class="th-onb-dots">${[0, 1, 2, 3].map((i) => `<i data-i="${i}" class="${i ? "" : "on"}"></i>`).join("")}</div>
    <span class="th-onb-wait" data-el="wait"></span>
    <button class="th-btn" data-el="skip">Skip</button>
    <button class="th-btn" data-el="back" disabled>Back</button>
    <button class="th-btn primary" data-el="next">${LABELS[0]}</button>
  </div>
</div></div>`;
  }

  function draw(el, R, A) {
    const g = el.getContext("2d"), k = el.dataset.k;
    if (k === "nut") {
      // the hazelnut on its velvet cushion
      g.fillStyle = "#4a1a5a"; g.fillRect(20, 150, 120, 26); g.fillStyle = "#6a2a7a"; g.fillRect(26, 144, 108, 18);
      g.fillStyle = "#c99a3a"; g.fillRect(20, 172, 120, 3); [24, 132].forEach((x) => g.fillRect(x, 170, 6, 10));
      A.drawSprite(g, A.NUT, A.PAL_NUT, 24, 30, 7, false);
    }
    if (k === "drey") A.drawSprite(g, A.SQUIRREL, A.PAL_DREY, 0, 0, 3, true, "#8a6a2a");
    if (k === "walk") {
      A.drawFloor(g, 0, 16, 1); A.drawFloor(g, 32, 16, 2); A.drawFloor(g, 64, 16, 3);
      A.drawSprite(g, A.SQUIRREL, A.PAL_SQ, 2, 16, 2, true, "#f0c040");
      g.strokeStyle = "rgba(255,255,255,.8)"; g.strokeRect(64.5, 16.5, 31, 31);
      g.fillStyle = "#fff"; g.fillRect(40, 31, 16, 2); g.fillRect(54, 29, 2, 6);
    }
    if (k === "look") { A.drawFloor(g, 16, 16, 4); A.OBJ_ART.barrel(g, 16, 16, { sym: "acorn", dots: 0 }); }
    if (k === "sparkle") {
      A.drawFloor(g, 16, 16, 5); A.OBJ_ART.prints(g, 16, 16);
      g.fillStyle = "#fff8c0"; g.fillRect(40, 20, 3, 3); g.fillRect(38, 21, 7, 1); g.fillRect(41, 18, 1, 7);
    }
    if (k === "door") A.drawDoor(g, 16, 16, "locked");
    if (k === "suspects") R.SUSPECTS.forEach((s, i) => { const a = A.SUSPECT_ART[s.id]; if (a) A.drawSprite(g, a.grid, a.pal, i * 36, 8, 2, false, "#444"); });
    if (k === "smallnut") A.drawSprite(g, A.NUT, A.PAL_NUT, 0, 0, 3, false);
  }

  function clock(ms) {
    const s = Math.ceil(ms / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  }

  function mount(view, send) {
    const R = window.TREEHUT_RULES, A = window.TREEHUT_ART;
    const style = document.createElement("style");
    style.textContent = CSS;
    document.head.appendChild(style);

    let d = null, step = 0, shown = false;
    const $ = {};

    function open() {
      d = document.createElement("div");
      d.className = "th-onb";
      d.innerHTML = html(R);
      view.appendChild(d);
      d.querySelectorAll("[data-el]").forEach((el) => { $[el.dataset.el] = el; });
      d.querySelectorAll("canvas[data-k]").forEach((el) => draw(el, R, A));
      $.next.onclick = () => (step === 3 ? enter() : show(step + 1));
      $.back.onclick = () => show(Math.max(0, step - 1));
      $.skip.onclick = enter;
      d.querySelectorAll(".th-onb-dots i").forEach((el) => { el.onclick = () => show(+el.dataset.i); });
      window.addEventListener("keydown", onKey, true);
    }

    function show(i) {
      step = i;
      d.querySelectorAll(".th-onb-step").forEach((el, j) => el.classList.toggle("on", j === i));
      d.querySelectorAll(".th-onb-dots i").forEach((el, j) => el.classList.toggle("on", j === i));
      $.back.disabled = i === 0;
      $.skip.style.display = i === 3 ? "none" : "";
      $.next.textContent = LABELS[i];
    }

    function close() {
      window.removeEventListener("keydown", onKey, true);
      if (d) d.remove();
      d = null;
    }

    function enter() {
      send("enter");
      close();
    }

    // While the briefing is open, the arrow keys turn its pages instead of walking.
    function onKey(e) {
      const tag = e.target && e.target.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      const k = e.key;
      if (k === "ArrowRight" || k === "Enter") { if (step === 3) enter(); else show(step + 1); }
      else if (k === "ArrowLeft") show(Math.max(0, step - 1));
      else if (k === "Escape") enter();
      else if (!/^[wasdWASD]$|^Arrow/.test(k)) return;
      e.preventDefault();
      e.stopImmediatePropagation();
    }

    function update(S, me) {
      if (!me) return;
      if (!shown) {
        shown = true;
        if (!me.entered && !S.over) open();
      }
      if (!d) return;
      if (S.over) return close();
      const here = S.players.filter((p) => p.here);
      $.who.innerHTML = here.map((p) => `<span><i style="background:${p.color}"></i>${esc(p.name)}${p.id === me.id ? " (you)" : ""}</span>`).join("");
      const mate = here.find((p) => p.id !== me.id);
      const mateName = esc(mate ? mate.name : "Mari");
      $.chat.innerHTML = `<span style="color:#ffa0e0">${mateName}: try the acorn first</span><span style="color:#e6e6e6">You: thanks!</span><span style="color:var(--hp)">+${R.POINTS.helping} helping for ${mateName}</span>`;
      const reading = here.filter((p) => !p.entered && p.id !== me.id).length;
      $.wait.textContent = !S.briefingLeftMs ? "The clock is running. Your party is in the treehut."
        : reading ? `${reading} other${reading === 1 ? " is" : "s are"} still reading. The clock starts when everyone is in, or in ${clock(S.briefingLeftMs)}.`
        : here.length > 1 ? `Everyone else is in. The clock starts when you enter, or in ${clock(S.briefingLeftMs)}.`
        : `The clock starts when you enter, or in ${clock(S.briefingLeftMs)}.`;
    }

    function destroy() { close(); style.remove(); }

    return { update, destroy, isOpen: () => !!d };
  }

  window.TREEHUT_START = { mount };
})();
