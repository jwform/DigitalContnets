/* =====================================================================
   2030 MYEONGDONG — EXPERIENCE CONTROLLER
   states: off → stairs (scroll drives the climb) → ground ("CLICK TO EXPLORE")
           → explore (WASD + mouse, collisions, discovery) ⇄ inspect (product viewer)
   ===================================================================== */
(function(){
'use strict';
const {MB,M4,hex}=CE;const W=window.CW,P=window.CP;

/* ---- product data — replace with the real products when material is ready ---- */
const PRODUCTS=[
  {key:'p1',no:'01',zone:'STREET FOOD ZONE · 떡볶이 명가 앞',name:'PRODUCT 01 (가제)',line:'포장마차 거리의 떡볶이 명가 바로 앞, 보행 동선 옆에 설치된 제품 자리입니다. 실제 제품 자료가 오면 이 모델과 문구를 교체합니다.',feat:['교체 가능한 임시 3D 모델 (구) — assets/city/game.js PRODUCTS','라임·보라 조명의 원형 받침대 위에 설치','E로 관찰 · 드래그로 회전'],shape:'sphere'},
  {key:'p2',no:'02',zone:'OLIVE YOUNG · 매장 안 쇼윈도',name:'PRODUCT 02 (가제)',line:'올리브영 매장 안, 유리 쇼윈도 바로 뒤의 조명 받침대에 놓인 제품 자리입니다. 매장에 들어가지 않고 유리 앞에서 바로 관찰할 수 있습니다. 실제 자료로 교체 예정입니다.',feat:['교체 가능한 임시 3D 모델 (육면체)','매장 내부 쇼윈도 · 유리 앞에서 E로 관찰','E로 관찰 · 드래그로 회전'],shape:'cube'},
  {key:'p3',no:'03',zone:'INTERSECTION · 명동 교차로',name:'PRODUCT 03 (가제)',line:'교차로 보행 공간에 놓일 제품 자리입니다. 신호·횡단보도와의 연결을 빛의 흐름으로 보여줍니다.',feat:['교체 가능한 임시 3D 모델 (원뿔)','보행 신호 · 횡단보도와 연결된 데이터 흐름 표시','E로 관찰 · 드래그로 회전'],shape:'cone'}
];

W.products.sort((a,b)=>a.key<b.key?-1:1);
const G=window.CITY={state:'off',ready:false,found:new Set(),cam:{pos:[0,-2.3,-8.6],yaw:Math.PI,pitch:.3,fov:1.18},vel:[0,0],keys:{},look:{x:0,y:0}};
try{JSON.parse(localStorage.getItem('md2030_found')||'[]').forEach(k=>G.found.add(k))}catch(e){}
const $=s=>document.querySelector(s);
const clamp=(v,a=0,b=1)=>Math.min(b,Math.max(a,v)),lerp=(a,b,t)=>a+(b-a)*t,sm=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t)};

/* ---------------- dynamic prop meshes ---------------- */
const pm=new MB();const PR={};const part=(n,fn)=>{const i0=pm.i.length;fn();PR[n]={first:i0,count:pm.i.length-i0}};
const w1=[1,1,1];
part('pSphere',()=>{pm.sphere([0,.32,0],[.3,.3,.3],18,w1,[10,0,0,0]);pm.cyl([0,.02,0],[0,.06,0],.36,.36,28,w1.map(v=>v*.6),[10,0,0,0])});
part('pCube',()=>{pm.box(-.2,.02,-.2,.2,.42,.2,w1,[10,0,0,0]);pm.box(-.205,.2,-.205,.205,.225,.205,[.8,.6,1],[9,2.5,0,0])});
part('pCone',()=>{pm.cyl([0,.02,0],[0,.78,0],.3,.0,24,w1,[10,0,0,0]);pm.cyl([0,.02,0],[0,.08,0],.34,.32,24,w1.map(v=>v*.55),[10,0,0,0])});
part('ring',()=>{for(let s=0;s<48;s++){const a0=s/48*Math.PI*2,a1=(s+1)/48*Math.PI*2;pm.quad([Math.cos(a0)*.96,0,Math.sin(a0)*.96],[Math.cos(a1)*.96,0,Math.sin(a1)*.96],[Math.cos(a1),0,Math.sin(a1)],[Math.cos(a0),0,Math.sin(a0)],w1,[9,2,0,0],undefined,[0,1,0])}});
part('dot',()=>pm.sphere([0,0,0],[.045,.045,.045],6,w1,[9,4,0,0]));
part('sigHead',()=>pm.box(-.16,-.45,-.12,.16,.45,.12,[.12,.12,.15],[10,0,0,0]));
part('lamp',()=>pm.sphere([0,0,0],[.075,.075,.04],8,w1,[9,5,0,0]));
part('treeT',()=>pm.cyl([0,0,0],[0,1.6,0],.07,.05,8,[.32,.26,.24],[0,0,0,0]));
part('treeF',()=>{[[0,1.95,0,.5],[.28,1.75,.15,.36],[-.25,1.8,-.12,.4],[0,2.3,.05,.34]].forEach(([x,y,z,r])=>pm.sphere([x,y,z],[r,r*.85,r],9,w1,[0,0,0,0],(p,n)=>[p[0]*(1+.08*Math.sin(n[1]*9)),p[1],p[2]*(1+.08*Math.cos(n[0]*7))]))});
part('lantern',()=>{const N=7;for(let i=0;i<=N;i++){const t=i/N,z=t,y=-.55*4*t*(1-t);pm.sphere([0,y,z],[.06,.09,.06/9.6],5,[1,.85,.6],[9,5,0,0])}});
part('wire',()=>{const N=16;for(let i=0;i<N;i++){const t0=i/N,t1=(i+1)/N;pm.cyl([0,-.55*4*t0*(1-t0),t0],[0,-.55*4*t1*(1-t1),t1],.006,.006,3,[.15,.15,.18],[0,0,0,0],false)}});
/* car: lofted body with curved panels (cross-sections along the length), separate glass / tyres / lights.
   Procedural — a GLB vehicle can replace it later (see README). */
const CARX=[],CARS=[];(function(){const N=26;
  const sm3=x=>x<0?0:x>1?1:x*x*(3-2*x);
  for(let i=0;i<=N;i++){const x=-2.3+4.6*i/N;CARX.push(x);
    const nose=sm3((2.3-x)/.55),tail=sm3((x+2.3)/.45);const w=.9*(.8+.2*Math.min(nose,tail));
    const yb=x>1.15?.8-.24*Math.pow((x-1.15)/1.15,2):(x<-1.55?.84-.1*Math.pow((-1.55-x)/.75,2):.82+.02*Math.sin(x));
    const g0=-1.3,g1=1.0;let yr=yb;if(x>g0&&x<g1){const t=(x-g0)/(g1-g0);yr=yb+.58*Math.min(1,sm3(t/.32)*sm3((1-t)/.38))}
    const ww=.72;const P=[[0,.24],[w*.86,.24],[w,.34],[w,yb-.08],[w*.96,yb],[ww,yb+.05],[ww*.86,yr-.04],[ww*.62,Math.max(yr,yb+.02)],[0,Math.max(yr,yb+.025)]];
    CARS.push(P)}})();
function carLoft(glassPass){const N=CARX.length-1,K=CARS[0].length;const G=[];
  for(let i=0;i<=N;i++){const row=[];for(let k=-K+1;k<K;k++){const q=CARS[i][Math.abs(k)];row.push([CARX[i],q[1],k<0?-q[0]:q[0]])}G.push(row)}
  const M=G[0].length,nr=(i,k)=>{const a=G[Math.min(N,i+1)][k],b=G[Math.max(0,i-1)][k],c=G[i][Math.min(M-1,k+1)],d=G[i][Math.max(0,k-1)];
    const u=[a[0]-b[0],a[1]-b[1],a[2]-b[2]],v=[c[0]-d[0],c[1]-d[1],c[2]-d[2]];let n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];const l=Math.hypot(...n)||1;return n.map(x=>-x/l)};
  for(let i=0;i<N;i++)for(let k=0;k<M-1;k++){const ka=Math.abs(k-(K-1)),kb=Math.abs(k+1-(K-1));const seg=Math.max(ka,kb);
    const x=(CARX[i]+CARX[i+1])/2;const side=Math.min(ka,kb)>=4&&Math.max(ka,kb)<=6,roof=Math.min(ka,kb)>=6;
    const glass=(side&&x>-1.2&&x<.95)||(roof&&((x>.45&&x<.98)||(x>-1.3&&x<-.85)));
    if(glass!==glassPass)continue;const mt=glass?[10,0,0,0]:[10,0,0,0],cl=glass?[.05,.06,.09]:w1;
    const ids=[[i,k],[i+1,k],[i+1,k+1],[i,k+1]].map(([a,b])=>pm.vert(G[a][b],nr(a,b),cl,mt,[0,0]));pm.tri(ids[0],ids[2],ids[1]);pm.tri(ids[0],ids[3],ids[2])}
  if(!glassPass)[0,N].forEach(i=>{const cy=(CARS[i][3][1]+.24)/2;const c=pm.vert([CARX[i],cy,0],[i?1:-1,0,0],w1,[10,0,0,0],[0,0]);
    for(let k=0;k<M-1;k++){const a=pm.vert(G[i][k],[i?1:-1,0,0],w1,[10,0,0,0],[0,0]),b=pm.vert(G[i][k+1],[i?1:-1,0,0],w1,[10,0,0,0],[0,0]);i?pm.tri(c,a,b):pm.tri(c,b,a)}})}
part('carBody',()=>{carLoft(false);pm.box(-1.9,.18,-.8,1.9,.26,.8,[.08,.08,.1],[10,0,0,0]);[-.94,.94].forEach(z=>pm.box(.7,.86,z-.05*Math.sign(z),.85,.95,z+.08*Math.sign(z),w1,[10,0,0,0]))});
part('carFix',()=>{carLoft(true);
  [[-1.42,-.84],[1.42,-.84],[-1.42,.84],[1.42,.84]].forEach(([x,z])=>{const s=Math.sign(z);pm.cyl([x,.34,z-.12*s],[x,.34,z+.1*s],.34,.34,16,[.07,.07,.08],[0,0,0,0]);
    pm.cyl([x,.34,z+.1*s],[x,.34,z+.112*s],.22,.22,16,[.72,.74,.8],[10,0,0,0]);pm.cyl([x,.34,z+.112*s],[x,.34,z+.116*s],.1,.1,10,[.6,.4,1],[9,2.5,0,0])});
  pm.box(2.22,.6,-.72,2.29,.66,-.38,[1,.97,.92],[9,6,0,0]);pm.box(2.22,.6,.38,2.29,.66,.72,[1,.97,.92],[9,6,0,0]);pm.box(2.24,.69,-.6,2.3,.705,.6,[.75,.9,1],[9,3,0,0]);
  pm.box(-2.3,.76,-.8,-2.25,.8,.8,[1,.12,.25],[9,4.5,0,0]);pm.box(-2.0,.2,-.82,2.0,.23,.82,[.6,.3,1],[9,3,0,0])});
part('puff',()=>pm.quad([-.5,-.5,0],[.5,-.5,0],[.5,.5,0],[-.5,.5,0],w1,[13,1,0,0],[[0,0],[1,0],[1,1],[0,1]],[0,0,1]));
part('beacon',()=>{pm.cyl([0,.18,0],[0,0,0],.11,0,4,w1,[9,4,0,0]);pm.cyl([0,.18,0],[0,.24,0],.11,.0,4,w1,[9,4,0,0])});
part('flow',()=>pm.sphere([0,0,0],[.05,.05,.05],6,[.77,1,.2],[9,6,0,0]));

/* ---------------- boot ---------------- */
G.init=function(canvas){
  try{
    const r=new CE.Renderer(canvas);G.r=r;
    r.atlas(W.atlas);G.world=r.upload(W.mb);G.decal=r.upload(W.dm);G.glass=r.upload(W.gb);if(P.init)P.init(r);G.props=r.upload(pm);
    r.lights=W.lights.slice();G.ready=true;
  }catch(e){console.warn('[CITY] WebGL2 init failed',e);G.fail=String(e);const f=$('#ctyFail');if(f)f.style.display='flex'}
  bindUI();
};

/* ---------------- input ---------------- */
function bindUI(){
  addEventListener('keydown',e=>{const k=e.key.toLowerCase();G.keys[k]=true;
    if(G.state==='explore'&&['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright',' '].includes(k))e.preventDefault();
    if(k==='e'){if(G.state==='explore'&&G.target!=null)inspect(G.target);else if(G.state==='inspect')back()}
    if(k==='escape'&&G.state==='inspect')back();
    if((G.state==='explore'||G.state==='return')&&['1','2','3','0'].includes(k))NAV.select(k==='0'?null:+k-1)});
  addEventListener('keyup',e=>{G.keys[e.key.toLowerCase()]=false});
  addEventListener('blur',()=>{G.keys={}});
  const cv=G.r?G.r.cv:$('#ctyCv');
  $('#ctyClick').addEventListener('click',()=>enterExplore());
  document.addEventListener('pointerlockchange',()=>{G.locked=document.pointerLockElement===cv;
    if(!G.locked&&G.state==='explore'){$('#ctyClick').classList.add('show');$('#ctyClick b').textContent='CLICK TO RESUME'}});
  addEventListener('mousemove',e=>{if(G.state==='explore'&&G.locked){G.cam.yaw-=e.movementX*.0021;G.cam.pitch=clamp(G.cam.pitch-e.movementY*.0021,-1.2,1.25)}});
  // drag-look fallback (no pointer lock) + drag-rotate in the product viewer
  let drag=null;cv.addEventListener('pointerdown',e=>{if(G.state==='inspect'||(G.state==='explore'&&!G.locked)){drag={x:e.clientX,y:e.clientY};cv.setPointerCapture(e.pointerId)}});
  cv.addEventListener('pointermove',e=>{if(!drag)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;drag={x:e.clientX,y:e.clientY};
    if(G.state==='inspect'){G.spin.y+=dx*.01;G.spin.x=clamp(G.spin.x+dy*.01,-1.1,1.1)}else{G.cam.yaw-=dx*.004;G.cam.pitch=clamp(G.cam.pitch-dy*.004,-1.2,1.25)}});
  cv.addEventListener('pointerup',()=>{drag=null});
  addEventListener('wheel',e=>{if(G.state==='explore'||G.state==='inspect')e.preventDefault()},{passive:false});
  $('#ctyBack').addEventListener('click',()=>back());
  $('#ctyInteract').addEventListener('click',()=>{G.demo=!G.demo;$('#ctyInteract').classList.toggle('on',G.demo);$('#ctyInteract span').textContent=G.demo?'STOP':'INTERACT'});
  $('#ctySubway').addEventListener('click',()=>leave());
  document.querySelectorAll('#ctyNav [data-dest]').forEach(b=>b.addEventListener('click',e=>{e.stopPropagation();const i=+b.dataset.dest;NAV.select(NAV.dest===i?null:i)}));
  updCount();
}
function enterExplore(){if(!G.ready)return;
  if(G.state==='ground'||G.state==='stairs'){G.state='explore';document.documentElement.classList.add('city-lock');G.hudT=performance.now()}
  $('#ctyClick').classList.remove('show');
  try{const p=G.r.cv.requestPointerLock();if(p&&p.catch)p.catch(()=>{G.noLock=true})}catch(e){G.noLock=true}
}
function leave(){try{document.exitPointerLock()}catch(e){}G.state='off';G.inStairs=false;document.documentElement.classList.remove('city-lock');
  $('#ctyPanel').classList.remove('show');G.r.dim=0;scrollTo({top:0,behavior:'smooth'})}

/* ---------------- product viewer ---------------- */
G.spin={x:0,y:0};
function inspect(i){const p=W.products[i];G.state='inspect';G.insp=i;G.spin={x:.15,y:0};G.demo=false;$('#ctyInteract').classList.remove('on');$('#ctyInteract span').textContent='INTERACT';
  try{document.exitPointerLock()}catch(e){}
  G.saved={pos:G.cam.pos.slice(),yaw:G.cam.yaw,pitch:G.cam.pitch};
  const dx=G.cam.pos[0]-p.pos[0],dz=G.cam.pos[2]-p.pos[2],l=Math.hypot(dx,dz)||1;
  G.insT={pos:[p.pos[0]+dx/l*1.35,p.pos[1]+.42,p.pos[2]+dz/l*1.35],yaw:Math.atan2(dx/l,dz/l),pitch:-.22,t:0};
  const d=PRODUCTS[i];$('#ctyNo').textContent='PRODUCT '+d.no;$('#ctyZone').textContent=d.zone;$('#ctyName').textContent=d.name;$('#ctyLine').textContent=d.line;
  $('#ctyFeat').innerHTML=d.feat.map(f=>`<li>${f}</li>`).join('');$('#ctyPanel').classList.add('show');$('#ctyPrompt').classList.remove('show');
  if(!G.found.has(d.key)){G.found.add(d.key);try{localStorage.setItem('md2030_found',JSON.stringify([...G.found]))}catch(e){}updCount(true)}
}
function back(){if(G.state!=='inspect')return;G.state='return';G.retT=0;G.demo=false;$('#ctyPanel').classList.remove('show');
  try{const p=G.r.cv.requestPointerLock();if(p&&p.catch)p.catch(()=>{})}catch(e){}}
function updCount(bump){const n=G.found.size;const el=$('#ctyCount');if(!el)return;el.textContent=String(n).padStart(2,'0');
  if(bump){el.parentElement.classList.remove('bump');void el.offsetWidth;el.parentElement.classList.add('bump')}
  if(bump&&n===3){const c=$('#ctyDone');c.classList.add('show');setTimeout(()=>c.classList.remove('show'),5200)}}

/* ---------------- collision ---------------- */
function collide(x,z,r){for(let it=0;it<3;it++)for(const b of W.colliders){if(x+r<b.x0||x-r>b.x1||z+r<b.z0||z-r>b.z1)continue;
    const cx=clamp(x,b.x0,b.x1),cz=clamp(z,b.z0,b.z1);let dx=x-cx,dz=z-cz,d=Math.hypot(dx,dz);
    if(d<1e-6){const pen=[x-b.x0+r,b.x1-x+r,z-b.z0+r,b.z1-z+r],k=pen.indexOf(Math.min(...pen));if(k===0)x=b.x0-r;else if(k===1)x=b.x1+r;else if(k===2)z=b.z0-r;else z=b.z1+r;continue}
    if(d<r){x=cx+dx/d*r;z=cz+dz/d*r}}
  return[x,z]}

/* ---------------- per-frame ---------------- */
let lastT=0;
G.frame=function(time,p,visible){
  if(!G.ready)return;const dt=Math.min(.05,Math.max(.001,time-(lastT||time)));lastT=time;
  const r=G.r,c=G.cam;
  // adaptive resolution: keep the frame rate smooth on slower GPUs
  G.acc=(G.acc||0)+dt;G.fr=(G.fr||0)+1;if(G.acc>2.5){const f=G.fr/G.acc;G.lo=f<32?(G.lo||0)+1:0;G.hi=f>58?(G.hi||0)+1:0;if(G.lo>=2){r.scale=Math.max(.6,r.scale-.1);G.lo=0}else if(G.hi>=3){r.scale=Math.min(1,r.scale+.1);G.hi=0}G.acc=0;G.fr=0}
  // ---- state from scroll (only while not exploring) ----
  if(G.state!=='explore'&&G.state!=='inspect'&&G.state!=='return'){
    if(!visible){G.state='off';return}
    const s=sm(.04,.9,p),zB=-8.7,zT=1.4;
    const z=lerp(zB,zT,s),ground=W.height(0,z);
    const stepPh=(z-W.stair.zBot)/W.stair.run;const climbing=z>W.stair.zBot&&z<0;
    c.pos=[Math.sin(stepPh*Math.PI)*.012*(climbing?1:0),ground+1.62+(climbing?Math.abs(Math.sin(stepPh*Math.PI))*.035:0),z];
    c.yaw=Math.PI+Math.sin(time*.35)*.012;c.pitch=lerp(.36,.03,Math.pow(s,1.25))+Math.sin(time*.5)*.006;
    r.exposure=lerp(.55,1.0,sm(0,.95,s));W.lights.forEach(l=>{if(l.tag==='stairs'){l.k0=l.k0??l.k;l.k=l.k0*(.5+1.1*s)}});r.flash=.18*sm(.8,.93,s)*(1-sm(.93,1,s));r.fade=sm(0,.05,p);
    G.state=p>.965?'ground':'stairs';
    $('#ctyClick').classList.toggle('show',G.state==='ground');$('#ctyClick b').textContent='CLICK TO EXPLORE';
    $('#ctyFuture').style.opacity=String((1-sm(.08,.16,p))*sm(.0,.04,p));
    G.vel=[0,0];
  }
  // ---- free exploration ----
  if(G.state==='explore'){
    const k=G.keys,run=k.shift?4.3:2.15;let fx=(k.w||k.arrowup?1:0)-(k.s||k.arrowdown?1:0),sx=(k.d||k.arrowright?1:0)-(k.a||k.arrowleft?1:0);
    if(G.noLock&&!G.locked){} // drag-look mode still allows keys
    const l=Math.hypot(fx,sx)||1;fx/=l;sx/=l;const yw=c.yaw,F=[-Math.sin(yw),-Math.cos(yw)],Rt=[Math.cos(yw),-Math.sin(yw)];
    const tv=[(F[0]*fx+Rt[0]*sx)*run,(F[1]*fx+Rt[1]*sx)*run];const a=1-Math.exp(-dt*(fx||sx?7:14));
    G.vel=[lerp(G.vel[0],tv[0],a),lerp(G.vel[1],tv[1],a)];
    let nx=c.pos[0]+G.vel[0]*dt,nz=c.pos[2]+G.vel[1]*dt;[nx,nz]=collide(nx,nz,.32);
    const spd=Math.hypot(G.vel[0],G.vel[1]);G.walk=(G.walk||0)+spd*dt;
    const gy=W.height(nx,nz)+1.62;G.gy=G.gy==null?gy:lerp(G.gy,gy,1-Math.exp(-dt*12));
    c.pos=[nx,G.gy+Math.abs(Math.sin(G.walk/.72*Math.PI))*.03*Math.min(1,spd/2),nz];
    const hint=$('#ctyKeys');if(hint)hint.classList.toggle('mini',performance.now()-G.hudT>9000);
  }
  if(G.state==='inspect'){const T=G.insT;T.t=Math.min(1,T.t+dt*1.4);const e=sm(0,1,T.t);
    c.pos=c.pos.map((v,i)=>lerp(v,T.pos[i],e*.2+.02));c.yaw=lerpA(c.yaw,T.yaw,e*.2+.02);c.pitch=lerp(c.pitch,T.pitch,e*.2+.02);r.dim=lerp(r.dim,.55,.08)}
  if(G.state==='return'){const S=G.saved;G.retT+=dt;c.pos=c.pos.map((v,i)=>lerp(v,S.pos[i],.12));c.yaw=lerpA(c.yaw,S.yaw,.12);c.pitch=lerp(c.pitch,S.pitch,.12);r.dim=lerp(r.dim,0,.12);
    if(G.retT>.7){G.state='explore';G.gy=null}}
  if(G.state==='explore')r.dim=lerp(r.dim,0,.1);
  // indoor exposure (Olive Young is brighter and cleaner)
  const inside=W.indoor(c.pos[0],c.pos[2])?1:0;r.indoor=lerp(r.indoor,inside,1-Math.exp(-dt*3));
  if(G.state==='explore'||G.state==='inspect'||G.state==='return'){r.exposure=lerp(r.exposure,lerp(1.05,.62,r.indoor),.05);r.fade=1;r.flash=lerp(r.flash,0,.1)}

  // ---- world simulation ----
  P.update(dt,time);
  const sig=P.signal(time);
  updateCars(dt,sig);

  // ---- discovery ----
  G.target=null;let near=null;
  W.products.forEach((pr,i)=>{const dx=pr.pos[0]-c.pos[0],dz=pr.pos[2]-c.pos[2],d=Math.hypot(dx,dz);pr.d=d;
    const fwd=[-Math.sin(c.yaw),-Math.cos(c.yaw)],dot=(dx*fwd[0]+dz*fwd[1])/(d||1);
    pr.glow=lerp(pr.glow||0,(G.state==='inspect'&&G.insp===i)?1:sm(4.2,2.2,d),.08);
    if(G.state==='explore'&&d<2.6&&dot>.8){G.target=i}if(!near||d<near.d)near=pr});
  $('#ctyPrompt').classList.toggle('show',G.target!=null&&G.state==='explore');

  // ---- draw list ----
  const D=[];const I=M4.ident();
  D.push({mesh:G.world,model:I,cull:false});D.push({mesh:G.decal,model:I,cull:false,poly:true});
  // dynamic lights: product glows, car lamps
  const dyn=[];W.products.forEach(pr=>{if(pr.glow>.02)dyn.push({p:[pr.pos[0],pr.pos[1]+.6,pr.pos[2]],c:[.62,.38,1],r:3.2,k:pr.glow*1.6})});
  W.cars.forEach(cr=>{const d=cr.lane?-1:1;dyn.push({p:[cr.x+d*2.6,.7,cr.lane?63.6:60.4],c:[1,.92,.8],r:6,k:.9})});
  r.lights=W.lights.concat(dyn);
  // people
  P.draws(c,null,D);
  // products
  W.products.forEach((pr,i)=>{const sh=PRODUCTS[i].shape,nm=sh==='sphere'?'pSphere':sh==='cube'?'pCube':'pCone';
    const ins=G.state==='inspect'&&G.insp===i;const sp=ins?G.spin:{x:0,y:0};const auto=time*(G.demo&&ins?1.6:.25);
    const bob=Math.sin(time*1.4+i)*.02+(G.demo&&ins?.06*Math.sin(time*3):0);
    const model=M4.chain(M4.T(pr.pos[0],pr.pos[1]-.32+bob,pr.pos[2]),M4.T(0,.35,0),M4.RX(sp.x),M4.RY(sp.y+auto),M4.T(0,-.35,0));
    D.push({mesh:G.props,...PR[nm],model,tint:[.78,.72,.95],hl:pr.glow*.9,hlc:G.target===i||ins?[.77,1,.21]:[.62,.38,1],cull:false});
    if(!ins){const fd=G.found.has(PRODUCTS[i].key),hb=pr.pos[1]+.95+Math.sin(time*2+i)*.06,kk=(fd?.35:1)*(NAV.dest===i?1.4:1);
      D.push({mesh:G.props,...PR.beacon,model:M4.chain(M4.T(pr.pos[0],hb,pr.pos[2]),M4.RY(time*1.5)),tint:[.77*kk,1*kk,.21*kk],noRefl:true,cull:false})}
    if(pr.glow>.05||(G.demo&&ins)){const pulse=(time*.7)%1,k=G.demo&&ins?1:pr.glow;
      D.push({mesh:G.props,...PR.ring,model:M4.chain(M4.T(pr.pos[0],(pr.pos[1]-.32)*0+W.height(pr.pos[0],pr.pos[2])+.02,pr.pos[2]),M4.S(.5+pulse*1.6,1,.5+pulse*1.6)),tint:[.77*(1-pulse)*k,1*(1-pulse)*k,.21*(1-pulse)*k],blend:'add',noRefl:true,cull:false})}
  });
  // product 03 — data flow linking the device to the walk signal and the crosswalk
  {const p3=W.products[2],k=Math.max(p3.glow,(G.state==='inspect'&&G.insp===2)?1:0)*(G.demo&&G.insp===2?1.6:1);
    if(k>.05){const path=[[p3.pos[0],.9,p3.pos[2]],[-7.6,2.6,57.6],[-6.4,.05,58.9],[6.4,.05,58.9],[6.4,.05,65.2]];
      for(let j=0;j<18;j++){const u=((time*.35+j/18)%1);const seg=u*(path.length-1),si=Math.floor(seg),t=seg-si;const a=path[si],b=path[Math.min(path.length-1,si+1)];
        D.push({mesh:G.props,...PR.flow,model:M4.T(lerp(a[0],b[0],t),lerp(a[1],b[1],t),lerp(a[2],b[2],t)),tint:[k,k,k],blend:'add',cull:false})}}}
  // signals
  W.signals.forEach(s=>{if(s.car){const on=sig.car;D.push({mesh:G.props,...PR.sigHead,model:M4.chain(M4.T(s.x,s.y,s.z),M4.RY(Math.PI/2)),cull:false});
      [['r',.28,[1,.12,.18]],['y',0,[1,.75,.2]],['g',-.28,[.3,1,.55]]].forEach(([k,dy,cc])=>D.push({mesh:G.props,...PR.lamp,model:M4.chain(M4.T(s.x,s.y+dy,s.z+(s.z<62?-.13:.13))),tint:on===k?cc:cc.map(v=>v*.06),cull:false}))}
    else{const g=sig.ped==='g'||(sig.ped==='f'&&Math.sin(time*10)>0);D.push({mesh:G.props,...PR.sigHead,model:M4.chain(M4.T(s.x,s.y,s.z),M4.S(1,.7,1)),cull:false});
      D.push({mesh:G.props,...PR.lamp,model:M4.T(s.x,s.y+.15,s.z+s.face*.13),tint:g?[.06,.1,.08]:[1,.15,.2],cull:false});D.push({mesh:G.props,...PR.lamp,model:M4.T(s.x,s.y-.15,s.z+s.face*.13),tint:g?[.3,1,.6]:[.03,.08,.05],cull:false})}});
  // trees & lantern strings sway gently
  W.trees.forEach(t=>{const sw=Math.sin(time*.8+t.ph)*.03;D.push({mesh:G.props,...PR.treeT,model:M4.chain(M4.T(t.x,.5,t.z),M4.RZ(sw*.3)),cull:false});
    D.push({mesh:G.props,...PR.treeF,model:M4.chain(M4.T(t.x,.5,t.z),M4.RZ(sw),M4.RX(sw*.6)),tint:hex(t.c),cull:false})});
  W.lanterns.forEach(l=>{const sw=Math.sin(time*.9+l.ph)*.06;const m=M4.chain(M4.T(l.x,l.y,l.z0),M4.RZ(sw),M4.S(1,1,l.z1-l.z0));
    D.push({mesh:G.props,...PR.wire,model:m,cull:false});D.push({mesh:G.props,...PR.lantern,model:m,cull:false})});
  // cars
  W.cars.forEach(cr=>{const md=M4.chain(M4.T(cr.x,0,cr.lane?63.6:60.4),M4.RY(cr.lane?Math.PI:0));D.push({mesh:G.props,...PR.carBody,model:md,tint:cr.col,cull:false});D.push({mesh:G.props,...PR.carFix,model:md,cull:false})});
  // steam from the cooking surfaces (camera-facing additive puffs, only near the viewer)
  {const yawB=Math.atan2(c.pos[0],c.pos[2]);W.steam.forEach(st=>{const dx=st.x-c.pos[0],dz=st.z-c.pos[2];if(dx*dx+dz*dz>900)return;const fy=Math.atan2(c.pos[0]-st.x,c.pos[2]-st.z);
    for(let j=0;j<3;j++){const u=(time*.32+j/3+st.k)%1,sz=.2+u*.55,a=Math.sin(u*Math.PI)*.07;
      D.push({mesh:G.props,...PR.puff,model:M4.chain(M4.T(st.x+Math.sin(time*.7+j*2+st.k*9)*.12*u,st.y+u*1.3,st.z),M4.RY(fy),M4.S(sz,sz,sz)),tint:[a,a*.95,a*1.05],blend:'add',noRefl:true,cull:false})}})}
  // navigation route on the ground (first ~16 m)
  if(NAV.path&&G.state==='explore'){let acc=0,prev=[c.pos[0],c.pos[2]];const step=1.1,off=(time*1.4)%step;let need=off;
    for(let j=1;j<NAV.path.length&&acc<16;j++){const q=NAV.path[j],sl=Math.hypot(q[0]-prev[0],q[1]-prev[1]);
      while(need<=sl&&acc+need<16){const t=need/sl,x=lerp(prev[0],q[0],t),z=lerp(prev[1],q[1],t);if(acc+need>1.2)D.push({mesh:G.props,...PR.dot,model:M4.chain(M4.T(x,W.height(x,z)+.05,z),M4.S(1.3,.5,1.3)),tint:[.77,1,.21],blend:'add',noRefl:true,cull:false});need+=step}
      need-=sl;acc+=sl;prev=q}}
  // glass last (blended)
  D.push({mesh:G.glass,model:I,tint:[.06,.09,.08],blend:'add',cull:false});

  if(window.SKIPDRAW)D.splice(0,D.length,...D.filter(window.SKIPDRAW));
  r.render(c,time,D);
  if(G.state==='explore'||G.state==='inspect'||G.state==='return'){NAV.update(time);compass();NAV.draw()}
};
/* =====================================================================
   NAVIGATION — walk grid (0.5 m) built from the floor rectangles minus the colliders
   (inflated by the player radius), A* with 8-neighbours, line-of-sight smoothing.
   ===================================================================== */
const NAV=G.nav={dest:null,path:null,dist:0,t:0,cs:.5};
(function build(){const rs=W.walk.concat([[-1.6,-9.7,1.6,.2]]);let x0=1e9,z0=1e9,x1=-1e9,z1=-1e9;rs.forEach(r=>{x0=Math.min(x0,r[0]);z0=Math.min(z0,r[1]);x1=Math.max(x1,r[2]);z1=Math.max(z1,r[3])});
  const cs=NAV.cs,nx=Math.ceil((x1-x0)/cs),nz=Math.ceil((z1-z0)/cs),g=new Uint8Array(nx*nz);
  Object.assign(NAV,{x0,z0,nx,nz,g});
  rs.forEach(r=>{for(let j=Math.max(0,Math.floor((r[1]-z0)/cs));j<Math.min(nz,Math.ceil((r[3]-z0)/cs));j++)for(let i=Math.max(0,Math.floor((r[0]-x0)/cs));i<Math.min(nx,Math.ceil((r[2]-x0)/cs));i++){
    const cx=x0+(i+.5)*cs,cz=z0+(j+.5)*cs;if(cx>=r[0]&&cx<=r[2]&&cz>=r[1]&&cz<=r[3])g[j*nx+i]=1}});
  const inf=.38;W.colliders.forEach(b=>{for(let j=Math.max(0,Math.floor((b.z0-inf-z0)/cs));j<Math.min(nz,Math.ceil((b.z1+inf-z0)/cs));j++)for(let i=Math.max(0,Math.floor((b.x0-inf-x0)/cs));i<Math.min(nx,Math.ceil((b.x1+inf-x0)/cs));i++){
    const cx=x0+(i+.5)*cs,cz=z0+(j+.5)*cs;if(cx>b.x0-inf&&cx<b.x1+inf&&cz>b.z0-inf&&cz<b.z1+inf)g[j*nx+i]=0}});
  // minimap base image (1 px per cell): streets, building footprints
  const cv=document.createElement('canvas');cv.width=nx;cv.height=nz;const x=cv.getContext('2d'),im=x.createImageData(nx,nz);
  for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){const o=((nz-1-j)*nx+i)*4,w=g[j*nx+i];
    im.data[o]=w?58:14;im.data[o+1]=w?54:12;im.data[o+2]=w?82:24;im.data[o+3]=w?255:200}
  x.putImageData(im,0,0);NAV.img=cv})();
NAV.cell=(x,z)=>[Math.floor((x-NAV.x0)/NAV.cs),Math.floor((z-NAV.z0)/NAV.cs)];
NAV.ok=(i,j)=>i>=0&&j>=0&&i<NAV.nx&&j<NAV.nz&&NAV.g[j*NAV.nx+i]===1;
NAV.near=(i,j)=>{if(NAV.ok(i,j))return[i,j];for(let r=1;r<14;r++)for(let a=-r;a<=r;a++)for(const[di,dj]of[[a,-r],[a,r],[-r,a],[r,a]])if(NAV.ok(i+di,j+dj))return[i+di,j+dj];return null};
NAV.los=(a,b)=>{const d=Math.hypot(b[0]-a[0],b[1]-a[1]),n=Math.ceil(d/.2);for(let k=1;k<n;k++){const t=k/n,[i,j]=NAV.cell(lerp(a[0],b[0],t),lerp(a[1],b[1],t));if(!NAV.ok(i,j))return false}return true};
NAV.astar=function(sx,sz,tx,tz){const s=NAV.near(...NAV.cell(sx,sz)),t=NAV.near(...NAV.cell(tx,tz));if(!s||!t)return null;
  const nx=NAV.nx,N=nx*NAV.nz,gS=new Float32Array(N).fill(1e9),from=new Int32Array(N).fill(-1),closed=new Uint8Array(N);
  const H=(i,j)=>{const dx=Math.abs(i-t[0]),dz=Math.abs(j-t[1]);return(dx+dz)+(1.4142-2)*Math.min(dx,dz)};
  const heap=[];const push=(f,n)=>{heap.push([f,n]);let k=heap.length-1;while(k>0){const p=(k-1)>>1;if(heap[p][0]<=heap[k][0])break;[heap[p],heap[k]]=[heap[k],heap[p]];k=p}};
  const pop=()=>{const top=heap[0],last=heap.pop();if(heap.length){heap[0]=last;let k=0;for(;;){const l=2*k+1,r=l+1;let m=k;if(l<heap.length&&heap[l][0]<heap[m][0])m=l;if(r<heap.length&&heap[r][0]<heap[m][0])m=r;if(m===k)break;[heap[m],heap[k]]=[heap[k],heap[m]];k=m}}return top};
  const si=s[1]*nx+s[0],ti=t[1]*nx+t[0];gS[si]=0;push(H(...s),si);let it=0;
  while(heap.length&&it++<200000){const[,n]=pop();if(closed[n])continue;closed[n]=1;if(n===ti)break;const i=n%nx,j=(n/nx)|0;
    for(let dj=-1;dj<=1;dj++)for(let di=-1;di<=1;di++){if(!di&&!dj)continue;const a=i+di,b=j+dj;if(!NAV.ok(a,b))continue;if(di&&dj&&(!NAV.ok(i+di,j)||!NAV.ok(i,j+dj)))continue;
      const m=b*nx+a,ng=gS[n]+(di&&dj?1.4142:1);if(ng<gS[m]){gS[m]=ng;from[m]=n;push(ng+H(a,b),m)}}}
  if(from[ti]<0&&si!==ti)return null;
  const raw=[];for(let n=ti;n>=0;n=from[n]){raw.push([NAV.x0+(n%nx+.5)*NAV.cs,NAV.z0+(((n/nx)|0)+.5)*NAV.cs]);if(n===si)break}raw.reverse();
  raw[0]=[sx,sz];const out=[raw[0]];let k=0;while(k<raw.length-1){let m=raw.length-1;while(m>k+1&&!NAV.los(raw[k],raw[m]))m--;out.push(raw[m]);k=m}
  return out};
NAV.select=function(i){NAV.dest=i;NAV.path=null;NAV.t=0;document.querySelectorAll('#ctyNav [data-dest]').forEach(b=>b.classList.toggle('on',+b.dataset.dest===i));
  $('#ctyNav').classList.toggle('active',i!=null);if(i==null){$('#ctyNavD').textContent='PRESS 1 · 2 · 3'}};
NAV.update=function(time){if(NAV.dest==null)return;const c=G.cam,p=W.products[NAV.dest];const tg=p.nav||p.pos;
  if(!NAV.path||time-NAV.t>.5){NAV.t=time;const r=NAV.astar(c.pos[0],c.pos[2],tg[0],tg[tg.length===2?1:2]);if(r){NAV.path=r;NAV.fail=false}else NAV.fail=true}
  if(NAV.path){NAV.path[0]=[c.pos[0],c.pos[2]];let d=0;for(let k=1;k<NAV.path.length;k++)d+=Math.hypot(NAV.path[k][0]-NAV.path[k-1][0],NAV.path[k][1]-NAV.path[k-1][1]);NAV.dist=d}
  const arrived=p.d<2.4;const nxt=NAV.path&&NAV.path[1]?NAV.path[1]:[p.pos[0],p.pos[2]];
  const b=Math.atan2(nxt[0]-c.pos[0],nxt[1]-c.pos[2]),hd=Math.atan2(-Math.sin(c.yaw),-Math.cos(c.yaw));NAV.rel=b-hd;
  $('#ctyNavD').innerHTML=NAV.fail&&!NAV.path?'NO ROUTE':arrived?'<b>ARRIVED</b> · PRESS E':`PRODUCT ${PRODUCTS[NAV.dest].no} · <b>${Math.round(NAV.dist)} m</b>`;
  $('#ctyNavA').style.transform=`rotate(${NAV.rel}rad)`;$('#ctyNavA').style.opacity=arrived?.3:1};
NAV.draw=function(){const cv=$('#ctyMap');if(!cv)return;const dpr=Math.min(2,devicePixelRatio||1),S=cv.clientWidth||180;if(cv.width!==S*dpr){cv.width=cv.height=S*dpr}
  const x=cv.getContext('2d'),c=G.cam,ppm=3.2*dpr,h=S*dpr/2;x.setTransform(1,0,0,1,0,0);x.clearRect(0,0,cv.width,cv.height);
  x.save();x.beginPath();x.arc(h,h,h-1,0,Math.PI*2);x.clip();x.fillStyle='rgba(8,7,14,.82)';x.fillRect(0,0,cv.width,cv.height);
  const W2S=(wx,wz)=>[h+(wx-c.pos[0])*ppm,h-(wz-c.pos[2])*ppm];
  x.imageSmoothingEnabled=false;{const[a,b]=W2S(NAV.x0,NAV.z0+NAV.nz*NAV.cs);x.globalAlpha=.95;x.drawImage(NAV.img,a,b,NAV.nx*NAV.cs*ppm,NAV.nz*NAV.cs*ppm);x.globalAlpha=1}
  // route
  if(NAV.path){x.strokeStyle='#c5ff35';x.lineWidth=2.2*dpr;x.setLineDash([5*dpr,4*dpr]);x.shadowColor='#c5ff35';x.shadowBlur=6*dpr;x.beginPath();NAV.path.forEach((q,k)=>{const[a,b]=W2S(q[0],q[1]);k?x.lineTo(a,b):x.moveTo(a,b)});x.stroke();x.setLineDash([]);x.shadowBlur=0}
  // destinations (clamped to the rim when off-map)
  W.products.forEach((p,i)=>{let[a,b]=W2S(p.pos[0],p.pos[2]);const dx=a-h,dy=b-h,d=Math.hypot(dx,dy),lim=h-11*dpr;const out=d>lim;if(out){a=h+dx/d*lim;b=h+dy/d*lim}
    const f=G.found.has(PRODUCTS[i].key),sel=NAV.dest===i;x.fillStyle=f?'#c5ff35':'#9d5cff';x.strokeStyle=sel?'#fff':'rgba(0,0,0,.6)';x.lineWidth=(sel?2:1)*dpr;
    x.beginPath();x.arc(a,b,(sel?8:6.5)*dpr,0,Math.PI*2);x.fill();x.stroke();x.fillStyle=f?'#111':'#fff';x.font=`600 ${7.5*dpr}px "JetBrains Mono",monospace`;x.textAlign='center';x.textBaseline='middle';x.fillText(PRODUCTS[i].no,a,b+.5*dpr)});
  // player arrow (facing)
  const F=[-Math.sin(c.yaw),-Math.cos(c.yaw)],ang=Math.atan2(F[0],F[1]);x.translate(h,h);x.rotate(ang);
  x.fillStyle='rgba(197,255,53,.12)';x.beginPath();x.moveTo(0,0);x.arc(0,0,34*dpr,-Math.PI/2-.5,-Math.PI/2+.5);x.closePath();x.fill();
  x.fillStyle='#fff';x.shadowColor='#9d5cff';x.shadowBlur=8*dpr;x.beginPath();x.moveTo(0,-8*dpr);x.lineTo(5.5*dpr,6*dpr);x.lineTo(0,3*dpr);x.lineTo(-5.5*dpr,6*dpr);x.closePath();x.fill();x.restore();
  x.strokeStyle='rgba(245,245,246,.25)';x.lineWidth=1*dpr;x.beginPath();x.arc(h,h,h-1,0,Math.PI*2);x.stroke();
  x.fillStyle='#fff';x.font=`500 ${9*dpr}px "JetBrains Mono",monospace`;x.textAlign='center';x.fillText('N',h,10*dpr)};
function lerpA(a,b,t){let d=b-a;while(d>Math.PI)d-=Math.PI*2;while(d<-Math.PI)d+=Math.PI*2;return a+d*t}
function updateCars(dt,sig){const stopFor=sig.car!=='g';
  W.cars.forEach(cr=>{const d=cr.lane?-1:1;let target=6.5;
    const stopX=d>0?-9.6:9.6;const ahead=(stopX-cr.x)*d;if(stopFor&&ahead>0&&ahead<9)target=Math.max(0,(ahead-1)*1.1);
    W.cars.forEach(o=>{if(o===cr||o.lane!==cr.lane)return;const gap=(o.x-cr.x)*d;if(gap>0&&gap<12)target=Math.min(target,Math.max(0,(gap-6)*1.2))});
    cr.v=lerp(cr.v,target,1-Math.exp(-dt*1.8));cr.x+=cr.v*d*dt;if(cr.x>66)cr.x=-66;if(cr.x<-66)cr.x=66})}
/* compass: real bearings of the three products relative to the view direction */
function compass(){const el=$('#ctyComp');if(!el)return;const c=G.cam;const hd=Math.atan2(-Math.sin(c.yaw),-Math.cos(c.yaw));
  let html='';const span=Math.PI*.75,Wd=el.clientWidth||420;
  [['N',0],['E',Math.PI/2],['S',Math.PI],['W',-Math.PI/2]].forEach(([n,a])=>{let r=a-hd;while(r>Math.PI)r-=Math.PI*2;while(r<-Math.PI)r+=Math.PI*2;if(Math.abs(r)<span/2)html+=`<i class="cd" style="left:${(r/span+.5)*Wd}px">${n}</i>`});
  for(let a=-Math.PI;a<Math.PI;a+=Math.PI/12){let r=a-hd;while(r>Math.PI)r-=Math.PI*2;while(r<-Math.PI)r+=Math.PI*2;if(Math.abs(r)<span/2)html+=`<s style="left:${(r/span+.5)*Wd}px"></s>`}
  W.products.forEach((p,i)=>{const b=Math.atan2(p.pos[0]-c.pos[0],p.pos[2]-c.pos[2]);let r=b-hd;while(r>Math.PI)r-=Math.PI*2;while(r<-Math.PI)r+=Math.PI*2;const cl=Math.max(-.5,Math.min(.5,r/span));
    const f=G.found.has(PRODUCTS[i].key);html+=`<b class="${f?'f':''} ${Math.abs(r)>span/2?'edge':''} ${NAV.dest===i?'sel':''}" style="left:${(cl+.5)*Wd}px"><em>${PRODUCTS[i].no}</em><u>${Math.round(p.d||0)}m</u></b>`});
  el.innerHTML=html}
})();
