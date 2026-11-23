// Our cast as lit flat sprites in the 3D world. Each frame every character asks for a drawing (a key + a draw call);
// the pool keeps one canvas per distinct drawing, so soldiers marching in step share canvases (7 head shapes x 4
// outfits). Characters are yaw-only billboards shaded by cardShade() (scene tint, bright floor, side gradient toward
// the sun, painted crescent in the drawing); standing ones get a soft multiply contact blob. Effects are unlit cards.
// Cards, effects and blobs live on the NOINK layer so the world ink pass never outlines their quads.
import * as THREE from "three";
import {
  Pen, bodyFront, bodySide, fxNote, fxBurst, fxStars, fxCreak, fxShadow, fxContact, fxCoins, fxSweat, fxHalo, fxDarkCloud, fxZzz, fxHorse,
  Outfit, Expr, FrontOpts, SideOpts, SKINS, INK,
} from "./toon";
import {
  FPS, SHOTS, V3, smooth, clamp01, camAt, SQ, STAGE, STAGE_H, WELL, STATUE, STATUE_H, STALL, BENCH, SIGN_AT, ROAD_Z, DOOR,
  TROFF_LANE, TROFF_SQ, STEP_OUT, DANCE0, HITS, COLLAPSE, wagonX, Scene,
} from "./story";
import { LIGHTS } from "./lights";
import { NOINK } from "./ink";
import { cardShade, blobMaterial, CARD_K } from "./cardshade";

// ---------------- canvas pool ----------------
type Entry = { cv: HTMLCanvasElement; tex: THREE.CanvasTexture; w: number; h: number };
export type Req = { key: string; w: number; h: number; k: number; draw: (p: Pen) => void; tex?: THREE.CanvasTexture };
const makeEntry = (w: number, h: number): Entry => {
  const cv = document.createElement("canvas");
  cv.width = w; cv.height = h;
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  return { cv, tex, w, h };
};
export class Pool {
  private live = new Map<string, Entry>();
  private free: Entry[] = [];
  private reqs: Req[] = [];
  req(key: string, w: number, h: number, k: number, draw: (p: Pen) => void) {
    const r: Req = { key: `${w}x${h}|${key}`, w, h, k, draw };
    this.reqs.push(r);
    return r;
  }
  flush() {
    const want = new Map<string, Req[]>();
    for (const r of this.reqs) { const l = want.get(r.key); if (l) l.push(r); else want.set(r.key, [r]); }
    for (const [key, e] of this.live) if (!want.has(key)) { this.live.delete(key); this.free.push(e); }
    for (const [key, rs] of want) {
      let e = this.live.get(key);
      if (!e) {
        const r = rs[0], i = this.free.findIndex((x) => x.w === r.w && x.h === r.h);
        e = i >= 0 ? this.free.splice(i, 1)[0] : makeEntry(r.w, r.h);
        const g = e.cv.getContext("2d")!;
        g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, e.w, e.h); g.setTransform(r.k, 0, 0, r.k, 0, 0);
        r.draw(new Pen(g));
        e.tex.needsUpdate = true;
        this.live.set(key, e);
      }
      for (const r of rs) r.tex = e.tex;
    }
    this.reqs = [];
  }
}

// ---------------- sprite meshes ----------------
const blank = (() => { const c = document.createElement("canvas"); c.width = c.height = 2; return new THREE.CanvasTexture(c); })();
export const SU = 0.00216; // metres per design unit: 1000 units = 2.16 m
export const SU_SWING = 2.3 / 1830; // swing canvas: rope of 1830 units = 2.3 m
const BODY = (() => { const g = new THREE.PlaneGeometry(600 * SU, 1000 * SU); g.translate(0, (975 - 500) * SU, 0); return g; })();
const CARD = new THREE.PlaneGeometry(1, 1);
/** world roots that hold actors (to find the scene's sun when world.ts does not pass it) */
const ROOTS = new Set<THREE.Object3D>();

/** lit flat character: cardShade() material, receives shadows (dims to the bright floor only), casts its silhouette
 *  when world.ts says so (golden). Drawn after the contact blobs (renderOrder 1). */
export class Actor {
  mesh: THREE.Mesh; mat: THREE.MeshLambertMaterial; dmat: THREE.MeshDepthMaterial; r: Req | null = null;
  constructor(parent: THREE.Object3D, geo: THREE.BufferGeometry = BODY) {
    this.mat = cardShade(new THREE.MeshLambertMaterial({ map: blank, alphaTest: 0.5, side: THREE.DoubleSide }));
    this.mat.alphaToCoverage = false; // A2C + MSAA left 1 px sky-depth seams on blurred far cards (POST)
    this.dmat = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: blank, alphaTest: 0.5, side: THREE.DoubleSide });
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.customDepthMaterial = this.dmat;
    // rim width is in output pixels: tell the card shader the render height (1920 = 1080 x 1920 frame)
    this.mesh.onBeforeRender = (r) => { const rt = r.getRenderTarget(); CARD_K.uPx.value = (rt ? rt.height : r.domElement.height) / 1920; };
    this.mesh.castShadow = false; this.mesh.receiveShadow = true; this.mesh.visible = false;
    this.mesh.rotation.order = "YXZ"; this.mesh.renderOrder = 1; this.mesh.layers.set(NOINK);
    parent.add(this.mesh);
    ROOTS.add(parent);
  }
  bind() { const t = this.r?.tex; if (t) { this.mat.map = t; this.dmat.map = t; } }
}
/** unlit effect card: hard cut-out (ink drawings), soft see-through (dust, mist) or a multiply ground blob */
export class Fx {
  mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; soft: THREE.MeshBasicMaterial; blob: THREE.MeshBasicMaterial; r: Req | null = null;
  constructor(parent: THREE.Object3D) {
    this.mat = new THREE.MeshBasicMaterial({ map: blank, alphaTest: 0.5, side: THREE.DoubleSide });
    this.mat.alphaToCoverage = false; // A2C + MSAA left 1 px sky-depth seams on blurred far cards (POST)
    this.soft = new THREE.MeshBasicMaterial({ map: blank, transparent: true, depthWrite: false, side: THREE.DoubleSide });
    this.blob = blobMaterial(blank);
    this.mesh = new THREE.Mesh(CARD, this.mat);
    this.mesh.visible = false; this.mesh.layers.set(NOINK);
    parent.add(this.mesh);
  }
  use(soft: boolean) { this.mesh.material = soft ? this.soft : this.mat; }
  bind() {
    const t = this.r?.tex;
    if (!t) return;
    if (this.r!.key.includes("|blob|")) {
      // no mipmaps: at grazing views the mip chain averages the blob with its white surround and it fades out
      if (t.generateMipmaps) { t.generateMipmaps = false; t.minFilter = THREE.LinearFilter; t.needsUpdate = true; }
      this.blob.map = t; this.mesh.material = this.blob; this.mesh.renderOrder = 0.5;
    }
    else { this.mat.map = t; this.soft.map = t; this.mesh.renderOrder = 0; }
  }
}

// ---------------- placements ----------------
export type Place = {
  key: string; draw: (p: Pen) => void; x: number; y: number; z: number;
  scale?: number; mirror?: boolean; yaw?: number; geo?: "body" | "swing"; roll?: number; size?: [number, number, number];
};
export type FxPlace = { key: string; cw: number; ch: number; draw: (p: Pen) => void; x: number; y: number; z: number; w: number; h: number; flat?: boolean; rot?: number; soft?: boolean };
/** sun = world direction TOWARD the sun (optional: when absent the scene's shadow-casting light is used) */
export type CamInfo = { pos: THREE.Vector3; right: THREE.Vector3; sun?: THREE.Vector3 };

const hh = (i: number, s = 0) => { const v = Math.sin(i * 127.1 + s * 311.7) * 43758.5453; return v - Math.floor(v); };
const q = (v: number, n = 120) => Math.round(v * n) / n;
const vOf = (i: number) => (i * 7 + (i >> 2)) % 4;
/** head-shape seed: 7 shapes, so marching soldiers in step still share canvases */
const seedOf = (i: number) => ((i * 5 + 3) % 7) + 1;
/** drawing resolution by distance: [canvas w, h, scale from the 600 x 1000 design]; sized for the 1440 x 2560 final */
const tier = (d: number): [number, number, number] =>
  d < 3.2 ? [1800, 3000, 3.0] : d < 6.5 ? [1080, 1800, 1.8] : d < 16 ? [480, 800, 0.8] : [240, 400, 0.4];

// ---------------- light ----------------
const SUN = new THREE.Vector3(0.5, 0.75, -0.4).normalize();
const tmp = new THREE.Vector3();
let LNAME: "day" | "golden" = "day";
const sunOf = (root: THREE.Object3D) => {
  let s: THREE.DirectionalLight | null = null;
  root.traverse((o) => { if (!s && o instanceof THREE.DirectionalLight && o.castShadow) s = o; });
  return s as THREE.DirectionalLight | null;
};
/** the sun of the world that is calling: the attached root whose sun target sits on this camera's view axis */
const findSun = (cam: CamInfo, out: THREE.Vector3) => {
  if (cam.sun) return out.copy(cam.sun).normalize();
  let best: THREE.DirectionalLight | null = null, err = Infinity;
  for (const r of ROOTS) {
    if (!r.parent) continue;
    const s = sunOf(r);
    if (!s) continue;
    const d = tmp.copy(s.target.position).sub(cam.pos), e = Math.abs(d.dot(cam.right)) / (d.length() || 1);
    if (e < err) { err = e; best = s; }
  }
  return best ? out.copy(best.position).sub(best.target.position).normalize() : out;
};
/** canvas angle the sun comes FROM on an upright card facing the camera, in 45-degree steps (small texture cache) */
const light2D = (cam: CamInfo, mirror: boolean) => {
  const sx = SUN.dot(cam.right) * (mirror ? -1 : 1), sy = -SUN.y;
  return Math.round(Math.atan2(sy, sx) / (Math.PI / 4)) * (Math.PI / 4);
};

/** front / side view and mirroring for someone at (x, z) walking along (dx, dz); fs = foreshortening of the walk */
const viewOf = (cam: CamInfo, x: number, z: number, dx: number, dz: number) => {
  const tx = cam.pos.x - x, tz = cam.pos.z - z, tl = Math.hypot(tx, tz) || 1;
  const c = (tx * dx + tz * dz) / tl;
  return { side: c < 0.57, mirror: dx * cam.right.x + dz * cam.right.z < 0, fs: Math.round(Math.sqrt(Math.max(0, 1 - c * c)) * 20) / 20 };
};

// ---------------- life: blinks and reaction timing ----------------
/** reference expression and action changes land 0-3 f before the word onset */
const LEAD = 2 / FPS;
/** eyelid 0 open .. 1 shut. Reference: gaps 0.5-2.3 s, 4-frame blink half / shut / shut / half, plus a blink across
 *  every expression swap (the shut frames hide the swap) */
const LID = [0.5, 1, 1, 0.5];
const SWAPS: Record<number, number[]> = {};
const lidAt = (t: number, i: number, swaps: number[] = []) => {
  const f = Math.round(t * FPS);
  for (const ts of swaps) { const k = f - Math.round((ts - LEAD) * FPS) + 1; if (k >= 0 && k < 4) return LID[k]; }
  let s = Math.round(-60 * hh(i, 9));
  for (let n = 0; s <= f && n < 400; n++) {
    const k = f - s;
    if (k >= 0 && k < 4) return LID[k];
    s += Math.round(15 + 54 * hh(i * 31 + n, 13)); // next blink 0.5-2.3 s later
  }
  return 0;
};
const fkey = (o: object) => JSON.stringify(o, (_k, v) => (typeof v === "number" ? q(v) : v));

type Who = { i: number; o: Outfit; okey: string };
/** one character drawing in the 600 x 1000 design space, sized by distance, lit from the scene's sun */
const person = (cam: CamInfo, who: Who, x: number, y: number, z: number, view: { side: boolean; mirror: boolean }, fo: FrontOpts, so: SideOpts, scale = 1): Place & { tierKey: string } => {
  const d = cam.pos.distanceTo(tmp.set(x, y + 1.2, z)) / scale;
  const [w, h, k] = tier(d);
  const mirror = view.side && view.mirror, light = light2D(cam, mirror), seed = seedOf(who.i);
  const f2: FrontOpts = { ...fo, light, seed }, s2: SideOpts = { ...so, light, seed };
  const key = view.side ? `S|${who.okey}|${fkey(s2)}` : `F|${who.okey}|${fkey(f2)}`;
  return {
    key, x, y, z, scale, mirror, tierKey: `${w}`,
    draw: (p) => (view.side ? bodySide(p, who.o, s2) : bodyFront(p, who.o, f2)),
    size: [w, h, k],
  };
};

/** ground shadow under a standing / sitting card (review rounds 2-4), multiply, blue-violet: a TIGHT contact pool right under
 *  the feet (~.5 on screen at the core) so nobody floats, plus by day (cards cast no real shadow) a lighter soft tail
 *  stretched AWAY from the sun, length ~1.6 m / tan(sun elevation), capped. Golden: world.ts casts real card shadows. */
const CONTACT: Record<"day" | "golden", [number, number, number]> = { day: [0.2, 0.21, 0.33], golden: [0.24, 0.2, 0.33] };
const TAIL: [number, number, number] = [0.42, 0.44, 0.62];
const toSrgb = (v: number) => { const c = clamp01(v); return c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055; };
const hexOf = (c: [number, number, number], k: number) => "#" + c.map((v) => Math.round(255 * toSrgb(1 - (1 - v) * k)).toString(16).padStart(2, "0")).join("");
const blob = (out: Stage, x: number, y: number, z: number, sc = 1, k = 1) => {
  const hl = Math.hypot(SUN.x, SUN.z) || 1, ox = -SUN.x / hl, oz = -SUN.z / hl, rot = Math.atan2(-ox, -oz);
  if (LNAME === "day") {
    const el = Math.asin(Math.min(0.99, Math.max(0.1, SUN.y)));
    const len = Math.min(2.4, Math.max(0.5, 1.6 / Math.tan(el))) * sc, h = len + 0.55 * sc, c = 0.3 * h; // feet at v = .2 of the card
    const tc = hexOf(TAIL, k);
    out.fx.push({ key: `blob|shadow|${tc}`, cw: 128, ch: 256, draw: (p) => fxShadow(p, tc), x: x + ox * c, y: y + 0.018, z: z + oz * c,
      w: 0.72 * sc, h, flat: true, rot });
  }
  const cc = hexOf(CONTACT[LNAME], k);
  out.fx.push({ key: `blob|contact|${cc}`, cw: 128, ch: 128, draw: (p) => fxContact(p, cc), x: x + ox * 0.03 * sc, y: y + 0.022, z: z + oz * 0.03 * sc,
    w: 0.52 * sc, h: 0.4 * sc, flat: true, rot });
};

// ---------------- crowd by shot ----------------
export type Stage = { places: Place[]; fx: FxPlace[] };

// ---------------- the cast of 1518 ----------------
const MEN_COATS = ["#8c4a32", "#5d7a3a", "#3f5f8a", "#b07a3a", "#6e4a6a", "#4f6b62"], HOSE = ["#3b3f52", "#7a3030", "#4a3a2a", "#2f4a5a"];
const GOWNS = ["#b8553a", "#3f6fb5", "#6a8a3a", "#c9a14a", "#8c3b4a", "#5a7aa8"], BODICE = ["#e8d9b5", "#5a3b2a", "#2f3b5a", "#f1e6cf"];
const CAPS = ["#2e2a36", "#6a2a2a", "#3a4a2a", "#4a3426"];
const man = (v: number): Outfit => ({ jacket: MEN_COATS[v % 6], pants: HOSE[(v >> 1) % 4], boots: "#4a3426", skin: SKINS[v % 4],
  hat: v % 3 === 2 ? "hair" : "beret", cap: CAPS[v % 4], hair: ["#5a3b2a", "#2a201a", "#8a5a34", "#c9b48a"][v % 4], moustache: v % 4 === 1 ? "#4a3426" : undefined });
const woman = (v: number): Outfit => ({ jacket: BODICE[v % 4], pants: "#3b3f52", boots: "#4a3426", skin: SKINS[(v + 1) % 4], hat: "coif", dress: GOWNS[v % 6] });
const FOLK: Outfit[] = [0, 1, 2, 3, 4, 5, 6, 7].map((v) => (v % 2 ? woman(v >> 1) : man(v >> 1)));
const TROFFEA: Outfit = { jacket: "#efe3c8", pants: "#3b3f52", boots: "#6a4a32", skin: SKINS[0], hat: "coif", dress: "#3f6fb5" };
const TROFFEA_RED: Outfit = { ...TROFFEA, boots: "#d42a2a" };
const HUSBAND: Outfit = { jacket: "#6b7a3a", pants: "#4a3a2a", boots: "#4a3426", skin: SKINS[1], hat: "beret", cap: "#5a3b2a", moustache: "#4a3426" };
const DOCTOR: Outfit = { jacket: "#7a2a35", pants: "#2e2a36", boots: INK, dress: "#7a2a35", hat: "doctor", cap: "#2e2a36", skin: SKINS[0], beard: "#d9d2c4", build: "stout" };
const DOCTOR2: Outfit = { jacket: "#2e3a5a", pants: "#2e2a36", boots: INK, dress: "#2e3a5a", hat: "doctor", cap: "#7a2a35", skin: SKINS[2], moustache: "#3a2a20" };
const COUNCIL: Outfit = { jacket: "#2e2a36", pants: "#2e2a36", boots: INK, dress: "#2e2a36", hat: "beret", cap: "#1d1b22", skin: SKINS[1], beard: "#8a7a6a", sash: "#c9a24e" };
const COUNCIL2: Outfit = { jacket: "#4a2a3a", pants: "#2e2a36", boots: INK, dress: "#4a2a3a", hat: "beret", cap: "#1d1b22", skin: SKINS[0], moustache: "#5a3b2a" };
const PIPER: Outfit = { jacket: "#d0a030", pants: "#b83a3a", boots: "#4a3426", skin: SKINS[0], hat: "beret", cap: "#b83a3a", feather: "#f4efe4" };
const DRUMMER: Outfit = { jacket: "#3f6fb5", pants: "#d0a030", boots: "#4a3426", skin: SKINS[3], hat: "beret", cap: "#2f5a3a", feather: "#d42a2a" };
const STRONG: Outfit = { jacket: "#8a5a34", pants: "#3b3f52", boots: "#4a3426", skin: SKINS[1], hat: "hair", hair: "#2a201a", build: "stout", apron: "#6a4a32", moustache: "#2a201a" };
const STRONG2: Outfit = { ...STRONG, skin: SKINS[2], hair: "#8a5a34", moustache: undefined, jacket: "#a0603a" };
const BAKER: Outfit = { jacket: "#e8d9b5", pants: "#6a4a32", boots: "#4a3426", skin: SKINS[0], hat: "beret", cap: "#f4efe4", apron: "#f8f4ea", build: "stout", moustache: "#8a5a34" };
const CARPENTER: Outfit = { jacket: "#b07a3a", pants: "#3b3f52", boots: "#4a3426", skin: SKINS[2], hat: "beret", cap: "#5a3b2a", apron: "#8a6a4a" };
const PRIEST: Outfit = { jacket: "#22202a", pants: "#22202a", boots: INK, dress: "#22202a", hat: "hair", hair: "#c9c2b5", skin: SKINS[0] };
const DRIVER: Outfit = man(5);
const STONE: Outfit = { jacket: "#b9b3a8", pants: "#aaa49a", boots: "#9d978d", dress: "#bdb7ac", hat: "hair", hair: "#a29c92", skin: "#cbc5ba" };

const who = (i: number, o: Outfit, okey: string): Who => ({ i, o, okey });
const folk = (i: number): Who => who(i, FOLK[i % 8], `f${i % 8}`);
const qp = (x: number, n = 12) => (Math.round((((x % 1) + 1) % 1) * n) % n) / n;
const FRONT = { side: false, mirror: false };

// ---------------- the dancing crowd ----------------
type Dancer = { i: number; x: number; z: number; hz: number; ph0: number; e: number; spin: boolean; expr: Expr };
const DEXPR: Expr[] = ["tired", "pained", "grin", "worried", "dazed", "laugh", "tired", "neutral"];
const mkCrowd = (n: number, seed: number, inside: (x: number, z: number) => boolean, area: [number, number, number, number]) => {
  const out: Dancer[] = [];
  for (let k = 0, i = 0; out.length < n && k < n * 8; k++) {
    const x = area[0] + hh(k, seed) * (area[1] - area[0]), z = area[2] + hh(k, seed + 1) * (area[3] - area[2]);
    if (!inside(x, z) || out.some((d) => Math.hypot(d.x - x, d.z - z) < 0.95)) continue;
    out.push({ i: i + seed * 1000, x, z, hz: 0.95 + 0.5 * hh(k, seed + 2), ph0: hh(k, seed + 3), e: 0.45 + 0.55 * hh(k, seed + 4), spin: hh(k, seed + 5) < 0.3,
      expr: DEXPR[Math.floor(hh(k, seed + 6) * 8)] });
    i++;
  }
  return out;
};
const freeSquare = (x: number, z: number) =>
  Math.hypot(x - WELL[0], z - WELL[2]) > 1.9 && !(Math.abs(x - STAGE[0]) < 5 && Math.abs(z - STAGE[2]) < 3.3) &&
  Math.hypot(x - STATUE[0], z - STATUE[2]) > 1.6 && !(Math.abs(x - STALL[0]) < 2.4 && Math.abs(z - STALL[2]) < 1.6) &&
  Math.hypot(x - TROFF_SQ[0], z - TROFF_SQ[2]) > 1.0 && Math.hypot(x - 0.2, z + 6.3) > 1.0;
const SQUARE_CROWD = mkCrowd(380, 3, freeSquare, [SQ.x0 + 1, SQ.x1 - 1, SQ.z0 + 1.2, SQ.z1 - 1]);
const LANE_CROWD = mkCrowd(30, 7, (x, z) => Math.hypot(x - TROFF_LANE[0], z - TROFF_LANE[2]) > 1.1, [-52, -38, -2.6, 2.6]);

/** cameras of a shot, sampled: no card may stand within `r` metres of any lens position (no cut-off giants at the edge) */
const camCache = new Map<number, V3[]>();
const lensPts = (id: number) => {
  let v = camCache.get(id);
  if (!v) { v = []; const s = SHOTS[id - 1]; for (let f = s.a - 4; f < s.b + 4; f += 3) v.push(camAt(id, Math.max(0, f)).pos); camCache.set(id, v); }
  return v;
};
const clear = (id: number, x: number, z: number, r = 2.2) => lensPts(id).every((p) => Math.hypot(p[0] - x, p[2] - z) > r);

const dancePose = (d: Dancer, t: number, eK = 1, far = false) => {
  const ph = d.ph0 + d.hz * t, phase = qp(ph, far ? 6 : 12), e = Math.min(1, d.e * eK);
  const hop = 0.14 * e * Math.abs(Math.sin(Math.PI * 2 * phase)) ** 0.7;
  const mirror = d.spin && Math.floor(ph * 2) % 2 === 1;
  return { phase, e, hop, mirror };
};
const putDancer = (cam: CamInfo, t: number, out: Stage, d: Dancer, w: Who, opt: { eK?: number; expr?: Expr; y?: number; sweat?: boolean } = {}) => {
  const dist = cam.pos.distanceTo(tmp.set(d.x, 1, d.z)), far = dist > 22;
  const { phase, e, hop, mirror } = dancePose(d, t, opt.eK ?? 1, far);
  const expr = opt.expr ?? d.expr, y = (opt.y ?? 0) + hop;
  const fo: FrontOpts = { mode: "dance", phase, energy: Math.round(e * 10) / 10, expr, blink: far ? 0 : lidAt(t, d.i), headTilt: expr === "tired" ? 6 : 0 };
  out.places.push({ ...person(cam, w, d.x, y, d.z, FRONT, fo, {}), mirror });
  if (!far) blob(out, d.x, opt.y ?? 0, d.z, 1, 1 - Math.min(0.6, hop * 3));
  if (opt.sweat && !far && dist < 9) {
    const u = q((t * 1.4 + hh(d.i, 8)) % 1, 30);
    out.fx.push({ key: `sweat${u}`, cw: 300, ch: 300, draw: (p) => fxSweat(p, u), x: d.x, y: y + 2.0, z: d.z, w: 0.7, h: 0.7 });
  }
};
const crowd = (id: number, cam: CamInfo, t: number, out: Stage, list: Dancer[], opt: { eK?: number; sweat?: boolean; skip?: (d: Dancer) => boolean; clearR?: number } = {}) => {
  for (const d of list) {
    if (!clear(id, d.x, d.z, opt.clearR) || opt.skip?.(d)) continue;
    putDancer(cam, t, out, d, folk(d.i), { eK: opt.eK, sweat: opt.sweat });
  }
};

/** townsfolk strolling about the square before it all starts */
const strollers = (id: number, cam: CamInfo, t: number, out: Stage, n: number) => {
  for (let i = 0; i < n; i++) {
    const a = hh(i, 41) * Math.PI * 2, sp = 0.6 + 0.5 * hh(i, 42), dx = Math.cos(a), dz = Math.sin(a);
    let x = SQ.x0 + 2 + hh(i, 43) * (SQ.x1 - SQ.x0 - 4) + dx * sp * t, z = SQ.z0 + 2 + hh(i, 44) * (SQ.z1 - SQ.z0 - 4) + dz * sp * t;
    const W = SQ.x1 - SQ.x0 - 4, Hh = SQ.z1 - SQ.z0 - 4;
    x = SQ.x0 + 2 + Math.abs(((x - SQ.x0 - 2) % (2 * W) + 2 * W) % (2 * W) - W); z = SQ.z0 + 2 + Math.abs(((z - SQ.z0 - 2) % (2 * Hh) + 2 * Hh) % (2 * Hh) - Hh);
    if (!clear(id, x, z, 3) || !freeSquare(x, z)) continue;
    const phase = qp(t * sp / 1.4 + hh(i, 45), 8);
    out.places.push(person(cam, folk(i + 500), x, 0, z, FRONT, { mode: "stroll", phase, expr: "neutral", blink: lidAt(t, i + 500) }, {}));
    blob(out, x, 0, z);
  }
};

const stand = (cam: CamInfo, t: number, out: Stage, w: Who, x: number, y: number, z: number, fo: FrontOpts, sc = 1, shadow = true) => {
  out.places.push(person(cam, w, x, y, z, FRONT, { mode: "stand", blink: lidAt(t, w.i), ...fo }, {}, sc));
  if (shadow) blob(out, x, y, z, sc);
};
const sit = (cam: CamInfo, t: number, out: Stage, w: Who, x: number, y: number, z: number, fo: FrontOpts) => {
  out.places.push(person(cam, w, x, y, z, FRONT, { mode: "sit", blink: lidAt(t, w.i), ...fo }, {}));
};
/** expression windows: [t0, t1, expr] in story seconds, landing LEAD before the word */
const exprAt = (t: number, base: Expr, wins: [number, number, Expr][]) => {
  for (const [a, b, e] of wins) if (t >= a - LEAD && t < b - LEAD) return e;
  return base;
};
const W = (f: number) => f / FPS; // word frame -> seconds

/** 0 = hammer up, 1 = struck (4 f wind-up, ~7 f held at the top, 1-frame strike on the beat) */
const hammerK = (t: number, hits: number[]) => {
  let k = 1;
  for (const th of hits) {
    const n = (t - th) * FPS;
    if (n >= -11 && n < -7) k = Math.min(k, 1 - smooth((n + 11) / 4));
    else if (n >= -7 && n < 0) k = 0;
  }
  return k;
};
const burst = (t: number, hits: number[], out: Stage, at: V3, s = 0.9) => {
  for (const th of hits) if (t >= th && t < th + 5 / FPS) {
    const u = (t - th) / (5 / FPS);
    out.fx.push({ key: `burst${q(u, 30)}`, cw: 500, ch: 500, draw: (p) => fxBurst(p, q(u, 30)), x: at[0], y: at[1], z: at[2], w: s, h: s });
  }
};
const notes = (t: number, out: Stage, at: V3, i: number, t0: number) => {
  for (let n = 0; n < 4; n++) {
    const age = ((t - t0 + n * 0.42 + hh(i, 5)) % 1.68) / 1.68;
    const pop = Math.min(1, age * 7) * (age > 0.82 ? (1 - age) / 0.18 : 1);
    if (pop <= 0.02 || t < t0) continue;
    const kind = (n + i) % 2, side = 0.2 + 0.35 * age + 0.06 * Math.sin(age * 9 + n);
    out.fx.push({ key: `note${kind}`, cw: 220, ch: 260, draw: (p) => fxNote(p, kind), x: at[0] + side * (i % 2 ? 1 : -1), y: at[1] + 0.85 * age, z: at[2] - 0.1,
      w: 0.24 * pop, h: 0.28 * pop, rot: 0.3 * Math.sin(age * 6 + n) });
  }
};

// ---------------- per-scene staging ----------------
/** Troffea's dance in the lane: she walks out of the door at STEP_OUT, starts at DANCE0, gets wilder over the first second */
const troffeaLane = (cam: CamInfo, t: number, out: Stage, eK = 1, expr: Expr = "neutral") => {
  const [x, , z] = TROFF_LANE, w = who(900, TROFFEA, "troff");
  if (t < STEP_OUT) { stand(cam, t, out, w, DOOR[0], 0, DOOR[2] - 0.12, { expr: "neutral" }); return; }
  if (t < DANCE0) {
    const u = smooth((t - STEP_OUT) / (DANCE0 - STEP_OUT - 0.1)), zz = DOOR[2] - 0.12 + (z - DOOR[2] + 0.12) * u;
    out.places.push(person(cam, w, x, 0, zz, FRONT, { mode: "stroll", phase: qp((t - STEP_OUT) * 1.4, 12), expr: "neutral", blink: lidAt(t, 900) }, {}));
    blob(out, x, 0, zz); return;
  }
  const d: Dancer = { i: 900, x, z, hz: 1.15, ph0: 0.25 - 1.15 * DANCE0, e: 1, spin: false, expr };
  putDancer(cam, t, out, d, w, { eK: eK * (0.35 + 0.65 * smooth((t - DANCE0) / 1.0)) });
};

const sceneStage = (id: number, scene: Scene, t: number, cam: CamInfo, out: Stage) => {
  switch (scene) {
    case "square": {
      // the hook's worn-out dancer in front of the lens; everyone else dances on
      if (id === 1) putDancer(cam, t, out, { i: 901, x: 0.2, z: -6.3, hz: 0.9, ph0: 0.1, e: 0.6, spin: false, expr: "tired" }, who(901, man(3), "hook"),
        { expr: exprAt(t, "tired", [[W(117), W(140), "pained"]]) });
      crowd(id, cam, t, out, SQUARE_CROWD);
      break;
    }
    case "aerial": strollers(id, cam, t, out, 60); break;
    case "bread": {
      const [kx, , kz] = STALL;
      stand(cam, t, out, who(910, BAKER, "baker"), kx - 0.6, 0, kz - 0.75, { expr: exprAt(t, "smile", [[W(281), 99, "smile_closed"]]), prop: "loaf" }, 1, false);
      const shock = t >= W(281) - LEAD;
      stand(cam, t, out, who(911, woman(2), "cust"), kx + 1.2, 0, kz + 1.0, { expr: shock ? "shock" : "neutral", look: -1 });
      stand(cam, t, out, who(912, man(1), "cust2"), kx - 1.9, 0, kz + 1.1, { expr: shock ? "worried" : "neutral", look: 1 });
      if (shock) {
        const u = clamp01((t - W(281)) / 0.9);
        if (u < 1) out.fx.push({ key: `coins${q(u, 30)}`, cw: 300, ch: 300, draw: (p) => fxCoins(p, q(u, 30)), x: kx + 0.6, y: 1.0, z: kz + 0.75, w: 0.6, h: 0.6 });
      }
      strollers(id, cam, t, out, 20);
      break;
    }
    case "tired": {
      ([[-7.25, -15.4, 0], [-6.55, -15.75, 1], [-5.85, -15.35, 4]] as const).forEach(([x, z, v], k) =>
        stand(cam, t, out, folk(920 + v), x, 0, z, { expr: k === 1 ? "tired" : "dazed", tilt: (k - 1) * 5, headTilt: 8 * (k % 2 ? -1 : 1), blink: Math.max(0.5, lidAt(t, 920 + k)) }));
      break;
    }
    case "door": troffeaLane(cam, t, out); break;
    case "lane": troffeaLane(cam, t, out, 1, "neutral"); break;
    case "husband": {
      troffeaLane(cam, t, out, 0.9, "neutral");
      stand(cam, t, out, who(930, HUSBAND, "hus"), -43.75, 0, 0.7, { expr: exprAt(t, "worried", [[W(560), 99, "nervous"]]), prop: "plead", look: 1 });
      break;
    }
    case "days": {
      troffeaLane(cam, t, out, id === 10 ? 0.7 : 0.9, id === 10 ? "tired" : "neutral");
      const asleep = id === 10;
      sit(cam, t, out, who(930, HUSBAND, "hus"), -43.4, 0.2, 3.1, { expr: asleep ? "tired" : "worried", blink: asleep ? 1 : lidAt(t, 930), headTilt: asleep ? 12 : 0, look: 1 });
      if (asleep) { const u = q((t * 0.8) % 1, 30); out.fx.push({ key: `zzz${u}`, cw: 300, ch: 300, draw: (p) => fxZzz(p, u), x: -43.1, y: 1.55, z: 3.0, w: 0.6, h: 0.6 }); }
      break;
    }
    case "lane30": {
      troffeaLane(cam, t, out, 0.9, "neutral");
      const n = t < W(672) ? 0 : 30;
      crowd(id, cam, t, out, LANE_CROWD.slice(0, n));
      break;
    }
    case "hop": crowd(id, cam, t, out, SQUARE_CROWD, { eK: 1.4, sweat: t > W(814) }); break;
    case "doctors": {
      const D1: V3 = [-6.1, 0, -5.45], D2: V3 = [-5.2, 0, -4.8];
      const e1 = exprAt(t, "neutral", [[W(885), W(941), "stern"], [W(941), W(1000), "smile_closed"], [W(1000), W(1035), "neutral"], [W(1035), 99, "grin"]]);
      const e2 = exprAt(t, "stern", [[W(941), W(1000), "smile_closed"], [W(1000), 99, "neutral"]]);
      const flask = t >= W(880) - LEAD && t < W(972) - LEAD;
      stand(cam, t, out, who(940, DOCTOR, "doc"), ...D1, { expr: e1, prop: flask ? "flask" : null, wave: !flask && t >= W(972) - LEAD ? 0 : undefined, facing: 1, look: flask ? 0 : 1 });
      stand(cam, t, out, who(941, DOCTOR2, "doc2"), ...D2, { expr: e2, facing: -1, look: -1 });
      const more = id === 15 && t >= W(1038) - LEAD;
      putDancer(cam, t, out, { i: 942, x: -6.9, z: -3.7, hz: 1.0, ph0: 0.3, e: 0.7, spin: false, expr: "pained" }, folk(942), { eK: more ? 1.45 : 1 });
      crowd(id, cam, t, out, SQUARE_CROWD, { eK: more ? 1.45 : 1, skip: (d) => Math.hypot(d.x - D1[0], d.z - D1[2]) < 2.4 || Math.hypot(d.x - D2[0], d.z - D2[2]) < 2.2 });
      break;
    }
    case "hall": {
      stand(cam, t, out, who(950, COUNCIL, "coun"), 22.3, 0, -7.6, { expr: "stern", reach: 1, facing: 1 });
      stand(cam, t, out, who(951, COUNCIL2, "coun2"), 22.0, 0, -4.2, { expr: exprAt(t, "neutral", [[W(1094), 99, "stern"]]), facing: 1 });
      strollers(id, cam, t, out, 12);
      break;
    }
    case "stage": {
      const hits = [37.3, 37.75, 38.2, 38.65, 39.1, 39.55, 40.0, 40.45].map((h) => h - 0.1);
      stand(cam, t, out, who(960, CARPENTER, "carp"), 8.6, STAGE_H, 9.4, { expr: "stern", prop: ["hammer", q(hammerK(t, hits), 30)], facing: 1 }, 1, true);
      stand(cam, t, out, who(961, man(4), "carp2"), 11.6, STAGE_H, 10.1, { expr: "neutral", reach: 2 }, 1, true);
      burst(t, hits, out, [9.15, STAGE_H + 0.35, 9.2], 0.6);
      crowd(id, cam, t, out, SQUARE_CROWD, { skip: (d) => d.z > 5, clearR: 4.5 });
      break;
    }
    case "band": {
      const drumK = q(Math.abs(Math.sin(Math.PI * 2 * 1.2 * t)) ** 2, 12);
      stand(cam, t, out, who(970, PIPER, "piper"), 9.4, STAGE_H, 9.2, { expr: "whistle", prop: "pipe" }, 1, true);
      stand(cam, t, out, who(971, DRUMMER, "drum"), 10.75, STAGE_H, 9.3, { expr: "grin", prop: ["drum", 1 - drumK] }, 1, true);
      notes(t, out, [9.4, STAGE_H + 2.2, 9.1], 1, W(1160));
      notes(t, out, [10.75, STAGE_H + 2.0, 9.2], 2, W(1185));
      crowd(id, cam, t, out, SQUARE_CROWD, { skip: (d) => d.z > 6 });
      break;
    }
    case "strong": {
      const lift = smooth((t - W(1245)) / 0.4) * 0.32;
      putDancer(cam, t, out, { i: 980, x: -8.8, z: -1.6, hz: 0.8, ph0: 0.1, e: 0.4, spin: false, expr: "dazed" }, folk(3), { y: lift, eK: 1 });
      stand(cam, t, out, who(981, STRONG, "str"), -8.15, 0, -1.45, { expr: "stern", reach: 1, facing: -1 });
      stand(cam, t, out, who(982, STRONG2, "str2"), -9.45, 0, -1.5, { expr: "stern", reach: -1, facing: 1 });
      crowd(id, cam, t, out, SQUARE_CROWD, { skip: (d) => Math.hypot(d.x + 8.8, d.z + 1.6) < 2.0 });
      break;
    }
    case "collapse": {
      const FALL: [number, number, number][] = [[0.6, -6.2, 0], [-0.9, -5.4, 1], [2.1, -5.0, 2]];
      FALL.forEach(([x, z, k]) => {
        const tc = COLLAPSE[k], w = folk(990 + k);
        if (t < tc - 0.12) { putDancer(cam, t, out, { i: 990 + k, x, z, hz: 0.85, ph0: k * 0.3, e: 0.5, spin: false, expr: "tired" }, w); return; }
        const u = clamp01((t - tc + 0.12) / 0.25), side = k % 2 ? 1 : -1;
        out.places.push({ ...person(cam, w, x, 0.32 * u, z, FRONT, { mode: "fall", expr: "dazed", blink: 0 }, {}), roll: side * 1.45 * u });
        blob(out, x + side * 0.5 * u, 0, z, 1.2, 0.8);
        if (u >= 1) { const s = (t * 0.9 + k * 0.3) % 1; out.fx.push({ key: `stars${q(s, 30)}`, cw: 420, ch: 210, draw: (p) => fxStars(p, q(s, 30)), x: x + side * 0.95, y: 0.95, z, w: 0.7, h: 0.35 }); }
      });
      crowd(id, cam, t, out, SQUARE_CROWD, { eK: 0.75, skip: (d) => FALL.some(([x, z]) => Math.hypot(d.x - x, d.z - z) < 1.3) });
      break;
    }
    case "yawnrow": {
      const y0 = W(1406);
      [5.4, 6.8, 8.2, 9.6, 11.0].forEach((x, k) => {
        const ty = y0 + [1.2, 0.6, 0, 0.6, 1.2][k] + (k > 2 ? 0.15 : 0);
        const yawn = t >= ty - LEAD && t < ty + 1.2;
        const look = t < y0 ? 0 : k < 2 ? 1 : k > 2 ? -1 : 0;
        sit(cam, t, out, folk(1000 + k), x, 0.45, BENCH[2] + 0.1, { expr: yawn ? "yawn" : t > ty + 1.2 ? "tired" : "neutral", look: yawn ? 0 : look });
      });
      break;
    }
    case "yawncu": {
      const ya = W(1453), yb = W(1488);
      const ea = t >= ya - LEAD && t < ya + 1.3 ? "yawn" : t > ya + 1.3 ? "tired" : "neutral";
      const eb = t >= yb - LEAD && t < yb + 1.4 ? "yawn" : t > ya - LEAD ? "worried" : "neutral";
      sit(cam, t, out, folk(1002), 8.25, 0.45, BENCH[2] + 0.1, { expr: ea, look: t > yb ? 1 : 0 });
      sit(cam, t, out, folk(1003), 9.05, 0.45, BENCH[2] + 0.1, { expr: eb, look: t > ya && t < yb ? -1 : 0 });
      break;
    }
    case "fear": {
      [[-2.6, 14.8], [-1.6, 14.5], [-0.6, 14.9], [0.6, 14.4], [1.8, 14.7], [2.9, 14.9], [-0.1, 15.9], [1.2, 16.0], [-1.9, 16.1]].forEach(([x, z], k) => {
        const bowl = x === 1.8;
        stand(cam, t, out, folk(1010 + k), x, 0, z, { expr: bowl && t > W(1536) ? "pained" : k % 2 ? "worried" : "nervous", look: k % 3 - 1, prop: bowl ? "bowl" : null });
      });
      const u = (t * 0.6) % 1;
      out.fx.push({ key: "darkcloud", cw: 600, ch: 300, draw: fxDarkCloud, x: -0.6 + 0.3 * Math.sin(t), y: 4.6, z: 16.4, w: 4.2, h: 2.1 });
      if (t > W(1538) - LEAD) creakFx(t, [[2.15, 0.95, 14.5], [1.45, 1.05, 14.5]], out, 0.35);
      void u;
      break;
    }
    case "vitus": {
      stand(cam, t, out, who(1020, STONE, "vitus"), STATUE[0], STATUE_H, STATUE[2], { expr: "stern", wave: 0 }, 1.05, false);
      out.fx.push({ key: "halo", cw: 300, ch: 300, draw: fxHalo, x: STATUE[0], y: STATUE_H + 1.78, z: STATUE[2] + 0.15, w: 0.85, h: 0.85 });
      const cursed = t >= W(1616) - LEAD;
      putDancer(cam, t, out, { i: 1021, x: -11.75, z: 9.8, hz: 1.1, ph0: 0.2, e: 0.9, spin: false, expr: "shock" }, folk(1021), { eK: cursed ? 1 : 0.01, expr: cursed ? "shock" : "worried" });
      crowd(id, cam, t, out, SQUARE_CROWD, { skip: (d) => Math.hypot(d.x - STATUE[0], d.z - STATUE[2]) < 3.5 || !cursed });
      break;
    }
    case "spread": {
      putDancer(cam, t, out, { i: 1030, x: TROFF_SQ[0], z: TROFF_SQ[2], hz: 1.1, ph0: 0.1, e: 0.9, spin: false, expr: "neutral" }, who(900, TROFFEA, "troff"));
      crowd(id, cam, t, out, SQUARE_CROWD, { skip: (d) => t < W(1695) && Math.hypot(d.x - TROFF_SQ[0], d.z - TROFF_SQ[2]) < 4.5 });
      break;
    }
    case "ban": {
      stand(cam, t, out, who(950, COUNCIL, "coun"), SIGN_AT[0] + 0.85, 0, SIGN_AT[2] - 0.15, { expr: "stern", prop: ["hammer", q(hammerK(t, HITS), 30)], facing: -1 });
      stand(cam, t, out, who(970, PIPER, "piper"), SIGN_AT[0] - 1.2, 0, SIGN_AT[2] + 0.4, { expr: exprAt(t, "neutral", [[W(1797), 99, "worried"]]), look: 1 });
      burst(t, HITS, out, [SIGN_AT[0] + 0.25, 1.75, SIGN_AT[2] - 0.12], 0.8);
      crowd(id, cam, t, out, SQUARE_CROWD, { eK: t > W(1797) ? 0.25 : 0.8 });
      break;
    }
    case "wagon": {
      const x = wagonX(t), bump = 0.035 * Math.abs(Math.sin(t * 7.5));
      const ph = q((t * 1.4) % 1, 12);
      out.fx.push({ key: `horse${ph}`, cw: 900, ch: 640, draw: (p) => fxHorse(p, ph), x: x + 3.4, y: 0.92, z: ROAD_Z + 0.05, w: -2.6, h: 1.85 });
      sit(cam, t, out, who(1040, DRIVER, "driver"), x + 1.85, 1.05 + bump, ROAD_Z - 0.1, { expr: "neutral" });
      [[0.6, -0.35, 900], [-0.5, 0.25, 1041], [-1.3, -0.3, 1042], [0.0, 0.45, 1043]].forEach(([dx, dz, i], k) => {
        const w = i === 900 ? who(900, TROFFEA, "troff") : folk(i);
        sit(cam, t, out, w, x + dx, 1.05 + bump * (k % 2 ? 1 : 0.6), ROAD_Z + dz, { expr: k % 2 ? "dazed" : "tired", headTilt: k % 2 ? 6 : -4 });
      });
      blob(out, x, 0, ROAD_Z, 2.4, 0.9);
      break;
    }
    case "shrine": {
      stand(cam, t, out, who(1050, PRIEST, "priest"), 256.4, 0, -59.0, { expr: "smile", wave: 0 });
      for (let k = 0; k < 3; k++) {
        const x = 243 + k * 1.4 + (t - 62.8) * 0.9, z = -61.5 + k * 1.1;
        out.places.push(person(cam, k === 0 ? who(900, TROFFEA, "troff") : folk(1041 + k), x, 0, z, FRONT, { mode: "stroll", phase: qp(t * 0.65 + k * 0.3, 8), expr: "tired", blink: lidAt(t, 1060 + k) }, {}));
        blob(out, x, 0, z);
      }
      break;
    }
    case "shoes": {
      const onFeet = t >= W(2017) - LEAD;
      stand(cam, t, out, who(1050, PRIEST, "priest"), 255.5, 0, -59.6, { expr: onFeet ? "smile_closed" : "smile", prop: onFeet ? null : "shoes", facing: -1 });
      const tap = t > W(2040) && t < W(2058);
      const w = onFeet ? who(900, TROFFEA_RED, "troffR") : who(900, TROFFEA, "troff");
      if (tap) putDancer(cam, t, out, { i: 900, x: 254.9, z: -60.9, hz: 1.6, ph0: -1.6 * W(2040), e: 0.35, spin: false, expr: "smile_closed" }, w);
      else stand(cam, t, out, w, 254.9, 0, -60.9, { expr: exprAt(t, "tired", [[W(1994), W(2017), "worried"], [W(2017), 99, "smile_closed"]]), look: onFeet ? 0 : 1, facing: 1 });
      break;
    }
  }
};

/** everything with a face in shot `id` at time t */
export const stage = (id: number, t: number, cam: CamInfo): Stage => {
  const out: Stage = { places: [], fx: [] };
  const s = SHOTS[id - 1];
  LNAME = s.light;
  findSun(cam, SUN);
  sceneStage(id, s.scene, t, cam, out);
  return out;
};

export const creakFx = (t: number, pts: V3[], out: Stage, size = 0.8) =>
  pts.forEach(([x, y, z], i) => {
    const u = q((t * 1.3 + i * 0.37) % 1, 30);
    out.fx.push({ key: `creak${u}`, cw: 300, ch: 300, draw: (p) => fxCreak(p, u), x, y, z, w: size, h: size, rot: i * 0.6 - 0.6 });
  });
export { FPS, bodySide, fxShadow, fxContact };
export type { SideOpts };
