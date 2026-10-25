const data = [
["紫金港 · 东大门","精神地标","1897 · 求是文脉","东大门石碑上刻着竺可桢校长著名的“两问”：到浙大来做什么？将来毕业后做什么样的人？","来浙大，不只是抵达一所大学，也是开始回答两个人生问题。"],
["求是大讲堂","思想坐标","求是 · 创新","承载学术报告、典礼与文化活动，是求是精神在当代校园里的重要表达空间。","只问是非，不计利害。"],
["月牙楼 · 校史馆","校史记忆","2007 · 紫金港","以“求是溯源、探求崛起、调整发展、争创一流”四个阶段展现浙大跨越三个世纪的发展历程。","把历史放在身边，才能看见今天从哪里来。"],
["竺可桢纪念馆","先生风骨","1999 · 求是先声","陈列竺可桢先生的历史图片、生活用品、日记手稿和信函，重点回顾率领师生西迁办学的岁月。","大学不仅要造就学生，更要造就一代人的精神。"],
["艺术与考古博物馆","美育空间","2019 · 国家一级","2019 年开馆，2024 年获评国家一级博物馆，设有“造物之美”和“大系”展厅。","在文物与科技之间，重新发现文明的温度。"],
["求是书院","书院文化","书院 · 育人","求是书院文化群是校园文化育人的重要载体，构成可阅读、可感知的精神景观。","海纳江河，启真厚德；开物前民，树我邦国。"],
["紫金港 · 主图书馆","书香浙大","阅读 · 求知","“书香浙大”系列持续举办读书会、阅读打卡与书海挑战赛，让图书馆成为文化日常。","惟学无际，阅读让校园拥有更长的时间。"],
["浙江大学校门牌","视觉识别","求是蓝 · 创新红","浙大视觉识别系统以“求是蓝”和“创新红”为核心色彩，求是鹰象征锐意进取。","蓝色是海纳江河，红色是开物前民。"],
["求是鹰 · 校标","视觉符号","1897 · 求是鹰","现行校标保留求是鹰的基本形状，内圈下方的 1897 代表学校创建年份。","展翅的鹰，是求是与创新共同生长的形状。"],
["玉泉 · 正大门","玉泉记忆","求是 · 创新","玉泉正大门雕刻着“求是”“创新”二字，相关元素也被转化为文创产品。","门上的两个词，打开的是一所大学的气质。"],
["西迁纪念碑亭","西迁文化","1937 · 文军长征","抗战时期，浙大先后经七省区西迁，行程近 2600 多公里，在湄潭坚持办学七年。","烽火中的坚持，让求是精神拥有了山河的重量。"],
["湄潭 · 浙大旧址","浙大文脉","1940 · 贵州湄潭","浙大师生在艰苦环境中继续教学与研究，留下浙大历史上重要的办学篇章。","无论身在何处，大学都可以继续生长。"],
["之江校区 · 钟楼","建筑遗产","西湖 · 之江","历史建筑与山水相依，见证浙江大学不同阶段的办学历程。","建筑会沉默，但它一直在替时间说话。"],
["华家池 · 校园一角","校园记忆","华家池 · 生活","华家池承载着丰富的校园生活与学科记忆，越剧社等文化社团也曾从这里出发。","校园的文化，常常从一场演出、一段相遇开始。"],
["紫金港 · 体育馆","青春现场","迎新 · 毅行","迎新跑、毅行、美食节与学生节，让体育空间成为师生共同参与的文化现场。","一起奔跑的人，会把校园走成共同的家。"],
["学生社团文化节","社团百花","265 个社团","截至 2025 年 10 月，浙江大学有 265 个学生社团，覆盖戏剧、越剧、传统文化、体育与公益。","每一种兴趣，都值得在大学里长成一棵树。"],
["黑白剧社 · 舞台","戏剧育人","1937 · 黑白文艺社","黑白剧社前身是黑白文艺社，原创话剧《同行》《太阳城》《求是魂》曾获多项荣誉。","舞台不只讲故事，也让一代人看见自己的责任。"],
["书香浙大 · 阅读角","文化日常","2025 · 百余场活动","“书香浙大”开展百余场活动，触达人数超过 200 万人次，把阅读变成校园日常。","读书是一个人和一所大学最长久的对话。"],
["浙大文创 · 求是生活","文化新物","求是蓝 · 创新红","浙大文创开发求是创新、星辰、西迁往事等系列，让校园文化进入日常生活。","把记忆带回生活，文化就有了新的抵达方式。"],
["求是之巅 · 终点","旅程终章","向未来 · 再出发","走过 20 座建筑，你收集的不只是校园地标，也是一条从求是文脉通向未来的精神路线。","下一次，我们从新的问题出发."]
].map(x=>({name:x[0],tag:x[1],year:x[2],description:x[3],quote:x[4]}));

const $=id=>document.getElementById(id), stage=$("gameStage"), layer=$("platformLayer"), player=$("player"), button=$("jumpButton"), overlay=$("stageOverlay");
let current=0, charging=false, started=0, raf=0, muted=false, camera=0, platforms=[];

function info(i){const x=data[i];$("infoTitle").textContent=x.name;$("stationNumber").textContent=String(i+1).padStart(2,"0");$("infoTag").textContent=x.tag;$("infoYear").textContent=x.year;$("infoDescription").textContent=x.description;$("infoQuote").textContent=x.quote;$("progressText").textContent=`${i+1} / 20`;$("progressBar").style.width=`${(i+1)*5}%`;$("progressCount").textContent=String(i+1).padStart(2,"0");$("routeLabel").textContent=x.name;$("buildingVisual").innerHTML='<div class="building-drawing"><span class="roof"></span><span class="body"></span><span class="columns"></span><span class="sign">求是</span></div>'}
function platform(p){p.node.style.left=`${p.x-camera}px`;p.node.style.top=`${p.y}px`;p.node.style.transform=`translate3d(-50%,-50%,${p.z}px) scale(${Math.max(.66,1-p.z/1800)})`;p.node.style.opacity=p.z>1550?0:1}
function drawPlayer(p,x=p.x,y=p.y){player.style.left=`${x-camera}px`;player.style.top=`${y-12}px`}
function world(){platforms.forEach(platform);drawPlayer(platforms[current])}
function build(){layer.innerHTML="";platforms=[];for(let i=0;i<20;i++){let x=i?platforms[i-1].x+125+(i*47)%115:105;let n=document.createElement("div");n.className="platform";n.innerHTML=`<span class="platform-top"></span><span class="platform-label">${String(i+1).padStart(2,"0")}</span>`;layer.appendChild(n);let p={node:n,x,y:stage.clientHeight-112-(i*71)%125,z:i*95,width:92};platforms.push(p);platform(p)}platforms[0].node.classList.add("current");drawPlayer(platforms[0])}
function tone(freq=400){if(muted)return;try{let a=new(window.AudioContext||window.webkitAudioContext),o=a.createOscillator(),g=a.createGain();o.frequency.value=freq;g.gain.value=.03;g.gain.exponentialRampToValueAtTime(.001,a.currentTime+.15);o.connect(g).connect(a.destination);o.start();o.stop(a.currentTime+.15)}catch(_){}}
function fail(text){cancelAnimationFrame(raf);charging=false;button.classList.remove("charging");$("overlayTitle").textContent="这一步没有站稳";$("overlayText").textContent=text;$("overlayButton").textContent="重新挑战";overlay.hidden=false;tone(120)}
function land(i){current=i;platforms.forEach((p,n)=>p.node.classList.toggle("visited",n<=i));camera=Math.max(0,platforms[i].x-stage.clientWidth*.28);world();info(i);$("scoreValue").textContent=String(i*120).padStart(3,"0");$("landingFlash").style.left=`${platforms[i].x-camera}px`;$("landingFlash").style.top=`${platforms[i].y}px`;$("landingFlash").classList.remove("active");void $("landingFlash").offsetWidth;$("landingFlash").classList.add("active");tone(350+i*10);if(i===19)setTimeout(()=>{$("overlayTitle").textContent="抵达求是之巅";$("overlayText").textContent="你已经走过 20 座浙大建筑，把校园文化装进了每一次跳跃。";$("overlayButton").textContent="再走一遍";overlay.hidden=false},450)}
function jump(){if(!charging||current===19)return;charging=false;button.classList.remove("charging");$("tipCard").classList.add("hide");let a=platforms[current],b=platforms[current+1],held=performance.now()-started,speed=Math.min(2.2,Math.max(.12,held/900)),distance=60+speed*220,target=b.x-a.x,duration=560+Math.min(260,speed*100),begin=performance.now(),arc=92+speed*30,landingX=a.x+distance;
function frame(now){let t=Math.min(1,(now-begin)/duration),x=a.x+distance*t,gravityArc=4*arc*t*(1-t),y=a.y+(b.y-a.y)*t-gravityArc;
  camera=Math.max(0,x-stage.clientWidth*.28);
  player.style.left=`${x-camera}px`;
  player.style.top=`${y-12}px`;
  player.style.transform=`translate(-50%,-100%) rotate(${Math.atan2((b.y-a.y)-4*arc*(1-2*t),distance)*57.3}deg)`;
  if(t<1){raf=requestAnimationFrame(frame);return}
  const safeLanding=Math.abs(landingX-b.x)<=b.width/2+22;
  if(!safeLanding){player.style.transform="translate(-50%,-100%)";fail(distance<target?"蓄力太少，棋子没有跳到下一个平台。":"蓄力太久，棋子越过了下一个平台。");return}
  const settleStart=performance.now(),settleFrom=landingX,settleTo=b.x;
  function settle(now){const s=Math.min(1,(now-settleStart)/150),ease=s*s*(3-2*s),settleX=settleFrom+(settleTo-settleFrom)*ease;camera=Math.max(0,settleX-stage.clientWidth*.28);player.style.left=`${settleX-camera}px`;player.style.top=`${b.y-12}px`;player.style.transform=`translate(-50%,-100%) rotate(${(1-ease)*6}deg)`;if(s<1){raf=requestAnimationFrame(settle);return}player.style.transform="translate(-50%,-100%)";land(current+1)}
  raf=requestAnimationFrame(settle)
}
raf=requestAnimationFrame(frame)}
function start(e){e?.preventDefault();if(!overlay.hidden||charging||current===19)return;charging=true;started=performance.now();button.classList.add("charging")}
function release(e){e?.preventDefault();if(charging)jump()}
function reset(){cancelAnimationFrame(raf);current=0;camera=0;overlay.hidden=true;$("tipCard").classList.remove("hide");build();info(0);$("scoreValue").textContent="000"}
button.addEventListener("pointerdown",start);window.addEventListener("pointerup",release);window.addEventListener("keydown",e=>{if(e.code==="Space"){e.preventDefault();if(!charging)start(e)}});window.addEventListener("keyup",e=>{if(e.code==="Space")release(e)});$("restartButton").addEventListener("click",reset);$("overlayButton").addEventListener("click",reset);$("soundButton").addEventListener("click",()=>{muted=!muted;$("soundButton").textContent=muted?"×":"♫"});window.addEventListener("resize",()=>{build();world()});info(0);build();$("scoreValue").textContent="000";
