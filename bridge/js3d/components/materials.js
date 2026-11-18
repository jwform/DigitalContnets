import * as THREE from 'three';
import { COLORS } from '../config/settings.js';

/*
 * 제품 재질
 *  BODY    : 고급 무광 폴리머 (소프트터치 플라스틱) — 거의 검정에 가까운 차콜, 낮은 metalness,
 *            미세 표면 텍스처(노멀/러프니스 변화) + sheen으로 모서리의 부드러운 하이라이트
 *  ACRYLIC : 투명 아크릴 — 굴절(transmission), 내부 반사, 가장자리에서만 강해지는 바이올렛 엣지 라이트(프레넬)
 *  LED     : 밝은 코어(톤매핑 제외) — 주변 조명/바닥 반사광은 씬의 광원과 바닥 글로우가 담당
 */
let micro = null;
function microTextures() {
  if (micro) return micro;
  const S = 256;
  const c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d');
  const img = g.createImageData(S, S);
  const h = new Float32Array(S * S);
  for (let i = 0; i < S * S; i++) h[i] = Math.random();
  // blur once for a fine, soft grain
  const hb = new Float32Array(S * S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    let s = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) s += h[((y + dy + S) % S) * S + ((x + dx + S) % S)];
    hb[y * S + x] = s / 9;
  }
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const i = y * S + x;
    const dx = hb[y * S + (x + 1) % S] - hb[i], dy = hb[((y + 1) % S) * S + x] - hb[i];
    img.data[i * 4] = 128 + dx * 255; img.data[i * 4 + 1] = 128 + dy * 255; img.data[i * 4 + 2] = 255; img.data[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const normal = new THREE.CanvasTexture(c);
  normal.wrapS = normal.wrapT = THREE.RepeatWrapping; normal.repeat.set(10, 10);
  const c2 = document.createElement('canvas'); c2.width = c2.height = S;
  const g2 = c2.getContext('2d');
  const img2 = g2.createImageData(S, S);
  for (let i = 0; i < S * S; i++) {
    const v = 150 + (hb[i] - 0.5) * 70 + (Math.random() - 0.5) * 10;   // roughness ≈ 0.59 ± 0.07
    img2.data[i * 4] = img2.data[i * 4 + 1] = img2.data[i * 4 + 2] = v; img2.data[i * 4 + 3] = 255;
  }
  g2.putImageData(img2, 0, 0);
  const rough = new THREE.CanvasTexture(c2);
  rough.wrapS = rough.wrapT = THREE.RepeatWrapping; rough.repeat.set(6, 6);
  micro = { normal, rough };
  return micro;
}

export function createProductMaterials(quality = 'studio') {
  const { normal, rough } = microTextures();
  const body = new THREE.MeshPhysicalMaterial({
    color: 0x1a1a1f, metalness: 0.04, roughness: 0.64, roughnessMap: rough,
    normalMap: normal, normalScale: new THREE.Vector2(0.06, 0.06),
    clearcoat: 0.12, clearcoatRoughness: 0.62,
    sheen: 0.35, sheenRoughness: 0.75, sheenColor: new THREE.Color(0x3a3644),
    specularIntensity: 0.55, envMapIntensity: quality === 'city' ? 0.9 : 1.15,
  });
  const led = new THREE.MeshStandardMaterial({
    color: 0x14081f, emissive: new THREE.Color(0xc27bff), emissiveIntensity: 0,
    roughness: 0.3, metalness: 0.0, toneMapped: false,
  });
  let acrylic;
  if (quality === 'studio') {
    acrylic = new THREE.MeshPhysicalMaterial({
      color: 0xffffff, metalness: 0, roughness: 0.03, transmission: 1, thickness: 0.05,
      ior: 1.49, attenuationColor: new THREE.Color(0xd9c7ff), attenuationDistance: 1.4,
      specularIntensity: 1, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.4,
      emissive: new THREE.Color(0x000000), transparent: true, side: THREE.DoubleSide,
    });
  } else {
    acrylic = new THREE.MeshPhysicalMaterial({
      color: 0xeae4ff, metalness: 0.0, roughness: 0.04, transparent: true, opacity: 0.16,
      ior: 1.49, clearcoat: 1, envMapIntensity: 1.6, depthWrite: false,
      emissive: new THREE.Color(0x000000), side: THREE.DoubleSide,
    });
  }
  addEdgeGlow(acrylic);
  const edge = { color: new THREE.Color(COLORS.bright).multiplyScalar(2.4) };
  return { body, led, acrylic, edge };
}

// 가장자리(시선과 표면이 스치는 각도)에서만 바이올렛 빛이 강해지도록 — 면 가운데는 투명하게 유지
export function addEdgeGlow(m) {
  m.userData.edge = { value: 0 };
  m.userData.edgeColor = { value: new THREE.Color(0xb45cff).multiplyScalar(2.2) };
  m.onBeforeCompile = sh => {
    sh.uniforms.uEdge = m.userData.edge;
    sh.uniforms.uEdgeColor = m.userData.edgeColor;
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uEdge; uniform vec3 uEdgeColor;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        float fres = pow(1.0 - abs(dot(normalize(normal), normalize(vViewPosition))), 3.0);
        totalEmissiveRadiance += uEdgeColor * fres * uEdge;`);
  };
  m.customProgramCacheKey = () => 'edgeglow';
  return m;
}

export const ramp = (x, a, b) => Math.min(1, Math.max(0, (x - a) / (b - a)));
export const smooth = t => t * t * (3 - 2 * t);
export const easeInOutSine = t => -(Math.cos(Math.PI * t) - 1) / 2;
export const lerp = (a, b, t) => a + (b - a) * t;
