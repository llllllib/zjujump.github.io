(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.ZjuLeaderboard=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  // Deployment configuration. Use HTTPS so hosted HTTPS pages can call the API too.
  const API_URL='https://tinywebdb.appinventor.space/api';
  const LEADERBOARD_TAG='zju_tiaoyitiao_leaderboard_v1';
  const API_USER='yinlang';
  const API_SECRET='e4e23f45';
  // This host additionally requires action=get/update, and returns {tag: value}.
  // Set this to null for a standard method-only TinyWebDB endpoint.
  const API_ACTIONS={getvalue:'get',storeavalue:'update'};
  const MAX_ENTRIES=100,MAX_SCORE=99999999,SUBMIT_INTERVAL=3000,REQUEST_TIMEOUT=8000;
  const STORAGE_KEYS={uid:'zju_jump_uid_v1',nickname:'zju_jump_nickname_v1',lastSubmit:'zju_jump_last_submit_v1_'};
  const UID_PATTERN=/^[a-z0-9]{6,8}$/,NICKNAME_PATTERN=/^[\p{Script=Han}A-Za-z0-9_-]+$/u;

  class LeaderboardError extends Error{
    constructor(code,message,retryable=false){super(message);this.name='LeaderboardError';this.code=code;this.retryable=retryable;}
  }
  function validateNickname(nickname){
    if(typeof nickname!=='string'||Array.from(nickname).length<1||Array.from(nickname).length>16)
      throw new LeaderboardError('NICKNAME','昵称须为 1–16 个字符。');
    if(!NICKNAME_PATTERN.test(nickname))
      throw new LeaderboardError('NICKNAME','昵称只允许中英文、数字、下划线和连字符，不能包含 # 或空格。');
    return nickname;
  }
  function validateScore(score){
    if(!Number.isSafeInteger(score)||score<0||score>MAX_SCORE)
      throw new LeaderboardError('SCORE',`分数须为 0–${MAX_SCORE} 的整数。`);
    if(score===0)throw new LeaderboardError('ZERO_SCORE','0 分暂不上榜，再挑战一次吧。');
    return score;
  }
  function compareRecords(a,b){return b.score-a.score||a.createdAt-b.createdAt||a.uid.localeCompare(b.uid);}
  function normalizeRecords(records,limit=MAX_ENTRIES){
    const players=new Map();
    for(const record of records){
      if(!record||typeof record!=='object'||typeof record.uid!=='string'||!UID_PATTERN.test(record.uid))continue;
      try{validateNickname(record.nickname);validateScore(record.score);}catch(error){continue;}
      if(!Number.isSafeInteger(record.createdAt)||record.createdAt<=0)continue;
      const clean={nickname:record.nickname,uid:record.uid,score:record.score,createdAt:record.createdAt};
      const previous=players.get(clean.uid);
      if(!previous||compareRecords(clean,previous)<0)players.set(clean.uid,clean);
    }
    return [...players.values()].sort(compareRecords).slice(0,limit);
  }
  function mergeRecords(records,incoming){
    const result=normalizeRecords(records,Infinity),index=result.findIndex(record=>record.uid===incoming.uid);
    if(index<0)result.push({...incoming});
    else if(incoming.score>result[index].score)result[index]={...incoming};
    return result.sort(compareRecords).slice(0,MAX_ENTRIES);
  }
  function generateUid(){
    const alphabet='abcdefghijklmnopqrstuvwxyz0123456789',bytes=new Uint8Array(16);let uid='';
    while(uid.length<8){
      globalThis.crypto.getRandomValues(bytes);
      for(const value of bytes){if(value<252)uid+=alphabet[value%36];if(uid.length===8)break;}
    }
    return uid;
  }
  function decodeValue(payload,tag=LEADERBOARD_TAG){
    // Also accept the standard App Inventor ["VALUE", tag, value] response.
    let value;
    if(payload&&Object.hasOwn(payload,'VALUE'))value=payload.VALUE;
    else if(Array.isArray(payload)&&payload[0]==='VALUE')value=payload[2];
    else if(payload&&Object.hasOwn(payload,tag))value=payload[tag];
    else throw new LeaderboardError('DATA','榜单返回格式异常，请稍后重试。');
    if(value===null||value===''||value==='null')return [];
    if(typeof value==='string'){
      try{value=JSON.parse(value);}catch(error){throw new LeaderboardError('DATA','榜单数据无法解析，已停止写入。');}
    }
    if(!Array.isArray(value))throw new LeaderboardError('DATA','榜单数据不是数组，已停止写入。');
    return value;
  }
  function createClient(options={}){
    const fetchImpl=options.fetch||((...args)=>globalThis.fetch(...args));
    let storage=options.storage;
    if(!Object.hasOwn(options,'storage')){try{storage=globalThis.localStorage;}catch(error){storage=null;}}
    const now=options.now||Date.now,makeUid=options.generateUid||generateUid;
    const pause=options.pause||(milliseconds=>new Promise(resolve=>setTimeout(resolve,milliseconds)));
    const endpoint=options.apiUrl||API_URL,tag=options.tag||LEADERBOARD_TAG;
    const user=options.user??API_USER,secret=options.secret??API_SECRET;
    const actions=Object.hasOwn(options,'actions')?options.actions:API_ACTIONS;
    let uid=null,submitting=false;
    function readLocal(key){try{return storage?.getItem(key)??null;}catch(error){return null;}}
    function writeLocal(key,value){
      try{if(!storage)throw Error('storage unavailable');storage.setItem(key,String(value));}
      catch(error){throw new LeaderboardError('STORAGE','无法保存玩家身份，请允许此页面使用本地存储后重试。');}
    }
    const savedUid=readLocal(STORAGE_KEYS.uid);if(UID_PATTERN.test(savedUid||''))uid=savedUid;
    function ensureUid(records){
      if(uid)return uid;
      const saved=readLocal(STORAGE_KEYS.uid);
      if(UID_PATTERN.test(saved||'')){uid=saved;return uid;}
      // Check every returned ID, including records outside the top 100 or invalid rows.
      const occupied=new Set(records.map(record=>record?.uid));let candidate;
      do{candidate=makeUid();}while(!UID_PATTERN.test(candidate)||occupied.has(candidate));
      writeLocal(STORAGE_KEYS.uid,candidate);uid=candidate;return uid;
    }
    async function request(method,value){
      const body=new FormData();body.set('method',method);body.set('tag',tag);
      if(actions?.[method])body.set('action',actions[method]);
      if(user)body.set('user',user);if(secret)body.set('secret',secret);
      if(value!==undefined)body.set('value',JSON.stringify(value));
      const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),options.timeout??REQUEST_TIMEOUT);
      try{
        const response=await fetchImpl(endpoint,{method:'POST',body,signal:controller.signal,credentials:'omit',cache:'no-store'});
        if(!response.ok)throw new LeaderboardError('HTTP',`排行榜服务暂时不可用（HTTP ${response.status}），请稍后重试。`,response.status>=500||response.status===429);
        const text=await response.text();
        if(/user or secret error/i.test(text))throw new LeaderboardError('AUTH','排行榜服务认证失败，请检查账号配置。');
        if(method==='storeavalue'&&!text.trim())return null;
        let payload;try{payload=JSON.parse(text);}catch(error){
          throw new LeaderboardError('DATA','排行榜服务返回了无效数据，请稍后重试。');
        }
        if(payload?.error||payload?.success===false||payload?.ERROR||['error','failed','fail'].includes(payload?.status))
          throw new LeaderboardError('SERVICE','排行榜服务未接受请求，请稍后重试。',true);
        return payload;
      }catch(error){
        if(error instanceof LeaderboardError)throw error;
        throw new LeaderboardError('NETWORK',controller.signal.aborted?'排行榜请求超时，请检查网络后重试。':'无法连接排行榜，请检查网络后重试。',true);
      }finally{clearTimeout(timeout);}
    }
    const readRecords=async()=>decodeValue(await request('getvalue'),tag);
    async function retryOnce(operation){
      try{return await operation();}catch(error){if(!error.retryable)throw error;await pause(350);return operation();}
    }
    async function load(){
      const records=await retryOnce(readRecords);ensureUid(records);
      return {uid,records:normalizeRecords(records)};
    }
    function lastNickname(){const value=readLocal(STORAGE_KEYS.nickname)||'';try{return validateNickname(value);}catch(error){return '';}}
    function checkCooldown(){
      if(!uid)return;
      const previous=Number(readLocal(STORAGE_KEYS.lastSubmit+uid)),remaining=SUBMIT_INTERVAL-(now()-previous);
      if(previous>0&&remaining>0)throw new LeaderboardError('COOLDOWN',`提交间隔至少 3 秒，请 ${Math.ceil(remaining/1000)} 秒后再试。`);
    }
    async function submit(nickname,score){
      validateNickname(nickname);validateScore(score);
      if(submitting)throw new LeaderboardError('BUSY','成绩正在提交，请稍候。');
      checkCooldown();submitting=true;
      const createdAt=now();let cooldownSet=false;
      try{
        writeLocal(STORAGE_KEYS.nickname,nickname);
        // Reserve an existing player's interval before networking, even if reads fail.
        if(uid){writeLocal(STORAGE_KEYS.lastSubmit+uid,createdAt);cooldownSet=true;}
        return await retryOnce(async()=>{
          const records=await readRecords();ensureUid(records);
          if(!cooldownSet){checkCooldown();writeLocal(STORAGE_KEYS.lastSubmit+uid,now());cooldownSet=true;}
          const incoming={nickname,uid,score,createdAt};
          const previous=normalizeRecords(records,Infinity).find(record=>record.uid===uid);
          if(previous&&previous.score>=score)return {uid,records:normalizeRecords(records),status:'unchanged',best:previous.score};
          const merged=mergeRecords(records,incoming);
          await request('storeavalue',merged);
          // Verification also supplies the freshly rendered board. Retry the complete
          // read/merge/write cycle once, never a stale overwrite or a distributed lock.
          const verified=normalizeRecords(await readRecords());
          const own=verified.find(record=>record.uid===uid);
          if(own&&own.score>=score)return {uid,records:verified,status:'saved',best:own.score};
          // Legitimate truncation is not a concurrent-write failure.
          if(verified.length===MAX_ENTRIES&&compareRecords(incoming,verified[MAX_ENTRIES-1])>=0)
            return {uid,records:verified,status:'outside-top',best:score};
          throw new LeaderboardError('CONFLICT','成绩可能被同时提交覆盖，自动重试后仍未确认，请稍后再试。',true);
        });
      }finally{submitting=false;}
    }
    return {load,submit,lastNickname,getUid:()=>uid};
  }
  return {createClient,generateUid,validateNickname,validateScore,compareRecords,normalizeRecords,mergeRecords,decodeValue,
    API_URL,LEADERBOARD_TAG,MAX_ENTRIES,MAX_SCORE,SUBMIT_INTERVAL,STORAGE_KEYS,LeaderboardError};
});
