import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { ProductRig, ClosedModel } from '../components/ProductRig.js';
import { createProductMaterials, ramp, smooth } from '../components/materials.js';
import { studioEnvironment, studioBackdrop, studioLights, studioFloor, ContactShadow } from '../components/StudioKit.js';
import { QUALITY } from '../config/settings.js';

/*
 * StudioScene — 프리미엄 제품 광고 스튜디오
 *  concept : 완전한 어둠 → 측면에서 보라 그레이징 라이트가 표면을 스침 → 모서리 근접 → LED 점등, X 구조 반사 → 카메라 후퇴로 전체 공개
 *  details : 닫힌 GLB(수납 구조) → 전개 → 아크릴 매크로 → 바닥 LED 반사
 */
export class StudioScene {
  constructor(renderer, assets) {
    this.renderer = renderer;
    const scene = this.scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050507);
    scene.environment = studioEnvironment(renderer);
    scene.fog = new THREE.Fog(0x060608, 9, 26);
    this.backdrop = studioBackdrop(); scene.add(this.backdrop);

    const shared = createProductMaterials('studio');
    this.shared = shared;
    this.rig = new ProductRig(assets.parts, shared, { edges: true, lights: true, lineWidth: 2.0 });
    scene.add(this.rig.root);
    this.closed = new ClosedModel(assets.closedParts, shared);
    scene.add(this.closed.root);

    let ref = null;
    if (QUALITY.reflector) ref = new Reflector(new THREE.CircleGeometry(30, 48), { textureWidth: Math.round(innerWidth * 0.5), textureHeight: Math.round(innerHeight * 0.5), color: 0x5a5866, clipBias: 0.003 });
    this.floor = studioFloor(scene, { reflect: ref });
    this.reflector = ref;
    this.L = studioLights(scene, { castShadow: QUALITY.shadows });
    scene.add(new THREE.HemisphereLight(0x8a80b0, 0x050507, 0.05));
    this.contact = new ContactShadow(renderer, scene, { width: 4.2, height: 1.6, darkness: 1.6, blur: 2.4, camHeight: 0.7 });
    this.hideForShadow = [this.backdrop, this.floor, this.rig.glowLed, this.rig.glowL, this.rig.glowR, ...(ref ? [ref] : []), ...this.rig.strips.map(s => s.lines).filter(Boolean)];
    this.time = 0;
    this.frame = 0;
  }

  update(dt, mode, q) {
    this.time += dt;
    const L = this.L;
    let light = 1, graze = 0, envK = 1;
    if (mode === 'concept') {
      // q here is the reveal progress 0..1
      graze = smooth(ramp(q, 0.0, 0.15)) * (1 - 0.6 * ramp(q, 0.55, 0.8));
      light = smooth(ramp(q, 0.12, 0.62));
      envK = 0.08 + 0.92 * light;
      this.closed.root.visible = false;
      this.rig.root.visible = true;
      this.rig.setState({ m: 1, r: 1, led: ramp(q, 0.38, 0.52), edge: ramp(q, 0.46, 0.6) });
      const sw = ramp(q, 0.0, 0.5);
      L.graze.position.set(3.4 - sw * 6.8, 0.45 + Math.sin(sw * Math.PI) * 0.25, 1.4);
      L.graze.target.position.set(1.2 - sw * 2.4, 0.3, 0);
    } else {
      const swap = ramp(q, 0.3, 0.42);
      this.closed.root.visible = swap <= 0;
      this.rig.root.visible = swap > 0;
      this.rig.setDeploy(swap);
      if (q > 0.66) this.rig.setState({ led: 1, edge: 1 });
      graze = 0.25;
      L.graze.position.set(2.6, 0.35, 1.8); L.graze.target.position.set(0, 0.1, 0);
    }
    L.set(light);
    L.graze.intensity = graze * 55;
    this.shared.body.envMapIntensity = 1.15 * envK;
    this.shared.acrylic.envMapIntensity = 1.4 * envK;
    this.backdrop.material.opacity = 1;
    // contact shadow every other frame
    if ((this.frame++ & 1) === 0) this.contact.update(this.hideForShadow);
    this.contact.plane.material.opacity = 0.85 * Math.max(0.2, light);
  }
}
