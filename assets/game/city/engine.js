/* =====================================================================
   2030 MYEONGDONG — CITY ENGINE (WebGL2)
   A small purpose-built 3D renderer for the first-person city:
   batched static geometry · procedural illustrated materials · point lights ·
   height fog & atmospheric perspective · sky dome · HDR bloom · tone mapping.
   ===================================================================== */
(function(){
'use strict';
const CE=window.CE={};

/* ---------- math (column-major mat4) ---------- */
const M4={
  ident(){return new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1])},
  mul(a,b,o=new Float32Array(16)){for(let i=0;i<4;i++)for(let j=0;j<4;j++){let s=0;for(let k=0;k<4;k++)s+=a[k*4+j]*b[i*4+k];o[i*4+j]=s}return o},
  persp(fov,asp,n,f){const t=1/Math.tan(fov/2),o=new Float32Array(16);o[0]=t/asp;o[5]=t;o[10]=(f+n)/(n-f);o[11]=-1;o[14]=2*f*n/(n-f);return o},
  view(pos,yaw,pitch){ // camera looks along -Z rotated by yaw (around Y) then pitch
    const cy=Math.cos(yaw),sy=Math.sin(yaw),cp=Math.cos(pitch),sp=Math.sin(pitch);
    const f=[-sy*cp,sp,-cy*cp],r=[cy,0,-sy],u=[r[1]*f[2]-r[2]*f[1],r[2]*f[0]-r[0]*f[2],r[0]*f[1]-r[1]*f[0]];
    const o=new Float32Array(16);
    o[0]=r[0];o[4]=r[1];o[8]=r[2];o[1]=u[0];o[5]=u[1];o[9]=u[2];o[2]=-f[0];o[6]=-f[1];o[10]=-f[2];
    o[12]=-(r[0]*pos[0]+r[1]*pos[1]+r[2]*pos[2]);o[13]=-(u[0]*pos[0]+u[1]*pos[1]+u[2]*pos[2]);o[14]=(f[0]*pos[0]+f[1]*pos[1]+f[2]*pos[2]);o[15]=1;return o},
  inv(m){const a=m,o=new Float32Array(16);
    const b00=a[0]*a[5]-a[1]*a[4],b01=a[0]*a[6]-a[2]*a[4],b02=a[0]*a[7]-a[3]*a[4],b03=a[1]*a[6]-a[2]*a[5],b04=a[1]*a[7]-a[3]*a[5],b05=a[2]*a[7]-a[3]*a[6],
    b06=a[8]*a[13]-a[9]*a[12],b07=a[8]*a[14]-a[10]*a[12],b08=a[8]*a[15]-a[11]*a[12],b09=a[9]*a[14]-a[10]*a[13],b10=a[9]*a[15]-a[11]*a[13],b11=a[10]*a[15]-a[11]*a[14];
    let d=b00*b11-b01*b10+b02*b09+b03*b08-b04*b07+b05*b06;if(!d)return o;d=1/d;
    o[0]=(a[5]*b11-a[6]*b10+a[7]*b09)*d;o[1]=(a[2]*b10-a[1]*b11-a[3]*b09)*d;o[2]=(a[13]*b05-a[14]*b04+a[15]*b03)*d;o[3]=(a[10]*b04-a[9]*b05-a[11]*b03)*d;
    o[4]=(a[6]*b08-a[4]*b11-a[7]*b07)*d;o[5]=(a[0]*b11-a[2]*b08+a[3]*b07)*d;o[6]=(a[14]*b02-a[12]*b05-a[15]*b01)*d;o[7]=(a[8]*b05-a[10]*b02+a[11]*b01)*d;
    o[8]=(a[4]*b10-a[5]*b08+a[7]*b06)*d;o[9]=(a[1]*b08-a[0]*b10-a[3]*b06)*d;o[10]=(a[12]*b04-a[13]*b02+a[15]*b00)*d;o[11]=(a[9]*b02-a[8]*b04-a[11]*b00)*d;
    o[12]=(a[5]*b07-a[4]*b09-a[6]*b06)*d;o[13]=(a[0]*b09-a[1]*b07+a[2]*b06)*d;o[14]=(a[13]*b01-a[12]*b03-a[14]*b00)*d;o[15]=(a[8]*b03-a[9]*b01+a[10]*b00)*d;return o},
  T(x,y,z){const o=M4.ident();o[12]=x;o[13]=y;o[14]=z;return o},
  S(x,y,z){const o=M4.ident();o[0]=x;o[5]=y;o[10]=z;return o},
  RX(a){const c=Math.cos(a),s=Math.sin(a),o=M4.ident();o[5]=c;o[6]=s;o[9]=-s;o[10]=c;return o},
  RY(a){const c=Math.cos(a),s=Math.sin(a),o=M4.ident();o[0]=c;o[2]=-s;o[8]=s;o[10]=c;return o},
  RZ(a){const c=Math.cos(a),s=Math.sin(a),o=M4.ident();o[0]=c;o[1]=s;o[4]=-s;o[5]=c;return o},
  chain(...ms){let o=ms[0];for(let i=1;i<ms.length;i++)o=M4.mul(o,ms[i]);return o},
  apply(m,p){return[m[0]*p[0]+m[4]*p[1]+m[8]*p[2]+m[12],m[1]*p[0]+m[5]*p[1]+m[9]*p[2]+m[13],m[2]*p[0]+m[6]*p[1]+m[10]*p[2]+m[14]]}
};
CE.M4=M4;
const hex=h=>{h=h.replace('#','');return[parseInt(h.slice(0,2),16)/255,parseInt(h.slice(2,4),16)/255,parseInt(h.slice(4,6),16)/255]};
CE.hex=hex;

/* ---------- mesh builder ----------
   vertex: pos3 nrm3 col3 mat4(id, emissive, p1, p2) uv2  = 15 floats            */
class MB{
  constructor(){this.v=[];this.i=[];this.n=0}
  vert(p,n,c,m,uv){this.v.push(p[0],p[1],p[2],n[0],n[1],n[2],c[0],c[1],c[2],m[0],m[1],m[2],m[3],uv[0],uv[1]);return this.n++}
  tri(a,b,c){this.i.push(a,b,c)}
  quad(p0,p1,p2,p3,col,mat,uv=[[0,0],[1,0],[1,1],[0,1]],nrm){
    const e1=[p1[0]-p0[0],p1[1]-p0[1],p1[2]-p0[2]],e2=[p3[0]-p0[0],p3[1]-p0[1],p3[2]-p0[2]];
    let n=nrm||[e1[1]*e2[2]-e1[2]*e2[1],e1[2]*e2[0]-e1[0]*e2[2],e1[0]*e2[1]-e1[1]*e2[0]];const l=Math.hypot(...n)||1;n=n.map(x=>x/l);
    const cs=Array.isArray(col[0])?col:[col,col,col,col];
    const a=this.vert(p0,n,cs[0],mat,uv[0]),b=this.vert(p1,n,cs[1],mat,uv[1]),c=this.vert(p2,n,cs[2],mat,uv[2]),d=this.vert(p3,n,cs[3],mat,uv[3]);
    this.tri(a,b,c);this.tri(a,c,d)}
  /* axis-aligned box. uvMode 'facade' → u = horizontal metres along the face, v = world height (for procedural windows/tiles) */
  box(x0,y0,z0,x1,y1,z1,col,mat,o={}){
    const skip=o.skip||'',shade=o.shade??true,fu=o.facade;
    const C=(k)=>shade?col.map(v=>v*k):col;
    const U=(a,b,y)=>fu?[a,y]:[0,0];
    // +Z face
    if(!skip.includes('f'))this.quad([x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1],[C(.92),C(.92),C(1),C(1)],mat,[U(0,0,y0),[fu?x1-x0:1,fu?y0:0],[fu?x1-x0:1,fu?y1:1],[0,fu?y1:1]].map((q,i)=>fu?[[0,y0],[x1-x0,y0],[x1-x0,y1],[0,y1]][i]:[[0,0],[1,0],[1,1],[0,1]][i]),[0,0,1]);
    if(!skip.includes('b'))this.quad([x1,y0,z0],[x0,y0,z0],[x0,y1,z0],[x1,y1,z0],[C(.92),C(.92),C(1),C(1)],mat,fu?[[0,y0],[x1-x0,y0],[x1-x0,y1],[0,y1]]:undefined,[0,0,-1]);
    if(!skip.includes('r'))this.quad([x1,y0,z1],[x1,y0,z0],[x1,y1,z0],[x1,y1,z1],[C(.8),C(.8),C(.88),C(.88)],mat,fu?[[0,y0],[z1-z0,y0],[z1-z0,y1],[0,y1]]:undefined,[1,0,0]);
    if(!skip.includes('l'))this.quad([x0,y0,z0],[x0,y0,z1],[x0,y1,z1],[x0,y1,z0],[C(.8),C(.8),C(.88),C(.88)],mat,fu?[[0,y0],[z1-z0,y0],[z1-z0,y1],[0,y1]]:undefined,[-1,0,0]);
    if(!skip.includes('t'))this.quad([x0,y1,z1],[x1,y1,z1],[x1,y1,z0],[x0,y1,z0],C(1.05),o.topMat||mat,o.topUV?[[x0,z1],[x1,z1],[x1,z0],[x0,z0]]:[[0,0],[1,0],[1,1],[0,1]],[0,1,0]);
    if(!skip.includes('d'))this.quad([x0,y0,z0],[x1,y0,z0],[x1,y0,z1],[x0,y0,z1],C(.6),mat,undefined,[0,-1,0]);
  }
  /* cylinder / cone from p0 to p1 */
  cyl(p0,p1,r0,r1,seg,col,mat,caps=true){
    const d=[p1[0]-p0[0],p1[1]-p0[1],p1[2]-p0[2]],L=Math.hypot(...d)||1,a=d.map(x=>x/L);
    let t=Math.abs(a[1])<.9?[0,1,0]:[1,0,0];let u=[a[1]*t[2]-a[2]*t[1],a[2]*t[0]-a[0]*t[2],a[0]*t[1]-a[1]*t[0]];let ul=Math.hypot(...u);u=u.map(x=>x/ul);
    const w=[a[1]*u[2]-a[2]*u[1],a[2]*u[0]-a[0]*u[2],a[0]*u[1]-a[1]*u[0]];
    const ring=[];for(let s=0;s<=seg;s++){const th=s/seg*Math.PI*2,c=Math.cos(th),sn=Math.sin(th);const n=[u[0]*c+w[0]*sn,u[1]*c+w[1]*sn,u[2]*c+w[2]*sn];
      const shade=.82+.18*Math.max(0,n[1]);
      ring.push([this.vert([p0[0]+n[0]*r0,p0[1]+n[1]*r0,p0[2]+n[2]*r0],n,col.map(v=>v*shade*.95),mat,[s/seg,0]),this.vert([p1[0]+n[0]*r1,p1[1]+n[1]*r1,p1[2]+n[2]*r1],n,col.map(v=>v*shade),mat,[s/seg,1])])}
    for(let s=0;s<seg;s++){const[a0,b0]=ring[s],[a1,b1]=ring[s+1];this.tri(a0,a1,b1);this.tri(a0,b1,b0)}
    if(caps){[[p0,r0,-1],[p1,r1,1]].forEach(([p,r,sg])=>{if(r<=0)return;const nn=a.map(x=>x*sg),c0=this.vert(p,nn,col,mat,[.5,.5]);const ids=[];
      for(let s=0;s<=seg;s++){const th=s/seg*Math.PI*2,c=Math.cos(th),sn=Math.sin(th);ids.push(this.vert([p[0]+(u[0]*c+w[0]*sn)*r,p[1]+(u[1]*c+w[1]*sn)*r,p[2]+(u[2]*c+w[2]*sn)*r],nn,col,mat,[.5+c*.5,.5+sn*.5]))}
      for(let s=0;s<seg;s++)sg>0?this.tri(c0,ids[s],ids[s+1]):this.tri(c0,ids[s+1],ids[s])})}
  }
  /* ellipsoid (optionally deformed) */
  sphere(c,r,seg,col,mat,deform,colFn){
    const rows=seg,cols=seg*2,ids=[];
    for(let y=0;y<=rows;y++){const v=y/rows,ph=v*Math.PI;const row=[];
      for(let x=0;x<=cols;x++){const u=x/cols,th=u*Math.PI*2;let n=[Math.sin(ph)*Math.cos(th),Math.cos(ph),Math.sin(ph)*Math.sin(th)];
        let p=[n[0]*r[0],n[1]*r[1],n[2]*r[2]];if(deform)p=deform(p,n);
        const nn=[n[0]/r[0],n[1]/r[1],n[2]/r[2]],l=Math.hypot(...nn);
        const cc=colFn?colFn(p,n):col;
        row.push(this.vert([c[0]+p[0],c[1]+p[1],c[2]+p[2]],nn.map(q=>q/l),cc,mat,[u,v]))}
      ids.push(row)}
    for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){const a=ids[y][x],b=ids[y][x+1],d=ids[y+1][x],e=ids[y+1][x+1];this.tri(a,d,e);this.tri(a,e,b)}
  }
  /* loft through elliptic sections [{y, rx, rz, cx, cz}] around the Y axis */
  loft(secs,seg,col,mat,colFn){
    const ids=[];
    secs.forEach((s,si)=>{const row=[];for(let k=0;k<=seg;k++){const th=k/seg*Math.PI*2,c=Math.cos(th),sn=Math.sin(th);
      const p=[(s.cx||0)+c*s.rx,s.y,(s.cz||0)+sn*s.rz];
      const s0=secs[Math.max(0,si-1)],s1=secs[Math.min(secs.length-1,si+1)];const dr=((s1.rx+s1.rz)-(s0.rx+s0.rz))/2,dy=(s1.y-s0.y)||1e-4;
      let n=[c/s.rx,-dr/dy*.5,sn/s.rz];const l=Math.hypot(...n);n=n.map(q=>q/l);
      row.push(this.vert(p,n,colFn?colFn(p,n,si):col,mat,[k/seg,si/(secs.length-1)]))}ids.push(row)});
    for(let a=0;a<secs.length-1;a++)for(let k=0;k<seg;k++){const p=ids[a][k],q=ids[a][k+1],r=ids[a+1][k],s=ids[a+1][k+1];this.tri(p,r,s);this.tri(p,s,q)}
    return ids;
  }
}
CE.MB=MB;

/* ---------- shaders ---------- */
const VS=`#version 300 es
precision highp float;
layout(location=0)in vec3 aP;layout(location=1)in vec3 aN;layout(location=2)in vec3 aC;layout(location=3)in vec4 aM;layout(location=4)in vec2 aU;
uniform mat4 uVP,uModel;
out vec3 vP,vN,vC;flat out vec4 vM;out vec2 vU; // flat: material ids/seeds must be bit-exact per face (interpolated 'constants' made window hashes sparkle)
void main(){vec4 w=uModel*vec4(aP,1.);vP=w.xyz;vN=mat3(uModel)*aN;vC=aC;vM=aM;vU=aU;gl_Position=uVP*w;}`;
const SKIN_VS=`#version 300 es
precision highp float;
layout(location=0)in vec3 aP;layout(location=1)in vec3 aN;layout(location=2)in vec3 aC;layout(location=3)in vec4 aM;layout(location=4)in vec2 aU;layout(location=5)in vec4 aJ;layout(location=6)in vec4 aW;
uniform mat4 uVP,uModel;uniform highp sampler2D uBones;uniform int uInst;
out vec3 vP,vN,vC;flat out vec4 vM;out vec2 vU; // flat: material ids/seeds must be bit-exact per face (interpolated 'constants' made window hashes sparkle)
mat4 bone(float j){int x=int(j+.5)*4;return mat4(texelFetch(uBones,ivec2(x,uInst),0),texelFetch(uBones,ivec2(x+1,uInst),0),texelFetch(uBones,ivec2(x+2,uInst),0),texelFetch(uBones,ivec2(x+3,uInst),0));}
void main(){mat4 S=bone(aJ.x)*aW.x+bone(aJ.y)*aW.y+bone(aJ.z)*aW.z+bone(aJ.w)*aW.w;
  vec4 w=uModel*(S*vec4(aP,1.));vP=w.xyz;vN=mat3(uModel)*(mat3(S)*aN);vC=aC;vM=aM;vU=aU;gl_Position=uVP*w;}`;
const FS=`#version 300 es
precision highp float;
in vec3 vP,vN,vC;flat in vec4 vM;in vec2 vU;
uniform vec3 uCam;uniform float uTime;
uniform vec4 uLP[32];uniform vec3 uLC[32];uniform int uNL;
uniform vec3 uFogA,uFogB;uniform float uFogD;
uniform sampler2D uAtlas;uniform sampler2D uChar;uniform vec3 uTint2;
uniform vec3 uTint;uniform vec3 uRim;uniform float uHL;uniform vec3 uHLC;uniform float uIndoor;
uniform sampler2D uRefl;uniform float uReflPass;uniform vec2 uRes;uniform float uReflOn;
out vec4 o;
float h21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float h11(float x){return fract(sin(x*91.345)*47453.5453);}
float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+1.),f.x),f.y);}
float fbm(vec2 p){float s=0.,a=.5;for(int i=0;i<4;i++){s+=a*vn(p);p*=2.03;a*=.5;}return s;}
/* anti-aliased pattern helpers: every procedural edge is filtered by its screen-space footprint (fwidth),
   and detail finer than ~1.5 px fades to its average -> no shimmer while the camera moves */
float aaS(float e,float x){float w=max(fwidth(x),1e-5);return smoothstep(e-w,e+w,x);}
float aaBox(float x,float a,float b){return aaS(a,x)*(1.-aaS(b,x));}
float hf(float x){return clamp(1.-fwidth(x)*1.6,0.,1.);}
vec3 skyCol(vec3 d){float y=clamp(d.y,-.2,1.);
  vec3 c=mix(vec3(.42,.42,.70),vec3(.07,.08,.17),smoothstep(-.05,.65,y));
  c=mix(c,vec3(.64,.58,.85),exp(-abs(y)*9.)*.55);return c;}
void main(){
  int m=int(vM.x+.5);float em=vM.y;
  if(uReflPass>.5&&(vP.y<-.03||m==2||m==11))discard;
  if(m==13){float r=length(vU-.5)*2.;float a=(1.-smoothstep(.0,1.,r));a*=a*em;o=vec4(vC*uTint*a,1.);return;}
  if(m==11){float r=length(vU-.5)*2.;o=vec4(vec3(1.-.6*(1.-smoothstep(.15,1.,r))),1.);return;}vec3 N=normalize(vN);
  vec3 V=normalize(uCam-vP);float dist=length(uCam-vP);
  vec3 alb=vC*uTint;float rough=.85,F0=.03;vec3 emis=vec3(0);float wrap=0.;float wet=0.;
  if(m==1){ // ---------- building facade ----------
    /* em<.5 : background facade, frames and slabs drawn by the shader
       em>.5 : glazing behind REAL frame geometry (spandrels/fins built in world.js on the same 2.3 x 3.3 m grid)
       every window is an "interior-mapped" room (ray vs. room box) so it has depth instead of a flat colour */
    vec2 u=vU;float seed=vM.z,ratio=vM.w;float geo=step(.5,em);
    float fl=3.3,cw=2.3;vec2 q=vec2(u.x/cw,(u.y-4.3)/fl);vec2 cell=floor(q),f=fract(q);
    float detail=hf(q.x)*hf(q.y);                                 // 1 near, 0 when a window is < ~1.5 px
    float win=(geo>.5?1.:aaBox(f.x,.13,.87)*aaBox(f.y,.2,.86))*aaS(4.4,u.y);
    vec3 wall=alb*(.86+.2*fbm(u*vec2(.6,.25)+seed))*(1.-.12*smoothstep(4.5,0.,u.y));
    wall*=1.-.2*(1.-geo)*(1.-aaS(.07,f.y));
    float h=h21(cell+seed*13.1),lit=step(h,ratio),k=h21(cell*1.7+seed),k2=h21(cell+seed+4.);
    vec3 wc=k<.5?vec3(1.,.8,.62):(k<.72?vec3(.75,.85,1.):(k<.88?vec3(.86,.58,1.):vec3(.45,.95,1.)));
    // interior mapping
    vec3 T=normalize(cross(vec3(0,1,0),N));vec3 rd=vec3(dot(-V,T),-V.y,max(dot(V,N),.04));
    vec3 ro=vec3((f.x-.5)*cw,(f.y-.53)*fl,0.);float D=1.8+1.6*k2;
    vec3 bmin=vec3(-cw*.62,-1.45,0.),bmax=vec3(cw*.62,1.5,D);
    vec3 t1=(bmin-ro)/rd,t2=(bmax-ro)/rd,tf=max(t1,t2);float th=min(min(tf.x,tf.y),tf.z);vec3 hp=ro+rd*th;
    vec3 room;
    if(th>=tf.z-1e-3)room=vec3(.42,.38,.46)*(.75+.5*vn(hp.xy*1.7+cell*3.1))*(k2<.3?(.8+.2*aaS(.5,fract(hp.y*3.))):1.);
    else if(th>=tf.y-1e-3)room=rd.y>0.?vec3(.95)*(.35+.65*aaBox(abs(hp.x),0.,.35)):vec3(.2,.17,.22)*(.6+.4*hp.z/D);
    else room=vec3(.3,.27,.34)*(.7+.3*hp.z/D);
    room*=1.-.45*hp.z/D;
    // blinds on some windows
    float bl=(k2>.78)?(.55+.45*aaS(.5,fract(f.y*14.))*hf(f.y*14.)):1.;
    vec3 inside=room*bl;inside=mix(vec3(dot(inside,vec3(.33))*.9),inside,detail); // distant: average only
    float inten=(.35+1.25*h21(cell+3.))*lit*(.88+.12*sin(uTime*.25+h*40.));
    vec3 glassC=vec3(.025,.03,.06);
    float fr=pow(1.-max(dot(N,V),0.),4.);
    vec3 we=wc*inside*inten*1.25+vec3(.05,.04,.1)*inside*(1.-lit);
    alb=mix(wall,glassC,win);rough=mix(.75,.07,win);F0=mix(.035,.09,win);
    emis=we*win*(1.-fr*.6)+skyCol(reflect(-V,N))*fr*.35*win;
  }else if(m==2){ // ---------- ground: wet asphalt / stone pavers / indoor tile ----------
    float kind=vM.z;vec2 u=vP.xz;
    float n1=fbm(u*.9),n2=fbm(u*4.1+3.);
    if(kind<.5){ // large staggered granite pavers, subtle joints
      vec2 t=vec2(u.x/1.2+.5*mod(floor(u.y/.6),2.),u.y/.6);vec2 ti=floor(t),tf=fract(t);
      float gr=(1.-aaBox(tf.x,.02,.98)*aaBox(tf.y,.04,.96))*hf(t.x)*hf(t.y);
      alb*=.7+.22*h21(ti)+.12*n2;alb*=1.-.28*gr;
    }else if(kind<1.5){alb*=.55+.35*n2+.15*n1;}
    else{vec2 t=u/vec2(.8,.8);vec2 tf=fract(t);float gr=(1.-aaS(.015,tf.x)*aaS(.015,tf.y))*hf(t.x)*hf(t.y);alb*=.95+.05*h21(floor(t));alb*=1.-.12*gr;}
    // drain covers along the kerb lines
    if(kind<.5){vec2 dc=vec2(abs(abs(u.x)-4.95),mod(u.y+3.,9.)-4.5);float dm=aaBox(dc.x,-1.,.22)*aaBox(abs(dc.y),-1.,.4);float sl=.5+.5*cos(dc.y*75.4)*hf(dc.y*12.);alb=mix(alb,vec3(.05)*(.6+.6*sl),dm);}
    float pud=smoothstep(.48,.7,fbm(u*.28+vec2(7.,2.)))+.0;
    wet=kind<1.5?clamp(.45+.75*pud,0.,1.):.5;
    rough=mix(.7,.03,wet);F0=mix(.03,.07,wet);alb*=mix(1.,.45,wet*(kind<1.5?1.:0.));
  }else if(m==3){ // ---------- emissive sign (atlas) ----------
    vec4 t=texture(uAtlas,vU);float fl=.94+.06*sin(uTime*(.7+vM.z*1.5)+vM.z*20.);
    if(vM.w>.5&&vM.w<1.5){float burst=step(.9,h11(floor(uTime*.35+vM.z*13.)));fl*=mix(1.,.15+.85*step(.45,h11(floor(uTime*22.)+vM.z*7.)),burst);}
    else if(vM.w>1.5)fl*=.7+.3*(.5+.5*sin(uTime*1.4+vM.z*9.));
    alb=mix(vC*.25,vec3(0),t.a);emis=t.rgb*em*fl*.42+vC*em*.05;rough=.4;
  }else if(m==4){ // ---------- subway tile wall ----------
    vec2 u=vU*vec2(1./.15,1./.075);vec2 tf=fract(vec2(u.x+.5*mod(floor(u.y),2.),u.y));float gr=1.-step(.06,tf.x)*step(.1,tf.y)*step(tf.x,.97)*step(tf.y,.93);
    alb*=1.-.45*gr;alb*=.92+.08*h21(floor(u));alb*=1.-.35*smoothstep(1.2,-.2,vU.y-vM.z)*fbm(vU*3.);rough=mix(.2,.9,gr);F0=.05;
  }else if(m==5){ // ---------- storefront glass: reflective pane + interior-mapped shop (shelves, display light) ----------
    float fr=pow(1.-max(dot(N,V),0.),4.);vec2 u=vU;
    vec3 ic=vM.z<.5?vec3(1.,.72,.6):(vM.z<1.5?vec3(.62,.82,1.):(vM.z<2.5?vec3(.82,.6,1.):vec3(1.,.6,.85)));
    vec3 T=normalize(cross(vec3(0,1,0),N));vec3 rd=vec3(dot(-V,T),-V.y,max(dot(V,N),.04));
    vec3 ro=vec3(u.x,u.y,0.);float D=3.2+vM.w*.15;
    float tb=D/rd.z,tfl=rd.y<0.?(ro.y-0.)/-rd.y:1e5,tce=rd.y>0.?(3.4-ro.y)/rd.y:1e5;float th=min(tb,min(tfl,tce));vec3 hp=ro+rd*th;
    vec3 room;float det=hf(u.x*2.)*hf(hp.y*2.);
    if(th==tb){ // back wall: lit shelving with products
      float shelf=aaBox(fract(hp.y/.55),.0,.08)*step(hp.y,2.4);
      vec2 pc=vec2(floor(hp.x*6.),floor(hp.y/.55));float prod=step(.35,h21(pc+vM.w))*aaBox(fract(hp.x*6.),.15,.85)*aaBox(fract(hp.y/.55),.2,.78)*step(hp.y,2.3)*step(.3,hp.y);
      vec3 pcol=.45+.55*vec3(h21(pc),h21(pc+1.3),h21(pc+2.7));
      room=ic*(.35+.3*det*shelf)+mix(vec3(.4),pcol,det)*prod*.9;
      room*=.55+.45*exp(-pow((fract(hp.x/2.4)-.5)*3.,2.));}
    else if(th==tfl){room=ic*.18*(.6+.4*exp(-pow((fract(hp.x/2.4)-.5)*3.,2.)))+ic*.25*exp(-hp.z*.5);}
    else{room=ic*(.25+1.4*aaBox(fract(hp.z/1.1),.0,.12)*det);}
    room*=1.-.35*hp.z/D;
    // illuminated display case near the glass on some bays
    float bay=floor(u.x/2.4);float dc=step(.55,h21(vec2(bay,vM.w)));
    float caseM=dc*aaBox(fract(u.x/2.4),.25,.75)*aaBox(u.y,.0,1.1);
    alb=vec3(.02);emis=room*em*.62+ic*caseM*em*.45;
    emis=emis*(1.-fr*.7)+skyCol(reflect(-V,N))*fr*.55;rough=.05;F0=.09;
}else if(m==12){ // ---------- animated LED advertisement screen ----------
    vec2 u=vU;float sd=vM.z,t=uTime*.25+sd*10.;float ph=floor(mod(t*.25,3.));
    vec3 c1=vec3(1.,.25,.85),c2=vec3(.3,.85,1.),c3=vec3(.6,.3,1.);
    vec3 bg=mix(mix(c3,c1,u.y),c2,.5+.5*sin(u.x*3.+t*2.));
    float blob=smoothstep(.32,.3,length((u-vec2(.5+.25*sin(t),.5+.2*cos(t*1.3)))*vec2(1.6,1.)));
    float bars=step(.5,fract(u.x*7.-t*2.))*step(u.y,.18);
    float ring=smoothstep(.02,.0,abs(length((u-.5)*vec2(1.7,1.))-.3-.05*sin(t*3.)));
    vec3 c=ph<.5?bg*.55+blob*vec3(1.):(ph<1.5?mix(c2,c1,step(.5,fract(u.y*4.+t)))*.6+ring*1.5:bg*.4+ring*vec3(1.)+bars*c2);
    float px=smoothstep(.08,.22,fract(u.x*90.))*smoothstep(.08,.22,fract(u.y*55.));c*=mix(.86,.6+.4*px,hf(u.x*90.)*hf(u.y*55.));
    alb=vec3(.01);emis=c*em*(.85+.15*sin(uTime*7.+sd*30.));rough=.2;
  }else if(m==7){ // ---------- worn concrete steps ----------
    vec2 u=vP.xz*3.+vP.y;alb*=.75+.35*fbm(u*2.);alb=mix(alb,vec3(.42,.4,.38),smoothstep(.62,.8,fbm(u*5.))*.6);rough=.9;
  }else if(m==8){wrap=.45;rough=.7;F0=.035;}
  else if(m==9){emis=alb*em;}
  else if(m==15){ // ---------- metal cladding panels (seams filtered) ----------
    vec2 u=vU;vec2 pq=vec2(u.x/1.2,u.y/.9);vec2 pc=floor(pq),pf=fract(pq);
    float seam=(1.-aaBox(pf.x,.015,.985)*aaBox(pf.y,.02,.98))*hf(pq.x)*hf(pq.y);
    alb*=(.82+.3*h21(pc+vM.z))*(1.-.45*seam);rough=.28+.25*h21(pc+3.);F0=.45;
  }
  else if(m==14){ // ---------- skinned character (real mesh) ----------
    int md=int(vM.z+.5);vec3 tx=texture(uChar,vU).rgb;wrap=.4;rough=.62;F0=.04;
    if(md==0)alb=tx*uTint;
    else if(md==1)alb=uTint*(.2+1.5*dot(tx,vec3(.3,.59,.11)));
    else if(md==2){alb=mix(uTint2,uTint,vC.r)*(.9+.1*vn(vU*90.)*hf(vU.x*90.));emis=uTint2*vC.b*2.6;rough=.7-.3*vC.g;F0=.04+.3*vC.g;}
    else{float st=vn(vec2(vU.x*70.,vU.y*3.));alb=uTint*(.7+.45*mix(.5,st,hf(vU.x*70.)));rough=.4;F0=.06;}
  }
  else if(m==10){ // metal
    rough=.25;F0=.55;
  }
  // ---------- lighting ----------
  vec3 L1=normalize(vec3(.35,.8,.45));
  float hemi=.5+.5*N.y;
  vec3 amb=mix(vec3(.04,.04,.085),vec3(.12,.13,.25),hemi)*mix(1.,1.7,uIndoor);
  vec3 col=alb*amb;
  float nd=max(dot(N,L1)+wrap,0.)/(1.+wrap);col+=alb*vec3(.26,.29,.5)*nd*.42;
  vec3 R=reflect(-V,N);
  for(int i=0;i<32;i++){if(i>=uNL)break;vec3 lv=uLP[i].xyz-vP;float d=length(lv);float rad=uLP[i].w;if(d>rad*2.2)continue;vec3 l=lv/d;
    float att=1./(1.+d*d/(rad*rad*.18));att*=smoothstep(rad*2.2,rad*.6,d);
    float dif=max(dot(N,l)+wrap,0.)/(1.+wrap);
    float sp=pow(max(dot(R,l),0.),mix(8.,420.,1.-rough))*mix(.1,4.,1.-rough);
    col+=uLC[i]*att*(alb*dif+F0*sp*(.4+wet*1.6));}
  // wet ground: blurred streak reflections of the nearest lights and of the sky
  if(m==2){float fres=pow(1.-max(dot(N,V),0.),5.);
    if(uReflOn>.5){vec2 su=gl_FragCoord.xy/uRes;vec2 rip=vec2(fbm(vP.xz*2.3+uTime*.05)-.5,fbm(vP.xz*2.1+7.)-.5);
      su+=rip*mix(.014,.002,wet);float bl=mix(.006,.0015,wet);vec3 rc=texture(uRefl,su).rgb*.4+texture(uRefl,su+vec2(bl,.004)).rgb*.2+texture(uRefl,su+vec2(-bl,.009)).rgb*.2+texture(uRefl,su+vec2(0.,.016)).rgb*.2;
      col+=rc*mix(.05,.62,wet*wet)*(.3+.7*fres)*(1.-uIndoor*.6);}
    else col+=skyCol(R)*(.05+.35*fres)*wet;}
  if(m==8||m==14){float rim=pow(1.-max(dot(N,V),0.),2.2);float sideL=.5+.5*dot(N.xz,normalize(vec2(1.,.4)));col+=uRim*rim*.9+mix(vec3(.55,.25,1.),vec3(.2,.8,1.),sideL)*rim*.45;}
  col+=emis;
  if(uHL>0.){float rim=pow(1.-max(dot(N,V),0.),2.);col+=uHLC*(rim*1.4+.12)*uHL;}
  // ---------- atmospheric perspective / height fog ----------
  float f=1.-exp(-pow(dist*uFogD,1.35));f*=mix(1.,.55,smoothstep(8.,60.,vP.y));
  vec3 fc=mix(uFogA,uFogB,smoothstep(-.1,.5,normalize(vP-uCam).y));
  col=mix(col,fc,clamp(f,0.,1.)*(1.-uIndoor*.7));
  if(any(isnan(col))||any(isinf(col)))col=vec3(0.);
  o=vec4(min(col,vec3(40.)),1.);
}`;
const SKY_VS=`#version 300 es
layout(location=0)in vec2 aP;out vec2 vP;void main(){vP=aP;gl_Position=vec4(aP,.9999,1.);}`;
const SKY_FS=`#version 300 es
precision highp float;in vec2 vP;uniform mat4 uIVP;uniform float uTime;uniform vec3 uFogA,uFogB;out vec4 o;
float h21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+1.),f.x),f.y);}
float fbm(vec2 p){float s=0.,a=.5;for(int i=0;i<5;i++){s+=a*vn(p);p*=2.02;a*=.5;}return s;}
float fbm6(vec2 p){float s=0.,a=.5;for(int i=0;i<6;i++){s+=a*vn(p);p=mat2(1.6,1.2,-1.2,1.6)*p;a*=.5;}return s;}
float craters(vec2 p){vec2 i=floor(p),f=fract(p);float c=0.;for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){vec2 g=vec2(x,y),r=vec2(h21(i+g),h21(i+g+7.3));
  float rad=.18+.3*h21(i+g+3.1);float d=length(g+r-f)/rad;c+=(smoothstep(1.15,.95,d)*.55-smoothstep(.85,.2,d)*.45)*step(.35,h21(i+g+9.));}return c;}
uniform float uFlip;
const vec3 MOON=vec3(-.0717,.4479,.8911);   // normalize(-.08,.5,1): down Myeongdong-gil (+z), ~27 deg above the horizon
void main(){vec4 a=uIVP*vec4(vP,1.,1.),b=uIVP*vec4(vP,-1.,1.);vec3 d=normalize(a.xyz/a.w-b.xyz/b.w);if(uFlip>.5)d.y=-d.y;
  float y=d.y;
  vec3 zen=vec3(.012,.016,.05),hi=vec3(.04,.035,.12),mid=vec3(.12,.07,.24),hor=vec3(.36,.17,.4);
  vec3 c=mix(hor,mid,smoothstep(-.02,.14,y));c=mix(c,hi,smoothstep(.12,.45,y));c=mix(c,zen,smoothstep(.4,.95,y));
  float az=atan(d.z,d.x);c+=vec3(.36,.08,.32)*exp(-max(y,0.)*12.)*(.6+.4*sin(az*2.+1.));
  c+=vec3(.16,.22,.55)*exp(-max(y,0.)*6.)*.35;
  // ---- giant violet full moon (procedural lunar surface: maria, craters, grain, limb darkening) ----
  float md=dot(d,MOON);float R=.098;float ang=acos(clamp(md,-1.,1.));
  vec3 mr=normalize(cross(vec3(0,1,0),MOON)),mu=cross(MOON,mr);
  vec2 mp=vec2(dot(d,mr),dot(d,mu))/R;float r2=dot(mp,mp);
  float halo=exp(-max(ang-R,0.)*9.)*.5+exp(-max(ang-R,0.)*38.)*.6;
  c+=vec3(.55,.42,.95)*halo*.5;
  float disk=0.;vec3 moon=vec3(0.);
  if(r2<1.1){float z=sqrt(max(0.,1.-r2));vec3 sn=vec3(mp,z);
    vec2 sp=vec2(atan(sn.x,sn.z)*1.4,asin(clamp(sn.y,-1.,1.))*1.4);
    float maria=smoothstep(.48,.62,fbm6(sp*1.3+vec2(3.1,1.7)));
    float cr=craters(sp*5.)*.55+craters(sp*11.+4.)*.3+craters(sp*23.+9.)*.15;
    float alb=.68-.3*maria+.22*cr+fbm6(sp*18.)*.25;
    vec3 L=normalize(vec3(-.35,.35,.87));float lam=max(dot(sn,L),0.);float limb=pow(z,.35);
    moon=mix(vec3(.58,.5,.9),vec3(.95,.9,1.08),clamp(alb,0.,1.))*(.25+.95*lam)*limb*2.3;
    disk=smoothstep(1.,.985,sqrt(r2));}
  c=mix(c,moon,disk);
  // ---- layered clouds, lit by the moon where they pass in front of it ----
  vec2 cp=d.xz/(max(y,.03)+.16);float t=uTime*.004;
  float c1=fbm(cp*.5+vec2(t,t*.35)),c2=fbm(cp*1.25-vec2(t*1.7,0.)+c1*.9),cv=c1*.6+c2*.55;
  float cl=smoothstep(.46,.82,cv)*smoothstep(.0,.12,y);
  float edge=(smoothstep(.44,.6,cv)-smoothstep(.6,.86,cv))*smoothstep(.02,.25,y);
  vec3 cc=mix(vec3(.07,.05,.16),vec3(.3,.2,.5),smoothstep(.0,.55,1.-y));
  float nearMoon=exp(-max(ang-R*.6,0.)*6.);
  cc+=vec3(.55,.45,.95)*nearMoon*.6;
  c=mix(c,cc,cl*.8*(1.-disk*.45));c+=vec3(.6,.42,1.)*edge*(.1+.5*nearMoon);
  float st=step(.9993,h21(floor(d.xz/(y+.2)*220.)))*smoothstep(.5,.85,y)*(1.-cl)*(1.-min(1.,halo));c+=st*.25;
  if(y<0.)c=uFogA;o=vec4(c,1.);}`;
const POST_VS=`#version 300 es
layout(location=0)in vec2 aP;out vec2 vU;void main(){vU=aP*.5+.5;gl_Position=vec4(aP,0.,1.);}`;
const BRIGHT_FS=`#version 300 es
precision highp float;in vec2 vU;uniform sampler2D uT;uniform vec2 uD;out vec4 o;
vec3 tap(vec2 q){vec3 c=min(texture(uT,q).rgb,vec3(30.));if(any(isnan(c)))c=vec3(0.);float l=max(c.r,max(c.g,c.b));c*=smoothstep(.75,2.2,l);return c/(1.+dot(c,vec3(.2126,.7152,.0722)));}
void main(){ // each bilinear tap averages 2x2 texels -> 4 taps cover the whole 4x4 footprint of a bloom texel (no undersampling shimmer)
  vec3 s=tap(vU+uD*vec2(-1.,-1.))+tap(vU+uD*vec2(1.,-1.))+tap(vU+uD*vec2(-1.,1.))+tap(vU+uD*vec2(1.,1.));s*=.25;
  o=vec4(s/max(1e-4,1.-dot(s,vec3(.2126,.7152,.0722))),1.);}`;
const BLUR_FS=`#version 300 es
precision highp float;in vec2 vU;uniform sampler2D uT;uniform vec2 uD;out vec4 o;
void main(){vec3 s=texture(uT,vU).rgb*.227;s+=(texture(uT,vU+uD*1.384).rgb+texture(uT,vU-uD*1.384).rgb)*.316;s+=(texture(uT,vU+uD*3.23).rgb+texture(uT,vU-uD*3.23).rgb)*.07;o=vec4(s,1.);}`;
const COMP_FS=`#version 300 es
precision highp float;in vec2 vU;uniform sampler2D uT,uB1,uB2;uniform float uExp,uFade,uDim,uTime,uFlash;out vec4 o;
float h21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
vec3 aces(vec3 x){return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.,1.);}
/* FXAA (lite): edge-directed anti-aliasing on the HDR image, luma taken after a soft tonemap */
float lu(vec3 c){c=c/(1.+c);return dot(c,vec3(.299,.587,.114));}
vec3 fxaa(vec2 uv){vec2 px=1./vec2(textureSize(uT,0));
  vec3 cM=texture(uT,uv).rgb;float lM=lu(cM),lNW=lu(texture(uT,uv+vec2(-1,-1)*px).rgb),lNE=lu(texture(uT,uv+vec2(1,-1)*px).rgb),lSW=lu(texture(uT,uv+vec2(-1,1)*px).rgb),lSE=lu(texture(uT,uv+vec2(1,1)*px).rgb);
  float mn=min(lM,min(min(lNW,lNE),min(lSW,lSE))),mx=max(lM,max(max(lNW,lNE),max(lSW,lSE)));if(mx-mn<max(.03,mx*.12))return cM;
  vec2 dir=vec2(-((lNW+lNE)-(lSW+lSE)),((lNW+lSW)-(lNE+lSE)));float red=max((lNW+lNE+lSW+lSE)*.03125,1./128.);
  dir=clamp(dir/(min(abs(dir.x),abs(dir.y))+red),-8.,8.)*px;
  vec3 A=.5*(texture(uT,uv+dir*(1./3.-.5)).rgb+texture(uT,uv+dir*(2./3.-.5)).rgb);vec3 B=A*.5+.25*(texture(uT,uv-dir*.5).rgb+texture(uT,uv+dir*.5).rgb);
  float lB=lu(B);return(lB<mn||lB>mx)?A:B;}
void main(){vec3 c=fxaa(vU);vec3 b=texture(uB1,vU).rgb*.7+texture(uB2,vU).rgb*.9;
  c=(c+b*.85)*uExp;c=aces(c);
  // illustrated grade: navy-lifted shadows, lavender highlights
  float l=dot(c,vec3(.299,.587,.114));c=mix(c,c*vec3(.9,.92,1.12)+vec3(.006,.004,.02),1.-l);c=pow(c,vec3(1.06));c=mix(vec3(l),c,1.12);c=clamp(c,0.,1.);
  vec2 q=vU-.5;float vig=1.-dot(q,q)*(.55+uDim*1.4);c*=vig;c*=1.-uDim*.55;
  c+=(h21(vU*900.+uTime)-.5)*.018;
  c=mix(c,vec3(1.,.98,1.),uFlash);
  o=vec4(c*uFade,1.);}`;

function compile(gl,vs,fs){const p=gl.createProgram();[[gl.VERTEX_SHADER,vs],[gl.FRAGMENT_SHADER,fs]].forEach(([t,s])=>{const sh=gl.createShader(t);gl.shaderSource(sh,s);gl.compileShader(sh);if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(sh));gl.attachShader(p,sh)});
  gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p));
  const u={};const n=gl.getProgramParameter(p,gl.ACTIVE_UNIFORMS);for(let i=0;i<n;i++){const a=gl.getActiveUniform(p,i);const nm=a.name.replace('[0]','');u[nm]=gl.getUniformLocation(p,a.name)}return{p,u}}

CE.Renderer=class{
  constructor(canvas){
    const gl=canvas.getContext('webgl2',{antialias:false,alpha:false,powerPreference:'high-performance'});
    if(!gl)throw new Error('WebGL2 not available');
    this.gl=gl;this.cv=canvas;
    this.hdr=!!gl.getExtension('EXT_color_buffer_float');gl.getExtension('OES_texture_float_linear');
    this.main=compile(gl,VS,FS);this.skin=compile(gl,SKIN_VS,FS);this.sky=compile(gl,SKY_VS,SKY_FS);
    this.bright=compile(gl,POST_VS,BRIGHT_FS);this.blur=compile(gl,POST_VS,BLUR_FS);this.comp=compile(gl,POST_VS,COMP_FS);
    this.tri=gl.createVertexArray();gl.bindVertexArray(this.tri);const tb=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,tb);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);
    this.scale=1;this.lights=[];this.fogA=hex('#161830');this.fogB=hex('#454b84');this.fogD=.0115;
    this.exposure=1;this.fade=1;this.dim=0;this.flash=0;this.indoor=0;
  }
  upload(mb){const gl=this.gl;const vao=gl.createVertexArray();gl.bindVertexArray(vao);
    const vb=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,vb);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(mb.v),gl.STATIC_DRAW);
    const st=15*4;[[0,3,0],[1,3,3],[2,3,6],[3,4,9],[4,2,13]].forEach(([l,n,o])=>{gl.enableVertexAttribArray(l);gl.vertexAttribPointer(l,n,gl.FLOAT,false,st,o*4)});
    const ib=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ib);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint32Array(mb.i),gl.STATIC_DRAW);
    return{vao,count:mb.i.length}}
  uploadSkinned(a){const gl=this.gl;const vao=gl.createVertexArray();gl.bindVertexArray(vao);
    const buf=(data)=>{const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);return b};
    buf(a.pnu);[[0,3,0],[1,3,3],[4,2,6]].forEach(([l,n,o])=>{gl.enableVertexAttribArray(l);gl.vertexAttribPointer(l,n,gl.FLOAT,false,32,o*4)});
    buf(a.col);gl.enableVertexAttribArray(2);gl.vertexAttribPointer(2,3,gl.UNSIGNED_BYTE,true,4,0);
    buf(a.joint);gl.enableVertexAttribArray(5);gl.vertexAttribPointer(5,4,gl.UNSIGNED_BYTE,false,4,0);
    buf(a.weight);gl.enableVertexAttribArray(6);gl.vertexAttribPointer(6,4,gl.UNSIGNED_BYTE,true,4,0);
    gl.disableVertexAttribArray(3);
    const ib=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ib);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,a.idx,gl.STATIC_DRAW);gl.bindVertexArray(null);
    return{vao,count:a.idx.length,skinned:true}}
  texture(img,mip=true){const gl=this.gl;const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,img);
    if(mip)gl.generateMipmap(gl.TEXTURE_2D);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,mip?gl.LINEAR_MIPMAP_LINEAR:gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    const an=gl.getExtension('EXT_texture_filter_anisotropic');if(an)gl.texParameterf(gl.TEXTURE_2D,an.TEXTURE_MAX_ANISOTROPY_EXT,4);return t}
  /* bone palette: one row per character instance, 4 RGBA32F texels per bone */
  bones(data,nb,ninst){const gl=this.gl;const w=nb*4;
    if(!this.boneTex||this.boneTex.w!==w||this.boneTex.h<ninst){const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);const h=Math.max(ninst,64);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA32F,w,h,0,gl.RGBA,gl.FLOAT,null);[gl.TEXTURE_MIN_FILTER,gl.TEXTURE_MAG_FILTER].forEach(p=>gl.texParameteri(gl.TEXTURE_2D,p,gl.NEAREST));this.boneTex={t,w,h}}
    gl.bindTexture(gl.TEXTURE_2D,this.boneTex.t);gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,w,ninst,gl.RGBA,gl.FLOAT,data.subarray(0,w*ninst*4))}
  atlas(canvas){const gl=this.gl;const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,canvas);
    gl.generateMipmap(gl.TEXTURE_2D);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    const an=gl.getExtension('EXT_texture_filter_anisotropic');if(an)gl.texParameterf(gl.TEXTURE_2D,an.TEXTURE_MAX_ANISOTROPY_EXT,4);this.atlasTex=t}
  makeTarget(w,h,depth){const gl=this.gl;const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);
    gl.texImage2D(gl.TEXTURE_2D,0,this.hdr?gl.RGBA16F:gl.RGBA8,w,h,0,gl.RGBA,this.hdr?gl.HALF_FLOAT:gl.UNSIGNED_BYTE,null);
    [gl.TEXTURE_MIN_FILTER,gl.TEXTURE_MAG_FILTER].forEach(p=>gl.texParameteri(gl.TEXTURE_2D,p,gl.LINEAR));[gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T].forEach(p=>gl.texParameteri(gl.TEXTURE_2D,p,gl.CLAMP_TO_EDGE));
    const fb=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,fb);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,t,0);
    if(depth){const rb=gl.createRenderbuffer();gl.bindRenderbuffer(gl.RENDERBUFFER,rb);gl.renderbufferStorage(gl.RENDERBUFFER,gl.DEPTH_COMPONENT24,w,h);gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.RENDERBUFFER,rb)}
    return{t,fb,w,h}}
  resize(){const gl=this.gl,dpr=Math.min(devicePixelRatio||1,1.5),cw=this.cv.clientWidth||innerWidth,ch=this.cv.clientHeight||innerHeight;
    let s=dpr*this.scale;if(cw*s>1920)s=1920/cw;const w=Math.max(2,Math.round(cw*s)),h=Math.max(2,Math.round(ch*s));
    if(this.W===w&&this.H===h)return;this.W=w;this.H=h;this.cv.width=w;this.cv.height=h;
    this.rtMain=this.makeTarget(w,h,true);const bw=Math.max(2,w>>2),bh=Math.max(2,h>>2);this.rtA=this.makeTarget(bw,bh);this.rtB=this.makeTarget(bw,bh);
    const cw2=Math.max(2,w>>3),ch2=Math.max(2,h>>3);this.rtC=this.makeTarget(cw2,ch2);this.rtD=this.makeTarget(cw2,ch2);this.rtRefl=this.makeTarget(Math.max(2,w>>1),Math.max(2,h>>1),true)}
  /* frame: cam {pos,yaw,pitch,fov}, draws: [{mesh, model, tint, rim, hl, hlc}] */
  drawScene(VP,cam,time,draws,refl){
    const gl=this.gl;
    gl.disable(gl.DEPTH_TEST);gl.depthMask(false);gl.useProgram(this.sky.p);gl.uniformMatrix4fv(this.sky.u.uIVP,false,M4.inv(VP));gl.uniform1f(this.sky.u.uTime,time);gl.uniform1f(this.sky.u.uFlip,refl?1:0);
    gl.uniform3fv(this.sky.u.uFogA,this.fogA);gl.uniform3fv(this.sky.u.uFogB,this.fogB);gl.bindVertexArray(this.tri);gl.drawArrays(gl.TRIANGLES,0,3);
    gl.enable(gl.DEPTH_TEST);gl.depthMask(true);gl.enable(gl.CULL_FACE);gl.cullFace(refl?gl.FRONT:gl.BACK);
    const lit=this._lightPack(cam);
    const setup=(m)=>{const u=m.u;gl.useProgram(m.p);gl.uniformMatrix4fv(u.uVP,false,VP);gl.uniform3fv(u.uCam,refl?[cam.pos[0],-cam.pos[1],cam.pos[2]]:cam.pos);gl.uniform1f(u.uTime,time);
      gl.uniform4fv(u.uLP,lit.lp);gl.uniform3fv(u.uLC,lit.lc);gl.uniform1i(u.uNL,lit.n);
      gl.uniform3fv(u.uFogA,this.fogA);gl.uniform3fv(u.uFogB,this.fogB);gl.uniform1f(u.uFogD,this.fogD);gl.uniform1f(u.uIndoor,this.indoor);
      gl.uniform1f(u.uReflPass,refl?1:0);gl.uniform1f(u.uReflOn,(!refl&&this.reflOn)?1:0);gl.uniform2f(u.uRes,this.W,this.H);
      gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,this.atlasTex);gl.uniform1i(u.uAtlas,0);
      gl.activeTexture(gl.TEXTURE3);gl.bindTexture(gl.TEXTURE_2D,refl||!this.rtRefl?null:this.rtRefl.t);gl.uniform1i(u.uRefl,3);
      if(u.uBones){gl.activeTexture(gl.TEXTURE5);gl.bindTexture(gl.TEXTURE_2D,this.boneTex?this.boneTex.t:null);gl.uniform1i(u.uBones,5)}
      if(u.uChar)gl.uniform1i(u.uChar,4);gl.activeTexture(gl.TEXTURE0);return m};
    let prog=setup(this.main),u=prog.u;
    const I=M4.ident();let curVao=null;
    for(const d of draws){
      if(refl&&(d.noRefl||d.blend==='mul'))continue;
      const want=d.mesh.skinned?this.skin:this.main;if(want!==prog){prog=setup(want);u=prog.u;curVao=null}
      if(d.mesh.skinned){gl.uniform1i(u.uInst,d.inst|0);gl.vertexAttrib4f(3,14,0,d.mode||0,0);gl.uniform3fv(u.uTint2,d.tint2||[1,1,1]);
        gl.activeTexture(gl.TEXTURE4);gl.bindTexture(gl.TEXTURE_2D,d.tex||null);gl.activeTexture(gl.TEXTURE0)}
      if(d.poly){gl.enable(gl.POLYGON_OFFSET_FILL);gl.polygonOffset(-1,-2)}
      if(d.cull===false)gl.disable(gl.CULL_FACE);
      gl.uniformMatrix4fv(u.uModel,false,d.model||I);gl.uniform3fv(u.uTint,d.tint||[1,1,1]);gl.uniform3fv(u.uRim,d.rim||[0,0,0]);
      gl.uniform1f(u.uHL,d.hl||0);gl.uniform3fv(u.uHLC,d.hlc||[.55,.3,1]);
      if(d.mesh.vao!==curVao){gl.bindVertexArray(d.mesh.vao);curVao=d.mesh.vao}
      if(d.blend){gl.enable(gl.BLEND);if(d.blend==='mul')gl.blendFunc(gl.ZERO,gl.SRC_COLOR);else if(d.blend==='alpha')gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);else gl.blendFunc(gl.SRC_ALPHA,gl.ONE);gl.depthMask(false)}
      gl.drawElements(gl.TRIANGLES,d.count??d.mesh.count,gl.UNSIGNED_INT,(d.first||0)*4);
      if(d.blend){gl.disable(gl.BLEND);gl.depthMask(true)}
      if(d.poly)gl.disable(gl.POLYGON_OFFSET_FILL);
      if(d.cull===false)gl.enable(gl.CULL_FACE);
    }
    gl.cullFace(gl.BACK);
  }
  _lightPack(cam){if(this._lpk&&this._lpk.f===this._frame)return this._lpk;
    /* light selection. V13 took the 24 nearest lights by rank, so lights popped in/out as the camera moved
       (whole facades switched on/off = the "flashing buildings"). Now: 32 slots, and every light is faded
       continuously by its distance relative to the cut-off distance, so a light reaches zero exactly when it
       leaves the set. Ranking uses distance minus influence radius so big lights stay longer. */
    const cp=cam.pos,sel=this._lsel||(this._lsel=[]);sel.length=0;
    for(const l of this.lights){const d=Math.sqrt((l.p[0]-cp[0])**2+(l.p[1]-cp[1])**2+(l.p[2]-cp[2])**2)-l.r*1.6;sel.push([l,d])}
    sel.sort((a,b)=>a[1]-b[1]);const NL=Math.min(32,sel.length);const cut=sel.length>32?sel[32][1]:1e9;
    const lp=new Float32Array(128),lc=new Float32Array(96);let L=[];
    for(let i=0;i<NL;i++){const[l,d]=sel[i];const lo=cut-Math.max(6,Math.abs(cut)*.35);const f=cut>=1e9?1:1-Math.min(1,Math.max(0,(d-lo)/(cut-lo)));const fs=f*f*(3-2*f);
      lp.set([l.p[0],l.p[1],l.p[2],l.r],i*4);lc.set(l.c.map(x=>x*(l.k??1)*fs),i*3);L.push(l)}
    return this._lpk={lp,lc,n:NL,f:this._frame}}
  render(cam,time,draws,extra){this._frame=(this._frame||0)+1;
    const gl=this.gl;this.resize();const W=this.W,H=this.H;
    const P=M4.persp(cam.fov||1.15,W/H,.15,900),Vw=M4.view(cam.pos,cam.yaw,cam.pitch),VP=M4.mul(P,Vw);this.VP=VP;
    this.reflOn=this.reflEnabled!==false&&cam.pos[1]>.3;
    if(this.reflOn){ // planar reflection of the street (mirror about y=0) at half resolution
      gl.bindFramebuffer(gl.FRAMEBUFFER,this.rtRefl.fb);gl.viewport(0,0,this.rtRefl.w,this.rtRefl.h);gl.clearColor(0,0,0,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
      this.drawScene(M4.mul(VP,M4.S(1,-1,1)),cam,time,draws,true)}
    gl.bindFramebuffer(gl.FRAMEBUFFER,this.rtMain.fb);gl.viewport(0,0,W,H);gl.clearColor(0,0,0,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
    this.drawScene(VP,cam,time,draws,false);
    gl.enable(gl.DEPTH_TEST);
    if(extra)extra(gl,VP);
    gl.disable(gl.DEPTH_TEST);gl.disable(gl.CULL_FACE);gl.bindVertexArray(this.tri);
    // bloom
    const pass=(prog,src,dst,setup)=>{gl.bindFramebuffer(gl.FRAMEBUFFER,dst?dst.fb:null);gl.viewport(0,0,dst?dst.w:W,dst?dst.h:H);gl.useProgram(prog.p);
      gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,src.t);gl.uniform1i(prog.u.uT,0);if(setup)setup(prog.u);gl.drawArrays(gl.TRIANGLES,0,3)};
    pass(this.bright,this.rtMain,this.rtA,u=>gl.uniform2f(u.uD,1/this.rtMain.w,1/this.rtMain.h));
    pass(this.blur,this.rtA,this.rtB,u=>gl.uniform2f(u.uD,1/this.rtA.w,0));pass(this.blur,this.rtB,this.rtA,u=>gl.uniform2f(u.uD,0,1/this.rtA.h));
    pass(this.blur,this.rtA,this.rtC,u=>gl.uniform2f(u.uD,1.5/this.rtA.w,0));pass(this.blur,this.rtC,this.rtD,u=>gl.uniform2f(u.uD,1/this.rtC.w,0));pass(this.blur,this.rtD,this.rtC,u=>gl.uniform2f(u.uD,0,1/this.rtC.h));
    pass(this.comp,this.rtMain,null,u=>{gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,this.rtA.t);gl.uniform1i(u.uB1,1);gl.activeTexture(gl.TEXTURE2);gl.bindTexture(gl.TEXTURE_2D,this.rtC.t);gl.uniform1i(u.uB2,2);
      gl.uniform1f(u.uExp,this.exposure);gl.uniform1f(u.uFade,this.fade);gl.uniform1f(u.uDim,this.dim);gl.uniform1f(u.uTime,time%100);gl.uniform1f(u.uFlash,this.flash)});
    gl.activeTexture(gl.TEXTURE0);
  }
  project(p){const v=this.VP;if(!v)return null;const x=v[0]*p[0]+v[4]*p[1]+v[8]*p[2]+v[12],y=v[1]*p[0]+v[5]*p[1]+v[9]*p[2]+v[13],w=v[3]*p[0]+v[7]*p[1]+v[11]*p[2]+v[15];if(w<=.01)return null;return[(x/w*.5+.5),(1-(y/w*.5+.5)),w]}
};
})();
