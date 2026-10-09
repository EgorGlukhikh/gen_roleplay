const test=require('node:test'),assert=require('node:assert/strict');
const data=require('./library.json'),factory=require('./engine.cjs');
test('only explicitly reviewed story groups receive additional developments',()=>{
 const e=factory(data.stories,data.components);
 for(const s of data.stories){
  const choices=e.compatibleComplications(s,s.normal);
  if(s.continuation){assert.equal(choices.length,3,s.id);assert.ok(choices.every(c=>c.group===s.continuation));}
  else assert.deepEqual(choices,[{id:'none',max:0,text:''}],s.id);
 }
 assert.ok(Object.values(data.components.relationIntros).flat().every(x=>x===''));
});
test('specific formats change the premise and survive history reload without immediate repeats',()=>{
 for(const base of data.stories.filter(s=>s.variants)){
  const e=factory([base],data.components);let saved;const storage={getItem:()=>saved,setItem:(_,s)=>saved=s};
  const titles=new Set();let previous;let seed=71;
  const random=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);
  for(let i=0;i<18;i++){
   const r=e.createSession({random,storage}).generate({names:['Arthur Weasley','Molly Weasley'],realm:base.realm,relation:Array.isArray(base.relation)?base.relation[0]:base.relation,sphere:base.sphere});
   assert.notEqual(r.story.scene,previous);previous=r.story.scene;titles.add(previous);
   assert.ok(e.render(r).includes(r.story.title));
  }
  assert.equal(titles.size,3);
 }
});
