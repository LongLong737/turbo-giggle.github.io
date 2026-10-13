import test from 'node:test';
import assert from 'node:assert/strict';
import {makeRun,updateRun,interact,objectsForFloor,pathPoint,landing,RISE,creakPosition,hasLineOfSight} from '../stairwell-world.mjs';
const step=(r,seconds,input={})=>{for(let i=0;i<Math.round(seconds/.05);i++)updateRun(r,.05,input);};
const spawnNoise=()=>{const r=makeRun({practice:true});r.player={x:7,y:8*RISE,z:landing(8).z};updateRun(r,.05);step(r,2.2);return r;};
const spawnCreak=()=>{const r=makeRun();r.player=pathPoint(130);updateRun(r,.05);return r;};
test('Noise follows recorded corners and stairs rather than homing across them',()=>{
 const r=spawnNoise(),z=r.player.z;
 r.player.x=9;updateRun(r,.05,{moving:true});r.player.z=z-2;updateRun(r,.05,{moving:true});
 let sawCorner=false;
 for(let i=0;i<55;i++){updateRun(r,.05,{moving:true});const no=r.noise;
  if(no.x<8.999)assert.ok(Math.abs(no.z-z)<1e-8,'Noise cut the corner');
  if(no.z<z-.05){assert.ok(Math.abs(no.x-9)<1e-8);sawCorner=true;}}
 assert.ok(sawCorner);
 const no=r.noise,old={x:no.x,y:no.y,z:no.z};step(r,1,{moving:false});assert.deepEqual({x:no.x,y:no.y,z:no.z},old);
});
test('Noise cannot overshoot a short final segment or oscillate around the player',()=>{
 const r=spawnNoise();r.player.x=5.02;r.noise.trail=[{x:5,y:r.player.y,z:r.player.z},{...r.player}];r.noise.cursor=0;
 step(r,.2,{moving:true});assert.equal(r.noise.x,5.02);step(r,.3,{moving:true});assert.equal(r.noise.x,5.02);
});
test('Noise fast-forwards only when far behind, and contact is fatal',()=>{
 const r=spawnNoise();r.player={x:30,y:8*RISE,z:landing(8).z};const x=r.noise.x;updateRun(r,.05,{moving:false});
 assert.ok(r.noise.fastForward>0);assert.ok(r.noise.x>x,'Catch-up should move even while the player is still');
 r.practice=false;r.player={x:r.noise.x,y:r.noise.y,z:r.noise.z};updateRun(r,.05);assert.equal(r.status,'dead');assert.match(r.cause,/Noise/);
});
test('Only the host TV removes Noise and it stays removed',()=>{
 const r=spawnNoise(),wrong=objectsForFloor(20,r).find(o=>o.kind==='tv');r.player={x:wrong.x,y:wrong.y,z:wrong.z};interact(r,wrong);assert.ok(r.noise);
 const own=objectsForFloor(8,r).find(o=>o.kind==='tv');r.player={x:own.x,y:own.y,z:own.z};interact(r,own);assert.equal(r.noise,null);
 updateRun(r,.05);assert.equal(r.noise,null);assert.ok(r.noiseCleared.has(8));
});
test('Fire burns Noise at its current location, even when its TV is on another landing',()=>{
 const r=spawnNoise(),l=landing(12);r.noise.x=12;r.noise.y=l.y;r.noise.z=l.z;
 r.player={x:16,y:l.y,z:l.z};r.alarm={n:12,phase:'fire',remaining:6};updateRun(r,.05);
 assert.equal(r.noise,null);assert.ok(r.noiseCleared.has(8));
});
test('Creak waits, creeps in intervals, and backs off after a brief look',()=>{
 const r=spawnCreak();assert.ok(r.creak.active);const p={...creakPosition(r)};
 step(r,1);assert.deepEqual(creakPosition(r),p,'Creak should not constantly chase');
 step(r,2);assert.notDeepEqual(creakPosition(r),p);const cursor=r.creak.cursor;
 step(r,.4,{lookDot:1});assert.equal(r.creak.state,'retreating');assert.ok(r.creak.cursor<cursor);assert.equal(r.status,'playing');
});
test('Prolonged staring raises Creak aggression and lowers its hands before an attack',()=>{
 const r=spawnCreak();step(r,4,{lookDot:1});assert.ok(r.creak.aggression>.9);assert.equal(r.creak.state,'aggressive');
});
function setupSneak(){const r=spawnCreak();r.creak.position=pathPoint(129.2);r.creak.trail=[{...r.creak.position},{...r.player}];r.creak.cursor=0;r.creak.phase=1.4;return r;}
test('Creak warns with its hand and can be scared off before the sneak attack',()=>{
 const r=setupSneak();updateRun(r,.05);assert.equal(r.creak.state,'hand');assert.equal(r.status,'playing');
 step(r,1);assert.equal(r.status,'playing');updateRun(r,.05,{lookDot:1});
 assert.equal(r.creak.state,'retreating');assert.equal(r.creak.hand,0);assert.ok(r.badges.has('Paparazzi'));assert.equal(r.status,'playing');
});
test('Ignoring the hand warning is fatal; touching Creak is also fatal',()=>{
 const r=setupSneak();updateRun(r,.05);step(r,3);assert.equal(r.status,'dead');assert.match(r.cause,/snuck/);
 const contact=spawnCreak();contact.player={...contact.creak.position};updateRun(contact,.05);assert.equal(contact.status,'dead');
});
test('A fire alarm interrupts a Creak sneak attack',()=>{
 const r=setupSneak();updateRun(r,.05);const alarm=objectsForFloor(12,r).find(o=>o.kind==='alarm');r.player={x:alarm.x,y:alarm.y,z:alarm.z};
 interact(r,alarm);assert.equal(r.creak.state,'retreating');assert.equal(r.creak.hand,0);assert.ok(r.creak.retreat>=18);
});
test('Creak cannot react to a stare through a depot partition or a solid floor',()=>{
 const r=makeRun(),y=8*RISE+1.6,z=landing(8).z;
 assert.equal(hasLineOfSight({x:9,y,z:z+2},{x:12,y,z:z+2},r),false);
 assert.equal(hasLineOfSight({x:9,y,z:z-1},{x:12,y,z:z-1},r),true);
 assert.equal(hasLineOfSight({x:2,y:8*RISE+1,z},{x:2,y:8*RISE-1,z},r),false);
});
