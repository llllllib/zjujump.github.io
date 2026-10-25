(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory(require('./vendor/three.min.js'));
  else root.CoinFallPhysics=factory(root.THREE);
})(typeof globalThis!=='undefined'?globalThis:this,function(T){
  'use strict';
  const RADIUS=.385,SAMPLE_RADIUS=.085,STEP=1/120,CELL=.8,SKIN=.002;
  // A flat coin cannot use a single sphere: its collision height changes as it tips.
  const samples=[new T.Vector3()];
  for(const [radius,count] of [[.15,8],[.3,16]])for(let i=0;i<count;i++){
    const angle=i/count*Math.PI*2;samples.push(new T.Vector3(Math.cos(angle)*radius,0,Math.sin(angle)*radius));
  }
  function createWorld(groups,groundY=-.2){
    const cells=new Map(),triangles=[],points=samples.map(()=>new T.Vector3());
    const closest=new T.Vector3(),normal=new T.Vector3(),bestNormal=new T.Vector3();
    const bounds=new T.Box3(),candidates=new Set();
    const key=(x,y,z)=>`${x},${y},${z}`;
    for(const group of groups){
      group.updateWorldMatrix(true,true);
      group.traverse(mesh=>{
        if(!mesh.isMesh||mesh.name==='safe-landing-frame')return;
        const vertices=mesh.geometry.getAttribute('position'),indices=mesh.geometry.index;
        for(let i=0,count=indices?indices.count:vertices.count;i<count;i+=3){
          const triangle=new T.Triangle(...[0,1,2].map(offset=>new T.Vector3().fromBufferAttribute(vertices,indices?indices.getX(i+offset):i+offset).applyMatrix4(mesh.matrixWorld)));
          if(triangle.getArea()<1e-9)continue;
          const index=triangles.length;triangles.push(triangle);
          bounds.setFromPoints([triangle.a,triangle.b,triangle.c]);
          triangle.bounds=bounds.clone();
          for(let x=Math.floor(bounds.min.x/CELL);x<=Math.floor(bounds.max.x/CELL);x++)
            for(let y=Math.floor(bounds.min.y/CELL);y<=Math.floor(bounds.max.y/CELL);y++)
              for(let z=Math.floor(bounds.min.z/CELL);z<=Math.floor(bounds.max.z/CELL);z++){
                const id=key(x,y,z);if(!cells.has(id))cells.set(id,[]);cells.get(id).push(index);
              }
        }
      });
    }
    function contact(position,quaternion){
      candidates.clear();let depth=0;bestNormal.set(0,0,0);
      for(let x=Math.floor((position.x-RADIUS)/CELL);x<=Math.floor((position.x+RADIUS)/CELL);x++)
        for(let y=Math.floor((position.y-RADIUS)/CELL);y<=Math.floor((position.y+RADIUS)/CELL);y++)
          for(let z=Math.floor((position.z-RADIUS)/CELL);z<=Math.floor((position.z+RADIUS)/CELL);z++)
            for(const index of cells.get(key(x,y,z))||[])candidates.add(index);
      for(let i=0;i<samples.length;i++){
        const point=points[i].copy(samples[i]).applyQuaternion(quaternion).add(position);
        const groundDepth=groundY+SAMPLE_RADIUS-point.y;
        if(groundDepth>depth){depth=groundDepth;bestNormal.set(0,1,0);}
        for(const index of candidates){
          const triangle=triangles[index],box=triangle.bounds;
          if(point.x<box.min.x-SAMPLE_RADIUS||point.x>box.max.x+SAMPLE_RADIUS||
             point.y<box.min.y-SAMPLE_RADIUS||point.y>box.max.y+SAMPLE_RADIUS||
             point.z<box.min.z-SAMPLE_RADIUS||point.z>box.max.z+SAMPLE_RADIUS)continue;
          triangle.closestPointToPoint(point,closest);
          const distanceSq=point.distanceToSquared(closest);if(distanceSq>=SAMPLE_RADIUS*SAMPLE_RADIUS)continue;
          const distance=Math.sqrt(distanceSq),penetration=SAMPLE_RADIUS-distance;
          if(penetration<=depth)continue;
          if(distance>1e-8)normal.subVectors(point,closest).multiplyScalar(1/distance);
          else triangle.getNormal(normal);
          depth=penetration;bestNormal.copy(normal);
        }
      }
      return depth>0?{depth,normal:bestNormal.clone()}:null;
    }
    function resolve(position,quaternion,velocity){
      let support=null,wall=null;
      for(let iteration=0;iteration<12;iteration++){
        const hit=contact(position,quaternion);if(!hit)break;
        position.addScaledVector(hit.normal,hit.depth+SKIN);
        const inward=velocity.dot(hit.normal);
        if(inward<0)velocity.addScaledVector(hit.normal,-inward*(inward< -1.5?1.08:1));
        if(hit.normal.y<.35)wall=hit.normal;
        if(!support||hit.normal.y>support.y)support=hit.normal;
      }
      if(support)support.wall=wall;
      return support;
    }
    function sweep(from,fromRotation,to,toRotation){
      const count=Math.max(1,Math.ceil(from.distanceTo(to)/.035),Math.ceil(fromRotation.angleTo(toRotation)/.08));
      const position=from.clone(),quaternion=fromRotation.clone(),lastPosition=from.clone(),lastRotation=fromRotation.clone();
      for(let i=1;i<=count;i++){
        position.lerpVectors(from,to,i/count);quaternion.slerpQuaternions(fromRotation,toRotation,i/count);
        const hit=contact(position,quaternion);
        if(hit)return {position:lastPosition,quaternion:lastRotation,normal:hit.normal};
        lastPosition.copy(position);lastRotation.copy(quaternion);
      }
      return null;
    }
    return {contact,resolve,sweep,groundY,triangleCount:triangles.length};
  }
  function escapeDirection(surface,point,fallback){
    const x=point.x-surface.x,z=point.z-surface.z;
    if(surface.shape==='circle')return new T.Vector3(x,0,z).lengthSq()>1e-10?new T.Vector3(x,0,z).normalize():fallback.clone().normalize();
    const dx=surface.width/2-Math.abs(x),dz=surface.depth/2-Math.abs(z);
    if(dx<dz)return new T.Vector3(Math.sign(x)||Math.sign(fallback.x)||1,0,0);
    return new T.Vector3(0,0,Math.sign(z)||Math.sign(fallback.z)||1);
  }
  function createBody(world,position,quaternion,direction){
    const body={position:position.clone(),quaternion:quaternion.clone(),velocity:direction.clone().multiplyScalar(2.1),
      angularVelocity:new T.Vector3(direction.z,0,-direction.x).multiplyScalar(4.8),elapsed:0,groundedFor:0,finished:false};
    body.velocity.y=-.7;
    const rotation=new T.Quaternion(),axis=new T.Vector3(),tangent=new T.Vector3(),rolling=new T.Vector3();
    const previousPosition=new T.Vector3(),previousRotation=new T.Quaternion();
    function step(dt){
      previousPosition.copy(body.position);previousRotation.copy(body.quaternion);
      body.velocity.y-=14*dt;
      body.position.addScaledVector(body.velocity,dt);
      const speed=body.angularVelocity.length();
      if(speed>1e-5){axis.copy(body.angularVelocity).multiplyScalar(1/speed);rotation.setFromAxisAngle(axis,speed*dt);body.quaternion.premultiply(rotation).normalize();}
      // Sweep fast movement before resolving contacts so a thin eave cannot be skipped.
      let support=null;
      if(previousPosition.distanceToSquared(body.position)>.06*.06){
        const hit=world.sweep(previousPosition,previousRotation,body.position,body.quaternion);
        if(hit){
          body.position.copy(hit.position);body.quaternion.copy(hit.quaternion);support=hit.normal;
          const inward=body.velocity.dot(support);if(inward<0)body.velocity.addScaledVector(support,-inward);
        }
      }
      support=world.resolve(body.position,body.quaternion,body.velocity)||support;
      if(world.contact(body.position,body.quaternion)?.depth>.004){
        // At a roof/wall corner rotation can introduce incompatible contacts. Keep
        // the last clear orientation and allow translation to slide along the edge.
        body.quaternion.copy(previousRotation);
        world.resolve(body.position,body.quaternion,body.velocity);
        if(world.contact(body.position,body.quaternion)?.depth>.004)body.position.copy(previousPosition);
        body.angularVelocity.multiplyScalar(.6);
      }
      const upY=1-2*(body.quaternion.x**2+body.quaternion.z**2);
      const height=SAMPLE_RADIUS+.3*Math.sqrt(Math.max(0,1-upY*upY));
      const onGround=body.position.y-height<world.groundY+.025&&Math.abs(body.velocity.y)<.5;
      if(onGround&&!support)support=new T.Vector3(0,1,0);
      if(support){
        if(support.wall&&Math.hypot(body.velocity.x,body.velocity.z)<.5){
          // A railing or a raised side wing deflects the coin along its outside.
          tangent.set(support.wall.z,0,-support.wall.x).normalize();
          if(tangent.dot(direction)<0)tangent.negate();
          body.velocity.addScaledVector(tangent,dt*8);
        }
        tangent.copy(body.velocity).addScaledVector(support,-body.velocity.dot(support));
        rolling.crossVectors(support,tangent).multiplyScalar(1/RADIUS);
        body.angularVelocity.lerp(rolling,1-Math.exp(-dt*8));
        if(!onGround&&support.y>.25){
          // A rejected edge landing keeps a small outward drift instead of balancing forever.
          body.velocity.addScaledVector(direction,dt*2.3);
        }
        body.velocity.x*=Math.exp(-dt*(onGround?8:.45));body.velocity.z*=Math.exp(-dt*(onGround?8:.45));
        if(onGround)body.angularVelocity.multiplyScalar(Math.exp(-dt*9));
      }
      body.elapsed+=dt;body.groundedFor=onGround?body.groundedFor+dt:0;
      body.finished=body.groundedFor>.22||body.elapsed>=3.5-1e-8;
    }
    body.advance=seconds=>{
      const end=Math.min(seconds,3.5);
      while(body.elapsed+1e-8<end&&!body.finished)step(Math.min(STEP,end-body.elapsed));
      return body;
    };
    world.resolve(body.position,body.quaternion,body.velocity);
    return body;
  }
  return {createWorld,createBody,escapeDirection,RADIUS};
});
