const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {stories,components}=require('./library.json'),factory=require('./engine.cjs'),engine=factory(stories,components);
test('all 536 stories are reviewed and have explicit relationships; 180 additions have three scene versions',()=>{
 assert.equal(stories.length,536);assert.equal(new Set(stories.map(s=>s.id)).size,stories.length);
 const additions=stories.filter(s=>s.source==='authored-v3');assert.equal(additions.length,180);
 assert.equal(additions.filter(s=>s.realm==='school').length,60);
 for(const s of stories){
  assert.notEqual(s.relation,'*',s.id);assert.equal(s.review.version,3,s.id);
  for(const r of [s.relation].flat())assert.ok(engine.availableRelations(s.realm).some(v=>v.value===r),s.id+': '+r);
  for(const key of ['sphere','mechanism','tone'])assert.ok(engine[key==='sphere'?'spheres':key==='tone'?'tones':'mechanisms'].some(v=>v.value===s[key]),s.id+': '+key);
  assert.ok(s.scene.includes('{a}')&&s.scene.includes('{b}'),s.id);
  if(s.source==='authored-v3'){assert.equal(s.variants.length,3);assert.equal(new Set(s.variants.map(v=>v.scene)).size,3);assert.ok(!s.continuation);}
 }
});
test('enemies always carry a concrete dispute; reported fireplace case is tied to the accusation',()=>{
 const enemy=stories.filter(s=>[s.relation].flat().includes('enemies'));
 for(const s of enemy)assert.match(s.scene,/обвин|вражд|ссор|требует|показани|ущерб|спор|огласк|унизительной надписи/i,s.id);
 const fireplace=stories.find(s=>s.id==='univ-work-11');assert.equal(fireplace.relation,'enemies');assert.match(fireplace.scene,/ложного донесения/);
 assert.equal(engine.compatibleComplications(fireplace)[0].text,'');
 for(const relation of ['enemies','rivals','lovers','spouses','exes','siblings','parentchild']){
  const pool=stories.filter(s=>s.realm==='world'&&[s.relation].flat().includes(relation));assert.ok(pool.length>=15,relation);
 }
});
test('school excludes adult intimate and adult parent-child categories; parent role stays with first name',()=>{
 for(const relation of ['lovers','spouses','exes','parentchild']){
  assert.ok(!engine.availableRelations('school').some(r=>r.value===relation));
  assert.throws(()=>engine.createSession().generate({names:['Parent','Child'],realm:'school',relation}));
 }
 for(const relation of engine.availableRelations('school'))assert.ok(engine.availableSpheres({realm:'school',relation:relation.value}).length>1,relation.value);
 const session=engine.createSession({random:()=>.99});
 const r=session.generate({names:['Parent','Child'],realm:'world',relation:'parentchild'});
 assert.equal(r.a,'Parent');assert.equal(r.b,'Child');
});
test('every relation has a shipped decorative icon and copied HTML uses absolute hosted image',()=>{
 for(const relation of engine.relations){
  assert.ok(fs.existsSync(path.join(__dirname,'../docs/assets/relations',relation.value+'.png')),relation.value);
  const r=engine.createSession().generate({names:['Arthur Weasley','Molly Weasley'],realm:'world',relation:relation.value});
  const html=engine.render(r);assert.ok(html.includes('https://egorglukhikh.github.io/gen_roleplay/assets/relations/'+relation.value+'.png'));
  assert.ok(html.startsWith('[html]'));assert.ok(html.endsWith('[/html]'));
 }
});
