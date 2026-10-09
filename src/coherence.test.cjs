const test=require('node:test'),assert=require('node:assert/strict');
const {stories,components}=require('./library.json');
const factory=require('./engine.cjs'),engine=factory(stories,components);
test('duel tournament never imports unrelated leisure incidents',()=>{
 const story=stories.find(s=>s.title==='Поединки за закрытой дверью');
 const session=factory([story],components).createSession();
 const endings=new Set();
 for(let i=0;i<30;i++){
  const r=session.generate({names:['Arthur Weasley','Molly Weasley'],realm:'world',relation:'family',sphere:story.sphere});
  endings.add(r.complication.id);
  assert.equal(r.complication.group,'duel');
  assert.doesNotMatch(engine.render(r),/бесплатных вещей|открытк|фотографировать|маггловской вещи/);
 }
 assert.equal(endings.size,3);
});
test('every complete scene and explicit variant renders only its reviewed continuations',()=>{
 assert.equal(stories.length,356);
 for(const base of stories)for(const s of base.variants?base.variants.map(v=>({...base,...v})):[base]){
  for(const complication of engine.compatibleComplications(s)){
   const r={story:s,names:['Arthur Weasley','Molly Weasley'],a:'Arthur Weasley',b:'Molly Weasley',relation:'family',sphere:s.sphere,complication};
   const card=engine.renderCard(r);
   assert.doesNotMatch(card,/<p[^>]*>\s*<\/p>|undefined|\{[ab]\}/);
   if(!s.continuation)assert.equal(complication.text,'');
   else assert.equal(complication.group,s.continuation);
  }
 }
});
test('new recipe variants do not inherit the original cooking ending',()=>{
 const s=stories.find(s=>s.id==='school-family-3');
 for(const v of s.variants.slice(1))assert.equal(v.hook,'');
});
test('unknown scenarios fail closed instead of guessing from sphere or tags',()=>{
 assert.deepEqual(engine.compatibleComplications({sphere:'leisure',tags:['shopping'],scale:2}),[{id:'none',max:0,text:''}]);
 assert.deepEqual(engine.compatibleComplications({continuation:'unknown',scale:2}),[{id:'none',max:0,text:''}]);
});
