import { ramp, smooth } from '../components/materials.js';
import { STAGES } from '../config/settings.js';

/*
 * SCROLL-DRIVEN OPERATION SCENARIO
 * p(0~1) 하나로 모든 부품·조명·보행자·구급차 상태를 결정 → 스크롤을 멈추면 멈추고, 되돌리면 되돌아갑니다.
 * 작동 순서: 양 끝 모듈 → 중앙 패널 + 투명 스트립 → 바닥 LED → 아크릴 엣지
 * 수납 순서: 엣지/LED 소등 → 패널·스트립 접힘 → 양 끝 모듈 하강
 */
export function unitState(p, rig) {
  const d = rig.order * 0.014 + (rig.side > 0 ? 0 : 0.006); // 제품별 시간차 (입구에 가까운 제품부터)
  let m = ramp(p, 0.29 + d, 0.38 + d);
  let r = ramp(p, 0.44 + d, 0.605 + d);
  let led = ramp(p, 0.655 + d * 0.5, 0.705 + d * 0.5);   // 패널 완전 전개(≤0.653) 이후에만 점등
  let edge = ramp(p, 0.695, 0.745);
  if (p > 0.885) {
    edge *= 1 - ramp(p, 0.89, 0.912);
    led *= 1 - ramp(p, 0.893, 0.925);
    r *= 1 - ramp(p, 0.905 + d * 0.4, 0.952 + d * 0.4);
    m *= 1 - ramp(p, 0.955 + d * 0.3, 0.988 + d * 0.3);
  }
  return { m, r, led, edge };
}

export function scenarioState(p) {
  const a = smooth(ramp(p, 0.14, 0.27));
  const b = smooth(ramp(p, 0.785, 0.935));
  return {
    units: { show: true, fn: rig => unitState(p, rig) },
    amb: { show: p > 0.135 && p < 0.935, a, b, lights: 1 },
    detect: ramp(p, 0.165, 0.2) * (1 - ramp(p, 0.3, 0.37)),
    alert: ramp(p, 0.3, 0.42) * (1 - ramp(p, 0.9, 0.97)),
    data: 0,
    evac: person => {
      let e = ramp(p, person.evacStart, person.evacStart + 0.08);
      if (p > 0.92) e *= 1 - ramp(p, 0.94 + person.evacStart * 0.05, 0.99);
      return e;
    },
  };
}

export function stageIndex(p) {
  for (let i = STAGES.length - 1; i >= 0; i--) if (p >= STAGES[i].from) return i;
  return 0;
}
