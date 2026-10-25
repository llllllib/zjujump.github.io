'use strict';
const $=id=>document.getElementById(id),T=THREE,core=JumpCore;
const stage=$('stage'),canvas=$('sceneCanvas'),jumpButton=$('jumpButton');
let renderer,scene,camera,player,platforms=[],current=0,mode='loading',score=0,combo=0,flight=null;
let fallWorld=null,fallBody=null;
let chargeStart=0,phaseStart=0,lastFrame=0,raf=0,landingSpot=null,soundOn=false,audioContext;
let cameraFocus=new T.Vector3(),cameraGoal=new T.Vector3(),sun,landingRing,targetRing,contactShadow;
let stageWidth=1,stageHeight=1,labelsDirty=true,inFrame=false,renderDirty=false,hiddenAt=0;
const sceneryCells=[],cellSize=22;
const hud={powerBar:$('powerBar'),powerLabel:$('powerLabel'),currentChip:$('currentChip'),nextChip:$('nextChip')};
let powerPercent=-1,qualityMode='auto',qualityLevel=0,qualityFrames=0,qualityTotal=0,qualityGoodWindows=0,qualityWarmup=12;
try{const saved=localStorage.getItem('zju-jump-quality');if(['auto','smooth','clear'].includes(saved))qualityMode=saved;}catch(error){}
const cameraOffset=new T.Vector3(11,13.5,11),flipAxis=new T.Vector3();
const sunOffset=new T.Vector3(-9,20,10);
const playerLift=.115,reduceMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
const landingMarkerMaterial=new T.MeshBasicMaterial({color:0xffffff,toneMapped:false,side:T.DoubleSide});

function createLandingMarker(surface){
  // The border encloses valid coin-center positions, including the landing margin.
  // An inscribed square keeps every marked point safe on circular platforms too.
  const margin=core.PLAYER_RADIUS*.5;
  const halfWidth=surface.shape==='circle'?(surface.radius-margin)/Math.SQRT2:surface.width/2-margin;
  const halfDepth=surface.shape==='circle'?halfWidth:surface.depth/2-margin;
  const stroke=Math.min(.045,halfWidth*.2,halfDepth*.2),shape=new T.Shape();
  shape.moveTo(-halfWidth,-halfDepth);shape.lineTo(halfWidth,-halfDepth);
  shape.lineTo(halfWidth,halfDepth);shape.lineTo(-halfWidth,halfDepth);shape.closePath();
  const hole=new T.Path();
  hole.moveTo(-halfWidth+stroke,-halfDepth+stroke);hole.lineTo(-halfWidth+stroke,halfDepth-stroke);
  hole.lineTo(halfWidth-stroke,halfDepth-stroke);hole.lineTo(halfWidth-stroke,-halfDepth+stroke);hole.closePath();shape.holes.push(hole);
  const marker=new T.Mesh(new T.ShapeGeometry(shape),landingMarkerMaterial);
  marker.name='safe-landing-frame';marker.rotation.x=-Math.PI/2;
  marker.position.set(surface.x,surface.y+.025,surface.z);
  marker.userData.halfWidth=halfWidth;marker.userData.halfDepth=halfDepth;
  return marker;
}

function tone(frequency,duration=.1,type='sine',volume=.035){
  if(!soundOn)return;
  try{
    audioContext??=new(window.AudioContext||window.webkitAudioContext)();
    if(audioContext.state==='suspended')audioContext.resume();
    const oscillator=audioContext.createOscillator(),gain=audioContext.createGain(),now=audioContext.currentTime;
    oscillator.type=type;oscillator.frequency.setValueAtTime(frequency,now);gain.gain.setValueAtTime(volume,now);
    gain.gain.exponentialRampToValueAtTime(.001,now+duration);oscillator.connect(gain);gain.connect(audioContext.destination);
    oscillator.start(now);oscillator.stop(now+duration);
  }catch(error){soundOn=false;updateSoundButton();}
}
function updateSoundButton(){
  $('soundButton').textContent=`音效 ${soundOn?'开':'关'}`;$('soundButton').setAttribute('aria-pressed',String(soundOn));
  $('soundButton').setAttribute('aria-label',soundOn?'关闭音效':'开启音效');
}
function makeEnvironment(){
  const texture=CampusModels.canvasTexture(512,256,ctx=>{
    const gradient=ctx.createLinearGradient(0,0,0,256);gradient.addColorStop(0,'#a3bcc6');gradient.addColorStop(.45,'#e5e9db');gradient.addColorStop(.64,'#c7c9ac');gradient.addColorStop(1,'#697663');ctx.fillStyle=gradient;ctx.fillRect(0,0,512,256);
    const glow=ctx.createRadialGradient(350,80,2,350,80,60);glow.addColorStop(0,'#fff8df');glow.addColorStop(1,'#fff8df00');ctx.fillStyle=glow;ctx.fillRect(0,0,512,256);
  });
  texture.mapping=T.EquirectangularReflectionMapping;
  const generator=new T.PMREMGenerator(renderer),map=generator.fromEquirectangular(texture);scene.environment=map.texture;
  texture.dispose();generator.dispose();
}
function landscape(route){
  const g=new T.Group(),{box,cylinder,mat}=CampusModels;
  const grass=CampusModels.canvasTexture(256,256,ctx=>{
    ctx.fillStyle='#a4b393';ctx.fillRect(0,0,256,256);let seed=31;
    for(let n=0;n<10000;n++){seed=seed*16807%2147483647;const x=seed%256;seed=seed*16807%2147483647;ctx.fillStyle=n%2?'#c2c9a329':'#647d5521';ctx.fillRect(x,seed%256,1,3);}
  });grass.wrapS=grass.wrapT=T.RepeatWrapping;grass.repeat.set(90,90);
  const ground=new T.Mesh(new T.PlaneGeometry(260,260),new T.MeshStandardMaterial({map:grass,roughness:1}));ground.rotation.x=-Math.PI/2;ground.position.set(-40,-.23,-40);ground.receiveShadow=true;scene.add(ground);
  const pathMaterial=new T.MeshStandardMaterial({color:0xc9c8b8,roughness:.97}),curbMaterial=new T.MeshStandardMaterial({color:0xd9d6c5,roughness:.9});
  for(let i=1;i<route.length;i++){
    const a=route[i-1],b=route[i],dx=b.x-a.x,dz=b.z-a.z,length=Math.hypot(dx,dz);
    const path=box(g,1.55,.035,length+1,(a.x+b.x)/2,-.185,(a.z+b.z)/2,pathMaterial);path.rotation.y=Math.atan2(dx,dz);
    for(const side of [-1,1]){
      const curb=box(g,.11,.07,length+.7,(a.x+b.x)/2+side*.84*dz/length,-.15,(a.z+b.z)/2-side*.84*dx/length,curbMaterial);curb.rotation.y=path.rotation.y;
    }
    if(i%2===1){
      const x=(a.x+b.x)/2+2,z=(a.z+b.z)/2+2;
      cylinder(g,.04,1.8,x,.68,z,mat.metal);box(g,.25,.1,.25,x,1.62,z,mat.light);box(g,.32,.06,.32,x,1.72,z,mat.metal);
      const bench=box(g,1.05,.11,.4,x+1,-.0,z+.5,mat.wood);bench.rotation.y=Math.PI/2;
      for(const sign of [-1,1])box(g,.32,.32,.06,x+1,-.1,z+.5+sign*.36,mat.metal);
    }
  }
  for(const [x,z,rx,rz] of [[5,-8,3.8,6],[-31,-39,5.5,3.6]]){
    const edge=cylinder(g,1,.12,x,-.16,z,mat.stone);edge.scale.set(rx+.18,.12,rz+.18);
    const water=cylinder(g,1,.04,x,-.08,z,mat.water);water.scale.set(rx,.04,rz);
    for(let n=0;n<7;n++){const a=n*.9;const leaf=cylinder(g,.18,.015,x+Math.cos(a)*rx*.5,-.05,z+Math.sin(a)*rz*.6,mat.grass);leaf.scale.z=.14;}
  }
  // Keep batches local so distant paths and street furniture can be culled.
  const cells=new Map();
  const cellFor=(x,z)=>{
    const cx=Math.floor(x/cellSize),cz=Math.floor(z/cellSize),key=`${cx},${cz}`;
    if(!cells.has(key))cells.set(key,{cx,cz,props:new T.Group(),trees:[]});
    return cells.get(key);
  };
  for(const mesh of [...g.children])cellFor(mesh.position.x,mesh.position.z).props.add(mesh);
  const trees=[];let seed=187;const random=()=>{seed=seed*16807%2147483647;return seed/2147483647;};
  for(const station of route)for(let n=0;n<6;n++){
    const angle=random()*Math.PI*2,radius=4+random()*3.8,x=station.x+Math.cos(angle)*radius,z=station.z+Math.sin(angle)*radius;
    if(route.some(p=>Math.abs(p.x-x)<3.15&&Math.abs(p.z-z)<2.7))continue;
    if([[5,-8,3.8,6],[-31,-39,5.5,3.6]].some(([px,pz,rx,rz])=>((x-px)/rx)**2+((z-pz)/rz)**2<1.12))continue;
    trees.push({x,z,s:.74+random()*.45});
  }
  for(const tree of trees)cellFor(tree.x,tree.z).trees.push(tree);
  const foliage=CampusModels.canvasTexture(256,256,ctx=>{
    let seed=137;const random=()=>{seed=seed*16807%2147483647;return seed/2147483647;};
    // Small overlapping leaves preserve an irregular silhouette and dappled shadows.
    for(let n=0;n<750;n++){
      const angle=random()*Math.PI*2,radius=Math.sqrt(random())*105,x=128+Math.cos(angle)*radius,y=126+Math.sin(angle)*radius;
      const shade=38+Math.floor(random()*35);ctx.fillStyle=`rgb(${shade+11},${shade+29},${shade})`;
      ctx.beginPath();ctx.ellipse(x,y,2+random()*4,1.4+random()*2.8,random()*Math.PI,0,Math.PI*2);ctx.fill();
    }
  });
  const trunkGeometry=new T.CylinderGeometry(.06,.11,1.4,7),leafGeometry=new T.PlaneGeometry(1.75,1.75);
  const leafMaterial=new T.MeshLambertMaterial({map:foliage,alphaTest:.48,side:T.DoubleSide});
  const dummy=new T.Object3D(),leafColor=new T.Color(),leafCount=7;
  for(const cell of cells.values()){
    const group=CampusModels.batch(cell.props),localTrees=cell.trees;
    const trunks=new T.InstancedMesh(trunkGeometry,mat.wood,localTrees.length);
    const leaves=new T.InstancedMesh(leafGeometry,leafMaterial,localTrees.length*leafCount);
    localTrees.forEach((tree,i)=>{
      dummy.position.set(tree.x,.45*tree.s,tree.z);dummy.scale.setScalar(tree.s);dummy.rotation.set(0,0,0);dummy.updateMatrix();trunks.setMatrixAt(i,dummy.matrix);
      for(let n=0;n<leafCount;n++){
        const angle=n*2.4+i*.7;
        dummy.position.set(tree.x+Math.cos(angle)*.33*tree.s,(1.46+(n%3)*.21)*tree.s,tree.z+Math.sin(angle)*.31*tree.s);
        dummy.scale.setScalar(tree.s);dummy.rotation.set(n>4?Math.PI/2:(n%3-1)*.5,angle,n*.11);dummy.updateMatrix();leaves.setMatrixAt(i*leafCount+n,dummy.matrix);
        leaves.setColorAt(i*leafCount+n,leafColor.setHSL(.21+(i%4)*.009,.14,.65+(i%5)*.02));
      }
    });
    if(localTrees.length){
      trunks.castShadow=leaves.castShadow=true;trunks.receiveShadow=leaves.receiveShadow=true;
      trunks.computeBoundingSphere();leaves.computeBoundingSphere();group.add(trunks,leaves);
    }
    scene.add(group);sceneryCells.push({group,x:(cell.cx+.5)*cellSize,z:(cell.cz+.5)*cellSize});
  }
  // All architecture and scenery are stationary; only the coin and effects animate.
  scene.updateMatrixWorld(true);
  scene.matrixAutoUpdate=false;
  for(const object of [ground,...sceneryCells.map(cell=>cell.group),...platforms.map(p=>p.group)])object.traverse(child=>{child.matrixAutoUpdate=false;});
}
function init(){
  renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});
  renderer.outputColorSpace=T.SRGBColorSpace;
  renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate=false;
  scene=new T.Scene();scene.background=new T.Color(0xdce4db);scene.fog=new T.Fog(0xdce4db,28,60);
  camera=new T.OrthographicCamera(-10,10,8,-8,.1,120);makeEnvironment();
  scene.add(new T.HemisphereLight(0xe9f1ec,0x838b68,2.35));sun=new T.DirectionalLight(0xffedcb,3.1);sun.castShadow=true;
  sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=-19;sun.shadow.camera.right=19;sun.shadow.camera.top=19;sun.shadow.camera.bottom=-19;
  sun.shadow.camera.near=.5;sun.shadow.camera.far=60;sun.shadow.normalBias=.035;sun.shadow.bias=-.00025;sun.shadow.radius=3;scene.add(sun,sun.target);
  const route=core.course();
  platforms=route.map((position,index)=>{
    const model=CampusModels.create(index);model.group.add(createLandingMarker(model.surface));
    model.group.position.set(position.x,0,position.z);scene.add(model.group);
    const surface={...model.surface,x:position.x+model.surface.x,z:position.z+model.surface.z};
    return{index,group:model.group,surface,pos:new T.Vector3(surface.x,surface.y+playerLift,surface.z)};
  });
  landscape(route);player=CampusModels.player(renderer,requestRender);scene.add(player);
  player.traverse(mesh=>{mesh.castShadow=false;});
  landingRing=new T.Mesh(new T.RingGeometry(.38,.42,64),new T.MeshBasicMaterial({color:0xf4e5af,transparent:true,opacity:0,depthWrite:false,side:T.DoubleSide}));landingRing.rotation.x=-Math.PI/2;scene.add(landingRing);
  targetRing=new T.Mesh(new T.RingGeometry(.18,.2,48),new T.MeshBasicMaterial({color:0xc9bd87,transparent:true,opacity:.65,depthWrite:false,side:T.DoubleSide}));targetRing.rotation.x=-Math.PI/2;scene.add(targetRing);
  const shadowTexture=CampusModels.canvasTexture(64,64,ctx=>{const gradient=ctx.createRadialGradient(32,32,0,32,32,32);gradient.addColorStop(0,'#17271780');gradient.addColorStop(1,'#17271700');ctx.fillStyle=gradient;ctx.fillRect(0,0,64,64);});
  contactShadow=new T.Mesh(new T.PlaneGeometry(1.1,1.1),new T.MeshBasicMaterial({map:shadowTexture,transparent:true,depthWrite:false,opacity:.5}));contactShadow.rotation.x=-Math.PI/2;scene.add(contactShadow);
  resetGame();resize();
  // Compile shared shaders and upload local signs before they first appear during a jump.
  renderer.compile(scene,camera);
  const textures=new Set();
  scene.traverse(object=>{
    if(!object.material)return;
    for(const value of Object.values(object.material))if(value?.isTexture&&value.image?.width)textures.add(value);
  });
  for(const texture of textures)renderer.initTexture(texture);
  new ResizeObserver(resize).observe(stage);$('loading').hidden=true;
  updateQualityButton();requestRender();
}
function resize(){
  if(!renderer)return;stageWidth=Math.max(1,stage.clientWidth);stageHeight=Math.max(1,stage.clientHeight);const aspect=stageWidth/stageHeight;
  const span=Math.max(13.5,14.6/aspect);camera.left=-span*aspect/2;camera.right=span*aspect/2;camera.top=span/2;camera.bottom=-span/2;camera.updateProjectionMatrix();
  applyQuality();labelsDirty=true;requestRender();
}
function updateQualityButton(){
  const label={auto:'自动',smooth:'流畅',clear:'清晰'}[qualityMode];
  $('qualityButton').textContent=`画质 ${label}`;$('qualityButton').setAttribute('aria-label',`当前画质${label}，点击切换`);
}
function applyQuality(){
  const cap={auto:1.25,smooth:1,clear:1.75}[qualityMode],budget={auto:1100000,smooth:650000,clear:2200000}[qualityMode];
  const scale=qualityMode==='auto'?[1,.85,.7,.6][qualityLevel]:1;
  renderer.setPixelRatio(Math.min(devicePixelRatio,cap,Math.sqrt(budget/(stageWidth*stageHeight)))*scale);
  renderer.setSize(stageWidth,stageHeight,false);
  const shadowSize=qualityMode==='clear'?2048:qualityMode==='smooth'||qualityLevel>=2?512:1024;
  if(sun.shadow.mapSize.x!==shadowSize){
    sun.shadow.mapSize.set(shadowSize,shadowSize);sun.shadow.map?.dispose();sun.shadow.map=null;
  }
  renderer.shadowMap.needsUpdate=true;
  renderDirty=true;requestRender();
}
function samplePerformance(milliseconds){
  if(qualityMode!=='auto'||milliseconds<=0||milliseconds>1000)return;
  if(qualityWarmup>0){qualityWarmup--;return;}
  qualityFrames++;qualityTotal+=milliseconds;if(qualityFrames<60)return;
  const average=qualityTotal/qualityFrames;qualityFrames=0;qualityTotal=0;
  if(average>24&&qualityLevel<3){qualityLevel++;qualityGoodWindows=0;qualityWarmup=12;applyQuality();}
  else if(average<17.8&&qualityLevel>0){if(++qualityGoodWindows>=5){qualityLevel--;qualityGoodWindows=0;qualityWarmup=12;applyQuality();}}
  else qualityGoodWindows=0;
}
function requestRender(){
  if(!renderer||document.hidden||raf||inFrame)return;
  lastFrame=0;raf=requestAnimationFrame(animate);
}
function goalForStation(){
  const a=platforms[current].pos,b=platforms[Math.min(current+1,19)].pos;
  cameraGoal.copy(a).lerp(b,.37);cameraGoal.y=(a.y+b.y)*.35;
  sun.position.copy(cameraGoal).add(sunOffset);sun.target.position.copy(cameraGoal);sun.target.updateMatrixWorld();
  renderer.shadowMap.needsUpdate=true;
  const radius=Math.max(28,Math.hypot(camera.right,camera.top)+10)+cellSize*.71;
  for(const cell of sceneryCells)cell.group.visible=Math.hypot(cell.x-cameraGoal.x,cell.z-cameraGoal.z)<radius;
  labelsDirty=true;
}
function updateInfo(){
  const place=places[current];$('infoTitle').textContent=place.name;$('infoTag').textContent=place.tag;$('infoYear').textContent=place.year;
  $('infoDescription').textContent=place.description;$('infoQuote').textContent=place.quote;
  $('buildingPhoto').src=photoUrls[current];$('buildingPhoto').alt=`${place.name}实景照片`;$('archiveLink').href=photoUrls[current];
  $('stationNumber').textContent=String(current+1).padStart(2,'0');$('progressCount').textContent=`${String(current+1).padStart(2,'0')} / 20`;
  $('progressText').textContent=`${current+1} / 20 站`;$('progressBar').style.width=`${(current+1)*5}%`;
  $('routeLabel').textContent=`校园漫游 · 第 ${current+1} 站`;$('scoreValue').textContent=score;
  $('comboLabel').textContent=combo?`连续命中中心 × ${combo}`:'从求是出发';$('nextName').textContent=current===19?'求是之境 · 已抵达':places[current+1].name;
  $('currentChip').textContent=place.name;$('nextChip').textContent=current<19?`下一站 · ${places[current+1].name}`:'';
  for(const p of platforms)p.group.visible=Math.abs(p.index-current)<=4;
  targetRing.visible=current<19;
  if(current<19){const next=platforms[current+1].surface;targetRing.position.set(next.x,next.y+.012,next.z);}
  goalForStation();
}
function resetGame(){
  fallWorld=null;fallBody=null;
  current=0;score=0;combo=0;mode='ready';flight=null;landingSpot=platforms[0].pos.clone();player.position.copy(landingSpot);player.quaternion.identity();player.scale.setScalar(1);
  $('stageOverlay').hidden=true;$('tipCard').classList.remove('is-hidden');$('landingFeedback').classList.remove('show');landingRing.visible=false;
  clearCharge();updateInfo();cameraFocus.copy(cameraGoal);updateCamera(1);setControls();requestRender();
}
function retryStation(){
  fallWorld=null;fallBody=null;
  if(mode==='complete'){resetGame();return;}
  player.position.copy(platforms[current].pos);landingSpot=player.position.clone();player.scale.setScalar(1);player.quaternion.identity();combo=0;mode='ready';flight=null;
  $('stageOverlay').hidden=true;clearCharge();updateInfo();setControls();requestRender();
}
function setControls(){
  const locked=!['ready','charging'].includes(mode);jumpButton.disabled=locked;
  jumpButton.firstElementChild.textContent=mode==='charging'?'松开起跳':mode==='complete'?'旅程完成':mode==='flying'?'跃向下一站':'按住蓄力';
}
function clearCharge(){
  jumpButton.classList.remove('is-charging');hud.powerBar.style.transform='scaleX(0)';hud.powerLabel.textContent='按住开始';powerPercent=-1;
}
function beginCharge(){
  if(mode!=='ready'||current>=19||$('leaderboardDialog').open)return;
  mode='charging';chargeStart=performance.now();jumpButton.classList.add('is-charging');$('tipCard').classList.add('is-hidden');tone(220,.065,'sine',.018);setControls();requestRender();
}
function cancelCharge(){
  if(mode!=='charging')return;mode='ready';player.scale.setScalar(1);player.position.copy(landingSpot);clearCharge();setControls();requestRender();
}
function releaseCharge(){
  if(mode!=='charging')return;
  const elapsed=performance.now()-chargeStart;
  player.position.copy(landingSpot);player.scale.setScalar(1);
  flight=core.trajectory({x:player.position.x,y:player.position.y,z:player.position.z},platforms[current+1].pos,core.travelForCharge(elapsed));
  flight.missed=!core.contains(platforms[current+1].surface,flight.to)&&!core.contains(platforms[current].surface,flight.to);
  flight.progress=0;
  fallWorld=null;fallBody=null;
  flipAxis.set(flight.to.z-flight.from.z,0,-(flight.to.x-flight.from.x)).normalize();
  phaseStart=performance.now();mode='flying';clearCharge();setControls();tone(350+elapsed*.12,.12,'sine',.025);requestRender();
}
function showFeedback(text){
  const element=$('landingFeedback');element.textContent=text;element.classList.remove('show');
  element.getAnimations().forEach(animation=>animation.cancel());element.classList.add('show');
}
function getFallWorld(){
  // Build a spatial index only for a failed jump and only for nearby architecture.
  return fallWorld??=CoinFallPhysics.createWorld(platforms.filter(p=>Math.abs(p.index-current)<=2).map(p=>p.group));
}
function beginFall(now){
  const direction=new T.Vector3(flight.to.x-flight.from.x,0,flight.to.z-flight.from.z).normalize();
  let nearest=null,distance=Infinity;
  for(const index of [current,current+1]){
    const surface=platforms[index].surface;
    const dx=Math.max(0,Math.abs(player.position.x-surface.x)-(surface.width/2||surface.radius));
    const dz=Math.max(0,Math.abs(player.position.z-surface.z)-(surface.depth/2||surface.radius));
    const gap=Math.hypot(dx,dz);
    if(gap<distance){distance=gap;nearest=surface;}
  }
  if(distance<1.6)direction.copy(CoinFallPhysics.escapeDirection(nearest,player.position,direction));
  fallBody=CoinFallPhysics.createBody(getFallWorld(),player.position,player.quaternion,direction);
  player.position.copy(fallBody.position);player.quaternion.copy(fallBody.quaternion);
  mode='falling';phaseStart=now;tone(170,.25,'triangle',.025);setControls();
}
function settleLanding(now){
  const next=platforms[current+1],result=core.landingResult(next.surface,flight.to);
  if(result.hit){
    current++;const gained=core.pointsForLanding(result.perfect,combo);combo=result.perfect?combo+1:0;score+=gained;
    player.position.set(flight.to.x,next.pos.y,flight.to.z);landingSpot=player.position.clone();
    showFeedback(result.perfect?`正中中心  +${gained}`:`稳稳落地  +${gained}`);tone(result.perfect?660+Math.min(combo,6)*65:440,.16,'sine',.045);
    landingRing.position.set(player.position.x,next.surface.y+.018,player.position.z);landingRing.visible=true;landingRing.scale.setScalar(1);landingRing.material.opacity=.8;
    mode='landing';phaseStart=now;player.quaternion.identity();updateInfo();
  }else if(core.contains(platforms[current].surface,flight.to)){
    player.position.set(flight.to.x,platforms[current].pos.y,flight.to.z);landingSpot=player.position.clone();mode='landing';phaseStart=now;combo=0;player.quaternion.identity();showFeedback('蓄力再久一点');updateInfo();
  }else beginFall(now);
  setControls();
}
function showResult(complete){
  mode=complete?'complete':'failed';$('stageOverlay').hidden=false;
  $('overlayIcon').textContent=complete?'✓':'↗';$('overlayKicker').textContent=complete?'THE JOURNEY CONTINUES':'再试一次';
  $('overlayTitle').textContent=complete?'抵达求是之境':'差一点就到了';
  $('overlayText').textContent=complete?'20 站校园文化之旅已完成。带着求是的好奇，继续走向下一段旅程。':`停在第 ${current+1} 站 · ${places[current].name}。${flight&&flight.travel<Math.hypot(platforms[current+1].pos.x-flight.from.x,platforms[current+1].pos.z-flight.from.z)?'再多蓄一点力':'稍早松手试试'}，就能更靠近下一站。`;
  $('overlayScore').textContent=score;$('overlayButton').textContent=complete?'再游一次校园':'从本站重试';$('overlaySecondary').hidden=complete;setControls();
  window.CampusLeaderboardUI.showResult(score);
}
function updateCamera(dt){
  const moving=cameraFocus.distanceToSquared(cameraGoal)>.000001;
  if(moving)cameraFocus.lerp(cameraGoal,reduceMotion?1:1-Math.exp(-dt*5));else cameraFocus.copy(cameraGoal);
  if(moving||labelsDirty){camera.position.copy(cameraFocus).add(cameraOffset);camera.lookAt(cameraFocus);labelsDirty=true;}
  return moving;
}
const projectedPoint=new T.Vector3();
function positionChip(element,point,offset){
  projectedPoint.copy(point).project(camera);
  element.style.transform=`translate3d(${(projectedPoint.x*.5+.5)*stageWidth}px,${(-projectedPoint.y*.5+.5)*stageHeight+offset}px,0) translate(-50%,-50%)`;
  element.style.visibility=Math.abs(projectedPoint.x)>1.12||Math.abs(projectedPoint.y)>1.12?'hidden':'visible';
}
function animate(now){
  raf=0;inFrame=true;
  const frameMs=lastFrame?now-lastFrame:0,dt=Math.min(frameMs/1000,.05);lastFrame=now;
  const wasActive=['charging','flying','landing','falling'].includes(mode);
  if(mode==='charging'){
    const ratio=core.clamp((now-chargeStart)/core.MAX_CHARGE,0,1);player.scale.set(1+ratio*.15,1-ratio*.42,1+ratio*.15);player.position.y=landingSpot.y-ratio*.025;
    hud.powerBar.style.transform=`scaleX(${ratio})`;
    const percent=Math.round(ratio*100);
    if(percent!==powerPercent){powerPercent=percent;hud.powerBar.style.background=ratio>.88?'#ac7752':'#456b4d';hud.powerLabel.textContent=ratio>=1?'蓄力已满':`${percent}%`;}
  }else if(mode==='flying'){
    const t=core.clamp((now-phaseStart)/(flight.duration*1000),0,1),position=core.sample(flight,t);
    const nextPosition=new T.Vector3(position.x,position.y,position.z),nextRotation=new T.Quaternion().setFromAxisAngle(flipAxis,(reduceMotion?0:t)*Math.PI*2);
    let collision=null;
    if(flight.missed){
      // Follow the curved flight even when frames are skipped; a straight chord
      // from takeoff to landing would incorrectly hit the starting roof.
      const steps=Math.max(1,Math.ceil((t-flight.progress)*60));
      const from=player.position.clone(),fromRotation=player.quaternion.clone();
      for(let i=1;i<=steps;i++){
        const at=flight.progress+(t-flight.progress)*i/steps,p=core.sample(flight,at);
        nextPosition.set(p.x,p.y,p.z);nextRotation.setFromAxisAngle(flipAxis,(reduceMotion?0:at)*Math.PI*2);
        if((flight.to.y-flight.from.y)+4*flight.height*(1-2*at)<0){
          collision=getFallWorld().sweep(from,fromRotation,nextPosition,nextRotation);if(collision)break;
        }
        from.copy(nextPosition);fromRotation.copy(nextRotation);
      }
    }
    flight.progress=t;
    if(collision){player.position.copy(collision.position);player.quaternion.copy(collision.quaternion);beginFall(now);}
    else{player.position.copy(nextPosition);player.quaternion.copy(nextRotation);if(t>=1)settleLanding(now);}
  }else if(mode==='landing'){
    const t=core.clamp((now-phaseStart)/210,0,1),bounce=Math.sin(t*Math.PI);player.scale.set(1+bounce*.13,1-bounce*.35,1+bounce*.13);player.position.y=landingSpot.y-bounce*.026;
    if(t>=1){player.scale.setScalar(1);player.position.copy(landingSpot);if(current===19)showResult(true);else{mode='ready';setControls();}}
  }else if(mode==='falling'){
    fallBody.advance((now-phaseStart)/1000);player.position.copy(fallBody.position);player.quaternion.copy(fallBody.quaternion);
    if(fallBody.finished)showResult(false);
  }
  if(landingRing.visible){const age=(now-phaseStart)/600;landingRing.scale.setScalar(1+Math.max(0,age)*2);landingRing.material.opacity=Math.max(0,.75*(1-age));if(age>=1)landingRing.visible=false;}
  let shadowY=-.2;
  for(const index of [current,current+1]){
    const surface=platforms[index]?.surface;
    if(surface&&core.contains(surface,player.position,-.12)&&player.position.y>=surface.y-.05)shadowY=Math.max(shadowY,surface.y);
  }
  const shadowHeight=Math.max(0,player.position.y-shadowY);
  contactShadow.visible=mode!=='failed';contactShadow.position.set(player.position.x,shadowY+.009,player.position.z);
  contactShadow.scale.setScalar(1+Math.min(shadowHeight,4)*.13);contactShadow.material.opacity=.5/(1+shadowHeight*.6);
  const cameraMoving=updateCamera(dt);
  if(labelsDirty){
    camera.updateMatrixWorld();positionChip(hud.currentChip,platforms[current].pos,30);
    hud.nextChip.hidden=current>=19;if(current<19)positionChip(hud.nextChip,platforms[current+1].pos,29);
    labelsDirty=false;
  }
  renderer.render(scene,camera);renderDirty=false;
  if(wasActive)samplePerformance(frameMs);
  inFrame=false;
  if(['charging','flying','landing','falling'].includes(mode)||cameraMoving||landingRing.visible||renderDirty)raf=requestAnimationFrame(animate);
  else lastFrame=0;
}
for(const element of [canvas,jumpButton]){
  element.addEventListener('pointerdown',event=>{if(event.button!==0)return;event.preventDefault();element.setPointerCapture?.(event.pointerId);beginCharge();});
  element.addEventListener('pointerup',event=>{event.preventDefault();releaseCharge();});
  element.addEventListener('pointercancel',cancelCharge);element.addEventListener('lostpointercapture',()=>{if(mode==='charging')cancelCharge();});
  element.addEventListener('contextmenu',event=>event.preventDefault());
}
window.addEventListener('keydown',event=>{if(event.code!=='Space'||event.repeat||/INPUT|TEXTAREA|SELECT/.test(event.target.tagName))return;if(event.target.closest('.stage-overlay')||event.target.closest('.header-actions')||$('leaderboardDialog').open)return;event.preventDefault();beginCharge();});
window.addEventListener('keyup',event=>{if(event.code==='Space'&&!/INPUT|TEXTAREA|SELECT/.test(event.target.tagName)&&!$('leaderboardDialog').open){event.preventDefault();releaseCharge();}});
window.addEventListener('zju:leaderboard-open',cancelCharge);
window.addEventListener('blur',cancelCharge);document.addEventListener('visibilitychange',()=>{
  if(document.hidden){cancelCharge();hiddenAt=performance.now();cancelAnimationFrame(raf);raf=0;lastFrame=0;}
  else{if(hiddenAt){phaseStart+=performance.now()-hiddenAt;hiddenAt=0;}qualityWarmup=12;requestRender();}
});
$('restartButton').addEventListener('click',()=>{if(platforms.length)resetGame();});$('overlayButton').addEventListener('click',retryStation);$('overlaySecondary').addEventListener('click',resetGame);
$('soundButton').addEventListener('click',()=>{soundOn=!soundOn;updateSoundButton();tone(523,.1);});
$('qualityButton').addEventListener('click',()=>{
  qualityMode={auto:'smooth',smooth:'clear',clear:'auto'}[qualityMode];qualityLevel=0;qualityFrames=0;qualityTotal=0;qualityGoodWindows=0;qualityWarmup=12;
  try{localStorage.setItem('zju-jump-quality',qualityMode);}catch(error){}
  updateQualityButton();applyQuality();requestRender();
});
try{init();}catch(error){console.error(error);$('loading').textContent='场景未能加载，请使用支持 WebGL 的浏览器重新打开。';}
