// The steamer: an original 1914-type steel cargo ship, 50 m (our scale), built from code. Pack-local coordinates: centre
// at the origin, bow toward +z, main deck at DECK. Hull = lofted stations (raked stem, rounded counter stern, sheer
// rising to the forecastle and poop), painted hull map (hullHD), deckhouse + bridge + funnel amidships, two masts with
// derrick booms and rigging, tarped hatches (the fore hatch opens on the fur bales), lifeboats on davits, a rope
// ladder, glowing portholes (shot 12) and a snow skirt that freezes her into the ice.
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { Batch, V, lam, boxGeo, beamBetween } from "./build";
import { hullHD, cabinHD, tarpHD, planksHD, snowHD, beamHD, HULL_Y0, HULL_Y1 } from "./paint";
import { twoTone } from "./shade";
import { DECK, HALF_L, BEAM } from "./story";

const ZB = HALF_L, ZS = -HALF_L, HB = BEAM / 2;
/** bulwark top height along the ship (sheer: forecastle forward, poop aft) */
export const topY = (z: number) => HULL_Y1 + 1.5 * smoothstep(12.5, 15, z) + 1.2 * (1 - smoothstep(-20, -17.5, z));
/** deck height along the ship (raised forecastle / poop decks) */
export const deckY = (z: number) => DECK + (z > 14 ? 1.5 : 0) + (z < -18.5 ? 1.2 : 0);
function smoothstep(a: number, b: number, x: number) { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); }

/** half-beam of the hull at station z and height y */
export const halfBeam = (z: number, y: number) => {
  const stem = ZB - (HULL_Y1 + 1.5 - y) * 0.32; // raked stem: the bow tip moves aft with depth
  let hb = HB;
  if (z > 8) hb = HB * Math.max(0, 1 - Math.pow(Math.max(0, z - 8) / Math.max(0.5, stem - 8), 2.0));
  if (z < -12) hb = HB * Math.sqrt(Math.max(0, 1 - Math.pow((z + 12) / (ZS + 12 - 1.5 * Math.max(0, (y - 1) / 4)), 2)));
  const d = (HULL_Y1 - y) / (HULL_Y1 - HULL_Y0); // 0 at the sheer, 1 at the keel
  return hb * (1 - 0.55 * Math.pow(Math.max(0, d), 3.2));
};

const NZ = 90, NY = 16;
const hullGeo = () => {
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  const z0 = ZS - 1.6, z1 = ZB + 0.2;
  for (const side of [-1, 1]) {
    const base = pos.length / 3;
    for (let i = 0; i <= NZ; i++) {
      const z = z0 + ((z1 - z0) * i) / NZ, yt = topY(z);
      for (let j = 0; j <= NY; j++) {
        const y = yt + ((HULL_Y0 - yt) * j) / NY;
        pos.push(side * halfBeam(z, y), y, z);
        uv.push((z - z0) / 50 * (side < 0 ? 1 : -1), (y - HULL_Y0) / (HULL_Y1 - HULL_Y0));
      }
    }
    for (let i = 0; i < NZ; i++) for (let j = 0; j < NY; j++) {
      const a = base + i * (NY + 1) + j, b = a + NY + 1;
      if (side < 0) idx.push(a, a + 1, b, b, a + 1, b + 1); else idx.push(a, b, a + 1, b, b + 1, a + 1); // outward faces
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
};
/** inside face of the bulwarks (deck -> rail), facing inboard */
const bulwarkInner = () => {
  const pos: number[] = [], idx: number[] = [];
  const z0 = ZS - 1.2, z1 = ZB - 0.6;
  for (const side of [-1, 1]) {
    const base = pos.length / 3;
    for (let i = 0; i <= NZ; i++) {
      const z = z0 + ((z1 - z0) * i) / NZ, yt = topY(z), w = halfBeam(z, yt) - 0.18;
      pos.push(side * Math.max(0, w), deckY(z) - 0.05, z, side * Math.max(0, w), yt, z);
    }
    for (let i = 0; i < NZ; i++) { const a = base + i * 2; if (side < 0) idx.push(a, a + 1, a + 2, a + 2, a + 1, a + 3); else idx.push(a, a + 2, a + 1, a + 2, a + 3, a + 1); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(new Array((pos.length / 3) * 2).fill(0), 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
};
/** cap rail along the bulwark top */
const capRail = () => {
  const parts: THREE.BufferGeometry[] = [];
  for (const side of [-1, 1]) for (let i = 0; i < NZ; i++) {
    const z0 = ZS - 1.4 + ((ZB - ZS + 1.1) * i) / NZ, z1 = ZS - 1.4 + ((ZB - ZS + 1.1) * (i + 1)) / NZ;
    const a = V(side * (halfBeam(z0, topY(z0)) - 0.09), topY(z0) + 0.06, z0), b = V(side * (halfBeam(z1, topY(z1)) - 0.09), topY(z1) + 0.06, z1);
    if (a.distanceTo(b) > 0.01) parts.push(beamBetween(a, b, 0.22));
  }
  return mergeGeometries(parts.map((p) => p.toNonIndexed()), false);
};
/** a flat deck panel following the hull outline between z0 and z1 at height y (strip port <-> starboard, facing up) */
const deckPanel = (z0: number, z1: number, y: number, n = 40) => {
  const pos: number[] = [], uv: number[] = [], nor: number[] = [], idx: number[] = [];
  for (let i = 0; i <= n; i++) {
    const z = z0 + ((z1 - z0) * i) / n, w = Math.max(0.05, halfBeam(z, y + 0.6) - 0.15);
    pos.push(-w, y, z, w, y, z); nor.push(0, 1, 0, 0, 1, 0); uv.push(-w / 5, z / 5, w / 5, z / 5);
    if (i < n) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
  return g;
};

export type ShipParts = {
  root: THREE.Group;
  tarpFore: THREE.Object3D;
  bales: THREE.Object3D;
  snowDeck: THREE.Object3D[];
  woodDeck: THREE.Object3D[];
  skirt: THREE.Object3D;
  ladder: THREE.Object3D;
  glow: THREE.MeshBasicMaterial;
  glowMesh: THREE.Object3D;
  funnelTop: THREE.Vector3;
  flag: THREE.Object3D;
};

export const buildShip = (): ShipParts => {
  const root = new THREE.Group();
  const hullTex = hullHD(); hullTex.wrapS = THREE.RepeatWrapping; hullTex.anisotropy = 16;
  const M = {
    hull: lam("hull", () => ({ map: hullTex })),
    bulw: lam("bulwarkIn", () => ({ color: "#8c8a90", side: THREE.DoubleSide })),
    rail: lam("rail", () => ({ map: beamHD() })),
    deck: lam("shipDeck", () => ({ map: planksHD() })),
    snow: lam("shipSnow", () => ({ map: snowHD() })),
    cabin: lam("cabin", () => ({ map: cabinHD("a") })),
    cabin2: lam("cabin2", () => ({ map: cabinHD("b", false) })),
    white: lam("shipWhite", () => ({ color: "#ece6d6" })),
    roof: lam("shipRoof", () => ({ color: "#f3f5f8" })),
    buff: lam("funnel", () => ({ color: "#a8483a" })), // brick-red funnel, black top
    black: twoTone(new THREE.MeshPhongMaterial({ color: "#26272c", specular: "#555", shininess: 40 }), 0.15),
    mast: lam("mast", () => ({ color: "#b98a4e" })),
    rig: lam("rigging", () => ({ color: "#3a3230" })),
    tarp: lam("tarp", () => ({ map: tarpHD() })),
    fur: lam("furBale", () => ({ color: "#8a5a34" })),
    fur2: lam("furBale2", () => ({ color: "#a46d42" })),
    rope: lam("rope", () => ({ color: "#c9a874" })),
    red: lam("shipRed", () => ({ color: "#b8433a" })),
  };
  const add = (g: THREE.BufferGeometry, m: THREE.Material, cast = true) => {
    const mesh = new THREE.Mesh(g, m); mesh.castShadow = cast; mesh.receiveShadow = true; root.add(mesh); return mesh;
  };
  add(hullGeo(), M.hull);
  add(bulwarkInner(), M.bulw);
  add(capRail(), M.rail);
  const woodDeck = [add(deckPanel(ZS + 1.2, 14.2, DECK), M.deck), add(deckPanel(14, ZB - 1.0, DECK + 1.5), M.deck), add(deckPanel(ZS - 0.6, -18.3, DECK + 1.2), M.deck)];
  const snowDeck = [add(deckPanel(ZS + 1.2, 14.2, DECK + 0.03), M.snow), add(deckPanel(14, ZB - 1.0, DECK + 1.53), M.snow), add(deckPanel(ZS - 0.6, -18.3, DECK + 1.23), M.snow)];
  for (const m of snowDeck) m.visible = false;
  // forecastle / poop fronts (bulkheads)
  const b = new Batch();
  b.add(boxGeo(V(-halfBeam(14, 5) + 0.3, DECK, 13.9), V(halfBeam(14, 5) - 0.3, DECK + 1.5, 14.2)), M.white);
  b.add(boxGeo(V(-halfBeam(-18.4, 5) + 0.3, DECK, -18.5), V(halfBeam(-18.4, 5) - 0.3, DECK + 1.2, -18.2)), M.white);
  // deckhouse (z -7..4) + boat deck, bridge house, wheelhouse
  b.add(boxGeo(V(-3.2, DECK, -7), V(3.2, DECK + 2.6, 4)), M.cabin);
  b.add(boxGeo(V(-3.6, DECK + 2.6, -7.4), V(3.6, DECK + 2.8, 4.4)), M.roof);
  b.add(boxGeo(V(-2.6, DECK + 2.8, 0), V(2.6, DECK + 5.0, 3.6)), M.cabin2);
  b.add(boxGeo(V(-3.0, DECK + 5.0, -0.3), V(3.0, DECK + 5.2, 3.9)), M.roof);
  // funnel with black top, steam pipe, two cowl ventilators
  const fun = new THREE.CylinderGeometry(1.15, 1.25, 6.2, 24, 1, true); fun.translate(0, DECK + 2.8 + 3.1, -3.6);
  b.add(fun, M.buff);
  const top = new THREE.CylinderGeometry(1.16, 1.16, 1.4, 24, 1, true); top.translate(0, DECK + 2.8 + 6.2 + 0.7, -3.6);
  b.add(top, M.black);
  const lip = new THREE.TorusGeometry(1.16, 0.1, 6, 24); lip.rotateX(Math.PI / 2); lip.translate(0, DECK + 2.8 + 7.6, -3.6);
  b.add(lip, M.black);
  for (const x of [-1.9, 1.9]) {
    const c = new THREE.CylinderGeometry(0.28, 0.28, 1.8, 12); c.translate(x, DECK + 2.8 + 0.9, -5.6); b.add(c, M.white);
    const hd = new THREE.SphereGeometry(0.48, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2); hd.rotateX(-Math.PI / 2 + 0.3); hd.translate(x, DECK + 2.8 + 1.9, -5.45); b.add(hd, M.red);
  }
  // hatches with coamings; tarps (the fore one comes off in shot 2)
  for (const [z0, z1] of [[5.5, 10.5], [-15.5, -10]] as const) { // hatch coamings: four walls (the fore hold shows in shot 2)
    b.add(boxGeo(V(-2.3, DECK, z0), V(2.3, DECK + 0.8, z0 + 0.2)), M.white); b.add(boxGeo(V(-2.3, DECK, z1 - 0.2), V(2.3, DECK + 0.8, z1)), M.white);
    b.add(boxGeo(V(-2.3, DECK, z0), V(-2.1, DECK + 0.8, z1)), M.white); b.add(boxGeo(V(2.1, DECK, z0), V(2.3, DECK + 0.8, z1)), M.white);
  }
  b.add(boxGeo(V(-2.35, DECK + 0.8, -15.55), V(2.35, DECK + 0.92, -9.95)), M.tarp);
  // masts, crow's nest, booms, rigging
  const mast = (z: number, h: number) => {
    b.add(beamBetween(V(0, DECK, z), V(0, h, z), 0.42, true), M.mast);
    b.add(beamBetween(V(0, h, z), V(0, h + 3, z), 0.2, true), M.mast);
    b.add(beamBetween(V(-1.8, h - 4, z), V(1.8, h - 4, z), 0.2, true), M.mast); // cross-tree
    for (const s of [-1, 1]) for (const dz of [-1.5, 0, 1.5])
      b.add(beamBetween(V(s * 1.6, h - 4, z), V(s * (halfBeam(z + dz, 4.6) - 0.1), topY(z + dz), z + dz), 0.06, true), M.rig);
  };
  mast(11.5, 21); mast(-16, 19.5);
  const nest = new THREE.CylinderGeometry(0.7, 0.6, 1.0, 14); nest.translate(0, 17.5, 11.5); b.add(nest, M.mast);
  b.add(beamBetween(V(0, DECK + 1.6, 11.0), V(0, DECK + 1.2, 6.0), 0.24, true), M.mast); // fore boom
  b.add(beamBetween(V(0, DECK + 1.6, -15.5), V(0, DECK + 1.2, -10.5), 0.24, true), M.mast); // aft boom
  for (const [a, c] of [[V(0, 23.8, 11.5), V(0, topY(ZB - 0.6) + 0.3, ZB - 0.6)], [V(0, 22.3, -16), V(0, topY(ZS - 1) + 0.3, ZS - 1.0)], [V(0, 23, 11.5), V(0, 21.5, -16)],
    [V(0, 21, 11.5), V(0, DECK + 2.8 + 7.6, -3.6)]] as const) b.add(beamBetween(a, c, 0.06, true), M.rig);
  // lifeboats on davits (boat deck)
  for (const s of [-1, 1]) {
    const lb = new THREE.CapsuleGeometry(0.65, 4.0, 6, 12); lb.rotateX(Math.PI / 2); lb.scale(1, 0.75, 1); lb.translate(s * 3.4, DECK + 3.6, -3.2);
    b.add(lb, M.white);
    for (const dz of [-1.8, 1.8]) b.add(beamBetween(V(s * 3.0, DECK + 2.8, -3.2 + dz), V(s * 3.4, DECK + 4.6, -3.2 + dz), 0.14, true), M.black);
  }
  // bitts, winches (small dark lumps on deck)
  for (const [x, z] of [[1.5, 12.5], [-1.5, 12.5], [1.5, -17.2], [-1.5, -17.2], [0, 4.8], [0, -8.2]] as const) b.add(boxGeo(V(x - 0.4, DECK, z - 0.3), V(x + 0.4, DECK + 0.7, z + 0.3)), M.black);
  b.build(root);
  // fore hatch tarp (separate: off in shot 2)
  const tarpFore = add(boxGeo(V(-2.35, DECK + 0.8, 5.45), V(2.35, DECK + 0.92, 10.55)), M.tarp);
  // fur bales in the open fore hatch
  const bales = new THREE.Group();
  for (let i = 0; i < 14; i++) {
    const g = new THREE.CapsuleGeometry(0.32, 0.6, 4, 10); g.rotateZ(Math.PI / 2);
    const m = new THREE.Mesh(g, i % 3 ? M.fur : M.fur2);
    m.position.set(-1.6 + (i % 4) * 1.05, DECK + 0.5 + (i % 2) * 0.25, 6.2 + Math.floor(i / 4) * 1.2); m.rotation.y = (i * 0.7) % 0.5;
    m.castShadow = true; m.receiveShadow = true; bales.add(m);
  }
  const hold = new THREE.Mesh(boxGeo(V(-2.2, DECK - 0.4, 5.6), V(2.2, DECK + 0.2, 10.4)), lam("hold", () => ({ color: "#3a2c22" })));
  bales.add(hold); bales.visible = false; root.add(bales);
  // snow skirt: drifts piled against the hull at the ice line (frozen in), one strip per side
  const sk: number[] = [], skI: number[] = [], skUv: number[] = [];
  const N = 70;
  for (const side of [-1, 1]) {
    const base = sk.length / 3;
    for (let i = 0; i <= N; i++) {
      const zz = ZS + 0.2 + ((ZB - 1.2 - ZS - 0.2) * i) / N, w = halfBeam(zz, 0.9) + 0.04, out = 1.3 + 0.5 * Math.sin(i * 1.7);
      if (w < 0.3) { sk.push(side * 0.3, 0.2, zz, side * 0.3, 0.2, zz); skUv.push(i / 6, 0, i / 6, 0.15); continue; }
      sk.push(side * w, 0.85 + 0.18 * Math.sin(i * 2.3), zz, side * (w + out), 0.2, zz);
      skUv.push(i / 6, 0, i / 6, 0.15);
    }
    for (let i = 0; i < N; i++) { const a = base + i * 2; if (side > 0) skI.push(a, a + 1, a + 2, a + 2, a + 1, a + 3); else skI.push(a, a + 2, a + 1, a + 2, a + 3, a + 1); }
  }
  const skG = new THREE.BufferGeometry();
  skG.setAttribute("position", new THREE.Float32BufferAttribute(sk, 3)); skG.setAttribute("uv", new THREE.Float32BufferAttribute(skUv, 2));
  skG.setIndex(skI); skG.computeVertexNormals();
  const skirt = new THREE.Mesh(skG, lam("skirtSnow", () => ({ map: snowHD(), side: THREE.DoubleSide })));
  skirt.receiveShadow = true; root.add(skirt);
  // rope ladder down the starboard side amidships
  const ladder = new THREE.Group();
  const lb2 = new Batch();
  const lx = halfBeam(-4, 3) + 0.12;
  for (const dz of [-0.28, 0.28]) lb2.add(beamBetween(V(lx, topY(-4), -4 + dz), V(lx + 0.35, ICE_LOW, -4 + dz), 0.05, true), M.rope);
  for (let k = 0; k < 9; k++) { const y = ICE_LOW + 0.4 + k * 0.5, x = lx + 0.35 * (1 - (y - ICE_LOW) / (topY(-4) - ICE_LOW)); lb2.add(beamBetween(V(x, y, -4.32), V(x, y, -3.68), 0.07, true), M.mast); }
  lb2.build(ladder); root.add(ladder);
  // glowing portholes (shot 12: hunters inside): emissive discs over the painted portholes, both sides
  const glow = new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 2.0, 0.9), fog: false });
  const discs: THREE.BufferGeometry[] = [];
  for (let px = 120; px < 2048 - 80; px += 64) {
    if ((px > 560 && px < 700) || (px > 1300 && px < 1440)) continue;
    const z0 = ZS - 1.6, y = 3.4;
    for (const s of [-1, 1]) {
      // hull uv: port u = (z - z0) / 50, starboard u = -(z - z0) / 50 (repeat-wrapped, so the map runs the other way)
      const zq = s < 0 ? z0 + (px / 2048) * 50 : z0 + 50 - (px / 2048) * 50;
      const w = halfBeam(zq, y);
      if (w < 1) continue;
      const d = new THREE.CircleGeometry(0.16, 12); d.rotateY(s * Math.PI / 2); d.translate(s * (w + 0.03), y, zq);
      discs.push(d);
    }
  }
  const glowMesh = new THREE.Mesh(mergeGeometries(discs, false), glow);
  glowMesh.visible = false; root.add(glowMesh);
  // the 1939 claim flag on a short staff at the rail (shot 13)
  const flag = new THREE.Group();
  const staff = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.2, 6), M.mast); staff.position.set(0, 1.1, 0); flag.add(staff);
  const cloth = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.55), lam("claimFlag", () => ({ color: "#c8463c", side: THREE.DoubleSide }))); cloth.position.set(0.47, 1.85, 0); flag.add(cloth);
  flag.traverse((o) => { o.castShadow = true; }); flag.visible = false; root.add(flag);
  return { root, tarpFore, bales, snowDeck, woodDeck, skirt, ladder, glow, glowMesh, funnelTop: V(0, DECK + 2.8 + 7.7, -3.6), flag };
};
const ICE_LOW = 0.25;
