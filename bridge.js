// Vektor 5.0 — JS-мост. Порядок: Android (Python+C++) → локальный сервер (Python+C++) → встроенный JS-режим.
(function(){
  const S=(k,d)=>{try{return JSON.parse(localStorage.getItem(k))??d}catch{return d}},W=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch{}};
  const MODES={fast:{title:'Быстрый',t:.6,n:700,sys:'Отвечай кратко и по делу.'},think:{title:'Думающий',t:.4,n:2500,sys:'Рассуждай по шагам, затем дай чёткий итог.'},
    voice:{title:'Разговорный',t:.5,n:500,sys:'Это голосовой диалог: отвечай как в живой беседе, 1–3 коротких предложения, без markdown, списков, таблиц и кода. Если нужен код или длинный текст — кратко скажи, что напишешь его в чате.'},
    study:{title:'Учёба',t:.4,n:3000,sys:'Ты — терпеливый репетитор. Объясняй по шагам простым языком с примерами, затем задай 1–2 проверочных вопроса. Если просят тест — дай нумерованные вопросы с вариантами, ответы в конце. Для карточек используй таблицу «Вопрос | Ответ». Если тема не названа — спроси, что изучаем и на каком уровне.'},
    deep:{title:'Глубокий',t:.3,n:6000,sys:'Сделай подробный разбор: допущения, варианты, риски, вывод.'},code:{title:'VKTR Code',t:.2,n:6000,sys:'Ты старший инженер: план, код, самопроверка.'}};
  const tok=t=>(t.toLowerCase().match(/[\p{L}\p{N}]{2,}/gu)||[]);
  const sim=(a,b)=>{const A=tok(a),B=tok(b);if(!A.length||!B.length)return 0;let s=0;for(const x of A)for(const y of B){const p=Math.min(x.length,y.length,5);if(x===y)s+=1;else if(p>=3&&x.slice(0,p)===y.slice(0,p))s+=.7}return s/Math.sqrt(A.length*B.length)};
  const hist=[];
  const diff=(a,b)=>{const x=a.split('\n'),y=b.split('\n'),o=[];x.forEach(l=>{if(!y.includes(l))o.push('-'+l)});y.forEach(l=>{if(!x.includes(l))o.push('+'+l)});return o.join('\n')};
  const L={ // встроенный JS-движок (без Python/C++): память и файлы в localStorage
    async handle(m,a){
      const mem=()=>S('vk_mem',[]),files=()=>S('vk_files',{}),snaps=()=>S('vk_snaps',[]);
      switch(m){
        case'router.status':return{mode:'FREE_ONLY',note:'Браузерный режим: запросы идут через настроенный Cloudflare Worker. Подробные квоты доступны на сервере.',providers:[],usage:{}};
        case'ping':return{core:'JS-режим (без Python/C++)',native:false,plugins:[],modes:Object.fromEntries(Object.entries(MODES).map(([k,v])=>[k,v.title]))};
        case'mem.add':{const l=mem(),id=(l.at(-1)?.id||0)+1;l.push({id,kind:a.kind||'fact',text:a.text});W('vk_mem',l);return{id}}
        case'mem.all':return mem().slice().reverse();
        case'mem.forget':W('vk_mem',mem().filter(x=>x.id!==a.id));return 1;
        case'mem.search':return mem().map(x=>({...x,score:+sim(a.q,x.text).toFixed(3)})).filter(x=>x.score>=.12).sort((p,q)=>q.score-p.score).slice(0,a.k||5);
        case'tools':return{calc:'Калькулятор: calc(expr)',time:'Текущие дата и время'};
        case'tool':if(a.name==='time')return new Date().toLocaleString('ru-RU');
          if(a.name==='calc'){const e=String(a.args?.expr||'');if(!/^[\d\s+\-*/%().^]+$/.test(e))throw new Error('недопустимое выражение');return Function('"use strict";return ('+e.replace(/\^/g,'**')+')')()}
          throw new Error('Нет инструмента: '+a.name);
        case'ws.propose':{const f=files();return{id:'p'+Date.now(),file:a.file,text:a.text,diff:diff(f[a.file]||'',a.text),new:!(a.file in f)}}
        case'ws.apply':{const p=L.pend[a.id];if(!p)throw new Error('Нет такой правки');const f=files(),s=snaps();s.push({file:p.file,existed:p.file in f,old:f[p.file]});f[p.file]=p.text;W('vk_files',f);W('vk_snaps',s);delete L.pend[a.id];return{file:p.file}}
        case'ws.rollback':{const s=snaps(),x=s.pop();if(!x)throw new Error('Нет копий для отката');const f=files();x.existed?f[x.file]=x.old:delete f[x.file];W('vk_files',f);W('vk_snaps',s);return{restored:x.file}}
        case'cloud.set':W('vk_cloud',{base:(a.base||'').replace(/\/$/,''),model:a.model,keys:a.keys});return{ok:1};
        case'chat':{
          const r=a.text.match(/^\s*(запомни|remember)[:,]?\s+([\s\S]+)/i);
          if(r){const id=(await L.handle('mem.add',{text:r[2].trim()})).id;return{reply:'Запомнил (№'+id+').',memory:true}}
          const cfg=MODES[a.mode]||MODES.fast,c=S('vk_cloud',{}),base=(c.base||window.VEKTOR_CLOUD||'').replace(/\/$/,'');
          if(!base){console.warn('VEKTOR_CLOUD не задан в config.js');throw new Error('Сервис пока недоступен. Попробуйте позже.')};
          const rec=await L.handle('mem.search',{q:a.text,k:4});
          const sys='Ты — Вектор, личный ИИ-ассистент. Отвечай по-русски, если не просят иначе. '+cfg.sys+(rec.length?'\nИз долговременной памяти:\n'+rec.map(x=>'- '+x.text).join('\n'):'');
          const keys=c.keys?.length?c.keys:['vektor'];let err;
          for(const k of keys){const t0=Date.now(),res=await fetch(base+'/chat/completions',{method:'POST',signal:a.signal,headers:{'content-type':'application/json',authorization:'Bearer '+k},
            body:JSON.stringify({model:c.model||'openai/gpt-oss-120b',temperature:cfg.t,max_tokens:cfg.n,messages:[{role:'system',content:sys},...hist.slice(-10),{role:'user',content:a.text}]})});
            if([401,402,429].includes(res.status)){err=res.status;continue}
            const j=await res.json();if(!res.ok)throw new Error(j.error?.message||('HTTP '+res.status));
            const reply=j.choices[0].message.content;hist.push({role:'user',content:a.text},{role:'assistant',content:reply});return{reply,recalled:rec.map(x=>x.id),provider:j.vektor?.provider,model:j.vektor?.model,elapsed_ms:Date.now()-t0}}
          throw new Error('Лимит ключей исчерпан ('+err+')')}
      }throw new Error('Неизвестный метод '+m)},pend:{}};
  const _p=L.handle;L.handle=async(m,a)=>{const r=await _p.call(L,m,a);if(m==='ws.propose')L.pend[r.id]={file:r.file,text:r.text};return r};
  const pend={};let seq=0;
  window.__vk=(id,res)=>{const p=pend[id];if(!p)return;delete pend[id];try{const o=JSON.parse(res);o.ok?p.ok(o.r):p.no(new Error(o.e))}catch(e){p.no(e)}};
  const V=window.Vektor={mode:localStorage.getItem('vk_mode')||'fast',engine:'js',
    hasEngine:()=>true,
    async call(m,a){a=a||{};
      if(window.Android&&Android.pyCall){V.engine='android';return new Promise((ok,no)=>{const id=++seq;pend[id]={ok,no};Android.pyCall(id,JSON.stringify({m,a}))})}
      if(location.protocol.startsWith('http')&&V.srv!==false){
        try{const r=await fetch('/api',{method:'POST',body:JSON.stringify({m,a})});const o=await r.json();V.engine='server';if(!o.ok)throw new Error(o.e);return o.r}
        catch(e){if(V.engine==='server')throw e;V.srv=false}}
      V.engine='js';return L.handle(m,a)},
    chat:(t,m,o)=>V.call('chat',{text:t,mode:m||V.mode,signal:o&&o.signal}),
    cloudBase(){const c=S('vk_cloud',{});return(c.base||window.VEKTOR_CLOUD||'').replace(/\/$/,'')},
    async llm(messages,o){o=o||{};const base=V.cloudBase(),c=S('vk_cloud',{});if(!base)throw new Error('Сервис пока недоступен. Попробуйте позже.');
      const res=await fetch(base+'/chat/completions',{method:'POST',signal:o.signal,headers:{'content-type':'application/json',authorization:'Bearer vektor'},
        body:JSON.stringify({model:c.model||'openai/gpt-oss-120b',temperature:o.temp??.3,max_tokens:o.max||4000,vk_big:!!o.big,messages})});
      const j=await res.json().catch(()=>({}));if(!res.ok)throw new Error(j.error?.message||('HTTP '+res.status));return{text:j.choices[0].message.content,provider:j.vektor?.provider}},setMode(m){V.mode=m;localStorage.setItem('vk_mode',m)},
    remember:t=>V.call('mem.add',{text:t}),recall:(q,k)=>V.call('mem.search',{q,k}),
    propose:(file,text)=>V.call('ws.propose',{file,text}),apply:id=>V.call('ws.apply',{id}),rollback:s=>V.call('ws.rollback',{snapshot:s}),
    setCloud:(base,model,keys)=>V.call('cloud.set',{base,model,keys}),
    async stt(blob){const c=S('vk_cloud',{}),base=(c.base||window.VEKTOR_CLOUD||'').replace(/\/$/,'');if(!base)throw new Error('Сервис пока недоступен.');
      const r=await fetch(base+'/stt',{method:'POST',headers:{'content-type':blob.type||'audio/webm'},body:blob}),j=await r.json().catch(()=>({}));
      if(!r.ok)throw new Error(j.error?.message||'Не удалось распознать речь');return j.text||''}};
})();
