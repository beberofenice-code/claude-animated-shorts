// Painted textures for the pelikula sets: cinema facade, movie posters (no lettering), bahay-na-bato fronts, palace,
// studio hangar, home facade, office panelling, the screen images and parol lanterns. Ink seams are painted in as
// dark tints (the world ink pass only draws silhouettes and creases).
import * as THREE from "three";
import { ctex, jit } from "./paint";
import { Pen, bodyFront, Outfit, Expr, INK } from "./toon";

const U = (r: () => number, a: number, b: number) => a + (b - a) * r();
const blot = (g: CanvasRenderingContext2D, x: number, y: number, rad: number, rgb: string, a: number) => {
  const gr = g.createRadialGradient(x, y, 0, x, y, rad);
  gr.addColorStop(0, `rgba(${rgb},${a})`); gr.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = gr; g.fillRect(x - rad, y - rad, 2 * rad, 2 * rad);
};
const plaster = (g: CanvasRenderingContext2D, r: () => number, W: number, H: number, col: string, n = 40) => {
  g.fillStyle = col; g.fillRect(0, 0, W, H);
  for (let i = 0; i < n; i++) blot(g, U(r, 0, W), U(r, 0, H), U(r, 20, 90), r() > 0.5 ? "255,255,255" : "110,80,60", r() > 0.5 ? 0.07 : 0.05);
};
const rect = (g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fill: string, ink = 0) => {
  g.fillStyle = fill; g.fillRect(x, y, w, h);
  if (ink) { g.strokeStyle = "rgba(36,23,38,.85)"; g.lineWidth = ink; g.strokeRect(x, y, w, h); }
};

// ---------------- cinema (art deco, 1950s-styled, repainted) ----------------
/** facade 18 x 12 m at 64 px/m: cream with coral + teal vertical fins, a sunburst crest, lobby glass */
export const cinemaFront = () => ctex("cinemaFront", 1152, 768, (g, r) => {
  const m = 64;
  plaster(g, r, 1152, 768, "#f0dcb4", 70);
  // vertical fins
  for (const x of [1.2, 3.2, 14.8, 16.8]) { rect(g, x * m - 22, 0, 44, 768, "#e07a5f"); g.fillStyle = "rgba(255,255,255,.18)"; g.fillRect(x * m - 22, 0, 8, 768); }
  for (const x of [2.2, 15.8]) rect(g, x * m - 10, 0, 20, 768, "#3d8a87");
  // crest sunburst above the billboard (top band)
  g.save(); g.translate(9 * m, 0.55 * m);
  for (let i = 0; i < 13; i++) { const a = Math.PI * (i / 12); g.fillStyle = i % 2 ? "#e9b44c" : "#f3cf7a"; g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, 1.6 * m, a - 0.12, a + 0.12); g.fill(); }
  g.restore();
  // stepped parapet band
  for (let i = 0; i < 18; i++) rect(g, i * m, 0, m - 2, 0.25 * m, i % 2 ? "#3d8a87" : "#e07a5f");
  // lobby: glass doors 5 m wide, 3.6 m high (bottom)
  const y0 = 768 - 3.6 * m;
  rect(g, 6.5 * m, y0, 5 * m, 3.6 * m, "#22344f", 6);
  for (let i = 0; i < 4; i++) { rect(g, (6.6 + i * 1.22) * m, y0 + 10, 1.12 * m, 3.4 * m, "#35577a", 4); g.fillStyle = "rgba(190,225,255,.25)"; g.fillRect((6.7 + i * 1.22) * m, y0 + 18, 14, 3.2 * m); }
  // ticket booth windows left/right of the doors
  for (const x of [3.6, 12.4]) { rect(g, x * m, 768 - 2.4 * m, 2 * m, 1.3 * m, "#2a3d5c", 5); rect(g, x * m, 768 - 1.1 * m, 2 * m, 1.1 * m, "#c45a48", 5); }
  // plinth
  g.fillStyle = "rgba(70,50,40,.3)"; g.fillRect(0, 768 - 0.35 * m, 1152, 0.35 * m);
});

const sky = (g: CanvasRenderingContext2D, W: number, H: number, a: string, b: string) => {
  const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, a); gr.addColorStop(1, b); g.fillStyle = gr; g.fillRect(0, 0, W, H);
};
const burst = (g: CanvasRenderingContext2D, x: number, y: number, r0: number, r1: number, n: number, cols: string[]) => {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2, b = ((i + 0.5) / n) * Math.PI * 2, rr = i % 2 ? r1 : r1 * 0.72;
    g.fillStyle = cols[i % cols.length]; g.beginPath(); g.moveTo(x + r0 * Math.cos(a), y + r0 * Math.sin(a)); g.lineTo(x + rr * Math.cos(b), y + rr * Math.sin(b));
    g.lineTo(x + r0 * Math.cos(a + (2 * Math.PI) / n), y + r0 * Math.sin(a + (2 * Math.PI) / n)); g.fill();
  }
};
/** person drawn onto a poster canvas (600 x 1000 design units, scaled) */
const figure = (g: CanvasRenderingContext2D, o: Outfit, x: number, y: number, s: number, expr: Expr, opts: Partial<Parameters<typeof bodyFront>[2]> = {}) => {
  g.save(); g.translate(x, y); g.scale(s, s);
  bodyFront(new Pen(g), o, { mode: "stand", expr, light: -2.1, seed: 3, ...opts });
  g.restore();
};

// the cast every set shares (toon outfits)
export const HERO: Outfit = { jacket: "#f4efe4", pants: "#2c3550", boots: "#3a2a22", hat: "bandana", hair: "#22191a", band: "#d6312e", motif: "vest", skin: "#e9b98f", moustache: "#2a1d1a", build: "stout" };
export const HERO_PRES: Outfit = { ...HERO, dsash: "#f2c33c" };
export const VILLAIN: Outfit = { jacket: "#3a3346", pants: "#2a2534", boots: "#1d1a22", hat: "hair", hair: "#1a1418", moustache: "#15101a", skin: "#d9a47e", build: "stout" };
export const LEADING: Outfit = { jacket: "#f3d9e3", pants: "#3b3f52", boots: "#7a4b3a", hat: "hair", hair: "#2a1d1a", dress: "#d9567a", skin: "#f1c7a3" };

/** the action-hero poster (billboard above the marquee). empty = he has stepped out: a blank cut-out where he stood */
export const heroPoster = (empty: boolean) => ctex("posterHero" + (empty ? "E" : ""), 640, 768, (g) => {
  sky(g, 640, 768, "#f6b04a", "#d8452f");
  burst(g, 320, 300, 30, 520, 28, ["#ffd36b", "#f29a3a"]);
  // skyline silhouette + explosion
  g.fillStyle = "#4a1f2c"; for (let i = 0; i < 12; i++) { const h = 80 + ((i * 37) % 90); g.fillRect(i * 56, 768 - h - 120, 50, h + 120); }
  for (const [x, y, rr, c] of [[120, 560, 90, "#fff0a8"], [180, 520, 60, "#ffd36b"], [520, 590, 80, "#fff0a8"]] as const) { g.fillStyle = c; g.beginPath(); g.arc(x, y, rr, 0, 7); g.fill(); }
  if (!empty) figure(g, HERO, 320 - 300 * 0.78, 768 - 975 * 0.78 + 10, 0.78, "stern", { pose: "fist", pk: 1, facing: 0 });
  else { // stepped out: white cut-out silhouette with a torn edge
    g.save(); g.translate(320 - 300 * 0.78, 768 - 975 * 0.78 + 10); g.scale(0.78, 0.78);
    const tmp = document.createElement("canvas"); tmp.width = 600; tmp.height = 1000;
    bodyFront(new Pen(tmp.getContext("2d")!), HERO, { mode: "stand", expr: "stern", light: -2.1, seed: 3, pose: "fist", pk: 1 });
    const tg = tmp.getContext("2d")!; tg.globalCompositeOperation = "source-in"; tg.fillStyle = "#fbf6ea"; tg.fillRect(0, 0, 600, 1000);
    g.drawImage(tmp, 0, 0); g.restore();
  }
  // frame
  g.strokeStyle = "#241726"; g.lineWidth = 14; g.strokeRect(7, 7, 626, 754);
});

/** smaller one-sheet posters along the marquee: kind 0 drama, 1 comedy, 2 horror, 3 fantasy */
export const poster = (kind: number) => ctex("poster" + kind, 360, 520, (g, r) => {
  const pal = [["#f3a8b8", "#7a3a6a"], ["#ffe27a", "#f08a2c"], ["#3a4a6a", "#0d1420"], ["#8fd0e8", "#3a6fb0"]][kind];
  sky(g, 360, 520, pal[0], pal[1]);
  if (kind === 0) { // two lovers + a big heart
    g.fillStyle = "#e2453c"; g.beginPath(); g.moveTo(180, 300); g.bezierCurveTo(40, 200, 90, 70, 180, 140); g.bezierCurveTo(270, 70, 320, 200, 180, 300); g.fill();
    figure(g, LEADING, 30, 520 - 975 * 0.42, 0.42, "cry", { facing: 1 });
    figure(g, { ...HERO, hat: "hair", band: undefined, motif: undefined, jacket: "#3f6fb5" }, 150, 520 - 975 * 0.44, 0.44, "stern", { facing: -1 });
  } else if (kind === 1) { // laughing comedian with a frying pan halo
    burst(g, 180, 230, 20, 260, 18, ["#fff3b0", "#ffd36b"]);
    figure(g, { jacket: "#57a35a", pants: "#3b3f52", boots: "#5a3b2a", hat: "cap", cap: "#e2453c" }, 180 - 300 * 0.5, 520 - 975 * 0.5, 0.5, "laugh", { pose: "cheer", pk: 0.5 });
  } else if (kind === 2) { // white lady under a tree, moon
    g.fillStyle = "#f4f0d8"; g.beginPath(); g.arc(260, 110, 50, 0, 7); g.fill();
    g.fillStyle = "#0b0f18"; g.fillRect(40, 140, 26, 380); for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(60 + i * 18, 150 - (i % 2) * 20, 50, 0, 7); g.fill(); }
    g.fillStyle = "#eef3f6"; g.beginPath(); g.moveTo(180, 230); g.quadraticCurveTo(250, 420, 230, 520); g.lineTo(130, 520); g.quadraticCurveTo(110, 420, 180, 230); g.fill();
    g.fillStyle = "#0b0f18"; g.beginPath(); g.ellipse(180, 250, 30, 46, 0, 0, 7); g.fill(); // long black hair over the face
  } else { // fantasy: a hero riding a giant fish
    g.fillStyle = "#f2c33c"; g.beginPath(); g.ellipse(180, 380, 150, 70, -0.15, 0, 7); g.fill();
    g.fillStyle = "#e07a5f"; g.beginPath(); g.moveTo(30, 400); g.lineTo(-10, 330); g.lineTo(-10, 470); g.fill();
    g.fillStyle = "#241726"; g.beginPath(); g.arc(290, 360, 9, 0, 7); g.fill();
    figure(g, { ...HERO, dsash: undefined }, 180 - 300 * 0.36, 330 - 975 * 0.36, 0.36, "grin", { pose: "fist", pk: 1 });
  }
  g.strokeStyle = "#241726"; g.lineWidth = 12; g.strokeRect(6, 6, 348, 508);
});

// ---------------- 1897 Escolta: bahay na bato ----------------
/** stone ground floor (arcade / doors), timber upper floor with capiz sliding windows, at 48 px/m (w x 8 m) */
export const bahayFront = (key: string, wm: number, o: { stone: string; wood: string; trim: string; salon?: boolean }) => {
  const m = 48, W = Math.round(wm * m), H = 8 * m;
  return ctex("bahay" + key, W, H, (g, r) => {
    // upper floor (wood, 4.2-8 m)
    const up = H - 4.2 * m;
    g.fillStyle = o.wood; g.fillRect(0, 0, W, up);
    for (let x = 0; x < W; x += 0.3 * m) { g.fillStyle = jit(r, o.wood, 0.08); g.fillRect(x, 0, 0.3 * m - 2, up); }
    const nW = Math.max(2, Math.floor(wm / 1.6));
    for (let i = 0; i < nW; i++) { // capiz window: grid of translucent shell panes
      const x = (i + 0.08) * (W / nW), w = (W / nW) * 0.84, y = up * 0.18, h = up * 0.58;
      rect(g, x, y, w, h, o.trim, 4);
      const nx = 6, ny = 7;
      for (let a = 0; a < nx; a++) for (let b = 0; b < ny; b++) {
        g.fillStyle = jit(r, "#f6ead0", 0.05); g.fillRect(x + 6 + a * ((w - 12) / nx), y + 6 + b * ((h - 12) / ny), (w - 12) / nx - 3, (h - 12) / ny - 3);
      }
      rect(g, x, y + h, w, up * 0.18, o.trim, 3); // ventanilla below
      for (let a = 0; a < 5; a++) rect(g, x + 4 + a * (w / 5), y + h + 6, 4, up * 0.18 - 12, "#3a2a22");
    }
    g.fillStyle = "rgba(40,25,20,.5)"; g.fillRect(0, up - 6, W, 12); // floor beam
    // stone ground floor
    for (let y = up; y < H; y += 0.35 * m) for (let x = ((y / (0.35 * m)) % 2) * 0.3 * m - 0.3 * m; x < W; x += 0.6 * m) {
      g.fillStyle = jit(r, o.stone, 0.07); g.fillRect(x + 2, y + 2, 0.6 * m - 4, 0.35 * m - 4);
    }
    const nD = Math.max(1, Math.floor(wm / 3));
    for (let i = 0; i < nD; i++) { // arched doors
      const cx = (i + 0.5) * (W / nD), w = 1.5 * m, top = H - 3.1 * m;
      g.fillStyle = o.salon && i === Math.floor(nD / 2) ? "#2a1d1a" : "#5a3b2a";
      g.beginPath(); g.moveTo(cx - w / 2, H - 0.2 * m); g.lineTo(cx - w / 2, top + w / 2); g.arc(cx, top + w / 2, w / 2, Math.PI, 0); g.lineTo(cx + w / 2, H - 0.2 * m); g.fill();
      g.strokeStyle = "rgba(36,23,38,.8)"; g.lineWidth = 5; g.stroke();
      if (o.salon && i === Math.floor(nD / 2)) { // warm interior glow + a painted film-strip emblem over the door (no letters)
        g.fillStyle = "rgba(255,200,120,.35)"; g.fillRect(cx - w / 2 + 6, top + w / 2, w - 12, 2.2 * m);
      } else for (let k = 0; k < 3; k++) rect(g, cx - w / 2 + 8, top + w / 2 + 10 + k * 0.7 * m, w - 16, 0.55 * m, "rgba(0,0,0,.12)");
    }
    g.fillStyle = "rgba(60,40,30,.3)"; g.fillRect(0, H - 0.25 * m, W, 0.25 * m);
  });
};
/** film-strip emblem board over the salon door */
export const salonSign = () => ctex("salonSign", 512, 160, (g) => {
  rect(g, 0, 0, 512, 160, "#3a2a22", 10);
  rect(g, 20, 24, 472, 112, "#efe3c8", 4);
  for (let i = 0; i < 5; i++) { rect(g, 40 + i * 90, 46, 70, 68, ["#c9773f", "#8fb8d8", "#d9a441", "#8fb8d8", "#c9773f"][i], 3); }
  for (let i = 0; i < 18; i++) { rect(g, 30 + i * 26, 30, 12, 10, "#3a2a22"); rect(g, 30 + i * 26, 120, 12, 10, "#3a2a22"); }
});

// ---------------- 1950s studio ----------------
export const hangarWall = () => ctex("hangar", 1024, 512, (g, r) => {
  g.fillStyle = "#c9c2b0"; g.fillRect(0, 0, 1024, 512);
  for (let x = 0; x < 1024; x += 24) { g.fillStyle = jit(r, "#cfc8b6", 0.05); g.fillRect(x, 0, 14, 512); g.fillStyle = "rgba(80,70,60,.18)"; g.fillRect(x + 14, 0, 4, 512); }
  rect(g, 380, 150, 264, 362, "#7a3a32", 8); // big stage door
  for (let y = 180; y < 512; y += 40) { g.fillStyle = "rgba(0,0,0,.14)"; g.fillRect(384, y, 256, 4); }
  for (let i = 0; i < 25; i++) blot(g, U(r, 0, 1024), U(r, 0, 512), U(r, 20, 70), "110,90,70", 0.08);
});
/** film-can lid (top) and side band */
export const canTop = () => ctex("canTop", 256, 256, (g) => {
  g.fillStyle = "#9aa0a8"; g.beginPath(); g.arc(128, 128, 126, 0, 7); g.fill();
  g.strokeStyle = "#5c6068"; g.lineWidth = 8; g.beginPath(); g.arc(128, 128, 100, 0, 7); g.stroke();
  g.fillStyle = "#c9ced4"; g.beginPath(); g.arc(128, 128, 30, 0, 7); g.fill();
});
export const canSide = () => ctex("canSide", 256, 64, (g) => {
  g.fillStyle = "#8d939b"; g.fillRect(0, 0, 256, 64);
  g.fillStyle = "#c3c8ce"; g.fillRect(0, 6, 256, 6);
  g.fillStyle = "#5c6068"; g.fillRect(0, 52, 256, 8);
});
/** flags painted without wind: PH (blue over red, white triangle with sun and stars) and JP (red disc) */
export const flagPH = () => ctex("flagPH", 400, 200, (g) => {
  rect(g, 0, 0, 400, 100, "#1f4fa8"); rect(g, 0, 100, 400, 100, "#d42a2f");
  g.fillStyle = "#fbf8ef"; g.beginPath(); g.moveTo(0, 0); g.lineTo(173, 100); g.lineTo(0, 200); g.fill();
  g.fillStyle = "#f2c33c"; g.beginPath(); g.arc(58, 100, 20, 0, 7); g.fill();
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; g.fillRect(58 + Math.cos(a) * 26 - 4, 100 + Math.sin(a) * 26 - 4, 8, 8); }
  for (const [x, y] of [[14, 24], [14, 176], [140, 100]]) { g.beginPath(); g.arc(x, y, 7, 0, 7); g.fill(); }
});
export const flagJP = () => ctex("flagJP", 300, 200, (g) => {
  rect(g, 0, 0, 300, 200, "#fbf8ef"); g.fillStyle = "#c8323a"; g.beginPath(); g.arc(150, 100, 60, 0, 7); g.fill();
});

// ---------------- home (a modern concrete house, jalousie windows) ----------------
export const homeFront = () => ctex("homeFront", 768, 512, (g, r) => {
  const m = 64; // 12 x 8 m
  plaster(g, r, 768, 512, "#9fd3c7", 40);
  rect(g, 0, 0, 768, 0.4 * m, "#e9d6a8");
  for (const x of [1.0, 7.6]) { // jalousie windows
    rect(g, x * m, 1.6 * m, 3.2 * m, 2.2 * m, "#fbf6ea", 6);
    for (let k = 0; k < 9; k++) { g.fillStyle = k % 2 ? "rgba(140,190,210,.55)" : "rgba(200,230,240,.7)"; g.fillRect(x * m + 8, 1.6 * m + 10 + k * 0.23 * m, 3.2 * m - 16, 0.17 * m); }
    for (let k = 0; k < 5; k++) rect(g, x * m + 4 + k * 0.78 * m, 1.6 * m, 4, 2.2 * m, "#e2453c");
  }
  rect(g, 4.9 * m, 3.9 * m, 2.2 * m, 4.1 * m, "#8a5a34", 6); // door
  rect(g, 5.0 * m, 4.0 * m, 0.95 * m, 3.9 * m, "#9a6a40"); rect(g, 6.05 * m, 4.0 * m, 0.95 * m, 3.9 * m, "#9a6a40");
  g.fillStyle = "#e9c65a"; g.beginPath(); g.arc(5.85 * m, 6.0 * m, 6, 0, 7); g.fill();
  g.fillStyle = "rgba(60,40,40,.25)"; g.fillRect(0, 512 - 0.4 * m, 768, 0.4 * m);
  for (let i = 0; i < 10; i++) blot(g, U(r, 0, 768), U(r, 300, 512), U(r, 20, 60), "60,90,70", 0.1); // damp
});
/** TV picture: villain with a twirled moustache sneering (drama on the table's TV) */
export const tvVillain = () => ctex("tvVillain", 320, 240, (g) => {
  sky(g, 320, 240, "#5a6aa0", "#2a2f5c");
  g.save(); g.translate(160 - 300 * 0.32, 240 - 975 * 0.32 + 120); g.scale(0.32, 0.32);
  bodyFront(new Pen(g), VILLAIN, { mode: "stand", expr: "smile", light: -2.1, seed: 5 });
  g.restore();
  g.fillStyle = "rgba(255,255,255,.07)"; for (let y = 0; y < 240; y += 4) g.fillRect(0, y, 320, 2);
});

// ---------------- palace (white colonial, arched windows) + office ----------------
export const palaceFront = () => ctex("palaceFront", 1280, 640, (g, r) => {
  const m = 64; // 20 x 10 m
  plaster(g, r, 1280, 640, "#f6f1e6", 60);
  for (let fl = 0; fl < 2; fl++) for (let i = 0; i < 7; i++) {
    const cx = (1.6 + i * 2.8) * m, top = fl ? 1.4 * m : 5.9 * m, w = 1.3 * m, h = 2.6 * m;
    if (fl === 1 && i === 3) continue; // balcony door painted separately
    g.fillStyle = "#3a5a7a"; g.beginPath(); g.moveTo(cx - w / 2, top + h); g.lineTo(cx - w / 2, top + w / 2); g.arc(cx, top + w / 2, w / 2, Math.PI, 0); g.lineTo(cx + w / 2, top + h); g.fill();
    g.strokeStyle = "#cdbf9f"; g.lineWidth = 10; g.stroke();
    g.fillStyle = "rgba(190,225,255,.3)"; g.fillRect(cx - w / 2 + 8, top + w / 2, 10, h - w / 2 - 6);
    for (let k = 0; k < 3; k++) rect(g, cx - w / 2, top + w / 2 + k * 0.7 * m, w, 4, "#cdbf9f");
  }
  // balcony door
  const cx = 1.6 * m + 3 * 2.8 * m;
  g.fillStyle = "#2a3d5c"; g.beginPath(); g.moveTo(cx - 0.9 * m, 4.5 * m); g.lineTo(cx - 0.9 * m, 1.6 * m); g.arc(cx, 1.6 * m, 0.9 * m, Math.PI, 0); g.lineTo(cx + 0.9 * m, 4.5 * m); g.fill();
  g.strokeStyle = "#cdbf9f"; g.lineWidth = 12; g.stroke();
  rect(g, 0, 4.6 * m, 1280, 0.3 * m, "#e7dcc4"); rect(g, 0, 0, 1280, 0.35 * m, "#e7dcc4");
  g.fillStyle = "rgba(80,70,60,.2)"; g.fillRect(0, 640 - 0.5 * m, 1280, 0.5 * m);
});
export const officeWall = () => ctex("officeWall", 768, 384, (g, r) => {
  g.fillStyle = "#e9dcc0"; g.fillRect(0, 0, 768, 384);
  for (let i = 0; i < 30; i++) blot(g, U(r, 0, 768), U(r, 0, 220), U(r, 20, 60), "255,255,255", 0.06);
  for (let x = 0; x < 768; x += 64) { rect(g, x, 220, 60, 164, jit(r, "#8a5a34", 0.06)); rect(g, x + 8, 232, 44, 140, jit(r, "#7a4b2a", 0.06), 2); }
  rect(g, 0, 214, 768, 10, "#5a3b2a");
  // window with jalousie light
  rect(g, 520, 30, 190, 150, "#bfe6ff", 6);
  for (let k = 0; k < 6; k++) rect(g, 520, 30 + k * 25, 190, 6, "#f6f1e6");
  // presidential seal-like round plaque (no letters)
  g.fillStyle = "#f2c33c"; g.beginPath(); g.arc(200, 100, 64, 0, 7); g.fill(); g.strokeStyle = "#241726"; g.lineWidth = 5; g.stroke();
  g.fillStyle = "#1f4fa8"; g.beginPath(); g.arc(200, 100, 46, 0, 7); g.fill();
  burst(g, 200, 100, 8, 34, 16, ["#f2c33c", "#fbf8ef"]);
});
/** sheet-stack side: paper edges */
export const paperSide = () => ctex("paperSide", 128, 256, (g, r) => {
  g.fillStyle = "#f7f3e8"; g.fillRect(0, 0, 128, 256);
  for (let y = 0; y < 256; y += 3) { g.fillStyle = r() > 0.5 ? "rgba(150,140,120,.25)" : "rgba(255,255,255,.4)"; g.fillRect(0, y, 128, 1); }
  for (let i = 0; i < 6; i++) rect(g, 0, U(r, 0, 250), 128, 4, ["#e9b04a", "#8fb8d8", "#e07a5f"][i % 3]);
});

// ---------------- the big screen: 1897 (sepia, a galloping horse) / modern (hero chase) ----------------
const horse = (g: CanvasRenderingContext2D, x: number, y: number, s: number, ph: number) => {
  g.save(); g.translate(x, y); g.scale(s, s); g.fillStyle = "#2a1d14"; g.strokeStyle = "#2a1d14"; g.lineCap = "round";
  g.beginPath(); g.ellipse(0, 0, 70, 30, 0, 0, 7); g.fill();                              // body
  g.beginPath(); g.moveTo(55, -10); g.lineTo(95, -55); g.lineTo(118, -50); g.lineTo(80, 5); g.fill(); // neck + head
  g.lineWidth = 12;
  const legs = [[-45, 0.0], [-30, 0.5], [40, 0.25], [55, 0.75]];
  for (const [lx, p] of legs) { const a = Math.sin((ph + p) * Math.PI * 2) * 0.6; g.beginPath(); g.moveTo(lx, 20); g.lineTo(lx + Math.sin(a) * 60, 20 + Math.cos(a) * 60); g.stroke(); }
  g.lineWidth = 10; g.beginPath(); g.moveTo(-68, -8); g.quadraticCurveTo(-110, 0, -100, 40); g.stroke(); // tail
  g.restore();
};
export const screenFrame = (era: "old" | "new", k: number) => ctex(`screen_${era}_${k}`, 512, 288, (g, r) => {
  if (era === "old") {
    g.fillStyle = "#efe2c4"; g.fillRect(0, 0, 512, 288);
    g.fillStyle = "#c9b38c"; g.fillRect(0, 200, 512, 88);
    horse(g, 160 + k * 60, 170, 1.0, k / 4);
    g.fillStyle = "rgba(60,40,20,.25)"; for (let i = 0; i < 14; i++) g.fillRect(U(r, 0, 512), 0, 1.5, 288); // scratches
    const gr = g.createRadialGradient(256, 144, 80, 256, 144, 300); gr.addColorStop(0, "rgba(0,0,0,0)"); gr.addColorStop(1, "rgba(60,40,20,.55)"); g.fillStyle = gr; g.fillRect(0, 0, 512, 288);
  } else {
    sky(g, 512, 288, "#f6b04a", "#d8452f");
    burst(g, 330, 150, 20, 300, 22, ["#ffd36b", "#f29a3a"]);
    g.save(); g.translate(140 + k * 14 - 300 * 0.3, 288 - 975 * 0.3 + 10); g.scale(0.3, 0.3);
    bodyFront(new Pen(g), HERO, { mode: "stand", expr: "stern", light: -2.1, seed: 3, pose: k % 2 ? "fist" : "hips", pk: 1 });
    g.restore();
    g.save(); g.translate(360 - 300 * 0.27, 288 - 975 * 0.27 + 10); g.scale(0.27, 0.27);
    bodyFront(new Pen(g), VILLAIN, { mode: "stand", expr: "shock", light: -2.1, seed: 5 });
    g.restore();
  }
});

// ---------------- parol (star lantern), drawn flat; emissive card ----------------
export const parolTex = (col: string) => ctex("parol" + col, 256, 384, (g) => {
  const p = new Pen(g), cx = 128, cy = 128, R = 110, r0 = 46, pts: [number, number][] = [];
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r0 : R; pts.push([cx + rr * Math.cos(a), cy + rr * Math.sin(a)]); }
  p.poly(pts, col, 6);
  p.ell(cx, cy, 30, 30, "#fff3c8", 4);
  for (const s of [-1, 1]) p.poly([[cx + s * 22, cy + 70], [cx + s * 34, cy + 240], [cx + s * 12, cy + 250], [cx + s * 6, cy + 74]], "#fff3c8", 4); // tails
  for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5; p.stroke([[cx + 32 * Math.cos(a), cy + 32 * Math.sin(a)], [cx + 96 * Math.cos(a), cy + 96 * Math.sin(a)]], 3, INK); }
});
export const bulbTex = () => ctex("bulb", 64, 64, (g) => {
  const gr = g.createRadialGradient(32, 32, 4, 32, 32, 30); gr.addColorStop(0, "rgba(255,250,220,1)"); gr.addColorStop(0.5, "rgba(255,220,140,1)"); gr.addColorStop(1, "rgba(255,200,120,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
});
export const beamTex = () => ctex("projBeam", 64, 256, (g) => {
  const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, "rgba(255,255,255,.0)"); gr.addColorStop(0.15, "rgba(220,230,255,.35)"); gr.addColorStop(1, "rgba(220,230,255,.06)");
  g.fillStyle = gr; g.fillRect(0, 0, 64, 256);
  const gx = g.createLinearGradient(0, 0, 64, 0); gx.addColorStop(0, "rgba(0,0,0,1)"); gx.addColorStop(0.5, "rgba(0,0,0,0)"); gx.addColorStop(1, "rgba(0,0,0,1)");
  g.globalCompositeOperation = "destination-out"; g.fillStyle = gx; g.fillRect(0, 0, 64, 256);
});
/** food: lechon (roast pig) as a painted card, ham, queso de bola, pancit */
export const lechonTex = () => ctex("lechon", 512, 256, (g) => {
  const p = new Pen(g);
  p.ell(256, 200, 240, 40, "#7aa84a", 6); // banana-leaf tray
  p.ell(250, 150, 180, 72, "#c8642e", 7);
  p.ell(250, 128, 150, 40, "#e0894a", 0);
  p.ell(410, 135, 52, 46, "#c8642e", 7);                    // head
  p.ell(452, 140, 14, 12, "#e2453c", 4);                    // apple
  p.ell(400, 120, 6, 6, INK, 0);
  p.poly([[90, 110], [60, 80], [96, 96]], "#c8642e", 5);    // tail curl
  for (let i = 0; i < 6; i++) p.stroke([[150 + i * 35, 105], [140 + i * 35, 190]], 3, "rgba(120,50,20,.6)");
});
export const foodTex = (kind: number) => ctex("food" + kind, 256, 160, (g) => {
  const p = new Pen(g);
  p.ell(128, 120, 112, 30, "#f7f4ec", 5);
  if (kind === 0) { p.ell(128, 92, 70, 50, "#d9785a", 5); p.ell(128, 70, 40, 18, "#f2a08f", 0); }          // ham
  else if (kind === 1) { p.ell(128, 80, 54, 54, "#e2453c", 5); p.ell(110, 64, 16, 10, "#ff8a7a", 0); }      // queso de bola
  else if (kind === 2) { for (let i = 0; i < 9; i++) p.stroke([[60 + i * 14, 112], [80 + i * 12, 80], [70 + i * 15, 100]], 5, "#f3cf7a"); p.ell(150, 88, 12, 8, "#e2453c", 2); } // pancit/spaghetti
  else { p.ell(128, 100, 80, 26, "#f3e3c2", 4); for (let i = 0; i < 5; i++) p.ell(80 + i * 24, 92, 9, 7, "#fff6d8", 2); }                   // rice
});
export const THREE_ = THREE;
