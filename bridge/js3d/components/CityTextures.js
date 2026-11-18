import * as THREE from 'three';
import { rng } from '../core/batch.js';

const KFONT = '"Pretendard Variable", Pretendard, "Noto Sans KR", "Malgun Gothic", "Apple SD Gothic Neo", sans-serif';

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}
function tex(c, { srgb = true, repeat = false, aniso = 4 } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = aniso;
  t.needsUpdate = true;
  return t;
}

// ---------------------------------------------------------------- facades
// 각 텍스처 = 가로 4베이(12m) × 세로 4층(14.4m)
const FACADE_STYLES = ['curtain', 'punched', 'ribbon', 'panel', 'brick', 'grid'];
export function makeFacades(seed = 7) {
  const R = rng(seed);
  const out = [];
  for (const style of FACADE_STYLES) {
    const S = 1024;
    const [c, g] = canvas(S, S);
    const [e, ge] = canvas(S, S);
    ge.fillStyle = '#000'; ge.fillRect(0, 0, S, S);
    const bayW = S / 4, flH = S / 4;
    const base = { curtain: '#0d1016', punched: '#2a2826', ribbon: '#1b1c22', panel: '#16161b', brick: '#3a2a24', grid: '#22232a' }[style];
    g.fillStyle = base; g.fillRect(0, 0, S, S);
    // subtle material noise
    for (let i = 0; i < 2600; i++) {
      g.fillStyle = `rgba(255,255,255,${R() * 0.025})`;
      g.fillRect(R() * S, R() * S, 2 + R() * 6, 1 + R() * 3);
    }
    const lit = () => {
      const r = R();
      if (r < 0.42) return null;
      const pal = ['#ffd9a0', '#ffe8c4', '#cfe3ff', '#fff4e0', '#ffc78a', '#e9f0ff'];
      return pal[(R() * pal.length) | 0];
    };
    for (let fy = 0; fy < 4; fy++) {
      for (let bx = 0; bx < 4; bx++) {
        const x = bx * bayW, y = fy * flH;
        if (style === 'curtain') {
          g.fillStyle = '#0a0d14'; g.fillRect(x + 4, y + 6, bayW - 8, flH - 16);
          const L = lit();
          for (let k = 0; k < 3; k++) {
            const px = x + 6 + k * (bayW - 12) / 3;
            const grd = g.createLinearGradient(px, y, px + 40, y + flH);
            grd.addColorStop(0, '#1a2233'); grd.addColorStop(1, '#0b0e15');
            g.fillStyle = grd; g.fillRect(px + 2, y + 10, (bayW - 12) / 3 - 4, flH - 24);
            if (L && R() > 0.3) {
              ge.fillStyle = L; ge.globalAlpha = 0.35 + R() * 0.5;
              ge.fillRect(px + 2, y + 10, (bayW - 12) / 3 - 4, flH - 24); ge.globalAlpha = 1;
            }
          }
          g.fillStyle = '#2b2f38'; g.fillRect(x, y + flH - 12, bayW, 12);
          g.fillRect(x, y, 4, flH);
        } else if (style === 'punched' || style === 'brick') {
          if (style === 'brick') {
            g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 1;
            for (let yy = y; yy < y + flH; yy += 10) {
              g.beginPath(); g.moveTo(x, yy); g.lineTo(x + bayW, yy); g.stroke();
              for (let xx = x + ((yy / 10) % 2) * 15; xx < x + bayW; xx += 30) { g.beginPath(); g.moveTo(xx, yy); g.lineTo(xx, yy + 10); g.stroke(); }
            }
          }
          const ww = bayW * 0.56, wh = flH * 0.56, wx = x + (bayW - ww) / 2, wy = y + flH * 0.18;
          g.fillStyle = '#121216'; g.fillRect(wx - 8, wy - 8, ww + 16, wh + 22);
          g.fillStyle = '#5b5852'; g.fillRect(wx - 10, wy + wh + 6, ww + 20, 8);
          g.fillStyle = '#0c0f15'; g.fillRect(wx, wy, ww, wh);
          g.fillStyle = '#3c3c42'; g.fillRect(wx + ww / 2 - 2, wy, 4, wh);
          const L = lit();
          if (L) {
            ge.fillStyle = L; ge.globalAlpha = 0.55 + R() * 0.4;
            ge.fillRect(wx, wy, ww / 2 - 2, wh); if (R() > 0.4) ge.fillRect(wx + ww / 2 + 2, wy, ww / 2 - 2, wh);
            ge.globalAlpha = 1;
            if (R() > 0.6) { ge.fillStyle = 'rgba(0,0,0,0.7)'; ge.fillRect(wx, wy, ww, wh * (0.2 + R() * 0.4)); }
          }
        } else if (style === 'ribbon') {
          g.fillStyle = '#0b0d13'; g.fillRect(x, y + flH * 0.3, bayW, flH * 0.5);
          g.fillStyle = '#26272e'; g.fillRect(x, y + flH * 0.3 - 6, bayW, 6);
          for (let k = 0; k < 4; k++) { g.fillStyle = '#30313a'; g.fillRect(x + k * bayW / 4, y + flH * 0.3, 3, flH * 0.5); }
          const L = lit();
          if (L) { ge.fillStyle = L; ge.globalAlpha = 0.4 + R() * 0.5; ge.fillRect(x + 3, y + flH * 0.3, bayW - 6, flH * 0.5); ge.globalAlpha = 1; }
        } else if (style === 'panel') {
          g.fillStyle = '#1d1d23'; g.fillRect(x + 3, y + 3, bayW - 6, flH - 6);
          g.fillStyle = '#0a0b10'; g.fillRect(x + bayW * 0.1, y + flH * 0.2, bayW * 0.18, flH * 0.62);
          g.fillRect(x + bayW * 0.72, y + flH * 0.2, bayW * 0.18, flH * 0.62);
          const L = lit();
          if (L) { ge.fillStyle = L; ge.globalAlpha = 0.6; ge.fillRect(x + bayW * 0.1, y + flH * 0.2, bayW * 0.18, flH * 0.62); ge.globalAlpha = 1; }
          if (R() > 0.55) { ge.fillStyle = R() > 0.5 ? '#7fe7ff' : '#ffb0d8'; ge.globalAlpha = 0.85; ge.fillRect(x + bayW * 0.48, y + 8, 3, flH - 16); ge.globalAlpha = 1; }
        } else if (style === 'grid') {
          for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) {
            const wx = x + 12 + i * (bayW - 24) / 3, wy = y + 14 + j * (flH - 28) / 2;
            g.fillStyle = '#0c0e14'; g.fillRect(wx + 3, wy + 3, (bayW - 24) / 3 - 6, (flH - 28) / 2 - 6);
            if (R() > 0.55) { ge.fillStyle = R() > 0.7 ? '#cfe3ff' : '#ffd9a0'; ge.globalAlpha = 0.45 + R() * 0.4; ge.fillRect(wx + 3, wy + 3, (bayW - 24) / 3 - 6, (flH - 28) / 2 - 6); ge.globalAlpha = 1; }
          }
        }
        // small wall lights
        if (R() > 0.82) { ge.fillStyle = '#fff1d6'; ge.beginPath(); ge.arc(x + 10, y + 10, 4, 0, 7); ge.fill(); }
      }
    }
    out.push({ map: tex(c, { repeat: true }), emissive: tex(e, { repeat: true }), style });
  }
  return out;
}

// ---------------------------------------------------------------- sign atlas
export class SignAtlas {
  constructor(size = 2048) {
    [this.canvas, this.g] = canvas(size, size);
    this.size = size;
    this.g.fillStyle = '#000'; this.g.fillRect(0, 0, size, size);
    this.x = 0; this.y = 0; this.rowH = 0;
    this.cache = new Map();
  }
  // 아틀라스 공간을 아끼기 위해 단어/메뉴/실내를 미리 한 번씩만 그려 두고 재사용
  prepare(shopWords, bladeWords, menus, styles) {
    const hash = t => [...t].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
    shopWords.forEach(w => this.cache.set('b:' + w, this._band(w, styles[hash(w) % styles.length])));
    bladeWords.forEach(w => this.cache.set('v:' + w, this._blade(w, styles[(hash(w) + 3) % styles.length])));
    menus.forEach(([t, p]) => this.cache.set('m:' + t, this._menu(t, p, { bg: '#f7f2e6', fg: '#b4262f' })));
    for (let i = 0; i < 15; i++) this.cache.set('i:' + i, this._interior(1000 + i * 77));
  }
  band(text, style) { return this.cache.get('b:' + text) || this._band(text, style); }
  blade(text, style) { return this.cache.get('v:' + text) || this._blade(text, style); }
  menu(title, price, style) { return this.cache.get('m:' + title) || this._menu(title, price, style); }
  interior(seed) { return this.cache.get('i:' + (seed % 15)) || this._interior(seed); }
  alloc(w, h) {
    if (this.x + w > this.size) { this.x = 0; this.y += this.rowH + 2; this.rowH = 0; }
    const r = { x: this.x, y: this.y, w, h };
    this.x += w + 2; this.rowH = Math.max(this.rowH, h);
    const S = this.size;
    return { ...r, u0: r.x / S, u1: (r.x + w) / S, v0: 1 - (r.y + h) / S, v1: 1 - r.y / S };
  }
  // horizontal shop band
  _band(text, style) {
    const r = this.alloc(508, 96), g = this.g;
    g.save(); g.translate(r.x, r.y);
    if (style.box) {
      g.fillStyle = style.bg; g.fillRect(0, 0, 508, 96);
      g.fillStyle = style.fg;
    } else {
      g.fillStyle = '#060608'; g.fillRect(0, 0, 508, 96);
      g.strokeStyle = style.fg; g.lineWidth = 3; g.globalAlpha = 0.5; g.strokeRect(8, 8, 492, 80); g.globalAlpha = 1;
      g.shadowColor = style.fg; g.shadowBlur = 14; g.fillStyle = style.fg;
    }
    g.font = `600 ${text.length > 7 ? 44 : 54}px ${KFONT}`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, 254, 50, 466);
    g.restore();
    return r;
  }
  // vertical blade sign (text stacked)
  _blade(text, style) {
    const H = 512, W = 112;
    const r = this.alloc(W, H), g = this.g;
    g.save(); g.translate(r.x, r.y);
    g.fillStyle = style.box ? style.bg : '#060608'; g.fillRect(0, 0, W, H);
    if (!style.box) { g.shadowColor = style.fg; g.shadowBlur = 12; }
    g.fillStyle = style.fg;
    const chars = [...text];
    const fs = Math.min(84, (H - 40) / chars.length);
    g.font = `700 ${fs}px ${KFONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    chars.forEach((ch, i) => g.fillText(ch, W / 2, 20 + fs / 2 + i * ((H - 40) / chars.length)));
    g.restore();
    return r;
  }
  // stall menu / price board
  _menu(title, price, style) {
    const r = this.alloc(256, 128), g = this.g;
    g.save(); g.translate(r.x, r.y);
    g.fillStyle = style.bg; g.fillRect(0, 0, 256, 128);
    g.fillStyle = style.fg; g.font = `700 48px ${KFONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(title, 128, 52, 236);
    g.font = `500 26px ${KFONT}`; g.globalAlpha = 0.85; g.fillText(price, 128, 102); g.restore();
    return r;
  }
  // shop interior (seen through glass storefront)
  _interior(seed) {
    const R = rng(seed);
    const r = this.alloc(384, 168), g = this.g;
    g.save(); g.translate(r.x, r.y); g.scale(0.75, 0.75);
    const warm = R() > 0.5;
    const grd = g.createLinearGradient(0, 0, 0, 224);
    grd.addColorStop(0, warm ? '#fff3e2' : '#eef4ff'); grd.addColorStop(1, warm ? '#b49478' : '#8a95a8');
    g.fillStyle = grd; g.fillRect(0, 0, 512, 224);
    for (let s = 0; s < 4; s++) {
      const y = 40 + s * 44;
      g.fillStyle = 'rgba(40,30,30,0.35)'; g.fillRect(10, y + 30, 492, 4);
      for (let x = 14; x < 500; x += 8 + R() * 10) {
        const hue = (R() * 360) | 0;
        g.fillStyle = `hsl(${hue},${40 + R() * 40}%,${45 + R() * 30}%)`;
        const h = 10 + R() * 18; g.fillRect(x, y + 30 - h, 5 + R() * 6, h);
      }
    }
    g.fillStyle = 'rgba(0,0,0,0.25)';
    for (let k = 0; k < 3; k++) { const x = R() * 480; g.beginPath(); g.ellipse(x, 190, 10, 26, 0, 0, 7); g.fill(); g.beginPath(); g.arc(x, 155, 8, 0, 7); g.fill(); }
    g.restore();
    return r;
  }
  texture() { return tex(this.canvas, { aniso: 8 }); }
}

export const SIGN_STYLES = [
  { fg: '#fff1dc', box: false }, { fg: '#ff6aa8', box: false }, { fg: '#58e3ff', box: false },
  { fg: '#ffbe5c', box: false }, { fg: '#ffffff', box: true, bg: '#d6264a' }, { fg: '#1a1a1a', box: true, bg: '#f4efe6' },
  { fg: '#ffffff', box: true, bg: '#1b6fd8' }, { fg: '#ffffff', box: true, bg: '#0f9e7a' }, { fg: '#ff4d6d', box: false },
  { fg: '#9df7d0', box: false }, { fg: '#111', box: true, bg: '#ffd23f' },
];
export const SHOP_WORDS = ['화장품', '스킨케어 라운지', '마스크팩 전문점', '명동 뷰티', '환전소', '약국', '안경', '기념품', '카페 2030', '편의점', '한방 화장품', '네일 살롱', '신발', 'K-POP 굿즈', '면세 화장품', '향수 공방', '포토 스튜디오', '디저트 하우스', '라멘', '치킨 & 맥주', '선크림 전문', '헤어 살롱', '모자 · 잡화', '전통 차'];
export const BLADE_WORDS = ['화장품', '뷰티', '환전', '카페', '호텔', '약국', '노래방', '한식당', '안경', '기념품', '네일', '스파', '피부과', '분식', '게스트하우스', '마사지'];
export const STALL_MENU = [['떡볶이', '4,000원'], ['닭꼬치', '5,000원'], ['호떡', '2,000원'], ['어묵', '3,000원'], ['회오리감자', '5,000원'], ['계란빵', '2,500원'], ['붕어빵', '3개 2,000원'], ['탕후루', '4,000원'], ['군만두', '5,000원'], ['랍스터구이', '15,000원']];

// ---------------------------------------------------------------- ground paving
export function makePaving() {
  const S = 1024;
  const [c, g] = canvas(S, S);
  const [r, gr] = canvas(S, S);
  const R = rng(3);
  const n = 8, t = S / n;
  g.fillStyle = '#0d0d10'; g.fillRect(0, 0, S, S);
  gr.fillStyle = '#e0e0e0'; gr.fillRect(0, 0, S, S);
  for (let j = 0; j < n; j++) for (let i = 0; i < n * 2; i++) {
    const off = (j % 2) * t / 2;
    const x = i * t / 2 * 1 + off - t / 2, y = j * t;
    const w = t / 2 - 3;
    const v = 34 + R() * 14;
    g.fillStyle = `rgb(${v},${v},${v + 4})`;
    g.fillRect(x + 2, y + 2, w, t - 4);
    for (let k = 0; k < 40; k++) { g.fillStyle = `rgba(255,255,255,${R() * 0.05})`; g.fillRect(x + R() * w, y + R() * t, 2, 2); }
    const rv = 70 + R() * 50;
    gr.fillStyle = `rgb(${rv},${rv},${rv})`; gr.fillRect(x + 2, y + 2, w, t - 4);
  }
  // puddles — smooth areas for wet reflections
  for (let k = 0; k < 9; k++) {
    const x = R() * S, y = R() * S, rad = 40 + R() * 120;
    const grd = gr.createRadialGradient(x, y, 0, x, y, rad);
    grd.addColorStop(0, 'rgba(10,10,10,0.95)'); grd.addColorStop(1, 'rgba(10,10,10,0)');
    gr.fillStyle = grd; gr.beginPath(); gr.arc(x, y, rad, 0, 7); gr.fill();
    const g2 = g.createRadialGradient(x, y, 0, x, y, rad);
    g2.addColorStop(0, 'rgba(0,0,0,0.35)'); g2.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = g2; g.beginPath(); g.arc(x, y, rad, 0, 7); g.fill();
  }
  return { map: tex(c, { repeat: true, aniso: 8 }), rough: tex(r, { srgb: false, repeat: true, aniso: 8 }) };
}

// ---------------------------------------------------------------- ambulance livery
export function makeAmbulanceLivery() {
  const [c, g] = canvas(1024, 256);
  g.fillStyle = '#f4f5f6'; g.fillRect(0, 0, 1024, 256);
  // stripes (Korean 119 style: red + orange band)
  g.fillStyle = '#d7192a'; g.fillRect(0, 150, 1024, 30);
  g.fillStyle = '#f07a12'; g.fillRect(0, 184, 1024, 10);
  g.fillStyle = '#d7192a';
  g.font = `800 64px ${KFONT}`; g.textBaseline = 'middle';
  g.fillText('119 구급대', 360, 96);
  g.font = `600 22px ${KFONT}`; g.fillStyle = '#334';
  g.fillText('EMERGENCY MEDICAL SERVICE', 364, 138);
  // star of life
  g.save(); g.translate(250, 96); g.fillStyle = '#1f5fd1';
  for (let i = 0; i < 3; i++) { g.save(); g.rotate(i * Math.PI / 3); g.fillRect(-11, -46, 22, 92); g.restore(); }
  g.fillStyle = '#fff'; g.fillRect(-3, -30, 6, 60); g.restore();
  // door seams
  g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 3;
  [180, 470, 720].forEach(x => { g.beginPath(); g.moveTo(x, 20); g.lineTo(x, 240); g.stroke(); });
  return tex(c);
}

export function makeRearLivery() {
  const [c, g] = canvas(512, 512);
  g.fillStyle = '#f4f5f6'; g.fillRect(0, 0, 512, 512);
  g.fillStyle = '#d7192a'; g.fillRect(0, 300, 512, 54);
  g.font = `800 120px ${KFONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('119', 256, 170);
  g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = 4; g.beginPath(); g.moveTo(256, 20); g.lineTo(256, 500); g.stroke();
  return tex(c);
}
