/* Architectural studies based on the photographs in assets/. Dimensions are adapted for play. */
window.CampusModels=(()=>{
  'use strict';
  const T=THREE,cache=new Map(),boxGeometry=new T.BoxGeometry(1,1,1);
  const cylinderGeometry=new T.CylinderGeometry(1,1,1,24);
  function canvasTexture(width,height,paint){
    const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
    paint(canvas.getContext('2d'),width,height);
    const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;
    texture.anisotropy=4;return texture;
  }
  function wallTexture(kind){
    return canvasTexture(256,256,(ctx,w,h)=>{
      const brick=kind==='brick',tile=kind==='tile';
      ctx.fillStyle=brick?'#95594a':tile?'#424c50':'#c7c4b7';ctx.fillRect(0,0,w,h);
      let seed=79;const random=()=>{seed=(seed*16807)%2147483647;return seed/2147483647;};
      const row=brick?20:tile?16:64,col=brick?64:tile?20:128;
      for(let y=0;y<h;y+=row)for(let x=-col;x<w;x+=col){
        const shift=(y/row%2)*col/2,shade=Math.floor(random()*18);
        ctx.fillStyle=brick?`rgb(${135+shade},${77+shade},${63+shade})`:tile?`rgb(${49+shade},${61+shade},${65+shade})`:`rgb(${183+shade},${182+shade},${169+shade})`;
        ctx.fillRect(x+shift+1,y+1,col-2,row-2);
      }
      for(let i=0;i<3000;i++){ctx.fillStyle=`rgba(255,255,255,${random()*.07})`;ctx.fillRect(random()*w,random()*h,1,1);}
    });
  }
  const mat={
    stone:new T.MeshStandardMaterial({color:0xe1dfd1,map:wallTexture('stone'),roughness:.92}),
    light:new T.MeshStandardMaterial({color:0xe7e4d8,roughness:.82}),
    brick:new T.MeshStandardMaterial({color:0xdfb8a2,map:wallTexture('brick'),roughness:.88}),
    tile:new T.MeshStandardMaterial({color:0xb6bec1,map:wallTexture('tile'),roughness:.83}),
    red:new T.MeshStandardMaterial({color:0x803e32,roughness:.72}),
    wood:new T.MeshStandardMaterial({color:0x694a32,roughness:.83}),
    paleWood:new T.MeshStandardMaterial({color:0xc0a77a,roughness:.8}),
    glass:new T.MeshStandardMaterial({color:0x64838a,roughness:.24,metalness:.42}),
    dark:new T.MeshStandardMaterial({color:0x293e40,roughness:.63}),
    metal:new T.MeshStandardMaterial({color:0x667476,metalness:.67,roughness:.37}),
    gold:new T.MeshStandardMaterial({color:0xc0a066,metalness:.62,roughness:.36}),
    blue:new T.MeshStandardMaterial({color:0x1c5277,roughness:.65}),
    white:new T.MeshStandardMaterial({color:0xf0eee1,roughness:.76}),
    grass:new T.MeshStandardMaterial({color:0x7e956a,roughness:1}),
    water:new T.MeshStandardMaterial({color:0x769b9a,roughness:.32,metalness:.22}),
    fabric:new T.MeshStandardMaterial({color:0xaa483b,roughness:1}),
  };
  for(const name of ['stone','brick','tile']){
    mat[name].bumpMap=mat[name].map;mat[name].bumpScale=name==='brick'?.026:.015;
  }
  mat.glass.map=canvasTexture(128,256,(ctx,w,h)=>{
    const gradient=ctx.createLinearGradient(0,0,w,h);gradient.addColorStop(0,'#bfcfcd');gradient.addColorStop(.4,'#9cb4b6');gradient.addColorStop(.43,'#d1dcd3');gradient.addColorStop(.47,'#a4bdbc');gradient.addColorStop(1,'#6d8e92');ctx.fillStyle=gradient;ctx.fillRect(0,0,w,h);
    for(let i=0;i<6;i++){ctx.fillStyle=i%2?'#365c6319':'#e5eddd24';ctx.fillRect(i*23,0,6,h);}
  });
  mat.water.map=canvasTexture(256,256,(ctx,w,h)=>{
    ctx.fillStyle='#b6ceca';ctx.fillRect(0,0,w,h);ctx.lineWidth=1;
    for(let row=0;row<64;row++){
      ctx.strokeStyle=row%3?'#d9e8df48':'#648e8c25';ctx.beginPath();
      for(let x=0;x<=256;x+=4){const y=row*4+Math.sin(x*.07+row*1.7)*1.3;x?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.stroke();
    }
  });
  mat.water.map.wrapS=mat.water.map.wrapT=T.RepeatWrapping;mat.water.map.repeat.set(3,3);
  mat.water.bumpMap=mat.water.map;mat.water.bumpScale=.025;
  function add(g,geometry,material,x=0,y=0,z=0,sx=1,sy=1,sz=1){
    const mesh=new T.Mesh(geometry,material);mesh.position.set(x,y,z);mesh.scale.set(sx,sy,sz);
    mesh.castShadow=true;mesh.receiveShadow=true;g.add(mesh);return mesh;
  }
  function box(g,w,h,d,x,y,z,material=mat.stone){return add(g,boxGeometry,material,x,y,z,w,h,d);}
  function cylinder(g,r,h,x,y,z,material=mat.light){return add(g,cylinderGeometry,material,x,y,z,r,h,r);}
  function sign(g,text,w,h,x,y,z,color='#d6c6a0',background='#343e36'){
    const key=`${text}|${color}|${background}`;
    if(!cache.has(key))cache.set(key,new T.MeshBasicMaterial({map:canvasTexture(768,192,(ctx,cw,ch)=>{
      ctx.fillStyle=background;ctx.fillRect(0,0,cw,ch);ctx.strokeStyle=color;ctx.lineWidth=5;ctx.strokeRect(8,8,cw-16,ch-16);
      ctx.fillStyle=color;ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=`${text.length>11?45:68}px 'Microsoft YaHei',serif`;ctx.fillText(text,cw/2,ch/2,cw-50);
    }),toneMapped:false}));
    return add(g,new T.PlaneGeometry(w,h),cache.get(key),x,y,z);
  }
  function windows(g,count,rows,width,height,depth,y0,material=mat.stone){
    const spacing=width/count,dy=height/rows;
    for(let row=0;row<rows;row++)for(let n=0;n<count;n++){
      const x=(n-(count-1)/2)*spacing,y=y0+row*dy;
      box(g,spacing*.65,dy*.66,.04,x,y,depth/2+.025,mat.glass);
      box(g,.035,dy*.7,.065,x,y,depth/2+.055,material);
      box(g,spacing*.7,.035,.08,x,y-dy*.35,depth/2+.055,mat.light);
    }
  }
  function steps(g,w,z,height=.38,count=4,x=0){
    for(let i=0;i<count;i++)box(g,w,height/count,.22*(count-i),x,height/count*(i+.5),z-i*.095,mat.stone);
  }
  function hipRoof(g,w,d,y,h=.55,material=mat.tile){
    const rings=[[w+.3,d+.3,y],[w,d,y+.1],[w*.65,d*.65,y+h*.7],[w*.46,d*.46,y+h]];
    const positions=[],uvs=[];
    for(let r=0;r<rings.length-1;r++){
      const a=rings[r],b=rings[r+1];
      const corners=q=>[[-q[0]/2,q[2],-q[1]/2],[q[0]/2,q[2],-q[1]/2],[q[0]/2,q[2],q[1]/2],[-q[0]/2,q[2],q[1]/2]];
      const p=corners(a),q=corners(b);
      for(let i=0;i<4;i++){const j=(i+1)%4;for(const vertex of [p[i],q[j],p[j],p[i],q[i],q[j]])positions.push(...vertex);uvs.push(0,0,2,1,2,0,0,0,0,1,2,1);}
    }
    const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));geometry.computeVertexNormals();
    add(g,geometry,material);box(g,w*.46,.06,d*.46,0,y+h,0,material);
    box(g,w+.36,.07,.08,0,y+.035,d/2+.16,mat.dark);
    box(g,w+.36,.07,.08,0,y+.035,-d/2-.16,mat.dark);
    // Slender ridge ends echo the upturned tiled eaves in the reference photographs.
    for(const x of [-1,1])for(const z of [-1,1]){
      const edge=box(g,.35,.055,.06,x*(w/2+.13),y+.13,z*(d/2+.13),material);edge.rotation.z=x*.27;
    }
    return {y:y+h+.035,width:w*.46,depth:d*.46};
  }
  function arch(g,cx,r,bottom,top,z,depth,material=mat.light){
    const shape=new T.Shape();shape.moveTo(cx-r-.13,bottom);shape.lineTo(cx-r-.13,top);shape.lineTo(cx+r+.13,top);shape.lineTo(cx+r+.13,bottom);
    shape.lineTo(cx+r,bottom);shape.lineTo(cx+r,bottom+.64);
    for(let j=0;j<=28;j++){const a=j/28*Math.PI;shape.lineTo(cx+Math.cos(a)*r,bottom+.64+Math.sin(a)*r*.75);}
    shape.lineTo(cx-r,bottom);shape.closePath();
    const geo=new T.ExtrudeGeometry(shape,{depth,bevelEnabled:false,steps:1});return add(g,geo,material,0,0,z-depth/2);
  }
  function terrace(g,width=4.8,depth=3.8){
    box(g,width,.18,depth,0,-.09,0,mat.stone);
    box(g,width+.1,.055,depth+.1,0,.025,0,mat.light);
    for(const x of [-1,1])for(const z of [-1,1]){
      box(g,.5,.12,.5,x*(width/2-.35),.1,z*(depth/2-.35),mat.dark);
      add(g,new T.SphereGeometry(.23,10,8),mat.grass,x*(width/2-.35),.28,z*(depth/2-.35),1,.75,1);
    }
  }
  function batch(group){
    group.updateMatrixWorld(true);const buckets=new Map();
    group.traverse(mesh=>{if(!mesh.isMesh)return;const key=mesh.material.uuid;
      if(!buckets.has(key))buckets.set(key,{material:mesh.material,geometries:[]});
      const geometry=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry.clone();
      geometry.applyMatrix4(mesh.matrixWorld);buckets.get(key).geometries.push(geometry);
    });
    const result=new T.Group();
    for(const {material,geometries} of buckets.values()){
      const merged=new T.BufferGeometry();
      for(const [name,size] of [['position',3],['normal',3],['uv',2]]){
        let length=0;for(const geo of geometries)length+=geo.getAttribute('position').count*size;
        const data=new Float32Array(length);let offset=0;
        for(const geo of geometries){const attr=geo.getAttribute(name);if(attr)data.set(attr.array,offset);offset+=geo.getAttribute('position').count*size;}
        merged.setAttribute(name,new T.BufferAttribute(data,size));
      }
      merged.computeBoundingSphere();const mesh=add(result,merged,material);mesh.castShadow=true;
      for(const geo of geometries)geo.dispose();
    }
    return result;
  }
  function create(index){
    const g=new T.Group();let surface={x:0,z:0,y:1.8,width:2,depth:1.65};
    terrace(g,index===13?5.2:4.8,index===13?4.1:3.8);
    switch(index){
      case 0:{ // South gate: brick spandrels, three archways, paired white columns.
        box(g,4.35,.25,.86,0,2.05,0,mat.stone);
        for(const [x,r] of [[-1.48,.53],[0,.81],[1.48,.53]])arch(g,x,r,.13,1.98,0,.7,mat.brick);
        for(const x of [-2.11,-.93,.93,2.11]){
          cylinder(g,.115,1.65,x,.98,.43,mat.light);cylinder(g,.145,.12,x,.19,.43,mat.light);cylinder(g,.145,.1,x,1.83,.43,mat.light);
        }
        box(g,4.5,.12,1,0,2.22,0,mat.light);box(g,3.95,.1,1.1,0,2.33,0,mat.stone);
        sign(g,'浙 江 大 学',1.7,.27,0,2.08,.44,'#514d43','#d6d0bf');
        surface={x:0,z:0,y:2.39,width:3.9,depth:1.05};break;
      }
      case 1:{ // Auditorium: red timber colonnade, broad stairs, stacked tiled roofs.
        box(g,3.65,.22,2.4,0,.19,0,mat.stone);steps(g,3.55,1.6,.36,5);
        box(g,3.3,1.3,1.9,0,1.04,-.14,mat.red);
        for(let n=0;n<7;n++){
          const x=(n-3)*.49;cylinder(g,.068,1.4,x,1.05,1.03,mat.red);
          box(g,.31,.88,.06,x,.99,.85,mat.wood);
          for(let k=0;k<3;k++)box(g,.018,.74,.04,x+(k-1)*.08,1.03,.9,mat.gold);
        }
        hipRoof(g,3.9,2.65,1.68,.58);surface={x:0,z:0,...hipRoof(g,3.6,2.4,2.3,.57)};
        sign(g,'求是大讲堂',1.2,.28,0,1.55,1.06);break;
      }
      case 2:{ // Crescent building: elliptical white shell and recessed blue glass.
        add(g,cylinderGeometry,mat.glass,0,.4,0,1.96,.61,1.23);
        const shellGeometry=new T.SphereGeometry(1,48,24,0,Math.PI*2,0,Math.PI/2),vertices=shellGeometry.attributes.position;
        for(let i=0;i<vertices.count;i++){
          const x=vertices.getX(i)*2.03,y=Math.min(2.04,.65+vertices.getY(i)*1.45-x*.16),z=vertices.getZ(i)*1.3;vertices.setXYZ(i,x,y,z);
        }
        shellGeometry.computeVertexNormals();add(g,shellGeometry,mat.light);
        const portholeMaterial=new T.MeshStandardMaterial({color:0x566f73,roughness:.3,metalness:.35}),normal=new T.Vector3();
        for(let row=0;row<4;row++)for(let n=0;n<11;n++){
          const u=(n-5)*.165+(row%2)*.04,v=.16+row*.19,remaining=1-u*u-v*v;if(remaining<.1)continue;
          const x=u*2.03,y=.65+v*1.45-x*.16,z=Math.sqrt(remaining)*1.3;
          const window=add(g,new T.CircleGeometry(.065,16),portholeMaterial,x,y,z+.008);
          normal.set(u/2.03+v*.16/1.45,v/1.45,z/(1.3*1.3)).normalize();window.quaternion.setFromUnitVectors(new T.Vector3(0,0,1),normal);
        }
        box(g,1.7,.06,1.05,-.16,2.06,0,mat.light);
        sign(g,'校史馆',.7,.18,0,.39,1.25,'#394a4c','#c9cdc9');surface={x:-.16,z:0,y:2.1,width:1.7,depth:1.05};break;
      }
      case 3:{ // Memorial entrance: warm timber, stone wall, open lattice screens.
        box(g,3.55,1.55,1.8,0,.83,0,mat.light);
        box(g,1.18,1.35,.08,0,.75,.95,mat.dark);box(g,.88,1.16,.1,0,.7,1,mat.paleWood);
        for(const side of [-1,1])for(let n=0;n<7;n++)box(g,.035,1.31,.1,side*(.78+n*.13),.79,1.0,mat.wood);
        for(let row=0;row<6;row++)for(const side of [-1,1])box(g,.96,.025,.1,side*1.18,.25+row*.23,1.02,mat.wood);
        box(g,3.78,.16,2.08,0,1.7,0,mat.stone);box(g,2.5,.07,1.45,0,1.83,0,mat.light);
        sign(g,'竺可桢纪念馆',1.4,.28,0,1.5,1.04);surface={x:0,z:0,y:1.88,width:2.5,depth:1.45};break;
      }
      case 4:{ // Museum: offset grey boxes, deep glass curtain wall, reflecting pool.
        box(g,4.1,.08,2.6,0,.12,0,mat.water);
        box(g,1.72,2.05,2.25,-1.03,1.2,-.1,mat.stone);
        box(g,1.95,1.75,2.13,.84,1.06,-.04,mat.dark);
        box(g,1.88,1.68,.04,.84,1.07,1.05,mat.glass);
        for(let n=0;n<12;n++)box(g,.035,1.75,.085,.0+n*.155,1.08,1.1,mat.metal);
        for(let n=0;n<10;n++)box(g,1.7,.024,.04,-1.03,.36+n*.2,1.04,mat.light);
        for(let n=0;n<4;n++)box(g,.45,.035,.07,-1.23+(n%2)*.5,.66+n*.34,1.06,mat.red);
        box(g,2.15,.1,2.32,.84,1.98,-.04,mat.metal);
        box(g,1.88,.1,2.4,-1.03,2.28,-.1,mat.light);
        sign(g,'ZJ UAM',1.4,.35,.66,.55,1.15,'#e4e6df','#354c50');surface={x:.84,z:-.04,y:2.04,width:2.15,depth:2.32};break;
      }
      case 5:{ // Academy ceremonial gate: three passages and three roof levels.
        for(const x of [-1.65,-.58,.58,1.65]){cylinder(g,.105,2.12,x,1.13,0,mat.wood);box(g,.27,.2,.37,x,.17,0,mat.stone);}
        box(g,3.7,.23,.4,0,1.73,0,mat.wood);
        hipRoof(g,4,1.8,1.83,.5);hipRoof(g,2.7,1.8,2.27,.47);
        surface={x:0,z:0,...hipRoof(g,2.7,2.5,2.65,.45)};
        sign(g,'求 是 书 院',1.25,.33,0,2.33,.43);break;
      }
      case 6:{ // Library: white classical volume, tall windows, grey hipped roof.
        box(g,3.8,1.58,2.5,0,.92,0,mat.light);windows(g,9,2,3.65,1.2,2.5,.64,mat.light);
        for(let n=0;n<10;n++)box(g,.07,1.53,.13,(n-4.5)*.39,.89,1.34,mat.light);
        box(g,1.2,.94,.1,0,.63,1.36,mat.glass);steps(g,2.15,1.65,.26,3);
        surface={x:0,z:0,...hipRoof(g,4.1,2.9,1.76,.65)};
        sign(g,'浙江大学图书馆',1.32,.22,0,1.58,1.4,'#5b625a','#deded3');break;
      }
      case 7:{ // Stone university name gate in the corresponding photo.
        for(const x of [-1.42,1.42])box(g,.62,1.65,.82,x,.9,0,mat.stone);
        box(g,3.47,.64,.86,0,1.88,0,mat.stone);
        for(const side of [-1,1]){box(g,.6,1.07,.48,side*1.99,.6,0,mat.stone);for(let n=0;n<7;n++)box(g,.035,.74,.08,side*(.2+n*.16),.5,.05,mat.metal);}
        box(g,3.65,.1,1.12,0,2.25,0,mat.light);
        sign(g,'浙 江 大 学',1.9,.38,0,1.87,.45,'#4c4d46','#c1c0b4');surface={x:0,z:0,y:2.31,width:3.65,depth:1.12};break;
      }
      case 8:case 19:{ // Seal and final station: circular stone plinth with a bronze seal.
        cylinder(g,1.7,.24,0,.2,0,mat.stone);cylinder(g,1.48,.34,0,.48,0,mat.light);
        cylinder(g,1.3,.12,0,.72,0,mat.gold);cylinder(g,1.22,.08,0,.81,0,mat.light);
        const texture=new T.TextureLoader().load(PLAYER_EMBLEM_DATA_URL);texture.colorSpace=T.SRGBColorSpace;
        const seal=add(g,new T.CircleGeometry(1.08,64),new T.MeshBasicMaterial({map:texture,toneMapped:false}),0,.857,0);seal.rotation.x=-Math.PI/2;
        if(index===19)for(let n=0;n<12;n++){
          const a=n/12*Math.PI*2;cylinder(g,.048,.6,Math.cos(a)*1.8,.43,Math.sin(a)*1.8,mat.gold);
        }
        surface={x:0,z:0,y:.86,shape:'circle',radius:1.22};break;
      }
      case 9:{ // Yuquan gate: four square piers, carved lintel, horizontal stone band.
        for(const x of [-1.75,-.64,.64,1.75])box(g,.24,1.55,.8,x,.87,0,mat.stone);
        box(g,3.9,.55,.9,0,1.88,0,mat.stone);box(g,4.03,.09,1.15,0,2.2,0,mat.light);
        sign(g,'浙 江 大 学',2.4,.34,0,1.89,.47,'#776b4d','#bfb9a4');
        for(const x of [-1.95,1.95])box(g,.48,.46,1.0,x,.34,0,mat.stone);
        surface={x:0,z:0,y:2.255,width:4.03,depth:1.15};break;
      }
      case 10:{ // Westward relocation monument: low, black stone wall on a curved plaza.
        box(g,3.8,.14,2.5,0,.18,0,mat.light);box(g,3.2,1.12,.62,0,.83,0,mat.dark);
        box(g,3.4,.1,.94,0,1.44,0,mat.dark);
        sign(g,'浙江大学',1.5,.26,-.45,1.06,.33,'#f2ecdc','#2a3835');
        sign(g,'西迁办学纪念碑',2.58,.32,0,.69,.33,'#e6e0d1','#2a3835');
        surface={x:0,z:0,y:1.5,width:3.4,depth:.94};break;
      }
      case 11:{ // Meitan historic site: golden tiled eaves, red pillars and green lattice.
        box(g,3.5,.2,2.3,0,.2,0,mat.stone);box(g,3.2,1.45,1.9,0,1.02,0,mat.red);
        for(let n=0;n<7;n++){const x=(n-3)*.47;cylinder(g,.06,1.45,x,1.04,1.01,mat.red);box(g,.31,.82,.07,x,.96,.98,mat.wood);}
        for(let n=0;n<8;n++)box(g,3.4,.016,.04,0,.5+n*.12,1.05,mat.paleWood);
        surface={x:0,z:0,...hipRoof(g,3.95,2.65,1.78,.65,mat.paleWood)};
        sign(g,'浙江大学旧址',1.2,.22,0,1.57,1.1);steps(g,2.3,1.52,.25,3);break;
      }
      case 12:{ // Zhijiang red-brick clock tower: stepped parapet, clock face, low wings.
        box(g,1.42,2.48,1.44,0,1.34,0,mat.brick);box(g,1.02,.55,1.1,0,2.84,0,mat.brick);
        box(g,.72,.4,.82,0,3.29,0,mat.brick);box(g,.86,.08,.94,0,3.53,0,mat.stone);
        for(const side of [-1,1]){box(g,1.18,1.05,1.24,side*1.3,.63,-.1,mat.brick);box(g,1.29,.1,1.38,side*1.3,1.2,-.1,mat.stone);}
        windows(g,3,3,1.2,1.85,1.44,.51,mat.brick);
        for(const side of [-1,1])for(let n=0;n<3;n++)box(g,.2,.57,.05,side*(.9+n*.32),.7,.55,mat.dark);
        const clockMaterial=new T.MeshBasicMaterial({map:canvasTexture(256,256,(ctx)=>{
          ctx.fillStyle='#ded9bd';ctx.beginPath();ctx.arc(128,128,118,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#3d4c40';ctx.lineWidth=9;ctx.stroke();
          for(let k=0;k<12;k++){const a=k/12*Math.PI*2;ctx.beginPath();ctx.moveTo(128+Math.sin(a)*92,128-Math.cos(a)*92);ctx.lineTo(128+Math.sin(a)*107,128-Math.cos(a)*107);ctx.stroke();}
          ctx.lineWidth=8;ctx.beginPath();ctx.moveTo(128,128);ctx.lineTo(128,57);ctx.moveTo(128,128);ctx.lineTo(177,151);ctx.stroke();
        }),toneMapped:false});
        add(g,new T.CircleGeometry(.32,40),clockMaterial,0,2.83,.565);
        box(g,1.65,.1,1.67,0,2.57,0,mat.stone);
        // A forward terrace below the clock keeps the tower silhouette and the landing aligned.
        box(g,1.8,.11,1.3,0,1.85,1.01,mat.brick);surface={x:0,z:1.01,y:1.91,width:1.8,depth:1.3};break;
      }
      case 13:{ // Huajiachi: water courtyard, pavilion and the long warm campus facade.
        box(g,4.85,.06,3.65,0,.1,0,mat.water);
        box(g,4.4,1.32,.8,0,.82,-1.23,mat.brick);
        const facade=new T.Group();windows(facade,12,3,4.3,1.0,.8,.5);facade.position.z=-1.23;g.add(facade);
        box(g,4.55,.12,.96,0,1.56,-1.23,mat.light);
        box(g,2.3,.13,2.02,0,.24,.37,mat.stone);
        for(const x of [-.9,.9])for(const z of [-.4,1.14])cylinder(g,.055,.95,x,.79,z,mat.wood);
        const roof=new T.Group();const s=hipRoof(roof,2.6,2.25,1.31,.48);roof.position.z=.37;g.add(roof);
        surface={x:0,z:.37,...s};break;
      }
      case 14:{ // Gymnasium: low elliptical shell, glazed rim and radial roof seams.
        add(g,cylinderGeometry,mat.glass,0,.52,0,2,.65,1.45);
        add(g,new T.SphereGeometry(1,48,20,0,Math.PI*2,0,Math.PI/2),mat.light,0,.84,0,2.12,.61,1.58);
        const ring=add(g,new T.TorusGeometry(1,.035,8,64),mat.metal,0,.93,0,2.1,1.55,1);ring.rotation.x=Math.PI/2;
        for(let n=0;n<18;n++){const a=n/18*Math.PI*2;box(g,.035,.58,.055,Math.cos(a)*1.99,.55,Math.sin(a)*1.45,mat.light);}
        box(g,1.7,.07,1.35,0,1.44,0,mat.stone);steps(g,2.5,1.8,.26,3);
        surface={x:0,z:0,y:1.485,width:1.7,depth:1.35};break;
      }
      case 15:{ // Student festival: red marquees surrounding a raised central event stage.
        for(const side of [-1,1])for(let n=0;n<2;n++){
          const tent=new T.Group();
          for(const x of [-.42,.42])for(const z of [-.38,.38])box(tent,.035,.82,.035,x,.55,z,mat.metal);
          add(tent,new T.ConeGeometry(.7,.43,4),mat.fabric,0,1.16,0,1,1,.9).rotation.y=Math.PI/4;
          box(tent,.9,.15,.68,0,.42,0,mat.light);tent.position.set(side*1.7,0,(n-.5)*1.6);g.add(tent);
        }
        box(g,2.1,.5,2.2,0,.36,0,mat.wood);box(g,2.16,.09,2.25,0,.65,0,mat.light);
        box(g,2.25,.86,.12,0,1.05,-1.15,mat.red);sign(g,'浙江大学 · 学生节',2.05,.52,0,1.08,-1.07,'#f5dbaf','#9e483d');
        surface={x:0,z:0,y:.705,width:2.16,depth:2.25};break;
      }
      case 16:{ // Drama society: proscenium, velvet wings and an open performance stage.
        box(g,3.5,.32,2.7,0,.27,0,mat.dark);
        box(g,3.45,1.65,.22,0,1.17,-1.17,mat.dark);
        for(const side of [-1,1])box(g,.55,1.5,1.8,side*1.43,1.05,-.12,mat.fabric);
        box(g,3.6,.27,.58,0,1.94,-.95,mat.dark);
        sign(g,'黑 白 剧 社',1.7,.38,0,1.32,-1.04,'#ded8c7','#303d39');
        box(g,2.25,.06,1.5,0,.465,.4,mat.wood);surface={x:0,z:.4,y:.5,width:2.25,depth:1.5};break;
      }
      case 17:{ // Reading corner: three-storey glazed library and visible book shelves.
        box(g,3.15,2.25,2.05,0,1.25,0,mat.dark);
        for(let floor=0;floor<3;floor++){
          const y=.55+floor*.66;box(g,2.96,.53,.07,0,y,1.06,mat.glass);
          box(g,2.97,.07,.14,0,y-.3,1.12,mat.metal);
          for(let n=0;n<15;n++)box(g,.07,.22,.05,(n-7)*.18,y-.1,1.115,[mat.paleWood,mat.red,mat.light,mat.wood][n%4]);
        }
        for(const x of [-1.48,0,1.48])box(g,.06,2.17,.14,x,1.2,1.12,mat.metal);
        box(g,3.35,.12,2.25,0,2.44,0,mat.stone);sign(g,'READING · 阅读角',1.9,.2,0,.22,1.15,'#d8d1b5','#344a48');
        surface={x:0,z:0,y:2.505,width:3.35,depth:2.25};break;
      }
      case 18:{ // Cultural shop: folded-paper roofs and books in a warm display window.
        box(g,3.1,1.1,2.15,0,.7,0,mat.paleWood);box(g,2.7,.67,.06,0,.66,1.11,mat.glass);
        for(let n=0;n<11;n++)box(g,.14,.3,.09,(n-5)*.23,.53,1.15,[mat.light,mat.blue,mat.red,mat.paleWood][n%4]);
        box(g,3.45,.11,2.5,0,1.36,0,mat.paleWood);box(g,2.25,.1,1.68,0,1.48,0,mat.light);
        sign(g,'求 是 生 活',1.5,.28,0,1.15,1.18,'#e6d8b5','#30597a');surface={x:0,z:0,y:1.535,width:2.25,depth:1.68};break;
      }
    }
    // Return glazing around the visible side elevations instead of leaving blank boxes.
    const sideElevations={3:[3.55,1.8,4,2,1.14,.53],6:[3.8,2.5,6,2,1.2,.64],17:[3.15,2.05,4,3,1.98,.55],18:[3.1,2.15,4,1,.65,.66]};
    if(sideElevations[index]){
      const [width,depth,count,rows,height,y]=sideElevations[index],side=new T.Group();
      windows(side,count,rows,depth*.88,height,width,y,index===17?mat.metal:mat.light);side.rotation.y=Math.PI/2;g.add(side);
    }
    const group=batch(g);group.userData.station=index;return {group,surface};
  }
  function player(renderer,onReady=()=>{}){
    const g=new T.Group(),eagle=new T.TextureLoader().load(PLAYER_EMBLEM_DATA_URL,texture=>{renderer.initTexture(texture);onReady();});
    eagle.colorSpace=T.SRGBColorSpace;eagle.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
    cylinder(g,.38,.14,0,0,0,new T.MeshStandardMaterial({color:0x15415d,metalness:.65,roughness:.3}));
    const rim=new T.TorusGeometry(.337,.026,10,56),face=new T.CircleGeometry(.308,56);
    const gold=new T.MeshStandardMaterial({color:0xd4b56a,metalness:.73,roughness:.28});
    const logo=new T.MeshBasicMaterial({map:eagle,toneMapped:false});
    for(const side of [-1,1]){
      const edge=add(g,rim,gold,0,side*.081,0);edge.rotation.x=Math.PI/2;
      const plate=add(g,face,logo,0,side*.083,0);plate.rotation.x=-side*Math.PI/2;plate.castShadow=false;
    }
    return g;
  }
  return {create,player,mat,canvasTexture,batch,box,cylinder};
})();
