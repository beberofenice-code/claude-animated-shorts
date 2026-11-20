// The whole place as one three.js scene: sky, the Piazza lawn, the cathedral and baptistery to the west, the city
// wall to the north, the town east and south, the bell tower (tower.ts) posed from the story clock, the props of each
// era (1173 site, a century of weeds, 1934 concrete pump, 1990 rescue rig, today's stall), a beach far east for the
// analogy, clouds and the cast. update(id, f, camera) poses everything for shot `id` at frame f.
import * as THREE from "three";
import { Batch, boxGeo, V, lam, Kit, Ray, kitClone, prop, house, withSight, roofOf } from "./build";
import { rep, ctex, stoneHD, grassHD, cobbleHD, waterNear, waterFar, cloudHD, beam } from "./paint";
import { duomoWall, sandHD, earthHD, hazard, clayHD } from "./pisapaint";
import { LIGHTS, LOOK, LightPreset } from "./lights";
import { TONE, CHAR, LFB, untone } from "./shade";
import { NOINK } from "./ink";
import { Pool, Actor, Fx, stage } from "./cast";
import { Tower } from "./tower";
import { FPS, SHOTS, camAt, towerAt, V3, smooth, FOREGROUND, ShotDef, BEACH, SPOT, B, Era } from "./story";

/** no downloadable kit in this build: vegetation is drawn by build.ts itself */
export const loadKit = () => Promise.resolve({} as Kit);

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
/** per-shot sun override (degrees, camera-relative); golden shots are backlit low */
const SUN_SHOT: Record<number, { az?: number; el?: number }> = { 8: { az: 62, el: 13 }, 11: { az: -62, el: 13 }, 17: { az: 66, el: 14 }, 10: { az: 110, el: 40 } };

/** every lens position of the film looking at its subject (houses / trees there are left out) */
const sightLines = (): Ray[] => {
  const out: Ray[] = [];
  for (const s of SHOTS) for (let f = s.a - 8; f < s.b + 8; f += 2) {
    const c = camAt(s.id, Math.max(0, Math.min(f, s.b - 1))), o = V(...c.pos), look = V(...c.look);
    const fw = look.clone().sub(o), len = fw.length();
    fw.normalize();
    const rt = fw.clone().cross(V(0, 1, 0)).normalize(), up = rt.clone().cross(fw);
    const ty = Math.tan((c.fov * Math.PI) / 360), tx = ty * (9 / 16);
    for (const [sx, sy] of [[0, 0], [-0.6, 0], [0.6, 0], [0, 0.6], [0, -0.4]])
      out.push({ o, d: fw.clone().addScaledVector(rt, sx * tx).addScaledVector(up, sy * ty), len, core: sx === 0 && sy === 0 });
  }
  return out;
};

/** horizontal quad facing up at height y covering x0..x1, z0..z1 with u/v texture repeats */
function quadUp(x0: number, x1: number, z0: number, z1: number, u: number, v: number, y = 0) {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute([x0, y, z1, x1, y, z1, x1, y, z0, x0, y, z1, x1, y, z0, x0, y, z0], 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(Array(6).fill([0, 1, 0]).flat(), 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, u, 0, u, v, 0, 0, u, v, 0, v], 2));
  return g;
}
const gable = (x0: number, x1: number, z0: number, z1: number, y: number, rise: number, o = 0.4) => {
  // roof ridge along x
  const zm = (z0 + z1) / 2, g1 = new THREE.BufferGeometry(), g2 = new THREE.BufferGeometry();
  const P = (a: number[]) => new THREE.Float32BufferAttribute(a, 3);
  g1.setAttribute("position", P([x0 - o, y, z1 + o, x1 + o, y, z1 + o, x1 + o, y + rise, zm, x0 - o, y, z1 + o, x1 + o, y + rise, zm, x0 - o, y + rise, zm]));
  g2.setAttribute("position", P([x1 + o, y, z0 - o, x0 - o, y, z0 - o, x0 - o, y + rise, zm, x1 + o, y, z0 - o, x0 - o, y + rise, zm, x1 + o, y + rise, zm]));
  const L = (x1 - x0) / 4, W = Math.hypot(zm - z0, rise) / 4;
  for (const g of [g1, g2]) { g.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, L, 0, L, W, 0, 0, L, W, 0, W], 2)); g.computeVertexNormals(); }
  return [g1, g2];
};
const gableEnd = (x: number, z0: number, z1: number, y: number, rise: number, dir: number) => {
  const g = new THREE.BufferGeometry(), zm = (z0 + z1) / 2;
  g.setAttribute("position", new THREE.Float32BufferAttribute(dir > 0 ? [x, y, z1, x, y, z0, x, y + rise, zm] : [x, y, z0, x, y, z1, x, y + rise, zm], 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, (z1 - z0) / 8, 0, (z1 - z0) / 16, rise / 8], 2));
  g.computeVertexNormals();
  return g;
};
/** box with its texture tiled in metres (ink-friendly hard edges) */
const block = (b: Batch, m: THREE.Material, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, tile = 4) =>
  b.add(boxGeo(V(x0, y0, z0), V(x1, y1, z1), tile), m);

type EraSet = Partial<Record<Era, THREE.Group>>;

export class World {
  root = new THREE.Group();
  private pool = new Pool();
  private actors: Actor[] = [];
  private fxs: Fx[] = [];
  private hemi: THREE.HemisphereLight; private sun: THREE.DirectionalLight;
  private sky: THREE.Mesh; private skyMat: THREE.ShaderMaterial;
  private fog = new THREE.Fog("#bccbec", 25, 420);
  private WU: Record<string, THREE.IUniform>;
  private sunDisc: THREE.Sprite; private sunHalo: THREE.Sprite;
  private sunCache = new Map<number, THREE.Vector3>();
  private cloudMaps: Record<"day" | "golden", THREE.Texture[]>;
  private clouds: { m: THREE.Mesh; a: number; d: number }[] = [];
  private fgs: { o: THREE.Object3D; a: number; b: number }[] = [];
  private tower = new Tower();
  private eras: Record<string, THREE.Group> = {};
  private pegs = new THREE.Group();
  private cap: THREE.Mesh; private mud: THREE.Mesh;
  private paths = new THREE.Group();
  private spoil: THREE.Mesh; private barrier: THREE.Group; private drum: THREE.Mesh; private drill: THREE.Group;
  private frustum = new THREE.Frustum();
  private m4 = new THREE.Matrix4(); private v = new THREE.Vector3(); private sph = new THREE.Sphere();

  constructor(kit: Kit) {
    const R = this.root;
    // ---- sky + light ----
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
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    R.add(this.hemi, this.sun, this.sun.target);
    this.cloudMaps = { day: [0, 1, 2, 3].map((k) => cloudHD(k, LOOK.day.cloud)), golden: [0, 1, 2, 3].map((k) => cloudHD(k, LOOK.golden.cloud)) };
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 + 0.3, d = 620 + (i % 3) * 60;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: this.cloudMaps.day[i % 4], color: new THREE.Color(1.1, 1.1, 1.1), transparent: true, depthWrite: false, fog: false }));
      const w = 130 + (i % 4) * 30;
      m.position.y = 110 + (i % 4) * 36; m.scale.set(w, w / 2, 1);
      m.layers.set(NOINK);
      this.clouds.push({ m, a, d }); R.add(m);
    }

    // ---- ground: the Piazza lawn with the foundation hole, the beach far east ----
    const grassM = lam("lawnHD", () => ({ map: grassHD() }));
    const shape = new THREE.Shape([new THREE.Vector2(-900, -900), new THREE.Vector2(1100, -900), new THREE.Vector2(1100, 900), new THREE.Vector2(-900, 900)]);
    const hole = new THREE.Path(); hole.absarc(0, 0, 8.2, 0, Math.PI * 2, true); shape.holes.push(hole);
    const ground = new THREE.ShapeGeometry(shape, 48);
    ground.rotateX(-Math.PI / 2);
    const guv = ground.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < guv.count; i++) guv.setXY(i, guv.getX(i) / 4, -guv.getY(i) / 4);
    const gm = new THREE.Mesh(ground, grassM); gm.receiveShadow = true; R.add(gm);
    this.cap = new THREE.Mesh(new THREE.CircleGeometry(8.3, 72).rotateX(-Math.PI / 2), grassM); this.cap.receiveShadow = true; R.add(this.cap);
    this.tower.attach(R);

    const b = new Batch();
    const sl = roofOf("#8f97a8"), terra = roofOf("#c9775a");
    // cathedral (west): nave, aisles, transept + dome, apse facing the tower
    const dw = lam("duomo", () => ({ map: rep(duomoWall(), 1, 1) }));
    const nave = { x0: -122, x1: -40, z: 9, h: 27 }, ais = 16, ah = 15;
    block(b, dw, nave.x0, 0, -nave.z, nave.x1, nave.h, nave.z, 8);
    block(b, dw, nave.x0, 0, -ais, nave.x1, ah, -nave.z, 8);
    block(b, dw, nave.x0, 0, nave.z, nave.x1, ah, ais, 8);
    for (const g of gable(nave.x0, nave.x1, -nave.z, nave.z, nave.h, 6)) b.add(g, sl);
    b.add(gableEnd(nave.x1, -nave.z, nave.z, nave.h, 6, 1), dw);
    b.add(gableEnd(nave.x0, -nave.z, nave.z, nave.h, 6, -1), dw);
    for (const s of [-1, 1]) b.add(quadUp(nave.x0 - 0.5, nave.x1 + 0.5, s < 0 ? -ais - 0.5 : nave.z, s < 0 ? -nave.z : ais + 0.5, 20, 2, ah + 0.05), sl);
    block(b, dw, -82, 0, -34, -66, 24, 34, 8); // transept
    for (const g of gable(-82, -66, -34, 34, 24, 5)) { g.rotateY(0); b.add(g, sl); }
    b.add(new THREE.CylinderGeometry(7, 7, 7, 40), dw, new THREE.Matrix4().makeTranslation(-74, nave.h + 3.5, 0));
    b.add(new THREE.SphereGeometry(7.2, 32, 14, 0, Math.PI * 2, 0, Math.PI / 2), sl, new THREE.Matrix4().compose(V(-74, nave.h + 7, 0), new THREE.Quaternion(), V(1, 0.85, 1)));
    b.add(new THREE.CylinderGeometry(8, 8, 20, 32, 1, false, 0, Math.PI), dw, new THREE.Matrix4().makeRotationY(Math.PI / 2).setPosition(-40, 10, 0));
    b.add(new THREE.SphereGeometry(8.4, 24, 10, 0, Math.PI, 0, Math.PI / 2), sl, new THREE.Matrix4().makeRotationY(Math.PI / 2).setPosition(-40, 20, 0));
    // baptistery (far west)
    b.add(new THREE.CylinderGeometry(18, 18, 30, 48), dw, new THREE.Matrix4().makeTranslation(-185, 15, 0));
    b.add(new THREE.ConeGeometry(14, 18, 48), sl, new THREE.Matrix4().makeTranslation(-185, 39, 0));
    b.add(new THREE.SphereGeometry(18.6, 40, 12, 0, Math.PI * 2, 0, Math.PI / 2), sl, new THREE.Matrix4().compose(V(-185, 30, 0), new THREE.Quaternion(), V(1, 0.4, 1)));
    // city wall (north) with merlons and square towers
    const cw = lam("cityWall", () => ({ map: rep(stoneHD("cityWallHD"), 1, 1) }));
    const WZ = -52;
    block(b, cw, -240, 0, WZ - 2.4, 160, 10, WZ, 4);
    for (let x = -240; x < 160; x += 2.6) block(b, cw, x, 10, WZ - 2.4, x + 1.4, 11.3, WZ - 1.6, 4);
    for (let x = -220; x < 160; x += 58) block(b, cw, x - 4, 0, WZ - 5, x + 4, 16, WZ + 2, 4);
    b.build(R);

    // town: rows east and south of the Piazza, roofs over the wall to the north (left out where they block a lens)
    withSight(sightLines(), () => {
      const tb = new Batch();
      let k = 0;
      for (let z = -40; z < 90; z += 11) house(tb, 64 + (k % 3), z, -Math.PI / 2, 9, 9, 8.4 + (k % 3) * 1.4, k++);
      for (let z = -40; z < 90; z += 12) house(tb, 82, z + 4, -Math.PI / 2, 9, 9, 9.8, k++);
      for (let x = -150; x < 150; x += 11) { house(tb, x, -66 - (k % 2) * 3, 0, 9, 9, 11 + (k % 3) * 1.4, k++); }
      for (let x = -150; x < 60; x += 12) house(tb, x, 120, Math.PI, 10, 9, 9.8, k++);
      for (let x = 60; x < 200; x += 11) house(tb, x, 108 + (k % 2) * 2, Math.PI, 9, 9, 8.4, k++);
      // trees: lawn edges, behind the wall, along the town
      const r = (n: number) => { const v = Math.sin(n * 91.7) * 43758.5; return v - Math.floor(v); };
      for (let i = 0; i < 26; i++) prop(tb, kit, ["tree_oak", "tree_default", "tree_fat"][i % 3], -30 + i * 7 + r(i) * 3, 0, -42 + r(i + 7) * 4, 8 + r(i + 3) * 3, i);
      for (let i = 0; i < 40; i++) prop(tb, kit, ["tree_cone", "tree_oak", "tree_default"][i % 3], -230 + i * 10 + r(i + 40) * 6, 0, -85 - r(i + 60) * 40, 11 + r(i + 5) * 5, i);
      for (let i = 0; i < 18; i++) prop(tb, kit, ["tree-high-round", "tree_oak"][i % 2], 48 + r(i + 80) * 6, 0, -36 + i * 7, 8 + r(i + 9) * 3, i);
      for (let i = 0; i < 30; i++) prop(tb, kit, ["tree_oak", "tree_cone"][i % 2], -260 + i * 18, 0, 150 + r(i + 90) * 30, 12, i);
      tb.build(R);
    });

    // ---- era props ----
    const wood = lam("wood", () => ({ map: beam() }));
    const marbleS = lam("marbleS", () => ({ map: rep(stoneHD("marbleHD"), 1, 1) }));
    const iron = lam("ironDark", () => ({ color: "#4a4f5c" }));
    const yellow = lam("rigYellow", () => ({ color: "#f0b429" }));
    const lead = lam("lead", () => ({ color: "#6f7480" }));
    const earth = lam("earth", () => ({ map: rep(earthHD(), 3, 3) }));
    const mk = (eras: Era[], fill: (b: Batch) => void) => {
      const g = new THREE.Group(), bb = new Batch(); fill(bb); bb.build(g); g.userData.eras = eras; R.add(g); return g;
    };
    const stones = (bb: Batch, x: number, z: number, n: number) => {
      for (let i = 0; i < n; i++) { const r0 = i % 3, lvl = Math.floor(i / 3); block(bb, marbleS, x + r0 * 1.3, lvl * 0.7, z, x + r0 * 1.3 + 1.2, lvl * 0.7 + 0.68, z + 0.9, 2); }
    };
    const cart = (bb: Batch, x: number, z: number) => {
      block(bb, wood, x - 1.2, 0.7, z - 0.7, x + 1.2, 1.0, z + 0.7, 2);
      block(bb, wood, x - 1.2, 1.0, z - 0.7, x + 1.2, 1.4, z - 0.6, 2); block(bb, wood, x - 1.2, 1.0, z + 0.6, x + 1.2, 1.4, z + 0.7, 2);
      for (const s of [-1, 1]) bb.add(new THREE.CylinderGeometry(0.55, 0.55, 0.14, 16).rotateX(Math.PI / 2), wood, new THREE.Matrix4().makeTranslation(x, 0.55, z + s * 0.8));
      bb.add(new THREE.BoxGeometry(2.4, 0.1, 0.1), wood, new THREE.Matrix4().makeRotationZ(0.35).setPosition(x + 2.2, 0.55, z));
    };
    this.eras.build = mk(["1173", "1272"], (bb) => { stones(bb, -16, 6, 9); stones(bb, 13, -11, 6); stones(bb, 15, 4, 5); cart(bb, 17, 9); });
    // a century of weeds: bushes ringing the stump
    this.eras.weeds = mk(["war"], (bb) => {
      for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2 + 0.2, d = 8.6 + (i % 3) * 0.7; if (Math.abs(a - 0.64) < 0.75) continue; prop(bb, kit, "plant_bush", Math.cos(a) * d, 0, Math.sin(a) * d, 1.2 + (i % 4) * 0.35, i); }
      stones(bb, -16, 6, 6); stones(bb, 13, -11, 4);
    });
    // 1934: the concrete mixer and its hose to the foot of the tower
    const [mx, mz] = SPOT.mixer;
    this.eras.pump = mk(["1934"], (bb) => {
      block(bb, iron, mx - 2.2, 0.6, mz - 1, mx + 2.2, 0.9, mz + 1, 2);
      for (const sx of [-1.4, 1.4]) for (const sz of [-1.05, 1.05]) bb.add(new THREE.CylinderGeometry(0.55, 0.55, 0.3, 18).rotateX(Math.PI / 2), lam("tyre", () => ({ color: "#2e2a32" })), new THREE.Matrix4().makeTranslation(mx + sx, 0.55, mz + sz));
      block(bb, lam("mixRed", () => ({ color: "#b8443a" })), mx + 1.0, 0.9, mz - 0.9, mx + 2.2, 2.4, mz + 0.9, 2);
      const curve = new THREE.CatmullRomCurve3([V(mx - 1.6, 1.0, mz + 0.2), V(mx - 2.6, 0.2, mz + 0.8), V(-10, 0.15, 5.5), V(-7.6, 0.25, 3.2)]);
      bb.add(new THREE.TubeGeometry(curve, 40, 0.14, 8), lam("hose", () => ({ color: "#3a3a40" })));
    });
    this.drum = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.15, 2.2, 20), lam("drum", () => ({ color: "#c9c3b4" })));
    this.drum.position.set(mx - 0.4, 1.9, mz); this.drum.rotation.z = Math.PI / 2 - 0.35; this.drum.castShadow = true;
    this.eras.pump.add(this.drum);
    // 1990-2001: fence, lead counterweights on the high side, the soil-extraction rig, the spoil heap, the barrier
    const [rx, rz] = SPOT.rig;
    this.eras.rescue = mk(["1990"], (bb) => {
      for (let i = 0; i < 64; i++) {
        const a = (i / 64) * Math.PI * 2, x = Math.cos(a) * 18, z = Math.sin(a) * 18;
        if (z > 14 && Math.abs(x) < 4.5) continue; // the gate
        bb.add(new THREE.BoxGeometry(0.1, 1.6, 0.1), iron, new THREE.Matrix4().makeTranslation(x, 0.8, z));
      }
      for (let i = 0; i < 64; i++) {
        const a0 = (i / 64) * Math.PI * 2, a1 = ((i + 1) / 64) * Math.PI * 2;
        const p0 = V(Math.cos(a0) * 18, 0, Math.sin(a0) * 18), p1 = V(Math.cos(a1) * 18, 0, Math.sin(a1) * 18);
        if (p0.z > 14 && Math.abs(p0.x) < 4.5 || p1.z > 14 && Math.abs(p1.x) < 4.5) continue;
        for (const y of [0.55, 1.45]) {
          const m = new THREE.Matrix4().compose(p0.clone().add(p1).multiplyScalar(0.5).setY(y), new THREE.Quaternion().setFromUnitVectors(V(1, 0, 0), p1.clone().sub(p0).normalize()), V(1, 1, 1));
          bb.add(new THREE.BoxGeometry(p0.distanceTo(p1), 0.07, 0.07), iron, m);
        }
      }
      // counterweights: a concrete collar and lead ingots stacked on the north (high, -x) side
      for (let i = 0; i < 12; i++) { const lvl = Math.floor(i / 4), k = i % 4; block(bb, lead, -8.6 - lvl * 0.05, 0.6 + lvl * 0.55, -3 + k * 1.5, -7.3, 1.1 + lvl * 0.55, -1.6 + k * 1.5, 2); }
      block(bb, lam("concrete", () => ({ color: "#c9c4b8" })), -9.0, 0, -3.4, -7.0, 0.6, 3.4, 2);
      // rig: tracked base, cabin, drill mast leaning toward the tower foot
      block(bb, iron, rx - 2, 0, rz - 1.4, rx + 2, 0.7, rz + 1.4, 2);
      block(bb, yellow, rx - 1.6, 0.7, rz - 1.1, rx + 0.4, 2.2, rz + 1.1, 2);
      block(bb, lam("cabRoof", () => ({ color: "#3a3d47" })), rx - 1.7, 2.2, rz - 1.2, rx + 0.5, 2.35, rz + 1.2, 2);
      const glass = lam("glass", () => ({ color: "#5d7fa8" }));
      block(bb, glass, rx - 1.4, 1.35, rz + 1.1, rx + 0.2, 2.0, rz + 1.14, 2);
      block(bb, glass, rx - 1.64, 1.35, rz - 0.8, rx - 1.6, 2.0, rz + 0.8, 2);
      block(bb, lam("hazardBand", () => ({ map: rep(hazard(), 4, 1) })), rx - 1.62, 0.72, rz - 1.12, rx + 0.42, 0.95, rz + 1.12, 2);
      block(bb, yellow, rx + 0.4, 0.7, rz - 0.7, rx + 1.9, 1.3, rz + 0.7, 2);
      bb.add(new THREE.CylinderGeometry(0.07, 0.07, 1.0, 8), iron, new THREE.Matrix4().makeTranslation(rx - 1.2, 2.8, rz - 0.8));
    });
    this.drill = new THREE.Group();
    const mast = new THREE.Mesh(new THREE.BoxGeometry(0.5, 6, 0.5).translate(0, 3, 0), yellow);
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 7, 10).translate(0, -1.0, 0), iron);
    mast.castShadow = pipe.castShadow = true;
    this.drill.add(mast, pipe);
    this.drill.position.set(rx + 1.6, 0.7, rz); this.drill.rotation.z = -0.95;
    this.eras.rescue.add(this.drill);
    this.spoil = new THREE.Mesh(new THREE.ConeGeometry(1.8, 1.4, 20).translate(0, 0.7, 0), earth);
    this.spoil.position.set(rx - 2.2, 0, rz - 3.6); this.spoil.castShadow = this.spoil.receiveShadow = true;
    this.eras.rescue.add(this.spoil);
    this.barrier = new THREE.Group();
    const arm = new THREE.Mesh(new THREE.BoxGeometry(5.4, 0.16, 0.12).translate(2.7, 0, 0), lam("hazard", () => ({ map: rep(hazard(), 5, 1) })));
    arm.castShadow = true; this.barrier.add(arm);
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.1, 0.3).translate(0, -0.55, 0), iron); this.barrier.add(post);
    this.barrier.position.set(-4.3, 1.1, 17.4);
    this.eras.rescue.add(this.barrier);
    // today: the paved ring and a souvenir stall
    this.eras.today = mk(["today"], (bb) => {
      block(bb, wood, 18, 0, 22, 21.5, 2.4, 24, 2);
      for (const [i, c] of ["#e4554b", "#f4f0e6", "#e4554b", "#f4f0e6"].entries())
        bb.add(new THREE.BoxGeometry(0.9, 0.08, 2.6).applyMatrix4(new THREE.Matrix4().makeRotationX(-0.25)), lam("awn" + c, () => ({ color: c })), new THREE.Matrix4().makeTranslation(18.45 + i * 0.88, 2.75, 22.6));
    });
    // paved ring round the finished tower (1934 onwards)
    const paveM = lam("cobbleHD", () => ({ map: cobbleHD() }));
    const pave = new THREE.Mesh(new THREE.RingGeometry(8.25, 12.5, 72).rotateX(-Math.PI / 2).translate(0, 0.012, 0), paveM);
    pave.receiveShadow = true; this.paths.add(pave); R.add(this.paths);
    // a century of rain: a ring of wet clay round the stump
    this.mud = new THREE.Mesh(new THREE.RingGeometry(6.9, 12.5, 72, 1).rotateX(-Math.PI / 2).translate(0, 0.014, 0), lam("mud", () => ({ map: rep(clayHD(), 3, 3) })));
    this.mud.receiveShadow = true; R.add(this.mud);
    // 1173 pegs and string marking the planned circle
    const pegM = lam("peg", () => ({ color: "#a8724a" }));
    for (let i = 0; i < 20; i++) { const a = (i / 20) * Math.PI * 2; const pg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.7, 0.1).translate(0, 0.35, 0), pegM); pg.position.set(Math.cos(a) * 7.6, 0, Math.sin(a) * 7.6); pg.castShadow = true; this.pegs.add(pg); }
    const string = new THREE.Mesh(new THREE.TorusGeometry(7.6, 0.02, 4, 90).rotateX(Math.PI / 2).translate(0, 0.62, 0), lam("string", () => ({ color: "#f1efe6" })));
    this.pegs.add(string); R.add(this.pegs);

    // ---- beach (shot 10): dry sand, wet sand, the sea ----
    const [Bx, , Bz] = BEACH;
    const sandM = lam("sand", () => ({ map: rep(sandHD(false), 1, 1) })), wetM = lam("sandWet", () => ({ map: rep(sandHD(true), 1, 1) }));
    const beach = new THREE.Group();
    const sm = new THREE.Mesh(quadUp(Bx - 300, Bx + 300, Bz + 1.6, Bz + 300, 150, 75, 0.01), sandM);
    const wm = new THREE.Mesh(quadUp(Bx - 300, Bx + 300, Bz - 7, Bz + 1.6, 150, 2.2, 0.0), wetM);
    sm.receiveShadow = wm.receiveShadow = true; beach.add(sm, wm);
    const wNear = waterNear(), wFar = waterFar();
    for (const t of [wNear, wFar]) { t.colorSpace = THREE.NoColorSpace; t.anisotropy = 16; t.needsUpdate = true; }
    this.WU = {
      wNearC: { value: new THREE.Color() }, wMidC: { value: new THREE.Color() }, wFarC: { value: new THREE.Color() },
      wCrest: { value: new THREE.Color() }, wTrough: { value: new THREE.Color() }, wGlint: { value: new THREE.Color() },
      wShade: { value: new THREE.Vector3(0.5, 0.56, 0.72) }, wNearTex: { value: wNear }, wFarTex: { value: wFar }, wTime: { value: 0 },
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
    const sea = new THREE.Mesh(quadUp(Bx - 900, Bx + 900, Bz - 900, Bz - 5.2, 1, 1, 0.03), waterM);
    sea.receiveShadow = true; beach.add(sea);
    const foam = new THREE.Mesh(quadUp(Bx - 300, Bx + 300, Bz - 5.6, Bz - 4.9, 1, 1, 0.045), new THREE.MeshLambertMaterial({ color: "#f4fbff", transparent: true, opacity: 0.85 }));
    beach.add(foam);
    // an umbrella and a towel for scale
    const ub = new Batch();
    ub.add(new THREE.CylinderGeometry(0.04, 0.04, 2.3, 8), lam("pole", () => ({ color: "#f4f0e6" })), new THREE.Matrix4().makeTranslation(Bx - 4.5, 1.15, Bz + 4));
    ub.add(new THREE.ConeGeometry(1.5, 0.6, 12, 1, true), lam("umb", () => ({ color: "#e4554b", side: THREE.DoubleSide })), new THREE.Matrix4().makeTranslation(Bx - 4.5, 2.4, Bz + 4));
    ub.add(quadUp(Bx - 5.6, Bx - 3.6, Bz + 4.6, Bz + 5.6, 1, 1, 0.02), lam("towel", () => ({ color: "#3fa7c9" })));
    ub.build(beach);
    R.add(beach);

    // the camera agent's near framing objects
    for (const fg of FOREGROUND) {
      const o = kitClone(kit, fg.kit, fg.s ?? 1);
      if (!o) continue;
      o.position.set(...fg.pos); o.rotation.y = fg.yaw ?? 0; o.visible = false;
      this.fgs.push({ o, a: fg.a, b: fg.b }); R.add(o);
    }
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

  update(id: number, f: number, cam: THREE.PerspectiveCamera, scene: THREE.Scene) {
    const t = f / FPS, s = SHOTS[id - 1], tau = s.tau(t), L = LIGHTS[s.light];
    // ---- camera ----
    const c = camAt(id, f);
    cam.position.set(...c.pos); cam.up.set(0, 1, 0); cam.lookAt(...c.look); cam.rotateZ(c.roll);
    cam.fov = c.fov; cam.near = 0.2; cam.far = 1500; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    const focus = V(...c.look), dist = cam.position.distanceTo(focus);
    cam.layers.enable(NOINK);
    // ---- light rig ----
    const K = LOOK[s.light], sunDir = this.shotSun(id, s, L);
    this.hemi.color.set(L.sky); this.hemi.groundColor.set(L.ground); this.hemi.intensity = L.hemiI;
    this.sun.color.set(L.sunCol); this.sun.intensity = L.sunI;
    let Rr = THREE.MathUtils.clamp(dist * 1.0 + 10, 14, 150);
    if (s.light === "golden") Rr = Math.max(Rr, 50);
    this.sun.position.copy(focus).addScaledVector(sunDir, 260); this.sun.target.position.copy(focus);
    const sc = this.sun.shadow.camera;
    sc.left = -Rr; sc.right = Rr; sc.top = Rr; sc.bottom = -Rr; sc.near = 20; sc.far = 560; sc.updateProjectionMatrix();
    this.sun.shadow.bias = L.bias; this.sun.shadow.normalBias = L.normalBias * (Rr / 12);
    TONE.uLitCol.value.set(...L.lit); TONE.uShadeCol.value.set(...L.shade); TONE.uShadeLift.value.set(...L.lift);
    TONE.uLambert.value = L.lambert; TONE.uSideK.value = L.sideK; TONE.uTerm.value = L.term; TONE.uBounce.value.set(...LOOK[s.light].bounce); TONE.uSat.value = LOOK[s.light].sat;
    CHAR.uCharTint.value.set(...L.charTint); CHAR.uCharShade.value = L.charShade; CHAR.uGrad.value = L.charGrad;
    CHAR.uBodyGrad.value = L.bodyGrad; CHAR.uSideTint.value.set(...L.sideTint);
    // ---- sky, fog, sun disc, clouds (time-lapse in the century shot) ----
    const su = this.skyMat.uniforms;
    K.sky.c.forEach((h, i) => untone(h, su["c" + i].value));
    const e = K.sky.e.map((deg) => THREE.MathUtils.degToRad(deg));
    su.e.value.set(e[1], e[2], e[3], e[4]);
    this.sky.position.copy(cam.position);
    untone(L.fog, this.fog.color); this.fog.near = L.fogNear; this.fog.far = L.fogFar;
    scene.fog = this.fog; scene.background = null;
    const showSun = s.light === "golden";
    this.sunDisc.visible = this.sunHalo.visible = showSun;
    if (showSun) {
      this.sunDisc.position.copy(cam.position).addScaledVector(sunDir, 900);
      this.sunDisc.scale.setScalar(2 * 900 * Math.tan(THREE.MathUtils.degToRad(1.7)));
      this.sunHalo.position.copy(this.sunDisc.position); this.sunHalo.scale.setScalar(2 * 900 * Math.tan(THREE.MathUtils.degToRad(24)));
      (this.sunHalo.material as THREE.SpriteMaterial).color.set(L.sunDisc).multiplyScalar(1.3);
    }
    const drift = s.era === "war" ? (t - 23.8) * 0.12 : t * 0.002;
    for (let i = 0; i < this.clouds.length; i++) {
      const { m, a, d } = this.clouds[i], mat = m.material as THREE.MeshBasicMaterial;
      m.position.set(cam.position.x + Math.cos(a + drift) * d, m.position.y, cam.position.z + Math.sin(a + drift) * d);
      m.lookAt(cam.position.x, m.position.y, cam.position.z);
      mat.map = this.cloudMaps[s.light][i % 4];
    }
    // ---- sea colours ----
    const W = this.WU, wc = K.water;
    untone(wc.near, W.wNearC.value); untone(wc.mid, W.wMidC.value); untone(wc.far, W.wFarC.value);
    untone(wc.crest, W.wCrest.value); untone(wc.trough, W.wTrough.value); untone(wc.glint, W.wGlint.value);
    W.wShade.value.set(...wc.shade); W.wTime.value = t;
    for (const g of this.fgs) g.o.visible = f >= g.a && f < g.b && g.a < s.b && g.b > s.a;
    // ---- tower + era dressing ----
    const ts = towerAt(tau);
    this.tower.pose(ts, id === 3);
    this.tower.root.visible = s.era !== "beach";
    this.pegs.visible = id === 2;
    this.mud.visible = s.era === "war";
    this.cap.visible = id !== 3 && ts.floors[0] < 0.001;
    this.paths.visible = s.era === "1934" || s.era === "1990" || s.era === "today";
    for (const g of Object.values(this.eras)) g.visible = (g.userData.eras as Era[]).includes(s.era);
    this.drum.rotation.y = t * 2.2;
    this.spoil.scale.setScalar(0.4 + 0.6 * smooth((t - B.pulling + 1.5) / 3) + (id === 16 ? 0.15 : 0));
    this.barrier.rotation.z = id === 15 ? Math.PI / 2 * (1 - smooth((t - B.closed + 0.25) / 0.25)) : 0;
    this.drill.children[1].position.y = id === 15 ? -1.0 * smooth((t - B.pulling) / 2) - 0.4 * Math.sin(t * 9) * (t > B.pulling ? 0.1 : 0) : 0;
    // ---- cast + effects ----
    const right = V(0, 0, 0).setFromMatrixColumn(cam.matrixWorld, 0);
    const st = stage(id, t, { pos: cam.position, right }, ts.lean);
    this.frustum.setFromProjectionMatrix(this.m4.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
    const tint = s.light === "golden" ? "#ffcf9e" : "#ffffff";
    let ai = 0;
    const used: Actor[] = [];
    for (const p of st.places) {
      const sc2 = p.scale ?? 1;
      if (!this.frustum.intersectsSphere(this.sph.set(this.v.set(p.x, p.y + 1.1 * sc2, p.z), 3.5))) continue;
      const a = this.actor(ai++);
      const [w, h, k] = p.size ?? [300, 500, 0.5];
      a.r = this.pool.req(p.key, w, h, k, p.draw);
      a.mesh.visible = true;
      a.mesh.position.set(p.x, p.y, p.z);
      a.mesh.rotation.set(0, p.yaw ?? Math.atan2(cam.position.x - p.x, cam.position.z - p.z), p.roll ?? 0);
      a.mesh.scale.set(p.mirror ? -sc2 : sc2, sc2, sc2);
      if (a.mat.emissiveMap) a.mat.emissive.set(tint);
      a.mesh.castShadow = L.actorShadow;
      used.push(a);
    }
    for (let i = ai; i < this.actors.length; i++) this.actors[i].mesh.visible = false;
    let fi = 0;
    const fused: Fx[] = [];
    for (const p of st.fx) {
      if (!this.frustum.intersectsSphere(this.sph.set(this.v.set(p.x, p.y, p.z), Math.max(p.w, p.h)))) continue;
      const ef = this.fx(fi++);
      ef.r = this.pool.req(p.key, p.cw, p.ch, 1, p.draw);
      ef.use(!!p.soft);
      ef.mesh.visible = true;
      ef.mesh.position.set(p.x, p.y, p.z);
      if (p.flat) ef.mesh.rotation.set(-Math.PI / 2, 0, p.rot ?? 0);
      else { ef.mesh.quaternion.copy(cam.quaternion); ef.mesh.rotateZ(p.rot ?? 0); }
      ef.mesh.scale.set(p.w, p.h, 1);
      fused.push(ef);
    }
    for (let i = fi; i < this.fxs.length; i++) this.fxs[i].mesh.visible = false;
    this.pool.flush();
    for (const a of used) a.bind();
    for (const ef of fused) ef.bind();
    return focus;
  }
}

const WATER_DECL = `#include <common>
varying vec3 vWP;
uniform vec3 wNearC, wMidC, wFarC, wCrest, wTrough, wGlint, wShade;
uniform sampler2D wNearTex, wFarTex;
uniform float wTime;`;
const WATER_COL = `
  vec3 wV = vWP - cameraPosition;
  float wd = length(wV);
  float wDep = asin(clamp(-wV.y / wd, 0.0, 1.0));
  float wf = 1.0 - smoothstep(0.0, 0.42, wDep);
  vec3 wc = mix(mix(wNearC, wMidC, smoothstep(0.0, 0.55, wf)), wFarC, smoothstep(0.55, 1.0, wf));
  vec2 wp = vWP.xz + vec2(0.0, 0.25 * wTime);
  vec4 mk = mix(texture2D(wNearTex, wp / 8.0), texture2D(wFarTex, wp / 40.0 + 0.37), smoothstep(25.0, 90.0, wd));
  wc = mix(wc, wTrough, mk.g * 0.6);
  wc = mix(wc, wCrest, mk.r * 0.7);
  wc = mix(wc, wGlint, mk.b * (0.3 + 0.5 * wf));
  diffuseColor.rgb = wc;`;
export type { V3 };
