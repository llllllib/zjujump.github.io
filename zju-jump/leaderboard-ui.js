(function(){
  'use strict';
  const element=id=>document.getElementById(id),client=ZjuLeaderboard.createClient();
  const dialog=element('leaderboardDialog'),form=element('scoreForm'),input=element('nicknameInput');
  const submitButton=element('submitScoreButton'),submitStatus=element('submitStatus');
  const boardStatus=element('leaderboardStatus'),rows=element('leaderboardRows');
  let resultScore=0,resultVersion=0,boardVersion=0,busy=false,returnFocus=null;
  function setStatus(target,message,error=false){target.textContent=message;target.classList.toggle('is-error',error);}
  function updateIdentity(){
    const uid=client.getUid();
    element('playerIdentity').textContent=uid?`玩家 ID：#${uid}`:'联网后自动分配玩家 ID';
    element('leaderboardIdentity').textContent=uid?`我的 ID：#${uid}`:'';
  }
  function renderBoard(records){
    const fragment=document.createDocumentFragment();
    records.forEach((record,index)=>{
      const row=document.createElement('tr');
      if(record.uid===client.getUid())row.classList.add('is-me');
      for(const value of [index+1,`${record.nickname}#${record.uid}`,record.score]){
        const cell=document.createElement('td');cell.textContent=String(value);row.appendChild(cell);
      }
      fragment.appendChild(row);
    });
    rows.replaceChildren(fragment);updateIdentity();
    setStatus(boardStatus,records.length?`已收录 ${records.length} 位玩家`:'暂无成绩，来成为第一位上榜的玩家吧。');
  }
  async function refresh(){
    const version=++boardVersion;element('refreshLeaderboard').disabled=true;
    setStatus(boardStatus,'正在加载…');
    try{
      const result=await client.load();if(version!==boardVersion)return;renderBoard(result.records);
    }catch(error){
      if(version!==boardVersion)return;rows.replaceChildren();
      setStatus(boardStatus,`暂时无法加载。${error.message}`,true);updateIdentity();
    }finally{if(version===boardVersion)element('refreshLeaderboard').disabled=false;}
  }
  function showResult(score){
    resultVersion++;resultScore=score;input.value=client.lastNickname();input.disabled=busy;submitButton.disabled=busy||score===0;
    submitButton.textContent=busy?'正在提交…':'提交成绩';input.removeAttribute('aria-invalid');
    element('nicknameHint').textContent='1–16 字，中英文、数字、下划线或连字符；昵称可重名。';
    setStatus(submitStatus,score===0?'0 分暂不上榜，再挑战一次吧。':'提交后以“昵称#ID”显示，只保留你的最高分。');updateIdentity();
  }
  input.addEventListener('input',()=>{
    input.removeAttribute('aria-invalid');
    if(input.value.includes('#')){
      input.value=input.value.replaceAll('#','');
      setStatus(submitStatus,'已移除 #，该符号用于分隔昵称与玩家 ID。',true);
    }else setStatus(submitStatus,'');
  });
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(busy)return;
    const nickname=input.value,score=resultScore,version=resultVersion;
    try{ZjuLeaderboard.validateNickname(nickname);ZjuLeaderboard.validateScore(score);}catch(error){
      setStatus(submitStatus,error.message,true);if(error.code==='NICKNAME'){input.setAttribute('aria-invalid','true');input.focus();}return;
    }
    busy=true;submitButton.disabled=true;input.disabled=true;submitButton.textContent='正在提交…';
    setStatus(submitStatus,'正在保存成绩，请稍候…');++boardVersion;
    try{
      const result=await client.submit(nickname,score);renderBoard(result.records);
      if(version!==resultVersion)return;
      const messages={saved:`成绩已确认：${nickname}#${result.uid} · ${score} 分`,unchanged:`已保留你的最高分 ${result.best} 分，本次成绩未超过纪录。`,'outside-top':'成绩已提交，本次暂未进入前 100 名。'};
      setStatus(submitStatus,messages[result.status]);
    }catch(error){if(version===resultVersion)setStatus(submitStatus,error.message,true);}
    finally{
      busy=false;input.disabled=false;submitButton.disabled=resultScore===0;submitButton.textContent='提交成绩';
      element('refreshLeaderboard').disabled=false;updateIdentity();
    }
  });
  element('leaderboardButton').addEventListener('click',()=>{
    window.dispatchEvent(new Event('zju:leaderboard-open'));returnFocus=document.activeElement;dialog.showModal();void refresh();
  });
  element('closeLeaderboard').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('close',()=>returnFocus?.focus());
  element('refreshLeaderboard').addEventListener('click',()=>void refresh());
  window.CampusLeaderboardUI={showResult};
  // A failed initial lookup never blocks the game or persists an unchecked ID.
  updateIdentity();void refresh();
})();
