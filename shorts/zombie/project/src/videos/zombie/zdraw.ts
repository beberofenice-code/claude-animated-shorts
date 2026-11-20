// Zombie short: extra flat drawings (our own designs) on the Pen API of toon.ts. Characters stay in the
// 600 x 1000 design card (soles at y = 975); effect drawings use their own canvas size (cw x ch).
import { Pen, INK, mul, shade } from "./toon";

type P2 = [number, number];
const rad = (d: number) => (d * Math.PI) / 180;

/** zombie chicken, standing, facing screen right, in the 600 x 1000 card (about 470 units tall) */
export const chicken = (p: Pen, o: { blink?: number; beak?: number; tilt?: number; look?: number; bob?: number } = {}) => {
  const { blink = 0, beak = 0, tilt = 0, bob = 0 } = o;
  const by = 975 - 150 - bob * 10;
  // legs
  for (const dx of [-30, 25]) {
    p.stroke([[300 + dx, by + 70], [300 + dx + 4, 965]], 11, "#e3a33a");
    p.stroke([[300 + dx - 26, 972], [300 + dx + 34, 972]], 10, "#e3a33a");
    p.stroke([[300 + dx + 4, 972], [300 + dx + 22, 958]], 8, "#e3a33a");
  }
  p.rot = tilt ? [rad(tilt), 300, by + 60] : null;
  // tail feathers
  p.poly([[180, by - 10], [118, by - 120], [150, by - 60], [120, by - 70], [175, by + 20]], "#f2efe6", 6);
  // body
  const body: P2[] = [];
  for (let i = 0; i < 48; i++) { const a = (i / 48) * Math.PI * 2; body.push([300 + 125 * Math.cos(a) * (Math.cos(a) > 0 ? 1.05 : 1), by + 88 * Math.sin(a)]); }
  p.shadedFill(body, "#f4f1e8", "#c9c6d6", rad(-120), 125);
  p.inkRing(body, 6, 0.6);
  // a few scruffy feathers + one patch of stitches (it is a zombie)
  p.stroke([[250, by + 10], [300, by + 30], [345, by + 12]], 4, "#bdb8c8");
  p.stroke([[220, by + 40], [262, by + 58]], 4, "#bdb8c8");
  p.stroke([[330, by + 46], [380, by + 40]], 4, INK);
  for (const x of [340, 352, 364, 376]) p.stroke([[x, by + 36], [x + 2, by + 50]], 3, INK);
  // neck + head
  const hx = 395, hy = by - 135;
  p.poly([[340, by - 30], [372, by - 120], [420, by - 115], [420, by - 10]], "#f4f1e8", 0);
  const head: P2[] = [];
  for (let i = 0; i < 40; i++) { const a = (i / 40) * Math.PI * 2; head.push([hx + 58 * Math.cos(a), hy + 62 * Math.sin(a)]); }
  p.shadedFill(head, "#f4f1e8", "#d4d0de", rad(-120), 60);
  p.stroke([[340, by - 28], [372, by - 112]], 6, INK);
  p.stroke([[421, by - 112], [425, by - 18]], 6, INK);
  p.inkRing(head, 6, 0.6);
  // comb + wattle
  p.poly([[355, hy - 52], [362, hy - 92], [385, hy - 62], [398, hy - 102], [412, hy - 62], [432, hy - 88], [440, hy - 46]], "#e2453c", 5);
  p.ell(452, hy + 44, 14, 22, "#e2453c", 4);
  // beak (opens on "moan")
  const bo = 10 + beak * 22;
  p.poly([[447, hy - 6], [500, hy + 6], [447, hy + 12]], "#f0b43c", 4);
  p.poly([[447, hy + 14], [490, hy + 14 + bo * 0.6], [447, hy + 14 + bo * 0.5]], "#e09a28", 4);
  // eyes: one wide, one droopy (deadpan undead)
  p.ell(418, hy - 14, 17, 17, "#ffffff", 4);
  p.dot(424, hy - 12, 7);
  if (blink > 0.5) p.ell(418, hy - 14, 17, 17, "#f4f1e8", 4, 180, 360);
  p.ell(372, hy - 10, 13, 6, INK, 0, 0, 180);
  p.stroke([[358, hy - 12], [386, hy - 12]], 4);
  p.rot = null;
};

/** dead satellite: box body, two solar wings, dish; ink lines (cw = ch = 600) */
export const satellite = (p: Pen, spin = 0) => {
  p.rot = [rad(spin), 300, 300];
  for (const s of [-1, 1]) {
    const x0 = 300 + s * 70, x1 = 300 + s * 270;
    p.poly([[x0, 250], [x1, 250], [x1, 350], [x0, 350]], "#2d4f9a", 6);
    for (let k = 1; k < 4; k++) p.stroke([[x0 + (x1 - x0) * k / 4, 250], [x0 + (x1 - x0) * k / 4, 350]], 3, "#8fb3ff");
    p.stroke([[x0, 300], [x1, 300]], 3, "#8fb3ff");
  }
  p.poly([[230, 210], [370, 210], [370, 390], [230, 390]], "#d9b84a", 7);
  p.stroke([[230, 300], [370, 300]], 4, "#a8892c");
  p.ell(300, 175, 46, 20, "#e8e8ee", 6);
  p.stroke([[300, 175], [300, 120]], 6);
  p.dot(300, 116, 9);
  p.rot = null;
};

/** backpack (cw 400 x ch 460) */
export const backpack = (p: Pen, col = "#d9572e") => {
  p.poly([[90, 120], [310, 120], [340, 440], [60, 440]], col, 8);
  p.poly([[110, 260], [290, 260], [300, 400], [100, 400]], shade(col, 0.85), 6);
  p.arc(200, 120, 70, 70, 180, 360, 14, shade(col, 0.6));
  p.poly([[80, 120], [320, 120], [300, 190], [100, 190]], shade(col, 0.75), 7);
};
/** CDC list items (cw = ch = 300), drawn around (150, 150) */
export const item = (p: Pen, k: "water" | "food" | "flash" | "meds" | "aid") => {
  switch (k) {
    case "water":
      p.poly([[110, 80], [190, 80], [200, 270], [100, 270]], "#7fc4f0", 7);
      p.poly([[125, 40], [175, 40], [175, 80], [125, 80]], "#2f6fd0", 6);
      p.stroke([[110, 150], [195, 150]], 4, "#ffffff");
      break;
    case "food":
      p.poly([[80, 90], [220, 90], [220, 250], [80, 250]], "#c7ccd4", 7);
      p.poly([[80, 130], [220, 130], [220, 210], [80, 210]], "#e2453c", 6);
      p.ell(150, 90, 70, 16, "#dde1e8", 6);
      break;
    case "flash":
      p.poly([[60, 120], [180, 120], [180, 180], [60, 180]], "#3a3d47", 7);
      p.poly([[180, 105], [240, 90], [240, 210], [180, 195]], "#f2c94c", 7);
      p.stroke([[100, 120], [100, 180]], 4, "#8d949c");
      break;
    case "meds":
      p.poly([[100, 110], [200, 110], [200, 260], [100, 260]], "#f08a2c", 7);
      p.poly([[92, 70], [208, 70], [208, 110], [92, 110]], "#ffffff", 6);
      p.poly([[115, 150], [185, 150], [185, 220], [115, 220]], "#ffffff", 4);
      break;
    case "aid":
      p.poly([[50, 90], [250, 90], [250, 240], [50, 240]], "#ffffff", 7);
      p.poly([[130, 120], [170, 120], [170, 145], [195, 145], [195, 185], [170, 185], [170, 210], [130, 210], [130, 185], [105, 185], [105, 145], [130, 145]], "#e2453c", 4);
      p.arc(150, 90, 40, 26, 180, 360, 8);
      break;
  }
};
/** comic book, cover only (no readable text): a zombie silhouette and burst (cw 300 x ch 400) */
export const comic = (p: Pen) => {
  p.poly([[30, 30], [270, 30], [270, 370], [30, 370]], "#ffd84a", 8);
  p.poly([[30, 30], [270, 30], [270, 95], [30, 95]], "#e2453c", 6);
  p.ell(150, 250, 95, 95, "#ffffff", 5);
  p.ell(150, 215, 32, 34, "#8fbf6a", 5);
  p.poly([[110, 250], [190, 250], [200, 330], [100, 330]], "#6a7fb0", 5);
  p.stroke([[110, 260], [60, 245]], 9); p.stroke([[190, 260], [240, 245]], 9);
  p.ell(138, 210, 6, 3, INK, 0); p.dot(162, 210, 5); p.ell(150, 232, 8, 10, "#5a1e28", 3);
};
/** screen faces for the monitors (cw 640 x ch 400): blog page with a zombie picture, or crashed */
export const screen = (p: Pen, k: "blog" | "crash" | "off", t = 0) => {
  if (k === "off") { p.poly([[0, 0], [640, 0], [640, 400], [0, 400]], "#141820", 0); return; }
  if (k === "crash") {
    p.poly([[0, 0], [640, 0], [640, 400], [0, 400]], "#2a3b8f", 0);
    p.ell(320, 180, 70, 70, null, 12, 0, 360);
    p.dot(295, 160, 10, "#ffffff"); p.dot(345, 160, 10, "#ffffff");
    p.arc(320, 225, 40, 22, 200, 340, 10, "#ffffff");
    for (let i = 0; i < 6; i++) p.stroke([[60 + i * 90, 300 + 6 * Math.sin(t * 9 + i)], [110 + i * 90, 300 + 6 * Math.sin(t * 9 + i)]], 10, "#c8d2ff");
    return;
  }
  p.poly([[0, 0], [640, 0], [640, 400], [0, 400]], "#f4f6fb", 0);
  p.poly([[0, 0], [640, 0], [640, 60], [0, 60]], "#2f6fd0", 0);
  p.poly([[40, 100], [300, 100], [300, 340], [40, 340]], "#cfe5c0", 4);
  p.ell(170, 190, 38, 40, "#8fbf6a", 4); p.poly([[120, 230], [220, 230], [230, 330], [110, 330]], "#6a7fb0", 4);
  p.stroke([[125, 245], [70, 225]], 10); p.stroke([[215, 245], [270, 225]], 10);
  for (let i = 0; i < 6; i++) p.stroke([[340, 110 + i * 38], [600 - (i % 3) * 40, 110 + i * 38]], 12, "#b7c0d4");
};
/** zombie-types board (canvas 1024 x 640): cork with four pinned pictures (no words) */
export const typesBoard = (p: Pen) => {
  p.poly([[0, 0], [1024, 0], [1024, 640], [0, 640]], "#c99a5e", 0);
  for (let i = 0; i < 300; i++) p.dot((i * 397) % 1024, (i * 211) % 640, 3, "#b08550");
  const card = (x: number, y: number, bg: string, draw: () => void) => {
    p.poly([[x, y], [x + 210, y], [x + 210, y + 250], [x, y + 250]], "#fbf8f1", 5);
    p.poly([[x + 15, y + 15], [x + 195, y + 15], [x + 195, y + 200], [x + 15, y + 200]], bg, 3);
    draw();
    p.dot(x + 105, y + 12, 11, "#e2453c");
  };
  const zom = (x: number, y: number, skin: string, extra?: () => void) => {
    p.ell(x, y, 34, 36, skin, 4); p.poly([[x - 40, y + 36], [x + 40, y + 36], [x + 46, y + 120], [x - 46, y + 120]], "#6a7fb0", 4);
    p.stroke([[x - 36, y + 50], [x - 80, y + 40]], 8); p.stroke([[x + 36, y + 50], [x + 80, y + 40]], 8);
    p.ell(x - 12, y - 4, 7, 3, INK, 0); p.dot(x + 12, y - 4, 5); extra?.();
  };
  card(60, 60, "#d8f5b0", () => { p.ell(165, 170, 80, 80, "#b8f06a", 0); zom(165, 140, "#9ee86a"); });
  card(300, 40, "#d9d2f5", () => zom(405, 150, "#a6c98a", () => p.poly([[370, 125], [440, 125], [415, 60]], "#4b3a9a", 4)));
  card(540, 70, "#cfe8f5", () => { p.ell(645, 160, 70, 18, "#2d4f9a", 4); p.poly([[620, 135], [670, 135], [670, 185], [620, 185]], "#d9b84a", 4); });
  card(780, 50, "#f5e6cf", () => { p.ell(870, 170, 55, 38, "#f4f1e8", 4); p.ell(905, 120, 26, 28, "#f4f1e8", 4); p.poly([[890, 95], [900, 78], [915, 95]], "#e2453c", 3); p.poly([[928, 118], [955, 124], [928, 130]], "#f0b43c", 3); });
  for (let i = 0; i < 3; i++) p.stroke([[120 + i * 300, 420], [330 + i * 300, 560]], 6, "#e2453c");
};
/** world map with zombie pins (canvas 1024 x 640) */
export const mapTex = (p: Pen) => {
  p.poly([[0, 0], [1024, 0], [1024, 640], [0, 640]], "#7fb6d9", 0);
  const land = (pts: P2[]) => p.poly(pts, "#cfe0a0", 4);
  land([[90, 120], [330, 90], [360, 220], [260, 330], [200, 300], [120, 240]]);
  land([[260, 360], [330, 370], [320, 560], [270, 540]]);
  land([[480, 100], [600, 80], [640, 200], [560, 250], [500, 200]]);
  land([[520, 270], [620, 260], [640, 470], [560, 520], [520, 400]]);
  land([[650, 90], [920, 110], [950, 260], [800, 330], [680, 260]]);
  land([[820, 420], [940, 410], [960, 500], [840, 520]]);
  for (let i = 0; i < 40; i++) p.stroke([[(i * 173) % 1024, (i * 97) % 640], [(i * 173) % 1024 + 18, (i * 97) % 640]], 2, "#9fcbe6");
};
/** Stars and Stripes, simplified (canvas 512 x 270) */
export const usFlag = (p: Pen) => {
  for (let i = 0; i < 13; i++) p.poly([[0, i * 20.8], [512, i * 20.8], [512, (i + 1) * 20.8], [0, (i + 1) * 20.8]], i % 2 ? "#f4f1ea" : "#c0353a", 0);
  p.poly([[0, 0], [205, 0], [205, 145], [0, 145]], "#2c3f7a", 0);
  for (let r = 0; r < 9; r++) for (let c = 0; c < (r % 2 ? 5 : 6); c++) p.dot(17 + c * 34 + (r % 2 ? 17 : 0), 10 + r * 15.5, 4.2, "#f4f1ea");
};
/** wind swirl (cw = ch = 400) */
export const wind = (p: Pen, t: number) => {
  for (let k = 0; k < 3; k++) {
    const pts: P2[] = [];
    for (let i = 0; i < 30; i++) { const a = i * 0.35 + t * 8 + k * 2; const r = 40 + i * 4.5; pts.push([200 + r * Math.cos(a), 200 + r * Math.sin(a) * 0.55 + (k - 1) * 70]); }
    p.stroke(pts, 9, "#eef4ff");
  }
};
/** rain streaks (cw = ch = 400) */
export const rain = (p: Pen, t: number) => {
  for (let i = 0; i < 40; i++) {
    const x = (i * 97 + t * 900 * 0.2) % 420 - 10, y = (i * 61 + t * 900) % 440 - 20;
    p.stroke([[x, y], [x - 8, y + 40]], 5, "#bfe3ff");
  }
};
/** green glow behind the radiation zombie (soft card, cw = ch = 256) */
export const glow = (g: CanvasRenderingContext2D, a = 1) => {
  const r = g.createRadialGradient(128, 128, 10, 128, 128, 128);
  r.addColorStop(0, `rgba(190,255,120,${0.85 * a})`); r.addColorStop(0.5, `rgba(150,255,80,${0.35 * a})`); r.addColorStop(1, "rgba(150,255,80,0)");
  g.fillStyle = r; g.fillRect(0, 0, 256, 256);
};
/** an open binder lying on the desk (canvas 1024 x 640, seen from above): two pages of zombie sketches */
export const binderPages = (p: Pen) => {
  p.poly([[0, 0], [1024, 0], [1024, 640], [0, 640]], "#b23a3a", 0);
  for (const x0 of [30, 530]) {
    p.poly([[x0, 30], [x0 + 464, 30], [x0 + 464, 610], [x0, 610]], "#fbf6e6", 4);
    for (let i = 0; i < 9; i++) p.stroke([[x0 + 40, 300 + i * 32], [x0 + 420 - (i % 4) * 50, 300 + i * 32]], 8, "#9aa4b8");
    p.ell(x0 + 230, 150, 60, 64, "#c6dcae", 4); p.dot(x0 + 210, 140, 7); p.ell(x0 + 252, 140, 9, 4, INK, 0);
  }
  for (let i = 0; i < 6; i++) p.ell(512, 80 + i * 95, 12, 12, "#9aa0aa", 4);
};
export { mul };
/** grey smoke puff (cw = ch = 300) */
export const smoke = (p: Pen, t: number) => {
  for (let i = 0; i < 5; i++) {
    const a = rad(150 + i * 60), d = 30 + 40 * t, r = (40 + 18 * (i % 2)) * (0.6 + 0.6 * t);
    p.ell(150 + d * Math.cos(a), 160 + d * 0.6 * Math.sin(a), r, r * 0.85, `rgba(110,108,120,${(0.85 * (1 - t)).toFixed(3)})`, 0);
  }
};
