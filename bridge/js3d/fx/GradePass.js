/*
 * GradeShader — 사이트 전체의 블랙·퍼플 색보정 (선형 HDR 단계, OutputPass 이전)
 *  - 어두운 영역을 깊은 퍼플-블랙으로 리프트 (도시/스튜디오/추상 장면 모두 같은 무드)
 *  - 하이라이트의 미세한 바이올렛 스플릿 톤, 중간톤 채도 약간 억제 (따뜻한 간판은 유지)
 *  - 가장자리 미세 색수차, 비네트, 필름 그레인
 */
export const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uVignette: { value: 0.9 },
    uCA: { value: 0.00025 },
    uGrain: { value: 0.035 },
    uLift: { value: 1 },
    uSat: { value: 0.9 },
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse; uniform float uTime, uVignette, uCA, uGrain, uLift, uSat;
    varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main(){
      vec2 c = vUv - 0.5;
      float r2 = dot(c, c);
      vec2 off = c * r2 * uCA * 12.0;
      vec3 col;
      col.r = texture2D(tDiffuse, vUv + off).r;
      col.g = texture2D(tDiffuse, vUv).g;
      col.b = texture2D(tDiffuse, vUv - off).b;
      float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col = mix(vec3(lum), col, uSat);
      // purple-black lift in the shadows, faint violet in highlights
      vec3 lift = vec3(0.010, 0.004, 0.022) * uLift;
      col += lift * (1.0 - smoothstep(0.0, 0.25, lum));
      col *= mix(vec3(1.0), vec3(1.03, 0.97, 1.08), smoothstep(0.4, 2.0, lum));
      float vig = smoothstep(0.85, 0.18, r2 * 1.6);
      col *= mix(1.0, vig, uVignette);
      float n = hash(vUv * vec2(1931.0, 1213.0) + fract(uTime * 7.13)) - 0.5;
      col += n * uGrain * (0.25 + lum * 0.6);
      gl_FragColor = vec4(max(col, 0.0), 1.0);
    }`,
};

/*
 * RadialBlurShader — 인트로 흡입 구간의 방사형 모션 블러 + 원근 왜곡
 * 고정된 소실점(화면 중앙)을 향해 샘플을 누적 → 빛이 카메라 옆으로 밀려나며 스쳐 지나가는 속도감
 */
export const RadialBlurShader = {
  uniforms: { tDiffuse: { value: null }, uStrength: { value: 0 }, uDistort: { value: 0 }, uCenter: { value: [0.5, 0.5] } },
  vertexShader: /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse; uniform float uStrength, uDistort; uniform vec2 uCenter;
    varying vec2 vUv;
    void main(){
      vec2 d = vUv - uCenter;
      float r2 = dot(d, d);
      vec2 uv = uCenter + d * (1.0 - uDistort * 0.35 + uDistort * r2 * 1.2);   // barrel-like perspective stretch
      vec2 dir = (uv - uCenter);
      vec3 acc = vec3(0.0); float wsum = 0.0;
      for (int i = 0; i < 16; i++) {
        float t = float(i) / 15.0;
        float w = 1.0 - t * 0.85;
        acc += texture2D(tDiffuse, uCenter + dir * (1.0 - uStrength * t * (0.35 + r2 * 2.5))).rgb * w;
        wsum += w;
      }
      gl_FragColor = vec4(acc / wsum, 1.0);
    }`,
};
