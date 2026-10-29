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

function renderSquirrelsBoard(res) {
  const list = document.getElementById("scoreboard");
  list.innerHTML = "";
  const winner = res.rows.find((r) => r.winner);
  const line = document.createElement("p");
  line.className = "squirrels-winner";
  line.style.cssText = "font-size:1.15rem;font-weight:900;margin:0 0 1rem;";
  if (winner) {
    const who = document.createElement("span");
    who.style.color = winner.color;
    who.textContent = `${winner.name}'s squirrels`;
    line.append(who, " win the hill! 🏆");
  } else {
    line.textContent = "Nobody wins. The nuts win.";
  }
  list.before(line);

  res.rows.forEach((r) => {
    const li = document.createElement("li");
    li.className = "score-item" + (r.name === myName ? " me" : "");
    const rank = document.createElement("span");
    rank.className = "score-rank";
    rank.textContent = r.winner ? "🥇" : `${r.place}.`;
    const name = document.createElement("span");
    name.className = "score-name";
    name.style.color = r.color;
    name.textContent = r.name;
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
