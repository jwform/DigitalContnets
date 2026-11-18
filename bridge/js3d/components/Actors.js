import * as THREE from 'three';

/*
 * Actors — two stylised hero figures (vendor, tourist) and the food tray.
 * Same look as the crowd (mannequin-like, no face detail): readable silhouettes + a pair of eyes so that
 * eye contact, head turns, nods and hand gestures can be seen. Limbs are pivot groups, posed from scroll progress.
 * Local frame: +z is the way the figure faces, +y up. Height ≈ 1.75 m.
 */
const M = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.68, metalness: 0.05, emissive: color, emissiveIntensity: 0.07, ...o });
const mesh = (geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); return m; };
const cap = (r, len, rs = 12) => new THREE.CapsuleGeometry(r, len, 5, rs);

export function makeFigure(o) {
  const skin = M(o.skin), top = M(o.top), bottom = M(o.bottom), hair = M(o.hair, { roughness: 0.5 }), shoe = M(0x16161a), eye = new THREE.MeshBasicMaterial({ color: 0x0a0a0e });
  const extra = o.extra ? M(o.extra) : null;
  const mats = [skin, top, bottom, hair, shoe, eye]; if (extra) mats.push(extra);
  const root = new THREE.Group();

  // legs + shoes
  for (const sx of [-1, 1]) {
    root.add(mesh(new THREE.CylinderGeometry(0.075, 0.068, 0.86, 10), bottom, sx * 0.09, 0.45, 0));
    root.add(mesh(new THREE.BoxGeometry(0.1, 0.06, 0.26), shoe, sx * 0.09, 0.03, 0.05));
  }
  // hips pivot → torso, head, arms (all lean together)
  const body = new THREE.Group(); body.position.y = 0.88; root.add(body);
  const torso = mesh(cap(0.17, 0.3), top, 0, 0.33, 0); torso.scale.z = 0.72; body.add(torso);
  const head = new THREE.Group(); head.position.set(0, 0.66, 0); body.add(head);
  head.add(mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.09, 8), skin, 0, 0.0, 0));
  const skull = mesh(new THREE.SphereGeometry(0.112, 24, 18), skin, 0, 0.12, 0.005); skull.scale.set(0.92, 1.08, 1); head.add(skull);
  const hairM = mesh(new THREE.SphereGeometry(0.119, 24, 18, 0, Math.PI * 2, 0, Math.PI * 0.62), hair, 0, 0.135, -0.012); hairM.scale.set(0.94, 1.0, 1.02); head.add(hairM);
  for (const sx of [-1, 1]) head.add(mesh(new THREE.SphereGeometry(0.0125, 8, 6), eye, sx * 0.042, 0.135, 0.102));
  if (o.cap) {                                            // vendor cap
    head.add(mesh(new THREE.CylinderGeometry(0.122, 0.122, 0.05, 20), extra, 0, 0.215, -0.004));
    const visor = mesh(new THREE.BoxGeometry(0.17, 0.012, 0.09), extra, 0, 0.2, 0.12); visor.rotation.x = 0.12; head.add(visor);
  }
  if (o.apron) { const ap = mesh(new THREE.BoxGeometry(0.3, 0.5, 0.02), extra, 0, 0.24, 0.125); body.add(ap); }
  if (o.pack) { const pk = mesh(new THREE.BoxGeometry(0.3, 0.4, 0.15), extra, 0, 0.34, -0.17); body.add(pk); }

  const arm = side => {
    const sh = new THREE.Group(); sh.position.set(side * 0.215, 0.56, 0); body.add(sh);
    sh.add(mesh(cap(0.047, 0.2), top, 0, -0.16, 0));
    const el = new THREE.Group(); el.position.set(0, -0.31, 0); sh.add(el);
    el.add(mesh(cap(0.04, 0.18), skin, 0, -0.14, 0));
    el.add(mesh(new THREE.SphereGeometry(0.047, 10, 8), skin, 0, -0.3, 0));
    const hold = new THREE.Group(); hold.position.set(0, -0.32, 0.03); el.add(hold);   // anchor for the food tray
    return { sh, el, hold };
  };
  const L = arm(-1), R = arm(1);
  return { root, body, head, shL: L.sh, elL: L.el, shR: R.sh, elR: R.el, holdL: L.hold, holdR: R.hold, mats };
}

// pose: { head:[rx,ry,rz], shL:[rx,rz], elL:[rx], shR:[rx,rz], elR:[rx], lean:[rx] }
export function applyPose(f, P) {
  f.head.rotation.set(P.head[0], P.head[1], P.head[2]);
  f.shL.rotation.set(P.shL[0], 0, P.shL[1]); f.elL.rotation.set(P.elL[0], 0, 0);
  f.shR.rotation.set(P.shR[0], 0, P.shR[1]); f.elR.rotation.set(P.elR[0], 0, 0);
  f.body.rotation.set(P.lean[0], P.lean[1] || 0, 0);
}

export function makeFood() {
  const g = new THREE.Group();
  const tray = new THREE.MeshStandardMaterial({ color: 0xf2f0ea, roughness: 0.8 });
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.03, 0.1), tray); g.add(base);
  const walls = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.035, 0.11), tray); walls.position.y = 0.012; g.add(walls);
  const food = new THREE.MeshStandardMaterial({ color: 0xd8452b, roughness: 0.5, emissive: 0x3a0d05, emissiveIntensity: 0.6 });
  for (let i = 0; i < 6; i++) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.07, 8), food); c.rotation.z = Math.PI / 2; c.position.set((i % 3 - 1) * 0.035, 0.035, (i < 3 ? -0.022 : 0.022)); c.rotation.y = i * 0.35; g.add(c); }
  return g;
}
