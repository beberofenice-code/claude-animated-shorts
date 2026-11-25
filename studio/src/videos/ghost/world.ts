// The whole film as one three.js scene: sky, open sea, the Mary Celeste and the Dei Gratia (hull, deck, deckhouse,
// hatches, masts, yards, billowing sails, rigging, the self-steering wheel), the yawl and its towline, the cargo hold,
// the smoke-alarm house and the doctor's study, plus the cast. update(id, f, camera) poses everything for shot `id`
// at frame f (a pure function of id + f). Look values (light rig, two-tone shading, sky, water) follow the bridge short.
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { Batch, Strand, boxGeo, V, lam, Kit, house } from "./build";
import { rep, ctex, planksHD, beamHD, grassHD, cobbleHD, waterNear, waterFar, cloudHD, rng } from "./paint";
import { LIGHTS, LOOK, LightPreset } from "./lights";
import { TONE, CHAR, LFB, twoTone, untone } from "./shade";
import { NOINK } from "./ink";
import { Pool, Actor, Fx, stage } from "./cast";
import {
  FPS, SHOTS, camAt, V3, ShotDef, DECK, RAIL, STERN, WHEEL, HOLD, HOUSE, STUDY, add, shipPose, toWorld, Pose, sailFill, wheelAngle,
  doorAngle, MODEL_BOAT_T, SNAP_T, mcAt, boatAt, smooth,
} from "./story";

export const loadKit = () => Promise.resolve({} as Kit);

// ---------------- painted textures ----------------
const discTex = () => ctex("sunDisc", 128, 128, (g) => {
  const gr = g.createRadialGradient(64, 64, 58, 64, 64, 64); gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
});
const haloTex = () => ctex("sunHalo", 256, 256, (g) => {
  const im = g.createImageData(256, 256);
  for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
    const u = Math.hypot(x - 127.5, y - 127.5) / 128;
    const a = (0.55 * Math.exp(-((u / 0.25) ** 2)) + 0.35 * Math.exp(-((u / 0.6) ** 2))) * (1 - Math.min(1, Math.max(0, (u - 0.8) / 0.2)));
    const i = (y * 256 + x) * 4; im.data[i] = im.data[i + 1] = im.data[i + 2] = 255; im.data[i + 3] = Math.round(255 * Math.min(1, a));
  }
  g.putImageData(im, 0, 0);
});
/** hull sides by height: cream rail cap, varnished wale with a gold stripe, painted hull, white boot top, red below */
const HY0 = -2.2, HY1 = 5.0; // v = (y - HY0) / (HY1 - HY0)
const hullTex = (key: string, body: string, wale: string) => ctex("hull" + key, 1024, 512, (g, r) => {
  const Y = (y: number) => 512 - ((y - HY0) / (HY1 - HY0)) * 512;
  g.fillStyle = "#a3402f"; g.fillRect(0, 0, 1024, 512);
  g.fillStyle = body; g.fillRect(0, Y(RAIL + 0.6), 1024, Y(0.32) - Y(RAIL + 0.6));
  g.fillStyle = "#f1ead8"; g.fillRect(0, Y(0.32), 1024, Y(0.04) - Y(0.32)); // boot top
  g.fillStyle = wale; g.fillRect(0, Y(DECK + 0.25), 1024, Y(DECK - 0.15) - Y(DECK + 0.25));
  g.fillStyle = "#e3b54a"; g.fillRect(0, Y(DECK - 0.06), 1024, 7); // gold stripe
  g.fillStyle = "#efe6d0"; g.fillRect(0, 0, 1024, Y(RAIL - 0.06)); // rail cap
  // plank seams + soft streaks (dark tints, painted in)
  for (let y = Y(RAIL); y < Y(0.3); y += 22) { g.fillStyle = "rgba(10,10,20,.16)"; g.fillRect(0, y, 1024, 2); }
  for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(255,255,255,${(0.02 + r() * 0.03).toFixed(3)})`; g.fillRect(r() * 1024, Y(RAIL) + r() * 60, 3 + r() * 6, 40 + r() * 120); }
  for (let i = 0; i < 26; i++) { g.fillStyle = `rgba(60,40,30,${(0.05 + r() * 0.05).toFixed(3)})`; g.fillRect(r() * 1024, Y(1.2), 2 + r() * 5, 30 + r() * 70); }
});
const canvasTex = (key: string, tint: string) => ctex("sail" + key, 512, 512, (g, r) => {
  g.fillStyle = tint; g.fillRect(0, 0, 512, 512);
  for (let x = 0; x < 512; x += 42) { g.fillStyle = "rgba(90,70,50,.18)"; g.fillRect(x, 0, 3, 512); } // cloth seams
  for (let i = 0; i < 70; i++) { g.fillStyle = `rgba(120,100,70,${(0.02 + r() * 0.04).toFixed(3)})`; g.beginPath(); g.ellipse(r() * 512, r() * 512, 20 + r() * 60, 10 + r() * 30, r() * 3, 0, 7); g.fill(); }
  g.fillStyle = "rgba(90,70,50,.3)"; g.fillRect(0, 0, 512, 8); g.fillRect(0, 504, 512, 8); g.fillRect(0, 0, 8, 512); g.fillRect(504, 0, 8, 512);
});
const houseTex = () => ctex("deckhouse", 1024, 512, (g, r) => {
  g.fillStyle = "#e8dcc2"; g.fillRect(0, 0, 1024, 512);
  for (let y = 0; y < 512; y += 36) { g.fillStyle = "rgba(80,60,40,.14)"; g.fillRect(0, y, 1024, 3); }
  for (const x of [120, 400, 680, 900]) { // square windows with green frames
    g.fillStyle = "#3d6b55"; g.fillRect(x - 54, 150, 108, 108);
    g.fillStyle = "#2a3550"; g.fillRect(x - 40, 164, 80, 80);
    g.fillStyle = "rgba(170,200,240,.45)"; g.fillRect(x - 36, 168, 26, 72);
    g.fillStyle = "#3d6b55"; g.fillRect(x - 3, 164, 6, 80); g.fillRect(x - 40, 201, 80, 6);
  }
  for (let i = 0; i < 30; i++) { g.fillStyle = `rgba(90,70,50,${(0.03 + r() * 0.05).toFixed(3)})`; g.fillRect(r() * 1024, r() * 512, 4 + r() * 30, 2 + r() * 8); }
});
const doorTex = (key: string, col: string) => ctex("door" + key, 256, 512, (g) => {
  g.fillStyle = col; g.fillRect(0, 0, 256, 512);
  g.strokeStyle = "rgba(20,10,10,.45)"; g.lineWidth = 8;
  g.strokeRect(34, 34, 188, 190); g.strokeRect(34, 270, 188, 205);
  g.fillStyle = "#e3b54a"; g.beginPath(); g.arc(205, 270, 14, 0, 7); g.fill();
});
const gratingTex = () => ctex("grating", 256, 256, (g) => {
  g.fillStyle = "#2a2220"; g.fillRect(0, 0, 256, 256);
  g.fillStyle = "#a87a4c"; for (let i = 0; i < 256; i += 32) { g.fillRect(i, 0, 16, 256); g.fillRect(0, i, 256, 16); }
});
const staveTex = (key: string, wood: string[]) => ctex("staves" + key, 512, 256, (g, r) => {
  for (let x = 0; x < 512; x += 32) { g.fillStyle = wood[Math.floor(r() * wood.length)]; g.fillRect(x, 0, 32, 256); g.fillStyle = "rgba(30,15,10,.45)"; g.fillRect(x, 0, 3, 256); }
  for (let i = 0; i < 60; i++) { g.fillStyle = `rgba(60,30,15,${(0.05 + r() * 0.08).toFixed(3)})`; g.fillRect(r() * 512, r() * 256, 2, 20 + r() * 50); }
  g.fillStyle = "#3b3a40"; for (const y of [34, 60, 196, 222]) g.fillRect(0, y - 9, 512, 18); // iron hoops
  g.fillStyle = "rgba(255,255,255,.18)"; for (const y of [30, 56, 192, 218]) g.fillRect(0, y - 6, 512, 3);
});
const paperTex = () => ctex("papers", 512, 512, (g, r) => {
  g.fillStyle = "#f4ecd8"; g.fillRect(0, 0, 512, 512);
  g.strokeStyle = "rgba(40,40,70,.75)"; g.lineWidth = 4; g.lineCap = "round";
  for (let y = 60; y < 470; y += 34) { // handwriting squiggles, no readable text
    g.beginPath(); let x = 40 + r() * 20; g.moveTo(x, y);
    while (x < 470 - r() * 60) { x += 8; g.lineTo(x, y + 6 * Math.sin(x * 0.35 + y) * r()); }
    g.stroke();
  }
});
const wallpaperTex = () => ctex("wallpaper", 512, 512, (g, r) => {
  g.fillStyle = "#5e7d62"; g.fillRect(0, 0, 512, 512);
  for (let x = 0; x < 512; x += 64) { g.fillStyle = "#6c8c6e"; g.fillRect(x, 0, 30, 512); }
  for (let i = 0; i < 40; i++) { g.fillStyle = "rgba(240,220,170,.25)"; const x = (i % 8) * 64 + 47, y = Math.floor(i / 8) * 110 + 40; g.beginPath(); g.arc(x, y, 7, 0, 7); g.fill(); }
  for (let i = 0; i < 20; i++) { g.fillStyle = `rgba(30,20,20,${(0.02 + r() * 0.03).toFixed(3)})`; g.fillRect(r() * 512, r() * 512, 40, 40); }
});
const spinesTex = () => ctex("spines", 512, 512, (g, r) => {
  g.fillStyle = "#3a2a22"; g.fillRect(0, 0, 512, 512);
  const cols = ["#7a2f2f", "#2f4f7a", "#3e6a42", "#8c6a2e", "#5a3b6a", "#9a4a2a", "#2e5e5e"];
  for (let row = 0; row < 4; row++) {
    let x = 8;
    while (x < 500) {
      const w = 14 + r() * 22, h = 90 + r() * 25;
      g.fillStyle = cols[Math.floor(r() * cols.length)]; g.fillRect(x, row * 128 + 120 - h, w, h);
      g.fillStyle = "rgba(240,210,120,.6)"; g.fillRect(x + 3, row * 128 + 120 - h + 14, w - 6, 4);
      x += w + 2;
    }
    g.fillStyle = "#5a4030"; g.fillRect(0, row * 128 + 120, 512, 8);
  }
});
const globeTex = () => ctex("globe", 1024, 512, (g, r) => {
  g.fillStyle = "#6fa7c9"; g.fillRect(0, 0, 1024, 512);
  const land = (cx: number, cy: number, s: number) => { g.fillStyle = "#d9c27a"; for (let i = 0; i < 9; i++) { g.beginPath(); g.ellipse(cx + (r() - 0.5) * s, cy + (r() - 0.5) * s * 0.8, s * (0.2 + r() * 0.25), s * (0.15 + r() * 0.2), r() * 3, 0, 7); g.fill(); } };
  land(200, 170, 160); land(260, 340, 120); land(560, 150, 170); land(600, 320, 140); land(820, 180, 190); land(880, 380, 90);
  g.strokeStyle = "rgba(255,255,255,.35)"; g.lineWidth = 2;
  for (let y = 64; y < 512; y += 64) { g.beginPath(); g.moveTo(0, y); g.lineTo(1024, y); g.stroke(); }
  for (let x = 0; x < 1024; x += 85) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 512); g.stroke(); }
});
const foamTex = () => ctex("foam", 512, 64, (g, r) => {
  const gr = g.createLinearGradient(0, 0, 0, 64); gr.addColorStop(0, "rgba(255,255,255,0.95)"); gr.addColorStop(0.35, "rgba(240,250,255,0.6)"); gr.addColorStop(1, "rgba(240,250,255,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 512, 64);
  g.globalCompositeOperation = "destination-out";
  for (let i = 0; i < 90; i++) { g.beginPath(); g.ellipse(r() * 512, 20 + r() * 44, 6 + r() * 16, 3 + r() * 8, 0, 0, 7); g.fillStyle = "rgba(0,0,0,.7)"; g.fill(); }
});

// ---------------- geometry builders ----------------
const beamBetween = (a: THREE.Vector3, b: THREE.Vector3, th: number, round = false) => {
  const g = round ? new THREE.CylinderGeometry(th / 2, th / 2, a.distanceTo(b), 6) : new THREE.BoxGeometry(th, a.distanceTo(b), th);
  const m = new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5),
    new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), b.clone().sub(a).normalize()), V(1, 1, 1));
  return g.applyMatrix4(m);
};
type HullSpec = { L: number; B: number; rail: number; keel: number; sheer: number; transom: number };
/** half-width of the hull at u in [-1 stern, 1 bow] */
const halfW = (h: HullSpec, u: number) => (h.B / 2) * (u < 0 ? 1 - (1 - h.transom) * (-u) ** 2.4 : Math.max(0, 1 - u ** 2.1));
const railAt = (h: HullSpec, u: number) => h.rail + h.sheer * (u > 0 ? 1.4 : 0.8) * u * u;
/** lofted hull skin: stations along z, sections from the rail down to the keel. inset > 0 builds the inner bulwark
 *  (deck to rail, facing the centre line) */
const hullSkin = (h: HullSpec, inset = 0, yLow = h.keel, flip = false, tileU = 0) => {
  const NZ = 44, NS = 12, pos: number[] = [], uv: number[] = [], idx: number[] = [];
  for (const side of [-1, 1]) {
    const base = pos.length / 3;
    for (let i = 0; i < NZ; i++) {
      const u = -1 + (2 * i) / (NZ - 1), z = (u * h.L) / 2, top = railAt(h, u), hw = Math.max(0, halfW(h, u) - inset);
      for (let j = 0; j < NS; j++) {
        const s = j / (NS - 1), y = top + (yLow - top) * s;
        const x = inset ? hw : hw * Math.sqrt(Math.max(0, 1 - Math.max(0, (top - y) / (top - h.keel) - 0.35) ** 2 / 0.4225));
        pos.push(side * x, y, z);
        uv.push(tileU ? z / tileU : (z + h.L / 2) / 6, (y - HY0) / (HY1 - HY0));
      }
    }
    for (let i = 0; i < NZ - 1; i++) for (let j = 0; j < NS - 1; j++) {
      const a = base + i * NS + j, b = a + NS, c = b + 1, d = a + 1;
      const out = (side > 0) !== flip;
      if (out) idx.push(a, b, d, b, c, d); else idx.push(a, d, b, b, d, c);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
};
/** horizontal outline polygon at height y following the hull half-width minus inset (deck / rail caps / floors) */
const outline = (h: HullSpec, inset: number, n = 40) => {
  const pts: [number, number][] = [];
  for (let i = 0; i < n; i++) { const u = -1 + (2 * i) / (n - 1); pts.push([Math.max(0.02, halfW(h, u) - inset), (u * h.L) / 2]); }
  return pts;
};
const flatShape = (pts: [number, number][], y: number, tile: number, swap = true) => {
  const shape = new THREE.Shape();
  const all = [...pts.map(([x, z]) => [x, z] as [number, number]), ...pts.slice().reverse().map(([x, z]) => [-x, z] as [number, number])];
  all.forEach(([x, z], i) => (i ? shape.lineTo(x, -z) : shape.moveTo(x, -z)));
  const g = new THREE.ShapeGeometry(shape); g.rotateX(-Math.PI / 2); g.translate(0, y, 0);
  const p = g.attributes.position, uv: number[] = [];
  for (let i = 0; i < p.count; i++) uv.push(swap ? p.getZ(i) / tile : p.getX(i) / tile, swap ? p.getX(i) / tile : p.getZ(i) / tile);
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  return g;
};
/** rail cap: a flat ribbon on the bulwark top between the outer skin and the inner bulwark */
const railCap = (h: HullSpec, th: number) => {
  const pos: number[] = [], idx: number[] = [], NZ = 44;
  for (const side of [-1, 1]) {
    const base = pos.length / 3;
    for (let i = 0; i < NZ; i++) {
      const u = -1 + (2 * i) / (NZ - 1), z = (u * h.L) / 2, y = railAt(h, u) + 0.01, hw = halfW(h, u);
      pos.push(side * (hw + 0.03), y, z, side * Math.max(0, hw - th), y, z);
    }
    for (let i = 0; i < NZ - 1; i++) { const a = base + i * 2; if (side > 0) idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); else idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(new Array((pos.length / 3) * 2).fill(0), 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
};
const transomGeo = (h: HullSpec) => {
  const hw = halfW(h, -1), top = railAt(h, -1), z = -h.L / 2;
  const shape = new THREE.Shape();
  shape.moveTo(-hw, top); shape.lineTo(hw, top);
  for (let j = 1; j <= 10; j++) { const s = j / 10, y = top + (h.keel - top) * s; const x = hw * Math.sqrt(Math.max(0, 1 - Math.max(0, (top - y) / (top - h.keel) - 0.35) ** 2 / 0.4225)); shape.lineTo(x, y); }
  for (let j = 10; j >= 1; j--) { const s = j / 10, y = top + (h.keel - top) * s; const x = hw * Math.sqrt(Math.max(0, 1 - Math.max(0, (top - y) / (top - h.keel) - 0.35) ** 2 / 0.4225)); shape.lineTo(-x, y); }
  const g = new THREE.ShapeGeometry(shape); g.rotateY(Math.PI); g.translate(0, 0, z);
  const p = g.attributes.position, uv: number[] = [];
  for (let i = 0; i < p.count; i++) uv.push(p.getX(i) / 6, (p.getY(i) - HY0) / (HY1 - HY0));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  return g;
};
/** billowing sail grid: corners tl, tr, br, bl (local); bulge direction n; updated per frame */
class Sail {
  mesh: THREE.Mesh; private g: THREE.BufferGeometry; private N = 10;
  constructor(parent: THREE.Object3D, mat: THREE.Material, public c: THREE.Vector3[], public n: THREE.Vector3, public depth: number, public tri = false) {
    const N = this.N, g = (this.g = new THREE.BufferGeometry()), uv: number[] = [], idx: number[] = [];
    for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) uv.push(i / N, 1 - j / N);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const a = j * (N + 1) + i, b = a + 1, c = a + N + 2, d = a + N + 1; idx.push(a, d, b, b, d, c); }
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array((N + 1) ** 2 * 3), 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
    this.mesh = new THREE.Mesh(g, mat); this.mesh.castShadow = true; this.mesh.receiveShadow = true; this.mesh.frustumCulled = false;
    parent.add(this.mesh);
    this.set(0.7, 0);
  }
  set(fill: number, t: number) {
    const N = this.N, p = this.g.attributes.position as THREE.BufferAttribute, [tl, tr, br, bl] = this.c, v = new THREE.Vector3();
    for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) {
      const s = i / N, r = j / N;
      const top = this.tri ? tl.clone().lerp(tr, s * (1 - r)) : tl.clone().lerp(tr, s), bot = this.tri ? bl.clone().lerp(br, s) : bl.clone().lerp(br, s);
      v.copy(top).lerp(bot, r);
      const b = Math.sin(Math.PI * s) * Math.sin(Math.PI * Math.min(1, r * 1.1)) * (0.25 + 0.75 * fill) + 0.03 * (1 - fill) * Math.sin(9 * s + 3 * r + t * 5);
      v.addScaledVector(this.n, b * this.depth);
      p.setXYZ(j * (N + 1) + i, v.x, v.y, v.z);
    }
    p.needsUpdate = true; this.g.computeVertexNormals();
  }
}

type ShipParts = { root: THREE.Group; sails: Sail[]; wheel: THREE.Group | null; cover: THREE.Mesh | null; hole: THREE.Mesh | null; boat: THREE.Group | null };
const RIG = () => lam("rigging", () => ({ color: "#3a2c24" }));
/** a brigantine: square-rigged foremast, fore-and-aft mainsail, two jibs; hull colours per ship */
const makeShip = (name: string, body: string, wale: string, sailTint: string): ShipParts => {
  const root = new THREE.Group(), b = new Batch();
  const h: HullSpec = { L: 30, B: 7.4, rail: RAIL, keel: -2.1, sheer: 0.45, transom: 0.72 };
  const hullM = lam("hullM" + name, () => ({ map: hullTex(name, body, wale) }));
  const cream = lam("cream", () => ({ color: "#efe6d0" }));
  const wood = lam("woodDark", () => ({ map: rep(beamHD(), 1, 1) }));
  const deckM = lam("deckPlanks", () => ({ map: planksHD() }));
  b.add(hullSkin(h), hullM);
  b.add(transomGeo(h), hullM);
  b.add(hullSkin(h, 0.16, DECK - 0.05, true, 0), cream);
  b.add(railCap(h, 0.16), lam("railCap", () => ({ color: "#8a5a34" })));
  b.add(flatShape(outline(h, 0.12), DECK, 4), deckM);
  // deckhouse aft, with roof cap
  const dh = lam("deckhouseM", () => ({ map: houseTex() }));
  b.add(boxGeo(V(-2.0, DECK, -11.6), V(2.0, DECK + 2.0, -7.2)), dh);
  b.add(boxGeo(V(-2.25, DECK + 2.0, -11.85), V(2.25, DECK + 2.18, -6.95)), lam("roofCap", () => ({ color: "#8a5a34" })));
  b.add(boxGeo(V(-0.45, DECK, -7.19), V(0.45, DECK + 1.75, -7.12)), lam("dhDoor", () => ({ map: doorTex("dh", "#3d6b55") })));
  // wheel box + binnacle
  b.add(boxGeo(V(-0.35, DECK, -13.55), V(0.35, DECK + 0.95, -13.15)), wood);
  b.add(new THREE.CylinderGeometry(0.22, 0.26, 1.0, 10).translate(0, DECK + 0.5, -12.4), lam("binnacle", () => ({ color: "#d8c9a6" })));
  // main hatch with the empty lifeboat chocks; fore hatch (cover toggled)
  b.add(boxGeo(V(-1.3, DECK, 0), V(1.3, DECK + 0.42, 2.6)), wood);
  b.add(boxGeo(V(-1.2, DECK + 0.42, 0.1), V(1.2, DECK + 0.44, 2.5)), lam("grate", () => ({ map: rep(gratingTex(), 3, 3) })));
  for (const z of [0.45, 2.15]) {
    const shape = new THREE.Shape(); shape.moveTo(-1.0, 0); shape.lineTo(1.0, 0); shape.lineTo(1.0, 0.42); shape.quadraticCurveTo(0, -0.05, -1.0, 0.42); shape.lineTo(-1.0, 0);
    const cg = new THREE.ExtrudeGeometry(shape, { depth: 0.22, bevelEnabled: false }); cg.translate(0, DECK + 0.44, z - 0.11);
    b.add(cg, lam("chock", () => ({ color: "#b88452" })));
  }
  b.add(boxGeo(V(-0.85, DECK, 4.9), V(0.85, DECK + 0.45, 6.5)), wood);
  // water casks by the foremast
  const cask = new THREE.LatheGeometry(Array.from({ length: 9 }, (_, i) => { const s = i / 8; return new THREE.Vector2(0.36 + 0.07 * Math.sin(Math.PI * s), s * 1.0); }), 16);
  for (const [x, z] of [[-2.2, 9.6], [-2.2, 10.4], [2.2, 9.8]]) b.add(cask.clone().translate(x, DECK, z), lam("caskM", () => ({ map: staveTex("cask", ["#a8743f", "#9e6b39", "#b07a44"]) })));
  // masts, yards, bowsprit
  const spar = lam("spar", () => ({ color: "#c49a64" }));
  const FM = 7.5, MM = -2.5;
  b.add(new THREE.CylinderGeometry(0.17, 0.25, 21, 10).translate(0, DECK + 10.5, FM), spar);
  b.add(new THREE.CylinderGeometry(0.1, 0.15, 8, 8).translate(0, DECK + 24, FM), spar);
  b.add(new THREE.CylinderGeometry(0.17, 0.26, 21, 10).translate(0, DECK + 10.5, MM), spar);
  b.add(new THREE.CylinderGeometry(0.1, 0.15, 7, 8).translate(0, DECK + 23.5, MM), spar);
  for (const y of [DECK + 19, DECK + 21.2]) b.add(boxGeo(V(-0.7, y, FM - 0.6), V(0.7, y + 0.18, FM + 0.6)), wood); // tops
  b.add(boxGeo(V(-0.7, DECK + 19, MM - 0.6), V(0.7, DECK + 19.18, MM + 0.6)), wood);
  const yards: [number, number][] = [[DECK + 8.6, 7.4], [DECK + 13.2, 6.2], [DECK + 17.6, 5.2], [DECK + 22.4, 4.0], [DECK + 25.6, 3.0]];
  for (const [y, hw] of yards) b.add(beamBetween(V(-hw, y, FM + 0.3), V(hw, y, FM + 0.3), 0.2, true), spar);
  b.add(beamBetween(V(0, DECK + 1.0, 14.6), V(0, DECK + 4.0, 24), 0.28, true), spar);
  b.add(beamBetween(V(0, DECK + 2.2, MM - 0.3), V(0, DECK + 2.6, -13.6), 0.2, true), spar); // boom
  b.add(beamBetween(V(0, DECK + 16.8, MM - 0.3), V(0, DECK + 19.6, -11.2), 0.17, true), spar); // gaff
  // rigging: shrouds, stays, backstays, lifts
  const rig = RIG(), r = 0.045;
  for (const [mz, top] of [[FM, DECK + 19], [MM, DECK + 19]] as const) for (const s of [-1, 1]) for (const dz of [-1.6, -0.6, 0.4])
    b.add(beamBetween(V(s * 0.25, top, mz), V(s * (halfW(h, (2 * (mz + dz)) / h.L) - 0.05), railAt(h, (2 * (mz + dz)) / h.L), mz + dz), r, true), rig);
  b.add(beamBetween(V(0, DECK + 27.5, FM), V(0, DECK + 4.0, 24), r, true), rig);
  b.add(beamBetween(V(0, DECK + 20.5, FM), V(0, DECK + 2.6, 22.5), r, true), rig);
  b.add(beamBetween(V(0, DECK + 26.5, MM), V(0, DECK + 22.4, FM), r, true), rig);
  b.add(beamBetween(V(0, DECK + 19, MM), V(0, DECK + 1.2, FM - 1.2), r, true), rig);
  for (const s of [-1, 1]) b.add(beamBetween(V(0, DECK + 26.5, MM), V(s * 3.2, RAIL, -13.2), r, true), rig);
  for (const [y, hw] of yards) for (const s of [-1, 1]) b.add(beamBetween(V(s * hw, y, FM + 0.3), V(s * 0.3, y + 2.2, FM + 0.2), r * 0.8, true), rig);
  b.build(root);
  // sails (foremast square sails between the yards, bellying forward; mainsail + jibs bellying to starboard)
  const sm = lam("sailM" + name, () => ({ map: canvasTex(name, sailTint), side: THREE.DoubleSide }));
  const sails: Sail[] = [];
  for (let k = 0; k < yards.length - 1; k++) {
    const [y0, w0] = yards[k], [y1, w1] = yards[k + 1];
    sails.push(new Sail(root, sm, [V(-w1 * 0.97, y1 - 0.1, FM + 0.45), V(w1 * 0.97, y1 - 0.1, FM + 0.45), V(w0 * 0.95, y0 + 0.15, FM + 0.45), V(-w0 * 0.95, y0 + 0.15, FM + 0.45)], V(0, 0, 1), 1.1 + 0.15 * k));
  }
  sails.push(new Sail(root, sm, [V(0, DECK + 16.9, MM - 0.45), V(0, DECK + 19.4, -11.0), V(0, DECK + 2.8, -13.4), V(0, DECK + 2.7, MM - 0.45)], V(1, 0, 0), 1.3));
  sails.push(new Sail(root, sm, [V(0, DECK + 25.6, FM + 0.6), V(0, DECK + 25.6, FM + 0.6), V(0, DECK + 4.3, 23.4), V(0, DECK + 1.8, 15.2)], V(1, 0, 0), 0.8, true));
  sails.push(new Sail(root, sm, [V(0, DECK + 19.5, FM + 0.7), V(0, DECK + 19.5, FM + 0.7), V(0, DECK + 3.0, 19.8), V(0, DECK + 1.6, 12.4)], V(1, 0, 0), 0.7, true));
  // the ship's wheel (spins by itself)
  let wheel: THREE.Group | null = new THREE.Group();
  const wm = lam("wheelM", () => ({ color: "#9a6338" }));
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.045, 8, 28), wm); wheel.add(rim);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.16, 12).rotateX(Math.PI / 2), wm); wheel.add(hub);
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2, sp = new THREE.Mesh(beamBetween(V(0, 0, 0), V(Math.cos(a) * 0.76, Math.sin(a) * 0.76, 0), 0.045, true), wm);
    wheel.add(sp);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), wm); knob.position.set(Math.cos(a) * 0.78, Math.sin(a) * 0.78, 0); wheel.add(knob);
  }
  wheel.position.set(WHEEL[0], WHEEL[1], WHEEL[2] + 0.25);
  wheel.traverse((o) => { o.castShadow = true; o.receiveShadow = true; });
  root.add(wheel);
  const cover = new THREE.Mesh(boxGeo(V(-0.9, DECK + 0.45, 4.85), V(0.9, DECK + 0.55, 6.55)), lam("grate", () => ({ map: rep(gratingTex(), 3, 3) })));
  cover.castShadow = true; cover.receiveShadow = true; root.add(cover);
  const hole = new THREE.Mesh(boxGeo(V(-0.78, DECK + 0.4, 4.98), V(0.78, DECK + 0.46, 6.42)), new THREE.MeshBasicMaterial({ color: "#120d10" }));
  root.add(hole);
  // waterline foam (no ink)
  const foamM = new THREE.MeshBasicMaterial({ map: foamTex(), transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: true });
  const fpts = outline(h, -0.02, 40);
  const fpos: number[] = [], fuv: number[] = [], fidx: number[] = [];
  const ring: [number, number][] = [...fpts.map(([x, z]) => [x, z] as [number, number]), ...fpts.slice().reverse().map(([x, z]) => [-x, z] as [number, number])];
  ring.forEach(([x, z], i) => {
    const l = Math.hypot(x, z / 4) || 1, ox = x / l, oz = z / 4 / l, w = z > 10 ? 1.4 : 0.8;
    fpos.push(x, 0.05, z, x + ox * w, 0.05, z + oz * w); fuv.push(i / 10, 0, i / 10, 1);
    const a = i * 2, nx = ((i + 1) % ring.length) * 2; fidx.push(a, nx, a + 1, a + 1, nx, nx + 1);
  });
  const fg = new THREE.BufferGeometry(); fg.setAttribute("position", new THREE.Float32BufferAttribute(fpos, 3)); fg.setAttribute("uv", new THREE.Float32BufferAttribute(fuv, 2)); fg.setIndex(fidx);
  const foam = new THREE.Mesh(fg, foamM); foam.layers.set(NOINK); foam.renderOrder = 2; root.add(foam);
  return { root, sails, wheel, cover, hole, boat: null };
};
/** the yawl: open boat with thwarts */
const makeBoat = () => {
  const root = new THREE.Group(), b = new Batch();
  const h: HullSpec = { L: 5.4, B: 1.9, rail: 0.75, keel: -0.45, sheer: 0.18, transom: 0.6 };
  b.add(hullSkin(h, 0, h.keel, false, 2), lam("yawlHull", () => ({ map: hullTex("yawl", "#f1ead8", "#7a4f33") })));
  b.add(hullSkin(h, 0.06, 0.12, true, 2), lam("yawlIn", () => ({ color: "#c08a55" })));
  b.add(transomGeo(h), lam("yawlHull", () => ({})));
  b.add(railCap(h, 0.06), lam("railCap", () => ({ color: "#8a5a34" })));
  b.add(flatShape(outline(h, 0.18), 0.12, 1.2), lam("yawlFloor", () => ({ map: planksHD() })));
  for (const z of [1.55, 0.55, -0.45, -1.45]) b.add(boxGeo(V(-0.82, 0.32, z - 0.13), V(0.82, 0.38, z + 0.13)), lam("thwart", () => ({ color: "#b88452" })));
  for (const s of [-1, 1]) b.add(beamBetween(V(s * 0.75, 0.6, -0.9), V(s * 1.9, -0.1, -2.6), 0.07, true), lam("spar", () => ({})));
  b.build(root);
  return root;
};

const HULL_SPEC_DECK = { L: 30, B: 7.4, rail: RAIL, keel: -2.1, sheer: 0.45, transom: 0.72 };
void HULL_SPEC_DECK;

type Mats = Record<string, THREE.Material>;
const SUN_SHOT: Record<number, { az?: number; el?: number }> = { 1: { az: 110, el: 42 }, 13: { az: 120 }, 23: { az: 0, el: 6 } };

export class World {
  root = new THREE.Group();
  private pool = new Pool();
  private actors: Actor[] = [];
  private fxs: Fx[] = [];
  private hemi: THREE.HemisphereLight; private sun: THREE.DirectionalLight;
  private sky: THREE.Mesh; private skyMat: THREE.ShaderMaterial;
  private fog = new THREE.Fog("#bccbec", 25, 420);
  private WU: Record<string, THREE.IUniform>;
  private water: THREE.Mesh;
  private sunDisc: THREE.Sprite; private sunHalo: THREE.Sprite;
  private sunCache = new Map<number, THREE.Vector3>();
  private cloudMaps: Record<"day" | "golden", THREE.Texture[]>;
  private clouds: THREE.Mesh[] = [];
  private mc: ShipParts; private dg: ShipParts; private boat: THREE.Group;
  private model: ShipParts; private modelBoat: THREE.Group; private globe: THREE.Mesh;
  private ropes: Strand[] = [];
  private door: THREE.Group;
  private sets: Record<"hold" | "house" | "study", THREE.Group>;
  private frustum = new THREE.Frustum();
  private m4 = new THREE.Matrix4(); private v = new THREE.Vector3(); private sph = new THREE.Sphere();

  constructor(_kit: Kit) {
    const R = this.root, M: Mats = {};
    // ---- sky + light (as the bridge short) ----
    this.skyMat = new THREE.ShaderMaterial({
      uniforms: { c0: { value: new THREE.Color() }, c1: { value: new THREE.Color() }, c2: { value: new THREE.Color() },
        c3: { value: new THREE.Color() }, c4: { value: new THREE.Color() }, e: { value: new THREE.Vector4() } },
      vertexShader: "varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      fragmentShader: `uniform vec3 c0, c1, c2, c3, c4; uniform vec4 e; varying vec3 vP;
        void main(){ float el = asin(clamp(normalize(vP).y, -1.0, 1.0));
          vec3 c = mix(c0, c1, smoothstep(0.0, e.x, el));
          c = mix(c, c2, smoothstep(e.x, e.y, el));
          c = mix(c, c3, smoothstep(e.y, e.z, el));
          c = mix(c, c4, smoothstep(e.z, e.w, el));
          gl_FragColor = vec4(c, 1.0); }`,
      side: THREE.BackSide, depthWrite: false, fog: false,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(1100, 48, 24), this.skyMat);
    this.sky.renderOrder = -1; this.sky.frustumCulled = false; this.sky.layers.set(NOINK);
    R.add(this.sky);
    this.sunDisc = new THREE.Sprite(new THREE.SpriteMaterial({ map: discTex(), color: new THREE.Color(6.0, 4.4, 2.4), fog: false, depthWrite: false }));
    this.sunHalo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex(), color: new THREE.Color(1, 1, 1), fog: false, depthWrite: false, depthTest: true,
      transparent: true, blending: THREE.AdditiveBlending }));
    this.sunDisc.renderOrder = -0.5; this.sunHalo.renderOrder = 5;
    for (const m of [this.sunDisc, this.sunHalo]) { m.frustumCulled = false; m.layers.set(NOINK); R.add(m); }
    this.hemi = new THREE.HemisphereLight("#cfe6ff", "#6c5c8c", 1.1);
    this.sun = new THREE.DirectionalLight("#fff0d6", 2.6);
    this.sun.castShadow = true; this.sun.shadow.mapSize.set(4096, 4096);
    R.add(this.hemi, this.sun, this.sun.target);
    this.cloudMaps = { day: [0, 1, 2, 3].map((k) => cloudHD(k, LOOK.day.cloud)), golden: [0, 1, 2, 3].map((k) => cloudHD(k, LOOK.golden.cloud)) };
    for (let i = 0; i < 11; i++) {
      const a = (i / 11) * Math.PI * 2 + 0.3, d = 640 + (i % 3) * 60;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: this.cloudMaps.day[i % 4], color: new THREE.Color(1.1, 1.1, 1.1), transparent: true, depthWrite: false, fog: false }));
      const w = 140 + (i % 4) * 30;
      m.position.set(Math.cos(a) * d, 70 + (i % 4) * 40, Math.sin(a) * d); m.scale.set(w, w / 2, 1);
      m.layers.set(NOINK); m.userData.base = m.position.clone();
      this.clouds.push(m); R.add(m);
    }

    // ---- the sea ----
    const wNear = waterNear(), wFar = waterFar();
    for (const t of [wNear, wFar]) { t.colorSpace = THREE.NoColorSpace; t.anisotropy = 16; t.needsUpdate = true; }
    this.WU = {
      wNearC: { value: new THREE.Color() }, wMidC: { value: new THREE.Color() }, wFarC: { value: new THREE.Color() },
      wCrest: { value: new THREE.Color() }, wTrough: { value: new THREE.Color() }, wGlint: { value: new THREE.Color() },
      wShade: { value: new THREE.Vector3(0.5, 0.56, 0.72) }, wNearTex: { value: wNear }, wFarTex: { value: wFar }, wTime: { value: 0 }, wFlow: { value: 1.5 },
    };
    const waterM = new THREE.MeshLambertMaterial({ color: 0xffffff });
    waterM.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, this.WU);
      sh.vertexShader = sh.vertexShader
        .replace("#include <common>", "#include <common>\nvarying vec3 vWP;")
        .replace("#include <project_vertex>", "#include <project_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;");
      sh.fragmentShader = sh.fragmentShader
        .replace("#include <common>", WATER_DECL)
        .replace("#include <map_fragment>", WATER_COL)
        .replace("#include <lights_fragment_begin>", "float sunVis = 1.0;\n" + LFB)
        .replace("#include <lights_fragment_end>", "#include <lights_fragment_end>\n  reflectedLight.directDiffuse = diffuseColor.rgb * mix(wShade, vec3(1.0), sunVis);\n  reflectedLight.indirectDiffuse = vec3(0.0);");
    };
    waterM.customProgramCacheKey = () => "sea1";
    const wg = new THREE.PlaneGeometry(2400, 2400, 1, 1); wg.rotateX(-Math.PI / 2);
    this.water = new THREE.Mesh(wg, waterM); this.water.receiveShadow = true; this.water.frustumCulled = false;
    R.add(this.water);

    // ---- ships ----
    this.mc = makeShip("mc", "#24313f", "#6b4a2e", "#f3ead6");
    this.dg = makeShip("dg", "#6a2a26", "#3e2c22", "#efdcbc");
    R.add(this.mc.root, this.dg.root);
    this.boat = makeBoat(); R.add(this.boat);
    const ropeM = lam("rope", () => ({ color: "#9a7448" }));
    for (let i = 0; i < 2; i++) { const s = new Strand(40, 0.04, 0.04, ropeM, 2); this.ropes.push(s); R.add(s.mesh); }

    // ---- the cargo hold ----
    const hold = new THREE.Group(); hold.position.set(...HOLD);
    {
      const b = new Batch(), b2 = new Batch();
      M.hplank = lam("holdPlanks", () => ({ map: rep(beamHD(), 1, 1), color: "#ffe2bc" }));
      M.hfloor = lam("holdFloor", () => ({ map: planksHD() }));
      b.add(boxGeo(V(-4.2, -0.2, -10.5), V(4.2, 0, 10.5), 4), M.hfloor);
      for (const s of [-1, 1]) b.add(boxGeo(V(s < 0 ? -2.75 : 2.35, 0, -10.5), V(s < 0 ? -2.35 : 2.75, 3.6, 10.5), 1.4), M.hplank);
      for (const s of [-1, 1]) b.add(boxGeo(V(-4.2, 0, s < 0 ? -10.6 : 10.2), V(4.2, 3.6, s < 0 ? -10.2 : 10.6), 1.4), M.hplank);
      // ceiling (the deck above) with two hatch openings, and the deck beams under it
      const ceil = (x0: number, x1: number, z0: number, z1: number) => b2.add(boxGeo(V(x0, 3.4, z0), V(x1, 3.65, z1), 4, true), M.hfloor);
      ceil(-4.2, 4.2, -10.5, -1.2); ceil(-4.2, -1.0, -1.2, 1.2); ceil(1.0, 4.2, -1.2, 1.2); ceil(-4.2, 4.2, 1.2, 6.0); ceil(-4.2, -0.8, 6.0, 7.2); ceil(0.8, 4.2, 6.0, 7.2); ceil(-4.2, 4.2, 7.2, 10.5);
      for (let z = -9.6; z <= 9.6; z += 1.6) if (Math.abs(z) > 1.4 && (z < 5.8 || z > 7.4)) b2.add(boxGeo(V(-2.4, 3.12, z - 0.14), V(2.4, 3.4, z + 0.14)), M.hplank);
      b.build(hold, false); b2.build(hold, true);
      hold.children.forEach((c) => (c.userData.noRecv = true)); // walls/floor/ceiling: lit, not buried in the deck shadow
      // barrels (instanced): white-oak rows, the nine red-oak leakers, food crates and sacks
      const prof = Array.from({ length: 11 }, (_, i) => { const s = i / 10; return new THREE.Vector2(0.28 + 0.06 * Math.sin(Math.PI * s), s * 0.95); });
      const bg = new THREE.LatheGeometry(prof, 18);
      const top = new THREE.CircleGeometry(0.28, 18).rotateX(-Math.PI / 2).translate(0, 0.95, 0);
      const barrelG = mergeGeometries([bg, top.setAttribute("uv", top.attributes.uv)], false)!;
      const white: THREE.Matrix4[] = [], red: THREE.Matrix4[] = [];
      const q = new THREE.Quaternion(), one = V(1, 1, 1);
      for (const x of [-1.66, -0.98, 0.98, 1.66]) for (let z = -9.6; z <= 9.7; z += 0.68) {
        const leaky = x < 0 && z > 1.4 && z < 4.6;
        if (z > 5.2 && z < 9.2) continue; // food corner
        if (leaky) { if (red.length < 9) red.push(new THREE.Matrix4().compose(V(x, 0, z), q, one)); continue; }
        white.push(new THREE.Matrix4().compose(V(x, 0, z), q, one));
        if (Math.abs(x) > 1.3 || z < -4) white.push(new THREE.Matrix4().compose(V(x, 0.96, z), new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), z), one));
      }
      const inst = (mat: THREE.Material, list: THREE.Matrix4[]) => {
        const im = new THREE.InstancedMesh(barrelG, mat, list.length); list.forEach((m, i) => im.setMatrixAt(i, m));
        im.castShadow = true; im.receiveShadow = true; im.frustumCulled = false; hold.add(im);
      };
      inst(lam("barrelWhite", () => ({ map: staveTex("white", ["#c9a26c", "#bf9762", "#d0aa74"]) })), white);
      inst(lam("barrelRed", () => ({ map: staveTex("red", ["#a4553a", "#9a4c33", "#ad5d40"]) })), red);
      const bf = new Batch();
      const crate = lam("crate", () => ({ map: rep(beamHD(), 1, 1) }));
      for (const [x, z, y, s] of [[-1.6, 7.6, 0, 0.8], [-0.7, 8.4, 0, 0.8], [-1.6, 7.6, 0.8, 0.7], [0.4, 8.6, 0, 0.75], [1.5, 7.4, 0, 0.8], [1.5, 7.4, 0.8, 0.6], [1.6, 8.5, 0, 0.7]] as const)
        bf.add(boxGeo(V(x - s / 2, y, z - s / 2), V(x + s / 2, y + s, z + s / 2), 0.8), crate);
      const sack = new THREE.SphereGeometry(0.4, 14, 10).scale(1, 0.65, 0.8);
      for (const [x, z] of [[-1.5, 6.1], [-1.0, 6.6], [-1.6, 6.8], [1.3, 6.2]]) bf.add(sack.clone().translate(x, 0.26, z), lam("sack", () => ({ color: "#d8c49a" })));
      for (const [x, z] of [[1.75, 5.7], [-1.75, 5.5]]) bf.add(new THREE.LatheGeometry(Array.from({ length: 9 }, (_, i) => { const s = i / 8; return new THREE.Vector2(0.42 + 0.08 * Math.sin(Math.PI * s), s * 1.2); }), 16).translate(x, 0, z), lam("caskM", () => ({})));
      bf.build(hold);
    }
    R.add(hold);

    // ---- the smoke-alarm house ----
    const hs = new THREE.Group(); hs.position.set(...HOUSE);
    {
      const b = new Batch();
      b.add(boxGeo(V(-90, -0.3, -60), V(90, 0, 90), 6), lam("lawn", () => ({ map: rep(grassHD(), 1, 1) })));
      b.add(boxGeo(V(-0.9, 0, 3.5), V(0.9, 0.03, 18), 2), lam("path", () => ({ map: rep(cobbleHD(), 1, 1) })));
      house(b, 0, 0, 0, 8, 7, 5.6, 1, 0);
      house(b, -11.5, -1, 0, 7, 7, 5.6, 0, 0);
      house(b, 11.5, -0.5, 0, 7.5, 7, 5.6, 2, 0);
      house(b, -6, -24, 0, 8, 7, 8.4, 3, 0); house(b, 6, -26, 0, 8, 7, 9.8, 4, 0);
      const bush = lam("bush", () => ({ color: "#5aa04a" }));
      for (const [x, z, r] of [[-2.6, 4.6, 0.75], [2.7, 4.7, 0.8], [-3.6, 4.4, 0.6], [3.8, 4.5, 0.55], [-7.5, 5.5, 1.1], [7.2, 5.8, 1.0]] as const) b.add(new THREE.SphereGeometry(r, 16, 12).scale(1, 0.85, 1).translate(x, r * 0.7, z), bush);
      for (let x = -5; x <= 5; x += 0.5) if (Math.abs(x) > 1.2) b.add(boxGeo(V(x - 0.05, 0, 11.9), V(x + 0.05, 0.9, 12.0)), lam("fence", () => ({ color: "#f1ead8" })));
      for (const y of [0.35, 0.75]) for (const s of [-1, 1]) b.add(boxGeo(V(s * 1.2, y, 11.95), V(s * 5.05, y + 0.08, 12.02)), lam("fence", () => ({})));
      b.add(boxGeo(V(-0.66, 0, 3.49), V(0.66, 2.25, 3.52)), new THREE.MeshBasicMaterial({ color: "#6b4a3c" })); // doorway: a lit hallway
      b.build(hs);
      const door = (this.door = new THREE.Group());
      const slab = new THREE.Mesh(boxGeo(V(0, 0, -0.04), V(1.3, 2.22, 0.04)), lam("doorM", () => ({ map: doorTex("house", "#b8483a") })));
      slab.castShadow = true; slab.receiveShadow = true; door.add(slab);
      door.position.set(-0.65, 0.02, 3.58); hs.add(door);
    }
    R.add(hs);

    // ---- the doctor's study ----
    const st = new THREE.Group(); st.position.set(...STUDY);
    {
      const b = new Batch(), bc = new Batch();
      const wp = lam("wallpaper", () => ({ map: rep(wallpaperTex(), 1, 1) })), trim = lam("trimDark", () => ({ color: "#6a4630" }));
      b.add(boxGeo(V(-4.2, -0.2, -4.2), V(4.2, 0, 4.2), 3), lam("studyFloor", () => ({ map: planksHD() })));
      b.add(boxGeo(V(-2.2, 0.005, -3.4), V(2.2, 0.02, 0.4)), lam("rug", () => ({ color: "#7a4a3a" })));
      // back wall with a window (x -2.7..-0.9, y 1.0..2.5)
      const BW = (x0: number, x1: number, y0: number, y1: number) => b.add(boxGeo(V(x0, y0, -4.2), V(x1, y1, -4.0), 1.5), wp);
      BW(-4.2, -2.7, 0, 3.4); BW(-0.9, 4.2, 0, 3.4); BW(-2.7, -0.9, 0, 1.0); BW(-2.7, -0.9, 2.5, 3.4);
      for (const s of [-1, 1]) b.add(boxGeo(V(s < 0 ? -4.2 : 4.0, 0, -4.2), V(s < 0 ? -4.0 : 4.2, 3.4, 4.2), 1.5), wp);
      b.add(boxGeo(V(-4.2, 0, -4.01), V(4.2, 0.18, -3.95)), trim);
      for (const [x0, x1, y0, y1] of [[-2.75, -0.85, 0.95, 1.05], [-2.75, -0.85, 2.45, 2.55], [-2.75, -2.65, 0.95, 2.55], [-0.95, -0.85, 0.95, 2.55], [-1.84, -1.76, 1.0, 2.5], [-2.7, -0.9, 1.72, 1.78]])
        b.add(boxGeo(V(x0, y0, -4.08), V(x1, y1, -3.98)), lam("winFrame", () => ({ color: "#efe6d0" })));
      // desk
      const desk = lam("deskWood", () => ({ map: rep(beamHD(), 1, 1) }));
      b.add(boxGeo(V(-1.15, 0.74, -2.3), V(1.15, 0.8, -1.5), 1), desk);
      for (const s of [-1, 1]) b.add(boxGeo(V(s < 0 ? -1.1 : 0.55, 0, -2.25), V(s < 0 ? -0.55 : 1.1, 0.74, -1.55), 1), desk);
      b.add(boxGeo(V(-0.55, 0.35, -1.6), V(0.55, 0.74, -1.55)), desk); // modesty panel
      b.add(boxGeo(V(-0.45, 0.8, -1.98), V(0.15, 0.805, -1.6)), lam("papersM", () => ({ map: paperTex() })));
      b.add(new THREE.CylinderGeometry(0.05, 0.06, 0.08, 12).translate(-0.3, 0.84, -2.15), lam("ink", () => ({ color: "#26223a" })));
      // lamp
      b.add(new THREE.CylinderGeometry(0.09, 0.12, 0.05, 14).translate(1.0, 0.825, -2.15), lam("brass", () => ({ color: "#c99a3e" })));
      b.add(new THREE.CylinderGeometry(0.02, 0.02, 0.45, 8).translate(1.0, 1.07, -2.15), lam("brass", () => ({})));
      const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.22, 0.2, 18, 1, true).translate(1.0, 1.33, -2.15), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 1.7, 0.8), side: THREE.DoubleSide }));
      st.add(shade);
      // books on the desk, a bookshelf on the right wall, a chair behind the doctor
      for (const [x, y, c] of [[-0.42, 0.8, "#7a2f2f"], [-0.44, 0.88, "#2f4f7a"], [-0.41, 0.96, "#3e6a42"]] as const) b.add(boxGeo(V(x - 0.16, y, -2.25), V(x + 0.16, y + 0.08, -2.0)), lam("book" + c, () => ({ color: c })));
      b.add(boxGeo(V(3.55, 0, -3.6), V(4.0, 2.6, -0.4), 1), desk);
      b.add(boxGeo(V(3.54, 0.1, -3.5), V(3.56, 2.5, -0.5)), lam("spinesM", () => ({ map: spinesTex() })));
      b.add(boxGeo(V(-0.4, 0, -3.25), V(0.4, 0.45, -2.85)), trim);
      b.add(boxGeo(V(-0.4, 0.45, -3.3), V(0.4, 1.45, -3.2)), lam("leather", () => ({ color: "#7a2f2f" })));
      // a framed picture (a plain seascape, no text)
      b.add(boxGeo(V(0.6, 1.4, -4.0), V(2.0, 2.4, -3.94)), lam("frame", () => ({ color: "#c99a3e" })));
      b.add(boxGeo(V(0.7, 1.5, -3.94), V(1.9, 2.3, -3.93)), lam("seascape", () => ({ map: ctex("seascape", 256, 160, (g) => { g.fillStyle = "#f2c48a"; g.fillRect(0, 0, 256, 90); g.fillStyle = "#3b6a96"; g.fillRect(0, 90, 256, 70); g.fillStyle = "#24313f"; g.fillRect(120, 70, 50, 22); g.fillStyle = "#f3ead6"; g.fillRect(130, 30, 12, 40); g.fillRect(150, 36, 10, 34); }) })));
      b.build(st, false); bc.build(st);
      // globe on a stand (spins in shot 26)
      this.globe = new THREE.Mesh(new THREE.SphereGeometry(0.2, 32, 20), lam("globeM", () => ({ map: globeTex() })));
      this.globe.position.set(-0.85, 1.12, -1.95); this.globe.rotation.z = 0.4; this.globe.castShadow = true; this.globe.receiveShadow = true; st.add(this.globe);
      const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.1, 0.12, 12).translate(-0.85, 0.86, -1.95), lam("brass", () => ({})));
      st.add(stand);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.23, 0.012, 6, 32), lam("brass", () => ({}))); ring.position.set(-0.85, 1.12, -1.95); ring.rotation.set(0, Math.PI / 2, 0.4); st.add(ring);
    }
    // the ship model on the desk (a 1:45 Mary Celeste), and the tiny lifeboat that appears on it
    this.model = makeShip("model", "#24313f", "#6b4a2e", "#f3ead6");
    this.model.root.scale.setScalar(0.022); this.model.root.position.set(0.78, 0.86, -1.88); this.model.root.rotation.y = -1.25;
    this.model.wheel = null;
    st.add(this.model.root);
    const base = new THREE.Mesh(boxGeo(V(-0.1, 0.8, -0.3), V(0.1, 0.86, 0.3)), lam("deskWood", () => ({}))); base.position.set(0.78, 0, -1.88); base.rotation.y = -1.25; st.add(base);
    this.modelBoat = makeBoat(); this.modelBoat.scale.setScalar(0.022 * 0.9);
    this.model.root.add(this.modelBoat); this.modelBoat.position.set(0, DECK + 1.26, 1.3); this.modelBoat.scale.setScalar(0.9);
    R.add(st);
    this.sets = { hold, house: hs, study: st };
    for (const g of Object.values(this.sets)) g.traverse((o) => { if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).receiveShadow = !o.userData.noRecv; });
  }

  /** camera-relative sun, frozen per shot: the shot's mean view direction turned by az toward screen right, lifted by el */
  private shotSun(id: number, s: ShotDef, L: LightPreset) {
    let v = this.sunCache.get(id);
    if (v) return v;
    let fx = 0, fz = 0;
    for (let f = s.a; f < s.b; f += 3) {
      const c = camAt(id, f), x = c.look[0] - c.pos[0], z = c.look[2] - c.pos[2], n = Math.hypot(x, z) || 1;
      fx += x / n; fz += z / n;
    }
    const n = Math.hypot(fx, fz) || 1; fx /= n; fz /= n;
    const az = THREE.MathUtils.degToRad(s.sunAz ?? SUN_SHOT[id]?.az ?? L.az), el = THREE.MathUtils.degToRad(s.sunEl ?? SUN_SHOT[id]?.el ?? L.el);
    const hx = fx * Math.cos(az) - fz * Math.sin(az), hz = fz * Math.cos(az) + fx * Math.sin(az);
    v = new THREE.Vector3(hx * Math.cos(el), Math.sin(el), hz * Math.cos(el)).normalize();
    this.sunCache.set(id, v);
    return v;
  }
  private actor(i: number) { while (this.actors.length <= i) this.actors.push(new Actor(this.root)); return this.actors[i]; }
  private fx(i: number) { while (this.fxs.length <= i) this.fxs.push(new Fx(this.root)); return this.fxs[i]; }

  private poseShip(sp: ShipParts, P: Pose, id: number, t: number) {
    sp.root.position.set(...P.p); sp.root.rotation.set(P.pitch, P.yaw, P.roll, "YXZ");
    const fill = sailFill(id, t);
    for (const s of sp.sails) s.set(fill, t);
    if (sp.wheel) sp.wheel.rotation.z = wheelAngle(id, t);
    const open = id === 15 || id === 16 || id === 17;
    if (sp.cover) sp.cover.visible = !open;
    if (sp.hole) sp.hole.visible = open;
  }

  update(id: number, f: number, cam: THREE.PerspectiveCamera, scene: THREE.Scene) {
    const t = f / FPS, s = SHOTS[id - 1], L = LIGHTS[s.light];
    const c = camAt(id, f);
    cam.position.set(...c.pos); cam.up.set(0, 1, 0); cam.lookAt(...c.look); cam.rotateZ(c.roll);
    cam.fov = c.fov; cam.near = s.place === "study" ? 0.05 : 0.15; cam.far = 1500; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    const focus = V(...c.look), dist = cam.position.distanceTo(focus);
    cam.layers.enable(NOINK);
    // ---- light rig ----
    const K = LOOK[s.light], sunDir = this.shotSun(id, s, L);
    this.hemi.color.set(L.sky); this.hemi.groundColor.set(L.ground); this.hemi.intensity = L.hemiI;
    this.sun.color.set(L.sunCol); this.sun.intensity = L.sunI;
    let Rr = THREE.MathUtils.clamp(dist * 1.15 + 7, 10, 95);
    if (s.place === "sea") Rr = Math.max(Rr, 34); // whole ship (masts) inside the shadow map
    if (s.light === "golden" && s.place === "sea") Rr = Math.max(Rr, 45);
    this.sun.position.copy(focus).addScaledVector(sunDir, 220); this.sun.target.position.copy(focus);
    const sc = this.sun.shadow.camera;
    sc.left = -Rr; sc.right = Rr; sc.top = Rr; sc.bottom = -Rr; sc.near = 20; sc.far = 480; sc.updateProjectionMatrix();
    this.sun.shadow.bias = L.bias; this.sun.shadow.normalBias = L.normalBias * (Rr / 12);
    TONE.uLitCol.value.set(...L.lit); TONE.uShadeCol.value.set(...L.shade); TONE.uShadeLift.value.set(...L.lift);
    TONE.uLambert.value = L.lambert; TONE.uSideK.value = L.sideK; TONE.uTerm.value = L.term; TONE.uBounce.value.set(...LOOK[s.light].bounce); TONE.uSat.value = LOOK[s.light].sat;
    CHAR.uCharTint.value.set(...L.charTint); CHAR.uCharShade.value = L.charShade; CHAR.uGrad.value = L.charGrad;
    CHAR.uBodyGrad.value = L.bodyGrad; CHAR.uSideTint.value.set(...L.sideTint);
    // ---- sky, fog, sun disc, clouds ----
    const su = this.skyMat.uniforms;
    K.sky.c.forEach((h, i) => untone(h, su["c" + i].value));
    const e = K.sky.e.map((deg) => THREE.MathUtils.degToRad(deg));
    su.e.value.set(e[1], e[2], e[3], e[4]);
    this.sky.position.copy(cam.position);
    untone(L.fog, this.fog.color);
    this.fog.near = s.place === "sea" ? L.fogNear * 2 : 60; this.fog.far = s.place === "sea" ? L.fogFar * 1.9 : 900;
    scene.fog = this.fog; scene.background = null;
    const showSun = s.light === "golden" && s.place === "sea";
    this.sunDisc.visible = this.sunHalo.visible = showSun;
    if (showSun) {
      this.sunDisc.position.copy(cam.position).addScaledVector(sunDir, 900);
      this.sunDisc.scale.setScalar(2 * 900 * Math.tan(THREE.MathUtils.degToRad(1.7)));
      this.sunHalo.position.copy(this.sunDisc.position); this.sunHalo.scale.setScalar(2 * 900 * Math.tan(THREE.MathUtils.degToRad(24)));
      (this.sunHalo.material as THREE.SpriteMaterial).color.set(L.sunDisc).multiplyScalar(1.3);
    }
    for (let i = 0; i < this.clouds.length; i++) {
      const m = this.clouds[i], mat = m.material as THREE.MeshBasicMaterial;
      m.position.copy(m.userData.base).add(this.v.set(cam.position.x, 0, cam.position.z));
      m.lookAt(cam.position.x, m.position.y, cam.position.z);
      mat.map = this.cloudMaps[s.light][i % 4];
    }
    // ---- sea ----
    const W = this.WU, wc = K.water;
    untone(wc.near, W.wNearC.value); untone(wc.mid, W.wMidC.value); untone(wc.far, W.wFarC.value);
    untone(wc.crest, W.wCrest.value); untone(wc.trough, W.wTrough.value); untone(wc.glint, W.wGlint.value);
    W.wShade.value.set(...wc.shade); W.wTime.value = t;
    const moving = id === 17 || (id >= 19 && id <= 23);
    W.wFlow.value = moving ? 0.15 : 1.4; // the ship sails: the sea slides aft (she really moves in the towline shots)
    this.water.visible = s.place === "sea";
    this.water.position.set(cam.position.x, 0, cam.position.z);
    // ---- sets ----
    this.sets.hold.visible = s.place === "hold"; this.sets.house.visible = s.place === "house"; this.sets.study.visible = s.place === "study";
    const atSea = s.place === "sea";
    this.mc.root.visible = atSea; this.dg.root.visible = atSea && shipPose("dg", id, t).p[1] > -10;
    this.poseShip(this.mc, shipPose("mc", id, t), id, t);
    if (this.dg.root.visible) this.poseShip(this.dg, shipPose("dg", id, t), id, t);
    const bp = shipPose("boat", id, t);
    this.boat.visible = atSea && bp.p[1] > -10;
    this.boat.position.set(...bp.p); this.boat.rotation.set(bp.pitch, bp.yaw, bp.roll, "YXZ");
    this.poseRopes(id, t);
    this.door.rotation.y = s.place === "house" ? -doorAngle(t) : 0;
    if (s.place === "study") {
      this.poseShip(this.model, { p: [0.78, 0.86, -1.88], yaw: -1.25, pitch: 0, roll: 0 }, 99, t);
      this.modelBoat.visible = t >= MODEL_BOAT_T;
      this.globe.rotation.y = id === 26 ? (t - 63.2) * 3.2 : 0.6;
    }
    // ---- cast + effects ----
    const right = V(0, 0, 0).setFromMatrixColumn(cam.matrixWorld, 0);
    const stg = stage(id, t, { pos: cam.position, right, sun: sunDir });
    this.frustum.setFromProjectionMatrix(this.m4.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
    let ai = 0;
    const used: Actor[] = [];
    for (const p of stg.places) {
      const sc2 = p.scale ?? 1;
      if (!this.frustum.intersectsSphere(this.sph.set(this.v.set(p.x, p.y + 1.1 * sc2, p.z), 3.5))) continue;
      const a = this.actor(ai++);
      const [w, h, k] = p.size ?? [300, 500, 0.5];
      a.r = this.pool.req(p.key, w, h, k, p.draw);
      a.mesh.visible = true;
      a.mesh.position.set(p.x, p.y, p.z);
      a.mesh.rotation.set(0, p.yaw ?? Math.atan2(cam.position.x - p.x, cam.position.z - p.z), p.roll ?? 0);
      a.mesh.scale.set(p.mirror ? -sc2 : sc2, sc2, sc2);
      a.mesh.castShadow = L.actorShadow;
      used.push(a);
    }
    for (let i = ai; i < this.actors.length; i++) this.actors[i].mesh.visible = false;
    let fi = 0;
    const fused: Fx[] = [];
    for (const p of stg.fx) {
      if (!this.frustum.intersectsSphere(this.sph.set(this.v.set(p.x, p.y, p.z), Math.max(p.w, p.h)))) continue;
      const e2 = this.fx(fi++);
      e2.r = this.pool.req(p.key, p.cw, p.ch, 1, p.draw);
      e2.use(!!p.soft);
      e2.mesh.visible = true;
      e2.mesh.position.set(p.x, p.y, p.z);
      if (p.flat) e2.mesh.rotation.set(-Math.PI / 2, 0, p.rot ?? 0);
      else { e2.mesh.quaternion.copy(cam.quaternion); e2.mesh.rotateZ(p.rot ?? 0); }
      e2.mesh.scale.set(p.w, p.h, 1);
      fused.push(e2);
    }
    for (let i = fi; i < this.fxs.length; i++) this.fxs[i].mesh.visible = false;
    this.pool.flush();
    for (const a of used) a.bind();
    for (const e3 of fused) e3.bind();
    return focus;
  }

  /** the towline: taut catenary stern -> boat; after the snap the two frayed ends trail in the water */
  private poseRopes(id: number, t: number) {
    const [A, B] = this.ropes;
    A.mesh.visible = B.mesh.visible = false;
    const st = V(...mcAt(id, t, STERN));
    const sag = (a: THREE.Vector3, e: THREE.Vector3, n: number, dip: number) =>
      Array.from({ length: n }, (_, i) => { const u = i / (n - 1); return a.clone().lerp(e, u).add(V(0, -dip * 4 * u * (1 - u), 0)); });
    /** from the stern rail down into the water, then trailing behind on the surface */
    const trail = (a: THREE.Vector3, len: number, n: number, wig: number) =>
      Array.from({ length: n }, (_, i) => {
        const u = i / (n - 1), down = Math.min(1, u * 4);
        return V(a.x - 0.2 * u + wig * Math.sin(u * 9 + t * 2) * u, a.y + (0.03 - a.y) * Math.sqrt(down), a.z - 4.5 * down - (len - 4.5) * Math.max(0, (u - 0.25) / 0.75));
      });
    if (id === 19) { A.set(trail(st, 7.5, 40, 0.3)); A.mesh.visible = true; return; }
    const towed = id === 17 || (id >= 20 && id <= 23);
    if (!towed || !this.boat.visible) return;
    const bow = V(...boatAt(id, t, [0, 0.72, 2.65]));
    if (t < SNAP_T) {
      const taut = id >= 20 ? 0.18 + 0.5 * (1 - smooth((t - 53.3) / 1.2)) : 1.1;
      A.set(sag(st, bow, 40, taut)); A.mesh.visible = true;
    } else {
      const u = smooth((t - SNAP_T) / 1.6), mid = st.clone().lerp(bow, 0.5);
      // stern half whips back toward the ship and drops into the sea; boat half falls slack
      const endA = mid.clone().lerp(V(st.x - 0.3, 0.03, st.z - 7), u), endB = mid.clone().lerp(V(bow.x + 0.2, 0.03, bow.z + 5), u);
      A.set(sag(st, endA, 40, 0.3 + 1.2 * u)); B.set(sag(bow, endB, 40, 0.2 + 0.6 * u));
      A.mesh.visible = B.mesh.visible = true;
    }
  }
}
void toWorld; void add; void rng;

const WATER_DECL = `#include <common>
varying vec3 vWP;
uniform vec3 wNearC, wMidC, wFarC, wCrest, wTrough, wGlint, wShade;
uniform sampler2D wNearTex, wFarTex;
uniform float wTime, wFlow;`;
const WATER_COL = `
  vec3 wV = vWP - cameraPosition;
  float wd = length(wV);
  float wDep = asin(clamp(-wV.y / wd, 0.0, 1.0));
  float wf = 1.0 - smoothstep(0.0, 0.42, wDep);
  vec3 wc = mix(mix(wNearC, wMidC, smoothstep(0.0, 0.55, wf)), wFarC, smoothstep(0.55, 1.0, wf));
  vec2 wp = vWP.xz + vec2(0.12 * wTime, -wFlow * wTime);
  vec4 mk = mix(texture2D(wNearTex, wp / 9.0), texture2D(wFarTex, wp / 45.0 + 0.37), smoothstep(25.0, 110.0, wd));
  vec4 mk2 = texture2D(wNearTex, (wp + vec2(3.7, 1.3)) / 14.0 + vec2(0.0, 0.02 * wTime));
  wc = mix(wc, wTrough, max(mk.g, mk2.g * 0.6) * 0.6);
  wc = mix(wc, wCrest, max(mk.r, mk2.r * 0.5) * 0.7);
  wc = mix(wc, wGlint, mk.b * (0.3 + 0.5 * wf));
  diffuseColor.rgb = wc;`;
