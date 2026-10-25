const {test}=require('node:test'),assert=require('node:assert/strict');
const T=require('../vendor/three.min.js'),physics=require('../fall-physics.js');
function building(width=3,height=2,depth=2){
  const group=new T.Group(),mesh=new T.Mesh(new T.BoxGeometry(width,height,depth));
  mesh.position.y=height/2;group.add(mesh);return group;
}
const identity=()=>new T.Quaternion();

test('swept collision catches thin roofs and walls even across a skipped frame',()=>{
  const roof=building(4,.04,3),world=physics.createWorld([roof]);
  const roofHit=world.sweep(new T.Vector3(0,2,0),identity(),new T.Vector3(0,-1,0),identity());
  assert.ok(roofHit);assert.ok(roofHit.position.y>.04+.08);assert.equal(world.contact(roofHit.position,roofHit.quaternion),null);
  const wall=physics.createWorld([building(.06,3,3)]);
  const wallHit=wall.sweep(new T.Vector3(-2,1,0),identity(),new T.Vector3(2,1,0),identity());
  assert.ok(wallHit);assert.ok(wallHit.position.x<-.4);
});

test('coin rolls out over a roof edge, stays outside masonry and comes to rest on the ground',()=>{
  const world=physics.createWorld([building()]),body=physics.createBody(world,new T.Vector3(1.35,2.115,0),identity(),new T.Vector3(1,0,0));
  let onRoof=false,outside=false,turned=false,maxDepth=0;
  for(let frame=1;frame<=420&&!body.finished;frame++){
    body.advance(frame/120);
    const hit=world.contact(body.position,body.quaternion);maxDepth=Math.max(maxDepth,hit?.depth||0);
    onRoof||=body.position.y>2;outside||=body.position.x>1.5+physics.RADIUS;
    turned||=body.quaternion.angleTo(identity())>.4;
    if(body.position.y<1.8)assert.ok(body.position.x>1.5,'fall must clear the outside wall');
  }
  assert.ok(onRoof&&outside&&turned);assert.ok(maxDepth<.006,`penetration ${maxDepth}`);
  assert.ok(body.finished);assert.ok(body.position.y>world.groundY&&body.position.y<.3);
});

test('a missed jump in open air falls freely, without snapping towards a building',()=>{
  const world=physics.createWorld([building()]);
  const start=new T.Vector3(4,2.2,0),body=physics.createBody(world,start,identity(),new T.Vector3(0,0,-1));
  body.advance(.15);assert.equal(body.position.x,start.x);assert.ok(body.position.y<start.y-.1);
  body.advance(3.5);assert.ok(body.finished);assert.ok(body.position.y>world.groundY);
});

test('edge direction uses the nearest edge for undershoots, overshoots and circular plinths',()=>{
  const surface={x:0,z:0,width:3,depth:2},forward=new T.Vector3(0,0,-1);
  assert.deepEqual(physics.escapeDirection(surface,{x:0,z:.9},forward).toArray(),[0,0,1]);
  assert.deepEqual(physics.escapeDirection(surface,{x:0,z:-.9},forward).toArray(),[0,0,-1]);
  assert.ok(physics.escapeDirection({x:0,z:0,shape:'circle'}, {x:3,z:4},forward).distanceTo(new T.Vector3(.6,0,.8))<1e-10);
});

test('fixed collision steps produce the same result at high and low display frame rates',()=>{
  const world=physics.createWorld([building()]);
  const make=()=>physics.createBody(world,new T.Vector3(1.35,2.115,0),identity(),new T.Vector3(1,0,0));
  const fast=make(),slow=make();
  for(let i=1;i<=120;i++)fast.advance(i/120);
  for(let i=1;i<=20;i++)slow.advance(i/20);
  assert.ok(fast.position.distanceTo(slow.position)<1e-8);
  assert.ok(fast.quaternion.angleTo(slow.quaternion)<1e-7);
});

test('a coin caught on a ledge always finishes, including fractional fixed-step time',()=>{
  const world=physics.createWorld([building(20,2,20)]);
  const body=physics.createBody(world,new T.Vector3(0,2.1,0),identity(),new T.Vector3(1,0,0));
  for(let frame=1;frame<=420;frame++)body.advance(frame/120);
  assert.ok(body.finished);assert.ok(body.elapsed<=3.5);
});
