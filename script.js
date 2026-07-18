'use strict';

const APP_VERSION = 'IPHOEL Formula Engine V13.4.1 • Calibrated Twin Occurrence Gate';
const DIGITS = [0,1,2,3,4,5,6,7,8,9];
const POS = ['A','K','L','E'];
const TWIN_SHAPES = [[0,1,'A=K'],[1,2,'K=L'],[2,3,'L=E'],[0,3,'A=E'],[0,2,'A=L'],[1,3,'K=E']];
const DAYS = ['minggu','senin','selasa','rabu','kamis','jumat','sabtu'];
const MONTHS = {jan:1,january:1,januari:1,feb:2,february:2,februari:2,mar:3,march:3,maret:3,apr:4,april:4,may:5,mei:5,jun:6,june:6,juni:6,jul:7,july:7,juli:7,aug:8,august:8,agt:8,agustus:8,sep:9,sept:9,september:9,oct:10,okt:10,october:10,oktober:10,nov:11,november:11,dec:12,des:12,december:12,desember:12};
const $ = id => typeof document === 'undefined' ? null : document.getElementById(id);
let runId = 0;

function mod10(n){ return ((Number(n)||0)%10+10)%10; }
function digitalRoot(n){ n=Math.abs(Number(n)||0); while(n>9)n=String(n).split('').reduce((a,b)=>a+Number(b),0); return n; }
function unique(arr){ return [...new Set((arr||[]).map(Number).filter(Number.isInteger))]; }
function clamp(x,a=0,b=1){ return Math.max(a,Math.min(b,Number(x)||0)); }
function sum(arr){ return (arr||[]).reduce((a,b)=>a+(Number(b)||0),0); }
function mean(arr){ return arr?.length?sum(arr)/arr.length:0; }
function wilsonLower(h,n,z=1.96){if(!n)return 0;const p=h/n,den=1+z*z/n,center=(p+z*z/(2*n))/den,half=z*Math.sqrt(p*(1-p)/n+z*z/(4*n*n))/den;return Math.max(0,center-half);}
function countMap(arr){ const m={}; (arr||[]).forEach(x=>m[x]=(m[x]||0)+1); return m; }
function normalize(arr){ const max=Math.max(1e-9,...arr.map(x=>Math.max(0,Number(x)||0))); return arr.map(x=>Math.max(0,Number(x)||0)/max); }
function debounce(fn,ms){ let t; return (...args)=>{clearTimeout(t);t=setTimeout(()=>fn(...args),ms);}; }
function sleep(ms){ return new Promise(r=>setTimeout(r,ms)); }

function init(){
  $('versionPill').textContent=APP_VERSION;
  $('modelPill').textContent='Ecology Integrity';
  $('dataInput').addEventListener('input',debounce(analyze,260));
  $('btnClear').addEventListener('click',clearAll);
}
if(typeof document!=='undefined')document.addEventListener('DOMContentLoaded',init);

function clearAll(){
  $('dataInput').value=''; $('rowCounter').textContent='0 baris';
  $('output').className='empty-state';
  $('output').innerHTML='<div><div class="empty-icon">Φ</div><h3>Belum ada data</h3><p>Tempel data historis. Analisis berjalan otomatis.</p></div>';
  scanner(false,[],0,'Menunggu data');
}
async function analyze(){
  const id=++runId, rows=parseRows($('dataInput').value);
  $('rowCounter').textContent=`${rows.length} baris`;
  if(rows.length<12){ $('output').className='empty-state'; $('output').innerHTML='<div><div class="empty-icon">Φ</div><h3>Data belum cukup</h3><p>Minimal 12 baris agar replay formula tidak terlalu rapuh.</p></div>'; return; }
  const stages=['Normalisasi satu market','Membalik riwayat tertua → terbaru','Membangun transisi hari market','Replay empat profil formula lokal','Menguji integritas profil dan konflik horizon','Memisahkan Twin Occurrence Gate dari ranking kandidat'];
  scanner(true,rows,0,stages[0]);
  for(let i=0;i<stages.length;i++){ if(id!==runId)return; scanner(true,rows,(i+1)/stages.length,stages[i]); await sleep(110); }
  if(id!==runId)return;
  const result=buildPrediction(rows); renderResult(result); scanner(false,rows,1,'Scan selesai • profil diuji integritas; konflik diselesaikan tanpa rescue pasca-ranking');
}
function scanner(active,rows,progress,label){
  const frame=$('scannerFrame'); if(frame){frame.classList.toggle('is-scanning',active);frame.classList.toggle('is-complete',!active&&progress>=1);}
  if($('scannerStatus'))$('scannerStatus').textContent=`${label} • ${(rows||[]).length} baris`;
  if($('scannerMeter'))$('scannerMeter').style.width=`${Math.round(100*progress)}%`;
  if($('scannerCursor'))$('scannerCursor').textContent=(rows?.length?`${Math.round(rows.length*progress)}/${rows.length}`:'0/0');
}

function cleanText(text){ return String(text||'').normalize('NFKC').replace(/[\u200B-\u200D\uFEFF]/g,'').replace(/[\u00A0\u202F]/g,' ').replace(/[\u2013\u2014]/g,'-').replace(/\r/g,'\n'); }
function normalizeLine(line){ return cleanText(line).replace(/[|;]/g,' ').replace(/\s+/g,' ').trim(); }
function normalizeDay(text){
  const m=String(text||'').toLowerCase().match(/\b(minggu|senin|selasa|rabu|kamis|jumat|jum'at|sabtu|sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i);
  if(!m)return '';
  const map={sunday:'minggu',monday:'senin',tuesday:'selasa',wednesday:'rabu',thursday:'kamis',friday:'jumat',saturday:'sabtu',"jum'at":'jumat'};
  return map[m[1].toLowerCase()]||m[1].toLowerCase();
}
function parseDigits(str){
  const spaced=String(str||'').match(/(?<!\d)\d(?!\d)/g); if(spaced?.length>=4)return spaced.slice(-4).map(Number);
  const compact=String(str||'').replace(/\D/g,''); return compact.length>=4?compact.slice(-4).split('').map(Number):[];
}
function extractDate(text){
  const s=String(text||''),m=s.match(/(\d{1,2})\s*[\/-]\s*([A-Za-zÀ-ÿ]{3,12}|\d{1,2})\s*[\/-]\s*(\d{2,4})/i); if(!m)return '';
  const y=String(m[3]).length===2?'20'+m[3]:m[3]; return `${String(m[1]).padStart(2,'0')}/${m[2]}/${y}`;
}
function dateValue(date){
  const m=String(date||'').match(/(\d{1,2})\/([^/]+)\/(\d{4})/); if(!m)return 0;
  const mon=/^\d+$/.test(m[2])?Number(m[2]):(MONTHS[m[2].toLowerCase().slice(0,3)]||0); return new Date(Number(m[3]),mon-1,Number(m[1])).getTime()||0;
}
function parseRows(raw){
  const out=[];
  cleanText(raw).split(/\n+/).map(normalizeLine).filter(Boolean).forEach((line,index)=>{
    const code=line.match(/\b([A-Z][A-Z0-9]{1,7})\s*\[\s*(\d{1,8})\s*\]/i);
    const digits=parseDigits(code?line.slice(line.lastIndexOf(']')+1):line); if(digits.length<4)return;
    out.push({code:code?code[1].toUpperCase():'',period:code?Number(code[2]):0,date:extractDate(line),day:normalizeDay(line),digits:digits.slice(0,4),index,raw:line});
  });
  const market=out[0]?.code||''; const seen=new Set();
  return out.filter(r=>!market||r.code===market).filter(r=>{const k=`${r.code}|${r.period}|${r.date}|${r.digits.join('')}`;if(seen.has(k))return false;seen.add(k);return true;})
    .sort((a,b)=>dateValue(b.date)-dateValue(a.date)||(b.period||0)-(a.period||0)||a.index-b.index);
}

function inferTargetDay(rows){
  const chrono=rows.slice().reverse(), latest=rows[0]; const counts={}; const recency={};
  for(let i=0;i<chrono.length-1;i++)if(chrono[i].day===latest.day){const d=chrono[i+1].day;if(!d)continue;counts[d]=(counts[d]||0)+1;recency[d]=i;}
  const ranked=Object.keys(counts).sort((a,b)=>counts[b]-counts[a]||(recency[b]||0)-(recency[a]||0));
  return ranked[0]||DAYS[(DAYS.indexOf(latest.day)+1+7)%7];
}
function transitionsFor(rows,fromDay,toDay){
  const c=rows.slice().reverse(),out=[]; for(let i=0;i<c.length-1;i++)if(c[i].day===fromDay&&c[i+1].day===toDay)out.push({source:c[i],target:c[i+1],index:i}); return out;
}

function formulaLibrary(){
  const list=[],add=(id,family,label,fn)=>list.push({id,family,label,fn});
  for(let p=0;p<4;p++){
    add(`raw_${p}`,'raw',`raw ${POS[p]}`,s=>s[p]);
    add(`m9_${p}`,'mirror9',`mirror9 ${POS[p]}`,s=>mod10(9-s[p]));
    add(`m10_${p}`,'mirror10',`mirror10 ${POS[p]}`,s=>mod10(10-s[p]));
    [-2,-1,1,2].forEach(k=>add(`n${k}_${p}`,Math.abs(k)===1?'neighbor1':'neighbor2',`${POS[p]} ${k>0?'+':''}${k}`,s=>mod10(s[p]+k)));
  }
  for(let i=0;i<4;i++)for(let j=i+1;j<4;j++){
    const n=POS[i]+POS[j];
    add(`sum_${i}${j}`,'pairSum',`${n} sum`,s=>mod10(s[i]+s[j]));
    add(`abs_${i}${j}`,'pairAbsDiff',`${n} abs-diff`,s=>Math.abs(s[i]-s[j]));
    add(`diff_${i}${j}`,'pairDiff',`${n} diff`,s=>mod10(s[i]-s[j]));
    add(`rdiff_${i}${j}`,'pairReverseDiff',`${n} reverse-diff`,s=>mod10(s[j]-s[i]));
    add(`prod_${i}${j}`,'pairProd',`${n} product`,s=>mod10(s[i]*s[j]));
    add(`m9sum_${i}${j}`,'pairMirror',`mirror9 ${n} sum`,s=>mod10(9-mod10(s[i]+s[j])));
  }
  add('total','aggregate','total mod10',s=>mod10(sum(s)));
  add('root','root','digital root',s=>digitalRoot(sum(s)));
  add('m9root','rootMirror','mirror9 root',s=>mod10(9-digitalRoot(sum(s))));
  add('m10root','rootMirror','mirror10 root',s=>mod10(10-digitalRoot(sum(s))));
  [[0,1,2],[0,1,3],[0,2,3],[1,2,3]].forEach(c=>add(`triad_${c.join('')}`,'triad',`triad ${c.map(i=>POS[i]).join('')}`,s=>mod10(c.reduce((z,i)=>z+s[i],0))));
  return list;
}

const LOCAL_PROFILES = [
  {id:'formula-first',label:'Formula-First Baseline',window:99,activeN:7,activeHits:3,activePost:.25,activeStability:.45,tieN:5,tieHits:2,tiePost:.20,tieMult:.36,recurrence:.34,familyTop:5},
  {id:'strict-full',label:'Full-Depth Ketat',window:99,activeN:7,activeHits:3,activePost:.25,activeStability:.50,tieN:5,tieHits:2,tiePost:.20,tieMult:.20,recurrence:.24,familyTop:4},
  {id:'recent-local',label:'Recent Local 4',window:4,activeN:4,activeHits:2,activePost:.24,activeStability:.20,tieN:3,tieHits:2,tiePost:.20,tieMult:.22,recurrence:.18,familyTop:3},
  {id:'recurrence-full',label:'Full-Depth Recurrence',window:99,activeN:6,activeHits:3,activePost:.25,activeStability:.35,tieN:5,tieHits:2,tiePost:.20,tieMult:.30,recurrence:.48,familyTop:4}
];

function betaMean(h,n,priorHit=1,priorMiss=4){ return (h+priorHit)/(n+priorHit+priorMiss); }
function formulaStatsProfile(transitions,formula,p,profile){
  let hits=0,recentHits=0; const n=transitions.length,cut=Math.floor(n/2),bands=[{h:0,n:0},{h:0,n:0},{h:0,n:0}];
  transitions.forEach((tr,i)=>{const ok=formula.fn(tr.source.digits)===tr.target.digits[p];if(ok)hits++;if(i>=cut&&ok)recentHits++;const b=Math.min(2,Math.floor(3*i/Math.max(1,n)));bands[b].n++;if(ok)bands[b].h++;});
  const posterior=betaMean(hits,n),recent=betaMean(recentHits,n-cut||1),bandRates=bands.filter(x=>x.n).map(x=>betaMean(x.h,x.n));
  const stability=bandRates.length?Math.max(0,1-(Math.max(...bandRates)-Math.min(...bandRates))):0;
  let status='BLOCKED';
  if(n>=profile.activeN&&hits>=profile.activeHits&&posterior>=profile.activePost&&stability>=profile.activeStability)status='ACTIVE';
  else if(n>=profile.tieN&&hits>=profile.tieHits&&posterior>=profile.tiePost)status='TIE';
  const reliability=Math.max(0,posterior-.10)*Math.log1p(n)*(.55+.25*recent+.20*stability);
  return {hits,trials:n,posterior,recent,stability,status,reliability};
}
function buildFormulaModelProfile(transitions,latest,profile){
  const formulas=formulaLibrary(),byPosition=Array.from({length:4},()=>[]),score=Array.from({length:4},()=>Array(10).fill(0)),familyContrib=Array.from({length:4},()=>Array.from({length:10},()=>({})));
  for(let p=0;p<4;p++){
    formulas.forEach(f=>{const st=formulaStatsProfile(transitions,f,p,profile),digit=f.fn(latest.digits);const row={...f,...st,digit};byPosition[p].push(row);if(st.status==='BLOCKED')return;const mult=st.status==='ACTIVE'?1:profile.tieMult;const old=familyContrib[p][digit][f.family]||0;familyContrib[p][digit][f.family]=Math.max(old,st.reliability*mult);});
    for(let d=0;d<10;d++)score[p][d]=Object.values(familyContrib[p][d]).sort((a,b)=>b-a).slice(0,profile.familyTop).reduce((z,x,i)=>z+x*[1,.62,.38,.22,.12][i],0);
    byPosition[p].sort((a,b)=>(b.status==='ACTIVE')-(a.status==='ACTIVE')||b.reliability-a.reliability||b.hits-a.hits||a.id.localeCompare(b.id));
  }
  return {formulas,byPosition,score,familyContrib};
}
function addPositionRecurrenceProfile(model,transitions,profile){
  for(let p=0;p<4;p++){
    const counts=Array(10).fill(0);transitions.forEach((tr,i)=>counts[tr.target.digits[p]]+=.75+.5*(i+1)/transitions.length);
    const max=Math.max(1,...counts);for(let d=0;d<10;d++){const q=counts[d]/max;if(q>0)model.score[p][d]+=profile.recurrence*q;}
  }
}
function carryProfile(transitions,latest){
  const dist=Array(5).fill(0),role=Array(4).fill(0);transitions.forEach(tr=>{const t=new Set(tr.target.digits),overlap=unique(tr.source.digits).filter(d=>t.has(d)).length;dist[Math.min(4,overlap)]++;for(let p=0;p<4;p++)if(t.has(tr.source.digits[p]))role[p]++;});
  const n=Math.max(1,transitions.length),gt2=(dist[3]+dist[4])/n,cap=transitions.length>=5&&gt2<=.18?2:Math.min(4,Math.max(1,Math.ceil((dist.reduce((z,v,k)=>z+v*k,0)/n)+.75)));
  const digit=Array(10).fill(0);latest.digits.forEach((d,p)=>digit[d]=Math.max(digit[d],role[p]/n));return {dist,role:role.map(x=>x/n),digit,cap,expected:dist.reduce((z,v,k)=>z+v*k,0)/n};
}
function targetCoverage(transitions){const c=Array(10).fill(0);transitions.forEach((tr,i)=>unique(tr.target.digits).forEach(d=>c[d]+=.72+.48*(i+1)/transitions.length));return normalize(c);}
function positionRank(model){return model.score.map((arr,p)=>DIGITS.map(d=>({digit:d,score:arr[d],families:Object.keys(model.familyContrib[p][d]).length})).sort((a,b)=>b.score-a.score||b.families-a.families||a.digit-b.digit));}
function positionEcology(posRank,model){
  return posRank.map((r,p)=>{const top=r[0],second=r[1],top3=sum(r.slice(0,3).map(x=>x.score));const active=model.byPosition[p].filter(x=>x.status==='ACTIVE').length;const tie=model.byPosition[p].filter(x=>x.status==='TIE').length;return {top:top.digit,margin:top.score/Math.max(.0001,second.score),concentration:top3?top.score/top3:0,active,tie,coherence:clamp(.45*Math.min(1,active/4)+.30*Math.min(1,(top.score/Math.max(.0001,second.score)-1)/.6)+.25*(top3?top.score/top3:0))};});
}

function buildCorePrediction(inputRows,profile){
  const market=inputRows[0]?.code||'',rows=inputRows.filter(r=>!market||r.code===market),latest=rows[0],targetDay=inferTargetDay(rows),sameDay=transitionsFor(rows,latest.day,targetDay);
  const fallback=sameDay.length<5; let training=fallback?rows.slice().reverse().slice(0,-1).map((r,i,a)=>i<a.length-1?{source:r,target:a[i+1]}:null).filter(Boolean):sameDay;
  if(!fallback&&profile.window<99)training=training.slice(-profile.window);
  const model=buildFormulaModelProfile(training,latest,profile); addPositionRecurrenceProfile(model,training,profile);
  const posRank=positionRank(model),ecology=positionEcology(posRank,model),coverage=targetCoverage(training),carry=carryProfile(training,latest),posNorm=model.score.map(normalize),baselineMode=profile.id==='formula-first';
  const rawWeights=baselineMode?[1,1,1,1]:ecology.map(x=>.55+.75*x.coherence),weightSum=sum(rawWeights)||1,posWeights=rawWeights.map(x=>x/weightSum);
  const overall=Array(10).fill(0),breadth=Array(10).fill(0);
  for(let d=0;d<10;d++){
    const posEvidence=posNorm.reduce((z,a,p)=>z+a[d]*posWeights[p],0);
    breadth[d]=model.familyContrib.reduce((z,p)=>z+Object.keys(p[d]).length,0);
    overall[d]=baselineMode?(.72*posEvidence+.16*coverage[d]+.08*Math.min(1,breadth[d]/6)+.04*carry.digit[d]):(.76*posEvidence+.14*coverage[d]+.06*Math.min(1,breadth[d]/6)+.04*carry.digit[d]);
  }
  const overallRank=DIGITS.slice().sort((a,b)=>overall[b]-overall[a]||breadth[b]-breadth[a]||a-b),selected=[],protectedSet=new Set();
  posRank.forEach((r,p)=>{const top=r[0],second=r[1],margin=top.score/Math.max(.0001,second.score),activeFamilies=Object.keys(model.familyContrib[p][top.digit]).length;const protect=baselineMode?(top.score>0&&(activeFamilies>=2||margin>=1.22)):(top.score>0&&(ecology[p].active>=1||ecology[p].margin>=1.26||ecology[p].coherence>=.58));if(protect){if(!selected.includes(top.digit))selected.push(top.digit);protectedSet.add(top.digit);}});
  overallRank.forEach(d=>{if(selected.length<6&&!selected.includes(d))selected.push(d);});
  const latestSet=new Set(unique(latest.digits));
  while(selected.filter(d=>latestSet.has(d)).length>carry.cap){const victim=selected.filter(d=>latestSet.has(d)&&!protectedSet.has(d)).sort((a,b)=>overall[a]-overall[b])[0];if(victim==null)break;const incoming=overallRank.find(d=>!selected.includes(d)&&!latestSet.has(d));if(incoming==null)break;selected[selected.indexOf(victim)]=incoming;}
  const finalDigits=selected.slice(0,6),strongFive=finalDigits.slice().sort((a,b)=>overall[b]-overall[a]||a-b).slice(0,5),ak=buildPairs(posRank[0],posRank[1]),le=buildPairs(posRank[2],posRank[3]);
  const twin=chooseTwin(training,posRank,model,latest),secondary=buildOrthogonalSecondary(model,overall,strongFive,finalDigits),signal=signalGrade(model,training,posRank,ecology);
  return {rows,market,latest,targetDay,transitions:training,sameDayTransitions:sameDay,sameDaySamples:sameDay.length,fallback,model,posRank,ecology,coverage,carry,overall,overallRank,finalDigits,strongFive,ak,le,twin,secondary,signal,profile,activeFormulas:model.byPosition.flat().filter(x=>x.status==='ACTIVE'),tieFormulas:model.byPosition.flat().filter(x=>x.status==='TIE')};
}
function profileBacktest(rows,profile,sourceDay,targetDay){
  const chrono=rows.slice().reverse(),tests=[];
  for(let i=10;i<chrono.length-1;i++){
    if(chrono[i].day!==sourceDay||chrono[i+1].day!==targetDay)continue;
    const hist=chrono.slice(0,i+1).reverse();if(transitionsFor(hist,sourceDay,targetDay).length<3)continue;
    const pred=buildCorePrediction(hist,profile);if(pred.targetDay!==targetDay)continue;
    const actual=chrono[i+1].digits,actualSet=new Set(actual),u=actualSet.size,hit6=pred.finalDigits.filter(d=>actualSet.has(d)).length,hit5=pred.strongFive.filter(d=>actualSet.has(d)).length,pos=pred.posRank.reduce((z,r,p)=>z+(r[0].digit===actual[p]?1:0),0);
    tests.push({hit6,hit5,pos,u});
  }
  const prior=.66,priorWeight=2;if(!tests.length)return {profile,score:prior,tests:0,recall6:0,recall5:0,position:0};
  let weighted=0,wsum=0,r6=0,r5=0,pp=0;
  tests.forEach((t,i)=>{const w=.75+.5*(i+1)/tests.length;const metric=.72*(t.hit6/t.u)+.20*(t.hit5/t.u)+.08*(t.pos/4);weighted+=w*metric;wsum+=w;r6+=t.hit6/t.u;r5+=t.hit5/t.u;pp+=t.pos/4;});
  return {profile,score:(weighted+prior*priorWeight)/(wsum+priorWeight),tests:tests.length,recall6:r6/tests.length,recall5:r5/tests.length,position:pp/tests.length};
}
function selectLocalProfile(rows,targetDay){
  const sourceDay=rows[0].day,results=LOCAL_PROFILES.map(p=>profileBacktest(rows,p,sourceDay,targetDay)).sort((a,b)=>b.score-a.score||b.tests-a.tests||a.profile.id.localeCompare(b.profile.id));
  const baseline=results.find(x=>x.profile.id==='formula-first')||results[0],best=results[0];
  const margin=best.score-baseline.score;
  const positionFloor=Math.max(.10,baseline.position-.020);
  const positionIntegrity=best.position>=positionFloor;
  const shortWindowIntegrity=best.profile.window>=5||(best.tests>=8&&best.position>=.12&&best.recall5>=baseline.recall5+.05);
  const decisive=best.profile.id!==baseline.profile.id&&best.tests>=5&&margin>=.080&&positionIntegrity&&shortWindowIntegrity;
  const rejected=best.profile.id!==baseline.profile.id&&!decisive;
  return {selected:decisive?best.profile:baseline.profile,results,best,baseline,decisive,rejected,margin,positionFloor,positionIntegrity,shortWindowIntegrity};
}
function weakPositionReserve(core,excluded){
  const candidates=excluded.map(d=>{let appearances=0,score=0;
    core.posRank.forEach((r,p)=>{const idx=r.findIndex(x=>x.digit===d);if(idx>=0&&idx<6){appearances++;const top=Math.max(.0001,r[0].score);score+=(6-idx)/6*(r[idx].score/top);}});
    return {digit:d,appearances,score:appearances*.65+score};
  });
  return candidates.sort((a,b)=>b.appearances-a.appearances||b.score-a.score||a.digit-b.digit)[0]||null;
}
function buildDivergenceReserve(core,profileRuns,profileSelection){
  const excluded=DIGITS.filter(d=>!core.finalDigits.includes(d)),votes=Array(10).fill(0);
  profileRuns.forEach(run=>{const bt=profileSelection.results.find(x=>x.profile.id===run.profile.id);const w=bt?.score||.5;run.finalDigits.forEach(d=>{if(excluded.includes(d))votes[d]+=w;});run.strongFive.forEach(d=>{if(excluded.includes(d))votes[d]+=.35*w;});});
  const orthogonalList=core.secondary.digits.filter(d=>excluded.includes(d));
  const orthogonal=orthogonalList[0];
  const weak=weakPositionReserve(core,excluded.filter(d=>d!==orthogonal));
  const voted=excluded.slice().sort((a,b)=>votes[b]-votes[a]||a-b)[0];
  const digits=[];
  const reserveOrder=core.signal.label==='RENDAH'?[orthogonalList[0],orthogonalList[1],weak?.digit,voted]:[orthogonal,weak?.digit,orthogonalList[1],voted];
  reserveOrder.forEach(d=>{if(Number.isInteger(d)&&!digits.includes(d)&&digits.length<2)digits.push(d);});
  excluded.sort((a,b)=>votes[b]-votes[a]||a-b).forEach(d=>{if(digits.length<2&&!digits.includes(d))digits.push(d);});
  const sets=profileRuns.map(r=>new Set(r.finalDigits));let jac=[];for(let i=0;i<sets.length;i++)for(let j=i+1;j<sets.length;j++){const inter=[...sets[i]].filter(x=>sets[j].has(x)).length,uni=new Set([...sets[i],...sets[j]]).size;jac.push(inter/uni);}
  return {digits,orthogonal,weak:weak?.digit??null,voted,agreement:jac.length?mean(jac):1,active:core.signal.label==='RENDAH'||(jac.length?mean(jac)<.72:false)};
}
function profileAgreement(profileRuns){
  const sets=profileRuns.map(r=>new Set(r.finalDigits)),jac=[];
  for(let i=0;i<sets.length;i++)for(let j=i+1;j<sets.length;j++){
    const inter=[...sets[i]].filter(x=>sets[j].has(x)).length,uni=new Set([...sets[i],...sets[j]]).size;jac.push(inter/Math.max(1,uni));
  }
  return jac.length?mean(jac):1;
}
function buildBalancedEcologyPortfolio(profileRuns,selection){
  const weights={};selection.results.forEach(x=>weights[x.profile.id]=x.score);
  const consensus=Array(10).fill(0),positionVotes=Array(10).fill(0),familyVotes=Array(10).fill(0);
  profileRuns.forEach(run=>{
    const w=weights[run.profile.id]||.5,max=Math.max(.0001,...run.overall);
    for(let d=0;d<10;d++)consensus[d]+=w*(run.overall[d]/max);
    run.posRank.forEach(r=>r.slice(0,4).forEach((x,i)=>positionVotes[x.digit]+=w*(4-i)/4));
    run.model.byPosition.forEach(rows=>rows.filter(x=>x.status==='ACTIVE').forEach(x=>familyVotes[x.digit]+=w*x.reliability));
  });
  const formulaRank=DIGITS.slice().sort((a,b)=>consensus[b]-consensus[a]||positionVotes[b]-positionVotes[a]||familyVotes[b]-familyVotes[a]||a-b);
  const baseline=profileRuns.find(x=>x.profile.id==='formula-first')||profileRuns[0],coverage=baseline.coverage;
  const formulaCore=formulaRank.slice(0,3),coverageAnchors=DIGITS.filter(d=>!formulaCore.includes(d)).sort((a,b)=>coverage[b]-coverage[a]||consensus[b]-consensus[a]||a-b).slice(0,3);
  const digits=[...formulaCore,...coverageAnchors];
  const combined=Array(10).fill(0);DIGITS.forEach(d=>combined[d]=.68*consensus[d]/Math.max(.0001,...consensus)+.32*coverage[d]);
  const strong=digits.slice().sort((a,b)=>combined[b]-combined[a]||a-b).slice(0,5);
  return {digits,strong,formulaCore,coverageAnchors,formulaRank,consensus,positionVotes,familyVotes,coverage,combined};
}
function buildPrediction(inputRows){
  const market=inputRows[0]?.code||'',rows=inputRows.filter(r=>!market||r.code===market),targetDay=inferTargetDay(rows),selection=selectLocalProfile(rows,targetDay),profileRuns=LOCAL_PROFILES.map(p=>buildCorePrediction(rows,p));
  const selectedCore=profileRuns.find(r=>r.profile.id===selection.selected.id)||profileRuns[0],agreement=profileAgreement(profileRuns),balanced=buildBalancedEcologyPortfolio(profileRuns,selection);
  const bestPositionWeak=selection.best.position<.12,conflict=agreement<.70;
  const balancedActive=conflict&&(selection.rejected||bestPositionWeak||selectedCore.profile.window<5||agreement<.70);
  const twinVotes={};profileRuns.forEach(run=>{if(run.twin){const k=`${run.twin.digit}|${run.twin.shape}`;twinVotes[k]=(twinVotes[k]||0)+1;}});
  const agreedTwin=Object.entries(twinVotes).sort((a,b)=>b[1]-a[1])[0];
  const votedTwin=agreedTwin?profileRuns.map(run=>run.twin).find(x=>x&&`${x.digit}|${x.shape}`===agreedTwin[0]):null;
  const twin=balancedActive?(agreedTwin&&agreedTwin[1]>=3?{...votedTwin,profileVotes:agreedTwin[1]}:null):selectedCore.twin;
  const core=balancedActive?{...selectedCore,finalDigits:balanced.digits,strongFive:balanced.strong,twin}:selectedCore;
  const twinReserve=chooseStructuralTwinReserve(core.transitions,core.model,core.strongFive,core.overall,core.twin);
  const reserve=buildDivergenceReserve(core,profileRuns,selection);
  const ecologyMode=balancedActive?'BALANCED':'PROFILE';
  const signalPenalty=balancedActive ? .18 : 0;
  const signal={...core.signal,value:Math.max(0,core.signal.value-signalPenalty)};
  signal.label=signal.value>=.70?'MENENGAH':signal.value>=.52?'RENDAH–MENENGAH':'RENDAH';
  const twinPortfolio=buildTwinPortfolio({...core,signal,profileAgreement:agreement,balancedActive},profileRuns,selection,twinReserve);
  return {...core,twinReserve,twinPortfolio,signal,profileSelection:selection,profileRuns,divergenceReserve:reserve,profileAgreement:agreement,balancedPortfolio:balanced,balancedActive,ecologyMode};
}
function buildPairs(left,right){
  const out=[];left.slice(0,3).forEach((a,ia)=>right.slice(0,3).forEach((b,ib)=>out.push({pair:`${a.digit}${b.digit}`,score:a.score+b.score-.08*(ia+ib)})));
  const seen=new Set();return out.sort((a,b)=>b.score-a.score||a.pair.localeCompare(b.pair)).filter(x=>{if(seen.has(x.pair))return false;seen.add(x.pair);return true;}).slice(0,5);
}
function chooseTwin(transitions,posRank,model,latest){
  const candidates=[];
  TWIN_SHAPES.forEach(([p,q,label])=>{
    const same=transitions.filter(tr=>tr.target.digits[p]===tr.target.digits[q]),rate=same.length/Math.max(1,transitions.length);if(same.length<2||rate<.22)return;
    const topP=new Set(posRank[p].slice(0,2).map(x=>x.digit)),topQ=new Set(posRank[q].slice(0,2).map(x=>x.digit));
    DIGITS.forEach(d=>{if(!topP.has(d)||!topQ.has(d))return;const digitHits=same.filter(tr=>tr.target.digits[p]===d).length;const families=Object.keys(model.familyContrib[p][d]).length+Object.keys(model.familyContrib[q][d]).length;if(digitHits<1||families<3)return;const score=rate+.15*digitHits+.04*families;candidates.push({digit:d,shape:label,score,rate,occurrences:same.length,digitHits});});
  });
  candidates.sort((a,b)=>b.score-a.score||b.digitHits-a.digitHits||a.digit-b.digit);return candidates[0]||null;
}

function chooseStructuralTwinReserve(transitions,model,strongFive,overall,strictTwin){
  const n=transitions.length;
  const repeatEvents=transitions.filter(tr=>new Set(tr.target.digits).size<4);
  const repeatRate=repeatEvents.length/Math.max(1,n);
  if(n<6||repeatEvents.length<4||repeatRate<.40)return null;
  const ranked=strongFive.map((digit,rank)=>{
    let active=0,activePositions=0;const activeFamilies=new Set();
    for(let p=0;p<4;p++){
      let positionActive=0;
      model.byPosition[p].forEach(f=>{
        if(f.digit!==digit||f.status!=='ACTIVE')return;
        active++;positionActive++;activeFamilies.add(`${p}|${f.family}`);
      });
      if(positionActive)activePositions++;
    }
    const score=active+0.80*activePositions+0.35*activeFamilies.size+1.25*(overall[digit]||0)+0.08*(5-rank);
    return {digit,score,active,activePositions,families:activeFamilies.size};
  }).sort((a,b)=>b.score-a.score||b.active-a.active||b.activePositions-a.activePositions||a.digit-b.digit);
  const leader=ranked[0],runner=ranked[1];
  if(!leader||leader.active<5||leader.activePositions<3||leader.families<4)return null;
  if(runner&&leader.active-runner.active<2)return null;
  if(strictTwin&&strictTwin.digit===leader.digit)return null;
  return {...leader,repeatRate,repeatEvents:repeatEvents.length,label:'Structural breadth reserve'};
}

function buildTwinPortfolio(core,profileRuns,profileSelection,twinReserve){
  const runs=profileRuns?.length?profileRuns:[core],weightByProfile={};
  (profileSelection?.results||[]).forEach(x=>weightByProfile[x.profile.id]=Math.max(.05,x.score));
  const history=core.sameDayTransitions||[],n=history.length,repeatFlags=history.map(tr=>new Set(tr.target.digits).size<4),repeatEvents=sum(repeatFlags),repeatRate=repeatEvents/Math.max(1,n);
  const shapeHistory=TWIN_SHAPES.map(([p,q,label])=>{
    const same=history.filter(tr=>tr.target.digits[p]===tr.target.digits[q]),digitHits=Array(10).fill(0);
    same.forEach(tr=>digitHits[tr.target.digits[p]]++);
    return {p,q,label,events:same.length,rate:same.length/Math.max(1,n),posterior:(same.length+1)/(n+4),digitHits};
  });
  const candidates=DIGITS.map(digit=>{
    const positionEvidence=Array(4).fill(0);let overallEvidence=0,familyEvidence=0,profileSupport=0,weightSum=0,supportingProfiles=0;
    runs.forEach(run=>{
      const w=weightByProfile[run.profile.id]||.5;weightSum+=w;
      const localPosition=run.model.score.map(a=>(a[digit]||0)/Math.max(.0001,...a));
      localPosition.forEach((x,p)=>positionEvidence[p]+=w*x);
      overallEvidence+=w*((run.overall[digit]||0)/Math.max(.0001,...run.overall));
      const familyBreadth=run.model.familyContrib.reduce((z,p)=>z+Object.keys(p[digit]).length,0);
      familyEvidence+=w*Math.min(1,familyBreadth/12);
      const supported=localPosition.filter(x=>x>=.55).length>=2||run.posRank.filter(r=>r.slice(0,3).some(x=>x.digit===digit)).length>=2;
      if(supported){profileSupport+=w;supportingProfiles++;}
    });
    for(let p=0;p<4;p++)positionEvidence[p]/=Math.max(.0001,weightSum);
    overallEvidence/=Math.max(.0001,weightSum);familyEvidence/=Math.max(.0001,weightSum);profileSupport/=Math.max(.0001,weightSum);
    const shapes=shapeHistory.map(sh=>{
      const pairFormula=Math.sqrt(positionEvidence[sh.p]*positionEvidence[sh.q]);
      const digitPrior=sh.events?(sh.digitHits[digit]+.5)/(sh.events+5):0;
      const historyContext=.68*sh.posterior+.32*digitPrior;
      const score=.64*pairFormula+.16*overallEvidence+.10*familyEvidence+.06*profileSupport+.04*historyContext;
      return {...sh,pairFormula,historyContext,score};
    }).sort((a,b)=>b.score-a.score||b.pairFormula-a.pairFormula||a.label.localeCompare(b.label));
    const bestShape=shapes[0],strictMatch=core.twin?.digit===digit,structuralMatch=twinReserve?.digit===digit;
    const auditBonus=(strictMatch ? .012 : 0)+(structuralMatch ? .006 : 0);
    return {digit,score:bestShape.score+auditBonus,formulaIndex:bestShape.pairFormula,overallEvidence,familyEvidence,profileSupport,supportingProfiles,bestShape,strictMatch,structuralMatch};
  }).sort((a,b)=>b.score-a.score||b.formulaIndex-a.formulaIndex||b.profileSupport-a.profileSupport||a.digit-b.digit);
  const pool=candidates.slice(0,4),choices=pool.slice(0,2).map((x,i)=>({...x,pair:`${x.digit}${x.digit}`,choice:i+1}));
  const formulaStrength=mean(choices.map(x=>x.formulaIndex)),repeatPosterior=(repeatEvents+2)/(n+5),wilsonLow=wilsonLower(repeatEvents,n);
  const recencyWeights=repeatFlags.map((_,i)=>.65+.70*(i+1)/Math.max(1,n)),recentRate=sum(repeatFlags.map((x,i)=>x*recencyWeights[i]))/Math.max(.0001,sum(recencyWeights));
  const recentFlags=repeatFlags.slice(-Math.min(3,n)),recentWindowRate=mean(recentFlags);let dryStreak=0;
  for(let i=repeatFlags.length-1;i>=0&&!repeatFlags[i];i--)dryStreak++;
  const agreement=core.profileAgreement??1,signalValue=core.signal?.value||0,strictEvidence=Boolean(core.twin||twinReserve);
  const candidateShapeEvidence=choices.some(x=>x.strictMatch||x.structuralMatch||(x.bestShape.events>=2&&x.bestShape.digitHits[x.digit]>=1));
  const integrityStrong=!core.balancedActive&&signalValue>=.58&&agreement>=.68;
  const occurrenceStrong=n>=7&&repeatRate>=.65&&repeatPosterior>=.58&&wilsonLow>=.35&&recentRate>=.60&&recentWindowRate>=.50&&dryStreak<2;
  const occurrenceOptional=n>=6&&repeatPosterior>=.45&&wilsonLow>=.20&&recentRate>=.45&&recentWindowRate>=.34&&dryStreak<2;
  const state=integrityStrong&&occurrenceStrong&&strictEvidence&&candidateShapeEvidence?'DUKUNGAN KUAT':(!core.balancedActive&&signalValue>=.52&&agreement>=.60&&occurrenceOptional&&strictEvidence&&candidateShapeEvidence?'OPSIONAL':'ABSTAIN');
  const reasons=[];
  if(n<7)reasons.push('sampel target-day terbatas');
  if(dryStreak>=2)reasons.push(`${dryStreak} target terbaru non-repeat`);
  if(signalValue<.52)reasons.push('sinyal formula rendah');
  if(agreement<.60||core.balancedActive)reasons.push('profil berkonflik');
  if(!strictEvidence)reasons.push('strict dan structural gate kosong');
  if(!candidateShapeEvidence)reasons.push('kandidat belum punya dukungan bentuk yang cukup');
  const context=state==='DUKUNGAN KUAT'?'Occurrence gate dan kandidat formula sama-sama terkonfirmasi':state==='OPSIONAL'?'Repeat boleh dibaca sebagai opsi bersyarat':`Tidak ada panggilan repeat${reasons.length?` • ${reasons.join(' • ')}`:''}`;
  return {pool,choices,digits:pool.map(x=>x.digit),candidates,repeatEvents,repeatRate,repeatPosterior,wilsonLow,recentRate,recentWindowRate,dryStreak,formulaStrength,state,context,reasons,samples:n,targetDayOnly:true,strictEvidence,candidateShapeEvidence,agreement,signalValue};
}
function buildOrthogonalSecondary(model,overall,strongFive,finalDigits){
  const primary=new Set(strongFive),scores=Array(10).fill(0),reasons=Array.from({length:10},()=>[]);
  for(let p=0;p<4;p++)for(let d=0;d<10;d++){
    const fam=Object.entries(model.familyContrib[p][d]).sort((a,b)=>b[1]-a[1]);
    const secondary=fam.slice(1,4).reduce((z,x)=>z+x[1],0);scores[d]+=secondary;if(secondary>0)reasons[d].push(`${POS[p]} formula runner-up`);
  }
  DIGITS.forEach(d=>{scores[d]+=.18*(1-overall[d]);if(finalDigits.includes(d))scores[d]+=.05;});
  const rank=DIGITS.slice().sort((a,b)=>scores[b]-scores[a]||a-b),selected=[];
  rank.forEach(d=>{if(selected.length>=5)return;const overlaps=selected.filter(x=>primary.has(x)).length;if(primary.has(d)&&overlaps>=2)return;selected.push(d);});
  return {digits:selected,rank:rank.map(d=>({digit:d,score:scores[d],reasons:reasons[d]}))};
}
function signalGrade(model,transitions,posRank,ecology){
  const active=model.byPosition.map(a=>a.filter(x=>x.status==='ACTIVE').length),topMargins=posRank.map(r=>r[0].score/Math.max(.0001,r[1].score)),eco=mean((ecology||[]).map(x=>x.coherence));
  const value=.34*Math.min(1,sum(active)/20)+.26*Math.min(1,mean(topMargins)/1.6)+.22*Math.min(1,transitions.length/10)+.18*eco;
  return {value,label:value>=.70?'MENENGAH':value>=.52?'RENDAH–MENENGAH':'RENDAH',active,topMargins,ecology:eco};
}

function digitCards(digits,cls=''){return `<div class="digits compact">${digits.map(d=>`<div class="digit ${cls}"><b>${d}</b></div>`).join('')}</div>`;}
function pairCards(items,cls){return `<div class="pair-grid">${items.map(x=>`<div class="pair-card ${cls}"><b>${x.pair}</b></div>`).join('')}</div>`;}
function twinChoiceCards(items){return `<div class="twin-choice-grid">${items.map(x=>`<div class="twin-choice"><small>Pilihan bersyarat ${x.choice} • posisi formula ${x.bestShape.label}</small><b>${x.pair}</b><span>Indeks kandidat ${Math.round(100*x.formulaIndex)}/100 • dukungan ${x.supportingProfiles}/${LOCAL_PROFILES.length} profil</span></div>`).join('')}</div>`;}
function renderResult(r){
  const topFormula=p=>r.model.byPosition[p].filter(x=>x.status!=='BLOCKED').slice(0,5).map(x=>`${x.label}→${x.digit} (${x.hits}/${x.trials}, ${x.status})`).join('<br>')||'Tidak ada formula lolos';
  const twinText=r.twin?`${r.twin.digit}${r.twin.digit} • ${r.twin.shape}`:'Tidak ada kembar utama yang lolos gate';
  const twinReserveText=r.twinReserve?`${r.twinReserve.digit}${r.twinReserve.digit}`:'Tidak ada kembar struktural';
  const low=r.signal.label==='RENDAH';
  const ps=r.profileSelection,scoreRows=ps.results.map(x=>`<span class="profile-chip ${x.profile.id===r.profile.id?'chosen':''}">${x.profile.label}: ${(100*x.score).toFixed(1)}% • posisi ${(100*x.position).toFixed(1)}% • ${x.tests} tes</span>`).join('');
  const reserveText=r.divergenceReserve.digits.join(' '),reserveState=r.divergenceReserve.active?'AKTIF':'AUDIT';
  $('output').className='result';
  $('output').innerHTML=`
    <div class="result-hero">
      <span class="mini-title">${r.balancedActive?'Balanced Formula-Coverage':'Formula Murni'} • ${r.signal.label}</span>
      <h3>6 Digit Formula</h3>${digitCards(r.finalDigits)}
      <div class="five-strong-box"><small>5 Digit Terkuat</small>${digitCards(r.strongFive,'strong-five')}</div>
      <div class="twin-portfolio ${r.twinPortfolio.state==='ABSTAIN'?'is-abstain':(r.twinPortfolio.state==='OPSIONAL'?'is-optional':'is-strong')}">
        <div class="twin-portfolio-head"><div><small>Twin Occurrence Gate • ${r.twinPortfolio.state}</small><b>4 Digit Twin Pool</b></div><span>${r.twinPortfolio.state}</span></div>
        ${digitCards(r.twinPortfolio.digits,'twin-pool-digit')}
        <div class="twin-choice-title">2 Pilihan Kembar Bersyarat</div>${twinChoiceCards(r.twinPortfolio.choices)}
        <p><b>${r.twinPortfolio.context}.</b> Twin Pool terpisah dari keputusan occurrence: ranking memakai formula, posisi, konsensus profil, dan coverage; prior bentuk kembar maksimum 4%. Saat gate ABSTAIN, kedua pasangan hanya bahan audit dan bukan panggilan kembar.</p>
        <div class="twin-gate-metrics"><span>Target-day ${r.twinPortfolio.samples}</span><span>Repeat ${(100*r.twinPortfolio.repeatRate).toFixed(0)}%</span><span>Recent ${(100*r.twinPortfolio.recentRate).toFixed(0)}%</span><span>Wilson low ${(100*r.twinPortfolio.wilsonLow).toFixed(0)}%</span><span>Sinyal ${(100*r.twinPortfolio.signalValue).toFixed(0)}%</span><span>Profil ${(100*r.twinPortfolio.agreement).toFixed(0)}%</span></div>
        <div class="twin-audit"><span>Strict replay: ${twinText}</span><span>Structural reserve: ${twinReserveText}</span></div>
      </div>
      <p class="tagline">${r.balancedActive?'Profil lokal berkonflik: enam digit dibentuk sekali dari 3 konsensus formula lintas-horizon + 3 anchor coverage target-day; tidak ada rescue setelah ranking. Twin Portfolio membaca semua profil sebelum output.':(low?'Sinyal formula rendah: hasil dibaca sebagai audit; reserve dan pilihan kembar tidak memaksa swap atau repeat.':'Hasil dibentuk dari profil lokal yang lolos walk-forward tanpa kondisi nama market.')}</p>
    </div>
    <div class="ecology-card"><div class="backup-head"><div><small>Local Formula Ecology</small><b>${r.balancedActive?'Balanced Formula-Coverage':r.profile.label}</b></div><span class="backup-risk">${r.balancedActive?'Konflik horizon':(ps.decisive?'Lolos integrity gate':'Baseline dipertahankan')}</span></div><div class="profile-chips">${scoreRows}</div><p>${r.balancedActive?`Formula core ${r.balancedPortfolio.formulaCore.join(' ')} • coverage anchor ${r.balancedPortfolio.coverageAnchors.join(' ')} • kesepakatan profil ${(100*r.profileAgreement).toFixed(0)}%.`:`Profil berubah hanya bila unggul, akurasi posisi tidak runtuh, dan short-window mempunyai sampel cukup. Margin best ${(100*ps.margin).toFixed(1)} poin.`}</p></div>
    <div class="reserve-card"><div><small>2 Digit Divergence Reserve • ${reserveState}</small><b>${reserveText||'—'}</b></div><p>Satu digit berasal dari keluarga ortogonal dan satu dari konsensus posisi lemah lintas profil. Reserve tidak mengubah 6D, AK, LE, carry cap, atau kembar.</p><div class="recovery-stats"><span>Kesepakatan profil ${(100*r.divergenceReserve.agreement).toFixed(0)}%</span><span>Ortogonal ${r.divergenceReserve.orthogonal??'-'}</span><span>Weak-position ${r.divergenceReserve.weak??'-'}</span></div></div>
    <div class="backup-card"><div class="backup-head"><div><small>Formula Cadangan Ortogonal</small><b>5 Digit Sekunder</b></div><span class="backup-risk">Bukan recovery paksa</span></div>${digitCards(r.secondary.digits,'backup-digit')}<p>Runner-up keluarga formula; tidak dilatih memakai aktual dan tidak menjanjikan minimal tiga digit.</p></div>
    <div class="stats">
      <div class="stat"><small>Market</small><b>${r.market||'-'}</b></div><div class="stat"><small>Data</small><b>${r.rows.length}</b></div>
      <div class="stat"><small>Latest</small><b>${r.latest.digits.join('')}</b></div><div class="stat"><small>Target</small><b>${r.targetDay}</b></div>
      <div class="stat"><small>Replay hari</small><b>${r.sameDaySamples}</b></div><div class="stat"><small>Carry cap</small><b>${r.carry.cap}</b></div>
    </div>
    <div class="akle-section"><h4>AKLE Position-First</h4><div class="akle-grid"><div><small>5 Pilihan AK</small>${pairCards(r.ak,'ak')}</div><div><small>5 Pilihan LE</small>${pairCards(r.le,'le')}</div></div></div>
    <div class="audit-columns">
      <div><b>Gate formula</b><p class="tagline">ACTIVE ${r.activeFormulas.length} • TIE ${r.tieFormulas.length} • ${r.fallback?'fallback global':'same-day replay'} • ecology ${(100*r.signal.ecology).toFixed(0)}%</p></div>
      <div><b>Posisi A</b><p class="tagline">${topFormula(0)}</p></div><div><b>Posisi K</b><p class="tagline">${topFormula(1)}</p></div>
      <div><b>Posisi L</b><p class="tagline">${topFormula(2)}</p></div><div><b>Posisi E</b><p class="tagline">${topFormula(3)}</p></div>
      <div><b>Carry audit</b><p class="tagline">Expected ${r.carry.expected.toFixed(2)} • cap maksimum ${r.carry.cap} • role ${r.carry.role.map((x,i)=>`${POS[i]} ${(100*x).toFixed(0)}%`).join(' | ')}</p></div>
      <div><b>Integrity gate</b><p class="tagline">Best ${ps.best.profile.label}: posisi ${(100*ps.best.position).toFixed(1)}% • floor ${(100*ps.positionFloor).toFixed(1)}% • ${ps.positionIntegrity?'position OK':'position gagal'} • ${ps.shortWindowIntegrity?'window OK':'window terlalu rapuh'}.</p></div><div><b>Anti-overfit</b><p class="tagline">Tidak ada kondisi nama market, digit aktual, atau rescue pasca-ranking. Balanced mode adalah satu portfolio pra-output dari konsensus formula dan coverage historis.</p></div>
    </div>`;
}

if(typeof module!=='undefined'&&module.exports)module.exports={parseRows,buildPrediction,buildCorePrediction,selectLocalProfile,buildBalancedEcologyPortfolio,buildTwinPortfolio,renderResult,inferTargetDay,transitionsFor,formulaLibrary,LOCAL_PROFILES};
