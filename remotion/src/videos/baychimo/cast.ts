// Our cast as lit flat sprites in the 3D world. Each frame every character asks for a drawing (a key + a draw call);
// the pool keeps one canvas per distinct drawing, so soldiers marching in step share canvases (7 head shapes x 4
// outfits). Characters are yaw-only billboards shaded by cardShade() (scene tint, bright floor, side gradient toward
// the sun, painted crescent in the drawing); standing ones get a soft multiply contact blob. Effects are unlit cards.
// Cards, effects and blobs live on the NOINK layer so the world ink pass never outlines their quads.
import * as THREE from "three";
import {
  Pen, bodyFront, bodySide, fxBurst, fxStars, fxPuff, fxShadow, fxContact, fxDog, sailor, CAPTAIN, SALVAGER, hunter, SLEDDER, modern, traveller,
  Outfit, Expr, FrontOpts, SideOpts, INK,
} from "./toon";
import { FPS, SHOTS, V3, smooth, clamp01, lin, Pack, Ship, Env, packPt, DECK, ICE_Y, HUT, AIR, LAND_Y, F_STUCK, F_SHOVE } from "./story";
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
  scale?: number; mirror?: boolean; yaw?: number; roll?: number; size?: [number, number, number];
};
export type FxPlace = { key: string; cw: number; ch: number; draw: (p: Pen) => void; x: number; y: number; z: number; w: number; h: number; flat?: boolean; rot?: number; soft?: boolean;
  yaw?: number; mirror?: boolean };
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

// ---------------- the Baychimo cast by shot ----------------
export type Stage = { places: Place[]; fx: FxPlace[] };
const CREW = [0, 1, 2, 3, 4, 5, 6, 7].map((v) => sailor(v));
const HUNTERS = [0, 1, 2, 3].map((v) => hunter(v));
const PARTY = [0, 1, 2, 3].map((v) => modern(v));
const TRAV = [0, 1, 2, 3, 4, 5].map((v) => traveller(v));
const crewWho = (i: number): Who => ({ i, o: CREW[i % 8], okey: `c${i % 8}` });
/** walking (front/side view chosen by the camera) along (dx, dz) at speed sp m/s from p0 at t0 */
const walker = (out: Stage, cam: CamInfo, who: Who, t: number, p0: V3, dx: number, dz: number, sp: number, t0: number, expr: Expr, prop: FrontOpts["prop"] = null, y?: number) => {
  const dl = Math.hypot(dx, dz) || 1, ux = dx / dl, uz = dz / dl, tt = Math.max(0, t - t0);
  const x = p0[0] + ux * sp * tt, z = p0[2] + uz * sp * tt, yy = y ?? p0[1];
  const phase = q(((tt * sp) / 1.4 + hh(who.i, 5)) % 1, 120);
  const view = viewOf(cam, x, z, ux, uz);
  const blink = lidAt(t, who.i);
  const fo: FrontOpts = { mode: "stroll", phase, expr, blink, prop, lift: 40 };
  const so: SideOpts = { mode: "march", phase, expr, blink, stomp: 0.55, stride: 0.875 * view.fs };
  out.places.push(person(cam, who, x, yy, z, prop === "bale" ? { side: false, mirror: false } : view, fo, so));
  blob(out, x, yy, z);
};
const stander = (out: Stage, cam: CamInfo, who: Who, t: number, x: number, y: number, z: number, expr: Expr, extra: Partial<FrontOpts> = {}, scale = 1) => {
  const fo: FrontOpts = { mode: "stand", expr, blink: lidAt(t, who.i), ...extra };
  out.places.push(person(cam, who, x, y, z, { side: false, mirror: false }, fo, {}, scale));
  blob(out, x, y, z, scale);
};
/** a pointing / waving arm (the front view's wave pose held up) */
const point = (t: number, i: number, k = 1) => q(0.6 + 0.4 * k * Math.sin(t * 2.2 + i) * 0, 30);
const wave = (t: number, i: number) => q(Math.sin(t * 9 + i * 1.3), 30);
const at = (t: number, f: number) => t >= (f - 2) / FPS; // reactions land 0-2 f before the word
const onShip = (P: Pack, S: Ship, l: V3): V3 => packPt(P, [l[0] + S.x, l[1] + S.y, l[2] + S.z]);

const seal = (p: Pen, pop: number) => {
  const y = 300 - 210 * pop;
  p.ell(150, y + 90, 70, 95, "#6b6f7a", 9);
  p.ell(150, y + 10, 62, 56, "#7a7f8b", 9);
  p.dot(128, y, 8); p.dot(172, y, 8);
  p.ell(150, y + 24, 14, 9, "#2a2a30", 0);
  for (const s of [-1, 1]) for (const k of [0, 1]) p.stroke([[150 + s * 16, y + 30 + k * 7], [150 + s * 52, y + 24 + k * 12]], 2.5, INK);
};
const hole = (p: Pen) => { p.ell(150, 75, 140, 58, "#1e3550", 0); p.ell(150, 70, 128, 48, "#2a4a6a", 0); };
const DOGS: V3[] = [[2.4, 0, -0.45], [2.4, 0, 0.45], [3.7, 0, -0.45], [3.7, 0, 0.45], [5.0, 0, -0.4], [5.0, 0, 0.4]];
const dogTeam = (out: Stage, cam: CamInfo, t: number, base: V3, yaw: number, run: boolean) => {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  DOGS.forEach(([dx, , dz], i) => {
    const x = base[0] + c * dx + s * dz, z = base[2] - s * dx + c * dz;
    const ph = run ? q((t * 2.2 + i * 0.27) % 1, 24) : q((0.06 * Math.sin(t * 6 + i)) + 0.5, 24);
    const mirror = c * cam.right.x - s * cam.right.z < 0;
    const col = ["#8f8a84", "#5a524c", "#c9c0b4", "#8f8a84", "#3a3634", "#b9ab98"][i];
    out.fx.push({ key: `dog${ph}${col}`, cw: 400, ch: 300, draw: (p) => fxDog(p, ph, col), x, y: base[1] + 0.393 * 0.79, z, w: 1.05, h: 0.79, mirror });
    blob(out, x, base[1], z, 0.8);
  });
};

/** everything with a face in shot `id` at time t (P = pack frame, S = ship pose, E = environment) */
export const stage = (id: number, t: number, cam: CamInfo, P: Pack, S: Ship, E: Env): Stage => {
  const out: Stage = { places: [], fx: [] };
  const s = SHOTS[id - 1];
  LNAME = s.light;
  findSun(cam, SUN);
  const f = t * FPS;
  switch (id) {
    case 1: { // the crew walk away from the frozen ship, toward the lens
      for (let i = 0; i < 11; i++) {
        const x = -4 + (i % 6) * 2.0 + hh(i) * 1.0, z = 36 + Math.floor(i / 6) * 4 + hh(i, 2) * 2.5;
        walker(out, cam, crewWho(i), t, [x, ICE_Y, z], hh(i, 3) * 0.3 - 0.15, 1, 1.05 + hh(i, 4) * 0.25, 0, i % 3 ? "stern" : "neutral", i % 3 === 1 ? "bale" : null);
      }
      break;
    }
    case 2: { // on deck in open water; the insert sees a sailor lifting furs out of the hatch
      const b = onShip(P, S, [1.6, DECK, 11.4]);
      stander(out, cam, crewWho(2), t, b[0], b[1], b[2], "neutral", { prop: "bale" });
      const c = onShip(P, S, [-2.0, DECK, 4.9]); stander(out, cam, crewWho(5), t, c[0], c[1], c[2], "smile");
      const d = onShip(P, S, [2.8, DECK, -10]); stander(out, cam, crewWho(1), t, d[0], d[1], d[2], "neutral");
      break;
    }
    case 3: { // the sailor at the bow rail watching the ice close in
      const e: Expr = at(t, F_STUCK) ? "shock" : at(t, 355) ? "nervous" : "neutral";
      const a = onShip(P, S, [3.6, DECK, 5.2]); stander(out, cam, crewWho(3), t, a[0], a[1], a[2], e, { look: 1 });
      const b = onShip(P, S, [1.2, DECK, 7.8]); stander(out, cam, crewWho(6), t, b[0], b[1], b[2], at(t, F_STUCK) ? "shock" : "neutral");
      break;
    }
    case 4: {
      if (t < 454 / FPS) { // waving the plane goodbye
        for (let i = 0; i < 9; i++) stander(out, cam, crewWho(i), t, -6 + i * 1.5 + hh(i) * 0.5, ICE_Y, -12 + hh(i, 2) * 3.5, i % 3 ? "smile" : "grin", { wave: i % 2 ? wave(t, i) : undefined });
      } else { // building the hut: a hammerer, a carrier, the captain supervising
        const k = (t * 1.9) % 1, hit = q(k < 0.5 ? 0 : smooth((k - 0.5) / 0.18), 30);
        stander(out, cam, crewWho(1), t, HUT[0] + 3.3, LAND_Y, HUT[2] + 2.6, "stern", { prop: ["hammer", hit], facing: -1 });
        if (k > 0.66 && k < 0.8) out.fx.push({ key: `burst${q((k - 0.66) / 0.14, 30)}`, cw: 500, ch: 500, draw: (p) => fxBurst(p, q((k - 0.66) / 0.14, 30)), x: HUT[0] + 2.7, y: LAND_Y + 1.3, z: HUT[2] + 2.2, w: 0.7, h: 0.7 });
        walker(out, cam, crewWho(4), t, [HUT[0] + 9, LAND_Y, HUT[2] + 3.5], -1, 0.1, 0.9, 454 / FPS, "neutral", "bale");
        stander(out, cam, { i: 90, o: CAPTAIN, okey: "capt" }, t, HUT[0] - 3.2, LAND_Y, HUT[2] + 3.4, "smile");
        stander(out, cam, crewWho(6), t, HUT[0] - 1.2, LAND_Y, HUT[2] + 2.8, "neutral");
      }
      break;
    }
    case 5: {
      if (t < 620 / FPS) { // looking out to sea from the hut (to the sides of the frame)
        for (const [i, dx, dz] of [[0, -5.5, 3], [1, -4.2, 5.5], [2, 6.5, 4], [3, 8, 2.5]] as const) stander(out, cam, crewWho(i), t, HUT[0] + dx, LAND_Y, HUT[2] + dz, "neutral");
      } else {
        const ex: Expr[] = ["shock", "shock", "nervous", "shock"];
        [[3.5, 4.0], [2.3, 3.4], [4.7, 3.2], [1.4, 2.2]].forEach(([dx, dz], i) => stander(out, cam, crewWho(i), t, HUT[0] + dx, LAND_Y, HUT[2] + dz, ex[i]));
      }
      break;
    }
    case 6: { // the captain decides she sank: solemn
      stander(out, cam, { i: 90, o: CAPTAIN, okey: "capt" }, t, HUT[0] + 3.4, LAND_Y, HUT[2] + 5.2, at(t, 686) ? "pained" : "stern");
      [[1.9, 3.6], [5.0, 3.8], [2.8, 2.4]].forEach(([dx, dz], i) => stander(out, cam, crewWho(i + 2), t, HUT[0] + dx, LAND_Y, HUT[2] + dz, at(t, 686) ? "pained" : "nervous"));
      break;
    }
    case 7: { // the seal hunter
      const H: V3 = [140, ICE_Y, -40];
      out.fx.push({ key: "hole", cw: 300, ch: 150, draw: hole, x: H[0], y: ICE_Y + 0.02, z: H[2], w: 1.3, h: 0.65, flat: true });
      const pop = q(smooth((f - 748) / 8) * (1 - smooth((f - 790) / 8)), 20);
      if (pop > 0) out.fx.push({ key: `seal${pop}`, cw: 300, ch: 400, draw: (p) => seal(p, pop), x: H[0], y: ICE_Y + 0.3, z: H[2] + 0.05, w: 0.6, h: 0.8 });
      const pt = at(t, 771);
      stander(out, cam, { i: 60, o: HUNTERS[0], okey: "h0" }, t, H[0] + 0.9, ICE_Y, H[2] + 0.5, pt ? "grin" : at(t, 752) ? "smile" : "neutral", { wave: pt ? point(t, 1) : undefined, look: pt ? 1 : 0 });
      break;
    }
    case 8: { // deadpan at the hut
      [[2.5, 4.4], [1.2, 3.7], [3.8, 3.8], [0.4, 2.8], [4.8, 3.0]].forEach(([dx, dz], i) =>
        stander(out, cam, i === 0 ? { i: 90, o: CAPTAIN, okey: "capt" } : crewWho(i), t, HUT[0] + dx, LAND_Y, HUT[2] + dz, i === 0 ? "stern" : "neutral"));
      break;
    }
    case 9: {
      if (t < 905 / FPS) { // the party sets out across the ice toward her
        for (let i = 0; i < 6; i++) walker(out, cam, crewWho(i), t, [9 + (i % 3) * 1.3, ICE_Y, -37.5 - Math.floor(i / 3) * 2.2], -0.25, 1, 1.25, 876 / FPS, "stern");
      } else if (t < 953 / FPS) { // carrying the furs off down the ladder side
        for (let i = 0; i < 4; i++) walker(out, cam, crewWho(i), t, [6.0 + i * 0.4, ICE_Y, -3.2 - i * 1.6], 1, -0.35, 0.9, 905 / FPS - i * 0.6, "neutral", "bale");
        const d = onShip(P, S, [3.6, DECK, -4.4]); stander(out, cam, crewWho(5), t, d[0], d[1], d[2], "neutral", { prop: "bale" });
      } else { // and leave her for good
        for (let i = 0; i < 6; i++) walker(out, cam, crewWho(i), t, [-1 + (i % 3) * 1.6, ICE_Y, -16 - Math.floor(i / 3) * 2], 0, -1, 1.1, 953 / FPS, i % 2 ? "stern" : "neutral", i % 2 ? "bale" : null);
      }
      break;
    }
    case 10: { // golden wide: tiny figures heading home
      for (let i = 0; i < 6; i++) walker(out, cam, crewWho(i), t, [-12 + (i % 3) * 1.4, ICE_Y, -30 - Math.floor(i / 3) * 1.8], -0.4, -1, 1.1, 977 / FPS, "neutral", i % 2 ? "bale" : null);
      break;
    }
    case 11: { // 1932: the dog sled, she drifts past
      const B: V3 = [30, ICE_Y, -110];
      dogTeam(out, cam, t, B, 0, false);
      const e: Expr = at(t, 1091) ? "shock" : at(t, 1060) ? "nervous" : "neutral";
      stander(out, cam, { i: 70, o: SLEDDER, okey: "sledder" }, t, B[0] - 1.9, B[1], B[2] + 0.1, e, { look: 1 });
      break;
    }
    case 12: { // 1933: hunters climb aboard in the storm
      for (let i = 0; i < 3; i++) {
        const k = clamp01((f - 1122 - i * 24) / 46), lad = onShip(P, S, [5.05 + 0.2 * (1 - k), ICE_Y + k * (DECK + 0.6 - ICE_Y), -4]);
        if (f > 1122 + i * 24 + 52) continue; // inside
        if (k <= 0) stander(out, cam, { i: 61 + i, o: HUNTERS[i + 1], okey: `h${i + 1}` }, t, lad[0] + 1.4 + i * 1.1, ICE_Y, lad[2] - 1.2 - i * 0.9, "neutral");
        else out.places.push(person(cam, { i: 61 + i, o: HUNTERS[i + 1], okey: `h${i + 1}` }, lad[0] + 0.25, lad[1] - 0.3, lad[2] + 0.1, { side: false, mirror: false }, { mode: "stand", expr: "stern", blink: 0, wave: 0.9 }, {}));
      }
      break;
    }
    case 13: { // 1939: the salvager claims her, the ice shoves him off
      const fall = f >= F_SHOVE + 1;
      const rail = onShip(P, S, [3.7, DECK, -6]);
      if (!fall) stander(out, cam, { i: 80, o: SALVAGER, okey: "salv" }, t, rail[0], rail[1], rail[2], at(t, 1291) ? "grin" : "smile", { wave: at(t, 1260) ? 0.8 : undefined });
      else {
        const u = clamp01((f - F_SHOVE - 1) / 16), land: V3 = [12.8, ICE_Y, -9.6];
        const x = rail[0] + (land[0] - rail[0]) * u, z = rail[2] + (land[2] - rail[2]) * u, y = rail[1] + (land[1] - rail[1]) * u + 3.2 * u * (1 - u);
        if (u < 1) out.places.push(person(cam, { i: 80, o: SALVAGER, okey: "salv" }, x, y, z, { side: false, mirror: false }, { mode: "fall", expr: "shock", tilt: q(-40 - 220 * u, 4), blink: 0 }, {}));
        else {
          out.places.push(person(cam, { i: 80, o: SALVAGER, okey: "salv" }, land[0], ICE_Y - 0.05, land[2], { side: false, mirror: false }, { mode: "sit", expr: "dazed", blink: 0 }, {}));
          blob(out, land[0], ICE_Y, land[2], 1.1);
          const su = q((t * 0.9) % 1, 30);
          out.fx.push({ key: `stars${su}`, cw: 420, ch: 210, draw: (p) => fxStars(p, su), x: land[0], y: ICE_Y + 1.35, z: land[2], w: 0.75, h: 0.375 });
          const pu = (f - F_SHOVE - 17) / 14;
          if (pu >= 0 && pu < 1) out.fx.push({ key: `puff${q(pu, 30)}`, cw: 400, ch: 400, draw: (p) => fxPuff(p, q(pu, 30)), x: land[0], y: ICE_Y + 0.5, z: land[2] + 0.2, w: 2.6, h: 2.6, soft: true });
        }
      }
      break;
    }
    case 15: { // the airport: bored travellers, nobody picks it up
      const spots: [number, number, Expr][] = [[-4.8, -3.3, "neutral"], [-1.6, 3.4, "stern"], [2.6, -3.5, "neutral"], [4.0, 3.3, "smile_closed"], [-6.0, 0.4, "neutral"], [6.1, 0.8, "stern"]];
      spots.forEach(([x, z, e], i) => stander(out, cam, { i: 100 + i, o: TRAV[i], okey: `t${i}` }, t, AIR[0] + x, 0, AIR[2] + z, e, { prop: i === 2 ? "suitcase" : null, look: i % 2 ? 1 : -1 }));
      break;
    }
    case 17: { // spotted again and again
      if (t < 1734 / FPS) { dogTeam(out, cam, t, [62, ICE_Y, 44], 0.5, false); stander(out, cam, { i: 70, o: SLEDDER, okey: "sledder" }, t, 61.2, ICE_Y, 45.2, "shock", { wave: 0.9 }); }
      else if (t < 1746 / FPS) for (let i = 0; i < 2; i++) stander(out, cam, { i: 62 + i, o: HUNTERS[i + 2], okey: `h${i + 2}` }, t, 124.2 - i * 1.4, ICE_Y, 101.6 + i * 0.5, i ? "shock" : "grin", { wave: i ? undefined : 0.8 });
      break;
    }
    case 18: { // 1969: the expedition in orange
      [[-9, -26], [-7.4, -27.2], [-5.6, -25.6], [-4.0, -27.8]].forEach(([x, z], i) =>
        stander(out, cam, { i: 120 + i, o: PARTY[i], okey: `m${i}` }, t, x, ICE_Y, z, at(t, 1781) ? (i % 2 ? "shock" : "grin") : "neutral", { wave: i === 1 && at(t, 1781) ? 0.85 : undefined }));
      break;
    }
  }
  void E; void lin; void F_SHOVE;
  return out;
};
export { FPS };
