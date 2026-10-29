// Rabid Squirrels - the toy squirrels. Ported from design v8's drawToy and
// inked to match the game's pop-art look: thick black outlines, flat colours
// and one gloss highlight on the head. Loaded before squirrels-client.js as
// window.SQUIRRELS_ART.
//
// A toy is drawn standing on its stand at (0, 0), facing right, about 64
// units tall. The caller translates and scales.

(function () {
  const TOYS = {
    sheriff: { name: "Sheriff Scratch", fur: "#c97b3d", furDark: "#8e4f22", muzzle: "#f3d3a4", outfit: "#f2c335", outfit2: "#fbfbf7", iris: "#6b3f1d" },
    ranger:  { name: "Space Ranger Nutz", fur: "#a9a39b", furDark: "#6f6a64", muzzle: "#ebe5dc", outfit: "#f5f6fa", outfit2: "#7bc043", iris: "#2f7ad8" },
    dino:    { name: "Rexie Nutkin", fur: "#c97b3d", furDark: "#8e4f22", muzzle: "#f3d3a4", outfit: "#69c04a", outfit2: "#c7e86b", iris: "#2f6a2f" },
    bo:      { name: "Bo Squeak", fur: "#d68f55", furDark: "#9a5a2c", muzzle: "#f7dcb5", outfit: "#8cbcec", outfit2: "#f7a8c8", iris: "#7a3e8e" },
    // #21: the toys for players 5 and 6
    pig:     { name: "Porky Nutbank", fur: "#a86a3c", furDark: "#74431f", muzzle: "#f0cfa0", outfit: "#ff7eb6", outfit2: "#ffd23f", iris: "#c2185b", trim: "#a8326a" },
    spud:    { name: "Mr. Nut Head", fur: "#9a9088", furDark: "#655d57", muzzle: "#e9e1d6", outfit: "#d9ae6c", outfit2: "#3a8bfd", iris: "#2f7ad8", trim: "#a77c45" },
  };
  // Until the lobby pick lands, each player slot gets its own toy.
  const SLOT_TOYS = ["sheriff", "ranger", "dino", "bo", "pig", "spud"];
  const toyFor = (slot) => SLOT_TOYS[slot % SLOT_TOYS.length];

  const INK = "#111", LW = 1.7;

  function mix(hex, amt) {
    const n = parseInt(hex.slice(1), 16), t = amt < 0 ? 0 : 255, p = Math.abs(amt);
    const c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => Math.round(v + (t - v) * p));
    return `rgb(${c[0]},${c[1]},${c[2]})`;
  }
  function ell(c, x, y, rx, ry, rot = 0) { c.beginPath(); c.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); }
  function rr(c, x, y, w, h, r) { c.beginPath(); c.roundRect ? c.roundRect(x, y, w, h, r) : c.rect(x, y, w, h); }
  function fs(c, fill) { c.fillStyle = fill; c.fill(); c.stroke(); }
  function star(c, x, y, r, fill) {
    c.beginPath();
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r2 = i % 2 ? r * 0.45 : r; c.lineTo(x + Math.cos(a) * r2, y + Math.sin(a) * r2); }
    c.closePath(); fs(c, fill);
  }

  // The display stand in the player's colour, with a hard comic rim.
  function stand(c, color, rx) {
    c.lineWidth = LW; c.strokeStyle = INK;
    ell(c, 0, 1.4, rx, 4.6); fs(c, mix(color, -0.45));
    ell(c, 0, -0.5, rx, 4); fs(c, color);
    c.fillStyle = "rgba(255,255,255,.45)"; ell(c, -rx * 0.4, -1.4, rx * 0.3, 1.1); c.fill();
  }

  // o: { color, face (1 or -1), t (frame), blink, twitch, bob, pop (0..1: Mr. Nut Head's parts fly off) }
  function drawToy(c, key, o) {
    const ch = TOYS[key] || TOYS.sheriff, t = o.t || 0;
    c.save();
    stand(c, o.color, 15);
    c.scale(o.face || 1, 1);
    if (o.twitch) c.rotate((Math.random() - 0.5) * 0.18);
    c.translate(0, o.bob || 0);
    c.lineWidth = LW; c.strokeStyle = INK; c.lineJoin = "round"; c.lineCap = "round";

    // tail
    c.beginPath(); c.moveTo(-4, -10); c.bezierCurveTo(-27, -8, -31, -41, -18, -53); c.bezierCurveTo(-8, -61, 5, -53, -4, -46); c.bezierCurveTo(-12, -42, -14, -27, -2, -20); c.closePath(); fs(c, ch.furDark);
    c.strokeStyle = ch.fur; c.lineWidth = 2.6; c.beginPath(); c.moveTo(-15, -22); c.quadraticCurveTo(-22, -36, -15, -48); c.stroke();
    c.strokeStyle = INK; c.lineWidth = LW;
    if (key === "dino") { for (let i = 0; i < 4; i++) { const a = -0.6 - i * 0.55, px = -16 + Math.cos(a) * 12, py = -36 + Math.sin(a) * 15; c.beginPath(); c.moveTo(px - 2.5, py + 1); c.lineTo(px - 4, py - 4); c.lineTo(px + 2, py - 1); c.closePath(); fs(c, "#f39c34"); } }

    // legs
    if (key === "pig") {
      // trotters: pink legs with dark hooves
      [-3, 5].forEach((x) => { rr(c, x, -8, 6, 8, 2.5); fs(c, ch.outfit); c.fillStyle = ch.trim; c.fillRect(x + 0.8, -2.6, 4.4, 2); });
    } else if (key === "spud") {
      rr(c, -3, -8, 6, 6, 2.5); fs(c, ch.furDark); rr(c, 5, -8, 6, 6, 2.5); fs(c, ch.furDark);
      ell(c, 1, -2, 5.2, 3); fs(c, ch.outfit2); ell(c, 9.5, -2, 5.2, 3); fs(c, ch.outfit2);   // big plastic shoes
    } else { rr(c, -3, -8, 6, 8, 2.5); fs(c, ch.furDark); rr(c, 5, -8, 6, 8, 2.5); fs(c, ch.furDark); }
    // body / outfit
    if (key === "bo") {
      c.beginPath(); c.moveTo(-5, -26); c.lineTo(-11, -2); c.quadraticCurveTo(3, 2, 17, -2); c.lineTo(11, -26); c.closePath(); fs(c, ch.outfit);
      c.strokeStyle = ch.outfit2; c.lineWidth = 2.4; c.beginPath(); c.moveTo(-9.5, -4); c.quadraticCurveTo(3, 0, 15.5, -4); c.stroke();
      c.strokeStyle = INK; c.lineWidth = LW;
      ell(c, 3, -24, 9, 6); fs(c, ch.outfit);
      c.fillStyle = ch.outfit2; rr(c, -5, -20, 16, 3.2, 1.5); c.fill();
    } else if (key === "pig") {
      // a round piggy-bank belly with a painted daisy, and a curly tail
      c.lineWidth = 3.6; c.beginPath(); c.moveTo(-8, -19); c.bezierCurveTo(-15, -22, -16, -14, -12, -14); c.bezierCurveTo(-9, -14, -10, -18, -13, -17); c.stroke();
      c.strokeStyle = ch.outfit; c.lineWidth = 1.8; c.stroke(); c.strokeStyle = INK; c.lineWidth = LW;
      ell(c, 3, -17, 12.5, 12); fs(c, ch.outfit);
      c.fillStyle = "rgba(255,255,255,.5)"; ell(c, -3, -23, 3, 1.8, -0.6); c.fill();
      c.lineWidth = 1; for (let i = 0; i < 5; i++) { const a = i * 1.2566; ell(c, 6 + Math.cos(a) * 2.4, -14 + Math.sin(a) * 2.4, 1.7, 1.7); fs(c, "#fff"); }
      ell(c, 6, -14, 1.4, 1.4); fs(c, ch.outfit2); c.lineWidth = LW;
    } else if (key === "spud") {
      // a lumpy potato body with peg holes
      c.beginPath(); c.moveTo(3, -32); c.bezierCurveTo(14, -33, 16, -22, 14.5, -14); c.bezierCurveTo(13, -5, 8, -2.5, 2, -3); c.bezierCurveTo(-7, -3.5, -9.5, -11, -8.5, -19); c.bezierCurveTo(-7.5, -27, -4, -31.5, 3, -32); c.closePath(); fs(c, ch.outfit);
      c.fillStyle = ch.trim; [[-3, -22, 1], [6, -10, 1.2], [9.5, -24, 0.8], [-4, -9, 0.9]].forEach(([x, y, r]) => { ell(c, x, y, r, r * 0.8); c.fill(); });
    } else {
      ell(c, 3, -18, 10.5, 12); fs(c, ch.outfit);
      c.save(); ell(c, 3, -18, 10.5, 12); c.clip();
      if (key === "sheriff") {
        c.fillStyle = ch.outfit2; c.fillRect(-9, -31, 8, 26); c.fillRect(9.5, -31, 6, 26);
        c.fillStyle = "#1d1d1d"; ell(c, -5, -22, 1.8, 2.5); c.fill(); ell(c, -3.5, -12, 1.6, 2); c.fill(); ell(c, 12.5, -16, 1.4, 2); c.fill();
        c.fillStyle = "#7a4a1e"; c.fillRect(-9, -10.5, 24, 3.2); c.fillStyle = "#f7d354"; c.fillRect(5, -11, 4, 4.2);
      } else if (key === "ranger") {
        c.fillStyle = "#7b4fb3"; c.fillRect(-9, -31, 24, 4); c.fillRect(-9, -10, 24, 4);
      } else if (key === "dino") {
        ell(c, 6.5, -16, 5.5, 8.5); c.fillStyle = ch.outfit2; c.fill();
        c.strokeStyle = "rgba(40,80,25,.6)"; c.lineWidth = 1; for (let y = -21; y < -9; y += 3.5) { c.beginPath(); c.moveTo(2.5, y); c.lineTo(10.5, y); c.stroke(); }
      }
      c.restore();
      c.strokeStyle = INK; c.lineWidth = LW;
      ell(c, 3, -18, 10.5, 12); c.stroke();
      if (key === "sheriff") { c.lineWidth = 1.1; star(c, 10.5, -22, 3.4, "#f7d354"); c.lineWidth = LW; }
      if (key === "ranger") {
        rr(c, 2.5, -25, 9, 8, 2); fs(c, ch.outfit2);
        c.fillStyle = "#e94560"; ell(c, 5, -21, 1.2, 1.2); c.fill(); c.fillStyle = "#3a8bfd"; ell(c, 9, -21, 1.2, 1.2); c.fill();
      }
    }
    // paw
    ell(c, 13.5, -19, key === "spud" ? 3.9 : 3.4, key === "spud" ? 3 : 2.6, 0.3); fs(c, key === "spud" ? "#fff" : ch.fur);   // Mr. Nut Head wears a white glove
    // ear (Porky's is under the hood)
    if (key !== "pig") { ell(c, 1.5, -50, 3.6, 6.8, -0.35); fs(c, ch.fur); ell(c, 1.8, -49.5, 1.6, 4, -0.35); c.fillStyle = "#e9a3a0"; c.fill(); }
    // Porky's pig hood: two pig ears, then the hood with a coin in its slot
    if (key === "pig") {
      c.beginPath(); c.moveTo(-5, -47); c.lineTo(-8, -59); c.lineTo(3, -53); c.closePath(); fs(c, ch.outfit);
      c.beginPath(); c.moveTo(11, -53.5); c.lineTo(18, -61); c.lineTo(19.5, -49); c.closePath(); fs(c, ch.outfit);
      c.fillStyle = ch.trim; c.beginPath(); c.moveTo(-4.5, -49); c.lineTo(-6.5, -56.5); c.lineTo(0.5, -52.5); c.closePath(); c.fill();
      ell(c, 7, -40, 15, 14.5); fs(c, ch.outfit);
      c.fillStyle = "rgba(255,255,255,.5)"; ell(c, -1, -49, 3.4, 2, -0.7); c.fill();
      ell(c, 6.5, -57.2, 3.8, 3.8); fs(c, ch.outfit2);
      c.lineWidth = 1; c.beginPath(); c.moveTo(6.5, -59.4); c.lineTo(6.5, -55.4); c.stroke(); c.lineWidth = LW;
      c.save(); c.translate(6.5, -54.6); c.rotate(-0.04); rr(c, -5, -1.2, 10, 2.6, 1.2); c.fillStyle = INK; c.fill(); c.restore();
    }
    // bonnet behind the head
    if (key === "bo") {
      ell(c, 6, -41, 16, 14.5); fs(c, ch.outfit2);
      c.strokeStyle = "#fff"; c.lineWidth = 1.4; c.setLineDash([1.5, 2]); ell(c, 6, -41, 13.5, 12); c.stroke(); c.setLineDash([]);
      c.strokeStyle = INK; c.lineWidth = LW;
    }
    // head, with the one gloss highlight
    ell(c, 8, -38, 12.5, 12.5); fs(c, ch.fur);
    c.fillStyle = "rgba(255,255,255,.5)"; ell(c, 2.5, -44.5, 3.6, 2.2, -0.6); c.fill();
    ell(c, 14.5, -33.5, 7.6, 6); fs(c, ch.muzzle);
    ell(c, 21.2, -36.2, 2.9, 2.2); c.fillStyle = "#2b1408"; c.fill(); c.fillStyle = "rgba(255,255,255,.7)"; ell(c, 20.4, -37, 0.9, 0.6); c.fill();
    c.lineWidth = 1.2; rr(c, 16.6, -30.6, 4.6, 5.2, 1.2); fs(c, "#fffdf4"); c.beginPath(); c.moveTo(18.9, -30.4); c.lineTo(18.9, -25.6); c.stroke();
    c.beginPath(); c.moveTo(12, -29.5); c.quadraticCurveTo(16, -27.5, 22, -30.5); c.stroke();
    c.lineWidth = LW;
    const pop = o.pop || 0, popY = -pop * 16, popR = pop * 0.6;   // Mr. Nut Head's parts fly off when hit
    if (key === "pig") {
      ell(c, 21, -35.2, 4.6, 3.8); fs(c, ch.outfit);
      c.fillStyle = ch.trim; ell(c, 19.6, -35.2, 0.9, 1.4); c.fill(); ell(c, 22.4, -35.2, 0.9, 1.4); c.fill();
    }
    if (key === "spud") {
      c.save(); c.translate(pop * 6, -popY * 0.5); c.rotate(popR * 0.4);
      c.beginPath(); c.moveTo(19.5, -33.5); c.bezierCurveTo(16, -35.5, 11.5, -33, 11.5, -29.5); c.bezierCurveTo(14, -31, 17, -30.5, 19.5, -31.5);
      c.bezierCurveTo(22, -30.5, 25, -31, 27, -29.5); c.bezierCurveTo(27, -33, 23, -35.5, 19.5, -33.5); c.closePath(); fs(c, "#2a1a10");
      c.restore();
    }
    // eyes: big and bloodshot
    const look = o.twitch ? 1 : 0;
    if (o.blink) {
      c.lineWidth = 2; c.beginPath(); c.moveTo(3.5, -41); c.lineTo(8.5, -41); c.moveTo(9, -41.5); c.lineTo(17.5, -41.5); c.stroke(); c.lineWidth = LW;
    } else {
      c.lineWidth = 1.3;
      ell(c, 6.2, -42, 3.3, 4.9); fs(c, "#fff");
      c.fillStyle = ch.iris; ell(c, 7.4 + look, -41.4, 2.1, 2.3); c.fill(); c.fillStyle = "#111"; ell(c, 7.7 + look, -41.3, 1.1, 1.2); c.fill();
      ell(c, 13.2, -42, 4.7, 5.9); fs(c, "#fff");
      c.strokeStyle = "#e0455a"; c.lineWidth = 0.6; c.beginPath(); c.moveTo(9, -41); c.lineTo(11, -41.6); c.moveTo(9.8, -45); c.lineTo(11.4, -44); c.moveTo(9.6, -38.4); c.lineTo(11.2, -39.2); c.moveTo(17.2, -38.6); c.lineTo(16, -39.6); c.stroke();
      c.strokeStyle = INK; c.lineWidth = LW;
      c.fillStyle = ch.iris; ell(c, 14.4 + look, -41.4, 3, 3.2); c.fill(); c.fillStyle = "#111"; ell(c, 14.8 + look, -41.3, 1.6, 1.8); c.fill();
      c.fillStyle = "#fff"; ell(c, 13.5 + look, -42.8, 1.1, 1.1); c.fill(); ell(c, 15.6 + look, -40.2, 0.5, 0.5); c.fill();
    }
    // angry brows
    c.lineWidth = 2.6; c.beginPath(); c.moveTo(9.2, -49.2); c.lineTo(17.6, -46.4); c.moveTo(3, -48.4); c.lineTo(7.4, -47.6); c.stroke();
    c.lineWidth = LW;
    if (key === "spud") {
      c.save(); c.translate(-pop * 7, popY * 0.4); c.rotate(-popR);
      ell(c, -4, -38, 4.2, 6.4, 0.15); fs(c, "#ff8fb1");
      c.lineWidth = 1.2; c.beginPath(); c.arc(-3.6, -38, 2.6, -1.4, 1.4); c.stroke(); c.lineWidth = LW;
      c.restore();
    }
    // headwear
    if (key === "spud") {
      // a black bowler hat with a red band
      c.save(); c.translate(pop * 3, popY); c.rotate(popR);
      c.beginPath(); c.moveTo(-0.5, -50); c.bezierCurveTo(-1.5, -64, 17.5, -64, 16.5, -50); c.closePath(); fs(c, "#2a2a33");
      c.fillStyle = "#e94560"; c.fillRect(-0.6, -53.4, 17.2, 2.8);
      ell(c, 8, -49.6, 15, 3.2, -0.06); fs(c, "#2a2a33");
      c.fillStyle = "rgba(255,255,255,.5)"; ell(c, 3.5, -59, 2.6, 1.4, -0.5); c.fill();
      c.restore();
    } else if (key === "sheriff") {
      c.beginPath(); c.moveTo(-1, -49); c.quadraticCurveTo(-2.5, -62, 3, -62); c.quadraticCurveTo(8, -57.5, 13, -62); c.quadraticCurveTo(18.5, -62, 17, -49); c.closePath(); fs(c, "#a3692f");
      c.fillStyle = "#5a3517"; c.fillRect(-1.3, -52.5, 18.3, 3);
      ell(c, 8, -48.6, 17.5, 3.8, -0.06); fs(c, "#8f5a27");
    } else if (key === "ranger") {
      c.strokeStyle = "#7b4fb3"; c.lineWidth = 3.4; c.beginPath(); c.arc(8, -38.5, 16.5, 0.35, Math.PI - 0.35); c.stroke();
      c.fillStyle = "rgba(190,225,255,.18)"; ell(c, 8, -39, 17, 17); c.fill();
      c.strokeStyle = INK; c.lineWidth = 1.4; c.stroke();
      c.strokeStyle = "rgba(255,255,255,.9)"; c.lineWidth = 2.2; c.beginPath(); c.arc(8, -39, 13, Math.PI * 1.12, Math.PI * 1.42); c.stroke();
      c.strokeStyle = INK; c.lineWidth = LW;
    } else if (key === "dino") {
      c.beginPath(); c.moveTo(-4.8, -42); c.arc(8, -38, 13.8, Math.PI * 1.07, Math.PI * 1.96); c.quadraticCurveTo(9, -55.5, -4.8, -42); c.closePath(); fs(c, ch.outfit);
      c.lineWidth = 1.2;
      for (let i = 0; i < 4; i++) { const a = Math.PI * (1.22 + i * 0.17), px = 8 + Math.cos(a) * 13.8, py = -38 + Math.sin(a) * 13.8; c.beginPath(); c.moveTo(px + Math.cos(a - 0.35) * 1, py + Math.sin(a - 0.35) * 1); c.lineTo(px + Math.cos(a) * 5.5, py + Math.sin(a) * 5.5); c.lineTo(px + Math.cos(a + 0.35) * 1, py + Math.sin(a + 0.35) * 1); c.closePath(); fs(c, "#f39c34"); }
      c.fillStyle = "#fff"; for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(1 + i * 5, -46.4 + i * 0.4); c.lineTo(3.4 + i * 5, -44 + i * 0.3); c.lineTo(5.6 + i * 5, -46.6 + i * 0.4); c.fill(); }
      c.lineWidth = LW;
    } else if (key === "bo") {
      c.lineWidth = 1.2;
      c.beginPath(); c.moveTo(4, -27.5); c.lineTo(-2, -31); c.lineTo(-2, -24); c.closePath(); fs(c, ch.outfit2);
      c.beginPath(); c.moveTo(4, -27.5); c.lineTo(10, -31); c.lineTo(10, -24); c.closePath(); fs(c, ch.outfit2);
      ell(c, 4, -27.5, 1.8, 1.8); fs(c, mix(ch.outfit2, -0.15));
      c.lineWidth = LW;
    }
    // rabid foam
    c.lineWidth = 0.7; c.strokeStyle = "rgba(90,150,190,.95)";
    for (let i = 0; i < 5; i++) { const a = t / 9 + i * 1.6; ell(c, 20 + Math.cos(a) * 2.6 + (i % 2) * 1.5, -27 + Math.sin(a * 1.3) * 1.6 + i * 0.8, 1.3 + (i % 3) * 0.5, 1.3 + (i % 3) * 0.5); c.fillStyle = "#fff"; c.fill(); c.stroke(); }
    c.restore();
  }

  function drawGrave(c, color) {
    c.save();
    stand(c, color, 13);
    c.lineWidth = LW; c.strokeStyle = INK; c.lineJoin = "round";
    c.beginPath(); c.moveTo(-10, -1); c.lineTo(-10, -18); c.quadraticCurveTo(-10, -32, 0, -32); c.quadraticCurveTo(10, -32, 10, -18); c.lineTo(10, -1); c.closePath(); fs(c, "#9aa0ad");
    c.fillStyle = "rgba(255,255,255,.4)"; ell(c, -5, -24, 2.2, 4, 0.3); c.fill();
    c.fillStyle = "#3b3f4a"; c.font = "8px Bangers, Impact, sans-serif"; c.textAlign = "center"; c.fillText("RIP", 0, -14);
    ell(c, 0, -35, 5, 4); fs(c, "#8a5528");
    c.restore();
  }

  // A round portrait of the toy's head for the HUD, drawn into a small canvas.
  function drawToyHead(cv, key, color) {
    const c = cv.getContext("2d"), s = cv.width;
    c.clearRect(0, 0, s, s);
    c.save();
    c.beginPath(); c.arc(s / 2, s / 2, s / 2 - 1.5, 0, Math.PI * 2); c.fillStyle = color; c.fill();
    c.clip();
    c.translate(s / 2 - 8 * (s / 34), s / 2 + 44 * (s / 34));
    c.scale(s / 34, s / 34);
    drawToy(c, key, { color, face: 1, t: 0 });
    c.restore();
    c.lineWidth = 2; c.strokeStyle = INK; c.beginPath(); c.arc(s / 2, s / 2, s / 2 - 1.5, 0, Math.PI * 2); c.stroke();
  }

  if (typeof module !== "undefined") module.exports = { TOYS, SLOT_TOYS, toyFor };
  if (typeof window === "undefined") return;
  window.SQUIRRELS_ART = { TOYS, SLOT_TOYS, toyFor, drawToy, drawGrave, drawToyHead, mix };
})();
