// Timeline of the zombie short: shots timed to the voice words (voice/words.json, 68.9 s), set positions and the
// camera grammar of the bridge short (smootherstep glides, creeping push-ins on every hold, flip kicks on impacts).
export const FPS = 30;
export const TOTAL = 2067;
export const D0 = 0; // ground height (build.ts houses sit on D0)
export type V3 = [number, number, number];

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const smooth = (x: number) => { const u = clamp01(x); return u * u * (3 - 2 * u); };
export const easeOut = (u: number) => 1 - (1 - clamp01(u)) ** 4;

// ---------------- sets (far apart: the camera's far plane never reaches another set) ----------------
export const STREET = 0, OFFICE = 2000, WAR = 2040, BASE = 2000, FIELD = 4000, CDC = 6000, CAMP = 8000;
export const BASE_Z = 70; // the base exterior sits south of the office rooms
/** your upstairs window (centre of the opening) */
export const WIN: V3 = [0, 4.45, -7];
export const SILL = 3.72;
export const FLOOR2 = 3.0;
/** where the satellite lands, and when (story seconds) */
export const SAT_LAND: V3 = [FIELD + 12.9, 0, 0.6];
export const SAT_T = 23.52;
export const CRASH_T = 38.24;

// ---------------- shots ----------------
export type Light = "day" | "golden";
export type SetName = "street" | "office" | "base" | "field" | "cdc" | "war" | "camp";
export type ShotDef = { id: number; a: number; b: number; light: Light; set: SetName; sunAz?: number; sunEl?: number };
export const SHOTS: ShotDef[] = [
  { id: 1, a: 0, b: 75, light: "day", set: "street", sunAz: 140, sunEl: 45 },                         // hook: you at the window, zombies below
  { id: 2, a: 75, b: 147, light: "day", set: "street", sunAz: 140, sunEl: 45 },                       // "the US military already has a plan"
  { id: 3, a: 147, b: 237, light: "golden", set: "base", sunAz: 125, sunEl: 9 },                     // "It's 2011 ... strategic command office"
  { id: 4, a: 237, b: 360, light: "day", set: "office", sunAz: 155, sunEl: 38 }, // junior officers writing; binder
  { id: 5, a: 360, b: 445, light: "day", set: "office", sunAz: 155, sunEl: 38 }, // page by page; the types board
  { id: 6, a: 445, b: 488, light: "day", set: "field" },                       // radiation zombies
  { id: 7, a: 488, b: 525, light: "day", set: "field" },                       // evil magic zombies
  { id: 8, a: 525, b: 600, light: "day", set: "field" },                       // vegetarian zombies
  { id: 9, a: 600, b: 734, light: "day", set: "field" },                       // space zombies: the dead satellite falls
  { id: 10, a: 734, b: 861, light: "day", set: "field" },                      // chicken zombies
  { id: 11, a: 861, b: 1020, light: "day", set: "cdc", sunAz: 150, sunEl: 45 },  // the CDC posts the guide
  { id: 12, a: 1020, b: 1170, light: "day", set: "cdc", sunAz: 150, sunEl: 45 }, // readers pile in; the site crashes
  { id: 13, a: 1170, b: 1239, light: "day", set: "office", sunAz: 155, sunEl: 38 }, // Luckily: salute
  { id: 14, a: 1239, b: 1317, light: "day", set: "cdc", sunAz: 150, sunEl: 45 },  // Unluckily: smoking monitor
  { id: 15, a: 1317, b: 1525, light: "golden", set: "war", sunAz: 150, sunEl: 48 }, // You see: map table
  { id: 16, a: 1525, b: 1650, light: "day", set: "cdc", sunAz: 150, sunEl: 45 },  // the list drops into the bag
  { id: 17, a: 1650, b: 1785, light: "golden", set: "camp" },                  // camping trip; hurricane, flood, blackout
  { id: 18, a: 1785, b: 1905, light: "day", set: "cdc", sunAz: 150, sunEl: 45 },  // the comic book
  { id: 19, a: 1905, b: TOTAL, light: "day", set: "street", sunAz: 140, sunEl: 45 },                  // callback: the bag, the chicken
];
/** crossfades (frames) at place/time changes; a white 4-frame flash after the hook */
export const XFADE: Record<number, number> = { 3: 8, 6: 8, 11: 8, 15: 8, 17: 8, 19: 8 };
export const FLASH_AT = 147;
/** the blackout: picture dims to near-black on "blackout" and holds until the cut */
export const blackoutAt = (f: number) => (f >= 1772 && f < 1785 ? Math.min(0.88, (f - 1771) * 0.3) : 0);

export const shotAt = (f: number) => SHOTS.find((s) => f >= s.a && f < s.b) ?? SHOTS[SHOTS.length - 1];
export const layersAt = (f: number): { id: number; alpha: number }[] => {
  for (const s of SHOTS) {
    const x = XFADE[s.id];
    if (x && f >= s.a - x / 2 && f < s.a + x / 2) return [{ id: s.id - 1, alpha: 1 }, { id: s.id, alpha: (f - (s.a - x / 2) + 1) / (x + 1) }];
  }
  return [{ id: shotAt(f).id, alpha: 1 }];
};

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
const O = OFFICE, W = WAR, F = FIELD, C = CDC, K = CAMP;

// shot 1: CU of you yawning at the window -> on "zombie" cut to the low wide street (zombies in front, you above)
const S1a = (f: number) => dolly([0.55, 4.55, -3.6], [0, 4.62, -7.4], pushK(f, 0, 0.003), { fov: 34, roll: 0.02 });
const S1b = (f: number) => dolly([5.5, 1.25, 8.5], [0.2, 3.3, -6.5], pushK(f, 38, 0.0025), { fov: 46, roll: -0.04 });
// shot 2: the general among the zombies with the plan, push on "plan"
const S2a = (f: number) => dolly([2.6, 1.55, 6.8], [0.9, 1.45, 2.2], pushK(f, 75, 0.002), { fov: 40 });
const S2b = (f: number) => dolly([1.7, 1.6, 5.0], [0.9, 1.55, 2.2], pushK(f, 120, 0.002, 0.006, 26), { fov: 36, roll: 0.04 });
// shot 3: base exterior, low and looking up at the flag; creep
const S3a = (f: number) => zoom([BASE + 9, 1.1, BASE_Z + 22], [BASE + 1, 6.5, BASE_Z - 2], 46, pushK(f, 143, 0.0018));
// shot 4: office MS of the two officers at the desk, then the binder insert ("Counter-Zombie Dominance")
const S4a = (f: number) => dolly([O + 1.2, 1.65, 3.6], [O, 1.25, -1.2], pushK(f, 237, 0.0025), { fov: 42 });
const S4b = (f: number) => dolly([O + 0.15, 2.1, 0.05], [O + 0.05, 0.78, -0.9], pushK(f, 318, 0.0025, 0.006, 30), { fov: 38, roll: 0.03 });
// shot 5: officer pointing at the types board
const S5a = (f: number) => dolly([O - 0.6, 1.7, 1.8], [O - 2.0, 1.7, -3.5], pushK(f, 360, 0.0025), { fov: 44 });
const S5b = (f: number) => dolly([O - 1.3, 1.75, 0.5], [O - 2.15, 1.8, -3.6], pushK(f, 410, 0.003), { fov: 42, roll: -0.03 });
// shots 6-10: the field line-up (one MS per type)
const S6a = (f: number) => dolly([F + 0.7, 1.45, 4.2], [F, 1.3, 0], pushK(f, 441, 0.003), { fov: 40, roll: -0.03 });
const S7a = (f: number) => dolly([F + 4.5, 1.4, 3.9], [F + 4.0, 1.45, 0], pushK(f, 488, 0.003), { fov: 40, roll: 0.035 });
const S8a = (f: number) => dolly([F + 10.2, 1.3, 4.2], [F + 8.6, 1.0, 0.1], pushK(f, 525, 0.0025), { fov: 44 });
const S8b = (f: number) => dolly([F + 9.6, 1.2, 2.9], [F + 8.6, 1.1, 0.1], pushK(f, 560, 0.0025), { fov: 40, roll: -0.035 });
const S9a = (f: number) => dolly([F + 13.5, 1.0, 6.0], [F + 12.8, 7.5, -3], pushK(f, 600, 0.002), { fov: 46, roll: 0.03 });
const S9b = (f: number) => dolly([F + 15.6, 1.5, 6.6], [F + 12.8, 1.6, 0.2], pushK(f, 668, 0.0025), { fov: 44 });
const S10a = (f: number) => dolly([F + 17.2, 0.75, 2.6], [F + 16.0, 0.85, 0], pushK(f, 734, 0.002), { fov: 40 });
const S10b = (f: number) => dolly([F + 16.75, 0.82, 1.55], [F + 16.05, 0.95, 0], pushK(f, 790, 0.002, 0.006, 32), { fov: 36, roll: 0.04 });
// shot 11: CDC wide -> monitor insert on "posts a zombie survival guide"
const S11a = (f: number) => dolly([C + 2.2, 1.7, 3.8], [C + 0.2, 1.15, -1.1], pushK(f, 857, 0.0022), { fov: 42 });
const S11b = (f: number) => dolly([C + 0.75, 1.25, 0.6], [C + 0.35, 1.08, -1.35], pushK(f, 955, 0.003), { fov: 36 });
// shot 12: the big wall screen and the readers; wider when the crowd arrives; kick on the crash
const S12a = (f: number) => dolly([C - 0.2, 1.7, 4.5], [C - 0.6, 2.0, -3.4], pushK(f, 1020, 0.002), { fov: 44 });
const S12b = (f: number) => dolly([C + 0.6, 2.6, 6.6], [C - 0.6, 1.8, -3.2], pushK(f, 1078, 0.0025), { fov: 48, roll: 0.03 });
const S12c = (f: number) => dolly([C - 0.4, 2.2, 3.0], [C - 0.6, 2.4, -3.4], pushK(f, 1143, 0.003), { fov: 42, roll: -0.04 });
// shot 13: officers saluting (office)
const S13a = (f: number) => dolly([O + 0.4, 1.6, 3.2], [O, 1.45, -1.2], pushK(f, 1170, 0.003), { fov: 40, roll: 0.03 });
// shot 14: smoking monitor + dazed scientist
const S14a = (f: number) => dolly([C + 1.4, 1.35, 1.6], [C + 0.1, 1.15, -1.0], pushK(f, 1239, 0.0025), { fov: 40, roll: -0.035 });
// shot 15: war room map table, top 3/4, then the officer's face on "thinking the plan was about them"
const S15a = (f: number) => dolly([W + 2.8, 3.4, 3.6], [W, 0.9, 0], pushK(f, 1313, 0.002), { fov: 42 });
const S15b = (f: number) => dolly([W + 1.0, 2.3, 1.6], [W - 0.3, 0.95, -0.2], pushK(f, 1388, 0.0025), { fov: 38, roll: 0.03 });
const S15c = (f: number) => dolly([W + 0.4, 1.6, 0.9], [W - 0.4, 1.55, -1.45], pushK(f, 1474, 0.003), { fov: 36 });
// shot 16: the bag on the CDC desk (3/4 top)
const S16a = (f: number) => dolly([C + 2.3, 1.75, 0.4], [C + 1.45, 0.95, -0.8], pushK(f, 1525, 0.0025), { fov: 38, roll: 0.02 });
// shot 17: camp at sunset, you with the backpack; closer on "hurricane"
const S17a = (f: number) => dolly([K + 2.4, 1.6, 6.5], [K + 0.3, 1.3, 0], pushK(f, 1646, 0.002), { fov: 42 });
const S17b = (f: number) => dolly([K + 1.4, 1.55, 3.9], [K + 0.2, 1.35, 0], pushK(f, 1731, 0.003), { fov: 40, roll: -0.04 });
// shot 18: scientist + comic book
const S18a = (f: number) => dolly([C + 1.1, 1.55, 1.9], [C + 0.1, 1.2, -1.0], pushK(f, 1785, 0.0025), { fov: 40 });
const S18b = (f: number) => dolly([C + 0.7, 1.45, 0.9], [C + 0.25, 1.05, -0.95], pushK(f, 1870, 0.003, 0.006, 26), { fov: 38, roll: 0.03 });
// shot 19: street again: wide, then your window MS; the chicken arrives on the sill
const S19a = (f: number) => dolly([5.5, 1.3, 8.0], [0.2, 3.4, -6.5], pushK(f, 1901, 0.002), { fov: 46 });
const S19b = (f: number) => dolly([0.9, 4.5, -2.6], [0.25, 4.45, -7.3], pushK(f, 1990, 0.0025), { fov: 38, roll: -0.02 });

const CAMS: Record<number, Key[]> = {
  1: [{ f: 0, s: S1a }, { f: 38, cut: true, s: S1b }],
  2: [{ f: 75, s: S2a }, { f: 120, dur: 22, s: S2b }],
  3: [{ f: 143, s: S3a }],
  4: [{ f: 237, s: S4a }, { f: 318, cut: true, s: S4b }],
  5: [{ f: 360, s: S5a }, { f: 410, dur: 26, s: S5b }],
  6: [{ f: 441, s: S6a }],
  7: [{ f: 488, s: S7a }],
  8: [{ f: 525, s: S8a }, { f: 560, dur: 22, s: S8b }],
  9: [{ f: 600, s: S9a }, { f: 668, cut: true, s: S9b }],
  10: [{ f: 734, s: S10a }, { f: 790, dur: 26, s: S10b }],
  11: [{ f: 857, s: S11a }, { f: 955, cut: true, s: S11b }],
  12: [{ f: 1020, s: S12a }, { f: 1078, cut: true, s: S12b }, { f: 1143, cut: true, s: S12c }],
  13: [{ f: 1170, s: S13a }],
  14: [{ f: 1239, s: S14a }],
  15: [{ f: 1313, s: S15a }, { f: 1388, dur: 30, s: S15b }, { f: 1474, cut: true, s: S15c }],
  16: [{ f: 1525, s: S16a }],
  17: [{ f: 1646, s: S17a }, { f: 1731, dur: 20, s: S17b }],
  18: [{ f: 1785, s: S18a }, { f: 1870, dur: 24, s: S18b }],
  19: [{ f: 1901, s: S19a }, { f: 1990, dur: 34, s: S19b }],
};

// impact kicks: image offset flips sign every frame, decays to 0 in 7 f
const KICKS: [number, number][] = [[1.3, 0.8], [SAT_T, 1.6], [CRASH_T, 1.3], [62.82, 0.5], [57.82, 0.6]];
export const kickAt = (t: number) => {
  let a = 0;
  for (const [t0, g] of KICKS) {
    const n = Math.floor((t - t0) * FPS + 1e-6);
    if (n >= 0 && n < 7) a += g * (n % 2 ? -1 : 1) * (1 - n / 7) ** 1.5;
  }
  return a;
};
const T = (f: number) => f / FPS;
export const camAt = (id: number, f: number): Cam => {
  const c = run(CAMS[id], f), a = kickAt(T(f));
  if (!a) return c;
  const d: V3 = [c.look[0] - c.pos[0], c.look[1] - c.pos[1], c.look[2] - c.pos[2]];
  const L = Math.hypot(...d), h = Math.hypot(d[0], d[2]) || 1;
  const m = (3 / 640) * Math.tan((c.fov * Math.PI) / 360) * L * a;
  return { ...c, look: [c.look[0] - (d[2] / h) * m, c.look[1] + 0.6 * m, c.look[2] + (d[0] / h) * m], roll: c.roll + a * 0.004 };
};

// ---------------- lens: depth of field + foreground framing ----------------
export type Dof = { f: number; dur?: number; cInf: number; focus?: (f: number) => V3 };
export const DOF: Dof[] = [
  { f: 0, cInf: 14, focus: () => [0, 4.75, -7.45] },          // your face at the window
  { f: 38, cInf: 0 },                                        // street wide
  { f: 75, cInf: 11, focus: () => [0.9, 1.6, 2.2] },          // the general
  { f: 143, cInf: 0 },                                       // base exterior
  { f: 237, cInf: 10, focus: () => [O, 1.25, -1.2] },         // officers MS
  { f: 318, cInf: 12 },                                      // binder insert (look)
  { f: 360, cInf: 7 },                                       // board
  { f: 441, cInf: 12, focus: () => [F, 1.6, 0] },             // radiation zombie
  { f: 488, cInf: 12, focus: () => [F + 4, 1.6, 0] },         // magic zombie
  { f: 525, cInf: 10, focus: () => [F + 8.2, 1.4, 0.2] },     // vegetarian
  { f: 600, cInf: 0 },                                       // the sky, the drop
  { f: 734, cInf: 15, focus: () => [F + 16.0, 0.98, 0] },     // chicken CU
  { f: 857, cInf: 8, focus: () => [C + 0.2, 1.5, -1.6] },     // CDC wide
  { f: 955, cInf: 13 },                                      // monitor insert
  { f: 1020, cInf: 6 },                                      // wall screen + readers
  { f: 1078, cInf: 0 },
  { f: 1143, cInf: 6 },
  { f: 1170, cInf: 10, focus: () => [O, 1.5, -1.2] },         // salute
  { f: 1239, cInf: 12, focus: () => [C + 0.1, 1.3, -1.2] },   // smoking monitor
  { f: 1313, cInf: 0 },                                      // map table
  { f: 1388, dur: 30, cInf: 8 },
  { f: 1474, cInf: 13, focus: () => [W - 0.4, 1.6, -1.45] },  // officer face
  { f: 1525, cInf: 10 },                                     // bag insert (look)
  { f: 1646, cInf: 7, focus: () => [K + 0.3, 1.5, 0] },       // camp
  { f: 1785, cInf: 11, focus: () => [C + 0.1, 1.5, -1.6] },   // scientist + comic
  { f: 1901, cInf: 0 },                                      // street wide
  { f: 1990, dur: 34, cInf: 13, focus: () => [0.1, 4.7, -7.45] }, // window MS
];
export const dofAt = (f: number) => {
  let i = 0; while (i + 1 < DOF.length && f >= DOF[i + 1].f) i++;
  const d = DOF[i], p = DOF[Math.max(0, i - 1)];
  const k = d.dur ? Math.min(1, (f - d.f) / d.dur) : 1;
  return { cInf: p.cInf + (d.cInf - p.cInf) * k, focus: d.focus };
};

export type Fg = { a: number; b: number; kit: string; pos: V3; s?: number; yaw?: number };
export const FOREGROUND: Fg[] = [
  { a: 1646, b: 1785, kit: "tree_default", pos: [K + 3.6, 0, 4.3], s: 3.4, yaw: 0.2 },                    // camp: a tree on the right edge
];
