/* =====================================================================
   BRIDGE — experience director
   scroll → camera / objects / type · mouse → light / particles / fluid
   ===================================================================== */
(function () {
  'use strict';
  const BR = window.BR, cfg = window.BRIDGE_CONFIG || {};
  const $ = (s, r) => (r || document).querySelector(s), $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const lerp = (a, b, t) => a + (b - a) * t, clamp = (v, a, b) => Math.min(b == null ? 1 : b, Math.max(a == null ? 0 : a, v));
  const sm = t => t * t * (3 - 2 * t);
  const STILL = /[?&]still/.test(location.search);
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover:hover) and (pointer:fine)').matches;
  const root = document.documentElement;
  root.classList.add('js'); if (fine) root.classList.add('fine');
  try { history.scrollRestoration = 'manual'; } catch (e) { }

  const W = [.96, .96, .98], PU = [.463, .157, .961], LI = [.773, 1, .208];
  let vw = innerWidth, vh = innerHeight;
  const small = () => vw < 800;
  const hs = (i, k) => { const x = Math.sin((i + 1) * 127.1 + k * 311.7) * 43758.5453; return x - Math.floor(x); };

  /* ------------------------------------------------------------------
     scenes — the 3D model is ONLY on screen in the viewer (a3b) and the
     simulator (a4). Everywhere else the GL layer is background only.
  ------------------------------------------------------------------ */
  const D = { eye: [0, 0, 6], tg: [0, 0, 0], fov: 32, vis: 0, ledT: W, ledB: [.6, .6, .64], studio: 0, purple: .6, lime: .2, dark: 0, hband: 0, floor: 0, rib: 0, part: 0, strk: 0, warp: 0, flash: 0, fade: 0, fit: 0, spin: 0, doorA: 0, doorZ: 1, solid: 0, halo: 0, rim: 0, beam: 0, wave: 0, px: 0 };
  const O = (az, el, d, ty, tx) => { ty = ty || 0; tx = tx || 0; const a = az * Math.PI / 180, e = el * Math.PI / 180; return { eye: [tx + d * Math.sin(a) * Math.cos(e), ty + d * Math.sin(e), d * Math.cos(a) * Math.cos(e)], tg: [tx, ty, 0] }; };
  const STUDIO = { vis: 1, studio: 1, hband: 0, ledT: W, purple: 0, dark: 0, floor: 1, fit: 1, solid: .96, halo: .4, rim: .5, beam: 1 };
  const R0 = { eye: [0, 0, 2.4], tg: [0, 0, -5] };
  const SC = {
    a1: [[0, { ...R0, part: .35, purple: .7 }],
      [.28, { ...R0, part: .5, purple: .8, doorA: .6, doorZ: 1 }],
      [.4, { ...R0, doorA: 1, doorZ: 1.4, part: .7, strk: .3, purple: .85 }],
      [.56, { ...R0, doorA: 1, doorZ: 3, part: 1, strk: .8, warp: .35, purple: .9 }],
      [.66, { ...R0, doorA: 1, doorZ: 26, part: 1, strk: 1, warp: .95, flash: .5, rib: .5, purple: .9 }],
      [.74, { ...R0, doorA: 0, doorZ: 40, rib: .8, part: 1, strk: 1, warp: .6, lime: .3, purple: 1 }],
      [.9, { ...R0, rib: .75, part: .8, strk: .5, warp: .2, lime: .35, purple: 1 }],
      [1, { ...R0, rib: .65, part: .6, strk: .3, warp: .1, lime: .35, purple: 1 }]],
    a2: [[0, { solid: .92, halo: .55, part: .16, px: 1 }], [1, { solid: .92, halo: .55, part: .16, px: 1 }]],
    a2b: [[0, { purple: .5, dark: .35, part: .5, rib: .3, ...R0 }], [.22, { purple: .36, dark: .4, part: .3, rib: .15, ...R0 }], [1, { purple: .36, dark: .4, part: .3, rib: .15, ...R0 }]],
    a3b: [[0, { ...O(24, 5, 3.5, -.03, -.1), ...STUDIO }], [.12, { ...O(0, 2, 3.6, -.03, -.1), ...STUDIO }], [1, { ...O(0, 2, 3.6, -.03, -.1), ...STUDIO }]],
    a4: [[0, { ...O(0, 2, 4.3, -.03), ...STUDIO, hband: 0 }], [.12, { ...O(0, 5, 4.5, -.08, .0), ...STUDIO, hband: 0 }], [1, { ...O(0, 5, 4.5, -.08, .0), ...STUDIO, hband: 0 }]],
    a5: [[0, { solid: 1, halo: .35, part: .1, px: 1 }], [1, { solid: 1, halo: .35, part: .1, px: 1 }]],
    a6: [[0, { ...R0, rib: .4, part: .45, strk: .15, purple: .55, wave: .9 }], [.1, { ...R0, rib: .22, part: .3, strk: .08, purple: .32, wave: 1 }], [1, { ...R0, rib: .2, part: .25, strk: .08, purple: .3, wave: 1 }]],
    a6b: [[0, { ...R0, solid: 1, halo: .3, part: .1, px: 1 }], [1, { ...R0, solid: 1, halo: .3, part: .1, px: 1 }]],
    a7: [[0, { ...R0, rib: .25, part: .4, lime: .55, purple: .6 }],
      [.08, { ...R0, doorA: 1, doorZ: 22, rib: .4, part: .8, strk: .7, warp: .6, flash: 0, lime: .6, purple: .6 }],
      [.32, { ...R0, doorA: 1, doorZ: 1.3, rib: .4, part: .7, strk: .4, warp: .3, lime: .6, purple: .8 }],
      [.47, { ...R0, doorA: 0, doorZ: 1, rib: .3, part: .4, lime: .6, purple: .6 }],
      [1, { ...R0, rib: .25, part: .35, lime: .6, purple: .6 }]]
  };
  Object.keys(SC).forEach(k => SC[k] = SC[k].map(([p, o]) => [p, { ...D, ...o }]));
  function mixV(a, b, t) { return Array.isArray(a) ? a.map((v, i) => lerp(v, b[i], t)) : lerp(a, b, t); }
  function mixS(a, b, t) { const o = {}; for (const k in a) o[k] = mixV(a[k], b[k], t); return o; }
  function kf(keys, p) {
    if (p <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) if (p <= keys[i][0]) { const a = keys[i - 1], b = keys[i]; return mixS(a[1], b[1], sm((p - a[0]) / (b[0] - a[0]))); }
    return keys[keys.length - 1][1];
  }

  /* ------------------------------------------------------------------
     typography helpers: split letters · split words · fit to width
  ------------------------------------------------------------------ */
  function split(el) {
    const lines = el.dataset.text.split('|'); let n = 0;
    el.innerHTML = lines.map(l => '<span class="ln">' + l.split(' ').map(w => '<span class="wd" style="display:inline-block;white-space:nowrap">' + [...w].map(c => '<span class="ch" data-i="' + (n++) + '">' + c + '</span>').join('') + '</span>').join(' ') + '</span>').join('');
    el._n = n; el._ch = $$('.ch', el); el._lines = $$('.ln', el);
    if (lines.length === 1) el._lines[0].style.display = 'inline';
  }
  $$('[data-text]').forEach(split);
  // progressive word reveal: wrap every word of .words in a span, keep <br>/<em>
  function wrapWords(node, out) {
    [...node.childNodes].forEach(n => {
      if (n.nodeType === 3) {
        const parts = n.textContent.split(/(\s+)/), f = document.createDocumentFragment();
        parts.forEach(t => { if (!t) return; if (/^\s+$/.test(t)) f.appendChild(document.createTextNode(' ')); else { const s = document.createElement('span'); s.className = 'w2'; s.textContent = t; out.push(s); f.appendChild(s); } });
        n.replaceWith(f);
      } else if (n.nodeType === 1 && n.tagName !== 'BR') wrapWords(n, out);
    });
  }
  const wordBlocks = $$('.words').map(el => { const sp = []; wrapWords(el, sp); return { el, sp }; });
  // letter spans for headings (hover colour + magnetic motion)
  function wrapLetters(node) {
    [...node.childNodes].forEach(n => {
      if (n.nodeType === 3) {
        const f = document.createDocumentFragment();
        n.textContent.split(/(\s+)/).forEach(t => {
          if (!t) return; if (/^\s+$/.test(t)) { f.appendChild(document.createTextNode(' ')); return; }
          const w = document.createElement('span'); w.style.cssText = 'display:inline-block;white-space:nowrap';
          [...t].forEach(c => { const l = document.createElement('span'); l.className = 'lt'; l.textContent = c; w.appendChild(l); }); f.appendChild(w);
        });
        n.replaceWith(f);
      } else if (n.nodeType === 1 && n.tagName !== 'BR' && n.tagName !== 'SMALL') wrapLetters(n);
    });
  }
  $$('.hd.xl,.hd.md,.hd.md2,.hd.lg2,.pcase h3,.pcard h3,.giant,.fin,.end-b,.mcu>b').forEach(el => { if (!el.closest('.words')) { el.setAttribute('aria-label', el.textContent.replace(/\s+/g, ' ').trim()); wrapLetters(el); } });
  const magGroups = [...$$('.hd.xl,.hd.md,.hd.md2,.hd.lg2,.pcase h3,.pcard h3,.giant,.fin,.end-b,.mcu>b,#kt1,#kt2')].map(el => ({ el, l: $$('.lt,.ch', el), kin: el.matches('.giant,.fin,.end-b,#kt1'), sp: 0, act: false, ls: null }));
  function fitEl(el) {
    const f = parseFloat(el.dataset.fit); if (!f) return;
    // measure the natural layout: ignore motion offsets / tracking applied by the mouse + scroll fx
    const ls = [...el.querySelectorAll('.ch,.lt')], saved = ls.map(l => [l.style.transform, l.style.translate, l.style.rotate]), sp = el.style.letterSpacing;
    ls.forEach(l => { l.style.transform = 'none'; l.style.translate = 'none'; l.style.rotate = 'none'; }); el.style.letterSpacing = '';
    el.style.fontSize = '100px';
    const r = document.createRange(); r.selectNodeContents(el); const w = r.getBoundingClientRect().width || 1;
    let fs = 100 * vw * f / w;
    const lines = el._lines ? el._lines.length : (el.innerHTML.split(/<br\s*\/?>/i).length);
    fs = Math.min(fs, vh * .8 / (lines * .95));
    el.style.fontSize = fs.toFixed(1) + 'px';
    ls.forEach((l, i) => { l.style.transform = saved[i][0]; l.style.translate = saved[i][1]; l.style.rotate = saved[i][2]; }); el.style.letterSpacing = sp;
    magGroups.forEach(g => { if (g.el === el) g.ls = null; });
  }
  function fitAll() {
    $$('[data-fit]').forEach(fitEl);
    const fins = $$('.fin'); if (fins.length) { const m = Math.min(...fins.map(e => parseFloat(e.style.fontSize))); fins.forEach(e => e.style.fontSize = m + 'px'); }
  }

  /* ------------------------------------------------------------------
     sections / scroll
  ------------------------------------------------------------------ */
  let secs = [];
  const win = e => { const r = e.dataset.r.split(',').map(Number); return { a: r[0], b: r[1] }; };
  function measure(noFit) {
    vw = innerWidth; vh = innerHeight; if (noFit !== true) fitAll();
    secs = $$('.act').map(el => {
      const top = el.getBoundingClientRect().top + scrollY, h = el.offsetHeight;
      return {
        el, id: el.id, scene: el.dataset.scene, ui: +el.dataset.ui, name: el.dataset.name, top, h, pinned: el.classList.contains('pinned'),
        items: $$('[data-r]', el).map(e => ({ e, ...win(e), fx: e.dataset.fx || 'up' })),
        kids: $$('[data-fx="slam"]:not([data-r])', el).map(e => { const pr = e.closest('[data-r]'); return { e, ...(pr ? win(pr) : { a: 0, b: 1 }) }; }),
        words: wordBlocks.filter(w => el.contains(w.el)).map(w => { const pr = w.el.closest('[data-r]'); return { ...w, ...(pr ? win(pr) : { a: 0, b: 1 }) }; })
      };
    });
  }
  const secP = (s, y) => s.pinned ? clamp((y - s.top) / Math.max(1, s.h - vh)) : clamp((y - s.top + vh) / (s.h + vh));
  const sceneFor = (s, y) => SC[s.scene] ? kf(SC[s.scene], secP(s, y)) : D;
  function sceneAt(y) {
    let i = 0; for (let k = 0; k < secs.length; k++) if (y >= secs[k].top - .5) i = k;
    const s = secs[i], a = sceneFor(s, y), n = secs[i + 1];
    if (n) { const z0 = n.top - vh; if (y > z0) return mixS(a, sceneFor(n, y), sm(clamp((y - z0) / vh))); }
    return a;
  }

  /* ------------------------------------------------------------------
     input
  ------------------------------------------------------------------ */
  const mouse = { x: 0, y: 0, sx: 0, sy: 0, px: -100, py: -100, cx: -100, cy: -100 };
  addEventListener('pointermove', e => { mouse.x = e.clientX / vw * 2 - 1; mouse.y = -(e.clientY / vh * 2 - 1); mouse.px = e.clientX; mouse.py = e.clientY; }, { passive: true });
  let lastMove = -1e9; addEventListener('pointermove', () => { lastMove = performance.now(); }, { passive: true });
  const cur = $('#cur');
  document.addEventListener('pointerover', e => { cur.classList.toggle('hov', !!e.target.closest('button,a,.chip,.hs button')); });

  /* ------------------------------------------------------------------
     hotspots / viewer — click a dot: rotate to front, camera pushes in,
     callout pops next to the point, details slide into the panel
  ------------------------------------------------------------------ */
  const HS = [
    { d: 'l', k: 'CAMERA SENSOR', io: 'INPUT', p: [-.04, .1799, .0160], body: '작은 카메라 센서. 다가오는 사람과 시선의 방향을 읽어, 두 사람이 마주 보고 있는지 알아챕니다.', pts: ['다가오는 사람 감지', '시선 방향 인식', '마주 봄을 확인'] },
    { d: 'r', k: 'BUTTON', io: 'INPUT', p: [0, .1508, .0221], body: '중앙의 원형 물리 버튼. 관광객이 직접 눌러 대화를 시작하고 확정하는 단 하나의 조작부입니다.', pts: ['사람이 직접 누르는 단 하나의 조작', '누르면 대화 시작', '새틴 건메탈 마감'] },
    { d: 'u', k: 'SPEAKER & MIC', io: 'INPUT · RESPONSE', p: [0, .1815, .0211], body: '버튼 위로 나란히 놓인 9개의 스피커 홀. 주변의 말을 듣고, 알맞은 소리로 답을 건넵니다.', pts: ['9개의 스피커 홀', '거리 소음 속 목소리 수집', '알맞은 언어의 소리로 응답'] },
    { d: 'l', k: 'DISPLAY', io: 'RESPONSE', p: [-.165, .155, .0211], body: '양면 블랙 디스플레이. 번역, 요청, 완료 정보를 앞과 뒤, 두 사람에게 같은 순간 보여줍니다.', pts: ['양면 블랙 디스플레이', '번역 · 요청 · 완료 정보', '앞과 뒤에 같은 순간 표시'] },
    { d: 'u', k: 'STATUS LIGHT', io: 'RESPONSE', p: [.22, .2025, .0], body: '상단의 얇은 상태 라인. 흰색 · 보라 · 라임으로 지금 게이트가 어떤 상태인지 말없이 알려줍니다.', pts: ['흰색 SILENT · 보라 CONNECTING · 라임 READY', '말 없이 보여주는 현재 상태', '다리는 빛나지 않음'] }
  ];
  let hsHover = -1, spotA = 0, tiltV = 0, hsSel = 0, hsFocus = false, hsF = 0, vUser = false, vAutoIdx = -2;
  const hsLayer = $('#hs');
  HS.forEach((h, i) => {
    const d = document.createElement('div'); d.className = 'hs ' + (h.d || 'r'); d.innerHTML = '<button aria-label="' + h.k + '"></button><span>' + h.k + '</span>';
    const bt = d.querySelector('button'); bt.addEventListener('click', () => { vUser = true; selHS(i, true); }); bt.addEventListener('pointerenter', () => { hsHover = i; }); bt.addEventListener('pointerleave', () => { if (hsHover === i) hsHover = -1; }); hsLayer.appendChild(d); h.el = d;
  });
  const call = document.createElement('div'); call.className = 'callout'; call.innerHTML = '<i class="cl"></i><div class="cb"><em></em><b></b><span></span></div>'; hsLayer.appendChild(call);
  const vlist = $('#vlist');
  vlist.innerHTML = HS.map((h, i) => '<li><button data-i="' + i + '"><i>0' + (i + 1) + '</i>' + h.k + '</button></li>').join('');
  $$('button', vlist).forEach(b => b.addEventListener('click', () => { vUser = true; selHS(+b.dataset.i, true); }));
  const panel = $('#hsPanel');
  function selHS(i, focus) {
    const changed = i !== hsSel || (focus && !hsFocus); hsSel = i; hsFocus = !!focus; const h = HS[i];
    $$('button', vlist).forEach((b, j) => b.classList.toggle('on', j === i && hsFocus));
    $('#hsNum').textContent = '0' + (i + 1) + ' / 05'; $('#hsTitle').textContent = h.k; $('#hsBody').textContent = h.body;
    $('#hsPts').innerHTML = h.pts.map((x, n) => '<li style="animation-delay:' + (.25 + n * .12) + 's">' + x + '</li>').join('');
    const io = $('#hsIO'); io.textContent = h.io; io.classList.toggle('out', h.io === 'RESPONSE');
    call.querySelector('em').textContent = '0' + (i + 1); call.querySelector('b').textContent = h.k; call.querySelector('span').textContent = h.io;
    if (focus) toView(0);
    if (changed) { panel.classList.remove('swap'); void panel.offsetWidth; panel.classList.add('swap'); call.classList.remove('pop'); void call.offsetWidth; call.classList.add('pop'); }
  }
  function unfocus() { hsFocus = false; $$('button', vlist).forEach(b => b.classList.remove('on')); }
  $('#hsNext').addEventListener('click', () => { vUser = true; selHS((hsSel + 1) % HS.length, true); });
  selHS(0, false);

  let rotT = 0, rotU = 0, rotVel = 0, dragging = false, auto = false, lastX = 0;
  const vz = $('#vzone');
  vz.addEventListener('pointerdown', e => { dragging = true; lastX = e.clientX; vz.classList.add('drag'); cur.classList.add('drag'); try { vz.setPointerCapture(e.pointerId); } catch (_) { } });
  vz.addEventListener('pointermove', e => { if (!dragging) return; const d = (e.clientX - lastX) * .5; lastX = e.clientX; rotT += d; rotVel = d; if (Math.abs(d) > .5) { vUser = true; if (hsFocus) unfocus(); } });
  const endDrag = () => { dragging = false; vz.classList.remove('drag'); cur.classList.remove('drag'); };
  vz.addEventListener('pointerup', endDrag); vz.addEventListener('pointercancel', endDrag);
  vz.addEventListener('keydown', e => { if (e.key === 'ArrowLeft') { rotT -= 18; vUser = true; unfocus(); e.preventDefault(); } if (e.key === 'ArrowRight') { rotT += 18; vUser = true; unfocus(); e.preventDefault(); } });
  const toView = v => { rotT = Math.round((rotT - v) / 360) * 360 + v; rotVel = 0; };
  $$('[data-view]').forEach(b => b.addEventListener('click', () => { vUser = true; unfocus(); toView(+b.dataset.view); $$('[data-view]').forEach(x => x.classList.toggle('on', x === b)); }));
  $$('[data-side]').forEach(b => b.addEventListener('click', () => { toView(+b.dataset.side); $$('[data-side]').forEach(x => x.classList.toggle('on', x === b)); }));
  $('#autoRot').addEventListener('click', e => { auto = !auto; vUser = true; if (auto) unfocus(); e.currentTarget.setAttribute('aria-pressed', auto); });
  $('#vReset').addEventListener('click', () => { vUser = true; unfocus(); toView(0); auto = false; $('#autoRot').setAttribute('aria-pressed', false); $$('[data-view]').forEach(x => x.classList.toggle('on', x.dataset.view === '0')); });

  const hsPos = HS.map(() => ({ x: 0, y: 0, ok: false }));
  function updateHS(show) {
    const eye = BR.eye(), mm = BR.modelMat();
    const zx = mm[8], zz = mm[10], zl = Math.hypot(zx, zz) || 1;
    const facing = ((eye[0] * zx + eye[2] * zz) / zl) > 0 ? 1 : -1;
    HS.forEach((h, i) => {
      const z = Math.abs(h.p[2]) < .001 ? 0 : h.p[2] * facing;
      const q = BR.proj([h.p[0], h.p[1], z]);
      const vis = show && q.w > 0;
      h.el.classList.toggle('off', !vis);
      h.el.classList.toggle('dim', hsF > .4 && i !== hsSel);
      h.el.classList.toggle('nolbl', hsF > .4);
      h.el.classList.toggle('on', hsF > .4 && i === hsSel);
      const x = (q.x * .5 + .5) * vw, y = (1 - (q.y * .5 + .5)) * vh;
      h.el.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px)';
      hsPos[i] = { x, y, wx: q.wx, wy: q.wy, wz: q.wz, ok: vis };
    });
    const sp = hsPos[hsSel], showCall = show && hsF > .55 && sp.ok && !small();
    call.classList.toggle('show', showCall);
    if (showCall) { call.classList.toggle('L', sp.x > vw * .5); call.style.transform = 'translate(' + sp.x.toFixed(1) + 'px,' + sp.y.toFixed(1) + 'px)'; }
  }

  const SIM = [
    { k: 'STATE 01 · SILENT', t: '아무도 말하지 않을 때, BRIDGE는 조용히 기다립니다. 상단 라인은 중립의 화이트.', l: ['TOP LINE — WHITE', 'DISPLAY — STANDBY', 'BOTTOM LIGHT — SOFT WHITE'], col: W },
    { k: 'STATE 02 · CONNECTING', t: '버튼이 눌리면 두 사람의 말을 이어주는 중. 디스플레이에 요청과 번역이 나타납니다.', l: ['TOP LINE — PURPLE', 'DISPLAY — REQUEST + TRANSLATION', 'BOTTOM LIGHT — SOFT WHITE'], col: PU },
    { k: 'STATE 03 · READY', t: '연결이 끝났습니다. 완료 정보를 보여주고, 이제 결정은 사람이 합니다.', l: ['TOP LINE — LIME', 'DISPLAY — DONE', 'BOTTOM LIGHT — SOFT WHITE'], col: LI }
  ];
  let simState = 0, simUser = false, simCol = W.slice(), simLast = -1;
  function setSim(i, user) {
    simState = i; if (user) simUser = true;
    $$('.st').forEach((b, j) => { b.classList.toggle('on', j === i); b.setAttribute('aria-selected', j === i); });
    const s = SIM[i]; $('#simK').textContent = s.k; $('#simT').textContent = s.t; $('#simL').innerHTML = s.l.map(x => '<li>' + x + '</li>').join('');
  }
  $$('.st').forEach(b => b.addEventListener('click', () => setSim(+b.dataset.st, true)));
  setSim(0);

  const dcv = document.createElement('canvas'); dcv.width = 2048; dcv.height = 256; const dx = dcv.getContext('2d');
  const FONT = "'Pretendard Variable',Pretendard,system-ui,'Noto Sans KR',sans-serif";
  let dispShown = -1, dispT = 0;
  function drawDisp(st, t) {
    const c = dx; c.clearRect(0, 0, 2048, 256); c.textBaseline = 'middle';
    const L = [100, 800], R = [1250, 1950], y = 128;
    if (st === 0) {
      c.fillStyle = 'rgba(245,245,246,.35)'; c.font = '500 30px ' + FONT; c.textAlign = 'left';
      c.fillText('B R I D G E', L[0], y - 24); c.fillStyle = 'rgba(245,245,246,.2)'; c.font = '400 26px ' + FONT; c.fillText('FACE TO FACE', L[0], y + 24);
      for (let i = 0; i < 3; i++) { const a = .25 + .35 * (.5 + .5 * Math.sin(t * 2 - i * .8)); c.fillStyle = 'rgba(245,245,246,' + a + ')'; c.beginPath(); c.arc(R[0] + 40 + i * 46, y, 10, 0, 7); c.fill(); }
    } else if (st === 1) {
      c.textAlign = 'left'; c.fillStyle = '#a278ff'; c.font = '500 22px ' + FONT; c.fillText('VENDOR · KO', L[0], y - 54);
      c.fillStyle = '#f5f5f6'; c.font = '500 50px ' + FONT; c.fillText('맵기는 어떻게 해드릴까요?', L[0], y + 4);
      c.fillStyle = '#a278ff'; c.font = '500 22px ' + FONT; c.fillText('TOURIST · EN', R[0], y - 54);
      c.fillStyle = '#f5f5f6'; c.font = '500 46px ' + FONT; c.fillText('How spicy would you like it?', R[0], y + 4);
      const pr = (t * .5) % 1; c.fillStyle = 'rgba(162,120,255,.25)'; c.fillRect(R[0], y + 62, 640, 4); c.fillStyle = '#7628f5'; c.fillRect(R[0], y + 62, 640 * pr, 4);
      c.fillStyle = 'rgba(245,245,246,.5)'; c.font = '400 20px ' + FONT; c.fillText('TRANSLATING…', L[0], y + 64);
    } else {
      c.textAlign = 'left'; c.strokeStyle = '#c5ff35'; c.lineWidth = 9; c.lineCap = 'round'; c.beginPath(); c.moveTo(L[0], y + 6); c.lineTo(L[0] + 28, y + 34); c.lineTo(L[0] + 82, y - 30); c.stroke();
      c.fillStyle = '#c5ff35'; c.font = '700 54px ' + FONT; c.fillText('READY', L[0] + 120, y - 18); c.fillStyle = '#f5f5f6'; c.font = '400 30px ' + FONT; c.fillText('주문 완료', L[0] + 120, y + 36);
      c.fillStyle = '#c5ff35'; c.font = '500 22px ' + FONT; c.fillText('ORDER READY', R[0], y - 40); c.fillStyle = '#f5f5f6'; c.font = '500 44px ' + FONT; c.fillText('Take your food →', R[0], y + 14);
    }
    BR.setDisplay(dcv);
  }

  const STEPS = ['DISCOVERY', 'APPROACH', 'MISUNDERSTANDING', 'UNDERSTANDING', 'EXCHANGE', 'CONNECTION'];
  /* ACT 05 — scroll-driven scenario UI (3D is drawn by js3d/entry.js; this drives captions, rail and the fallback image) */
  const SC_AT = [0, .17, .34, .51, .70, .86, 1.0];
  const SC_TXT = [
    ['01', '발견', 'DISCOVERY', '공용 AI를 통한 포장마차 탐색', '관광객이 명동 거리를 걷다 공용 MCU AI로 주변 포장마차를 탐색합니다. 시야에 포장마차의 위치, 메뉴, 영업 상태와 혼잡 현황이 나타납니다.', 'SCROLL ↓'],
    ['02', '마주함', 'APPROACH', '기본 정보 확인과 첫 눈맞춤', '관광객이 포장마차에 도착합니다. 디스플레이에 메뉴와 가격 같은 간단한 정보가 표시되고, 정보를 확인한 뒤 상인과 눈을 맞춥니다.', 'SCROLL ↓'],
    ['03', '오해', 'MISUNDERSTANDING', '언어 차이로 인한 세부 요청의 오해', '음식 두 개 중 하나는 맵지 않게 요청합니다. 상인은 수량은 이해하지만 세부 요청을 알아듣지 못해 잠시 망설입니다.', 'SCROLL ↓'],
    ['04', '이해', 'UNDERSTANDING', 'AI의 정보 지원과 사람 사이의 직접적인 확인', '중앙 버튼을 누르면 상단 조명이 퍼플로 바뀌고, 디스플레이에 짧은 번역이 표시됩니다. 두 사람은 내용을 확인하고 눈을 맞추며 고개를 끄덕입니다.', '중앙 버튼을 눌러보세요 (스크롤해도 자동으로 눌립니다)'],
    ['05', '전달', 'EXCHANGE', '디지털 정보가 실제 음식 전달로 이어지는 순간', '음식 준비가 끝나면 상단 조명이 라임색으로 바뀌고 디스플레이에 준비 완료 아이콘이 나타납니다. 상인은 열린 게이트 사이로 음식을 건네고, 관광객은 미소 지으며 받습니다.', 'SCROLL ↓'],
    ['06', '교감', 'CONNECTION', '기술의 개입 없이 완성되는 사람과 사람의 교감', '상인이 손짓으로 맛있게 먹으라고 표현하고, 관광객은 고개를 끄덕이며 감사 인사를 전합니다.', '기술은 이어주었고, 결정은 사람이 했습니다.']
  ];
  const sc = { el: $('#act5'), i: -1, rail: $('#scRail'), fb: $('#scFb') };
  sc.rail.innerHTML = SC_TXT.map((t, i) => '<li><i>' + t[0] + '</i><b>' + t[2] + '</b></li>').join('');
  function scUpdate() {
    const r = sc.el.getBoundingClientRect(), p = Math.min(1, Math.max(0, -r.top / Math.max(1, sc.el.offsetHeight - innerHeight)));
    let i = 0; for (let k = 1; k < 6; k++) if (p >= SC_AT[k]) i = k;
    if (i === sc.i) return; sc.i = i; const t = SC_TXT[i];
    $('#scNo').textContent = t[0]; $('#scEn').textContent = t[2]; $('#scKo').textContent = t[1]; $('#scCore').textContent = t[3]; $('#scBody').textContent = t[4]; $('#scHint').textContent = t[5];
    $$('li', sc.rail).forEach((li, j) => { li.classList.toggle('on', j === i); li.classList.toggle('done', j < i); });
    sc.fb.src = 'assets/img/scenario-' + Math.min(5, Math.max(1, i)) + '.webp';
    $('#scCap').classList.remove('pop'); void $('#scCap').offsetWidth; $('#scCap').classList.add('pop');
  }
  addEventListener('scroll', scUpdate, { passive: true }); addEventListener('resize', scUpdate); scUpdate();

  /* ------------------------------------------------------------------
     shards (broken dialog)
  ------------------------------------------------------------------ */
  const shardWords = ['???', '…', 'HOW', '몇 개?', 'NO', '맵게?', 'WHAT', '…?', 'SPICY', '네?', 'HUH', '—', 'OK?', '어…'];
  const shards = $('#shards');
  for (let i = 0; i < 16; i++) {
    const s = document.createElement('div'); s.className = 'shard'; const w = 50 + hs(i, 1) * 140, h = 30 + hs(i, 2) * 90;
    s.style.cssText = 'width:' + w + 'px;height:' + h + 'px;left:' + (hs(i, 3) * 100) + '%;top:' + (hs(i, 4) * 100) + '%;clip-path:polygon(' + [0, 1, 2].map(k => (hs(i, 5 + k) * 100).toFixed(0) + '% ' + (hs(i, 9 + k) * 100).toFixed(0) + '%').join(',') + (hs(i, 20) > .5 ? ',' + (hs(i, 21) * 100).toFixed(0) + '% 100%' : '') + ')';
    s.textContent = shardWords[i % shardWords.length]; s._k = i; shards.appendChild(s);
  }

  /* ------------------------------------------------------------------
     ACT06 anatomy: 5 pins on the close-up render, zoom + caption per pin
  ------------------------------------------------------------------ */
  const PINS = [{ x: 50.9, y: 19.0 }, { x: 53.8, y: 24.6 }, { x: 53.8, y: 16.9 }, { x: 36.4, y: 23.0 }, { x: 53.8, y: 14.2 }];
  const aIn = $('#aIn'), aBox = $('.a-box');
  PINS.forEach((p, i) => { const d = document.createElement('i'); d.className = 'pin'; d.style.left = p.x + '%'; d.style.top = p.y + '%'; d.textContent = i + 1; aIn.appendChild(d); p.el = d; });
  $('#legend').innerHTML = HS.map((h, i) => '<li class="' + (h.io === 'RESPONSE' ? 'out' : '') + '" data-i="' + i + '"><i>' + (i + 1) + '</i>' + h.k + '<em>' + h.io + '</em></li>').join('');
  const legEls = $$('#legend li'); let aSel = -2, aUser = false;
  legEls.forEach(li => li.addEventListener('click', () => { aUser = true; setAnat(+li.dataset.i); }));
  function setAnat(i) {
    if (i === aSel) return; aSel = i;
    legEls.forEach((l, j) => l.classList.toggle('on', j === i)); PINS.forEach((p, j) => p.el.classList.toggle('on', j === i));
    $('#aCap').textContent = i < 0 ? '게이트를 이루는 다섯 개의 접점. 입력은 사람에게서, 응답은 사람에게로.' : HS[i].k + ' — ' + HS[i].body;
    const bw = aBox.offsetWidth, bh = aBox.offsetHeight, iw = bw * 1.3333, ih = iw * 9 / 16, ox = -bw * .16667, oy = -bh * .1765;
    if (i < 0) { aIn.style.setProperty('--ps', 1); aIn.style.transform = 'translate(0,0) scale(1)'; }
    else { const s = small() ? 1.6 : 1.9, px = ox + PINS[i].x / 100 * iw, py = oy + PINS[i].y / 100 * ih; aIn.style.setProperty('--ps', (1 / s).toFixed(3)); aIn.style.transform = 'translate(' + (bw / 2 - s * px).toFixed(1) + 'px,' + (bh / 2 - s * py).toFixed(1) + 'px) scale(' + s + ')'; }
  }
  aIn.style.transformOrigin = '0 0';
  setAnat(-1);

  /* ------------------------------------------------------------------
     ACT06 system map: nodes assemble, lines draw, packets travel
  ------------------------------------------------------------------ */
  const NS = 'http://www.w3.org/2000/svg';
  const sysEl = $('#sysmap'), sysSvg = $('#sysLines'), mcuEl = $('#mcu'), sysIn = $$('.sys-col.in .nd'), sysOut = $$('.sys-col.out .nd'), sysPaths = [];
  [...sysIn, ...sysOut].forEach((n, i) => { const pa = document.createElementNS(NS, 'path'); if (i >= sysIn.length) pa.setAttribute('class', 'o'); const c = document.createElementNS(NS, 'circle'); c.setAttribute('r', 4); sysSvg.appendChild(pa); sysSvg.appendChild(c); sysPaths.push({ pa, c, n, out: i >= sysIn.length, k: i >= sysIn.length ? i - sysIn.length : i, cnt: i >= sysIn.length ? sysOut.length : sysIn.length }); });
  const SYSCAP = [['01 · INPUT', '사람의 행동이 들어오는 곳', '버튼, 카메라, 마이크, 그리고 두 사람의 목소리.'], ['02 · MCU AI', 'AI는 돕고, 결정은 사람이', '상황을 읽고, 두 언어를 중재하고, 마지막 결정은 사람에게 남깁니다.'], ['03 · RESPONSE', '알맞은 방식으로 돌려주는 곳', '디스플레이, 스피커, 상단 상태 라인으로 양쪽 모두에게.']];
  let sysPh = -1;
  function layoutSys(p) {
    const ph = p < .34 ? 0 : (p < .62 ? 1 : 2);
    if (ph !== sysPh) { sysPh = ph; $('#sysK').textContent = SYSCAP[ph][0]; $('#sysT').textContent = SYSCAP[ph][1]; $('#sysD').textContent = SYSCAP[ph][2]; }
    const W = sysEl.offsetWidth, vert = W < 700, mx = mcuEl.offsetLeft, my = mcuEl.offsetTop, mw = mcuEl.offsetWidth, mh = mcuEl.offsetHeight;
    sysPaths.forEach((sp, i) => {
      const n = sp.n, nl = n.offsetLeft, nt = n.offsetTop, nw = n.offsetWidth, nh = n.offsetHeight, f = (sp.k + 1) / (sp.cnt + 1);
      let d;
      if (!vert) { const sx = sp.out ? mx + mw : nl + nw, sy = sp.out ? my + mh * f : nt + nh / 2, ex = sp.out ? nl : mx, ey = sp.out ? nt + nh / 2 : my + mh * f, dx = (ex - sx) * .5; d = 'M' + sx + ',' + sy + ' C' + (sx + dx) + ',' + sy + ' ' + (ex - dx) + ',' + ey + ' ' + ex + ',' + ey; }
      else { const sx = sp.out ? mx + mw * f : nl + nw / 2, sy = sp.out ? my + mh : nt + nh, ex = sp.out ? nl + nw / 2 : mx + mw * f, ey = sp.out ? nt : my, dy = (ey - sy) * .5; d = 'M' + sx + ',' + sy + ' C' + sx + ',' + (sy + dy) + ' ' + ex + ',' + (ey - dy) + ' ' + ex + ',' + ey; }
      sp.pa.setAttribute('d', d);
      const len = sp.pa.getTotalLength(), t0 = sp.out ? .62 : .27, prog = clamp((p - (t0 + .012 * sp.k)) / .05);
      sp.pa.style.strokeDasharray = len; sp.pa.style.strokeDashoffset = (len * (1 - prog)).toFixed(1);
      if (prog >= 1 && !RM) { const pt = sp.pa.getPointAtLength(((T * .28 + i * .19) % 1) * len); sp.c.setAttribute('cx', pt.x); sp.c.setAttribute('cy', pt.y); sp.c.style.display = ''; } else sp.c.style.display = 'none';
    });
  }
  $$('.acc-h').forEach(b => b.addEventListener('click', () => {
    const it = b.parentElement, was = it.classList.contains('open');
    $$('.acc-i').forEach(x => { x.classList.remove('open'); x.querySelector('.acc-h').setAttribute('aria-expanded', 'false'); });
    if (!was) { it.classList.add('open'); b.setAttribute('aria-expanded', 'true'); }
  }));
  $$('.chip').forEach(c => c.addEventListener('pointermove', e => { const r = c.getBoundingClientRect(); c.style.setProperty('--mx', (e.clientX - r.left) + 'px'); }));

  /* ------------------------------------------------------------------
     mouse: goo trail · irregular light reveal · magnetic letters
  ------------------------------------------------------------------ */
  const gooEls = $$('#goo i'), gooP = gooEls.map(() => ({ x: -100, y: -100 })), gooK = [20, 10, 5.5, 3.2];
  const rvEls = $$('.rv'), trail = [{ x: vw / 2, y: vh / 2, k: 14 }, { x: vw / 2, y: vh / 2, k: 7 }, { x: vw / 2, y: vh / 2, k: 3.6 }, { x: vw / 2, y: vh / 2, k: 2 }];
  function mouseFx(dt, now) {
    if (fine) gooEls.forEach((g, i) => { const q = gooP[i], tx = i ? gooP[i - 1].x : mouse.px, ty = i ? gooP[i - 1].y : mouse.py, k = 1 - Math.exp(-dt * gooK[i]); q.x = lerp(q.x, tx, k); q.y = lerp(q.y, ty, k); g.style.transform = 'translate(' + q.x.toFixed(1) + 'px,' + q.y.toFixed(1) + 'px)'; });
    const idle = now - lastMove > 2500 || mouse.px < 0, tx = idle ? vw * .5 + Math.sin(T * .45) * vw * .24 : mouse.px, ty = idle ? vh * .5 + Math.cos(T * .6) * vh * .16 : mouse.py;
    trail.forEach((t, i) => { const g = i ? trail[i - 1] : { x: tx, y: ty }, k = 1 - Math.exp(-dt * t.k); t.x = lerp(t.x, g.x, k); t.y = lerp(t.y, g.y, k); });
    const R = clamp(vw * .27, 200, 460), rs = [1, .78, .58, .4];
    rvEls.forEach(el => {
      const r = el.getBoundingClientRect(); if (r.bottom < 0 || r.top > vh) return;
      trail.forEach((t, i) => { el.style.setProperty('--x' + (i + 1), (t.x - r.left).toFixed(0) + 'px'); el.style.setProperty('--y' + (i + 1), (t.y - r.top).toFixed(0) + 'px'); el.style.setProperty('--r' + (i + 1), (R * rs[i]).toFixed(0) + 'px'); });
    });
    if (!fine && !(now - lastMove < 1200)) return;
    const mx = mouse.px, my = mouse.py, MR = Math.min(190, vw * .16), kk = 1 - Math.exp(-dt * 12);
    magGroups.forEach(g => {
      const r = g.el.getBoundingClientRect();
      let near = mx > r.left - MR && mx < r.right + MR && my > r.top - MR && my < r.bottom + MR && r.bottom > 0 && r.top < vh;
      if (near && getComputedStyle(g.el).visibility === 'hidden') near = false;
      if (!near && !g.act) return;
      let any = false;
      g.l.forEach(l => {
        const lr = l.getBoundingClientRect(), cx = lr.left + lr.width / 2 - (l._ox || 0), cy = lr.top + lr.height / 2 - (l._oy || 0), dx = mx - cx, dy = my - cy, d = Math.hypot(dx, dy) || 1, k = near ? Math.pow(clamp(1 - d / MR), 2) : 0;
        l._ox = lerp(l._ox || 0, dx / d * k * 14, kk); l._oy = lerp(l._oy || 0, dy / d * k * 10, kk); l._or = lerp(l._or || 0, clamp(dx / MR, -1, 1) * k * 12, kk);
        const lit = near && d < MR * 1.05;
        if (lit) { l.style.setProperty('--lx', (mx - lr.left + (l._ox || 0)).toFixed(0) + 'px'); l.style.setProperty('--ly', (my - lr.top + (l._oy || 0)).toFixed(0) + 'px'); if (!l._lit) { l._lit = 1; l.classList.add('lit'); } any = true; } else if (l._lit) { l._lit = 0; l.classList.remove('lit'); }
        if (Math.abs(l._ox) + Math.abs(l._oy) + Math.abs(l._or) > .06) { any = true; l.style.translate = l._ox.toFixed(1) + 'px ' + l._oy.toFixed(1) + 'px'; l.style.rotate = l._or.toFixed(1) + 'deg'; } else { l.style.translate = ''; l.style.rotate = ''; }
      });
      g.act = any;
      if (g.kin) { if (g.ls == null) g.ls = parseFloat(getComputedStyle(g.el).letterSpacing) / parseFloat(getComputedStyle(g.el).fontSize) || -.04; g.sp = lerp(g.sp, near ? 1 : 0, kk * .4); g.el.style.letterSpacing = (g.ls + g.sp * .02).toFixed(4) + 'em'; }
    });
  }

  /* ------------------------------------------------------------------
     pixel grid — quiet sections: a field of small squares that wakes up around the cursor
  ------------------------------------------------------------------ */
  const pxc = $('#pxg'), pxx = pxc.getContext('2d'); let pxE = null, pxN = 0, pxM = 0, pxCols = 0, pxRows = 0, pxCell = 24, pxOn = false;
  function pxStep(dt, a, now) {
    if (a < .01) { if (pxOn) { pxx.clearRect(0, 0, pxc.width, pxc.height); pxOn = false; } return; }
    const dpr = Math.min(devicePixelRatio || 1, 1.5), cell = small() ? 26 : 22;
    if (pxc.width !== Math.round(vw * dpr) || pxc.height !== Math.round(vh * dpr) || cell !== pxCell || !pxE) { pxc.width = Math.round(vw * dpr); pxc.height = Math.round(vh * dpr); pxCell = cell; pxCols = Math.ceil(vw / cell) + 1; pxRows = Math.ceil(vh / cell) + 1; pxE = new Float32Array(pxCols * pxRows); }
    pxOn = true; pxx.setTransform(dpr, 0, 0, dpr, 0, 0); pxx.clearRect(0, 0, vw, vh);
    const idle = now - lastMove > 2500 || mouse.px < 0, mx = idle ? vw * .5 + Math.sin(T * .5) * vw * .3 : mouse.px, my = idle ? vh * .5 + Math.cos(T * .7) * vh * .2 : mouse.py, R = Math.min(230, vw * .2), dec = Math.exp(-dt * 1.9);
    const gap = 3, s = pxCell - gap;
    for (let j = 0; j < pxRows; j++) for (let i = 0; i < pxCols; i++) {
      const k = j * pxCols + i, cx = i * pxCell + pxCell / 2, cy = j * pxCell + pxCell / 2, d = Math.hypot(cx - mx, cy - my);
      let e = pxE[k] * dec; if (d < R) e = Math.max(e, Math.pow(1 - d / R, 1.6) * (idle ? .55 : 1));
      pxE[k] = e;
      const sh = .5 + .5 * Math.sin(cx * .011 + cy * .008 + T * .6), base = .035 + .03 * sh;
      const al = (base + e * .75) * a; if (al < .02) continue;
      // cold gray → purple → lime as the energy rises
      const r = Math.round(48 + (e < .6 ? e / .6 * 70 : 70 + (e - .6) / .4 * 79)), gg = Math.round(49 + (e < .6 ? e / .6 * -9 : -9 + (e - .6) / .4 * 215)), b = Math.round(55 + (e < .6 ? e / .6 * 190 : 190 - (e - .6) / .4 * 140));
      pxx.fillStyle = 'rgba(' + r + ',' + gg + ',' + b + ',' + Math.min(.95, al).toFixed(3) + ')'; pxx.fillRect(i * pxCell + gap / 2, j * pxCell + gap / 2, s, s);
    }
  }

  /* ------------------------------------------------------------------
     per-frame DOM · step engine
     data-r="a,b"  : local-progress window an item is visible in
     data-fx       : up | pop | card | card2 | slam | none
  ------------------------------------------------------------------ */
  let introStart = 0, introT = (RM || STILL) ? 9 : 0, impact = 0, impactDone = false;
  // one motion rule for every panel: it rises from behind (smaller, soft) to the front,
  // and when its moment is over it recedes backwards. The variants only add direction.
  function stepFx(e, fx, p, a, b) {
    const ein = fx === 'slam' ? .03 : .04, eout = .04;
    const i = sm(clamp((p - a) / ein)), o = 1 - sm(clamp((p - (b - eout)) / eout)), op = i * o;
    const on = op > .01; e.style.opacity = op.toFixed(3); e.style.visibility = on ? 'visible' : 'hidden';
    if (!on || fx === 'none') return;
    const d = 1 - i, x = 1 - o;
    let sc = (.93 + .07 * i) * (1 - x * .06), tx = 0, ty = d * 24 - x * 8, rot = 'none';
    if (fx === 'slam') { sc = 1; ty = d * 18; }
    else if (fx === 'pop') { sc = (.78 + .22 * i) * (1 - x * .05); }
    else if (fx === 'card') { rot = 'y ' + (d * -75 + x * 40).toFixed(1) + 'deg'; tx = d * -40; ty = 0; }
    else if (fx === 'card2') { rot = 'x ' + (d * 65 - x * 35).toFixed(1) + 'deg'; ty = d * 70; sc = (.9 + .1 * i) * (1 - x * .08); }
    else if (fx === 'snapL') { tx = -d * 90 + x * 30; ty = 0; }
    else if (fx === 'snapR') { tx = d * 90 - x * 30; ty = 0; }
    e.style.translate = tx.toFixed(1) + 'px ' + ty.toFixed(1) + 'px'; e.style.scale = sc.toFixed(3); e.style.rotate = rot;
    const bl = d * 7 + x * 6; e.style.filter = bl > .3 ? 'blur(' + bl.toFixed(1) + 'px)' : '';
  }
  function updateDom(s, p, dt) {
    s.items.forEach(it => stepFx(it.e, it.fx, p, it.a, it.b));
    s.kids.forEach(k => { const q = (p - k.a) / (k.b - k.a), i = sm(clamp(q / .2)); k.e.style.opacity = clamp(i * 1.6).toFixed(3); k.e.style.translate = '0 ' + ((1 - i) * 18).toFixed(1) + 'px'; k.e.style.filter = i < .98 ? 'blur(' + ((1 - i) * 10).toFixed(1) + 'px)' : ''; });
    s.words.forEach(w => {
      const n = w.sp.length, q = (p - w.a) / (w.b - w.a), pr = (RM || STILL) ? 1 : clamp((q - .12) / .5), v = pr * (n + 3);
      w.sp.forEach((sp, i) => { sp.style.opacity = (.16 + .84 * clamp(v - i)).toFixed(2); });
    });
    if (s.id === 'act1') {
      const k = $('#kt1'), d = sm(clamp((p - .1) / .34)), f = d * (RM ? .25 : 1), t = introT;
      k._ch.forEach((c, i) => {
        const a = clamp((t - .35 - i * .16) / 1.6), e = a < .5 ? 2 * a * a : 1 - Math.pow(-2 * a + 2, 2) / 2, vx = (hs(i, 1) - .5) * 2, vy = (hs(i, 2) - .5) * 2;
        c.style.opacity = e.toFixed(3); c.style.filter = e < .995 ? 'blur(' + ((1 - e) * 14).toFixed(1) + 'px)' : '';
        c.style.transform = 'translate3d(' + (vx * f * vw * .55).toFixed(1) + 'px,' + (vy * f * vh * .5 + (1 - e) * vh * .02).toFixed(1) + 'px,0) rotate(' + ((hs(i, 3) - .5) * 260 * f).toFixed(1) + 'deg) scale(' + (1 + f * (.5 + hs(i, 4) * 2.4)).toFixed(3) + ')';
      });
      k.style.opacity = (1 - sm(clamp((p - .4) / .06))).toFixed(3);
      $('#introLogo').style.opacity = (sm(clamp((t - 1.6) / 1.4)) * (1 - sm(clamp((p - .05) / .06)))).toFixed(3);
      $('#sub1').style.opacity = (sm(clamp((t - 2.1) / 1.3)) * (1 - sm(clamp((p - .06) / .06)))).toFixed(3);
    }
    if (s.id === 'act2') {
      const f = $('#figs'), foc = p >= .6 && p < .775 ? 'v' : (p >= .775 && p < .93 ? 't' : '');
      let sc = 1, tx = 0;
      if (foc) {
        const el = $(foc === 'v' ? '.fig.vendor' : '.fig.tourist', f), cx = el.offsetLeft + el.offsetWidth / 2, tgt = small() ? vw * .5 : vw * (foc === 'v' ? .7 : .3);
        sc = small() ? 1.05 : 1.6; tx = tgt - vw / 2 - sc * (cx - vw / 2);
      }
      const kk = STILL ? 1 : 1 - Math.exp(-dt * 4); f._s = lerp(f._s == null ? 1 : f._s, sc, kk); f._t = lerp(f._t || 0, tx, kk);
      f.style.setProperty('--s', f._s.toFixed(3)); f.style.setProperty('--tx', f._t.toFixed(1) + 'px'); f.dataset.f = foc;
    }
    if (s.id === 'act2b') {
      const g = $('#kt2'), pp = clamp((p - .05) / .16);
      g._ch.forEach((c, i) => {
        const line2 = g._lines.indexOf(c.closest('.ln')) === 1;
        if (line2) { const drop = clamp(pp * 1.5 - .35 - hs(i, 1) * .5, 0, 1); c.style.transform = 'translate3d(' + ((hs(i, 2) - .5) * drop * 160).toFixed(1) + 'px,' + (drop * drop * vh * .35 * (.4 + hs(i, 3))).toFixed(1) + 'px,0) rotate(' + ((hs(i, 4) - .5) * 120 * drop).toFixed(1) + 'deg)'; c.style.opacity = (1 - drop * .8).toFixed(3); }
        else { c.style.transform = 'none'; c.style.opacity = 1; }
      });
      const t2 = clamp((p - .05) / .08), dr = (p - .05) * 8;
      shards.childNodes.forEach(sh => { const i = sh._k; sh.style.opacity = (sm(t2) * .85).toFixed(2); sh.style.transform = 'translate3d(' + (mouse.sx * (20 + i * 3) + Math.sin(T * .6 + i) * 18).toFixed(1) + 'px,' + (-dr * (30 + hs(i, 7) * 90) + mouse.sy * -(10 + i * 2)).toFixed(1) + 'px,0) rotate(' + ((hs(i, 8) - .5) * 90 + dr * 30 * (hs(i, 9) - .5)).toFixed(1) + 'deg)'; });
      const ci = p >= .24 && p < .43 ? 0 : (p >= .44 && p < .63 ? 1 : (p >= .64 && p < .81 ? 2 : -1));
      $$('#mini li').forEach((li, j) => li.classList.toggle('on', j === ci));
    }
    if (s.id === 'act6') {
      if (p > .08 && p < .88) layoutSys(p);
      const on = p >= .12 && p < .37 ? 0 : (p >= .38 && p < .65 ? 2 : (p >= .66 && p < .83 ? 4 : -1));
      $$('#pipe li').forEach((li, j) => li.classList.toggle('on', j === on));
      if (p < .8) aUser = false;
      if (!aUser) setAnat(p < .86 ? -1 : Math.min(4, Math.floor((p - .86) / .14 * 5)));
    }
    if (s.id === 'act7') {
      const v = $('#outVid'), a = sm(clamp((p - .34) / .1));
      v.style.opacity = a.toFixed(3); v.style.transform = 'scale(' + (1.1 - a * .1).toFixed(3) + ')'; $('#outShade').style.opacity = a.toFixed(3);
      if (p > .37 && !v._pl) { v._pl = 1; v.currentTime = 0; v.play().catch(() => { }); } else if (p < .3 && v._pl) { v._pl = 0; v.pause(); }
    }
  }

  /* ------------------------------------------------------------------
     navigation UI
  ------------------------------------------------------------------ */
  const uiActs = [[1, 'INTRO', '#act1'], [2, 'PROBLEM', '#act2'], [3, 'PRODUCT', '#act3'], [4, 'PUI SIMULATOR', '#act4'], [5, 'BE THE TOURIST', '#act5'], [6, 'SYSTEM', '#act6'], [7, 'OUTRO', '#act7']];
  $('#dots').innerHTML = uiActs.map(a => '<a href="' + a[2] + '" data-ui="' + a[0] + '" aria-label="ACT 0' + a[0] + ' ' + a[1] + '"><span>0' + a[0] + ' ' + a[1] + '</span><i></i></a>').join('');
  let tween = null;
  function goTo(y, quick) {
    cancelAnimationFrame(tween); const y0 = scrollY, d = Math.abs(y - y0), dur = quick ? 0 : Math.min(2200, 500 + d * .12), t0 = performance.now();
    if (!dur) { scrollTo(0, y); return; }
    const st = n => { const k = clamp((n - t0) / dur); scrollTo(0, lerp(y0, y, k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2)); if (k < 1) tween = requestAnimationFrame(st); }; tween = requestAnimationFrame(st);
  }
  $$('a[href^="#act"],.dots a').forEach(a => a.addEventListener('click', e => { const t = $(a.getAttribute('href')); if (!t) return; e.preventDefault(); const s = secs.find(x => x.el === t); goTo(s.top + (s.pinned ? 2 : 0)); }));
  $('#restart').addEventListener('click', () => { goTo(0, true); introStart = performance.now(); introT = RM ? 9 : 0; impactDone = RM; });
  const tl = $('#teamLink'); if (cfg.teamSite) { tl.href = cfg.teamSite; } else { tl.classList.add('off'); tl.title = 'Team site link — set teamSite in js/config.js'; tl.addEventListener('click', e => e.preventDefault()); }

  /* ------------------------------------------------------------------
     main loop
  ------------------------------------------------------------------ */
  let T = 0, ss = 0, vel = 0, flow = 0, last = 0, cs = null, ready = false, glOK = false, speed = 0, foodV = 0;
  const hudAct = $('#hudAct'), hudName = $('#hudName'), progBar = $('#progBar'), foodNote = $('#foodNote');
  let hsWas = false;
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(.05, (now - last) / 1000 || .016); last = now; T += dt;
    const y = scrollY, pss = ss; ss = (RM || STILL) ? y : lerp(ss, y, 1 - Math.exp(-dt * 9)); vel = (ss - pss) / dt;
    speed = lerp(speed, clamp(Math.abs(vel) / 3200), 1 - Math.exp(-dt * 6));
    mouse.sx = lerp(mouse.sx, mouse.x, 1 - Math.exp(-dt * 5)); mouse.sy = lerp(mouse.sy, mouse.y, 1 - Math.exp(-dt * 5));
    mouse.cx = lerp(mouse.cx, mouse.px, 1 - Math.exp(-dt * 16)); mouse.cy = lerp(mouse.cy, mouse.py, 1 - Math.exp(-dt * 16)); cur.style.transform = 'translate(' + mouse.cx.toFixed(1) + 'px,' + mouse.cy.toFixed(1) + 'px)';
    if (introStart && !RM && !STILL) introT = (now - introStart) / 1000;
    mouseFx(dt, now);
    let ci = 0; for (let k = 0; k < secs.length; k++) if (ss >= secs[k].top - .5) ci = k;
    const mid = ss + vh * .45; let ui = 0; for (let k = 0; k < secs.length; k++) if (mid >= secs[k].top) ui = k;
    const sec = secs[ci], p = secP(sec, ss);
    secs.forEach(s => { if (ss > s.top - vh * 1.2 && ss < s.top + s.h + vh * .2) updateDom(s, secP(s, ss), dt); });
    const us = secs[ui]; hudAct.textContent = 'ACT 0' + us.ui; hudName.textContent = us.name;
    $$('.dots a').forEach(a => a.setAttribute('aria-current', +a.dataset.ui === us.ui));
    progBar.style.transform = 'scaleX(' + clamp(ss / Math.max(1, document.documentElement.scrollHeight - vh)).toFixed(4) + ')';
    // simulator state follows scroll until the user takes over
    if (sec.id === 'act4') { const target = p < .3 ? 0 : (p < .6 ? 1 : 2); if (!simUser && target !== simLast) setSim(target); simLast = target; if (p < .05 || p > .98) simUser = false; } else { simUser = false; simLast = -1; }
    const inViewer = sec.id === 'act3', inSim = sec.id === 'act4';
    // viewer: scroll walks through the five points until the user takes over
    if (inViewer) {
      if (!vUser) { const idx = p < .1 ? -1 : Math.min(4, Math.floor((p - .1) / .9 * 5)); if (idx !== vAutoIdx) { vAutoIdx = idx; if (idx < 0) unfocus(); else selHS(idx, true); } }
    } else { vUser = false; vAutoIdx = -2; if (hsFocus) unfocus(); }
    if (!(inViewer || inSim)) { rotT -= Math.round(rotT / 360) * 360; rotT *= Math.exp(-dt * 2.2); rotVel = 0; auto = false; $('#autoRot').setAttribute('aria-pressed', false); }
    else if (!dragging) { rotT += rotVel; rotVel *= Math.pow(.92, dt * 60); if (auto) rotT += dt * 16; }
    rotU = lerp(rotU, rotT, 1 - Math.exp(-dt * (hsFocus ? 6 : 10)));
    hsF = lerp(hsF, hsFocus ? 1 : 0, STILL ? 1 : 1 - Math.exp(-dt * 3.2));
    // food slides through the gate in READY
    const foodT = inSim && simState === 2 ? 1 : 0; foodV = lerp(foodV, foodT, STILL ? 1 : 1 - Math.exp(-dt * (foodT ? .9 : 3)));
    foodNote.classList.toggle('on', inSim && simState === 2 && foodV > .35);
    if (glOK) {
      const tg = sceneAt(ss);
      if (!cs) cs = JSON.parse(JSON.stringify(tg)); else { const k = (RM || STILL) ? 1 : 1 - Math.exp(-dt * 7); for (const key in tg) cs[key] = mixV(cs[key], tg[key], k); }
      const S = { ...cs };
      S.eye = cs.eye.slice(); S.tg = cs.tg.slice();
      const wp = 1 - Math.min(1, cs.warp); S.eye[0] += mouse.sx * .05 * wp; S.eye[1] += mouse.sy * .03 * wp;
      // hotspot focus: camera pushes in on the clicked point
      if (hsF > .002 && hsPos[hsSel].wx != null) {
        const q = hsPos[hsSel], f = sm(hsF), dist = small() ? 1.7 : 1.45;
        const sx = small() ? 0 : -.2, tgt = [q.wx + sx, q.wy, q.wz], eyeF = [q.wx + sx + dist * .05, q.wy + dist * .12, q.wz + dist];
        for (let i = 0; i < 3; i++) { S.tg[i] = lerp(S.tg[i], tgt[i], f); S.eye[i] = lerp(S.eye[i], eyeF[i], f); }
      }
      $('#act3 .stage').style.setProperty('--hf', hsF.toFixed(3));
      pxStep(dt, cs.px, now);
      const simC = SIM[simState].col; for (let i = 0; i < 3; i++) simCol[i] = lerp(simCol[i], simC[i], 1 - Math.exp(-dt * 6));
      if (sec.id === 'act4') S.ledT = simCol;
      const ds = sec.id === 'act4' ? simState : 0;
      const tiltT = (inViewer || inSim) && !hsFocus && !dragging && fine ? mouse.sx * 12 : 0; tiltV = lerp(tiltV, tiltT, 1 - Math.exp(-dt * 4));
      if (S.vis > .5 && (inViewer || inSim) && !hsFocus) S.eye[1] += mouse.sy * .14;
      const spT = inViewer ? (hsFocus ? 1 : (hsHover >= 0 ? .6 : 0)) : 0; spotA = lerp(spotA, spT, 1 - Math.exp(-dt * 6));
      const si = hsFocus ? hsSel : (hsHover >= 0 ? hsHover : hsSel);
      if (hsPos[si].wx != null) S.spot = [hsPos[si].wx, hsPos[si].wy, hsPos[si].wz]; S.spotA = spotA;
      S.beam = cs.beam * (1 - .75 * sm(hsF)); S.vis = cs.vis; S.rot = rotU + tiltV; S.food = foodV;
      flow += dt * (RM ? 0 : .7) + Math.abs(ss - pss) * .004 * (RM ? 0 : 1);
      S.flow = flow; S.speed = speed; S.t = T; S.mouse = [mouse.sx, mouse.sy]; S.scroll = ss / vh;
      S.warp = RM ? 0 : clamp(cs.warp + speed * .12 * (cs.part > .1 ? 1 : 0)); S.flash = RM ? 0 : cs.flash;
      if (RM) S.part *= .5;
      if (S.vis > .01) { dispT += dt; if (ds !== dispShown || (ds < 2 && dispT > .1)) { if (ds !== dispShown) dispShown = ds; dispT = 0; drawDisp(dispShown, T); } }
      BR.render(S);
      const showHS = inViewer && S.vis > .5;
      if (inViewer || hsWas) updateHS(showHS); hsWas = inViewer;
      if (!ready) { ready = true; finishLoad(); }
    } else if (!ready) { ready = true; finishLoad(); }
  }
  function finishLoad() { setLd(1); setTimeout(() => { $('#loader').classList.add('done'); introStart = performance.now(); }, 250); }

  /* ------------------------------------------------------------------
     boot
  ------------------------------------------------------------------ */
  let ldp = 0; const setLd = v => { ldp = Math.max(ldp, v); $('#ldn').textContent = Math.round(ldp * 100); $('#ldb').style.width = ldp * 100 + '%'; };
  function resize() {
    measure(); const mob = small(), dpr = Math.min(window.devicePixelRatio || 1, mob ? 1.5 : 2);
    if (glOK) BR.resize(vw, vh, dpr);
    aSel = -2; setAnat(-1);
  }
  async function boot() {
    scrollTo(0, 0);
    const mob = small();
    glOK = BR.init($('#gl'), { particles: mob ? 1100 : 2200, samples: mob ? 2 : 4 });
    if (!glOK) root.classList.add('nogl');
    measure(); setLd(.15);
    try {
      if (glOK) {
        resize(); setLd(.3);
        let buf;
        if (window.BRIDGE_GLB_B64) { const bin = atob(window.BRIDGE_GLB_B64); const u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i); buf = u8.buffer; window.BRIDGE_GLB_KEEP = window.BRIDGE_GLB_B64; window.BRIDGE_GLB_B64 = null; }
        else { buf = await (await fetch('assets/model/bridge.glb')).arrayBuffer(); }
        setLd(.7); BR.loadModel(buf); setLd(.9);
      }
    } catch (e) { console.error('[BRIDGE] model load failed', e); }
    try { await Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 1800))]); } catch (e) { }
    measure(); dispShown = -1;
    let rt; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(resize, 120); });
    addEventListener('load', () => measure(true));
    try { let mt, lh = document.body.offsetHeight; new ResizeObserver(() => { const h = document.body.offsetHeight; if (h === lh) return; lh = h; clearTimeout(mt); mt = setTimeout(() => measure(true), 60); }).observe(document.body); } catch (e) { }
    last = performance.now(); requestAnimationFrame(frame);
    setTimeout(() => { if (!ready) { ready = true; finishLoad(); } }, 6000);
  }
  boot();
  window.__BRIDGE = { goTo, secs: () => secs, state: () => ({ ss, simState, scStep: sc.i, ready, glOK, hsSel, hsFocus }) };
})();
