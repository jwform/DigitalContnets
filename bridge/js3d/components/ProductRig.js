import * as THREE from 'three';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { MODEL_SCALE, KINEMATICS as K, COLORS } from '../config/settings.js';
import { ramp, smooth, easeInOutSine, addEdgeGlow } from './materials.js';

// 모든 LineMaterial의 해상도를 한 곳에서 갱신
export const LINE_MATERIALS = new Set();
export function setLineResolution(w, h) { LINE_MATERIALS.forEach(m => m.resolution.set(w, h)); }

let glowTex = null;
function floorGlowTexture() {
  if (glowTex) return glowTex;
  const c = document.createElement('canvas'); c.width = 256; c.height = 128;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(128, 64, 0, 128, 64, 128);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.45)'); gr.addColorStop(0.6, 'rgba(255,255,255,0.08)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 256, 128);
  glowTex = new THREE.CanvasTexture(c);
  return glowTex;
}

/*
 * ProductRig — 열린 상태 GLB의 실제 메시로 구성한 기계적 애니메이션 리그 (형상 변경 없음)
 * 부품별 개별 컨트롤: 양 끝 모듈(텔레스코픽) / 좌우 수직 패널(힌지) / 투명 스트립 A·B(패널에 힌지 연결)
 *                    바닥 LED(한쪽 끝에서 흐르며 점등) / 끝 모듈 LED / 아크릴 엣지 라이트
 * 광원 표현: LED 코어(발광) + 실제 광원(RectArea/Point, 옵션) + 바닥에 번지는 빛(바닥 글로우)
 */
export class ProductRig {
  constructor(parts, shared, { edges = true, cloneAcrylic = false, lights = false, lineWidth = 1.6 } = {}) {
    const S = MODEL_SCALE;
    this.root = new THREE.Group();
    const model = this.model = new THREE.Group();
    model.scale.setScalar(S);
    this.root.add(model);

    const bb = parts.body.boundingBox;
    const cx = (bb.min.x + bb.max.x) / 2, cz = (bb.min.z + bb.max.z) / 2;
    model.position.set(-cx * S, -bb.min.y * S, -cz * S);
    this.length = (bb.max.x - bb.min.x) * S;
    this.depth = (bb.max.z - bb.min.z) * S;
    this.toWorld = (x, y, z) => new THREE.Vector3((x - cx) * S, (y - bb.min.y) * S, (z - cz) * S);

    this.mat = {
      body: shared.body,
      led: shared.led.clone(),
      band: shared.led.clone(),
      acrylic: cloneAcrylic ? addEdgeGlow(shared.acrylic.clone()) : shared.acrylic,
      edge: new LineMaterial({ color: shared.edge.color, linewidth: lineWidth, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }),
    };
    LINE_MATERIALS.add(this.mat.edge);
    this.mat.edge.resolution.set(innerWidth, innerHeight);
    const add = (geo, mat, parent) => {
      const m = new THREE.Mesh(geo, mat);
      m.castShadow = true; m.receiveShadow = true;
      parent.add(m); return m;
    };

    add(parts.body, this.mat.body, model);

    this.mods = {};
    for (const side of ['L', 'R']) {
      this.mods[side] = {
        body: add(parts['mod' + side], this.mat.body, model),
        band: add(parts['band' + side], this.mat.band, model),
        top: add(parts['top' + side], this.mat.body, model),
      };
      this.mods[side].band.castShadow = false;
    }

    this.pivots = {};
    this.strips = [];
    for (const side of ['L', 'R']) {
      const pv = side === 'L' ? K.pivotL : K.pivotR;
      const g = new THREE.Group();
      g.position.set(pv[0], pv[1], 0);
      model.add(g);
      const panel = add(parts['panel' + side], this.mat.body, g);
      panel.position.set(-pv[0], -pv[1], 0);
      this.pivots[side] = g;
      parts['strip' + side].forEach(geo => this._strip(geo, g, pv, side, edges));
    }

    const lb = parts.ledFloor.boundingBox;
    const lp = new THREE.Group();
    lp.position.set(lb.min.x, (lb.min.y + lb.max.y) / 2, (lb.min.z + lb.max.z) / 2);
    model.add(lp);
    const ledMesh = add(parts.ledFloor, this.mat.led, lp);
    ledMesh.position.set(-lb.min.x, -(lb.min.y + lb.max.y) / 2, -(lb.min.z + lb.max.z) / 2);
    ledMesh.castShadow = false;
    this.ledPivot = lp;
    this.ledBox = lb;

    // ---- light pooling on the floor (lighting effect, not product geometry)
    const gt = floorGlowTexture();
    const mk = (w, d, x, z) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ map: gt, color: new THREE.Color(0x9b45ff), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
      m.rotation.x = -Math.PI / 2; m.position.set(x, 0.004, z); m.renderOrder = 1;
      this.root.add(m); return m;
    };
    const ledC = this.toWorld((lb.min.x + lb.max.x) / 2, 0, (lb.min.z + lb.max.z) / 2);
    this.glowLed = mk((lb.max.x - lb.min.x) * S * 1.35, 1.5, ledC.x, ledC.z);
    const bL = parts.bandL.boundingBox, bR = parts.bandR.boundingBox;
    const cL = this.toWorld((bL.min.x + bL.max.x) / 2, 0, (bL.min.z + bL.max.z) / 2);
    const cR = this.toWorld((bR.min.x + bR.max.x) / 2, 0, (bR.min.z + bR.max.z) / 2);
    this.glowL = mk(1.1, 1.0, cL.x, cL.z);
    this.glowR = mk(1.1, 1.0, cR.x, cR.z);
    this.bandPos = [cL, cR];

    // ---- real light sources (studio / viewer)
    this.lights = null;
    if (lights) {
      const len = (lb.max.x - lb.min.x) * S;
      const ra = new THREE.RectAreaLight(0xa45cff, 0, len, 0.06);
      ra.position.set(ledC.x, 0.06, ledC.z);
      ra.lookAt(ledC.x, 2, ledC.z);
      const ra2 = new THREE.RectAreaLight(0xa45cff, 0, len, 0.06);
      ra2.position.set(ledC.x, 0.08, ledC.z);
      ra2.lookAt(ledC.x, 0.08, ledC.z + 3);
      const ra3 = ra2.clone(); ra3.lookAt(ledC.x, 0.08, ledC.z - 3);
      const pL = new THREE.PointLight(0xa45cff, 0, 2.2, 2); pL.position.set(cL.x, 0.22, cL.z);
      const pR = new THREE.PointLight(0xa45cff, 0, 2.2, 2); pR.position.set(cR.x, 0.22, cR.z);
      this.root.add(ra, ra2, ra3, pL, pR);
      this.lights = { ra, ra2, ra3, pL, pR };
    }

    this.state = { m: 0, r: 0, led: 0, edge: 0 };
    this.standby = 0.12;
    this.setState(this.state);
  }

  _strip(geo, pivot, pv, side, edges) {
    const bb = geo.boundingBox;
    const cy = (bb.min.y + bb.max.y) / 2;
    const ax = side === 'L' ? bb.min.x : bb.max.x;
    const fx = side === 'L' ? bb.max.x : bb.min.x;
    const low = cy < K.panelMidY;
    const ay = low ? bb.min.y : bb.max.y;
    const fy = low ? bb.max.y : bb.min.y;
    const hinge = new THREE.Group();
    hinge.position.set(ax - pv[0], ay - pv[1], 0);
    pivot.add(hinge);
    const mesh = new THREE.Mesh(geo, this.mat.acrylic);
    mesh.position.set(-ax, -ay, 0);
    mesh.renderOrder = 2;
    hinge.add(mesh);
    let lines = null;
    if (edges) {
      const lg = new LineSegmentsGeometry().fromEdgesGeometry(new THREE.EdgesGeometry(geo, 25));
      lines = new LineSegments2(lg, this.mat.edge);
      lines.position.copy(mesh.position);
      lines.renderOrder = 3;
      hinge.add(lines);
    }
    const phi = Math.atan2(fy - ay, fx - ax);
    const psi = fy > ay ? Math.PI / 2 : -Math.PI / 2;
    let delta = psi - phi;
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;
    this.strips.push({ hinge, delta, mesh, lines });
  }

  setState(s) {
    Object.assign(this.state, s);
    const { m, r, led, edge } = this.state;
    const mm = smooth(Math.min(1, Math.max(0, m)));
    for (const side of ['L', 'R']) {
      const d = this.mods[side];
      d.body.position.y = -(1 - mm) * K.liftBody;
      d.band.position.y = -(1 - mm) * K.liftBand;
      d.top.position.y = -(1 - mm) * K.liftTop;
    }
    this.mat.band.emissiveIntensity = this.standby + mm * 3.4;

    const e = easeInOutSine(Math.min(1, Math.max(0, r)));
    this.pivots.L.rotation.z = -Math.PI / 2 * (1 - e);
    this.pivots.R.rotation.z = Math.PI / 2 * (1 - e);
    const u = smooth(ramp(r, 0.04, 0.96));
    const vis = r > 0.003;
    for (const st of this.strips) {
      st.hinge.rotation.z = st.delta * (1 - u);
      st.hinge.visible = vis;
    }

    const l = Math.min(1, Math.max(0, led));
    this.ledPivot.scale.x = Math.max(0.0001, smooth(l));
    this.ledPivot.visible = l > 0.001;
    const li = Math.min(1, l * 3);
    this.mat.led.emissiveIntensity = 4.2 * li;

    const ed = Math.min(1, Math.max(0, edge));
    this.mat.edge.opacity = ed * 0.9;
    this.mat.acrylic.userData.edge.value = ed * 1.4;

    // floor light + real lights
    this.glowLed.material.opacity = 0.55 * li * smooth(l);
    this.glowLed.scale.x = Math.max(0.05, smooth(l));
    this.glowLed.position.x = this.glowLedBaseX ?? (this.glowLedBaseX = this.glowLed.position.x);
    this.glowLed.position.x = this.glowLedBaseX - (1 - Math.max(0.05, smooth(l))) * this.glowLed.geometry.parameters.width * 0.5;
    this.glowL.material.opacity = this.glowR.material.opacity = 0.05 + mm * 0.4;
    if (this.lights) {
      this.lights.ra.intensity = 26 * li;
      this.lights.ra2.intensity = this.lights.ra3.intensity = 10 * li;
      this.lights.pL.intensity = this.lights.pR.intensity = 0.6 + mm * 2.2;
    }
  }

  setDeploy(t) {
    this.setState({ m: ramp(t, 0.0, 0.28), r: ramp(t, 0.3, 0.8), led: ramp(t, 0.8, 0.94), edge: ramp(t, 0.88, 1.0) });
  }

  glowStrength() {
    return Math.max(this.mat.led.emissiveIntensity / 4.2, (this.mat.band.emissiveIntensity - this.standby) / 3.4 * 0.5);
  }
}

export class ClosedModel {
  constructor(closedParts, shared) {
    const S = MODEL_SCALE;
    this.root = new THREE.Group();
    const model = new THREE.Group();
    model.scale.setScalar(S);
    this.root.add(model);
    const bb = closedParts.body.boundingBox;
    model.position.set(-(bb.min.x + bb.max.x) / 2 * S, -bb.min.y * S, -(bb.min.z + bb.max.z) / 2 * S);
    const body = new THREE.Mesh(closedParts.body, shared.body);
    body.castShadow = body.receiveShadow = true;
    this.bandMat = shared.led.clone();
    this.bandMat.emissiveIntensity = 0.7;
    model.add(body, new THREE.Mesh(closedParts.bands, this.bandMat), new THREE.Mesh(closedParts.led, this.bandMat));
  }
}
