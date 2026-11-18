/* =====================================================================
   BRIDGE — user scenario, 6 stages (scroll progress p = 0..1)
   All coordinates are in the BRIDGE stall's local frame (metres):
     +x runs down the street along the stall row · +z points to the customer side (street) · -z is the vendor side
     the table (counter top) is at y = 1.05, BRIDGE stands on it at x = 0, z = -0.1
   ===================================================================== */
export const lerp = (a, b, t) => a + (b - a) * t;
export const clamp01 = v => Math.min(1, Math.max(0, v));
export const smooth = t => t * t * (3 - 2 * t);
export const ramp = (x, a, b) => clamp01((x - a) / (b - a));

export const STAGE_AT = [0, 0.17, 0.34, 0.51, 0.70, 0.86, 1.0];
export const stageOf = p => { let i = 0; for (let k = 1; k < 6; k++) if (p >= STAGE_AT[k]) i = k; return i; };

export const TEXT = [
  { no: '01', ko: '발견', en: 'DISCOVERY', core: '공용 AI를 통한 포장마차 탐색',
    body: '관광객이 명동 거리를 걷다 공용 MCU AI로 주변 포장마차를 탐색합니다. 시야에 포장마차의 위치, 메뉴, 영업 상태와 혼잡 현황이 나타납니다.' },
  { no: '02', ko: '마주함', en: 'APPROACH', core: '기본 정보 확인과 첫 눈맞춤',
    body: '관광객이 포장마차에 도착합니다. 디스플레이에 메뉴와 가격 같은 간단한 정보가 표시되고, 정보를 확인한 뒤 상인과 눈을 맞춥니다.' },
  { no: '03', ko: '오해', en: 'MISUNDERSTANDING', core: '언어 차이로 인한 세부 요청의 오해',
    body: '음식 두 개 중 하나는 맵지 않게 요청합니다. 상인은 수량은 이해하지만 세부 요청을 알아듣지 못해 잠시 망설입니다.' },
  { no: '04', ko: '이해', en: 'UNDERSTANDING', core: 'AI의 정보 지원과 사람 사이의 직접적인 확인',
    body: '중앙 버튼을 누르면 상단 조명이 퍼플로 바뀌고, 디스플레이에 짧은 번역이 표시됩니다. 두 사람은 내용을 확인하고 눈을 맞추며 고개를 끄덕입니다.' },
  { no: '05', ko: '전달', en: 'EXCHANGE', core: '디지털 정보가 실제 음식 전달로 이어지는 순간',
    body: '음식 준비가 끝나면 상단 조명이 라임색으로 바뀌고 디스플레이에 준비 완료 아이콘이 나타납니다. 상인은 열린 게이트 사이로 음식을 건네고, 관광객은 미소 지으며 받습니다.' },
  { no: '06', ko: '교감', en: 'CONNECTION', core: '기술의 개입 없이 완성되는 사람과 사람의 교감',
    body: '상인이 손짓으로 맛있게 먹으라고 표현하고, 관광객은 고개를 끄덕이며 감사 인사를 전합니다.' }
];

/* ---- camera: [p, position, look-at, linear?] ---- */
export const CAM = [
  [0.00, [-11, 1.65, 3.3], [-4, 1.8, 1.6], 1],
  [0.09, [-6.6, 1.65, 3.1], [0, 1.75, 1.4], 1],
  [0.17, [-2.7, 1.64, 2.8], [1.4, 1.5, 0.5]],
  [0.25, [-0.7, 1.62, 2.4], [0, 1.3, -0.05]],
  [0.31, [0.0, 1.6, 1.8], [0, 1.2, -0.1]],
  [0.345, [0.0, 1.64, 1.95], [0, 1.5, -0.85]],
  [0.39, [0.62, 1.72, 2.45], [0, 1.45, -0.6]],
  [0.51, [0.8, 1.68, 2.2], [0, 1.42, -0.7]],
  [0.54, [0.18, 1.44, 1.05], [0, 1.34, -0.1]],
  [0.60, [0.14, 1.42, 0.95], [0, 1.31, -0.1]],
  [0.645, [-2.5, 1.5, 0.5], [0, 1.45, 0.0]],
  [0.70, [-2.3, 1.5, 0.4], [0, 1.45, 0.0]],
  [0.74, [-0.95, 1.32, 1.05], [0, 1.2, -0.05]],
  [0.80, [0.7, 1.7, -2.0], [0, 1.35, 0.5]],
  [0.86, [0.75, 1.7, -2.05], [0, 1.35, 0.5]],
  [0.90, [1.0, 1.66, 2.7], [0, 1.45, -0.1]],
  [0.96, [3.0, 2.0, 6.4], [0, 1.4, 0]],
  [1.00, [4.4, 2.7, 9.2], [0, 1.6, -1.0]]
];
export function camAt(p, outPos, outLook) {
  let a = CAM[0], b = CAM[0], t = 0;
  if (p >= CAM[CAM.length - 1][0]) { a = b = CAM[CAM.length - 1]; }
  else for (let i = 1; i < CAM.length; i++) if (p <= CAM[i][0]) { a = CAM[i - 1]; b = CAM[i]; t = (p - a[0]) / (b[0] - a[0]); if (!b[3]) t = smooth(t); break; }
  for (let k = 0; k < 3; k++) { outPos[k] = lerp(a[1][k], b[1][k], t); outLook[k] = lerp(a[2][k], b[2][k], t); }
}

/* ---- poses: head [rx,ry,rz] · arms [rx (forward lift), rz (sideways)] · elbow [rx (bend)] · lean [rx] ---- */
const P = (head, shL, elL, shR, elR, lean) => ({ head, shL, elL, shR, elR, lean });
export const VENDOR = [
  [0.00, P([0.1, 0.3, 0], [-0.5, -0.1], [-0.8], [-0.9, 0.1], [-1.0], [0.12])],    // cooking
  [0.28, P([0.1, 0.25, 0], [-0.5, -0.1], [-0.8], [-0.9, 0.1], [-1.0], [0.12])],
  [0.345, P([0.04, 0, 0], [-0.2, -0.1], [-0.3], [-0.3, 0.15], [-0.3], [0.04])],   // looks at the customer
  [0.40, P([0.05, 0, 0.02], [-0.3, -0.1], [-0.5], [-0.4, 0.1], [-0.5], [0.06])],
  [0.45, P([0.05, 0, 0.3], [-0.5, -0.1], [-0.9], [-1.9, 0.15], [-1.6], [0.0])],   // hesitates, hand to chin
  [0.52, P([0.05, 0, 0.3], [-0.5, -0.1], [-0.9], [-1.9, 0.15], [-1.6], [0.0])],
  [0.60, P([0.0, 0, 0], [-0.9, -0.1], [-0.5], [-0.9, 0.1], [-0.5], [0.1])],       // understands
  [0.70, P([0.0, 0, 0], [-0.8, -0.1], [-0.7], [-0.8, 0.1], [-0.9], [0.15])],
  [0.77, P([0.0, 0, 0], [-0.9, -0.1], [-0.6], [-1.25, 0.0], [-0.2], [0.3])],      // hands the food over
  [0.83, P([0.0, 0, 0], [-0.9, -0.1], [-0.6], [-1.3, 0.0], [-0.1], [0.32])],
  [0.90, P([0.0, 0, -0.1], [-0.2, -0.1], [-0.3], [-1.0, 0.5], [-0.5], [0.05])],   // gestures "enjoy"
  [1.00, P([0.0, 0, -0.12], [-0.2, -0.1], [-0.3], [-1.0, 0.5], [-0.5], [0.05])]
];
export const TOURIST = [
  [0.00, P([0, 0, 0], [-0.1, -0.1], [-0.2], [-0.1, 0.1], [-0.2], [0])],
  [0.38, P([0, 0, 0], [-0.1, -0.1], [-0.2], [-0.1, 0.1], [-0.2], [0])],
  [0.43, P([0, 0.0, 0.04], [-0.1, -0.1], [-0.2], [-1.15, 0.1], [-0.6], [0.02])],  // points: two, one not spicy
  [0.50, P([0, 0.0, 0.04], [-0.1, -0.1], [-0.2], [-1.15, 0.1], [-0.6], [0.02])],
  [0.545, P([0, 0, 0], [-0.1, -0.1], [-0.2], [-1.5, 0.0], [-0.1], [0.34])],       // presses the button
  [0.585, P([0, 0, 0], [-0.1, -0.1], [-0.2], [-1.5, 0.0], [-0.1], [0.34])],
  [0.62, P([0, 0, 0], [-0.1, -0.1], [-0.2], [-0.2, 0.1], [-0.3], [0.04])],
  [0.72, P([0, 0, 0], [-0.1, -0.1], [-0.2], [-0.2, 0.1], [-0.3], [0.04])],
  [0.79, P([0, 0, 0], [-1.25, -0.1], [-0.3], [-1.25, 0.1], [-0.3], [0.2])],       // receives the food
  [0.84, P([0, 0, 0], [-1.25, -0.1], [-0.3], [-1.25, 0.1], [-0.3], [0.2])],
  [0.89, P([0.05, 0, 0], [-0.9, 0], [-1.4], [-0.9, 0], [-1.4], [0.06])],          // food at the chest
  [1.00, P([0.05, 0, 0], [-0.9, 0], [-1.4], [-0.9, 0], [-1.4], [0.06])]
];
export function poseAt(keys, p) {
  if (p <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) if (p <= keys[i][0]) {
    const a = keys[i - 1], b = keys[i], t = smooth((p - a[0]) / (b[0] - a[0])), o = {};
    for (const k in a[1]) o[k] = a[1][k].map((v, j) => lerp(v, b[1][k][j], t));
    return o;
  }
  return keys[keys.length - 1][1];
}
// nod pulses (head pitch added on top of the pose)
export const nod = (p, a, b, n = 2, amp = 0.3) => (p > a && p < b) ? Math.max(0, Math.sin(((p - a) / (b - a)) * Math.PI * 2 * n)) * amp : 0;

/* ---- food tray (stall-local): [p, x, y, z] ---- */
export const FOOD = [[0.59, 0.5, 1.07, -0.5], [0.70, 0.5, 1.07, -0.5], [0.76, 0.12, 1.16, -0.42], [0.80, 0.02, 1.15, 0.05], [0.84, 0.0, 1.2, 0.38], [0.89, 0.0, 1.27, 0.62], [1.0, 0.0, 1.27, 0.62]];
export function foodAt(p, out) {
  if (p < FOOD[0][0]) return false;
  for (let i = 1; i < FOOD.length; i++) if (p <= FOOD[i][0]) {
    const a = FOOD[i - 1], b = FOOD[i], t = smooth((p - a[0]) / (b[0] - a[0]));
    out[0] = lerp(a[1], b[1], t); out[1] = lerp(a[2], b[2], t); out[2] = lerp(a[3], b[3], t); return true;
  }
  out[0] = FOOD[FOOD.length - 1][1]; out[1] = FOOD[FOOD.length - 1][2]; out[2] = FOOD[FOOD.length - 1][3]; return true;
}

/* ---- what the BRIDGE display and top light show ---- */
export function displayState(p, pressed) {
  if (p >= 0.86) return { key: 'idle', light: 'white', top: '', ko: '', en: '' };
  if (p >= 0.70) return { key: 'ready', light: 'lime', top: 'READY', ko: '준비 완료', en: 'READY' };
  if (pressed) return { key: 'tr', light: 'purple', top: 'TRANSLATION', ko: '하나는 맵지 않게', en: 'ONE NOT SPICY' };
  if (p >= 0.17) return { key: 'menu', light: 'white', top: 'MENU', ko: '떡볶이  ₩4,000', en: 'TTEOKBOKKI  ₩4,000' };
  return { key: 'off', light: 'white', top: '', ko: '', en: '' };
}
