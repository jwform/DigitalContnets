# BRIDGE — Smart Communication Gate (ACT01–ACT07)

Static site, no build step, no libraries (custom WebGL2). Works on GitHub Pages and any local server.

## Run locally
    cd bridge-experience && python3 -m http.server 8000   # open http://localhost:8000
(Opening index.html directly also works; the model is embedded in assets/model/bridge.glb.js.)

## Deploy to GitHub Pages
Push the folder contents to a repo → Settings → Pages → deploy from branch (root). All paths are relative.

## Things to fill in
- `js/config.js` → `teamSite` : team site URL for the end card.
- ACT05 videos: put muted 16:9 mp4 files at the paths listed in `js/config.js` (assets/video/act05-01-approach.mp4 … act05-06-receive-food.mp4). Missing files show a VIDEO PLACEHOLDER; existing files play automatically.
- ACT05 storyboard: 6 steps, 5 images (assets/img/scenario-1..5.webp = steps 2–6). DISCOVERY is "coming soon"; add scenario-0.webp and edit the cards line in js/main.js when ready.
- Dimensions shown: 600 × 500 mm, thickness 60 mm (as provided; the GLB proportions are 68.5 : 40 : 9.9, so check against the final drawing).

## Notes
- Arched silhouette image was not used (product is a straight horizontal-frame gate).
- `?still` in the URL disables scroll smoothing (for screenshots/tests). prefers-reduced-motion is respected.

## 4차 수정 요약
- ACT03 풀스크린 히어로(BRIDGE / FACE TO FACE)와 ACT07 "THE GATE STAYS OPEN." 화면 삭제 → ACT03은 360° 뷰어로 바로 시작
- 360° 뷰어·시뮬레이터: 위에서 떨어지는 스튜디오 키라이트 + 바닥 빛 웅덩이 + 림 라이트 (`js/gl.js`의 `uBeam`)
- 로고: `assets/img/logo-2030.png`(전체), `logo-symbol.png`(심볼) — 인트로, HUD, 엔드카드(팀 사이트 링크), 파비콘에 사용
- 제목 마우스 효과: 글자 색 변경 대신 커서 주변에 라임→퍼플 그라데이션 빛 (`.lit`)
- 레퍼런스 반영: 픽셀 그리드(조용한 구간, `#pxg`), 웨이브 배경(ACT06), 렌즈 + 뎁스오브필드 스토리보드 카드
- 폰트는 Pretendard(CDN)이므로 인터넷 연결 필요

## 6차 수정 요약 (ACT 05 · 3D 시나리오)
- 인트로 소용돌이 제거 (BRIDGE 원래 인트로 유지)
- ACT 05 = 스크롤로 넘기는 6단계 3D (발견 → 마주함 → 오해 → 이해 → 전달 → 교감)
- 네온 포장마차 거리: 젖은 반사 바닥, 대형 LED 전광판, 일렬로 늘어선 포장마차
- 포장마차 테이블 위 BRIDGE, 상인(안쪽)·관광객(거리쪽)이 마주 보고 양방향 카메라로 관찰
- 4단계 중앙 버튼만 직접 클릭 (스크롤로 지나가면 자동으로 눌림), 퍼플 → 라임 상단 조명
- Three.js 로드 실패 시 기존 스토리보드 이미지로 자동 대체 · `?no3d` 로 3D 끄기
- 문제 시 브라우저 콘솔의 `[BR3]` 메시지를 알려주세요.
