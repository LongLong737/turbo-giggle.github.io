export const FLIGHTS = 100;
export const RISE = 3.2;
export const STEPS = 16;
export const MELD_FLOORS = [12, 28, 44, 61, 78, 92];
export const ROOM_FLOORS = [...new Set([0, 8, 20, 36, 52, 68, 84, 99, 100, ...MELD_FLOORS])].sort((a,b)=>a-b);
export const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
export function seeded(seed) { let n = seed >>> 0; return ()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;}; }
export function landing(n) { return {x:0,y:n*RISE,z:n%2 ? 4.8 : -4.8,side:n===0?-1:((n-1)%2===0?-1:1)}; }
export function pathPoint(s) {
  s=clamp(s,0,FLIGHTS*12);
  const n=Math.min(FLIGHTS-1,Math.floor(s/12)),t=s-n*12,even=n%2===0;
  const x=even?-2.5:2.5,from=even?-4:4,dir=even?1:-1;
  if(t<8) return {x,y:n*RISE+t/8*RISE,z:from+dir*t};
  return {x:x+(even?1:-1)*5*(t-8)/4,y:(n+1)*RISE,z:-from};
}
export function routePosition(p) {
  const base=clamp(Math.floor(p.y/RISE),0,FLIGHTS-1);
  let best=0,dist=Infinity;
  for(let n=Math.max(0,base-1);n<=Math.min(FLIGHTS-1,base+1);n++) {
    const even=n%2===0, x=even?-2.5:2.5,from=even?-4:4,dir=even?1:-1;
    const t=clamp((p.z-from)*dir,0,8);
    const s=n*12+t,a=pathPoint(s),d=(p.x-a.x)**2+(p.z-a.z)**2+4*(p.y-a.y)**2;
    if(d<dist){dist=d;best=s;}
    const u=clamp((p.x-x)*(even?1:-1)/5,0,1),b=pathPoint(n*12+8+u*4);
    const e=(p.x-b.x)**2+(p.z-b.z)**2+4*(p.y-b.y)**2;
    if(e<dist){dist=e;best=n*12+8+u*4;}
  }
  return best;
}
export function makeRun({practice=false,shakelight=false,garageKey=false}={}) {
  return {player:{x:-2.5,y:0,z:-5.1},yaw:Math.PI,pitch:0,health:100,battery:100,stamina:100,
    lamp:true,practice,shakelight,garageKey,inventory:0,scrap:0,gold:0,time:0,best:100,
    floor:0,route:0,maxRoute:0,status:'playing',cause:'',cleared:new Set(),collected:new Set(),
    opened:new Set(),alarm:null,creak:{s:-16,gaze:0,active:false,retreat:0,aggression:0,unseen:0,hand:0,state:'dormant',cooldown:0,phase:0,speed:0,position:null},noise:null,
    noiseCleared:new Set(),stem:null,badges:new Set(),feedback:'',feedbackTime:0};
}
export function blockedByMeld(run,x,z,y) {
  const n=Math.round(y/RISE),l=landing(n);
  return MELD_FLOORS.includes(n)&&!run.cleared.has(n)&&Math.abs(y-n*RISE)<0.4&&Math.abs(x)<0.65&&Math.abs(z-l.z)<1.55;
}
export function groundAt(x,z,currentY,run) {
  if(Math.abs(z)>8.05) return null;
  const b=Math.round(currentY/RISE),candidates=[];
  for(let n=Math.max(0,b-2);n<=Math.min(FLIGHTS,b+2);n++) {
    const l=landing(n);
    if(Math.abs(x)<=4.55&&Math.abs(z-l.z)<1.25) candidates.push(n*RISE);
    if(ROOM_FLOORS.includes(n)&&x*l.side>=4.2&&x*l.side<=17.5&&Math.abs(z-l.z)<3.05) {
      // The fire shelter's two side walls and the room's partition have real collision.
      const sx=x*l.side,dz=z-l.z;
      const partition=Math.abs(sx-10.5)<0.35&&dz>0.5;
      const shelterWall=sx>14.2&&Math.abs(Math.abs(dz)-1.4)<0.22;
      if(!partition&&!shelterWall)candidates.push(n*RISE);
    }
    if(n<FLIGHTS) {
      const even=n%2===0,lane=even?-2.5:2.5;
      if(Math.abs(x-lane)<1.7&&z>=-4&&z<=4) {
        const t=clamp((z+(even?4:-4))*(even?1:-1)/8,0,1);
        candidates.push(n*RISE+Math.ceil(t*STEPS)/STEPS*RISE);
      }
    }
  }
  candidates.sort((a,b)=>Math.abs(a-currentY)-Math.abs(b-currentY));
  const y=candidates[0];
  if(y===undefined||Math.abs(y-currentY)>0.48||blockedByMeld(run,x,z,y))return null;
  return y;
}
export function movePlayer(run,dx,dz) {
  let moved=false;
  // Substeps prevent crossing barriers when sprinting or resuming a slow frame.
  const count=Math.max(1,Math.ceil(Math.hypot(dx,dz)/0.12));
  for(let i=0;i<count;i++) {
    for(const axis of ['x','z']) {
      const nx=run.player.x+(axis==='x'?dx/count:0),nz=run.player.z+(axis==='z'?dz/count:0);
      const y=groundAt(nx,nz,run.player.y,run);
      if(y!==null){run.player.x=nx;run.player.z=nz;run.player.y=y;moved=true;}
    }
  }
  return moved;
}
export function objectsForFloor(n,run) {
  if(!ROOM_FLOORS.includes(n))return [];
  const l=landing(n),at=(kind,name,x,z,extra={})=>({id:`${n}-${kind}`,kind,name,n,x:x*l.side,y:l.y,z:l.z+z,...extra});
  const list=[];
  if(n===100) return [at('exit','Return to the Mines',15.5,0)];
  if(n===99) return [at('cobbler','Cobbler · exchange scrap',9,0),at('shoplight','Buy battery · 3 gold',13,-2),at('shopheal','Buy bandage · 5 gold',15,-2),at('exit','Exit · Landing 200',17,0)];
  if(n===0) return [at('startdoor','Release the Rarewell gate',6.5,0)];
  list.push(at('scrap','Pick up scrap',7.5,-2,{value:3}),at('battery','Pick up battery',9,-2,{value:30}),
    at('grinder','Grind carried items',8,2),at('bandage','Pick up bandage',13.5,-2,{value:30}));
  if(MELD_FLOORS.includes(n))list.push(at('alarm','Pull fire alarm',12.8,2.65),at('shelter','Enter fire shelter',15.9,0));
  else list.push(at('tv','Push Noise’s television',5.15,0),at('stem','Pick up Stem',12.5,1.8),at('garage','Unlock garage · requires key',17,-2));
  return list.filter(o=>!run.collected.has(o.id)&&!(o.kind==='tv'&&run.noiseCleared.has(n))&&!(o.kind==='alarm'&&run.cleared.has(n)));
}
export function message(run,text,seconds=4) {run.feedback=text;run.feedbackTime=seconds;}
export function damage(run,amount,cause) {
  if(run.practice||run.status!=='playing')return;
  run.health=Math.max(0,run.health-amount);
  if(run.health===0){run.status='dead';run.cause=cause;}
}
export function isSheltered(run,n) {
  return insideShelter(run.player,n);
}
function insideShelter(p,n) { const l=landing(n);return p.x*l.side>14.5&&Math.abs(p.z-l.z)<1.2&&Math.abs(p.y-l.y)<0.45; }
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
function recordFootstep(actor,p) {
  const last=actor.trail.at(-1);
  if(!last||distance(last,p)>.035)actor.trail.push({x:p.x,y:p.y,z:p.z});
}
function followFootsteps(actor,amount,keepBehind=0) {
  const trail=actor.trail;let cursor=actor.cursor||0,budget=Math.abs(amount);
  // Walk each recorded segment, including corners and stairs. Never shortcut to the player.
  for(let steps=0;budget>1e-6&&steps<128;steps++) {
    const index=amount>=0?Math.floor(cursor):Math.ceil(cursor)-1;
    if(index<0||index>=trail.length-1)break;
    const length=distance(trail[index],trail[index+1]);
    if(length<1e-6){cursor=amount>=0?index+1:index;continue;}
    const remaining=length*(amount>=0?index+1-cursor:cursor-index);
    if(budget<remaining){cursor+=(amount>=0?1:-1)*budget/length;budget=0;}
    else{budget-=remaining;cursor=amount>=0?index+1:index;}
  }
  actor.cursor=cursor;
  if(trail.length){const i=Math.floor(cursor),a=trail[i],b=trail[Math.min(i+1,trail.length-1)],t=cursor-i,p=actor.position||actor;
    p.x=a.x+(b.x-a.x)*t;p.y=a.y+(b.y-a.y)*t;p.z=a.z+(b.z-a.z)*t;}
  const remove=Math.floor(cursor)-keepBehind;
  if(remove>64){actor.trail=trail.slice(remove);actor.cursor-=remove;}
}
export function creakPosition(run) { return run.creak.position||pathPoint(run.creak.s); }
export function hasLineOfSight(from,to,run) {
  const atPlane=(axis,value)=>{const d=to[axis]-from[axis];if(Math.abs(d)<1e-6)return null;const t=(value-from[axis])/d;
    return t>.001&&t<.999?{x:from.x+(to.x-from.x)*t,y:from.y+(to.y-from.y)*t,z:from.z+(to.z-from.z)*t}:null;};
  for(const x of [-4.8,4.8]){const p=atPlane('x',x);if(!p)continue;const n=Math.floor(p.y/RISE),l=landing(n);
    if(!ROOM_FLOORS.includes(n)||Math.sign(x)!==l.side||Math.abs(p.z-l.z)>1.45||p.y-l.y>2.8)return false;}
  for(let n=Math.max(0,Math.floor(Math.min(from.y,to.y)/RISE));n<=Math.min(FLIGHTS,Math.floor(Math.max(from.y,to.y)/RISE));n++){
    const l=landing(n),p=atPlane('y',l.y);
    if(p&&((Math.abs(p.x)<4.8&&Math.abs(p.z-l.z)<1.45)||(ROOM_FLOORS.includes(n)&&p.x*l.side>4.2&&p.x*l.side<17.6&&Math.abs(p.z-l.z)<3.25)))return false;
    if(MELD_FLOORS.includes(n)&&!run.cleared.has(n)){const m=atPlane('x',0);if(m&&m.y>l.y&&m.y<l.y+2.9&&Math.abs(m.z-l.z)<1.55)return false;}
  }
  for(const n of ROOM_FLOORS){const l=landing(n),p=atPlane('x',10.5*l.side);
    if(p&&p.y>l.y&&p.y<l.y+3.2&&p.z-l.z>.5&&p.z-l.z<3.25)return false;
    if(MELD_FLOORS.includes(n))for(const dz of [-1.4,1.4]){const w=atPlane('z',l.z+dz);
      if(w&&w.y>l.y&&w.y<l.y+3.1&&w.x*l.side>14.2&&w.x*l.side<17.6)return false;}
  }
  return true;
}
function retreatCreak(c,seconds) {c.state='retreating';c.retreat=Math.max(c.retreat,seconds);c.hand=0;c.unseen=0;c.cooldown=3;c.aggression=Math.min(c.aggression,.35);}
function updateCreak(run,dt,lookDot) {
  const c=run.creak;
  if(!c.active)return;
  if(!c.position){c.s=Math.max(0,run.route-18);c.position={...pathPoint(c.s)};c.trail=[];
    const start=Math.max(0,c.s-12);for(let s=start;s<run.route;s+=.5)c.trail.push(pathPoint(s));
    c.trail.push({...run.player});c.cursor=(c.s-start)/.5;c.state='watching';c.phase=1.4;}
  recordFootstep(c,run.player);
  const before={...c.position},range=distance(c.position,run.player),seen=lookDot>.78&&range<24;
  if(range<.5){damage(run,100,'You walked into Creak. Keep your distance and never backtrack through it.');return;}
  c.gaze=seen?c.gaze+dt:0;c.unseen=seen?0:c.unseen+dt;c.cooldown=Math.max(0,c.cooldown-dt);
  c.aggression=clamp(c.aggression+dt*((seen?(c.gaze>.9?.38:.12):-.1)+(range<2?.28:0)),0,1);
  if(c.aggression>.55&&!c.warned){message(run,'Creak is lowering its hands. Look away and keep your distance.');c.warned=true;}
  if(c.aggression<.25)c.warned=false;
  if(c.aggression>=1)c.state='aggressive';
  if(c.state==='aggressive') {
    followFootsteps(c,dt*7.5,32);
    if(distance(c.position,run.player)<.85)damage(run,100,'Creak was provoked. Brief peeks are safe; prolonged staring or crowding it raises its aggression.');
  }else if(c.state==='hand') {
    if(seen){retreatCreak(c,6);run.badges.add('Paparazzi');message(run,'Creak recoils. Keep your peeks brief.');}
    else{followFootsteps(c,Math.min(dt*5.2,Math.max(0,range-1.05)),32);c.hand-=dt;
      if(c.hand<=0)damage(run,100,'Creak snuck up behind you. When its left hand reaches into view, turn around to scare it off.');}
  }else if(c.retreat>0) {
    c.state='retreating';c.hand=0;c.retreat=Math.max(0,c.retreat-dt);followFootsteps(c,-dt*2.4,32);
    if(c.retreat===0){c.state='watching';c.unseen=0;c.phase=1.4;c.cooldown=3;}
  }else if(seen) {
    c.state='watching';followFootsteps(c,-dt*.8,32);
    if(c.gaze>.24&&c.aggression<.5)retreatCreak(c,4);
  }else if(c.cooldown>0) {
    c.state='watching';
  }else if(c.unseen>18) {
    c.state='sneaking';followFootsteps(c,Math.min(dt*5,Math.max(0,range-1.1)),32);
  }else {
    c.phase-=dt;
    if(c.phase<=0){c.state=c.state==='stalking'?'watching':'stalking';c.phase=c.state==='stalking'?2.4:1.4;}
    if(c.state==='stalking')followFootsteps(c,Math.min(dt*.85,Math.max(0,range-1.1)),32);
  }
  c.s=routePosition(c.position);c.speed=dt>0?distance(before,c.position)/dt:0;
  if(!seen&&c.retreat<=0&&c.cooldown===0&&c.state!=='aggressive'&&c.state!=='hand'&&distance(c.position,run.player)<1.3){
    c.state='hand';c.hand=2.8;message(run,'A hand reaches around your shoulder. Turn around!',2.8);}
  if(c.state!=='hand'&&distance(c.position,run.player)<.5)damage(run,100,'You walked into Creak. Keep your distance and never backtrack through it.');
  if(run.route<c.s-1.3&&distance(c.position,run.player)<2.5)damage(run,100,'You crossed behind Creak. Continue upward instead of walking back through the stalker.');
}
export function interact(run,o) {
  if(!o||run.status!=='playing')return false;
  if(run.collected.has(o.id)||(o.kind==='tv'&&run.noiseCleared.has(o.n))||(o.kind==='alarm'&&run.cleared.has(o.n)))return false;
  if(Math.hypot(o.x-run.player.x,o.z-run.player.z)>2.65||Math.abs(o.y-run.player.y)>1)return false;
  switch(o.kind) {
    case 'scrap':run.inventory+=o.value;run.collected.add(o.id);message(run,'Scrap collected. Take it to a grinder.');break;
    case 'battery':run.battery=clamp(run.battery+30,0,100);run.collected.add(o.id);message(run,'Battery +30%');break;
    case 'bandage':run.health=clamp(run.health+30,0,100);run.collected.add(o.id);message(run,'Bandage · health restored');break;
    case 'grinder':
      if(!run.inventory){message(run,'Bring scrap or a cooked Stem to the grinder.');break;}
      run.scrap+=run.inventory;run.inventory=0;run.badges.add('Grindset');message(run,'Items ground into scrap. Cobbler buys scrap at Landing 199.');break;
    case 'alarm':
      if(run.alarm){message(run,'The fire system is already active.');break;}
      run.alarm={n:o.n,remaining:15,phase:'countdown'};retreatCreak(run.creak,18);message(run,'FIRE ALARM · 15 seconds. Get inside the fire shelter!',5);break;
    case 'shelter':message(run,'Stay inside the shelter until the sprinklers stop.');break;
    case 'tv':{const own=run.noise?.n===o.n;if(own)run.noise=null;run.noiseCleared.add(o.n);run.badges.add('Plug and Play');retreatCreak(run.creak,4);
      message(run,own?'Noise fizzles out as its television breaks.':run.noise?'TV destroyed. The active Noise belongs to a different television.':'TV destroyed. It can no longer spawn Noise.');break;}
    case 'stem':
      if(run.stem){message(run,'You can only carry one Stem. Press Q to throw it.');break;}
      run.stem={n:o.n,cooked:false};run.collected.add(o.id);message(run,'Stem picked up. Q throws it; fire turns it into ceramic.');break;
    case 'garage':
      if(!run.garageKey){message(run,'A garage key is required. Choose one before a new run.');break;}
      if(run.opened.has(o.id)){message(run,'The garage is empty.');break;}
      run.garageKey=false;run.opened.add(o.id);run.inventory+=12;run.badges.add('Garage Sale');message(run,'Garage unlocked. +12 items to grind.');break;
    case 'cobbler':
      if(!run.scrap){message(run,'Cobbler: “Bring me some scrap, friend.”');break;}
      run.gold+=run.scrap;run.scrap=0;message(run,'Cobbler exchanges your scrap for gold.');break;
    case 'shoplight':if(run.gold>=3){run.gold-=3;run.battery=100;message(run,'Battery refilled.');}else message(run,'You need 3 gold.');break;
    case 'shopheal':if(run.gold>=5){run.gold-=5;run.health=100;message(run,'Health restored.');}else message(run,'You need 5 gold.');break;
    case 'exit':run.status='won';run.best=200;run.floor=FLIGHTS;run.badges.add('Access Granted');break;
    case 'startdoor':run.opened.add(o.id);message(run,'A hundred landings above you. Something is following.');break;
    default:return false;
  }
  return true;
}
export function updateRun(run,dt,{moving=false,sprinting=false,lookDot=0}={}) {
  if(run.status!=='playing')return;
  dt=clamp(dt,0,0.1);run.time+=dt;run.feedbackTime=Math.max(0,run.feedbackTime-dt);
  run.route=routePosition(run.player);run.maxRoute=Math.max(run.maxRoute,run.route);
  run.floor=clamp(Math.floor((run.player.y+0.08)/RISE),0,FLIGHTS);
  run.best=Math.max(run.best,100+run.floor);
  run.stamina=clamp(run.stamina+(sprinting&&moving?-23:16)*dt,0,100);
  if(run.lamp)run.battery=Math.max(0,run.battery-(run.shakelight?.18:.055)*dt);
  if(!run.practice&&run.maxRoute>10*12)run.creak.active=true;
  updateCreak(run,dt,lookDot);
  const n=run.floor,l=landing(n),inRoom=ROOM_FLOORS.includes(n)&&run.player.x*l.side>4.3&&Math.abs(run.player.y-l.y)<0.4;
  if(inRoom&&!MELD_FLOORS.includes(n)&&n>0&&n<99&&!run.noiseCleared.has(n)&&!run.noise) {
    const start={x:5*l.side,y:l.y,z:l.z};
    run.noise={n,...start,age:0,cursor:0,fastForward:0,trail:[start,{...run.player}]};message(run,'A television crackles. Noise follows your footsteps. Push its television.');
  }
  if(run.noise) {
    const no=run.noise;no.age+=dt;recordFootstep(no,run.player);
    if(no.age>2&&distance(no,run.player)>18&&!(no.fastForward>0)){no.fastForward=2.2;message(run,'Noise is fast-forwarding. Stay off your earlier path.');}
    const fast=no.fastForward>0;no.fastForward=Math.max(0,(no.fastForward||0)-dt);
    if(no.age>2&&(moving||fast))followFootsteps(no,dt*(fast?6.5:2.4));
    if(no.age>2&&distance(no,run.player)<.65)damage(run,100,'You collided with Noise. It retraces your footsteps; avoid doubling back into it and destroy its own television.');
  }
  if(run.alarm) {
    const a=run.alarm;a.remaining-=dt;
    if(a.phase==='countdown'&&a.remaining<=0){a.phase='fire';a.remaining=6;message(run,'SPRINKLERS ACTIVE · stay in the fire shelter.',6);}
    if(a.phase==='fire') {
      if(Math.abs(run.player.y-a.n*RISE)<2&&!isSheltered(run,a.n))damage(run,32*dt,'The sprinklers caught you. Pull the alarm, then get inside the marked fire shelter within 15 seconds.');
      if(run.noise&&Math.abs(run.noise.y-a.n*RISE)<2&&!insideShelter(run.noise,a.n)){run.noiseCleared.add(run.noise.n);run.noise=null;}
      if(run.stem?.thrown&&run.stem.n===a.n&&!run.stem.cooked){run.stem.cooked=true;run.inventory+=5;run.badges.add('Clay World');message(run,'Stem fired into ceramic. +5 items to grind.');}
    }
    if(a.phase==='fire'&&a.remaining<=0){run.cleared.add(a.n);retreatCreak(run.creak,8);run.alarm=null;message(run,'The Meld has burned away. The staircase is clear.');}
  }
}
