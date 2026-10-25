(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.JumpCore=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const MAX_CHARGE=1600,PLAYER_RADIUS=.37;
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  function travelForCharge(milliseconds){
    return .7+clamp(milliseconds,0,MAX_CHARGE)*.0054;
  }
  function chargeForDistance(distance){return clamp((distance-.7)/.0054,0,MAX_CHARGE);}
  function trajectory(from,to,travel){
    const dx=to.x-from.x,dz=to.z-from.z,distance=Math.hypot(dx,dz);
    const divisor=distance||1;
    return {from:{...from},to:{x:from.x+dx/divisor*travel,y:to.y,z:from.z+dz/divisor*travel},
      duration:clamp(.43+travel*.037,.46,.82),height:1.15+travel*.155,travel};
  }
  function sample(flight,t){
    t=clamp(t,0,1);
    return {x:flight.from.x+(flight.to.x-flight.from.x)*t,
      y:flight.from.y+(flight.to.y-flight.from.y)*t+4*flight.height*t*(1-t),
      z:flight.from.z+(flight.to.z-flight.from.z)*t};
  }
  function contains(surface,point,margin=PLAYER_RADIUS*.5){
    const dx=point.x-surface.x,dz=point.z-surface.z;
    if(surface.shape==='circle')return Math.hypot(dx,dz)<=surface.radius-margin;
    return Math.abs(dx)<=surface.width/2-margin&&Math.abs(dz)<=surface.depth/2-margin;
  }
  function landingResult(surface,point){
    if(!contains(surface,point))return {hit:false,perfect:false};
    return {hit:true,perfect:Math.hypot(point.x-surface.x,point.z-surface.z)<=.32};
  }
  function pointsForLanding(perfect,combo){return perfect?2+Math.min(combo,6)*2:1;}
  function course(){
    const result=[];let x=0,z=0;
    const headings=[0,0,1,0,1,1,0,1,0,0,1,1,0,1,0,1,1,0,1];
    for(let i=0;i<20;i++){
      if(i){const gap=5.9+((i*7)%5)*.37;if(headings[i-1])x-=gap;else z-=gap;}
      result.push({x,z,y:0,index:i});
    }
    return result;
  }
  return Object.freeze({MAX_CHARGE,PLAYER_RADIUS,clamp,travelForCharge,chargeForDistance,
    trajectory,sample,contains,landingResult,pointsForLanding,course});
});
