// Drey's Treehut - pixel art, ported from the approved prototype (design v4).
// Everything draws onto a 2D context `c` at 32 px tiles: the room tiles, every
// object in the rooms, the 16x16 sprites (players are squirrels in their colour
// scarf) and the barrel symbols. Loaded before treehut-client.js as
// window.TREEHUT_ART.

(function () {
  "use strict";

  const T = 32;

  const SQUIRREL = [
    "................",
    ".........d..d...",
    "........dod.od..",
    "..ddd...oooooo..",
    ".doood..oowooo..",
    "doooood.ookoool.",
    "dooood..oooooln.",
    "doood....ooool..",
    "dood...sssssss..",
    ".dood..ooollll..",
    ".doood.oooollll.",
    "..doooooooollll.",
    "...ddoooooolll..",
    ".....doooooooo..",
    "......dd...dd...",
    "................",
  ];
  const FOX = [
    "................",
    "..........d...d.",
    ".........dod.do.",
    ".........ooooooo",
    ".........oowoooo",
    ".........ookoowww",
    ".........ooooowkn",
    "..dd......oooww.",
    ".doooo...ssssss.",
    "doooooo.ooowwww.",
    "dooowwwoooowwww.",
    ".dowww.oooowww..",
    "..ww...ooooooo..",
    ".......oooooo...",
    ".......kk..kk...",
    "................",
  ];
  const PAL_SQ = { o: "#c8692b", d: "#8a4419", l: "#f0c79a", k: "#111", w: "#fff", n: "#3a1d0a" };
  const PAL_FOX = { o: "#e0571b", d: "#9b3410", l: "#f3e3cf", w: "#f3e3cf", k: "#111", n: "#111" };
  const PAL_WEASEL = { o: "#8d6a4c", d: "#5a412c", l: "#e9d8bf", w: "#e9d8bf", k: "#111", n: "#111" };
  // suspects, all facing right
  const MAGPIE = [
    "................",
    "..........kkk...",
    ".........kkkkk..",
    ".........kkekknn",
    ".........kkkkk..",
    "........kkkkk...",
    ".......kkwwwk...",
    "..bb..kkwwwwwk..",
    ".bbbbkkbwwwwwk..",
    "bbbbkkbbwwwwk...",
    "bb..kkkbbwwk....",
    ".....kkkkkk.....",
    ".......g..g.....",
    ".......g..g.....",
    "......gg.gg.....",
    "................",
  ];
  const PAL_MAGPIE = { k: "#16161f", w: "#f2f2f2", b: "#2f56c8", e: "#ffffff", g: "#6a6a6a", n: "#2a2a2a" };
  const BADGER = [
    "................",
    "................",
    "................",
    "................",
    "...........ww...",
    "..........wkkw..",
    "...gggggg.wkekww",
    "..gggggggggkkwwn",
    ".gggggggggggwwww",
    "gggGGGGGGGGggggg",
    "ggGGGGGGGGGGggg.",
    ".gGGGGGGGGGGgg..",
    "..kkk.kk..kk.kk.",
    "..kk..kk..kk.kk.",
    "................",
    "................",
  ];
  const PAL_BADGER = { g: "#9a9a96", G: "#5c5c58", w: "#f4f4f0", k: "#141414", e: "#d8d8d8", n: "#000" };
  const OWL = [
    "................",
    "...b........b...",
    "...bb......bb...",
    "..bbbbbbbbbbbb..",
    "..bffffbbffffb..",
    "..bfyykffkyyfb..",
    "..bfyykffkyyfb..",
    "..bbffffnnffbb..",
    "..bbbbbffnbbbb..",
    ".bbllllllllllbb.",
    ".bblldlldlldlbb.",
    ".bbllllllllllbb.",
    "..bblldlldllbb..",
    "...bbbbbbbbbb...",
    "....nn....nn....",
    "................",
  ];
  const PAL_OWL = { b: "#8a6a3a", f: "#eadbb2", y: "#f0c040", k: "#111", n: "#d09a20", l: "#d8c08a", d: "#6a4a20" };
  const WEASEL = [
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
    "...........dd...",
    "..........oooo..",
    "..........ookoon",
    ".o.......ooool..",
    ".oo.ooooooooll..",
    "..ooooooooooll..",
    "...ollllllll....",
    "....d..d..d.d...",
    "................",
    "................",
  ];
  const PAL_DREY = { o: "#b9561f", d: "#7a3410", l: "#f6d7a8", k: "#111", w: "#fff", n: "#3a1d0a" };

  function drawSprite(c, grid, pal, x, y, scale, flip, scarf) {
    for (let r = 0; r < 16; r++) for (let q = 0; q < 16; q++) {
      const ch = grid[r][q];
      if (!ch || ch === ".") continue;
      const col = ch === "s" ? (scarf || "#555") : pal[ch];
      if (!col) continue;
      const qx = flip ? 15 - q : q;
      c.fillStyle = col;
      c.fillRect(x + qx * scale, y + r * scale, scale, scale);
    }
  }

  // ───────────────────────── tile & object art
  function rnd(seed) { let s = seed * 9301 + 49297; return () => ((s = (s * 9301 + 49297) % 233280) / 233280); }

  function drawFloor(c, x, y, seed) {
    c.fillStyle = "#7a5230"; c.fillRect(x, y, T, T);
    const r = rnd(seed);
    for (let i = 0; i < 4; i++) {
      c.fillStyle = i % 2 ? "#734c2c" : "#805634";
      c.fillRect(x, y + i * 8, T, 7);
      c.fillStyle = "#5e3d22";
      c.fillRect(x, y + i * 8 + 7, T, 1);
      c.fillRect(x + Math.floor(r() * 28), y + i * 8, 1, 7);
    }
    c.fillStyle = "#6a4526";
    c.fillRect(x + Math.floor(r() * 30), y + Math.floor(r() * 30), 2, 1);
  }
  function drawWall(c, x, y, seed, top) {
    c.fillStyle = "#4a2f1a"; c.fillRect(x, y, T, T);
    const r = rnd(seed + 7);
    for (let i = 0; i < 6; i++) {
      c.fillStyle = r() > .5 ? "#3a2414" : "#5c3b22";
      c.fillRect(x + Math.floor(r() * 30), y + Math.floor(r() * 20), 2, 6 + Math.floor(r() * 8));
    }
    if (top) { c.fillStyle = "#2a190c"; c.fillRect(x, y + T - 4, T, 4); }
    c.fillStyle = "#6b4628"; c.fillRect(x, y, T, 2);
  }
  function drawDoor(c, x, y, state) {
    drawWall(c, x, y, 3, false);
    if (state === "open") {
      c.fillStyle = "#120a05"; c.fillRect(x + 4, y + 2, 26, 28);
      c.fillStyle = "rgba(240,192,64,.35)"; c.fillRect(x + 4, y + 2, 4, 28);
      c.fillStyle = "#8b5a2b"; c.fillRect(x + 26, y + 2, 4, 28);
    } else {
      c.fillStyle = "#8b5a2b"; c.fillRect(x + 4, y + 2, 26, 28);
      c.fillStyle = "#6e4420";
      for (let i = 0; i < 4; i++) c.fillRect(x + 4 + i * 7, y + 2, 1, 28);
      c.fillStyle = "#3d3d3d"; c.fillRect(x + 4, y + 8, 26, 2); c.fillRect(x + 4, y + 22, 26, 2);
      // padlock
      c.fillStyle = "#9a9a9a"; c.fillRect(x + 10, y + 11, 10, 3); c.fillRect(x + 10, y + 11, 2, 6); c.fillRect(x + 18, y + 11, 2, 6);
      c.fillStyle = "#d2a72a"; c.fillRect(x + 8, y + 16, 14, 10);
      c.fillStyle = "#5a4510"; c.fillRect(x + 14, y + 19, 2, 4);
    }
  }
  function drawWindow(c, x, y, broken) {
    drawWall(c, x, y, 11, true);
    c.fillStyle = "#2b1a0d"; c.fillRect(x + 4, y + 4, 24, 22);
    c.fillStyle = "#7fb9e6"; c.fillRect(x + 6, y + 6, 20, 18);
    c.fillStyle = "#b6dbf5"; c.fillRect(x + 6, y + 6, 20, 5);
    c.fillStyle = "#4c8a3a"; c.fillRect(x + 6, y + 19, 20, 5);
    c.fillStyle = "#2b1a0d"; c.fillRect(x + 15, y + 6, 2, 18); c.fillRect(x + 6, y + 14, 20, 2);
    if (broken) { c.fillStyle = "#111"; c.fillRect(x + 18, y + 7, 6, 6); c.fillRect(x + 20, y + 13, 3, 3); }
  }

  const OBJ_ART = {
    shelf(c, x, y, o) {
      c.fillStyle = "#5a3818"; c.fillRect(x + 1, y + 2, 30, 28);
      c.fillStyle = "#3c240e"; c.fillRect(x + 3, y + 4, 26, 24);
      c.fillStyle = "#7a4e26"; c.fillRect(x + 1, y + 15, 30, 3); c.fillRect(x + 1, y + 28, 30, 3);
      const jars = o.jars;
      for (let i = 0; i < 4; i++) {
        const row = i < 2 ? 0 : 1, col = i % 2;
        const jx = x + 5 + col * 13, jy = y + 5 + row * 13;
        c.fillStyle = "rgba(190,220,230,.55)"; c.fillRect(jx, jy + 2, 9, 9);
        c.fillStyle = "#c2c2c2"; c.fillRect(jx + 1, jy, 7, 2);
        if (i < jars) { c.fillStyle = "#a8662a"; c.fillRect(jx + 1, jy + 5, 7, 6); c.fillStyle = "#d18a3a"; c.fillRect(jx + 2, jy + 6, 2, 2); }
        else { c.fillStyle = "rgba(40,30,20,.5)"; c.fillRect(jx + 1, jy + 9, 7, 2); }
      }
    },
    barrel(c, x, y, o) {
      c.fillStyle = "#7b4a22"; c.fillRect(x + 6, y + 4, 20, 26);
      c.fillStyle = "#93602e"; c.fillRect(x + 4, y + 8, 24, 18);
      c.fillStyle = "#3d3d3d"; c.fillRect(x + 4, y + 9, 24, 2); c.fillRect(x + 4, y + 23, 24, 2);
      c.fillStyle = "#5b3517"; c.fillRect(x + 8, y + 4, 16, 3);
      drawSymbol(c, o.sym, x + 10, y + 12, 1);
      c.fillStyle = "#f2e6c0";
      for (let i = 0; i < o.dots; i++) c.fillRect(x + 10 + i * 4, y + 27, 2, 2);
    },
    table(c, x, y, o) {
      c.fillStyle = "#6b411d"; c.fillRect(x + 2, y + 8, 28, 14);
      c.fillStyle = "#4e2e12"; c.fillRect(x + 4, y + 22, 3, 8); c.fillRect(x + 25, y + 22, 3, 8);
      if (o.paper) { c.fillStyle = "#efe2bc"; c.fillRect(x + 8, y + 9, 14, 10); c.fillStyle = "#7a6a4a"; for (let i = 0; i < 4; i++) c.fillRect(x + 10, y + 11 + i * 2, 10, 1); }
    },
    prints(c, x, y) {
      c.fillStyle = "rgba(40,24,10,.75)";
      [[6, 8], [18, 18]].forEach(([a, b]) => {
        c.fillRect(x + a, y + b, 5, 5);
        c.fillRect(x + a - 2, y + b - 3, 2, 2); c.fillRect(x + a + 1, y + b - 4, 2, 2); c.fillRect(x + a + 4, y + b - 3, 2, 2); c.fillRect(x + a + 6, y + b - 1, 2, 2);
      });
    },
    fur(c, x, y) {
      c.fillStyle = "#b8b8b0"; c.fillRect(x + 9, y + 14, 13, 1); c.fillRect(x + 11, y + 16, 12, 1); c.fillRect(x + 10, y + 18, 10, 1);
      c.fillStyle = "#222"; c.fillRect(x + 15, y + 14, 2, 1); c.fillRect(x + 17, y + 16, 2, 1); c.fillRect(x + 14, y + 18, 2, 1);
    },
    bed(c, x, y) {
      c.fillStyle = "#5a3818"; c.fillRect(x + 1, y + 4, 30, 26);
      c.fillStyle = "#efe6d2"; c.fillRect(x + 3, y + 5, 26, 7);
      c.fillStyle = "#a3302a"; c.fillRect(x + 3, y + 12, 26, 17);
      c.fillStyle = "#c4473c"; for (let i = 0; i < 3; i++) c.fillRect(x + 5 + i * 9, y + 15, 5, 2);
    },
    bag(c, x, y) {
      c.fillStyle = "rgba(0,0,0,.35)"; c.fillRect(x + 7, y + 27, 20, 3);
      c.fillStyle = "#efe9da"; c.fillRect(x + 7, y + 10, 18, 18);
      c.fillStyle = "#d6cdb6"; c.fillRect(x + 21, y + 10, 4, 18);
      c.fillStyle = "#222"; c.fillRect(x + 11, y + 5, 2, 6); c.fillRect(x + 19, y + 5, 2, 6); c.fillRect(x + 11, y + 4, 10, 2);
      c.fillStyle = "#1b1b1b"; c.fillRect(x + 10, y + 14, 10, 10);
      c.fillStyle = "#fff"; c.font = "bold 5px Verdana"; c.fillText("ARK", x + 10.5, y + 21);
      c.fillStyle = "#7a4a1e"; c.fillRect(x + 9, y + 8, 8, 3);
    },
    books(c, x, y, o) {
      c.fillStyle = "#4b2c12"; c.fillRect(x + 1, y + 2, 30, 28);
      const cols = ["#8f2a2a", "#2a5a8f", "#3c7a3a", "#c09a2a", "#6a3a8a", "#a35a2a"];
      const r = rnd(o.seed || 1);
      for (let row = 0; row < 2; row++) {
        let bx = x + 3;
        while (bx < x + 28) {
          const w = 2 + Math.floor(r() * 3), h = 9 + Math.floor(r() * 3);
          c.fillStyle = cols[Math.floor(r() * cols.length)];
          c.fillRect(bx, y + 4 + row * 13 + (12 - h), w, h);
          bx += w + 1;
        }
        c.fillStyle = "#7a4e26"; c.fillRect(x + 1, y + 15 + row * 13, 30, 2);
      }
    },
    rug(c, x, y, o) {
      c.fillStyle = "#7d2b22"; c.fillRect(x, y + 2, T, T - 4);
      c.fillStyle = "#c99a3a";
      if (o.edge.includes("t")) c.fillRect(x, y + 3, T, 2);
      if (o.edge.includes("b")) c.fillRect(x, y + T - 5, T, 2);
      c.fillRect(x + 14, y + 14, 4, 4);
    },
    chair(c, x, y) {
      c.fillStyle = "#3f5a2a"; c.fillRect(x + 5, y + 4, 22, 12); c.fillRect(x + 3, y + 10, 26, 16);
      c.fillStyle = "#56763a"; c.fillRect(x + 7, y + 14, 18, 8);
      c.fillStyle = "#3a2412"; c.fillRect(x + 5, y + 26, 3, 4); c.fillRect(x + 24, y + 26, 3, 4);
    },
    mappiece(c, x, y) {
      c.fillStyle = "rgba(0,0,0,.3)"; c.fillRect(x + 9, y + 21, 15, 3);
      c.fillStyle = "#e4cf98"; c.fillRect(x + 8, y + 10, 16, 12);
      c.fillStyle = "#c4a868"; c.fillRect(x + 20, y + 10, 4, 4);
      c.fillStyle = "#8a3a1e"; c.fillRect(x + 11, y + 14, 6, 1); c.fillRect(x + 16, y + 15, 1, 4);
    },
    slip(c, x, y) {
      c.fillStyle = "rgba(0,0,0,.3)"; c.fillRect(x + 10, y + 22, 14, 3);
      c.fillStyle = "#f2efe4"; c.fillRect(x + 9, y + 9, 14, 14);
      c.fillStyle = "#d8d2c0"; c.fillRect(x + 19, y + 9, 4, 3); c.fillRect(x + 9, y + 19, 3, 4);
      c.fillStyle = "#555"; for (let i = 0; i < 4; i++) c.fillRect(x + 11, y + 11 + i * 3, 9 - (i % 2) * 3, 1);
      c.fillStyle = "#2a4fa0"; c.fillRect(x + 14, y + 20, 6, 1);
    },
    pedestal(c, x, y) {
      c.fillStyle = "#8b8b8b"; c.fillRect(x + 6, y + 14, 20, 16);
      c.fillStyle = "#a8a8a8"; c.fillRect(x + 4, y + 10, 24, 5);
      c.fillStyle = "#6a2a7a"; c.fillRect(x + 9, y + 6, 14, 5);
      c.fillStyle = "#4a1a5a"; c.fillRect(x + 13, y + 7, 6, 2);
    },
    board(c, x, y) {
      c.fillStyle = "#5a3818"; c.fillRect(x + 1, y + 3, 30, 26);
      c.fillStyle = "#b98a52"; c.fillRect(x + 3, y + 5, 26, 22);
      [["#efe2bc", 5, 7], ["#ffe58a", 17, 8], ["#efe2bc", 9, 17], ["#c6e6ff", 20, 18]].forEach(([col, a, b]) => {
        c.fillStyle = col; c.fillRect(x + a, y + b, 8, 7);
        c.fillStyle = "#c0281c"; c.fillRect(x + a + 3, y + b, 2, 2);
      });
      c.fillStyle = "#c0281c"; c.fillRect(x + 12, y + 12, 8, 1); c.fillRect(x + 14, y + 16, 1, 4);
    },
    feather(c, x, y) {
      c.fillStyle = "#1c2340"; c.fillRect(x + 10, y + 16, 12, 3); c.fillRect(x + 14, y + 13, 8, 3);
      c.fillStyle = "#3a5fbf"; c.fillRect(x + 18, y + 12, 5, 2);
      c.fillStyle = "#ddd"; c.fillRect(x + 8, y + 18, 4, 1);
      c.fillStyle = "rgba(180,170,150,.5)"; c.fillRect(x + 11, y + 15, 2, 1); c.fillRect(x + 17, y + 17, 2, 1);
    },
    drey(c, x, y, o, t) {
      const bob = Math.floor(t / 400) % 2;
      drawSprite(c, SQUIRREL, PAL_DREY, x, y - bob, 2, true, "#8a6a2a");
    },
  };

  // symbols for the barrel lock
  function drawSymbol(c, sym, x, y, s) {
    const px = (a, b, w, h, col) => { c.fillStyle = col; c.fillRect(x + a * s, y + b * s, w * s, h * s); };
    if (sym === "acorn") { px(2, 0, 8, 3, "#5b3517"); px(5, -1, 2, 1, "#3a200c"); px(3, 3, 6, 6, "#c98a3a"); px(4, 9, 4, 1, "#c98a3a"); px(4, 4, 1, 3, "#e6b26a"); }
    if (sym === "leaf") { px(4, 0, 4, 2, "#3f9a3a"); px(2, 2, 8, 5, "#3f9a3a"); px(4, 7, 4, 2, "#3f9a3a"); px(5, 1, 1, 8, "#215c1e"); px(5, 9, 1, 2, "#5b3517"); }
    if (sym === "mushroom") { px(1, 1, 10, 4, "#c0281c"); px(3, 0, 6, 1, "#c0281c"); px(3, 2, 2, 1, "#fff"); px(7, 2, 2, 1, "#fff"); px(4, 5, 4, 5, "#efe2bc"); }
    if (sym === "pinecone") { px(3, 0, 6, 10, "#7b4a22"); px(2, 2, 8, 6, "#7b4a22"); for (let i = 0; i < 4; i++) px(3 + (i % 2) * 2, 1 + i * 2, 3, 1, "#4a2a10"); }
  }

  // the golden hazelnut
  const NUT = [
    ".......bb.......",
    "......bbb.......",
    ".....hhhhhh.....",
    "....hHhHhHhh....",
    "...hhhhhhhhhh...",
    "...gGGGGGGGGg...",
    "..gGGwwGGGGGGg..",
    "..gGwwGGGGGGGg..",
    ".gGGwGGGGGGGGGg.",
    ".gGGGGGGGGGGGdg.",
    ".gGGGGGGGGGGddg.",
    "..gGGGGGGGGGddg.",
    "..ggGGGGGGGddg..",
    "...ggGGGGGddg...",
    ".....gggggg.....",
    "................",
  ];
  const PAL_NUT = { b: "#6b3f1d", h: "#b8862a", H: "#d9a640", g: "#8a5a10", G: "#f0c040", w: "#fff6c0", d: "#c9952a" };

  // A clue icon in a 32x32 slot: the object's own art on a patch of floor.
  function drawIcon(c, type) {
    c.fillStyle = "#7a5230"; c.fillRect(2, 2, 28, 28);
    if (OBJ_ART[type]) OBJ_ART[type](c, 0, 0, {}, 0);
  }

  // each suspect's sprite and palette, by the ids in treehut-rules.js
  const SUSPECT_ART = {
    fox: { grid: FOX, pal: PAL_FOX },
    magpie: { grid: MAGPIE, pal: PAL_MAGPIE },
    badger: { grid: BADGER, pal: PAL_BADGER },
    owl: { grid: OWL, pal: PAL_OWL },
  };

  window.TREEHUT_ART = {
    T,
    SQUIRREL, FOX, MAGPIE, BADGER, OWL, WEASEL, NUT,
    PAL_SQ, PAL_FOX, PAL_WEASEL, PAL_MAGPIE, PAL_BADGER, PAL_OWL, PAL_DREY, PAL_NUT,
    drawSprite, drawFloor, drawWall, drawDoor, drawWindow, drawSymbol, drawIcon,
    OBJ_ART, SUSPECT_ART,
  };
})();
