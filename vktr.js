/* ВЕКТОР 4.1 — вложения (несколько фото и файлов, ZIP, документы) и новая раскладка экрана.
   Подключается последним, после app.js, ext.js и study2.js. */
(function(){
const VER='4.1',CTX_MAX=50000,ZIP_BUDGET=70000,TOTAL_CTX=80000,MAX_ITEMS=12,MAX_IMGS=8;
const TEXT_RX=/\.(txt|md|markdown|rst|json|jsonc|csv|tsv|xml|html?|css|scss|sass|less|js|mjs|cjs|jsx|ts|tsx|vue|svelte|py|java|kt|kts|gradle|c|h|cpp|cc|hpp|cs|go|rs|php|rb|swift|dart|lua|r|sh|bash|bat|ps1|sql|yml|yaml|toml|ini|cfg|conf|env|properties|log|tex|srt|vtt|gitignore|editorconfig|svg|plist|iml)$/i;
const TEXT_NAME=/(^|\/)(dockerfile|makefile|readme|license|procfile|gemfile|\.gitignore|\.env[\w.]*)$/i;
const SKIP_DIR=/(^|\/)(node_modules|\.git|__pycache__|\.idea|\.vscode|build|dist|\.gradle|venv|\.venv|target|out|\.next)\//i;
const dec=new TextDecoder('utf-8');
const fmtSize=n=>n<1024?n+' Б':n<1048576?(n/1024).toFixed(n<10240?1:0)+' КБ':(n/1048576).toFixed(1)+' МБ';
const block=(n,t,max)=>{max=max||CTX_MAX;return'=== ФАЙЛ: '+n+' ('+t.length+' симв.) ===\n'+t.slice(0,max)+(t.length>max?'\n[… обрезано, всего '+t.length+' симв.]':'')+'\n=== КОНЕЦ ФАЙЛА ==='};

/* ---------- ZIP ---------- */
async function unzip(buf){
  const u=new Uint8Array(buf),dv=new DataView(buf);let e=-1;
  for(let i=u.length-22;i>=Math.max(0,u.length-65558);i--){if(dv.getUint32(i,true)===0x06054b50){e=i;break}}
  if(e<0)throw new Error('это не ZIP-архив или он повреждён');
  const n=dv.getUint16(e+10,true);let p=dv.getUint32(e+16,true);const entries=[];
  for(let k=0;k<n;k++){
    if(dv.getUint32(p,true)!==0x02014b50)break;
    const meth=dv.getUint16(p+10,true),csz=dv.getUint32(p+20,true),sz=dv.getUint32(p+24,true),nl=dv.getUint16(p+28,true),xl=dv.getUint16(p+30,true),cl=dv.getUint16(p+32,true),off=dv.getUint32(p+42,true);
    const name=dec.decode(u.subarray(p+46,p+46+nl));p+=46+nl+xl+cl;
    if(!name.endsWith('/'))entries.push({name,meth,csz,sz,off})}
  async function data(ent){
    const lh=ent.off,s=lh+30+dv.getUint16(lh+26,true)+dv.getUint16(lh+28,true),raw=u.subarray(s,s+ent.csz);
    if(ent.meth===0)return raw;
    if(ent.meth===8)return new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());
    throw new Error('неподдерживаемое сжатие')}
  return{entries,data}}
async function readZipAtt(file){
  const z=await unzip(await file.arrayBuffer());
  const ents=z.entries.filter(e=>!SKIP_DIR.test(e.name)),roots=new Set(ents.map(e=>e.name.split('/')[0]));
  const strip=roots.size===1&&ents.every(e=>e.name.includes('/'))?[...roots][0]+'/':'',rel=e=>strip?e.name.slice(strip.length):e.name;
  const tree=ents.map(e=>rel(e)+' ('+fmtSize(e.sz)+')').slice(0,300);
  const rank=e=>/(^|\/)(readme|package\.json|requirements\.txt|pom\.xml|build\.gradle|manifest\.json|index\.html)/i.test(rel(e))?0:1;
  const texty=ents.filter(e=>(TEXT_RX.test(e.name)||TEXT_NAME.test(e.name))&&e.sz<=250000).sort((a,b)=>rank(a)-rank(b)||a.sz-b.sz);
  const files=[];let budget=ZIP_BUDGET;
  for(const e of texty){if(budget<=0)break;try{const t=dec.decode(await z.data(e));if(t.slice(0,2000).includes('\u0000'))continue;files.push({path:rel(e),text:t});budget-=t.length}catch{}}
  const skipped=ents.length-files.length;
  return{kind:'zip',name:file.name,size:file.size,files,
    ctx:'=== АРХИВ: '+file.name+', файлов: '+ents.length+' ===\nСтруктура:\n'+tree.join('\n')+(ents.length>300?'\n… ещё '+(ents.length-300):'')+'\n\n'+files.map(f=>block(f.path,f.text,20000)).join('\n')+(skipped>0?'\n(Не прочитано как текст: '+skipped+' — бинарные, большие или служебные файлы.)':'')}}

/* ---------- документы Office / OpenDocument ---------- */
async function readDocAtt(file){
  const z=await unzip(await file.arrayBuffer()),ext=file.name.split('.').pop().toLowerCase(),dp=new DOMParser();
  const get=async n=>{const e=z.entries.find(x=>x.name===n);return e?dec.decode(await z.data(e)):''};
  const paras=(xml,tag)=>[...dp.parseFromString(xml,'text/xml').getElementsByTagName(tag)].map(p=>p.textContent).join('\n');
  let text='';
  if(ext==='docx')text=paras(await get('word/document.xml'),'w:p');
  else if(ext==='pptx'){const sl=z.entries.filter(e=>/^ppt\/slides\/slide\d+\.xml$/.test(e.name)).sort((a,b)=>parseInt(a.name.match(/\d+/)[0])-parseInt(b.name.match(/\d+/)[0]));let i=0;for(const e of sl){i++;text+='--- Слайд '+i+' ---\n'+paras(dec.decode(await z.data(e)),'a:p')+'\n'}}
  else if(ext==='xlsx'){
    const ss=[...dp.parseFromString(await get('xl/sharedStrings.xml')||'<x/>','text/xml').getElementsByTagName('si')].map(si=>si.textContent);
    const sh=z.entries.filter(e=>/^xl\/worksheets\/sheet\d+\.xml$/.test(e.name));let i=0;
    for(const e of sh){i++;const d=dp.parseFromString(dec.decode(await z.data(e)),'text/xml');text+='--- Лист '+i+' ---\n'+[...d.getElementsByTagName('row')].slice(0,500).map(r=>[...r.getElementsByTagName('c')].map(c=>{const v=c.getElementsByTagName('v')[0],val=v?v.textContent:(c.textContent||'');return c.getAttribute('t')==='s'?(ss[+val]||''):val}).join('\t')).join('\n')+'\n'}}
  else text=[paras(await get('content.xml'),'text:p'),paras(await get('content.xml'),'text:h')].join('\n');
  text=text.trim();
  return{kind:'doc',name:file.name,size:file.size,ctx:text?block(file.name,text):'=== ФАЙЛ '+file.name+': текст не найден ==='}}

/* ---------- PDF (простые файлы с текстовым слоем) ---------- */
async function readPdfAtt(file){
  const buf=new Uint8Array(await file.arrayBuffer());let out='';
  if(buf.length<=15*1048576){
    let latin='';for(let i=0;i<buf.length;i+=32768)latin+=String.fromCharCode.apply(null,buf.subarray(i,i+32768));
    const re=/stream\r?\n([\s\S]*?)\r?\nendstream/g;let m,n=0;const unesc=s=>s.replace(/\\([nrtbf()\\])/g,(a,c)=>({n:'\n',r:'',t:' ',b:'',f:''}[c]??c)).replace(/\\(\d{1,3})/g,(a,o)=>String.fromCharCode(parseInt(o,8)));
    while((m=re.exec(latin))&&n++<600){
      let t;try{t=await new Response(new Blob([Uint8Array.from(m[1],c=>c.charCodeAt(0))]).stream().pipeThrough(new DecompressionStream('deflate'))).arrayBuffer();t=String.fromCharCode.apply(null,new Uint8Array(t).subarray(0,200000))}catch{continue}
      if(!/BT/.test(t))continue;
      t.replace(/\[((?:[^\]\\]|\\.)*)\]\s*TJ|\(((?:[^)\\]|\\.)*)\)\s*(?:Tj|'|")/g,(a,arr,s)=>{out+=arr!==undefined?arr.replace(/\(((?:[^)\\]|\\.)*)\)|(-?\d+\.?\d*)/g,(x,tt,nn)=>tt!==undefined?unesc(tt):(parseFloat(nn)<-200?' ':'')):unesc(s);out+=arr!==undefined||/\)\s*(Tj)/.test(a)?' ':'\n';return''})}}
  const letters=(out.match(/[A-Za-zА-Яа-яЁё]/g)||[]).length;
  if(out.length<80||letters/Math.max(1,out.length)<.45)return{kind:'doc',name:file.name,size:file.size,ctx:'=== ФАЙЛ '+file.name+' (PDF): надёжно прочитать текст не удалось (сканы и русские шрифты в PDF часто не читаются без OCR). Попросите пользователя прислать страницы фото или вставить текст. ==='};
  return{kind:'doc',name:file.name,size:file.size,ctx:block(file.name,out.replace(/[ \t]+\n/g,'\n').replace(/\n{3,}/g,'\n\n'))}}

/* ---------- изображения ---------- */
function imgData(file){return new Promise((ok,no)=>{const r=new FileReader();r.onerror=no;r.onload=()=>{const img=new Image();img.onerror=()=>no(new Error('формат изображения не поддерживается'));img.onload=()=>{const k=Math.min(1,1280/Math.max(img.width,img.height)),c=document.createElement('canvas');c.width=Math.round(img.width*k);c.height=Math.round(img.height*k);c.getContext('2d').drawImage(img,0,0,c.width,c.height);ok(c.toDataURL('image/jpeg',.82))};img.src=r.result};r.readAsDataURL(file)})}

/* ---------- чтение любого файла ---------- */
async function readAtt(file){
  const name=file.name||'файл',size=file.size;
  if((file.type||'').startsWith('image/')||/\.(jpe?g|png|webp|gif|bmp|heic|heif|avif)$/i.test(name))return{kind:'image',name,size,dataUrl:await imgData(file)};
  if(/\.(zip|jar|apk|aar|war)$/i.test(name)||file.type==='application/zip')return readZipAtt(file);
  if(/\.(docx|pptx|xlsx|odt|odp|ods)$/i.test(name))return readDocAtt(file);
  if(/\.pdf$/i.test(name)||file.type==='application/pdf')return readPdfAtt(file);
  if(size<=2*1048576){
    const head=new Uint8Array(await file.slice(0,4096).arrayBuffer());
    if(TEXT_RX.test(name)||TEXT_NAME.test(name)||!head.includes(0)){const t=dec.decode(await file.arrayBuffer());if(!t.slice(0,4000).includes('\u0000'))return{kind:'text',name,size,text:t,ctx:block(name,t)}}}
  return{kind:'bin',name,size,ctx:'=== ФАЙЛ '+name+' ('+fmtSize(size)+'): двоичный файл, содержимое не читается. Сообщи об этом пользователю, если он спрашивает про содержимое. ==='}}

/* ---------- хранилище вложений ---------- */
const tray=el('div','atttray');tray.hidden=true;
const ICON={zip:'🗜',doc:'📄',text:'📝',bin:'📦'};
function render(){
  tray.replaceChildren();tray.hidden=!VKATT.items.length;
  VKATT.items.forEach((a,i)=>{
    const c=el('div','att '+a.kind);
    if(a.kind==='image'){const im=new Image();im.src=a.dataUrl;im.alt=a.name;c.append(im)}
    else{const t=el('div','at');t.append(el('b',null,a.name),el('small',null,fmtSize(a.size)+(a.files?' · '+a.files.length+' текст. файлов':'')));c.append(el('span','ai',ICON[a.kind]||'📎'),t)}
    const x=el('button','ax','×');x.type='button';x.setAttribute('aria-label','Убрать');x.onclick=()=>{VKATT.items.splice(i,1);render()};c.append(x);tray.append(c)})}
window.VKATT={items:[],
  take(){const a=this.items.splice(0);render();let left=TOTAL_CTX;for(const x of a){if(x.ctx){x.ctx=x.ctx.slice(0,Math.max(0,left));left-=x.ctx.length}}return a},
  addImage(d,n){if(this.items.filter(x=>x.kind==='image').length>=MAX_IMGS)return flash('Не больше '+MAX_IMGS+' фото за раз');this.items.push({kind:'image',name:n||'Фото '+(this.items.length+1),size:Math.round(d.length*.75),dataUrl:d});render()},
  async addFiles(list){
    const arr=[...list];if(!arr.length)return;flash('Читаю файлы…');let ok=0;
    for(const f of arr){
      if(this.items.length>=MAX_ITEMS){flash('Не больше '+MAX_ITEMS+' вложений за раз');break}
      try{const a=await readAtt(f);if(a.kind==='image'&&this.items.filter(x=>x.kind==='image').length>=MAX_IMGS){flash('Не больше '+MAX_IMGS+' фото за раз');continue}this.items.push(a);ok++;render()}
      catch(e){flash('Не удалось прочитать '+(f.name||'файл')+': '+e.message)}}
    if(ok)flash('Прикреплено: '+ok)}};

/* ---------- раскладка ---------- */
{
  const header=document.querySelector('header'),mb=$('menuBtn');if(mb)header.prepend(mb);
  document.querySelector('.brand').style.display='none';$('settingsBtn').style.display='none';
  const sp=document.querySelector('svg[style*="display:none"]');
  if(sp)for(const[k,v]of Object.entries({edit:'<path d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4"/>',clip:'<path d="M20 12l-7.5 7.5a5 5 0 0 1-7-7L13 5a3.5 3.5 0 0 1 5 5l-7.5 7.5a2 2 0 0 1-3-3L14 8"/>'}))if(!document.getElementById('i-'+k))sp.insertAdjacentHTML('beforeend','<symbol id="i-'+k+'" viewBox="0 0 24 24">'+v+'</symbol>');
  const nb=el('button','icon-btn');nb.id='newBtn';nb.type='button';nb.setAttribute('aria-label','Новый чат');nb.insertAdjacentHTML('afterbegin',ic('edit'));nb.onclick=()=>VK.newChat();document.querySelector('.hbtns').append(nb);
  const foot=document.querySelector('footer.composer'),box=foot.querySelector('.box'),tools=foot.querySelector('.tools');foot.style.position='relative';
  box.before(tray);
  const plus=el('button','tbtn plus');plus.id='plusBtn';plus.type='button';plus.setAttribute('aria-label','Прикрепить');plus.insertAdjacentHTML('afterbegin',ic('plus'));
  tools.prepend(plus);plus.after($('provBtn'));$('photoBtn').style.display='none';$('galleryBtn').style.display='none';
  const imgIn=document.createElement('input');imgIn.type='file';imgIn.accept='image/*';imgIn.multiple=true;imgIn.hidden=true;
  const fileIn=document.createElement('input');fileIn.type='file';fileIn.multiple=true;fileIn.hidden=true;
  imgIn.onchange=()=>{VKATT.addFiles(imgIn.files);imgIn.value=''};fileIn.onchange=()=>{VKATT.addFiles(fileIn.files);fileIn.value=''};
  foot.append(imgIn,fileIn);
  const pop=el('div','pop');pop.hidden=true;
  const mi=(icon,t,sub,fn)=>{const b=el('button');b.type='button';b.insertAdjacentHTML('afterbegin',ic(icon));const d=el('div');d.append(el('b',null,t),el('small',null,sub));b.append(d);b.onclick=()=>{pop.hidden=true;fn()};return b};
  pop.append(mi('camera','Камера','снимок добавится во вложения',()=>{photoMode=null;takePhoto()}),mi('image','Фото из галереи','можно выбрать сразу несколько',()=>imgIn.click()),mi('note','Файлы и ZIP','любые: код, документы, таблицы, архивы',()=>fileIn.click()));
  foot.append(pop);
  plus.onclick=e=>{e.stopPropagation();pop.hidden=!pop.hidden};document.addEventListener('click',e=>{if(!pop.hidden&&!pop.contains(e.target))pop.hidden=true});
  const cf=el('div','cfoot');cf.id='cfoot';foot.append(cf);
  const setFoot=()=>{cf.textContent=botN()+' '+VER+' · ИИ может ошибаться. Проверяйте важное'};setFoot();document.addEventListener('visibilitychange',setFoot);setInterval(setFoot,6000);
}

/* фото с камеры идут во вложения (кроме режимов учёбы) */
{const _gp=gotPhoto;const gp=function(d){if(photoMode)return _gp(d);VKATT.addImage(d)};gotPhoto=gp;window.onNativePhoto=gp}

/* пустое сообщение с вложениями: подставляем запрос по умолчанию */
{const fill=()=>{const ta=$('textCommand');if(!ta.value.trim()&&VKATT.items.length){const onlyImg=VKATT.items.every(a=>a.kind==='image');ta.value=settings.codeMode?'Изучи вложенные файлы и кратко опиши структуру проекта и что можно улучшить':onlyImg?'Опиши, что на фото':'Изучи вложения и кратко расскажи, что в них'}};
  $('sendBtn').parentElement.addEventListener('click',e=>{if($('sendBtn').contains(e.target))fill()},true);
  $('textCommand').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey)fill()},true)}

/* отправка с вложениями идёт сразу в ИИ (в режиме VKTR Code — в кодовый конвейер) */
{const _h=handleCommand;
  handleCommand=function(raw){
    const c=String(raw||'').trim();if(!c)return;
    if(!VKATT.items.length)return _h(raw);
    const hasProject=VKATT.items.some(a=>a.kind==='zip'||a.kind==='text');
    if(!settings.codeMode&&hasProject&&/(исправь|доработай|добавь|измени|перепиши|рефактор|найди ошибк|найди баг|оптимизируй|сделай|напиши)/i.test(c))VK.setCode(true,true,true);
    log('user',c+'\n'+VKATT.items.map(a=>'📎 '+a.name).join('\n'),'user');$('textCommand').value='';autosize();
    return settings.codeMode?VK.codeAI(c):ai(c)}}
VK.attach=VKATT;
})();
