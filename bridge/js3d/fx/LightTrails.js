import * as THREE from 'three';

/*
 * LightTrails — WebGL 오버레이 빛 궤적 (섹션 전환·텍스트 리빌·스크롤 가속)
 *  기존 2D 선 대신, 각 궤적은 여러 겹의 빛 가닥(bundle)으로 구성됩니다.
 *  가닥마다 굵기·밝기·색(딥 바이올렛 → 일렉트릭 퍼플 → 아이스 블루 → 백색 코어)·속도·지연이 다르고,
 *  셰이더에서 밝은 코어 + 넓은 글로우 확산 + 머리 플레어 + 꼬리 모션 블러 감쇠를 계산합니다.
 *  가속/감속 이징, 원근 굵기 변화, 화면 중앙을 가로지르는 '슬릿' 전환 빛 포함.
 */
const MAXV = 90000;
const PAL = [[0.42, 0.14, 1.0], [0.61, 0.21, 1.0], [0.71, 0.36, 1.0], [0.82, 0.54, 1.0], [0.37, 0.55, 1.0]];

export class LightTrails {
  constructor(canvas) {
    this.c = canvas;
    this.r = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false, premultipliedAlpha: true });
    this.r.setClearColor(0x000000, 0);
    this.scene = new THREE.Scene();
    this.cam = new THREE.OrthographicCamera(0, 1, 0, 1, -1, 1);
    const g = this.geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(MAXV * 3);
    this.uv = new Float32Array(MAXV * 2);
    this.col = new Float32Array(MAXV * 4);   // rgb + core sharpness
    this.alp = new Float32Array(MAXV);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('uv', new THREE.BufferAttribute(this.uv, 2).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aCol', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aAlpha', new THREE.BufferAttribute(this.alp, 1).setUsage(THREE.DynamicDrawUsage));
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      vertexShader: `attribute vec4 aCol; attribute float aAlpha; varying vec2 vUv; varying vec4 vCol; varying float vA;
        void main(){ vUv = uv; vCol = aCol; vA = aAlpha; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `varying vec2 vUv; varying vec4 vCol; varying float vA;
        void main(){
          float v = vUv.y * 2.0 - 1.0; float v2 = v * v;
          float core = exp(-v2 * vCol.a);
          float glow = exp(-v2 * 3.2) * 0.30 + exp(-v2 * 12.0) * 0.25;
          float u = vUv.x;                         // 0 tail → 1 head
          float along = pow(u, 1.7) + exp(-(1.0 - u) * 30.0) * 1.2;
          vec3 c = mix(vCol.rgb * 0.6 + vec3(0.02, 0.05, 0.2) * (1.0 - u), vCol.rgb, u);
          c = mix(c, vec3(1.0, 0.95, 1.0), core * pow(u, 6.0) * 0.85);
          float I = (core * 1.15 + glow) * along * vA;
          gl_FragColor = vec4(c * I, 1.0);
        }`,
    });
    this.mesh = new THREE.Mesh(g, mat);
    this.mesh.frustumCulled = false;
    this.scene.add(this.mesh);
    this.trails = [];
    this.vel = 0; this.spawnAcc = 0; this.slit = 0; this.closing = 0; this.time = 0;
    this.resize();
    addEventListener('resize', () => this.resize());
  }
  resize() {
    this.W = innerWidth; this.H = innerHeight;
    this.r.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
    this.r.setSize(this.W, this.H, false);
    Object.assign(this.cam, { left: 0, right: this.W, top: 0, bottom: this.H });
    this.cam.updateProjectionMatrix();
  }

  // a trail = bundle of strands following a cubic bezier (screen px)
  add(p, o = {}) {
    const n = o.strands ?? (4 + (Math.random() * 5 | 0));
    const strands = [];
    for (let i = 0; i < n; i++) {
      const lead = i === 0;
      strands.push({
        off: (Math.random() - 0.5) * (o.spreadPx ?? 22),
        width: lead ? (o.width ?? 26) : (o.width ?? 26) * (0.35 + Math.random() * 0.6),
        core: lead ? 70 : 40 + Math.random() * 80,
        bright: lead ? 1.0 : 0.25 + Math.random() * 0.55,
        col: PAL[(Math.random() * PAL.length) | 0],
        lag: Math.random() * 0.12,              // different speeds inside one bundle
        len: (o.len ?? 0.45) * (0.7 + Math.random() * 0.6),
      });
    }
    this.trails.push({ p, t: -(o.delay ?? 0), dur: o.dur ?? 0.9, strands, persp: o.persp ?? 0, alpha: o.alpha ?? 1 });
  }

  // horizontal light sweep with acceleration/deceleration (section transitions / text reveals)
  sweep(yFrac = 0.5, dir = 1, count = 6, spread = 0.12) {
    const { W, H } = this;
    for (let i = 0; i < count; i++) {
      const y = H * (yFrac + (Math.random() - 0.5) * spread);
      const arc = (Math.random() - 0.5) * H * 0.22;
      const a = dir > 0 ? [-W * 0.15, y + arc * 0.5] : [W * 1.15, y + arc * 0.5];
      const d = dir > 0 ? [W * 1.15, y - arc * 0.4] : [-W * 0.15, y - arc * 0.4];
      this.add([a, [a[0] + (d[0] - a[0]) * 0.33, y - arc], [a[0] + (d[0] - a[0]) * 0.66, y - arc * 0.7], d],
        { dur: 0.75 + Math.random() * 0.5, delay: Math.random() * 0.25, width: 16 + Math.random() * 26, len: 0.42 + Math.random() * 0.2, spreadPx: 30 });
    }
  }
  _ambient(v) {
    const { W, H } = this;
    const left = Math.random() < 0.5;
    const x = left ? W * (0.0 + Math.random() * 0.14) : W * (0.86 + Math.random() * 0.14);
    const dir = v > 0 ? -1 : 1;
    const y0 = dir < 0 ? H * 1.15 : -H * 0.15, y3 = dir < 0 ? -H * 0.15 : H * 1.15;
    const bend = (left ? 1 : -1) * W * 0.1;
    this.add([[x, y0], [x + bend, y0 + (y3 - y0) * 0.33], [x + bend * 0.5, y0 + (y3 - y0) * 0.66], [x - bend * 0.2, y3]],
      { dur: 0.5 + Math.random() * 0.35, width: 10 + Math.random() * 16, len: 0.35, alpha: 0.55, strands: 3 });
  }

  update(dt, scrollVel = 0) {
    this.time += dt;
    this.vel += (scrollVel - this.vel) * Math.min(1, dt * 6);
    this.spawnAcc += dt * Math.min(9, Math.abs(this.vel) * 0.008);
    while (this.spawnAcc > 1) { this.spawnAcc -= 1; this._ambient(this.vel); }

    let vi = 0;
    const P = this.pos, UV = this.uv, C = this.col, A = this.alp;
    const push = (x, y, u, v, c, core, a) => {
      if (vi >= MAXV) return;
      P[vi * 3] = x; P[vi * 3 + 1] = y; P[vi * 3 + 2] = 0;
      UV[vi * 2] = u; UV[vi * 2 + 1] = v;
      C[vi * 4] = c[0]; C[vi * 4 + 1] = c[1]; C[vi * 4 + 2] = c[2]; C[vi * 4 + 3] = core;
      A[vi] = a; vi++;
    };
    const bez = (p, t) => {
      const a = 1 - t;
      return [a * a * a * p[0][0] + 3 * a * a * t * p[1][0] + 3 * a * t * t * p[2][0] + t * t * t * p[3][0],
              a * a * a * p[0][1] + 3 * a * a * t * p[1][1] + 3 * a * t * t * p[2][1] + t * t * t * p[3][1]];
    };
    const ribbon = (pts, widthAt, c, core, alpha) => {
      const n = pts.length;
      for (let i = 0; i < n - 1; i++) {
        const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
        let dx = x1 - x0, dy = y1 - y0; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
        const w0 = widthAt(i / (n - 1)) * 0.5, w1 = widthAt((i + 1) / (n - 1)) * 0.5;
        const nx = -dy, ny = dx;
        const u0 = i / (n - 1), u1 = (i + 1) / (n - 1);
        push(x0 + nx * w0, y0 + ny * w0, u0, 1, c, core, alpha); push(x0 - nx * w0, y0 - ny * w0, u0, 0, c, core, alpha); push(x1 + nx * w1, y1 + ny * w1, u1, 1, c, core, alpha);
        push(x0 - nx * w0, y0 - ny * w0, u0, 0, c, core, alpha); push(x1 - nx * w1, y1 - ny * w1, u1, 0, c, core, alpha); push(x1 + nx * w1, y1 + ny * w1, u1, 1, c, core, alpha);
      }
    };
    const keep = [];
    for (const tr of this.trails) {
      tr.t += dt / tr.dur;
      if (tr.t < 0) { keep.push(tr); continue; }
      let alive = false;
      for (const s of tr.strands) {
        const tt = Math.min(1.6, Math.max(0, tr.t - s.lag));
        const e = tt < 1 ? tt * tt * tt * (tt * (tt * 6 - 15) + 10) : 1;   // accelerate → decelerate
        const head = e * (1 + s.len) + Math.max(0, tt - 1) * 0.6;
        const tail = head - s.len;
        if (tail >= 1) continue;
        alive = true;
        const h = Math.min(1, head), t0 = Math.max(0, tail);
        if (h <= t0) continue;
        const N = 28, pts = [];
        for (let i = 0; i <= N; i++) {
          const k = t0 + (h - t0) * (i / N);
          const p = bez(tr.p, k);
          const p2 = bez(tr.p, Math.min(1, k + 0.002));
          let dx = p2[0] - p[0], dy = p2[1] - p[1]; const l = Math.hypot(dx, dy) || 1;
          pts.push([p[0] - dy / l * s.off, p[1] + dx / l * s.off]);
        }
        const fade = Math.min(1, (1 - t0) * 2.5) * tr.alpha * s.bright;
        ribbon(pts, () => s.width, s.col, s.core, fade);
      }
      if (alive) keep.push(tr);
    }
    this.trails = keep;

    // centre slit: a single, very thin purple light crossing the screen
    if (this.slit > 0.002) {
      const { W, H } = this, k = this.slit;
      const half = W * 0.55 * Math.min(1, k * 1.4);
      const pts = []; for (let i = 0; i <= 40; i++) pts.push([W / 2 - half + (2 * half) * i / 40, H / 2]);
      const c = [0.72, 0.42, 1.0];
      // symmetric fade: draw as two halves from the centre outwards
      ribbon(pts.slice(0, 21), u => 30 * (0.7 + u * 0.3), c, 220, k * 1.2);
      ribbon(pts.slice(20).reverse(), u => 30 * (0.7 + u * 0.3), c, 220, k * 1.2);
    }

    this.geo.setDrawRange(0, vi);
    if (vi > 0 || this._hadDraw) {
      this.geo.attributes.position.needsUpdate = true; this.geo.attributes.uv.needsUpdate = true;
      this.geo.attributes.aCol.needsUpdate = true; this.geo.attributes.aAlpha.needsUpdate = true;
      this.r.render(this.scene, this.cam);
    }
    this._hadDraw = vi > 0;
  }
}
