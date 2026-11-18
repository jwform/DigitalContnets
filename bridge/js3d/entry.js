/* =====================================================================
   BRIDGE × 2030 MYEONGDONG — Three.js scenario layer (ACT 05)
   The BRIDGE page keeps its own custom WebGL2 renderer (js/gl.js) for every other act.
   This layer (optional: if Three.js fails to load, the page shows the storyboard images instead) renders the
   user scenario in 3D, driven by scroll: a neon night-market street, BRIDGE on the stall table between the
   vendor and the tourist, six stages. Captions / step rail are plain HTML handled by js/main.js.
   ===================================================================== */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { QUALITY } from './config/settings.js';
import { GradeShader } from './fx/GradePass.js';
import { CityLite } from './scenes/CityLite.js';
import { makeFigure, applyPose, makeFood } from './components/Actors.js';
import { clamp01, smooth, ramp, camAt, VENDOR, TOURIST, poseAt, nod, foodAt, displayState } from './scenario.js';

const BR3 = (window.BR3 = window.BR3 || {});
const mouse = { x: 0, y: 0, sx: 0, sy: 0 };
addEventListener('pointermove', e => { if (e.pointerType === 'touch') return; mouse.x = (e.clientX / innerWidth - 0.5) * 2; mouse.y = (e.clientY / innerHeight - 0.5) * 2; });
const $ = s => document.querySelector(s);

/* ---------------------------------------------------------------- BRIDGE gate */
const COL = { white: new THREE.Color(0.9, 0.88, 1.0), purple: new THREE.Color(0.337, 0.107, 1.0), lime: new THREE.Color(0.565, 1.0, 0.042) };
function fallbackGate(f) {
  const holder = new THREE.Group(), dark = new THREE.MeshStandardMaterial({ color: 0x1b1c22, roughness: 0.6, metalness: 0.2 });
  const box = (w, h, d, x, y, m = dark) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w * f, h * f, d * f), m); b.position.set(x * f, (y + 20) * f, 0); holder.add(b); return b; };
  box(68, 6, 9.8, 0, -17); box(68, 6, 9.8, 0, 17); box(6, 40, 9.8, -31, 0); box(6, 40, 9.8, 31, 0); box(58, 7, 4.2, 0, 15.5);
  const top = box(57, 0.6, 2, 0, 20.1, new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 2 }));
  const bottom = box(54, 0.4, 0.4, 0, -12.2 + 24.4, new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 1 }));
  return { holder, f, top, bottom };
}
function loadGate() {
  return new Promise(res => {
    const F = 0.6 / 68.4;
    try {
      const b64 = window.BRIDGE_GLB_B64 || window.BRIDGE_GLB_KEEP; if (!b64) return res(fallbackGate(F));
      const bin = atob(b64), u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
      new GLTFLoader().parse(u8.buffer, '', gltf => {
        const root = gltf.scene, box = new THREE.Box3().setFromObject(root), size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
        const s = 0.6 / Math.max(size.x, 1e-4);          // 600 mm wide
        root.position.sub(c);
        const wrap = new THREE.Group(); wrap.add(root); wrap.scale.setScalar(s); wrap.position.y = (size.y * s) / 2;
        const holder = new THREE.Group(); holder.add(wrap);
        let top = null, bottom = null;
        root.traverse(o => {
          if (!o.isMesh || !o.material) return;
          if (/LED/i.test(o.material.name || '')) {
            o.material = o.material.clone(); o.geometry.computeBoundingBox();
            const cy = o.geometry.boundingBox.getCenter(new THREE.Vector3()).y;
            if (cy > 16) top = o; else bottom = o;
          }
        });
        if (!top || !bottom) return res(fallbackGate(F));
        res({ holder, f: (0.01 * s), top, bottom });
      }, () => res(fallbackGate(F)));
    } catch (e) { res(fallbackGate(F)); }
  });
}

/* ---------------------------------------------------------------- display (both faces) */
function canvasTex(w, h) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return { c, g: c.getContext('2d'), t };
}
function makeDisplay(gate) {
  const f = gate.f, y = 35.5 * f, z = 2.1 * f + 0.0006, face = {};
  const mk = (tex, w, sx, sz, ry) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w * f, 7 * f), new THREE.MeshBasicMaterial({ map: tex.t, transparent: true, toneMapped: false, depthWrite: false }));
    m.position.set(sx * f, y, sz); m.rotation.y = ry; gate.holder.add(m); return m;
  };
  face.front = { txt: canvasTex(512, 180), ico: canvasTex(256, 180) };   // customer side (+z)
  face.back = { txt: canvasTex(512, 180), ico: canvasTex(256, 180) };    // vendor side (-z)
  mk(face.front.txt, 21.5, -17.2, z, 0); mk(face.front.ico, 21.5, 17.2, z, 0);
  mk(face.back.txt, 21.5, 17.2, -z, Math.PI); mk(face.back.ico, 21.5, -17.2, -z, Math.PI);
  let last = '';
  const text = (T, top, line, color) => {
    const g = T.g; g.clearRect(0, 0, 512, 180);
    g.fillStyle = color; g.font = '500 26px DM Mono, monospace'; g.textAlign = 'left'; g.textBaseline = 'alphabetic'; g.fillText(top, 18, 46);
    g.fillStyle = '#ffffff'; g.font = '700 54px Pretendard, Noto Sans KR, Arial, sans-serif';
    let size = 54; while (g.measureText(line).width > 480 && size > 24) { size -= 3; g.font = '700 ' + size + 'px Pretendard, Noto Sans KR, Arial, sans-serif'; }
    g.fillText(line, 18, 122); T.t.needsUpdate = true;
  };
  const icon = (T, key) => {
    const g = T.g; g.clearRect(0, 0, 256, 180); g.lineWidth = 12; g.lineCap = 'round'; g.lineJoin = 'round';
    if (key === 'ready') { g.strokeStyle = '#c5ff35'; g.beginPath(); g.arc(128, 90, 56, 0, 7); g.stroke(); g.beginPath(); g.moveTo(100, 92); g.lineTo(122, 114); g.lineTo(160, 70); g.stroke(); }
    else if (key === 'tr') { g.strokeStyle = '#a47cff'; g.beginPath(); g.moveTo(60, 60); g.lineTo(150, 60); g.moveTo(130, 40); g.lineTo(150, 60); g.lineTo(130, 80); g.moveTo(196, 120); g.lineTo(106, 120); g.moveTo(126, 100); g.lineTo(106, 120); g.lineTo(126, 140); g.stroke(); }
    else if (key === 'menu') { g.strokeStyle = '#f5f5f6'; g.lineWidth = 8; g.beginPath(); g.arc(128, 90, 50, 0, 7); g.stroke(); g.fillStyle = '#f5f5f6'; g.font = '700 54px Arial'; g.textAlign = 'center'; g.fillText('₩', 128, 110); }
    T.t.needsUpdate = true;
  };
  return {
    set(st) {
      if (st.key === last) return; last = st.key;
      const color = st.light === 'lime' ? '#c5ff35' : st.light === 'purple' ? '#a47cff' : '#9d9dab';
      for (const [side, lang] of [['front', 'en'], ['back', 'ko']]) {
        const F = face[side]; F.txt.g.clearRect(0, 0, 512, 180); F.ico.g.clearRect(0, 0, 256, 180);
        if (st.key !== 'off' && st.key !== 'idle') { text(F.txt, st.top, st[lang], color); icon(F.ico, st.key); }
        F.txt.t.needsUpdate = F.ico.t.needsUpdate = true;
      }
    }
  };
}

/* ---------------------------------------------------------------- stall labels (stage 01: shared MCU AI info) */
function labelSprite(menu, state, crowd, hero) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 230; const g = c.getContext('2d');
  const rr = (x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
  rr(6, 6, 500, 218, 26); g.fillStyle = 'rgba(17,18,22,0.88)'; g.fill(); g.lineWidth = hero ? 7 : 3; g.strokeStyle = hero ? '#c5ff35' : 'rgba(164,124,255,0.9)'; g.stroke();
  g.fillStyle = '#f5f5f6'; g.font = '700 58px Pretendard, Noto Sans KR, Arial, sans-serif'; g.fillText(menu, 34, 86);
  g.font = '500 30px DM Mono, monospace'; g.fillStyle = state === 'OPEN' ? '#c5ff35' : '#ff8aa8'; g.fillText(state === 'OPEN' ? '● 영업 중' : '○ 준비 중', 34, 140);
  g.fillStyle = '#c9c9d4'; g.fillText('혼잡 ' + ['낮음', '보통', '높음'][crowd], 34, 188);
  for (let i = 0; i < 3; i++) { g.fillStyle = i <= crowd ? (crowd === 2 ? '#ff6b8a' : '#a47cff') : 'rgba(245,245,246,0.18)'; g.fillRect(330 + i * 44, 168, 34, 12); }
  if (hero) { g.fillStyle = '#c5ff35'; g.font = '700 28px DM Mono, monospace'; g.fillText('BRIDGE', 360, 70); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false, depthWrite: false, toneMapped: false }));
  sp.scale.set(hero ? 2.3 : 1.9, (hero ? 2.3 : 1.9) * 230 / 512, 1); sp.renderOrder = 20; return sp;
}

/* ---------------------------------------------------------------- the layer */
class ScenarioLayer {
  constructor(sec, view) {
    this.sec = sec; this.view = view; this.vis = false; this.ps = 0; this.pressed = false; this.ready = false;
    const canvas = this.canvas = document.createElement('canvas'); canvas.className = 'sc-canvas'; canvas.setAttribute('aria-hidden', 'true');
    view.appendChild(canvas);
    const w = Math.max(2, view.clientWidth), h = Math.max(2, view.clientHeight);
    const r = this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
    r.setPixelRatio(Math.min(devicePixelRatio || 1, QUALITY.mobile ? 1.25 : 1.5)); r.setSize(w, h, false);
    r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 0.9;
    this.camera = new THREE.PerspectiveCamera(54, w / h, 0.05, 400);
    const city = this.city = new CityLite(r);
    const a = city.anchor;
    const H = this.H = new THREE.Group(); H.position.set(a.x, 0, a.z); H.rotation.y = a.ry; city.scene.add(H); H.updateMatrixWorld(true);

    // vendor (behind the table) and tourist (street side)
    this.vendor = makeFigure({ skin: 0xc99a78, top: 0x3a3550, bottom: 0x23232b, hair: 0x1a1416, extra: 0xf2f0ea, apron: true, cap: true });
    this.vendor.root.position.set(0, 0, -0.85); H.add(this.vendor.root);
    this.tourist = makeFigure({ skin: 0xdcb89b, top: 0xcfc6ff, bottom: 0x2a2b36, hair: 0x2b2230, extra: 0x25262e, pack: true });
    this.tourist.root.position.set(-0.12, 0, 0.95); this.tourist.root.rotation.y = Math.PI; H.add(this.tourist.root);
    this.tourist.mats.forEach(m => { m.transparent = true; });
    this.food = makeFood(); this.food.visible = false; H.add(this.food);

    // studio-style light on the table: soft key, purple rim, and a glow that follows the top-light colour
    const key = new THREE.SpotLight(0xeeeaff, 9, 8, 0.55, 0.9, 1.4); key.position.set(1.3, 2.7, 2.0); key.target.position.set(0, 1.15, -0.1); H.add(key, key.target);
    const rim = new THREE.SpotLight(0x7628f5, 12, 7, 0.65, 0.9, 1.5); rim.position.set(-1.4, 2.3, -1.7); rim.target.position.set(0, 1.2, -0.1); H.add(rim, rim.target);
    const rim2 = new THREE.SpotLight(0x7a6bff, 7, 7, 0.65, 0.9, 1.5); rim2.position.set(1.4, 2.3, -1.7); rim2.target.position.set(0, 1.2, 0.2); H.add(rim2, rim2.target);
    this.glow = new THREE.PointLight(0xffffff, 0.5, 2.6, 2); this.glow.position.set(0, 1.62, 0.1); H.add(this.glow);
    this.lightCol = COL.white.clone();

    // stall labels
    this.labels = [];
    const MENU = ['떡볶이', '닭꼬치', '호떡', '어묵', '회오리감자', '붕어빵', '순대', '튀김'];
    city.stallPos.forEach((s, i) => {
      const sp = labelSprite(s.hero ? '떡볶이' : MENU[(i * 3 + 1) % MENU.length], i % 7 === 4 ? 'PREP' : 'OPEN', s.hero ? 0 : (i * 5) % 3, s.hero);
      sp.position.set(s.x, 3.5, s.z); city.scene.add(sp); this.labels.push(sp);
    });

    // post: bloom + the site's black/purple grade
    const rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples: QUALITY.mobile ? 0 : 4 });
    const comp = this.composer = new EffectComposer(r, rt); comp.setPixelRatio(r.getPixelRatio()); comp.setSize(w, h);
    comp.addPass(new RenderPass(city.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 0.32, 0.6, 0.92); comp.addPass(this.bloom);
    this.grade = new ShaderPass(GradeShader); this.grade.uniforms.uSat.value = 0.95; this.grade.uniforms.uVignette.value = 0.9; comp.addPass(this.grade);
    comp.addPass(new OutputPass());

    this.pos = [0, 0, 0]; this.look = [0, 0, 0]; this.v = new THREE.Vector3();
    this.press = $('#scPress'); this.disp = $('#scDisp');
    if (this.press) this.press.addEventListener('click', () => { this.pressed = true; });
    new ResizeObserver(() => this.resize()).observe(view);
    new IntersectionObserver(es => es.forEach(e => { this.vis = e.isIntersecting; }), { rootMargin: '10% 0px' }).observe(sec);
    loadGate().then(g => {
      this.gate = g; g.holder.position.set(0, 1.05, -0.1); this.H.add(g.holder);
      this.display = makeDisplay(g); this.display.set({ key: 'off' }); this.ready = true; view.classList.add('on3d');
    });
  }
  resize() {
    const w = Math.max(2, this.view.clientWidth), h = Math.max(2, this.view.clientHeight);
    this.renderer.setSize(w, h, false); this.composer.setSize(w, h); this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
  }
  frame(dt, t) {
    if (!this.ready || !this.vis) return;
    const r = this.sec.getBoundingClientRect(), vh = innerHeight, len = Math.max(1, this.sec.offsetHeight - vh);
    const q = clamp01(-r.top / len);
    this.ps += (q - this.ps) * (1 - Math.exp(-dt * 6)); if (Math.abs(q - this.ps) < 0.0003) this.ps = q;
    const p = this.ps;

    // camera (stall-local → world) + a little mouse parallax
    camAt(p, this.pos, this.look);
    const cam = this.camera, v = this.v;
    this.H.localToWorld(v.set(this.pos[0], this.pos[1], this.pos[2])); cam.position.copy(v);
    cam.position.x += mouse.sx * 0.05; cam.position.y -= mouse.sy * 0.03;
    this.H.localToWorld(v.set(this.look[0], this.look[1], this.look[2])); cam.lookAt(v);

    // actors
    const vp = poseAt(VENDOR, p), tp = poseAt(TOURIST, p);
    const cook = 1 - ramp(p, 0.25, 0.345), hes = ramp(p, 0.40, 0.45) * (1 - ramp(p, 0.52, 0.56)), enj = ramp(p, 0.90, 0.93);
    const nv = nod(p, 0.62, 0.69, 2, 0.28), nt = nod(p, 0.62, 0.69, 2, 0.22) + nod(p, 0.91, 0.99, 2, 0.34);
    applyPose(this.vendor, {
      head: [vp.head[0] + nv, vp.head[1] + Math.sin(t * 3.4) * 0.22 * hes + Math.sin(t * 1.1) * 0.1 * cook, vp.head[2]],
      shL: vp.shL, elL: vp.elL,
      shR: [vp.shR[0] + Math.sin(t * 5 + 1) * 0.1 * cook, vp.shR[1] + Math.sin(t * 6) * 0.15 * enj],
      elR: [vp.elR[0] + Math.sin(t * 5) * 0.28 * cook + Math.sin(t * 6) * 0.12 * enj], lean: vp.lean
    });
    applyPose(this.tourist, { head: [tp.head[0] + nt, tp.head[1], tp.head[2]], shL: tp.shL, elL: tp.elL, shR: tp.shR, elR: tp.elR, lean: tp.lean });
    this.vendor.body.position.y = 0.88 + Math.sin(t * 1.6) * 0.004; this.tourist.body.position.y = 0.88 + Math.sin(t * 1.5 + 1) * 0.004;
    const op = smooth(ramp(p, 0.34, 0.40));
    this.tourist.mats.forEach(m => { m.opacity = op; }); this.tourist.root.visible = op > 0.01;
    const fp = this.fpos || (this.fpos = [0, 0, 0]);
    if (foodAt(p, fp)) { this.food.visible = true; this.food.position.set(fp[0], fp[1], fp[2]); } else this.food.visible = false;

    // BRIDGE: top light + display follow the stage
    if (p < 0.5) this.pressed = false;
    const eff = this.pressed || p >= 0.60, st = displayState(p, eff);
    this.display.set(st);
    const target = COL[st.light];
    this.lightCol.lerp(target, 1 - Math.exp(-dt * 7));
    const g = this.gate, tm = g.top.material, bm = g.bottom.material;
    tm.emissive.copy(this.lightCol); tm.color.copy(this.lightCol).lerp(COL.white, 0.5); tm.emissiveIntensity = 1.3; tm.toneMapped = false;
    bm.emissive.copy(this.lightCol).multiplyScalar(0.55); bm.emissiveIntensity = 0.7;
    this.glow.color.copy(this.lightCol); this.glow.intensity += ((st.light === 'white' ? 0.5 : 1.6) - this.glow.intensity) * Math.min(1, dt * 5);

    // press hotspot over the centre button (customer side), stage 04 until pressed
    const showPress = !eff && p > 0.515 && p < 0.60;
    if (this.press) {
      this.press.classList.toggle('show', showPress);
      if (showPress) {
        g.holder.localToWorld(v.set(0, 35.1 * g.f, 2.4 * g.f)); v.project(cam);
        this.press.style.left = ((v.x * 0.5 + 0.5) * this.view.clientWidth).toFixed(1) + 'px'; this.press.style.top = ((-v.y * 0.5 + 0.5) * this.view.clientHeight).toFixed(1) + 'px';
      }
    }
    // HTML mirror of the display (legible at any size)
    if (this.disp) {
      const on = st.key === 'menu' ? p < 0.51 : (st.key === 'tr' || st.key === 'ready');
      this.disp.classList.toggle('show', on); this.disp.dataset.k = st.light;
      if (on && this.disp._k !== st.key) {
        this.disp._k = st.key;
        this.disp.innerHTML = '<small>' + st.top + '</small><b>' + st.ko + '</b><em>' + st.en + '</em>';
      }
    }
    // stage-01 labels
    const la = 1 - ramp(p, 0.12, 0.19);
    for (const sp of this.labels) {
      const d = sp.position.distanceTo(cam.position), o = la * (1 - ramp(d, 14, 30));
      sp.material.opacity = o; sp.visible = o > 0.02;
    }
    this.city.update(dt, cam.position);
    this.grade.uniforms.uTime.value += dt;
    this.composer.render(dt);
  }
}

/* ---------------------------------------------------------------- boot */
function boot() {
  if (/[?&]no3d/.test(location.search)) return;
  let layer = null;
  try { const sec = $('#act5'), view = $('#scView'); if (sec && view) layer = BR3.layer = new ScenarioLayer(sec, view); } catch (e) { console.warn('[BR3] scenario layer off', e); layer = null; }
  if (!layer) return;
  let last = performance.now();
  (function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    mouse.sx += (mouse.x - mouse.sx) * (1 - Math.exp(-dt * 6)); mouse.sy += (mouse.y - mouse.sy) * (1 - Math.exp(-dt * 6));
    try { if (layer) layer.frame(dt, now / 1000); } catch (e) { console.warn('[BR3] scenario error', e); layer = null; return; }
    requestAnimationFrame(loop);
  })(last);
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
