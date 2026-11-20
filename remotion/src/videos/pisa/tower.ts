// The bell tower of Pisa as a chain of eight floor groups: each floor is parented to the top of the one below, so
// the whole stack leans from the base pivot and every floor from the 4th up tilts back a little more (the banana).
// A floor that is not built yet is hidden; a floor going up scales from its base with a small overshoot.
// Geometry per floor is merged by material (marble, arch band, inner wall, bell bays) so the ink pass draws the
// columns, cornices and arches as clean silhouettes.
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { lam } from "./build";
import { stoneHD, rep } from "./paint";
import { blindBay, archBay, innerWall, bellBay, clayHD, earthHD } from "./pisapaint";
import { FLOOR_H, TowerState } from "./story";

const R_CORE = 7.0, R_COL = 7.22, R_LEDGE = 7.6, R_INNER = 6.1, R_BELL = 4.7;
const N_BLIND = 15, N_GAL = 30, N_BELL = 12;

const cyl = (r0: number, r1: number, h: number, y: number, seg = 64, open = false) =>
  new THREE.CylinderGeometry(r1, r0, h, seg, 1, open).translate(0, y + h / 2, 0);
/** open cylinder band with u running round once per `bays` repeats of its texture */
const band = (r: number, h: number, y: number, bays: number, seg = 120) => {
  const g = new THREE.CylinderGeometry(r, r, h, seg, 1, true).translate(0, y + h / 2, 0);
  const uv = g.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * bays);
  return g;
};
const ring = (rOut: number, rIn: number, h: number, y: number) => {
  const s = new THREE.Shape(); s.absarc(0, 0, rOut, 0, Math.PI * 2, false);
  const hole = new THREE.Path(); hole.absarc(0, 0, rIn, 0, Math.PI * 2, true); s.holes.push(hole);
  const g = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: false, curveSegments: 64 });
  g.rotateX(-Math.PI / 2); g.translate(0, y, 0);
  return g;
};
const columns = (n: number, r: number, rad: number, y0: number, h: number, phase = 0.5) => {
  const out: THREE.BufferGeometry[] = [];
  for (let i = 0; i < n; i++) {
    const a = ((i + phase) / n) * Math.PI * 2, x = Math.cos(a) * r, z = Math.sin(a) * r;
    out.push(new THREE.CylinderGeometry(rad, rad * 1.08, h, 10).translate(x, y0 + h / 2, z));
    out.push(new THREE.BoxGeometry(rad * 2.6, 0.22, rad * 2.6).translate(x, y0 + h - 0.11, z)); // capital
    out.push(new THREE.BoxGeometry(rad * 2.5, 0.2, rad * 2.5).translate(x, y0 + 0.1, z)); // base
  }
  return out;
};
const merged = (list: THREE.BufferGeometry[]) => mergeGeometries(list.map((g) => (g.index ? g.toNonIndexed() : g)).map((g) => {
  if (!g.attributes.uv) g.setAttribute("uv", new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
  return g;
}), false);

export class Tower {
  root = new THREE.Group();
  private floors: THREE.Group[] = [];
  private pit: THREE.Group;
  private fill: THREE.Mesh;

  constructor() {
    const marble = lam("marble", () => ({ map: rep(stoneHD("marbleHD"), 3, 1.5) }));
    const marbleS = lam("marbleS", () => ({ map: rep(stoneHD("marbleHD"), 1, 1) }));
    const blind = lam("blindBay", () => ({ map: blindBay() }));
    const arches = lam("archBay", () => ({ map: archBay(), alphaTest: 0.5, side: THREE.DoubleSide }));
    const inner = lam("innerWall", () => ({ map: rep(innerWall(), 1, 1) }));
    const bell = lam("bellBay", () => ({ map: bellBay() }));
    const mesh = (g: THREE.BufferGeometry, m: THREE.Material) => { const x = new THREE.Mesh(g, m); x.castShadow = true; x.receiveShadow = true; return x; };
    let parent: THREE.Object3D = this.root;
    FLOOR_H.forEach((h, k) => {
      const fl = new THREE.Group();
      const top = new THREE.Group(); top.position.y = h; top.name = "top";
      fl.add(top);
      if (k === 0) {
        const core = cyl(R_CORE, R_CORE, h + 3, -3, 90, true);
        const uv = core.attributes.uv as THREE.BufferAttribute;
        for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * N_BLIND);
        fl.add(mesh(core, blind));
        fl.add(mesh(merged([
          ...columns(N_BLIND, R_CORE + 0.12, 0.32, 0.9, h - 1.9, 0),
          ring(R_LEDGE + 0.25, R_CORE - 0.2, 0.9, 0), // plinth
          ring(R_LEDGE, R_CORE - 0.2, 0.55, h - 0.55), // cornice
        ]), marbleS));
      } else if (k < 7) {
        const colH = h - 0.5 - 1.9;
        fl.add(mesh(merged([
          ring(R_LEDGE, R_INNER - 0.1, 0.5, 0), // gallery floor + cornice
          ...columns(N_GAL, R_COL, 0.2, 0.5, colH),
        ]), marbleS));
        fl.add(mesh(band(R_COL + 0.05, 1.9, h - 1.9, N_GAL), arches));
        fl.add(mesh(cyl(R_INNER, R_INNER, h, 0, 64, true), inner));
        fl.add(mesh(ring(R_COL + 0.3, R_INNER, 0.18, h - 0.18), marbleS)); // gallery ceiling
      } else {
        fl.add(mesh(merged([
          ring(R_LEDGE, 0.01, 0.5, 0), // terrace floor
          ring(R_LEDGE - 0.1, R_LEDGE - 0.45, 1.0, 0.5), // parapet
          ring(R_BELL + 0.45, 0.01, 0.6, h - 0.6), // roof cornice
          ring(R_BELL - 0.2, 0.01, 0.35, h), // roof
        ]), marbleS));
        const b = cyl(R_BELL, R_BELL, h - 1.1, 0.5, 72, true);
        const uv = b.attributes.uv as THREE.BufferAttribute;
        for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * N_BELL);
        fl.add(mesh(b, bell));
      }
      void marble;
      parent.add(fl);
      this.floors.push(fl);
      parent = top;
    });
    // foundation pit (shots 2-3): clay walls and floor, plus the earth ring that fills the gap once the tower stands
    this.pit = new THREE.Group();
    const clay = lam("clay", () => ({ map: rep(clayHD(), 2, 2) }));
    const clayW = lam("clayWall", () => ({ map: rep(clayHD(), 6, 0.6), side: THREE.BackSide }));
    const wall = new THREE.Mesh(cyl(8.2, 8.2, 3.0, -3.0, 72, true), clayW); wall.receiveShadow = true;
    const floor = new THREE.Mesh(new THREE.CircleGeometry(8.2, 72).rotateX(-Math.PI / 2).translate(0, -3, 0), clay); floor.receiveShadow = true;
    this.pit.add(wall, floor);
    const earth = lam("earthRing", () => ({ map: rep(earthHD(), 6, 6) }));
    this.fill = new THREE.Mesh(ring(8.25, 6.9, 0.05, -0.04), earth);
    this.fill.receiveShadow = true;
  }
  /** add the pit / fill pieces next to the tower (they must not lean with it) */
  attach(scene: THREE.Object3D) { scene.add(this.root, this.pit, this.fill); }

  pose(s: TowerState, showPit: boolean) {
    const lean = THREE.MathUtils.degToRad(s.lean);
    this.root.rotation.set(0, 0, -lean);
    this.floors.forEach((fl, k) => {
      const v = s.floors[k];
      fl.visible = v > 0.001;
      fl.scale.set(1, Math.max(0.001, v), 1);
      fl.rotation.set(0, 0, k >= 3 ? THREE.MathUtils.degToRad(s.bend) : 0);
    });
    this.pit.visible = showPit;
    this.fill.visible = s.floors[0] > 0.001;
  }
  /** world position of a point on the tower axis at height y (for effects and camera aims) */
  axisAt(s: TowerState, y: number) {
    const a = THREE.MathUtils.degToRad(s.lean);
    return new THREE.Vector3(Math.sin(a) * y, Math.cos(a) * y, 0);
  }
  /** top of floor k (0-based) on the axis, following the bend */
  floorTop(k: number) {
    const v = new THREE.Vector3();
    this.root.updateMatrixWorld(true);
    (this.floors[k].getObjectByName("top") as THREE.Object3D).getWorldPosition(v);
    return v;
  }
}
