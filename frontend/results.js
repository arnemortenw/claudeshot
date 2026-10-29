const saved = JSON.parse(sessionStorage.getItem("room") || "null");
const myName = sessionStorage.getItem("myName");
const scores = JSON.parse(sessionStorage.getItem("scores") || "[]");

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

  const isHost = room.host === socket.id;
  document.getElementById("host-controls").classList.toggle("hidden", !isHost);
  document.getElementById("guest-msg").classList.toggle("hidden", isHost);

  if (room.game === "squirrels" && squirrelsResults()) renderSquirrelsBoard(squirrelsResults());
  else renderScoreboard(scores, room);
});

socket.on("play-again", () => {
  sessionStorage.removeItem("scores");
  sessionStorage.removeItem("squirrelsResults");
  window.location.href = "lobby.html";
});

socket.on("kicked", () => {
  sessionStorage.clear();
  window.location.href = "index.html";
});

function renderScoreboard(scores, room) {
  const list = document.getElementById("scoreboard");
  list.innerHTML = "";

  const sorted = [...scores].sort((a, b) => b.score - a.score);

  if (sorted.length === 0) {
    room.players.forEach((p) => {
      sorted.push({ name: p.name, score: 0 });
    });
  }

  sorted.forEach((entry, i) => {
    const li = document.createElement("li");
    li.className = "score-item" + (entry.name === myName ? " me" : "");
    const rank = document.createElement("span");
    rank.className = "score-rank";
    rank.textContent = `${i + 1}.`;
    const name = document.createElement("span");
    name.className = "score-name";
    name.textContent = entry.name;
    const pts = document.createElement("span");
    pts.className = "score-points";
    pts.textContent = `${entry.score} pts`;
    li.append(rank, name, pts);
    list.appendChild(li);
  });
}

// Rabid Squirrels leaves its own ranking: every player, the winner named, how
// many squirrels each has left and the damage they dealt.
function squirrelsResults() {
  try { return JSON.parse(sessionStorage.getItem("squirrelsResults") || "null"); } catch (e) { return null; }
}

const SQUIRRELS_RESULTS_CSS = `
@font-face{font-family:"Bangers";src:url("assets/fonts/Bangers-Regular.ttf") format("truetype");font-display:swap;}
.sq-results{font-family:Bangers,Impact,"Arial Black",sans-serif;letter-spacing:.04em;}
.sq-results .squirrels-winner{font-size:2.3rem;line-height:1.05;margin:0 0 1.1rem;color:#fff;transform:rotate(-2deg);
  -webkit-text-stroke:2px #111;paint-order:stroke fill;text-shadow:3px 3px 0 #111;}
.sq-results .score-item{background:#fffbe8;color:#111;border:3px solid #111;border-radius:4px;box-shadow:4px 4px 0 #111;font-size:1.35rem;}
.sq-results .score-item:first-child{background:#f7c948;transform:rotate(-1deg);}
.sq-results .score-item.me{outline:3px dashed #e94560;outline-offset:3px;}
.sq-results .score-rank,.sq-results .score-points{color:#111;}
.sq-results .score-name small{font-family:Nunito,"Segoe UI",sans-serif;letter-spacing:0;color:#444 !important;}
.sq-results .squirrels-ark{display:inline-block;margin-top:1rem;background:#ff6a13;color:#fff;border:3px solid #111;box-shadow:3px 3px 0 #111;padding:.2rem .7rem 0;font-size:1.3rem;transform:rotate(1.5deg);}
.sq-results .score-name span{display:inline-block;background:var(--c);color:#111 !important;padding:.05rem .45rem 0;border:2px solid #111;box-shadow:2px 2px 0 #111;transform:rotate(-2deg);margin-bottom:.2rem;}
`;

function renderSquirrelsBoard(res) {
  const list = document.getElementById("scoreboard");
  list.innerHTML = "";
  const style = document.createElement("style");
  style.textContent = SQUIRRELS_RESULTS_CSS;
  document.head.appendChild(style);
  list.closest(".card").classList.add("sq-results");
  const winner = res.rows.find((r) => r.winner);
  const line = document.createElement("p");
  line.className = "squirrels-winner";
  if (winner) {
    const who = document.createElement("span");
    who.style.color = winner.color;
    who.textContent = `${winner.name}'s squirrels`;
    line.append(who, " win the hill! 🏆");
  } else {
    line.textContent = "Nobody wins. The nuts win.";
  }
  list.before(line);
  // ARK Nyåpning: how much of the enemy's sign the match left standing
  if (typeof res.ark === "number") {
    const ark = document.createElement("p");
    ark.className = "squirrels-ark";
    ark.textContent = res.ark > 0 ? `ARK sign: ${res.ark}% left. Still open.` : "ARK sign: gone. Closed for business!";
    list.after(ark);
  }

  res.rows.forEach((r) => {
    const li = document.createElement("li");
    li.className = "score-item" + (r.name === myName ? " me" : "");
    const rank = document.createElement("span");
    rank.className = "score-rank";
    rank.textContent = r.winner ? "🥇" : `${r.place}.`;
    const name = document.createElement("span");
    name.className = "score-name";
    const who = document.createElement("span");
    who.style.setProperty("--c", r.color);
    who.textContent = r.name;
    name.appendChild(who);
    const sub = document.createElement("small");
    sub.style.cssText = "display:block;color:#8892a4;font-weight:700;font-size:0.75rem;";
    sub.textContent = r.left.length
      ? r.left.map((s) => `${s.name} (${s.hp} hp)`).join(", ") + " still foaming"
      : "All squirrels down";
    name.appendChild(sub);
    const pts = document.createElement("span");
    pts.className = "score-points";
    pts.textContent = `${r.dealt} dmg`;
    li.append(rank, name, pts);
    list.appendChild(li);
  });
}

document.getElementById("play-again-btn").addEventListener("click", () => {
  socket.emit("play-again");
});
