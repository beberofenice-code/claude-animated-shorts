// Timeline of "The Ghost Ship Mary Celeste": shots timed to the voice words (ghost-short/voice/words.json),
// story physics (ship poses, the lifeboat on its towline, the snap) and the camera grammar of the bridge short:
// cuts on big reframes, smootherstep glides 18-40 f, every hold creeps in, 7-frame flip kicks on impacts.
export const FPS = 30;
export const TOTAL = 2064;
export const D0 = 0; // sea level (build.ts helpers take a base height)
export type V3 = [number, number, number];

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const smooth = (x: number) => { const u = clamp01(x); return u * u * (3 - 2 * u); };
export const easeOut = (u: number) => 1 - (1 - clamp01(u)) ** 4;

// ---------------- sets (world origins) ----------------
export const HOLD: V3 = [400, 0, 0];   // cargo hold interior (x -4..4, z -10..10, 3.4 m high)
export const HOUSE: V3 = [-400, 0, 0]; // the smoke-alarm house (front door at local (0, 0, 3.5))
export const STUDY: V3 = [800, 0, 0];  // the doctor's study (room x -4..4, z -4..4)
export const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

// ---------------- ships ----------------
// Mary Celeste ("mc") local frame: bow toward +z, waterline at y 0, deck at DECK, stern rail at z -15.
export const DECK = 2.4, RAIL = 3.35;
export const STERN: V3 = [0.6, RAIL, -15.2]; // where the towline is made fast
export const WHEEL: V3 = [0, DECK + 1.05, -13.3];
export const ROPE = 22;                       // towline length (m)
export const SNAP_T = 54.8;                   // "the rope snapped"
export type Pose = { p: V3; yaw: number; pitch: number; roll: number };
const HIDE: Pose = { p: [-3000, -50, -3000], yaw: 0, pitch: 0, roll: 0 };

/** Mary Celeste forward travel (z) at story time t: 1.5 m/s with the boat in tow, then the sails fill and she runs */
export const mcZ = (t: number) => {
  const base = 1.5 * (t - 51);
  if (t < 53.3) return base;
  const u = t - 53.3, k = Math.min(u, 3); // wind fills from "The wind"
  return base + 0.18 * k * k + (u > 3 ? 1.08 * (u - 3) : 0) + (t > SNAP_T ? 0.55 * (t - SNAP_T) ** 2 : 0);
};
/** lifeboat bow distance behind the stern: the rope is taut until the snap, then the boat stops dead */
export const boatZ = (t: number) => {
  if (t < SNAP_T) return mcZ(t) - 15.2 - ROPE - 2.6;
  const z0 = mcZ(SNAP_T) - 15.2 - ROPE - 2.6, v0 = 1.5 + 0.36 * Math.min(SNAP_T - 53.3, 3);
  return z0 + v0 * 0.9 * (1 - Math.exp(-(t - SNAP_T) / 0.9));
};
const sway = (t: number, k = 1): Pose => ({ p: [0, 0.07 * k * Math.sin(0.9 * t), 0], yaw: 0, pitch: 0.012 * k * Math.sin(0.55 * t + 1), roll: 0.022 * k * Math.sin(0.7 * t) });

export type ShipName = "mc" | "dg" | "boat";
export const shipPose = (name: ShipName, id: number, t: number): Pose => {
  const sw = sway(t + (name === "dg" ? 2 : name === "boat" ? 5 : 0), name === "boat" ? 1.6 : 1);
  const moving = id === 17 || (id >= 19 && id <= 23);
  if (name === "mc") {
    if (id === 6) return { ...sw, yaw: 0.16 * Math.sin(1.35 * t) + 0.04 * Math.sin(3.1 * t) }; // wobbling, nobody steering
    if (moving) return { ...sw, p: [0, sw.p[1], mcZ(t)] };
    return sw;
  }
  if (name === "dg") {
    if (id === 5 || id === 6) return { ...sw, p: [-40, sw.p[1], -45], yaw: 0.73 };
    if (id === 13) return { ...sw, p: [-14, sw.p[1], 6], yaw: 0.04 };
    return HIDE;
  }
  // the lifeboat (yawl) in the water, towed behind the stern
  if (moving) return { ...sw, p: [0.4, sw.p[1] * 0.6, boatZ(t)], yaw: id >= 21 && t > SNAP_T ? 0.25 * smooth((t - SNAP_T) / 3) : 0.03 * Math.sin(0.8 * t) };
  return HIDE;
};
/** local point -> world for a pose (yaw about y, then pitch about x, then roll about z; YXZ like three.js) */
export const toWorld = (P: Pose, l: V3): V3 => {
  const [x, y, z] = l;
  const cr = Math.cos(P.roll), sr = Math.sin(P.roll), cp = Math.cos(P.pitch), sp = Math.sin(P.pitch), cy = Math.cos(P.yaw), sy = Math.sin(P.yaw);
  const x1 = x * cr - y * sr, y1 = x * sr + y * cr, z1 = z;           // roll (z)
  const y2 = y1 * cp - z1 * sp, z2 = y1 * sp + z1 * cp, x2 = x1;       // pitch (x)
  const x3 = x2 * cy + z2 * sy, z3 = -x2 * sy + z2 * cy;               // yaw (y)
  return [x3 + P.p[0], y2 + P.p[1], z3 + P.p[2]];
};
export const mcAt = (id: number, t: number, l: V3) => toWorld(shipPose("mc", id, t), l);
export const dgAt = (id: number, t: number, l: V3) => toWorld(shipPose("dg", id, t), l);
export const boatAt = (id: number, t: number, l: V3) => toWorld(shipPose("boat", id, t), l);

/** how full the sails are (0 slack .. 1 full): drawn in when becalmed for the boat, full when the wind fills them */
export const sailFill = (id: number, t: number) => (id === 20 ? 0.25 + 0.75 * smooth((t - 53.2) / 1.0) : id >= 21 && id <= 23 ? 1 : id === 17 ? 0.35 : 0.7);
/** the wheel spins by itself (nobody steering) */
export const wheelAngle = (id: number, t: number) => (id === 7 ? 0.9 * Math.sin(2.2 * t) + 0.35 * Math.sin(5.3 * t) : 0.6 * Math.sin(1.1 * t));
/** door of the house: open (1.6 rad) until it slams at "slams" (49.94 s) */
export const SLAM_T = 49.94;
export const doorAngle = (t: number) => (t < SLAM_T - 0.12 ? 1.55 : t < SLAM_T ? 1.55 * (1 - ((t - SLAM_T + 0.12) / 0.12) ** 2) : -0.04 * Math.exp(-(t - SLAM_T) * 9) * Math.cos((t - SLAM_T) * 40));
/** the lifeboat is back on the model ship from "back" */
export const MODEL_BOAT_T = 61.62;

// ---------------- shots ----------------
export type Light = "day" | "golden";
export type Place = "sea" | "hold" | "house" | "study";
export type ShotDef = { id: number; a: number; b: number; light: Light; place: Place; sunAz?: number; sunEl?: number };
export const SHOTS: ShotDef[] = [
  { id: 1, a: 0, b: 180, light: "day", place: "sea" },        // hook: the ghost ship, the empty deck, the wheel
  { id: 2, a: 180, b: 228, light: "day", place: "sea" },      // "She was the Mary Celeste"
  { id: 3, a: 228, b: 290, light: "day", place: "hold", sunAz: 40, sunEl: 62 }, // "carrying alcohol ... to Italy"
  { id: 4, a: 290, b: 388, light: "day", place: "sea" },      // captain, wife, daughter, seven crew
  { id: 5, a: 388, b: 450, light: "day", place: "sea" },      // "another ship spots her"
  { id: 6, a: 450, b: 505, light: "day", place: "sea" },      // wobbling along
  { id: 7, a: 505, b: 537, light: "day", place: "sea" },      // "because nobody is": the wheel
  { id: 8, a: 537, b: 581, light: "day", place: "sea" },      // "climb aboard"
  { id: 9, a: 581, b: 605, light: "day", place: "sea" },      // "Sails up"
  { id: 10, a: 605, b: 649, light: "day", place: "hold", sunAz: 40, sunEl: 62 }, // food and water
  { id: 11, a: 649, b: 681, light: "day", place: "hold", sunAz: 40, sunEl: 62 }, // cargo untouched
  { id: 12, a: 681, b: 771, light: "day", place: "sea" },     // the lifeboat is missing, and all ten people
  { id: 13, a: 771, b: 963, light: "day", place: "sea" },     // Luckily / Unluckily / why everyone left
  { id: 14, a: 963, b: 1107, light: "day", place: "hold", sunAz: 40, sunEl: 62 }, // nine empty barrels, leakier wood
  { id: 15, a: 1107, b: 1160, light: "day", place: "hold", sunAz: 40, sunEl: 62 }, // a hold full of fumes
  { id: 16, a: 1160, b: 1272, light: "day", place: "sea" },   // the captain at the hatch, one spark
  { id: 17, a: 1272, b: 1407, light: "day", place: "sea" },   // into the lifeboat, the long rope
  { id: 18, a: 1407, b: 1530, light: "day", place: "house", sunAz: 125, sunEl: 40 }, // smoke alarm, door slams
  { id: 19, a: 1530, b: 1597, light: "day", place: "sea" },   // a frayed rope trailing in the water
  { id: 20, a: 1597, b: 1640, light: "golden", place: "sea", sunAz: 150, sunEl: 14 },// the wind fills the sails
  { id: 21, a: 1640, b: 1668, light: "golden", place: "sea" },// the rope snaps
  { id: 22, a: 1668, b: 1710, light: "golden", place: "sea" },// the ship sails on without them
  { id: 23, a: 1710, b: 1745, light: "golden", place: "sea" },// never seen again
  { id: 24, a: 1745, b: 1830, light: "golden", place: "study", sunAz: 150, sunEl: 22 }, // twelve years later, a young doctor
  { id: 25, a: 1830, b: 1889, light: "golden", place: "study", sunAz: 150, sunEl: 22 }, // put the lifeboat back
  { id: 26, a: 1889, b: 1962, light: "golden", place: "study", sunAz: 150, sunEl: 22 }, // got her name wrong / half the world
  { id: 27, a: 1962, b: TOTAL, light: "golden", place: "study", sunAz: 150, sunEl: 22 }, // Arthur Conan Doyle
];
/** crossfades (frames) at place/time changes; a white 4-frame flash after the hook */
export const XFADE: Record<number, number> = { 3: 6, 4: 6, 10: 6, 12: 6, 14: 8, 16: 6, 18: 8, 19: 8, 20: 10, 23: 8, 24: 12 };
export const FLASH_AT = 180;

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
const mixC = (a: Cam, b: Cam, k: number): Cam => ({
  pos: a.pos.map((v, i) => v + (b.pos[i] - v) * k) as V3, look: a.look.map((v, i) => v + (b.look[i] - v) * k) as V3,
  fov: a.fov + (b.fov - a.fov) * k, roll: a.roll + (b.roll - a.roll) * k,
});
const full = (c: Shot): Cam => ({ fov: 40, roll: 0, ...c });
const run = (keys: Key[], f: number) => {
  let cur = full(keys[0].s(f));
  for (let i = 1; i < keys.length; i++) {
    const k = keys[i];
    if (f < k.f) break;
    cur = k.cut ? full(k.s(f)) : mixC(cur, full(k.s(f)), glide((f - k.f) / (k.dur ?? 24)));
  }
  return cur;
};
const T = (f: number) => f / FPS;
/** push-in factor since f0 (subject grows ~rate per frame); `punch` raises it for n frames with 8 f soft edges */
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
const H = (l: V3) => add(HOLD, l), Ho = (l: V3) => add(HOUSE, l), St = (l: V3) => add(STUDY, l);
const mz = (f: number) => mcZ(T(f)), bz = (f: number) => boatZ(T(f));

// ---- framings ----
// 1 hook: aerial 3/4 front -> lower 3/4 front -> behind the empty wheel
const S1a = (f: number) => dolly([36, 20, 46], [0, 7, 0], pushK(f, 0, 0.0022), { fov: 40 });
const S1b = (f: number) => dolly([13, 4.2, 27], [0, 7.5, 1], pushK(f, 104, 0.0022), { fov: 44, roll: -0.035 });
const S1c = (f: number) => dolly([0.85, 4.05, -16.4], [0, 3.55, -8], pushK(f, 145, 0.003, 0.006, 30), { fov: 46 });
// 2 port side, full ship
const S2a = (f: number) => dolly([-44, 5.5, 14], [0, 8.5, 1], pushK(f, 176, 0.0025), { fov: 40, roll: 0.03 });
// 3 hold: along the barrel rows
const S3a = (f: number) => dolly(H([0.2, 1.65, -9.6]), H([0, 1.0, 1]), pushK(f, 224, 0.003), { fov: 46 });
// 4 family line-up in front of the deckhouse, then wide with the crew
const S4a = (f: number) => dolly([-0.75, 4.15, -2.4], [-1.05, 3.85, -5.8], pushK(f, 286, 0.0025), { fov: 38 });
const S4b = (f: number) => dolly([0.3, 4.0, -2.5], [0.25, 3.7, -5.8], pushK(f, 308, 0.0025), { fov: 38 });
const S4c = (f: number) => dolly([1.15, 3.55, -2.7], [1.2, 3.15, -5.7], pushK(f, 328, 0.002), { fov: 38, roll: 0.035 });
const S4d = (f: number) => dolly([5.5, 8.2, 6.5], [0, 3.1, -4.5], pushK(f, 362, 0.003), { fov: 42 });
// 5 Dei Gratia bow: the lookout with the spyglass (lens over the bowsprit looking back at him)
const S5a = (f: number) => { const t = T(f); return dolly(dgAt(5, t, [1.3, 4.45, 13.3]), dgAt(5, t, [0.3, 3.95, 9.8]), pushK(f, 384, 0.0025, 0.006, 30), { fov: 40 }); };
// 6 POV from the Dei Gratia bow: the Mary Celeste wobbling, telephoto
const S6a = (f: number) => { const t = T(f); return zoom(dgAt(6, t, [0.8, 6.0, 26]), [0, 7.5, 0], 36, pushK(f, 446, 0.0025)); };
// 7 the empty wheel, CU
const S7a = (f: number) => dolly([0.95, 4.05, -16.0], [0, 3.55, -13.3], pushK(f, 501, 0.003, 0.007, 22), { fov: 38, roll: -0.04 });
// 8 boarding party over the starboard rail
const S8a = (f: number) => dolly([-1.4, 4.4, 6.4], [3.0, 3.4, 1.3], pushK(f, 533, 0.0025), { fov: 42 });
// 9 low angle up the sails
const S9a = (f: number) => dolly([1.8, 3.4, -3.5], [0, 15, 5], pushK(f, 577, 0.003), { fov: 52, roll: 0.05 });
// 10 hold: food and water; 11 cargo untouched
const S10a = (f: number) => dolly(H([0.35, 1.55, 2.6]), H([-0.4, 0.9, 7.0]), pushK(f, 601, 0.003), { fov: 42 });
const S11a = (f: number) => dolly(H([-0.35, 1.55, -4.6]), H([0.7, 1.0, -1.2]), pushK(f, 645, 0.003), { fov: 42, roll: -0.03 });
// 12 empty chocks on the main hatch (punch on "lifeboat"), then the deck wide with the puzzled boarding party
const S12a = (f: number) => dolly([2.9, 4.3, -2.8], [0, 2.95, 1.3], pushK(f, 677, 0.0022, 0.006, 32), { fov: 40 });
const S12b = (f: number) => dolly([0.9, 4.9, 5.2], [0, 3.4, -2.2], pushK(f, 739, 0.003), { fov: 44 });
// 13 the three at the mainmast: Luckily (thumbs up) / Unluckily (closer, roll), then both ships from above
const S13a = (f: number) => dolly([1.5, 4.0, 2.4], [0.7, 3.65, -2.6], pushK(f, 767, 0.0022), { fov: 40 });
const S13b = (f: number) => dolly([0.9, 3.95, 0.6], [0.6, 3.75, -2.6], pushK(f, 830, 0.002), { fov: 38, roll: 0.045 });
const S13c = (f: number) => dolly([18, 44, -28], [-7, 0, 3], pushK(f, 893, 0.002), { fov: 46 });
// 14 hold: the nine barrels, the knock, the drips
const S14a = (f: number) => dolly(H([0.1, 1.75, -9.6]), H([0, 1.2, 0]), pushK(f, 959, 0.004), { fov: 46 });
const S14b = (f: number) => dolly(H([0.45, 1.5, 6.0]), H([-0.8, 0.85, 2.9]), pushK(f, 996, 0.0025), { fov: 44 });
const S14c = (f: number) => dolly(H([0.35, 1.0, 1.0]), H([-0.7, 0.7, 2.2]), pushK(f, 1080, 0.003, 0.006, 26), { fov: 38, roll: 0.04 });
// 15 the fumes, low and wide
const S15a = (f: number) => dolly(H([0.25, 0.95, -6.5]), H([-0.1, 1.8, 1.5]), pushK(f, 1103, 0.003), { fov: 48 });
// 16 the captain at the fore hatch: 3/4 with the family, then CU on "captain", shock on "spark"
const S16a = (f: number) => dolly([2.4, 4.3, 0.2], [-0.4, 3.4, 4.5], pushK(f, 1156, 0.0025), { fov: 42 });
const S16b = (f: number) => dolly([0.75, 3.95, 1.5], [-0.2, 3.85, 4.1], pushK(f, 1198, 0.0025, 0.007, 30), { fov: 34 });
// 17 lifeboat in tow: the boat MS, along the rope, wide from behind
const S17a = (f: number) => dolly([4.2, 1.9, bz(f) - 2.5], [0.4, 1.0, bz(f) + 1.0], pushK(f, 1268, 0.0025), { fov: 42 });
const S17b = (f: number) => { const zr = (bz(f) + 2.6 + mz(f) - 15.2) / 2; return dolly([5.5, 1.3, zr - 3], [0.5, 1.9, zr + 3], pushK(f, 1325, 0.0025), { fov: 46, roll: -0.03 }); };
const S17c = (f: number) => dolly([-3.5, 7.5, bz(f) - 13], [0, 3.0, bz(f) + 14], pushK(f, 1369, 0.002), { fov: 44 });
// 18 the house: the man runs out of the door, the alarm, the door slams (punch + kick)
const S18a = (f: number) => dolly(Ho([4.2, 1.8, 15.5]), Ho([0.2, 2.6, 3.5]), pushK(f, 1403, 0.002), { fov: 42 });
const S18b = (f: number) => dolly(Ho([1.2, 1.55, 12.2]), Ho([0.1, 1.45, 7.0]), pushK(f, 1484, 0.0025, 0.007, 30), { fov: 40, roll: -0.04 });
// 19 the frayed rope over the stern (found by the boarding party), low by the water
const S19a = (f: number) => dolly([2.2, 0.9, -22.5], [0.3, 2.6, -15.5], pushK(f, 1526, 0.0025), { fov: 44 });
// 20 golden: the sails fill (low, looking up into them)
const S20a = (f: number) => { const z = mz(f); return dolly([-2.4, 3.3, z - 6.5], [0.5, 14, z + 4], pushK(f, 1593, 0.003), { fov: 52, roll: -0.05 }); };
// 21 golden: side-on to the taut rope at its middle; the snap
const S21a = (f: number) => { const zr = (bz(f) + 2.6 + mz(f) - 15.2) / 2; return dolly([7.5, 2.3, zr - 1.5], [0.5, 1.7, zr], pushK(f, 1636, 0.003), { fov: 40 }); };
// 22 golden: low behind the boat, the ship sails away toward the sun
const S22a = (f: number) => { const z = bz(1668); return dolly([2.6, 2.0, z - 7.5], [0.2, 3.5, z + 25], pushK(f, 1664, 0.0022), { fov: 42 }); };
// 23 golden: high wide, the boat alone (slow pull-out)
const S23a = (f: number) => { const z = bz(1710); return { pos: [8 + 0.02 * (f - 1706), 26 + 0.12 * (f - 1706), z - 26 - 0.12 * (f - 1706)] as V3, look: [0, 0, z + 18] as V3, fov: 44, roll: 0 }; };
// 24-27 the study
const S24a = (f: number) => dolly(St([-0.95, 1.6, 1.5]), St([0.1, 1.2, -2.2]), pushK(f, 1741, 0.0022), { fov: 44 });
const S25a = (f: number) => dolly(St([0.0, 1.45, 0.0]), St([0.25, 1.1, -2.0]), pushK(f, 1826, 0.003, 0.006, 26), { fov: 40 });
const S26a = (f: number) => dolly(St([-0.15, 1.55, -0.3]), St([0, 1.42, -2.55]), pushK(f, 1885, 0.0025), { fov: 38, roll: 0.04 });
const S26b = (f: number) => dolly(St([-0.5, 1.28, -1.15]), St([-0.85, 1.1, -1.95]), pushK(f, 1904, 0.004), { fov: 40 });
const S27a = (f: number) => dolly(St([0.1, 1.5, -0.35]), St([0, 1.45, -2.6]), pushK(f, 1958, 0.002, 0.0065, 34), { fov: 36 });

const CAMS: Record<number, Key[]> = {
  1: [{ f: 0, s: S1a }, { f: 104, cut: true, s: S1b }, { f: 145, cut: true, s: S1c }],
  2: [{ f: 176, s: S2a }],
  3: [{ f: 224, s: S3a }],
  4: [{ f: 286, s: S4a }, { f: 300, dur: 24, s: S4b }, { f: 320, dur: 26, s: S4c }, { f: 362, cut: true, s: S4d }],
  5: [{ f: 384, s: S5a }],
  6: [{ f: 446, s: S6a }],
  7: [{ f: 501, s: S7a }],
  8: [{ f: 533, s: S8a }],
  9: [{ f: 577, s: S9a }],
  10: [{ f: 601, s: S10a }],
  11: [{ f: 645, s: S11a }],
  12: [{ f: 677, s: S12a }, { f: 739, cut: true, s: S12b }],
  13: [{ f: 767, s: S13a }, { f: 830, cut: true, s: S13b }, { f: 893, cut: true, s: S13c }],
  14: [{ f: 959, s: S14a }, { f: 996, cut: true, s: S14b }, { f: 1080, cut: true, s: S14c }],
  15: [{ f: 1103, s: S15a }],
  16: [{ f: 1156, s: S16a }, { f: 1198, cut: true, s: S16b }],
  17: [{ f: 1268, s: S17a }, { f: 1325, cut: true, s: S17b }, { f: 1369, cut: true, s: S17c }],
  18: [{ f: 1403, s: S18a }, { f: 1484, cut: true, s: S18b }],
  19: [{ f: 1526, s: S19a }],
  20: [{ f: 1593, s: S20a }],
  21: [{ f: 1636, s: S21a }],
  22: [{ f: 1664, s: S22a }],
  23: [{ f: 1706, s: S23a }],
  24: [{ f: 1741, s: S24a }],
  25: [{ f: 1826, s: S25a }],
  26: [{ f: 1885, s: S26a }, { f: 1904, cut: true, s: S26b }],
  27: [{ f: 1958, s: S27a }],
};

// impact kicks: offset flips sign every frame, decays to 0 over 7 f
export const SPARK_T = 41.72;
const KICKS: [number, number][] = [[SPARK_T, 0.7], [SLAM_T, 1.4], [SNAP_T, 1.3], [24.0, 0.35]];
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
  { f: 0, cInf: 0 },                    // aerial hook
  { f: 145, cInf: 14, focus: () => [0, 3.55, -13.3] }, // the wheel CU (empty deck soft behind)
  { f: 180, cInf: 0 },                  // full ship
  { f: 228, cInf: 8 },                  // hold rows
  { f: 290, cInf: 12 },                 // captain MS (focus = look)
  { f: 362, cInf: 0 },                  // wide crew
  { f: 388, cInf: 12, focus: (f) => dgAt(5, f / FPS, [0.3, 4.0, 9.8]) }, // lookout
  { f: 450, cInf: 0 },                  // POV telephoto
  { f: 505, cInf: 14, focus: () => [0, 3.55, -13.3] },
  { f: 537, cInf: 8 },                  // boarding
  { f: 581, cInf: 0 },                  // sails
  { f: 605, cInf: 10 }, { f: 649, cInf: 10 },
  { f: 681, cInf: 12 },                 // the empty chocks
  { f: 739, cInf: 0 },
  { f: 771, cInf: 10 }, { f: 830, cInf: 12 },
  { f: 893, cInf: 0 },
  { f: 963, cInf: 6 }, { f: 996, cInf: 10 }, { f: 1080, cInf: 14 },
  { f: 1107, cInf: 6 },
  { f: 1160, cInf: 8 }, { f: 1198, cInf: 13 },
  { f: 1272, cInf: 10 }, { f: 1325, cInf: 0 },
  { f: 1407, cInf: 0 }, { f: 1484, cInf: 12 },
  { f: 1530, cInf: 10 },
  { f: 1597, cInf: 0 },
  { f: 1668, cInf: 6 },
  { f: 1710, cInf: 0 },
  { f: 1745, cInf: 7 }, { f: 1830, cInf: 13 }, { f: 1889, cInf: 13 }, { f: 1904, cInf: 14 }, { f: 1962, cInf: 14 },
];
export const dofAt = (f: number) => {
  let i = 0; while (i + 1 < DOF.length && f >= DOF[i + 1].f) i++;
  const d = DOF[i], p = DOF[Math.max(0, i - 1)];
  const k = d.dur ? Math.min(1, (f - d.f) / d.dur) : 1;
  return { cInf: p.cInf + (d.cInf - p.cInf) * k, focus: d.focus };
};
