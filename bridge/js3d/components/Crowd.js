import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { rng } from '../core/batch.js';
import { LAYOUT } from '../config/settings.js';

/*
 * Crowd v2 — 세미 스타일라이즈드 도시 캐릭터 시스템 (인스턴싱)
 *
 * 형태 : 단면 로프트(타원 링을 쌓아 만든 매끄러운 메시)로 인체·의상을 제작
 *        어깨·쇄골·가슴·허리가 있는 몸통, 목, 턱선·코·귀가 있는 머리, 테이퍼진 팔다리, 손
 *        의상은 몸 위에 두께를 가진 별도 메시: 오버사이즈 재킷 / 롱코트(상의+자락) / 후드(+후드) /
 *        크롭 가죽 재킷 / 티셔츠, 슬림·와이드·카고 팬츠, 스커트, 스니커즈·부츠
 *        헤어: 크롭·사이드파트·롱·단발·번·비니 / 소품: 백팩·크로스백·쇼핑백·안경·시계·카고 포켓
 * 재질 : 면, 울(시른), 테크 나일론, 소프트 가죽, 데님, 피부, 헤어, 금속 — 재질마다 다른 빛 반응
 *        + 보라 네온 방향의 약한 림라이트 (도시 조명과 함께 실루엣과 의상 형태를 구분)
 * 동작 : 골반 흔들림·상체 역회전·팔꿈치 지연·발목 롤·머리 안정화가 있는 보행 주기,
 *        사람마다 다른 속도/보폭/방향, 부드러운 방향 전환, 서로 겹치지 않는 회피,
 *        긴급 신호 인지 → 고개 돌림 → 멈춤 → 통로 밖으로 이동
 * LOD  : 카메라 거리에 따라 디테일 파츠(손·소품·헤어 자락·포켓)를 생략, 원거리는 숨김
 */

// ------------------------------------------------------------------ geometry helpers
// rings: [y, rx, rz, cz=0, cx=0]
function loft(rings, seg = 18, { capTop = true, capBottom = true } = {}) {
  const pos = [], idx = [];
  rings.forEach(([y, rx, rz, cz = 0, cx = 0]) => {
    for (let j = 0; j < seg; j++) {
      const a = j / seg * Math.PI * 2;
      pos.push(cx + Math.sin(a) * rx, y, cz + Math.cos(a) * rz);
    }
  });
  for (let i = 0; i < rings.length - 1; i++) {
    for (let j = 0; j < seg; j++) {
      const a = i * seg + j, b = i * seg + (j + 1) % seg, c = (i + 1) * seg + j, d = (i + 1) * seg + (j + 1) % seg;
      if (rings[i][0] > rings[i + 1][0]) idx.push(a, c, b, b, c, d); else idx.push(a, b, c, b, d, c);
    }
  }
  const down = rings[0][0] > rings[rings.length - 1][0];
  const cap = (ri, top) => {
    const [y, , , cz = 0, cx = 0] = rings[ri];
    const ci = pos.length / 3; pos.push(cx, y, cz);
    for (let j = 0; j < seg; j++) {
      const a = ri * seg + j, b = ri * seg + (j + 1) % seg;
      const up = top !== down;
      if (up) idx.push(ci, a, b); else idx.push(ci, b, a);
    }
  };
  if (capBottom) cap(0, false);
  if (capTop) cap(rings.length - 1, true);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
const scaleRings = (r, sx, sz, extra = []) => [...r.map(([y, rx, rz, cz = 0, cx = 0]) => [y, rx * sx, rz * sz, cz, cx]), ...extra];
const merge = list => mergeGeometries(list.map(g => { const n = g.index ? g : g; n.deleteAttribute('uv'); return n; }), false);
function ellipsoid(rx, ry, rz, x, y, z, ws = 12, hs = 8) {
  const g = new THREE.SphereGeometry(1, ws, hs); g.scale(rx, ry, rz); g.translate(x, y, z); return g;
}
function box(w, h, d, x, y, z, rz = 0, rx = 0) {
  const g = new THREE.BoxGeometry(w, h, d); if (rz) g.rotateZ(rz); if (rx) g.rotateX(rx); g.translate(x, y, z); return g;
}
// foot loft along +z (forward)
function foot(rings) { // [z, rx, ry, cy]
  const g = loft(rings.map(([z, rx, ry, cy]) => [z, rx, ry, cy]), 14);
  g.rotateX(Math.PI / 2);
  return g;
}

// ------------------------------------------------------------------ body + garment library (bone-local)
const TORSO = [[-0.10, .150, .098], [0.0, .148, .096], [0.1, .136, .090, .004], [0.22, .150, .100, .008], [0.34, .170, .108, .012], [0.44, .184, .108, .008], [0.5, .178, .098, 0], [0.555, .12, .075, -.005], [0.59, .062, .056, -.008]];
function buildGeometry() {
  const G = {};
  G.tee = loft(scaleRings(TORSO, 1.03, 1.05));
  G.jacketOS = loft([[-0.17, .182, .132, .006], [-0.14, .188, .136, .006], [0.0, .186, .132, .006], [0.2, .19, .132, .01], [0.4, .212, .132, .01], [0.48, .228, .124, 0], [0.55, .17, .1, -.004], [0.6, .09, .082, -.01], [0.645, .086, .078, -.014]], 20, { capTop: false });
  G.coatTop = loft([[-0.06, .17, .118], [0.1, .158, .108, .004], [0.26, .172, .114, .01], [0.42, .198, .118, .008], [0.5, .2, .108], [0.56, .14, .086, -.004], [0.61, .095, .085, -.01], [0.66, .092, .082, -.016]], 20, { capTop: false });
  G.hoodie = loft([[-0.16, .168, .118], [-0.12, .176, .124, .004], [0.1, .17, .118, .006], [0.3, .186, .124, .012], [0.46, .205, .118, .006], [0.53, .185, .102], [0.58, .11, .08, -.006], [0.6, .066, .06, -.008]]);
  G.crop = loft([[0.16, .158, .106, .008], [0.2, .164, .11, .008], [0.32, .182, .118, .012], [0.45, .198, .116, .008], [0.52, .19, .104], [0.565, .13, .08, -.005], [0.61, .085, .075, -.01], [0.63, .082, .072, -.012]], 20, { capTop: false });
  G.hood = loft([[0.5, .085, .05, -.1], [0.56, .118, .075, -.115], [0.64, .112, .07, -.112], [0.7, .08, .05, -.1], [0.73, .03, .02, -.09]]);
  // pelvis-bone garments
  G.hips = loft([[0.12, .148, .098], [0.04, .158, .104], [-0.05, .158, .102], [-0.12, .13, .092], [-0.15, .08, .07]]);
  G.coatSkirt = loft([[0.12, .172, .12], [-0.08, .186, .132], [-0.34, .206, .15, .004], [-0.6, .226, .164, .006], [-0.62, .222, .16, .006]], 22);
  G.skirt = loft([[0.1, .15, .102], [-0.05, .172, .12], [-0.28, .214, .158], [-0.4, .228, .168]], 22);
  // arms (shoulder / elbow bone local, pointing -y)
  G.uaFit = loft([[0.06, .02, .02], [0.045, .056, .058], [0.0, .062, .064], [-0.15, .052, .054], [-0.29, .046, .048]]);
  G.uaWide = loft([[0.06, .03, .03], [0.04, .074, .076], [0.0, .082, .084], [-0.15, .076, .078], [-0.3, .07, .072]]);
  G.uaCoat = loft([[0.06, .028, .028], [0.04, .066, .068], [0.0, .072, .074], [-0.15, .066, .068], [-0.3, .06, .062]]);
  G.faFit = loft([[0.03, .046, .048], [-0.12, .045, .047], [-0.24, .038, .04], [-0.265, .04, .042]]);
  G.faWide = loft([[0.03, .068, .07], [-0.14, .066, .068], [-0.255, .064, .066], [-0.27, .058, .06]]);
  G.faCoat = loft([[0.03, .06, .062], [-0.25, .058, .06], [-0.27, .054, .056]]);
  G.faSkin = loft([[0.03, .042, .044], [-0.12, .04, .041], [-0.25, .03, .031]]);
  G.hand = merge([ellipsoid(.042, .072, .026, 0, -0.32, .004), ellipsoid(.014, .032, .014, .028, -0.3, .022)]);
  // legs (hip / knee bone local)
  G.thSlim = loft([[0.05, .082, .084], [-0.05, .084, .088], [-0.25, .072, .074], [-0.44, .057, .06]]);
  G.thWide = loft([[0.05, .09, .092], [-0.2, .09, .09], [-0.44, .084, .084]]);
  G.thCargo = loft([[0.05, .09, .092], [-0.22, .088, .088], [-0.44, .076, .078]]);
  G.shSlim = loft([[0.03, .056, .058], [-0.1, .055, .06, -.005], [-0.3, .043, .045], [-0.42, .04, .042]]);
  G.shWide = loft([[0.03, .082, .082], [-0.25, .086, .088], [-0.41, .092, .094]]);
  G.shCargo = loft([[0.03, .074, .074], [-0.33, .068, .068], [-0.36, .058, .058], [-0.42, .054, .054]]);
  G.pocket = box(.075, .1, .028, 0, -0.2, .088);
  // shoes (ankle bone local, foot forward +z)
  const sneakerFoot = foot([[-0.075, .03, .02, .02], [-0.06, .045, .042, .028], [-0.02, .05, .052, .03], [0.06, .052, .044, .044], [0.13, .046, .03, .055], [0.165, .028, .016, .062]]);
  const sole = foot([[-0.08, .05, .012, .066], [0.17, .05, .012, .066]]);
  G.sneaker = merge([sneakerFoot, sole]);
  G.boot = merge([loft([[0.12, .05, .052], [0.0, .052, .056], [-0.03, .053, .058]]), foot([[-0.075, .034, .02, .02], [-0.06, .048, .046, .028], [0.06, .054, .046, .044], [0.14, .046, .03, .055], [0.172, .026, .016, .062]]), foot([[-0.085, .054, .016, .07], [0.18, .054, .016, .07]])]);
  // head (head bone local: base of skull)
  const skull = loft([[0.0, .042, .048, .014], [0.03, .058, .068, .022], [0.07, .072, .088, .016], [0.11, .083, .098, .008], [0.15, .088, .102], [0.19, .083, .096, -.006], [0.225, .064, .076, -.008], [0.25, .032, .04, -.008], [0.258, .004, .005, -.006]], 22);
  const nose = new THREE.ConeGeometry(.016, .04, 8); nose.rotateX(Math.PI / 2); nose.translate(0, .105, .108);
  G.head = merge([skull, nose, ellipsoid(.014, .028, .02, .091, .12, -.004, 8, 6), ellipsoid(.014, .028, .02, -.091, .12, -.004, 8, 6)]);
  G.neck = loft([[-0.02, .048, .048], [0.13, .043, .043]]);
  // hair
  const cap = [[0.13, .093, .107, -.004], [0.18, .095, .109, -.008], [0.23, .08, .093, -.01], [0.265, .047, .058, -.01], [0.282, .004, .005, -.01]];
  G.hairCrop = loft(cap, 22, { capBottom: false });
  G.hairSide = merge([loft(cap.map(([y, a, b, c]) => [y + 0.006, a * 1.03, b * 1.03, c, .006]), 22, { capBottom: false }), ellipsoid(.07, .022, .03, .02, .2, .085)]);
  G.hairLong = merge([loft(cap, 22, { capBottom: false }), loft([[0.21, .096, .07, -.045], [0.08, .102, .066, -.06], [-0.06, .1, .055, -.07], [-0.2, .085, .04, -.07], [-0.23, .06, .025, -.065]], 18)]);
  G.hairBob = merge([loft(cap.map(([y, a, b, c]) => [y, a * 1.06, b * 1.04, c]), 22, { capBottom: false }), loft([[0.2, .1, .07, -.04], [0.1, .106, .072, -.045], [0.03, .1, .066, -.045], [0.01, .09, .058, -.04]], 18)]);
  G.hairBun = merge([loft(cap, 22, { capBottom: false }), ellipsoid(.05, .048, .05, 0, .25, -.075)]);
  G.beanie = merge([loft([[0.145, .099, .113, -.004], [0.2, .1, .113, -.008], [0.26, .084, .096, -.01], [0.3, .045, .055, -.012], [0.312, .004, .005, -.012]], 22, { capBottom: false }), loft([[0.13, .103, .117, -.004], [0.17, .103, .117, -.004]], 22)]);
  // accessories
  G.glasses = merge([box(.17, .034, .012, 0, .128, .1), box(.008, .012, .1, .085, .128, .05), box(.008, .012, .1, -.085, .128, .05)]);
  G.watch = new THREE.CylinderGeometry(.043, .043, .016, 16, 1, true); G.watch.translate(0, -0.23, 0);
  G.backpack = merge([loft([[0.12, .13, .055, -.17], [0.2, .14, .068, -.18], [0.4, .135, .065, -.18], [0.47, .1, .045, -.17]], 16), box(.03, .38, .015, .1, .32, -.11, 0, -0.15), box(.03, .38, .015, -.1, .32, -.11, 0, -0.15)]);
  G.crossbody = merge([loft([[-0.06, .07, .03, .125, .1], [0.06, .075, .032, .125, .1]], 12), box(.028, .68, .012, 0, .28, .118, 0.82)]);
  G.shopBag = merge([box(.24, .28, .09, 0, -0.52, .03), box(.012, .1, .012, .06, -0.35, .03), box(.012, .1, .012, -.06, -0.35, .03)]);
  G.shadow = new THREE.PlaneGeometry(0.95, 0.95).rotateX(-Math.PI / 2).translate(0, 0.012, 0);
  Object.entries(G).forEach(([n, g]) => { if (n !== 'shadow' && g.attributes.uv) g.deleteAttribute('uv'); g.computeBoundingSphere(); });
  return G;
}

// ------------------------------------------------------------------ materials (with violet neon rim)
function rim(m, strength = 0.35) {
  m.onBeforeCompile = sh => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      float rimF = pow(1.0 - abs(dot(normalize(normal), normalize(vViewPosition))), 2.6);
      float side = smoothstep(-0.25, 0.9, normalize(normal).x * 0.8 + normalize(normal).y * 0.35);
      totalEmissiveRadiance += vec3(0.42, 0.2, 0.95) * rimF * side * ${strength.toFixed(3)};`);
  };
  m.customProgramCacheKey = () => 'crowdrim' + strength;
  return m;
}
function materials() {
  return {
    cotton: rim(new THREE.MeshStandardMaterial({ roughness: 0.93, metalness: 0, envMapIntensity: 0.5 })),
    wool: rim(new THREE.MeshPhysicalMaterial({ roughness: 0.86, sheen: 0.8, sheenRoughness: 0.75, sheenColor: new THREE.Color(0x9a8cb8), envMapIntensity: 0.5 })),
    nylon: rim(new THREE.MeshPhysicalMaterial({ roughness: 0.4, clearcoat: 0.25, clearcoatRoughness: 0.5, sheen: 0.3, sheenColor: new THREE.Color(0xb8b0d0), specularIntensity: 0.9, envMapIntensity: 0.9 }), 0.4),
    leather: rim(new THREE.MeshPhysicalMaterial({ roughness: 0.36, clearcoat: 0.45, clearcoatRoughness: 0.35, envMapIntensity: 1.0 }), 0.42),
    denim: rim(new THREE.MeshStandardMaterial({ roughness: 0.88, envMapIntensity: 0.5 })),
    skin: rim(new THREE.MeshPhysicalMaterial({ roughness: 0.52, sheen: 0.35, sheenRoughness: 0.6, sheenColor: new THREE.Color(0xffc4a8), envMapIntensity: 0.55 }), 0.28),
    hair: rim(new THREE.MeshPhysicalMaterial({ roughness: 0.42, sheen: 1, sheenRoughness: 0.32, sheenColor: new THREE.Color(0x8c7aa8), envMapIntensity: 0.7 }), 0.45),
    rubber: rim(new THREE.MeshStandardMaterial({ roughness: 0.62, envMapIntensity: 0.6 }), 0.25),
    metal: new THREE.MeshStandardMaterial({ roughness: 0.28, metalness: 1, envMapIntensity: 1.2 }),
    paper: rim(new THREE.MeshStandardMaterial({ roughness: 0.8, envMapIntensity: 0.4 }), 0.2),
  };
}

// part → [geometry, material, bone(s), lodDetail]
const PARTS = {
  tee: ['tee', 'cotton', 'torso'], jacketOS: ['jacketOS', 'nylon', 'torso'], coatTop: ['coatTop', 'wool', 'torso'], hoodie: ['hoodie', 'cotton', 'torso'],
  crop: ['crop', 'leather', 'torso'], hood: ['hood', 'cotton', 'torso', 1],
  hips: ['hips', 'denim', 'pelvis'], coatSkirt: ['coatSkirt', 'wool', 'pelvis'], skirt: ['skirt', 'wool', 'pelvis'],
  uaFit: ['uaFit', 'cotton', 'sh'], uaLeather: ['uaFit', 'leather', 'sh'], uaWide: ['uaWide', 'nylon', 'sh'], uaHood: ['uaWide', 'cotton', 'sh'], uaCoat: ['uaCoat', 'wool', 'sh'],
  faFit: ['faFit', 'cotton', 'el'], faLeather: ['faFit', 'leather', 'el'], faWide: ['faWide', 'nylon', 'el'], faHood: ['faWide', 'cotton', 'el'], faCoat: ['faCoat', 'wool', 'el'], faSkin: ['faSkin', 'skin', 'el'],
  hand: ['hand', 'skin', 'el', 1],
  thSlim: ['thSlim', 'denim', 'hip'], thWide: ['thWide', 'wool', 'hip'], thCargo: ['thCargo', 'cotton', 'hip'], thTights: ['thSlim', 'denim', 'hip'],
  shSlim: ['shSlim', 'denim', 'kn'], shWide: ['shWide', 'wool', 'kn'], shCargo: ['shCargo', 'cotton', 'kn'], shTights: ['shSlim', 'denim', 'kn'],
  pocket: ['pocket', 'cotton', 'hip', 1],
  sneaker: ['sneaker', 'rubber', 'an'], boot: ['boot', 'leather', 'an'],
  head: ['head', 'skin', 'head'], neck: ['neck', 'skin', 'neck'],
  hairCrop: ['hairCrop', 'hair', 'head'], hairSide: ['hairSide', 'hair', 'head'], hairLong: ['hairLong', 'hair', 'head'], hairBob: ['hairBob', 'hair', 'head'], hairBun: ['hairBun', 'hair', 'head'], beanie: ['beanie', 'cotton', 'head'],
  glasses: ['glasses', 'metal', 'head', 1], watch: ['watch', 'metal', 'elL', 1],
  backpack: ['backpack', 'nylon', 'torso', 1], crossbody: ['crossbody', 'leather', 'torso', 1], shopBag: ['shopBag', 'paper', 'elR', 1],
};

// fashion archetypes (black · purple city palette with a few bright accents)
const ARCH = [
  { n: 'oversize', top: ['jacketOS'], ua: 'uaWide', fa: 'faWide', legs: ['wide', 'slim'], shoes: ['sneaker'], hair: ['hairCrop', 'hairSide'], acc: ['crossbody', null],
    top0: [0x111114, 0x1a1a20, 0x23232b], bottom: [0x15151a, 0x2a2a33, 0x3a3a42] },
  { n: 'violetCoat', top: ['coatTop'], skirt: 'coatSkirt', ua: 'uaCoat', fa: 'faCoat', legs: ['slim', 'tights'], shoes: ['boot'], hair: ['hairLong', 'hairBob', 'hairBun'], acc: ['shopBag', null, 'watch'],
    top0: [0x3b1d5c, 0x2a1645, 0x4a2470, 0x34204f], bottom: [0x121216, 0x1a1a20] },
  { n: 'hoodCargo', top: ['hoodie'], extra: ['hood'], ua: 'uaHood', fa: 'faHood', legs: ['cargo'], shoes: ['sneaker'], hair: ['hairCrop', 'beanie'], acc: ['backpack', 'backpack', null],
    top0: [0x6b6d74, 0x55575e, 0x8a8c93], bottom: [0x3c3a30, 0x1d1d20, 0x4a4a40] },
  { n: 'cropWide', top: ['crop'], inner: 'tee', ua: 'uaLeather', fa: 'faLeather', legs: ['wide', 'skirt'], shoes: ['sneaker', 'boot'], hair: ['hairBob', 'hairBun', 'hairLong'], acc: ['crossbody', 'watch', null],
    top0: [0x141416, 0x2b1d1a, 0x1c1826], bottom: [0xd6cdbd, 0x2e2a3a, 0x15151a] },
  { n: 'techwear', top: ['jacketOS'], ua: 'uaWide', fa: 'faWide', legs: ['cargo'], shoes: ['sneaker'], hair: ['hairCrop', 'hairSide', 'beanie'], acc: ['crossbody', 'glasses'],
    top0: [0xb9c3cc, 0x8fb4ff, 0xe4e0ef, 0xc6b4ff], bottom: [0x121214, 0x1d1d22] },
  { n: 'longcoat', top: ['coatTop'], skirt: 'coatSkirt', ua: 'uaCoat', fa: 'faCoat', legs: ['slim'], shoes: ['boot'], hair: ['hairSide', 'hairLong', 'hairCrop'], acc: ['glasses', 'watch', null],
    top0: [0x1a1a1f, 0x3a3128, 0x23202c], bottom: [0x121216, 0x1d1d22] },
  { n: 'tourist', top: ['tee', 'hoodie'], ua: 'uaFit', fa: 'faSkin', legs: ['slim', 'wide'], shoes: ['sneaker'], hair: ['hairCrop', 'hairLong', 'hairBob', 'beanie'], acc: ['shopBag', 'shopBag', 'backpack'],
    top0: [0xe8e4dc, 0x9aa3b5, 0xc9c1d8, 0x6f6a85], bottom: [0x2a3348, 0x1d2333, 0xcfc6b5] },
  { n: 'backpacker', top: ['crop', 'tee'], ua: 'uaFit', fa: 'faFit', legs: ['slim', 'cargo'], shoes: ['sneaker'], hair: ['hairBun', 'hairCrop', 'hairSide'], acc: ['backpack'],
    top0: [0x2d2a3a, 0x4b3f63, 0x1b1b22], bottom: [0x2a3348, 0x3c3a30] },
];
const SKIN = [0xe9c4a6, 0xd9ad8c, 0xc28f6c, 0xf1d2bb, 0x9c6b4e, 0xe0b897];
const HAIR = [0x0d0b0a, 0x1d1510, 0x2a1d14, 0x5a3e28, 0x1b1a1f, 0xb89a74, 0x4a2a5a, 0xd8d4dc];
const SHOE = [0xf0f0f2, 0x111114, 0x2a2224, 0x6a6d75];

export class Crowd {
  constructor(scene, count, seed = 11) {
    this.scene = scene; this.count = count;
    const R = this.R = rng(seed);
    const G = buildGeometry();
    const M = materials();
    const N = count;
    this.parts = {};
    for (const [name, [g, m, bone, lod]] of Object.entries(PARTS)) {
      const two = ['sh', 'el', 'hip', 'kn', 'an'].includes(bone);
      const im = new THREE.InstancedMesh(G[g], M[m], two ? N * 2 : N);
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      im.frustumCulled = false; im.castShadow = false; im.receiveShadow = false;
      scene.add(im);
      this.parts[name] = { im, bone, two, lod: !!lod, owner: new Int16Array(two ? N * 2 : N).fill(-1) };
    }
    // contact shadow blobs
    const sc = document.createElement('canvas'); sc.width = sc.height = 64;
    const sg = sc.getContext('2d'); const gr = sg.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(0,0,0,0.8)'); gr.addColorStop(0.55, 'rgba(0,0,0,0.35)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); sg.fillStyle = gr; sg.fillRect(0, 0, 64, 64);
    this.shadow = new THREE.InstancedMesh(G.shadow, new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sc), transparent: true, depthWrite: false }), N);
    this.shadow.frustumCulled = false; scene.add(this.shadow);

    // skeleton template
    const O = () => new THREE.Object3D();
    const k = this.k = { root: O(), pelvis: O(), torso: O(), neck: O(), head: O(), shL: O(), shR: O(), elL: O(), elR: O(), hipL: O(), hipR: O(), knL: O(), knR: O(), anL: O(), anR: O() };
    k.root.add(k.pelvis); k.pelvis.add(k.torso, k.hipL, k.hipR); k.torso.add(k.neck, k.shL, k.shR); k.neck.add(k.head);
    k.shL.add(k.elL); k.shR.add(k.elR); k.hipL.add(k.knL); k.hipR.add(k.knR); k.knL.add(k.anL); k.knR.add(k.anR);
    k.torso.position.y = 0.06; k.neck.position.y = 0.565; k.head.position.y = 0.115;
    k.shL.position.set(0.195, 0.495, -0.005); k.shR.position.set(-0.195, 0.495, -0.005);
    k.elL.position.y = -0.29; k.elR.position.y = -0.29;
    k.hipL.position.set(0.09, -0.02, 0); k.hipR.position.set(-0.09, -0.02, 0);
    k.knL.position.y = -0.44; k.knR.position.y = -0.44; k.anL.position.y = -0.43; k.anR.position.y = -0.43;

    // ---------------- people
    this.people = [];
    const half = LAYOUT.alleyHalf;
    const pick = a => a[(R() * a.length) | 0];
    for (let i = 0; i < N; i++) {
      const A = ARCH[i % ARCH.length];
      const p = { i, A };
      p.fem = A.n === 'violetCoat' || A.n === 'cropWide' ? R() < 0.85 : R() < 0.4;
      p.h = (p.fem ? 0.86 : 0.9) + R() * 0.08;
      p.w = (p.fem ? 0.9 : 1.0) + (R() - 0.3) * 0.14;
      const r = R();
      p.mode = r < 0.64 ? 'walk' : r < 0.84 ? 'browse' : 'chat';
      p.path = 'alley';
      if (p.mode === 'walk' && R() < 0.22) p.path = 'cross';
      if (p.path === 'alley') {
        p.z = R() < 0.55 ? 1.8 - R() * 18 : -10 - R() * 40;
        p.x = (R() * 2 - 1) * (half - 1.6);
        if (p.mode === 'browse') p.x = Math.sign(R() - 0.5) * (half - 0.9 - R() * 0.6);
      } else {
        p.z = R() < 0.5 ? 1.95 + R() * 0.5 : 9.6 + R() * 0.8;
        p.x = (R() * 2 - 1) * 38;
      }
      p.homeX = p.x; p.dir = R() < 0.5 ? 1 : -1;
      p.speed = p.mode === 'walk' ? 0.85 + R() * 0.7 : 0;
      p.stride = 0.85 + R() * 0.3;
      p.phase = R() * Math.PI * 2;
      p.yaw = p.path === 'alley' ? (p.dir > 0 ? 0 : Math.PI) : (p.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
      if (p.mode === 'browse') p.yaw = p.x > 0 ? Math.PI / 2 : -Math.PI / 2;
      p.vx = 0; p.vz = 0; p.headYaw = 0; p.headPitch = 0; p.seed = R() * 10;
      p.evacStart = 0.36 + R() * 0.34;
      p.react = R();          // reaction delay to the emergency signal
      p.lane = Math.abs(p.x) < 2.55 && p.path === 'alley';
      p.evacX = Math.sign(p.x || (R() - 0.5)) * (2.75 + R() * 1.45);
      p.arm = R() < 0.14 ? 'phone' : R() < 0.24 ? 'pocket' : 'swing';
      // outfit
      const legs = pick(A.legs);
      const o = p.o = [];
      const top = pick(A.top);
      o.push(top);
      if (A.inner && R() < 0.8) o.push(A.inner);
      if (A.extra) o.push(...A.extra);
      if (A.skirt) o.push(A.skirt);
      o.push(top === 'tee' ? 'uaFit' : top === 'hoodie' ? 'uaHood' : A.ua);
      o.push(top === 'tee' ? (R() < 0.5 ? 'faSkin' : 'faFit') : top === 'hoodie' ? 'faHood' : A.fa);
      o.push('hand', 'head', 'neck');
      if (legs === 'skirt') o.push('skirt', 'thTights', 'shTights');
      else if (legs === 'tights') o.push('thTights', 'shTights');
      else if (legs === 'wide') o.push('hips', 'thWide', 'shWide');
      else if (legs === 'cargo') o.push('hips', 'thCargo', 'shCargo', 'pocket');
      else o.push('hips', 'thSlim', 'shSlim');
      o.push(pick(A.shoes));
      const hair = pick(A.hair); o.push(hair);
      const acc = pick(A.acc); if (acc) o.push(acc);
      if (R() < 0.12 && !o.includes('glasses')) o.push('glasses');
      if (o.includes('shopBag')) p.arm = 'carry';
      const tint = c => new THREE.Color(c).offsetHSL(0, (R() - 0.5) * 0.05, (R() - 0.5) * 0.04);
      const C = p.c = {
        top: tint(pick(A.top0)), bottom: tint(pick(A.bottom)), skin: new THREE.Color(pick(SKIN)), hair: new THREE.Color(pick(HAIR)),
        shoe: new THREE.Color(pick(SHOE)), acc: tint(pick([0x111114, 0x2a2233, 0x6b4a2b, 0xd9d2c5, 0x3b1d5c])), metal: new THREE.Color(pick([0xc0c4cc, 0xb8a27a, 0x8f8a99])),
        inner: tint(pick([0xe8e4dc, 0x111114, 0x6f6a85, 0x2b2b33])), tights: new THREE.Color(pick([0x0e0e12, 0x1b1820, 0x2a2233])), bag: tint(pick([0xe9e3d5, 0x111114, 0x5b2a7a, 0xb8a27a])),
      };
      p.colorOf = name => {
        if (['tee'].includes(name) && A.inner) return C.inner;
        if (['tee', 'jacketOS', 'coatTop', 'hoodie', 'crop', 'hood', 'coatSkirt', 'uaFit', 'uaLeather', 'uaWide', 'uaHood', 'uaCoat', 'faFit', 'faLeather', 'faWide', 'faHood', 'faCoat'].includes(name)) return C.top;
        if (['hips', 'thSlim', 'thWide', 'thCargo', 'shSlim', 'shWide', 'shCargo', 'pocket', 'skirt'].includes(name)) return name === 'skirt' ? C.bottom : C.bottom;
        if (['thTights', 'shTights'].includes(name)) return C.tights;
        if (['hand', 'head', 'neck', 'faSkin'].includes(name)) return C.skin;
        if (name.startsWith('hair')) return C.hair;
        if (name === 'beanie') return C.acc;
        if (['sneaker', 'boot'].includes(name)) return C.shoe;
        if (['glasses', 'watch'].includes(name)) return C.metal;
        if (name === 'shopBag') return C.bag;
        return C.acc;
      };
      this.people.push(p);
    }
    for (let i = 0; i < N - 1; i++) {
      const a = this.people[i];
      if (a.mode === 'chat' && !a.partner) {
        const b = this.people[i + 1];
        b.mode = 'chat'; b.speed = 0; a.partner = b; b.partner = a;
        b.x = a.x + 0.75; b.z = a.z + 0.15; b.homeX = b.x; b.lane = a.lane; b.evacX = a.evacX + Math.sign(a.evacX) * 0.6; b.evacStart = a.evacStart + 0.02;
        a.yaw = Math.PI / 2; b.yaw = -Math.PI / 2;
      }
    }
    // assign instance slots + colors
    this.slots = this.people.map(p => {
      const list = [];
      for (const name of p.o) {
        const part = this.parts[name];
        if (!part) continue;
        if (part.two) {
          for (let s = 0; s < 2; s++) { part.im.setColorAt(p.i * 2 + s, p.colorOf(name)); }
        } else part.im.setColorAt(p.i, p.colorOf(name));
        list.push(name);
      }
      return list;
    });
    this.zero = new THREE.Matrix4().makeScale(0, 0, 0);
    for (const part of Object.values(this.parts)) {
      for (let j = 0; j < part.im.count; j++) part.im.setMatrixAt(j, this.zero);
      if (part.im.instanceColor) part.im.instanceColor.needsUpdate = true;
    }
    this.tmp = new THREE.Matrix4();
    this.links = null;
  }

  update(dt, time, ctx) {
    dt = Math.min(dt, 0.05);
    const k = this.k, half = LAYOUT.alleyHalf;
    const cam = ctx.camPos || new THREE.Vector3(0, 10, 10);
    const PP = this.people;
    // ---------------- steering (separation / crowd avoidance)
    for (let i = 0; i < this.count; i++) {
      const a = PP[i]; a.ax = 0; a.az = 0;
    }
    for (let i = 0; i < this.count; i++) {
      const a = PP[i];
      for (let j = i + 1; j < this.count; j++) {
        const b = PP[j];
        const dx = b.x - a.x, dz = b.z - a.z;
        if (Math.abs(dx) > 0.7 || Math.abs(dz) > 0.7) continue;
        const d = Math.hypot(dx, dz);
        if (d < 0.62 && d > 0.0001 && a.partner !== b) {
          const f = (0.62 - d) / 0.62 * 1.6;
          a.ax -= dx / d * f; a.az -= dz / d * f; b.ax += dx / d * f; b.az += dz / d * f;
        }
      }
    }
    const alert = ctx.alert || 0;
    for (let i = 0; i < this.count; i++) {
      const p = PP[i];
      // ---------------- locomotion targets
      let tvx = 0, tvz = 0;
      const reacting = alert > 0.05 + p.react * 0.6;
      if (p.path === 'cross') {
        tvx = p.dir * p.speed;
        if (p.x > 40) p.x = -40; if (p.x < -40) p.x = 40;
      } else {
        const e = p.lane ? ctx.evac(p) : 0;
        const tx = p.lane ? p.homeX + (p.evacX - p.homeX) * e : p.homeX;
        const dx = tx - p.x;
        tvx = Math.abs(dx) > 0.03 ? Math.max(-1.35, Math.min(1.35, dx * 2.0)) : 0;
        const stepping = Math.min(1, Math.abs(tvx) / 0.55);
        if (p.mode === 'walk') {
          // when the signal is noticed: slow down, stop, then step aside
          const hesitate = reacting && p.lane ? Math.max(0, 1 - stepping * 1.5) : 0;
          tvz = p.dir * p.speed * (1 - 0.85 * stepping) * (1 - 0.9 * hesitate);
          if (p.z > 1.9 && p.dir > 0) { p.path = 'cross'; p.z = 1.95 + this.R() * 0.5; p.dir = this.R() < 0.5 ? 1 : -1; p.homeX = p.x; }
          if (p.z < -58) p.dir = 1;
        }
        if (ctx.ambulance && ctx.ambulance.active && p.lane) {
          if (Math.abs(p.z - ctx.ambulance.z) < 4 && Math.abs(p.x) < 1.4) tvx += Math.sign(p.x || 1) * 1.2;
        }
      }
      if (p.path === 'cross' && p.mode === 'walk' && Math.abs(p.x) < 0.8 && p.z < 2.6 && this.R() < 0.004) {
        p.path = 'alley'; p.dir = -1; p.homeX = p.x; p.lane = Math.abs(p.x) < 2.55;
      }
      tvx += p.ax; tvz += p.az * 0.6;
      const a = 1 - Math.exp(-dt * 4.5);
      p.vx += (tvx - p.vx) * a; p.vz += (tvz - p.vz) * a;
      p.x += p.vx * dt; p.z += p.vz * dt;
      if (p.path === 'alley') p.x = Math.max(-half + 0.45, Math.min(half - 0.45, p.x));
      const sp = Math.hypot(p.vx, p.vz);
      let ty = p.yaw;
      if (sp > 0.12) ty = Math.atan2(p.vx, p.vz);
      else if (p.mode === 'browse') ty = p.x > 0 ? Math.PI / 2 : -Math.PI / 2;
      else if (p.partner) ty = Math.atan2(p.partner.x - p.x, p.partner.z - p.z);
      let d = ty - p.yaw; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
      p.yaw += d * Math.min(1, dt * (sp > 0.12 ? 3.2 : 1.6));
      const g = Math.min(1, sp / 1.15);
      p.phase += dt * (sp > 0.06 ? (1.6 + sp * 3.6 / p.stride) : 0);

      // ---------------- LOD
      const dist = Math.hypot(p.x - cam.x, p.z - cam.z, cam.y);
      const far = dist > 78, mid = dist > 36;

      // ---------------- head look (signal / partner / idle)
      let look = Math.sin(time * 0.35 + p.seed) * (p.mode === 'walk' ? 0.18 : 0.4);
      if (reacting) {
        const tx = Math.abs(p.x) < 1.95 ? Math.sign(p.x || 1) * LAYOUT.rowX : -Math.sign(p.x) * LAYOUT.rowX;
        let la = Math.atan2(tx - p.x, -2 - p.z) - p.yaw;
        if (ctx.ambulance && ctx.ambulance.show) la = Math.atan2(ctx.ambulance.x - p.x, ctx.ambulance.z - p.z) - p.yaw;
        while (la > Math.PI) la -= Math.PI * 2; while (la < -Math.PI) la += Math.PI * 2;
        look = Math.max(-1.1, Math.min(1.1, la));
      }
      p.headYaw += (look - p.headYaw) * Math.min(1, dt * 3);

      // ---------------- pose (natural gait)
      const s = Math.sin(p.phase), c = Math.cos(p.phase);
      const A = 0.48 * g * p.stride;
      const breath = Math.sin(time * 1.6 + p.seed) * 0.012;
      k.root.position.set(p.x, 0, p.z);
      k.root.rotation.set(0, p.yaw, 0);
      k.root.scale.set(p.h * p.w, p.h, p.h * p.w);
      k.pelvis.position.set(0.024 * g * s, 0.955 - 0.012 * g + 0.024 * g * Math.cos(2 * p.phase), 0);
      k.pelvis.rotation.set(0, 0.13 * g * s, 0.04 * g * c);
      k.torso.rotation.set(0.03 + 0.07 * g + breath, -0.22 * g * s, -0.035 * g * c);
      k.neck.rotation.set(-0.04 * g, 0.09 * g * s, 0);
      k.head.rotation.set((p.arm === 'phone' && !reacting ? 0.42 : 0.0) + 0.03 * Math.sin(2 * p.phase) * g, p.headYaw * 0.75, 0);
      k.neck.rotation.y += p.headYaw * 0.25;
      k.hipL.rotation.set(-A * s - 0.04 * g, 0, -0.02);
      k.hipR.rotation.set(A * s - 0.04 * g, 0, 0.02);
      k.knL.rotation.set(0.06 + g * (0.95 * Math.pow(Math.max(0, Math.sin(p.phase + 1.25)), 1.4) + 0.08), 0, 0);
      k.knR.rotation.set(0.06 + g * (0.95 * Math.pow(Math.max(0, Math.sin(p.phase + 1.25 + Math.PI)), 1.4) + 0.08), 0, 0);
      k.anL.rotation.set(-g * 0.28 * Math.sin(p.phase + 0.5), 0, 0);
      k.anR.rotation.set(g * 0.28 * Math.sin(p.phase + 0.5), 0, 0);
      const wide = p.o.includes('jacketOS') || p.o.includes('hoodie') ? 0.14 : 0.09;
      let aL = 0.42 * g * s + 0.04, aR = -0.42 * g * s + 0.04;
      let eL = -(0.18 + 0.12 * g + 0.45 * g * Math.max(0, -s)), eR = -(0.18 + 0.12 * g + 0.45 * g * Math.max(0, s));
      if (p.arm === 'phone' && !reacting) { aR = -0.5; eR = -1.45; }
      if (p.arm === 'pocket') { aL = aR = 0.16; eL = eR = -0.55; }
      if (p.arm === 'carry') { aR = 0.06 * g * s; eR = -0.08; }
      if (p.mode === 'chat') { aR = -0.25 + Math.sin(time * 1.7 + p.seed) * 0.16; eR = -0.95 + Math.sin(time * 2.3 + p.seed) * 0.2; }
      if (reacting && sp < 0.2 && p.lane) { aL = 0.05; aR = 0.05; eL = eR = -0.25; }
      k.shL.rotation.set(aL, 0, wide); k.shR.rotation.set(aR, 0, -wide);
      k.elL.rotation.set(eL, 0, 0); k.elR.rotation.set(eR, 0, 0);
      k.root.updateMatrixWorld(true);

      const boneOf = (b, side) => {
        switch (b) {
          case 'torso': return k.torso; case 'pelvis': return k.pelvis; case 'head': return k.head; case 'neck': return k.neck;
          case 'sh': return side ? k.shR : k.shL; case 'el': return side ? k.elR : k.elL;
          case 'hip': return side ? k.hipR : k.hipL; case 'kn': return side ? k.knR : k.knL; case 'an': return side ? k.anR : k.anL;
          case 'elL': return k.elL; case 'elR': return k.elR;
        }
        return k.torso;
      };
      for (const name of this.slots[i]) {
        const part = this.parts[name];
        const hide = far || (mid && part.lod);
        if (part.two) {
          part.im.setMatrixAt(i * 2, hide ? this.zero : boneOf(part.bone, 0).matrixWorld);
          part.im.setMatrixAt(i * 2 + 1, hide ? this.zero : boneOf(part.bone, 1).matrixWorld);
        } else part.im.setMatrixAt(i, hide ? this.zero : boneOf(part.bone).matrixWorld);
      }
      this.tmp.makeTranslation(p.x, 0, p.z);
      this.shadow.setMatrixAt(i, far ? this.zero : this.tmp);
    }
    for (const part of Object.values(this.parts)) part.im.instanceMatrix.needsUpdate = true;
    this.shadow.instanceMatrix.needsUpdate = true;
  }
}
