const {test}=require('node:test');
const assert=require('node:assert/strict');
const core=require('../game-core.js');
const close=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-9,`${actual} != ${expected}`);

test('charge produces an absolute, capped distance and has a usable inverse',()=>{
  close(core.travelForCharge(-50),.7);
  close(core.travelForCharge(5000),core.travelForCharge(core.MAX_CHARGE));
  for(let ms=0;ms<=1600;ms+=25){
    close(core.chargeForDistance(core.travelForCharge(ms)),ms);
    if(ms)assert.ok(core.travelForCharge(ms)>core.travelForCharge(ms-25));
  }
});
test('the arc starts and ends at the requested roof height, with a visible apex',()=>{
  const start={x:2,y:3,z:4},target={x:2,y:1,z:-4};
  const flight=core.trajectory(start,target,8);
  assert.deepEqual(core.sample(flight,0),start);
  assert.deepEqual(core.sample(flight,1),target);
  close(core.sample(flight,.5).y,2+flight.height);
  assert.ok(flight.duration<.85&&flight.duration>.45);
  const shorter=core.trajectory(start,target,4);
  close(shorter.to.z,0);
  const diagonal=core.trajectory(start,{x:-3,y:2,z:-1},7);
  close(Math.hypot(diagonal.to.x-start.x,diagonal.to.z-start.z),7);
});
test('roof collisions account for the coin footprint, including circular seals',()=>{
  const rect={x:4,z:-3,width:2,depth:1};
  assert.equal(core.contains(rect,{x:4,z:-3}),true);
  assert.equal(core.contains(rect,{x:5,z:-3}),false);
  assert.equal(core.contains(rect,{x:4,z:-2.6}),false);
  assert.equal(core.contains(rect,{x:4,z:-2.7}),true);
  const round={x:0,z:0,shape:'circle',radius:1.2};
  assert.equal(core.contains(round,{x:.7,z:.7}),true);
  assert.equal(core.contains(round,{x:.8,z:.8}),false);
  assert.deepEqual(core.landingResult(rect,{x:4.2,z:-3.1}),{hit:true,perfect:true});
  assert.deepEqual(core.landingResult(rect,{x:4.6,z:-3}),{hit:true,perfect:false});
});
test('center streaks increase points and ordinary landings score one',()=>{
  assert.equal(core.pointsForLanding(false,9),1);
  assert.equal(core.pointsForLanding(true,0),2);
  assert.equal(core.pointsForLanding(true,1),4);
  assert.equal(core.pointsForLanding(true,8),14);
});
test('all nineteen course gaps are reachable without maxing out the charge',()=>{
  const course=core.course();assert.equal(course.length,20);
  const seen=new Set();
  for(let i=0;i<course.length;i++){
    const p=course[i];assert.ok(!seen.has(`${p.x},${p.z}`));seen.add(`${p.x},${p.z}`);
    if(!i)continue;const a=course[i-1],gap=Math.hypot(p.x-a.x,p.z-a.z),charge=core.chargeForDistance(gap);
    assert.ok(charge>650&&charge<core.MAX_CHARGE-150);
    close(core.travelForCharge(charge),gap);
    assert.ok(p.x<=a.x&&p.z<=a.z);
  }
});
