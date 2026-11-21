// Our cast for the zombie short as lit flat sprites in the 3D world (the bridge short's card machinery: canvas pool,
// cardShade() billboards with contact blobs, unlit effect cards, all on the NOINK layer). stage(id, t) says who
// stands where in each shot, with which face, timed to the voice words.
import * as THREE from "three";
import { Pen, bodyFront, Outfit, Expr, FrontOpts, SideOpts, bodySide, INK, SKINS, fxBurst, fxPuff, fxStars, fxContact, fxShadow } from "./toon";
import { chicken, satellite, backpack, item, comic, wind, rain, glow, smoke, aura, leaves } from "./zdraw";
import { FPS, SHOTS, V3, smooth, clamp01, FIELD, CDC, OFFICE, WAR, CAMP, BASE, BASE_Z, FLOOR2, SAT_LAND, SAT_T, CRASH_T } from "./story";
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

// ---------------- our cast ----------------
const ZSKIN = ["#a7c98c", "#9cc28a", "#b4cf95", "#a2c79a"];
const ZJACK = ["#7a6aa8", "#b8653f", "#5f8fa8", "#a8954f", "#8a5a7a"];
const zombie = (v: number, extra: Partial<Outfit> = {}): Outfit => ({
  jacket: ZJACK[v % 5], pants: ["#4b4f63", "#5a4a3a", "#3d5a52"][v % 3], boots: "#4a3b30", hat: "hair", hair: ["#4a4038", "#6b5a3a", "#3a3440"][v % 3],
  skin: ZSKIN[v % 4], rag: true, buttons: "none", ...extra,
});
const YOU: Outfit = { jacket: "#8fb8e8", stripes: "#c7dcf7", pants: "#8fb8e8", boots: "#ece4d6", hat: "hair", hair: "#6a4a2e", buttons: "none", skin: SKINS[1] };
const YOU_PACK: Outfit = { ...YOU, pack: "#d9572e" };
const HIKER: Outfit = { jacket: "#3f8f5a", pants: "#6a5a44", boots: "#5a3b2a", hat: "hair", hair: "#6a4a2e", buttons: "none", skin: SKINS[1], pack: "#d9572e" };
const GENERAL: Outfit = { jacket: "#6b7046", pants: "#5c5f3c", boots: INK, hat: "cap", cap: "#5c6040", moustache: "#d9d4c8", build: "stout", buttons: "#e8c45a", tie: "#4a4a32", skin: SKINS[0] };
const officer = (v: number): Outfit => ({ jacket: "#76794e", pants: "#5f623f", boots: INK, hat: "cap", cap: "#6b6e45", buttons: "#d9b84a", tie: "#4a4a32", skin: SKINS[(v + 2) % 4] });
const SCI: Outfit = { jacket: "#f2f4f7", pants: "#3b4a6a", boots: "#3a3030", hat: "hair", hair: "#2e2a2a", tie: "#3f6fb5", skin: SKINS[3], buttons: "#c9ccd2" };
const READ = ["#e2453c", "#3f6fb5", "#f0b43c", "#5aa04a", "#8a5ac9", "#e07a9a", "#3a8f8f", "#c97a3a"];
const reader = (v: number): Outfit => ({ jacket: READ[v % 8], pants: ["#3b3f52", "#5a4a3a", "#2f4a6a"][v % 3], boots: "#3a3030", hat: "hair",
  hair: ["#2e2a2a", "#6a4a2e", "#c9a55a", "#8a3a2a"][v % 4], skin: SKINS[v % 4], buttons: "none" });

const okeys = new Map<Outfit, string>();
const okey = (o: Outfit) => { let k = okeys.get(o); if (!k) { k = "o" + okeys.size + JSON.stringify(o).length; okeys.set(o, k); } return k; };
const FRONT = { side: false, mirror: false };
/** a front-view card at (x, y, z) with a contact blob when it stands on the ground (y = 0) */
const P = (out: Stage, cam: CamInfo, i: number, o: Outfit, x: number, y: number, z: number, fo: FrontOpts, scale = 1, ground = true) => {
  const pl = person(cam, { i, o, okey: okey(o) }, x, y, z, FRONT, fo, {} as SideOpts, scale);
  out.places.push(pl);
  if (ground) blob(out, x, y, z, scale);
};
const at = (t: number, w: number) => t >= w - LEAD; // reactions land 2 f before the word
const shamble = (t: number, i: number) => ({ mode: "stroll" as const, phase: (t * 0.55 + hh(i, 4)) % 1, reach: (t * 0.4 + hh(i, 5)) % 1, lift: 30,
  tilt: 4 * Math.sin(t * 1.3 + i), headTilt: 8 * Math.sin(t * 0.9 + 2 * i), expr: "zombie" as Expr });

// street zombies: [x0, z, speed m/s] (they shuffle along the road)
const STREET_Z: [number, number, number][] = [[-2.6, -1.6, 0.12], [-1.2, 1.4, -0.1], [1.4, -2.8, 0.12], [3.6, 0.6, -0.14], [5.6, -1.4, 0.1], [-4.6, 2.2, 0.12],
  [6.4, 2.6, -0.12], [-0.4, 3.2, 0.1], [2.4, 3.6, -0.1], [-6.5, -0.4, 0.14], [8.5, 0.9, -0.12], [0.2, -0.6, 0.11]];
const street = (id: number, t: number, cam: CamInfo, out: Stage) => {
  STREET_Z.forEach(([x0, z, v], i) => {
    if (id === 2 && Math.abs(x0 - 0.9) < 1.2 && Math.abs(z - 2.2) < 1.3) return; // keep clear of the general
    P(out, cam, 20 + i, zombie(i), x0 + v * t, 0, z, { ...shamble(t, i), facing: v > 0 ? 1 : -1, blink: lidAt(t, 20 + i) });
  });
  if (id === 2) P(out, cam, 2, GENERAL, 0.9, 0, 2.2, { mode: "stand", prop: "binder", expr: at(t, 4.24) ? "proud" : "stern", blink: lidAt(t, 2, [4.24]) });
  // you at the window (upstairs floor; the sill hides your legs)
  let fo: FrontOpts;
  if (id === 1) fo = { mode: "stand", expr: at(t, 1.3) ? "shock" : "sleepy", headTilt: at(t, 1.3) ? 0 : -6, blink: lidAt(t, 1, [1.3]), look: at(t, 1.3) ? -0.5 : 0 };
  else if (id === 19) {
    const ch = at(t, 68.26);
    fo = { mode: "stand", expr: ch ? "nervous" : at(t, 66.06) ? "smile_closed" : "stern", look: ch ? -1 : 0, facing: ch ? -1 : 0, blink: lidAt(t, 1, [66.06, 68.26]) };
  } else fo = { mode: "stand", expr: "shock", look: -0.6 };
  P(out, cam, 1, id === 19 ? YOU_PACK : YOU, 0.15, FLOOR2, -7.45, fo, 1, false);
  if (id === 19 && at(t, 67.8)) {
    const u = smooth((t - 67.7) / 0.35);
    chick(out, cam, -0.42, 3.72 + 0.9 * (1 - u), -7.32, 0.5, t, 0);
  }
};

const chick = (out: Stage, cam: CamInfo, x: number, y: number, z: number, sc: number, t: number, beak: number, tilt = 0) => {
  const d = cam.pos.distanceTo(tmp.set(x, y + 0.4 * sc, z)) / sc;
  const [w, h, k] = tier(d);
  const o = { blink: lidAt(t, 77) > 0.4 ? 1 : 0, beak: q(beak, 4), tilt: q(tilt, 2), bob: q(Math.max(0, Math.sin(t * 5)), 4) };
  out.places.push({ key: `chicken|${JSON.stringify(o)}`, draw: (p) => chicken(p, o), x, y, z, scale: sc, size: [w, h, k] });
};

const field = (id: number, t: number, cam: CamInfo, out: Stage) => {
  const F = FIELD;
  // background shufflers
  for (let i = 0; i < 6; i++) {
    const x = F - 6 + i * 5.2 + 0.2 * t * (i % 2 ? 1 : -1), z = -7 - (i % 3) * 3;
    P(out, cam, 40 + i, zombie(i + 2), x, 0, z, { ...shamble(t, 40 + i), facing: i % 2 ? 1 : -1, blink: lidAt(t, 40 + i) });
  }
  // radiation zombie + glow
  const pulse = 0.85 + 0.15 * Math.sin(t * 6);
  const ph = q(t % 2, 15);
  out.fx.push({ key: `aura${ph}`, cw: 600, ch: 600, draw: (p) => aura(p, ph), x: F, y: 1.15, z: -0.3, w: 2.4 * pulse, h: 2.4 * pulse });
  P(out, cam, 30, zombie(2, { skin: "#9ee86a", jacket: "#5f8fa8" }), F, 0, 0, { ...shamble(t, 30), mode: "stand", blink: lidAt(t, 30) });
  // evil magic zombie, sparkles
  P(out, cam, 31, zombie(0, { hat: "wizard", jacket: "#4b3a9a", pants: "#3a2c80" }), F + 4, 0, 0, { ...shamble(t, 31), mode: "stand", expr: at(t, 16.6) ? "stern" : "zombie", blink: lidAt(t, 31) });
  for (let k = 0; k < 3; k++) {
    const u = q((t * 1.4 + k / 3) % 1, 30);
    out.fx.push({ key: `stars${u}`, cw: 420, ch: 210, draw: (p) => fxStars(p, u), x: F + 4 + (k - 1) * 0.45, y: 1.5 + 0.5 * u, z: 0.25, w: 0.5, h: 0.25 });
  }
  // vegetarian zombie, chewing the bush on "only eat plants"
  const chew = at(t, 18.98) && Math.floor(t * 6) % 2 === 0;
  P(out, cam, 32, zombie(3), F + 8.35, 0, 0.2, { mode: "stand", reach: 0.1, facing: 1, tilt: at(t, 18.7) ? 9 : 3, expr: at(t, 18.98) ? (chew ? "lick" : "smile_closed") : "zombie", blink: lidAt(t, 32), headTilt: 10 });
  if (at(t, 18.98)) { const u = q(((t - 18.9) * 1.6) % 1, 30); out.fx.push({ key: `leaves${u}`, cw: 300, ch: 300, draw: (p) => leaves(p, u), x: F + 8.75, y: 1.25, z: 0.45, w: 0.9, h: 0.9 }); }
  // satellite zombie
  const hit = t >= SAT_T;
  P(out, cam, 33, zombie(4), F + 12.1, 0, 0.1, { ...shamble(t, 33), mode: "stand", facing: 1,
    expr: hit ? "dazed" : at(t, 23.46) ? "shock" : "zombie", look: at(t, 23.0) && !hit ? 1 : 0, blink: lidAt(t, 33, [23.46, SAT_T]) });
  if (hit && t < SAT_T + 3) {
    const u = q((t - SAT_T) % 1, 30);
    out.fx.push({ key: `stars${u}`, cw: 420, ch: 210, draw: (p) => fxStars(p, u), x: F + 12.1, y: 2.05, z: 0.15, w: 0.7, h: 0.35 });
  }
  satelliteAt(t, out);
  // chicken on its crate
  if (id === 10 || id === 9) {
    const moan = at(t, 24.76) && t < 25.3 ? 1 : 0, tilt = at(t, 27.04) ? 8 : 0;
    chick(out, cam, F + 16.0, 0.5, 0, 0.55, t, moan, tilt);
  }
};
const satelliteAt = (t: number, out: Stage) => {
  const F = FIELD;
  let x: number, y: number, z: number, spin: number;
  if (t < 22.27) { x = F + 12.4 + 1.2 * Math.sin(t * 0.4); y = 11.5 - (t - 20) * 0.6; z = -3; spin = t * 40; }
  else if (t < SAT_T) { const u = (t - 22.27) / (SAT_T - 22.27); x = F + 12.4 + 0.5 * u; y = 10.15 - 9.55 * u * u; z = -3 + 3.6 * u; spin = t * 140; }
  else { x = SAT_LAND[0]; y = 0.55; z = SAT_LAND[2]; spin = 22; }
  const s = q(((spin % 360) + 360) % 360, 1);
  out.fx.push({ key: `sat${s}`, cw: 600, ch: 600, draw: (p) => satellite(p, s), x, y, z, w: t < 22.27 ? 3.6 : 2.2, h: t < 22.27 ? 3.6 : 2.2 });
  if (t >= SAT_T && t < SAT_T + 0.8) {
    const u = q((t - SAT_T) / 0.8, 30);
    out.fx.push({ key: `puff${u}`, cw: 300, ch: 300, draw: (p) => fxPuff(p, u), x, y: 0.5, z: z + 0.3, w: 3.4, h: 3.4, soft: true });
    if (u < 0.5) out.fx.push({ key: `burst${q(u * 2, 30)}`, cw: 500, ch: 500, draw: (p) => fxBurst(p, q(u * 2, 30)), x, y: 0.7, z: z + 0.2, w: 2.6, h: 2.6 });
  }
};

const office = (id: number, t: number, cam: CamInfo, out: Stage) => {
  const O = OFFICE;
  if (id === 13) {
    P(out, cam, 3, officer(0), O - 0.65, 0, -2.0, { mode: "stand", salute: true, expr: "proud", blink: lidAt(t, 3) });
    P(out, cam, 4, officer(1), O + 0.65, 0, -2.0, { mode: "stand", salute: true, expr: "proud", blink: lidAt(t, 4) });
    P(out, cam, 2, GENERAL, O, 0, -2.4, { mode: "stand", prop: "binder", expr: "proud", blink: lidAt(t, 2) });
    return;
  }
  P(out, cam, 3, officer(0), O - 0.5, 0, -2.0, { mode: "stand", prop: "binder", facing: 1, expr: at(t, 9.7) ? "grin" : "stern", look: 0.6, blink: lidAt(t, 3, [9.7]) });
  if (id === 5) P(out, cam, 4, officer(1), O - 1.75, 0, -2.85, { mode: "stand", point: 0.4 + 0.15 * Math.sin(t * 3), facing: -1, expr: at(t, 13.5) ? "smile" : "stern", look: -1, blink: lidAt(t, 4) });
  else P(out, cam, 4, officer(1), O + 0.6, 0, -2.0, { mode: "stand", facing: -1, expr: "neutral", look: -0.8, blink: lidAt(t, 4) });
};

const base = (t: number, cam: CamInfo, out: Stage) => {
  P(out, cam, 3, officer(0), BASE + 3.2 - 0.6 * t + 0.6 * 5, 0, BASE_Z + 5.5, { mode: "stroll", phase: (t * 0.9) % 1, prop: "binder", facing: -1, expr: "stern", blink: lidAt(t, 3) });
};

const cdc = (id: number, t: number, cam: CamInfo, out: Stage) => {
  const C = CDC;
  const crashed = t >= CRASH_T;
  const sciExpr: Expr = id === 11 ? (at(t, 31.92) ? "proud" : "smile")
    : id === 12 ? (crashed ? "shock" : at(t, 36.02) ? "nervous" : "smile")
    : id === 14 ? "dazed" : id === 18 ? (at(t, 60.36) ? "grin" : "smile") : "smile";
  if (id !== 16) P(out, cam, 5, SCI, C - 0.4, 0, -2.15, { mode: "stand", facing: id === 12 ? -1 : 1, expr: sciExpr, look: id === 12 ? -1 : 0.6, blink: lidAt(t, 5, [31.92, 36.02, CRASH_T]) });
  if (id === 14 && t < 43.9) {
    const u = q(((t - 41.3) * 0.9) % 1, 30);
    out.fx.push({ key: `stars${u}`, cw: 420, ch: 210, draw: (p) => fxStars(p, u), x: C - 0.4, y: 2.1, z: -2.05, w: 0.7, h: 0.35 });
  }
  if (id === 14 || (id === 12 && crashed)) for (let k = 0; k < 3; k++) { // smoke from the monitor
    const u = q(((t - 38.2) * 0.7 + k / 3) % 1, 30);
    out.fx.push({ key: `smoke${u}`, cw: 300, ch: 300, draw: (p) => smoke(p, u), x: C + 0.35 + 0.1 * k, y: 1.4 + 0.9 * u, z: -1.5, w: 0.5 + 0.5 * u, h: 0.5 + 0.5 * u, soft: true });
  }
  if (id === 12) {
    // readers in front of the wall screen: 3 at first, the room fills from "This time"
    const n = t < 36.02 - LEAD ? 3 : Math.min(26, 3 + Math.floor((t - 35.95) * 22));
    for (let i = 0; i < n; i++) {
      const row = Math.floor(i / 6), col = (i + 2) % 6;
      const x = C - 2.6 + col * 0.82 + (row % 2) * 0.4 + (hh(i, 3) - 0.5) * 0.25, z = -0.45 + row * 0.75 + (hh(i, 6) - 0.5) * 0.2;
      const pop = i < 3 ? 1 : smooth((t - (35.95 + (i - 3) / 22)) / 0.12);
      P(out, cam, 50 + i, reader(i), x, 0, z, { mode: "stand", prop: i % 3 === 2 ? null : "phone", facing: i % 2 ? 1 : -1,
        expr: crashed ? "shock" : i % 4 === 0 ? "grin" : "smile", look: crashed ? 0 : 0.5, blink: lidAt(t, 50 + i, [CRASH_T]) }, 0.98 * pop);
    }
    if (crashed && t < CRASH_T + 0.5) {
      const u = q((t - CRASH_T) / 0.5, 30);
      out.fx.push({ key: `burst${u}`, cw: 500, ch: 500, draw: (p) => fxBurst(p, u), x: C - 0.6, y: 2.0, z: -3.7, w: 3.2, h: 3.2 });
      out.fx.push({ key: `burst${u}`, cw: 500, ch: 500, draw: (p) => fxBurst(p, u), x: C + 0.35, y: 1.12, z: -1.3, w: 0.9, h: 0.9 });
    }
  }
  if (id === 16) {
    const B: V3 = [C + 1.45, 0.76, -1.15];
    out.fx.push({ key: "bag", cw: 400, ch: 460, draw: (p) => backpack(p), x: B[0], y: B[1] + 0.23, z: B[2], w: 0.44, h: 0.5 });
    const drops: [number, "water" | "food" | "flash" | "meds" | "aid"][] = [[52.06, "water"], [52.6, "food"], [53.16, "flash"], [53.84, "meds"], [54.46, "aid"]];
    drops.forEach(([w, k], j) => {
      const u = Math.min(1, (t - (w - 0.35)) / 0.35);
      if (u < 0) return;
      const rest = 0.64 + 0.03 * j;
      out.fx.push({ key: `item${k}`, cw: 300, ch: 300, draw: (p) => item(p, k), x: B[0] - 0.12 + 0.06 * j, y: B[1] + rest + (1.0 - rest) * (1 - u * u), z: B[2] - 0.04 - 0.01 * j, w: 0.24, h: 0.24, rot: (j - 2) * 0.25 + 0.6 * (1 - u) });
    });
    for (const [w] of drops) if (t >= w && t < w + 0.25) {
      const u = q((t - w) / 0.25, 30);
      out.fx.push({ key: `burst${u}`, cw: 500, ch: 500, draw: (p) => fxBurst(p, u, "#fff3b0", 8, 60, 220), x: B[0], y: B[1] + 0.5, z: B[2] + 0.1, w: 0.5, h: 0.5 });
    }
  }
  if (id === 18) {
    const u = clamp01((t - (62.82 - 0.3)) / 0.3);
    if (t >= 62.52) out.fx.push({ key: "comic", cw: 300, ch: 400, draw: (p) => comic(p), x: C + 0.3, y: 0.775 + 0.32 + 0.6 * (1 - u * u), z: -1.0, w: 0.48, h: 0.64, rot: 0.12 * (1 - u) - 0.05 });
    if (t >= 62.82 && t < 63.3) { const v = q((t - 62.82) / 0.48, 30); out.fx.push({ key: `puff${v}`, cw: 300, ch: 300, draw: (p) => fxPuff(p, v), x: C + 0.3, y: 0.85, z: -0.95, w: 0.5, h: 0.5, soft: true }); }
  }
};

const war = (t: number, cam: CamInfo, out: Stage) => {
  const W = WAR;
  P(out, cam, 3, officer(0), W - 0.4, 0, -1.45, { mode: "stand", expr: at(t, 49.4) ? "grin" : at(t, 46.4) ? "smile" : "neutral", look: at(t, 49.4) ? 0 : 0.4, blink: lidAt(t, 3, [46.4, 49.4]) });
  P(out, cam, 2, GENERAL, W + 0.75, 0, -1.55, { mode: "stand", point: 0.0, facing: -1, expr: at(t, 45.6) ? "smile_closed" : "stern", look: -1, blink: lidAt(t, 2, [45.6]) });
  P(out, cam, 4, officer(1), W - 1.55, 0, -0.9, { mode: "stand", facing: 1, expr: "smile", look: 1, blink: lidAt(t, 4) });
};

const camp = (t: number, cam: CamInfo, out: Stage) => {
  const K = CAMP;
  const hur = at(t, 57.82), flood = at(t, 58.6);
  P(out, cam, 1, HIKER, K + 0.3, 0, 0, { mode: "stand", expr: flood ? "nervous" : hur ? "shock" : "grin", tilt: hur && !flood ? -7 : 0, wave: hur ? undefined : 0.4 + 0.3 * Math.sin(t * 5),
    blink: lidAt(t, 1, [57.82, 58.6]) });
  const fl = 0.85 + 0.15 * Math.sin(t * 9);
  out.fx.push({ key: `fire${q(fl, 10)}`, cw: 256, ch: 256, draw: (p) => glow(p.g, fl), x: K + 1.6, y: 0.35, z: 1.1, w: 1.1 * fl, h: 1.1 * fl, soft: true });
  out.fx.push({ key: `flame${q(fl, 10)}`, cw: 500, ch: 500, draw: (p) => fxBurst(p, 0.35 + 0.1 * fl, "#ffb347", 7, 30, 200), x: K + 1.6, y: 0.3, z: 1.12, w: 0.6, h: 0.6 });
  if (hur) for (let k = 0; k < 2; k++) {
    const u = q((t * 1.2 + k * 0.5) % 1, 30);
    out.fx.push({ key: `wind${u}`, cw: 400, ch: 400, draw: (p) => wind(p, u), x: K - 0.8 + k * 2.2, y: 1.4 + k * 0.4, z: 0.8, w: 1.8, h: 1.8, soft: true });
  }
  if (flood) for (let k = 0; k < 3; k++) {
    const u = q((t * 2 + k / 3) % 1, 30);
    out.fx.push({ key: `rain${u}`, cw: 400, ch: 400, draw: (p) => rain(p, u), x: K - 1.6 + k * 1.8, y: 1.6, z: 0.8 + k * 0.3, w: 2.4, h: 2.4, soft: true });
  }
};

/** everything with a face in shot `id` at time t */
export const stage = (id: number, t: number, cam: CamInfo): Stage => {
  const out: Stage = { places: [], fx: [] };
  const s = SHOTS[id - 1];
  LNAME = s.light;
  findSun(cam, SUN);
  switch (s.set) {
    case "street": street(id, t, cam, out); break;
    case "base": base(t, cam, out); break;
    case "office": office(id, t, cam, out); break;
    case "field": field(id, t, cam, out); break;
    case "cdc": cdc(id, t, cam, out); break;
    case "war": war(t, cam, out); break;
    case "camp": camp(t, cam, out); break;
  }
  return out;
};
export { FPS, fxContact, fxShadow, bodySide, CDC };
