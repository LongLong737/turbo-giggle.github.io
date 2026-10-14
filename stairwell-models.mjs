// Shared low-poly models. Detail is grouped by primitive/material so it can be
// instanced without adding lights, transparent layers, or per-frame geometry.
export function createModelBuilder({T,scene,camera,materials,box,sphere,beam,batchGroup,sign}) {
  const m=materials;
  const b=(g,x,y,z,w,h,d,material)=>box(x,y,z,w,h,d,material,g);
  const s=(g,x,y,z,r,material,sx=1,sy=1,sz=1)=>{const o=sphere(x,y,z,r,material,g);o.scale.multiply(new T.Vector3(sx,sy,sz));return o;};
  const rod=(g,a,c,r,material)=>beam(a,c,r,material,g);
  function firstAid(g,width=.45) {
    b(g,0,.25,0,width,.28,.34,m.glow);b(g,0,.12,0,width+.025,.045,.365,m.metal);
    for(const x of [-width*.34,width*.34])b(g,x,.255,0,.035,.29,.35,m.rust);
    b(g,0,.397,0,.19,.024,.07,m.red);b(g,0,.399,0,.065,.024,.21,m.red);
    b(g,0,.25,-.176,.16,.045,.014,m.red);b(g,0,.25,-.18,.045,.16,.014,m.red);
    rod(g,[-.09,.4,.02],[-.09,.47,.02],.018,m.metal);rod(g,[.09,.4,.02],[.09,.47,.02],.018,m.metal);rod(g,[-.09,.47,.02],[.09,.47,.02],.018,m.metal);
  }
  function stem(g,x,y,z,scale=1) {
    const body=s(g,x,y,z,.28*scale,m.meld,1,.79,1);body.rotation.z=-.1;
    s(g,x-.12*scale,y+.075*scale,z-.17*scale,.14*scale,m.meld,1,.8,.8);
    s(g,x+.11*scale,y+.05*scale,z-.18*scale,.14*scale,m.meld,1,.8,.8);
    for(const side of [-1,1]){
      s(g,x+side*.1*scale,y+.07*scale,z-.267*scale,.047*scale,m.dark,1,.72,.38);
      s(g,x+side*.096*scale,y+.08*scale,z-.283*scale,.016*scale,m.yellow);
      rod(g,[x+side*.15*scale,y-.12*scale,z],[x+side*.25*scale,y-.23*scale,z+.08*scale],.038*scale,m.meld);
      rod(g,[x+side*.25*scale,y-.23*scale,z+.08*scale],[x+side*.31*scale,y-.23*scale,z-.035*scale],.025*scale,m.meld);
    }
    b(g,x,y-.02*scale,z-.271*scale,.13*scale,.028*scale,.018*scale,m.dark);
  }
  function buildProp(o,g) {
    switch(o.kind){
      case 'scrap': {
        const a=b(g,-.08,.16,0,.68,.05,.4,m.rust);a.rotation.set(.16,.24,-.15);
        const c=b(g,.04,.25,.02,.4,.04,.56,m.metal);c.rotation.set(-.3,-.2,.11);
        rod(g,[-.25,.12,.2],[.28,.3,-.13],.037,m.pipe);
        rod(g,[.28,.3,-.13],[.34,.38,-.1],.037,m.pipe);
        b(g,-.22,.25,-.1,.07,.18,.33,m.rust).rotation.z=.25;
        for(const x of [-.18,.16])s(g,x,.29,-.04,.035,m.metal);
        break;
      }
      case 'battery':
        b(g,0,.31,0,.25,.47,.18,m.dark);b(g,0,.56,0,.25,.055,.18,m.metal);
        b(g,0,.15,-.096,.22,.12,.017,m.yellow);b(g,0,.4,-.096,.2,.1,.017,m.yellow);
        rod(g,[-.062,.57,0],[-.062,.61,0],.034,m.metal);rod(g,[.063,.57,0],[.063,.605,0],.022,m.metal);
        b(g,0,.41,-.109,.08,.018,.01,m.dark);b(g,0,.41,-.111,.018,.07,.01,m.dark);
        break;
      case 'bandage':firstAid(g);break;
      case 'grinder':
        b(g,0,.08,0,1.22,.15,1.05,m.dark);b(g,0,.71,.04,1.02,1.05,.83,m.metal);
        for(const x of [-.44,.44])for(const z of [-.34,.35])b(g,x,.21,z,.13,.32,.13,m.rust);
        b(g,0,1.245,.03,.84,.09,.68,m.dark);
        for(const x of [-.47,.47]){const side=b(g,x,1.4,.025,.055,.32,.81,m.rust);side.rotation.z=-Math.sign(x)*.2;}
        for(const z of [-.39,.43]){const side=b(g,0,1.4,z,.94,.33,.055,m.rust);side.rotation.x=Math.sign(z)*.2;}
        for(const z of [-.18,.14])rod(g,[-.36,1.295,z],[.36,1.295,z],.09,m.metal);
        b(g,0,.66,-.405,.72,.35,.035,m.dark);b(g,0,.38,-.54,.81,.065,.39,m.rust);
        for(const x of [-.37,.37])b(g,x,.44,-.54,.04,.13,.39,m.metal);
        b(g,-.28,1.07,-.4,.38,.24,.1,m.yellow);s(g,-.35,1.085,-.465,.047,m.red);s(g,-.21,1.085,-.465,.047,m.green);
        b(g,.55,.77,.03,.25,.45,.55,m.dark);for(let i=0;i<4;i++)b(g,.56,.61+i*.1,.03,.29,.035,.57,m.metal);
        for(const x of [-.41,.41])for(const y of [.52,1.06])s(g,x,y,-.423,.026,m.rust);
        break;
      case 'alarm':
        b(g,0,1.2,0,.37,.53,.16,m.dark);b(g,0,1.2,-.07,.31,.46,.09,m.red);
        b(g,0,1.32,-.126,.21,.1,.017,m.glow);b(g,0,1.13,-.13,.2,.13,.026,m.dark);
        rod(g,[-.085,1.14,-.16],[.085,1.14,-.16],.025,m.metal);
        rod(g,[-.13,1.4,-.12],[.13,1.4,-.12],.012,m.metal);
        for(const x of [-.125,.125])s(g,x,1.03,-.125,.016,m.metal);
        break;
      case 'tv':
        for(const x of [-.29,.29])b(g,x,.095,.03,.12,.15,.39,m.rust);
        b(g,0,.49,.02,.95,.68,.53,m.rust);b(g,0,.49,-.27,.92,.64,.09,m.dark);
        b(g,-.075,.52,-.328,.68,.48,.036,m.metal);b(g,-.075,.52,-.35,.605,.398,.012,m.tvStatic);
        b(g,.355,.52,-.332,.14,.49,.03,m.rust);
        for(const y of [.65,.51]){rod(g,[.354,y,-.34],[.354,y,-.383],.044,m.dark);b(g,.354,y,-.407,.043,.012,.01,m.metal);}
        for(let i=0;i<5;i++)b(g,.356,.31+i*.021,-.353,.088,.007,.012,m.dark);
        for(let i=0;i<4;i++)b(g,-.2+i*.12,.841,.095,.062,.017,.21,m.dark);
        b(g,0,.853,.07,.22,.04,.17,m.dark);
        rod(g,[-.06,.87,.07],[-.38,1.24,.1],.012,m.metal);rod(g,[.06,.87,.07],[.39,1.1,.1],.012,m.metal);
        rod(g,[.35,.23,.26],[.44,.06,.42],.022,m.dark);rod(g,[.44,.06,.42],[.22,.04,.56],.022,m.dark);
        break;
      case 'stem':stem(g,0,.27,0);break;
      case 'garage': {
        const front=-Math.sign(o.x||1);
        b(g,0,1.35,0,.16,2.7,1.9,m.metal);
        for(let i=0;i<12;i++){b(g,front*.105,.16+i*.215,0,.065,.12,1.78,m.rust);b(g,front*.145,.1+i*.215,0,.022,.019,1.8,m.dark);}
        for(const z of [-1,1])b(g,0,1.38,z,.31,2.85,.12,m.dark);
        b(g,0,2.77,0,.34,.15,2.12,m.rust);b(g,front*.18,.52,0,.12,.12,.32,m.metal);
        rod(g,[front*.24,.54,-.16],[front*.24,.54,.16],.028,m.yellow);
        b(g,front*.2,1.25,.61,.065,.2,.14,m.yellow);break;
      }
      case 'cobbler':
        g.rotation.y=Math.sign(o.x||1)*Math.PI/2;
        b(g,0,.77,0,2.03,1.38,.93,m.rust);b(g,0,1.5,0,2.18,.13,1.06,m.metal);
        for(const x of [-.72,.72])b(g,x,.72,-.48,.075,1.22,.035,m.dark);
        for(const y of [.18,1.27])b(g,0,y,-.48,1.91,.065,.035,m.dark);
        b(g,0,.71,-.495,.92,.38,.018,m.yellow);
        for(let i=0;i<4;i++)b(g,-.28+i*.18,.71,-.51,.09,.055,.02,m.dark);
        b(g,0,1.75,.3,.65,.48,.44,m.dark);s(g,0,2.18,.25,.265,m.stone,1,.99,.87);
        b(g,0,2.12,-.002,.46,.13,.08,m.dark);
        for(const side of [-1,1]){
          s(g,side*.126,2.16,-.053,.038,m.green,1,.65,.45);
          rod(g,[side*.26,1.94,.27],[side*.52,1.67,.02],.08,m.dark);rod(g,[side*.52,1.67,.02],[side*.43,1.6,-.29],.065,m.stone);
          b(g,side*.43,1.595,-.31,.2,.08,.21,m.stone);
        }
        b(g,0,1.74,.05,.3,.35,.08,m.rust);b(g,0,2.39,.26,.84,.09,.68,m.dark);b(g,0,2.52,.29,.51,.22,.43,m.dark);
        b(g,0,2.43,.068,.51,.055,.02,m.yellow);
        b(g,-.7,1.61,-.18,.32,.14,.24,m.rust);rod(g,[.62,1.64,-.2],[.9,1.64,-.2],.03,m.metal);b(g,.9,1.67,-.2,.14,.07,.13,m.metal);
        break;
      case 'shoplight':
        rod(g,[0,.15,0],[0,.56,0],.12,m.dark);rod(g,[0,.52,0],[0,.68,0],.16,m.yellow);rod(g,[0,.68,0],[0,.7,0],.123,m.glow);
        for(const y of [.2,.3,.4])rod(g,[0,y-.018,0],[0,y+.018,0],.126,m.metal);
        b(g,0,.46,-.12,.06,.1,.022,m.yellow);break;
      case 'shopheal':firstAid(g,.55);break;
      case 'exit': {
        const front=-Math.sign(o.x||1);
        b(g,0,1.5,0,.25,3,2.18,m.metal);b(g,front*.15,1.53,0,.05,2.72,1.91,m.dark);b(g,front*.18,1.52,0,.035,2.63,1.79,m.metal);
        for(const z of [-1.17,1.17])b(g,0,1.54,z,.4,3.08,.14,m.rust);b(g,0,3.03,0,.4,.15,2.48,m.rust);
        b(g,front*.23,1.35,.37,.06,.13,.79,m.yellow);b(g,front*.2,2.13,0,.055,.48,.59,m.dark);
        for(const z of [-.29,0,.29])rod(g,[front*.238,1.9,z],[front*.238,2.36,z],.015,m.metal);
        sign('EXIT\nTHE MINES',o.x+front*.3,o.y+2.68,o.z,1.78,.47,front*Math.PI/2,'#dbe5c3','#2c492e');break;
      }
      case 'startdoor': {
        const front=-Math.sign(o.x||1);
        for(const z of [-1.13,1.13])b(g,0,1.35,z,.22,2.7,.13,m.rust);
        for(const y of [.12,1.28,2.62])b(g,0,y,0,.16,.13,2.3,m.metal);
        for(let i=0;i<8;i++)rod(g,[0,.15,-.97+i*.277],[0,2.6,-.97+i*.277],.029,m.metal);
        b(g,front*.11,1.2,.74,.16,.27,.22,m.yellow);b(g,front*.21,1.23,.74,.04,.075,.17,m.dark);break;
      }
      case 'shelter':g.visible=false;break;
    }
  }
  function buildEntities() {
    const creakArms=[],creakModel=new T.Group();scene.add(creakModel);
    // Slumped, broken concrete plates over narrow exposed rebar.
    const chest=b(creakModel,0,1.75,.07,.58,.7,.39,m.stone);chest.rotation.x=.19;chest.rotation.z=-.075;
    b(creakModel,-.11,1.54,.01,.35,.43,.34,m.stone).rotation.z=.2;
    const shoulders=b(creakModel,.025,2.005,.13,.73,.22,.38,m.stone);shoulders.rotation.z=-.055;
    b(creakModel,-.16,1.76,-.147,.05,.4,.014,m.dark).rotation.z=-.35;
    b(creakModel,.13,1.94,-.11,.045,.2,.03,m.dark).rotation.z=.49;
    rod(creakModel,[0,1.8,.24],[.02,2.15,.14],.065,m.rust);
    const head=s(creakModel,.025,2.315,-.01,.29,m.stone,.92,1.1,.88);head.rotation.z=-.11;
    b(creakModel,-.14,2.26,-.18,.12,.2,.15,m.stone).rotation.z=-.2;
    b(creakModel,.17,2.23,-.17,.1,.24,.11,m.stone).rotation.z=.17;
    s(creakModel,.018,2.355,-.256,.105,m.dark,1,.69,.35);
    s(creakModel,.019,2.357,-.294,.045,m.green,.7,1.04,.38);
    rod(creakModel,[-.21,2.47,-.167],[-.09,2.42,-.248],.014,m.dark);
    rod(creakModel,[-.09,2.42,-.248],[-.14,2.34,-.25],.012,m.dark);
    rod(creakModel,[.12,2.33,-.251],[.06,2.2,-.238],.012,m.dark);
    rod(creakModel,[.06,2.2,-.238],[.15,2.13,-.161],.012,m.dark);
    for(const side of [-1,1]){
      const knee=side<0?.68:.76;
      rod(creakModel,[side*.18,1.5,.05],[side*.29,knee,.15],.055,m.rust);
      rod(creakModel,[side*.29,knee,.15],[side*.38,.16,-.025],.047,m.rust);
      const thigh=b(creakModel,side*.235,1.11,.11,.17,.39,.19,m.stone);thigh.rotation.z=side*.13;
      b(creakModel,side*.29,knee,.12,.19,.16,.2,m.stone).rotation.z=-side*.2;
      b(creakModel,side*.38,.11,-.17,.24,.19,.5,m.stone).rotation.y=-side*.17;
      rod(creakModel,[side*.355,.24,-.01],[side*.37,.49,.09],.02,m.dark);
      const arm=new T.Group();arm.position.set(side*.31,1.94,.02);arm.userData.side=side;creakModel.add(arm);
      rod(arm,[0,0,0],[side*.12,-.53,.055],.052,m.rust);rod(arm,[side*.12,-.53,.055],[side*.1,-.99,-.22],.043,m.rust);
      const upper=b(arm,side*.065,-.22,.02,.155,.35,.16,m.stone);upper.rotation.z=side*.12;
      s(arm,side*.12,-.54,.045,.071,m.rust);
      const forearm=b(arm,side*.11,-.77,-.09,.12,.27,.13,m.stone);forearm.rotation.x=.45;
      b(arm,side*.1,-1.055,-.24,.19,.16,.12,m.stone).rotation.z=side*.07;
      for(let f=0;f<4;f++){
        const x=side*(.03+f*.047),length=f===0?.19:f===3?.24:.3;
        rod(arm,[x,-1.11,-.27],[x-side*.015,-1.2-length*.45,-.295],.021,m.stone);
        rod(arm,[x-side*.015,-1.2-length*.45,-.295],[x-side*.035,-1.18-length,-.36],.016,m.rust);
      }
      rod(arm,[side*.185,-1.04,-.21],[side*.255,-1.18,-.27],.027,m.stone);
      batchGroup(arm);creakArms.push(arm);
    }
    batchGroup(creakModel);creakModel.visible=false;
    // Opaque static and gaps in the silhouette avoid bright overlapping layers.
    const noiseModel=new T.Group();scene.add(noiseModel);
    b(noiseModel,-.035,1.23,0,.46,.7,.26,m.noise).rotation.z=-.09;
    b(noiseModel,.02,.77,.015,.32,.28,.23,m.noise).rotation.z=.14;
    b(noiseModel,.025,1.695,-.018,.16,.14,.18,m.noise);
    b(noiseModel,.01,1.91,-.035,.4,.34,.29,m.noise).rotation.z=.08;
    b(noiseModel,-.028,2.095,-.016,.34,.075,.25,m.noise);
    b(noiseModel,.06,1.835,-.06,.32,.045,.27,m.dark);
    for(const side of [-1,1]){
      const shift=side===-1?.08:0;
      rod(noiseModel,[side*.2,1.53,0],[side*.35,1.05+shift,.03],.071,m.noise);
      rod(noiseModel,[side*.35,1.02+shift,.03],[side*.4,.68+shift,-.08],.051,m.noise);
      b(noiseModel,side*.4,.63+shift,-.08,.13,.16,.13,m.noise);
      rod(noiseModel,[side*.11,.64,0],[side*.17,.36,side*.08],.079,m.noise);
      rod(noiseModel,[side*.17,.32,side*.08],[side*.21,.09,-.015],.061,m.noise);
      b(noiseModel,side*.21,.055,-.085,.16,.09,.3,m.noise);
      b(noiseModel,side*.09,1.975,-.187,.065,.023,.012,m.dark);
    }
    b(noiseModel,-.265,1.29,.01,.045,.12,.22,m.noise);b(noiseModel,.235,1.42,.01,.04,.07,.24,m.noise);
    batchGroup(noiseModel);noiseModel.visible=false;
    const stemModel=new T.Group();camera.add(stemModel);stem(stemModel,0,0,0,.58);stemModel.position.set(.3,-.29,-.64);stemModel.rotation.y=Math.PI;batchGroup(stemModel);stemModel.visible=false;
    const heldLight=new T.Group();camera.add(heldLight);
    rod(heldLight,[.25,-.3,-.33],[.29,-.29,-.61],.065,m.dark);
    for(let i=0;i<3;i++)rod(heldLight,[.257+i*.01,-.299+i*.002,-.38-i*.065],[.26+i*.01,-.298+i*.002,-.405-i*.065],.069,m.metal);
    rod(heldLight,[.29,-.29,-.585],[.297,-.287,-.68],.095,m.yellow);
    rod(heldLight,[.297,-.287,-.678],[.299,-.287,-.708],.098,m.dark);
    rod(heldLight,[.299,-.287,-.709],[.3,-.287,-.714],.08,m.glow);
    b(heldLight,.279,-.218,-.48,.035,.017,.055,m.yellow);batchGroup(heldLight);
    const fireGeometry=sphere(0,0,0,1,m.yellow,new T.Group()).geometry;
    const fireEffects=new T.InstancedMesh(fireGeometry,new T.MeshBasicNodeMaterial({color:'#e4a45c',transparent:true,opacity:.65}),80);scene.add(fireEffects);fireEffects.visible=false;
    const gripModel=new T.Group(),handMaterial=new T.MeshBasicNodeMaterial({color:'#82917d'});camera.add(gripModel);
    b(gripModel,0,0,0,.115,.12,.07,handMaterial);b(gripModel,-.075,-.044,-.014,.07,.07,.06,handMaterial).rotation.z=.45;
    rod(gripModel,[-.36,-.17,-.08],[-.075,-.045,-.015],.025,m.rust);
    for(let i=0;i<4;i++){
      const x=-.047+i*.033,len=i===0?.065:i===3?.085:.11;
      rod(gripModel,[x,.045,0],[x-.008,.055+len,.03],.016,handMaterial);
      rod(gripModel,[x-.008,.055+len,.03],[x-.015,.055+len,.073],.013,handMaterial);
    }
    rod(gripModel,[.05,-.02,0],[.09,.04,.022],.021,handMaterial);batchGroup(gripModel);gripModel.visible=false;
    return {creakModel,noiseModel,stemModel,heldLight,fireEffects,gripModel,creakArms};
  }
  return {buildProp,buildEntities};
}
