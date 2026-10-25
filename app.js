const $=id=>document.getElementById(id);
const NATIVE=!!window.Android;
const defaults={ownerName:'',personality:'formal',voiceReplies:true,saveHistory:true,aiBase:'https://api.groq.com/openai/v1',aiModel:'openai/gpt-oss-120b',aiKey:'',city:'',visBase:'https://generativelanguage.googleapis.com/v1beta/openai',visModel:'gemini-2.5-flash',visKey:''};
let settings={...defaults,...read('jarvis_settings',{})};
if(['llama-3.3-70b-versatile','llama-3.1-8b-instant'].includes(settings.aiModel)){settings.aiModel=defaults.aiModel;write('jarvis_settings',settings)}
let notes=read('jarvis_notes',[]),history=read('jarvis_history',[]),chat=read('jarvis_chat',[]),reminders=read('jarvis_rem',[]);
let recognition=null,listening=false,always=false,speaking=false,wakeLock=null;
function read(k,f){try{const x=localStorage.getItem(k);return x?JSON.parse(x):f}catch{return f}}
function write(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch{}}
function now(){return new Date().toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'})}
function toBottom(){const m=document.querySelector('main');m.scrollTop=m.scrollHeight}
function row(who,msg,type){const r=document.createElement('div');r.className='msg '+(who==='user'?'user':who==='jarvis'?'jarvis':'sys '+(type||''));const b=document.createElement('div');b.className='bubble';b.textContent=msg;r.append(b);$('log').append(r);toBottom()}
function log(who,msg,type='system'){row(who,msg,type);if(settings.saveHistory){history.push({who,msg,type});history=history.slice(-60);write('jarvis_history',history)}}
function renderHistory(){if(settings.saveHistory)for(const x of history.slice(-12))row(x.who,x.msg,x.who==='user'?'user':x.type)}
function state(cap,status){$('coreCaption').textContent=cap;$('statusText').textContent=status;$('core').classList.toggle('listening',listening);$('micBtn').classList.toggle('rec',listening)}
function idle(){state(always?'ЖДУ СЛОВО «ДЖАРВИС»':'ГОТОВ К КОМАНДЕ',always?'РЕЖИМ ОЖИДАНИЯ':'СИСТЕМА ГОТОВА')}
function speak(text,lang){
  if(settings.voiceKind==='piper'&&!piperFailed&&settings.voiceReplies&&(!lang||lang.startsWith('ru')))return piperSpeak(text,()=>speakSys(text,lang));
  return speakSys(text,lang)}
function speakSys(text,lang){
  if(NATIVE&&settings.voiceReplies){speaking=true;stopRec();state('ГОВОРЮ…','ОТВЕТ');window.onNativeSpeakDone=()=>{speaking=false;idle();if(convo)setTimeout(()=>listen(true),300);else if(always)setTimeout(listen,250)};Android.speak(text.replace(/[*_#`]/g,''),(settings.voiceRate||1)*(settings.personality==='tactical'?1.1:1),settings.voicePitch||1,lang||'ru-RU');return}
  if(!settings.voiceReplies||!('speechSynthesis'in window)){if(convo)listen(true);else if(always)listen();return}
  speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(text.replace(/[*_#`]/g,''));u.lang=lang||'ru-RU';u.rate=(settings.voiceRate||1)*(settings.personality==='tactical'?1.05:1);u.pitch=settings.voicePitch||1;
  const vs=speechSynthesis.getVoices(),isRu=!lang||lang.startsWith('ru'),v=(isRu&&settings.voiceName&&vs.find(x=>x.name===settings.voiceName))||vs.find(v=>v.lang&&v.lang.startsWith((lang||'ru').slice(0,2)));if(v)u.voice=v;
  speaking=true;stopRec();
  const end=()=>{speaking=false;idle();if(convo)setTimeout(()=>listen(true),300);else if(always)setTimeout(listen,250)};u.onend=end;u.onerror=end;speechSynthesis.speak(u)}
function say(text,lang,spoken){$('reply').textContent=text;log('jarvis',text);speak(spoken||text,lang)}
function updateClock(){$('clock').textContent=now();const h=new Date().getHours();$('greetingTitle').textContent=(h<5?'Доброй ночи':h<12?'Доброе утро':h<18?'Добрый день':'Добрый вечер')+(settings.ownerName?', '+settings.ownerName:'')+'.'}
const APPS={'youtube':['https://www.youtube.com','com.google.android.youtube'],'ютуб':['https://www.youtube.com','com.google.android.youtube'],'телеграм':['https://t.me','org.telegram.messenger'],'telegram':['https://t.me','org.telegram.messenger'],'ватсап':['https://wa.me','com.whatsapp'],'whatsapp':['https://wa.me','com.whatsapp'],'карты':['https://maps.google.com','com.google.android.apps.maps'],'google':['https://www.google.com',''],'гугл':['https://www.google.com',''],'почту':['https://mail.google.com','com.google.android.gm'],'почта':['https://mail.google.com','com.google.android.gm'],'инстаграм':['https://www.instagram.com','com.instagram.android'],'вк':['https://vk.com','com.vkontakte.android'],'спотифай':['https://open.spotify.com','com.spotify.music'],'браузер':['https://www.google.com',''],'переводчик':['https://translate.google.com','com.google.android.apps.translate']};
function go(url,pkg){setTimeout(()=>{if(NATIVE){Android.openUrl(url,pkg||'');return}if(pkg){const u=new URL(url);location.href=`intent://${u.host}${u.pathname}#Intent;scheme=https;package=${pkg};S.browser_fallback_url=${encodeURIComponent(url)};end`}else location.href=url},1200)}
function help(){return 'Я умею: время и дата; погода («погода в Вене»); посчитай («посчитай 15 умножить на 4»); таймер и напоминания («напомни через 10 минут позвонить маме»); заметки («запомни…», «покажи заметки», «удали заметку 2»); открыть приложение или сайт; поиск; видео и музыка («включи музыку Imagine Dragons»); маршрут («маршрут до вокзала»); звонок («позвони +4366412345»); заряд батареи; кубик и монетка; любые вопросы через ИИ. Включи режим «Джарвис» внизу — и я буду слушать, пока приложение открыто.'}
function dur(n,u){n=+n;return n*(/^сек/.test(u)?1000:/^мин/.test(u)?60000:3600000)}
function addReminder(ms,text){if(NATIVE&&ms>=1000){Android.setTimer(Math.round(ms/1000),text);return}const r={at:Date.now()+ms,text};reminders.push(r);write('jarvis_rem',reminders);arm(r);if('Notification'in window&&Notification.permission==='default')Notification.requestPermission()}
function arm(r){const ms=r.at-Date.now();if(ms<=0||ms>2147483000)return;setTimeout(()=>{reminders=reminders.filter(x=>x!==r&&x.at!==r.at);write('jarvis_rem',reminders);if(navigator.vibrate)navigator.vibrate([300,150,300]);try{if(Notification.permission==='granted')new Notification('JARVIS',{body:r.text})}catch{}say(r.text)},ms)}
const WX={0:'ясно',1:'почти ясно',2:'переменная облачность',3:'пасмурно',45:'туман',48:'изморозь',51:'морось',53:'морось',55:'сильная морось',61:'небольшой дождь',63:'дождь',65:'сильный дождь',71:'небольшой снег',73:'снег',75:'сильный снег',80:'ливень',81:'ливень',82:'сильный ливень',95:'гроза',96:'гроза с градом',99:'гроза с градом'};
async function weather(city){
  try{let lat,lon,name=city;
    if(!city&&settings.city)city=name=settings.city;
    if(city){const g=await(await fetch('https://geocoding-api.open-meteo.com/v1/search?count=1&language=ru&name='+encodeURIComponent(city))).json();if(!g.results)return say('Не нашёл город «'+city+'».');lat=g.results[0].latitude;lon=g.results[0].longitude;name=g.results[0].name}
    else{const p=await new Promise((ok,no)=>navigator.geolocation.getCurrentPosition(ok,no,{timeout:8000}));lat=p.coords.latitude;lon=p.coords.longitude;name='вашем месте'}
    const d=(await(await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m&timezone=auto`)).json()).current;
    say(`В ${name} сейчас ${Math.round(d.temperature_2m)}°, ощущается как ${Math.round(d.apparent_temperature)}°. ${WX[d.weather_code]||'без осадков'}, ветер ${Math.round(d.wind_speed_10m)} км/ч.`)
  }catch{say('Не удалось получить погоду. Проверьте интернет или укажите город в настройках.')}}
function calc(e){let s=e.toLowerCase().replace(/,/g,'.').replace(/плюс/g,'+').replace(/минус/g,'-').replace(/(умножить на|умножь на|помножить на|[xх×])/g,'*').replace(/(разделить на|поделить на|делить на|÷)/g,'/').replace(/в степени/g,'**').replace(/процентов? от/g,'/100*').replace(/\s+/g,'');if(!/^[\d+\-*/().%]+$/.test(s))return null;try{const r=Function('"use strict";return('+s+')')();return Number.isFinite(r)?Math.round(r*1e6)/1e6:null}catch{return null}}
const PRESETS={Groq:['https://api.groq.com/openai/v1','openai/gpt-oss-120b',false],OpenRouter:['https://openrouter.ai/api/v1','openrouter/free',true],Mistral:['https://api.mistral.ai/v1','mistral-small-latest',true],Gemini:['https://generativelanguage.googleapis.com/v1beta/openai','gemini-2.5-flash',true]};
let P=read('jarvis_prov',null);
if(!P){P={list:[],active:'',failover:true};
  if(settings.aiKey)P.list.push({id:'p1',name:'Groq',base:settings.aiBase,model:settings.aiModel,key:settings.aiKey,vision:false});
  if(settings.visKey)P.list.push({id:'p2',name:'Gemini',base:settings.visBase,model:settings.visModel,key:settings.visKey,vision:true});
  P.active=P.list[0]?P.list[0].id:'';write('jarvis_prov',P)}
function actProv(){return P.list.find(p=>p.id===P.active&&p.key)||P.list.find(p=>p.key)||null}
function refreshProv(){const a=actProv();$('provBtn').textContent='◉ '+(a?a.name:'Нет ИИ')}
function saveP(){write('jarvis_prov',P);refreshProv()}
function renderProv(){const box=$('provList');box.replaceChildren();
  if(!P.list.length){const h=document.createElement('p');h.className='hint';h.textContent='Список пуст. Добавьте нейросеть и вставьте ключ.';box.append(h)}
  for(const p of P.list){const r=document.createElement('div');r.className='prow';const b=document.createElement('button');b.type='button';b.className='pmain'+(p.id===P.active?' act':'');b.textContent=(p.id===P.active?'● ':'○ ')+p.name+(p.vision?'  📷':'');const sm=document.createElement('small');sm.textContent=p.model;if(!p.key){sm.textContent+=' • нет ключа';sm.className='nokey'}b.append(sm);b.onclick=()=>{P.active=p.id;saveP();renderProv()};const e=document.createElement('button');e.type='button';e.className='pedit';e.textContent='✎';e.onclick=()=>editProv(p);r.append(b,e);box.append(r)}
  $('failover').checked=P.failover}
let editing=null;
function editProv(p){editing=p||{id:'p'+Date.now(),name:'',base:'',model:'',key:'',vision:false,isNew:true};$('pName').value=editing.name;$('pBase').value=editing.base;$('pModel').value=editing.model;$('pKey').value=editing.key;$('pVision').checked=editing.vision;$('pDel').style.display=p?'':'none';$('pModelsOut').textContent='';$('provEdit').showModal()}
async function callP(p,messages,max){
  const oss=/gpt-oss/.test(p.model);
  const r=await fetch(p.base.replace(/\/$/,'')+'/chat/completions',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+p.key},body:JSON.stringify({model:p.model,messages,max_tokens:oss?Math.max(max,1500):max,...(oss?{reasoning_effort:'low'}:{})})});
  let d;try{d=await r.json()}catch{throw new Error('HTTP '+r.status)}
  if(!r.ok)throw new Error(((Array.isArray(d)?d[0]:d).error||{}).message||('HTTP '+r.status));
  const a=((d.choices&&d.choices[0]&&d.choices[0].message.content)||'').trim();if(!a)throw new Error('пустой ответ модели');return a}
async function ask(messages,max,needVision){
  let pool=P.list.filter(p=>p.key&&(!needVision||p.vision));const act=actProv();
  if(act&&pool.includes(act))pool=[act,...pool.filter(p=>p!==act)];
  if(!P.failover)pool=pool.slice(0,1);
  const errs=[];
  for(let i=0;i<pool.length;i++){const p=pool[i];try{const t=await callP(p,messages,max);if(i>0)log('sys','Основная нейросеть не ответила, ответил резервный: '+p.name);return t}catch(e){errs.push(p.name+': '+e.message)}}
  throw new Error(errs.join(' | ')||'нет подключённых нейросетей')}
const LANGS=[['англ','en-US','английский'],['нем','de-DE','немецкий'],['франц','fr-FR','французский'],['испан','es-ES','испанский'],['итал','it-IT','итальянский'],['турец','tr-TR','турецкий'],['польск','pl-PL','польский'],['украин','uk-UA','украинский'],['русск','ru-RU','русский'],['китайск','zh-CN','китайский'],['японск','ja-JP','японский'],['корейск','ko-KR','корейский'],['португальск','pt-PT','португальский'],['чешск','cs-CZ','чешский'],['арабск','ar-SA','арабский'],['голландск','nl-NL','нидерландский'],['нидерландск','nl-NL','нидерландский']];
function findLang(w){return LANGS.find(l=>w.startsWith(l[0]))}
async function translate(text,l){
  if(!P.list.some(p=>p.key))return say('Для перевода подключите нейросеть: нажмите на название вверху и добавьте ключ.');
  state('ПЕРЕВОЖУ…','ПЕРЕВОД');
  try{const a=await ask([{role:'system',content:'Ты переводчик. Переведи текст пользователя на '+l[2]+' язык. Выведи только перевод, без пояснений и кавычек.'},{role:'user',content:text}],600);say(l[2][0].toUpperCase()+l[2].slice(1)+': '+a,l[1],a)}
  catch(e){say('Не удалось перевести: '+e.message)}}
async function ai(text){
  if(!P.list.some(p=>p.key)){say('Подключите нейросеть: нажмите на название вверху (◉) и добавьте API-ключ.');return}
  state('ДУМАЮ…','ОБРАБОТКА ЗАПРОСА');
  const style={formal:'спокойно, умно и лаконично, с лёгкой иронией, как Джарвис Тони Старка',friendly:'дружелюбно и остроумно',tactical:'максимально кратко'}[settings.personality];
  const sys=`Ты JARVIS — голосовой ассистент на телефоне. Отвечай по-русски ${style}, обычно 1-3 предложения, без markdown и списков. Обращайся к пользователю: «${settings.ownerName||'сэр'}». Сейчас ${new Date().toLocaleString('ru-RU')}. Заметки пользователя: ${notes.join('; ')||'нет'}.`;
  chat.push({role:'user',content:text});chat=chat.slice(-12);
  try{const a=await ask([{role:'system',content:sys},...chat],350);chat.push({role:'assistant',content:a});write('jarvis_chat',chat);say(a)}
  catch(e){chat.pop();say('Не удалось связаться с ИИ: '+e.message)}}
function handleCommand(raw){const c=raw.trim();if(!c)return;log('user',c,'user');$('textCommand').value='';autosize();const s=c.toLowerCase().replace(/[!?.,]/g,'').trim();let m;
if(convo&&/^(стоп|хватит|закончи разговор|выключи разговор)$/.test(s)){setConvo(false);return say('Режим разговора выключен.')}
if(/^(режим разговора|давай поговорим|поговорим)$/.test(s)){say('Режим разговора включён. Скажите «стоп», чтобы выйти.');return setConvo(true,true)}
if(/^(привет|здравствуй|добрый день|доброе утро|добрый вечер|здарова)/.test(s))return say(settings.personality==='tactical'?'На связи. Жду задачу.':`Привет${settings.ownerName?', '+settings.ownerName:''}. Все системы в норме. Что делаем?`);
if(/^(помощь|что ты умеешь|команды)/.test(s))return say(help());
if(/который час|сколько времени|текущее время/.test(s))return say('Сейчас '+new Date().toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'})+'.');
if(/какое сегодня число|какая сегодня дата|какой сегодня день|сегодняшняя дата/.test(s))return say('Сегодня '+new Date().toLocaleDateString('ru-RU',{weekday:'long',year:'numeric',month:'long',day:'numeric'})+'.');
if(/как тебя зовут|кто ты/.test(s))return say('Я JARVIS Mobile, ваш персональный ассистент: голос, команды, память и языковая модель.');
if(m=s.match(/меня зовут\s+(.+)/)){settings.ownerName=m[1];write('jarvis_settings',settings);updateClock();return say('Рад знакомству, '+m[1]+'.')}
if(/погод/.test(s)){m=s.match(/погод\w*\s+(?:в|во|для)\s+(.+?)(?:\s+(?:сейчас|сегодня))?$/);return weather(m&&m[1])}
if(m=s.match(/^(?:посчитай|сколько будет|вычисли|реши)\s+(.+)/)){const r=calc(m[1]);if(r!==null)return say(m[1]+' = '+r)}
if(/заряд|батаре/.test(s)){if(NATIVE){const b=Android.battery().split('|');return say('Заряд '+b[0]+' процентов'+(b[1]==='1'?', идёт зарядка':'')+'.')}return navigator.getBattery?navigator.getBattery().then(b=>say(`Заряд ${Math.round(b.level*100)} процентов${b.charging?', идёт зарядка':''}.`)):say('Браузер не сообщает заряд батареи.')}
if(/(брось|кинь) кубик/.test(s))return say('Выпало '+(1+Math.floor(Math.random()*6))+'.');
if(/(подбрось|брось|кинь) (монет|орёл)/.test(s))return say(Math.random()<.5?'Орёл.':'Решка.');
if(m=s.match(/случайное число от (\d+) до (\d+)/)){const a=+m[1],b=+m[2];return say('Число: '+(Math.min(a,b)+Math.floor(Math.random()*(Math.abs(b-a)+1))))}
if(m=s.match(/напомни(?:ть)?\s+(?:мне\s+)?через\s+(\d+)\s*(\S+)\s*(?:что\s+|о\s+|про\s+|чтобы\s+)?(.*)/)){const ms=dur(m[1],m[2]),t=m[3]||'Время вышло';addReminder(ms,t);return say(`Напомню через ${m[1]} ${m[2]}: ${t}. ${NATIVE?'Сработает даже при закрытом приложении.':'Приложение должно оставаться открытым.'}`)}
if(m=s.match(/таймер.*?(\d+)\s*(сек\S*|мин\S*|час\S*)/)||s.match(/через\s+(\d+)\s*(сек\S*|мин\S*|час\S*)/)){addReminder(dur(m[1],m[2]),'Таймер завершён.');return say(`Таймер установлен: ${m[1]} ${m[2]}. ${NATIVE?'Сработает даже при закрытом приложении.':'Приложение должно оставаться открытым.'}`)}
if(/покажи заметки|мои заметки|список заметок/.test(s))return say(notes.length?'Твои заметки: '+notes.map((n,i)=>`${i+1}. ${n}`).join('; '):'Заметок пока нет. Скажи: запомни, и текст.');
if(m=s.match(/удали заметку (\d+)/)){const i=+m[1]-1;if(notes[i]!==undefined){notes.splice(i,1);write('jarvis_notes',notes);return say('Заметка удалена.')}return say('Нет заметки с таким номером.')}
if(/очисти заметки|удали все заметки|забудь всё|забудь все/.test(s)){notes=[];chat=[];write('jarvis_notes',notes);write('jarvis_chat',chat);return say('Память очищена.')}
if(/создай заметку|новая заметка|запиши заметку/.test(s)){$('noteText').value='';return $('noteDialog').showModal()}
if(m=c.match(/^(?:запомни|сохрани|добавь заметку|запиши)(?:,)?(?: что)?\s*[:,-]?\s*(.+)$/i)){notes.push(m[1]);write('jarvis_notes',notes);return say('Записал: '+m[1])}
if(m=s.match(/^(?:составь |сделай |дай |создай )?(тест|карточки|конспект|план подготовки|экзамен)\s+(?:по|на тему|про)\s+(.+)/)){const md={'тест':'quiz','карточки':'cards','конспект':'summary','план подготовки':'plan','экзамен':'exam'}[m[1]];say('Открываю учёбу.');return openStudy(m[2],md)}
if(/^(режим уч[её]бы|уч[её]ба|хочу учиться|давай учиться|помоги с уч[её]бой)$/.test(s)){say('Открываю режим учёбы.');return openStudy()}
if(NATIVE&&(m=s.match(/^(?:позвони|набери|вызови)\s+(.+)/))){const q=m[1].trim();if(/^[\d+\s-]{3,}$/.test(q)){say('Набираю '+q);return go('tel:'+q.replace(/[^\d+]/g,''))}say('Ищу контакт: '+q+'.');return Android.callContact(q)}
if(NATIVE&&(m=c.match(/^(?:отправь|напиши)\s+(?:смс|sms|сообщение)\s+(\S+?)[:,\s]+([\s\S]+)$/i))){say('Готовлю сообщение для '+m[1]+'.');return Android.sendSms(m[1],m[2].trim())}
if(NATIVE&&(m=s.match(/(?:будильник|разбуди).*?(\d{1,2})(?:[:\s](\d{2}))?/))){const hh=+m[1],mi=+(m[2]||0);if(hh<24&&mi<60){say('Ставлю будильник на '+hh+':'+String(mi).padStart(2,'0')+'.');return Android.setAlarm(hh,mi)}}
if(NATIVE&&(m=c.match(/^(?:добавь|создай)\s+(?:событие|встречу)\s+([\s\S]+)/i))){say('Открываю календарь.');return Android.addEvent(m[1].trim())}
if(NATIVE&&/^(пауза|поставь на паузу|останови музыку)$/.test(s)){Android.media('pause');return say('Пауза.')}
if(NATIVE&&/^(продолжи|продолжи музыку|играй|воспроизведи)$/.test(s)){Android.media('play');return say('Продолжаю.')}
if(NATIVE&&/(следующ\S* (трек|песн\S*)|переключи трек)/.test(s)){Android.media('next');return say('Следующий трек.')}
if(NATIVE&&/предыдущ\S* (трек|песн\S*)/.test(s)){Android.media('prev');return say('Предыдущий трек.')}
if(NATIVE&&/(громче|прибавь громкость|увеличь громкость)/.test(s)){Android.volume(1);return say('Громче.')}
if(NATIVE&&/(тише|убавь громкость|уменьши громкость)/.test(s)){Android.volume(-1);return say('Тише.')}
if(/^(проверка системы|проверь систему|диагностика)$/.test(s)){say('Открываю проверку системы.');return openCheck()}
if(/^(настройки голоса|смени голос|выбери голос)$/.test(s)){say('Открываю настройки голоса.');return openVoice()}
if(m=s.match(/^(?:переключись на|переключи на|используй|включи нейросеть|выбери нейросеть)\s+(.+)/)){const q=m[1].trim(),p=P.list.find(p=>p.name.toLowerCase().includes(q)||q.includes(p.name.toLowerCase()));if(p){P.active=p.id;saveP();return say('Основная нейросеть: '+p.name+'.')}}
if(/какая (сейчас )?нейросеть|какой (сейчас )?ии|какая модель/.test(s)){const a=actProv();return say(a?'Сейчас работает '+a.name+', модель '+a.model+'.':'Нейросеть не подключена.')}
if(m=c.match(/^переведи(?:те)?\s+(?:это\s+)?на\s+(\S+?)[:,\s]+([\s\S]+)$/i)){const l=findLang(m[1].toLowerCase());if(l)return translate(m[2].trim(),l)}
if(m=c.match(/^как\s+(?:будет|сказать)\s+([\s\S]+?)\s+по[\s-]*(\S+)$/i)){const l=findLang(m[2].toLowerCase());if(l)return translate(m[1].trim(),l)}
if(/^(сфотографируй\w*|сделай (фото|снимок)|сфоткай|что на камере|что это|что я вижу|что передо мной|посмотри( на это)?)$/.test(s)){say('Открываю камеру.');return setTimeout(()=>takePhoto(),900)}
if(/(выбери|загрузи|добавь|открой)\s+(?:фото|картинку|изображение|галерею)/.test(s)){say('Выберите фото.');return setTimeout(()=>pickPhoto(),900)}
if(/(на фото|на картинке|на изображении|на снимке)/.test(s))return lastPhoto?vision(c,lastPhoto):say('Сначала пришлите фото: кнопки 📷 и 🖼 или команда «сфотографируй».');
if(/фонарик/.test(s)){const on=!/(выключи|погаси|отключи|выруби)/.test(s);return say(NATIVE&&Android.torch(on)?(on?'Фонарик включён.':'Фонарик выключен.'):'Фонарик доступен только в Android-версии.')}
if(NATIVE&&/(откр|настро).*(wi-?fi|вай-?фай)/.test(s)){say('Открываю настройки Wi-Fi.');return setTimeout(()=>Android.openSettings('wifi'),900)}
if(NATIVE&&/(откр|настро).*(bluetooth|блютуз)/.test(s)){say('Открываю настройки Bluetooth.');return setTimeout(()=>Android.openSettings('bluetooth'),900)}
if(/^открой настройки/.test(s)){$('settingsBtn').click();return say('Открываю настройки.')}
if(m=s.match(/^(?:открой сайт)\s+(.+)/)){let q=m[1].replace(/\s/g,'');if(!/\./.test(q))return say('Назови домен, например example.com.');say('Открываю '+q);return go(/^https?:/.test(q)?q:'https://'+q)}
if(m=s.match(/^(?:открой|запусти)\s+(?:приложение\s+)?(.+)/)){const a=APPS[m[1].trim()];if(a){say('Открываю '+m[1]+'.');return go(a[0],a[1])}if(NATIVE&&Android.hasApp(m[1])){say('Открываю '+m[1]+'.');setTimeout(()=>Android.openApp(m[1]),1200);return}if(/\.[a-zа-я]{2,}$/.test(m[1])){say('Открываю '+m[1]);return go('https://'+m[1].replace(/\s/g,''))}}
if(m=s.match(/^(?:включи|поставь|найди на ютубе|найди видео)\s+(?:музыку\s+|видео\s+)?(.+)/)){if(APPS[m[1]]){say('Открываю '+m[1]);return go(...APPS[m[1]])}say('Ищу на YouTube: '+m[1]);return go('https://www.youtube.com/results?search_query='+encodeURIComponent(m[1]),'com.google.android.youtube')}
if(m=s.match(/^(?:найди|поищи|поиск|загугли)\s+(.+)/)){say('Ищу: '+m[1]);return go('https://www.google.com/search?q='+encodeURIComponent(m[1]))}
if(m=s.match(/(?:маршрут до|как доехать до|проложи маршрут до|навигация до)\s+(.+)/)){say('Строю маршрут: '+m[1]);return go('https://www.google.com/maps/dir/?api=1&destination='+encodeURIComponent(m[1]))}
if(m=s.match(/^(?:позвони|набери)\s+(.+)/)){const n=m[1].replace(/[^\d+]/g,'');if(n.length>=3){say('Набираю '+n);return go('tel:'+n)}return say('Назови номер цифрами.')}
ai(c)}
let onceMode=false;
function stopRec(){listening=false;wCycle++;try{NATIVE?Android.stopListen():recognition&&recognition.abort()}catch{}}
function gotText(t){if(!t)return;silent=0;gotSpeech=true;if(captureText){const f=captureText;captureText=null;return f(t)}if(!onceMode){const w=t.match(/(джарвис|жарвис|джарвиз|jarvis|гарвис)[,\s]*/i);if(!w)return;const r=t.slice(w.index+w[0].length).trim();return r?handleCommand(r):say('Слушаю, '+(settings.ownerName||'сэр')+'.')}handleCommand(t)}
function micErr(e){if(chkWait&&e!=='aborted'){chkWait=false;captureText=null;chkLine('hear','❌','Тест слуха',e==='no-speech'?'Речь не распознана. Повторите громче и ближе к микрофону.':'Ошибка: '+e)}if(e==='not-allowed'||e==='service-not-allowed'){always=false;setWake();log('sys','Нет доступа к микрофону. Разрешите его в настройках Android.','error')}else if(e!=='no-speech'&&e!=='aborted')log('sys','Ошибка микрофона: '+e,'error')}
function started(){listening=true;const w=always&&!onceMode;$('micLabel').textContent=w?'ЖДУ «ДЖАРВИС»':'СЛУШАЮ ТЕБЯ…';state(w?'ЖДУ СЛОВО «ДЖАРВИС»':'ОЖИДАЮ КОМАНДУ','ГОЛОСОВОЙ ВВОД АКТИВЕН')}
function ended(){listening=false;$('micLabel').textContent='НАЖМИ И ГОВОРИ';idle();
  if(convo&&!speaking){if(gotSpeech)gotSpeech=false;else if(++silent>=3){setConvo(false);log('sys','Режим разговора выключен: долго не было речи.')}else setTimeout(()=>listen(true),300)}
  else if(always&&!speaking)setTimeout(()=>listen(false),350)}
window.onNativeSpeechStart=started;window.onNativeSpeech=gotText;window.onNativeSpeechError=micErr;window.onNativeSpeechEnd=ended;window.onNativeError=m=>log('sys',m,'error');
function listen(once){if(speaking||listening)return;onceMode=!!once;
  if(settings.sttKind==='whisper'||(!NATIVE&&!(window.SpeechRecognition||window.webkitSpeechRecognition))){whisperListen(once);return}
  if(NATIVE){listening=true;Android.listen();return}
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;if(!SR)return;
  recognition=new SR();recognition.lang='ru-RU';recognition.interimResults=false;
  recognition.onstart=started;recognition.onresult=e=>gotText(e.results[e.results.length-1][0].transcript.trim());recognition.onerror=e=>micErr(e.error);recognition.onend=ended;
  try{recognition.start()}catch{listening=false}}
function micClick(){if(listening){stopRec();ended();return}stopAllSpeech();speaking=false;listen(true)}
function setWake(){$('wakeBtn').textContent='🎧 «Джарвис»: '+(always?'вкл':'выкл');$('wakeBtn').classList.toggle('on',always)}
async function wake(){always=!always;setWake();
  if(always){try{NATIVE?Android.keepAwake(true):wakeLock=await navigator.wakeLock.request('screen')}catch{}listen(false);say('Режим ожидания включён. Скажите «Джарвис» и команду. Экран должен оставаться включённым.')}
  else{stopRec();try{NATIVE?Android.keepAwake(false):wakeLock&&wakeLock.release()}catch{}idle()}}
document.addEventListener('visibilitychange',async()=>{if(always&&document.visibilityState==='visible'){try{wakeLock=await navigator.wakeLock.request('screen')}catch{}listen()}});
let lastPhoto=null;
function thumb(url){const r=document.createElement('div');r.className='msg user';const b=document.createElement('div');b.className='bubble';const i=document.createElement('img');i.src=url;b.append(i);r.append(b);$('log').append(r);toBottom()}
async function vision(q,url){
  if(!P.list.some(p=>p.key&&p.vision))return say('Для фото нужна нейросеть с пометкой 📷 и ключом. Нажмите на название вверху (◉), чтобы добавить.');
  state('СМОТРЮ…','АНАЛИЗ ИЗОБРАЖЕНИЯ');
  try{const a=await ask([{role:'system',content:'Ты JARVIS, голосовой ассистент. Отвечай по-русски кратко и по делу, без markdown. Если на фото есть текст, прочитай или переведи его по просьбе.'},{role:'user',content:[{type:'text',text:q},{type:'image_url',image_url:{url}}]}],1500,true);say(a)}
  catch(e){say('Не удалось распознать фото: '+e.message)}}
function gotPhoto(url){lastPhoto=url;if(photoMode){const mode=photoMode;photoMode=null;return studyPhoto(mode,url)}thumb(url);vision('Опиши, что на фото. Если там есть текст, прочитай его.',url)}
window.onNativePhoto=gotPhoto;
function readFile(f){if(!f)return;const img=new Image(),u=URL.createObjectURL(f);img.onload=()=>{const k=Math.min(1,1024/Math.max(img.width,img.height)),c=document.createElement('canvas');c.width=img.width*k;c.height=img.height*k;c.getContext('2d').drawImage(img,0,0,c.width,c.height);URL.revokeObjectURL(u);gotPhoto(c.toDataURL('image/jpeg',.8))};img.src=u}
function takePhoto(){NATIVE?Android.takePhoto():$('fileIn').click()}
function pickPhoto(){NATIVE?Android.pickPhoto():$('fileIn').click()}
$('fileIn').onchange=e=>{readFile(e.target.files[0]);e.target.value=''};
$('photoBtn').onclick=takePhoto;$('galleryBtn').onclick=pickPhoto;
$('micBtn').addEventListener('click',micClick);$('wakeBtn').addEventListener('click',wake);
function autosize(){const t=$('textCommand');t.style.height='auto';t.style.height=Math.min(t.scrollHeight,132)+'px'}
function sendText(){const v=$('textCommand').value;if(v.trim())handleCommand(v)}
$('sendBtn').addEventListener('click',sendText);$('textCommand').addEventListener('input',autosize);
$('textCommand').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey&&!('ontouchstart'in window)){e.preventDefault();sendText()}});
document.querySelectorAll('[data-fill]').forEach(b=>b.addEventListener('click',()=>{const t=$('textCommand');t.value=b.dataset.fill;autosize();t.focus()}));
$('provBtn').onclick=$('openProv').onclick=()=>{renderProv();$('provDialog').showModal()};
$('provClose').onclick=()=>$('provDialog').close();$('pClose').onclick=()=>$('provEdit').close();
$('provAdd').onclick=()=>editProv();
$('failover').onchange=()=>{P.failover=$('failover').checked;saveP()};
document.querySelectorAll('[data-preset]').forEach(b=>b.onclick=()=>{const n=b.dataset.preset,p=PRESETS[n];$('pName').value=n;$('pBase').value=p[0];$('pModel').value=p[1];$('pVision').checked=p[2]});
$('pSave').onclick=()=>{const e=editing;e.name=$('pName').value.trim()||'Нейросеть';e.base=$('pBase').value.trim();e.model=$('pModel').value.trim();e.key=$('pKey').value.trim();e.vision=$('pVision').checked;if(!e.base||!e.model){$('pModelsOut').textContent='Укажите адрес API и модель (или выберите шаблон сверху).';return}if(e.isNew){delete e.isNew;P.list.push(e)}if(!P.active||!P.list.some(p=>p.id===P.active&&p.key))P.active=e.key?e.id:P.active;saveP();renderProv();$('provEdit').close()};
$('pDel').onclick=()=>{P.list=P.list.filter(p=>p!==editing);if(P.active===editing.id)P.active=(P.list.find(p=>p.key)||{}).id||'';saveP();renderProv();$('provEdit').close()};
$('pModels').onclick=async()=>{const out=$('pModelsOut'),base=$('pBase').value.trim(),key=$('pKey').value.trim();if(!base||!key){out.textContent='Сначала укажите адрес и ключ.';return}out.textContent='Загружаю…';try{const r=await fetch(base.replace(/\/$/,'')+'/models',{headers:{Authorization:'Bearer '+key}});const d=await r.json();const ids=(d.data||d.models||[]).map(m=>(m.id||m.name||'').replace(/^models\//,'')).filter(Boolean);out.textContent=ids.length?'Модели: '+ids.slice(0,40).join(', '):'Список пуст: '+JSON.stringify(d).slice(0,200)}catch(e){out.textContent='Не удалось получить список: '+e.message}};
document.querySelectorAll('[data-command]').forEach(b=>b.addEventListener('click',()=>handleCommand(b.dataset.command)));
$('settingsBtn').onclick=()=>{for(const k of['ownerName','personality','city'])$(k).value=settings[k];$('voiceReplies').checked=settings.voiceReplies;$('saveHistory').checked=settings.saveHistory;$('settingsDialog').showModal()};
$('saveSettings').onclick=()=>{settings={...settings,ownerName:$('ownerName').value.trim(),personality:$('personality').value,voiceReplies:$('voiceReplies').checked,saveHistory:$('saveHistory').checked,city:$('city').value.trim()};write('jarvis_settings',settings);if(!settings.saveHistory){history=[];write('jarvis_history',[]);$('log').replaceChildren()}updateClock();say('Настройки сохранены.')};
$('saveNote').onclick=()=>{const n=$('noteText').value.trim();if(n){notes.push(n);write('jarvis_notes',notes);say('Заметка сохранена.')}};
$('clearLog').onclick=()=>{history=[];write('jarvis_history',[]);$('log').replaceChildren();log('sys','Журнал очищен.')};
let ST=read('jarvis_study',{mat:{},scores:{}}),photoMode=null,captureText=null,exam=null;
window.onNativeInfo=m=>log('sys',m);
function el(t,c,x){const e=document.createElement(t);if(c)e.className=c;if(x!==undefined)e.textContent=x;return e}
const stOut=()=>$('stOut');
function stSaveTopic(){const t=$('stTopic').value.trim();if(t){ST.mat[t]=$('stMat').value;write('jarvis_study',ST)}return t}
function stList(){$('stTopics').replaceChildren(...Object.keys(ST.mat).map(k=>{const o=document.createElement('option');o.value=k;return o}))}
function stScoresShow(t){const a=(ST.scores[t]||[]).slice(-5);$('stScores').textContent=a.length?'Последние тесты: '+a.map(x=>x.s+'/'+x.n).join(', '):''}
function openStudy(topic,mode){stList();if(topic){$('stTopic').value=topic;$('stMat').value=ST.mat[topic]||''}stScoresShow($('stTopic').value.trim());if(!$('studyDialog').open)$('studyDialog').showModal();if(mode)stRun(mode)}
function stBase(){const t=stSaveTopic(),m=$('stMat').value.trim().slice(0,6000);if(!t&&!m){stOut().replaceChildren(el('p','hint','Введите предмет или тему, либо вставьте материал.'));return null}return{t,m,src:(t?'Тема: '+t+'\n':'')+(m?'Материал:\n'+m:'')}}
function parseJSON(t){const a=t.search(/[\[{]/),b=Math.max(t.lastIndexOf(']'),t.lastIndexOf('}'));return JSON.parse(t.slice(a,b+1))}
const stAsk=(sys,user,max)=>ask([{role:'system',content:sys},{role:'user',content:user}],max);
const stBusy=x=>stOut().replaceChildren(el('p','hint',x||'Думаю…'));
async function stRun(mode){
  const b=stBase();if(!b)return;
  if(!P.list.some(p=>p.key))return stOut().replaceChildren(el('p','hint','Сначала подключите нейросеть: чип ◉ вверху главного экрана.'));
  stScoresShow(b.t);
  try{
    if(mode==='summary'||mode==='explain'||mode==='plan'){stBusy();
      const sys={summary:'Ты репетитор. Составь чёткий структурированный конспект: ключевые понятия, определения, формулы и факты короткими пунктами. Без воды. Пиши по-русски.',explain:'Ты терпеливый репетитор. Объясни простыми словами с аналогиями и 2-3 примерами, затем дай короткий вывод. Пиши по-русски.',plan:'Ты репетитор. Составь реалистичный план подготовки на 7 дней: по дням, что изучить, что повторить, как проверить себя. Пиши по-русски.'}[mode];
      const a=await stAsk(sys,b.src,1500),out=stOut();out.replaceChildren(el('pre','',a));
      const r=el('button','chip','🔊 Вслух');r.onclick=()=>speak(a);const sv=el('button','chip','💾 В заметки');sv.onclick=()=>{notes.push((b.t||'Учёба')+': '+a.slice(0,500));write('jarvis_notes',notes);sv.textContent='Сохранено'};
      const row=el('div','row2');row.append(r,sv);out.append(row)}
    else if(mode==='quiz'){stBusy('Составляю тест…');
      const a=await stAsk('Ты составитель тестов. Верни ТОЛЬКО JSON-массив без пояснений и markdown.','Составь 6 вопросов с 4 вариантами ответа. Формат: [{"q":"вопрос","options":["а","б","в","г"],"correct":0,"why":"краткое объяснение"}], correct — индекс правильного варианта от 0 до 3.\n\n'+b.src,2500);
      const qs=parseJSON(a).filter(q=>q&&q.q&&Array.isArray(q.options)&&q.options.length>1&&Number.isInteger(q.correct)&&q.options[q.correct]!==undefined);
      if(!qs.length)throw new Error('не получилось составить тест, попробуйте ещё раз');runQuiz(qs,b.t||'—')}
    else if(mode==='cards'){stBusy('Готовлю карточки…');
      const a=await stAsk('Ты составитель карточек для запоминания. Верни ТОЛЬКО JSON-массив без пояснений и markdown.','Составь 10 карточек. Формат: [{"q":"вопрос или термин","a":"краткий ответ"}].\n\n'+b.src,2500);
      const cs=parseJSON(a).filter(c=>c&&c.q&&c.a);if(!cs.length)throw new Error('не получилось составить карточки, попробуйте ещё раз');runCards(cs)}
    else if(mode==='exam'){exam={topic:b.t||'по материалу',src:b.src,msgs:[]};examStep('Начинай экзамен.')}
  }catch(e){stOut().replaceChildren(el('p','hint','Ошибка: '+e.message))}}
function runQuiz(qs,topic){let i=0,sc=0;const out=stOut();
  const show=()=>{out.replaceChildren();
    if(i>=qs.length){(ST.scores[topic]=ST.scores[topic]||[]).push({s:sc,n:qs.length});write('jarvis_study',ST);stScoresShow(topic);out.append(el('div','st-q','Результат: '+sc+' из '+qs.length+(sc===qs.length?'. Отлично!':sc>=qs.length/2?'. Неплохо, повторите ошибки.':'. Стоит повторить тему.')));const again=el('button','chip on','Новый тест');again.onclick=()=>stRun('quiz');out.append(again);return}
    const q=qs[i];out.append(el('div','st-h','ВОПРОС '+(i+1)+' ИЗ '+qs.length),el('div','st-q',q.q));
    q.options.forEach((o,k)=>{const b=el('button','opt',o);b.onclick=()=>{out.querySelectorAll('.opt').forEach((x,j)=>{x.disabled=true;if(j===q.correct)x.classList.add('good');else if(j===k)x.classList.add('bad')});if(k===q.correct)sc++;out.append(el('div','st-why',(k===q.correct?'Верно. ':'Неверно. ')+(q.why||'')));const n=el('button','chip on',i+1<qs.length?'Дальше':'Завершить');n.onclick=()=>{i++;show()};out.append(n)};out.append(b)})};
  show()}
function runCards(cards){const queue=cards.slice(),total=cards.length,out=stOut();
  const show=()=>{out.replaceChildren();if(!queue.length){out.append(el('div','st-q','Все карточки выучены 🎉'));const again=el('button','chip on','Ещё карточки');again.onclick=()=>stRun('cards');out.append(again);return}
    const c=queue[0],card=el('button','flash',c.q);let back=false;card.onclick=()=>{back=!back;card.textContent=back?c.a:c.q;card.classList.toggle('back',back)};
    const row=el('div','row2'),again=el('button','chip','Повторить'),ok=el('button','chip on','Знаю');again.onclick=()=>{queue.push(queue.shift());show()};ok.onclick=()=>{queue.shift();show()};row.append(again,ok);
    out.append(el('div','st-h','ОСТАЛОСЬ '+queue.length+' ИЗ '+total+' · НАЖМИ НА КАРТОЧКУ'),card,row)};
  show()}
async function examStep(text){exam.msgs.push({role:'user',content:text});stBusy('Экзаменатор думает…');
  try{const a=await ask([{role:'system',content:'Ты экзаменатор по теме «'+exam.topic+'». Ориентируйся на материал:\n'+exam.src+'\n\nЗадавай по одному вопросу за раз, постепенно усложняя. На ответ студента кратко оцени (верно, частично или неверно), поправь ошибки и задай следующий вопрос. Через 8 вопросов подведи итог с оценкой по 5-балльной шкале и советами. Пиши по-русски без markdown.'},...exam.msgs.slice(-14)],700);exam.msgs.push({role:'assistant',content:a});renderExam(a)}
  catch(e){exam.msgs.pop();stOut().replaceChildren(el('p','hint','Ошибка: '+e.message))}}
function renderExam(a){const out=stOut();out.replaceChildren(el('div','st-q',a));speak(a);
  const ta=el('textarea');ta.rows=3;ta.placeholder='Ваш ответ…';
  const row=el('div','row2'),mic=el('button','chip','🎙 Голосом'),go=el('button','chip on','Ответить'),stop=el('button','chip','Завершить экзамен');
  mic.onclick=()=>{stopAllSpeech();speaking=false;captureText=t=>{ta.value=(ta.value+' '+t).trim()};listen(true)};
  go.onclick=()=>{if(ta.value.trim())examStep(ta.value.trim())};stop.onclick=()=>examStep('Заверши экзамен и подведи итог.');
  row.append(mic,go);out.append(ta,row,stop)}
async function studyPhoto(mode,url){stBusy('Смотрю на фото…');
  try{const a=await ask([{role:'system',content:'Ты репетитор. Отвечай по-русски, без markdown.'},{role:'user',content:[{type:'text',text:mode==='solve'?'На фото учебное задание. Реши его по шагам, объясни каждый шаг и дай итоговый ответ. Если условие неразборчиво, скажи об этом.':'Перепиши весь текст с фото полностью и аккуратно, без комментариев.'},{type:'image_url',image_url:{url}}]}],2000,true);
    if(mode==='ocr'){$('stMat').value=($('stMat').value+'\n'+a).trim();stOut().replaceChildren(el('p','hint','Текст добавлен в поле «Материал». Теперь выберите: Конспект, Тест или Карточки.'))}else stOut().replaceChildren(el('pre','',a))}
  catch(e){stOut().replaceChildren(el('p','hint','Ошибка: '+e.message))}}
document.querySelectorAll('[data-st]').forEach(b=>b.onclick=()=>stRun(b.dataset.st));
$('studyBtn').onclick=()=>openStudy();$('stClose').onclick=()=>$('studyDialog').close();
$('stTopic').addEventListener('change',()=>{const t=$('stTopic').value.trim();if(ST.mat[t]!==undefined)$('stMat').value=ST.mat[t];stScoresShow(t)});
[['stSolveC','solve',()=>takePhoto()],['stSolveG','solve',()=>pickPhoto()],['stOcrC','ocr',()=>takePhoto()],['stOcrG','ocr',()=>pickPhoto()]].forEach(([id,m,f])=>$(id).onclick=()=>{photoMode=m;f()});
$('grantBtn').onclick=()=>{if(NATIVE)Android.grantAll();else log('sys','Разрешения запрашиваются в Android-приложении.')};
const PIPER_URL='https://cdn.jsdelivr.net/npm/@mintplex-labs/piper-tts-web@1.0.4/+esm',PIPER_DEFAULT='ru_RU-irina-medium';
let piperLib=null,piperAudio=null,piperStop=false,piperFailed=false,piperErr='',convo=false,silent=0,gotSpeech=false,wCycle=0,wStream=null;
async function piperLoad(){if(!piperLib){try{piperLib=await import(PIPER_URL)}catch(e){piperLib=null;throw new Error('не удалось загрузить библиотеку ('+(e.message||e)+')')}}return piperLib}
function stopPiper(){piperStop=true;if(piperAudio){const a=piperAudio;piperAudio=null;try{a.pause();a.dispatchEvent(new Event('ended'))}catch{}}}
function stopAllSpeech(){stopPiper();if(NATIVE)Android.stopSpeak();else window.speechSynthesis&&speechSynthesis.cancel()}
function splitText(t){const raw=t.match(/[^.!?…\n]+[.!?…]*/g)||[t],out=[];let cur='';for(const x of raw){if((cur+' '+x).length>240&&cur){out.push(cur.trim());cur=x}else cur+=' '+x}if(cur.trim())out.push(cur.trim());return out.length?out:[t]}
const playBlob=b=>new Promise((res,rej)=>{const a=new Audio(URL.createObjectURL(b));piperAudio=a;a.playbackRate=settings.voiceRate||1;a.onended=()=>{try{URL.revokeObjectURL(a.src)}catch{}res()};a.onerror=()=>rej(new Error('не удалось воспроизвести звук'));a.play().catch(rej)});
async function piperSpeak(text,fallback){
  stopPiper();piperStop=false;speaking=true;stopRec();state('ГОВОРЮ…','ОТВЕТ · PIPER');
  const finish=()=>{speaking=false;idle();if(convo)setTimeout(()=>listen(true),300);else if(always)setTimeout(listen,250)};
  try{
    const lib=await piperLoad(),clean=text.replace(/[*_#`>]/g,'').replace(/\s+/g,' ').trim();
    if(!clean)return finish();
    const parts=splitText(clean),synth=t=>lib.predict({text:t,voiceId:settings.piperVoice||PIPER_DEFAULT});
    let next=synth(parts[0]);
    for(let i=0;i<parts.length;i++){
      const blob=await next;if(piperStop)return;
      next=i+1<parts.length?synth(parts[i+1]):null;if(next)next.catch(()=>{});
      await playBlob(blob);if(piperStop)return}
    finish()
  }catch(e){if(piperStop)return;speaking=false;piperFailed=true;piperErr=String(e.message||e);fallback()}}
async function piperUI(){
  $('piperBox').style.display=settings.voiceKind==='piper'?'block':'none';
  $('vEngLbl').style.display=$('vVoiceLbl').style.display=settings.voiceKind==='piper'?'none':(NATIVE?'':'none');if(!NATIVE)$('vEngLbl').style.display='none';
  if(settings.voiceKind!=='piper')return;
  const sel=$('pVoice');$('pHint').textContent='Загружаю список голосов…';
  try{const lib=await piperLoad();let ids=[];try{const v=await lib.voices();ids=(Array.isArray(v)?v.map(x=>x.key||x):Object.keys(v)).filter(k=>String(k).startsWith('ru_RU'))}catch{}
    if(!ids.length)ids=['ru_RU-irina-medium','ru_RU-denis-medium','ru_RU-dmitri-medium','ru_RU-ruslan-medium'];
    const st=await lib.stored().catch(()=>[]);sel.replaceChildren();ids.forEach(k=>opt(sel,k,k+(st.includes(k)?' ✓ скачан':''),k===(settings.piperVoice||PIPER_DEFAULT)));
    $('pHint').textContent=(piperErr?'Последняя ошибка: '+piperErr+'. ':'')+(st.includes(sel.value)?'Голос скачан и готов.':'Нажмите «Скачать и включить голос» (несколько десятков МБ).')}
  catch(e){$('pHint').textContent='Не удалось загрузить Piper: '+(e.message||e)+'. Нужен интернет.'}}
$('vStt').onchange=()=>{settings.sttKind=$('vStt').value;saveSet();stopRec()};
$('vKind').onchange=()=>{settings.voiceKind=$('vKind').value;piperFailed=false;piperErr='';saveSet();piperUI()};
$('pDownload').onclick=async()=>{const id=$('pVoice').value;if(!id)return;$('pBar').style.width='0';$('pHint').textContent='Загружаю библиотеку…';
  try{const lib=await piperLoad();await lib.download(id,p=>{const pc=p.total?Math.round(p.loaded*100/p.total):0;$('pBar').style.width=pc+'%';$('pHint').textContent='Скачиваю: '+pc+'%'});
    settings.piperVoice=id;settings.voiceKind='piper';piperFailed=false;piperErr='';saveSet();$('pBar').style.width='100%';$('pHint').textContent='Готово. Голос сохранён в браузере.';sample()}
  catch(e){$('pHint').textContent='Не удалось скачать: '+(e.message||e)}};
$('pVoice').onchange=()=>{settings.piperVoice=$('pVoice').value;saveSet()};
function setConvo(on,passive){convo=on;silent=0;gotSpeech=false;const b=$('convoBtn');b.classList.toggle('on',on);b.textContent=on?'💬 Разговор: вкл':'💬 Разговор';
  if(on){always=false;setWake();if(!passive){stopAllSpeech();speaking=false;listen(true)}}else{stopRec();idle()}}
$('convoBtn').onclick=()=>setConvo(!convo);
const wKey=()=>{const p=P.list.find(p=>p.key&&/groq\.com/.test(p.base));return p?p.key:null};
function recordUtterance(maxWait,my){return new Promise((resolve,reject)=>{
  const ctx=new(window.AudioContext||window.webkitAudioContext)();if(ctx.resume)ctx.resume();
  const src=ctx.createMediaStreamSource(wStream),an=ctx.createAnalyser();an.fftSize=1024;src.connect(an);
  const buf=new Float32Array(an.fftSize),chunks=[];let rec;
  try{rec=new MediaRecorder(wStream)}catch(e){ctx.close();return reject(new Error('запись звука не поддерживается'))}
  let keep=false,done=false,floor=0,n=0,thr=.02,voiced=0,lastVoice=0,spoke=false;const t0=performance.now();
  rec.ondataavailable=e=>{if(e.data&&e.data.size)chunks.push(e.data)};
  rec.onstop=()=>{try{ctx.close()}catch{}resolve(keep&&chunks.length?new Blob(chunks,{type:rec.mimeType||'audio/webm'}):null)};
  const stop=k=>{if(done)return;done=true;keep=k;clearInterval(iv);try{rec.stop()}catch{resolve(null)}};
  const iv=setInterval(()=>{an.getFloatTimeDomainData(buf);let sum=0;for(const v of buf)sum+=v*v;const rms=Math.sqrt(sum/buf.length),t=performance.now()-t0;
    if(wCycle!==my)return stop(false);
    if(t<400){floor=(floor*n+rms)/(n+1);n++;thr=Math.max(.018,floor*3.5);return}
    if(rms>thr){voiced++;lastVoice=t;if(voiced>=3)spoke=true}else if(!spoke)voiced=0;
    if(spoke&&(t-lastVoice>1100||t>20000))return stop(true);
    if(!spoke&&t>maxWait)return stop(false)},50);
  rec.start(250)})}
async function transcribe(blob,key){
  const fd=new FormData();fd.append('file',blob,blob.type.includes('mp4')?'speech.m4a':'speech.webm');fd.append('model','whisper-large-v3-turbo');fd.append('language','ru');fd.append('temperature','0');fd.append('prompt','Джарвис. Команды голосовому ассистенту на русском языке.');
  const r=await fetch('https://api.groq.com/openai/v1/audio/transcriptions',{method:'POST',headers:{Authorization:'Bearer '+key},body:fd});
  let d;try{d=await r.json()}catch{throw new Error('HTTP '+r.status)}
  if(!r.ok)throw new Error((d.error&&d.error.message)||('HTTP '+r.status));return(d.text||'').trim()}
async function whisperListen(once){
  const my=++wCycle;listening=true;onceMode=!!once;
  const key=wKey();if(!key){listening=false;log('sys','Для режима Whisper добавьте нейросеть Groq с ключом (чип ◉ вверху).','error');return}
  if(!wStream||!wStream.active){try{wStream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}})}catch(e){listening=false;return micErr('not-allowed')}}
  if(wCycle!==my)return;started();
  let blob=null;try{blob=await recordUtterance(once?8000:8000,my)}catch(e){log('sys','Ошибка записи: '+e.message,'error')}
  if(wCycle!==my)return;
  if(!blob){if(once)micErr('no-speech');return ended()}
  state('РАСПОЗНАЮ…','WHISPER');
  try{const t=await transcribe(blob,key);if(wCycle!==my)return;listening=false;
    if(t.length>1&&!(t.length<60&&/(субтитр|продолжение следует|спасибо за просмотр|подписывайтесь|корректор)/i.test(t)))gotText(t)}
  catch(e){listening=false;log('sys','Whisper: '+e.message,'error')}
  ended()}
let chkWait=false;
function saveSet(){write('jarvis_settings',settings)}
function opt(sel,v,l,on){const o=document.createElement('option');o.value=v;o.textContent=l;if(on)o.selected=true;sel.append(o)}
function loadVoices(){
  const sel=$('vVoice');sel.replaceChildren();let list=[];
  if(NATIVE){try{const i=JSON.parse(Android.ttsInfo()),e=$('vEngine');e.replaceChildren();i.engines.forEach(x=>opt(e,x.n,x.l,x.n===i.engine));list=i.voices.map(v=>[v.n,v.l]);
    $('vHint').textContent=list.length?'Русских голосов: '+list.length+'.':'У выбранного движка нет русских голосов. Установите русский голос в системных настройках синтеза речи (кнопка ниже).'}catch{$('vHint').textContent='Не удалось получить список голосов.'}}
  else{$('vEngLbl').style.display='none';list=(window.speechSynthesis?speechSynthesis.getVoices():[]).filter(v=>v.lang&&v.lang.startsWith('ru')).map(v=>[v.name,v.name+' ('+v.lang+')']);$('vHint').textContent=list.length?'':'В браузере нет русских голосов. На ПК попробуйте Edge.'}
  opt(sel,'','По умолчанию (системный)');list.forEach(([n,l])=>opt(sel,n,l));sel.value=settings.voiceName||''}
function openVoice(){$('vStt').value=settings.sttKind||'';$('vKind').value=settings.voiceKind||'system';$('vRate').value=settings.voiceRate||1;$('vPitch').value=settings.voicePitch||1;$('vRateV').textContent=(+$('vRate').value).toFixed(2);$('vPitchV').textContent=(+$('vPitch').value).toFixed(2);loadVoices();piperUI();if(!$('voiceDialog').open)$('voiceDialog').showModal()}
const sample=()=>speak('Здравствуйте. Я JARVIS, ваш ассистент. Так звучит выбранный голос.');
$('vVoice').onchange=()=>{settings.voiceName=$('vVoice').value;saveSet();if(NATIVE)Android.setVoice(settings.voiceName);sample()};
$('vEngine').onchange=()=>{settings.ttsEngine=$('vEngine').value;settings.voiceName='';saveSet();if(NATIVE){Android.setVoice('');Android.setEngine(settings.ttsEngine)}$('vHint').textContent='Переключаю движок…'};
$('vRate').oninput=()=>{settings.voiceRate=+$('vRate').value;$('vRateV').textContent=settings.voiceRate.toFixed(2);saveSet()};
$('vPitch').oninput=()=>{settings.voicePitch=+$('vPitch').value;$('vPitchV').textContent=settings.voicePitch.toFixed(2);saveSet()};
$('vTest').onclick=sample;$('vSys').onclick=()=>NATIVE?Android.ttsSettings():($('vHint').textContent='На ПК голоса выбираются в настройках системы или браузера.');
$('vClose').onclick=()=>$('voiceDialog').close();$('openVoice').onclick=openVoice;
window.onNativeTtsReady=()=>{if($('voiceDialog').open)loadVoices()};
if(window.speechSynthesis)speechSynthesis.onvoiceschanged=()=>{if($('voiceDialog').open)loadVoices()};
if(NATIVE){Android.setVoice(settings.voiceName||'');if(settings.ttsEngine)Android.setEngine(settings.ttsEngine)}
function chkLine(id,ic,t,d){let r=document.getElementById('chk_'+id);if(!r){r=el('div','chkrow');r.id='chk_'+id;$('chkList').append(r)}r.replaceChildren(el('b','',ic+' '+t),el('small','',d||''))}
async function runCheck(){
  $('chkList').replaceChildren();
  chkLine('p','ℹ️','Платформа',NATIVE?'Android-приложение':'Браузер');
  let info=null;if(NATIVE){try{info=JSON.parse(Android.checkInfo())}catch{}}
  if(NATIVE&&info)chkLine('mic',info.mic?'✅':'❌','Микрофон',info.mic?'Доступ есть.':'Нет доступа. Настройки → «Выдать разрешения телефона».');
  else{try{const st=await navigator.mediaDevices.getUserMedia({audio:true});st.getTracks().forEach(t=>t.stop());chkLine('mic','✅','Микрофон','Доступ есть.')}catch(e){chkLine('mic','❌','Микрофон','Нет доступа ('+e.name+'). Разрешите микрофон для сайта.')}}
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition,rec=NATIVE&&info?info.recog:!!SR;
  chkLine('rec',rec?'✅':'❌','Распознавание речи',rec?'Доступно.':NATIVE?'Не найдено. Установите или обновите приложение «Google» (или «Речевые службы Google») в Google Play.':'Не поддерживается этим браузером. Используйте Chrome или Edge.');
  if(NATIVE&&info){chkLine('tts',info.tts?'✅':'❌','Синтез речи',info.tts?'Движок: '+(info.engine||'по умолчанию'):'Не запущен. Проверьте Настройки Android → Синтез речи.');chkLine('ru',info.ru>0?'✅':'⚠️','Русский голос',info.ru>0?'Найдено голосов: '+info.ru+'.':'У этого движка нет русского голоса. Загрузите его в приложении движка (для RHVoice: вкладка языков, Русский).')}
  else{const n=window.speechSynthesis?speechSynthesis.getVoices().filter(v=>v.lang&&v.lang.startsWith('ru')).length:0;chkLine('tts',window.speechSynthesis?'✅':'❌','Синтез речи',window.speechSynthesis?'Доступен.':'Не поддерживается.');chkLine('ru',n?'✅':'⚠️','Русский голос',n?'Найдено голосов: '+n+'.':'Русских голосов нет. На ПК попробуйте Edge.')}
  try{const ac=new AbortController();setTimeout(()=>ac.abort(),6000);await fetch('https://www.gstatic.com/generate_204',{mode:'no-cors',signal:ac.signal,cache:'no-store'});chkLine('net','✅','Интернет','Соединение есть.')}catch{chkLine('net','❌','Интернет','Нет соединения. Распознавание речи и нейросети требуют интернета.')}
  if(settings.sttKind==='whisper'){const k=wKey();chkLine('stt',k?'✅':'❌','Whisper (Groq)',k?'Ключ Groq найден. Слух идёт через запись и Whisper.':'Не найден ключ Groq: добавьте нейросеть Groq (чип ◉ вверху).')}
  if(settings.voiceKind==='piper'){chkLine('piper','⏳','Нейроголос Piper','Проверяю…');try{const lib=await piperLoad(),st=await lib.stored(),ok=st.includes(settings.piperVoice);chkLine('piper',ok?'✅':'⚠️','Нейроголос Piper',ok?'Голос скачан: '+settings.piperVoice+(piperErr?'. Последняя ошибка: '+piperErr:''):'Голос ещё не скачан: Голос и озвучка, затем «Скачать и включить голос».')}catch(e){chkLine('piper','❌','Нейроголос Piper','Не загрузился: '+String(e.message||e).slice(0,140)+'. При первом запуске нужен интернет.')}}
  const ps=P.list.filter(p=>p.key);
  if(!ps.length)chkLine('ai','⚠️','Нейросеть','Не добавлена. Нажмите чип ◉ вверху и добавьте ключ.');
  for(const p of ps){chkLine('ai'+p.id,'⏳',p.name,'Проверяю…');try{const a=await callP(p,[{role:'user',content:'Ответь одним словом: ок'}],40);chkLine('ai'+p.id,'✅',p.name,'Ответила: '+a.slice(0,40))}catch(e){chkLine('ai'+p.id,'❌',p.name,String(e.message).slice(0,160))}}}
function openCheck(){if(!$('checkDialog').open)$('checkDialog').showModal();runCheck()}
$('chkRun').onclick=runCheck;$('checkBtn').onclick=$('openCheck').onclick=openCheck;$('cClose').onclick=()=>$('checkDialog').close();
$('chkSay').onclick=()=>speak('Проверка голоса. Если вы это слышите, синтез речи работает.');
$('chkHear').onclick=()=>{chkWait=true;chkLine('hear','🎙','Тест слуха','Скажите любую фразу…');captureText=t=>{chkWait=false;chkLine('hear','✅','Тест слуха','Услышал: «'+t+'»')};listen(true);setTimeout(()=>{if(chkWait){chkWait=false;captureText=null;chkLine('hear','❌','Тест слуха','Ничего не услышано за 10 секунд. Проверьте микрофон и интернет.')}},10000)};
updateClock();refreshProv();autosize();setInterval(updateClock,15000);renderHistory();reminders=reminders.filter(r=>r.at>Date.now());write('jarvis_rem',reminders);reminders.forEach(arm);
if('serviceWorker'in navigator&&!NATIVE&&location.protocol.startsWith('http'))navigator.serviceWorker.register('./sw.js').catch(()=>{});
