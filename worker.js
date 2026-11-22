// VEKTOR 5.0 — строгий бесплатный Multi-AI Router для статического сайта.
// Secrets: GROQ_KEYS, OPENROUTER_KEY, GEMINI_API_KEY.
// Опционально: Cloudflare Workers AI binding с именем AI; KV binding RL.
// Ключи никогда не отправляются в браузер.
const CORS = {
  "access-control-allow-origin":"*",
  "access-control-allow-headers":"content-type,authorization",
  "access-control-allow-methods":"POST,GET,OPTIONS"
};
const J=(o,s=200)=>new Response(JSON.stringify(o),{status:s,headers:{...CORS,"content-type":"application/json"}});
const GROQ_MODELS=["openai/gpt-oss-120b","openai/gpt-oss-20b"];
const OR_MODELS=["meta-llama/llama-3.3-70b-instruct:free","google/gemma-3-27b-it:free"];
const GEMINI_MODELS=["gemini-2.5-flash","gemini-2.0-flash"];
const CF_MODEL="@cf/meta/llama-3.1-8b-instruct";
let cursor=0;

function freeModel(provider,model){
  const allow={groq:GROQ_MODELS,openrouter:OR_MODELS,gemini:GEMINI_MODELS,cloudflare:[CF_MODEL]};
  if(!allow[provider]?.includes(model)) throw new Error("FREE_ONLY blocked model");
}
async function callOpenAI(url,key,model,body){
  const b={...body,model,stream:false};
  const r=await fetch(url,{method:"POST",headers:{"content-type":"application/json","authorization":"Bearer "+key},body:JSON.stringify(b)});
  if(!r.ok) throw new Error("HTTP "+r.status);
  const j=await r.json(); return j.choices?.[0]?.message?.content||"";
}
async function callGemini(key,model,body){
  freeModel("gemini",model);
  const messages=body.messages||[];
  const sys=messages.filter(x=>x.role==="system").map(x=>x.content).join("\n");
  const contents=messages.filter(x=>x.role!=="system").map(x=>({role:x.role==="assistant"?"model":"user",parts:[{text:String(x.content)}]}));
  const r=await fetch("https://generativelanguage.googleapis.com/v1beta/models/"+model+":generateContent?key="+encodeURIComponent(key),{
    method:"POST",headers:{"content-type":"application/json"},
    body:JSON.stringify({contents,systemInstruction:sys?{parts:[{text:sys}]}:undefined,generationConfig:{temperature:body.temperature??0.4,maxOutputTokens:Math.min(body.max_tokens||1000,8192)}})
  });
  if(!r.ok) throw new Error("HTTP "+r.status);
  const j=await r.json();return j.candidates?.[0]?.content?.parts?.map(x=>x.text||"").join("")||"";
}
async function route(body,env,big){
  const candidates=[];
  const groq=(env.GROQ_KEYS||env.GROQ_KEY||"").split(/[,\s]+/).filter(Boolean);
  for(const key of groq) candidates.push({name:"groq",model:GROQ_MODELS[0],run:()=>{freeModel("groq",GROQ_MODELS[0]);return callOpenAI("https://api.groq.com/openai/v1/chat/completions",key,GROQ_MODELS[0],body)}});
  if(env.OPENROUTER_KEY) for(const model of OR_MODELS) candidates.push({name:"openrouter",model,run:()=>{freeModel("openrouter",model);return callOpenAI("https://openrouter.ai/api/v1/chat/completions",env.OPENROUTER_KEY,model,body)}});
  if(env.GEMINI_API_KEY) for(const model of GEMINI_MODELS) candidates.push({name:"gemini",model,run:()=>callGemini(env.GEMINI_API_KEY,model,body)});
  if(env.AI) candidates.push({name:"cloudflare",model:CF_MODEL,run:async()=>{freeModel("cloudflare",CF_MODEL);const r=await env.AI.run(CF_MODEL,{messages:body.messages||[],temperature:body.temperature??0.4,max_tokens:Math.min(body.max_tokens||1000,4096)});return r.response||r.result?.response||""}});
  if(big&&candidates.some(c=>c.name!=="cloudflare")) for(let i=candidates.length-1;i>=0;i--) if(candidates[i].name==="cloudflare") candidates.splice(i,1); // большие файлы — только сильные модели
  if(!candidates.length) throw new Error("No free provider configured");
  const start=cursor++%candidates.length,attempts=[];
  for(let i=0;i<candidates.length;i++){
    const p=candidates[(start+i)%candidates.length];
    try{
      const content=await p.run();
      if(!content) throw new Error("Empty response");
      return {content,provider:p.name,model:p.model,attempts:[...attempts,{provider:p.name,status:"ok"}]};
    }catch(e){attempts.push({provider:p.name,error:String(e.message||e).slice(0,120)});}
  }
  const err=new Error("All free providers unavailable or quota exhausted");
  err.attempts=attempts;throw err;
}
const EDGE_TOKEN="6A5AA1D4EAFF4E9FB37E23D68491D6F4",EDGE_VER="130.0.2849.68";
async function edgeGec(){const t=(BigInt(Math.floor(Date.now()/1000))+11644473600n);const r=(t-t%300n)*10000000n;
  const h=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(String(r)+EDGE_TOKEN));return [...new Uint8Array(h)].map(b=>b.toString(16).padStart(2,"0")).join("").toUpperCase()}
const xmlEsc=s=>s.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&apos;"}[c]));
async function edgeTts(text,voice,rate){
  if(!/^[a-z]{2}-[A-Z]{2}-[A-Za-z]+Neural$/.test(voice)) throw new Error("bad voice");
  const id=crypto.randomUUID().replace(/-/g,""),url="https://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken="+EDGE_TOKEN+"&Sec-MS-GEC="+await edgeGec()+"&Sec-MS-GEC-Version=1-"+EDGE_VER+"&ConnectionId="+id;
  const resp=await fetch(url,{headers:{Upgrade:"websocket",Origin:"chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold",Pragma:"no-cache","Cache-Control":"no-cache","User-Agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0"}});
  const ws=resp.webSocket;if(!ws) throw new Error("нет соединения ("+resp.status+")");ws.accept();
  const ts=new Date().toUTCString().replace("GMT","GMT+0000 (Coordinated Universal Time)");
  return await new Promise((ok,no)=>{const parts=[];const t=setTimeout(()=>{try{ws.close()}catch{}no(new Error("таймаут"))},15000);
    ws.addEventListener("message",async ev=>{let d=ev.data;
      if(typeof d==="string"){if(d.includes("Path:turn.end")){clearTimeout(t);try{ws.close()}catch{}const n=parts.reduce((a,b)=>a+b.length,0);if(!n) return no(new Error("пустой ответ"));const out=new Uint8Array(n);let o=0;for(const p of parts){out.set(p,o);o+=p.length}ok(out)}return}
      if(d instanceof Blob)d=await d.arrayBuffer();const u=new Uint8Array(d);if(u.length<2)return;const hl=(u[0]<<8)|u[1];const head=new TextDecoder().decode(u.subarray(2,2+hl));if(head.includes("Path:audio"))parts.push(u.subarray(2+hl))});
    ws.addEventListener("error",()=>{clearTimeout(t);no(new Error("ошибка соединения"))});
    ws.send("X-Timestamp:"+ts+"\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n"+'{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"false"},"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}\r\n');
    ws.send("X-RequestId:"+id+"\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:"+ts+"Z\r\nPath:ssml\r\n\r\n<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='ru-RU'><voice name='"+voice+"'><prosody pitch='+0Hz' rate='"+(rate>=0?"+":"")+rate+"%' volume='+0%'>"+xmlEsc(text)+"</prosody></voice></speak>")})}
export default {
  async fetch(req,env){
    if(req.method==="OPTIONS") return new Response(null,{headers:CORS});
    const url=new URL(req.url);
    if(req.method==="GET") return J({ok:true,mode:"FREE_ONLY",providers:{
      groq:!!(env.GROQ_KEYS||env.GROQ_KEY),openrouter:!!env.OPENROUTER_KEY,
      gemini:!!env.GEMINI_API_KEY,cloudflare:!!env.AI
    }});
    const isStt=url.pathname.endsWith("/stt"),isTts=url.pathname.endsWith("/tts");
    if(req.method!=="POST"||!(isStt||isTts||url.pathname.endsWith("/chat/completions"))) return J({error:{message:"Not found"}},404);
    // Общий ограничитель на IP: бесплатные тарифы тоже имеют конечные квоты.
    if(env.RL){
      const k="rl:"+(req.headers.get("CF-Connecting-IP")||"unknown")+":"+Math.floor(Date.now()/3600000);
      const n=+(await env.RL.get(k)||0);
      if(n>=60) return J({error:{message:"Локальный лимит: 60 запросов в час"}},429);
      await env.RL.put(k,String(n+1),{expirationTtl:3700});
    }
    if(isStt){ // речь → текст (Whisper, бесплатно в пределах суточной квоты Workers AI)
      if(!env.AI) return J({error:{message:"Распознавание речи не подключено"}},503);
      const buf=new Uint8Array(await req.arrayBuffer());
      if(!buf.length||buf.length>4e6) return J({error:{message:"Запись пустая или слишком длинная"}},400);
      let bin="";for(let i=0;i<buf.length;i+=8192)bin+=String.fromCharCode.apply(null,buf.subarray(i,i+8192));
      try{const r=await env.AI.run("@cf/openai/whisper-large-v3-turbo",{audio:btoa(bin),language:"ru"});return J({text:(r.text||"").trim()})}
      catch(e){return J({error:{message:"Не удалось распознать речь"}},502)}
    }
    if(isTts){ // текст → речь: нейроголос Microsoft Edge (бесплатно, неофициально; может перестать работать)
      let q;try{q=await req.json()}catch{return J({error:{message:"Bad JSON"}},400)}
      const text=String(q.text||"").trim().slice(0,700);if(!text) return J({error:{message:"Пустой текст"}},400);
      try{const audio=await edgeTts(text,String(q.voice||"ru-RU-DmitryNeural"),Math.max(-40,Math.min(60,Math.round(+q.rate||0))));
        return new Response(audio,{headers:{...CORS,"content-type":"audio/mpeg","cache-control":"no-store"}})}
      catch(e){return J({error:{message:"Голосовой сервис недоступен: "+String(e.message||e).slice(0,100)}},502)}
    }
    let body;try{body=await req.json()}catch{return J({error:{message:"Bad JSON"}},400)}
    const big=!!body.vk_big;delete body.vk_big;body.max_tokens=Math.min(body.max_tokens||1000,8192);body.stream=false;
    try{
      const result=await route(body,env,big);
      return J({choices:[{message:{role:"assistant",content:result.content}}],vektor:{mode:"FREE_ONLY",provider:result.provider,model:result.model,attempts:result.attempts}});
    }catch(e){return J({error:{message:e.message,attempts:e.attempts||[]}} ,429);}
  }
};
