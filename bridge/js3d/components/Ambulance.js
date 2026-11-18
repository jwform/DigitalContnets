import * as THREE from 'three';
import { makeAmbulanceLivery, makeRearLivery } from './CityTextures.js';

/*
 * Ambulance — 한국형 119 구급차(고상형 승합 기반) 절차적 모델
 * 차체 측면 프로파일 압출 + 앞유리/측면창/그릴/헤드램프/경광등/바퀴(타이어·림·스포크)/미러/범퍼/도장
 * 실차 라이선스 에셋이 아닌 직접 제작한 실시간 모델입니다.
 */
export class Ambulance {
  constructor() {
    const g = this.root = new THREE.Group();
    const body = new THREE.Group();
    g.add(body);
    const paint = new THREE.MeshPhysicalMaterial({ color: 0xf2f3f4, metalness: 0.25, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.12 });
    const trim = new THREE.MeshStandardMaterial({ color: 0x17181b, roughness: 0.6, metalness: 0.2 });
    const glass = new THREE.MeshPhysicalMaterial({ color: 0x0a0d12, metalness: 0.4, roughness: 0.05, transparent: true, opacity: 0.88, clearcoat: 1 });
    const frost = new THREE.MeshStandardMaterial({ color: 0xc9ced6, roughness: 0.35, metalness: 0.1, transparent: true, opacity: 0.92 });
    const chrome = new THREE.MeshStandardMaterial({ color: 0xbfc4ca, metalness: 1, roughness: 0.22 });
    const rubber = new THREE.MeshStandardMaterial({ color: 0x0d0d0f, roughness: 0.92 });
    const head = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xf2f6ff, emissiveIntensity: 4, toneMapped: false });
    const amber = new THREE.MeshStandardMaterial({ color: 0xffa21a, emissive: 0xff8a00, emissiveIntensity: 0.6 });
    const tail = new THREE.MeshStandardMaterial({ color: 0x6a0008, emissive: 0xff1020, emissiveIntensity: 1.6, toneMapped: false });
    this.redMat = new THREE.MeshStandardMaterial({ color: 0x3a0005, emissive: 0xff1428, emissiveIntensity: 0.3, toneMapped: false });
    this.blueMat = new THREE.MeshStandardMaterial({ color: 0x00133a, emissive: 0x1d5bff, emissiveIntensity: 0.3, toneMapped: false });
    const W = 1.96, HW = W / 2;

    // --- body shell from side profile
    const s = new THREE.Shape();
    const pts = [[-2.75, 0.4], [-2.75, 2.33], [-2.66, 2.42], [1.0, 2.42], [1.22, 2.31], [2.12, 1.28], [2.6, 1.1], [2.76, 0.94], [2.8, 0.46], [2.7, 0.4]];
    s.moveTo(pts[0][0], pts[0][1]); pts.slice(1).forEach(p => s.lineTo(p[0], p[1]));
    const shell = new THREE.ExtrudeGeometry(s, { depth: W - 0.08, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.05, bevelSegments: 3, curveSegments: 4 });
    shell.translate(0, 0, -(W - 0.08) / 2);
    const shellM = new THREE.Mesh(shell, paint); shellM.castShadow = true; body.add(shellM);
    const add = (geo, m, x, y, z, rx = 0, ry = 0, rz = 0, parent = body) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); parent.add(o); return o; };

    // --- livery panels
    const liv = makeAmbulanceLivery();
    const livMat = new THREE.MeshPhysicalMaterial({ map: liv, roughness: 0.3, clearcoat: 1, metalness: 0.15, polygonOffset: true, polygonOffsetFactor: -2 });
    add(new THREE.PlaneGeometry(4.7, 1.12), livMat, -0.38, 1.0, HW + 0.012);
    add(new THREE.PlaneGeometry(4.7, 1.12), livMat, -0.38, 1.0, -HW - 0.012, 0, Math.PI, 0);
    const rearMat = new THREE.MeshPhysicalMaterial({ map: makeRearLivery(), roughness: 0.3, clearcoat: 1, polygonOffset: true, polygonOffsetFactor: -2 });
    add(new THREE.PlaneGeometry(1.84, 1.84), rearMat, -2.8 - 0.012, 1.38, 0, 0, -Math.PI / 2, 0);

    // --- glass
    const wsL = Math.hypot(0.9, 1.03), wsA = Math.atan2(1.03, -0.9);
    add(new THREE.BoxGeometry(wsL, 0.02, W - 0.16), glass, 1.67 + 0.025, 1.795 + 0.022, 0, 0, 0, wsA - Math.PI);
    for (const sd of [1, -1]) {
      const sw = new THREE.Shape(); sw.moveTo(0.25, 1.38); sw.lineTo(1.75, 1.38); sw.lineTo(1.12, 2.18); sw.lineTo(0.25, 2.18); sw.lineTo(0.25, 1.38);
      const swg = new THREE.ShapeGeometry(sw);
      const m = add(swg, glass, 0, 0, sd * (HW + 0.014)); if (sd < 0) { m.scale.z = -1; m.rotation.y = 0; }
      if (sd < 0) m.material = glass.clone(), m.material.side = THREE.DoubleSide;
      add(new THREE.BoxGeometry(2.3, 0.55, 0.02), frost, -1.35, 1.88, sd * (HW + 0.012));
      add(new THREE.BoxGeometry(0.05, 1.9, 0.02), trim, 0.18, 1.35, sd * (HW + 0.015)); // B-pillar seam
      // mirrors
      add(new THREE.BoxGeometry(0.06, 0.04, 0.25), trim, 1.95, 1.55, sd * (HW + 0.13));
      add(new THREE.BoxGeometry(0.1, 0.28, 0.16), trim, 1.95, 1.62, sd * (HW + 0.3));
      // door handles
      add(new THREE.BoxGeometry(0.22, 0.04, 0.03), trim, 1.0, 1.25, sd * (HW + 0.02));
      add(new THREE.BoxGeometry(0.22, 0.04, 0.03), trim, -0.9, 1.25, sd * (HW + 0.02));
      // side skirt + arches
      add(new THREE.BoxGeometry(5.2, 0.14, 0.04), trim, 0, 0.47, sd * (HW + 0.015));
      for (const wx of [1.78, -1.72]) {
        const arch = new THREE.Mesh(new THREE.CylinderGeometry(0.47, 0.47, 0.06, 24, 1, true, -Math.PI / 2, Math.PI), rubber);
        arch.rotation.set(Math.PI / 2, 0, 0); arch.position.set(wx, 0.38, sd * (HW - 0.0)); arch.material.side = THREE.DoubleSide; body.add(arch);
        add(new THREE.CircleGeometry(0.44, 24), rubber, wx, 0.38, sd * (HW - 0.2), 0, sd > 0 ? 0 : Math.PI, 0);
      }
      // side marker
      add(new THREE.BoxGeometry(0.12, 0.05, 0.02), amber, 2.45, 0.85, sd * (HW + 0.02));
      // tail lamps
      add(new THREE.BoxGeometry(0.06, 0.62, 0.18), tail, -2.79, 1.0, sd * (HW - 0.12));
      add(new THREE.BoxGeometry(0.06, 0.16, 0.18), amber, -2.79, 0.6, sd * (HW - 0.12));
      // headlamps
      const hl = add(new THREE.BoxGeometry(0.16, 0.16, 0.42), head, 2.68, 0.98, sd * (HW - 0.32));
      hl.rotation.y = sd * 0.12;
      add(new THREE.BoxGeometry(0.17, 0.06, 0.2), amber, 2.7, 0.87, sd * (HW - 0.2));
      add(new THREE.BoxGeometry(0.06, 0.1, 0.22), head, 2.82, 0.52, sd * (HW - 0.32));
    }
    // grille
    add(new THREE.BoxGeometry(0.06, 0.3, 1.0), trim, 2.79, 0.75, 0);
    for (let i = 0; i < 4; i++) add(new THREE.BoxGeometry(0.07, 0.025, 0.96), chrome, 2.81, 0.64 + i * 0.075, 0);
    // bumpers
    add(new THREE.BoxGeometry(0.22, 0.24, W + 0.04), trim, 2.76, 0.46, 0);
    add(new THREE.BoxGeometry(0.2, 0.22, W + 0.04), trim, -2.8, 0.45, 0);
    add(new THREE.BoxGeometry(0.02, 0.1, 0.5), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 }), 2.88, 0.48, 0); // plate
    // roof unit + light bar
    add(new THREE.BoxGeometry(1.1, 0.16, 1.1), paint, -1.2, 2.5, 0);
    add(new THREE.BoxGeometry(0.42, 0.08, 1.7), trim, 0.62, 2.46, 0);
    this.lamps = [];
    for (let i = 0; i < 6; i++) {
      const z = -0.72 + i * 0.288;
      const m = add(new THREE.BoxGeometry(0.36, 0.12, 0.25), i < 3 ? this.redMat : this.blueMat, 0.62, 2.56, z);
      this.lamps.push(m);
    }
    add(new THREE.BoxGeometry(0.2, 0.1, 1.5), this.redMat, -2.62, 2.5, 0);
    // under-body
    add(new THREE.BoxGeometry(5.0, 0.18, W - 0.2), trim, 0, 0.36, 0);

    // --- wheels
    this.wheels = [];
    const tire = new THREE.CylinderGeometry(0.36, 0.36, 0.25, 28); tire.rotateX(Math.PI / 2);
    const rim = new THREE.CylinderGeometry(0.22, 0.22, 0.26, 20); rim.rotateX(Math.PI / 2);
    const hub = new THREE.CylinderGeometry(0.06, 0.06, 0.28, 12); hub.rotateX(Math.PI / 2);
    for (const wx of [1.78, -1.72]) for (const sd of [1, -1]) {
      const w = new THREE.Group(); w.position.set(wx, 0.36, sd * (HW - 0.14));
      w.add(new THREE.Mesh(tire, rubber));
      w.add(new THREE.Mesh(rim, chrome));
      w.add(new THREE.Mesh(hub, trim));
      for (let k = 0; k < 6; k++) { const sp = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.2, 0.27), chrome); sp.rotation.z = k * Math.PI / 3; sp.position.set(Math.sin(-k * Math.PI / 3) * 0.1, Math.cos(k * Math.PI / 3) * 0.1, 0); w.add(sp); }
      body.add(w); this.wheels.push(w);
    }
    g.traverse(o => { if (o.isMesh) { o.castShadow = true; } });

    // --- lights
    this.redLight = new THREE.PointLight(0xff1a2a, 0, 16, 2); this.redLight.position.set(0.6, 2.9, -0.6); g.add(this.redLight);
    this.blueLight = new THREE.PointLight(0x2a5cff, 0, 16, 2); this.blueLight.position.set(0.6, 2.9, 0.6); g.add(this.blueLight);
    this.headLight = new THREE.SpotLight(0xf3f6ff, 0, 30, 0.55, 0.6, 1.6); this.headLight.position.set(2.9, 1.0, 0);
    this.headLight.target.position.set(10, 0, 0); g.add(this.headLight, this.headLight.target);
    this.dist = 0;
  }

  setPose(x, z, yaw) {
    const dx = x - this.root.position.x, dz = z - this.root.position.z;
    this.dist += Math.hypot(dx, dz);
    this.root.position.set(x, 0, z);
    this.root.rotation.y = yaw;
    this.wheels.forEach(w => { w.rotation.z = -this.dist / 0.36; });
  }

  update(time, on = 1) {
    const f = (time * 1.6) % 1;
    const red = (f < 0.1 || (f > 0.18 && f < 0.28)) ? 1 : 0;
    const blue = ((f > 0.5 && f < 0.6) || (f > 0.68 && f < 0.78)) ? 1 : 0;
    this.redMat.emissiveIntensity = 0.25 + red * 9 * on;
    this.blueMat.emissiveIntensity = 0.25 + blue * 9 * on;
    this.redLight.intensity = red * 60 * on;
    this.blueLight.intensity = blue * 60 * on;
    this.headLight.intensity = 90 * on;
  }
}
