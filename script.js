'use strict';

const APP_VERSION = 'IPHOEL Formula Engine V4.2 • Slow Formula Audit';
const DIGITS = [0,1,2,3,4,5,6,7,8,9];
const DAYS = ['minggu','senin','selasa','rabu','kamis','jumat','sabtu'];
const MONTHS = {jan:1,january:1,januari:1,feb:2,february:2,februari:2,mar:3,march:3,maret:3,apr:4,april:4,may:5,mei:5,jun:6,june:6,juni:6,jul:7,july:7,juli:7,aug:8,august:8,agt:8,agustus:8,sep:9,sept:9,september:9,oct:10,okt:10,october:10,oktober:10,nov:11,november:11,dec:12,des:12,december:12,desember:12};
const $ = id => document.getElementById(id);
let lastRows = [];
let analysisRunId = 0;

function init(){
  $('versionPill').textContent = APP_VERSION;
  $('modelPill').textContent = 'Formula Murni';
  $('dataInput').addEventListener('input', debounce(analyze, 320));
  $('btnClear').addEventListener('click', clearAll);
  analyze();
}
document.addEventListener('DOMContentLoaded', init);

function clearAll(){
  $('dataInput').value = '';
  lastRows = [];
  $('rowCounter').textContent = '0 baris';
  $('output').className = 'empty-state';
  $('output').innerHTML = '<div><div class="empty-icon">Φ</div><h3>Belum ada data</h3><p>Tempel data historis. Analisis berjalan otomatis.</p></div>';
}

async function analyze(){
  const runId = ++analysisRunId;
  const rows = parseRows($('dataInput').value);
  lastRows = rows;
  $('rowCounter').textContent = `${rows.length} baris`;
  if(rows.length < 8){
    $('output').className = 'empty-state';
    $('output').innerHTML = '<div><div class="empty-icon">Φ</div><h3>Data belum cukup</h3><p>Minimal 8 baris agar mesin rumus dapat membaca transisi.</p></div>';
    return;
  }
  const stages = buildSlowStages(rows);
  for(let i=0;i<stages.length;i++){
    if(runId !== analysisRunId) return;
    renderLoadingStage(stages, i);
    await sleep(stages[i].delay || 720);
  }
  if(runId !== analysisRunId) return;
  const result = buildFormulaPrediction(rows);
  if(runId !== analysisRunId) return;
  renderResult(result);
}

function cleanText(text){
  return String(text || '').normalize('NFKC').replace(/[\u200B-\u200D\uFEFF]/g,'').replace(/[\u00A0\u202F]/g,' ').replace(/[\u2013\u2014]/g,'-').replace(/\r/g,'\n');
}
function normalizeLine(line){return cleanText(line).replace(/[|;]/g,' ').replace(/\s+/g,' ').trim();}
function parseRows(rawText){
  const raw = cleanText(rawText);
  if(!raw.trim()) return [];
  const rows = [];
  raw.split(/\n+/).map(normalizeLine).filter(Boolean).forEach((line, idx) => {
    const codeMatch = line.match(/\b([A-Z]{2,7}\d*)\s*\[\s*(\d{1,8})\s*\]/i);
    if(!codeMatch) return;
    const after = line.slice(line.lastIndexOf(']') + 1);
    const digits = parseDigitsFromString(after).slice(0,4);
    if(digits.length < 4) return;
    rows.push({
      code: codeMatch[1].toUpperCase(),
      period: Number(codeMatch[2]) || idx + 1,
      date: extractDate(line),
      day: normalizeDay(line),
      digits,
      raw: line
    });
  });
  const seen = new Set();
  return rows.filter(r => {
    const key = `${r.period}|${r.date}|${r.digits.join('')}`;
    if(seen.has(key)) return false;
    seen.add(key);
    return true;
  }).sort((a,b) => {
    const pd = (b.period || 0) - (a.period || 0);
    if(pd) return pd;
    return dateValue(b.date) - dateValue(a.date);
  });
}
function parseDigitsFromString(str){
  const s = String(str || '').trim();
  if(!s) return [];
  const spaced = s.match(/(?<!\d)\d{1,2}(?!\d)/g);
  if(spaced && spaced.length >= 4) return spaced.map(Number).filter(x => Number.isInteger(x) && x >= 0 && x <= 9);
  const compact = s.replace(/\D/g,'');
  if(compact.length >= 4 && compact.length <= 8) return compact.split('').map(Number);
  return [];
}
function normalizeDay(text){
  const m = String(text || '').toLowerCase().match(/\b(minggu|senin|selasa|rabu|kamis|jumat|jum'at|sabtu|sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i);
  if(!m) return '';
  const d = m[1].toLowerCase();
  const map = {sunday:'minggu',monday:'senin',tuesday:'selasa',wednesday:'rabu',thursday:'kamis',friday:'jumat',saturday:'sabtu',"jum'at":'jumat'};
  return map[d] || d;
}
function extractDate(text){
  const s = String(text || '');
  const m1 = s.match(/(\d{1,2})\s*[\/\-]\s*([A-Za-zÀ-ÿ]{3,12})\s*[\/\-]\s*(\d{2,4})/i);
  if(m1) return `${pad2(m1[1])}/${m1[2]}/${normalizeYear(m1[3])}`;
  const m2 = s.match(/(\d{1,2})\s*[\/\-]\s*(\d{1,2})\s*[\/\-]\s*(\d{2,4})/);
  if(m2) return `${pad2(m2[1])}/${pad2(m2[2])}/${normalizeYear(m2[3])}`;
  return '';
}
function dateValue(date){
  if(!date) return 0;
  const m1 = date.match(/(\d{1,2})\/([A-Za-zÀ-ÿ]{3,12})\/(\d{4})/i);
  if(m1){const month = MONTHS[m1[2].toLowerCase().slice(0,3)] || MONTHS[m1[2].toLowerCase()] || 0; return new Date(Number(m1[3]), month-1, Number(m1[1])).getTime() || 0;}
  const m2 = date.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if(m2) return new Date(Number(m2[3]), Number(m2[2])-1, Number(m2[1])).getTime() || 0;
  return 0;
}
function normalizeYear(y){y=String(y);return y.length===2?'20'+y:y;}
function pad2(x){return String(x).padStart(2,'0');}

function buildFormulaPrediction(rows){
  const latest = rows[0];
  const chrono = rows.slice().reverse();
  const formulas = buildFormulaLibrary();
  const targetDay = inferTargetDay(rows);
  const learned = learnFormulaWeights(chrono, formulas);
  const learnedDay = learnDayFormulaWeights(chrono, formulas, latest.day);
  const learnedWeekLatest = learnWeekFormulaWeights(chrono, formulas, latest.day);
  const learnedWeekTarget = learnWeekFormulaWeights(chrono, formulas, targetDay);
  const candidate = scoreCurrent(latest, formulas, learned, learnedDay, learnedWeekLatest, learnedWeekTarget);
  const finalDigits = chooseFormulaDigits(candidate, latest);
  const twinDigit = chooseTwinDigit(candidate, finalDigits, latest);
  const audit = buildLocalFormulaAudit(rows, formulas, learned, learnedWeekLatest, learnedWeekTarget);
  audit.process = buildProcessCards(rows, formulas);
  return {rows, latest, targetDay, formulas, learned, learnedDay, learnedWeekLatest, learnedWeekTarget, candidate, finalDigits, twinDigit, audit};
}

function buildFormulaLibrary(){
  const pairIdx = [[0,1],[0,2],[0,3],[1,2],[1,3],[2,3]];
  const lib = [];
  const add = (id, name, family, fn) => lib.push({id,name,family,fn});

  add('carry','Digit terakhir dibawa', 'carry', r => r.digits);
  add('mirror9','Cermin 9: 9-d', 'mirror', r => r.digits.map(d => mod10(9-d)));
  add('mirror10','Cermin 10: 10-d', 'mirror', r => r.digits.map(d => mod10(10-d)));
  add('neighbor1','Tetangga cincin ±1', 'neighbor', r => flat(r.digits.map(d => [mod10(d-1),mod10(d+1)])));
  add('neighbor2','Tetangga jauh ±2', 'neighbor', r => flat(r.digits.map(d => [mod10(d-2),mod10(d+2)])));
  add('pairsum','Jumlah pasangan mod 10', 'pair', r => pairIdx.map(([i,j]) => mod10(r.digits[i]+r.digits[j])));
  add('pairdiff','Selisih pasangan', 'pair', r => pairIdx.map(([i,j]) => Math.abs(r.digits[i]-r.digits[j])%10));
  add('pairprod','Kali pasangan mod 10', 'pair', r => pairIdx.map(([i,j]) => mod10(r.digits[i]*r.digits[j])));
  add('pairdiv','Bagi pasangan bulat mod 10', 'pair', r => flat(pairIdx.map(([i,j]) => safeDivDigits(r.digits[i], r.digits[j]))));
  add('pairmirror','Cermin jumlah pasangan', 'pair', r => pairIdx.map(([i,j]) => mod10(9 - mod10(r.digits[i]+r.digits[j]))));
  add('corner','Sudut dan tengah', 'cross', r => [mod10(r.digits[0]+r.digits[3]), mod10(r.digits[1]+r.digits[2]), Math.abs((r.digits[0]+r.digits[3])-(r.digits[1]+r.digits[2]))%10, mod10((r.digits[0]+r.digits[3])+(r.digits[1]+r.digits[2]))]);
  add('triad','Jumlah tiga digit', 'cross', r => [mod10(r.digits[0]+r.digits[1]+r.digits[2]),mod10(r.digits[0]+r.digits[1]+r.digits[3]),mod10(r.digits[0]+r.digits[2]+r.digits[3]),mod10(r.digits[1]+r.digits[2]+r.digits[3])]);
  add('sumshift','Geser total digit', 'shift', r => r.digits.map(d => mod10(d + sumDigits(r)%10)));
  add('rootplus','Geser root naik', 'shift', r => r.digits.map(d => mod10(d + digitalRoot(sumDigits(r)))));
  add('rootminus','Geser root turun', 'shift', r => r.digits.map(d => mod10(d - digitalRoot(sumDigits(r)))));
  add('cornerShift','Geser sudut', 'shift', r => r.digits.map(d => mod10(d + r.digits[0] + r.digits[3])));
  add('middleShift','Geser tengah', 'shift', r => r.digits.map(d => mod10(d + r.digits[1] + r.digits[2])));
  add('golden64','Golden shift 6 dan 4', 'golden', r => flat(r.digits.map(d => [mod10(d+6), mod10(d+4), mod10(d-6), mod10(d-4)])));
  add('fibo1358','Fibonacci shift 1 3 5 8', 'golden', r => flat(r.digits.map(d => [mod10(d+1),mod10(d+3),mod10(d+5),mod10(d+8)])));
  add('phiSum','Phi total digit', 'golden', r => {const s=sumDigits(r); const p=mod10(Math.round(1.61803398875*s)); return r.digits.map(d => mod10(d+p));});
  add('affine2sum','2d + total', 'affine', r => {const c=sumDigits(r)%10; return r.digits.map(d => mod10(2*d+c));});
  add('affine3root','3d + root', 'affine', r => {const c=digitalRoot(sumDigits(r)); return r.digits.map(d => mod10(3*d+c));});
  add('affine7corner','7d + sudut', 'affine', r => {const c=mod10(r.digits[0]+r.digits[3]); return r.digits.map(d => mod10(7*d+c));});
  add('chainAdj','Rantai berdekatan', 'chain', r => [mod10(r.digits[0]+r.digits[1]),mod10(r.digits[1]+r.digits[2]),mod10(r.digits[2]+r.digits[3]),mod10(r.digits[3]+r.digits[0])]);
  add('chainDiff','Selisih rantai', 'chain', r => [Math.abs(r.digits[0]-r.digits[1])%10,Math.abs(r.digits[1]-r.digits[2])%10,Math.abs(r.digits[2]-r.digits[3])%10,Math.abs(r.digits[3]-r.digits[0])%10]);
  add('outerInner','Luar dalam', 'cross', r => [mod10(r.digits[0]+r.digits[3]),mod10(r.digits[1]+r.digits[2]),mod10(r.digits[0]*r.digits[3]),mod10(r.digits[1]*r.digits[2])]);
  add('twinSplit','Pecah kembar: t+t, t-t, tunggal+tunggal', 'twin', r => twinSplitDigits(r));
  add('twinMirrorSingle','Cermin digit tunggal setelah kembar', 'twin', r => twinMirrorSingleDigits(r));
  add('singlePairGate','Gerbang pasangan tunggal kanan-kiri', 'twin', r => singlePairGateDigits(r));
  add('dayPairShift','Pasangan digeser kunci hari', 'day', r => dayPairShiftDigits(r));
  add('dateDay','Hari dan tanggal sebagai kunci', 'date', r => {const dayIdx = DAYS.indexOf(r.day); const dateNum = Number(String(r.date || '').slice(0,2)) || 0; const k = mod10((dayIdx < 0 ? 0 : dayIdx) + dateNum); return r.digits.map(d => mod10(d+k));});
  return lib;
}

function learnFormulaWeights(chrono, formulas){
  const learned = {};
  formulas.forEach(f => learned[f.id] = {hits:0, trials:0, value:1, name:f.name, family:f.family, samples:[]});
  for(let i=0;i<chrono.length-1;i++){
    const prev = chrono[i];
    const next = uniqueDigits(chrono[i+1].digits);
    formulas.forEach(f => {
      const out = uniqueDigits(f.fn(prev));
      if(!out.length) return;
      const hitDigits = out.filter(d => next.includes(d));
      const value = hitDigits.length * 12 - Math.max(0, out.length - 4);
      learned[f.id].trials += 1;
      if(hitDigits.length){
        learned[f.id].hits += hitDigits.length;
        learned[f.id].value += Math.max(1, value);
        learned[f.id].samples.push({from:prev.digits.join(''), to:chrono[i+1].digits.join(''), hit:hitDigits.join(' ')});
      }
    });
  }
  Object.values(learned).forEach(x => {
    // Tetap integer. Tidak ada persen. Rumus yang sering tepat dapat kunci lebih besar.
    x.key = Math.max(1, Math.round(x.value / Math.max(1, Math.floor((x.trials || 1) / 6))));
  });
  return learned;
}


function learnDayFormulaWeights(chrono, formulas, day){
  const learned = {};
  formulas.forEach(f => learned[f.id] = {value:0, hits:0, trials:0, name:f.name, family:f.family});
  for(let i=0;i<chrono.length-1;i++){
    const prev = chrono[i];
    const next = uniqueDigits(chrono[i+1].digits);
    if(prev.day !== day) continue;
    formulas.forEach(f => {
      const out = uniqueDigits(f.fn(prev));
      if(!out.length) return;
      const hitDigits = out.filter(d => next.includes(d));
      learned[f.id].trials += 1;
      if(hitDigits.length){
        learned[f.id].hits += hitDigits.length;
        learned[f.id].value += hitDigits.length * 24 + Math.max(0, 8 - out.length);
      }
    });
  }
  Object.values(learned).forEach(x => {
    x.dayKey = Math.max(0, Math.round(x.value / Math.max(1, Math.floor((x.trials || 1) / 2))));
  });
  return learned;
}

function learnWeekFormulaWeights(chrono, formulas, day){
  const learned = {};
  formulas.forEach(f => learned[f.id] = {value:0, hits:0, trials:0, name:f.name, family:f.family, weekSamples:[]});
  if(!day || day === '-') return learned;
  const sameDayRows = chrono.filter(r => r.day === day);
  for(let i=0;i<sameDayRows.length-1;i++){
    const prev = sameDayRows[i];
    const next = uniqueDigits(sameDayRows[i+1].digits);
    formulas.forEach(f => {
      const out = uniqueDigits(f.fn(prev));
      if(!out.length) return;
      const hitDigits = out.filter(d => next.includes(d));
      learned[f.id].trials += 1;
      if(hitDigits.length){
        learned[f.id].hits += hitDigits.length;
        learned[f.id].value += hitDigits.length * 36 + Math.max(0, 8 - out.length);
        learned[f.id].weekSamples.push({from:`${prev.day} ${prev.digits.join('')}`, to:`${sameDayRows[i+1].day} ${sameDayRows[i+1].digits.join('')}`, hit:hitDigits.join(' ')});
      }
    });
  }
  Object.values(learned).forEach(x => {
    x.weekKey = Math.max(0, Math.round(x.value / Math.max(1, Math.floor((x.trials || 1) / 2))));
  });
  return learned;
}

function scoreCurrent(latest, formulas, learned, learnedDay, learnedWeekLatest, learnedWeekTarget){
  const score = Array(10).fill(0);
  const formulaHits = [];
  const familyScore = {};
  const digitTrace = Array.from({length:10}, () => []);
  formulas.forEach(f => {
    const out = uniqueDigits(f.fn(latest));
    if(!out.length) return;
    const key = learned[f.id]?.key || 1;
    const dayKey = learnedDay?.[f.id]?.dayKey || 0;
    const weekLatestKey = learnedWeekLatest?.[f.id]?.weekKey || 0;
    const weekTargetKey = learnedWeekTarget?.[f.id]?.weekKey || 0;
    const penalty = Math.max(0, out.length - 6);
    const power = Math.max(1, key - penalty) + Math.max(0, dayKey - penalty) + Math.max(0, weekLatestKey - penalty) + Math.max(0, Math.floor(weekTargetKey / 2) - penalty);
    out.forEach(d => {
      score[d] += power;
      digitTrace[d].push({name:f.name, family:f.family, key:power});
      familyScore[f.family] = familyScore[f.family] || Array(10).fill(0);
      familyScore[f.family][d] += power;
    });
    formulaHits.push({id:f.id, name:f.name, family:f.family, key:power, digits:out});
  });
  // Kunci murni tambahan dari struktur angka terbaru, bukan frekuensi kemunculan.
  const a = latest.digits;
  const s = sumDigits(latest);
  const root = digitalRoot(s);
  [mod10(s), root, mod10(a[0]+a[3]), mod10(a[1]+a[2]), Math.abs((a[0]+a[3])-(a[1]+a[2]))%10].forEach(d => {
    score[d] += 9;
    digitTrace[d].push({name:'Kunci struktur total/sudut/tengah', family:'structure', key:9});
  });
  // Jika draw terakhir tidak kembar, beri ruang pada rumus pembentuk kembar.
  const counts = countMap(a);
  const hasTwin = Object.values(counts).some(v => v >= 2);
  if(!hasTwin){
    const twinSeeds = uniqueDigits([mod10(a[0]+a[1]), mod10(a[2]+a[3]), mod10(root+1), mod10(root+3), mod10(9-root)]);
    twinSeeds.forEach(d => {
      score[d] += 5;
      digitTrace[d].push({name:'Benih kembar setelah non-kembar', family:'twin', key:5});
    });
  }
  // V4.1: rumus pecah kembar. Ini bukan frekuensi, tetapi operasi langsung dari bentuk draw terbaru.
  // Jika ada kembar t, maka t+t memberi pintu 8 pada 44, t-t memberi pintu 0, dan dua digit tunggal memberi pintu lain.
  const twinPack = twinSplitDigits(latest).concat(twinMirrorSingleDigits(latest), singlePairGateDigits(latest));
  uniqueDigits(twinPack).forEach(d => {
    score[d] += 70;
    digitTrace[d].push({name:'Kunci V4.1 pecah kembar dan gerbang tunggal', family:'twin', key:70});
    familyScore.twin = familyScore.twin || Array(10).fill(0);
    familyScore.twin[d] += 70;
  });
  return {score, formulaHits, familyScore, digitTrace};
}

function chooseFormulaDigits(candidate, latest){
  const selected = [];
  const sorted = DIGITS.slice().sort((a,b) => candidate.score[b] - candidate.score[a] || a-b);
  sorted.forEach(d => { if(selected.length < 4) selected.push(d); });

  const families = ['pair','neighbor','mirror','shift','golden','affine','cross','chain','structure'];
  families.forEach(fam => {
    if(selected.length >= 6) return;
    const arr = candidate.familyScore[fam];
    if(!arr) return;
    const d = DIGITS.slice().sort((a,b) => arr[b] - arr[a] || candidate.score[b]-candidate.score[a])[0];
    if(arr[d] > 0 && !selected.includes(d)) selected.push(d);
  });

  // Rumus proteksi: pasangan langsung, cermin, dan golden shift harus punya wakil.
  const rescue = operationRescueDigits(latest, candidate);
  rescue.forEach(d => {
    if(selected.length < 6 && !selected.includes(d)) selected.push(d);
  });

  sorted.forEach(d => { if(selected.length < 6 && !selected.includes(d)) selected.push(d); });

  // Repair: kalau 6 terpilih terlalu didominasi carry lama, ganti yang jejak rumusnya sempit.
  repairNarrowTrace(selected, candidate);
  forceOperationRescue(selected, latest, candidate);
  forceTwinSplitRescue(selected, latest, candidate);
  return selected.slice(0,6).sort((a,b) => candidate.score[b] - candidate.score[a] || a-b);
}



function twinInfo(row){
  const counts = countMap(row?.digits || []);
  const twins = Object.keys(counts).map(Number).filter(d => counts[d] >= 2);
  const singles = (row?.digits || []).filter(d => !twins.includes(d));
  return {twins, singles};
}
function twinSplitDigits(row){
  const info = twinInfo(row);
  const out = [];
  info.twins.forEach(t => {
    out.push(mod10(t+t));
    out.push(0); // t-t
    out.push(mod10(t+6));
    out.push(mod10(t+4));
  });
  if(info.singles.length >= 2){
    out.push(mod10(info.singles.reduce((s,d) => s+d, 0)));
    out.push(Math.abs(info.singles[0] - info.singles[1]) % 10);
  }
  return uniqueDigits(out);
}
function twinMirrorSingleDigits(row){
  const info = twinInfo(row);
  const out = [];
  if(info.twins.length){
    info.singles.forEach(s => {
      out.push(mod10(10-s));
      out.push(mod10(9-s));
      out.push(mod10(s+1));
      out.push(mod10(s-1));
    });
  }
  return uniqueDigits(out);
}
function singlePairGateDigits(row){
  const a = row?.digits || [];
  if(a.length < 4) return [];
  return uniqueDigits([
    mod10(a[2]+a[3]),
    mod10(a[1]+a[2]),
    mod10(a[0]+a[1]),
    mod10(a[0]+a[2]),
    mod10(a[1]+a[3]),
    Math.abs(a[2]-a[3])%10,
    Math.abs(a[0]-a[3])%10
  ]);
}
function dayPairShiftDigits(row){
  const a = row?.digits || [];
  if(a.length < 4) return [];
  const dayIdx = DAYS.indexOf(row.day);
  const k = dayIdx < 0 ? 0 : dayIdx + 1;
  const base = singlePairGateDigits(row);
  return uniqueDigits(base.map(d => mod10(d+k)).concat(base.map(d => mod10(d-k))));
}

function operationRescueDigits(latest, candidate){
  const a = latest.digits;
  const pairAdj = [mod10(a[0]+a[1]), mod10(a[1]+a[2]), mod10(a[2]+a[3]), mod10(a[3]+a[0])];
  const pairCross = [mod10(a[0]+a[2]), mod10(a[1]+a[3]), Math.abs((a[0]+a[3])-(a[1]+a[2]))%10];
  const mirror = flat(a.map(d => [mod10(9-d), mod10(10-d)]));
  const golden = flat(a.map(d => [mod10(d+6),mod10(d+4),mod10(d+8),mod10(d+5)]));
  const root = digitalRoot(sumDigits(latest));
  const rootOps = a.map(d => mod10(d+root)).concat(a.map(d => mod10(d-root))).concat([root, mod10(root+6), mod10(9-root)]);
  const raw = Array(10).fill(0);
  pairAdj.forEach(d => raw[d] += 34);
  pairCross.forEach(d => raw[d] += 18);
  mirror.forEach(d => raw[d] += 26);
  golden.forEach(d => raw[d] += 22);
  rootOps.forEach(d => raw[d] += 16);
  return DIGITS.slice().sort((x,y) => (raw[y] + 0.012*candidate.score[y]) - (raw[x] + 0.012*candidate.score[x]) || x-y).filter(d => raw[d] > 0).slice(0,3);
}

function forceOperationRescue(selected, latest, candidate){
  const rescue = operationRescueDigits(latest, candidate).slice(0,3);
  const traceWidth = d => new Set(candidate.digitTrace[d].map(x => x.family)).size;
  rescue.forEach(d => {
    if(selected.includes(d)) return;
    const victim = selected.slice().sort((a,b) => {
      const sa = candidate.score[a] + 10*traceWidth(a);
      const sb = candidate.score[b] + 10*traceWidth(b);
      return sa - sb;
    })[0];
    if(victim == null) return;
    const dPower = candidate.score[d] + 10*traceWidth(d) + 300;
    const vPower = candidate.score[victim] + 10*traceWidth(victim);
    if(dPower > vPower){
      selected[selected.indexOf(victim)] = d;
    }
  });
}


function forceTwinSplitRescue(selected, latest, candidate){
  const info = twinInfo(latest);
  if(!info.twins.length) return;
  const must = uniqueDigits(twinSplitDigits(latest).concat(twinMirrorSingleDigits(latest))).slice(0,4);
  if(!must.length) return;
  const locked = new Set();
  const traceWidth = d => new Set(candidate.digitTrace[d].map(x => x.family)).size;
  must.forEach(d => {
    if(selected.includes(d)){ locked.add(d); return; }
    const victim = selected.slice().filter(x => !locked.has(x) && !must.includes(x)).sort((a,b) => {
      const sa = candidate.score[a] + 14*traceWidth(a);
      const sb = candidate.score[b] + 14*traceWidth(b);
      return sa - sb;
    })[0];
    if(victim == null) return;
    selected[selected.indexOf(victim)] = d;
    locked.add(d);
  });
}

function formulaMustHave(latest){
  const a = latest.digits;
  const out = [];
  // Pasangan langsung.
  out.push(mod10(a[0]+a[1]), mod10(a[1]+a[2]), mod10(a[2]+a[3]));
  // Cermin dan tetangga dari digit tunggal.
  a.forEach(d => { out.push(mod10(9-d), mod10(d-1), mod10(d+1)); });
  // Root dan golden 6/4.
  const r = digitalRoot(sumDigits(latest));
  out.push(r, mod10(r+6), mod10(r+4), mod10(9-r));
  return uniqueDigits(out).sort((x,y) => x-y);
}

function repairNarrowTrace(selected, candidate){
  const traceWidth = d => new Set(candidate.digitTrace[d].map(x => x.family)).size;
  for(let pass=0; pass<2; pass++){
    const outsider = DIGITS.filter(d => !selected.includes(d)).sort((a,b) => {
      const sa = candidate.score[a] + 6*traceWidth(a);
      const sb = candidate.score[b] + 6*traceWidth(b);
      return sb - sa;
    })[0];
    const insider = selected.slice().sort((a,b) => {
      const sa = candidate.score[a] + 6*traceWidth(a);
      const sb = candidate.score[b] + 6*traceWidth(b);
      return sa - sb;
    })[0];
    if(outsider == null || insider == null) return;
    if(traceWidth(outsider) >= traceWidth(insider) + 2 && candidate.score[outsider] >= candidate.score[insider] - 8){
      selected[selected.indexOf(insider)] = outsider;
    }
  }
}

function chooseTwinDigit(candidate, finalDigits, latest){
  const score = Array(10).fill(0);
  const formulaByDigit = candidate.digitTrace;
  DIGITS.forEach(d => {
    const families = new Set(formulaByDigit[d].map(x => x.family));
    score[d] += candidate.score[d];
    score[d] += 8 * families.size;
  });
  const a = latest.digits;
  const counts = countMap(a);
  const twins = Object.keys(counts).map(Number).filter(d => counts[d] >= 2);
  if(twins.length){
    const singles = a.filter(d => !twins.includes(d));
    if(singles.length >= 2){
      const singleSum = mod10(singles.reduce((s,d) => s+d, 0));
      return singleSum;
    }
    twins.forEach(t => {
      score[mod10(t+t)] += 220;
      score[0] += 140;
      singles.forEach(s => { score[mod10(10-s)] += 160; score[mod10(9-s)] += 120; });
    });
  }else{
    // Jika draw terakhir tidak kembar, kandidat kembar sering lahir dari gerbang pasangan kanan.
    return mod10(a[2]+a[3]);
  }
  const directSeeds = [mod10(a[0]+a[1]), mod10(a[1]+a[2]), mod10(a[2]+a[3]), mod10(a[0]+a[3]), digitalRoot(sumDigits(latest)), mod10(9-digitalRoot(sumDigits(latest)))];
  directSeeds.forEach(d => score[d] += 12);
  // Kandidat kembar tidak harus terkunci di 6 digit utama. Ia boleh berdiri sebagai hasil rumus tersendiri.
  return DIGITS.slice().sort((x,y) => score[y] - score[x] || x-y)[0];
}


function buildLocalFormulaAudit(rows, formulas, learned, learnedWeekLatest, learnedWeekTarget){
  const latest = rows[0];
  const active = formulas.map(f => {
    const digits = uniqueDigits(f.fn(latest));
    const meta = learned[f.id] || {key:1, samples:[]};
    const weekLatest = learnedWeekLatest?.[f.id]?.weekKey || 0;
    const weekTarget = learnedWeekTarget?.[f.id]?.weekKey || 0;
    return {name:f.name, family:f.family, key:meta.key + weekLatest + Math.floor(weekTarget/2), digits, samples:meta.samples.slice(-2), weekLatest, weekTarget};
  }).sort((a,b) => b.key - a.key).slice(0,10);
  return {active};
}


function sleep(ms){return new Promise(resolve => setTimeout(resolve, ms));}

function buildSlowStages(rows){
  const formulas = buildFormulaLibrary();
  const chrono = rows.slice().reverse();
  const latest = rows[0];
  const targetDay = inferTargetDay(rows);
  const earlyPairs = [];
  for(let i=0;i<Math.min(3, chrono.length-1);i++) earlyPairs.push(pairText(chrono[i], chrono[i+1], formulas));
  const recentPairs = [];
  for(let i=Math.max(0, chrono.length-6); i<chrono.length-1; i++) recentPairs.push(pairText(chrono[i], chrono[i+1], formulas));
  const weekPairs = buildWeekPairs(rows, formulas, latest.day, 5).concat(buildWeekPairs(rows, formulas, targetDay, 4));
  const op = latestOperationCards(latest);
  return [
    {title:'Tahap 1 • Menyusun kronologi', icon:'①', delay:850, desc:`Membaca ${rows.length} baris dari data paling lama ke paling baru.`, items:earlyPairs},
    {title:'Tahap 2 • Membaca transisi harian', icon:'②', delay:980, desc:'Menguji rumus dari satu hari ke hari berikutnya. App mencari operasi yang pernah menembus draw sesudahnya.', items:recentPairs},
    {title:'Tahap 3 • Membaca hari yang sama per pekan', icon:'③', delay:980, desc:'Menguji relasi seperti Senin ke Senin, Jumat ke Jumat, dan target hari berikutnya. Ini bukan persen, tetapi jejak rumus antar pekan.', items:weekPairs.length ? weekPairs : ['Belum cukup pasangan hari yang sama untuk dibaca.']},
    {title:'Tahap 4 • Membaca operasi angka terbaru', icon:'④', delay:900, desc:`Latest ${latest.day || '-'} ${latest.digits.join(' ')} dibedah dengan tambah, kurang, kali, cermin, root, hari, dan pecah kembar.`, items:op},
    {title:'Tahap 5 • Mengunci 6 digit formula', icon:'⑤', delay:640, desc:'Menggabungkan kunci harian, kunci pekanan, operasi kembar, cermin, tetangga, root, golden, Fibonacci, affine, dan chain.', items:['Hasil akhir ditampilkan setelah semua tahap selesai.']}
  ];
}

function renderLoadingStage(stages, activeIndex){
  const active = stages[activeIndex];
  const progress = Math.round(((activeIndex + 1) / stages.length) * 100);
  const stepHtml = stages.map((s,i) => `<div class="step ${i<activeIndex?'done':i===activeIndex?'active':''}"><span>${s.icon}</span><b>${escapeHtml(s.title.replace(/^Tahap \d+ • /,''))}</b></div>`).join('');
  const itemHtml = (active.items || []).slice(0,8).map(x => `<li>${escapeHtml(x)}</li>`).join('');
  $('output').className = '';
  $('output').innerHTML = `<div class="loading-card">
    <div class="loading-head"><div><small>Proses Formula Berjalan</small><h3>${escapeHtml(active.title)}</h3></div><div class="loader-ring">${progress}</div></div>
    <div class="progress"><div style="width:${progress}%"></div></div>
    <p>${escapeHtml(active.desc)}</p>
    <div class="steps">${stepHtml}</div>
    <ul class="process-list">${itemHtml}</ul>
  </div>`;
}

function pairText(prev, next, formulas){
  const hits = transitionFormulaHits(prev, next, formulas).slice(0,3);
  const hitText = hits.length ? hits.map(h => `${h.name} → ${h.hit.join(' ')}`).join(' | ') : 'belum ada rumus dominan';
  return `${prev.day || '-'} ${prev.digits.join('')} → ${next.day || '-'} ${next.digits.join('')} : ${hitText}`;
}

function transitionFormulaHits(prev, next, formulas){
  const target = uniqueDigits(next.digits);
  return formulas.map(f => {
    const out = uniqueDigits(f.fn(prev));
    const hit = out.filter(d => target.includes(d));
    return {name:f.name, family:f.family, hit, out};
  }).filter(x => x.hit.length).sort((a,b) => b.hit.length - a.hit.length || a.out.length - b.out.length);
}

function buildWeekPairs(rows, formulas, day, limit){
  if(!day || day === '-') return [];
  const chrono = rows.slice().reverse();
  const same = chrono.filter(r => r.day === day);
  const out = [];
  for(let i=Math.max(0, same.length-limit-1); i<same.length-1; i++){
    if(i < 0) continue;
    out.push(pairText(same[i], same[i+1], formulas));
  }
  return out;
}

function latestOperationCards(row){
  const a = row.digits;
  const cards = [];
  cards.push(`Tambah berantai: ${mod10(a[0]+a[1])}, ${mod10(a[1]+a[2])}, ${mod10(a[2]+a[3])}, ${mod10(a[3]+a[0])}`);
  cards.push(`Selisih berantai: ${Math.abs(a[0]-a[1])}, ${Math.abs(a[1]-a[2])}, ${Math.abs(a[2]-a[3])}, ${Math.abs(a[3]-a[0])}`);
  cards.push(`Cermin 9/10: ${uniqueDigits(flat(a.map(d => [mod10(9-d), mod10(10-d)]))).join(' ')}`);
  cards.push(`Root total ${sumDigits(row)} → ${digitalRoot(sumDigits(row))}`);
  cards.push(`Golden 6/4 dan Fibonacci 1/3/5/8 aktif pada semua digit terbaru.`);
  const info = twinInfo(row);
  if(info.twins.length){
    cards.push(`Pecah kembar ${info.twins.join(' ')} → ${twinSplitDigits(row).join(' ')}`);
    cards.push(`Digit tunggal setelah kembar ${info.singles.join(' ')} → ${twinMirrorSingleDigits(row).join(' ')}`);
  }else{
    cards.push(`Tidak ada kembar. Gerbang kanan-kiri → ${singlePairGateDigits(row).join(' ')}`);
  }
  cards.push(`Kunci hari ${row.day || '-'} → ${dayPairShiftDigits(row).join(' ')}`);
  return cards;
}

function buildProcessCards(rows, formulas){
  const latest = rows[0];
  const chrono = rows.slice().reverse();
  const recent = [];
  for(let i=Math.max(0, chrono.length-5); i<chrono.length-1; i++) recent.push(pairText(chrono[i], chrono[i+1], formulas));
  return {
    daily: recent,
    weeklyLatest: buildWeekPairs(rows, formulas, latest.day, 4),
    weeklyTarget: buildWeekPairs(rows, formulas, inferTargetDay(rows), 4),
    latestOps: latestOperationCards(latest)
  };
}

function inferTargetDay(rows){
  const latest = rows[0]?.day;
  if(!latest) return '-';
  const idx = DAYS.indexOf(latest);
  return idx >= 0 ? DAYS[(idx + 1) % 7] : '-';
}

function renderResult(r){
  const digitsHtml = r.finalDigits.map((d,i) => `<div class="digit">${d}<small>F${i+1}</small></div>`).join('');
  const statsHtml = `<div class="stats">
    <div class="stat"><div class="k">Data</div><div class="v">${r.rows.length}</div></div>
    <div class="stat"><div class="k">Latest</div><div class="v">${escapeHtml(r.latest.digits.join(''))}</div></div>
    <div class="stat"><div class="k">Target Hari</div><div class="v">${escapeHtml(r.targetDay)}</div></div>
    <div class="stat"><div class="k">Mode</div><div class="v">Rumus</div></div>
  </div>`;
  const topDigits = DIGITS.slice().sort((a,b) => r.candidate.score[b]-r.candidate.score[a] || a-b).map(d => {
    const fam = [...new Set(r.candidate.digitTrace[d].map(x => x.family))].slice(0,5).join(', ') || '-';
    return `<div class="rankitem"><div class="num">${d}</div><div><b>Digit ${d}</b><br><small>Jejak: ${escapeHtml(fam)}. Poin rumus: ${Math.round(r.candidate.score[d])}</small></div><span class="badge blue">${Math.round(r.candidate.score[d])}</span></div>`;
  }).join('');
  const formulaCards = r.audit.active.map((f,idx) => `<div class="formula-card">
    <b>${idx+1}. ${escapeHtml(f.name)}</b>
    <small>Keluarga: ${escapeHtml(f.family)}. Kunci rumus: ${f.key}.</small>
    <div class="chips">${f.digits.slice(0,10).map((d,i) => `<span class="chip ${i%3===0?'hot':i%3===1?'green':'red'}">${d}</span>`).join('')}</div>
  </div>`).join('');
  const tableHtml = renderDataTable(r.rows.slice(0,18));

  const processHtml = r.audit.process ? `<div class="section"><h3>Jejak Pembacaan Pelan</h3>
    <div class="audit-columns">
      <div><b>Transisi harian terbaru</b><ul class="process-list small">${r.audit.process.daily.map(x => `<li>${escapeHtml(x)}</li>`).join('')}</ul></div>
      <div><b>Hari sama per pekan</b><ul class="process-list small">${r.audit.process.weeklyLatest.concat(r.audit.process.weeklyTarget).slice(0,7).map(x => `<li>${escapeHtml(x)}</li>`).join('') || '<li>Belum cukup pasangan pekanan.</li>'}</ul></div>
      <div><b>Operasi latest</b><ul class="process-list small">${r.audit.process.latestOps.map(x => `<li>${escapeHtml(x)}</li>`).join('')}</ul></div>
    </div>
  </div>` : '';
  $('output').className = '';
  $('output').innerHTML = `<div class="result-block">
    <div class="final-card">
      <h3>6 Digit Formula + 1 Kandidat Kembar</h3>
      <div class="digits">${digitsHtml}</div>
      <div class="twin-box"><small>Kandidat kembar rumus</small><b>${r.twinDigit}${r.twinDigit}</b></div>
      <p class="tagline">Engine V4.2 membaca pelan operasi tambah, kurang, kali, bagi bulat, tetangga cincin, cermin 9/10, root, sudut-tengah, golden shift, Fibonacci shift, affine modular, rumus hari, dan pecah kembar.</p>
    </div>
    <div class="section"><h3>Ringkasan</h3>${statsHtml}</div>
    <div class="section"><h3>Rumus Dominan Saat Ini</h3><div class="formula-grid">${formulaCards}</div></div>
    <div class="section"><h3>Ranking Digit Berdasarkan Rumus</h3><div class="rank">${topDigits}</div></div>
    ${processHtml}
    <div class="section"><h3>Arsip Terbaru</h3>${tableHtml}</div>
  </div>`;
}

function renderDataTable(rows){
  if(!rows.length) return '<p>Tidak ada data.</p>';
  const body = rows.map(r => `<tr><td>${escapeHtml(r.date || '-')}</td><td>${escapeHtml(r.day || '-')}</td><td>${escapeHtml(r.code || '-')}</td><td>${escapeHtml(String(r.period || '-'))}</td><td><b>${escapeHtml(r.digits.join(' '))}</b></td></tr>`).join('');
  return `<div class="table-wrap"><table class="data-table"><thead><tr><th>Tanggal</th><th>Hari</th><th>Kode</th><th>Periode</th><th>Digit</th></tr></thead><tbody>${body}</tbody></table></div>`;
}

function safeDivDigits(a,b){
  const out = [];
  if(b !== 0) out.push(Math.floor(a/b)%10);
  if(a !== 0) out.push(Math.floor(b/a)%10);
  if(b !== 0) out.push(mod10(a % b));
  if(a !== 0) out.push(mod10(b % a));
  return out;
}
function sumDigits(r){return (r.digits || []).reduce((s,d) => s+d,0);}
function digitalRoot(n){n=Math.abs(Number(n)||0); if(n===0) return 0; return ((n-1)%9)+1;}
function mod10(n){return ((Number(n)||0)%10+10)%10;}
function flat(arr){return arr.reduce((a,b) => a.concat(b), []);}
function uniqueDigits(arr){return [...new Set((arr || []).map(Number).filter(d => Number.isInteger(d) && d>=0 && d<=9))];}
function countMap(arr){const m={}; (arr||[]).forEach(x => m[x]=(m[x]||0)+1); return m;}
function escapeHtml(value){return String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
function debounce(fn, ms){let t; return (...args) => {clearTimeout(t); t = setTimeout(() => fn(...args), ms);};}
