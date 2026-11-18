(function(){
'use strict';
var $=function(i){return document.getElementById(i)},mo=matchMedia('(prefers-reduced-motion:no-preference)').matches,NS='http://www.w3.org/2000/svg';
function money(n){return '$'+Math.round(n).toLocaleString('en-US')}
function el(n,a,p){var e=document.createElementNS(NS,n);for(var k in a)e.setAttribute(k,a[k]);if(p)p.appendChild(e);return e}
function $$(s,r){return [].slice.call((r||document).querySelectorAll(s))}

/* header, menu, active nav */
var hd=$('hd'),mb=$('mb'),menu=$('menu');
function sc(){hd.classList.toggle('s',scrollY>30)}addEventListener('scroll',sc,{passive:true});sc();
function tm(o){menu.classList.toggle('open',o);mb.setAttribute('aria-expanded',o)}
mb.addEventListener('click',function(){tm(!menu.classList.contains('open'))});
$$('#menu a').forEach(function(a){a.addEventListener('click',function(){tm(false)})});
addEventListener('keydown',function(e){if(e.key=='Escape')tm(false)});
var navs=$$('.nl a');
if('IntersectionObserver' in window){
 var nio=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting)navs.forEach(function(a){a.classList.toggle('on',a.getAttribute('href')=='#'+e.target.id)})})},{rootMargin:'-40% 0px -55% 0px'});
 $$('main section[id]').forEach(function(s){nio.observe(s)});
 var rio=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('in');rio.unobserve(e.target)}})},{threshold:.15});
 if(mo)$$('.rv').forEach(function(x){rio.observe(x)});else $$('.rv').forEach(function(x){x.classList.add('in')});
}else $$('.rv').forEach(function(x){x.classList.add('in')});

/* ===== HERO: request-flow ===== */
var KD={n:{c:'#0D0F14',l:'Normal'},c:{c:'#2B6CB0',l:'Served from cache'},d:{c:'#B7791F',l:'Downgraded'},b:{c:'#C4143C',l:'Blocked'}};
var F={p:80.35,rule:'down',parts:[],cnt:{n:0,c:0,d:0,b:0},paths:{},acc:0,v:false,flash:{}};
function bez(a,b,v){if(!v){var m=(a[0]+b[0])/2;return 'M'+a[0]+' '+a[1]+'C'+m+' '+a[1]+','+m+' '+b[1-1]+' '+b[1]+','+b[0]+' '+b[1]}var m2=(a[1]+b[1])/2;return 'M'+a[0]+' '+a[1]+'C'+a[0]+' '+m2+','+b[0]+' '+m2+','+b[0]+' '+b[1]}
function bezFix(a,b,v){if(!v){var m=(a[0]+b[0])/2;return 'M'+a[0]+' '+a[1]+'C'+m+' '+a[1]+','+m+' '+b[1]+','+b[0]+' '+b[1]}return bez(a,b,v)}
function build(){
 var v=matchMedia('(max-width:760px)').matches,s=$('flow');F.v=v;s.innerHTML='';F.parts=[];F.paths={};
 var A,G,D,vb,ec;
 if(!v){vb='0 0 1000 450';A=[['Support assistant',40,96],['Search',40,196],['Agents',40,296]].map(function(a){return{t:a[0],x:a[1],y:a[2],w:176,h:56}});G={x:486,y:70,w:28,h:330};
  D={p:{t:'Premium model',x:786,y:60,w:176,h:52,k:'p'},e:{t:'Economical model',x:786,y:140,w:176,h:52,k:'d'},s:{t:'Self-hosted model',x:786,y:220,w:176,h:52,k:''},c:{t:'Served from cache',x:786,y:304,w:176,h:52,k:'c'},b:{t:'Blocked',x:786,y:382,w:176,h:52,k:'b'}}}
 else{vb='0 0 360 520';A=[['Support',14],['Search',130],['Agents',246]].map(function(a){return{t:a[0],x:a[1],y:14,w:100,h:46}});G={x:14,y:226,w:332,h:26};
  D={p:{t:'Premium',x:14,y:340,w:100,h:46,k:'p'},e:{t:'Economical',x:130,y:340,w:100,h:46,k:'d'},s:{t:'Self-hosted',x:246,y:340,w:100,h:46,k:''},c:{t:'From cache',x:60,y:448,w:110,h:46,k:'c'},b:{t:'Blocked',x:190,y:448,w:110,h:46,k:'b'}}}
 s.setAttribute('viewBox',vb);s.classList.toggle('lim',F.p>=100);
 var mid=v?[180,0]:[0,225];
 var gp=el('g',{},s),lbl=el('g',{},s),nd=el('g',{},s),pr=el('g',{},s);F.layer=pr;
 F.legA=A.map(function(a,i){var st=v?[a.x+a.w/2,a.y+a.h]:[a.x+a.w,a.y+a.h/2],en=v?[180+(st[0]-180)*.45,G.y]:[G.x,225+(st[1]-225)*.45];var p=el('path',{class:'pth',d:bezFix(st,en,v)},gp);return p});
 var gr=el('rect',{class:'gate',x:G.x,y:G.y,width:G.w,height:G.h},s);F.gate=gr;
 el('text',{class:'gt',x:v?180:500,y:v?G.y-12:G.y-30},s).textContent='Kivora';
 el('text',{class:'gt s',x:v?180:500,y:v?G.y+G.h+18:G.y-12},s).textContent=v?'Redact · Budget · Cache · Route':'Redact · Budget · Cache · Route';
 F.legB={};
 for(var k in D){(function(k){var d=D[k],st=v?[180+(d.x+d.w/2-180)*.45,G.y+G.h]:[G.x+G.w,225+(d.y+d.h/2-225)*.45],en=v?[d.x+d.w/2,d.y]:[d.x,d.y+d.h/2];F.legB[k]=el('path',{class:'pth',d:bezFix(st,en,v)},gp)})(k)}
 A.forEach(function(a){var g=el('g',{class:'nd'},nd);el('rect',{x:a.x,y:a.y,width:a.w,height:a.h,rx:2},g);var t=el('text',{x:a.x+14,y:a.y+(v?20:24)},g);t.textContent=a.t;var u=el('text',{class:'s',x:a.x+14,y:a.y+(v?36:42)},g);u.textContent='Application'});
 F.nodes={};for(var k2 in D){var d2=D[k2],g2=el('g',{class:'nd '+d2.k},nd);F.nodes[k2]=el('rect',{x:d2.x,y:d2.y,width:d2.w,height:d2.h,rx:2},g2);var t2=el('text',{x:d2.x+14,y:d2.y+(v?20:24)},g2);t2.textContent=d2.t;var u2=el('text',{class:'s',x:d2.x+14,y:d2.y+(v?36:42)},g2);u2.textContent=k2=='c'?'No provider call':k2=='b'?'Stopped at the gate':k2=='e'?(v?'Fallback':'Approved fallback'):'Provider'}
 F.A=A;F.D=D;F.G=G;
 /* premium label state */
 setState();
}
function decide(){var r=Math.random();if(r<.26)return{k:'c',d:'c'};var prem=Math.random()<.7;if(prem&&F.p>=100)return F.rule=='down'?{k:'d',d:'e'}:{k:'b',d:'b'};return{k:'n',d:prem?'p':'s'}}
var last=0;
function frame(ts){
 var dt=Math.min(.05,(ts-last)/1000);last=ts;
 F.acc+=dt*(F.v?2.2:3.2);
 while(F.acc>=1&&F.parts.length<30){F.acc-=1;var i=Math.floor(Math.random()*3);var c=el('circle',{r:F.v?3.6:4.5,fill:'#0D0F14'},F.layer);F.parts.push({c:c,p:F.legA[i],t:0,leg:1,hold:0})}
 if(F.acc>1)F.acc=0;
 for(var j=F.parts.length-1;j>=0;j--){var q=F.parts[j];
  if(q.hold>0){q.hold-=dt;if(q.hold<=0){q.leg=2;q.t=0;q.p=F.legB[q.o.d];q.c.setAttribute('fill',KD[q.o.k].c);q.c.style.opacity=1}continue}
  q.len=q.len&&q.lp===q.p?q.len:(q.lp=q.p,q.p.getTotalLength());q.t+=dt*(q.leg==1?.55:.5);
  if(q.t>=1){if(q.leg==1){q.o=decide();q.hold=.16;q.c.style.opacity=0;q.len=0;q.t=1;var gx=F.gate;if(q.o.k=='b'||q.o.k=='d'){gx.style.fill=q.o.k=='b'?'#C4143C':'#B7791F';F.flash.g=ts}continue}
   F.cnt[q.o.k]++;F.flash[q.o.d]=ts;q.c.remove();F.parts.splice(j,1);continue}
  var pt=q.p.getPointAtLength(q.t*q.len);q.c.setAttribute('cx',pt.x);q.c.setAttribute('cy',pt.y)}
 for(var k in F.flash){if(ts-F.flash[k]>220){if(k=='g')F.gate.style.fill='';else if(F.nodes[k])F.nodes[k].style.strokeWidth='';delete F.flash[k]}else if(k!='g'&&F.nodes[k])F.nodes[k].style.strokeWidth='3.5'}
 lg();requestAnimationFrame(frame)}
var lgEl=$('lg');lgEl.innerHTML=['n','c','d','b'].map(function(k){return '<li><i style="background:'+KD[k].c+'"></i>'+KD[k].l+'<b id="n-'+k+'">0</b></li>'}).join('');
var lt=0;function lg(){var n=performance.now();if(n-lt<250)return;lt=n;for(var k in F.cnt)$('n-'+k).textContent=F.cnt[k]}
function setState(){var p=F.p,sp=$('sp');sp.value=p;$('spv').textContent=money(p*600)+' · '+(p%1?p.toFixed(1):p)+'%';
 $$('#th span').forEach(function(s){var t=+s.dataset.t;s.classList.toggle('on',p>=t);s.classList.toggle('hot',p>=t&&(t>=90))});
 $('flow').classList.toggle('lim',p>=100)}
$('sp').addEventListener('input',function(){F.p=+this.value;setState()});
$('rd').addEventListener('click',function(){F.rule='down';$('rd').setAttribute('aria-pressed',true);$('rb').setAttribute('aria-pressed',false)});
$('rb').addEventListener('click',function(){F.rule='block';$('rd').setAttribute('aria-pressed',false);$('rb').setAttribute('aria-pressed',true)});
var pl=null;
function stopPlay(){if(pl){cancelAnimationFrame(pl);pl=null;$('play').textContent='Play the month'}}
$('play').addEventListener('click',function(){if(pl){stopPlay();return}if(F.p>=110)F.p=0;$('play').textContent='Pause';var t0=performance.now(),p0=F.p;(function st(t){var k=Math.min((t-t0)/(mo?14000:1500)*(110/(110-p0||1)),1);F.p=Math.round((p0+(110-p0)*k)*10)/10;setState();if(k<1)pl=requestAnimationFrame(st);else stopPlay()})(t0);pl=requestAnimationFrame(function s2(t){});});
$('rst').addEventListener('click',function(){stopPlay();F.p=80.35;for(var k in F.cnt)F.cnt[k]=0;setState()});
$('frame').addEventListener('pointermove',function(e){var r=this.getBoundingClientRect();this.style.setProperty('--mx',(e.clientX-r.left)+'px');this.style.setProperty('--my',(e.clientY-r.top)+'px')});
build();setState();if(mo)requestAnimationFrame(frame);
var mq=matchMedia('(max-width:760px)');(mq.addEventListener?mq.addEventListener.bind(mq,'change'):mq.addListener.bind(mq))(function(){build()});

/* ===== Problem explorer ===== */
var EX={inv:{n:'The invoice shows a single total, $48,930. Kivora’s usage records add up to $48,210, so $720 needs explaining.',r:[['Provider invoice total',48930,'#8C95A6']]},
team:{n:'The same $48,210 of usage, attributed to the teams that made the calls.',r:[['Support',20150],['Growth',14950],['Platform',8520],['Research',4590]]},
model:{n:'The same usage by model. Seeing this split shows what a cheaper model could take over.',r:[['Premium model',27600],['Economical model',11900],['Embeddings',5100],['Self-hosted',3610]]},
app:{n:'The same usage by application, so each product owner sees their own number.',r:[['Support assistant',18400],['Search',12300],['Agents',10900],['Internal tools',6610]]}};
var SH=['#0D0F14','#3B4456','#7A8496','#B4BAC6'];
function ex(k){var d=EX[k],tot=0;d.r.forEach(function(r){tot+=r[1]});
 var sb=$('sbar'),h='';d.r.forEach(function(r,i){h+='<i style="background:'+(r[2]||SH[i])+'" title="'+r[0]+'"></i>'});sb.innerHTML=h;
 var tb='';d.r.forEach(function(r,i){tb+='<tr><td><i style="background:'+(r[2]||SH[i])+'"></i>'+r[0]+'</td><td>'+money(r[1])+'</td><td>'+(k=='inv'?'':Math.round(r[1]/tot*100)+'%')+'</td></tr>'});$('tb').innerHTML=tb;$('exn').textContent=d.n;
 requestAnimationFrame(function(){requestAnimationFrame(function(){$$('#sbar i').forEach(function(x,i){x.style.width=(d.r[i][1]/tot*100)+'%'})})});
 $$('#ex .seg button').forEach(function(b){b.setAttribute('aria-pressed',b.dataset.v==k)})}
$$('#ex .seg button').forEach(function(b){b.addEventListener('click',function(){ex(b.dataset.v)})});ex('inv');

/* ===== Chart component ===== */
var P={week:{T:7,t:5,B:14000,tg:9900,r:.3,s:3,u:'Day'},month:{T:30,t:22,B:60000,tg:48210,r:.6,s:7,u:'Day'},quarter:{T:90,t:64,B:180000,tg:140000,r:.2,s:11,u:'Day'}};
function rnd(s){return function(){s|=0;s=s+0x6D2B79F5|0;var t=Math.imul(s^s>>>15,1|s);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
function dat(k){var p=P[k],r=rnd(p.s),w=[],sum=0,i;for(i=1;i<=p.t;i++){var x=(.75+r()*.5)*(1+p.r*i/p.t);w.push(x);sum+=x}var c=[0],a=0;w.forEach(function(x){a+=x;c.push(p.tg*a/sum)});var n=Math.min(7,p.t),avg=(c[p.t]-c[p.t-n])/n;return{p:p,c:c,avg:avg,fc:c[p.t]+avg*(p.T-p.t)}}
function fmt(v){return v>=1000?'$'+(v/1000).toFixed(v%1000?1:0)+'K':'$'+Math.round(v)}
function crossDay(c,v){for(var i=0;i<c.length;i++)if(c[i]>=v)return i;return -1}
function Chart(svg,tip,o){var self=this;this.svg=svg;this.tip=tip;this.o=o;this.layer=o.layer||9;
 this.render=function(k){var d=this.d=dat(k),p=d.p,W=(this.nw=matchMedia('(max-width:700px)').matches)?480:800,H=340,L=58,R=22,Tp=24,Bt=36,B=p.B,q=B/4,ymax=Math.ceil(Math.max(B,d.fc)*1.06/q)*q;this.k=k;svg.setAttribute('viewBox','0 0 '+W+' 340');
  var X=function(a){return L+(W-L-R)*a/p.T},Y=function(v){return H-Bt-(H-Bt-Tp)*v/ymax};this.X=X;this.Y=Y;this.W=W;this.L=L;this.R=R;
  var h='<g data-l="0" class="on">';for(var v=0;v<=ymax+1;v+=q)h+='<line class="gl" x1="'+L+'" x2="'+(W-R)+'" y1="'+Y(v)+'" y2="'+Y(v)+'"/><text x="'+(L-8)+'" y="'+(Y(v)+4)+'" text-anchor="end">'+fmt(v)+'</text>';
  [0,.5,1].forEach(function(f){var dd=Math.round(f*p.T);h+='<text x="'+X(dd)+'" y="'+(H-12)+'" text-anchor="'+(f==0?'start':f==1?'end':'middle')+'">'+(dd==0?'Start':'Day '+dd)+'</text>'});h+='</g>';
  h+='<g data-l="1"><line class="bud" x1="'+L+'" x2="'+(W-R)+'" y1="'+Y(B)+'" y2="'+Y(B)+'"/><text x="'+(L+4)+'" y="'+(Y(B)-7)+'" style="fill:var(--bud)">Budget '+fmt(B)+'</text></g>';
  var ap='M'+X(0)+' '+Y(0),lp='';d.c.forEach(function(v,i){lp+=(i?'L':'M')+X(i).toFixed(1)+' '+Y(v).toFixed(1);ap+='L'+X(i).toFixed(1)+' '+Y(v).toFixed(1)});ap+='L'+X(p.t)+' '+Y(0)+'Z';
  h+='<g data-l="2"><path class="ar" d="'+ap+'"/><path class="ln" pathLength="1" d="'+lp+'"/></g>';
  h+='<g data-l="3">';[.5,.8,.9].forEach(function(f){h+='<line class="th2" x1="'+L+'" x2="'+(W-R)+'" y1="'+Y(B*f)+'" y2="'+Y(B*f)+'"/><text x="'+(L+4)+'" y="'+(Y(B*f)-5)+'">'+Math.round(f*100)+'%</text>';var cd=crossDay(d.c,B*f);if(cd>0&&cd<=p.t)h+='<circle class="mk" cx="'+X(cd)+'" cy="'+Y(d.c[cd])+'" r="4.5"/>'+(o.breaker?'':'<text x="'+(X(cd)-8)+'" y="'+(Y(d.c[cd])-10)+'" text-anchor="end" style="fill:var(--bud)">'+Math.round(f*100)+'% · day '+cd+'</text>')});h+='</g>';
  var fe=d.fc,cx=-1;if(fe>B)cx=p.t+(B-d.c[p.t])/d.avg;
  h+='<g data-l="4"><path class="fc" d="M'+X(p.t)+' '+Y(d.c[p.t])+'L'+X(p.T)+' '+Y(fe)+'"/><line class="th2" x1="'+X(p.t)+'" x2="'+X(p.t)+'" y1="'+Tp+'" y2="'+(H-Bt)+'"/><text x="'+(X(p.t)-6)+'" y="'+(Tp+8)+'" text-anchor="end">Today</text><text x="'+(W-R)+'" y="'+(Y(fe)+(fe>B?-9:16))+'" text-anchor="end" style="fill:var(--bud)">Forecast '+fmt(fe)+'</text>';
  if(cx>0&&cx<=p.T)h+='<circle cx="'+X(cx)+'" cy="'+Y(B)+'" r="5" fill="none" stroke="var(--bud)" stroke-width="2"/>';
  if(o.breaker){var bd=Math.round(p.t*.36),bx=X(bd),by=Y(d.c[bd]);h+='<path class="mk" d="M'+bx+' '+(by-8)+'l7 8l-7 8l-7-8z"/><circle class="mk ring" cx="'+bx+'" cy="'+by+'" r="5" style="opacity:.5"/><text x="'+(bx+12)+'" y="'+(by+24)+'" style="fill:var(--bud)">Agent paused · day '+bd+'</text>'}
  h+='</g>';
  if(o.invoice){var ip='';d.c.forEach(function(v,i){ip+=(i?'L':'M')+X(i).toFixed(1)+' '+Y(v*1.01493).toFixed(1)});var gp=ip,bk='';for(var i2=d.c.length-1;i2>=0;i2--)bk+='L'+X(i2).toFixed(1)+' '+Y(d.c[i2]).toFixed(1);h+='<g data-l="5"><path class="gap" d="'+gp+bk+'Z"/><path class="inv" d="'+ip+'"/><text x="'+(this.nw?X(p.t)-10:X(p.t)+10)+'" y="'+(Y(d.c[p.t]*1.01493)+22)+'"'+(this.nw?' text-anchor="end"':'')+' style="fill:var(--inv)">Provider invoice +$720</text></g>'}
  h+='<line class="xh" id="'+svg.id+'x" y1="'+Tp+'" y2="'+(H-Bt)+'"/><circle class="dot" id="'+svg.id+'d" r="5"/><rect id="'+svg.id+'h" x="'+L+'" y="'+Tp+'" width="'+(W-L-R)+'" height="'+(H-Bt-Tp)+'" fill="transparent"/>';
  svg.innerHTML=h;this.setLayer(0);var me=this;requestAnimationFrame(function(){requestAnimationFrame(function(){me.setLayer(me.layer)})});this.bind()};
 this.setLayer=function(n){$$('[data-l]',svg).forEach(function(g){g.classList.toggle('on',+g.dataset.l<=n)})};
 this.bind=function(){var hit=$(svg.id+'h'),xh=$(svg.id+'x'),dt=$(svg.id+'d'),d=this.d,p=d.p,me=this;
  function mv(e){var r=svg.getBoundingClientRect(),px=(e.clientX-r.left)/r.width*me.W,day=Math.max(0,Math.min(p.T,Math.round((px-me.L)/(me.W-me.L-me.R)*p.T))),act=day<=p.t,v=act?d.c[day]:d.c[p.t]+d.avg*(day-p.t);
   xh.setAttribute('x1',me.X(day));xh.setAttribute('x2',me.X(day));xh.style.opacity=.5;dt.setAttribute('cx',me.X(day));dt.setAttribute('cy',me.Y(v));dt.style.opacity=1;
   tip.innerHTML=(act?'Day '+day:'Forecast · day '+day)+' · '+money(v)+' · '+Math.round(v/p.B*100)+'% of budget';tip.style.left=(me.X(day)/me.W*r.width)+'px';tip.style.top=(me.Y(v)/340*r.height)+'px';tip.style.opacity=1}
  function lv(){xh.style.opacity=0;dt.style.opacity=0;tip.style.opacity=0}
  hit.addEventListener('pointermove',mv);hit.addEventListener('pointerdown',mv);hit.addEventListener('pointerleave',lv)}}
/* analytics instance */
var c1=new Chart($('ch1'),$('tip1'),{layer:4});
function kpi(k){var d=dat(k),p=d.p,pct=d.c[p.t]/p.B*100,st=pct>=100?['Over budget','h']:pct>=90?['Final warning','h']:pct>=80?['Alert','w']:pct>=50?['Heads-up','o']:['Within budget','o'],fp=d.fc/p.B*100;
 $('kp').innerHTML='<div><small>Spend to date</small><strong>'+money(d.c[p.t])+'</strong></div><div><small>Of budget '+fmt(p.B)+'</small><strong>'+pct.toFixed(1)+'%</strong></div><div><small>Forecast at period end</small><strong>'+money(d.fc)+'</strong></div><div><small>Alert state</small><span class="chip '+st[1]+'" style="margin-top:8px">'+st[0]+'</span><small style="margin-top:4px">Forecast '+Math.round(fp)+'% of budget</small></div>';
 c1.render(k);$$('#per button').forEach(function(b){b.setAttribute('aria-pressed',b.dataset.k==k)})}
$$('#per button').forEach(function(b){b.addEventListener('click',function(){kpi(b.dataset.k)})});
var c1done=false;
if('IntersectionObserver' in window){new IntersectionObserver(function(es,o){if(es[0].isIntersecting){o.disconnect();kpi('month')}},{threshold:.25}).observe($('cw1'))}else kpi('month');
/* story instance */
var c2=new Chart($('ch2'),$('tip2'),{layer:1,invoice:true,breaker:true});c2.render('month');
var stps=$$('.stp');
if('IntersectionObserver' in window){var sio=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){var n=+e.target.dataset.l;c2.layer=n;c2.setLayer(n);stps.forEach(function(a){a.classList.toggle('on',a===e.target)})}})},{rootMargin:'-45% 0px -45% 0px'});stps.forEach(function(a){sio.observe(a)})}

var bq=matchMedia('(max-width:700px)');(bq.addEventListener?bq.addEventListener.bind(bq,'change'):bq.addListener.bind(bq))(function(){c2.render('month');if(c1.k)c1.render(c1.k)});
/* ===== Tabs ===== */
var tb=[0,1,2].map(function(n){return $('t'+n)}),ind=$('ind');
function tab(i,f){tb.forEach(function(t,j){t.setAttribute('aria-selected',j==i);t.tabIndex=j==i?0:-1;$('p'+j).classList.toggle('on',j==i)});ind.style.left=tb[i].offsetLeft+'px';ind.style.width=tb[i].offsetWidth+'px';if(f)tb[i].focus()}
tb.forEach(function(t,i){t.addEventListener('click',function(){tab(i)});t.addEventListener('keydown',function(e){if(e.key=='ArrowRight')tab((i+1)%3,1);if(e.key=='ArrowLeft')tab((i+2)%3,1)})});
tab(0);addEventListener('resize',function(){var i=tb.findIndex(function(t){return t.getAttribute('aria-selected')=='true'});tab(i)});
if(document.fonts&&document.fonts.ready)document.fonts.ready.then(function(){var i=tb.findIndex(function(t){return t.getAttribute('aria-selected')=='true'});tab(i)});

/* Guard demo */
function esc(s){return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}
function guard(){var t=$('gin').value,inj=/ignore (all |any )?(previous|prior) instructions|disregard (your|the) instructions|reveal (your )?system prompt/i.test(t);
 if(inj){$('gres').innerHTML='<mark style="background:#C4143C">Blocked</mark> · known prompt-injection phrase. The request never reaches the provider.';return}
 var n=0,o=esc(t).replace(/\b(?:\d[ -]?){13,16}\b/g,function(){n++;return '<mark>CARD</mark>'}).replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g,function(){n++;return '<mark>EMAIL</mark>'}).replace(/\+?\d[\d ()-]{8,}\d/g,function(){n++;return '<mark>PHONE</mark>'});
 $('gres').innerHTML='<b style="font-weight:500">The model receives:</b><br>'+(o||'(empty)')+'<br><span style="color:var(--slate);font-size:13.5px">'+(n?n+' item'+(n>1?'s':'')+' redacted':'Nothing to redact')+'</span>'}
$('gin').addEventListener('input',guard);$$('[data-s]').forEach(function(b){b.addEventListener('click',function(){$('gin').value=b.dataset.s;guard()})});guard();

/* Compass demo */
var POOL=['reset password','refund policy','order status','shipping times','cancel plan','invoice copy','api rate limit','data export','sso setup','pricing tiers'],cache={},hits=0,miss=0,saved=0;
function csend(){var cs=$('cells');cs.innerHTML='';for(var i=0;i<20;i++){var z=Math.pow(Math.random(),1.8),pr=POOL[Math.floor(z*POOL.length)],h=!!cache[pr];cache[pr]=1;if(h){hits++;saved++}else miss++;var c=document.createElement('i');if(h)c.className='h';c.title=pr+(h?' · served from cache':' · sent to provider');c.style.animationDelay=(i*30)+'ms';cs.appendChild(c)}
 $('cst').textContent=hits+' hits · '+miss+' misses';$('csv').textContent='Calls avoided at an assumed $0.012 each: $'+(saved*.012).toFixed(2)}
$('csend').addEventListener('click',csend);$('cclr').addEventListener('click',function(){cache={};hits=miss=saved=0;$('cells').innerHTML='';$('cst').textContent='0 hits · 0 misses';$('csv').textContent='Calls avoided at an assumed $0.012 each: $0.00'});
var ST=['shadow test, 0% live','5% of traffic live','25% of traffic live','100% of traffic live'],stg=0,ev=0;
function gate(){$('rst2').textContent=ST[stg];$('rev').textContent=(stg==3?'complete':ev+' / 30');$('rmt').style.width=(stg==3?100:ev/30*100)+'%';$('radv').disabled=!(stg<3&&ev>=30);$('rcol').disabled=stg==3||ev>=30}
$('rcol').addEventListener('click',function(){ev=Math.min(30,ev+6);gate()});$('radv').addEventListener('click',function(){stg++;ev=0;gate()});$('rrb').addEventListener('click',function(){stg=0;ev=0;gate()});gate();

/* Autopilot demo */
var Q=[{a:'pause_agent support-triage',r:'stop-agent-loop',s:'executed',rb:1},{a:'downgrade growth-bot to economical model',r:'protect-budget',s:'pending'},{a:'notify team-owner: forecast over budget',r:'forecast-over',s:'executed'}],au=0;
function log(m){au++;var p=document.createElement('p');p.textContent='#'+au+' · '+m;var a=$('aud');a.insertBefore(p,a.children[1]||null)}
function qr(){$('q').innerHTML=Q.map(function(x,i){var lab={executed:'Executed',pending:'Waiting for approval',rejected:'Rejected','rolled back':'Rolled back'}[x.s],cl=x.s=='pending'?'pe':x.s=='executed'?'ex2':'rj',b='';
 if(x.s=='pending')b='<button class="sbtn" data-i="'+i+'" data-a="approve">Approve</button> <button class="sbtn" data-i="'+i+'" data-a="reject">Reject</button>';else if(x.s=='executed'&&x.rb)b='<button class="sbtn" data-i="'+i+'" data-a="roll">Roll back</button>';
 return '<li><div><b style="font-weight:500">'+x.a+'</b><small><span class="st '+cl+'">'+lab+'</span>rule: '+x.r+'</small></div><div>'+b+'</div></li>'}).join('')}
$('q').addEventListener('click',function(e){var b=e.target.closest('button');if(!b)return;var x=Q[+b.dataset.i],a=b.dataset.a;if(a=='approve'){x.s='executed';x.rb=1;log('approved · '+x.a)}else if(a=='reject'){x.s='rejected';log('rejected · '+x.a)}else{x.s='rolled back';log('rolled back · '+x.a)}qr()});
qr();log('queue loaded · 3 actions');

/* Calculator */
function calc(){var s=+$('c1').value*1000,r=+$('c2').value/100,h=+$('c3').value/100,v=s*r*h;$('v1').textContent=money(s);$('v2').textContent=$('c2').value+'%';$('v3').textContent=$('c3').value+'%';$('o1').textContent=money(s*r);$('o2').textContent=money(v);$('o3').textContent=money(v*.15)+' – '+money(v*.2);$('o4').textContent=money(v*.8)+' – '+money(v*.85)}
['c1','c2','c3'].forEach(function(i){$(i).addEventListener('input',calc)});calc();

/* Form: posts to /api/waitlist, falls back to an email if that fails */
$('f').addEventListener('submit',function(e){e.preventDefault();var f=e.target,d=new FormData(f),body={email:d.get('email'),company:d.get('company')||'',goal:d.get('goal')||''},btn=f.querySelector('button'),ok=$('ok');btn.disabled=true;ok.textContent='Sending…';
 fetch('/api/waitlist',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}).then(function(r){if(!r.ok)throw new Error('http '+r.status);ok.textContent='Thank you. You’re on the list, and we’ll contact you first.';f.reset()}).catch(function(){ok.textContent='We couldn’t reach the sign-up service, so your email app is opening instead.';location.href='mailto:connect.kivora@gmail.com?subject='+encodeURIComponent('Kivora early access')+'&body='+encodeURIComponent('Email: '+body.email+'\nCompany: '+body.company+'\nGoal: '+body.goal)}).then(function(){btn.disabled=false})});
})();
