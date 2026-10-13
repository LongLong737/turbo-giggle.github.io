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
    opened:new Set(),alarm:null,creak:{s:-16,gaze:0,active:false,retreat:0},noise:null,
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
  const l=landing(n);return run.player.x*l.side>14.5&&Math.abs(run.player.z-l.z)<1.2&&Math.abs(run.player.y-l.y)<0.45;
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
      run.alarm={n:o.n,remaining:15,phase:'countdown'};message(run,'FIRE ALARM · 15 seconds. Get inside the fire shelter!',5);break;
    case 'shelter':message(run,'Stay inside the shelter until the sprinklers stop.');break;
    case 'tv':if(run.noise?.n===o.n)run.noise=null;run.noiseCleared.add(o.n);run.badges.add('Plug and Play');run.creak.retreat=4;message(run,'The television tumbles down the stairs. Its Noise is gone.');break;
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
  if(!run.practice&&run.maxRoute>6*12)run.creak.active=true;
  if(run.creak.active) {
    const c=run.creak;
    if(c.s<0)c.s=run.route-32;
    c.gaze=lookDot>0.82?c.gaze+dt:Math.max(0,c.gaze-dt*1.5);
    if(c.retreat>0){c.s=Math.max(0,c.s-dt*8);c.retreat-=dt;}
    else c.s=Math.min(run.maxRoute-1,c.s+dt*(c.gaze>3.2?3.4:lookDot>0.82?0.2:0.95));
    const p=pathPoint(c.s);
    if(Math.hypot(p.x-run.player.x,p.z-run.player.z)<1.15&&Math.abs(p.y-run.player.y)<1.6)damage(run,100,'Creak caught you. Keep moving, keep your distance, and check behind you briefly.');
  }
  const n=run.floor,l=landing(n),inRoom=ROOM_FLOORS.includes(n)&&run.player.x*l.side>4.3&&Math.abs(run.player.y-l.y)<0.4;
  if(inRoom&&!MELD_FLOORS.includes(n)&&n>0&&n<99&&!run.noiseCleared.has(n)&&!run.noise) {
    run.noise={n,x:5*l.side,y:l.y,z:l.z,age:0,trail:[]};message(run,'A television crackles. Noise copies your movement. Push the television.');
  }
  if(run.noise) {
    const no=run.noise;no.age+=dt;no.trail.push({t:run.time,x:run.player.x,y:run.player.y,z:run.player.z});
    while(no.trail.length>1&&no.trail[1].t<run.time-.65)no.trail.shift();
    if(no.age>2&&moving) {
      const past=no.trail[0],dx=past.x-no.x,dy=past.y-no.y,dz=past.z-no.z,len=Math.hypot(dx,dy,dz)||1;
      no.x+=dx/len*dt*1.1;no.y+=dy/len*dt*1.1;no.z+=dz/len*dt*1.1;
    }
    if(no.age>2&&Math.hypot(no.x-run.player.x,no.z-run.player.z)<0.7&&Math.abs(no.y-run.player.y)<1)damage(run,25*dt,'Noise reached you. Stop moving and push its television down the stairs.');
  }
  if(run.alarm) {
    const a=run.alarm;a.remaining-=dt;
    if(a.phase==='countdown'&&a.remaining<=0){a.phase='fire';a.remaining=6;message(run,'SPRINKLERS ACTIVE · stay in the fire shelter.',6);}
    if(a.phase==='fire') {
      if(Math.abs(run.player.y-a.n*RISE)<2&&!isSheltered(run,a.n))damage(run,32*dt,'The sprinklers caught you. Pull the alarm, then get inside the marked fire shelter within 15 seconds.');
      if(run.noise?.n===a.n){run.noise=null;run.noiseCleared.add(a.n);}
      if(run.stem?.thrown&&run.stem.n===a.n&&!run.stem.cooked){run.stem.cooked=true;run.inventory+=5;run.badges.add('Clay World');message(run,'Stem fired into ceramic. +5 items to grind.');}
    }
    if(a.phase==='fire'&&a.remaining<=0){run.cleared.add(a.n);run.creak.retreat=8;run.alarm=null;message(run,'The Meld has burned away. The staircase is clear.');}
  }
}
