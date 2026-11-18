import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// 정적 지오메트리를 재질별로 모아 하나의 드로우콜로 병합 (도시 성능 최적화)
export class Batch {
  constructor() { this.lists = new Map(); }
  add(key, geometry, matrix, color) {
    let g = geometry.index ? geometry.toNonIndexed() : geometry.clone();
    if (matrix) g.applyMatrix4(matrix);
    for (const name of Object.keys(g.attributes)) {
      if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
    }
    if (!g.attributes.uv) {
      g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    }
    const c = new THREE.Color(color ?? 0xffffff);
    const n = g.attributes.position.count;
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    if (!this.lists.has(key)) this.lists.set(key, []);
    this.lists.get(key).push(g);
    return g;
  }
  build(materials, parent, { cast = false, receive = true } = {}) {
    const out = {};
    for (const [key, list] of this.lists) {
      if (!list.length || !materials[key]) continue;
      const geo = mergeGeometries(list, false);
      geo.computeBoundingSphere();
      const mesh = new THREE.Mesh(geo, materials[key]);
      mesh.castShadow = cast; mesh.receiveShadow = receive;
      parent.add(mesh);
      out[key] = mesh;
    }
    return out;
  }
}

export const M4 = new THREE.Matrix4();
export function mat(x, y, z, ry = 0, rx = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  const m = new THREE.Matrix4();
  m.compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
  return m;
}

// PlaneGeometry with uv remapped into an atlas rectangle
export function atlasPlane(w, h, r) {
  const g = new THREE.PlaneGeometry(w, h);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, r.u0 + uv.getX(i) * (r.u1 - r.u0), r.v0 + uv.getY(i) * (r.v1 - r.v0));
  }
  return g;
}

// seeded random
export function rng(seed = 1) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}
