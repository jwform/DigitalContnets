/* =====================================================================
   2030 MYEONGDONG — WORLD (V14)
   Layout (metres, +z = north, the subway exit faces +z):
     main street  x -9..9  (central wet promenade x -4.6..4.6 with LED edges, sidewalks to the building line)
     food alley   x -36..-9, z 21..31          lane x -36..-30, z 31..56
     cross street z 56..68 (road 58.5..65.5)   Olive Young  x 9..25, z 34..54 (glass front on x = 9)
   Z-fighting rules used everywhere in this file:
     · building lots never overlap (every footprint is assigned once; back-fill blocks keep a 0.4 m gap)
     · anything attached to a wall starts INSIDE the wall (d<0), so no face is coplanar with the facade
     · flat overlays (sign faces, LED screens, road markings, posters) live in a separate decal mesh drawn
       with polygon offset, and still sit >= 1 cm in front of their backing
     · window frames are real geometry built on the same 2.3 m x 3.3 m grid the facade shader uses
   ===================================================================== */
(function(){
'use strict';
const {MB,hex}=CE;
const W=window.CW={colliders:[],lights:[],products:[],signals:[],trees:[],lanterns:[],cars:[],glass:null};
let seed=20301;const R=()=>{seed=(seed*16807)%2147483647;return(seed-1)/2147483646};
const pick=a=>a[Math.floor(R()*a.length)];
const MAT={plain:0,facade:1,ground:2,sign:3,tile:4,shop:5,step:7,char:8,emis:9,metal:10,screen:12,clad:15};
const m=(id,em=0,p1=0,p2=0)=>[id,em,p1,p2];
const HW=9,PROM=4.6;W.HW=HW;

/* ---------------- sign atlas (2048²): 44 horizontal 512x128 · 16 neon icons 128² · 16 vertical 128x512 ---------------- */
const AT={cv:document.createElement('canvas'),slots:{}};AT.cv.width=AT.cv.height=2048;
(function buildAtlas(){
  const c=AT.cv.getContext('2d');c.clearRect(0,0,2048,2048);
  const H=['올리브영','OLIVE YOUNG','명동 화장품','K-BEAUTY LAB','서울 스킨','스킨케어','뷰티 하우스','네일 아트','향수 PERFUME','패션 플러스','MD STYLE','스니커즈 랩',
    'SEOUL GOODS','K-POP STORE','HANBOK RENTAL','안경 · 렌즈','환전 EXCHANGE','약국 PHARMACY','카페 2030','BUBBLE TEA','디저트 바','코인노래방','PC 방','포토 스튜디오',
    'VR 아케이드','명동 칼국수','명동 교자','라멘 야타이','닭강정','떡볶이 명가','어묵','호떡','닭꼬치','튀김','붕어빵','음료 · 스무디',
    '호텔 명동','미래은행','24H 편의점','명동역 MYEONGDONG STN.','명동길','EXIT 6','MYEONGDONG','명동 2030'];
  const COLS=['#ff4fd8','#b06bff','#5ee7ff','#ff7ab6','#8f7bff','#4fc3ff','#ffffff','#ff5fa2','#c9a8ff','#62f0ff','#ffcf7a'];
  const font=(w,sz)=>`${w} ${sz}px "Pretendard","Noto Sans KR","Apple SD Gothic Neo","Malgun Gothic",sans-serif`;
  H.forEach((t,i)=>{const x=(i%4)*512,y=Math.floor(i/4)*128;const col=t.includes('올리브')||t.includes('OLIVE')?'#b8ff7a':COLS[i%COLS.length];
    c.save();c.beginPath();c.rect(x,y,512,128);c.clip();
    const sz=t.length>12?44:t.length>8?56:70;c.font=font(800,sz);c.textAlign='center';c.textBaseline='middle';
    c.shadowColor=col;c.shadowBlur=26;c.fillStyle=col;c.fillText(t,x+256,y+66);c.fillText(t,x+256,y+66);c.shadowBlur=4;c.fillStyle='#fff';c.globalAlpha=.72;c.fillText(t,x+256,y+66);
    c.globalAlpha=1;c.shadowBlur=14;c.strokeStyle=col;c.lineWidth=3;c.strokeRect(x+10,y+10,492,108);c.restore();
    AT.slots[t]=[x/2048,y/2048,(x+512)/2048,(y+128)/2048]});
  // neon icons (glowing logos), row y = 1408
  const IC=['ring','heart','lips','cup','star','moon','bolt','diamond','note','eye','k','arrow','tri','spark','wave','ko'];
  IC.forEach((n,i)=>{const x=i*128,y=1408,cx=x+64,cy=y+64,col=COLS[(i*5)%COLS.length];c.save();c.beginPath();c.rect(x,y,128,128);c.clip();
    c.strokeStyle=col;c.fillStyle=col;c.lineWidth=7;c.lineCap='round';c.lineJoin='round';c.shadowColor=col;c.shadowBlur=18;
    const P=new Path2D();
    if(n==='ring'){P.arc(cx,cy,44,0,7);P.moveTo(cx+24,cy);P.arc(cx,cy,24,0,7)}
    if(n==='heart'){P.moveTo(cx,cy+38);P.bezierCurveTo(cx-60,cy-2,cx-30,cy-50,cx,cy-18);P.bezierCurveTo(cx+30,cy-50,cx+60,cy-2,cx,cy+38)}
    if(n==='lips'){P.moveTo(cx-46,cy);P.quadraticCurveTo(cx-20,cy-30,cx,cy-12);P.quadraticCurveTo(cx+20,cy-30,cx+46,cy);P.quadraticCurveTo(cx,cy+40,cx-46,cy);P.moveTo(cx-40,cy);P.lineTo(cx+40,cy)}
    if(n==='cup'){P.rect(cx-30,cy-18,48,46);P.moveTo(cx+18,cy-8);P.arc(cx+28,cy+4,12,-1.5,1.5);P.moveTo(cx-18,cy-34);P.quadraticCurveTo(cx-8,cy-46,cx-14,cy-56)}
    if(n==='star'){for(let k=0;k<11;k++){const a=-Math.PI/2+k*Math.PI/5,r=k%2?20:46;k?P.lineTo(cx+Math.cos(a)*r,cy+Math.sin(a)*r):P.moveTo(cx+Math.cos(a)*r,cy+Math.sin(a)*r)}}
    if(n==='moon'){P.arc(cx,cy,44,.6,5.7);P.arc(cx+20,cy-6,32,5.2,1.1,true)}
    if(n==='bolt'){P.moveTo(cx+10,cy-50);P.lineTo(cx-26,cy+6);P.lineTo(cx,cy+6);P.lineTo(cx-12,cy+50);P.lineTo(cx+28,cy-8);P.lineTo(cx+2,cy-8);P.closePath()}
    if(n==='diamond'){P.moveTo(cx,cy-48);P.lineTo(cx+40,cy);P.lineTo(cx,cy+48);P.lineTo(cx-40,cy);P.closePath();P.moveTo(cx-40,cy);P.lineTo(cx+40,cy)}
    if(n==='note'){P.moveTo(cx-10,cy+30);P.arc(cx-22,cy+30,12,0,7);P.moveTo(cx-10,cy+30);P.lineTo(cx-10,cy-40);P.lineTo(cx+30,cy-48);P.lineTo(cx+30,cy+20);P.moveTo(cx+30,cy+20);P.arc(cx+18,cy+20,12,0,7)}
    if(n==='eye'){P.moveTo(cx-50,cy);P.quadraticCurveTo(cx,cy-46,cx+50,cy);P.quadraticCurveTo(cx,cy+46,cx-50,cy);P.moveTo(cx+14,cy);P.arc(cx,cy,14,0,7)}
    if(n==='k'){P.arc(cx,cy,46,0,7);P.moveTo(cx-14,cy-28);P.lineTo(cx-14,cy+28);P.moveTo(cx+20,cy-28);P.lineTo(cx-12,cy);P.lineTo(cx+20,cy+28)}
    if(n==='arrow'){P.moveTo(cx-44,cy);P.lineTo(cx+40,cy);P.moveTo(cx+14,cy-26);P.lineTo(cx+42,cy);P.lineTo(cx+14,cy+26)}
    if(n==='tri'){P.moveTo(cx,cy-46);P.lineTo(cx+44,cy+34);P.lineTo(cx-44,cy+34);P.closePath();P.moveTo(cx,cy-14);P.lineTo(cx+18,cy+20);P.lineTo(cx-18,cy+20);P.closePath()}
    if(n==='spark'){P.moveTo(cx,cy-50);P.quadraticCurveTo(cx+6,cy-6,cx+50,cy);P.quadraticCurveTo(cx+6,cy+6,cx,cy+50);P.quadraticCurveTo(cx-6,cy+6,cx-50,cy);P.quadraticCurveTo(cx-6,cy-6,cx,cy-50)}
    if(n==='wave'){P.moveTo(cx-50,cy-14);for(let k=0;k<=20;k++)P.lineTo(cx-50+k*5,cy-14+Math.sin(k*.9)*12);P.moveTo(cx-50,cy+14);for(let k=0;k<=20;k++)P.lineTo(cx-50+k*5,cy+14+Math.sin(k*.9+1)*12)}
    if(n==='ko'){c.font=font(900,82);c.textAlign='center';c.textBaseline='middle';c.fillText('명',cx,cy+4);c.lineWidth=5;P.arc(cx,cy,52,0,7)}
    c.stroke(P);c.shadowBlur=4;c.strokeStyle='#fff';c.globalAlpha=.6;c.lineWidth=2.5;c.stroke(P);c.restore();
    AT.slots['i:'+n]=[x/2048,y/2048,(x+128)/2048,(y+128)/2048]});
  const V=['명동','화장품','노래방','약국','호텔','카페','안경','환전','뷰티','맛집','서울','스킨','패션','2030','미용실','게임'];
  V.forEach((t,i)=>{const x=i*128,y=1536;const col=COLS[(i*3)%COLS.length];c.save();c.beginPath();c.rect(x,y,128,512);c.clip();
    c.font=font(900,76);c.textAlign='center';c.textBaseline='middle';c.shadowColor=col;c.shadowBlur=24;c.fillStyle=col;
    const ch=[...t];const step=Math.min(110,440/ch.length);ch.forEach((k,j)=>{c.fillText(k,x+64,y+256+(j-(ch.length-1)/2)*step);c.fillText(k,x+64,y+256+(j-(ch.length-1)/2)*step)});
    c.shadowBlur=12;c.strokeStyle=col;c.lineWidth=3;c.strokeRect(x+8,y+10,112,492);c.restore();
    AT.slots['v:'+t]=[x/2048,y/2048,(x+128)/2048,(y+512)/2048]});
  W.signNames=H;W.vSigns=V;W.icons=IC;
})();
W.atlas=AT.cv;
const SHOPN=W.signNames.slice(2,39),ICONS=W.icons;

/* ---------------- builders ---------------- */
const mb=new MB();          // static opaque world
const gb=new MB();          // glass (blended, additive)
const dm=new MB();          // decals: flat overlays drawn with polygon offset (no z-fighting with their backing)
W.mb=mb;W.gb=gb;W.dm=dm;
const collide=(x0,z0,x1,z1,tag)=>W.colliders.push({x0:Math.min(x0,x1),z0:Math.min(z0,z1),x1:Math.max(x0,x1),z1:Math.max(z0,z1),tag});
const light=(p,c,r,k=1,tag)=>{const L={p,c:typeof c==='string'?hex(c):c,r,k,tag};W.lights.push(L);return L};
const NEON=['#ff4fd8','#b06bff','#5ee7ff','#ff7ab6','#8f7bff','#4fc3ff','#ff5fa2','#62f0ff'];
const bx=(a,b,col,mat,o)=>mb.box(Math.min(a[0],b[0]),Math.min(a[1],b[1]),Math.min(a[2],b[2]),Math.max(a[0],b[0]),Math.max(a[1],b[1]),Math.max(a[2],b[2]),col,mat,o);
const emLevel=()=>{const r=R();return r<.25?.7:r<.6?1.2:r<.88?2:3.1};          // brightness hierarchy
const flag=()=>{const r=R();return r<.08?1:r<.22?2:0};                          // 1 flicker · 2 pulse · 0 steady

/* sign on a wall. p = point ON the wall surface, n = outward normal.
   cabinet starts 6 cm inside the wall -> no coplanar face; the lit face is a decal 1 cm in front of the cabinet */
function sign(text,p,n,w,h,em=2.2,plate='#14121c',depth=.14,fl=0){
  const s=AT.slots[text];if(!s)return;const t=[n[2],0,-n[0]];const hw=w/2,hh=h/2;
  const ax=Math.abs(t[0])*(hw+.04)+Math.abs(n[0])*(depth+.06)/2,az=Math.abs(t[2])*(hw+.04)+Math.abs(n[2])*(depth+.06)/2,cx=p[0]+n[0]*(depth-.06)/2,cz=p[2]+n[2]*(depth-.06)/2;
  mb.box(cx-ax,p[1]-hh-.04,cz-az,cx+ax,p[1]+hh+.04,cz+az,hex('#100f16'),m(MAT.metal));
  const o=depth+.012;const P=(a,b)=>[p[0]+t[0]*a+n[0]*o,p[1]+b,p[2]+t[2]*a+n[2]*o];
  dm.quad(P(-hw,-hh),P(hw,-hh),P(hw,hh),P(-hw,hh),hex(plate),m(MAT.sign,em,R(),fl),[[s[0],s[3]],[s[2],s[3]],[s[2],s[1]],[s[0],s[1]]],n);
}
/* blade sign perpendicular to the facade (two faces), mounted on two brackets; t = direction it projects */
function vsign(text,p,t,w=.7,h=2.8,em=2.4,fl=0,key='v:'){
  const s=AT.slots[key+text];if(!s)return;const side=[-t[2],0,t[0]];const gap=.4;
  const a=[p[0]+t[0]*gap,p[1]-h/2,p[2]+t[2]*gap],b=[p[0]+t[0]*(gap+w),p[1]+h/2,p[2]+t[2]*(gap+w)];
  bx([Math.min(a[0],b[0])-Math.abs(side[0])*.06,a[1]-.04,Math.min(a[2],b[2])-Math.abs(side[2])*.06],[Math.max(a[0],b[0])+Math.abs(side[0])*.06,b[1]+.04,Math.max(a[2],b[2])+Math.abs(side[2])*.06],hex('#100f16'),m(MAT.metal));
  [-.38,.38].forEach(k=>{const y=p[1]+k*h;bx([p[0]-t[0]*.06-Math.abs(side[0])*.025,y-.025,p[2]-t[2]*.06-Math.abs(side[2])*.025],[p[0]+t[0]*(gap+.05)+Math.abs(side[0])*.025,y+.025,p[2]+t[2]*(gap+.05)+Math.abs(side[2])*.025],hex('#2a2933'),m(MAT.metal))});
  [1,-1].forEach(sg=>{const nn=side.map(x=>x*sg);const P=(u,v)=>[p[0]+t[0]*(gap+u*sg+(sg<0?w:0))+nn[0]*.072,p[1]+v,p[2]+t[2]*(gap+u*sg+(sg<0?w:0))+nn[2]*.072];
    dm.quad(P(0,-h/2),P(w,-h/2),P(w,h/2),P(0,h/2),hex('#16131f'),m(MAT.sign,em,R(),fl),[[s[0],s[3]],[s[2],s[3]],[s[2],s[1]],[s[0],s[1]]],nn)});
}
/* round neon logo projecting from a wall on an arm */
function logo(icon,p,t,r=.7,em=2.6,fl=0){const s=AT.slots['i:'+icon];if(!s)return;const side=[-t[2],0,t[0]];const c=[p[0]+t[0]*(.5+r),p[1],p[2]+t[2]*(.5+r)];
  mb.cyl([c[0]-side[0]*.05,c[1],c[2]-side[2]*.05],[c[0]+side[0]*.05,c[1],c[2]+side[2]*.05],r+.04,r+.04,24,hex('#0e0d14'),m(MAT.metal));
  bx([p[0]-t[0]*.06-Math.abs(side[0])*.03,c[1]-.03,p[2]-t[2]*.06-Math.abs(side[2])*.03],[c[0]-t[0]*r*.9+Math.abs(side[0])*.03,c[1]+.03,c[2]-t[2]*r*.9+Math.abs(side[2])*.03],hex('#2a2933'),m(MAT.metal));
  [1,-1].forEach(sg=>{const nn=side.map(x=>x*sg);const tt=t.map(x=>x*sg);const P=(u,v)=>[c[0]+tt[0]*u+nn[0]*.062,c[1]+v,c[2]+tt[2]*u+nn[2]*.062];
    dm.quad(P(-r,-r),P(r,-r),P(r,r),P(-r,r),hex('#0c0b12'),m(MAT.sign,em,R(),fl),[[s[0],s[3]],[s[2],s[3]],[s[2],s[1]],[s[0],s[1]]],nn)});
  light([c[0]+t[0]*.4,c[1]-.6,c[2]+t[2]*.4],'#c070ff',5,.45)}
/* hanging double-sided sign below a cantilever arm (pedestrian height ~3.6 m) */
function hangSign(text,p,t,w=1.5,h=.5,em=2,fl=0){const side=[-t[2],0,t[0]];const L=w+.6,y=4.5;
  bx([p[0]-t[0]*.06-Math.abs(side[0])*.03,y-.035,p[2]-t[2]*.06-Math.abs(side[2])*.03],[p[0]+t[0]*L+Math.abs(side[0])*.03,y+.035,p[2]+t[2]*L+Math.abs(side[2])*.03],hex('#25232c'),m(MAT.metal));
  mb.cyl([p[0]+t[0]*.05,y+.6,p[2]+t[2]*.05],[p[0]+t[0]*(L-.1),y+.03,p[2]+t[2]*(L-.1)],.012,.012,4,hex('#25232c'),m(MAT.metal),false);
  const c=[p[0]+t[0]*(.35+w/2),y-.45-h/2,p[2]+t[2]*(.35+w/2)];
  [-w*.38,w*.38].forEach(u=>mb.cyl([c[0]+t[0]*u,y,c[2]+t[2]*u],[c[0]+t[0]*u,c[1]+h/2,c[2]+t[2]*u],.008,.008,4,hex('#55525e'),m(MAT.metal),false));
  const s=AT.slots[text];if(!s)return;
  bx([c[0]-Math.abs(t[0])*w/2-Math.abs(side[0])*.04,c[1]-h/2,c[2]-Math.abs(t[2])*w/2-Math.abs(side[2])*.04],[c[0]+Math.abs(t[0])*w/2+Math.abs(side[0])*.04,c[1]+h/2,c[2]+Math.abs(t[2])*w/2+Math.abs(side[2])*.04],hex('#121019'),m(MAT.metal));
  [1,-1].forEach(sg=>{const nn=side.map(x=>x*sg),tt=t.map(x=>x*sg);const P=(u,v)=>[c[0]+tt[0]*u+nn[0]*.052,c[1]+v,c[2]+tt[2]*u+nn[2]*.052];
    dm.quad(P(-w/2,-h/2),P(w/2,-h/2),P(w/2,h/2),P(-w/2,h/2),hex('#16131f'),m(MAT.sign,em,R(),fl),[[s[0],s[3]],[s[2],s[3]],[s[2],s[1]],[s[0],s[1]]],nn)})}
/* transparent illuminated panel (acrylic) on stand-off rods */
function glassPanel(p,n,w,h,col){const t=[n[2],0,-n[0]],d=.35;const P=(u,v)=>[p[0]+t[0]*u+n[0]*d,p[1]+v,p[2]+t[2]*u+n[2]*d];
  gb.quad(P(-w/2,-h/2),P(w/2,-h/2),P(w/2,h/2),P(-w/2,h/2),hex(col).map(v=>v*.55),m(0),undefined,n);
  [[-w/2,-h/2,w/2,-h/2+.03],[-w/2,h/2-.03,w/2,h/2],[-w/2,-h/2,-w/2+.03,h/2],[w/2-.03,-h/2,w/2,h/2]].forEach(([a,b2,c2,d2])=>{const A=P(a,b2),B=P(c2,d2);bx([A[0]-n[0]*.01,A[1],A[2]-n[2]*.01],[B[0]+n[0]*.01,B[1],B[2]+n[2]*.01],hex(col),m(MAT.emis,2.4))});
  [[-w*.4,h*.35],[w*.4,h*.35],[-w*.4,-h*.35],[w*.4,-h*.35]].forEach(([u,v])=>{const A=P(u,v);mb.cyl([A[0]-n[0]*(d+.05),A[1],A[2]-n[2]*(d+.05)],A,.012,.012,5,hex('#9a98a6'),m(MAT.metal),false)});
  light(P(0,0).map((x,i)=>x+n[i]*.6),col,5,.5)}
function wire(a,b,sag,r=.012,col='#08070c'){const N=12,pts=[];for(let i=0;i<=N;i++){const t=i/N;pts.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t-sag*4*t*(1-t),a[2]+(b[2]-a[2])*t])}
  for(let i=0;i<N;i++)mb.cyl(pts[i],pts[i+1],r,r,4,hex(col),m(0),false);return pts}
function bracket(p,n){const a=[p[0]-n[0]*.05,p[2]-n[2]*.05],b=[p[0]+n[0]*.14,p[2]+n[2]*.14],ex=n[0]?0:.04,ez=n[2]?0:.04;bx([Math.min(a[0],b[0])-ex,p[1]-.05,Math.min(a[1],b[1])-ez],[Math.max(a[0],b[0])+ex,p[1]+.05,Math.max(a[1],b[1])+ez],hex('#2b2a32'),m(MAT.metal))}

/* ---------------- ground ---------------- */
W.walk=[];
function floor(x0,z0,x1,z1,kind,c='#3e3c4a',y=0,walk=true){if(walk)W.walk.push([Math.min(x0,x1),Math.min(z0,z1),Math.max(x0,x1),Math.max(z0,z1)]);mb.quad([x0,y,z1],[x1,y,z1],[x1,y,z0],[x0,y,z0],hex(c),m(MAT.ground,0,kind,0),[[0,0],[1,0],[1,1],[0,1]],[0,1,0])}
const SW='#3c3a47',PR='#24222c';
// main street south (z -24..56) — sidewalks + central promenade with the stair opening
floor(-HW,-24,-PROM,56,0,SW);floor(PROM,-24,HW,56,0,SW);
floor(-PROM,-24,-1.75,56,1,PR);floor(1.75,-24,PROM,56,1,PR);floor(-1.75,0,1.75,56,1,PR);floor(-1.75,-24,1.75,-9.85,1,PR);
// main street north (z 68..110)
floor(-HW,68,-PROM,110,0,SW);floor(PROM,68,HW,110,0,SW);floor(-PROM,68,PROM,110,1,PR);
// food alley + lane
floor(-36,21,-HW,31,0,'#433d48');floor(-36,31,-30,56,0,SW);
// cross street: sidewalks + road
floor(-64,56,64,58.5,0,SW);floor(-64,65.5,64,68,0,SW);floor(-64,58.5,64,65.5,1,'#1d1c25');
[[58.5],[65.5]].forEach(([z])=>mb.box(-64,0,z-.08,64,.12,z+.08,hex('#8a8796'),m(MAT.metal),{skip:'d'}));
// road markings (decals)
for(let x=-62;x<62;x+=4)dm.quad([x,.008,62.1],[x+2.2,.008,62.1],[x+2.2,.008,61.9],[x,.008,61.9],hex('#d8c070'),m(MAT.ground,0,1,0));
function zebra(xc,w){for(let z=58.9;z<65.2;z+=.9)dm.quad([xc-w/2,.008,z+.5],[xc+w/2,.008,z+.5],[xc+w/2,.008,z],[xc-w/2,.008,z],hex('#d9d6e2'),m(MAT.ground,0,1,0))}
zebra(0,13);zebra(-33,4.5);
[[-7.4],[7.4]].forEach(([x])=>dm.quad([x-.15,.008,65.4],[x+.15,.008,65.4],[x+.15,.008,58.6],[x-.15,.008,58.6],hex('#d9d6e2'),m(MAT.ground,0,1,0)));
// promenade LED edges (reference: glowing lines along the walkway)
[-PROM,PROM].forEach(x=>{bx([x-.05,-.05,-20],[x+.05,.03,55.8],hex('#4f7bff'),m(MAT.emis,2.2));bx([x-.05,-.05,68.2],[x+.05,.03,108],hex('#9d5cff'),m(MAT.emis,2.2))});

/* ---------------- subway exit (stairs) ---------------- */
(function stairs(){
  const N=22,rise=.18,run=.3,top=0,zTop=0,zBot=zTop-N*run,yBot=-N*rise;W.stair={N,rise,run,zTop,zBot,yBot,hw:1.5};
  for(let i=0;i<N;i++){const y1=yBot+(i+1)*rise,z0=zBot+i*run,z1=z0+run;
    mb.box(-1.5,yBot-.2,z0,1.5,y1,z1,hex('#3c3a40'),m(MAT.step),{skip:'bd'});
    mb.box(-1.5,y1-.02,z0-.005,1.5,y1+.004,z0+.05,hex(i===N-1?'#c9a63a':'#5d5a60'),m(i===N-1?0:MAT.metal));
    dm.quad([-1.45,y1-.04,z0-.012],[1.45,y1-.04,z0-.012],[1.45,y1-.025,z0-.012],[-1.45,y1-.025,z0-.012],hex('#d8d0ff'),m(MAT.emis,.6+2.2*i/N),undefined,[0,0,-1])}
  mb.box(-1.5,yBot-.3,-9.6,1.5,yBot,zBot,hex('#3a383e'),m(MAT.step),{skip:'d'});
  mb.box(-1.6,yBot,-9.85,1.6,1.1,-9.6,hex('#d8d4cc'),m(MAT.tile,0,yBot+.9,0),{facade:true,skip:'b'});
  const cy=yBot+2.75;W.stair.ceil=cy;
  mb.box(-1.75,cy,-9.85,1.75,.02,-6.3,hex('#1a1922'),m(0),{skip:'d'});
  dm.quad([-1.5,cy-.004,-9.6],[1.5,cy-.004,-9.6],[1.5,cy-.004,-6.3],[-1.5,cy-.004,-6.3],hex('#c9c4bd'),m(MAT.tile,0,cy-1,0),[[0,0],[3,0],[3,3.3],[0,3.3]],[0,-1,0]);
  mb.box(-.06,cy-.05,-9.5,.06,cy+.01,-6.5,hex('#e8e0ff'),m(MAT.emis,2.2),{skip:'t'});
  mb.box(-1.75,cy-.32,-6.42,1.75,cy+.01,-6.3,hex('#15141b'),m(MAT.metal));
  sign('EXIT 6',[-.75,cy-.16,-6.3],[0,0,1],.7,.2,3.2,'#0f1a2e',.02);sign('명동길',[.55,cy-.16,-6.3],[0,0,1],1.0,.22,2.6,'#0f1a2e',.02);
  light([0,cy-.4,-8.2],'#c9c0ff',5,.9,'stairs');
  light([0,1.4,-.4],'#9d5cff',8,2.0,'stairs');light([0,-1.6,-3.4],'#5a6cff',5,.8,'stairs');light([0,3.5,4],'#c07aff',9,1.2,'stairs');
  [-1,1].forEach(sd=>{const x=sd*1.49;for(let i=0;i<N;i++){const y=yBot+(i+1)*rise+.12,z0=zBot+i*run;
    dm.quad([x-sd*.012,y,z0],[x-sd*.012,y,z0+run],[x-sd*.012,y+.025,z0+run],[x-sd*.012,y+.025,z0],hex(i>N*.6?'#b48cff':'#7a6cff'),m(MAT.emis,1.2+i/N*2.2),undefined,[-sd,0,0])}});
  [-1,1].forEach(s=>{const xi=s*1.5,xo=s*1.75;
    mb.box(Math.min(xi,xo),yBot,-9.85,Math.max(xi,xo),.95,0,hex('#e2ddd3'),m(MAT.tile,0,yBot+.9,0),{facade:true});
    mb.box(Math.min(xi,xo)-.02,.95,-9.87,Math.max(xi,xo)+.02,1.05,.02,hex('#9b98a2'),m(MAT.metal));
    collide(Math.min(xi,xo),-9.85,Math.max(xi,xo),0,'stairwall');
    for(let z=-9.6;z<=0;z+=.8)mb.cyl([s*1.62,1.05,z],[s*1.62,1.95,z],.025,.025,6,hex('#2f6b55'),m(MAT.metal),false);
    mb.cyl([s*1.62,1.95,-9.75],[s*1.62,1.95,.02],.035,.035,8,hex('#2f6b55'),m(MAT.metal));
    const hx=s*1.38;mb.cyl([hx,yBot+.95,zBot-1.2],[hx,yBot+.95,zBot],.028,.028,8,hex('#c8cbd2'),m(MAT.metal));
    mb.cyl([hx,yBot+.95,zBot],[hx,top+.95,zTop],.028,.028,8,hex('#c8cbd2'),m(MAT.metal));
    for(let i=0;i<=4;i++){const t=i/4,z=zBot+(zTop-zBot)*t,y=yBot+(top-yBot)*t;mb.cyl([s*1.47,y+.95,z],[hx,y+.95,z],.016,.016,6,hex('#c8cbd2'),m(MAT.metal),false)}
  });
  mb.box(-1.75,.95,-9.85,1.75,1.05,-9.6,hex('#9b98a2'),m(MAT.metal));collide(-1.75,-9.85,1.75,-9.6,'stairwall');
  mb.box(1.85,0,-.9,2.15,3.3,-.6,hex('#22202a'),m(MAT.metal));sign('명동역 MYEONGDONG STN.',[2.0,2.75,-.6],[0,0,1],1.6,.4,2.6,'#1b1830',.03);
  sign('EXIT 6',[2.0,2.25,-.6],[0,0,1],.8,.2,3,'#14121c',.03);collide(1.85,-.9,2.15,-.6,'pylon');
  W.exitTop=[0,0,.6];
})();

/* ---------------- buildings ---------------- */
const FAC=['#2a2736','#302b3d','#252837','#383144','#2b3140','#342e40','#272338','#3c354b','#21202c','#332738','#2a303e','#3f3849','#463e4e','#2d3743'];
W.screens=[];W.faces=[];
const FL=3.3,CW=2.3,Y0=4.3,GF=4.4;
/* face helper: u along the face exactly like the facade shader's UVs, d = distance out of the wall */
function faceOf(b,f){const{x0,z0,x1,z1}=b;
  if(f==='+x')return{n:[1,0,0],len:z1-z0,at:(u,y,d=0)=>[x1+d,y,z1-u]};
  if(f==='-x')return{n:[-1,0,0],len:z1-z0,at:(u,y,d=0)=>[x0-d,y,z0+u]};
  if(f==='+z')return{n:[0,0,1],len:x1-x0,at:(u,y,d=0)=>[x0+u,y,z1+d]};
  return{n:[0,0,-1],len:x1-x0,at:(u,y,d=0)=>[x1-u,y,z0-d]}}
const fbox=(F,u0,y0,d0,u1,y1,d1,col,mat,o)=>bx(F.at(u0,y0,d0),F.at(u1,y1,d1),col,mat,o);
const faceQuad=(F,y0,y1,c,mat)=>mb.quad(F.at(0,y0),F.at(F.len,y0),F.at(F.len,y1),F.at(0,y1),c,mat,[[0,y0],[F.len,y0],[F.len,y1],[0,y1]],F.n);
const E=.03; // frames/beams stop 3 cm short of the building corners so their end caps never lie in a side-wall plane

function storefront(F,c,o={}){
  const len=F.len,RS=.75;const bays=Math.max(1,Math.round((len-.6)/3.4));const bw=(len-.6)/bays;
  // shop glass (interior-mapped) recessed RS behind the building line
  const tint=Math.floor(R()*4);
  const g0=.3,g1=len-.3;const P=(u,y)=>F.at(u,y,-RS);
  mb.quad(P(g0,.02),P(g1,.02),P(g1,3.7),P(g0,3.7),hex('#ffffff'),m(MAT.shop,.8+R()*.7,tint,R()*9),[[g0,0],[g1,0],[g1,3.68],[g0,3.68]],F.n);
  // recess floor + soffit lights
  fbox(F,E,-.02,-RS-.02,len-E,.012,.02,hex('#2c2a33'),m(MAT.ground,0,2,0),{skip:'d'});
  for(let k=0;k<bays;k++){const u=.3+bw*(k+.5);fbox(F,u-.6,3.84,-RS+.15,u+.6,3.88,-RS+.3,hex('#fff3e6'),m(MAT.emis,2.4))}
  // pilasters / columns (start inside the wall, protrude 12 cm)
  for(let k=0;k<=bays;k++){const u=.3+bw*k;fbox(F,u-.24,0,-RS-.1,u+.24,GF,.12,c.map(v=>v*.82),m(MAT.clad,0,R(),0));
    if(R()<.35)fbox(F,u-.03,.6,.11,u+.03,3.4,.135,hex(pick(NEON)),m(MAT.emis,2.2));                 // LED inlay
    else if(R()<.4&&k>0&&k<bays){const pp=F.at(u,2.0,.125);sign('v:'+pick(W.vSigns),pp,F.n,.3,1.2,.9,'#1b1924',.01)}} // poster
  // fascia beam (sign band) — embedded into the upper mass
  fbox(F,E,3.9,-RS-.1,len-E,GF+.25,.16,hex('#17161d'),m(MAT.metal));
  sign(o.sign||pick(SHOPN),F.at(len/2,4.15,.16),F.n,Math.min(len-1.2,5.2),.48,emLevel()+.6,'#100f16',.08,flag());
  // mullions + door frame on the glass
  for(let k=0;k<=bays;k++){const u=.3+bw*k;fbox(F,u-.04,0,-RS-.05,u+.04,3.8,-RS+.06,hex('#1c1b22'),m(MAT.metal))}
  fbox(F,.3,1.05,-RS-.05,len-.3,1.1,-RS+.05,hex('#1c1b22'),m(MAT.metal));
  // illuminated display vitrine in some bays (inside the recess)
  for(let k=0;k<bays;k++)if(R()<.4){const u=.3+bw*(k+.5);
    fbox(F,u-.55,0,-RS+.08,u+.55,.75,-RS+.55,hex('#16151c'),m(MAT.metal));fbox(F,u-.5,.75,-RS+.12,u+.5,.78,-RS+.5,hex(pick(['#fff1e0','#e6dcff','#d8f6ff'])),m(MAT.emis,2.6));
    const A=F.at(u-.5,.78,-RS+.12),B=F.at(u+.5,1.35,-RS+.5);gb.box(Math.min(A[0],B[0]),.78,Math.min(A[2],B[2]),Math.max(A[0],B[0]),1.35,Math.max(A[2],B[2]),hex('#5a6080'),m(0),{skip:'d'})}
  // canopy over the entrance on some shops
  if(R()<.45){const u0=.3+bw*Math.floor(R()*bays),u1=u0+bw;fbox(F,u0,3.55,-.1,u1,3.68,1.35,hex(pick(['#22202b','#352a45','#1f2c36'])),m(MAT.metal));
    fbox(F,u0+.05,3.52,1.2,u1-.05,3.57,1.32,hex(pick(NEON)),m(MAT.emis,2))}
  light(F.at(len/2,2.6,1.4),pick(['#ffd2b0','#d7c6ff','#bfe3ff','#ffc1e0','#c9b8ff']),7,.95);
}

function frames(F,h,style,c){ // real window frames on the 2.3 x 3.3 grid of the facade shader
  const len=F.len,nf=Math.floor((h-GF)/FL+.001);const metal=c.map(v=>v*1.1);
  if(style==='grid'||style==='ribbon'){
    const lo=style==='grid'?.46:.75,hi=style==='grid'?.66:.95,dep=style==='grid'?.24:.18;
    fbox(F,E,GF,-.08,len-E,Y0+hi,dep,c,m(0));
    for(let k=1;k<=nf;k++){const y=Y0+k*FL;if(y+hi>h-.2){fbox(F,E,y-lo,-.08,len-E,h-.02,dep,c,m(0));break}fbox(F,E,y-lo,-.08,len-E,y+hi,dep,c,m(0))}
    for(let u=0;u<=len+.01;u+=CW){const w=style==='grid'?.16:.05;fbox(F,Math.max(E,u-w),GF,-.08,Math.min(len-E,u+w),h-.02,style==='grid'?dep+.08:dep*.6,style==='grid'?c.map(v=>v*.9):metal,m(style==='grid'?0:MAT.metal))}
  }else if(style==='curtain'){
    for(let k=0;k<=nf;k++){const y=Y0+k*FL;if(y>h-.1)break;fbox(F,E,Math.max(GF,y-.06),-.06,len-E,y+.08,.12,metal,m(MAT.metal))}
    for(let u=0;u<=len+.01;u+=CW/2)fbox(F,Math.max(E,u-.035),GF,-.06,Math.min(len-E,u+.035),h-.02,.13,metal,m(MAT.metal));
    if(R()<.7){const col=hex(pick(NEON));[.09,len-.09].forEach(u=>fbox(F,u-.05,GF,-.04,u+.05,h-.02,.16,col,m(MAT.emis,2.4)))}
  }else{ // 'clad' : metal panels with narrow window slots
    for(let u=0;u<=len+.01;u+=CW){fbox(F,Math.max(E,u-.62),GF,-.08,Math.min(len-E,u+.62),h-.02,.2,c.map(v=>v*1.25),m(MAT.clad,0,R(),0),{facade:true})}
    for(let k=0;k<=nf;k++){const y=Y0+k*FL;if(y>h-.3)break;fbox(F,E,Math.max(GF,y-.5),-.08,len-E,Math.min(h-.02,y+.7),.2,c.map(v=>v*1.2),m(MAT.clad,0,R(),0),{facade:true})}
    if(R()<.6){const col=hex(pick(NEON));for(let u=CW;u<len-.5;u+=CW*2)fbox(F,u-.02,GF+.2,.2,u+.02,h-.4,.24,col,m(MAT.emis,2.6))}
  }
}

function building(o){
  const {x0,z0,x1,z1}=o;let h=o.h;const c=hex(o.col||pick(FAC)),sd=R()*50,lit=.25+R()*.45;
  const faces=o.faces||[o.face];const style=o.style||(h>34?pick(['curtain','clad','curtain','grid']):pick(['grid','grid','ribbon','clad']));
  const geo=1;
  // mass above the ground floor + ground-floor box set back on street faces (recessed storefronts)
  const sk=faces.map(f=>({'+x':'r','-x':'l','+z':'f','-z':'b'})[f]).join('');
  mb.box(x0,GF,z0,x1,h,z1,c,m(MAT.facade,0,sd,lit),{facade:true,skip:sk});       // side/back faces: shader-drawn frames
  faces.forEach(f=>faceQuad(faceOf(o,f),GF,h,c,m(MAT.facade,geo,sd,lit)));          // street faces: glazing behind real frames
  const RS=o.noShop?0:.75;const g={x0,z0,x1,z1};faces.forEach(f=>{if(f==='+x')g.x1-=RS;if(f==='-x')g.x0+=RS;if(f==='+z')g.z1-=RS;if(f==='-z')g.z0+=RS});
  const skip='td'+faces.map(f=>({'+x':'r','-x':'l','+z':'f','-z':'b'})[f]).join('');
  mb.box(g.x0,0,g.z0,g.x1,GF,g.z1,c.map(v=>v*.7),m(MAT.facade,0,sd,0),{facade:true,skip:o.noShop?'td':skip});
  const cc={x0,z0,x1,z1};faces.forEach(f=>{if(f==='+x')cc.x1+=.13;if(f==='-x')cc.x0-=.13;if(f==='+z')cc.z1+=.13;if(f==='-z')cc.z0-=.13});
  collide(cc.x0,cc.z0,cc.x1,cc.z1,'bld');
  faces.forEach((f,fi)=>{const F=faceOf(o,f);const len=F.len;const prim=fi===0;
    if(!o.noShop)storefront(F,c,{sign:prim?o.sign:null});
    frames(F,h,style,c);
    const nf=Math.floor((h-GF)/FL);
    // balconies (grid / ribbon styles)
    if(style!=='curtain')for(let k=1;k<nf;k++)if(R()<.18){const y=Y0+k*FL-.46,u0=Math.floor(R()*Math.max(1,Math.floor(len/CW)-1))*CW+.2,u1=Math.min(len-.2,u0+CW*(1+Math.floor(R()*2)));
      fbox(F,u0,y-.02,-.05,u1,y+.12,1.1,c.map(v=>v*.75),m(0));
      const A=F.at(u0,y+.12,1.05),B=F.at(u1,y+1.05,1.1);gb.box(Math.min(A[0],B[0]),y+.12,Math.min(A[2],B[2]),Math.max(A[0],B[0]),y+1.05,Math.max(A[2],B[2]),hex('#3c4466'),m(0));
      fbox(F,u0,y+1.05,1.03,u1,y+1.1,1.12,hex('#a9a7b3'),m(MAT.metal));
      if(R()<.5){const u=u0+.3+R()*(u1-u0-1);fbox(F,u,y+.12,.15,u+.8,y+.72,.6,hex('#b9b6c2'),m(0));fbox(F,u+.1,y+.2,.6,u+.7,y+.64,.62,hex('#2a2933'),m(MAT.metal))}}
    // AC units on the spandrels + pipes, vent grilles, junction boxes
    for(let k=0;k<nf;k++)if(R()<.28){const y=Y0+k*FL+2.9,u=.4+R()*(len-1.4);fbox(F,u,y,.1,u+.85,y+.6,.62,hex('#b8b5c0'),m(0));fbox(F,u+.08,y+.08,.6,u+.77,y+.52,.63,hex('#2a2933'),m(MAT.metal))}
    if(R()<.7){const u=R()<.5?.3:len-.3;const a=F.at(u,0,.32);mb.cyl([a[0],.2,a[2]],[a[0],h-.4,a[2]],.065,.065,8,hex('#2a2a31'),m(MAT.metal),false);
      for(let y=2;y<h-1;y+=3.3)bracket(F.at(u,y,0),F.n)}
    if(R()<.5){const u=.6+R()*(len-1.5),y=Y0+Math.floor(R()*Math.max(1,nf))*FL+3.0;fbox(F,u,y,.15,u+1.0,y+.4,.3,hex('#1b1a20'),m(MAT.clad,0,R(),0))}
    // ---- signage: dense, layered, different heights and depths ----
    const nB=prim?1+(R()<.75?1:0)+(h>22&&R()<.6?1:0):(R()<.6?1:0);
    for(let k=0;k<nB;k++){const u=k%2===0?.5+R()*.8:len-.5-R()*.8,hh=2.4+R()*(h>20?5.5:2.6),y=Math.min(h-hh/2-.6,GF+.8+hh/2+R()*Math.max(0,h-GF-hh-2)*.7);
      const p=F.at(u,y,0);const fl=flag(),em=emLevel()+.4;vsign(pick(W.vSigns),p,F.n,.7+R()*.35,hh,em,fl);if(em>1.5)light(F.at(u,y,1.6),pick(NEON),7,.7)}
    for(let k=0;k<Math.min(4,nf);k++){if(R()<.35)continue;const y=Y0+k*FL+1.7,w=Math.min(len-1.6,2.2+R()*4.5),u=.8+w/2+R()*Math.max(0,len-1.6-w);
      sign(pick(SHOPN),F.at(u,y,style==='grid'?.24:.2),F.n,w,.6+R()*.4,emLevel(),'#100f16',.12,flag())}
    if(R()<.55)hangSign(pick(SHOPN),F.at(.3+R()*.4,0,.12),F.n.map(x=>x),1.2+R()*.6,.42,emLevel()+.3,flag());
    if(R()<.4){const y=GF+3+R()*Math.max(1,h-GF-6);logo(pick(ICONS),F.at(len-.6,y,0),F.n,.55+R()*.4,emLevel()+.5,flag())}
    if(R()<.25&&h>12){const y=GF+4+R()*Math.max(1,h-GF-9);glassPanel(F.at(len/2,y,0),F.n,Math.min(len-2,3+R()*2),1.4+R()*.8,pick(NEON))}
    // big LED screen or rooftop sign on tall faces
    if(prim&&h>18&&R()<.55){const sw=Math.min(len-2,5+R()*5),sh=sw*(.5+R()*.3),y=Math.min(h-sh/2-1.2,9+R()*(h-15)),u=len/2;
      fbox(F,u-sw/2-.15,y-sh/2-.15,-.08,u+sw/2+.15,y+sh/2+.15,.4,hex('#0b0a10'),m(MAT.metal));
      W.screens.push({p:F.at(u,y,.412),n:F.n,w:sw,h:sh,seed:R()});light(F.at(u,y,3.5),pick(NEON),13,1.0)}
    else if(prim&&h>14&&R()<.6){const y=h-2.4;sign(pick(SHOPN),F.at(len/2,y,.24),F.n,Math.min(len-2,7.5),1.4,emLevel()+.5,'#100f16',.18,flag());light(F.at(len/2,y,2.4),pick(NEON),10,.7)}
    W.faces.push({f,b:o,h});
  });
  // ---- roofscape: parapet, setback crown, plant, tanks, antennas, billboard frames ----
  mb.box(x0,h,z0,x1,h+.7,z0+.3,c.map(v=>v*.8),m(0),{skip:'d'});mb.box(x0,h,z1-.3,x1,h+.7,z1,c.map(v=>v*.8),m(0),{skip:'d'});
  mb.box(x0,h,z0+.3,x0+.3,h+.7,z1-.3,c.map(v=>v*.8),m(0),{skip:'d'});mb.box(x1-.3,h,z0+.3,x1,h+.7,z1-.3,c.map(v=>v*.8),m(0),{skip:'d'});
  let top=h;
  if(h>20&&R()<.6){const ix=(x1-x0)*(.15+R()*.12),iz=(z1-z0)*(.15+R()*.12),th=5+R()*16;
    mb.box(x0+ix,h-.05,z0+iz,x1-ix,h+th,z1-iz,c.map(v=>v*.92),m(MAT.facade,0,sd+3,lit),{facade:true,skip:'d'});top=h+th;
    if(R()<.7)mb.box(x0+ix-.12,h+th-1.3,z0+iz-.12,x1-ix+.12,h+th-1.0,z1-iz+.12,hex(pick(NEON)),m(MAT.emis,2.4));
    if(R()<.5){const ax=(x0+x1)/2,az=(z0+z1)/2;mb.cyl([ax,top,az],[ax,top+6+R()*10,az],.08,.03,6,hex('#55525e'),m(MAT.metal));mb.sphere([ax,top+6.2,az],[.15,.15,.15],6,hex('#ff3a6a'),m(MAT.emis,7))}}
  for(let k=0;k<2+Math.floor(R()*3);k++){const rx=x0+.8+R()*(x1-x0-3),rz=z0+.8+R()*(z1-z0-3);mb.box(rx,h-.05,rz,rx+1+R()*1.6,h+1+R()*1.2,rz+1+R()*1.6,hex('#3e3c48'),m(MAT.metal))}
  if(R()<.45){const rx=x0+1.5+R()*(x1-x0-3),rz=z0+1.5+R()*(z1-z0-3);mb.cyl([rx,h-.05,rz],[rx,h+2.6,rz],1.1,1.1,12,hex('#4a4655'),m(MAT.metal));
    [[-.8,-.8],[.8,-.8],[-.8,.8],[.8,.8]].forEach(([a,b])=>mb.cyl([rx+a,h-.05,rz+b],[rx+a,h+.2,rz+b],.06,.06,4,hex('#2a2933'),m(MAT.metal),false))}
  if(R()<.35&&o.face){const F=faceOf(o,o.face);const w=Math.min(F.len-1,6+R()*4),hh=2.2+R()*1.2,y=h+1.2+hh/2;   // rooftop billboard on a truss
    const p=F.at(F.len/2,y,-1.5);sign(pick(SHOPN),p,F.n,w,hh,emLevel()+.6,'#0e0d14',.2,flag());
    for(let u=-w/2+.3;u<=w/2;u+=w/3){const a=F.at(F.len/2+u,h,-1.6),b=F.at(F.len/2+u,y,-1.6);mb.cyl(a,b,.05,.05,5,hex('#2a2933'),m(MAT.metal),false);mb.cyl(F.at(F.len/2+u,h,-3),b,.035,.035,4,hex('#2a2933'),m(MAT.metal),false)}
    light(F.at(F.len/2,y,3),pick(NEON),14,.9)}
  if(R()<.3)for(let k=0;k<2;k++){const ax=x0+1+R()*(x1-x0-2),az=z0+1+R()*(z1-z0-2);mb.cyl([ax,h,az],[ax,h+3+R()*5,az],.04,.015,5,hex('#6a6774'),m(MAT.metal),false)}
}
function row(face,a0,a1,line,depth,opts={}){
  let u=a0;while(u<a1-.5){let w=Math.min(a1-u,opts.w?opts.w():(5+R()*10));if(a1-(u+w)<4.5)w=a1-u;
    const r=R();const h=opts.h?opts.h():(r<.3?12+R()*8:r<.75?20+R()*16:38+R()*34);
    let b;if(face==='+x')b={x0:line-depth,z0:u,x1:line,z1:u+w};if(face==='-x')b={x0:line,z0:u,x1:line+depth,z1:u+w};
    if(face==='+z')b={x0:u,z0:line-depth,x1:u+w,z1:line};if(face==='-z')b={x0:u,z0:line,x1:u+w,z1:line+depth};
    const faces=[face];if(opts.corner0&&u===a0)faces.push(opts.corner0);if(opts.corner1&&u+w>=a1-.01)faces.push(opts.corner1);
    building(Object.assign(b,{h,face,faces},opts.o||{}));u+=w}}
// ---- lot plan (non-overlapping footprints) ----
row('+x',-24,21,-HW,14,{corner1:'+z'});                     // main west, south of the alley (last lot also faces the alley)
row('+x',31,56,-HW,14,{corner0:'-z',corner1:'+z'});         // main west between alley and cross street
row('+x',68,110,-HW,14,{corner0:'-z'});                     // main west, north of the cross street
row('-x',-24,34,HW,14);                                     // main east, south of Olive Young
row('-x',68,110,HW,14,{corner0:'-z'});                      // main east, north
row('+z',-36,-23,21,12,{h:()=>10+R()*16});                  // alley south side
row('-z',-30,-23,31,10,{h:()=>10+R()*14});                  // alley north side
building({x0:-42,z0:21,x1:-36,z1:31,h:16,face:'+x',faces:['+x'],sign:'라멘 야타이'});   // alley west end
row('+x',31,42,-36,14,{h:()=>10+R()*12});                   // lane west
building({x0:-30,z0:41,x1:-23,z1:56,h:18,face:'-x',faces:['-x','+z']});                    // lane east / cross-street corner
row('+z',-64,-36,56,14,{corner1:null});                     // cross street, south-west
row('+z',25,64,56,14);                                      // cross street, south-east
row('-z',-64,-23,68,16);                                    // cross street, north-west
row('-z',23,64,68,16);                                      // cross street, north-east
building({x0:-HW,z0:110,x1:HW,z1:124,h:46,face:'-z',faces:['-z'],sign:'MYEONGDONG',col:'#3f3a52',style:'curtain'});
building({x0:-HW,z0:-36,x1:HW,z1:-24,h:30,face:'+z',faces:['+z'],col:'#3a354a'});
building({x0:HW,z0:54,x1:25,z1:56,h:24,face:'-x',faces:['-x','+z'],noShop:true});          // slim filler beside Olive Young
// back-fill blocks (never reached; 0.4 m gaps so no face is shared with a frontage)
[[-60,-24,-23.4,8.6],[-60,9,-36.4,20.6],[-60,21,-42.4,30.6],[-60,31,-50.4,41.6],[-60,84.4,-23.4,124],[23.4,-24,60,33.6],[25.4,34,60,41.6],[23.4,84.4,60,124],
 [-60,-50,-9.4,-24.4],[9.4,-50,60,-24.4],[-9,-50,9,-36.4],[-9,124.4,9,140]].forEach(([a,b,c2,d])=>{const h=14+R()*30;
  mb.box(a,0,b,c2,h,d,hex(pick(['#2f2d3c','#37344a','#2b2a38'])),m(MAT.facade,0,R()*9,.3),{facade:true,skip:'d'});
  if(R()<.5)mb.box(a-.1,h-1.6,b-.1,c2+.1,h-1.3,d+.1,hex(pick(NEON)),m(MAT.emis,2))});
collide(-64,-24,-58,124,'edge');collide(58,-24,64,124,'edge');collide(-64,-26,64,-24,'edge');collide(-64,124,64,126,'edge');

/* ---------------- Olive Young (x 9..25, z 34..54) — product 02 sits INSIDE, behind the street glass ---------------- */
(function oliveYoung(){
  const x0=HW,x1=25,z0=34,z1=54,H=4.4,door=[42,45];W.oy={x0:x0+.3,x1:x1-.3,z0:z0+.3,z1:z1-.3,door};
  const wall=hex('#d9d6d2');
  mb.box(x0,H,z0,x1,19,z1,hex('#8a8f8a'),m(MAT.facade,1,77,.75),{facade:true});
  frames(faceOf({x0,z0,x1,z1},'-x'),19,'curtain',hex('#9aa09a'));
  const t=.25;
  mb.box(x1-t,0,z0,x1,H,z1,wall,m(0),{skip:'t'});collide(x1-t,z0,x1,z1,'oy');
  mb.box(x0,0,z0,x1-t,H,z0+t,wall,m(0),{skip:'t'});collide(x0,z0,x1,z0+t,'oy');mb.box(x0,0,z1-t,x1-t,H,z1,wall,m(0),{skip:'t'});collide(x0,z1-t,x1,z1,'oy');
  [[z0+t,door[0]],[door[1],z1-t]].forEach(([a,b])=>{collide(x0-.05,a,x0+.12,b,'oyglass');
    for(let z=a;z<=b+.01;z+=(b-a)/Math.max(1,Math.round((b-a)/2.2)))mb.box(x0-.06,0,z-.05,x0+.06,H,z+.05,hex('#d9dcd6'),m(MAT.metal));
    gb.quad([x0,0,b],[x0,0,a],[x0,H,a],[x0,H,b],hex('#7fb5a0'),m(0),undefined,[-1,0,0])});
  mb.box(x0-.08,H-.35,z0,x0+.08,H+.02,z1,hex('#d9dcd6'),m(MAT.metal));
  [door[0],door[1]].forEach(z=>mb.box(x0-.1,0,z-.08,x0+.1,H,z+.08,hex('#cfd3cc'),m(MAT.metal)));
  mb.quad([x0,H-.012,z0],[x1,H-.012,z0],[x1,H-.012,z1],[x0,H-.012,z1],hex('#f4f2ee'),m(0),undefined,[0,-1,0]);
  floor(x0,z0,x1,z1,2,'#e9e7e3',.005);
  for(let x=x0+2;x<x1-1;x+=3.2)for(let z=z0+2;z<z1-1;z+=3.6)mb.box(x,H-.07,z,x+1.6,H-.03,z+.5,hex('#ffffff'),m(MAT.emis,.9),{skip:'t'});
  [[13,38],[19,38],[13,50],[19,50],[15,44],[22,44]].forEach(p=>light([p[0],3.4,p[1]],'#fff6ee',8,.24,'oy'));
  const PC=['#ff8fb1','#7fd6c2','#ffd27a','#b6a4ff','#ffffff','#9ad1ff','#ffb27a','#c5ff35','#f1c6ff','#7bd389'];
  function gondola(gx0,gz0,gx1,gz1,two=true){mb.box(gx0,0,gz0,gx1,1.55,gz1,hex('#f7f5f0'),m(0));collide(gx0,gz0,gx1,gz1,'shelf');
    const alongX=(gx1-gx0)>(gz1-gz0);
    for(let lv=0;lv<3;lv++){const y=.35+lv*.42;
      (two?[-1,1]:[1]).forEach(s=>{const L=alongX?gx1-gx0:gz1-gz0;for(let u=.1;u<L-.12;u+=.13+R()*.05){const w=.06+R()*.05,hh=.1+R()*.17;
        let bxx,bz;if(alongX){bxx=gx0+u;bz=s>0?gz1+.012:gz0-.072}else{bz=gz0+u;bxx=s>0?gx1+.012:gx0-.072}
        mb.box(bxx,y,bz,bxx+(alongX?w:.06),y+hh,bz+(alongX?.06:w),hex(pick(PC)),m(0))}})}
    mb.box(gx0-.01,1.55,gz0-.01,gx1+.01,1.75,gz1+.01,hex('#9be15d'),m(MAT.emis,.6))}
  gondola(13,37.2,22.5,37.8);gondola(13,40.2,22.5,40.8);gondola(13,46.8,22.5,47.4);gondola(13,49.8,22.5,50.4);
  gondola(24.0,35,24.5,53,false);
  mb.box(10.4,0,50.2,11.4,1.05,53,hex('#ffffff'),m(0));mb.box(10.3,1.05,50.1,11.5,1.12,53.1,hex('#9be15d'),m(MAT.emis,.8));collide(10.4,50.2,11.4,53,'shelf');
  // ---- product 02 window display: lit podium + back panel, just inside the glass, seen from the street ----
  const px=10.55,pz=47.6;
  W.products.push({id:0,key:'p2',pos:[px,1.02,pz],zone:'올리브영 매장 안 · 쇼윈도',nav:[HW-.9,47.6]});
  mb.cyl([px,0,pz],[px,.72,pz],.5,.46,28,hex('#f2f4ee'),m(0));mb.cyl([px,.72,pz],[px,.76,pz],.48,.48,28,hex('#c5ff35'),m(MAT.emis,1.8));
  mb.box(11.55,0,46.3,11.7,2.7,48.9,hex('#e9f3e4'),m(0));dm.quad([11.54,.4,48.7],[11.54,.4,46.5],[11.54,2.5,46.5],[11.54,2.5,48.7],hex('#dfffc0'),m(MAT.emis,.32),undefined,[-1,0,0]);
  mb.box(10.0,3.9,47.0,11.1,4.38,48.2,hex('#1c1b22'),m(MAT.metal));mb.box(10.2,3.88,47.2,10.9,3.9,48.0,hex('#ffffff'),m(MAT.emis,2));
  collide(10.0,47.0,11.1,48.2,'prod');light([px,2.6,pz],'#e2ffd0',3.5,.6,'oy');light([px-1.2,1.6,pz],'#b48cff',3.5,.7,'prod');
  // entrance canopy + facade signs (on the 15 cm sign band in front of the glass line)
  mb.box(x0-1.2,3.95,41.2,x0+.1,4.05,46.0,hex('#e9f3e4'),m(MAT.emis,.35));
  sign('올리브영',[x0,H+1.1,44],[-1,0,0],5.2,1.25,2.6,'#e9f3e4',.12);sign('OLIVE YOUNG',[x0,H+.3,44],[-1,0,0],4.2,.55,2.2,'#e9f3e4',.12);
  [[37.5,'스킨케어'],[51,'K-BEAUTY LAB']].forEach(([z,tx])=>hangSign(tx,[x0,0,z],[-1,0,0],1.6,.5,2.4));
  light([x0-2,3,44],'#c8ffd0',10,1.0,'oysign');
  W.p2look=[HW-.9,47.6];        // interaction point outside the glass
})();

/* ---------------- night market (pojangmacha) ---------------- */
W.steam=[];W.vendors=[];
(function food(){
  const TARP=['#ff6a3d','#e84a5f','#ff8c42','#3d6bff','#f6b93b','#d94f8a','#7a4dff','#2fb7c9','#ff5e7e','#ffb13b'];
  const FOOD=[['떡볶이 명가','#e5432f','#f08a24','pan'],['어묵','#d9b382','#c98a4a','pot'],['호떡','#c98a4a','#e8c07a','grill'],['닭꼬치','#a8462a','#e0a050','skew'],['튀김','#e3a64a','#c98a3a','fry'],
    ['붕어빵','#c07a3a','#d9a060','mold'],['닭강정','#b5542a','#e0903a','pan'],['디저트 바','#f3b6d8','#fff0f6','case'],['음료 · 스무디','#62f0ff','#ff7ab6','drink'],['BUBBLE TEA','#d9b38a','#5a3a2a','drink']];
  let k=0;
  function stall(x,z,face,o={}){
    const ax=o.axis||'z',w=o.w||(1.7+R()*.9),d=1.2+R()*.2,f=o.food||FOOD[(k++)%FOOD.length],tc=hex(o.tarp||TARP[(k*7)%TARP.length]);
    const X=(u,v)=>ax==='z'?[x+u,z+v*face]:[x+v*face,z+u];
    const box=(u0,y0,v0,u1,y1,v1,cl,mt)=>{const a=X(u0,v0),b=X(u1,v1);mb.box(Math.min(a[0],b[0]),y0,Math.min(a[1],b[1]),Math.max(a[0],b[0]),y1,Math.max(a[1],b[1]),cl,mt)};
    box(-w/2,0,-d/2,w/2,.9,d/2,hex('#7d828c'),m(MAT.metal));const c0=X(-w/2-.08,-d/2-.08),c1=X(w/2+.08,d/2+.08);collide(c0[0],c0[1],c1[0],c1[1],'stall');
    box(-w/2-.04,.9,-d/2-.04,w/2+.04,.96,d/2+.04,hex('#c7ccd2'),m(MAT.metal));
    box(-w/2+.02,.1,d/2-.04,w/2-.02,.86,d/2+.02,hex(TARP[(k+3)%TARP.length]),m(0));
    // food display at the front edge + cooking equipment
    const cf=X(-w*.15,0);
    if(f[3]==='pan'){mb.cyl([cf[0],.96,cf[1]],[cf[0],1.05,cf[1]],.42,.47,18,hex('#1b1b1f'),m(MAT.metal));mb.cyl([cf[0],1.0,cf[1]],[cf[0],1.06,cf[1]],.39,.39,18,hex(f[1]),m(0,.3));
      for(let i=0;i<10;i++){const a=X(-w*.15+(R()-.5)*.5,(R()-.5)*.5);mb.cyl([a[0],1.06,a[1]],[a[0]+(R()-.5)*.1,1.08,a[1]+.08],.02,.02,5,hex('#f4e2c8'),m(0),false)}}
    else if(f[3]==='pot'){box(-w*.15-.42,.96,-.32,-w*.15+.42,1.14,.32,hex('#9aa0a8'),m(MAT.metal));for(let i=0;i<9;i++){const a=X(-w*.15-.32+i*.08,-.1+(i%2)*.18);mb.cyl([a[0],1.0,a[1]],[a[0],1.45,a[1]],.012,.012,4,hex('#c9a46e'),m(0),false);mb.box(a[0]-.03,1.16,a[1]-.03,a[0]+.03,1.32,a[1]+.03,hex(f[1]),m(0))}}
    else if(f[3]==='skew'){box(-w*.4,.96,-.3,w*.1,1.0,.3,hex('#141418'),m(MAT.metal));for(let i=0;i<10;i++){const a=X(-w*.38+i*.08,.05);mb.cyl([a[0],1.02,a[1]-.22*face],[a[0],1.04,a[1]+.28*face],.008,.008,4,hex('#c9a46e'),m(0),false);mb.box(a[0]-.03,1.0,a[1]-.12,a[0]+.03,1.07,a[1]+.12,hex(i%2?f[1]:f[2]),m(0,.2))}}
    else if(f[3]==='grill'||f[3]==='mold'){box(-w*.4,.96,-.35,w*.1,1.02,.35,hex('#141418'),m(MAT.metal));for(let i=0;i<8;i++){const a=X(-w*.36+(i%4)*.15,-.15+Math.floor(i/4)*.3);
      f[3]==='mold'?mb.box(a[0]-.06,1.02,a[1]-.04,a[0]+.06,1.06,a[1]+.04,hex(f[1]),m(0,.2)):mb.sphere([a[0],1.05,a[1]],[.065,.03,.065],6,hex(f[1]),m(0,.2))}}
    else if(f[3]==='fry'){box(-w*.35,.96,-.3,w*.05,1.18,.3,hex('#8f949c'),m(MAT.metal));box(-w*.33,1.16,-.28,w*.03,1.17,.28,hex('#d7a038'),m(0,.4));
      box(w*.08,.96,-.35,w*.45,.98,.35,hex('#d9d6cf'),m(0));for(let i=0;i<14;i++){const a=X(w*.12+(i%5)*.065,-.25+Math.floor(i/5)*.22);mb.box(a[0]-.025,.98,a[1]-.05,a[0]+.025,1.03,a[1]+.05,hex(f[1]),m(0,.2))}}
    else if(f[3]==='drink'){box(-w*.42,.96,-.25,-w*.05,1.45,.2,hex('#e9f4ff'),m(MAT.emis,.9));for(let i=0;i<8;i++){const a=X(w*.05+(i%4)*.1,-.12+Math.floor(i/4)*.2);mb.cyl([a[0],.96,a[1]],[a[0],1.12,a[1]],.035,.04,8,hex(i%2?f[1]:f[2]),m(MAT.emis,.6))}}
    else{box(-w*.42,.96,-.3,w*.32,1.38,.3,hex('#e9f4ff'),m(MAT.emis,.6));for(let i=0;i<7;i++){const a=X(-w*.36+i*.1,0);mb.box(a[0]-.03,1.0,a[1]-.04,a[0]+.03,1.08,a[1]+.04,hex(i%2?f[1]:f[2]),m(0,.2))}}
    box(-w*.4,.9,-.3,w*.1,.925,.3,hex('#ff7a2a'),m(MAT.emis,1.4));                               // burner glow
    // utensils, gas bottle, storage crates
    {const a=X(w*.32,.1);mb.cyl([a[0],.96,a[1]],[a[0]+.05,1.35,a[1]],.008,.008,4,hex('#c9ccd4'),m(MAT.metal),false);mb.sphere([a[0]+.05,1.36,a[1]],[.04,.015,.04],5,hex('#c9ccd4'),m(MAT.metal))}
    {const a=X(w/2+.25,-d/2+.2);mb.cyl([a[0],0,a[1]],[a[0],.55,a[1]],.13,.13,10,hex(pick(['#d33a3a','#3a6bd3','#c9c9c9'])),m(MAT.metal))}
    for(let i=0;i<1+Math.floor(R()*2);i++){const a=X(-w/2-.32,-d/2+.3+i*.42);mb.box(a[0]-.22,i*.0,a[1]-.18,a[0]+.22,.32,a[1]+.18,hex(pick(['#2f6bd6','#d64a2f','#e2c13b','#2fb37a'])),m(0))}
    // illuminated menu board on the back + small price boards on poles
    const mbp=X(w*.18,-d/2+.05);sign(f[0],[mbp[0],1.7,mbp[1]],ax==='z'?[0,0,face]:[face,0,0],Math.min(1.4,w*.65),.36,2.8,'#2a1414',.04,R()<.15?2:0);
    // poles + canopy (sloped awning, emissive underside), varied heights
    const hT=2.35+R()*.35;
    [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([su,sv])=>{const a=X(su*(w/2+.02),sv*(d/2+.02));mb.cyl([a[0],0,a[1]],[a[0],hT+(sv<0?.2:0),a[1]],.025,.025,6,hex('#6a6a72'),m(MAT.metal),false)});
    const seg=6;for(let i=0;i<seg;i++){const t0=i/seg,t1=(i+1)/seg;const v0=-d/2-.15+(d+.7)*t0,v1=-d/2-.15+(d+.7)*t1,y0=hT+.22-.38*t0+.08*Math.sin(t0*Math.PI),y1=hT+.22-.38*t1+.08*Math.sin(t1*Math.PI);
      const p=(u,v,y)=>{const q=X(u,v);return[q[0],y,q[1]]};
      const A=p(-w/2-.2,v0,y0),B=p(w/2+.2,v0,y0),C=p(w/2+.2,v1,y1),D=p(-w/2-.2,v1,y1);
      const cl=(i%2?tc.map(v=>v*.82):tc);mb.quad(A,B,C,D,cl,m(0,.2));mb.quad(D,C,B,A,cl.map(v=>v*.9),m(MAT.emis,.5))}
    // warm bulbs + task light
    for(let i=0;i<4;i++){const a=X(-w/2+.2+i*(w-.4)/3,.25);mb.cyl([a[0],hT+.05,a[1]],[a[0],hT-.18,a[1]],.004,.004,3,hex('#222'),m(0),false);mb.sphere([a[0],hT-.24,a[1]],[.055,.075,.055],6,hex('#ffe2a8'),m(MAT.emis,6.5))}
    const lc=X(0,.3);light([lc[0],1.9,lc[1]],o.hero?'#ffb060':'#ffb56a',o.hero?6.5:5,o.hero?2.2:1.5,'stall');
    W.steam.push({x:cf[0],y:1.15,z:cf[1],k:R()});
    const vp=X(0,-d/2-.45);W.vendors.push({x:vp[0],z:vp[1],hd:ax==='z'?(face>0?0:Math.PI):(face>0?Math.PI/2:-Math.PI/2)});
    return{front:X(0,d/2+.2),w,d};
  }
  // ---- food alley: two facing rows (slight jitter, varied widths), corridor ~6 m ----
  let hero=null;
  for(let x=-11.4;x>-34.5;x-=2.7+R()*.3){const j=(R()-.5)*.25;
    if(Math.abs(x+20.1)<1.4){hero=stall(-20.1,22.45,1,{food:FOOD[0],w:2.6,tarp:'#ff5a2a',hero:true});continue}
    stall(x,22.45+j,1);stall(x+.5,29.55-j,-1)}
  // the hero stall: more bulbs, a lit header and lanterns
  sign('떡볶이 명가',[-20.1,3.35,21.0],[0,0,1],2.4,.55,3.4,'#2a0d08',.12,2);
  for(let i=0;i<7;i++)mb.sphere([-21.4+i*.43,2.72+Math.sin(i)*.05,23.45],[.07,.09,.07],6,hex('#ffcf8a'),m(MAT.emis,7));
  light([-20.1,2.4,23.6],'#ff9a50',6,1.8,'stall');
  // ---- product 01: installed right in front of the hero stall, on the pedestrian side, not in the walking line ----
  W.products.push({id:1,key:'p1',pos:[-20.1,.95,24.15],zone:'포장마차 거리 · 떡볶이 명가 앞'});
  mb.cyl([-20.1,0,24.15],[-20.1,.6,24.15],.46,.42,24,hex('#1c1a24'),m(MAT.metal));mb.cyl([-20.1,.6,24.15],[-20.1,.64,24.15],.44,.44,24,hex('#c5ff35'),m(MAT.emis,1.6));
  dm.quad([-20.85,.008,24.9],[-19.35,.008,24.9],[-19.35,.008,23.4],[-20.85,.008,23.4],hex('#2b2140'),m(MAT.ground,0,2,0));
  collide(-20.6,23.65,-19.6,24.65,'prod');light([-20.1,2.2,24.6],'#b48cff',4.5,1.2,'prod');
  // ---- main street north: staggered market spine on both sides of the promenade ----
  for(let z=71;z<106;z+=3.1+R()*.6){const j=(R()-.5)*.4;stall(-2.4+j,z,-1,{axis:'x',w:2.0+R()*.5});if(R()<.8)stall(2.4-j,z+1.4,1,{axis:'x',w:2.0+R()*.5})}
  // ---- main street south: a small cluster of carts on the west sidewalk ----
  [[36],[39.2],[42.6],[48]].forEach(([z])=>stall(-6.9,z,1,{axis:'x',w:1.7}));
  // lanterns over the alley
  for(let x=-11;x>-34;x-=3.4)W.lanterns.push({x,z0:21.2,z1:30.8,y:4.6+R()*.6,ph:R()*6});
})();

/* ---------------- intersection ---------------- */
(function cross(){
  [[-7.6,57.6,1],[7.6,57.6,1],[-7.6,66.4,-1],[7.6,66.4,-1]].forEach(([x,z,d])=>{mb.cyl([x,0,z],[x,3.4,z],.07,.06,8,hex('#3a3a44'),m(MAT.metal));collide(x-.12,z-.12,x+.12,z+.12,'pole');W.signals.push({x,y:2.6,z,face:d})});
  [[-11,60.2],[11,63.8]].forEach(([x,z])=>{const pz=z<62?57.6:66.4;mb.cyl([x,0,pz],[x,5.6,pz],.1,.08,8,hex('#3a3a44'),m(MAT.metal));
    mb.box(x-.06,5.5,Math.min(z,pz),x+.06,5.62,Math.max(z,pz),hex('#3a3a44'),m(MAT.metal));W.signals.push({x,y:5.2,z,car:true})});
  // product 03: corner plaza (south-west corner of the crossing) with a lit plinth, ring light and floor graphic
  W.products.push({id:2,key:'p3',pos:[-6.4,1.0,53.4],zone:'명동 교차로 · 남서쪽 코너'});
  mb.box(-7.0,0,52.8,-5.8,.65,54.0,hex('#2a2833'),m(MAT.metal));mb.box(-7.03,.65,52.77,-5.77,.69,54.03,hex('#c5ff35'),m(MAT.emis,1.4));collide(-7.0,52.8,-5.8,54.0,'prod');
  for(let i=0;i<24;i++){const a0=i/24*Math.PI*2,a1=(i+1)/24*Math.PI*2;dm.quad([-6.4+Math.cos(a0)*1.6,.008,53.4+Math.sin(a0)*1.6],[-6.4+Math.cos(a1)*1.6,.008,53.4+Math.sin(a1)*1.6],[-6.4+Math.cos(a1)*1.75,.008,53.4+Math.sin(a1)*1.75],[-6.4+Math.cos(a0)*1.75,.008,53.4+Math.sin(a0)*1.75],hex('#9d5cff'),m(MAT.emis,1.6))}
  mb.cyl([-8.3,0,51.6],[-8.3,4.2,51.6],.06,.05,8,hex('#2a2833'),m(MAT.metal));mb.cyl([-8.3,4.2,51.6],[-6.6,4.4,53.2],.035,.035,6,hex('#2a2833'),m(MAT.metal),false);
  mb.cyl([-6.4,4.3,53.4],[-6.4,4.4,53.4],.5,.5,24,hex('#c9b8ff'),m(MAT.emis,1.1));light([-6.4,3.2,53.4],'#b48cff',5,1.3,'prod');collide(-8.42,51.48,-8.18,51.72,'pole');
  // pedestrian barriers along the cross-street kerbs, gaps at the crossings
  for(const z of [58.2,65.8])for(let x=-62;x<62;x+=3){if(Math.abs(x)<7.5||Math.abs(x+33)<3)continue;
    mb.cyl([x,0,z],[x,.95,z],.03,.03,6,hex('#6a6876'),m(MAT.metal),false);mb.cyl([x+3,0,z],[x+3,.95,z],.03,.03,6,hex('#6a6876'),m(MAT.metal),false);
    mb.cyl([x,.95,z],[x+3,.95,z],.03,.03,6,hex('#8b899a'),m(MAT.metal),false);mb.cyl([x,.5,z],[x+3,.5,z],.02,.02,4,hex('#8b899a'),m(MAT.metal),false);collide(x,z-.05,x+3,z+.05,'rail')}
  const CC=['#d9dbe3','#2b2d38','#6f5bd6','#b8bec9','#1c1f2a','#8fd0e8','#e8e6ee'];
  for(let i=0;i<7;i++)W.cars.push({lane:i%2,x:-60+i*19+R()*6,v:0,col:hex(pick(CC)),type:i%3});
})();

/* ---------------- street furniture ---------------- */
// reference-style street lights: tall dark posts, L-arm, linear light bar
function lamp(x,z,face){mb.cyl([x,0,z],[x,6.2,z],.08,.06,8,hex('#1f1e26'),m(MAT.metal));mb.box(x-.05,6.1,z-.05,x+face*1.5+.05,6.22,z+.05,hex('#1f1e26'),m(MAT.metal));
  mb.box(x+face*.3,6.02,z-.07,x+face*1.45,6.1,z+.07,hex('#eaf0ff'),m(MAT.emis,4.5));mb.box(x-.07,1.2,z-.07,x+.07,5.4,z+.07,hex('#4f7bff'),m(MAT.emis,.0));
  dm.quad([x+.085,1.2,z-.02],[x+.085,1.2,z+.02],[x+.085,5.2,z+.02],[x+.085,5.2,z-.02],hex(face>0?'#6f8bff':'#c07aff'),m(MAT.emis,2.6),undefined,[1,0,0]);
  light([x+face*.9,5.6,z],'#dfe6ff',10,1.05,'lamp');collide(x-.13,z-.13,x+.13,z+.13,'pole')}
for(let z=4;z<108;z+=12){if(z>50&&z<72)continue;lamp(-PROM-.45,z,1);lamp(PROM+.45,z+6,-1)}
for(let x=-56;x<56;x+=14){if(Math.abs(x)<9)continue;lamp(x,57.25,0);lamp(x+7,66.75,0)}
// trash bins, utility cabinets, benches, bollards, planters
function bin(x,z){mb.cyl([x,0,z],[x,.9,z],.24,.26,12,hex('#2f2d38'),m(MAT.metal));mb.cyl([x,.9,z],[x,.96,z],.27,.25,12,hex('#55525e'),m(MAT.metal));mb.box(x-.12,.62,z-.27,x+.12,.7,z+.27,hex('#5ee7ff'),m(MAT.emis,1.4));collide(x-.27,z-.27,x+.27,z+.27,'bin')}
function cabinet(x,z,rot){const w=rot?.4:.9,d=rot?.9:.4;mb.box(x-w/2,0,z-d/2,x+w/2,1.35,z+d/2,hex('#5a5866'),m(MAT.metal));dm.quad([x-w/2+.06,.9,z+d/2+.006],[x+w/2-.06,.9,z+d/2+.006],[x+w/2-.06,1.2,z+d/2+.006],[x-w/2+.06,1.2,z+d/2+.006],hex('#c5ff35'),m(MAT.emis,.8),undefined,[0,0,1]);collide(x-w/2,z-d/2,x+w/2,z+d/2,'cab')}
[[-PROM-.5,14],[PROM+.5,26],[-PROM-.5,46],[PROM+.5,80],[-PROM-.5,96],[-12,57.3],[14,66.7],[-34,33]].forEach(([x,z])=>bin(x,z));
[[-8.4,8],[8.4,20],[8.4,74],[-8.4,104],[-35.3,26]].forEach(([x,z])=>cabinet(x,z,Math.abs(x)>8));
[[-3.1,20],[3.1,40],[-3.1,88]].forEach(([x,z])=>{mb.box(x-.9,0,z-.25,x+.9,.45,z+.25,hex('#6b5a4a'),m(0));mb.box(x-.9,.02,z-.27,x+.9,.06,z+.27,hex('#9d5cff'),m(MAT.emis,1.2));collide(x-.9,z-.25,x+.9,z+.25,'bench')});
function planter(x,z){mb.box(x-.9,0,z-.45,x+.9,.5,z+.45,hex('#45434e'),m(MAT.clad,0,R(),0));collide(x-.9,z-.45,x+.9,z+.45,'pl');W.trees.push({x,z,h:2.6+R()*1.2,ph:R()*6,c:pick(['#3f8a62','#4a9a78','#5a8f5a','#3f7f6a'])})}
[[-7.6,18],[7.6,40],[-7.6,90]].forEach(([x,z])=>planter(x,z));   // on the sidewalks, the promenade stays open for the view to the moon

/* ---------------- overhead cables: thick utility lines, thin secondaries, bundles, brackets, junction boxes ---------------- */
const BX=HW+.08;
for(let z=-18;z<108;z+=1.6+R()*2.6){if(z>53&&z<71)continue;const n=1+(R()<.55?1:0)+(R()<.3?1:0)+(R()<.15?2:0);
  for(let i=0;i<n;i++){const y0=6+R()*16,y1=6+R()*16,dz=(R()-.5)*8,thick=R()<.25;const a=[-BX,y0,z],b=[BX,y1,z+dz];
    wire(a,b,.4+R()*1.6,thick?.022:.008+R()*.007);bracket([-HW,y0,z],[1,0,0]);bracket([HW,y1,z+dz],[-1,0,0]);
    if(R()<.25){for(let q=1;q<3;q++)wire([a[0],a[1]-q*.09,a[2]+q*.05],[b[0],b[1]-q*.08,b[2]+q*.05],.4+R()*1.6+q*.05,.007)}}}
for(let i=0;i<22;i++){const z=-16+i*5.6;[-1,1].forEach(s=>{const x=s*(HW+.08),y=5+R()*10;wire([x,y,z],[x,y+(R()-.5)*3,z+4+R()*4],.4,.009);if(R()<.4){const p=[s*HW,y-.4,z+2];bx([p[0]+s*.05,p[1]-.25,p[2]-.2],[p[0]-s*.18,p[1]+.25,p[2]+.2],hex('#3a3842'),m(MAT.metal))}})}
for(let x=-11;x>-35;x-=1.8+R()*1.8)for(let i=0;i<2;i++)wire([x,5+R()*7,21.08],[x+(R()-.5)*5,5+R()*7,30.92],.5+R(),.009+R()*.006);
for(let x=-56;x<56;x+=3+R()*4){if(Math.abs(x)<9.5)continue;wire([x,7+R()*7,56.08],[x+(R()-.5)*6,7+R()*7,67.92],.8+R(),.011)}
for(let z=58;z<67;z+=2.2)wire([-HW-.1,8+R()*5,z],[HW+.1,8+R()*5,z+(R()-.5)*2],1+R(),.014);
// signs suspended above the street on the cables
[[20,'카페 2030'],[34,'명동 2030'],[78,'K-POP STORE'],[92,'MYEONGDONG']].forEach(([z,t])=>{const y=8+R()*2;const p1=wire([-BX,y+2.2,z],[BX,y+2.2,z],.7,.016);
  const s=AT.slots[t];const w=3.2,h=.75;bx([-w/2-.05,y-h/2-.05,z-.08],[w/2+.05,y+h/2+.05,z+.08],hex('#100f16'),m(MAT.metal));
  [-1.2,1.2].forEach(x=>mb.cyl([x,y+h/2,z],[x,y+2.2-.7*4*(.5+x/(2*BX))*(.5-x/(2*BX)),z],.008,.008,4,hex('#55525e'),m(MAT.metal),false));
  [1,-1].forEach(sg=>{const nz=z+sg*.092;const P=(u,v)=>[u*sg,y+v,nz];dm.quad(P(-w/2,-h/2),P(w/2,-h/2),P(w/2,h/2),P(-w/2,h/2),hex('#16131f'),m(MAT.sign,2.6,R(),2),[[s[0],s[3]],[s[2],s[3]],[s[2],s[1]],[s[0],s[1]]],[0,0,sg])});
  light([0,y-1.2,z],pick(NEON),8,.9)});

/* ---------------- distant skyline (non-overlapping towers with crowns) ---------------- */
{const placed=[];let tries=0;
  while(placed.length<85&&tries<4000){tries++;const a=R()*Math.PI*2,d=95+R()*230;const cx=Math.cos(a)*d,cz=45+Math.sin(a)*d;
    if(Math.abs(cx)<72&&cz>-60&&cz<150)continue;const w=10+R()*20,dd=10+R()*20;
    if(placed.some(q=>Math.abs(q[0]-cx)<(q[2]+w)/2+3&&Math.abs(q[1]-cz)<(q[3]+dd)/2+3))continue;placed.push([cx,cz,w,dd]);
    const h=35+R()*130*(R()<.3?1.7:1);
    mb.box(cx-w/2,0,cz-dd/2,cx+w/2,h,cz+dd/2,hex(pick(['#3c4060','#454a6e','#363a56','#4c4874'])),m(MAT.facade,0,R()*99,.4+R()*.4),{facade:true,skip:'d'});
    if(R()<.4)mb.box(cx-w/2-.15,h-3,cz-dd/2-.15,cx+w/2+.15,h-2.5,cz+dd/2+.15,hex(pick(['#9d5cff','#8fe9ff','#ff4fd8','#ffcf7a'])),m(MAT.emis,2.8));
    if(R()<.3){const s=R()<.5?1:-1;mb.box(cx+s*w/2-.3,h*.3,cz-.5,cx+s*w/2+.3,h*.9,cz+.5,hex(pick(NEON)),m(MAT.emis,2.6))}
    if(R()<.35){mb.cyl([cx,h,cz],[cx,h+10+R()*20,cz],.4,.1,6,hex('#55525e'),m(MAT.metal));mb.sphere([cx,h+10,cz],[.4,.4,.4],6,hex('#ff3a6a'),m(MAT.emis,8))}}}

/* LED advertisement screens (animated in the shader) -> decal mesh */
W.screens.forEach(S=>{const n=S.n,t=[n[2],0,-n[0]],hw=S.w/2,hh=S.h/2,p=S.p;const P=(a,b)=>[p[0]+t[0]*a,p[1]+b,p[2]+t[2]*a];
  dm.quad(P(-hw,-hh),P(hw,-hh),P(hw,hh),P(-hw,hh),[1,1,1],m(MAT.screen,2.2,S.seed,0),[[0,0],[1,0],[1,1],[0,1]],n)});
W.height=(x,z)=>{const s=W.stair;if(Math.abs(x)<1.6&&z<0&&z>-9.85){if(z<s.zBot)return s.yBot;return Math.min(0,(z-s.zTop)*(s.rise/s.run))}return 0};
W.indoor=(x,z)=>{const o=W.oy;return x>o.x0&&x<o.x1&&z>o.z0&&z<o.z1};
console.log('[CW] world',(mb.i.length/3|0),'tris',(dm.i.length/3|0),'decal tris',W.lights.length,'lights',W.colliders.length,'colliders');
})();
