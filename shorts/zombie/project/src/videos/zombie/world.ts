// The zombie short's places as one three.js scene, far apart on the x axis: the street with your house, the base
// exterior, the office and the war room, the field line-up, the CDC office and the campsite. update(id, f, camera)
// poses everything for shot `id` at frame f (pure function of id + f). Sky, sun, fog, clouds and the card pipeline
// come from the bridge short unchanged.
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { staticFile } from "remotion";
import { Batch, boxGeo, V, lam, Kit, Ray, kitClone, house, prop, setSight, quad, tri } from "./build";
import { ctex, rep, stoneHD, cobbleHD, grassHD, planksHD, beamHD, cloudHD, roofHD } from "./paint";
import { Pen } from "./toon";
import { screen, typesBoard, mapTex, usFlag, binderPages } from "./zdraw";
import { LIGHTS, LOOK, LightPreset } from "./lights";
import { TONE, CHAR, twoTone, untone } from "./shade";
import { NOINK } from "./ink";
import { Pool, Actor, Fx, stage } from "./cast";
import { FPS, SHOTS, camAt, V3, smooth, clamp01, FOREGROUND, ShotDef, OFFICE, WAR, BASE, BASE_Z, FIELD, CDC, CAMP, CRASH_T } from "./story";

// ---------------- assets ----------------
const KENNEY = ["cart", "lantern"];
let kitP: Promise<Kit> | null = null;
export const loadKit = () => {
  if (!kitP) {
    const loader = new GLTFLoader();
    kitP = Promise.all(KENNEY.map((n) => loader.loadAsync(staticFile(`bridge/kenney/${n}.glb`)).then((g) => [n, g.scene] as const).catch(() => [n, null] as const)))
      .then((list) => Object.fromEntries(list.filter((e) => e[1]).map(([n, s]) => [n, s!])) as Kit);
  }
  return kitP;
};

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
const penTex = (key: string, w: number, h: number, draw: (p: Pen) => void) => ctex(key, w, h, (g) => draw(new Pen(g)));

// painted surfaces of our own (seams painted in as dark tints, like paint.ts)
const asphalt = () => ctex("asphalt", 1024, 1024, (g, r) => {
  g.fillStyle = "#6f7380"; g.fillRect(0, 0, 1024, 1024);
  for (let i = 0; i < 2600; i++) { g.fillStyle = r() < 0.5 ? "rgba(40,40,55,0.18)" : "rgba(200,200,215,0.12)"; g.fillRect(r() * 1024, r() * 1024, 3 + r() * 5, 3 + r() * 5); }
});
const roadLine = () => ctex("roadLine", 256, 64, (g) => { g.fillStyle = "#f2d14a"; g.fillRect(0, 0, 150, 64); });
const plain = (key: string, base: string, dots: string, n = 900) => ctex(key, 512, 512, (g, r) => {
  g.fillStyle = base; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < n; i++) { g.fillStyle = dots; g.globalAlpha = 0.25 + 0.35 * r(); g.fillRect(r() * 512, r() * 512, 2 + r() * 4, 2 + r() * 4); }
  g.globalAlpha = 1;
});
const carpet = (key: string, base: string) => ctex(key, 512, 512, (g, r) => {
  g.fillStyle = base; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 4000; i++) { g.fillStyle = r() < 0.5 ? "rgba(0,0,0,0.07)" : "rgba(255,255,255,0.06)"; g.fillRect(r() * 512, r() * 512, 2, 2); }
  g.strokeStyle = "rgba(40,30,40,0.25)"; g.lineWidth = 3; for (let k = 0; k < 4; k++) { g.beginPath(); g.moveTo(k * 128, 0); g.lineTo(k * 128, 512); g.moveTo(0, k * 128); g.lineTo(512, k * 128); g.stroke(); }
});

/** horizontal quad facing up at y covering x0..x1, z0..z1; uv tiles every `tile` metres */
function quadUp(x0: number, x1: number, z0: number, z1: number, tile: number, y = 0) {
  const g = new THREE.BufferGeometry(), u = (x1 - x0) / tile, v = (z1 - z0) / tile;
  g.setAttribute("position", new THREE.Float32BufferAttribute([x0, y, z1, x1, y, z1, x1, y, z0, x0, y, z1, x1, y, z0, x0, y, z0], 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, u, 0, u, v, 0, 0, u, v, 0, v], 2));
  return g;
}
/** a picture / screen quad facing +z centred at (x, y, z) */
const facing = (w: number, h: number) => new THREE.PlaneGeometry(w, h);

/** every lens position of the film looking at its subject (houses in the way are left out) */
const sightLines = (): Ray[] => {
  const out: Ray[] = [];
  for (const s of SHOTS) if (s.set === "street") for (let f = s.a - 8; f < s.b + 8; f += 2) {
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

type Room = { cx: number; w: number; d: number; h: number; wall: THREE.Material; floor: THREE.Material; win?: [number, number] };
/** three-sided room open toward +z (the lens side): floor, back wall with a window hole, two side walls, a skirting */
const room = (b: Batch, r: Room) => {
  const { cx, w, d, h, wall, floor } = r, x0 = cx - w / 2, x1 = cx + w / 2, zb = -d / 2, t = 0.18;
  b.add(quadUp(x0, x1, zb, d / 2, 2, 0.01), floor);
  const wx0 = r.win ? cx + r.win[0] : 0, wx1 = r.win ? cx + r.win[1] : 0, wy0 = 1.0, wy1 = 2.3;
  if (r.win) {
    b.add(boxGeo(V(x0, 0, zb - t), V(wx0, h, zb), 1), wall);
    b.add(boxGeo(V(wx1, 0, zb - t), V(x1, h, zb), 1), wall);
    b.add(boxGeo(V(wx0, 0, zb - t), V(wx1, wy0, zb), 1), wall);
    b.add(boxGeo(V(wx0, wy1, zb - t), V(wx1, h, zb), 1), wall);
    const fr = lam("winFrame", () => ({ color: "#f4efe4" }));
    b.add(boxGeo(V(wx0 - 0.06, wy0 - 0.08, zb - 0.02), V(wx1 + 0.06, wy0, zb + 0.12)), fr);
    b.add(boxGeo(V((wx0 + wx1) / 2 - 0.03, wy0, zb - 0.1), V((wx0 + wx1) / 2 + 0.03, wy1, zb - 0.04)), fr);
  } else b.add(boxGeo(V(x0, 0, zb - t), V(x1, h, zb), 1), wall);
  b.add(boxGeo(V(x0 - t, 0, zb - t), V(x0, h, d / 2), 1), wall);
  b.add(boxGeo(V(x1, 0, zb - t), V(x1 + t, h, d / 2), 1), wall);
  const sk = lam("skirting", () => ({ color: "#5a4a40" }));
  b.add(boxGeo(V(x0, 0, zb), V(x1, 0.1, zb + 0.03)), sk);
  b.add(boxGeo(V(x0, 0, zb), V(x0 + 0.03, 0.1, d / 2)), sk);
  b.add(boxGeo(V(x1 - 0.03, 0, zb), V(x1, 0.1, d / 2)), sk);
};
/** desk: top + four legs + a modesty panel at the back */
const desk = (b: Batch, x: number, z: number, w: number, dd: number, top: THREE.Material, leg: THREE.Material, h = 0.76) => {
  b.add(boxGeo(V(x - w / 2, h - 0.05, z - dd / 2), V(x + w / 2, h, z + dd / 2), 1), top);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.add(boxGeo(V(x + sx * (w / 2 - 0.08) - 0.03, 0, z + sz * (dd / 2 - 0.08) - 0.03), V(x + sx * (w / 2 - 0.08) + 0.03, h - 0.05, z + sz * (dd / 2 - 0.08) + 0.03)), leg);
  b.add(boxGeo(V(x - w / 2 + 0.05, 0.25, z + dd / 2 - 0.06), V(x + w / 2 - 0.05, h - 0.05, z + dd / 2 - 0.03)), top);
};

export class World {
  root = new THREE.Group();
  private pool = new Pool();
  private actors: Actor[] = [];
  private fxs: Fx[] = [];
  private hemi: THREE.HemisphereLight; private sun: THREE.DirectionalLight;
  private sky: THREE.Mesh; private skyMat: THREE.ShaderMaterial;
  private fog = new THREE.Fog("#bccbec", 25, 420);
  private sunDisc: THREE.Sprite; private sunHalo: THREE.Sprite;
  private sunCache = new Map<number, THREE.Vector3>();
  private cloudMaps: Record<"day" | "golden", THREE.Texture[]>;
  private clouds: THREE.Mesh[] = [];
  private fgs: { o: THREE.Object3D; a: number; b: number }[] = [];
  private screens: { mat: THREE.MeshBasicMaterial; big: boolean }[] = [];
  private scr: Record<"blog" | "crash" | "off", THREE.Texture>;
  private page = new THREE.Group();
  private pins: { m: THREE.Object3D; k: number }[] = [];
  private flood: THREE.Mesh;
  private frustum = new THREE.Frustum();
  private m4 = new THREE.Matrix4(); private v = new THREE.Vector3(); private sph = new THREE.Sphere();

  constructor(kit: Kit) {
    const R = this.root;
    // ---- sky + light (bridge short) ----
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
    this.sun.shadow.mapSize.set(4096, 4096);
    R.add(this.hemi, this.sun, this.sun.target);
    this.cloudMaps = { day: [0, 1, 2, 3].map((k) => cloudHD(k, LOOK.day.cloud)), golden: [0, 1, 2, 3].map((k) => cloudHD(k, LOOK.golden.cloud)) };
    for (let i = 0; i < 9; i++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: this.cloudMaps.day[i % 4], color: new THREE.Color(1.1, 1.1, 1.1), transparent: true, depthWrite: false, fog: false }));
      m.layers.set(NOINK); this.clouds.push(m); R.add(m);
    }

    setSight(sightLines());
    const b = new Batch();
    const grass = lam("grassHD", () => ({ map: grassHD() }));
    const cobble = lam("cobbleHD", () => ({ map: cobbleHD() }));
    const pave = lam("pave", () => ({ map: stoneHD("paveHD", ["#d9d2c4", "#cfc8ba", "#e0d9cc", "#c9c1b2"], "#a49c8e") }));
    const road = lam("asphalt", () => ({ map: asphalt() }));
    const wood = lam("planksHD", () => ({ map: planksHD() }));
    const beamM = lam("beamHD", () => ({ map: beamHD() }));
    const metal = twoTone(new THREE.MeshPhongMaterial({ color: "#4a4f5c", specular: "#8a8a8a", shininess: 50 }), 0.15);
    const white = lam("whitePaint", () => ({ color: "#f1ece2" }));
    const dark = lam("darkPlastic", () => ({ color: "#2b2f3a" }));
    const scrMat = (tex: THREE.Texture, big: boolean) => {
      const m = new THREE.MeshBasicMaterial({ map: tex, toneMapped: true, color: new THREE.Color(0.92, 0.92, 0.92) });
      this.screens.push({ mat: m, big });
      return m;
    };
    this.scr = { blog: penTex("scrBlog", 640, 400, (p) => screen(p, "blog")), crash: penTex("scrCrash", 640, 400, (p) => screen(p, "crash")), off: penTex("scrOff", 640, 400, (p) => screen(p, "off")) };
    for (const t of Object.values(this.scr)) t.colorSpace = THREE.SRGBColorSpace;

    // ================= STREET (x ~ 0) =================
    b.add(quadUp(-300, 300, -300, -7, 4), grass);
    b.add(quadUp(-300, 300, 7, 300, 4), grass);
    b.add(quadUp(-120, 120, -4, 4, 4, 0.005), road);
    b.add(quadUp(-120, 120, -7, -4, 2, 0.12), pave);
    b.add(quadUp(-120, 120, 4, 7, 2, 0.12), pave);
    const curb = lam("curb", () => ({ color: "#c9c3b8" }));
    b.add(boxGeo(V(-120, 0, -4.12), V(120, 0.12, -4)), curb);
    b.add(boxGeo(V(-120, 0, 4), V(120, 0.12, 4.12)), curb);
    const lineM = lam("roadLine", () => ({ map: rep(roadLine(), 1, 1) }));
    for (let x = -100; x < 100; x += 3) b.add(quadUp(x, x + 1.6, -0.08, 0.08, 1.6, 0.012), lineM);
    // houses north of the road (fronts at z = -7); yours at x = 0
    const N: [number, number, number, number][] = [[-30, 9, 7.6, 3], [-20, 8, 8.4, 1], [-10.5, 8, 7, 4], [0, 8, 7, 0], [10, 8, 8.4, 6], [19.5, 9, 7, 2], [29.5, 8, 9.8, 5], [-40, 8, 8.4, 7], [40, 9, 7, 1]];
    for (const [x, w, h, si] of N) house(b, x, -7.6 - 4, 0, w, 8, h, si, 0.12);
    // your window: plain front panel, dark room, curtains, frame, sill and the wall under the sill (hides your legs)
    const yw = lam("yourWall", () => ({ map: plain("yourWall", "#ecdab2", "#d8c49a") }));
    const zf = -7.58;
    b.add(quad(V(-4, 0.12, zf), V(4, 0.12, zf), V(4, 7, zf), V(-4, 7, zf), 2, 2), yw);
    const roomDark = lam("roomDark", () => ({ color: "#4a3f52" }));
    b.add(quad(V(-0.85, 2.9, zf + 0.01), V(0.85, 2.9, zf + 0.01), V(0.85, 5.3, zf + 0.01), V(-0.85, 5.3, zf + 0.01)), roomDark);
    const cur = lam("curtain", () => ({ color: "#d9572e" }));
    for (const s of [-1, 1]) b.add(boxGeo(V(s * 0.85 - (s > 0 ? 0.28 : 0), 3.65, zf + 0.02), V(s * 0.85 + (s < 0 ? 0.28 : 0), 5.25, zf + 0.08)), cur);
    const frame = lam("winFrameW", () => ({ color: "#f7f2e6" }));
    b.add(boxGeo(V(-1.0, 5.25, zf), V(1.0, 5.42, zf + 0.22)), frame);
    for (const s of [-1, 1]) b.add(boxGeo(V(s * 0.85 - 0.08, 3.62, zf), V(s * 0.85 + 0.08, 5.3, zf + 0.22)), frame);
    b.add(boxGeo(V(-1.05, 3.6, zf), V(1.05, 3.72, zf + 0.38)), frame);
    b.add(boxGeo(V(-0.85, 2.9, zf), V(0.85, 3.6, zf + 0.3)), yw);
    // front door + step, a lower window
    b.add(boxGeo(V(1.6, 0.12, zf), V(2.6, 2.3, zf + 0.06)), lam("doorBlue", () => ({ color: "#3f6fb5" })));
    b.add(boxGeo(V(1.4, 0.12, zf), V(2.8, 0.3, zf + 0.5)), pave);
    b.add(boxGeo(V(-2.6, 1.0, zf), V(-1.0, 2.2, zf + 0.04)), roomDark);
    b.add(boxGeo(V(-2.7, 0.95, zf), V(-0.9, 1.05, zf + 0.2)), frame);
    // street furniture: lamp posts, trees, a parked car, a mailbox, picket fences
    for (const x of [-24, -8, 8, 24]) {
      b.add(boxGeo(V(x - 0.07, 0.12, -4.6), V(x + 0.07, 4.2, -4.46)), metal);
      b.add(boxGeo(V(x - 0.25, 4.2, -4.8), V(x + 0.25, 4.45, -4.3)), metal);
    }
    for (const x of [-15, -4.8, 5.2, 15, 34]) prop(b, kit, "tree_default", x, 0.12, -5.6, 5.2, x);
    for (const x of [-18, -6, 6, 18]) prop(b, kit, "tree_oak", x, 0, 9, 5.5, x);
    for (const x of [-12, 3, 14]) prop(b, kit, "hedge", x, 0, 7.8, 1.2, 0);
    const car = (x: number, z: number, col: string) => {
      const m = lam("car" + col, () => ({ color: col }));
      b.add(boxGeo(V(x - 2.1, 0.35, z - 0.85), V(x + 2.1, 1.05, z + 0.85)), m);
      b.add(boxGeo(V(x - 1.2, 1.05, z - 0.78), V(x + 0.9, 1.6, z + 0.78)), m);
      b.add(boxGeo(V(x - 1.1, 1.1, z - 0.8), V(x + 0.8, 1.52, z + 0.8)), lam("glass", () => ({ color: "#9fc4e6" })));
      for (const sx of [-1.35, 1.35]) for (const sz of [-0.85, 0.85]) { const w = new THREE.CylinderGeometry(0.36, 0.36, 0.22, 16); w.rotateX(Math.PI / 2); b.add(w, dark, new THREE.Matrix4().makeTranslation(x + sx, 0.36, z + sz)); }
    };
    car(-14, -3.0, "#e2453c"); car(11.5, 3.0, "#f0b43c");
    b.add(boxGeo(V(-3.4, 0.12, -6.4), V(-3.3, 1.0, -6.3)), metal);
    b.add(boxGeo(V(-3.6, 1.0, -6.6), V(-3.1, 1.35, -6.1)), lam("mailbox", () => ({ color: "#3f6fb5" })));

    // ================= BASE EXTERIOR (x ~ 2000, z ~ 70) =================
    const B = BASE, BZ = BASE_Z;
    b.add(quadUp(B - 300, B + 300, BZ - 200, BZ + 200, 4, 0), grass);
    b.add(quadUp(B - 40, B + 40, BZ + 1, BZ + 30, 4, 0.01), road);
    const conc = lam("concrete", () => ({ map: stoneHD("concHD", ["#cfc6b4", "#c6bdab", "#d6cdbc", "#bfb6a5"], "#9c9384") }));
    b.add(boxGeo(V(B - 18, 0, BZ - 14), V(B + 18, 9, BZ), 2), conc);
    b.add(boxGeo(V(B - 18.4, 9, BZ - 14.4), V(B + 18.4, 9.6, BZ + 0.4), 2), lam("concCap", () => ({ color: "#b7ad9c" })));
    const winDark = lam("winDark", () => ({ color: "#3e4a66" }));
    for (let i = 0; i < 9; i++) for (const y of [1.6, 5.4]) {
      const x = B - 16 + i * 4;
      if (Math.abs(x - B) < 2 && y < 3) continue;
      b.add(boxGeo(V(x, y, BZ), V(x + 2.2, y + 1.8, BZ + 0.05)), winDark);
      b.add(boxGeo(V(x - 0.1, y - 0.12, BZ), V(x + 2.3, y, BZ + 0.18)), white);
    }
    b.add(boxGeo(V(B - 1.4, 0, BZ), V(B + 1.4, 2.8, BZ + 0.06)), lam("baseDoor", () => ({ color: "#5c6040" })));
    b.add(boxGeo(V(B - 2.2, 2.8, BZ), V(B + 2.2, 3.1, BZ + 1.6)), white);
    // flag pole + flag
    b.add(new THREE.CylinderGeometry(0.08, 0.11, 12, 12), lam("poleW", () => ({ color: "#e8e6e0" })), new THREE.Matrix4().makeTranslation(B + 4.5, 6, BZ + 6));
    const flagM = new THREE.MeshLambertMaterial({ map: penTex("usFlag", 512, 270, usFlag), side: THREE.DoubleSide });
    twoTone(flagM);
    const flagGeo = new THREE.PlaneGeometry(3.2, 1.7, 16, 4);
    const fp = flagGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < fp.count; i++) { const x = fp.getX(i) + 1.6; fp.setZ(i, 0.18 * Math.sin(x * 2.2) * (x / 3.2)); fp.setY(i, fp.getY(i) - 0.12 * x * x / 10); }
    flagGeo.computeVertexNormals();
    b.add(flagGeo, flagM, new THREE.Matrix4().makeRotationY(-0.5).setPosition(B + 4.5 + 1.6 * Math.cos(0.5), 11, BZ + 6 + 1.6 * Math.sin(0.5)));
    for (const x of [-12, -8, 9, 13]) prop(b, kit, "tree_fat", B + x, 0, BZ + 4, 4.4, x);
    for (let x = -30; x <= 30; x += 2.5) b.add(boxGeo(V(B + x - 0.05, 0, BZ + 28), V(B + x + 0.05, 1.8, BZ + 28.1)), metal);
    b.add(boxGeo(V(B - 30, 1.6, BZ + 28), V(B + 30, 1.68, BZ + 28.1)), metal);

    // ================= OFFICE (x ~ 2000) + WAR ROOM (x ~ 2040) =================
    const ow = lam("officeWall", () => ({ map: plain("officeWall", "#d9cfae", "#c7bd9a", 600) }));
    const ofl = lam("officeFloor", () => ({ map: carpet("officeFloor", "#6f7a5a") }));
    b.add(quadUp(OFFICE - 200, WAR + 200, -200, 200, 4, 0), grass);
    room(b, { cx: OFFICE, w: 7, d: 8, h: 3.2, wall: ow, floor: ofl, win: [0.6, 2.6] });
    const dtop = lam("deskWood", () => ({ map: rep(beamHD(), 1, 1) }));
    desk(b, OFFICE, -1.2, 2.4, 0.95, dtop, metal);
    // typewriter-ish laptop + papers + mug on the desk
    b.add(boxGeo(V(OFFICE + 0.45, 0.76, -1.6), V(OFFICE + 0.9, 0.79, -1.32)), dark);
    b.add(boxGeo(V(OFFICE + 0.45, 0.79, -1.62), V(OFFICE + 0.9, 1.06, -1.59)), dark);
    b.add(boxGeo(V(OFFICE - 0.65, 0.76, -1.3), V(OFFICE - 0.4, 0.775, -1.05)), white);
    b.add(new THREE.CylinderGeometry(0.05, 0.045, 0.11, 14), lam("mug", () => ({ color: "#3f6fb5" })), new THREE.Matrix4().makeTranslation(OFFICE - 0.75, 0.815, -1.0));
    // the open binder (insert) + its turning page
    const bp = new THREE.MeshLambertMaterial({ map: penTex("binderPages", 1024, 640, binderPages) }); twoTone(bp);
    const bg = new THREE.PlaneGeometry(0.62, 0.39); bg.rotateX(-Math.PI / 2);
    b.add(bg, bp, new THREE.Matrix4().makeTranslation(OFFICE + 0.05, 0.765, -0.9));
    const pg = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.36).translate(0.14, 0, 0).rotateX(-Math.PI / 2), twoTone(new THREE.MeshLambertMaterial({ color: "#fbf6e6", side: THREE.DoubleSide })));
    this.page.add(pg); this.page.position.set(OFFICE + 0.05, 0.768, -0.9); R.add(this.page);
    // the types board, a flag stand, filing cabinets, a wall clock
    const board = new THREE.MeshLambertMaterial({ map: penTex("typesBoard", 1024, 640, typesBoard) }); twoTone(board);
    b.add(facing(1.9, 1.19), board, new THREE.Matrix4().makeTranslation(OFFICE - 2.3, 1.75, -3.945));
    b.add(boxGeo(V(OFFICE - 3.3, 1.12, -4.0), V(OFFICE - 1.3, 2.38, -3.96)), lam("boardFrame", () => ({ color: "#7a4f33" })));
    b.add(new THREE.CylinderGeometry(0.025, 0.025, 2.2, 8), lam("poleGold", () => ({ color: "#d9b84a" })), new THREE.Matrix4().makeTranslation(OFFICE + 3.0, 1.1, -3.4));
    const sflag = new THREE.PlaneGeometry(0.9, 0.5);
    b.add(sflag, flagM, new THREE.Matrix4().makeRotationY(0.3).setPosition(OFFICE + 2.57, 1.85, -3.53));
    for (const x of [OFFICE + 1.1, OFFICE + 1.65]) b.add(boxGeo(V(x, 0, -3.95), V(x + 0.5, 1.3, -3.4), 1), lam("cabinet", () => ({ color: "#7d8a6a" })));
    b.add(new THREE.CylinderGeometry(0.22, 0.22, 0.05, 24).rotateX(Math.PI / 2), white, new THREE.Matrix4().makeTranslation(OFFICE - 0.2, 2.55, -3.95));
    // war room: map table + pins (zombie heads on sticks) + lamp
    room(b, { cx: WAR, w: 7, d: 8, h: 3.2, wall: lam("warWall", () => ({ map: plain("warWall", "#a9b49a", "#97a287", 600) })), floor: ofl });
    desk(b, WAR, 0, 2.6, 1.6, lam("warTable", () => ({ color: "#6a4a32" })), lam("warLeg", () => ({ color: "#4a3424" })), 0.85);
    const mp = new THREE.MeshLambertMaterial({ map: penTex("mapTex", 1024, 640, mapTex) }); twoTone(mp);
    const mg = new THREE.PlaneGeometry(2.5, 1.5); mg.rotateX(-Math.PI / 2);
    b.add(mg, mp, new THREE.Matrix4().makeTranslation(WAR, 0.855, 0));
    const pinStick = lam("pinStick", () => ({ color: "#e8e6e0" })), pinHead = lam("pinHead", () => ({ color: "#8fd65a" }));
    const pinSpots: [number, number][] = [[-0.85, -0.35], [-0.6, 0.1], [-0.2, -0.45], [0.15, 0.2], [0.45, -0.2], [0.7, 0.35], [0.95, -0.4], [-0.95, 0.4], [0.3, 0.5]];
    pinSpots.forEach(([x, z], k) => {
      const g = new THREE.Group();
      const st = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.14, 6).translate(0, 0.07, 0), pinStick);
      const hd = new THREE.Mesh(new THREE.SphereGeometry(0.032, 14, 10).translate(0, 0.15, 0), pinHead);
      g.add(st, hd); g.position.set(WAR + x, 0.855, z); g.scale.setScalar(0.001);
      st.castShadow = hd.castShadow = true;
      R.add(g); this.pins.push({ m: g, k });
    });
    b.add(new THREE.CylinderGeometry(0.02, 0.02, 1.0, 8), metal, new THREE.Matrix4().makeTranslation(WAR, 2.7, 0));
    b.add(new THREE.ConeGeometry(0.35, 0.3, 20, 1, true), lam("lampShade", () => ({ color: "#3f6a4a", side: THREE.DoubleSide })), new THREE.Matrix4().makeTranslation(WAR, 2.1, 0));
    for (const x of [WAR - 3.0, WAR + 2.5]) b.add(boxGeo(V(x, 0, -3.95), V(x + 0.5, 1.3, -3.4), 1), lam("cabinet", () => ({ color: "#7d8a6a" })));

    // ================= FIELD (x ~ 4000) =================
    const F = FIELD;
    b.add(quadUp(F - 300, F + 300, -300, 300, 4, 0), grass);
    b.add(quadUp(F - 40, F + 60, -4, 3, 3, 0.008), lam("drillGround", () => ({ map: plain("drill", "#c9b48c", "#b09a72", 1400) })));
    for (let x = -40; x <= 60; x += 2.5) b.add(boxGeo(V(F + x - 0.06, 0, -13), V(F + x + 0.06, 1.3, -12.88)), beamM);
    for (const y of [0.55, 1.1]) b.add(boxGeo(V(F - 40, y, -12.97), V(F + 60, y + 0.12, -12.9)), beamM);
    b.add(boxGeo(V(F - 25, 0, -42), V(F + 35, 8, -30), 2), conc);
    for (let i = 0; i < 14; i++) b.add(boxGeo(V(F - 22 + i * 4.2, 3, -29.98), V(F - 20.2 + i * 4.2, 4.6, -29.9)), winDark);
    for (const x of [-30, -18, 22, 40, 52]) prop(b, kit, "tree_oak", F + x, 0, -18, 6, x);
    prop(b, kit, "plant_bushLarge", F + 8.95, 0, 0.0, 1.05, 0.3); // the vegetarian's lunch
    b.add(boxGeo(V(F + 15.72, 0, -0.28), V(F + 16.28, 0.5, 0.28), 1), wood); // the chicken's crate
    b.add(boxGeo(V(F + 15.7, 0.18, 0.28), V(F + 16.3, 0.25, 0.3)), beamM);

    // ================= CDC OFFICE (x ~ 6000) =================
    const C = CDC;
    b.add(quadUp(C - 200, C + 200, -200, 200, 4, 0), grass);
    room(b, { cx: C, w: 7.4, d: 8, h: 3.3, wall: lam("cdcWall", () => ({ map: plain("cdcWall", "#bfe0dc", "#a9ccc8", 600) })), floor: lam("cdcFloor", () => ({ map: carpet("cdcFloor", "#7d8fb0") })), win: [1.6, 3.3] });
    desk(b, C + 0.4, -1.35, 2.6, 0.9, lam("cdcDesk", () => ({ color: "#efe9dc" })), metal);
    // desk monitor + keyboard
    b.add(boxGeo(V(C + 0.33, 0.76, -1.62), V(C + 0.37, 1.0, -1.58)), dark);
    b.add(boxGeo(V(C + 0.02, 0.97, -1.6), V(C + 0.68, 1.4, -1.55)), dark);
    b.add(facing(0.6, 0.375), scrMat(this.scr.blog, false), new THREE.Matrix4().makeTranslation(C + 0.35, 1.185, -1.545));
    b.add(boxGeo(V(C + 0.1, 0.76, -1.3), V(C + 0.6, 0.78, -1.15)), dark);
    // big wall screen
    b.add(boxGeo(V(C - 2.3, 1.0, -3.98), V(C + 1.1, 3.0, -3.9)), dark);
    b.add(facing(3.2, 1.8), scrMat(this.scr.blog, true), new THREE.Matrix4().makeTranslation(C - 0.6, 2.0, -3.89));
    // plant, water cooler, shelves
    prop(b, kit, "plant_bush", C + 3.1, 0, -3.3, 0.9, 0);
    b.add(boxGeo(V(C - 3.6, 0, -3.95), V(C - 2.8, 1.9, -3.5), 1), lam("shelf", () => ({ color: "#c98a5a" })));
    b.add(new THREE.CylinderGeometry(0.16, 0.16, 0.4, 16), lam("cooler", () => ({ color: "#8fd0ff" })), new THREE.Matrix4().makeTranslation(C + 2.6, 1.25, -3.6));
    b.add(boxGeo(V(C + 2.42, 0, -3.78), V(C + 2.78, 1.05, -3.42)), white);

    // ================= CAMP (x ~ 8000) =================
    const K = CAMP;
    b.add(quadUp(K - 300, K + 300, -300, 300, 4, 0), grass);
    const tent = lam("tent", () => ({ color: "#f0b43c", side: THREE.DoubleSide }));
    const tx = K - 1.6, tz = -1.4, tw = 1.1, th = 1.5, tl = 2.2;
    b.add(quad(V(tx - tw, 0, tz + tl / 2), V(tx - tw, 0, tz - tl / 2), V(tx, th, tz - tl / 2), V(tx, th, tz + tl / 2)), tent);
    b.add(quad(V(tx + tw, 0, tz - tl / 2), V(tx + tw, 0, tz + tl / 2), V(tx, th, tz + tl / 2), V(tx, th, tz - tl / 2)), tent);
    b.add(tri(V(tx - tw, 0, tz - tl / 2), V(tx + tw, 0, tz - tl / 2), V(tx, th, tz - tl / 2)), tent);
    b.add(tri(V(tx + tw, 0, tz + tl / 2), V(tx - tw, 0, tz + tl / 2), V(tx, th, tz + tl / 2)), lam("tentDoor", () => ({ color: "#b0702a", side: THREE.DoubleSide })));
    for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; b.add(new THREE.SphereGeometry(0.11, 10, 8), lam("stone", () => ({ color: "#9a948a" })), new THREE.Matrix4().makeTranslation(K + 1.6 + 0.4 * Math.cos(a), 0.06, 1.1 + 0.4 * Math.sin(a))); }
    for (const a of [0.4, 1.9]) { const l = new THREE.CylinderGeometry(0.06, 0.06, 0.6, 10); l.rotateZ(Math.PI / 2); l.rotateY(a); b.add(l, lam("log", () => ({ color: "#7a4f33" })), new THREE.Matrix4().makeTranslation(K + 1.6, 0.08, 1.1)); }
    const seat = new THREE.CylinderGeometry(0.2, 0.2, 1.4, 14); seat.rotateZ(Math.PI / 2);
    b.add(seat, lam("log", () => ({ color: "#7a4f33" })), new THREE.Matrix4().makeTranslation(K + 2.7, 0.2, 0.0));
    for (const [x, z] of [[-6, -6], [-3, -9], [4, -8], [7, -5], [-8, -2], [10, -11], [0, -12], [-12, -8]]) prop(b, kit, "tree_cone", K + x, 0, z, 5 + ((x * 7 + z) % 3), x);
    this.flood = new THREE.Mesh(new THREE.PlaneGeometry(40, 40).rotateX(-Math.PI / 2), twoTone(new THREE.MeshLambertMaterial({ color: "#4f8fd0", transparent: true, opacity: 0.75 })));
    this.flood.position.set(K, -0.05, 0); this.flood.visible = false; R.add(this.flood);

    b.build(R);
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
    const az = THREE.MathUtils.degToRad(s.sunAz ?? L.az), el = THREE.MathUtils.degToRad(s.sunEl ?? L.el);
    const hx = fx * Math.cos(az) - fz * Math.sin(az), hz = fz * Math.cos(az) + fx * Math.sin(az);
    v = new THREE.Vector3(hx * Math.cos(el), Math.sin(el), hz * Math.cos(el)).normalize();
    this.sunCache.set(id, v);
    return v;
  }
  private actor(i: number) { while (this.actors.length <= i) this.actors.push(new Actor(this.root)); return this.actors[i]; }
  private fx(i: number) { while (this.fxs.length <= i) this.fxs.push(new Fx(this.root)); return this.fxs[i]; }

  update(id: number, f: number, cam: THREE.PerspectiveCamera, scene: THREE.Scene) {
    const t = f / FPS, s = SHOTS[id - 1], L = LIGHTS[s.light];
    const c = camAt(id, f);
    cam.position.set(...c.pos); cam.up.set(0, 1, 0); cam.lookAt(...c.look); cam.rotateZ(c.roll);
    cam.fov = c.fov; cam.near = 0.1; cam.far = 1500; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    const focus = V(...c.look), dist = cam.position.distanceTo(focus);
    cam.layers.enable(NOINK);
    // ---- light rig ----
    const K = LOOK[s.light], sunDir = this.shotSun(id, s, L);
    this.hemi.color.set(L.sky); this.hemi.groundColor.set(L.ground); this.hemi.intensity = L.hemiI;
    this.sun.color.set(L.sunCol); this.sun.intensity = L.sunI;
    let Rr = THREE.MathUtils.clamp(dist * 1.15 + 7, 12, 60);
    if (s.light === "golden" && s.set === "base") Rr = Math.max(Rr, 40);
    this.sun.position.copy(focus).addScaledVector(sunDir, 220); this.sun.target.position.copy(focus);
    const sc = this.sun.shadow.camera;
    sc.left = -Rr; sc.right = Rr; sc.top = Rr; sc.bottom = -Rr; sc.near = 20; sc.far = 480; sc.updateProjectionMatrix();
    this.sun.shadow.bias = L.bias; this.sun.shadow.normalBias = L.normalBias * (Rr / 12);
    TONE.uLitCol.value.set(...L.lit); TONE.uShadeCol.value.set(...L.shade); TONE.uShadeLift.value.set(...L.lift);
    TONE.uLambert.value = L.lambert; TONE.uSideK.value = L.sideK; TONE.uTerm.value = L.term; TONE.uBounce.value.set(...K.bounce); TONE.uSat.value = K.sat;
    CHAR.uCharTint.value.set(...L.charTint); CHAR.uCharShade.value = L.charShade; CHAR.uGrad.value = L.charGrad;
    CHAR.uBodyGrad.value = L.bodyGrad; CHAR.uSideTint.value.set(...L.sideTint);
    // ---- sky, fog, sun disc, clouds ----
    const su = this.skyMat.uniforms;
    K.sky.c.forEach((h, i) => untone(h, su["c" + i].value));
    const e = K.sky.e.map((deg) => THREE.MathUtils.degToRad(deg));
    su.e.value.set(e[1], e[2], e[3], e[4]);
    this.sky.position.copy(cam.position);
    untone(L.fog, this.fog.color); this.fog.near = L.fogNear; this.fog.far = L.fogFar;
    scene.fog = this.fog; scene.background = null;
    const showSun = s.light === "golden" && (s.set === "base" || s.set === "camp");
    this.sunDisc.visible = this.sunHalo.visible = showSun;
    if (showSun) {
      this.sunDisc.position.copy(cam.position).addScaledVector(sunDir, 900);
      this.sunDisc.scale.setScalar(2 * 900 * Math.tan(THREE.MathUtils.degToRad(1.7)));
      this.sunHalo.position.copy(this.sunDisc.position); this.sunHalo.scale.setScalar(2 * 900 * Math.tan(THREE.MathUtils.degToRad(24)));
      (this.sunHalo.material as THREE.SpriteMaterial).color.set(L.sunDisc).multiplyScalar(1.3);
    }
    for (let i = 0; i < this.clouds.length; i++) {
      const m = this.clouds[i], mat = m.material as THREE.MeshBasicMaterial;
      const a = (i / 9) * Math.PI * 2 + 0.3, d = 620 + (i % 3) * 60, w = 130 + (i % 4) * 30;
      m.position.set(cam.position.x + Math.cos(a) * d, 120 + (i % 4) * 38, cam.position.z + Math.sin(a) * d); m.scale.set(w, w / 2, 1);
      m.lookAt(cam.position.x, m.position.y, cam.position.z);
      mat.map = this.cloudMaps[s.light][i % 4];
    }
    // ---- set pieces ----
    for (const g of this.fgs) g.o.visible = f >= g.a && f < g.b && g.a < s.b && g.b > s.a;
    const crashed = t >= CRASH_T && t < 59.5;
    for (const sc2 of this.screens) sc2.mat.map = crashed ? this.scr.crash : this.scr.blog;
    // binder page turns (shot 4 insert) and on "Page by page" (shot 5)
    const flips = [10.55, 11.15, 11.75, 12.4, 12.86];
    let ang = 0;
    for (const ft of flips) ang += smooth((t - ft) / 0.4);
    this.page.rotation.z = Math.PI * (ang % 1) * (ang >= flips.length ? 0 : 1);
    this.page.visible = ang % 1 > 0.001;
    // map pins rise on "rise"
    for (const p of this.pins) { const u = smooth((t - (45.45 + p.k * 0.06)) / 0.22); p.m.scale.setScalar(Math.max(0.001, u * (1 + 0.25 * Math.sin(Math.PI * u)))); }
    // flood water
    this.flood.visible = s.set === "camp" && t >= 58.5;
    this.flood.position.y = -0.05 + 0.2 * clamp01((t - 58.55) / 0.6);
    // ---- cast + effects ----
    const right = V(0, 0, 0).setFromMatrixColumn(cam.matrixWorld, 0);
    const st = stage(id, t, { pos: cam.position, right, sun: sunDir });
    this.frustum.setFromProjectionMatrix(this.m4.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
    let ai = 0;
    const used: Actor[] = [];
    for (const p of st.places) {
      const sc2 = p.scale ?? 1;
      if (sc2 < 0.01) continue;
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
    for (const e2 of fused) e2.bind();
    return focus;
  }
}
void roofHD;
