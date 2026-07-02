'use strict';

const APP_VERSION = 'IPHOEL Formula Engine V6.4 • Target Edge + Diagonal + Mirror-Zero + Twin-Single + Anchor Rotation + Boundary Root-Twin + Anchor Sum-Lock Bridge';
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
    // V4.7 Parser Guard:
    // Kode market dan nomor periode boleh dibaca untuk arsip/fallback urutan,
    // tetapi rumus utama tetap memakai hari, tanggal, dan 4 digit hasil.
    const afterBracket = codeMatch ? line.slice(line.lastIndexOf(']') + 1) : line;
    let digits = codeMatch ? parseDigitsFromString(afterBracket).slice(0,4) : [];
    if(digits.length < 4){
      const nums = line.match(/(?<!\d)\d(?!\d)/g) || [];
      digits = nums.slice(-4).map(Number);
    }
    if(digits.length < 4) return;
    rows.push({
      code: codeMatch ? codeMatch[1].toUpperCase() : '',
      period: codeMatch ? (Number(codeMatch[2]) || 0) : 0,
      date: extractDate(line),
      day: normalizeDay(line),
      digits,
      raw: line,
      inputIndex: idx
    });
  });
  const seen = new Set();
  return rows.filter(r => {
    const key = `${r.code}|${r.period}|${r.date}|${r.day}|${r.digits.join('')}`;
    if(seen.has(key)) return false;
    seen.add(key);
    return true;
  }).sort((a,b) => {
    const dd = dateValue(b.date) - dateValue(a.date);
    if(dd) return dd;
    const pd = (b.period || 0) - (a.period || 0);
    if(pd) return pd;
    return (a.inputIndex || 0) - (b.inputIndex || 0);
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

function buildFormulaPrediction(inputRows){
  // V5.3: jika pengguna menempel beberapa pasaran sekaligus, engine tidak mencampur semua angka.
  // App memilih pasaran dari baris pertama yang ditempel, lalu membaca pola lokal pasaran itu.
  const allRows = inputRows || [];
  const rows = selectActiveMarketRows(allRows);
  const latest = rows[0];
  const chrono = rows.slice().reverse();
  const formulas = buildFormulaLibrary();
  const targetDay = inferTargetDay(rows);
  const transitionProfile = buildTransitionProfile(rows, targetDay);
  const twinCycleProfile = buildTwinCycleProfile(rows, targetDay);
  const marketProfile = buildMarketAdaptiveProfile(rows, allRows, targetDay);
  const learned = learnFormulaWeights(chrono, formulas);
  const learnedDay = learnDayFormulaWeights(chrono, formulas, latest.day);
  const learnedWeekLatest = learnWeekFormulaWeights(chrono, formulas, latest.day);
  const learnedWeekTarget = learnWeekFormulaWeights(chrono, formulas, targetDay);
  const targetAnchor = findTargetDayAnchor(rows, targetDay);
  const candidate = scoreCurrent(latest, formulas, learned, learnedDay, learnedWeekLatest, learnedWeekTarget);
  candidate.transitionProfile = transitionProfile;
  candidate.twinCycleProfile = twinCycleProfile;
  candidate.marketProfile = marketProfile;
  applyTargetDayAnchor(candidate, targetAnchor, formulas, latest);
  applyTransitionCarryProfile(candidate, latest, transitionProfile);
  applyMarketAdaptiveMemory(candidate, latest, targetAnchor, marketProfile);
  applyBoundaryTailMirrorCluster(candidate, latest, targetAnchor, transitionProfile);
  applyComplementCarryBridge(candidate, latest, targetAnchor, transitionProfile);
  applyCenterBridgeFormula(candidate, latest, targetAnchor, marketProfile);
  applyTargetEdgeBridge(candidate, latest, targetAnchor, transitionProfile, marketProfile);
  applyTargetDiagonalBridge(candidate, latest, targetAnchor, transitionProfile, marketProfile);
  applyTargetMirrorZeroBridge(candidate, latest, targetAnchor, transitionProfile, marketProfile);
  applyTargetTwinSingleBridge(candidate, latest, targetAnchor, transitionProfile, marketProfile);
  applyTargetAnchorRotationBridge(candidate, latest, targetAnchor, transitionProfile, marketProfile);
  applyTargetBoundaryRootTwinBridge(candidate, latest, targetAnchor, transitionProfile, marketProfile);
  applyTargetAnchorSumLockBridge(candidate, latest, targetAnchor, transitionProfile, marketProfile);
  const replayProfile = buildWorldFormulaReplayProfile(rows, targetDay);
  candidate.replayProfile = replayProfile;
  applyWorldFormulaReplay(candidate, latest, replayProfile);
  applyPostTwinAdaptiveSpread(candidate, latest, targetAnchor, transitionProfile, twinCycleProfile);
  const akle = buildAKLEPrediction(rows, candidate, formulas, targetAnchor);
  const finalDigits = chooseFormulaDigits(candidate, latest);
  forceAKLEMiddleRescue(finalDigits, akle, candidate);
  forceTwinAnchorSingleRescue(finalDigits, latest, candidate);
  forceTargetAnchorCarryRescue(finalDigits, latest, candidate);
  forceTwinSingleMirrorExpandedRescue(finalDigits, latest, candidate);
  forceTransitionCarryRescue(finalDigits, latest, candidate);
  forceMarketAdaptiveMemoryRescue(finalDigits, latest, candidate);
  forceMarketCarryBalanceRescue(finalDigits, latest, candidate);
  forceBoundaryTailMirrorRescue(finalDigits, latest, candidate);
  forcePostTwinSpreadRescue(finalDigits, latest, candidate);
  forceComplementCarryBridgeRescue(finalDigits, latest, candidate);
  forceCenterBridgeRescue(finalDigits, latest, candidate);
  forceWorldFormulaReplayRescue(finalDigits, latest, candidate);
  forceTargetEdgeBridgeRescue(finalDigits, latest, candidate);
  forceTargetDiagonalBridgeRescue(finalDigits, latest, candidate);
  forceTargetMirrorZeroBridgeRescue(finalDigits, latest, candidate);
  forceTargetTwinSingleBridgeRescue(finalDigits, latest, candidate);
  forceTargetAnchorRotationBridgeRescue(finalDigits, latest, candidate);
  forceTargetBoundaryRootTwinBridgeRescue(finalDigits, latest, candidate);
  forceTargetAnchorSumLockBridgeRescue(finalDigits, latest, candidate);
  forceMarketCarryBalanceRescue(finalDigits, latest, candidate);
  forceCenterBridgeRescue(finalDigits, latest, candidate);
  forceWorldFormulaReplayRescue(finalDigits, latest, candidate);
  forceTargetEdgeBridgeRescue(finalDigits, latest, candidate);
  forceTargetDiagonalBridgeRescue(finalDigits, latest, candidate);
  forceTargetMirrorZeroBridgeRescue(finalDigits, latest, candidate);
  forceTargetTwinSingleBridgeRescue(finalDigits, latest, candidate);
  forceTargetAnchorRotationBridgeRescue(finalDigits, latest, candidate);
  forceTargetBoundaryRootTwinBridgeRescue(finalDigits, latest, candidate);
  forceTargetAnchorSumLockBridgeRescue(finalDigits, latest, candidate);
  const twinDigit = chooseTwinDigit(candidate, finalDigits, latest);
  const audit = buildLocalFormulaAudit(rows, formulas, learned, learnedWeekLatest, learnedWeekTarget);
  audit.twinLab = buildTwinLabAudit(candidate.twinAudit);
  audit.twinCycle = buildTwinCycleAudit(twinCycleProfile);
  audit.targetAnchor = buildTargetAnchorAudit(targetAnchor, formulas);
  audit.transitionProfile = buildTransitionProfileAudit(transitionProfile, latest);
  audit.marketProfile = buildMarketProfileAudit(marketProfile, latest);
  audit.complementBridge = buildComplementBridgeAudit(candidate.complementBridgeAudit);
  audit.centerBridge = buildCenterBridgeAudit(candidate.centerBridgeAudit);
  audit.targetEdgeBridge = buildTargetEdgeBridgeAudit(candidate.targetEdgeBridgeAudit);
  audit.targetDiagonalBridge = buildTargetDiagonalBridgeAudit(candidate.targetDiagonalBridgeAudit);
  audit.targetMirrorZeroBridge = buildTargetMirrorZeroBridgeAudit(candidate.targetMirrorZeroBridgeAudit);
  audit.targetTwinSingleBridge = buildTargetTwinSingleBridgeAudit(candidate.targetTwinSingleBridgeAudit);
  audit.targetAnchorRotationBridge = buildTargetAnchorRotationBridgeAudit(candidate.targetAnchorRotationBridgeAudit);
  audit.targetBoundaryRootTwinBridge = buildTargetBoundaryRootTwinBridgeAudit(candidate.targetBoundaryRootTwinBridgeAudit);
  audit.targetAnchorSumLockBridge = buildTargetAnchorSumLockBridgeAudit(candidate.targetAnchorSumLockBridgeAudit);
  audit.worldReplay = buildWorldFormulaReplayAudit(replayProfile, candidate);
  audit.process = buildProcessCards(rows, formulas);
  return {rows, allRows, latest, targetDay, targetAnchor, transitionProfile, twinCycleProfile, marketProfile, replayProfile, formulas, learned, learnedDay, learnedWeekLatest, learnedWeekTarget, candidate, finalDigits, twinDigit, akle, audit};
}



function selectActiveMarketRows(rows){
  rows = rows || [];
  if(!rows.length) return rows;
  const codes = uniqueText((rows || []).map(r => r.code).filter(Boolean));
  if(codes.length <= 1) return rows;
  const firstRow = rows.slice().sort((a,b) => (a.inputIndex || 0) - (b.inputIndex || 0))[0];
  const firstCode = firstRow?.code || rows[0]?.code || '';
  const selected = firstCode ? rows.filter(r => r.code === firstCode) : [];
  return selected.length >= 8 ? selected : rows;
}

function uniqueText(arr){return [...new Set((arr || []).map(x => String(x || '').trim()).filter(Boolean))];}

function buildMarketAdaptiveProfile(rows, allRows, targetDay){
  const latest = rows[0] || {};
  const chrono = rows.slice().reverse();
  const code = latest.code || '-';
  const profile = {
    code,
    fromDay: latest.day || '-',
    toDay: targetDay || '-',
    marketRows: rows.length,
    allRows: (allRows || []).length,
    drawDays:{},
    total:0,
    targetDayTotal:0,
    nextDigitCounts:Array(10).fill(0),
    nextDigitRate:Array(10).fill(0),
    digitScore:Array(10).fill(0),
    twinScore:Array(10).fill(0),
    twinDigitCounts:Array(10).fill(0),
    pairTemplateStats:{AK:{}, LE:{}},
    strongestTemplates:{AK:[], LE:[]},
    carryOverlapDist:{},
    targetCarryMax:4,
    targetCarryAvg:0,
    targetCarrySoftCap:3,
    targetCarryHardCap:4,
    targetCarrySamples:0,
    positionCarry:Array(4).fill(0),
    positionCarryRate:Array(4).fill(0),
    carryDigitCounts:Array(10).fill(0),
    nonCarryDigitCounts:Array(10).fill(0),
    nonCarryScore:Array(10).fill(0),
    twinAfterNoTwinCounts:Array(10).fill(0),
    twinAfterNoTwinScore:Array(10).fill(0),
    samples:[],
    transitionSamples:[]
  };
  rows.forEach(r => { if(r.day) profile.drawDays[r.day] = (profile.drawDays[r.day] || 0) + 1; });

  const addDigit = (d, amount) => {
    d = Number(d);
    if(Number.isInteger(d) && d >= 0 && d <= 9) profile.nextDigitCounts[d] += amount;
  };
  const addTwinDigit = (d, amount) => {
    d = Number(d);
    if(Number.isInteger(d) && d >= 0 && d <= 9) profile.twinDigitCounts[d] += amount;
  };
  const addTemplate = (kind, tpl, amount, note) => {
    if(!tpl || !tpl.id || !/^\d{2}$/.test(tpl.pair)) return;
    const table = profile.pairTemplateStats[kind];
    if(!table[tpl.id]) table[tpl.id] = {id:tpl.id, label:tpl.label, points:0, hits:0, near:0, trials:0, examples:[]};
    table[tpl.id].points += amount;
    table[tpl.id].trials += 1;
    if(amount >= 40) table[tpl.id].hits += 1;
    else if(amount > 0) table[tpl.id].near += 1;
    if(note && table[tpl.id].examples.length < 4) table[tpl.id].examples.push(note);
  };

  let carryOverlapTotal = 0;
  let carryOverlapMax = 0;
  for(let i=0;i<chrono.length-1;i++){
    const prev = chrono[i];
    const next = chrono[i+1];
    const recencyBoost = 1 + (i / Math.max(1, chrono.length-1));
    const sameTransition = prev.day === profile.fromDay && next.day === profile.toDay;
    if(next.day === profile.toDay){
      profile.targetDayTotal += 1;
      uniqueDigits(next.digits).forEach(d => addDigit(d, 0.34 * recencyBoost));
    }
    if(sameTransition){
      profile.total += 1;
      const prevUnique = uniqueDigits(prev.digits);
      const nextUnique = uniqueDigits(next.digits);
      const carryOverlap = nextUnique.filter(d => prevUnique.includes(d)).length;
      profile.carryOverlapDist[carryOverlap] = (profile.carryOverlapDist[carryOverlap] || 0) + 1;
      carryOverlapTotal += carryOverlap;
      carryOverlapMax = Math.max(carryOverlapMax, carryOverlap);
      profile.targetCarrySamples += 1;
      nextUnique.forEach(d => {
        if(prevUnique.includes(d)) profile.carryDigitCounts[d] += 1.0 * recencyBoost;
        else profile.nonCarryDigitCounts[d] += 1.35 * recencyBoost;
      });
      for(let pos=0; pos<4; pos++){
        if(next.digits && prev.digits && next.digits[pos] === prev.digits[pos]) profile.positionCarry[pos] += 1;
      }
      uniqueDigits(next.digits).forEach(d => addDigit(d, 1.85 * recencyBoost));
      const prevHadTwin = twinInfo(prev).twins.length > 0;
      const nextTwins = twinInfo(next).twins;
      nextTwins.forEach(d => {
        addTwinDigit(d, 2.4 * recencyBoost);
        if(!prevHadTwin) profile.twinAfterNoTwinCounts[d] += 2.1 * recencyBoost;
      });
      if(profile.transitionSamples.length < 8) profile.transitionSamples.push(`${prev.day} ${prev.digits.join('')} → ${next.day} ${next.digits.join('')} | carry overlap ${carryOverlap}`);
    }

    ['AK','LE'].forEach(kind => {
      const actual = kind === 'AK' ? `${next.digits[0]}${next.digits[1]}` : `${next.digits[2]}${next.digits[3]}`;
      marketPairTransformSeeds(prev, kind).forEach(tpl => {
        if(tpl.pair === actual){
          addTemplate(kind, tpl, sameTransition ? 92 : 34, `${prev.digits.join('')}→${next.digits.join('')} tembus ${actual}`);
        }else if(tpl.pair[0] === actual[0] && sameTransition){
          addTemplate(kind, tpl, 14, `${tpl.pair} dekat depan ${actual}`);
        }else if(tpl.pair[1] === actual[1] && sameTransition){
          addTemplate(kind, tpl, 12, `${tpl.pair} dekat belakang ${actual}`);
        }else if(sameTransition){
          addTemplate(kind, tpl, 1, 'trial transisi');
        }
      });
    });
  }

  const denom = Math.max(1, profile.total*1.85 + profile.targetDayTotal*0.34);
  profile.nextDigitRate = profile.nextDigitCounts.map(x => x / denom);
  profile.targetCarryAvg = profile.targetCarrySamples ? carryOverlapTotal / profile.targetCarrySamples : 2.4;
  profile.targetCarryMax = profile.targetCarrySamples ? carryOverlapMax : 4;
  const overTwo = Object.keys(profile.carryOverlapDist).map(Number).filter(k => k > 2).reduce((s,k) => s + (profile.carryOverlapDist[k] || 0), 0);
  const overTwoRate = profile.targetCarrySamples ? overTwo / profile.targetCarrySamples : 1;
  // V5.4: jika transisi market historis tidak pernah membawa lebih dari 2 digit,
  // output tidak boleh terlalu penuh oleh angka latest. Ini rem, bukan hardcode angka.
  profile.targetCarrySoftCap = profile.targetCarrySamples >= 5 && overTwoRate <= 0.16 ? 2 : Math.max(2, Math.min(3, Math.round(profile.targetCarryAvg + 1)));
  profile.targetCarryHardCap = profile.targetCarrySamples >= 5 && overTwoRate <= 0.16 ? 2 : Math.max(profile.targetCarrySoftCap, Math.min(4, profile.targetCarryMax || 3));
  profile.positionCarryRate = profile.positionCarry.map(x => profile.total ? x / profile.total : 0);
  DIGITS.forEach(d => {
    // Digit memory bukan pengganti rumus; ia hanya kalibrasi lokal dari transisi pasaran yang sedang ditempel.
    profile.digitScore[d] = Math.round(320 + 1850*profile.nextDigitRate[d] + 38*Math.min(6, profile.nextDigitCounts[d]));
    profile.nonCarryScore[d] = Math.round(170 + 620*(profile.nonCarryDigitCounts[d] || 0));
    profile.twinScore[d] = Math.round(220 + 680*(profile.twinDigitCounts[d] || 0));
    profile.twinAfterNoTwinScore[d] = Math.round(160 + 760*(profile.twinAfterNoTwinCounts[d] || 0));
  });
  ['AK','LE'].forEach(kind => {
    profile.strongestTemplates[kind] = Object.values(profile.pairTemplateStats[kind])
      .filter(x => x.points >= 16)
      .sort((a,b) => b.points - a.points || b.hits - a.hits)
      .slice(0,8);
  });
  if(profile.total || profile.targetDayTotal){
    const topDigits = DIGITS.slice().sort((a,b) => profile.digitScore[b]-profile.digitScore[a]).slice(0,6).join(' ');
    profile.samples.push(`Digit lokal terkuat ${profile.fromDay}→${profile.toDay}: ${topDigits}`);
    profile.samples.push(`Carry cap ${profile.fromDay}→${profile.toDay}: soft ${profile.targetCarrySoftCap}, hard ${profile.targetCarryHardCap}, distribusi ${Object.keys(profile.carryOverlapDist).sort((a,b)=>Number(a)-Number(b)).map(k => `${k}:${profile.carryOverlapDist[k]}`).join(' | ') || '-'}`);
    if(profile.strongestTemplates.AK.length) profile.samples.push(`Template AK: ${profile.strongestTemplates.AK.slice(0,3).map(x => x.label).join(' | ')}`);
    if(profile.strongestTemplates.LE.length) profile.samples.push(`Template LE: ${profile.strongestTemplates.LE.slice(0,3).map(x => x.label).join(' | ')}`);
  }
  return profile;
}

function marketPairTransformSeeds(row, kind){
  const a = row?.digits || [];
  if(a.length < 4) return [];
  const out = [];
  const add = (id, pair, label, weight=1) => { if(/^\d{2}$/.test(pair)) out.push({id, pair, label, weight, width:2}); };
  const pair = (x,y) => `${mod10(x)}${mod10(y)}`;
  const root = digitalRoot(sumDigits(row));
  const total = sumDigits(row) % 10;
  const ae = mod10(a[0] + a[3]);
  const kl = mod10(a[1] + a[2]);
  const ak = mod10(a[0] + a[1]);
  const le = mod10(a[2] + a[3]);
  const al = mod10(a[0] + a[2]);
  const ke = mod10(a[1] + a[3]);
  const midDiff = Math.abs((a[0]+a[3]) - (a[1]+a[2])) % 10;
  const m9 = d => mod10(9-d);
  const m10 = d => mod10(10-d);
  if(kind === 'AK'){
    add('carry_AK', pair(a[0],a[1]), 'carry A-K', 1.0);
    add('reverse_KA', pair(a[1],a[0]), 'balik K-A', 1.0);
    add('mirrorA_carryK', pair(m9(a[0]),a[1]), 'mirror9 A + carry K', 1.05);
    add('mirror10A_carryK', pair(m10(a[0]),a[1]), 'mirror10 A + carry K', 1.0);
    add('KL_carryK', pair(kl,a[1]), 'K+L + carry K', 1.1);
    add('AK_carryA', pair(ak,a[0]), 'A+K + carry A', 0.95);
    add('AE_carryA', pair(ae,a[0]), 'A+E + carry A', 1.15);
    add('AL_carryA', pair(al,a[0]), 'A+L + carry A', 1.05);
    add('root_carryK', pair(root,a[1]), 'root + carry K', 0.9);
    add('total_carryA', pair(total,a[0]), 'total mod10 + carry A', 0.85);
    add('mirrorE_mirror10E', pair(m9(a[3]),m10(a[3])), 'cermin ekor 9/10', 0.9);
    add('carryE_KE', pair(a[3],ke), 'carry E + K+E', 1.18);
    add('carryE_KL', pair(a[3],kl), 'carry E + K+L', 1.0);
    add('midDiff_KL', pair(midDiff,kl), 'beda sudut-tengah + K+L', 0.82);
    add('KL_AK', pair(kl,ak), 'K+L + A+K', 0.98);
  }else{
    add('carry_LE', pair(a[2],a[3]), 'carry L-E', 1.0);
    add('reverse_EL', pair(a[3],a[2]), 'balik E-L', 0.95);
    add('AE_carryA', pair(ae,a[0]), 'A+E + carry A', 1.18);
    add('AE_carryK', pair(ae,a[1]), 'A+E + carry K', 1.0);
    add('KL_carryE', pair(kl,a[3]), 'K+L + carry E', 1.05);
    add('LE_carryE', pair(le,a[3]), 'L+E + carry E', 0.95);
    add('root_root', pair(root,root), 'root-root', 1.0);
    add('root_carryE', pair(root,a[3]), 'root + carry E', 0.9);
    add('mirror10E_downE', pair(m10(a[3]),mod10(a[3]-1)), 'mirror10 E + tetangga turun E', 0.92);
    add('carryK_mirror10E', pair(a[1],m10(a[3])), 'carry K + mirror10 E', 1.22);
    add('carryK_mirror9E', pair(a[1],m9(a[3])), 'carry K + mirror9 E', 1.0);
    add('mirrorL_carryE', pair(m9(a[2]),a[3]), 'mirror9 L + carry E', 0.86);
    add('AL_carryA', pair(al,a[0]), 'A+L + carry A', 0.82);
    add('KE_carryK', pair(ke,a[1]), 'K+E + carry K', 0.82);
    add('KL_KE', pair(kl,ke), 'K+L + K+E', 1.16);
    add('KL_AK', pair(kl,ak), 'K+L + A+K', 0.94);
  }
  return out;
}

function applyMarketAdaptiveMemory(candidate, latest, targetAnchor, profile){
  candidate.marketMemoryScore = Array(10).fill(0);
  candidate.marketNonCarryScore = Array(10).fill(0);
  candidate.marketCarryScore = Array(10).fill(0);
  if(!profile || !profile.marketRows) return;
  const add = (d, amount, note) => {
    d = Number(d);
    if(!Number.isInteger(d) || d < 0 || d > 9) return;
    candidate.marketMemoryScore[d] += amount;
    addCandidateTrace(candidate, d, amount, note, 'marketMemory');
  };
  DIGITS.forEach(d => {
    const base = profile.digitScore?.[d] || 0;
    if(base > 0) add(d, Math.round(0.55*base), `Market memory ${profile.code} ${profile.fromDay}→${profile.toDay}`);
    const nonCarry = profile.nonCarryScore?.[d] || 0;
    const carryLocal = profile.carryDigitCounts?.[d] || 0;
    candidate.marketNonCarryScore[d] = nonCarry;
    candidate.marketCarryScore[d] = Math.round(120 + 480*carryLocal);
    if(nonCarry > 220) add(d, Math.round(0.22*nonCarry), `Market non-carry spread ${profile.code}`);
    const twin = profile.twinScore?.[d] || 0;
    if(twin > 300) add(d, Math.round(0.28*twin), `Market twin memory ${profile.code}`);
  });
  // Template pair yang historis kuat ikut menyumbang digit penyusunnya, tetapi tetap sebagai bobot lunak.
  ['AK','LE'].forEach(kind => {
    marketAdaptivePairSeeds(latest, {marketProfile:profile}, kind).slice(0,5).forEach(seed => {
      add(Number(seed.pair[0]), Math.round(seed.bonus*0.025), `Market template ${kind}: ${seed.label}`);
      add(Number(seed.pair[1]), Math.round(seed.bonus*0.025), `Market template ${kind}: ${seed.label}`);
    });
  });
  if(targetAnchor && targetAnchor.digits){
    uniqueDigits(targetAnchor.digits).forEach(d => add(d, 95, `Market anchor support ${profile.code}`));
  }
}

function forceMarketCarryBalanceRescue(selected, latest, candidate){
  const profile = candidate.marketProfile;
  if(!profile || profile.total < 5 || !latest?.digits?.length) return;
  const latestSet = uniqueDigits(latest.digits);
  const hardCap = Number(profile.targetCarryHardCap || 4);
  if(hardCap >= 4) return;
  let carrySelected = selected.filter(d => latestSet.includes(Number(d)));
  if(carrySelected.length <= hardCap) return;

  const traceWidth = d => new Set((candidate.digitTrace?.[d] || []).map(x => x.family)).size;
  const posRateByDigit = d => {
    let best = 0;
    (latest.digits || []).forEach((x,idx) => { if(Number(x) === Number(d)) best = Math.max(best, profile.positionCarryRate?.[idx] || 0); });
    return best;
  };
  const carryStrength = d =>
    (candidate.score?.[d] || 0) +
    10*traceWidth(d) +
    460*posRateByDigit(d) +
    0.26*((candidate.marketCarryScore || [])[d] || 0) +
    0.16*((candidate.targetAnchorScore || [])[d] || 0);

  const protectedCarry = new Set(
    carrySelected.slice().sort((a,b) => carryStrength(b)-carryStrength(a)).slice(0, hardCap).map(Number)
  );

  const outsiderScore = d =>
    (candidate.score?.[d] || 0) +
    0.95*((candidate.marketNonCarryScore || [])[d] || 0) +
    0.38*((candidate.marketMemoryScore || [])[d] || 0) +
    10*traceWidth(d) +
    0.10*((candidate.targetAnchorScore || [])[d] || 0);

  const outsiders = DIGITS.slice()
    .filter(d => !selected.includes(d) && !latestSet.includes(d))
    .sort((a,b) => outsiderScore(b) - outsiderScore(a) || a-b);

  for(const outsider of outsiders){
    carrySelected = selected.filter(d => latestSet.includes(Number(d)));
    if(carrySelected.length <= hardCap) break;
    const victim = carrySelected
      .filter(d => !protectedCarry.has(Number(d)))
      .sort((a,b) => carryStrength(a)-carryStrength(b) || candidate.score[a]-candidate.score[b])[0];
    if(victim == null) break;
    // V5.4: hard cap benar-benar diterapkan jika sejarah transisi market membuktikan
    // carry lebih dari batas ini hampir tidak terjadi. Outsider tetap dipilih dari skor non-carry terbaik.
    selected[selected.indexOf(victim)] = outsider;
  }
}

function forceMarketAdaptiveMemoryRescue(selected, latest, candidate){
  const profile = candidate.marketProfile;
  const memory = candidate.marketMemoryScore || [];
  if(!profile || profile.total < 3 || !memory.length) return;
  const topMemory = DIGITS.slice().sort((a,b) => memory[b]-memory[a] || (candidate.score[b]||0)-(candidate.score[a]||0)).slice(0,4);
  const present = topMemory.filter(d => selected.includes(d)).length;
  if(present >= 2) return;
  const protectedSet = new Set();
  DIGITS.slice().sort((a,b) => candidate.score[b]-candidate.score[a]).slice(0,3).forEach(d => { if(selected.includes(d)) protectedSet.add(Number(d)); });
  (candidate.transitionProfile?.positionCarryRate || []).forEach((rate,idx) => {
    const d = latest?.digits?.[idx];
    if(rate >= 0.42 && selected.includes(d)) protectedSet.add(Number(d));
  });
  topMemory.filter(d => !selected.includes(d)).slice(0, 2-present).forEach(d => {
    replaceWeakestForRescue(selected, d, candidate, protectedSet);
    protectedSet.add(Number(d));
  });
}



function akleFlowPairSeeds(latest, candidate, kind){
  const a = latest?.digits || [];
  if(a.length < 4) return [];
  const seeds = [];
  const add = (pair, bonus, label) => { if(/^\d{2}$/.test(pair)) seeds.push({pair,width:2,bonus,label}); };
  const ae = mod10(a[0] + a[3]);
  const kl = mod10(a[1] + a[2]);
  const ke = mod10(a[1] + a[3]);
  const m10e = mod10(10 - a[3]);
  const m9e = mod10(9 - a[3]);
  const lowCarry = Number(candidate?.marketProfile?.targetCarrySamples || candidate?.marketProfile?.total || 0) >= 5 && Number(candidate?.marketProfile?.targetCarryHardCap || 4) <= 2;
  if(ae === 0){
    // Complement zero bridge: contoh 6934 → AK 96 dan LE 06.
    if(kind === 'AK'){
      add(`${a[1]}${a[0]}`, 19800, 'AK complement flow: carry K + carry A');
      add(`${a[1]}${ae}`, 8800, 'AK complement flow: carry K + zero bridge');
    }else{
      add(`${ae}${a[0]}`, 21400, 'LE complement flow: zero bridge + carry A');
      add(`${ae}${a[1]}`, 9800, 'LE complement flow: zero bridge + carry K');
      add(`${a[0]}${ae}`, 7200, 'LE complement flow: carry A + zero bridge');
    }
  }else if(lowCarry){
    // Low-carry flow: jangan hanya carry; baca E→center dan K→mirror ekor.
    if(kind === 'AK'){
      add(`${a[3]}${ke}`, 11800, 'AK flow: carry E + K+E');
      add(`${a[3]}${kl}`, 7400, 'AK flow: carry E + K+L');
      add(`${kl}${ke}`, 5200, 'AK flow: K+L + K+E');
    }else{
      add(`${a[1]}${m10e}`, 12600, 'LE flow: carry K + mirror10 E');
      add(`${a[1]}${m9e}`, 7600, 'LE flow: carry K + mirror9 E');
      add(`${kl}${m10e}`, 5200, 'LE flow: K+L + mirror10 E');
    }
  }
  return seeds;
}

function centerBridgePairSeeds(latest, candidate, kind){
  const a = latest?.digits || [];
  if(a.length < 4) return [];
  const profile = candidate?.marketProfile;
  const lowCarry = Number(profile?.targetCarrySamples || profile?.total || 0) >= 5 && Number(profile?.targetCarryHardCap || 4) <= 2;
  const kl = mod10(a[1] + a[2]);
  const ke = mod10(a[1] + a[3]);
  const ak = mod10(a[0] + a[1]);
  const le = mod10(a[2] + a[3]);
  const root = digitalRoot(sumDigits(latest));
  const base = lowCarry ? 13200 : 5200;
  const seeds = [];
  const add = (pair, bonus, label) => { if(/^\d{2}$/.test(pair)) seeds.push({pair,width:2,bonus,label}); };
  if(kind === 'AK'){
    add(`${kl}${a[1]}`, base + 1200, 'AK center bridge: K+L + carry K');
    add(`${kl}${ak}`, Math.round(base*0.74), 'AK center bridge: K+L + A+K');
    add(`${ke}${a[1]}`, Math.round(base*0.52), 'AK center bridge: K+E + carry K');
    add(`${root}${a[1]}`, Math.round(base*0.34), 'AK center bridge: root + carry K');
  }else{
    add(`${kl}${ke}`, base + 1800, 'LE center bridge: K+L + K+E');
    add(`${kl}${a[3]}`, Math.round(base*0.70), 'LE center bridge: K+L + carry E');
    add(`${ke}${kl}`, Math.round(base*0.58), 'LE center bridge: K+E + K+L');
    add(`${le}${ke}`, Math.round(base*0.42), 'LE center bridge: L+E + K+E');
  }
  return seeds;
}

function marketAdaptivePairSeeds(latest, candidate, kind){
  const profile = candidate?.marketProfile;
  if(!profile || !profile.strongestTemplates) return [];
  const stats = profile.pairTemplateStats?.[kind] || {};
  const seeds = [];
  marketPairTransformSeeds(latest, kind).forEach(tpl => {
    const st = stats[tpl.id];
    if(!st || st.points < 16) return;
    const transitionPower = profile.total >= 3 ? 1.0 : 0.68;
    const bonus = Math.round((1200 + 88*st.points + 420*st.hits + 90*st.near) * (tpl.weight || 1) * transitionPower);
    seeds.push({pair:tpl.pair, width:2, bonus, label:`${tpl.label} • market ${profile.code}`});
  });
  return seeds.sort((a,b) => b.bonus - a.bonus || a.pair.localeCompare(b.pair)).slice(0,10);
}

function buildMarketProfileAudit(profile, latest){
  if(!profile || !profile.marketRows) return null;
  const topDigits = DIGITS.slice().sort((a,b) => (profile.digitScore[b]||0)-(profile.digitScore[a]||0)).slice(0,6).map(d => `${d}:${Math.round(profile.digitScore[d]||0)}`).join(' | ');
  const topTwin = DIGITS.slice().sort((a,b) => (profile.twinScore[b]||0)-(profile.twinScore[a]||0)).slice(0,4).map(d => `${d}${d}:${Math.round(profile.twinScore[d]||0)}`).join(' | ');
  const nonCarry = DIGITS.slice().sort((a,b) => (profile.nonCarryScore[b]||0)-(profile.nonCarryScore[a]||0)).slice(0,5).map(d => `${d}:${Math.round(profile.nonCarryScore[d]||0)}`).join(' | ');
  const carryDist = Object.keys(profile.carryOverlapDist || {}).sort((a,b)=>Number(a)-Number(b)).map(k => `${k}:${profile.carryOverlapDist[k]}`).join(' | ');
  const ak = (profile.strongestTemplates?.AK || []).slice(0,3).map(x => x.label).join(' | ') || '-';
  const le = (profile.strongestTemplates?.LE || []).slice(0,3).map(x => x.label).join(' | ') || '-';
  return {
    title:`Market adaptive ${profile.code}: ${profile.fromDay} → ${profile.toDay} (${profile.total} transisi, ${profile.marketRows} baris)`,
    digits: topDigits,
    twin: `${topTwin}. Carry cap ${profile.targetCarryHardCap}; overlap ${carryDist || '-'}; non-carry ${nonCarry}`,
    ak,
    le,
    samples:(profile.transitionSamples || []).slice(0,4)
  };
}



// V5.7: AKLE diagnostic gates
// Kumpulan gerbang ini tetap operasi matematika, bukan hardcode pasaran. Tujuannya memastikan
// pasangan AK/LE tidak hanya didominasi template lama ketika rumus current membuka jalur baru.
function diagnosticAKLEPairSeeds(latest, candidate, kind){
  const a = latest?.digits || [];
  if(a.length < 4) return [];
  const [A,K,L,E] = a;
  const root = digitalRoot(sumDigits(latest));
  const total = mod10(sumDigits(latest));
  const m9 = d => mod10(9-d), m10 = d => mod10(10-d);
  const sum = (x,y) => mod10(x+y);
  const diff = (x,y) => Math.abs(x-y)%10;
  const triple = (...idx) => mod10(idx.reduce((s,i) => s + a[i], 0));
  const seeds = [];
  const add = (pair, bonus, label) => { if(/^\d{2}$/.test(pair)) seeds.push({pair, width:2, bonus, label}); };
  const replay = candidate?.replayProfile?.digitScore || Array(10).fill(0);
  const support = (x,y) => Math.round(0.018*((replay[x]||0)+(replay[y]||0)) + 0.025*((candidate?.score?.[x]||0)+(candidate?.score?.[y]||0)));
  if(kind === 'AK'){
    const candidates = [
      [`${mod10(root+6)}${m10(A)}`, 9200, 'AK diag: root+6 + mirror10 A'],
      [`${m10(K)}${triple(0,1,3)}`, 9000, 'AK diag: mirror10 K + A+K+E'],
      [`${E}${m10(E)}`, 8800, 'AK diag: carry E + mirror10 E'],
      [`${K}${diff(K,A)}`, 9000, 'AK diag: carry K + diff K-A'],
      [`${mod10(root+6)}${m9(K)}`, 9100, 'AK diag: root+6 + mirror9 K'],
      [`${diff(K,L)}${K}`, 8950, 'AK diag: diff K-L + carry K'],
      [`${K}${mod10(E+2)}`, 8800, 'AK diag: carry K + E+2'],
      [`${m9(A)}${K}`, 9200, 'AK diag: mirror9 A + carry K'],
      [`${sum(K,L)}${K}`, 7600, 'AK diag: K+L + carry K'],
      [`${sum(A,E)}${A}`, 7600, 'AK diag: A+E + carry A']
    ];
    candidates.forEach(([pair,base,label]) => add(pair, base + support(Number(pair[0]), Number(pair[1])), label));
  }else{
    const twinZero = twinInfo(latest).twins.length ? 0 : diff(K,L);
    const candidates = [
      [`${m9(total)}${A}`, 9000, 'LE diag: mirror9 total + carry A'],
      [`${m9(total)}${L}`, 8800, 'LE diag: mirror9 total + carry L'],
      [`${mod10(root+4)}${mod10(root+4)}`, 9200, 'LE diag: root+4 twin'],
      [`${E}${A}`, 9000, 'LE diag: carry E + carry A'],
      [`${diff(K,A)}${E}`, 9200, 'LE diag: diff K-A + carry E'],
      [`${L}${E}`, 9300, 'LE diag: carry L-E'],
      [`${sum(K,L)}0`, 9000, 'LE diag: K+L + zero/twin split'],
      [`${K}${L}`, 9100, 'LE diag: carry K-L'],
      [`${K}${E}`, 8800, 'LE diag: carry K-E'],
      [`${sum(K,L)}${sum(K,E)}`, 8200, 'LE diag: K+L + K+E'],
      [`${diff(K,L)}${twinZero}`, 7600, 'LE diag: diff center + twin split']
    ];
    candidates.forEach(([pair,base,label]) => add(pair, base + support(Number(pair[0]), Number(pair[1])), label));
  }
  return mergePairSeeds(seeds).sort((a,b) => b.bonus - a.bonus || a.pair.localeCompare(b.pair)).slice(0,12);
}

function applyDiagnosticAKLEPairLock(ranked, kind, latest, candidate){
  const seeds = diagnosticAKLEPairSeeds(latest, candidate, kind).slice(0,7);
  if(!seeds.length) return ranked;
  const map = {};
  ranked.forEach(x => map[x.pair] = {...x, notes:[...(x.notes || [])]});
  const ensure = (pair, points, note) => {
    if(!/^\d{2}$/.test(pair)) return;
    if(!map[pair]) map[pair] = {pair, points:0, notes:[]};
    map[pair].points = Math.max(map[pair].points, points);
    if(note && !map[pair].notes.includes(note)) map[pair].notes.unshift(note);
  };
  seeds.forEach((s,i) => ensure(s.pair, 15600 + (s.bonus || 0) - i*650, s.label || 'diagnostic AKLE'));
  return Object.values(map).sort((a,b) => b.points - a.points || a.pair.localeCompare(b.pair));
}

function twinDiagnosticScores(latest, candidate){
  const a = latest?.digits || [];
  const score = Array(10).fill(0);
  if(a.length < 4) return score;
  const [A,K,L,E] = a;
  const root = digitalRoot(sumDigits(latest));
  const add = (d, amount) => { d = Number(d); if(Number.isInteger(d) && d>=0 && d<=9) score[d] += amount; };
  const info = twinInfo(latest);
  const sameTwinCooldown = info.twins.length > 0;
  add(K, sameTwinCooldown ? 210 : 520);
  add(E, sameTwinCooldown ? 180 : 320);
  add(Math.abs(K-A)%10, E === 0 ? 930 : 470);
  add(Math.abs(K-L)%10, 380);
  add(mod10(root+4), 560);
  add(mod10(E+1), 430);
  add(mod10(A+L), 430);
  add(mod10(K+L), 350);
  add(mod10(K+E), 320);
  if(E === 0 || A === 0 || K === 0 || L === 0) add(0, 520);
  if(mod10(A+E) === 0) add(A, 760);
  if(info.twins.length){
    info.twins.forEach(t => {
      add(t, -900);
      add(mod10(t+t), 520);
      add(0, 460);
    });
  }
  DIGITS.forEach(d => {
    score[d] += 0.18*((candidate?.replayProfile?.twinScore || [])[d] || 0);
    score[d] += 0.05*((candidate?.worldReplayScore || [])[d] || 0);
  });
  return score;
}

// V5.7: World Formula Replay
// Mesin ini tidak mengunci angka berdasarkan pasaran. Ia membaca operasi matematika yang pernah tembus
// pada transisi hari yang sama, lalu menerapkan operasi yang sama pada latest.
function buildWorldFormulaReplayProfile(rows, targetDay){
  const latest = rows?.[0] || {};
  const chrono = (rows || []).slice().reverse();
  const profile = {
    code: latest.code || '-',
    fromDay: latest.day || '-',
    toDay: targetDay || '-',
    total:0,
    targetDayTotal:0,
    digitTemplates:{},
    twinTemplates:{},
    pairTemplates:{AK:{}, LE:{}},
    digitScore:Array(10).fill(0),
    twinScore:Array(10).fill(0),
    digitNotes:Array.from({length:10}, () => []),
    twinNotes:Array.from({length:10}, () => []),
    pairSeeds:{AK:[], LE:[]},
    samples:[]
  };
  const addTemplate = (table, id, label, amount, note) => {
    if(!id) return;
    if(!table[id]) table[id] = {id, label, points:0, hits:0, near:0, examples:[]};
    table[id].points += amount;
    if(amount >= 35) table[id].hits += 1; else table[id].near += 1;
    if(note && table[id].examples.length < 4) table[id].examples.push(note);
  };
  const addPairTemplate = (kind, id, label, amount, note) => addTemplate(profile.pairTemplates[kind], id, label, amount, note);

  for(let i=0;i<chrono.length-1;i++){
    const prev = chrono[i];
    const next = chrono[i+1];
    if(!prev?.digits || !next?.digits) continue;
    const sameTransition = prev.day === profile.fromDay && next.day === profile.toDay;
    const sameTargetDay = next.day === profile.toDay;
    if(sameTransition) profile.total += 1;
    if(sameTargetDay) profile.targetDayTotal += 1;
    const recency = 1 + (i / Math.max(1, chrono.length-1));
    const base = sameTransition ? 115*recency : (sameTargetDay ? 34*recency : 6*recency);
    const ops = worldFormulaOps(prev);
    const nextUnique = uniqueDigits(next.digits);
    const nextTwins = twinInfo(next).twins || [];
    ops.forEach(op => {
      if(nextUnique.includes(op.digit)){
        addTemplate(profile.digitTemplates, op.id, op.label, base * (op.weight || 1), `${prev.digits.join('')}→${next.digits.join('')} membuka ${op.digit}`);
      }
      if(nextTwins.includes(op.digit)){
        addTemplate(profile.twinTemplates, op.id, op.label, (sameTransition ? 210*recency : 52*recency) * (op.twinWeight || op.weight || 1), `${prev.digits.join('')}→${next.digits.join('')} twin ${op.digit}${op.digit}`);
      }
    });

    const pairOps = selectWorldPairOps(ops);
    ['AK','LE'].forEach(kind => {
      const actual = kind === 'AK' ? `${next.digits[0]}${next.digits[1]}` : `${next.digits[2]}${next.digits[3]}`;
      for(let x=0; x<pairOps.length; x++){
        for(let y=0; y<pairOps.length; y++){
          const p = `${pairOps[x].digit}${pairOps[y].digit}`;
          const id = `${pairOps[x].id}|${pairOps[y].id}`;
          const label = `${pairOps[x].label} + ${pairOps[y].label}`;
          if(p === actual){
            addPairTemplate(kind, id, label, (sameTransition ? 430 : 96) * recency * (pairOps[x].pairWeight || 1) * (pairOps[y].pairWeight || 1), `${prev.digits.join('')}→${next.digits.join('')} ${kind} ${actual}`);
          }else if(sameTransition && (p[0] === actual[0] || p[1] === actual[1])){
            addPairTemplate(kind, id, label, 8 * recency, `${p} dekat ${actual}`);
          }
        }
      }
    });
  }

  const currentOps = worldFormulaOps(latest);
  currentOps.forEach(op => {
    const meta = profile.digitTemplates[op.id];
    if(meta){
      const value = Math.round(meta.points * (op.weight || 1));
      profile.digitScore[op.digit] += value;
      if(profile.digitNotes[op.digit].length < 5) profile.digitNotes[op.digit].push(`${op.label} (${Math.round(value)})`);
    }
    const twinMeta = profile.twinTemplates[op.id];
    if(twinMeta){
      const value = Math.round(twinMeta.points * (op.twinWeight || op.weight || 1));
      profile.twinScore[op.digit] += value;
      if(profile.twinNotes[op.digit].length < 5) profile.twinNotes[op.digit].push(`${op.label} (${Math.round(value)})`);
    }
  });

  const currentPairOps = selectWorldPairOps(currentOps);
  ['AK','LE'].forEach(kind => {
    const seeds = [];
    for(let x=0; x<currentPairOps.length; x++){
      for(let y=0; y<currentPairOps.length; y++){
        const id = `${currentPairOps[x].id}|${currentPairOps[y].id}`;
        const meta = profile.pairTemplates[kind][id];
        if(!meta) continue;
        const pair = `${currentPairOps[x].digit}${currentPairOps[y].digit}`;
        const bonus = Math.round(meta.points * (currentPairOps[x].pairWeight || 1) * (currentPairOps[y].pairWeight || 1));
        seeds.push({pair, width:2, bonus, label:`world replay: ${currentPairOps[x].label} + ${currentPairOps[y].label}`, meta});
      }
    }
    // Fallback ringan: gabungkan digit hasil replay terkuat agar AK/LE tidak hanya ikut carry lama.
    const topDigits = DIGITS.slice().sort((a,b) => (profile.digitScore[b] || 0) - (profile.digitScore[a] || 0)).slice(0,5);
    for(let i=0;i<topDigits.length;i++){
      for(let j=0;j<topDigits.length;j++){
        if(i === j && topDigits.length > 2) continue;
        seeds.push({pair:`${topDigits[i]}${topDigits[j]}`, width:2, bonus:Math.max(900, 3200 - 380*i - 270*j), label:'world replay: gabungan digit operasi'});
      }
    }
    profile.pairSeeds[kind] = mergePairSeeds(seeds).sort((a,b) => b.bonus - a.bonus || a.pair.localeCompare(b.pair)).slice(0,12);
  });

  if(profile.total || profile.targetDayTotal){
    profile.samples.push(`Replay ${profile.code} ${profile.fromDay}→${profile.toDay}: ${profile.total} transisi utama, ${profile.targetDayTotal} target-day`);
    profile.samples.push(`Digit replay: ${DIGITS.slice().sort((a,b)=>(profile.digitScore[b]||0)-(profile.digitScore[a]||0)).slice(0,6).map(d => `${d}:${Math.round(profile.digitScore[d]||0)}`).join(' | ')}`);
    profile.samples.push(`Twin replay: ${DIGITS.slice().sort((a,b)=>(profile.twinScore[b]||0)-(profile.twinScore[a]||0)).slice(0,5).map(d => `${d}${d}:${Math.round(profile.twinScore[d]||0)}`).join(' | ')}`);
    profile.samples.push(`AK replay: ${(profile.pairSeeds.AK||[]).slice(0,4).map(x => `${x.pair}:${Math.round(x.bonus)}`).join(' | ') || '-'}`);
    profile.samples.push(`LE replay: ${(profile.pairSeeds.LE||[]).slice(0,4).map(x => `${x.pair}:${Math.round(x.bonus)}`).join(' | ') || '-'}`);
  }
  return profile;
}

function worldFormulaOps(row){
  const a = row?.digits || [];
  if(a.length < 4) return [];
  const names = ['A','K','L','E'];
  const out = [];
  const add = (id, label, d, weight=1, pairWeight=1, twinWeight=1) => {
    d = Number(d);
    if(!Number.isInteger(d) || d < 0 || d > 9) return;
    out.push({id, label, digit:d, weight, pairWeight, twinWeight});
  };
  const m9 = d => mod10(9-d), m10 = d => mod10(10-d);
  const root = digitalRoot(sumDigits(row));
  const total = mod10(sumDigits(row));

  a.forEach((d,i) => {
    const n = names[i];
    add(`carry_${n}`, `carry ${n}`, d, 1.2, 1.18, 1.05);
    add(`m9_${n}`, `mirror9 ${n}`, m9(d), 1.08, 1.08, 1.0);
    add(`m10_${n}`, `mirror10 ${n}`, m10(d), 1.08, 1.08, 1.0);
    for(let k=1;k<=6;k++){
      add(`up${k}_${n}`, `${n}+${k}`, mod10(d+k), 0.78 + 0.03*k, 0.78, 0.84);
      add(`down${k}_${n}`, `${n}-${k}`, mod10(d-k), 0.78 + 0.03*k, 0.78, 0.84);
    }
  });
  add('total_mod', 'total mod10', total, 1.05, 1.0, 0.9);
  add('root', 'root total', root, 1.16, 1.08, 1.2);
  add('m9_root', 'mirror9 root', m9(root), 0.96, 0.88, 0.95);
  add('m10_root', 'mirror10 root', m10(root), 0.96, 0.88, 0.95);
  for(let k=1;k<=6;k++){
    add(`root_up${k}`, `root+${k}`, mod10(root+k), 0.86 + 0.03*k, 0.82, 1.02);
    add(`root_down${k}`, `root-${k}`, mod10(root-k), 0.82 + 0.02*k, 0.78, 0.94);
    add(`total_up${k}`, `total+${k}`, mod10(total+k), 0.74, 0.7, 0.78);
    add(`total_down${k}`, `total-${k}`, mod10(total-k), 0.74, 0.7, 0.78);
  }
  const pairs = [
    ['AK',0,1],['AL',0,2],['AE',0,3],['KL',1,2],['KE',1,3],['LE',2,3]
  ];
  pairs.forEach(([nm,i,j]) => {
    const x=a[i], y=a[j];
    add(`sum_${nm}`, `${nm} sum`, mod10(x+y), 1.14, 1.08, 1.08);
    add(`diff_${nm}`, `${nm} diff`, Math.abs(x-y)%10, 1.08, 1.04, 1.15);
    add(`dir_${nm}`, `${names[i]}-${names[j]}`, mod10(x-y), 0.9, 0.85, 0.9);
    add(`dir_${names[j]}${names[i]}`, `${names[j]}-${names[i]}`, mod10(y-x), 0.9, 0.85, 0.9);
    add(`prod_${nm}`, `${nm} prod`, mod10(x*y), 0.78, 0.74, 0.8);
    add(`m9sum_${nm}`, `mirror9 ${nm} sum`, m9(mod10(x+y)), 0.92, 0.86, 0.9);
    add(`m10sum_${nm}`, `mirror10 ${nm} sum`, m10(mod10(x+y)), 0.92, 0.86, 0.9);
    add(`root_${nm}`, `root ${nm}`, digitalRoot(x+y), 0.88, 0.82, 0.86);
  });
  const triples = [
    ['AKL',[0,1,2]],['AKE',[0,1,3]],['ALE',[0,2,3]],['KLE',[1,2,3]]
  ];
  triples.forEach(([nm,idxs]) => {
    const v = mod10(idxs.reduce((s,i) => s + a[i], 0));
    add(`sum_${nm}`, `${nm} sum`, v, 0.88, 0.78, 0.84);
    add(`m9sum_${nm}`, `mirror9 ${nm}`, m9(v), 0.78, 0.7, 0.76);
  });
  const corner = mod10(a[0]+a[3]);
  const middle = mod10(a[1]+a[2]);
  add('corner_AE', 'corner A+E', corner, 1.06, 1.0, 1.0);
  add('middle_KL', 'middle K+L', middle, 1.08, 1.0, 1.04);
  add('corner_middle_diff', 'diff corner-middle', Math.abs(corner-middle)%10, 0.98, 0.88, 0.94);
  add('corner_middle_sum', 'corner+middle', mod10(corner+middle), 0.9, 0.82, 0.88);

  const info = twinInfo(row);
  if(info.twins.length){
    info.twins.forEach(t => {
      add(`twin_carry_${t}`, `twin carry ${t}`, t, 0.9, 0.7, 0.72);
      add(`twin_sum_${t}`, `twin ${t}+${t}`, mod10(t+t), 1.12, 0.92, 1.4);
      add(`twin_zero_${t}`, `twin ${t}-${t}`, 0, 1.08, 0.88, 1.24);
      add(`twin_up4_${t}`, `twin ${t}+4`, mod10(t+4), 0.94, 0.74, 1.05);
      add(`twin_up6_${t}`, `twin ${t}+6`, mod10(t+6), 0.94, 0.74, 1.05);
    });
    const singles = info.singles || [];
    if(singles.length){
      singles.forEach((s,idx) => {
        add(`single_m10_${idx}`, `single mirror10 ${s}`, m10(s), 0.95, 0.78, 0.95);
        add(`single_m9_${idx}`, `single mirror9 ${s}`, m9(s), 0.9, 0.74, 0.9);
        add(`single_down_${idx}`, `single ${s}-1`, mod10(s-1), 0.88, 0.72, 0.9);
        add(`single_up_${idx}`, `single ${s}+1`, mod10(s+1), 0.88, 0.72, 0.9);
      });
      add('single_sum_after_twin', 'single sum after twin', mod10(singles.reduce((s,d)=>s+d,0)), 1.0, 0.82, 1.08);
      if(singles.length >= 2) add('single_diff_after_twin', 'single diff after twin', Math.abs(singles[0]-singles[1])%10, 0.96, 0.78, 1.0);
    }
  }

  const seen = new Set();
  return out.filter(op => {
    const key = `${op.id}|${op.digit}`;
    if(seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function selectWorldPairOps(ops){
  const priority = ['carry_','m9_','m10_','sum_','diff_','root','total','corner','middle','twin_','single_'];
  return (ops || [])
    .filter(op => priority.some(p => op.id.startsWith(p) || op.id === p))
    .sort((a,b) => (b.pairWeight || 1) - (a.pairWeight || 1) || a.id.localeCompare(b.id))
    .slice(0,56);
}

function mergePairSeeds(seeds){
  const map = {};
  (seeds || []).forEach(s => {
    if(!s || !/^\d{2}$/.test(s.pair)) return;
    if(!map[s.pair]) map[s.pair] = {...s, notes:[], bonus:0};
    map[s.pair].bonus = Math.max(map[s.pair].bonus, s.bonus || 0);
    map[s.pair].label = (s.bonus || 0) >= (map[s.pair].bonus || 0) ? s.label : map[s.pair].label;
  });
  return Object.values(map);
}

function applyWorldFormulaReplay(candidate, latest, profile){
  candidate.worldReplayScore = Array(10).fill(0);
  candidate.worldReplayTwinScore = Array(10).fill(0);
  if(!profile) return;
  DIGITS.forEach(d => {
    const digitPower = Math.round(0.52*(profile.digitScore?.[d] || 0));
    if(digitPower > 0){
      candidate.worldReplayScore[d] += digitPower;
      addCandidateTrace(candidate, d, digitPower, `World formula replay ${profile.fromDay}→${profile.toDay}`, 'worldReplay');
    }
    const twinPower = Math.round(0.40*(profile.twinScore?.[d] || 0));
    if(twinPower > 0){
      candidate.worldReplayTwinScore[d] += twinPower;
      addCandidateTrace(candidate, d, Math.round(twinPower*0.45), `World twin replay ${profile.fromDay}→${profile.toDay}`, 'worldReplay');
    }
  });
}

function forceWorldFormulaReplayRescue(selected, latest, candidate){
  const profile = candidate.replayProfile;
  if(!profile || !selected?.length) return;
  const latestSet = uniqueDigits(latest?.digits || []);
  const traceWidth = d => new Set((candidate.digitTrace?.[d] || []).map(x => x.family)).size;
  const protectedSet = new Set();
  // Jaga digit yang punya jejak luas; tetapi jangan proteksi semua carry latest.
  selected.forEach(d => {
    if(traceWidth(d) >= 5 && !latestSet.includes(d)) protectedSet.add(Number(d));
  });
  const candidates = DIGITS.slice()
    .filter(d => !selected.includes(d) && (profile.digitScore?.[d] || 0) > 0)
    .sort((a,b) => (profile.digitScore[b] || 0) - (profile.digitScore[a] || 0) || (candidate.score[b] || 0) - (candidate.score[a] || 0));
  const threshold = Math.max(380, 0.42 * (profile.digitScore?.[candidates[0]] || 0));
  candidates.slice(0,3).forEach(d => {
    if((profile.digitScore[d] || 0) < threshold) return;
    replaceWeakestForRescue(selected, d, candidate, protectedSet);
    protectedSet.add(Number(d));
  });
}

function worldReplayPairSeeds(latest, candidate, kind){
  const profile = candidate?.replayProfile;
  if(!profile) return [];
  return (profile.pairSeeds?.[kind] || []).slice(0,10).map((x,i) => ({
    pair:x.pair,
    width:2,
    bonus:Math.round(6200 + Math.min(26000, (x.bonus || 0)*1.45) - i*240),
    label:x.label || 'world formula replay'
  }));
}

function applyWorldReplayPairLock(ranked, kind, latest, candidate){
  const seeds = worldReplayPairSeeds(latest, candidate, kind).slice(0,5);
  if(!seeds.length) return ranked;
  const map = {};
  ranked.forEach(x => map[x.pair] = {...x, notes:[...(x.notes || [])]});
  const ensure = (pair, points, note) => {
    if(!/^\d{2}$/.test(pair)) return;
    if(!map[pair]) map[pair] = {pair, points:0, notes:[]};
    map[pair].points = Math.max(map[pair].points, points);
    if(note && !map[pair].notes.includes(note)) map[pair].notes.unshift(note);
  };
  seeds.forEach((s,i) => ensure(s.pair, 19600 + Math.max(0, s.bonus || 0) - i*900, 'world formula replay lock'));
  return Object.values(map).sort((a,b) => b.points - a.points || a.pair.localeCompare(b.pair));
}

function buildWorldFormulaReplayAudit(profile, candidate){
  if(!profile) return null;
  return {
    title:`World formula replay ${profile.code}: ${profile.fromDay} → ${profile.toDay}`,
    digits:DIGITS.slice().sort((a,b)=>(profile.digitScore[b]||0)-(profile.digitScore[a]||0)).slice(0,6).map(d => `${d}:${Math.round(profile.digitScore[d]||0)} ${profile.digitNotes[d]?.[0] || ''}`).join(' | '),
    twin:DIGITS.slice().sort((a,b)=>(profile.twinScore[b]||0)-(profile.twinScore[a]||0)).slice(0,5).map(d => `${d}${d}:${Math.round(profile.twinScore[d]||0)}`).join(' | '),
    ak:(profile.pairSeeds?.AK || []).slice(0,5).map(x => `${x.pair}:${Math.round(x.bonus)}`).join(' | ') || '-',
    le:(profile.pairSeeds?.LE || []).slice(0,5).map(x => `${x.pair}:${Math.round(x.bonus)}`).join(' | ') || '-',
    samples:profile.samples || []
  };
}


// V6.1: Target Twin-Single Bridge
// Blind spot: ketika latest punya kembar dan ada digit tunggal non-zero, sebagian hasil target sering keluar dari
// ladder cermin digit tunggal: mirror10(s), s-1, mirror9(s), dan carry s. Contoh HKG latest 2066 + anchor Minggu 6959
// membuka AK 81 dan LE 72, sehingga digit 1 dan 7 tidak boleh kalah oleh carry kembar 6/world replay.
function targetTwinSingleBridgeContext(latest, targetAnchor, transitionProfile, marketProfile){
  const ld = latest?.digits || [];
  const ad = targetAnchor?.digits || [];
  if(ld.length < 4 || ad.length < 4) return null;
  const transitionSamples = Number(transitionProfile?.total || marketProfile?.total || 0);
  if(transitionSamples < 4) return null;
  const latestInfo = twinInfo(latest);
  if(!latestInfo.twins.length) return null;
  const singles = uniqueDigits(latestInfo.singles || []).filter(d => d !== 0);
  if(!singles.length) return null;
  const anchorInfo = twinInfo(targetAnchor);
  const anchorTwins = anchorInfo.twins || [];
  const anchorMirror = uniqueDigits(flat(ad.map(d => [mod10(9-d), mod10(10-d)])));
  const anchorGate = singlePairGateDigits(targetAnchor);
  const anchorRoot = digitalRoot(sumDigits(targetAnchor));
  const anchorHidden = uniqueDigits(anchorMirror.concat(anchorGate, [anchorRoot, mod10(10-anchorRoot)]))
    .filter(d => !ad.includes(d));
  const hardCap = Number(marketProfile?.targetCarryHardCap || 4);
  const lowCarry = Number(marketProfile?.targetCarrySamples || marketProfile?.total || 0) >= 5 && hardCap <= 2;
  return {ld, ad, singles, latestTwins:latestInfo.twins, anchorTwins, anchorHidden, transitionSamples, hardCap, lowCarry};
}

function twinSingleBridgeDigitsForSingle(s){
  return {
    mirror10: mod10(10-s),
    down: mod10(s-1),
    mirror9: mod10(9-s),
    carry: mod10(s),
    up: mod10(s+1)
  };
}

function applyTargetTwinSingleBridge(candidate, latest, targetAnchor, transitionProfile, marketProfile){
  candidate.targetTwinSingleBridgeScore = Array(10).fill(0);
  candidate.targetTwinSingleBridgeDigits = [];
  candidate.targetTwinSingleBridgeAudit = null;
  const ctx = targetTwinSingleBridgeContext(latest, targetAnchor, transitionProfile, marketProfile);
  if(!ctx) return;
  const {singles, anchorHidden, anchorTwins, lowCarry, transitionSamples} = ctx;
  const add = (d, amount, note) => {
    d = Number(d);
    if(!Number.isInteger(d) || d < 0 || d > 9) return;
    candidate.targetTwinSingleBridgeScore[d] += amount;
    addCandidateTrace(candidate, d, amount, note, 'targetTwinSingleBridge');
  };
  const base = lowCarry ? 3180 : 2520;
  const core = [];
  singles.forEach(s => {
    const g = twinSingleBridgeDigitsForSingle(s);
    // Urutan ini sengaja mewakili 4D ladder: mirror10(s) | s-1 | mirror9(s) | carry s.
    core.push(g.mirror10, g.down, g.mirror9, g.carry);
    add(g.mirror10, base + 1220, 'Target twin-single bridge: mirror10 digit tunggal sebagai A');
    add(g.down, base + 1360, 'Target twin-single bridge: digit tunggal -1 sebagai K tersembunyi');
    add(g.mirror9, base + 1320, 'Target twin-single bridge: mirror9 digit tunggal sebagai L');
    add(g.carry, base + 980, 'Target twin-single bridge: carry digit tunggal sebagai E');
    add(g.up, Math.round(base*0.32), 'Target twin-single bridge: digit tunggal +1 support');
  });
  anchorHidden.forEach((d,i) => {
    // Hidden anchor tidak dipaksa semua; hanya memberi dorongan agar digit seperti 1 dari anchor 6959 tidak tenggelam.
    add(d, Math.max(360, Math.round(base*0.42) - i*42), 'Target twin-single bridge: hidden anchor support');
  });
  anchorTwins.forEach(t => add(t, Math.round(base*0.22), 'Target twin-single bridge: anchor twin support ringan'));
  candidate.targetTwinSingleBridgeDigits = uniqueDigits(core)
    .sort((x,y) => (candidate.targetTwinSingleBridgeScore[y] || 0) - (candidate.targetTwinSingleBridgeScore[x] || 0));
  const first = singles[0];
  const g = twinSingleBridgeDigitsForSingle(first);
  candidate.targetTwinSingleBridgeAudit = {
    title:`Target twin-single bridge aktif: latest ${latest.day || '-'} ${(latest.digits || []).join('')} × anchor ${targetAnchor.day || '-'} ${(targetAnchor.digits || []).join('')}`,
    digits:candidate.targetTwinSingleBridgeDigits.map(d => `${d}:${Math.round(candidate.targetTwinSingleBridgeScore[d] || 0)}`).join(' | '),
    ak:`${g.mirror10}${g.down}`,
    le:`${g.mirror9}${g.carry}`,
    transitionSamples
  };
}

function forceTargetTwinSingleBridgeRescue(selected, latest, candidate){
  if(!candidate.targetTwinSingleBridgeDigits?.length) return;
  const score = candidate.targetTwinSingleBridgeScore || Array(10).fill(0);
  const required = candidate.targetTwinSingleBridgeDigits
    .filter(d => (score[d] || 0) >= 1800)
    .sort((a,b) => (score[b] || 0) - (score[a] || 0));
  if(required.length < 4) return;
  const minimum = Math.min(4, required.length);
  let present = required.filter(d => selected.includes(d)).length;
  if(present >= minimum) return;

  const latestTwins = twinInfo(latest).twins || [];
  const protectedSet = new Set(required.filter(d => selected.includes(d)).map(Number));
  // Lindungi satu digit umum terkuat dan satu digit kembar latest, tetapi jangan kunci semua carry kembar.
  const strongest = selected.slice().sort((a,b) => (candidate.score[b] || 0) - (candidate.score[a] || 0))[0];
  if(strongest != null) protectedSet.add(Number(strongest));
  latestTwins.forEach(t => { if(selected.includes(t) && protectedSet.size < 2) protectedSet.add(Number(t)); });
  const traceWidth = d => new Set((candidate.digitTrace?.[d] || []).map(x => x.family)).size;
  const victimScore = d =>
    (candidate.score?.[d] || 0) + 8*traceWidth(d) - 1.35*(score[d] || 0) + 0.10*((candidate.worldReplayScore || [])[d] || 0);
  for(const d of required){
    if(present >= minimum) break;
    if(selected.includes(d)) continue;
    const victim = selected.slice()
      .filter(x => !protectedSet.has(Number(x)))
      .sort((a,b) => victimScore(a) - victimScore(b) || (candidate.score[a] || 0) - (candidate.score[b] || 0))[0];
    if(victim == null) continue;
    selected[selected.indexOf(victim)] = d;
    protectedSet.add(Number(d));
    present += 1;
  }
}

function targetTwinSingleBridgePairSeeds(latest, targetAnchor, candidate, kind){
  const ctx = targetTwinSingleBridgeContext(latest, targetAnchor, candidate?.transitionProfile, candidate?.marketProfile);
  if(!ctx) return [];
  const {singles, lowCarry} = ctx;
  const seeds = [];
  const add = (pair, bonus, label) => { if(/^\d{2}$/.test(pair)) seeds.push({pair, width:2, bonus, label}); };
  const base = lowCarry ? 42800 : 35600;
  singles.forEach(s => {
    const g = twinSingleBridgeDigitsForSingle(s);
    if(kind === 'AK'){
      add(`${g.mirror10}${g.down}`, base + 17600, 'AK target twin-single: mirror10 single + single-1');
      add(`${g.mirror9}${g.down}`, Math.round(base*0.70), 'AK target twin-single: mirror9 single + single-1');
      add(`${g.mirror10}${g.carry}`, Math.round(base*0.58), 'AK target twin-single: mirror10 single + carry single');
      add(`${g.mirror9}${g.mirror10}`, Math.round(base*0.46), 'AK target twin-single: mirror9 + mirror10 single');
    }else{
      add(`${g.mirror9}${g.carry}`, base + 17600, 'LE target twin-single: mirror9 single + carry single');
      add(`${g.down}${g.carry}`, Math.round(base*0.68), 'LE target twin-single: single-1 + carry single');
      add(`${g.mirror9}${g.mirror10}`, Math.round(base*0.56), 'LE target twin-single: mirror9 + mirror10 single');
      add(`${g.down}${g.mirror10}`, Math.round(base*0.44), 'LE target twin-single: single-1 + mirror10 single');
    }
  });
  return seeds;
}

function applyTargetTwinSingleBridgePairLock(ranked, kind, latest, targetAnchor, candidate){
  const seeds = targetTwinSingleBridgePairSeeds(latest, targetAnchor, candidate, kind).slice(0,4);
  if(!seeds.length) return ranked;
  const map = {};
  ranked.forEach(x => map[x.pair] = {...x, notes:[...(x.notes || [])]});
  const ensure = (pair, points, note) => {
    if(!/^\d{2}$/.test(pair)) return;
    if(!map[pair]) map[pair] = {pair, points:0, notes:[]};
    map[pair].points = Math.max(map[pair].points, points);
    if(note && !map[pair].notes.includes(note)) map[pair].notes.unshift(note);
  };
  seeds.forEach((s,i) => ensure(s.pair, 260000 + (s.bonus || 0) - i*1800, 'target twin-single bridge lock'));
  return Object.values(map).sort((a,b) => b.points - a.points || a.pair.localeCompare(b.pair));
}

function buildTargetTwinSingleBridgeAudit(audit){
  if(!audit) return null;
  return {title:audit.title, digits:audit.digits, ak:audit.ak, le:audit.le};
}


// V6.2: Target Anchor Rotation Bridge
// Blind spot: saat latest non-kembar membuka complement A+E = 0 dan anchor hari target juga non-kembar,
// hasil target dapat mengikuti rotasi anchor K-L-E-A. Contoh HKG anchor Senin 9467 dibaca 4679,
// sehingga digit 4/6 dan AK 46 tidak kalah oleh target-edge 98/27.
function targetAnchorRotationBridgeContext(latest, targetAnchor, transitionProfile, marketProfile){
  const ld = latest?.digits || [];
  const ad = targetAnchor?.digits || [];
  if(ld.length < 4 || ad.length < 4) return null;
  const transitionSamples = Number(transitionProfile?.total || marketProfile?.total || 0);
  if(transitionSamples < 4) return null;
  if(twinInfo(latest).twins.length) return null;
  if(twinInfo(targetAnchor).twins.length) return null;
  const ae = mod10(ld[0] + ld[3]);
  if(ae !== 0) return null;
  const hardCap = Number(marketProfile?.targetCarryHardCap || 4);
  const rotated = [ad[1], ad[2], ad[3], ad[0]];
  return {
    rotated,
    ak:`${rotated[0]}${rotated[1]}`,
    le:`${rotated[2]}${rotated[3]}`,
    transitionSamples,
    lowCarry:transitionSamples >= 5 && hardCap <= 2,
    complement:ae
  };
}

function applyTargetAnchorRotationBridge(candidate, latest, targetAnchor, transitionProfile, marketProfile){
  candidate.targetAnchorRotationBridgeScore = Array(10).fill(0);
  candidate.targetAnchorRotationBridgeDigits = [];
  candidate.targetAnchorRotationBridgeAudit = null;
  const ctx = targetAnchorRotationBridgeContext(latest, targetAnchor, transitionProfile, marketProfile);
  if(!ctx) return;
  const add = (d, amount, note) => {
    d = Number(d);
    if(!Number.isInteger(d) || d < 0 || d > 9) return;
    candidate.targetAnchorRotationBridgeScore[d] += amount;
    addCandidateTrace(candidate, d, amount, note, 'targetAnchorRotationBridge');
  };
  const base = ctx.lowCarry ? 4260 : 3480;
  const [akA, akK, leL, leE] = ctx.rotated;
  add(akA, base + 1820, 'Target anchor-rotation bridge: anchor K menjadi A');
  add(akK, base + 1740, 'Target anchor-rotation bridge: anchor L menjadi K');
  add(leL, base + 1180, 'Target anchor-rotation bridge: anchor E menjadi L');
  add(leE, base + 1080, 'Target anchor-rotation bridge: anchor A menjadi E');
  // Support ringan dari latest complement agar bridge hanya aktif sebagai pembaca rotasi, bukan mengganti seluruh engine.
  const ld = latest?.digits || [];
  add(ld[0], Math.round(base*0.34), 'Target anchor-rotation bridge: latest A complement support');
  add(ld[3], Math.round(base*0.30), 'Target anchor-rotation bridge: latest E complement support');
  candidate.targetAnchorRotationBridgeDigits = uniqueDigits(ctx.rotated)
    .sort((x,y) => (candidate.targetAnchorRotationBridgeScore[y] || 0) - (candidate.targetAnchorRotationBridgeScore[x] || 0));
  candidate.targetAnchorRotationBridgeAudit = {
    title:`Target anchor-rotation bridge aktif: anchor ${targetAnchor.day || '-'} ${(targetAnchor.digits || []).join('')} → rotasi K-L-E-A`,
    digits:candidate.targetAnchorRotationBridgeDigits.map(d => `${d}:${Math.round(candidate.targetAnchorRotationBridgeScore[d] || 0)}`).join(' | '),
    ak:ctx.ak,
    le:ctx.le,
    transitionSamples:ctx.transitionSamples
  };
}

function forceTargetAnchorRotationBridgeRescue(selected, latest, candidate){
  if(!candidate.targetAnchorRotationBridgeDigits?.length) return;
  const score = candidate.targetAnchorRotationBridgeScore || Array(10).fill(0);
  const required = candidate.targetAnchorRotationBridgeDigits
    .filter(d => (score[d] || 0) >= 2200)
    .sort((a,b) => (score[b] || 0) - (score[a] || 0));
  if(required.length < 4) return;
  const minimum = Math.min(4, required.length);
  let present = required.filter(d => selected.includes(d)).length;
  if(present >= minimum) return;
  const protectedSet = new Set(required.filter(d => selected.includes(d)).map(Number));
  const traceWidth = d => new Set((candidate.digitTrace?.[d] || []).map(x => x.family)).size;
  const victimScore = d => {
    let v = (candidate.score?.[d] || 0) + 8*traceWidth(d) - 1.52*(score[d] || 0);
    if(required.includes(Number(d))) v += 999999;
    return v;
  };
  for(const d of required){
    if(present >= minimum) break;
    if(selected.includes(d)) continue;
    const victim = selected.slice()
      .filter(x => !protectedSet.has(Number(x)) && !required.includes(Number(x)))
      .sort((a,b) => victimScore(a) - victimScore(b) || (candidate.score?.[a] || 0) - (candidate.score?.[b] || 0))[0];
    if(victim == null) continue;
    selected[selected.indexOf(victim)] = d;
    protectedSet.add(Number(d));
    present += 1;
  }
}

function targetAnchorRotationBridgePairSeeds(latest, targetAnchor, candidate, kind){
  const ctx = targetAnchorRotationBridgeContext(latest, targetAnchor, candidate?.transitionProfile, candidate?.marketProfile);
  if(!ctx) return [];
  const seeds = [];
  const add = (pair, bonus, label) => { if(/^\d{2}$/.test(pair)) seeds.push({pair, width:2, bonus, label}); };
  const [akA, akK, leL, leE] = ctx.rotated;
  const base = ctx.lowCarry ? 76000 : 64000;
  if(kind === 'AK'){
    add(`${akA}${akK}`, base + 42000, 'AK target anchor-rotation: anchor K-L');
    add(`${akA}${leL}`, Math.round(base*0.56), 'AK target anchor-rotation: anchor K-E support');
    add(`${leE}${akK}`, Math.round(base*0.44), 'AK target anchor-rotation: anchor A-L support');
  }else{
    add(`${leL}${leE}`, base + 42000, 'LE target anchor-rotation: anchor E-A');
    add(`${akK}${leE}`, Math.round(base*0.54), 'LE target anchor-rotation: anchor L-A support');
    add(`${leL}${akA}`, Math.round(base*0.42), 'LE target anchor-rotation: anchor E-K support');
  }
  return seeds;
}

function applyTargetAnchorRotationBridgePairLock(ranked, kind, latest, targetAnchor, candidate){
  const seeds = targetAnchorRotationBridgePairSeeds(latest, targetAnchor, candidate, kind).slice(0,3);
  if(!seeds.length) return ranked;
  const map = {};
  ranked.forEach(x => map[x.pair] = {...x, notes:[...(x.notes || [])]});
  const ensure = (pair, points, note) => {
    if(!/^\d{2}$/.test(pair)) return;
    if(!map[pair]) map[pair] = {pair, points:0, notes:[]};
    map[pair].points = Math.max(map[pair].points, points);
    if(note && !map[pair].notes.includes(note)) map[pair].notes.unshift(note);
  };
  seeds.forEach((s,i) => ensure(s.pair, 420000 + (s.bonus || 0) - i*2200, 'target anchor-rotation bridge lock'));
  return Object.values(map).sort((a,b) => b.points - a.points || a.pair.localeCompare(b.pair));
}

function buildTargetAnchorRotationBridgeAudit(audit){
  if(!audit) return null;
  return {title:audit.title, digits:audit.digits, ak:audit.ak, le:audit.le};
}


// V6.3: Target Boundary Root-Twin Bridge
// Blind spot: saat latest non-kembar memiliki ekor boundary 9/0 dan anchor target juga punya digit boundary,
// hasil dapat membuka AK dari mirror ekor 9/10 dan LE dari root kembar. Contoh HKG latest 4679 + anchor Selasa 5790
// membuka AK 01 dan LE 88, sehingga digit 8 dan kandidat kembar 88 tidak kalah oleh target-edge 54/90.
function targetBoundaryRootTwinBridgeContext(latest, targetAnchor, transitionProfile, marketProfile){
  const ld = latest?.digits || [];
  const ad = targetAnchor?.digits || [];
  if(ld.length < 4 || ad.length < 4) return null;
  const transitionSamples = Number(transitionProfile?.total || marketProfile?.total || 0);
  if(transitionSamples < 4) return null;
  if(twinInfo(latest).twins.length) return null;
  const e = ld[3];
  if(e !== 9 && e !== 0) return null;
  const anchorHasBoundary = ad.includes(0) || ad.includes(9);
  if(!anchorHasBoundary) return null;
  const root = digitalRoot(sumDigits(latest));
  const mirror9E = mod10(9-e);
  const mirror10E = mod10(10-e);
  const neighborDownE = mod10(e-1);
  const neighborUpE = mod10(e+1);
  const hardCap = Number(marketProfile?.targetCarryHardCap || 4);
  const lowCarry = Number(marketProfile?.targetCarrySamples || marketProfile?.total || 0) >= 5 && hardCap <= 2;
  return {ld, ad, e, root, mirror9E, mirror10E, neighborDownE, neighborUpE, transitionSamples, lowCarry, anchorHasBoundary};
}

function applyTargetBoundaryRootTwinBridge(candidate, latest, targetAnchor, transitionProfile, marketProfile){
  candidate.targetBoundaryRootTwinBridgeScore = Array(10).fill(0);
  candidate.targetBoundaryRootTwinBridgeTwinScore = Array(10).fill(0);
  candidate.targetBoundaryRootTwinBridgeDigits = [];
  candidate.targetBoundaryRootTwinBridgeTwinDigit = null;
  candidate.targetBoundaryRootTwinBridgeAudit = null;
  const ctx = targetBoundaryRootTwinBridgeContext(latest, targetAnchor, transitionProfile, marketProfile);
  if(!ctx) return;
  const add = (d, amount, note, twin=false) => {
    d = Number(d);
    if(!Number.isInteger(d) || d < 0 || d > 9) return;
    candidate.targetBoundaryRootTwinBridgeScore[d] += amount;
    if(twin) candidate.targetBoundaryRootTwinBridgeTwinScore[d] += Math.round(amount * 0.92);
    addCandidateTrace(candidate, d, amount, note, 'targetBoundaryRootTwinBridge');
  };
  const base = ctx.lowCarry ? 6820 : 5480;
  add(ctx.root, base + 3620, 'Target boundary root-twin: root total menjadi LE kembar', true);
  add(ctx.neighborDownE, Math.round(base*0.76), 'Target boundary root-twin: ekor boundary turun support root', true);
  add(ctx.mirror9E, base + 1780, 'Target boundary root-twin: mirror9 ekor sebagai A');
  add(ctx.mirror10E, base + 1580, 'Target boundary root-twin: mirror10 ekor sebagai K');
  add(ctx.neighborUpE, Math.round(base*0.34), 'Target boundary root-twin: ekor boundary naik support');
  // Anchor boundary memberi konteks, tetapi tidak mengambil alih digit inti root.
  ctx.ad.forEach((d,idx) => {
    if(d === 0 || d === 9) add(d, Math.max(520, Math.round(base*0.28) - idx*80), 'Target boundary root-twin: anchor boundary support');
  });
  candidate.targetBoundaryRootTwinBridgeTwinDigit = ctx.root;
  candidate.targetBoundaryRootTwinBridgeDigits = uniqueDigits([ctx.root, ctx.mirror9E, ctx.mirror10E, ctx.neighborDownE])
    .sort((x,y) => (candidate.targetBoundaryRootTwinBridgeScore[y] || 0) - (candidate.targetBoundaryRootTwinBridgeScore[x] || 0));
  candidate.targetBoundaryRootTwinBridgeAudit = {
    title:`Target boundary root-twin bridge aktif: latest ${latest.day || '-'} ${(latest.digits || []).join('')} ekor ${ctx.e} × anchor ${targetAnchor.day || '-'} ${(targetAnchor.digits || []).join('')}`,
    digits:candidate.targetBoundaryRootTwinBridgeDigits.map(d => `${d}:${Math.round(candidate.targetBoundaryRootTwinBridgeScore[d] || 0)}`).join(' | '),
    ak:`${ctx.mirror9E}${ctx.mirror10E}`,
    le:`${ctx.root}${ctx.root}`,
    twin:`${ctx.root}${ctx.root}`,
    transitionSamples:ctx.transitionSamples
  };
}

function forceTargetBoundaryRootTwinBridgeRescue(selected, latest, candidate){
  if(!candidate.targetBoundaryRootTwinBridgeDigits?.length) return;
  const score = candidate.targetBoundaryRootTwinBridgeScore || Array(10).fill(0);
  const required = candidate.targetBoundaryRootTwinBridgeDigits
    .filter(d => (score[d] || 0) >= 2600)
    .sort((a,b) => (score[b] || 0) - (score[a] || 0));
  if(required.length < 3) return;
  const minimum = Math.min(3, required.length);
  let present = required.filter(d => selected.includes(d)).length;
  if(present >= minimum) return;
  const protectedSet = new Set(required.filter(d => selected.includes(d)).map(Number));
  const traceWidth = d => new Set((candidate.digitTrace?.[d] || []).map(x => x.family)).size;
  const victimScore = d => {
    let v = (candidate.score?.[d] || 0) + 8*traceWidth(d) - 1.48*(score[d] || 0);
    if(required.includes(Number(d))) v += 999999;
    return v;
  };
  for(const d of required){
    if(present >= minimum) break;
    if(selected.includes(d)) continue;
    const victim = selected.slice()
      .filter(x => !protectedSet.has(Number(x)) && !required.includes(Number(x)))
      .sort((a,b) => victimScore(a) - victimScore(b) || (candidate.score?.[a] || 0) - (candidate.score?.[b] || 0))[0];
    if(victim == null) continue;
    selected[selected.indexOf(victim)] = d;
    protectedSet.add(Number(d));
    present += 1;
  }
}

function targetBoundaryRootTwinBridgePairSeeds(latest, targetAnchor, candidate, kind){
  const ctx = targetBoundaryRootTwinBridgeContext(latest, targetAnchor, candidate?.transitionProfile, candidate?.marketProfile);
  if(!ctx) return [];
  const seeds = [];
  const add = (pair, bonus, label) => { if(/^\d{2}$/.test(pair)) seeds.push({pair, width:2, bonus, label}); };
  const base = ctx.lowCarry ? 118000 : 98000;
  if(kind === 'AK'){
    add(`${ctx.mirror9E}${ctx.mirror10E}`, base + 62000, 'AK target boundary root-twin: mirror9 E + mirror10 E');
    add(`${ctx.mirror10E}${ctx.mirror9E}`, Math.round(base*0.62), 'AK target boundary root-twin: mirror10/mirror9 balik');
    add(`${ctx.mirror9E}${ctx.root}`, Math.round(base*0.54), 'AK target boundary root-twin: mirror9 E + root');
  }else{
    add(`${ctx.root}${ctx.root}`, base + 72000, 'LE target boundary root-twin: root-root');
    add(`${ctx.neighborDownE}${ctx.root}`, Math.round(base*0.68), 'LE target boundary root-twin: down E + root');
    add(`${ctx.root}${ctx.mirror10E}`, Math.round(base*0.42), 'LE target boundary root-twin: root + mirror10 E');
  }
  return seeds;
}

function applyTargetBoundaryRootTwinBridgePairLock(ranked, kind, latest, targetAnchor, candidate){
  const seeds = targetBoundaryRootTwinBridgePairSeeds(latest, targetAnchor, candidate, kind).slice(0,3);
  if(!seeds.length) return ranked;
  const map = {};
  ranked.forEach(x => map[x.pair] = {...x, notes:[...(x.notes || [])]});
  const ensure = (pair, points, note) => {
    if(!/^\d{2}$/.test(pair)) return;
    if(!map[pair]) map[pair] = {pair, points:0, notes:[]};
    map[pair].points = Math.max(map[pair].points, points);
    if(note && !map[pair].notes.includes(note)) map[pair].notes.unshift(note);
  };
  seeds.forEach((s,i) => ensure(s.pair, 560000 + (s.bonus || 0) - i*2600, 'target boundary root-twin bridge lock'));
  return Object.values(map).sort((a,b) => b.points - a.points || a.pair.localeCompare(b.pair));
}

function buildTargetBoundaryRootTwinBridgeAudit(audit){
  if(!audit) return null;
  return {title:audit.title, digits:audit.digits, ak:audit.ak, le:audit.le, twin:audit.twin};
}


// V6.4: Target Anchor Sum-Lock Bridge
// Blind spot: jika latest punya kembar belakang dan anchor hari target punya twin depan,
// hasil sering dibuka oleh struktur anchor: K+L, total mod10, L+E, dan E anchor.
// Contoh HKG latest 0188 + anchor Rabu 9978 membuka 6358: AK 63 dan LE 58.
function targetAnchorSumLockBridgeContext(latest, targetAnchor, transitionProfile, marketProfile){
  const ld = latest?.digits || [];
  const ad = targetAnchor?.digits || [];
  if(ld.length < 4 || ad.length < 4) return null;
  const transitionSamples = Number(transitionProfile?.total || marketProfile?.total || 0);
  if(transitionSamples < 4) return null;
  const latestInfo = twinInfo(latest);
  if(!latestInfo.twins.length) return null;
  // Gerbang dibuat ketat agar tidak mengganggu kasus 2066→8172: anchor harus punya twin depan A-K.
  if(ad[0] !== ad[1]) return null;
  // Prioritas saat kembar latest berada di belakang/LE, karena pola 0188 membawa twin sebagai pintu ekor.
  if(ld[2] !== ld[3]) return null;
  const anchorKL = mod10(ad[1] + ad[2]);
  const anchorTotal = mod10(ad.reduce((s,d) => s + d, 0));
  const anchorRoot = digitalRoot(ad.reduce((s,d) => s + d, 0));
  const anchorLE = mod10(ad[2] + ad[3]);
  const anchorE = ad[3];
  const anchorTwin = ad[0];
  const latestTwin = ld[2];
  const hardCap = Number(marketProfile?.targetCarryHardCap || 4);
  const lowCarry = Number(marketProfile?.targetCarrySamples || marketProfile?.total || 0) >= 5 && hardCap <= 2;
  return {ld, ad, anchorKL, anchorTotal, anchorRoot, anchorLE, anchorE, anchorTwin, latestTwin, transitionSamples, lowCarry};
}

function applyTargetAnchorSumLockBridge(candidate, latest, targetAnchor, transitionProfile, marketProfile){
  candidate.targetAnchorSumLockBridgeScore = Array(10).fill(0);
  candidate.targetAnchorSumLockBridgeDigits = [];
  candidate.targetAnchorSumLockBridgeAudit = null;
  const ctx = targetAnchorSumLockBridgeContext(latest, targetAnchor, transitionProfile, marketProfile);
  if(!ctx) return;
  const add = (d, amount, note) => {
    d = Number(d);
    if(!Number.isInteger(d) || d < 0 || d > 9) return;
    candidate.targetAnchorSumLockBridgeScore[d] += amount;
    addCandidateTrace(candidate, d, amount, note, 'targetAnchorSumLockBridge');
  };
  const base = ctx.lowCarry ? 7200 : 6100;
  add(ctx.anchorKL, base + 4200, 'Target anchor sum-lock: anchor K+L sebagai A');
  add(ctx.anchorTotal, base + 5000, 'Target anchor sum-lock: total anchor mod10 sebagai K');
  add(ctx.anchorLE, base + 4550, 'Target anchor sum-lock: anchor L+E sebagai L');
  add(ctx.anchorE, base + 3800, 'Target anchor sum-lock: carry E anchor sebagai E');
  add(ctx.anchorRoot, Math.round(base*0.58), 'Target anchor sum-lock: root anchor support');
  add(ctx.latestTwin, Math.round(base*0.54), 'Target anchor sum-lock: latest twin support');
  add(ctx.anchorTwin, Math.round(base*0.22), 'Target anchor sum-lock: anchor twin support ringan');
  candidate.targetAnchorSumLockBridgeDigits = uniqueDigits([ctx.anchorKL, ctx.anchorTotal, ctx.anchorLE, ctx.anchorE])
    .sort((x,y) => (candidate.targetAnchorSumLockBridgeScore[y] || 0) - (candidate.targetAnchorSumLockBridgeScore[x] || 0));
  candidate.targetAnchorSumLockBridgeAudit = {
    title:`Target anchor sum-lock bridge aktif: latest ${latest.day || '-'} ${(latest.digits || []).join('')} × anchor ${targetAnchor.day || '-'} ${(targetAnchor.digits || []).join('')}`,
    digits:candidate.targetAnchorSumLockBridgeDigits.map(d => `${d}:${Math.round(candidate.targetAnchorSumLockBridgeScore[d] || 0)}`).join(' | '),
    ak:`${ctx.anchorKL}${ctx.anchorTotal}`,
    le:`${ctx.anchorLE}${ctx.anchorE}`,
    transitionSamples:ctx.transitionSamples
  };
}

function forceTargetAnchorSumLockBridgeRescue(selected, latest, candidate){
  if(!candidate.targetAnchorSumLockBridgeDigits?.length) return;
  const score = candidate.targetAnchorSumLockBridgeScore || Array(10).fill(0);
  const required = candidate.targetAnchorSumLockBridgeDigits
    .filter(d => (score[d] || 0) >= 4200)
    .sort((a,b) => (score[b] || 0) - (score[a] || 0));
  if(required.length < 3) return;
  const minimum = Math.min(4, required.length);
  let present = required.filter(d => selected.includes(d)).length;
  if(present >= minimum) return;
  const protectedSet = new Set(required.filter(d => selected.includes(d)).map(Number));
  const traceWidth = d => new Set((candidate.digitTrace?.[d] || []).map(x => x.family)).size;
  const victimScore = d => {
    let v = (candidate.score?.[d] || 0) + 7*traceWidth(d) - 1.55*(score[d] || 0);
    if(required.includes(Number(d))) v += 999999;
    return v;
  };
  for(const d of required){
    if(present >= minimum) break;
    if(selected.includes(d)) continue;
    const victim = selected.slice()
      .filter(x => !protectedSet.has(Number(x)) && !required.includes(Number(x)))
      .sort((a,b) => victimScore(a) - victimScore(b) || (candidate.score?.[a] || 0) - (candidate.score?.[b] || 0))[0];
    if(victim == null) continue;
    selected[selected.indexOf(victim)] = d;
    protectedSet.add(Number(d));
    present += 1;
  }
}

function targetAnchorSumLockBridgePairSeeds(latest, targetAnchor, candidate, kind){
  const ctx = targetAnchorSumLockBridgeContext(latest, targetAnchor, candidate?.transitionProfile, candidate?.marketProfile);
  if(!ctx) return [];
  const seeds = [];
  const add = (pair, bonus, label) => { if(/^\d{2}$/.test(pair)) seeds.push({pair, width:2, bonus, label}); };
  const base = ctx.lowCarry ? 148000 : 128000;
  if(kind === 'AK'){
    add(`${ctx.anchorKL}${ctx.anchorTotal}`, base + 86000, 'AK target anchor sum-lock: K+L anchor + total mod10 anchor');
    add(`${ctx.anchorKL}${ctx.anchorRoot}`, Math.round(base*0.62), 'AK target anchor sum-lock: K+L anchor + root anchor');
    add(`${ctx.anchorE}${ctx.anchorTotal}`, Math.round(base*0.46), 'AK target anchor sum-lock: E anchor + total');
  }else{
    add(`${ctx.anchorLE}${ctx.anchorE}`, base + 92000, 'LE target anchor sum-lock: L+E anchor + E anchor');
    add(`${ctx.anchorLE}${ctx.latestTwin}`, Math.round(base*0.64), 'LE target anchor sum-lock: L+E anchor + latest twin');
    add(`${ctx.anchorRoot}${ctx.anchorE}`, Math.round(base*0.42), 'LE target anchor sum-lock: root anchor + E anchor');
  }
  return seeds;
}

function applyTargetAnchorSumLockBridgePairLock(ranked, kind, latest, targetAnchor, candidate){
  const seeds = targetAnchorSumLockBridgePairSeeds(latest, targetAnchor, candidate, kind).slice(0,3);
  if(!seeds.length) return ranked;
  const map = {};
  ranked.forEach(x => map[x.pair] = {...x, notes:[...(x.notes || [])]});
  const ensure = (pair, points, note) => {
    if(!/^\d{2}$/.test(pair)) return;
    if(!map[pair]) map[pair] = {pair, points:0, notes:[]};
    map[pair].points = Math.max(map[pair].points, points);
    if(note && !map[pair].notes.includes(note)) map[pair].notes.unshift(note);
  };
  seeds.forEach((s,i) => ensure(s.pair, 760000 + (s.bonus || 0) - i*3000, 'target anchor sum-lock bridge lock'));
  return Object.values(map).sort((a,b) => b.points - a.points || a.pair.localeCompare(b.pair));
}

function buildTargetAnchorSumLockBridgeAudit(audit){
  if(!audit) return null;
  return {title:audit.title, digits:audit.digits, ak:audit.ak, le:audit.le};
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


function findTargetDayAnchor(rows, targetDay){
  if(!targetDay || targetDay === '-') return null;
  // rows tersusun terbaru ke terlama. Ambil hari target terakhir sebelum draw berikutnya.
  return rows.find(r => r.day === targetDay) || null;
}

function addCandidateTrace(candidate, d, amount, name, family){
  if(d < 0 || d > 9) return;
  candidate.score[d] += amount;
  candidate.digitTrace[d].push({name, family, key:amount});
  candidate.familyScore[family] = candidate.familyScore[family] || Array(10).fill(0);
  candidate.familyScore[family][d] += amount;
}

function applyTargetDayAnchor(candidate, anchor, formulas, latest){
  candidate.targetAnchor = anchor || null;
  candidate.targetAnchorScore = Array(10).fill(0);
  candidate.targetAnchorMust = [];
  candidate.targetAnchorHidden = [];
  candidate.targetAnchorBoundaryTwin = false;
  candidate.targetAnchorForce = false;
  if(!anchor) return;

  const latestCounts = countMap(latest?.digits || []);
  const hasAnyTwin = Object.keys(latestCounts).map(Number).some(d => latestCounts[d] >= 2);
  const boundaryTwin = Object.keys(latestCounts).map(Number).some(d => latestCounts[d] >= 2 && (d === 9 || d === 0));
  // V4.5: anchor hari target tidak lagi hanya kuat pada kembar 9/0.
  // Jika latest punya kembar apa pun, anchor hari target harus ikut menjaga digit tersembunyi.
  candidate.targetAnchorBoundaryTwin = boundaryTwin;
  candidate.targetAnchorForce = boundaryTwin || hasAnyTwin;
  const factor = boundaryTwin ? 1 : (hasAnyTwin ? 0.62 : 0.42);

  const addAnchor = (digits, amount, name, family='targetDay') => {
    uniqueDigits(digits).forEach(d => {
      const power = Math.round(amount * factor);
      candidate.targetAnchorScore[d] += power;
      addCandidateTrace(candidate, d, power, name, family);
    });
  };

  // V4.3: angka hari target terakhir bukan hanya pembobot pekanan.
  // Ia menjadi sumber operasi sendiri. Contoh: Minggu terakhir 4113 membuka 4,1,3, dan 9.
  addAnchor(anchor.digits, 96, `Target-day carry ${anchor.day} ${anchor.digits.join('')}`);
  addAnchor(flat(anchor.digits.map(d => [mod10(9-d), mod10(10-d)])), 54, 'Target-day mirror 9/10');
  addAnchor(singlePairGateDigits(anchor), 50, 'Target-day gerbang pasangan');
  addAnchor(dayPairShiftDigits(anchor), 38, 'Target-day shift hari');
  const root = digitalRoot(sumDigits(anchor));
  addAnchor([root, mod10(root+6), mod10(root+4), mod10(9-root), mod10(10-root)], 46, 'Target-day root lock');
  addAnchor(twinSplitDigits(anchor).concat(twinMirrorSingleDigits(anchor)), 32, 'Target-day pecah/cermin kembar');

  // Kunci wajib V4.4: carry anchor, root anchor, gerbang pasangan, dan cermin.
  // Ini menjaga digit tersembunyi seperti 1 pada HKG: Minggu terakhir 6959 membuka 1 lewat 6+5 dan cermin.
  const anchorMirror = uniqueDigits(flat(anchor.digits.map(d => [mod10(9-d), mod10(10-d)])));
  const anchorGate = singlePairGateDigits(anchor);
  candidate.targetAnchorHidden = uniqueDigits(anchorMirror.concat(anchorGate, [root, mod10(10-root)])).filter(d => !anchor.digits.includes(d));
  candidate.targetAnchorMust = uniqueDigits(anchor.digits.concat([root, mod10(10-root)], anchorGate, anchorMirror)).slice(0,10);
}

function buildTargetAnchorAudit(anchor, formulas){
  if(!anchor) return null;
  return {
    title:`Kunci hari target terakhir: ${anchor.day || '-'} ${anchor.digits.join('')}`,
    carry:anchor.digits.join(' '),
    mirror:uniqueDigits(flat(anchor.digits.map(d => [mod10(9-d), mod10(10-d)]))).join(' '),
    gate:singlePairGateDigits(anchor).join(' '),
    root:String(digitalRoot(sumDigits(anchor)))
  };
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
  forceTargetDayAnchorRescue(selected, candidate);
  forceTwinAnchorSingleRescue(selected, latest, candidate);
  forceTargetAnchorCarryRescue(selected, latest, candidate);
  forceTwinSingleMirrorExpandedRescue(selected, latest, candidate);
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


function forceTargetDayAnchorRescue(selected, candidate){
  const must = candidate.targetAnchorMust || [];
  const hidden = candidate.targetAnchorHidden || [];
  const anchorScore = candidate.targetAnchorScore || Array(10).fill(0);
  if(!must.length) return;

  const traceWidth = d => new Set(candidate.digitTrace[d].map(x => x.family)).size;
  const rankPower = d => candidate.score[d] + 11*traceWidth(d) + 0.75*(anchorScore[d] || 0);
  const replaceWeakest = (d) => {
    if(selected.includes(d)) return;
    const victim = selected.slice()
      .filter(x => x !== d)
      .sort((a,b) => rankPower(a) - rankPower(b) || (anchorScore[a] || 0) - (anchorScore[b] || 0))[0];
    if(victim == null) return;
    selected[selected.indexOf(victim)] = d;
  };

  // Jika latest memiliki kembar, anchor hari target harus melindungi minimal satu digit tersembunyi.
  // Contoh HKG 2066, target Minggu, anchor Minggu 6959. Digit 1 muncul dari cermin dan gerbang anchor.
  if(candidate.targetAnchorForce){
    // Core anchor hanya dipaksa penuh pada boundary twin 9/0.
    // Untuk kembar biasa seperti 2066, jangan memaksa 6/9/5 terlalu kuat. Cukup selamatkan digit tersembunyi anchor.
    if(candidate.targetAnchorBoundaryTwin){
      const requiredCore = must.slice(0,4);
      requiredCore.forEach(d => {
        if(selected.includes(d)) return;
        const victim = selected.slice()
          .filter(x => !requiredCore.includes(x))
          .sort((a,b) => rankPower(a) - rankPower(b) || (anchorScore[a] || 0) - (anchorScore[b] || 0))[0];
        if(victim == null) return;
        selected[selected.indexOf(victim)] = d;
      });
    }

    const missingHidden = hidden
      .filter(d => !selected.includes(d))
      .sort((a,b) => (candidate.score[b] + 0.45*(anchorScore[b] || 0)) - (candidate.score[a] + 0.45*(anchorScore[a] || 0)));
    if(missingHidden.length){
      replaceWeakest(missingHidden[0]);
    }
  }else{
    // Non-kembar: cukup satu digit anchor tersembunyi jika jejaknya kuat.
    const missingHidden = hidden
      .filter(d => !selected.includes(d) && (anchorScore[d] || 0) >= 18)
      .sort((a,b) => (anchorScore[b] || 0) - (anchorScore[a] || 0));
    if(missingHidden.length){
      replaceWeakest(missingHidden[0]);
    }
  }
}


function forceTwinAnchorSingleRescue(selected, latest, candidate){
  const info = twinInfo(latest);
  if(!info.twins.length || !candidate.targetAnchor) return;
  const anchorScore = candidate.targetAnchorScore || Array(10).fill(0);
  const anchorDigits = uniqueDigits((candidate.targetAnchor.digits || []).concat(candidate.targetAnchorHidden || []));
  const singles = uniqueDigits(info.singles || []);
  const candidates = singles
    .filter(d => !selected.includes(d))
    .filter(d => anchorDigits.includes(d) || (anchorScore[d] || 0) > 0)
    .sort((a,b) => ((anchorScore[b] || 0) + candidate.score[b]) - ((anchorScore[a] || 0) + candidate.score[a]));
  if(!candidates.length) return;

  // V4.6: jika latest punya kembar, digit tunggal yang juga muncul di jangkar hari target
  // harus dijaga, karena sering menjadi K/L. Contoh MAE 2344 + anchor Minggu 0153 → 1370.
  const rescue = candidates[0];
  const traceWidth = d => new Set((candidate.digitTrace[d] || []).map(x => x.family)).size;
  const protectedDigits = new Set();
  info.twins.forEach(d => protectedDigits.add(Number(d)));
  singles.forEach(d => { if(selected.includes(d) && anchorDigits.includes(d)) protectedDigits.add(Number(d)); });
  const victim = selected.slice()
    .filter(d => !protectedDigits.has(d))
    .sort((a,b) => (candidate.score[a] + 10*traceWidth(a) + 0.35*(anchorScore[a] || 0)) - (candidate.score[b] + 10*traceWidth(b) + 0.35*(anchorScore[b] || 0)))[0];
  if(victim == null) return;
  selected[selected.indexOf(victim)] = rescue;
}


function replaceWeakestForRescue(selected, rescue, candidate, protectedSet){
  if(selected.includes(rescue)) return;
  const traceWidth = d => new Set((candidate.digitTrace[d] || []).map(x => x.family)).size;
  const anchorScore = candidate.targetAnchorScore || Array(10).fill(0);
  const victim = selected.slice()
    .filter(d => !protectedSet.has(Number(d)) && d !== rescue)
    .sort((a,b) => (candidate.score[a] + 10*traceWidth(a) + 0.35*(anchorScore[a] || 0)) - (candidate.score[b] + 10*traceWidth(b) + 0.35*(anchorScore[b] || 0)))[0];
  if(victim == null) return;
  selected[selected.indexOf(victim)] = rescue;
}

function forceTargetAnchorCarryRescue(selected, latest, candidate){
  if(!candidate.targetAnchor) return;
  const info = twinInfo(latest);
  const anchorDigits = uniqueDigits(candidate.targetAnchor.digits || []);
  if(!anchorDigits.length) return;

  // V4.7: target-day carry guard.
  // Pada WSV 7550 → target Minggu, anchor Minggu terakhir 3100.
  // Digit 3 dan 1 adalah carry anchor, tetapi V4.6 hanya menyelamatkan hidden anchor.
  // Maka jika latest punya kembar atau anchor punya zero/twin, minimal dua carry anchor non-zero dijaga.
  const anchorCounts = countMap(candidate.targetAnchor.digits || []);
  const anchorHasTwinOrZero = Object.keys(anchorCounts).some(k => anchorCounts[k] >= 2 || Number(k) === 0);
  if(!info.twins.length && !anchorHasTwinOrZero) return;

  const anchorScore = candidate.targetAnchorScore || Array(10).fill(0);
  const nonZeroCarry = anchorDigits.filter(d => d !== 0);
  const targetCount = info.twins.length ? 2 : 1;
  const missing = nonZeroCarry
    .filter(d => !selected.includes(d))
    .sort((a,b) => (anchorScore[b] + candidate.score[b]) - (anchorScore[a] + candidate.score[a]));

  const protectedSet = new Set();
  // Jaga satu digit carry latest dan digit kembar terbaru agar rumus terbaru tidak hilang total.
  uniqueDigits((latest.digits || [])).forEach(d => { if(selected.includes(d) && (d === 0 || info.twins.includes(d) || d === latest.digits[0])) protectedSet.add(Number(d)); });
  nonZeroCarry.forEach(d => { if(selected.includes(d)) protectedSet.add(Number(d)); });

  missing.slice(0, targetCount).forEach(d => {
    replaceWeakestForRescue(selected, d, candidate, protectedSet);
    protectedSet.add(Number(d));
  });
}

function forceTwinSingleMirrorExpandedRescue(selected, latest, candidate){
  const info = twinInfo(latest);
  if(!info.twins.length) return;
  const anchorScore = candidate.targetAnchorScore || Array(10).fill(0);
  const protectedSet = new Set();
  info.twins.forEach(d => { if(selected.includes(d)) protectedSet.add(Number(d)); });
  uniqueDigits(candidate.targetAnchor?.digits || []).forEach(d => { if(selected.includes(d)) protectedSet.add(Number(d)); });
  if(selected.includes(latest.digits[0])) protectedSet.add(Number(latest.digits[0]));

  // V4.7: expanded single mirror guard.
  // Untuk latest 7550, digit tunggal 7 membuka 3 lewat 10-7 dan 6 lewat 7-1.
  // V4.6 hanya mengambil slice awal dari pecah kembar sehingga 6 bisa tertinggal.
  const priority = [];
  uniqueDigits(info.singles || []).forEach(s => {
    if(s !== 0){
      priority.push(mod10(10-s));
      priority.push(mod10(s-1));
      priority.push(mod10(9-s));
      priority.push(mod10(s+1));
    }else{
      priority.push(1,9,0);
    }
  });
  const candidates = uniqueDigits(priority)
    .filter(d => !selected.includes(d))
    .filter(d => (anchorScore[d] || 0) > 0 || (candidate.score[d] || 0) > 0);
  if(!candidates.length) return;

  const rescue = candidates[0];
  replaceWeakestForRescue(selected, rescue, candidate, protectedSet);
}



function buildTwinCycleProfile(rows, targetDay){
  const latest = rows[0] || {};
  const chrono = rows.slice().reverse();
  const latestTwins = twinInfo(latest).twins;
  const profile = {
    fromDay: latest.day || '-',
    toDay: targetDay || '-',
    latestTwins,
    total:0,
    targetNextTwin:0,
    targetPrevTwinCases:0,
    targetSameTwinRepeat:0,
    marketPrevTwinCases:0,
    marketSameTwinRepeat:0,
    marketNextTwinAfterTwin:0,
    sameTwinRepeatRate:0,
    marketSameTwinRepeatRate:0,
    nextTwinAfterTwinRate:0,
    targetTwinRate:0,
    nextTwinDigits:{},
    cooldownActive:false,
    samples:[]
  };
  const addTwinCounts = (digits) => {
    twinInfo({digits}).twins.forEach(d => profile.nextTwinDigits[d] = (profile.nextTwinDigits[d] || 0) + 1);
  };
  let carryOverlapTotal = 0;
  let carryOverlapMax = 0;
  for(let i=0;i<chrono.length-1;i++){
    const prev = chrono[i];
    const next = chrono[i+1];
    const prevTwins = twinInfo(prev).twins;
    const nextTwins = twinInfo(next).twins;
    if(prevTwins.length){
      profile.marketPrevTwinCases += 1;
      if(nextTwins.length) profile.marketNextTwinAfterTwin += 1;
      if(prevTwins.some(d => nextTwins.includes(d))) profile.marketSameTwinRepeat += 1;
    }
    if(prev.day === profile.fromDay && next.day === profile.toDay){
      profile.total += 1;
      if(nextTwins.length){
        profile.targetNextTwin += 1;
        addTwinCounts(next.digits);
      }
      if(prevTwins.length){
        profile.targetPrevTwinCases += 1;
        if(prevTwins.some(d => nextTwins.includes(d))) profile.targetSameTwinRepeat += 1;
      }
      if(profile.samples.length < 8){
        profile.samples.push(`${prev.day} ${prev.digits.join('')} → ${next.day} ${next.digits.join('')} | prev twin ${prevTwins.join('') || '-'} | next twin ${nextTwins.join('') || '-'}`);
      }
    }
  }
  profile.sameTwinRepeatRate = profile.targetPrevTwinCases ? profile.targetSameTwinRepeat / profile.targetPrevTwinCases : 0;
  profile.marketSameTwinRepeatRate = profile.marketPrevTwinCases ? profile.marketSameTwinRepeat / profile.marketPrevTwinCases : 0;
  profile.nextTwinAfterTwinRate = profile.marketPrevTwinCases ? profile.marketNextTwinAfterTwin / profile.marketPrevTwinCases : 0;
  profile.targetTwinRate = profile.total ? profile.targetNextTwin / profile.total : 0;
  profile.cooldownActive = !!(latestTwins.length && profile.marketPrevTwinCases >= 6 && profile.marketSameTwinRepeatRate <= 0.12);
  return profile;
}

function buildTwinCycleAudit(profile){
  if(!profile) return null;
  const nextTwinDigits = Object.entries(profile.nextTwinDigits || {})
    .sort((a,b) => b[1]-a[1] || Number(a[0])-Number(b[0]))
    .map(([d,c]) => `${d}${d}:${c}`)
    .join(' | ') || '-';
  return {
    title:`Twin cycle ${profile.fromDay} → ${profile.toDay}`,
    latestTwins:(profile.latestTwins || []).join(' ') || '-',
    sameRepeat:`${profile.targetSameTwinRepeat}/${profile.targetPrevTwinCases || 0} target, ${profile.marketSameTwinRepeat}/${profile.marketPrevTwinCases || 0} market`,
    nextTwin:`${profile.targetNextTwin}/${profile.total || 0} target-day transition`,
    nextTwinDigits,
    cooldown: profile.cooldownActive ? 'aktif: kembar sama tidak dipaksa ulang' : 'normal',
    samples: profile.samples || []
  };
}

function applyPostTwinAdaptiveSpread(candidate, latest, targetAnchor, profile, twinCycleProfile){
  candidate.postTwinSpreadScore = Array(10).fill(0);
  candidate.postTwinSpreadDigits = [];
  candidate.twinCooldown = {active:false, digits:[], note:''};
  const info = twinInfo(latest);
  const a = latest?.digits || [];
  if(!info.twins.length || a.length < 4) return;

  const cooldownActive = !!(twinCycleProfile?.cooldownActive);
  candidate.twinCooldown = {
    active:cooldownActive,
    digits:info.twins.slice(),
    note: cooldownActive ? 'Riwayat menunjukkan kembar yang sama sangat jarang berulang langsung.' : 'Tidak ada cooldown kuat.'
  };

  const add = (d, amount, note) => {
    d = Number(d);
    if(!Number.isInteger(d) || d < 0 || d > 9) return;
    candidate.postTwinSpreadScore[d] += amount;
    addCandidateTrace(candidate, d, amount, note, 'postTwinSpread');
  };

  const priority = [];
  const pushPriority = (d) => { d = Number(d); if(Number.isInteger(d) && d >= 0 && d <= 9 && !priority.includes(d)) priority.push(d); };

  info.twins.forEach(t => {
    const split = mod10(t+t);
    pushPriority(split);
    add(split, 1180 + (cooldownActive ? 260 : 0), 'Post-twin spread: pecah kembar t+t');
    add(mod10(t+6), 420, 'Post-twin spread: twin +6');
    add(mod10(t+4), 360, 'Post-twin spread: twin +4');
    if(cooldownActive){
      add(t, -520, 'Twin cooldown: kembar sama tidak dipaksa ulang');
    }
  });

  if(targetAnchor && (targetAnchor.digits || []).length >= 4){
    const ad = targetAnchor.digits;
    const anchorBack = mod10(ad[2] + ad[3]);
    const anchorMid = mod10(ad[1] + ad[2]);
    const anchorCross = mod10(ad[0] + ad[2]);
    const mirrorL10 = mod10(10 - ad[2]);
    const mirrorL9 = mod10(9 - ad[2]);
    const mirrorK10 = mod10(10 - ad[1]);
    [anchorBack, anchorMid, mirrorL10, anchorCross, mirrorK10, mirrorL9].forEach(pushPriority);
    add(anchorBack, 1160 + (cooldownActive ? 260 : 0), 'Post-twin spread: anchor L+E');
    add(anchorMid, 1040 + (cooldownActive ? 180 : 0), 'Post-twin spread: anchor K+L');
    add(mirrorL10, 980 + (cooldownActive ? 220 : 0), 'Post-twin spread: mirror10 L anchor');
    add(anchorCross, 640, 'Post-twin spread: anchor A+L');
    add(mirrorK10, 540, 'Post-twin spread: mirror10 K anchor');
    add(mirrorL9, 420, 'Post-twin spread: mirror9 L anchor');
  }

  if(profile && profile.total >= 4){
    (profile.positionCarryRate || []).forEach((rate, idx) => {
      if(rate >= 0.50){
        pushPriority(a[idx]);
        add(a[idx], Math.round(460*rate), `Post-twin spread: carry jadwal posisi ${posName(idx)}`);
      }
    });
  }

  candidate.postTwinSpreadDigits = priority;
}

function forcePostTwinSpreadRescue(selected, latest, candidate){
  const info = twinInfo(latest);
  if(!info.twins.length || !candidate.postTwinSpreadDigits?.length) return;
  const cooldownActive = !!candidate.twinCooldown?.active;
  const priority = candidate.postTwinSpreadDigits
    .filter(d => (candidate.postTwinSpreadScore?.[d] || 0) > 0)
    .sort((a,b) => (candidate.postTwinSpreadScore[b] || 0) - (candidate.postTwinSpreadScore[a] || 0) || a-b);
  if(!priority.length) return;

  const minimum = cooldownActive ? 3 : 2;
  // Yang wajib dilihat adalah inti spread tertinggi, bukan semua digit support.
  // Pada kasus 0188, support 1/2/8 sudah ada, tetapi inti 6/5/3 belum lengkap.
  const corePriority = priority.slice(0, minimum);
  const present = corePriority.filter(d => selected.includes(d)).length;
  let need = Math.max(0, minimum - present);
  if(!need) return;

  const protectedSet = new Set();
  info.twins.forEach(t => { if(selected.includes(t)) protectedSet.add(Number(t)); });
  const strongest = selected.slice().sort((a,b) => candidate.score[b]-candidate.score[a])[0];
  if(strongest != null) protectedSet.add(Number(strongest));

  const traceWidth = d => new Set((candidate.digitTrace?.[d] || []).map(x => x.family)).size;
  const rescueOne = (d) => {
    if(selected.includes(d)) return false;
    const victim = selected.slice()
      .filter(x => !protectedSet.has(Number(x)) && x !== d)
      .sort((a,b) => {
        const sa = candidate.score[a] + 7*traceWidth(a) - 0.72*(candidate.postTwinSpreadScore?.[a] || 0);
        const sb = candidate.score[b] + 7*traceWidth(b) - 0.72*(candidate.postTwinSpreadScore?.[b] || 0);
        return sa - sb || candidate.score[a] - candidate.score[b];
      })[0];
    if(victim == null) return false;
    selected[selected.indexOf(victim)] = d;
    protectedSet.add(Number(d));
    return true;
  };
  for(const d of corePriority){
    if(need <= 0) break;
    if(rescueOne(d)) need -= 1;
  }
}

function postTwinSpreadPairSeeds(latest, candidate, targetAnchor, kind){
  const info = twinInfo(latest);
  const a = latest?.digits || [];
  const seeds = [];
  const add = (pair, bonus, label) => { if(/^\d{2}$/.test(pair)) seeds.push({pair, width:2, bonus, label}); };
  if(!info.twins.length || a.length < 4) return seeds;
  const t = info.twins[0];
  const split = mod10(t+t);
  const cooldown = candidate.twinCooldown?.active;

  if(targetAnchor && (targetAnchor.digits || []).length >= 4){
    const ad = targetAnchor.digits;
    const anchorBack = mod10(ad[2] + ad[3]);
    const anchorMid = mod10(ad[1] + ad[2]);
    const mirrorL10 = mod10(10 - ad[2]);
    const mirrorK10 = mod10(10 - ad[1]);
    if(kind === 'AK'){
      add(`${split}${mirrorL10}`, 17400 + (cooldown ? 1600 : 0), 'AK post-twin: split + mirror10 L anchor');
      add(`${anchorMid}${mirrorL10}`, 13200 + (cooldown ? 900 : 0), 'AK post-twin: anchor K+L + mirror10 L');
      add(`${split}${anchorBack}`, 9800, 'AK post-twin: split + anchor L+E');
      add(`${mirrorK10}${anchorMid}`, 6200, 'AK post-twin: mirror10 K + anchor middle');
    }else{
      add(`${anchorBack}${t}`, 17800 + (cooldown ? 1400 : 0), 'LE post-twin: anchor L+E + carry twin');
      add(`${anchorBack}${split}`, 12600, 'LE post-twin: anchor L+E + split');
      add(`${mirrorL10}${t}`, 9200, 'LE post-twin: mirror10 L + carry twin');
      add(`${anchorMid}${t}`, 7600, 'LE post-twin: anchor K+L + carry twin');
    }
  }
  return seeds;
}

function buildTransitionProfile(rows, targetDay){
  const latest = rows[0] || {};
  const chrono = rows.slice().reverse();
  const profile = {
    fromDay: latest.day || '-',
    toDay: targetDay || '-',
    total: 0,
    positionCarry: [0,0,0,0],
    positionSame: [0,0,0,0],
    positionCarryRate: [0,0,0,0],
    positionSameRate: [0,0,0,0],
    samples: []
  };
  if(!profile.fromDay || profile.fromDay === '-' || !profile.toDay || profile.toDay === '-') return profile;
  let carryOverlapTotal = 0;
  let carryOverlapMax = 0;
  for(let i=0;i<chrono.length-1;i++){
    const prev = chrono[i];
    const next = chrono[i+1];
    if(prev.day !== profile.fromDay || next.day !== profile.toDay) continue;
    profile.total += 1;
    const nextSet = uniqueDigits(next.digits);
    const carried = [];
    for(let p=0;p<4;p++){
      const d = prev.digits[p];
      if(nextSet.includes(d)){
        profile.positionCarry[p] += 1;
        carried.push(`${posName(p)}=${d}`);
      }
      if(prev.digits[p] === next.digits[p]) profile.positionSame[p] += 1;
    }
    if(profile.samples.length < 8){
      profile.samples.push(`${prev.day} ${prev.digits.join('')} → ${next.day} ${next.digits.join('')} | carry ${carried.join(', ') || '-'}`);
    }
  }
  if(profile.total){
    profile.positionCarryRate = profile.positionCarry.map(x => x / profile.total);
    profile.positionSameRate = profile.positionSame.map(x => x / profile.total);
  }
  return profile;
}

function applyTransitionCarryProfile(candidate, latest, profile){
  candidate.transitionCarryScore = Array(10).fill(0);
  if(!profile || profile.total < 4 || !(latest?.digits || []).length) return;
  for(let p=0;p<4;p++){
    const rate = profile.positionCarryRate[p] || 0;
    const same = profile.positionSameRate[p] || 0;
    // Kunci ini khusus untuk transisi jadwal historis, misalnya Senin→Rabu.
    // Posisi yang sering hidup kembali di draw berikutnya diberi bobot supaya tidak terbuang oleh rescue lain.
    if(rate < 0.30) continue;
    const d = latest.digits[p];
    const amount = Math.round(820*rate + 260*same + (p === 3 ? 90 : 0));
    candidate.transitionCarryScore[d] += amount;
    addCandidateTrace(candidate, d, amount, `Transition carry ${profile.fromDay}→${profile.toDay} posisi ${posName(p)}`, 'transitionCarry');
  }
}

function forceTransitionCarryRescue(selected, latest, candidate){
  const profile = candidate.transitionProfile;
  if(!profile || profile.total < 4 || !(latest?.digits || []).length) return;
  const required = [];
  for(let p=0;p<4;p++){
    const rate = profile.positionCarryRate[p] || 0;
    // Ambang dibuat adaptif: K dan E biasanya lebih penting sebagai pintu tengah/ekor.
    const threshold = (p === 1 || p === 3) ? 0.40 : 0.34;
    if(rate >= threshold){
      required.push({p, d:latest.digits[p], rate, same:profile.positionSameRate[p] || 0});
    }
  }
  if(!required.length) return;
  required.sort((a,b) => b.rate - a.rate || b.same - a.same || b.p - a.p);

  const protectedSet = new Set();
  // Jangan buang dua digit terkuat umum, digit anchor kuat, dan digit yang sudah menjadi carry transisi.
  DIGITS.slice().sort((a,b) => candidate.score[b]-candidate.score[a]).slice(0,2).forEach(d => { if(selected.includes(d)) protectedSet.add(Number(d)); });
  uniqueDigits(candidate.targetAnchor?.digits || []).forEach(d => { if(selected.includes(d)) protectedSet.add(Number(d)); });
  required.forEach(x => { if(selected.includes(x.d)) protectedSet.add(Number(x.d)); });

  required.slice(0,3).forEach(x => {
    if(selected.includes(x.d)) return;
    replaceWeakestForRescue(selected, x.d, candidate, protectedSet);
    protectedSet.add(Number(x.d));
  });
}

function buildTransitionProfileAudit(profile, latest){
  if(!profile || !profile.total) return null;
  const pos = ['A','K','L','E'];
  return {
    title:`Pola transisi ${profile.fromDay} → ${profile.toDay}`,
    total: profile.total,
    latestCarry: pos.map((name,i) => `${name}=${latest.digits[i]} (${profile.positionCarry[i]}/${profile.total})`).join(' | '),
    samples: profile.samples || []
  };
}


function posName(index){return ['A','K','L','E'][index] || String(index);}

function applyComplementCarryBridge(candidate, latest, targetAnchor, profile){
  candidate.complementBridgeScore = Array(10).fill(0);
  candidate.complementBridgeDigits = [];
  candidate.complementBridgeAudit = null;
  const a = latest?.digits || [];
  if(a.length < 4) return;
  const rate = idx => profile?.positionCarryRate?.[idx] || 0;
  const root = digitalRoot(sumDigits(latest));
  const add = (d, amount, note) => {
    d = Number(d);
    if(!Number.isInteger(d) || d < 0 || d > 9) return;
    candidate.complementBridgeScore[d] += amount;
    addCandidateTrace(candidate, d, amount, note, 'complementBridge');
  };

  const ae = mod10(a[0] + a[3]);
  const kl = mod10(a[1] + a[2]);
  const al = mod10(a[0] + a[2]);
  const ke = mod10(a[1] + a[3]);
  const ak = mod10(a[0] + a[1]);
  const le = mod10(a[2] + a[3]);
  const anchorDigits = targetAnchor?.digits || [];
  const anchorMid = anchorDigits.length >= 4 ? mod10(anchorDigits[1] + anchorDigits[2]) : null;
  const anchorBack = anchorDigits.length >= 4 ? mod10(anchorDigits[2] + anchorDigits[3]) : null;

  // V5.2: jika A+E menutup ke 0, digit 0 sering menjadi pintu tersembunyi.
  // Namun kandidat kembar tidak otomatis 00; bagian pembentuknya, terutama A yang punya carry transisi,
  // harus dibaca sebagai twin seed. Contoh SYD 6934 → 9606: A+E=0, A=6 menjadi twin 66.
  if(ae === 0){
    add(0, 2350 + Math.round(400*(rate(0)+rate(3))), 'Complement bridge A+E = 0');
    add(a[0], 1320 + Math.round(1500*rate(0)), 'Complement bridge twin seed dari A saat A+E=0');
    add(a[3], 540 + Math.round(700*rate(3)), 'Complement bridge E support saat A+E=0');
    add(al, 760 + Math.round(600*rate(0)), 'Complement bridge A+L pembuka AK');
    add(ke, 420, 'Complement bridge K+E support');
  }else{
    // Tetap baca pelan operasi komplementer, tetapi tidak memaksa jika tidak ada zero bridge.
    add(ae, 260, 'Complement bridge A+E ringan');
  }

  // Jika K punya carry transisi kuat, kombinasikan K dengan A sebagai pintu masuk balik.
  // Ini menutup blind spot AK 96 pada latest 6934.
  if(rate(1) >= 0.40 && rate(0) >= 0.20){
    add(a[1], 360 + Math.round(520*rate(1)), 'Complement bridge carry K');
    add(a[0], 420 + Math.round(760*rate(0)), 'Complement bridge carry A');
  }

  // Jika anchor hari target mengulang sudut/tengah yang mengarah ke digit pembuka, beri dukungan kecil.
  [anchorMid, anchorBack, root, kl, ak, le].filter(x => x != null).forEach((d,i) => add(d, Math.max(120, 360 - i*38), 'Complement bridge anchor/root support'));

  candidate.complementBridgeDigits = DIGITS.filter(d => candidate.complementBridgeScore[d] > 0).sort((x,y) => candidate.complementBridgeScore[y] - candidate.complementBridgeScore[x]);
  if(candidate.complementBridgeDigits.length){
    candidate.complementBridgeAudit = {
      zeroBridge: ae === 0,
      title: ae === 0 ? `Complement bridge aktif: A+E ${a[0]}+${a[3]} = 0` : `Complement bridge ringan: A+E = ${ae}`,
      digits: candidate.complementBridgeDigits.slice(0,6).map(d => `${d}:${Math.round(candidate.complementBridgeScore[d])}`).join(' | ')
    };
  }
}

function forceComplementCarryBridgeRescue(selected, latest, candidate){
  const a = latest?.digits || [];
  if(a.length < 4 || !candidate.complementBridgeDigits?.length) return;
  const ae = mod10(a[0] + a[3]);
  if(ae !== 0) return;

  const required = uniqueDigits([0, a[0], mod10(a[0]+a[2])])
    .filter(d => (candidate.complementBridgeScore?.[d] || 0) >= 700);
  if(!required.length) return;

  const protectedSet = new Set();
  // Jaga tiga skor terbesar dan digit yang sudah menjadi requirement bridge.
  DIGITS.slice().sort((x,y) => candidate.score[y]-candidate.score[x]).slice(0,3).forEach(d => {
    if(selected.includes(d)) protectedSet.add(Number(d));
  });
  required.forEach(d => { if(selected.includes(d)) protectedSet.add(Number(d)); });

  required.forEach(d => {
    if(selected.includes(d)) return;
    const victim = selected.slice()
      .filter(x => !protectedSet.has(Number(x)))
      .sort((x,y) => (candidate.score[x] + 0.25*((candidate.targetAnchorScore || [])[x] || 0)) - (candidate.score[y] + 0.25*((candidate.targetAnchorScore || [])[y] || 0)))[0];
    if(victim == null) return;
    selected[selected.indexOf(victim)] = d;
    protectedSet.add(Number(d));
  });
}

function buildComplementBridgeAudit(audit){
  if(!audit) return null;
  return {title:audit.title, digits:audit.digits};
}


function applyCenterBridgeFormula(candidate, latest, targetAnchor, marketProfile){
  candidate.centerBridgeScore = Array(10).fill(0);
  candidate.centerBridgeTwinScore = Array(10).fill(0);
  candidate.centerBridgeDigits = [];
  candidate.centerBridgeTwinDigits = [];
  candidate.centerBridgeAudit = null;
  const a = latest?.digits || [];
  if(a.length < 4) return;
  const counts = countMap(a);
  const latestHasTwin = Object.values(counts).some(v => v >= 2);
  const kl = mod10(a[1] + a[2]);
  const ke = mod10(a[1] + a[3]);
  const ak = mod10(a[0] + a[1]);
  const le = mod10(a[2] + a[3]);
  const al = mod10(a[0] + a[2]);
  const ae = mod10(a[0] + a[3]);
  const root = digitalRoot(sumDigits(latest));
  const hardCap = Number(marketProfile?.targetCarryHardCap || 4);
  const samples = Number(marketProfile?.targetCarrySamples || marketProfile?.total || 0);
  const nonCarry = marketProfile?.nonCarryScore || Array(10).fill(0);
  const digitMemory = marketProfile?.digitScore || Array(10).fill(0);
  const lowCarryTransition = samples >= 5 && hardCap <= 2;
  const add = (d, amount, note, twin=false) => {
    d = Number(d);
    if(!Number.isInteger(d) || d < 0 || d > 9) return;
    candidate.centerBridgeScore[d] += amount;
    if(twin) candidate.centerBridgeTwinScore[d] += Math.round(amount * 0.9);
    addCandidateTrace(candidate, d, amount, note, 'centerBridge');
  };

  const marketBoost = d => Math.round(0.10*(digitMemory[d] || 0) + 0.18*(nonCarry[d] || 0));
  const base = lowCarryTransition ? 1480 : 680;
  add(kl, base + marketBoost(kl), 'Center bridge K+L', !latestHasTwin);
  add(ke, Math.round(base*0.92) + marketBoost(ke), 'Center bridge K+E', !latestHasTwin && lowCarryTransition);
  add(ak, Math.round(base*0.72) + marketBoost(ak), 'Center bridge A+K support', false);
  add(le, Math.round(base*0.44) + marketBoost(le), 'Center bridge L+E support', false);
  add(root, 260 + marketBoost(root), 'Center bridge root check', false);
  if(lowCarryTransition){
    add(a[1], 780 + Math.round(0.14*(digitMemory[a[1]] || 0)), 'Center bridge carry K sebagai pintu tengah', false);
    add(a[2], 420 + Math.round(0.10*(digitMemory[a[2]] || 0)), 'Center bridge carry L ringan', false);
    add(al, 360 + marketBoost(al), 'Center bridge A+L pembanding', false);
    add(ae, 320 + marketBoost(ae), 'Center bridge A+E pembanding', false);
  }
  candidate.centerBridgeDigits = DIGITS.filter(d => candidate.centerBridgeScore[d] > 0).sort((x,y) => candidate.centerBridgeScore[y]-candidate.centerBridgeScore[x]);
  candidate.centerBridgeTwinDigits = DIGITS.filter(d => candidate.centerBridgeTwinScore[d] > 0).sort((x,y) => candidate.centerBridgeTwinScore[y]-candidate.centerBridgeTwinScore[x]);
  if(candidate.centerBridgeDigits.length){
    candidate.centerBridgeAudit = {
      title:`Center bridge aktif: K+L=${kl}, K+E=${ke}, A+K=${ak}`,
      lowCarry: lowCarryTransition,
      digits:candidate.centerBridgeDigits.slice(0,6).map(d => `${d}:${Math.round(candidate.centerBridgeScore[d])}`).join(' | '),
      twin:candidate.centerBridgeTwinDigits.slice(0,4).map(d => `${d}${d}:${Math.round(candidate.centerBridgeTwinScore[d])}`).join(' | ') || '-'
    };
  }
}

function forceCenterBridgeRescue(selected, latest, candidate){
  const a = latest?.digits || [];
  const profile = candidate.marketProfile;
  if(a.length < 4 || !candidate.centerBridgeDigits?.length) return;
  const hardCap = Number(profile?.targetCarryHardCap || 4);
  const lowCarry = Number(profile?.targetCarrySamples || profile?.total || 0) >= 5 && hardCap <= 2;
  const kl = mod10(a[1]+a[2]);
  const ke = mod10(a[1]+a[3]);
  const ak = mod10(a[0]+a[1]);
  const required = uniqueDigits(lowCarry ? [kl, ke, ak] : [kl, ke])
    .filter(d => (candidate.centerBridgeScore?.[d] || 0) >= 600);
  if(!required.length) return;
  const latestSet = new Set(uniqueDigits(a));
  const protectedSet = new Set(required.filter(d => selected.includes(d)).map(Number));
  const traceWidth = d => new Set((candidate.digitTrace?.[d] || []).map(x => x.family)).size;
  const bridgePower = d => (candidate.centerBridgeScore?.[d] || 0) + 0.20*(candidate.score?.[d] || 0) + 28*traceWidth(d);
  const victimScore = d => {
    let penalty = candidate.score?.[d] || 0;
    if(latestSet.has(Number(d)) && !required.includes(Number(d))) penalty -= lowCarry ? 1150 : 420;
    penalty += 0.12*((candidate.marketNonCarryScore || [])[d] || 0);
    penalty += 0.08*((candidate.marketMemoryScore || [])[d] || 0);
    return penalty;
  };
  required.sort((x,y) => bridgePower(y)-bridgePower(x)).forEach(d => {
    if(selected.includes(d)){ protectedSet.add(Number(d)); return; }
    const victim = selected.slice()
      .filter(x => !protectedSet.has(Number(x)))
      .sort((x,y) => victimScore(x) - victimScore(y) || (latestSet.has(Number(y))?1:0) - (latestSet.has(Number(x))?1:0))[0];
    if(victim == null) return;
    selected[selected.indexOf(victim)] = d;
    protectedSet.add(Number(d));
  });
}

function buildCenterBridgeAudit(audit){
  if(!audit) return null;
  return {title:audit.title + (audit.lowCarry ? ' • carry rendah' : ''), digits:audit.digits, twin:audit.twin};
}


// V5.8: Target Edge Bridge
// Blind spot sebelumnya: saat target hari berikutnya punya anchor kuat, engine hanya membaca anchor sebagai bobot digit,
// bukan sebagai jembatan posisi. Untuk pola Sabtu→Senin, kombinasi edge anchor A/E + edge latest A/E
// dapat membuka quartet target tanpa mengandalkan frekuensi angka: anchor A | latest A | latest E | anchor E.
function targetEdgeBridgeContext(latest, targetAnchor, transitionProfile, marketProfile){
  const ld = latest?.digits || [];
  const ad = targetAnchor?.digits || [];
  if(ld.length < 4 || ad.length < 4) return null;
  const latestTwin = twinInfo(latest).twins.length > 0;
  const anchorTwin = twinInfo(targetAnchor).twins.length > 0;
  const transitionSamples = Number(transitionProfile?.total || marketProfile?.total || 0);
  if(transitionSamples < 4) return null;
  const hardCap = Number(marketProfile?.targetCarryHardCap || 4);
  const lowCarry = Number(marketProfile?.targetCarrySamples || marketProfile?.total || 0) >= 5 && hardCap <= 2;
  const edges = uniqueDigits([ad[0], ld[0], ld[3], ad[3]]);
  if(edges.length < 3) return null;
  return {ld, ad, latestTwin, anchorTwin, lowCarry, transitionSamples, hardCap, edges};
}

function applyTargetEdgeBridge(candidate, latest, targetAnchor, transitionProfile, marketProfile){
  candidate.targetEdgeBridgeScore = Array(10).fill(0);
  candidate.targetEdgeBridgeDigits = [];
  candidate.targetEdgeBridgeAudit = null;
  const ctx = targetEdgeBridgeContext(latest, targetAnchor, transitionProfile, marketProfile);
  if(!ctx) return;
  const {ld, ad, lowCarry, transitionSamples} = ctx;
  const add = (d, amount, note) => {
    d = Number(d);
    if(!Number.isInteger(d) || d < 0 || d > 9) return;
    candidate.targetEdgeBridgeScore[d] += amount;
    addCandidateTrace(candidate, d, amount, note, 'targetEdgeBridge');
  };
  const base = lowCarry ? 2450 : 1480;
  // Edge luar diberi bobot paling besar karena ia menjaga digit yang sering kalah oleh center/world replay.
  add(ad[0], base + 520, 'Target edge bridge: anchor A sebagai pembuka');
  add(ld[0], base + 430, 'Target edge bridge: latest A sebagai carry depan');
  add(ld[3], base + 430, 'Target edge bridge: latest E sebagai carry belakang');
  add(ad[3], base + 520, 'Target edge bridge: anchor E sebagai penutup');
  // Dukungan tengah tetap ada, tetapi tidak boleh mendominasi edge.
  add(ad[1], Math.round(base*0.32), 'Target edge bridge: anchor K support');
  add(ad[2], Math.round(base*0.28), 'Target edge bridge: anchor L support');
  add(mod10(ad[0] + ld[0]), Math.round(base*0.42), 'Target edge bridge: A anchor + A latest');
  add(mod10(ld[3] + ad[3]), Math.round(base*0.42), 'Target edge bridge: E latest + E anchor');

  candidate.targetEdgeBridgeDigits = uniqueDigits([ad[0], ld[0], ld[3], ad[3]])
    .sort((x,y) => (candidate.targetEdgeBridgeScore[y] || 0) - (candidate.targetEdgeBridgeScore[x] || 0));
  candidate.targetEdgeBridgeAudit = {
    title:`Target edge bridge aktif: anchor ${targetAnchor.day || '-'} ${ad.join('')} × latest ${latest.day || '-'} ${ld.join('')}`,
    digits:candidate.targetEdgeBridgeDigits.map(d => `${d}:${Math.round(candidate.targetEdgeBridgeScore[d] || 0)}`).join(' | '),
    ak:`${ad[0]}${ld[0]}`,
    le:`${ld[3]}${ad[3]}`,
    transitionSamples
  };
}

function forceTargetEdgeBridgeRescue(selected, latest, candidate){
  if(!candidate.targetEdgeBridgeDigits?.length) return;
  const score = candidate.targetEdgeBridgeScore || Array(10).fill(0);
  const required = candidate.targetEdgeBridgeDigits
    .filter(d => (score[d] || 0) >= 1200)
    .sort((a,b) => (score[b] || 0) - (score[a] || 0));
  if(required.length < 3) return;
  // Jika bridge aktif, minimal empat digit edge harus terlihat dalam 6D saat ruang masih 6 digit.
  const minimum = Math.min(4, required.length);
  let present = required.filter(d => selected.includes(d)).length;
  if(present >= minimum) return;

  const protectedSet = new Set(required.filter(d => selected.includes(d)).map(Number));
  // Lindungi satu skor umum paling tinggi agar output tidak berubah menjadi murni anchor/carry saja.
  const strongest = selected.slice().sort((a,b) => (candidate.score[b] || 0) - (candidate.score[a] || 0))[0];
  if(strongest != null) protectedSet.add(Number(strongest));
  const traceWidth = d => new Set((candidate.digitTrace?.[d] || []).map(x => x.family)).size;
  const victimScore = d =>
    (candidate.score?.[d] || 0) + 10*traceWidth(d) - 0.90*(score[d] || 0) + 0.12*((candidate.worldReplayScore || [])[d] || 0);
  for(const d of required){
    if(present >= minimum) break;
    if(selected.includes(d)) continue;
    const victim = selected.slice()
      .filter(x => !protectedSet.has(Number(x)))
      .sort((a,b) => victimScore(a) - victimScore(b) || (candidate.score[a] || 0) - (candidate.score[b] || 0))[0];
    if(victim == null) continue;
    selected[selected.indexOf(victim)] = d;
    protectedSet.add(Number(d));
    present += 1;
  }
}

function targetEdgeBridgePairSeeds(latest, targetAnchor, candidate, kind){
  const ctx = targetEdgeBridgeContext(latest, targetAnchor, candidate?.transitionProfile, candidate?.marketProfile);
  if(!ctx) return [];
  const {ld, ad, lowCarry} = ctx;
  const seeds = [];
  const add = (pair, bonus, label) => { if(/^\d{2}$/.test(pair)) seeds.push({pair, width:2, bonus, label}); };
  const base = lowCarry ? 26800 : 18800;
  if(kind === 'AK'){
    add(`${ad[0]}${ld[0]}`, base + 7200, 'AK target-edge: anchor A + latest A');
    add(`${ld[0]}${ad[0]}`, Math.round(base*0.72), 'AK target-edge balik: latest A + anchor A');
    add(`${ad[0]}${ld[3]}`, Math.round(base*0.58), 'AK target-edge: anchor A + latest E');
    add(`${ad[3]}${ld[0]}`, Math.round(base*0.52), 'AK target-edge: anchor E + latest A');
  }else{
    add(`${ld[3]}${ad[3]}`, base + 7200, 'LE target-edge: latest E + anchor E');
    add(`${ad[3]}${ld[3]}`, Math.round(base*0.72), 'LE target-edge balik: anchor E + latest E');
    add(`${ld[3]}${ad[0]}`, Math.round(base*0.58), 'LE target-edge: latest E + anchor A');
    add(`${ld[0]}${ad[3]}`, Math.round(base*0.52), 'LE target-edge: latest A + anchor E');
  }
  return seeds;
}

function applyTargetEdgeBridgePairLock(ranked, kind, latest, targetAnchor, candidate){
  const seeds = targetEdgeBridgePairSeeds(latest, targetAnchor, candidate, kind).slice(0,3);
  if(!seeds.length) return ranked;
  const map = {};
  ranked.forEach(x => map[x.pair] = {...x, notes:[...(x.notes || [])]});
  const ensure = (pair, points, note) => {
    if(!/^\d{2}$/.test(pair)) return;
    if(!map[pair]) map[pair] = {pair, points:0, notes:[]};
    map[pair].points = Math.max(map[pair].points, points);
    if(note && !map[pair].notes.includes(note)) map[pair].notes.unshift(note);
  };
  seeds.forEach((s,i) => ensure(s.pair, 56000 + (s.bonus || 0) - i*1400, 'target edge bridge lock'));
  return Object.values(map).sort((a,b) => b.points - a.points || a.pair.localeCompare(b.pair));
}


// V5.9: Target Diagonal Bridge
// Blind spot baru: jika anchor hari target memiliki digit kembar/berulang, edge bridge V5.8 terlalu memilih
// anchor A + latest A dan latest E + anchor E. Untuk pola seperti Senin 0413 → Selasa anchor 8186,
// target justru terbaca dari diagonal anchor-tengah: (anchor A + latest K) | anchor twin, lalu anchor K/latest L | anchor E.
function targetDiagonalBridgeContext(latest, targetAnchor, transitionProfile, marketProfile){
  const ld = latest?.digits || [];
  const ad = targetAnchor?.digits || [];
  if(ld.length < 4 || ad.length < 4) return null;
  const transitionSamples = Number(transitionProfile?.total || marketProfile?.total || 0);
  if(transitionSamples < 4) return null;
  const latestTwins = twinInfo(latest).twins || [];
  const anchorInfo = twinInfo(targetAnchor);
  const anchorTwins = anchorInfo.twins || [];
  // Diagonal bridge hanya aktif saat anchor target punya pengulang kuat dan latest tidak sedang kembar.
  // Dengan begitu kasus V5.8 sebelumnya (anchor non-kembar) tidak ikut dikunci oleh jalur ini.
  if(!anchorTwins.length || latestTwins.length) return null;
  const anchorTwin = anchorTwins[0];
  const diagA = mod10(anchorTwin + ld[1]);
  const diagAlt = mod10(ad[0] + ld[1]);
  const middle = ad[1];
  const middleAlt = ld[2];
  const closeE = ad[3];
  const hardCap = Number(marketProfile?.targetCarryHardCap || 4);
  const lowCarry = Number(marketProfile?.targetCarrySamples || marketProfile?.total || 0) >= 5 && hardCap <= 2;
  return {ld, ad, anchorTwin, diagA, diagAlt, middle, middleAlt, closeE, transitionSamples, lowCarry, hardCap};
}

function applyTargetDiagonalBridge(candidate, latest, targetAnchor, transitionProfile, marketProfile){
  candidate.targetDiagonalBridgeScore = Array(10).fill(0);
  candidate.targetDiagonalBridgeDigits = [];
  candidate.targetDiagonalBridgeAudit = null;
  const ctx = targetDiagonalBridgeContext(latest, targetAnchor, transitionProfile, marketProfile);
  if(!ctx) return;
  const {ld, ad, anchorTwin, diagA, diagAlt, middle, middleAlt, closeE, lowCarry, transitionSamples} = ctx;
  const add = (d, amount, note) => {
    d = Number(d);
    if(!Number.isInteger(d) || d < 0 || d > 9) return;
    candidate.targetDiagonalBridgeScore[d] += amount;
    addCandidateTrace(candidate, d, amount, note, 'targetDiagonalBridge');
  };
  const base = lowCarry ? 2860 : 2140;
  add(diagA, base + 1180, 'Target diagonal bridge: anchor twin + latest K');
  if(diagAlt !== diagA) add(diagAlt, Math.round(base*0.74), 'Target diagonal bridge: anchor A + latest K');
  add(anchorTwin, base + 950, 'Target diagonal bridge: anchor twin sebagai K/pivot');
  add(middle, base + 880, 'Target diagonal bridge: anchor K sebagai L/pivot tengah');
  if(middleAlt !== middle) add(middleAlt, Math.round(base*0.92), 'Target diagonal bridge: latest L support tengah');
  add(closeE, base + 1020, 'Target diagonal bridge: anchor E sebagai penutup');
  // Support ringan agar tetap matematis, bukan hardcode target.
  add(mod10(ld[0] + ad[1]), Math.round(base*0.36), 'Target diagonal support: latest A + anchor K');
  add(Math.abs(ad[0] - ld[3]) % 10, Math.round(base*0.34), 'Target diagonal support: diff anchor A - latest E');

  candidate.targetDiagonalBridgeDigits = uniqueDigits([diagA, anchorTwin, middle, middleAlt, closeE])
    .sort((x,y) => (candidate.targetDiagonalBridgeScore[y] || 0) - (candidate.targetDiagonalBridgeScore[x] || 0));
  candidate.targetDiagonalBridgeAudit = {
    title:`Target diagonal bridge aktif: anchor twin ${anchorTwin}${anchorTwin} dari ${targetAnchor.day || '-'} ${ad.join('')} × latest ${latest.day || '-'} ${ld.join('')}`,
    digits:candidate.targetDiagonalBridgeDigits.map(d => `${d}:${Math.round(candidate.targetDiagonalBridgeScore[d] || 0)}`).join(' | '),
    ak:`${diagA}${anchorTwin}`,
    le:`${middle}${closeE}`,
    altLE:`${middleAlt}${closeE}`,
    transitionSamples
  };
}

function forceTargetDiagonalBridgeRescue(selected, latest, candidate){
  if(!candidate.targetDiagonalBridgeDigits?.length) return;
  const score = candidate.targetDiagonalBridgeScore || Array(10).fill(0);
  const required = candidate.targetDiagonalBridgeDigits
    .filter(d => (score[d] || 0) >= 1600)
    .sort((a,b) => (score[b] || 0) - (score[a] || 0));
  if(required.length < 4) return;
  const minimum = Math.min(4, required.length);
  let present = required.filter(d => selected.includes(d)).length;
  if(present >= minimum) return;

  const protectedSet = new Set(required.filter(d => selected.includes(d)).map(Number));
  // Lindungi satu skor umum tertinggi dan satu world replay tertinggi supaya hasil tidak menjadi bridge murni.
  const strongest = selected.slice().sort((a,b) => (candidate.score[b] || 0) - (candidate.score[a] || 0))[0];
  if(strongest != null) protectedSet.add(Number(strongest));
  const replayStrong = selected.slice().sort((a,b) => ((candidate.worldReplayScore || [])[b] || 0) - ((candidate.worldReplayScore || [])[a] || 0))[0];
  if(replayStrong != null && protectedSet.size < 2) protectedSet.add(Number(replayStrong));

  const traceWidth = d => new Set((candidate.digitTrace?.[d] || []).map(x => x.family)).size;
  const victimScore = d =>
    (candidate.score?.[d] || 0) + 10*traceWidth(d) - 1.25*(score[d] || 0) + 0.08*((candidate.worldReplayScore || [])[d] || 0);
  for(const d of required){
    if(present >= minimum) break;
    if(selected.includes(d)) continue;
    const victim = selected.slice()
      .filter(x => !protectedSet.has(Number(x)))
      .sort((a,b) => victimScore(a) - victimScore(b) || (candidate.score[a] || 0) - (candidate.score[b] || 0))[0];
    if(victim == null) continue;
    selected[selected.indexOf(victim)] = d;
    protectedSet.add(Number(d));
    present += 1;
  }
}

function targetDiagonalBridgePairSeeds(latest, targetAnchor, candidate, kind){
  const ctx = targetDiagonalBridgeContext(latest, targetAnchor, candidate?.transitionProfile, candidate?.marketProfile);
  if(!ctx) return [];
  const {ld, ad, anchorTwin, diagA, diagAlt, middle, middleAlt, closeE, lowCarry} = ctx;
  const seeds = [];
  const add = (pair, bonus, label) => { if(/^\d{2}$/.test(pair)) seeds.push({pair, width:2, bonus, label}); };
  const base = lowCarry ? 34600 : 27800;
  if(kind === 'AK'){
    add(`${diagA}${anchorTwin}`, base + 11800, 'AK target-diagonal: anchor twin + latest K | anchor twin');
    if(diagAlt !== diagA) add(`${diagAlt}${anchorTwin}`, Math.round(base*0.72), 'AK target-diagonal: anchor A + latest K | anchor twin');
    add(`${diagA}${ad[0]}`, Math.round(base*0.58), 'AK target-diagonal: diagonal A + anchor A');
    add(`${diagA}${ad[2]}`, Math.round(base*0.54), 'AK target-diagonal: diagonal A + anchor L');
  }else{
    add(`${middle}${closeE}`, base + 11800, 'LE target-diagonal: anchor K + anchor E');
    if(middleAlt !== middle) add(`${middleAlt}${closeE}`, base + 9400, 'LE target-diagonal: latest L + anchor E');
    add(`${middle}${anchorTwin}`, Math.round(base*0.58), 'LE target-diagonal: anchor K + anchor twin');
    add(`${middleAlt}${anchorTwin}`, Math.round(base*0.52), 'LE target-diagonal: latest L + anchor twin');
  }
  return seeds;
}

function applyTargetDiagonalBridgePairLock(ranked, kind, latest, targetAnchor, candidate){
  const seeds = targetDiagonalBridgePairSeeds(latest, targetAnchor, candidate, kind).slice(0,4);
  if(!seeds.length) return ranked;
  const map = {};
  ranked.forEach(x => map[x.pair] = {...x, notes:[...(x.notes || [])]});
  const ensure = (pair, points, note) => {
    if(!/^\d{2}$/.test(pair)) return;
    if(!map[pair]) map[pair] = {pair, points:0, notes:[]};
    map[pair].points = Math.max(map[pair].points, points);
    if(note && !map[pair].notes.includes(note)) map[pair].notes.unshift(note);
  };
  seeds.forEach((s,i) => ensure(s.pair, 150000 + (s.bonus || 0) - i*1600, 'target diagonal bridge lock'));
  return Object.values(map).sort((a,b) => b.points - a.points || a.pair.localeCompare(b.pair));
}



// V6.0: Target Mirror-Zero Bridge
// Blind spot baru: pada pola latest tanpa kembar dengan A+K menutup ke 0 dan anchor target punya twin,
// diagonal V5.9 terlalu membaca anchor twin + latest K sebagai 35/59. Jalur yang hilang adalah
// cermin A latest | zero A+K, lalu anchor twin | carry K. Contoh: latest 2816 + anchor Rabu 2559 → AK 70, LE 58.
function targetMirrorZeroBridgeContext(latest, targetAnchor, transitionProfile, marketProfile){
  const ld = latest?.digits || [];
  const ad = targetAnchor?.digits || [];
  if(ld.length < 4 || ad.length < 4) return null;
  const transitionSamples = Number(transitionProfile?.total || marketProfile?.total || 0);
  if(transitionSamples < 4) return null;
  const latestTwins = twinInfo(latest).twins || [];
  const anchorTwins = twinInfo(targetAnchor).twins || [];
  if(latestTwins.length || !anchorTwins.length) return null;
  const zeroGate = mod10(ld[0] + ld[1]);
  // Gerbang ini hanya aktif saat A+K latest menutup ke 0; ini menjaga kasus V5.8/V5.9 lama tidak ikut terkunci.
  if(zeroGate !== 0) return null;
  const anchorTwin = anchorTwins[0];
  const mirrorA = mod10(9 - ld[0]);
  const mirrorA10 = mod10(10 - ld[0]);
  const diffEdge = Math.abs(ad[0] - ad[3]) % 10;
  const carryK = ld[1];
  const carryE = ld[3];
  const hardCap = Number(marketProfile?.targetCarryHardCap || 4);
  const lowCarry = Number(marketProfile?.targetCarrySamples || marketProfile?.total || 0) >= 5 && hardCap <= 2;
  return {ld, ad, anchorTwin, mirrorA, mirrorA10, diffEdge, zeroGate, carryK, carryE, transitionSamples, lowCarry, hardCap};
}

function applyTargetMirrorZeroBridge(candidate, latest, targetAnchor, transitionProfile, marketProfile){
  candidate.targetMirrorZeroBridgeScore = Array(10).fill(0);
  candidate.targetMirrorZeroBridgeDigits = [];
  candidate.targetMirrorZeroBridgeAudit = null;
  const ctx = targetMirrorZeroBridgeContext(latest, targetAnchor, transitionProfile, marketProfile);
  if(!ctx) return;
  const {ld, ad, anchorTwin, mirrorA, mirrorA10, diffEdge, zeroGate, carryK, carryE, lowCarry, transitionSamples} = ctx;
  const add = (d, amount, note) => {
    d = Number(d);
    if(!Number.isInteger(d) || d < 0 || d > 9) return;
    candidate.targetMirrorZeroBridgeScore[d] += amount;
    addCandidateTrace(candidate, d, amount, note, 'targetMirrorZeroBridge');
  };
  const base = lowCarry ? 4360 : 3260;
  add(mirrorA, base + 1680, 'Target mirror-zero bridge: mirror9 latest A sebagai pembuka');
  add(zeroGate, base + 1580, 'Target mirror-zero bridge: A+K latest = 0');
  add(anchorTwin, base + 1320, 'Target mirror-zero bridge: anchor twin sebagai L/pivot');
  add(carryK, base + 1220, 'Target mirror-zero bridge: carry K latest sebagai ekor');
  // Support tetap matematis, tetapi tidak mengalahkan empat inti.
  if(diffEdge !== mirrorA) add(diffEdge, Math.round(base*0.62), 'Target mirror-zero support: diff edge anchor');
  if(mirrorA10 !== mirrorA) add(mirrorA10, Math.round(base*0.44), 'Target mirror-zero support: mirror10 latest A');
  add(carryE, Math.round(base*0.36), 'Target mirror-zero support: carry E latest');
  add(ad[0], Math.round(base*0.34), 'Target mirror-zero support: anchor A');
  add(ad[3], Math.round(base*0.30), 'Target mirror-zero support: anchor E');

  candidate.targetMirrorZeroBridgeDigits = uniqueDigits([mirrorA, zeroGate, anchorTwin, carryK])
    .sort((x,y) => (candidate.targetMirrorZeroBridgeScore[y] || 0) - (candidate.targetMirrorZeroBridgeScore[x] || 0));
  candidate.targetMirrorZeroBridgeAudit = {
    title:`Target mirror-zero bridge aktif: latest ${latest.day || '-'} ${ld.join('')} A+K=0 × anchor ${targetAnchor.day || '-'} ${ad.join('')}`,
    digits:candidate.targetMirrorZeroBridgeDigits.map(d => `${d}:${Math.round(candidate.targetMirrorZeroBridgeScore[d] || 0)}`).join(' | '),
    ak:`${mirrorA}${zeroGate}`,
    le:`${anchorTwin}${carryK}`,
    transitionSamples
  };
}

function forceTargetMirrorZeroBridgeRescue(selected, latest, candidate){
  if(!candidate.targetMirrorZeroBridgeDigits?.length) return;
  const score = candidate.targetMirrorZeroBridgeScore || Array(10).fill(0);
  const required = candidate.targetMirrorZeroBridgeDigits
    .filter(d => (score[d] || 0) >= 2400)
    .sort((a,b) => (score[b] || 0) - (score[a] || 0));
  if(required.length < 4) return;
  const minimum = 4;
  let present = required.filter(d => selected.includes(d)).length;
  if(present >= minimum) return;

  const protectedSet = new Set(required.filter(d => selected.includes(d)).map(Number));
  const traceWidth = d => new Set((candidate.digitTrace?.[d] || []).map(x => x.family)).size;
  const bridgePower = d => (score[d] || 0) + 0.12*(candidate.score?.[d] || 0) + 20*traceWidth(d);
  const victimScore = d => {
    let v = (candidate.score?.[d] || 0) + 9*traceWidth(d) - 1.55*(score[d] || 0);
    // Jika digit bukan inti mirror-zero dan hanya kuat dari replay lama, boleh dikorbankan dulu.
    if(!required.includes(Number(d))) v -= 0.20*((candidate.worldReplayScore || [])[d] || 0);
    return v;
  };
  for(const d of required.sort((a,b) => bridgePower(b)-bridgePower(a))){
    if(present >= minimum) break;
    if(selected.includes(d)) continue;
    const victim = selected.slice()
      .filter(x => !protectedSet.has(Number(x)))
      .sort((a,b) => victimScore(a) - victimScore(b) || (candidate.score[a] || 0) - (candidate.score[b] || 0))[0];
    if(victim == null) continue;
    selected[selected.indexOf(victim)] = d;
    protectedSet.add(Number(d));
    present += 1;
  }
}

function targetMirrorZeroBridgePairSeeds(latest, targetAnchor, candidate, kind){
  const ctx = targetMirrorZeroBridgeContext(latest, targetAnchor, candidate?.transitionProfile, candidate?.marketProfile);
  if(!ctx) return [];
  const {anchorTwin, mirrorA, mirrorA10, zeroGate, carryK, carryE, diffEdge, lowCarry} = ctx;
  const seeds = [];
  const add = (pair, bonus, label) => { if(/^\d{2}$/.test(pair)) seeds.push({pair, width:2, bonus, label}); };
  const base = lowCarry ? 92000 : 72000;
  if(kind === 'AK'){
    add(`${mirrorA}${zeroGate}`, base + 36000, 'AK target mirror-zero: mirror9 A + zero A+K');
    if(diffEdge !== mirrorA) add(`${diffEdge}${zeroGate}`, Math.round(base*0.72), 'AK target mirror-zero: diff edge anchor + zero A+K');
    add(`${mirrorA}${carryK}`, Math.round(base*0.58), 'AK target mirror-zero: mirror9 A + carry K');
    add(`${mirrorA10}${zeroGate}`, Math.round(base*0.46), 'AK target mirror-zero: mirror10 A + zero A+K');
  }else{
    add(`${anchorTwin}${carryK}`, base + 36000, 'LE target mirror-zero: anchor twin + carry K');
    add(`${anchorTwin}${carryE}`, Math.round(base*0.62), 'LE target mirror-zero: anchor twin + carry E');
    add(`${zeroGate}${carryK}`, Math.round(base*0.54), 'LE target mirror-zero: zero A+K + carry K');
    add(`${carryK}${anchorTwin}`, Math.round(base*0.48), 'LE target mirror-zero balik: carry K + anchor twin');
  }
  return seeds;
}

function applyTargetMirrorZeroBridgePairLock(ranked, kind, latest, targetAnchor, candidate){
  const seeds = targetMirrorZeroBridgePairSeeds(latest, targetAnchor, candidate, kind).slice(0,4);
  if(!seeds.length) return ranked;
  const map = {};
  ranked.forEach(x => map[x.pair] = {...x, notes:[...(x.notes || [])]});
  const ensure = (pair, points, note) => {
    if(!/^\d{2}$/.test(pair)) return;
    if(!map[pair]) map[pair] = {pair, points:0, notes:[]};
    map[pair].points = Math.max(map[pair].points, points);
    if(note && !map[pair].notes.includes(note)) map[pair].notes.unshift(note);
  };
  seeds.forEach((s,i) => ensure(s.pair, 252000 + (s.bonus || 0) - i*2400, 'target mirror-zero bridge lock'));
  return Object.values(map).sort((a,b) => b.points - a.points || a.pair.localeCompare(b.pair));
}

function buildTargetMirrorZeroBridgeAudit(audit){
  if(!audit) return null;
  return {title:audit.title, digits:audit.digits, ak:audit.ak, le:audit.le};
}

function buildTargetDiagonalBridgeAudit(audit){
  if(!audit) return null;
  return {title:audit.title, digits:audit.digits, ak:audit.ak, le:audit.le, altLE:audit.altLE};
}

function buildTargetEdgeBridgeAudit(audit){
  if(!audit) return null;
  return {title:audit.title, digits:audit.digits, ak:audit.ak, le:audit.le};
}


function boundaryTailMirrorDigits(latest){
  const a = latest?.digits || [];
  if(a.length < 4) return [];
  const e = a[3];
  const root = digitalRoot(sumDigits(latest));
  const out = [mod10(9-e), mod10(10-e), mod10(e-1), mod10(e+1)];
  // Jika ekor berada pada batas cincin 9/0, root sering menjadi kandidat kembar/ekor.
  if(e === 9 || e === 0) out.push(root, mod10(root+1), mod10(root-1));
  return uniqueDigits(out);
}

function applyBoundaryTailMirrorCluster(candidate, latest, targetAnchor, profile){
  candidate.boundaryTailScore = Array(10).fill(0);
  candidate.boundaryTailDigits = [];
  const a = latest?.digits || [];
  if(a.length < 4) return;
  const e = a[3];
  const root = digitalRoot(sumDigits(latest));
  const counts = countMap(a);
  const latestHasTwin = Object.values(counts).some(v => v >= 2);
  const isBoundaryTail = e === 9 || e === 0;
  if(!isBoundaryTail) return;

  const anchorDigits = uniqueDigits(targetAnchor?.digits || []);
  const anchorHasBoundary = anchorDigits.includes(0) || anchorDigits.includes(9);
  const profileBonus = profile && profile.total ? Math.round(120 * ((profile.positionCarryRate?.[3] || 0) + (profile.positionCarryRate?.[0] || 0))) : 0;
  const add = (d, amount, note) => {
    d = Number(d);
    if(!Number.isInteger(d) || d < 0 || d > 9) return;
    candidate.boundaryTailScore[d] += amount;
    addCandidateTrace(candidate, d, amount, note, 'boundaryTail');
  };

  const mirror9 = mod10(9-e);
  const mirror10 = mod10(10-e);
  const down = mod10(e-1);
  const up = mod10(e+1);
  candidate.boundaryTailDigits = uniqueDigits([mirror9, mirror10, down, up, root]);

  add(mirror10, 980 + profileBonus + (anchorHasBoundary ? 160 : 0), 'Boundary tail mirror10 lock');
  add(down, 920 + profileBonus + (!latestHasTwin ? 180 : 0), 'Boundary tail neighbor-down lock');
  add(root, 1080 + profileBonus + (!latestHasTwin ? 260 : 0), 'Boundary tail root twin seed');
  add(mirror9, 680 + (anchorHasBoundary ? 120 : 0), 'Boundary tail mirror9 lock');
  add(up, 420, 'Boundary tail neighbor-up support');
}

function forceBoundaryTailMirrorRescue(selected, latest, candidate){
  const a = latest?.digits || [];
  if(a.length < 4 || !candidate.boundaryTailDigits?.length) return;
  const e = a[3];
  if(e !== 9 && e !== 0) return;
  const root = digitalRoot(sumDigits(latest));
  const priority = uniqueDigits([mod10(10-e), mod10(e-1), root, mod10(9-e), mod10(e+1)]);
  // Jangan hitung digit ekor asli sebagai rescue; yang dicari adalah pantulan 9/10 dan root.
  const must = priority.filter(d => d !== e).slice(0,3);
  const present = must.filter(d => selected.includes(d)).length;
  const need = Math.max(0, 2 - present);
  if(!need) return;

  const protectedSet = new Set();
  // Jaga dua skor utama umum dan carry transisi supaya rescue tidak menghapus struktur utama.
  DIGITS.slice().sort((x,y) => candidate.score[y]-candidate.score[x]).slice(0,2).forEach(d => { if(selected.includes(d)) protectedSet.add(Number(d)); });
  (candidate.transitionProfile?.positionCarryRate || []).forEach((rate,idx) => {
    if(rate >= 0.40 && selected.includes(a[idx])) protectedSet.add(Number(a[idx]));
  });
  const addOne = d => {
    if(selected.includes(d)) return;
    replaceWeakestForRescue(selected, d, candidate, protectedSet);
    protectedSet.add(Number(d));
  };
  must.filter(d => !selected.includes(d)).slice(0, need).forEach(addOne);
}

function buildTwinLabScores(candidate, finalDigits, latest){
  const a = latest?.digits || [];
  const score = Array(10).fill(0);
  const reasons = Array.from({length:10}, () => []);
  const add = (d, amount, reason) => {
    d = Number(d);
    if(!Number.isInteger(d) || d < 0 || d > 9) return;
    score[d] += amount;
    if(reason && reasons[d].length < 6) reasons[d].push(reason);
  };
  DIGITS.forEach(d => {
    const families = new Set((candidate.digitTrace?.[d] || []).map(x => x.family));
    add(d, 0.16*(candidate.score?.[d] || 0), 'skor formula dasar');
    add(d, 16*families.size, 'lebar keluarga rumus');
    add(d, 0.38*((candidate.targetAnchorScore || [])[d] || 0), 'jangkar hari target');
    add(d, 0.52*((candidate.boundaryTailScore || [])[d] || 0), 'boundary-tail lab');
    add(d, 0.44*((candidate.marketMemoryScore || [])[d] || 0), 'market adaptive digit memory');
    add(d, 0.32*((candidate.marketProfile?.twinScore || [])[d] || 0), 'market adaptive twin cycle');
    add(d, 0.58*((candidate.centerBridgeScore || [])[d] || 0), 'center bridge formula');
    add(d, 0.34*((candidate.centerBridgeTwinScore || [])[d] || 0), 'center bridge twin seed');
    add(d, 0.62*((candidate.targetBoundaryRootTwinBridgeScore || [])[d] || 0), 'target boundary root-twin bridge');
    add(d, 0.70*((candidate.targetBoundaryRootTwinBridgeTwinScore || [])[d] || 0), 'target boundary root-twin twin seed');
    add(d, 0.48*((candidate.targetAnchorSumLockBridgeScore || [])[d] || 0), 'target anchor sum-lock bridge');
    add(d, 0.24*((candidate.marketProfile?.twinAfterNoTwinScore || [])[d] || 0), 'market twin-after-non-twin memory');
    if((finalDigits || []).includes(d)) add(d, 360, 'masuk 6 digit formula');
  });
  if(a.length >= 4){
    const counts = countMap(a);
    const twins = Object.keys(counts).map(Number).filter(d => counts[d] >= 2);
    const root = digitalRoot(sumDigits(latest));
    const seedLE = mod10(a[2]+a[3]);
    const e = a[3];
    if(twins.length){
      const singles = a.filter(d => !twins.includes(d));
      const cooldown = !!candidate.twinCooldown?.active;
      const repeatRate = candidate.twinCycleProfile?.marketSameTwinRepeatRate || 0;
      twins.forEach(t => {
        add(t, cooldown ? -620 : Math.round(180 + 360*repeatRate), cooldown ? 'cooldown: kembar sama jarang berulang' : 'carry digit kembar latest');
        add(mod10(t+t), cooldown ? 620 : 300, 'pecah kembar t+t');
        add(0, cooldown ? 80 : 180, 'pecah kembar t-t');
      });
      (candidate.postTwinSpreadDigits || []).slice(0,5).forEach((d,i) => {
        add(d, Math.max(140, 540 - i*80), 'post-twin adaptive spread');
      });
      singles.forEach(s => {
        add(mod10(10-s), 220, 'cermin10 digit tunggal setelah kembar');
        add(mod10(9-s), 170, 'cermin9 digit tunggal setelah kembar');
      });
    }else{
      add(seedLE, 220, 'L+E non-kembar');
      (candidate.centerBridgeTwinDigits || []).forEach((d,i) => add(d, Math.max(120, 390 - i*90), 'center bridge twin priority'));
      // V5.6: center bridge tidak boleh mengunci kandidat kembar sendirian.
      // Ia hanya menjadi pendukung, sedangkan gate kembar ditentukan oleh pola transisi dan operasi aktif.
      add(root, 520, 'root total non-kembar');
      add(mod10(9-root), 210, 'cermin root non-kembar');
      const ae = mod10(a[0] + a[3]);
      const rate = idx => candidate.transitionProfile?.positionCarryRate?.[idx] || 0;
      if(ae === 0){
        // V5.2: zero bridge bukan berarti twin 00. Pembentuk 0, terutama A yang punya carry,
        // dinaikkan sebagai kandidat kembar adaptif.
        add(a[0], 1280 + Math.round(1200*rate(0)), 'A/E complement twin seed');
        add(a[3], 320 + Math.round(460*rate(3)), 'E complement support');
        add(0, 180, 'zero bridge digit support');
        add(mod10(a[0]+a[2]), 260, 'A+L complement support');
      }
      if(rate(0) >= 0.25) add(a[0], 360 + Math.round(520*rate(0)), 'carry A twin history');
      if(rate(1) >= 0.45) add(a[1], 260 + Math.round(420*rate(1)), 'carry K twin history');
      if(e === 9 || e === 0){
        add(root, 720, 'root twin setelah ekor boundary 9/0');
        add(mod10(e-1), 560, 'neighbor turun ekor boundary');
        add(mod10(10-e), 520, 'mirror10 ekor boundary');
        add(mod10(9-e), 360, 'mirror9 ekor boundary');
      }
    }
  }
  const ranked = DIGITS.map(d => ({digit:d, points:score[d], reasons:reasons[d]})).sort((x,y) => y.points - x.points || x.digit-y.digit);
  return ranked;
}

function buildTwinLabAudit(twinAudit){
  if(!twinAudit || !twinAudit.ranked) return null;
  return {
    title: `Twin Lab memilih ${twinAudit.chosen}${twinAudit.chosen}${twinAudit.cooldown?.active ? ' (cooldown aktif)' : ''}`,
    ranked: twinAudit.ranked.slice(0,5).map(x => `${x.digit}${x.digit}: ${Math.round(x.points)} poin (${x.reasons.slice(0,3).join(', ') || '-'})`),
    decision: twinAudit.decision || ''
  };
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


function forceAKLEMiddleRescue(selected, akle, candidate){
  if(!akle) return;
  const middleScore = Array(10).fill(0);
  const addMiddle = (digit, amount) => {
    digit = Number(digit);
    if(Number.isInteger(digit) && digit >= 0 && digit <= 9) middleScore[digit] += amount;
  };
  (akle.ak || []).slice(0,3).forEach((x,i) => {
    // AK = A K, maka digit kedua adalah K.
    addMiddle(x.pair[1], Math.max(1, 80 - i*18) + 0.012*(x.points || 0));
  });
  (akle.le || []).slice(0,3).forEach((x,i) => {
    // LE = L E, maka digit pertama adalah L.
    addMiddle(x.pair[0], Math.max(1, 92 - i*16) + 0.012*(x.points || 0));
  });
  const middleCandidates = DIGITS.slice()
    .filter(d => middleScore[d] > 0 && !selected.includes(d))
    .sort((a,b) => middleScore[b] - middleScore[a] || candidate.score[b] - candidate.score[a]);
  if(!middleCandidates.length) return;

  // Pilih satu digit tengah yang belum masuk. Ini menjaga kasus 8172 agar digit L=7 tidak hilang.
  const protect = new Set();
  (akle.ak || []).slice(0,2).forEach(x => protect.add(Number(x.pair[1])));
  (akle.le || []).slice(0,2).forEach(x => protect.add(Number(x.pair[0])));
  const rescue = middleCandidates[0];
  const traceWidth = d => new Set((candidate.digitTrace[d] || []).map(x => x.family)).size;
  const victim = selected.slice()
    .filter(d => !protect.has(d))
    .sort((a,b) => (candidate.score[a] + 10*traceWidth(a)) - (candidate.score[b] + 10*traceWidth(b)))[0];
  if(victim == null) return;
  selected[selected.indexOf(victim)] = rescue;
}

function chooseTwinDigit(candidate, finalDigits, latest){
  const ranked = buildTwinLabScores(candidate, finalDigits, latest);
  const a = latest?.digits || [];
  const allowed = uniqueDigits(finalDigits);
  const counts = countMap(a);
  const twins = Object.keys(counts).map(Number).filter(d => counts[d] >= 2);
  const root = digitalRoot(sumDigits(latest));
  const profile = candidate.twinCycleProfile || {};
  const market = candidate.marketProfile || {};
  const rankMap = {};
  ranked.forEach((x,i) => rankMap[x.digit] = {...x, rank:i});
  const score = Array(10).fill(0);
  const reason = Array.from({length:10}, () => []);
  const add = (d, amount, why) => {
    d = Number(d);
    if(!Number.isInteger(d) || d < 0 || d > 9 || !Number.isFinite(amount)) return;
    score[d] += amount;
    if(why && reason[d].length < 6) reason[d].push(why);
  };
  DIGITS.forEach(d => {
    add(d, 0.22*(rankMap[d]?.points || 0), 'twin lab score seimbang');
    if(allowed.includes(d)) add(d, 180, 'masuk 6 digit formula');
  });
  const targetTwinDigits = Object.entries(profile.nextTwinDigits || {})
    .map(([d,c]) => ({d:Number(d), c:Number(c)}))
    .sort((x,y) => y.c - x.c || x.d - y.d);
  targetTwinDigits.forEach((x,i) => add(x.d, 660 + 240*x.c - 90*i, 'riwayat twin transisi hari'));
  DIGITS.slice().sort((x,y) => ((market.twinScore || [])[y] || 0)-((market.twinScore || [])[x] || 0)).slice(0,3)
    .forEach((d,i) => add(d, 140 - 35*i, 'market twin memory ringan'));
  DIGITS.forEach(d => {
    const replayTwin = candidate.replayProfile?.twinScore?.[d] || 0;
    if(replayTwin > 0) add(d, Math.round(0.68*replayTwin), 'world formula replay twin');
    const boundaryTwin = (candidate.targetBoundaryRootTwinBridgeTwinScore || [])[d] || 0;
    if(boundaryTwin > 0) add(d, Math.round(1.05*boundaryTwin), 'target boundary root-twin priority');
  });
  const diagTwin = twinDiagnosticScores(latest, candidate);
  DIGITS.forEach(d => { if(diagTwin[d]) add(d, diagTwin[d], 'diagnostic twin gate'); });

  if(a.length >= 4){
    const ae = mod10(a[0] + a[3]);
    const kl = mod10(a[1] + a[2]);
    const ke = mod10(a[1] + a[3]);
    const le = mod10(a[2] + a[3]);
    const ak = mod10(a[0] + a[1]);
    const e = a[3];
    add(root, 410, 'root total');
    add(le, 250, 'L+E');
    add(kl, 250, 'K+L');
    add(ke, 220, 'K+E');
    add(ae, 180, 'A+E');
    add(ak, 150, 'A+K');

    if(!twins.length && ae === 0){
      add(a[0], 1500 + Math.round(820*(candidate.transitionProfile?.positionCarryRate?.[0] || 0)), 'A/E complement twin seed utama');
      add(0, 120, 'zero bridge support, bukan otomatis 00');
      add(a[3], 180, 'E complement support');
    }
    if(!twins.length && (e === 9 || e === 0)){
      add(root, 760, 'root setelah ekor boundary');
      add(mod10(e-1), 520, 'neighbor turun ekor boundary');
      add(mod10(10-e), 440, 'mirror10 ekor boundary');
      add(mod10(9-e), 320, 'mirror9 ekor boundary');
    }
    (candidate.centerBridgeTwinDigits || []).slice(0,2).forEach((d,i) => add(d, 160 - 50*i, 'center bridge hanya pendukung twin'));

    if(twins.length){
      const cooldown = !!candidate.twinCooldown?.active || (profile.marketSameTwinRepeatRate || 0) <= 0.12;
      const singles = a.filter(d => !twins.includes(d));
      const singleSum = singles.length >= 2 ? mod10(singles.reduce((s,d) => s+d, 0)) : null;
      twins.forEach(t => {
        add(mod10(t+t), cooldown ? 780 : 360, 'pecah twin t+t');
        add(0, cooldown ? 220 : 150, 'twin t-t');
        add(t, cooldown ? -2200 : 240, cooldown ? 'cooldown: kembar sama direm' : 'carry twin boleh');
      });
      if(singleSum != null) add(singleSum, 430, 'jumlah digit tunggal setelah twin');
      (candidate.postTwinSpreadDigits || []).slice(0,4).forEach((d,i) => add(d, 390 - i*70, 'post-twin spread'));
    }
  }

  // V6.1: kandidat kembar wajib berasal dari 6 digit formula terpilih.
  // Twin lab tetap menghitung semua digit untuk audit, tetapi keputusan final hanya boleh mengambil allowed.
  let chosen = null;
  const sorted = DIGITS.map(d => ({digit:d, points:score[d], reasons:reason[d]})).sort((x,y) => y.points-x.points || x.digit-y.digit);
  const sortedAllowed = sorted.filter(x => allowed.includes(x.digit));
  const boundaryRootTwin = candidate.targetBoundaryRootTwinBridgeTwinDigit;
  if(boundaryRootTwin != null && allowed.includes(boundaryRootTwin) && ((candidate.targetBoundaryRootTwinBridgeTwinScore || [])[boundaryRootTwin] || 0) >= 2600){
    chosen = boundaryRootTwin;
  }
  const replayTwinTop = DIGITS
    .filter(d => allowed.includes(d))
    .map(d => ({digit:d, points:candidate.replayProfile?.twinScore?.[d] || 0}))
    .sort((x,y) => y.points-x.points || x.digit-y.digit)[0];
  if(chosen == null && replayTwinTop && replayTwinTop.points >= 520 && (!twins.length || !twins.includes(replayTwinTop.digit))){
    chosen = replayTwinTop.digit;
  }
  if(chosen == null && a.length >= 4 && !twins.length){
    const ae = mod10(a[0] + a[3]);
    if(ae === 0 && allowed.includes(a[0])){
      chosen = a[0];
    }else if(allowed.includes(root) && targetTwinDigits.some(x => x.d === root)){
      // Jika root pernah menjadi kandidat transisi, pakai root untuk memecah dominasi marketTop yang berulang.
      chosen = root;
    }
  }
  if(chosen == null && twins.length){
    const cooldown = !!candidate.twinCooldown?.active || (profile.marketSameTwinRepeatRate || 0) <= 0.12;
    if(cooldown){
      chosen = sortedAllowed.find(x => !twins.includes(x.digit) && x.points >= (sortedAllowed[0]?.points || 0)*0.48)?.digit;
    }
  }
  if(chosen == null) chosen = sortedAllowed[0]?.digit ?? allowed[0] ?? sorted[0]?.digit ?? 0;
  if(!allowed.includes(chosen)) chosen = sortedAllowed[0]?.digit ?? allowed[0] ?? chosen;
  candidate.twinAudit = {
    chosen,
    ranked: sorted.map(x => ({digit:x.digit, points:x.points, reasons:x.reasons})),
    cooldown:candidate.twinCooldown,
    decision:'V6.3 twin gate: operasi aktif + boundary root-twin; hasil kembar wajib dari 6 digit formula'
  };
  return chosen;
}


function buildAKLEPrediction(rows, candidate, formulas, targetAnchor){
  const latest = rows[0];
  const chrono = rows.slice().reverse();
  const learnedAK = learnOrderedPairWeights(chrono, formulas, 'AK');
  const learnedLE = learnOrderedPairWeights(chrono, formulas, 'LE');
  const ak = chooseOrderedPairs(rows, candidate, formulas, targetAnchor, learnedAK, 'AK');
  const le = chooseOrderedPairs(rows, candidate, formulas, targetAnchor, learnedLE, 'LE');
  return {ak, le};
}

function learnOrderedPairWeights(chrono, formulas, kind){
  const table = {};
  const add = (pair, amount, note) => {
    if(!/^\d{2}$/.test(pair)) return;
    if(!table[pair]) table[pair] = {pair, points:0, notes:[]};
    table[pair].points += amount;
    if(note && table[pair].notes.length < 4) table[pair].notes.push(note);
  };
  let carryOverlapTotal = 0;
  let carryOverlapMax = 0;
  for(let i=0;i<chrono.length-1;i++){
    const prev = chrono[i];
    const next = chrono[i+1];
    const actual = kind === 'AK' ? `${next.digits[0]}${next.digits[1]}` : `${next.digits[2]}${next.digits[3]}`;
    orderedPairSeeds(prev, formulas, kind).forEach(seed => {
      if(seed.pair === actual) add(seed.pair, 48 + Math.max(0, 9 - seed.width), `Pernah tembus ${prev.digits.join('')}→${next.digits.join('')}`);
      else if(seed.pair[0] === actual[0] || seed.pair[1] === actual[1]) add(seed.pair, 4, 'Satu posisi pernah dekat');
    });
  }
  return table;
}

function chooseOrderedPairs(rows, candidate, formulas, targetAnchor, learned, kind){
  const latest = rows[0];
  const seeds = [];
  const pushSeeds = (arr, bonus, label) => {
    arr.forEach(x => seeds.push({...x, bonus:(x.bonus || 0) + bonus, label:`${label}: ${x.label || ''}`}));
  };
  pushSeeds(orderedPairSeeds(latest, formulas, kind), 50, 'latest');
  if(targetAnchor) pushSeeds(orderedPairSeeds(targetAnchor, formulas, kind), 42, 'anchor hari target');
  pushSeeds(transitionCarryPairSeeds(latest, candidate, kind), 0, 'transition carry lock');
  pushSeeds(postTwinSpreadPairSeeds(latest, candidate, targetAnchor, kind), 0, 'post-twin spread lock');
  pushSeeds(marketAdaptivePairSeeds(latest, candidate, kind), 0, 'market adaptive memory');
  pushSeeds(akleFlowPairSeeds(latest, candidate, kind), 0, 'AKLE flow gate');
  pushSeeds(diagnosticAKLEPairSeeds(latest, candidate, kind), 0, 'diagnostic AKLE gate');
  pushSeeds(centerBridgePairSeeds(latest, candidate, kind), 0, 'center bridge formula');
  pushSeeds(targetEdgeBridgePairSeeds(latest, targetAnchor, candidate, kind), 0, 'target edge bridge');
  pushSeeds(targetDiagonalBridgePairSeeds(latest, targetAnchor, candidate, kind), 0, 'target diagonal bridge');
  pushSeeds(targetMirrorZeroBridgePairSeeds(latest, targetAnchor, candidate, kind), 0, 'target mirror-zero bridge');
  pushSeeds(targetTwinSingleBridgePairSeeds(latest, targetAnchor, candidate, kind), 0, 'target twin-single bridge');
  pushSeeds(targetAnchorRotationBridgePairSeeds(latest, targetAnchor, candidate, kind), 0, 'target anchor-rotation bridge');
  pushSeeds(targetBoundaryRootTwinBridgePairSeeds(latest, targetAnchor, candidate, kind), 0, 'target boundary root-twin bridge');
  pushSeeds(targetAnchorSumLockBridgePairSeeds(latest, targetAnchor, candidate, kind), 0, 'target anchor sum-lock bridge');
  pushSeeds(worldReplayPairSeeds(latest, candidate, kind), 0, 'world formula replay');

  // V4.6: anchor K/E dan LE cermin-zero ditambahkan agar digit tengah tidak hilang.
  if(targetAnchor && (targetAnchor.digits || []).length >= 4){
    const ad = targetAnchor.digits;
    if(kind === 'AK'){
      seeds.push({pair:`${ad[1]}${ad[3]}`, width:2, bonus:6500, label:'AK anchor K-E'});
      seeds.push({pair:`${ad[0]}${ad[3]}`, width:2, bonus:2600, label:'AK anchor A-E'});
    }else{
      seeds.push({pair:`${ad[3]}${ad[0]}`, width:2, bonus:2400, label:'LE anchor E-A'});
      seeds.push({pair:`${ad[3]}${ad[1]}`, width:2, bonus:2200, label:'LE anchor E-K'});
    }
  }


  // V4.8: Position Lock AK/LE.
  // AK adalah pintu masuk: A-K. LE adalah pintu keluar: L-E.
  // Jika anchor hari target punya zero-twin, pola sering bergeser dari carry depan + K anchor,
  // sedangkan LE sering terbuka dari A anchor + cermin A anchor.
  if(targetAnchor && (targetAnchor.digits || []).length >= 4 && (latest.digits || []).length >= 4){
    const ad = targetAnchor.digits;
    const ld = latest.digits;
    const anchorCounts = countMap(ad);
    const latestInfo = twinInfo(latest);
    const anchorHasZeroTwin = (anchorCounts[0] || 0) >= 2;
    if(anchorHasZeroTwin){
      if(kind === 'AK'){
        // Contoh WSV: latest 7550 + anchor Minggu 3100 → pintu masuk 7|1 = 71.
        seeds.push({pair:`${ld[0]}${ad[1]}`, width:2, bonus:9300, label:'AK position lock: latest A + anchor K'});
        seeds.push({pair:`${ld[0]}${digitalRoot(sumDigits(targetAnchor))}`, width:2, bonus:4100, label:'AK position lock: latest A + root anchor'});
      }else{
        // Contoh WSV: anchor A=3 membuka cermin 9 → 6, maka LE = 36.
        seeds.push({pair:`${ad[0]}${mod10(9-ad[0])}`, width:2, bonus:9900, label:'LE position lock: anchor A + mirror9'});
        seeds.push({pair:`${mod10(10-ld[0])}${mod10(ld[0]-1)}`, width:2, bonus:8600, label:'LE position lock: mirror10 latest A + neighbor turun'});
        if(latestInfo.singles.length){
          latestInfo.singles.forEach(s => {
            seeds.push({pair:`${mod10(10-s)}${mod10(s-1)}`, width:2, bonus:4200, label:'LE position lock: single mirror-neighbor'});
          });
        }
      }
    }
  }

  // V4.5: AK dan LE dipisah jalurnya.
  // AK mengutamakan pintu depan, sedangkan LE mengutamakan pintu belakang/KL.
  const info = twinInfo(latest);
  if(info.twins.length){
    const split = twinSplitDigits(latest);
    const mirror = twinMirrorSingleDigits(latest);
    const gate = singlePairGateDigits(latest);
    if(kind === 'AK'){
      if(mirror.length >= 4) seeds.push({pair:`${mirror[0]}${mirror[3]}`, width:2, bonus:5600, label:'AK mirror depan'});
      if(mirror.length && split.length) seeds.push({pair:`${mirror[0]}${split[0]}`, width:2, bonus:4300, label:'AK mirror-split'});
      if(gate.length >= 2) seeds.push({pair:`${gate[0]}${gate[1]}`, width:2, bonus:3200, label:'AK gerbang depan'});
    }else{
      if(mirror.length >= 2 && split.length) seeds.push({pair:`${mirror[1]}${split[0]}`, width:2, bonus:6200, label:'LE mirror-split belakang'});
      if(gate.length && split.length) seeds.push({pair:`${gate[0]}${split[0]}`, width:2, bonus:4300, label:'LE gerbang-split'});
      if(split.length >= 2) seeds.push({pair:`${split[0]}${split[1]}`, width:2, bonus:3800, label:'LE pecah kembar'});
      if(info.singles.length && split.includes(0)) seeds.push({pair:`${mod10(9-info.singles[0])}0`, width:2, bonus:4700, label:'LE cermin single + zero kembar'});
      if(mirror.length >= 4) seeds.push({pair:`${mirror[3]}${mirror[1]}`, width:2, bonus:2600, label:'LE cermin balik'});
    }
  }

  // Gabung digit formula tinggi menjadi pasangan berurutan, bukan dibalik.
  const topDigits = DIGITS.slice().sort((a,b) => candidate.score[b] - candidate.score[a]).slice(0,7);
  for(let i=0;i<topDigits.length;i++){
    for(let j=0;j<topDigits.length;j++){
      if(i === j) continue;
      seeds.push({pair:`${topDigits[i]}${topDigits[j]}`, width:2, bonus:Math.max(8, 38 - 3*i - 2*j), label:'kombinasi digit formula'});
    }
  }

  const scored = {};
  const add = (pair, amount, label) => {
    if(!/^\d{2}$/.test(pair)) return;
    if(!scored[pair]) scored[pair] = {pair, points:0, notes:[]};
    scored[pair].points += amount;
    if(label && scored[pair].notes.length < 3) scored[pair].notes.push(label);
  };

  seeds.forEach(seed => {
    const a = Number(seed.pair[0]), b = Number(seed.pair[1]);
    const learnedPoints = learned[seed.pair]?.points || 0;
    const digitPower = 0.16*(candidate.score[a] || 0) + 0.16*(candidate.score[b] || 0);
    const anchorPower = 0.36*((candidate.targetAnchorScore || [])[a] || 0) + 0.36*((candidate.targetAnchorScore || [])[b] || 0);
    const orderPower = kind === 'AK' ? (seed.label.includes('anchor') ? 18 : 10) : (seed.label.includes('kembar') ? 18 : 10);
    add(seed.pair, seed.bonus + learnedPoints + digitPower + anchorPower + orderPower - Math.max(0, seed.width - 3)*3, seed.label);
  });

  const ranked = Object.values(scored)
    .sort((a,b) => b.points - a.points || a.pair.localeCompare(b.pair));
  const positionLocked = applyAKLEPositionLock(ranked, kind, latest, targetAnchor, candidate);
  return applyTargetAnchorSumLockBridgePairLock(applyTargetBoundaryRootTwinBridgePairLock(applyTargetAnchorRotationBridgePairLock(applyTargetTwinSingleBridgePairLock(applyTargetMirrorZeroBridgePairLock(applyTargetDiagonalBridgePairLock(applyDiagnosticAKLEPairLock(applyTargetEdgeBridgePairLock(applyWorldReplayPairLock(applyCenterBridgePairLock(applyAKLETransitionLock(positionLocked, kind, latest, candidate), kind, latest, candidate), kind, latest, candidate), kind, latest, targetAnchor, candidate), kind, latest, candidate), kind, latest, targetAnchor, candidate), kind, latest, targetAnchor, candidate), kind, latest, targetAnchor, candidate), kind, latest, targetAnchor, candidate), kind, latest, targetAnchor, candidate), kind, latest, targetAnchor, candidate).slice(0,5);
}


function transitionCarryPairSeeds(latest, candidate, kind){
  const profile = candidate.transitionProfile;
  const a = latest?.digits || [];
  if(!profile || profile.total < 4 || a.length < 4) return [];
  const rate = idx => profile.positionCarryRate[idx] || 0;
  const seeds = [];
  const add = (pair, bonus, label) => { if(/^\d{2}$/.test(pair)) seeds.push({pair, width:2, bonus, label}); };

  if(kind === 'AK'){
    const e = a[3];
    if(e === 9 || e === 0){
      add(`${mod10(9-e)}${mod10(10-e)}`, 17600, 'AK boundary-tail mirror9/10');
      add(`${mod10(10-e)}${mod10(e-1)}`, 9400, 'AK boundary-tail mirror10/down');
    }
    // Jika K latest sering carry pada transisi jadwal ini, A dicari dari pembuka rumus terkuat:
    // mirror A, jumlah K+L, dan root. Ini menutup kasus 3428 → 6428: K=4 dijaga, A=6 dibuka oleh 9-3 dan 4+2.
    if(rate(1) >= 0.34){
      const k = a[1];
      add(`${mod10(9-a[0])}${k}`, 12600 + Math.round(1200*rate(1)), 'AK transition: mirror A + carry K');
      add(`${mod10(a[1]+a[2])}${k}`, 12400 + Math.round(1200*rate(1)), 'AK transition: K+L + carry K');
      add(`${digitalRoot(sumDigits(latest))}${k}`, 5200 + Math.round(700*rate(1)), 'AK transition: root + carry K');
    }
    if(rate(0) >= 0.34 && rate(1) >= 0.34){
      add(`${a[0]}${a[1]}`, 7600 + Math.round(900*(rate(0)+rate(1))), 'AK transition: carry A-K');
    }
    if(mod10(a[0] + a[3]) === 0){
      add(`${a[1]}${a[0]}`, 19600 + Math.round(1400*(rate(0)+rate(1))), 'AK complement bridge: carry K + carry A');
      add(`${mod10(a[0]+a[2])}${a[0]}`, 18400 + Math.round(900*rate(0)), 'AK complement bridge: A+L + carry A');
      add(`${mod10(a[0]+a[3])}${a[0]}`, 6200, 'AK complement bridge: zero + carry A');
    }
  }else{
    const e = a[3];
    if(e === 9 || e === 0){
      const root = digitalRoot(sumDigits(latest));
      add(`${root}${root}`, 18800, 'LE root-twin boundary-tail');
      add(`${mod10(e-1)}${mod10(e-1)}`, 11800, 'LE neighbor-down twin boundary-tail');
      add(`${mod10(10-e)}${mod10(e-1)}`, 7600, 'LE mirror10/down boundary-tail');
    }
    // Jika L dan E latest punya riwayat carry, pair LE asli wajib naik ke kandidat utama.
    // Ini menutup kasus 3428 → 6428: L=2 dan E=8 tidak boleh kalah oleh anchor/pair generik.
    if(rate(2) >= 0.25 && rate(3) >= 0.34){
      add(`${a[2]}${a[3]}`, 13800 + Math.round(1200*(rate(2)+rate(3))), 'LE transition: carry L-E');
    }
    if(rate(3) >= 0.40){
      add(`${mod10(a[1]+a[2])}${a[3]}`, 8200 + Math.round(900*rate(3)), 'LE transition: K+L + carry E');
      add(`${mod10(10-a[0])}${a[3]}`, 6200 + Math.round(700*rate(3)), 'LE transition: mirror10 A + carry E');
    }
    if(mod10(a[0] + a[3]) === 0){
      add(`${mod10(a[0]+a[3])}${a[0]}`, 19800 + Math.round(1200*rate(0)), 'LE complement bridge: A+E zero + carry A');
      add(`${mod10(a[0]+a[3])}${a[1]}`, 7200 + Math.round(600*rate(1)), 'LE complement bridge: A+E zero + carry K');
      add(`${mod10(a[0]+a[2])}${a[0]}`, 6600 + Math.round(500*rate(0)), 'LE complement bridge: A+L + carry A');
    }
  }
  return seeds;
}

function applyAKLETransitionLock(ranked, kind, latest, candidate){
  const profile = candidate.transitionProfile;
  const a = latest?.digits || [];
  if(!profile || profile.total < 4 || a.length < 4) return ranked;
  const rate = idx => profile.positionCarryRate[idx] || 0;
  const map = {};
  ranked.forEach(x => map[x.pair] = {...x, notes:[...(x.notes || [])]});
  const ensure = (pair, points, note) => {
    if(!/^\d{2}$/.test(pair)) return;
    if(!map[pair]) map[pair] = {pair, points:0, notes:[]};
    map[pair].points = Math.max(map[pair].points, points);
    if(note && !map[pair].notes.includes(note)) map[pair].notes.unshift(note);
  };

  if(kind === 'AK' && (a[3] === 9 || a[3] === 0)){
    const e = a[3];
    ensure(`${mod10(9-e)}${mod10(10-e)}`, 18200, 'AK boundary-tail lock');
  }
  if(kind === 'AK' && rate(1) >= 0.34){
    const k = a[1];
    ensure(`${mod10(9-a[0])}${k}`, 15100 + 700*rate(1), 'AK transition lock');
    ensure(`${mod10(a[1]+a[2])}${k}`, 14900 + 700*rate(1), 'AK transition lock');
  }
  if(kind === 'AK' && mod10(a[0] + a[3]) === 0){
    ensure(`${a[1]}${a[0]}`, 21400 + 900*(rate(0)+rate(1)), 'AK complement bridge lock');
    ensure(`${mod10(a[0]+a[2])}${a[0]}`, 20200 + 700*rate(0), 'AK complement bridge lock');
  }
  if(kind === 'LE' && (a[3] === 9 || a[3] === 0)){
    const root = digitalRoot(sumDigits(latest));
    ensure(`${root}${root}`, 19400, 'LE root-twin boundary lock');
    ensure(`${mod10(a[3]-1)}${mod10(a[3]-1)}`, 12900, 'LE neighbor-down twin boundary lock');
  }
  if(kind === 'LE' && rate(2) >= 0.25 && rate(3) >= 0.34){
    ensure(`${a[2]}${a[3]}`, 15600 + 700*(rate(2)+rate(3)), 'LE transition lock');
  }
  if(kind === 'LE' && mod10(a[0] + a[3]) === 0){
    ensure(`${mod10(a[0]+a[3])}${a[0]}`, 21600 + 900*rate(0), 'LE complement bridge lock');
    ensure(`${mod10(a[0]+a[3])}${a[1]}`, 9600 + 600*rate(1), 'LE complement bridge lock');
  }
  return Object.values(map).sort((x,y) => y.points - x.points || x.pair.localeCompare(y.pair));
}


function applyCenterBridgePairLock(ranked, kind, latest, candidate){
  const a = latest?.digits || [];
  const profile = candidate?.marketProfile;
  if(a.length < 4 || !profile) return ranked;
  const lowCarry = Number(profile.targetCarrySamples || profile.total || 0) >= 5 && Number(profile.targetCarryHardCap || 4) <= 2;
  if(!lowCarry) return ranked;
  const kl = mod10(a[1]+a[2]);
  const ke = mod10(a[1]+a[3]);
  const ak = mod10(a[0]+a[1]);
  const map = {};
  ranked.forEach(x => map[x.pair] = {...x, notes:[...(x.notes || [])]});
  const ensure = (pair, points, note) => {
    if(!/^\d{2}$/.test(pair)) return;
    if(!map[pair]) map[pair] = {pair, points:0, notes:[]};
    map[pair].points = Math.max(map[pair].points, points);
    if(note && !map[pair].notes.includes(note)) map[pair].notes.unshift(note);
  };
  if(kind === 'AK'){
    ensure(`${kl}${a[1]}`, 17400 + 0.04*((candidate.centerBridgeScore || [])[kl] || 0), 'AK center bridge lock');
    ensure(`${kl}${ak}`, 10800 + 0.03*((candidate.centerBridgeScore || [])[ak] || 0), 'AK center bridge lock');
  }else{
    ensure(`${kl}${ke}`, 42800 + 0.04*((candidate.centerBridgeScore || [])[kl] || 0) + 0.04*((candidate.centerBridgeScore || [])[ke] || 0), 'LE center bridge lock');
    ensure(`${kl}${a[3]}`, 9200 + 0.03*((candidate.centerBridgeScore || [])[kl] || 0), 'LE center bridge lock');
  }
  return Object.values(map).sort((x,y) => y.points - x.points || x.pair.localeCompare(y.pair));
}

function applyAKLEPositionLock(ranked, kind, latest, targetAnchor, candidate){
  if(!targetAnchor || !(targetAnchor.digits || []).length || !(latest.digits || []).length) return ranked;
  const ad = targetAnchor.digits;
  const ld = latest.digits;
  const anchorCounts = countMap(ad);
  const anchorHasZeroTwin = (anchorCounts[0] || 0) >= 2;
  if(!anchorHasZeroTwin) return ranked;

  const map = {};
  ranked.forEach(x => map[x.pair] = {...x, notes:[...(x.notes || [])]});
  const ensure = (pair, points, note) => {
    if(!/^\d{2}$/.test(pair)) return;
    if(!map[pair]) map[pair] = {pair, points:0, notes:[]};
    map[pair].points = Math.max(map[pair].points, points);
    if(note && !map[pair].notes.includes(note)) map[pair].notes.unshift(note);
  };

  if(kind === 'AK'){
    // Jangan biarkan rumus pintu keluar seperti 36 mendominasi AK saat anchor zero-twin aktif.
    const leExit = new Set([`${ad[0]}${mod10(9-ad[0])}`, `${mod10(10-ld[0])}${mod10(ld[0]-1)}`]);
    leExit.forEach(p => { if(map[p]) map[p].points *= 0.42; });
    ensure(`${ld[0]}${ad[1]}`, 11800 + 0.05*((candidate.score || [])[ld[0]] || 0) + 0.05*((candidate.score || [])[ad[1]] || 0), 'AK position lock');
  }else{
    ensure(`${ad[0]}${mod10(9-ad[0])}`, 13200 + 0.05*((candidate.score || [])[ad[0]] || 0) + 0.05*((candidate.score || [])[mod10(9-ad[0])] || 0), 'LE position lock');
    ensure(`${mod10(10-ld[0])}${mod10(ld[0]-1)}`, 12100 + 0.05*((candidate.score || [])[mod10(10-ld[0])] || 0) + 0.05*((candidate.score || [])[mod10(ld[0]-1)] || 0), 'LE position lock');
  }
  return Object.values(map).sort((a,b) => b.points - a.points || a.pair.localeCompare(b.pair));
}

function orderedPairSeeds(row, formulas, kind){
  const a = row?.digits || [];
  if(a.length < 4) return [];
  const out = [];
  const add = (pair, label, bonus=0, width=2) => {
    if(/^\d{2}$/.test(pair)) out.push({pair, label, bonus, width});
  };
  const pair = (x,y) => `${mod10(x)}${mod10(y)}`;
  const root = digitalRoot(sumDigits(row));
  const dayIdx = DAYS.indexOf(row.day);
  const dayKey = dayIdx < 0 ? 0 : dayIdx + 1;

  if(kind === 'AK'){
    add(pair(a[0],a[1]), 'carry AK', 44);
    add(pair(mod10(9-a[0]), mod10(10-a[1])), 'mirror AK', 38);
    add(pair(mod10(10-a[0]), mod10(9-a[1])), 'mirror silang AK', 34);
    add(pair(mod10(a[0]+a[2]), mod10(a[1]+a[3])), 'AK dari silang posisi', 36);
    add(pair(mod10(a[0]+a[3]), mod10(a[1]+a[2])), 'AK sudut-tengah', 34);
    add(pair(mod10(a[0]+root), mod10(a[1]+dayKey)), 'AK root-hari', 30);
    add(pair(mod10(a[0]+6), mod10(a[1]+4)), 'AK golden 6/4', 28);
    add(pair(a[3], mod10(a[1]+a[3])), 'AK flow E + K+E', 52);
    add(pair(a[3], mod10(a[1]+a[2])), 'AK flow E + K+L', 40);
  }else{
    add(pair(a[2],a[3]), 'carry LE', 44);
    add(pair(mod10(9-a[2]), mod10(10-a[3])), 'mirror LE', 38);
    add(pair(mod10(10-a[2]), mod10(9-a[3])), 'mirror silang LE', 34);
    add(pair(mod10(a[1]+a[2]), mod10(a[0]+a[3])), 'LE tengah-sudut', 36);
    add(pair(mod10(a[2]+root), mod10(a[3]+dayKey)), 'LE root-hari', 30);
    add(pair(mod10(a[2]+6), mod10(a[3]+4)), 'LE golden 6/4', 28);
    add(pair(a[1], mod10(10-a[3])), 'LE flow K + mirror10 E', 54);
    add(pair(a[1], mod10(9-a[3])), 'LE flow K + mirror9 E', 38);
  }

  const gate = singlePairGateDigits(row);
  if(gate.length >= 2){
    add(`${gate[0]}${gate[1]}`, 'gerbang pasangan urut', 32);
    add(`${gate[Math.min(2, gate.length-1)]}${gate[0]}`, 'gerbang silang', 24);
  }
  const info = twinInfo(row);
  if(info.twins.length){
    const split = twinSplitDigits(row);
    const mirror = twinMirrorSingleDigits(row);
    if(mirror.length >= 4) add(`${mirror[0]}${mirror[3]}`, 'cermin tunggal kembar', 46);
    if(mirror.length >= 2 && split.length) add(`${mirror[1]}${split[0]}`, 'cermin + split kembar', 44);
    if(split.length >= 2) add(`${split[0]}${split[1]}`, 'pecah kembar langsung', 36);
  }
  return out;
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
    {title:'Tahap 3 • Membaca hari yang sama per pekan', icon:'③', delay:980, desc:'Menguji relasi seperti Senin ke Senin, Jumat ke Jumat, dan target hari berikutnya. V4.7 juga membaca jangkar hari target, carry anchor, hidden anchor, single-mirror, dan pola kembar menyebar.', items:weekPairs.length ? weekPairs : ['Belum cukup pasangan hari yang sama untuk dibaca.']},
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
  const chrono = rows.slice().reverse();
  const nextDayScore = {};
  let carryOverlapTotal = 0;
  let carryOverlapMax = 0;
  for(let i=0;i<chrono.length-1;i++){
    const prev = chrono[i];
    const next = chrono[i+1];
    if(prev.day !== latest || !next.day) continue;
    // Bobot lebih besar untuk transisi yang lebih dekat ke data terbaru.
    const recency = i + 1;
    nextDayScore[next.day] = (nextDayScore[next.day] || 0) + 10 + recency;
  }
  const learned = Object.entries(nextDayScore).sort((a,b) => b[1]-a[1] || DAYS.indexOf(a[0])-DAYS.indexOf(b[0]))[0];
  if(learned) return learned[0];
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
  const akleHtml = renderAKLE(r.akle);
  const tableHtml = renderDataTable(r.rows.slice(0,18));

  const anchorHtml = r.audit.targetAnchor ? `<div><b>Jangkar hari target</b><ul class="process-list small"><li>${escapeHtml(r.audit.targetAnchor.title)}</li><li>Carry: ${escapeHtml(r.audit.targetAnchor.carry)}</li><li>Cermin: ${escapeHtml(r.audit.targetAnchor.mirror)}</li><li>Gerbang: ${escapeHtml(r.audit.targetAnchor.gate)}</li><li>Root: ${escapeHtml(r.audit.targetAnchor.root)}</li></ul></div>` : '';
  const transitionHtml = r.audit.transitionProfile ? `<div><b>Schedule-aware carry</b><ul class="process-list small"><li>${escapeHtml(r.audit.transitionProfile.title)}</li><li>Total sampel: ${escapeHtml(r.audit.transitionProfile.total)}</li><li>${escapeHtml(r.audit.transitionProfile.latestCarry)}</li>${r.audit.transitionProfile.samples.slice(0,5).map(x => `<li>${escapeHtml(x)}</li>`).join('')}</ul></div>` : '';
  const twinLabHtml = r.audit.twinLab ? `<div><b>Twin Lab</b><ul class="process-list small"><li>${escapeHtml(r.audit.twinLab.title)}</li>${r.audit.twinLab.ranked.map(x => `<li>${escapeHtml(x)}</li>`).join('')}</ul></div>` : '';
  const twinCycleHtml = r.audit.twinCycle ? `<div><b>Twin cycle history</b><ul class="process-list small"><li>${escapeHtml(r.audit.twinCycle.title)}</li><li>Latest twin: ${escapeHtml(r.audit.twinCycle.latestTwins)}</li><li>Repeat sama: ${escapeHtml(r.audit.twinCycle.sameRepeat)}</li><li>Twin berikutnya: ${escapeHtml(r.audit.twinCycle.nextTwin)}</li><li>Digit twin historis: ${escapeHtml(r.audit.twinCycle.nextTwinDigits)}</li><li>Status: ${escapeHtml(r.audit.twinCycle.cooldown)}</li></ul></div>` : '';
  const complementHtml = r.audit.complementBridge ? `<div><b>Complement bridge</b><ul class="process-list small"><li>${escapeHtml(r.audit.complementBridge.title)}</li><li>${escapeHtml(r.audit.complementBridge.digits)}</li></ul></div>` : '';
  const centerBridgeHtml = r.audit.centerBridge ? `<div><b>Center bridge formula</b><ul class="process-list small"><li>${escapeHtml(r.audit.centerBridge.title)}</li><li>Digit: ${escapeHtml(r.audit.centerBridge.digits)}</li><li>Twin: ${escapeHtml(r.audit.centerBridge.twin)}</li></ul></div>` : '';
  const targetEdgeBridgeHtml = r.audit.targetEdgeBridge ? `<div><b>Target edge bridge</b><ul class="process-list small"><li>${escapeHtml(r.audit.targetEdgeBridge.title)}</li><li>Digit: ${escapeHtml(r.audit.targetEdgeBridge.digits)}</li><li>AK: ${escapeHtml(r.audit.targetEdgeBridge.ak)}</li><li>LE: ${escapeHtml(r.audit.targetEdgeBridge.le)}</li></ul></div>` : '';
  const targetDiagonalBridgeHtml = r.audit.targetDiagonalBridge ? `<div><b>Target diagonal bridge</b><ul class="process-list small"><li>${escapeHtml(r.audit.targetDiagonalBridge.title)}</li><li>Digit: ${escapeHtml(r.audit.targetDiagonalBridge.digits)}</li><li>AK: ${escapeHtml(r.audit.targetDiagonalBridge.ak)}</li><li>LE: ${escapeHtml(r.audit.targetDiagonalBridge.le)}${r.audit.targetDiagonalBridge.altLE ? ' / '+escapeHtml(r.audit.targetDiagonalBridge.altLE) : ''}</li></ul></div>` : '';
  const targetMirrorZeroBridgeHtml = r.audit.targetMirrorZeroBridge ? `<div><b>Target mirror-zero bridge</b><ul class="process-list small"><li>${escapeHtml(r.audit.targetMirrorZeroBridge.title)}</li><li>Digit: ${escapeHtml(r.audit.targetMirrorZeroBridge.digits)}</li><li>AK: ${escapeHtml(r.audit.targetMirrorZeroBridge.ak)}</li><li>LE: ${escapeHtml(r.audit.targetMirrorZeroBridge.le)}</li></ul></div>` : '';
  const targetTwinSingleBridgeHtml = r.audit.targetTwinSingleBridge ? `<div><b>Target twin-single bridge</b><ul class="process-list small"><li>${escapeHtml(r.audit.targetTwinSingleBridge.title)}</li><li>Digit: ${escapeHtml(r.audit.targetTwinSingleBridge.digits)}</li><li>AK: ${escapeHtml(r.audit.targetTwinSingleBridge.ak)}</li><li>LE: ${escapeHtml(r.audit.targetTwinSingleBridge.le)}</li></ul></div>` : '';
  const targetAnchorRotationBridgeHtml = r.audit.targetAnchorRotationBridge ? `<div><b>Target anchor-rotation bridge</b><ul class="process-list small"><li>${escapeHtml(r.audit.targetAnchorRotationBridge.title)}</li><li>Digit: ${escapeHtml(r.audit.targetAnchorRotationBridge.digits)}</li><li>AK: ${escapeHtml(r.audit.targetAnchorRotationBridge.ak)}</li><li>LE: ${escapeHtml(r.audit.targetAnchorRotationBridge.le)}</li></ul></div>` : '';
  const targetBoundaryRootTwinBridgeHtml = r.audit.targetBoundaryRootTwinBridge ? `<div><b>Target boundary root-twin bridge</b><ul class="process-list small"><li>${escapeHtml(r.audit.targetBoundaryRootTwinBridge.title)}</li><li>Digit: ${escapeHtml(r.audit.targetBoundaryRootTwinBridge.digits)}</li><li>AK: ${escapeHtml(r.audit.targetBoundaryRootTwinBridge.ak)}</li><li>LE: ${escapeHtml(r.audit.targetBoundaryRootTwinBridge.le)}</li><li>Twin: ${escapeHtml(r.audit.targetBoundaryRootTwinBridge.twin)}</li></ul></div>` : '';
  const targetAnchorSumLockBridgeHtml = r.audit.targetAnchorSumLockBridge ? `<div><b>Target anchor sum-lock bridge</b><ul class="process-list small"><li>${escapeHtml(r.audit.targetAnchorSumLockBridge.title)}</li><li>Digit: ${escapeHtml(r.audit.targetAnchorSumLockBridge.digits)}</li><li>AK: ${escapeHtml(r.audit.targetAnchorSumLockBridge.ak)}</li><li>LE: ${escapeHtml(r.audit.targetAnchorSumLockBridge.le)}</li></ul></div>` : '';
  const worldReplayHtml = r.audit.worldReplay ? `<div><b>World formula replay</b><ul class="process-list small"><li>${escapeHtml(r.audit.worldReplay.title)}</li><li>Digit: ${escapeHtml(r.audit.worldReplay.digits)}</li><li>Twin: ${escapeHtml(r.audit.worldReplay.twin)}</li><li>AK replay: ${escapeHtml(r.audit.worldReplay.ak)}</li><li>LE replay: ${escapeHtml(r.audit.worldReplay.le)}</li>${(r.audit.worldReplay.samples || []).slice(0,4).map(x => `<li>${escapeHtml(x)}</li>`).join('')}</ul></div>` : '';
  const marketHtml = r.audit.marketProfile ? `<div><b>Market adaptive memory</b><ul class="process-list small"><li>${escapeHtml(r.audit.marketProfile.title)}</li><li>Digit: ${escapeHtml(r.audit.marketProfile.digits)}</li><li>Twin: ${escapeHtml(r.audit.marketProfile.twin)}</li><li>AK template: ${escapeHtml(r.audit.marketProfile.ak)}</li><li>LE template: ${escapeHtml(r.audit.marketProfile.le)}</li>${(r.audit.marketProfile.samples || []).map(x => `<li>${escapeHtml(x)}</li>`).join('')}</ul></div>` : '';
  const processHtml = r.audit.process ? `<div class="section"><h3>Jejak Pembacaan Pelan</h3>
    <div class="audit-columns">
      <div><b>Transisi harian terbaru</b><ul class="process-list small">${r.audit.process.daily.map(x => `<li>${escapeHtml(x)}</li>`).join('')}</ul></div>
      <div><b>Hari sama per pekan</b><ul class="process-list small">${r.audit.process.weeklyLatest.concat(r.audit.process.weeklyTarget).slice(0,7).map(x => `<li>${escapeHtml(x)}</li>`).join('') || '<li>Belum cukup pasangan pekanan.</li>'}</ul></div>
      ${anchorHtml}
      ${transitionHtml}
      ${twinLabHtml}
      ${twinCycleHtml}
      ${complementHtml}
      ${centerBridgeHtml}
      ${targetEdgeBridgeHtml}
      ${targetDiagonalBridgeHtml}
      ${targetMirrorZeroBridgeHtml}
      ${targetTwinSingleBridgeHtml}
      ${targetAnchorRotationBridgeHtml}
      ${targetBoundaryRootTwinBridgeHtml}
      ${targetAnchorSumLockBridgeHtml}
      ${worldReplayHtml}
      ${marketHtml}
      <div><b>Operasi latest</b><ul class="process-list small">${r.audit.process.latestOps.map(x => `<li>${escapeHtml(x)}</li>`).join('')}</ul></div>
    </div>
  </div>` : '';
  $('output').className = '';
  $('output').innerHTML = `<div class="result-block">
    <div class="final-card">
      <h3>6 Digit Formula + 1 Kandidat Kembar</h3>
      <div class="digits">${digitsHtml}</div>
      <div class="twin-box"><small>Kandidat kembar rumus</small><b>${r.twinDigit}${r.twinDigit}</b></div>
      <p class="tagline">Engine V6.4 membaca pelan operasi tambah, kurang, kali, bagi bulat, tetangga cincin, cermin 9/10, root, sudut-tengah, golden shift, Fibonacci shift, affine modular, rumus hari, kembar menyebar, jangkar hari target, carry anchor, hidden anchor, single-mirror, AKLE berurutan, twin dari 6 digit utama, parser date-first, schedule-aware target day, transition carry lock, boundary-tail mirror cluster, twin lab root lock, twin cooldown history, post-twin adaptive spread, complement zero bridge, AK K+A lock, LE zero+A lock, center bridge K+L/K+E, market carry brake, target-edge bridge, target-diagonal bridge, target mirror-zero bridge, target twin-single bridge, target anchor-rotation bridge, target boundary root-twin bridge, target anchor sum-lock bridge, AKLE edge/diagonal/mirror-zero/anchor-rotation/sum-lock rescue, dan center-bridge twin audit.</p>
    </div>
    <div class="section"><h3>Ringkasan</h3>${statsHtml}</div>
    ${akleHtml}
    <div class="section"><h3>Rumus Dominan Saat Ini</h3><div class="formula-grid">${formulaCards}</div></div>
    <div class="section"><h3>Ranking Digit Berdasarkan Rumus</h3><div class="rank">${topDigits}</div></div>
    ${processHtml}
    <div class="section"><h3>Arsip Terbaru</h3>${tableHtml}</div>
  </div>`;
}


function renderAKLE(akle){
  if(!akle) return '';
  const renderPair = (x,type) => `<div class="pair-card ${type}"><b>${x.pair}</b></div>`;
  const ak = (akle.ak || []).map(x => renderPair(x,'ak')).join('');
  const le = (akle.le || []).map(x => renderPair(x,'le')).join('');
  return `<div class="section akle-section"><h3>AKLE Ordered Formula</h3>
    <div class="akle-grid"><div><h4>5 Pilihan AK</h4><div class="pair-grid">${ak}</div></div><div><h4>5 Pilihan LE</h4><div class="pair-grid">${le}</div></div></div>
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
