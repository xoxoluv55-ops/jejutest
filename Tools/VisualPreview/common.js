// Ports of MeshKit.PuffyStar / StarFace / SaltatoryTunnelView geometry for design previews.
function starR(t,ro,ri,p){const c=0.5+0.5*Math.cos(5*(t-Math.PI/2)); return ri+(ro-ri)*Math.pow(c,p);}
function puffy(ri,th,p){const A=140,RN=12,v=[],idx=[];
 for(let side=0;side<2;side++){const sz=side?-1:1,b=v.length/3; v.push(0,0,sz*th);
  for(let r=1;r<=RN;r++){const f=r/RN,h=Math.sqrt(Math.max(0,1-Math.pow(f,2.4)));for(let i=0;i<A;i++){const t=i/A*Math.PI*2,rad=starR(t,1,ri,p)*f;v.push(Math.cos(t)*rad,Math.sin(t)*rad,sz*th*h);}}
  for(let i=0;i<A;i++){const i1=(i+1)%A; side?idx.push(b,b+1+i1,b+1+i):idx.push(b,b+1+i,b+1+i1);}
  for(let r=1;r<RN;r++){const r0=b+1+(r-1)*A,r1=b+1+r*A;for(let i=0;i<A;i++){const i1=(i+1)%A; if(!side)idx.push(r0+i,r1+i,r1+i1,r0+i,r1+i1,r0+i1); else idx.push(r0+i,r1+i1,r1+i,r0+i,r0+i1,r1+i1);}}}
 const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(v,3)); g.setIndex(idx); g.computeVertexNormals(); return g;}
const RI=0.64,TH=0.46;
function surfZ(x,y){const r=Math.hypot(x,y),a=Math.atan2(y,x),rr=starR(a,1,RI,1.15),f=Math.min(1,r/rr);return TH*Math.sqrt(Math.max(0,1-Math.pow(f,2.4)));}
function stroke(pts,w,lift=0.012){const v=[],idx=[];const hw=w/2;
 for(let i=0;i<pts.length;i++){const a=pts[Math.max(0,i-1)],b=pts[Math.min(pts.length-1,i+1)];let dx=b[0]-a[0],dy=b[1]-a[1];const L=Math.hypot(dx,dy)||1;dx/=L;dy/=L;const nx=-dy*hw,ny=dx*hw;
  for(const s of[1,-1]){const x=pts[i][0]+nx*s,y=pts[i][1]+ny*s;v.push(x,y,surfZ(x,y)+lift);} if(i>0){const k=i*2;idx.push(k-2,k-1,k,k-1,k+1,k);}}
 for(const c of[pts[0],pts[pts.length-1]]){const b=v.length/3;v.push(c[0],c[1],surfZ(c[0],c[1])+lift);for(let i=0;i<=10;i++){const a=i/10*Math.PI*2,x=c[0]+Math.cos(a)*hw,y=c[1]+Math.sin(a)*hw;v.push(x,y,surfZ(x,y)+lift);if(i>0)idx.push(b,b+i,b+i+1);}}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(v,3));g.setIndex(idx);g.computeVertexNormals();return g;}
function fill(poly,lift=0.012){let cx=0,cy=0;poly.forEach(p=>{cx+=p[0];cy+=p[1]});cx/=poly.length;cy/=poly.length;const v=[cx,cy,surfZ(cx,cy)+lift],idx=[];poly.forEach(p=>v.push(p[0],p[1],surfZ(p[0],p[1])+lift));for(let i=0;i<poly.length;i++)idx.push(0,1+i,1+(i+1)%poly.length);
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(v,3));g.setIndex(idx);g.computeVertexNormals();return g;}
function arc(c,rx,ry,a0,a1,n=12){const l=[];for(let i=0;i<=n;i++){const a=(a0+(a1-a0)*i/n)*Math.PI/180;l.push([c[0]+Math.cos(a)*rx,c[1]+Math.sin(a)*ry]);}return l;}
function circ(c,rx,ry,n=20){const l=arc(c,rx,ry,0,360,n);l.pop();return l;}
function twinkle(c,ro,ri){const l=[];for(let i=0;i<8;i++){const a=i*Math.PI/4+Math.PI/2,r=i%2?ri:ro;l.push([c[0]+Math.cos(a)*r,c[1]+Math.sin(a)*r]);}return l;}
function wave(c,hw,amp,n=14){const l=[];for(let i=0;i<=n;i++){const u=i/n;l.push([c[0]-hw+2*hw*u,c[1]+Math.sin(u*Math.PI*3)*amp]);}return l;}
function openMouth(c,w,h){const l=[];for(let i=0;i<=14;i++){const a=(180+180*i/14)*Math.PI/180;l.push([c[0]+Math.cos(a)*w,c[1]+Math.sin(a)*h]);}return l;}
function tearP(tip,r){const l=[tip];const c=[tip[0],tip[1]-r*1.6];for(let i=1;i<12;i++){const a=(60-300*i/12)*Math.PI/180;l.push([c[0]+Math.cos(a)*r,c[1]+Math.sin(a)*r]);}return l;}
// ToonRim shader port
function toonMat(base,shade,rim,rimPow,emis){return new THREE.ShaderMaterial({uniforms:{B:{value:new THREE.Color(base)},S:{value:new THREE.Color(shade)},R:{value:new THREE.Color(rim)},P:{value:rimPow},E:{value:new THREE.Color(emis)},L:{value:new THREE.Vector3(0.4,0.8,0.5).normalize()}},
 vertexShader:`varying vec3 n;varying vec3 vw;void main(){n=normalize(mat3(modelMatrix)*normal);vec4 w=modelMatrix*vec4(position,1.);vw=normalize(cameraPosition-w.xyz);gl_Position=projectionMatrix*viewMatrix*w;}`,
 fragmentShader:`uniform vec3 B,S,R,E,L;uniform float P;varying vec3 n;varying vec3 vw;void main(){vec3 N=normalize(n);float ndl=dot(N,L)*.5+.5;float ramp=smoothstep(.38,.62,ndl);vec3 c=mix(S,B,ramp)+B*.12;vec3 h=normalize(L+vw);float sp=pow(max(dot(N,h),0.),60.);c+=smoothstep(.45,.55,sp)*.55;c+=pow(1.-max(dot(N,vw),0.),P)*R;c+=E;gl_FragColor=vec4(c,1.);}`});}
function glowTex(){const c=document.createElement('canvas');c.width=c.height=64;const x=c.getContext('2d');const g=x.createRadialGradient(32,32,0,32,32,32);g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(0.4,'rgba(255,255,255,.35)');g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.fillRect(0,0,64,64);return new THREE.CanvasTexture(c);}
function addMat(color,op){return new THREE.MeshBasicMaterial({color,map:glowTex(),transparent:true,opacity:op,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide});}
function sph(p,s,mat){const m=new THREE.Mesh(new THREE.SphereGeometry(0.5,24,16),mat);m.position.set(...p);m.scale.set(...s);return m;}
function std(c,e,r=.4){return new THREE.MeshStandardMaterial({color:c,emissive:e||0,roughness:r});}
// ---------- 1.0 star (as committed) ----------
function starV1(expr){const root=new THREE.Group(),body=new THREE.Group();body.scale.setScalar(1.15);root.add(body);
 body.add(new THREE.Mesh(puffy(0.64,0.46,1.15),std(0xFFD34D,0x8c7428,.5)));
 const E={Normal:[[.16,.22],[.17,.1],.12,.06,1],Joy:[[.19,.05],[.24,.17],.15,.06,1.3],Surprise:[[.2,.27],[.11,.14],.12,.08,1],Hurt:[[.2,.05],[.15,.05],.1,.06,.5]}[expr];
 const [e0,mo,ey,hi,ck]=E,eye=[e0[0]*1.3,e0[1]*1.3],Z=.44;
 for(const sx of[-1,1]){body.add(sph([sx*.25,ey+.02,Z],[eye[0],eye[1],.08],std(0x1A1033,0,.1)));if(eye[1]>.13)body.add(sph([sx*.25+.045,ey+.02+eye[1]*.28,Z+.05],[hi*1.2,hi*1.2,hi],std(0xffffff,0xffffff)));body.add(sph([sx*.44,-.1,Z-.1],[.2*ck,.11*ck,.05*ck],std(0xFF8FB8,0x802040)));}
 body.add(sph([0,-.15,Z+.01],[mo[0],mo[1],.05],std(0x7A1838)));
 const ring=new THREE.Mesh(new THREE.TorusGeometry(1.75,.03,6,48),std(0xC9A8FF,0x6a40c0));ring.rotation.set(76*Math.PI/180,0,10*Math.PI/180);ring.position.y=-.45;root.add(ring);return root;}
// ---------- 2.0 star ----------
function starV2(expr,withHalo=true){const root=new THREE.Group(),body=new THREE.Group();body.scale.setScalar(1.25);root.add(body);
 body.add(new THREE.Mesh(puffy(RI,TH,1.15),toonMat(0xFFD34D,0xF29B38,0xFFF3C4,2.4,0x2e2510)));
 const EL=[-.25,.16],ER=[.25,.16],line=std(0x2A1640,0,.5),mouth=std(0x7A1838,0,.6),white=std(0xffffff,0xffffff),spark=std(0xffffff,0xfff4b0);
 let open=true,happy=false,cross=false,closed=false,sparkle=false,wet=false,eye=[.21,.29],mk=0,brow=-1,ck=1;
 if(expr=='Focus'){eye=[.22,.19];mk=3;brow=2;} if(expr=='Joy'){open=false;happy=true;mk=1;ck=1.35;} if(expr=='Surprise'){eye=[.24,.36];mk=2;brow=1;}
 if(expr=='Hurt'){open=false;cross=true;mk=4;ck=.6;} if(expr=='Correct'){eye=[.23,.31];sparkle=true;mk=1;ck=1.35;brow=1;} if(expr=='Wrong'){eye=[.19,.24];wet=true;mk=4;brow=3;ck=.8;}
 if(expr=='Victory'){open=false;happy=true;mk=1;ck=1.45;}
 const F=(g,m)=>body.add(new THREE.Mesh(g,m));
 for(const c of[EL,ER]){const z=surfZ(c[0],c[1]);
  if(open){body.add(sph([c[0],c[1],z],[eye[0],eye[1],.09],std(0x1A1033,0,.1)));if(!sparkle){body.add(sph([c[0]+eye[0]*.18,c[1]+eye[1]*.2,z+.05],[.07,.07,.07],white));body.add(sph([c[0]-eye[0]*.18,c[1]-eye[1]*.22,z+.045],[.035,.035,.035],white));}}
  if(happy)F(stroke(arc([c[0],c[1]-.04],.11,.1,20,160),.05),line);
  if(sparkle)F(fill(twinkle([c[0]+.025,c[1]+.035],.085,.026),.07),spark);
  const s=c[0]<0?-1:1;
  if(cross)F(stroke([[c[0]-.08*s,c[1]+.08],[c[0]+.07*s,c[1]],[c[0]-.08*s,c[1]-.08]],.05),line);
  if(brow==1)F(stroke(arc([c[0],c[1]+.2],.09,.04,30,150),.035),line);
  if(brow==2)F(stroke([[c[0]-.1*s,c[1]+.2],[c[0]+.09*s,c[1]+.13]],.04),line);
  if(brow==3)F(stroke([[c[0]-.1*s,c[1]+.14],[c[0]+.09*s,c[1]+.2]],.035),line);}
 if(wet)F(fill(tearP([EL[0]-.07,EL[1]-.12],.05),.02),std(0x9EE6FF,0x2a7799));
 const mc=[0,-.13];
 if(mk==0)F(stroke(arc([0,-.09],.085,.07,200,340),.04),line);
 if(mk==1){F(fill(openMouth([0,-.11],.12,.12)),mouth);F(fill(circ([0,-.195],.06,.03),.02),std(0xFF7A9C,0x55202a));}
 if(mk==2)F(fill(circ(mc,.05,.06)),mouth); if(mk==3)F(stroke([[-.06,-.13],[.06,-.13]],.035),line); if(mk==4)F(stroke(wave(mc,.085,.018),.032),line);
 for(const sx of[-1,1]){const x=sx*.44,y=-.1;body.add(sph([x,y,surfZ(x,y)-.02],[.2*ck,.11*ck,.05*ck],toonMat(0xFF9CC0,0xFF6FA0,0xFFD6E6,3,0x401020)));}
 const ring=new THREE.Mesh(new THREE.TorusGeometry(1.75,.035,6,56),std(0xC9A8FF,0x7a50d0));ring.rotation.set(104*Math.PI/180,0,-10*Math.PI/180);ring.position.y=-.5;root.add(ring);
 for(let i=0;i<3;i++){const a=i*Math.PI*2/3;const p=sph([Math.cos(a)*1.75,Math.sin(a)*1.75,0],[.18,.18,.18],toonMat(0xFFF0B0,0xFFC24A,0xffffff,2,0x332600));ring.add(p);}
 const r2=new THREE.Mesh(new THREE.TorusGeometry(1.95,.012,4,56),std(0x2EE6D6,0x2EE6D6));r2.rotation.set(114*Math.PI/180,-20*Math.PI/180,15*Math.PI/180);r2.position.y=-.4;root.add(r2);
 if(withHalo){const h=new THREE.Mesh(new THREE.PlaneGeometry(4.2,4.2),addMat(0xFFC74D,.55));h.position.z=-.05;root.add(h);root.userData.halo=h;}
 return root;}
