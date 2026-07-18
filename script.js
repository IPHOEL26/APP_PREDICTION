'use strict';

const APP_VERSION = 'IPHOEL Formula Engine V13.5 • Nested 6D–5D–4D Formula Ladder';
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
  $('modelPill').textContent='Formula Evidence Ladder';
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
  const stages=['Normalisasi satu market','Membalik riwayat tertua → terbaru','Membangun transisi hari market','Replay keluarga rumus lintas posisi','Menyusun tangga formula 6D → 5D → 4D','Mengambil kembar dari 4D dan pagar formula ortogonal'];
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
  const six=evidence.slice(0,6).map(x=>x.digit),five=six.slice(0,5),four=five.slice(0,4);
  return {six,five,four,evidence};
}
function compareHedgeEvidence(a,b){
  return b.tieProfiles-a.tieProfiles||b.tiePositions-a.tiePositions||b.tieFamilies-a.tieFamilies||b.tieRules-a.tieRules||b.runnerPlacements-a.runnerPlacements||b.runnerPoints-a.runnerPoints||a.digit-b.digit;
}
function buildFormulaHedge(profileRuns,strongFive){
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
  const bridge=evidence.filter(x=>primary.has(x.digit)).sort(compareHedgeEvidence).slice(0,2),alternatives=evidence.filter(x=>!primary.has(x.digit)).sort(compareHedgeEvidence).slice(0,3);
  const selected=[...bridge,...alternatives].sort(compareHedgeEvidence);
  return {digits:selected.map(x=>x.digit),bridge:bridge.map(x=>x.digit),alternatives:alternatives.map(x=>x.digit),evidence:evidence.sort(compareHedgeEvidence)};
}
function buildPrediction(inputRows){
  const market=inputRows[0]?.code||'',rows=inputRows.filter(r=>!market||r.code===market),profileRuns=LOCAL_PROFILES.map(p=>buildFormulaRelationRun(rows,p));
  const selectedCore=profileRuns.find(r=>r.profile.id==='formula-first')||profileRuns[0];
  const formulaLadder=buildFormulaEvidenceLadder(profileRuns),secondary=buildFormulaHedge(profileRuns,formulaLadder.five);
  const core={...selectedCore,finalDigits:formulaLadder.six,strongFive:formulaLadder.five,strongFour:formulaLadder.four,secondary,formulaLadder};
  const twinPortfolio=buildTwinPortfolio(core,profileRuns);
  return {...core,twinPortfolio,profileRuns};
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
function twinChoiceCards(items){return `<div class="twin-choice-grid">${items.map(x=>`<div class="twin-choice"><small>Pilihan kembar ${x.choice} • relasi ${x.bestShape.label}</small><b>${x.pair}</b><span>Diambil langsung dari 4D inti</span></div>`).join('')}</div>`;}
function renderResult(r){
  $('output').className='result';
  $('output').innerHTML=`
    <div class="result-hero formula-ladder-card">
      <span class="mini-title">Formula Relationship Scan • ${r.market||'-'} → ${r.targetDay}</span>
      <h3>Tangga Prediksi Bersarang</h3>
      <div class="ladder-step ladder-six"><div><small>6 Digit Formula</small><b>15 kombinasi 4D</b></div>${digitCards(r.finalDigits,'ladder-six-digit')}</div>
      <div class="ladder-flow">Disaring oleh kekuatan relasi rumus</div>
      <div class="ladder-step ladder-five"><div><small>5 Digit Terkuat</small><b>5 kombinasi 4D</b></div>${digitCards(r.strongFive,'strong-five')}</div>
      <div class="ladder-flow">Diambil inti paling konsisten</div>
      <div class="ladder-step ladder-four"><div><small>4 Digit Inti Sangat Kuat</small><b>1 kombinasi inti</b></div>${digitCards(r.strongFour,'core-four-digit')}</div>
      <div class="core-twin-box"><div><small>2 Pilihan Kembar dari 4D Inti</small><b>Penjagaan formula</b></div>${twinChoiceCards(r.twinPortfolio.choices)}<p>Kembar tidak mengambil digit di luar empat digit inti dan tidak menyatakan bahwa repeat pasti terjadi.</p></div>
    </div>
    <div class="backup-card hedge-card"><div class="backup-head"><div><small>Pagar Formula Ortogonal</small><b>5 Digit Cadangan</b></div><span class="backup-risk">2 jembatan + 3 alternatif</span></div>${digitCards(r.secondary.digits,'backup-digit')}<div class="hedge-map"><span>Jembatan dari 5D: ${r.secondary.bridge.join(' ')}</span><span>Alternatif formula: ${r.secondary.alternatives.join(' ')}</span></div><p>Bukan kebalikan penuh dari lima digit terkuat. Dua digit menjaga hubungan dengan formula utama, sedangkan tiga digit membaca keluarga rumus runner-up.</p></div>
    <div class="formula-integrity-note">Urutan 4D ⊂ 5D ⊂ 6D dijaga secara otomatis. Tidak ada persentase peluang digit, kondisi nama market, atau penanaman hasil aktual.</div>`;
}

if(typeof module!=='undefined'&&module.exports)module.exports={parseRows,buildPrediction,buildCorePrediction,buildFormulaRelationRun,selectLocalProfile,buildBalancedEcologyPortfolio,buildFormulaEvidenceLadder,buildFormulaHedge,buildTwinPortfolio,renderResult,inferTargetDay,transitionsFor,formulaLibrary,LOCAL_PROFILES};
