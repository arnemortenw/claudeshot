const SQ = require("../frontend/games/squirrels-rules.js");

const rooms = new Map();

function generateCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code;
  do {
    code = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  } while (rooms.has(code));
  return code;
}

function createRoom(hostId, hostName, game, maxPlayers) {
  const code = generateCode();
  rooms.set(code, {
    code,
    host: hostId,
    game: game || "snake",
    maxPlayers: maxPlayers || 8,
    players: [{ id: hostId, name: hostName }],
    gameStarted: false
  });
  const room = rooms.get(code);
  if (room.game === "squirrels") {
    room.lobby = { map: "oak" };
    giveToy(room, room.players[0]);
  }
  return room;
}

function joinRoom(code, playerId, playerName) {
  const room = rooms.get(code);
  if (!room) return { error: "Room not found." };
  if (room.gameStarted) return { error: "Game already in progress." };
  if (room.players.length >= room.maxPlayers) return { error: "Room is full." };
  if (room.players.find((p) => p.id === playerId)) return room;
  room.players.push({ id: playerId, name: playerName });
  giveToy(room, room.players[room.players.length - 1]);
  return room;
}

function rejoinRoom(code, newSocketId, playerName) {
  const room = rooms.get(code);
  if (!room) return { error: "Room not found." };

  const existing = room.players.find((p) => p.name === playerName);
  if (existing) {
    const wasHost = room.host === existing.id;
    existing.id = newSocketId;
    if (wasHost) room.host = newSocketId;
  } else {
    // someone new arriving this way still has to fit in the room
    if (room.players.length >= room.maxPlayers) return { error: "Room is full." };
    room.players.push({ id: newSocketId, name: playerName });
    giveToy(room, room.players[room.players.length - 1]);
  }

  return room;
}

function leaveRoom(playerId) {
  for (const [code, room] of rooms) {
    const index = room.players.findIndex((p) => p.id === playerId);
    if (index === -1) continue;

    room.players.splice(index, 1);

    if (room.players.length === 0) {
      rooms.delete(code);
      return { code, disbanded: true };
    }

    if (room.host === playerId) {
      room.host = room.players[0].id;
    }

    return { code, room, disbanded: false };
  }
  return null;
}

// ---- Rabid Squirrels: every player is a toy, and the host picks the map ----
// A toy belongs to one player. Only once every toy is taken may two players
// share one, so a room with more players than toys still fills up.
function toysTakenBy(room, player) {
  return new Set(room.players.filter((p) => p !== player && p.toy).map((p) => p.toy));
}

function toyFree(room, player, key) {
  const taken = toysTakenBy(room, player);
  return !taken.has(key) || SQ.TOYS.every((t) => taken.has(t.key));
}

// A new player gets the first free toy, or the least used one when none is.
function giveToy(room, player) {
  if (room.game !== "squirrels" || !player || player.toy) return;
  const free = SQ.TOYS.find((t) => toyFree(room, player, t.key) && !toysTakenBy(room, player).has(t.key));
  if (free) { player.toy = free.key; return; }
  const uses = (key) => room.players.filter((p) => p.toy === key).length;
  player.toy = SQ.TOYS.slice().sort((a, b) => uses(a.key) - uses(b.key))[0].key;
}

function pickToy(code, playerId, key) {
  const room = rooms.get(code);
  if (!room || room.game !== "squirrels") return { error: "Room not found." };
  if (room.gameStarted) return { error: "The match has started." };
  const player = room.players.find((p) => p.id === playerId);
  if (!player) return { error: "You are not in this room." };
  if (!SQ.isToy(key)) return { error: "No such toy." };
  if (!toyFree(room, player, key)) {
    const owner = room.players.find((p) => p !== player && p.toy === key);
    return { error: `${owner.name} already has that toy.` };
  }
  player.toy = key;
  return room;
}

// The host's map, kept on the room so every player's lobby shows it.
function setSquirrelsLobby(code, playerId, { map } = {}) {
  const room = rooms.get(code);
  if (!room || room.game !== "squirrels") return { error: "Room not found." };
  if (room.host !== playerId) return { error: "Only the host picks the map." };
  if (room.gameStarted) return { error: "The match has started." };
  if (!SQ.MAPS[map]) return { error: "No such map." };
  room.lobby.map = map;
  return room;
}

function getRoom(code) {
  return rooms.get(code) || null;
}

function getRooms() {
  return rooms;
}

module.exports = { createRoom, joinRoom, rejoinRoom, leaveRoom, getRoom, getRooms, pickToy, setSquirrelsLobby };
