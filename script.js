'use strict';

const APP_VERSION = 'IPHOEL Formula Engine V13.24 • Replay-Independent Target-Carry Twin Recovery';
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
  $('modelPill').textContent='Replay-Routed Formula Ladder';
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
  const stages=['Normalisasi satu market','Membalik riwayat tertua → terbaru','Membangun transisi hari market','Replay jalur posisi vs keluarga independen','Menyusun tangga formula 6D → 5D → 4D','Mengambil kembar hanya dari 4D inti'];
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
function pairBalanceFormulaLibrary(){
  const out=[];
  [[[0,1],[2,3]],[[0,2],[1,3]],[[0,3],[1,2]]].forEach(([left,right])=>{
    const name=`${POS[left[0]]}${POS[left[1]]}-${POS[right[0]]}${POS[right[1]]}`;
    out.push({id:`balance_${left.join('')}_${right.join('')}`,label:name,fn:s=>mod10(s[left[0]]+s[left[1]]-s[right[0]]-s[right[1]])});
    out.push({id:`balance_${right.join('')}_${left.join('')}`,label:`reverse ${name}`,fn:s=>mod10(s[right[0]]+s[right[1]]-s[left[0]]-s[left[1]])});
  });
  return out;
}

const LOCAL_PROFILES = [
  {id:'formula-first',label:'Formula-First Baseline',window:99,activeN:7,activeHits:3,tieN:5,tieHits:2,tieMult:.36,familyTop:5},
  {id:'strict-full',label:'Full-Depth Ketat',window:99,activeN:7,activeHits:3,tieN:5,tieHits:2,tieMult:.20,familyTop:4},
  {id:'recent-local',label:'Recent Local 4',window:4,activeN:4,activeHits:2,tieN:3,tieHits:2,tieMult:.22,familyTop:3},
  {id:'relation-depth',label:'Full-Depth Relation',window:99,activeN:6,activeHits:3,tieN:5,tieHits:2,tieMult:.30,familyTop:4}
];

function betaMean(h,n,priorHit=1,priorMiss=4){ return (h+priorHit)/(n+priorHit+priorMiss); }
function formulaStatsProfile(transitions,formula,p,profile){
  let hits=0,recentHits=0; const n=transitions.length,cut=Math.floor(n/2),bands=[{h:0,n:0},{h:0,n:0},{h:0,n:0}];
  transitions.forEach((tr,i)=>{const ok=formula.fn(tr.source.digits)===tr.target.digits[p];if(ok)hits++;if(i>=cut&&ok)recentHits++;const b=Math.min(2,Math.floor(3*i/Math.max(1,n)));bands[b].n++;if(ok)bands[b].h++;});
  const observedBands=bands.filter(x=>x.n).length,hitBands=bands.filter(x=>x.h>0).length,spreadFloor=Math.min(2,observedBands);
  let status='BLOCKED';
  if(n>=profile.activeN&&hits>=profile.activeHits&&recentHits>=1&&hitBands>=spreadFloor)status='ACTIVE';
  else if(n>=profile.tieN&&hits>=profile.tieHits&&(recentHits>=1||hitBands>=spreadFloor))status='TIE';
  const reliability=5*hits+3*recentHits+2*hitBands+(status==='ACTIVE'?4:(status==='TIE'?1:0));
  return {hits,trials:n,recentHits,hitBands,status,reliability};
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
  const model=buildFormulaModelProfile(training,latest,profile);
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
function buildFormulaRelationRun(inputRows,profile){
  const market=inputRows[0]?.code||'',rows=inputRows.filter(r=>!market||r.code===market),latest=rows[0],targetDay=inferTargetDay(rows),sameDay=transitionsFor(rows,latest.day,targetDay);
  const fallback=sameDay.length<5;let training=fallback?rows.slice().reverse().slice(0,-1).map((r,i,a)=>i<a.length-1?{source:r,target:a[i+1]}:null).filter(Boolean):sameDay;
  if(!fallback&&profile.window<99)training=training.slice(-profile.window);
  const model=buildFormulaModelProfile(training,latest,profile),posRank=positionRank(model);
  return {rows,market,latest,targetDay,transitions:training,sameDayTransitions:sameDay,sameDaySamples:sameDay.length,fallback,model,posRank,profile,activeFormulas:model.byPosition.flat().filter(x=>x.status==='ACTIVE'),tieFormulas:model.byPosition.flat().filter(x=>x.status==='TIE')};
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

function compareFormulaEvidence(a,b){
  return b.activeProfiles-a.activeProfiles||b.activePositions-a.activePositions||b.activeFamilies-a.activeFamilies||b.topThreePlacements-a.topThreePlacements||b.activeRules-a.activeRules||b.rankPoints-a.rankPoints||b.tieFamilies-a.tieFamilies||a.digit-b.digit;
}
function comparePositionEvidence(a,b){
  return b.strength-a.strength||b.activeFamilies-a.activeFamilies||b.activeRules-a.activeRules||b.activeProfiles-a.activeProfiles||b.rankPoints-a.rankPoints||a.digit-b.digit;
}
function buildPositionFormulaLedger(profileRuns){
  const evidence=Array.from({length:4},(_,p)=>DIGITS.map(digit=>{
    const profiles=new Set(),families=new Set(),rules=new Set();let topThreePlacements=0,rankPoints=0,tieRules=0;
    profileRuns.forEach(run=>{
      let active=false;
      run.model.byPosition[p].forEach(f=>{
        if(f.digit!==digit)return;
        if(f.status==='ACTIVE'){active=true;families.add(f.family);rules.add(`${run.profile.id}|${f.id}`);}
        else if(f.status==='TIE')tieRules++;
      });
      if(active)profiles.add(run.profile.id);
      const idx=run.posRank[p].findIndex(x=>x.digit===digit);
      if(idx>=0&&idx<5){rankPoints+=5-idx;if(idx<3)topThreePlacements++;}
    });
    const strength=4*profiles.size+3*families.size+rules.size+topThreePlacements+Math.floor(rankPoints/5);
    return {digit,position:p,activeProfiles:profiles.size,activeFamilies:families.size,activeRules:rules.size,topThreePlacements,rankPoints,tieRules,strength};
  }));
  const ranks=evidence.map(rows=>rows.slice().sort(comparePositionEvidence));
  return {evidence,ranks};
}
function choosePositionCore(six,positionLedger){
  const ranks=positionLedger.ranks.map(rows=>rows.filter(x=>six.includes(x.digit))),candidates=[];
  ranks[0].forEach(a=>ranks[1].forEach(k=>ranks[2].forEach(l=>ranks[3].forEach(e=>{
    const rows=[a,k,l,e];if(new Set(rows.map(x=>x.digit)).size<4)return;
    candidates.push({rows,strength:sum(rows.map(x=>x.strength)),families:sum(rows.map(x=>x.activeFamilies)),rules:sum(rows.map(x=>x.activeRules)),rankPoints:sum(rows.map(x=>x.rankPoints))});
  }))));
  candidates.sort((a,b)=>b.strength-a.strength||b.families-a.families||b.rules-a.rules||b.rankPoints-a.rankPoints||a.rows.map(x=>x.digit).join('').localeCompare(b.rows.map(x=>x.digit).join('')));
  return candidates[0]?.rows.map(x=>x.digit)||six.slice(0,4);
}
function buildFormulaEvidenceLadder(profileRuns){
  const evidence=DIGITS.map(digit=>{
    const profiles=new Set(),positions=new Set(),activeFamilies=new Set(),activeRules=new Set(),tieFamilies=new Set();let topThreePlacements=0,rankPoints=0;
    profileRuns.forEach(run=>{
      let profileActive=false;
      for(let p=0;p<4;p++){
        run.model.byPosition[p].forEach(f=>{
          if(f.digit!==digit)return;
          if(f.status==='ACTIVE'){profileActive=true;positions.add(p);activeFamilies.add(`${p}|${f.family}`);activeRules.add(`${run.profile.id}|${p}|${f.id}`);}
          else if(f.status==='TIE')tieFamilies.add(`${p}|${f.family}`);
        });
        const idx=run.posRank[p].findIndex(x=>x.digit===digit);
        if(idx>=0&&idx<5){rankPoints+=5-idx;if(idx<3)topThreePlacements++;}
      }
      if(profileActive)profiles.add(run.profile.id);
    });
    return {digit,activeProfiles:profiles.size,activePositions:positions.size,activeFamilies:activeFamilies.size,activeRules:activeRules.size,tieFamilies:tieFamilies.size,topThreePlacements,rankPoints};
  }).sort(compareFormulaEvidence);
  const initialSix=evidence.slice(0,6).map(x=>x.digit),positionLedger=buildPositionFormulaLedger(profileRuns),four=choosePositionCore(initialSix,positionLedger);
  const outside=evidence.filter(x=>!four.includes(x.digit)),defaultFifth=outside[0],breadthCandidate=outside.find(x=>x.activeProfiles>=3&&x.activePositions>=3),positionBridge=breadthCandidate||defaultFifth;
  const five=[...four,positionBridge.digit],six=five.slice();
  evidence.forEach(row=>{if(six.length<6&&!six.includes(row.digit))six.push(row.digit);});
  const positionBridgeApplied=Boolean(breadthCandidate&&breadthCandidate.digit!==defaultFifth.digit);
  const routeNote=positionBridgeApplied?'Ledger posisi cukup beragam, tetapi kandidat batas memiliki jangkauan sekurangnya tiga posisi. Digit breadth tersebut mengisi kursi kelima tanpa mengubah 4D atau ranking kembar.':'Ledger posisi memiliki keragaman keluarga yang cukup; tangga memakai anchor unik A–K–L–E di dalam bukti formula utama.';
  return {six,five,four,evidence,positionLedger,initialSix,positionBridge:{digit:positionBridge.digit,activeProfiles:positionBridge.activeProfiles,activePositions:positionBridge.activePositions},positionBridgeApplied,mode:'position-coverage',modeLabel:positionBridgeApplied?'Position-Breadth Bridge':'Position-Coverage Route',routeNote};
}
function formulaSetMembershipStats(transitions,formula){
  const hitIndexes=[],n=transitions.length,cut=Math.floor(n/2);
  transitions.forEach((tr,i)=>{
    const digit=formula.fn(tr.source.digits);
    if(new Set(tr.target.digits).has(digit))hitIndexes.push(i);
  });
  const hits=hitIndexes.length,recentHits=hitIndexes.filter(i=>i>=cut).length;
  const hitBands=new Set(hitIndexes.map(i=>Math.min(2,Math.floor(3*i/Math.max(1,n))))).size;
  let status='BLOCKED';
  if(n>=7&&hits>=3&&recentHits>=1&&hitBands>=2)status='ACTIVE';
  else if(n>=5&&hits>=2&&(recentHits>=1||hitBands>=2))status='TIE';
  return {hits,recentHits,hitBands,status};
}
function compareRelationAnchor(a,b){
  return b.activeFamilies-a.activeFamilies||b.activeRules-a.activeRules||b.activeRecentHits-a.activeRecentHits||b.activeHits-a.activeHits||b.confluenceFamilies-a.confluenceFamilies||a.digit-b.digit;
}
function compareRelationEcho(a,b){
  return b.tieFamilies-a.tieFamilies||b.confluenceFamilies-a.confluenceFamilies||b.tieRules-a.tieRules||b.tieRecentHits-a.tieRecentHits||b.activeFamilies-a.activeFamilies||a.digit-b.digit;
}
function buildIndependentRelationLattice(profileRuns,positionLadder){
  const run=profileRuns.find(x=>x.profile.id==='formula-first')||profileRuns[0],latest=run.latest;
  const evidence=DIGITS.map(digit=>({digit,activeFamilySet:new Set(),tieFamilySet:new Set(),confluenceFamilySet:new Set(),activeRules:0,tieRules:0,activeHits:0,tieHits:0,activeRecentHits:0,tieRecentHits:0}));
  formulaLibrary().forEach(formula=>{
    const digit=formula.fn(latest.digits),row=evidence[digit],stats=formulaSetMembershipStats(run.transitions,formula);
    row.confluenceFamilySet.add(formula.family);
    if(stats.status==='ACTIVE'){
      row.activeFamilySet.add(formula.family);row.activeRules++;row.activeHits+=stats.hits;row.activeRecentHits+=stats.recentHits;
    }else if(stats.status==='TIE'){
      row.tieFamilySet.add(formula.family);row.tieRules++;row.tieHits+=stats.hits;row.tieRecentHits+=stats.recentHits;
    }
  });
  evidence.forEach(row=>{
    row.activeFamilies=row.activeFamilySet.size;row.tieFamilies=row.tieFamilySet.size;row.confluenceFamilies=row.confluenceFamilySet.size;
    delete row.activeFamilySet;delete row.tieFamilySet;delete row.confluenceFamilySet;
  });
  const anchors=evidence.slice().sort(compareRelationAnchor),echoes=evidence.slice().sort(compareRelationEcho),four=[anchors[0].digit];
  echoes.forEach(row=>{if(four.length<4&&!four.includes(row.digit))four.push(row.digit);});
  const five=four.slice();anchors.forEach(row=>{if(five.length<5&&!five.includes(row.digit))five.push(row.digit);});
  const six=five.slice();anchors.forEach(row=>{if(six.length<6&&!six.includes(row.digit))six.push(row.digit);});
  return {six,five,four,evidence,anchors,echoes,positionLedger:positionLadder.positionLedger,mode:'independent-family',modeLabel:'Independent-Family Route',routeNote:'Suara profil terdeteksi mengulang keluarga rumus yang sama. Inti memakai satu anchor replay dan tiga echo dari keluarga berbeda; profil duplikat tidak dihitung sebagai bukti baru.'};
}
function compareCrossRouteConcentration(a,b){
  return b.positionProfiles-a.positionProfiles||b.independentFamilies-a.independentFamilies||b.independentRecentHits-a.independentRecentHits||b.positionFamilies-a.positionFamilies||a.positionRank-b.positionRank||a.independentRank-b.independentRank||a.digit-b.digit;
}
function buildCrossRouteConcentrationLadder(formulaLadder,positionLadder,independentLattice,routeDecision,historyConditioned){
  if(!routeDecision?.structural||historyConditioned)return null;
  const position=new Map(positionLadder.evidence.map((row,index)=>[row.digit,{...row,rank:index+1}]));
  const independent=new Map(independentLattice.anchors.map((row,index)=>[row.digit,{...row,rank:index+1}]));
  const evidence=DIGITS.map(digit=>{
    const p=position.get(digit)||{},i=independent.get(digit)||{};
    return {digit,positionProfiles:p.activeProfiles||0,positionPositions:p.activePositions||0,positionFamilies:p.activeFamilies||0,positionRank:p.rank||99,independentFamilies:i.activeFamilies||0,independentRecentHits:i.activeRecentHits||0,independentRank:i.rank||99,dualActive:(p.activeProfiles||0)>=3&&(i.activeFamilies||0)>=4};
  }).sort(compareCrossRouteConcentration);
  const agreed=evidence.filter(row=>row.dualActive);
  if(agreed.length<5)return null;
  const five=agreed.slice(0,5).map(row=>row.digit),four=five.slice(0,4),six=five.slice();
  formulaLadder.six.forEach(digit=>{if(six.length<6&&!six.includes(digit))six.push(digit);});
  evidence.forEach(row=>{if(six.length<6&&!six.includes(row.digit))six.push(row.digit);});
  if(new Set(six).size!==6)return null;
  return {six,five,four,evidence,agreedDigits:agreed.map(row=>row.digit),priorSix:formulaLadder.six.slice(),priorFive:formulaLadder.five.slice(),priorFour:formulaLadder.four.slice(),mode:'cross-route-concentration',modeLabel:'Cross-Route Concentration Route',routeNote:'Lima digit lolos bersama pada jalur posisi dan keluarga independen. Tangga memusatkan bukti lintas-rute tersebut sebelum mempertahankan echo yang hanya kuat pada satu jalur; 4D tetap menjadi inti dari 5D dan 6D.'};
}
function compareValueRecurrence(a,b){
  return b.valueFamilies-a.valueFamilies||b.valueRecentFamilies-a.valueRecentFamilies||b.familyHits-a.familyHits||b.familyRecentHits-a.familyRecentHits||b.activeFamilies-a.activeFamilies||b.activeRules-a.activeRules||a.digit-b.digit;
}
function buildHistoryConditionedIndependentLadder(core,independentLattice,positionLadder){
  const transitions=core.transitions||[],latest=core.latest;if(!latest||transitions.length<7||new Set(latest.digits).size===4)return null;
  const n=transitions.length,cut=Math.floor(n/2),base=new Map(independentLattice.evidence.map(row=>[row.digit,row]));
  const evidence=DIGITS.map(digit=>({digit,familyEvidence:new Map(),recentFamilySet:new Set(),valueRules:0,valueHits:0,valueRecentHits:0,valueTrials:0}));
  formulaLibrary().forEach(formula=>{
    const stats=formulaSetMembershipStats(transitions,formula);if(stats.status!=='ACTIVE')return;
    const digit=formula.fn(latest.digits),row=evidence[digit];let trials=0,hits=0,recentHits=0;
    transitions.forEach((tr,i)=>{if(formula.fn(tr.source.digits)!==digit)return;trials++;if(new Set(tr.target.digits).has(digit)){hits++;if(i>=cut)recentHits++;}});
    row.valueTrials+=trials;if(!hits)return;
    row.valueRules++;row.valueHits+=hits;row.valueRecentHits+=recentHits;
    const old=row.familyEvidence.get(formula.family)||{hits:0,recentHits:0};
    if(hits>old.hits||(hits===old.hits&&recentHits>old.recentHits))row.familyEvidence.set(formula.family,{hits,recentHits});
    if(recentHits)row.recentFamilySet.add(formula.family);
  });
  evidence.forEach(row=>{
    row.valueFamilies=row.familyEvidence.size;row.valueRecentFamilies=row.recentFamilySet.size;
    row.familyHits=sum([...row.familyEvidence.values()].map(x=>x.hits));row.familyRecentHits=sum([...row.familyEvidence.values()].map(x=>x.recentHits));
    Object.assign(row,base.get(row.digit)||{});delete row.familyEvidence;delete row.recentFamilySet;
  });
  const supportedDigits=evidence.filter(row=>row.valueFamilies>0).length;if(supportedDigits<6)return null;
  evidence.sort(compareValueRecurrence);const four=evidence.slice(0,4).map(x=>x.digit),five=evidence.slice(0,5).map(x=>x.digit),coverageSeat=positionLadder.evidence.find(row=>!five.includes(row.digit))?.digit??evidence.find(row=>!five.includes(row.digit))?.digit,six=[...five,coverageSeat];
  return {six,five,four,evidence,anchors:independentLattice.anchors,echoes:independentLattice.echoes,positionLedger:independentLattice.positionLedger,supportedDigits,coverageSeat,mode:'history-conditioned-independent',modeLabel:'History-Conditioned Independent Route',routeNote:'Sumber terbaru memiliki digit berulang sehingga beberapa keluarga rumus dapat runtuh ke nilai yang sama. Setiap nilai pada 4D dan 5D harus mengulang bukti nilainya sendiri di seluruh replay pasangan hari; kursi keenam menjaga anchor posisi terbaik di luar inti.'};
}
function buildTargetDayRecurrenceLedger(rows,targetDay){
  const series=rows.filter(row=>row.day===targetDay),chrono=series.slice().reverse(),transitions=[];
  for(let i=0;i<chrono.length-1;i++)transitions.push({source:chrono[i],target:chrono[i+1],index:i});
  const n=transitions.length;if(n<6||!series[0])return null;const cut=Math.floor(n/2);
  const evidence=DIGITS.map(digit=>({digit,activeFamilySet:new Set(),tieFamilySet:new Set(),activeRules:0,tieRules:0,activeHits:0,activeRecentHits:0,hitBands:0}));
  formulaLibrary().forEach(formula=>{
    let hits=0,recentHits=0;const bands=new Set();
    transitions.forEach((tr,i)=>{const predicted=formula.fn(tr.source.digits);if(new Set(tr.target.digits).has(predicted)){hits++;if(i>=cut)recentHits++;bands.add(Math.min(2,Math.floor(3*i/n)));}});
    const active=hits>=3&&recentHits>=1&&bands.size>=2,tie=!active&&hits>=2&&(recentHits>=1||bands.size>=2),row=evidence[formula.fn(series[0].digits)];
    if(active){row.activeFamilySet.add(formula.family);row.activeRules++;row.activeHits+=hits;row.activeRecentHits+=recentHits;row.hitBands+=bands.size;}
    else if(tie){row.tieFamilySet.add(formula.family);row.tieRules++;}
  });
  evidence.forEach(row=>{
    row.activeFamilies=row.activeFamilySet.size;row.tieFamilies=row.tieFamilySet.size;
    row.positionCounts=POS.map((_,p)=>series.filter(item=>item.digits[p]===row.digit).length);row.maxPositionCount=Math.max(...row.positionCounts);
    delete row.activeFamilySet;delete row.tieFamilySet;
  });
  evidence.sort((a,b)=>b.activeFamilies-a.activeFamilies||b.activeRules-a.activeRules||b.activeRecentHits-a.activeRecentHits||b.activeHits-a.activeHits||b.tieFamilies-a.tieFamilies||a.digit-b.digit);
  return {series,transitions,evidence,latestTarget:series[0],targetDay};
}
function buildTargetDayRecurrenceBridge(rows,targetDay,formulaLadder,positionLadder,useIndependent){
  if(useIndependent)return null;const ledger=buildTargetDayRecurrenceLedger(rows,targetDay);if(!ledger)return null;
  const cross=new Map(positionLadder.evidence.map((row,index)=>[row.digit,{...row,rank:index+1}])),target=new Map(ledger.evidence.map((row,index)=>[row.digit,{...row,rank:index+1}]));
  const candidate=ledger.evidence.slice(0,3).find(row=>!formulaLadder.six.includes(row.digit)&&row.activeFamilies>=4&&row.activeRules>=4&&row.maxPositionCount>=3&&(cross.get(row.digit)?.tieFamilies||0)>=3);
  if(!candidate)return null;
  const victim=formulaLadder.four.map(digit=>({digit,target:target.get(digit),cross:cross.get(digit)})).filter(row=>(row.target?.activeFamilies||0)<=1).sort((a,b)=>(a.target?.activeFamilies||0)-(b.target?.activeFamilies||0)||(b.cross?.rank||99)-(a.cross?.rank||99)||b.digit-a.digit)[0];
  if(!victim)return null;
  const four=formulaLadder.four.map(digit=>digit===victim.digit?candidate.digit:digit),remaining=formulaLadder.six.filter(digit=>!four.includes(digit));
  remaining.sort((a,b)=>(target.get(b)?.activeFamilies||0)-(target.get(a)?.activeFamilies||0)||(target.get(a)?.rank||99)-(target.get(b)?.rank||99)||(cross.get(a)?.rank||99)-(cross.get(b)?.rank||99));
  const five=[...four,remaining[0]],sixth=formulaLadder.six.filter(digit=>!five.includes(digit)).sort((a,b)=>(cross.get(a)?.rank||99)-(cross.get(b)?.rank||99)||a-b)[0],six=[...five,sixth];
  if(new Set(six).size!==6)return null;
  return {candidateDigit:candidate.digit,replacedDigit:victim.digit,four,five,six,targetEvidence:candidate,targetTransitions:ledger.transitions.length,latestTargetDigits:ledger.latestTarget.digits,bridgeKind:'position-recurrence',mode:'target-day-bridge',modeLabel:'Dual-Horizon Target-Day Bridge'};
}
function composePositionTargetBridge(formulaLadder,candidate,victim,target,cross){
  const four=formulaLadder.four.map(digit=>digit===victim.digit?candidate.digit:digit);
  const remaining=formulaLadder.six.filter(digit=>!four.includes(digit)).sort((a,b)=>(target.get(a)?.rank||99)-(target.get(b)?.rank||99)||(cross.get(a)?.rank||99)-(cross.get(b)?.rank||99)||a-b);
  const five=[...four,remaining[0]],six=[...five,remaining[1]];
  if(new Set(four).size!==4||new Set(five).size!==5||new Set(six).size!==6)return null;
  return {four,five,six};
}
function buildDuplicateSourceTargetDayBridge(rows,targetDay,formulaLadder,positionLadder,useIndependent){
  if(useIndependent)return null;const ledger=buildTargetDayRecurrenceLedger(rows,targetDay);if(!ledger||ledger.transitions.length<7)return null;
  const counts=countMap(rows[0]?.digits||[]),cross=new Map(positionLadder.evidence.map((row,index)=>[row.digit,{...row,rank:index+1}])),target=new Map(ledger.evidence.map((row,index)=>[row.digit,{...row,rank:index+1}]));
  const candidate=Object.keys(counts).map(Number).filter(digit=>counts[digit]>=2&&!formulaLadder.six.includes(digit)).map(digit=>target.get(digit)).filter(row=>row&&row.rank<=4&&row.activeFamilies>=6&&row.activeRules>=7&&row.maxPositionCount>=3&&(cross.get(row.digit)?.tieFamilies||0)>=3).sort((a,b)=>a.rank-b.rank||a.digit-b.digit)[0];
  if(!candidate)return null;
  const victim=formulaLadder.four.map(digit=>({digit,target:target.get(digit),cross:cross.get(digit)})).filter(row=>candidate.activeFamilies-(row.target?.activeFamilies||0)>=3).sort((a,b)=>(b.target?.rank||99)-(a.target?.rank||99)||(a.target?.activeFamilies||0)-(b.target?.activeFamilies||0)||(b.cross?.rank||99)-(a.cross?.rank||99)||b.digit-a.digit)[0];
  if(!victim)return null;const ladder=composePositionTargetBridge(formulaLadder,candidate,victim,target,cross);if(!ladder)return null;
  const targetReserveDigits=ledger.evidence.slice(0,4).map(row=>row.digit).filter(digit=>!ladder.six.includes(digit));
  return {...ladder,candidateDigit:candidate.digit,replacedDigit:victim.digit,targetEvidence:candidate,targetTransitions:ledger.transitions.length,latestTargetDigits:ledger.latestTarget.digits,targetReserveDigits,bridgeKind:'duplicate-source-target',twinStrategy:'preserve',preservePriorHedge:true,mode:'duplicate-source-target-bridge',modeLabel:'Duplicate-Source Target-Day Bridge'};
}
function buildDominantTargetDayBridge(rows,targetDay,formulaLadder,positionLadder,independentLattice,useIndependent){
  if(useIndependent)return null;const ledger=buildTargetDayRecurrenceLedger(rows,targetDay);if(!ledger||ledger.transitions.length<7)return null;
  const cross=new Map(positionLadder.evidence.map((row,index)=>[row.digit,{...row,rank:index+1}])),independent=new Map(independentLattice.evidence.map((row,index)=>[row.digit,{...row,rank:index+1}])),target=new Map(ledger.evidence.map((row,index)=>[row.digit,{...row,rank:index+1}])),candidate=target.get(ledger.evidence[0].digit);
  if(formulaLadder.six.includes(candidate.digit)||candidate.activeFamilies<7||candidate.activeRules<7||candidate.activeRecentHits<10||(cross.get(candidate.digit)?.tieFamilies||0)<4||(independent.get(candidate.digit)?.activeFamilies||0)<3)return null;
  const victim=formulaLadder.four.map(digit=>({digit,target:target.get(digit),cross:cross.get(digit)})).filter(row=>candidate.activeFamilies-(row.target?.activeFamilies||0)>=4).sort((a,b)=>(b.target?.rank||99)-(a.target?.rank||99)||(a.target?.activeFamilies||0)-(b.target?.activeFamilies||0)||(b.cross?.rank||99)-(a.cross?.rank||99)||b.digit-a.digit)[0];
  if(!victim)return null;const ladder=composePositionTargetBridge(formulaLadder,candidate,victim,target,cross);if(!ladder)return null;
  const targetReserveDigits=ledger.evidence.slice(0,4).map(row=>row.digit).filter(digit=>!ladder.six.includes(digit));
  return {...ladder,candidateDigit:candidate.digit,replacedDigit:victim.digit,targetEvidence:candidate,targetTransitions:ledger.transitions.length,latestTargetDigits:ledger.latestTarget.digits,targetReserveDigits,bridgeKind:'dominant-target-anchor',twinStrategy:'preserve',preservePriorHedge:true,mode:'dominant-target-day-bridge',modeLabel:'Dominant Target-Day Anchor'};
}
function buildStructuralTargetDayCoreBridge(rows,targetDay,formulaLadder,positionLadder,independentLattice,routeDecision,historyConditioned){
  if(!routeDecision?.structural||historyConditioned)return null;
  const ledger=buildTargetDayRecurrenceLedger(rows,targetDay);if(!ledger||ledger.transitions.length<7)return null;
  const target=new Map(ledger.evidence.map((row,index)=>[row.digit,{...row,rank:index+1}]));
  const independent=new Map(independentLattice.evidence.map((row,index)=>[row.digit,{...row,rank:index+1}]));
  const position=new Map(positionLadder.evidence.map((row,index)=>[row.digit,{...row,rank:index+1}]));
  const candidate=ledger.evidence.slice(0,2).find(row=>
    formulaLadder.five.includes(row.digit)&&!formulaLadder.four.includes(row.digit)&&
    row.activeFamilies>=5&&row.activeRules>=5&&
    (independent.get(row.digit)?.activeFamilies||0)>=4&&(independent.get(row.digit)?.activeRules||0)>=4&&
    (position.get(row.digit)?.activeProfiles||0)>=3
  );
  if(!candidate)return null;
  const candidatePosition=position.get(candidate.digit)?.activeProfiles||0;
  const victim=formulaLadder.four.map(digit=>({digit,target:target.get(digit),position:position.get(digit)})).filter(row=>
    candidate.activeFamilies-(row.target?.activeFamilies||0)>=2&&
    candidatePosition>(row.position?.activeProfiles||0)
  ).sort((a,b)=>(b.target?.rank||99)-(a.target?.rank||99)||(a.target?.activeFamilies||0)-(b.target?.activeFamilies||0)||(b.position?.rank||99)-(a.position?.rank||99)||b.digit-a.digit)[0];
  if(!victim)return null;
  const four=formulaLadder.four.map(digit=>digit===victim.digit?candidate.digit:digit);
  const five=[...four,...formulaLadder.five.filter(digit=>!four.includes(digit))].slice(0,5);
  const six=[...five,...formulaLadder.six.filter(digit=>!five.includes(digit))].slice(0,6);
  if(new Set(four).size!==4||new Set(five).size!==5||new Set(six).size!==6)return null;
  return {candidateDigit:candidate.digit,replacedDigit:victim.digit,four,five,six,targetEvidence:candidate,targetTransitions:ledger.transitions.length,latestTargetDigits:ledger.latestTarget.digits,bridgeKind:'structural-core',twinStrategy:'repeat-depth',mode:'structural-target-day-core',modeLabel:'Structural Target-Day Core Bridge'};
}
function buildSplitEvidenceRepeatPositionBridge(rows,targetDay,formulaLadder,positionLadder,independentLattice,routeDecision,historyConditioned){
  if(!routeDecision?.structural||historyConditioned)return null;
  const ledger=buildTargetDayRecurrenceLedger(rows,targetDay);if(!ledger||ledger.transitions.length<6)return null;
  const latestSourceDigits=rows[0]?.digits||[],latestSet=new Set(latestSourceDigits);
  const independent=new Map(independentLattice.evidence.map(row=>[row.digit,row]));
  const position=new Map(positionLadder.evidence.map((row,index)=>[row.digit,{...row,rank:index+1}]));
  const target=new Map(ledger.evidence.map((row,index)=>[row.digit,{...row,rank:index+1}]));
  const candidates=formulaLadder.six.filter(digit=>!formulaLadder.four.includes(digit)&&latestSet.has(digit)).map(digit=>({digit,independent:independent.get(digit),position:position.get(digit),target:target.get(digit)})).filter(row=>
    row.independent&&row.position&&row.target&&
    row.independent.activeFamilies>=4&&row.independent.activeRules>=4&&row.independent.activeRecentHits>=6&&
    row.target.activeFamilies===2&&row.target.tieFamilies>=3&&row.target.maxPositionCount>=2&&
    row.position.activeProfiles>=1&&row.position.tieFamilies>=4
  ).sort((a,b)=>
    b.target.maxPositionCount-a.target.maxPositionCount||
    b.independent.activeFamilies-a.independent.activeFamilies||
    b.independent.activeRecentHits-a.independent.activeRecentHits||a.digit-b.digit
  );
  const candidate=candidates[0];if(!candidate)return null;
  const victims=formulaLadder.four.map(digit=>({digit,independent:independent.get(digit),position:position.get(digit),target:target.get(digit)})).filter(row=>
    row.independent&&row.position&&row.target&&
    candidate.independent.activeFamilies-row.independent.activeFamilies>=2&&
    candidate.independent.activeRecentHits>row.independent.activeRecentHits&&
    candidate.target.maxPositionCount>row.target.maxPositionCount
  ).sort((a,b)=>
    a.independent.activeFamilies-b.independent.activeFamilies||
    a.independent.activeRecentHits-b.independent.activeRecentHits||
    a.target.maxPositionCount-b.target.maxPositionCount||
    b.position.rank-a.position.rank||b.digit-a.digit
  );
  const victim=victims[0];if(!victim)return null;
  const four=formulaLadder.four.map(digit=>digit===victim.digit?candidate.digit:digit);
  const five=[...four,...formulaLadder.five.filter(digit=>!four.includes(digit))].slice(0,5);
  const six=[...five,...formulaLadder.six.filter(digit=>!five.includes(digit))].slice(0,6);
  if(new Set(four).size!==4||new Set(five).size!==5||new Set(six).size!==6)return null;
  return {candidateDigit:candidate.digit,replacedDigit:victim.digit,four,five,six,priorFour:formulaLadder.four.slice(),priorFive:formulaLadder.five.slice(),priorSix:formulaLadder.six.slice(),targetEvidence:candidate.target,independentEvidence:candidate.independent,positionEvidence:candidate.position,targetTransitions:ledger.transitions.length,latestTargetDigits:ledger.latestTarget.digits,latestSourceDigits,bridgeKind:'split-evidence-repeat-position',twinStrategy:'source-continuity',mode:'split-evidence-repeat-position',modeLabel:'Split-Evidence Repeat-Position Bridge'};
}
function buildStructuralTargetDayAnchorRestoration(rows,targetDay,formulaLadder,positionLadder,independentLattice,routeDecision,historyConditioned,crossRouteConcentration){
  if(!routeDecision?.structural||historyConditioned||crossRouteConcentration)return null;
  const ledger=buildTargetDayRecurrenceLedger(rows,targetDay);if(!ledger||ledger.transitions.length<6)return null;
  const independent=new Map(independentLattice.anchors.map((row,index)=>[row.digit,{...row,rank:index+1}]));
  const position=new Map(positionLadder.evidence.map((row,index)=>[row.digit,{...row,rank:index+1}]));
  const target=new Map(ledger.evidence.map((row,index)=>[row.digit,{...row,rank:index+1}]));
  const candidate=ledger.evidence[0],candidateIndependent=independent.get(candidate?.digit),candidatePosition=position.get(candidate?.digit);
  if(!candidate||formulaLadder.six.includes(candidate.digit)||
    candidate.activeFamilies<5||candidate.activeRules<5||candidate.activeRecentHits<8||
    !candidateIndependent||candidateIndependent.activeFamilies<4||candidateIndependent.activeRules<4||candidateIndependent.activeRecentHits<6||
    !candidatePosition||candidatePosition.activeProfiles<1||candidatePosition.tieFamilies<3)return null;
  const victims=formulaLadder.four.map(digit=>({digit,independent:independent.get(digit),position:position.get(digit),target:target.get(digit)})).filter(row=>
    row.independent&&row.position&&row.target&&
    candidateIndependent.activeFamilies-row.independent.activeFamilies>=2&&
    candidate.activeFamilies-row.target.activeFamilies>=2&&
    candidateIndependent.activeRecentHits>row.independent.activeRecentHits
  ).sort((a,b)=>
    a.independent.activeFamilies-b.independent.activeFamilies||
    a.target.activeFamilies-b.target.activeFamilies||
    b.position.rank-a.position.rank||b.digit-a.digit
  );
  const victim=victims[0];if(!victim)return null;
  const four=formulaLadder.four.map(digit=>digit===victim.digit?candidate.digit:digit);
  const remaining=formulaLadder.six.filter(digit=>!four.includes(digit)&&digit!==victim.digit);
  const boundaryRetention=buildTargetPositionBoundaryRetention(remaining,independent,position,target);
  const boundaryOrder=boundaryRetention?[boundaryRetention.digit,...remaining.filter(digit=>digit!==boundaryRetention.digit)]:remaining;
  const five=[...four,boundaryOrder[0]],six=[...five,boundaryOrder[1]];
  if(new Set(four).size!==4||new Set(five).size!==5||new Set(six).size!==6)return null;
  return {candidateDigit:candidate.digit,replacedDigit:victim.digit,four,five,six,priorFour:formulaLadder.four.slice(),priorFive:formulaLadder.five.slice(),priorSix:formulaLadder.six.slice(),targetEvidence:candidate,independentEvidence:candidateIndependent,positionEvidence:candidatePosition,boundaryRetention,targetTransitions:ledger.transitions.length,latestTargetDigits:ledger.latestTarget.digits,bridgeKind:'structural-target-anchor-restoration',twinStrategy:'target-anchor',mode:'structural-target-anchor-restoration',modeLabel:'Structural Target-Day Anchor Restoration'};
}
function buildTargetPositionBoundaryRetention(remaining,independent,position,target){
  if(!Array.isArray(remaining)||remaining.length<2)return null;
  const incumbentDigit=remaining[0],incumbent={independent:independent.get(incumbentDigit),position:position.get(incumbentDigit),target:target.get(incumbentDigit)};
  if(!incumbent.independent||!incumbent.position||!incumbent.target)return null;
  const challengers=remaining.slice(1).map(digit=>({digit,independent:independent.get(digit),position:position.get(digit),target:target.get(digit)})).filter(row=>
    row.independent&&row.position&&row.target&&
    row.independent.activeFamilies>=4&&row.independent.activeRules>=4&&row.independent.activeRecentHits>=6&&
    row.target.activeFamilies>=3&&row.target.activeRules>=3&&row.target.activeRecentHits>=6&&
    row.position.activeFamilies>=2&&
    row.target.activeFamilies>=incumbent.target.activeFamilies+1&&
    row.target.activeRecentHits>=incumbent.target.activeRecentHits+2&&
    row.position.activeFamilies>=incumbent.position.activeFamilies+1&&
    row.independent.activeFamilies>=incumbent.independent.activeFamilies-1&&
    row.independent.activeRules>=incumbent.independent.activeRules&&
    row.independent.activeRecentHits>=incumbent.independent.activeRecentHits-2
  ).sort((a,b)=>
    b.target.activeFamilies-a.target.activeFamilies||
    b.target.activeRecentHits-a.target.activeRecentHits||
    b.position.activeFamilies-a.position.activeFamilies||
    b.independent.activeFamilies-a.independent.activeFamilies||a.digit-b.digit
  );
  const winner=challengers[0];
  return winner?{digit:winner.digit,displacedDigit:incumbentDigit,targetEvidence:winner.target,positionEvidence:winner.position,independentEvidence:winner.independent,incumbentEvidence:incumbent,reason:'target-position-active-dominance'}:null;
}
function buildStructuralReplayLossRecovery(rows,targetDay,formulaLadder,positionLadder,independentLattice,routeDecision,historyConditioned,crossRouteConcentration){
  if(!routeDecision?.structural||routeDecision.replayValidated||historyConditioned||crossRouteConcentration||formulaLadder.corePromotion||formulaLadder.boundarySeat)return null;
  const replay=routeDecision.replay;
  if(!replay||replay.position.tests<6||routeDecision.overlap>1||replay.position.four<replay.independent.four+.08||replay.position.score<replay.independent.score+.08)return null;
  const ledger=buildTargetDayRecurrenceLedger(rows,targetDay);if(!ledger||ledger.transitions.length<6)return null;
  const rankedMap=items=>new Map(items.map((row,index)=>[row.digit,{...row,rank:index+1}]));
  const target=rankedMap(ledger.evidence),independent=rankedMap(independentLattice.anchors),position=rankedMap(positionLadder.evidence);
  const routeUnion=new Set([...formulaLadder.six,...positionLadder.six]);
  const anchor=ledger.evidence.slice(0,3).find(row=>
    !routeUnion.has(row.digit)&&row.activeFamilies>=3&&row.activeRules>=4&&row.activeRecentHits>=6&&row.tieFamilies>=4&&
    (independent.get(row.digit)?.confluenceFamilies||0)>=6
  );
  if(!anchor)return null;
  const counter=positionLadder.six.filter(digit=>!formulaLadder.six.includes(digit)&&digit!==anchor.digit).map(digit=>({digit,target:target.get(digit),independent:independent.get(digit),position:position.get(digit)})).filter(row=>
    row.target&&row.independent&&row.position&&row.target.activeFamilies>=1&&row.target.tieFamilies>=3&&
    row.independent.confluenceFamilies>=5&&row.position.activeProfiles>=1
  ).sort((a,b)=>
    b.target.tieFamilies-a.target.tieFamilies||b.independent.confluenceFamilies-a.independent.confluenceFamilies||a.position.rank-b.position.rank||a.digit-b.digit
  )[0];
  if(!counter)return null;
  const positionFive=new Set(positionLadder.five),spine=formulaLadder.five.filter(digit=>positionFive.has(digit));
  if(spine.length!==3||spine.includes(anchor.digit)||spine.includes(counter.digit))return null;
  const four=[...spine,anchor.digit],five=[...four,counter.digit],six=five.slice();
  formulaLadder.six.forEach(digit=>{if(six.length<6&&!six.includes(digit))six.push(digit);});
  positionLadder.six.forEach(digit=>{if(six.length<6&&!six.includes(digit))six.push(digit);});
  if(new Set(four).size!==4||new Set(five).size!==5||new Set(six).size!==6)return null;
  return {candidateDigit:anchor.digit,counterDigit:counter.digit,spineDigits:spine,four,five,six,priorFour:formulaLadder.four.slice(),priorFive:formulaLadder.five.slice(),priorSix:formulaLadder.six.slice(),targetEvidence:anchor,independentEvidence:independent.get(anchor.digit),counterEvidence:counter,targetTransitions:ledger.transitions.length,latestTargetDigits:ledger.latestTarget.digits,bridgeKind:'structural-replay-loss-recovery',twinStrategy:'target-anchor',mode:'structural-replay-loss-recovery',modeLabel:'Structural Replay-Loss Recovery'};
}
function buildNearTieTargetCoverage(rows,targetDay,formulaLadder,positionLadder,independentLattice,routeDecision,latest,targetDayBridge,crossRouteConcentration,historyConditioned){
  const replay=routeDecision?.replay;
  if(routeDecision?.cause!=='position'||targetDayBridge||crossRouteConcentration||historyConditioned||formulaLadder.mode!=='position-coverage'||positionLadder.positionBridgeApplied||!replay||replay.position.tests<6||routeDecision.overlap!==2||replay.position.score<replay.independent.score||replay.position.score>replay.independent.score+.02||Math.abs(replay.position.four-replay.independent.four)>.03||replay.independent.six<replay.position.six+.04)return null;
  const ledger=buildTargetDayRecurrenceLedger(rows,targetDay);if(!ledger||ledger.transitions.length<7)return null;
  const rankedMap=items=>new Map(items.map((row,index)=>[row.digit,{...row,rank:index+1}]));
  const target=rankedMap(ledger.evidence),independent=rankedMap(independentLattice.anchors),position=rankedMap(positionLadder.evidence),latestTargetSet=new Set(ledger.latestTarget.digits),primary=new Set(formulaLadder.six);
  const candidates=[...latestTargetSet].filter(digit=>!primary.has(digit)).map(digit=>({digit,target:target.get(digit),independent:independent.get(digit),position:position.get(digit)})).filter(row=>
    row.target?.activeFamilies>=3&&row.target?.activeRules>=3&&row.target?.maxPositionCount>=2&&row.independent?.activeFamilies>=4&&row.position?.activeProfiles>=3&&row.position?.activePositions>=1
  ).sort((a,b)=>b.target.activeFamilies-a.target.activeFamilies||b.target.activeRecentHits-a.target.activeRecentHits||b.target.maxPositionCount-a.target.maxPositionCount||b.independent.activeFamilies-a.independent.activeFamilies||a.digit-b.digit);
  if(candidates.length!==2)return null;
  const independentSix=new Set(independentLattice.six);
  if(!candidates.some(row=>independentSix.has(row.digit))||!candidates.some(row=>!independentSix.has(row.digit)))return null;
  const routeOnlyVictims=formulaLadder.six.filter(digit=>!independentSix.has(digit)).map(digit=>({digit,target:target.get(digit),independent:independent.get(digit),position:position.get(digit)})).filter(row=>(row.target?.activeFamilies||0)===0&&(row.independent?.activeFamilies||0)<=3);
  if(routeOnlyVictims.length!==1)return null;
  const latestSourceSet=new Set(latest.digits),sourceCarryVictims=formulaLadder.six.filter(digit=>latestSourceSet.has(digit)&&digit!==routeOnlyVictims[0].digit).map(digit=>position.get(digit)).filter(Boolean).sort((a,b)=>b.rank-a.rank||a.activeProfiles-b.activeProfiles||a.activeFamilies-b.activeFamilies||b.digit-a.digit);
  if(sourceCarryVictims.length<3)return null;
  const sourceCarryVictim=sourceCarryVictims[0],victims=new Set([routeOnlyVictims[0].digit,sourceCarryVictim.digit]),survivors=formulaLadder.six.filter(digit=>!victims.has(digit)),four=formulaLadder.five.filter(digit=>!victims.has(digit)),candidateDigits=candidates.map(row=>row.digit);
  if(survivors.length!==4||four.length!==4)return null;
  const five=[...four,candidateDigits[0]],six=[...five,candidateDigits[1]];
  if(new Set(six).size!==6)return null;
  return {four,five,six,candidateDigits,candidates,routeOnlyVictim:routeOnlyVictims[0],sourceCarryVictim,priorFour:formulaLadder.four.slice(),priorFive:formulaLadder.five.slice(),priorSix:formulaLadder.six.slice(),targetTransitions:ledger.transitions.length,latestTargetDigits:ledger.latestTarget.digits,mode:'near-tie-target-coverage',modeLabel:'Near-Tie Target-Coverage Recovery',routeNote:`Replay posisi dan keluarga independen nyaris seri, sementara rute independen unggul pada cakupan 6D. Dua digit kontinuitas target-day ${candidateDigits.join(' ')} lolos bersama pada replay target-day, keluarga independen, dan posisi. Echo satu-rute ${routeOnlyVictims[0].digit} serta carry sumber terlemah ${sourceCarryVictim.digit} dilepas agar cakupan tidak terkunci pada satu rute.`};
}
function buildMiddlePositionTargetDayRecovery(rows,targetDay,formulaLadder,positionLadder,independentLattice,routeDecision,historyConditioned,crossRouteConcentration){
  const replay=routeDecision?.replay;
  if(routeDecision?.cause!=='position'||historyConditioned||crossRouteConcentration||formulaLadder.mode!=='position-coverage'||positionLadder.positionBridgeApplied||!replay||replay.position.tests<7||routeDecision.overlap!==2||replay.position.four<replay.independent.four+.18||replay.position.score<replay.independent.score+.12||replay.position.six<replay.independent.six)return null;
  const ledger=buildTargetDayRecurrenceLedger(rows,targetDay);if(!ledger||ledger.transitions.length<8)return null;
  const rankedMap=items=>new Map(items.map((row,index)=>[row.digit,{...row,rank:index+1}]));
  const target=rankedMap(ledger.evidence),position=rankedMap(positionLadder.evidence),independent=rankedMap(independentLattice.anchors),candidate=ledger.evidence[0],runner=ledger.evidence[1],latestDigits=rows[0]?.digits||[];
  const middleEvidence=positionLadder.positionLedger.evidence[1]?.find(row=>row.digit===candidate?.digit),candidateIndependent=independent.get(candidate?.digit);
  if(!candidate||formulaLadder.six.includes(candidate.digit)||latestDigits.includes(candidate.digit)||
    candidate.activeFamilies<5||candidate.activeRules<6||candidate.activeRecentHits<10||candidate.tieFamilies<2||candidate.maxPositionCount<2||(candidate.positionCounts?.[1]||0)<1||
    candidate.activeFamilies<(runner?.activeFamilies||0)+1||candidate.activeRules<(runner?.activeRules||0)+2||
    !middleEvidence||middleEvidence.tieRules<3||!candidateIndependent||candidateIndependent.activeFamilies<1||candidateIndependent.confluenceFamilies<4)return null;
  const latestSet=new Set(latestDigits),victims=formulaLadder.four.filter(digit=>latestSet.has(digit)).map(digit=>({digit,target:target.get(digit),position:position.get(digit)})).filter(row=>
    row.target&&row.position&&candidate.activeFamilies>=row.target.activeFamilies+2&&candidate.activeRules>=row.target.activeRules+2
  ).sort((a,b)=>
    a.target.activeFamilies-b.target.activeFamilies||a.target.activeRecentHits-b.target.activeRecentHits||b.position.rank-a.position.rank||b.digit-a.digit
  );
  if(victims.length!==1)return null;const victim=victims[0],four=formulaLadder.four.map(digit=>digit===victim.digit?candidate.digit:digit);
  const five=[...four,...formulaLadder.five.filter(digit=>!four.includes(digit)&&digit!==victim.digit)].slice(0,5);
  const sixth=[victim.digit,...formulaLadder.six.filter(digit=>!five.includes(digit)&&digit!==victim.digit)].map(digit=>({digit,target:target.get(digit),position:position.get(digit)})).sort((a,b)=>
    (b.target?.activeFamilies||0)-(a.target?.activeFamilies||0)||(b.target?.activeRecentHits||0)-(a.target?.activeRecentHits||0)||(b.position?.activeFamilies||0)-(a.position?.activeFamilies||0)||(a.position?.rank||99)-(b.position?.rank||99)||a.digit-b.digit
  )[0]?.digit;
  const six=[...five,sixth];if(new Set(four).size!==4||new Set(five).size!==5||new Set(six).size!==6)return null;
  return {candidateDigit:candidate.digit,replacedDigit:victim.digit,four,five,six,priorFour:formulaLadder.four.slice(),priorFive:formulaLadder.five.slice(),priorSix:formulaLadder.six.slice(),targetEvidence:candidate,independentEvidence:candidateIndependent,middleEvidence,targetTransitions:ledger.transitions.length,latestTargetDigits:ledger.latestTarget.digits,bridgeKind:'target-day-middle-position-recovery',twinStrategy:'target-anchor',mode:'target-day-middle-position-recovery',modeLabel:'Target-Day Middle-Position Recovery'};
}
function buildReplayKCounterRouteGuard(rows,targetDay,formulaLadder,positionLadder,independentLattice,routeDecision,historyConditioned,crossRouteConcentration,targetDayBridge,nearTieTargetCoverage){
  const replay=routeDecision?.replay;
  if(!routeDecision?.useIndependent||!routeDecision.replayValidated||historyConditioned||crossRouteConcentration||targetDayBridge||nearTieTargetCoverage||!replay||replay.independent.tests<6||routeDecision.overlap!==2||replay.independent.four<replay.position.four+.10||replay.independent.score<replay.position.score+.10||replay.independent.six<replay.position.six+.10)return null;
  const ledger=buildTargetDayRecurrenceLedger(rows,targetDay);if(!ledger||ledger.transitions.length<6)return null;
  const rankedMap=items=>new Map(items.map((row,index)=>[row.digit,{...row,rank:index+1}]));
  const target=rankedMap(ledger.evidence),position=rankedMap(positionLadder.evidence),independent=rankedMap(independentLattice.anchors),middleLeader=positionLadder.positionLedger.ranks[1]?.[0];
  if(!middleLeader)return null;
  const outsideIndependent=positionLadder.four.filter(digit=>!independentLattice.six.includes(digit));
  if(outsideIndependent.length!==1||outsideIndependent[0]!==middleLeader.digit)return null;
  const candidate={digit:middleLeader.digit,middle:middleLeader,target:target.get(middleLeader.digit),position:position.get(middleLeader.digit),independent:independent.get(middleLeader.digit)};
  if(candidate.middle.activeProfiles<4||candidate.middle.activeFamilies<1||candidate.middle.activeRules<4||candidate.middle.tieRules!==0||candidate.position?.rank>3||candidate.position?.activeProfiles<4||candidate.position?.activePositions<2||candidate.position?.activeRules<5||candidate.target?.tieFamilies<2||candidate.target?.positionCounts.filter(count=>count>0).length!==4||candidate.independent?.activeFamilies<1||candidate.independent?.activeRecentHits<3)return null;
  const victimDigit=formulaLadder.six[5],victim={digit:victimDigit,target:target.get(victimDigit),position:position.get(victimDigit),independent:independent.get(victimDigit)};
  if(formulaLadder.five.includes(victimDigit)||positionLadder.six.includes(victimDigit)||(victim.position?.activeProfiles||0)!==0||(victim.position?.activePositions||0)!==0||(victim.position?.activeFamilies||0)!==0||(candidate.position?.rank||99)>=(victim.position?.rank||99))return null;
  const six=[...formulaLadder.five,candidate.digit];if(new Set(six).size!==6)return null;
  return {six,five:formulaLadder.five.slice(),four:formulaLadder.four.slice(),candidateDigit:candidate.digit,replacedDigit:victim.digit,candidate,victim,priorSix:formulaLadder.six.slice(),priorFive:formulaLadder.five.slice(),priorFour:formulaLadder.four.slice(),targetTransitions:ledger.transitions.length,latestTargetDigits:ledger.latestTarget.digits,mode:'replay-k-counter-route-guard',modeLabel:'Replay-Validated K-Coverage Guard'};
}
function buildReplayIndependentTargetCarryTwinRecovery(rows,targetDay,formulaLadder,positionLadder,independentLattice,routeDecision,profileRuns,historyConditioned,crossRouteConcentration,targetDayBridge,nearTieTargetCoverage,replayKCounterRouteGuard){
  const replay=routeDecision?.replay;
  if(routeDecision?.cause!=='replay'||routeDecision?.structural||!routeDecision?.replayValidated||!routeDecision?.useIndependent||historyConditioned||crossRouteConcentration||targetDayBridge||nearTieTargetCoverage||replayKCounterRouteGuard||formulaLadder.mode!=='replay-independent'||!replay||replay.independent.tests<6||routeDecision.overlap!==2||replay.independent.four<replay.position.four+.20||replay.independent.score<replay.position.score+.20||replay.independent.six<replay.position.six+.20)return null;
  const ledger=buildTargetDayRecurrenceLedger(rows,targetDay);if(!ledger||ledger.transitions.length<6)return null;
  const latestSource=unique(rows[0]?.digits||[]),latestTarget=unique(ledger.latestTarget.digits);if(latestSource.length!==4||latestTarget.length!==4)return null;
  const rankedMap=items=>new Map(items.map((row,index)=>[row.digit,{...row,rank:index+1}]));
  const target=rankedMap(ledger.evidence),independent=rankedMap(independentLattice.anchors),position=rankedMap(positionLadder.evidence);
  const hedge=rankedMap(buildFormulaHedge(profileRuns,formulaLadder.five,positionLadder.positionLedger).evidence);
  const primarySix=new Set(formulaLadder.six),positionSix=new Set(positionLadder.six),routeUnion=new Set([...primarySix,...positionSix]),latestSourceSet=new Set(latestSource),latestTargetSet=new Set(latestTarget);
  const sharedSpine=formulaLadder.four.filter(digit=>positionLadder.four.includes(digit));if(sharedSpine.length!==2)return null;
  const retainedTargetCore=formulaLadder.four.filter(digit=>latestTargetSet.has(digit)&&!sharedSpine.includes(digit));if(retainedTargetCore.length!==1)return null;
  const missingTargetDigits=latestTarget.filter(digit=>!primarySix.has(digit));if(missingTargetDigits.length!==2)return null;
  const sourceTargetDigits=missingTargetDigits.filter(digit=>latestSourceSet.has(digit)&&positionSix.has(digit));if(sourceTargetDigits.length!==1)return null;
  const orthogonalDigits=missingTargetDigits.filter(digit=>!latestSourceSet.has(digit)&&!routeUnion.has(digit));if(orthogonalDigits.length!==1)return null;
  const describe=digit=>({digit,target:target.get(digit),independent:independent.get(digit),position:position.get(digit),hedge:hedge.get(digit)});
  const retained=describe(retainedTargetCore[0]),sourceTargetCandidate=describe(sourceTargetDigits[0]),orthogonalCandidate=describe(orthogonalDigits[0]);
  if(retained.target?.rank>3||retained.target?.activeFamilies<3||retained.target?.activeRecentHits<6||retained.independent?.confluenceFamilies<6||
    sourceTargetCandidate.target?.activeFamilies<3||sourceTargetCandidate.target?.activeRecentHits<6||sourceTargetCandidate.independent?.confluenceFamilies<6||sourceTargetCandidate.position?.activeProfiles<1||sourceTargetCandidate.position?.rank>6||sourceTargetCandidate.hedge?.tieProfiles<3||sourceTargetCandidate.hedge?.tiePositions<3||sourceTargetCandidate.hedge?.runnerPlacements<12||
    orthogonalCandidate.target?.activeFamilies<1||orthogonalCandidate.target?.tieFamilies<2||orthogonalCandidate.independent?.activeFamilies<1||orthogonalCandidate.independent?.tieFamilies<2||orthogonalCandidate.hedge?.tieProfiles<3||orthogonalCandidate.hedge?.tiePositions<2)return null;
  const reserveCandidates=formulaLadder.four.filter(digit=>!sharedSpine.includes(digit)&&digit!==retained.digit).map(digit=>describe(digit)).filter(row=>
    row.target?.rank<=2&&row.target?.activeFamilies>=5&&row.target?.activeRecentHits>=9&&row.target?.maxPositionCount>=3
  );
  if(reserveCandidates.length!==1)return null;const reserve=reserveCandidates[0];
  const four=[...sharedSpine,retained.digit,sourceTargetCandidate.digit],five=[...four,orthogonalCandidate.digit],six=[...five,reserve.digit];
  if(new Set(four).size!==4||new Set(five).size!==5||new Set(six).size!==6)return null;
  return {four,five,six,sharedSpine,retainedTargetCore:retained,sourceTargetCandidate,orthogonalCandidate,reserve,priorFour:formulaLadder.four.slice(),priorFive:formulaLadder.five.slice(),priorSix:formulaLadder.six.slice(),latestSourceDigits:rows[0].digits.slice(),latestTargetDigits:ledger.latestTarget.digits.slice(),targetTransitions:ledger.transitions.length,mode:'replay-independent-target-carry-twin',modeLabel:'Replay-Independent Target-Carry Twin Recovery'};
}
function dualRouteCombinedBreadth(row){
  return (row.target?.activeFamilies||0)+(row.independent?.activeFamilies||0)+(row.position?.activeFamilies||0);
}
function compareDualRouteSurvivor(a,b){
  return dualRouteCombinedBreadth(b)-dualRouteCombinedBreadth(a)||
    (b.target?.activeRecentHits||0)-(a.target?.activeRecentHits||0)||
    (b.independent?.activeRecentHits||0)-(a.independent?.activeRecentHits||0)||
    (a.position?.rank||99)-(b.position?.rank||99)||
    a.originalRank-b.originalRank||a.digit-b.digit;
}
function compareDualRouteVictim(a,b){
  return dualRouteCombinedBreadth(a)-dualRouteCombinedBreadth(b)||
    (a.target?.activeRecentHits||0)-(b.target?.activeRecentHits||0)||
    (a.independent?.activeRecentHits||0)-(b.independent?.activeRecentHits||0)||
    (b.position?.rank||99)-(a.position?.rank||99)||
    b.originalRank-a.originalRank||b.digit-a.digit;
}
function buildDualRouteDigitCoverageRecovery(rows,targetDay,formulaLadder,positionLadder,independentLattice,routeDecision,historyConditioned,crossRouteConcentration,targetDayBridge,nearTieTargetCoverage,replayKCounterRouteGuard){
  const replay=routeDecision?.replay;
  if(routeDecision?.cause!=='position'||routeDecision?.structural||routeDecision?.replayValidated||historyConditioned||crossRouteConcentration||targetDayBridge||nearTieTargetCoverage||replayKCounterRouteGuard||formulaLadder.mode!=='position-coverage'||positionLadder.positionBridgeApplied||!replay||replay.position.tests<6||routeDecision.overlap!==1||replay.position.four<replay.independent.four+.08||replay.position.score<replay.independent.score+.06||replay.independent.six<replay.position.six+.01)return null;
  const ledger=buildTargetDayRecurrenceLedger(rows,targetDay);if(!ledger||ledger.transitions.length<6)return null;
  const rankedMap=items=>new Map(items.map((row,index)=>[row.digit,{...row,rank:index+1}]));
  const target=rankedMap(ledger.evidence),independent=rankedMap(independentLattice.anchors),position=rankedMap(positionLadder.evidence),primary=new Set(formulaLadder.six),outside=independentLattice.six.filter(digit=>!primary.has(digit));
  const targetCandidates=outside.map(digit=>({digit,target:target.get(digit),independent:independent.get(digit),position:position.get(digit)})).filter(row=>
    row.target?.rank<=2&&row.target?.activeFamilies>=4&&row.target?.activeRules>=4&&row.target?.activeRecentHits>=6&&row.target?.tieFamilies>=4&&row.target?.maxPositionCount>=2&&
    row.independent?.activeFamilies>=3&&row.independent?.confluenceFamilies>=6&&row.position?.tieFamilies>=6
  ).sort((a,b)=>a.target.rank-b.target.rank||b.target.activeFamilies-a.target.activeFamilies||b.independent.confluenceFamilies-a.independent.confluenceFamilies||a.digit-b.digit);
  if(targetCandidates.length!==1)return null;const targetCandidate=targetCandidates[0];
  const coverageCandidates=outside.map(digit=>({digit,target:target.get(digit),independent:independent.get(digit),position:position.get(digit)})).filter(row=>
    row.digit!==targetCandidate.digit&&row.independent?.rank<=2&&row.independent?.activeFamilies>=5&&row.independent?.activeRules>=5&&row.independent?.activeRecentHits>=8&&row.independent?.confluenceFamilies>=6&&row.target?.activeFamilies>=2&&row.position?.tieFamilies>=5
  ).sort((a,b)=>a.independent.rank-b.independent.rank||b.independent.activeFamilies-a.independent.activeFamilies||b.target.activeFamilies-a.target.activeFamilies||a.digit-b.digit);
  if(coverageCandidates.length!==1)return null;const coverageCandidate=coverageCandidates[0];
  const boundaryDigit=formulaLadder.six[5],boundary={digit:boundaryDigit,target:target.get(boundaryDigit),independent:independent.get(boundaryDigit),position:position.get(boundaryDigit)};
  if(formulaLadder.five.includes(boundaryDigit)||boundary.position?.activeFamilies<1||boundary.target?.tieFamilies<3)return null;
  const independentSix=new Set(independentLattice.six),fiveRows=formulaLadder.five.map((digit,index)=>({digit,originalRank:index+1,target:target.get(digit),independent:independent.get(digit),position:position.get(digit)}));
  const victimPool=fiveRows.filter(row=>!independentSix.has(row.digit)&&row.digit!==targetCandidate.digit&&row.digit!==coverageCandidate.digit).sort(compareDualRouteVictim);
  if(victimPool.length<3)return null;
  const victims=victimPool.slice(0,2);
  if(victims.some(row=>dualRouteCombinedBreadth(row)>8||(row.target?.activeFamilies||0)>2||(row.independent?.activeFamilies||0)>4)||dualRouteCombinedBreadth(victimPool[2])<dualRouteCombinedBreadth(victims[1])+2)return null;
  const victimSet=new Set(victims.map(row=>row.digit)),survivors=fiveRows.filter(row=>!victimSet.has(row.digit)).sort(compareDualRouteSurvivor);
  if(survivors.length!==3)return null;
  const four=[...survivors.map(row=>row.digit),targetCandidate.digit],five=[...four,coverageCandidate.digit],six=[...five,boundaryDigit];
  if(new Set(four).size!==4||new Set(five).size!==5||new Set(six).size!==6)return null;
  return {four,five,six,targetCandidate,coverageCandidate,boundary,victims,survivors,priorFour:formulaLadder.four.slice(),priorFive:formulaLadder.five.slice(),priorSix:formulaLadder.six.slice(),latestTargetDigits:ledger.latestTarget.digits,targetTransitions:ledger.transitions.length,mode:'dual-route-digit-coverage-recovery',modeLabel:'Dual-Route Digit-Coverage Recovery'};
}
function buildStrongWinCounterRouteHedgeRecovery(rows,targetDay,formulaLadder,positionLadder,independentLattice,routeDecision,profileRuns,historyConditioned,crossRouteConcentration,targetDayBridge,nearTieTargetCoverage,replayKCounterRouteGuard,dualRouteDigitCoverageRecovery){
  const replay=routeDecision?.replay;
  if(routeDecision?.cause!=='position'||routeDecision?.structural||routeDecision?.replayValidated||historyConditioned||crossRouteConcentration||targetDayBridge||nearTieTargetCoverage||replayKCounterRouteGuard||dualRouteDigitCoverageRecovery||formulaLadder.mode!=='position-coverage'||positionLadder.positionBridgeApplied||!replay||replay.position.tests<7||routeDecision.overlap!==2||replay.position.four<replay.independent.four+.14||replay.position.score<replay.independent.score+.10||replay.independent.six<replay.position.six+.025)return null;
  const ledger=buildTargetDayRecurrenceLedger(rows,targetDay);if(!ledger||ledger.transitions.length<8)return null;
  const rankedMap=items=>new Map(items.map((row,index)=>[row.digit,{...row,rank:index+1}]));
  const target=rankedMap(ledger.evidence),independent=rankedMap(independentLattice.anchors),echoes=rankedMap(independentLattice.echoes),position=rankedMap(positionLadder.evidence);
  const hedge=buildFormulaHedge(profileRuns,formulaLadder.five,positionLadder.positionLedger),hedgeEvidence=rankedMap(hedge.evidence),primary=new Set(formulaLadder.six),positionSix=new Set(positionLadder.six),independentSix=new Set(independentLattice.six);
  if(!formulaLadder.four.every(digit=>independentSix.has(digit)))return null;
  const counterCandidates=independentLattice.four.filter(digit=>!primary.has(digit)).map(digit=>({digit,target:target.get(digit),independent:independent.get(digit),echo:echoes.get(digit),position:position.get(digit)})).filter(row=>
    row.target?.rank<=4&&row.target?.activeFamilies>=4&&row.target?.activeRules>=5&&row.target?.activeRecentHits>=8&&row.target?.maxPositionCount>=2&&
    row.echo?.rank<=3&&row.echo?.tieFamilies>=3&&row.echo?.tieRecentHits>=5&&row.echo?.confluenceFamilies>=6&&
    row.position?.activeProfiles>=1&&row.position?.tieFamilies>=3
  );
  if(counterCandidates.length!==1)return null;const counterCandidate=counterCandidates[0];
  const hedgeCandidates=hedge.alternatives.filter(digit=>!positionSix.has(digit)&&!independentSix.has(digit)).map(digit=>({digit,target:target.get(digit),independent:independent.get(digit),position:position.get(digit),hedge:hedgeEvidence.get(digit)})).filter(row=>
    row.hedge?.tieProfiles>=3&&row.hedge?.tiePositions>=3&&row.hedge?.tieFamilies>=4&&row.hedge?.tieRules>=12&&row.hedge?.runnerPlacements>=10&&
    row.target?.activeFamilies>=3&&row.target?.activeRules>=3&&row.target?.tieFamilies>=3&&
    row.independent?.activeFamilies>=3&&row.independent?.confluenceFamilies>=5&&
    row.position?.activeProfiles===0&&row.position?.tieFamilies>=4
  );
  if(hedgeCandidates.length!==1)return null;const hedgeCandidate=hedgeCandidates[0];
  const four=formulaLadder.four.slice(),five=[...four,counterCandidate.digit],six=[...five,hedgeCandidate.digit];
  if(new Set(four).size!==4||new Set(five).size!==5||new Set(six).size!==6)return null;
  return {four,five,six,counterCandidate,hedgeCandidate,displacedDigits:formulaLadder.six.filter(digit=>!six.includes(digit)),priorFour:formulaLadder.four.slice(),priorFive:formulaLadder.five.slice(),priorSix:formulaLadder.six.slice(),latestTargetDigits:ledger.latestTarget.digits,targetTransitions:ledger.transitions.length,mode:'strong-win-counter-route-hedge',modeLabel:'Strong-Win Counter-Route Hedge Recovery'};
}
function compareNearParityReserve(a,b){
  return (b.position?.activeProfiles||0)-(a.position?.activeProfiles||0)||
    (b.position?.activeFamilies||0)-(a.position?.activeFamilies||0)||
    (b.independent?.activeFamilies||0)-(a.independent?.activeFamilies||0)||
    (b.target?.activeFamilies||0)-(a.target?.activeFamilies||0)||
    a.originalRank-b.originalRank||a.digit-b.digit;
}
function buildNearParitySparseOverlapRecovery(rows,targetDay,formulaLadder,positionLadder,independentLattice,routeDecision,profileRuns,historyConditioned,crossRouteConcentration,targetDayBridge,nearTieTargetCoverage,replayKCounterRouteGuard,dualRouteDigitCoverageRecovery,strongWinCounterRouteHedgeRecovery){
  const replay=routeDecision?.replay;
  if(routeDecision?.cause!=='position'||routeDecision?.structural||routeDecision?.replayValidated||historyConditioned||crossRouteConcentration||targetDayBridge||nearTieTargetCoverage||replayKCounterRouteGuard||dualRouteDigitCoverageRecovery||strongWinCounterRouteHedgeRecovery||formulaLadder.mode!=='position-coverage'||positionLadder.positionBridgeApplied||!replay||replay.position.tests<6||routeDecision.overlap!==1||Math.abs(replay.position.four-replay.independent.four)>.01||replay.position.score<replay.independent.score||replay.position.score>replay.independent.score+.03||Math.abs(replay.position.six-replay.independent.six)>.01)return null;
  const ledger=buildTargetDayRecurrenceLedger(rows,targetDay);if(!ledger||ledger.transitions.length<6)return null;
  const rankedMap=items=>new Map(items.map((row,index)=>[row.digit,{...row,rank:index+1}]));
  const target=rankedMap(ledger.evidence),independent=rankedMap(independentLattice.anchors),echoes=rankedMap(independentLattice.echoes),position=rankedMap(positionLadder.evidence);
  const hedge=buildFormulaHedge(profileRuns,formulaLadder.five,positionLadder.positionLedger),hedgeEvidence=rankedMap(hedge.evidence),latestTarget=new Set(ledger.latestTarget.digits),primary=new Set(formulaLadder.six),independentSix=new Set(independentLattice.six),routeUnion=new Set([...primary,...independentSix]);
  const shared=formulaLadder.six.filter(digit=>independentSix.has(digit));if(shared.length!==3)return null;
  const coverageCandidates=independentLattice.four.filter(digit=>!primary.has(digit)&&latestTarget.has(digit)).map(digit=>({digit,target:target.get(digit),independent:independent.get(digit),echo:echoes.get(digit),position:position.get(digit),hedge:hedgeEvidence.get(digit)})).filter(row=>
    row.target?.activeFamilies>=2&&row.target?.activeRules>=2&&row.target?.activeRecentHits>=4&&
    row.independent?.activeFamilies>=3&&row.independent?.activeRules>=3&&row.independent?.activeRecentHits>=6&&row.independent?.confluenceFamilies>=7&&
    row.echo?.rank<=3&&row.position?.activeProfiles>=1&&row.position?.tieFamilies>=5&&
    row.hedge?.tieProfiles>=3&&row.hedge?.tiePositions>=4&&row.hedge?.tieFamilies>=5&&row.hedge?.runnerPlacements>=12
  );
  if(coverageCandidates.length!==1)return null;const coverageCandidate=coverageCandidates[0];
  const outsideUnion=DIGITS.filter(digit=>!routeUnion.has(digit));if(outsideUnion.length!==1||!latestTarget.has(outsideUnion[0]))return null;
  const continuityDigit=outsideUnion[0],continuityCandidate={digit:continuityDigit,target:target.get(continuityDigit),independent:independent.get(continuityDigit),echo:echoes.get(continuityDigit),position:position.get(continuityDigit),hedge:hedgeEvidence.get(continuityDigit)};
  if(continuityCandidate.target?.activeFamilies<3||continuityCandidate.target?.activeRules<3||continuityCandidate.target?.activeRecentHits<4||continuityCandidate.target?.tieFamilies<3||continuityCandidate.target?.maxPositionCount<2||continuityCandidate.echo?.rank>4||continuityCandidate.echo?.tieFamilies<3||continuityCandidate.echo?.tieRecentHits<5||continuityCandidate.echo?.confluenceFamilies<6||continuityCandidate.position?.activeProfiles<1||continuityCandidate.position?.activePositions<1)return null;
  const reserveCandidates=formulaLadder.six.filter(digit=>!shared.includes(digit)).map(digit=>({digit,originalRank:formulaLadder.six.indexOf(digit)+1,target:target.get(digit),independent:independent.get(digit),position:position.get(digit)})).sort(compareNearParityReserve),reserve=reserveCandidates[0];
  if(!reserve||reserve.position?.activeProfiles<4||reserve.position?.activePositions<2||reserve.independent?.activeFamilies<3||reserve.target?.activeFamilies<3)return null;
  const four=[...shared,coverageCandidate.digit],five=[...four,continuityCandidate.digit],six=[...five,reserve.digit];
  if(new Set(four).size!==4||new Set(five).size!==5||new Set(six).size!==6)return null;
  return {four,five,six,sharedDigits:shared,coverageCandidate,continuityCandidate,reserve,displacedDigits:formulaLadder.six.filter(digit=>!six.includes(digit)),priorFour:formulaLadder.four.slice(),priorFive:formulaLadder.five.slice(),priorSix:formulaLadder.six.slice(),latestTargetDigits:ledger.latestTarget.digits,targetTransitions:ledger.transitions.length,mode:'near-parity-sparse-overlap-recovery',modeLabel:'Near-Parity Sparse-Overlap Recovery'};
}
function needsIndependentRelationRoute(positionLadder){
  const leaders=positionLadder.evidence.slice(0,2),families=sum(leaders.map(x=>x.activeFamilies)),rules=sum(leaders.map(x=>x.activeRules));
  const leaderBreadth=leaders[0]?.activePositions||0;
  return families>0&&leaderBreadth<=2&&4*rules>=9*families;
}
function formulaRouteRecall(ladder,actual){
  const target=new Set(actual),n=Math.max(1,target.size),read=pool=>pool.filter(d=>target.has(d)).length/n;
  return {four:read(ladder.four),five:read(ladder.five),six:read(ladder.six)};
}
function weightedRouteReplay(rows){
  const sourceDay=rows[0]?.day||'',targetDay=inferTargetDay(rows),chrono=rows.slice().reverse(),position=[],independent=[];
  for(let i=11;i<chrono.length-1;i++){
    if(chrono[i].day!==sourceDay||chrono[i+1].day!==targetDay)continue;
    const history=chrono.slice(0,i+1).reverse();if(inferTargetDay(history)!==targetDay)continue;
    const runs=LOCAL_PROFILES.map(profile=>buildFormulaRelationRun(history,profile)),p=buildFormulaEvidenceLadder(runs),q=buildIndependentRelationLattice(runs,p),actual=chrono[i+1].digits;
    position.push(formulaRouteRecall(p,actual));independent.push(formulaRouteRecall(q,actual));
  }
  const summarize=records=>{
    if(!records.length)return {tests:0,four:0,five:0,six:0,score:0};
    let four=0,five=0,six=0,weightSum=0;
    records.forEach((row,i)=>{const weight=.72+.56*(i+1)/records.length;four+=weight*row.four;five+=weight*row.five;six+=weight*row.six;weightSum+=weight;});
    four/=weightSum;five/=weightSum;six/=weightSum;
    return {tests:records.length,four,five,six,score:.58*four+.27*five+.15*six};
  };
  return {sourceDay,targetDay,position:summarize(position),independent:summarize(independent)};
}
function chooseFormulaRoute(rows,positionLadder,independentLattice){
  const structural=needsIndependentRelationRoute(positionLadder),replay=weightedRouteReplay(rows),overlap=positionLadder.four.filter(d=>independentLattice.four.includes(d)).length;
  const replayValidated=replay.independent.tests>=6&&overlap>=2&&replay.independent.four>=replay.position.four+.08&&replay.independent.score>=replay.position.score+.035;
  return {useIndependent:structural||replayValidated,cause:structural?'structural':replayValidated?'replay':'position',structural,replayValidated,overlap,replay};
}
function compareHedgeEvidence(a,b){
  return b.tieProfiles-a.tieProfiles||b.tiePositions-a.tiePositions||b.tieFamilies-a.tieFamilies||b.tieRules-a.tieRules||b.runnerPlacements-a.runnerPlacements||b.runnerPoints-a.runnerPoints||a.digit-b.digit;
}
function buildWeakPositionTieSeat(profileRuns,strongFive){
  const primary=new Set(strongFive),candidates=[];
  DIGITS.forEach(digit=>{
    if(primary.has(digit))return;
    for(let p=0;p<4;p++){
      const tieFamilies=new Set(),tieRules=new Set(),activeFamilies=new Set(),activeRules=new Set(),tieProfiles=new Set();
      profileRuns.forEach(run=>{
        let profileTie=false;
        run.model.byPosition[p].forEach(formula=>{
          if(formula.digit!==digit)return;
          if(formula.status==='TIE'){profileTie=true;tieFamilies.add(formula.family);tieRules.add(formula.id);}
          else if(formula.status==='ACTIVE'){activeFamilies.add(formula.family);activeRules.add(formula.id);}
        });
        if(profileTie)tieProfiles.add(run.profile.id);
      });
      if(tieFamilies.size>=2&&activeFamilies.size>=1)candidates.push({digit,position:p,positionLabel:POS[p],tieFamilies:tieFamilies.size,tieRules:tieRules.size,tieProfiles:tieProfiles.size,activeFamilies:activeFamilies.size,activeRules:activeRules.size});
    }
  });
  candidates.sort((a,b)=>b.tieFamilies-a.tieFamilies||b.tieRules-a.tieRules||b.tieProfiles-a.tieProfiles||a.activeFamilies-b.activeFamilies||a.digit-b.digit||a.position-b.position);
  return candidates[0]||null;
}
function buildFormulaHedge(profileRuns,strongFive,positionLedger,options={}){
  const primary=new Set(strongFive),evidence=DIGITS.map(digit=>{
    const profiles=new Set(),positions=new Set(),families=new Set(),rules=new Set();let runnerPlacements=0,runnerPoints=0;
    profileRuns.forEach(run=>{
      let profileTie=false;
      for(let p=0;p<4;p++){
        run.model.byPosition[p].forEach(f=>{if(f.digit===digit&&f.status==='TIE'){profileTie=true;positions.add(p);families.add(`${p}|${f.family}`);rules.add(`${run.profile.id}|${p}|${f.id}`);}});
        const idx=run.posRank[p].findIndex(x=>x.digit===digit);
        if(idx>=2&&idx<7){runnerPlacements++;runnerPoints+=7-idx;}
      }
      if(profileTie)profiles.add(run.profile.id);
    });
    return {digit,tieProfiles:profiles.size,tiePositions:positions.size,tieFamilies:families.size,tieRules:rules.size,runnerPlacements,runnerPoints};
  });
  const bridge=evidence.filter(x=>primary.has(x.digit)).sort(compareHedgeEvidence).slice(0,2);
  const positionalAlternatives=DIGITS.filter(d=>!primary.has(d)).map(digit=>positionLedger.ranks.map(rows=>rows.find(x=>x.digit===digit)).sort(comparePositionEvidence)[0]).sort(comparePositionEvidence);
  const weakTieSeat=options.enableWeakTieSeat?buildWeakPositionTieSeat(profileRuns,strongFive):null,alternativeDigits=[];
  [weakTieSeat?.digit,...positionalAlternatives.map(x=>x.digit)].forEach(digit=>{if(Number.isInteger(digit)&&!primary.has(digit)&&!alternativeDigits.includes(digit)&&alternativeDigits.length<3)alternativeDigits.push(digit);});
  const alternatives=alternativeDigits.map(digit=>evidence.find(row=>row.digit===digit));
  const selected=[...bridge,...alternatives].sort(compareHedgeEvidence);
  return {digits:selected.map(x=>x.digit),bridge:bridge.map(x=>x.digit),alternatives:alternatives.map(x=>x.digit),weakTieSeat,evidence:evidence.sort(compareHedgeEvidence)};
}
function buildCounterRouteHedge(profileRuns,strongFive,positionLadder,baseHedge){
  const counter=buildFormulaHedge(profileRuns,positionLadder.five,positionLadder.positionLedger),primary=new Set(strongFive),alternatives=[];
  [...counter.alternatives,...baseHedge.alternatives].forEach(digit=>{if(!primary.has(digit)&&!alternatives.includes(digit)&&alternatives.length<3)alternatives.push(digit);});
  return {...baseHedge,alternatives,digits:[...baseHedge.bridge,...alternatives],counterRoute:true,counterMode:positionLadder.modeLabel};
}
function applyTargetDayHedgeBridge(secondary,priorSecondary,strongFive,finalSix,targetDayBridge){
  if(!targetDayBridge||!['duplicate-source-target','dominant-target-anchor'].includes(targetDayBridge.bridgeKind))return secondary;
  const primary=new Set(strongFive),covered=new Set(finalSix),alternatives=[];
  [...(targetDayBridge.targetReserveDigits||[]),...(targetDayBridge.preservePriorHedge?priorSecondary?.alternatives||[]:[]),...(secondary.alternatives||[])].forEach(digit=>{if(Number.isInteger(digit)&&!primary.has(digit)&&!covered.has(digit)&&!alternatives.includes(digit)&&alternatives.length<3)alternatives.push(digit);});
  if(alternatives.length<3)return secondary;
  return {...secondary,alternatives,digits:[...secondary.bridge,...alternatives],targetDayReserve:(targetDayBridge.targetReserveDigits||[]).filter(digit=>alternatives.includes(digit)),priorRoutePreserved:targetDayBridge.preservePriorHedge};
}
function buildPairBalanceBoundarySeat(core,profileRuns,strongFive){
  const recent=profileRuns.find(run=>run.profile.id==='recent-local');if(!recent)return null;
  const primary=new Set(strongFive),transitions=core.transitions||[],n=transitions.length,cut=Math.floor(n/2),candidates=[];
  if(n<7)return null;
  DIGITS.forEach(digit=>{
    if(primary.has(digit))return;
    const rankRows=recent.posRank.map(rows=>{const index=rows.findIndex(x=>x.digit===digit);return {rank:index+1,row:rows[index]};}),ranks=rankRows.map(x=>x.rank),supportedPositions=rankRows.filter(x=>x.row&&x.row.score>0).length,topThreePlacements=rankRows.filter(x=>x.row&&x.row.score>0&&x.rank<=3).length;
    const activePositions=recent.model.byPosition.filter(rows=>rows.some(f=>f.digit===digit&&f.status==='ACTIVE')).length;
    const activeFamilies=recent.model.byPosition.reduce((total,rows)=>total+new Set(rows.filter(f=>f.digit===digit&&f.status==='ACTIVE').map(f=>f.family)).size,0);
    if(supportedPositions<2||activePositions<2||activeFamilies<2)return;
    pairBalanceFormulaLibrary().forEach(formula=>{
      if(formula.fn(core.latest.digits)!==digit)return;
      const hitIndexes=[],positionHits=[0,0,0,0];
      transitions.forEach((tr,i)=>{const predicted=formula.fn(tr.source.digits);if(new Set(tr.target.digits).has(predicted))hitIndexes.push(i);for(let p=0;p<4;p++)if(tr.target.digits[p]===predicted)positionHits[p]++;});
      const hits=hitIndexes.length,recentHits=hitIndexes.filter(i=>i>=cut).length,hitBands=new Set(hitIndexes.map(i=>Math.min(2,Math.floor(3*i/n)))).size,exactBreadth=positionHits.filter(h=>h>=2).length;
      if(hits>=5&&recentHits>=2&&hitBands>=2&&exactBreadth>=2)candidates.push({digit,formulaId:formula.id,formulaLabel:formula.label,trials:n,hits,recentHits,hitBands,exactBreadth,supportedPositions,topThreePlacements,activePositions,activeFamilies,ranks});
    });
  });
  candidates.sort((a,b)=>b.hits-a.hits||b.exactBreadth-a.exactBreadth||b.recentHits-a.recentHits||b.hitBands-a.hitBands||b.activePositions-a.activePositions||a.digit-b.digit);
  return candidates[0]||null;
}
function promotePairBalanceCore(formulaLadder,boundarySeat,positionLadder,independentLattice){
  if(!boundarySeat)return null;
  const c=boundarySeat;
  const fullGate=c.exactBreadth>=3&&c.hits>=Math.ceil(2*c.trials/3)&&c.recentHits>=3&&c.hitBands>=3&&c.supportedPositions>=2&&c.activePositions>=2&&c.activeFamilies>=2;
  if(!fullGate)return null;
  const byDigit=new Map(positionLadder.evidence.map(row=>[row.digit,row])),candidateEvidence=byDigit.get(c.digit);
  const coreEvidence=formulaLadder.four.map(digit=>byDigit.get(digit)).filter(Boolean).sort(compareFormulaEvidence),weakest=coreEvidence.at(-1);
  if(!candidateEvidence||!weakest||candidateEvidence.activeProfiles<weakest.activeProfiles||candidateEvidence.activePositions<weakest.activePositions||candidateEvidence.activeFamilies<weakest.activeFamilies)return null;
  const four=formulaLadder.four.map(digit=>digit===weakest.digit?c.digit:digit),anchorOrder=independentLattice.anchors.map(row=>row.digit),remaining=anchorOrder.filter(digit=>!four.includes(digit));
  if(remaining.length<2)return null;
  const five=[...four,remaining[0]],six=[...five,remaining[1]];
  return {digit:c.digit,replacedDigit:weakest.digit,four,five,six,formulaId:c.formulaId,formulaLabel:c.formulaLabel,reason:'full-depth-pair-balance'};
}
function buildPrediction(inputRows){
  const market=inputRows[0]?.code||'',rows=inputRows.filter(r=>!market||r.code===market),profileRuns=LOCAL_PROFILES.map(p=>buildFormulaRelationRun(rows,p));
  const selectedCore=profileRuns.find(r=>r.profile.id==='formula-first')||profileRuns[0];
  const positionLadder=buildFormulaEvidenceLadder(profileRuns),independentLattice=buildIndependentRelationLattice(profileRuns,positionLadder),routeDecision=chooseFormulaRoute(rows,positionLadder,independentLattice),useIndependent=routeDecision.useIndependent;
  let formulaLadder=useIndependent?independentLattice:positionLadder,weakSixSeat=null,boundarySeat=null,corePromotion=null,historyConditioned=null,crossRouteConcentration=null,targetDayBridge=null,nearTieTargetCoverage=null,replayKCounterRouteGuard=null,replayIndependentTargetCarryTwinRecovery=null,dualRouteDigitCoverageRecovery=null,strongWinCounterRouteHedgeRecovery=null,nearParitySparseOverlapRecovery=null;
  if(routeDecision.replayValidated){
    formulaLadder={...independentLattice,mode:'replay-independent',modeLabel:'Replay-Validated Independent Route',routeNote:'Replay lokal pada pasangan hari yang sama memilih keluarga independen hanya setelah enam uji, keunggulan 4D, dan irisan inti lolos bersama. Nama market tidak ikut mengambil keputusan.'};
  }else if(routeDecision.structural){
    historyConditioned=buildHistoryConditionedIndependentLadder(selectedCore,independentLattice,positionLadder);
    if(historyConditioned)formulaLadder=historyConditioned;
  }else if(!useIndependent&&positionLadder.positionBridgeApplied){
    weakSixSeat=buildWeakPositionTieSeat(profileRuns,formulaLadder.five);
    if(weakSixSeat&&!formulaLadder.five.includes(weakSixSeat.digit))formulaLadder={...formulaLadder,six:[...formulaLadder.five,weakSixSeat.digit],sixSeat:weakSixSeat,routeNote:'Breadth tiga posisi mengisi kursi kelima. Satu TIE posisi lemah yang masih memiliki keluarga ACTIVE mengisi kursi keenam; 5D dan 4D tidak diubah.'};
  }
  if(useIndependent&&!historyConditioned){
    boundarySeat=buildPairBalanceBoundarySeat(selectedCore,profileRuns,formulaLadder.five);
    corePromotion=promotePairBalanceCore(formulaLadder,boundarySeat,positionLadder,independentLattice);
    if(corePromotion)formulaLadder={...formulaLadder,six:corePromotion.six,five:corePromotion.five,four:corePromotion.four,boundarySeat,corePromotion,routeNote:`${formulaLadder.routeNote} Pair-balance full-depth, sebaran tiga posisi, dan resurgence terbaru lolos bersama; digit ${corePromotion.digit} dipromosikan ke inti dan digit ${corePromotion.replacedDigit} turun ke batas 6D.`};
    else if(boundarySeat&&boundarySeat.digit!==formulaLadder.six[5])formulaLadder={...formulaLadder,six:[...formulaLadder.five,boundarySeat.digit],boundarySeat,routeNote:`${formulaLadder.routeNote} Pair-balance lintas empat posisi dan resurgence lokal lolos bersama untuk kursi keenam; 5D, 4D, dan kembar tidak berubah.`};
  }
  crossRouteConcentration=buildCrossRouteConcentrationLadder(formulaLadder,positionLadder,independentLattice,routeDecision,historyConditioned);
  if(crossRouteConcentration)formulaLadder=crossRouteConcentration;
  const preTargetSecondary=buildFormulaHedge(profileRuns,formulaLadder.five,positionLadder.positionLedger,{enableWeakTieSeat:!useIndependent&&positionLadder.positionBridgeApplied});
  if(!crossRouteConcentration)targetDayBridge=buildTargetDayRecurrenceBridge(rows,selectedCore.targetDay,formulaLadder,positionLadder,useIndependent);
  if(!targetDayBridge&&!useIndependent)targetDayBridge=buildDuplicateSourceTargetDayBridge(rows,selectedCore.targetDay,formulaLadder,positionLadder,useIndependent);
  if(!targetDayBridge&&!useIndependent)targetDayBridge=buildDominantTargetDayBridge(rows,selectedCore.targetDay,formulaLadder,positionLadder,independentLattice,useIndependent);
  if(!targetDayBridge&&!useIndependent)targetDayBridge=buildMiddlePositionTargetDayRecovery(rows,selectedCore.targetDay,formulaLadder,positionLadder,independentLattice,routeDecision,historyConditioned,crossRouteConcentration);
  if(!targetDayBridge&&useIndependent)targetDayBridge=buildStructuralTargetDayCoreBridge(rows,selectedCore.targetDay,formulaLadder,positionLadder,independentLattice,routeDecision,historyConditioned);
  if(!targetDayBridge&&useIndependent)targetDayBridge=buildSplitEvidenceRepeatPositionBridge(rows,selectedCore.targetDay,formulaLadder,positionLadder,independentLattice,routeDecision,historyConditioned);
  if(!targetDayBridge&&useIndependent)targetDayBridge=buildStructuralTargetDayAnchorRestoration(rows,selectedCore.targetDay,formulaLadder,positionLadder,independentLattice,routeDecision,historyConditioned,crossRouteConcentration);
  if(!targetDayBridge&&useIndependent)targetDayBridge=buildStructuralReplayLossRecovery(rows,selectedCore.targetDay,formulaLadder,positionLadder,independentLattice,routeDecision,historyConditioned,crossRouteConcentration);
  if(!targetDayBridge&&!useIndependent)nearTieTargetCoverage=buildNearTieTargetCoverage(rows,selectedCore.targetDay,formulaLadder,positionLadder,independentLattice,routeDecision,selectedCore.latest,targetDayBridge,crossRouteConcentration,historyConditioned);
  if(nearTieTargetCoverage)formulaLadder=nearTieTargetCoverage;
  if(!targetDayBridge&&useIndependent)replayKCounterRouteGuard=buildReplayKCounterRouteGuard(rows,selectedCore.targetDay,formulaLadder,positionLadder,independentLattice,routeDecision,historyConditioned,crossRouteConcentration,targetDayBridge,nearTieTargetCoverage);
  if(replayKCounterRouteGuard)formulaLadder={...formulaLadder,six:replayKCounterRouteGuard.six,five:replayKCounterRouteGuard.five,four:replayKCounterRouteGuard.four,replayKCounterRouteGuard,mode:replayKCounterRouteGuard.mode,modeLabel:replayKCounterRouteGuard.modeLabel,routeNote:`${formulaLadder.routeNote} Rute independen tetap menang replay, tetapi hanya dua digit beririsan dengan rute posisi. Pemimpin K yang ACTIVE pada seluruh profil, berada di inti posisi, dan mempunyai recurrence A–K–L–E menjaga kursi keenam; digit keenam lama tanpa keluarga ACTIVE posisi dilepas.`};
  if(!targetDayBridge&&useIndependent&&!replayKCounterRouteGuard)replayIndependentTargetCarryTwinRecovery=buildReplayIndependentTargetCarryTwinRecovery(rows,selectedCore.targetDay,formulaLadder,positionLadder,independentLattice,routeDecision,profileRuns,historyConditioned,crossRouteConcentration,targetDayBridge,nearTieTargetCoverage,replayKCounterRouteGuard);
  if(replayIndependentTargetCarryTwinRecovery)formulaLadder={...formulaLadder,six:replayIndependentTargetCarryTwinRecovery.six,five:replayIndependentTargetCarryTwinRecovery.five,four:replayIndependentTargetCarryTwinRecovery.four,replayIndependentTargetCarryTwinRecovery,mode:replayIndependentTargetCarryTwinRecovery.mode,modeLabel:replayIndependentTargetCarryTwinRecovery.modeLabel,routeNote:`${formulaLadder.routeNote} Saat kemenangan replay independen sangat besar tetapi dua digit hasil target-day terakhir hilang dari 6D, dua digit persetujuan inti menjadi spine. Satu digit yang bertemu pada sumber, target-day, dan counter-route masuk 4D; satu carry target-day di luar gabungan rute masuk 5D; cadangan target-day terkuat menjaga kursi keenam.`};
  if(!targetDayBridge&&!useIndependent&&!nearTieTargetCoverage)dualRouteDigitCoverageRecovery=buildDualRouteDigitCoverageRecovery(rows,selectedCore.targetDay,formulaLadder,positionLadder,independentLattice,routeDecision,historyConditioned,crossRouteConcentration,targetDayBridge,nearTieTargetCoverage,replayKCounterRouteGuard);
  if(dualRouteDigitCoverageRecovery)formulaLadder={...formulaLadder,six:dualRouteDigitCoverageRecovery.six,five:dualRouteDigitCoverageRecovery.five,four:dualRouteDigitCoverageRecovery.four,dualRouteDigitCoverageRecovery,mode:dualRouteDigitCoverageRecovery.mode,modeLabel:dualRouteDigitCoverageRecovery.modeLabel,routeNote:`${formulaLadder.routeNote} Rute posisi menang pada 4D, tetapi irisan antarrute hanya satu digit dan rute independen unggul pada cakupan 6D. Satu anchor target-day serta satu anchor keluarga independen menggantikan dua digit 5D yang paling terkonsentrasi pada satu rute; kursi batas TIE tetap dijaga.`};
  if(!targetDayBridge&&!useIndependent&&!nearTieTargetCoverage&&!dualRouteDigitCoverageRecovery)strongWinCounterRouteHedgeRecovery=buildStrongWinCounterRouteHedgeRecovery(rows,selectedCore.targetDay,formulaLadder,positionLadder,independentLattice,routeDecision,profileRuns,historyConditioned,crossRouteConcentration,targetDayBridge,nearTieTargetCoverage,replayKCounterRouteGuard,dualRouteDigitCoverageRecovery);
  if(strongWinCounterRouteHedgeRecovery)formulaLadder={...formulaLadder,six:strongWinCounterRouteHedgeRecovery.six,five:strongWinCounterRouteHedgeRecovery.five,four:strongWinCounterRouteHedgeRecovery.four,strongWinCounterRouteHedgeRecovery,mode:strongWinCounterRouteHedgeRecovery.mode,modeLabel:strongWinCounterRouteHedgeRecovery.modeLabel,routeNote:`${formulaLadder.routeNote} Rute posisi tetap menang kuat dan empat digit intinya dipertahankan sebagai spine. Karena rute independen unggul pada cakupan 6D, satu echo counter-route yang tervalidasi target-day mengisi kursi kelima; satu cadangan TIE lintas-profil di luar gabungan dua rute menjaga kursi keenam.`};
  if(!targetDayBridge&&!useIndependent&&!nearTieTargetCoverage&&!dualRouteDigitCoverageRecovery&&!strongWinCounterRouteHedgeRecovery)nearParitySparseOverlapRecovery=buildNearParitySparseOverlapRecovery(rows,selectedCore.targetDay,formulaLadder,positionLadder,independentLattice,routeDecision,profileRuns,historyConditioned,crossRouteConcentration,targetDayBridge,nearTieTargetCoverage,replayKCounterRouteGuard,dualRouteDigitCoverageRecovery,strongWinCounterRouteHedgeRecovery);
  if(nearParitySparseOverlapRecovery)formulaLadder={...formulaLadder,six:nearParitySparseOverlapRecovery.six,five:nearParitySparseOverlapRecovery.five,four:nearParitySparseOverlapRecovery.four,nearParitySparseOverlapRecovery,mode:nearParitySparseOverlapRecovery.mode,modeLabel:nearParitySparseOverlapRecovery.modeLabel,routeNote:`${formulaLadder.routeNote} Replay posisi dan independen nyaris seri, sementara irisan inti hanya satu digit. Tiga digit yang disepakati kedua 6D menjadi spine; satu anchor cakupan independen masuk 4D, satu-satunya digit di luar gabungan dua rute yang lolos kontinuitas target-day masuk 5D, dan cadangan utama terkuat menjaga kursi keenam.`};
  if(targetDayBridge?.twinStrategy==='source-continuity'){
    const priorCore={...selectedCore,finalDigits:formulaLadder.six,strongFive:formulaLadder.five,strongFour:formulaLadder.four,formulaLadder};
    const priorTwin=buildIndependentTwinPortfolio(priorCore);
    targetDayBridge.priorTwinDigits=priorTwin.choices.map(row=>row.digit);
  }
  if(targetDayBridge){
    const bridgeNote=targetDayBridge.bridgeKind==='structural-core'
      ?`Rantai ${selectedCore.targetDay}→${selectedCore.targetDay}, keluarga independen lintas-riwayat, dan breadth posisi menyepakati ${targetDayBridge.candidateDigit}; digit ${targetDayBridge.replacedDigit} turun hanya dari 4D, sedangkan himpunan 5D tetap.`
      :targetDayBridge.bridgeKind==='split-evidence-repeat-position'
        ?`Digit ${targetDayBridge.candidateDigit} kuat pada keluarga independen dan menetap pada satu posisi ${selectedCore.targetDay}, tetapi buktinya terbelah antara ACTIVE dan TIE target-day. Digit tersebut naik dari batas 6D ke inti; ${targetDayBridge.replacedDigit} tetap dijaga di 5D.`
      :targetDayBridge.bridgeKind==='structural-replay-loss-recovery'
        ?`Structural override kalah tajam pada replay lokal sehingga lima digit dipusatkan ulang: spine lintas-rute ${targetDayBridge.spineDigits.join(' ')} dipertahankan, anchor target-day ${targetDayBridge.candidateDigit} masuk 4D, dan counter-route ${targetDayBridge.counterDigit} masuk 5D.`
      :targetDayBridge.bridgeKind==='structural-target-anchor-restoration'
        ?targetDayBridge.boundaryRetention
          ?`Pemimpin ACTIVE rantai ${selectedCore.targetDay} juga lolos sebagai anchor keluarga independen, tetapi terbuang oleh echo TIE. Anchor ${targetDayBridge.candidateDigit} dipulihkan ke inti dan echo ${targetDayBridge.replacedDigit} dilepas. Retensi batas 5D membandingkan ACTIVE target-day dan posisi; ${targetDayBridge.boundaryRetention.digit} mengungguli ${targetDayBridge.boundaryRetention.displacedDigit} untuk kursi kelima, sedangkan ${targetDayBridge.boundaryRetention.displacedDigit} tetap dijaga di 6D.`
          :`Pemimpin ACTIVE rantai ${selectedCore.targetDay} juga lolos sebagai anchor keluarga independen, tetapi terbuang oleh echo TIE. Anchor ${targetDayBridge.candidateDigit} dipulihkan ke inti dan echo ${targetDayBridge.replacedDigit} dilepas tanpa mengubah lima digit lain yang sudah dijaga.`
      :targetDayBridge.bridgeKind==='target-day-middle-position-recovery'
        ?`Pemimpin ACTIVE rantai ${selectedCore.targetDay} berada di luar 6D meskipun membawa ${targetDayBridge.targetEvidence.activeFamilies} keluarga target-day dan saksi TIE pada posisi K. Anchor ${targetDayBridge.candidateDigit} menggantikan carry sumber ${targetDayBridge.replacedDigit} di inti; digit yang diganti tetap dipertahankan pada kursi keenam.`
      :targetDayBridge.bridgeKind==='duplicate-source-target'
        ?`Digit berulang ${targetDayBridge.candidateDigit} pada sumber terbaru juga membawa recurrence kuat pada rantai ${selectedCore.targetDay}; struktur sumber dan target-day harus lolos bersama sebelum digit masuk inti.`
        :targetDayBridge.bridgeKind==='dominant-target-anchor'
          ?`Pemimpin rantai ${selectedCore.targetDay}→${selectedCore.targetDay} membawa tujuh keluarga formula dan tetap mempunyai dukungan lintas-horizon; satu anchor target-day menggantikan digit inti yang paling lemah pada rantai tersebut.`
          :`Rantai ${selectedCore.targetDay}→${selectedCore.targetDay} memberi kandidat ${targetDayBridge.candidateDigit} melalui formula lintas-nilai dan recurrence posisi; kandidat menggantikan ${targetDayBridge.replacedDigit} pada inti tanpa memakai nama market.`;
    formulaLadder={...formulaLadder,six:targetDayBridge.six,five:targetDayBridge.five,four:targetDayBridge.four,targetDayBridge,mode:targetDayBridge.mode,modeLabel:targetDayBridge.modeLabel,routeNote:`${formulaLadder.routeNote} ${bridgeNote}`};
  }
  let secondary=buildFormulaHedge(profileRuns,formulaLadder.five,positionLadder.positionLedger,{enableWeakTieSeat:!useIndependent&&positionLadder.positionBridgeApplied});
  secondary=applyTargetDayHedgeBridge(secondary,preTargetSecondary,formulaLadder.five,formulaLadder.six,targetDayBridge);
  if(routeDecision.replayValidated)secondary=buildCounterRouteHedge(profileRuns,formulaLadder.six,positionLadder,secondary);
  const ak=buildPairs(selectedCore.posRank[0],selectedCore.posRank[1]),le=buildPairs(selectedCore.posRank[2],selectedCore.posRank[3]);
  const core={...selectedCore,finalDigits:formulaLadder.six,strongFive:formulaLadder.five,strongFour:formulaLadder.four,secondary,formulaLadder,ak,le};
  let twinPortfolio=routeDecision.structural?buildIndependentTwinPortfolio(core):buildTwinPortfolio(core,profileRuns);
  if(targetDayBridge)twinPortfolio=applyTargetDayTwinBridge(twinPortfolio,targetDayBridge);
  if(replayIndependentTargetCarryTwinRecovery)twinPortfolio=applyReplayTargetCarryTwin(twinPortfolio,replayIndependentTargetCarryTwinRecovery);
  return {...core,twinPortfolio,profileRuns,positionLadder,independentLattice,useIndependent,routeDecision,weakSixSeat,boundarySeat,corePromotion,historyConditioned,crossRouteConcentration,targetDayBridge,nearTieTargetCoverage,replayKCounterRouteGuard,replayIndependentTargetCarryTwinRecovery,dualRouteDigitCoverageRecovery,strongWinCounterRouteHedgeRecovery,nearParitySparseOverlapRecovery};
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

function compareTwinEvidence(a,b){
  return b.bestShape.pairedProfiles-a.bestShape.pairedProfiles||b.bestShape.topPairPlacements-a.bestShape.topPairPlacements||b.bestShape.activeFamilies-a.bestShape.activeFamilies||b.bestShape.activeRules-a.bestShape.activeRules||b.ladderEvidence.activeProfiles-a.ladderEvidence.activeProfiles||b.ladderEvidence.activePositions-a.ladderEvidence.activePositions||a.digit-b.digit;
}
function buildTwinPortfolio(core,profileRuns){
  const runs=profileRuns?.length?profileRuns:[core],coreFour=core.strongFour?.length===4?core.strongFour:core.finalDigits.slice(0,4),ladderRows=core.formulaLadder?.evidence||[];
  const pool=coreFour.map(digit=>{
    const shapes=TWIN_SHAPES.map(([p,q,label])=>{
      const profiles=new Set(),families=new Set(),rules=new Set(),tieFamilies=new Set();let topPairPlacements=0;
      runs.forEach(run=>{
        const left=run.model.byPosition[p].filter(f=>f.digit===digit&&f.status==='ACTIVE'),right=run.model.byPosition[q].filter(f=>f.digit===digit&&f.status==='ACTIVE');
        if(left.length&&right.length)profiles.add(run.profile.id);
        [...left,...right].forEach(f=>{families.add(`${f.family}`);rules.add(`${run.profile.id}|${f.id}`);});
        run.model.byPosition[p].filter(f=>f.digit===digit&&f.status==='TIE').forEach(f=>tieFamilies.add(f.family));
        run.model.byPosition[q].filter(f=>f.digit===digit&&f.status==='TIE').forEach(f=>tieFamilies.add(f.family));
        const lp=run.posRank[p].findIndex(x=>x.digit===digit),lq=run.posRank[q].findIndex(x=>x.digit===digit);
        if(lp>=0&&lp<3&&lq>=0&&lq<3)topPairPlacements++;
      });
      return {p,q,label,pairedProfiles:profiles.size,activeFamilies:families.size,activeRules:rules.size,tieFamilies:tieFamilies.size,topPairPlacements};
    }).sort((a,b)=>b.pairedProfiles-a.pairedProfiles||b.topPairPlacements-a.topPairPlacements||b.activeFamilies-a.activeFamilies||b.activeRules-a.activeRules||b.tieFamilies-a.tieFamilies||a.label.localeCompare(b.label));
    return {digit,bestShape:shapes[0],shapes,ladderEvidence:ladderRows.find(x=>x.digit===digit)||{activeProfiles:0,activePositions:0}};
  });
  const candidates=pool.slice().sort(compareTwinEvidence),choices=candidates.slice(0,2).map((x,i)=>({...x,pair:`${x.digit}${x.digit}`,choice:i+1}));
  return {pool,choices,digits:coreFour,candidates,state:'PENJAGAAN FORMULA'};
}
function applyReplayTargetCarryTwin(portfolio,recovery){
  const promoted=portfolio.pool.find(row=>row.digit===recovery?.sourceTargetCandidate?.digit),runner=portfolio.candidates.find(row=>row.digit!==recovery?.sourceTargetCandidate?.digit);
  if(!promoted||!runner)return portfolio;
  const choices=[promoted,runner].map((row,index)=>({...row,pair:`${row.digit}${row.digit}`,choice:index+1,sourceTargetContinuity:row.digit===promoted.digit}));
  return {...portfolio,choices,state:'PENJAGAAN SUMBER + TARGET-DAY'};
}
function applyTargetDayTwinBridge(portfolio,targetDayBridge){
  if(targetDayBridge.twinStrategy==='preserve')return portfolio;
  if(targetDayBridge.twinStrategy==='source-continuity'){
    const sourceSet=new Set(targetDayBridge.latestSourceDigits||[]),priorSet=new Set(targetDayBridge.priorTwinDigits||[]);
    const promoted=portfolio.pool.find(row=>row.digit===targetDayBridge.candidateDigit);
    const preserved=portfolio.candidates.find(row=>row.digit!==targetDayBridge.candidateDigit&&sourceSet.has(row.digit)&&priorSet.has(row.digit));
    if(!promoted||!preserved)return portfolio;
    const choices=[preserved,promoted].map((row,index)=>({...row,pair:`${row.digit}${row.digit}`,choice:index+1,sourceContinuity:row.digit===preserved.digit,repeatPosition:row.digit===promoted.digit,targetDayBridge:row.digit===promoted.digit}));
    return {...portfolio,choices,state:'PENJAGAAN SUMBER + REPEAT-POSITION'};
  }
  const promoted=portfolio.pool.find(row=>row.digit===targetDayBridge.candidateDigit);
  const runner=targetDayBridge.twinStrategy==='repeat-depth'
    ?portfolio.candidates.filter(row=>row.digit!==targetDayBridge.candidateDigit).sort((a,b)=>b.activeHits-a.activeHits||b.activeRules-a.activeRules||b.activeFamilies-a.activeFamilies||b.targetHits-a.targetHits||a.digit-b.digit)[0]
    :portfolio.candidates.find(row=>row.digit!==targetDayBridge.candidateDigit);
  if(!promoted||!runner)return portfolio;
  const choices=[promoted,runner].map((row,index)=>({...row,pair:`${row.digit}${row.digit}`,choice:index+1,targetDayBridge:row.digit===targetDayBridge.candidateDigit,repeatDepth:targetDayBridge.twinStrategy==='repeat-depth'&&row.digit===runner.digit}));
  return {...portfolio,choices,state:targetDayBridge.twinStrategy==='repeat-depth'?'PENJAGAAN TARGET-DAY + REPEAT-DEPTH':'PENJAGAAN DUAL-HORIZON'};
}
function allSequentialTransitions(rows){
  const chrono=rows.slice().reverse(),out=[];
  for(let i=0;i<chrono.length-1;i++)out.push({source:chrono[i],target:chrono[i+1],index:i});
  return out;
}
function repeatFormulaHit(formula,tr){
  const digit=formula.fn(tr.source.digits);
  return tr.target.digits.filter(x=>x===digit).length>=2;
}
function twinShapeEvidence(formulas,transitions,shapes){
  return shapes.map(([p,q,label])=>{
    const families=new Set(),events=new Set();
    formulas.forEach(formula=>transitions.forEach((tr,i)=>{
      const digit=formula.fn(tr.source.digits);
      if(tr.target.digits[p]===digit&&tr.target.digits[q]===digit){families.add(formula.family);events.add(i);}
    }));
    return {label,families:families.size,events:events.size};
  });
}
function compareIndependentTwin(a,b){
  return b.activeFamilies-a.activeFamilies||b.activeRules-a.activeRules||b.targetFamilies-a.targetFamilies||b.bestShape.targetFamilies-a.bestShape.targetFamilies||b.activeHits-a.activeHits||b.targetHits-a.targetHits||a.digit-b.digit;
}
function buildIndependentTwinPortfolio(core){
  const coreFour=core.strongFour.slice(0,4),broad=allSequentialTransitions(core.rows),target=core.transitions||[],formulas=formulaLibrary();
  const candidates=coreFour.map(digit=>{
    const current=formulas.filter(f=>f.fn(core.latest.digits)===digit),activeFamilySet=new Set(),targetFamilySet=new Set();let activeRules=0,activeHits=0,targetRules=0,targetHits=0;
    current.forEach(formula=>{
      const hitIndexes=[];broad.forEach((tr,i)=>{if(repeatFormulaHit(formula,tr))hitIndexes.push(i);});
      const hitBands=new Set(hitIndexes.map(i=>Math.min(2,Math.floor(3*i/Math.max(1,broad.length))))).size;
      if(hitIndexes.length>=2&&hitBands>=2){activeFamilySet.add(formula.family);activeRules++;activeHits+=hitIndexes.length;}
      const localHits=target.filter(tr=>repeatFormulaHit(formula,tr)).length;
      if(localHits){targetFamilySet.add(formula.family);targetRules++;targetHits+=localHits;}
    });
    const broadShapes=twinShapeEvidence(current,broad,TWIN_SHAPES),targetShapes=twinShapeEvidence(current,target,TWIN_SHAPES);
    const shapes=TWIN_SHAPES.map((shape,i)=>({label:shape[2],targetFamilies:targetShapes[i].families,targetEvents:targetShapes[i].events,broadFamilies:broadShapes[i].families,broadEvents:broadShapes[i].events})).sort((a,b)=>b.targetFamilies-a.targetFamilies||b.targetEvents-a.targetEvents||b.broadFamilies-a.broadFamilies||b.broadEvents-a.broadEvents||a.label.localeCompare(b.label));
    return {digit,activeFamilies:activeFamilySet.size,activeRules,activeHits,targetFamilies:targetFamilySet.size,targetRules,targetHits,bestShape:shapes[0],shapes};
  }).sort(compareIndependentTwin);
  const choices=candidates.slice(0,2).map((x,i)=>({...x,pair:`${x.digit}${x.digit}`,choice:i+1,relationNote:'Repeat-family independen dari 4D inti'}));
  return {pool:candidates,choices,digits:coreFour,candidates,state:'PENJAGAAN REPEAT-FAMILY',mode:'independent-repeat'};
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
function twinChoiceCards(items){return `<div class="twin-choice-grid">${items.map(x=>`<div class="twin-choice"><small>Pilihan kembar ${x.choice} • ${x.sourceTargetContinuity?'kontinuitas sumber–target':x.repeatPosition?'repeat-position':x.sourceContinuity?'kontinuitas sumber':x.targetDayBridge?'anchor target-day':x.repeatDepth?'kedalaman repeat seluruh replay':'digit formula'}</small><b>${x.pair}</b><span>Bentuk posisi kandidat ${x.bestShape.label} • belum mengunci posisi</span></div>`).join('')}</div>`;}
function renderResult(r){
  $('output').className='result';
  if($('modelPill'))$('modelPill').textContent=r.formulaLadder.modeLabel;
  $('output').innerHTML=`
    <div class="result-hero formula-ladder-card">
      <span class="mini-title">Formula Relationship Scan • ${r.market||'-'} → ${r.targetDay}</span>
      <h3>Tangga Prediksi Bersarang</h3>
      <div class="relation-route ${r.useIndependent?'is-independent':'is-position'}"><b>${r.formulaLadder.modeLabel}</b><span>${r.formulaLadder.routeNote}</span></div>
      ${r.historyConditioned?`<div class="history-conditioned-seat"><b>Validasi nilai lintas-riwayat</b><span>${r.historyConditioned.supportedDigits} digit memiliki recurrence nilai mandiri; echo latest tidak dihitung sebagai keluarga baru • kursi keenam coverage ${r.historyConditioned.coverageSeat}</span></div>`:''}
      ${r.nearTieTargetCoverage?`<div class="target-day-bridge-seat"><b>Pemulihan cakupan near-tie ${r.targetDay}</b><span>${r.nearTieTargetCoverage.latestTargetDigits.join('')} → ${r.nearTieTargetCoverage.candidateDigits.join(' ')} • ${r.nearTieTargetCoverage.targetTransitions} replay target-day • masuk kursi kelima dan keenam</span></div>`:''}
      ${r.replayKCounterRouteGuard?`<div class="target-day-bridge-seat"><b>Penjaga K dari counter-route</b><span>${r.replayKCounterRouteGuard.candidateDigit} menggantikan ${r.replayKCounterRouteGuard.replacedDigit} pada kursi keenam • 4 profil ACTIVE K • recurrence A–K–L–E • 4D dan 5D tetap</span></div>`:''}
      ${r.replayIndependentTargetCarryTwinRecovery?`<div class="target-day-bridge-seat"><b>Pemulihan carry target-day dan kembar</b><span>spine lintas-rute ${r.replayIndependentTargetCarryTwinRecovery.sharedSpine.join(' ')} • kontinuitas sumber–target ${r.replayIndependentTargetCarryTwinRecovery.sourceTargetCandidate.digit} masuk 4D • carry ortogonal ${r.replayIndependentTargetCarryTwinRecovery.orthogonalCandidate.digit} masuk 5D • cadangan ${r.replayIndependentTargetCarryTwinRecovery.reserve.digit} menjaga 6D</span></div>`:''}
      ${r.dualRouteDigitCoverageRecovery?`<div class="target-day-bridge-seat"><b>Pemulihan cakupan dua rute</b><span>anchor ${r.targetDay} ${r.dualRouteDigitCoverageRecovery.targetCandidate.digit} • anchor independen ${r.dualRouteDigitCoverageRecovery.coverageCandidate.digit} • kursi batas ${r.dualRouteDigitCoverageRecovery.boundary.digit} dipertahankan • ${r.dualRouteDigitCoverageRecovery.targetTransitions} replay target-day</span></div>`:''}
      ${r.strongWinCounterRouteHedgeRecovery?`<div class="target-day-bridge-seat"><b>Penjaga counter-route dan hedge</b><span>spine ${r.strongFour.join(' ')} • echo counter-route ${r.strongWinCounterRouteHedgeRecovery.counterCandidate.digit} masuk 5D • hedge TIE ${r.strongWinCounterRouteHedgeRecovery.hedgeCandidate.digit} masuk 6D • ${r.strongWinCounterRouteHedgeRecovery.targetTransitions} replay target-day</span></div>`:''}
      ${r.nearParitySparseOverlapRecovery?`<div class="target-day-bridge-seat"><b>Pemulihan near-parity sparse-overlap</b><span>spine lintas-rute ${r.nearParitySparseOverlapRecovery.sharedDigits.join(' ')} • anchor independen ${r.nearParitySparseOverlapRecovery.coverageCandidate.digit} masuk 4D • kontinuitas ${r.targetDay} ${r.nearParitySparseOverlapRecovery.continuityCandidate.digit} masuk 5D • cadangan ${r.nearParitySparseOverlapRecovery.reserve.digit} menjaga 6D</span></div>`:''}
      ${r.targetDayBridge?`<div class="target-day-bridge-seat"><b>Jembatan target-day ${r.targetDay}</b><span>${r.targetDayBridge.bridgeKind==='target-day-middle-position-recovery'?`${r.targetDayBridge.latestTargetDigits.join('')} → ${r.targetDayBridge.candidateDigit} • ${r.targetDayBridge.targetTransitions} replay target-day • saksi TIE K • masuk 4D dan pilihan kembar`:r.targetDayBridge.bridgeKind==='structural-replay-loss-recovery'?`spine ${r.targetDayBridge.spineDigits.join(' ')} • anchor ${r.targetDayBridge.candidateDigit} masuk 4D • counter-route ${r.targetDayBridge.counterDigit} masuk 5D • ${r.targetDayBridge.targetTransitions} replay target-day`:`${r.targetDayBridge.latestTargetDigits.join('')} → ${r.targetDayBridge.candidateDigit} • ${r.targetDayBridge.targetTransitions} replay target-day • masuk 4D${r.targetDayBridge.twinStrategy==='preserve'?' tanpa memaksa ranking kembar':' dan pilihan kembar'}${r.targetDayBridge.boundaryRetention?` • ${r.targetDayBridge.boundaryRetention.digit} dipertahankan di 5D`:''}`}</span></div>`:''}
      ${r.boundarySeat?`<div class="pair-balance-seat ${r.corePromotion?'is-core-promotion':''}"><b>${r.corePromotion?'Promosi inti pair-balance':'Kursi keenam pair-balance'}</b><span>${r.boundarySeat.formulaLabel} → ${r.boundarySeat.digit}${r.corePromotion?` • masuk 4D, 5D, dan 6D; ${r.corePromotion.replacedDigit} turun ke batas 6D`:' • harus sejalan dengan resurgence posisi terbaru'}</span></div>`:''}
      <div class="ladder-step ladder-six"><div><small>6 Digit Formula</small><b>15 kombinasi 4D</b></div>${digitCards(r.finalDigits,'ladder-six-digit')}</div>
      <div class="ladder-flow">Disaring oleh kekuatan relasi rumus</div>
      <div class="ladder-step ladder-five"><div><small>5 Digit Terkuat</small><b>5 kombinasi 4D</b></div>${digitCards(r.strongFive,'strong-five')}</div>
      <div class="ladder-flow">Diambil inti paling konsisten</div>
      <div class="ladder-step ladder-four"><div><small>4 Digit Inti Sangat Kuat</small><b>1 kombinasi inti</b></div>${digitCards(r.strongFour,'core-four-digit')}</div>
      <div class="core-twin-box"><div><small>2 Pilihan Kembar dari 4D Inti</small><b>${r.twinPortfolio.state}</b></div>${twinChoiceCards(r.twinPortfolio.choices)}<p>Ketepatan digit kembar dan ketepatan posisi dinilai terpisah. Kembar tidak mengambil digit di luar empat digit inti dan tidak menyatakan bahwa repeat pasti terjadi.</p></div>
    </div>
    <div class="backup-card hedge-card"><div class="backup-head"><div><small>Pagar Formula Ortogonal</small><b>5 Digit Cadangan</b></div><span class="backup-risk">2 jembatan + 3 alternatif</span></div>${digitCards(r.secondary.digits,'backup-digit')}<div class="hedge-map"><span>Jembatan dari 5D: ${r.secondary.bridge.join(' ')}</span><span>Alternatif formula: ${r.secondary.alternatives.join(' ')}</span>${r.secondary.targetDayReserve?.length?`<span>Runner target-day: ${r.secondary.targetDayReserve.join(' ')}</span>`:''}${r.secondary.counterRoute?`<span>Cadangan jalur posisi</span>`:''}${r.secondary.weakTieSeat?`<span class="weak-tie-seat">TIE posisi lemah: ${r.secondary.weakTieSeat.digit} (${r.secondary.weakTieSeat.positionLabel})</span>`:''}</div><p>Bukan kebalikan penuh dari lima digit terkuat. Dua digit menjaga hubungan utama; tiga alternatif membaca runner-up. Saat replay memindahkan jalur utama, cadangan menjaga jalur posisi yang ditinggalkan.</p></div>
    <div class="akle-section relation-pairs"><h4>AKLE Position-First</h4><div class="akle-grid"><div><small>5 Pilihan AK</small>${pairCards(r.ak,'ak')}</div><div><small>5 Pilihan LE</small>${pairCards(r.le,'le')}</div></div></div>
    <div class="formula-integrity-note">Urutan 4D ⊂ 5D ⊂ 6D dijaga otomatis. Router replay menilai jalur rumus, bukan peluang digit; nama market dan hasil yang belum masuk data tidak dipakai dalam keputusan.</div>`;
}

if(typeof module!=='undefined'&&module.exports)module.exports={parseRows,buildPrediction,buildCorePrediction,buildFormulaRelationRun,selectLocalProfile,buildBalancedEcologyPortfolio,buildPositionFormulaLedger,buildFormulaEvidenceLadder,buildIndependentRelationLattice,buildCrossRouteConcentrationLadder,buildHistoryConditionedIndependentLadder,buildTargetDayRecurrenceLedger,buildTargetDayRecurrenceBridge,buildDuplicateSourceTargetDayBridge,buildDominantTargetDayBridge,buildStructuralTargetDayCoreBridge,buildSplitEvidenceRepeatPositionBridge,buildStructuralTargetDayAnchorRestoration,buildTargetPositionBoundaryRetention,buildStructuralReplayLossRecovery,buildNearTieTargetCoverage,buildMiddlePositionTargetDayRecovery,buildReplayKCounterRouteGuard,buildReplayIndependentTargetCarryTwinRecovery,buildDualRouteDigitCoverageRecovery,buildStrongWinCounterRouteHedgeRecovery,buildNearParitySparseOverlapRecovery,needsIndependentRelationRoute,weightedRouteReplay,chooseFormulaRoute,buildWeakPositionTieSeat,buildFormulaHedge,buildCounterRouteHedge,applyTargetDayHedgeBridge,buildPairBalanceBoundarySeat,promotePairBalanceCore,buildTwinPortfolio,applyReplayTargetCarryTwin,applyTargetDayTwinBridge,buildIndependentTwinPortfolio,renderResult,inferTargetDay,transitionsFor,formulaLibrary,pairBalanceFormulaLibrary,LOCAL_PROFILES};
