// All six sets as one three.js scene; update(id, f, camera) shows the shot's set, sets its light, poses the dynamic
// bits (film-can stack, screen image, poster, decorations) and places the cast (cast.ts). Pure function of id + f.
import * as THREE from "three";
import { Batch, boxGeo, V, lam, quad, tri, house, prop, setSight, Kit, Ray } from "./build";
import { rep, ctex, cobbleHD, grassHD, stoneHD, roofHD, cloudHD, brick } from "./paint";
import {
  cinemaFront, heroPoster, poster, bahayFront, salonSign, hangarWall, canTop, canSide, flagPH, flagJP, homeFront, tvVillain, palaceFront,
  officeWall, paperSide, screenFrame, parolTex, bulbTex, beamTex, lechonTex, foodTex,
} from "./paint2";
import { LIGHTS, LOOK, LightPreset } from "./lights";
import { TONE, CHAR, twoTone, untone } from "./shade";
import { NOINK } from "./ink";
import { Pool, Actor, Fx, stage } from "./cast";
import { FPS, SHOTS, ShotDef, SetName, camAt, V3, ESC, THE, STU, HOME, PAL, OFF, STACK_PH, STACK_JP, CAN_H, cansAt, W, smooth } from "./story";

export const loadKit = () => Promise.resolve({} as Kit);

const M4 = (x: number, y: number, z: number, ry = 0) => new THREE.Matrix4().makeRotationY(ry).setPosition(x, y, z);
const flat = (col: string) => lam("c" + col, () => ({ color: col }));
const tex = (key: string, t: () => THREE.Texture, extra: THREE.MeshLambertMaterialParameters = {}) => lam(key, () => ({ map: t(), ...extra }));
/** horizontal ground quad */
const ground = (b: Batch, x0: number, x1: number, z0: number, z1: number, mat: THREE.Material, tile: number, y = 0) =>
  b.add(quad(V(x0, y, z1), V(x1, y, z1), V(x1, y, z0), V(x0, y, z0), (x1 - x0) / tile, (z1 - z0) / tile), mat);
/** unlit (self-lit) plane, e.g. posters under the marquee lights, the screen, parols: colour > 1 blooms */
const glow = (map: THREE.Texture, k = 1, extra: THREE.MeshBasicMaterialParameters = {}) =>
  new THREE.MeshBasicMaterial({ map, color: new THREE.Color(k, k, k), ...extra });
const plane = (w: number, h: number, mat: THREE.Material, x: number, y: number, z: number, ry = 0, noink = false) => {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  m.position.set(x, y, z); m.rotation.y = ry; if (noink) m.layers.set(NOINK);
  return m;
};

/** every lens position of the film: houses and trees that would block one are left out */
const sightLines = (): Ray[] => {
  const out: Ray[] = [];
  for (const s of SHOTS) for (let f = s.a - 6; f < s.b + 6; f += 3) {
    const c = camAt(s.id, Math.max(0, f)), o = V(...c.pos), look = V(...c.look);
    const fw = look.clone().sub(o), len = fw.length();
    fw.normalize();
    const rt = fw.clone().cross(V(0, 1, 0)).normalize(), up = rt.clone().cross(fw);
    const ty = Math.tan((c.fov * Math.PI) / 360), tx = ty * (9 / 16);
    for (const [sx, sy] of [[0, 0], [-0.6, 0], [0.6, 0], [0, 0.6], [0, -0.4]])
      out.push({ o, d: fw.clone().addScaledVector(rt, sx * tx).addScaledVector(up, sy * ty), len, core: sx === 0 && sy === 0 });
  }
  return out;
};

type Dyn = {
  cansPH: THREE.InstancedMesh; cansJP: THREE.InstancedMesh; jpGroup: THREE.Group; screen: THREE.Mesh; screenMat: THREE.MeshBasicMaterial;
  poster: THREE.MeshBasicMaterial; xmas: THREE.Group; homeXmas: THREE.Group; ballot: THREE.Group; rally: THREE.Group; handaan: THREE.Group;
  noche: THREE.Group; bench: THREE.Group; benches1897: THREE.Group; seatsNew: THREE.Group; beam: THREE.Mesh; tv: THREE.Mesh; phoneGlow: THREE.Mesh;
};

export class World {
  root = new THREE.Group();
  private sets: Record<SetName, THREE.Group> = {} as Record<SetName, THREE.Group>;
  private pool = new Pool();
  private actors: Actor[] = [];
  private fxs: Fx[] = [];
  private hemi = new THREE.HemisphereLight("#cfe6ff", "#6c5c8c", 1.1);
  private sun = new THREE.DirectionalLight("#fff0d6", 2.6);
  private sky: THREE.Mesh; private skyMat: THREE.ShaderMaterial;
  private fog = new THREE.Fog("#bccbec", 25, 420);
  private sunDisc: THREE.Sprite;
  private sunCache = new Map<number, THREE.Vector3>();
  private clouds: THREE.Mesh[] = [];
  private cloudMaps: Record<string, THREE.Texture[]>;
  private d: Dyn;
  private frustum = new THREE.Frustum(); private m4 = new THREE.Matrix4(); private v = new THREE.Vector3(); private sph = new THREE.Sphere();

  constructor(kit: Kit) {
    const R = this.root;
    // ---- sky dome, sun, lights, clouds ----
    this.skyMat = new THREE.ShaderMaterial({
      uniforms: { c0: { value: new THREE.Color() }, c1: { value: new THREE.Color() }, c2: { value: new THREE.Color() },
        c3: { value: new THREE.Color() }, c4: { value: new THREE.Color() }, e: { value: new THREE.Vector4() } },
      vertexShader: "varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      fragmentShader: `uniform vec3 c0, c1, c2, c3, c4; uniform vec4 e; varying vec3 vP;
        void main(){ float el = asin(clamp(normalize(vP).y, -1.0, 1.0));
          vec3 c = mix(c0, c1, smoothstep(0.0, e.x, el)); c = mix(c, c2, smoothstep(e.x, e.y, el));
          c = mix(c, c3, smoothstep(e.y, e.z, el)); c = mix(c, c4, smoothstep(e.z, e.w, el)); gl_FragColor = vec4(c, 1.0); }`,
      side: THREE.BackSide, depthWrite: false, fog: false,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(1100, 48, 24), this.skyMat);
    this.sky.renderOrder = -1; this.sky.frustumCulled = false; this.sky.layers.set(NOINK);
    R.add(this.sky);
    const disc = ctex("sunDisc2", 128, 128, (g) => {
      const gr = g.createRadialGradient(64, 64, 40, 64, 64, 64); gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    });
    this.sunDisc = new THREE.Sprite(new THREE.SpriteMaterial({ map: disc, color: new THREE.Color(6.0, 4.4, 2.4), fog: false, depthWrite: false }));
    this.sunDisc.frustumCulled = false; this.sunDisc.layers.set(NOINK); R.add(this.sunDisc);
    this.sun.castShadow = true; this.sun.shadow.mapSize.set(2048, 2048);
    R.add(this.hemi, this.sun, this.sun.target);
    this.cloudMaps = { day: [0, 1, 2, 3].map((k) => cloudHD(k, LOOK.day.cloud)), golden: [0, 1, 2, 3].map((k) => cloudHD(k, LOOK.golden.cloud)), night: [0, 1, 2, 3].map((k) => cloudHD(k, LOOK.night.cloud)) };
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + 0.3, d = 620 + (i % 3) * 60, w = 130 + (i % 4) * 30;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: this.cloudMaps.day[i % 4], color: new THREE.Color(1.1, 1.1, 1.1), transparent: true, depthWrite: false, fog: false }));
      m.position.set(Math.cos(a) * d, 120 + (i % 4) * 38, Math.sin(a) * d); m.scale.set(w, w / 2, 1); m.layers.set(NOINK);
      this.clouds.push(m); R.add(m);
    }
    setSight(sightLines());
    const mk = (n: SetName) => { const g = new THREE.Group(); g.name = n; this.sets[n] = g; R.add(g); return g; };
    const dyn: Partial<Dyn> = {};
    this.plaza(mk("plaza"), kit, dyn);
    this.escolta(mk("escolta"), kit);
    this.theater(mk("theater"), dyn);
    this.studio(mk("studio"), kit, dyn);
    this.home(mk("home"), kit, dyn);
    this.palace(mk("palace"), kit);
    this.office(mk("office"));
    this.d = dyn as Dyn;
  }

  // ======================= PLAZA (cinema) =======================
  private plaza(G: THREE.Group, kit: Kit, d: Partial<Dyn>) {
    const b = new Batch();
    ground(b, -160, 160, -160, 160, tex("cobblePlaza", () => cobbleHD()), 4);
    // cinema block
    const front = lam("cinemaFront", () => ({ map: cinemaFront() }));
    b.add(quad(V(-9, 0, -12), V(9, 0, -12), V(9, 12, -12), V(-9, 12, -12)), front);
    const side = flat("#e6cfa3");
    b.add(boxGeo(V(-9, 0, -26), V(9, 12, -12.02)), side);
    b.add(boxGeo(V(-9.3, 11.6, -12.4), V(9.3, 12.4, -11.6)), flat("#3d8a87")); // cornice
    // marquee canopy + fascia
    b.add(boxGeo(V(-7, 3.8, -12), V(7, 4.6, -9.6), 0, true), flat("#e07a5f"));
    b.add(boxGeo(V(-7.05, 3.75, -9.65), V(7.05, 4.0, -9.5)), flat("#f3cf7a"));
    // poster stands (A-boards) in front, either side of the doors
    for (const [x, k] of [[-6.0, 0], [-3.6, 1], [3.6, 2], [6.0, 3]] as const) {
      b.add(boxGeo(V(x - 0.65, 0, -10.0), V(x + 0.65, 1.95, -9.9)), flat("#3a2a22"));
      G.add(plane(1.12, 1.62, glow(poster(k), 1.05), x, 1.0, -9.88, 0));
    }
    // billboard frame + the hero poster (swaps to the empty cut-out once he steps out)
    b.add(boxGeo(V(-2.65, 4.75, -12.1), V(2.65, 11.0, -11.98)), flat("#241726"));
    d.poster = glow(heroPoster(false), 1.0);
    G.add(plane(4.8, 5.76, d.poster, 0, 7.88, -11.95));
    // surrounding town: rows of houses, trees, lamp posts
    const rowH = [7, 8.4, 9.8];
    let si = 0;
    for (const sx of [-1, 1]) {
      for (let x = 11.5; x < 70; x += 8.4) house(b, sx * (x + 3.5), -16, 0, 8, 8, rowH[si % 3], si++);
      for (let z = -8; z < 30; z += 8.6) house(b, sx * 19, z, sx < 0 ? Math.PI / 2 : -Math.PI / 2, 8, 8, rowH[si % 3], si++);
    }
    for (let x = -30; x < 34; x += 8.6) house(b, x, 34, Math.PI, 8, 8, rowH[si % 3], si++);
    for (const [x, z] of [[-13, -4], [13, -4], [-13, 12], [13, 12], [-6, 24], [7, 24]]) prop(b, kit, "tree_oak", x, 0, z, 6.5);
    const pole = flat("#2b2f3a");
    for (const [x, z] of [[-9.5, -6], [9.5, -6], [-9.5, 8], [9.5, 8]]) {
      b.add(boxGeo(V(x - 0.08, 0, z - 0.08), V(x + 0.08, 4.2, z + 0.08)), pole);
      b.add(boxGeo(V(x - 0.25, 4.2, z - 0.25), V(x + 0.25, 4.7, z + 0.25)), flat("#f3ead0"));
    }
    b.build(G);
    // marquee bulbs (always; they bloom at night)
    const bulbs = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.16, 0.16), new THREE.MeshBasicMaterial({ map: bulbTex(), color: new THREE.Color(2.2, 2.0, 1.6), transparent: true, depthWrite: false }), 120);
    let n = 0;
    for (let i = 0; i < 56; i++) bulbs.setMatrixAt(n++, M4(-6.9 + i * (13.8 / 55), 3.87, -9.48));
    for (let i = 0; i < 32; i++) { const a = (i / 32); bulbs.setMatrixAt(n++, M4(-2.72, 4.8 + a * 6.1, -11.9)); bulbs.setMatrixAt(n++, M4(2.72, 4.8 + a * 6.1, -11.9)); }
    bulbs.count = n; bulbs.layers.set(NOINK); G.add(bulbs);
    // Christmas: parols over the plaza on strings, string lights
    const xmas = new THREE.Group();
    const cols = ["#e2453c", "#f2c33c", "#3f8fd8", "#57b35a", "#f08ac0"];
    const strLights = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.14, 0.14), new THREE.MeshBasicMaterial({ map: bulbTex(), color: new THREE.Color(2.4, 2.0, 1.4), transparent: true, depthWrite: false }), 400);
    let m = 0;
    for (const zc of [-6, 0, 6, 12]) {
      for (let i = 0; i < 4; i++) {
        if (zc === 12 && i === 3) continue;
        const x = -7.5 + i * 5, y = 5.6 + 0.3 * Math.sin(i * 1.7 + zc);
        const p = plane(1.0, 1.5, glow(parolTex(cols[(i + zc) % 5 < 0 ? 0 : (i + zc + 20) % 5]), 1.6, { alphaTest: 0.5, side: THREE.DoubleSide }), x, y - 0.4, zc, 0, true);
        xmas.add(p);
      }
      for (let i = 0; i <= 60; i++) { const u = i / 60, x = -9.4 + u * 18.8, y = 6.4 - 1.1 * Math.sin(Math.PI * u); strLights.setMatrixAt(m++, M4(x, y, zc)); }
    }
    strLights.count = m; strLights.layers.set(NOINK); xmas.add(strLights);
    // a christmas tree (cone stack) at the plaza side
    const tb = new Batch();
    for (let k = 0; k < 4; k++) tb.add(new THREE.ConeGeometry(1.7 - k * 0.35, 1.6, 10).translate(0, 1.2 + k * 1.0, 0), flat("#2f7a4a"), M4(-7.6, 0, 3));
    tb.add(new THREE.CylinderGeometry(0.2, 0.25, 0.6, 8).translate(0, 0.3, 0), flat("#7a4b2a"), M4(-7.6, 0, 3));
    tb.build(xmas);
    const star = plane(0.9, 1.35, glow(parolTex("#f2c33c"), 1.8, { alphaTest: 0.5, side: THREE.DoubleSide }), -7.6, 5.6, 3, 0, true);
    xmas.add(star);
    G.add(xmas); d.xmas = xmas;
    // polling table (1998)
    const ballot = new THREE.Group(), bb = new Batch();
    bb.add(boxGeo(V(-5.6, 0.72, -2.2), V(-3.2, 0.78, -0.9)), flat("#8a5a34"));
    for (const [x, z] of [[-5.5, -2.1], [-3.3, -2.1], [-5.5, -1.0], [-3.3, -1.0]]) bb.add(boxGeo(V(x - 0.04, 0, z - 0.04), V(x + 0.04, 0.72, z + 0.04)), flat("#6a4a2e"));
    bb.add(boxGeo(V(-4.75, 0.78, -1.85), V(-4.05, 1.3, -1.25)), flat("#8a5a34"));
    bb.add(boxGeo(V(-4.8, 1.3, -1.9), V(-4.0, 1.38, -1.2)), flat("#c9ccd2"));
    bb.add(boxGeo(V(-4.6, 1.38, -1.6), V(-4.2, 1.4, -1.5)), flat("#141018"));
    bb.add(boxGeo(V(-4.6, 0.95, -1.251), V(-4.2, 1.15, -1.24)), flat("#f2c33c"));
    bb.add(boxGeo(V(-5.9, 0, -3.2), V(-2.9, 2.4, -3.1)), flat("#fbf6ea")); // booth screen behind
    bb.build(ballot); G.add(ballot); d.ballot = ballot;
    G.add(plane(1.4, 0.7, glow(flagPH(), 1.0, { side: THREE.DoubleSide }), -4.4, 2.0, -3.05));
    // rally stage (ending)
    const rally = new THREE.Group(), rb = new Batch();
    rb.add(boxGeo(V(-5, 0, -11), V(5, 1.1, -7.0)), flat("#3a5a8a"));
    rb.add(boxGeo(V(-5.05, 1.05, -11), V(5.05, 1.15, -6.95)), flat("#f2c33c"));
    for (const x of [-4.9, 4.9]) rb.add(boxGeo(V(x - 0.08, 1.1, -10.9), V(x + 0.08, 5.2, -10.75)), flat("#2b2f3a"));
    rb.build(rally);
    const bunt = new THREE.InstancedMesh(tri(V(-0.17, 0, 0), V(0.17, 0, 0), V(0, -0.42, 0)), lam("pennant2", () => ({ side: THREE.DoubleSide })), 40);
    const pc = ["#d42a2f", "#f2c33c", "#1f4fa8", "#fbf8ef"].map((c) => new THREE.Color(c));
    for (let i = 0; i < 40; i++) { const u = i / 39, x = -4.9 + 9.8 * u; bunt.setMatrixAt(i, M4(x, 5.1 - 0.5 * Math.sin(Math.PI * u), -10.8)); bunt.setColorAt(i, pc[i % 4]); }
    rally.add(bunt);
    rally.add(plane(5.2, 2.6, glow(flagPH(), 1.0, { side: THREE.DoubleSide }), 0, 3.0, -10.95));
    G.add(rally); d.rally = rally;
  }

  // ======================= ESCOLTA 1897 =======================
  private escolta(G: THREE.Group, kit: Kit) {
    const b = new Batch(), [ox, , oz] = ESC;
    ground(b, ox - 3.6, ox + 3.6, oz - 80, oz + 80, tex("cobbleEsc", () => cobbleHD()), 3);
    const walk = tex("walkEsc", () => stoneHD("walkEsc", ["#d9cbb0", "#cfc0a3", "#e2d5bb", "#c8b898"], "#a8987c"));
    ground(b, ox - 6.2, ox - 3.6, oz - 80, oz + 80, walk, 2, 0.12);
    ground(b, ox + 3.6, ox + 6.2, oz - 80, oz + 80, walk, 2, 0.12);
    b.add(boxGeo(V(ox - 3.7, 0, oz - 80), V(ox - 3.55, 0.12, oz + 80)), flat("#b8a888"));
    b.add(boxGeo(V(ox + 3.55, 0, oz - 80), V(ox + 3.7, 0.12, oz + 80)), flat("#b8a888"));
    ground(b, ox - 200, ox + 200, oz - 200, oz + 200, tex("grassEsc", () => grassHD()), 6, -0.02);
    const STY = [
      { stone: "#d8c8a8", wood: "#7a4b2a", trim: "#efe3c8" }, { stone: "#cbb894", wood: "#5e3a24", trim: "#f6ead0" },
      { stone: "#e0d0b0", wood: "#8a5a34", trim: "#e9d6a8" }, { stone: "#c8b494", wood: "#6a4028", trim: "#f3e3c2" },
    ];
    const bahay = (side: number, z0: number, w: number, si: number, salon = false) => {
      const st = STY[si % STY.length], key = `${si % 4}_${w}${salon ? "s" : ""}`;
      const x = ox + side * 6.2, zc = oz + z0 + w / 2, dep = 9, h = 8;
      const fm = lam("bahayF" + key, () => ({ map: bahayFront(key, w, { ...st, salon }) }));
      const yaw = side < 0 ? Math.PI / 2 : -Math.PI / 2;
      const m = new THREE.Matrix4().makeRotationY(yaw).setPosition(x + side * (dep / 2), 0, zc);
      const hw = w / 2, hd = dep / 2;
      b.add(quad(V(-hw, 0, hd), V(hw, 0, hd), V(hw, h, hd), V(-hw, h, hd)), fm, m);
      b.add(boxGeo(V(-hw, 0, -hd), V(hw, h, hd - 0.02)), flat(st.stone), m);
      // upper floor overhang (volada) + hip roof
      b.add(boxGeo(V(-hw, 4.1, hd - 0.02), V(hw, 4.35, hd + 0.7)), flat(st.wood), m);
      const rm = lam("roofEsc" + (si % 2), () => ({ map: roofHD(si % 2 ? "#b8644f" : "#8f6a5a"), side: THREE.DoubleSide }));
      const o = 0.6, rh = 2.6;
      b.add(quad(V(-hw - o, h, hd + o), V(hw + o, h, hd + o), V(hw * 0.5, h + rh, 0), V(-hw * 0.5, h + rh, 0), w / 3, 1), rm, m);
      b.add(quad(V(hw + o, h, -hd - o), V(-hw - o, h, -hd - o), V(-hw * 0.5, h + rh, 0), V(hw * 0.5, h + rh, 0), w / 3, 1), rm, m);
      b.add(tri(V(-hw - o, h, -hd - o), V(-hw - o, h, hd + o), V(-hw * 0.5, h + rh, 0)), rm, m);
      b.add(tri(V(hw + o, h, hd + o), V(hw + o, h, -hd - o), V(hw * 0.5, h + rh, 0)), rm, m);
      if (salon) {
        const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.82), lam("salonSign", () => ({ map: salonSign() })));
        sign.position.set(x + side * -0.75, 3.55, zc); sign.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
        G.add(sign);
      }
    };
    let z = -60, si = 0;
    while (z < 60) { const w = [6, 7, 8][si % 3]; bahay(-1, z, w, si, z <= -4.5 && z + w > -4.5 ? false : false); z += w + 0.1; si++; }
    // the salon itself sits on the left at z -4.5..1.5 (overrides that stretch: built a little proud of the row)
    bahay(-1, -4.6, 6.2, 7, true);
    z = -58; si = 3;
    while (z < 60) { const w = [7, 6, 8][si % 3]; bahay(1, z, w, si); z += w + 0.1; si++; }
    // gas lamps + a few trees at the far end
    for (const zz of [-20, -8, 8, 20, 32]) for (const s of [-1, 1]) {
      b.add(boxGeo(V(ox + s * 4.0 - 0.06, 0.12, oz + zz - 0.06), V(ox + s * 4.0 + 0.06, 3.6, oz + zz + 0.06)), flat("#2b2f3a"));
      b.add(boxGeo(V(ox + s * 4.0 - 0.2, 3.6, oz + zz - 0.2), V(ox + s * 4.0 + 0.2, 4.1, oz + zz + 0.2)), flat("#f3e3b0"));
    }
    for (const [x, zz] of [[-12, 70], [12, 72], [0, 90]]) prop(b, kit, "tree_fat", ox + x, 0, oz + zz, 8);
    b.build(G);
  }

  // ======================= THEATER =======================
  private theater(G: THREE.Group, d: Partial<Dyn>) {
    const b = new Batch(), [ox, , oz] = THE;
    const wall = flat("#2e1620"), floor = flat("#22181e");
    ground(b, ox - 7, ox + 7, oz - 10, oz + 10, floor, 2);
    b.add(quad(V(ox - 7, 0, oz + 10), V(ox - 7, 0, oz - 10), V(ox - 7, 7, oz - 10), V(ox - 7, 7, oz + 10), 1, 1), wall); // left wall, facing +x
    b.add(quad(V(ox + 7, 0, oz - 10), V(ox + 7, 0, oz + 10), V(ox + 7, 7, oz + 10), V(ox + 7, 7, oz - 10), 1, 1), wall);
    b.add(quad(V(ox + 7, 0, oz + 10), V(ox - 7, 0, oz + 10), V(ox - 7, 7, oz + 10), V(ox + 7, 7, oz + 10), 1, 1), wall); // back wall, facing -z
    b.add(quad(V(ox - 7, 0, oz - 10), V(ox + 7, 0, oz - 10), V(ox + 7, 7, oz - 10), V(ox - 7, 7, oz - 10), 1, 1), flat("#2a1820")); // screen wall
    b.add(quad(V(ox - 7, 7, oz + 10), V(ox + 7, 7, oz + 10), V(ox + 7, 7, oz - 10), V(ox - 7, 7, oz - 10), 1, 1), flat("#1d1420")); // ceiling (faces down: wound so the front faces -y)
    for (const s of [-1, 1]) { // curtains
      for (let k = 0; k < 6; k++) b.add(boxGeo(V(ox + s * (4.2 + k * 0.4) - 0.2, 0, oz - 9.9), V(ox + s * (4.2 + k * 0.4) + 0.2, 6.8, oz - 9.5 + (k % 2) * 0.15)), flat(k % 2 ? "#a8283a" : "#8c1f30"));
    }
    b.add(boxGeo(V(ox - 7, 6.2, oz - 9.9), V(ox + 7, 7, oz - 9.4)), flat("#8c1f30"));
    for (const s of [-1, 1]) for (let k = 0; k < 5; k++) b.add(boxGeo(V(ox + s * 6.95 - 0.1, 2.6, oz - 6 + k * 4), V(ox + s * 6.95 + 0.1, 3.2, oz - 5.6 + k * 4)), flat("#f3cf7a")); // sconces
    b.build(G, false);
    // seats: 1897 wooden benches / modern red seats (toggled)
    const old = new THREE.Group(), nu = new THREE.Group(), ob = new Batch(), nb = new Batch();
    for (const z of [-1.6, 0.8, 3.2, 5.6, 8.0]) {
      ob.add(boxGeo(V(ox - 4.8, 0.42, oz + z - 0.2), V(ox + 4.8, 0.5, oz + z + 0.2)), flat("#8a5a34"));
      ob.add(boxGeo(V(ox - 4.8, 0.5, oz + z + 0.16), V(ox + 4.8, 1.0, oz + z + 0.22)), flat("#7a4b2a"));
      for (let x = -4.6; x <= 4.6; x += 1.15) ob.add(boxGeo(V(ox + x - 0.04, 0, oz + z - 0.15), V(ox + x + 0.04, 0.42, oz + z + 0.15)), flat("#5a3b2a"));
      for (let x = -5.4; x <= 5.4; x += 0.62) {
        nb.add(boxGeo(V(ox + x - 0.27, 0.36, oz + z - 0.22), V(ox + x + 0.27, 0.48, oz + z + 0.22)), flat("#b8283a"));
        nb.add(boxGeo(V(ox + x - 0.27, 0.48, oz + z + 0.18), V(ox + x + 0.27, 1.12, oz + z + 0.3)), flat("#c8323a"));
      }
    }
    ob.build(old, false); nb.build(nu, false); G.add(old, nu); d.benches1897 = old; d.seatsNew = nu;
    d.screenMat = glow(screenFrame("old", 0), 1.25);
    d.screen = plane(8.2, 4.6, d.screenMat, ox, 3.6, oz - 9.88);
    d.screen.layers.set(NOINK); G.add(d.screen);
    // projector beam: a soft additive wedge from the booth window to the screen
    const bm = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: beamTex(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: new THREE.Color(0.9, 0.95, 1.1), side: THREE.DoubleSide, fog: false }));
    bm.layers.set(NOINK); G.add(bm); d.beam = bm;
  }

  // ======================= STUDIO (1950s lot) =======================
  private studio(G: THREE.Group, kit: Kit, d: Partial<Dyn>) {
    const b = new Batch(), [ox, , oz] = STU;
    ground(b, ox - 150, ox + 150, oz - 150, oz + 150, flat("#b9b1a2"), 4);
    const hw = lam("hangar", () => ({ map: hangarWall() }));
    b.add(quad(V(ox - 16, 0, oz - 10), V(ox + 16, 0, oz - 10), V(ox + 16, 13, oz - 10), V(ox - 16, 13, oz - 10)), hw);
    b.add(boxGeo(V(ox - 16, 0, oz - 34), V(ox + 16, 13, oz - 10.02)), flat("#bdb5a2"));
    // curved roof
    const roof = new THREE.CylinderGeometry(16.5, 16.5, 24.2, 24, 1, true, -Math.PI / 2, Math.PI);
    roof.rotateX(Math.PI / 2).rotateY(Math.PI / 2).scale(1, 0.3, 1);
    b.add(roof, lam("hangarRoof", () => ({ color: "#9aa3a8", side: THREE.DoubleSide })), M4(ox, 13, oz - 22));
    for (const [x, z, k] of [[-22, -16, 1], [24, -14, 0], [-26, 4, 2]]) b.add(boxGeo(V(ox + x - 5, 0, oz + z - 6), V(ox + x + 5, 7 + k, oz + z + 6)), flat(["#d8c8a0", "#c9b48c", "#e0d0b0"][k]));
    // the camera on a tripod, a director's chair, two lamps on stands
    const cx = ox + 1.4, cz = oz + 1.6;
    for (const a of [0, 2.1, 4.2]) b.add(new THREE.CylinderGeometry(0.03, 0.03, 1.5).translate(0, 0.72, 0), flat("#3a3d47"), new THREE.Matrix4().makeRotationY(a).multiply(new THREE.Matrix4().makeRotationZ(0.22)).setPosition(cx + 0.18 * Math.cos(a), 0, cz + 0.18 * Math.sin(a)));
    b.add(boxGeo(V(cx - 0.3, 1.45, cz - 0.22), V(cx + 0.3, 1.85, cz + 0.22)), flat("#2b2f3a"));
    for (const s of [-1, 1]) b.add(new THREE.CylinderGeometry(0.22, 0.22, 0.12, 16).rotateX(Math.PI / 2), flat("#3a3d47"), M4(cx + s * 0.15, 2.05, cz));
    b.add(new THREE.CylinderGeometry(0.1, 0.12, 0.4, 12).rotateX(Math.PI / 2), flat("#1d1b22"), M4(cx, 1.65, cz - 0.4));
    const chx = ox - 1.1, chz = oz + 2.2;
    b.add(boxGeo(V(chx - 0.3, 0.55, chz - 0.25), V(chx + 0.3, 0.6, chz + 0.25)), flat("#2b2f3a"));
    b.add(boxGeo(V(chx - 0.3, 0.75, chz + 0.22), V(chx + 0.3, 1.1, chz + 0.26)), flat("#2b2f3a"));
    for (const s of [-1, 1]) b.add(boxGeo(V(chx + s * 0.3 - 0.03, 0, chz - 0.25), V(chx + s * 0.3 + 0.03, 1.1, chz + 0.25)), flat("#8a5a34"));
    for (const [x, z] of [[-4.5, -2], [4.5, -1.5]]) {
      b.add(boxGeo(V(ox + x - 0.04, 0, oz + z - 0.04), V(ox + x + 0.04, 2.8, oz + z + 0.04)), flat("#3a3d47"));
      b.add(new THREE.CylinderGeometry(0.35, 0.28, 0.6, 14).rotateX(Math.PI / 2 - 0.3), flat("#3a3d47"), M4(ox + x, 3.0, oz + z));
    }
    for (const [x, z] of [[-30, 20], [30, 24], [-12, 40], [14, 44]]) prop(b, kit, "tree-high-round", ox + x, 0, oz + z, 9);
    b.build(G);
    // film-can stacks (instanced; counts set per frame), flags on top
    const canG = new THREE.CylinderGeometry(0.56, 0.56, CAN_H - 0.025, 28);
    const canM = [lam("canSide", () => ({ map: canSide() })), lam("canTop", () => ({ map: canTop() })), lam("canTop", () => ({ map: canTop() }))];
    d.cansPH = new THREE.InstancedMesh(canG, canM, 40); d.cansJP = new THREE.InstancedMesh(canG, canM, 60);
    for (const im of [d.cansPH, d.cansJP]) { im.castShadow = true; im.receiveShadow = true; im.frustumCulled = false; G.add(im); }
    const jp = new THREE.Group();
    jp.add(plane(1.2, 0.8, glow(flagJP(), 1.0, { side: THREE.DoubleSide }), 0.6, 0, 0));
    jp.add(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.4), flat("#2b2f3a")).translateY(-0.3));
    G.add(jp); d.jpGroup = jp;
    const ph = new THREE.Group(); ph.name = "phFlag";
    ph.add(plane(1.2, 0.6, glow(flagPH(), 1.0, { side: THREE.DoubleSide }), 0.6, 0.1, 0));
    ph.add(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.4), flat("#2b2f3a")).translateY(-0.3));
    G.add(ph);
  }

  // ======================= HOME =======================
  private home(G: THREE.Group, kit: Kit, d: Partial<Dyn>) {
    const b = new Batch(), [ox, , oz] = HOME;
    ground(b, ox - 150, ox + 150, oz - 150, oz + 150, tex("grassHome", () => grassHD()), 6, -0.02);
    ground(b, ox - 7, ox + 7, oz - 6, oz + 4, tex("yardTile", () => stoneHD("yardTile", ["#d8cfc0", "#cfc5b4", "#e0d8ca", "#c9bfae"], "#a89f90")), 1.2);
    b.add(quad(V(ox - 6, 0, oz - 6), V(ox + 6, 0, oz - 6), V(ox + 6, 8, oz - 6), V(ox - 6, 8, oz - 6)), lam("homeFront", () => ({ map: homeFront() })));
    b.add(boxGeo(V(ox - 6, 0, oz - 16), V(ox + 6, 8, oz - 6.02)), flat("#8fc3b7"));
    b.add(boxGeo(V(ox - 6.6, 8, oz - 16.4), V(ox + 6.6, 8.35, oz - 5.4)), flat("#c9775a"));
    // fence + gate posts, neighbours, trees
    for (const s of [-1, 1]) b.add(boxGeo(V(ox + s * 7 - 0.1, 0, oz - 6), V(ox + s * 7 + 0.1, 1.5, oz + 4)), flat("#e9e2d2"));
    house(b, ox - 16, oz - 8, 0, 8, 8, 7, 1); house(b, ox + 16, oz - 8, 0, 8, 8, 8.4, 4);
    for (const [x, z] of [[-9, -2], [9.5, 1], [-10, 8]]) prop(b, kit, "tree_fat", ox + x, 0, oz + z, 6);
    prop(b, kit, "tree-high-round", ox + 12, 0, oz + 10, 9);
    b.build(G);
    // the long table (handaan + noche buena share it), chairs
    const tb = new Batch();
    tb.add(boxGeo(V(ox - 2.6, 0.72, oz - 0.55), V(ox + 2.6, 0.78, oz + 0.55)), flat("#fbf8ef"));
    tb.add(boxGeo(V(ox - 2.62, 0.5, oz - 0.57), V(ox + 2.62, 0.74, oz + 0.57)), flat("#f3ede0"));
    for (const [x, z] of [[-2.4, -0.4], [2.4, -0.4], [-2.4, 0.4], [2.4, 0.4]]) tb.add(boxGeo(V(ox + x - 0.05, 0, oz + z - 0.05), V(ox + x + 0.05, 0.5, oz + z + 0.05)), flat("#7a4b2a"));
    tb.build(G);
    // handaan dressing: lechon, plates, bunting (banderitas) overhead, TV at the +x end
    const han = new THREE.Group();
    han.add(plane(1.6, 0.8, glow(lechonTex(), 1.0, { alphaTest: 0.5 }), ox, 1.05, oz, 0, true));
    for (const [x, k] of [[-1.7, 3], [-1.0, 2], [1.0, 3], [1.7, 2]] as const) han.add(plane(0.6, 0.38, glow(foodTex(k), 1.0, { alphaTest: 0.5 }), ox + x, 0.9, oz + 0.05, 0, true));
    const bunt = new THREE.InstancedMesh(tri(V(-0.15, 0, 0), V(0.15, 0, 0), V(0, -0.36, 0)), lam("pennant3", () => ({ side: THREE.DoubleSide })), 120);
    const bc = ["#e2453c", "#f2c33c", "#3f8fd8", "#57b35a", "#f08ac0", "#fbf8ef"].map((c) => new THREE.Color(c));
    let n = 0;
    for (const zz of [-2.5, 0, 2.5]) for (let i = 0; i < 40; i++) { const u = i / 39; bunt.setMatrixAt(n, new THREE.Matrix4().makeRotationY(Math.PI / 2 * 0).setPosition(ox - 6.6 + 13.2 * u, 3.8 - 0.7 * Math.sin(Math.PI * u), oz + zz)); bunt.setColorAt(n, bc[n % 6]); n++; }
    han.add(bunt);
    const tvb = new Batch();
    const tvm = M4(ox + 3.6, 0, oz + 1.6, -2.3);
    tvb.add(boxGeo(V(-0.4, 0, -0.3), V(0.4, 0.85, 0.3)), flat("#7a4b2a"), tvm);
    tvb.add(boxGeo(V(-0.45, 0.85, -0.25), V(0.45, 1.5, 0.25)), flat("#3a3346"), tvm);
    tvb.build(han);
    d.tv = plane(0.78, 0.56, glow(tvVillain(), 1.25), 0, 0, 0, 0, true);
    d.tv.applyMatrix4(new THREE.Matrix4().makeTranslation(0, 1.18, 0.26).premultiply(tvm));
    han.add(d.tv);
    G.add(han); d.handaan = han;
    // noche buena dressing: ham, queso de bola, spaghetti, rice; parol in the window, string lights on the eaves
    const noche = new THREE.Group();
    for (const [x, k] of [[-1.5, 0], [-0.5, 1], [0.5, 2], [1.5, 3]] as const) noche.add(plane(0.7, 0.44, glow(foodTex(k), 0.9, { alphaTest: 0.5 }), ox + x, 0.93, oz + 0.05, 0, true));
    G.add(noche); d.noche = noche;
    const hx = new THREE.Group();
    for (const x of [-3.7, 3.7]) hx.add(plane(1.1, 1.65, glow(parolTex(x < 0 ? "#e2453c" : "#f2c33c"), 1.8, { alphaTest: 0.5, side: THREE.DoubleSide }), ox + x, 3.3, oz - 5.9, 0, true));
    const sl = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.14, 0.14), new THREE.MeshBasicMaterial({ map: bulbTex(), color: new THREE.Color(2.4, 2.0, 1.4), transparent: true, depthWrite: false }), 80);
    for (let i = 0; i < 80; i++) { const u = i / 79; sl.setMatrixAt(i, M4(ox - 6 + 12 * u, 7.6 - 0.25 * Math.abs(Math.sin(u * Math.PI * 6)), oz - 5.85)); }
    sl.layers.set(NOINK); hx.add(sl);
    G.add(hx); d.homeXmas = hx;
    // the bench against the house front (phone scene)
    const bench = new THREE.Group(), bb = new Batch();
    bb.add(boxGeo(V(ox - 1.8, 0.42, oz - 3.6), V(ox + 1.8, 0.5, oz - 3.1)), flat("#8a5a34"));
    bb.add(boxGeo(V(ox - 1.8, 0.5, oz - 3.65), V(ox + 1.8, 1.05, oz - 3.58)), flat("#7a4b2a"));
    for (const x of [-1.7, 1.7]) bb.add(boxGeo(V(ox + x - 0.05, 0, oz - 3.6), V(ox + x + 0.05, 0.42, oz - 3.1)), flat("#5a3b2a"));
    bb.build(bench); G.add(bench); d.bench = bench;
    d.phoneGlow = plane(1.0, 1.0, new THREE.MeshBasicMaterial({ map: bulbTex(), color: new THREE.Color(0.14, 0.24, 0.38), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }), ox, 1.2, oz - 3.0, 0, true);
    G.add(d.phoneGlow);
  }

  // ======================= PALACE =======================
  private palace(G: THREE.Group, kit: Kit) {
    const b = new Batch(), [ox, , oz] = PAL;
    ground(b, ox - 150, ox + 150, oz - 150, oz + 150, tex("grassPal", () => grassHD()), 6, -0.02);
    ground(b, ox - 12, ox + 12, oz - 6, oz + 20, tex("palDrive", () => stoneHD("palDrive", ["#e9e0cc", "#ded4bf", "#f0e8d6", "#d6cbb5"], "#b8ad98")), 1.5);
    b.add(quad(V(ox - 10, 0, oz - 6), V(ox + 10, 0, oz - 6), V(ox + 10, 10, oz - 6), V(ox - 10, 10, oz - 6)), lam("palaceFront", () => ({ map: palaceFront() })));
    b.add(boxGeo(V(ox - 10, 0, oz - 22), V(ox + 10, 10, oz - 6.02)), flat("#f1ebdd"));
    const rm = lam("palRoof", () => ({ map: roofHD("#8a6f5a"), side: THREE.DoubleSide }));
    b.add(quad(V(ox - 10.6, 10, oz - 5.4), V(ox + 10.6, 10, oz - 5.4), V(ox + 8, 13, oz - 14), V(ox - 8, 13, oz - 14), 6, 2), rm);
    // balcony: slab + balustrade
    b.add(boxGeo(V(ox - 2.4, 4.45, oz - 6), V(ox + 2.4, 4.7, oz - 4.4), 0, true), flat("#efe6d2"));
    for (let x = -2.3; x <= 2.31; x += 0.32) b.add(new THREE.CylinderGeometry(0.06, 0.08, 0.75, 8).translate(0, 0.375, 0), flat("#f6f1e6"), M4(ox + x, 4.7, oz - 4.48));
    b.add(boxGeo(V(ox - 2.45, 5.45, oz - 4.6), V(ox + 2.45, 5.55, oz - 4.35)), flat("#efe6d2"));
    for (const s of [-1, 1]) for (const k of [0, 1]) b.add(boxGeo(V(ox + s * (3.2 + k * 3.3) - 0.28, 0, oz - 6.1), V(ox + s * (3.2 + k * 3.3) + 0.28, 10, oz - 5.7)), flat("#f9f5ec")); // pilasters
    for (const [x, z] of [[-14, -2], [14, -2], [-14, 10], [14, 10], [-8, 22], [8, 22]]) prop(b, kit, "tree-high-round", ox + x, 0, oz + z, 9);
    b.build(G);
    for (const s of [-1, 1]) G.add(plane(1.6, 0.8, glow(flagPH(), 1.0, { side: THREE.DoubleSide }), ox + s * 1.5, 7.1, oz - 5.6));
  }

  // ======================= OFFICE =======================
  private office(G: THREE.Group) {
    const b = new Batch(), [ox, , oz] = OFF;
    ground(b, ox - 5, ox + 5, oz - 3.2, oz + 6, tex("offFloor", () => stoneHD("offFloor", ["#9a6a40", "#8a5a34", "#a8744a", "#7a4b2a"], "#5a3b2a")), 1.2);
    b.add(quad(V(ox - 5, 0, oz - 3), V(ox + 5, 0, oz - 3), V(ox + 5, 5, oz - 3), V(ox - 5, 5, oz - 3)), lam("officeWall", () => ({ map: officeWall() })));
    b.add(quad(V(ox - 5, 0, oz + 6), V(ox - 5, 0, oz - 3), V(ox - 5, 5, oz - 3), V(ox - 5, 5, oz + 6)), flat("#e9dcc0"));
    b.add(quad(V(ox + 5, 0, oz - 3), V(ox + 5, 0, oz + 6), V(ox + 5, 5, oz + 6), V(ox + 5, 5, oz - 3)), flat("#e9dcc0"));
    b.add(quad(V(ox - 5, 5, oz + 6), V(ox + 5, 5, oz + 6), V(ox + 5, 5, oz - 3), V(ox - 5, 5, oz - 3)), flat("#f3ead6"));
    b.build(G, false);
    const fb = new Batch();
    // desk
    fb.add(boxGeo(V(ox - 1.3, 0.76, oz - 0.95), V(ox + 1.3, 0.84, oz - 0.05)), flat("#6a4028"));
    fb.add(boxGeo(V(ox - 1.25, 0, oz - 0.15), V(ox + 1.25, 0.76, oz - 0.08)), flat("#7a4b2a"));
    for (const s of [-1, 1]) fb.add(boxGeo(V(ox + s * 1.25 - 0.06, 0, oz - 0.9), V(ox + s * 1.25 + 0.06, 0.76, oz - 0.1)), flat("#5a3b2a"));
    // towering paper stacks on the desk and the floor
    const pm = lam("paperSide", () => ({ map: paperSide() }));
    for (const [x, z, h, w] of [[-0.95, -0.6, 1.4, 0.42], [-0.5, -0.45, 0.9, 0.4], [0.55, -0.55, 1.8, 0.44], [1.0, -0.4, 1.1, 0.4], [-1.9, -0.3, 2.1, 0.5], [1.95, -1.4, 2.6, 0.5], [-2.4, -1.6, 1.6, 0.46], [2.5, -0.2, 1.3, 0.44]]) {
      const y0 = Math.abs(x) < 1.3 && z > -0.95 ? 0.84 : 0;
      fb.add(boxGeo(V(ox + x - w / 2, y0, oz + z - w * 0.36), V(ox + x + w / 2, y0 + h, oz + z + w * 0.36), 0), pm);
      fb.add(boxGeo(V(ox + x - w / 2, y0 + h, oz + z - w * 0.36), V(ox + x + w / 2, y0 + h + 0.01, oz + z + w * 0.36)), flat("#fbf8ef"));
    }
    // the empty folding chair for the stunt double
    const cx = ox + 1.75, cz = oz + 0.9;
    fb.add(boxGeo(V(cx - 0.28, 0.5, cz - 0.24), V(cx + 0.28, 0.55, cz + 0.24)), flat("#2b2f3a"));
    fb.add(boxGeo(V(cx - 0.28, 0.72, cz - 0.27), V(cx + 0.28, 1.05, cz - 0.23)), flat("#2b2f3a"));
    for (const s of [-1, 1]) fb.add(boxGeo(V(cx + s * 0.28 - 0.03, 0, cz - 0.25), V(cx + s * 0.28 + 0.03, 1.05, cz + 0.25)), flat("#a8744a"));
    // flag on a pole in the corner
    fb.add(new THREE.CylinderGeometry(0.03, 0.03, 2.6).translate(0, 1.3, 0), flat("#c9a24a"), M4(ox - 3.6, 0, oz - 2.4));
    fb.build(G);
    G.add(plane(1.1, 0.55, glow(flagPH(), 1.0, { side: THREE.DoubleSide }), ox - 3.05, 2.25, oz - 2.4));
  }

  // ---------------- per frame ----------------
  private shotSun(id: number, s: ShotDef, L: LightPreset) {
    let v = this.sunCache.get(id);
    if (v) return v;
    let fx = 0, fz = 0;
    for (let f = s.a; f < s.b; f += 3) {
      const c = camAt(id, f), x = c.look[0] - c.pos[0], z = c.look[2] - c.pos[2], n = Math.hypot(x, z) || 1;
      fx += x / n; fz += z / n;
    }
    const n = Math.hypot(fx, fz) || 1; fx /= n; fz /= n;
    const az = THREE.MathUtils.degToRad(s.sunAz ?? L.az), el = THREE.MathUtils.degToRad(s.sunEl ?? L.el);
    const hx = fx * Math.cos(az) - fz * Math.sin(az), hz = fz * Math.cos(az) + fx * Math.sin(az);
    v = new THREE.Vector3(hx * Math.cos(el), Math.sin(el), hz * Math.cos(el)).normalize();
    this.sunCache.set(id, v);
    return v;
  }
  private actor(i: number) { while (this.actors.length <= i) this.actors.push(new Actor(this.root)); return this.actors[i]; }
  private fx(i: number) { while (this.fxs.length <= i) this.fxs.push(new Fx(this.root)); return this.fxs[i]; }

  update(id: number, f: number, cam: THREE.PerspectiveCamera, scene: THREE.Scene) {
    const t = f / FPS, s = SHOTS[id - 1], L = LIGHTS[s.light], K = LOOK[s.light], d = this.d;
    const c = camAt(id, f);
    cam.position.set(...c.pos); cam.up.set(0, 1, 0); cam.lookAt(...c.look); cam.rotateZ(c.roll);
    cam.fov = c.fov; cam.near = 0.1; cam.far = 1500; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    cam.layers.enable(NOINK);
    const focus = V(...c.look), dist = cam.position.distanceTo(focus);
    for (const [n, g] of Object.entries(this.sets)) g.visible = n === s.set;
    // ---- light rig ----
    const sunDir = this.shotSun(id, s, L);
    this.hemi.color.set(L.sky); this.hemi.groundColor.set(L.ground); this.hemi.intensity = L.hemiI;
    this.sun.color.set(L.sunCol); this.sun.intensity = L.sunI;
    const Rr = THREE.MathUtils.clamp(dist * 1.15 + 8, 12, 70);
    this.sun.position.copy(focus).addScaledVector(sunDir, 200); this.sun.target.position.copy(focus);
    const sc = this.sun.shadow.camera;
    sc.left = -Rr; sc.right = Rr; sc.top = Rr; sc.bottom = -Rr; sc.near = 20; sc.far = 420; sc.updateProjectionMatrix();
    this.sun.shadow.bias = L.bias; this.sun.shadow.normalBias = L.normalBias * (Rr / 12);
    TONE.uLitCol.value.set(...L.lit); TONE.uShadeCol.value.set(...L.shade); TONE.uShadeLift.value.set(...L.lift);
    TONE.uLambert.value = L.lambert; TONE.uSideK.value = L.sideK; TONE.uTerm.value = L.term; TONE.uBounce.value.set(...K.bounce); TONE.uSat.value = K.sat;
    CHAR.uCharTint.value.set(...L.charTint); CHAR.uCharShade.value = L.charShade; CHAR.uGrad.value = L.charGrad;
    CHAR.uBodyGrad.value = L.bodyGrad; CHAR.uSideTint.value.set(...L.sideTint);
    // ---- sky + fog ----
    const su = this.skyMat.uniforms;
    K.sky.c.forEach((h, i) => untone(h, su["c" + i].value));
    const e = K.sky.e.map((deg) => THREE.MathUtils.degToRad(deg));
    su.e.value.set(e[1], e[2], e[3], e[4]);
    this.sky.position.copy(cam.position);
    untone(L.fog, this.fog.color); this.fog.near = L.fogNear; this.fog.far = L.fogFar;
    scene.fog = this.fog; scene.background = null;
    const showSun = s.light === "golden" && s.set !== "home";
    this.sunDisc.visible = showSun;
    if (showSun) { this.sunDisc.position.copy(cam.position).addScaledVector(sunDir, 900); this.sunDisc.scale.setScalar(2 * 900 * Math.tan(THREE.MathUtils.degToRad(s.beat === "hot" ? 3.2 : 1.8))); }
    const cm = s.light === "dark" ? null : this.cloudMaps[s.light === "night" ? "night" : s.light === "golden" ? "golden" : "day"];
    for (let i = 0; i < this.clouds.length; i++) {
      const m = this.clouds[i]; m.visible = !!cm;
      if (cm) { m.lookAt(cam.position.x, m.position.y, cam.position.z); (m.material as THREE.MeshBasicMaterial).map = cm[i % 4]; }
    }
    // ---- per-beat dressing ----
    const night = s.light === "night";
    d.xmas.visible = night; d.homeXmas.visible = night;
    d.ballot.visible = s.beat === "vote"; d.rally.visible = s.beat === "election";
    d.handaan.visible = s.beat === "handaan" || s.beat === "why"; d.noche.visible = s.beat === "noche";
    d.bench.visible = s.beat === "phone"; d.phoneGlow.visible = s.beat === "phone";
    const stepped = s.beat === "hero" && f >= 128;
    d.poster.map = heroPoster(stepped || ["vote", "election"].includes(s.beat));
    if (s.beat === "phone") { d.phoneGlow.position.set(HOME[0], 0.98, HOME[2] - 3.15); d.phoneGlow.scale.setScalar(0.55 + 0.03 * Math.sin(t * 9)); }
    // theater: era seats + screen image + beam + flicker
    if (s.set === "theater") {
      const old = s.era === "old";
      d.benches1897.visible = old; d.seatsNew.visible = !old;
      const k = Math.floor(t * (old ? 12 : 4)) % 4;
      d.screenMat.map = screenFrame(old ? "old" : "new", k);
      const flick = old ? 1.15 + 0.12 * Math.sin(t * 47) * Math.sin(t * 13) : 1.2;
      d.screenMat.color.setScalar(flick);
      TONE.uLitCol.value.multiplyScalar(old ? flick / 1.2 : 1);
      // beam from the booth window (back wall) to the screen centre, billboarded around its axis
      const A = V(THE[0], 5.4, THE[2] + 9.9), B = V(THE[0], 3.6, THE[2] - 9.8), mid = A.clone().add(B).multiplyScalar(0.5), ax = B.clone().sub(A);
      d.beam.position.copy(mid);
      const len = ax.length(); ax.normalize();
      const toCam = cam.position.clone().sub(mid), side = ax.clone().cross(toCam).normalize(), nrm = side.clone().cross(ax).normalize();
      d.beam.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(side, ax.clone().negate(), nrm));
      d.beam.scale.set(5.5, len, 1);
    }
    // studio: the can stacks (PH grows during shot 6; full in 7), JP stack only in shot 7
    if (s.set === "studio") {
      const nPH = s.beat === "japan" ? 34 : cansAt(t), nJP = 52;
      const q = new THREE.Quaternion(), one = V(1, 1, 1);
      for (let i = 0; i < nPH; i++) {
        const fallT = s.beat === "japan" ? 1 : smooth(((t - W.tatlong + 0.2) - ((i + 1) / 4.2) ** (1 / 1.6)) / 0.12 + 1); // newest can drops in
        const drop = (1 - fallT) * 1.2, wob = ((i * 37) % 7) * 0.012;
        d.cansPH.setMatrixAt(i, this.m4.compose(V(STACK_PH[0] + wob, CAN_H * (i + 0.5) + drop, STACK_PH[2] - wob), q.setFromAxisAngle(V(0, 1, 0), i * 0.7), one));
      }
      d.cansPH.count = nPH; d.cansPH.instanceMatrix.needsUpdate = true;
      const showJP = s.beat === "japan";
      for (let i = 0; i < nJP; i++) d.cansJP.setMatrixAt(i, this.m4.compose(V(STACK_JP[0] + ((i * 53) % 7) * 0.012, CAN_H * (i + 0.5), STACK_JP[2]), q.setFromAxisAngle(V(0, 1, 0), i * 1.3), one));
      d.cansJP.count = showJP ? nJP : 0; d.cansJP.instanceMatrix.needsUpdate = true;
      d.jpGroup.visible = showJP; d.jpGroup.position.set(STACK_JP[0], CAN_H * nJP + 0.7, STACK_JP[2]);
      d.jpGroup.rotation.y = 0.15 * Math.sin(t * 2);
      const ph = this.sets.studio.getObjectByName("phFlag")!;
      ph.visible = nPH > 0; ph.position.set(STACK_PH[0], CAN_H * nPH + 0.7, STACK_PH[2]); ph.rotation.y = 0.15 * Math.sin(t * 2.3 + 1);
    }
    // ---- cast + effects ----
    const right = V(0, 0, 0).setFromMatrixColumn(cam.matrixWorld, 0);
    const st = stage(id, t, { pos: cam.position, right, sun: sunDir });
    this.frustum.setFromProjectionMatrix(this.m4.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
    let ai = 0;
    const used: Actor[] = [];
    for (const p of st.places) {
      const sc2 = p.scale ?? 1;
      if (!this.frustum.intersectsSphere(this.sph.set(this.v.set(p.x, p.y + 1.1 * sc2, p.z), 3.0 * sc2))) continue;
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
      const e = this.fx(fi++);
      e.r = this.pool.req(p.key, p.cw, p.ch, 1, p.draw);
      e.use(!!p.soft);
      e.mesh.visible = true;
      e.mesh.position.set(p.x, p.y, p.z);
      if (p.flat) e.mesh.rotation.set(-Math.PI / 2, 0, p.rot ?? 0);
      else { e.mesh.quaternion.copy(cam.quaternion); e.mesh.rotateZ(p.rot ?? 0); }
      e.mesh.scale.set(p.w, p.h, 1);
      fused.push(e);
    }
    for (let i = fi; i < this.fxs.length; i++) this.fxs[i].mesh.visible = false;
    this.pool.flush();
    for (const a of used) a.bind();
    for (const e of fused) e.bind();
    return focus;
  }
}
export { brick, rep };
