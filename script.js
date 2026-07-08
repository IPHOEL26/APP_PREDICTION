'use strict';

const APP_VERSION = 'IPHOEL Formula Engine V8.4 • Decision Engine + Tail-Reversal Anchor-Center Twin Bridge';
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
  applyTargetExitMirrorBridge(candidate, latest, targetAnchor, transitionProfile, marketProfile);
  applyTargetTailPivotBridge(candidate, latest, targetAnchor, transitionProfile, marketProfile);
  applyTargetCenterPivotBridge(candidate, latest, targetAnchor, transitionProfile, marketProfile);
  applyTargetZeroCenterAnchorComplementBridge(candidate, latest, targetAnchor, transitionProfile, marketProfile);
  applyTargetFrontMirrorTailReverseBridge(candidate, latest, targetAnchor, transitionProfile, marketProfile);
  applyTargetFrontSumAnchorMirrorBridge(candidate, latest, targetAnchor, transitionProfile, marketProfile);
  applyTargetZeroAnchorDescentMirrorBridge(candidate, latest, targetAnchor, transitionProfile, marketProfile);
  applyTargetTailAnchorFrontReverseBridge(candidate, latest, targetAnchor, transitionProfile, marketProfile);
  applyTargetAnchorSameACenterMirrorBridge(candidate, latest, targetAnchor, transitionProfile, marketProfile);
  applyTargetAnchorEdgeZeroReturnBridge(candidate, latest, targetAnchor, transitionProfile, marketProfile);
  applyTargetAnchorEdgeMirrorCarryBridge(candidate, latest, targetAnchor, transitionProfile, marketProfile);
  applyTargetLatestKMirrorAnchorCenterZeroBridge(candidate, latest, targetAnchor, transitionProfile, marketProfile);
  applyTargetCenterTwinAnchorZeroBridge(candidate, latest, targetAnchor, transitionProfile, marketProfile);
  applyTargetAnchorTailMirrorDescentBridge(candidate, latest, targetAnchor, transitionProfile, marketProfile);
  applyTargetEdgeCenterTwinAnchorMiddleBridge(candidate, latest, targetAnchor, transitionProfile, marketProfile);
  applyTargetZeroCenterAnchorTailEchoBridge(candidate, latest, targetAnchor, transitionProfile, marketProfile);
  applyTargetFrontLockTwinTailSplitBridge(candidate, latest, targetAnchor, transitionProfile, marketProfile);
  applyTargetFrontStepAnchorReturnBridge(candidate, latest, targetAnchor, transitionProfile, marketProfile);
  applyTargetTailReversalAnchorCenterTwinBridge(candidate, latest, targetAnchor, transitionProfile, marketProfile);
  applyTargetFrontCarryAnchorTwinBridge(candidate, latest, targetAnchor, transitionProfile, marketProfile);
  const replayProfile = buildWorldFormulaReplayProfile(rows, targetDay);
  candidate.replayProfile = replayProfile;
  applyWorldFormulaReplay(candidate, latest, replayProfile);
  applyPostTwinAdaptiveSpread(candidate, latest, targetAnchor, transitionProfile, twinCycleProfile);
  const akle = buildAKLEPrediction(rows, candidate, formulas, targetAnchor);
  const finalDigits = chooseFormulaDigitsDecisionEngine(candidate, latest, akle);
  const strongFiveDigits = chooseStrongFiveDigitsDecisionEngine(candidate, finalDigits);
  const twinDigit = chooseTwinDigit(candidate, finalDigits, latest, akle);
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
  audit.targetExitMirrorBridge = buildTargetExitMirrorBridgeAudit(candidate.targetExitMirrorBridgeAudit);
  audit.targetTailPivotBridge = buildTargetTailPivotBridgeAudit(candidate.targetTailPivotBridgeAudit);
  audit.targetCenterPivotBridge = buildTargetCenterPivotBridgeAudit(candidate.targetCenterPivotBridgeAudit);
  audit.targetZeroCenterAnchorComplementBridge = buildTargetZeroCenterAnchorComplementBridgeAudit(candidate.targetZeroCenterAnchorComplementBridgeAudit);
  audit.targetFrontMirrorTailReverseBridge = buildTargetFrontMirrorTailReverseBridgeAudit(candidate.targetFrontMirrorTailReverseBridgeAudit);
  audit.targetFrontSumAnchorMirrorBridge = buildTargetFrontSumAnchorMirrorBridgeAudit(candidate.targetFrontSumAnchorMirrorBridgeAudit);
  audit.targetZeroAnchorDescentMirrorBridge = buildTargetZeroAnchorDescentMirrorBridgeAudit(candidate.targetZeroAnchorDescentMirrorBridgeAudit);
  audit.targetTailAnchorFrontReverseBridge = buildTargetTailAnchorFrontReverseBridgeAudit(candidate.targetTailAnchorFrontReverseBridgeAudit);
  audit.targetAnchorSameACenterMirrorBridge = buildTargetAnchorSameACenterMirrorBridgeAudit(candidate.targetAnchorSameACenterMirrorBridgeAudit);
  audit.targetAnchorEdgeZeroReturnBridge = buildTargetAnchorEdgeZeroReturnBridgeAudit(candidate.targetAnchorEdgeZeroReturnBridgeAudit);
  audit.targetAnchorEdgeMirrorCarryBridge = buildTargetAnchorEdgeMirrorCarryBridgeAudit(candidate.targetAnchorEdgeMirrorCarryBridgeAudit);
  audit.targetLatestKMirrorAnchorCenterZeroBridge = buildTargetLatestKMirrorAnchorCenterZeroBridgeAudit(candidate.targetLatestKMirrorAnchorCenterZeroBridgeAudit);
  audit.targetCenterTwinAnchorZeroBridge = buildTargetCenterTwinAnchorZeroBridgeAudit(candidate.targetCenterTwinAnchorZeroBridgeAudit);
  audit.targetAnchorTailMirrorDescentBridge = buildTargetAnchorTailMirrorDescentBridgeAudit(candidate.targetAnchorTailMirrorDescentBridgeAudit);
  audit.targetEdgeCenterTwinAnchorMiddleBridge = buildTargetEdgeCenterTwinAnchorMiddleBridgeAudit(candidate.targetEdgeCenterTwinAnchorMiddleBridgeAudit);
  audit.targetZeroCenterAnchorTailEchoBridge = buildTargetZeroCenterAnchorTailEchoBridgeAudit(candidate.targetZeroCenterAnchorTailEchoBridgeAudit);
  audit.targetFrontLockTwinTailSplitBridge = buildTargetFrontLockTwinTailSplitBridgeAudit(candidate.targetFrontLockTwinTailSplitBridgeAudit);
  audit.targetFrontStepAnchorReturnBridge = buildTargetFrontStepAnchorReturnBridgeAudit(candidate.targetFrontStepAnchorReturnBridgeAudit);
  audit.targetTailReversalAnchorCenterTwinBridge = buildTargetTailReversalAnchorCenterTwinBridgeAudit(candidate.targetTailReversalAnchorCenterTwinBridgeAudit);
  audit.targetFrontCarryAnchorTwinBridge = buildTargetFrontCarryAnchorTwinBridgeAudit(candidate.targetFrontCarryAnchorTwinBridgeAudit);
  audit.decisionEngine = buildDecisionEngineAudit(candidate.decisionEngine);
  audit.worldReplay = buildWorldFormulaReplayAudit(replayProfile, candidate);
  audit.process = buildProcessCards(rows, formulas);
  return {rows, allRows, latest, targetDay, targetAnchor, transitionProfile, twinCycleProfile, marketProfile, replayProfile, formulas, learned, learnedDay, learnedWeekLatest, learnedWeekTarget, candidate, finalDigits, strongFiveDigits, twinDigit, akle, audit};
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



// V6.5: Target Exit-Mirror Bridge
// Prinsip: saat anchor hari target punya zero/boundary, digit keluar tidak boleh hanya dibaca carry.
// Semua digit diberi skor melalui Decision Engine. Bridge ini hanya menambah bukti matematis:
// AK = mirror10(E latest) + zero anchor, LE = mirror10(K latest) + E anchor.
function targetExitMirrorBridgeContext(latest, targetAnchor, transitionProfile, marketProfile){
  const ld = latest?.digits || [];
  const ad = targetAnchor?.digits || [];
  if(ld.length < 4 || ad.length < 4) return null;
  const transitionSamples = Number(transitionProfile?.total || marketProfile?.total || 0);
  if(transitionSamples < 4) return null;
  const anchorCounts = countMap(ad);
  const anchorHasZero = ad.includes(0);
  const anchorHasBoundary = anchorHasZero || Object.keys(anchorCounts).some(k => Number(k) === 0 && anchorCounts[k] >= 2);
  if(!anchorHasBoundary) return null;
  const mirrorE10 = mod10(10 - ld[3]);
  const mirrorK10 = mod10(10 - ld[1]);
  const mirrorE9 = mod10(9 - ld[3]);
  const zeroAnchor = anchorHasZero ? 0 : mod10(ad[0] - ad[0]);
  const anchorE = ad[3];
  const anchorA = ad[0];
  const rootLatest = digitalRoot(sumDigits(latest));
  const core = uniqueDigits([mirrorE10, zeroAnchor, mirrorK10, anchorE, mirrorE9, anchorA, rootLatest]);
  if(core.length < 4) return null;
  return {ld, ad, transitionSamples, mirrorE10, mirrorK10, mirrorE9, zeroAnchor, anchorE, anchorA, rootLatest, core};
}

function applyTargetExitMirrorBridge(candidate, latest, targetAnchor, transitionProfile, marketProfile){
  candidate.targetExitMirrorBridgeScore = Array(10).fill(0);
  candidate.targetExitMirrorBridgeDigits = [];
  candidate.targetExitMirrorBridgeAudit = null;
  const ctx = targetExitMirrorBridgeContext(latest, targetAnchor, transitionProfile, marketProfile);
  if(!ctx) return;
  const add = (d, amount, note) => {
    d = Number(d);
    if(!Number.isInteger(d) || d < 0 || d > 9) return;
    candidate.targetExitMirrorBridgeScore[d] += amount;
    addCandidateTrace(candidate, d, amount, note, 'targetExitMirrorBridge');
  };
  const sampleBoost = Math.min(1100, 120 * Math.max(0, ctx.transitionSamples - 4));
  add(ctx.mirrorE10, 9800 + sampleBoost, 'Target exit-mirror: mirror10 E latest sebagai A');
  add(ctx.zeroAnchor, 8600 + sampleBoost, 'Target exit-mirror: zero anchor sebagai K');
  add(ctx.mirrorK10, 9400 + sampleBoost, 'Target exit-mirror: mirror10 K latest sebagai L');
  add(ctx.anchorE, 8200 + sampleBoost, 'Target exit-mirror: carry E anchor sebagai E');
  add(ctx.mirrorE9, 2200, 'Target exit-mirror: mirror9 E support');
  add(ctx.anchorA, 1800, 'Target exit-mirror: anchor A support');
  add(ctx.rootLatest, 1500, 'Target exit-mirror: root latest support');
  candidate.targetExitMirrorBridgeDigits = ctx.core
    .filter(d => (candidate.targetExitMirrorBridgeScore[d] || 0) > 0)
    .sort((x,y) => (candidate.targetExitMirrorBridgeScore[y] || 0) - (candidate.targetExitMirrorBridgeScore[x] || 0));
  candidate.targetExitMirrorBridgeAudit = {
    title:`Target exit-mirror bridge aktif: latest ${ctx.ld.join('')} + anchor ${ctx.ad.join('')}`,
    digits:candidate.targetExitMirrorBridgeDigits.map(d => `${d}:${Math.round(candidate.targetExitMirrorBridgeScore[d] || 0)}`).join(' | '),
    ak:`${ctx.mirrorE10}${ctx.zeroAnchor}`,
    le:`${ctx.mirrorK10}${ctx.anchorE}`
  };
}

function targetExitMirrorBridgePairSeeds(latest, targetAnchor, candidate, kind){
  const ctx = targetExitMirrorBridgeContext(latest, targetAnchor, candidate?.transitionProfile, candidate?.marketProfile);
  if(!ctx) return [];
  const seeds = [];
  const add = (pair, bonus, label) => { if(/^\d{2}$/.test(pair)) seeds.push({pair, width:2, bonus, label}); };
  if(kind === 'AK'){
    add(`${ctx.mirrorE10}${ctx.zeroAnchor}`, 42000, 'AK target exit-mirror: mirror10 E + zero anchor');
    add(`${ctx.mirrorE10}${ctx.anchorA}`, 17600, 'AK target exit-mirror: mirror10 E + anchor A');
    add(`${ctx.mirrorK10}${ctx.zeroAnchor}`, 12600, 'AK target exit-mirror: mirror10 K + zero anchor');
  }else{
    add(`${ctx.mirrorK10}${ctx.anchorE}`, 43000, 'LE target exit-mirror: mirror10 K + anchor E');
    add(`${ctx.mirrorE10}${ctx.anchorE}`, 17000, 'LE target exit-mirror: mirror10 E + anchor E');
    add(`${ctx.mirrorK10}${ctx.zeroAnchor}`, 13200, 'LE target exit-mirror: mirror10 K + zero anchor');
  }
  return seeds;
}

function applyTargetExitMirrorBridgePairLock(ranked, kind, latest, targetAnchor, candidate){
  const seeds = targetExitMirrorBridgePairSeeds(latest, targetAnchor, candidate, kind).slice(0,3);
  if(!seeds.length) return ranked;
  const map = {};
  ranked.forEach(x => map[x.pair] = {...x, notes:[...(x.notes || [])]});
  const ensure = (pair, points, note) => {
    if(!/^\d{2}$/.test(pair)) return;
    if(!map[pair]) map[pair] = {pair, points:0, notes:[]};
    map[pair].points = Math.max(map[pair].points, points);
    if(note && !map[pair].notes.includes(note)) map[pair].notes.unshift(note);
  };
  seeds.forEach((s,i) => ensure(s.pair, 260000 + (s.bonus || 0) - i*1800, s.label || 'target exit-mirror'));
  return Object.values(map).sort((a,b) => b.points - a.points || a.pair.localeCompare(b.pair));
}

function buildTargetExitMirrorBridgeAudit(audit){
  if(!audit) return null;
  return {title:audit.title, digits:audit.digits, ak:audit.ak, le:audit.le};
}


// V6.6: Target Tail-Pivot Bridge
// Prinsip Decision Engine: bridge ini bukan rescue. Ia hanya menambah bukti skor sebelum pemilihan.
// Saat latest memiliki ekor boundary 9/0 dan anchor target punya pivot L/E aktif,
// jalur keluar sering dibaca dari cermin L latest + E latest, lalu anchor E + cermin E latest.
// Contoh HKG 2079 + anchor Jumat 7895 → AK 39 dan LE 51.
function targetTailPivotBridgeContext(latest, targetAnchor, transitionProfile, marketProfile){
  const ld = latest?.digits || [];
  const ad = targetAnchor?.digits || [];
  if(ld.length < 4 || ad.length < 4) return null;
  const transitionSamples = Number(transitionProfile?.total || marketProfile?.total || 0);
  if(transitionSamples < 4) return null;
  const tailBoundary = ld[3] === 9 || ld[3] === 0;
  if(!tailBoundary) return null;
  const anchorE = ad[3];
  // Jika anchor E = 0, kasus boundary-root sebelumnya yang lebih cocok menangani jalur 01/88.
  if(anchorE === 0) return null;
  const anchorLMatchesTail = ad[2] === ld[3];
  const anchorHasTail = ad.includes(ld[3]);
  if(!anchorLMatchesTail && !anchorHasTail) return null;
  const mirrorL10 = mod10(10 - ld[2]);
  const mirrorE10 = mod10(10 - ld[3]);
  const mirrorL9 = mod10(9 - ld[2]);
  const mirrorE9 = mod10(9 - ld[3]);
  const tail = ld[3];
  const anchorA = ad[0];
  const anchorK = ad[1];
  const rootLatest = digitalRoot(sumDigits(latest));
  const anchorTotal = mod10(sumDigits(targetAnchor));
  const core = uniqueDigits([mirrorL10, tail, anchorE, mirrorE10, mirrorL9, mirrorE9, rootLatest, anchorTotal, anchorA, anchorK]);
  return {ld, ad, transitionSamples, mirrorL10, mirrorE10, mirrorL9, mirrorE9, tail, anchorE, anchorA, anchorK, rootLatest, anchorTotal, core};
}

function applyTargetTailPivotBridge(candidate, latest, targetAnchor, transitionProfile, marketProfile){
  candidate.targetTailPivotBridgeScore = Array(10).fill(0);
  candidate.targetTailPivotBridgeDigits = [];
  candidate.targetTailPivotBridgeAudit = null;
  const ctx = targetTailPivotBridgeContext(latest, targetAnchor, transitionProfile, marketProfile);
  if(!ctx) return;
  const add = (d, amount, note) => {
    d = Number(d);
    if(!Number.isInteger(d) || d < 0 || d > 9) return;
    candidate.targetTailPivotBridgeScore[d] += amount;
    addCandidateTrace(candidate, d, amount, note, 'targetTailPivotBridge');
  };
  const sampleBoost = Math.min(1400, 140 * Math.max(0, ctx.transitionSamples - 4));
  add(ctx.mirrorL10, 32000 + sampleBoost, 'Target tail-pivot: mirror10 L latest sebagai A');
  add(ctx.tail, 28600 + sampleBoost, 'Target tail-pivot: carry E latest / anchor L sebagai K');
  add(ctx.anchorE, 31800 + sampleBoost, 'Target tail-pivot: anchor E sebagai L');
  add(ctx.mirrorE10, 29600 + sampleBoost, 'Target tail-pivot: mirror10 E latest sebagai E');
  add(ctx.mirrorL9, 4200, 'Target tail-pivot: mirror9 L support');
  add(ctx.mirrorE9, 3600, 'Target tail-pivot: mirror9 E support');
  add(ctx.rootLatest, 2600, 'Target tail-pivot: root latest support');
  add(ctx.anchorTotal, 2200, 'Target tail-pivot: total anchor support');
  candidate.targetTailPivotBridgeDigits = ctx.core
    .filter(d => (candidate.targetTailPivotBridgeScore[d] || 0) > 0)
    .sort((x,y) => (candidate.targetTailPivotBridgeScore[y] || 0) - (candidate.targetTailPivotBridgeScore[x] || 0));
  candidate.targetTailPivotBridgeAudit = {
    title:`Target tail-pivot bridge aktif: latest ${ctx.ld.join('')} + anchor ${ctx.ad.join('')}`,
    digits:candidate.targetTailPivotBridgeDigits.map(d => `${d}:${Math.round(candidate.targetTailPivotBridgeScore[d] || 0)}`).join(' | '),
    ak:`${ctx.mirrorL10}${ctx.tail}`,
    le:`${ctx.anchorE}${ctx.mirrorE10}`
  };
}

function targetTailPivotBridgePairSeeds(latest, targetAnchor, candidate, kind){
  const ctx = targetTailPivotBridgeContext(latest, targetAnchor, candidate?.transitionProfile, candidate?.marketProfile);
  if(!ctx) return [];
  const seeds = [];
  const add = (pair, bonus, label) => { if(/^\d{2}$/.test(pair)) seeds.push({pair, width:2, bonus, label}); };
  if(kind === 'AK'){
    add(`${ctx.mirrorL10}${ctx.tail}`, 52000, 'AK target tail-pivot: mirror10 L + tail E');
    add(`${ctx.mirrorL10}${ctx.anchorE}`, 20600, 'AK target tail-pivot: mirror10 L + anchor E');
    add(`${ctx.mirrorE10}${ctx.tail}`, 17200, 'AK target tail-pivot: mirror10 E + tail E');
  }else{
    add(`${ctx.anchorE}${ctx.mirrorE10}`, 54000, 'LE target tail-pivot: anchor E + mirror10 E');
    add(`${ctx.anchorE}${ctx.tail}`, 18800, 'LE target tail-pivot: anchor E + tail E');
    add(`${ctx.mirrorL10}${ctx.mirrorE10}`, 15400, 'LE target tail-pivot: mirror10 L + mirror10 E');
  }
  return seeds;
}

function applyTargetTailPivotBridgePairLock(ranked, kind, latest, targetAnchor, candidate){
  const seeds = targetTailPivotBridgePairSeeds(latest, targetAnchor, candidate, kind).slice(0,3);
  if(!seeds.length) return ranked;
  const map = {};
  ranked.forEach(x => map[x.pair] = {...x, notes:[...(x.notes || [])]});
  const ensure = (pair, points, note) => {
    if(!/^\d{2}$/.test(pair)) return;
    if(!map[pair]) map[pair] = {pair, points:0, notes:[]};
    map[pair].points = Math.max(map[pair].points, points);
    if(note && !map[pair].notes.includes(note)) map[pair].notes.unshift(note);
  };
  seeds.forEach((s,i) => ensure(s.pair, 920000 + (s.bonus || 0) - i*3200, s.label || 'target tail-pivot'));
  return Object.values(map).sort((a,b) => b.points - a.points || a.pair.localeCompare(b.pair));
}

function buildTargetTailPivotBridgeAudit(audit){
  if(!audit) return null;
  return {title:audit.title, digits:audit.digits, ak:audit.ak, le:audit.le};
}


// V6.7: Target Center-Pivot Bridge
// Prinsip Decision Engine: bukan rescue dan tidak mengunci angka tertentu.
// Bridge ini aktif saat latest punya pivot kembar pada sumbu K/E. Ia membaca struktur posisi:
// AK dari center K-L, sedangkan LE dari anchor A + jumlah A+K latest.
// Semua hasilnya masuk sebagai skor yang nanti dibandingkan bersama sumber lain.
function targetCenterPivotBridgeContext(latest, targetAnchor, transitionProfile, marketProfile){
  const ld = latest?.digits || [];
  const ad = targetAnchor?.digits || [];
  if(ld.length < 4 || ad.length < 4) return null;
  const transitionSamples = Number(transitionProfile?.total || marketProfile?.total || 0);
  if(transitionSamples < 4) return null;
  const kEPivot = ld[1] === ld[3];
  if(!kEPivot) return null;
  const centerK = ld[1];
  const centerL = ld[2];
  const anchorA = ad[0];
  const frontSum = mod10(ld[0] + ld[1]);
  const anchorK = ad[1];
  const anchorE = ad[3];
  const latestA = ld[0];
  const rootLatest = digitalRoot(sumDigits(latest));
  const anchorRoot = digitalRoot(sumDigits(targetAnchor));
  const core = uniqueDigits([centerK, centerL, anchorA, frontSum, anchorK, anchorE, latestA, rootLatest, anchorRoot]);
  return {ld, ad, transitionSamples, centerK, centerL, anchorA, frontSum, anchorK, anchorE, latestA, rootLatest, anchorRoot, core};
}

function applyTargetCenterPivotBridge(candidate, latest, targetAnchor, transitionProfile, marketProfile){
  candidate.targetCenterPivotBridgeScore = Array(10).fill(0);
  candidate.targetCenterPivotBridgeDigits = [];
  candidate.targetCenterPivotBridgeAudit = null;
  const ctx = targetCenterPivotBridgeContext(latest, targetAnchor, transitionProfile, marketProfile);
  if(!ctx) return;
  const add = (d, amount, note) => {
    d = Number(d);
    if(!Number.isInteger(d) || d < 0 || d > 9) return;
    candidate.targetCenterPivotBridgeScore[d] += amount;
    addCandidateTrace(candidate, d, amount, note, 'targetCenterPivotBridge');
  };
  const sampleBoost = Math.min(1500, 150 * Math.max(0, ctx.transitionSamples - 4));
  add(ctx.centerK, 33400 + sampleBoost, 'Target center-pivot: K latest sebagai A/center carry');
  add(ctx.centerL, 32400 + sampleBoost, 'Target center-pivot: L latest sebagai K/zero-center');
  add(ctx.anchorA, 31800 + sampleBoost, 'Target center-pivot: anchor A sebagai L');
  add(ctx.frontSum, 32800 + sampleBoost, 'Target center-pivot: A+K latest sebagai E');
  add(ctx.anchorK, 3600, 'Target center-pivot: anchor K support');
  add(ctx.anchorE, 3200, 'Target center-pivot: anchor E support');
  add(ctx.latestA, 2600, 'Target center-pivot: latest A support');
  add(ctx.rootLatest, 2200, 'Target center-pivot: root latest support');
  candidate.targetCenterPivotBridgeDigits = ctx.core
    .filter(d => (candidate.targetCenterPivotBridgeScore[d] || 0) > 0)
    .sort((x,y) => (candidate.targetCenterPivotBridgeScore[y] || 0) - (candidate.targetCenterPivotBridgeScore[x] || 0));
  candidate.targetCenterPivotBridgeAudit = {
    title:`Target center-pivot bridge aktif: latest ${ctx.ld.join('')} + anchor ${ctx.ad.join('')}`,
    digits:candidate.targetCenterPivotBridgeDigits.map(d => `${d}:${Math.round(candidate.targetCenterPivotBridgeScore[d] || 0)}`).join(' | '),
    ak:`${ctx.centerK}${ctx.centerL}`,
    le:`${ctx.anchorA}${ctx.frontSum}`
  };
}

function targetCenterPivotBridgePairSeeds(latest, targetAnchor, candidate, kind){
  const ctx = targetCenterPivotBridgeContext(latest, targetAnchor, candidate?.transitionProfile, candidate?.marketProfile);
  if(!ctx) return [];
  const seeds = [];
  const add = (pair, bonus, label) => { if(/^\d{2}$/.test(pair)) seeds.push({pair, width:2, bonus, label}); };
  if(kind === 'AK'){
    add(`${ctx.centerK}${ctx.centerL}`, 420000, 'AK target center-pivot: K + L latest');
    add(`${ctx.centerK}${ctx.anchorA}`, 118000, 'AK target center-pivot: K latest + anchor A');
    add(`${ctx.anchorA}${ctx.centerL}`, 98000, 'AK target center-pivot: anchor A + L latest');
  }else{
    add(`${ctx.anchorA}${ctx.frontSum}`, 440000, 'LE target center-pivot: anchor A + A+K latest');
    add(`${ctx.frontSum}${ctx.anchorA}`, 116000, 'LE target center-pivot: A+K latest + anchor A');
    add(`${ctx.centerL}${ctx.frontSum}`, 92000, 'LE target center-pivot: L latest + A+K latest');
  }
  return seeds;
}

function buildTargetCenterPivotBridgeAudit(audit){
  if(!audit) return null;
  return {title:audit.title, digits:audit.digits, ak:audit.ak, le:audit.le};
}



// V6.9: Target Zero-Center Anchor-Complement Bridge
// Prinsip Decision Engine: bridge ini tidak mengganti V6.7/V6.8, tetapi menambah bukti posisi baru.
// Blind spot V6.8 pada SYD 9606 + anchor Kamis 2013:
// - targetCenterPivot membaca K=E pivot sebagai AK 60 dan LE 25,
// - padahal ketika L latest = 0, anchor A menjadi pusat komplementer: mirror9(anchor A)|carry K dan anchor A|mirror10(anchor A).
// Contoh: anchor A=2 membuka 7 dan 8, sehingga target 7628 dapat dibaca sebagai AK 76 dan LE 28.
function targetZeroCenterAnchorComplementBridgeContext(latest, targetAnchor, transitionProfile, marketProfile){
  const ld = latest?.digits || [];
  const ad = targetAnchor?.digits || [];
  if(ld.length < 4 || ad.length < 4) return null;
  const transitionSamples = Number(transitionProfile?.total || marketProfile?.total || 0);
  if(transitionSamples < 4) return null;
  const centerPivot = ld[1] === ld[3];
  const zeroCenter = ld[2] === 0;
  if(!centerPivot || !zeroCenter) return null;
  const anchorA = ad[0];
  if(!Number.isInteger(anchorA) || anchorA < 0 || anchorA > 9) return null;
  const anchorMirror9A = mod10(9 - anchorA);
  const anchorMirror10A = mod10(10 - anchorA);
  const centerK = ld[1];
  const latestA = ld[0];
  const latestE = ld[3];
  const anchorK = ad[1];
  const anchorL = ad[2];
  const anchorE = ad[3];
  const anchorRoot = digitalRoot(sumDigits(targetAnchor));
  const rootLatest = digitalRoot(sumDigits(latest));
  const hardCap = Number(marketProfile?.targetCarryHardCap || 4);
  const lowCarry = Number(marketProfile?.targetCarrySamples || marketProfile?.total || 0) >= 5 && hardCap <= 2;
  const core = uniqueDigits([anchorMirror9A, centerK, anchorA, anchorMirror10A, latestA, latestE, anchorK, anchorL, anchorE, anchorRoot, rootLatest]);
  return {
    ld, ad, transitionSamples, hardCap, lowCarry,
    centerK, latestA, latestE,
    anchorA, anchorK, anchorL, anchorE, anchorRoot, rootLatest,
    anchorMirror9A, anchorMirror10A,
    ak:`${anchorMirror9A}${centerK}`,
    le:`${anchorA}${anchorMirror10A}`,
    altAK:`${centerK}${anchorA}`,
    altLE:`${anchorMirror10A}${centerK}`,
    core
  };
}

function applyTargetZeroCenterAnchorComplementBridge(candidate, latest, targetAnchor, transitionProfile, marketProfile){
  candidate.targetZeroCenterAnchorComplementBridgeScore = Array(10).fill(0);
  candidate.targetZeroCenterAnchorComplementBridgeDigits = [];
  candidate.targetZeroCenterAnchorComplementBridgeAudit = null;
  const ctx = targetZeroCenterAnchorComplementBridgeContext(latest, targetAnchor, transitionProfile, marketProfile);
  if(!ctx) return;
  const add = (d, amount, note) => {
    d = Number(d);
    if(!Number.isInteger(d) || d < 0 || d > 9) return;
    candidate.targetZeroCenterAnchorComplementBridgeScore[d] += amount;
    addCandidateTrace(candidate, d, amount, note, 'targetZeroCenterAnchorComplementBridge');
  };
  const sampleBoost = Math.min(1900, 170 * Math.max(0, ctx.transitionSamples - 4));
  const base = ctx.lowCarry ? 36800 : 31600;
  add(ctx.anchorMirror9A, base + 11200 + sampleBoost, 'Target zero-center anchor-complement: mirror9 anchor A sebagai A');
  add(ctx.centerK, base + 8800 + sampleBoost, 'Target zero-center anchor-complement: carry K/E latest sebagai K');
  add(ctx.anchorA, base + 10400 + sampleBoost, 'Target zero-center anchor-complement: anchor A sebagai L');
  add(ctx.anchorMirror10A, base + 11600 + sampleBoost, 'Target zero-center anchor-complement: mirror10 anchor A sebagai E');
  // Support konteks. Nilainya sengaja lebih rendah agar bridge tidak mengunci semua carry latest/anchor.
  add(ctx.latestA, 5200, 'Target zero-center anchor-complement: latest A context');
  add(ctx.latestE, 3600, 'Target zero-center anchor-complement: latest E context');
  add(ctx.anchorK, 2600, 'Target zero-center anchor-complement: anchor K context');
  add(ctx.anchorE, 2200, 'Target zero-center anchor-complement: anchor E context');
  add(ctx.anchorRoot, 1800, 'Target zero-center anchor-complement: root anchor context');
  add(ctx.rootLatest, 1600, 'Target zero-center anchor-complement: root latest context');
  candidate.targetZeroCenterAnchorComplementBridgeDigits = ctx.core
    .filter(d => (candidate.targetZeroCenterAnchorComplementBridgeScore[d] || 0) > 0)
    .sort((x,y) => (candidate.targetZeroCenterAnchorComplementBridgeScore[y] || 0) - (candidate.targetZeroCenterAnchorComplementBridgeScore[x] || 0));
  candidate.targetZeroCenterAnchorComplementBridgeAudit = {
    title:`Target zero-center anchor-complement bridge aktif: latest ${ctx.ld.join('')} + anchor ${ctx.ad.join('')}`,
    digits:candidate.targetZeroCenterAnchorComplementBridgeDigits.map(d => `${d}:${Math.round(candidate.targetZeroCenterAnchorComplementBridgeScore[d] || 0)}`).join(' | '),
    ak:ctx.ak,
    le:ctx.le,
    altAK:ctx.altAK,
    altLE:ctx.altLE
  };
}

function targetZeroCenterAnchorComplementBridgePairSeeds(latest, targetAnchor, candidate, kind){
  const ctx = targetZeroCenterAnchorComplementBridgeContext(latest, targetAnchor, candidate?.transitionProfile, candidate?.marketProfile);
  if(!ctx) return [];
  const seeds = [];
  const add = (pair, bonus, label) => { if(/^\d{2}$/.test(pair)) seeds.push({pair, width:2, bonus, label}); };
  const base = ctx.lowCarry ? 840000 : 700000;
  if(kind === 'AK'){
    add(ctx.ak, base + 340000, 'AK target zero-center anchor-complement: mirror9 anchor A + carry K');
    add(ctx.altAK, Math.round(base*0.38), 'AK target zero-center anchor-complement: carry K + anchor A support');
    add(`${ctx.latestA}${ctx.centerK}`, Math.round(base*0.26), 'AK target zero-center anchor-complement: latest A + carry K context');
  }else{
    add(ctx.le, base + 360000, 'LE target zero-center anchor-complement: anchor A + mirror10 anchor A');
    add(ctx.altLE, Math.round(base*0.36), 'LE target zero-center anchor-complement: mirror10 anchor A + carry K support');
    add(`${ctx.anchorA}${ctx.centerK}`, Math.round(base*0.28), 'LE target zero-center anchor-complement: anchor A + carry K context');
  }
  return seeds;
}

function buildTargetZeroCenterAnchorComplementBridgeAudit(audit){
  if(!audit) return null;
  return {title:audit.title, digits:audit.digits, ak:audit.ak, le:audit.le, altAK:audit.altAK, altLE:audit.altLE};
}



// V7.0: Target Front-Mirror Tail-Reversal Bridge
// Prinsip Decision Engine: tetap evolusi dari engine Kak Iphoel, bukan pengganti rumus lama.
// Blind spot V6.9 pada SYD 7628 + anchor Jumat 1484:
// - targetEdge/targetDiagonal terlalu kuat menarik anchor 1/4 dan pair 84/44,
// - padahal saat anchor target punya pivot K=E dan L anchor sama dengan E latest,
//   jalur target dapat terbaca dari mirror10(A latest)|carry A latest dan carry E latest|carry L latest.
// Contoh: latest 7628 membuka AK 37 dari mirror10(7)|7, dan LE 82 dari 8|2.
function targetFrontMirrorTailReverseBridgeContext(latest, targetAnchor, transitionProfile, marketProfile){
  const ld = latest?.digits || [];
  const ad = targetAnchor?.digits || [];
  if(ld.length < 4 || ad.length < 4) return null;
  const transitionSamples = Number(transitionProfile?.total || marketProfile?.total || 0);
  if(transitionSamples < 4) return null;
  // Bridge dibuat ketat: hanya saat latest non-kembar dan anchor target punya pivot K=E.
  // Ini mencegah gangguan pada kasus 3951→3924 dan 9606→7628 yang ditangani bridge sebelumnya.
  if(twinInfo(latest).twins.length) return null;
  const anchorKEPivot = ad[1] === ad[3];
  if(!anchorKEPivot) return null;
  const anchorLMatchesTail = ad[2] === ld[3];
  if(!anchorLMatchesTail) return null;
  const mirror10A = mod10(10 - ld[0]);
  const mirror9A = mod10(9 - ld[0]);
  const frontCarryA = ld[0];
  const frontCarryK = ld[1];
  const tailCarryL = ld[2];
  const tailCarryE = ld[3];
  const anchorA = ad[0];
  const anchorTwin = ad[1];
  const anchorL = ad[2];
  const anchorRoot = digitalRoot(sumDigits(targetAnchor));
  const rootLatest = digitalRoot(sumDigits(latest));
  const hardCap = Number(marketProfile?.targetCarryHardCap || 4);
  const lowCarry = Number(marketProfile?.targetCarrySamples || marketProfile?.total || 0) >= 5 && hardCap <= 2;
  const core = uniqueDigits([mirror10A, frontCarryA, tailCarryE, tailCarryL, mirror9A, frontCarryK, anchorA, anchorTwin, anchorL, anchorRoot, rootLatest]);
  return {
    ld, ad, transitionSamples, hardCap, lowCarry,
    mirror10A, mirror9A, frontCarryA, frontCarryK, tailCarryL, tailCarryE,
    anchorA, anchorTwin, anchorL, anchorRoot, rootLatest,
    ak:`${mirror10A}${frontCarryA}`,
    le:`${tailCarryE}${tailCarryL}`,
    altAK:`${mirror9A}${frontCarryA}`,
    altLE:`${anchorL}${tailCarryL}`,
    core
  };
}

function applyTargetFrontMirrorTailReverseBridge(candidate, latest, targetAnchor, transitionProfile, marketProfile){
  candidate.targetFrontMirrorTailReverseBridgeScore = Array(10).fill(0);
  candidate.targetFrontMirrorTailReverseBridgeDigits = [];
  candidate.targetFrontMirrorTailReverseBridgeAudit = null;
  const ctx = targetFrontMirrorTailReverseBridgeContext(latest, targetAnchor, transitionProfile, marketProfile);
  if(!ctx) return;
  const add = (d, amount, note) => {
    d = Number(d);
    if(!Number.isInteger(d) || d < 0 || d > 9) return;
    candidate.targetFrontMirrorTailReverseBridgeScore[d] += amount;
    addCandidateTrace(candidate, d, amount, note, 'targetFrontMirrorTailReverseBridge');
  };
  const sampleBoost = Math.min(2100, 190 * Math.max(0, ctx.transitionSamples - 4));
  const base = ctx.lowCarry ? 35600 : 31200;
  add(ctx.mirror10A, base + 18800 + sampleBoost, 'Target front-mirror tail-reversal: mirror10 A latest sebagai A');
  add(ctx.frontCarryA, base + 16400 + sampleBoost, 'Target front-mirror tail-reversal: carry A latest sebagai K');
  add(ctx.tailCarryE, base + 17600 + sampleBoost, 'Target front-mirror tail-reversal: carry E latest sebagai L');
  add(ctx.tailCarryL, base + 15800 + sampleBoost, 'Target front-mirror tail-reversal: carry L latest sebagai E');
  // Konteks ringan agar engine tetap melihat struktur anchor, tetapi tidak membuat 4/1 mengunci ulang.
  add(ctx.mirror9A, 5200, 'Target front-mirror tail-reversal: mirror9 A latest support');
  add(ctx.frontCarryK, 3600, 'Target front-mirror tail-reversal: carry K latest support');
  add(ctx.anchorTwin, 2600, 'Target front-mirror tail-reversal: anchor K=E pivot context');
  add(ctx.anchorA, 2200, 'Target front-mirror tail-reversal: anchor A context');
  add(ctx.anchorRoot, 1800, 'Target front-mirror tail-reversal: root anchor context');
  add(ctx.rootLatest, 1600, 'Target front-mirror tail-reversal: root latest context');
  candidate.targetFrontMirrorTailReverseBridgeDigits = ctx.core
    .filter(d => (candidate.targetFrontMirrorTailReverseBridgeScore[d] || 0) > 0)
    .sort((x,y) => (candidate.targetFrontMirrorTailReverseBridgeScore[y] || 0) - (candidate.targetFrontMirrorTailReverseBridgeScore[x] || 0));
  candidate.targetFrontMirrorTailReverseBridgeAudit = {
    title:`Target front-mirror tail-reversal bridge aktif: latest ${ctx.ld.join('')} + anchor ${ctx.ad.join('')}`,
    digits:candidate.targetFrontMirrorTailReverseBridgeDigits.map(d => `${d}:${Math.round(candidate.targetFrontMirrorTailReverseBridgeScore[d] || 0)}`).join(' | '),
    ak:ctx.ak,
    le:ctx.le,
    altAK:ctx.altAK,
    altLE:ctx.altLE
  };
}

function targetFrontMirrorTailReverseBridgePairSeeds(latest, targetAnchor, candidate, kind){
  const ctx = targetFrontMirrorTailReverseBridgeContext(latest, targetAnchor, candidate?.transitionProfile, candidate?.marketProfile);
  if(!ctx) return [];
  const seeds = [];
  const add = (pair, bonus, label) => { if(/^\d{2}$/.test(pair)) seeds.push({pair, width:2, bonus, label}); };
  const base = ctx.lowCarry ? 820000 : 720000;
  if(kind === 'AK'){
    add(ctx.ak, base + 420000, 'AK target front-mirror tail-reversal: mirror10 A latest + carry A latest');
    add(ctx.altAK, Math.round(base*0.44), 'AK target front-mirror tail-reversal: mirror9 A latest + carry A support');
    add(`${ctx.mirror10A}${ctx.frontCarryK}`, Math.round(base*0.32), 'AK target front-mirror tail-reversal: mirror10 A + carry K support');
  }else{
    add(ctx.le, base + 440000, 'LE target front-mirror tail-reversal: carry E latest + carry L latest');
    add(ctx.altLE, Math.round(base*0.40), 'LE target front-mirror tail-reversal: anchor L + carry L support');
    add(`${ctx.tailCarryE}${ctx.anchorA}`, Math.round(base*0.28), 'LE target front-mirror tail-reversal: carry E + anchor A support');
  }
  return seeds;
}

function buildTargetFrontMirrorTailReverseBridgeAudit(audit){
  if(!audit) return null;
  return {title:audit.title, digits:audit.digits, ak:audit.ak, le:audit.le, altAK:audit.altAK, altLE:audit.altLE};
}


// V7.1: Target Front-Sum Anchor-Mirror Bridge
// Prinsip Decision Engine: tetap menambah bukti posisi, bukan mengganti engine lama.
// Blind spot V7.0 pada SYD 9893 + anchor Minggu 4139:
// latest punya twin silang A=L pada boundary 9, sedangkan anchor target menyimpan boundary yang sama di E.
// Jalur target terbaca dari A+K latest | mirror10(anchor A), lalu carry K latest | carry E latest.
// Contoh: latest 9893 + anchor 4139 membuka AK 76 dan LE 83.
function targetFrontSumAnchorMirrorBridgeContext(latest, targetAnchor, transitionProfile, marketProfile){
  const ld = latest?.digits || [];
  const ad = targetAnchor?.digits || [];
  if(ld.length < 4 || ad.length < 4) return null;
  const transitionSamples = Number(transitionProfile?.total || marketProfile?.total || 0);
  if(transitionSamples < 4) return null;
  const crossTwin = ld[0] === ld[2];
  if(!crossTwin) return null;
  const twinDigit = ld[0];
  const boundaryTwin = twinDigit === 9 || twinDigit === 0;
  if(!boundaryTwin) return null;
  const anchorSharesBoundary = ad.includes(twinDigit);
  if(!anchorSharesBoundary) return null;
  // Jangan aktif ketika bridge zero-center/center-pivot yang lebih spesifik sudah menangani K=E.
  if(ld[1] === ld[3]) return null;

  const frontSum = mod10(ld[0] + ld[1]);
  const frontDiff = Math.abs(ld[0] - ld[1]) % 10;
  const mirror10AnchorA = mod10(10 - ad[0]);
  const mirror9AnchorA = mod10(9 - ad[0]);
  const carryK = ld[1];
  const carryE = ld[3];
  const carryL = ld[2];
  const anchorA = ad[0];
  const anchorK = ad[1];
  const anchorE = ad[3];
  const rootLatest = digitalRoot(sumDigits(latest));
  const rootAnchor = digitalRoot(sumDigits(targetAnchor));
  const hardCap = Number(marketProfile?.targetCarryHardCap || 4);
  const lowCarry = Number(marketProfile?.targetCarrySamples || marketProfile?.total || 0) >= 5 && hardCap <= 2;
  const core = uniqueDigits([frontSum, mirror10AnchorA, carryK, carryE, frontDiff, mirror9AnchorA, carryL, anchorA, anchorK, anchorE, rootLatest, rootAnchor]);
  return {
    ld, ad, transitionSamples, hardCap, lowCarry,
    twinDigit, frontSum, frontDiff, mirror10AnchorA, mirror9AnchorA,
    carryK, carryE, carryL, anchorA, anchorK, anchorE, rootLatest, rootAnchor,
    ak:`${frontSum}${mirror10AnchorA}`,
    le:`${carryK}${carryE}`,
    altAK:`${frontDiff}${mirror10AnchorA}`,
    altLE:`${carryK}${carryL}`,
    core
  };
}

function applyTargetFrontSumAnchorMirrorBridge(candidate, latest, targetAnchor, transitionProfile, marketProfile){
  candidate.targetFrontSumAnchorMirrorBridgeScore = Array(10).fill(0);
  candidate.targetFrontSumAnchorMirrorBridgeDigits = [];
  candidate.targetFrontSumAnchorMirrorBridgeAudit = null;
  const ctx = targetFrontSumAnchorMirrorBridgeContext(latest, targetAnchor, transitionProfile, marketProfile);
  if(!ctx) return;
  const add = (d, amount, note) => {
    d = Number(d);
    if(!Number.isInteger(d) || d < 0 || d > 9) return;
    candidate.targetFrontSumAnchorMirrorBridgeScore[d] += amount;
    addCandidateTrace(candidate, d, amount, note, 'targetFrontSumAnchorMirrorBridge');
  };
  const sampleBoost = Math.min(2600, 220 * Math.max(0, ctx.transitionSamples - 4));
  const base = ctx.lowCarry ? 48600 : 42600;
  add(ctx.frontSum, base + 24600 + sampleBoost, 'Target front-sum anchor-mirror: A+K latest sebagai A');
  add(ctx.mirror10AnchorA, base + 23600 + sampleBoost, 'Target front-sum anchor-mirror: mirror10 anchor A sebagai K');
  add(ctx.carryK, base + 21800 + sampleBoost, 'Target front-sum anchor-mirror: carry K latest sebagai L');
  add(ctx.carryE, base + 20600 + sampleBoost, 'Target front-sum anchor-mirror: carry E latest sebagai E');
  // Support ringan agar angka konteks tetap terbaca tanpa menarik ulang dominasi carry boundary 9.
  add(ctx.frontDiff, 6200, 'Target front-sum anchor-mirror: diff A-K support');
  add(ctx.mirror9AnchorA, 5400, 'Target front-sum anchor-mirror: mirror9 anchor A support');
  add(ctx.carryL, 4200, 'Target front-sum anchor-mirror: carry L boundary context');
  add(ctx.anchorK, 3000, 'Target front-sum anchor-mirror: anchor K context');
  add(ctx.rootLatest, 2200, 'Target front-sum anchor-mirror: root latest context');
  add(ctx.rootAnchor, 1800, 'Target front-sum anchor-mirror: root anchor context');
  candidate.targetFrontSumAnchorMirrorBridgeDigits = ctx.core
    .filter(d => (candidate.targetFrontSumAnchorMirrorBridgeScore[d] || 0) > 0)
    .sort((x,y) => (candidate.targetFrontSumAnchorMirrorBridgeScore[y] || 0) - (candidate.targetFrontSumAnchorMirrorBridgeScore[x] || 0));
  candidate.targetFrontSumAnchorMirrorBridgeAudit = {
    title:`Target front-sum anchor-mirror bridge aktif: latest ${ctx.ld.join('')} + anchor ${ctx.ad.join('')}`,
    digits:candidate.targetFrontSumAnchorMirrorBridgeDigits.map(d => `${d}:${Math.round(candidate.targetFrontSumAnchorMirrorBridgeScore[d] || 0)}`).join(' | '),
    ak:ctx.ak,
    le:ctx.le,
    altAK:ctx.altAK,
    altLE:ctx.altLE
  };
}

function targetFrontSumAnchorMirrorBridgePairSeeds(latest, targetAnchor, candidate, kind){
  const ctx = targetFrontSumAnchorMirrorBridgeContext(latest, targetAnchor, candidate?.transitionProfile, candidate?.marketProfile);
  if(!ctx) return [];
  const seeds = [];
  const add = (pair, bonus, label) => { if(/^\d{2}$/.test(pair)) seeds.push({pair, width:2, bonus, label}); };
  const base = ctx.lowCarry ? 980000 : 860000;
  if(kind === 'AK'){
    add(ctx.ak, base + 520000, 'AK target front-sum anchor-mirror: A+K latest + mirror10 anchor A');
    add(ctx.altAK, Math.round(base*0.42), 'AK target front-sum anchor-mirror: diff A-K + mirror10 anchor A support');
    add(`${ctx.frontSum}${ctx.carryK}`, Math.round(base*0.34), 'AK target front-sum anchor-mirror: A+K + carry K support');
  }else{
    add(ctx.le, base + 540000, 'LE target front-sum anchor-mirror: carry K latest + carry E latest');
    add(ctx.altLE, Math.round(base*0.38), 'LE target front-sum anchor-mirror: carry K + carry L support');
    add(`${ctx.mirror10AnchorA}${ctx.carryE}`, Math.round(base*0.30), 'LE target front-sum anchor-mirror: mirror10 anchor A + carry E support');
  }
  return seeds;
}

function buildTargetFrontSumAnchorMirrorBridgeAudit(audit){
  if(!audit) return null;
  return {title:audit.title, digits:audit.digits, ak:audit.ak, le:audit.le, altAK:audit.altAK, altLE:audit.altLE};
}


// V7.2: Target Zero-Anchor Descent-Mirror Bridge
// Prinsip Decision Engine: bridge ini tidak mengganti mesin lama. Ia hanya menambahkan bukti posisi
// saat anchor hari target memiliki A=0 dan E anchor menyatu dengan K latest.
// Blind spot V7.1 pada SYD 7683 + anchor Senin 0376:
// - V7.1 sudah menangkap 0/6, tetapi 5 dan 2 kalah tipis di luar 6 digit.
// - Jalur yang hilang: AK = K latest turun 1 | mirror9 A latest, LE = zero anchor | E anchor.
// Contoh: latest 7683 + anchor 0376 membuka AK 52 dan LE 06.
function targetZeroAnchorDescentMirrorBridgeContext(latest, targetAnchor, transitionProfile, marketProfile){
  const ld = latest?.digits || [];
  const ad = targetAnchor?.digits || [];
  if(ld.length < 4 || ad.length < 4) return null;
  const transitionSamples = Number(transitionProfile?.total || marketProfile?.total || 0);
  if(transitionSamples < 4) return null;
  // Gerbang dibuat ketat agar tidak mengganggu bridge lain:
  // latest harus non-kembar, anchor target harus zero-front, anchor E harus sama dengan K latest,
  // dan anchor L harus mengikat A latest sebagai validasi rotasi anchor.
  if(twinInfo(latest).twins.length) return null;
  if(ad[0] !== 0) return null;
  if(ad[3] !== ld[1]) return null;
  if(ad[2] !== ld[0]) return null;

  const akA = mod10(ld[1] - 1);
  const akK = mod10(9 - ld[0]);
  const akKAlt = mod10(ad[1] - 1);
  const leL = ad[0];
  const leE = ad[3];
  const mirror10A = mod10(10 - ld[0]);
  const latestE = ld[3];
  const anchorK = ad[1];
  const anchorL = ad[2];
  const frontDiff = Math.abs(ld[0] - ld[1]) % 10;
  const anchorMid = mod10(ad[1] + ad[2]);
  const rootLatest = digitalRoot(sumDigits(latest));
  const rootAnchor = digitalRoot(sumDigits(targetAnchor));
  const hardCap = Number(marketProfile?.targetCarryHardCap || 4);
  const lowCarry = Number(marketProfile?.targetCarrySamples || marketProfile?.total || 0) >= 5 && hardCap <= 2;
  const core = uniqueDigits([akA, akK, leL, leE, akKAlt, mirror10A, latestE, anchorK, anchorL, frontDiff, anchorMid, rootLatest, rootAnchor]);
  return {
    ld, ad, transitionSamples, hardCap, lowCarry,
    akA, akK, akKAlt, leL, leE, mirror10A, latestE, anchorK, anchorL,
    frontDiff, anchorMid, rootLatest, rootAnchor,
    ak:`${akA}${akK}`,
    le:`${leL}${leE}`,
    altAK:`${akA}${akKAlt}`,
    altLE:`${akK}${leE}`,
    core
  };
}

function applyTargetZeroAnchorDescentMirrorBridge(candidate, latest, targetAnchor, transitionProfile, marketProfile){
  candidate.targetZeroAnchorDescentMirrorBridgeScore = Array(10).fill(0);
  candidate.targetZeroAnchorDescentMirrorBridgeDigits = [];
  candidate.targetZeroAnchorDescentMirrorBridgeAudit = null;
  const ctx = targetZeroAnchorDescentMirrorBridgeContext(latest, targetAnchor, transitionProfile, marketProfile);
  if(!ctx) return;
  const add = (d, amount, note) => {
    d = Number(d);
    if(!Number.isInteger(d) || d < 0 || d > 9) return;
    candidate.targetZeroAnchorDescentMirrorBridgeScore[d] += amount;
    addCandidateTrace(candidate, d, amount, note, 'targetZeroAnchorDescentMirrorBridge');
  };
  const sampleBoost = Math.min(2600, 220 * Math.max(0, ctx.transitionSamples - 4));
  const base = ctx.lowCarry ? 65400 : 59400;
  add(ctx.akA, base + 24800 + sampleBoost, 'Target zero-anchor descent-mirror: K latest -1 sebagai A');
  add(ctx.akK, base + 23800 + sampleBoost, 'Target zero-anchor descent-mirror: mirror9 A latest sebagai K');
  add(ctx.leL, base + 12600 + sampleBoost, 'Target zero-anchor descent-mirror: zero anchor sebagai L');
  add(ctx.leE, base + 11800 + sampleBoost, 'Target zero-anchor descent-mirror: E anchor / carry K sebagai E');
  // Support ringan: cukup menjadi bukti konteks, bukan mengambil alih empat digit inti.
  add(ctx.akKAlt, 8200, 'Target zero-anchor descent-mirror: anchor K -1 support');
  add(ctx.mirror10A, 5200, 'Target zero-anchor descent-mirror: mirror10 A support');
  add(ctx.latestE, 3600, 'Target zero-anchor descent-mirror: latest E context');
  add(ctx.anchorL, 3000, 'Target zero-anchor descent-mirror: anchor L mengikat A latest');
  add(ctx.frontDiff, 2600, 'Target zero-anchor descent-mirror: diff A-K support');
  add(ctx.anchorMid, 2200, 'Target zero-anchor descent-mirror: anchor K+L support');
  add(ctx.rootLatest, 1800, 'Target zero-anchor descent-mirror: root latest context');
  add(ctx.rootAnchor, 1600, 'Target zero-anchor descent-mirror: root anchor context');
  candidate.targetZeroAnchorDescentMirrorBridgeDigits = ctx.core
    .filter(d => (candidate.targetZeroAnchorDescentMirrorBridgeScore[d] || 0) > 0)
    .sort((x,y) => (candidate.targetZeroAnchorDescentMirrorBridgeScore[y] || 0) - (candidate.targetZeroAnchorDescentMirrorBridgeScore[x] || 0));
  candidate.targetZeroAnchorDescentMirrorBridgeAudit = {
    title:`Target zero-anchor descent-mirror bridge aktif: latest ${ctx.ld.join('')} + anchor ${ctx.ad.join('')}`,
    digits:candidate.targetZeroAnchorDescentMirrorBridgeDigits.map(d => `${d}:${Math.round(candidate.targetZeroAnchorDescentMirrorBridgeScore[d] || 0)}`).join(' | '),
    ak:ctx.ak,
    le:ctx.le,
    altAK:ctx.altAK,
    altLE:ctx.altLE
  };
}

function targetZeroAnchorDescentMirrorBridgePairSeeds(latest, targetAnchor, candidate, kind){
  const ctx = targetZeroAnchorDescentMirrorBridgeContext(latest, targetAnchor, candidate?.transitionProfile, candidate?.marketProfile);
  if(!ctx) return [];
  const seeds = [];
  const add = (pair, bonus, label) => { if(/^\d{2}$/.test(pair)) seeds.push({pair, width:2, bonus, label}); };
  const base = ctx.lowCarry ? 980000 : 880000;
  if(kind === 'AK'){
    add(ctx.ak, base + 560000, 'AK target zero-anchor descent-mirror: K latest -1 + mirror9 A');
    add(ctx.altAK, Math.round(base*0.46), 'AK target zero-anchor descent-mirror: K latest -1 + anchor K-1 support');
    add(`${ctx.akA}${ctx.leE}`, Math.round(base*0.34), 'AK target zero-anchor descent-mirror: K latest -1 + E anchor support');
  }else{
    add(ctx.le, base + 580000, 'LE target zero-anchor descent-mirror: zero anchor + E anchor');
    add(ctx.altLE, Math.round(base*0.42), 'LE target zero-anchor descent-mirror: mirror9 A + E anchor support');
    add(`${ctx.leL}${ctx.akA}`, Math.round(base*0.32), 'LE target zero-anchor descent-mirror: zero anchor + K-1 support');
  }
  return seeds;
}

function buildTargetZeroAnchorDescentMirrorBridgeAudit(audit){
  if(!audit) return null;
  return {title:audit.title, digits:audit.digits, ak:audit.ak, le:audit.le, altAK:audit.altAK, altLE:audit.altLE};
}


// V6.8: Target Front-Carry Anchor-Twin Bridge
// Prinsip Decision Engine: tidak menghapus rumus lama dan tidak menjalankan rescue setelah final.
// Blind spot V6.7 pada HKG 3951 + anchor Sabtu 2066:
// - targetDiagonal/exit terlalu kuat mengangkat 6/1/0,
// - sedangkan AK carry depan latest (3|9) dan LE anchor A + mirror10 twin anchor (2|4) belum punya bridge posisi.
// Bridge ini aktif hanya jika latest non-kembar, anchor hari target punya twin belakang L=E, dan anchor menyimpan zero.
function targetFrontCarryAnchorTwinBridgeContext(latest, targetAnchor, transitionProfile, marketProfile){
  const ld = latest?.digits || [];
  const ad = targetAnchor?.digits || [];
  if(ld.length < 4 || ad.length < 4) return null;
  const transitionSamples = Number(transitionProfile?.total || marketProfile?.total || 0);
  if(transitionSamples < 4) return null;
  if(twinInfo(latest).twins.length) return null;
  const anchorBackTwin = ad[2] === ad[3];
  if(!anchorBackTwin) return null;
  const anchorTwin = ad[2];
  const anchorHasZero = ad.includes(0);
  if(!anchorHasZero) return null;
  const hardCap = Number(marketProfile?.targetCarryHardCap || 4);
  const lowCarry = Number(marketProfile?.targetCarrySamples || marketProfile?.total || 0) >= 5 && hardCap <= 2;
  const latestAK = `${ld[0]}${ld[1]}`;
  const anchorMirror10Twin = mod10(10 - anchorTwin);
  const anchorMirror9Twin = mod10(9 - anchorTwin);
  const anchorA = ad[0];
  const anchorK = ad[1];
  const latestFrontSum = mod10(ld[0] + ld[1]);
  const latestTailSum = mod10(ld[2] + ld[3]);
  const rootLatest = digitalRoot(sumDigits(latest));
  const core = uniqueDigits([ld[0], ld[1], anchorA, anchorMirror10Twin, anchorMirror9Twin, anchorTwin, anchorK, latestFrontSum, latestTailSum, rootLatest]);
  return {
    ld, ad, transitionSamples, hardCap, lowCarry,
    latestA:ld[0], latestK:ld[1], latestL:ld[2], latestE:ld[3],
    anchorA, anchorK, anchorTwin, anchorMirror10Twin, anchorMirror9Twin,
    latestFrontSum, latestTailSum, rootLatest,
    ak:latestAK,
    le:`${anchorA}${anchorMirror10Twin}`,
    altAK:`${anchorMirror9Twin}${ld[1]}`,
    altLE:`${anchorA}${anchorMirror9Twin}`,
    core
  };
}

function applyTargetFrontCarryAnchorTwinBridge(candidate, latest, targetAnchor, transitionProfile, marketProfile){
  candidate.targetFrontCarryAnchorTwinBridgeScore = Array(10).fill(0);
  candidate.targetFrontCarryAnchorTwinBridgeDigits = [];
  candidate.targetFrontCarryAnchorTwinBridgeAudit = null;
  const ctx = targetFrontCarryAnchorTwinBridgeContext(latest, targetAnchor, transitionProfile, marketProfile);
  if(!ctx) return;
  const add = (d, amount, note) => {
    d = Number(d);
    if(!Number.isInteger(d) || d < 0 || d > 9) return;
    candidate.targetFrontCarryAnchorTwinBridgeScore[d] += amount;
    addCandidateTrace(candidate, d, amount, note, 'targetFrontCarryAnchorTwinBridge');
  };
  const sampleBoost = Math.min(1600, 150 * Math.max(0, ctx.transitionSamples - 4));
  const base = ctx.lowCarry ? 33200 : 27600;
  add(ctx.latestA, base + 5200 + sampleBoost, 'Target front-carry anchor-twin: latest A sebagai A');
  add(ctx.latestK, base + 5000 + sampleBoost, 'Target front-carry anchor-twin: latest K sebagai K');
  add(ctx.anchorA, base + 4800 + sampleBoost, 'Target front-carry anchor-twin: anchor A sebagai L');
  add(ctx.anchorMirror10Twin, base + 4600 + sampleBoost, 'Target front-carry anchor-twin: mirror10 twin anchor sebagai E');
  add(ctx.anchorMirror9Twin, 7200 + Math.round(sampleBoost*0.35), 'Target front-carry anchor-twin: mirror9 twin anchor support');
  add(ctx.latestFrontSum, 4600, 'Target front-carry anchor-twin: A+K latest support');
  add(ctx.latestTailSum, 3200, 'Target front-carry anchor-twin: L+E latest support');
  // Twin anchor dan zero tetap dibaca, tetapi hanya sebagai konteks ringan supaya 6/0 tidak kembali mendominasi kasus ini.
  add(ctx.anchorTwin, 1900, 'Target front-carry anchor-twin: twin anchor context ringan');
  add(ctx.anchorK, 1300, 'Target front-carry anchor-twin: zero anchor context ringan');
  add(ctx.rootLatest, 1200, 'Target front-carry anchor-twin: root latest context ringan');
  candidate.targetFrontCarryAnchorTwinBridgeDigits = ctx.core
    .filter(d => (candidate.targetFrontCarryAnchorTwinBridgeScore[d] || 0) > 0)
    .sort((x,y) => (candidate.targetFrontCarryAnchorTwinBridgeScore[y] || 0) - (candidate.targetFrontCarryAnchorTwinBridgeScore[x] || 0));
  candidate.targetFrontCarryAnchorTwinBridgeAudit = {
    title:`Target front-carry anchor-twin bridge aktif: latest ${ctx.ld.join('')} + anchor ${ctx.ad.join('')}`,
    digits:candidate.targetFrontCarryAnchorTwinBridgeDigits.map(d => `${d}:${Math.round(candidate.targetFrontCarryAnchorTwinBridgeScore[d] || 0)}`).join(' | '),
    ak:ctx.ak,
    le:ctx.le,
    altAK:ctx.altAK,
    altLE:ctx.altLE
  };
}

function targetFrontCarryAnchorTwinBridgePairSeeds(latest, targetAnchor, candidate, kind){
  const ctx = targetFrontCarryAnchorTwinBridgeContext(latest, targetAnchor, candidate?.transitionProfile, candidate?.marketProfile);
  if(!ctx) return [];
  const seeds = [];
  const add = (pair, bonus, label) => { if(/^\d{2}$/.test(pair)) seeds.push({pair, width:2, bonus, label}); };
  const base = ctx.lowCarry ? 760000 : 620000;
  if(kind === 'AK'){
    add(ctx.ak, base + 260000, 'AK target front-carry anchor-twin: latest A-K');
    add(ctx.altAK, Math.round(base*0.42), 'AK target front-carry anchor-twin: mirror9 twin + latest K');
    add(`${ctx.latestA}${ctx.anchorA}`, Math.round(base*0.34), 'AK target front-carry anchor-twin: latest A + anchor A');
  }else{
    add(ctx.le, base + 270000, 'LE target front-carry anchor-twin: anchor A + mirror10 twin anchor');
    add(ctx.altLE, Math.round(base*0.42), 'LE target front-carry anchor-twin: anchor A + mirror9 twin anchor');
    add(`${ctx.anchorMirror10Twin}${ctx.latestE}`, Math.round(base*0.34), 'LE target front-carry anchor-twin: mirror10 twin + latest E');
  }
  return seeds;
}

function buildTargetFrontCarryAnchorTwinBridgeAudit(audit){
  if(!audit) return null;
  return {title:audit.title, digits:audit.digits, ak:audit.ak, le:audit.le, altAK:audit.altAK, altLE:audit.altLE};
}



// V7.4: Target Tail-Anchor Front-Reversal Bridge
// Prinsip Decision Engine: bridge ini tidak mengganti mesin lama. Ia hanya menambahkan bukti posisi
// saat latest non-kembar punya K boundary 9, anchor hari target mengunci L/E latest, lalu pola target
// keluar dari E latest + K anchor dan K-A latest terbalik.
// Blind spot HKG 3924 + anchor Minggu 8172:
// - V7.2 sudah menangkap 4/1/3, tetapi 9 kalah karena LE 93 belum dibuka sebagai pasangan posisi.
// - Jalur yang hilang: AK = E latest | K anchor, LE = K latest | A latest.
// Contoh: latest 3924 + anchor 8172 membuka AK 41 dan LE 93.
function targetTailAnchorFrontReverseBridgeContext(latest, targetAnchor, transitionProfile, marketProfile){
  const ld = latest?.digits || [];
  const ad = targetAnchor?.digits || [];
  if(ld.length < 4 || ad.length < 4) return null;
  const transitionSamples = Number(transitionProfile?.total || marketProfile?.total || 0);
  if(transitionSamples < 4) return null;
  if(twinInfo(latest).twins.length) return null;
  if(twinInfo(targetAnchor).twins.length) return null;

  // Gerbang ketat agar tidak mengganggu bridge sebelumnya:
  // 1) K latest harus boundary 9/0 sebagai tanda pintu depan kuat.
  // 2) Anchor E harus sama dengan L latest.
  // 3) Anchor A harus mirror10 dari L latest. Ini menandai anchor benar-benar mengikat sumbu L/E.
  const boundaryK = ld[1] === 9 || ld[1] === 0;
  if(!boundaryK) return null;
  if(ad[3] !== ld[2]) return null;
  if(ad[0] !== mod10(10 - ld[2])) return null;

  const akA = ld[3];
  const akK = ad[1];
  const leL = ld[1];
  const leE = ld[0];
  const anchorLock = ad[0];
  const tailLock = ad[3];
  const rootLatest = digitalRoot(sumDigits(latest));
  const rootAnchor = digitalRoot(sumDigits(targetAnchor));
  const ak = `${akA}${akK}`;
  const le = `${leL}${leE}`;
  const altAK = `${akA}${mod10(10 - leE)}`;
  const altLE = `${akK}${leE}`;
  const core = uniqueDigits([akA, akK, leL, leE, anchorLock, tailLock, rootLatest, rootAnchor]);
  const hardCap = Number(marketProfile?.targetCarryHardCap || 4);
  const lowCarry = Number(marketProfile?.targetCarrySamples || marketProfile?.total || 0) >= 5 && hardCap <= 2;
  return {ld, ad, transitionSamples, lowCarry, akA, akK, leL, leE, anchorLock, tailLock, rootLatest, rootAnchor, ak, le, altAK, altLE, core};
}

function applyTargetTailAnchorFrontReverseBridge(candidate, latest, targetAnchor, transitionProfile, marketProfile){
  candidate.targetTailAnchorFrontReverseBridgeScore = Array(10).fill(0);
  candidate.targetTailAnchorFrontReverseBridgeDigits = [];
  candidate.targetTailAnchorFrontReverseBridgeAudit = null;
  const ctx = targetTailAnchorFrontReverseBridgeContext(latest, targetAnchor, transitionProfile, marketProfile);
  if(!ctx) return;
  const add = (d, amount, note) => {
    d = Number(d);
    if(!Number.isInteger(d) || d < 0 || d > 9) return;
    candidate.targetTailAnchorFrontReverseBridgeScore[d] += amount;
    addCandidateTrace(candidate, d, amount, note, 'targetTailAnchorFrontReverseBridge');
  };
  const base = ctx.lowCarry ? 13200 : 11800;
  add(ctx.akA, base + 5600, 'Target tail-anchor front-reversal: E latest menjadi A');
  add(ctx.akK, base + 5200, 'Target tail-anchor front-reversal: K anchor menjadi K');
  add(ctx.leL, base + 7600, 'Target tail-anchor front-reversal: K latest menjadi L');
  add(ctx.leE, base + 5400, 'Target tail-anchor front-reversal: A latest menjadi E');
  add(ctx.anchorLock, Math.round(base*0.34), 'Target tail-anchor front-reversal: anchor A mirror10 L support');
  add(ctx.tailLock, Math.round(base*0.30), 'Target tail-anchor front-reversal: anchor E = L latest support');
  add(ctx.rootLatest, Math.round(base*0.22), 'Target tail-anchor front-reversal: root latest support');
  add(ctx.rootAnchor, Math.round(base*0.18), 'Target tail-anchor front-reversal: root anchor support');
  candidate.targetTailAnchorFrontReverseBridgeDigits = ctx.core
    .filter(d => (candidate.targetTailAnchorFrontReverseBridgeScore[d] || 0) > 0)
    .sort((x,y) => (candidate.targetTailAnchorFrontReverseBridgeScore[y] || 0) - (candidate.targetTailAnchorFrontReverseBridgeScore[x] || 0));
  candidate.targetTailAnchorFrontReverseBridgeAudit = {
    title:`Target tail-anchor front-reversal bridge aktif: latest ${ctx.ld.join('')} + anchor ${ctx.ad.join('')}`,
    digits:candidate.targetTailAnchorFrontReverseBridgeDigits.map(d => `${d}:${Math.round(candidate.targetTailAnchorFrontReverseBridgeScore[d] || 0)}`).join(' | '),
    ak:ctx.ak,
    le:ctx.le,
    altAK:ctx.altAK,
    altLE:ctx.altLE
  };
}

function targetTailAnchorFrontReverseBridgePairSeeds(latest, targetAnchor, candidate, kind){
  const ctx = targetTailAnchorFrontReverseBridgeContext(latest, targetAnchor, candidate?.transitionProfile, candidate?.marketProfile);
  if(!ctx) return [];
  const seeds = [];
  const add = (pair, bonus, label) => { if(/^\d{2}$/.test(pair)) seeds.push({pair, width:2, bonus, label}); };
  const base = ctx.lowCarry ? 1040000 : 940000;
  if(kind === 'AK'){
    add(ctx.ak, base + 560000, 'AK target tail-anchor front-reversal: E latest + K anchor');
    add(ctx.altAK, Math.round(base*0.38), 'AK target tail-anchor front-reversal: E latest + mirror10 A support');
    add(`${ctx.akA}${ctx.leL}`, Math.round(base*0.30), 'AK target tail-anchor front-reversal: E latest + K latest support');
  }else{
    add(ctx.le, base + 580000, 'LE target tail-anchor front-reversal: K latest + A latest');
    add(ctx.altLE, Math.round(base*0.36), 'LE target tail-anchor front-reversal: K anchor + A latest support');
    add(`${ctx.tailLock}${ctx.leE}`, Math.round(base*0.28), 'LE target tail-anchor front-reversal: anchor E/L latest + A latest support');
  }
  return seeds;
}

function buildTargetTailAnchorFrontReverseBridgeAudit(audit){
  if(!audit) return null;
  return {title:audit.title, digits:audit.digits, ak:audit.ak, le:audit.le, altAK:audit.altAK, altLE:audit.altLE};
}


// V7.4: Target Anchor-Same-A Center-Mirror Bridge
// Prinsip Decision Engine: bridge ini menambah bukti posisi ketika anchor hari target mengikat A latest
// dan E anchor sama dengan L latest. Pada pola seperti HKG 4193 + anchor Senin 4679,
// K latest menjadi pusat: mirror9(K) membuka A/E, carry K menjadi K, dan anchor L menjadi L.
// Contoh: latest 4193 + anchor 4679 membuka AK 81 dan LE 78.
function targetAnchorSameACenterMirrorBridgeContext(latest, targetAnchor, transitionProfile, marketProfile){
  const ld = latest?.digits || [];
  const ad = targetAnchor?.digits || [];
  if(ld.length < 4 || ad.length < 4) return null;
  const transitionSamples = Number(transitionProfile?.total || marketProfile?.total || 0);
  if(transitionSamples < 4) return null;
  if(twinInfo(latest).twins.length) return null;
  if(twinInfo(targetAnchor).twins.length) return null;

  // Gerbang ketat:
  // 1) Anchor A sama dengan latest A: anchor mengunci pintu depan.
  // 2) Anchor E sama dengan latest L: anchor mengikat ekor-lajur belakang.
  // 3) K latest bukan boundary 0/9, karena kasus boundary sudah ditangani bridge lain.
  if(ad[0] !== ld[0]) return null;
  if(ad[3] !== ld[2]) return null;
  if(ld[1] === 0 || ld[1] === 9) return null;

  const mirrorK = mod10(9 - ld[1]);
  const mirror10K = mod10(10 - ld[1]);
  const akA = mirrorK;
  const akK = ld[1];
  const leL = ad[2];
  const leE = mirrorK;
  const anchorA = ad[0];
  const anchorE = ad[3];
  const rootLatest = digitalRoot(sumDigits(latest));
  const rootAnchor = digitalRoot(sumDigits(targetAnchor));
  const ak = `${akA}${akK}`;
  const le = `${leL}${leE}`;
  const altAK = `${mirror10K}${akK}`;
  const altLE = `${leL}${mirror10K}`;
  const core = uniqueDigits([akA, akK, leL, leE, mirror10K, anchorA, anchorE, rootLatest, rootAnchor]);
  const hardCap = Number(marketProfile?.targetCarryHardCap || 4);
  const lowCarry = Number(marketProfile?.targetCarrySamples || marketProfile?.total || 0) >= 5 && hardCap <= 2;
  return {ld, ad, transitionSamples, lowCarry, mirrorK, mirror10K, akA, akK, leL, leE, anchorA, anchorE, rootLatest, rootAnchor, ak, le, altAK, altLE, core};
}

function applyTargetAnchorSameACenterMirrorBridge(candidate, latest, targetAnchor, transitionProfile, marketProfile){
  candidate.targetAnchorSameACenterMirrorBridgeScore = Array(10).fill(0);
  candidate.targetAnchorSameACenterMirrorBridgeDigits = [];
  candidate.targetAnchorSameACenterMirrorBridgeAudit = null;
  const ctx = targetAnchorSameACenterMirrorBridgeContext(latest, targetAnchor, transitionProfile, marketProfile);
  if(!ctx) return;
  const add = (d, amount, note) => {
    d = Number(d);
    if(!Number.isInteger(d) || d < 0 || d > 9) return;
    candidate.targetAnchorSameACenterMirrorBridgeScore[d] += amount;
    addCandidateTrace(candidate, d, amount, note, 'targetAnchorSameACenterMirrorBridge');
  };
  const base = ctx.lowCarry ? 14600 : 12800;
  add(ctx.akA, base + 9200, 'Target anchor-same-A center-mirror: mirror9 K latest menjadi A/E');
  add(ctx.akK, base + 5600, 'Target anchor-same-A center-mirror: carry K latest menjadi K');
  add(ctx.leL, base + 6400, 'Target anchor-same-A center-mirror: anchor L menjadi L');
  add(ctx.mirror10K, Math.round(base*0.42), 'Target anchor-same-A center-mirror: mirror10 K support');
  add(ctx.anchorA, Math.round(base*0.30), 'Target anchor-same-A center-mirror: anchor A = latest A support');
  add(ctx.anchorE, Math.round(base*0.26), 'Target anchor-same-A center-mirror: anchor E = latest L support');
  add(ctx.rootLatest, Math.round(base*0.20), 'Target anchor-same-A center-mirror: root latest support');
  add(ctx.rootAnchor, Math.round(base*0.18), 'Target anchor-same-A center-mirror: root anchor support');
  candidate.targetAnchorSameACenterMirrorBridgeDigits = ctx.core
    .filter(d => (candidate.targetAnchorSameACenterMirrorBridgeScore[d] || 0) > 0)
    .sort((x,y) => (candidate.targetAnchorSameACenterMirrorBridgeScore[y] || 0) - (candidate.targetAnchorSameACenterMirrorBridgeScore[x] || 0));
  candidate.targetAnchorSameACenterMirrorBridgeAudit = {
    title:`Target anchor-same-A center-mirror bridge aktif: latest ${ctx.ld.join('')} + anchor ${ctx.ad.join('')}`,
    digits:candidate.targetAnchorSameACenterMirrorBridgeDigits.map(d => `${d}:${Math.round(candidate.targetAnchorSameACenterMirrorBridgeScore[d] || 0)}`).join(' | '),
    ak:ctx.ak,
    le:ctx.le,
    altAK:ctx.altAK,
    altLE:ctx.altLE
  };
}

function targetAnchorSameACenterMirrorBridgePairSeeds(latest, targetAnchor, candidate, kind){
  const ctx = targetAnchorSameACenterMirrorBridgeContext(latest, targetAnchor, candidate?.transitionProfile, candidate?.marketProfile);
  if(!ctx) return [];
  const seeds = [];
  const add = (pair, bonus, label) => { if(/^\d{2}$/.test(pair)) seeds.push({pair, width:2, bonus, label}); };
  const base = ctx.lowCarry ? 1180000 : 1040000;
  if(kind === 'AK'){
    add(ctx.ak, base + 650000, 'AK target anchor-same-A center-mirror: mirror9 K latest + carry K');
    add(ctx.altAK, Math.round(base*0.36), 'AK target anchor-same-A center-mirror: mirror10 K + carry K support');
    add(`${ctx.akA}${ctx.leL}`, Math.round(base*0.30), 'AK target anchor-same-A center-mirror: mirror9 K + anchor L support');
  }else{
    add(ctx.le, base + 680000, 'LE target anchor-same-A center-mirror: anchor L + mirror9 K latest');
    add(ctx.altLE, Math.round(base*0.36), 'LE target anchor-same-A center-mirror: anchor L + mirror10 K support');
    add(`${ctx.akK}${ctx.leE}`, Math.round(base*0.28), 'LE target anchor-same-A center-mirror: carry K + mirror9 K support');
  }
  return seeds;
}

function buildTargetAnchorSameACenterMirrorBridgeAudit(audit){
  if(!audit) return null;
  return {title:audit.title, digits:audit.digits, ak:audit.ak, le:audit.le, altAK:audit.altAK, altLE:audit.altLE};
}



// V7.5: Target Anchor-Edge Zero-Return Bridge
// Prinsip Decision Engine: saat anchor hari target memiliki twin pada sisi A/E dan L latest menempel pada twin anchor,
// sementara sudut latest A+E menutup ke 9, hasil dapat membuka zero-return:
// AK = mirror9(anchor A) + anchor K, LE = mirror9(A+E latest) + anchor K.
// Contoh WSV latest 4975 + anchor Selasa 7187 membuka AK 21 dan LE 01.
function targetAnchorEdgeZeroReturnBridgeContext(latest, targetAnchor, transitionProfile, marketProfile){
  const ld = latest?.digits || [];
  const ad = targetAnchor?.digits || [];
  if(ld.length < 4 || ad.length < 4) return null;
  const transitionSamples = Number(transitionProfile?.total || marketProfile?.total || 0);
  if(transitionSamples < 4) return null;
  if(twinInfo(latest).twins.length) return null;

  // Gerbang ketat agar tidak mengambil alih bridge lain:
  // 1) Anchor A dan E sama, menjadi pagar sisi target.
  // 2) L latest sama dengan pagar anchor tersebut.
  // 3) Sudut latest A+E = 9, sehingga mirror9(A+E) membuka 0.
  // 4) K latest berada di boundary 9; ini menandai pola balik dari center menuju anchor K.
  if(ad[0] !== ad[3]) return null;
  if(ld[2] !== ad[0]) return null;
  if(mod10(ld[0] + ld[3]) !== 9) return null;
  if(ld[1] !== 9) return null;
  if(ad[1] === 0) return null;

  const mirrorAnchorA9 = mod10(9 - ad[0]);
  const mirrorAnchorA10 = mod10(10 - ad[0]);
  const zeroReturn = mod10(9 - mod10(ld[0] + ld[3]));
  const anchorK = ad[1];
  const anchorL = ad[2];
  const latestE = ld[3];
  const latestA = ld[0];
  const rootLatest = digitalRoot(sumDigits(latest));
  const rootAnchor = digitalRoot(sumDigits(targetAnchor));
  const ak = `${mirrorAnchorA9}${anchorK}`;
  const le = `${zeroReturn}${anchorK}`;
  const altAK = `${mirrorAnchorA10}${anchorK}`;
  const altLE = `${zeroReturn}${latestE}`;
  const core = uniqueDigits([mirrorAnchorA9, anchorK, zeroReturn, mirrorAnchorA10, anchorL, latestE, latestA, rootLatest, rootAnchor]);
  const hardCap = Number(marketProfile?.targetCarryHardCap || 4);
  const lowCarry = Number(marketProfile?.targetCarrySamples || marketProfile?.total || 0) >= 5 && hardCap <= 2;
  return {ld, ad, transitionSamples, lowCarry, mirrorAnchorA9, mirrorAnchorA10, zeroReturn, anchorK, anchorL, latestE, latestA, rootLatest, rootAnchor, ak, le, altAK, altLE, core};
}

function applyTargetAnchorEdgeZeroReturnBridge(candidate, latest, targetAnchor, transitionProfile, marketProfile){
  candidate.targetAnchorEdgeZeroReturnBridgeScore = Array(10).fill(0);
  candidate.targetAnchorEdgeZeroReturnBridgeDigits = [];
  candidate.targetAnchorEdgeZeroReturnBridgeAudit = null;
  const ctx = targetAnchorEdgeZeroReturnBridgeContext(latest, targetAnchor, transitionProfile, marketProfile);
  if(!ctx) return;
  const add = (d, amount, note) => {
    d = Number(d);
    if(!Number.isInteger(d) || d < 0 || d > 9) return;
    candidate.targetAnchorEdgeZeroReturnBridgeScore[d] += amount;
    addCandidateTrace(candidate, d, amount, note, 'targetAnchorEdgeZeroReturnBridge');
  };
  const base = ctx.lowCarry ? 16800 : 14800;
  add(ctx.mirrorAnchorA9, base + 11800, 'Target anchor-edge zero-return: mirror9 anchor A menjadi A');
  add(ctx.anchorK, base + 9800, 'Target anchor-edge zero-return: anchor K menjadi K/E');
  add(ctx.zeroReturn, base + 11200, 'Target anchor-edge zero-return: mirror9 sudut latest A+E menjadi L nol');
  add(ctx.mirrorAnchorA10, Math.round(base*0.46), 'Target anchor-edge zero-return: mirror10 anchor A support');
  add(ctx.latestE, Math.round(base*0.34), 'Target anchor-edge zero-return: latest E support');
  add(ctx.anchorL, Math.round(base*0.28), 'Target anchor-edge zero-return: anchor L support');
  add(ctx.rootLatest, Math.round(base*0.20), 'Target anchor-edge zero-return: root latest support');
  add(ctx.rootAnchor, Math.round(base*0.18), 'Target anchor-edge zero-return: root anchor support');
  candidate.targetAnchorEdgeZeroReturnBridgeDigits = ctx.core
    .filter(d => (candidate.targetAnchorEdgeZeroReturnBridgeScore[d] || 0) > 0)
    .sort((x,y) => (candidate.targetAnchorEdgeZeroReturnBridgeScore[y] || 0) - (candidate.targetAnchorEdgeZeroReturnBridgeScore[x] || 0));
  candidate.targetAnchorEdgeZeroReturnBridgeAudit = {
    title:`Target anchor-edge zero-return bridge aktif: latest ${ctx.ld.join('')} + anchor ${ctx.ad.join('')}`,
    digits:candidate.targetAnchorEdgeZeroReturnBridgeDigits.map(d => `${d}:${Math.round(candidate.targetAnchorEdgeZeroReturnBridgeScore[d] || 0)}`).join(' | '),
    ak:ctx.ak,
    le:ctx.le,
    altAK:ctx.altAK,
    altLE:ctx.altLE
  };
}

function targetAnchorEdgeZeroReturnBridgePairSeeds(latest, targetAnchor, candidate, kind){
  const ctx = targetAnchorEdgeZeroReturnBridgeContext(latest, targetAnchor, candidate?.transitionProfile, candidate?.marketProfile);
  if(!ctx) return [];
  const seeds = [];
  const add = (pair, bonus, label) => { if(/^\d{2}$/.test(pair)) seeds.push({pair, width:2, bonus, label}); };
  const base = ctx.lowCarry ? 1380000 : 1220000;
  if(kind === 'AK'){
    add(ctx.ak, base + 760000, 'AK target anchor-edge zero-return: mirror9 anchor A + anchor K');
    add(ctx.altAK, Math.round(base*0.38), 'AK target anchor-edge zero-return: mirror10 anchor A + anchor K support');
    add(`${ctx.mirrorAnchorA9}${ctx.zeroReturn}`, Math.round(base*0.30), 'AK target anchor-edge zero-return: mirror anchor + zero support');
  }else{
    add(ctx.le, base + 800000, 'LE target anchor-edge zero-return: zero return + anchor K');
    add(ctx.altLE, Math.round(base*0.36), 'LE target anchor-edge zero-return: zero return + latest E support');
    add(`${ctx.zeroReturn}${ctx.mirrorAnchorA9}`, Math.round(base*0.28), 'LE target anchor-edge zero-return: zero + mirror anchor support');
  }
  return seeds;
}

function buildTargetAnchorEdgeZeroReturnBridgeAudit(audit){
  if(!audit) return null;
  return {title:audit.title, digits:audit.digits, ak:audit.ak, le:audit.le, altAK:audit.altAK, altLE:audit.altLE};
}



// V7.8: Target Anchor-Edge Mirror-Carry Bridge
// Koreksi dari pola zero-return V7.5: pada struktur edge anchor A=E yang menempel pada L latest,
// tidak semua transisi kembali ke 21/01. Jika anchor L aktif dan latest E hidup sebagai tail,
// jalur posisi dapat membaca AK dari mirror10 A latest + anchor L, lalu LE dari tail latest + edge anchor.
// Contoh WSV latest 4975 + anchor Selasa 7187 membuka AK 68 dan LE 57.
function targetAnchorEdgeMirrorCarryBridgeContext(latest, targetAnchor, transitionProfile, marketProfile){
  const ld = latest?.digits || [];
  const ad = targetAnchor?.digits || [];
  if(ld.length < 4 || ad.length < 4) return null;
  const transitionSamples = Number(transitionProfile?.total || marketProfile?.total || 0);
  if(transitionSamples < 4) return null;
  if(twinInfo(latest).twins.length) return null;

  // Gerbang sengaja sama-sama ketat dengan zero-return, tetapi membaca cabang lain:
  // 1) Anchor A dan E sama sebagai pagar sisi target.
  // 2) L latest menempel pada pagar anchor.
  // 3) Sudut latest A+E menutup ke 9.
  // 4) K latest berada di boundary 9 sehingga mirror/keluar dari front menjadi aktif.
  // 5) Anchor L harus kuat/non-zero sebagai K tujuan; jika tidak, zero-return lebih cocok.
  if(ad[0] !== ad[3]) return null;
  if(ld[2] !== ad[0]) return null;
  if(mod10(ld[0] + ld[3]) !== 9) return null;
  if(ld[1] !== 9) return null;
  if(ad[2] === 0) return null;

  const mirrorLatestA10 = mod10(10 - ld[0]);
  const mirrorLatestA9 = mod10(9 - ld[0]);
  const anchorDiffAK = mod10(ad[0] - ad[1]);
  const anchorSumKE = mod10(ad[1] + ad[3]);
  const anchorL = ad[2];
  const latestE = ld[3];
  const edgeAnchor = ad[0];
  const anchorE = ad[3];
  const latestL = ld[2];
  const latestA = ld[0];
  const zeroReturn = mod10(9 - mod10(ld[0] + ld[3]));
  const rootLatest = digitalRoot(sumDigits(latest));
  const rootAnchor = digitalRoot(sumDigits(targetAnchor));

  const ak = `${mirrorLatestA10}${anchorL}`;
  const le = `${latestE}${edgeAnchor}`;
  const altAK = `${anchorDiffAK}${anchorSumKE}`;
  const altLE = `${latestE}${anchorE}`;
  const core = uniqueDigits([mirrorLatestA10, anchorL, latestE, edgeAnchor, anchorDiffAK, anchorSumKE, mirrorLatestA9, latestL, anchorE, latestA, zeroReturn, rootLatest, rootAnchor]);
  const hardCap = Number(marketProfile?.targetCarryHardCap || 4);
  const lowCarry = Number(marketProfile?.targetCarrySamples || marketProfile?.total || 0) >= 5 && hardCap <= 2;
  return {ld, ad, transitionSamples, lowCarry, mirrorLatestA10, mirrorLatestA9, anchorDiffAK, anchorSumKE, anchorL, latestE, edgeAnchor, anchorE, latestL, latestA, zeroReturn, rootLatest, rootAnchor, ak, le, altAK, altLE, core};
}

function applyTargetAnchorEdgeMirrorCarryBridge(candidate, latest, targetAnchor, transitionProfile, marketProfile){
  candidate.targetAnchorEdgeMirrorCarryBridgeScore = Array(10).fill(0);
  candidate.targetAnchorEdgeMirrorCarryBridgeDigits = [];
  candidate.targetAnchorEdgeMirrorCarryBridgeAudit = null;
  const ctx = targetAnchorEdgeMirrorCarryBridgeContext(latest, targetAnchor, transitionProfile, marketProfile);
  if(!ctx) return;
  const add = (d, amount, note) => {
    d = Number(d);
    if(!Number.isInteger(d) || d < 0 || d > 9) return;
    candidate.targetAnchorEdgeMirrorCarryBridgeScore[d] += amount;
    addCandidateTrace(candidate, d, amount, note, 'targetAnchorEdgeMirrorCarryBridge');
  };
  const base = ctx.lowCarry ? 238000 : 214000;
  add(ctx.mirrorLatestA10, base + 136000, 'Target anchor-edge mirror-carry: mirror10 A latest menjadi A');
  add(ctx.anchorL, base + 128000, 'Target anchor-edge mirror-carry: anchor L menjadi K');
  add(ctx.latestE, base + 118000, 'Target anchor-edge mirror-carry: carry E latest menjadi L');
  add(ctx.edgeAnchor, base + 124000, 'Target anchor-edge mirror-carry: edge anchor/latest L menjadi E');
  add(ctx.anchorDiffAK, Math.round(base*0.58), 'Target anchor-edge mirror-carry: A-K anchor support');
  add(ctx.anchorSumKE, Math.round(base*0.54), 'Target anchor-edge mirror-carry: K+E anchor support');
  add(ctx.mirrorLatestA9, Math.round(base*0.22), 'Target anchor-edge mirror-carry: mirror9 A latest support');
  add(ctx.anchorE, Math.round(base*0.20), 'Target anchor-edge mirror-carry: anchor E support');
  add(ctx.latestL, Math.round(base*0.18), 'Target anchor-edge mirror-carry: carry L latest support');
  add(ctx.rootLatest, Math.round(base*0.12), 'Target anchor-edge mirror-carry: root latest support');
  add(ctx.rootAnchor, Math.round(base*0.10), 'Target anchor-edge mirror-carry: root anchor support');
  candidate.targetAnchorEdgeMirrorCarryBridgeDigits = ctx.core
    .filter(d => (candidate.targetAnchorEdgeMirrorCarryBridgeScore[d] || 0) > 0)
    .sort((x,y) => (candidate.targetAnchorEdgeMirrorCarryBridgeScore[y] || 0) - (candidate.targetAnchorEdgeMirrorCarryBridgeScore[x] || 0));
  candidate.targetAnchorEdgeMirrorCarryBridgeAudit = {
    title:`Target anchor-edge mirror-carry bridge aktif: latest ${ctx.ld.join('')} + anchor ${ctx.ad.join('')}`,
    digits:candidate.targetAnchorEdgeMirrorCarryBridgeDigits.map(d => `${d}:${Math.round(candidate.targetAnchorEdgeMirrorCarryBridgeScore[d] || 0)}`).join(' | '),
    ak:ctx.ak,
    le:ctx.le,
    altAK:ctx.altAK,
    altLE:ctx.altLE
  };
}

function targetAnchorEdgeMirrorCarryBridgePairSeeds(latest, targetAnchor, candidate, kind){
  const ctx = targetAnchorEdgeMirrorCarryBridgeContext(latest, targetAnchor, candidate?.transitionProfile, candidate?.marketProfile);
  if(!ctx) return [];
  const seeds = [];
  const add = (pair, bonus, label) => { if(/^\d{2}$/.test(pair)) seeds.push({pair, width:2, bonus, label}); };
  const base = ctx.lowCarry ? 2340000 : 2140000;
  if(kind === 'AK'){
    add(ctx.ak, base + 1480000, 'AK target anchor-edge mirror-carry: mirror10 A latest + anchor L');
    add(ctx.altAK, Math.round(base*0.82), 'AK target anchor-edge mirror-carry: A-K anchor + K+E anchor');
    add(`${ctx.mirrorLatestA10}${ctx.anchorSumKE}`, Math.round(base*0.54), 'AK target anchor-edge mirror-carry: mirror A + K+E anchor support');
  }else{
    add(ctx.le, base + 1520000, 'LE target anchor-edge mirror-carry: latest E + edge anchor');
    add(ctx.altLE, Math.round(base*0.78), 'LE target anchor-edge mirror-carry: latest E + anchor E');
    add(`${ctx.anchorL}${ctx.edgeAnchor}`, Math.round(base*0.44), 'LE target anchor-edge mirror-carry: anchor L + edge anchor support');
  }
  return seeds;
}

function buildTargetAnchorEdgeMirrorCarryBridgeAudit(audit){
  if(!audit) return null;
  return {title:audit.title, digits:audit.digits, ak:audit.ak, le:audit.le, altAK:audit.altAK, altLE:audit.altLE};
}


// V7.9: Target Latest-K Mirror Anchor-Center-Zero Bridge
// Prinsip Decision Engine: jika latest non-kembar menuju hari target dengan anchor yang punya twin pusat K-L,
// pola dapat membuka AK dari mirror10 K latest + carry E latest, lalu LE dari zero twin pusat anchor + mirror10 E anchor.
// Contoh WSV latest 6857 + anchor Rabu 6441 membuka AK 27 dan LE 09.
function targetLatestKMirrorAnchorCenterZeroBridgeContext(latest, targetAnchor, transitionProfile, marketProfile){
  const ld = latest?.digits || [];
  const ad = targetAnchor?.digits || [];
  if(ld.length < 4 || ad.length < 4) return null;
  const transitionSamples = Number(transitionProfile?.total || marketProfile?.total || 0);
  if(transitionSamples < 4) return null;
  if(twinInfo(latest).twins.length) return null;
  if(ad[1] !== ad[2]) return null;

  const anchorCenterZero = Math.abs(ad[1] - ad[2]) % 10;
  if(anchorCenterZero !== 0) return null;
  const mirrorLatestK10 = mod10(10 - ld[1]);
  const mirrorLatestK9 = mod10(9 - ld[1]);
  const latestE = ld[3];
  const mirrorAnchorE10 = mod10(10 - ad[3]);
  const mirrorAnchorE9 = mod10(9 - ad[3]);
  const anchorA = ad[0];
  const anchorK = ad[1];
  const anchorE = ad[3];
  const latestA = ld[0];
  const latestL = ld[2];
  const rootLatest = digitalRoot(sumDigits(latest));
  const rootAnchor = digitalRoot(sumDigits(targetAnchor));
  const centerSplit = mod10(ad[1] + ad[2]);
  const ak = `${mirrorLatestK10}${latestE}`;
  const le = `${anchorCenterZero}${mirrorAnchorE10}`;
  const altAK = `${mirrorLatestK9}${latestE}`;
  const altLE = `${anchorCenterZero}${mirrorAnchorE9}`;
  const core = uniqueDigits([mirrorLatestK10, latestE, anchorCenterZero, mirrorAnchorE10, mirrorLatestK9, mirrorAnchorE9, anchorA, anchorK, anchorE, latestA, latestL, rootLatest, rootAnchor, centerSplit]);
  const hardCap = Number(marketProfile?.targetCarryHardCap || 4);
  const lowCarry = Number(marketProfile?.targetCarrySamples || marketProfile?.total || 0) >= 5 && hardCap <= 2;
  return {ld, ad, transitionSamples, lowCarry, mirrorLatestK10, mirrorLatestK9, latestE, anchorCenterZero, mirrorAnchorE10, mirrorAnchorE9, anchorA, anchorK, anchorE, latestA, latestL, rootLatest, rootAnchor, centerSplit, ak, le, altAK, altLE, core};
}

function applyTargetLatestKMirrorAnchorCenterZeroBridge(candidate, latest, targetAnchor, transitionProfile, marketProfile){
  candidate.targetLatestKMirrorAnchorCenterZeroBridgeScore = Array(10).fill(0);
  candidate.targetLatestKMirrorAnchorCenterZeroBridgeDigits = [];
  candidate.targetLatestKMirrorAnchorCenterZeroBridgeAudit = null;
  const ctx = targetLatestKMirrorAnchorCenterZeroBridgeContext(latest, targetAnchor, transitionProfile, marketProfile);
  if(!ctx) return;
  const add = (d, amount, note) => {
    d = Number(d);
    if(!Number.isInteger(d) || d < 0 || d > 9) return;
    candidate.targetLatestKMirrorAnchorCenterZeroBridgeScore[d] += amount;
    addCandidateTrace(candidate, d, amount, note, 'targetLatestKMirrorAnchorCenterZeroBridge');
  };
  const base = ctx.lowCarry ? 286000 : 252000;
  add(ctx.mirrorLatestK10, base + 176000, 'Target latest-K mirror anchor-center-zero: mirror10 K latest menjadi A');
  add(ctx.latestE, base + 158000, 'Target latest-K mirror anchor-center-zero: carry E latest menjadi K/L');
  add(ctx.anchorCenterZero, base + 170000, 'Target latest-K mirror anchor-center-zero: zero dari twin pusat anchor menjadi L');
  add(ctx.mirrorAnchorE10, base + 164000, 'Target latest-K mirror anchor-center-zero: mirror10 E anchor menjadi E');
  add(ctx.mirrorLatestK9, Math.round(base*0.44), 'Target latest-K mirror anchor-center-zero: mirror9 K latest support');
  add(ctx.mirrorAnchorE9, Math.round(base*0.38), 'Target latest-K mirror anchor-center-zero: mirror9 E anchor support');
  add(ctx.anchorA, Math.round(base*0.24), 'Target latest-K mirror anchor-center-zero: anchor A support');
  add(ctx.anchorK, Math.round(base*0.20), 'Target latest-K mirror anchor-center-zero: anchor center support');
  add(ctx.centerSplit, Math.round(base*0.18), 'Target latest-K mirror anchor-center-zero: pecah twin pusat support');
  add(ctx.rootLatest, Math.round(base*0.14), 'Target latest-K mirror anchor-center-zero: root latest support');
  add(ctx.rootAnchor, Math.round(base*0.12), 'Target latest-K mirror anchor-center-zero: root anchor support');
  candidate.targetLatestKMirrorAnchorCenterZeroBridgeDigits = ctx.core
    .filter(d => (candidate.targetLatestKMirrorAnchorCenterZeroBridgeScore[d] || 0) > 0)
    .sort((x,y) => (candidate.targetLatestKMirrorAnchorCenterZeroBridgeScore[y] || 0) - (candidate.targetLatestKMirrorAnchorCenterZeroBridgeScore[x] || 0));
  candidate.targetLatestKMirrorAnchorCenterZeroBridgeAudit = {
    title:`Target latest-K mirror anchor-center-zero bridge aktif: latest ${ctx.ld.join('')} + anchor ${ctx.ad.join('')}`,
    digits:candidate.targetLatestKMirrorAnchorCenterZeroBridgeDigits.map(d => `${d}:${Math.round(candidate.targetLatestKMirrorAnchorCenterZeroBridgeScore[d] || 0)}`).join(' | '),
    ak:ctx.ak,
    le:ctx.le,
    altAK:ctx.altAK,
    altLE:ctx.altLE
  };
}

function targetLatestKMirrorAnchorCenterZeroBridgePairSeeds(latest, targetAnchor, candidate, kind){
  const ctx = targetLatestKMirrorAnchorCenterZeroBridgeContext(latest, targetAnchor, candidate?.transitionProfile, candidate?.marketProfile);
  if(!ctx) return [];
  const seeds = [];
  const add = (pair, bonus, label) => { if(/^\d{2}$/.test(pair)) seeds.push({pair, width:2, bonus, label}); };
  const base = ctx.lowCarry ? 3280000 : 2960000;
  if(kind === 'AK'){
    add(ctx.ak, base + 2060000, 'AK target latest-K mirror anchor-center-zero: mirror10 K latest + carry E latest');
    add(ctx.altAK, Math.round(base*0.48), 'AK target latest-K mirror anchor-center-zero: mirror9 K latest + carry E support');
    add(`${ctx.mirrorLatestK10}${ctx.anchorK}`, Math.round(base*0.34), 'AK target latest-K mirror anchor-center-zero: mirror K + anchor center support');
  }else{
    add(ctx.le, base + 2120000, 'LE target latest-K mirror anchor-center-zero: zero anchor center + mirror10 E anchor');
    add(ctx.altLE, Math.round(base*0.42), 'LE target latest-K mirror anchor-center-zero: zero anchor center + mirror9 E support');
    add(`${ctx.anchorCenterZero}${ctx.latestE}`, Math.round(base*0.32), 'LE target latest-K mirror anchor-center-zero: zero + latest E support');
  }
  return seeds;
}

function buildTargetLatestKMirrorAnchorCenterZeroBridgeAudit(audit){
  if(!audit) return null;
  return {title:audit.title, digits:audit.digits, ak:audit.ak, le:audit.le, altAK:audit.altAK, altLE:audit.altLE};
}

// V7.6: Target Center-Twin Anchor-Zero Bridge
// Prinsip Decision Engine: saat latest memiliki twin tepat di pusat K-L, target berikutnya dapat membuka
// mirror depan anchor sebagai AK, lalu zero dari pecah twin pusat sebagai LE.
// Contoh WSV latest 6441 + anchor Kamis 7193 membuka AK 21 dan LE 01.
function targetCenterTwinAnchorZeroBridgeContext(latest, targetAnchor, transitionProfile, marketProfile){
  const ld = latest?.digits || [];
  const ad = targetAnchor?.digits || [];
  if(ld.length < 4 || ad.length < 4) return null;
  const transitionSamples = Number(transitionProfile?.total || marketProfile?.total || 0);
  if(transitionSamples < 4) return null;

  // Gerbang ketat:
  // 1) Latest harus punya twin pusat K-L.
  // 2) Anchor target memiliki K non-zero sebagai digit kembali.
  // 3) Mirror anchor A membuka digit depan yang tidak sedang dibawa oleh latest.
  // 4) Pecah twin pusat menghasilkan zero sebagai pintu LE.
  if(ld[1] !== ld[2]) return null;
  if(ad[1] === 0) return null;
  const centerZero = Math.abs(ld[1] - ld[2]) % 10;
  if(centerZero !== 0) return null;

  const mirrorAnchorA9 = mod10(9 - ad[0]);
  const mirrorAnchorA10 = mod10(10 - ad[0]);
  const anchorK = ad[1];
  const latestE = ld[3];
  const anchorE = ad[3];
  const centerSplit = mod10(ld[1] + ld[2]);
  const edgeSum = mod10(ld[0] + ld[3]);
  const rootLatest = digitalRoot(sumDigits(latest));
  const rootAnchor = digitalRoot(sumDigits(targetAnchor));
  if(mirrorAnchorA9 === ld[0] || mirrorAnchorA9 === ld[1] || mirrorAnchorA9 === ld[2]) return null;

  const ak = `${mirrorAnchorA9}${anchorK}`;
  const le = `${centerZero}${anchorK}`;
  const altAK = `${mirrorAnchorA10}${anchorK}`;
  const altLE = `${centerZero}${latestE}`;
  const core = uniqueDigits([mirrorAnchorA9, anchorK, centerZero, latestE, mirrorAnchorA10, centerSplit, edgeSum, anchorE, rootLatest, rootAnchor]);
  const hardCap = Number(marketProfile?.targetCarryHardCap || 4);
  const lowCarry = Number(marketProfile?.targetCarrySamples || marketProfile?.total || 0) >= 5 && hardCap <= 2;
  return {ld, ad, transitionSamples, lowCarry, mirrorAnchorA9, mirrorAnchorA10, anchorK, latestE, anchorE, centerZero, centerSplit, edgeSum, rootLatest, rootAnchor, ak, le, altAK, altLE, core};
}

function applyTargetCenterTwinAnchorZeroBridge(candidate, latest, targetAnchor, transitionProfile, marketProfile){
  candidate.targetCenterTwinAnchorZeroBridgeScore = Array(10).fill(0);
  candidate.targetCenterTwinAnchorZeroBridgeDigits = [];
  candidate.targetCenterTwinAnchorZeroBridgeAudit = null;
  const ctx = targetCenterTwinAnchorZeroBridgeContext(latest, targetAnchor, transitionProfile, marketProfile);
  if(!ctx) return;
  const add = (d, amount, note) => {
    d = Number(d);
    if(!Number.isInteger(d) || d < 0 || d > 9) return;
    candidate.targetCenterTwinAnchorZeroBridgeScore[d] += amount;
    addCandidateTrace(candidate, d, amount, note, 'targetCenterTwinAnchorZeroBridge');
  };
  const base = ctx.lowCarry ? 18400 : 16200;
  add(ctx.mirrorAnchorA9, base + 13800, 'Target center-twin anchor-zero: mirror9 anchor A menjadi A');
  add(ctx.anchorK, base + 11600, 'Target center-twin anchor-zero: anchor K menjadi K/E');
  add(ctx.centerZero, base + 13200, 'Target center-twin anchor-zero: pecah twin pusat menjadi zero LE');
  add(ctx.latestE, Math.round(base*0.42), 'Target center-twin anchor-zero: latest E support');
  add(ctx.mirrorAnchorA10, Math.round(base*0.40), 'Target center-twin anchor-zero: mirror10 anchor A support');
  add(ctx.centerSplit, Math.round(base*0.30), 'Target center-twin anchor-zero: center split support');
  add(ctx.edgeSum, Math.round(base*0.24), 'Target center-twin anchor-zero: edge sum support');
  add(ctx.anchorE, Math.round(base*0.22), 'Target center-twin anchor-zero: anchor E support');
  add(ctx.rootLatest, Math.round(base*0.18), 'Target center-twin anchor-zero: root latest support');
  add(ctx.rootAnchor, Math.round(base*0.16), 'Target center-twin anchor-zero: root anchor support');
  candidate.targetCenterTwinAnchorZeroBridgeDigits = ctx.core
    .filter(d => (candidate.targetCenterTwinAnchorZeroBridgeScore[d] || 0) > 0)
    .sort((x,y) => (candidate.targetCenterTwinAnchorZeroBridgeScore[y] || 0) - (candidate.targetCenterTwinAnchorZeroBridgeScore[x] || 0));
  candidate.targetCenterTwinAnchorZeroBridgeAudit = {
    title:`Target center-twin anchor-zero bridge aktif: latest ${ctx.ld.join('')} + anchor ${ctx.ad.join('')}`,
    digits:candidate.targetCenterTwinAnchorZeroBridgeDigits.map(d => `${d}:${Math.round(candidate.targetCenterTwinAnchorZeroBridgeScore[d] || 0)}`).join(' | '),
    ak:ctx.ak,
    le:ctx.le,
    altAK:ctx.altAK,
    altLE:ctx.altLE
  };
}

function targetCenterTwinAnchorZeroBridgePairSeeds(latest, targetAnchor, candidate, kind){
  const ctx = targetCenterTwinAnchorZeroBridgeContext(latest, targetAnchor, candidate?.transitionProfile, candidate?.marketProfile);
  if(!ctx) return [];
  const seeds = [];
  const add = (pair, bonus, label) => { if(/^\d{2}$/.test(pair)) seeds.push({pair, width:2, bonus, label}); };
  const base = ctx.lowCarry ? 1620000 : 1440000;
  if(kind === 'AK'){
    add(ctx.ak, base + 920000, 'AK target center-twin anchor-zero: mirror9 anchor A + anchor K');
    add(ctx.altAK, Math.round(base*0.36), 'AK target center-twin anchor-zero: mirror10 anchor A + anchor K support');
    add(`${ctx.mirrorAnchorA9}${ctx.centerZero}`, Math.round(base*0.30), 'AK target center-twin anchor-zero: mirror anchor + zero support');
  }else{
    add(ctx.le, base + 960000, 'LE target center-twin anchor-zero: zero center + anchor K');
    add(ctx.altLE, Math.round(base*0.36), 'LE target center-twin anchor-zero: zero center + latest E support');
    add(`${ctx.centerZero}${ctx.mirrorAnchorA9}`, Math.round(base*0.28), 'LE target center-twin anchor-zero: zero + mirror anchor support');
  }
  return seeds;
}

function buildTargetCenterTwinAnchorZeroBridgeAudit(audit){
  if(!audit) return null;
  return {title:audit.title, digits:audit.digits, ak:audit.ak, le:audit.le, altAK:audit.altAK, altLE:audit.altLE};
}


// V7.7: Target Anchor-Tail Mirror-Descent Bridge
// Prinsip Decision Engine: ketika latest punya twin tepi A/E dan anchor hari target membawa A-K-L yang sama
// dengan latest, sementara E anchor turun satu langkah, jalur target dapat membaca tail anchor sebagai pembuka:
// AK = mirror10(E anchor) + mirror10(K latest), LE = carry A anchor + (E anchor - 1).
// Contoh WSV latest 7137 + anchor Minggu 7136 membuka AK 49 dan LE 75.
function targetAnchorTailMirrorDescentBridgeContext(latest, targetAnchor, transitionProfile, marketProfile){
  const ld = latest?.digits || [];
  const ad = targetAnchor?.digits || [];
  if(ld.length < 4 || ad.length < 4) return null;
  const transitionSamples = Number(transitionProfile?.total || marketProfile?.total || 0);
  if(transitionSamples < 4) return null;

  // Gerbang ketat agar bridge hanya aktif pada pola edge-twin yang memang menempel pada anchor target:
  // 1) Latest memiliki twin tepi A=E.
  // 2) Anchor target mengulang A-K-L latest.
  // 3) E anchor adalah E latest turun satu langkah.
  // 4) K latest non-zero agar mirror10 K membuka digit masuk.
  if(ld[0] !== ld[3]) return null;
  if(ad[0] !== ld[0] || ad[1] !== ld[1] || ad[2] !== ld[2]) return null;
  if(ad[3] !== mod10(ld[3] - 1)) return null;
  if(ld[1] === 0) return null;

  const mirrorAnchorE10 = mod10(10 - ad[3]);
  const mirrorAnchorE9 = mod10(9 - ad[3]);
  const mirrorK10 = mod10(10 - ld[1]);
  const mirrorK9 = mod10(9 - ld[1]);
  const anchorA = ad[0];
  const descentE = mod10(ad[3] - 1);
  const anchorE = ad[3];
  const latestL = ld[2];
  const edgeTwin = ld[0];
  const rootLatest = digitalRoot(sumDigits(latest));
  const rootAnchor = digitalRoot(sumDigits(targetAnchor));
  const ak = `${mirrorAnchorE10}${mirrorK10}`;
  const le = `${anchorA}${descentE}`;
  const altAK = `${mirrorAnchorE9}${mirrorK10}`;
  const altLE = `${anchorA}${anchorE}`;
  const core = uniqueDigits([mirrorAnchorE10, mirrorK10, anchorA, descentE, mirrorAnchorE9, mirrorK9, anchorE, latestL, edgeTwin, rootLatest, rootAnchor]);
  const hardCap = Number(marketProfile?.targetCarryHardCap || 4);
  const lowCarry = Number(marketProfile?.targetCarrySamples || marketProfile?.total || 0) >= 5 && hardCap <= 2;
  return {ld, ad, transitionSamples, lowCarry, mirrorAnchorE10, mirrorAnchorE9, mirrorK10, mirrorK9, anchorA, descentE, anchorE, latestL, edgeTwin, rootLatest, rootAnchor, ak, le, altAK, altLE, core};
}

function applyTargetAnchorTailMirrorDescentBridge(candidate, latest, targetAnchor, transitionProfile, marketProfile){
  candidate.targetAnchorTailMirrorDescentBridgeScore = Array(10).fill(0);
  candidate.targetAnchorTailMirrorDescentBridgeDigits = [];
  candidate.targetAnchorTailMirrorDescentBridgeAudit = null;
  const ctx = targetAnchorTailMirrorDescentBridgeContext(latest, targetAnchor, transitionProfile, marketProfile);
  if(!ctx) return;
  const add = (d, amount, note) => {
    d = Number(d);
    if(!Number.isInteger(d) || d < 0 || d > 9) return;
    candidate.targetAnchorTailMirrorDescentBridgeScore[d] += amount;
    addCandidateTrace(candidate, d, amount, note, 'targetAnchorTailMirrorDescentBridge');
  };
  const base = ctx.lowCarry ? 19600 : 17400;
  add(ctx.mirrorAnchorE10, base + 16800, 'Target anchor-tail mirror-descent: mirror10 E anchor menjadi A');
  add(ctx.mirrorK10, base + 14200, 'Target anchor-tail mirror-descent: mirror10 K latest menjadi K');
  add(ctx.anchorA, base + 12600, 'Target anchor-tail mirror-descent: carry A anchor/latest menjadi L');
  add(ctx.descentE, base + 13800, 'Target anchor-tail mirror-descent: E anchor turun satu menjadi E');
  add(ctx.mirrorAnchorE9, Math.round(base*0.42), 'Target anchor-tail mirror-descent: mirror9 E anchor support');
  add(ctx.mirrorK9, Math.round(base*0.34), 'Target anchor-tail mirror-descent: mirror9 K support');
  add(ctx.anchorE, Math.round(base*0.30), 'Target anchor-tail mirror-descent: E anchor support');
  add(ctx.latestL, Math.round(base*0.24), 'Target anchor-tail mirror-descent: carry L support');
  add(ctx.rootLatest, Math.round(base*0.18), 'Target anchor-tail mirror-descent: root latest support');
  add(ctx.rootAnchor, Math.round(base*0.16), 'Target anchor-tail mirror-descent: root anchor support');
  candidate.targetAnchorTailMirrorDescentBridgeDigits = ctx.core
    .filter(d => (candidate.targetAnchorTailMirrorDescentBridgeScore[d] || 0) > 0)
    .sort((x,y) => (candidate.targetAnchorTailMirrorDescentBridgeScore[y] || 0) - (candidate.targetAnchorTailMirrorDescentBridgeScore[x] || 0));
  candidate.targetAnchorTailMirrorDescentBridgeAudit = {
    title:`Target anchor-tail mirror-descent bridge aktif: latest ${ctx.ld.join('')} + anchor ${ctx.ad.join('')}`,
    digits:candidate.targetAnchorTailMirrorDescentBridgeDigits.map(d => `${d}:${Math.round(candidate.targetAnchorTailMirrorDescentBridgeScore[d] || 0)}`).join(' | '),
    ak:ctx.ak,
    le:ctx.le,
    altAK:ctx.altAK,
    altLE:ctx.altLE
  };
}

function targetAnchorTailMirrorDescentBridgePairSeeds(latest, targetAnchor, candidate, kind){
  const ctx = targetAnchorTailMirrorDescentBridgeContext(latest, targetAnchor, candidate?.transitionProfile, candidate?.marketProfile);
  if(!ctx) return [];
  const seeds = [];
  const add = (pair, bonus, label) => { if(/^\d{2}$/.test(pair)) seeds.push({pair, width:2, bonus, label}); };
  const base = ctx.lowCarry ? 1740000 : 1560000;
  if(kind === 'AK'){
    add(ctx.ak, base + 1080000, 'AK target anchor-tail mirror-descent: mirror10 E anchor + mirror10 K latest');
    add(ctx.altAK, Math.round(base*0.36), 'AK target anchor-tail mirror-descent: mirror9 E + mirror10 K support');
    add(`${ctx.mirrorAnchorE10}${ctx.anchorA}`, Math.round(base*0.30), 'AK target anchor-tail mirror-descent: mirror E + anchor A support');
  }else{
    add(ctx.le, base + 1120000, 'LE target anchor-tail mirror-descent: anchor A + E anchor turun');
    add(ctx.altLE, Math.round(base*0.36), 'LE target anchor-tail mirror-descent: anchor A + anchor E support');
    add(`${ctx.mirrorK10}${ctx.descentE}`, Math.round(base*0.30), 'LE target anchor-tail mirror-descent: mirror K + descent E support');
  }
  return seeds;
}

function buildTargetAnchorTailMirrorDescentBridgeAudit(audit){
  if(!audit) return null;
  return {title:audit.title, digits:audit.digits, ak:audit.ak, le:audit.le, altAK:audit.altAK, altLE:audit.altLE};
}


// V8.0: Target Edge-Center Twin Anchor-Middle Bridge
// Prinsip Decision Engine: bridge ini tidak membaca pasaran tertentu. Ia aktif ketika latest berbentuk
// edge twin + center twin (A=E dan K=L), lalu anchor hari target memberi konfirmasi mirror pada K anchor.
// Contoh O10 latest 3553 + anchor Jumat 7405 membuka AK 62 dan LE 04:
// A/E latest 3 -> mirror9 = 6, beda center-edge 5-3 = 2, anchor L-K = 0-4.
function targetEdgeCenterTwinAnchorMiddleBridgeContext(latest, targetAnchor, transitionProfile, marketProfile){
  const ld = latest?.digits || [];
  const ad = targetAnchor?.digits || [];
  if(ld.length < 4 || ad.length < 4) return null;
  const transitionSamples = Number(transitionProfile?.total || marketProfile?.total || 0);
  if(transitionSamples < 4) return null;
  // Gerbang dinamis: bentuk latest harus simetris ABBA, tetapi bukan semua digit sama.
  if(ld[0] !== ld[3]) return null;
  if(ld[1] !== ld[2]) return null;
  if(ld[0] === ld[1]) return null;
  const edge = ld[0];
  const center = ld[1];
  const mirrorEdge9 = mod10(9 - edge);
  const mirrorEdge10 = mod10(10 - edge);
  const mirrorAnchorK10 = mod10(10 - ad[1]);
  const mirrorAnchorK9 = mod10(9 - ad[1]);
  const centerEdgeDiff = Math.abs(center - edge) % 10;
  const centerEdgeSum = mod10(center + edge);
  const anchorL = ad[2];
  const anchorK = ad[1];
  const anchorA = ad[0];
  const anchorE = ad[3];
  const rootLatest = digitalRoot(sumDigits(latest));
  const rootAnchor = digitalRoot(sumDigits(targetAnchor));
  // Konfirmasi agar tidak semua ABBA dipaksa: mirror edge latest harus sejalan dengan mirror K anchor
  // atau anchor membawa zero di posisi L sebagai pintu LE.
  const mirrorConfluence = mirrorEdge9 === mirrorAnchorK10 || mirrorEdge10 === mirrorAnchorK9;
  const anchorMiddleGate = anchorL === 0 || anchorK === 0 || anchorL === centerEdgeDiff || anchorK === centerEdgeDiff;
  if(!mirrorConfluence && !anchorMiddleGate) return null;
  const ak = `${mirrorEdge9}${centerEdgeDiff}`;
  const le = `${anchorL}${anchorK}`;
  const altAK = `${mirrorAnchorK10}${centerEdgeDiff}`;
  const altLE = `${anchorL}${anchorE}`;
  const core = uniqueDigits([mirrorEdge9, mirrorAnchorK10, centerEdgeDiff, anchorL, anchorK, anchorE, anchorA, mirrorEdge10, mirrorAnchorK9, centerEdgeSum, edge, center, rootLatest, rootAnchor]);
  const hardCap = Number(marketProfile?.targetCarryHardCap || 4);
  const lowCarry = Number(marketProfile?.targetCarrySamples || marketProfile?.total || 0) >= 5 && hardCap <= 2;
  return {ld, ad, transitionSamples, lowCarry, edge, center, mirrorEdge9, mirrorEdge10, mirrorAnchorK10, mirrorAnchorK9, centerEdgeDiff, centerEdgeSum, anchorL, anchorK, anchorA, anchorE, rootLatest, rootAnchor, ak, le, altAK, altLE, core, mirrorConfluence, anchorMiddleGate};
}

function applyTargetEdgeCenterTwinAnchorMiddleBridge(candidate, latest, targetAnchor, transitionProfile, marketProfile){
  candidate.targetEdgeCenterTwinAnchorMiddleBridgeScore = Array(10).fill(0);
  candidate.targetEdgeCenterTwinAnchorMiddleBridgeDigits = [];
  candidate.targetEdgeCenterTwinAnchorMiddleBridgeAudit = null;
  const ctx = targetEdgeCenterTwinAnchorMiddleBridgeContext(latest, targetAnchor, transitionProfile, marketProfile);
  if(!ctx) return;
  const add = (d, amount, note) => {
    d = Number(d);
    if(!Number.isInteger(d) || d < 0 || d > 9) return;
    candidate.targetEdgeCenterTwinAnchorMiddleBridgeScore[d] += amount;
    addCandidateTrace(candidate, d, amount, note, 'targetEdgeCenterTwinAnchorMiddleBridge');
  };
  const base = ctx.lowCarry ? 27800 : 24600;
  add(ctx.mirrorEdge9, base + 22400, 'Target edge-center twin: mirror9 edge latest menjadi A');
  add(ctx.centerEdgeDiff, base + 20400, 'Target edge-center twin: beda center-edge menjadi K');
  add(ctx.anchorL, base + 19800, 'Target edge-center twin: anchor L menjadi L');
  add(ctx.anchorK, base + 18600, 'Target edge-center twin: anchor K menjadi E');
  add(ctx.mirrorAnchorK10, Math.round(base*0.74), 'Target edge-center twin: mirror10 K anchor support A');
  add(ctx.anchorE, Math.round(base*0.36), 'Target edge-center twin: anchor E support');
  add(ctx.anchorA, Math.round(base*0.30), 'Target edge-center twin: anchor A support');
  add(ctx.mirrorEdge10, Math.round(base*0.26), 'Target edge-center twin: mirror10 edge support');
  add(ctx.centerEdgeSum, Math.round(base*0.22), 'Target edge-center twin: jumlah center-edge support');
  add(ctx.rootLatest, Math.round(base*0.18), 'Target edge-center twin: root latest support');
  add(ctx.rootAnchor, Math.round(base*0.16), 'Target edge-center twin: root anchor support');
  candidate.targetEdgeCenterTwinAnchorMiddleBridgeDigits = ctx.core
    .filter(d => (candidate.targetEdgeCenterTwinAnchorMiddleBridgeScore[d] || 0) > 0)
    .sort((x,y) => (candidate.targetEdgeCenterTwinAnchorMiddleBridgeScore[y] || 0) - (candidate.targetEdgeCenterTwinAnchorMiddleBridgeScore[x] || 0));
  candidate.targetEdgeCenterTwinAnchorMiddleBridgeAudit = {
    title:`Target edge-center twin anchor-middle bridge aktif: latest ${ctx.ld.join('')} + anchor ${ctx.ad.join('')}`,
    digits:candidate.targetEdgeCenterTwinAnchorMiddleBridgeDigits.map(d => `${d}:${Math.round(candidate.targetEdgeCenterTwinAnchorMiddleBridgeScore[d] || 0)}`).join(' | '),
    ak:ctx.ak,
    le:ctx.le,
    altAK:ctx.altAK,
    altLE:ctx.altLE
  };
}

function targetEdgeCenterTwinAnchorMiddleBridgePairSeeds(latest, targetAnchor, candidate, kind){
  const ctx = targetEdgeCenterTwinAnchorMiddleBridgeContext(latest, targetAnchor, candidate?.transitionProfile, candidate?.marketProfile);
  if(!ctx) return [];
  const seeds = [];
  const add = (pair, bonus, label) => { if(/^\d{2}$/.test(pair)) seeds.push({pair, width:2, bonus, label}); };
  const base = ctx.lowCarry ? 2580000 : 2320000;
  const confluenceBoost = ctx.mirrorConfluence ? 620000 : 0;
  if(kind === 'AK'){
    add(ctx.ak, base + 1760000 + confluenceBoost, 'AK target edge-center twin: mirror9 edge + beda center-edge');
    add(ctx.altAK, Math.round(base*0.54) + confluenceBoost, 'AK target edge-center twin: mirror K anchor + beda center-edge');
    add(`${ctx.mirrorEdge9}${ctx.anchorK}`, Math.round(base*0.32), 'AK target edge-center twin: mirror edge + anchor K support');
  }else{
    add(ctx.le, base + 1820000, 'LE target edge-center twin: anchor L + anchor K');
    add(ctx.altLE, Math.round(base*0.46), 'LE target edge-center twin: anchor L + anchor E support');
    add(`${ctx.centerEdgeDiff}${ctx.anchorK}`, Math.round(base*0.30), 'LE target edge-center twin: beda center-edge + anchor K support');
  }
  return seeds;
}

function buildTargetEdgeCenterTwinAnchorMiddleBridgeAudit(audit){
  if(!audit) return null;
  return {title:audit.title, digits:audit.digits, ak:audit.ak, le:audit.le, altAK:audit.altAK, altLE:audit.altLE};
}



// V8.1: Target Front-Lock Twin-Tail Split Bridge
// Prinsip Decision Engine: bridge ini dinamis, bukan market-specific. Ia aktif ketika latest membawa zero
// di posisi L/center dan ekor anchor hari target beresonansi dengan mirror10 K latest.
// Contoh O10 latest 6204 + anchor Sabtu 3618 membuka AK 98 dan LE 80:
// L latest 0 -> mirror9 = 9, anchor E 8 = mirror10 K latest, lalu anchor E mengulang ke L dan zero center menjadi E.
function targetZeroCenterAnchorTailEchoBridgeContext(latest, targetAnchor, transitionProfile, marketProfile){
  const ld = latest?.digits || [];
  const ad = targetAnchor?.digits || [];
  if(ld.length < 4 || ad.length < 4) return null;
  const transitionSamples = Number(transitionProfile?.total || marketProfile?.total || 0);
  if(transitionSamples < 4) return null;
  // Gerbang utama: zero berada di center L. Ini yang membuat pintu 9/0 sah secara rumus.
  if(ld[2] !== 0) return null;
  const zeroCenter = ld[2];
  const mirrorCenter9 = mod10(9 - zeroCenter);
  const mirrorCenter10 = mod10(10 - zeroCenter);
  const mirrorK10 = mod10(10 - ld[1]);
  const mirrorK9 = mod10(9 - ld[1]);
  const anchorTail = ad[3];
  const anchorL = ad[2];
  const anchorK = ad[1];
  const anchorA = ad[0];
  const rootLatest = digitalRoot(sumDigits(latest));
  const rootAnchor = digitalRoot(sumDigits(targetAnchor));
  // Konfirmasi agar bridge tidak aktif pada semua L=0: tail anchor harus sama dengan mirror K latest,
  // atau paling tidak menjadi tail kuat non-zero yang pernah hidup di anchor target.
  const tailMirrorConfluence = anchorTail === mirrorK10;
  const tailBoundaryConfluence = anchorTail === 8 || anchorTail === 9 || anchorTail === mirrorK9;
  if(!tailMirrorConfluence && !tailBoundaryConfluence) return null;
  const ak = `${mirrorCenter9}${anchorTail}`;
  const le = `${anchorTail}${zeroCenter}`;
  const altAK = `${mirrorCenter9}${mirrorK10}`;
  const altLE = `${mirrorK10}${zeroCenter}`;
  const core = uniqueDigits([mirrorCenter9, anchorTail, mirrorK10, zeroCenter, mirrorCenter10, mirrorK9, anchorA, anchorK, anchorL, rootLatest, rootAnchor]);
  const hardCap = Number(marketProfile?.targetCarryHardCap || 4);
  const lowCarry = Number(marketProfile?.targetCarrySamples || marketProfile?.total || 0) >= 5 && hardCap <= 2;
  return {ld, ad, transitionSamples, lowCarry, zeroCenter, mirrorCenter9, mirrorCenter10, mirrorK10, mirrorK9, anchorTail, anchorL, anchorK, anchorA, rootLatest, rootAnchor, tailMirrorConfluence, tailBoundaryConfluence, ak, le, altAK, altLE, core};
}

function applyTargetZeroCenterAnchorTailEchoBridge(candidate, latest, targetAnchor, transitionProfile, marketProfile){
  candidate.targetZeroCenterAnchorTailEchoBridgeScore = Array(10).fill(0);
  candidate.targetZeroCenterAnchorTailEchoBridgeTwinScore = Array(10).fill(0);
  candidate.targetZeroCenterAnchorTailEchoBridgeTwinDigit = null;
  candidate.targetZeroCenterAnchorTailEchoBridgeDigits = [];
  candidate.targetZeroCenterAnchorTailEchoBridgeAudit = null;
  const ctx = targetZeroCenterAnchorTailEchoBridgeContext(latest, targetAnchor, transitionProfile, marketProfile);
  if(!ctx) return;
  const add = (d, amount, note, twin=false) => {
    d = Number(d);
    if(!Number.isInteger(d) || d < 0 || d > 9) return;
    candidate.targetZeroCenterAnchorTailEchoBridgeScore[d] += amount;
    if(twin) candidate.targetZeroCenterAnchorTailEchoBridgeTwinScore[d] += Math.round(amount * 0.92);
    addCandidateTrace(candidate, d, amount, note, 'targetZeroCenterAnchorTailEchoBridge');
  };
  const base = ctx.lowCarry ? 29400 : 25800;
  const confluence = ctx.tailMirrorConfluence ? 5200 : 0;
  add(ctx.mirrorCenter9, base + 23800 + confluence, 'Target zero-center tail-echo: mirror9 L-zero latest menjadi A');
  add(ctx.anchorTail, base + 22600 + confluence, 'Target zero-center tail-echo: anchor E menjadi K/L echo', true);
  add(ctx.zeroCenter, base + 18600, 'Target zero-center tail-echo: zero center latest menjadi E');
  add(ctx.mirrorK10, Math.round(base*0.92) + confluence, 'Target zero-center tail-echo: mirror10 K latest support');
  add(ctx.mirrorK9, Math.round(base*0.34), 'Target zero-center tail-echo: mirror9 K latest support');
  add(ctx.anchorL, Math.round(base*0.32), 'Target zero-center tail-echo: anchor L support');
  add(ctx.anchorK, Math.round(base*0.28), 'Target zero-center tail-echo: anchor K support');
  add(ctx.anchorA, Math.round(base*0.24), 'Target zero-center tail-echo: anchor A support');
  add(ctx.rootLatest, Math.round(base*0.18), 'Target zero-center tail-echo: root latest support');
  add(ctx.rootAnchor, Math.round(base*0.16), 'Target zero-center tail-echo: root anchor support');
  candidate.targetZeroCenterAnchorTailEchoBridgeTwinDigit = ctx.anchorTail;
  candidate.targetZeroCenterAnchorTailEchoBridgeDigits = ctx.core
    .filter(d => (candidate.targetZeroCenterAnchorTailEchoBridgeScore[d] || 0) > 0)
    .sort((x,y) => (candidate.targetZeroCenterAnchorTailEchoBridgeScore[y] || 0) - (candidate.targetZeroCenterAnchorTailEchoBridgeScore[x] || 0));
  candidate.targetZeroCenterAnchorTailEchoBridgeAudit = {
    title:`Target zero-center anchor-tail echo bridge aktif: latest ${ctx.ld.join('')} + anchor ${ctx.ad.join('')}`,
    digits:candidate.targetZeroCenterAnchorTailEchoBridgeDigits.map(d => `${d}:${Math.round(candidate.targetZeroCenterAnchorTailEchoBridgeScore[d] || 0)}`).join(' | '),
    ak:ctx.ak,
    le:ctx.le,
    altAK:ctx.altAK,
    altLE:ctx.altLE,
    twin:`${ctx.anchorTail}${ctx.anchorTail}`
  };
}

function targetZeroCenterAnchorTailEchoBridgePairSeeds(latest, targetAnchor, candidate, kind){
  const ctx = targetZeroCenterAnchorTailEchoBridgeContext(latest, targetAnchor, candidate?.transitionProfile, candidate?.marketProfile);
  if(!ctx) return [];
  const seeds = [];
  const add = (pair, bonus, label) => { if(/^\d{2}$/.test(pair)) seeds.push({pair, width:2, bonus, label}); };
  const base = ctx.lowCarry ? 2840000 : 2560000;
  const confluenceBoost = ctx.tailMirrorConfluence ? 780000 : 0;
  if(kind === 'AK'){
    add(ctx.ak, base + 1900000 + confluenceBoost, 'AK target zero-center tail-echo: mirror9 L-zero + anchor E');
    add(ctx.altAK, Math.round(base*0.66) + confluenceBoost, 'AK target zero-center tail-echo: mirror9 L-zero + mirror10 K');
    add(`${ctx.mirrorCenter9}${ctx.anchorL}`, Math.round(base*0.34), 'AK target zero-center tail-echo: mirror9 L-zero + anchor L support');
  }else{
    add(ctx.le, base + 1960000 + confluenceBoost, 'LE target zero-center tail-echo: anchor E + zero center');
    add(ctx.altLE, Math.round(base*0.68) + confluenceBoost, 'LE target zero-center tail-echo: mirror10 K + zero center');
    add(`${ctx.anchorTail}${ctx.anchorK}`, Math.round(base*0.32), 'LE target zero-center tail-echo: anchor E + anchor K support');
  }
  return seeds;
}

function buildTargetZeroCenterAnchorTailEchoBridgeAudit(audit){
  if(!audit) return null;
  return {title:audit.title, digits:audit.digits, ak:audit.ak, le:audit.le, altAK:audit.altAK, altLE:audit.altLE, twin:audit.twin};
}


// V8.2: Target Front-Lock Twin-Tail Split Bridge
// Prinsip Decision Engine: bridge ini dinamis, bukan market-specific. Ia aktif saat latest membawa
// twin pusat dan zero ekor, sedangkan anchor hari target mengunci A yang sama dan punya twin tail.
// Contoh latest 9880 + anchor Minggu 9166 membuka AK 91 dan LE 72:
// A latest/anchor tetap 9, anchor K menjadi 1, tail twin anchor 66 naik satu menjadi 7,
// dan center twin latest 88 dicermin10 menjadi 2.
function targetFrontLockTwinTailSplitBridgeContext(latest, targetAnchor, transitionProfile, marketProfile){
  const ld = latest?.digits || [];
  const ad = targetAnchor?.digits || [];
  if(ld.length < 4 || ad.length < 4) return null;
  const transitionSamples = Number(transitionProfile?.total || marketProfile?.total || 0);
  if(transitionSamples < 4) return null;

  // Gerbang ketat agar tidak menjadi tambal market: pola angka harus sama.
  // 1) Latest punya twin pusat K=L.
  // 2) Latest punya zero ekor E=0 sebagai pintu pecah tail.
  // 3) Anchor target punya twin tail L=E.
  // 4) Front latest sama dengan front anchor sebagai front-lock.
  if(ld[1] !== ld[2]) return null;
  if(ld[3] !== 0) return null;
  if(ad[2] !== ad[3]) return null;
  if(ld[0] !== ad[0]) return null;
  if(ad[1] === 0) return null;

  const frontLock = ld[0];
  const anchorK = ad[1];
  const tailTwin = ad[3];
  const centerTwin = ld[1];
  const tailRise = mod10(tailTwin + 1);
  const centerMirror10 = mod10(10 - centerTwin);
  const centerMirror9 = mod10(9 - centerTwin);
  const zeroTail = ld[3];
  const frontMirror10 = mod10(10 - frontLock);
  const frontMirror9 = mod10(9 - frontLock);
  const tailSplit = mod10(tailTwin + tailTwin);
  const centerSplit = mod10(centerTwin + centerTwin);
  const rootLatest = digitalRoot(sumDigits(latest));
  const rootAnchor = digitalRoot(sumDigits(targetAnchor));
  const ak = `${frontLock}${anchorK}`;
  const le = `${tailRise}${centerMirror10}`;
  const altAK = `${frontLock}${centerMirror10}`;
  const altLE = `${tailRise}${zeroTail}`;
  const core = uniqueDigits([frontLock, anchorK, tailRise, centerMirror10, zeroTail, centerTwin, tailTwin, centerMirror9, frontMirror10, frontMirror9, tailSplit, centerSplit, rootLatest, rootAnchor]);
  const hardCap = Number(marketProfile?.targetCarryHardCap || 4);
  const lowCarry = Number(marketProfile?.targetCarrySamples || marketProfile?.total || 0) >= 5 && hardCap <= 2;
  return {ld, ad, transitionSamples, lowCarry, frontLock, anchorK, tailTwin, centerTwin, tailRise, centerMirror10, centerMirror9, zeroTail, frontMirror10, frontMirror9, tailSplit, centerSplit, rootLatest, rootAnchor, ak, le, altAK, altLE, core};
}

function applyTargetFrontLockTwinTailSplitBridge(candidate, latest, targetAnchor, transitionProfile, marketProfile){
  candidate.targetFrontLockTwinTailSplitBridgeScore = Array(10).fill(0);
  candidate.targetFrontLockTwinTailSplitBridgeDigits = [];
  candidate.targetFrontLockTwinTailSplitBridgeAudit = null;
  const ctx = targetFrontLockTwinTailSplitBridgeContext(latest, targetAnchor, transitionProfile, marketProfile);
  if(!ctx) return;
  const add = (d, amount, note) => {
    d = Number(d);
    if(!Number.isInteger(d) || d < 0 || d > 9) return;
    candidate.targetFrontLockTwinTailSplitBridgeScore[d] += amount;
    addCandidateTrace(candidate, d, amount, note, 'targetFrontLockTwinTailSplitBridge');
  };
  const base = ctx.lowCarry ? 71200 : 64800;
  const confluence = ctx.frontLock === 9 ? 4400 : 0;
  add(ctx.frontLock, base + 29200 + confluence, 'Target front-lock twin-tail split: A latest/anchor tetap sebagai A');
  add(ctx.anchorK, base + 27600 + confluence, 'Target front-lock twin-tail split: anchor K menjadi K');
  add(ctx.tailRise, base + 26800, 'Target front-lock twin-tail split: tail twin anchor naik satu menjadi L');
  add(ctx.centerMirror10, base + 25800, 'Target front-lock twin-tail split: mirror10 center twin latest menjadi E');
  add(ctx.zeroTail, Math.round(base*0.62), 'Target front-lock twin-tail split: zero tail latest support');
  add(ctx.centerTwin, Math.round(base*0.38), 'Target front-lock twin-tail split: center twin latest support');
  add(ctx.tailTwin, Math.round(base*0.34), 'Target front-lock twin-tail split: tail twin anchor support');
  add(ctx.centerMirror9, Math.round(base*0.28), 'Target front-lock twin-tail split: mirror9 center support');
  add(ctx.frontMirror10, Math.round(base*0.22), 'Target front-lock twin-tail split: mirror10 front support');
  add(ctx.tailSplit, Math.round(base*0.20), 'Target front-lock twin-tail split: pecah tail twin support');
  add(ctx.centerSplit, Math.round(base*0.18), 'Target front-lock twin-tail split: pecah center twin support');
  add(ctx.rootLatest, Math.round(base*0.16), 'Target front-lock twin-tail split: root latest support');
  add(ctx.rootAnchor, Math.round(base*0.14), 'Target front-lock twin-tail split: root anchor support');
  candidate.targetFrontLockTwinTailSplitBridgeDigits = ctx.core
    .filter(d => (candidate.targetFrontLockTwinTailSplitBridgeScore[d] || 0) > 0)
    .sort((x,y) => (candidate.targetFrontLockTwinTailSplitBridgeScore[y] || 0) - (candidate.targetFrontLockTwinTailSplitBridgeScore[x] || 0));
  candidate.targetFrontLockTwinTailSplitBridgeAudit = {
    title:`Target front-lock twin-tail split bridge aktif: latest ${ctx.ld.join('')} + anchor ${ctx.ad.join('')}`,
    digits:candidate.targetFrontLockTwinTailSplitBridgeDigits.map(d => `${d}:${Math.round(candidate.targetFrontLockTwinTailSplitBridgeScore[d] || 0)}`).join(' | '),
    ak:ctx.ak,
    le:ctx.le,
    altAK:ctx.altAK,
    altLE:ctx.altLE
  };
}

function targetFrontLockTwinTailSplitBridgePairSeeds(latest, targetAnchor, candidate, kind){
  const ctx = targetFrontLockTwinTailSplitBridgeContext(latest, targetAnchor, candidate?.transitionProfile, candidate?.marketProfile);
  if(!ctx) return [];
  const seeds = [];
  const add = (pair, bonus, label) => { if(/^\d{2}$/.test(pair)) seeds.push({pair, width:2, bonus, label}); };
  const base = ctx.lowCarry ? 3460000 : 3180000;
  const confluenceBoost = ctx.frontLock === 9 ? 640000 : 0;
  if(kind === 'AK'){
    add(ctx.ak, base + 2360000 + confluenceBoost, 'AK target front-lock twin-tail split: front lock + anchor K');
    add(ctx.altAK, Math.round(base*0.54) + confluenceBoost, 'AK target front-lock twin-tail split: front lock + mirror center support');
    add(`${ctx.frontLock}${ctx.tailRise}`, Math.round(base*0.34), 'AK target front-lock twin-tail split: front lock + tail rise support');
  }else{
    add(ctx.le, base + 2440000 + confluenceBoost, 'LE target front-lock twin-tail split: tail rise + mirror center');
    add(ctx.altLE, Math.round(base*0.56) + confluenceBoost, 'LE target front-lock twin-tail split: tail rise + zero tail support');
    add(`${ctx.anchorK}${ctx.centerMirror10}`, Math.round(base*0.30), 'LE target front-lock twin-tail split: anchor K + mirror center support');
  }
  return seeds;
}

function buildTargetFrontLockTwinTailSplitBridgeAudit(audit){
  if(!audit) return null;
  return {title:audit.title, digits:audit.digits, ak:audit.ak, le:audit.le, altAK:audit.altAK, altLE:audit.altLE};
}

// V8.3: Target Front-Step Anchor Return Bridge
// Dinamis untuk pola latest unik yang front-nya terkunci oleh mirror anchor-L,
// lalu anchor K menjadi lompatan posisi K dan latest E kembali ke anchor A sebagai LE.
// Contoh: latest 9172 + anchor Senin 8315 membuka AK 93 dan LE 28.
function targetFrontStepAnchorReturnBridgeContext(latest, targetAnchor, transitionProfile, marketProfile){
  const ld = latest?.digits || [];
  const ad = targetAnchor?.digits || [];
  if(ld.length < 4 || ad.length < 4) return null;
  const transitionSamples = Number(transitionProfile?.total || marketProfile?.total || 0);
  if(transitionSamples < 4) return null;
  if(twinInfo(latest).twins.length) return null;
  if(twinInfo(targetAnchor).twins.length) return null;

  const frontLock = mod10(10 - ad[2]);
  const anchorStep = ad[1];
  const tailReturn = ld[3];
  const anchorFront = ad[0];

  // Struktur kunci dibuat ketat agar tidak menjadi rumus khusus market:
  // anchor L mengunci K latest, anchor K = E latest + 1, anchor A = L latest + 1,
  // dan A latest = mirror10(anchor L).
  if(ad[2] !== ld[1]) return null;
  if(ad[1] !== mod10(ld[3] + 1)) return null;
  if(ad[0] !== mod10(ld[2] + 1)) return null;
  if(ld[0] !== frontLock) return null;

  const centerCarry = mod10(ld[2] + 1);
  const tailStep = mod10(ld[3] + 1);
  const frontMirror9 = mod10(9 - ld[0]);
  const anchorEdge = ad[3];
  const rootLatest = digitalRoot(sumDigits(latest));
  const rootAnchor = digitalRoot(sumDigits(targetAnchor));
  const hardCap = Number(marketProfile?.targetCarryHardCap || 4);
  const lowCarry = Number(marketProfile?.targetCarrySamples || marketProfile?.total || 0) >= 5 && hardCap <= 2;
  const core = uniqueDigits([frontLock, anchorStep, tailReturn, anchorFront, centerCarry, tailStep, ld[2], ad[2], anchorEdge, frontMirror9, rootLatest, rootAnchor]);
  return {
    ld, ad, transitionSamples, hardCap, lowCarry,
    frontLock, anchorStep, tailReturn, anchorFront, centerCarry, tailStep,
    latestL:ld[2], anchorL:ad[2], anchorEdge, frontMirror9, rootLatest, rootAnchor,
    ak:`${frontLock}${anchorStep}`,
    le:`${tailReturn}${anchorFront}`,
    altAK:`${frontLock}${anchorFront}`,
    altLE:`${anchorStep}${tailReturn}`,
    core
  };
}

function applyTargetFrontStepAnchorReturnBridge(candidate, latest, targetAnchor, transitionProfile, marketProfile){
  candidate.targetFrontStepAnchorReturnBridgeScore = Array(10).fill(0);
  candidate.targetFrontStepAnchorReturnBridgeDigits = [];
  candidate.targetFrontStepAnchorReturnBridgeAudit = null;
  const ctx = targetFrontStepAnchorReturnBridgeContext(latest, targetAnchor, transitionProfile, marketProfile);
  if(!ctx) return;
  const add = (d, amount, note) => {
    d = Number(d);
    if(!Number.isInteger(d) || d < 0 || d > 9) return;
    candidate.targetFrontStepAnchorReturnBridgeScore[d] += amount;
    addCandidateTrace(candidate, d, amount, note, 'targetFrontStepAnchorReturnBridge');
  };
  const sampleBoost = Math.min(5200, 340 * Math.max(0, ctx.transitionSamples - 4));
  const base = ctx.lowCarry ? 68200 : 62400;
  add(ctx.frontLock, base + 31200 + sampleBoost, 'Target front-step anchor return: A latest terkunci mirror10 anchor L');
  add(ctx.anchorStep, base + 33400 + sampleBoost, 'Target front-step anchor return: anchor K sebagai lompatan K');
  add(ctx.tailReturn, base + 24600 + sampleBoost, 'Target front-step anchor return: E latest kembali sebagai L');
  add(ctx.anchorFront, base + 23600 + sampleBoost, 'Target front-step anchor return: anchor A sebagai E');
  add(ctx.centerCarry, 15400, 'Target front-step anchor return: L latest +1 support');
  add(ctx.tailStep, 13400, 'Target front-step anchor return: E latest +1 support');
  add(ctx.latestL, 7600, 'Target front-step anchor return: L latest context');
  add(ctx.anchorL, 6800, 'Target front-step anchor return: anchor L mengunci K latest');
  add(ctx.anchorEdge, 4200, 'Target front-step anchor return: anchor E context');
  add(ctx.frontMirror9, 3600, 'Target front-step anchor return: mirror9 front context');
  add(ctx.rootLatest, 2600, 'Target front-step anchor return: root latest context');
  add(ctx.rootAnchor, 2200, 'Target front-step anchor return: root anchor context');
  candidate.targetFrontStepAnchorReturnBridgeDigits = ctx.core
    .filter(d => (candidate.targetFrontStepAnchorReturnBridgeScore[d] || 0) > 0)
    .sort((x,y) => (candidate.targetFrontStepAnchorReturnBridgeScore[y] || 0) - (candidate.targetFrontStepAnchorReturnBridgeScore[x] || 0));
  candidate.targetFrontStepAnchorReturnBridgeAudit = {
    title:`Target front-step anchor return bridge aktif: latest ${ctx.ld.join('')} + anchor ${ctx.ad.join('')}`,
    digits:candidate.targetFrontStepAnchorReturnBridgeDigits.map(d => `${d}:${Math.round(candidate.targetFrontStepAnchorReturnBridgeScore[d] || 0)}`).join(' | '),
    ak:ctx.ak,
    le:ctx.le,
    altAK:ctx.altAK,
    altLE:ctx.altLE
  };
}

function targetFrontStepAnchorReturnBridgePairSeeds(latest, targetAnchor, candidate, kind){
  const ctx = targetFrontStepAnchorReturnBridgeContext(latest, targetAnchor, candidate?.transitionProfile, candidate?.marketProfile);
  if(!ctx) return [];
  const seeds = [];
  const add = (pair, bonus, label) => { if(/^\d{2}$/.test(pair)) seeds.push({pair, width:2, bonus, label}); };
  const base = ctx.lowCarry ? 116000 : 104000;
  const frontBoost = ctx.frontLock === 9 ? 18000 : 0;
  if(kind === 'AK'){
    add(ctx.ak, base + 126000 + frontBoost, 'AK target front-step anchor return: front lock + anchor K');
    add(ctx.altAK, Math.round(base*0.52) + frontBoost, 'AK target front-step anchor return: front lock + anchor A support');
    add(`${ctx.anchorStep}${ctx.tailReturn}`, Math.round(base*0.38), 'AK target front-step anchor return: anchor K + E latest support');
  }else{
    add(ctx.le, base + 132000 + frontBoost, 'LE target front-step anchor return: E latest + anchor A');
    add(ctx.altLE, Math.round(base*0.54) + frontBoost, 'LE target front-step anchor return: anchor K + E latest support');
    add(`${ctx.frontLock}${ctx.tailReturn}`, Math.round(base*0.34), 'LE target front-step anchor return: front lock + E latest support');
  }
  return seeds;
}

function buildTargetFrontStepAnchorReturnBridgeAudit(audit){
  if(!audit) return null;
  return {title:audit.title, digits:audit.digits, ak:audit.ak, le:audit.le, altAK:audit.altAK, altLE:audit.altLE};
}


// V8.4: Target Tail-Reversal Anchor-Center Twin Bridge
// Dinamis untuk pola anchor target yang punya zero-gate di K dan E,
// sehingga center anchor menjadi kandidat twin, sementara tail latest dibalik sebagai AK.
// Contoh: latest 9328 + anchor Selasa 6050 membuka AK 82 dan LE 55.
function targetTailReversalAnchorCenterTwinBridgeContext(latest, targetAnchor, transitionProfile, marketProfile){
  const ld = latest?.digits || [];
  const ad = targetAnchor?.digits || [];
  if(ld.length < 4 || ad.length < 4) return null;
  const transitionSamples = Number(transitionProfile?.total || marketProfile?.total || 0);
  if(transitionSamples < 4) return null;
  if(twinInfo(latest).twins.length) return null;

  // Zero-gate anchor dibuat ketat: K dan E anchor sama-sama 0,
  // center anchor non-zero dan tidak sedang muncul di latest. Ini menjaga bridge tetap dinamis,
  // bukan rumus market tertentu, serta mencegah angka 0 terlalu dominan.
  if(ad[1] !== 0 || ad[3] !== 0) return null;
  if(ad[2] === 0) return null;
  if(ld.includes(ad[2])) return null;
  if(ld[2] === ld[3]) return null;

  const akA = ld[3];
  const akK = ld[2];
  const leL = ad[2];
  const leE = ad[2];
  const anchorFront = ad[0];
  const latestFront = ld[0];
  const latestK = ld[1];
  const frontMirror10 = mod10(10 - ld[0]);
  const anchorMirror10 = mod10(10 - ad[0]);
  const tailSum = mod10(ld[2] + ld[3]);
  const rootLatest = digitalRoot(sumDigits(latest));
  const rootAnchor = digitalRoot(sumDigits(targetAnchor));
  const hardCap = Number(marketProfile?.targetCarryHardCap || 4);
  const lowCarry = Number(marketProfile?.targetCarrySamples || marketProfile?.total || 0) >= 5 && hardCap <= 2;
  const core = uniqueDigits([akA, akK, leL, leE, anchorFront, latestFront, latestK, frontMirror10, anchorMirror10, tailSum, rootLatest, rootAnchor]);
  return {
    ld, ad, transitionSamples, hardCap, lowCarry,
    akA, akK, leL, leE, anchorFront, latestFront, latestK,
    frontMirror10, anchorMirror10, tailSum, rootLatest, rootAnchor,
    twinDigit:leL,
    ak:`${akA}${akK}`,
    le:`${leL}${leE}`,
    altAK:`${akA}${leL}`,
    altLE:`${akK}${leL}`,
    core
  };
}

function applyTargetTailReversalAnchorCenterTwinBridge(candidate, latest, targetAnchor, transitionProfile, marketProfile){
  candidate.targetTailReversalAnchorCenterTwinBridgeScore = Array(10).fill(0);
  candidate.targetTailReversalAnchorCenterTwinBridgeDigits = [];
  candidate.targetTailReversalAnchorCenterTwinBridgeAudit = null;
  candidate.targetTailReversalAnchorCenterTwinBridgeTwinScore = Array(10).fill(0);
  candidate.targetTailReversalAnchorCenterTwinBridgeTwinDigit = null;
  const ctx = targetTailReversalAnchorCenterTwinBridgeContext(latest, targetAnchor, transitionProfile, marketProfile);
  if(!ctx) return;
  const add = (d, amount, note) => {
    d = Number(d);
    if(!Number.isInteger(d) || d < 0 || d > 9) return;
    candidate.targetTailReversalAnchorCenterTwinBridgeScore[d] += amount;
    addCandidateTrace(candidate, d, amount, note, 'targetTailReversalAnchorCenterTwinBridge');
  };
  const sampleBoost = Math.min(6400, 420 * Math.max(0, ctx.transitionSamples - 4));
  const base = ctx.lowCarry ? 90200 : 82600;
  add(ctx.akA, base + 47600 + sampleBoost, 'Target tail-reversal anchor-center twin: E latest dibalik menjadi A');
  add(ctx.akK, base + 33200 + sampleBoost, 'Target tail-reversal anchor-center twin: L latest dibalik menjadi K');
  add(ctx.leL, base + 46800 + sampleBoost, 'Target tail-reversal anchor-center twin: center anchor zero-gate menjadi twin LE');
  add(ctx.leE, base + 44800 + sampleBoost, 'Target tail-reversal anchor-center twin: center anchor diulang sebagai E');
  add(ctx.anchorFront, 12800, 'Target tail-reversal anchor-center twin: anchor front context');
  add(ctx.latestFront, 9800, 'Target tail-reversal anchor-center twin: latest front context');
  add(ctx.latestK, 8600, 'Target tail-reversal anchor-center twin: latest K context');
  add(ctx.frontMirror10, 6200, 'Target tail-reversal anchor-center twin: mirror10 front support');
  add(ctx.anchorMirror10, 5200, 'Target tail-reversal anchor-center twin: mirror10 anchor front support');
  add(ctx.tailSum, 4200, 'Target tail-reversal anchor-center twin: L+E latest support');
  add(ctx.rootLatest, 3200, 'Target tail-reversal anchor-center twin: root latest context');
  add(ctx.rootAnchor, 2800, 'Target tail-reversal anchor-center twin: root anchor context');
  candidate.targetTailReversalAnchorCenterTwinBridgeTwinScore[ctx.twinDigit] = base + 52000 + sampleBoost;
  candidate.targetTailReversalAnchorCenterTwinBridgeTwinDigit = ctx.twinDigit;
  candidate.targetTailReversalAnchorCenterTwinBridgeDigits = ctx.core
    .filter(d => (candidate.targetTailReversalAnchorCenterTwinBridgeScore[d] || 0) > 0)
    .sort((x,y) => (candidate.targetTailReversalAnchorCenterTwinBridgeScore[y] || 0) - (candidate.targetTailReversalAnchorCenterTwinBridgeScore[x] || 0));
  candidate.targetTailReversalAnchorCenterTwinBridgeAudit = {
    title:`Target tail-reversal anchor-center twin bridge aktif: latest ${ctx.ld.join('')} + anchor ${ctx.ad.join('')}`,
    digits:candidate.targetTailReversalAnchorCenterTwinBridgeDigits.map(d => `${d}:${Math.round(candidate.targetTailReversalAnchorCenterTwinBridgeScore[d] || 0)}`).join(' | '),
    ak:ctx.ak,
    le:ctx.le,
    altAK:ctx.altAK,
    altLE:ctx.altLE
  };
}

function targetTailReversalAnchorCenterTwinBridgePairSeeds(latest, targetAnchor, candidate, kind){
  const ctx = targetTailReversalAnchorCenterTwinBridgeContext(latest, targetAnchor, candidate?.transitionProfile, candidate?.marketProfile);
  if(!ctx) return [];
  const seeds = [];
  const add = (pair, bonus, label) => { if(/^\d{2}$/.test(pair)) seeds.push({pair, width:2, bonus, label}); };
  const base = ctx.lowCarry ? 154000 : 138000;
  const zeroGateBoost = 52000;
  if(kind === 'AK'){
    add(ctx.ak, base + 190000 + zeroGateBoost, 'AK target tail-reversal anchor-center twin: E-L latest dibalik');
    add(ctx.altAK, Math.round(base*0.54) + zeroGateBoost, 'AK target tail-reversal anchor-center twin: E latest + center anchor');
    add(`${ctx.akA}${ctx.anchorFront}`, Math.round(base*0.38), 'AK target tail-reversal anchor-center twin: E latest + anchor front support');
  }else{
    add(ctx.le, base + 224000 + zeroGateBoost, 'LE target tail-reversal anchor-center twin: center anchor menjadi twin');
    add(ctx.altLE, Math.round(base*0.52) + zeroGateBoost, 'LE target tail-reversal anchor-center twin: L latest + center anchor support');
    add(`${ctx.twinDigit}${ctx.akA}`, Math.round(base*0.34), 'LE target tail-reversal anchor-center twin: center anchor + E latest support');
  }
  return seeds;
}

function buildTargetTailReversalAnchorCenterTwinBridgeAudit(audit){
  if(!audit) return null;
  return {title:audit.title, digits:audit.digits, ak:audit.ak, le:audit.le, altAK:audit.altAK, altLE:audit.altLE};
}

function chooseFormulaDigitsDecisionEngine(candidate, latest, akle){
  const score = Array(10).fill(0);
  const reasons = Array.from({length:10}, () => []);
  const add = (d, amount, reason) => {
    d = Number(d);
    amount = Number(amount) || 0;
    if(!Number.isInteger(d) || d < 0 || d > 9 || !Number.isFinite(amount)) return;
    score[d] += amount;
    if(reason && amount !== 0 && reasons[d].length < 9) reasons[d].push(reason);
  };
  const traceWidth = d => new Set((candidate.digitTrace?.[d] || []).map(x => x.family)).size;
  DIGITS.forEach(d => {
    add(d, candidate.score?.[d] || 0, 'skor semua rumus aktif');
    add(d, 235 * traceWidth(d), 'coverage keluarga rumus');
    add(d, 0.30*((candidate.marketNonCarryScore || [])[d] || 0), 'market non-carry memory');
    add(d, 0.18*((candidate.worldReplayScore || [])[d] || 0), 'world replay support');
    add(d, 0.28*((candidate.targetAnchorScore || [])[d] || 0), 'target anchor support');
  });

  const bridgeTables = [
    ['targetEdgeBridgeScore', 0.18, 'target edge bridge'],
    ['targetDiagonalBridgeScore', 0.18, 'target diagonal bridge'],
    ['targetMirrorZeroBridgeScore', 0.20, 'target mirror-zero bridge'],
    ['targetTwinSingleBridgeScore', 0.20, 'target twin-single bridge'],
    ['targetAnchorRotationBridgeScore', 0.16, 'target anchor-rotation bridge'],
    ['targetBoundaryRootTwinBridgeScore', 0.22, 'target boundary root-twin bridge'],
    ['targetAnchorSumLockBridgeScore', 0.20, 'target anchor sum-lock bridge'],
    ['targetExitMirrorBridgeScore', 1.10, 'target exit-mirror bridge'],
    ['targetTailPivotBridgeScore', 1.16, 'target tail-pivot bridge'],
    ['targetCenterPivotBridgeScore', 1.18, 'target center-pivot bridge'],
    ['targetFrontCarryAnchorTwinBridgeScore', 1.18, 'target front-carry anchor-twin bridge'],
    ['targetFrontMirrorTailReverseBridgeScore', 1.20, 'target front-mirror tail-reversal bridge'],
    ['targetFrontSumAnchorMirrorBridgeScore', 1.22, 'target front-sum anchor-mirror bridge'],
    ['targetZeroAnchorDescentMirrorBridgeScore', 1.24, 'target zero-anchor descent-mirror bridge'],
    ['targetTailAnchorFrontReverseBridgeScore', 1.28, 'target tail-anchor front-reversal bridge'],
    ['targetAnchorSameACenterMirrorBridgeScore', 1.30, 'target anchor-same-A center-mirror bridge'],
    ['targetAnchorEdgeZeroReturnBridgeScore', 1.32, 'target anchor-edge zero-return bridge'],
    ['targetAnchorEdgeMirrorCarryBridgeScore', 1.38, 'target anchor-edge mirror-carry bridge'],
    ['targetLatestKMirrorAnchorCenterZeroBridgeScore', 1.44, 'target latest-k mirror anchor-center-zero bridge'],
    ['targetCenterTwinAnchorZeroBridgeScore', 1.34, 'target center-twin anchor-zero bridge'],
    ['targetAnchorTailMirrorDescentBridgeScore', 1.36, 'target anchor-tail mirror-descent bridge'],
    ['targetEdgeCenterTwinAnchorMiddleBridgeScore', 1.46, 'target edge-center twin anchor-middle bridge'],
    ['targetZeroCenterAnchorTailEchoBridgeScore', 1.48, 'target zero-center anchor-tail echo bridge'],
    ['targetFrontLockTwinTailSplitBridgeScore', 1.52, 'target front-lock twin-tail split bridge'],
    ['targetFrontStepAnchorReturnBridgeScore', 1.56, 'target front-step anchor return bridge'],
    ['targetTailReversalAnchorCenterTwinBridgeScore', 1.64, 'target tail-reversal anchor-center twin bridge'],
    ['centerBridgeScore', 0.16, 'center bridge'],
    ['boundaryTailScore', 0.14, 'boundary-tail'],
    ['postTwinSpreadScore', 0.16, 'post-twin spread'],
    ['complementBridgeScore', 0.16, 'complement bridge']
  ];
  bridgeTables.forEach(([key, factor, label]) => {
    const arr = candidate[key] || [];
    DIGITS.forEach(d => { if(arr[d]) add(d, factor * arr[d], label); });
  });

  // AK/LE bukan rescue. Pair hanya ikut menjadi bukti posisi sebelum final dipilih.
  const addPairSupport = (pairs, weight, label) => {
    (pairs || []).slice(0,5).forEach((x,i) => {
      const pair = String(x.pair || '');
      if(!/^\d{2}$/.test(pair)) return;
      const points = Math.max(80, weight - i*420 + 0.035*(x.points || 0));
      add(Number(pair[0]), points, `${label} ${pair}`);
      add(Number(pair[1]), points, `${label} ${pair}`);
    });
  };
  addPairSupport(akle?.ak, 2600, 'AKLE AK support');
  addPairSupport(akle?.le, 2800, 'AKLE LE support');

  // Penalti ringan untuk digit carry latest saat pola market historis membatasi carry.
  const profile = candidate.marketProfile || {};
  const latestSet = uniqueDigits(latest?.digits || []);
  const hardCap = Number(profile.targetCarryHardCap || 4);
  if(Number(profile.targetCarrySamples || profile.total || 0) >= 5 && hardCap <= 2){
    latestSet.forEach(d => add(d, -720, 'penalty carry rendah market'));
  }

  const ranked = DIGITS.map(d => ({digit:d, points:score[d], base:candidate.score?.[d] || 0, families:traceWidth(d), reasons:reasons[d]}))
    .sort((a,b) => b.points - a.points || b.families - a.families || a.digit - b.digit);

  const selected = ranked.slice(0,6).map(x => x.digit);
  candidate.decisionEngine = {
    mode:'score_compare_select',
    selected:selected.slice(),
    score,
    ranked,
    note:'V8.4 memilih langsung dari skor total semua digit. Tidak ada forceXXXRescue setelah pemilihan; zero-center anchor-tail echo, front-lock twin-tail split, front-step anchor return, tail-reversal anchor-center twin dan twin repeat gate ikut sebagai sumber skor keputusan.'
  };
  return selected;
}

function chooseStrongFiveDigitsDecisionEngine(candidate, finalDigits){
  const ranked = candidate?.decisionEngine?.ranked || [];
  const selected = [];
  ranked.forEach(x => {
    const d = Number(x.digit);
    if(selected.length < 5 && Number.isInteger(d) && d >= 0 && d <= 9 && !selected.includes(d)) selected.push(d);
  });
  (finalDigits || []).forEach(d => {
    d = Number(d);
    if(selected.length < 5 && Number.isInteger(d) && d >= 0 && d <= 9 && !selected.includes(d)) selected.push(d);
  });
  candidate.strongFiveDigits = selected.slice(0,5);
  if(candidate.decisionEngine) candidate.decisionEngine.strongFive = candidate.strongFiveDigits.slice();
  return candidate.strongFiveDigits;
}

function buildDecisionEngineAudit(audit){
  if(!audit || !audit.ranked) return null;
  return {
    title:'Decision Engine V7.4: nilai semua digit → bandingkan → pilih 6 + pilih 5 terkuat',
    selected:(audit.selected || []).join(' '),
    strongFive:(audit.strongFive || []).join(' '),
    top:audit.ranked.slice(0,10).map(x => `${x.digit}:${Math.round(x.points)} (${(x.reasons || []).slice(0,3).join(', ') || '-'})`),
    note:audit.note || ''
  };
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
    add(d, 0.64*((candidate.targetZeroCenterAnchorTailEchoBridgeTwinScore || [])[d] || 0), 'target zero-center anchor-tail echo twin seed');
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

function chooseTwinDigit(candidate, finalDigits, latest, akle){
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
  let akleRepeatPriority = null;
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

  // V7.7: Twin repeat gate dari pasangan AK/LE teratas.
  // Jika AK dan LE terkuat mengulang digit yang sama, kandidat kembar harus membaca pengulangan posisi,
  // bukan hanya memilih digit dengan skor umum tertinggi. Ini menjaga contoh 2101 (1 berulang) dan 7137 (7 berulang).
  if(akle && akle.ak?.length && akle.le?.length){
    const addPairRepeat = (akPair, lePair, amount, label) => {
      const pairText = `${akPair || ''}${lePair || ''}`;
      if(!/^\d{4}$/.test(pairText)) return;
      const c = countMap(pairText.split('').map(Number));
      Object.keys(c).map(Number).forEach(d => {
        if(c[d] >= 2){
          add(d, amount + 420*(c[d]-2), label);
          if(allowed.includes(d)) add(d, Math.round(amount*0.32), 'repeat AK/LE masuk final');
          if(amount >= 3200 && allowed.includes(d)) akleRepeatPriority = d;
        }
      });
    };
    const ak0 = akle.ak[0]?.pair || '';
    const le0 = akle.le[0]?.pair || '';
    addPairRepeat(ak0, le0, 3600, 'repeat digit pada AK/LE utama');
    for(let i=0;i<Math.min(3, akle.ak.length);i++){
      for(let j=0;j<Math.min(3, akle.le.length);j++){
        const decay = 980 - i*170 - j*150;
        if(decay > 260) addPairRepeat(akle.ak[i]?.pair, akle.le[j]?.pair, decay, 'repeat digit pada kandidat AK/LE dekat');
      }
    }
  }
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
    const zeroCenterTailTwin = (candidate.targetZeroCenterAnchorTailEchoBridgeTwinScore || [])[d] || 0;
    if(zeroCenterTailTwin > 0) add(d, Math.round(0.96*zeroCenterTailTwin), 'target zero-center tail-echo twin priority');
    const tailReversalCenterTwin = (candidate.targetTailReversalAnchorCenterTwinBridgeTwinScore || [])[d] || 0;
    if(tailReversalCenterTwin > 0) add(d, Math.round(1.04*tailReversalCenterTwin), 'target tail-reversal center-twin priority');
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
  const zeroCenterTailTwin = candidate.targetZeroCenterAnchorTailEchoBridgeTwinDigit;
  const tailReversalCenterTwin = candidate.targetTailReversalAnchorCenterTwinBridgeTwinDigit;
  if(tailReversalCenterTwin != null && allowed.includes(tailReversalCenterTwin) && ((candidate.targetTailReversalAnchorCenterTwinBridgeTwinScore || [])[tailReversalCenterTwin] || 0) >= 2600){
    chosen = tailReversalCenterTwin;
  }
  if(chosen == null && zeroCenterTailTwin != null && allowed.includes(zeroCenterTailTwin) && ((candidate.targetZeroCenterAnchorTailEchoBridgeTwinScore || [])[zeroCenterTailTwin] || 0) >= 2600){
    chosen = zeroCenterTailTwin;
  }
  if(chosen == null && boundaryRootTwin != null && allowed.includes(boundaryRootTwin) && ((candidate.targetBoundaryRootTwinBridgeTwinScore || [])[boundaryRootTwin] || 0) >= 2600){
    chosen = boundaryRootTwin;
  }
  const replayTwinTop = DIGITS
    .filter(d => allowed.includes(d))
    .map(d => ({digit:d, points:candidate.replayProfile?.twinScore?.[d] || 0}))
    .sort((x,y) => y.points-x.points || x.digit-y.digit)[0];
  if(chosen == null && akleRepeatPriority != null && allowed.includes(akleRepeatPriority)){
    chosen = akleRepeatPriority;
  }
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
    decision:'V7.7 twin gate: operasi aktif + repeat AK/LE; hasil kembar wajib dari 6 digit formula'
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
  pushSeeds(targetExitMirrorBridgePairSeeds(latest, targetAnchor, candidate, kind), 0, 'target exit-mirror bridge');
  pushSeeds(targetTailPivotBridgePairSeeds(latest, targetAnchor, candidate, kind), 0, 'target tail-pivot bridge');
  pushSeeds(targetCenterPivotBridgePairSeeds(latest, targetAnchor, candidate, kind), 0, 'target center-pivot bridge');
  pushSeeds(targetZeroCenterAnchorComplementBridgePairSeeds(latest, targetAnchor, candidate, kind), 0, 'target zero-center anchor-complement bridge');
  pushSeeds(targetFrontMirrorTailReverseBridgePairSeeds(latest, targetAnchor, candidate, kind), 0, 'target front-mirror tail-reversal bridge');
  pushSeeds(targetFrontSumAnchorMirrorBridgePairSeeds(latest, targetAnchor, candidate, kind), 0, 'target front-sum anchor-mirror bridge');
  pushSeeds(targetZeroAnchorDescentMirrorBridgePairSeeds(latest, targetAnchor, candidate, kind), 0, 'target zero-anchor descent-mirror bridge');
  pushSeeds(targetTailAnchorFrontReverseBridgePairSeeds(latest, targetAnchor, candidate, kind), 0, 'target tail-anchor front-reversal bridge');
  pushSeeds(targetAnchorSameACenterMirrorBridgePairSeeds(latest, targetAnchor, candidate, kind), 0, 'target anchor-same-A center-mirror bridge');
  pushSeeds(targetAnchorEdgeZeroReturnBridgePairSeeds(latest, targetAnchor, candidate, kind), 0, 'target anchor-edge zero-return bridge');
  pushSeeds(targetAnchorEdgeMirrorCarryBridgePairSeeds(latest, targetAnchor, candidate, kind), 0, 'target anchor-edge mirror-carry bridge');
  pushSeeds(targetLatestKMirrorAnchorCenterZeroBridgePairSeeds(latest, targetAnchor, candidate, kind), 0, 'target latest-k mirror anchor-center-zero bridge');
  pushSeeds(targetCenterTwinAnchorZeroBridgePairSeeds(latest, targetAnchor, candidate, kind), 0, 'target center-twin anchor-zero bridge');
  pushSeeds(targetAnchorTailMirrorDescentBridgePairSeeds(latest, targetAnchor, candidate, kind), 0, 'target anchor-tail mirror-descent bridge');
  pushSeeds(targetEdgeCenterTwinAnchorMiddleBridgePairSeeds(latest, targetAnchor, candidate, kind), 0, 'target edge-center twin anchor-middle bridge');
  pushSeeds(targetZeroCenterAnchorTailEchoBridgePairSeeds(latest, targetAnchor, candidate, kind), 0, 'target zero-center anchor-tail echo bridge');
  pushSeeds(targetFrontLockTwinTailSplitBridgePairSeeds(latest, targetAnchor, candidate, kind), 0, 'target front-lock twin-tail split bridge');
  pushSeeds(targetFrontStepAnchorReturnBridgePairSeeds(latest, targetAnchor, candidate, kind), 0, 'target front-step anchor return bridge');
  pushSeeds(targetTailReversalAnchorCenterTwinBridgePairSeeds(latest, targetAnchor, candidate, kind), 0, 'target tail-reversal anchor-center twin bridge');
  pushSeeds(targetFrontCarryAnchorTwinBridgePairSeeds(latest, targetAnchor, candidate, kind), 0, 'target front-carry anchor-twin bridge');
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
  // V6.7: AKLE juga mengikuti asas Decision Engine.
  // Semua pair sudah menjadi seed skor sebelum ranking; tidak ada pair-lock/rescue setelah pemilihan.
  return ranked.slice(0,5);
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
  const fiveDigitsHtml = (r.strongFiveDigits || []).map(d => `<div class="digit strong-five">${d}</div>`).join('');
  const statsHtml = `<div class="stats">
    <div class="stat"><div class="k">Data</div><div class="v">${r.rows.length}</div></div>
    <div class="stat"><div class="k">Latest</div><div class="v">${escapeHtml(r.latest.digits.join(''))}</div></div>
    <div class="stat"><div class="k">Target Hari</div><div class="v">${escapeHtml(r.targetDay)}</div></div>
    <div class="stat"><div class="k">Mode</div><div class="v">Rumus</div></div>
  </div>`;
  const rankingScore = r.candidate.decisionEngine?.score || r.candidate.score;
  const topDigits = DIGITS.slice().sort((a,b) => rankingScore[b]-rankingScore[a] || a-b).map(d => {
    const fam = [...new Set(r.candidate.digitTrace[d].map(x => x.family))].slice(0,5).join(', ') || '-';
    return `<div class="rankitem"><div class="num">${d}</div><div><b>Digit ${d}</b><br><small>Jejak: ${escapeHtml(fam)}. Poin keputusan: ${Math.round(rankingScore[d] || 0)}. Poin rumus dasar: ${Math.round(r.candidate.score[d])}</small></div><span class="badge blue">${Math.round(rankingScore[d] || 0)}</span></div>`;
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
  const targetExitMirrorBridgeHtml = r.audit.targetExitMirrorBridge ? `<div><b>Target exit-mirror bridge</b><ul class="process-list small"><li>${escapeHtml(r.audit.targetExitMirrorBridge.title)}</li><li>Digit: ${escapeHtml(r.audit.targetExitMirrorBridge.digits)}</li><li>AK: ${escapeHtml(r.audit.targetExitMirrorBridge.ak)}</li><li>LE: ${escapeHtml(r.audit.targetExitMirrorBridge.le)}</li></ul></div>` : '';
  const targetTailPivotBridgeHtml = r.audit.targetTailPivotBridge ? `<div><b>Target tail-pivot bridge</b><ul class="process-list small"><li>${escapeHtml(r.audit.targetTailPivotBridge.title)}</li><li>Digit: ${escapeHtml(r.audit.targetTailPivotBridge.digits)}</li><li>AK: ${escapeHtml(r.audit.targetTailPivotBridge.ak)}</li><li>LE: ${escapeHtml(r.audit.targetTailPivotBridge.le)}</li></ul></div>` : '';
  const targetCenterPivotBridgeHtml = r.audit.targetCenterPivotBridge ? `<div><b>Target center-pivot bridge</b><ul class="process-list small"><li>${escapeHtml(r.audit.targetCenterPivotBridge.title)}</li><li>Digit: ${escapeHtml(r.audit.targetCenterPivotBridge.digits)}</li><li>AK: ${escapeHtml(r.audit.targetCenterPivotBridge.ak)}</li><li>LE: ${escapeHtml(r.audit.targetCenterPivotBridge.le)}</li></ul></div>` : '';
  const targetZeroCenterAnchorComplementBridgeHtml = r.audit.targetZeroCenterAnchorComplementBridge ? `<div><b>Target zero-center anchor-complement bridge</b><ul class="process-list small"><li>${escapeHtml(r.audit.targetZeroCenterAnchorComplementBridge.title)}</li><li>Digit: ${escapeHtml(r.audit.targetZeroCenterAnchorComplementBridge.digits)}</li><li>AK: ${escapeHtml(r.audit.targetZeroCenterAnchorComplementBridge.ak)}${r.audit.targetZeroCenterAnchorComplementBridge.altAK ? ' / '+escapeHtml(r.audit.targetZeroCenterAnchorComplementBridge.altAK) : ''}</li><li>LE: ${escapeHtml(r.audit.targetZeroCenterAnchorComplementBridge.le)}${r.audit.targetZeroCenterAnchorComplementBridge.altLE ? ' / '+escapeHtml(r.audit.targetZeroCenterAnchorComplementBridge.altLE) : ''}</li></ul></div>` : '';
  const targetFrontMirrorTailReverseBridgeHtml = r.audit.targetFrontMirrorTailReverseBridge ? `<div><b>Target front-mirror tail-reversal bridge</b><ul class="process-list small"><li>${escapeHtml(r.audit.targetFrontMirrorTailReverseBridge.title)}</li><li>Digit: ${escapeHtml(r.audit.targetFrontMirrorTailReverseBridge.digits)}</li><li>AK: ${escapeHtml(r.audit.targetFrontMirrorTailReverseBridge.ak)}${r.audit.targetFrontMirrorTailReverseBridge.altAK ? ' / '+escapeHtml(r.audit.targetFrontMirrorTailReverseBridge.altAK) : ''}</li><li>LE: ${escapeHtml(r.audit.targetFrontMirrorTailReverseBridge.le)}${r.audit.targetFrontMirrorTailReverseBridge.altLE ? ' / '+escapeHtml(r.audit.targetFrontMirrorTailReverseBridge.altLE) : ''}</li></ul></div>` : '';
  const targetFrontSumAnchorMirrorBridgeHtml = r.audit.targetFrontSumAnchorMirrorBridge ? `<div><b>Target front-sum anchor-mirror bridge</b><ul class="process-list small"><li>${escapeHtml(r.audit.targetFrontSumAnchorMirrorBridge.title)}</li><li>Digit: ${escapeHtml(r.audit.targetFrontSumAnchorMirrorBridge.digits)}</li><li>AK: ${escapeHtml(r.audit.targetFrontSumAnchorMirrorBridge.ak)}${r.audit.targetFrontSumAnchorMirrorBridge.altAK ? ' / '+escapeHtml(r.audit.targetFrontSumAnchorMirrorBridge.altAK) : ''}</li><li>LE: ${escapeHtml(r.audit.targetFrontSumAnchorMirrorBridge.le)}${r.audit.targetFrontSumAnchorMirrorBridge.altLE ? ' / '+escapeHtml(r.audit.targetFrontSumAnchorMirrorBridge.altLE) : ''}</li></ul></div>` : '';
  const targetZeroAnchorDescentMirrorBridgeHtml = r.audit.targetZeroAnchorDescentMirrorBridge ? `<div><b>Target zero-anchor descent-mirror bridge</b><ul class="process-list small"><li>${escapeHtml(r.audit.targetZeroAnchorDescentMirrorBridge.title)}</li><li>Digit: ${escapeHtml(r.audit.targetZeroAnchorDescentMirrorBridge.digits)}</li><li>AK: ${escapeHtml(r.audit.targetZeroAnchorDescentMirrorBridge.ak)}${r.audit.targetZeroAnchorDescentMirrorBridge.altAK ? ' / '+escapeHtml(r.audit.targetZeroAnchorDescentMirrorBridge.altAK) : ''}</li><li>LE: ${escapeHtml(r.audit.targetZeroAnchorDescentMirrorBridge.le)}${r.audit.targetZeroAnchorDescentMirrorBridge.altLE ? ' / '+escapeHtml(r.audit.targetZeroAnchorDescentMirrorBridge.altLE) : ''}</li></ul></div>` : '';
  const targetTailAnchorFrontReverseBridgeHtml = r.audit.targetTailAnchorFrontReverseBridge ? `<div><b>Target tail-anchor front-reversal bridge</b><ul class="process-list small"><li>${escapeHtml(r.audit.targetTailAnchorFrontReverseBridge.title)}</li><li>Digit: ${escapeHtml(r.audit.targetTailAnchorFrontReverseBridge.digits)}</li><li>AK: ${escapeHtml(r.audit.targetTailAnchorFrontReverseBridge.ak)}${r.audit.targetTailAnchorFrontReverseBridge.altAK ? ' / '+escapeHtml(r.audit.targetTailAnchorFrontReverseBridge.altAK) : ''}</li><li>LE: ${escapeHtml(r.audit.targetTailAnchorFrontReverseBridge.le)}${r.audit.targetTailAnchorFrontReverseBridge.altLE ? ' / '+escapeHtml(r.audit.targetTailAnchorFrontReverseBridge.altLE) : ''}</li></ul></div>` : '';
  const targetAnchorSameACenterMirrorBridgeHtml = r.audit.targetAnchorSameACenterMirrorBridge ? `<div><b>Target anchor-same-A center-mirror bridge</b><ul class="process-list small"><li>${escapeHtml(r.audit.targetAnchorSameACenterMirrorBridge.title)}</li><li>Digit: ${escapeHtml(r.audit.targetAnchorSameACenterMirrorBridge.digits)}</li><li>AK: ${escapeHtml(r.audit.targetAnchorSameACenterMirrorBridge.ak)}${r.audit.targetAnchorSameACenterMirrorBridge.altAK ? ' / '+escapeHtml(r.audit.targetAnchorSameACenterMirrorBridge.altAK) : ''}</li><li>LE: ${escapeHtml(r.audit.targetAnchorSameACenterMirrorBridge.le)}${r.audit.targetAnchorSameACenterMirrorBridge.altLE ? ' / '+escapeHtml(r.audit.targetAnchorSameACenterMirrorBridge.altLE) : ''}</li></ul></div>` : '';
  const targetAnchorEdgeZeroReturnBridgeHtml = r.audit.targetAnchorEdgeZeroReturnBridge ? `<div><b>Target anchor-edge zero-return bridge</b><ul class="process-list small"><li>${escapeHtml(r.audit.targetAnchorEdgeZeroReturnBridge.title)}</li><li>Digit: ${escapeHtml(r.audit.targetAnchorEdgeZeroReturnBridge.digits)}</li><li>AK: ${escapeHtml(r.audit.targetAnchorEdgeZeroReturnBridge.ak)}${r.audit.targetAnchorEdgeZeroReturnBridge.altAK ? ' / '+escapeHtml(r.audit.targetAnchorEdgeZeroReturnBridge.altAK) : ''}</li><li>LE: ${escapeHtml(r.audit.targetAnchorEdgeZeroReturnBridge.le)}${r.audit.targetAnchorEdgeZeroReturnBridge.altLE ? ' / '+escapeHtml(r.audit.targetAnchorEdgeZeroReturnBridge.altLE) : ''}</li></ul></div>` : '';
  const targetAnchorEdgeMirrorCarryBridgeHtml = r.audit.targetAnchorEdgeMirrorCarryBridge ? `<div><b>Target anchor-edge mirror-carry bridge</b><ul class="process-list small"><li>${escapeHtml(r.audit.targetAnchorEdgeMirrorCarryBridge.title)}</li><li>Digit: ${escapeHtml(r.audit.targetAnchorEdgeMirrorCarryBridge.digits)}</li><li>AK: ${escapeHtml(r.audit.targetAnchorEdgeMirrorCarryBridge.ak)}${r.audit.targetAnchorEdgeMirrorCarryBridge.altAK ? ' / '+escapeHtml(r.audit.targetAnchorEdgeMirrorCarryBridge.altAK) : ''}</li><li>LE: ${escapeHtml(r.audit.targetAnchorEdgeMirrorCarryBridge.le)}${r.audit.targetAnchorEdgeMirrorCarryBridge.altLE ? ' / '+escapeHtml(r.audit.targetAnchorEdgeMirrorCarryBridge.altLE) : ''}</li></ul></div>` : '';
  const targetLatestKMirrorAnchorCenterZeroBridgeHtml = r.audit.targetLatestKMirrorAnchorCenterZeroBridge ? `<div><b>Target latest-K mirror anchor-center-zero bridge</b><ul class="process-list small"><li>${escapeHtml(r.audit.targetLatestKMirrorAnchorCenterZeroBridge.title)}</li><li>Digit: ${escapeHtml(r.audit.targetLatestKMirrorAnchorCenterZeroBridge.digits)}</li><li>AK: ${escapeHtml(r.audit.targetLatestKMirrorAnchorCenterZeroBridge.ak)}${r.audit.targetLatestKMirrorAnchorCenterZeroBridge.altAK ? ' / '+escapeHtml(r.audit.targetLatestKMirrorAnchorCenterZeroBridge.altAK) : ''}</li><li>LE: ${escapeHtml(r.audit.targetLatestKMirrorAnchorCenterZeroBridge.le)}${r.audit.targetLatestKMirrorAnchorCenterZeroBridge.altLE ? ' / '+escapeHtml(r.audit.targetLatestKMirrorAnchorCenterZeroBridge.altLE) : ''}</li></ul></div>` : '';
  const targetCenterTwinAnchorZeroBridgeHtml = r.audit.targetCenterTwinAnchorZeroBridge ? `<div><b>Target center-twin anchor-zero bridge</b><ul class="process-list small"><li>${escapeHtml(r.audit.targetCenterTwinAnchorZeroBridge.title)}</li><li>Digit: ${escapeHtml(r.audit.targetCenterTwinAnchorZeroBridge.digits)}</li><li>AK: ${escapeHtml(r.audit.targetCenterTwinAnchorZeroBridge.ak)}${r.audit.targetCenterTwinAnchorZeroBridge.altAK ? ' / '+escapeHtml(r.audit.targetCenterTwinAnchorZeroBridge.altAK) : ''}</li><li>LE: ${escapeHtml(r.audit.targetCenterTwinAnchorZeroBridge.le)}${r.audit.targetCenterTwinAnchorZeroBridge.altLE ? ' / '+escapeHtml(r.audit.targetCenterTwinAnchorZeroBridge.altLE) : ''}</li></ul></div>` : '';
  const targetAnchorTailMirrorDescentBridgeHtml = r.audit.targetAnchorTailMirrorDescentBridge ? `<div><b>Target anchor-tail mirror-descent bridge</b><ul class="process-list small"><li>${escapeHtml(r.audit.targetAnchorTailMirrorDescentBridge.title)}</li><li>Digit: ${escapeHtml(r.audit.targetAnchorTailMirrorDescentBridge.digits)}</li><li>AK: ${escapeHtml(r.audit.targetAnchorTailMirrorDescentBridge.ak)}${r.audit.targetAnchorTailMirrorDescentBridge.altAK ? ' / '+escapeHtml(r.audit.targetAnchorTailMirrorDescentBridge.altAK) : ''}</li><li>LE: ${escapeHtml(r.audit.targetAnchorTailMirrorDescentBridge.le)}${r.audit.targetAnchorTailMirrorDescentBridge.altLE ? ' / '+escapeHtml(r.audit.targetAnchorTailMirrorDescentBridge.altLE) : ''}</li></ul></div>` : '';
  const targetEdgeCenterTwinAnchorMiddleBridgeHtml = r.audit.targetEdgeCenterTwinAnchorMiddleBridge ? `<div><b>Target edge-center twin anchor-middle bridge</b><ul class="process-list small"><li>${escapeHtml(r.audit.targetEdgeCenterTwinAnchorMiddleBridge.title)}</li><li>Digit: ${escapeHtml(r.audit.targetEdgeCenterTwinAnchorMiddleBridge.digits)}</li><li>AK: ${escapeHtml(r.audit.targetEdgeCenterTwinAnchorMiddleBridge.ak)}${r.audit.targetEdgeCenterTwinAnchorMiddleBridge.altAK ? ' / '+escapeHtml(r.audit.targetEdgeCenterTwinAnchorMiddleBridge.altAK) : ''}</li><li>LE: ${escapeHtml(r.audit.targetEdgeCenterTwinAnchorMiddleBridge.le)}${r.audit.targetEdgeCenterTwinAnchorMiddleBridge.altLE ? ' / '+escapeHtml(r.audit.targetEdgeCenterTwinAnchorMiddleBridge.altLE) : ''}</li></ul></div>` : '';
  const targetZeroCenterAnchorTailEchoBridgeHtml = r.audit.targetZeroCenterAnchorTailEchoBridge ? `<div><b>Target zero-center anchor-tail echo bridge</b><ul class="process-list small"><li>${escapeHtml(r.audit.targetZeroCenterAnchorTailEchoBridge.title)}</li><li>Digit: ${escapeHtml(r.audit.targetZeroCenterAnchorTailEchoBridge.digits)}</li><li>AK: ${escapeHtml(r.audit.targetZeroCenterAnchorTailEchoBridge.ak)}${r.audit.targetZeroCenterAnchorTailEchoBridge.altAK ? ' / '+escapeHtml(r.audit.targetZeroCenterAnchorTailEchoBridge.altAK) : ''}</li><li>LE: ${escapeHtml(r.audit.targetZeroCenterAnchorTailEchoBridge.le)}${r.audit.targetZeroCenterAnchorTailEchoBridge.altLE ? ' / '+escapeHtml(r.audit.targetZeroCenterAnchorTailEchoBridge.altLE) : ''}</li></ul></div>` : '';
  const targetFrontLockTwinTailSplitBridgeHtml = r.audit.targetFrontLockTwinTailSplitBridge ? `<div><b>Target front-lock twin-tail split bridge</b><ul class="process-list small"><li>${escapeHtml(r.audit.targetFrontLockTwinTailSplitBridge.title)}</li><li>Digit: ${escapeHtml(r.audit.targetFrontLockTwinTailSplitBridge.digits)}</li><li>AK: ${escapeHtml(r.audit.targetFrontLockTwinTailSplitBridge.ak)}${r.audit.targetFrontLockTwinTailSplitBridge.altAK ? ' / '+escapeHtml(r.audit.targetFrontLockTwinTailSplitBridge.altAK) : ''}</li><li>LE: ${escapeHtml(r.audit.targetFrontLockTwinTailSplitBridge.le)}${r.audit.targetFrontLockTwinTailSplitBridge.altLE ? ' / '+escapeHtml(r.audit.targetFrontLockTwinTailSplitBridge.altLE) : ''}</li></ul></div>` : '';
  const targetFrontStepAnchorReturnBridgeHtml = r.audit.targetFrontStepAnchorReturnBridge ? `<div><b>Target front-step anchor return bridge</b><ul class="process-list small"><li>${escapeHtml(r.audit.targetFrontStepAnchorReturnBridge.title)}</li><li>Digit: ${escapeHtml(r.audit.targetFrontStepAnchorReturnBridge.digits)}</li><li>AK: ${escapeHtml(r.audit.targetFrontStepAnchorReturnBridge.ak)}${r.audit.targetFrontStepAnchorReturnBridge.altAK ? ' / '+escapeHtml(r.audit.targetFrontStepAnchorReturnBridge.altAK) : ''}</li><li>LE: ${escapeHtml(r.audit.targetFrontStepAnchorReturnBridge.le)}${r.audit.targetFrontStepAnchorReturnBridge.altLE ? ' / '+escapeHtml(r.audit.targetFrontStepAnchorReturnBridge.altLE) : ''}</li></ul></div>` : '';
  const targetTailReversalAnchorCenterTwinBridgeHtml = r.audit.targetTailReversalAnchorCenterTwinBridge ? `<div><b>Target tail-reversal anchor-center twin bridge</b><ul class="process-list small"><li>${escapeHtml(r.audit.targetTailReversalAnchorCenterTwinBridge.title)}</li><li>Digit: ${escapeHtml(r.audit.targetTailReversalAnchorCenterTwinBridge.digits)}</li><li>AK: ${escapeHtml(r.audit.targetTailReversalAnchorCenterTwinBridge.ak)}${r.audit.targetTailReversalAnchorCenterTwinBridge.altAK ? ' / '+escapeHtml(r.audit.targetTailReversalAnchorCenterTwinBridge.altAK) : ''}</li><li>LE: ${escapeHtml(r.audit.targetTailReversalAnchorCenterTwinBridge.le)}${r.audit.targetTailReversalAnchorCenterTwinBridge.altLE ? ' / '+escapeHtml(r.audit.targetTailReversalAnchorCenterTwinBridge.altLE) : ''}</li></ul></div>` : '';
  const targetFrontCarryAnchorTwinBridgeHtml = r.audit.targetFrontCarryAnchorTwinBridge ? `<div><b>Target front-carry anchor-twin bridge</b><ul class="process-list small"><li>${escapeHtml(r.audit.targetFrontCarryAnchorTwinBridge.title)}</li><li>Digit: ${escapeHtml(r.audit.targetFrontCarryAnchorTwinBridge.digits)}</li><li>AK: ${escapeHtml(r.audit.targetFrontCarryAnchorTwinBridge.ak)}${r.audit.targetFrontCarryAnchorTwinBridge.altAK ? ' / '+escapeHtml(r.audit.targetFrontCarryAnchorTwinBridge.altAK) : ''}</li><li>LE: ${escapeHtml(r.audit.targetFrontCarryAnchorTwinBridge.le)}${r.audit.targetFrontCarryAnchorTwinBridge.altLE ? ' / '+escapeHtml(r.audit.targetFrontCarryAnchorTwinBridge.altLE) : ''}</li></ul></div>` : '';
  const decisionEngineHtml = r.audit.decisionEngine ? `<div><b>Decision Engine</b><ul class="process-list small"><li>${escapeHtml(r.audit.decisionEngine.title)}</li><li>Terpilih 6 digit: ${escapeHtml(r.audit.decisionEngine.selected)}</li><li>5 digit terkuat: ${escapeHtml(r.audit.decisionEngine.strongFive || '')}</li>${r.audit.decisionEngine.top.slice(0,8).map(x => `<li>${escapeHtml(x)}</li>`).join('')}</ul></div>` : '';
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
      ${targetExitMirrorBridgeHtml}
      ${targetTailPivotBridgeHtml}
      ${targetCenterPivotBridgeHtml}
      ${targetZeroCenterAnchorComplementBridgeHtml}
      ${targetFrontMirrorTailReverseBridgeHtml}
      ${targetFrontSumAnchorMirrorBridgeHtml}
      ${targetZeroAnchorDescentMirrorBridgeHtml}
      ${targetTailAnchorFrontReverseBridgeHtml}
      ${targetAnchorSameACenterMirrorBridgeHtml}
      ${targetAnchorEdgeZeroReturnBridgeHtml}
      ${targetAnchorEdgeMirrorCarryBridgeHtml}
      ${targetLatestKMirrorAnchorCenterZeroBridgeHtml}
      ${targetCenterTwinAnchorZeroBridgeHtml}
      ${targetAnchorTailMirrorDescentBridgeHtml}
      ${targetEdgeCenterTwinAnchorMiddleBridgeHtml}
      ${targetZeroCenterAnchorTailEchoBridgeHtml}
      ${targetFrontLockTwinTailSplitBridgeHtml}
      ${targetFrontStepAnchorReturnBridgeHtml}
      ${targetTailReversalAnchorCenterTwinBridgeHtml}
      ${targetFrontCarryAnchorTwinBridgeHtml}
      ${decisionEngineHtml}
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
      <div class="five-strong-box"><small>5 Digit Terkuat</small><div class="digits compact">${fiveDigitsHtml}</div></div>
      <div class="twin-box"><small>Kandidat kembar rumus</small><b>${r.twinDigit}${r.twinDigit}</b></div>
      <p class="tagline">Engine V8.4 memakai Decision Engine: semua digit dinilai lebih dulu, dibandingkan, lalu 6 digit dipilih langsung. Modul lama tidak menjalankan forceXXXRescue berlapis setelah pemilihan; AKLE, anchor, market, twin, replay, bridge, front-carry anchor-twin, zero-center anchor-complement, front-mirror tail-reversal, front-sum anchor-mirror, zero-anchor descent-mirror, tail-anchor front-reversal, anchor-same-A center-mirror, anchor-edge zero-return, anchor-edge mirror-carry, latest-k mirror anchor-center-zero, center-twin anchor-zero, anchor-tail mirror-descent, edge-center twin anchor-middle, zero-center anchor-tail echo, front-lock twin-tail split, front-step anchor return, tail-reversal anchor-center twin, dan twin repeat gate hanya menjadi sumber skor keputusan.</p>
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
