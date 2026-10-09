const engine = createBookEngine(stories, library.components);
let storage = null;
try { storage = window.localStorage; } catch (_) {}
const session = engine.createSession({storage});
const find = selector => root.querySelector(selector);
const form = find('.tk-form');
const modal = find('.tk-modal');
const copyButton = find('.tk-copy');
const copyStatus = find('.tk-copy-status');
const downloadButton = find('.tk-download');
const reopen = find('.tk-reopen');
const error = find('.tk-error');
const unique = 'tk-' + Math.random().toString(36).slice(2,10);
const title = find('.tk-preview-heading');
const preview = find('.tk-preview');
const regenerate = find('.tk-regenerate');
title.id = unique + '-title';
error.id = unique + '-error';
modal.setAttribute('aria-labelledby',title.id);
for (const name of ['self','partners']) {
  const help = find('[data-' + name + '-help]');
  const label = form.elements[name].closest('label').querySelector('.tk-label');
  label.id = unique + '-' + name + '-label';
  help.id = unique + '-' + name + '-help';
  form.elements[name].setAttribute('aria-labelledby', label.id);
  form.elements[name].setAttribute('aria-describedby', help.id);
}
form.elements.relation.replaceChildren(...engine.relations.map(relation => {
  const option = document.createElement('option');
  option.value = relation.value;
  option.textContent = relation.label;
  option.selected = relation.value === 'friends';
  return option;
}));
let currentPayload = '';
let currentSettings = null;
let lastFocus = null;
let frameVisibleRect = null;
let positionPending = false;
function updateSpheres() {
  const selected = form.elements.sphere.value;
  const available = engine.availableSpheres({realm:form.elements.realm.value,relation:form.elements.relation.value});
  const choices = [{value:'auto',label:'На усмотрение книги'},{value:'ordinary',label:'Совершенно обычный день'},...engine.spheres];
  form.elements.sphere.replaceChildren(...choices.filter(choice=>available.includes(choice.value)).map(choice=>{
    const option = document.createElement('option');
    option.value = choice.value;
    option.textContent = choice.label;
    return option;
  }));
  form.elements.sphere.value = available.includes(selected) ? selected : 'auto';
}
form.elements.realm.addEventListener('change',updateSpheres);
form.elements.relation.addEventListener('change',updateSpheres);
updateSpheres();
find('.tk-main-button').disabled = false;

// In a forum the HTML document can be much taller than the visible iframe area.
function visibleViewport() {
  const vv = window.visualViewport;
  let rect = {left:vv ? vv.offsetLeft : 0, top:vv ? vv.offsetTop : 0, width:vv ? vv.width : window.innerWidth, height:vv ? vv.height : window.innerHeight};
  try {
    const frame = window.frameElement;
    if (frame) {
      const bounds = frame.getBoundingClientRect();
      const pv = window.parent.visualViewport;
      const pl = pv ? pv.offsetLeft : 0, pt = pv ? pv.offsetTop : 0;
      const pw = pv ? pv.width : window.parent.innerWidth, ph = pv ? pv.height : window.parent.innerHeight;
      const sx = bounds.width / (frame.offsetWidth || bounds.width || 1);
      const sy = bounds.height / (frame.offsetHeight || bounds.height || 1);
      const contentLeft = bounds.left + frame.clientLeft * sx;
      const contentTop = bounds.top + frame.clientTop * sy;
      const left = Math.max(rect.left,(pl-contentLeft)/sx), top = Math.max(rect.top,(pt-contentTop)/sy);
      const right = Math.min(rect.left+rect.width,(pl+pw-contentLeft)/sx);
      const bottom = Math.min(rect.top+rect.height,(pt+ph-contentTop)/sy);
      if (right > left && bottom > top) rect = {left,top,width:right-left,height:bottom-top};
    } else if (window !== window.top && frameVisibleRect) rect = frameVisibleRect;
  } catch (_) { if (frameVisibleRect) rect = frameVisibleRect; }
  return rect;
}
function positionModal() {
  positionPending = false;
  if (!modal.open) return;
  const rect = visibleViewport();
  for (const name of ['left','top','width','height']) modal.style.setProperty(name,rect[name]+'px','important');
  modal.classList.toggle('tk-short',rect.height < 520);
}
function schedulePosition() {
  if (!positionPending) {positionPending = true; requestAnimationFrame(positionModal);}
}
window.addEventListener('resize',schedulePosition);
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize',schedulePosition);
  window.visualViewport.addEventListener('scroll',schedulePosition);
}
try {
  if (window !== window.top) {
    window.parent.addEventListener('scroll',schedulePosition,{passive:true});
    window.parent.addEventListener('resize',schedulePosition);
    if(window.parent.visualViewport) {
      window.parent.visualViewport.addEventListener('resize',schedulePosition);
      window.parent.visualViewport.addEventListener('scroll',schedulePosition);
    }
  }
} catch (_) { /* Cross-origin frames use IntersectionObserver below. */ }
if (window !== window.top && 'IntersectionObserver' in window) {
  const probe = document.createElement('div');
  probe.setAttribute('aria-hidden','true');
  probe.style.cssText='position:fixed;inset:0;opacity:0;pointer-events:none;z-index:-1;';
  document.body.append(probe);
  const observer = new IntersectionObserver(entries => {
    const r = entries[0].intersectionRect;
    if(r.width > 0 && r.height > 0) {
      frameVisibleRect = {left:r.left,top:r.top,width:r.width,height:r.height};
      schedulePosition();
    }
  },{threshold:Array.from({length:101},(_,i)=>i/100)});
  observer.observe(probe);
}
function openPage() {
  if (!currentPayload) return;
  if (!modal.open) { lastFocus = document.activeElement; modal.showModal(); }
  positionModal();
  title.focus({preventScroll:true});
  schedulePosition();
}
function chooseEpisode(settings) {
  const episode = session.generate(settings);
  currentSettings = settings;
  currentPayload = engine.render(episode);
  preview.innerHTML = engine.renderCard(episode);
  preview.scrollTop = 0;
  copyStatus.textContent = '';
  downloadButton.hidden = true;
  reopen.hidden = false;
}
form.addEventListener('submit',event => {
  event.preventDefault();
  error.hidden = true;
  for (const field of ['self','partners']) {
    form.elements[field].removeAttribute('aria-invalid');
    form.elements[field].setAttribute('aria-describedby',unique+'-'+field+'-help');
  }
  try {
    const names = engine.parseNames(form.elements.self.value, form.elements.partners.value);
    chooseEpisode({names,relation:form.elements.relation.value,realm:form.elements.realm.value,sphere:form.elements.sphere.value});
    form.elements.self.value = names[0];
    form.elements.partners.value = names.slice(1).join(', ');
    openPage();
  } catch (failure) {
    error.textContent = failure.message || 'Не удалось выбрать страницу. Попробуй ещё раз.';
    error.hidden = false;
    const input = failure.field && form.elements[failure.field];
    if (input) {
      input.setAttribute('aria-invalid','true');
      input.setAttribute('aria-describedby',unique+'-'+failure.field+'-help '+error.id);
      input.focus();
    }
  }
});
regenerate.addEventListener('click',()=>{
  if (!currentSettings || copyButton.disabled) return;
  try { chooseEpisode(currentSettings); copyStatus.textContent = 'Новая идея: ' + preview.querySelector('h2').textContent; }
  catch (failure) { copyStatus.textContent = failure.message || 'Не удалось сменить идею. Попробуй ещё раз.'; }
  schedulePosition();
});
reopen.addEventListener('click',openPage);
find('.tk-close').addEventListener('click',()=>modal.close());
modal.addEventListener('click',event=>{if(event.target === modal) modal.close();});
modal.addEventListener('close',()=>{if(lastFocus && lastFocus.isConnected) lastFocus.focus({preventScroll:true});});

function legacyCopy(value) {
  const buffer = document.createElement('textarea');
  buffer.className = 'tk-clipboard-buffer';
  buffer.setAttribute('aria-hidden','true');
  buffer.setAttribute('tabindex','-1');
  buffer.readOnly = true;
  buffer.value = value;
  modal.append(buffer);
  let ok = false;
  try { buffer.focus({preventScroll:true}); buffer.select(); buffer.setSelectionRange(0,value.length); ok = document.execCommand('copy'); }
  catch (_) { ok = false; }
  finally { buffer.remove(); }
  if (!ok) throw new Error('Clipboard unavailable');
}
async function writeClipboard(value) {
  // Forum frames may leave the asynchronous clipboard permission pending.
  if(window.self!==window.top){try{legacyCopy(value);return;}catch(_){}}
  if (window.isSecureContext && navigator.clipboard && navigator.clipboard.writeText) {
    try { await navigator.clipboard.writeText(value); return; }
    catch (_) { /* Older forums may deny the async API while allowing copy. */ }
  }
  legacyCopy(value);
}
copyButton.addEventListener('click',async () => {
  if (!currentPayload || copyButton.disabled) return;
  const payload = currentPayload;
  copyButton.disabled = true;
  regenerate.disabled = true;
  copyStatus.textContent = 'Переносим страницу…';
  try {
    await writeClipboard(payload);
    copyStatus.textContent = 'Скопировано. Вставь в сообщение на форуме — оформление уже внутри.';
    downloadButton.hidden = true;
  } catch (_) {
    copyStatus.textContent = 'Браузер не разрешил копирование. Можно скачать текст или открыть генератор отдельной страницей.';
    downloadButton.hidden = false;
  } finally {
    copyButton.disabled = false;
    regenerate.disabled = false;
    if (modal.open) copyButton.focus({preventScroll:true});
    schedulePosition();
  }
});
downloadButton.addEventListener('click',()=>{
  if (!currentPayload) return;
  const url = URL.createObjectURL(new Blob([currentPayload],{type:'text/plain;charset=utf-8'}));
  const link = document.createElement('a');
  link.href = url; link.download = 'taynaya-kniga-episode.txt';
  modal.append(link); link.click(); link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),30000);
});
