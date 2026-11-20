// Our cast as lit flat sprites in the 3D world. Each frame every character asks for a drawing (a key + a draw call);
// the pool keeps one canvas per distinct drawing, so soldiers marching in step share canvases (7 head shapes x 4
// outfits). Characters are yaw-only billboards shaded by cardShade() (scene tint, bright floor, side gradient toward
// the sun, painted crescent in the drawing); standing ones get a soft multiply contact blob. Effects are unlit cards.
// Cards, effects and blobs live on the NOINK layer so the world ink pass never outlines their quads.
import * as THREE from "three";
import {
  Pen, bodyFront, bodySide, fxBurst, fxSplash, fxStars, fxRing, fxPuff, fxShadow, fxContact, SKINS, INK,
  Outfit, Expr, FrontOpts, SideOpts,
} from "./toon";
import { FPS, D0, SHOTS, V3, smooth, clamp01, B, SPOT, BEACH, POP, LEAN_T1 } from "./story";
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
  scale?: number; mirror?: boolean; yaw?: number; geo?: "body" | "swing"; roll?: number; size?: [number, number, number];
};
export type FxPlace = { key: string; cw: number; ch: number; draw: (p: Pen) => void; x: number; y: number; z: number; w: number; h: number; flat?: boolean; rot?: number; soft?: boolean };
/** sun = world direction TOWARD the sun (optional: when absent the scene's shadow-casting light is used) */
export type CamInfo = { pos: THREE.Vector3; right: THREE.Vector3; sun?: THREE.Vector3 };

const hh = (i: number, s = 0) => { const v = Math.sin(i * 127.1 + s * 311.7) * 43758.5453; return v - Math.floor(v); };
const q = (v: number, n = 120) => Math.round(v * n) / n;
// ---- our cast for Pisa ----
const sk = (v: number) => SKINS[v % 4];
/** 1173 builders: earth-tone tunics, cloth caps or bare heads; the old builders of 1272 come back grey and moustached */
const BUILDER = [0, 1, 2, 3, 4].map((v): Outfit => ({ jacket: ["#b5703f", "#7d6a4a", "#5d7d9a", "#a8873f", "#8c4a3a"][v], pants: ["#5a4632", "#4a4a5a", "#6b5236", "#3f4a3a", "#5a4632"][v],
  boots: "#4a3426", skin: sk(v), hat: v % 2 ? "cap" : "hair", cap: ["#c0503a", "#3f6f8a", "#c09a3a"][v % 3], hair: ["#3a2a20", "#5a3b2a", "#2a201a"][v % 3], moustache: v === 3 ? "#3a2a20" : undefined }));
const OLD = BUILDER.map((o, v): Outfit => ({ ...o, hat: "hair", hair: "#d8d4cc", moustache: v % 2 ? "#e4e0d8" : undefined }));
/** Pisan footmen: red tunic with a white cross belt, steel kettle helmet, pike */
const PIKE = [0, 1, 2, 3].map((v): Outfit => ({ jacket: "#b8343a", pants: "#3f3a48", boots: INK, hat: "helmet", belt: "#f1efe6", buttons: "#d9dde0", spear: true, skin: sk(v),
  moustache: v % 4 === 1 ? "#4a3426" : undefined }));
/** 1173 townsfolk (no top hats in the middle ages: hoods, caps, bonnets) */
const MEDIEVAL = [0, 1, 2, 3, 4, 5].map((v): Outfit => {
  const o: Outfit = { jacket: ["#3f6fb5", "#8c3b4a", "#5d7a3a", "#b5653f", "#2f5f6a", "#7b5ac9"][v], pants: "#3b3f52", boots: "#4a3426", skin: sk(v) };
  return v % 2 ? { ...o, hat: "bonnet", dress: ["#d9a441", "#c25a7a", "#5a8fc2"][v % 3] } : { ...o, hat: v % 4 ? "cap" : "hair", cap: "#6a3a5a", hair: "#4a3020" };
});
/** 1934: the official (stout, black uniform, bare head) and the workers (blue overalls, flat caps) */
const OFFICIAL: Outfit = { jacket: "#2a2830", pants: "#3a3842", boots: INK, buttons: "#e8c45a", build: "stout", skin: SKINS[1], hat: null };
const WORKER = [0, 1, 2].map((v): Outfit => ({ jacket: "#45618a", pants: "#3a4a66", boots: "#3a2a20", hat: "cap", cap: "#5a5a62", skin: sk(v + 1) }));
/** 1990-2001 engineers: orange jackets, yellow hard hats */
const ENGINEER = [0, 1, 2].map((v): Outfit => ({ jacket: ["#e87a2c", "#e0a030", "#e87a2c"][v], pants: "#3b4a6a", boots: "#3a2a20", hat: "hardhat", skin: sk(v + 2), moustache: v === 1 ? "#4a3426" : undefined }));
/** today's tourists */
const TOURIST = [0, 1, 2, 3, 4, 5].map((v): Outfit => {
  const o: Outfit = { jacket: ["#e4554b", "#3fa7c9", "#f2c94c", "#7bc46a", "#e98bb4", "#f39a3c"][v], pants: ["#3b5b9a", "#d9c7a0", "#3b5b9a", "#4a4a5a", "#3b5b9a", "#d9c7a0"][v], boots: "#f4f1ea", skin: sk(v) };
  return v % 3 === 0 ? { ...o, hat: "cap", cap: ["#2f5f9a", "#c0353a"][v % 2] } : { ...o, hat: "hair", hair: ["#3a2a20", "#c99a5a", "#2a201a", "#7a4a2a"][v % 4] };
});
const BEACHKID: Outfit = { jacket: "#f2c94c", pants: "#e4554b", boots: "#ffe2c2", hat: "cap", cap: "#3fa7c9", build: "kid", skin: SKINS[0] };
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
const SWAPS: Record<number, number[]> = { 4: [B.perfect1], 5: [B.perfect2], 6: [B.leans], 10: [B.sink, B.holds], 14: [B.further], 16: [B.stopped] };
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
type Env = { cam: CamInfo; t: number; id: number; out: Stage };
const FRONT = { side: false, mirror: false };

/** a standing / walking person in front view (contact blob included) */
const stand = (e: Env, i: number, o: Outfit, okey: string, x: number, y: number, z: number, fo: FrontOpts, scale = 1) => {
  const blink = fo.expr === "whistle" ? 0 : lidAt(e.t, i, SWAPS[e.id]);
  e.out.places.push(person(e.cam, { i, o, okey }, x, y, z, FRONT, { mode: "stand", blink, ...fo }, {}, scale));
  if (fo.mode !== "sit") blob(e.out, x, Math.max(y, 0), z, scale);
};
/** side view (walking along dx, or pushing toward dx) */
const sideP = (e: Env, i: number, o: Outfit, okey: string, x: number, y: number, z: number, dx: number, so: SideOpts, scale = 1) => {
  const v = viewOf(e.cam, x, z, dx, 0);
  e.out.places.push(person(e.cam, { i, o, okey }, x, y, z, { side: true, mirror: v.mirror }, {}, { blink: lidAt(e.t, i, SWAPS[e.id]), ...so, stride: v.fs * (so.stride ?? 1) }, scale));
  blob(e.out, x, y, z, scale);
};
const puff = (e: Env, x: number, y: number, z: number, t0: number, size: number, dur = 0.5) => {
  const u = (e.t - t0) / dur;
  if (u < 0 || u >= 1) return;
  e.out.fx.push({ key: `puff${q(u, 30)}`, cw: 300, ch: 300, draw: (p) => fxPuff(p, q(u, 30)), x, y, z, w: size, h: size, soft: false });
};
const burst = (e: Env, x: number, y: number, z: number, t0: number, size: number, col = "#fff3b0", dur = 0.3) => {
  const u = (e.t - t0) / dur;
  if (u < 0 || u >= 1) return;
  e.out.fx.push({ key: `burst${col}${q(u, 30)}`, cw: 500, ch: 500, draw: (p) => fxBurst(p, q(u, 30), col), x, y, z, w: size, h: size });
};
const EXPRS: Expr[] = ["grin", "smile", "laugh", "smile_closed"];

/** today: tourists holding the tower up for the photo, and their friends taking it */
const tourists = (e: Env, golden: boolean) => {
  SPOT.tourists.forEach(([x, z], i) => {
    const o = TOURIST[i % 6], key = `t${i % 6}`;
    if (i % 2 === 0) {
      const k = 0.85 + 0.15 * Math.sin(e.t * 1.3 + i); // a slow strain against the tower
      sideP(e, i, o, key, x, D0, z, x < (8 * z) / 62 ? 1 : -1, { mode: "push", pose: q(k, 20), expr: i % 4 ? "laugh" : "grin" });
    } else {
      stand(e, i, o, key, x, D0, z, { expr: EXPRS[i % 4], wave: q(0.6 + 0.1 * Math.sin(e.t * 2 + i), 20) });
    }
  });
  // strollers further back
  for (let i = 0; i < 10; i++) {
    const x = -20 + i * 4.6 + hh(i, 3) * 2, z = 22 + hh(i, 4) * 12, dir = i % 2 ? 1 : -1;
    const sp = 0.8 + hh(i) * 0.3, xx = x + dir * sp * (e.t - (golden ? 66 : 0)) * 0.6;
    sideP(e, 30 + i, TOURIST[(i + 2) % 6], `t${(i + 2) % 6}`, xx, D0, z, dir, { mode: "march", phase: q(((e.t * sp * 0.6) / 0.7 + hh(i, 5)) % 1, 60), expr: "smile", stomp: 0.5 });
  }
};

/** 1173: the townsfolk around the empty site, cheering on "proud" */
const townsfolk1173 = (e: Env) => {
  const on = e.t >= B.proud - LEAD && e.t < B.proud + 1.6;
  for (let i = 0; i < 18; i++) {
    const row = Math.floor(i / 6), k = i % 6;
    const x = -9.5 + k * 3.6 + hh(i) * 1.2 + (row % 2) * 1.6, z = 12.5 + row * 2.4 + hh(i, 2) * 0.8;
    const hop = on && i % 3 === 0 ? Math.max(0, Math.sin(e.t * 8 + i)) * 0.15 : 0;
    stand(e, 100 + i, MEDIEVAL[i % 6], `m${i % 6}`, x, D0 + hop, z, { expr: on ? (i % 2 ? "laugh" : "grin") : EXPRS[i % 4], wave: on && i % 3 !== 1 ? q(Math.sin(e.t * 9 + i * 1.3), 30) : undefined });
  }
};

/** builders standing at their spots in front of the tower */
const builders = (e: Env, old = false) => {
  SPOT.builders.forEach(([x, z], i) => {
    const o = (old ? OLD : BUILDER)[i], key = `${old ? "o" : "b"}${i}`;
    let expr: Expr = "neutral", wave: number | undefined, prop: FrontOpts["prop"] = i % 2 ? "shovel" : null;
    const t = e.t;
    if (e.id === 4) { expr = t < B.perfect1 - LEAD ? "smile" : "grin"; if (i === 1 && t > B.perfect1 - LEAD) { wave = 0.9; prop = null; } }
    if (e.id === 5) { expr = t < B.perfect2 - LEAD ? "grin" : "smile_closed"; if (i === 3 && t > B.perfect2 - LEAD) { wave = 0.9; prop = null; } }
    if (e.id === 6) expr = t < B.leans - LEAD ? "grin" : i % 2 ? "shock" : "nervous";
    if (e.id === 12) expr = "grin";
    if (e.id === 13) { expr = i === 1 ? "smile" : i % 2 ? "laugh" : "grin"; if (i === 1 && t > B.banana - 0.5) { prop = "banana"; } }
    stand(e, 200 + i, o, key, x, D0, z, { expr, wave, prop, look: e.id === 6 && t > B.leans ? (x < 0 ? 1 : -1) : 0, headTilt: e.id === 6 && t > B.leans ? -6 : 0 });
  });
};

/** shot 3: builders digging in the pit; one sinks into the clay on "soft, wet clay" */
const pitDiggers = (e: Env) => {
  const spots: [number, number][] = [[0.4, 1.2], [-3.4, 2.6], [3.6, 3.0], [-1.6, -2.8], [2.8, -1.8]];
  spots.forEach(([x, z], i) => {
    const sink = i === 0 ? -0.32 * smooth((e.t - B.soft) / 0.35) : 0;
    const dig = q(Math.max(0, Math.sin(e.t * 5 + i * 1.7)), 10);
    const expr: Expr = i === 0 && e.t > B.soft - LEAD ? "shock" : i % 2 ? "neutral" : "stern";
    stand(e, 250 + i, BUILDER[i], `b${i}`, x, -3 + sink, z, { expr, prop: "shovel", tilt: i === 0 ? 0 : 6 * dig - 3 });
  });
  burst(e, 0.4, -2.75, 1.4, B.soft, 1.6, "#7a5232", 0.4);
};

/** shot 7: the Pisan column marches out across the piazza; the builders get pulled along at the back */
const warColumn = (e: Env) => {
  const t0 = 21.3, sp = 1.6;
  for (let i = 0; i < 24; i++) {
    const row = Math.floor(i / 3), file = i % 3;
    const x = -3 + sp * (e.t - t0) - row * 1.35 + hh(i) * 0.15, z = 15.5 + file * 1.15 + hh(i, 2) * 0.1;
    const ph = q(((e.t - t0) % 1 + 1) % 1, 60);
    sideP(e, 300 + i, PIKE[i % 4], `p${i % 4}`, x, D0, z, 1, { mode: "march", phase: ph, expr: i % 4 ? "stern" : "neutral", stomp: 1 });
  }
  // builders: still at their spots, then dragged after the column on "dragged into a war"
  SPOT.builders.forEach(([x0, z], i) => {
    const go = e.t > B.dragged - LEAD + i * 0.08;
    const x = go ? x0 + 1.9 * (e.t - (B.dragged - LEAD + i * 0.08)) : x0;
    if (go) sideP(e, 200 + i, BUILDER[i], `b${i}`, x, D0, z + 0.5, 1, { mode: "march", phase: q((e.t * 1.3 + i * 0.3) % 1, 60), expr: "nervous", stomp: 0.7 });
    else stand(e, 200 + i, BUILDER[i], `b${i}`, x, D0, z, { expr: "shock" });
  });
};

/** shot 9: water beads squeezing out of the clay at the foot of the tower */
const claySweat = (e: Env) => {
  for (let i = 0; i < 9; i++) {
    const a = 0.25 + i * 0.12, r = 7.7 + hh(i, 3) * 1.2, x = Math.cos(a) * r, z = Math.sin(a) * r;
    const u = ((e.t * 0.8 + hh(i, 4)) % 1);
    const s = q(Math.sin(Math.PI * Math.min(1, u * 1.4)), 20);
    if (s > 0.05) e.out.fx.push({ key: `drop${s}`, cw: 200, ch: 260, draw: (p) => drop(p), x, y: 0.1 + 0.35 * u, z, w: 0.34 * s, h: 0.44 * s });
    e.out.fx.push({ key: `ring${q(u, 30)}`, cw: 600, ch: 600, draw: (p) => fxRing(p, q(u, 30)), x, y: 0.03, z, w: 0.9, h: 0.9, flat: true });
  }
};
const drop = (p: Pen) => {
  p.poly([[100, 20], [150, 150], [138, 210], [100, 236], [62, 210], [50, 150]], "#7fc4ec", 10);
  p.ell(82, 160, 14, 24, "#e3f4ff", 0);
};

/** shot 10: the kid on the wet sand sinks a little, the water squeezes out, the sand holds */
const beachKid = (e: Env) => {
  const [kx, kz] = SPOT.kid, x = BEACH[0] + kx, z = BEACH[2] + kz;
  const sink = -0.13 * smooth((e.t - B.sink) / 0.45);
  const expr: Expr = e.t < B.sink - LEAD ? "smile" : e.t < B.holds - LEAD ? "nervous" : "grin";
  stand(e, 400, BEACHKID, "kid", x, sink, z, { expr, wave: e.t > B.holds - LEAD ? q(Math.sin(e.t * 7), 20) : undefined }, 0.72);
  for (let i = 0; i < 3; i++) {
    const u = (e.t - B.squeeze - i * 0.3) / 1.2;
    if (u < 0 || u >= 1) continue;
    e.out.fx.push({ key: `ring${q(u, 30)}`, cw: 600, ch: 600, draw: (p) => fxRing(p, q(u, 30)), x, y: 0.02, z, w: 1.4, h: 1.4, flat: true });
  }
  // a gull for life in the frame
  const gx = BEACH[0] - 6 + ((e.t - 30) * 1.4) % 14, gy = 4.2 + 0.3 * Math.sin(e.t * 2);
  e.out.fx.push({ key: `gull${Math.floor(e.t * 6) % 2}`, cw: 300, ch: 160, draw: (p) => gull(p, Math.floor(e.t * 6) % 2), x: gx, y: gy, z: BEACH[2] - 9, w: 0.7, h: 0.37 });
};
const gull = (p: Pen, k: number) => {
  const y = k ? 70 : 100;
  p.stroke([[20, y], [80, 80], [150, 105], [220, 80], [280, y]], 14, "#f4f1ea");
  p.stroke([[20, y], [80, 80], [150, 105], [220, 80], [280, y]], 4, INK);
};

/** shots 12: the old builders stroll back in from the town */
const returning = (e: Env) => {
  SPOT.builders.forEach(([x, z], i) => {
    const arrive = 39.4 + i * 0.15, d = Math.max(0, arrive - e.t) * 1.2;
    if (d > 0) {
      const ph = q((e.t * 1.2 + i * 0.37) % 1, 60);
      e.out.places.push(person(e.cam, { i: 200 + i, o: OLD[i], okey: `o${i}` }, x, D0, z + d, viewOf(e.cam, x, z + d, 0, -1),
        { mode: "stroll", phase: ph, expr: "smile", blink: lidAt(e.t, 200 + i) }, { mode: "march", phase: ph, expr: "smile", stomp: 0.5 }));
      blob(e.out, x, D0, z + d);
    } else builders(e, true);
  });
};

/** 1934: the official orders it straightened; workers by the mixer */
const y1934 = (e: Env) => {
  const [ox, oz] = SPOT.official, t = e.t;
  const point = t > B.ordered - LEAD && t < B.further;
  stand(e, 500, OFFICIAL, "off", ox, D0, oz, { expr: t > B.further - LEAD ? "shock" : point ? "stern" : "neutral", wave: point ? 0.95 : undefined, facing: 1 }, 1.02);
  const [mx, mz] = SPOT.mixer;
  [[mx + 3.2, mz + 1.8], [mx - 2.4, mz + 2.4], [mx + 0.6, mz + 3.4]].forEach(([x, z], i) =>
    stand(e, 510 + i, WORKER[i], `w${i}`, x, D0, z, { expr: t > B.further - LEAD ? "shock" : t > B.pumped ? "grin" : "neutral", prop: i === 2 ? "shovel" : null }));
  // concrete gulps at the base while the pump runs
  if (t > B.pumped && t < 51.4) {
    const u = ((t - B.pumped) * 1.6) % 1;
    e.out.fx.push({ key: `burst#9a9a96${q(u, 30)}`, cw: 500, ch: 500, draw: (p) => fxBurst(p, q(u, 30), "#b9b6ae"), x: -7.6, y: 0.4, z: 3.2, w: 1.4, h: 1.4 });
  }
  burst(e, 6.5, 0.6, 3, 51.75, 3.2, "#fff3b0", 0.4);
};

/** 1990 / 2001: engineers at the rig on the high side */
const engineers = (e: Env) => {
  const [rx, rz] = SPOT.rig, t = e.t;
  const at16 = e.id === 16;
  // engineer 0 at the controls: hand on the lever until "stopped on purpose"
  const onLever = at16 ? t < B.stopped - LEAD : true;
  stand(e, 600, ENGINEER[0], "e0", rx + 1.4, D0, rz + 2.6, { expr: at16 ? (t < B.straight ? "neutral" : t < B.stopped - LEAD ? "nervous" : "smile_closed") : t > B.sank - LEAD ? "grin" : "stern",
    wave: onLever ? 0.25 : undefined });
  stand(e, 601, ENGINEER[1], "e1", rx - 2.4, D0, rz + 3.4, { expr: t > B.sank - LEAD ? "laugh" : "neutral", prop: "shovel" });
  stand(e, 602, ENGINEER[2], "e2", rx + 3.6, D0, rz + 4.6, { expr: at16 && t > B.stopped ? "grin" : "smile" });
  if (e.id === 15 && t > B.pulling - 0.2) for (let k = 0; k < 3; k++) puff(e, rx + 0.8 + k * 0.5, 0.4 + 0.3 * k, rz + 0.6, B.pulling + k * 0.45, 1.2, 0.6);
  if (at16) puff(e, rx + 0.2, 1.4, rz + 0.8, B.stopped, 1.6, 0.6);
};

/** dust as each floor goes up: a ring of puffs where the new floor meets the one below */
const popDust = (e: Env, lean: number) => {
  POP.forEach((t0, k) => {
    if (e.t < t0 || e.t > t0 + 0.6) return;
    let y = 0;
    for (let j = 0; j < k; j++) y += [11, 6.4, 6.4, 6.4, 6.4, 6.4, 6.4][j];
    const a = (lean * Math.PI) / 180, cx = Math.sin(a) * y, cy = Math.cos(a) * y;
    for (let n = 0; n < 6; n++) {
      const ang = (n / 6) * Math.PI * 2 + 0.3;
      puff(e, cx + Math.cos(ang) * 8, cy + 0.4, Math.sin(ang) * 8, t0, k ? 2.6 : 3.4, 0.55);
    }
  });
};

/** everything with a face in shot `id` at time t */
export const stage = (id: number, t: number, cam: CamInfo, lean: number): Stage => {
  const out: Stage = { places: [], fx: [] };
  const s = SHOTS[id - 1];
  LNAME = s.light;
  findSun(cam, SUN);
  const e: Env = { cam, t, id, out };
  if (id === 1 || id === 17) tourists(e, id === 17);
  if (id === 2) { townsfolk1173(e); builders(e); }
  if (id === 3) pitDiggers(e);
  if (id >= 4 && id <= 6) { builders(e); for (let i = 0; i < 6; i++) stand(e, 100 + i, MEDIEVAL[i], `m${i}`, -11 + i * 4.4 + hh(i) * 1.5, D0, 18 + hh(i, 2) * 3, { expr: id === 6 && t > B.leans ? "shock" : EXPRS[i % 4] }); }
  if (id === 6) burst(e, 7.4, 0.5, 3.5, LEAN_T1 - 0.15, 2.4, "#fff3b0", 0.35);
  if (id >= 4 && id <= 6 || id === 12) popDust(e, lean);
  if (id === 7) warColumn(e);
  if (id === 9) claySweat(e);
  if (id === 10) beachKid(e);
  if (id === 12) returning(e);
  if (id === 13) builders(e, true);
  if (id === 14) y1934(e);
  if (id === 15 || id === 16) engineers(e);
  return out;
};
export { FPS, fxSplash, fxStars, clamp01 };
