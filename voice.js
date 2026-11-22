// Vektor — голосовой режим (отдельный экран, как в ChatGPT). Бесплатно: распознавание — Web Speech API,
// а если он недоступен (Яндекс.Браузер, WebView) — запись с микрофона + Whisper в вашем Cloudflare Worker (/stt).
// Озвучка — голоса устройства (speechSynthesis). Разговор сохраняется в обычный чат.
(function(){
const V=window.Vektor,SR=window.SpeechRecognition||window.webkitSpeechRecognition,$=i=>document.getElementById(i);
const cfg=Object.assign({rate:1,pitch:1,voice:'',male:true,loop:true,engine:'edge:ru-RU-DmitryNeural'},JSON.parse(localStorage.getItem('vk_voice')||'{}'));
const MALE=/pavel|павел|dmitr|дмитр|yuri|юри|maxim|максим|nikola|никола|artem|артём|artyom|ivan|иван|aleks|алекс|serg|серг|male|мужск/i;
const ST={idle:'Нажмите на шар, чтобы говорить',listening:'Слушаю…',thinking:'Думаю…',speaking:'Говорю · нажмите, чтобы перебить',error:''};
let tts=null,pfail=false,au=null;let on=false,state='idle',gen=0,useRec=!SR,stopL=null,wake=null,demo=null;
const css=document.createElement('style');css.textContent=`
#vo{position:fixed;inset:0;z-index:20;background:radial-gradient(120% 80% at 50% 30%,#34312c,#161614);display:none;flex-direction:column;align-items:center;color:var(--tx);padding:calc(env(safe-area-inset-top) + 10px) 16px calc(env(safe-area-inset-bottom) + 18px)}
#vo.on{display:flex}#vo .top{width:100%;display:flex;align-items:center;gap:8px}#vo .top b{flex:1;font:600 17px Georgia,serif}
#orbw{flex:1;display:grid;place-items:center;width:100%}#orb{width:min(58vw,240px);aspect-ratio:1;border-radius:50%;border:0;position:relative;background:radial-gradient(circle at 35% 30%,#f2a587,#d97757 45%,#8c3d24);box-shadow:0 0 60px #d9775566;transition:transform .15s,filter .3s;--lvl:0;transform:scale(calc(1 + var(--lvl)*.25))}
#orb::before,#orb::after{content:"";position:absolute;inset:-14px;border-radius:50%;border:2px solid #d9775555;opacity:0}
#vo[data-s=idle] #orb{animation:br 4s ease-in-out infinite;filter:saturate(.5)}
#vo[data-s=listening] #orb::before{animation:rp 1.6s ease-out infinite}#vo[data-s=listening] #orb::after{animation:rp 1.6s .8s ease-out infinite}
#vo[data-s=thinking] #orb{animation:sp 1.4s linear infinite;background:conic-gradient(from 0deg,#d97757,#f2a587,#7a7468,#d97757);filter:blur(1px)}
#vo[data-s=speaking] #orb{animation:sw .7s ease-in-out infinite}#vo[data-s=error] #orb{filter:grayscale(1)}
@keyframes br{50%{transform:scale(1.05)}}@keyframes rp{from{opacity:.9;transform:scale(.9)}to{opacity:0;transform:scale(1.55)}}@keyframes sp{to{transform:rotate(360deg)}}@keyframes sw{0%,100%{transform:scale(.97)}50%{transform:scale(1.09)}}
#vs{font:600 18px Georgia,serif;text-align:center;min-height:26px}#vt{color:var(--mu);text-align:center;min-height:44px;max-height:20vh;overflow:auto;font-size:15px;margin:6px 0;max-width:640px}#vc{font:19px/1.5 Georgia,serif;text-align:center;min-height:58px;max-width:640px;max-height:24vh;overflow:auto}
#vo .bar{display:flex;gap:14px;margin-top:10px}#vo .bar button{width:58px;height:58px;border-radius:50%;background:#ffffff14;border:1px solid #ffffff22;display:grid;place-items:center;color:var(--tx)}#vo .bar button .ic{width:24px;height:24px}#vo .bar #vend{background:#c9453a;border-color:#c9453a;color:#fff}#vo .bar button.act{background:var(--ac);border-color:var(--ac)}
#vset{display:none;width:100%;max-width:520px;background:var(--panel);border:1px solid var(--bd);border-radius:16px;padding:12px;margin-top:10px;font-size:14px}#vset.on{display:block}#vset label{display:block;margin:8px 0 2px;color:var(--mu)}#vset select,#vset input[type=range]{width:100%}#vset input{accent-color:var(--ac)}#orbw{margin-top:18px}#vset select{background:var(--card);border:1px solid var(--bd);border-radius:10px;padding:8px;color:var(--tx)}`;
document.head.append(css);
const vo=document.createElement('div');vo.id='vo';vo.innerHTML=`<div class="top"><button class="ib" id="vx" aria-label="Закрыть"><svg class="ic"><use href="#i-x"/></svg></button><b>Голос <span class="beta">BETA</span></b><button class="ib" id="vg" aria-label="Настройки"><svg class="ic"><use href="#i-sliders"/></svg></button></div>
<div id="vset"><label>Голос ассистента</label><select id="veng"><option value="edge:ru-RU-DmitryNeural">Дмитрий ♂ · нейроголос (бесплатно, через ваш Worker)</option><option value="edge:ru-RU-SvetlanaNeural">Светлана ♀ · нейроголос</option><option value="gtts">Google ♀ · быстрый тест без Worker</option><option value="piper:ru_RU-dmitri-medium">Piper Дмитрий ♂ · офлайн (тест, ~60 МБ)</option><option value="piper:ru_RU-denis-medium">Piper Денис ♂ · офлайн (тест)</option><option value="device">Голос устройства</option></select><label>Голос устройства</label><select id="vsel"></select><label>Скорость: <span id="vrv"></span></label><input type="range" id="vr" min=".7" max="1.5" step=".05">
<label>Тембр: <span id="vpv"></span></label><input type="range" id="vp" min=".6" max="1.3" step=".05"><label><input type="checkbox" id="vm"> Мужской тембр (если нет мужского голоса — тон понижается)</label>
<label><input type="checkbox" id="vl"> Слушать снова после ответа (без рук)</label><button class="btn g" id="vtest" style="margin-top:8px">Проверить голос</button></div>
<div id="orbw"><button id="orb" aria-label="Говорить"></button></div><div id="vs"></div><div id="vt"></div><div id="vc"></div>
<div class="bar"><button id="vmute" aria-label="Пауза / продолжить"><svg class="ic"><use href="#i-mic"/></svg></button><button id="vend" aria-label="Завершить"><svg class="ic"><use href="#i-x"/></svg></button></div>`;
document.body.append(vo);
const save=()=>localStorage.setItem('vk_voice',JSON.stringify(cfg));
function set(s,msg){state=s;vo.dataset.s=s;$('vs').textContent=msg??ST[s];$('vmute').classList.toggle('act',s==='listening')}
// ---------- голоса ----------
const voices=()=>speechSynthesis.getVoices().filter(v=>/^ru/i.test(v.lang));
const pick=()=>{const l=voices();return l.find(v=>v.name===cfg.voice)||l.find(v=>MALE.test(v.name))||l[0]||null};
function fill(){const l=voices();$('vsel').innerHTML='<option value="">Авто (мужской, если есть)</option>'+l.map(v=>`<option value="${v.name}">${MALE.test(v.name)?'♂ ':''}${v.name}</option>`).join('');$('vsel').value=cfg.voice;
  $('vr').value=cfg.rate;$('vp').value=cfg.pitch;$('vm').checked=cfg.male;$('vl').checked=cfg.loop;$('vrv').textContent=cfg.rate+'×';$('vpv').textContent=cfg.pitch}
speechSynthesis.onvoiceschanged=fill;fill();$('veng').value=cfg.engine||'device';$('veng').onchange=e=>{cfg.engine=e.target.value;Object.keys(bad).forEach(k=>delete bad[k]);save()};
// ---------- озвучка по предложениям ----------
const clean=t=>t.replace(/```[\s\S]*?```/g,' Код смотрите в чате. ').replace(/`([^`]*)`/g,'$1').replace(/\[([^\]]+)\]\([^)]+\)/g,'$1').replace(/https?:\/\/\S+/g,'ссылка').replace(/[*_#>|~]+/g,' ').replace(/\s+/g,' ').trim();
const parts=t=>(clean(t).match(/[^.!?…]+[.!?…]*/g)||[]).map(s=>s.trim()).filter(Boolean);
const PIPER=['https://esm.sh/@diffusionstudio/vits-web@1.0.3','https://cdn.jsdelivr.net/npm/@diffusionstudio/vits-web@1.0.3/+esm'];
async function loadPiper(id){if(!tts){let er;for(const u of PIPER){try{tts=await import(u);break}catch(e){er=e}}if(!tts)throw er||new Error('модуль не загрузился')}
  const have=(await (tts.stored?tts.stored():[]).catch?.(()=>[]))||[];if(!have.includes(id))await tts.download(id,p=>set('thinking','Загрузка голоса '+Math.round(p.loaded*100/(p.total||1))+'%'));return tts}
const bad={};
const srcOf={
 edge:async(s,v)=>{const base=V.cloudBase();if(!base)throw new Error('нет облака');const r=await fetch(base+'/tts',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({text:s,voice:v||'ru-RU-DmitryNeural',rate:Math.round((cfg.rate-1)*100)})});
   if(!r.ok)throw new Error('сервис '+r.status);const b=await r.blob();if(b.size<500)throw new Error('пустое аудио');return URL.createObjectURL(b)},
 gtts:async s=>'https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=ru&q='+encodeURIComponent(s.slice(0,190)),
 piper:async(s,id)=>{const t=await loadPiper(id);return URL.createObjectURL(await t.predict({text:s,voiceId:id}))}};
async function sayRemote(list,done,kind,arg){const me=++gen;
  try{const parts=kind==='gtts'?list.flatMap(x=>x.match(/.{1,180}(\s|$)/g)||[x]):list;let nx=srcOf[kind](parts[0],arg);
    for(let i=0;i<parts.length;i++){const src=await nx;if(me!==gen)return;if(i===0)set('speaking');if(i+1<parts.length){nx=srcOf[kind](parts[i+1],arg);nx.catch(()=>{})}
      await new Promise((res,rej)=>{au=new Audio(src);au.playbackRate=cfg.rate;au.onended=res;au.onerror=()=>rej(new Error('не воспроизводится'));$('vc').textContent=parts[i];au.play().catch(rej)})}
    done&&done()}
  catch(e){if(me!==gen)return;bad[kind]=true;set('speaking');$('vc').textContent='Этот голос сейчас недоступен ('+String(e.message||e).slice(0,50)+') — включён голос устройства';say(list,done)}}
function say(list,done){const eg=(cfg.engine||'device').split(':'),k=eg[0],arg=eg.slice(1).join(':');
  if(k!=='device'&&!bad[k]&&list.length&&srcOf[k])return sayRemote(list,done,k,arg);
  speechSynthesis.cancel();const me=++gen;let i=0;
  const next=()=>{if(me!==gen)return;if(i>=list.length)return done&&done();const s=list[i++],u=new SpeechSynthesisUtterance(s),v=pick();let fin=false;
    const go=()=>{if(fin)return;fin=true;clearTimeout(wd);next()};u.lang='ru-RU';if(v)u.voice=v;u.rate=cfg.rate;u.pitch=cfg.pitch*(cfg.male&&!(v&&MALE.test(v.name))?.8:1);
    u.onstart=()=>$('vc').textContent=s;u.onend=go;u.onerror=go;const wd=setTimeout(go,Math.max(2500,s.length*110/cfg.rate));speechSynthesis.speak(u)};next()}
const stopSay=()=>{gen++;speechSynthesis.cancel();au&&au.pause()};
// ---------- слушание ----------
function listen(){if(!on)return;stopL=null;$('vt').textContent='';set('listening');(useRec?listenRec:listenSR)()}
function listenSR(){let r;try{r=new SR()}catch{useRec=true;return listenRec()}r.lang='ru-RU';r.interimResults=true;r.continuous=false;let txt='',bad=false;
  r.onresult=e=>{txt='';for(const x of e.results)txt+=x[0].transcript;$('vt').textContent=txt};
  r.onerror=e=>{if(e.error==='not-allowed'||e.error==='service-not-allowed'){bad=true;set('error','Нет доступа к микрофону. Разрешите его в настройках браузера.')}
    else if(e.error==='network'||e.error==='audio-capture'||e.error==='language-not-supported'){bad=true;useRec=true;if(on)listenRec()}};
  r.onend=()=>{if(bad||!on||state!=='listening')return;const t=txt.trim();t?ask(t):cfg.loop?setTimeout(listen,300):set('idle')};
  let up=false;r.onaudiostart=()=>up=true;stopL=()=>{try{r.stop()}catch{}};
  setTimeout(()=>{if(!up&&on&&state==='listening'&&!bad){bad=true;useRec=true;try{r.abort()}catch{}listenRec()}},4000); // браузер «умеет», но не слышит → запись + Whisper
  try{r.start()}catch{set('error','Не удалось включить микрофон')}}
async function listenRec(){let stream;try{stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true}})}catch{return set('error','Нет доступа к микрофону. Разрешите его в настройках браузера.')}
  if(!on){stream.getTracks().forEach(t=>t.stop());return}
  const ac=new (window.AudioContext||window.webkitAudioContext)(),an=ac.createAnalyser();an.fftSize=512;ac.createMediaStreamSource(stream).connect(an);
  const mr=new MediaRecorder(stream),ch=[],buf=new Uint8Array(an.fftSize),t0=Date.now();let spoke=false,last=t0,done=false,floor=0,nf=0;mr.ondataavailable=e=>e.data.size&&ch.push(e.data);
  const fin=()=>{if(done)return;done=true;mr.state!=='inactive'&&mr.stop()};stopL=fin;
  const tick=()=>{if(done)return;an.getByteTimeDomainData(buf);let s=0;for(const v of buf)s+=(v-128)**2;const l=Math.sqrt(s/buf.length)/128,n=Date.now();$('orb').style.setProperty('--lvl',Math.min(1,l*7));
    if(n-t0<500){floor+=l;nf++}const thr=Math.min(.06,Math.max(.015,Math.min(.03,floor/Math.max(nf,1))*2.5+.008)); // порог подстраивается под шум комнаты
    if(n-t0>=500&&l>thr){spoke=true;last=n;$('vt').textContent='…'}if((spoke&&n-last>1400)||(!spoke&&n-t0>9000)||n-t0>30000)fin();else requestAnimationFrame(tick)};
  mr.onstop=async()=>{stream.getTracks().forEach(t=>t.stop());ac.close();$('orb').style.setProperty('--lvl',0);if(!on||state!=='listening')return;
    if(!spoke)return cfg.loop?listen():set('idle');set('thinking','Распознаю…');
    try{const t=(await V.stt(new Blob(ch,{type:mr.mimeType}))).trim();t?ask(t):(cfg.loop?listen():set('idle'))}catch(e){set('error',e.message)}};
  mr.start();tick()}
// ---------- диалог ----------
async function ask(t){const me=++gen;set('thinking');$('vt').textContent=t;$('vc').textContent='';add('user',t);chat.push({r:'u',t});
  try{const r=await V.chat(t,'voice');if(!on||me!==gen)return;add('a',r.reply);chat.push({r:'a',t:r.reply});window.save&&window.save();
    set('speaking');say(parts(r.reply),()=>{if(on)cfg.loop?listen():set('idle')})}catch(e){if(on&&me===gen)set('error',e.message)}}
const save2=()=>{try{localStorage.setItem('vk_chat',JSON.stringify(chat.slice(-60)))}catch{}};
// ---------- управление ----------
function open(){on=true;vo.classList.add('on');$('vc').textContent='';$('vt').textContent='';try{navigator.wakeLock?.request('screen').then(w=>wake=w).catch(()=>{})}catch{}listen()}
function close(){on=false;gen++;stopSay();stopL&&stopL();vo.classList.remove('on');wake?.release?.();wake=null;set('idle')}
$('vx').onclick=close;$('vend').onclick=close;
$('orb').onclick=()=>{if(state==='listening')stopL&&stopL();else if(state==='speaking'||state==='thinking'){gen++;stopSay();listen()}else listen()};
$('vmute').onclick=()=>{if(state==='listening'){gen++;stopL&&(stopL(),0);state='idle';set('idle','На паузе')}else listen()};
$('vg').onclick=()=>$('vset').classList.toggle('on');
$('vsel').onchange=e=>{cfg.voice=e.target.value;save()};$('vr').oninput=e=>{cfg.rate=+e.target.value;$('vrv').textContent=cfg.rate+'×';save()};$('vp').oninput=e=>{cfg.pitch=+e.target.value;$('vpv').textContent=cfg.pitch;save()};
$('vm').onchange=e=>{cfg.male=e.target.checked;save()};$('vl').onchange=e=>{cfg.loop=e.target.checked;save()};
$('vtest').onclick=()=>say(['Привет! Я Вектор. Так звучит мой голос.']);
document.addEventListener('keydown',e=>e.key==='Escape'&&on&&close());
window.VektorVoice={open,close,parts,clean,speak:t=>{set('speaking');say(parts(t),()=>{})},stop:stopSay};
})();
