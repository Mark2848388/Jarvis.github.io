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
function row(who,msg,type){const r=document.createElement('div');r.className='log-line '+(type||'system');const t=document.createElement('time');t.textContent=who==='user'?'YOU':who==='jarvis'?'J.AI':'SYS';const s=document.createElement('span');s.textContent=msg;r.append(t,s);$('log').append(r);$('log').scrollTop=$('log').scrollHeight}
function log(who,msg,type='system'){row(who,msg,type);if(settings.saveHistory){history.push({who,msg,type});history=history.slice(-60);write('jarvis_history',history)}}
function renderHistory(){if(settings.saveHistory)for(const x of history.slice(-12))row(x.who,x.msg,x.who==='user'?'user':x.type)}
function state(cap,status){$('coreCaption').textContent=cap;$('statusText').textContent=status;$('core').classList.toggle('listening',listening)}
function idle(){state(always?'ЖДУ СЛОВО «ДЖАРВИС»':'ГОТОВ К КОМАНДЕ',always?'РЕЖИМ ОЖИДАНИЯ':'СИСТЕМА ГОТОВА')}
function speak(text){
  if(NATIVE&&settings.voiceReplies){speaking=true;stopRec();state('ГОВОРЮ…','ОТВЕТ');window.onNativeSpeakDone=()=>{speaking=false;idle();if(always)setTimeout(listen,250)};Android.speak(text.replace(/[*_#`]/g,''),settings.personality==='tactical'?1.1:1);return}
  if(!settings.voiceReplies||!('speechSynthesis'in window)){if(always)listen();return}
  speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(text.replace(/[*_#`]/g,''));u.lang='ru-RU';u.rate=settings.personality==='tactical'?1.05:.96;u.pitch=.9;
  const v=speechSynthesis.getVoices().find(v=>v.lang&&v.lang.startsWith('ru'));if(v)u.voice=v;
  speaking=true;stopRec();
  const end=()=>{speaking=false;idle();if(always)setTimeout(listen,250)};u.onend=end;u.onerror=end;speechSynthesis.speak(u)}
function say(text){$('reply').textContent=text;log('jarvis',text);speak(text)}
function updateClock(){$('clock').textContent=now();const h=new Date().getHours();$('greetingTitle').textContent=(h<5?'Доброй ночи':h<12?'Доброе утро':h<18?'Добрый день':'Добрый вечер')+(settings.ownerName?', '+settings.ownerName:'')+'.'}
const APPS={'youtube':['https://www.youtube.com','com.google.android.youtube'],'ютуб':['https://www.youtube.com','com.google.android.youtube'],'телеграм':['https://t.me','org.telegram.messenger'],'telegram':['https://t.me','org.telegram.messenger'],'ватсап':['https://wa.me','com.whatsapp'],'whatsapp':['https://wa.me','com.whatsapp'],'карты':['https://maps.google.com','com.google.android.apps.maps'],'google':['https://www.google.com',''],'гугл':['https://www.google.com',''],'почту':['https://mail.google.com','com.google.android.gm'],'почта':['https://mail.google.com','com.google.android.gm'],'инстаграм':['https://www.instagram.com','com.instagram.android'],'вк':['https://vk.com','com.vkontakte.android'],'спотифай':['https://open.spotify.com','com.spotify.music'],'браузер':['https://www.google.com',''],'переводчик':['https://translate.google.com','com.google.android.apps.translate']};
function go(url,pkg){setTimeout(()=>{if(NATIVE){Android.openUrl(url,pkg||'');return}if(pkg){const u=new URL(url);location.href=`intent://${u.host}${u.pathname}#Intent;scheme=https;package=${pkg};S.browser_fallback_url=${encodeURIComponent(url)};end`}else location.href=url},1200)}
function help(){return 'Я умею: время и дата; погода («погода в Вене»); посчитай («посчитай 15 умножить на 4»); таймер и напоминания («напомни через 10 минут позвонить маме»); заметки («запомни…», «покажи заметки», «удали заметку 2»); открыть приложение или сайт; поиск; видео и музыка («включи музыку Imagine Dragons»); маршрут («маршрут до вокзала»); звонок («позвони +4366412345»); заряд батареи; кубик и монетка; любые вопросы через ИИ. Включи режим «Джарвис» внизу — и я буду слушать, пока приложение открыто.'}
function dur(n,u){n=+n;return n*(/^сек/.test(u)?1000:/^мин/.test(u)?60000:3600000)}
function addReminder(ms,text){const r={at:Date.now()+ms,text};reminders.push(r);write('jarvis_rem',reminders);arm(r);if('Notification'in window&&Notification.permission==='default')Notification.requestPermission()}
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
async function ai(text){
  if(!settings.aiKey){say('Это вопрос для языковой модели. Подключите ИИ: Настройки, затем API-ключ. Подойдёт бесплатный ключ Groq или OpenRouter.');return}
  state('ДУМАЮ…','ОБРАБОТКА ЗАПРОСА');
  const style={formal:'спокойно, умно и лаконично, с лёгкой иронией, как Джарвис Тони Старка',friendly:'дружелюбно и остроумно',tactical:'максимально кратко'}[settings.personality];
  const sys=`Ты JARVIS — голосовой ассистент на телефоне. Отвечай по-русски ${style}, обычно 1-3 предложения, без markdown и списков. Обращайся к пользователю: «${settings.ownerName||'сэр'}». Сейчас ${new Date().toLocaleString('ru-RU')}. Заметки пользователя: ${notes.join('; ')||'нет'}.`;
  chat.push({role:'user',content:text});chat=chat.slice(-12);
  try{const r=await fetch(settings.aiBase.replace(/\/$/,'')+'/chat/completions',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+settings.aiKey},body:JSON.stringify({model:settings.aiModel,messages:[{role:'system',content:sys},...chat],max_tokens:/gpt-oss/.test(settings.aiModel)?1500:350,.../gpt-oss/.test(settings.aiModel)?{reasoning_effort:'low'}:{}})});
    const d=await r.json();if(!r.ok)throw new Error(d.error&&d.error.message||r.status);
    const a=(d.choices[0].message.content||'').trim();if(!a)throw new Error('пустой ответ модели');chat.push({role:'assistant',content:a});write('jarvis_chat',chat);say(a)}
  catch(e){chat.pop();say('Не удалось связаться с ИИ: '+e.message)}}
function handleCommand(raw){const c=raw.trim();if(!c)return;log('user',c,'user');$('textCommand').value='';const s=c.toLowerCase().replace(/[!?.,]/g,'').trim();let m;
if(/^(привет|здравствуй|добрый день|доброе утро|добрый вечер|здарова)/.test(s))return say(settings.personality==='tactical'?'На связи. Жду задачу.':`Привет${settings.ownerName?', '+settings.ownerName:''}. Все системы в норме. Что делаем?`);
if(/^(помощь|что ты умеешь|команды)/.test(s))return say(help());
if(/который час|сколько времени|текущее время/.test(s))return say('Сейчас '+new Date().toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'})+'.');
if(/какое сегодня число|какая сегодня дата|какой сегодня день|сегодняшняя дата/.test(s))return say('Сегодня '+new Date().toLocaleDateString('ru-RU',{weekday:'long',year:'numeric',month:'long',day:'numeric'})+'.');
if(/как тебя зовут|кто ты/.test(s))return say('Я JARVIS Mobile, ваш персональный ассистент: голос, команды, память и языковая модель.');
if(m=s.match(/меня зовут\s+(.+)/)){settings.ownerName=m[1];write('jarvis_settings',settings);updateClock();return say('Рад знакомству, '+m[1]+'.')}
if(/погод/.test(s)){m=s.match(/погод\w*\s+(?:в|во|для)\s+(.+?)(?:\s+(?:сейчас|сегодня))?$/);return weather(m&&m[1])}
if(m=s.match(/^(?:посчитай|сколько будет|вычисли|реши)\s+(.+)/)){const r=calc(m[1]);if(r!==null)return say(m[1]+' = '+r)}
if(/заряд|батаре/.test(s)){return navigator.getBattery?navigator.getBattery().then(b=>say(`Заряд ${Math.round(b.level*100)} процентов${b.charging?', идёт зарядка':''}.`)):say('Браузер не сообщает заряд батареи.')}
if(/(брось|кинь) кубик/.test(s))return say('Выпало '+(1+Math.floor(Math.random()*6))+'.');
if(/(подбрось|брось|кинь) (монет|орёл)/.test(s))return say(Math.random()<.5?'Орёл.':'Решка.');
if(m=s.match(/случайное число от (\d+) до (\d+)/)){const a=+m[1],b=+m[2];return say('Число: '+(Math.min(a,b)+Math.floor(Math.random()*(Math.abs(b-a)+1))))}
if(m=s.match(/напомни(?:ть)?\s+(?:мне\s+)?через\s+(\d+)\s*(\S+)\s*(?:что\s+|о\s+|про\s+|чтобы\s+)?(.*)/)){const ms=dur(m[1],m[2]),t=m[3]||'Время вышло';addReminder(ms,t);return say(`Напомню через ${m[1]} ${m[2]}: ${t}. Приложение должно оставаться открытым.`)}
if(m=s.match(/таймер.*?(\d+)\s*(сек\S*|мин\S*|час\S*)/)||s.match(/через\s+(\d+)\s*(сек\S*|мин\S*|час\S*)/)){addReminder(dur(m[1],m[2]),'Таймер завершён.');return say(`Таймер установлен: ${m[1]} ${m[2]}. Приложение должно оставаться открытым.`)}
if(/покажи заметки|мои заметки|список заметок/.test(s))return say(notes.length?'Твои заметки: '+notes.map((n,i)=>`${i+1}. ${n}`).join('; '):'Заметок пока нет. Скажи: запомни, и текст.');
if(m=s.match(/удали заметку (\d+)/)){const i=+m[1]-1;if(notes[i]!==undefined){notes.splice(i,1);write('jarvis_notes',notes);return say('Заметка удалена.')}return say('Нет заметки с таким номером.')}
if(/очисти заметки|удали все заметки|забудь всё|забудь все/.test(s)){notes=[];chat=[];write('jarvis_notes',notes);write('jarvis_chat',chat);return say('Память очищена.')}
if(/создай заметку|новая заметка|запиши заметку/.test(s)){$('noteText').value='';return $('noteDialog').showModal()}
if(m=c.match(/^(?:запомни|сохрани|добавь заметку|запиши)(?:,)?(?: что)?\s*[:,-]?\s*(.+)$/i)){notes.push(m[1]);write('jarvis_notes',notes);return say('Записал: '+m[1])}
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
function stopRec(){listening=false;try{NATIVE?Android.stopListen():recognition&&recognition.abort()}catch{}}
function gotText(t){if(!t)return;if(!onceMode){const w=t.match(/(джарвис|жарвис|джарвиз|jarvis|гарвис)[,\s]*/i);if(!w)return;const r=t.slice(w.index+w[0].length).trim();return r?handleCommand(r):say('Слушаю, '+(settings.ownerName||'сэр')+'.')}handleCommand(t)}
function micErr(e){if(e==='not-allowed'||e==='service-not-allowed'){always=false;setWake();log('sys','Нет доступа к микрофону. Разрешите его в настройках Android.','error')}else if(e!=='no-speech'&&e!=='aborted')log('sys','Ошибка микрофона: '+e,'error')}
function started(){listening=true;const w=always&&!onceMode;$('micLabel').textContent=w?'ЖДУ «ДЖАРВИС»':'СЛУШАЮ ТЕБЯ…';state(w?'ЖДУ СЛОВО «ДЖАРВИС»':'ОЖИДАЮ КОМАНДУ','ГОЛОСОВОЙ ВВОД АКТИВЕН')}
function ended(){listening=false;$('micLabel').textContent='НАЖМИ И ГОВОРИ';idle();if(always&&!speaking)setTimeout(()=>listen(false),350)}
window.onNativeSpeechStart=started;window.onNativeSpeech=gotText;window.onNativeSpeechError=micErr;window.onNativeSpeechEnd=ended;window.onNativeError=m=>log('sys',m,'error');
function listen(once){if(speaking||listening)return;onceMode=!!once;
  if(NATIVE){listening=true;Android.listen();return}
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;if(!SR)return;
  recognition=new SR();recognition.lang='ru-RU';recognition.interimResults=false;
  recognition.onstart=started;recognition.onresult=e=>gotText(e.results[e.results.length-1][0].transcript.trim());recognition.onerror=e=>micErr(e.error);recognition.onend=ended;
  try{recognition.start()}catch{listening=false}}
function micClick(){if(!NATIVE&&!(window.SpeechRecognition||window.webkitSpeechRecognition))return say('Распознавание речи недоступно. Откройте JARVIS в Chrome или установите Android-приложение.');if(listening){stopRec();ended();return}if(NATIVE)Android.stopSpeak();else window.speechSynthesis&&speechSynthesis.cancel();speaking=false;listen(true)}
function setWake(){$('wakeBtn').textContent='СЛУШАТЬ «ДЖАРВИС»: '+(always?'ВКЛ':'ВЫКЛ');$('wakeBtn').classList.toggle('on',always)}
async function wake(){always=!always;setWake();
  if(always){try{NATIVE?Android.keepAwake(true):wakeLock=await navigator.wakeLock.request('screen')}catch{}listen(false);say('Режим ожидания включён. Скажите «Джарвис» и команду. Экран должен оставаться включённым.')}
  else{stopRec();try{NATIVE?Android.keepAwake(false):wakeLock&&wakeLock.release()}catch{}idle()}}
document.addEventListener('visibilitychange',async()=>{if(always&&document.visibilityState==='visible'){try{wakeLock=await navigator.wakeLock.request('screen')}catch{}listen()}});
let lastPhoto=null;
function thumb(url){const r=document.createElement('div');r.className='log-line user';const t=document.createElement('time');t.textContent='YOU';const i=document.createElement('img');i.src=url;i.style.cssText='max-height:90px;border-radius:8px;border:1px solid #1d465d';r.append(t,i);$('log').append(r);$('log').scrollTop=$('log').scrollHeight}
async function vision(q,url){
  if(!settings.visKey)return say('Для распознавания фото нужен ключ: Настройки, раздел «Распознавание фото». Бесплатный ключ выдаёт Google AI Studio.');
  state('СМОТРЮ…','АНАЛИЗ ИЗОБРАЖЕНИЯ');
  try{const r=await fetch(settings.visBase.replace(/\/$/,'')+'/chat/completions',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+settings.visKey},body:JSON.stringify({model:settings.visModel,max_tokens:1500,messages:[{role:'system',content:'Ты JARVIS, голосовой ассистент. Отвечай по-русски кратко и по делу, без markdown. Если на фото есть текст, прочитай или переведи его по просьбе.'},{role:'user',content:[{type:'text',text:q},{type:'image_url',image_url:{url}}]}]})});
    const d=await r.json();if(!r.ok)throw new Error(((Array.isArray(d)?d[0]:d).error||{}).message||r.status);
    const a=(d.choices[0].message.content||'').trim();if(!a)throw new Error('пустой ответ модели');say(a)}
  catch(e){say('Не удалось распознать фото: '+e.message)}}
function gotPhoto(url){lastPhoto=url;thumb(url);vision('Опиши, что на фото. Если там есть текст, прочитай его.',url)}
window.onNativePhoto=gotPhoto;
function readFile(f){if(!f)return;const img=new Image(),u=URL.createObjectURL(f);img.onload=()=>{const k=Math.min(1,1024/Math.max(img.width,img.height)),c=document.createElement('canvas');c.width=img.width*k;c.height=img.height*k;c.getContext('2d').drawImage(img,0,0,c.width,c.height);URL.revokeObjectURL(u);gotPhoto(c.toDataURL('image/jpeg',.8))};img.src=u}
function takePhoto(){NATIVE?Android.takePhoto():$('fileIn').click()}
function pickPhoto(){NATIVE?Android.pickPhoto():$('fileIn').click()}
$('fileIn').onchange=e=>{readFile(e.target.files[0]);e.target.value=''};
$('photoBtn').onclick=takePhoto;$('galleryBtn').onclick=pickPhoto;
async function listModels(base,key){$('settingsDialog').close();try{const r=await fetch(base.replace(/\/$/,'')+'/models',{headers:{Authorization:'Bearer '+key}});const d=await r.json();const ids=(d.data||d.models||[]).map(m=>(m.id||m.name||'').replace(/^models\//,'')).filter(Boolean);say(ids.length?'Доступные модели: '+ids.slice(0,40).join(', '):'Список пуст: '+JSON.stringify(d).slice(0,200))}catch(e){say('Не удалось получить список моделей: '+e.message)}}
$('modelsAi').onclick=()=>listModels($('aiBase').value.trim()||defaults.aiBase,$('aiKey').value.trim());
$('modelsVis').onclick=()=>listModels($('visBase').value.trim()||defaults.visBase,$('visKey').value.trim());
$('micBtn').addEventListener('click',micClick);$('wakeBtn').addEventListener('click',wake);
$('sendBtn').addEventListener('click',()=>handleCommand($('textCommand').value));$('textCommand').addEventListener('keydown',e=>{if(e.key==='Enter')handleCommand($('textCommand').value)});
document.querySelectorAll('[data-command]').forEach(b=>b.addEventListener('click',()=>handleCommand(b.dataset.command)));
$('settingsBtn').onclick=()=>{for(const k of['ownerName','personality','aiBase','aiModel','aiKey','city','visBase','visModel','visKey'])$(k).value=settings[k];$('voiceReplies').checked=settings.voiceReplies;$('saveHistory').checked=settings.saveHistory;$('settingsDialog').showModal()};
$('saveSettings').onclick=()=>{settings={ownerName:$('ownerName').value.trim(),personality:$('personality').value,voiceReplies:$('voiceReplies').checked,saveHistory:$('saveHistory').checked,aiBase:$('aiBase').value.trim()||defaults.aiBase,aiModel:$('aiModel').value.trim()||defaults.aiModel,aiKey:$('aiKey').value.trim(),city:$('city').value.trim(),visBase:$('visBase').value.trim()||defaults.visBase,visModel:$('visModel').value.trim()||defaults.visModel,visKey:$('visKey').value.trim()};write('jarvis_settings',settings);if(!settings.saveHistory){history=[];write('jarvis_history',[]);$('log').replaceChildren()}updateClock();say('Настройки сохранены.')};
$('saveNote').onclick=()=>{const n=$('noteText').value.trim();if(n){notes.push(n);write('jarvis_notes',notes);say('Заметка сохранена.')}};
$('clearLog').onclick=()=>{history=[];write('jarvis_history',[]);$('log').replaceChildren();log('sys','Журнал очищен.')};
updateClock();setInterval(updateClock,15000);renderHistory();reminders=reminders.filter(r=>r.at>Date.now());write('jarvis_rem',reminders);reminders.forEach(arm);
if('serviceWorker'in navigator&&!NATIVE&&location.protocol.startsWith('http'))navigator.serviceWorker.register('./sw.js').catch(()=>{});
