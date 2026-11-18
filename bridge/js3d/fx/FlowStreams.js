import * as THREE from 'three';
import { QUALITY } from '../config/settings.js';
import { rng } from '../core/batch.js';

/*
 * FlowStreams — 추상 빛의 흐름으로 표현한 "도시의 통행"
 *  PROBLEM : 수많은 얇은 보라색 빛이 서로 다른 방향으로 이동 (scatter)
 *            → 점차 한 방향·한 지점으로 모이며 (converge) 교차로 입구에서 정체 (jam: 짧아지고 촘촘해짐)
 *            → 한 줄기의 강한 보라색 빛이 막힌 흐름을 가로지르며 새로운 통행 경로를 만듦 (beam)
 *  CONCEPT : 도시가 먼저 반응 → 흐름이 양옆으로 갈라지며 중앙 통로가 열림 (open)
 *  각 빛줄기 = GPU 리본 (밝은 코어 + 넓은 글로우, 머리 플레어, 꼬리 감쇠)
 */
const VERT = /* glsl */`
  attribute float aU; attribute float aSide;
  attribute vec4 iA; // head x, y, z, length
  attribute vec4 iB; // width, hue, bright, kind (0 flow / 1 beam)
  attribute vec4 iC; // dir x, dir z, fade, -
  uniform float uOpen, uTime;
  varying float vU, vV, vHue, vBright, vKind, vZ, vFade;
  void main(){
    vec3 dir = normalize(vec3(iC.x, 0.0, iC.y));
    vec3 p = iA.xyz - dir * aU * iA.w;
    // lane opening: push flows sideways away from the centre near the entrance
    float near = smoothstep(-70.0, -5.0, p.z);
    float s = sign(p.x + 0.0001);
    p.x += s * uOpen * near * max(0.0, 3.2 - abs(p.x)) * 1.05 * (1.0 - iB.w);
    p.y += sin(p.z * 0.08 + uTime * 0.4 + iA.x * 3.0) * 0.05;
    vec3 side = normalize(cross(dir, vec3(0.0, 1.0, 0.0)));
    vec3 wv = mix(vec3(0.0, 1.0, 0.0), side, 0.35);
    p += wv * aSide * iB.x * 0.5;
    vU = aU; vV = aSide; vHue = iB.y; vBright = iB.z; vKind = iB.w; vZ = p.z; vFade = iC.z;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }`;
const FRAG = /* glsl */`
  uniform float uGain, uBeam;
  uniform vec3 uDeep, uPurple, uBlue, uWhite;
  varying float vU, vV, vHue, vBright, vKind, vZ, vFade;
  void main(){
    float tail = pow(1.0 - vU, 1.8) + exp(-vU * 18.0) * 0.8;
    float v2 = vV * vV;
    float core = exp(-v2 * 60.0);
    float I = (core + exp(-v2 * 4.0) * 0.28) * tail;
    float far = smoothstep(-160.0, -45.0, vZ) * smoothstep(18.0, 6.0, vZ);
    vec3 col = mix(mix(uDeep, uPurple, vHue), uBlue, smoothstep(0.84, 1.0, vHue));
    col += uWhite * core * exp(-vU * 10.0) * 0.55;
    float b = vBright;
    if (vKind > 0.5) {
      col = mix(uPurple * 1.6, uWhite, core * 0.75) * 1.8;
      b *= uBeam;
      I = (core * 1.3 + exp(-v2 * 3.0) * 0.5) * (pow(1.0 - vU, 1.2) + exp(-vU * 12.0));
    }
    gl_FragColor = vec4(col * I * b * far * vFade * uGain, 1.0);
  }`;

export class FlowStreams {
  constructor() {
    const scene = this.scene = new THREE.Scene();
    scene.background = new THREE.Color(0x020204);
    const R = rng(77);
    const N = QUALITY.mobile ? 280 : 560;
    const S = 48;
    this.s = [];
    for (let i = 0; i < N; i++) {
      const lx = (R() * 2 - 1) * (R() < 0.7 ? 5.5 : 9);
      const ang = R() * Math.PI * 2;
      this.s.push({
        lx, y: 0.08 + Math.pow(R(), 2) * 2.4, d: R() * 150, len: 4 + R() * 9, v: 9 + R() * 16,
        // scattered state: own origin + own heading
        ox: (R() * 2 - 1) * 26, oz: -10 - R() * 70, dx: Math.cos(ang), dz: Math.sin(ang),
        w: 0.06 + R() * 0.22 * (1 + Math.abs(lx) * 0.06), hue: R(), b: 0.35 + R() * 0.9, kind: 0, delay: R() * 0.35,
      });
    }
    for (let i = 0; i < 3; i++) this.s.push({ lx: (i - 1) * 0.1, y: 0.55 + i * 0.05, d: -20 - i * 8, len: 16, v: 46, w: 0.2 - i * 0.04, hue: 1, b: 1.5 - i * 0.3, kind: 1, ox: 0, oz: 0, dx: 0, dz: -1, delay: 0 });
    const n = this.s.length;
    const geo = new THREE.InstancedBufferGeometry();
    const u = [], side = [], idx = [];
    for (let k = 0; k <= S; k++) { u.push(k / S, k / S); side.push(-1, 1); }
    for (let k = 0; k < S; k++) { const a = k * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    geo.setIndex(idx);
    geo.setAttribute('position', new THREE.Float32BufferAttribute(new Array((S + 1) * 6).fill(0), 3));
    geo.setAttribute('aU', new THREE.Float32BufferAttribute(u, 1));
    geo.setAttribute('aSide', new THREE.Float32BufferAttribute(side, 1));
    this.A = new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4).setUsage(THREE.DynamicDrawUsage);
    this.B = new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4);
    this.C = new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('iA', this.A); geo.setAttribute('iB', this.B); geo.setAttribute('iC', this.C);
    geo.instanceCount = n;
    this.s.forEach((s, i) => this.B.array.set([s.w, s.hue, s.b, s.kind], i * 4));
    this.uniforms = {
      uOpen: { value: 0 }, uTime: { value: 0 }, uGain: { value: 1 }, uBeam: { value: 0 },
      uDeep: { value: new THREE.Color(0x2a0a6e) }, uPurple: { value: new THREE.Color(0x9b35ff) },
      uBlue: { value: new THREE.Color(0x5f8cff) }, uWhite: { value: new THREE.Color(0xf6f0ff) },
    };
    const mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: this.uniforms, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false;
    scene.add(mesh);
    this.time = 0;
  }

  /* scatter→converge 0..1, jam 0..1, beam 0..1, open 0..1 */
  update(dt, { converge = 1, jam = 0, beam = 0, open = 0, gain = 1 }) {
    this.time += dt;
    dt = Math.min(dt, 0.05);
    const U = this.uniforms;
    U.uOpen.value = open; U.uTime.value = this.time; U.uGain.value = gain; U.uBeam.value = beam;
    const a = this.A.array, c = this.C.array;
    const W = 160;  // travel window
    this.s.forEach((s, i) => {
      const cv = Math.min(1, Math.max(0, (converge - s.delay) / (1 - s.delay)));
      const k = cv * cv * (3 - 2 * cv);
      // lane position (converged): head z = 14 - d
      const lz = 14 - s.d;
      let f = 1;
      if (s.kind === 0) {
        const nearGate = Math.exp(-Math.pow((lz + 2) / 9, 2));
        const centre = Math.max(0, 1 - Math.abs(s.lx) / 4.5);
        f = 1 - jam * k * nearGate * (0.62 + 0.35 * centre) + open * 0.35;
      }
      s.d += s.v * Math.max(0.03, f) * dt;
      if (s.d > W) s.d -= W;
      const lzz = 14 - s.d;
      // scattered position: travel along own heading inside a box
      const t = s.d - W / 2;
      const sx = s.ox + s.dx * t * 0.6, sz = s.oz + s.dz * t * 0.6;
      const hx = s.kind ? s.lx : sx + (s.lx - sx) * k;
      const hz = s.kind ? lzz : sz + (lzz - sz) * k;
      let dx = s.kind ? 0 : s.dx + (0 - s.dx) * k, dz = s.kind ? -1 : s.dz + (-1 - s.dz) * k;
      const dl = Math.hypot(dx, dz) || 1; dx /= dl; dz /= dl;
      const len = s.len * (s.kind ? 1 : Math.max(0.22, f));
      // fade at the ends of the travel window (hides recycling)
      const fade = Math.max(0, Math.min(1, s.d / 10) * Math.min(1, (W - s.d) / 14));
      a[i * 4] = hx; a[i * 4 + 1] = s.y; a[i * 4 + 2] = hz; a[i * 4 + 3] = len;
      c[i * 4] = dx; c[i * 4 + 1] = dz; c[i * 4 + 2] = fade;
    });
    this.A.needsUpdate = true; this.C.needsUpdate = true;
  }
}
