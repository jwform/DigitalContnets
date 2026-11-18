import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ProductRig } from '../components/ProductRig.js';
import { createProductMaterials } from '../components/materials.js';
import { studioEnvironment, studioBackdrop, studioLights, studioFloor, ContactShadow } from '../components/StudioKit.js';
import { GradeShader } from '../fx/GradePass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { QUALITY } from '../config/settings.js';

/*
 * ViewerScene — 섹션 05 인터랙티브 3D 뷰어 (독립 WebGL 캔버스, 스튜디오 조명·컨택트 섀도·블룸)
 * Drag rotate · Scroll/Pinch zoom · Reset · OPEN/CLOSED — 두 GLB에서 계산한 실제 기구학으로 전환
 */
export class ViewerScene {
  constructor(canvas, assets) {
    this.canvas = canvas;
    const r = this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    r.setPixelRatio(QUALITY.dpr);
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.0;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    const scene = this.scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050507);
    scene.environment = studioEnvironment(r);
    this.backdrop = studioBackdrop(); scene.add(this.backdrop);

    const shared = createProductMaterials('studio');
    this.rig = new ProductRig(assets.parts, shared, { edges: true, lights: true, lineWidth: 2.0 });
    scene.add(this.rig.root);
    this.floor = studioFloor(scene);
    this.L = studioLights(scene, { castShadow: true });
    this.L.set(1);
    this.L.graze.intensity = 12;
    this.contact = new ContactShadow(r, scene, { width: 4.2, height: 1.6, darkness: 1.6, blur: 2.4, camHeight: 0.7 });
    this.hide = [this.backdrop, this.floor, this.rig.glowLed, this.rig.glowL, this.rig.glowR, ...this.rig.strips.map(s => s.lines).filter(Boolean)];

    const cam = this.camera = new THREE.PerspectiveCamera(30, 1, 0.05, 80);
    this.home = { pos: new THREE.Vector3(3.4, 1.25, 4.4), target: new THREE.Vector3(0, 0.36, 0) };
    cam.position.copy(this.home.pos);
    const c = this.controls = new OrbitControls(cam, canvas);
    c.target.copy(this.home.target);
    c.enableDamping = true; c.dampingFactor = 0.06;
    c.minDistance = 1.0; c.maxDistance = 9;
    c.maxPolarAngle = Math.PI / 2 - 0.03;
    c.enablePan = false;
    c.autoRotate = true; c.autoRotateSpeed = 0.5;
    c.addEventListener('start', () => { c.autoRotate = false; clearTimeout(this._ar); });
    c.addEventListener('end', () => { this._ar = setTimeout(() => (c.autoRotate = true), 6000); });
    c.update();

    this.composer = new EffectComposer(r);
    this.composer.addPass(new RenderPass(scene, cam));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(512, 512), 0.55, 0.5, 0.86);
    this.composer.addPass(this.bloom);
    this.grade = new ShaderPass(GradeShader);
    this.composer.addPass(this.grade);
    this.composer.addPass(new OutputPass());

    this.deploy = 1; this.targetDeploy = 1;
    this.camAnim = null;
    this.active = false;
    this.frame = 0;
    this.resize();
    this.rig.setDeploy(1);
  }

  setState(open) { this.targetDeploy = open ? 1 : 0; }

  reset() {
    this.camAnim = { t: 0, from: this.camera.position.clone(), fromT: this.controls.target.clone() };
    this.controls.autoRotate = true;
  }

  resize() {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.composer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.fov = w < 700 ? 42 : 30;
    this.camera.updateProjectionMatrix();
    this.rig.mat.edge.resolution.set(w, h);
  }

  update(dt) {
    if (!this.active) return;
    const sp = dt / 2.8;
    this.deploy += Math.max(-sp, Math.min(sp, this.targetDeploy - this.deploy));
    this.rig.setDeploy(this.deploy);
    if (this.camAnim) {
      const a = this.camAnim; a.t = Math.min(1, a.t + dt / 1.2);
      const e = a.t < 0.5 ? 4 * a.t ** 3 : 1 - (-2 * a.t + 2) ** 3 / 2;
      this.camera.position.lerpVectors(a.from, this.home.pos, e);
      this.controls.target.lerpVectors(a.fromT, this.home.target, e);
      if (a.t >= 1) this.camAnim = null;
    }
    this.controls.update();
    if ((this.frame++ & 1) === 0) this.contact.update(this.hide);
    this.grade.uniforms.uTime.value += dt;
    this.composer.render(dt);
  }
}
