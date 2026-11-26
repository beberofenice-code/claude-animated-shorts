// Our cast as lit flat sprites in the 3D world. Each frame every character asks for a drawing (a key + a draw call);
// the pool keeps one canvas per distinct drawing, so soldiers marching in step share canvases (7 head shapes x 4
// outfits). Characters are yaw-only billboards shaded by cardShade() (scene tint, bright floor, side gradient toward
// the sun, painted crescent in the drawing); standing ones get a soft multiply contact blob. Effects are unlit cards.
// Cards, effects and blobs live on the NOINK layer so the world ink pass never outlines their quads.
import * as THREE from "three";
import {
  Pen, bodyFront, bodySide, swingKid, soldier, townsfolk, OFFICER, KID, PARENT, NELL, TOM_OUTFIT, fxNote, fxBurst, fxSplash, fxStars, fxCreak, fxRing, fxBlob, fxShadow, fxContact, fxPlank, fxDrum,
  Outfit, Expr, FrontOpts, SideOpts,
} from "./toon";
import {
  FPS, D0, FILES, ROW_GAP, COUNT, PARK, SHOTS, SNAP, DROP0, DROP1, DROP_H, V3, front, marchPhase, stomp, deckY, dropW, dropU, shapeZ,
  smooth, clamp01, BridgeState, W, PAN_HITS, desync, ROOM, BED_TOP, NELL_SCALE, NELL_Q, TOM_B, NELL_B, nellRun, strollZ, SIGN_AT as SIGN_POS,
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
  scale?: number; mirror?: boolean; yaw?: number; geo?: "body" | "swing"; roll?: number; size?: [number, number, number]; pitch?: number;
};
export type FxPlace = { key: string; cw: number; ch: number; draw: (p: Pen) => void; x: number; y: number; z: number; w: number; h: number; flat?: boolean; rot?: number; soft?: boolean };
/** sun = world direction TOWARD the sun (optional: when absent the scene's shadow-casting light is used) */
export type CamInfo = { pos: THREE.Vector3; right: THREE.Vector3; sun?: THREE.Vector3 };

const hh = (i: number, s = 0) => { const v = Math.sin(i * 127.1 + s * 311.7) * 43758.5453; return v - Math.floor(v); };
const q = (v: number, n = 120) => Math.round(v * n) / n;
const SOLDIER = [0, 1, 2, 3].map((v) => soldier(v));
const BARE = [0, 1, 2, 3].map((v) => soldier(v, { hat: null }));
const FOLK = [0, 1, 2, 3, 4, 5].map((v) => townsfolk(v));
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
const SWAPS: Record<number, number[]> = { 4: [19.067], 7: [W.shout], 8: [W.bang], 9: [W.laugh] };
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

const TOM_I = 1; // front row, second file
const DREAM_SNAP_T = 19.067;
const exprMarch = (id: number, t: number, i: number, tau: number): { expr: Expr; look: number } => {
  const lau = i % 3 === 0, whi = i % 5 === 1, L = LEAD;
  switch (id) {
    case 1: return { expr: "shock", look: 0 };
    case 4: return t < DREAM_SNAP_T - L ? { expr: i % 2 ? "whistle" : "smile", look: 0 } : { expr: "shock", look: -1 }; // whistling, eyes open (the real laugh later is the change)
    case 3: return { expr: i === TOM_I ? "grin" : i % 4 === 3 ? "smile_closed" : i % 2 ? "neutral" : "stern", look: 0 };
    case 6: return { expr: i % 3 === 0 ? "grin" : i % 2 ? "neutral" : "stern", look: 0 };
    case 7: return { expr: t < W.shout - L ? (lau ? "grin" : "neutral") : i % 4 === 0 ? "grin" : "neutral", look: 0 };
    case 8: return { expr: t < W.bang - L ? "neutral" : i % 2 ? "shock" : "nervous", look: t < W.bang - L ? 0 : 1 };
    case 9: return { expr: t < W.laugh - L ? (i % 2 ? "shock" : "grin") : i % 3 === 2 ? "relief_open" : "laugh", look: 0 };
    case 10: return { expr: (["laugh", "grin", "relief", "smile_closed"] as Expr[])[i % 4], look: 0 };
    default: return { expr: "grin", look: 0 };
  }
};

/** the marching column: dream shots run the 1831 collapse; real shots lose the step (desync) and never fall */
const column = (id: number, t: number, b: BridgeState, cam: CamInfo, out: Stage) => {
  const s = SHOTS[id - 1], tau = s.tau(t), dream = s.crowd === "dream";
  const stopT = SNAP + 0.3, walkT = dream ? Math.min(tau, stopT) : tau;
  const F = front(walkT), st = dream ? stomp(tau) : stomp(tau) * (1 - 0.45 * smooth((t - W.sloppy) / 3));
  const falling = dream && tau >= DROP0;
  for (let i = 0; i < COUNT; i++) {
    const row = i >> 2, x0 = FILES[i & 3] + (hh(i) - 0.5) * 0.08, z = F + row * ROW_GAP + (hh(i, 2) - 0.5) * 0.1;
    let x = x0, y = Math.abs(z) <= 30 ? deckY(z, b) : D0;
    const tom = i === TOM_I;
    const who: Who = tom ? { i, o: TOM_OUTFIT, okey: "tom" } : { i, o: SOLDIER[vOf(i)], okey: `s${vOf(i)}` };
    let { expr, look } = exprMarch(id, t, i, tau);
    if (tom && (id === 3 || id === 6)) expr = "grin";
    const ds = dream ? 0 : desync(t, i);
    // out of step: each man drifts to his own phase and cadence
    const ph0 = marchPhase(walkT), ph = ds > 0 ? (((ph0 + ds * (0.15 + 0.7 * hh(i, 5)) + ds * (hh(i, 6) - 0.5) * 0.5 * (t - W.sloppy)) % 1) + 1) % 1 : ph0;
    let mode: "march" | "stand" | "fall" | "sit" | "stroll" = dream && tau >= SNAP + 0.25 ? "stand" : ds > 0.55 ? "stroll" : "march";
    let tilt = 0;
    if (falling) {
      const lagY = D0 + b.bounce * shapeZ(z) - dropU(tau - 0.13) * DROP_H * dropW(z);
      const air = Math.max(0, lagY - y);
      y += air;
      const u = clamp01((tau - DROP0) / (DROP1 - DROP0));
      x = x0 + (hh(i, 3) - 0.5) * 0.7 * u;
      mode = tau < DROP1 + 0.13 ? "fall" : "sit";
      tilt = mode === "fall" ? (hh(i, 4) - 0.5) * 50 * u : 0;
      if (mode === "sit") expr = "dazed";
    }
    const view = viewOf(cam, x, z, 0, -1);
    const blink = expr !== "whistle" ? lidAt(t, i, SWAPS[id]) : 0;
    const php = q(ph, 24);
    const fo: FrontOpts = { phase: mode === "march" || mode === "stroll" ? php : 0, expr, mode, look, blink, lift: 60 * st, tilt };
    const so: SideOpts = { phase: mode === "march" || mode === "stroll" ? php : 0, expr, mode: mode === "march" || mode === "stroll" ? "march" : "stand", blink, stomp: mode === "stroll" ? 0.6 : st, stride: view.fs * (mode === "stroll" ? 0.85 : 1) };
    out.places.push(person(cam, who, x, y, z, mode === "fall" || mode === "sit" ? { side: false, mirror: false } : view, fo, so));
    if (mode !== "fall" && mode !== "sit") blob(out, x, y, z);
    if (expr === "whistle" && id === 4 && cam.pos.distanceTo(tmp.set(x, y, z)) < 16) {
      for (let n = 0; n < 4; n++) {
        const age = ((t - 13.8 + n * 0.42 + hh(i, 5)) % 1.68) / 1.68;
        const pop = Math.min(1, age * 7) * (age > 0.82 ? (1 - age) / 0.18 : 1);
        if (pop <= 0.02) continue;
        const kind = (n + i) % 2, side = 0.16 + 0.32 * age + 0.05 * Math.sin(age * 9 + n);
        out.fx.push({ key: `note${kind}`, cw: 220, ch: 260, draw: (p) => fxNote(p, kind), x: x + cam.right.x * side, y: y + 1.5 + 0.85 * age, z: z + cam.right.z * side - 0.1,
          w: 0.17 * pop, h: 0.2 * pop, rot: 0.3 * Math.sin(age * 6 + n) });
      }
    }
  }
};

const sitters = (cam: CamInfo, t: number, out: Stage, spots: [number, number, number][], exprs: (i: number) => Expr, stars: (i: number) => boolean, water: boolean) => {
  spots.forEach(([x, y, z], i) => {
    const bare = i % 3 === 1;
    const v = vOf(i + 3), who: Who = { i, o: bare ? BARE[v] : SOLDIER[v], okey: `${bare ? "b" : "s"}${v}` };
    const expr = exprs(i), bob = water ? 0.03 * Math.sin(t * 2.2 + i) : 0;
    out.places.push(person(cam, who, x, y + bob, z, { side: false, mirror: false }, { mode: "sit", expr, blink: lidAt(t, i), look: 0 }, {}));
    if (stars(i)) {
      const u = (t * 0.9 + hh(i)) % 1;
      out.fx.push({ key: `stars${q(u, 30)}`, cw: 420, ch: 210, draw: (p) => fxStars(p, q(u, 30)), x, y: y + bob + 1.3, z, w: 0.75, h: 0.375 });
    }
    if (water) {
      const u = ((t + hh(i, 7) * 2) % 2.2) / 2.2;
      out.fx.push({ key: `ring${q(u, 30)}`, cw: 600, ch: 600, draw: (p) => fxRing(p, q(u, 30)), x, y: 0.03, z, w: 2.0, h: 2.0, flat: true });
      out.fx.push({ key: `blob|contact|${WATERLINE}`, cw: 128, ch: 128, draw: (p) => fxContact(p, WATERLINE), x, y: 0.034 + bob * 0.3, z, w: 0.7, h: 0.5, flat: true });
    } else blob(out, x, y, z, 1.05, 0.8);
  });
};
const WATERLINE = hexOf([0.3, 0.36, 0.52], 1);

/** the extras hold still and only cheer on cue: "Taong 1831", "parang mga turista" */
const CHEER: [number, number][] = [[5.35 - LEAD, 7.9], [68.15 - LEAD, 70.4]];
const townsfolkAt = (cam: CamInfo, t: number, out: Stage) => {
  const spots: [number, number][] = [];
  for (let i = 0; i < 26; i++) {
    const bank = i < 13 ? -1 : 1, k = i % 13, sx = k % 2 ? 1 : -1;
    spots.push([sx * (5.2 + (k >> 1) * 1.7 + hh(i) * 0.6), bank * (31.6 + hh(i, 2) * 3.2)]);
  }
  const on = CHEER.some(([a, b]) => t >= a && t < b);
  spots.forEach(([x, z], i) => {
    const kid = i % 5 === 2, o = kid ? KID : FOLK[i % 6], hop = kid && on ? Math.max(0, Math.sin(t * 7 + i)) * 0.18 : 0;
    const who: Who = { i: i + 200, o, okey: kid ? "kid" : `f${i % 6}` };
    const expr: Expr = (["smile", "grin", "laugh", "smile_closed"] as Expr[])[i % 4];
    const fo: FrontOpts = { mode: "stand", expr, wave: i % 3 === 2 || !on ? undefined : q(Math.sin(t * 9 + i * 1.3), 30), blink: lidAt(t, i + 40) };
    out.places.push(person(cam, who, x, D0 + hop, z, { side: false, mirror: false }, fo, {}, kid ? 0.72 : 1));
    blob(out, x, D0, z, kid ? 0.72 : 1, hop > 0 ? 0.6 : 1);
  });
};

/** soldiers strolling out of step across the bridge: own pace kept, poses on ones. `keep` = a lane left free */
const tourists = (cam: CamInfo, t: number, out: Stage, t0: number, z0: number, n = 24, keep?: [number, number]) => {
  for (let i = 0; i < n; i++) {
    const sp = 0.55 + hh(i) * 0.5, z = z0 + (i / n) * 28 + hh(i, 2) * 1.5 - sp * (t - t0);
    let x = (hh(i, 3) - 0.5) * 4.0;
    if (keep && x > keep[0] && x < keep[1]) x = x < (keep[0] + keep[1]) / 2 ? keep[0] - 0.35 : keep[1] + 0.35;
    const bare = i % 5 === 2, v = vOf(i), who: Who = { i, o: bare ? BARE[v] : SOLDIER[v], okey: `${bare ? "b" : "s"}${v}` };
    const prop = i % 7 === 3 ? "icecream" : bare ? "shako" : null;
    const lick = prop === "icecream" && (t * 0.7 + hh(i, 4)) % 1 < 0.45;
    const expr: Expr = lick ? "lick" : (["smile", "smile_closed", "grin", "smile"] as Expr[])[i % 4];
    const phase = q(((t - t0) * sp / 1.4 + hh(i, 5)) % 1, 120);
    const look = Math.round(Math.sin(t * 0.8 + i * 1.7) * 1.2);
    const fo: FrontOpts = { mode: "stroll", phase, expr, look: Math.max(-1, Math.min(1, look)), prop, blink: lidAt(t, i) };
    const view = viewOf(cam, x, z, 0, -1);
    const so: SideOpts = { mode: "march", phase, expr, stomp: 0.55, stride: 0.875 * view.fs };
    out.places.push(person(cam, who, x, D0, z, view, fo, so));
    blob(out, x, D0, z);
  }
};

// officer hammering the new rule onto a sign at the bridge end (shot 13)
export const HITS = W.hits;
export const SIGN_AT: V3 = SIGN_POS;
const strikeK = (t: number, hits: number[]) => {
  let k = 1;
  for (const th of hits) {
    const n = (t - th) * FPS;
    if (n >= -11 && n < -7) k = Math.min(k, 1 - smooth((n + 11) / 4));
    else if (n >= -7 && n < 0) k = 0;
  }
  return k;
};
const officer = (cam: CamInfo, t: number, out: Stage) => {
  const fo: FrontOpts = { mode: "stand", expr: "stern", prop: ["hammer", q(strikeK(t, HITS), 30)], blink: lidAt(t, 99), facing: 1 };
  out.places.push(person(cam, { i: 99, o: OFFICER, okey: "off" }, 3.35, D0, -31.55, { side: false, mirror: false }, fo, {}));
  blob(out, 3.35, D0, -31.55, 1.1);
  for (const th of HITS) if (t >= th && t < th + 5 / FPS) {
    const u = (t - th) / (5 / FPS);
    out.fx.push({ key: `burst${q(u, 30)}`, cw: 500, ch: 500, draw: (p) => fxBurst(p, q(u, 30)), x: 2.95, y: D0 + 1.55, z: -31.0, w: 0.9, h: 0.9 });
  }
};

// ---------------- Nell ----------------
const NELL_WHO: Who = { i: 300, o: NELL, okey: "nell" };
/** pan swing 0 raised .. 1 struck: a quick wind-up, struck on the hit frame, then back up */
const panK = (t: number) => {
  let k = 0;
  for (const th of PAN_HITS) {
    const n = (t - th) * FPS;
    if (n >= -4 && n < 0) k = Math.max(k, smooth((n + 4) / 4));
    else if (n >= 0 && n < 3) k = Math.max(k, 1 - n / 4);
  }
  return k;
};
const panFx = (t: number, at: V3, out: Stage) => {
  for (const th of PAN_HITS) if (t >= th && t < th + 6 / FPS) {
    const u = (t - th) / (6 / FPS);
    out.fx.push({ key: `burst${q(u, 30)}`, cw: 500, ch: 500, draw: (p) => fxBurst(p, q(u, 30)), x: at[0], y: at[1], z: at[2], w: 0.75, h: 0.75 });
  }
};
const nell = (id: number, t: number, cam: CamInfo, out: Stage) => {
  const f = Math.round(t * FPS), lid = lidAt(t, 300);
  if (id === 2) {
    // asleep under the quilt, face up; eyes snap open on "nagkakatotoo"
    const awake = t >= W.wake - LEAD;
    const fo: FrontOpts = { mode: "stand", expr: awake ? "shock" : "nervous", blink: awake ? (t < W.wake + 0.6 ? 0 : lid) : 1 };
    const pl = person(cam, NELL_WHO, ROOM[0], BED_TOP + 0.02, ROOM[2] - 0.55 + 0.906, { side: false, mirror: false }, fo, {}, NELL_SCALE);
    out.places.push({ ...pl, yaw: 0, pitch: -Math.PI / 2 });
    return;
  }
  if (id === 5) {
    // running she is always drawn side-on (the front view hides the run under the dress)
    const r = nellRun(f), view = { ...viewOf(cam, r.x, r.z, 0, 1), side: true };
    const ph = q(((t * 2.7) % 1 + 1) % 1, 24);
    const fo: FrontOpts = r.running ? { mode: "march", phase: ph, expr: "nervous", lift: 85, blink: lid } : { mode: "stand", expr: "shock", blink: lid };
    const so: SideOpts = r.running ? { mode: "march", phase: ph, expr: "nervous", stomp: 1.4, stride: view.fs, blink: lid } : { mode: "stand", expr: "shock", blink: lid };
    out.places.push(person(cam, NELL_WHO, r.x, D0, r.z, r.running ? view : { side: false, mirror: false }, fo, so, NELL_SCALE));
    blob(out, r.x, D0, r.z, NELL_SCALE);
    // market folk turn to watch her pass
    const folk: [number, number, number][] = [[-3.0, -61.2, 0], [-3.1, -65.6, 1], [2.9, -66.8, 3], [-2.8, -69.8, 4], [3.2, -58.6, 5], [2.6, -91.5, 2], [-2.4, -88.0, 1]];
    folk.forEach(([x, z, v], k) => {
      const seen = Math.abs(r.z - z) < 4;
      const fo2: FrontOpts = { mode: "stand", expr: seen ? "shock" : (["smile", "neutral"] as Expr[])[k % 2], blink: lidAt(t, 320 + k), look: seen ? (r.z > z ? 1 : -1) : 0 };
      out.places.push(person(cam, { i: 320 + k, o: FOLK[v], okey: `f${v}` }, x, D0, z, { side: false, mirror: false }, fo2, {}));
      blob(out, x, D0, z);
    });
    return;
  }
  const [x, , z] = NELL_Q;
  if (id === 7) {
    const shouting = t >= W.shout - LEAD;
    const fo: FrontOpts = shouting ? { mode: "stand", expr: "shock", wave: q(Math.sin(t * 11), 30), blink: lid } : { mode: "stand", expr: "nervous", blink: lid };
    out.places.push(person(cam, NELL_WHO, x, D0, z, { side: false, mirror: false }, fo, {}, NELL_SCALE));
    blob(out, x, D0, z, NELL_SCALE);
    return;
  }
  if (id === 8 || id === 9) {
    const dancing = t >= W.dance - LEAD;
    const hop = dancing ? 0.09 * Math.abs(Math.sin(t * Math.PI * 2.3)) : 0;
    const k = dancing ? q(0.5 + 0.5 * Math.sin(t * 9), 20) : q(panK(t), 30);
    const expr: Expr = dancing ? "laugh" : t < W.bang - LEAD ? "stern" : t < W.laugh ? "grin" : "laugh";
    const fo: FrontOpts = { mode: "stand", expr, prop: ["pan", k], blink: lid, headTilt: dancing ? q(9 * Math.sin(t * Math.PI * 2.3), 2) : 0 };
    out.places.push(person(cam, NELL_WHO, x, D0 + hop, z, { side: false, mirror: false }, fo, {}, NELL_SCALE));
    blob(out, x, D0, z, NELL_SCALE, hop > 0.03 ? 0.6 : 1);
    // the clang: a burst on the pan (over her chest), a little toward the lens
    { const tx = cam.pos.x - x, tz = cam.pos.z - z, l = Math.hypot(tx, tz) || 1; panFx(t, [x + (tx / l) * 0.12, D0 + hop + 0.6, z + (tz / l) * 0.12], out); }
    return;
  }
  if (id === 13) {
    out.places.push(person(cam, NELL_WHO, NELL_B[0], D0, NELL_B[2], { side: false, mirror: false }, { mode: "stand", expr: "relief_open", prop: ["pan", 0], blink: lid }, {}, NELL_SCALE));
    blob(out, NELL_B[0], D0, NELL_B[2], NELL_SCALE);
    const tomO = { ...TOM_OUTFIT, hat: "hair", hair: "#3a2418", rifle: false };
    out.places.push(person(cam, { i: TOM_I, o: tomO, okey: "tombare" }, TOM_B[0], D0, TOM_B[2], { side: false, mirror: false }, { mode: "stand", expr: "relief", prop: "shako", blink: lidAt(t, TOM_I) }, {}));
    blob(out, TOM_B[0], D0, TOM_B[2]);
    return;
  }
  if (id === 14) {
    const zz = strollZ(t), ph = q(((t * 0.62 / 1.2) % 1 + 1) % 1, 120), phN = q(((t * 0.62 / 0.8 + 0.3) % 1 + 1) % 1, 120);
    const tomView = viewOf(cam, 0.55, zz, 0, -1), nellView = viewOf(cam, -0.25, zz - 0.15, 0, -1);
    const tomExpr: Expr = t >= 68.8 ? "laugh" : "smile_closed";
    out.places.push(person(cam, { i: TOM_I, o: TOM_OUTFIT, okey: "tom" }, 0.55, D0, zz, tomView,
      { mode: "stroll", phase: ph, expr: tomExpr, blink: lidAt(t, TOM_I) }, { mode: "march", phase: ph, expr: tomExpr, stomp: 0.55, stride: 0.875 * tomView.fs }));
    blob(out, 0.55, D0, zz);
    out.places.push(person(cam, NELL_WHO, -0.25, D0, zz - 0.15, nellView,
      { mode: "stroll", phase: phN, expr: "grin", blink: lid, prop: ["pan", 0] }, { mode: "march", phase: phN, expr: "grin", stomp: 0.5, stride: 0.7 * nellView.fs }, NELL_SCALE));
    blob(out, -0.25, D0, zz - 0.15, NELL_SCALE);
  }
};

// swing in the park (shot 12): two pushes on time grow the arc, the third lands early ("sirain mo ang tiyempo") and kills it
export const SWING_T = 1.55, PUSH0 = 52.3;
const pushes = [52.3, 53.85, 55.17];
export const swingAmp = (t: number) => 8 + 12 * smooth((t - pushes[0]) / 0.3) + 12 * smooth((t - pushes[1]) / 0.3) - 15 * smooth((t - pushes[2]) / 0.35) - 7 * smooth((t - 55.6) / 1.6);
export const swingAngle = (t: number) => -((swingAmp(t) * Math.PI) / 180) * Math.cos((2 * Math.PI * (t - PUSH0)) / SWING_T);
const kidBack = (th: number): [number, number] => {
  const lx = -0.083, ly = -2.174;
  return [PARK[0] - (lx * Math.cos(th) - ly * Math.sin(th)), PARK[1] + 2.88 + lx * Math.sin(th) + ly * Math.cos(th)];
};
const pushSpot = (k: number) => {
  const [bx, by] = kidBack(swingAngle(pushes[k]));
  const cy = 975 - (by - D0) / SU, dy = cy - 515, dx = Math.sqrt(Math.max(120 * 120, 222 * 222 - dy * dy));
  return { px: bx + (53 + dx) * SU, hand: [300 + 53 + dx, cy] as [number, number] };
};
const park = (cam: CamInfo, t: number, out: Stage) => {
  const th = swingAngle(t), vel = Math.sin((2 * Math.PI * (t - PUSH0)) / SWING_T);
  const A = (swingAmp(t) * Math.PI) / 180, kick = q(0.35 + 0.55 * vel, 40);
  const spoiled = t >= pushes[2] - 0.05;
  const expr: Expr = spoiled ? (t < pushes[2] + 0.8 ? "shock" : "nervous") : A < 0.3 ? "smile" : A < 0.5 ? "grin" : "laugh";
  const light = light2D(cam, true), lid = lidAt(t, 78);
  out.places.push({ key: `swing|${kick}|${expr}|${q(light)}|${lid}`, geo: "swing", x: PARK[0], y: PARK[1] + 2.88, z: PARK[2], yaw: Math.PI, roll: th,
    draw: (p) => swingKid(p, KID, kick, expr, light, lid), size: [490, 1610, 0.7] });
  const push = Math.max(0, ...pushes.map((tp) => 1 - Math.abs(t - tp + 0.05) / 0.32));
  let k = 0;
  while (k < pushes.length - 1 && t > pushes[k] + 0.35) k++;
  const cur = pushSpot(k), prev = pushSpot(Math.max(0, k - 1));
  const step = k > 0 ? smooth((t - (pushes[k - 1] + 0.35)) / 0.8) : 1;
  const px = prev.px + (cur.px - prev.px) * step, pz = PARK[2] + 0.1;
  const pe: Expr = spoiled ? "nervous" : push > 0.3 ? "grin" : "smile";
  const so: SideOpts = { mode: "push", pose: q(push, 40), expr: pe, blink: lidAt(t, 77), hand: cur.hand };
  out.places.push({ ...person(cam, { i: 77, o: PARENT, okey: "parent" }, px, D0, pz, { side: true, mirror: true }, {}, so), mirror: false, yaw: Math.PI });
  blob(out, px, D0, pz);
};

/** everything with a face in shot `id` at time t */
export const stage = (id: number, t: number, b: BridgeState, cam: CamInfo): Stage => {
  const out: Stage = { places: [], fx: [] };
  const s = SHOTS[id - 1];
  LNAME = s.light;
  findSun(cam, SUN);
  if (s.crowd === "march" || s.crowd === "dream") column(id, t, b, cam, out);
  if (s.towns) townsfolkAt(cam, t, out);
  if (s.crowd === "bank") {
    officer(cam, t, out);
    tourists(cam, t, out, 57.0, -18, 14);
  }
  if (s.crowd === "tourists") tourists(cam, t, out, 63.6, -4, 24, [-0.9, 1.3]);
  if (s.crowd === "park") park(cam, t, out);
  if (s.nell || s.crowd === "bed" || s.crowd === "run" || s.crowd === "bank" || s.crowd === "tourists") nell(id, t, cam, out);
  return out;
};

// ---------------- one-off effects ----------------
export const snapFx = (tau: number, at: V3, out: Stage) => {
  if (tau >= SNAP && tau < SNAP + 0.45) {
    const u = (tau - SNAP) / 0.45;
    out.fx.push({ key: `bigburst${q(u, 30)}`, cw: 500, ch: 500, draw: (p) => fxBurst(p, q(u, 30)), x: at[0], y: at[1] + 0.12, z: at[2] - 0.15, w: 1.5, h: 1.5 });
  }
};
export const splashFx = (tau: number, out: Stage) => {
  const u = (tau - DROP1) / 1.1;
  if (u < 0 || u >= 1) return;
  for (const [x, z, s] of [[-2.9, -24, 1], [2.9, -21, 0.9], [-2.9, -15, 0.85], [2.9, -9, 0.8], [0, -27.5, 1.2], [-2.9, -5, 0.6]] as const)
    out.fx.push({ key: `splash${q(u, 30)}`, cw: 800, ch: 800, draw: (p) => fxSplash(p, q(u, 30)), x, y: 2.6 * s, z, w: 7 * s, h: 7 * s }); // base of the drawing on the water line
};
export const creakFx = (t: number, pts: V3[], out: Stage, size = 0.8) =>
  pts.forEach(([x, y, z], i) => {
    const u = q((t * 1.3 + i * 0.37) % 1, 30);
    out.fx.push({ key: `creak${u}`, cw: 300, ch: 300, draw: (p) => fxCreak(p, u), x, y, z, w: size, h: size, rot: i * 0.6 - 0.6 });
  });
export { FPS };
