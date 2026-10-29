const saved = JSON.parse(sessionStorage.getItem("room") || "null");
const myName = sessionStorage.getItem("myName");

if (!saved || !myName) {
  window.location.href = "index.html";
}

const socket = io(BACKEND_URL, { transports: ["websocket"] });

socket.on("connect", () => {
  socket.emit("rejoin-room", { code: saved.code, name: myName });
});

socket.on("room-joined", (room) => {
  sessionStorage.setItem("room", JSON.stringify(room));
  sessionStorage.setItem("myId", socket.id);
  renderRoom(room);
});

socket.on("room-updated", (room) => {
  sessionStorage.setItem("room", JSON.stringify(room));
  renderRoom(room);
});

socket.on("kicked", () => {
  sessionStorage.clear();
  window.location.href = "index.html";
});

socket.on("squirrels-lobby-error", (msg) => {
  const box = document.getElementById("sq-error");
  if (!box) return;
  box.textContent = msg;
  box.classList.remove("hidden");
  clearTimeout(box._t);
  box._t = setTimeout(() => box.classList.add("hidden"), 3500);
});

socket.on("game-started", () => {
  window.location.href = "game.html";
});

const GAME_NAMES = { snake: "🐍 Snake", hungry: "🍗 Hungry Lasse", shooter: "🔫 Shooter", eye: "👁️ Eye of Ark", showdown: "🌀 Jump Showdown", hexagone: "⬡ Hex-A-Gone", blockparty: "🧱 Block Party", treehut: "🐿️ Drey's Treehut", squirrels: "🐿️ Rabid Squirrels" };

// Games that need more than one player before the host can start.
const MIN_PLAYERS = { treehut: 2, squirrels: 2 };

let gameSettings = {};
let currentRoom = null;

function renderGameSettings(game) {
  const container = document.getElementById("game-settings");
  container.innerHTML = "";
  gameSettings = {};

  if (["snake", "eye", "showdown", "hexagone", "blockparty"].includes(game)) {
    gameSettings.rounds = 1;
    container.innerHTML = `
      <div class="round-picker">
        <label class="label">Rounds</label>
        <div class="round-btns">
          ${[1,2,3,4,5].map(n =>
            `<button class="round-btn${n === 1 ? " active" : ""}" data-rounds="${n}">${n}</button>`
          ).join("")}
        </div>
      </div>`;
    container.querySelectorAll(".round-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        container.querySelectorAll(".round-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        gameSettings.rounds = parseInt(btn.dataset.rounds);
      });
    });
  }

  // Drey's Treehut is one 15-minute case per game: no rounds picker.
  if (game === "treehut") gameSettings.rounds = 1;

  // Rabid Squirrels is one match to the last player standing, one squirrel
  // each: no rounds picker. The map is picked in its own card below.
  if (game === "squirrels") gameSettings.rounds = 1;

  if (game === "shooter") {
    gameSettings.rounds = 1;
    gameSettings.mode = "standard";
    gameSettings.world = "generated";
    gameSettings.seed = "";
    const MODES = [
      ["standard", "Standard"],
      ["hardcore", "Hardcore \u2014 60 HP, no name tags"],
      ["oneshot", "One Shot \u2014 any hit kills"],
      ["headhunter", "Headhunter \u2014 headshots kill, body shots scratch"],
      ["lowgrav", "Low Gravity"],
      ["vampire", "Vampire \u2014 hits heal you"],
      ["speed", "Speed Demons"],
      ["bigheads", "Big Heads"],
      ["surge", "Power Surge \u2014 pickups every few seconds"],
      ["random", "Random twist every round"],
    ];
    const field = "width:100%;padding:0.6rem 0.75rem;border-radius:8px;border:1px solid rgba(255,255,255,0.12);" +
      "background:rgba(255,255,255,0.05);color:inherit;font:inherit;font-weight:700;";
    container.innerHTML = `
      <div class="round-picker">
        <label class="label">Rounds</label>
        <div class="round-btns" data-group="rounds">
          ${[1,2,3,4,5].map(n =>
            `<button class="round-btn${n === 1 ? " active" : ""}" data-rounds="${n}">${n}</button>`
          ).join("")}
        </div>
      </div>
      <div class="round-picker">
        <label class="label">Mode</label>
        <select id="sh-mode" style="${field}">
          ${MODES.map(([id, label]) => `<option value="${id}">${label}</option>`).join("")}
        </select>
      </div>
      <div class="round-picker">
        <label class="label">World</label>
        <div class="round-btns" data-group="world">
          <button class="round-btn active" data-world="generated" style="flex:1">Generated</button>
          <button class="round-btn" data-world="classic" style="flex:1">Classic</button>
        </div>
        <input id="sh-seed" maxlength="9" inputmode="numeric" autocomplete="off"
          placeholder="Seed \u2014 leave empty for a new world every round" style="margin-top:0.5rem" />
      </div>`;

    container.querySelectorAll('[data-group="rounds"] .round-btn').forEach(btn => {
      btn.addEventListener("click", () => {
        container.querySelectorAll('[data-group="rounds"] .round-btn').forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        gameSettings.rounds = parseInt(btn.dataset.rounds);
      });
    });
    container.querySelectorAll('[data-group="world"] .round-btn').forEach(btn => {
      btn.addEventListener("click", () => {
        container.querySelectorAll('[data-group="world"] .round-btn').forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        gameSettings.world = btn.dataset.world;
        seedInput.disabled = gameSettings.world === "classic";
        seedInput.style.opacity = seedInput.disabled ? "0.4" : "1";
      });
    });
    const seedInput = container.querySelector("#sh-seed");
    container.querySelector("#sh-mode").addEventListener("change", (e) => { gameSettings.mode = e.target.value; });
    seedInput.addEventListener("input", () => {
      seedInput.value = seedInput.value.replace(/\D/g, "");
      gameSettings.seed = seedInput.value;
    });
  }
}

function renderRoom(room) {
  currentRoom = room;
  document.getElementById("room-code").textContent = room.code;
  document.getElementById("player-count").textContent = `${room.players.length} / ${room.maxPlayers}`;

  const gameLabel = document.getElementById("game-label");
  if (gameLabel) gameLabel.textContent = GAME_NAMES[room.game] || room.game;

  const list = document.getElementById("player-list");
  list.innerHTML = "";
  room.players.forEach((p, i) => {
    const li = document.createElement("li");
    li.className = "player-item";
    const isHost = p.id === room.host;
    if (room.game === "squirrels") squirrelsPlayerItem(li, room, p, i);
    else li.textContent = p.name + (isHost ? " (host)" : "");
    if (p.id === socket.id) li.classList.add("me");
    list.appendChild(li);
  });

  renderTeamPicker(room.game);
  renderSquirrelsLobby(room);

  const isHost = room.host === socket.id;
  document.getElementById("host-controls").classList.toggle("hidden", !isHost);
  document.getElementById("guest-msg").classList.toggle("hidden", isHost);

  if (isHost && document.getElementById("game-settings").innerHTML === "") {
    renderGameSettings(room.game);
  }

  const startBtn = document.getElementById("start-btn");
  if (isHost) {
    const need = MIN_PLAYERS[room.game] || 1;
    const canStart = room.players.length >= need;
    startBtn.disabled = !canStart;
    startBtn.textContent = canStart ? "Start Game"
      : need > 1 ? `Waiting for players (${room.players.length} of ${need})...` : "Waiting for players...";
  }
}

// ---- Eye of Ark: every player picks a side before the game loads ----------
// Stored where the game page reads it, so the soldier is right from the very
// first frame of the intro.
const TEAMS = [
  { id: "bookis", logo: "assets/bookis-logo.png", label: "Bookis soldier", color: "#dc2359" },
  { id: "norli",  logo: "assets/norli.svg",       label: "Norli soldier",  color: "#003190" },
];

function savedTeam() {
  try { return localStorage.getItem("eyeTeam") === "norli" ? "norli" : "bookis"; } catch (e) { return "bookis"; }
}

function renderTeamPicker(game) {
  const box = document.getElementById("team-picker");
  if (!box) return;
  const picks = ["eye", "showdown", "hexagone", "blockparty"].includes(game);
  box.classList.toggle("hidden", !picks);
  if (!picks || box.innerHTML !== "") return;

  box.innerHTML = `
    <p class="label" style="margin:0.9rem 0 0.4rem;">Choose your soldier</p>
    <div style="display:flex;gap:0.6rem;margin-bottom:1rem;">
      ${TEAMS.map(t => `
        <button class="team-btn" data-team="${t.id}" style="flex:1;display:flex;flex-direction:column;align-items:center;gap:0.45rem;
          padding:0.8rem 0.5rem;border-radius:10px;cursor:pointer;font:inherit;font-weight:800;font-size:0.8rem;
          letter-spacing:0.5px;text-transform:uppercase;background:#fff;color:${t.color};border:3px solid transparent;
          transition:transform 0.12s,border-color 0.12s,opacity 0.12s;">
          <img src="${t.logo}" alt="" style="height:26px;max-width:100%;object-fit:contain;">
          ${t.label}
        </button>`).join("")}
    </div>`;

  const paint = () => {
    const team = savedTeam();
    box.querySelectorAll(".team-btn").forEach(b => {
      const on = b.dataset.team === team;
      b.style.borderColor = on ? "#f7c948" : "transparent";
      b.style.opacity = on ? "1" : "0.5";
      b.style.transform = on ? "scale(1.03)" : "scale(1)";
    });
  };
  box.querySelectorAll(".team-btn").forEach(b => b.addEventListener("click", () => {
    try { localStorage.setItem("eyeTeam", b.dataset.team); } catch (e) { /* private mode: default team */ }
    paint();
  }));
  paint();
}

// ---- Rabid Squirrels: pick your toy, the host picks the map -------------
// Built from SQUIRRELS_RULES.TOYS and .MAPS, so a new toy or map shows up here
// on its own. The server checks every pick; this only mirrors its rules.
const SQ = window.SQUIRRELS_RULES;
let sqPortraits = [];
let sqFrame = 0;
let sqRaf = 0;

const toyName = (key) => (SQ.TOYS.find(t => t.key === key) || SQ.TOYS[0]).name;
const escHtml = (s) => String(s).replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));

// In the match player i plays in PLAYER_COLORS[i], so the lobby shows the same.
function squirrelsPlayerItem(li, room, p, i) {
  li.classList.add("sq");
  const tag = p.id === room.host ? (p.id === socket.id ? "Host · you" : "Host") : (p.id === socket.id ? "You" : "");
  li.innerHTML = `<span class="sq-dot" style="background:${SQ.PLAYER_COLORS[i % SQ.PLAYER_COLORS.length]}"></span>` +
    `<span>${escHtml(p.name)}</span><span class="sq-as">as ${escHtml(toyName(p.toy))}</span>` +
    (tag ? `<span class="sq-tag">${tag}</span>` : "");
}

function renderSquirrelsLobby(room) {
  const box = document.getElementById("sq-lobby");
  const on = room.game === "squirrels" && !!room.lobby;
  box.classList.toggle("hidden", !on);
  document.querySelector(".lobby-container").classList.toggle("sq-wide", on);
  if (!on) return;

  // the line under the players: map, one squirrel each, turn length
  let info = document.getElementById("sq-info");
  if (!info) {
    info = document.createElement("p");
    info.id = "sq-info";
    info.className = "sq-info";
    document.getElementById("player-list").after(info);
  }
  const map = SQ.MAPS[room.lobby.map] || SQ.MAPS.oak;
  info.textContent = `Map: ${map.name} · one squirrel each · ${SQ.TURN_SECONDS}-second turns`;

  // toys: taken ones are greyed out with the owner's name, unless every toy
  // is taken, when a toy may be shared
  const me = room.players.find(p => p.id === socket.id) || {};
  const others = room.players.filter(p => p !== me && p.toy);
  const allTaken = SQ.TOYS.every(t => others.some(p => p.toy === t.key));
  document.getElementById("sq-toys").innerHTML = SQ.TOYS.map(t => {
    const owner = others.find(p => p.toy === t.key);
    const locked = owner && !allTaken;
    return `<button class="sq-toy${me.toy === t.key ? " on" : ""}" data-toy="${t.key}"${locked ? " disabled" : ""}>
      ${owner && me.toy !== t.key ? `<span class="taken">${escHtml(owner.name)}</span>` : ""}
      <canvas width="260" height="278" data-toy="${t.key}"></canvas>
      <span class="cname">${escHtml(t.name)}</span><span class="cline">${escHtml(t.line)}</span></button>`;
  }).join("");
  document.querySelectorAll("#sq-toys .sq-toy").forEach(b => b.addEventListener("click", () => {
    if (b.dataset.toy !== me.toy) socket.emit("squirrels-toy", { code: room.code, toy: b.dataset.toy });
  }));
  const colorOf = (key) => {
    const i = room.players.findIndex(p => p.toy === key);
    return i < 0 ? "#8892a4" : SQ.PLAYER_COLORS[i % SQ.PLAYER_COLORS.length];
  };
  sqPortraits = [...document.querySelectorAll("#sq-toys canvas")].map(cv =>
    ({ cv, key: cv.dataset.toy, mine: cv.dataset.toy === me.toy, color: colorOf(cv.dataset.toy) }));
  if (!sqRaf) sqRaf = requestAnimationFrame(drawPortraits);

  // maps: everyone sees the host's pick, only the host can change it
  const isHost = room.host === socket.id;
  const maps = document.getElementById("sq-maps");
  if (!maps.children.length) {
    maps.innerHTML = SQ.MAP_KEYS.map(k => {
      const m = SQ.MAPS[k], hz = SQ.hazardOf(k);
      return `<button class="sq-map" data-map="${k}"><canvas width="480" height="256"></canvas>
        <span class="mname">${escHtml(m.name)}<span class="hz">${hz.icon} ${escHtml(hz.name)}</span></span>
        <span class="mblurb">${escHtml(m.blurb)}</span></button>`;
    }).join("");
    maps.querySelectorAll(".sq-map").forEach(b => b.addEventListener("click", () => {
      if (currentRoom.host === socket.id) socket.emit("squirrels-lobby", { code: currentRoom.code, map: b.dataset.map });
    }));
    // painting a map takes a moment, so one at a time after the page is up
    const queue = [...maps.querySelectorAll(".sq-map")];
    const next = () => {
      const b = queue.shift();
      if (!b) return;
      b.querySelector("canvas").getContext("2d").drawImage(window.SQUIRRELS_MAPS.thumb(b.dataset.map), 0, 0);
      setTimeout(next, 0);
    };
    setTimeout(next, 30);
  }
  maps.querySelectorAll(".sq-map").forEach(b => {
    b.classList.toggle("on", b.dataset.map === room.lobby.map);
    b.disabled = !isHost;
  });
}

// The portraits idle: they blink now and then, and yours bobs and twitches.
function drawPortraits() {
  sqFrame++;
  const A = window.SQUIRRELS_ART;
  for (const p of sqPortraits) {
    if (!p.cv.isConnected) continue;
    const c = p.cv.getContext("2d");
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, p.cv.width, p.cv.height);
    c.setTransform(2, 0, 0, 2, 0, 0);
    c.translate(69, 131); c.scale(1.95, 1.95);
    A.drawToy(c, p.key, {
      face: 1, t: sqFrame, color: p.color,
      bob: p.mine ? Math.sin(sqFrame / 8) * 1.2 : 0,
      blink: (sqFrame + p.key.length * 37) % 200 < 6, twitch: p.mine && sqFrame % 90 < 8,
    });
  }
  sqRaf = sqPortraits.length ? requestAnimationFrame(drawPortraits) : 0;
}

// ---- invite link ---------------------------------------------------------
// Builds index.html?room=CODE&game=GAME, which pre-fills both for whoever opens it.
function inviteLink(room) {
  const url = new URL("index.html", window.location.href);
  url.searchParams.set("room", room.code);
  url.searchParams.set("game", room.game);
  return url.toString();
}

const copyLinkBtn = document.getElementById("copy-link-btn");
if (copyLinkBtn) {
  copyLinkBtn.addEventListener("click", async () => {
    const room = JSON.parse(sessionStorage.getItem("room") || "null");
    if (!room) return;
    const link = inviteLink(room);
    let ok = false;
    try {
      await navigator.clipboard.writeText(link);
      ok = true;
    } catch (e) {
      // clipboard API needs a secure context; fall back to selecting a hidden field
      const field = document.getElementById("link-fallback");
      if (field) {
        field.value = link;
        field.select();
        try { ok = document.execCommand("copy"); } catch (e2) { ok = false; }
      }
    }
    copyLinkBtn.textContent = ok ? "Link copied!" : "Press Ctrl+C to copy";
    setTimeout(() => { copyLinkBtn.textContent = "Copy invite link"; }, 1900);
  });
}

document.getElementById("start-btn").addEventListener("click", () => {
  socket.emit("start-game", gameSettings);
});
