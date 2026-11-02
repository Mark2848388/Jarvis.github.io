/* ВЕКТОР v3 — расширения поверх app.js.
   Подключается после app.js. Здесь: markdown с таблицами, сборка ZIP, режим «Код» с самопроверкой,
   диктовка, шторка с чатами, темы. */
(function(){
'use strict';
// Адрес облачного прокси (см. server/worker.js). Если заполнен, Вектор работает без личных API-ключей пользователей.
const CLOUD_URL='';

//#PURE-START
/* ---------- пути и ZIP ---------- */
const normPath=p=>String(p||'').replace(/\\/g,'/').replace(/^[a-zA-Z]:/,'').split('/').filter(x=>x&&x!=='.'&&x!=='..').join('/');
const CRC=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c>>>0}return t})();
function crc32(u8){let c=0xFFFFFFFF;for(let i=0;i<u8.length;i++)c=CRC[(c^u8[i])&255]^(c>>>8);return(c^0xFFFFFFFF)>>>0}
function buildZip(files){
  const enc=new TextEncoder(),parts=[],cd=[];let off=0;
  const d=new Date(),dt=((d.getHours()<<11)|(d.getMinutes()<<5)|(d.getSeconds()>>1))&0xFFFF,dd=(((d.getFullYear()-1980)<<9)|((d.getMonth()+1)<<5)|d.getDate())&0xFFFF;
  for(const f of files){
    const nm=enc.encode(f.name),crc=crc32(f.data),sz=f.data.length;
    const lh=new DataView(new ArrayBuffer(30));
    lh.setUint32(0,0x04034b50,true);lh.setUint16(4,20,true);lh.setUint16(6,0x0800,true);lh.setUint16(8,0,true);lh.setUint16(10,dt,true);lh.setUint16(12,dd,true);
    lh.setUint32(14,crc,true);lh.setUint32(18,sz,true);lh.setUint32(22,sz,true);lh.setUint16(26,nm.length,true);lh.setUint16(28,0,true);
    parts.push(lh.buffer,nm,f.data);
    const ch=new DataView(new ArrayBuffer(46));
    ch.setUint32(0,0x02014b50,true);ch.setUint16(4,20,true);ch.setUint16(6,20,true);ch.setUint16(8,0x0800,true);ch.setUint16(10,0,true);ch.setUint16(12,dt,true);ch.setUint16(14,dd,true);
    ch.setUint32(16,crc,true);ch.setUint32(20,sz,true);ch.setUint32(24,sz,true);ch.setUint16(28,nm.length,true);ch.setUint32(42,off,true);
    cd.push(ch.buffer,nm);off+=30+nm.length+sz}
  let cs=0;for(const x of cd)cs+=x.byteLength;
  const e=new DataView(new ArrayBuffer(22));
  e.setUint32(0,0x06054b50,true);e.setUint16(8,files.length,true);e.setUint16(10,files.length,true);e.setUint32(12,cs,true);e.setUint32(16,off,true);
  return new Blob([...parts,...cd,e.buffer],{type:'application/zip'})}

/* ---------- разбор блоков кода ---------- */
const EXT={js:'js',javascript:'js',ts:'ts',typescript:'ts',py:'py',python:'py',html:'html',css:'css',json:'json',kt:'kt',kotlin:'kt',java:'java',cs:'cs',csharp:'cs',cpp:'cpp',c:'c',go:'go',rs:'rs',rust:'rs',php:'php',rb:'rb',sh:'sh',bash:'sh',sql:'sql',md:'md',markdown:'md',yml:'yml',yaml:'yml',xml:'xml',txt:'txt',swift:'swift',jsx:'jsx',tsx:'tsx'};
const FENCE=/(`{3,})([^\n`]*)\n([\s\S]*?)(?:\1(?!`)|$)/g;
function parseFence(info,code){
  const toks=String(info||'').trim().split(/\s+/).filter(Boolean);let lang='',path='';
  if(toks.length&&/^[\w+#-]+$/.test(toks[0]))lang=toks.shift().toLowerCase();
  for(const t of toks){const m=t.match(/^(?:path|file|filename|title|name)\s*[=:]\s*["']?(.+?)["']?$/i);if(m)path=m[1];else if(!path&&/[./]/.test(t))path=t.replace(/^["']|["']$/g,'')}
  code=String(code).replace(/\r/g,'');
  const fl=code.split('\n',1)[0],m=fl.match(/^\s*(?:\/\/|#|<!--|\/\*|--|;)\s*(?:file|path|файл|filename)\s*[:=]\s*["']?([^\s"'>*]+)/i);
  if(m){if(!path)path=m[1];code=code.slice(fl.length+1)}
  return{lang,path:normPath(path),code:code.replace(/\n+$/,'')}}
function extractFiles(text,allowDefault){
  const re=new RegExp(FENCE.source,'g'),all=[];let m;
  while((m=re.exec(String(text)))){const f=parseFence(m[2],m[3]);f.raw=m[0];all.push(f)}
  const out=all.filter(f=>f.path);
  if(allowDefault&&!out.length&&all.length===1&&EXT[all[0].lang]){const f=all[0];f.path='main.'+EXT[f.lang];out.push(f)}
  return out}

/* ---------- статическая проверка ---------- */
const AsyncFn=Object.getPrototypeOf(async function(){}).constructor;
const PLACE=/(\.\.\.\s*(остальн|rest of|existing|your code|код здесь)|\/\/\s*(остальной|rest of|\.\.\.|your code)|TODO:?\s*(implement|реализ|добав)|#\s*TODO:?\s*implement|остальной код без изменений)/i;
function staticCheck(PF,only){
  const issues=[],paths=only&&only.length?only:Object.keys(PF);
  for(const p of paths){const f=PF[p];if(!f)continue;const c=f.code||'',ext=(p.split('.').pop()||'').toLowerCase();
    if(!c.trim()){issues.push({path:p,msg:'файл пустой'});continue}
    if(PLACE.test(c))issues.push({path:p,msg:'есть заглушка или сокращение вместо кода'});
    if(ext==='json'){try{JSON.parse(c)}catch(e){issues.push({path:p,msg:'некорректный JSON: '+e.message})}}
    else if(ext==='js'||ext==='cjs'){if(!/^\s*(import|export)\s/m.test(c)){try{new AsyncFn(c)}catch(e){issues.push({path:p,msg:'синтаксическая ошибка JS: '+e.message})}}}
    else if(ext==='html'||ext==='htm'){
      if(typeof DOMParser!=='undefined'){
        const doc=new DOMParser().parseFromString(c,'text/html'),dir=p.includes('/')?p.slice(0,p.lastIndexOf('/')+1):'';
        doc.querySelectorAll('script:not([src])').forEach(s=>{const t=(s.type||'').toLowerCase();if(t&&t!=='text/javascript')return;const js=s.textContent;if(!js.trim()||/^\s*(import|export)\s/m.test(js))return;try{new AsyncFn(js)}catch(e){issues.push({path:p,msg:'синтаксическая ошибка в <script>: '+e.message})}});
        doc.querySelectorAll('script[src],link[rel=stylesheet][href]').forEach(n=>{const u=n.getAttribute('src')||n.getAttribute('href')||'';if(!u||/^(https?:|\/\/|data:|#|mailto:)/i.test(u))return;const full=normPath(dir+u.split('?')[0].split('#')[0]);if(!PF[full])issues.push({path:p,msg:'ссылается на отсутствующий файл '+u})})}}
  }
  return issues}

/* ---------- текст для озвучки ---------- */
function plainSpeech(t){
  t=String(t).replace(/(`{3,})[\s\S]*?(\1|$)/g,' ');
  t=t.split('\n').filter(l=>!/^\s*\|/.test(l)&&!/^\s*[-:| ]{3,}$/.test(l)).join('\n');
  t=t.replace(/^\s{0,3}#{1,6}\s*/gm,'').replace(/^\s*>\s?/gm,'').replace(/^\s*[-*•+]\s+/gm,'').replace(/^\s*\d+[.)]\s+/gm,'').replace(/\[([^\]]+)\]\([^)]+\)/g,'$1').replace(/[*_~`#|]/g,'').replace(/\s*\n\s*/g,'. ').replace(/([.!?…])\s*\./g,'$1').replace(/\s{2,}/g,' ').trim();
  if(!t)return'Готово. Всё на экране.';
  if(t.length>420){let cut=t.slice(0,420);const i=Math.max(cut.lastIndexOf('. '),cut.lastIndexOf('! '),cut.lastIndexOf('? '));if(i>150)cut=cut.slice(0,i+1);t=cut+' Остальное на экране.'}
  return t}
//#PURE-END

/* ---------- состояние проекта (файлы, которые собрал ИИ) ---------- */
let PF=read('vk_files',{}),PFname=read('vk_fname','');
const savePF=()=>{write('vk_files',PF);write('vk_fname',PFname);refreshDrawer()};
const slug=s=>String(s||'').toLowerCase().replace(/[^a-z0-9._-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,40);
function mergePF(files){for(const f of files){PF[f.path]={lang:f.lang,code:f.code}}savePF()}
const plural=(n,f)=>n+' '+(n%10===1&&n%100!==11?f[0]:n%10>1&&n%10<5&&(n%100<10||n%100>=20)?f[1]:f[2]);
const fmtKB=n=>n<1024?n+' Б':(n/1024).toFixed(n<10240?1:0)+' КБ';

/* ---------- Markdown ---------- */
function inline(p,t){
  const re=new RegExp([
    '`[^`\\n]+`','\\*\\*[^*\\n]+?\\*\\*','__[^_\\n]+?__','~~[^~\\n]+?~~','\\[[^\\]\\n]+\\]\\(https?:\\/\\/[^)\\s]+\\)',
    '(?<![\\p{L}\\p{N}*])\\*[^*\\s][^*\\n]*?\\*(?![\\p{L}\\p{N}*])','(?<![\\p{L}\\p{N}_])_[^_\\s][^_\\n]*?_(?![\\p{L}\\p{N}_])'
  ].join('|'),'gu');
  t=String(t);let last=0,m;
  while((m=re.exec(t))){
    if(m.index>last)p.append(document.createTextNode(t.slice(last,m.index)));
    const x=m[0];let n;
    if(x[0]==='`'){n=document.createElement('code');n.textContent=x.slice(1,-1)}
    else if(x.startsWith('**')||x.startsWith('__')){n=document.createElement('b');inline(n,x.slice(2,-2))}
    else if(x.startsWith('~~')){n=document.createElement('s');inline(n,x.slice(2,-2))}
    else if(x[0]==='['){const mm=x.match(/^\[(.+?)\]\((.+)\)$/);n=document.createElement('a');n.href=mm[2];n.target='_blank';n.rel='noopener';inline(n,mm[1]);if(NATIVE)n.onclick=e=>{e.preventDefault();Android.openUrl(mm[2],'')}}
    else{n=document.createElement('i');inline(n,x.slice(1,-1))}
    p.append(n);last=m.index+x.length}
  if(last<t.length)p.append(document.createTextNode(t.slice(last)))}
inl=inline;

const isSep=l=>/^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(l)&&l.includes('-');
const cells=l=>{l=l.trim().replace(/^\|/,'').replace(/\|$/,'');return l.split(/(?<!\\)\|/).map(c=>c.replace(/\\\|/g,'|').trim())};
function mkTable(lines){
  const head=cells(lines[0]),al=cells(lines[1]).map(c=>/^:-+:$/.test(c)?'center':/-+:$/.test(c)?'right':''),w=el('div','tblw'),t=el('table','tbl'),th=el('thead'),tb=el('tbody'),hr=el('tr');
  head.forEach((c,i)=>{const x=el('th');inline(x,c);if(al[i])x.style.textAlign=al[i];hr.append(x)});th.append(hr);
  for(const l of lines.slice(2)){const r=cells(l),tr=el('tr');for(let i=0;i<head.length;i++){const x=el('td');inline(x,r[i]||'');if(al[i])x.style.textAlign=al[i];tr.append(x)}tb.append(tr)}
  t.append(th,tb);w.append(t);return w}
function copyText(txt,btn){
  const ok=()=>{const o=btn.textContent;btn.textContent='Скопировано';setTimeout(()=>btn.textContent=o,1400)};
  if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(txt).then(ok,()=>fb());else fb();
  function fb(){const a=document.createElement('textarea');a.value=txt;a.style.position='fixed';a.style.opacity='0';document.body.append(a);a.select();try{document.execCommand('copy');ok()}catch{}a.remove()}}
function mkCode(f){
  const box=el('div','cblk'),h=el('div','cbh'),nm=el('span','nm',f.path||f.lang||'код'),b=el('button',null,'Копировать'),pre=el('pre','code');
  b.type='button';b.onclick=()=>copyText(f.code,b);pre.textContent=f.code;h.append(nm,b);box.append(h,pre);return box}
function textBlocks(text,f){
  const L=text.replace(/\t/g,'  ').split('\n');
  for(let i=0;i<L.length;i++){
    const s=L[i].trimEnd();if(!s.trim())continue;let m;
    if(s.includes('|')&&L[i+1]!==undefined&&isSep(L[i+1])&&cells(s).length>=2){const tl=[s,L[i+1]];let j=i+2;while(j<L.length&&L[j].includes('|')&&L[j].trim()){tl.push(L[j]);j++}f.append(mkTable(tl));i=j-1;continue}
    const d=document.createElement('div');
    if(m=s.match(/^\s{0,3}(#{1,6})\s+(.*?)\s*#*$/)){d.className='mdh h'+Math.min(m[1].length,3);inline(d,m[2])}
    else if(/^\s*([-*_])(\s*\1){2,}\s*$/.test(s)){d.className='mdhr'}
    else if(m=s.match(/^\s*>\s?(.*)/)){d.className='mdq';inline(d,m[1])}
    else if(m=s.match(/^(\s*)[-*•+]\s+(.*)/)){const lv=Math.min(3,1+Math.floor(m[1].length/2));d.className='mdli l'+lv;let tx=m[2],mk=lv>1?'–':'•';const cb=tx.match(/^\[( |x|X)\]\s+(.*)/);if(cb){mk=cb[1]===' '?'☐':'☑';tx=cb[2]}d.append(document.createTextNode(mk+'\u00a0'));inline(d,tx)}
    else if(m=s.match(/^(\s*)(\d+[.)])\s+(.*)/)){const lv=Math.min(3,1+Math.floor(m[1].length/2));d.className='mdli l'+lv;d.append(document.createTextNode(m[2]+'\u00a0'));inline(d,m[3])}
    else{d.className='mdp';inline(d,s)}
    f.append(d)}}
md=function(t){
  const f=document.createDocumentFragment();t=String(t).replace(/```([^\n`]+)```/g,'`$1`');
  const re=new RegExp(FENCE.source,'g');let last=0,m;
  while((m=re.exec(t))){if(m.index>last)textBlocks(t.slice(last,m.index),f);f.append(mkCode(parseFence(m[2],m[3])));last=m.index+m[0].length;if(m[0].length===0)re.lastIndex++}
  if(last<t.length)textBlocks(t.slice(last),f);
  return f};

/* ---------- озвучка: коротко и без разметки ---------- */
{const _speak=speak;speak=function(t,l){return _speak(plainSpeech(t),l)}}

/* ---------- ZIP: выдача файла ---------- */
const b64=blob=>new Promise((ok,no)=>{const r=new FileReader();r.onload=()=>ok(String(r.result).split(',')[1]);r.onerror=no;r.readAsDataURL(blob)});
async function deliver(blob,name){
  if(NATIVE&&window.Android&&Android.saveFile){Android.saveFile(name,await b64(blob),blob.type||'application/zip');return true}
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),120000);return true}
function fileCard(){
  const ps=Object.keys(PF);if(!ps.length)return null;
  const size=ps.reduce((n,p)=>n+PF[p].code.length,0),c=el('div','filecard'),i=el('div','fi'),b=el('button',null,'Скачать ZIP');
  i.append(el('b',null,(PFname||'vektor-project')+'.zip'),el('small',null,plural(ps.length,['файл','файла','файлов'])+' · '+fmtKB(size)));
  b.type='button';b.onclick=()=>zipProject(true);c.append(i,b);
  const w=el('div');w.append(c);const ul=el('ul','filelist');ps.forEach(p=>ul.append(el('li',null,p)));w.append(ul);return w}
function attachCard(){const bs=document.querySelectorAll('.msg.jarvis .bubble'),b=bs[bs.length-1],c=fileCard();if(b&&c){b.append(c);toBottom()}}
async function zipProject(quiet){
  const ps=Object.keys(PF);
  if(!ps.length){if(!quiet)say('Пока нечего паковать. Попросите, например: «Сделай приложение-калькулятор и запакуй в zip».');return false}
  const enc=new TextEncoder(),root=slug(PFname)||'vektor-project';
  const blob=buildZip(ps.map(p=>({name:root+'/'+p,data:enc.encode(PF[p].code)})));
  await deliver(blob,root+'.zip');
  if(NATIVE&&!(window.Android&&Android.saveFile))log('sys','Для сохранения ZIP на телефон обновите APK (в нём появился доступ к файлам).','error');
  else flash('ZIP собран: '+root+'.zip');
  return true}

/* ---------- Режим «Код» ---------- */
const CODE_SYS=`Ты Вектор Код — старший инженер-разработчик. Пишешь рабочий, профессиональный, законченный код. Никаких заглушек и сокращений («...», «остальное без изменений», TODO вместо реализации).
Формат ответа, когда нужен код:
1) Первой строкой: PROJECT: короткое-имя-латиницей (только для нового проекта).
2) 2–4 строки плана на русском.
3) Каждый файл отдельным блоком, заголовок СТРОГО такой: три обратных кавычки, язык, пробел, path=относительный/путь/файла.ext, затем код и закрывающие три обратные кавычки. Пути без начального слэша.
4) Для приложения создай ВСЕ файлы, нужные для запуска (включая README.md и файл зависимостей, если они нужны). В README.md не используй вложенные блоки кода, команды оформляй отступом в 4 пробела.
5) В конце — раздел «Как запустить» на 2–5 строк.
Если правишь существующий проект, выдавай изменённые файлы ЦЕЛИКОМ, пути как в проекте. Продумай обработку ошибок и граничные случаи, согласованность имён между файлами (id элементов, функции, импорты, пути). Не требуй платных сервисов и ключей без необходимости. Если вопрос не про создание кода, отвечай кратко и по делу. Таблицы и списки оформляй в markdown.`;
const REVIEW_SYS=`Ты строгий ревьюер кода. Проверь файлы: синтаксис, логические ошибки, обработку ошибок, несостыковки между файлами (имена функций, id элементов, импорты, пути), неполный код, очевидные проблемы безопасности.
Если проблем нет — ответь ровно одним словом: OK.
Если проблемы есть — сначала строка «ПРОБЛЕМЫ:» и до 5 коротких пунктов, затем ПОЛНЫЕ исправленные версии только изменённых файлов в том же формате блоков (три обратные кавычки, язык, path=путь, код, три обратные кавычки). Ничего не сокращай.`;
let busy=false;
function progress(t){const r=document.createElement('div');r.className='msg sys';const b=document.createElement('div');b.className='bubble';r.append(b);$('log').append(r);const set=x=>{b.textContent=x;toBottom()};set(t);return{set,done:()=>r.remove()}}
const compact=t=>String(t).replace(new RegExp(FENCE.source,'g'),(a,x,i,c)=>{const f=parseFence(i,c);return'[файл '+(f.path||f.lang||'код')+', '+c.split('\n').length+' строк]'});
function projectCtx(){
  const ps=Object.keys(PF);if(!ps.length)return'';let left=28000,o='\n\nТЕКУЩИЕ ФАЙЛЫ ПРОЕКТА (учитывай их и правь согласованно):\n';
  for(const p of ps){const c=PF[p].code;if(c.length<=left){o+='--- '+p+'\n'+c+'\n';left-=c.length}else o+='--- '+p+' (содержимое пропущено, '+c.length+' символов)\n'}return o}
async function review(files,issues){
  const body=Object.values(files).map(f=>'```'+(f.lang||'')+' path='+f.path+'\n'+f.code+'\n```').join('\n');
  return ask([{role:'system',content:REVIEW_SYS},{role:'user',content:(issues.length?'Автоматическая проверка нашла:\n'+issues.map(i=>'- '+i.path+': '+i.msg).join('\n')+'\n\n':'')+'Файлы:\n'+body}],8000)}
async function codeAI(text,opt){
  opt=opt||{};
  if(!P.list.some(p=>p.key)){say('Подключите нейросеть: нажмите на кнопку ИИ вверху и добавьте ключ.');return}
  if(busy){flash('Подождите, предыдущий запрос ещё выполняется');return}
  busy=true;const pr=progress('Пишу код…');state('ПИШУ КОД…','РАБОТА');
  try{
    const hist=chat.slice(-4).map(m=>({role:m.role,content:compact(m.content)}));
    let ans=await ask([{role:'system',content:CODE_SYS+projectCtx()},...hist,{role:'user',content:text}],8000);
    const pn=ans.match(/^\s*PROJECT\s*:\s*([\w .-]+)/im);if(pn&&(!Object.keys(PF).length||!PFname))PFname=slug(pn[1])||PFname;
    ans=ans.replace(/^\s*PROJECT\s*:.*\n?/im,'').trim();
    const got=extractFiles(ans,true);
    if(!got.length){pr.done();chat.push({role:'user',content:text},{role:'assistant',content:ans});chat=chat.slice(-12);write('jarvis_chat',chat);say(ans);return}
    const work={};got.forEach(f=>{work[f.path]=f});mergePF(got);
    const fixed=new Set();let probs='',remaining=[],rounds=0;
    while(rounds<2){
      rounds++;pr.set(rounds===1?'Проверяю код…':'Повторная проверка…');state('ПРОВЕРЯЮ КОД…','ПРОВЕРКА');
      const issues=staticCheck(PF,Object.keys(work));let r;
      try{r=await review(work,issues)}catch(e){remaining=issues;break}
      const fx=/^\s*OK\b/i.test(r)?[]:extractFiles(r);
      if(!fx.length){remaining=issues;break}
      const pm=r.match(/ПРОБЛЕМЫ:?\s*([\s\S]*?)(?=`{3}|$)/i);if(pm&&!probs)probs=pm[1].trim().slice(0,700);
      pr.set('Исправляю найденное…');
      fx.forEach(f=>{work[f.path]=f;fixed.add(f.path)});mergePF(fx);
      remaining=staticCheck(PF,Object.keys(work));if(!remaining.length)break}
    let shown=ans;
    if(fixed.size){shown=ans.replace(new RegExp(FENCE.source,'g'),(a,x,i,c)=>{const f=parseFence(i,c);return f.path&&fixed.has(f.path)?'```'+(work[f.path].lang||'')+' path='+f.path+'\n'+work[f.path].code+'\n```':a})}
    let sum='\n\n**Проверка кода.** ';
    if(fixed.size)sum+='Нашёл и исправил: '+[...fixed].join(', ')+'.'+(probs?'\n'+probs:'');
    else sum+='Автоматическая проверка и ревью пройдены, замечаний нет.';
    if(remaining.length)sum+='\nОстались замечания: '+remaining.map(i=>i.path+' — '+i.msg).join('; ')+'.';
    const n=Object.keys(PF).length;
    pr.done();
    chat.push({role:'user',content:text},{role:'assistant',content:compact(shown)});chat=chat.slice(-12);write('jarvis_chat',chat);
    say(shown+sum,'ru-RU','Готово. Файлов в проекте: '+n+'. '+(fixed.size?'Нашёл и исправил ошибки при проверке.':'Код проверен.')+(remaining.length?' Есть замечания, смотрите на экране.':'')+(opt.autoZip?' Архив собран.':''));
    attachCard();
    if(opt.autoZip)await zipProject(true);
  }catch(e){pr.done();say('Не удалось выполнить запрос: '+e.message)}
  finally{busy=false;idle()}}

/* ---------- обычный ИИ-ответ (теперь с форматированием) ---------- */
const STYLE={formal:'спокойно, умно и лаконично, с лёгкой иронией',friendly:'дружелюбно и остроумно',hraz:'как ХРАЗ, дерзкая, самоуверенная и остроумная говорящая перчатка с искусственным интеллектом из Atomic Heart: ироничные подколки, чёрный юмор, советский колорит и немного высокомерия, но всегда по делу, без мата и без оскорблений',tactical:'максимально кратко'};
ai=async function(text){
  if(!P.list.some(p=>p.key)){say('Подключите нейросеть: нажмите на кнопку ИИ вверху и добавьте API-ключ.');return}
  state('ДУМАЮ…','ОБРАБОТКА ЗАПРОСА');
  const sys=`Ты ${settings.personality==='hraz'?'ХРАЗ':botN()} — голосовой ассистент на телефоне. Отвечай по-русски ${STYLE[settings.personality]||STYLE.formal}. На обычные вопросы отвечай коротко, 1–3 предложения, простым текстом без символов разметки. Если просят таблицу, сравнение, список, инструкцию или код — оформляй markdown: таблицы через |, списки, **выделение**, блоки кода. Обращайся к пользователю: «${settings.ownerName||'сэр'}». Сейчас ${new Date().toLocaleString('ru-RU')}. Заметки пользователя: ${notes.join('; ')||'нет'}.`;
  chat.push({role:'user',content:text});chat=chat.slice(-12);
  try{const a=await ask([{role:'system',content:sys},...chat],1500);chat.push({role:'assistant',content:a});write('jarvis_chat',chat);const fs=extractFiles(a);if(fs.length)mergePF(fs);say(a)}
  catch(e){chat.pop();say('Не удалось связаться с ИИ: '+e.message)}};

/* ---------- маршрутизация команд ---------- */
const PACK=/(запакуй|упакуй|запаковать|упаковать|заархивируй|архивируй)/,ZIPW=/(zip|зип|архив)/,BUILD=/(сделай|создай|напиши|построй|разработай|сгенерируй|собери)\s/,SOFT=/(приложени|сайт|игр[уаы]|скрипт|программ|бот[аы]?\b|калькулятор|страниц|проект|код\b|апк|api|интерфейс|лендинг)/;
function setCode(on,silent){settings.codeMode=!!on;write('jarvis_settings',settings);document.body.classList.toggle('codemode',!!on);const c=$('codeChip');if(c)c.classList.toggle('on',!!on);refreshDrawer();if(!silent)say(on?'Режим «Код» включён. Опишите, что нужно создать. Я напишу, проверю и могу запаковать в ZIP.':'Режим «Код» выключен.')}
const _hc=handleCommand;
handleCommand=function(raw){
  const c=String(raw||'').trim();if(!c)return;
  const s=c.toLowerCase().replace(/[!?.,;:]/g,' ').replace(/\s+/g,' ').trim();
  const user=()=>{log('user',c,'user');$('textCommand').value='';autosize()};
  if(/^(включи |открой )?режим (кода|код|программирования|программиста)$/.test(s)){user();return setCode(true)}
  if(/^((выключи|отключи) режим (кода|код|программирования|программиста)|обычный режим)$/.test(s)){user();return setCode(false)}
  const wantPack=PACK.test(s)||(ZIPW.test(s)&&/(скачать|скачай|дай|собери|сделай|создай|отправь|выгрузи)/.test(s));
  if(wantPack){
    user();
    const packOnly=/^(и )?(запакуй|упакуй|заархивируй|архивируй)/.test(s)||/^(сделай|создай|собери|дай|скачай)( мне)? (zip|зип|архив)/.test(s)||(!BUILD.test(s)&&Object.keys(PF).length>0);
    if(packOnly)return zipProject();
    if(BUILD.test(s))return codeAI(c,{autoZip:true});
    return zipProject()}
  if(settings.codeMode&&!/^(стоп|хватит)$/.test(s)){user();return codeAI(c)}
  if(BUILD.test(s)&&SOFT.test(s)){user();return codeAI(c)}
  return _hc(raw)};

/* ---------- диктовка (голос → текст в поле ввода) ---------- */
let dictOn=false,dictT=null;
const fixCase=(old,t)=>{t=t.replace(/\s*\b(запятая)\b/gi,',').replace(/\s*\b(вопросительный знак)\b/gi,'?').replace(/\s*\b(восклицательный знак)\b/gi,'!').replace(/\s*\b(новая строка|новый абзац)\b\s*/gi,'\n');if(!old||/[.!?\n]\s*$/.test(old))t=t.charAt(0).toUpperCase()+t.slice(1);return t};
function dictTick(){if(!dictOn||listening||speaking)return;captureText=t=>{const ta=$('textCommand'),old=ta.value.replace(/[ \t]+$/,'');const add=fixCase(old,t.trim());ta.value=old?(add.startsWith('\n')||/^[,.?!]/.test(add)?old+add:old+' '+add):add;autosize();ta.scrollTop=ta.scrollHeight};listen(true)}
function dictToggle(){
  dictOn=!dictOn;const b=$('dictBtn');b.classList.toggle('rec',dictOn);
  if(dictOn){try{stopAllSpeech()}catch{}speaking=false;$('textCommand').placeholder='Диктуйте… («запятая», «новая строка»). Нажмите ещё раз, чтобы закончить';dictT=setInterval(dictTick,450);dictTick()}
  else{clearInterval(dictT);captureText=null;$('textCommand').placeholder='Сообщение…';if(listening){stopRec();ended()}}}
{const _me=micErr;micErr=function(e){if(dictOn&&/not-allowed/.test(String(e)))dictToggle();return _me(e)};window.onNativeSpeechError=micErr}

/* ---------- чаты и шторка ---------- */
let SS=read('vk_sessions',[]),curId=read('vk_cur','')||('c'+Date.now());
const uid=()=>'c'+Date.now()+Math.floor(Math.random()*1000);
function titleOf(){const u=history.find(x=>x.who==='user')||chat.find(x=>x.role==='user');const t=u?(u.msg||u.content||''):'';return t.replace(/\s+/g,' ').trim().slice(0,44)||'Новый чат'}
function saveCurrent(){
  const has=history.some(x=>x.who==='user')||chat.length;
  SS=SS.filter(s=>s.id!==curId);
  if(has)SS.unshift({id:curId,title:titleOf(),ts:Date.now(),history:history.slice(-60),chat:chat.slice(-12),files:PF,fname:PFname});
  SS=SS.slice(0,30);try{write('vk_sessions',SS)}catch{SS=SS.slice(0,10);write('vk_sessions',SS)}write('vk_cur',curId)}
function loadState(h,c,f,n){history=h||[];chat=c||[];PF=f||{};PFname=n||'';write('jarvis_history',history);write('jarvis_chat',chat);savePF();$('log').replaceChildren();for(const x of history.slice(-40))row(x.who,x.msg,x.who==='user'?'user':x.type);toBottom()}
function newChat(){saveCurrent();curId=uid();write('vk_cur',curId);loadState([],[],{},'');closeDrawer();refreshDrawer()}
function openChat(id){if(id===curId){closeDrawer();return}saveCurrent();const s=SS.find(x=>x.id===id);if(!s)return;curId=id;write('vk_cur',curId);loadState(s.history,s.chat,s.files,s.fname);closeDrawer()}
function delChat(id){SS=SS.filter(s=>s.id!==id);write('vk_sessions',SS);if(id===curId){curId=uid();write('vk_cur',curId);loadState([],[],{},'')}refreshDrawer()}

const SVG={menu:'<path d="M4 7h16M4 12h16M4 17h10"/>',code:'<path d="M8 8l-5 4 5 4M16 8l5 4-5 4M14 5l-4 14"/>',zip:'<path d="M5 3h9l5 5v13H5z"/><path d="M13 3v6h6M10 12h2M10 15h2M10 18h2"/>',dict:'<rect x="9" y="3" width="6" height="10" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M4 20h6M14 20h6"/>',msg:'<path d="M4 5h16v11H9l-5 4z"/>',sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5"/>'};
{const sp=document.querySelector('svg[style*="display:none"]');if(sp)sp.insertAdjacentHTML('beforeend',Object.entries(SVG).map(([k,v])=>'<symbol id="i-'+k+'" viewBox="0 0 24 24">'+v+'</symbol>').join(''))}
const scrim=el('div');scrim.id='scrim';const dr=el('aside');dr.id='drawer';document.body.append(scrim,dr);
function openDrawer(){refreshDrawer();dr.classList.add('on');scrim.classList.add('on')}
function closeDrawer(){dr.classList.remove('on');scrim.classList.remove('on')}
scrim.onclick=closeDrawer;
let dq='';
function item(icon,text,fn,extra){const b=el('button','dr-item');b.type='button';b.insertAdjacentHTML('afterbegin',ic(icon));b.append(el('span','t',text));if(extra)b.append(extra);b.onclick=()=>{closeDrawer();setTimeout(fn,120)};return b}
function refreshDrawer(){
  if(!dr.isConnected)return;
  dr.replaceChildren();
  const top=el('div','dr-top'),mk=el('span','brand-mark',(botN()[0]||'В')),nm=el('b',null,botN().toUpperCase());top.append(mk,nm);
  const nw=el('button','dr-new');nw.type='button';nw.insertAdjacentHTML('afterbegin',ic('plus'));nw.append(el('span',null,'Новый чат'));nw.onclick=newChat;
  const q=el('input','dr-search');q.placeholder='Поиск по чатам';q.value=dq;q.oninput=()=>{dq=q.value;const pos=q.selectionStart;refreshDrawer();const n=dr.querySelector('.dr-search');n.focus();n.setSelectionRange(pos,pos)};
  const sc=el('div','dr-scroll');
  sc.append(el('div','dr-h','ЧАТЫ'));
  saveCurrentSilently();
  const list=SS.filter(s=>!dq||(s.title+' '+(s.history||[]).map(x=>x.msg).join(' ')).toLowerCase().includes(dq.toLowerCase()));
  if(!list.length)sc.append(el('div','hint',dq?'Ничего не найдено':'Пока нет сохранённых чатов'));
  for(const s of list){const b=el('div','dr-item'+(s.id===curId?' act':''));b.insertAdjacentHTML('afterbegin',ic('msg'));const t=el('span','t',s.title);const x=el('button','x');x.type='button';x.insertAdjacentHTML('afterbegin',ic('trash'));x.onclick=e=>{e.stopPropagation();delChat(s.id)};b.append(t,x);b.onclick=()=>openChat(s.id);sc.append(b)}
  sc.append(el('div','dr-h','ИНСТРУМЕНТЫ'));
  const codePill=el('span','pill'+(settings.codeMode?' on':''),settings.codeMode?'вкл':'выкл');
  sc.append(item('cap','Учёба',()=>{$('studyBtn').click()}),
    item('code','Режим «Код»',()=>setCode(!settings.codeMode),codePill),
    item('zip','Скачать проект в ZIP'+(Object.keys(PF).length?' ('+Object.keys(PF).length+')':''),()=>zipProject()),
    item('volume','Голос и озвучка',()=>$('openVoice').click()),
    item('chip','Нейросети и API-ключи',()=>$('provBtn').click()),
    item('pulse','Проверка системы',()=>$('openCheck').click()),
    item('gear','Настройки',()=>$('settingsBtn').click()));
  const ft=el('div','dr-foot'),th=el('div','themes');th.append(el('span',null,'Тема'));
  for(const t of['black','gray','light']){const s=el('button','sw'+((settings.theme||'black')===t?' on':''));s.type='button';s.dataset.t=t;s.setAttribute('aria-label',t);s.onclick=()=>{setTheme(t);refreshDrawer()};th.append(s)}
  ft.append(th);dr.append(top,nw,q,sc,ft)}
function saveCurrentSilently(){/* актуализируем запись текущего чата в списке без перезаписи id */
  const has=history.some(x=>x.who==='user')||chat.length;SS=SS.filter(s=>s.id!==curId);if(has)SS.unshift({id:curId,title:titleOf(),ts:Date.now(),history:history.slice(-60),chat:chat.slice(-12),files:PF,fname:PFname})}
function setTheme(t){settings.theme=t;write('jarvis_settings',settings);document.body.dataset.theme=t;const m=document.querySelector('meta[name=theme-color]');if(m)m.content={black:'#0d0d0e',gray:'#2a2a2d',light:'#f4f4f5'}[t]||'#0d0d0e'}

/* жест: свайп от левого края открывает шторку */
{let x0=null,y0=0,edge=false;
  document.addEventListener('touchstart',e=>{const t=e.touches[0];x0=t.clientX;y0=t.clientY;edge=x0<22},{passive:true});
  document.addEventListener('touchend',e=>{if(x0===null)return;const t=e.changedTouches[0],dx=t.clientX-x0,dy=Math.abs(t.clientY-y0);if(!dr.classList.contains('on')&&edge&&dx>70&&dy<60)openDrawer();else if(dr.classList.contains('on')&&dx<-70&&dy<60)closeDrawer();x0=null},{passive:true})}
addEventListener('visibilitychange',()=>{if(document.hidden)saveCurrent()});addEventListener('pagehide',saveCurrent);

/* ---------- сборка интерфейса ---------- */
{
  const mb=el('button','icon-btn');mb.id='menuBtn';mb.type='button';mb.setAttribute('aria-label','Меню');mb.insertAdjacentHTML('afterbegin',ic('menu'));mb.onclick=openDrawer;
  const brand=document.querySelector('.brand');brand.prepend(mb);const bm=brand.querySelector('.brand-mark');if(bm)bm.style.display='none';
  const bd=el('span','codebadge','КОД');document.querySelector('.status').insertBefore(bd,$('statusText').nextSibling);
  const cc=el('button','chip'+(settings.codeMode?' on':''));cc.id='codeChip';cc.type='button';cc.insertAdjacentHTML('afterbegin',ic('code'));cc.append(el('span',null,'Код'));cc.onclick=()=>setCode(!settings.codeMode);$('studyBtn').after(cc);
  const zc=el('button','chip');zc.type='button';zc.insertAdjacentHTML('afterbegin',ic('zip'));zc.append(el('span',null,'ZIP'));zc.onclick=()=>zipProject();cc.after(zc);
  const db=el('button','tbtn');db.id='dictBtn';db.type='button';db.setAttribute('aria-label','Диктовка');db.insertAdjacentHTML('afterbegin',ic('dict'));db.onclick=dictToggle;$('micBtn').before(db);
  $('vRate').min='0.5';$('vRate').max='2';$('vPitch').min='0.3';$('vPitch').max='2';
  setTheme(settings.theme||'black');document.body.classList.toggle('codemode',!!settings.codeMode);
  if(!read('vk_cur','')){write('vk_cur',curId)}
  // облачный провайдер без личных ключей
  if(CLOUD_URL&&!P.list.some(p=>p.id==='cloud')){P.list.unshift({id:'cloud',name:'Vektor Cloud',base:CLOUD_URL,model:'openai/gpt-oss-120b',key:'vektor',vision:false});if(!P.list.slice(1).some(p=>p.id===P.active&&p.key))P.active='cloud';saveP()}
}
window.VK={files:()=>PF,buildZip,parseFence,extractFiles,staticCheck,plainSpeech,zipProject,codeAI,setCode,newChat};
})();
