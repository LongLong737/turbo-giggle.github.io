import * as T from './vendor/three-r186/three.webgpu.js';
import {FLIGHTS,RISE,STEPS,MELD_FLOORS,ROOM_FLOORS,clamp,seeded,landing,pathPoint,makeRun,objectsForFloor,movePlayer,message,interact,updateRun,creakPosition,hasLineOfSight} from './stairwell-world.mjs?v=stalker-2';

const $=id=>document.getElementById(id),canvas=$('view');
const screens=['menu','hud','pause','guide','settings','result','error'];
const chromebook=/CrOS/i.test(navigator.userAgent);
const lowPower=chromebook||(navigator.hardwareConcurrency||8)<=4||(navigator.deviceMemory||8)<=4;
let renderer,scene,camera,environment,run=null,playing=false,paused=false,modalFrom='menu',frame=0,last=0,visibleFloor=-100;
let yaw=Math.PI,pitch=0,cameraHeight=1.65,moved=false,nearest=null,touchSprint=false,touchLook=null,joystick={x:0,y:0};
let healthBefore=100,footstep=0,damageFlash=0,quality=lowPower?.7:1,soundEnabled=true,sensitivity=1,brightness=1,gamepadButtons=[],hudAt=0;
try{const saved=Number(localStorage.getItem('turbo-rarewell-quality'));if([.7,1,1.5].includes(saved))quality=saved;}catch{}
const keys=new Set(),signTextures=new Map(),chunks=new Map(),props=[],melds=[],gates=[],landingLights=[],creakArms=[];
const boxGeometry=new T.BoxGeometry(1,1,1),sphereGeometry=new T.SphereGeometry(1,12,8),cylinderGeometry=new T.CylinderGeometry(1,1,1,8);
const tempMatrix=new T.Matrix4(),tempPosition=new T.Vector3(),tempQuat=new T.Quaternion(),tempScale=new T.Vector3();
const materials={};
let torch,torchTarget,creakModel,noiseModel,stemModel,ambient,hemi,heldLight,fireEffects,gripModel,staticTexture,renderScale=1,slowFrames=0;
const viewDirection=new T.Vector3(),creakVector=new T.Vector3();
let record=100;
try{record=Number(localStorage.getItem('turbo-stairwell-best'))||100;}catch{}
$('record').textContent=`BEST / ${record}`;

function show(name){for(const id of screens)$(id).hidden=id!==name;}
function tone(frequency,duration=0.1,volume=0.08,type='sine'){
  if(!soundEnabled||!audio.context)return;
  const ctx=audio.context,o=ctx.createOscillator(),g=ctx.createGain();o.type=type;o.frequency.value=frequency;
  g.gain.setValueAtTime(volume,ctx.currentTime);g.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+duration);
  o.connect(g);g.connect(audio.master);o.start();o.stop(ctx.currentTime+duration);
}
const audio={context:null,master:null,noise:null,start(){
  if(this.context){this.context.resume().catch(()=>{});return;}
  const Context=window.AudioContext||window.webkitAudioContext;if(!Context)return;
  try{
    this.context=new Context();this.master=this.context.createGain();this.master.gain.value=soundEnabled?.38:0;this.master.connect(this.context.destination);
    const drone=this.context.createOscillator(),low=this.context.createOscillator(),g=this.context.createGain();
    drone.frequency.value=53;low.frequency.value=55.1;drone.type='sine';low.type='sine';g.gain.value=.055;
    drone.connect(g);low.connect(g);g.connect(this.master);drone.start();low.start();
    const data=this.context.createBuffer(1,this.context.sampleRate*2,this.context.sampleRate),arr=data.getChannelData(0),rand=seeded(51);
    for(let i=0;i<arr.length;i++)arr[i]=(rand()*2-1)*.5;
    const src=this.context.createBufferSource(),filter=this.context.createBiquadFilter(),gain=this.context.createGain();
    src.buffer=data;src.loop=true;filter.type='lowpass';filter.frequency.value=450;gain.gain.value=.035;
    src.connect(filter);filter.connect(gain);gain.connect(this.master);src.start();this.noise=gain;
  }catch{}
}};
function concreteTexture(){
  const c=document.createElement('canvas');c.width=c.height=256;const ctx=c.getContext('2d'),im=ctx.createImageData(256,256),rand=seeded(72);
  for(let i=0;i<im.data.length;i+=4){const v=91+rand()*32;im.data[i]=v;im.data[i+1]=v+2;im.data[i+2]=v-7;im.data[i+3]=255;}
  ctx.putImageData(im,0,0);ctx.strokeStyle='#363b3460';ctx.lineWidth=1;
  for(let j=0;j<20;j++){ctx.beginPath();let x=rand()*256,y=rand()*256;ctx.moveTo(x,y);for(let k=0;k<6;k++){x+=rand()*12-6;y+=rand()*18;ctx.lineTo(x,y);}ctx.stroke();}
  ctx.fillStyle='#343c3435';for(let j=0;j<70;j++)ctx.fillRect(rand()*256,rand()*256,rand()*12,rand()*3);
  const tex=new T.CanvasTexture(c);tex.wrapS=tex.wrapT=T.RepeatWrapping;tex.colorSpace=T.SRGBColorSpace;tex.anisotropy=4;return tex;
}
function mat(color,extra={}){const {roughness,metalness,...rest}=extra;return new T.MeshLambertNodeMaterial({color,...rest});}
function mesh(geometry,material,parent=environment){const m=new T.Mesh(geometry,material);parent.add(m);return m;}
function box(x,y,z,w,h,d,material,parent=environment){const m=mesh(boxGeometry,material,parent);m.position.set(x,y,z);m.scale.set(w,h,d);return m;}
function sphere(x,y,z,r,material,parent=environment){const m=mesh(sphereGeometry,material,parent);m.position.set(x,y,z);m.scale.setScalar(r);return m;}
function beam(a,b,r,material,parent=environment){const aa=new T.Vector3(...a),bb=new T.Vector3(...b),delta=bb.clone().sub(aa);const m=mesh(cylinderGeometry,material,parent);m.position.copy(aa.add(bb).multiplyScalar(.5));m.scale.set(r,delta.length(),r);m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),delta.normalize());return m;}
function batchGroup(group){
  const buckets=new Map();
  for(const child of [...group.children]){
    if(!child.isMesh||child.isInstancedMesh||child.userData.dynamic||![boxGeometry,cylinderGeometry,sphereGeometry].includes(child.geometry))continue;
    const key=child.geometry.uuid+child.material.uuid;
    if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(child);
  }
  for(const objects of buckets.values()){
    if(objects.length<2)continue;const first=objects[0],batch=new T.InstancedMesh(first.geometry,first.material,objects.length);
    objects.forEach((o,i)=>{o.updateMatrix();batch.setMatrixAt(i,o.matrix);group.remove(o);});batch.instanceMatrix.needsUpdate=true;group.add(batch);
  }
}
function sign(text,x,y,z,w=1.9,h=.8,rotation=0,color='#c8caba',bg='#292e27'){
  const key=`${text}|${color}|${bg}`;let cached=signTextures.get(key);
  if(!cached){const c=document.createElement('canvas');c.width=256;c.height=128;const ctx=c.getContext('2d');ctx.fillStyle=bg;ctx.fillRect(0,0,256,128);ctx.strokeStyle=color;ctx.globalAlpha=.4;ctx.lineWidth=3;ctx.strokeRect(6,6,244,116);ctx.globalAlpha=1;ctx.fillStyle=color;ctx.textAlign='center';ctx.textBaseline='middle';const lines=text.split('\n');ctx.font=`bold ${lines.length===1?32:22}px Arial`;lines.forEach((line,i)=>ctx.fillText(line,128,64+(i-(lines.length-1)/2)*28.5,235));const tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace;cached={tex,refs:0};signTextures.set(key,cached);}
  cached.refs++;const material=new T.MeshBasicNodeMaterial({map:cached.tex});const m=mesh(new T.PlaneGeometry(w,h),material);m.position.set(x,y,z);m.rotation.y=rotation;m.userData={owned:true,signKey:key};return m;
}
function makeStaticTexture(){
  const c=document.createElement('canvas');c.width=256;c.height=128;const ctx=c.getContext('2d'),pixels=ctx.createImageData(256,128),rand=seeded(419);
  for(let i=0;i<pixels.data.length;i+=4){const v=70+Math.floor(rand()*85);pixels.data[i]=pixels.data[i+1]=pixels.data[i+2]=v;pixels.data[i+3]=255;}
  ctx.putImageData(pixels,0,0);const tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace;tex.repeat.set(.25,.5);tex.magFilter=T.NearestFilter;return tex;
}
function buildMaterials(){
  const tex=concreteTexture();materials.wall=mat('#b3b8a5',{map:tex});materials.floor=mat('#858e78',{map:tex});materials.step=mat('#b2b4a4',{map:tex});
  materials.metal=mat('#4d5146',{metalness:.72,roughness:.55});materials.rust=mat('#694834',{metalness:.6});materials.pipe=mat('#774330',{metalness:.45});materials.dark=mat('#161b15');
  materials.yellow=mat('#b9a050');materials.red=mat('#a93722');materials.meld=mat('#743d38',{roughness:.46});materials.stone=mat('#b4b7a7',{map:tex});
  materials.glow=new T.MeshBasicNodeMaterial({color:'#d5dcc0'});materials.green=new T.MeshBasicNodeMaterial({color:'#afc383'});
  staticTexture=makeStaticTexture();materials.noise=new T.MeshBasicNodeMaterial({map:staticTexture,color:'#657c70'});
  materials.tvStatic=new T.MeshBasicNodeMaterial({map:staticTexture,color:'#88998b'});
}
function flight(n){
  const y=n*RISE,even=n%2===0,x=even?-2.5:2.5,dir=even?1:-1;
  const steps=new T.InstancedMesh(boxGeometry,materials.step,STEPS);environment.add(steps);
  for(let i=0;i<STEPS;i++){tempPosition.set(x,y+(i+.5)*RISE/STEPS,dir*(-4+(i+.5)*8/STEPS));tempScale.set(3.4,RISE/STEPS,8/STEPS);tempMatrix.compose(tempPosition,tempQuat.identity(),tempScale);steps.setMatrixAt(i,tempMatrix);}
  steps.instanceMatrix.needsUpdate=true;
  for(const side of [-1,1]){
    const rx=x+side*1.65;
    beam([rx,y+.87,-dir*4],[rx,y+RISE+.87,dir*4],.045,materials.metal);
    beam([rx,y-.1,-dir*4],[rx,y+RISE-.1,dir*4],.085,materials.metal);
    for(let j=0;j<=4;j++){const z=dir*(-4+j*2),sy=y+j/4*RISE;beam([rx,sy,z],[rx,sy+.9,z],.035,materials.metal);}
  }
  const l=landing(n);
  box(0,y-.18,l.z,9.6,.36,2.85,materials.floor);
  box(-4.8,y+RISE/2,0,.3,RISE,13.1,materials.wall);box(4.8,y+RISE/2,0,.3,RISE,13.1,materials.wall);
  // Open the outer wall only where a landing has a side annex.
  if(ROOM_FLOORS.includes(n)){
    const openX=l.side*4.8;
    const wall=environment.children[environment.children.length-(l.side<0?2:1)];wall.scale.z=7;wall.position.z=-Math.sign(l.z)*2.2;
    box(openX,y+2.95,l.z,.3,.5,2.9,materials.wall);
  }
  box(0,y+1.6,l.z>0?6.4:-6.4,9.8,3.2,.3,materials.wall);
  const face=l.z>0?Math.PI:0;
  sign(String(100+n).padStart(3,'0'),l.side*-2.1,y+1.6,l.z>0?6.23:-6.23,1.8,.95,face,'#c3c4b1','#3b4137');
  sign('RAREWELL\n↑ CONTINUE',l.side*2.3,y+1.8,l.z>0?6.22:-6.22,1.5,.65,face,'#adc595','#293727');
  box(0,y+2.8,l.z,2.4,.1,.35,materials.dark);box(0,y+2.74,l.z,2.15,.035,.17,materials.glow);
  beam([4.53,y,-5.8],[4.53,y+RISE,-5.8],.12,materials.pipe);beam([-4.53,y,5.8],[-4.53,y+RISE,5.8],.07,materials.metal);
  if(n%4===0){beam([4.53,y+2.4,-5.8],[-3.8,y+2.4,-5.8],.12,materials.pipe);box(3,y+2.4,-5.8,.15,.55,.15,materials.rust);}
  for(const xx of [-.72,.72]){beam([xx,y+.8,l.z>0?3.55:-3.55],[xx,y+.8,l.z>0?4.3:-4.3],.04,materials.metal);beam([xx,y,l.z>0?3.55:-3.55],[xx,y+.85,l.z>0?3.55:-3.55],.04,materials.metal);}
  if(n%5===0)box(l.side*3.4,y+.3,l.z,.75,.6,.5,materials.dark);
}
function room(n){
  const l=landing(n),sx=l.side,y=l.y,zc=l.z;
  box(sx*11,y-.2,zc,13,.4,6.5,materials.floor);box(sx*11,y+3.25,zc,13,.25,6.5,materials.wall);
  box(sx*11,y+1.6,zc-3.25,13,3.2,.2,materials.wall);box(sx*11,y+1.6,zc+3.25,13,3.2,.2,materials.wall);
  box(sx*17.6,y+1.6,zc,.2,3.2,6.7,materials.wall);
  box(sx*10.5,y+1.6,zc+1.9,.35,3.2,2.75,materials.wall);
  sign(n===99?'COBBLER’S\nEXCHANGE':'DEPOT\nSALVAGE & SUPPLY',sx*9,y+2.45,zc-3.1,2.2,.65,0);
  box(sx*11,y+3.02,zc,1.2,.06,.3,materials.glow);
  // Shelving, vents, lockers, and pipework give each annex the same industrial character.
  for(let k=0;k<3;k++){box(sx*(6.7+k*.65),y+1.1,zc+2.9,.6,2.2,.5,materials.metal);box(sx*(6.7+k*.65),y+1.65,zc+2.62,.35,.03,.03,materials.dark);}
  for(let yy=0;yy<3;yy++)box(sx*13.5,y+.6+yy*.65,zc-2.85,3,.08,.65,materials.metal);
  if(MELD_FLOORS.includes(n)){
    for(const dz of [-1.5,1.5])box(sx*15.9,y+1.55,zc+dz,3.4,3.1,.18,materials.metal);
    box(sx*14.2,y+2.7,zc,.18,.6,3,materials.yellow);
    sign('FIRE SHELTER\n→ STAY INSIDE',sx*16.8,y+1.85,zc-1.37,2.8,.7,0,'#e8dcb6','#6c432b');
    sign('FIRE SHELTER',sx*14.07,y+2.75,zc,2.5,.55,-sx*Math.PI/2,'#ffe4b7','#765131');
    sign('FIRE ALARM\n15s TO SHELTER',sx*12.8,y+2.1,zc+3.1,1.5,.55,Math.PI,'#efd7bd','#763623');
    const gate=box(sx*14.2,y+4.35,zc,.1,2.8,2.75,materials.metal);gate.userData={n,y,dynamic:true};gates.push(gate);
    const g=new T.Group();environment.add(g);g.position.set(0,y+.7,zc);const rand=seeded(n+57);
    for(let i=0;i<18;i++){const m=sphere((rand()-.5)*.7,rand()*2,(rand()-.5)*2.3,.25+rand()*.3,materials.meld,g);m.scale.y*=1.7;}
    for(let i=0;i<9;i++)beam([-.25,(i%3)*.6,(i/9-.5)*2.6],[.3,1.7,(i/9-.5)*2.6],.07,materials.meld,g);
    g.userData.n=n;batchGroup(g);melds.push(g);
  }
  for(const o of objectsForFloor(n,run||makeRun()))makeProp(o);
}
function makeProp(o){
  const g=new T.Group();environment.add(g);g.position.set(o.x,o.y,o.z);g.userData.object=o;props.push(g);
  const b=(x,y,z,w,h,d,m)=>box(x,y,z,w,h,d,m,g);
  switch(o.kind){
    case 'scrap':b(0,.27,0,.6,.14,.45,materials.rust).rotation.z=.12;b(.1,.38,.1,.28,.08,.5,materials.metal);break;
    case 'battery':b(0,.35,0,.25,.5,.18,materials.dark);b(0,.48,-.1,.22,.09,.03,materials.yellow);break;
    case 'bandage':b(0,.25,0,.42,.24,.32,materials.glow);b(0,.38,0,.25,.02,.07,materials.red);b(0,.38,0,.07,.02,.2,materials.red);break;
    case 'grinder':b(0,.65,0,1.1,1.3,.9,materials.metal);b(0,1.3,0,.8,.1,.7,materials.dark);b(0,.35,-.48,.7,.4,.05,materials.yellow);b(.47,1.1,-.47,.1,.1,.06,materials.green);break;
    case 'alarm':b(0,1.15,0,.26,.4,.12,materials.red);b(0,1.08,-.08,.17,.035,.07,materials.glow);break;
    case 'tv':b(0,.55,0,.85,.7,.55,materials.dark);b(0,.6,-.29,.63,.45,.02,materials.tvStatic);for(const x of [-.28,.28])beam([x,.91,0],[x*2,1.2,.05],.015,materials.metal,g);break;
    case 'stem':sphere(0,.32,0,.3,materials.meld,g);sphere(-.1,.39,-.26,.025,materials.dark,g);sphere(.1,.39,-.26,.025,materials.dark,g);break;
    case 'garage':b(0,1.35,0,.16,2.7,1.8,materials.metal);for(let i=0;i<12;i++)b(-o.x/Math.abs(o.x)*.1,.1+i*.22,0,.04,.025,1.78,materials.dark);break;
    case 'cobbler':
      b(0,.75,0,2,1.5,.85,materials.rust);sphere(0,1.82,.2,.35,materials.stone,g);b(0,1.47,.2,.75,.5,.55,materials.dark);b(0,2.03,.2,.9,.15,.75,materials.dark);sphere(-.13,1.85,-.13,.04,materials.green,g);sphere(.13,1.85,-.13,.04,materials.green,g);break;
    case 'shoplight':b(0,.35,0,.3,.7,.3,materials.yellow);break;
    case 'shopheal':b(0,.3,0,.5,.4,.4,materials.glow);b(0,.51,0,.26,.02,.08,materials.red);break;
    case 'exit':
      b(0,1.5,0,.3,3,2.1,materials.metal);b(-Math.sign(o.x)*.2,1.4,.6,.07,.3,.09,materials.yellow);
      sign('EXIT\nTHE MINES',o.x-Math.sign(o.x)*.19,o.y+2.6,o.z,1.8,.65,-Math.sign(o.x)*Math.PI/2,'#dbe5c3','#2c492e');break;
    case 'startdoor':b(0,1.3,0,.15,2.6,2.2,materials.metal);break;
    case 'shelter':g.visible=false;break;
  }
  batchGroup(g);
}
function disposeChunk(chunk){
  chunk.traverse(o=>{if(o.isInstancedMesh)o.dispose();if(o.userData.owned){o.geometry.dispose();o.material.dispose();const key=o.userData.signKey,cached=signTextures.get(key);if(cached&&--cached.refs===0){cached.tex.dispose();signTextures.delete(key);}}});
  environment.remove(chunk);
}
function rebuild(center,force=false){
  if(!environment){environment=new T.Group();scene.add(environment);}
  const low=quality<=.7,lo=Math.max(0,center-(low?2:3)),hi=Math.min(FLIGHTS,center+(low?3:4));
  for(const [n,chunk]of chunks)if(force||n<lo||n>hi){disposeChunk(chunk);chunks.delete(n);}
  const root=environment;
  for(let n=lo;n<=hi;n++)if(!chunks.has(n)){
    props.length=0;melds.length=0;gates.length=0;environment=new T.Group();
    if(n<FLIGHTS)flight(n);else{const l=landing(n);box(0,l.y-.18,l.z,9.6,.36,2.85,materials.floor);}
    if(ROOM_FLOORS.includes(n))room(n);batchGroup(environment);
    environment.userData={props:[...props],melds:[...melds],gates:[...gates]};chunks.set(n,environment);root.add(environment);
  }
  environment=root;props.length=0;melds.length=0;gates.length=0;
  for(const chunk of chunks.values()){props.push(...chunk.userData.props);melds.push(...chunk.userData.melds);gates.push(...chunk.userData.gates);}
  visibleFloor=center;
}
function configureLights(){
  for(const light of landingLights)scene.remove(light);landingLights.length=0;
  const count=quality<=.7?1:quality===1?3:4;
  for(let i=0;i<count;i++){const light=new T.PointLight('#c3d8a0',4.8,11,1.8);scene.add(light);landingLights.push(light);}
  fireEffects.count=quality<=.7?24:quality===1?48:80;
  document.body.classList.toggle('performance-mode',quality<=.7);
}
function entityModels(){
  creakModel=new T.Group();scene.add(creakModel);
  box(0,1.7,0,.57,.75,.42,materials.stone,creakModel);sphere(0,2.33,0,.28,materials.stone,creakModel);
  for(const s of [-1,1]){
    beam([s*.2,1.45,0],[s*.3,.72,.13],.075,materials.rust,creakModel);beam([s*.3,.72,.13],[s*.4,.08,0],.07,materials.rust,creakModel);
    box(s*.4,.1,-.14,.2,.18,.48,materials.stone,creakModel);
    const arm=new T.Group();arm.position.set(s*.3,1.95,0);creakModel.add(arm);arm.userData.side=s;
    beam([0,0,0],[s*.1,-.6,.03],.055,materials.rust,arm);beam([s*.1,-.6,.03],[s*.15,-1.1,-.12],.05,materials.rust,arm);
    for(let f=0;f<3;f++)beam([s*.15,-1.05,-.12],[s*(.13+f*.06),-1.4,-.25],.018,materials.rust,arm);
    batchGroup(arm);creakArms.push(arm);
  }
  sphere(0,2.34,-.255,.09,materials.dark,creakModel);sphere(0,2.34,-.335,.035,materials.green,creakModel);
  creakModel.visible=false;
  batchGroup(creakModel);
  noiseModel=new T.Group();scene.add(noiseModel);box(0,1.12,0,.45,1.3,.25,materials.noise,noiseModel);sphere(0,1.98,0,.26,materials.noise,noiseModel);
  for(const s of [-1,1]){beam([s*.2,1.6,0],[s*.5,.7,0],.075,materials.noise,noiseModel);beam([s*.12,.5,0],[s*.2,0,0],.075,materials.noise,noiseModel);sphere(s*.09,2,-.24,.04,materials.green,noiseModel);}noiseModel.visible=false;
  batchGroup(noiseModel);
  stemModel=new T.Group();camera.add(stemModel);sphere(.3,-.28,-.6,.16,materials.meld,stemModel);sphere(.25,-.24,-.47,.018,materials.dark,stemModel);sphere(.35,-.24,-.47,.018,materials.dark,stemModel);stemModel.visible=false;
  heldLight=new T.Group();camera.add(heldLight);beam([.24,-.3,-.35],[.29,-.29,-.63],.065,materials.dark,heldLight);box(.29,-.29,-.67,.14,.12,.05,materials.yellow,heldLight);
  fireEffects=new T.InstancedMesh(sphereGeometry,new T.MeshBasicNodeMaterial({color:'#e4a45c',transparent:true,opacity:.65}),80);scene.add(fireEffects);fireEffects.visible=false;
  gripModel=new T.Group();camera.add(gripModel);const handMaterial=new T.MeshBasicNodeMaterial({color:'#82917d'});box(0,0,0,.11,.12,.08,handMaterial,gripModel);
  beam([-.35,-.15,-.08],[0,0,0],.025,materials.rust,gripModel);
  for(let i=0;i<3;i++)beam([-.04+i*.04,.06,0],[-.05+i*.04,.15,.04],.018,handMaterial,gripModel);
  batchGroup(gripModel);gripModel.visible=false;
}
async function init(){
  try{
    scene=new T.Scene();scene.background=new T.Color('#070a07');scene.fog=new T.FogExp2('#10160e',.035);
    camera=new T.PerspectiveCamera(66,innerWidth/innerHeight,.06,65);camera.rotation.order='YXZ';scene.add(camera);
    renderer=new T.WebGPURenderer({canvas,antialias:!lowPower,forceWebGL:lowPower||!navigator.gpu,powerPreference:'high-performance'});
    resize();renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
    await renderer.init();buildMaterials();
    hemi=new T.HemisphereLight('#b2c29b','#252820',.42);scene.add(hemi);ambient=new T.AmbientLight('#728062',.2);scene.add(ambient);
    torch=new T.SpotLight('#fff0ce',16,24,.47,.55,1.6);torchTarget=new T.Object3D();scene.add(torch,torchTarget);torch.target=torchTarget;
    entityModels();configureLights();rebuild(1);$('quality').value=String(quality);$('start').disabled=false;$('start').innerHTML='Enter the Rarewell <span>↗</span>';
    requestAnimationFrame(tick);window.stairwell={ready:true,state:()=>run?{status:run.status,floor:run.floor,health:run.health,player:{...run.player},scrap:run.scrap,alarm:run.alarm,practice:run.practice}:null};
    if(new URLSearchParams(location.search).has('qa'))window.stairwell.qa={teleport:(n,x,z)=>{run.player={x:x??landing(n).side*7,y:n*RISE,z:z??landing(n).z};updateRun(run,0);rebuild(n);camera.position.set(run.player.x,run.player.y+1.65,run.player.z);updateHud();},look:(y,p=0)=>{yaw=y;pitch=p;camera.rotation.set(p,y,0);},object:kind=>objectsForFloor(run.floor,run).find(o=>o.kind===kind),use:kind=>{const o=objectsForFloor(run.floor,run).find(o=>o.kind===kind);if(o){run.player={x:o.x,y:o.y,z:o.z};interact(run,o);}},advance:(seconds)=>{for(let i=0;i<seconds*20;i++)updateRun(run,.05);updateHud();},graphics:()=>({backend:renderer.backend.isWebGLBackend?'webgl':'webgpu',quality,pixels:canvas.width*canvas.height,pointLights:landingLights.length,chunks:[...chunks].map(([n,g])=>({n,id:g.uuid})),signTextures:signTextures.size,frame,draws:renderer.info.render.drawCalls,noiseVisible:noiseModel.visible,noiseOpaque:!materials.noise.transparent,aggression:run?.creak.aggression,gripVisible:gripModel.visible}),raw:()=>run};
  }catch(e){show('error');$('error-text').textContent='The 3D renderer could not start. Enable WebGL2 or try an updated Chrome, Edge, Firefox, or Safari.';console.error(e);}
}
function lock(){if(matchMedia('(pointer:fine)').matches)canvas.requestPointerLock?.()?.catch?.(()=>{});}
function start(){
  audio.start();run=makeRun({practice:$('practice').checked,shakelight:$('shakelight').checked,garageKey:$('garage-key').checked});
  yaw=Math.PI;pitch=0;cameraHeight=1.65;healthBefore=100;footstep=0;last=performance.now();playing=true;paused=false;keys.clear();nearest=null;camera.position.set(run.player.x,run.player.y+1.65,run.player.z);
  rebuild(0,true);show('hud');$('mode-label').textContent=run.practice?'EXPLORE MODE':'D00RS: THE RAREWELL';message(run,'Climb to Landing 200. Follow the Rarewell upward.',6);lock();tone(140,.4,.08);
}
function pause(){if(!playing||paused)return;paused=true;keys.clear();joystick={x:0,y:0};touchSprint=false;show('pause');document.exitPointerLock?.();}
function resume(){if(!playing)return;paused=false;keys.clear();show('hud');audio.start();lock();last=performance.now();}
function openModal(id,from){modalFrom=from;if(playing&&!paused){paused=true;keys.clear();document.exitPointerLock?.();}show(id);}
function closeModal(){show(modalFrom);}
function entrance(){playing=false;paused=false;run=null;keys.clear();document.exitPointerLock?.();rebuild(1,true);show('menu');}
function use(){if(!playing||paused)return;if(interact(run,nearest)){tone(nearest.kind==='alarm'?680:220,.15,.08);if(nearest.kind==='tv')tone(55,.45,.2,'triangle');}}
function lamp(){if(run&&playing&&!paused){run.lamp=!run.lamp;tone(120,.035,.08);}}
function shake(){if(run&&playing&&!paused&&run.shakelight){run.battery=clamp(run.battery+25,0,100);message(run,'Shakelight recharged.');tone(150,.2,.08,'triangle');}}
function throwStem(){if(run&&playing&&!paused&&run.stem&&!run.stem.thrown){run.stem.thrown=true;run.stem.n=run.floor;message(run,'Stem thrown. Fire the sprinklers to turn it into ceramic.');}}
function finish(){
  if(!playing)return;playing=false;paused=true;document.exitPointerLock?.();show('result');
  const won=run.status==='won';$('result-eyebrow').textContent=won?'ACCESS GRANTED':'SIGNAL LOST';$('result-title').textContent=won?'You made it.':'You died.';
  $('result-cause').textContent=won?'The staircase ends. You return to the Mines, with the sound of rebar fading behind you.':run.cause;
  $('result-floor').textContent=run.best;$('badges').textContent=run.badges.size?'Earned: '+[...run.badges].join(' · '):'Every attempt teaches you something.';
  if(run.best>record){record=run.best;$('record').textContent=`BEST / ${record}`;try{localStorage.setItem('turbo-stairwell-best',String(record));}catch{}}
  tone(won?240:48,1,.15,'triangle');
}
function selectObject(){
  nearest=null;let best=0;const facing=new T.Vector3();camera.getWorldDirection(facing);
  for(const g of props){const o=g.userData.object;if(run.collected.has(o.id)||o.kind==='shelter'||(o.kind==='tv'&&run.noiseCleared.has(o.n))||(o.kind==='alarm'&&run.cleared.has(o.n)))continue;
    const dx=o.x-run.player.x,dz=o.z-run.player.z,dist=Math.hypot(dx,dz);
    if(dist>2.65||Math.abs(o.y-run.player.y)>1)continue;
    const dot=(dx*facing.x+dz*facing.z)/(dist||1),score=dot-dist*.09;
    if((dot>.35||dist<.6)&&score>best){best=score;nearest=o;}
  }
  $('interact').hidden=!nearest;if(nearest)$('interact-label').textContent=nearest.name;
}
function gamepad(dt){
  const p=[...(navigator.getGamepads?.()||[])].find(Boolean);if(!p)return {x:0,z:0,run:false};
  const dead=v=>Math.abs(v)<.15?0:v;
  yaw-=dead(p.axes[2]||0)*dt*2*sensitivity;pitch=clamp(pitch-dead(p.axes[3]||0)*dt*1.5*sensitivity,-1.4,1.4);
  const rising=i=>p.buttons[i]?.pressed&&!gamepadButtons[i];if(rising(0))use();if(rising(1))lamp();if(rising(2))shake();if(rising(3))throwStem();if(rising(4))yaw+=Math.PI;if(rising(9))pause();
  gamepadButtons=p.buttons.map(b=>b.pressed);return {x:dead(p.axes[0]||0),z:-dead(p.axes[1]||0),run:!!p.buttons[7]?.pressed};
}
function gameplay(dt){
  const gp=gamepad(dt);if(paused)return;
  let side=(keys.has('KeyD')?1:0)-(keys.has('KeyA')?1:0)+joystick.x+gp.x;
  let forward=(keys.has('KeyW')||keys.has('ArrowUp')?1:0)-(keys.has('KeyS')||keys.has('ArrowDown')?1:0)-joystick.y+gp.z;
  if(keys.has('ArrowLeft'))yaw+=dt*1.8;if(keys.has('ArrowRight'))yaw-=dt*1.8;
  const len=Math.hypot(side,forward);if(len>1){side/=len;forward/=len;}
  const crouch=keys.has('KeyC'),sprint=(keys.has('ShiftLeft')||keys.has('ShiftRight')||touchSprint||gp.run)&&run.stamina>1&&!crouch;
  const speed=crouch?1.5:sprint?5.2:3.3;
  const dx=(Math.cos(yaw)*side-Math.sin(yaw)*forward)*speed*dt,dz=(-Math.sin(yaw)*side-Math.cos(yaw)*forward)*speed*dt;
  moved=len>.05&&movePlayer(run,dx,dz);let lookDot=0;
  run.yaw=yaw;run.pitch=pitch;camera.rotation.set(pitch,yaw,0);
  if(run.creak.active){const p=creakPosition(run);creakVector.set(p.x-run.player.x,p.y+1.6-camera.position.y,p.z-run.player.z).normalize();camera.getWorldDirection(viewDirection);lookDot=creakVector.dot(viewDirection);
    if(lookDot>.78&&!hasLineOfSight(camera.position,{x:p.x,y:p.y+1.6,z:p.z},run))lookDot=0;}
  updateRun(run,dt,{moving:moved,sprinting:sprint,lookDot});
  const targetHeight=crouch?1.04:1.65;cameraHeight+=(targetHeight-cameraHeight)*Math.min(1,dt*10);
  if(moved){footstep+=dt*(sprint?2.9:crouch?1.1:2.1);if(Math.floor(footstep)!==Math.floor(footstep-dt*(sprint?2.9:crouch?1.1:2.1)))tone(75+Math.random()*22,.09,.075,'triangle');}
  const bob=moved?Math.sin(footstep*Math.PI*2)*.027:0;
  camera.position.x=run.player.x;camera.position.z=run.player.z;camera.position.y+=(run.player.y+cameraHeight+bob-camera.position.y)*Math.min(1,dt*22);
  camera.rotation.set(pitch,yaw,0);const targetFov=sprint&&moved?73:66;camera.fov+=(targetFov-camera.fov)*Math.min(1,dt*5);camera.updateProjectionMatrix();
  if(Math.abs(run.floor-visibleFloor)>=2)rebuild(run.floor);
  if(run.health<healthBefore){damageFlash=.7;healthBefore=run.health;}
  healthBefore=run.health;damageFlash=Math.max(0,damageFlash-dt*1.4);$('damage').style.opacity=damageFlash;
  if(run.status!=='playing'){finish();return;}
}
function syncGameVisuals(dt){
  if(!run)return;
  for(const g of props){const o=g.userData.object;g.visible=o.kind!=='shelter'&&!run.collected.has(o.id)&&!(o.kind==='tv'&&run.noiseCleared.has(o.n));if((o.kind==='startdoor'||o.kind==='garage')&&run.opened.has(o.id))g.position.y=o.y+3;}
  for(const g of melds)g.visible=!run.cleared.has(g.userData.n);
  for(const g of gates){const a=run.alarm,gated=a?.n===g.userData.n&&a.phase==='fire';g.position.y+=(g.userData.y+(gated?1.45:4.35)-g.position.y)*Math.min(1,dt*4);}
  creakModel.visible=run.status==='playing'&&run.creak.active;
  if(creakModel.visible){const p=creakPosition(run);creakModel.position.set(p.x,p.y,p.z);creakModel.lookAt(run.player.x,p.y,run.player.z);creakModel.rotation.y+=Math.PI;creakModel.rotation.z=Math.sin(run.time*3)*.02;
    for(const arm of creakArms){arm.rotation.z=arm.userData.side*2.9*(1-run.creak.aggression);arm.scale.y=.45+.55*run.creak.aggression;}}
  const no=run.noise,range=no?Math.hypot(no.x-run.player.x,no.y-run.player.y,no.z-run.player.z):Infinity;
  // Keep the camera outside the static body, even in hazard-free explore mode.
  noiseModel.visible=run.status==='playing'&&!!no&&range>.85&&range<30;
  if(no){noiseModel.position.set(no.x,no.y,no.z);noiseModel.lookAt(run.player.x,no.y,run.player.z);noiseModel.rotation.y+=Math.PI;}
  const tile=Math.floor(run.time*8)%8;staticTexture.offset.set((tile%4)*.25,Math.floor(tile/4)*.5);
  gripModel.visible=run.status==='playing'&&run.creak.state==='hand';
  if(gripModel.visible){const edge=Math.tan(T.MathUtils.degToRad(camera.fov/2))*camera.aspect*.48;gripModel.position.set(-edge+.04+(1-run.creak.hand/2.8)*.1,-.16,-.48);}
  stemModel.visible=!!run.stem&&!run.stem.thrown;heldLight.visible=!stemModel.visible;
  if(!paused&&run.creak.active&&run.creak.speed>.05&&Math.abs(run.route-run.creak.s)<20&&Math.floor(run.time*2)!==Math.floor((run.time-dt)*2))tone(95,.3,run.creak.state==='sneaking'?.12:.05,'sawtooth');
  if(playing&&!paused&&run.alarm&&Math.floor(run.time*2)!==Math.floor((run.time-dt)*2))tone(run.alarm.phase==='fire'?390:780,.22,.12,'triangle');
}
function updateHud(){
  $('floor').textContent=100+run.floor;$('health-value').textContent=Math.ceil(run.health);$('health-meter').style.width=run.health+'%';$('stamina-meter').style.width=run.stamina+'%';
  $('carry').textContent='CARRY '+run.inventory;$('scrap').textContent='SCRAP '+run.scrap;$('gold').textContent='GOLD '+run.gold;
  $('battery').textContent=Math.ceil(run.battery)+'%';$('lamp-label').textContent=run.shakelight?'SHAKELIGHT':'FLASHLIGHT';$('lamp-button').style.opacity=run.lamp?'1':'.5';
  $('touch-shake').disabled=!run.shakelight;$('touch-throw').disabled=!run.stem||run.stem.thrown;
  $('feedback').textContent=run.feedback;$('feedback').style.opacity=run.feedbackTime>0?'1':'0';
  $('alarm-banner').hidden=!run.alarm;if(run.alarm){$('alarm-time').textContent=Math.ceil(run.alarm.remaining);$('alarm-text').textContent=run.alarm.phase==='fire'?'SPRINKLERS ACTIVE':'SEEK FIRE SHELTER';}
}
function tick(now){
  if(!renderer)return;
  requestAnimationFrame(tick);const active=playing&&!paused,targetMs=active?(quality<=.7?1000/30:1000/60):1000/12;
  if(last&&now-last<targetMs-.8)return;
  const elapsed=(now-(last||now))/1000,dt=Math.min(.25,elapsed);last=now;frame++;
  if(active){if(elapsed>targetMs*.001*1.4)slowFrames++;else slowFrames=Math.max(0,slowFrames-2);
    if(slowFrames>12&&renderScale>.55){renderScale=Math.max(.55,renderScale-.1);slowFrames=0;resize();}}
  if(active){const count=Math.max(1,Math.ceil(dt/.05));for(let i=0;i<count&&playing&&!paused;i++)gameplay(dt/count);
    if(playing){selectObject();if(now-hudAt>100){updateHud();hudAt=now;}}}
  if(run)syncGameVisuals(dt);
  if(playing&&paused&&!$('pause').hidden){const p=[...(navigator.getGamepads?.()||[])].find(Boolean);if(p){const pressed=p.buttons[9]?.pressed;if(pressed&&!gamepadButtons[9])resume();gamepadButtons=p.buttons.map(b=>b.pressed);}}
  if(!playing&&!run){camera.position.set(-3.3,2.35,-5.7);camera.lookAt(1.9,4.1,3.7);camera.position.x+=Math.sin(now*.00012)*.12;creakModel.visible=noiseModel.visible=stemModel.visible=heldLight.visible=gripModel.visible=false;}
  camera.getWorldDirection(viewDirection);torch.position.copy(camera.position);torchTarget.position.copy(camera.position).addScaledVector(viewDirection,8);
  torch.intensity=playing?(run?.lamp&&run.battery>0?run.shakelight?12:20:0):6;
  ambient.intensity=.2*brightness;hemi.intensity=.56*brightness;renderer.toneMappingExposure=brightness;
  const level=run?run.floor:1;
  for(let i=0;i<landingLights.length;i++){const n=clamp(level+(i===0?0:i%2?Math.ceil(i/2):-i/2),0,FLIGHTS),l=landing(n),light=landingLights[i];
    const annex=i===0&&ROOM_FLOORS.includes(n)&&run&&run.player.x*l.side>5;
    light.position.set(annex?l.side*11:0,l.y+2.5,l.z);light.color.set(annex?'#d7ab74':'#c3d8a0');
    light.intensity=4.8*brightness*(run?.alarm?.phase==='countdown'&&Math.floor(now/300)%2===0?.32:1);}
  fireEffects.visible=run?.alarm?.phase==='fire';
  if(fireEffects.visible){const l=landing(run.alarm.n);for(let i=0;i<fireEffects.count;i++){const x=i%2?l.side*(5+(i*1.79)%9):((i*1.31)%8)-4,z=l.z+((i*.71)%2.5)-1.25,y=l.y+3-((now*.003+i*.13)%3);tempPosition.set(x,y,z);tempScale.set(.035,.12,.035);tempMatrix.compose(tempPosition,tempQuat.identity(),tempScale);fireEffects.setMatrixAt(i,tempMatrix);}fireEffects.instanceMatrix.needsUpdate=true;}
  try{renderer.render(scene,camera);}catch(e){console.error(e);show('error');playing=false;renderer=null;}
}
function resize(){if(!renderer)return;camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();
  const budget=quality<=.7?450000:quality===1?1000000:1800000;
  const ratio=Math.min(devicePixelRatio,quality===1.5?1.5:1,Math.sqrt(budget/(innerWidth*innerHeight)))*renderScale;
  renderer.setPixelRatio(ratio);renderer.setSize(innerWidth,innerHeight);}

$('start').onclick=start;$('resume').onclick=resume;$('restart').onclick=start;$('result-retry').onclick=start;$('result-menu').onclick=entrance;$('pause-open').onclick=pause;
$('guide-open').onclick=()=>openModal('guide','menu');$('pause-guide').onclick=()=>openModal('guide','pause');$('guide-close').onclick=closeModal;
$('settings-open').onclick=()=>openModal('settings','menu');$('pause-settings').onclick=()=>openModal('settings','pause');$('settings-close').onclick=closeModal;
$('lamp-button').onclick=lamp;$('touch-interact').onclick=use;$('touch-lookback').onclick=()=>{yaw+=Math.PI;};
$('touch-shake').onclick=shake;$('touch-throw').onclick=throwStem;
$('sound').onchange=e=>{soundEnabled=e.target.checked;if(audio.master)audio.master.gain.value=soundEnabled?.38:0;};
$('brightness').oninput=e=>brightness=Number(e.target.value);$('sensitivity').oninput=e=>sensitivity=Number(e.target.value);$('quality').onchange=e=>{quality=Number(e.target.value);renderScale=1;slowFrames=0;configureLights();rebuild(run?run.floor:1);resize();try{localStorage.setItem('turbo-rarewell-quality',String(quality));}catch{}};
$('fullscreen').onclick=()=>{if(document.fullscreenElement)document.exitFullscreen?.();else document.documentElement.requestFullscreen?.()?.catch?.(()=>{});};
addEventListener('resize',resize);addEventListener('blur',pause);document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
document.addEventListener('pointerlockchange',()=>{if(!document.pointerLockElement&&playing&&!paused)pause();});
document.addEventListener('mousemove',e=>{if(playing&&!paused&&document.pointerLockElement===canvas){yaw-=e.movementX*.0022*sensitivity;pitch=clamp(pitch-e.movementY*.0022*sensitivity,-1.4,1.4);}});
canvas.addEventListener('pointerdown',e=>{if(!playing||paused)return;if(e.pointerType==='mouse'){lock();touchLook={id:e.pointerId,x:e.clientX,y:e.clientY,mouse:true};}else if(e.clientX>innerWidth*.38){touchLook={id:e.pointerId,x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);}});
canvas.addEventListener('pointermove',e=>{if(touchLook?.id===e.pointerId&&playing&&!paused&&document.pointerLockElement!==canvas){yaw-=(e.clientX-touchLook.x)*.004*sensitivity;pitch=clamp(pitch-(e.clientY-touchLook.y)*.004*sensitivity,-1.4,1.4);touchLook.x=e.clientX;touchLook.y=e.clientY;}});
for(const type of ['pointerup','pointercancel'])canvas.addEventListener(type,()=>{touchLook=null;});
addEventListener('keydown',e=>{
  if(e.target instanceof HTMLInputElement||e.target instanceof HTMLSelectElement)return;
  if(e.code==='Escape'){if(!playing)return;if(paused&&$('pause').hidden===false)resume();else if(!paused)pause();else closeModal();return;}
  if(!playing||paused)return;if(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code))e.preventDefault();
  keys.add(e.code);if(e.repeat)return;if(e.code==='KeyE')use();if(e.code==='KeyF')lamp();
  if(e.code==='KeyB')yaw+=Math.PI;
  if(e.code==='KeyR')shake();if(e.code==='KeyQ')throwStem();
});addEventListener('keyup',e=>keys.delete(e.code));
const joy=$('joystick');let joyPointer=null;
function joyMove(e){const rect=joy.getBoundingClientRect(),x=(e.clientX-rect.left-56)/40,y=(e.clientY-rect.top-56)/40,len=Math.max(1,Math.hypot(x,y));joystick={x:x/len,y:y/len};$('stick').style.transform=`translate(${joystick.x*35}px,${joystick.y*35}px)`;}
joy.onpointerdown=e=>{joyPointer=e.pointerId;joy.setPointerCapture(e.pointerId);joyMove(e);};joy.onpointermove=e=>{if(e.pointerId===joyPointer)joyMove(e);};
for(const type of ['pointerup','pointercancel'])joy.addEventListener(type,()=>{joyPointer=null;joystick={x:0,y:0};$('stick').style.transform='';});
$('touch-run').onpointerdown=e=>{touchSprint=true;e.target.setPointerCapture(e.pointerId);};for(const type of ['pointerup','pointercancel'])$('touch-run').addEventListener(type,()=>touchSprint=false);
show('menu');init();
