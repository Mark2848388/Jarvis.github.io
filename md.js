// Vektor — Markdown-рендер: таблицы (выравнивание, \| и код в ячейках), вложенные списки, задачи, формулы LaTeX → Unicode, безопасные символы.
(function(){
const E={'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'},esc=s=>String(s).replace(/[&<>"]/g,c=>E[c]);
const SUP={0:'⁰',1:'¹',2:'²',3:'³',4:'⁴',5:'⁵',6:'⁶',7:'⁷',8:'⁸',9:'⁹','+':'⁺','-':'⁻','=':'⁼','(':'⁽',')':'⁾',n:'ⁿ',i:'ⁱ'};
const SUB={0:'₀',1:'₁',2:'₂',3:'₃',4:'₄',5:'₅',6:'₆',7:'₇',8:'₈',9:'₉','+':'₊','-':'₋','=':'₌','(':'₍',')':'₎',a:'ₐ',e:'ₑ',o:'ₒ',x:'ₓ',i:'ᵢ',j:'ⱼ',n:'ₙ',m:'ₘ',k:'ₖ'};
const SYM={alpha:'α',beta:'β',gamma:'γ',delta:'δ',epsilon:'ε',varepsilon:'ε',zeta:'ζ',eta:'η',theta:'θ',lambda:'λ',mu:'μ',nu:'ν',xi:'ξ',pi:'π',rho:'ρ',sigma:'σ',tau:'τ',phi:'φ',varphi:'φ',chi:'χ',psi:'ψ',omega:'ω',Gamma:'Γ',Delta:'Δ',Theta:'Θ',Lambda:'Λ',Pi:'Π',Sigma:'Σ',Phi:'Φ',Psi:'Ψ',Omega:'Ω',times:'×',cdot:'·',div:'÷',pm:'±',mp:'∓',leq:'≤',le:'≤',geq:'≥',ge:'≥',neq:'≠',ne:'≠',approx:'≈',equiv:'≡',infty:'∞',to:'→',rightarrow:'→',leftarrow:'←',Rightarrow:'⇒',Leftarrow:'⇐',Leftrightarrow:'⇔',leftrightarrow:'↔',sum:'∑',prod:'∏',int:'∫',partial:'∂',nabla:'∇',in:'∈',notin:'∉',subset:'⊂',subseteq:'⊆',cup:'∪',cap:'∩',forall:'∀',exists:'∃',emptyset:'∅',degree:'°',ldots:'…',cdots:'⋯',dots:'…',angle:'∠',perp:'⊥',parallel:'∥',propto:'∝',sim:'∼',circ:'∘',neg:'¬',land:'∧',lor:'∨',lt:'<',gt:'>',mid:'|',quad:' ',qquad:'  ',ll:'≪',gg:'≫',hbar:'ℏ',ell:'ℓ'};
const FN=['sin','cos','tan','cot','log','ln','exp','lim','max','min','det'];
function grp(s,i){if(s[i]==='{'){let d=1,j=i+1;while(j<s.length&&d){if(s[j]==='{')d++;else if(s[j]==='}')d--;j++}return[s.slice(i+1,j-1),j]}
  if(s[i]==='\\'){const m=s.slice(i).match(/^\\[a-zA-Z]+/);return[m?m[0]:s[i+1]||'',i+(m?m[0].length:2)]}return[s[i]||'',i+1]}
function tex(str){let o='',i=0;const wrap=A=>/^[\w.]+$/.test(A)?A:'('+A+')';
  while(i<str.length){const c=str[i];
    if(c==='\\'){const m=str.slice(i+1).match(/^[a-zA-Z]+/);
      if(m){const n=m[0];i+=1+n.length;
        if(n==='frac'||n==='dfrac'){const[a,j]=grp(str,i),[b,k]=grp(str,j);i=k;o+=wrap(tex(a))+'⁄'+wrap(tex(b));continue}
        if(n==='sqrt'){const[a,j]=grp(str,i);i=j;o+='√'+wrap(tex(a));continue}
        if(/^(text|mathrm|mathbf|mathit|textbf|operatorname|mathbb)$/.test(n)){const[a,j]=grp(str,i);i=j;o+=a;continue}
        if(/^(left|right|big|Big|bigg)$/.test(n)){if(str[i]==='.')i++;continue}
        o+=SYM[n]!==undefined?SYM[n]:FN.includes(n)?n:'\\'+n;continue}
      const nx=str[i+1];i+=2;o+=(nx===','||nx===';'||nx===':'||nx===' '||nx==='\\')?' ':nx==='!'?'':(nx||'');continue}
    if(c==='^'||c==='_'){const[a,j]=grp(str,i+1);i=j;const A=tex(a),M=c==='^'?SUP:SUB;o+=[...A].every(x=>M[x])?[...A].map(x=>M[x]).join(''):c+'('+A+')';continue}
    if(c==='{'||c==='}'){i++;continue}o+=c;i++}return o}
const ENT=/&amp;(amp|lt|gt|quot|nbsp|mdash|ndash|hellip|laquo|raquo|times|rarr|larr|copy|deg|plusmn|le|ge|ne);/g;
function inline(src){const st=[],K='\uE000',hold=h=>K+(st.push(h)-1)+'\uE001';let t=String(src);
  t=t.replace(/(`+)([^`]|[^`][\s\S]*?[^`])\1(?!`)/g,(_,q,x)=>hold('<code>'+esc(x.trim())+'</code>'));
  t=t.replace(/\\\((.+?)\\\)/g,(_,x)=>hold('<span class="math">'+esc(tex(x))+'</span>'));
  t=t.replace(/\$([^\s$](?:[^$\n]*?[^\s$])?)\$(?!\d)/g,(m,x)=>/[\\^_{}=]/.test(x)?hold('<span class="math">'+esc(tex(x))+'</span>'):m);
  t=t.replace(/\\([\\`*_{}\[\]()#+\-.!|~$<>])/g,(_,c)=>hold(esc(c)));
  t=t.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+|mailto:[^\s)]+)\)/g,(_,a,u)=>hold('<a href="'+esc(u)+'" target="_blank" rel="noopener noreferrer">'+esc(a)+'</a>'));
  t=t.replace(/(^|[\s(])(https?:\/\/[^\s<)]+[^\s<).,;:!?])/g,(_,p,u)=>p+hold('<a href="'+esc(u)+'" target="_blank" rel="noopener noreferrer">'+esc(u)+'</a>'));
  t=esc(t).replace(ENT,'&$1;');
  t=t.replace(/\*\*(\S(?:[\s\S]*?\S)?)\*\*/g,'<strong>$1</strong>').replace(/(^|[^\w])__(\S(?:[\s\S]*?\S)?)__(?!\w)/g,'$1<strong>$2</strong>')
     .replace(/~~(\S(?:[\s\S]*?\S)?)~~/g,'<del>$1</del>')
     .replace(/(^|[^*\w])\*(\S(?:[^*\n]*?\S)?)\*(?!\*)/g,'$1<em>$2</em>').replace(/(^|[^\w])_(\S(?:[^_\n]*?\S)?)_(?!\w)/g,'$1<em>$2</em>');
  return t.replace(/\uE000(\d+)\uE001/g,(_,i)=>st[+i])}
function cells(l){l=l.trim();if(l[0]==='|')l=l.slice(1);if(l.endsWith('|')&&l[l.length-2]!=='\\')l=l.slice(0,-1);
  const r=[];let cur='',bt=false;for(let i=0;i<l.length;i++){const c=l[i];if(c==='`')bt=!bt;
    if(c==='\\'&&l[i+1]==='|'){cur+='|';i++;continue}if(c==='|'&&!bt){r.push(cur.trim());cur=''}else cur+=c}r.push(cur.trim());return r}
const SEP=/^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/;
window.md=function(src){const L=String(src??'').replace(/\r\n?/g,'\n').split('\n'),out=[];let i=0,para=[],ls=[],code=null,lang='';
  const fl=()=>{if(para.length){out.push('<p>'+para.map(inline).join('<br>')+'</p>');para=[]}};
  const cl=()=>{while(ls.length){const x=ls.pop();out.push('</li></'+x.t+'>')}};
  const isLi=l=>/^\s*([-+*]|\d+[.)])\s+\S/.test(l);
  const endCode=()=>{out.push('<div class="code"><div class="ch"><span>'+esc(lang||'код')+'</span><span>'+(/^(html|svg)$/i.test(lang)?'<button class="cb cr" type="button" data-run="1">Запустить</button>':'')+'<button class="cb" type="button">Копировать</button></span></div><pre><code>'+esc(code.join('\n'))+'</code></pre></div>');code=null};
  while(i<L.length){const l=L[i];
    if(code!==null){if(/^\s*(```|~~~)\s*$/.test(l))endCode();else code.push(l);i++;continue}
    let m=l.match(/^\s*(```|~~~)\s*([\w.+#-]*)/);if(m){fl();cl();code=[];lang=m[2];i++;continue}
    if(!l.trim()){fl();let j=i;while(j<L.length&&!L[j].trim())j++;if(!(ls.length&&j<L.length&&isLi(L[j])))cl();i++;continue}
    m=l.match(/^\s*(\$\$|\\\[)(.*)$/);if(m){fl();cl();let b=[m[2]],close=m[1]==='$$'?'$$':'\\]';
      if(m[2].includes(close)){b=[m[2].slice(0,m[2].indexOf(close))]}else{i++;while(i<L.length&&!L[i].includes(close)){b.push(L[i]);i++}if(i<L.length)b.push(L[i].slice(0,L[i].indexOf(close)))}
      out.push('<div class="math block">'+esc(tex(b.join(' ').trim()))+'</div>');i++;continue}
    if(l.includes('|')&&i+1<L.length&&SEP.test(L[i+1])){fl();cl();const h=cells(l),al=cells(L[i+1]).map(x=>/^:.*:$/.test(x)?'center':/:$/.test(x)?'right':'');i+=2;const rows=[];
      while(i<L.length&&L[i].trim()&&L[i].includes('|'))rows.push(cells(L[i++]));
      const td=(t,x,j)=>'<'+t+(al[j]?' style="text-align:'+al[j]+'"':'')+'>'+inline(x??'')+'</'+t+'>';
      out.push('<div class="tw"><table><thead><tr>'+h.map((x,j)=>td('th',x,j)).join('')+'</tr></thead><tbody>'+rows.map(r=>'<tr>'+h.map((_,j)=>td('td',r[j],j)).join('')+'</tr>').join('')+'</tbody></table></div>');continue}
    m=l.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);if(m){fl();cl();out.push('<h'+m[1].length+'>'+inline(m[2])+'</h'+m[1].length+'>');i++;continue}
    if(/^\s*([-*_])(\s*\1){2,}\s*$/.test(l)){fl();cl();out.push('<hr>');i++;continue}
    if(/^\s*>/.test(l)){fl();cl();const q=[];while(i<L.length&&/^\s*>/.test(L[i]))q.push(inline(L[i++].replace(/^\s*>\s?/,'')));out.push('<blockquote>'+q.join('<br>')+'</blockquote>');continue}
    m=l.match(/^(\s*)([-+*]|\d+[.)])\s+(.*)$/);
    if(m){fl();const ind=m[1].replace(/\t/g,'    ').length,t=/\d/.test(m[2])?'ol':'ul';
      while(ls.length&&ind<ls[ls.length-1].n){const x=ls.pop();out.push('</li></'+x.t+'>')}
      const top=ls[ls.length-1];
      if(top&&ind===top.n&&top.t===t)out.push('</li>');
      else if(top&&ind===top.n){out.push('</li></'+top.t+'>');ls.pop();ls.push({n:ind,t});out.push('<'+t+'>')}
      else{ls.push({n:ind,t});out.push(t==='ol'&&parseInt(m[2])>1?'<ol start="'+parseInt(m[2])+'">':'<'+t+'>')}
      let body=m[3];const tk=body.match(/^\[([ xX])\]\s+(.*)$/);
      out.push(tk?'<li class="task"><input type="checkbox" disabled'+(tk[1]!==' '?' checked':'')+'> '+inline(tk[2]):'<li>'+inline(body));i++;continue}
    if(ls.length&&/^\s{2,}\S/.test(l)){out.push('<br>'+inline(l.trim()));i++;continue}
    cl();para.push(l);i++}
  fl();cl();if(code!==null)endCode();return out.join('')};
document.addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('.cb');if(!b)return;
  if(b.dataset.run&&window.vkPreview){const c=b.closest('.code').querySelector('code').textContent;window.vkPreview(/<html|<!doctype/i.test(c)?c:'<!doctype html><meta name=viewport content="width=device-width,initial-scale=1"><body style="margin:0">'+c);return}
  const t=b.closest('.code').querySelector('code').textContent;(navigator.clipboard?navigator.clipboard.writeText(t):Promise.reject()).catch(()=>{});
  b.textContent='Скопировано';setTimeout(()=>b.textContent='Копировать',1500)});
window.mdInline=inline;window.texLite=tex;
})();
