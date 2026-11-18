/* =====================================================================
   2030 MYEONGDONG — PEDESTRIANS (V14)
   Real skinned characters: the supplied Mixamo model (assets/characters/chars.js, converted from
   character.fbx + Mixamo animation FBX files). GPU skinning, crossfaded animation states,
   stride-matched walking speed (no foot sliding), mesh variants (clothing shells / hair / accessories
   bound to the same skeleton), distance LOD, contact shadows, local light tinting.
   ===================================================================== */
(function(){
'use strict';
const W=window.CW;const {M4,hex,MB}=CE;
const P=window.CP={agents:[],ready:false};
let seed=4242;const R=()=>{seed=(seed*16807)%2147483647;return(seed-1)/2147483646};
const pick=a=>a[Math.floor(R()*a.length)];

/* ---------------- package ---------------- */
const PK=window.CHARS;if(!PK){console.warn('[CP] chars.js missing');return}
const META=PK.meta;
const raw=atob(PK.bin);const BIN=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)BIN[i]=raw.charCodeAt(i);
const L=META.layout;
const pnu=new Float32Array(BIN.buffer,L.pnu[0],L.pnu[1]),col=new Uint8Array(BIN.buffer,L.col[0],L.col[1]),joint=new Uint8Array(BIN.buffer,L.joint[0],L.joint[1]),
  weight=new Uint8Array(BIN.buffer,L.weight[0],L.weight[1]),idx=new Uint32Array(BIN.buffer,L.idx[0],L.idx[1]);
const SK=META.skeleton,NB=SK.length;const PAR=SK.map(s=>s.parent),RT=SK.map(s=>s.t),IB=SK.map(s=>Float32Array.from(s.ib));
const PARTS=META.parts;
function dec(b64,T){const r=atob(b64);const u=new Uint8Array(r.length);for(let i=0;i<r.length;i++)u[i]=r.charCodeAt(i);return new T(u.buffer)}
const CLIPS={};for(const k in META.clips){const c=META.clips[k];const q16=dec(c.q,Int16Array),h32=dec(c.hips,Int32Array);
  const q=new Float32Array(q16.length);for(let i=0;i<q.length;i++)q[i]=q16[i]/32767;const h=new Float32Array(h32.length);for(let i=0;i<h.length;i++)h[i]=h32[i]/1e4;
  CLIPS[k]={frames:c.frames,fps:c.fps,speed:c.speed,q,h}}
P.clips=CLIPS;

/* ---------------- looks: archetypes from the reference sheet, built only from real mesh parts ---------------- */
const HAIRC=['#121117','#121117','#1c1a22','#9a98a6','#e8e6ee','#3a2450','#b9aed6','#4a3022','#2a1d16'];
const ACC=['#5ee7ff','#c5ff35','#b06bff','#ff4fd8'];
const ARCH=[
  {tex:1,parts:[['jacket_crop','#ecebf2','#b06bff'],['pants_wide','#16151b','#2a2733'],['crossbag','#1a1920','#c5ff35']],hair:['hair_twinbuns','hair_bob','hair_short_layer','hair_ponytail']},
  {tex:2,parts:[['jacket_tech','#1b1a22','#c5ff35'],['collar','#1b1a22','#c5ff35'],['pants_wide','#1b1a22','#c5ff35'],['cargo_pockets','#22212a','#22212a']],hair:['hair_short_tex','hair_messy','hair_asym']},
  {tex:2,parts:[['jacket_long','#6b1d36','#2a1018'],['pants_wide','#c9c6d2','#8a8796'],['cargo_pockets','#b7b4c0','#b7b4c0']],hair:['hair_long','hair_bob','hair_short_layer']},
  {tex:5,parts:[['jacket_long','#ece9f2','#b06bff'],['coat_tail','#ece9f2','#b06bff'],['pants_slim','#141318','#141318'],['boots','#141318','#5ee7ff']],hair:['hair_short_layer','hair_ponytail','hair_long']},
  {tex:4,parts:[['jacket_crop','#3b2c5a','#b06bff'],['skirt','#141318','#b06bff'],['boots','#121116','#b06bff']],hair:['hair_bob','hair_twinbuns','hair_long']},
  {tex:7,parts:[['jacket_long','#2c2a33','#5ee7ff'],['hood','#2c2a33','#5ee7ff'],['pants_wide','#22202a','#5ee7ff'],['neckphones','#121116','#5ee7ff']],hair:['hair_messy','hair_short_tex']},
  {tex:6,base:['hairO','phonesO','glassesO'],parts:[],hair:[]},                                    // the supplied character, restyled
  {tex:5,parts:[['jacket_tech','#1e2236','#ff4fd8'],['pants_slim','#1e2236','#ff4fd8'],['backpack','#1c1d2c','#ff4fd8']],hair:['hair_short_tex','hair_ponytail','hair_asym'],cap:.5},
  {tex:0,base:['hairO','phonesO','glassesO'],parts:[],hair:[]},                                    // the supplied character, unchanged
  {tex:3,parts:[['puffer','#e8e6ee','#9d5cff'],['pants_wide','#1b1a21','#1b1a21']],hair:['hair_bob','hair_long','hair_asym']},
];
let archN=0;
function makeLook(o={}){const A=ARCH[o.arch??(archN++%ARCH.length)];
  const L={tex:A.tex,draw:[],scale:.94+R()*.12,clip:R()<.22?'textwalk':'walk',rim:[.5,.3,1]};
  (A.base||[]).forEach(n=>L.draw.push({part:n,mode:n==='phonesO'&&R()<.5?1:0,tint:n==='phonesO'?hex(pick(['#5ee7ff','#ffffff','#ff4fd8','#c5ff35'])):[1,1,1]}));
  A.parts.forEach(([n,c1,c2])=>L.draw.push({part:n,mode:2,tint:hex(c1),tint2:hex(R()<.3&&c2!==c1?pick(ACC):c2)}));
  if(A.hair.length){const hs=pick(A.hair);L.draw.push({part:hs,mode:3,tint:hex(pick(HAIRC))});
    if(A.cap&&R()<A.cap&&/short|asym|pony/.test(hs))L.draw.push({part:'cap',mode:2,tint:hex(pick(['#121116','#e9e6ef','#2a2733'])),tint2:hex(pick(ACC))});}
  if(!A.base&&R()<.22)L.draw.push({part:'glasses',mode:2,tint:[.05,.05,.06],tint2:[.05,.05,.06]});
  if(R()<.25)L.draw.push({part:'earrings',mode:2,tint:[.8,.8,.9],tint2:hex(pick(ACC))});
  if(R()<.3)L.draw.push({part:'wristband',mode:2,tint:[.1,.1,.12],tint2:hex(pick(ACC))});
  if(!A.parts.some(p=>p[0]==='backpack')&&R()<.2){L.draw.push({part:'shopbag',mode:2,tint:hex(pick(['#f2f0f6','#1c1b22','#e3d5c0'])),tint2:hex(pick(ACC))});L.clip='shopwalk'}
  L.body={part:'body',mode:0,tint:[1,1,1]};
  return L}

/* ---------------- agents ---------------- */
function routeLen(r){let L=0;for(let i=1;i<r.length;i++)L+=Math.hypot(r[i][0]-r[i-1][0],r[i][1]-r[i-1][1]);return L}
function agent(o){const a=Object.assign({look:makeLook(o),u:0,dir:1,heading:0,state:'walk',wait:0,speed:1.0+R()*.35,ph:R(),pose:'idle',t:R()*20,
    cA:null,tA:R()*10,cB:null,tB:0,fade:1,moving:0},o);
  if(a.route){a.total=routeLen(a.route);a.u=(o.u0??R())*a.total;a.dir=o.dir??(R()<.5?1:-1)}
  if(a.jog){a.look.clip='jog';a.speed=CLIPS.jog.speed*.95}
  P.agents.push(a);return a}
const pts=(...a)=>a,HW=W.HW||9;
// main street south (promenade + sidewalks), singles / pairs / a tourist group / a runner
for(let i=0;i<5;i++)agent({route:pts([-3.4,-18],[-3.4,54]),lane:(R()-.5)*.8});
for(let i=0;i<5;i++)agent({route:pts([3.5,-18],[3.5,54]),lane:(R()-.5)*.8});
for(let i=0;i<3;i++)agent({route:pts([-6.6,-18],[-6.6,33]),lane:(R()-.5)*.6});
for(let i=0;i<3;i++)agent({route:pts([6.7,-18],[6.7,54]),lane:(R()-.5)*.6});
{const a=agent({route:pts([-2.6,2],[-2.6,52]),u0:.3,dir:1,speed:1.05,lane:-.35});agent({route:a.route,u0:.3,dir:1,lane:.35,pairOf:a})}
{const a=agent({route:pts([2.4,4],[2.4,52]),u0:.55,dir:-1,speed:.95,lane:0});agent({route:a.route,u0:.55,dir:-1,lane:.6,pairOf:a});agent({route:a.route,u0:.55,dir:-1,lane:-.6,pairOf:a})}
agent({route:pts([0.9,2],[0.9,52]),jog:true,u0:.2});
// main street north, around the market spine
for(let i=0;i<3;i++)agent({route:pts([-6.5,70],[-6.5,106]),lane:(R()-.5)*.6});
for(let i=0;i<3;i++)agent({route:pts([6.4,70],[6.4,106]),lane:(R()-.5)*.6});
agent({route:pts([-3.9,70],[-3.9,106]),stops:[[-3.9,77.6,Math.PI/2],[-3.9,90.2,Math.PI/2]],speed:.9});
agent({route:pts([3.9,70],[3.9,106]),stops:[[3.9,82.4,-Math.PI/2],[3.9,95.1,-Math.PI/2]],speed:.95});
// food alley: browsing (detour around the product pedestal), through traffic, a pair
agent({route:pts([-10,23.75],[-19.0,23.75],[-19.4,25.15],[-20.8,25.15],[-21.2,23.75],[-34,23.75]),stops:[[-14.0,23.75,Math.PI],[-25.3,23.75,Math.PI],[-30.7,23.75,Math.PI]],speed:.95});
agent({route:pts([-10,28.25],[-34,28.25]),stops:[[-16.6,28.25,0],[-27.4,28.25,0]],speed:.9});
agent({route:pts([-10,26.1],[-34,26.1]),speed:1.15});agent({route:pts([-10,26.9],[-34,26.9]),speed:1.05,u0:.7});
{const a=agent({route:pts([-10,25.6],[-34,25.6]),speed:1,u0:.3,lane:0});agent({route:a.route,u0:.3,dir:a.dir,lane:.55,pairOf:a})}
// lane & cross-street sidewalks
agent({route:pts([-33,31],[-33,55])});agent({route:pts([-56,57.15],[56,57.15])});agent({route:pts([-56,57.5],[56,57.5])});agent({route:pts([-56,66.85],[56,66.85])});agent({route:pts([56,67.2],[-56,67.2])});
// crossing at the zebra (waits for the walk signal)
agent({route:pts([-1.6,46],[-1.6,57.4],[-1.6,66.6],[-1.6,70]),cross:true});agent({route:pts([1.4,70],[1.4,66.6],[1.4,57.4],[1.4,40]),cross:true,dir:1,u0:.1});
agent({route:pts([-5.6,40],[-5.6,57.4],[-5.6,66.6],[-6.2,80]),cross:true,u0:.45,dir:1});agent({route:pts([-33,46],[-33,57.4],[-33,66.6],[-20,66.9]),cross:true});
// into Olive Young
agent({route:pts([6.2,43.5],[9.7,43.5],[12.2,43.5],[12.2,39.0],[18,39.0]),stops:[[18,39.0,Math.PI]],speed:.9});
agent({route:pts([6.4,44.2],[9.7,44.2],[12.2,44.2],[19,44.2],[19,48.6]),stops:[[19,48.6,Math.PI]],speed:.95,u0:.6});
// standing behaviours
const stand=(x,z,hd,pose,o={})=>agent(Object.assign({pos:[x,z],heading:hd,state:'stand',pose},o));
stand(-13.1,23.7,Math.PI,'stall');stand(-25.9,23.65,Math.PI,'stall');stand(-17.2,28.35,0,'stall');stand(-29.2,28.1,0,'phone');stand(-22.6,23.7,Math.PI,'stall');
stand(-3.75,75.4,Math.PI/2,'stall');stand(3.75,88.6,-Math.PI/2,'stall');stand(-3.8,98.4,Math.PI/2,'phone');stand(-5.6,37.5,-Math.PI/2,'stall');
W.vendors.forEach((v,i)=>{if(i%4===3)return;stand(v.x,v.z,v.hd,'vendor')});
stand(HW-.8,14.5,Math.PI/2,'window');stand(HW-.8,28,Math.PI/2,'window');stand(-HW+.8,8,-Math.PI/2,'window');stand(HW-.85,47.9,Math.PI/2+.25,'window');
stand(5.6,22,-.9,'talk');stand(6.25,22.6,-.9+Math.PI,'talk');stand(-30.5,40,0.5,'talk');stand(-30.9,40.75,0.5+Math.PI,'talk');
stand(-6.2,9,.4,'phone');stand(7.1,66.9,Math.PI,'phone');stand(6.6,72,2.6,'phone');
stand(14,48.6,-Math.PI/2+.2,'window');stand(20.4,41.5,Math.PI,'window');
P.indoor=a=>W.indoor(a.x,a.z);

/* ---------------- simulation ---------------- */
P.signal=t=>{const c=t%24;return{car:c<12?'g':c<14?'y':'r',ped:c>=14&&c<23?'g':(c>=23?'f':'r')}};
function posOnRoute(r,u){let acc=0;for(let i=1;i<r.length;i++){const a=r[i-1],b=r[i],l=Math.hypot(b[0]-a[0],b[1]-a[1]);if(u<=acc+l){const t=(u-acc)/l;return{x:a[0]+(b[0]-a[0])*t,z:a[1]+(b[1]-a[1])*t,dx:(b[0]-a[0])/l,dz:(b[1]-a[1])/l}}acc+=l}
  const a=r[r.length-2],b=r[r.length-1],l=Math.hypot(b[0]-a[0],b[1]-a[1]);return{x:b[0],z:b[1],dx:(b[0]-a[0])/l,dz:(b[1]-a[1])/l}}
function turn(a,b,k){let d=b-a;while(d>Math.PI)d-=Math.PI*2;while(d<-Math.PI)d+=Math.PI*2;return a+d*Math.min(1,k)}
function want(a){ // animation state the agent should be in
  if(a.state==='stand')return a.pose==='phone'?'phone':'idle';
  if(a.wait>0||a.moving<.3)return a.pose==='phone'?'phone':'idle';
  return a.look.clip}
P.update=(dt,time)=>{const sig=P.signal(time);
  for(const a of P.agents){a.t+=dt;
    if(a.state==='stand'){a.x=a.pos[0];a.z=a.pos[1];a.moving=0}
    else if(a.wait>0){a.wait-=dt;a.moving=Math.max(0,a.moving-dt*3);if(a.waitHeading!=null)a.heading=turn(a.heading,a.waitHeading,dt*3)}
    else{
      let v=a.pairOf?a.pairOf.speed*(a.pairOf.wait>0?0:1):a.speed;if(a.pairOf&&a.pairOf.wait>0){a.wait=a.pairOf.wait;a.waitHeading=a.pairOf.waitHeading}
      let nu=a.u+v*dt*a.dir;
      const p0=posOnRoute(a.route,a.u),p1=posOnRoute(a.route,Math.max(0,Math.min(a.total,nu)));
      let held=false;
      if(a.cross&&sig.ped!=='g'){const on=z=>z>57.9&&z<66.1;if(!on(p0.z)&&on(p1.z)){a.wait=.3;a.waitHeading=Math.atan2(p1.x-p0.x,p1.z-p0.z);held=true}}
      if(!held&&a.stops&&!a.pairOf){for(const s of a.stops){const d0=Math.hypot(p0.x-s[0],p0.z-s[1]),d1=Math.hypot(p1.x-s[0],p1.z-s[1]);
        if(d1<.1&&d0>=.1&&(a.lastStop!==s||a.t-(a.lastStopT||0)>25)){a.wait=4+R()*5;a.waitHeading=s[2];a.lastStop=s;a.lastStopT=a.t;break}}}
      if(!held){if(nu>=a.total||nu<=0){a.dir*=-1;nu=Math.max(0,Math.min(a.total,nu))}
        a.u=nu;const p=posOnRoute(a.route,a.u);const side=[p.dz,-p.dx];a.x=p.x+side[0]*(a.lane||0)*a.dir;a.z=p.z+side[1]*(a.lane||0)*a.dir;
        a.heading=turn(a.heading,Math.atan2(p.dx*a.dir,p.dz*a.dir),dt*4);a.moving=Math.min(1,a.moving+dt*3);a.v=v}
    }
    // animation state machine with 0.35 s crossfades; walk playback rate = speed / stride speed (feet stay planted)
    const w=want(a);if(a.cA!==w){a.cB=a.cA;a.tB=a.tA;a.cA=w;a.tA=w==='idle'||w==='phone'?R()*20:0;a.fade=a.cB?0:1}
    const cA=CLIPS[a.cA];let rate=1;if(cA.speed>0)rate=(a.v||a.speed)/cA.speed/(a.look.scale||1);
    a.tA+=dt*rate;if(a.cB){a.tB+=dt;a.fade=Math.min(1,a.fade+dt/.35);if(a.fade>=1)a.cB=null}
  }};

/* ---------------- pose evaluation (CPU FK -> bone palette rows) ---------------- */
const qa=new Float32Array(NB*4),qb=new Float32Array(NB*4),ha=new Float32Array(3),hb=new Float32Array(3);
const Gq=new Float32Array(NB*4),Gp=new Float32Array(NB*3);
function sample(c,t,q,h){const n=c.frames;let f=(t*c.fps)%n;if(f<0)f+=n;const i0=f|0,i1=(i0+1)%n,a=f-i0;const o0=i0*NB*4,o1=i1*NB*4;
  for(let b=0;b<NB;b++){const k=b*4;let x1=c.q[o1+k],y1=c.q[o1+k+1],z1=c.q[o1+k+2],w1=c.q[o1+k+3];const x0=c.q[o0+k],y0=c.q[o0+k+1],z0=c.q[o0+k+2],w0=c.q[o0+k+3];
    if(x0*x1+y0*y1+z0*z1+w0*w1<0){x1=-x1;y1=-y1;z1=-z1;w1=-w1}
    let x=x0+(x1-x0)*a,y=y0+(y1-y0)*a,z=z0+(z1-z0)*a,w=w0+(w1-w0)*a;const l=1/Math.hypot(x,y,z,w);q[k]=x*l;q[k+1]=y*l;q[k+2]=z*l;q[k+3]=w*l}
  for(let j=0;j<3;j++)h[j]=c.h[i0*3+j]+(c.h[i1*3+j]-c.h[i0*3+j])*a}
function poseInto(a,out,off){
  sample(CLIPS[a.cA],a.tA,qa,ha);
  if(a.cB){sample(CLIPS[a.cB],a.tB,qb,hb);const f=a.fade*a.fade*(3-2*a.fade);
    for(let b=0;b<NB;b++){const k=b*4;let s=qa[k]*qb[k]+qa[k+1]*qb[k+1]+qa[k+2]*qb[k+2]+qa[k+3]*qb[k+3]<0?-1:1;
      let x=qb[k]+(qa[k]*s-qb[k])*f,y=qb[k+1]+(qa[k+1]*s-qb[k+1])*f,z=qb[k+2]+(qa[k+2]*s-qb[k+2])*f,w=qb[k+3]+(qa[k+3]*s-qb[k+3])*f;const l=1/Math.hypot(x,y,z,w);qa[k]=x*l;qa[k+1]=y*l;qa[k+2]=z*l;qa[k+3]=w*l}
    for(let j=0;j<3;j++)ha[j]=hb[j]+(ha[j]-hb[j])*f}
  for(let b=0;b<NB;b++){const k=b*4,p=PAR[b];const lx=qa[k],ly=qa[k+1],lz=qa[k+2],lw=qa[k+3];
    let tx,ty,tz;if(p<0){tx=ha[0];ty=ha[1];tz=ha[2];Gq[k]=lx;Gq[k+1]=ly;Gq[k+2]=lz;Gq[k+3]=lw}
    else{const pk=p*4,px=Gq[pk],py=Gq[pk+1],pz=Gq[pk+2],pw=Gq[pk+3];const t=RT[b];
      // rotate t by the parent's global quaternion: v' = v + 2w(u x v) + 2 u x (u x v)
      const cx=py*t[2]-pz*t[1],cy=pz*t[0]-px*t[2],cz=px*t[1]-py*t[0];
      const ccx=py*cz-pz*cy,ccy=pz*cx-px*cz,ccz=px*cy-py*cx;
      tx=Gp[p*3]+t[0]+2*(pw*cx+ccx);ty=Gp[p*3+1]+t[1]+2*(pw*cy+ccy);tz=Gp[p*3+2]+t[2]+2*(pw*cz+ccz);
      Gq[k]=pw*lx+px*lw+py*lz-pz*ly;Gq[k+1]=pw*ly-px*lz+py*lw+pz*lx;Gq[k+2]=pw*lz+px*ly-py*lx+pz*lw;Gq[k+3]=pw*lw-px*lx-py*ly-pz*lz}
    Gp[b*3]=tx;Gp[b*3+1]=ty;Gp[b*3+2]=tz;
    // skin matrix = G * IB  (column-major)
    const x=Gq[k],y=Gq[k+1],z=Gq[k+2],w=Gq[k+3];
    const r00=1-2*(y*y+z*z),r01=2*(x*y-z*w),r02=2*(x*z+y*w),r10=2*(x*y+z*w),r11=1-2*(x*x+z*z),r12=2*(y*z-x*w),r20=2*(x*z-y*w),r21=2*(y*z+x*w),r22=1-2*(x*x+y*y);
    const B=IB[b],o=off+b*16;
    for(let c=0;c<4;c++){const b0=B[c*4],b1=B[c*4+1],b2=B[c*4+2],b3=B[c*4+3];
      out[o+c*4]=r00*b0+r01*b1+r02*b2+tx*b3;out[o+c*4+1]=r10*b0+r11*b1+r12*b2+ty*b3;out[o+c*4+2]=r20*b0+r21*b1+r22*b2+tz*b3;out[o+c*4+3]=b3}}}

/* ---------------- GPU resources ---------------- */
let boneData=null;const TEX=[];
P.init=function(r){P.r=r;
  P.mesh=r.uploadSkinned({pnu,col,joint,weight,idx});
  PK.tex.forEach((uri,i)=>{const im=new Image();TEX[i]=null;im.onload=()=>{TEX[i]=r.texture(im)};im.src=uri});
  const bm=new MB();bm.quad([-.5,0,.5],[.5,0,.5],[.5,0,-.5],[-.5,0,-.5],[1,1,1],[11,0,0,0],[[0,0],[1,0],[1,1],[0,1]],[0,1,0]);P.blob=r.upload(bm);
  boneData=new Float32Array(NB*16*96);P.ready=true};

/* local light colour for each character (signs above someone tint them) */
function localTint(a){const lp=W.lights;let r=0,g=0,b=0,s=0;const y=1.4;
  for(let i=0;i<lp.length;i++){const l=lp[i];const dx=l.p[0]-a.x,dy=l.p[1]-y,dz=l.p[2]-a.z;const d2=dx*dx+dy*dy+dz*dz;if(d2>l.r*l.r*1.4)continue;const k=(l.k??1)/(1+d2*.35);r+=l.c[0]*k;g+=l.c[1]*k;b+=l.c[2]*k;s+=k}
  const base=[.42,.24,.9];if(s<1e-3)return base;const m=Math.max(r,g,b)||1;return[base[0]*.5+r/m*.55,base[1]*.5+g/m*.55,base[2]*.5+b/m*.55]}

P.draws=(cam,_unused,D)=>{if(!P.ready)return;
  const fx=-Math.sin(cam.yaw),fz=-Math.cos(cam.yaw);let n=0;const vis=[];
  for(const a of P.agents){const dx=a.x-cam.pos[0],dz=a.z-cam.pos[2],d=Math.hypot(dx,dz);a.camD=d;
    if(d>62)continue;if(d>3&&(dx*fx+dz*fz)/d<-.25)continue;if(n>=96)break;vis.push(a);a.inst=n++}
  for(const a of vis)poseInto(a,boneData,a.inst*NB*16);
  P.r.bones(boneData,NB,Math.max(1,n));P.visible=n;
  for(const a of vis){const L=a.look,far=a.camD>17,refl=a.camD<13;
    if(!a.rimT||a.t-a.rimT>.5){a.rim=localTint(a);a.rimT=a.t}
    const model=M4.chain(M4.T(a.x,W.height(a.x,a.z),a.z),M4.RY(a.heading),M4.S(L.scale,L.scale,L.scale));
    const tex=TEX[L.tex]||TEX[0];
    const add=(p,o)=>{const pr=PARTS[p];if(!pr)return;D.push({mesh:P.mesh,first:pr.first,count:pr.count,inst:a.inst,model,mode:o.mode,tint:o.tint||[1,1,1],tint2:o.tint2||[1,1,1],tex,rim:a.rim,cull:false,noRefl:!refl})};
    add(far?'body_lod':'body',L.body);
    for(const d of L.draw){let p=d.part;if(far&&(p==='hairO'||p==='phonesO'))p+='_lod';if(far&&(p==='earrings'||p==='glasses'||p==='glassesO'||p==='wristband'))continue;add(p,d)}
    D.push({mesh:P.blob,model:M4.chain(M4.T(a.x,W.height(a.x,a.z)+.01,a.z),M4.S(.95*L.scale,1,.95*L.scale)),blend:'mul',noRefl:true,poly:true,cull:false})}
};
})();
