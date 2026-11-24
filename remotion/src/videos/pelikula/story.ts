// "Bakit mahilig tayong mga Pilipino sa pelikula?" — shot plan timed to the Tagalog voice (shorts/pelikula/voice/words.json).
// Six sets live in one three.js world, far apart (fog hides the others): PLAZA (cinema, origin), ESCOLTA 1897 (+x),
// THEATER (-x), STUDIO 1950s (+z), HOME (-z), PALACE (+x +z, office behind it). Camera grammar from the bridge short:
// hard cuts on big jumps, smootherstep glides of 18-40 f, every hold creeps in, 7-frame flip kicks on impacts.
export const FPS = 30;
export const TOTAL = 2100;
export const D0 = 0;
export type V3 = [number, number, number];

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const smooth = (x: number) => { const u = clamp01(x); return u * u * (3 - 2 * u); };
export const easeOut = (u: number) => 1 - (1 - clamp01(u)) ** 4;

// ---------------- set origins ----------------
export const ESC: V3 = [300, 0, 0];
export const THE: V3 = [-300, 0, 0];
export const STU: V3 = [0, 0, 300];
export const HOME: V3 = [0, 0, -300];
export const PAL: V3 = [300, 0, 300];
export const OFF: V3 = [300, 0, 345];
const at = (o: V3, x: number, y: number, z: number): V3 => [o[0] + x, o[1] + y, o[2] + z];

// ---------------- shots ----------------
export type Light = "day" | "golden" | "night" | "dark";
export type SetName = "plaza" | "escolta" | "theater" | "studio" | "home" | "palace" | "office";
export type Beat = "hook" | "hero" | "street" | "queue1897" | "screen1897" | "director" | "cans" | "japan" | "xmas" | "noche" | "queue"
  | "vote" | "balcony" | "heroic" | "desk" | "why" | "handaan" | "cinema" | "hot" | "phone" | "election";
export type ShotDef = { id: number; a: number; b: number; light: Light; set: SetName; beat: Beat; sunAz?: number; sunEl?: number; era?: "old" | "new" };
export const SHOTS: ShotDef[] = [
  { id: 1, a: 0, b: 98, light: "day", set: "plaza", beat: "hook" },
  { id: 2, a: 98, b: 190, light: "day", set: "plaza", beat: "hero", sunAz: 140 },
  { id: 3, a: 190, b: 299, light: "golden", set: "escolta", beat: "street", sunAz: 35, sunEl: 24 },
  { id: 4, a: 299, b: 400, light: "golden", set: "escolta", beat: "queue1897", sunAz: 110, sunEl: 26 },
  { id: 5, a: 400, b: 489, light: "dark", set: "theater", beat: "screen1897", era: "old" },
  { id: 6, a: 489, b: 667, light: "day", set: "studio", beat: "director" },
  { id: 7, a: 667, b: 751, light: "day", set: "studio", beat: "japan" },
  { id: 8, a: 751, b: 937, light: "night", set: "plaza", beat: "xmas", sunAz: 150, sunEl: 25 },
  { id: 9, a: 937, b: 1022, light: "night", set: "home", beat: "noche", sunAz: 120, sunEl: 35 },
  { id: 10, a: 1022, b: 1063, light: "night", set: "plaza", beat: "queue", sunAz: 120, sunEl: 25 },
  { id: 11, a: 1063, b: 1109, light: "day", set: "plaza", beat: "vote" },
  { id: 12, a: 1109, b: 1193, light: "day", set: "palace", beat: "balcony", sunAz: 120 },
  { id: 13, a: 1193, b: 1281, light: "day", set: "palace", beat: "heroic", sunAz: 120 },
  { id: 14, a: 1281, b: 1363, light: "day", set: "office", beat: "desk", sunAz: 100, sunEl: 40 },
  { id: 15, a: 1363, b: 1421, light: "golden", set: "home", beat: "why", sunAz: 120, sunEl: 32 },
  { id: 16, a: 1421, b: 1651, light: "golden", set: "home", beat: "handaan", sunAz: 140, sunEl: 32 },
  { id: 17, a: 1651, b: 1766, light: "dark", set: "theater", beat: "cinema", era: "new" },
  { id: 18, a: 1766, b: 1819, light: "golden", set: "plaza", beat: "hot", sunAz: 20, sunEl: 34 },
  { id: 19, a: 1819, b: 1977, light: "night", set: "home", beat: "phone", sunAz: 160, sunEl: 20 },
  { id: 20, a: 1977, b: TOTAL, light: "day", set: "plaza", beat: "election", sunAz: 110 },
];
/** crossfades (frames) at place/time changes; a white 4-frame flash after the hook */
export const XFADE: Record<number, number> = { 5: 6, 6: 8, 8: 8, 9: 8, 10: 6, 11: 8, 12: 8, 15: 10, 17: 8, 18: 6, 19: 8, 20: 8 };
export const FLASH_AT = 190;

export const shotAt = (f: number) => SHOTS.find((s) => f >= s.a && f < s.b) ?? SHOTS[SHOTS.length - 1];
export const layersAt = (f: number): { id: number; alpha: number }[] => {
  for (const s of SHOTS) {
    const x = XFADE[s.id];
    if (x && f >= s.a - x / 2 && f < s.a + x / 2) return [{ id: s.id - 1, alpha: 1 }, { id: s.id, alpha: (f - (s.a - x / 2) + 1) / (x + 1) }];
  }
  return [{ id: shotAt(f).id, alpha: 1 }];
};

// ---------------- story timings (seconds, from words.json) ----------------
export const W = {
  pelikula: 70 / 30, ginawa: 122 / 30, presidente: 144 / 30, bida: 166 / 30,
  gumagalaw: 439 / 30, larawan: 461 / 30, singkwenta: 517 / 30, tatlong: 546 / 30, limampung: 573 / 30, taon: 643 / 30,
  hapon: 698 / 30, marami: 723 / 30, metro: 844 / 30, pelikulang: 873 / 30, noche: 955 / 30, pamilya: 996 / 30, pila: 1022 / 30,
  nanalong: 1109 / 30, presidente2: 1123 / 30, suwerte: 1193 / 30, magligtas: 1234 / 30, malas: 1281 / 30, doble: 1318 / 30,
  bakit: 1371 / 30, handaan: 1421 / 30, pagkain: 1464 / 30, kundi: 1512 / 30, pagtawa: 1544 / 30, iyak: 1574 / 30, sigaw: 1601 / 30,
  kontrabida: 1621 / 30, malamig: 1705 / 30, madilim: 1725 / 30, mainit: 1798 / 30, telepono: 1879 / 30, samasama: 1914 / 30,
  halalan: 1988 / 30, sino: 2054 / 30, bida2: 2067 / 30,
};
/** film cans in the 1950s stack: how many have landed by time t (they fly in faster and faster: "350 a year") */
export const CAN_H = 0.32;
export const cansAt = (t: number) => Math.floor(Math.max(0, Math.min(34, (t - W.tatlong + 0.2) ** 1.6 * 4.2)));
export const STACK_PH: V3 = at(STU, -1.6, 0, 0);
export const STACK_JP: V3 = at(STU, 1.9, 0, -0.6);

// ---------------- camera ----------------
export type Cam = { pos: V3; look: V3; fov: number; roll: number };
type Shot = Partial<Cam> & { pos: V3; look: V3 };
type Key = { f: number; dur?: number; cut?: boolean; s: (f: number) => Shot };
export const glide = (u: number) => { const x = clamp01(u); return x * x * x * (x * (6 * x - 15) + 10); };
const mix = (a: Cam, b: Cam, k: number): Cam => ({
  pos: a.pos.map((v, i) => v + (b.pos[i] - v) * k) as V3, look: a.look.map((v, i) => v + (b.look[i] - v) * k) as V3,
  fov: a.fov + (b.fov - a.fov) * k, roll: a.roll + (b.roll - a.roll) * k,
});
const full = (c: Shot): Cam => ({ fov: 40, roll: 0, ...c });
const run = (keys: Key[], f: number) => {
  let cur = full(keys[0].s(f));
  for (let i = 1; i < keys.length; i++) {
    const k = keys[i];
    if (f < k.f) break;
    cur = k.cut ? full(k.s(f)) : mix(cur, full(k.s(f)), glide((f - k.f) / (k.dur ?? 24)));
  }
  return cur;
};
const T = (f: number) => f / FPS;
/** push-in factor since f0 (subject grows ~rate per frame); punch raises it for n frames */
const pushK = (f: number, f0: number, rate: number, punch = 0, n = 35) => {
  const x = Math.max(0, f - f0);
  let s = rate * x;
  if (punch > rate) for (let i = 0; i < Math.min(x, n); i++) s += (punch - rate) * Math.max(0, Math.min(1, (i + 0.5) / 8, (n - i - 0.5) / 8));
  return Math.exp(-s);
};
const dolly = (pos: V3, look: V3, k: number, rest: Partial<Cam> = {}): Shot =>
  ({ pos: [look[0] + (pos[0] - look[0]) * k, look[1] + (pos[1] - look[1]) * k, look[2] + (pos[2] - look[2]) * k], look, ...rest });
const zoom = (pos: V3, look: V3, fov: number, k: number, rest: Partial<Cam> = {}): Shot =>
  ({ pos, look, fov: (360 / Math.PI) * Math.atan(Math.tan((fov * Math.PI) / 360) * k), ...rest });
const rolled = (s: (f: number) => Shot, roll: number) => (f: number): Shot => ({ ...s(f), roll });
const D = (o: V3, pos: [number, number, number], look: [number, number, number], f: number, f0: number, rate: number, rest: Partial<Cam> = {}, punch = 0, n = 35) =>
  dolly(at(o, ...pos), at(o, ...look), pushK(f, f0, rate, punch, n), rest);
const O: V3 = [0, 0, 0];

// cinema facade at z = -12 (front face), marquee canopy y 3.8-4.6, billboard 5.2-11.2; crowd on the plaza z -6..9
export const HERO_MARQ: V3 = [0.4, 4.62, -10.9];
const CAMS: Record<number, Key[]> = {
  1: [
    { f: 0, s: (f) => D(O, [2.4, 4.4, -8.6], [0, 1.7, 3], f, 0, 0.0025, { fov: 44, roll: -0.03 }) },              // over the marquee edge onto the crowd
    { f: 52, dur: 34, s: (f) => D(O, [0.8, 2.1, -3.2], [0, 1.75, 3.5], f, 52, 0.002, { fov: 38, roll: 0.035 }) },   // down into the front row ("Pilipino sa pelikula")
  ],
  2: [
    { f: 98, s: (f) => D(O, [1.6, 1.2, -1.5], [0.2, 7.2, -11.9], f, 98, 0.0022, { fov: 46 }) },                   // low: the hero poster above the marquee
    { f: 128, cut: true, s: (f) => D(O, [3.2, 2.4, -0.2], [0.3, 6.0, -10.9], f, 128, 0.0025, { fov: 44, roll: -0.035 }, 0.006, 30) }, // he steps out onto the marquee
    { f: 160, dur: 18, s: rolled((f) => D(O, [3.2, 2.4, -0.2], [0.3, 6.0, -10.9], f, 128, 0.0025, { fov: 44 }, 0.006, 30), 0.04) },
  ],
  3: [
    { f: 190, s: (f) => D(ESC, [3.2, 14, 30], [-1, 3.5, -2], f, 190, 0.0018, { fov: 42 }) },                       // aerial over the 1897 street
    { f: 226, dur: 40, s: (f) => D(ESC, [2.4, 3.2, 20], [-2.5, 3.6, -1], f, 226, 0.0016, { fov: 40, roll: -0.02 }) }, // crane down to street level
  ],
  4: [
    { f: 299, s: (f) => D(ESC, [-1.6, 1.75, -3.6], [-4.4, 1.6, 4.5], f, 299, 0.0022, { fov: 40 }) },               // from the door along the queue
    { f: 362, dur: 26, s: (f) => D(ESC, [-2.6, 1.7, 2.4], [-4.5, 1.55, 6.6], f, 362, 0.002, { fov: 36, roll: 0.035 }) }, // lolo't lola
  ],
  5: [
    { f: 396, s: (f) => D(THE, [0.4, 2.3, -7.2], [0, 1.4, 1.5], f, 396, 0.0022, { fov: 42 }) },                     // from the screen onto the 1897 audience
    { f: 436, cut: true, s: (f) => D(THE, [-0.3, 1.55, -4.6], [-0.8, 1.3, -0.6], f, 436, 0.002, { fov: 38, roll: -0.04 }, 0.006, 26) }, // CU amazed faces
  ],
  6: [
    { f: 485, s: (f) => D(STU, [3.8, 1.9, 6.4], [-0.4, 1.6, 0.6], f, 485, 0.0022, { fov: 42 }) },                  // director, camera, crew on the lot
    { f: 546, cut: true, s: (f) => { const h = cansAt(T(f)) * CAN_H; return dolly(at(STACK_PH, 2.6, 1.2 + 0.55 * h, 5.2), at(STACK_PH, 0, 0.6 + 0.6 * h, 0), pushK(f, 546, 0.0012), { fov: 44 }); } },
  ],
  7: [
    { f: 663, s: (f) => D(STU, [0.2, 2.2, 15.5], [0.2, 6.4, 0], f, 663, 0.0015, { fov: 50 }) },                    // both stacks
    { f: 694, dur: 30, s: (f) => D(STU, [0.4, 2.0, 14.5], [1.2, 9.5, -0.6], f, 694, 0.0015, { fov: 50, roll: 0.04 }) }, // tilt up the taller one
  ],
  8: [
    { f: 747, s: (f) => D(O, [9, 7.5, 18], [0, 3.5, -6], f, 747, 0.0018, { fov: 44 }) },                           // plaza at Christmas
    { f: 829, cut: true, s: (f) => D(O, [0.2, 2.4, -2.4], [-2.4, 2.6, -11.9], f, 829, 0.0025, { fov: 44, roll: 0.035 }) }, // the marquee + posters
    { f: 873, dur: 24, s: (f) => D(O, [-1.4, 1.5, -6.2], [-4.8, 1.1, -9.9], f, 873, 0.002, { fov: 40, roll: -0.03 }) },
  ],
  9: [
    { f: 933, s: (f) => D(HOME, [3.2, 2.5, 5.2], [-0.3, 1.0, -0.4], f, 933, 0.0022, { fov: 42 }) },                 // Noche Buena table
    { f: 985, cut: true, s: (f) => D(HOME, [0.4, 1.6, 4.6], [0, 1.55, -0.2], f, 985, 0.002, { fov: 40, roll: 0.035 }, 0.005, 24) }, // everyone stands
  ],
  10: [
    { f: 1019, s: (f) => { const u = glide((f - 1019) / 44); return { pos: at(O, 3.2 - 0.6 * u, 1.8, 7.5 - 4.5 * u), look: at(O, 6.0, 1.5, -2.0 - 3.5 * u), fov: 40, roll: -0.03 }; } },
  ],
  11: [
    { f: 1059, s: (f) => D(O, [0.6, 1.7, 3.2], [-4.2, 1.1, -1.4], f, 1059, 0.0025, { fov: 42 }) },               // ballot box
  ],
  12: [
    { f: 1105, s: (f) => D(PAL, [1.2, 1.4, 14], [0, 5.2, -6], f, 1105, 0.002, { fov: 44 }) },                       // palace balcony
    { f: 1123, cut: true, s: (f) => D(PAL, [1.0, 4.5, 3.8], [0, 5.6, -6], f, 1123, 0.0025, { fov: 40, roll: -0.04 }, 0.006, 30) },
  ],
  13: [
    { f: 1193, s: (f) => D(PAL, [0.5, 4.2, 2.4], [0, 6.2, -6], f, 1193, 0.003, { fov: 40, roll: 0.045 }) },         // low heroic CU
  ],
  14: [
    { f: 1281, s: (f) => D(OFF, [2.4, 1.8, 4.6], [0, 1.6, -0.4], f, 1281, 0.0022, { fov: 42 }) },                   // the desk
    { f: 1318, cut: true, s: (f) => D(OFF, [-0.4, 1.7, 3.2], [-0.2, 1.75, -0.6], f, 1318, 0.0025, { fov: 38, roll: -0.035 }) }, // "walang doble"
  ],
  15: [
    { f: 1358, s: (f) => D(HOME, [5.5, 4.2, 10.5], [0, 1.2, -1.5], f, 1358, 0.002, { fov: 42 }) },                  // the handaan yard
  ],
  16: [
    { f: 1421, s: (f) => D(HOME, [-4.6, 3.2, 3.0], [0.6, 0.9, -0.4], f, 1421, 0.002, { fov: 42 }) },                // long table, lechon
    { f: 1464, cut: true, s: (f) => D(HOME, [0.9, 1.6, 1.4], [0.2, 0.85, -0.2], f, 1464, 0.0025, { fov: 38, roll: 0.03 }) }, // the food
    { f: 1512, cut: true, s: (f) => D(HOME, [4.4, 2.1, 0], [-0.4, 1.05, 0], f, 1512, 0.002, { fov: 44 }) },   // faces from the TV end
    { f: 1544, dur: 18, s: rolled((f) => D(HOME, [3.9, 2.0, 0], [-0.4, 1.05, 0], f, 1544, 0.002, { fov: 42 }), -0.035) },
    { f: 1574, cut: true, s: (f) => D(HOME, [2.6, 1.75, 2.6], [-0.6, 1.2, 0.95], f, 1574, 0.0025, { fov: 38 }) },
    { f: 1601, cut: true, s: (f) => D(HOME, [4.2, 1.9, -0.3], [-0.4, 1.2, 0], f, 1601, 0.0025, { fov: 42, roll: 0.045 }, 0.006, 24) },
  ],
  17: [
    { f: 1647, s: (f) => D(THE, [0.4, 2.3, -7.2], [0, 1.4, 2.5], f, 1647, 0.0022, { fov: 44 }) },
    { f: 1697, cut: true, s: (f) => D(THE, [0.8, 1.6, -2.4], [0.4, 1.2, 1.2], f, 1697, 0.0022, { fov: 38, roll: 0.035 }) },
  ],
  18: [
    { f: 1763, s: (f) => D(O, [3.0, 1.7, 9.0], [-0.5, 1.9, -1.5], f, 1763, 0.003, { fov: 42, roll: -0.03 }) },       // hot plaza
  ],
  19: [
    { f: 1815, s: (f) => D(HOME, [0.3, 1.45, 2.6], [0, 1.0, -3.3], f, 1815, 0.0022, { fov: 44 }) },                  // the bench, one phone
    { f: 1914, dur: 30, s: (f) => D(HOME, [0.2, 1.3, 0.6], [0, 1.0, -3.3], f, 1914, 0.002, { fov: 40, roll: 0.035 }) },
  ],
  20: [
    { f: 1973, s: (f) => D(O, [1.0, 2.4, 9.5], [0, 3.0, -8.5], f, 1973, 0.002, { fov: 44 }) },                      // rally stage
    { f: 2054, cut: true, s: (f) => D(O, [0.2, 2.3, -3.6], [0, 2.75, -8.6], f, 2054, 0.003, { fov: 40, roll: -0.04 }, 0.007, 30) }, // "sino ang bida"
  ],
};

// impact kicks: image offset flips sign every frame, decays to 0 in 7 f
const KICKS: [number, number][] = [[W.bida, 0.9], [W.gumagalaw, 0.5], [W.presidente2, 0.8], [W.doble, 0.4], [W.sigaw, 0.7], [W.bida2, 0.9]];
export const kickAt = (t: number) => {
  let a = 0;
  for (const [t0, g] of KICKS) {
    const n = Math.floor((t - t0) * FPS + 1e-6);
    if (n >= 0 && n < 7) a += g * (n % 2 ? -1 : 1) * (1 - n / 7) ** 1.5;
  }
  return a;
};
export const camAt = (id: number, f: number): Cam => {
  const c = run(CAMS[id], f), a = kickAt(T(f));
  if (!a) return c;
  const d: V3 = [c.look[0] - c.pos[0], c.look[1] - c.pos[1], c.look[2] - c.pos[2]];
  const L = Math.hypot(...d), h = Math.hypot(d[0], d[2]) || 1;
  const m = (3 / 640) * Math.tan((c.fov * Math.PI) / 360) * L * a;
  return { ...c, look: [c.look[0] - (d[2] / h) * m, c.look[1] + 0.6 * m, c.look[2] + (d[0] / h) * m], roll: c.roll + a * 0.004 };
};

// ---------------- lens ----------------
export type Dof = { f: number; dur?: number; cInf: number; focus?: (f: number) => V3 };
export const DOF: Dof[] = [
  { f: 0, cInf: 8 }, { f: 52, dur: 34, cInf: 13 },           // crowd: front row eyes
  { f: 98, cInf: 0 }, { f: 128, cInf: 10, focus: () => [HERO_MARQ[0], HERO_MARQ[1] + 1.6, HERO_MARQ[2]] },
  { f: 190, cInf: 0 }, { f: 299, cInf: 11 }, { f: 362, dur: 26, cInf: 13 },
  { f: 400, cInf: 9 }, { f: 436, cInf: 14 },
  { f: 489, cInf: 7 }, { f: 546, cInf: 0 }, { f: 667, cInf: 0 },
  { f: 751, cInf: 0 }, { f: 829, cInf: 6 },
  { f: 937, cInf: 9 }, { f: 985, cInf: 13 }, { f: 1022, cInf: 7 },
  { f: 1063, cInf: 12 }, { f: 1109, cInf: 0 }, { f: 1123, cInf: 10 }, { f: 1193, cInf: 12 },
  { f: 1281, cInf: 9 }, { f: 1318, cInf: 13 },
  { f: 1363, cInf: 0 }, { f: 1421, cInf: 6 }, { f: 1464, cInf: 15 }, { f: 1512, cInf: 11 }, { f: 1574, cInf: 14 }, { f: 1601, cInf: 12 },
  { f: 1651, cInf: 8 }, { f: 1697, cInf: 13 },
  { f: 1766, cInf: 10 }, { f: 1819, cInf: 14 }, { f: 1977, cInf: 0 }, { f: 2054, cInf: 12 },
];
export const dofAt = (f: number) => {
  let i = 0; while (i + 1 < DOF.length && f >= DOF[i + 1].f) i++;
  const d = DOF[i], p = DOF[Math.max(0, i - 1)];
  const k = d.dur ? Math.min(1, (f - d.f) / d.dur) : 1;
  return { cInf: p.cInf + (d.cInf - p.cInf) * k, focus: d.focus };
};
export const keyEnd = (id: number, f: number) => {
  let e = 0;
  for (const k of CAMS[id]) if (f >= k.f) e = k.f + (k.cut ? 0 : k.dur ?? 24);
  return Math.max(f, e);
};
