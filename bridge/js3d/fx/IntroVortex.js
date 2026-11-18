import * as THREE from 'three';
import { QUALITY } from '../config/settings.js';
import { rng } from '../core/batch.js';

/*
 * IntroVortex — 수백 겹의 빛 리본이 겹쳐 만드는 거대한 원형 빛 구조물 (GPU)
 *  - 각 빛줄기 = 인스턴스 리본(밝은 코어 + 부드러운 글로우 프로파일, 머리→꼬리 감쇠)
 *  - 깔때기형 공간: 밝은 안쪽 림 → 바깥으로 낮아지는 수백 개의 동심 궤적, 중심은 어둡고 깊은 우물
 *  - 월드 고정 핫스팟: 오른쪽은 백색-바이올렛, 왼쪽은 아이스 블루 → 빛이 회전하며 그 구간을 지날 때만 강하게 빛남
 *  - 반경별 속도 차 (가까운 빛은 빠르고 먼 빛은 느림), 스크롤로 회전·꼬리 길이·기울기·카메라 연동
 *  - 몰입 단계용 빛 터널(깊은 우물 아래로 수백 m 이어지는 링)
 */
const VERT = /* glsl */`
  attribute float aU; attribute float aSide;
  attribute vec4 iA;   // radius, y, phase, arc
  attribute vec4 iB;   // speed, width, hue, bright
  attribute vec4 iC;   // wobble, kind(0 rim/1 outer/2 well/3 tunnel), seed, spare
  uniform float uRot, uTrail, uTime, uIgnite, uWave, uStretch;
  varying float vU, vV, vAng, vBright, vHue, vKind, vR, vFade;
  void main(){
    float r = iA.x;
    if (iC.y > 3.5) {
      // longitudinal light streaks along the tunnel axis — they rush past the camera during the suction
      float th = iA.z + uRot * iB.x * 0.25;
      float len = iA.w * (1.0 + uStretch);
      vec3 q = vec3(cos(th) * r, iA.y + aU * len, sin(th) * r);
      q += vec3(-sin(th), 0.0, cos(th)) * aSide * iB.y * 0.5;
      vU = aU; vV = aSide; vAng = th; vBright = iB.w; vHue = iB.z; vKind = iC.y; vR = min(r, 12.0); vFade = 1.0;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(q, 1.0);
      return;
    }
    float arc = min(iA.w * uTrail, 6.1);
    float ang = iA.z + uRot * iB.x - aU * arc;
    float y = iA.y + sin(ang * 2.0 + uTime * 0.35 + iC.x) * uWave * (0.04 + 0.012 * r);
    vec3 p = vec3(cos(ang) * r, y, sin(ang) * r);
    // ribbon lies on the funnel surface (radial direction); tunnel rings face the axis
    vec3 dir = iC.y > 2.5 ? vec3(0.0, 1.0, 0.0) : normalize(vec3(cos(ang), -0.22, sin(ang)));
    p += dir * aSide * iB.y * 0.5;
    vU = aU; vV = aSide; vAng = ang; vBright = iB.w; vHue = iB.z; vKind = iC.y; vR = r;
    // ignite: strands appear around the circle like a sweep of light
    float ig = clamp((uIgnite * 8.0 - fract((iA.z + 3.14159) / 6.28318) * 6.0 - iC.z * 0.6), 0.0, 1.0);
    vFade = ig;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }`;

const FRAG = /* glsl */`
  uniform float uHotA, uHotB, uGain, uSpeedGlow, uRush, uFade;
  uniform vec3 uDeep, uPurple, uBlue, uWhite;
  varying float vU, vV, vAng, vBright, vHue, vKind, vR, vFade;
  void main(){
    float tail = pow(1.0 - vU, 1.7);
    float head = exp(-vU * 26.0) * 0.9;
    float v2 = vV * vV;
    float core = exp(-v2 * 70.0);
    float glow = exp(-v2 * 5.0) * 0.32;
    float hA = pow(0.5 + 0.5 * cos(vAng - uHotA), 9.0);
    float hB = pow(0.5 + 0.5 * cos(vAng - uHotB), 12.0);
    float hC = pow(0.5 + 0.5 * cos(vAng - uHotA + 2.2), 16.0) * 0.5;
    vec3 base = mix(uDeep, uPurple, vHue);
    vec3 col = base * (0.16 + 1.25 * hA + 0.35 * hC)
             + uBlue * (hB * 1.5 + 0.08 * vHue)
             + uWhite * (pow(hA, 3.0) * 1.6 + pow(hB, 4.0) * 0.8) * core;
    float kind = vKind;
    float k = kind < 0.5 ? 1.25 : kind < 1.5 ? 0.85 : kind < 2.5 ? 0.38 + uRush * 0.5 : kind < 3.5 ? 0.35 + uRush * 0.9 : uRush * 1.3;
    if (kind > 3.5) { col = mix(uPurple, uWhite, core * 0.6) * (0.6 + 0.6 * hB) + uBlue * hB * 0.6; tail = pow(1.0 - abs(vU * 2.0 - 1.0), 1.5); }
    float edgeFade = smoothstep(26.0, 15.0, vR);
    float I = (core + glow) * (tail + head) * vBright * k * edgeFade * vFade * uGain * uFade * (1.0 + uSpeedGlow * head);
    gl_FragColor = vec4(col * I, 1.0);
  }`;

export class IntroVortex {
  constructor() {
    const scene = this.scene = new THREE.Scene();
    scene.background = new THREE.Color(0x020204);
    this.group = new THREE.Group();
    scene.add(this.group);
    const R = rng(2030);
    const S = QUALITY.mobile ? 64 : 110;          // segments per strand
    const counts = QUALITY.mobile
      ? { rim: 150, outer: 170, well: 70, tunnel: 130 }
      : { rim: 300, outer: 340, well: 140, tunnel: 260 };
    const strands = [];
    const R0 = 7.2;
    const add = (kind, r, y, arc, speed, width, hue, bright) =>
      strands.push([r, y, R() * Math.PI * 2, arc, speed, width, hue, bright, R() * 6.28, kind, R()]);
    for (let i = 0; i < counts.rim; i++) {           // bright inner rim, very dense
      const r = R0 + Math.pow(R(), 1.8) * 2.6;
      add(0, r, -Math.pow(r - R0, 1.2) * 0.2, 1.2 + R() * 3.6, 1.15 - (r - R0) * 0.04 + (R() - 0.5) * 0.25,
        0.05 + R() * 0.16, R(), 0.55 + R() * 0.9);
    }
    for (let i = 0; i < counts.outer; i++) {         // outer layered descending paths
      const r = R0 + 2 + Math.pow(R(), 0.9) * 16;
      add(1, r, -Math.pow(r - R0, 1.15) * 0.22, 0.8 + R() * 3.0, 0.95 - (r - R0) * 0.03 + (R() - 0.5) * 0.2,
        0.08 + R() * 0.32 * (r / 14), R(), 0.25 + R() * 0.75);
    }
    for (let i = 0; i < counts.well; i++) {          // dark deep well inside the rim
      const t = R();
      const r = R0 - 0.2 - t * 3.6;
      add(2, r, -Math.pow(t, 1.4) * 9 - 0.2, 1.5 + R() * 4, 1.3 + (R() - 0.5) * 0.3, 0.04 + R() * 0.1, R(), 0.3 + R() * 0.7);
    }
    for (let i = 0; i < counts.tunnel; i++) {        // immersion tunnel
      const y = -6 - Math.pow(R(), 0.9) * 360;
      add(3, 2.6 + R() * 3.4, y, 2 + R() * 4, 1.6 + R() * 0.6, 0.05 + R() * 0.25, R(), 0.35 + R() * 0.8);
    }
    const nStreak = QUALITY.mobile ? 160 : 360;
    for (let i = 0; i < nStreak; i++) {             // rush streaks along the axis (inside the rim and the tunnel)
      const y = 4 - Math.pow(R(), 0.85) * 380;
      add(4, 1.6 + Math.pow(R(), 0.7) * 7.5, y, 4 + R() * 16, 0.6 + R() * 0.8, 0.02 + R() * 0.07, R(), 0.35 + R() * 0.9);
    }
    this.count = strands.length;

    const base = new THREE.BufferGeometry();
    const u = [], side = [], idx = [];
    for (let s = 0; s <= S; s++) { u.push(s / S, s / S); side.push(-1, 1); }
    for (let s = 0; s < S; s++) { const a = s * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    const geo = new THREE.InstancedBufferGeometry();
    geo.setIndex(idx);
    geo.setAttribute('position', new THREE.Float32BufferAttribute(new Array((S + 1) * 6).fill(0), 3));
    geo.setAttribute('aU', new THREE.Float32BufferAttribute(u, 1));
    geo.setAttribute('aSide', new THREE.Float32BufferAttribute(side, 1));
    const A = new Float32Array(this.count * 4), B = new Float32Array(this.count * 4), C = new Float32Array(this.count * 4);
    strands.forEach((s, i) => {
      A.set([s[0], s[1], s[2], s[3]], i * 4);
      B.set([s[4], s[5], s[6], s[7]], i * 4);
      C.set([s[8], s[9], s[10], 0], i * 4);
    });
    geo.setAttribute('iA', new THREE.InstancedBufferAttribute(A, 4));
    geo.setAttribute('iB', new THREE.InstancedBufferAttribute(B, 4));
    geo.setAttribute('iC', new THREE.InstancedBufferAttribute(C, 4));
    geo.instanceCount = this.count;
    base.dispose();

    this.uniforms = {
      uRot: { value: 0 }, uTrail: { value: 1 }, uTime: { value: 0 }, uIgnite: { value: 0 }, uWave: { value: 1 },
      uStretch: { value: 0 }, uRush: { value: 0 }, uFade: { value: 1 },
      uHotA: { value: -0.35 }, uHotB: { value: Math.PI + 0.25 }, uGain: { value: 1 }, uSpeedGlow: { value: 0 },
      uDeep: { value: new THREE.Color(0x2a0a6e) }, uPurple: { value: new THREE.Color(0x9b35ff) },
      uBlue: { value: new THREE.Color(0x5f8cff) }, uWhite: { value: new THREE.Color(0xf2e6ff) },
    };
    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG, uniforms: this.uniforms,
      transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.frustumCulled = false;
    this.group.add(this.mesh);

    // faint volumetric haze disc under the rim (soft light diffusion, not a shape)
    const hz = document.createElement('canvas'); hz.width = hz.height = 256;
    const g = hz.getContext('2d');
    const gr = g.createRadialGradient(128, 128, 40, 128, 128, 128);
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.42, 'rgba(120,60,255,0.28)'); gr.addColorStop(0.6, 'rgba(80,40,200,0.10)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
    this.hazeMat = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(hz), transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, opacity: 0.6 });
    const haze = new THREE.Mesh(new THREE.PlaneGeometry(34, 34), this.hazeMat);
    haze.rotation.x = -Math.PI / 2; haze.position.y = -0.6;
    this.group.add(haze);

    this.rot = 0;
    this.speed = 0.09;
    this.time = 0;
    this.ignite = 0;
  }

  // q: hero progress 0..1 ; mode 'hero' | 'closing'
  update(dt, q, mode, mouse) {
    this.time += dt;
    const U = this.uniforms;
    let targetSpeed, trail, tilt, gain = 1, rush = 0, fade = 1, stretch = 0;
    if (mode === 'closing') {
      targetSpeed = 0.16; trail = 1.25; tilt = 0.0;
      gain = 0.9 + 0.1 * Math.sin(this.time * 0.6);
    } else {
      // every value is driven by scroll position → stop/reverse follows the scroll exactly
      targetSpeed = mono(q, [[0, 0.09], [0.14, 0.12], [0.3, 0.55], [0.5, 1.9], [0.68, 5.2], [0.82, 8.5], [1, 9]]);
      trail = mono(q, [[0, 1], [0.3, 1.5], [0.55, 2.4], [0.75, 3.2], [1, 3.4]]);
      tilt = 0.14 * smooth(ramp(q, 0.1, 0.32)) * (1 - smooth(ramp(q, 0.4, 0.62)));
      gain = mono(q, [[0, 1], [0.45, 1.2], [0.68, 1.45], [0.86, 1.25], [1, 1.2]]);
      rush = smooth(ramp(q, 0.52, 0.7));
      stretch = mono(q, [[0, 0], [0.55, 0], [0.75, 2.5], [0.9, 5], [1, 5]]);
      fade = 1 - smooth(ramp(q, 0.9, 0.975));          // lights vanish → black
    }
    // speed follows the scroll-mapped target with short inertia; rotation angle itself accumulates
    this.speed += (targetSpeed - this.speed) * Math.min(1, dt * 4);
    this.rot += this.speed * dt;
    Object.assign(this.vals = this.vals || {}, { rush, fade });
    U.uRot.value = this.rot;
    U.uTime.value = this.time;
    U.uTrail.value = trail;
    U.uGain.value = gain;
    U.uRush.value = rush;
    U.uFade.value = fade;
    U.uStretch.value = stretch;
    U.uSpeedGlow.value = Math.min(2, this.speed * 0.4);
    U.uIgnite.value = this.ignite;
    U.uHotA.value = -0.35 + (mouse ? mouse.x * 0.18 : 0);
    U.uHotB.value = Math.PI + 0.25 + (mouse ? mouse.y * 0.14 : 0);
    this.group.rotation.set(tilt + (mouse ? mouse.y * 0.02 : 0), 0, tilt * 0.5 + (mouse ? -mouse.x * 0.015 : 0));
    this.hazeMat.opacity = 0.55 * this.ignite * (1 - rush);
  }

  /*
   * Camera: wide oblique view → approach (aligning with the vortex axis) → suction through the dark centre
   * → straight down the light tunnel. The path is one centripetal spline; scroll is mapped to distance along it
   * with a monotone curve, so velocity rises continuously (no stops, no teleports).
   * returns { fov, up, blur, distort }
   */
  camera(q, mode, pos, look, up) {
    up.set(0, 1, 0);
    if (mode === 'closing') { pos.set(0, 3.2, 31); look.set(0, 6.2, 0); return { fov: 38, blur: 0, distort: 0 }; }
    if (!this.path) {
      this.path = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 12.5, 27), new THREE.Vector3(0, 12.4, 22), new THREE.Vector3(0, 12, 14), new THREE.Vector3(0, 10, 7),
        new THREE.Vector3(0, 6.5, 2), new THREE.Vector3(0, 2.4, 0.3), new THREE.Vector3(0, -6, 0.05), new THREE.Vector3(0, -60, 0.02), new THREE.Vector3(0, -390, 0.02),
      ], false, 'centripetal');
      this.pathLen = this.path.getLength();
    }
    const L = this.pathLen;
    const sDist = mono(q, [[0, 0], [0.14, 1.2], [0.3, 9], [0.46, 20], [0.58, 28.5], [0.68, 34], [0.76, 46], [0.88, 190], [1, L - 1]]);
    const u = Math.min(1, sDist / L);
    pos.copy(this.path.getPointAt(u));
    const ahead = this.path.getPointAt(Math.min(1, (sDist + 22) / L));
    const w = smooth(ramp(q, 0.44, 0.7));
    look.set(0, -1.5 - 1.5 * ramp(q, 0.2, 0.46), 0).lerp(ahead, w);
    up.set(0, 1, 0).lerp(new THREE.Vector3(0, 0, -1), smooth(ramp(q, 0.48, 0.7))).normalize();
    const fov = mono(q, [[0, 40], [0.46, 47], [0.6, 60], [0.7, 80], [0.8, 95], [1, 96]]);
    const blur = mono(q, [[0, 0], [0.42, 0.0], [0.56, 0.025], [0.7, 0.11], [0.84, 0.18], [0.95, 0.12], [1, 0.05]]);
    const distort = mono(q, [[0, 0], [0.55, 0], [0.72, 0.22], [0.9, 0.3], [1, 0.2]]);
    return { fov, blur, distort };
  }
}

const ramp = (x, a, b) => Math.min(1, Math.max(0, (x - a) / (b - a)));
const smooth = t => t * t * (3 - 2 * t);
// monotone piecewise-cubic interpolation (Fritsch–Carlson): smooth, never overshoots, never stops between keys
function mono(x, pts) {
  if (x <= pts[0][0]) return pts[0][1];
  const n = pts.length;
  if (x >= pts[n - 1][0]) return pts[n - 1][1];
  const d = [], m = [];
  for (let i = 0; i < n - 1; i++) d.push((pts[i + 1][1] - pts[i][1]) / (pts[i + 1][0] - pts[i][0]));
  m.push(d[0]);
  for (let i = 1; i < n - 1; i++) m.push(d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2);
  m.push(d[n - 2]);
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
    const a = m[i] / d[i], b = m[i + 1] / d[i], h = a * a + b * b;
    if (h > 9) { const t = 3 / Math.sqrt(h); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i]; }
  }
  let i = 0; while (x > pts[i + 1][0]) i++;
  const h = pts[i + 1][0] - pts[i][0], t = (x - pts[i][0]) / h, t2 = t * t, t3 = t2 * t;
  return (2 * t3 - 3 * t2 + 1) * pts[i][1] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * pts[i + 1][1] + (t3 - t2) * h * m[i + 1];
}
