// Drey's Treehut - shared rules. Loaded by BOTH the browser (window.TREEHUT_RULES)
// and the Node server (require), so the client draws the same rooms the server
// referees.
//
// Three rooms, 15x11 tiles each. A room's door opens when all its challenges are
// solved, and the whole party walks into the next room together. In the last
// room the party votes on who stole Drey's golden hazelnut.
//
// A challenge with `after` stays locked until that one is solved. A room with a
// `key` keeps its door shut after its challenges: its cabinet opens, someone
// takes the key out and brings it to Drey, and he hands over the key to the door.
//
// No answers live here: the lock code, the jar count, the bookmark word, the
// map's solved turns and the thief are only on the server (backend/games/treehut.js).

(function (root, factory) {
  const rules = factory();
  if (typeof module === "object" && module.exports) module.exports = rules;
  else root.TREEHUT_RULES = rules;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const COLS = 15, ROWS = 11;
  const GAME_MS = 15 * 60 * 1000;
  const END_SCREEN_MS = 15000;     // the end overlay shows this long before the results page
  const MOVE_MS = 150;             // fastest one tile step a player may take (the walk takes ~200 ms)
  const MAX_PLAYERS = 6;
  const MAX_CHAT = 200;

  const POINTS = { challenge: 30, clue: 15, helping: 10 };

  const PLAYER_COLORS = ["#f0c040", "#ff6fae", "#5aa8ff", "#5fd35f", "#b07cff", "#ff9a3c"];

  // Symbols on the barrel lock, in the order a slot cycles through them.
  const SYMBOLS = ["acorn", "leaf", "mushroom", "pinecone"];

  // Tiles: '#' wall, '.' floor, 'D' door, 'W' window, 'B' broken window.
  // Objects: solid ones block walking; floor ones (rugs) are only drawn.
  // `opens` names the challenge window an object opens, `clue` the clue it gives,
  // `piece` the torn map piece lying there, `rule` the barrel rule carved on it,
  // `after` the challenge that has to be solved before it opens.
  const ROOMS = [
    {
      id: "pantry", name: "The Pantry", short: "Pantry",
      map: [
        "####WW#########",
        "#.............#",
        "#.............#",
        "#.............#",
        "#.............#",
        "#.............D",
        "#.............#",
        "#.............#",
        "#.............#",
        "#.............#",
        "###############",
      ],
      // where each player stands on entering, in join order
      starts: [[3, 5], [4, 4], [4, 6], [5, 5], [3, 7], [5, 7]],
      objects: [
        { id: "shelf1", type: "shelf", x: 1, y: 1, jars: 3, solid: true, opens: "jars", look: "You see a pantry shelf. 3 full jars of hazelnuts, 1 empty." },
        { id: "shelf2", type: "shelf", x: 2, y: 1, jars: 2, solid: true, opens: "jars", look: "You see a pantry shelf. 2 full jars, 2 empty." },
        { id: "shelf3", type: "shelf", x: 7, y: 1, jars: 4, solid: true, opens: "jars", look: "You see a pantry shelf. 4 full jars." },
        { id: "shelf4", type: "shelf", x: 8, y: 1, jars: 0, solid: true, opens: "jars", look: "You see a pantry shelf. All 4 jars are empty!" },
        { id: "ledger", type: "table", x: 12, y: 8, paper: true, solid: true, opens: "jars", look: "You see Drey's pantry ledger. Columns of sums, and a scribbled note.", lockedLook: "You see Drey's ledger drawer. It is locked: open the barrel lock first." },
        { id: "b1", type: "barrel", x: 2, y: 8, sym: "acorn", dots: 2, solid: true, rule: 0, opens: "barrels", look: "Carved on the barrel: \"The leaf is in the lock, but it is not first.\"" },
        { id: "b2", type: "barrel", x: 4, y: 8, sym: "mushroom", dots: 3, solid: true, rule: 1, opens: "barrels", look: "Carved on the barrel: \"The acorn comes before the mushroom, but never right beside it.\"" },
        { id: "b3", type: "barrel", x: 6, y: 8, sym: "leaf", dots: 1, solid: true, rule: 2, opens: "barrels", look: "Carved on the barrel: \"The pinecone is only used if the leaf is last.\"" },
        { id: "prints", type: "prints", x: 5, y: 2, clue: "prints", look: "You see smudged paw prints. Pads and claw marks, but not the thin toes of a bird." },
        { id: "hair", type: "fur", x: 4, y: 1, clue: "hair", look: "You see coarse grey hairs with a black band, caught on the window frame." },
        { id: "drey", type: "drey", x: 10, y: 4, solid: true, npc: true, look: "You see Drey. He looks very worried." },
        { id: "cabinet", type: "cabinet", x: 12, y: 1, solid: true, after: "jars", look: "You see Drey's key cabinet. It is locked tight." },
      ],
      challenges: ["barrels", "jars"],
      // the cabinet holds a key; Drey swaps it for the key to the door
      key: { cabinet: "cabinet", to: "drey" },
      drey: ["Thank you for coming, friends. Find out who took my golden hazelnut!", "First the barrel lock, then my ledger. When the ledger adds up, my key cabinet opens. Bring me the key inside!"],
      dreyKey: {
        locked: "My key cabinet only opens when the ledger adds up. The barrel lock first, then the ledger.",
        open: "The cabinet is open! Take the key out and bring it to me.",
        carried: "{name} has my cabinet key. Bring it here and I will give you the key to the stairs.",
        given: "My cabinet key, thank you! Here is the key to the stairs. Up to the Reading Nook with you!",
      },
      cabinetLook: {
        full: "You see Drey's key cabinet, open. A brass key hangs inside.",
        empty: "You see Drey's key cabinet, open and empty.",
      },
    },
    {
      id: "nook", name: "The Reading Nook", short: "Nook",
      map: [
        "###############",
        "#.............#",
        "#.............#",
        "#.............#",
        "#.............#",
        "#.............D",
        "#.............#",
        "#.............#",
        "#.............#",
        "#.............#",
        "###############",
      ],
      starts: [[1, 5], [2, 4], [2, 6], [3, 5], [1, 7], [3, 7]],
      objects: [
        { id: "bed", type: "bed", x: 2, y: 2, solid: true, look: "You see Drey's bed. Something is poking out from under it." },
        { id: "bag", type: "bag", x: 3, y: 3, opens: "book", look: "You see a shopping bag from the Bookshop ARK. Drey says it is not his." },
        { id: "bk1", type: "books", x: 6, y: 1, seed: 3, solid: true, look: "You see Drey's bookshelf. Nut recipes, mostly." },
        { id: "bk2", type: "books", x: 7, y: 1, seed: 9, solid: true, look: "You see a bookshelf. \"Tracks and Signs of the Forest\", well thumbed." },
        { id: "bk3", type: "books", x: 8, y: 1, seed: 5, solid: true, look: "You see a bookshelf. \"Squirrels of the North\", volumes 1 to 4." },
        { id: "chair", type: "chair", x: 11, y: 2, solid: true, look: "You see a mossy armchair." },
        { id: "r1", type: "rug", x: 6, y: 5, edge: "t", floor: true }, { id: "r2", type: "rug", x: 7, y: 5, edge: "t", floor: true }, { id: "r3", type: "rug", x: 8, y: 5, edge: "t", floor: true },
        { id: "r4", type: "rug", x: 6, y: 6, edge: "b", floor: true }, { id: "r5", type: "rug", x: 7, y: 6, edge: "b", floor: true }, { id: "r6", type: "rug", x: 8, y: 6, edge: "b", floor: true },
        { id: "mp1", type: "mappiece", x: 12, y: 8, piece: 0, look: "You see a torn piece of a map." },
        { id: "mp2", type: "mappiece", x: 5, y: 9, piece: 1, look: "You see a torn piece of a map." },
        { id: "mp3", type: "mappiece", x: 10, y: 4, piece: 2, look: "You see a torn piece of a map." },
        { id: "mp4", type: "mappiece", x: 2, y: 7, piece: 3, look: "You see a torn piece of a map." },
        { id: "desk", type: "table", x: 12, y: 5, solid: true, opens: "map", look: "You see a desk. A good place to lay out the map pieces." },
      ],
      challenges: ["book", "map"],
      drey: ["That bag is not mine. Half the forest shops at the Bookshop ARK, you know."],
    },
    {
      id: "vault", name: "The Hazelnut Vault", short: "Vault",
      map: [
        "#########B#####",
        "#.............#",
        "#.............#",
        "#.............#",
        "#.............#",
        "#.............#",
        "#.............#",
        "#.............#",
        "#.............#",
        "#.............#",
        "###############",
      ],
      starts: [[1, 5], [2, 4], [2, 6], [3, 5], [1, 7], [3, 7]],
      objects: [
        { id: "ped", type: "pedestal", x: 7, y: 5, solid: true, look: "You see an empty velvet cushion. The golden hazelnut is gone." },
        { id: "board", type: "board", x: 7, y: 1, solid: true, opens: "accuse", look: "You see the case board. Time to name the thief." },
        { id: "feather", type: "feather", x: 3, y: 7, clue: "feather", look: "You see a black and blue feather under the window." },
        { id: "slip", type: "slip", x: 11, y: 8, clue: "alibi", look: "You see a crumpled delivery slip from the Bookshop ARK." },
        { id: "drey3", type: "drey", x: 9, y: 6, solid: true, npc: true, look: "You see Drey, staring at the empty cushion." },
      ],
      challenges: ["accuse"],
      drey: ["Think carefully. Naming the wrong neighbour would be a terrible thing."],
    },
  ];

  // `hint` is the suggested hint a teammate can give when someone asks.
  const CHALLENGES = {
    barrels: { room: 0, name: "Open the barrel lock", hint: "Start with the acorn and the mushroom: in three slots there is only one way to keep them apart." },
    jars: { room: 0, after: "barrels", locked: "Open the barrel lock first. Drey keeps his ledger in a locked drawer.", name: "How many jars did the thief take?", hint: "Work out how many full jars Drey should have, and don't miss the scribbled note. Then count the full jars on the shelves." },
    book: { room: 1, name: "Crack the bookmark code", hint: "The numbers are page, line and word. Take the first letter of each word." },
    map: { room: 1, name: "Put the torn map together", hint: "Turn each piece until the red path joins up." },
    accuse: { room: 2, name: "Name the thief together", hint: "No single clue is enough. Each one rules some suspects out." },
  };

  // What the ledger window shows. The party compares it with the shelves.
  const LEDGER = {
    rows: [
      ["Full jars, 1 October", "20"],
      ["Week 1: delivered / eaten", "+6 / −9"],
      ["Week 2: delivered / eaten", "+4 / −7"],
    ],
    note: "Scribbled in the margin: \"Sunday: ate two more. Too full to write it down.\"",
  };

  // The book in the Bookshop ARK bag. The bookmark reads page·line·word.
  const BOOK = {
    title: "The Collector's Guide to Precious Nuts",
    bookmark: [[14, 1, 6], [14, 4, 1], [15, 1, 3], [15, 3, 6]],
    pages: [
      { page: 14, heading: "The Golden Hazelnut", lines: [
        "Of all the precious nuts, none",
        "is rarer than the golden hazelnut.",
        "Only three are known to exist, and",
        "each one is worth more than a",
        "whole shop full of books.",
      ] },
      { page: 15, heading: "Selling a Treasure", lines: [
        "Thieves who sell them never sell",
        "them near home. They wait until",
        "the trail is cold, then trade them",
        "quietly through a dealer they trust.",
        "Keep yours locked away.",
      ] },
    ],
    lockLength: 4,
  };

  const MAP_PIECES = 4;

  // `from` names the challenge that hands over a clue instead of an object on the floor.
  const CLUES = {
    prints: { room: 0, icon: "prints", name: "Smudged paw prints", text: "Pads and claw marks, leading from the window to the shelves. Not the thin toes of a bird." },
    hair: { room: 0, icon: "fur", name: "Coarse grey hairs", text: "Caught on the window frame. Long, coarse, grey with a black band." },
    receipt: { room: 1, icon: "bag", from: "book", name: "Bookshop ARK receipt", text: "One \"Collector's Guide to Precious Nuts\", bought last night at 23:48 with an ARK staff card and the 30% staff discount." },
    map: { room: 1, icon: "mappiece", from: "map", name: "Torn map", text: "A route from Drey's treehut to the back door of the Bookshop ARK, marked \"23:30\"." },
    feather: { room: 2, icon: "feather", name: "Black and blue feather", text: "Found under the vault window. Thick with dust." },
    alibi: { room: 2, icon: "slip", name: "ARK delivery slip", text: "Bjørn Badger: Mill Road delivery, 23:15 to 00:40. Signed by the miller." },
  };

  const SUSPECTS = [
    { id: "fox", name: "Fridtjof Fox & crew", desc: "Own the Bookshop ARK. Say they were stocktaking all night with the doors locked." },
    { id: "magpie", name: "Magpie Margit", desc: "ARK's best customer. Collects anything that shines. Lives one tree over." },
    { id: "badger", name: "Badger Bjørn", desc: "Delivers stock for the ARK. Grey coat. Lives under the treehut and hates the noise." },
    { id: "owl", name: "Owl Olga", desc: "Runs the night café inside the ARK. Owes money all over the forest." },
  ];

  const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

  // ---------------------------------------------------------------- helpers
  function tileAt(room, x, y) {
    const row = ROOMS[room] && ROOMS[room].map[y];
    return (row && row[x]) || "#";
  }

  // the object standing on a tile, skipping map pieces already picked up and floor decor
  function objectAt(room, x, y, picked) {
    return ROOMS[room].objects.find((o) => o.x === x && o.y === y && !o.floor && !(picked && picked[o.id])) || null;
  }

  // Can a player step onto this tile? Players do not block each other.
  function walkable(room, x, y, doorOpen, picked) {
    const t = tileAt(room, x, y);
    if (t === "D") return !!doorOpen;
    if (t !== ".") return false;
    const o = objectAt(room, x, y, picked);
    return !(o && o.solid);
  }

  // next to an object, diagonals and standing on it included
  function near(px, py, o) {
    return Math.max(Math.abs(px - o.x), Math.abs(py - o.y)) <= 1;
  }

  function doorTile(room) {
    const map = ROOMS[room].map;
    for (let y = 0; y < map.length; y++) {
      const x = map[y].indexOf("D");
      if (x >= 0) return [x, y];
    }
    return null;
  }

  function findObject(room, id) {
    return ROOMS[room].objects.find((o) => o.id === id) || null;
  }

  // a challenge waiting for the one before it
  function locked(cid, solved) {
    const c = CHALLENGES[cid];
    return !!(c && c.after && !solved[c.after]);
  }

  return {
    COLS, ROWS, GAME_MS, END_SCREEN_MS, MOVE_MS, MAX_PLAYERS, MAX_CHAT,
    POINTS, PLAYER_COLORS, SYMBOLS, ROOMS, CHALLENGES, LEDGER, BOOK, MAP_PIECES,
    CLUES, SUSPECTS, DIRS,
    tileAt, objectAt, walkable, near, doorTile, findObject, locked,
  };
});
