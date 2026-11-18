import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { Batch, mat, atlasPlane, rng } from '../core/batch.js';
import { LAYOUT, COLORS, QUALITY } from '../config/settings.js';
import { makeFacades, SignAtlas, SIGN_STYLES, SHOP_WORDS, BLADE_WORDS, STALL_MENU, makePaving } from '../components/CityTextures.js';
import { Crowd } from '../components/Crowd.js';

/*
 * CityScene — 2030 명동 보행자 골목 + 교차로 입구
 * 골목(폭 12.4m)은 -Z 방향으로 이어지고, z=1.6~10.6 구간이 골목 바깥 교차 도로입니다.
 * 제품은 골목 진입부 양측(x=±1.95)에 동일 방향·일정 간격으로 일렬 배치됩니다.
 */
export class CityLite {
  constructor(renderer) {
    this.renderer = renderer;
    const scene = this.scene = new THREE.Scene();
    scene.background = new THREE.Color(0x07040f);
    scene.fog = new THREE.FogExp2(0x0d0618, 0.019);
    scene.environment = this._neonEnv(renderer);
    this.R = rng(42);
    this.time = 0;

    this._ground();
    this._buildings();
    this._lights();
    this._screens();
    this.crowd = new Crowd(scene, QUALITY.people);
  }

  // dark environment with a few neon panels → believable reflections on metal/paint
  _neonEnv(renderer) {
    const env = new THREE.Scene();
    env.background = new THREE.Color(0x020203);
    const panel = (c, i, x, y, z, w, h, ry) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(i), side: THREE.DoubleSide }));
      m.position.set(x, y, z); m.rotation.y = ry; env.add(m);
    };
    panel(0x9b5cff, 1.4, -8, 3, 0, 3, 6, Math.PI / 2);
    panel(0x5f7dff, 1.1, 8, 4, -4, 2, 8, -Math.PI / 2);
    panel(0xd9ccff, 1.5, 0, 9, 0, 14, 1.2, 0);
    panel(0xb45cff, 1.3, 0, 2, -9, 10, 1.5, 0);
    panel(0xffb08a, 0.5, -6, 2, 6, 3, 2, Math.PI / 3);
    panel(0xffffff, 0.45, 0, 10, 8, 10, 4, Math.PI);
    const pm = new THREE.PMREMGenerator(renderer);
    const t = pm.fromScene(env, 0.02).texture;
    pm.dispose();
    return t;
  }

  _ground() {
    const { map, rough } = makePaving();
    const W = 150, D = 120, cz = -30;
    map.repeat.set(W / 4.8, D / 4.8); rough.repeat.copy(map.repeat);
    if (QUALITY.reflector) {
      const ref = new Reflector(new THREE.PlaneGeometry(W, D), {
        textureWidth: Math.round(innerWidth * 0.5), textureHeight: Math.round(innerHeight * 0.5),
        color: 0x7c7690, clipBias: 0.003,
      });
      ref.rotation.x = -Math.PI / 2; ref.position.set(0, -0.002, cz);
      this.scene.add(ref);
      this.reflector = ref;
    }
    const gmat = new THREE.MeshStandardMaterial({
      map, roughnessMap: rough, roughness: 1, metalness: 0.12, color: 0xaaa6bc,
      transparent: QUALITY.reflector, opacity: QUALITY.reflector ? 0.84 : 1, envMapIntensity: 0.6,
    });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(W, D), gmat);
    ground.rotation.x = -Math.PI / 2; ground.position.set(0, 0.0, cz);
    ground.receiveShadow = true;
    this.scene.add(ground);
    // curbs along the outer street (pedestrian alley has no curb)
    const B = new Batch();
    const curb = new THREE.BoxGeometry(1, 0.12, 0.3);
    for (const z of [LAYOUT.crossZ0 + 0.15, LAYOUT.crossZ1 - 0.15]) {
      B.add('stone', curb, mat(-36, 0.06, z, 0, 0, 0, 60, 1, 1), 0x3a3a42);
      B.add('stone', curb, mat(36, 0.06, z, 0, 0, 0, 60, 1, 1), 0x3a3a42);
    }
    this.groundBatch = B;
  }

  _buildings() {
    const R = this.R;
    const B = this.groundBatch || new Batch();
    const atlas = this.atlas = new SignAtlas(2048);
    atlas.prepare(SHOP_WORDS, BLADE_WORDS, STALL_MENU, SIGN_STYLES);
    const facades = makeFacades(9);
    const facadeMats = [];
    const half = LAYOUT.alleyHalf;
    const group = this.buildingGroup = new THREE.Group();
    this.scene.add(group);
    const lampPos = [];

    const pick = a => a[(R() * a.length) | 0];
    const signMatFor = () => pick(SIGN_STYLES);

    const building = (cx, cz, ry, frontW, depth, h, opts = {}) => {
      const M = mat(cx, 0, cz, ry);
      const L = (x, y, z, rx = 0, ryy = 0, rz = 0, sx = 1, sy = 1, sz = 1) => M.clone().multiply(mat(x, y, z, ryy, rx, rz, sx, sy, sz));
      const fz = depth / 2;
      const gf = 4.6;
      // ---- textured upper body
      const f = pick(facades);
      const m = new THREE.MeshStandardMaterial({ map: f.map.clone(), emissiveMap: f.emissive.clone(), emissive: 0xffffff, emissiveIntensity: 1.25, roughness: 0.72, metalness: 0.22, envMapIntensity: 0.5 });
      m.map.repeat.set(frontW / 12, (h - gf) / 14.4); m.map.offset.set(R(), R());
      m.emissiveMap.repeat.copy(m.map.repeat); m.emissiveMap.offset.copy(m.map.offset);
      m.map.needsUpdate = m.emissiveMap.needsUpdate = true;
      facadeMats.push(m);
      const bodyMesh = new THREE.Mesh(new THREE.BoxGeometry(frontW, h - gf, depth), m);
      bodyMesh.position.set(0, gf + (h - gf) / 2, 0);
      const holder = new THREE.Group(); holder.position.set(cx, 0, cz); holder.rotation.y = ry; holder.add(bodyMesh);
      group.add(holder);
      // ---- ground floor
      B.add('stone', new THREE.BoxGeometry(frontW, gf, depth - 1.2), L(0, gf / 2, -0.6), 0x26262c);
      const nShops = frontW > 7 ? 2 : 1;
      const sw = frontW / nShops;
      for (let s = 0; s < nShops; s++) {
        const sx = -frontW / 2 + sw * (s + 0.5);
        // pillars
        B.add('stone', new THREE.BoxGeometry(0.42, gf, 0.5), L(-frontW / 2 + sw * s + 0.21, gf / 2, fz - 0.25), 0x3b3a3f);
        // interior lightbox seen through glass
        const ir = atlas.interior((R() * 1e6) | 0);
        B.add('signs', atlasPlane(sw - 0.6, 3.2, ir), L(sx, 1.75, fz - 1.15), 0xffffff);
        // glass + mullions
        B.add('glass', new THREE.PlaneGeometry(sw - 0.6, 3.5), L(sx, 1.85, fz - 0.55), 0xffffff);
        B.add('metal', new THREE.BoxGeometry(sw - 0.5, 0.08, 0.12), L(sx, 3.62, fz - 0.5), 0x1b1b20);
        B.add('metal', new THREE.BoxGeometry(0.06, 3.5, 0.1), L(sx + (R() - 0.5) * 0.6, 1.85, fz - 0.5), 0x1b1b20);
        // door frame
        B.add('metal', new THREE.BoxGeometry(1.4, 2.5, 0.08), L(sx + sw * 0.2, 1.25, fz - 0.52), 0x101014);
        // sign band
        const word = pick(SHOP_WORDS);
        const r = atlas.band(word, signMatFor());
        B.add('metal', new THREE.BoxGeometry(sw - 0.2, 0.9, 0.3), L(sx, 4.15, fz + 0.1), 0x0d0d10);
        B.add('signs', atlasPlane(sw - 0.4, 0.75, r), L(sx, 4.15, fz + 0.26), 0xffffff);
        // awning
        if (R() < 0.35) {
          const ac = pick([0x7a1d24, 0x1f2b45, 0x2b2b2e, 0x4a3b2a]);
          B.add('canopy', new THREE.BoxGeometry(sw - 0.4, 0.06, 1.3), L(sx, 3.45, fz + 0.55, 0.32), ac);
        }
        lampPos.push(new THREE.Vector3(sx, 3.4, fz + 0.4).applyMatrix4(M));
      }
      B.add('stone', new THREE.BoxGeometry(frontW + 0.2, 0.32, 0.6), L(0, gf + 0.16, fz + 0.05), 0x34343a);
      // ---- upper details
      const floors = Math.floor((h - gf) / 3.6);
      for (let fl = 1; fl < floors; fl++) {
        if (R() < 0.55) B.add('stone', new THREE.BoxGeometry(frontW + 0.12, 0.14, 0.24), L(0, gf + fl * 3.6, fz + 0.1), 0x2c2c32);
      }
      // corner pilasters
      B.add('stone', new THREE.BoxGeometry(0.3, h - gf, 0.25), L(-frontW / 2 + 0.15, gf + (h - gf) / 2, fz + 0.1), 0x2a2a30);
      B.add('stone', new THREE.BoxGeometry(0.3, h - gf, 0.25), L(frontW / 2 - 0.15, gf + (h - gf) / 2, fz + 0.1), 0x2a2a30);
      // parapet + rooftop
      B.add('stone', new THREE.BoxGeometry(frontW, 0.9, depth), L(0, h + 0.45, 0, 0, 0, 0, 1, 1, 1), 0x1d1d22);
      if (R() < 0.6) B.add('metal', new THREE.CylinderGeometry(0.9, 0.9, 1.8, 14), L((R() - 0.5) * frontW * 0.5, h + 1.8, -depth * 0.2), 0x55565c);
      if (R() < 0.5) B.add('metal', new THREE.BoxGeometry(2.2, 1.4, 1.6), L((R() - 0.5) * frontW * 0.4, h + 1.6, -depth * 0.1), 0x3d3e44);
      // rooftop billboard
      if (opts.billboard || R() < 0.25) {
        const r = atlas.band(pick(SHOP_WORDS), signMatFor());
        const bw = Math.min(frontW - 0.5, 7);
        B.add('metal', new THREE.BoxGeometry(bw + 0.2, bw * 0.19 + 0.2, 0.25), L(0, h + 2.6, fz - 0.6), 0x111114);
        B.add('signs', atlasPlane(bw, bw * 0.19, r), L(0, h + 2.6, fz - 0.46), 0xffffff);
        for (const sx of [-bw / 3, bw / 3]) B.add('metal', new THREE.BoxGeometry(0.1, 2.0, 0.1), L(sx, h + 1.2, fz - 0.6), 0x222226);
      }
      // vertical blade signs (perpendicular to the facade)
      const nb = (R() * 2.4) | 0;
      for (let b = 0; b < nb; b++) {
        const bx = -frontW / 2 + 0.8 + R() * (frontW - 1.6);
        const by = gf + 2.6 + R() * Math.max(0.5, Math.min(10, h - gf - 7));
        const r = atlas.blade(pick(BLADE_WORDS), signMatFor());
        const bh = 4.2, bw = 0.92;
        B.add('metal', new THREE.BoxGeometry(0.2, bh + 0.15, bw + 0.1), L(bx, by, fz + bw / 2 + 0.35), 0x0c0c0f);
        B.add('signs', atlasPlane(bw, bh, r), L(bx + 0.106, by, fz + bw / 2 + 0.35, 0, Math.PI / 2, 0), 0xffffff);
        B.add('signs', atlasPlane(bw, bh, r), L(bx - 0.106, by, fz + bw / 2 + 0.35, 0, -Math.PI / 2, 0), 0xffffff);
        B.add('metal', new THREE.BoxGeometry(0.06, 0.06, 0.4), L(bx, by + bh / 2 - 0.2, fz + 0.2), 0x222226);
        B.add('metal', new THREE.BoxGeometry(0.06, 0.06, 0.4), L(bx, by - bh / 2 + 0.2, fz + 0.2), 0x222226);
      }
      // AC units, pipes, small lights
      const nac = (R() * 4) | 0;
      for (let a = 0; a < nac; a++) {
        const ax = -frontW / 2 + 0.8 + R() * (frontW - 1.6), ay = gf + 1.2 + ((R() * floors) | 0) * 3.6;
        B.add('metal', new THREE.BoxGeometry(0.82, 0.62, 0.34), L(ax, ay, fz + 0.3), 0x9a9ca2);
        B.add('stone', new THREE.CylinderGeometry(0.22, 0.22, 0.02, 16), L(ax + 0.12, ay, fz + 0.48, Math.PI / 2), 0x222226);
        B.add('metal', new THREE.BoxGeometry(0.7, 0.04, 0.4), L(ax, ay - 0.33, fz + 0.3), 0x55565c);
      }
      const px = (R() < 0.5 ? -1 : 1) * (frontW / 2 - 0.45);
      B.add('metal', new THREE.CylinderGeometry(0.055, 0.055, h, 8), L(px, h / 2, fz + 0.2), 0x4a4a50);
      B.add('metal', new THREE.CylinderGeometry(0.035, 0.035, h - gf, 8), L(px + 0.16, gf + (h - gf) / 2, fz + 0.18), 0x3a3a40);
      for (let y = gf + 1.5; y < h; y += 3.6) B.add('metal', new THREE.BoxGeometry(0.3, 0.05, 0.25), L(px + 0.08, y, fz + 0.12), 0x2a2a30);
      for (let l = 0; l < 3; l++) if (R() < 0.6) B.add('lamp', new THREE.BoxGeometry(0.14, 0.06, 0.08), L(-frontW / 2 + R() * frontW, gf + 0.9 + R() * (h - gf - 2), fz + 0.06), 0xffffff);
    };

    // alley — left (front faces +x) and right (front faces -x)
    for (const side of [-1, 1]) {
      let z = LAYOUT.crossZ0;
      let i = 0;
      while (z > -78) {
        const w = 5.5 + R() * 4;
        const h = 12 + R() * 22 + (i === 0 ? 6 : 0);
        const depth = 14;
        const cz = z - w / 2;
        building(side * (half + depth / 2), cz, side < 0 ? Math.PI / 2 : -Math.PI / 2, w, depth, h, { billboard: i === 0 });
        z -= w + 0.05; i++;
      }
    }
    // outer street — near side (front +z) and far side (front -z)
    for (const side of [-1, 1]) {
      let x = side * (half + 14.1);
      for (let i = 0; i < 6; i++) {
        const w = 7 + R() * 5;
        const h = 14 + R() * 20;
        const cx = x + side * w / 2;
        building(cx, LAYOUT.crossZ0 - 7, 0, w, 14, h);
        x += side * (w + 0.05);
      }
    }
    {
      let x = -60;
      while (x < 60) {
        const w = 7 + R() * 6;
        building(x + w / 2, LAYOUT.crossZ1 + 7, Math.PI, w, 14, 14 + R() * 22, { billboard: Math.abs(x) < 10 });
        x += w + 0.05;
      }
    }

    // pojangmacha (street stalls) along both edges of the alley
    this.stallPos = [];
    for (let i = 0; i < 15; i++) {
      const z = -6.0 - i * 3.3;
      for (const side of [-1, 1]) this._stall(B, side * (half - 3.6), z, side, atlas, i === 0 && side < 0);
    }

    // cables crossing the alley (catenaries)
    const pts = [];
    for (let k = 0; k < 34; k++) {
      const z = 1 - R() * 70, y0 = 5 + R() * 5, y1 = y0 + (R() - 0.5) * 1.5, sag = 0.4 + R() * 0.8, dz = (R() - 0.5) * 3;
      let prev = null;
      for (let s = 0; s <= 16; s++) {
        const t = s / 16;
        const p = new THREE.Vector3(-half + t * half * 2, y0 + (y1 - y0) * t - Math.sin(Math.PI * t) * sag, z + dz * t);
        if (prev) pts.push(prev, p);
        prev = p;
      }
    }
    const wires = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x24232b, fog: true }));
    this.scene.add(wires);

    // materials for batched geometry
    this.atlasTex = atlas.texture();
    const materials = {
      stone: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0.05, envMapIntensity: 0.4 }),
      metal: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.48, metalness: 0.65, envMapIntensity: 0.8 }),
      glass: new THREE.MeshPhysicalMaterial({ color: 0x1a2030, roughness: 0.04, metalness: 0.3, transparent: true, opacity: 0.32, clearcoat: 1, envMapIntensity: 1.4, depthWrite: false }),
      signs: new THREE.MeshBasicMaterial({ map: this.atlasTex, color: new THREE.Color(1.3, 1.22, 1.38), toneMapped: false }),
      lamp: new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 2.6, 2.1), toneMapped: false }),
      bulb: new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 2.8, 1.4), toneMapped: false }),
      canopy: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, side: THREE.DoubleSide }),
      stall: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.25 }),
    };
    B.build(materials, this.scene, { cast: false, receive: true });
    this.lampPos = lampPos;
  }

  _stall(B, x, z, side, atlas, hero = false) {
    const R = this.R;
    const ry = side < 0 ? Math.PI / 2 : -Math.PI / 2;  // counter faces the alley center
    const M = mat(x, 0, z, ry);
    if (hero) this.anchor = { x, z, ry };
    this.stallPos.push({ x, z, side, hero });
    const L = (px, py, pz, rx = 0, r2 = 0, rz = 0) => M.clone().multiply(mat(px, py, pz, r2, rx, rz));
    const W = 2.6, D = 1.5;
    const tarp = [0xb4262f, 0x1f4fa6, 0xd2691e, 0x2f7a4c, 0xc9a227][(R() * 5) | 0];
    // cart body + wheels
    B.add('stall', new THREE.BoxGeometry(W, 0.9, D), L(0, 0.55, 0), 0x9aa0a6);
    B.add('stall', new THREE.BoxGeometry(W + 0.06, 0.06, D + 0.06), L(0, 1.02, 0), 0xd8dade);
    B.add('stall', new THREE.BoxGeometry(W - 0.2, 0.3, 0.04), L(0, 0.55, D / 2 + 0.01), tarp);
    for (const wx of [-W / 2 + 0.3, W / 2 - 0.3]) B.add('stone', new THREE.CylinderGeometry(0.16, 0.16, 0.08, 14), L(wx, 0.16, D / 2 - 0.02, Math.PI / 2), 0x111113);
    // posts + canopy
    for (const [px, pz] of [[-W / 2, -D / 2], [W / 2, -D / 2], [-W / 2, D / 2 + 0.3], [W / 2, D / 2 + 0.3]]) B.add('stall', new THREE.CylinderGeometry(0.025, 0.025, 2.3, 6), L(px, 1.15 + 0.05, pz), 0x77797e);
    B.add('canopy', new THREE.BoxGeometry(W + 0.5, 0.04, D + 1.0), L(0, 2.38, 0.15, 0.12), tarp);
    for (let k = 0; k < 7; k++) B.add('canopy', new THREE.BoxGeometry((W + 0.5) / 7 - 0.02, 0.22, 0.02), L(-W / 2 - 0.25 + (k + 0.5) * (W + 0.5) / 7, 2.15, D / 2 + 0.66), k % 2 ? 0xf2efe8 : tarp);
    // goods on the counter
    for (let k = 0; k < 9; k++) {
      const gc = [0xd8452b, 0xe0a33a, 0xf2e1c0, 0x7a3b1d, 0xc23b6e][(R() * 5) | 0];
      if (hero && Math.abs(-W / 2 + 0.25 + k * 0.27) < 0.62) continue; // keep the table centre free for BRIDGE
      B.add('stall', new THREE.BoxGeometry(0.18 + R() * 0.12, 0.05 + R() * 0.08, 0.16 + R() * 0.1), L(-W / 2 + 0.25 + k * 0.27, 1.08, (R() - 0.5) * 0.7), gc);
    }
    B.add('stall', new THREE.CylinderGeometry(0.22, 0.24, 0.12, 16), L(W / 2 - 0.45, 1.11, 0), 0x2a2a2e);
    if (!hero) for (let k = 0; k < 6; k++) B.add('stall', new THREE.CylinderGeometry(0.008, 0.008, 0.4, 4), L(-0.4 + k * 0.08, 1.2, 0.3, 0.3), 0xc9a26b);
    // menu board + bulbs
    const [t, p] = STALL_MENU[(R() * STALL_MENU.length) | 0];
    const r = atlas.menu(t, p, { bg: '#f7f2e6', fg: '#b4262f' });
    B.add('signs', atlasPlane(1.1, 0.55, r), L(0, 1.85, D / 2 + 0.32), 0xffffff);
    for (let k = 0; k < 4; k++) B.add('bulb', new THREE.SphereGeometry(0.055, 8, 6), L(-W / 2 + 0.3 + k * (W - 0.6) / 3, 2.1, 0.3), 0xffffff);
    this.stallLights = this.stallLights || [];
    this.stallLights.push(new THREE.Vector3(0, 2.0, 0.4).applyMatrix4(M));
  }

  _lights() {
    const s = this.scene;
    s.add(new THREE.HemisphereLight(0x3b2f6e, 0x050508, 0.75));
    const moon = new THREE.DirectionalLight(0x7f78ff, 0.3);
    moon.position.set(-20, 40, 10);
    s.add(moon);
    // shop / sign spill lights (few, warm & cool) — product purple is kept for the product only
    const spots = [[-4.6, 3.2, -2, 0x8a6bff, 26], [4.8, 3.0, -9, 0xff7fb8, 18], [-4.7, 3.2, -16, 0x5a7dff, 24], [4.6, 3.4, -24, 0xffb070, 20], [-4.6, 3.2, -33, 0xa05cff, 24], [0, 7, 6, 0xc4b6ff, 34]];
    spots.forEach(([x, y, z, c, i]) => { const l = new THREE.PointLight(c, i, 18, 1.6); l.position.set(x, y, z); s.add(l); });
    // product key light (soft, cool) + violet rim → readable matte-plastic edges in close-ups
    const key = new THREE.SpotLight(0xe8e6ff, 38, 14, 0.55, 1, 1.4); key.position.set(4.6, 3.8, 0.4); key.target.position.set(1.95, 0.25, -4.6); s.add(key, key.target);
    const rim = new THREE.SpotLight(0xa45cff, 26, 12, 0.6, 1, 1.5); rim.position.set(-0.6, 1.4, -9); rim.target.position.set(1.95, 0.3, -3.2); s.add(rim, rim.target);
    const rimL = new THREE.SpotLight(0x6f7dff, 18, 12, 0.6, 1, 1.5); rimL.position.set(0.6, 1.4, -9); rimL.target.position.set(-1.95, 0.3, -3.2); s.add(rimL, rimL.target);
  }


  // giant neon LED screens on the facades (reference mood: wet street, pink / purple / cyan billboards)
  _screens() {
    const half = LAYOUT.alleyHalf, R = this.R;
    this.screens = [];
    const WORDS = ['2030', 'MYEONGDONG', 'K-STREET', 'NIGHT MARKET', 'BRIDGE', 'TASTE', 'SEOUL', 'LIVE'];
    const PAL = [['#ff2bd6', '#7628f5', '#29d9ff'], ['#7628f5', '#c25bff', '#ff4fa3'], ['#29d9ff', '#5a5cff', '#c5ff35'], ['#ff4fa3', '#ff2bd6', '#7628f5']];
    const art = (k) => {
      const c = document.createElement('canvas'); c.width = 1024; c.height = 512;
      const g = c.getContext('2d'), pal = PAL[k % PAL.length];
      const bg = g.createLinearGradient(0, 0, 1024, 512); bg.addColorStop(0, pal[0]); bg.addColorStop(0.55, pal[1]); bg.addColorStop(1, pal[2]);
      g.fillStyle = bg; g.fillRect(0, 0, 1024, 512);
      for (let i = 0; i < 9; i++) {                       // soft glowing shapes
        g.globalAlpha = 0.18 + R() * 0.3; g.fillStyle = pal[(R() * 3) | 0];
        g.beginPath(); g.arc(R() * 1024, R() * 512, 40 + R() * 150, 0, Math.PI * 2); g.fill();
      }
      g.globalAlpha = 0.5; g.lineWidth = 6; g.strokeStyle = '#ffffff';
      for (let i = 0; i < 6; i++) { g.beginPath(); for (let x = 0; x <= 1024; x += 16) g.lineTo(x, 80 + i * 70 + Math.sin(x * 0.012 + i * 1.7 + k) * 36); g.stroke(); }
      g.globalAlpha = 1; g.fillStyle = '#ffffff'; g.font = '900 150px Unbounded, Arial Black, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.shadowColor = pal[2]; g.shadowBlur = 40; g.fillText(WORDS[k % WORDS.length], 512, 256);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.MirroredRepeatWrapping; return t;
    };
    const spots = [[-1, -9], [-1, -25], [-1, -41], [1, -17], [1, -33], [1, -49]];
    spots.forEach(([side, z], i) => {
      const mat = new THREE.MeshBasicMaterial({ map: art(i), toneMapped: false, color: new THREE.Color(1.25, 1.25, 1.25) });
      const m = new THREE.Mesh(new THREE.PlaneGeometry(13, 6.4), mat);
      m.position.set(side * (half - 0.3), 9.6, z); m.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
      this.scene.add(m); this.screens.push(m);
      const col = PAL[i % PAL.length][i % 2 ? 2 : 0];
      const l = new THREE.PointLight(col, 26, 22, 1.6); l.position.set(side * (half - 3), 7.5, z); this.scene.add(l);
    });
  }

  update(dt, camPos) {
    this.time += dt;
    for (const m of this.screens) m.material.map.offset.x += dt * 0.025;
    this.crowd.update(dt, this.time, {
      evac: () => 0, alert: 0, data: 0,
      ambulance: { active: false, show: false, x: 0, z: 0 },
      camPos,
    });
  }
}
