// Timeline of "Ang Batang Nanaginip ng Tulay" (the dream short): shots timed to the Tagalog voice
// (shorts/dream/voice/words.json, frames = round(s * 30)), story physics and the camera grammar of the bridge short:
// continuous slow push-ins; symmetric smootherstep glides; big reframes are cuts; impacts are 7-frame flip kicks.
// Two story clocks: DREAM shots (1, 4) replay the real 1831 collapse (the bridge short's physics, tau = story s);
// REAL shots (3, 6-10) run the same column but Nell breaks its step: the bounce dies and nothing snaps.
export const FPS = 30;
export const TOTAL = 2199; // voice.wav = 73.316 s
export const D0 = 6.0; // bank top + deck height (m)
export const HALF = 27; // towers at z = +-27, span 54 m
export const FILES = [-1.65, -0.55, 0.55, 1.65];
export const ROW_GAP = 1.3;
export const COUNT = 74;
export const PARK: V3 = [70, D0, -75]; // swing pivot base (x, ground y, z)
export type V3 = [number, number, number];

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const smooth = (x: number) => { const u = clamp01(x); return u * u * (3 - 2 * u); };
export const easeOut = (u: number) => 1 - (1 - clamp01(u)) ** 4;
const lin = (pts: [number, number][], x: number) => {
  if (x <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) if (x <= pts[i][0]) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
    return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
  }
  return pts[pts.length - 1][1];
};

// ---------------- voice beats (seconds in voice.wav) ----------------
export const W = {
  wake: 4.083, // "nagkakatotoo"
  run: 21.394, // "tumakbo"
  shout: 29.617, // "Sumigaw"
  grab: 33.783, // "kumuha"
  bang: 35.15, // "pinalo"
  laugh: 36.983, // "Natawa"
  dance: 38.483, // "sumasayaw"
  sloppy: 40.517, // "magmartsa"
  lose: 43.117, // "nawala ... sa ritmo"
  calm: 44.383, // "Humina ang talbog"
  quiet: 45.583, // "tumahimik"
  hits: [61.35, 62.117, 62.983], // "bawal" "tulay" "hakbang"
};
/** pan strikes: the first on "pinalo", then off the march beat (footfalls every 0.5 s) */
export const PAN_HITS = [35.15, 35.62, 35.98, 36.46, 36.71];

// ---------------- story physics (tau = story time in seconds) ----------------
export const front = (tau: number) => 26 - 1.6 * (tau - 4.4); // z of the front row, marching toward -z
export const marchPhase = (tau: number) => ((tau % 1) + 1) % 1; // 1 Hz cycle = 2 steps/s, footfalls at 0 and 0.5
export const SNAP = 34.62, DROP0 = 36.35, DROP1 = 36.95;
export const amp = (tau: number) =>
  lin([[14.85, 0], [17.8, 0.07], [21.4, 0.13], [27.4, 0.26], [33.0, 0.46], [SNAP, 0.55], [SNAP + 0.35, 0.0]], tau);
export const stomp = (tau: number) => lin([[21.4, 1.0], [27.4, 1.35], [33, 1.5]], tau);
export const shapeZ = (z: number) => (Math.abs(z) < HALF ? Math.cos((Math.PI * z) / (2 * HALF)) : 0);
export const dropW = (z: number) => smooth((20 - z) / 26);
export const dropU = (tau: number) => (tau < DROP0 ? 0 : Math.min(1, ((tau - DROP0) / (DROP1 - DROP0)) ** 2));
export const DROP_H = 6.6;
/** real clock: the column steps onto the bridge with the voice ("nasa tulay na" at 25.35 s has the front at z ~ 5) */
export const realTau = (t: number) => t - 7.85;
/** how far out of step soldier i is (0 in step .. 1 own pace): the laugh loosens it, "nawala sa ritmo" finishes it */
export const desync = (t: number, i: number) => {
  const h = Math.sin(i * 91.7 + 3.1) * 43758.5453, r = h - Math.floor(h);
  return smooth((t - (W.sloppy - 0.5 + 3.2 * r)) / 1.6);
};
/** real bounce: grows with the march, dies after the step breaks (never snaps) */
export const ampReal = (t: number) => Math.min(0.3, amp(realTau(t))) * (1 - 0.95 * smooth((t - W.lose + 0.3) / (W.quiet - W.lose + 0.6)));

export type BridgeState = { bounce: number; drop: number; snap: number; collapsed: boolean };
export const deckY = (z: number, b: BridgeState) => D0 + b.bounce * shapeZ(z) - b.drop * DROP_H * dropW(z);

// ---------------- places ----------------
/** Nell's bedroom set, far behind the town (camera looks down at the bed) */
export const ROOM: V3 = [0, D0, -200];
export const BED_TOP = D0 + 0.55;
export const NELL_SCALE = 0.85;
/** Nell at the near end of the bridge (shots 7-9) */
export const NELL_Q: V3 = [1.25, D0, -29.6];
/** Tom and Nell on the bank (shot 13) */
export const TOM_B: V3 = [1.9, D0, -34.3], NELL_B: V3 = [1.05, D0, -34.5];
export const SIGN_AT: V3 = [2.25, D0, -30.9];
/** the run (shot 5): three pieces of the same street, each its own path (time is compressed by the cuts) */
export const RUN: { a: number; b: number; z0: number; z1: number; x: number; ease?: boolean }[] = [
  { a: 600, b: 664, z0: -97.5, z1: -86.8, x: 0.4 }, // toward the lens down the main street
  { a: 664, b: 700, z0: -70.5, z1: -63.0, x: -0.2 }, // past the market stalls
  { a: 700, b: 730, z0: -62.0, z1: -54.5, x: -0.2 }, // high angle: the mill smoking behind the roofs
  { a: 730, b: 770, z0: -43.5, z1: -35.6, x: 0.8, ease: true }, // to the river, stops at the quay
];
export const nellRun = (f: number): { x: number; z: number; running: boolean; speed: number } => {
  const r = RUN.find((p) => f >= p.a && f < p.b) ?? RUN[RUN.length - 1];
  const u = clamp01((f - r.a) / (r.b - r.a)), k = r.ease ? easeOut(Math.min(1, u * 1.25)) : u;
  const sp = ((r.z1 - r.z0) / (r.b - r.a)) * FPS * (r.ease ? Math.max(0, 1 - u * 1.25) * 1.6 : 1);
  return { x: r.x, z: r.z0 + (r.z1 - r.z0) * k, running: sp > 0.8, speed: sp };
};
/** Tom and Nell strolling over the rebuilt bridge (shot 14) */
export const strollZ = (t: number) => 3.2 - 0.62 * (t - 63.6);

// ---------------- shots ----------------
export type Light = "day" | "golden";
export type Crowd = "dream" | "bed" | "march" | "run" | "sway" | "park" | "bank" | "tourists";
export type ShotDef = { id: number; a: number; b: number; light: Light; crowd: Crowd; tau: (t: number) => number; towns?: boolean; dream?: boolean; nell?: boolean };
const dreamTau4 = (t: number) => {
  const ts = 19.067; // SNAP on "bigla"; after it the dream runs 3x so the end drops on "bumagsak"
  return t < ts ? t + (SNAP - ts) : SNAP + 3 * (t - ts);
};
export const SHOTS: ShotDef[] = [
  { id: 1, a: 0, b: 80, light: "day", crowd: "dream", dream: true, tau: (t) => DROP0 - 1.05 + 0.85 * t },
  { id: 2, a: 80, b: 160, light: "day", crowd: "bed", tau: (t) => t },
  { id: 3, a: 160, b: 415, light: "day", crowd: "march", tau: realTau, towns: true },
  { id: 4, a: 415, b: 608, light: "day", crowd: "dream", dream: true, tau: dreamTau4 },
  { id: 5, a: 608, b: 760, light: "day", crowd: "run", tau: realTau },
  { id: 6, a: 760, b: 889, light: "day", crowd: "march", tau: realTau },
  { id: 7, a: 889, b: 1007, light: "day", crowd: "march", tau: realTau, nell: true },
  { id: 8, a: 1007, b: 1109, light: "day", crowd: "march", tau: realTau, nell: true },
  { id: 9, a: 1109, b: 1274, light: "day", crowd: "march", tau: realTau, nell: true },
  { id: 10, a: 1274, b: 1412, light: "day", crowd: "march", tau: realTau },
  { id: 11, a: 1412, b: 1513, light: "golden", crowd: "sway", tau: (t) => t },
  { id: 12, a: 1513, b: 1733, light: "golden", crowd: "park", tau: (t) => t },
  { id: 13, a: 1733, b: 1910, light: "day", crowd: "bank", tau: (t) => t },
  { id: 14, a: 1910, b: TOTAL, light: "day", crowd: "tourists", tau: (t) => t, towns: true },
];
/** crossfades (frames) at place/time changes; white flashes cover the two wake-ups */
export const XFADE: Record<number, number> = { 11: 8, 12: 8, 13: 8, 14: 8 };
export const FLASHES = [160, 606];
/** dream look 0..1 (grade + vignette in Dream.tsx): full in the dream shots, gone as Nell's eyes open */
export const dreamAt = (f: number) => {
  const s = shotAt(f);
  if (s.dream) return 1;
  if (s.id === 2) return 1 - smooth((f / FPS - (W.wake - 0.25)) / 0.35);
  return 0;
};

export const shotAt = (f: number) => SHOTS.find((s) => f >= s.a && f < s.b) ?? SHOTS[SHOTS.length - 1];
export const layersAt = (f: number): { id: number; alpha: number }[] => {
  for (const s of SHOTS) {
    const x = XFADE[s.id];
    if (x && f >= s.a - x / 2 && f < s.a + x / 2) return [{ id: s.id - 1, alpha: 1 }, { id: s.id, alpha: (f - (s.a - x / 2) + 1) / (x + 1) }];
  }
  return [{ id: shotAt(f).id, alpha: 1 }];
};

export const bridgeState = (id: number, t: number): BridgeState => {
  const s = SHOTS[id - 1];
  const tau = s.tau(t);
  if (s.crowd === "dream") {
    const bounce = -amp(tau) * Math.cos(4 * Math.PI * marchPhase(tau));
    return { bounce, drop: dropU(tau), snap: clamp01((tau - SNAP) / 0.7), collapsed: tau >= DROP1 };
  }
  if (s.crowd === "sway") return { bounce: 0.6 * Math.sin(2 * Math.PI * 0.7 * (t - 47.0)), drop: 0, snap: 0, collapsed: false };
  if (s.crowd === "march") return { bounce: -ampReal(t) * Math.cos(4 * Math.PI * marchPhase(tau)), drop: 0, snap: 0, collapsed: false };
  return { bounce: 0, drop: 0, snap: 0, collapsed: false };
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
const Fz = (id: number, f: number) => front(SHOTS[id - 1].tau(T(f)));
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

export const ANCHOR: V3 = [-2.7, D0 + 0.62, -37];
export const snapEnd = (snap: number): V3 => {
  const u = easeOut(snap);
  return [ANCHOR[0] - 0.6 * u, ANCHOR[1] + 5.5 * u - 2.0 * u * u, ANCHOR[2] + 4.5 * u];
};

// ---- framings ----
// 1 (hook, dream): aerial over the near half as it drops; closer + roll on "kuya niya"
const S1a = (f: number) => dolly([4.5, 15, -45], [0, 3.2, -14], pushK(f, 0, 0.003), { fov: 42 });
const S1b = (f: number) => dolly([6.5, 3.0, -27], [0, 2.0, -18], pushK(f, 52, 0.0025), { fov: 44, roll: -0.04 });
// 2: Nell asleep, looking down at the pillow; pushes in, punch on "nagkakatotoo"
const HEAD: V3 = [ROOM[0], BED_TOP + 0.1, ROOM[2] - 0.55];
const S2a = (f: number) => dolly([HEAD[0] + 0.35, BED_TOP + 2.2, HEAD[2] + 0.95], HEAD, pushK(f, 80, 0.003, 0.009, 30), { fov: 38, roll: 0.03 });
// 3: town aerial (cheering) -> Tom MS (front row, second file) -> aerial over the bridge (punch on "bagong-bagong")
const TOMX = FILES[1];
const S3a = (f: number) => zoom([17, 13, -52], [0, 9, 4], 44, pushK(f, 160, 0.002));
const S3b = (f: number) => { const F = Fz(3, f); return dolly([TOMX + 0.35, D0 + 1.75, F - 3.6], [TOMX, D0 + 1.6, F + 0.4], pushK(f, 242, 0.0025), { fov: 36 }); };
const S3c = (f: number) => zoom([5, 10, -31], [0, 8.6, 30], 40, pushK(f, 349, 0.0015, 0.006, 35));
// 4 (dream): high wide over the column -> boots -> side bounce -> the bolt -> snap -> down at the water
const S4a = (f: number) => { const F = Fz(4, f); return dolly([5.5, D0 + 5.5, F - 9], [0, D0 + 0.8, F + 7], pushK(f, 415, 0.002), { fov: 44, roll: -0.03 }); };
const S4b = (f: number) => { const F = Fz(4, f); return dolly([0.5, D0 + 0.36, F - 3.5], [0, D0 + 0.3, F + 0.4], pushK(f, 488, 0.0025), { fov: 36 }); };
const S4c = (f: number) => { const F = Fz(4, f); return dolly([9.5, D0 + 1.2, F + 5.5], [0, D0 + 0.95, F + 5.5], pushK(f, 530, 0.0015, 0.006, 30), { fov: 38, roll: -0.035 }); };
const S4d = (f: number) => dolly([-2.35, D0 + 1.25, -38.9], [ANCHOR[0], ANCHOR[1] + 0.3, ANCHOR[2]], pushK(f, 566, 0.0025, 0.008, 12), { fov: 34 });
const S4e = (f: number) => { const u = glide((f - 573) / 15); return { pos: [0.9, D0 + 2.2 + 0.3 * u, -41.2 - 0.4 * u] as V3, look: [-2.9 - 0.2 * u, ANCHOR[1] + 1.6 + 1.0 * u, -35 + 1.2 * u] as V3, fov: 38, roll: 0.04 }; };
const S4f = (f: number) => dolly([7.5, 2.4, -25], [0, 2.0, -17.5], pushK(f, 588, 0.003), { fov: 44, roll: -0.04 });
// 5: the run. toward the lens -> side track past the stalls -> high angle over the street to the mill -> to the quay
const S5a = (f: number) => zoom([1.9, D0 + 1.05, -83.2], [0.3, D0 + 0.8, -93], 40, pushK(f, 608, 0.0025, 0.006, 20));
const S5b = (f: number) => { const n = nellRun(f); return { pos: [4.3, D0 + 1.15, n.z + 1.4] as V3, look: [-0.6, D0 + 0.85, n.z + 0.4] as V3, fov: 42, roll: 0.03 }; };
const S5c = (f: number) => dolly([12, D0 + 15, -44], [-12, D0 + 4, -70], pushK(f, 700, 0.0025), { fov: 46 });
const S5d = (f: number) => dolly([8.5, D0 + 1.6, -45], [0.4, D0 + 2.2, -31], pushK(f, 730, 0.002), { fov: 46, roll: -0.03 });
// 6: wide ahead of the column on the deck -> boots CU ("bawat bota")
const S6a = (f: number) => { const F = Fz(6, f); return zoom([-3.0, D0 + 1.4, F - 11], [0, D0 + 1.7, F + 3], 46, pushK(f, 760, 0.002), { roll: -0.03 }); };
const S6b = (f: number) => { const F = Fz(6, f); return dolly([0.5, D0 + 0.36, F - 3.5], [0, D0 + 0.3, F + 0.4], pushK(f, 833, 0.0018), { fov: 36 }); };
// 7: Nell shouting at the bridge end -> the front row does not hear -> Nell small against the column
const NQ = NELL_Q;
const S7a = (f: number) => dolly([NQ[0] - 0.9, D0 + 0.95, NQ[2] - 2.6], [NQ[0] - 0.05, D0 + 0.95, NQ[2]], pushK(f, 889, 0.003, 0.008, 20), { fov: 38, roll: 0.035 });
const S7b = (f: number) => { const F = Fz(7, f); return dolly([0.3, D0 + 1.8, F - 4.7], [0, D0 + 1.55, F + 1.2], pushK(f, 925, 0.0025), { fov: 38 }); };
const S7c = (f: number) => dolly([5.2, D0 + 1.5, NQ[2] - 3.2], [-0.5, D0 + 1.4, NQ[2] + 7], pushK(f, 974, 0.0025), { fov: 44, roll: -0.03 });
// 8: the pan. MS (grab) -> CU on "pinalo" (kicks on every strike)
const S8a = (f: number) => dolly([NQ[0] - 0.7, D0 + 1.0, NQ[2] - 3.4], [NQ[0] - 0.1, D0 + 0.85, NQ[2]], pushK(f, 1007, 0.0025), { fov: 38 });
const S8b = (f: number) => dolly([NQ[0] - 0.35, D0 + 0.95, NQ[2] - 1.9], [NQ[0] - 0.05, D0 + 0.98, NQ[2]], pushK(f, 1049, 0.002), { fov: 36, roll: -0.04 });
// 9: the front row laughing -> Nell dancing with the column behind -> side view, the step going sloppy
const S9a = (f: number) => { const F = Fz(9, f); return dolly([-0.5, D0 + 1.7, F - 3.5], [0, D0 + 1.6, F + 0.6], pushK(f, 1109, 0.0025), { fov: 36, roll: 0.04 }); };
const S9b = (f: number) => dolly([5.6, D0 + 1.35, NQ[2] - 2.0], [0.2, D0 + 1.1, NQ[2] + 4.5], pushK(f, 1147, 0.0025), { fov: 46 });
const S9c = (f: number) => { const F = Fz(9, f); return dolly([13, D0 + 2.4, F + 7], [0, D0 + 1.2, F + 7], pushK(f, 1195, 0.002)); };
// 10: lower side view, out of step ("isa-isa") -> the chain going quiet
const S10a = (f: number) => { const F = Fz(10, f); return dolly([9.5, D0 + 1.2, F + 5.5], [0, D0 + 0.95, F + 5.5], pushK(f, 1274, 0.0018), { fov: 38, roll: 0.03 }); };
const S10b = (f: number) => { const F = Fz(10, f); return dolly([-5.4, D0 + 4.6, F - 2.0], [-2.7, D0 + 3.4, F + 2.5], pushK(f, 1367, 0.0025), { fov: 40, roll: -0.02 }); };
// 11: golden sway wide; 12: the park swing
const S11a = (f: number) => zoom([14, 10.5, -47], [-1, 7, -4], 40, pushK(f, 1404, 0.0016));
const S12a = (f: number) => dolly([PARK[0] + 0.55, D0 + 1.5, PARK[2] - 8], [PARK[0] + 0.55, D0 + 1.75, PARK[2]], pushK(f, 1505, 0.001), { fov: 40 });
const S12b = (f: number) => dolly([PARK[0] - 1.6, D0 + 1.9, PARK[2] - 9.5], [PARK[0] + 0.4, D0 + 1.95, PARK[2]], pushK(f, 1596, 0.0015), { fov: 42 });
const S12c = (f: number) => dolly([PARK[0] + 0.55, D0 + 1.6, PARK[2] - 7.0], [PARK[0] + 0.55, D0 + 1.7, PARK[2]], pushK(f, 1654, 0.002), { fov: 40, roll: 0.035 });
// 13: Tom and Nell safe on the bank -> the officer at the sign
const S13a = (f: number) => dolly([TOM_B[0] - 2.4, D0 + 1.35, TOM_B[2] - 4.0], [(TOM_B[0] + NELL_B[0]) / 2, D0 + 1.15, TOM_B[2]], pushK(f, 1729, 0.0025), { fov: 40 });
const S13b = (f: number) => zoom([1.3, D0 + 1.6, -36.6], [2.9, D0 + 1.3, -31.2], 42, pushK(f, 1778, 0.0025, 0.004, 24));
// 14: tourists, punch on "pinakadisiplinadong" -> Tom and Nell strolling -> crane out
const S14a = (f: number) => dolly([1.7, D0 + 1.75, -15.5], [0, D0 + 1.5, -9], pushK(f, 1906, 0.0025), { fov: 40 });
const S14b = (f: number) => dolly([-1.3, D0 + 1.6, -13], [0, D0 + 1.5, -7.5], pushK(f, 1930, 0.0015, 0.006, 32), { fov: 38 });
const S14c = (f: number) => { const z = strollZ(T(f)); return dolly([1.8, D0 + 1.45, z - 4.6], [0.15, D0 + 1.15, z], pushK(f, 2065, 0.0025), { fov: 38 }); };
const CRANE: V3[] = [[0, 18, -16], [17, 15, -44], [0, 7, 2]];
const S14d = (f: number): Shot => {
  const a = S14c(2125), s = glide((f - 2125) / 74), r = 1 - s, [C, B, L] = CRANE;
  return { pos: [0, 1, 2].map((i) => r * r * a.pos[i] + 2 * s * r * C[i] + s * s * B[i]) as V3,
    look: [0, 1, 2].map((i) => a.look[i] + (L[i] - a.look[i]) * s) as V3, fov: (a.fov ?? 40) + (44 - (a.fov ?? 40)) * s, roll: 0 };
};

const CAMS: Record<number, Key[]> = {
  1: [{ f: 0, s: S1a }, { f: 52, cut: true, s: S1b }], // cut down to the water on "kuya" (slam + kick at 61)
  2: [{ f: 80, s: S2a }],
  3: [{ f: 160, s: S3a }, { f: 242, cut: true, s: S3b }, { f: 349, cut: true, s: S3c }],
  4: [
    { f: 415, s: S4a }, { f: 488, cut: true, s: S4b }, { f: 530, cut: true, s: S4c }, { f: 530, dur: 20, s: rolled(S4c, 0.035) },
    { f: 566, cut: true, s: S4d }, { f: 573, cut: true, s: S4e }, { f: 588, cut: true, s: S4f },
  ],
  5: [{ f: 608, s: S5a }, { f: 664, cut: true, s: S5b }, { f: 700, cut: true, s: S5c }, { f: 730, cut: true, s: S5d }],
  6: [{ f: 760, s: S6a }, { f: 833, cut: true, s: S6b }],
  7: [{ f: 889, s: S7a }, { f: 925, cut: true, s: S7b }, { f: 974, cut: true, s: S7c }],
  8: [{ f: 1007, s: S8a }, { f: 1049, cut: true, s: S8b }],
  9: [{ f: 1109, s: S9a }, { f: 1147, cut: true, s: S9b }, { f: 1195, cut: true, s: S9c }],
  10: [{ f: 1274, s: S10a }, { f: 1367, cut: true, s: S10b }],
  11: [{ f: 1404, s: S11a }],
  12: [{ f: 1505, s: S12a }, { f: 1596, dur: 28, s: S12b }, { f: 1654, cut: true, s: S12c }],
  13: [{ f: 1729, s: S13a }, { f: 1778, cut: true, s: S13b }],
  14: [{ f: 1906, s: S14a }, { f: 1930, dur: 30, s: S14b }, { f: 2065, cut: true, s: S14c }, { f: 2125, cut: true, s: S14d }],
};

// impact kicks: flip sign every frame, decay over 7 f
const SH = SHOTS;
const tOfTau = (id: number, tau: number) => { for (let f = SH[id - 1].a; f < SH[id - 1].b; f++) if (SH[id - 1].tau(T(f)) >= tau) return T(f); return -9; };
const KICKS: [number, number][] = [
  [tOfTau(1, DROP1), 1.6], [W.wake - 0.04, 0.6], [tOfTau(4, SNAP), 1], [tOfTau(4, DROP1), 1.6],
  ...PAN_HITS.map((h, i) => [h, i ? 0.45 : 0.8] as [number, number]),
  ...W.hits.map((h, i) => [h, i === 2 ? 0.7 : 0.5] as [number, number]),
];
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
export const keyEnd = (id: number, f: number) => {
  let e = 0;
  for (const k of CAMS[id]) if (f >= k.f) e = k.f + (k.cut ? 0 : k.dur ?? 24);
  return Math.max(f, e);
};

// ---------------- lens: depth of field + foreground framing ----------------
export type Dof = { f: number; dur?: number; cInf: number; focus?: (f: number) => V3 };
const eyes = (id: number, x = 0) => (f: number): V3 => [x, D0 + 1.6, Fz(id, f)];
const boots = (id: number) => (f: number): V3 => [0, D0 + 0.3, Fz(id, f)];
const nellEyes: (f: number) => V3 = () => [NQ[0], D0 + 0.9, NQ[2]];
export const DOF: Dof[] = [
  { f: 0, cInf: 0 }, // dream aerial
  { f: 52, cInf: 8 }, // down at the water
  { f: 80, cInf: 14, focus: () => HEAD }, // asleep CU
  { f: 160, cInf: 0 }, // town aerial
  { f: 242, cInf: 12, focus: eyes(3, TOMX) }, // Tom MS
  { f: 349, cInf: 0 }, // aerial
  { f: 488, cInf: 14, focus: boots(4) }, // dream boots
  { f: 530, cInf: 0 }, // side bounce
  { f: 566, cInf: 14 }, // bolt insert (focus = look)
  { f: 573, cInf: 10 }, // snap
  { f: 588, cInf: 0 }, // water level
  { f: 608, cInf: 12, focus: (f) => { const n = nellRun(f); return [n.x, D0 + 0.9, n.z]; } }, // running at the lens
  { f: 664, cInf: 10, focus: (f) => { const n = nellRun(f); return [n.x, D0 + 0.9, n.z]; } }, // side track
  { f: 700, cInf: 0 }, // high angle
  { f: 730, cInf: 6, focus: (f) => { const n = nellRun(f); return [n.x, D0 + 0.9, n.z]; } }, // to the quay
  { f: 760, cInf: 0 }, // column wide
  { f: 833, cInf: 14, focus: boots(6) }, // boots
  { f: 889, cInf: 14, focus: nellEyes }, // Nell shouting
  { f: 925, cInf: 10, focus: eyes(7) }, // front row
  { f: 974, cInf: 6, focus: nellEyes }, // Nell vs the column
  { f: 1007, cInf: 12, focus: nellEyes }, // the pan MS
  { f: 1049, cInf: 15, focus: nellEyes }, // pan CU
  { f: 1109, cInf: 12, focus: eyes(9) }, // laughing faces
  { f: 1147, cInf: 7, focus: nellEyes }, // Nell dancing
  { f: 1195, cInf: 0 }, // side views
  { f: 1367, cInf: 0 }, // chain
  { f: 1412, cInf: 5 }, // golden sway
  { f: 1513, cInf: 7 }, // park
  { f: 1733, cInf: 11, focus: () => [TOM_B[0], D0 + 1.4, TOM_B[2]] }, // Tom + Nell
  { f: 1778, cInf: 12, focus: () => [3.35, D0 + 1.6, -31.55] }, // officer
  { f: 1910, cInf: 0 }, // tourists
  { f: 2065, cInf: 10, focus: (f) => [0.5, D0 + 1.3, strollZ(T(f))] }, // Tom + Nell strolling
  { f: 2125, cInf: 0 }, // crane
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

export type Fg = { a: number; b: number; kit: string; pos: V3; s?: number; yaw?: number };
export const FOREGROUND: Fg[] = [
  // park swing: a bush in the bottom-right corner, below the kid's arc
  { a: 1513, b: 1733, kit: "plant_bushDetailed", pos: [69.65, D0, -79.4], s: 1.2, yaw: 0.4 },
  // Tom + Nell on the bank: a bush bottom-left
  { a: 1733, b: 1778, kit: "plant_bushDetailed", pos: [-0.9, D0, -37.6], s: 0.9, yaw: 0.6 },
];
