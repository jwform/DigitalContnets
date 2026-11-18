import * as THREE from 'three';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { HorizontalBlurShader } from 'three/addons/shaders/HorizontalBlurShader.js';
import { VerticalBlurShader } from 'three/addons/shaders/VerticalBlurShader.js';
import { COLORS } from '../config/settings.js';

let rectInit = false;
export function initRectLights() { if (!rectInit) { RectAreaLightUniformsLib.init(); rectInit = true; } }

/*
 * 제품 스튜디오 환경 (KeyShot 스타일)
 * - 반사용 환경맵: 큰 소프트박스(좌상단), 얇은 스트립 라이트(상단 하이라이트), 보라 바운스, 중성 필 → 무광 플라스틱의 부드러운 명암
 * - 실제 조명: 소프트박스 키(RectArea), 바이올렛 림(RectArea 뒤쪽), 중성 필(약하게), 상단 스트립(모서리 하이라이트)
 * - 배경: 어두운 차콜 그라데이션 + 바닥 쪽의 은은한 보라 바운스
 * - 바닥: 약한 반사 + 부드러운 컨택트 섀도
 */
export function studioEnvironment(renderer) {
  const env = new THREE.Scene();
  env.background = new THREE.Color(0x060608);
  const panel = (color, inten, w, h, pos, look) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(inten), side: THREE.DoubleSide }));
    m.position.set(...pos); m.lookAt(...look); env.add(m);
  };
  panel(0xffffff, 2.4, 7, 5, [-5, 6, 4], [0, 0, 0]);        // big softbox key
  panel(0xffffff, 3.0, 9, 0.35, [0, 7, 0], [0, 0, 0]);       // top strip → thin edge highlights
  panel(0xb07cff, 1.4, 6, 3, [5, 2.5, -5], [0, 0, 0]);       // violet rim bounce
  panel(0x7d8cff, 0.5, 4, 2, [-6, 1.5, -5], [0, 0, 0]);      // cool back
  panel(0xd8d4e0, 0.35, 8, 3, [4, 1, 6], [0, 0, 0]);         // neutral fill
  panel(0x6a2cc0, 0.35, 20, 20, [0, -2, 0], [0, 0, 0]);      // purple floor bounce
  const pm = new THREE.PMREMGenerator(renderer);
  const tex = pm.fromScene(env, 0.035).texture;
  pm.dispose();
  return tex;
}

export function studioBackdrop() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 512;
  const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 512);
  gr.addColorStop(0, '#040406'); gr.addColorStop(0.55, '#0d0c12'); gr.addColorStop(0.78, '#16121f'); gr.addColorStop(1, '#0a090d');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 512);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.SphereGeometry(40, 32, 24), new THREE.MeshBasicMaterial({ map: t, side: THREE.BackSide, fog: false, depthWrite: false }));
  m.renderOrder = -10;
  return m;
}

export function studioLights(scene, { castShadow = true } = {}) {
  initRectLights();
  const L = {};
  L.key = new THREE.RectAreaLight(0xfff7f0, 0, 3.2, 2.2);          // large softbox
  L.key.position.set(-2.6, 3.0, 2.6); L.key.lookAt(0, 0.3, 0);
  L.top = new THREE.RectAreaLight(0xffffff, 0, 4.5, 0.25);         // strip for edge highlights
  L.top.position.set(0.2, 2.6, 0.6); L.top.lookAt(0.2, 0, 0.1);
  L.rim = new THREE.RectAreaLight(0xa060ff, 0, 3.5, 1.2);          // violet rim from behind
  L.rim.position.set(1.8, 1.1, -2.4); L.rim.lookAt(0, 0.4, 0);
  L.rim2 = new THREE.RectAreaLight(0x6f7dff, 0, 2.5, 0.8);         // cool kicker
  L.rim2.position.set(-2.8, 0.7, -1.8); L.rim2.lookAt(0, 0.3, 0);
  L.fill = new THREE.RectAreaLight(0xd9d6e6, 0, 3, 2);             // subtle neutral fill
  L.fill.position.set(3.2, 0.9, 2.8); L.fill.lookAt(0, 0.3, 0);
  // shadow caster from the key direction (soft)
  L.shadow = new THREE.DirectionalLight(0xffffff, 0);
  L.shadow.position.set(-2.6, 5, 2.2); L.shadow.castShadow = castShadow;
  L.shadow.shadow.mapSize.set(2048, 2048); L.shadow.shadow.radius = 6; L.shadow.shadow.bias = -0.0004;
  Object.assign(L.shadow.shadow.camera, { left: -2.5, right: 2.5, top: 2.5, bottom: -2.5, near: 0.5, far: 12 });
  // grazing violet light for the reveal (sweeps across the surface)
  L.graze = new THREE.SpotLight(0xa45cff, 0, 9, 0.35, 1, 1.4);
  L.graze.position.set(3.5, 0.5, 1.5); L.graze.target.position.set(0, 0.3, 0);
  scene.add(L.key, L.top, L.rim, L.rim2, L.fill, L.shadow, L.graze, L.graze.target);
  L.set = (k = 1) => {
    L.key.intensity = 6.5 * k; L.top.intensity = 9 * k; L.rim.intensity = 14 * k; L.rim2.intensity = 5 * k;
    L.fill.intensity = 1.1 * k; L.shadow.intensity = 0.35 * k;
  };
  return L;
}

export function studioFloor(scene, { reflect = null } = {}) {
  const floor = new THREE.Mesh(new THREE.CircleGeometry(30, 64), new THREE.MeshStandardMaterial({
    color: 0x0b0a0e, roughness: 0.42, metalness: 0.0, transparent: !!reflect, opacity: reflect ? 0.86 : 1, envMapIntensity: 0.35,
  }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true;
  scene.add(floor);
  if (reflect) { reflect.rotation.x = -Math.PI / 2; reflect.position.y = -0.002; scene.add(reflect); }
  return floor;
}

/*
 * ContactShadow — 바닥에 닿는 부분이 진하고 멀어질수록 퍼지는 부드러운 접촉 그림자 (three.js 예제 방식)
 */
export class ContactShadow {
  constructor(renderer, scene, { width = 4, height = 2, res = 512, darkness = 1.4, blur = 2.2, camHeight = 0.6, opacity = 0.85 } = {}) {
    this.renderer = renderer; this.scene = scene; this.blur = blur;
    this.group = new THREE.Group(); this.group.position.y = 0.001;
    scene.add(this.group);
    this.rt = new THREE.WebGLRenderTarget(res, res * height / width); this.rt.texture.generateMipmaps = false;
    this.rtBlur = new THREE.WebGLRenderTarget(res, res * height / width); this.rtBlur.texture.generateMipmaps = false;
    const planeGeo = new THREE.PlaneGeometry(width, height).rotateX(Math.PI / 2);
    this.plane = new THREE.Mesh(planeGeo, new THREE.MeshBasicMaterial({ map: this.rt.texture, opacity, transparent: true, depthWrite: false }));
    this.plane.renderOrder = 1; this.plane.scale.y = -1;
    this.group.add(this.plane);
    this.blurPlane = new THREE.Mesh(planeGeo); this.blurPlane.visible = false; this.group.add(this.blurPlane);
    this.cam = new THREE.OrthographicCamera(-width / 2, width / 2, height / 2, -height / 2, 0, camHeight);
    this.cam.rotation.x = Math.PI / 2; this.group.add(this.cam);
    this.depth = new THREE.MeshDepthMaterial();
    this.depth.userData.darkness = { value: darkness };
    this.depth.onBeforeCompile = sh => {
      sh.uniforms.darkness = this.depth.userData.darkness;
      sh.fragmentShader = `uniform float darkness;\n${sh.fragmentShader.replace('gl_FragColor = vec4( vec3( 1.0 - fragCoordZ ), opacity );', 'gl_FragColor = vec4( vec3( 0.0 ), ( 1.0 - fragCoordZ ) * darkness );')}`;
    };
    this.depth.depthTest = false; this.depth.depthWrite = false;
    this.hb = new THREE.ShaderMaterial(HorizontalBlurShader); this.hb.depthTest = false;
    this.vb = new THREE.ShaderMaterial(VerticalBlurShader); this.vb.depthTest = false;
    this.hidden = [];
  }
  _blur(amount) {
    this.blurPlane.visible = true;
    this.blurPlane.material = this.hb; this.hb.uniforms.tDiffuse.value = this.rt.texture; this.hb.uniforms.h.value = amount / 256;
    this.renderer.setRenderTarget(this.rtBlur); this.renderer.render(this.blurPlane, this.cam);
    this.blurPlane.material = this.vb; this.vb.uniforms.tDiffuse.value = this.rtBlur.texture; this.vb.uniforms.v.value = amount / 256;
    this.renderer.setRenderTarget(this.rt); this.renderer.render(this.blurPlane, this.cam);
    this.blurPlane.visible = false;
  }
  update(hide = []) {
    const r = this.renderer, s = this.scene;
    const bg = s.background, fog = s.fog;
    s.background = null; s.fog = null;
    hide.forEach(o => { o.userData._v = o.visible; o.visible = false; });
    this.plane.visible = false;
    s.overrideMaterial = this.depth;
    const ac = r.autoClear; r.autoClear = true;
    const prevClear = r.getClearAlpha(); r.setClearAlpha(0);
    r.setRenderTarget(this.rt); r.clear(); r.render(s, this.cam);
    s.overrideMaterial = null;
    this._blur(this.blur); this._blur(this.blur * 0.4);
    r.setRenderTarget(null); r.setClearAlpha(prevClear); r.autoClear = ac;
    this.plane.visible = true;
    hide.forEach(o => { o.visible = o.userData._v; });
    s.background = bg; s.fog = fog;
  }
}
