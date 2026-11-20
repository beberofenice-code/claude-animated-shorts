// Timeline of "The Tower That Was Saved by a War": shots timed to the voice words (projects/pisa/voice/words.json),
// the tower's story state (floors built, lean, bend, sink) and the camera grammar of the bridge short: continuous slow
// push-ins, symmetric smootherstep glides of 18-40 f, hard cuts on big reframes, 7-frame flip kicks on impacts.
// World: tower base centre at the origin, ground y = 0, the tower leans toward +x. Most lenses sit on the +z side
// looking -z, so the lean reads toward screen right. The Duomo is west (-x), the city wall north (-z).
export const FPS = 30;
export const TOTAL = 2130;
export const D0 = 0; // ground height (the shared builders use it as the base level)
export type V3 = [number, number, number];
export const BEACH: V3 = [1500, 0, 0];

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const smooth = (x: number) => { const u = clamp01(x); return u * u * (3 - 2 * u); };
export const easeOut = (u: number) => 1 - (1 - clamp01(u)) ** 4;
export const lin = (pts: [number, number][], x: number) => {
  if (x <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) if (x <= pts[i][0]) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
    return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
  }
  return pts[pts.length - 1][1];
};

// ---------------- the tower ----------------
/** floor heights (m): arcaded ground floor, six open galleries, bell chamber -> 55.6 m */
export const FLOOR_H = [11, 6.4, 6.4, 6.4, 6.4, 6.4, 6.4, 6.2];
export const FLOOR_Y = FLOOR_H.reduce<number[]>((a, h, i) => [...a, a[i] + h], [0]); // base of floor k (0-based), [8] = top
/** word times (s) at which each floor pops up ("goes up"), floors 4-8 on the builders' return */
export const POP = [13.92, 15.79, 18.06, 40.36, 40.6, 40.84, 41.08, 41.86];
export const POP_DUR = 0.36;
/** floor build progress 0..1 (with a little overshoot) for a story time */
export const floorK = (k: number, tau: number) => {
  const u = (tau - POP[k]) / POP_DUR;
  if (u <= 0) return 0;
  if (u >= 1.6) return 1;
  return u < 1 ? smooth(u) * 1.07 : 1.07 - 0.07 * smooth((u - 1) / 0.6);
};
export const LEAN_T0 = 19.62, LEAN_T1 = 20.62;
/** whole-tower lean in degrees (toward +x) on the one story clock (the clock runs 1173 -> today) */
export const leanAt = (tau: number) => lin([[LEAN_T0, 0], [LEAN_T1 - 0.15, 4.25], [LEAN_T1 + 0.1, 3.85], [LEAN_T1 + 0.4, 4.0],
  [51.55, 4.6], [51.75, 5.7], [51.95, 5.45], [52.2, 5.5], [60.5, 5.5], [61.6, 4.3], [61.8, 4.45], [62, 4.4]], tau);
/** upper floors built taller on the low side: each floor from the 4th up tilts back a little more (the banana) */
export const BEND = 0.55;
export type TowerState = { floors: number[]; lean: number; bend: number };
export const towerAt = (tau: number): TowerState => ({ floors: POP.map((_, k) => floorK(k, tau)), lean: leanAt(tau), bend: BEND });

// ---------------- shots ----------------
export type Light = "day" | "golden";
/** era of the set dressing: build site 1173, a century of grass, the return 1272, 1934 concrete, 1990 rescue, today */
export type Era = "today" | "1173" | "war" | "1272" | "1934" | "1990" | "beach";
export type ShotDef = { id: number; a: number; b: number; light: Light; era: Era; tau: (t: number) => number; sunAz?: number; sunEl?: number };
const at = (s: number) => (t: number) => s; // frozen story time
export const SHOTS: ShotDef[] = [
  { id: 1, a: 0, b: 126, light: "day", era: "today", tau: at(70) },
  { id: 2, a: 126, b: 288, light: "day", era: "1173", tau: at(0) },
  { id: 3, a: 288, b: 405, light: "day", era: "1173", tau: at(0) },
  { id: 4, a: 405, b: 462, light: "day", era: "1173", tau: (t) => t },
  { id: 5, a: 462, b: 525, light: "day", era: "1173", tau: (t) => t },
  { id: 6, a: 525, b: 639, light: "day", era: "1173", tau: (t) => t },
  { id: 7, a: 639, b: 714, light: "day", era: "1173", tau: (t) => t },
  { id: 8, a: 714, b: 852, light: "golden", era: "war", tau: (t) => t },
  { id: 9, a: 852, b: 906, light: "day", era: "war", tau: (t) => t },
  { id: 10, a: 906, b: 1065, light: "day", era: "beach", tau: (t) => t },
  { id: 11, a: 1065, b: 1161, light: "golden", era: "war", tau: (t) => t },
  { id: 12, a: 1161, b: 1284, light: "day", era: "1272", tau: (t) => t },
  { id: 13, a: 1284, b: 1380, light: "day", era: "1272", tau: (t) => t },
  { id: 14, a: 1380, b: 1584, light: "day", era: "1934", tau: (t) => t },
  { id: 15, a: 1584, b: 1872, light: "day", era: "1990", tau: (t) => t },
  { id: 16, a: 1872, b: 1992, light: "day", era: "1990", tau: (t) => t },
  { id: 17, a: 1992, b: TOTAL, light: "golden", era: "today", tau: (t) => t },
];
/** crossfades (frames) at place/time changes; a white 4-frame flash after the hook */
export const XFADE: Record<number, number> = { 8: 8, 9: 8, 10: 10, 11: 10, 12: 8, 14: 10, 15: 10, 17: 10 };
export const FLASH_AT = 126;

export const shotAt = (f: number) => SHOTS.find((s) => f >= s.a && f < s.b) ?? SHOTS[SHOTS.length - 1];
export const layersAt = (f: number): { id: number; alpha: number }[] => {
  for (const s of SHOTS) {
    const x = XFADE[s.id];
    if (x && f >= s.a - x / 2 && f < s.a + x / 2) return [{ id: s.id - 1, alpha: 1 }, { id: s.id, alpha: (f - (s.a - x / 2) + 1) / (x + 1) }];
  }
  return [{ id: shotAt(f).id, alpha: 1 }];
};

// ---------------- story beats (seconds, 0-3 f before the word) ----------------
export const B = {
  proud: 6.72, fanciest: 7.8, deep: 10.72, soft: 12.18, perfect1: 14.6, perfect2: 16.78, leans: 20.18,
  luckily: 21.3, dragged: 22.46, unluckily: 23.8, years: 25.86, saved: 27.6, water: 29.62, sink: 32.52, squeeze: 33.72,
  holds: 34.78, firm: 37.1, back: 39.4, taller: 40.72, banana: 45.22, ordered: 47.58, pumped: 49.24, further: 51.52,
  closed: 55.48, engineers: 56.28, pulling: 58.3, sank: 60.68, straight: 64.34, stopped: 65.18, nobody: 66.52, photograph: 67.6,
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
const T = (f: number) => f / FPS;
const F = (s: number) => Math.round(s * FPS);
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
const bx = (x: number, y: number, z: number): V3 => [BEACH[0] + x, BEACH[1] + y, BEACH[2] + z];

/** where the people stand (shared with cast.ts) */
export const SPOT = {
  tourists: [[4.3, 46], [1.6, 51], [7.7, 46.6], [10.8, 51.4], [3.4, 40.5], [-1.5, 47.5]] as [number, number][],
  builders: [[-4.6, 11.8], [-1.4, 13.1], [2.3, 12.2], [5.4, 13.6], [-7.6, 14.6]] as [number, number][],
  official: [-6.2, 17.5] as [number, number],
  mixer: [-14, 11] as [number, number],
  rig: [-14.5, 0.5] as [number, number],
  kid: [0, -1.6] as [number, number], // beach, relative to BEACH
};

// shot 1 (hook, today): low wide past the posing tourists, then closer on "only still standing"
const S1a = (f: number) => zoom([8, 1.6, 62], [1.5, 19, 0], 50, pushK(f, 0, 0.0025));
const S1b = (f: number) => zoom([8, 1.6, 62], [5.4, 7.5, 30], 32, pushK(f, 58, 0.003), { roll: -0.04 });
// shot 2 (1173): aerial over the empty site, then down to the cheering crowd on "fanciest"
const S2a = (f: number) => zoom([46, 34, 70], [0, 4, 0], 46, pushK(f, 126, 0.002));
const S2b = (f: number) => zoom([38, 22, 52], [0, 2, 6], 42, pushK(f, 190, 0.0018, 0.005, 30));
const S2c = (f: number) => dolly([2.5, 1.7, 26], [0.5, 1.5, 12.5], pushK(f, 234, 0.0025), { fov: 42, roll: 0.035 });
// shot 3: over the pit -> down into it on "three metres deep" -> low on the builder in the mud on "soft, wet clay"
const S3a = (f: number) => dolly([3, 14, 21], [0, -2, 0], pushK(f, 288, 0.002), { fov: 46 });
const S3b = (f: number) => dolly([2, 6.5, 12.5], [0, -2.6, 0], pushK(f, 318, 0.0018, 0.006, 32), { fov: 44, roll: -0.03 });
const S3c = (f: number) => dolly([1.6, -1.6, 5.4], [0.2, -2.1, 0.6], pushK(f, 364, 0.003), { fov: 40, roll: 0.035 });
// shots 4-6: the tower going up, seen from the crowd; each floor climbs a little higher
const S4a = (f: number) => dolly([16, 3.2, 44], [0, 6, 0], pushK(f, 405, 0.002), { fov: 40 });
const S4b = (f: number) => dolly([3.0, 1.75, 20.5], [-1.4, 1.6, 13.1], pushK(f, 436, 0.003), { fov: 38, roll: 0.03 });
const S5a = (f: number) => dolly([20, 5, 50], [0, 9.5, 0], pushK(f, 462, 0.002), { fov: 42 });
const S5b = (f: number) => dolly([-2.2, 1.7, 21], [2.3, 1.6, 12.2], pushK(f, 496, 0.003), { fov: 38, roll: -0.03 });
const S6a = (f: number) => dolly([0, 5, 62], [0, 12, 0], pushK(f, 525, 0.0018), { fov: 40 });
const S6b = (f: number) => dolly([0, 3.5, 50], [1, 10, 0], pushK(f, 588, 0.0015, 0.005, 30), { fov: 40 });
const S6c = (f: number) => dolly([1.2, 1.7, 22.5], [0.5, 1.7, 12.6], pushK(f, 621, 0.003), { fov: 40, roll: 0.04 });
// shot 7: the war column marches past the leaning stump (side view), crowd pulled along
const S7a = (f: number) => dolly([18, 3.5, 40], [-2, 6, 6], pushK(f, 639, 0.0022), { fov: 44, roll: -0.03 });
const S7b = (f: number) => dolly([7.5, 1.9, 24], [0, 1.6, 15.5], pushK(f, 672, 0.003), { fov: 40 });
// shot 8 (golden, a century): wide lonely stump, push on "100 years", low at the base on "that's what saved it"
const S8a = (f: number) => zoom([-14, 6, 58], [2, 9, 0], 42, pushK(f, 714, 0.0016));
const S8b = (f: number) => zoom([-14, 6, 58], [2, 9, 0], 42, pushK(f, 760, 0.0016, 0.005, 30));
const S8c = (f: number) => dolly([14, 1.2, 22], [3, 3, 2], pushK(f, 822, 0.003), { fov: 40, roll: 0.04 });
// shot 9: the wet clay at the foot of the tower (water beads squeezing out)
const S9a = (f: number) => dolly([10.2, 0.75, 7.6], [7.0, 0.35, 3.2], pushK(f, 852, 0.003), { fov: 40 });
// shot 10: the beach kid; closer and lower on "sink"; down at the feet on "the water squeezes out"; back up on "holds you"
const S10a = (f: number) => dolly(bx(1.3, 1.5, 6.2), bx(0, 1.15, -1.6), pushK(f, 906, 0.0025), { fov: 40 });
const S10b = (f: number) => dolly(bx(0.8, 0.75, 3.4), bx(0, 0.35, -1.6), pushK(f, 975, 0.0025), { fov: 38, roll: -0.035 });
const S10c = (f: number) => dolly(bx(-0.8, 1.3, 4.2), bx(0, 1.05, -1.6), pushK(f, 1040, 0.003), { fov: 40, roll: 0.03 });
// shot 11 (golden): the stump holding firm, slow push
const S11a = (f: number) => zoom([22, 4, 52], [0, 9, 0], 40, pushK(f, 1065, 0.002, 0.005, 30));
// shot 12 (1272): the old builders walk back in, then the upper floors go up
const S12a = (f: number) => dolly([6.5, 1.8, 26], [1, 1.7, 14], pushK(f, 1161, 0.0025), { fov: 42 });
const S12b = (f: number) => zoom([0, 6, 104], [0, 27, 0], 42, pushK(f, 1205, 0.0015));
// shot 13: straight side view of the bent tower, then the builder with the banana
const S13a = (f: number) => zoom([0, 4, 100], [0, 28, 0], 40, pushK(f, 1284, 0.0018));
const S13b = (f: number) => dolly([-2.6, 1.8, 20.5], [-1.4, 2.4, 13.1], pushK(f, 1352, 0.0025, 0.006, 30), { fov: 40, roll: -0.04 });
// shot 14 (1934): the official points; the concrete pump; the lurch
const S14a = (f: number) => dolly([-3.2, 1.75, 23.5], [-6.2, 1.85, 17.5], pushK(f, 1380, 0.0025), { fov: 40 });
const S14b = (f: number) => dolly([-17, 2.0, 23], [-10.5, 1.6, 8.5], pushK(f, 1470, 0.0022), { fov: 46, roll: 0.03 });
const S14c = (f: number) => zoom([10, 3.5, 92], [1, 26, 0], 44, pushK(f, 1540, 0.002));
// shot 15 (1990): the fenced tower; the drill rig on the high side; the tower easing back
const S15a = (f: number) => zoom([16, 3.0, 70], [0, 20, 0], 42, pushK(f, 1584, 0.002));
const S15b = (f: number) => dolly([-8.5, 2.2, 12.5], [-14.5, 1.8, -0.5], pushK(f, 1688, 0.0025), { fov: 44, roll: -0.03 });
const S15c = (f: number) => dolly([-9.0, 1.2, 4.6], [-14.4, 1.0, 0.0], pushK(f, 1748, 0.003), { fov: 42, roll: 0.03 });
const S15d = (f: number) => zoom([0, 4, 100], [0, 27, 0], 40, pushK(f, 1818, 0.002));
// shot 16 (2001): the engineer at the rig could go on... and switches it off
const S16a = (f: number) => dolly([-10.2, 1.8, 8.6], [-14.2, 1.7, 1.1], pushK(f, 1872, 0.0025), { fov: 42 });
const S16b = (f: number) => dolly([-11.6, 1.75, 5.6], [-14.2, 1.75, 1.1], pushK(f, 1952, 0.003, 0.006, 30), { fov: 38, roll: 0.04 });
// shot 17 (golden, today): tourists pushing the tower; crane up and out to the end
const S17a = (f: number) => zoom([8, 1.6, 62], [1.8, 18, 0], 50, pushK(f, 1992, 0.0025));
const CRANE: V3[] = [[14, 10, 80], [22, 12, 104], [0, 25, 0]];
const S17b = (f: number): Shot => {
  const a = S17a(2050), s = glide((f - 2050) / 70), r = 1 - s, [C, Bz, L] = CRANE;
  return { pos: [0, 1, 2].map((i) => r * r * a.pos[i] + 2 * s * r * C[i] + s * s * Bz[i]) as V3,
    look: [0, 1, 2].map((i) => a.look[i] + (L[i] - a.look[i]) * s) as V3, fov: (a.fov ?? 50) - 4 * s, roll: 0 };
};
const S17c = (f: number): Shot => { const e = S17b(2120); return zoom(e.pos, e.look, e.fov ?? 46, pushK(f, 2120, 0.0015)); };

const CAMS: Record<number, Key[]> = {
  1: [{ f: 0, s: S1a }, { f: 58, dur: 30, s: S1b }],
  2: [{ f: 126, s: S2a }, { f: 190, dur: 24, s: S2b }, { f: F(B.fanciest), cut: true, s: S2c }],
  3: [{ f: 288, s: S3a }, { f: 318, dur: 26, s: S3b }, { f: F(B.soft) - 2, cut: true, s: S3c }],
  4: [{ f: 405, s: S4a }, { f: F(B.perfect1) - 4, cut: true, s: S4b }],
  5: [{ f: 462, s: S5a }, { f: F(B.perfect2) - 8, cut: true, s: S5b }],
  6: [{ f: 525, s: S6a }, { f: 588, dur: 22, s: S6b }, { f: F(B.leans) + 16, cut: true, s: S6c }],
  7: [{ f: 639, s: S7a }, { f: F(B.dragged) - 2, cut: true, s: S7b }],
  8: [{ f: 714, s: S8a }, { f: 760, dur: 20, s: S8b }, { f: F(B.saved) - 6, cut: true, s: S8c }],
  9: [{ f: 852, s: S9a }],
  10: [{ f: 906, s: S10a }, { f: F(B.sink) - 2, cut: true, s: S10b }, { f: F(B.holds) - 4, cut: true, s: S10c }],
  11: [{ f: 1065, s: S11a }],
  12: [{ f: 1161, s: S12a }, { f: 1205, cut: true, s: S12b }],
  13: [{ f: 1284, s: S13a }, { f: F(B.banana) - 8, cut: true, s: S13b }],
  14: [{ f: 1380, s: S14a }, { f: 1470, cut: true, s: S14b }, { f: 1540, cut: true, s: S14c }],
  15: [{ f: 1584, s: S15a }, { f: 1688, cut: true, s: S15b }, { f: 1748, cut: true, s: S15c }, { f: 1818, cut: true, s: S15d }],
  16: [{ f: 1872, s: S16a }, { f: 1952, dur: 22, s: S16b }],
  17: [{ f: 1992, s: S17a }, { f: 2050, s: S17b, cut: true }, { f: 2120, cut: true, s: S17c }],
};

// impact kicks: the image offset flips sign every frame and decays to 0 in 7 f
export const KICKS: [number, number][] = [[POP[0] + 0.1, 0.5], [POP[1] + 0.1, 0.5], [POP[2] + 0.1, 0.5], [LEAN_T1 - 0.15, 0.9],
  [B.soft + 0.1, 0.4], [POP[3] + 0.1, 0.3], [POP[5] + 0.1, 0.3], [POP[7] + 0.1, 0.4], [51.75, 1.4], [B.closed + 0.05, 0.6], [B.stopped + 0.1, 0.4]];
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
  { f: 0, cInf: 6, focus: () => [6, 1.5, 46] }, { f: 58, dur: 30, cInf: 12, focus: () => [6, 1.6, 46] }, // hook: wide sharp, then MS on the tourists
  { f: 126, cInf: 0 }, { f: F(B.fanciest), cInf: 11 }, // aerial sharp, crowd MS
  { f: 288, cInf: 0 }, { f: F(B.soft) - 2, cInf: 13 }, // pit, builder CU in the mud
  { f: 405, cInf: 0 }, { f: F(B.perfect1) - 4, cInf: 12 }, { f: 462, cInf: 0 }, { f: F(B.perfect2) - 8, cInf: 12 },
  { f: 525, cInf: 0 }, { f: F(B.leans) + 16, cInf: 12 },
  { f: 639, cInf: 0 }, { f: F(B.dragged) - 2, cInf: 10 },
  { f: 714, cInf: 5 }, { f: F(B.saved) - 6, cInf: 10 },
  { f: 852, cInf: 12 },
  { f: 906, cInf: 13 }, { f: F(B.sink) - 2, cInf: 15 }, { f: F(B.holds) - 4, cInf: 13 },
  { f: 1065, cInf: 5 },
  { f: 1161, cInf: 11 }, { f: 1205, cInf: 0 },
  { f: 1284, cInf: 0 }, { f: F(B.banana) - 8, cInf: 13 },
  { f: 1380, cInf: 12 }, { f: 1470, cInf: 8 }, { f: 1540, cInf: 0 },
  { f: 1584, cInf: 0 }, { f: 1688, cInf: 10 }, { f: 1748, cInf: 13 }, { f: 1818, cInf: 0 },
  { f: 1872, cInf: 12 },
  { f: 1992, cInf: 8, focus: () => [6, 1.5, 46] }, { f: 2050, dur: 40, cInf: 0 },
];
export const dofAt = (f: number) => {
  let i = 0; while (i + 1 < DOF.length && f >= DOF[i + 1].f) i++;
  const d = DOF[i], p = DOF[Math.max(0, i - 1)];
  const k = d.dur ? Math.min(1, (f - d.f) / d.dur) : 1;
  return { cInf: p.cInf + (d.cInf - p.cInf) * k, focus: d.focus };
};
export const focusAt = (id: number, f: number): V3 => {
  const d = dofAt(f);
  return d.focus ? d.focus(f) : camAt(id, f).look;
};
/** frame at which the current key's move has finished */
export const keyEnd = (id: number, f: number) => {
  let e = 0;
  for (const k of CAMS[id]) if (f >= k.f) e = k.f + (k.cut ? 0 : k.dur ?? 24);
  return Math.max(f, e);
};

/** near framing objects (kit = a vegetation name accepted by build.ts kitClone) */
export type Fg = { a: number; b: number; kit: string; pos: V3; s?: number; yaw?: number };
export const FOREGROUND: Fg[] = [
  { a: 714, b: F(B.saved) - 6, kit: "plant_bushDetailed", pos: [-9.5, 0, 50], s: 1.6, yaw: 0.4 },
  { a: 1065, b: 1161, kit: "plant_bushLarge", pos: [17.5, 0, 44], s: 1.7, yaw: 0.2 },
];
