// Vektor — вид ответа как в Алисе: шаги «Думаю», сворачиваемый ход мысли, карточка проекта, строка ввода (+, режим, микрофон, отправка/стоп).
(function(){
const $=id=>document.getElementById(id),V=Vektor,ic=n=>'<svg class="ic"><use href="#i-'+n+'"/></svg>';
const el=(t,c,h)=>{const e=document.createElement(t);if(c)e.className=c;if(h!=null)e.innerHTML=h;return e};
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function toast(m){const t=el('div','toast',esc(m));document.body.append(t);setTimeout(()=>t.classList.add('on'),10);setTimeout(()=>{t.classList.remove('on');setTimeout(()=>t.remove(),300)},2600)}
window.toast=toast;
const modeName=()=>(window.MODES&&MODES[V.mode])||'Быстрый';
// ---------- шаги ----------
function stepsHtml(steps){return steps.map(s=>'<li class="step done"><i class="dot"></i><div class="st"><div class="stt">'+esc(s.t)+'</div>'+(s.d?'<div class="std">'+esc(s.d)+'</div>':'')+((s.c||[]).length?'<div class="chips2">'+s.c.map(x=>'<span class="chip2">'+esc(x)+'</span>').join('')+'</div>':'')+'</li>').join('')}
function liveCard(d){const think=el('div','think open','<div class="th"><i class="spin"></i><b>Думаю</b></div><ol class="steps"></ol>'),list=think.querySelector('.steps'),log=[];
  d.prepend(think);
  const api={log,step(t,desc){const li=el('li','step run','<i class="dot"></i><div class="st"><div class="stt"></div><div class="std"></div><div class="chips2"></div></div>'),rec={t,d:desc||'',c:[]};log.push(rec);
      li.querySelector('.stt').textContent=t;li.querySelector('.std').textContent=desc||'';list.append(li);$('main').scrollTop=1e9;
      return{update:x=>{rec.d=x;li.querySelector('.std').textContent=x},done:(x,c)=>{if(x!=null){rec.d=x;li.querySelector('.std').textContent=x}rec.c=c||[];li.classList.remove('run');li.classList.add('done');
        li.querySelector('.chips2').innerHTML=rec.c.map(k=>'<span class="chip2">'+esc(k)+'</span>').join('')},fail:x=>{li.classList.remove('run');li.classList.add('fail');li.querySelector('.std').textContent=x}}},
    collapse(meta){think.remove();d.prepend(header(meta))}};
  d.live=api;return api}
function header(meta){const h=el('div','think'),b=el('button','mhead',ic('atom')+'<span>Ответ в режиме «'+esc(meta.mode||modeName())+'»'+(meta.sec?' · '+meta.sec+' с':'')+'</span>'+ic('chev')),body=el('ol','steps',stepsHtml(meta.steps||[]));
  h.append(b,body);b.onclick=()=>h.classList.toggle('open');if(!(meta.steps||[]).length)b.style.pointerEvents='none';return h}
// ---------- сообщения ----------
window.add=function(role,text,cls,meta){cls=cls||'';$('empty').style.display='none';const d=el('div','msg '+(role==='user'?'u':'a')+(cls?' '+cls:''));
  if(role==='user'){d.innerHTML='<div class="b"></div>';d.firstChild.textContent=text}
  else if(text==null){d.innerHTML='<div class="b"></div>';liveCard(d)}
  else fill(d,text,cls,meta);
  $('msgs').append(d);$('main').scrollTop=1e9;mark();return d};
function fill(d,text,cls,meta){meta=meta&&meta.steps!==undefined||meta&&meta.project?meta:null;d.innerHTML='<div class="b"></div>';
  if(meta&&meta.steps&&meta.steps.length)d.prepend(header(meta));
  const b=d.querySelector('.b');if(cls==='err'){b.textContent=text;const r=el('button','retry',ic('refresh')+'Повторить');r.onclick=()=>regen();d.append(r);return}
  b.innerHTML=md(text);if(meta&&meta.project)d.append(projCard(meta.project));window.actions(d,text)}
const pk=id=>'vk_proj_'+id;
function saveProj(p){try{const keys=Object.keys(localStorage).filter(k=>k.startsWith('vk_proj_')).sort();while(keys.length>=6)localStorage.removeItem(keys.shift());localStorage.setItem(pk(p.id),JSON.stringify(p.files))}catch{toast('Не хватило места в браузере: ZIP скачайте сразу')}}
const loadProj=id=>{try{return JSON.parse(localStorage.getItem(pk(id)))}catch{return null}};
function dl(blob,name){const a=document.createElement('a'),u=URL.createObjectURL(blob);a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),3000)}
function projCard(p){const files=window.__live&&window.__live[p.id]||loadProj(p.id),c=el('div','proj');
  c.innerHTML='<div class="pt">'+ic('zip')+'<div><b>'+esc(p.title)+'</b><span>'+p.count+' файлов · '+fmtKb(p.total)+'</span></div></div><div class="pf"></div><div class="pb"></div>';
  const pf=c.querySelector('.pf');(p.list||[]).forEach(f=>pf.append(el('div','fr','<span>'+esc(f.path)+'</span><em>'+fmtKb(f.bytes)+'</em>')));
  const pb=c.querySelector('.pb'),btn=(i,l,f,cls)=>{const b=el('button',cls||'',ic(i)+l);b.onclick=f;pb.append(b)};
  if(!files){pb.innerHTML='<span class="mu">Файлы проекта удалены из памяти браузера — соберите проект заново.</span>';return c}
  btn('zip','Скачать ZIP · '+fmtKb(p.total),()=>dl(projectZip(files),p.name+'.zip'),'primary');
  if(previewDoc(files))btn('play','Запустить',()=>vkPreview(previewDoc(files)));
  btn('file','Файлы',()=>c.classList.toggle('show'));return c}
window.vkPreview=html=>{const o=el('div','pv','<div class="pvt"><b>Предпросмотр</b><button class="ib" aria-label="Закрыть">'+ic('x')+'</button></div><iframe sandbox="allow-scripts allow-forms allow-modals allow-pointer-lock"></iframe>');
  o.querySelector('iframe').srcdoc=html;o.querySelector('button').onclick=()=>o.remove();document.body.append(o)};
function mark(){const all=[...document.querySelectorAll('#msgs .msg.a .rg')];all.slice(0,-1).forEach(b=>b.remove())}
// ---------- отправка ----------
let ctrl=null;
const BUILD=/(созда|сдела|напиш|разработ|собер|сгенер)\S*[^.!?\n]{0,70}(проект|игр|приложен|сайт|бот|программ|скрипт|утилит|лендинг|калькулятор|сервис|расширени)/i;
window.regen=()=>{if(busy)return;const msgs=[...document.querySelectorAll('#msgs .msg')];const lastU=[...chat].reverse().find(m=>m.r==='u');if(!lastU)return;
  const n=chat.length&&chat[chat.length-1].r==='a'?2:1;chat.splice(-n);msgs.slice(-2).forEach(m=>m.remove());window.save();send(lastU.t)};
window.send=async function(t,opt){opt=opt||{};t=(t||$('in').value).trim();const files=attached.slice();if(!t&&!files.length||busy)return;
  const ctx=files.map(f=>'\n\n[Файл: '+f.name+'; тип: '+f.type+'; размер: '+f.size+' байт]'+(f.content!==null?'\nСодержимое:\n'+f.content:'\nСодержимое не извлечено; доступна только информация о файле.')).join('');
  busy=true;ctrl=new AbortController();attached=[];$('files-list').innerHTML='';$('in').value='';$('in').placeholder='Спросите о чём угодно';grow();setGo();
  add('user',t+(files.length?'\nФайлы: '+files.map(f=>f.name).join(', '):''));const w=add('a',null),L=w.live,t0=performance.now(),sec=()=>((performance.now()-t0)/1000).toFixed(1);
  try{
    const build=opt.build||(vkAct().type==='code'&&!files.length&&BUILD.test(t)?(opt.size||'big'):null);
    const s1=L.step('Читаю запрос',build?'Это задача на создание проекта — собираю его файл за файлом':vkAct().type==='code'?'Задача по коду — подключаю инженерный режим':vkAct().type==='study'?'Подбираю объяснение под учёбу':files.length?'Разбираю прикреплённые файлы ('+files.length+')':'Определяю, что нужно сделать');s1.done();
    if(build){const r=await buildProject(t+ctx,build,L,ctrl.signal);const id=Date.now().toString(36);window.__live=window.__live||{};window.__live[id]=r.files;
      const p={id,name:r.name,title:r.title,total:r.total,count:r.files.length,list:r.files.map(f=>({path:f.path,bytes:f.bytes}))};saveProj({id,files:r.files});
      const text='Проект **'+r.title+'** готов. '+(r.summary||'')+(r.run?'\n\n**Как запустить:** '+r.run:'')+(r.warns.length?'\n\n**Что проверить:** '+r.warns.join('; '):'');
      const meta={mode:'Проект',sec:sec(),steps:L.log,project:p};w.live=null;fill(w,text,'',meta);chat.push({r:'u',t},{r:'a',t:text,meta});window.save();return}
    const s2=L.step('Смотрю в памяти','Ищу, что я помню по теме');let rec=[];try{rec=await V.recall(t,3)}catch{}
    s2.done(rec.length?'Нашёл связанных записей: '+rec.length:'Ничего подходящего',rec.map(x=>String(x.text).slice(0,26)));
    const s3=L.step('Выбираю бесплатную модель и пишу ответ','Отправляю запрос…');
    const r=await V.chat(t+ctx,null,{signal:ctrl.signal});s3.done((r.provider?r.provider+' · ':'')+sec()+' с',r.provider?[r.provider+(r.model?' · '+String(r.model).split('/').pop():'')]:[]);
    const meta={mode:modeName(),sec:sec(),steps:L.log};fill(w,r.reply,'',meta);chat.push({r:'u',t},{r:'a',t:r.reply,meta});window.save();
  }catch(e){const stopped=e&&e.name==='AbortError';w.remove();add('a',stopped?'Остановлено.':e.message,stopped?'':'err');if(stopped)chat.push({r:'u',t})}
  busy=false;ctrl=null;setGo();mark()};
// ---------- строка ввода ----------
const stop=()=>{ctrl&&ctrl.abort()};
window.setGo=()=>{const g=$('go'),has=$('in').value.trim()||(window.attached&&attached.length);g.classList.toggle('send',!!has&&!busy);g.classList.toggle('stopb',!!busy);
  g.innerHTML=ic(busy?'stop':'up');g.disabled=!has&&!busy;g.setAttribute('aria-label',busy?'Остановить':'Отправить')};
$('go').onclick=()=>{if(busy)stop();else send()};
$('in').addEventListener('input',setGo);$('filepick').addEventListener('change',()=>setTimeout(setGo,700));
// меню «+»
const menu=el('div','pmenu');menu.hidden=true;document.body.append(menu);
const items=[['clip','Прикрепить файл',()=>$('filepick').click()],['zip','Создать проект (ZIP)',()=>open('proj')],['wave','Голосовой режим',()=>VektorVoice.open()],['file','Экспорт чата (.md)',()=>exportChat()]];
items.forEach(([i,l,f])=>{const b=el('button','',ic(i)+l);b.onclick=()=>{menu.hidden=true;f()};menu.append(b)});
$('attach').onclick=e=>{e.stopPropagation();menu.hidden=!menu.hidden};document.addEventListener('click',e=>{if(!menu.contains(e.target))menu.hidden=true});
function exportChat(){if(!chat.length)return toast('Чат пуст');const md=chat.map(m=>(m.r==='u'?'## Вы\n':'## Вектор\n')+m.t).join('\n\n');dl(new Blob([md],{type:'text/markdown'}),'vektor-chat-'+new Date().toISOString().slice(0,10)+'.md')}
window.exportChat=exportChat;
// диктовка: речь браузера, при сбое — запись + Whisper
let dic=null;const mic=el('button','toolbtn');mic.id='mic';mic.type='button';mic.setAttribute('aria-label','Диктовка');mic.innerHTML=ic('mic');
function micOff(){mic.classList.remove('rec');dic=null}
async function dictRec(){let stream;try{stream=await navigator.mediaDevices.getUserMedia({audio:true})}catch{micOff();return toast('Разрешите доступ к микрофону в настройках браузера')}
  const ac=new(window.AudioContext||window.webkitAudioContext)(),an=ac.createAnalyser();an.fftSize=512;ac.createMediaStreamSource(stream).connect(an);const mr=new MediaRecorder(stream),ch=[],buf=new Uint8Array(512),t0=Date.now();let spoke=false,last=t0,fin=false,floor=0,nf=0;
  mr.ondataavailable=e=>e.data.size&&ch.push(e.data);const end=()=>{if(!fin){fin=true;mr.state!=='inactive'&&mr.stop()}};dic={stop:end};
  const tick=()=>{if(fin)return;an.getByteTimeDomainData(buf);let s=0;for(const v of buf)s+=(v-128)**2;const l=Math.sqrt(s/512)/128,n=Date.now();if(n-t0<500){floor+=l;nf++}
    const thr=Math.min(.06,Math.max(.015,Math.min(.03,floor/Math.max(nf,1))*2.5+.008));if(n-t0>=500&&l>thr){spoke=true;last=n}if((spoke&&n-last>1500)||(!spoke&&n-t0>8000)||n-t0>45000)end();else requestAnimationFrame(tick)};
  mr.onstop=async()=>{stream.getTracks().forEach(t=>t.stop());ac.close();micOff();if(!spoke)return toast('Не услышал речь');$('in').placeholder='Распознаю…';
    try{const x=await V.stt(new Blob(ch,{type:mr.mimeType}));if(x){$('in').value=($('in').value?$('in').value+' ':'')+x;grow();setGo()}}catch(e){toast(e.message)}$('in').placeholder='Спросите о чём угодно'};mr.start();tick()}
mic.onclick=()=>{if(dic){dic.stop();return}mic.classList.add('rec');const SR=window.SpeechRecognition||window.webkitSpeechRecognition;if(!SR||window.__srBad)return dictRec();
  const r=new SR();r.lang='ru-RU';r.interimResults=true;r.continuous=false;const base=$('in').value;let up=false;r.onaudiostart=()=>up=true;
  r.onresult=e=>{let x='';for(const k of e.results)x+=k[0].transcript;$('in').value=(base?base+' ':'')+x;grow();setGo()};
  r.onerror=e=>{if(e.error==='not-allowed'){micOff();toast('Разрешите доступ к микрофону в настройках браузера')}else if(e.error!=='no-speech'&&e.error!=='aborted'){window.__srBad=true;micOff();mic.classList.add('rec');dictRec()}};
  r.onend=()=>{if(dic&&dic.sr===r)micOff()};dic={sr:r,stop:()=>{try{r.stop()}catch{}}};
  setTimeout(()=>{if(!up&&dic&&dic.sr===r){window.__srBad=true;try{r.abort()}catch{}micOff();mic.classList.add('rec');dictRec()}},4000);try{r.start()}catch{micOff();toast('Не удалось включить микрофон')}};
// панель «Создать проект»
const tp=el('template');tp.id='t-proj';tp.innerHTML='<p class="mu">Опишите, что создать. Вектор составит план и напишет каждый файл отдельным запросом к бесплатной модели, проверит код и соберёт ZIP.</p><textarea class="f" id="ptask" rows="4" placeholder="Например: пиксельная игра-кликер с деревом навыков, сохранением и магазином улучшений"></textarea><div class="sizes" id="psz"></div><p class="mu" id="phint"></p><button class="btn" id="prun">Собрать проект</button>';document.body.append(tp);
TT.proj='Создать проект';let psize='big';
const SZ={small:['Малый','~20 КБ · 1–2 мин'],mid:['Средний','~40 КБ · 2–3 мин'],big:['Большой','50–70 КБ · 3–5 мин']};
PN.proj=()=>{$('psz').innerHTML=Object.entries(SZ).map(([k,v])=>'<button type="button" class="szb'+(k===psize?' on':'')+'" data-k="'+k+'"><b>'+v[0]+'</b><span>'+v[1]+'</span></button>').join('');
  $('psz').querySelectorAll('button').forEach(b=>b.onclick=()=>{psize=b.dataset.k;PN.proj()});$('phint').textContent='Большой проект — около 10–15 запросов к бесплатным моделям: дневной лимит тратится быстрее.';
  $('prun').onclick=()=>{const task=$('ptask').value.trim();if(!task)return toast('Опишите проект');$('shade').click();if(vkAct().type!=='code')document.querySelector('#newrow button:nth-child(2)').click();setTimeout(()=>send(task,{build:psize}),50)}};
// шапка и строка ввода: [+] [Режим: …] ······ [микрофон] [отправить/стоп]
const hd=document.querySelector('header'),pill=$('pill'),box=$('box'),ta=$('in'),go=$('go'),att=$('attach'),fp=$('filepick');
pill.innerHTML='<i id="dot" class="on"></i><span class="pl">Режим:</span> <b id="mname">'+modeName()+'</b>';
const row=el('div','crow');box.innerHTML='';box.append(ta,row,fp);row.append(att,pill,el('span','sp'),mic,go);
const hv=el('button','ib');hv.type='button';hv.setAttribute('aria-label','Голосовой режим');hv.innerHTML=ic('wave');hv.onclick=()=>VektorVoice.open();
const hn=el('button','ib');hn.type='button';hn.setAttribute('aria-label','Новый чат');hn.innerHTML=ic('edit');hn.onclick=()=>document.querySelector('#newrow button:first-child').click();
hd.append(hn,hv);att.innerHTML=ic('plus');att.setAttribute('aria-label','Добавить');
att.onclick=e=>{e.stopPropagation();menu.hidden=!menu.hidden;const r=att.getBoundingClientRect();menu.style.left=Math.max(8,r.left)+'px';menu.style.bottom=(innerHeight-r.top+8)+'px'};
$('in').placeholder='Спросите о чём угодно';setGo();window.vkReload&&vkReload();
})();
