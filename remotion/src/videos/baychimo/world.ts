// The whole place as one three.js scene: sky, sea, the pack ice (with the freezing edge, floes, pressure ridges and
// icebergs) carrying the ship, the snowy shore with the crew's hut and distant mountains, a ski plane, a dog sled,
// the airport carousel hall (the analogy), blizzard snow and smoke, plus the cast. update(id, f, camera) poses
// everything for shot `id` at frame f (pure function of id + f).
import * as THREE from "three";
import { Batch, V, lam, boxGeo, beamBetween } from "./build";
import { ctex, rng, snowHD, iceHD, boardsHD, tileHD, beltHD, waterNear, waterFar, cloudHD } from "./paint";
import { Pen } from "./toon";
import { LIGHTS, LOOK, LightPreset } from "./lights";
import { TONE, CHAR, LFB, twoTone, untone } from "./shade";
import { NOINK } from "./ink";
import { getInputProps } from "remotion";
import { Pool, Actor, Fx, stage } from "./cast";
import { buildShip, ShipParts } from "./ship";
import {
  FPS, SHOTS, ShotDef, V3, camAt, carPath, carAt, CAR, CAR_SPEED, suitcaseAt, packAt, shipAt, envAt, packPt, Pack, ICE_Y, SHORE, LAND_Y, HUT, AIR, HALF_L, BEAM, DECK, smooth, clamp01,
} from "./story";

export type Kit = Record<string, THREE.Object3D>;
export const loadKit = () => Promise.resolve({} as Kit);

// ---------------- sprites ----------------
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
const smokeTex = (dark: boolean) => ctex(dark ? "smokeD" : "smokeL", 256, 256, (g) => {
  const p = new Pen(g);
  const c = dark ? ["#4a4850", "#5c5a63", "#4a4850", "#6a6872"] : ["#b9bcc6", "#cfd2da", "#b9bcc6", "#dfe2e8"];
  for (const [x, y, r, k] of [[90, 150, 60, 0], [150, 120, 70, 1], [170, 165, 55, 2], [120, 100, 50, 3]] as const) p.ell(x, y, r, r * 0.85, c[k], 0);
});
const flakeTex = () => ctex("flake", 64, 64, (g) => {
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.5, "rgba(255,255,255,0.9)"); gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
});
/** per-shot sun override (camera-relative az/el in degrees) */
const SUN_SHOT: Record<number, { az?: number; el?: number }> = {
  2: { az: 110, el: 34 }, 7: { az: 60, el: 22 }, 14: { az: 120, el: 40 }, 15: { az: 150, el: 62 }, 16: { az: 120, el: 40 },
  1: { az: 8, el: 6 }, 10: { az: -7, el: 5 }, 18: { az: 25, el: 7 }, 19: { az: -6, el: 6 },
};

/** every lens position of the film looking at its subject, in PACK-LOCAL coordinates of that frame (props there that
 *  would block the view are left out) */
type Ray = { o: THREE.Vector3; d: THREE.Vector3; len: number };
const sightLines = (local: boolean): Ray[] => {
  const out: Ray[] = [];
  for (const s of SHOTS) for (let f = s.a - 8; f < s.b + 8; f += 3) {
    if (s.zone !== "arctic") continue;
    const c = camAt(s.id, Math.max(0, f)), p = packAt(s.id, Math.max(0, f));
    const toL = (v: THREE.Vector3) => { if (!local) return v; const x = v.x - p.x, z = v.z - p.z, cs = Math.cos(p.rot), sn = Math.sin(p.rot); return V(cs * x - sn * z, v.y, sn * x + cs * z); };
    const o = V(...c.pos), look = V(...c.look);
    const fw = look.clone().sub(o), len = fw.length();
    fw.normalize();
    const rt = fw.clone().cross(V(0, 1, 0)).normalize(), up = rt.clone().cross(fw);
    const ty = Math.tan((c.fov * Math.PI) / 360), tx = ty * (9 / 16);
    const oL = toL(o);
    for (const [sx, sy] of [[0, 0], [-0.7, 0], [0.7, 0], [0, 0.7], [0, -0.6], [-0.7, -0.6], [0.7, -0.6]]) {
      const dW = fw.clone().addScaledVector(rt, sx * tx).addScaledVector(up, sy * ty);
      const tip = toL(o.clone().addScaledVector(dW, len * 1.15));
      const d = tip.clone().sub(oL); const L = d.length(); d.normalize();
      out.push({ o: oL, d, len: L });
    }
  }
  return out;
};
const blocks = (rays: Ray[], c: THREE.Vector3, r: number) => {
  for (const ry of rays) {
    const t = Math.max(0, Math.min(ry.len, c.clone().sub(ry.o).dot(ry.d)));
    if (ry.o.clone().addScaledVector(ry.d, t).distanceTo(c) < r) return true;
  }
  return false;
};

const ICE_DECL = `#include <common>
uniform float uIceR; varying vec2 vLP;
float hsh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hsh(i), hsh(i + vec2(1, 0)), f.x), mix(hsh(i + vec2(0, 1)), hsh(i + vec2(1, 1)), f.x), f.y); }
float hullD(vec2 p){ return max(abs(p.x) - ${(BEAM / 2).toFixed(2)}, 0.0) + max(abs(p.y) - ${(HALF_L - 2).toFixed(2)}, 0.0); }`;
/** ice distance field shared with the floes (cast.ts / world.ts on the CPU) */
export const hullD = (x: number, z: number) => Math.max(Math.abs(x) - BEAM / 2, 0) + Math.max(Math.abs(z) - (HALF_L - 2), 0);

type Smoke = { m: THREE.Mesh; mat: THREE.MeshLambertMaterial; k: number };

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
  private clouds: THREE.Mesh[] = [];
  private pack = new THREE.Group();
  private ship: ShipParts; private shipG = new THREE.Group();
  private iceU = { value: 0 };
  private floes: THREE.InstancedMesh; private floeData: { x: number; z: number; s: V3; r: number; d: number }[] = [];
  private heave: { m: THREE.Mesh; x0: number; s: number }[] = [];
  private arctic = new THREE.Group(); private airport = new THREE.Group();
  private hutWalls: THREE.Group; private hutTop: THREE.Group;
  private plane: THREE.Group; private prop: THREE.Mesh;
  private sled: THREE.Group;
  private belt: THREE.Texture; private suitcase: THREE.Group;
  private snow: THREE.Points; private snowMat: THREE.PointsMaterial;
  private smokeShip: Smoke[] = []; private smokeHut: Smoke[] = [];
  private carPath: [number, number, number, number, number][] = [];
  private frustum = new THREE.Frustum();
  private m4 = new THREE.Matrix4(); private v = new THREE.Vector3(); private sph = new THREE.Sphere();

  constructor(_kit: Kit) {
    const R = this.root;
    R.add(this.arctic, this.airport);
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
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(3000, 48, 24), this.skyMat);
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
      const a = (i / 11) * Math.PI * 2 + 0.3, d = 1700 + (i % 3) * 150;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: this.cloudMaps.day[i % 4], color: new THREE.Color(1.1, 1.1, 1.1), transparent: true, depthWrite: false, fog: false }));
      const w = 360 + (i % 4) * 80;
      m.position.set(Math.cos(a) * d, 260 + (i % 4) * 90, Math.sin(a) * d); m.scale.set(w, w / 2, 1);
      m.layers.set(NOINK); this.clouds.push(m); this.arctic.add(m);
    }

    // ---- sea (fixed in the world) ----
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
    waterM.polygonOffset = true; waterM.polygonOffsetFactor = 2; waterM.polygonOffsetUnits = 8; // never wins a depth tie against the ice
    const wg = new THREE.PlaneGeometry(9000, 9000, 96, 96); wg.rotateX(-Math.PI / 2);
    const wm = new THREE.Mesh(wg, waterM); wm.receiveShadow = true; this.arctic.add(wm);

    // ---- pack ice (rides with the pack frame) ----
    this.arctic.add(this.pack);
    const iceTex = iceHD(); iceTex.repeat.set(140, 140); iceTex.anisotropy = 16;
    const iceM = twoTone(new THREE.MeshLambertMaterial({ map: iceTex }));
    const base = iceM.onBeforeCompile;
    iceM.onBeforeCompile = (sh, r) => {
      base.call(iceM, sh, r);
      sh.uniforms.uIceR = this.iceU;
      sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nvarying vec2 vLP;")
        .replace("#include <begin_vertex>", "#include <begin_vertex>\nvLP = position.xz;");
      sh.fragmentShader = sh.fragmentShader.replace("#include <common>", ICE_DECL)
        .replace("void main() {", "void main() {\n  float hd = hullD(vLP), iceN = vnoise(vLP * 0.045) * 18.0 + vnoise(vLP * 0.2) * 4.0;\n  if (hd + iceN < uIceR) discard;\n  float ld = abs(vnoise(vLP * 0.006) - 0.5) + 0.35 * abs(vnoise(vLP * 0.021 + 7.0) - 0.5) * 0.0;\n  if (hd > 60.0 && ld < 0.02 + 0.01 * vnoise(vLP * 0.05)) discard;");
    };
    iceM.customProgramCacheKey = () => "packIce2";
    const ig = new THREE.PlaneGeometry(5600, 5600, 96, 96); ig.rotateX(-Math.PI / 2); ig.translate(0, ICE_Y, 0);
    const im = new THREE.Mesh(ig, iceM); im.receiveShadow = true; this.pack.add(im);
    // floes, ridges and icebergs: instanced chunks, culled off every sight line
    const rays = sightLines(true);
    const rnd = rng(7);
    const chunkG = new THREE.IcosahedronGeometry(1, 2); // rounded, snow-covered blocks
    const snowM = lam("snowChunk", () => ({ map: snowHD() }));
    const pick: typeof this.floeData = [];
    for (let i = 0; i < 900 && pick.length < 340; i++) {
      const a = rnd() * Math.PI * 2, r = 14 + Math.pow(rnd(), 0.8) * 520;
      const x = Math.cos(a) * r * 0.8, z = Math.sin(a) * r;
      const big = rnd() < 0.08 && r > 160;
      const s: V3 = big ? [12 + rnd() * 16, 4 + rnd() * 6, 12 + rnd() * 16] : [1.4 + rnd() * 3.0, 0.35 + rnd() * 0.8, 1.4 + rnd() * 3.0];
      const d = hullD(x, z);
      if (d < 9) continue;
      if (blocks(rays, V(x, 0.6, z), Math.max(s[0], s[2]) * 1.1 + 0.8)) continue;
      pick.push({ x, z, s, r: rnd() * 6, d });
    }
    this.floeData = pick;
    this.floes = new THREE.InstancedMesh(chunkG, snowM, pick.length);
    this.floes.castShadow = true; this.floes.receiveShadow = true; this.floes.frustumCulled = false;
    this.pack.add(this.floes);
    // pressure ridge slabs off the starboard side (shot 13 heave)
    for (let k = 0; k < 7; k++) {
      const g = new THREE.BoxGeometry(1.8 + (k % 3) * 0.5, 0.45, 1.6 + 0.6 * (k % 2)); g.translate(0.9, 0, 0);
      const m = new THREE.Mesh(g, snowM); m.castShadow = true; m.receiveShadow = true;
      const x0 = 8.2 + (k % 2) * 1.2, z0 = -4 + k * 2.0;
      m.position.set(x0, ICE_Y + 0.1, z0); this.heave.push({ m, x0, s: 0.6 + 0.12 * (k % 3) });
      this.pack.add(m);
    }
    // the ship
    this.ship = buildShip();
    this.shipG.add(this.ship.root); this.pack.add(this.shipG);

    // ---- the shore: snow land, hills, distant mountains, the hut ----
    const landM = lam("land", () => ({ map: (() => { const t = snowHD().clone(); t.repeat.set(160, 70); t.needsUpdate = true; return t; })() }));
    const lg = new THREE.PlaneGeometry(5000, 1800, 250, 90); lg.rotateX(-Math.PI / 2); lg.translate(0, 0, SHORE - 900);
    const lp = lg.attributes.position as THREE.BufferAttribute;
    const hr = rng(3);
    const bumps = Array.from({ length: 40 }, () => [hr() * 5000 - 2500, SHORE - 60 - hr() * 1500, 40 + hr() * 160, 4 + hr() * 30] as const);
    for (let i = 0; i < lp.count; i++) {
      const x = lp.getX(i), z = lp.getZ(i), dz = SHORE - z;
      let h = dz < 3 ? 0.32 + (LAND_Y - 0.32) * smooth(dz / 3) : LAND_Y + 3 * smooth((dz - 30) / 120);
      for (const [bx, bz, br, bh] of bumps) h += bh * Math.exp(-((x - bx) ** 2 + (z - bz) ** 2) / (br * br));
      if (Math.abs(x - HUT[0]) < 22 && Math.abs(z - HUT[2]) < 22) h = Math.min(h, LAND_Y + 0.1 * smooth((dz - 10) / 20));
      lp.setY(i, h);
    }
    lg.computeVertexNormals();
    const land = new THREE.Mesh(lg, landM); land.receiveShadow = true; land.castShadow = false; this.arctic.add(land);
    const rock = lam("shoreRock", () => ({ color: "#6f655d" }));
    const sg2 = new THREE.PlaneGeometry(5000, 7, 1, 1); sg2.rotateX(-Math.PI / 2); sg2.translate(0, 0.42, SHORE - 2.2);
    void sg2; void rock;
    const mb = new Batch();
    for (let k = 0; k < 16; k++) { // distant mountains along the coast
      const g = new THREE.ConeGeometry(160 + (k % 4) * 60, 140 + (k % 5) * 70, 7, 1);
      mb.add(g, landM, new THREE.Matrix4().compose(V(-2200 + k * 290 + (k % 3) * 60, 60 + (k % 5) * 30, SHORE - 1100 - (k % 3) * 160), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, k, 0)), V(1, 1, 1)));
    }
    mb.build(this.arctic, false);
    // hut: walls rise with the build progress, roof + stovepipe when finished
    const boards = lam("boards", () => ({ map: boardsHD() }));
    const roofSnow = lam("roofSnow", () => ({ map: snowHD(), side: THREE.DoubleSide }));
    const dark = lam("darkWood", () => ({ color: "#4a3426" }));
    this.hutWalls = new THREE.Group(); this.hutTop = new THREE.Group();
    const hb = new Batch();
    hb.add(boxGeo(V(-2.6, 0, -2.1), V(2.6, 2.6, 2.1), 4), boards);
    hb.add(boxGeo(V(-0.5, 0, 2.08), V(0.5, 1.95, 2.16)), dark); // door
    hb.add(boxGeo(V(1.2, 1.1, 2.08), V(2.0, 1.8, 2.16)), lam("hutWin", () => ({ color: "#33496a" })));
    hb.build(this.hutWalls);
    const tb = new Batch();
    for (const s of [-1, 1]) tb.add(new THREE.PlaneGeometry(3.2, 5.8).rotateX(-Math.PI / 2).rotateZ(-s * 0.606).translate(s * 1.3, 3.5, 0), roofSnow);
    for (const z of [-2.1, 2.1]) { const tg = new THREE.BufferGeometry(); tg.setAttribute("position", new THREE.Float32BufferAttribute([-2.6, 2.6, z, 2.6, 2.6, z, 0, 4.4, z], 3)); tg.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, 1, 0, 0.5, 1], 2)); tg.computeVertexNormals(); tb.add(tg, boards); }
    tb.add(beamBetween(V(1.4, 3.2, -0.8), V(1.4, 5.4, -0.8), 0.22, true), lam("pipe", () => ({ color: "#3a3a40" })));
    tb.build(this.hutTop);
    for (const g of [this.hutWalls, this.hutTop]) { g.position.set(...HUT); g.traverse((o) => { o.castShadow = true; o.receiveShadow = true; }); this.arctic.add(g); }
    const props = new Batch(); // crates, barrels, firewood by the hut
    for (const [x, z, w, h] of [[-3.8, 1.2, 0.9, 0.7], [-3.6, 2.4, 0.7, 0.6], [3.4, -1.4, 1.0, 0.8], [3.3, 0.0, 0.8, 0.6]] as const)
      props.add(boxGeo(V(HUT[0] + x - w / 2, HUT[1], HUT[2] + z - w / 2), V(HUT[0] + x + w / 2, HUT[1] + h, HUT[2] + z + w / 2)), boards);
    for (const [x, z] of [[-3.4, -1.0], [-4.3, -0.4]] as const) { const c = new THREE.CylinderGeometry(0.35, 0.35, 0.9, 12); c.translate(HUT[0] + x, HUT[1] + 0.45, HUT[2] + z); props.add(c, lam("barrel", () => ({ color: "#7a5236" }))); }
    props.build(this.arctic);

    // ---- ski plane (shot 4 + montage) ----
    this.plane = new THREE.Group();
    const pb = new Batch();
    const red = lam("planeRed", () => ({ color: "#c8463c" })), yel = lam("planeYel", () => ({ color: "#e8b83a" })), blk = lam("planeBlk", () => ({ color: "#2a2a30" }));
    pb.add(boxGeo(V(-0.6, -0.6, -3.5), V(0.6, 0.6, 2.6), 0, true), red);
    pb.add(boxGeo(V(-0.4, -0.4, -5.6), V(0.4, 0.4, -3.4), 0, true), red);
    pb.add(boxGeo(V(-6.2, 0.6, -0.6), V(6.2, 0.78, 1.0), 0, true), yel);
    pb.add(boxGeo(V(-2.2, 0.05, -5.6), V(2.2, 0.15, -4.7), 0, true), yel);
    pb.add(boxGeo(V(-0.06, 0.15, -5.6), V(0.06, 1.5, -4.8)), yel);
    pb.add(boxGeo(V(-0.5, 0.3, 1.0), V(0.5, 0.62, 2.0)), lam("planeGlass", () => ({ color: "#33496a" })));
    for (const s of [-1, 1]) { pb.add(boxGeo(V(s * 1.0 - 0.15, -1.45, -1.2), V(s * 1.0 + 0.15, -1.3, 1.6)), blk); pb.add(beamBetween(V(s * 0.5, -0.5, 0.2), V(s * 1.0, -1.35, 0.2), 0.08, true), blk); }
    pb.build(this.plane);
    this.prop = new THREE.Mesh(new THREE.CircleGeometry(1.3, 20), new THREE.MeshBasicMaterial({ color: "#5a5a60", transparent: true, opacity: 0.35, depthWrite: false }));
    this.prop.position.set(0, 0, 2.7); this.prop.layers.set(NOINK); this.plane.add(this.prop);
    this.plane.traverse((o) => { o.castShadow = true; });
    this.arctic.add(this.plane);

    // ---- dog sled (shots 11, 17) ----
    this.sled = new THREE.Group();
    const sb = new Batch(), wood = lam("sledWood", () => ({ color: "#a8784a" }));
    for (const s of [-1, 1]) {
      sb.add(beamBetween(V(-1.6, 0.06, s * 0.35), V(1.3, 0.06, s * 0.35), 0.08), wood);
      sb.add(beamBetween(V(1.3, 0.06, s * 0.35), V(1.55, 0.4, s * 0.35), 0.08), wood);
      sb.add(beamBetween(V(-1.5, 0.06, s * 0.35), V(-1.5, 1.05, s * 0.32), 0.07), wood);
      for (const x of [-0.6, 0.4]) sb.add(beamBetween(V(x, 0.06, s * 0.35), V(x, 0.42, s * 0.35), 0.06), wood);
    }
    sb.add(boxGeo(V(-1.4, 0.4, -0.4), V(1.2, 0.46, 0.4)), wood);
    sb.add(beamBetween(V(-1.5, 1.05, -0.35), V(-1.5, 1.05, 0.35), 0.07, true), wood);
    sb.add(boxGeo(V(-0.9, 0.46, -0.32), V(0.6, 0.85, 0.32)), lam("sledLoad", () => ({ color: "#7a6a5a" })));
    sb.build(this.sled);
    this.sled.traverse((o) => { o.castShadow = true; o.receiveShadow = true; });
    this.arctic.add(this.sled);

    // ---- airport hall + carousel (shot 15) ----
    const A = AIR, floorT = tileHD(); floorT.repeat.set(6, 5); floorT.anisotropy = 16;
    const ab = new Batch(), shell = new Batch();
    const wallM = lam("hallWall", () => ({ color: "#e6dccb" })), steel = twoTone(new THREE.MeshPhongMaterial({ color: "#a9adb5", specular: "#ffffff", shininess: 60 }), 0.15);
    const floorG = new THREE.PlaneGeometry(48, 40); floorG.rotateX(-Math.PI / 2); floorG.translate(A[0], 0, A[2]);
    ab.add(floorG, lam("hallFloor", () => ({ map: floorT })));
    shell.add(boxGeo(V(A[0] - 24, 0, A[2] + 14), V(A[0] + 24, 9, A[2] + 15)), wallM);
    shell.add(boxGeo(V(A[0] - 24, 0, A[2] - 26), V(A[0] + 24, 9, A[2] - 25)), wallM);
    shell.add(boxGeo(V(A[0] - 25, 0, A[2] - 26), V(A[0] - 24, 9, A[2] + 15)), wallM);
    shell.add(boxGeo(V(A[0] + 24, 0, A[2] - 26), V(A[0] + 25, 9, A[2] + 15)), wallM);
    shell.add(boxGeo(V(A[0] - 25, 9, A[2] - 26), V(A[0] + 25, 9.4, A[2] + 15), 0, true), lam("hallCeil", () => ({ color: "#d8d2c6" })));
    for (let i = -2; i <= 2; i++) ab.add(boxGeo(V(A[0] - 24, 0, A[2] + 13.6), V(A[0] + 24, 0.25, A[2] + 14)), lam("skirting", () => ({ color: "#6a6460" })));
    for (const x of [-12, 12]) for (const z of [-14, 6]) shell.add(boxGeo(V(A[0] + x - 0.5, 0, A[2] + z - 0.5), V(A[0] + x + 0.5, 9, A[2] + z + 0.5)), wallM); // columns
    // carousel: stadium of straight 2 x 3 m and radius 1.9 m; base, belt ring (own mesh, scrolling), steel island
    const STR = CAR.STR, RAD = CAR.RAD, W2 = 0.55;
    const stadium = (r: number, y: number) => {
      const s = new THREE.Shape(); s.moveTo(-STR, -r); s.lineTo(STR, -r); s.absarc(STR, 0, r, -Math.PI / 2, Math.PI / 2, false); s.lineTo(-STR, r); s.absarc(-STR, 0, r, Math.PI / 2, Math.PI * 1.5, false);
      const g = new THREE.ExtrudeGeometry(s, { depth: y, bevelEnabled: false, curveSegments: 20 }); g.rotateX(-Math.PI / 2); g.translate(A[0], 0, A[2]); return g;
    };
    for (const z of [14 - 0.02, -25 + 0.02]) shell.add(boxGeo(V(A[0] - 24, 2.6, A[2] + z - 0.06), V(A[0] + 24, 3.2, A[2] + z + 0.06)), lam("hallStripe", () => ({ color: "#2f6fa8" })));
    for (const x of [-16, -6, 6, 16]) shell.add(boxGeo(V(A[0] + x - 1.4, 0, A[2] + 13.9), V(A[0] + x + 1.4, 2.4, A[2] + 14.02)), lam("hallDoor", () => ({ color: "#6c7a88" })));
    ab.add(stadium(RAD + W2 + 0.15, 0.42), lam("carBase", () => ({ color: "#5a5e66" })));
    ab.add(stadium(RAD - W2, 0.95), steel);
    ab.build(this.airport); shell.build(this.airport, false);
    // belt: a strip around the stadium centre line, u = arc length (1 unit = 2 m of the belt map)
    const bp: number[] = [], bu: number[] = [], bi: number[] = [];
    const path = carPath(), N = path.length;
    for (let i = 0; i < N; i++) {
      const [x, z, nx, nz, s] = path[i];
      bp.push(A[0] + x - nx * W2, 0.46, A[2] + z - nz * W2, A[0] + x + nx * W2, 0.46, A[2] + z + nz * W2);
      bu.push(s / 2, 0, s / 2, 1);
      if (i < N - 1) { const a = i * 2; bi.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    }
    const bg = new THREE.BufferGeometry(); bg.setAttribute("position", new THREE.Float32BufferAttribute(bp, 3)); bg.setAttribute("uv", new THREE.Float32BufferAttribute(bu, 2));
    bg.setIndex(bi); bg.computeVertexNormals();
    // keep the normals up whatever the winding
    const bn = bg.attributes.normal as THREE.BufferAttribute; for (let i = 0; i < bn.count; i++) bn.setXYZ(i, 0, 1, 0);
    this.belt = beltHD(); this.belt.anisotropy = 16;
    const beltMesh = new THREE.Mesh(bg, lam("belt", () => ({ map: this.belt, side: THREE.DoubleSide }))); beltMesh.receiveShadow = true;
    this.airport.add(beltMesh);
    // ceiling light panels (HDR: bloom)
    const lightM = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 2.35, 2.2) });
    for (let i = -2; i <= 2; i++) for (const z of [-14, -4, 6]) { const p = new THREE.Mesh(new THREE.PlaneGeometry(3, 1.2), lightM); p.rotation.x = Math.PI / 2; p.position.set(A[0] + i * 8, 8.98, A[2] + z); this.airport.add(p); }
    // the lonely suitcase
    this.suitcase = new THREE.Group();
    const caseM = lam("case", () => ({ color: "#c0533a" }));
    const cb = new Batch();
    cb.add(boxGeo(V(-0.38, 0, -0.26), V(0.38, 0.26, 0.26), 0, true), caseM);
    cb.add(boxGeo(V(-0.39, 0.1, -0.27), V(0.39, 0.14, 0.27)), lam("caseBand", () => ({ color: "#8e3a28" })));
    cb.add(boxGeo(V(-0.14, 0.26, -0.04), V(0.14, 0.31, 0.04)), lam("caseHandle", () => ({ color: "#2a2422" })));
    cb.add(boxGeo(V(0.1, 0.262, 0.06), V(0.3, 0.266, 0.2)), lam("caseTag", () => ({ color: "#f1ece0" })));
    cb.build(this.suitcase);
    this.suitcase.traverse((o) => { o.castShadow = true; });
    this.airport.add(this.suitcase);
    this.carPath = path;

    // ---- blizzard snow: points in a box that follows the camera ----
    const NS = 6000, sp = new Float32Array(NS * 3), sr = rng(11);
    for (let i = 0; i < NS; i++) { sp[i * 3] = sr() * 60 - 30; sp[i * 3 + 1] = sr() * 30 - 8; sp[i * 3 + 2] = sr() * 60 - 30; }
    const sg = new THREE.BufferGeometry(); sg.setAttribute("position", new THREE.Float32BufferAttribute(sp, 3));
    this.snowMat = new THREE.PointsMaterial({ map: flakeTex(), size: 0.09, transparent: true, depthWrite: false, color: "#ffffff", fog: false });
    this.snow = new THREE.Points(sg, this.snowMat); this.snow.frustumCulled = false; this.snow.layers.set(NOINK);
    this.snow.userData.base = sp.slice();
    R.add(this.snow);
    // ---- smoke ----
    const mk = (dark: boolean, n: number, out: Smoke[], parent: THREE.Object3D) => {
      for (let k = 0; k < n; k++) {
        const mat = new THREE.MeshLambertMaterial({ map: smokeTex(dark), transparent: true, depthWrite: false });
        const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat); m.layers.set(NOINK);
        out.push({ m, mat, k: k / n }); parent.add(m);
      }
    };
    mk(true, 9, this.smokeShip, this.root); mk(false, 6, this.smokeHut, this.arctic);
  }
  /** camera-relative sun, frozen per shot */
  private shotSun(id: number, s: ShotDef, L: LightPreset) {
    let v = this.sunCache.get(id);
    if (v) return v;
    let fx = 0, fz = 0;
    for (let f = s.a; f < s.b; f += 3) {
      const c = camAt(id, f), x = c.look[0] - c.pos[0], z = c.look[2] - c.pos[2], n = Math.hypot(x, z) || 1;
      fx += x / n; fz += z / n;
    }
    const n = Math.hypot(fx, fz) || 1; fx /= n; fz /= n;
    const az = THREE.MathUtils.degToRad(SUN_SHOT[id]?.az ?? L.az), el = THREE.MathUtils.degToRad(SUN_SHOT[id]?.el ?? L.el);
    const hx = fx * Math.cos(az) - fz * Math.sin(az), hz = fz * Math.cos(az) + fx * Math.sin(az);
    v = new THREE.Vector3(hx * Math.cos(el), Math.sin(el), hz * Math.cos(el)).normalize();
    this.sunCache.set(id, v);
    return v;
  }
  private actor(i: number) { while (this.actors.length <= i) this.actors.push(new Actor(this.root)); return this.actors[i]; }
  private fx(i: number) { while (this.fxs.length <= i) this.fxs.push(new Fx(this.root)); return this.fxs[i]; }

  update(id: number, f: number, cam: THREE.PerspectiveCamera, scene: THREE.Scene) {
    const t = f / FPS, s = SHOTS[id - 1], L = LIGHTS[s.light], E = envAt(id, f), P = packAt(id, f), SH = shipAt(id, f);
    const inside = s.zone === "airport";
    this.arctic.visible = !inside; this.airport.visible = inside;
    // ---- camera ----
    const dbg = (getInputProps() as { cam?: { pos: V3; look: V3; fov?: number } }).cam;
    const c = dbg ? { pos: dbg.pos, look: dbg.look, fov: dbg.fov ?? 40, roll: 0 } : camAt(id, f);
    cam.position.set(...c.pos); cam.up.set(0, 1, 0); cam.lookAt(...c.look); cam.rotateZ(c.roll);
    cam.fov = c.fov; cam.near = 0.2; cam.far = 6000; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    const focus = V(...c.look), dist = cam.position.distanceTo(focus);
    cam.layers.enable(NOINK);
    // ---- light rig ----
    const K = LOOK[s.light], sunDir = this.shotSun(id, s, L);
    this.hemi.color.set(L.sky); this.hemi.groundColor.set(L.ground); this.hemi.intensity = L.hemiI;
    this.sun.color.set(L.sunCol); this.sun.intensity = L.sunI;
    let Rr = THREE.MathUtils.clamp(dist * 1.15 + 9, 14, 140);
    if (s.light === "golden") Rr = Math.max(Rr, 40);
    if (id === 14 || id === 16 && f < 1668) Rr = 420;
    this.sun.position.copy(focus).addScaledVector(sunDir, 600); this.sun.target.position.copy(focus);
    const sc = this.sun.shadow.camera;
    sc.left = -Rr; sc.right = Rr; sc.top = Rr; sc.bottom = -Rr; sc.near = 50; sc.far = 1400; sc.updateProjectionMatrix();
    this.sun.shadow.bias = L.bias; this.sun.shadow.normalBias = L.normalBias * (Rr / 12);
    TONE.uLitCol.value.set(...L.lit); TONE.uShadeCol.value.set(...L.shade); TONE.uShadeLift.value.set(...L.lift);
    TONE.uLambert.value = L.lambert; TONE.uSideK.value = L.sideK; TONE.uTerm.value = L.term; TONE.uBounce.value.set(...K.bounce); TONE.uSat.value = K.sat;
    CHAR.uCharTint.value.set(...L.charTint); CHAR.uCharShade.value = L.charShade; CHAR.uGrad.value = L.charGrad;
    CHAR.uBodyGrad.value = L.bodyGrad; CHAR.uSideTint.value.set(...L.sideTint);
    // ---- sky, fog (blizzard turns it white and close), sun, clouds ----
    const su = this.skyMat.uniforms;
    K.sky.c.forEach((h, i) => untone(h, su["c" + i].value));
    const e = K.sky.e.map((deg) => THREE.MathUtils.degToRad(deg));
    su.e.value.set(e[1], e[2], e[3], e[4]);
    this.sky.position.copy(cam.position);
    untone(L.fog, this.fog.color); this.fog.near = L.fogNear; this.fog.far = E.fogFar ?? L.fogFar;
    if (inside) { this.fog.near = 200; this.fog.far = 2000; }
    if (E.snow > 0) {
      const w = untone(s.light === "golden" ? "#b9a7b8" : "#e4ebf2");
      this.fog.color.lerp(w, Math.min(1, E.snow * 1.3));
      this.fog.near = THREE.MathUtils.lerp(this.fog.near, 1, E.snow); this.fog.far = THREE.MathUtils.lerp(this.fog.far, 26, E.snow ** 0.7);
      for (let i = 0; i < 5; i++) su["c" + i].value.lerp(this.fog.color, Math.min(1, E.snow * 1.4));
    }
    scene.fog = this.fog; scene.background = null;
    const showSun = s.light === "golden" && E.snow < 0.3 && !inside;
    this.sunDisc.visible = this.sunHalo.visible = showSun;
    if (showSun) {
      this.sunDisc.position.copy(cam.position).addScaledVector(sunDir, 2400);
      this.sunDisc.scale.setScalar(2 * 2400 * Math.tan(THREE.MathUtils.degToRad(1.7)));
      this.sunHalo.position.copy(this.sunDisc.position); this.sunHalo.scale.setScalar(2 * 2400 * Math.tan(THREE.MathUtils.degToRad(24)));
      (this.sunHalo.material as THREE.SpriteMaterial).color.set(L.sunDisc).multiplyScalar(1.3);
    }
    for (let i = 0; i < this.clouds.length; i++) {
      const m = this.clouds[i], mat = m.material as THREE.MeshBasicMaterial;
      m.lookAt(cam.position.x, m.position.y, cam.position.z);
      mat.map = this.cloudMaps[s.light][i % 4];
      m.visible = E.snow < 0.3;
    }
    const W = this.WU, wc = K.water;
    untone(wc.near, W.wNearC.value); untone(wc.mid, W.wMidC.value); untone(wc.far, W.wFarC.value);
    untone(wc.crest, W.wCrest.value); untone(wc.trough, W.wTrough.value); untone(wc.glint, W.wGlint.value);
    W.wShade.value.set(...wc.shade); W.wTime.value = t;
    // ---- pack + ship ----
    this.pack.position.set(P.x, 0, P.z); this.pack.rotation.set(0, P.rot, 0);
    this.iceU.value = E.iceR;
    const q = new THREE.Quaternion(), e3 = new THREE.Euler();
    this.floeData.forEach((d, i) => {
      const on = d.d > E.iceR + 6 ? 1 : 0;
      e3.set(0.1 * Math.sin(d.r * 3), d.r, 0.12 * Math.cos(d.r * 5)); q.setFromEuler(e3);
      this.floes.setMatrixAt(i, this.m4.compose(this.v.set(d.x, ICE_Y + d.s[1] * 0.25, d.z), q, new THREE.Vector3(d.s[0] * on, d.s[1] * on, d.s[2] * on)));
    });
    this.floes.instanceMatrix.needsUpdate = true;
    for (const h of this.heave) { h.m.rotation.set(0, 0, E.heave * h.s); h.m.position.y = ICE_Y + 0.1 + 0.8 * E.heave * h.s; h.m.position.x = h.x0 - 0.6 * E.heave; h.m.visible = id === 13; }
    this.shipG.visible = SH.visible && !inside;
    this.shipG.position.set(SH.x, SH.y, SH.z); this.shipG.rotation.set(SH.pitch, SH.yaw, SH.roll, "YXZ");
    const frozen = E.iceR < 8;
    this.ship.skirt.visible = frozen;
    const snowy = id === 1 || id >= 4;
    for (const m of this.ship.snowDeck) m.visible = snowy;
    for (const m of this.ship.woodDeck) m.visible = !snowy;
    this.ship.tarpFore.visible = id !== 2; this.ship.bales.visible = id === 2;
    this.ship.ladder.visible = id >= 9 && id !== 10;
    this.ship.glowMesh.visible = SH.lit > 0.01; this.ship.glow.color.setRGB(5.0 * SH.lit, 3.1 * SH.lit, 1.2 * SH.lit);
    this.ship.flag.visible = id === 13 && f < F_FLAG_DROP;
    this.ship.flag.position.set(4.3, DECK + 0.6, -6.4);
    // ---- shore set ----
    this.hutWalls.scale.set(1, Math.max(0.001, E.hut), 1); this.hutWalls.visible = E.hut > 0.01;
    this.hutTop.visible = E.hut > 0.97;
    // ski plane
    this.plane.visible = E.plane > 0 || (E.plane === 0 && id === 4);
    if (this.plane.visible) {
      const u = E.plane, ss = id === 17;
      const a = ss ? V(-20, 24, 100) : V(26, 1.6, 40), b = ss ? V(90, 30, 150) : V(-34, 42, -95), mid = ss ? V(34, 22, 122) : V(0, 10, -15);
      const p0 = a.clone().lerp(mid, u).lerp(mid.clone().lerp(b, u), u);
      const p1 = a.clone().lerp(mid, u + 0.01).lerp(mid.clone().lerp(b, u + 0.01), u + 0.01);
      this.plane.position.copy(p0); this.plane.lookAt(p1); this.plane.rotateZ(ss ? -0.25 : 0.15);
      this.prop.rotation.z = t * 40;
    }
    this.sled.visible = id === 11 || id === 17;
    this.sled.position.set(SLED_AT[0], ICE_Y, SLED_AT[2]); this.sled.rotation.set(0, 0, 0);
    if (id === 17) { this.sled.position.set(62, ICE_Y, 44); this.sled.rotation.y = 0.5; }
    // ---- airport ----
    if (inside) {
      this.belt.offset.x = -t * CAR_SPEED / 2;
      const P2 = suitcaseAt(f);
      this.suitcase.position.set(AIR[0] + P2[0], 0.47, AIR[2] + P2[1]); this.suitcase.rotation.set(0, Math.atan2(P2[2], P2[3]) + 0.25, 0);
    }
    // ---- snow + smoke ----
    this.snow.visible = E.snow > 0.02;
    if (this.snow.visible) {
      const pa = this.snow.geometry.attributes.position as THREE.BufferAttribute, b0 = this.snow.userData.base as Float32Array;
      for (let i = 0; i < pa.count; i++) {
        const x = ((b0[i * 3] + t * 9 + 30) % 60 + 60) % 60 - 30, y = ((b0[i * 3 + 1] - t * 3.2 + 8) % 30 + 30) % 30 - 8, z = ((b0[i * 3 + 2] + t * 2.5 + 30) % 60 + 60) % 60 - 30;
        pa.setXYZ(i, cam.position.x + x, cam.position.y + y, cam.position.z + z);
      }
      pa.needsUpdate = true; this.snowMat.opacity = Math.min(1, E.snow * 1.5); this.snowMat.size = 0.08 + 0.05 * E.snow;
    }
    const ft = this.ship.funnelTop.clone(); this.shipG.updateMatrixWorld(true); this.pack.updateMatrixWorld(true); ft.applyMatrix4(this.ship.root.matrixWorld);
    for (const sm of this.smokeShip) {
      const u = (t * 0.32 + sm.k) % 1, sz = 2.5 + u * 9;
      sm.m.visible = SH.smoke > 0.02 && this.shipG.visible;
      sm.m.position.set(ft.x - u * 6, ft.y + u * 9 + u * u * 3, ft.z - u * 22);
      sm.m.scale.set(sz, sz, 1); sm.m.quaternion.copy(cam.quaternion);
      sm.mat.opacity = 0.9 * (1 - u) ** 1.2 * SH.smoke;
    }
    const hutLive = E.hut > 0.97 && id >= 4 && id <= 8;
    for (const sm of this.smokeHut) {
      const u = (t * 0.18 + sm.k) % 1, sz = 0.6 + u * 3;
      sm.m.visible = hutLive;
      sm.m.position.set(HUT[0] + 1.4 + u * 3, HUT[1] + 5.6 + u * 5, HUT[2] - 0.8 + u * 1.2);
      sm.m.scale.set(sz, sz, 1); sm.m.quaternion.copy(cam.quaternion);
      sm.mat.opacity = 0.8 * (1 - u) ** 1.3;
    }
    // ---- cast + effects ----
    const right = V(0, 0, 0).setFromMatrixColumn(cam.matrixWorld, 0);
    const st = stage(id, t, { pos: cam.position, right, sun: sunDir }, P, SH, E);
    this.frustum.setFromProjectionMatrix(this.m4.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
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
      else if (p.yaw !== undefined) ef.mesh.rotation.set(0, p.yaw, p.rot ?? 0);
      else { ef.mesh.quaternion.copy(cam.quaternion); ef.mesh.rotateZ(p.rot ?? 0); }
      ef.mesh.scale.set(p.w * (p.mirror ? -1 : 1), p.h, 1);
      fused.push(ef);
    }
    for (let i = fi; i < this.fxs.length; i++) this.fxs[i].mesh.visible = false;
    this.pool.flush();
    for (const a of used) a.bind();
    for (const ef of fused) ef.bind();
    return focus;
  }
}

export const SLED_AT: V3 = [30, ICE_Y, -110];
export const F_FLAG_DROP = 1322;
void packPt; void clamp01; void ([] as Pack[]);

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
