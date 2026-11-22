// Vektor — генератор проектов: план → файл за файлом (с дописыванием и расширением) → проверка → ZIP. Работает в любом режиме.
(function(){
const V=window.Vektor,SIZES={small:{n:5,kb:20},mid:{n:7,kb:40},big:{n:9,kb:65}};
const enc=new TextEncoder(),bytes=s=>enc.encode(s).length,END='<<<END>>>';
const kb=n=>(n/1024).toFixed(1).replace('.',',')+' КБ';
const strip=t=>String(t).replace(/\r\n?/g,'\n').replace(/^\s*```[\w.+#-]*\n/,'').replace(/\n```\s*$/,'');
const SYS_FILE='Ты — старший инженер. Напиши ПОЛНОЕ содержимое одного файла проекта. Выведи ТОЛЬКО содержимое файла: без пояснений и без markdown-ограждений ```. Код должен быть рабочим и законченным: настоящая логика, обработка ошибок, понятные комментарии на русском; никаких заглушек, TODO и фраз вроде «остальное аналогично». Держи объём близким к целевому. После последней строки файла напиши отдельной строкой '+END;
function digest(c){const L=c.split('\n'),keep=L.filter(l=>/^\s*(export |async function |function |class |def |const \w+\s*=|let \w+\s*=|var \w+\s*=|#include|import |from |public |<!DOCTYPE|<link|<script|\.\w[\w-]*\s*\{|#\w[\w-]*\s*\{)/.test(l)).slice(0,40);return(L.slice(0,4).concat(keep)).join('\n').slice(0,1800)}
function safePath(p){p=String(p||'').replace(/\\/g,'/').replace(/^\.\//,'').trim();if(!p||p.startsWith('/')||/^[A-Za-z]:/.test(p)||p.split('/').includes('..')||p.length>80)return null;
  if(/(^|\/)(\.env|id_rsa|credentials\.json)$/i.test(p)||/\.(pem|key)$/i.test(p))return null;return p}
function parsePlan(raw,sz){const a=raw.indexOf('{'),b=raw.lastIndexOf('}');if(a<0||b<a)throw new Error('нет JSON');const p=JSON.parse(raw.slice(a,b+1));const seen=new Set(),files=[];
  for(const f of(p.files||[])){const path=safePath(f.path);if(!path||seen.has(path))continue;seen.add(path);files.push({path,purpose:String(f.purpose||'').slice(0,300),kb:Math.max(1,Math.min(26,+f.kb||4))})}
  if(!files.length)throw new Error('пустой план');if(!seen.has('README.md'))files.push({path:'README.md',purpose:'описание, запуск, структура, возможности',kb:2});
  const sum=files.reduce((a,f)=>a+f.kb,0),k=sum<sz.kb*.7?sz.kb/sum:1;if(k>1)files.forEach(f=>f.kb=Math.min(26,Math.round(f.kb*k)));
  return{name:String(p.name||'project').toLowerCase().replace(/[^a-z0-9_-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,40)||'project',title:String(p.title||p.name||'Проект').slice(0,80),summary:String(p.summary||'').slice(0,400),run:String(p.run||'').slice(0,300),files:files.slice(0,16)}}
function check(path,code){const ext=path.split('.').pop().toLowerCase();
  try{if(ext==='json')JSON.parse(code);else if((ext==='js'||ext==='mjs')&&!/^\s*(import|export)\s/m.test(code))new Function(code);else if(ext==='html'&&/<html/i.test(code)&&!/<\/html>/i.test(code))throw new Error('нет закрывающего </html> — файл обрезан')}catch(e){return e.message}return null}
window.previewDoc=files=>{const map={};files.forEach(f=>map[f.path]=f.content);const h=files.find(f=>/(^|\/)index\.html?$/i.test(f.path))||files.find(f=>/\.html?$/i.test(f.path));if(!h)return null;
  const base=h.path.replace(/[^/]*$/,''),get=s=>map[base+String(s).replace(/^\.\//,'')];
  return h.content.replace(/<link[^>]*>/gi,m=>{const r=m.match(/href=["']([^"']+)["']/i);return r&&/stylesheet/i.test(m)&&get(r[1])!=null?'<style>'+get(r[1])+'</style>':m})
    .replace(/<script([^>]*?)src=["']([^"']+)["']([^>]*)>\s*<\/script>/gi,(m,a,s,c)=>get(s)!=null?'<script'+a+c+'>'+get(s).replace(/<\/script/gi,'<\\/script')+'</script>':m)};
window.buildProject=async function(task,sizeKey,ui,signal){
  const sz=SIZES[sizeKey]||SIZES.big,ask=(m,max)=>V.llm(m,{temp:.25,max,big:true,signal}).then(r=>r.text);
  const done=[];let plan,h=ui.step('Планирую структуру проекта','Определяю файлы, их назначение и объём');
  for(let t=0;t<3&&!plan;t++){const raw=await ask([{role:'system',content:'Ты — архитектор ПО. Отвечай только корректным JSON.'},{role:'user',content:
    'Спланируй законченный рабочий проект по задаче. Верни ТОЛЬКО JSON без markdown: {"name":"имя-латиницей","title":"название","summary":"2 предложения","run":"как запустить","files":[{"path":"index.html","purpose":"что делает файл, ключевые функции","kb":7}]}.\n'+
    'Требования: около '+sz.n+' файлов (±2), суммарно около '+sz.kb+' КБ кода (поле kb — целевой размер файла в КБ, сумма ≈ '+sz.kb+'); обязательно README.md; реальная функциональность, а не заглушки; запуск без сборки и платных сервисов, если уместно (для веба: index.html + css + js); относительные пути, без секретов и абсолютных путей.\n\nЗАДАЧА: '+task}],3000);
    try{plan=parsePlan(raw,sz)}catch(e){if(t===2)throw new Error('План проекта не получился: '+e.message)}}
  h.done(plan.summary||'План готов',plan.files.slice(0,8).map(f=>f.path).concat(plan.files.length>8?['…ещё '+(plan.files.length-8)]:[]));
  const listing=plan.files.map(f=>'- '+f.path+' (~'+f.kb+' КБ): '+f.purpose).join('\n');
  for(let i=0;i<plan.files.length;i++){const f=plan.files[i];if(signal&&signal.aborted)break;
    h=ui.step('Пишу '+f.path,(i+1)+' из '+plan.files.length+' · цель ~'+f.kb+' КБ');
    const prior=done.map(d=>'['+d.path+']\n'+digest(d.content)).join('\n\n');
    const user='Проект: '+plan.title+'\nЗадача: '+task+'\n\nПлан файлов:\n'+listing+'\n\n'+(prior?'Уже написанные файлы (кратко, для согласованных имён, функций и id):\n'+prior+'\n\n':'')+'Напиши файл: '+f.path+'\nНазначение: '+f.purpose+'\nЦелевой объём: около '+f.kb+' КБ.';
    const sys=SYS_FILE,max=Math.min(7800,Math.round(f.kb*430)+900);let txt=await ask([{role:'system',content:sys},{role:'user',content:user}],max),ext=0;
    while(!txt.includes(END)&&ext<2&&!(signal&&signal.aborted)){h.update('Файл не уместился в один ответ — продолжаю ('+(ext+1)+')…');
      const more=await ask([{role:'system',content:sys},{role:'user',content:user},{role:'assistant',content:txt},{role:'user',content:'Продолжи ровно с места обрыва, не повторяя уже написанное и не начиная заново. Закончи файл и напиши '+END+' отдельной строкой.'}],max);txt+=more;ext++}
    let code=strip(txt.split(END)[0]).replace(/\n+$/,'')+'\n';
    if(f.kb>=4&&bytes(code)<f.kb*1024*.4&&!(signal&&signal.aborted)){h.update('Файл слишком короткий ('+kb(bytes(code))+') — расширяю…');
      try{const t2=await ask([{role:'system',content:sys},{role:'user',content:user},{role:'assistant',content:code},{role:'user',content:'Файл слишком короткий: сейчас '+kb(bytes(code))+', нужно около '+f.kb+' КБ. Перепиши его ПОЛНОСТЬЮ, добавив недостающую реальную функциональность, обработку ошибок и детали. Выведи весь файл целиком и закончи '+END+'.'}],max);
        const c2=strip(t2.split(END)[0]).replace(/\n+$/,'')+'\n';if(bytes(c2)>bytes(code))code=c2}catch(e){if(e.name==='AbortError')throw e}}
    done.push({path:f.path,content:code});h.done((i+1)+' из '+plan.files.length,[kb(bytes(code))])}
  h=ui.step('Проверяю код','Синтаксис JS, JSON и HTML');const warns=[];let fixes=0;
  for(const d of done){let err=check(d.path,d.content);
    if(err&&fixes<3&&!(signal&&signal.aborted)){fixes++;h.update('Исправляю '+d.path+': '+err.slice(0,80));
      try{const t=await ask([{role:'system',content:SYS_FILE},{role:'user',content:'В файле '+d.path+' синтаксическая ошибка: '+err+'\nИсправь и выведи файл целиком, закончи '+END+'.\n\n'+d.content}],7800);const c=strip(t.split(END)[0]).replace(/\n+$/,'')+'\n';if(!check(d.path,c)){d.content=c;err=null}}catch(e){if(e.name==='AbortError')throw e}}
    if(err)warns.push(d.path+': '+err.slice(0,120))}
  h.done(warns.length?'Найдено предупреждений: '+warns.length:'Ошибок не найдено',warns.length?warns.map(w=>w.split(':')[0]):[]);
  return finalize(plan,done,warns,ui)};
function finalize(plan,done,warns,ui){const h=ui.step('Собираю ZIP','Упаковываю файлы');const files=done.map(d=>({path:d.path,content:d.content,bytes:bytes(d.content)})),total=files.reduce((a,f)=>a+f.bytes,0);
  h.done(files.length+' файлов',[kb(total)]);return{name:plan.name,title:plan.title,summary:plan.summary,run:plan.run,files,total,warns}}
window.projectZip=files=>window.makeZip(files.map(f=>({name:f.path,data:f.content})));
window.SIZES=SIZES;window.fmtKb=kb;
})();
