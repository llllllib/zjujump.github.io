const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createClient,mergeRecords,normalizeRecords,validateNickname,validateScore,decodeValue,STORAGE_KEYS,MAX_SCORE,generateUid}=require('../leaderboard.js');
const record=(uid,score=10,createdAt=100,nickname='求是同学')=>({nickname,uid,score,createdAt});
function harness(initial=[],settings={}){
  let board=structuredClone(initial),time=10000,reads=0,writes=0;
  const memory=new Map(Object.entries(settings.saved||{}));
  const storage={getItem:key=>memory.get(key)??null,setItem:(key,value)=>memory.set(key,String(value))};
  const fetch=async(url,options)=>{
    assert.equal(options.method,'POST');assert.ok(options.body instanceof FormData);
    assert.equal(options.body.get('tag'),'zju_tiaoyitiao_leaderboard_v1');
    const method=options.body.get('method');
    if(method==='getvalue'){
      reads++;if(settings.read)await settings.read({reads,board,setBoard:value=>board=value});
      return new Response(JSON.stringify({VALUE:JSON.stringify(board)}));
    }
    assert.equal(method,'storeavalue');writes++;
    const incoming=JSON.parse(options.body.get('value'));assert.ok(incoming.length<=100);
    board=incoming;if(settings.write)await settings.write({writes,board,setBoard:value=>board=value});
    return new Response(JSON.stringify(['STORED','zju_tiaoyitiao_leaderboard_v1','ok']));
  };
  const options={storage,fetch,now:()=>time,generateUid:settings.generateUid||(()=> 'myuid123'),pause:async()=>{}};
  const client=createClient(options);
  return {client,options,memory,advance:ms=>time+=ms,board:()=>board,counts:()=>({reads,writes})};
}
test('nickname rules allow duplicates but reject separators, whitespace, markup and more than 16 code points',()=>{
  for(const name of ['小王','ZJU_1897-a','求是123','a'.repeat(16)])assert.equal(validateNickname(name),name);
  for(const name of ['','#','小王#a1','a b','<script>','😀','a'.repeat(17)])assert.throws(()=>validateNickname(name));
});
test('scores must be positive safe integers within the specified ceiling',()=>{
  for(const value of [1,MAX_SCORE])assert.equal(validateScore(value),value);
  for(const value of [0,-1,MAX_SCORE+1,1.5,Infinity,NaN,'10'])assert.throws(()=>validateScore(value));
});
test('merge sorts by highest score and earliest achievement, keeping only one row per ID',()=>{
  const rows=[record('aaaaaa',20,20),record('bbbbbb',20,10),record('cccccc',5,1),record('aaaaaa',10,1)];
  assert.deepEqual(mergeRecords(rows,record('dddddd',20,15)).map(r=>r.uid),['bbbbbb','dddddd','aaaaaa','cccccc']);
  assert.deepEqual(mergeRecords(rows,record('aaaaaa',20,100,'改名')).find(r=>r.uid==='aaaaaa'),record('aaaaaa',20,20));
  assert.deepEqual(mergeRecords(rows,record('aaaaaa',21,100,'改名'))[0],record('aaaaaa',21,100,'改名'));
});
test('invalid cloud rows are ignored and lower-ranked scores are truncated after sorting',()=>{
  const rows=Array.from({length:120},(_,i)=>record('u'+String(i).padStart(7,'0'),120-i,i+1));
  assert.equal(normalizeRecords([...rows,record('bad!',99),record('valid12',2,4,'<img>')]).length,100);
  assert.equal(mergeRecords(rows,record('newuid1',999))[0].uid,'newuid1');
  assert.equal(mergeRecords(rows,record('newuid1',1)).some(r=>r.uid==='newuid1'),false);
});
test('decode accepts empty values and both TinyWebDB value envelopes, but never overwrites corrupt data',()=>{
  assert.deepEqual(decodeValue({VALUE:''}),[]);assert.deepEqual(decodeValue(['VALUE','tag','[]']),[]);
  for(const value of [{}, {VALUE:'garbage'}, {VALUE:'{}'}])assert.throws(()=>decodeValue(value));
  assert.deepEqual(decodeValue({zju_tiaoyitiao_leaderboard_v1:'null'}),[]);
  assert.deepEqual(decodeValue({custom_tag:[record('myuid123')]},'custom_tag'),[record('myuid123')]);
});
test('random IDs match the fixed lowercase format',()=>{
  const ids=Array.from({length:200},generateUid);assert.equal(new Set(ids).size,200);
  assert.ok(ids.every(uid=>/^[a-z0-9]{8}$/.test(uid)));
});
test('first identity is checked against every returned ID, persisted, and reused',async()=>{
  const candidates=['occupied','second12'];
  const h=harness([record('occupied')],{generateUid:()=>candidates.shift()});
  assert.equal((await h.client.load()).uid,'second12');assert.equal(h.memory.get(STORAGE_KEYS.uid),'second12');
  const reloaded=createClient({...h.options,generateUid:()=>{throw Error('must not regenerate');}});
  assert.equal((await reloaded.load()).uid,'second12');
});
test('failed initial lookup never persists an unchecked ID and can recover later',async()=>{
  const h=harness([],{read:({reads})=>{if(reads<=2)throw Error('offline');}});
  await assert.rejects(h.client.load(),/无法连接/);assert.equal(h.memory.has(STORAGE_KEYS.uid),false);
  assert.equal((await h.client.load()).uid,'myuid123');
});
test('submission re-reads the board, preserves other players, verifies, and persists nickname',async()=>{
  const h=harness([record('other01',15)]);
  await h.client.load();const result=await h.client.submit('小王',25);
  assert.equal(result.status,'saved');assert.equal(result.records.length,2);
  assert.equal(result.records[0].nickname,'小王');assert.equal(h.client.lastNickname(),'小王');
  assert.deepEqual(h.counts(),{reads:3,writes:1});
});
test('same player cannot overwrite a better or equal score, nickname, or tie timestamp',async()=>{
  const original=record('myuid123',50,100,'旧名'),h=harness([original],{saved:{[STORAGE_KEYS.uid]:'myuid123'}});
  const result=await h.client.submit('新名',50);assert.equal(result.status,'unchanged');
  assert.deepEqual(h.board(),[original]);assert.equal(h.counts().writes,0);
  h.advance(3000);await h.client.submit('新名',51);assert.equal(h.board().length,1);assert.equal(h.board()[0].nickname,'新名');
});
test('a concurrent overwrite triggers exactly one fresh merge and preserves the concurrent winner',async()=>{
  const h=harness([],{write:({writes,setBoard})=>{if(writes===1)setBoard([record('racer001',40)]);}});
  const result=await h.client.submit('玩家',30);assert.equal(result.status,'saved');assert.equal(h.counts().writes,2);
  assert.deepEqual(result.records.map(r=>r.uid),['racer001','myuid123']);
});
test('a second concurrent overwrite reports failure without looping indefinitely',async()=>{
  const h=harness([],{write:({setBoard})=>setBoard([])});
  await assert.rejects(h.client.submit('玩家',30),/同时提交覆盖/);assert.equal(h.counts().writes,2);
});
test('network failures retry once and keep a single achievement timestamp',async()=>{
  const h=harness([],{write:({writes})=>{if(writes===1)throw Error('response lost');}});
  const result=await h.client.submit('玩家',30);assert.equal(result.status,'unchanged');assert.equal(h.board()[0].createdAt,10000);
  assert.equal(h.counts().writes,1);
});
test('falling outside top 100 is a valid result rather than endless conflict retries',async()=>{
  const h=harness(Array.from({length:100},(_,i)=>record('u'+String(i).padStart(7,'0'),200-i,i+1)));
  assert.equal((await h.client.submit('玩家',1)).status,'outside-top');assert.equal(h.counts().writes,1);
});
test('cooldown survives reload and concurrent same-client submissions are rejected',async()=>{
  const h=harness();const pending=h.client.submit('玩家',30);
  await assert.rejects(h.client.submit('玩家',40),/正在提交/);await pending;
  const reloaded=createClient(h.options);await assert.rejects(reloaded.submit('玩家',40),/至少 3 秒/);
  h.advance(3000);assert.equal((await reloaded.submit('玩家',40)).status,'saved');
});

test('failed network submissions still reserve the existing player cooldown',async()=>{
  const h=harness([],{saved:{[STORAGE_KEYS.uid]:'myuid123'},read:()=>{throw Error('offline');}});
  await assert.rejects(h.client.submit('玩家',30),error=>error.code==='NETWORK');
  assert.deepEqual(h.counts(),{reads:2,writes:0});
  await assert.rejects(createClient(h.options).submit('玩家',30),error=>error.code==='COOLDOWN');
  assert.equal(h.counts().reads,2);
  h.advance(3000);
  await assert.rejects(h.client.submit('玩家',30),error=>error.code==='NETWORK');
  assert.equal(h.counts().reads,4);
});
test('HTTP errors retry once, while corrupt cloud data and unavailable storage prevent all writes',async()=>{
  let attempts=0;const client=createClient({fetch:async()=>{attempts++;return new Response('',{status:500});},storage:null,pause:async()=>{}});
  await assert.rejects(client.load(),/HTTP 500/);assert.equal(attempts,2);
  const bad=createClient({fetch:async()=>new Response('{"VALUE":"not json"}'),storage:null});
  await assert.rejects(bad.submit('玩家',1),/无法保存玩家身份/);
  const h=harness();h.options.fetch=async()=>new Response('{"VALUE":"not json"}');
  await assert.rejects(createClient(h.options).submit('玩家',1),/无法解析/);assert.equal(h.counts().writes,0);
});
