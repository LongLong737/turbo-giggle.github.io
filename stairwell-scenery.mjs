// Small shared textures and batched primitives keep the detail affordable on laptops.
export function surfaceTexture(T,seeded,kind='concrete') {
  const c=document.createElement('canvas');c.width=512;c.height=256;
  const ctx=c.getContext('2d'),rand=seeded(kind==='floor'?63:72),pixels=ctx.createImageData(c.width,c.height);
  for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++){
    const i=(y*c.width+x)*4,v=rand()*19-9,paint=kind==='paint'&&y>120;
    const base=kind==='floor'?[111,115,106]:paint?[91,109,99]:[175,172,155];
    pixels.data[i]=base[0]+v;pixels.data[i+1]=base[1]+v;pixels.data[i+2]=base[2]+v;pixels.data[i+3]=255;
  }
  ctx.putImageData(pixels,0,0);
  // Formwork joints, mineral streaks, and chips are baked once, without decals or extra passes.
  ctx.strokeStyle='#252d2948';ctx.lineWidth=2;
  for(let y=0;y<=256;y+=64){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(512,y);ctx.stroke();}
  for(let row=0;row<4;row++)for(let x=(row%2)*128;x<512;x+=256){ctx.beginPath();ctx.moveTo(x,row*64);ctx.lineTo(x,(row+1)*64);ctx.stroke();}
  for(let i=0;i<70;i++){
    const x=rand()*512,y=rand()*256;
    ctx.fillStyle=kind==='floor'?'#c5c5a71b':'#343b2c20';ctx.fillRect(x,y,1+rand()*5,8+rand()*56);
    ctx.fillStyle='#e1dbc927';ctx.fillRect(x+3,y,rand()*9,1);
  }
  for(let i=0;i<9;i++){
    let x=rand()*512,y=rand()*180;ctx.beginPath();ctx.moveTo(x,y);
    for(let j=0;j<5;j++){x+=rand()*13-6;y+=rand()*12;ctx.lineTo(x,y);}
    ctx.strokeStyle='#33382d55';ctx.lineWidth=.8;ctx.stroke();
  }
  if(kind==='paint'){
    ctx.fillStyle='#d8cfaa';ctx.fillRect(0,116,512,3);
    for(let i=0;i<95;i++){ctx.fillStyle='#a6a18c';ctx.fillRect(rand()*512,119+rand()*135,rand()*11,rand()*4);}
  }
  const texture=new T.CanvasTexture(c);texture.colorSpace=T.SRGBColorSpace;
  texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.anisotropy=2;return texture;
}

export function createSceneryBuilder({box,beam,sign,materials:m,landing,landingFixtures}) {
  const labels=['POWER DISTRIBUTION','WATER MAIN','SERVICE ACCESS','VENTILATION'];
  function landingDetails(n){
    const l=landing(n),y=l.y,s=Math.sign(l.z),face=s>0?Math.PI:0,z=s*6.18,variant=n%4;
    // A continuous painted dado and heavy wall piers make each landing read as a room.
    box(0,y+.57,s*6.22,9.3,1.1,.055,m.paint);
    box(0,y+.12,s*6.14,9.3,.16,.1,m.dark);
    for(const x of [-4.48,4.48]){
      box(x,y+1.6,s*6.12,.28,3.2,.26,m.wall);
      box(x,y+3.03,l.z,.3,.24,2.85,m.metal);
    }
    box(0,y+3.03,l.z,9.15,.24,.28,m.metal);
    for(const x of [-3.9,3.9]){
      beam([x,y+2.5,l.z],[x+Math.sign(x)*.5,y+3,l.z],.05,m.metal);
      box(x,y+2.98,l.z,.16,.12,.5,m.rust);
    }
    // Recessed inspection hatch, physical frame, louvres, and high-level cable trays.
    box(0,y+1.55,z,1.6,1.55,.1,m.metal);
    box(0,y+1.55,z-s*.065,1.38,1.31,.025,m.dark);
    for(let i=0;i<6;i++)box(0,y+1.07+i*.16,z-s*.09,1.2,.055,.025,m.metal);
    sign(labels[variant],0,y+2.55,z-s*.02,2.1,.25,face,'#c8c3aa','#343d35');
    box(0,y+2.84,z,8.6,.08,.15,m.dark);
    for(const x of [-3.8,-1.5,1.5,3.8])box(x,y+2.78,z,.06,.2,.19,m.metal);
    if(variant===1){
      for(const x of [-3.85,3.85]){
        beam([x,y,z],[x,y+3.2,z],.095,m.pipe);
        for(const h of [.5,2.2])box(x,y+h,z,.27,.09,.22,m.metal);
      }
      // A square valve wheel is deliberately built from shared rods.
      const x=3.85,vy=y+1.3,vz=z-s*.15;
      for(const dx of [-.17,.17])beam([x+dx,vy-.17,vz],[x+dx,vy+.17,vz],.025,m.red);
      for(const dy of [-.17,.17])beam([x-.17,vy+dy,vz],[x+.17,vy+dy,vz],.025,m.red);
    }else if(variant===0){
      for(const x of [-3.7,3.7]){
        box(x,y+1.65,z,.7,1.15,.15,m.metal);
        box(x,y+1.75,z-s*.09,.46,.44,.02,m.dark);
        box(x,y+1.26,z-s*.11,.3,.08,.03,m.yellow);
      }
    }else if(variant===2){
      box(3.55,y+1.42,z,1.05,2.5,.09,m.dark);
      box(3.55,y+1.42,z-s*.055,.89,2.31,.035,m.metal);
      box(3.23,y+1.3,z-s*.09,.06,.22,.04,m.rust);
      sign('MAINTENANCE',3.55,y+2.8,z-s*.03,1.3,.22,face);
    }else{
      for(const x of [-3.5,3.5]){
        box(x,y+1.8,z,1.1,.85,.1,m.dark);
        for(let i=0;i<5;i++)box(x,y+1.5+i*.14,z-s*.075,.96,.05,.07,m.metal);
      }
    }
    // Floor seams, worn yellow edge strips and drainage remain flat underfoot.
    for(const x of [-3,0,3])box(x,y+.008,l.z,.012,.008,2.5,m.dark);
    for(const x of [-2.5,2.5])box(x,y+.012,s*3.57,3.25,.015,.075,m.yellow);
    box(0,y+.01,s*5.94,2.15,.012,.16,m.dark);
    for(let i=0;i<12;i++)box(-1+i*.18,y+.019,s*5.94,.045,.014,.16,m.metal);
    for(const fixture of landingFixtures(n)){
      const {x,z,w,d,type}=fixture,h=type==='cabinet'?1.3:.62;
      box(x,y+h/2,z,w,h,d,type==='cabinet'?m.metal:m.rust);
      if(type==='cabinet'){
        box(x,y+.76,z-s*(d/2+.008),w*.8,.7,.016,m.dark);
        box(x+w*.3,y+.72,z-s*(d/2+.025),.055,.24,.035,m.yellow);
      }else{
        for(const dx of [-w*.32,w*.32])box(x+dx,y+.34,z,.055,.67,d+.015,m.metal);
        box(x,y+.63,z,w+.04,.06,d+.04,m.metal);
      }
    }
  }
  function depotDetails(n){
    const l=landing(n),y=l.y,s=l.side,zc=l.z,variant=Math.floor(n/4)%3;
    // Bays and ceiling beams break up the long annex without filling its escape route.
    for(const x of [5.2,10.5,17.3]){
      box(s*x,y+3.02,zc,.22,.3,6.25,m.metal);
      for(const dz of [-3.05,3.05])box(s*x,y+1.5,zc+dz,.22,3,.17,m.metal);
    }
    for(const dz of [-3.1,3.1]){
      box(s*11,y+.55,zc+dz,12.4,1.05,.04,m.paint);
      box(s*11,y+.12,zc+dz,12.4,.12,.09,m.dark);
    }
    beam([s*5,y+2.77,zc-2.5],[s*17.3,y+2.77,zc-2.5],.075,m.pipe);
    for(const x of [6,9,12,15])box(s*x,y+2.84,zc-2.5,.08,.2,.3,m.metal);
    box(s*11,y+3.08,zc+.7,12,.07,.45,m.dark);
    for(const x of [6,9,12,15])box(s*x,y+3.03,zc+.7,.1,.08,.55,m.metal);
    for(const x of [8.5,13.5]){
      box(s*x,y+2.98,zc,1.3,.13,.38,m.dark);
      box(s*x,y+2.9,zc,1.05,.035,.2,m.glow);
    }
    // A service-window reveal on the partition gives the room a stronger silhouette.
    box(s*10.27,y+1.7,zc+1.7,.04,1.05,1.65,m.dark);
    for(const dz of [1.05,1.7,2.35])box(s*10.23,y+1.7,zc+dz,.07,1.06,.035,m.metal);
    sign(['ELECTRICAL BAY','PUMP CONTROL','SALVAGE STORE'][variant],s*14.2,y+2.55,zc-3.12,2.6,.32,0,'#d6c6a5','#383e34');
    // Wall-mounted diagrams, breaker rows, and tall ductwork stay outside the walking bounds.
    if(variant===0){
      for(const x of [11.6,12.3,13]){
        box(s*x,y+1.55,zc+3.11,.54,1.6,.13,m.metal);
        for(let i=0;i<4;i++)box(s*x,y+1.1+i*.22,zc+3.025,.26,.08,.025,m.dark);
      }
    }else if(variant===1){
      for(const x of [11.7,12.5,13.3]){
        beam([s*x,y,zc+3.13],[s*x,y+2.75,zc+3.13],.1,m.pipe);
        box(s*x,y+1.6,zc+3,.28,.28,.04,m.yellow);
      }
    }else{
      box(s*12.5,y+1.8,zc+3.12,2.8,1.3,.05,m.dark);
      sign('SALVAGE → GRIND → EXCHANGE',s*12.5,y+1.8,zc+3.075,2.5,.55,Math.PI,'#c4b98e','#343d35');
    }
    for(const x of [6,10,14])box(s*x,y+.008,zc,.012,.008,6,m.dark);
    // Door jambs and a threshold make the connection to the stairwell explicit.
    for(const dz of [-1.45,1.45])box(s*4.82,y+1.42,zc+dz,.27,2.84,.12,m.metal);
    box(s*4.82,y+2.79,zc,.27,.18,2.92,m.yellow);
    box(s*4.82,y+.014,zc,.32,.018,2.75,m.dark);
  }
  return {landingDetails,depotDetails};
}
