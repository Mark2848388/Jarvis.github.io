/* ВЕКТОР — Учёба 3.0: полноценное приложение внутри приложения.
   Вкладки: Главная · Курсы · Повтор · Практика · Прогресс. Подключается после app.js и ext.js. */
(function(){
SD.goal=SD.goal||50;SD.daily=SD.daily||{};SD.badges=SD.badges||[];SD.tutor=SD.tutor||[];SD.focusMin=SD.focusMin||0;
const DAYS=n=>Array.from({length:n},(_,i)=>day(Date.now()-(n-1-i)*864e5));
const today=()=>SD.daily[day()]||0;

/* ---------- награды ---------- */
const BADGES=[
  {id:'first',e:'🎯',t:'Первый урок',ok:()=>SD.courses.some(c=>c.lessons.some(l=>l.done))},
  {id:'s3',e:'🔥',t:'Серия 3 дня',ok:()=>SD.streak.n>=3},
  {id:'s7',e:'⚡',t:'Серия 7 дней',ok:()=>SD.streak.n>=7},
  {id:'xp100',e:'⭐',t:'100 XP',ok:()=>SD.xp>=100},
  {id:'xp500',e:'🏆',t:'500 XP',ok:()=>SD.xp>=500},
  {id:'cards',e:'🗂',t:'20 карточек',ok:()=>SD.deck.length>=20},
  {id:'perfect',e:'💯',t:'Идеальный тест',ok:()=>SD.hist.some(h=>h.n>=3&&h.s===h.n)},
  {id:'course',e:'🎓',t:'Курс пройден',ok:()=>SD.courses.some(c=>c.lessons.length&&c.lessons.every(l=>l.done))},
  {id:'focus',e:'🧘',t:'100 минут фокуса',ok:()=>SD.focusMin>=100}];
function checkBadges(){for(const b of BADGES)if(!SD.badges.includes(b.id)&&b.ok()){SD.badges.push(b.id);flash('Награда: '+b.e+' '+b.t)}}
addXp=function(n){SD.xp+=n;const t=day();SD.daily[t]=(SD.daily[t]||0)+n;if(SD.streak.last!==t){SD.streak.n=SD.streak.last===day(Date.now()-864e5)?SD.streak.n+1:1;SD.streak.last=t}
  const k=Object.keys(SD.daily).sort();while(k.length>60)delete SD.daily[k.shift()];checkBadges();sv()};

/* ---------- каркас: вкладки ---------- */
const TAB={home:'home',courses:'courses',new:'courses',course:'courses',lesson:'courses',review:'review',practice:'practice',quick:'practice',essay:'practice',focus:'practice',tutor:'practice',exam:'practice',gen:'practice',stats:'stats'};
const tabs=el('div','sttabs');
[['home','cap','Главная'],['courses','book','Курсы'],['review','repeat','Повтор'],['practice','target','Практика'],['stats','chart','Прогресс']].forEach(([k,i,t])=>{const b=el('button');b.dataset.k=k;b.insertAdjacentHTML('afterbegin',ic(i));b.append(el('span',null,t));b.onclick=()=>nav(k);tabs.append(b)});
$('study').append(tabs);
function markTab(){const cur=TAB[stNav.n]||'';tabs.querySelectorAll('button').forEach(b=>{b.classList.toggle('on',b.dataset.k===cur);const d=b.querySelector('.dot');if(d)d.remove();if(b.dataset.k==='review'&&dueCards().length)b.append(el('i','dot',String(Math.min(99,dueCards().length))))})}
let VIEWS={};
nav=function(n,a){stNav={n,a};const o=sb();o.replaceChildren();o.scrollTop=0;(VIEWS[n]||stHome)(a);markTab()};
const photoBtns=()=>[ib('tile','camera','Решить по фото',()=>{photoMode='solve';takePhoto()}),ib('tile','image','Задача из галереи',()=>{photoMode='solve';pickPhoto()}),ib('tile','scan','Текст с фото',()=>{photoMode='ocr';takePhoto()}),ib('tile','image','Текст из галереи',()=>{photoMode='ocr';pickPhoto()})];
const need=o=>{if(noAI()){o.append(el('p','muted','Сначала подключите нейросеть: значок вверху главного экрана.'));return true}return false};
const bar=p=>{const b=el('div','bar'),i=el('i');i.style.width=Math.max(0,Math.min(100,p))+'%';b.append(i);return b};
const section=(o,t)=>o.append(el('h3','',t));

/* ---------- Главная ---------- */
function ring(v,max,top,sub){const C=2*Math.PI*42,p=Math.min(1,v/max),w=el('div','ring');w.innerHTML='<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="42" fill="none" stroke="var(--line)" stroke-width="9"/><circle cx="50" cy="50" r="42" fill="none" stroke="var(--a1)" stroke-width="9" stroke-linecap="round" stroke-dasharray="'+C.toFixed(1)+'" stroke-dashoffset="'+(C*(1-p)).toFixed(1)+'"/></svg>';const t=el('div','rt');t.append(document.createTextNode(top));t.append(el('small',null,sub));w.append(t);return w}
function home(){
  $('stTitle').textContent='Учёба';const o=sb(),L=lvl(),a=50*(L-1)**2,b=50*L*L,due=dueCards().length;
  const hero=el('div','stcard hero'),g=el('div','goal');
  const rg=ring(today(),SD.goal,String(today()),'из '+SD.goal+' XP');rg.onclick=()=>{const o2=[20,50,100,200];SD.goal=o2[(o2.indexOf(SD.goal)+1)%o2.length];sv();nav('home');flash('Цель на день: '+SD.goal+' XP')};
  const gt=el('div');gt.append(el('div','big','Уровень '+L),el('div','muted','Серия: '+SD.streak.n+' дн. · всего '+SD.xp+' XP'),bar(100*(SD.xp-a)/(b-a)),el('div','muted','Нажмите на кольцо, чтобы изменить цель дня'));
  g.append(rg,gt);hero.append(g);o.append(hero);
  const cont=SD.courses.find(c=>c.lessons.some(l=>!l.done));
  if(cont){const k=cont.lessons.findIndex(l=>!l.done),c=el('button','stcard course');c.append(el('div','muted','Продолжить'),el('b','',cont.title),el('div','muted','Урок '+(k+1)+': '+cont.lessons[k].t));c.onclick=()=>nav('lesson',{id:cont.id,k});o.append(c)}
  if(due){const c=el('button','stcard course');c.append(el('b','','К повторению: '+due+' '+(due%10===1&&due!==11?'карточка':'карточек')),el('div','muted','Короткое повторение закрепляет память надолго'));c.onclick=()=>nav('review');o.append(c)}
  section(o,'Быстрый старт');
  const t=el('div','grid2');t.append(ib('tile','spark','Быстрый тест',()=>nav('quick',{})),ib('tile','chat','Репетитор',()=>nav('tutor')),ib('tile','timer','Фокус 25 минут',()=>nav('focus')),ib('tile','plus','Новый курс',()=>nav('new',{})),...photoBtns());o.append(t);
  if(SD.badges.length){section(o,'Награды');const w=el('div','badges');SD.badges.slice(-3).forEach(id=>{const b=BADGES.find(x=>x.id===id);if(b){const d=el('div','bdg');d.append(el('b','',b.e),document.createTextNode(b.t));w.append(d)}});o.append(w)}}

/* ---------- Курсы ---------- */
function courses(){
  $('stTitle').textContent='Курсы';const o=sb();o.append(ib('go','plus','Новый курс',()=>nav('new',{})));
  if(!SD.courses.length)o.append(el('p','muted','Курсов пока нет. Выберите класс, предмет и тему, и я составлю план уроков с тестами и карточками. Можно загрузить свой конспект.'));
  SD.courses.forEach(c=>{const d=c.lessons.filter(l=>l.done).length,card=el('button','stcard course');card.append(el('b','',c.title),el('div','muted',c.level+' · '+c.subject+' · '+d+'/'+c.lessons.length),bar(100*d/c.lessons.length));card.onclick=()=>nav('course',c.id);o.append(card)})}

/* ---------- Практика ---------- */
function practice(){
  $('stTitle').textContent='Практика';const o=sb(),g=el('div','grid2');
  g.append(ib('tile','spark','Быстрый тест по любой теме',()=>nav('quick',{})),ib('tile','chat','Репетитор: вопросы и объяснения',()=>nav('tutor')),
    ib('tile','edit','Проверка ответа или эссе',()=>nav('essay')),ib('tile','cards','Карточки из текста',()=>nav('gen')),
    ib('tile','timer','Фокус-таймер',()=>nav('focus')),ib('tile','target','Экзаменатор',()=>nav('exam')),...photoBtns());o.append(g)}

function quick(a){
  $('stTitle').textContent='Быстрый тест';const o=sb(),f={n:10,d:'Средний',lv:'7–9 класс'};
  const tp=el('input','inp');tp.placeholder='Тема: например, квадратные уравнения или Древний Рим';tp.value=a&&a.t||'';
  o.append(el('h3','','Тема'),tp,el('h3','','Уровень'),chipGroup(LEVELS,f.lv,v=>f.lv=v),el('h3','','Сложность'),chipGroup(['Лёгкий','Средний','Сложный'],f.d,v=>f.d=v),el('h3','','Вопросов'),chipGroup(['5','10','15'],'10',v=>f.n=+v));
  const msg=el('p','muted');
  const go=ib('go','play','Начать',async()=>{const t=tp.value.trim();if(!t)return flash('Введите тему');if(noAI())return msg.textContent='Сначала подключите нейросеть.';go.disabled=true;msg.textContent='Составляю вопросы…';
    try{const qs=(await stJson('Ты составитель тестов.','Составь '+f.n+' вопросов с 4 вариантами ответа по теме «'+t+'», уровень «'+f.lv+'», сложность «'+f.d+'». Формат: [{"q":"вопрос","options":["а","б","в","г"],"correct":0,"why":"краткое объяснение"}], correct — индекс 0..3. Правильный ответ должен быть один.',f.n*220+600)).filter(okQ);if(qs.length<3)throw new Error('мало вопросов, попробуйте ещё раз');
      stRunQuiz(qs,(sc,wrong)=>{const pct=sc/qs.length,xp=sc*8+(pct>=.8?15:0);addXp(xp);SD.hist.push({d:day(),c:'Быстрый тест',l:t,s:sc,n:qs.length});SD.hist=SD.hist.slice(-80);const added=addCards(wrong.map(q=>({q:q.q,a:q.options[q.correct],why:q.why})),'Тест: '+t);sv();
        quizResult('',sc,qs.length,'XP: +'+xp+(added?'. Ошибок в карточках: '+added+'.':''),[ib('ghost','repeat','Ещё раз',()=>nav('quick',{t})),ib('go','play','В практику',()=>nav('practice'))])})}
    catch(e){msg.textContent='Не получилось: '+e.message;go.disabled=false}});
  o.append(go,msg)}

function tutor(){
  $('stTitle').textContent='Репетитор';const o=sb(),list=el('div');
  const draw=()=>{list.replaceChildren();if(!SD.tutor.length)list.append(el('p','muted','Спросите что угодно по учёбе: объяснить тему, разобрать задачу, проверить рассуждение. Репетитор отвечает пошагово и в конце задаёт вопрос на закрепление.'));
    SD.tutor.slice(-30).forEach(m=>{const d=el('div','tmsg '+m.role);d.append(md(m.content));list.append(d)})};draw();
  const ta=el('textarea','inp');ta.rows=2;ta.placeholder='Ваш вопрос…';const row=el('div','row2');
  const send=async()=>{const v=ta.value.trim();if(!v)return;if(noAI())return flash('Подключите нейросеть');ta.value='';SD.tutor.push({role:'user',content:v});draw();const w=el('div','tmsg assistant','…');list.append(w);w.scrollIntoView({block:'end'});
    const ctx=SD.courses.slice(0,5).map(c=>c.title+' ('+c.level+')').join('; ');
    try{const a=await ask([{role:'system',content:'Ты персональный репетитор. Отвечай по-русски, ясно и пошагово, как хороший учитель: сначала суть, затем разбор, в конце один короткий вопрос на закрепление. Не решай вместо ученика целиком, если он просит подсказку. Курсы ученика: '+(ctx||'нет')+'.'},...SD.tutor.slice(-12)],1200);SD.tutor.push({role:'assistant',content:a});SD.tutor=SD.tutor.slice(-40);addXp(2);draw();list.lastElementChild.scrollIntoView({block:'end'})}
    catch(e){SD.tutor.pop();draw();flash('Не получилось: '+e.message)}};
  row.append(ib('ghost','mic','Голосом',()=>{stopAllSpeech();speaking=false;captureText=t=>{ta.value=(ta.value+' '+t).trim()};listen(true)}),ib('go','send','Спросить',send));
  const tools=el('div','row2');tools.append(ib('ghost','volume','Слушать ответ',()=>{const l=[...SD.tutor].reverse().find(m=>m.role==='assistant');if(l)speak(l.content)}),ib('ghost','trash','Очистить',()=>{SD.tutor=[];sv();draw()}));
  o.append(list,ta,row,tools)}

function essay(){
  $('stTitle').textContent='Проверка ответа';const o=sb();
  const tk=el('input','inp');tk.placeholder='Задание или вопрос (по желанию)';const ta=el('textarea','inp');ta.rows=7;ta.placeholder='Вставьте или надиктуйте ваш ответ, эссе, решение…';
  const out=el('div'),msg=el('p','muted');
  const go=ib('go','check','Проверить',async()=>{const v=ta.value.trim();if(v.length<20)return flash('Напишите ответ подлиннее');if(noAI())return msg.textContent='Сначала подключите нейросеть.';go.disabled=true;msg.textContent='Проверяю…';out.replaceChildren();
    try{const r=await stJson('Ты строгий, но доброжелательный преподаватель.','Оцени ответ ученика'+(tk.value.trim()?' на задание «'+tk.value.trim()+'»':'')+'. Формат: {"score":число от 1 до 10,"summary":"общий вывод в 1–2 предложения","strengths":["что хорошо"],"fixes":["что исправить, конкретно"],"improved":"улучшенная версия ответа"}.\nОтвет ученика:\n'+v.slice(0,5000),1800);
      const sc=Math.max(1,Math.min(10,Math.round(+r.score||5)));addXp(10+sc);const h=el('div','stcard hero');h.append(el('div','score',sc+' / 10'),el('p','',String(r.summary||'')));out.append(h);
      const lst=(t,a)=>{if(Array.isArray(a)&&a.length){const c=el('div','stcard');c.append(el('b','',t));const u=el('ul','listy');a.slice(0,8).forEach(x=>u.append(el('li','',String(x))));c.append(u);out.append(c)}};lst('Сильные стороны',r.strengths);lst('Что исправить',r.fixes);
      if(r.improved){const c=el('div','stcard');c.append(el('b','','Улучшенный вариант'),md(String(r.improved)));out.append(c)}msg.textContent=''}
    catch(e){msg.textContent='Не получилось: '+e.message}go.disabled=false});
  o.append(tk,ta,el('div','row2'));o.lastChild.append(ib('ghost','mic','Голосом',()=>{stopAllSpeech();speaking=false;captureText=t=>{ta.value=(ta.value+' '+t).trim()};listen(true)}),go);o.append(msg,out)}

function gen(){
  $('stTitle').textContent='Карточки из текста';const o=sb(),ta=el('textarea','inp');ta.rows=8;ta.placeholder='Вставьте конспект, параграф или статью. Я выделю главное и сделаю карточки для повторения.';const msg=el('p','muted');
  const go=ib('go','spark','Сделать карточки',async()=>{const v=ta.value.trim();if(v.length<40)return flash('Нужен текст подлиннее');if(noAI())return msg.textContent='Сначала подключите нейросеть.';go.disabled=true;msg.textContent='Читаю текст…';
    try{const cs=await stJson('Ты составитель карточек для запоминания.','Из текста составь 8–15 карточек: [{"q":"вопрос или термин","a":"краткий ответ"}]. Только важное, без воды.\nТекст:\n'+v.slice(0,7000),2500);const n=addCards(cs,'Свой текст');addXp(n);msg.textContent='Добавлено карточек: '+n+'. Они появятся в «Повторе».';ta.value=''}
    catch(e){msg.textContent='Не получилось: '+e.message}go.disabled=false});o.append(ta,go,msg)}

/* ---------- Фокус-таймер ---------- */
const FT={on:false,end:0,len:25,iv:null,disp:null};
function ftTick(){const left=Math.max(0,FT.end-Date.now());if(FT.disp&&document.contains(FT.disp)){const s=Math.ceil(left/1000);FT.disp.textContent=String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0')}
  if(left<=0&&FT.on){FT.on=false;clearInterval(FT.iv);SD.focusMin+=FT.len;addXp(Math.round(FT.len/5*2));flash('Фокус завершён: +'+Math.round(FT.len/5*2)+' XP');try{navigator.vibrate&&navigator.vibrate([200,100,200])}catch{}if(stNav.n==='focus')nav('focus')}}
function focus(){
  $('stTitle').textContent='Фокус';const o=sb(),c=el('div','stcard'),d=el('div','timer');FT.disp=d;c.append(d);
  if(FT.on){c.append(el('p','muted','Работайте без отвлечений. Телефон напомнит, когда время выйдет.'));o.append(c,ib('ghost','close','Остановить',()=>{FT.on=false;clearInterval(FT.iv);if(NATIVE&&Android.cancelTimer)try{Android.cancelTimer()}catch{}nav('focus')}));ftTick()}
  else{d.textContent=String(FT.len).padStart(2,'0')+':00';c.append(el('p','muted','Выберите длительность. За каждые 5 минут вы получите 2 XP после завершения.'),chipGroup(['15','25','45','60'],String(FT.len),v=>{FT.len=+v;d.textContent=String(FT.len).padStart(2,'0')+':00'}));
    o.append(c,ib('go','play','Начать',()=>{FT.on=true;FT.end=Date.now()+FT.len*6e4;clearInterval(FT.iv);FT.iv=setInterval(ftTick,500);if(NATIVE&&Android.setTimer)try{Android.setTimer(FT.len*60,'Фокус завершён')}catch{}nav('focus')}));
    o.append(el('div','muted','Всего в фокусе: '+SD.focusMin+' мин.'))}}

/* ---------- Прогресс ---------- */
function stats(){
  $('stTitle').textContent='Прогресс';const o=sb(),L=lvl(),ds=DAYS(7),vals=ds.map(d=>SD.daily[d]||0),mx=Math.max(SD.goal,...vals,1);
  const s3=el('div','stats3');[[SD.xp,'XP, ур. '+L],[SD.streak.n,'дней подряд'],[SD.deck.length,'карточек'],[SD.deck.filter(c=>c.iv>=21).length,'выучено'],[dueCards().length,'к повтору'],[SD.focusMin,'мин. фокуса']].forEach(([n,t])=>{const d=el('div','stat');d.append(el('b','',String(n)),el('span','',t));s3.append(d)});o.append(s3);
  section(o,'Последние 7 дней');const ch=el('div','stcard'),cc=el('div','chart');
  ds.forEach((d,i)=>{const c=el('div','col2'),b=el('i',vals[i]>=SD.goal?'':'dim');b.style.height=Math.max(3,100*vals[i]/mx)+'%';if(vals[i]>0&&vals[i]<SD.goal)b.className='';c.append(b,el('span','',new Date(d+'T12:00:00').toLocaleDateString('ru-RU',{weekday:'short'})));cc.append(c)});
  ch.append(cc,el('div','muted','Цель: '+SD.goal+' XP в день. Светлые столбики: цель выполнена.'));o.append(ch);
  const weak={};SD.hist.forEach(h=>{const k=h.l;(weak[k]=weak[k]||{s:0,n:0,c:h.c}).s+=h.s;weak[k].n+=h.n});
  const wl=Object.entries(weak).map(([l,v])=>({l,r:v.s/v.n,c:v.c})).filter(x=>x.r<.7).sort((a,b)=>a.r-b.r).slice(0,5);
  if(wl.length){section(o,'Слабые места');wl.forEach(w=>{const b=el('button','stcard course');b.append(el('b','',w.l),el('div','muted','Точность '+Math.round(w.r*100)+'% · нажмите, чтобы потренироваться'));b.onclick=()=>nav('quick',{t:w.l});o.append(b)})}
  section(o,'Награды ('+SD.badges.length+' из '+BADGES.length+')');const bw=el('div','badges');BADGES.forEach(b=>{const d=el('div','bdg'+(SD.badges.includes(b.id)?'':' off'));d.append(el('b','',b.e),document.createTextNode(b.t));bw.append(d)});o.append(bw);
  section(o,'Курсы');if(!SD.courses.length)o.append(el('p','muted','Пока нет курсов.'));
  SD.courses.forEach(c=>{const d=c.lessons.filter(l=>l.done).length,card=el('div','stcard');card.append(el('b','',c.title),el('div','muted',d+' из '+c.lessons.length+' уроков'),bar(100*d/c.lessons.length));o.append(card)})}

VIEWS={home,courses,new:stNew,course:stCourse,lesson:stLesson,review:stReview,exam:stExam,stats,practice,quick,tutor,essay,gen,focus};
// иконки, которых может не быть в исходном наборе
const sp=document.querySelector('svg[style*="display:none"]');
if(sp){const add={timer:'<circle cx="12" cy="13" r="7"/><path d="M12 9v4l2.5 2M9 2h6"/>',edit:'<path d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4"/>',chat:'<path d="M4 5h16v11H9l-5 4z"/>',close:'<path d="M6 6l12 12M18 6L6 18"/>'};
  for(const[k,v]of Object.entries(add))if(!document.getElementById('i-'+k))sp.insertAdjacentHTML('beforeend','<symbol id="i-'+k+'" viewBox="0 0 24 24">'+v+'</symbol>')}
checkBadges();
})();
