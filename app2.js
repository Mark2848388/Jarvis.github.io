// Vektor — несколько чатов (обычные / VKTR Code / Учёба), действия под ответом, чтение ZIP, диагностика.
(function(){
const $=id=>document.getElementById(id),V=Vektor,ic=n=>'<svg class="ic"><use href="#i-'+n+'"/></svg>';
// ---------- действия под ответом ----------
window.actions=(d,text)=>{const a=document.createElement('div');a.className='act';
  const btn=(n,l,f)=>{const b=document.createElement('button');b.type='button';b.innerHTML=ic(n)+'<span>'+l+'</span>';b.onclick=()=>f(b.lastChild);a.append(b)};
  btn('copy','Копировать',s=>{(navigator.clipboard?navigator.clipboard.writeText(text):Promise.reject()).catch(()=>{});s.textContent='Скопировано';setTimeout(()=>s.textContent='Копировать',1500)});
  btn('share','Поделиться',()=>navigator.share?navigator.share({text}).catch(()=>{}):navigator.clipboard&&navigator.clipboard.writeText(text));
  btn('volume','Озвучить',()=>window.VektorVoice&&VektorVoice.speak(text));
  if(/```[\s\S]*?```/.test(text))btn('zip','ZIP с кодом',()=>zipFrom(text));
  btn('refresh','Ещё раз',()=>window.regen&&regen());a.lastChild.classList.add('rg');
  d.append(a)};
window.setGo=()=>{const g=$('go'),has=$('in').value.trim()||(window.attached&&attached.length);g.classList.toggle('send',!!has);g.disabled=!!has&&busy;g.innerHTML=ic(has?'up':'wave');g.setAttribute('aria-label',has?'Отправить':'Голосовой режим')};
// ---------- чтение ZIP в браузере ----------
const TXT=/\.(txt|md|markdown|csv|tsv|json|xml|html?|css|js|jsx|ts|tsx|py|java|kt|kts|cpp|c|h|hpp|cs|go|rs|php|sql|sh|bat|yaml|yml|toml|ini|log|gradle|properties|cmake|svg)$/i;
window.readZip=async f=>{const buf=new Uint8Array(await f.arrayBuffer()),dv=new DataView(buf.buffer);let e=buf.length-22;while(e>=0&&dv.getUint32(e,true)!==0x06054b50)e--;if(e<0)throw new Error('это не ZIP');
  const n=dv.getUint16(e+10,true);let p=dv.getUint32(e+16,true);const out=[],names=[],dec=new TextDecoder();
  for(let i=0;i<n;i++){if(dv.getUint32(p,true)!==0x02014b50)break;const meth=dv.getUint16(p+10,true),csz=dv.getUint32(p+20,true),usz=dv.getUint32(p+24,true),nl=dv.getUint16(p+28,true),el=dv.getUint16(p+30,true),cl=dv.getUint16(p+32,true),off=dv.getUint32(p+42,true);
    const name=dec.decode(buf.subarray(p+46,p+46+nl));p+=46+nl+el+cl;if(name.endsWith('/'))continue;names.push(name+' ('+usz+' Б)');
    if(!TXT.test(name)||usz>150000||out.length>=25)continue;const start=off+30+dv.getUint16(off+26,true)+dv.getUint16(off+28,true),data=buf.subarray(start,start+csz);let t;
    if(meth===0)t=dec.decode(data);else if(meth===8&&window.DecompressionStream)t=await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).text();else continue;
    out.push('--- '+name+' ---\n'+t.slice(0,20000))}
  return 'Архив '+f.name+', файлов: '+n+'\nСтруктура:\n'+names.slice(0,120).join('\n')+'\n\nСодержимое текстовых файлов:\n'+out.join('\n\n').slice(0,60000)};
// ---------- несколько чатов ----------
const K='vk_chats',AK='vk_active',uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,5);
let store;try{store=JSON.parse(localStorage.getItem(K)||'[]')}catch{store=[]}
if(!store.length){let old=[];try{old=JSON.parse(localStorage.getItem('vk_chat')||'[]')}catch{}store=[{id:uid(),title:old.length?'Прежний чат':'Новый чат',type:'chat',ts:Date.now(),msgs:old}]}
let act=store.find(c=>c.id===localStorage.getItem(AK))||store[0];
const persist=()=>{try{localStorage.setItem(K,JSON.stringify(store.slice(0,60)));localStorage.setItem(AK,act.id)}catch{}};
const TYPE={chat:{h:'Чем помочь?',p:'Я Вектор. Помню важное и помогаю с задачами.',c:['Запомни: я люблю кофе без сахара','Объясни, как работает память ИИ','Придумай идею для приложения'],ic:'chat'},
 code:{h:'VKTR Code',p:'План → код → самопроверка. Готовый код можно скачать в ZIP.',c:['Создай проект: пиксельная игра-кликер с деревом навыков','Создай проект: сайт-визитка с формой и анимациями','Напиши на Python скрипт, который сортирует файлы по дате','Найди ошибки в моём коде и исправь'],ic:'code',tag:'Code',mode:'code'},
 study:{h:'Учёба',p:'Объясню тему, составлю план, проверю знания тестом.',c:['Объясни тему простыми словами','Составь план изучения на неделю','Проверь меня тестом из 5 вопросов','Сделай карточки для запоминания'],ic:'book2',tag:'Учёба',mode:'study'}};
function applyMode(){const t=TYPE[act.type];if(t.mode){if(V.tmpNormal==null)V.tmpNormal=V.mode;V.mode=t.mode}else if(V.tmpNormal!=null){V.mode=V.tmpNormal;V.tmpNormal=null}
  if(window.MODES)$('mname').textContent=MODES[V.mode]||$('mname').textContent}
function empty(){const t=TYPE[act.type],e=$('empty');e.querySelector('h2').textContent=t.h;e.querySelector('p').innerHTML=t.p+'<br><span style="font-size:13px">BETA-версия: возможны ошибки</span>';
  const c=e.querySelector('.chips');c.innerHTML='';t.c.forEach(x=>{const b=document.createElement('button');b.type='button';b.textContent=x;b.onclick=()=>send(x);c.append(b)});e.style.display=chat.length?'none':''}
function load(c){act=c;chat=c.msgs.slice();$('msgs').innerHTML='';chat.forEach(m=>add(m.r==='u'?'user':'a',m.t,'',m.meta||null));applyMode();empty();persist();list();$('main').scrollTop=1e9}
function list(){const q=$('csearch').value.trim().toLowerCase(),L=$('clist');L.innerHTML='';
  store.slice().sort((a,b)=>b.ts-a.ts).filter(c=>!q||c.title.toLowerCase().includes(q)||c.msgs.some(m=>m.t&&m.t.toLowerCase().includes(q))).forEach(c=>{const t=TYPE[c.type],r=document.createElement('div');r.className='ci'+(c===act?' on':'');
    r.innerHTML=ic(t.ic)+'<span class="t"></span>'+(t.tag?'<em>'+t.tag+'</em>':'')+'<button type="button" aria-label="Удалить">'+ic('trash')+'</button>';r.querySelector('.t').textContent=c.title;
    r.onclick=e=>{if(e.target.closest('button')){if(confirm('Удалить чат «'+c.title+'»?'))del(c);return}load(c);dr(false)};L.append(r)})}
function del(c){store=store.filter(x=>x!==c);if(!store.length)store.push({id:uid(),title:'Новый чат',type:'chat',ts:Date.now(),msgs:[]});if(act===c)load(store[0]);else{persist();list()}}
function fresh(type){if(act&&!act.msgs.length&&!chat.length&&act.type===type){dr(false);return}const c={id:uid(),title:'Новый чат',type,ts:Date.now(),msgs:[]};store.unshift(c);load(c);dr(false)}
window.save=function(){act.msgs=chat.slice(-100);act.ts=Date.now();if(!act.title||act.title==='Новый чат'||act.title==='Прежний чат'){const u=chat.find(m=>m.r==='u');if(u)act.title=u.t.replace(/\s+/g,' ').trim().slice(0,38)||act.title}persist();list()};
const nr=$('newrow');[['plus','Чат','chat'],['code','Code','code'],['book2','Учёба','study']].forEach(([i,l,t])=>{const b=document.createElement('button');b.type='button';b.innerHTML=ic(i)+l;b.onclick=()=>fresh(t);nr.append(b)});
$('csearch').oninput=list;
// ---------- диагностика (5 касаний по названию в шторке) ----------
const tp=document.createElement('template');tp.id='t-diag';tp.innerHTML='<pre class="o" id="dgo">Проверка…</pre><p class="mu">Адрес облака (Cloudflare Worker)</p><input class="f" id="dcb" placeholder="https://….workers.dev/v1"><button class="btn" id="dcs">Сохранить и проверить</button>';document.body.append(tp);
TT.diag='О системе';
PN.diag=()=>{const c=JSON.parse(localStorage.getItem('vk_cloud')||'{}');$('dcb').value=c.base||window.VEKTOR_CLOUD||'';
  const run=async()=>{const o=[],p=await V.call('ping').catch(e=>({core:'ошибка: '+e.message}));
    o.push('Движок: '+({js:'встроенный JS (без Python и C++)',server:'Python-сервер',android:'Android (Python)'}[V.engine]||V.engine),'Ядро: '+p.core,'C++: '+(p.native?'работает':'не подключено'),'Python-модули: '+((p.plugins||[]).join(', ')||'нет'));
    const base=$('dcb').value.trim().replace(/\/v1\/?$/,'');try{const r=await fetch(base,{cache:'no-store'});o.push('Облако: '+JSON.stringify(await r.json()))}catch{o.push('Облако: нет связи или адрес не задан')}
    const SR=window.SpeechRecognition||window.webkitSpeechRecognition,vs=window.speechSynthesis?speechSynthesis.getVoices().filter(v=>/^ru/i.test(v.lang)):[];
    o.push('Распознавание речи в браузере: '+(SR?'есть':'нет (будет Whisper)'),'Русских голосов на устройстве: '+vs.length+(vs.some(v=>/pavel|dmitr|yuri|maxim|male|мужск/i.test(v.name))?' (есть мужской)':''));$('dgo').textContent=o.join('\n')};
  $('dcs').onclick=()=>V.setCloud($('dcb').value.trim(),c.model||'openai/gpt-oss-120b',[]).then(run);run()};
load(act);window.vkReload=()=>load(act);window.vkAct=()=>act;
})();
