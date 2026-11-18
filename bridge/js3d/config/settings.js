// =============================================================
//  PROJECT SETTINGS — 2030 MYEONGDONG
//  모든 수치/경로/타이밍은 이 파일에서 조정합니다.
// =============================================================

export const COLORS = {
  bg: 0x050507, bg2: 0x101017, surface: 0x191921,
  purple: 0x7628f5, violet: 0x8f55ff, bright: 0xc2a0ff, deep: 0x3d1486, blue: 0x5a5cff, lime: 0xc5ff35,
};

export const ASSETS = {
  openModel: 'assets/models/epcs_open.glb',
  closedModel: 'assets/models/epcs_closed.glb',
};

// GLB 단위(약 0.26) → 실제 미터(약 2.6m)로 변환
export const MODEL_SCALE = 10;

/*
 * GLB 메시 분석 결과 (노드 인덱스 기준, 파일에 이름/애니메이션 없음)
 * OPEN  모델 55개 노드 / CLOSED 모델 48개 노드
 * 두 모델은 동일한 부품 메시를 공유 → 열림/닫힘 사이의 강체 변환을 직접 계산함 (Kabsch 정합)
 */
export const OPEN_PARTS = {
  ledFloor: [12],          // 바닥을 따라 이어지는 LED 라인
  bandL: [3], bandR: [0],  // 양 끝 모듈 LED 띠
  topL: [2], topR: [1],    // 양 끝 모듈 상판
  modL: [5], modR: [4],    // 양 끝 사다리꼴 모듈 몸체
  panelL: [10, 11], panelR: [46, 47], // 수직 패널 (닫힘 상태에서는 중앙 커버)
  stripL: [6, 7],          // 왼쪽 패널에 연결된 아크릴 스트립 반쪽 (A 하단, B 상단)
  stripR: [8, 9],          // 오른쪽 패널에 연결된 아크릴 스트립 반쪽 (A 상단, B 하단)
};
export const OPEN_STATIC_EXCLUDE = [0,1,2,3,4,5,6,7,8,9,10,11,12,46,47];

export const CLOSED_PARTS = { led: [0], bands: [40, 45] };

/*
 * 기구학 (GLB 좌표계, Z축 기준 회전)
 *  - 왼쪽 패널: 피벗 (-0.058, 0.0111)에서 -90° → 바닥 커버
 *  - 오른쪽 패널: 피벗 (0.0911, 0.0111)에서 +90° → 바닥 커버
 *  - 끝 모듈: 몸체 0.0079, LED띠 0.0159, 상판 0.0165 만큼 하강하여 수납 (텔레스코픽)
 *  - 정합 오차 < 0.5mm(실척 5mm)
 */
export const KINEMATICS = {
  pivotL: [-0.05800, 0.01112],
  pivotR: [0.09112, 0.01112],
  liftBody: 0.0079, liftBand: 0.0159, liftTop: 0.0165,
  panelMidY: 0.047,
};

// 설치 레이아웃 (미터). 골목 폭/개수를 바꾸면 자동 재배치됩니다.
export const LAYOUT = {
  alleyHalf: 9.0,          // 골목 반폭 (건물면까지)
  rowX: 1.95,              // 긴급 통로 중심에서 제품 열까지 거리
  unitsPerRow: 4,          // 열당 제품 개수
  firstZ: -3.2,            // 첫 제품 중심 위치
  pitch: 4.3,              // 제품 간 간격(중심 기준)
  crossZ0: 1.6, crossZ1: 10.6, // 골목 바깥 교차 도로
};

// 시나리오 진행도 구간 (0~1)
export const STAGES = [
  { id: 'standby',   from: 0.00, to: 0.14 },
  { id: 'detect',    from: 0.14, to: 0.28 },
  { id: 'initial',   from: 0.28, to: 0.43 },
  { id: 'barrier',   from: 0.43, to: 0.65 },
  { id: 'boundary',  from: 0.65, to: 0.76 },
  { id: 'clear',     from: 0.76, to: 0.89 },
  { id: 'reset',     from: 0.89, to: 1.00 },
];

export const QUALITY = (() => {
  const mobile = matchMedia('(max-width: 820px)').matches || /Mobi|Android/i.test(navigator.userAgent);
  return {
    mobile,
    dpr: Math.min(window.devicePixelRatio || 1, mobile ? 1.25 : 1.6),
    people: mobile ? 46 : 110,
    reflector: !mobile,
    bloom: true,
    shadows: !mobile,
  };
})();
