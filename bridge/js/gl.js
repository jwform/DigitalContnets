/* =====================================================================
   BRIDGE — custom WebGL2 renderer (no libraries)
   background gradient · real BRIDGE.glb · chrome ribbons · particles ·
   streaks · glow · warp composite · film grain
   ===================================================================== */
(function () {
  'use strict';
  const BR = (window.BR = window.BR || {});
  const K = 3; // model scale (raw GLB units * 0.01 * K)

  /* ---------- tiny matrix lib ---------- */
  const M = {
    persp(f, a, n, fa) { const t = 1 / Math.tan(f / 2), nf = 1 / (n - fa); return new Float32Array([t / a, 0, 0, 0, 0, t, 0, 0, 0, 0, (fa + n) * nf, -1, 0, 0, 2 * fa * n * nf, 0]); },
    look(e, c) {
      let z = [e[0] - c[0], e[1] - c[1], e[2] - c[2]]; let l = Math.hypot(z[0], z[1], z[2]) || 1; z = z.map(v => v / l);
      let x = [z[2], 0, -z[0]]; l = Math.hypot(x[0], x[1], x[2]); if (l < 1e-5) { x = [1, 0, 0]; l = 1; } x = x.map(v => v / l);
      const y = [z[1] * x[2] - z[2] * x[1], z[2] * x[0] - z[0] * x[2], z[0] * x[1] - z[1] * x[0]];
      return new Float32Array([x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -(x[0] * e[0] + x[1] * e[1] + x[2] * e[2]), -(y[0] * e[0] + y[1] * e[1] + y[2] * e[2]), -(z[0] * e[0] + z[1] * e[1] + z[2] * e[2]), 1]);
    },
    mul(a, b) { const o = new Float32Array(16); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]; o[c * 4 + r] = s; } return o; },
    rotY(a) { const c = Math.cos(a), s = Math.sin(a); return new Float32Array([c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1]); },
    scale(s) { return new Float32Array([s, 0, 0, 0, 0, s, 0, 0, 0, 0, s, 0, 0, 0, 0, 1]); }
  };

  /* ---------- shaders ---------- */
  const VS_FS = `#version 300 es
void main(){vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2);gl_Position=vec4(p*2.-1.,0.,1.);}`;
  const HASH = `float h11(float n){return fract(sin(n*91.3458)*47453.5453);}
float h21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}`;
  const SH = {};

  /* --- BRIDGE model --- */
  SH.model = {
    vs: `#version 300 es
layout(location=0) in vec3 aP; layout(location=1) in vec3 aN;
uniform mat4 uVP,uM; out vec3 vW,vL,vN,vLN;
void main(){vL=aP;vLN=aN;vec4 w=uM*vec4(aP,1.);vW=w.xyz;vN=mat3(uM)*aN;gl_Position=uVP*w;}`,
    fs: `#version 300 es
precision highp float;
in vec3 vW,vL,vN,vLN; out vec4 o;
uniform vec3 uCam,uBase,uLedT,uLedB,uSpotP; uniform float uMet,uRough,uClear,uRole,uMode,uTint,uStudio,uVis,uSpill,uSpotA,uRim;
uniform sampler2D uTex;
vec3 ACES(vec3 x){return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.,1.);}
float strip(float x,float c,float w){return smoothstep(w,0.,abs(x-c));}
vec3 env(vec3 d,float r){
  float w=.08+r*.5;
  vec3 c=mix(vec3(.010,.010,.018),vec3(.06,.055,.10),smoothstep(-.4,.9,d.y));
  c+=vec3(1.,.98,1.)*1.0*strip(d.y,.88,w)*(1.-r*.6);
  c+=vec3(.85,.88,1.)*.55*strip(d.x,.82,w+.02)*smoothstep(-.4,.4,d.y);
  c+=vec3(.6,.62,.75)*.35*strip(d.x,-.85,w*.7)*smoothstep(-.4,.4,d.y);
  c+=vec3(.2,.2,.3)*.18*strip(d.z,.9,w+.1);
  c+=vec3(.4,.4,.6)*.30*strip(d.z,-.9,w+.2);
  c+=vec3(.75,.75,.9)*.30*strip(d.y,.3,.22+r*.3)*strip(d.x,-.25,.55);
  float sl=strip(d.y,.16,.05+r*.25);
  c+=vec3(.42,.34,1.)*.55*uStudio*uTint*(1.-r)*(1.-.7*uMet)*sl*(strip(d.z,.78,.9)+strip(d.z,-.78,.9));
  return c;
}
void main(){
  if(uMode>.5){vec3 c=uRole==1.?uLedT*3.:(uRole==2.?uLedB*1.3:vec3(0.));o=vec4(c*uVis,1.);return;}
  vec3 V=normalize(uCam-vW),N=normalize(vN); if(dot(N,V)<0.)N=-N;
  if(uRole>.5&&uRole<2.5){vec3 c=(uRole==1.?uLedT:uLedB*.8);o=vec4(pow(c*1.15+vec3(.06),vec3(1./2.2))*uVis,1.);return;}
  vec3 R=reflect(-V,N);float ndv=clamp(dot(N,V),0.,1.);
  vec3 F0=mix(vec3(.04),uBase,uMet);vec3 F=F0+(1.-F0)*pow(1.-ndv,5.);
  vec3 spec=env(R,uRough)*F;
  vec3 dif=uBase*(1.-uMet)*(env(N,1.)*1.6+vec3(.03));
  float dt=length(vec3(max(abs(vL.x)-.285,0.),vL.y-.2015,vL.z));
  float db=length(vec3(max(abs(vL.x)-.27,0.),vL.y-.1215,vL.z));
  vec3 spill=uLedT*.55/(1.+pow(dt*45.,2.))+uLedB*.22/(1.+pow(db*45.,2.));
  vec3 col=dif+spec+(uBase*2.+.02)*spill*1.6*uSpill;
  if(uClear>0.){col+=env(R,.03)*(.05+.95*pow(1.-ndv,5.))*uClear*1.4;}
  // rim light: cool-violet edge so the silhouette separates from the backdrop
  col+=vec3(.72,.70,.95)*pow(1.-ndv,4.6)*uRim*(.18+.30*uMet)*(1.-.75*uClear);
  // selected-part spotlight: lime pool on the part, everything else steps back
  float sd=distance(vW,uSpotP);
  col*=mix(1.,.38+.62*exp(-sd*sd*2.6),uSpotA);
  col+=vec3(.77,1.,.21)*exp(-sd*sd*70.)*uSpotA*(.10+.30*dot(spec,vec3(.33)));
  col=ACES(col);col=pow(col,vec3(1./2.2));
  if(uRole>2.5){
    float u=(vL.x+.29)/.58;if(vLN.z<0.)u=1.-u;float v=(vL.y-.12)/.07;
    vec4 t=texture(uTex,vec2(u,v));float mask=step(.5,abs(vLN.z));
    col+=t.rgb*t.a*mask*(.55+.45*pow(ndv,.5));
  }
  o=vec4(col*uVis,1.);
}`
  };

  /* --- grainy ambient gradient --- */
  SH.bg = {
    vs: VS_FS, fs: `#version 300 es
precision highp float;out vec4 o;
uniform vec2 uRes,uMouse,uModel,uFloor;uniform float uT,uScroll,uPurple,uLime,uDark,uHBand,uFloorA,uWarpBg,uDoorA,uDoorZ,uHalo,uSolid,uBeam,uWave;uniform vec3 uLed;
${HASH}
float nz(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float a=.5,s=0.;for(int i=0;i<5;i++){s+=a*nz(p);p=p*2.03+vec2(17.1,9.7);a*=.5;}return s;}
vec3 doorScene(vec2 q,float z,float t){
  vec3 c=vec3(0.);
  float bx=q.x*46.;float id=floor(bx);float f=fract(bx);float hh=h21(vec2(id,7.));
  float beam=smoothstep(.05+.25*hh,0.,abs(f-.5))*step(.28,hh);
  float fall=exp(-abs(q.x)*(3.+hh*2.5));
  float vert=smoothstep(-.2,.0,q.y)*(1.-smoothstep(.15,.95,q.y+hh*.5));
  vec3 bc=mix(vec3(.16,.35,1.),vec3(.52,.2,1.),fract(hh*7.));
  c+=bc*beam*fall*vert*(.45+.8*hh)*(1.+.3*sin(t*2.+id));
  float blk=step(.86,h21(vec2(floor(q.x*30.),floor(q.y*26.+t*.6))))*exp(-abs(q.x)*4.)*smoothstep(-.1,.2,q.y)*(1.-smoothstep(.2,.55,q.y));
  c+=vec3(.7,.6,1.)*blk*.35;
  vec2 dq=vec2(abs(q.x)-.105,abs(q.y)-.19);
  float sd=length(max(dq,0.))+min(max(dq.x,dq.y),0.);
  float edge=exp(-abs(sd)*z*70.);
  float ins=smoothstep(.002,-.004,sd);
  vec3 fill=mix(vec3(.30,.05,.62),vec3(.62,.24,.92),clamp((q.y+.19)/.38,0.,1.))*.72;
  c+=fill*ins*.85+vec3(1.,.9,1.)*edge*1.3+vec3(.8,.3,1.)*exp(-max(sd,0.)*z*9.)*.35;
  return c;
}
vec3 doorFx(vec2 uv,float asp,float z,float t){
  vec2 q=(uv-vec2(.5,.47))*vec2(asp,1.)/z;
  vec3 c=doorScene(q,z,t);
  float fl=-.19;
  if(q.y<fl){float d=fl-q.y;c=doorScene(vec2(q.x,2.*fl-q.y),z,t)*exp(-d*7.)*.6;
    float gz=.03/(d+.004);float gx=q.x/(d+.01);
    float g=smoothstep(.05,0.,abs(fract(gx*.35)-.5)-.45)+smoothstep(.04,0.,abs(fract(gz*.4-t*.1)-.5)-.46);
    c+=vec3(.5,.25,1.)*g*exp(-d*5.)*.18;}
  return c;
}

void main(){
  vec2 uv=gl_FragCoord.xy/uRes;float asp=uRes.x/uRes.y;
  vec2 p=(uv-.5)*vec2(asp,1.)*1.5;p.y+=uScroll*.4;p+=uMouse*.05;
  float t=uT*(.05+uWarpBg*.04);
  vec2 q=vec2(fbm(p+vec2(0.,t)),fbm(p+vec2(5.2,1.3)-t));
  vec2 r=vec2(fbm(p+3.*q+vec2(1.7,9.2)+t*.8),fbm(p+3.*q+vec2(8.3,2.8)-t*.7));
  float f=fbm(p+3.*r);
  float n=h21(gl_FragCoord.xy+fract(uT*7.)*113.);
  vec3 base=vec3(.067,.071,.086),graph=vec3(.188,.192,.216),pur=vec3(.463,.157,.961),lime=vec3(.773,1.,.208);
  vec3 col=base;
  col=mix(col,graph,smoothstep(.3,.75,r.x)*.3);
  float m=smoothstep(.42,.86,f+(n-.5)*.12);
  float edge=smoothstep(.3,.6,f)*(1.-smoothstep(.6,.9,f));
  col+=pur*(m*.5+edge*.12)*uPurple;
  col+=vec3(.12,.2,.8)*smoothstep(.5,.9,fbm(p*.8+r*2.+7.))*.22*uPurple;
  float l=smoothstep(.66,.9,fbm(p*1.15+q*2.+vec2(3.,t*2.))+(n-.5)*.16);
  col+=lime*l*.34*uLime*smoothstep(-.1,.9,uv.x*.5+(1.-uv.y)*.7);
  float md=length((uv-uMouse*.5-.5)*vec2(asp,1.));col+=pur*exp(-md*md*7.)*.1;
  vec2 d=(uv-uModel)*vec2(asp,1.);float rr=length(d);
  col+=uLed*exp(-rr*rr*2.4)*.05;
  vec2 fd=(uv-uFloor)*vec2(asp,1.)*vec2(.8,3.4);col+=uLed*exp(-dot(fd,fd)*8.)*.14*uFloorA;
  float hb=exp(-pow((uv.y-.47-.04*sin(uT*.3))/.03,2.))*(1.-smoothstep(.25,.75,abs(uv.x-.5)));
  col+=vec3(.26,.18,1.)*hb*uHBand*.55;
  // product halo (soft light pool behind the object) + flat dark mode for quiet sections
  col+=mix(vec3(.50,.46,.72),uLed,.35)*exp(-rr*rr*3.2)*uHalo*.20;
  col=mix(col,base*1.05+pur*.02*exp(-rr*rr*2.),uSolid);
  if(uBeam>.001){
    // studio rig: soft key cone from above, haze in the beam, light pool on the floor, quiet cyclorama behind
    float asp2=asp;float topY=1.18;float span=max(.2,topY-uFloor.y);
    float k=clamp((topY-uv.y)/span,0.,1.4);
    float hw=mix(.06,.40,k);
    float dx=(uv.x-uModel.x)*asp2;
    float cone=smoothstep(hw,hw*.15,abs(dx))*smoothstep(0.,.35,k)*(1.-smoothstep(1.,1.35,k));
    float haze=.55+.45*fbm(vec2(dx*3.,uv.y*2.6-uT*.04));
    col+=vec3(.80,.82,1.)*cone*cone*haze*.15*uBeam;
    vec2 pd=(uv-vec2(uModel.x,uFloor.y-.015))*vec2(asp2,1.)*vec2(.72,3.3);
    col+=vec3(.86,.86,1.)*exp(-dot(pd,pd)*5.)*.34*uBeam;
    col+=vec3(.55,.45,1.)*exp(-dot(pd,pd)*.9)*.10*uBeam;
    float cy=length(vec2(dx*.8,(uv.y-uModel.y)*1.1));
    col+=vec3(.20,.20,.26)*exp(-cy*cy*5.)*.28*uBeam;
    col*=1.-.30*uBeam*smoothstep(.0,.55,length(vec2(dx*.7,uv.y-uModel.y-.05)));
  }
  if(uWave>.001){
    float wv=0.;
    for(int i=0;i<7;i++){float fi=float(i);
      float y=.18+fi*.105+.055*sin(uv.x*asp*(1.6+fi*.22)+uT*.32+fi*1.7)+.028*sin(uv.x*asp*5.2-uT*.5+fi*2.3)+(uMouse.y*.04)*sin(fi+uT*.2);
      float dd=abs(uv.y-y);wv+=exp(-dd*dd*30000.)*.9+exp(-dd*dd*500.)*.07;}
    col+=mix(pur*1.5,lime,smoothstep(.25,.95,uv.x+.15*sin(uT*.2)))*wv*uWave*.32;
  }
  col*=1.-.55*uDoorA;
  if(uDoorA>.001){col+=doorFx(uv,asp,uDoorZ,uT)*uDoorA;}
  col*=1.-uDark*.65;
  col*=1.-.55*smoothstep(.55,1.15,length((uv-.5)*vec2(asp*.7,1.)));
  float lum=dot(col,vec3(.3,.6,.1));col+=(n-.5)*.04*smoothstep(0.,.25,lum);
  o=vec4(col,1.);
}`
  };

  /* --- chrome ribbons (procedural, instanced strips) --- */
  SH.rib = {
    vs: `#version 300 es
precision highp float;
uniform mat4 uVP;uniform float uT,uCamZ,uSegs;uniform vec2 uMouseW;
out vec3 vN,vW;out float vS,vId;
${HASH}
vec3 curve(float s,float id){
  float t=uT;
  float r=.55+h11(id+3.)*1.7;r*=1.+.35*sin(s*5.+t*.35+id*2.);
  float th=id*.83+s*(2.2+h11(id)*1.8)+t*(.10+.05*h11(id+1.))+.6*sin(s*3.+id);
  vec3 p=vec3(r*cos(th),r*sin(th)*.75-.05,-.7-s*18.+1.3*sin(s*2.+id+t*.2));
  p.xy+=uMouseW*vec2(1.3,.8)*exp(-pow((p.z-uCamZ+2.6)/3.2,2.));
  return p;
}
void main(){
  float id=float(gl_InstanceID);float seg=float(gl_VertexID>>1)/uSegs;float side=float(gl_VertexID&1)*2.-1.;
  vec3 c=curve(seg,id);vec3 c2=curve(seg+.004,id);vec3 T=normalize(c2-c);
  vec3 N0=normalize(cross(T,vec3(0.,1.,.2)));vec3 B0=cross(T,N0);
  float ph=seg*(5.+h11(id+9.)*4.)+id+uT*.25;
  vec3 W=cos(ph)*N0+sin(ph)*B0;
  float hw=(.07+h11(id+5.)*.2)*pow(sin(3.14159*seg),.6)*(1.+.4*sin(seg*9.+id));
  vec3 pos=c+W*side*hw;
  vN=normalize(cross(T,W));vW=pos;vS=seg;vId=id;
  gl_Position=uVP*vec4(pos,1.);
}`,
    fs: `#version 300 es
precision highp float;
in vec3 vN,vW;in float vS,vId;out vec4 o;
uniform vec3 uCam;uniform float uLime,uA,uT;
float bnd(float x,float c,float w){return pow(max(0.,1.-abs(x-c)/w),2.);}
vec3 chrome(vec3 R,float id){
  float y=R.y*.5+.5;
  vec3 c=mix(vec3(.008,.008,.03),vec3(.16,.12,.40),smoothstep(0.,1.,y));
  c+=vec3(.95,.95,1.)*bnd(R.y,.5,.16)*1.5;
  c+=vec3(.46,.16,.96)*2.4*bnd(R.x,.55,.35);
  c+=vec3(.15,.25,1.)*1.4*bnd(R.x,-.6,.3);
  c+=mix(vec3(.5,.55,1.),vec3(.773,1.,.208),uLime)*1.5*bnd(R.z+R.y*.3,.55,.22)*(.5+.5*sin(id*2.));
  c+=vec3(.8,.8,1.)*bnd(R.y,-.35,.1)*.7;
  return c;
}
void main(){
  vec3 V=normalize(uCam-vW);vec3 N=normalize(vN);if(dot(N,V)<0.)N=-N;
  vec3 R=reflect(-V,N);float ndv=clamp(dot(N,V),0.,1.);
  vec3 c=chrome(R,vId)*(.35+.65*pow(1.-ndv,.8))+vec3(.4,.3,1.)*pow(1.-ndv,3.)*.5;
  c=pow(clamp(c*1.5/(c*1.5+.55),0.,1.),vec3(.95));
  float a=smoothstep(0.,.1,vS)*(1.-smoothstep(.78,1.,vS));
  a*=exp(-length(uCam-vW)*.05)*uA*1.25;
  o=vec4(c,a);
}`
  };

  /* --- particles --- */
  SH.part = {
    vs: `#version 300 es
precision highp float;
uniform mat4 uVP;uniform float uT,uPx,uFlow,uLime;out float vA;out vec3 vC;
${HASH}
void main(){
  float id=float(gl_VertexID);
  vec3 p=vec3(h11(id)-.5,h11(id+7.)-.5,h11(id+13.));
  p*=vec3(10.,5.5,24.);
  p.x+=sin(uT*.15+id)*.15;p.y+=cos(uT*.12+id*1.3)*.15;
  p.z=3.-mod(p.z+uFlow,24.);
  float sz=.010+h11(id+21.)*.028;
  vec4 c=uVP*vec4(p,1.);
  gl_Position=c;gl_PointSize=max(1.5,sz*uPx/max(c.w,.1));
  float k=h11(id+31.);
  vC=k<.18?vec3(.773,1.,.208)*(.4+uLime):(k<.6?vec3(.62,.42,1.):vec3(.85,.87,1.));
  vA=(.35+.65*h11(id+41.))*smoothstep(0.,.6,c.w)*exp(-c.w*.045);
}`,
    fs: `#version 300 es
precision highp float;in float vA;in vec3 vC;out vec4 o;uniform float uA;
void main(){vec2 d=gl_PointCoord-.5;float r=length(d);float a=smoothstep(.5,0.,r);o=vec4(vC*a*vA*uA*1.4,1.);}`
  };

  /* --- light streaks (space distortion) --- */
  SH.strk = {
    vs: `#version 300 es
precision highp float;
uniform mat4 uVP;uniform float uT,uFlow,uSpeed,uLime;out float vA;out vec3 vC;
${HASH}
void main(){
  float id=float(gl_VertexID>>1);float end=float(gl_VertexID&1);
  float a=h11(id)*6.2832;float r=.25+pow(h11(id+3.),.7)*3.4;
  vec3 p=vec3(cos(a)*r,sin(a)*r*.7,0.);
  float zz=3.-mod(h11(id+9.)*24.+uFlow*1.3+uT*.4,24.);
  p.z=zz;
  float len=.35+uSpeed*5.5+h11(id+17.)*.5;
  p.z+=end*len;
  vec4 c=uVP*vec4(p,1.);gl_Position=c;
  float k=h11(id+29.);
  vC=k<.14?vec3(.773,1.,.208)*(.3+uLime):(k<.7?vec3(.52,.3,1.):vec3(.9,.9,1.));
  vA=(1.-end)*(.4+.6*h11(id+37.))*smoothstep(0.,.5,c.w)*exp(-c.w*.05);
}`,
    fs: `#version 300 es
precision highp float;in float vA;in vec3 vC;out vec4 o;uniform float uA;
void main(){o=vec4(vC*vA*uA*1.2,1.);}`
  };


  /* --- food tray (ACT04 READY) --- */
  SH.food = {
    vs: `#version 300 es
layout(location=0) in vec3 aP; layout(location=1) in vec3 aN;
uniform mat4 uVP,uM; out vec3 vN,vW;
void main(){vec4 w=uM*vec4(aP,1.);vW=w.xyz;vN=mat3(uM)*aN;gl_Position=uVP*w;}`,
    fs: `#version 300 es
precision highp float;in vec3 vN,vW;out vec4 o;uniform vec3 uCol,uCam;uniform float uMet,uRough;
void main(){vec3 N=normalize(vN),V=normalize(uCam-vW),L=normalize(vec3(.35,.9,.7)),H=normalize(L+V);
  float d=max(dot(N,L),0.);float sp=pow(max(dot(N,H),0.),mix(90.,10.,uRough));
  float rim=pow(1.-max(dot(N,V),0.),3.);
  vec3 c=uCol*(vec3(.20,.15,.30)+d*vec3(1.,.92,.82)*1.15)+vec3(1.)*sp*(.35+.6*uMet)+vec3(.55,.3,1.)*rim*.5;
  c=c/(1.+c*.35);o=vec4(pow(c,vec3(1./2.2)),1.);}`
  };

  SH.blur = {
    vs: VS_FS, fs: `#version 300 es
precision highp float;out vec4 o;uniform sampler2D uT;uniform vec2 uDir,uSz;
void main(){vec2 uv=gl_FragCoord.xy/uSz;float w[5]=float[](.227,.194,.122,.054,.016);vec3 c=texture(uT,uv).rgb*w[0];
for(int i=1;i<5;i++){vec2 off=uDir*float(i)/uSz;c+=texture(uT,uv+off).rgb*w[i];c+=texture(uT,uv-off).rgb*w[i];}o=vec4(c,1.);}`
  };

  /* --- composite: warp / chroma / glow / grain / fade --- */
  SH.comp = {
    vs: VS_FS, fs: `#version 300 es
precision highp float;out vec4 o;
uniform sampler2D uScene,uGlow;uniform vec2 uSz,uCenter;uniform float uT,uWarp,uFlash,uFade,uGlowAmt;
${HASH}
void main(){
  vec2 uv=gl_FragCoord.xy/uSz;vec2 d=uv-uCenter;vec3 c;
  if(uWarp<.004){c=texture(uScene,uv).rgb;}
  else{
    float wb=uWarp*.010*sin(uv.y*14.+uT*2.2+length(d)*9.);
    vec2 u2=uv+vec2(wb,0.);
    float ch=uWarp*.022;vec3 s=vec3(0.);
    for(int i=0;i<10;i++){float k=float(i)/9.;vec2 q=u2-d*(k*uWarp*.24);
      s+=vec3(texture(uScene,q+d*ch).r,texture(uScene,q).g,texture(uScene,q-d*ch).b);}
    c=s/10.;
  }
  c+=texture(uGlow,uv).rgb*uGlowAmt;
  c+=vec3(.7,.6,1.)*uFlash*(1.-length(d)*.8);
  c*=1.-uFade;
  float n=h21(gl_FragCoord.xy+floor(uT*24.)*37.1);
  c+=(n-.5)*.035;
  o=vec4(c,1.);
}`
  };

  /* ---------- state ---------- */
  let gl = null, G = null, canvas = null;
  let VP = new Float32Array(16), MM = new Float32Array(16), EYE = [0, 0, 5];
  const Q = { ok: false, modelReady: false, particles: 2200, samples: 4, dpr: 1 };
  BR.state = Q;

  function mk(type, src) {
    const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) + '\n' + src.slice(0, 60));
    return s;
  }
  function prog(d) {
    const p = gl.createProgram(); gl.attachShader(p, mk(gl.VERTEX_SHADER, d.vs)); gl.attachShader(p, mk(gl.FRAGMENT_SHADER, d.fs)); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) { const a = gl.getActiveUniform(p, i); u[a.name] = gl.getUniformLocation(p, a.name); }
    return { p, u };
  }
  function mkTex(w, h) {
    const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }
  function fboTex(w, h, depth) {
    const t = mkTex(w, h), f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
    let d = null; if (depth) { d = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, d); gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, w, h); gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, d); }
    return { t, f, d };
  }


  function mkMesh(P, N, I) {
    const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
    [[P, 0], [N, 1]].forEach(([a, l]) => { const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(a), gl.STATIC_DRAW); gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, 3, gl.FLOAT, false, 0, 0); });
    const ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(I), gl.STATIC_DRAW);
    gl.bindVertexArray(null); return { vao, n: I.length };
  }
  function buildFoodMeshes() {
    const P = [], N = [], I = [], A = 20, B = 14;
    for (let j = 0; j <= B; j++) for (let i = 0; i <= A; i++) { const th = j / B * Math.PI, ph = i / A * Math.PI * 2, x = Math.sin(th) * Math.cos(ph), y = Math.cos(th), z = Math.sin(th) * Math.sin(ph); P.push(x, y, z); N.push(x, y, z); }
    for (let j = 0; j < B; j++) for (let i = 0; i < A; i++) { const a = j * (A + 1) + i, b = a + A + 1; I.push(a, b, a + 1, b, b + 1, a + 1); }
    G.sphere = mkMesh(P, N, I);
    const cp = [], cn = [], ci = []; const f = [[[1, 0, 0], [0, 1, 0], [0, 0, 1]], [[-1, 0, 0], [0, 0, 1], [0, 1, 0]], [[0, 1, 0], [0, 0, 1], [1, 0, 0]], [[0, -1, 0], [1, 0, 0], [0, 0, 1]], [[0, 0, 1], [1, 0, 0], [0, 1, 0]], [[0, 0, -1], [0, 1, 0], [1, 0, 0]]];
    f.forEach(([n, u, v], k) => { [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([a, b]) => { cp.push(n[0] + u[0] * a + v[0] * b, n[1] + u[1] * a + v[1] * b, n[2] + u[2] * a + v[2] * b); cn.push(...n); }); ci.push(k * 4, k * 4 + 1, k * 4 + 2, k * 4, k * 4 + 2, k * 4 + 3); });
    G.cube = mkMesh(cp, cn, ci);
  }
  function TRS(t, s) { return new Float32Array([s[0], 0, 0, 0, 0, s[1], 0, 0, 0, 0, s[2], 0, t[0], t[1], t[2], 1]); }
  function drawFood(S) {
    if (!(S.food > .002)) return;
    const u = G.food.u, e = S.food * S.food * (3 - 2 * S.food), z = -1.5 + e * 2.35, y = -.2 + Math.sin(S.t * 2.4) * .004 * e;
    gl.useProgram(G.food.p); gl.uniformMatrix4fv(u.uVP, false, VP); gl.uniform3fv(u.uCam, EYE);
    const part = (mesh, t, sc, col, met, rough) => { gl.uniformMatrix4fv(u.uM, false, TRS([t[0], t[1] + y, t[2] + z], sc)); gl.uniform3fv(u.uCol, col); gl.uniform1f(u.uMet, met); gl.uniform1f(u.uRough, rough); gl.bindVertexArray(mesh.vao); gl.drawElements(gl.TRIANGLES, mesh.n, gl.UNSIGNED_SHORT, 0); };
    part(G.cube, [0, 0, 0], [.33, .018, .2], [.74, .76, .82], 1, .28);
    part(G.cube, [0, .03, 0], [.3, .022, .17], [.62, .42, .22], 0, .8);   // paper boat
    for (let i = 0; i < 6; i++) { const cx = (i % 3 - 1) * .18, cz = (i < 3 ? -.06 : .07); part(G.sphere, [cx, .12, cz], [.083, .08, .083], [.86, .52, .17], 0, .55); part(G.sphere, [cx, .19, cz], [.052, .014, .052], [.2, .08, .05], 0, .2); part(G.cube, [cx + .02, .21, cz + .01], [.012, .004, .012], [.4, .8, .2], 0, .6); }
    gl.bindVertexArray(null);
  }

  BR.init = function (cv, opts) {
    canvas = cv; opts = opts || {};
    gl = cv.getContext('webgl2', { antialias: false, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: !!opts.preserve });
    if (!gl) return false;
    try {
      G = { vao: gl.createVertexArray(), meshes: [], tgt: [] };
      ['bg', 'model', 'rib', 'part', 'strk', 'food', 'blur', 'comp'].forEach(k => G[k] = prog(SH[k]));
      Q.particles = opts.particles || 2200;
      const ms = gl.getParameter(gl.MAX_SAMPLES) || 0; Q.samples = Math.min(opts.samples || 4, ms);
      // display texture placeholder
      G.disp = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, G.disp);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 0]));
      buildFoodMeshes(); Q.ok = true;
    } catch (e) { console.error('[BRIDGE gl]', e); return false; }
    return true;
  };

  BR.resize = function (w, h, dpr) {
    if (!Q.ok) return;
    Q.dpr = dpr; canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    const W = canvas.width, H = canvas.height;
    G.W = W; G.H = H;
    const dead = f => { if (!f) return; gl.deleteTexture(f.t); gl.deleteFramebuffer(f.f); if (f.d) gl.deleteRenderbuffer(f.d); };
    dead(G.res); dead(G.g0); dead(G.g1); if (G.ms) { gl.deleteFramebuffer(G.ms.f); gl.deleteRenderbuffer(G.ms.c); gl.deleteRenderbuffer(G.ms.d); G.ms = null; }
    G.res = fboTex(W, H, !Q.samples);
    G.gw = Math.max(8, W >> 1); G.gh = Math.max(8, H >> 1);
    G.g0 = fboTex(G.gw, G.gh, true); G.g1 = fboTex(G.gw, G.gh, false);
    if (Q.samples > 0) {
      const f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f);
      const c = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, c); gl.renderbufferStorageMultisample(gl.RENDERBUFFER, Q.samples, gl.RGBA8, W, H);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, c);
      const d = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, d); gl.renderbufferStorageMultisample(gl.RENDERBUFFER, Q.samples, gl.DEPTH_COMPONENT16, W, H);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, d);
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) { console.warn('[BRIDGE gl] MSAA unavailable'); Q.samples = 0; gl.deleteFramebuffer(f); G.res = fboTex(W, H, true); }
      else G.ms = { f, c, d };
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  };

  /* ---------- GLB loading ---------- */
  BR.loadModel = function (buf) {
    const dv = new DataView(buf);
    const jl = dv.getUint32(12, true);
    const json = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 20, jl)));
    const bo = 20 + jl + 8;
    const acc = i => {
      const a = json.accessors[i], bv = json.bufferViews[a.bufferView]; const off = bo + (bv.byteOffset || 0) + (a.byteOffset || 0);
      const n = a.count * ({ VEC3: 3, VEC2: 2, SCALAR: 1 }[a.type]);
      return a.componentType === 5126 ? new Float32Array(buf, off, n) : (a.componentType === 5125 ? new Uint32Array(buf, off, n) : new Uint16Array(buf, off, n));
    };
    json.meshes.forEach((m, mi) => {
      const pr = m.primitives[0], mat = json.materials[pr.material], pbr = mat.pbrMetallicRoughness || {};
      const pa = json.accessors[pr.attributes.POSITION];
      const mn = pa.min.map(v => v * .01), mx = pa.max.map(v => v * .01);
      const P = acc(pr.attributes.POSITION).slice(); for (let i = 0; i < P.length; i++) P[i] *= .01;
      const N = acc(pr.attributes.NORMAL), I = acc(pr.indices);
      const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
      const b1 = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b1); gl.bufferData(gl.ARRAY_BUFFER, P, gl.STATIC_DRAW); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
      const b2 = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b2); gl.bufferData(gl.ARRAY_BUFFER, N, gl.STATIC_DRAW); gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);
      const b3 = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, b3); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, I, gl.STATIC_DRAW);
      const isLight = /Light/i.test(mat.name || '') || /조명/.test(m.name || '');
      const cy = (mn[1] + mx[1]) / 2, w = mx[0] - mn[0], h = mx[1] - mn[1];
      let role = 0, tint = 1, spill = 1;
      if (isLight) role = cy > .16 ? 1 : 2;
      else if (w > .6) { tint = 0; spill = .35; }                      // frame (legs): neutral reflections only
      else if (Math.abs(w - .58) < .03 && Math.abs(h - .07) < .02) role = 3; // display
      G.meshes.push({
        vao, count: I.length, itype: I instanceof Uint32Array ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT, role, tint, spill,
        base: (pbr.baseColorFactor || [1, 1, 1]).slice(0, 3), met: pbr.metallicFactor == null ? 1 : pbr.metallicFactor, rough: pbr.roughnessFactor == null ? 1 : pbr.roughnessFactor,
        clear: mat.extensions && mat.extensions.KHR_materials_clearcoat ? mat.extensions.KHR_materials_clearcoat.clearcoatFactor : 0
      });
    });
    gl.bindVertexArray(null); Q.modelReady = true;
  };

  /* display texture (canvas 2D -> emissive on the real display mesh) */
  BR.setDisplay = function (cv) {
    if (!Q.ok) return;
    gl.bindTexture(gl.TEXTURE_2D, G.disp); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, cv); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.generateMipmap(gl.TEXTURE_2D); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  };

  /* ---------- helpers ---------- */
  function drawModel(S, mode) {
    const u = G.model.u; gl.useProgram(G.model.p);
    gl.uniformMatrix4fv(u.uVP, false, VP); gl.uniformMatrix4fv(u.uM, false, MM); gl.uniform3fv(u.uCam, EYE);
    gl.uniform3fv(u.uLedT, S.ledT); gl.uniform3fv(u.uLedB, S.ledB); gl.uniform1f(u.uMode, mode); gl.uniform1f(u.uStudio, S.studio); gl.uniform1f(u.uVis, S.vis);
    const sp = S.spot || [0, 0, 0]; gl.uniform3f(u.uSpotP, sp[0], sp[1], sp[2]); gl.uniform1f(u.uSpotA, S.spotA || 0); gl.uniform1f(u.uRim, S.rim == null ? 0 : S.rim);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, G.disp); gl.uniform1i(u.uTex, 0);
    G.meshes.forEach(m => {
      if (mode === 1 && m.role !== 1 && m.role !== 2) return;
      gl.uniform3fv(u.uBase, m.base); gl.uniform1f(u.uMet, m.met); gl.uniform1f(u.uRough, m.rough); gl.uniform1f(u.uClear, m.clear);
      gl.uniform1f(u.uRole, m.role); gl.uniform1f(u.uTint, m.tint); gl.uniform1f(u.uSpill, m.spill);
      gl.bindVertexArray(m.vao); gl.drawElements(gl.TRIANGLES, m.count, m.itype, 0);
    });
    gl.bindVertexArray(null);
  }
  function drawFx(S, glowPass) {
    // streaks + particles (additive)
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE); gl.depthMask(false);
    if (S.strk > .01) {
      const u = G.strk.u; gl.useProgram(G.strk.p); gl.uniformMatrix4fv(u.uVP, false, VP);
      gl.uniform1f(u.uT, S.t); gl.uniform1f(u.uFlow, S.flow); gl.uniform1f(u.uSpeed, S.speed); gl.uniform1f(u.uLime, S.lime); gl.uniform1f(u.uA, S.strk * (glowPass ? 1.2 : 1));
      gl.bindVertexArray(G.vao); gl.drawArrays(gl.LINES, 0, 900);
    }
    if (S.part > .01) {
      const u = G.part.u; gl.useProgram(G.part.p); gl.uniformMatrix4fv(u.uVP, false, VP);
      gl.uniform1f(u.uT, S.t); gl.uniform1f(u.uFlow, S.flow); gl.uniform1f(u.uLime, S.lime); gl.uniform1f(u.uA, S.part);
      gl.uniform1f(u.uPx, G.H / (2 * Math.tan(S.fov * Math.PI / 360)) * (glowPass ? .5 : 1));
      gl.bindVertexArray(G.vao); gl.drawArrays(gl.POINTS, 0, Q.particles);
    }
    gl.depthMask(true); gl.disable(gl.BLEND);
  }

  BR.proj = function (p) { // model-space (raw*.01) -> ndc
    const x = p[0], y = p[1], z = p[2];
    const wx = MM[0] * x + MM[4] * y + MM[8] * z + MM[12], wy = MM[1] * x + MM[5] * y + MM[9] * z + MM[13], wz = MM[2] * x + MM[6] * y + MM[10] * z + MM[14];
    const c = [0, 1, 2, 3].map(r => VP[r] * wx + VP[4 + r] * wy + VP[8 + r] * wz + VP[12 + r]);
    return { x: c[0] / c[3], y: c[1] / c[3], w: c[3], wx, wy, wz };
  };
  BR.eye = () => EYE;
  BR.modelMat = () => MM;

  /* ---------- frame ---------- */
  BR.render = function (S) {
    if (!Q.ok || !G.W) return;
    const W = G.W, H = G.H, asp = W / H;
    const mult = asp < 1.6 ? Math.pow(1.78 / asp, .62) : 1;
    // keep camera direction, push back on portrait screens (only when looking at the model)
    const e = S.eye.slice(), t = S.tg;
    if (S.fit > .01 && asp < 1.6) { const m2 = 1 + (mult - 1) * Math.min(1, S.fit); for (let i = 0; i < 3; i++) e[i] = t[i] + (e[i] - t[i]) * m2; }
    EYE = e;
    const V = M.look(e, t);
    VP = M.mul(M.persp(S.fov * Math.PI / 180, asp, .04, 80), V);
    MM = M.mul(M.rotY(S.rot * Math.PI / 180), M.scale(K));
    const mo = BR.proj([0, 0, 0]), fl = BR.proj([0, -.2 * 1, 0]);
    const mouse = S.mouse;
    const msF = G.ms ? G.ms.f : G.res.f;

    gl.bindVertexArray(G.vao);
    gl.bindFramebuffer(gl.FRAMEBUFFER, msF); gl.viewport(0, 0, W, H);
    gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND); gl.depthMask(true);
    gl.clearColor(.067, .071, .086, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    // 1 background
    let u = G.bg.u; gl.useProgram(G.bg.p);
    gl.uniform2f(u.uRes, W, H); gl.uniform1f(u.uT, S.t); gl.uniform1f(u.uScroll, S.scroll); gl.uniform2f(u.uMouse, mouse[0] * .5, mouse[1] * -.5);
    gl.uniform1f(u.uPurple, S.purple); gl.uniform1f(u.uLime, S.lime); gl.uniform1f(u.uDark, S.dark); gl.uniform1f(u.uHBand, S.hband); gl.uniform1f(u.uHalo, S.halo || 0); gl.uniform1f(u.uSolid, S.solid || 0); gl.uniform1f(u.uBeam, S.beam || 0); gl.uniform1f(u.uWave, S.wave || 0);
    gl.uniform1f(u.uFloorA, S.floor); gl.uniform1f(u.uWarpBg, S.warp); gl.uniform1f(u.uDoorA, S.doorA || 0); gl.uniform1f(u.uDoorZ, S.doorZ || 1);
    gl.uniform2f(u.uModel, S.vis > .05 ? mo.x * .5 + .5 : .5, S.vis > .05 ? mo.y * .5 + .5 : .5); gl.uniform2f(u.uFloor, fl.x * .5 + .5, fl.y * .5 + .5);
    gl.uniform3fv(u.uLed, S.ledT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL);
    // 2 model
    if (Q.modelReady && S.vis > .003) drawModel(S, 0);
    drawFood(S);
    // 3 ribbons
    if (S.rib > .01) {
      gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false);
      u = G.rib.u; gl.useProgram(G.rib.p); gl.uniformMatrix4fv(u.uVP, false, VP); gl.uniform3fv(u.uCam, EYE);
      gl.uniform1f(u.uT, S.t); gl.uniform1f(u.uCamZ, S.eye[2]); gl.uniform1f(u.uSegs, 140); gl.uniform2f(u.uMouseW, mouse[0], mouse[1]);
      gl.uniform1f(u.uLime, S.lime); gl.uniform1f(u.uA, S.rib);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 2 * 141, 9);
      gl.depthMask(true); gl.disable(gl.BLEND);
    }
    // 4 particles + streaks
    drawFx(S, false);
    // 5 glow source (half res): LED lines + fx
    gl.bindFramebuffer(gl.FRAMEBUFFER, G.g0.f); gl.viewport(0, 0, G.gw, G.gh); gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL);
    gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    if (Q.modelReady && S.vis > .003) drawModel(S, 1);
    drawFx(S, true);
    gl.disable(gl.DEPTH_TEST); gl.bindVertexArray(G.vao); gl.useProgram(G.blur.p);
    let src = G.g0, dst = G.g1;
    [1.5, 3.5, 7, 12].forEach(s => {
      [[1, 0], [0, 1]].forEach(d => {
        gl.bindFramebuffer(gl.FRAMEBUFFER, dst.f); gl.bindTexture(gl.TEXTURE_2D, src.t);
        gl.uniform1i(G.blur.u.uT, 0); gl.uniform2f(G.blur.u.uDir, d[0] * s, d[1] * s); gl.uniform2f(G.blur.u.uSz, G.gw, G.gh);
        gl.drawArrays(gl.TRIANGLES, 0, 3); const tmp = src; src = dst; dst = tmp;
      });
    });
    // 6 resolve MSAA
    if (G.ms) {
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, G.ms.f); gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, G.res.f);
      gl.blitFramebuffer(0, 0, W, H, 0, 0, W, H, gl.COLOR_BUFFER_BIT, gl.NEAREST);
    }
    // 7 composite
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, W, H); gl.disable(gl.BLEND);
    u = G.comp.u; gl.useProgram(G.comp.p);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, G.res.t); gl.uniform1i(u.uScene, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, src.t); gl.uniform1i(u.uGlow, 1);
    gl.uniform2f(u.uSz, W, H); gl.uniform2f(u.uCenter, .5 + mouse[0] * .04, .5 + mouse[1] * .04); gl.uniform1f(u.uT, S.t);
    gl.uniform1f(u.uWarp, S.warp); gl.uniform1f(u.uFlash, S.flash); gl.uniform1f(u.uFade, S.fade); gl.uniform1f(u.uGlowAmt, 2.0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.activeTexture(gl.TEXTURE0);
  };
})();
