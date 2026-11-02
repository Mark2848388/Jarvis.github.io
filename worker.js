// Vektor Cloud — прокси для ИИ без личных API-ключей у пользователей.
// Cloudflare Workers (бесплатный тариф подходит для старта).
// Настройка: Workers → Create → вставить этот код → Settings → Variables → Secret GROQ_KEY (ваш ключ Groq).
// Необязательно: KV-привязка RL для лимита запросов. Затем впишите адрес воркера в CLOUD_URL в ext.js:
//   const CLOUD_URL='https://ВАШ-ВОРКЕР.workers.dev/v1';
const UPSTREAM='https://api.groq.com/openai/v1';
const ALLOWED_MODELS=['openai/gpt-oss-120b','openai/gpt-oss-20b'];
const MAX_TOKENS=8000, LIMIT_PER_HOUR=60;
const cors={'access-control-allow-origin':'*','access-control-allow-headers':'content-type,authorization','access-control-allow-methods':'POST,OPTIONS'};
export default{
  async fetch(req,env){
    if(req.method==='OPTIONS')return new Response(null,{headers:cors});
    const url=new URL(req.url);
    if(req.method!=='POST'||!url.pathname.endsWith('/chat/completions'))return new Response('Not found',{status:404,headers:cors});
    if(env.RL){
      const ip=req.headers.get('CF-Connecting-IP')||'x',key='rl:'+ip+':'+Math.floor(Date.now()/3600000);
      const n=+(await env.RL.get(key)||0);
      if(n>=LIMIT_PER_HOUR)return new Response(JSON.stringify({error:{message:'Лимит запросов в час исчерпан'}}),{status:429,headers:{...cors,'content-type':'application/json'}});
      await env.RL.put(key,String(n+1),{expirationTtl:3700});
    }
    let body;try{body=await req.json()}catch{return new Response('Bad JSON',{status:400,headers:cors})}
    if(!ALLOWED_MODELS.includes(body.model))body.model=ALLOWED_MODELS[0];
    body.max_tokens=Math.min(body.max_tokens||1000,MAX_TOKENS);
    const r=await fetch(UPSTREAM+'/chat/completions',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+env.GROQ_KEY},body:JSON.stringify(body)});
    return new Response(r.body,{status:r.status,headers:{...cors,'content-type':'application/json'}});
  }
};
