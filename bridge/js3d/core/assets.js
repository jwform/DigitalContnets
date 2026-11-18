import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ASSETS, OPEN_PARTS, OPEN_STATIC_EXCLUDE, CLOSED_PARTS } from '../config/settings.js';

// GLB의 노드를 인덱스 순서 그대로 가져와 지오메트리 배열로 변환
function b64ToBuffer(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}
async function loadGLTF(url, key, onProgress) {
  const loader = new GLTFLoader();
  try {
    return await loader.loadAsync(url, onProgress);
  } catch (e) {
    // 일부 호스팅(예: 아티팩트 미리보기)은 .glb를 서빙하지 않으므로 같은 모델의 base64 번들로 대체
    if (!window.EPCS_MODELS) {
      await new Promise((res, rej) => {
        const sc = document.createElement('script');
        sc.src = 'assets/models/models.bundle.js';
        sc.onload = res; sc.onerror = rej;
        document.head.appendChild(sc);
      });
    }
    const bundle = window.EPCS_MODELS;
    onProgress && onProgress({ loaded: 1, total: 1 });
    return await loader.parseAsync(b64ToBuffer(bundle[key]), '');
  }
}

async function loadNodes(url, key, onProgress) {
  const gltf = await loadGLTF(url, key, onProgress);
  const parser = gltf.parser;
  const count = parser.json.nodes.length;
  const nodes = [];
  for (let i = 0; i < count; i++) {
    const obj = await parser.getDependency('node', i);
    const geoms = [];
    obj.updateMatrixWorld(true);
    obj.traverse(o => {
      if (o.isMesh) {
        const g = o.geometry.clone();
        if (o !== obj) g.applyMatrix4(o.matrix);
        geoms.push(g);
      }
    });
    nodes.push(geoms);
  }
  return nodes;
}

function merge(nodes, indices) {
  const list = [];
  indices.forEach(i => nodes[i] && list.push(...nodes[i]));
  const g = mergeGeometries(list, false);
  g.computeBoundingBox();
  return g;
}

export async function loadProductAssets(progress) {
  let pOpen = 0, pClosed = 0;
  const report = () => progress && progress((pOpen + pClosed) / 2);
  const [open, closed] = await Promise.all([
    loadNodes(ASSETS.openModel, 'OPEN_GLB', e => { if (e.total) { pOpen = e.loaded / e.total; report(); } }),
    loadNodes(ASSETS.closedModel, 'CLOSED_GLB', e => { if (e.total) { pClosed = e.loaded / e.total; report(); } }),
  ]);

  const parts = {};
  for (const [k, idx] of Object.entries(OPEN_PARTS)) {
    if (k === 'stripL' || k === 'stripR') parts[k] = idx.map(i => merge(open, [i]));
    else parts[k] = merge(open, idx);
  }
  const staticIdx = open.map((_, i) => i).filter(i => !OPEN_STATIC_EXCLUDE.includes(i));
  parts.body = merge(open, staticIdx);

  const closedLed = [...CLOSED_PARTS.led, ...CLOSED_PARTS.bands];
  const closedParts = {
    body: merge(closed, closed.map((_, i) => i).filter(i => !closedLed.includes(i))),
    led: merge(closed, CLOSED_PARTS.led),
    bands: merge(closed, CLOSED_PARTS.bands),
  };
  return { parts, closedParts };
}
