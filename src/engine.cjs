function createBookEngine(stories, components) {
  'use strict';
  const relations = [
    {value:'strangers',label:'Незнакомцы'}, {value:'acquaintances',label:'Знакомые'},
    {value:'friends',label:'Друзья'}, {value:'bestfriends',label:'Лучшие друзья'},
    {value:'rivals',label:'Соперники'}, {value:'enemies',label:'Враги'},
    {value:'couple',label:'Романтическая пара'}, {value:'lovers',label:'Любовники · страсть и близость',adult:true},
    {value:'spouses',label:'Супруги',adult:true}, {value:'exes',label:'Бывшие партнёры',adult:true},
    {value:'family',label:'Родственники'}, {value:'siblings',label:'Братья / сёстры'},
    {value:'parentchild',label:'Родитель → взрослый ребёнок',adult:true},
    {value:'colleagues',label:'Коллеги'}, {value:'partners',label:'Напарники'}
  ];
  const mechanisms = components.mechanisms.map(([value,label])=>({value,label}));
  const spheres = components.spheres.map(([value,label])=>({value,label}));
  const tones = components.tones.map(([value,label])=>({value,label}));
  const storageKey = 'taynaya-kniga-history-v2';
  const fail = (message, field) => { const e = new Error(message); e.field = field; throw e; };
  function cleanName(raw, field) {
    const value = raw.trim().replace(/^@+\s*/, '').replace(/[ \t]+/g, ' ');
    if (!value) fail(field === 'self' ? 'Впиши свой форумный ник.' : 'Впиши ник соигрока.', field);
    if (value.length > 64) fail('Ник должен быть не длиннее 64 символов.', field);
    if (!/^[A-Za-z][A-Za-z0-9 ._'’\-]*$/.test(value)) {
      fail('Используй английские буквы. Пробелы, цифры, точки, дефисы, апострофы и подчёркивания тоже подходят.', field);
    }
    return value;
  }
  function parseNames(self, partners) {
    const owner = cleanName(self, 'self');
    const parts = partners.split(',').filter(part => part.trim());
    if (!parts.length) fail('Впиши хотя бы одного соигрока.', 'partners');
    const seen = new Set([owner.toLowerCase()]);
    const names = [owner];
    for (const part of parts) {
      const name = cleanName(part, 'partners');
      if (!seen.has(name.toLowerCase())) { seen.add(name.toLowerCase()); names.push(name); }
    }
    if (names.length < 2) fail('Для истории нужны двое: укажи ник, отличный от своего.', 'partners');
    return names;
  }
  const hasRelation = (story, relation) => story.relation === relation || Array.isArray(story.relation) && story.relation.includes(relation);
  const availableRelations = realm => relations.filter(r=>realm!=='school'||!r.adult);
  function pairKey(names) {
    return JSON.stringify([...new Set(names.map(name=>name.trim().replace(/^@+\s*/,'').replace(/[ \t]+/g,' ').toLowerCase()))].sort());
  }
  function eligible({realm,relation,sphere='auto'}) {
    if(!availableRelations(realm).some(r=>r.value===relation))return [];
    return stories.filter(s=>s.realm===realm && hasRelation(s,relation) && (sphere==='auto' || sphere==='ordinary' ? sphere==='auto' || s.normal : s.sphere===sphere));
  }
  function availableSpheres({realm,relation}) {
    const pool=eligible({realm,relation});
    return ['auto',...(pool.some(s=>s.normal)?['ordinary']:[]),...spheres.map(s=>s.value).filter(sphere=>pool.some(s=>s.sphere===sphere))];
  }
  function compatibleComplications(story, ordinary=false) {
    const matches=story.continuation?components.complications.filter(c=>c.group===story.continuation && c.max<=story.scale && (!ordinary || c.max===0)):[];
    return matches.length?matches:[{id:'none',max:0,text:''}];
  }
  function createSession(options = {}) {
    if (typeof options === 'function') options={random:options};
    const random=options.random || Math.random, storage=options.storage;
    let persistent=!!storage, pairs=new Map();
    const pick=items=>items[Math.min(items.length-1,Math.max(0,Math.floor(random()*items.length)))];
    function load() {
      if(!persistent) return;
      try {
        const raw=storage.getItem(storageKey);
        if(!raw)return;
        if(raw.length>1500000)throw new Error('History too large');
        const saved=JSON.parse(raw);
        if(saved.version!==2||!Array.isArray(saved.pairs))return;
        const clean=new Map();
        for(const entry of saved.pairs.slice(-100)) {
          if(!Array.isArray(entry)||typeof entry[0]!=='string'||entry[0].length>2048||!Array.isArray(entry[1]))continue;
          const events=entry[1].slice(-60).filter(e=>e&&typeof e.id==='string'&&e.id.length<160&&mechanisms.some(m=>m.value===e.mechanism)&&tones.some(t=>t.value===e.tone)&&[0,1,2].includes(e.scale)&&typeof e.complication==='string'&&e.complication.length<160).map(e=>({id:e.id,mechanism:e.mechanism,tone:e.tone,scale:e.scale,complication:e.complication,variant:Number.isInteger(e.variant)?e.variant:0}));
          clean.set(entry[0],events);
        }
        pairs=clean;
      } catch (_) { /* Keep in-memory history if persisted data is unreadable. */ }
    }
    function save() {
      while(pairs.size>100)pairs.delete(pairs.keys().next().value);
      if(!persistent)return;
      try{storage.setItem(storageKey,JSON.stringify({version:2,pairs:[...pairs]}));}
      catch(_){persistent=false;}
    }
    function olderOptions(items,field,history) {
      const recent=history.slice().reverse();
      const ages=items.map(item=>{const i=recent.findIndex(e=>e[field]===item);return i<0?Infinity:i;});
      const oldest=Math.max(...ages);
      return items.filter((_,i)=>ages[i]===oldest);
    }
    load();
    function generate({names,realm,relation,sphere='auto'}) {
      if(!['school','world'].includes(realm)||!relations.some(r=>r.value===relation)||!['auto','ordinary',...spheres.map(s=>s.value)].includes(sphere))throw new Error('Выбери главу, отношения и сферу из списка.');
      if(!Array.isArray(names)||names.length<2||names.some(n=>typeof n!=='string'))throw new Error('Для истории нужны двое.');
      const eligiblePool=eligible({realm,relation,sphere});
      if(!eligiblePool.length)throw new Error('Для этой главы выбери другую сферу истории.');
      load();
      const key=pairKey(names),history=pairs.get(key)||[];
      // Unseen premises take priority over mechanism rotation. Otherwise a rare
      // mechanism can repeatedly bring back its only story despite unused choices.
      const recentIds=history.slice(-30).map(e=>e.id);
      const unseen=eligiblePool.filter(s=>!recentIds.includes(s.id));
      const oldestIds=unseen.length?[]:olderOptions(eligiblePool.map(s=>s.id),'id',history);
      const pool=unseen.length?unseen:eligiblePool.filter(s=>oldestIds.includes(s.id));
      let cooldown=5,mechanismPool=[];
      for(;cooldown>=0;cooldown--) {
        const recent=cooldown?history.slice(-cooldown).map(e=>e.mechanism):[];
        mechanismPool=pool.filter(s=>!recent.includes(s.mechanism));
        if(mechanismPool.length)break;
      }
      const mechanism=pick([...new Set(mechanismPool.map(s=>s.mechanism))]);
      let candidates=mechanismPool.filter(s=>s.mechanism===mechanism);
      const fresh=candidates.filter(s=>!recentIds.includes(s.id));
      if(fresh.length)candidates=fresh;
      else {const ids=olderOptions(candidates.map(s=>s.id),'id',history);candidates=candidates.filter(s=>ids.includes(s.id));}
      // Sample genres as genres, so a large adventure catalogue cannot drown out quiet stories.
      let genreChoices=[...new Set(candidates.map(s=>s.tone))];
      const previous=history[history.length-1];
      if(genreChoices.length>1&&previous)genreChoices=genreChoices.filter(t=>t!==previous.tone);
      const counts=genreChoices.map(t=>history.slice(-30).filter(e=>e.tone===t).length);
      const minimum=Math.min(...counts);
      const tone=pick(genreChoices.filter((_,i)=>counts[i]===minimum));
      candidates=candidates.filter(s=>s.tone===tone);
      const selectedSphere=sphere==='auto'||sphere==='ordinary'?pick([...new Set(candidates.map(s=>s.sphere))]):sphere;
      candidates=candidates.filter(s=>s.sphere===selectedSphere);
      if(previous&&candidates.some(s=>s.scale!==previous.scale))candidates=candidates.filter(s=>s.scale!==previous.scale);
      const baseStory=pick(candidates);
      const previousVariant=history.filter(e=>e.id===baseStory.id).slice(-1)[0]?.variant;
      const variant=baseStory.variants?pick(baseStory.variants.map((_,i)=>i).filter(i=>baseStory.variants.length===1||i!==previousVariant)):0;
      const story=baseStory.variants?{...baseStory,...baseStory.variants[variant]}:baseStory;
      const complications=compatibleComplications(story,sphere==='ordinary');
      if(!complications.length)throw new Error('Для этой истории не найдено подходящее продолжение.');
      const complicationIds=olderOptions(complications.map(c=>c.id),'complication',history);
      const complication=pick(complications.filter(c=>complicationIds.includes(c.id)));
      const [a,b]=relation==='parentchild'||random()<.5?names:[names[1],names[0]];
      const connection='';
      const result={story,names:names.slice(),a,b,realm,relation,sphere:selectedSphere,mechanism,tone,scale:story.scale,complication,connection,cooldownApplied:cooldown};
      pairs.delete(key);
      pairs.set(key,[...history,{id:story.id,mechanism,tone,scale:story.scale,complication:complication.id,variant}].slice(-60));
      save();
      return result;
    }
    return {generate,historyFor:names=>(pairs.get(pairKey(names))||[]).map(e=>({...e})),get persistent(){return persistent;}};
  }
  function escape(value) {
    return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  function renderCard(result) {
    const {story, names, a, b} = result;
    const mention = name => '<strong style="font-weight:600;color:#5b324e;">@' + escape(name) + '</strong>';
    const fill = value => escape(value).replace(/\{([ab])\}/g,(_,role)=>mention(role === 'a' ? a : b));
    const paragraphStyle = 'margin:0 0 16px;font:16px/1.75 Georgia,serif;color:#342330;overflow-wrap:anywhere;text-align:left;';
    const extra = names.length > 2 ? '<p style="' + paragraphStyle + '">Также в эпизоде: ' + names.slice(2).map(mention).join(', ') + '. Подходящий момент для появления выбираете вы: за помощью, с советом или просто по своим делам.</p>' : '';
    const relationLabel=relations.find(r=>r.value===result.relation).label;
    const sphereLabel=spheres.find(s=>s.value===result.sphere).label;
    const connection=result.connection?'<p style="'+paragraphStyle+'">'+fill(result.connection)+'</p>':'';
    const hook=story.hook?'<p style="'+paragraphStyle+'">'+fill(story.hook.replace(/Нужно/g,'Можно').replace(/нужно/g,'можно').replace(/Придётся/g,'Можно').replace(/придётся/g,'можно'))+'</p>':'';
    return '' +
      '<div style="box-sizing:border-box;max-width:760px;margin:16px auto;padding:8px;background:#3b2037;border:1px solid #866044;border-radius:7px;color-scheme:light;">' +
      '<div style="box-sizing:border-box;background:#d7cbb5;border:1px solid #b59c79;padding:clamp(22px,5vw,42px);border-radius:3px;">' +
      '<p style="margin:0 0 22px;text-align:center;font:italic 16px/1.6 Georgia,serif;color:#674d58;">Тайная книга предлагает тебе погрузиться в историю…</p>' +
      '<div aria-hidden="true" style="text-align:center;margin:0 0 14px;height:88px;"><img alt="" src="https://egorglukhikh.github.io/gen_roleplay/assets/relations/'+escape(result.relation)+'.png" style="display:block;width:144px;height:88px;object-fit:contain;margin:0 auto;" /></div>' +
      '<h2 style="margin:0 0 18px;text-align:center;font:normal clamp(25px,5vw,34px)/1.2 Georgia,serif;color:#48263f;overflow-wrap:anywhere;">' + escape(story.title) + '</h2>' +
      '<p style="margin:0 0 24px;text-align:center;font:14px/1.7 Georgia,serif;overflow-wrap:anywhere;">' + names.map(mention).join(' &nbsp;·&nbsp; ') + '</p>' +
      '<p style="margin:0 0 14px;font:italic 14px/1.5 Georgia,serif;color:#725346;">' + escape(story.place || relationLabel+' · '+sphereLabel) + '</p>' + connection +
      '<p style="' + paragraphStyle + '">' + fill(story.scene) + '</p>' +
      hook + (result.complication.text?'<p style="'+paragraphStyle+'">'+fill(result.complication.text)+'</p>':'') + extra +
      '<p style="margin:24px 0 0;padding-top:15px;border-top:1px solid #b5a183;text-align:center;font:italic 13px/1.6 Georgia,serif;color:#725346;">Дальше — ваша история.</p>' +
      '</div></div>';
  }
  function render(result){return '['+'html]\n'+renderCard(result)+'\n['+'/html]';}
  return {relations,availableRelations,mechanisms,spheres,tones,parseNames,pairKey,availableSpheres,compatibleComplications,createSession,renderCard,render};
}
if (typeof module !== 'undefined' && module.exports) module.exports = createBookEngine;
