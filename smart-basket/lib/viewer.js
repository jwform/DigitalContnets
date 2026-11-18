/* TEAM04 PRODUCT01 · 오프라인 3D 뷰어 (three.js 로컬 번들 사용, 외부 CDN 없음)
   window.ProductViewer(container, {url, b64, fallbackScript, onLoad, onError})
   시점 규칙은 model-viewer와 동일: theta=좌우(0=제품 정면), phi=위에서 아래로 각도(0=정수리) */
(function(){
'use strict';
var T=window.THREE, RAD=Math.PI/180;
var VIEWS={quarter:[34,54],top:[0,4],front:[0,83],side:[90,83],rear:[180,83]};

function b64ToBuf(b){var s=atob(b),n=s.length,u=new Uint8Array(n);for(var i=0;i<n;i++)u[i]=s.charCodeAt(i);return u.buffer}
function parseGLB(buf){
  var dv=new DataView(buf);
  if(dv.getUint32(0,true)!==0x46546C67) throw new Error('GLB 형식이 아닙니다');
  var off=12,json=null,bin=null;
  while(off<buf.byteLength){
    var len=dv.getUint32(off,true),type=dv.getUint32(off+4,true);off+=8;
    if(type===0x4E4F534A) json=JSON.parse(new TextDecoder().decode(new Uint8Array(buf,off,len)));
    else if(type===0x004E4942) bin=new Uint8Array(buf,off,len);
    off+=len;
  }
  return {json:json,bin:bin};
}
function lin(c){return new T.Color().setRGB(c[0],c[1],c[2],T.LinearSRGBColorSpace)}

function buildModel(g,onTex){
  var j=g.json,bin=g.bin,root=new T.Group();
  function view(i){return j.bufferViews[i]}
  function acc(i,Arr,n){var a=j.accessors[i],v=view(a.bufferView),o=(v.byteOffset||0)+(a.byteOffset||0);
    return new Arr(bin.buffer,bin.byteOffset+o,a.count*n)}
  var texCache={};
  function tex(i){
    if(texCache[i]) return texCache[i];
    var im=j.images[j.textures[i].source],v=view(im.bufferView);
    var blob=new Blob([bin.subarray(v.byteOffset||0,(v.byteOffset||0)+v.byteLength)],{type:im.mimeType||'image/png'});
    var url=URL.createObjectURL(blob),img=new Image(),t=new T.Texture(img);
    t.colorSpace=T.SRGBColorSpace;t.flipY=false;t.anisotropy=8;
    img.onload=function(){t.needsUpdate=true;onTex&&onTex()};img.src=url;
    return texCache[i]=t;
  }
  function material(mi){
    var m=j.materials[mi],p=m.pbrMetallicRoughness||{},ex=m.extensions||{},mat;
    if(ex.KHR_materials_unlit){
      mat=new T.MeshBasicMaterial({transparent:m.alphaMode==='BLEND',side:T.DoubleSide,toneMapped:false,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});
      if(p.baseColorTexture) mat.map=tex(p.baseColorTexture.index);
      return mat;
    }
    mat=new T.MeshPhysicalMaterial({color:lin(p.baseColorFactor||[1,1,1,1]),roughness:p.roughnessFactor==null?1:p.roughnessFactor,metalness:p.metallicFactor||0});
    if(m.emissiveFactor){mat.emissive=lin(m.emissiveFactor);var es=ex.KHR_materials_emissive_strength;mat.emissiveIntensity=es?es.emissiveStrength:1}
    if(ex.KHR_materials_clearcoat){mat.clearcoat=ex.KHR_materials_clearcoat.clearcoatFactor||0;mat.clearcoatRoughness=ex.KHR_materials_clearcoat.clearcoatRoughnessFactor||0}
    return mat;
  }
  j.nodes.forEach(function(nd){
    var me=j.meshes[nd.mesh];
    me.primitives.forEach(function(pr){
      var geo=new T.BufferGeometry(),a=pr.attributes;
      geo.setAttribute('position',new T.BufferAttribute(acc(a.POSITION,Float32Array,3),3));
      geo.setAttribute('normal',new T.BufferAttribute(acc(a.NORMAL,Float32Array,3),3));
      if(a.TEXCOORD_0!=null) geo.setAttribute('uv',new T.BufferAttribute(acc(a.TEXCOORD_0,Float32Array,2),2));
      geo.setIndex(new T.BufferAttribute(acc(pr.indices,Uint32Array,1),1));
      var mat=material(pr.material),mesh=new T.Mesh(geo,mat);
      mesh.name=nd.name||'';
      if(mat.isMeshBasicMaterial){mesh.renderOrder=5}else{mesh.castShadow=true;mesh.receiveShadow=true}
      root.add(mesh);
    });
  });
  return root;
}

function loadBuffer(o){
  if(o.b64) return Promise.resolve(b64ToBuf(o.b64));
  var viaScript=function(){
    return new Promise(function(res,rej){
      if(window.__GLB_B64||!o.fallbackScript) return window.__GLB_B64?res(b64ToBuf(window.__GLB_B64)):rej(new Error('GLB를 읽지 못했습니다'));
      var s=document.createElement('script');s.src=o.fallbackScript;
      s.onload=function(){window.__GLB_B64?res(b64ToBuf(window.__GLB_B64)):rej(new Error('GLB 데이터 없음'))};
      s.onerror=function(){rej(new Error('GLB 데이터 파일 로드 실패'))};
      document.head.appendChild(s);
    });
  };
  if(location.protocol!=='http:'&&location.protocol!=='https:') return viaScript();
  return fetch(o.url).then(function(r){if(!r.ok)throw new Error('HTTP '+r.status);return r.arrayBuffer()}).catch(viaScript);
}

window.ProductViewer=function(box,opt){
  opt=opt||{};
  var renderer=new T.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});
  renderer.setClearColor(0x000000,0);
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
  renderer.toneMapping=T.NeutralToneMapping;renderer.toneMappingExposure=1.0;
  var cv=renderer.domElement;cv.style.cssText='position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:pan-y;cursor:grab;outline:none';
  cv.setAttribute('tabindex','0');cv.setAttribute('role','img');cv.setAttribute('aria-label',opt.alt||'3D 제품 모델');
  box.insertBefore(cv,box.firstChild);
  var scene=new T.Scene(),cam=new T.PerspectiveCamera(30,1,0.01,20);
  var pm=new T.PMREMGenerator(renderer);
  scene.environment=pm.fromScene(new window.RoomEnvironment(),0.04).texture;scene.environmentIntensity=0.7;
  var sun=new T.DirectionalLight(0xffffff,2.6);sun.position.set(-0.25,0.32,-0.2);sun.castShadow=true;
  sun.shadow.mapSize.set(2048,2048);sun.shadow.radius=5;sun.shadow.bias=-0.0004;
  Object.assign(sun.shadow.camera,{left:-0.3,right:0.3,top:0.3,bottom:-0.3,near:0.05,far:1.5});
  var rim=new T.DirectionalLight(0x7628F5,1.6);rim.position.set(0.2,0.05,-0.3);
  var fill=new T.DirectionalLight(0xdfe6ff,0.35);fill.position.set(0.3,0.12,-0.15);
  var camKey=new T.DirectionalLight(0xfff4ec,0.95),camFill=new T.DirectionalLight(0xb9a8ff,0.5),hemi=new T.HemisphereLight(0xcfd4ff,0x1a1230,0.55);
  scene.add(sun,rim,fill,camKey,camFill,hemi,camKey.target,camFill.target);

  var S={th:VIEWS.quarter[0]*RAD,ph:VIEWS.quarter[1]*RAD,r:1,gth:VIEWS.quarter[0]*RAD,gph:VIEWS.quarter[1]*RAD,gr:1,r0:1,
         auto:true,idle:performance.now(),target:new T.Vector3(),ready:false,visible:true};
  var hot=[].slice.call(box.querySelectorAll('[data-position]')).map(function(el){
    var p=el.dataset.position.split(/\s+/).map(Number),n=(el.dataset.normal||'0 1 0').split(/\s+/).map(Number);
    el.style.position='absolute';el.style.left='0';el.style.top='0';el.style.zIndex='3';el.style.pointerEvents='none';el.tabIndex=-1;
    return {el:el,p:new T.Vector3(p[0],p[1],p[2]),n:new T.Vector3(n[0],n[1],n[2])};
  });

  function fit(){
    var w=box.clientWidth||600,h=box.clientHeight||400;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));renderer.setSize(w,h,false);
    cam.aspect=w/h;
    // 가로 280mm가 화면 폭의 약 78%가 되도록 거리 계산 (세로가 좁으면 세로 기준)
    var tv=Math.tan(cam.fov*RAD/2),th=tv*cam.aspect;
    var rW=0.15/(th*0.82),rH=0.09/(tv*0.82);
    S.r0=Math.max(rW,rH,0.3);cam.updateProjectionMatrix();
    if(!S.ready||!S.userZoomed){S.gr=S.r0;if(!S.ready)S.r=S.r0}
  }
  new ResizeObserver(fit).observe(box);fit();

  var tmp=new T.Vector3(),tmp2=new T.Vector3();
  function placeCam(){
    var sp=Math.sin(S.ph);
    cam.position.set(S.target.x+S.r*sp*Math.sin(S.th),S.target.y+S.r*Math.cos(S.ph),S.target.z+S.r*sp*Math.cos(S.th));
    cam.up.set(0,1,0);cam.lookAt(S.target);cam.updateMatrixWorld();
  }
  var mouse=null;
  function updateHot(){
    var w=box.clientWidth,h=box.clientHeight,best=null,bd=48;
    hot.forEach(function(o){
      tmp.copy(o.p).project(cam);
      tmp2.copy(cam.position).sub(o.p).normalize();
      var face=o.n.dot(tmp2)>0.05&&tmp.z<1,sx=(tmp.x*0.5+0.5)*w,sy=(-tmp.y*0.5+0.5)*h;
      o.el.style.transform='translate('+sx+'px,'+sy+'px)';o.face=face;
      if(face&&mouse){var d=Math.hypot(mouse[0]-sx,mouse[1]-sy);if(d<bd){bd=d;best=o}}
    });
    hot.forEach(function(o){o.el.classList.toggle('on',o===best)});
  }
  var last=performance.now();
  function frame(now){
    requestAnimationFrame(frame);
    if(!S.visible||!S.ready) return;
    var dt=Math.min((now-last)/1000,0.1);last=now;
    if(S.auto&&now-S.idle>(opt.autoDelay||1200)){S.gth+=16*RAD*dt;S.th=S.gth}
    else{var k=1-Math.exp(-dt*9);S.th+=(S.gth-S.th)*k;S.ph+=(S.gph-S.ph)*k;S.r+=(S.gr-S.r)*k}
    placeCam();
    /* 카메라를 따라다니는 키/필 조명: 어느 방향에서 봐도 제품이 어둡지 않게 */
    camKey.position.set(cam.position.x+0.12,cam.position.y+0.16,cam.position.z+0.02);camKey.target.position.copy(S.target);
    camFill.position.set(cam.position.x-0.2,cam.position.y-0.02,cam.position.z+0.1);camFill.target.position.copy(S.target);
    updateHot();renderer.render(scene,cam);
  }
  requestAnimationFrame(frame);
  if('IntersectionObserver' in window)new IntersectionObserver(function(e){S.visible=e[0].isIntersecting}).observe(box);

  function stopAuto(){S.auto=false}
  function clampPh(){S.gph=Math.max(3*RAD,Math.min(177*RAD,S.gph))}
  var pts={},pd=0;
  cv.addEventListener('pointermove',function(e){var r=cv.getBoundingClientRect();mouse=[e.clientX-r.left,e.clientY-r.top]});
  cv.addEventListener('pointerleave',function(){mouse=null});
  cv.addEventListener('pointerdown',function(e){cv.setPointerCapture(e.pointerId);pts[e.pointerId]=[e.clientX,e.clientY];stopAuto();cv.style.cursor='grabbing';
    if(Object.keys(pts).length===2){var a=Object.values(pts);pd=Math.hypot(a[0][0]-a[1][0],a[0][1]-a[1][1])}});
  cv.addEventListener('pointermove',function(e){
    var p=pts[e.pointerId];if(!p)return;
    var n=Object.keys(pts).length;
    if(n===1){var dx=e.clientX-p[0],dy=e.clientY-p[1];S.gth-=dx*0.0075;S.gph-=dy*0.0075;clampPh();S.th=S.gth;S.ph=S.gph}
    pts[e.pointerId]=[e.clientX,e.clientY];
    if(n===2){var a=Object.values(pts),d=Math.hypot(a[0][0]-a[1][0],a[0][1]-a[1][1]);if(pd){zoom(pd/d)}pd=d}
  });
  function up(e){delete pts[e.pointerId];cv.style.cursor='grab';pd=0}
  cv.addEventListener('pointerup',up);cv.addEventListener('pointercancel',up);
  function zoom(f){S.userZoomed=true;S.gr=Math.max(S.r0*0.35,Math.min(S.r0*1.8,S.gr*f));S.r=S.gr}
  cv.addEventListener('wheel',function(e){e.preventDefault();stopAuto();zoom(Math.exp(e.deltaY*0.0012))},{passive:false});
  cv.addEventListener('keydown',function(e){
    var m={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key];
    if(m){e.preventDefault();stopAuto();S.gth+=m[0]*10*RAD;S.gph+=m[1]*10*RAD;clampPh()}});

  var api={
    setView:function(name){
      var v=VIEWS[name];if(!v)return;stopAuto();
      var th=v[0]*RAD;while(th-S.th>Math.PI)th-=2*Math.PI;while(th-S.th<-Math.PI)th+=2*Math.PI;
      S.gth=th;S.gph=v[1]*RAD;S.gr=S.r0;S.userZoomed=false;
    },
    resume:function(){S.auto=true;S.idle=performance.now()},
    views:VIEWS,_S:S
  };

  loadBuffer(opt).then(function(buf){
    var model=buildModel(parseGLB(buf),function(){});
    scene.add(model);
    var bb=new T.Box3().setFromObject(model),c=bb.getCenter(new T.Vector3());
    S.target.copy(c);
    var ground=new T.Mesh(new T.PlaneGeometry(3,3),new T.ShadowMaterial({opacity:0.55}));
    ground.rotation.x=-Math.PI/2;ground.position.set(c.x,bb.min.y-0.0004,c.z);ground.receiveShadow=true;scene.add(ground);
    var gc=document.createElement('canvas');gc.width=gc.height=256;var gx=gc.getContext('2d'),gg=gx.createRadialGradient(128,128,0,128,128,128);
    gg.addColorStop(0,'rgba(118,40,245,.55)');gg.addColorStop(.45,'rgba(118,40,245,.18)');gg.addColorStop(1,'rgba(118,40,245,0)');gx.fillStyle=gg;gx.fillRect(0,0,256,256);
    gx.strokeStyle='rgba(197,255,53,.55)';gx.lineWidth=1.5;gx.beginPath();gx.arc(128,128,92,0,6.283);gx.stroke();
    var glowM=new T.Mesh(new T.PlaneGeometry(0.46,0.46),new T.MeshBasicMaterial({map:new T.CanvasTexture(gc),transparent:true,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false}));
    glowM.rotation.x=-Math.PI/2;glowM.position.set(c.x,bb.min.y-0.0008,c.z);scene.add(glowM);
    sun.target.position.copy(c);scene.add(sun.target);
    S.ready=true;S.idle=performance.now();fit();S.r=S.gr;
    opt.onLoad&&opt.onLoad(api);
  }).catch(function(err){console.error(err);opt.onError&&opt.onError(err)});
  return api;
};
window.ProductViewer.b64ToBuf=b64ToBuf;window.ProductViewer.parseGLB=parseGLB;window.ProductViewer.buildModel=buildModel;
})();
