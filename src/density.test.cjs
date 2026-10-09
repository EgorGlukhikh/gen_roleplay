const test=require('node:test'),assert=require('node:assert/strict');
const {stories,components}=require('./library.json'),factory=require('./engine.cjs'),engine=factory(stories,components);
test('every available relationship/sphere has six new distinct events, including school',()=>{
 let cells=0;
 for(const realm of ['world','school'])for(const {value:relation} of engine.availableRelations(realm)){
  for(const sphere of engine.availableSpheres({realm,relation}).filter(s=>s!=='auto')){
   const pool=stories.filter(s=>s.realm===realm&&[s.relation].flat().includes(relation)&&(sphere==='ordinary'?s.normal:s.sphere===sphere));
   assert.ok(new Set(pool.map(s=>s.title)).size>=6,`${realm}/${relation}/${sphere}`);
   if(sphere==='ordinary')continue;cells++;
   const added=pool.filter(s=>s.source==='authored-v4');assert.equal(added.length,6);
   assert.equal(new Set(added.map(s=>s.title)).size,6);
   assert.equal(new Set(added.map(s=>s.mechanism)).size,6);
   for(const s of added){assert.ok(!s.continuation&&!s.variants);assert.doesNotMatch(s.scene,/undefined|\{(?![ab]\})/);}
  }
 }
 assert.equal(cells,128);
});
test('six consecutive generations use six distinct premises in every selectable case',()=>{
 for(const realm of ['world','school'])for(const {value:relation} of engine.availableRelations(realm)){
  for(const sphere of engine.availableSpheres({realm,relation}))for(const random of [()=>0,()=>.999,Math.random]){
   const session=engine.createSession({random}),ids=new Set();
   for(let i=0;i<6;i++){const r=session.generate({names:['Arthur Weasley','Molly Weasley'],realm,relation,sphere});ids.add(r.story.id);}
   assert.equal(ids.size,6,`${realm}/${relation}/${sphere}`);
  }
 }
});
test('rare mechanism cannot force a repeat before unused premises',()=>{
 const seed=stories.find(s=>s.realm==='world'&&s.relation==='family');
 const pool=Array.from({length:6},(_,i)=>({...seed,id:'density-'+i,mechanism:i?'chance':'error'}));
 const session=factory(pool,components).createSession({random:()=>0});
 const ids=Array.from({length:6},()=>session.generate({names:['A','B'],realm:'world',relation:'family'}).story.id);
 assert.equal(new Set(ids).size,6);
});
