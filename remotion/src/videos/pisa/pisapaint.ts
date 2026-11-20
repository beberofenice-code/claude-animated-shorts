// Painted textures for the Pisa set: marble arcades of the tower (one bay per repeat), the bell chamber, the striped
// cathedral walls, wet clay for the foundation pit, beach sand, the 1990 dirt. Same hand-painted rules as paint.ts:
// seams painted in as dark tints (no hard ink lines), soft per-block jitter, no pure greys (they read lilac in shade).
import { ctex, jit } from "./paint";

const TAU = Math.PI * 2;
const MARBLE = ["#f2e9d6", "#ebe0ca", "#f6efe0", "#e4d8c0", "#efe4cf"];
const SEAM = "rgba(150,128,98,0.55)";
type G = CanvasRenderingContext2D;

/** stone courses: rows of jittered marble blocks with painted seams over the whole canvas area (x0..x1, y0..y1) */
const courses = (g: G, r: () => number, x0: number, y0: number, x1: number, y1: number, rowH: number, cols = MARBLE) => {
  for (let y = y0, row = 0; y < y1; y += rowH, row++) {
    let x = x0 - (row % 2) * rowH * 1.3;
    while (x < x1) {
      const w = rowH * (2 + r() * 1.6);
      g.fillStyle = jit(r, cols[Math.floor(r() * cols.length)], 0.035, 3, 0.1);
      g.fillRect(x, y, w, rowH);
      g.fillStyle = "rgba(255,252,240,0.25)"; g.fillRect(x + 2, y + 1, w - 4, 3);
      g.fillStyle = SEAM; g.fillRect(x, y, 2.5, rowH); g.fillRect(x, y + rowH - 2.5, w, 2.5);
      x += w;
    }
  }
};
const archPath = (g: G, cx: number, spring: number, rad: number, bottom: number) => {
  g.beginPath(); g.moveTo(cx - rad, bottom); g.lineTo(cx - rad, spring); g.arc(cx, spring, rad, Math.PI, 0); g.lineTo(cx + rad, bottom); g.closePath();
};

/** ground floor, one blind-arcade bay (2.93 m x 11 m): coursed marble, a recessed arch with a lozenge, a soft inner shade */
export const blindBay = () => ctex("pisaBlindBay", 512, 1920, (g, r) => {
  courses(g, r, 0, 0, 512, 1920, 64);
  const cx = 256, rad = 196, spring = 560;
  archPath(g, cx, spring, rad, 1920 - 140);
  g.fillStyle = "rgba(120,96,70,0.22)"; g.fill();
  g.save(); archPath(g, cx, spring, rad, 1920 - 140); g.clip();
  const sh = g.createLinearGradient(cx - rad, 0, cx + rad, 0);
  sh.addColorStop(0, "rgba(90,70,60,0.28)"); sh.addColorStop(0.25, "rgba(90,70,60,0.06)"); sh.addColorStop(1, "rgba(90,70,60,0)");
  g.fillStyle = sh; g.fillRect(0, 0, 512, 1920);
  const top = g.createLinearGradient(0, spring - rad, 0, spring + 120);
  top.addColorStop(0, "rgba(80,60,55,0.3)"); top.addColorStop(1, "rgba(80,60,55,0)");
  g.fillStyle = top; g.fillRect(0, 0, 512, 1920);
  g.restore();
  g.lineWidth = 9; g.strokeStyle = "rgba(120,98,72,0.6)";
  g.beginPath(); g.arc(cx, spring, rad + 6, Math.PI, 0); g.stroke();
  // lozenge in the lunette (green-grey inlay) and a band of rosettes
  g.fillStyle = "#8f9f8a"; g.beginPath(); g.moveTo(cx, spring - 150); g.lineTo(cx + 54, spring - 70); g.lineTo(cx, spring + 10); g.lineTo(cx - 54, spring - 70); g.closePath(); g.fill();
  g.strokeStyle = "rgba(90,80,64,0.6)"; g.lineWidth = 5; g.stroke();
  g.fillStyle = "rgba(110,90,64,0.35)"; g.fillRect(0, 1920 - 140, 512, 10);
});

/** one gallery bay of the arch band (1.52 m x 1.9 m): marble with a round open arch (transparent) and its moulding */
export const archBay = () => ctex("pisaArchBay", 256, 320, (g, r) => {
  courses(g, r, 0, 0, 256, 320, 40);
  const cx = 128, rad = 104, spring = 188;
  g.lineWidth = 16; g.strokeStyle = jit(r, "#e6dac2", 0.02); g.beginPath(); g.arc(cx, spring, rad + 8, Math.PI, 0); g.stroke();
  g.lineWidth = 3; g.strokeStyle = "rgba(130,105,78,0.7)"; g.beginPath(); g.arc(cx, spring, rad + 16, Math.PI, 0); g.stroke();
  g.globalCompositeOperation = "destination-out";
  archPath(g, cx, spring, rad, 330); g.fill();
  g.globalCompositeOperation = "source-over";
  g.fillStyle = "rgba(120,96,70,0.35)"; g.fillRect(0, 0, 256, 8);
});

/** the gallery's inner wall (seen through the arches): darker marble with a door every few bays */
export const innerWall = () => ctex("pisaInner", 512, 512, (g, r) => {
  courses(g, r, 0, 0, 512, 512, 48, ["#ddd0b6", "#d4c6aa", "#e2d6be"]);
  g.fillStyle = "rgba(70,52,52,0.12)"; g.fillRect(0, 0, 512, 512);
  g.fillStyle = "#5a4446"; archPath(g, 256, 250, 60, 512); g.fill();
  g.fillStyle = "rgba(40,28,34,0.45)"; archPath(g, 248, 262, 46, 512); g.fill();
});

/** bell chamber bay (2.46 m x 6.2 m): coursed marble, a tall arched opening into the dark with a bell's lip */
export const bellBay = () => ctex("pisaBellBay", 384, 960, (g, r) => {
  courses(g, r, 0, 0, 384, 960, 54);
  const cx = 192, rad = 104, spring = 300;
  g.fillStyle = "#43323a"; archPath(g, cx, spring, rad, 860); g.fill();
  const sh = g.createLinearGradient(0, spring - rad, 0, 860);
  sh.addColorStop(0, "rgba(20,12,18,0.6)"); sh.addColorStop(1, "rgba(20,12,18,0)");
  g.fillStyle = sh; archPath(g, cx, spring, rad, 860); g.fill();
  g.fillStyle = "#8a6a3a"; g.beginPath(); g.moveTo(cx - 70, 560); g.quadraticCurveTo(cx, 330, cx + 70, 560); g.closePath(); g.fill();
  g.lineWidth = 10; g.strokeStyle = jit(r, "#e6dac2", 0.02); g.beginPath(); g.arc(cx, spring, rad + 8, Math.PI, 0); g.stroke();
  g.fillStyle = "rgba(110,90,64,0.4)"; g.fillRect(0, 860, 384, 12);
});

/** cathedral walls: white marble with grey-green bands every course pair, one row of blind arches per 512 px */
export const duomoWall = () => ctex("pisaDuomo", 1024, 1024, (g, r) => {
  for (let y = 0, i = 0; y < 1024; y += 48, i++) {
    const band = i % 3 === 2;
    courses(g, r, 0, y, 1024, y + 48, 48, band ? ["#9aa596", "#8f9a8b", "#a3ae9f"] : MARBLE);
  }
  for (let k = 0; k < 4; k++) {
    const cx = 128 + k * 256, spring = 420, rad = 92;
    g.fillStyle = "rgba(110,90,70,0.25)"; archPath(g, cx, spring, rad, 1024); g.fill();
    g.lineWidth = 10; g.strokeStyle = "rgba(255,250,236,0.6)"; g.beginPath(); g.arc(cx, spring, rad + 6, Math.PI, 0); g.stroke();
    g.fillStyle = "#4a3a44"; archPath(g, cx, spring + 60, 32, spring + 220); g.fill(); // slit window
  }
});

/** wet clay: warm brown with darker smears, glossy puddles and a few pebbles */
export const clayHD = () => ctex("pisaClay", 1024, 1024, (g, r) => {
  g.fillStyle = "#7d5a40"; g.fillRect(0, 0, 1024, 1024);
  for (let i = 0; i < 70; i++) {
    const x = r() * 1024, y = r() * 1024, rad = 30 + r() * 120;
    const gr = g.createRadialGradient(x, y, 0, x, y, rad);
    const c = r() < 0.5 ? "110,72,46" : "150,108,72";
    gr.addColorStop(0, `rgba(${c},0.5)`); gr.addColorStop(1, `rgba(${c},0)`);
    g.fillStyle = gr; g.fillRect(x - rad, y - rad, 2 * rad, 2 * rad);
  }
  g.lineCap = "round";
  for (let i = 0; i < 90; i++) { // spade marks
    const x = r() * 1024, y = r() * 1024, a = r() * TAU, l = 20 + r() * 50;
    g.strokeStyle = "rgba(90,58,38,0.45)"; g.lineWidth = 5 + r() * 6;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
  }
  for (let i = 0; i < 3; i++) { // puddles
    const x = 80 + r() * 860, y = 80 + r() * 860, rx = 30 + r() * 40, ry = rx * (0.5 + r() * 0.3);
    g.fillStyle = "#6f7f8e"; g.beginPath(); g.ellipse(x, y, rx, ry, r(), 0, TAU); g.fill();
    g.fillStyle = "rgba(205,220,232,0.55)"; g.beginPath(); g.ellipse(x - rx * 0.25, y - ry * 0.3, rx * 0.45, ry * 0.18, -0.3, 0, TAU); g.fill();
    g.strokeStyle = "rgba(70,44,30,0.6)"; g.lineWidth = 5; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, TAU); g.stroke();
  }
});

/** beach sand (dry = pale warm, wet = darker with a sheen) */
export const sandHD = (wet: boolean) => ctex(wet ? "pisaSandWet" : "pisaSand", 1024, 1024, (g, r) => {
  g.fillStyle = wet ? "#bf9a68" : "#ecd3a0"; g.fillRect(0, 0, 1024, 1024);
  for (let i = 0; i < 40; i++) {
    const x = r() * 1024, y = r() * 1024, rad = 60 + r() * 160;
    const gr = g.createRadialGradient(x, y, 0, x, y, rad);
    const c = wet ? (r() < 0.5 ? "160,124,82" : "212,184,140") : (r() < 0.5 ? "222,190,138" : "248,228,186");
    gr.addColorStop(0, `rgba(${c},0.45)`); gr.addColorStop(1, `rgba(${c},0)`);
    g.fillStyle = gr; g.fillRect(x - rad, y - rad, 2 * rad, 2 * rad);
  }
  for (let i = 0; i < 2500; i++) {
    g.fillStyle = r() < 0.5 ? "rgba(120,90,60,0.25)" : "rgba(255,250,235,0.35)";
    g.fillRect(r() * 1024, r() * 1024, 2, 2);
  }
  if (wet) for (let i = 0; i < 14; i++) { // sheen streaks
    const x = r() * 1024, y = r() * 1024, w = 80 + r() * 200;
    g.fillStyle = "rgba(230,240,248,0.22)"; g.beginPath(); g.ellipse(x, y, w, 10 + r() * 12, 0, 0, TAU); g.fill();
  }
  else for (let i = 0; i < 16; i++) { // ripples
    const y = r() * 1024, x = r() * 1024;
    g.strokeStyle = "rgba(190,150,100,0.3)"; g.lineWidth = 4;
    g.beginPath(); g.moveTo(x, y); g.bezierCurveTo(x + 60, y - 14, x + 120, y + 14, x + 190, y); g.stroke();
  }
});

/** plain earth for the 1990 spoil heap and the gap around the tower base */
export const earthHD = () => ctex("pisaEarth", 512, 512, (g, r) => {
  g.fillStyle = "#9a6f48"; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 900; i++) {
    g.fillStyle = r() < 0.5 ? "rgba(110,76,48,0.5)" : "rgba(186,146,104,0.45)";
    const s = 2 + r() * 6; g.fillRect(r() * 512, r() * 512, s, s);
  }
});

/** red-white hazard stripes (barrier tape, the rig's boom) */
export const hazard = () => ctex("pisaHazard", 256, 64, (g) => {
  g.fillStyle = "#f4f0e6"; g.fillRect(0, 0, 256, 64);
  g.fillStyle = "#d23b33";
  for (let x = -64; x < 256; x += 64) { g.beginPath(); g.moveTo(x, 64); g.lineTo(x + 32, 64); g.lineTo(x + 64, 0); g.lineTo(x + 32, 0); g.closePath(); g.fill(); }
});
