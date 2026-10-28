// Drey's Treehut - the case board and the end screens (approved design v4).
//
// The case board is the window the board in the Vault opens: the four suspects
// with their sprites, a shared "Rule out / undo" that says who ruled out, every
// vote as a player-coloured mark, "N of M have voted" and the no-majority line.
// It goes out as "rule-out" and "vote"; the server decides when most of the
// party still in the game names one suspect.
//
// The end screen is an overlay over the whole game frame when "treehut-over" comes in:
// Case solved, Wrong suspect or Time's up, then a ranked row per player with a
// challenges/clues/helping bar, the total, a title and what they did. After the
// end screen the server hands the totals to the platform, which opens
// results.html. The host's Play again uses the platform's "play-again".
//
// Loaded after treehut-art.js. treehut-client.js makes one:
//   const kase = TREEHUT_CASE.create(api)
//   kase.board(state, close)   the case board's window, for treehut-puzzles.js
//   kase.update(state)         on every treehut-state, for the console lines
//   kase.over(data)            on "treehut-over"
// api: { s, R, A, frame, send, myUid, nameOf, logLine, isHost }
(function () {
  "use strict";

  const REVEAL_MS = 1400;        // the room stays in view this long before the end screen
  const NOTES_SHOWN = 4;         // what each player did, before "+N more"

  const CSS = `
.th-suspects{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin:8px 0;}
.th-suspect{display:flex;gap:10px;align-items:center;padding:8px;background:#1d1c1a;cursor:pointer;border:2px solid transparent;position:relative;}
.th-suspect:hover{background:#2a2926;}
.th-suspect.picked{border-color:var(--gold);}
.th-suspect.out{opacity:.55;}
.th-suspect.out .nm{text-decoration:line-through;}
.th-suspect canvas{image-rendering:pixelated;flex:none;}
.th-suspect .nm{font-weight:bold;color:#f0e8cc;padding-right:40px;}
.th-suspect .ds{font-size:10.5px;color:var(--muted);}
.th-suspect .ro{display:inline-block;margin-top:4px;font-size:10.5px;background:#2b2a27;padding:2px 6px;color:var(--muted);cursor:pointer;}
.th-suspect .ro:hover{color:#fff;}
.th-suspect.out .ro{color:var(--cl);}
.th-suspect .votes{position:absolute;right:6px;top:6px;display:flex;gap:2px;}
.th-suspect .votes i{width:9px;height:9px;border:1px solid #000;}
.th-tally{color:var(--muted);}
.th-tally.stuck{color:var(--event);}
.th-end{position:absolute;inset:0;z-index:25;border-radius:4px;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.72);animation:thEndIn .4s ease-out;}
@keyframes thEndIn{from{opacity:0}to{opacity:1}}
.th-end-card{width:min(700px,94%);max-height:96%;overflow:auto;background:var(--stone);
  border:2px solid;border-color:var(--edge-hi) var(--edge-lo) var(--edge-lo) var(--edge-hi);}
.th-end-card .th-ptitle{font-size:13px;padding:5px 10px;}
.th-end-body{padding:14px 16px;}
.th-banner{text-align:center;margin-bottom:12px;}
.th-banner h2{color:var(--gold);font-size:20px;text-shadow:2px 2px 0 #000;margin:0 0 4px;font-family:inherit;letter-spacing:0;}
.th-banner.fail h2{color:var(--red);}
.th-banner p{color:var(--muted);margin:0;}
.th-reveal{display:flex;justify-content:center;align-items:flex-end;gap:6px;margin:6px 0 12px;}
.th-reveal canvas{image-rendering:pixelated;}
.th-reveal figure{margin:0;text-align:center;font-size:10px;color:var(--muted);}
.th-reveal figure.gone canvas{opacity:.35;}
.th-score-head{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px;}
.th-score-head b{color:#e8e2cc;}
.th-score-head .th-legend{margin:0;}
.th-score-row{display:grid;grid-template-columns:22px 130px 1fr 44px;gap:8px;align-items:center;padding:6px 4px;border-bottom:1px solid #2c2b28;}
.th-score-row .rk{color:var(--muted);font-weight:bold;text-align:right;}
.th-score-row .nm b{display:block;color:#e8e2cc;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.th-score-row .nm b i{display:inline-block;width:8px;height:8px;border:1px solid #000;margin-right:4px;}
.th-score-row .nm small{color:var(--muted);font-size:10px;}
.th-score-row .bar{height:14px;display:flex;background:#1a1918;}
.th-score-row .bar i{height:100%;display:block;}
.th-score-row .tot{font-weight:bold;color:#fff;text-align:right;font-size:13px;}
.th-score-row .detail{grid-column:3/5;font-size:10.5px;color:var(--muted);margin-top:-4px;}
.th-score-row .detail .sum{color:#cfc8b2;}
.th-score-row.me .nm b{color:var(--gold);}
.th-score-row.gone .nm b{color:var(--muted);}
.th-end-foot{display:flex;justify-content:flex-end;align-items:center;gap:8px;margin-top:12px;}
.th-end-foot .wait{margin-right:auto;color:var(--muted);font-size:11px;}
`;

  const KINDS = [["challenge", "ch", "Challenges"], ["clue", "cl", "Clues"], ["helping", "hp", "Helping"]];

  function esc(t) { return String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
  function fmt(ms) { const sec = Math.round(ms / 1000); return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`; }

  window.TREEHUT_CASE = { create };

  function create(api) {
    const { s, R, A, frame, send } = api;
    const who = (uid) => { const n = api.nameOf(uid); return n === "You" ? "you" : n; };
    const suspect = (id) => R.SUSPECTS.find((x) => x.id === id);

    const style = document.createElement("style");
    style.textContent = CSS;
    document.head.appendChild(style);
    let endEl = null;
    s.cleanups.push(() => { style.remove(); if (endEl) endEl.remove(); });

    function sprite(grid, pal, scale, flip) {
      const c = document.createElement("canvas");
      c.width = c.height = 16 * scale;
      A.drawSprite(c.getContext("2d"), grid, pal, 0, 0, scale, !!flip, "#444");
      return c;
    }
    function suspectSprite(id, scale) { const a = A.SUSPECT_ART[id]; return sprite(a.grid, a.pal, scale); }

    // ---------------------------------------------------------------- the case board
    function tally(st) {
      const here = st.players.filter((p) => p.here);
      const voted = here.filter((p) => st.votes[p.uid]);
      const counts = {};
      for (const p of voted) counts[st.votes[p.uid]] = (counts[st.votes[p.uid]] || 0) + 1;
      const top = Math.max(0, ...Object.values(counts));
      const need = Math.floor(here.length / 2) + 1;
      const stuck = here.length > 0 && voted.length === here.length && top < need;
      return { here: here.length, voted: voted.length, need, stuck };
    }

    function board(st, close) {
      const me = api.myUid();
      const t = tally(st);
      const cards = R.SUSPECTS.map((x) => {
        const out = st.ruledOut[x.id];
        const marks = st.players.filter((p) => p.here && st.votes[p.uid] === x.id)
          .map((p) => `<i style="background:${p.color}" title="${esc(p.name)}"></i>`).join("");
        return `<div class="th-suspect${st.votes[me] === x.id ? " picked" : ""}${out ? " out" : ""}" data-s="${x.id}" title="Vote for ${esc(x.name)}">` +
          `<span class="cv"></span><div><div class="nm">${esc(x.name)}</div><div class="ds">${esc(x.desc)}</div>` +
          `<span class="ro" data-ro="${x.id}">${out ? `Ruled out by ${esc(who(out))} · undo` : "Rule out"}</span></div>` +
          `<div class="votes">${marks}</div></div>`;
      }).join("");
      const line = t.stuck ? "No majority yet. Talk it over; you can change your vote."
        : `${t.voted} of ${t.here} have voted. ${t.need} votes for one suspect name the thief.`;
      return {
        title: "The case board: who stole the golden hazelnut?",
        wide: true,
        html: `<p>Use your clue bag to rule suspects out, then vote. When most of the party agrees, the group names the thief. A wrong name ends the case.</p>` +
          `<div class="th-suspects">${cards}</div><div class="th-tally${t.stuck ? " stuck" : ""}" data-w="tally">${esc(line)}</div>`,
        actions: [{ label: "Close", fn: close }],
        mount(body) {
          body.querySelectorAll(".th-suspect").forEach((el) => {
            const id = el.dataset.s;
            el.querySelector(".cv").appendChild(suspectSprite(id, 3));
            el.onclick = () => send("vote", { suspect: id });
            el.querySelector(".ro").onclick = (e) => { e.stopPropagation(); send("rule-out", { suspect: id }); };
          });
        },
      };
    }

    // ---------------------------------------------------------------- console news
    let seen = null;
    function update(st) {
      const first = !seen;
      if (first) seen = { votes: {}, ruledOut: {} };
      if (!first) {
        for (const [uid, sid] of Object.entries(st.votes)) {
          if (seen.votes[uid] === sid) continue;
          api.logLine("party", `${api.nameOf(uid)} voted for ${suspect(sid).name}.`, true);
        }
        for (const x of R.SUSPECTS) {
          const was = seen.ruledOut[x.id], now = st.ruledOut[x.id];
          if (was === now) continue;
          if (now) api.logLine("party", `${api.nameOf(now)} ruled out ${x.name}.`, true);
          else api.logLine("party", `${x.name} is back on the case board.`, true);
        }
      }
      seen.votes = { ...st.votes };
      seen.ruledOut = { ...st.ruledOut };
    }

    // ---------------------------------------------------------------- the end screen
    let shown = false;
    function over(data) {
      if (shown) return;
      shown = true;
      const at = performance.now();
      const reveal = data.outcome === "timeout" ? 0 : Math.min(REVEAL_MS, Math.max(0, data.endsIn - 2000));
      if (data.outcome === "solved") api.logLine("ev", "The party names the fox and his crew from the Bookshop ARK!", true);
      else if (data.outcome === "wrong") api.logLine("ev", `The party names ${suspect(data.accused).name}… and gets it wrong.`, true);
      s.later(() => showEnd(data, at), reveal);
    }

    function notesLine(notes) {
      const counted = [];
      for (const n of notes) {
        const c = counted.find((x) => x.text === n.text);
        if (c) c.n++;
        else counted.push({ text: n.text, n: 1 });
      }
      const shown = counted.slice(0, NOTES_SHOWN).map((c) => esc(c.text) + (c.n > 1 ? ` ×${c.n}` : ""));
      if (counted.length > NOTES_SHOWN) shown.push(`+${counted.length - NOTES_SHOWN} more`);
      return shown.join(" · ");
    }

    function showEnd(data, at) {
      const solved = data.outcome === "solved", wrong = data.outcome === "wrong";
      const named = wrong && suspect(data.accused);
      const me = api.myUid();
      const max = Math.max(1, ...data.players.map((p) => p.total));
      const head = solved ? "Case solved" : wrong ? "Wrong suspect" : "Time's up";
      const sub = solved ? `in ${fmt(data.elapsedMs)}` : `${data.solvedCount} of ${data.challengeCount} challenges solved`;
      const h2 = solved ? "Fridtjof Fox and his crew did it!" : wrong ? "An innocent neighbour was named…" : "The thief got away…";
      const story = solved
        ? "The prints ruled out the birds. The staff card ruled out everyone who does not work at the ARK. Only the fox was left. The grey hairs? From Bjørn's delivery sacks, which the crew borrowed to carry the hazelnut. Drey has it back."
        : wrong ? `The party named ${named.name}, who did not do it. The real thief slipped away while everyone argued. Drey is still missing his golden hazelnut.`
        : "The trail went cold before the party could name the thief. Drey is still missing his golden hazelnut.";

      const rows = data.players.map((p, i) => {
        const sums = KINDS.map(([k, , label]) => `${label} ${p[k]}`).join(" + ");
        return `<div class="th-score-row${p.uid === me ? " me" : ""}">` +
          `<span class="rk">${i + 1}</span>` +
          `<span class="nm"><b><i style="background:${p.color}"></i>${esc(p.name)}${p.uid === me ? " (you)" : ""}</b><small>${esc(p.title)}</small></span>` +
          `<span class="bar">${KINDS.map(([k, v, label]) => `<i style="width:${p[k] / max * 100}%;background:var(--${v})" title="${label}: ${p[k]}"></i>`).join("")}</span>` +
          `<span class="tot">${p.total}</span>` +
          `<span class="detail"><span class="sum">${sums} = ${p.total}</span>${p.notes.length ? " · " + notesLine(p.notes) : " · No points this time"}</span></div>`;
      }).join("");

      endEl = document.createElement("div");
      endEl.className = "th-end";
      endEl.innerHTML = `<div class="th-end-card"><div class="th-ptitle"><span data-e="head">${head}</span><span>${esc(sub)}</span></div>` +
        `<div class="th-end-body">` +
        `<div class="th-banner${solved ? "" : " fail"}"><h2>${esc(h2)}</h2><p>${esc(story)}</p></div>` +
        `<div class="th-reveal" data-e="reveal"></div>` +
        `<div class="th-score-head"><b>How much each of you helped</b>` +
        `<div class="th-legend">${KINDS.map(([, v, label]) => `<span style="--c:var(--${v})">${label}</span>`).join("")}</div></div>` +
        rows +
        `<div class="th-end-foot"><span class="wait" data-e="wait"></span>` +
        (api.isHost() ? `<button type="button" class="th-btn primary" data-e="again">Play again</button>` : "") +
        `</div></div></div>`;
      frame.appendChild(endEl);

      const rv = endEl.querySelector('[data-e="reveal"]');
      if (solved) {
        rv.appendChild(suspectSprite("fox", 4));
        rv.appendChild(sprite(A.WEASEL, A.PAL_WEASEL, 3));
        rv.appendChild(sprite(A.WEASEL, A.PAL_WEASEL, 3));
        const drey = sprite(A.SQUIRREL, A.PAL_DREY, 4, true);
        const g = drey.getContext("2d");
        A.drawSprite(g, A.NUT, A.PAL_NUT, 40, 28, 1.5, false);
        rv.appendChild(drey);
      } else {
        if (named) {
          const f = document.createElement("figure");
          f.appendChild(suspectSprite(named.id, 4));
          f.appendChild(Object.assign(document.createElement("figcaption"), { textContent: "Named, but innocent" }));
          rv.appendChild(f);
        }
        const f = document.createElement("figure");
        f.className = "gone";
        f.appendChild(suspectSprite("fox", 4));
        f.appendChild(Object.assign(document.createElement("figcaption"), { textContent: "Still out there" }));
        rv.appendChild(f);
      }

      const again = endEl.querySelector('[data-e="again"]');
      if (again) again.onclick = () => { again.disabled = true; s.socket.emit("play-again"); };

      const wait = endEl.querySelector('[data-e="wait"]');
      const tick = () => {
        if (s.disposed) return;
        const left = Math.max(0, data.endsIn - (performance.now() - at));
        wait.textContent = left > 0 ? `Results in ${Math.ceil(left / 1000)} s` + (api.isHost() ? "" : ". The host can start a new case.") : "Opening the results…";
        if (left > 0) s.later(tick, 250);
      };
      tick();
    }

    return { board, update, over };
  }
})();
