// The cast as lit flat cards in the 3D world (canvas pool + cardShade, from the bridge short), and who stands where
// in every beat of the pelikula short. Reactions land 0-3 frames before their word.
import * as THREE from "three";
import { Pen, bodyFront, bodySide, Outfit, Expr, FrontOpts, SideOpts, SKINS, fxBurst, fxShadow, fxContact, INK } from "./toon";
import { FPS, SHOTS, V3, W, ESC, THE, STU, HOME, PAL, OFF, STACK_PH, HERO_MARQ, CAN_H, cansAt, smooth, clamp01 } from "./story";
import { NOINK } from "./ink";
import { cardShade, blobMaterial, CARD_K } from "./cardshade";
import { HERO, HERO_PRES, LEADING } from "./paint2";

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

const blank = (() => { const c = document.createElement("canvas"); c.width = c.height = 2; return new THREE.CanvasTexture(c); })();
export const SU = 0.00216;
const BODY = (() => { const g = new THREE.PlaneGeometry(600 * SU, 1000 * SU); g.translate(0, (975 - 500) * SU, 0); return g; })();
const CARD = new THREE.PlaneGeometry(1, 1);
export class Actor {
  mesh: THREE.Mesh; mat: THREE.MeshLambertMaterial; dmat: THREE.MeshDepthMaterial; r: Req | null = null;
  constructor(parent: THREE.Object3D) {
    this.mat = cardShade(new THREE.MeshLambertMaterial({ map: blank, alphaTest: 0.5, side: THREE.DoubleSide }));
    this.dmat = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: blank, alphaTest: 0.5, side: THREE.DoubleSide });
    this.mesh = new THREE.Mesh(BODY, this.mat);
    this.mesh.customDepthMaterial = this.dmat;
    this.mesh.onBeforeRender = (r) => { const rt = r.getRenderTarget(); CARD_K.uPx.value = (rt ? rt.height : r.domElement.height) / 1920; };
    this.mesh.castShadow = false; this.mesh.receiveShadow = true; this.mesh.visible = false;
    this.mesh.rotation.order = "YXZ"; this.mesh.renderOrder = 1; this.mesh.layers.set(NOINK);
    parent.add(this.mesh);
  }
  bind() { const t = this.r?.tex; if (t) { this.mat.map = t; this.dmat.map = t; } }
}
export class Fx {
  mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; soft: THREE.MeshBasicMaterial; blob: THREE.MeshBasicMaterial; r: Req | null = null;
  constructor(parent: THREE.Object3D) {
    this.mat = new THREE.MeshBasicMaterial({ map: blank, alphaTest: 0.5, side: THREE.DoubleSide });
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
      if (t.generateMipmaps) { t.generateMipmaps = false; t.minFilter = THREE.LinearFilter; t.needsUpdate = true; }
      this.blob.map = t; this.mesh.material = this.blob; this.mesh.renderOrder = 0.5;
    } else { this.mat.map = t; this.soft.map = t; this.mesh.renderOrder = 0; }
  }
}

export type Place = {
  key: string; draw: (p: Pen) => void; x: number; y: number; z: number;
  scale?: number; mirror?: boolean; yaw?: number; roll?: number; size?: [number, number, number];
};
export type FxPlace = { key: string; cw: number; ch: number; draw: (p: Pen) => void; x: number; y: number; z: number; w: number; h: number; flat?: boolean; rot?: number; soft?: boolean };
export type CamInfo = { pos: THREE.Vector3; right: THREE.Vector3; sun: THREE.Vector3 };
export type Stage = { places: Place[]; fx: FxPlace[] };

const hh = (i: number, s = 0) => { const v = Math.sin(i * 127.1 + s * 311.7) * 43758.5453; return v - Math.floor(v); };
const q = (v: number, n = 120) => Math.round(v * n) / n;
const tier = (d: number): [number, number, number] =>
  d < 3.2 ? [1800, 3000, 3.0] : d < 6.5 ? [1080, 1800, 1.8] : d < 16 ? [480, 800, 0.8] : [240, 400, 0.4];
const SUN = new THREE.Vector3(0.5, 0.75, -0.4).normalize();
const tmp = new THREE.Vector3();
let LNAME = "day";
const light2D = (cam: CamInfo, mirror: boolean) => {
  const sx = SUN.dot(cam.right) * (mirror ? -1 : 1), sy = -SUN.y;
  return Math.round(Math.atan2(sy, sx) / (Math.PI / 4)) * (Math.PI / 4);
};
const viewOf = (cam: CamInfo, x: number, z: number, dx: number, dz: number) => {
  const tx = cam.pos.x - x, tz = cam.pos.z - z, tl = Math.hypot(tx, tz) || 1;
  const c = (tx * dx + tz * dz) / tl;
  return { side: c < 0.5, mirror: dx * cam.right.x + dz * cam.right.z < 0, fs: Math.round(Math.sqrt(Math.max(0, 1 - c * c)) * 20) / 20 };
};
const FRONT = { side: false, mirror: false };

// ---------------- life ----------------
const LEAD = 2 / FPS;
const LID = [0.5, 1, 1, 0.5];
const lidAt = (t: number, i: number) => {
  const f = Math.round(t * FPS);
  let s = Math.round(-60 * hh(i, 9));
  for (let n = 0; s <= f && n < 400; n++) {
    const k = f - s;
    if (k >= 0 && k < 4) return LID[k];
    s += Math.round(15 + 54 * hh(i * 31 + n, 13));
  }
  return 0;
};
const fkey = (o: object) => JSON.stringify(o, (_k, v) => (typeof v === "number" ? q(v) : v));
/** has the word at time w started (with the reaction lead)? */
const on = (t: number, w: number) => t >= w - LEAD;

type Who = { i: number; o: Outfit; okey: string };
const person = (cam: CamInfo, who: Who, x: number, y: number, z: number, view: { side: boolean; mirror: boolean }, fo: FrontOpts, so: SideOpts = {}, scale = 1): Place => {
  const d = cam.pos.distanceTo(tmp.set(x, y + 1.2 * scale, z)) / scale;
  const [w, h, k] = tier(d);
  const mirror = view.side && view.mirror, light = light2D(cam, mirror), seed = (who.i % 7) + 1;
  const f2: FrontOpts = { ...fo, light, seed }, s2: SideOpts = { ...so, light, seed };
  const key = view.side ? `S|${who.okey}|${fkey(s2)}` : `F|${who.okey}|${fkey(f2)}`;
  return { key, x, y, z, scale, mirror, draw: (p) => (view.side ? bodySide(p, who.o, s2) : bodyFront(p, who.o, f2)), size: [w, h, k] };
};
const toSrgb = (v: number) => { const c = clamp01(v); return c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055; };
const hexOf = (c: [number, number, number], k: number) => "#" + c.map((v) => Math.round(255 * toSrgb(1 - (1 - v) * k)).toString(16).padStart(2, "0")).join("");
const CONTACT: Record<string, [number, number, number]> = { day: [0.2, 0.21, 0.33], golden: [0.24, 0.2, 0.33], night: [0.25, 0.25, 0.4], dark: [0.3, 0.3, 0.45] };
const blob = (out: Stage, x: number, y: number, z: number, sc = 1, k = 1) => {
  const hl = Math.hypot(SUN.x, SUN.z) || 1, ox = -SUN.x / hl, oz = -SUN.z / hl, rot = Math.atan2(-ox, -oz);
  if (LNAME === "day" || LNAME === "golden") {
    const el = Math.asin(Math.min(0.99, Math.max(0.1, SUN.y)));
    const len = Math.min(2.4, Math.max(0.5, 1.6 / Math.tan(el))) * sc, h = len + 0.55 * sc, c = 0.3 * h;
    const tc = hexOf([0.42, 0.44, 0.62], k);
    out.fx.push({ key: `blob|shadow|${tc}`, cw: 128, ch: 256, draw: (p) => fxShadow(p, tc), x: x + ox * c, y: y + 0.018, z: z + oz * c, w: 0.72 * sc, h, flat: true, rot });
  }
  const cc = hexOf(CONTACT[LNAME], k);
  out.fx.push({ key: `blob|contact|${cc}`, cw: 128, ch: 128, draw: (p) => fxContact(p, cc), x, y: y + 0.022, z, w: 0.52 * sc, h: 0.4 * sc, flat: true, rot });
};

// ---------------- wardrobe ----------------
const SK = SKINS.concat(["#e9b98f", "#d9a47e"]);
const pick = <T,>(a: T[], i: number) => a[((i % a.length) + a.length) % a.length];
const TEE = ["#e2453c", "#3f8fd8", "#f2c33c", "#57b35a", "#f08a2c", "#8c5ac9", "#2f9a9a", "#f08ac0"];
const HAIR = ["#22191a", "#2a1d1a", "#3a2a22", "#1a1418"];
/** today's folks: tees, jeans, a cap or hair; women in dresses */
const modern = (i: number): Outfit => {
  const v = Math.floor(hh(i, 21) * 8);
  const base: Outfit = { jacket: pick(TEE, i * 3 + v), pants: pick(["#3b5b9a", "#2c3550", "#5a5a6a", "#3a4a3a"], i), boots: pick(["#f4f1ea", "#3a2a22", "#e2453c"], i + v), skin: pick(SK, i * 5 + 1), hair: pick(HAIR, i), hat: "hair" };
  if (v % 3 === 0) return { ...base, hat: "cap", cap: pick(TEE, i + 2) };
  if (v % 3 === 1) return { ...base, dress: pick(["#d9567a", "#5a8fc2", "#d9a441", "#57b35a"], i), jacket: pick(["#fbf6ea", "#f3d9e3", "#e9f0f6"], i) };
  return v % 2 ? { ...base, motif: "stripe" } : base;
};
const kid = (i: number): Outfit => ({ ...modern(i + 11), build: "kid", dress: undefined, hat: i % 2 ? "cap" : "hair", cap: pick(TEE, i + 5) });
const LOLA: Outfit = { jacket: "#f6ead0", pants: "#3b3f52", boots: "#5a3b2a", hat: "bun", hair: "#d9d4de", dress: "#5a8fc2", skin: "#ecd0b6" };
const LOLO: Outfit = { jacket: "#f4efe4", pants: "#3b3f52", boots: "#3a2a22", hat: "hair", hair: "#e6e2ea", moustache: "#e6e2ea", motif: "barong", skin: "#e9b98f" };
const PAPA: Outfit = { jacket: "#3f8fd8", pants: "#2c3550", boots: "#3a2a22", hat: "hair", hair: "#22191a", skin: "#e9b98f", build: "stout", motif: "stripe" };
const MAMA: Outfit = { jacket: "#fbf6ea", pants: "#3b3f52", boots: "#e2453c", hat: "hair", hair: "#2a1d1a", dress: "#d9567a", skin: "#f1c7a3" };
const TITA: Outfit = { jacket: "#f3d9e3", pants: "#3b3f52", boots: "#7a4b3a", hat: "hair", hair: "#3a2a22", dress: "#57b35a", skin: "#ecd0b6" };
const ANAK1: Outfit = { jacket: "#f2c33c", pants: "#3b5b9a", boots: "#f4f1ea", hat: "cap", cap: "#e2453c", build: "kid", skin: "#e9b98f" };
const ANAK2: Outfit = { jacket: "#f08ac0", pants: "#3b3f52", boots: "#f4f1ea", hat: "hair", hair: "#22191a", build: "kid", dress: "#8c5ac9", skin: "#f1c7a3" };
/** 1897: barong + salakot / top hat, baro't saya with a bun */
const old = (i: number): Outfit => {
  const v = Math.floor(hh(i, 23) * 6);
  if (v % 2) return { jacket: pick(["#f6ead0", "#fbf6ea"], i), pants: "#3b3f52", boots: "#3a2a22", hat: i % 4 === 1 ? "bun" : "hair", hair: i % 4 === 1 ? "#d9d4de" : "#22191a", dress: pick(["#c25a7a", "#5a8fc2", "#d9a441", "#8c3b4a"], i), skin: pick(SK, i + 2) };
  return { jacket: "#f4efe4", motif: "barong", pants: pick(["#2c2c34", "#5a4a3a"], i), boots: "#3a2a22", hat: pick(["salakot", "tophat", "hair"], i), hair: i % 5 === 0 ? "#e6e2ea" : "#22191a", moustache: i % 3 === 0 ? "#2a1d1a" : undefined, skin: pick(SK, i + 1) };
};
const DIRECTOR: Outfit = { jacket: "#d9c9a0", pants: "#4a4038", boots: "#3a2a22", hat: "cap", cap: "#3a3346", moustache: "#2a1d1a", build: "stout", skin: "#e9b98f" };
const CREW = (i: number): Outfit => ({ jacket: pick(["#f4efe4", "#8fb8d8", "#d9a441"], i), pants: "#3b3f52", boots: "#3a2a22", hat: i % 2 ? "cap" : "hair", cap: "#e2453c", hair: "#22191a", skin: pick(SK, i + 3) });
const CAND1: Outfit = { jacket: "#2c3550", pants: "#2c3550", boots: "#1d1a22", hat: "hair", hair: "#22191a", skin: "#ecd0b6", motif: "stripe" };
const CAND3: Outfit = { jacket: "#fbf6ea", pants: "#3b3f52", boots: "#3a2a22", hat: "hair", hair: "#3a2a22", dress: "#e2a23c", skin: "#f1c7a3" };
const HERO_RUN: Outfit = { ...HERO, dsash: undefined };

// ---------------- fx ----------------
const CONF = ["#e2453c", "#f2c33c", "#3f8fd8", "#57b35a", "#f08ac0", "#fbf8ef"];
const confettiCard = (col: string) => (p: Pen) => p.poly([[10, 20], [54, 8], [56, 30], [12, 40]], col, 0);
/** confetti raining in a box around c (w x h x d), started at t0 */
const confetti = (out: Stage, t: number, t0: number, c: V3, w: number, h: number, d: number, n = 70) => {
  if (t < t0) return;
  for (let i = 0; i < n; i++) {
    const life = 3.2, age = ((t - t0) + hh(i, 2) * life) % life, fall = age / life;
    const x = c[0] + (hh(i) - 0.5) * w + 0.25 * Math.sin(t * 2 + i), z = c[2] + (hh(i, 3) - 0.5) * d, y = c[1] + h * (1 - fall);
    const col = CONF[i % CONF.length], spin = q(((t * (1.5 + hh(i, 4) * 2) + i) % 1), 8);
    out.fx.push({ key: `conf${col}`, cw: 64, ch: 48, draw: confettiCard(col), x, y, z, w: 0.12 * (0.6 + 0.4 * Math.abs(Math.cos(spin * 6.28))), h: 0.09, rot: spin * 6.28 });
  }
};
const heatWave = (p: Pen, k: number) => { for (let j = 0; j < 3; j++) { const pts: [number, number][] = []; for (let i = 0; i <= 16; i++) pts.push([40 + j * 70 + 12 * Math.sin(i * 0.9 + k * 6.28 + j), 220 - i * 12]); p.stroke(pts, 7, "rgba(255,240,200,0.9)"); } };
const sparkle = (p: Pen) => { p.poly([[50, 0], [60, 40], [100, 50], [60, 60], [50, 100], [40, 60], [0, 50], [40, 40]], "#fff3b0", 4); };
const tear = (p: Pen) => p.ell(32, 40, 18, 26, "#9fd4ff", 4);
const shoutLines = (p: Pen) => { for (let i = 0; i < 5; i++) { const a = -0.9 + i * 0.45; p.stroke([[100 + 40 * Math.cos(a), 100 + 40 * Math.sin(a)], [100 + 90 * Math.cos(a), 100 + 90 * Math.sin(a)]], 9, INK); } };
const shiver = (p: Pen) => { for (const s of [-1, 1]) p.stroke([[100 + s * 70, 40], [100 + s * 80, 60], [100 + s * 70, 80], [100 + s * 80, 100]], 6, "#9fd4ff"); };

// ---------------- crowds by beat ----------------
type Spot = { x: number; z: number; i: number };
const grid = (n: number, x0: number, x1: number, z0: number, z1: number, seed: number): Spot[] => {
  const cols = Math.ceil(Math.sqrt(n * (x1 - x0) / Math.max(0.1, z1 - z0))), rows = Math.ceil(n / cols), out: Spot[] = [];
  for (let k = 0; k < n; k++) {
    const c = k % cols, r = Math.floor(k / cols);
    out.push({ x: x0 + ((c + 0.5 + (hh(k, seed) - 0.5) * 0.6) / cols) * (x1 - x0), z: z0 + ((r + 0.5 + (hh(k, seed + 1) - 0.5) * 0.5) / rows) * (z1 - z0), i: k + seed * 50 });
  }
  return out;
};

const hook = (cam: CamInfo, t: number, out: Stage) => {
  for (const s of grid(26, -5.5, 5.5, -0.5, 9, 1)) {
    const isKid = s.i % 6 === 2, o = isKid ? kid(s.i) : modern(s.i);
    const ex: Expr = pick(["grin", "amazed", "laugh", "smile_closed", "grin"], s.i);
    const pose = s.i % 5 === 1 ? "point" : s.i % 7 === 3 ? "cheer" : null;
    const hop = isKid ? Math.max(0, Math.sin(t * 7 + s.i)) * 0.12 : 0;
    out.places.push(person(cam, { i: s.i, o, okey: `m${s.i}` }, s.x, hop, s.z, FRONT,
      { mode: "stand", expr: ex, pose, pk: q(0.5 + 0.5 * Math.sin(t * 5 + s.i), 20), prop: !pose && s.i % 4 === 0 ? "popcorn" : null, blink: lidAt(t, s.i), look: s.i % 3 - 1 }, {}, isKid ? 0.74 : 1));
    blob(out, s.x, 0, s.z, isKid ? 0.74 : 1);
  }
};

const heroMarquee = (cam: CamInfo, t: number, out: Stage) => {
  const f = t * FPS;
  if (f < 128) return;
  // he steps out of the poster (rises from behind the billboard edge, 6 f), then waves, then the fist on "bida"
  const u = smooth((f - 128) / 6), pose = on(t, W.bida) ? "fist" : "cheer";
  const pk = on(t, W.bida) ? q(smooth((t - W.bida + LEAD) * 6), 20) : q(0.5 + 0.5 * Math.sin(t * 8), 20);
  out.places.push(person(cam, { i: 900, o: HERO_PRES, okey: "heroP" }, HERO_MARQ[0], HERO_MARQ[1] - 0.25 * (1 - u), HERO_MARQ[2] - 0.6 * (1 - u), FRONT,
    { mode: "stand", expr: on(t, W.bida) ? "grin" : "smile", pose, pk, blink: lidAt(t, 900) }));
  blob(out, HERO_MARQ[0], HERO_MARQ[1], HERO_MARQ[2]);
  confetti(out, t, 4.4, [0, 4.6, -8.5], 9, 6, 6, 90);
  if (on(t, W.bida) && t < W.bida + 0.3) {
    const k = (t - W.bida + LEAD) / 0.3;
    out.fx.push({ key: `burst${q(k, 30)}`, cw: 500, ch: 500, draw: (p) => fxBurst(p, q(k, 30)), x: HERO_MARQ[0] + 0.5, y: HERO_MARQ[1] + 2.3, z: HERO_MARQ[2] - 0.2, w: 1.6, h: 1.6 });
  }
};

const street1897 = (cam: CamInfo, t: number, out: Stage) => {
  const [ox, , oz] = ESC;
  for (let i = 0; i < 14; i++) { // strollers on both walks
    const s = i % 2 ? 1 : -1, sp = 0.6 + hh(i) * 0.4, dir = hh(i, 2) > 0.5 ? 1 : -1;
    const z = oz - 20 + ((hh(i, 3) * 60 + dir * sp * t) % 60 + 60) % 60 - 0, x = ox + s * (4.6 + hh(i, 4) * 0.8);
    if (s < 0 && z > -1 && z < 14) continue; // the queue stands there
    const view = viewOf(cam, x, z, 0, dir), ph = q((t * sp / 1.4 + hh(i, 5)) % 1);
    out.places.push(person(cam, { i: 300 + i, o: old(i), okey: `o${i}` }, x, 0.12, z, view,
      { mode: "stroll", phase: ph, expr: "smile", blink: lidAt(t, 300 + i) }, { mode: "march", phase: ph, stomp: 0.5, stride: 0.85 * view.fs, expr: "smile" }));
    blob(out, x, 0.12, z);
  }
  queue1897(cam, t, out, false);
};
const queue1897 = (cam: CamInfo, t: number, out: Stage, close = true) => {
  const [ox, , oz] = ESC;
  for (let i = 0; i < 11; i++) {
    const x = ox - 4.6 + (hh(i, 6) - 0.5) * 0.35, z = oz + 0.4 + i * 0.95, o = i === 4 ? LOLO : i === 5 ? { ...LOLA, dress: "#8c3b4a" } : old(i + 40);
    const shuffle = 0.04 * Math.sin(t * 3 + i);
    const ex: Expr = i === 4 || i === 5 ? (on(t, 370 / 30) ? "grin" : "smile") : pick(["smile", "amazed", "smile_closed", "grin"], i);
    const view = close ? FRONT : viewOf(cam, x, z, 0, -1);
    out.places.push(person(cam, { i: 400 + i, o, okey: `q${i}` }, x, 0.12, z + shuffle, view,
      { mode: "stand", expr: ex, look: i % 3 === 0 ? -1 : 0, blink: lidAt(t, 400 + i), wave: i === 4 && on(t, 370 / 30) ? q(Math.sin(t * 9), 20) : undefined },
      { mode: "stand", expr: ex, blink: lidAt(t, 400 + i) }));
    blob(out, x, 0.12, z);
  }
};

/** seated rows facing the screen (camera near the screen) */
const audience = (cam: CamInfo, t: number, out: Stage, era: "old" | "new") => {
  const [ox, , oz] = THE;
  let n = 0;
  for (const z of [-1.6, 0.8, 3.2, 5.6, 8.0]) for (let k = 0; k < 9; k++) {
    const i = n++, x = ox - 4.1 + k * 1.03 + (hh(i, 7) - 0.5) * 0.2;
    if (hh(i, 8) < 0.12) continue;
    const isKid = era === "new" && i % 6 === 4;
    const o = era === "old" ? old(i + 80) : isKid ? kid(i) : modern(i + 30);
    let ex: Expr, tilt = 0, pose: FrontOpts["pose"] = null;
    if (era === "old") {
      ex = on(t, W.gumagalaw) ? pick(["amazed", "shock", "amazed", "grin"], i) : pick(["neutral", "smile", "neutral"], i);
      if (on(t, W.gumagalaw)) tilt = (i % 3 - 1) * 6 * smooth((t - W.gumagalaw) * 4);
      if (on(t, W.gumagalaw) && i % 5 === 2) pose = "cover";
    } else {
      const laughing = Math.sin(t * 2.2 + i * 0.7) > -0.3;
      ex = on(t, W.malamig) && i % 4 === 1 ? "nervous" : laughing ? pick(["laugh", "grin", "laugh", "smile_closed"], i) : "smile";
      tilt = laughing ? 4 * Math.sin(t * 9 + i) : 0;
    }
    const prop = era === "new" && !pose && i % 3 === 0 ? "popcorn" : null;
    out.places.push(person(cam, { i: 500 + i, o, okey: `a${era}${i}` }, x, 0.44, oz + z, FRONT,
      { mode: "sit", expr: ex, tilt: q(tilt, 2), pose, prop, blink: lidAt(t, 500 + i) }, {}, isKid ? 0.74 : 1));
    if (era === "new" && on(t, W.malamig) && i % 4 === 1) out.fx.push({ key: "shiver", cw: 200, ch: 140, draw: shiver, x, y: 1.7, z: oz + z, w: 0.7, h: 0.5 });
  }
};

const studioCrew = (cam: CamInfo, t: number, out: Stage, beat: "director" | "japan") => {
  const [ox, , oz] = STU, f = t * FPS;
  if (beat === "director") {
    const shout = Math.sin(t * 6) > 0;
    out.places.push(person(cam, { i: 700, o: DIRECTOR, okey: "dir" }, ox - 0.6, 0, oz + 1.9, FRONT,
      { mode: "stand", expr: shout ? "shout" : "grin", prop: "megaphone", facing: -1, blink: lidAt(t, 700) }));
    blob(out, ox - 0.6, 0, oz + 1.9);
    out.places.push(person(cam, { i: 701, o: LEADING, okey: "lead" }, ox - 2.6, 0, oz - 0.9, FRONT, { mode: "stand", expr: "smile_closed", pose: "hips", blink: lidAt(t, 701) }));
    out.places.push(person(cam, { i: 702, o: HERO_RUN, okey: "heroR" }, ox - 1.5, 0, oz - 1.4, FRONT, { mode: "stand", expr: "stern", pose: "fist", pk: 1, blink: lidAt(t, 702) }));
    out.places.push(person(cam, { i: 703, o: CREW(1), okey: "crew1" }, ox + 1.9, 0, oz + 2.1, FRONT, { mode: "stand", expr: "neutral", blink: lidAt(t, 703) }));
    for (const [x, z] of [[-2.6, -0.9], [-1.5, -1.4], [1.9, 2.1]]) blob(out, ox + x, 0, oz + z);
    if (f >= 546) { // crew members carrying reels to the growing stack, one looking up at it
      out.places.push(person(cam, { i: 704, o: CREW(2), okey: "crew2" }, STACK_PH[0] + 1.3, 0, STACK_PH[2] + 0.9, FRONT,
        { mode: "stand", expr: cansAt(t) > 14 ? "amazed" : "grin", prop: "reel", look: -1, blink: lidAt(t, 704) }));
      blob(out, STACK_PH[0] + 1.3, 0, STACK_PH[2] + 0.9);
    }
  } else {
    const shrug = on(t, W.hapon + 0.4);
    out.places.push(person(cam, { i: 700, o: DIRECTOR, okey: "dir" }, ox - 0.3, 0, oz + 2.6, FRONT,
      { mode: "stand", expr: shrug ? "nervous" : "amazed", pose: shrug ? "shrug" : null, prop: shrug ? null : "megaphone", look: 1, blink: lidAt(t, 700) }));
    out.places.push(person(cam, { i: 704, o: CREW(2), okey: "crew2" }, STACK_PH[0] + 1.0, 0, STACK_PH[2] + 1.2, FRONT, { mode: "stand", expr: "amazed", look: 1, blink: lidAt(t, 704) }));
    for (const [x, z] of [[-0.3, 2.6]]) blob(out, ox + x, 0, oz + z);
    blob(out, STACK_PH[0] + 1.0, 0, STACK_PH[2] + 1.2);
  }
};

/** cinema queue on the plaza (night): line from the door out across the plaza */
const plazaQueue = (cam: CamInfo, t: number, out: Stage, n: number, x0: number, families = true) => {
  for (let i = 0; i < n; i++) {
    const z = -8.6 + i * 0.85, x = x0 + 0.5 * Math.sin(i * 0.4) + (hh(i, 9) - 0.5) * 0.3;
    const fam = i % 4, isKid = families && fam === 3;
    const o = isKid ? kid(i + 60) : modern(i + 60);
    const view = viewOf(cam, x, z, 0, -1), ex: Expr = pick(["smile", "grin", "smile_closed", "laugh"], i);
    out.places.push(person(cam, { i: 600 + i, o, okey: `pq${i}` }, x, 0, z, view,
      { mode: "stand", expr: ex, prop: i % 5 === 1 ? "popcorn" : null, blink: lidAt(t, 600 + i) }, { mode: "stand", expr: ex, blink: lidAt(t, 600 + i) }, isKid ? 0.74 : 1));
    blob(out, x, 0, z, isKid ? 0.74 : 1);
  }
};

const xmasPlaza = (cam: CamInfo, t: number, out: Stage) => {
  plazaQueue(cam, t, out, 18, 1.6);
  for (let i = 0; i < 8; i++) { // strollers
    const dir = i % 2 ? 1 : -1, x = -6 + ((i * 3.1 + dir * 0.7 * t) % 13 + 13) % 13, z = 2 + i * 1.1;
    const view = viewOf(cam, x, z, dir, 0), ph = q((t * 0.5 + hh(i)) % 1);
    out.places.push(person(cam, { i: 650 + i, o: i % 3 === 2 ? kid(i + 70) : modern(i + 70), okey: `xs${i}` }, x, 0, z, view,
      { mode: "stroll", phase: ph, expr: "smile", blink: lidAt(t, 650 + i) }, { mode: "march", phase: ph, stomp: 0.5, stride: 0.85 * view.fs, expr: "smile" }, i % 3 === 2 ? 0.74 : 1));
    blob(out, x, 0, z, i % 3 === 2 ? 0.74 : 1);
  }
};

const FAM: [Outfit, string, number][] = [[LOLO, "lolo", 1], [LOLA, "lola", 1], [PAPA, "papa", 1], [MAMA, "mama", 1], [TITA, "tita", 1], [ANAK1, "anak1", 0.74], [ANAK2, "anak2", 0.74]];
const table = (cam: CamInfo, t: number, out: Stage, beat: "noche" | "handaan" | "why") => {
  const [ox, , oz] = HOME;
  // seats along both long sides of the table
  const seats: [number, number][] = [[-1.8, 0.95], [-0.6, 0.95], [0.6, 0.95], [1.8, 0.95], [-1.2, -0.95], [0, -0.95], [1.2, -0.95]];
  FAM.forEach(([o, key, sc], i) => {
    const [x, z] = seats[i];
    let ex: Expr = "smile", pose: FrontOpts["pose"] = null, pk = 0, mode: FrontOpts["mode"] = "sit", tilt = 0, prop: FrontOpts["prop"] = null, y = 0.44;
    if (beat === "noche") {
      ex = pick(["grin", "smile_closed", "laugh", "smile"], i); prop = i % 2 ? "plate" : null;
      if (on(t, W.pamilya)) { mode = "stand"; y = 0; pose = "cheer"; pk = q(smooth((t - W.pamilya + LEAD) * 3), 10); ex = "grin"; prop = null; }
    } else if (beat === "why") {
      ex = i === 5 ? "amazed" : "smile"; mode = i === 5 ? "stand" : "sit"; y = i === 5 ? 0 : 0.44;
    } else {
      ex = i % 2 ? "smile_closed" : "grin";
      if (on(t, W.pagtawa)) { ex = "laugh"; tilt = 5 * Math.sin(t * 10 + i); }
      if (on(t, W.iyak)) { ex = "cry"; tilt = 0; pose = i % 2 ? "cover" : null; }
      if (on(t, W.sigaw)) { ex = "shout"; pose = i % 3 === 0 ? "fist" : "shout"; pk = q(0.5 + 0.5 * Math.sin(t * 12 + i), 10); }
      if (!pose && !on(t, W.iyak)) prop = null;
    }
    out.places.push(person(cam, { i: 800 + i, o, okey: key }, ox + x, y, oz + z, FRONT,
      { mode, expr: ex, pose, pk, tilt: q(tilt, 2), prop, look: beat === "handaan" && !on(t, W.kundi) ? 0 : 0, blink: lidAt(t, 800 + i) }, {}, sc));
    if (mode === "stand") blob(out, ox + x, 0, oz + z, sc);
    if (beat === "handaan" && on(t, W.iyak) && !on(t, W.sigaw) && ex === "cry" && i % 2 === 0) {
      const u = ((t * 1.6 + i * 0.3) % 1);
      out.fx.push({ key: "tear", cw: 64, ch: 80, draw: tear, x: ox + x + 0.08, y: y + 1.45 * sc - 0.3 * u, z: oz + z + 0.05, w: 0.06, h: 0.08 });
    }
    if (beat === "handaan" && on(t, W.sigaw) && i % 2 === 0) out.fx.push({ key: "shout", cw: 200, ch: 200, draw: shoutLines, x: ox + x - 0.25, y: y + 1.5 * sc, z: oz + z, w: 0.5, h: 0.5 });
  });
};

const voters = (cam: CamInfo, t: number, out: Stage) => {
  // official behind the table, a voter dropping the ballot, a short line
  out.places.push(person(cam, { i: 950, o: { ...CREW(0), motif: "barong", jacket: "#f4efe4" }, okey: "offc" }, -4.0, 0.44, -2.6, FRONT, { mode: "sit", expr: "smile", blink: lidAt(t, 950) }));
  const drop = smooth((t - 1068 / 30) * 2.5);
  out.places.push(person(cam, { i: 951, o: MAMA, okey: "mama" }, -4.4, 0, -0.85, FRONT, { mode: "stand", expr: drop > 0.9 ? "smile_closed" : "smile", prop: drop < 0.9 ? "ballot" : null, blink: lidAt(t, 951) }));
  blob(out, -4.4, 0, -0.85);
  for (let i = 0; i < 4; i++) {
    const x = -3.4 + i * 0.75, z = 0.3 + i * 0.95;
    out.places.push(person(cam, { i: 952 + i, o: modern(i + 90), okey: `v${i}` }, x, 0, z, FRONT, { mode: "stand", expr: pick(["smile", "grin", "smile_closed"], i), prop: "ballot", blink: lidAt(t, 952 + i) }));
    blob(out, x, 0, z);
  }
};

const palaceCrowd = (cam: CamInfo, t: number, out: Stage, beat: "balcony" | "heroic") => {
  const [ox, , oz] = PAL, hx = ox, hy = 4.7, hz = oz - 5.15;
  const cheer = beat === "balcony";
  out.places.push(person(cam, { i: 900, o: HERO_PRES, okey: "heroP" }, hx, hy, hz, FRONT,
    cheer ? { mode: "stand", expr: "grin", pose: on(t, W.presidente2) ? "cheer" : "fist", pk: q(0.5 + 0.5 * Math.sin(t * 7), 20), blink: lidAt(t, 900) }
      : { mode: "stand", expr: on(t, W.magligtas) ? "grin" : "stern", pose: "hips", headTilt: -4, blink: lidAt(t, 900) }));
  confetti(out, t, cheer ? 1109 / 30 : 0, [hx, 4.6, hz + 3.5], 10, 6, 8, 90);
  if (!cheer) { // hero sparkles
    for (let k = 0; k < 4; k++) {
      const u = ((t * 0.9 + k * 0.25) % 1), a = k * 1.7;
      out.fx.push({ key: "spark", cw: 100, ch: 100, draw: sparkle, x: hx + 0.9 * Math.cos(a), y: hy + 1.9 + 0.6 * Math.sin(a), z: hz + 0.3, w: 0.3 * Math.sin(u * Math.PI), h: 0.3 * Math.sin(u * Math.PI) });
    }
  }
  if (cheer) for (let i = 0; i < 16; i++) { // supporters on the lawn either side, cheering in profile
    const s = i % 2 ? 1 : -1, x = ox + s * (3.6 + (i >> 1) % 4 * 1.1), z = oz + 1 + Math.floor(i / 8) * 1.6 + hh(i) * 0.5;
    const view = viewOf(cam, x, z, 0, -1), isKid = i % 5 === 3;
    out.places.push(person(cam, { i: 960 + i, o: isKid ? kid(i + 100) : modern(i + 100), okey: `pc${i}` }, x, 0, z, view,
      { mode: "stand", expr: "grin", pose: "cheer", pk: q(0.5 + 0.5 * Math.sin(t * 8 + i), 10), blink: lidAt(t, 960 + i) }, { mode: "stand", expr: "grin" }, isKid ? 0.74 : 1));
    blob(out, x, 0, z, isKid ? 0.74 : 1);
  }
};

const desk = (cam: CamInfo, t: number, out: Stage) => {
  const [ox, , oz] = OFF;
  const after = on(t, W.doble), look = after ? (Math.sin((t - W.doble) * 5) > 0 ? 1 : -1) : 0;
  out.places.push(person(cam, { i: 900, o: HERO_PRES, okey: "heroP" }, ox - 0.1, 0, oz - 1.45, FRONT,
    { mode: "stand", expr: after ? "sweat" : "nervous", look, pose: on(t, W.doble + 0.9) ? "shrug" : null, blink: lidAt(t, 900) }));
  // a paper slides off the top of the tall stack on "Malakanyang"
  const u = clamp01((t - 1331 / 30) / 0.8);
  if (u > 0 && u < 1) out.fx.push({ key: "paper", cw: 80, ch: 100, draw: (p) => p.poly([[5, 5], [75, 10], [70, 95], [8, 90]], "#fbf8ef", 3), x: ox + 1.95 - 0.5 * u, y: 2.65 - 2.4 * u * u, z: oz - 1.0 + 0.6 * u, w: 0.24, h: 0.3, rot: u * 4 });
};

const hotPlaza = (cam: CamInfo, t: number, out: Stage) => {
  for (const s of grid(12, -4.5, 4.5, -2, 5, 7)) {
    const isKid = s.i % 5 === 2, o = isKid ? kid(s.i) : modern(s.i + 40);
    out.places.push(person(cam, { i: s.i, o, okey: `h${s.i}` }, s.x, 0, s.z, FRONT,
      { mode: "stand", expr: "sweat", prop: s.i % 2 ? "fan" : null, phase: q((t * 3 + hh(s.i)) % 1, 12), tilt: q(3 * Math.sin(t * 2 + s.i), 2), blink: lidAt(t, s.i) }, {}, isKid ? 0.74 : 1));
    blob(out, s.x, 0, s.z, isKid ? 0.74 : 1);
    const k = q((t * 1.2 + hh(s.i, 3)) % 1, 12);
    if (s.i % 3 === 0) out.fx.push({ key: `heat${k}`, cw: 240, ch: 240, draw: (p) => heatWave(p, k), x: s.x, y: 2.4, z: s.z, w: 0.8, h: 0.8, soft: true });
  }
};

const phoneBench = (cam: CamInfo, t: number, out: Stage) => {
  const [ox, , oz] = HOME;
  const seats: [Outfit, string, number, number][] = [[LOLA, "lola", -1.25, 1], [PAPA, "papa", -0.62, 1], [ANAK1, "anak1", 0, 0.74], [MAMA, "mama", 0.6, 1], [LOLO, "lolo", 1.2, 1]];
  const together = on(t, W.samasama);
  seats.forEach(([o, key, x, sc], i) => {
    const lean = x === 0 ? 0 : (x < 0 ? 1 : -1) * (8 + 4 * Math.abs(x));
    const ex: Expr = together ? (i % 2 ? "laugh" : "grin") : i === 2 ? "grin" : "smile";
    out.places.push(person(cam, { i: 820 + i, o, okey: key }, ox + x, 0.42, oz - 3.3, FRONT,
      { mode: "sit", expr: ex, tilt: q(lean + (together ? 3 * Math.sin(t * 9 + i) : 0), 2), prop: x === 0 ? "phone" : null, look: x < 0 ? 1 : x > 0 ? -1 : 0, blink: lidAt(t, 820 + i) }, {}, sc));
  });
};

const rally = (cam: CamInfo, t: number, out: Stage) => {
  const who: [Outfit, string, number][] = [[CAND1, "cand1", -2.4], [HERO_RUN, "heroR", 0], [CAND3, "cand3", 2.4]];
  const big = on(t, W.sino);
  who.forEach(([o, key, x], i) => {
    const hero = i === 1;
    const fo: FrontOpts = hero && big ? { mode: "stand", expr: "grin", pose: "hips", blink: lidAt(t, 990 + i) }
      : { mode: "stand", expr: big ? "nervous" : "smile", wave: big ? undefined : q(Math.sin(t * 6 + i), 20), look: big && !hero ? (x < 0 ? 1 : -1) : 0, blink: lidAt(t, 990 + i) };
    out.places.push(person(cam, { i: 990 + i, o, okey: key }, x, 1.1, -8.6, FRONT, fo));
    blob(out, x, 1.1, -8.6);
  });
  if (big) for (let k = 0; k < 5; k++) {
    const u = ((t * 0.8 + k * 0.2) % 1), a = k * 1.3;
    out.fx.push({ key: "spark", cw: 100, ch: 100, draw: sparkle, x: 0.9 * Math.cos(a), y: 3.0 + 0.7 * Math.sin(a), z: -8.4, w: 0.32 * Math.sin(u * Math.PI), h: 0.32 * Math.sin(u * Math.PI) });
  }
  for (let i = 0; i < 18; i++) { // supporters in front of the stage, in profile at the sides of the frame
    const s = i % 2 ? 1 : -1, x = s * (2.2 + (i >> 1) % 4 * 1.0), z = -5 + Math.floor(i / 8) * 1.4 + hh(i) * 0.6;
    const view = viewOf(cam, x, z, 0, -1), isKid = i % 6 === 4;
    out.places.push(person(cam, { i: 1000 + i, o: isKid ? kid(i + 120) : modern(i + 120), okey: `r${i}` }, x, 0, z, view,
      { mode: "stand", expr: big ? "amazed" : "grin", pose: big ? null : "cheer", pk: q(0.5 + 0.5 * Math.sin(t * 7 + i), 10), blink: lidAt(t, 1000 + i) }, { mode: "stand", expr: big ? "amazed" : "grin" }, isKid ? 0.74 : 1));
    blob(out, x, 0, z, isKid ? 0.74 : 1);
  }
};

/** everything with a face in shot `id` at time t */
export const stage = (id: number, t: number, cam: CamInfo): Stage => {
  const out: Stage = { places: [], fx: [] };
  const s = SHOTS[id - 1];
  LNAME = s.light; SUN.copy(cam.sun).normalize();
  switch (s.beat) {
    case "hook": hook(cam, t, out); break;
    case "hero": heroMarquee(cam, t, out); break;
    case "street": street1897(cam, t, out); break;
    case "queue1897": queue1897(cam, t, out); break;
    case "screen1897": audience(cam, t, out, "old"); break;
    case "director": studioCrew(cam, t, out, "director"); break;
    case "japan": studioCrew(cam, t, out, "japan"); break;
    case "xmas": xmasPlaza(cam, t, out); break;
    case "noche": table(cam, t, out, "noche"); break;
    case "queue": plazaQueue(cam, t, out, 22, 5.2); break;
    case "vote": voters(cam, t, out); break;
    case "balcony": palaceCrowd(cam, t, out, "balcony"); break;
    case "heroic": palaceCrowd(cam, t, out, "heroic"); break;
    case "desk": desk(cam, t, out); break;
    case "why": table(cam, t, out, "why"); break;
    case "handaan": table(cam, t, out, "handaan"); break;
    case "cinema": audience(cam, t, out, "new"); break;
    case "hot": hotPlaza(cam, t, out); break;
    case "phone": phoneBench(cam, t, out); break;
    case "election": rally(cam, t, out); break;
  }
  return out;
};
export { FPS, CAN_H };
