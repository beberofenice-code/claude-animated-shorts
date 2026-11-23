// Timeline of "The Dancing Plague" (Strasbourg, 1518): shots timed to the voice words (~/dancing-short/voice/words.json,
// 69.14 s, 2075 frames at 30 fps). Camera grammar from the reference study (same as the bridge short): slow push-ins on
// every hold, smootherstep glides of 18-40 f, hard cuts on big reframes, flip kicks that decay over 7 f on impacts.
export const FPS = 30;
export const TOTAL = 2075;
export const D0 = 0; // ground height (the town is flat; hills are domes)
export type V3 = [number, number, number];

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const smooth = (x: number) => { const u = clamp01(x); return u * u * (3 - 2 * u); };
export const easeOut = (u: number) => 1 - (1 - clamp01(u)) ** 4;

// ---------------- places (world metres) ----------------
/** cobbled square x -24..24, z -18..18; the lane leaves it to the west (z -3.5..3.5), a street to the cathedral north */
export const SQ = { x0: -24, x1: 24, z0: -18, z1: 18 };
export const DOOR: V3 = [-45, 0, 3.5]; // Frau Troffea's front door (lane, north side, facing -z)
export const STAGE: V3 = [10, 0, 9]; // centre of the wooden stage (8 x 5 m, top at STAGE_H)
export const STAGE_H = 1.1;
export const HALL: V3 = [31, 0, -6]; // guildhall centre (front at x = 24, facing -x)
export const STALL: V3 = [-14, 0, -13]; // bread stall (counter along x, baker on the -z side)
export const WELL: V3 = [6, 0, -1];
export const STATUE: V3 = [-13, 0, 11]; // St Vitus on a pedestal (top at STATUE_H)
export const STATUE_H = 2.3;
export const BENCH: V3 = [8, 0, -16.3]; // bench against the south houses (sitters face +z)
export const SIGN_AT: V3 = [17, 0, -11]; // the music-ban sign post
export const ROAD_Z = -60; // hill road (outside town, east), running +x
export const SHRINE: V3 = [262, 0, -60]; // the chapel of St Vitus (front at x = 258, facing -x)
export const CATHEDRAL: V3 = [0, 0, 86];

// ---------------- shots ----------------
export type Light = "day" | "golden";
export type Scene = "square" | "aerial" | "bread" | "tired" | "door" | "lane" | "husband" | "days" | "lane30" | "hop" | "doctors" | "hall" | "stage"
  | "band" | "strong" | "collapse" | "yawnrow" | "yawncu" | "fear" | "vitus" | "spread" | "ban" | "wagon" | "shrine" | "shoes";
export type ShotDef = { id: number; a: number; b: number; light: Light; scene: Scene; sunAz?: number; sunEl?: number };
export const SHOTS: ShotDef[] = [
  { id: 1, a: 0, b: 158, light: "day", scene: "square" },
  { id: 2, a: 158, b: 258, light: "day", scene: "aerial", sunAz: 120 },
  { id: 3, a: 258, b: 321, light: "day", scene: "bread" },
  { id: 4, a: 321, b: 350, light: "day", scene: "tired" },
  { id: 5, a: 350, b: 476, light: "day", scene: "door" },
  { id: 6, a: 476, b: 531, light: "day", scene: "lane" },
  { id: 7, a: 531, b: 586, light: "day", scene: "husband" },
  { id: 8, a: 586, b: 604, light: "day", scene: "days" },
  { id: 9, a: 604, b: 622, light: "golden", scene: "days", sunAz: 115, sunEl: 12 },
  { id: 10, a: 622, b: 642, light: "day", scene: "days" },
  { id: 11, a: 642, b: 728, light: "day", scene: "lane30" },
  { id: 12, a: 728, b: 776, light: "day", scene: "square" },
  { id: 13, a: 776, b: 843, light: "day", scene: "hop" },
  { id: 14, a: 843, b: 1000, light: "day", scene: "doctors" },
  { id: 15, a: 1000, b: 1065, light: "day", scene: "doctors" },
  { id: 16, a: 1065, b: 1118, light: "day", scene: "hall" },
  { id: 17, a: 1118, b: 1157, light: "day", scene: "stage" },
  { id: 18, a: 1157, b: 1210, light: "day", scene: "band" },
  { id: 19, a: 1210, b: 1290, light: "day", scene: "strong" },
  { id: 20, a: 1290, b: 1343, light: "day", scene: "collapse" },
  { id: 21, a: 1343, b: 1425, light: "golden", scene: "yawnrow", sunAz: 150, sunEl: 9 },
  { id: 22, a: 1425, b: 1513, light: "golden", scene: "yawncu", sunAz: 150, sunEl: 9 },
  { id: 23, a: 1513, b: 1585, light: "day", scene: "fear" },
  { id: 24, a: 1585, b: 1658, light: "day", scene: "vitus" },
  { id: 25, a: 1658, b: 1724, light: "day", scene: "spread" },
  { id: 26, a: 1724, b: 1815, light: "day", scene: "ban" },
  { id: 27, a: 1815, b: 1884, light: "golden", scene: "wagon", sunAz: 140, sunEl: 10 },
  { id: 28, a: 1884, b: 1934, light: "golden", scene: "shrine", sunAz: 145, sunEl: 10 },
  { id: 29, a: 1934, b: TOTAL, light: "golden", scene: "shoes", sunAz: 150, sunEl: 11 },
];
/** crossfades (frames) at place/time changes; a white 4-frame flash after the hook */
export const XFADE: Record<number, number> = { 9: 6, 10: 6, 21: 8, 23: 8, 27: 8, 28: 8 };
export const FLASH_AT = 158;

export const shotAt = (f: number) => SHOTS.find((s) => f >= s.a && f < s.b) ?? SHOTS[SHOTS.length - 1];
export const sceneOf = (id: number) => SHOTS[id - 1].scene;
/** layers to draw at frame f: base shot, plus the next shot fading in during a crossfade */
export const layersAt = (f: number): { id: number; alpha: number }[] => {
  for (const s of SHOTS) {
    const x = XFADE[s.id];
    if (x && f >= s.a - x / 2 && f < s.a + x / 2) return [{ id: s.id - 1, alpha: 1 }, { id: s.id, alpha: (f - (s.a - x / 2) + 1) / (x + 1) }];
  }
  return [{ id: shotAt(f).id, alpha: 1 }];
};

// ---------------- story clocks ----------------
/** Troffea steps out of her door at STEP_OUT and starts dancing at DANCE0 ("starts dancing") */
export const STEP_OUT = 13.9, DANCE0 = 14.83;
/** wagon along the hill road */
export const wagonX = (t: number) => 150 + 3.0 * (t - 60.5);
/** the music-ban hammer blows ("Music" / "banned" / after) */
export const HITS = [59.4, 59.9, 60.45];
/** dancers collapse, one after another, around "collapsing" */
export const COLLAPSE = [43.88, 44.25, 44.6];

// ---------------- camera ----------------
export type Cam = { pos: V3; look: V3; fov: number; roll: number };
type Shot = Partial<Cam> & { pos: V3; look: V3 };
type Key = { f: number; dur?: number; cut?: boolean; s: (f: number) => Shot };
/** reference camera ease: symmetric smootherstep */
export const glide = (u: number) => { const x = clamp01(u); return x * x * x * (x * (6 * x - 15) + 10); };
const mixCam = (a: Cam, b: Cam, k: number): Cam => ({
  pos: a.pos.map((v, i) => v + (b.pos[i] - v) * k) as V3, look: a.look.map((v, i) => v + (b.look[i] - v) * k) as V3,
  fov: a.fov + (b.fov - a.fov) * k, roll: a.roll + (b.roll - a.roll) * k,
});
const full = (c: Shot): Cam => ({ fov: 40, roll: 0, ...c });
const run = (keys: Key[], f: number) => {
  let cur = full(keys[0].s(f));
  for (let i = 1; i < keys.length; i++) {
    const k = keys[i];
    if (f < k.f) break;
    cur = k.cut ? full(k.s(f)) : mixCam(cur, full(k.s(f)), glide((f - k.f) / (k.dur ?? 24)));
  }
  return cur;
};
const T = (f: number) => f / FPS;
/** push-in factor since f0: the subject grows ~rate per frame; `punch` raises it (8 f soft edges) for the first n frames */
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
/** a dolly framing that starts creeping at f0 */
const D = (f0: number, pos: V3, look: V3, fov = 40, roll = 0, rate = 0.0022, punch = 0, n = 35) =>
  (f: number) => dolly(pos, look, pushK(f, f0, rate, punch, n), { fov, roll });
const Z = (f0: number, pos: V3, look: V3, fov = 40, roll = 0, rate = 0.002) => (f: number) => zoom(pos, look, fov, pushK(f, f0, rate), { roll });

// subjects
export const TROFF_LANE: V3 = [-45, 0, 1.6]; // where she dances in the lane
export const TROFF_SQ: V3 = [-3, 0, -2]; // Troffea in the square crowd (spread shot)
const eye = (p: V3, h = 1.65): V3 => [p[0], p[1] + h, p[2]];

const CAMS: Record<number, Key[]> = {
  // hook: high over the dancing square, glide down to the crowd, closer on one worn-out dancer at "nobody ... stop"
  1: [
    { f: 0, s: D(0, [16, 15, -32], [0, 1.0, 0], 44, 0, 0.0018) },
    { f: 52, dur: 36, s: D(52, [5, 2.6, -14.5], [1, 1.5, -6.5], 40, -0.03, 0.002) },
    { f: 112, cut: true, s: D(112, [0.9, 1.75, -9.6], [0.2, 1.7, -6.3], 34, 0.04, 0.0025, 0.006, 30) },
  ],
  // town aerial: the cathedral spire over the roofs, then out over the dry fields ("harvests have failed")
  2: [
    { f: 154, s: Z(154, [-70, 46, -120], [0, 14, 30], 42, 0, 0.0018) },
    { f: 206, cut: true, s: D(206, [-175, 12, -215], [-70, 9, -60], 44, 0.03, 0.0022) },
  ],
  // bread stall: side two-shot of baker and customer, punch on "fortune"
  3: [
    { f: 258, s: D(258, [-12.0, 1.75, -6.0], [-13.8, 1.3, -13.1], 38, 0, 0.0022) },
    { f: 276, dur: 18, s: D(276, [-12.3, 1.7, -7.4], [-13.6, 1.4, -12.8], 36, -0.035, 0.0022, 0.006, 30) },
  ],
  // three exhausted townsfolk ("everyone is exhausted")
  4: [{ f: 321, s: D(321, [-6.4, 1.55, -9.6], [-6.55, 1.3, -15.5], 34, 0.03, 0.003) }],
  // the lane: she steps out of her door, then starts dancing (push in on "dancing")
  5: [
    { f: 350, s: D(350, [-43.6, 1.6, -4.4], [-45, 1.45, 2.2], 40, 0, 0.002) },
    { f: 436, dur: 24, s: D(436, [-44.2, 1.5, -3.0], [-45, 1.35, 1.6], 38, -0.035, 0.0022, 0.005, 30) },
  ],
  // "No music": wide empty lane, she alone; "no reason": her deadpan face close
  6: [
    { f: 476, s: Z(476, [-30, 2.2, -1.2], [-45, 1.2, 1.6], 38, 0.02, 0.0018) },
    { f: 503, cut: true, s: D(503, [-44.55, 1.9, -1.15], [-45, 1.75, 1.6], 32, -0.035, 0.0025) },
  ],
  // the husband begs: two-shot
  7: [
    { f: 531, s: D(531, [-41.3, 1.7, -2.6], [-44.5, 1.5, 1.4], 38, 0, 0.0022) },
    { f: 556, dur: 22, s: D(556, [-42.0, 1.6, -1.6], [-44.6, 1.6, 1.2], 36, 0.035, 0.002) },
  ],
  // six days: the same framing, day / golden / day (crossfades), the husband ends up asleep on the step
  8: [{ f: 580, s: D(580, [-40.5, 2.0, -5.6], [-44.5, 1.2, 2.0], 42, 0, 0.0015) }],
  // thirty more: from her medium shot, pull back down the lane to reveal the dancing crowd ("thirty")
  11: [
    { f: 642, s: D(642, [-41.2, 1.7, -2.9], [-45, 1.5, 1.2], 36, 0, 0.002) },
    { f: 664, dur: 34, s: D(664, [-35.5, 5.0, -3.3], [-45.5, 0.9, 0.6], 44, 0.03, 0.0018) },
  ],
  // "By August, there are hundreds": crane up over the packed square
  12: [
    { f: 728, s: D(728, [8, 3.2, -15], [2, 1.6, -4], 42, 0, 0.002) },
    { f: 744, dur: 30, s: D(744, [26, 24, -36], [0, 0, 1], 46, -0.03, 0.0016) },
  ],
  // hopping and spinning: low and close in the crowd, punch on "summer heat"
  13: [
    { f: 776, s: D(776, [3.4, 0.9, -11.6], [2.4, 1.4, -6.0], 40, 0.04, 0.0025) },
    { f: 807, dur: 20, s: D(807, [3.0, 1.2, -10.6], [2.4, 1.5, -6.0], 36, -0.04, 0.002, 0.006, 30) },
  ],
  // the doctors: two-shot with the flask, punch CU on "hot blood", wide smiles on "Luckily", finger up on "cure"
  14: [
    { f: 843, s: D(843, [-3.4, 1.65, -9.6], [-5.7, 1.55, -5.2], 38, 0, 0.0022) },
    { f: 912, cut: true, s: D(912, [-5.2, 2.0, -7.7], [-6.1, 1.9, -5.45], 32, 0.035, 0.0025, 0.006, 32) },
    { f: 941, cut: true, s: D(941, [-1.8, 1.7, -10.8], [-5.4, 1.4, -5.2], 40, 0, 0.002) },
    { f: 972, dur: 18, s: D(972, [-2.6, 1.7, -9.6], [-5.5, 1.6, -5.2], 37, -0.03, 0.002) },
  ],
  // "Unluckily": the doctor's deadpan close-up, "more dancing": the patients dance harder behind him
  15: [
    { f: 1000, s: D(1000, [-5.15, 2.0, -7.9], [-6.1, 1.9, -5.45], 33, 0.03, 0.0022) },
    { f: 1035, cut: true, s: D(1035, [-2.0, 1.8, -11.6], [-5.0, 1.3, -4.6], 42, -0.035, 0.0018) },
  ],
  // the guildhall doors thrown open by the council
  16: [{ f: 1065, s: D(1065, [14.5, 1.8, -11.5], [22.4, 2.0, -6.2], 44, 0, 0.002) }],
  // the stage goes up (hammering carpenter), punch on "wooden stage"
  17: [
    { f: 1118, s: D(1118, [1.5, 3.6, -3.0], [10, 1.6, 9], 42, 0, 0.0022) },
    { f: 1127, dur: 20, s: D(1127, [3.8, 2.8, 0.6], [10, 1.6, 9], 40, 0.03, 0.002, 0.005, 30) },
  ],
  // the band on the stage: the piper, then a glide to the drummer
  18: [
    { f: 1157, s: D(1157, [8.9, 2.9, 4.6], [9.45, 2.7, 8.6], 36, 0, 0.0024) },
    { f: 1178, dur: 22, s: D(1178, [10.9, 2.9, 4.6], [10.6, 2.65, 8.6], 36, -0.03, 0.0024) },
  ],
  // strong men hold a dancer up
  19: [
    { f: 1210, s: D(1210, [-8.2, 1.7, -6.8], [-8.8, 1.45, -1.6], 40, 0, 0.0022) },
    { f: 1243, dur: 22, s: D(1243, [-8.6, 1.7, -5.0], [-8.8, 1.6, -1.6], 36, 0.035, 0.0022) },
  ],
  // the dancers start collapsing (kicks on the falls)
  20: [
    { f: 1290, s: D(1290, [5.0, 2.4, -14.5], [0.5, 0.9, -6], 42, 0, 0.0022) },
    { f: 1312, cut: true, s: D(1312, [3.0, 1.1, -11.4], [0.6, 0.7, -6.2], 38, -0.04, 0.0025, 0.006, 30) },
  ],
  // golden: a row of people on the bench, the yawn travels along the row
  21: [{ f: 1339, s: D(1339, [2.2, 1.55, -8.8], [8.0, 0.95, -16.2], 40, 0, 0.0022) }],
  // close two-shot: one yawns, the other watches... and has to yawn too
  22: [
    { f: 1421, s: D(1421, [7.9, 1.3, -13.2], [8.45, 1.15, -16.2], 34, 0, 0.0022) },
    { f: 1481, dur: 18, s: D(1481, [8.25, 1.3, -13.7], [8.8, 1.2, -16.2], 32, 0.035, 0.0022, 0.005, 30) },
  ],
  // fear and hunger: nervous faces in the crowd
  23: [
    { f: 1509, s: D(1509, [-1.4, 1.7, 10.0], [-1.0, 1.55, 14.6], 38, 0, 0.0025) },
    { f: 1534, dur: 22, s: D(1534, [1.6, 1.7, 10.6], [1.8, 1.45, 14.6], 36, 0.03, 0.0025) },
  ],
  // St Vitus on his pedestal: low hero angle, punch on "Saint Vitus", glide down to the dancer at his feet
  24: [
    { f: 1585, s: D(1585, [-11.2, 1.0, 4.4], [-13, 3.4, 11], 40, 0, 0.002, 0.006, 32) },
    { f: 1636, dur: 26, s: D(1636, [-10.8, 1.5, 4.6], [-12.6, 1.6, 9.4], 40, -0.03, 0.002) },
  ],
  // one dancer -> the whole city: from Troffea's face crane all the way out
  25: [
    { f: 1658, s: D(1658, [-2.6, 1.85, -4.8], [-3, 1.75, -2], 34, 0, 0.0022) },
    { f: 1680, dur: 40, s: D(1680, [30, 48, -70], [0, 2, 6], 46, 0, 0.0012) },
  ],
  // the council flips: the councillor nails up the no-music sign (kicks on the hammer blows)
  26: [
    { f: 1724, s: D(1724, [13.3, 1.7, -14.2], [16.6, 1.55, -11.2], 40, 0, 0.002) },
    { f: 1776, cut: true, s: D(1776, [14.9, 1.75, -13.6], [16.9, 1.65, -11.2], 36, 0.035, 0.0024) },
  ],
  // golden: the cart of dancers bumping up the hill road, the lens rides along
  27: [
    { f: 1811, s: (f: number) => { const x = wagonX(T(f)); return dolly([x + 0.6, 3.0, ROAD_Z - 13], [x + 1.8, 1.2, ROAD_Z], pushK(f, 1811, 0.0015), { fov: 42, roll: 0 }); } },
    { f: 1850, dur: 30, s: (f: number) => { const x = wagonX(T(f)); return dolly([x + 4.2, 1.6, ROAD_Z - 7.2], [x + 0.2, 1.55, ROAD_Z], pushK(f, 1850, 0.0015), { fov: 42, roll: -0.03 }); } },
  ],
  // the shrine of St Vitus on its hill, backlit
  28: [{ f: 1880, s: Z(1880, [226, 3.0, -66], [262, 5, -60], 42, 0, 0.0022) }],
  // the cure: the priest offers red shoes, then the red shoes on her feet (punch, a single tap)
  29: [
    { f: 1930, s: D(1930, [251.6, 1.65, -63.2], [255.8, 1.45, -60.0], 38, 0, 0.0022) },
    { f: 2017, cut: true, s: D(2017, [253.75, 0.38, -62.15], [254.9, 0.2, -60.9], 34, 0.035, 0.003, 0.006, 32) },
  ],
};
CAMS[9] = CAMS[8]; CAMS[10] = CAMS[8];

// impact kicks: the image offset flips sign every frame, decays to 0 in 7 f
const KICKS: [number, number][] = [...COLLAPSE.map((h) => [h, 0.8] as [number, number]), ...HITS.map((h) => [h, 0.6] as [number, number])];
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

// ---------------- lens: depth of field + foreground framing ----------------
export type Dof = { f: number; dur?: number; cInf: number; focus?: (f: number) => V3 };
export const DOF: Dof[] = [
  { f: 0, cInf: 0 }, // hook aerial
  { f: 52, dur: 36, cInf: 10 }, // down into the crowd
  { f: 112, cInf: 15 }, // worn-out dancer CU
  { f: 158, cInf: 0 }, // town aerial, fields
  { f: 258, cInf: 11 }, // bread stall MS
  { f: 321, cInf: 12 }, // exhausted townsfolk
  { f: 350, cInf: 7 }, // the door
  { f: 436, dur: 24, cInf: 10 },
  { f: 476, cInf: 0 }, // wide empty lane
  { f: 503, cInf: 15, focus: () => eye(TROFF_LANE, 1.9) }, // "no reason" CU
  { f: 531, cInf: 11 }, // husband two-shot
  { f: 586, cInf: 0 }, // six days
  { f: 642, cInf: 12 }, // her MS
  { f: 664, dur: 34, cInf: 0 }, // reveal the thirty
  { f: 728, cInf: 0 }, // hundreds: crane
  { f: 776, cInf: 12 }, // hopping close
  { f: 843, cInf: 11 }, // doctors MS
  { f: 912, cInf: 14 }, // doctor CU
  { f: 941, cInf: 8 },
  { f: 1000, cInf: 14 }, // doctor CU "Unluckily"
  { f: 1035, cInf: 0 }, // more dancing wide
  { f: 1065, cInf: 0 }, // guildhall
  { f: 1118, cInf: 6 }, // stage
  { f: 1157, cInf: 12 }, // band
  { f: 1210, cInf: 11 }, // strong men
  { f: 1290, cInf: 6 },
  { f: 1312, cInf: 12 }, // falls close
  { f: 1343, cInf: 6 }, // bench row
  { f: 1425, cInf: 13 }, // yawn CU
  { f: 1513, cInf: 12 }, // fear faces
  { f: 1585, cInf: 8 }, // statue
  { f: 1658, cInf: 14 }, // Troffea CU
  { f: 1680, dur: 30, cInf: 0 }, // crane out
  { f: 1724, cInf: 10 }, // sign
  { f: 1815, cInf: 0 }, // wagon, shrine
  { f: 1934, cInf: 9 }, // priest
  { f: 2017, cInf: 14 }, // red shoes
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

/** near framing objects (cartoon plants from build.ts kitClone), visible while a <= f < b inside one shot */
export type Fg = { a: number; b: number; kit: string; pos: V3; s?: number; yaw?: number };
export const FOREGROUND: Fg[] = [
  { a: 1343, b: 1425, kit: "plant_bushDetailed", pos: [4.4, 0, -11.6], s: 1.1, yaw: 0.4 }, // bench row, bottom-left corner
  { a: 1884, b: 1934, kit: "plant_bushLarge", pos: [230.5, 0, -68.2], s: 1.5, yaw: 1.1 }, // shrine wide, bottom-left
];
