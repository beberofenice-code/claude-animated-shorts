// Timeline of "The Ship That Refused to Sink" (SS Baychimo, 1931-1969): shots timed to the voice words
// (remotion/voice/words.json, 66.05 s), story state per shot (ship, pack ice, blizzard, crowds) and the camera grammar
// from the reference study: hard cuts on big reframes, smootherstep glides 18-40 f, every hold creeps in, flip-sign
// impact kicks decaying over 7 f, 4-5 deg rolls on emphasis beats, no hand-held float.
export const FPS = 30;
export const TOTAL = 1982;
export type V3 = [number, number, number];

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

// ---------------- the place (metres) ----------------
// Ship (pack-local): centre at the origin, bow toward +z, hull z -25..25, beam 9, main deck at y = DECK.
// Sea level y = 0, pack-ice top ICE_Y. Shore line along x at z = SHORE; the crew's hut on the shore at HUT.
// The airport (the analogy) is a closed hall far away at AIR.
export const DECK = 4.0, ICE_Y = 0.22, SHORE = -140, LAND_Y = 0.9;
export const HUT: V3 = [-6, LAND_Y, -158];
export const AIR: V3 = [4000, 0, 0];
export const HALF_L = 25, BEAM = 9;

// ---------------- shots ----------------
export type Light = "day" | "golden";
export type Zone = "arctic" | "airport";
export type ShotDef = { id: number; a: number; b: number; light: Light; zone: Zone };
export const SHOTS: ShotDef[] = [
  { id: 1, a: 0, b: 177, light: "golden", zone: "arctic" },      // hook: the crew walk away from the frozen ship
  { id: 2, a: 177, b: 308, light: "day", zone: "arctic" },       // open sea, steaming with furs
  { id: 3, a: 308, b: 409, light: "day", zone: "arctic" },       // the sea freezes around her: stuck
  { id: 4, a: 409, b: 545, light: "day", zone: "arctic" },       // crew flown home / fifteen build a hut
  { id: 5, a: 545, b: 643, light: "day", zone: "arctic" },       // blizzard, the ship is gone
  { id: 6, a: 643, b: 700, light: "day", zone: "arctic" },       // the captain decides she sank
  { id: 7, a: 700, b: 819, light: "day", zone: "arctic" },       // luckily: a seal hunter spots her
  { id: 8, a: 819, b: 876, light: "day", zone: "arctic" },       // unluckily: 45 miles away
  { id: 9, a: 876, b: 977, light: "day", zone: "arctic" },       // sled out, grab the furs, leave her
  { id: 10, a: 977, b: 1029, light: "golden", zone: "arctic" },  // nobody expects her to last the winter
  { id: 11, a: 1029, b: 1120, light: "day", zone: "arctic" },    // 1932: dog sled, she drifts past
  { id: 12, a: 1120, b: 1216, light: "golden", zone: "arctic" }, // 1933: hunters shelter inside in a storm
  { id: 13, a: 1216, b: 1348, light: "day", zone: "arctic" },    // 1939: a captain climbs aboard, the ice shoves him off
  { id: 14, a: 1348, b: 1486, light: "day", zone: "arctic" },    // the ice creeps round and round
  { id: 15, a: 1486, b: 1603, light: "day", zone: "airport" },   // the suitcase on the carousel
  { id: 16, a: 1603, b: 1714, light: "day", zone: "arctic" },    // frozen onto that carousel, hull sealed tight
  { id: 17, a: 1714, b: 1760, light: "day", zone: "arctic" },    // spotted again and again (montage)
  { id: 18, a: 1760, b: 1839, light: "golden", zone: "arctic" }, // 1969, still locked in the ice
  { id: 19, a: 1839, b: TOTAL, light: "golden", zone: "arctic" },// nobody found the wreck: she still hasn't sunk
];
/** crossfades (frames) at place/time changes; a white 4-frame flash after the hook */
export const XFADE: Record<number, number> = { 4: 6, 10: 10, 11: 8, 12: 8, 13: 8, 14: 8, 15: 10, 16: 10, 18: 8, 19: 8 };
export const FLASH_AT = 177;

export const shotAt = (f: number) => SHOTS.find((s) => f >= s.a && f < s.b) ?? SHOTS[SHOTS.length - 1];
export const layersAt = (f: number): { id: number; alpha: number }[] => {
  for (const s of SHOTS) {
    const x = XFADE[s.id];
    if (x && f >= s.a - x / 2 && f < s.a + x / 2) return [{ id: s.id - 1, alpha: 1 }, { id: s.id, alpha: (f - (s.a - x / 2) + 1) / (x + 1) }];
  }
  return [{ id: shotAt(f).id, alpha: 1 }];
};

// ---------------- story state ----------------
// Word onsets (frames) used below: "stuck" 398, "blizzard" 554, "clears" 605, "gone" 634, "seal hunter" 754,
// "spots" 771, "shoves" 1321, "round and round" 1442, "sealed tight" 1698, "sunk" 1951.
export const F_STUCK = 397, F_SHOVE = 1320, F_SUNK = 1950;
/** pack ice frame: world = rotY(rot) * local + (x, 0, z); everything frozen in the pack (ship, floes, ridges) rides on it */
export type Pack = { x: number; z: number; rot: number };
/** ship pose inside the pack */
export type Ship = { visible: boolean; y: number; roll: number; pitch: number; yaw: number; smoke: number; lit: number; x: number; z: number };
export type Env = {
  /** ice covers the sea outside this distance from the hull (0 = frozen solid, big = open water) */
  iceR: number;
  /** blizzard 0..1 (snow particles + white fog) */
  snow: number;
  /** fog far override (m) for long looks (the ship on the horizon) */
  fogFar?: number;
  /** hut built 0..1 */
  hut: number;
  /** aircraft flying 0..1 along its path (-1 = parked out of sight) */
  plane: number;
  /** pressure ridge heave 0..1 (shot 13) */
  heave: number;
};

const T = (f: number) => f / FPS;
const bobOf = (f: number, k = 1) => k * 0.06 * Math.sin(T(f) * 1.7);

export const packAt = (id: number, f: number): Pack => {
  switch (id) {
    case 7: return { x: 520, z: 1350, rot: -0.3 };                 // far out on the horizon from the hunter
    case 8: return { x: -260, z: 1300, rot: -0.3 };                // far beyond the crew at the hut
    case 11: return { x: -60 + 0.55 * (f - 1029), z: 150, rot: 0.15 };    // drifting past the dog sled
    case 14: { const u = (f - 1348) / (1486 - 1348); return rotAbout(-0.05 - 0.55 * u); } // round and round (about the gyre centre)
    case 16: { const u = (f - 1603) / (1714 - 1603); return rotAbout(-0.6 - 0.45 * u); }
    case 17: return { x: 30 + 0.25 * (f - 1714), z: 120, rot: 0.6 };
    default: return { x: 0, z: 0, rot: 0 };
  }
};

/** the pack turning about GYRE (world point): ship (local origin) travels on a circle around it */
export const GYRE: V3 = [-60, 0, 230];
const rotAbout = (rot: number): Pack => {
  const c = Math.cos(rot), s = Math.sin(rot), gx = GYRE[0], gz = GYRE[2];
  return { x: gx - (c * gx + s * gz), z: gz - (-s * gx + c * gz), rot };
};

export const shipAt = (id: number, f: number): Ship => {
  const s: Ship = { visible: true, y: 0, roll: 0, pitch: 0, yaw: 0, smoke: 0, lit: 0, x: 0, z: 0 };
  if (id === 2) { s.y = bobOf(f) + 0.05 * Math.sin(T(f) * 0.9); s.roll = 0.03 * Math.sin(T(f) * 1.1); s.pitch = 0.012 * Math.sin(T(f) * 0.8); s.smoke = 1; s.z = 3.2 * (T(f) - 7.5); }
  if (id === 3) {
    // steaming slower as the ice closes, then jammed (kick on "stuck")
    const k = 1 - smooth((f - 330) / (F_STUCK - 330));
    s.y = bobOf(f, k); s.roll = 0.025 * k * Math.sin(T(f) * 1.1); s.smoke = f < F_STUCK ? 1 : Math.max(0, 1 - (f - F_STUCK) / 40);
    s.z = 3.2 * (T(f) - 13.3) * k - 0.2 * (f >= F_STUCK ? Math.exp(-(f - F_STUCK) / 4) : 0);
    if (f >= F_STUCK) s.pitch = 0.02 * Math.exp(-(f - F_STUCK) / 6) * Math.cos((f - F_STUCK) * 0.9);
  }
  if (id === 4 || id === 9) s.smoke = 0;
  if (id === 5 && f >= 590) s.visible = false; // gone after the whiteout
  if (id === 6) s.visible = false;
  if (id === 12) s.lit = smooth((f - 1166) / 10);
  if (id === 13 && f >= F_SHOVE) { // the ice heaves: she lurches and settles
    const k = f - F_SHOVE;
    s.roll = -0.11 * Math.exp(-k / 18) * Math.cos(k * 0.22) * smooth(k / 4);
    s.y = 0.35 * Math.exp(-k / 14) * Math.sin(Math.min(Math.PI, k * 0.18));
  }
  if (id === 19 && f >= F_SUNK - 26) { // "still hasn't sunk": she dips, then bobs back up, stubborn
    const k = f - (F_SUNK - 26);
    s.y = -0.6 * Math.sin(Math.min(Math.PI, k * 0.12)) * Math.exp(-k / 40) + (k > 26 ? 0.18 * Math.exp(-(k - 26) / 10) * Math.sin((k - 26) * 0.5) : 0);
    s.roll = 0.05 * Math.sin(Math.min(Math.PI, k * 0.12)) * Math.exp(-k / 40);
  }
  return s;
};

export const envAt = (id: number, f: number): Env => {
  const e: Env = { iceR: 0, snow: 0, hut: 1, plane: -1, heave: 0 };
  if (id === 2) e.iceR = 1e6;
  if (id === 3) e.iceR = lin([[308, 260], [335, 140], [370, 38], [F_STUCK, 0]], f);
  if (id === 1 || id === 2 || id === 3) e.hut = 0;
  if (id === 4) { e.plane = clamp01((f - 409) / 52); e.hut = f < 454 ? 0 : lin([[454, 0.05], [530, 1]], f); }
  if (id === 5) e.snow = lin([[548, 0], [562, 1], [588, 1], [612, 0.1], [634, 0]], f);
  if (id === 6) e.snow = 0.12;
  if (id === 7 || id === 8) e.fogFar = 2600;
  if (id === 12) e.snow = 0.32;
  if (id === 13) e.heave = smooth((f - (F_SHOVE - 2)) / 7);
  if (id === 14 || id === 16) e.fogFar = 2400;
  if (id === 17) e.plane = f < 1745 ? -1 : clamp01((f - 1745) / 22);
  return e;
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
const rolled = (s: (f: number) => Shot, roll: number) => (f: number): Shot => ({ ...s(f), roll });

/** pack-local point -> world (for cameras that ride with the ship) */
export const packPt = (p: Pack, l: V3): V3 => {
  const c = Math.cos(p.rot), s = Math.sin(p.rot);
  return [p.x + c * l[0] + s * l[2], l[1], p.z - s * l[0] + c * l[2]];
};
const shipPt = (id: number, f: number, l: V3): V3 => { const sh = shipAt(id, f); return packPt(packAt(id, f), [l[0] + sh.x, l[1] + sh.y, l[2] + sh.z]); };

// shot 1 (hook, golden): low over the ice, the crew walk toward us away from the frozen ship -> low hero angle on the bow
const S1a = (f: number) => dolly([4.5, 1.3, 56], [0.5, 2.4, 34], pushK(f, 0, 0.0022), { fov: 42 });
const S1b = (f: number) => dolly([16, 0.9, 44], [2, 7.5, 18], pushK(f, 98, 0.0018, 0.006, 32), { fov: 40, roll: 0.04 });
// shot 2 (day, open sea): high 3/4 establishing alongside -> hatch insert of the furs -> high pull-back over the ice-dotted sea
const S2a = (f: number) => { const c = shipPt(2, f, [0, 0, 0]); return zoom([c[0] + 46, 26, c[2] + 52], [c[0], 4, c[2] + 4], 40, pushK(f, 177, 0.002)); };
const S2b = (f: number) => { const c = shipPt(2, f, [0, 0, 0]); return dolly([c[0] + 4.4, c[1] + 7.6, c[2] + 4.2], [c[0] + 0.1, c[1] + 4.5, c[2] + 8.2], pushK(f, 234, 0.0025), { fov: 40, roll: -0.03 }); };
const S2c = (f: number) => { const c = shipPt(2, f, [0, 0, 0]); return dolly([c[0] - 60, 70, c[2] + 95], [c[0], 2, c[2] + 15], pushK(f, 280, 0.002), { fov: 42 }); };
// shot 3: water-level 3/4 bow as the ice closes in -> sailor at the rail ("stuck")
const S3a = (f: number) => { const c = shipPt(3, f, [0, 0, 0]); return dolly([c[0] + 24, 3.2, c[2] + 46], [c[0], 4, c[2] + 6], pushK(f, 308, 0.0025), { fov: 42 }); };
const S3b = (f: number) => { const c = shipPt(3, f, [0, 0, 0]); return dolly([c[0] + 12.5, c[1] + 5.4, c[2] + 10.5], [c[0] + 4.6, c[1] + 3.2, c[2] + 5], pushK(f, 380, 0.002, 0.007, 28), { fov: 40, roll: 0.035 }); };
// shot 4: crew on the ice waving at the plane -> the hut going up on the shore
const S4a = (f: number) => dolly([-14, 1.7, -30], [4, 6, 2], pushK(f, 409, 0.002), { fov: 44 });
const S4b = (f: number) => dolly([HUT[0] + 9, LAND_Y + 2.1, HUT[2] + 13], [HUT[0], LAND_Y + 1.9, HUT[2]], pushK(f, 454, 0.0022), { fov: 40 });
// shot 5: behind the crew at the hut looking out to sea (whiteout, then the empty ice)
const S5a = (f: number) => dolly([HUT[0] + 4, LAND_Y + 2.3, HUT[2] + 6.5], [HUT[0] + 8, 3, HUT[2] + 90], pushK(f, 545, 0.0015), { fov: 40 });
const S5b = (f: number) => dolly([HUT[0] + 6.5, LAND_Y + 1.7, HUT[2] + 10], [HUT[0] + 3.5, LAND_Y + 1.5, HUT[2] + 4], pushK(f, 620, 0.002, 0.007, 22), { fov: 38, roll: -0.04 });
// shot 6: the captain MS, crew behind
const S6a = (f: number) => dolly([HUT[0] + 5.2, LAND_Y + 1.75, HUT[2] + 9.8], [HUT[0] + 3.4, LAND_Y + 1.6, HUT[2] + 5.2], pushK(f, 643, 0.003, 0.006, 30), { fov: 36 });
// shot 7: the hunter at the seal hole -> long lens out to the horizon: a speck of a ship
const HOLE: V3 = [140, ICE_Y, -40];
const S7a = (f: number) => dolly([HOLE[0] - 4.5, 1.7, HOLE[2] - 5.5], [HOLE[0] + 0.2, 1.15, HOLE[2] + 0.2], pushK(f, 700, 0.0022), { fov: 40 });
const S7b = (f: number) => { const p = packAt(7, f); return zoom([HOLE[0] - 2.6, 1.95, HOLE[2] - 3.6], [p.x, 4, p.z], 9, pushK(f, 784, 0.002, 0.006, 26), { roll: 0.02 }); };
// shot 8: the crew at the hut, deadpan (the ship is a speck behind them)
const S8a = (f: number) => dolly([HUT[0] + 3, LAND_Y + 1.7, HUT[2] + 13.5], [HUT[0] + 2.5, LAND_Y + 1.55, HUT[2] + 4], pushK(f, 819, 0.0025, 0.007, 30), { fov: 34, roll: 0.035 });
// shot 9: the sledge party crossing the ice -> unloading furs at the ship's side -> walking off
const S9a = (f: number) => dolly([16, 2.2, -44], [5, 1.6, -26], pushK(f, 876, 0.0025), { fov: 42 });
const S9b = (f: number) => dolly([20, 2.6, 2], [6.5, 3.4, -4], pushK(f, 905, 0.002, 0.005, 26), { fov: 40, roll: -0.03 });
const S9c = (f: number) => dolly([7, 2, -50], [2, 4, -10], pushK(f, 953, 0.002), { fov: 42 });
// shot 10 (golden): wide, the ship alone, the crew tiny on the ice going home
const S10a = (f: number) => zoom([-38, 9, -78], [0, 6, 0], 40, pushK(f, 977, 0.0016));
// shot 11: dog sled on the shore ice, side-on; she drifts past behind
const SLED: V3 = [30, ICE_Y, -110];
const S11a = (f: number) => dolly([SLED[0] + 2.2, 1.8, SLED[2] - 15], [SLED[0] + 2.2, 2.6, SLED[2] + 20], pushK(f, 1029, 0.002), { fov: 42 });
const S11b = (f: number) => dolly([SLED[0] + 0.4, 1.6, SLED[2] - 5.2], [SLED[0] - 1.6, 1.5, SLED[2] + 0.4], pushK(f, 1090, 0.0025, 0.006, 24), { fov: 38, roll: 0.035 });
// shot 12 (golden storm): hunters climbing the ladder -> the lit portholes
const S12a = (f: number) => dolly([16, 2.0, -10], [4.6, 3.6, -2], pushK(f, 1120, 0.0022), { fov: 42 });
const S12b = (f: number) => dolly([22, 5, 14], [4.6, 3.2, 2], pushK(f, 1166, 0.0025), { fov: 38, roll: -0.03 });
// shot 13: the 1939 captain aboard at the rail (flag) -> the ice heaves, he flies off
const S13a = (f: number) => dolly([18, 3.6, -2], [4.6, 5.6, -6], pushK(f, 1216, 0.002), { fov: 40 });
const S13b = (f: number) => dolly([16, 4.4, 4], [4.4, 5.5, -4.5], pushK(f, 1290, 0.0025, 0.006, 30), { fov: 38, roll: 0.035 });
const S13c = (f: number) => dolly([20, 2.2, -16.5], [10.5, 2.6, -8.5], pushK(f, 1331, 0.0025), { fov: 44 });
// shot 14: high aerial of the pack and the coast; the pack turns
const S14a = (f: number) => dolly([55, 330, -95], [60, 0, 45], pushK(f, 1348, 0.0012), { fov: 44 });
const S14b = (f: number) => dolly([60, 380, -120], [65, 0, 50], pushK(f, 1440, 0.0012), { fov: 46, roll: -0.03 });
// shot 15 (airport): the lonely suitcase on the carousel (tracked from outside the belt), then a wider look as it comes back round
export const CAR = { STR: 3, RAD: 1.9 }, CAR_SPEED = 2.0;
/** stadium centre line: [x, z, nx, nz, arcLength] samples (normal points outward), relative to AIR */
export function carPath() {
  const str = CAR.STR, rad = CAR.RAD, out: [number, number, number, number, number][] = [];
  let s = 0, prev: [number, number] | null = null;
  const push = (x: number, z: number, nx: number, nz: number) => { if (prev) s += Math.hypot(x - prev[0], z - prev[1]); out.push([x, z, nx, nz, s]); prev = [x, z]; };
  for (let i = 0; i <= 10; i++) push(-str + (2 * str * i) / 10, -rad, 0, -1);
  for (let i = 1; i <= 24; i++) { const a = -Math.PI / 2 + (Math.PI * i) / 24; push(str + rad * Math.cos(a), rad * Math.sin(a), Math.cos(a), Math.sin(a)); }
  for (let i = 1; i <= 10; i++) push(str - (2 * str * i) / 10, rad, 0, 1);
  for (let i = 1; i <= 24; i++) { const a = Math.PI / 2 + (Math.PI * i) / 24; push(-str + rad * Math.cos(a), rad * Math.sin(a), Math.cos(a), Math.sin(a)); }
  return out;
}
/** position [x, z] and tangent [tx, tz] at arc length s (wraps) */
export function carAt(path: [number, number, number, number, number][], s: number): [number, number, number, number] {
  const L = path[path.length - 1][4], u = ((s % L) + L) % L;
  let i = 1; while (i < path.length - 1 && path[i][4] < u) i++;
  const a = path[i - 1], b = path[i], k = (u - a[4]) / Math.max(1e-6, b[4] - a[4]);
  const tx = b[0] - a[0], tz = b[1] - a[1], tl = Math.hypot(tx, tz) || 1;
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, tx / tl, tz / tl];
}
const CPATH = carPath();
/** the suitcase: along the near straight at the start of the shot, round the far end, back again */
export const suitcaseAt = (f: number) => carAt(CPATH, (f - 1486) / FPS * CAR_SPEED + 0.4);
const S15a = (f: number) => { const p = suitcaseAt(Math.max(f, 1486)); return dolly([AIR[0] + p[0] - 0.6, 1.35, AIR[2] - 5.4], [AIR[0] + p[0] + 0.3, 0.6, AIR[2] - 1.9], pushK(f, 1486, 0.0025), { fov: 38 }); };
const S15b = (f: number) => { const p = suitcaseAt(1580); return dolly([AIR[0] - 1.0, 3.0, AIR[2] - 9.5], [AIR[0] + p[0] - 0.5, 0.6, AIR[2] + p[1] + 0.5], pushK(f, 1558, 0.0022), { fov: 42 }); };
// shot 16: the pack from high again (match), then the hull at the ice line, sealed tight
const S16a = (f: number) => dolly([140, 360, -40], [145, 0, 115], pushK(f, 1603, 0.0012), { fov: 44 });
const S16b = (f: number) => { const p = packAt(16, f); const c = packPt(p, [10.5, 1.7, -10.5]), l = packPt(p, [4.6, 1.8, -4.5]); return dolly(c, l, pushK(f, 1668, 0.003, 0.007, 30), { fov: 38, roll: -0.035 }); };
// shot 17: montage of spotters, each with her drifting behind
const S17a = (f: number) => dolly([66, 1.8, 33], [40, 4, 120], pushK(f, 1714, 0.003), { fov: 40 });
const S17b = (f: number) => dolly([130, 1.6, 100], [40, 5, 120], pushK(f, 1734, 0.003), { fov: 40, roll: 0.03 });
const S17c = (f: number) => dolly([62, 3, 62], [32, 12, 122], pushK(f, 1746, 0.003), { fov: 44 });
// shot 18 (golden): the 1969 party in orange, the ship locked in the ice
const S18a = (f: number) => dolly([-14, 2.0, -40], [-1, 4.2, -6], pushK(f, 1760, 0.0025, 0.006, 30), { fov: 40 });
const S18b = (f: number) => dolly([-6, 1.4, -32], [0, 6, 0], pushK(f, 1808, 0.0022), { fov: 40, roll: -0.03 });
// shot 19 (golden): the empty sea of ice, then she dips and pops back up; crane out
const S19a = (f: number) => dolly([30, 3.0, 44], [0, 5, 4], pushK(f, 1839, 0.002), { fov: 40 });
const S19b = (f: number) => dolly([20, 2.2, 30], [0, 5.5, 2], pushK(f, 1924, 0.0015), { fov: 40 });
const CRANE: V3[] = [[46, 30, 66], [60, 48, 96]];
const S19c = (f: number): Shot => {
  const a = S19b(1956), s = glide((f - 1956) / 26), r = 1 - s, [C, B] = CRANE;
  return { pos: [0, 1, 2].map((i) => r * r * a.pos[i] + 2 * s * r * C[i] + s * s * B[i]) as V3,
    look: [0, 1, 2].map((i) => a.look[i] + ([0, 3, 0][i] - a.look[i]) * s) as V3, fov: 40 + 4 * s, roll: 0 };
};

const CAMS: Record<number, Key[]> = {
  1: [{ f: 0, s: S1a }, { f: 98, cut: true, s: S1b }, { f: 140, dur: 20, s: rolled(S1b, -0.04) }],
  2: [{ f: 170, s: S2a }, { f: 234, cut: true, s: S2b }, { f: 280, cut: true, s: S2c }],
  3: [{ f: 308, s: S3a }, { f: 380, cut: true, s: S3b }],
  4: [{ f: 400, s: S4a }, { f: 454, cut: true, s: S4b }],
  5: [{ f: 545, s: S5a }, { f: 620, cut: true, s: S5b }],
  6: [{ f: 643, s: S6a }],
  7: [{ f: 700, s: S7a }, { f: 784, cut: true, s: S7b }],
  8: [{ f: 819, s: S8a }],
  9: [{ f: 876, s: S9a }, { f: 905, cut: true, s: S9b }, { f: 953, cut: true, s: S9c }],
  10: [{ f: 970, s: S10a }],
  11: [{ f: 1022, s: S11a }, { f: 1090, cut: true, s: S11b }],
  12: [{ f: 1114, s: S12a }, { f: 1166, cut: true, s: S12b }],
  13: [{ f: 1210, s: S13a }, { f: 1290, cut: true, s: S13b }, { f: 1323, cut: true, s: S13c }],
  14: [{ f: 1342, s: S14a }, { f: 1430, dur: 30, s: S14b }],
  15: [{ f: 1480, s: S15a }, { f: 1558, cut: true, s: S15b }],
  16: [{ f: 1597, s: S16a }, { f: 1668, cut: true, s: S16b }],
  17: [{ f: 1714, s: S17a }, { f: 1734, cut: true, s: S17b }, { f: 1746, cut: true, s: S17c }],
  18: [{ f: 1754, s: S18a }, { f: 1808, cut: true, s: S18b }],
  19: [{ f: 1833, s: S19a }, { f: 1924, cut: true, s: S19b }, { f: 1956, cut: true, s: S19c }],
};

// impact kicks: the image offset flips sign every frame, decays to 0 in 7 f
const KICKS: [number, number][] = [[F_STUCK / FPS, 1.2], [1321 / FPS, 1.5], [1342 / FPS, 0.8], [1699 / FPS, 0.5], [F_SUNK / FPS, 0.7], [500 / FPS, 0.35], [516 / FPS, 0.35]];
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
  { f: 0, cInf: 12, focus: () => [1, 1.6, 41] }, // hook: crew sharp, ship soft
  { f: 98, cInf: 0 },            // hero bow
  { f: 177, cInf: 0 },           // open-sea establishing
  { f: 234, cInf: 13 },          // fur hatch insert
  { f: 280, cInf: 0 },           // aerial, freeze wide
  { f: 380, cInf: 12 },          // sailor at the rail
  { f: 409, cInf: 0 },           // plane wide
  { f: 454, cInf: 8 },           // hut building
  { f: 545, cInf: 0 },           // whiteout look out to sea
  { f: 620, cInf: 12 },          // shocked crew
  { f: 643, cInf: 13 },          // captain MS
  { f: 700, cInf: 10 },          // hunter at the seal hole
  { f: 784, cInf: 0 },           // long lens to the horizon
  { f: 819, cInf: 12 },          // deadpan crew
  { f: 876, cInf: 0 },           // sledge, unloading, leaving, golden wide, dog sled wide
  { f: 1090, cInf: 11 },         // sledder MS
  { f: 1120, cInf: 5 },          // storm ladder
  { f: 1216, cInf: 0 },          // 1939, aerials, airport
  { f: 1486, cInf: 10 },         // suitcase MS
  { f: 1558, cInf: 0 },
  { f: 1668, cInf: 14 },         // hull CU
  { f: 1714, cInf: 0 },
  { f: 1760, cInf: 9, focus: () => [-6.5, ICE_Y + 1.5, -26.6] }, // 1969 party: their eyes
  { f: 1808, cInf: 0 },
];
export const dofAt = (f: number) => {
  let i = 0; while (i + 1 < DOF.length && f >= DOF[i + 1].f) i++;
  const d = DOF[i], p = DOF[Math.max(0, i - 1)];
  const k = d.dur ? Math.min(1, (f - d.f) / d.dur) : 1;
  return { cInf: p.cInf + (d.cInf - p.cInf) * k, focus: d.focus };
};
