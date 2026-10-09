const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const read=name=>fs.readFileSync(path.join(root,'src',name),'utf8');
const library=JSON.parse(read('library.json'));
let page=read('page.html');
page=page.replace(/const bytes =[^]*?const stories = library.stories;/,()=>
 'const library='+JSON.stringify(library).replace(/</g,'\\u003c')+';\nconst stories=library.stories;');
page=page.replace('@@ENGINE@@',()=>read('engine.cjs')).replace('@@UI@@',()=>read('ui.js'));
if(/@@(?:LIBRARY|ENGINE|UI)@@/.test(page))throw Error('Unresolved template');
new vm.Script(page.match(/<script>([\s\S]*?)<\/script>/)[1]);
fs.mkdirSync(path.join(root,'docs'),{recursive:true});
fs.writeFileSync(path.join(root,'docs/index.html'),page);
fs.writeFileSync(path.join(root,'docs/.nojekyll'),'');
console.log(`Built ${library.stories.length} stories for GitHub Pages (${Buffer.byteLength(page)} bytes).`);
