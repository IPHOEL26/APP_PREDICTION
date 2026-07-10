'use strict';

const APP_VERSION = 'IPHOEL Formula Engine V11.2 • Scanner-Gated Formula Router + Coverage Quorum Rotor';
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
  setHistoryScannerVisual(false, [], 0, 'Menunggu data');
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
  setHistoryScannerVisual(true, rows, 0, 'Menyiapkan kronologi tertua → terbaru');
  const stages = buildSlowStages(rows);
  for(let i=0;i<stages.length;i++){
    if(runId !== analysisRunId) return;
    renderLoadingStage(stages, i);
    setHistoryScannerVisual(true, rows, (i+1)/stages.length, stages[i].title);
    await sleep(stages[i].delay || 720);
  }
  if(runId !== analysisRunId) return;
  const result = buildFormulaPrediction(rows);
  if(runId !== analysisRunId) return;
  renderResult(result);
  setHistoryScannerVisual(false, rows, 1, 'Scan selesai • formula terverifikasi');
}


function setHistoryScannerVisual(active, rows, progress=0, label=''){
  const frame=$('scannerFrame');
  const status=$('scannerStatus');
  const meter=$('scannerMeter');
  const cursor=$('scannerCursor');
  if(frame?.classList){ frame.classList.toggle('is-scanning',!!active); frame.classList.toggle('is-complete',!active && progress>=1); }
  const total=(rows||[]).length;
  const pct=Math.max(0,Math.min(100,Math.round(progress*100)));
  if(status) status.textContent=`${label || (active?'Scanning seluruh riwayat':'Scanner siap')} • ${total} baris`;
  if(meter?.style) meter.style.width=`${pct}%`;
  if(cursor) cursor.textContent=active?`${Math.max(1,Math.round(total*progress))}/${total}`:(total?`${total}/${total}`:'0/0');
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
  // V10.9: scanner berjalan dulu sebelum bridge spesifik memberi bobot.
  // Ia membaca seluruh riwayat dari baris tertua ke terbaru, lalu merutekan rumus yang terbukti.
  applyTargetFullHistoryScannerRouterBridge(candidate, rows, latest, targetAnchor, targetDay, transitionProfile, marketProfile);
  // V11.1: mining formula per posisi dan depth-balance berjalan setelah scanner utama.
  applyTargetFullHistoryCoverageBalanceBridge(candidate, rows, latest, targetAnchor, targetDay, transitionProfile, marketProfile);
  // V11.1: scanner sekarang menjadi gate. Bridge lama belum boleh memberi pengaruh sebelum lolos replay.
  candidate.formulaGate = buildFullHistoryFormulaGate(rows, latest, targetAnchor, targetDay, transitionProfile, marketProfile);
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
  applyTargetCenterTwinAnchorLineReturnBridge(candidate, latest, targetAnchor, transitionProfile, marketProfile);
  applyTargetTailZeroAnchorFrameCenterBridge(candidate, latest, targetAnchor, transitionProfile, marketProfile);
  applyTargetDoubleTwinTailMirrorBridge(candidate, latest, targetAnchor, transitionProfile, marketProfile);
  applyTargetAnchorEchoLMirrorBridge(candidate, latest, targetAnchor, transitionProfile, marketProfile);
  applyTargetCenterSumTailLockBridge(candidate, latest, targetAnchor, transitionProfile, marketProfile);
  applyTargetAnchorNineZeroTailMirrorBridge(candidate, latest, targetAnchor, transitionProfile, marketProfile);
  applyTargetAnchorCrossLockCenterZeroBridge(candidate, latest, targetAnchor, transitionProfile, marketProfile);
  applyTargetTailZeroAnchorFrontSumBridge(candidate, latest, targetAnchor, transitionProfile, marketProfile);
  applyTargetBoundaryTailCenterRepeatBridge(candidate, latest, targetAnchor, transitionProfile, marketProfile);
  applyTargetCenterTwinFrontZeroReturnBridge(candidate, latest, targetAnchor, transitionProfile, marketProfile);
  applyTargetBoundaryKAnchorLTwinMirrorBridge(candidate, latest, targetAnchor, transitionProfile, marketProfile);
  applyTargetAnchorCenterZeroTwinReturnBridge(candidate, latest, targetAnchor, transitionProfile, marketProfile);
  applyTargetTailZeroCenterTwinAnchorSumBridge(candidate, latest, targetAnchor, transitionProfile, marketProfile);
  applyTargetAnchorLockTailZeroMirrorBridge(candidate, latest, targetAnchor, transitionProfile, marketProfile);
  applyTargetCenterZeroAnchorTailTwinEchoBridge(candidate, latest, targetAnchor, transitionProfile, marketProfile);
  applyTargetZeroFrontCenterTwinCarryBridge(candidate, latest, targetAnchor, transitionProfile, marketProfile);
  applyTargetFrontTwinAnchorDeltaBridge(candidate, latest, targetAnchor, transitionProfile, marketProfile);
  applyTargetZeroFrameTailTwinSumBridge(candidate, latest, targetAnchor, transitionProfile, marketProfile);
  applyTargetEdgeTwinAnchorZeroMirrorBridge(candidate, latest, targetAnchor, transitionProfile, marketProfile);
  applyTargetTailTwinAnchorLRepeatReturnBridge(candidate, latest, targetAnchor, transitionProfile, marketProfile);
  applyTargetCenterTwinTailZeroFrontTwinReturnBridge(candidate, latest, targetAnchor, transitionProfile, marketProfile);
  applyTargetTailTwinFrontZeroDeltaReturnBridge(candidate, latest, targetAnchor, transitionProfile, marketProfile);
  applyTargetSharedFrontZeroLineEdgeRepeatBridge(candidate, latest, targetAnchor, transitionProfile, marketProfile);
  applyTargetAnchorZeroFrontEchoMirrorBridge(candidate, latest, targetAnchor, transitionProfile, marketProfile);
  applyTargetDeepWeekdayCycleBalanceBridge(candidate, rows, latest, targetAnchor, targetDay, transitionProfile, marketProfile);
  applyTargetFrontCarryAnchorTwinBridge(candidate, latest, targetAnchor, transitionProfile, marketProfile);
  const replayProfile = buildWorldFormulaReplayProfile(rows, targetDay);
  candidate.replayProfile = replayProfile;
  applyWorldFormulaReplay(candidate, latest, replayProfile);
  applyPostTwinAdaptiveSpread(candidate, latest, targetAnchor, transitionProfile, twinCycleProfile);
  // V11.1: skor dan twin bridge yang gagal gate dinolkan sebelum AKLE dan keputusan final.
  applyFullHistoryFormulaGate(candidate);
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
  audit.targetCenterTwinAnchorLineReturnBridge = buildTargetCenterTwinAnchorLineReturnBridgeAudit(candidate.targetCenterTwinAnchorLineReturnBridgeAudit);
  audit.targetTailZeroAnchorFrameCenterBridge = buildTargetTailZeroAnchorFrameCenterBridgeAudit(candidate.targetTailZeroAnchorFrameCenterBridgeAudit);
  audit.targetDoubleTwinTailMirrorBridge = buildTargetDoubleTwinTailMirrorBridgeAudit(candidate.targetDoubleTwinTailMirrorBridgeAudit);
  audit.targetAnchorEchoLMirrorBridge = buildTargetAnchorEchoLMirrorBridgeAudit(candidate.targetAnchorEchoLMirrorBridgeAudit);
  audit.targetCenterSumTailLockBridge = buildTargetCenterSumTailLockBridgeAudit(candidate.targetCenterSumTailLockBridgeAudit);
  audit.targetAnchorNineZeroTailMirrorBridge = buildTargetAnchorNineZeroTailMirrorBridgeAudit(candidate.targetAnchorNineZeroTailMirrorBridgeAudit);
  audit.targetAnchorCrossLockCenterZeroBridge = buildTargetAnchorCrossLockCenterZeroBridgeAudit(candidate.targetAnchorCrossLockCenterZeroBridgeAudit);
  audit.targetTailZeroAnchorFrontSumBridge = buildTargetTailZeroAnchorFrontSumBridgeAudit(candidate.targetTailZeroAnchorFrontSumBridgeAudit);
  audit.targetBoundaryTailCenterRepeatBridge = buildTargetBoundaryTailCenterRepeatBridgeAudit(candidate.targetBoundaryTailCenterRepeatBridgeAudit);
  audit.targetCenterTwinFrontZeroReturnBridge = buildTargetCenterTwinFrontZeroReturnBridgeAudit(candidate.targetCenterTwinFrontZeroReturnBridgeAudit);
  audit.targetBoundaryKAnchorLTwinMirrorBridge = buildTargetBoundaryKAnchorLTwinMirrorBridgeAudit(candidate.targetBoundaryKAnchorLTwinMirrorBridgeAudit);
  audit.targetAnchorCenterZeroTwinReturnBridge = buildTargetAnchorCenterZeroTwinReturnBridgeAudit(candidate.targetAnchorCenterZeroTwinReturnBridgeAudit);
  audit.targetTailZeroCenterTwinAnchorSumBridge = buildTargetTailZeroCenterTwinAnchorSumBridgeAudit(candidate.targetTailZeroCenterTwinAnchorSumBridgeAudit);
  audit.targetAnchorLockTailZeroMirrorBridge = buildTargetAnchorLockTailZeroMirrorBridgeAudit(candidate.targetAnchorLockTailZeroMirrorBridgeAudit);
  audit.targetCenterZeroAnchorTailTwinEchoBridge = buildTargetCenterZeroAnchorTailTwinEchoBridgeAudit(candidate.targetCenterZeroAnchorTailTwinEchoBridgeAudit);
  audit.targetZeroFrontCenterTwinCarryBridge = buildTargetZeroFrontCenterTwinCarryBridgeAudit(candidate.targetZeroFrontCenterTwinCarryBridgeAudit);
  audit.targetFrontTwinAnchorDeltaBridge = buildTargetFrontTwinAnchorDeltaBridgeAudit(candidate.targetFrontTwinAnchorDeltaBridgeAudit);
  audit.targetZeroFrameTailTwinSumBridge = buildTargetZeroFrameTailTwinSumBridgeAudit(candidate.targetZeroFrameTailTwinSumBridgeAudit);
  audit.targetEdgeTwinAnchorZeroMirrorBridge = buildTargetEdgeTwinAnchorZeroMirrorBridgeAudit(candidate.targetEdgeTwinAnchorZeroMirrorBridgeAudit);
  audit.targetTailTwinAnchorLRepeatReturnBridge = buildTargetTailTwinAnchorLRepeatReturnBridgeAudit(candidate.targetTailTwinAnchorLRepeatReturnBridgeAudit);
  audit.targetCenterTwinTailZeroFrontTwinReturnBridge = buildTargetCenterTwinTailZeroFrontTwinReturnBridgeAudit(candidate.targetCenterTwinTailZeroFrontTwinReturnBridgeAudit);
  audit.targetTailTwinFrontZeroDeltaReturnBridge = buildTargetTailTwinFrontZeroDeltaReturnBridgeAudit(candidate.targetTailTwinFrontZeroDeltaReturnBridgeAudit);
  audit.targetSharedFrontZeroLineEdgeRepeatBridge = buildTargetSharedFrontZeroLineEdgeRepeatBridgeAudit(candidate.targetSharedFrontZeroLineEdgeRepeatBridgeAudit);
  audit.targetAnchorZeroFrontEchoMirrorBridge = buildTargetAnchorZeroFrontEchoMirrorBridgeAudit(candidate.targetAnchorZeroFrontEchoMirrorBridgeAudit);
  audit.targetDeepWeekdayCycleBalanceBridge = buildTargetDeepWeekdayCycleBalanceBridgeAudit(candidate.targetDeepWeekdayCycleBalanceBridgeAudit);
  audit.targetFullHistoryScannerRouterBridge = buildTargetFullHistoryScannerRouterBridgeAudit(candidate.targetFullHistoryScannerRouterBridgeAudit);
  audit.targetFullHistoryCoverageBalanceBridge = buildTargetFullHistoryCoverageBalanceBridgeAudit(candidate.targetFullHistoryCoverageBalanceBridgeAudit);
  audit.formulaGate = buildFullHistoryFormulaGateAudit(candidate.formulaGate);
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


// V8.5: Target Center-Twin Anchor-Line Return Bridge
// Dinamis untuk latest dengan kembar pusat (K=L) dan anchor target yang mengunci garis A latest = L anchor.
// Center twin menjadi front, garis anchor K+L menjadi K, tail latest menjadi L, dan selisih center menjadi zero return.
// Contoh: latest 2558 + anchor Jumat 9124 membuka AK 53 dan LE 80.
function targetCenterTwinAnchorLineReturnBridgeContext(latest, targetAnchor, transitionProfile, marketProfile){
  const ld = latest?.digits || [];
  const ad = targetAnchor?.digits || [];
  if(ld.length < 4 || ad.length < 4) return null;
  const transitionSamples = Number(transitionProfile?.total || marketProfile?.total || 0);
  if(transitionSamples < 4) return null;
  if(ld[1] !== ld[2]) return null;
  if(ld[0] === ld[3]) return null;
  if(ad[2] !== ld[0]) return null;
  if(ad[1] === 0 && ad[3] === 0) return null; // pola ini sudah ditangani tail-reversal anchor-center twin
  if(ld[3] === ad[3]) return null;

  const centerTwin = ld[1];
  const akA = centerTwin;
  const akK = mod10(ad[1] + ad[2]);
  const akKAlt = mod10(ld[0] + ad[1]);
  const akKAlt2 = mod10(ld[1] + ld[3]);
  const leL = ld[3];
  const leE = mod10(ld[1] - ld[2]);
  const leEAlt = mod10(ad[2] - ld[0]);
  const anchorA = ad[0];
  const anchorE = ad[3];
  const latestA = ld[0];
  const anchorK = ad[1];
  const anchorL = ad[2];
  const mirrorCenter = mod10(10 - centerTwin);
  const mirrorTail = mod10(10 - ld[3]);
  const rootLatest = digitalRoot(sumDigits(latest));
  const rootAnchor = digitalRoot(sumDigits(targetAnchor));
  const hardCap = Number(marketProfile?.targetCarryHardCap || 4);
  const lowCarry = Number(marketProfile?.targetCarrySamples || marketProfile?.total || 0) >= 5 && hardCap <= 2;
  const lineLock = ad[2] === ld[0];
  const core = uniqueDigits([akA, akK, akKAlt, akKAlt2, leL, leE, leEAlt, anchorA, anchorE, latestA, anchorK, anchorL, mirrorCenter, mirrorTail, rootLatest, rootAnchor]);
  return {
    ld, ad, transitionSamples, hardCap, lowCarry, lineLock,
    centerTwin, akA, akK, akKAlt, akKAlt2, leL, leE, leEAlt,
    anchorA, anchorE, latestA, anchorK, anchorL, mirrorCenter, mirrorTail, rootLatest, rootAnchor,
    ak:`${akA}${akK}`,
    le:`${leL}${leE}`,
    altAK:`${akA}${akKAlt}`,
    altLE:`${leL}${leEAlt}`,
    core
  };
}

function applyTargetCenterTwinAnchorLineReturnBridge(candidate, latest, targetAnchor, transitionProfile, marketProfile){
  candidate.targetCenterTwinAnchorLineReturnBridgeScore = Array(10).fill(0);
  candidate.targetCenterTwinAnchorLineReturnBridgeDigits = [];
  candidate.targetCenterTwinAnchorLineReturnBridgeAudit = null;
  const ctx = targetCenterTwinAnchorLineReturnBridgeContext(latest, targetAnchor, transitionProfile, marketProfile);
  if(!ctx) return;
  const add = (d, amount, note) => {
    d = Number(d);
    if(!Number.isInteger(d) || d < 0 || d > 9) return;
    candidate.targetCenterTwinAnchorLineReturnBridgeScore[d] += amount;
    addCandidateTrace(candidate, d, amount, note, 'targetCenterTwinAnchorLineReturnBridge');
  };
  const sampleBoost = Math.min(7600, 470 * Math.max(0, ctx.transitionSamples - 4));
  const base = ctx.lowCarry ? 108000 : 98200;
  const lockBoost = ctx.lineLock ? 28600 : 0;
  add(ctx.akA, base + 76000 + sampleBoost + lockBoost, 'Target center-twin anchor-line return: center twin menjadi A');
  add(ctx.akK, base + 70600 + sampleBoost + lockBoost, 'Target center-twin anchor-line return: anchor K+L menjadi K');
  add(ctx.leL, base + 68400 + sampleBoost + lockBoost, 'Target center-twin anchor-line return: tail latest menjadi L');
  add(ctx.leE, base + 65600 + sampleBoost + lockBoost, 'Target center-twin anchor-line return: selisih center twin menjadi zero E');
  add(ctx.akKAlt, 24600 + Math.round(lockBoost*0.24), 'Target center-twin anchor-line return: A latest + K anchor support');
  add(ctx.akKAlt2, 21600, 'Target center-twin anchor-line return: center + tail latest support');
  add(ctx.leEAlt, 19200, 'Target center-twin anchor-line return: L anchor - A latest support');
  add(ctx.anchorA, 11800, 'Target center-twin anchor-line return: anchor front context');
  add(ctx.anchorE, 9800, 'Target center-twin anchor-line return: anchor tail context');
  add(ctx.latestA, 8200, 'Target center-twin anchor-line return: latest A context');
  add(ctx.anchorK, 7200, 'Target center-twin anchor-line return: anchor K context');
  add(ctx.mirrorCenter, 5600, 'Target center-twin anchor-line return: mirror center support');
  add(ctx.mirrorTail, 4800, 'Target center-twin anchor-line return: mirror tail support');
  add(ctx.rootLatest, 3600, 'Target center-twin anchor-line return: root latest context');
  add(ctx.rootAnchor, 3200, 'Target center-twin anchor-line return: root anchor context');
  candidate.targetCenterTwinAnchorLineReturnBridgeDigits = ctx.core
    .filter(d => (candidate.targetCenterTwinAnchorLineReturnBridgeScore[d] || 0) > 0)
    .sort((x,y) => (candidate.targetCenterTwinAnchorLineReturnBridgeScore[y] || 0) - (candidate.targetCenterTwinAnchorLineReturnBridgeScore[x] || 0));
  candidate.targetCenterTwinAnchorLineReturnBridgeAudit = {
    title:`Target center-twin anchor-line return bridge aktif: latest ${ctx.ld.join('')} + anchor ${ctx.ad.join('')}`,
    digits:candidate.targetCenterTwinAnchorLineReturnBridgeDigits.map(d => `${d}:${Math.round(candidate.targetCenterTwinAnchorLineReturnBridgeScore[d] || 0)}`).join(' | '),
    ak:ctx.ak,
    le:ctx.le,
    altAK:ctx.altAK,
    altLE:ctx.altLE
  };
}

function targetCenterTwinAnchorLineReturnBridgePairSeeds(latest, targetAnchor, candidate, kind){
  const ctx = targetCenterTwinAnchorLineReturnBridgeContext(latest, targetAnchor, candidate?.transitionProfile, candidate?.marketProfile);
  if(!ctx) return [];
  const seeds = [];
  const add = (pair, bonus, label) => { if(/^\d{2}$/.test(pair)) seeds.push({pair, width:2, bonus, label}); };
  const base = ctx.lowCarry ? 1186000 : 1066000;
  const lockBoost = ctx.lineLock ? 740000 : 0;
  if(kind === 'AK'){
    add(ctx.ak, base + 262000 + lockBoost, 'AK target center-twin anchor-line return: center twin + anchor K+L');
    add(ctx.altAK, Math.round(base*0.58) + Math.round(lockBoost*0.42), 'AK target center-twin anchor-line return: center twin + A latest/K anchor');
    add(`${ctx.akA}${ctx.akKAlt2}`, Math.round(base*0.46), 'AK target center-twin anchor-line return: center twin + center/tail support');
  }else{
    add(ctx.le, base + 274000 + lockBoost, 'LE target center-twin anchor-line return: tail latest + zero return');
    add(ctx.altLE, Math.round(base*0.54) + Math.round(lockBoost*0.38), 'LE target center-twin anchor-line return: tail latest + anchor line zero');
    add(`${ctx.leL}${ctx.akK}`, Math.round(base*0.42), 'LE target center-twin anchor-line return: tail latest + anchor K+L support');
  }
  return seeds;
}

function buildTargetCenterTwinAnchorLineReturnBridgeAudit(audit){
  if(!audit) return null;
  return {title:audit.title, digits:audit.digits, ak:audit.ak, le:audit.le, altAK:audit.altAK, altLE:audit.altLE};
}


// V8.6: Target Tail-Zero Anchor-Frame Center Bridge
// Dinamis untuk latest tanpa kembar dengan ekor zero (E=0), sementara center latest hidup (K!=L)
// dan anchor target menyediakan frame L/E. Struktur utama: AK = anchor L + latest K, LE = latest L + anchor E.
// Contoh: latest 5380 + anchor Sabtu 9417 membuka AK 13 dan LE 87.
function targetTailZeroAnchorFrameCenterBridgeContext(latest, targetAnchor, transitionProfile, marketProfile){
  const ld = latest?.digits || [];
  const ad = targetAnchor?.digits || [];
  if(ld.length < 4 || ad.length < 4) return null;
  const transitionSamples = Number(transitionProfile?.total || marketProfile?.total || 0);
  if(transitionSamples < 4) return null;
  if(twinInfo(latest).twins.length) return null;
  if(ld[3] !== 0) return null;
  if(ld[1] === ld[2]) return null;
  if(ld[1] === 0 || ld[2] === 0) return null;
  if(ad[2] === 0 || ad[3] === 0) return null;
  if(ad[2] === ld[1] && ad[3] === ld[2]) return null; // jika anchor hanya mengulang center, biarkan engine lama membaca

  const akA = ad[2];
  const akK = ld[1];
  const leL = ld[2];
  const leE = ad[3];
  const altAKK = mod10(ld[0] - ld[1]);
  const altLEE = mod10(ad[3] + ld[3]);
  const latestA = ld[0];
  const anchorA = ad[0];
  const anchorK = ad[1];
  const mirrorLatestA = mod10(10 - ld[0]);
  const mirrorAnchorA = mod10(10 - ad[0]);
  const centerSum = mod10(ld[1] + ld[2]);
  const anchorTailSum = mod10(ad[2] + ad[3]);
  const rootLatest = digitalRoot(sumDigits(latest));
  const rootAnchor = digitalRoot(sumDigits(targetAnchor));
  const hardCap = Number(marketProfile?.targetCarryHardCap || 4);
  const lowCarry = Number(marketProfile?.targetCarrySamples || marketProfile?.total || 0) >= 5 && hardCap <= 2;
  const frameLock = ad[2] !== ld[2] && ad[3] !== ld[1];
  const core = uniqueDigits([akA, akK, leL, leE, altAKK, altLEE, latestA, anchorA, anchorK, mirrorLatestA, mirrorAnchorA, centerSum, anchorTailSum, rootLatest, rootAnchor]);
  return {
    ld, ad, transitionSamples, hardCap, lowCarry, frameLock,
    akA, akK, leL, leE, altAKK, altLEE, latestA, anchorA, anchorK,
    mirrorLatestA, mirrorAnchorA, centerSum, anchorTailSum, rootLatest, rootAnchor,
    ak:`${akA}${akK}`,
    le:`${leL}${leE}`,
    altAK:`${akA}${altAKK}`,
    altLE:`${leL}${altLEE}`,
    core
  };
}

function applyTargetTailZeroAnchorFrameCenterBridge(candidate, latest, targetAnchor, transitionProfile, marketProfile){
  candidate.targetTailZeroAnchorFrameCenterBridgeScore = Array(10).fill(0);
  candidate.targetTailZeroAnchorFrameCenterBridgeDigits = [];
  candidate.targetTailZeroAnchorFrameCenterBridgeAudit = null;
  const ctx = targetTailZeroAnchorFrameCenterBridgeContext(latest, targetAnchor, transitionProfile, marketProfile);
  if(!ctx) return;
  const add = (d, amount, note) => {
    d = Number(d);
    if(!Number.isInteger(d) || d < 0 || d > 9) return;
    candidate.targetTailZeroAnchorFrameCenterBridgeScore[d] += amount;
    addCandidateTrace(candidate, d, amount, note, 'targetTailZeroAnchorFrameCenterBridge');
  };
  const sampleBoost = Math.min(8200, 520 * Math.max(0, ctx.transitionSamples - 4));
  const base = ctx.lowCarry ? 112000 : 104800;
  const frameBoost = ctx.frameLock ? 31600 : 0;
  add(ctx.akA, base + 78400 + sampleBoost + frameBoost, 'Target tail-zero anchor-frame center: L anchor menjadi A');
  add(ctx.akK, base + 74800 + sampleBoost + frameBoost, 'Target tail-zero anchor-frame center: K latest tetap menjadi K');
  add(ctx.leL, base + 81200 + sampleBoost + frameBoost, 'Target tail-zero anchor-frame center: L latest tetap menjadi L');
  add(ctx.leE, base + 76800 + sampleBoost + frameBoost, 'Target tail-zero anchor-frame center: E anchor menjadi E');
  add(ctx.altAKK, 26600 + Math.round(frameBoost*0.22), 'Target tail-zero anchor-frame center: A-K latest support');
  add(ctx.altLEE, 22600 + Math.round(frameBoost*0.18), 'Target tail-zero anchor-frame center: anchor E + zero tail support');
  add(ctx.latestA, 11800, 'Target tail-zero anchor-frame center: latest A context');
  add(ctx.anchorA, 10400, 'Target tail-zero anchor-frame center: anchor A context');
  add(ctx.anchorK, 8800, 'Target tail-zero anchor-frame center: anchor K context');
  add(ctx.mirrorLatestA, 6200, 'Target tail-zero anchor-frame center: mirror latest A support');
  add(ctx.mirrorAnchorA, 5200, 'Target tail-zero anchor-frame center: mirror anchor A support');
  add(ctx.centerSum, 4200, 'Target tail-zero anchor-frame center: center sum support');
  add(ctx.anchorTailSum, 3800, 'Target tail-zero anchor-frame center: anchor tail sum support');
  add(ctx.rootLatest, 3200, 'Target tail-zero anchor-frame center: root latest context');
  add(ctx.rootAnchor, 2800, 'Target tail-zero anchor-frame center: root anchor context');
  candidate.targetTailZeroAnchorFrameCenterBridgeDigits = ctx.core
    .filter(d => (candidate.targetTailZeroAnchorFrameCenterBridgeScore[d] || 0) > 0)
    .sort((x,y) => (candidate.targetTailZeroAnchorFrameCenterBridgeScore[y] || 0) - (candidate.targetTailZeroAnchorFrameCenterBridgeScore[x] || 0));
  candidate.targetTailZeroAnchorFrameCenterBridgeAudit = {
    title:`Target tail-zero anchor-frame center bridge aktif: latest ${ctx.ld.join('')} + anchor ${ctx.ad.join('')}`,
    digits:candidate.targetTailZeroAnchorFrameCenterBridgeDigits.map(d => `${d}:${Math.round(candidate.targetTailZeroAnchorFrameCenterBridgeScore[d] || 0)}`).join(' | '),
    ak:ctx.ak,
    le:ctx.le,
    altAK:ctx.altAK,
    altLE:ctx.altLE
  };
}

function targetTailZeroAnchorFrameCenterBridgePairSeeds(latest, targetAnchor, candidate, kind){
  const ctx = targetTailZeroAnchorFrameCenterBridgeContext(latest, targetAnchor, candidate?.transitionProfile, candidate?.marketProfile);
  if(!ctx) return [];
  const seeds = [];
  const add = (pair, bonus, label) => { if(/^\d{2}$/.test(pair)) seeds.push({pair, width:2, bonus, label}); };
  const base = ctx.lowCarry ? 1228000 : 1118000;
  const frameBoost = ctx.frameLock ? 760000 : 0;
  if(kind === 'AK'){
    add(ctx.ak, base + 286000 + frameBoost, 'AK target tail-zero anchor-frame center: L anchor + K latest');
    add(ctx.altAK, Math.round(base*0.52) + Math.round(frameBoost*0.36), 'AK target tail-zero anchor-frame center: L anchor + A-K support');
    add(`${ctx.akA}${ctx.leL}`, Math.round(base*0.44), 'AK target tail-zero anchor-frame center: L anchor + L latest support');
  }else{
    add(ctx.le, base + 308000 + frameBoost, 'LE target tail-zero anchor-frame center: L latest + E anchor');
    add(ctx.altLE, Math.round(base*0.50) + Math.round(frameBoost*0.34), 'LE target tail-zero anchor-frame center: L latest + zero-tail support');
    add(`${ctx.akK}${ctx.leE}`, Math.round(base*0.42), 'LE target tail-zero anchor-frame center: K latest + E anchor support');
  }
  return seeds;
}

function buildTargetTailZeroAnchorFrameCenterBridgeAudit(audit){
  if(!audit) return null;
  return {title:audit.title, digits:audit.digits, ak:audit.ak, le:audit.le, altAK:audit.altAK, altLE:audit.altLE};
}



// V8.7: Target Double-Twin Tail-Mirror Bridge
// Dinamis untuk latest berbentuk dua kembar sisi: A=K dan L=E, sementara anchor target punya tail twin.
// Struktur utama: AK = E anchor + (tail latest + E anchor), LE = mirror10(tail latest) + mirror10(tail latest).
// Contoh: latest 7722 + anchor Rabu 0911 membuka AK 13, LE 88, kandidat kembar 88.
function targetDoubleTwinTailMirrorBridgeContext(latest, targetAnchor, transitionProfile, marketProfile){
  const ld = latest?.digits || [];
  const ad = targetAnchor?.digits || [];
  if(ld.length < 4 || ad.length < 4) return null;
  const transitionSamples = Number(transitionProfile?.total || marketProfile?.total || 0);
  if(transitionSamples < 4) return null;
  if(ld[0] !== ld[1] || ld[2] !== ld[3] || ld[0] === ld[2]) return null;
  if(ad[2] !== ad[3]) return null;
  if(ad[3] === 0) return null;

  const frontTwin = ld[0];
  const tailTwin = ld[2];
  const anchorTail = ad[3];
  const akA = anchorTail;
  const akK = mod10(tailTwin + anchorTail);
  const leL = mod10(10 - tailTwin);
  const leE = leL;
  const altAKK = mod10(frontTwin - tailTwin);
  const altAKA = ad[0];
  const altLE = `${leL}${tailTwin}`;
  const latestRoot = digitalRoot(sumDigits(latest));
  const anchorRoot = digitalRoot(sumDigits(targetAnchor));
  const frontStep = mod10(frontTwin + 1);
  const tailStep = mod10(tailTwin + 1);
  const mirrorFront = mod10(10 - frontTwin);
  const mirrorTail9 = mod10(9 - tailTwin);
  const strongTailMirror = leL === mod10(frontTwin + anchorTail) || leL === frontStep;
  const core = uniqueDigits([akA, akK, leL, leE, altAKK, altAKA, tailTwin, frontTwin, latestRoot, anchorRoot, frontStep, tailStep, mirrorFront, mirrorTail9]);
  return {
    ld, ad, transitionSamples, frontTwin, tailTwin, anchorTail, strongTailMirror,
    akA, akK, leL, leE, altAKK, altAKA, altLE,
    latestRoot, anchorRoot, frontStep, tailStep, mirrorFront, mirrorTail9,
    ak:`${akA}${akK}`,
    le:`${leL}${leE}`,
    altAK:`${akA}${altAKK}`,
    core
  };
}

function applyTargetDoubleTwinTailMirrorBridge(candidate, latest, targetAnchor, transitionProfile, marketProfile){
  candidate.targetDoubleTwinTailMirrorBridgeScore = Array(10).fill(0);
  candidate.targetDoubleTwinTailMirrorBridgeDigits = [];
  candidate.targetDoubleTwinTailMirrorBridgeAudit = null;
  candidate.targetDoubleTwinTailMirrorBridgeTwinScore = Array(10).fill(0);
  candidate.targetDoubleTwinTailMirrorBridgeTwinDigit = null;
  const ctx = targetDoubleTwinTailMirrorBridgeContext(latest, targetAnchor, transitionProfile, marketProfile);
  if(!ctx) return;
  const add = (d, amount, note) => {
    d = Number(d);
    if(!Number.isInteger(d) || d < 0 || d > 9) return;
    candidate.targetDoubleTwinTailMirrorBridgeScore[d] += amount;
    addCandidateTrace(candidate, d, amount, note, 'targetDoubleTwinTailMirrorBridge');
  };
  const sampleBoost = Math.min(7600, 480 * Math.max(0, ctx.transitionSamples - 4));
  const base = 114000;
  const mirrorBoost = ctx.strongTailMirror ? 28200 : 0;
  add(ctx.akA, base + 62600 + sampleBoost, 'Target double-twin tail-mirror: E anchor menjadi A');
  add(ctx.akK, base + 59800 + sampleBoost, 'Target double-twin tail-mirror: tail latest + E anchor menjadi K');
  add(ctx.leL, base + 87200 + sampleBoost + mirrorBoost, 'Target double-twin tail-mirror: mirror10 tail latest menjadi L/E');
  add(ctx.altAKK, 23600, 'Target double-twin tail-mirror: selisih twin depan-ekor support');
  add(ctx.frontStep, 18400, 'Target double-twin tail-mirror: twin depan naik satu support');
  add(ctx.tailStep, 12600, 'Target double-twin tail-mirror: twin ekor naik satu support');
  add(ctx.mirrorFront, 7800, 'Target double-twin tail-mirror: mirror front twin support');
  add(ctx.latestRoot, 4200, 'Target double-twin tail-mirror: root latest context');
  add(ctx.anchorRoot, 3600, 'Target double-twin tail-mirror: root anchor context');
  candidate.targetDoubleTwinTailMirrorBridgeTwinScore[ctx.leL] += base + 126000 + sampleBoost + mirrorBoost;
  candidate.targetDoubleTwinTailMirrorBridgeTwinDigit = ctx.leL;
  candidate.targetDoubleTwinTailMirrorBridgeDigits = ctx.core
    .filter(d => (candidate.targetDoubleTwinTailMirrorBridgeScore[d] || 0) > 0)
    .sort((x,y) => (candidate.targetDoubleTwinTailMirrorBridgeScore[y] || 0) - (candidate.targetDoubleTwinTailMirrorBridgeScore[x] || 0));
  candidate.targetDoubleTwinTailMirrorBridgeAudit = {
    title:`Target double-twin tail-mirror bridge aktif: latest ${ctx.ld.join('')} + anchor ${ctx.ad.join('')}`,
    digits:candidate.targetDoubleTwinTailMirrorBridgeDigits.map(d => `${d}:${Math.round(candidate.targetDoubleTwinTailMirrorBridgeScore[d] || 0)}`).join(' | '),
    ak:ctx.ak,
    le:ctx.le,
    altAK:ctx.altAK,
    altLE:ctx.altLE,
    twin:`${ctx.leL}${ctx.leL}`
  };
}

function targetDoubleTwinTailMirrorBridgePairSeeds(latest, targetAnchor, candidate, kind){
  const ctx = targetDoubleTwinTailMirrorBridgeContext(latest, targetAnchor, candidate?.transitionProfile, candidate?.marketProfile);
  if(!ctx) return [];
  const seeds = [];
  const add = (pair, bonus, label) => { if(/^\d{2}$/.test(pair)) seeds.push({pair, width:2, bonus, label}); };
  const base = 1220000;
  if(kind === 'AK'){
    add(ctx.ak, base + 356000, 'AK target double-twin tail-mirror: E anchor + tail latest/E anchor');
    add(ctx.altAK, Math.round(base*0.48), 'AK target double-twin tail-mirror: E anchor + twin diff support');
    add(`${ctx.akA}${ctx.leL}`, Math.round(base*0.40), 'AK target double-twin tail-mirror: E anchor + mirror tail support');
  }else{
    add(ctx.le, base + 468000, 'LE target double-twin tail-mirror: mirror10 tail latest sebagai kembar');
    add(ctx.altLE, Math.round(base*0.40), 'LE target double-twin tail-mirror: mirror tail + tail latest support');
    add(`${ctx.akK}${ctx.leL}`, Math.round(base*0.34), 'LE target double-twin tail-mirror: K hasil + mirror tail support');
  }
  return seeds;
}

function buildTargetDoubleTwinTailMirrorBridgeAudit(audit){
  if(!audit) return null;
  return {title:audit.title, digits:audit.digits, ak:audit.ak, le:audit.le, altAK:audit.altAK, altLE:audit.altLE, twin:audit.twin};
}

// V8.7: Target Anchor-Echo L-Mirror Bridge
// Dinamis untuk anchor target yang menggemakan K/E sama dan L=0, sementara latest membawa K yang sama.
// Struktur utama: AK = L latest + mirror9(A latest), LE = K anchor + mirror10(K anchor).
// Contoh: latest 8652 + anchor Rabu 9606 membuka AK 51, LE 64.
function targetAnchorEchoLMirrorBridgeContext(latest, targetAnchor, transitionProfile, marketProfile){
  const ld = latest?.digits || [];
  const ad = targetAnchor?.digits || [];
  if(ld.length < 4 || ad.length < 4) return null;
  const transitionSamples = Number(transitionProfile?.total || marketProfile?.total || 0);
  if(transitionSamples < 4) return null;
  if(twinInfo(latest).twins.length) return null;
  if(ad[2] !== 0) return null;
  if(ad[1] !== ad[3]) return null;
  if(ad[1] === 0) return null;
  if(ld[1] !== ad[1]) return null;
  if(ld[2] === 0) return null;

  const akA = ld[2];
  const akK = mod10(9 - ld[0]);
  const leL = ad[1];
  const leE = mod10(10 - ad[1]);
  const latestE = ld[3];
  const latestA = ld[0];
  const anchorA = ad[0];
  const anchorEcho = ad[1];
  const altAK = `${akA}${latestE}`;
  const altLE = `${leL}${latestE}`;
  const centerSum = mod10(ld[1] + ld[2]);
  const edgeDiff = mod10(ld[0] - ld[3]);
  const anchorRoot = digitalRoot(sumDigits(targetAnchor));
  const latestRoot = digitalRoot(sumDigits(latest));
  const strongEcho = leE === mod10(ad[2] + leE) && ld[1] === ad[1] && ad[1] === ad[3];
  const core = uniqueDigits([akA, akK, leL, leE, latestE, latestA, anchorA, anchorEcho, centerSum, edgeDiff, anchorRoot, latestRoot]);
  return {
    ld, ad, transitionSamples, strongEcho,
    akA, akK, leL, leE, latestE, latestA, anchorA, anchorEcho, altAK, altLE,
    centerSum, edgeDiff, anchorRoot, latestRoot,
    ak:`${akA}${akK}`,
    le:`${leL}${leE}`,
    core
  };
}

function applyTargetAnchorEchoLMirrorBridge(candidate, latest, targetAnchor, transitionProfile, marketProfile){
  candidate.targetAnchorEchoLMirrorBridgeScore = Array(10).fill(0);
  candidate.targetAnchorEchoLMirrorBridgeDigits = [];
  candidate.targetAnchorEchoLMirrorBridgeAudit = null;
  const ctx = targetAnchorEchoLMirrorBridgeContext(latest, targetAnchor, transitionProfile, marketProfile);
  if(!ctx) return;
  const add = (d, amount, note) => {
    d = Number(d);
    if(!Number.isInteger(d) || d < 0 || d > 9) return;
    candidate.targetAnchorEchoLMirrorBridgeScore[d] += amount;
    addCandidateTrace(candidate, d, amount, note, 'targetAnchorEchoLMirrorBridge');
  };
  const sampleBoost = Math.min(7200, 460 * Math.max(0, ctx.transitionSamples - 4));
  const base = 116000;
  const echoBoost = ctx.strongEcho ? 28600 : 0;
  add(ctx.akA, base + 84600 + sampleBoost + echoBoost, 'Target anchor-echo L-mirror: L latest menjadi A');
  add(ctx.akK, base + 79200 + sampleBoost + echoBoost, 'Target anchor-echo L-mirror: mirror9 A latest menjadi K');
  add(ctx.leL, base + 73800 + sampleBoost, 'Target anchor-echo L-mirror: K/E anchor menjadi L');
  add(ctx.leE, base + 70600 + sampleBoost, 'Target anchor-echo L-mirror: mirror10 K/E anchor menjadi E');
  add(ctx.latestE, 26400, 'Target anchor-echo L-mirror: E latest support');
  add(ctx.centerSum, 14600, 'Target anchor-echo L-mirror: center sum support');
  add(ctx.edgeDiff, 12200, 'Target anchor-echo L-mirror: edge diff support');
  add(ctx.anchorA, 8800, 'Target anchor-echo L-mirror: anchor A context');
  add(ctx.latestRoot, 5200, 'Target anchor-echo L-mirror: root latest context');
  add(ctx.anchorRoot, 4800, 'Target anchor-echo L-mirror: root anchor context');
  candidate.targetAnchorEchoLMirrorBridgeDigits = ctx.core
    .filter(d => (candidate.targetAnchorEchoLMirrorBridgeScore[d] || 0) > 0)
    .sort((x,y) => (candidate.targetAnchorEchoLMirrorBridgeScore[y] || 0) - (candidate.targetAnchorEchoLMirrorBridgeScore[x] || 0));
  candidate.targetAnchorEchoLMirrorBridgeAudit = {
    title:`Target anchor-echo L-mirror bridge aktif: latest ${ctx.ld.join('')} + anchor ${ctx.ad.join('')}`,
    digits:candidate.targetAnchorEchoLMirrorBridgeDigits.map(d => `${d}:${Math.round(candidate.targetAnchorEchoLMirrorBridgeScore[d] || 0)}`).join(' | '),
    ak:ctx.ak,
    le:ctx.le,
    altAK:ctx.altAK,
    altLE:ctx.altLE
  };
}

function targetAnchorEchoLMirrorBridgePairSeeds(latest, targetAnchor, candidate, kind){
  const ctx = targetAnchorEchoLMirrorBridgeContext(latest, targetAnchor, candidate?.transitionProfile, candidate?.marketProfile);
  if(!ctx) return [];
  const seeds = [];
  const add = (pair, bonus, label) => { if(/^\d{2}$/.test(pair)) seeds.push({pair, width:2, bonus, label}); };
  const base = 1260000;
  const echoBoost = ctx.strongEcho ? 520000 : 0;
  if(kind === 'AK'){
    add(ctx.ak, base + 442000 + echoBoost, 'AK target anchor-echo L-mirror: L latest + mirror9 A');
    add(ctx.altAK, Math.round(base*0.40), 'AK target anchor-echo L-mirror: L latest + E latest support');
    add(`${ctx.akA}${ctx.leL}`, Math.round(base*0.36), 'AK target anchor-echo L-mirror: L latest + anchor echo support');
  }else{
    add(ctx.le, base + 418000 + echoBoost, 'LE target anchor-echo L-mirror: K/E anchor + mirror10 anchor');
    add(ctx.altLE, Math.round(base*0.38), 'LE target anchor-echo L-mirror: K/E anchor + E latest support');
    add(`${ctx.akK}${ctx.leE}`, Math.round(base*0.34), 'LE target anchor-echo L-mirror: mirror9 A + mirror10 anchor support');
  }
  return seeds;
}

function buildTargetAnchorEchoLMirrorBridgeAudit(audit){
  if(!audit) return null;
  return {title:audit.title, digits:audit.digits, ak:audit.ak, le:audit.le, altAK:audit.altAK, altLE:audit.altLE};
}


// V8.8: Target Center-Sum Tail-Lock Bridge
// Dinamis untuk latest tanpa kembar ketika anchor target punya front-L repeat dan ekor zero.
// Struktur utama: AK = (K+L latest / mirror9 A latest) + K latest, LE = L latest + E latest.
// Contoh: latest 3428 + anchor Rabu 5950 membuka AK 64, LE 28.
function targetCenterSumTailLockBridgeContext(latest, targetAnchor, transitionProfile, marketProfile){
  const ld = latest?.digits || [];
  const ad = targetAnchor?.digits || [];
  if(ld.length < 4 || ad.length < 4) return null;
  const transitionSamples = Number(transitionProfile?.total || marketProfile?.total || 0);
  if(transitionSamples < 4) return null;
  if(twinInfo(latest).twins.length) return null;
  if(ad[3] !== 0) return null;
  if(ad[0] !== ad[2]) return null;
  if(ld[1] === ld[2]) return null;
  if(ld[3] === 0) return null;

  const centerSum = mod10(ld[1] + ld[2]);
  const mirrorA9 = mod10(9 - ld[0]);
  const mirrorA10 = mod10(10 - ld[0]);
  if(centerSum !== mirrorA9) return null;

  const akA = centerSum;
  const akK = ld[1];
  const leL = ld[2];
  const leE = ld[3];
  const anchorGate = ad[0];
  const anchorK = ad[1];
  const anchorZero = ad[3];
  const edgeSum = mod10(ld[0] + ld[3]);
  const centerDiff = mod10(ld[1] - ld[2]);
  const rootLatest = digitalRoot(sumDigits(latest));
  const rootAnchor = digitalRoot(sumDigits(targetAnchor));
  const strongLock = ad[0] === ad[2] && ad[3] === 0 && centerSum === mirrorA9;
  const core = uniqueDigits([akA, akK, leL, leE, anchorGate, anchorK, anchorZero, mirrorA10, edgeSum, centerDiff, rootLatest, rootAnchor]);
  return {
    ld, ad, transitionSamples, strongLock,
    akA, akK, leL, leE, centerSum, mirrorA9, mirrorA10,
    anchorGate, anchorK, anchorZero, edgeSum, centerDiff, rootLatest, rootAnchor,
    ak:`${akA}${akK}`,
    le:`${leL}${leE}`,
    altAK:`${mirrorA10}${akK}`,
    altLE:`${akK}${leE}`,
    core
  };
}

function applyTargetCenterSumTailLockBridge(candidate, latest, targetAnchor, transitionProfile, marketProfile){
  candidate.targetCenterSumTailLockBridgeScore = Array(10).fill(0);
  candidate.targetCenterSumTailLockBridgeDigits = [];
  candidate.targetCenterSumTailLockBridgeAudit = null;
  const ctx = targetCenterSumTailLockBridgeContext(latest, targetAnchor, transitionProfile, marketProfile);
  if(!ctx) return;
  const add = (d, amount, note) => {
    d = Number(d);
    if(!Number.isInteger(d) || d < 0 || d > 9) return;
    candidate.targetCenterSumTailLockBridgeScore[d] += amount;
    addCandidateTrace(candidate, d, amount, note, 'targetCenterSumTailLockBridge');
  };
  const sampleBoost = Math.min(6400, 430 * Math.max(0, ctx.transitionSamples - 4));
  const base = 108000;
  const lockBoost = ctx.strongLock ? 24600 : 0;
  add(ctx.akA, base + 80200 + sampleBoost + lockBoost, 'Target center-sum tail-lock: K+L latest / mirror9 A menjadi A');
  add(ctx.akK, base + 74600 + sampleBoost + lockBoost, 'Target center-sum tail-lock: K latest tetap sebagai K');
  add(ctx.leL, base + 71400 + sampleBoost, 'Target center-sum tail-lock: L latest tetap sebagai L');
  add(ctx.leE, base + 88200 + sampleBoost + lockBoost, 'Target center-sum tail-lock: E latest/tail lock menjadi E');
  add(ctx.anchorGate, 18400, 'Target center-sum tail-lock: anchor A/L repeat context');
  add(ctx.anchorK, 13600, 'Target center-sum tail-lock: anchor K context');
  add(ctx.anchorZero, 10800, 'Target center-sum tail-lock: zero tail anchor context');
  add(ctx.mirrorA10, 7600, 'Target center-sum tail-lock: mirror10 A support');
  add(ctx.edgeSum, 6200, 'Target center-sum tail-lock: edge sum support');
  add(ctx.centerDiff, 4800, 'Target center-sum tail-lock: center diff support');
  add(ctx.rootLatest, 3600, 'Target center-sum tail-lock: root latest context');
  add(ctx.rootAnchor, 3200, 'Target center-sum tail-lock: root anchor context');
  candidate.targetCenterSumTailLockBridgeDigits = ctx.core
    .filter(d => (candidate.targetCenterSumTailLockBridgeScore[d] || 0) > 0)
    .sort((x,y) => (candidate.targetCenterSumTailLockBridgeScore[y] || 0) - (candidate.targetCenterSumTailLockBridgeScore[x] || 0));
  candidate.targetCenterSumTailLockBridgeAudit = {
    title:`Target center-sum tail-lock bridge aktif: latest ${ctx.ld.join('')} + anchor ${ctx.ad.join('')}`,
    digits:candidate.targetCenterSumTailLockBridgeDigits.map(d => `${d}:${Math.round(candidate.targetCenterSumTailLockBridgeScore[d] || 0)}`).join(' | '),
    ak:ctx.ak,
    le:ctx.le,
    altAK:ctx.altAK,
    altLE:ctx.altLE
  };
}

function targetCenterSumTailLockBridgePairSeeds(latest, targetAnchor, candidate, kind){
  const ctx = targetCenterSumTailLockBridgeContext(latest, targetAnchor, candidate?.transitionProfile, candidate?.marketProfile);
  if(!ctx) return [];
  const seeds = [];
  const add = (pair, bonus, label) => { if(/^\d{2}$/.test(pair)) seeds.push({pair, width:2, bonus, label}); };
  const base = 1320000;
  const lockBoost = ctx.strongLock ? 560000 : 0;
  if(kind === 'AK'){
    add(ctx.ak, base + 476000 + lockBoost, 'AK target center-sum tail-lock: K+L latest + K latest');
    add(ctx.altAK, Math.round(base*0.42), 'AK target center-sum tail-lock: mirror10 A + K support');
    add(`${ctx.akA}${ctx.leL}`, Math.round(base*0.36), 'AK target center-sum tail-lock: center sum + L support');
  }else{
    add(ctx.le, base + 518000 + lockBoost, 'LE target center-sum tail-lock: L latest + E latest');
    add(ctx.altLE, Math.round(base*0.40), 'LE target center-sum tail-lock: K latest + E latest support');
    add(`${ctx.akA}${ctx.leE}`, Math.round(base*0.34), 'LE target center-sum tail-lock: center sum + E support');
  }
  return seeds;
}

function buildTargetCenterSumTailLockBridgeAudit(audit){
  if(!audit) return null;
  return {title:audit.title, digits:audit.digits, ak:audit.ak, le:audit.le, altAK:audit.altAK, altLE:audit.altLE};
}


// V8.9: Target Anchor-Nine Zero Tail-Mirror Bridge
// Dinamis untuk latest non-kembar ketika anchor target membentuk K-L = 99 dan ekor zero.
// Struktur utama: AK = E latest + mirror9(A latest), LE = mirror9(L latest) + L latest.
// Contoh: latest 6428 + anchor Kamis 4990 membuka AK 83, LE 72.
function targetAnchorNineZeroTailMirrorBridgeContext(latest, targetAnchor, transitionProfile, marketProfile){
  const ld = latest?.digits || [];
  const ad = targetAnchor?.digits || [];
  if(ld.length < 4 || ad.length < 4) return null;
  const transitionSamples = Number(transitionProfile?.total || marketProfile?.total || 0);
  if(transitionSamples < 4) return null;
  if(twinInfo(latest).twins.length) return null;
  if(ad[1] !== 9 || ad[2] !== 9 || ad[3] !== 0) return null;
  if(ad[0] !== ld[1]) return null;
  if(ld[2] === 0 || ld[3] === 0) return null;

  const akA = ld[3];
  const akK = mod10(9 - ld[0]);
  const leL = mod10(9 - ld[2]);
  const leE = ld[2];
  const altAK = `${ld[3]}${ld[2]}`;
  const altLE = `${akK}${leE}`;
  const mirrorK10 = mod10(10 - ld[1]);
  const edgeDiff = mod10(ld[3] - ld[0]);
  const centerSum = mod10(ld[1] + ld[2]);
  const anchorA = ad[0];
  const anchorZero = ad[3];
  const rootLatest = digitalRoot(sumDigits(latest));
  const rootAnchor = digitalRoot(sumDigits(targetAnchor));
  const strongLock = ad[0] === ld[1] && ad[1] === 9 && ad[2] === 9 && ad[3] === 0;
  const core = uniqueDigits([akA, akK, leL, leE, anchorA, anchorZero, mirrorK10, edgeDiff, centerSum, rootLatest, rootAnchor]);
  return {
    ld, ad, transitionSamples, strongLock,
    akA, akK, leL, leE, altAK, altLE, mirrorK10, edgeDiff, centerSum,
    anchorA, anchorZero, rootLatest, rootAnchor,
    ak:`${akA}${akK}`,
    le:`${leL}${leE}`,
    core
  };
}

function applyTargetAnchorNineZeroTailMirrorBridge(candidate, latest, targetAnchor, transitionProfile, marketProfile){
  candidate.targetAnchorNineZeroTailMirrorBridgeScore = Array(10).fill(0);
  candidate.targetAnchorNineZeroTailMirrorBridgeDigits = [];
  candidate.targetAnchorNineZeroTailMirrorBridgeAudit = null;
  const ctx = targetAnchorNineZeroTailMirrorBridgeContext(latest, targetAnchor, transitionProfile, marketProfile);
  if(!ctx) return;
  const add = (d, amount, note) => {
    d = Number(d);
    if(!Number.isInteger(d) || d < 0 || d > 9) return;
    candidate.targetAnchorNineZeroTailMirrorBridgeScore[d] += amount;
    addCandidateTrace(candidate, d, amount, note, 'targetAnchorNineZeroTailMirrorBridge');
  };
  const sampleBoost = Math.min(7200, 460 * Math.max(0, ctx.transitionSamples - 4));
  const base = 122000;
  const lockBoost = ctx.strongLock ? 31800 : 0;
  add(ctx.akA, base + 84600 + sampleBoost + lockBoost, 'Target anchor-nine zero tail-mirror: E latest menjadi A');
  add(ctx.akK, base + 234200 + sampleBoost + lockBoost, 'Target anchor-nine zero tail-mirror: mirror9 A latest menjadi K');
  add(ctx.leL, base + 274400 + sampleBoost + lockBoost, 'Target anchor-nine zero tail-mirror: mirror9 L latest menjadi L');
  add(ctx.leE, base + 151800 + sampleBoost + lockBoost, 'Target anchor-nine zero tail-mirror: L latest kembali sebagai E');
  add(ctx.anchorA, 16400, 'Target anchor-nine zero tail-mirror: anchor A = K latest context');
  add(ctx.anchorZero, 11800, 'Target anchor-nine zero tail-mirror: zero tail anchor context');
  add(ctx.mirrorK10, 9800, 'Target anchor-nine zero tail-mirror: mirror10 K latest support');
  add(ctx.edgeDiff, 7400, 'Target anchor-nine zero tail-mirror: edge diff support');
  add(ctx.centerSum, 6400, 'Target anchor-nine zero tail-mirror: center sum support');
  add(ctx.rootLatest, 4200, 'Target anchor-nine zero tail-mirror: root latest context');
  add(ctx.rootAnchor, 3600, 'Target anchor-nine zero tail-mirror: root anchor context');
  candidate.targetAnchorNineZeroTailMirrorBridgeDigits = ctx.core
    .filter(d => (candidate.targetAnchorNineZeroTailMirrorBridgeScore[d] || 0) > 0)
    .sort((x,y) => (candidate.targetAnchorNineZeroTailMirrorBridgeScore[y] || 0) - (candidate.targetAnchorNineZeroTailMirrorBridgeScore[x] || 0));
  candidate.targetAnchorNineZeroTailMirrorBridgeAudit = {
    title:`Target anchor-nine zero tail-mirror bridge aktif: latest ${ctx.ld.join('')} + anchor ${ctx.ad.join('')}`,
    digits:candidate.targetAnchorNineZeroTailMirrorBridgeDigits.map(d => `${d}:${Math.round(candidate.targetAnchorNineZeroTailMirrorBridgeScore[d] || 0)}`).join(' | '),
    ak:ctx.ak,
    le:ctx.le,
    altAK:ctx.altAK,
    altLE:ctx.altLE
  };
}

function targetAnchorNineZeroTailMirrorBridgePairSeeds(latest, targetAnchor, candidate, kind){
  const ctx = targetAnchorNineZeroTailMirrorBridgeContext(latest, targetAnchor, candidate?.transitionProfile, candidate?.marketProfile);
  if(!ctx) return [];
  const seeds = [];
  const add = (pair, bonus, label) => { if(/^\d{2}$/.test(pair)) seeds.push({pair, width:2, bonus, label}); };
  const base = 6200000;
  const lockBoost = ctx.strongLock ? 1180000 : 0;
  if(kind === 'AK'){
    add(ctx.ak, base + 1680000 + lockBoost, 'AK target anchor-nine zero tail-mirror: E latest + mirror9 A latest');
    add(ctx.altAK, Math.round(base*0.42), 'AK target anchor-nine zero tail-mirror: E latest + L latest support');
    add(`${ctx.akA}${ctx.leL}`, Math.round(base*0.36), 'AK target anchor-nine zero tail-mirror: E latest + mirror9 L support');
  }else{
    add(ctx.le, base + 1720000 + lockBoost, 'LE target anchor-nine zero tail-mirror: mirror9 L latest + L latest');
    add(ctx.altLE, Math.round(base*0.40), 'LE target anchor-nine zero tail-mirror: mirror9 A + L latest support');
    add(`${ctx.akK}${ctx.akA}`, Math.round(base*0.32), 'LE target anchor-nine zero tail-mirror: mirror9 A + E latest support');
  }
  return seeds;
}

function buildTargetAnchorNineZeroTailMirrorBridgeAudit(audit){
  if(!audit) return null;
  return {title:audit.title, digits:audit.digits, ak:audit.ak, le:audit.le, altAK:audit.altAK, altLE:audit.altLE};
}


// V9.0: Target Anchor Cross-Lock Center-Zero Bridge
// Dinamis untuk latest non-kembar dengan center-sum zero, dan anchor target mengunci silang: anchor K = latest E, anchor L = latest A.
// Struktur utama: AK = mirror10(anchor E) + anchor K, LE = latest K + (latest K + latest L).
// Contoh: latest 8372 + anchor Sabtu 5286 membuka AK 42, LE 30.
function targetAnchorCrossLockCenterZeroBridgeContext(latest, targetAnchor, transitionProfile, marketProfile){
  const ld = latest?.digits || [];
  const ad = targetAnchor?.digits || [];
  if(ld.length < 4 || ad.length < 4) return null;
  const transitionSamples = Number(transitionProfile?.total || marketProfile?.total || 0);
  if(transitionSamples < 4) return null;
  if(twinInfo(latest).twins.length) return null;
  if(ad[1] !== ld[3]) return null;
  if(ad[2] !== ld[0]) return null;
  const centerZero = mod10(ld[1] + ld[2]);
  if(centerZero !== 0) return null;
  if(ad[3] === 0) return null;

  const akA = mod10(10 - ad[3]);
  const akK = ad[1];
  const leL = ld[1];
  const leE = centerZero;
  const altAK = `${akA}${leL}`;
  const altLE = `${leL}${akK}`;
  const mirrorA9 = mod10(9 - ld[0]);
  const mirrorL9 = mod10(9 - ld[2]);
  const anchorA = ad[0];
  const anchorE = ad[3];
  const latestE = ld[3];
  const latestRoot = digitalRoot(sumDigits(latest));
  const anchorRoot = digitalRoot(sumDigits(targetAnchor));
  const crossLock = ad[1] === ld[3] && ad[2] === ld[0] && centerZero === 0;
  const core = uniqueDigits([akA, akK, leL, leE, altAK[1], altLE[1], mirrorA9, mirrorL9, anchorA, anchorE, latestE, latestRoot, anchorRoot]);
  return {
    ld, ad, transitionSamples, centerZero, crossLock,
    akA, akK, leL, leE, altAK, altLE, mirrorA9, mirrorL9, anchorA, anchorE, latestE, latestRoot, anchorRoot,
    ak:`${akA}${akK}`,
    le:`${leL}${leE}`,
    core
  };
}

function applyTargetAnchorCrossLockCenterZeroBridge(candidate, latest, targetAnchor, transitionProfile, marketProfile){
  candidate.targetAnchorCrossLockCenterZeroBridgeScore = Array(10).fill(0);
  candidate.targetAnchorCrossLockCenterZeroBridgeDigits = [];
  candidate.targetAnchorCrossLockCenterZeroBridgeAudit = null;
  const ctx = targetAnchorCrossLockCenterZeroBridgeContext(latest, targetAnchor, transitionProfile, marketProfile);
  if(!ctx) return;
  const add = (d, amount, note) => {
    d = Number(d);
    if(!Number.isInteger(d) || d < 0 || d > 9) return;
    candidate.targetAnchorCrossLockCenterZeroBridgeScore[d] += amount;
    addCandidateTrace(candidate, d, amount, note, 'targetAnchorCrossLockCenterZeroBridge');
  };
  const sampleBoost = Math.min(7800, 520 * Math.max(0, ctx.transitionSamples - 4));
  const base = 124000;
  const lockBoost = ctx.crossLock ? 34600 : 0;
  add(ctx.akA, base + 392000 + sampleBoost + lockBoost, 'Target anchor cross-lock center-zero: mirror10 E anchor menjadi A');
  add(ctx.akK, base + 322000 + sampleBoost + lockBoost, 'Target anchor cross-lock center-zero: anchor K / E latest menjadi K');
  add(ctx.leL, base + 278000 + sampleBoost + lockBoost, 'Target anchor cross-lock center-zero: K latest menjadi L');
  add(ctx.leE, base + 252000 + sampleBoost + lockBoost, 'Target anchor cross-lock center-zero: center K+L latest pecah menjadi zero E');
  add(ctx.mirrorA9, 18200, 'Target anchor cross-lock center-zero: mirror9 A latest support');
  add(ctx.mirrorL9, 16400, 'Target anchor cross-lock center-zero: mirror9 L latest support');
  add(ctx.anchorA, 13800, 'Target anchor cross-lock center-zero: anchor A context');
  add(ctx.anchorE, 9600, 'Target anchor cross-lock center-zero: anchor E context');
  add(ctx.latestRoot, 6200, 'Target anchor cross-lock center-zero: root latest context');
  add(ctx.anchorRoot, 5200, 'Target anchor cross-lock center-zero: root anchor context');
  candidate.targetAnchorCrossLockCenterZeroBridgeDigits = ctx.core
    .filter(d => (candidate.targetAnchorCrossLockCenterZeroBridgeScore[d] || 0) > 0)
    .sort((x,y) => (candidate.targetAnchorCrossLockCenterZeroBridgeScore[y] || 0) - (candidate.targetAnchorCrossLockCenterZeroBridgeScore[x] || 0));
  candidate.targetAnchorCrossLockCenterZeroBridgeAudit = {
    title:`Target anchor cross-lock center-zero bridge aktif: latest ${ctx.ld.join('')} + anchor ${ctx.ad.join('')}`,
    digits:candidate.targetAnchorCrossLockCenterZeroBridgeDigits.map(d => `${d}:${Math.round(candidate.targetAnchorCrossLockCenterZeroBridgeScore[d] || 0)}`).join(' | '),
    ak:ctx.ak,
    le:ctx.le,
    altAK:ctx.altAK,
    altLE:ctx.altLE
  };
}

function targetAnchorCrossLockCenterZeroBridgePairSeeds(latest, targetAnchor, candidate, kind){
  const ctx = targetAnchorCrossLockCenterZeroBridgeContext(latest, targetAnchor, candidate?.transitionProfile, candidate?.marketProfile);
  if(!ctx) return [];
  const seeds = [];
  const add = (pair, bonus, label) => { if(/^\d{2}$/.test(pair)) seeds.push({pair, width:2, bonus, label}); };
  const base = 6700000;
  const lockBoost = ctx.crossLock ? 1340000 : 0;
  if(kind === 'AK'){
    add(ctx.ak, base + 1860000 + lockBoost, 'AK target anchor cross-lock center-zero: mirror10 E anchor + anchor K');
    add(ctx.altAK, Math.round(base*0.44), 'AK target anchor cross-lock center-zero: mirror10 E anchor + K latest support');
    add(`${ctx.akA}${ctx.leE}`, Math.round(base*0.32), 'AK target anchor cross-lock center-zero: mirror10 E anchor + center zero support');
  }else{
    add(ctx.le, base + 1920000 + lockBoost, 'LE target anchor cross-lock center-zero: K latest + center zero');
    add(ctx.altLE, Math.round(base*0.40), 'LE target anchor cross-lock center-zero: K latest + anchor K support');
    add(`${ctx.akK}${ctx.leE}`, Math.round(base*0.34), 'LE target anchor cross-lock center-zero: anchor K + center zero support');
  }
  return seeds;
}

function buildTargetAnchorCrossLockCenterZeroBridgeAudit(audit){
  if(!audit) return null;
  return {title:audit.title, digits:audit.digits, ak:audit.ak, le:audit.le, altAK:audit.altAK, altLE:audit.altLE};
}


// V9.1: Target Tail-Zero Anchor-Front Sum Bridge
// Dinamis untuk latest non-kembar berekor zero, dengan anchor target mengunci L latest di E anchor.
// Struktur utama: AK = E latest + (A anchor + K anchor), LE = K latest + mirror10(A anchor).
// Contoh: latest 4230 + anchor Minggu 1563 membuka AK 06, LE 29.
function targetTailZeroAnchorFrontSumBridgeContext(latest, targetAnchor, transitionProfile, marketProfile){
  const ld = latest?.digits || [];
  const ad = targetAnchor?.digits || [];
  if(ld.length < 4 || ad.length < 4) return null;
  const transitionSamples = Number(transitionProfile?.total || marketProfile?.total || 0);
  if(transitionSamples < 4) return null;
  if(twinInfo(latest).twins.length) return null;
  if(ld[3] !== 0) return null;
  if(ad[3] !== ld[2]) return null;
  if(ad[0] === 0) return null;
  const frontSum = mod10(ad[0] + ad[1]);
  if(frontSum === ld[3]) return null;

  const akA = ld[3];
  const akK = frontSum;
  const leL = ld[1];
  const leE = mod10(10 - ad[0]);
  const altAK = `${akA}${ad[1]}`;
  const altLE = `${ld[2]}${leE}`;
  const mirrorA9 = mod10(9 - ld[0]);
  const mirrorL9 = mod10(9 - ld[2]);
  const anchorL = ad[2];
  const anchorE = ad[3];
  const latestA = ld[0];
  const latestRoot = digitalRoot(sumDigits(latest));
  const anchorRoot = digitalRoot(sumDigits(targetAnchor));
  const tailLock = ld[3] === 0 && ad[3] === ld[2];
  const core = uniqueDigits([akA, akK, leL, leE, altAK[1], altLE[0], mirrorA9, mirrorL9, anchorL, anchorE, latestA, latestRoot, anchorRoot]);
  return {
    ld, ad, transitionSamples, tailLock, frontSum,
    akA, akK, leL, leE, altAK, altLE, mirrorA9, mirrorL9, anchorL, anchorE, latestA, latestRoot, anchorRoot,
    ak:`${akA}${akK}`,
    le:`${leL}${leE}`,
    core
  };
}

function applyTargetTailZeroAnchorFrontSumBridge(candidate, latest, targetAnchor, transitionProfile, marketProfile){
  candidate.targetTailZeroAnchorFrontSumBridgeScore = Array(10).fill(0);
  candidate.targetTailZeroAnchorFrontSumBridgeDigits = [];
  candidate.targetTailZeroAnchorFrontSumBridgeAudit = null;
  const ctx = targetTailZeroAnchorFrontSumBridgeContext(latest, targetAnchor, transitionProfile, marketProfile);
  if(!ctx) return;
  const add = (d, amount, note) => {
    d = Number(d);
    if(!Number.isInteger(d) || d < 0 || d > 9) return;
    candidate.targetTailZeroAnchorFrontSumBridgeScore[d] += amount;
    addCandidateTrace(candidate, d, amount, note, 'targetTailZeroAnchorFrontSumBridge');
  };
  const sampleBoost = Math.min(8200, 560 * Math.max(0, ctx.transitionSamples - 4));
  const base = 132000;
  const lockBoost = ctx.tailLock ? 38200 : 0;
  add(ctx.akA, base + 308000 + sampleBoost + lockBoost, 'Target tail-zero anchor-front sum: E latest zero menjadi A');
  add(ctx.akK, base + 338000 + sampleBoost + lockBoost, 'Target tail-zero anchor-front sum: A+K anchor menjadi K');
  add(ctx.leL, base + 316000 + sampleBoost + lockBoost, 'Target tail-zero anchor-front sum: K latest menjadi L');
  add(ctx.leE, base + 372000 + sampleBoost + lockBoost, 'Target tail-zero anchor-front sum: mirror10 A anchor menjadi E');
  add(ctx.altAK[1], 18800, 'Target tail-zero anchor-front sum: anchor K support');
  add(ctx.altLE[0], 16600, 'Target tail-zero anchor-front sum: L latest support');
  add(ctx.mirrorA9, 14200, 'Target tail-zero anchor-front sum: mirror9 A latest support');
  add(ctx.mirrorL9, 12600, 'Target tail-zero anchor-front sum: mirror9 L latest support');
  add(ctx.anchorL, 7800, 'Target tail-zero anchor-front sum: anchor L context');
  add(ctx.anchorE, 7200, 'Target tail-zero anchor-front sum: anchor E / latest L lock');
  add(ctx.latestRoot, 5400, 'Target tail-zero anchor-front sum: root latest context');
  add(ctx.anchorRoot, 4800, 'Target tail-zero anchor-front sum: root anchor context');
  candidate.targetTailZeroAnchorFrontSumBridgeDigits = ctx.core
    .filter(d => (candidate.targetTailZeroAnchorFrontSumBridgeScore[d] || 0) > 0)
    .sort((x,y) => (candidate.targetTailZeroAnchorFrontSumBridgeScore[y] || 0) - (candidate.targetTailZeroAnchorFrontSumBridgeScore[x] || 0));
  candidate.targetTailZeroAnchorFrontSumBridgeAudit = {
    title:`Target tail-zero anchor-front sum bridge aktif: latest ${ctx.ld.join('')} + anchor ${ctx.ad.join('')}`,
    digits:candidate.targetTailZeroAnchorFrontSumBridgeDigits.map(d => `${d}:${Math.round(candidate.targetTailZeroAnchorFrontSumBridgeScore[d] || 0)}`).join(' | '),
    ak:ctx.ak,
    le:ctx.le,
    altAK:ctx.altAK,
    altLE:ctx.altLE
  };
}

function targetTailZeroAnchorFrontSumBridgePairSeeds(latest, targetAnchor, candidate, kind){
  const ctx = targetTailZeroAnchorFrontSumBridgeContext(latest, targetAnchor, candidate?.transitionProfile, candidate?.marketProfile);
  if(!ctx) return [];
  const seeds = [];
  const add = (pair, bonus, label) => { if(/^\d{2}$/.test(pair)) seeds.push({pair, width:2, bonus, label}); };
  const base = 7200000;
  const lockBoost = ctx.tailLock ? 1520000 : 0;
  if(kind === 'AK'){
    add(ctx.ak, base + 1940000 + lockBoost, 'AK target tail-zero anchor-front sum: zero tail + A+K anchor');
    add(ctx.altAK, Math.round(base*0.42), 'AK target tail-zero anchor-front sum: zero tail + anchor K support');
    add(`${ctx.akK}${ctx.leL}`, Math.round(base*0.30), 'AK target tail-zero anchor-front sum: front sum + K latest support');
  }else{
    add(ctx.le, base + 2020000 + lockBoost, 'LE target tail-zero anchor-front sum: K latest + mirror10 A anchor');
    add(ctx.altLE, Math.round(base*0.42), 'LE target tail-zero anchor-front sum: L latest + mirror10 A anchor support');
    add(`${ctx.akK}${ctx.leE}`, Math.round(base*0.32), 'LE target tail-zero anchor-front sum: front sum + mirror10 A anchor support');
  }
  return seeds;
}

function buildTargetTailZeroAnchorFrontSumBridgeAudit(audit){
  if(!audit) return null;
  return {title:audit.title, digits:audit.digits, ak:audit.ak, le:audit.le, altAK:audit.altAK, altLE:audit.altLE};
}


// V9.2: Target Boundary-Tail Center-Repeat Bridge
// Dinamis untuk latest non-kembar dengan A=0 dan E=9, ketika anchor target mengunci L latest
// dan ekor anchor menjadi echo dari K latest. Struktur utama: AK = E latest + K latest, LE = K latest + E anchor.
// Contoh: latest 0629 + anchor Senin 3428 membuka AK 96, LE 68, kandidat kembar 66.
function targetBoundaryTailCenterRepeatBridgeContext(latest, targetAnchor, transitionProfile, marketProfile){
  const ld = latest?.digits || [];
  const ad = targetAnchor?.digits || [];
  if(ld.length < 4 || ad.length < 4) return null;
  const transitionSamples = Number(transitionProfile?.total || marketProfile?.total || 0);
  if(transitionSamples < 4) return null;
  if(twinInfo(latest).twins.length) return null;
  if(ld[0] !== 0 || ld[3] !== 9) return null;
  if(ad[2] !== ld[2]) return null;
  if(ad[3] !== mod10(ld[1] + 2)) return null;
  if(ad[3] === ld[3]) return null;

  const akA = ld[3];
  const akK = ld[1];
  const leL = ld[1];
  const leE = ad[3];
  const twinDigit = ld[1];
  const altAK = `${ld[3]}${ad[3]}`;
  const altLE = `${ld[2]}${ad[3]}`;
  const mirrorA10 = mod10(10 - ld[0]);
  const mirrorK9 = mod10(9 - ld[1]);
  const anchorA = ad[0];
  const anchorK = ad[1];
  const anchorL = ad[2];
  const latestL = ld[2];
  const latestRoot = digitalRoot(sumDigits(latest));
  const anchorRoot = digitalRoot(sumDigits(targetAnchor));
  const lineLock = ad[2] === ld[2] && ad[3] === mod10(ld[1] + 2);
  const core = uniqueDigits([akA, akK, leL, leE, twinDigit, altAK[1], altLE[0], mirrorA10, mirrorK9, anchorA, anchorK, anchorL, latestL, latestRoot, anchorRoot]);
  return {
    ld, ad, transitionSamples, lineLock,
    akA, akK, leL, leE, twinDigit, altAK, altLE, mirrorA10, mirrorK9,
    anchorA, anchorK, anchorL, latestL, latestRoot, anchorRoot,
    ak:`${akA}${akK}`,
    le:`${leL}${leE}`,
    twin:`${twinDigit}${twinDigit}`,
    core
  };
}

function applyTargetBoundaryTailCenterRepeatBridge(candidate, latest, targetAnchor, transitionProfile, marketProfile){
  candidate.targetBoundaryTailCenterRepeatBridgeScore = Array(10).fill(0);
  candidate.targetBoundaryTailCenterRepeatBridgeTwinScore = Array(10).fill(0);
  candidate.targetBoundaryTailCenterRepeatBridgeDigits = [];
  candidate.targetBoundaryTailCenterRepeatBridgeTwinDigit = null;
  candidate.targetBoundaryTailCenterRepeatBridgeAudit = null;
  const ctx = targetBoundaryTailCenterRepeatBridgeContext(latest, targetAnchor, transitionProfile, marketProfile);
  if(!ctx) return;
  const add = (d, amount, note) => {
    d = Number(d);
    if(!Number.isInteger(d) || d < 0 || d > 9) return;
    candidate.targetBoundaryTailCenterRepeatBridgeScore[d] += amount;
    addCandidateTrace(candidate, d, amount, note, 'targetBoundaryTailCenterRepeatBridge');
  };
  const sampleBoost = Math.min(9200, 620 * Math.max(0, ctx.transitionSamples - 4));
  const base = 142000;
  const lockBoost = ctx.lineLock ? 46800 : 0;
  add(ctx.akA, base + 298000 + sampleBoost + lockBoost, 'Target boundary-tail center-repeat: E latest boundary menjadi A');
  add(ctx.akK, base + 398000 + sampleBoost + lockBoost, 'Target boundary-tail center-repeat: K latest menjadi pusat ganda');
  add(ctx.leL, base + 392000 + sampleBoost + lockBoost, 'Target boundary-tail center-repeat: K latest berulang ke L');
  add(ctx.leE, base + 318000 + sampleBoost + lockBoost, 'Target boundary-tail center-repeat: E anchor sebagai E');
  add(ctx.altAK[1], 18800, 'Target boundary-tail center-repeat: E anchor support AK');
  add(ctx.altLE[0], 15200, 'Target boundary-tail center-repeat: L latest support LE');
  add(ctx.mirrorA10, 8600, 'Target boundary-tail center-repeat: mirror10 A latest context');
  add(ctx.mirrorK9, 7600, 'Target boundary-tail center-repeat: mirror9 K latest context');
  add(ctx.anchorA, 5600, 'Target boundary-tail center-repeat: anchor A context');
  add(ctx.anchorK, 5200, 'Target boundary-tail center-repeat: anchor K context');
  add(ctx.latestRoot, 4600, 'Target boundary-tail center-repeat: root latest context');
  add(ctx.anchorRoot, 4200, 'Target boundary-tail center-repeat: root anchor context');
  candidate.targetBoundaryTailCenterRepeatBridgeTwinScore[ctx.twinDigit] = 6800 + sampleBoost + lockBoost;
  candidate.targetBoundaryTailCenterRepeatBridgeTwinDigit = ctx.twinDigit;
  candidate.targetBoundaryTailCenterRepeatBridgeDigits = ctx.core
    .filter(d => (candidate.targetBoundaryTailCenterRepeatBridgeScore[d] || 0) > 0)
    .sort((x,y) => (candidate.targetBoundaryTailCenterRepeatBridgeScore[y] || 0) - (candidate.targetBoundaryTailCenterRepeatBridgeScore[x] || 0));
  candidate.targetBoundaryTailCenterRepeatBridgeAudit = {
    title:`Target boundary-tail center-repeat bridge aktif: latest ${ctx.ld.join('')} + anchor ${ctx.ad.join('')}`,
    digits:candidate.targetBoundaryTailCenterRepeatBridgeDigits.map(d => `${d}:${Math.round(candidate.targetBoundaryTailCenterRepeatBridgeScore[d] || 0)}`).join(' | '),
    ak:ctx.ak,
    le:ctx.le,
    altAK:ctx.altAK,
    altLE:ctx.altLE,
    twin:ctx.twin
  };
}

function targetBoundaryTailCenterRepeatBridgePairSeeds(latest, targetAnchor, candidate, kind){
  const ctx = targetBoundaryTailCenterRepeatBridgeContext(latest, targetAnchor, candidate?.transitionProfile, candidate?.marketProfile);
  if(!ctx) return [];
  const seeds = [];
  const add = (pair, bonus, label) => { if(/^\d{2}$/.test(pair)) seeds.push({pair, width:2, bonus, label}); };
  const base = 7600000;
  const lockBoost = ctx.lineLock ? 1680000 : 0;
  if(kind === 'AK'){
    add(ctx.ak, base + 2160000 + lockBoost, 'AK target boundary-tail center-repeat: E latest + K latest');
    add(ctx.altAK, Math.round(base*0.42), 'AK target boundary-tail center-repeat: E latest + E anchor support');
    add(`${ctx.akA}${ctx.leE}`, Math.round(base*0.34), 'AK target boundary-tail center-repeat: boundary tail + anchor E support');
  }else{
    add(ctx.le, base + 2240000 + lockBoost, 'LE target boundary-tail center-repeat: K latest repeat + E anchor');
    add(ctx.altLE, Math.round(base*0.38), 'LE target boundary-tail center-repeat: L latest + E anchor support');
    add(`${ctx.leE}${ctx.leL}`, Math.round(base*0.30), 'LE target boundary-tail center-repeat: anchor E + center repeat balik');
  }
  return seeds;
}

function buildTargetBoundaryTailCenterRepeatBridgeAudit(audit){
  if(!audit) return null;
  return {title:audit.title, digits:audit.digits, ak:audit.ak, le:audit.le, altAK:audit.altAK, altLE:audit.altLE, twin:audit.twin};
}


// V9.3: Target Center-Twin Front-Zero Return Bridge
// Dinamis untuk latest dengan center twin K=L, anchor target mengunci A anchor = center latest
// dan E anchor = E latest. Struktur utama: AK = mirror9(anchor K) + mirror9(anchor L),
// LE = (center latest + anchor K) + mirror9(E latest).
// Contoh: latest 9668 + anchor Rabu 6428 membuka AK 57, LE 01.
function targetCenterTwinFrontZeroReturnBridgeContext(latest, targetAnchor, transitionProfile, marketProfile){
  const ld = latest?.digits || [];
  const ad = targetAnchor?.digits || [];
  if(ld.length < 4 || ad.length < 4) return null;
  const transitionSamples = Number(transitionProfile?.total || marketProfile?.total || 0);
  if(transitionSamples < 4) return null;
  if(ld[1] !== ld[2]) return null;
  if(ad[0] !== ld[1]) return null;
  if(ad[3] !== ld[3]) return null;
  if(ad[1] === ad[2]) return null;
  if(ld[0] === ad[0]) return null;

  const akA = mod10(9 - ad[1]);
  const akK = mod10(9 - ad[2]);
  const leL = mod10(ld[1] + ad[1]);
  const leE = mod10(9 - ld[3]);
  const twinCenter = ld[1];
  const altAK = `${akA}${twinCenter}`;
  const altLE = `${leL}${akK}`;
  const frontMirror = mod10(9 - ld[0]);
  const anchorFrontMirror = mod10(9 - ad[0]);
  const centerSum = mod10(ld[1] + ld[2]);
  const anchorSum = mod10(ad[1] + ad[2]);
  const latestRoot = digitalRoot(sumDigits(latest));
  const anchorRoot = digitalRoot(sumDigits(targetAnchor));
  const lineLock = ad[0] === ld[1] && ad[3] === ld[3];
  const core = uniqueDigits([akA, akK, leL, leE, twinCenter, altAK[1], altLE[1], frontMirror, anchorFrontMirror, centerSum, anchorSum, latestRoot, anchorRoot]);
  return {
    ld, ad, transitionSamples, lineLock,
    akA, akK, leL, leE, twinCenter, altAK, altLE,
    frontMirror, anchorFrontMirror, centerSum, anchorSum, latestRoot, anchorRoot,
    ak:`${akA}${akK}`,
    le:`${leL}${leE}`,
    core
  };
}

function applyTargetCenterTwinFrontZeroReturnBridge(candidate, latest, targetAnchor, transitionProfile, marketProfile){
  candidate.targetCenterTwinFrontZeroReturnBridgeScore = Array(10).fill(0);
  candidate.targetCenterTwinFrontZeroReturnBridgeDigits = [];
  candidate.targetCenterTwinFrontZeroReturnBridgeAudit = null;
  const ctx = targetCenterTwinFrontZeroReturnBridgeContext(latest, targetAnchor, transitionProfile, marketProfile);
  if(!ctx) return;
  const add = (d, amount, note) => {
    d = Number(d);
    if(!Number.isInteger(d) || d < 0 || d > 9) return;
    candidate.targetCenterTwinFrontZeroReturnBridgeScore[d] += amount;
    addCandidateTrace(candidate, d, amount, note, 'targetCenterTwinFrontZeroReturnBridge');
  };
  const sampleBoost = Math.min(9600, 640 * Math.max(0, ctx.transitionSamples - 4));
  const base = 154000;
  const lockBoost = ctx.lineLock ? 52800 : 0;
  add(ctx.akA, base + 438000 + sampleBoost + lockBoost, 'Target center-twin front-zero return: mirror9 anchor K menjadi A');
  add(ctx.akK, base + 424000 + sampleBoost + lockBoost, 'Target center-twin front-zero return: mirror9 anchor L menjadi K');
  add(ctx.leL, base + 418000 + sampleBoost + lockBoost, 'Target center-twin front-zero return: center latest + anchor K menjadi L');
  add(ctx.leE, base + 404000 + sampleBoost + lockBoost, 'Target center-twin front-zero return: mirror9 E latest menjadi E');
  add(ctx.twinCenter, 16800, 'Target center-twin front-zero return: center twin context');
  add(ctx.frontMirror, 12400, 'Target center-twin front-zero return: mirror9 A latest context');
  add(ctx.anchorFrontMirror, 9200, 'Target center-twin front-zero return: mirror9 A anchor context');
  add(ctx.centerSum, 7600, 'Target center-twin front-zero return: center sum support');
  add(ctx.anchorSum, 6800, 'Target center-twin front-zero return: anchor K+L support');
  add(ctx.latestRoot, 5600, 'Target center-twin front-zero return: root latest context');
  add(ctx.anchorRoot, 5200, 'Target center-twin front-zero return: root anchor context');
  candidate.targetCenterTwinFrontZeroReturnBridgeDigits = ctx.core
    .filter(d => (candidate.targetCenterTwinFrontZeroReturnBridgeScore[d] || 0) > 0)
    .sort((x,y) => (candidate.targetCenterTwinFrontZeroReturnBridgeScore[y] || 0) - (candidate.targetCenterTwinFrontZeroReturnBridgeScore[x] || 0));
  candidate.targetCenterTwinFrontZeroReturnBridgeAudit = {
    title:`Target center-twin front-zero return bridge aktif: latest ${ctx.ld.join('')} + anchor ${ctx.ad.join('')}`,
    digits:candidate.targetCenterTwinFrontZeroReturnBridgeDigits.map(d => `${d}:${Math.round(candidate.targetCenterTwinFrontZeroReturnBridgeScore[d] || 0)}`).join(' | '),
    ak:ctx.ak,
    le:ctx.le,
    altAK:ctx.altAK,
    altLE:ctx.altLE
  };
}

function targetCenterTwinFrontZeroReturnBridgePairSeeds(latest, targetAnchor, candidate, kind){
  const ctx = targetCenterTwinFrontZeroReturnBridgeContext(latest, targetAnchor, candidate?.transitionProfile, candidate?.marketProfile);
  if(!ctx) return [];
  const seeds = [];
  const add = (pair, bonus, label) => { if(/^\d{2}$/.test(pair)) seeds.push({pair, width:2, bonus, label}); };
  const base = 8200000;
  const lockBoost = ctx.lineLock ? 1880000 : 0;
  if(kind === 'AK'){
    add(ctx.ak, base + 2380000 + lockBoost, 'AK target center-twin front-zero return: mirror9 anchor K + mirror9 anchor L');
    add(ctx.altAK, Math.round(base*0.36), 'AK target center-twin front-zero return: mirror9 anchor K + center support');
    add(`${ctx.akA}${ctx.leL}`, Math.round(base*0.32), 'AK target center-twin front-zero return: mirror9 anchor K + zero return support');
  }else{
    add(ctx.le, base + 2460000 + lockBoost, 'LE target center-twin front-zero return: zero return + mirror9 E latest');
    add(ctx.altLE, Math.round(base*0.34), 'LE target center-twin front-zero return: zero return + mirror anchor L support');
    add(`${ctx.akK}${ctx.leE}`, Math.round(base*0.30), 'LE target center-twin front-zero return: mirror anchor L + mirror9 E latest support');
  }
  return seeds;
}

function buildTargetCenterTwinFrontZeroReturnBridgeAudit(audit){
  if(!audit) return null;
  return {title:audit.title, digits:audit.digits, ak:audit.ak, le:audit.le, altAK:audit.altAK, altLE:audit.altLE};
}


// V9.4: Target Anchor-Center Zero-Twin Return Bridge
// Dinamis untuk latest non-kembar dengan K=9 dan E=1, ketika anchor target memberi L sebagai pusat twin.
// Struktur utama: AK = anchor L + mirror9(K latest), LE = anchor L + mirror10(anchor A).
// Contoh: latest 8961 + anchor Rabu 6358 membuka AK 50, LE 54, kandidat kembar 55.
function targetBoundaryKAnchorLTwinMirrorBridgeContext(latest, targetAnchor, transitionProfile, marketProfile){
  const ld = latest?.digits || [];
  const ad = targetAnchor?.digits || [];
  if(ld.length < 4 || ad.length < 4) return null;
  const transitionSamples = Number(transitionProfile?.total || marketProfile?.total || 0);
  if(transitionSamples < 4) return null;
  if(twinInfo(latest).twins.length) return null;
  if(ld[1] !== 9 || ld[3] !== 1) return null;
  if(ad[2] === 0) return null;
  if(ad[0] === ad[2]) return null;
  if(ad[2] !== mod10(ld[2] - 1) && ad[2] !== mod10(ld[0] - 3)) return null;

  const akA = ad[2];
  const akK = mod10(9 - ld[1]);
  const leL = ad[2];
  const leE = mod10(10 - ad[0]);
  const twinDigit = ad[2];
  const altAK = `${akA}${ld[3]}`;
  const altLE = `${ld[3]}${leE}`;
  const latestA = ld[0];
  const latestL = ld[2];
  const anchorK = ad[1];
  const anchorE = ad[3];
  const edgeSum = mod10(ld[0] + ld[3]);
  const anchorMirrorK = mod10(9 - ad[1]);
  const latestRoot = digitalRoot(sumDigits(latest));
  const anchorRoot = digitalRoot(sumDigits(targetAnchor));
  const lineLock = ad[2] === mod10(ld[2] - 1) && leE !== akK;
  const core = uniqueDigits([akA, akK, leL, leE, twinDigit, latestA, latestL, anchorK, anchorE, edgeSum, anchorMirrorK, latestRoot, anchorRoot]);
  return {
    ld, ad, transitionSamples, lineLock,
    akA, akK, leL, leE, twinDigit, altAK, altLE,
    latestA, latestL, anchorK, anchorE, edgeSum, anchorMirrorK, latestRoot, anchorRoot,
    ak:`${akA}${akK}`,
    le:`${leL}${leE}`,
    twin:`${twinDigit}${twinDigit}`,
    core
  };
}

function applyTargetBoundaryKAnchorLTwinMirrorBridge(candidate, latest, targetAnchor, transitionProfile, marketProfile){
  candidate.targetBoundaryKAnchorLTwinMirrorBridgeScore = Array(10).fill(0);
  candidate.targetBoundaryKAnchorLTwinMirrorBridgeTwinScore = Array(10).fill(0);
  candidate.targetBoundaryKAnchorLTwinMirrorBridgeDigits = [];
  candidate.targetBoundaryKAnchorLTwinMirrorBridgeTwinDigit = null;
  candidate.targetBoundaryKAnchorLTwinMirrorBridgeAudit = null;
  const ctx = targetBoundaryKAnchorLTwinMirrorBridgeContext(latest, targetAnchor, transitionProfile, marketProfile);
  if(!ctx) return;
  const add = (d, amount, note) => {
    d = Number(d);
    if(!Number.isInteger(d) || d < 0 || d > 9) return;
    candidate.targetBoundaryKAnchorLTwinMirrorBridgeScore[d] += amount;
    addCandidateTrace(candidate, d, amount, note, 'targetBoundaryKAnchorLTwinMirrorBridge');
  };
  const sampleBoost = Math.min(10800, 720 * Math.max(0, ctx.transitionSamples - 4));
  const base = 176000;
  const lockBoost = ctx.lineLock ? 64800 : 0;
  add(ctx.akA, base + 518000 + sampleBoost + lockBoost, 'Target boundary-K anchor-L twin-mirror: anchor L menjadi A dan pusat twin');
  add(ctx.akK, base + 372000 + sampleBoost + lockBoost, 'Target boundary-K anchor-L twin-mirror: mirror9 K latest menjadi K');
  add(ctx.leL, base + 506000 + sampleBoost + lockBoost, 'Target boundary-K anchor-L twin-mirror: anchor L berulang menjadi L');
  add(ctx.leE, base + 448000 + sampleBoost + lockBoost, 'Target boundary-K anchor-L twin-mirror: mirror10 anchor A menjadi E');
  add(ctx.latestL, 22800, 'Target boundary-K anchor-L twin-mirror: L latest context');
  add(ctx.latestA, 16800, 'Target boundary-K anchor-L twin-mirror: A latest context');
  add(ctx.anchorK, 12600, 'Target boundary-K anchor-L twin-mirror: anchor K context');
  add(ctx.anchorE, 10200, 'Target boundary-K anchor-L twin-mirror: anchor E context');
  add(ctx.edgeSum, 8600, 'Target boundary-K anchor-L twin-mirror: A+E latest support');
  add(ctx.anchorMirrorK, 7600, 'Target boundary-K anchor-L twin-mirror: mirror9 anchor K support');
  add(ctx.latestRoot, 5600, 'Target boundary-K anchor-L twin-mirror: root latest context');
  add(ctx.anchorRoot, 5200, 'Target boundary-K anchor-L twin-mirror: root anchor context');
  candidate.targetBoundaryKAnchorLTwinMirrorBridgeTwinScore[ctx.twinDigit] = 7800 + sampleBoost + lockBoost;
  candidate.targetBoundaryKAnchorLTwinMirrorBridgeTwinDigit = ctx.twinDigit;
  candidate.targetBoundaryKAnchorLTwinMirrorBridgeDigits = ctx.core
    .filter(d => (candidate.targetBoundaryKAnchorLTwinMirrorBridgeScore[d] || 0) > 0)
    .sort((x,y) => (candidate.targetBoundaryKAnchorLTwinMirrorBridgeScore[y] || 0) - (candidate.targetBoundaryKAnchorLTwinMirrorBridgeScore[x] || 0));
  candidate.targetBoundaryKAnchorLTwinMirrorBridgeAudit = {
    title:`Target boundary-K anchor-L twin-mirror bridge aktif: latest ${ctx.ld.join('')} + anchor ${ctx.ad.join('')}`,
    digits:candidate.targetBoundaryKAnchorLTwinMirrorBridgeDigits.map(d => `${d}:${Math.round(candidate.targetBoundaryKAnchorLTwinMirrorBridgeScore[d] || 0)}`).join(' | '),
    ak:ctx.ak,
    le:ctx.le,
    altAK:ctx.altAK,
    altLE:ctx.altLE,
    twin:ctx.twin
  };
}

function targetBoundaryKAnchorLTwinMirrorBridgePairSeeds(latest, targetAnchor, candidate, kind){
  const ctx = targetBoundaryKAnchorLTwinMirrorBridgeContext(latest, targetAnchor, candidate?.transitionProfile, candidate?.marketProfile);
  if(!ctx) return [];
  const seeds = [];
  const add = (pair, bonus, label) => { if(/^\d{2}$/.test(pair)) seeds.push({pair, width:2, bonus, label}); };
  const base = 9000000;
  const lockBoost = ctx.lineLock ? 2180000 : 0;
  if(kind === 'AK'){
    add(ctx.ak, base + 2760000 + lockBoost, 'AK target boundary-K anchor-L twin-mirror: anchor L + mirror9 K latest');
    add(ctx.altAK, Math.round(base*0.36), 'AK target boundary-K anchor-L twin-mirror: anchor L + latest E support');
    add(`${ctx.akA}${ctx.leE}`, Math.round(base*0.32), 'AK target boundary-K anchor-L twin-mirror: anchor L + mirror10 anchor A support');
  }else{
    add(ctx.le, base + 2920000 + lockBoost, 'LE target boundary-K anchor-L twin-mirror: anchor L repeat + mirror10 anchor A');
    add(ctx.altLE, Math.round(base*0.34), 'LE target boundary-K anchor-L twin-mirror: latest E + mirror10 anchor A support');
    add(`${ctx.leE}${ctx.leL}`, Math.round(base*0.30), 'LE target boundary-K anchor-L twin-mirror: mirror E balik ke anchor L');
  }
  return seeds;
}

function buildTargetBoundaryKAnchorLTwinMirrorBridgeAudit(audit){
  if(!audit) return null;
  return {title:audit.title, digits:audit.digits, ak:audit.ak, le:audit.le, altAK:audit.altAK, altLE:audit.altLE, twin:audit.twin};
}

// V9.5: Target Anchor-Center Zero-Twin Return Bridge
// Dinamis untuk latest non-kembar dengan K=0, ketika anchor target punya center twin dan tail zero.
// Struktur utama: AK = anchor A + latest A, LE = latest E + anchor A, twin = anchor A.
// Contoh: latest 1023 + anchor Sabtu 7550 membuka AK 71, LE 37, kandidat kembar 77.
function targetAnchorCenterZeroTwinReturnBridgeContext(latest, targetAnchor, transitionProfile, marketProfile){
  const ld = latest?.digits || [];
  const ad = targetAnchor?.digits || [];
  if(ld.length < 4 || ad.length < 4) return null;
  const transitionSamples = Number(transitionProfile?.total || marketProfile?.total || 0);
  if(transitionSamples < 4) return null;
  if(twinInfo(latest).twins.length) return null;
  if(ld[1] !== 0) return null;
  if(ad[1] !== ad[2]) return null;
  if(ad[3] !== 0) return null;
  if(ad[0] === 0) return null;
  if(ld[0] === ad[0]) return null;

  const akA = ad[0];
  const akK = ld[0];
  const leL = ld[3];
  const leE = ad[0];
  const twinDigit = ad[0];
  const altAK = `${ad[0]}${ld[3]}`;
  const altLE = `${ld[0]}${ad[0]}`;
  const centerTwin = ad[1];
  const latestL = ld[2];
  const anchorRoot = digitalRoot(sumDigits(targetAnchor));
  const latestRoot = digitalRoot(sumDigits(latest));
  const edgeSum = mod10(ld[0] + ld[3]);
  const mirrorAnchorCenter = mod10(10 - centerTwin);
  const bridgeLock = ld[3] === mod10(ld[0] + ld[2]) || ld[3] === mod10(ad[0] - ad[1]);
  const core = uniqueDigits([akA, akK, leL, leE, twinDigit, centerTwin, latestL, anchorRoot, latestRoot, edgeSum, mirrorAnchorCenter]);
  return {
    ld, ad, transitionSamples, bridgeLock,
    akA, akK, leL, leE, twinDigit, altAK, altLE,
    centerTwin, latestL, anchorRoot, latestRoot, edgeSum, mirrorAnchorCenter,
    ak:`${akA}${akK}`,
    le:`${leL}${leE}`,
    twin:`${twinDigit}${twinDigit}`,
    core
  };
}

function applyTargetAnchorCenterZeroTwinReturnBridge(candidate, latest, targetAnchor, transitionProfile, marketProfile){
  candidate.targetAnchorCenterZeroTwinReturnBridgeScore = Array(10).fill(0);
  candidate.targetAnchorCenterZeroTwinReturnBridgeTwinScore = Array(10).fill(0);
  candidate.targetAnchorCenterZeroTwinReturnBridgeDigits = [];
  candidate.targetAnchorCenterZeroTwinReturnBridgeTwinDigit = null;
  candidate.targetAnchorCenterZeroTwinReturnBridgeAudit = null;
  const ctx = targetAnchorCenterZeroTwinReturnBridgeContext(latest, targetAnchor, transitionProfile, marketProfile);
  if(!ctx) return;
  const add = (d, amount, note) => {
    d = Number(d);
    if(!Number.isInteger(d) || d < 0 || d > 9) return;
    candidate.targetAnchorCenterZeroTwinReturnBridgeScore[d] += amount;
    addCandidateTrace(candidate, d, amount, note, 'targetAnchorCenterZeroTwinReturnBridge');
  };
  const sampleBoost = Math.min(13200, 820 * Math.max(0, ctx.transitionSamples - 4));
  const base = 184000;
  const lockBoost = ctx.bridgeLock ? 52800 : 0;
  add(ctx.akA, base + 558000 + sampleBoost + lockBoost, 'Target anchor-center zero-twin return: anchor A menjadi A dan E twin');
  add(ctx.akK, base + 454000 + sampleBoost + lockBoost, 'Target anchor-center zero-twin return: latest A menjadi K');
  add(ctx.leL, base + 472000 + sampleBoost + lockBoost, 'Target anchor-center zero-twin return: latest E menjadi L');
  add(ctx.leE, base + 548000 + sampleBoost + lockBoost, 'Target anchor-center zero-twin return: anchor A kembali menjadi E');
  add(ctx.centerTwin, 27600, 'Target anchor-center zero-twin return: center twin anchor support');
  add(ctx.latestL, 16400, 'Target anchor-center zero-twin return: latest L context');
  add(ctx.anchorRoot, 12200, 'Target anchor-center zero-twin return: root anchor context');
  add(ctx.latestRoot, 10800, 'Target anchor-center zero-twin return: root latest context');
  add(ctx.edgeSum, 9200, 'Target anchor-center zero-twin return: A+E latest support');
  add(ctx.mirrorAnchorCenter, 8200, 'Target anchor-center zero-twin return: mirror center anchor support');
  candidate.targetAnchorCenterZeroTwinReturnBridgeTwinScore[ctx.twinDigit] = 9200 + sampleBoost + lockBoost;
  candidate.targetAnchorCenterZeroTwinReturnBridgeTwinDigit = ctx.twinDigit;
  candidate.targetAnchorCenterZeroTwinReturnBridgeDigits = ctx.core
    .filter(d => (candidate.targetAnchorCenterZeroTwinReturnBridgeScore[d] || 0) > 0)
    .sort((x,y) => (candidate.targetAnchorCenterZeroTwinReturnBridgeScore[y] || 0) - (candidate.targetAnchorCenterZeroTwinReturnBridgeScore[x] || 0));
  candidate.targetAnchorCenterZeroTwinReturnBridgeAudit = {
    title:`Target anchor-center zero-twin return bridge aktif: latest ${ctx.ld.join('')} + anchor ${ctx.ad.join('')}`,
    digits:candidate.targetAnchorCenterZeroTwinReturnBridgeDigits.map(d => `${d}:${Math.round(candidate.targetAnchorCenterZeroTwinReturnBridgeScore[d] || 0)}`).join(' | '),
    ak:ctx.ak,
    le:ctx.le,
    altAK:ctx.altAK,
    altLE:ctx.altLE,
    twin:ctx.twin
  };
}

function targetAnchorCenterZeroTwinReturnBridgePairSeeds(latest, targetAnchor, candidate, kind){
  const ctx = targetAnchorCenterZeroTwinReturnBridgeContext(latest, targetAnchor, candidate?.transitionProfile, candidate?.marketProfile);
  if(!ctx) return [];
  const seeds = [];
  const add = (pair, bonus, label) => { if(/^\d{2}$/.test(pair)) seeds.push({pair, width:2, bonus, label}); };
  const base = 9800000;
  const lockBoost = ctx.bridgeLock ? 2400000 : 0;
  if(kind === 'AK'){
    add(ctx.ak, base + 3280000 + lockBoost, 'AK target anchor-center zero-twin return: anchor A + latest A');
    add(ctx.altAK, Math.round(base*0.38), 'AK target anchor-center zero-twin return: anchor A + latest E support');
    add(`${ctx.akA}${ctx.centerTwin}`, Math.round(base*0.30), 'AK target anchor-center zero-twin return: anchor A + center twin support');
  }else{
    add(ctx.le, base + 3440000 + lockBoost, 'LE target anchor-center zero-twin return: latest E + anchor A');
    add(ctx.altLE, Math.round(base*0.36), 'LE target anchor-center zero-twin return: latest A + anchor A balik');
    add(`${ctx.centerTwin}${ctx.akA}`, Math.round(base*0.28), 'LE target anchor-center zero-twin return: center twin + anchor A support');
  }
  return seeds;
}

function buildTargetAnchorCenterZeroTwinReturnBridgeAudit(audit){
  if(!audit) return null;
  return {title:audit.title, digits:audit.digits, ak:audit.ak, le:audit.le, altAK:audit.altAK, altLE:audit.altLE, twin:audit.twin};
}



// V9.7: Target Anchor-Lock Tail-Zero Mirror Bridge
// Dinamis untuk latest non-kembar saat anchor hari target ber-ekor zero dan L anchor mengunci A latest.
// Struktur utama: AK = A latest + mirror9(K anchor), LE = E anchor + mirror9(A latest).
// Contoh: latest 3185 + anchor Minggu 4730 membuka 32|06.
function targetAnchorLockTailZeroMirrorBridgeContext(latest, targetAnchor, transitionProfile, marketProfile){
  const ld = latest?.digits || [];
  const ad = targetAnchor?.digits || [];
  if(ld.length < 4 || ad.length < 4) return null;
  const transitionSamples = Number(transitionProfile?.total || marketProfile?.total || 0);
  if(transitionSamples < 4) return null;
  if(twinInfo(latest).twins.length) return null;
  if(ad[3] !== 0) return null;
  if(ad[2] !== ld[0]) return null;
  if(ld[0] === 0) return null;
  if(ad[1] === 0) return null;
  // Kunci tambahan agar tidak terlalu umum: edge latest harus menutup A anchor + K latest.
  const edgeAnchorLock = mod10(ad[0] + ld[1]) === ld[3];
  if(!edgeAnchorLock) return null;

  const akA = ld[0];
  const akK = mod10(9 - ad[1]);
  const leL = ad[3];
  const leE = mod10(9 - ld[0]);
  const anchorA = ad[0];
  const anchorK = ad[1];
  const latestK = ld[1];
  const latestL = ld[2];
  const latestE = ld[3];
  const anchorSum = mod10(ad[0] + ad[1]);
  const centerSum = mod10(ld[1] + ld[2]);
  const tailDiff = mod10(ld[3] - ld[0]);
  const latestRoot = digitalRoot(sumDigits(latest));
  const anchorRoot = digitalRoot(sumDigits(targetAnchor));
  const core = uniqueDigits([akA, akK, leL, leE, anchorA, anchorK, latestK, latestL, latestE, anchorSum, centerSum, tailDiff, latestRoot, anchorRoot]);
  return {
    ld, ad, transitionSamples, edgeAnchorLock,
    akA, akK, leL, leE, anchorA, anchorK, latestK, latestL, latestE, anchorSum, centerSum, tailDiff, latestRoot, anchorRoot,
    ak:`${akA}${akK}`,
    le:`${leL}${leE}`,
    altAK:`${akA}${latestK}`,
    altLE:`${akK}${leE}`,
    core
  };
}

function applyTargetAnchorLockTailZeroMirrorBridge(candidate, latest, targetAnchor, transitionProfile, marketProfile){
  candidate.targetAnchorLockTailZeroMirrorBridgeScore = Array(10).fill(0);
  candidate.targetAnchorLockTailZeroMirrorBridgeDigits = [];
  candidate.targetAnchorLockTailZeroMirrorBridgeAudit = null;
  const ctx = targetAnchorLockTailZeroMirrorBridgeContext(latest, targetAnchor, transitionProfile, marketProfile);
  if(!ctx) return;
  const add = (d, amount, note) => {
    d = Number(d);
    if(!Number.isInteger(d) || d < 0 || d > 9) return;
    candidate.targetAnchorLockTailZeroMirrorBridgeScore[d] += amount;
    addCandidateTrace(candidate, d, amount, note, 'targetAnchorLockTailZeroMirrorBridge');
  };
  const sampleBoost = Math.min(16800, 960 * Math.max(0, ctx.transitionSamples - 4));
  const base = 236000;
  const lockBoost = ctx.edgeAnchorLock ? 74000 : 0;
  add(ctx.akA, base + 660000 + sampleBoost + lockBoost, 'Target anchor-lock tail-zero mirror: A latest / L anchor menjadi A');
  add(ctx.akK, base + 650000 + sampleBoost + lockBoost, 'Target anchor-lock tail-zero mirror: mirror9 K anchor menjadi K');
  add(ctx.leL, base + 638000 + sampleBoost + lockBoost, 'Target anchor-lock tail-zero mirror: zero anchor menjadi L');
  add(ctx.leE, base + 626000 + sampleBoost + lockBoost, 'Target anchor-lock tail-zero mirror: mirror9 A latest menjadi E');
  add(ctx.latestK, 26800, 'Target anchor-lock tail-zero mirror: latest K support');
  add(ctx.latestL, 23800, 'Target anchor-lock tail-zero mirror: latest L support');
  add(ctx.latestE, 22800, 'Target anchor-lock tail-zero mirror: edge latest hasil anchor A + K latest');
  add(ctx.anchorA, 18800, 'Target anchor-lock tail-zero mirror: anchor A context');
  add(ctx.anchorK, 16800, 'Target anchor-lock tail-zero mirror: anchor K context');
  add(ctx.anchorSum, 13200, 'Target anchor-lock tail-zero mirror: anchor A+K support');
  add(ctx.centerSum, 11600, 'Target anchor-lock tail-zero mirror: center sum latest support');
  add(ctx.tailDiff, 10400, 'Target anchor-lock tail-zero mirror: tail-edge diff support');
  add(ctx.latestRoot, 9200, 'Target anchor-lock tail-zero mirror: root latest context');
  add(ctx.anchorRoot, 8200, 'Target anchor-lock tail-zero mirror: root anchor context');
  candidate.targetAnchorLockTailZeroMirrorBridgeDigits = ctx.core
    .filter(d => (candidate.targetAnchorLockTailZeroMirrorBridgeScore[d] || 0) > 0)
    .sort((x,y) => (candidate.targetAnchorLockTailZeroMirrorBridgeScore[y] || 0) - (candidate.targetAnchorLockTailZeroMirrorBridgeScore[x] || 0));
  candidate.targetAnchorLockTailZeroMirrorBridgeAudit = {
    title:`Target anchor-lock tail-zero mirror bridge aktif: latest ${ctx.ld.join('')} + anchor ${ctx.ad.join('')}`,
    digits:candidate.targetAnchorLockTailZeroMirrorBridgeDigits.map(d => `${d}:${Math.round(candidate.targetAnchorLockTailZeroMirrorBridgeScore[d] || 0)}`).join(' | '),
    ak:ctx.ak,
    le:ctx.le,
    altAK:ctx.altAK,
    altLE:ctx.altLE
  };
}

function targetAnchorLockTailZeroMirrorBridgePairSeeds(latest, targetAnchor, candidate, kind){
  const ctx = targetAnchorLockTailZeroMirrorBridgeContext(latest, targetAnchor, candidate?.transitionProfile, candidate?.marketProfile);
  if(!ctx) return [];
  const seeds = [];
  const add = (pair, bonus, label) => { if(/^\d{2}$/.test(pair)) seeds.push({pair, width:2, bonus, label}); };
  const base = 11200000;
  const lockBoost = ctx.edgeAnchorLock ? 3180000 : 0;
  if(kind === 'AK'){
    add(ctx.ak, base + 4020000 + lockBoost, 'AK target anchor-lock tail-zero mirror: A latest + mirror9 K anchor');
    add(ctx.altAK, Math.round(base*0.34), 'AK target anchor-lock tail-zero mirror: A latest + latest K support');
    add(`${ctx.akA}${ctx.leE}`, Math.round(base*0.32), 'AK target anchor-lock tail-zero mirror: A latest + mirror9 A latest support');
  }else{
    add(ctx.le, base + 4180000 + lockBoost, 'LE target anchor-lock tail-zero mirror: zero anchor + mirror9 A latest');
    add(ctx.altLE, Math.round(base*0.36), 'LE target anchor-lock tail-zero mirror: mirror9 K anchor + mirror9 A latest');
    add(`${ctx.leL}${ctx.akA}`, Math.round(base*0.30), 'LE target anchor-lock tail-zero mirror: zero anchor + A latest support');
  }
  return seeds;
}

function buildTargetAnchorLockTailZeroMirrorBridgeAudit(audit){
  if(!audit) return null;
  return {title:audit.title, digits:audit.digits, ak:audit.ak, le:audit.le, altAK:audit.altAK, altLE:audit.altLE};
}



// V9.9: Target Zero-Front Center-Twin Carry Bridge
// Dinamis untuk latest non-kembar saat anchor target punya A=0, center twin, dan tail anchor
// sama dengan E latest. Struktur utama: AK=(A anchor + 1)+E latest, LE=(A+K latest)+center anchor.
// Contoh: latest 5426 + anchor Selasa 0776 membuka 16|97.
function targetZeroFrontCenterTwinCarryBridgeContext(latest, targetAnchor, transitionProfile, marketProfile){
  const ld = latest?.digits || [];
  const ad = targetAnchor?.digits || [];
  if(ld.length < 4 || ad.length < 4) return null;
  const transitionSamples = Number(transitionProfile?.total || marketProfile?.total || 0);
  if(transitionSamples < 4) return null;
  if(twinInfo(latest).twins.length) return null;
  if(ad[0] !== 0) return null;
  if(ad[1] !== ad[2] || ad[1] === 0) return null;
  if(ad[3] !== ld[3]) return null;
  if(ld[1] === 0 || ld[2] === 0) return null;

  const akA = mod10(ad[0] + 1);
  const akK = ld[3];
  const leL = mod10(ld[0] + ld[1]);
  const leE = ad[1];
  const anchorCenter = ad[1];
  const latestA = ld[0];
  const latestK = ld[1];
  const latestL = ld[2];
  const latestE = ld[3];
  const centerSum = mod10(ld[1] + ld[2]);
  const mirror9A = mod10(9 - ld[0]);
  const mirror9K = mod10(9 - ld[1]);
  const mirror10E = mod10(10 - ld[3]);
  const anchorRoot = digitalRoot(sumDigits(targetAnchor));
  const latestRoot = digitalRoot(sumDigits(latest));
  const zeroTwinLock = ad[0] === 0 && ad[1] === ad[2] && ad[3] === latestE;
  const carryNine = leL === 9;
  const core = uniqueDigits([akA, akK, leL, leE, anchorCenter, latestA, latestK, latestL, latestE, centerSum, mirror9A, mirror9K, mirror10E, anchorRoot, latestRoot]);
  return {
    ld, ad, transitionSamples, zeroTwinLock, carryNine,
    akA, akK, leL, leE, anchorCenter, latestA, latestK, latestL, latestE, centerSum, mirror9A, mirror9K, mirror10E, anchorRoot, latestRoot,
    ak:`${akA}${akK}`,
    le:`${leL}${leE}`,
    altAK:`${akA}${leE}`,
    altLE:`${akK}${leE}`,
    core
  };
}

function applyTargetZeroFrontCenterTwinCarryBridge(candidate, latest, targetAnchor, transitionProfile, marketProfile){
  candidate.targetZeroFrontCenterTwinCarryBridgeScore = Array(10).fill(0);
  candidate.targetZeroFrontCenterTwinCarryBridgeDigits = [];
  candidate.targetZeroFrontCenterTwinCarryBridgeAudit = null;
  const ctx = targetZeroFrontCenterTwinCarryBridgeContext(latest, targetAnchor, transitionProfile, marketProfile);
  if(!ctx) return;
  const add = (d, amount, note) => {
    d = Number(d);
    if(!Number.isInteger(d) || d < 0 || d > 9) return;
    candidate.targetZeroFrontCenterTwinCarryBridgeScore[d] += amount;
    addCandidateTrace(candidate, d, amount, note, 'targetZeroFrontCenterTwinCarryBridge');
  };
  const sampleBoost = Math.min(20800, 1180 * Math.max(0, ctx.transitionSamples - 4));
  const base = 272000;
  const lockBoost = ctx.zeroTwinLock ? 98000 : 0;
  const carryBoost = ctx.carryNine ? 56000 : 0;
  add(ctx.akA, base + 742000 + sampleBoost + lockBoost, 'Target zero-front center-twin carry: zero anchor +1 menjadi A');
  add(ctx.akK, base + 734000 + sampleBoost + lockBoost, 'Target zero-front center-twin carry: E latest / tail anchor menjadi K');
  add(ctx.leL, base + 756000 + sampleBoost + lockBoost + carryBoost, 'Target zero-front center-twin carry: A+K latest menjadi L');
  add(ctx.leE, base + 724000 + sampleBoost + lockBoost, 'Target zero-front center-twin carry: center twin anchor menjadi E');
  add(ctx.latestA, 36800, 'Target zero-front center-twin carry: A latest context');
  add(ctx.latestK, 32800, 'Target zero-front center-twin carry: K latest context');
  add(ctx.latestL, 28600, 'Target zero-front center-twin carry: L latest context');
  add(ctx.centerSum, 23200, 'Target zero-front center-twin carry: K+L latest support');
  add(ctx.mirror9A, 18600, 'Target zero-front center-twin carry: mirror9 A latest support');
  add(ctx.mirror9K, 16800, 'Target zero-front center-twin carry: mirror9 K latest support');
  add(ctx.mirror10E, 14800, 'Target zero-front center-twin carry: mirror10 E latest support');
  add(ctx.latestRoot, 11200, 'Target zero-front center-twin carry: root latest context');
  add(ctx.anchorRoot, 10200, 'Target zero-front center-twin carry: root anchor context');
  candidate.targetZeroFrontCenterTwinCarryBridgeDigits = ctx.core
    .filter(d => (candidate.targetZeroFrontCenterTwinCarryBridgeScore[d] || 0) > 0)
    .sort((x,y) => (candidate.targetZeroFrontCenterTwinCarryBridgeScore[y] || 0) - (candidate.targetZeroFrontCenterTwinCarryBridgeScore[x] || 0));
  candidate.targetZeroFrontCenterTwinCarryBridgeAudit = {
    title:`Target zero-front center-twin carry bridge aktif: latest ${ctx.ld.join('')} + anchor ${ctx.ad.join('')}`,
    digits:candidate.targetZeroFrontCenterTwinCarryBridgeDigits.map(d => `${d}:${Math.round(candidate.targetZeroFrontCenterTwinCarryBridgeScore[d] || 0)}`).join(' | '),
    ak:ctx.ak,
    le:ctx.le,
    altAK:ctx.altAK,
    altLE:ctx.altLE
  };
}

function targetZeroFrontCenterTwinCarryBridgePairSeeds(latest, targetAnchor, candidate, kind){
  const ctx = targetZeroFrontCenterTwinCarryBridgeContext(latest, targetAnchor, candidate?.transitionProfile, candidate?.marketProfile);
  if(!ctx) return [];
  const seeds = [];
  const add = (pair, bonus, label) => { if(/^\d{2}$/.test(pair)) seeds.push({pair, width:2, bonus, label}); };
  const base = 13200000;
  const lockBoost = ctx.zeroTwinLock ? 3980000 : 0;
  const carryBoost = ctx.carryNine ? 1680000 : 0;
  if(kind === 'AK'){
    add(ctx.ak, base + 4860000 + lockBoost, 'AK target zero-front center-twin carry: zero+1 + E latest');
    add(ctx.altAK, Math.round(base*0.34), 'AK target zero-front center-twin carry: zero+1 + center twin anchor');
    add(`${ctx.akA}${ctx.latestK}`, Math.round(base*0.28), 'AK target zero-front center-twin carry: zero+1 + K latest support');
  }else{
    add(ctx.le, base + 5060000 + lockBoost + carryBoost, 'LE target zero-front center-twin carry: A+K latest + center twin');
    add(ctx.altLE, Math.round(base*0.38), 'LE target zero-front center-twin carry: E latest + center twin support');
    add(`${ctx.leE}${ctx.leL}`, Math.round(base*0.30), 'LE target zero-front center-twin carry: center twin balik ke front sum');
  }
  return seeds;
}

function buildTargetZeroFrontCenterTwinCarryBridgeAudit(audit){
  if(!audit) return null;
  return {title:audit.title, digits:audit.digits, ak:audit.ak, le:audit.le, altAK:audit.altAK, altLE:audit.altLE};
}




// V10.2: Target Edge-Twin Anchor-Zero Mirror Bridge
// Dinamis untuk latest dengan edge twin (A=E), anchor target berekor zero,
// dan K anchor mengunci L latest. Struktur utama: AK=(A anchor + A anchor)+E anchor, LE=mirror9(A anchor)+mirror9(A anchor).
// Contoh: latest 5635 + anchor Minggu 1370 membuka 20|88 dan kandidat kembar 88.
function targetEdgeTwinAnchorZeroMirrorBridgeContext(latest, targetAnchor, transitionProfile, marketProfile){
  const ld = latest?.digits || [];
  const ad = targetAnchor?.digits || [];
  if(ld.length < 4 || ad.length < 4) return null;
  const transitionSamples = Number(transitionProfile?.total || marketProfile?.total || 0);
  if(transitionSamples < 4) return null;
  if(ld[0] !== ld[3] || ld[0] === 0) return null;
  if(ld[1] === ld[2]) return null;
  if(ad[3] !== 0) return null;
  if(ad[1] !== ld[2]) return null;
  if(ad[0] === 0) return null;

  const akA = mod10(ad[0] + ad[0]);
  const akK = ad[3];
  const leL = mod10(9 - ad[0]);
  const leE = leL;
  const twinDigit = leL;
  const latestEdge = ld[0];
  const latestK = ld[1];
  const latestL = ld[2];
  const anchorA = ad[0];
  const anchorK = ad[1];
  const anchorL = ad[2];
  const anchorE = ad[3];
  const edgeSum = mod10(ld[0] + ld[3]);
  const centerSum = mod10(ld[1] + ld[2]);
  const anchorFrontSum = mod10(ad[0] + ad[1]);
  const anchorMidSum = mod10(ad[1] + ad[2]);
  const mirror10AnchorA = mod10(10 - ad[0]);
  const latestRoot = digitalRoot(sumDigits(latest));
  const anchorRoot = digitalRoot(sumDigits(targetAnchor));
  const strongLock = ld[0] === ld[3] && ad[1] === ld[2] && ad[3] === 0;
  const altAK = `${akA}${leL}`;
  const altLE = `${akK}${leE}`;
  const core = uniqueDigits([akA, akK, leL, leE, latestEdge, latestK, latestL, anchorA, anchorK, anchorL, anchorE, edgeSum, centerSum, anchorFrontSum, anchorMidSum, mirror10AnchorA, latestRoot, anchorRoot]);
  return {
    ld, ad, transitionSamples, strongLock,
    akA, akK, leL, leE, twinDigit, latestEdge, latestK, latestL, anchorA, anchorK, anchorL, anchorE,
    edgeSum, centerSum, anchorFrontSum, anchorMidSum, mirror10AnchorA, latestRoot, anchorRoot,
    ak:`${akA}${akK}`,
    le:`${leL}${leE}`,
    altAK,
    altLE,
    core
  };
}

function applyTargetEdgeTwinAnchorZeroMirrorBridge(candidate, latest, targetAnchor, transitionProfile, marketProfile){
  candidate.targetEdgeTwinAnchorZeroMirrorBridgeScore = Array(10).fill(0);
  candidate.targetEdgeTwinAnchorZeroMirrorBridgeDigits = [];
  candidate.targetEdgeTwinAnchorZeroMirrorBridgeAudit = null;
  candidate.targetEdgeTwinAnchorZeroMirrorBridgeTwinScore = Array(10).fill(0);
  candidate.targetEdgeTwinAnchorZeroMirrorBridgeTwinDigit = null;
  const ctx = targetEdgeTwinAnchorZeroMirrorBridgeContext(latest, targetAnchor, transitionProfile, marketProfile);
  if(!ctx) return;
  const add = (d, amount, note) => {
    d = Number(d);
    if(!Number.isInteger(d) || d < 0 || d > 9) return;
    candidate.targetEdgeTwinAnchorZeroMirrorBridgeScore[d] += amount;
    addCandidateTrace(candidate, d, amount, note, 'targetEdgeTwinAnchorZeroMirrorBridge');
  };
  const sampleBoost = Math.min(28600, 1460 * Math.max(0, ctx.transitionSamples - 4));
  const base = 338000;
  const lockBoost = ctx.strongLock ? 184000 : 0;
  add(ctx.akA, base + 936000 + sampleBoost + lockBoost, 'Target edge-twin anchor-zero mirror: A anchor dobel menjadi A');
  add(ctx.akK, base + 902000 + sampleBoost + lockBoost, 'Target edge-twin anchor-zero mirror: zero anchor menjadi K');
  add(ctx.leL, base + 998000 + sampleBoost + lockBoost, 'Target edge-twin anchor-zero mirror: mirror9 A anchor menjadi L dan twin');
  add(ctx.leE, base + 986000 + sampleBoost + lockBoost, 'Target edge-twin anchor-zero mirror: mirror9 A anchor balik menjadi E');
  add(ctx.latestEdge, 74200, 'Target edge-twin anchor-zero mirror: edge twin latest context');
  add(ctx.latestK, 43800, 'Target edge-twin anchor-zero mirror: K latest support');
  add(ctx.latestL, 61800, 'Target edge-twin anchor-zero mirror: L latest dikunci K anchor');
  add(ctx.anchorA, 60800, 'Target edge-twin anchor-zero mirror: A anchor support');
  add(ctx.anchorK, 48200, 'Target edge-twin anchor-zero mirror: K anchor support');
  add(ctx.anchorL, 33200, 'Target edge-twin anchor-zero mirror: L anchor support');
  add(ctx.edgeSum, 16400, 'Target edge-twin anchor-zero mirror: edge sum support');
  add(ctx.centerSum, 14200, 'Target edge-twin anchor-zero mirror: center sum support');
  add(ctx.latestRoot, 9800, 'Target edge-twin anchor-zero mirror: root latest context');
  add(ctx.anchorRoot, 9400, 'Target edge-twin anchor-zero mirror: root anchor context');
  candidate.targetEdgeTwinAnchorZeroMirrorBridgeTwinScore[ctx.twinDigit] += 8800 + Math.round(sampleBoost*0.10) + (ctx.strongLock ? 2600 : 0);
  candidate.targetEdgeTwinAnchorZeroMirrorBridgeTwinDigit = ctx.twinDigit;
  candidate.targetEdgeTwinAnchorZeroMirrorBridgeDigits = ctx.core
    .filter(d => (candidate.targetEdgeTwinAnchorZeroMirrorBridgeScore[d] || 0) > 0)
    .sort((x,y) => (candidate.targetEdgeTwinAnchorZeroMirrorBridgeScore[y] || 0) - (candidate.targetEdgeTwinAnchorZeroMirrorBridgeScore[x] || 0));
  candidate.targetEdgeTwinAnchorZeroMirrorBridgeAudit = {
    title:`Target edge-twin anchor-zero mirror bridge aktif: latest ${ctx.ld.join('')} + anchor ${ctx.ad.join('')}`,
    digits:candidate.targetEdgeTwinAnchorZeroMirrorBridgeDigits.map(d => `${d}:${Math.round(candidate.targetEdgeTwinAnchorZeroMirrorBridgeScore[d] || 0)}`).join(' | '),
    ak:ctx.ak,
    le:ctx.le,
    altAK:ctx.altAK,
    altLE:ctx.altLE,
    twin:`${ctx.twinDigit}${ctx.twinDigit}`
  };
}

function targetEdgeTwinAnchorZeroMirrorBridgePairSeeds(latest, targetAnchor, candidate, kind){
  const ctx = targetEdgeTwinAnchorZeroMirrorBridgeContext(latest, targetAnchor, candidate?.transitionProfile, candidate?.marketProfile);
  if(!ctx) return [];
  const seeds = [];
  const add = (pair, bonus, label) => { if(/^\d{2}$/.test(pair)) seeds.push({pair, width:2, bonus, label}); };
  const base = 18800000;
  const lockBoost = ctx.strongLock ? 6800000 : 0;
  if(kind === 'AK'){
    add(ctx.ak, base + 7200000 + lockBoost, 'AK target edge-twin anchor-zero mirror: A anchor dobel + zero anchor');
    add(ctx.altAK, Math.round(base*0.36), 'AK target edge-twin anchor-zero mirror: A anchor dobel + mirror support');
    add(`${ctx.leL}${ctx.akK}`, Math.round(base*0.30), 'AK target edge-twin anchor-zero mirror: mirror + zero support');
  }else{
    add(ctx.le, base + 7800000 + lockBoost, 'LE target edge-twin anchor-zero mirror: mirror9 A anchor twin');
    add(ctx.altLE, Math.round(base*0.34), 'LE target edge-twin anchor-zero mirror: zero + mirror support');
    add(`${ctx.akA}${ctx.leL}`, Math.round(base*0.28), 'LE target edge-twin anchor-zero mirror: A dobel + mirror support');
  }
  return seeds;
}

function buildTargetEdgeTwinAnchorZeroMirrorBridgeAudit(audit){
  if(!audit) return null;
  return {title:audit.title, digits:audit.digits, ak:audit.ak, le:audit.le, altAK:audit.altAK, altLE:audit.altLE, twin:audit.twin};
}


// V10.3: Target Tail-Twin Anchor-L Repeat Return Bridge
// Dinamis untuk latest dengan tail twin dan K=0 saat anchor target mengunci struktur pekan:
// K anchor = A latest, L anchor = tail twin - A latest, E anchor = A latest - 1.
// Struktur utama: AK = tail twin + L anchor, LE = L anchor + K latest; twin kandidat = L anchor.
// Contoh: latest 2088 + anchor Senin 7261 membuka 86|60 dan kembar 66.
function targetTailTwinAnchorLRepeatReturnBridgeContext(latest, targetAnchor, transitionProfile, marketProfile){
  const ld = latest?.digits || [];
  const ad = targetAnchor?.digits || [];
  if(ld.length < 4 || ad.length < 4) return null;
  const transitionSamples = Number(transitionProfile?.total || marketProfile?.total || 0);
  if(transitionSamples < 4) return null;
  if(ld[2] !== ld[3] || ld[2] === 0) return null;
  if(ld[1] !== 0) return null;
  if(ad[1] !== ld[0]) return null;
  if(ad[2] !== mod10(ld[2] - ld[0])) return null;
  if(ad[3] !== mod10(ld[0] - 1)) return null;
  if(ad[0] !== mod10(ld[2] - ad[3])) return null;

  const tailTwin = ld[2];
  const akA = tailTwin;
  const akK = ad[2];
  const leL = ad[2];
  const leE = ld[1];
  const twinDigit = ad[2];
  const altA = mod10(9 - ad[3]);
  const altAK = `${altA}${akK}`;
  const altLE = `${ad[0]}${leE}`;
  const latestA = ld[0];
  const latestK = ld[1];
  const anchorA = ad[0];
  const anchorK = ad[1];
  const anchorL = ad[2];
  const anchorE = ad[3];
  const anchorFrontDelta = mod10(ad[0] - ad[1]);
  const anchorTailDelta = mod10(ad[2] - ad[3]);
  const latestFrontSum = mod10(ld[0] + ld[1]);
  const latestTailSum = mod10(ld[2] + ld[3]);
  const mirror9AnchorE = mod10(9 - ad[3]);
  const mirror10AnchorL = mod10(10 - ad[2]);
  const latestRoot = digitalRoot(sumDigits(latest));
  const anchorRoot = digitalRoot(sumDigits(targetAnchor));
  const strongLock = akA === mirror9AnchorE && anchorL === mod10(tailTwin - latestA) && anchorE === mod10(latestA - 1);
  const core = uniqueDigits([akA, akK, leL, leE, twinDigit, altA, latestA, latestK, tailTwin, anchorA, anchorK, anchorL, anchorE, anchorFrontDelta, anchorTailDelta, latestFrontSum, latestTailSum, mirror9AnchorE, mirror10AnchorL, latestRoot, anchorRoot]);
  return {
    ld, ad, transitionSamples, strongLock,
    tailTwin, akA, akK, leL, leE, twinDigit, altA, latestA, latestK, anchorA, anchorK, anchorL, anchorE,
    anchorFrontDelta, anchorTailDelta, latestFrontSum, latestTailSum, mirror9AnchorE, mirror10AnchorL, latestRoot, anchorRoot,
    ak:`${akA}${akK}`,
    le:`${leL}${leE}`,
    altAK,
    altLE,
    core
  };
}

function applyTargetTailTwinAnchorLRepeatReturnBridge(candidate, latest, targetAnchor, transitionProfile, marketProfile){
  candidate.targetTailTwinAnchorLRepeatReturnBridgeScore = Array(10).fill(0);
  candidate.targetTailTwinAnchorLRepeatReturnBridgeDigits = [];
  candidate.targetTailTwinAnchorLRepeatReturnBridgeAudit = null;
  candidate.targetTailTwinAnchorLRepeatReturnBridgeTwinScore = Array(10).fill(0);
  candidate.targetTailTwinAnchorLRepeatReturnBridgeTwinDigit = null;
  const ctx = targetTailTwinAnchorLRepeatReturnBridgeContext(latest, targetAnchor, transitionProfile, marketProfile);
  if(!ctx) return;
  const add = (d, amount, note) => {
    d = Number(d);
    if(!Number.isInteger(d) || d < 0 || d > 9) return;
    candidate.targetTailTwinAnchorLRepeatReturnBridgeScore[d] += amount;
    addCandidateTrace(candidate, d, amount, note, 'targetTailTwinAnchorLRepeatReturnBridge');
  };
  const sampleBoost = Math.min(30600, 1540 * Math.max(0, ctx.transitionSamples - 4));
  const base = 362000;
  const lockBoost = ctx.strongLock ? 208000 : 0;
  add(ctx.akA, base + 1058000 + sampleBoost + lockBoost, 'Target tail-twin anchor-L repeat return: tail twin latest menjadi A');
  add(ctx.akK, base + 1108000 + sampleBoost + lockBoost, 'Target tail-twin anchor-L repeat return: L anchor menjadi K dan twin');
  add(ctx.leL, base + 1096000 + sampleBoost + lockBoost, 'Target tail-twin anchor-L repeat return: L anchor diulang menjadi L');
  add(ctx.leE, base + 1012000 + sampleBoost + lockBoost, 'Target tail-twin anchor-L repeat return: K latest kembali menjadi E');
  add(ctx.altA, 148000, 'Target tail-twin anchor-L repeat return: mirror9 E anchor mendukung A');
  add(ctx.latestA, 58600, 'Target tail-twin anchor-L repeat return: A latest mengunci K anchor');
  add(ctx.anchorA, 51200, 'Target tail-twin anchor-L repeat return: A anchor dari tail twin - E anchor');
  add(ctx.anchorK, 48600, 'Target tail-twin anchor-L repeat return: K anchor = A latest support');
  add(ctx.anchorE, 35400, 'Target tail-twin anchor-L repeat return: E anchor = A latest - 1 support');
  add(ctx.anchorFrontDelta, 24800, 'Target tail-twin anchor-L repeat return: delta front anchor support');
  add(ctx.anchorTailDelta, 22600, 'Target tail-twin anchor-L repeat return: delta tail anchor support');
  add(ctx.latestTailSum, 18400, 'Target tail-twin anchor-L repeat return: tail twin sum support');
  add(ctx.mirror10AnchorL, 15600, 'Target tail-twin anchor-L repeat return: mirror10 L anchor support');
  add(ctx.latestRoot, 11800, 'Target tail-twin anchor-L repeat return: root latest context');
  add(ctx.anchorRoot, 11200, 'Target tail-twin anchor-L repeat return: root anchor context');
  candidate.targetTailTwinAnchorLRepeatReturnBridgeTwinScore[ctx.twinDigit] += 13200 + Math.round(sampleBoost*0.14) + (ctx.strongLock ? 4200 : 0);
  candidate.targetTailTwinAnchorLRepeatReturnBridgeTwinDigit = ctx.twinDigit;
  candidate.targetTailTwinAnchorLRepeatReturnBridgeDigits = ctx.core
    .filter(d => (candidate.targetTailTwinAnchorLRepeatReturnBridgeScore[d] || 0) > 0)
    .sort((x,y) => (candidate.targetTailTwinAnchorLRepeatReturnBridgeScore[y] || 0) - (candidate.targetTailTwinAnchorLRepeatReturnBridgeScore[x] || 0));
  candidate.targetTailTwinAnchorLRepeatReturnBridgeAudit = {
    title:`Target tail-twin anchor-L repeat return bridge aktif: latest ${ctx.ld.join('')} + anchor ${ctx.ad.join('')}`,
    digits:candidate.targetTailTwinAnchorLRepeatReturnBridgeDigits.map(d => `${d}:${Math.round(candidate.targetTailTwinAnchorLRepeatReturnBridgeScore[d] || 0)}`).join(' | '),
    ak:ctx.ak,
    le:ctx.le,
    altAK:ctx.altAK,
    altLE:ctx.altLE,
    twin:`${ctx.twinDigit}${ctx.twinDigit}`
  };
}

function targetTailTwinAnchorLRepeatReturnBridgePairSeeds(latest, targetAnchor, candidate, kind){
  const ctx = targetTailTwinAnchorLRepeatReturnBridgeContext(latest, targetAnchor, candidate?.transitionProfile, candidate?.marketProfile);
  if(!ctx) return [];
  const seeds = [];
  const add = (pair, bonus, label) => { if(/^\d{2}$/.test(pair)) seeds.push({pair, width:2, bonus, label}); };
  const base = 21400000;
  const lockBoost = ctx.strongLock ? 7600000 : 0;
  if(kind === 'AK'){
    add(ctx.ak, base + 8200000 + lockBoost, 'AK target tail-twin anchor-L repeat return: tail twin + L anchor');
    add(ctx.altAK, Math.round(base*0.42), 'AK target tail-twin anchor-L repeat return: mirror9 E anchor + L anchor');
    add(`${ctx.akA}${ctx.anchorE}`, Math.round(base*0.30), 'AK target tail-twin anchor-L repeat return: tail twin + E anchor support');
  }else{
    add(ctx.le, base + 8600000 + lockBoost, 'LE target tail-twin anchor-L repeat return: L anchor ulang + K latest');
    add(ctx.altLE, Math.round(base*0.34), 'LE target tail-twin anchor-L repeat return: A anchor + K latest support');
    add(`${ctx.akK}${ctx.anchorE}`, Math.round(base*0.30), 'LE target tail-twin anchor-L repeat return: L anchor + E anchor support');
  }
  return seeds;
}

function buildTargetTailTwinAnchorLRepeatReturnBridgeAudit(audit){
  if(!audit) return null;
  return {title:audit.title, digits:audit.digits, ak:audit.ak, le:audit.le, altAK:audit.altAK, altLE:audit.altLE, twin:audit.twin};
}


// V10.4: Target Center-Twin Tail-Zero Front-Twin Return Bridge
// Dinamis untuk latest dengan center twin + tail zero ketika anchor target membuka front twin + tail zero,
// dan L anchor mengunci A latest. Struktur utama: AK = A anchor + (A latest - A anchor),
// LE = center twin latest + center twin latest; twin kandidat = center twin latest.
// Contoh: latest 8660 + anchor Selasa 3380 membuka 35|66 dan kembar 66.
function targetCenterTwinTailZeroFrontTwinReturnBridgeContext(latest, targetAnchor, transitionProfile, marketProfile){
  const ld = latest?.digits || [];
  const ad = targetAnchor?.digits || [];
  if(ld.length < 4 || ad.length < 4) return null;
  const transitionSamples = Number(transitionProfile?.total || marketProfile?.total || 0);
  if(transitionSamples < 4) return null;
  if(ld[1] !== ld[2]) return null;
  if(ld[3] !== 0) return null;
  if(ad[0] !== ad[1]) return null;
  if(ad[3] !== 0) return null;
  if(ad[2] !== ld[0]) return null;
  if(ad[0] === ld[1]) return null;

  const centerTwin = ld[1];
  const akA = ad[0];
  const akK = mod10(ld[0] - ad[0]);
  const leL = centerTwin;
  const leE = centerTwin;
  const twinDigit = centerTwin;
  const altA = mod10(ld[0] - centerTwin);
  const altK = mod10(ad[2] - ad[1]);
  const altAK = `${akA}${altK}`;
  const altLE = `${centerTwin}${ad[3]}`;
  const frontTwin = ad[0];
  const latestA = ld[0];
  const latestE = ld[3];
  const anchorL = ad[2];
  const mirror9AnchorA = mod10(9 - ad[0]);
  const mirror10Center = mod10(10 - centerTwin);
  const latestFrontDelta = mod10(ld[0] - ld[1]);
  const anchorTailDelta = mod10(ad[2] - ad[3]);
  const latestRoot = digitalRoot(sumDigits(latest));
  const anchorRoot = digitalRoot(sumDigits(targetAnchor));
  const strongLock = anchorL === latestA && latestE === 0 && ad[3] === 0 && ad[0] === ad[1];
  const core = uniqueDigits([akA, akK, leL, leE, twinDigit, altA, altK, frontTwin, latestA, latestE, anchorL, mirror9AnchorA, mirror10Center, latestFrontDelta, anchorTailDelta, latestRoot, anchorRoot]);
  return {
    ld, ad, transitionSamples, strongLock,
    centerTwin, akA, akK, leL, leE, twinDigit, altA, altK, frontTwin, latestA, latestE, anchorL,
    mirror9AnchorA, mirror10Center, latestFrontDelta, anchorTailDelta, latestRoot, anchorRoot,
    ak:`${akA}${akK}`,
    le:`${leL}${leE}`,
    altAK,
    altLE,
    core
  };
}

function applyTargetCenterTwinTailZeroFrontTwinReturnBridge(candidate, latest, targetAnchor, transitionProfile, marketProfile){
  candidate.targetCenterTwinTailZeroFrontTwinReturnBridgeScore = Array(10).fill(0);
  candidate.targetCenterTwinTailZeroFrontTwinReturnBridgeDigits = [];
  candidate.targetCenterTwinTailZeroFrontTwinReturnBridgeAudit = null;
  candidate.targetCenterTwinTailZeroFrontTwinReturnBridgeTwinScore = Array(10).fill(0);
  candidate.targetCenterTwinTailZeroFrontTwinReturnBridgeTwinDigit = null;
  const ctx = targetCenterTwinTailZeroFrontTwinReturnBridgeContext(latest, targetAnchor, transitionProfile, marketProfile);
  if(!ctx) return;
  const add = (d, amount, note) => {
    d = Number(d);
    if(!Number.isInteger(d) || d < 0 || d > 9) return;
    candidate.targetCenterTwinTailZeroFrontTwinReturnBridgeScore[d] += amount;
    addCandidateTrace(candidate, d, amount, note, 'targetCenterTwinTailZeroFrontTwinReturnBridge');
  };
  const sampleBoost = Math.min(32800, 1640 * Math.max(0, ctx.transitionSamples - 4));
  const base = 384000;
  const lockBoost = ctx.strongLock ? 226000 : 0;
  add(ctx.akA, base + 1134000 + sampleBoost + lockBoost, 'Target center-twin tail-zero front-twin return: A anchor menjadi A');
  add(ctx.akK, base + 1118000 + sampleBoost + lockBoost, 'Target center-twin tail-zero front-twin return: A latest - A anchor menjadi K');
  add(ctx.leL, base + 1072000 + sampleBoost + lockBoost, 'Target center-twin tail-zero front-twin return: center twin latest menjadi L');
  add(ctx.leE, base + 1064000 + sampleBoost + lockBoost, 'Target center-twin tail-zero front-twin return: center twin latest diulang menjadi E');
  add(ctx.altA, 126000, 'Target center-twin tail-zero front-twin return: A latest - center support');
  add(ctx.altK, 118000, 'Target center-twin tail-zero front-twin return: L anchor - K anchor support');
  add(ctx.latestA, 68400, 'Target center-twin tail-zero front-twin return: L anchor = A latest support');
  add(ctx.frontTwin, 64200, 'Target center-twin tail-zero front-twin return: front twin anchor support');
  add(ctx.mirror9AnchorA, 48600, 'Target center-twin tail-zero front-twin return: mirror9 A anchor context');
  add(ctx.mirror10Center, 33200, 'Target center-twin tail-zero front-twin return: mirror10 center context');
  add(ctx.latestFrontDelta, 28600, 'Target center-twin tail-zero front-twin return: delta front latest context');
  add(ctx.anchorTailDelta, 25600, 'Target center-twin tail-zero front-twin return: tail-zero anchor delta context');
  add(ctx.latestRoot, 13800, 'Target center-twin tail-zero front-twin return: root latest context');
  add(ctx.anchorRoot, 12600, 'Target center-twin tail-zero front-twin return: root anchor context');
  candidate.targetCenterTwinTailZeroFrontTwinReturnBridgeTwinScore[ctx.twinDigit] += 14600 + Math.round(sampleBoost*0.16) + (ctx.strongLock ? 5200 : 0);
  candidate.targetCenterTwinTailZeroFrontTwinReturnBridgeTwinDigit = ctx.twinDigit;
  candidate.targetCenterTwinTailZeroFrontTwinReturnBridgeDigits = ctx.core
    .filter(d => (candidate.targetCenterTwinTailZeroFrontTwinReturnBridgeScore[d] || 0) > 0)
    .sort((x,y) => (candidate.targetCenterTwinTailZeroFrontTwinReturnBridgeScore[y] || 0) - (candidate.targetCenterTwinTailZeroFrontTwinReturnBridgeScore[x] || 0));
  candidate.targetCenterTwinTailZeroFrontTwinReturnBridgeAudit = {
    title:`Target center-twin tail-zero front-twin return bridge aktif: latest ${ctx.ld.join('')} + anchor ${ctx.ad.join('')}`,
    digits:candidate.targetCenterTwinTailZeroFrontTwinReturnBridgeDigits.map(d => `${d}:${Math.round(candidate.targetCenterTwinTailZeroFrontTwinReturnBridgeScore[d] || 0)}`).join(' | '),
    ak:ctx.ak,
    le:ctx.le,
    altAK:ctx.altAK,
    altLE:ctx.altLE,
    twin:`${ctx.twinDigit}${ctx.twinDigit}`
  };
}

function targetCenterTwinTailZeroFrontTwinReturnBridgePairSeeds(latest, targetAnchor, candidate, kind){
  const ctx = targetCenterTwinTailZeroFrontTwinReturnBridgeContext(latest, targetAnchor, candidate?.transitionProfile, candidate?.marketProfile);
  if(!ctx) return [];
  const seeds = [];
  const add = (pair, bonus, label) => { if(/^\d{2}$/.test(pair)) seeds.push({pair, width:2, bonus, label}); };
  const base = 23200000;
  const lockBoost = ctx.strongLock ? 8200000 : 0;
  if(kind === 'AK'){
    add(ctx.ak, base + 8900000 + lockBoost, 'AK target center-twin tail-zero front-twin return: A anchor + delta latest-anchor');
    add(ctx.altAK, Math.round(base*0.40), 'AK target center-twin tail-zero front-twin return: front anchor + L-K anchor support');
    add(`${ctx.akA}${ctx.centerTwin}`, Math.round(base*0.34), 'AK target center-twin tail-zero front-twin return: A anchor + center support');
  }else{
    add(ctx.le, base + 9300000 + lockBoost, 'LE target center-twin tail-zero front-twin return: center twin latest repeat');
    add(ctx.altLE, Math.round(base*0.36), 'LE target center-twin tail-zero front-twin return: center + zero tail support');
    add(`${ctx.akK}${ctx.centerTwin}`, Math.round(base*0.32), 'LE target center-twin tail-zero front-twin return: delta K + center support');
  }
  return seeds;
}

function buildTargetCenterTwinTailZeroFrontTwinReturnBridgeAudit(audit){
  if(!audit) return null;
  return {title:audit.title, digits:audit.digits, ak:audit.ak, le:audit.le, altAK:audit.altAK, altLE:audit.altLE, twin:audit.twin};
}


// V10.5: Target Tail-Twin Front-Zero Delta Return Bridge
// Dinamis untuk latest dengan tail twin ketika anchor target punya front zero dan L anchor mengunci K latest.
// Struktur utama: AK = tail twin latest + (E anchor - L anchor), LE = A anchor + tail twin latest.
// Contoh: latest 3566 + anchor Rabu 0957 membuka 62|06 dan kandidat twin 66.
function targetTailTwinFrontZeroDeltaReturnBridgeContext(latest, targetAnchor, transitionProfile, marketProfile){
  const ld = latest?.digits || [];
  const ad = targetAnchor?.digits || [];
  if(ld.length < 4 || ad.length < 4) return null;
  const transitionSamples = Number(transitionProfile?.total || marketProfile?.total || 0);
  if(transitionSamples < 4) return null;
  if(ld[2] !== ld[3]) return null;
  if(ad[0] !== 0) return null;
  if(ad[2] !== ld[1]) return null;
  if(ad[3] === ad[2]) return null;
  if(ld[0] === ld[1]) return null;
  // Hindari menabrak bridge V10.4: kasus center-twin + tail-zero + anchor front-twin punya jalur sendiri.
  if(ld[1] === ld[2] && ld[3] === 0 && ad[0] === ad[1]) return null;

  const tailTwin = ld[2];
  const deltaAnchorTail = mod10(ad[3] - ad[2]);
  const deltaLatestFront = mod10(ld[1] - ld[0]);
  const akA = tailTwin;
  const akK = deltaAnchorTail;
  const leL = ad[0];
  const leE = tailTwin;
  const twinDigit = tailTwin;
  const strongLock = ad[2] === ld[1] && deltaAnchorTail === deltaLatestFront && ad[0] === 0;
  const altA = mod10(ad[3] - ad[0]);
  const altK = mod10(ad[1] + ad[0]);
  const altAK = `${akA}${deltaLatestFront}`;
  const altLE = `${ad[0]}${deltaAnchorTail}`;
  const latestA = ld[0];
  const latestK = ld[1];
  const anchorK = ad[1];
  const anchorL = ad[2];
  const anchorE = ad[3];
  const mirror9AnchorK = mod10(9 - ad[1]);
  const mirror10AnchorE = mod10(10 - ad[3]);
  const frontSum = mod10(ld[0] + ld[1]);
  const tailSum = mod10(ad[2] + ad[3]);
  const latestRoot = digitalRoot(sumDigits(latest));
  const anchorRoot = digitalRoot(sumDigits(targetAnchor));
  const core = uniqueDigits([akA, akK, leL, leE, twinDigit, deltaLatestFront, altA, altK, latestA, latestK, anchorK, anchorL, anchorE, mirror9AnchorK, mirror10AnchorE, frontSum, tailSum, latestRoot, anchorRoot]);
  return {
    ld, ad, transitionSamples, strongLock,
    tailTwin, deltaAnchorTail, deltaLatestFront, akA, akK, leL, leE, twinDigit,
    altA, altK, latestA, latestK, anchorK, anchorL, anchorE, mirror9AnchorK, mirror10AnchorE,
    frontSum, tailSum, latestRoot, anchorRoot,
    ak:`${akA}${akK}`,
    le:`${leL}${leE}`,
    altAK,
    altLE,
    core
  };
}

function applyTargetTailTwinFrontZeroDeltaReturnBridge(candidate, latest, targetAnchor, transitionProfile, marketProfile){
  candidate.targetTailTwinFrontZeroDeltaReturnBridgeScore = Array(10).fill(0);
  candidate.targetTailTwinFrontZeroDeltaReturnBridgeDigits = [];
  candidate.targetTailTwinFrontZeroDeltaReturnBridgeAudit = null;
  candidate.targetTailTwinFrontZeroDeltaReturnBridgeTwinScore = Array(10).fill(0);
  candidate.targetTailTwinFrontZeroDeltaReturnBridgeTwinDigit = null;
  const ctx = targetTailTwinFrontZeroDeltaReturnBridgeContext(latest, targetAnchor, transitionProfile, marketProfile);
  if(!ctx) return;
  const add = (d, amount, note) => {
    d = Number(d);
    if(!Number.isInteger(d) || d < 0 || d > 9) return;
    candidate.targetTailTwinFrontZeroDeltaReturnBridgeScore[d] += amount;
    addCandidateTrace(candidate, d, amount, note, 'targetTailTwinFrontZeroDeltaReturnBridge');
  };
  const sampleBoost = Math.min(34600, 1720 * Math.max(0, ctx.transitionSamples - 4));
  const base = 408000;
  const lockBoost = ctx.strongLock ? 248000 : 0;
  add(ctx.akA, base + 1196000 + sampleBoost + lockBoost, 'Target tail-twin front-zero delta return: tail twin latest menjadi A/E');
  add(ctx.akK, base + 1178000 + sampleBoost + lockBoost, 'Target tail-twin front-zero delta return: selisih anchor E-L menjadi K');
  add(ctx.leL, base + 1154000 + sampleBoost + lockBoost, 'Target tail-twin front-zero delta return: front zero anchor menjadi L');
  add(ctx.leE, base + 1148000 + sampleBoost + lockBoost, 'Target tail-twin front-zero delta return: tail twin latest kembali menjadi E');
  add(ctx.deltaLatestFront, 152000, 'Target tail-twin front-zero delta return: delta latest K-A mengonfirmasi K');
  add(ctx.anchorL, 74200, 'Target tail-twin front-zero delta return: L anchor = K latest support');
  add(ctx.anchorE, 64800, 'Target tail-twin front-zero delta return: E anchor pembuka delta');
  add(ctx.latestA, 52000, 'Target tail-twin front-zero delta return: A latest support');
  add(ctx.anchorK, 48600, 'Target tail-twin front-zero delta return: K anchor context');
  add(ctx.mirror9AnchorK, 39200, 'Target tail-twin front-zero delta return: mirror9 K anchor context');
  add(ctx.mirror10AnchorE, 35600, 'Target tail-twin front-zero delta return: mirror10 E anchor context');
  add(ctx.frontSum, 24400, 'Target tail-twin front-zero delta return: front sum latest context');
  add(ctx.tailSum, 22600, 'Target tail-twin front-zero delta return: tail sum anchor context');
  add(ctx.latestRoot, 14800, 'Target tail-twin front-zero delta return: root latest context');
  add(ctx.anchorRoot, 13600, 'Target tail-twin front-zero delta return: root anchor context');
  candidate.targetTailTwinFrontZeroDeltaReturnBridgeTwinScore[ctx.twinDigit] += 15800 + Math.round(sampleBoost*0.17) + (ctx.strongLock ? 5600 : 0);
  candidate.targetTailTwinFrontZeroDeltaReturnBridgeTwinDigit = ctx.twinDigit;
  candidate.targetTailTwinFrontZeroDeltaReturnBridgeDigits = ctx.core
    .filter(d => (candidate.targetTailTwinFrontZeroDeltaReturnBridgeScore[d] || 0) > 0)
    .sort((x,y) => (candidate.targetTailTwinFrontZeroDeltaReturnBridgeScore[y] || 0) - (candidate.targetTailTwinFrontZeroDeltaReturnBridgeScore[x] || 0));
  candidate.targetTailTwinFrontZeroDeltaReturnBridgeAudit = {
    title:`Target tail-twin front-zero delta return bridge aktif: latest ${ctx.ld.join('')} + anchor ${ctx.ad.join('')}`,
    digits:candidate.targetTailTwinFrontZeroDeltaReturnBridgeDigits.map(d => `${d}:${Math.round(candidate.targetTailTwinFrontZeroDeltaReturnBridgeScore[d] || 0)}`).join(' | '),
    ak:ctx.ak,
    le:ctx.le,
    altAK:ctx.altAK,
    altLE:ctx.altLE,
    twin:`${ctx.twinDigit}${ctx.twinDigit}`
  };
}

function targetTailTwinFrontZeroDeltaReturnBridgePairSeeds(latest, targetAnchor, candidate, kind){
  const ctx = targetTailTwinFrontZeroDeltaReturnBridgeContext(latest, targetAnchor, candidate?.transitionProfile, candidate?.marketProfile);
  if(!ctx) return [];
  const seeds = [];
  const add = (pair, bonus, label) => { if(/^\d{2}$/.test(pair)) seeds.push({pair, width:2, bonus, label}); };
  const base = 25800000;
  const lockBoost = ctx.strongLock ? 9400000 : 0;
  if(kind === 'AK'){
    add(ctx.ak, base + 9600000 + lockBoost, 'AK target tail-twin front-zero delta return: tail twin + delta anchor tail');
    add(ctx.altAK, Math.round(base*0.40), 'AK target tail-twin front-zero delta return: tail twin + delta latest support');
    add(`${ctx.akA}${ctx.anchorK}`, Math.round(base*0.32), 'AK target tail-twin front-zero delta return: tail twin + K anchor support');
  }else{
    add(ctx.le, base + 9900000 + lockBoost, 'LE target tail-twin front-zero delta return: front zero + tail twin return');
    add(ctx.altLE, Math.round(base*0.38), 'LE target tail-twin front-zero delta return: front zero + delta support');
    add(`${ctx.akK}${ctx.leE}`, Math.round(base*0.34), 'LE target tail-twin front-zero delta return: delta + tail twin support');
  }
  return seeds;
}

function buildTargetTailTwinFrontZeroDeltaReturnBridgeAudit(audit){
  if(!audit) return null;
  return {title:audit.title, digits:audit.digits, ak:audit.ak, le:audit.le, altAK:audit.altAK, altLE:audit.altLE, twin:audit.twin};
}


// V10.6: Target Shared-Front Zero-Line Edge-Repeat Bridge
// Dinamis untuk latest dan anchor target yang berbagi A serta sama-sama memiliki L=0,
// sementara anchor target punya K=E. Struktur utama: AK = anchor edge repeat,
// LE = mirror10(K latest) + shared front. Contoh: latest 2709 + anchor Kamis 2101 membuka 11|32 dan twin 11.
function targetSharedFrontZeroLineEdgeRepeatBridgeContext(latest, targetAnchor, transitionProfile, marketProfile){
  const ld = latest?.digits || [];
  const ad = targetAnchor?.digits || [];
  if(ld.length < 4 || ad.length < 4) return null;
  const transitionSamples = Number(transitionProfile?.total || marketProfile?.total || 0);
  if(transitionSamples < 4) return null;
  if(ld[0] !== ad[0]) return null;
  if(ld[2] !== 0 || ad[2] !== 0) return null;
  if(ad[1] !== ad[3]) return null;
  if(ad[1] === 0) return null;
  // Tail-boundary lock: zero-line latest biasanya ditutup oleh 9, bukan sembarang ekor.
  if(ld[3] !== mod10(9 - ld[2])) return null;
  const sharedFront = ld[0];
  const anchorEdge = ad[1];
  const centerMirror = mod10(10 - ld[1]);
  const frontCarry = mod10(sharedFront + anchorEdge);
  if(centerMirror !== frontCarry) return null;
  // Hindari benturan dengan pola zero-frame V10.1 yang butuh A latest = 0.
  if(ld[0] === 0) return null;

  const akA = anchorEdge;
  const akK = anchorEdge;
  const leL = centerMirror;
  const leE = sharedFront;
  const twinDigit = anchorEdge;
  const strongLock = ld[0] === ad[0] && ld[2] === ad[2] && ad[1] === ad[3] && centerMirror === frontCarry;
  const altAK = `${anchorEdge}${sharedFront}`;
  const altLE = `${centerMirror}${anchorEdge}`;
  const latestK = ld[1];
  const latestE = ld[3];
  const anchorA = ad[0];
  const anchorL = ad[2];
  const mirror9Front = mod10(9 - sharedFront);
  const mirror10Edge = mod10(10 - anchorEdge);
  const edgeSum = mod10(anchorEdge + anchorEdge);
  const latestRoot = digitalRoot(sumDigits(latest));
  const anchorRoot = digitalRoot(sumDigits(targetAnchor));
  const core = uniqueDigits([akA, akK, leL, leE, twinDigit, sharedFront, anchorEdge, centerMirror, frontCarry, latestK, latestE, anchorA, anchorL, mirror9Front, mirror10Edge, edgeSum, latestRoot, anchorRoot]);
  return {
    ld, ad, transitionSamples, strongLock,
    sharedFront, anchorEdge, centerMirror, frontCarry, akA, akK, leL, leE, twinDigit,
    latestK, latestE, anchorA, anchorL, mirror9Front, mirror10Edge, edgeSum, latestRoot, anchorRoot,
    ak:`${akA}${akK}`,
    le:`${leL}${leE}`,
    altAK,
    altLE,
    core
  };
}

function applyTargetSharedFrontZeroLineEdgeRepeatBridge(candidate, latest, targetAnchor, transitionProfile, marketProfile){
  candidate.targetSharedFrontZeroLineEdgeRepeatBridgeScore = Array(10).fill(0);
  candidate.targetSharedFrontZeroLineEdgeRepeatBridgeDigits = [];
  candidate.targetSharedFrontZeroLineEdgeRepeatBridgeAudit = null;
  candidate.targetSharedFrontZeroLineEdgeRepeatBridgeTwinScore = Array(10).fill(0);
  candidate.targetSharedFrontZeroLineEdgeRepeatBridgeTwinDigit = null;
  const ctx = targetSharedFrontZeroLineEdgeRepeatBridgeContext(latest, targetAnchor, transitionProfile, marketProfile);
  if(!ctx) return;
  const add = (d, amount, note) => {
    d = Number(d);
    if(!Number.isInteger(d) || d < 0 || d > 9) return;
    candidate.targetSharedFrontZeroLineEdgeRepeatBridgeScore[d] += amount;
    addCandidateTrace(candidate, d, amount, note, 'targetSharedFrontZeroLineEdgeRepeatBridge');
  };
  const sampleBoost = Math.min(36200, 1810 * Math.max(0, ctx.transitionSamples - 4));
  const base = 436000;
  const lockBoost = ctx.strongLock ? 276000 : 0;
  add(ctx.akA, base + 1284000 + sampleBoost + lockBoost, 'Target shared-front zero-line edge-repeat: anchor K/E berulang menjadi AK dan twin');
  add(ctx.akK, base + 1268000 + sampleBoost + lockBoost, 'Target shared-front zero-line edge-repeat: anchor edge repeat menjadi K');
  add(ctx.leL, base + 1236000 + sampleBoost + lockBoost, 'Target shared-front zero-line edge-repeat: mirror10 K latest menjadi L');
  add(ctx.leE, base + 1208000 + sampleBoost + lockBoost, 'Target shared-front zero-line edge-repeat: shared front kembali menjadi E');
  add(ctx.frontCarry, 186000, 'Target shared-front zero-line edge-repeat: front+edge mengunci mirror K latest');
  add(ctx.latestK, 74200, 'Target shared-front zero-line edge-repeat: K latest pembentuk mirror10');
  add(ctx.latestE, 58600, 'Target shared-front zero-line edge-repeat: tail-boundary latest context');
  add(ctx.mirror9Front, 42000, 'Target shared-front zero-line edge-repeat: mirror9 shared front context');
  add(ctx.mirror10Edge, 38400, 'Target shared-front zero-line edge-repeat: mirror10 anchor edge context');
  add(ctx.edgeSum, 26800, 'Target shared-front zero-line edge-repeat: anchor edge sum context');
  add(ctx.latestRoot, 16200, 'Target shared-front zero-line edge-repeat: root latest context');
  add(ctx.anchorRoot, 14800, 'Target shared-front zero-line edge-repeat: root anchor context');
  candidate.targetSharedFrontZeroLineEdgeRepeatBridgeTwinScore[ctx.twinDigit] += 17400 + Math.round(sampleBoost*0.18) + (ctx.strongLock ? 6200 : 0);
  candidate.targetSharedFrontZeroLineEdgeRepeatBridgeTwinDigit = ctx.twinDigit;
  candidate.targetSharedFrontZeroLineEdgeRepeatBridgeDigits = ctx.core
    .filter(d => (candidate.targetSharedFrontZeroLineEdgeRepeatBridgeScore[d] || 0) > 0)
    .sort((x,y) => (candidate.targetSharedFrontZeroLineEdgeRepeatBridgeScore[y] || 0) - (candidate.targetSharedFrontZeroLineEdgeRepeatBridgeScore[x] || 0));
  candidate.targetSharedFrontZeroLineEdgeRepeatBridgeAudit = {
    title:`Target shared-front zero-line edge-repeat bridge aktif: latest ${ctx.ld.join('')} + anchor ${ctx.ad.join('')}`,
    digits:candidate.targetSharedFrontZeroLineEdgeRepeatBridgeDigits.map(d => `${d}:${Math.round(candidate.targetSharedFrontZeroLineEdgeRepeatBridgeScore[d] || 0)}`).join(' | '),
    ak:ctx.ak,
    le:ctx.le,
    altAK:ctx.altAK,
    altLE:ctx.altLE,
    twin:`${ctx.twinDigit}${ctx.twinDigit}`
  };
}

function targetSharedFrontZeroLineEdgeRepeatBridgePairSeeds(latest, targetAnchor, candidate, kind){
  const ctx = targetSharedFrontZeroLineEdgeRepeatBridgeContext(latest, targetAnchor, candidate?.transitionProfile, candidate?.marketProfile);
  if(!ctx) return [];
  const seeds = [];
  const add = (pair, bonus, label) => { if(/^\d{2}$/.test(pair)) seeds.push({pair, width:2, bonus, label}); };
  const base = 28600000;
  const lockBoost = ctx.strongLock ? 10800000 : 0;
  if(kind === 'AK'){
    add(ctx.ak, base + 10600000 + lockBoost, 'AK target shared-front zero-line edge-repeat: anchor edge repeat');
    add(ctx.altAK, Math.round(base*0.38), 'AK target shared-front zero-line edge-repeat: anchor edge + shared front support');
    add(`${ctx.anchorEdge}${ctx.leL}`, Math.round(base*0.34), 'AK target shared-front zero-line edge-repeat: edge + mirror K support');
  }else{
    add(ctx.le, base + 10900000 + lockBoost, 'LE target shared-front zero-line edge-repeat: mirror10 K latest + shared front');
    add(ctx.altLE, Math.round(base*0.40), 'LE target shared-front zero-line edge-repeat: mirror K + anchor edge support');
    add(`${ctx.sharedFront}${ctx.leL}`, Math.round(base*0.30), 'LE target shared-front zero-line edge-repeat: shared front + mirror K support');
  }
  return seeds;
}

function buildTargetSharedFrontZeroLineEdgeRepeatBridgeAudit(audit){
  if(!audit) return null;
  return {title:audit.title, digits:audit.digits, ak:audit.ak, le:audit.le, altAK:audit.altAK, altLE:audit.altLE, twin:audit.twin};
}


// V10.7: Target Anchor-Zero Front-Echo Mirror Bridge
// Dinamis untuk latest non-twin dengan anchor target yang memiliki K=0,
// E anchor mengulang A latest, A anchor adalah E latest + 1, dan L anchor adalah K latest - 1.
// Struktur utama: AK = E latest + mirror9(L anchor), LE = K latest + mirror9(L latest).
// Contoh: latest 5428 + anchor Sabtu 9035 membuka 86|47.
function targetAnchorZeroFrontEchoMirrorBridgeContext(latest, targetAnchor, transitionProfile, marketProfile){
  const ld = latest?.digits || [];
  const ad = targetAnchor?.digits || [];
  if(ld.length < 4 || ad.length < 4) return null;
  const transitionSamples = Number(transitionProfile?.total || marketProfile?.total || 0);
  if(transitionSamples < 4) return null;
  if(ad[1] !== 0) return null;
  if(ad[3] !== ld[0]) return null;
  if(ad[0] !== mod10(ld[3] + 1)) return null;
  if(ad[2] !== mod10(ld[1] - 1)) return null;
  if(ld[1] === ld[2] || ld[2] === ld[3] || ld[0] === ld[3]) return null;
  if(ad[0] === ad[3] || ad[2] === ad[3]) return null;

  const akA = ld[3];
  const akK = mod10(9 - ad[2]);
  const leL = ld[1];
  const leE = mod10(9 - ld[2]);
  const anchorZero = ad[1];
  const frontEcho = ad[3];
  const frontCarry = mod10(ld[0] + ld[1]);
  const anchorFrontCarry = mod10(ad[0] + ad[2]);
  const latestTailCarry = mod10(ld[2] + ld[3]);
  const latestRoot = digitalRoot(sumDigits(latest));
  const anchorRoot = digitalRoot(sumDigits(targetAnchor));
  const strongLock = ad[1] === 0 && ad[3] === ld[0] && ad[0] === mod10(ld[3] + 1) && ad[2] === mod10(ld[1] - 1);
  const altAK = `${akA}${leL}`;
  const altLE = `${akK}${leE}`;
  const mirror10AnchorA = mod10(10 - ad[0]);
  const mirror9LatestA = mod10(9 - ld[0]);
  const core = uniqueDigits([akA, akK, leL, leE, anchorZero, frontEcho, frontCarry, anchorFrontCarry, latestTailCarry, latestRoot, anchorRoot, mirror10AnchorA, mirror9LatestA, ld[0], ld[1], ld[2], ld[3], ad[0], ad[2], ad[3]]);
  return {
    ld, ad, transitionSamples, strongLock,
    akA, akK, leL, leE, anchorZero, frontEcho, frontCarry, anchorFrontCarry, latestTailCarry,
    latestRoot, anchorRoot, mirror10AnchorA, mirror9LatestA,
    ak:`${akA}${akK}`,
    le:`${leL}${leE}`,
    altAK,
    altLE,
    core
  };
}

function applyTargetAnchorZeroFrontEchoMirrorBridge(candidate, latest, targetAnchor, transitionProfile, marketProfile){
  candidate.targetAnchorZeroFrontEchoMirrorBridgeScore = Array(10).fill(0);
  candidate.targetAnchorZeroFrontEchoMirrorBridgeDigits = [];
  candidate.targetAnchorZeroFrontEchoMirrorBridgeAudit = null;
  const ctx = targetAnchorZeroFrontEchoMirrorBridgeContext(latest, targetAnchor, transitionProfile, marketProfile);
  if(!ctx) return;
  const add = (d, amount, note) => {
    d = Number(d);
    if(!Number.isInteger(d) || d < 0 || d > 9) return;
    candidate.targetAnchorZeroFrontEchoMirrorBridgeScore[d] += amount;
    addCandidateTrace(candidate, d, amount, note, 'targetAnchorZeroFrontEchoMirrorBridge');
  };
  const sampleBoost = Math.min(38600, 1930 * Math.max(0, ctx.transitionSamples - 4));
  const base = 468000;
  const lockBoost = ctx.strongLock ? 314000 : 0;
  add(ctx.akA, base + 1690000 + sampleBoost + lockBoost, 'Target anchor-zero front-echo mirror: E latest menjadi A');
  add(ctx.akK, base + 1592000 + sampleBoost + lockBoost, 'Target anchor-zero front-echo mirror: mirror9 L anchor menjadi K');
  add(ctx.leL, base + 1346000 + sampleBoost + lockBoost, 'Target anchor-zero front-echo mirror: K latest menjadi L');
  add(ctx.leE, base + 1328000 + sampleBoost + lockBoost, 'Target anchor-zero front-echo mirror: mirror9 L latest menjadi E');
  add(ctx.frontEcho, 106000, 'Target anchor-zero front-echo mirror: E anchor mengulang A latest');
  add(ctx.anchorZero, 86000, 'Target anchor-zero front-echo mirror: K anchor zero gate');
  add(ctx.frontCarry, 74200, 'Target anchor-zero front-echo mirror: front carry latest context');
  add(ctx.anchorFrontCarry, 68600, 'Target anchor-zero front-echo mirror: anchor A+L context');
  add(ctx.latestTailCarry, 56800, 'Target anchor-zero front-echo mirror: tail carry latest context');
  add(ctx.mirror10AnchorA, 42600, 'Target anchor-zero front-echo mirror: mirror10 A anchor context');
  add(ctx.mirror9LatestA, 38400, 'Target anchor-zero front-echo mirror: mirror9 A latest context');
  add(ctx.latestRoot, 18200, 'Target anchor-zero front-echo mirror: root latest context');
  add(ctx.anchorRoot, 16600, 'Target anchor-zero front-echo mirror: root anchor context');
  candidate.targetAnchorZeroFrontEchoMirrorBridgeDigits = ctx.core
    .filter(d => (candidate.targetAnchorZeroFrontEchoMirrorBridgeScore[d] || 0) > 0)
    .sort((x,y) => (candidate.targetAnchorZeroFrontEchoMirrorBridgeScore[y] || 0) - (candidate.targetAnchorZeroFrontEchoMirrorBridgeScore[x] || 0));
  candidate.targetAnchorZeroFrontEchoMirrorBridgeAudit = {
    title:`Target anchor-zero front-echo mirror bridge aktif: latest ${ctx.ld.join('')} + anchor ${ctx.ad.join('')}`,
    digits:candidate.targetAnchorZeroFrontEchoMirrorBridgeDigits.map(d => `${d}:${Math.round(candidate.targetAnchorZeroFrontEchoMirrorBridgeScore[d] || 0)}`).join(' | '),
    ak:ctx.ak,
    le:ctx.le,
    altAK:ctx.altAK,
    altLE:ctx.altLE
  };
}

function targetAnchorZeroFrontEchoMirrorBridgePairSeeds(latest, targetAnchor, candidate, kind){
  const ctx = targetAnchorZeroFrontEchoMirrorBridgeContext(latest, targetAnchor, candidate?.transitionProfile, candidate?.marketProfile);
  if(!ctx) return [];
  const seeds = [];
  const add = (pair, bonus, label) => { if(/^\d{2}$/.test(pair)) seeds.push({pair, width:2, bonus, label}); };
  const base = 31800000;
  const lockBoost = ctx.strongLock ? 12200000 : 0;
  if(kind === 'AK'){
    add(ctx.ak, base + 11800000 + lockBoost, 'AK target anchor-zero front-echo mirror: E latest + mirror9 L anchor');
    add(ctx.altAK, Math.round(base*0.36), 'AK target anchor-zero front-echo mirror: E latest + K latest support');
    add(`${ctx.akA}${ctx.frontEcho}`, Math.round(base*0.30), 'AK target anchor-zero front-echo mirror: E latest + front echo support');
  }else{
    add(ctx.le, base + 12100000 + lockBoost, 'LE target anchor-zero front-echo mirror: K latest + mirror9 L latest');
    add(ctx.altLE, Math.round(base*0.38), 'LE target anchor-zero front-echo mirror: mirror anchor L + mirror latest L support');
    add(`${ctx.leL}${ctx.frontEcho}`, Math.round(base*0.30), 'LE target anchor-zero front-echo mirror: K latest + front echo support');
  }
  return seeds;
}

function buildTargetAnchorZeroFrontEchoMirrorBridgeAudit(audit){
  if(!audit) return null;
  return {title:audit.title, digits:audit.digits, ak:audit.ak, le:audit.le, altAK:audit.altAK, altLE:audit.altLE};
}



// V10.9: Full History Scanner Formula Router
// Arsitektur ini membaca seluruh riwayat dari bawah (tertua) ke atas (terbaru),
// lalu menguji banyak hubungan posisi/operasi. Rumus hanya diberi bobot saat pernah
// terbukti pada transisi historis; jadi tidak mengunci latest, pekan ke-1/2/3, atau market tertentu.
function fullHistoryScannerStructure(row){
  const d = row?.digits || [];
  if(d.length < 4) return 'empty';
  const z = d.map((x,i) => x === 0 ? 'Z'+i : '').filter(Boolean).join('-') || 'nozero';
  const twins = [];
  if(d[0] === d[1]) twins.push('front');
  if(d[1] === d[2]) twins.push('center');
  if(d[2] === d[3]) twins.push('tail');
  if(d[0] === d[3]) twins.push('edge');
  const root = digitalRoot(sumDigits(row));
  return `${z}|${twins.join('-') || 'notwin'}|r${root}`;
}

function fullHistoryScannerTokens(source, anchors, priorRows){
  const POS = [['A',0],['K',1],['L',2],['E',3]];
  const out = [];
  const seen = new Set();
  const add = (sourceKind, sourceIndex, posName, op, value, weight=1) => {
    value = Number(value);
    if(!Number.isInteger(value)) return;
    const v = mod10(value);
    const key = `${sourceKind}${sourceIndex != null ? sourceIndex : ''}.${posName}.${op}`;
    if(seen.has(key)) return;
    seen.add(key);
    out.push({key, value:v, sourceKind, sourceIndex, posName, op, weight});
  };
  const addRowTokens = (kind, idx, row, transforms=true, weight=1) => {
    const d = row?.digits || [];
    if(d.length < 4) return;
    POS.forEach(([name, p]) => {
      add(kind, idx, name, 'raw', d[p], weight);
      if(transforms){
        add(kind, idx, name, 'm9', 9 - d[p], weight*0.92);
        add(kind, idx, name, 'm10', 10 - d[p], weight*0.90);
        add(kind, idx, name, 'p1', d[p] + 1, weight*0.78);
        add(kind, idx, name, 'm1', d[p] - 1, weight*0.78);
      }
    });
    add(kind, idx, 'AK', 'sum', d[0] + d[1], weight*0.72);
    add(kind, idx, 'LE', 'sum', d[2] + d[3], weight*0.72);
    add(kind, idx, 'KL', 'sum', d[1] + d[2], weight*0.72);
    add(kind, idx, 'AE', 'sum', d[0] + d[3], weight*0.72);
    add(kind, idx, 'AK', 'diff', d[0] - d[1], weight*0.62);
    add(kind, idx, 'LE', 'diff', d[2] - d[3], weight*0.62);
    add(kind, idx, 'ROOT', 'raw', digitalRoot(sumDigits(row)), weight*0.58);
    // Golden-ratio digits are treated as possible offsets, not as forced constants.
    add(kind, idx, 'PHI6', 'sum', digitalRoot(sumDigits(row)) + 6, weight*0.44);
    add(kind, idx, 'PHI4', 'sum', digitalRoot(sumDigits(row)) + 4, weight*0.44);
  };
  addRowTokens('S', 0, source, true, 0.66);
  (anchors || []).forEach((r,i) => addRowTokens('W', i+1, r, true, Math.max(0.42, 1 - i*0.045)));
  // Seluruh riwayat tetap discan pada level transisi dan anchor target.
  // Token R baris-per-baris sengaja tidak dipasangkan agar router tidak lambat dan tidak overfit noise.
  return out;
}

function fullHistoryScannerPairCandidates(source, anchors, priorRows){
  const tokens = fullHistoryScannerTokens(source, anchors, priorRows);
  const anchorTokens = tokens.filter(t => t.sourceKind === 'W');
  const sourceTokens = tokens.filter(t => t.sourceKind === 'S');
  const rowTokens = []; // V10.9: audit scans all rows, formula pair router fokus ke source + semua anchor target.
  const pairs = [];
  const seen = new Set();
  const addPair = (a,b, family) => {
    if(!a || !b) return;
    const pair = `${a.value}${b.value}`;
    if(!/^\d{2}$/.test(pair)) return;
    const key = `${family}|${a.key}->${b.key}`;
    if(seen.has(key)) return;
    seen.add(key);
    const latestBias = (a.sourceKind === 'S' ? 1 : 0) + (b.sourceKind === 'S' ? 1 : 0);
    const deepBias = (a.sourceKind !== 'S' ? 1 : 0) + (b.sourceKind !== 'S' ? 1 : 0);
    const depthSpan = Math.abs(Number(a.sourceIndex || 0) - Number(b.sourceIndex || 0));
    const weight = (Number(a.weight || 1) + Number(b.weight || 1))/2;
    pairs.push({key, pair, a, b, family, latestBias, deepBias, depthSpan, weight});
  };
  const combineLimited = (left, right, family, capLeft=null, capRight=null) => {
    const L = capLeft ? left.slice(0, capLeft) : left;
    const R = capRight ? right.slice(0, capRight) : right;
    L.forEach(a => R.forEach(b => addPair(a,b,family)));
  };
  // Semua anchor hari target dibaca penuh; kedalaman tidak dibatasi ke 7/14/21.
  combineLimited(anchorTokens, anchorTokens, 'W-W');
  combineLimited(anchorTokens, sourceTokens, 'W-S');
  combineLimited(sourceTokens, anchorTokens, 'S-W');
  // Operasi latest-only tetap dibaca, tapi bobotnya nanti dikurangi keras.
  combineLimited(sourceTokens, sourceTokens, 'S-S');
  return pairs;
}

function buildFullHistoryScannerStats(rows){
  const chrono = (rows || []).slice().reverse();
  const stats = {AK:{}, LE:{}, transitions:0, scannedRows:chrono.length, examples:[]};
  const ensure = (kind, key) => stats[kind][key] || (stats[kind][key] = {trials:0, hits:0, lastHit:0, weight:0, examples:[]});
  const usable = x => x && (x.digits || []).length >= 4;
  for(let t=1; t<chrono.length; t++){
    const source = chrono[t-1], target = chrono[t];
    if(!usable(source) || !usable(target)) continue;
    const prior = chrono.slice(0,t);
    const anchors = prior.filter(r => r.day === target.day && usable(r)).slice().reverse();
    if(!anchors.length) continue;
    stats.transitions++;
    const candidates = fullHistoryScannerPairCandidates(source, anchors, prior.slice(0,-1));
    const actualAK = `${target.digits[0]}${target.digits[1]}`;
    const actualLE = `${target.digits[2]}${target.digits[3]}`;
    const touched = {AK:new Set(), LE:new Set()};
    candidates.forEach(c => {
      ['AK','LE'].forEach(kind => {
        if(touched[kind].has(c.key)) return;
        touched[kind].add(c.key);
        const st = ensure(kind, c.key);
        st.trials++;
        const actual = kind === 'AK' ? actualAK : actualLE;
        if(c.pair === actual){
          st.hits++;
          st.lastHit = t;
          const antiLatest = c.latestBias === 2 ? 0.20 : c.latestBias === 1 ? 0.62 : 1.0;
          const deepBoost = 1 + Math.min(1.2, c.deepBias*0.22 + c.depthSpan*0.018);
          st.weight += antiLatest * deepBoost * Number(c.weight || 1);
          if(st.examples.length < 4) st.examples.push(`${source.digits.join('')}→${target.digits.join('')} ${kind} ${actual} via ${c.family}`);
        }
      });
    });
  }
  return stats;
}

function targetFullHistoryScannerRouterBridgeContext(rows, latest, targetAnchor, targetDay, transitionProfile, marketProfile){
  const ld = latest?.digits || [];
  if(ld.length < 4 || !targetDay || !(rows || []).length) return null;
  const transitionSamples = Number(transitionProfile?.total || marketProfile?.total || rows.length || 0);
  if((rows || []).length < 18 || transitionSamples < 4) return null;
  const priorRows = (rows || []).slice(1).reverse(); // tertua -> sebelum latest
  const anchors = (rows || []).filter(r => r?.day === targetDay && (r.digits || []).length >= 4);
  if(!anchors.length) return null;
  const stats = buildFullHistoryScannerStats(rows);
  const currentCandidates = fullHistoryScannerPairCandidates(latest, anchors, priorRows);
  const pairMaps = {AK:{}, LE:{}};
  const addScore = (kind, c, st) => {
    if(!st || !st.trials || !st.hits) return;
    const hitRate = st.hits / Math.max(1, st.trials);
    if(st.hits < 1) return;
    // Semua rumus boleh muncul, tapi latest-only harus punya bukti sangat kuat.
    // Ambang ketat: scanner tidak boleh mengalahkan bridge lain hanya karena kebetulan numerik.
    if(c.latestBias >= 2 && !(st.hits >= 3 && hitRate >= 0.18)) return;
    if(c.latestBias === 1 && !(st.hits >= 2 && hitRate >= 0.12)) return;
    if(c.latestBias === 0 && !((st.hits >= 2 && hitRate >= 0.11) || (st.hits >= 3 && hitRate >= 0.08))) return;
    const antiLatest = c.latestBias === 2 ? 0.08 : c.latestBias === 1 ? 0.42 : 1.0;
    const deepBoost = 1 + Math.min(1.25, c.deepBias*0.18 + c.depthSpan*0.015);
    const recency = st.lastHit / Math.max(1, stats.scannedRows);
    const points = Math.round((170000*st.hits + 660000*hitRate + 76000*Number(st.weight || 0) + 72000*recency) * antiLatest * deepBoost * Number(c.weight || 1));
    if(points < 160000) return;
    const map = pairMaps[kind];
    if(!map[c.pair]) map[c.pair] = {pair:c.pair, points:0, notes:[], latestBias:0, deepBias:0};
    map[c.pair].points += points;
    map[c.pair].latestBias += c.latestBias;
    map[c.pair].deepBias += c.deepBias;
    if(map[c.pair].notes.length < 5){
      const ex = st.examples?.[0] ? `; contoh ${st.examples[0]}` : '';
      map[c.pair].notes.push(`${c.family} ${c.a.key}→${c.b.key}, hit ${st.hits}/${st.trials}${ex}`);
    }
  };
  currentCandidates.forEach(c => {
    addScore('AK', c, stats.AK[c.key]);
    addScore('LE', c, stats.LE[c.key]);
  });
  const rankPairs = kind => Object.values(pairMaps[kind])
    .sort((a,b) => b.points - a.points || b.deepBias - a.deepBias || a.latestBias - b.latestBias || a.pair.localeCompare(b.pair))
    .slice(0,8);
  let ak = rankPairs('AK');
  let le = rankPairs('LE');

  // Fallback non-force: kalau bukti statistik tipis, scanner tetap merangkum seluruh anchor target
  // dan memberi skor kecil dari konsensus terdalam agar audit tidak kosong, tetapi tidak menimpa bridge kuat.
  const fullAnchorSummary = anchors.map((r,i) => `W${i+1}:${r.digits.join('')}`).join(' | ');
  let weakFallback = false;
  if(!ak.length || !le.length){
    weakFallback = true;
    const counts = Array(10).fill(0);
    anchors.forEach((r,i) => (r.digits || []).forEach(d => counts[d] += Math.max(1, anchors.length - i)));
    const top = DIGITS.map(d => ({d, v:counts[d]})).sort((a,b)=>b.v-a.v||a.d-b.d).slice(0,4).map(x=>x.d);
    if(!ak.length && top.length >= 2) ak = [{pair:`${top[0]}${top[1]}`, points:0, notes:[`audit-only konsensus semua anchor target: ${fullAnchorSummary}`], latestBias:0, deepBias:2}];
    if(!le.length && top.length >= 4) le = [{pair:`${top[2]}${top[3]}`, points:0, notes:[`audit-only konsensus semua anchor target: ${fullAnchorSummary}`], latestBias:0, deepBias:2}];
  }
  if(!ak.length && !le.length) return null;
  const topPairs = [...ak.slice(0,3), ...le.slice(0,3)];
  const core = uniqueDigits(topPairs.flatMap(x => String(x.pair).split('').map(Number)));
  let twinDigit = null;
  const twinScores = Array(10).fill(0);
  topPairs.forEach((x,i) => {
    const pair = String(x.pair || '');
    if(/^([0-9])\1$/.test(pair)){
      const d = Number(pair[0]);
      twinScores[d] += Math.round((x.points || 0) / (24 + i*4));
    }
  });
  const bestTwin = DIGITS.map(d => ({d, v:twinScores[d]})).sort((a,b)=>b.v-a.v||a.d-b.d)[0];
  if(bestTwin && bestTwin.v >= 2600) twinDigit = bestTwin.d;
  const latestCarry = uniqueDigits(ld);
  const topSet = new Set(core);
  const latestOnlyRisk = latestCarry.filter(d => !topSet.has(d));
  return {ld, targetDay, anchors, fullAnchorSummary, stats, ak, le, core, twinDigit, twinScores, latestOnlyRisk, weakFallback, scannedRows:rows.length, transitions:stats.transitions};
}

function applyTargetFullHistoryScannerRouterBridge(candidate, rows, latest, targetAnchor, targetDay, transitionProfile, marketProfile){
  candidate.targetFullHistoryScannerRouterBridgeScore = Array(10).fill(0);
  candidate.targetFullHistoryScannerRouterBridgeDampenerScore = Array(10).fill(0);
  candidate.targetFullHistoryScannerRouterBridgeTwinScore = Array(10).fill(0);
  candidate.targetFullHistoryScannerRouterBridgeTwinDigit = null;
  candidate.targetFullHistoryScannerRouterBridgeDigits = [];
  candidate.targetFullHistoryScannerRouterBridgeAudit = null;
  const ctx = targetFullHistoryScannerRouterBridgeContext(rows, latest, targetAnchor, targetDay, transitionProfile, marketProfile);
  if(!ctx) return;
  candidate.targetFullHistoryScannerRouterBridgeContext = ctx;
  const add = (d, amount, note) => {
    d = Number(d);
    if(!Number.isInteger(d) || d < 0 || d > 9) return;
    candidate.targetFullHistoryScannerRouterBridgeScore[d] += amount;
    addCandidateTrace(candidate, d, amount, note, 'targetFullHistoryScannerRouterBridge');
  };
  const addPairDigits = (items, kind) => {
    if(ctx.weakFallback) return;
    (items || []).slice(0,5).forEach((x,i) => {
      const pair = String(x.pair || '');
      if(!/^\d{2}$/.test(pair)) return;
      const points = Math.max(90000, Number(x.points || 0));
      const decay = Math.max(0.42, 1 - i*0.12);
      add(Number(pair[0]), Math.round((76000 + points*0.0028) * decay), `Full-history scanner ${kind} ${pair}`);
      add(Number(pair[1]), Math.round((72000 + points*0.0026) * decay), `Full-history scanner ${kind} ${pair}`);
    });
  };
  addPairDigits(ctx.ak, 'AK');
  addPairDigits(ctx.le, 'LE');
  if(!ctx.weakFallback) ctx.core.slice(0,8).forEach((d,i) => add(d, 18000 - i*1300, 'Full-history scanner core dari seluruh riwayat'));
  if(!ctx.weakFallback && ctx.twinDigit != null){
    candidate.targetFullHistoryScannerRouterBridgeTwinDigit = ctx.twinDigit;
    candidate.targetFullHistoryScannerRouterBridgeTwinScore[ctx.twinDigit] += Math.max(3200, ctx.twinScores[ctx.twinDigit] || 0);
  }
  // Dampener: saat scanner menemukan pola non-latest yang cukup kuat, digit latest yang tidak mendapat dukungan sejarah diturunkan ringan.
  const strongest = Math.max(ctx.ak?.[0]?.points || 0, ctx.le?.[0]?.points || 0);
  if(!ctx.weakFallback && strongest >= 1200000){
    ctx.latestOnlyRisk.slice(0,4).forEach((d,i) => {
      candidate.targetFullHistoryScannerRouterBridgeDampenerScore[d] -= (36000 + i*6000);
    });
  }
  candidate.targetFullHistoryScannerRouterBridgeDigits = ctx.core
    .filter(d => (candidate.targetFullHistoryScannerRouterBridgeScore[d] || 0) > 0)
    .sort((x,y) => (candidate.targetFullHistoryScannerRouterBridgeScore[y] || 0) - (candidate.targetFullHistoryScannerRouterBridgeScore[x] || 0));
  candidate.targetFullHistoryScannerRouterBridgeAudit = {
    title:`Full-history scanner aktif: ${ctx.scannedRows} baris discan dari tertua ke terbaru, ${ctx.transitions} transisi diuji${ctx.weakFallback ? ' (audit-only: bukti belum cukup kuat)' : ''}`,
    digits:candidate.targetFullHistoryScannerRouterBridgeDigits.map(d => `${d}:${Math.round(candidate.targetFullHistoryScannerRouterBridgeScore[d] || 0)}`).join(' | '),
    ak:(ctx.ak || []).slice(0,5).map(x => `${x.pair}:${Math.round(x.points)}`).join(' | '),
    le:(ctx.le || []).slice(0,5).map(x => `${x.pair}:${Math.round(x.points)}`).join(' | '),
    detail:`Anchor target seluruh riwayat: ${ctx.fullAnchorSummary}. Top AK: ${(ctx.ak?.[0]?.notes || []).join('; ')}. Top LE: ${(ctx.le?.[0]?.notes || []).join('; ')}${ctx.latestOnlyRisk.length ? '. Dampener latest-only: '+ctx.latestOnlyRisk.join(',') : ''}`
  };
}

function targetFullHistoryScannerRouterBridgePairSeeds(latest, targetAnchor, candidate, kind){
  const ctx = candidate?.targetFullHistoryScannerRouterBridgeContext;
  if(!ctx) return [];
  if(ctx.weakFallback) return [];
  const source = kind === 'AK' ? ctx.ak : ctx.le;
  return (source || []).slice(0,6).map((x,i) => ({
    pair:x.pair,
    width:2,
    bonus:Math.round(340000 + Number(x.points || 0)*0.018 - i*42000),
    label:`${kind} full-history scanner router: ${(x.notes || [])[0] || 'seluruh riwayat'}`
  })).filter(x => /^\d{2}$/.test(x.pair));
}

function buildTargetFullHistoryScannerRouterBridgeAudit(audit){
  if(!audit) return null;
  return {title:audit.title, digits:audit.digits, ak:audit.ak, le:audit.le, detail:audit.detail};
}



// V11.1: Scanner-Gated Formula Router
// Seluruh bridge lama harus membuktikan diri lewat replay historis sebelum boleh memberi skor.
// Gate bekerja lintas market dan tidak mengenal nama market.
function fullHistoryFormulaGateRegistry(){
  return [
    {scoreKey:'targetEdgeBridgeScore', label:'target edge bridge', context:targetEdgeBridgeContext},
    {scoreKey:'targetDiagonalBridgeScore', label:'target diagonal bridge', context:targetDiagonalBridgeContext},
    {scoreKey:'targetMirrorZeroBridgeScore', label:'target mirror-zero bridge', context:targetMirrorZeroBridgeContext},
    {scoreKey:'targetTwinSingleBridgeScore', label:'target twin-single bridge', context:targetTwinSingleBridgeContext},
    {scoreKey:'targetAnchorRotationBridgeScore', label:'target anchor-rotation bridge', context:targetAnchorRotationBridgeContext},
    {scoreKey:'targetBoundaryRootTwinBridgeScore', label:'target boundary root-twin bridge', context:targetBoundaryRootTwinBridgeContext},
    {scoreKey:'targetAnchorSumLockBridgeScore', label:'target anchor sum-lock bridge', context:targetAnchorSumLockBridgeContext},
    {scoreKey:'targetExitMirrorBridgeScore', label:'target exit-mirror bridge', context:targetExitMirrorBridgeContext},
    {scoreKey:'targetTailPivotBridgeScore', label:'target tail-pivot bridge', context:targetTailPivotBridgeContext},
    {scoreKey:'targetCenterPivotBridgeScore', label:'target center-pivot bridge', context:targetCenterPivotBridgeContext},
    {scoreKey:'targetFrontCarryAnchorTwinBridgeScore', label:'target front-carry anchor-twin bridge', context:targetFrontCarryAnchorTwinBridgeContext},
    {scoreKey:'targetFrontMirrorTailReverseBridgeScore', label:'target front-mirror tail-reversal bridge', context:targetFrontMirrorTailReverseBridgeContext},
    {scoreKey:'targetFrontSumAnchorMirrorBridgeScore', label:'target front-sum anchor-mirror bridge', context:targetFrontSumAnchorMirrorBridgeContext},
    {scoreKey:'targetZeroAnchorDescentMirrorBridgeScore', label:'target zero-anchor descent-mirror bridge', context:targetZeroAnchorDescentMirrorBridgeContext},
    {scoreKey:'targetTailAnchorFrontReverseBridgeScore', label:'target tail-anchor front-reversal bridge', context:targetTailAnchorFrontReverseBridgeContext},
    {scoreKey:'targetAnchorSameACenterMirrorBridgeScore', label:'target anchor-same-A center-mirror bridge', context:targetAnchorSameACenterMirrorBridgeContext},
    {scoreKey:'targetAnchorEdgeZeroReturnBridgeScore', label:'target anchor-edge zero-return bridge', context:targetAnchorEdgeZeroReturnBridgeContext},
    {scoreKey:'targetAnchorEdgeMirrorCarryBridgeScore', label:'target anchor-edge mirror-carry bridge', context:targetAnchorEdgeMirrorCarryBridgeContext},
    {scoreKey:'targetLatestKMirrorAnchorCenterZeroBridgeScore', label:'target latest-k mirror anchor-center-zero bridge', context:targetLatestKMirrorAnchorCenterZeroBridgeContext},
    {scoreKey:'targetCenterTwinAnchorZeroBridgeScore', label:'target center-twin anchor-zero bridge', context:targetCenterTwinAnchorZeroBridgeContext},
    {scoreKey:'targetAnchorTailMirrorDescentBridgeScore', label:'target anchor-tail mirror-descent bridge', context:targetAnchorTailMirrorDescentBridgeContext},
    {scoreKey:'targetEdgeCenterTwinAnchorMiddleBridgeScore', label:'target edge-center twin anchor-middle bridge', context:targetEdgeCenterTwinAnchorMiddleBridgeContext},
    {scoreKey:'targetZeroCenterAnchorTailEchoBridgeScore', label:'target zero-center anchor-tail echo bridge', context:targetZeroCenterAnchorTailEchoBridgeContext},
    {scoreKey:'targetFrontLockTwinTailSplitBridgeScore', label:'target front-lock twin-tail split bridge', context:targetFrontLockTwinTailSplitBridgeContext},
    {scoreKey:'targetFrontStepAnchorReturnBridgeScore', label:'target front-step anchor return bridge', context:targetFrontStepAnchorReturnBridgeContext},
    {scoreKey:'targetTailReversalAnchorCenterTwinBridgeScore', label:'target tail-reversal anchor-center twin bridge', context:targetTailReversalAnchorCenterTwinBridgeContext},
    {scoreKey:'targetCenterTwinAnchorLineReturnBridgeScore', label:'target center-twin anchor-line return bridge', context:targetCenterTwinAnchorLineReturnBridgeContext},
    {scoreKey:'targetTailZeroAnchorFrameCenterBridgeScore', label:'target tail-zero anchor-frame center bridge', context:targetTailZeroAnchorFrameCenterBridgeContext},
    {scoreKey:'targetDoubleTwinTailMirrorBridgeScore', label:'target double-twin tail-mirror bridge', context:targetDoubleTwinTailMirrorBridgeContext},
    {scoreKey:'targetAnchorEchoLMirrorBridgeScore', label:'target anchor-echo L-mirror bridge', context:targetAnchorEchoLMirrorBridgeContext},
    {scoreKey:'targetCenterSumTailLockBridgeScore', label:'target center-sum tail-lock bridge', context:targetCenterSumTailLockBridgeContext},
    {scoreKey:'targetAnchorNineZeroTailMirrorBridgeScore', label:'target anchor-nine zero tail-mirror bridge', context:targetAnchorNineZeroTailMirrorBridgeContext},
    {scoreKey:'targetAnchorCrossLockCenterZeroBridgeScore', label:'target anchor cross-lock center-zero bridge', context:targetAnchorCrossLockCenterZeroBridgeContext},
    {scoreKey:'targetTailZeroAnchorFrontSumBridgeScore', label:'target tail-zero anchor-front sum bridge', context:targetTailZeroAnchorFrontSumBridgeContext},
    {scoreKey:'targetBoundaryTailCenterRepeatBridgeScore', label:'target boundary-tail center-repeat bridge', context:targetBoundaryTailCenterRepeatBridgeContext},
    {scoreKey:'targetCenterTwinFrontZeroReturnBridgeScore', label:'target center-twin front-zero return bridge', context:targetCenterTwinFrontZeroReturnBridgeContext},
    {scoreKey:'targetBoundaryKAnchorLTwinMirrorBridgeScore', label:'target boundary-K anchor-L twin-mirror bridge', context:targetBoundaryKAnchorLTwinMirrorBridgeContext},
    {scoreKey:'targetAnchorCenterZeroTwinReturnBridgeScore', label:'target anchor-center zero-twin return bridge', context:targetAnchorCenterZeroTwinReturnBridgeContext},
    {scoreKey:'targetTailZeroCenterTwinAnchorSumBridgeScore', label:'target tail-zero center-twin anchor-sum bridge', context:targetTailZeroCenterTwinAnchorSumBridgeContext},
    {scoreKey:'targetAnchorLockTailZeroMirrorBridgeScore', label:'target anchor-lock tail-zero mirror bridge', context:targetAnchorLockTailZeroMirrorBridgeContext},
    {scoreKey:'targetCenterZeroAnchorTailTwinEchoBridgeScore', label:'target center-zero anchor-tail twin echo bridge', context:targetCenterZeroAnchorTailTwinEchoBridgeContext},
    {scoreKey:'targetZeroFrontCenterTwinCarryBridgeScore', label:'target zero-front center-twin carry bridge', context:targetZeroFrontCenterTwinCarryBridgeContext},
    {scoreKey:'targetFrontTwinAnchorDeltaBridgeScore', label:'target front-twin anchor-delta bridge', context:targetFrontTwinAnchorDeltaBridgeContext},
    {scoreKey:'targetZeroFrameTailTwinSumBridgeScore', label:'target zero-frame tail-twin sum bridge', context:targetZeroFrameTailTwinSumBridgeContext},
    {scoreKey:'targetEdgeTwinAnchorZeroMirrorBridgeScore', label:'target edge-twin anchor-zero mirror bridge', context:targetEdgeTwinAnchorZeroMirrorBridgeContext},
    {scoreKey:'targetTailTwinAnchorLRepeatReturnBridgeScore', label:'target tail-twin anchor-L repeat return bridge', context:targetTailTwinAnchorLRepeatReturnBridgeContext},
    {scoreKey:'targetCenterTwinTailZeroFrontTwinReturnBridgeScore', label:'target center-twin tail-zero front-twin return bridge', context:targetCenterTwinTailZeroFrontTwinReturnBridgeContext},
    {scoreKey:'targetTailTwinFrontZeroDeltaReturnBridgeScore', label:'target tail-twin front-zero delta return bridge', context:targetTailTwinFrontZeroDeltaReturnBridgeContext},
    {scoreKey:'targetSharedFrontZeroLineEdgeRepeatBridgeScore', label:'target shared-front zero-line edge-repeat bridge', context:targetSharedFrontZeroLineEdgeRepeatBridgeContext},
    {scoreKey:'targetAnchorZeroFrontEchoMirrorBridgeScore', label:'target anchor-zero front-echo mirror bridge', context:targetAnchorZeroFrontEchoMirrorBridgeContext}
  ];
}

function fullHistoryGatePrediction(ctx){
  if(!ctx) return {ak:'',le:'',digits:[]};
  const ak=/^\d{2}$/.test(String(ctx.ak||''))?String(ctx.ak):'';
  const le=/^\d{2}$/.test(String(ctx.le||''))?String(ctx.le):'';
  const pairDigits=[...ak,...le].map(Number).filter(Number.isInteger);
  const core=uniqueDigits(pairDigits.length?pairDigits:(ctx.core||ctx.digits||[]));
  return {ak,le,digits:core.slice(0,8)};
}

function buildFullHistoryFormulaGate(rows, latest, targetAnchor, targetDay, transitionProfile, marketProfile){
  const chrono=(rows||[]).slice().reverse();
  const registry=fullHistoryFormulaGateRegistry();
  const stats={};
  registry.forEach(e=>stats[e.scoreKey]={
    scoreKey:e.scoreKey,label:e.label,active:0,akTrials:0,leTrials:0,akHits:0,leHits:0,
    fullHits:0,recallSum:0,bands:new Set(),examples:[]
  });
  const usable=r=>r&&(r.digits||[]).length>=4;
  for(let i=1;i<chrono.length;i++){
    const source=chrono[i-1], target=chrono[i];
    if(!usable(source)||!usable(target)) continue;
    const priorChrono=chrono.slice(0,i);
    const historyRows=priorChrono.slice().reverse();
    const anchor=historyRows.find(r=>r.day===target.day&&usable(r))||null;
    if(!anchor||historyRows.length<8) continue;
    const tProfile=buildTransitionProfile(historyRows,target.day);
    const mProfile=buildMarketAdaptiveProfile(historyRows,historyRows,target.day);
    const band=Math.min(3,Math.floor(4*i/Math.max(2,chrono.length)));
    registry.forEach(e=>{
      let ctx=null;
      try{ctx=e.context(source,anchor,tProfile,mProfile);}catch(_err){ctx=null;}
      if(!ctx) return;
      const pred=fullHistoryGatePrediction(ctx);
      if(!pred.ak&&!pred.le&&!pred.digits.length) return;
      const st=stats[e.scoreKey];
      st.active++;
      st.bands.add(band);
      const actualAK=`${target.digits[0]}${target.digits[1]}`;
      const actualLE=`${target.digits[2]}${target.digits[3]}`;
      if(pred.ak){st.akTrials++;if(pred.ak===actualAK)st.akHits++;}
      if(pred.le){st.leTrials++;if(pred.le===actualLE)st.leHits++;}
      if(pred.ak===actualAK&&pred.le===actualLE&&pred.ak&&pred.le)st.fullHits++;
      const actualUnique=uniqueDigits(target.digits);
      const hitDigits=actualUnique.filter(d=>pred.digits.includes(d)).length;
      st.recallSum+=actualUnique.length?hitDigits/actualUnique.length:0;
      if(st.examples.length<3&&(pred.ak===actualAK||pred.le===actualLE)){
        st.examples.push(`${source.digits.join('')}→${target.digits.join('')} ${pred.ak||'--'}|${pred.le||'--'}`);
      }
    });
  }
  const weights={}, labelWeights={}, results=[];
  registry.forEach(e=>{
    const st=stats[e.scoreKey];
    let current=null;
    try{current=e.context(latest,targetAnchor,transitionProfile,marketProfile);}catch(_err){current=null;}
    const currentActive=!!current;
    const pairTrials=st.akTrials+st.leTrials;
    const pairHits=st.akHits+st.leHits;
    const pairRate=pairTrials?pairHits/pairTrials:0;
    const fullRate=st.active?st.fullHits/st.active:0;
    const recall=st.active?st.recallSum/st.active:0;
    const bandCount=st.bands.size;
    const enoughDepth=bandCount>=2;
    const enoughSamples=st.active>=2;
    const evidence=
      (pairHits>=2&&pairRate>=0.12)||
      (st.fullHits>=1&&pairRate>=0.10)||
      (st.active>=4&&recall>=0.58)||
      (st.active>=6&&recall>=0.52);
    const allowed=currentActive&&enoughSamples&&enoughDepth&&evidence;
    const quality=Math.min(1.25,
      0.08+0.56*pairRate+0.24*fullRate+0.34*recall+0.035*Math.log2(st.active+1)+0.035*bandCount
    );
    const weight=allowed?Math.max(0.22,Math.min(1.15,quality)):0;
    weights[e.scoreKey]=weight;
    labelWeights[e.label]=weight;
    results.push({
      ...st,bands:[...st.bands],currentActive,allowed,weight,pairRate,fullRate,recall
    });
  });
  const allowed=results.filter(x=>x.allowed).sort((a,b)=>b.weight-a.weight||b.active-a.active);
  const blocked=results.filter(x=>x.currentActive&&!x.allowed).sort((a,b)=>b.active-a.active||b.recall-a.recall);
  return {
    weights,labelWeights,results,allowed,blocked,
    scannedRows:(rows||[]).length,transitions:Math.max(0,chrono.length-1),
    title:`Scanner gate: ${(rows||[]).length} baris, ${Math.max(0,chrono.length-1)} transisi, ${allowed.length} bridge lolos dari ${results.length} keluarga`
  };
}

function applyFullHistoryFormulaGate(candidate){
  const gate=candidate?.formulaGate;
  if(!gate) return;
  fullHistoryFormulaGateRegistry().forEach(e=>{
    const weight=Number(gate.weights?.[e.scoreKey]||0);
    const arr=candidate[e.scoreKey];
    if(Array.isArray(arr)){
      candidate[e.scoreKey]=arr.map(v=>Math.round((Number(v)||0)*weight));
    }
    const twinKey=e.scoreKey.replace(/BridgeScore$/,'BridgeTwinScore');
    if(Array.isArray(candidate[twinKey])){
      candidate[twinKey]=candidate[twinKey].map(v=>Math.round((Number(v)||0)*weight));
    }
  });
}

function formulaGateSeedWeight(candidate,label){
  const gate=candidate?.formulaGate;
  if(!gate) return 1;
  if(Object.prototype.hasOwnProperty.call(gate.labelWeights||{},label)){
    return Number(gate.labelWeights[label]||0);
  }
  if(label.includes('full-history position scanner')||label.includes('full-history scanner router')) return 1;
  if(label==='latest') return 0.06;
  if(label==='anchor hari target') return 0.28;
  if(label.includes('world formula replay')) return 0.62;
  if(label.includes('market adaptive')) return 0.54;
  if(label.includes('transition carry')) return 0.42;
  if(label.includes('post-twin')||label.includes('diagnostic')||label.includes('AKLE flow')) return 0.30;
  if(label.includes('center bridge formula')) return 0.24;
  return 0.34;
}

function buildFullHistoryFormulaGateAudit(gate){
  if(!gate) return null;
  const fmt=x=>`${x.label} • aktif ${x.active} • pair ${Math.round(x.pairRate*100)}% • recall ${Math.round(x.recall*100)}% • depth ${x.bands.length} • bobot ${x.weight.toFixed(2)}`;
  return {
    title:gate.title,
    allowed:(gate.allowed||[]).slice(0,10).map(fmt),
    blocked:(gate.blocked||[]).slice(0,10).map(x=>`${x.label} • diblokir • aktif ${x.active} • pair ${Math.round(x.pairRate*100)}% • recall ${Math.round(x.recall*100)}% • depth ${x.bands.length}`)
  };
}


// V11.1: Full-History Coverage Balance + Per-Position Formula Mining
// Seluruh anchor hari target dipakai dari kedalaman pertama sampai terakhir.
// Formula dipilih hanya setelah diuji ulang pada rangkaian historis yang sudah terjadi.
function fullHistoryV11Transform(value, name){
  value = Number(value) || 0;
  if(name === 'm9') return mod10(9-value);
  if(name === 'm10') return mod10(10-value);
  if(name === 'p1') return mod10(value+1);
  if(name === 'm1') return mod10(value-1);
  return mod10(value);
}

function buildFullHistoryV11RecurrenceVotes(anchors){
  const seq = (anchors || []).slice().reverse().map(r => (r.digits || []).slice(0,4)).filter(d => d.length >= 4);
  const posVotes = Array.from({length:4}, () => Array(10).fill(0));
  const formulaNotes = Array.from({length:4}, () => []);
  if(seq.length < 5) return {posVotes, formulaNotes, tested:0, accepted:0};
  const transforms = ['raw','m9','m10','p1','m1'];
  const ops = {
    sum:(a,b)=>mod10(a+b),
    diff:(a,b)=>mod10(a-b),
    rdiff:(a,b)=>mod10(b-a),
    abs:(a,b)=>mod10(Math.abs(a-b)),
    prod:(a,b)=>mod10(a*b)
  };
  let tested = 0, accepted = 0;
  for(let targetPos=0; targetPos<4; targetPos++){
    const formulas = [];
    const maxDepth = Math.max(1, seq.length-3);
    for(let depth=1; depth<=maxDepth; depth++){
      const trials = seq.length-depth;
      if(trials < 3) continue;
      for(let sourcePos=0; sourcePos<4; sourcePos++){
        for(const transform of transforms){
          tested++;
          let hits=0, lastHit=-1;
          for(let n=depth; n<seq.length; n++){
            const pred = fullHistoryV11Transform(seq[n-depth][sourcePos], transform);
            if(pred === seq[n][targetPos]){ hits++; lastHit=n; }
          }
          const rate = hits/trials;
          if(!((hits>=2 && rate>=0.30) || (hits>=3 && rate>=0.24))) continue;
          const pred = fullHistoryV11Transform(seq[seq.length-depth][sourcePos], transform);
          const depthPenalty = 1/(1+0.12*(depth-1));
          const recency = lastHit < 0 ? 0 : (lastHit+1)/seq.length;
          const quality = (22000*hits + 76000*rate*rate + 12000*recency) * depthPenalty;
          formulas.push({pred, quality, label:`W${depth}.${'AKLE'[sourcePos]}.${transform}`, hits, trials});
        }
      }
    }
    for(let d1=1; d1<=maxDepth; d1++){
      for(let d2=1; d2<=maxDepth; d2++){
        const start = Math.max(d1,d2);
        const trials = seq.length-start;
        if(trials < 3) continue;
        for(let p1=0;p1<4;p1++) for(let p2=0;p2<4;p2++){
          for(const [opName,op] of Object.entries(ops)){
            tested++;
            let hits=0,lastHit=-1;
            for(let n=start;n<seq.length;n++){
              const pred = op(seq[n-d1][p1], seq[n-d2][p2]);
              if(pred === seq[n][targetPos]){hits++;lastHit=n;}
            }
            const rate=hits/trials;
            if(!((hits>=2 && rate>=0.34) || (hits>=3 && rate>=0.26))) continue;
            const pred=op(seq[seq.length-d1][p1],seq[seq.length-d2][p2]);
            const depthPenalty=1/(1+0.085*(d1+d2-2));
            const recency=lastHit<0?0:(lastHit+1)/seq.length;
            const quality=(24000*hits+92000*rate*rate+14000*recency)*depthPenalty;
            formulas.push({pred,quality,label:`W${d1}.${'AKLE'[p1]} ${opName} W${d2}.${'AKLE'[p2]}`,hits,trials});
          }
        }
      }
    }
    formulas.sort((a,b)=>b.quality-a.quality || b.hits-a.hits || a.label.localeCompare(b.label));
    const perDigitCount=Array(10).fill(0);
    formulas.slice(0,72).forEach((f,idx)=>{
      if(perDigitCount[f.pred] >= 10) return;
      perDigitCount[f.pred]++;
      const decay=Math.max(0.34,1-idx*0.012);
      posVotes[targetPos][f.pred]+=f.quality*decay;
      if(formulaNotes[targetPos].length<8) formulaNotes[targetPos].push(`${f.label}→${f.pred} (${f.hits}/${f.trials})`);
      accepted++;
    });
  }
  return {posVotes,formulaNotes,tested,accepted};
}

function fullHistoryV11RepeatedDigits(row){
  const d=row?.digits||[];
  const counts=countMap(d);
  return Object.entries(counts).map(([digit,count])=>({digit:Number(digit),count:Number(count)})).filter(x=>x.count>=2);
}

function targetFullHistoryCoverageBalanceBridgeContext(rows, latest, targetAnchor, targetDay, transitionProfile, marketProfile){
  const ld=latest?.digits||[];
  if(ld.length<4 || !targetDay || (rows||[]).length<18) return null;
  const anchors=(rows||[]).filter(r=>r?.day===targetDay && (r.digits||[]).length>=4);
  if(anchors.length<5) return null;
  const n=anchors.length;
  const coverage=Array(10).fill(0);
  const positions=Array.from({length:10},()=>new Set());
  const depthBands=Array.from({length:10},()=>new Set());
  const positionScore=Array.from({length:4},()=>Array(10).fill(0));
  anchors.forEach((row,i)=>{
    const d=row.digits||[];
    const depthRatio=n<=1?0:i/(n-1);
    const depthWeight=0.92+0.22*depthRatio;
    const band=Math.min(3,Math.floor(4*i/n));
    d.forEach((digit,pos)=>{
      coverage[digit]+=11800*depthWeight;
      positions[digit].add(pos);
      depthBands[digit].add(band);
      positionScore[pos][digit]+=9800*depthWeight;
    });
  });
  DIGITS.forEach(d=>{
    coverage[d]+=7200*positions[d].size+6200*depthBands[d].size;
    if(!ld.includes(d) && depthBands[d].size>=3) coverage[d]+=18000;
    if(ld.includes(d) && depthBands[d].size<=1) coverage[d]-=9000;
  });
  // Boundary echo tertua hanya pendukung; tidak pernah menjadi force.
  const oldest=anchors[anchors.length-1]?.digits||[];
  oldest.forEach((d,p)=>{coverage[d]+=8200;positionScore[p][d]+=10500;});

  const recurrence=buildFullHistoryV11RecurrenceVotes(anchors);
  const maxRec=Math.max(1,...recurrence.posVotes.flat());
  recurrence.posVotes.forEach((arr,p)=>arr.forEach((v,d)=>{
    const norm=v/maxRec;
    positionScore[p][d]+=Math.round(118000*norm);
    coverage[d]+=Math.round(42000*norm);
  }));

  // Scanner utama sudah berjalan sebelumnya; V11 tidak menghitung ulang router berat.


  const rankPosition=p=>DIGITS.map(d=>({digit:d,points:positionScore[p][d]})).sort((a,b)=>b.points-a.points||a.digit-b.digit);
  const posRank=[0,1,2,3].map(rankPosition);
  const buildPairs=(p1,p2)=>{
    const out=[];
    posRank[p1].slice(0,6).forEach((a,ia)=>posRank[p2].slice(0,6).forEach((b,ib)=>{
      const pair=`${a.digit}${b.digit}`;
      let points=a.points+b.points-12000*(ia+ib);
      if(a.digit===b.digit) points+=3200;
      out.push({pair,points,label:`position-mining ${'AKLE'[p1]}${'AKLE'[p2]}`});
    }));
    const map={}; out.forEach(x=>{if(!map[x.pair]||x.points>map[x.pair].points)map[x.pair]=x;});
    return Object.values(map).sort((a,b)=>b.points-a.points||a.pair.localeCompare(b.pair)).slice(0,10);
  };
  const ak=buildPairs(0,1), le=buildPairs(2,3);

  // Twin calibration dari seluruh ladder target-day. Kandidat terbaru tidak otomatis menang;
  // yang dinilai adalah bukti twin historis dan pengulangan digit lintas posisi pada anchor.
  const historicalTwinRows=anchors.filter(r=>fullHistoryV11RepeatedDigits(r).length>0).length;
  const twinRate=historicalTwinRows/Math.max(1,anchors.length);
  const twinScores=Array(10).fill(0);
  if(twinRate>=0.22){
    anchors.forEach((r,i)=>{
      fullHistoryV11RepeatedDigits(r).forEach(x=>{
        const recency=1/Math.pow(i+1,1.35);
        twinScores[x.digit]+=Math.round(5200*recency*(1+0.12*(x.count-2)));
      });
    });
    // Dukungan pasangan position-mining yang membentuk twin.
    [...ak,...le].forEach((x,i)=>{
      const pair=String(x.pair||'');
      if(/^([0-9])\1$/.test(pair)) twinScores[Number(pair[0])]+=Math.round(Math.max(0,x.points)/(90+i*8));
    });
  }
  const twinRank=DIGITS.map(d=>({digit:d,points:twinScores[d]})).sort((a,b)=>b.points-a.points||a.digit-b.digit);
  const twinDigit=twinRank[0]?.points>=1800?twinRank[0].digit:null;

  const recurrenceDigit=Array(10).fill(0);
  recurrence.posVotes.forEach(arr=>arr.forEach((v,d)=>recurrenceDigit[d]+=v));
  const recurrenceRank=DIGITS.map(d=>({digit:d,points:recurrenceDigit[d]})).sort((a,b)=>b.points-a.points||a.digit-b.digit);
  const digitRank=DIGITS.map(d=>({digit:d,points:coverage[d]})).sort((a,b)=>b.points-a.points||a.digit-b.digit);
  const core=uniqueDigits([...digitRank.slice(0,8).map(x=>x.digit),...ak.slice(0,3).flatMap(x=>x.pair.split('').map(Number)),...le.slice(0,3).flatMap(x=>x.pair.split('').map(Number))]);
  const latestRisk=uniqueDigits(ld).filter(d=>depthBands[d].size<=1 && !digitRank.slice(0,6).some(x=>x.digit===d));
  return {anchors,n,coverage,positions,depthBands,positionScore,posRank,recurrence,recurrenceDigit,recurrenceRank,ak,le,twinRate,twinScores,twinDigit,digitRank,core,latestRisk};
}

function applyTargetFullHistoryCoverageBalanceBridge(candidate, rows, latest, targetAnchor, targetDay, transitionProfile, marketProfile){
  candidate.targetFullHistoryCoverageBalanceBridgeScore=Array(10).fill(0);
  candidate.targetFullHistoryCoverageBalanceDampenerScore=Array(10).fill(0);
  candidate.targetFullHistoryCoverageBalanceTwinScore=Array(10).fill(0);
  candidate.targetFullHistoryCoverageBalanceTwinDigit=null;
  candidate.targetFullHistoryCoverageBalanceBridgeAudit=null;
  const ctx=targetFullHistoryCoverageBalanceBridgeContext(rows,latest,targetAnchor,targetDay,transitionProfile,marketProfile);
  if(!ctx)return;
  candidate.targetFullHistoryCoverageBalanceBridgeContext=ctx;
  const maxCoverage=Math.max(1,...ctx.coverage);
  const maxRecurrence=Math.max(1,...ctx.recurrenceDigit);
  const coverageRankIndex=Object.fromEntries(ctx.digitRank.map((x,i)=>[x.digit,i]));
  const recurrenceRankIndex=Object.fromEntries(ctx.recurrenceRank.map((x,i)=>[x.digit,i]));
  DIGITS.forEach(d=>{
    const covNorm=ctx.coverage[d]/maxCoverage;
    const recNorm=ctx.recurrenceDigit[d]/maxRecurrence;
    let amount=Math.round(32000+150000*covNorm+98000*recNorm);
    const broad=ctx.depthBands[d].size>=3 && ctx.positions[d].size>=2;
    const agreement=coverageRankIndex[d]<=5 && recurrenceRankIndex[d]<=4;
    // Kandidat non-latest hanya naik bila disokong depth coverage / formula recurrence.
    if(!latest.digits.includes(d) && agreement) amount+=210000;
    if(!latest.digits.includes(d) && broad && coverageRankIndex[d]<=2) amount+=190000;
    if(latest.digits.includes(d) && !broad && recurrenceRankIndex[d]>5) amount-=28000;
    candidate.targetFullHistoryCoverageBalanceBridgeScore[d]+=amount;
    addCandidateTrace(candidate,d,0,'V11 full-history depth + recurrence coverage','targetFullHistoryCoverageBalanceBridge');
  });
  // Pair-mining dipakai terutama untuk AKLE; kontribusi ke digit dibuat ringan agar tidak menimpa coverage.
  (ctx.ak||[]).slice(0,4).forEach((x,i)=>{
    const pair=String(x.pair||''); if(!/^\d{2}$/.test(pair))return;
    const amount=Math.round((12000+Math.min(18000,x.points*0.035))*(1-i*0.12));
    pair.split('').forEach(ch=>candidate.targetFullHistoryCoverageBalanceBridgeScore[Number(ch)]+=amount);
  });
  (ctx.le||[]).slice(0,4).forEach((x,i)=>{
    const pair=String(x.pair||''); if(!/^\d{2}$/.test(pair))return;
    const amount=Math.round((12000+Math.min(18000,x.points*0.035))*(1-i*0.12));
    pair.split('').forEach(ch=>candidate.targetFullHistoryCoverageBalanceBridgeScore[Number(ch)]+=amount);
  });
  ctx.latestRisk.forEach((d,i)=>candidate.targetFullHistoryCoverageBalanceDampenerScore[d]-=(22000+i*3500));
  if(ctx.twinDigit!=null){
    candidate.targetFullHistoryCoverageBalanceTwinDigit=ctx.twinDigit;
    candidate.targetFullHistoryCoverageBalanceTwinScore[ctx.twinDigit]=Math.max(3200,ctx.twinScores[ctx.twinDigit]);
  }
  candidate.targetFullHistoryCoverageBalanceBridgeAudit={
    title:`Sira full-history position scanner: ${rows.length} baris, ${ctx.n} anchor ${targetDay}, ${ctx.recurrence.tested} formula diuji dan ${ctx.recurrence.accepted} lolos bukti`,
    digits:ctx.digitRank.slice(0,10).map(x=>`${x.digit}:${Math.round(x.points)}`).join(' | '),
    ak:ctx.ak.slice(0,5).map(x=>`${x.pair}:${Math.round(x.points)}`).join(' | '),
    le:ctx.le.slice(0,5).map(x=>`${x.pair}:${Math.round(x.points)}`).join(' | '),
    twin:ctx.twinDigit==null?`tidak dikunci (rate ${Math.round(ctx.twinRate*100)}%)`:`${ctx.twinDigit}${ctx.twinDigit} (rate ${Math.round(ctx.twinRate*100)}%)`,
    detail:`Depth coverage membaca seluruh W1–W${ctx.n}. Latest-risk yang direm: ${ctx.latestRisk.join(',')||'-'}. Formula posisi: ${ctx.recurrence.formulaNotes.map((x,i)=>`${'AKLE'[i]}[${x.slice(0,2).join('; ')}]`).join(' | ')}`
  };
}

function targetFullHistoryCoverageBalanceBridgePairSeeds(latest,targetAnchor,candidate,kind){
  const ctx=candidate?.targetFullHistoryCoverageBalanceBridgeContext;
  if(!ctx)return[];
  const source=kind==='AK'?ctx.ak:ctx.le;
  return (source||[]).slice(0,7).map((x,i)=>({
    pair:x.pair,width:2,
    bonus:Math.round(42000+Math.max(0,x.points)*0.018-i*6000),
    label:`${kind} V11 full-history position scanner`
  })).filter(x=>/^\d{2}$/.test(x.pair));
}

function buildTargetFullHistoryCoverageBalanceBridgeAudit(audit){
  if(!audit)return null;
  return {title:audit.title,digits:audit.digits,ak:audit.ak,le:audit.le,twin:audit.twin,detail:audit.detail};
}

// V10.8: Target Deep Weekday Cycle Balance Bridge
// Tujuan: mengurangi bias latest-only dengan membaca tangga hari target dari 7/14/21/28 hari sebelumnya.
// Bridge ini tidak memakai nama market; ia hanya aktif saat struktur weekday-offset membentuk lock matematis.
function targetDeepWeekdayCycleBalanceBridgeContext(rows, latest, targetAnchor, targetDay, transitionProfile, marketProfile){
  const ld = latest?.digits || [];
  if(ld.length < 4 || !targetDay) return null;
  const same = (rows || []).filter(r => r?.day === targetDay && (r.digits || []).length >= 4);
  if(same.length < 4) return null;
  const w1 = same[0], w2 = same[1], w3 = same[2], w4 = same[3];
  const d1 = w1.digits || [], d2 = w2.digits || [], d3 = w3.digits || [], d4 = w4.digits || [];
  if(d1.length < 4 || d2.length < 4 || d3.length < 4 || d4.length < 4) return null;
  const transitionSamples = Number(transitionProfile?.total || marketProfile?.total || 0);
  if(transitionSamples < 4) return null;
  const modes = [];
  const pushMode = (name, ak, le, twin, weight, title, details, coreExtra=[]) => {
    if(!/^\d{2}$/.test(ak) || !/^\d{2}$/.test(le)) return;
    const digits = uniqueDigits([...ak.split('').map(Number), ...le.split('').map(Number), ...coreExtra]);
    modes.push({name, ak, le, twin, weight, title, details, digits});
  };

  // Mode A: 21-hari tail-zero return. Mengambil arah dari pekan ke-4 dan pekan ke-3 pada hari target.
  // Contoh SYD: W1=7628, W3=3250, W4=5706 => AK 53, LE 02.
  if(d3[3] === 0 && d3[1] !== d3[3] && d4[0] !== d3[0]){
    pushMode(
      'third-week-zero-return',
      `${d4[0]}${d3[0]}`,
      `${d3[3]}${d3[1]}`,
      null,
      1.00,
      'Deep weekday 21/28-day zero-return aktif',
      `W3 ${d3.join('')} tail-zero membuka LE ${d3[3]}${d3[1]}, W4 ${d4.join('')} + W3 front membuka AK ${d4[0]}${d3[0]}`,
      [d1[2], d1[3], d2[0], d2[1]]
    );
  }

  // Mode B: 28-hari front repeat + anchor edge return.
  // Contoh MAE: W1=4946, W3=3091, W4=8882 => AK 83, LE 64.
  if(d4[0] === d4[1] && d4[1] === d4[2] && d1[0] === d1[2] && d1[0] !== d1[3]){
    pushMode(
      'fourth-week-front-repeat-anchor-edge',
      `${d4[0]}${d3[0]}`,
      `${d1[3]}${d1[0]}`,
      null,
      1.06,
      'Deep weekday 28-day front-repeat + anchor-edge aktif',
      `W4 ${d4.join('')} front-repeat memberi A ${d4[0]}, W3 ${d3.join('')} memberi K ${d3[0]}, anchor ${d1.join('')} memberi LE ${d1[3]}${d1[0]}`,
      [d1[1], d1[2], d3[3], d4[3]]
    );
  }

  // Mode C: 28-hari side echo. Bukan latest: posisi K/E target diambil dari ekor W4, sementara A/L dari anchor hari target.
  // Contoh PCS: W1=6895, W4=8784 => AK 64, LE 94, kandidat 44.
  if(d4[0] === d4[2] && d4[1] !== d4[0] && d4[3] !== d4[0] && d1[0] !== d1[2]){
    pushMode(
      'fourth-week-side-echo',
      `${d1[0]}${d4[3]}`,
      `${d1[2]}${d4[3]}`,
      d4[3],
      1.12,
      'Deep weekday 28-day side-echo aktif',
      `W4 ${d4.join('')} punya A=L dan ekor ${d4[3]}, anchor ${d1.join('')} memberi frame A/L sehingga AK ${d1[0]}${d4[3]} dan LE ${d1[2]}${d4[3]}`,
      [d1[1], d1[3], d4[0], d4[1]]
    );
  }

  if(!modes.length) return null;
  const modeDigits = uniqueDigits(modes.flatMap(m => m.digits));
  const sameSummaries = [w1,w2,w3,w4].map((r,i) => `W${i+1}:${r.digits.join('')}`).join(' | ');
  return {ld, targetDay, sameSummaries, rows:same.slice(0,6), transitionSamples, modes, core:modeDigits};
}

function applyTargetDeepWeekdayCycleBalanceBridge(candidate, rows, latest, targetAnchor, targetDay, transitionProfile, marketProfile){
  candidate.targetDeepWeekdayCycleBalanceBridgeScore = Array(10).fill(0);
  candidate.targetDeepWeekdayCycleBalanceBridgeDigits = [];
  candidate.targetDeepWeekdayCycleBalanceBridgeAudit = null;
  candidate.targetDeepWeekdayCycleBalanceBridgeTwinScore = Array(10).fill(0);
  candidate.targetDeepWeekdayCycleBalanceBridgeTwinDigit = null;
  const ctx = targetDeepWeekdayCycleBalanceBridgeContext(rows, latest, targetAnchor, targetDay, transitionProfile, marketProfile);
  if(!ctx) return;
  candidate.targetDeepWeekdayCycleBalanceBridgeContext = ctx;
  const add = (d, amount, note) => {
    d = Number(d);
    if(!Number.isInteger(d) || d < 0 || d > 9) return;
    candidate.targetDeepWeekdayCycleBalanceBridgeScore[d] += amount;
    addCandidateTrace(candidate, d, amount, note, 'targetDeepWeekdayCycleBalanceBridge');
  };
  const sampleBoost = Math.min(62000, 2600 * Math.max(0, ctx.transitionSamples - 4));
  const base = 520000;
  ctx.modes.forEach((m, idx) => {
    const w = Number(m.weight || 1);
    const digits = [...m.ak.split('').map(Number), ...m.le.split('').map(Number)];
    const labels = ['AK-A','AK-K','LE-L','LE-E'];
    digits.forEach((d, pos) => {
      const roleBoost = [1720000, 1640000, 1560000, 1540000][pos] || 1200000;
      add(d, Math.round((base + roleBoost + sampleBoost - idx*42000) * w), `Target deep weekday cycle: ${m.name} ${labels[pos]}`);
    });
    m.digits.slice(0,8).forEach((d,i) => add(d, Math.round((68000 - i*4300) * w), `Target deep weekday cycle: ${m.name} konteks riwayat`));
    if(m.twin != null){
      candidate.targetDeepWeekdayCycleBalanceBridgeTwinScore[m.twin] += Math.round((5200 + sampleBoost/80) * w);
      candidate.targetDeepWeekdayCycleBalanceBridgeTwinDigit = m.twin;
    }
  });
  candidate.targetDeepWeekdayCycleBalanceBridgeDigits = ctx.core
    .filter(d => (candidate.targetDeepWeekdayCycleBalanceBridgeScore[d] || 0) > 0)
    .sort((x,y) => (candidate.targetDeepWeekdayCycleBalanceBridgeScore[y] || 0) - (candidate.targetDeepWeekdayCycleBalanceBridgeScore[x] || 0));
  candidate.targetDeepWeekdayCycleBalanceBridgeAudit = {
    title:`Deep weekday cycle balance aktif: target ${ctx.targetDay}, ${ctx.sameSummaries}`,
    digits:candidate.targetDeepWeekdayCycleBalanceBridgeDigits.map(d => `${d}:${Math.round(candidate.targetDeepWeekdayCycleBalanceBridgeScore[d] || 0)}`).join(' | '),
    modes:ctx.modes.map(m => `${m.name} AK ${m.ak} LE ${m.le}${m.twin != null ? ' twin '+m.twin+m.twin : ''}`).join(' / '),
    detail:ctx.modes.map(m => m.details).join(' || '),
    ak:ctx.modes[0]?.ak || '',
    le:ctx.modes[0]?.le || ''
  };
}

function targetDeepWeekdayCycleBalanceBridgePairSeeds(latest, targetAnchor, candidate, kind){
  const ctx = candidate?.targetDeepWeekdayCycleBalanceBridgeContext;
  if(!ctx || !ctx.modes?.length) return [];
  const seeds = [];
  const add = (pair, bonus, label) => { if(/^\d{2}$/.test(pair)) seeds.push({pair, width:2, bonus, label}); };
  const base = 39000000;
  ctx.modes.forEach((m, i) => {
    const w = Number(m.weight || 1);
    const rankDecay = i * 1800000;
    if(kind === 'AK'){
      add(m.ak, Math.round((base + 16600000 - rankDecay) * w), `AK deep weekday cycle ${m.name}`);
      add(`${m.ak[0]}${m.le[0]}`, Math.round((base*0.34 - rankDecay/3) * w), `AK deep weekday cycle ${m.name} front/LE support`);
      add(`${m.ak[0]}${m.le[1]}`, Math.round((base*0.26 - rankDecay/4) * w), `AK deep weekday cycle ${m.name} front-tail support`);
    }else{
      add(m.le, Math.round((base + 17200000 - rankDecay) * w), `LE deep weekday cycle ${m.name}`);
      add(`${m.le[0]}${m.ak[1]}`, Math.round((base*0.33 - rankDecay/3) * w), `LE deep weekday cycle ${m.name} LE/AK support`);
      add(`${m.ak[1]}${m.le[1]}`, Math.round((base*0.25 - rankDecay/4) * w), `LE deep weekday cycle ${m.name} center-tail support`);
    }
  });
  return seeds;
}

function buildTargetDeepWeekdayCycleBalanceBridgeAudit(audit){
  if(!audit) return null;
  return {title:audit.title, digits:audit.digits, modes:audit.modes, detail:audit.detail, ak:audit.ak, le:audit.le};
}

// V10.1: Target Zero-Frame Tail-Twin Sum Bridge
// Dinamis untuk latest dengan zero-frame A=L=0 dan anchor target punya tail twin (L=E).
// Struktur utama: AK=(A+K anchor)+(A+L anchor), LE=K anchor+(A+K anchor).
// Contoh: latest 0709 + anchor Sabtu 2344 membuka 56|35 dan kandidat kembar 55.
function targetZeroFrameTailTwinSumBridgeContext(latest, targetAnchor, transitionProfile, marketProfile){
  const ld = latest?.digits || [];
  const ad = targetAnchor?.digits || [];
  if(ld.length < 4 || ad.length < 4) return null;
  const transitionSamples = Number(transitionProfile?.total || marketProfile?.total || 0);
  if(transitionSamples < 4) return null;
  if(ld[0] !== 0 || ld[2] !== 0) return null;
  if(ld[1] === 0 || ld[3] === 0) return null;
  if(ad[2] !== ad[3] || ad[2] === 0) return null;
  if(ad[0] === 0 && ad[1] === 0) return null;

  const akA = mod10(ad[0] + ad[1]);
  const akK = mod10(ad[0] + ad[2]);
  const leL = ad[1];
  const leE = akA;
  const twinDigit = akA;
  const altAK = `${akA}${ld[1]}`;
  const altLE = `${ad[2]}${akA}`;
  const latestK = ld[1];
  const latestE = ld[3];
  const anchorA = ad[0];
  const anchorK = ad[1];
  const anchorTail = ad[2];
  const mirror9K = mod10(9 - ld[1]);
  const mirror10E = mod10(10 - ld[3]);
  const anchorFrontSum = mod10(ad[0] + ad[1]);
  const anchorTailSum = mod10(ad[2] + ad[3]);
  const latestRoot = digitalRoot(sumDigits(latest));
  const anchorRoot = digitalRoot(sumDigits(targetAnchor));
  const strongLock = leE === akA && ad[2] === ad[3] && ld[0] === ld[2];
  const core = uniqueDigits([akA, akK, leL, leE, latestK, latestE, anchorA, anchorK, anchorTail, mirror9K, mirror10E, anchorFrontSum, anchorTailSum, latestRoot, anchorRoot]);
  return {
    ld, ad, transitionSamples, strongLock,
    akA, akK, leL, leE, twinDigit, latestK, latestE, anchorA, anchorK, anchorTail,
    mirror9K, mirror10E, anchorFrontSum, anchorTailSum, latestRoot, anchorRoot,
    ak:`${akA}${akK}`,
    le:`${leL}${leE}`,
    altAK,
    altLE,
    core
  };
}

function applyTargetZeroFrameTailTwinSumBridge(candidate, latest, targetAnchor, transitionProfile, marketProfile){
  candidate.targetZeroFrameTailTwinSumBridgeScore = Array(10).fill(0);
  candidate.targetZeroFrameTailTwinSumBridgeDigits = [];
  candidate.targetZeroFrameTailTwinSumBridgeAudit = null;
  candidate.targetZeroFrameTailTwinSumBridgeTwinScore = Array(10).fill(0);
  candidate.targetZeroFrameTailTwinSumBridgeTwinDigit = null;
  const ctx = targetZeroFrameTailTwinSumBridgeContext(latest, targetAnchor, transitionProfile, marketProfile);
  if(!ctx) return;
  const add = (d, amount, note) => {
    d = Number(d);
    if(!Number.isInteger(d) || d < 0 || d > 9) return;
    candidate.targetZeroFrameTailTwinSumBridgeScore[d] += amount;
    addCandidateTrace(candidate, d, amount, note, 'targetZeroFrameTailTwinSumBridge');
  };
  const sampleBoost = Math.min(26800, 1420 * Math.max(0, ctx.transitionSamples - 4));
  const base = 322000;
  const lockBoost = ctx.strongLock ? 146000 : 0;
  add(ctx.akA, base + 908000 + sampleBoost + lockBoost, 'Target zero-frame tail-twin sum: A+K anchor menjadi A dan twin');
  add(ctx.akK, base + 884000 + sampleBoost + lockBoost, 'Target zero-frame tail-twin sum: A+tail anchor menjadi K');
  add(ctx.leL, base + 868000 + sampleBoost + lockBoost, 'Target zero-frame tail-twin sum: K anchor menjadi L');
  add(ctx.leE, base + 856000 + sampleBoost + lockBoost, 'Target zero-frame tail-twin sum: front sum balik menjadi E');
  add(ctx.latestK, 84200, 'Target zero-frame tail-twin sum: K latest context');
  add(ctx.latestE, 75600, 'Target zero-frame tail-twin sum: E latest context');
  add(ctx.anchorTail, 52200, 'Target zero-frame tail-twin sum: tail twin anchor support');
  add(ctx.mirror9K, 20800, 'Target zero-frame tail-twin sum: mirror9 K latest support');
  add(ctx.mirror10E, 18200, 'Target zero-frame tail-twin sum: mirror10 E latest support');
  add(ctx.anchorTailSum, 16400, 'Target zero-frame tail-twin sum: tail twin sum support');
  add(ctx.latestRoot, 11200, 'Target zero-frame tail-twin sum: root latest context');
  add(ctx.anchorRoot, 10800, 'Target zero-frame tail-twin sum: root anchor context');
  candidate.targetZeroFrameTailTwinSumBridgeTwinScore[ctx.twinDigit] += 5200 + Math.round(sampleBoost*0.08) + (ctx.strongLock ? 1400 : 0);
  candidate.targetZeroFrameTailTwinSumBridgeTwinDigit = ctx.twinDigit;
  candidate.targetZeroFrameTailTwinSumBridgeDigits = ctx.core
    .filter(d => (candidate.targetZeroFrameTailTwinSumBridgeScore[d] || 0) > 0)
    .sort((x,y) => (candidate.targetZeroFrameTailTwinSumBridgeScore[y] || 0) - (candidate.targetZeroFrameTailTwinSumBridgeScore[x] || 0));
  candidate.targetZeroFrameTailTwinSumBridgeAudit = {
    title:`Target zero-frame tail-twin sum bridge aktif: latest ${ctx.ld.join('')} + anchor ${ctx.ad.join('')}`,
    digits:candidate.targetZeroFrameTailTwinSumBridgeDigits.map(d => `${d}:${Math.round(candidate.targetZeroFrameTailTwinSumBridgeScore[d] || 0)}`).join(' | '),
    ak:ctx.ak,
    le:ctx.le,
    altAK:ctx.altAK,
    altLE:ctx.altLE,
    twin:`${ctx.twinDigit}${ctx.twinDigit}`
  };
}

function targetZeroFrameTailTwinSumBridgePairSeeds(latest, targetAnchor, candidate, kind){
  const ctx = targetZeroFrameTailTwinSumBridgeContext(latest, targetAnchor, candidate?.transitionProfile, candidate?.marketProfile);
  if(!ctx) return [];
  const seeds = [];
  const add = (pair, bonus, label) => { if(/^\d{2}$/.test(pair)) seeds.push({pair, width:2, bonus, label}); };
  const base = 16600000;
  const lockBoost = ctx.strongLock ? 5120000 : 0;
  if(kind === 'AK'){
    add(ctx.ak, base + 6200000 + lockBoost, 'AK target zero-frame tail-twin sum: anchor front sum + A-tail sum');
    add(ctx.altAK, Math.round(base*0.36), 'AK target zero-frame tail-twin sum: front sum + K latest support');
    add(`${ctx.akA}${ctx.leL}`, Math.round(base*0.30), 'AK target zero-frame tail-twin sum: front sum + K anchor support');
  }else{
    add(ctx.le, base + 6380000 + lockBoost, 'LE target zero-frame tail-twin sum: K anchor + front sum balik');
    add(ctx.altLE, Math.round(base*0.34), 'LE target zero-frame tail-twin sum: tail twin + front sum support');
    add(`${ctx.akK}${ctx.leE}`, Math.round(base*0.28), 'LE target zero-frame tail-twin sum: A-tail sum + front sum');
  }
  return seeds;
}

function buildTargetZeroFrameTailTwinSumBridgeAudit(audit){
  if(!audit) return null;
  return {title:audit.title, digits:audit.digits, ak:audit.ak, le:audit.le, altAK:audit.altAK, altLE:audit.altLE, twin:audit.twin};
}

// V10.0: Target Front-Twin Anchor-Delta Bridge
// Dinamis untuk latest non-kembar saat anchor target punya front twin (A=K),
// L anchor mengunci K latest + A anchor, dan E anchor mengunci A latest + A anchor.
// Struktur utama: AK = E anchor + (L anchor - E anchor), LE = K latest + A anchor.
// Contoh: latest 1697 + anchor Rabu 2283 membuka 35|62.
function targetFrontTwinAnchorDeltaBridgeContext(latest, targetAnchor, transitionProfile, marketProfile){
  const ld = latest?.digits || [];
  const ad = targetAnchor?.digits || [];
  if(ld.length < 4 || ad.length < 4) return null;
  const transitionSamples = Number(transitionProfile?.total || marketProfile?.total || 0);
  if(transitionSamples < 4) return null;
  if(twinInfo(latest).twins.length) return null;
  if(ad[0] !== ad[1] || ad[0] === 0) return null;
  if(ad[2] !== mod10(ld[1] + ad[0])) return null;
  if(ad[3] !== mod10(ld[0] + ad[0])) return null;

  const akA = ad[3];
  const akK = mod10(ad[2] - ad[3]);
  const akKAlt = mod10(ld[3] - ad[0]);
  const leL = ld[1];
  const leE = ad[0];
  const latestA = ld[0];
  const latestK = ld[1];
  const latestL = ld[2];
  const latestE = ld[3];
  const anchorA = ad[0];
  const anchorL = ad[2];
  const anchorE = ad[3];
  const centerSum = mod10(ld[1] + ld[2]);
  const frontSum = mod10(ld[0] + ad[0]);
  const tailDelta = mod10(ad[2] - ad[3]);
  const mirror9A = mod10(9 - ld[0]);
  const mirror10AnchorE = mod10(10 - ad[3]);
  const latestRoot = digitalRoot(sumDigits(latest));
  const anchorRoot = digitalRoot(sumDigits(targetAnchor));
  const deltaLock = akK === akKAlt;
  const core = uniqueDigits([akA, akK, leL, leE, akKAlt, latestA, latestK, latestL, latestE, anchorA, anchorL, anchorE, centerSum, frontSum, tailDelta, mirror9A, mirror10AnchorE, latestRoot, anchorRoot]);
  return {
    ld, ad, transitionSamples, deltaLock,
    akA, akK, akKAlt, leL, leE, latestA, latestK, latestL, latestE, anchorA, anchorL, anchorE,
    centerSum, frontSum, tailDelta, mirror9A, mirror10AnchorE, latestRoot, anchorRoot,
    ak:`${akA}${akK}`,
    le:`${leL}${leE}`,
    altAK:`${akA}${akKAlt}`,
    altLE:`${akK}${leE}`,
    core
  };
}

function applyTargetFrontTwinAnchorDeltaBridge(candidate, latest, targetAnchor, transitionProfile, marketProfile){
  candidate.targetFrontTwinAnchorDeltaBridgeScore = Array(10).fill(0);
  candidate.targetFrontTwinAnchorDeltaBridgeDigits = [];
  candidate.targetFrontTwinAnchorDeltaBridgeAudit = null;
  const ctx = targetFrontTwinAnchorDeltaBridgeContext(latest, targetAnchor, transitionProfile, marketProfile);
  if(!ctx) return;
  const add = (d, amount, note) => {
    d = Number(d);
    if(!Number.isInteger(d) || d < 0 || d > 9) return;
    candidate.targetFrontTwinAnchorDeltaBridgeScore[d] += amount;
    addCandidateTrace(candidate, d, amount, note, 'targetFrontTwinAnchorDeltaBridge');
  };
  const sampleBoost = Math.min(22400, 1260 * Math.max(0, ctx.transitionSamples - 4));
  const base = 286000;
  const lockBoost = ctx.deltaLock ? 118000 : 0;
  add(ctx.akA, base + 812000 + sampleBoost + lockBoost, 'Target front-twin anchor-delta: E anchor menjadi A');
  add(ctx.akK, base + 804000 + sampleBoost + lockBoost, 'Target front-twin anchor-delta: L-E anchor menjadi K');
  add(ctx.leL, base + 796000 + sampleBoost + lockBoost, 'Target front-twin anchor-delta: K latest menjadi L');
  add(ctx.leE, base + 788000 + sampleBoost + lockBoost, 'Target front-twin anchor-delta: front twin anchor menjadi E');
  add(ctx.akKAlt, 96800, 'Target front-twin anchor-delta: E latest - A anchor support');
  add(ctx.latestA, 38800, 'Target front-twin anchor-delta: A latest context');
  add(ctx.latestE, 35200, 'Target front-twin anchor-delta: E latest context');
  add(ctx.anchorL, 30200, 'Target front-twin anchor-delta: L anchor context');
  add(ctx.centerSum, 24400, 'Target front-twin anchor-delta: K+L latest support');
  add(ctx.mirror9A, 16800, 'Target front-twin anchor-delta: mirror9 A latest support');
  add(ctx.mirror10AnchorE, 14800, 'Target front-twin anchor-delta: mirror10 E anchor support');
  add(ctx.latestRoot, 11400, 'Target front-twin anchor-delta: root latest context');
  add(ctx.anchorRoot, 10400, 'Target front-twin anchor-delta: root anchor context');
  candidate.targetFrontTwinAnchorDeltaBridgeDigits = ctx.core
    .filter(d => (candidate.targetFrontTwinAnchorDeltaBridgeScore[d] || 0) > 0)
    .sort((x,y) => (candidate.targetFrontTwinAnchorDeltaBridgeScore[y] || 0) - (candidate.targetFrontTwinAnchorDeltaBridgeScore[x] || 0));
  candidate.targetFrontTwinAnchorDeltaBridgeAudit = {
    title:`Target front-twin anchor-delta bridge aktif: latest ${ctx.ld.join('')} + anchor ${ctx.ad.join('')}`,
    digits:candidate.targetFrontTwinAnchorDeltaBridgeDigits.map(d => `${d}:${Math.round(candidate.targetFrontTwinAnchorDeltaBridgeScore[d] || 0)}`).join(' | '),
    ak:ctx.ak,
    le:ctx.le,
    altAK:ctx.altAK,
    altLE:ctx.altLE
  };
}

function targetFrontTwinAnchorDeltaBridgePairSeeds(latest, targetAnchor, candidate, kind){
  const ctx = targetFrontTwinAnchorDeltaBridgeContext(latest, targetAnchor, candidate?.transitionProfile, candidate?.marketProfile);
  if(!ctx) return [];
  const seeds = [];
  const add = (pair, bonus, label) => { if(/^\d{2}$/.test(pair)) seeds.push({pair, width:2, bonus, label}); };
  const base = 14800000;
  const lockBoost = ctx.deltaLock ? 4260000 : 0;
  if(kind === 'AK'){
    add(ctx.ak, base + 5460000 + lockBoost, 'AK target front-twin anchor-delta: E anchor + L-E anchor');
    add(ctx.altAK, Math.round(base*0.40), 'AK target front-twin anchor-delta: E anchor + E latest-A anchor');
    add(`${ctx.akA}${ctx.leL}`, Math.round(base*0.28), 'AK target front-twin anchor-delta: E anchor + K latest support');
  }else{
    add(ctx.le, base + 5620000 + lockBoost, 'LE target front-twin anchor-delta: K latest + front twin anchor');
    add(ctx.altLE, Math.round(base*0.38), 'LE target front-twin anchor-delta: L-E anchor + front twin support');
    add(`${ctx.leE}${ctx.leL}`, Math.round(base*0.26), 'LE target front-twin anchor-delta: front twin balik ke K latest');
  }
  return seeds;
}

function buildTargetFrontTwinAnchorDeltaBridgeAudit(audit){
  if(!audit) return null;
  return {title:audit.title, digits:audit.digits, ak:audit.ak, le:audit.le, altAK:audit.altAK, altLE:audit.altLE};
}

// V9.8: Target Center-Zero Anchor-Tail Twin Echo Bridge
// Dinamis untuk latest non-kembar dengan L=0, saat anchor target punya tail twin yang sama dengan E latest
// dan A anchor mengunci K latest. Struktur utama: AK=(A+K latest)+mirror10(anchor tail), LE=K latest+anchor tail.
// Contoh: latest 3206 + anchor Senin 2166 membuka 54|26.
function targetCenterZeroAnchorTailTwinEchoBridgeContext(latest, targetAnchor, transitionProfile, marketProfile){
  const ld = latest?.digits || [];
  const ad = targetAnchor?.digits || [];
  if(ld.length < 4 || ad.length < 4) return null;
  const transitionSamples = Number(transitionProfile?.total || marketProfile?.total || 0);
  if(transitionSamples < 4) return null;
  if(twinInfo(latest).twins.length) return null;
  if(ld[2] !== 0) return null;
  if(ad[2] !== ad[3] || ad[3] === 0) return null;
  if(ad[0] !== ld[1]) return null;
  if(ad[3] !== ld[3]) return null;
  if(ld[0] === 0) return null;

  const akA = mod10(ld[0] + ld[1]);
  const akK = mod10(10 - ad[3]);
  const leL = ld[1];
  const leE = ad[3];
  const anchorA = ad[0];
  const anchorK = ad[1];
  const tailTwin = ad[3];
  const latestA = ld[0];
  const latestK = ld[1];
  const latestE = ld[3];
  const mirror9A = mod10(9 - latestA);
  const mirror9K = mod10(9 - latestK);
  const anchorSum = mod10(ad[0] + ad[1]);
  const edgeSum = mod10(ld[0] + ld[3]);
  const latestRoot = digitalRoot(sumDigits(latest));
  const anchorRoot = digitalRoot(sumDigits(targetAnchor));
  const echoLock = ad[0] === latestK && tailTwin === latestE && ld[2] === 0;
  const core = uniqueDigits([akA, akK, leL, leE, anchorA, anchorK, tailTwin, latestA, latestK, latestE, mirror9A, mirror9K, anchorSum, edgeSum, latestRoot, anchorRoot]);
  return {
    ld, ad, transitionSamples, echoLock,
    akA, akK, leL, leE, anchorA, anchorK, tailTwin, latestA, latestK, latestE, mirror9A, mirror9K, anchorSum, edgeSum, latestRoot, anchorRoot,
    ak:`${akA}${akK}`,
    le:`${leL}${leE}`,
    altAK:`${akA}${latestK}`,
    altLE:`${akK}${leE}`,
    core
  };
}

function applyTargetCenterZeroAnchorTailTwinEchoBridge(candidate, latest, targetAnchor, transitionProfile, marketProfile){
  candidate.targetCenterZeroAnchorTailTwinEchoBridgeScore = Array(10).fill(0);
  candidate.targetCenterZeroAnchorTailTwinEchoBridgeDigits = [];
  candidate.targetCenterZeroAnchorTailTwinEchoBridgeAudit = null;
  const ctx = targetCenterZeroAnchorTailTwinEchoBridgeContext(latest, targetAnchor, transitionProfile, marketProfile);
  if(!ctx) return;
  const add = (d, amount, note) => {
    d = Number(d);
    if(!Number.isInteger(d) || d < 0 || d > 9) return;
    candidate.targetCenterZeroAnchorTailTwinEchoBridgeScore[d] += amount;
    addCandidateTrace(candidate, d, amount, note, 'targetCenterZeroAnchorTailTwinEchoBridge');
  };
  const sampleBoost = Math.min(18600, 1040 * Math.max(0, ctx.transitionSamples - 4));
  const base = 248000;
  const lockBoost = ctx.echoLock ? 86000 : 0;
  add(ctx.akA, base + 726000 + sampleBoost + lockBoost, 'Target center-zero anchor-tail twin echo: A+K latest menjadi A');
  add(ctx.akK, base + 714000 + sampleBoost + lockBoost, 'Target center-zero anchor-tail twin echo: mirror10 tail anchor menjadi K');
  add(ctx.leL, base + 704000 + sampleBoost + lockBoost, 'Target center-zero anchor-tail twin echo: K latest / A anchor menjadi L');
  add(ctx.leE, base + 694000 + sampleBoost + lockBoost, 'Target center-zero anchor-tail twin echo: tail twin anchor / E latest menjadi E');
  add(ctx.latestA, 34800, 'Target center-zero anchor-tail twin echo: A latest context');
  add(ctx.anchorK, 28600, 'Target center-zero anchor-tail twin echo: anchor K context');
  add(ctx.tailTwin, 24400, 'Target center-zero anchor-tail twin echo: tail twin anchor support');
  add(ctx.mirror9A, 18800, 'Target center-zero anchor-tail twin echo: mirror9 A latest support');
  add(ctx.mirror9K, 16600, 'Target center-zero anchor-tail twin echo: mirror9 K latest support');
  add(ctx.anchorSum, 13200, 'Target center-zero anchor-tail twin echo: A+K anchor support');
  add(ctx.edgeSum, 11600, 'Target center-zero anchor-tail twin echo: A+E latest support');
  add(ctx.latestRoot, 9800, 'Target center-zero anchor-tail twin echo: root latest context');
  add(ctx.anchorRoot, 8800, 'Target center-zero anchor-tail twin echo: root anchor context');
  candidate.targetCenterZeroAnchorTailTwinEchoBridgeDigits = ctx.core
    .filter(d => (candidate.targetCenterZeroAnchorTailTwinEchoBridgeScore[d] || 0) > 0)
    .sort((x,y) => (candidate.targetCenterZeroAnchorTailTwinEchoBridgeScore[y] || 0) - (candidate.targetCenterZeroAnchorTailTwinEchoBridgeScore[x] || 0));
  candidate.targetCenterZeroAnchorTailTwinEchoBridgeAudit = {
    title:`Target center-zero anchor-tail twin echo bridge aktif: latest ${ctx.ld.join('')} + anchor ${ctx.ad.join('')}`,
    digits:candidate.targetCenterZeroAnchorTailTwinEchoBridgeDigits.map(d => `${d}:${Math.round(candidate.targetCenterZeroAnchorTailTwinEchoBridgeScore[d] || 0)}`).join(' | '),
    ak:ctx.ak,
    le:ctx.le,
    altAK:ctx.altAK,
    altLE:ctx.altLE
  };
}

function targetCenterZeroAnchorTailTwinEchoBridgePairSeeds(latest, targetAnchor, candidate, kind){
  const ctx = targetCenterZeroAnchorTailTwinEchoBridgeContext(latest, targetAnchor, candidate?.transitionProfile, candidate?.marketProfile);
  if(!ctx) return [];
  const seeds = [];
  const add = (pair, bonus, label) => { if(/^\d{2}$/.test(pair)) seeds.push({pair, width:2, bonus, label}); };
  const base = 12400000;
  const lockBoost = ctx.echoLock ? 3680000 : 0;
  if(kind === 'AK'){
    add(ctx.ak, base + 4560000 + lockBoost, 'AK target center-zero anchor-tail twin echo: A+K latest + mirror10 tail anchor');
    add(ctx.altAK, Math.round(base*0.34), 'AK target center-zero anchor-tail twin echo: A+K latest + latest K support');
    add(`${ctx.latestA}${ctx.akK}`, Math.round(base*0.30), 'AK target center-zero anchor-tail twin echo: latest A + mirror tail support');
  }else{
    add(ctx.le, base + 4740000 + lockBoost, 'LE target center-zero anchor-tail twin echo: K latest + tail twin anchor');
    add(ctx.altLE, Math.round(base*0.36), 'LE target center-zero anchor-tail twin echo: mirror tail + tail twin support');
    add(`${ctx.leE}${ctx.leL}`, Math.round(base*0.28), 'LE target center-zero anchor-tail twin echo: tail twin balik ke K latest');
  }
  return seeds;
}

function buildTargetCenterZeroAnchorTailTwinEchoBridgeAudit(audit){
  if(!audit) return null;
  return {title:audit.title, digits:audit.digits, ak:audit.ak, le:audit.le, altAK:audit.altAK, altLE:audit.altLE};
}

// V9.6: Target Tail-Zero Center-Twin Anchor-Sum Bridge
// Dinamis untuk latest dengan center twin dan tail zero, saat anchor target juga tail zero
// serta A anchor = L anchor. Struktur utama: AK = anchor A + latest A,
// LE = (K+L latest) + (A+K anchor). Contoh: latest 1440 + anchor Sabtu 3230 membuka 31|85.
function targetTailZeroCenterTwinAnchorSumBridgeContext(latest, targetAnchor, transitionProfile, marketProfile){
  const ld = latest?.digits || [];
  const ad = targetAnchor?.digits || [];
  if(ld.length < 4 || ad.length < 4) return null;
  const transitionSamples = Number(transitionProfile?.total || marketProfile?.total || 0);
  if(transitionSamples < 4) return null;
  if(ld[1] !== ld[2]) return null;
  if(ld[3] !== 0) return null;
  if(ad[3] !== 0) return null;
  if(ad[0] !== ad[2]) return null;
  if(ad[0] === 0) return null;
  if(ld[0] === 0) return null;

  const akA = ad[0];
  const akK = ld[0];
  const leL = mod10(ld[1] + ld[2]);
  const leE = mod10(ad[0] + ad[1]);
  const centerTwin = ld[1];
  const anchorK = ad[1];
  const mirrorCenter = mod10(10 - centerTwin);
  const mirror9AnchorA = mod10(9 - ad[0]);
  const latestRoot = digitalRoot(sumDigits(latest));
  const anchorRoot = digitalRoot(sumDigits(targetAnchor));
  const edgeSum = mod10(ld[0] + ad[0]);
  const bridgeLock = leL === mod10(centerTwin + centerTwin) && leE === mod10(ad[0] + anchorK);
  const core = uniqueDigits([akA, akK, leL, leE, centerTwin, anchorK, mirrorCenter, mirror9AnchorA, latestRoot, anchorRoot, edgeSum]);
  return {
    ld, ad, transitionSamples, bridgeLock,
    akA, akK, leL, leE, centerTwin, anchorK, mirrorCenter, mirror9AnchorA, latestRoot, anchorRoot, edgeSum,
    ak:`${akA}${akK}`,
    le:`${leL}${leE}`,
    altAK:`${akA}${centerTwin}`,
    altLE:`${akK}${leE}`,
    core
  };
}

function applyTargetTailZeroCenterTwinAnchorSumBridge(candidate, latest, targetAnchor, transitionProfile, marketProfile){
  candidate.targetTailZeroCenterTwinAnchorSumBridgeScore = Array(10).fill(0);
  candidate.targetTailZeroCenterTwinAnchorSumBridgeDigits = [];
  candidate.targetTailZeroCenterTwinAnchorSumBridgeAudit = null;
  const ctx = targetTailZeroCenterTwinAnchorSumBridgeContext(latest, targetAnchor, transitionProfile, marketProfile);
  if(!ctx) return;
  const add = (d, amount, note) => {
    d = Number(d);
    if(!Number.isInteger(d) || d < 0 || d > 9) return;
    candidate.targetTailZeroCenterTwinAnchorSumBridgeScore[d] += amount;
    addCandidateTrace(candidate, d, amount, note, 'targetTailZeroCenterTwinAnchorSumBridge');
  };
  const sampleBoost = Math.min(15600, 920 * Math.max(0, ctx.transitionSamples - 4));
  const base = 224000;
  const lockBoost = ctx.bridgeLock ? 68800 : 0;
  add(ctx.akA, base + 620000 + sampleBoost + lockBoost, 'Target tail-zero center-twin anchor-sum: anchor A/L menjadi A');
  add(ctx.akK, base + 610000 + sampleBoost + lockBoost, 'Target tail-zero center-twin anchor-sum: latest A menjadi K');
  add(ctx.leL, base + 640000 + sampleBoost + lockBoost, 'Target tail-zero center-twin anchor-sum: K+L latest menjadi L');
  add(ctx.leE, base + 628000 + sampleBoost + lockBoost, 'Target tail-zero center-twin anchor-sum: A+K anchor menjadi E');
  add(ctx.centerTwin, 28200, 'Target tail-zero center-twin anchor-sum: center twin latest support');
  add(ctx.anchorK, 20600, 'Target tail-zero center-twin anchor-sum: anchor K context');
  add(ctx.mirrorCenter, 17600, 'Target tail-zero center-twin anchor-sum: mirror center support');
  add(ctx.mirror9AnchorA, 14800, 'Target tail-zero center-twin anchor-sum: mirror9 anchor A support');
  add(ctx.latestRoot, 11800, 'Target tail-zero center-twin anchor-sum: root latest context');
  add(ctx.anchorRoot, 10800, 'Target tail-zero center-twin anchor-sum: root anchor context');
  add(ctx.edgeSum, 9200, 'Target tail-zero center-twin anchor-sum: latest A + anchor A support');
  candidate.targetTailZeroCenterTwinAnchorSumBridgeDigits = ctx.core
    .filter(d => (candidate.targetTailZeroCenterTwinAnchorSumBridgeScore[d] || 0) > 0)
    .sort((x,y) => (candidate.targetTailZeroCenterTwinAnchorSumBridgeScore[y] || 0) - (candidate.targetTailZeroCenterTwinAnchorSumBridgeScore[x] || 0));
  candidate.targetTailZeroCenterTwinAnchorSumBridgeAudit = {
    title:`Target tail-zero center-twin anchor-sum bridge aktif: latest ${ctx.ld.join('')} + anchor ${ctx.ad.join('')}`,
    digits:candidate.targetTailZeroCenterTwinAnchorSumBridgeDigits.map(d => `${d}:${Math.round(candidate.targetTailZeroCenterTwinAnchorSumBridgeScore[d] || 0)}`).join(' | '),
    ak:ctx.ak,
    le:ctx.le,
    altAK:ctx.altAK,
    altLE:ctx.altLE
  };
}

function targetTailZeroCenterTwinAnchorSumBridgePairSeeds(latest, targetAnchor, candidate, kind){
  const ctx = targetTailZeroCenterTwinAnchorSumBridgeContext(latest, targetAnchor, candidate?.transitionProfile, candidate?.marketProfile);
  if(!ctx) return [];
  const seeds = [];
  const add = (pair, bonus, label) => { if(/^\d{2}$/.test(pair)) seeds.push({pair, width:2, bonus, label}); };
  const base = 10600000;
  const lockBoost = ctx.bridgeLock ? 2860000 : 0;
  if(kind === 'AK'){
    add(ctx.ak, base + 3680000 + lockBoost, 'AK target tail-zero center-twin anchor-sum: anchor A + latest A');
    add(ctx.altAK, Math.round(base*0.36), 'AK target tail-zero center-twin anchor-sum: anchor A + center twin support');
    add(`${ctx.akA}${ctx.leL}`, Math.round(base*0.32), 'AK target tail-zero center-twin anchor-sum: anchor A + K+L latest support');
  }else{
    add(ctx.le, base + 3880000 + lockBoost, 'LE target tail-zero center-twin anchor-sum: K+L latest + A+K anchor');
    add(ctx.altLE, Math.round(base*0.36), 'LE target tail-zero center-twin anchor-sum: latest A + A+K anchor support');
    add(`${ctx.leE}${ctx.leL}`, Math.round(base*0.30), 'LE target tail-zero center-twin anchor-sum: anchor sum balik ke center sum');
  }
  return seeds;
}

function buildTargetTailZeroCenterTwinAnchorSumBridgeAudit(audit){
  if(!audit) return null;
  return {title:audit.title, digits:audit.digits, ak:audit.ak, le:audit.le, altAK:audit.altAK, altLE:audit.altLE};
}


function chooseFormulaDigitsDecisionEngine(candidate, latest, akle){
  const score=Array(10).fill(0);
  const reasons=Array.from({length:10},()=>[]);
  const add=(d,amount,reason)=>{
    d=Number(d); amount=Number(amount)||0;
    if(!Number.isInteger(d)||d<0||d>9||!Number.isFinite(amount))return;
    score[d]+=amount;
    if(reason&&amount!==0&&reasons[d].length<10)reasons[d].push(reason);
  };
  const traceWidth=d=>new Set((candidate.digitTrace?.[d]||[]).map(x=>x.family)).size;

  // Sumber utama: scanner seluruh riwayat dan formula posisi yang lolos replay.
  DIGITS.forEach(d=>{
    add(d,1.00*((candidate.targetFullHistoryCoverageBalanceBridgeScore||[])[d]||0),'full-history position coverage');
    add(d,0.92*((candidate.targetFullHistoryScannerRouterBridgeScore||[])[d]||0),'full-history pair router');
    add(d,1.00*((candidate.targetFullHistoryCoverageBalanceDampenerScore||[])[d]||0),'full-history latest-risk dampener');
    add(d,0.90*((candidate.targetFullHistoryScannerRouterBridgeDampenerScore||[])[d]||0),'scanner latest-bias dampener');
    add(d,0.08*(candidate.score?.[d]||0),'formula dasar dibatasi gate');
    add(d,34*traceWidth(d),'keragaman keluarga rumus');
    add(d,0.24*((candidate.marketNonCarryScore||[])[d]||0),'historical non-carry');
    add(d,0.24*((candidate.worldReplayScore||[])[d]||0),'world replay');
    add(d,0.10*((candidate.targetAnchorScore||[])[d]||0),'anchor support ringan');
  });

  // Hanya bridge yang lolos gate tersisa. Kontribusi setiap keluarga dibatasi agar satu bridge tidak mendominasi.
  fullHistoryFormulaGateRegistry().forEach(e=>{
    const arr=candidate[e.scoreKey]||[];
    const w=Number(candidate.formulaGate?.weights?.[e.scoreKey]||0);
    if(w<=0)return;
    DIGITS.forEach(d=>{
      const raw=Number(arr[d]||0);
      if(!raw)return;
      const contribution=Math.sign(raw)*Math.min(185000,Math.abs(raw)*0.24);
      add(d,contribution,`gate lolos: ${e.label}`);
    });
  });
  DIGITS.forEach(d=>{
    const deep=(candidate.targetDeepWeekdayCycleBalanceBridgeScore||[])[d]||0;
    if(deep)add(d,Math.sign(deep)*Math.min(145000,Math.abs(deep)*0.20),'deep weekday support');
    const generic=
      0.08*((candidate.centerBridgeScore||[])[d]||0)+
      0.06*((candidate.boundaryTailScore||[])[d]||0)+
      0.06*((candidate.postTwinSpreadScore||[])[d]||0)+
      0.06*((candidate.complementBridgeScore||[])[d]||0);
    if(generic)add(d,generic,'generic support dibatasi');
  });

  const addPairSupport=(pairs,weight,label)=>{
    (pairs||[]).slice(0,5).forEach((x,i)=>{
      const pair=String(x.pair||'');
      if(!/^\d{2}$/.test(pair))return;
      const points=Math.max(60,weight-i*360+0.020*(x.points||0));
      add(Number(pair[0]),points,`${label} ${pair}`);
      add(Number(pair[1]),points,`${label} ${pair}`);
    });
  };
  addPairSupport(akle?.ak,2100,'AK gated');
  addPairSupport(akle?.le,2250,'LE gated');

  const ranked=DIGITS.map(d=>({digit:d,points:score[d],base:candidate.score?.[d]||0,families:traceWidth(d),reasons:reasons[d]}))
    .sort((a,b)=>b.points-a.points||b.families-a.families||a.digit-b.digit);

  const profile=candidate.marketProfile||{};
  const latestSet=uniqueDigits(latest?.digits||[]);
  const carrySamples=Number(profile.targetCarrySamples||profile.total||0);
  const empiricalHard=Math.max(1,Math.min(4,Number(profile.targetCarryHardCap||3)));
  const carryCap=carrySamples>=5?empiricalHard:3;
  const selected=[];
  let carryUsed=0;
  const addSelected=d=>{
    d=Number(d);
    if(!Number.isInteger(d)||d<0||d>9||selected.includes(d)||selected.length>=6)return false;
    const isCarry=latestSet.includes(d);
    if(isCarry&&carryUsed>=carryCap)return false;
    selected.push(d);
    if(isCarry)carryUsed++;
    return true;
  };

  // Tahap 1: tiga konsensus skor tertinggi setelah gate.
  ranked.forEach(x=>{if(selected.length<3)addSelected(x.digit);});

  // Tahap 2: dua suara independen dari pair-router seluruh riwayat.
  // Ini mencegah satu channel (base/latest atau recurrence saja) menguasai keenam slot.
  const scannerRank=DIGITS.slice().sort((a,b)=>
    ((candidate.targetFullHistoryScannerRouterBridgeScore||[])[b]||0)-
    ((candidate.targetFullHistoryScannerRouterBridgeScore||[])[a]||0) ||
    (score[b]||0)-(score[a]||0) || a-b
  );
  let scannerAdded=0;
  scannerRank.forEach(d=>{
    if(scannerAdded>=2)return;
    if(((candidate.targetFullHistoryScannerRouterBridgeScore||[])[d]||0)<=0)return;
    if(addSelected(d))scannerAdded++;
  });

  // Tahap 3: bila carry masih tersedia, pilih digit latest yang memang pernah terbukti carry
  // pada transisi historis; bukan sekadar karena ia muncul kemarin.
  const carryCounts=profile.carryDigitCounts||[];
  latestSet.slice().sort((a,b)=>
    (carryCounts[b]||0)-(carryCounts[a]||0) ||
    (score[b]||0)-(score[a]||0) || a-b
  ).forEach(d=>{
    if(selected.length<6&&(carryCounts[d]||0)>0)addSelected(d);
  });

  // Isi slot tersisa dari ranking gated, tetap tunduk pada carry cap.
  ranked.forEach(x=>{if(selected.length<6)addSelected(x.digit);});
  // Fallback terakhir hanya bila data sangat tipis.
  ranked.forEach(x=>{if(selected.length<6&&!selected.includes(x.digit))selected.push(x.digit);});

  // V11.2: Coverage Quorum Rotor.
  // Scanner bukan sekadar memberi skor: komposisi final wajib membawa kuorum digit yang
  // benar-benar berada di papan atas coverage seluruh riwayat. Carry latest yang masih
  // berada dalam batas empiris dilindungi; korban pertama adalah kandidat non-carry
  // di luar top coverage yang paling lemah.
  const historyCtx=candidate.targetFullHistoryCoverageBalanceBridgeContext;
  let coverageDecision='tidak ada penggantian';
  if(historyCtx){
    const maxCov=Math.max(1,...historyCtx.coverage);
    const broad=d=>historyCtx.positions[d].size>=2&&historyCtx.depthBands[d].size>=2&&historyCtx.coverage[d]/maxCov>=0.48;
    let broadCount=selected.filter(broad).length;
    const broadOutsiders=ranked.map(x=>x.digit).filter(d=>!selected.includes(d)&&broad(d));
    while(broadCount<2&&broadOutsiders.length){
      const incoming=broadOutsiders.shift();
      const victim=selected.slice().reverse().find(d=>!broad(d)&&(!latestSet.includes(d)||selected.filter(x=>latestSet.includes(x)).length>carryCap));
      if(victim==null)break;
      selected[selected.indexOf(victim)]=incoming;
      broadCount++;
      coverageDecision=`${victim} diganti ${incoming} oleh coverage lintas-depth`;
    }

    const topCoverage=historyCtx.digitRank.slice(0,6).map(x=>x.digit);
    const topCoverageSet=new Set(topCoverage);
    const deepEligible=d=>historyCtx.positions[d].size>=2&&historyCtx.depthBands[d].size>=2;
    const quorumTarget=historyCtx.n>=6?4:3;
    let quorumCount=selected.filter(d=>topCoverageSet.has(d)).length;
    const incomingQueue=topCoverage
      .filter(d=>!selected.includes(d)&&deepEligible(d))
      .sort((a,b)=>(historyCtx.coverage[b]||0)-(historyCtx.coverage[a]||0)||
        (historyCtx.recurrenceDigit[b]||0)-(historyCtx.recurrenceDigit[a]||0)||a-b);
    const rotorNotes=[];
    while(quorumCount<quorumTarget&&incomingQueue.length){
      const incoming=incomingQueue.shift();
      const carryNow=selected.filter(d=>latestSet.includes(d)).length;
      if(latestSet.includes(incoming)&&carryNow>=carryCap)continue;
      const victimPool=selected
        .filter(d=>!topCoverageSet.has(d))
        .filter(d=>!latestSet.includes(d))
        .sort((a,b)=>(score[a]||0)-(score[b]||0)||
          (historyCtx.coverage[a]||0)-(historyCtx.coverage[b]||0)||a-b);
      const fallbackPool=selected
        .filter(d=>!topCoverageSet.has(d))
        .filter(d=>!latestSet.includes(d)||carryNow>carryCap)
        .sort((a,b)=>(score[a]||0)-(score[b]||0)||
          (historyCtx.coverage[a]||0)-(historyCtx.coverage[b]||0)||a-b);
      const victim=victimPool[0]??fallbackPool[0];
      if(victim==null)break;
      selected[selected.indexOf(victim)]=incoming;
      quorumCount++;
      rotorNotes.push(`${victim}→${incoming}`);
    }
    if(rotorNotes.length){
      const rotorText=`coverage quorum ${rotorNotes.join(', ')} (${quorumCount}/${quorumTarget})`;
      coverageDecision=coverageDecision==='tidak ada penggantian'?rotorText:`${coverageDecision}; ${rotorText}`;
    }else if(coverageDecision==='tidak ada penggantian'){
      coverageDecision=`coverage quorum terpenuhi ${quorumCount}/${quorumTarget}`;
    }
  }

  const finalCarry=selected.filter(d=>latestSet.includes(d)).length;
  candidate.routerScore=score.slice();
  candidate.decisionEngine={
    mode:'scanner_gate_router',
    selected:selected.slice(),score,ranked,coverageDecision,
    carryCap,carryUsed:finalCarry,
    gateAllowed:(candidate.formulaGate?.allowed||[]).map(x=>x.label),
    gateBlocked:(candidate.formulaGate?.blocked||[]).map(x=>x.label),
    latestSet:latestSet.slice(),
    note:`V11.2 scanner menjadi formula gate dan coverage quorum rotor. Bridge tanpa bukti replay bernilai nol; minimal kuorum top-coverage dipenuhi tanpa melampaui carry latest ${finalCarry}/${carryCap}.`
  };
  return selected;
}

function chooseStrongFiveDigitsDecisionEngine(candidate, finalDigits){
  const score=candidate?.decisionEngine?.score||candidate?.routerScore||[];
  const final=uniqueDigits(finalDigits||[]);
  const historyCtx=candidate?.targetFullHistoryCoverageBalanceBridgeContext;
  const latestSet=new Set(candidate?.decisionEngine?.latestSet||[]);
  const selected=[];
  const add=d=>{d=Number(d);if(Number.isInteger(d)&&!selected.includes(d)&&final.includes(d)&&selected.length<5)selected.push(d);};
  if(historyCtx){
    // Empat slot utama mengikuti kuorum coverage penuh; satu slot terakhir boleh diisi
    // carry historis yang sah. Dengan begitu 5 digit tidak kembali menjadi latest-only.
    const topCoverageSet=new Set(historyCtx.digitRank.slice(0,6).map(x=>x.digit));
    final.filter(d=>topCoverageSet.has(d))
      .sort((a,b)=>(score[b]||0)-(score[a]||0)||
        (historyCtx.coverage[b]||0)-(historyCtx.coverage[a]||0)||a-b)
      .slice(0,4).forEach(add);
    final.filter(d=>latestSet.has(d)&&!selected.includes(d))
      .sort((a,b)=>((candidate.marketProfile?.carryDigitCounts||[])[b]||0)-((candidate.marketProfile?.carryDigitCounts||[])[a]||0)||
        (score[b]||0)-(score[a]||0)||a-b)
      .forEach(add);
  }
  final.slice().sort((a,b)=>(score[b]||0)-(score[a]||0)||a-b).forEach(add);
  candidate.strongFiveDigits=selected;
  if(candidate.decisionEngine)candidate.decisionEngine.strongFive=selected.slice();
  return selected;
}

function buildDecisionEngineAudit(audit){
  if(!audit || !audit.ranked) return null;
  return {
    title:'Decision Engine V11.2: scan penuh → gate formula → carry control → coverage quorum rotor → pilih 6 + hitung ulang 5 terkuat',
    selected:(audit.selected || []).join(' '),
    strongFive:(audit.strongFive || []).join(' '),
    top:audit.ranked.slice(0,10).map(x => `${x.digit}:${Math.round(x.points)} (${(x.reasons || []).slice(0,3).join(', ') || '-'})`),
    coverageDecision:audit.coverageDecision || '',
    carry:`${audit.carryUsed ?? '-'} / batas ${audit.carryCap ?? '-'}`,
    gate:`${(audit.gateAllowed || []).length} lolos; ${(audit.gateBlocked || []).length} diblokir`,
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
    add(d, 0.035*(candidate.score?.[d] || 0), 'skor formula dasar dibatasi scanner');
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
    add(d, 0.72*((candidate.targetFullHistoryScannerRouterBridgeTwinScore || [])[d] || 0), 'full-history scanner twin seed');
    add(d, 1.08*((candidate.targetFullHistoryCoverageBalanceTwinScore || [])[d] || 0), 'V11 full-history twin calibration');
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
    const doubleTwinTailMirror = (candidate.targetDoubleTwinTailMirrorBridgeTwinScore || [])[d] || 0;
    if(doubleTwinTailMirror > 0) add(d, Math.round(1.16*doubleTwinTailMirror), 'target double-twin tail-mirror twin priority');
    const boundaryTailCenterRepeat = (candidate.targetBoundaryTailCenterRepeatBridgeTwinScore || [])[d] || 0;
    if(boundaryTailCenterRepeat > 0) add(d, Math.round(1.28*boundaryTailCenterRepeat), 'target boundary-tail center-repeat twin priority');
    const anchorCenterZeroTwinReturn = (candidate.targetAnchorCenterZeroTwinReturnBridgeTwinScore || [])[d] || 0;
    if(anchorCenterZeroTwinReturn > 0) add(d, Math.round(1.42*anchorCenterZeroTwinReturn), 'target anchor-center zero-twin return twin priority');
    const zeroFrameTailTwinSum = (candidate.targetZeroFrameTailTwinSumBridgeTwinScore || [])[d] || 0;
    if(zeroFrameTailTwinSum > 0) add(d, Math.round(1.52*zeroFrameTailTwinSum), 'target zero-frame tail-twin sum twin priority');
    const edgeTwinAnchorZeroMirror = (candidate.targetEdgeTwinAnchorZeroMirrorBridgeTwinScore || [])[d] || 0;
    if(edgeTwinAnchorZeroMirror > 0) add(d, Math.round(1.72*edgeTwinAnchorZeroMirror), 'target edge-twin anchor-zero mirror twin priority');
    const tailTwinAnchorLRepeatReturn = (candidate.targetTailTwinAnchorLRepeatReturnBridgeTwinScore || [])[d] || 0;
    if(tailTwinAnchorLRepeatReturn > 0) add(d, Math.round(1.88*tailTwinAnchorLRepeatReturn), 'target tail-twin anchor-L repeat return twin priority');
    const centerTwinTailZeroFrontTwinReturn = (candidate.targetCenterTwinTailZeroFrontTwinReturnBridgeTwinScore || [])[d] || 0;
    if(centerTwinTailZeroFrontTwinReturn > 0) add(d, Math.round(2.04*centerTwinTailZeroFrontTwinReturn), 'target center-twin tail-zero front-twin return twin priority');
    const tailTwinFrontZeroDeltaReturn = (candidate.targetTailTwinFrontZeroDeltaReturnBridgeTwinScore || [])[d] || 0;
    if(tailTwinFrontZeroDeltaReturn > 0) add(d, Math.round(2.18*tailTwinFrontZeroDeltaReturn), 'target tail-twin front-zero delta return twin priority');
    const sharedFrontZeroLineEdgeRepeat = (candidate.targetSharedFrontZeroLineEdgeRepeatBridgeTwinScore || [])[d] || 0;
    if(sharedFrontZeroLineEdgeRepeat > 0) add(d, Math.round(2.34*sharedFrontZeroLineEdgeRepeat), 'target shared-front zero-line edge-repeat twin priority');
    const deepWeekdayCycleBalance = (candidate.targetDeepWeekdayCycleBalanceBridgeTwinScore || [])[d] || 0;
    if(deepWeekdayCycleBalance > 0) add(d, Math.round(2.46*deepWeekdayCycleBalance), 'target deep weekday cycle balance twin priority');
    const fullHistoryScannerRouter = (candidate.targetFullHistoryScannerRouterBridgeTwinScore || [])[d] || 0;
    if(fullHistoryScannerRouter > 0) add(d, Math.round(2.62*fullHistoryScannerRouter), 'full-history scanner router twin priority');
    const fullHistoryCoverageBalance = (candidate.targetFullHistoryCoverageBalanceTwinScore || [])[d] || 0;
    if(fullHistoryCoverageBalance > 0) add(d, Math.round(3.10*fullHistoryCoverageBalance), 'V11 full-history twin calibration priority');
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
  const doubleTwinTailMirrorTwin = candidate.targetDoubleTwinTailMirrorBridgeTwinDigit;
  const boundaryTailCenterRepeatTwin = candidate.targetBoundaryTailCenterRepeatBridgeTwinDigit;
  const anchorCenterZeroTwinReturnTwin = candidate.targetAnchorCenterZeroTwinReturnBridgeTwinDigit;
  const zeroFrameTailTwinSumTwin = candidate.targetZeroFrameTailTwinSumBridgeTwinDigit;
  const edgeTwinAnchorZeroMirrorTwin = candidate.targetEdgeTwinAnchorZeroMirrorBridgeTwinDigit;
  const tailTwinAnchorLRepeatReturnTwin = candidate.targetTailTwinAnchorLRepeatReturnBridgeTwinDigit;
  const centerTwinTailZeroFrontTwinReturnTwin = candidate.targetCenterTwinTailZeroFrontTwinReturnBridgeTwinDigit;
  const tailTwinFrontZeroDeltaReturnTwin = candidate.targetTailTwinFrontZeroDeltaReturnBridgeTwinDigit;
  const sharedFrontZeroLineEdgeRepeatTwin = candidate.targetSharedFrontZeroLineEdgeRepeatBridgeTwinDigit;
  const deepWeekdayCycleBalanceTwin = candidate.targetDeepWeekdayCycleBalanceBridgeTwinDigit;
  const fullHistoryScannerRouterTwin = candidate.targetFullHistoryScannerRouterBridgeTwinDigit;
  const fullHistoryCoverageBalanceTwin = candidate.targetFullHistoryCoverageBalanceTwinDigit;
  if(fullHistoryCoverageBalanceTwin != null && allowed.includes(fullHistoryCoverageBalanceTwin) && ((candidate.targetFullHistoryCoverageBalanceTwinScore || [])[fullHistoryCoverageBalanceTwin] || 0) >= 2600){
    chosen = fullHistoryCoverageBalanceTwin;
  }
  if(chosen == null && fullHistoryScannerRouterTwin != null && allowed.includes(fullHistoryScannerRouterTwin) && ((candidate.targetFullHistoryScannerRouterBridgeTwinScore || [])[fullHistoryScannerRouterTwin] || 0) >= 2600){
    chosen = fullHistoryScannerRouterTwin;
  }
  if(chosen == null && deepWeekdayCycleBalanceTwin != null && allowed.includes(deepWeekdayCycleBalanceTwin) && ((candidate.targetDeepWeekdayCycleBalanceBridgeTwinScore || [])[deepWeekdayCycleBalanceTwin] || 0) >= 2600){
    chosen = deepWeekdayCycleBalanceTwin;
  }
  if(chosen == null && sharedFrontZeroLineEdgeRepeatTwin != null && allowed.includes(sharedFrontZeroLineEdgeRepeatTwin) && ((candidate.targetSharedFrontZeroLineEdgeRepeatBridgeTwinScore || [])[sharedFrontZeroLineEdgeRepeatTwin] || 0) >= 2600){
    chosen = sharedFrontZeroLineEdgeRepeatTwin;
  }
  if(chosen == null && tailTwinFrontZeroDeltaReturnTwin != null && allowed.includes(tailTwinFrontZeroDeltaReturnTwin) && ((candidate.targetTailTwinFrontZeroDeltaReturnBridgeTwinScore || [])[tailTwinFrontZeroDeltaReturnTwin] || 0) >= 2600){
    chosen = tailTwinFrontZeroDeltaReturnTwin;
  }
  if(chosen == null && centerTwinTailZeroFrontTwinReturnTwin != null && allowed.includes(centerTwinTailZeroFrontTwinReturnTwin) && ((candidate.targetCenterTwinTailZeroFrontTwinReturnBridgeTwinScore || [])[centerTwinTailZeroFrontTwinReturnTwin] || 0) >= 2600){
    chosen = centerTwinTailZeroFrontTwinReturnTwin;
  }
  if(chosen == null && tailTwinAnchorLRepeatReturnTwin != null && allowed.includes(tailTwinAnchorLRepeatReturnTwin) && ((candidate.targetTailTwinAnchorLRepeatReturnBridgeTwinScore || [])[tailTwinAnchorLRepeatReturnTwin] || 0) >= 2600){
    chosen = tailTwinAnchorLRepeatReturnTwin;
  }
  if(chosen == null && edgeTwinAnchorZeroMirrorTwin != null && allowed.includes(edgeTwinAnchorZeroMirrorTwin) && ((candidate.targetEdgeTwinAnchorZeroMirrorBridgeTwinScore || [])[edgeTwinAnchorZeroMirrorTwin] || 0) >= 2600){
    chosen = edgeTwinAnchorZeroMirrorTwin;
  }
  if(chosen == null && zeroFrameTailTwinSumTwin != null && allowed.includes(zeroFrameTailTwinSumTwin) && ((candidate.targetZeroFrameTailTwinSumBridgeTwinScore || [])[zeroFrameTailTwinSumTwin] || 0) >= 2600){
    chosen = zeroFrameTailTwinSumTwin;
  }
  if(chosen == null && anchorCenterZeroTwinReturnTwin != null && allowed.includes(anchorCenterZeroTwinReturnTwin) && ((candidate.targetAnchorCenterZeroTwinReturnBridgeTwinScore || [])[anchorCenterZeroTwinReturnTwin] || 0) >= 2600){
    chosen = anchorCenterZeroTwinReturnTwin;
  }
  if(chosen == null && boundaryTailCenterRepeatTwin != null && allowed.includes(boundaryTailCenterRepeatTwin) && ((candidate.targetBoundaryTailCenterRepeatBridgeTwinScore || [])[boundaryTailCenterRepeatTwin] || 0) >= 2600){
    chosen = boundaryTailCenterRepeatTwin;
  }
  if(chosen == null && doubleTwinTailMirrorTwin != null && allowed.includes(doubleTwinTailMirrorTwin) && ((candidate.targetDoubleTwinTailMirrorBridgeTwinScore || [])[doubleTwinTailMirrorTwin] || 0) >= 2600){
    chosen = doubleTwinTailMirrorTwin;
  }
  if(chosen == null && tailReversalCenterTwin != null && allowed.includes(tailReversalCenterTwin) && ((candidate.targetTailReversalAnchorCenterTwinBridgeTwinScore || [])[tailReversalCenterTwin] || 0) >= 2600){
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
    const gateWeight=formulaGateSeedWeight(candidate,label);
    if(gateWeight<=0)return;
    (arr||[]).forEach(x => seeds.push({...x, bonus:Math.round(((x.bonus || 0) + bonus)*gateWeight), label:`${label}: ${x.label || ''}`}));
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
  pushSeeds(targetCenterTwinAnchorLineReturnBridgePairSeeds(latest, targetAnchor, candidate, kind), 0, 'target center-twin anchor-line return bridge');
  pushSeeds(targetTailZeroAnchorFrameCenterBridgePairSeeds(latest, targetAnchor, candidate, kind), 0, 'target tail-zero anchor-frame center bridge');
  pushSeeds(targetDoubleTwinTailMirrorBridgePairSeeds(latest, targetAnchor, candidate, kind), 0, 'target double-twin tail-mirror bridge');
  pushSeeds(targetAnchorEchoLMirrorBridgePairSeeds(latest, targetAnchor, candidate, kind), 0, 'target anchor-echo L-mirror bridge');
  pushSeeds(targetCenterSumTailLockBridgePairSeeds(latest, targetAnchor, candidate, kind), 0, 'target center-sum tail-lock bridge');
  pushSeeds(targetAnchorNineZeroTailMirrorBridgePairSeeds(latest, targetAnchor, candidate, kind), 0, 'target anchor-nine zero tail-mirror bridge');
  pushSeeds(targetAnchorCrossLockCenterZeroBridgePairSeeds(latest, targetAnchor, candidate, kind), 0, 'target anchor cross-lock center-zero bridge');
  pushSeeds(targetTailZeroAnchorFrontSumBridgePairSeeds(latest, targetAnchor, candidate, kind), 0, 'target tail-zero anchor-front sum bridge');
  pushSeeds(targetBoundaryTailCenterRepeatBridgePairSeeds(latest, targetAnchor, candidate, kind), 0, 'target boundary-tail center-repeat bridge');
  pushSeeds(targetCenterTwinFrontZeroReturnBridgePairSeeds(latest, targetAnchor, candidate, kind), 0, 'target center-twin front-zero return bridge');
  pushSeeds(targetBoundaryKAnchorLTwinMirrorBridgePairSeeds(latest, targetAnchor, candidate, kind), 0, 'target boundary-K anchor-L twin-mirror bridge');
  pushSeeds(targetAnchorCenterZeroTwinReturnBridgePairSeeds(latest, targetAnchor, candidate, kind), 0, 'target anchor-center zero-twin return bridge');
  pushSeeds(targetTailZeroCenterTwinAnchorSumBridgePairSeeds(latest, targetAnchor, candidate, kind), 0, 'target tail-zero center-twin anchor-sum bridge');
  pushSeeds(targetAnchorLockTailZeroMirrorBridgePairSeeds(latest, targetAnchor, candidate, kind), 0, 'target anchor-lock tail-zero mirror bridge');
  pushSeeds(targetCenterZeroAnchorTailTwinEchoBridgePairSeeds(latest, targetAnchor, candidate, kind), 0, 'target center-zero anchor-tail twin echo bridge');
  pushSeeds(targetZeroFrontCenterTwinCarryBridgePairSeeds(latest, targetAnchor, candidate, kind), 0, 'target zero-front center-twin carry bridge');
  pushSeeds(targetFrontTwinAnchorDeltaBridgePairSeeds(latest, targetAnchor, candidate, kind), 0, 'target front-twin anchor-delta bridge');
  pushSeeds(targetZeroFrameTailTwinSumBridgePairSeeds(latest, targetAnchor, candidate, kind), 0, 'target zero-frame tail-twin sum bridge');
  pushSeeds(targetEdgeTwinAnchorZeroMirrorBridgePairSeeds(latest, targetAnchor, candidate, kind), 0, 'target edge-twin anchor-zero mirror bridge');
  pushSeeds(targetTailTwinAnchorLRepeatReturnBridgePairSeeds(latest, targetAnchor, candidate, kind), 0, 'target tail-twin anchor-L repeat return bridge');
  pushSeeds(targetCenterTwinTailZeroFrontTwinReturnBridgePairSeeds(latest, targetAnchor, candidate, kind), 0, 'target center-twin tail-zero front-twin return bridge');
  pushSeeds(targetTailTwinFrontZeroDeltaReturnBridgePairSeeds(latest, targetAnchor, candidate, kind), 0, 'target tail-twin front-zero delta return bridge');
  pushSeeds(targetSharedFrontZeroLineEdgeRepeatBridgePairSeeds(latest, targetAnchor, candidate, kind), 0, 'target shared-front zero-line edge-repeat bridge');
  pushSeeds(targetAnchorZeroFrontEchoMirrorBridgePairSeeds(latest, targetAnchor, candidate, kind), 0, 'target anchor-zero front-echo mirror bridge');
  pushSeeds(targetDeepWeekdayCycleBalanceBridgePairSeeds(latest, targetAnchor, candidate, kind), 0, 'target deep weekday cycle balance bridge');
  pushSeeds(targetFullHistoryScannerRouterBridgePairSeeds(latest, targetAnchor, candidate, kind), 0, 'target full-history scanner router bridge');
  pushSeeds(targetFullHistoryCoverageBalanceBridgePairSeeds(latest, targetAnchor, candidate, kind), 0, 'target full-history position scanner');
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
  const pairDigitScore = candidate.routerScore || candidate.targetFullHistoryCoverageBalanceBridgeScore || candidate.score;
  const topDigits = DIGITS.slice().sort((a,b) => (pairDigitScore[b]||0) - (pairDigitScore[a]||0)).slice(0,7);
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
    const pairPower = candidate.routerScore || candidate.targetFullHistoryCoverageBalanceBridgeScore || candidate.score;
    const digitPower = 0.10*(pairPower[a] || 0) + 0.10*(pairPower[b] || 0);
    const anchorPower = 0.14*((candidate.targetAnchorScore || [])[a] || 0) + 0.14*((candidate.targetAnchorScore || [])[b] || 0);
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
  for(let i=0;i<Math.min(5, chrono.length-1);i++) earlyPairs.push(pairText(chrono[i], chrono[i+1], formulas));
  const recentPairs = [];
  for(let i=Math.max(0, chrono.length-8); i<chrono.length-1; i++) recentPairs.push(pairText(chrono[i], chrono[i+1], formulas));
  const allTargetAnchors=rows.filter(r=>r.day===targetDay);
  const weekPairs = buildWeekPairs(rows, formulas, latest.day, 8).concat(buildWeekPairs(rows, formulas, targetDay, 8));
  return [
    {title:'Tahap 1 • Scan kronologi penuh', icon:'①', delay:620, desc:`Sira Scanner membaca ${rows.length} baris dari riwayat tertua sampai terbaru tanpa menetapkan rumus terlebih dahulu.`, items:earlyPairs},
    {title:'Tahap 2 • Klasifikasi struktur', icon:'②', delay:680, desc:'Menandai posisi nol, twin, edge, center, root, jumlah, selisih, mirror, parity, dan perubahan hari pada setiap baris.', items:recentPairs.slice(0,6)},
    {title:'Tahap 3 • Replay seluruh transisi', icon:'③', delay:760, desc:`Menguji formula pada seluruh transisi historis. Formula yang hanya cocok sekali tidak boleh memaksa hasil.`, items:[`${Math.max(0,rows.length-1)} transisi tersedia untuk replay`,`Target hari ${targetDay}: ${allTargetAnchors.length} anchor ditemukan di seluruh kedalaman`]},
    {title:'Tahap 4 • Mining formula per posisi', icon:'④', delay:820, desc:'Mencari formula A, K, L, dan E dari seluruh kedalaman anchor; termasuk tambah, selisih, produk, mirror, root, dan offset golden sebagai kandidat uji.', items:weekPairs.slice(0,8)},
    {title:'Tahap 5 • Balance latest & twin', icon:'⑤', delay:680, desc:'Menurunkan digit latest yang tidak punya bukti sejarah luas dan menguji kandidat kembar dari seluruh ladder hari target.', items:['Latest boleh lolos hanya bila didukung scan.','Kembar dipilih dari bukti historis, bukan pengulangan terbaru semata.']},
    {title:'Tahap 6 • Router keputusan', icon:'⑥', delay:520, desc:'Menggabungkan formula yang lolos validasi, menyusun AKLE, lalu memilih 6 digit dan 5 digit terkuat.', items:['Tidak ada force-rescue setelah keputusan final.']}
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
  const targetCenterTwinAnchorLineReturnBridgeHtml = r.audit.targetCenterTwinAnchorLineReturnBridge ? `<div><b>Target center-twin anchor-line return bridge</b><ul class="process-list small"><li>${escapeHtml(r.audit.targetCenterTwinAnchorLineReturnBridge.title)}</li><li>Digit: ${escapeHtml(r.audit.targetCenterTwinAnchorLineReturnBridge.digits)}</li><li>AK: ${escapeHtml(r.audit.targetCenterTwinAnchorLineReturnBridge.ak)}${r.audit.targetCenterTwinAnchorLineReturnBridge.altAK ? ' / '+escapeHtml(r.audit.targetCenterTwinAnchorLineReturnBridge.altAK) : ''}</li><li>LE: ${escapeHtml(r.audit.targetCenterTwinAnchorLineReturnBridge.le)}${r.audit.targetCenterTwinAnchorLineReturnBridge.altLE ? ' / '+escapeHtml(r.audit.targetCenterTwinAnchorLineReturnBridge.altLE) : ''}</li></ul></div>` : '';
  const targetTailZeroAnchorFrameCenterBridgeHtml = r.audit.targetTailZeroAnchorFrameCenterBridge ? `<div><b>Target tail-zero anchor-frame center bridge</b><ul class="process-list small"><li>${escapeHtml(r.audit.targetTailZeroAnchorFrameCenterBridge.title)}</li><li>Digit: ${escapeHtml(r.audit.targetTailZeroAnchorFrameCenterBridge.digits)}</li><li>AK: ${escapeHtml(r.audit.targetTailZeroAnchorFrameCenterBridge.ak)}${r.audit.targetTailZeroAnchorFrameCenterBridge.altAK ? ' / '+escapeHtml(r.audit.targetTailZeroAnchorFrameCenterBridge.altAK) : ''}</li><li>LE: ${escapeHtml(r.audit.targetTailZeroAnchorFrameCenterBridge.le)}${r.audit.targetTailZeroAnchorFrameCenterBridge.altLE ? ' / '+escapeHtml(r.audit.targetTailZeroAnchorFrameCenterBridge.altLE) : ''}</li></ul></div>` : '';
  const targetDoubleTwinTailMirrorBridgeHtml = r.audit.targetDoubleTwinTailMirrorBridge ? `<div><b>Target double-twin tail-mirror bridge</b><ul class="process-list small"><li>${escapeHtml(r.audit.targetDoubleTwinTailMirrorBridge.title)}</li><li>Digit: ${escapeHtml(r.audit.targetDoubleTwinTailMirrorBridge.digits)}</li><li>AK: ${escapeHtml(r.audit.targetDoubleTwinTailMirrorBridge.ak)}${r.audit.targetDoubleTwinTailMirrorBridge.altAK ? ' / '+escapeHtml(r.audit.targetDoubleTwinTailMirrorBridge.altAK) : ''}</li><li>LE: ${escapeHtml(r.audit.targetDoubleTwinTailMirrorBridge.le)}${r.audit.targetDoubleTwinTailMirrorBridge.altLE ? ' / '+escapeHtml(r.audit.targetDoubleTwinTailMirrorBridge.altLE) : ''}</li></ul></div>` : '';
  const targetAnchorEchoLMirrorBridgeHtml = r.audit.targetAnchorEchoLMirrorBridge ? `<div><b>Target anchor-echo L-mirror bridge</b><ul class="process-list small"><li>${escapeHtml(r.audit.targetAnchorEchoLMirrorBridge.title)}</li><li>Digit: ${escapeHtml(r.audit.targetAnchorEchoLMirrorBridge.digits)}</li><li>AK: ${escapeHtml(r.audit.targetAnchorEchoLMirrorBridge.ak)}${r.audit.targetAnchorEchoLMirrorBridge.altAK ? ' / '+escapeHtml(r.audit.targetAnchorEchoLMirrorBridge.altAK) : ''}</li><li>LE: ${escapeHtml(r.audit.targetAnchorEchoLMirrorBridge.le)}${r.audit.targetAnchorEchoLMirrorBridge.altLE ? ' / '+escapeHtml(r.audit.targetAnchorEchoLMirrorBridge.altLE) : ''}</li></ul></div>` : '';
  const targetCenterSumTailLockBridgeHtml = r.audit.targetCenterSumTailLockBridge ? `<div><b>Target center-sum tail-lock bridge</b><ul class="process-list small"><li>${escapeHtml(r.audit.targetCenterSumTailLockBridge.title)}</li><li>Digit: ${escapeHtml(r.audit.targetCenterSumTailLockBridge.digits)}</li><li>AK: ${escapeHtml(r.audit.targetCenterSumTailLockBridge.ak)}${r.audit.targetCenterSumTailLockBridge.altAK ? ' / '+escapeHtml(r.audit.targetCenterSumTailLockBridge.altAK) : ''}</li><li>LE: ${escapeHtml(r.audit.targetCenterSumTailLockBridge.le)}${r.audit.targetCenterSumTailLockBridge.altLE ? ' / '+escapeHtml(r.audit.targetCenterSumTailLockBridge.altLE) : ''}</li></ul></div>` : '';
  const targetAnchorNineZeroTailMirrorBridgeHtml = r.audit.targetAnchorNineZeroTailMirrorBridge ? `<div><b>Target anchor-nine zero tail-mirror bridge</b><ul class="process-list small"><li>${escapeHtml(r.audit.targetAnchorNineZeroTailMirrorBridge.title)}</li><li>Digit: ${escapeHtml(r.audit.targetAnchorNineZeroTailMirrorBridge.digits)}</li><li>AK: ${escapeHtml(r.audit.targetAnchorNineZeroTailMirrorBridge.ak)}${r.audit.targetAnchorNineZeroTailMirrorBridge.altAK ? ' / '+escapeHtml(r.audit.targetAnchorNineZeroTailMirrorBridge.altAK) : ''}</li><li>LE: ${escapeHtml(r.audit.targetAnchorNineZeroTailMirrorBridge.le)}${r.audit.targetAnchorNineZeroTailMirrorBridge.altLE ? ' / '+escapeHtml(r.audit.targetAnchorNineZeroTailMirrorBridge.altLE) : ''}</li></ul></div>` : '';
  const targetAnchorCrossLockCenterZeroBridgeHtml = r.audit.targetAnchorCrossLockCenterZeroBridge ? `<div><b>Target anchor cross-lock center-zero bridge</b><ul class="process-list small"><li>${escapeHtml(r.audit.targetAnchorCrossLockCenterZeroBridge.title)}</li><li>Digit: ${escapeHtml(r.audit.targetAnchorCrossLockCenterZeroBridge.digits)}</li><li>AK: ${escapeHtml(r.audit.targetAnchorCrossLockCenterZeroBridge.ak)}${r.audit.targetAnchorCrossLockCenterZeroBridge.altAK ? ' / '+escapeHtml(r.audit.targetAnchorCrossLockCenterZeroBridge.altAK) : ''}</li><li>LE: ${escapeHtml(r.audit.targetAnchorCrossLockCenterZeroBridge.le)}${r.audit.targetAnchorCrossLockCenterZeroBridge.altLE ? ' / '+escapeHtml(r.audit.targetAnchorCrossLockCenterZeroBridge.altLE) : ''}</li></ul></div>` : '';
  const targetTailZeroAnchorFrontSumBridgeHtml = r.audit.targetTailZeroAnchorFrontSumBridge ? `<div><b>Target tail-zero anchor-front sum bridge</b><ul class="process-list small"><li>${escapeHtml(r.audit.targetTailZeroAnchorFrontSumBridge.title)}</li><li>Digit: ${escapeHtml(r.audit.targetTailZeroAnchorFrontSumBridge.digits)}</li><li>AK: ${escapeHtml(r.audit.targetTailZeroAnchorFrontSumBridge.ak)}${r.audit.targetTailZeroAnchorFrontSumBridge.altAK ? ' / '+escapeHtml(r.audit.targetTailZeroAnchorFrontSumBridge.altAK) : ''}</li><li>LE: ${escapeHtml(r.audit.targetTailZeroAnchorFrontSumBridge.le)}${r.audit.targetTailZeroAnchorFrontSumBridge.altLE ? ' / '+escapeHtml(r.audit.targetTailZeroAnchorFrontSumBridge.altLE) : ''}</li></ul></div>` : '';
  const targetBoundaryTailCenterRepeatBridgeHtml = r.audit.targetBoundaryTailCenterRepeatBridge ? `<div><b>Target boundary-tail center-repeat bridge</b><ul class="process-list small"><li>${escapeHtml(r.audit.targetBoundaryTailCenterRepeatBridge.title)}</li><li>Digit: ${escapeHtml(r.audit.targetBoundaryTailCenterRepeatBridge.digits)}</li><li>AK: ${escapeHtml(r.audit.targetBoundaryTailCenterRepeatBridge.ak)}${r.audit.targetBoundaryTailCenterRepeatBridge.altAK ? ' / '+escapeHtml(r.audit.targetBoundaryTailCenterRepeatBridge.altAK) : ''}</li><li>LE: ${escapeHtml(r.audit.targetBoundaryTailCenterRepeatBridge.le)}${r.audit.targetBoundaryTailCenterRepeatBridge.altLE ? ' / '+escapeHtml(r.audit.targetBoundaryTailCenterRepeatBridge.altLE) : ''}</li><li>Twin: ${escapeHtml(r.audit.targetBoundaryTailCenterRepeatBridge.twin)}</li></ul></div>` : '';
  const targetCenterTwinFrontZeroReturnBridgeHtml = r.audit.targetCenterTwinFrontZeroReturnBridge ? `<div><b>Target center-twin front-zero return bridge</b><ul class="process-list small"><li>${escapeHtml(r.audit.targetCenterTwinFrontZeroReturnBridge.title)}</li><li>Digit: ${escapeHtml(r.audit.targetCenterTwinFrontZeroReturnBridge.digits)}</li><li>AK: ${escapeHtml(r.audit.targetCenterTwinFrontZeroReturnBridge.ak)}${r.audit.targetCenterTwinFrontZeroReturnBridge.altAK ? ' / '+escapeHtml(r.audit.targetCenterTwinFrontZeroReturnBridge.altAK) : ''}</li><li>LE: ${escapeHtml(r.audit.targetCenterTwinFrontZeroReturnBridge.le)}${r.audit.targetCenterTwinFrontZeroReturnBridge.altLE ? ' / '+escapeHtml(r.audit.targetCenterTwinFrontZeroReturnBridge.altLE) : ''}</li></ul></div>` : '';
  const targetAnchorCenterZeroTwinReturnBridgeHtml = r.audit.targetAnchorCenterZeroTwinReturnBridge ? `<div><b>Target anchor-center zero-twin return bridge</b><ul class="process-list small"><li>${escapeHtml(r.audit.targetAnchorCenterZeroTwinReturnBridge.title)}</li><li>Digit: ${escapeHtml(r.audit.targetAnchorCenterZeroTwinReturnBridge.digits)}</li><li>AK: ${escapeHtml(r.audit.targetAnchorCenterZeroTwinReturnBridge.ak)}${r.audit.targetAnchorCenterZeroTwinReturnBridge.altAK ? ' / '+escapeHtml(r.audit.targetAnchorCenterZeroTwinReturnBridge.altAK) : ''}</li><li>LE: ${escapeHtml(r.audit.targetAnchorCenterZeroTwinReturnBridge.le)}${r.audit.targetAnchorCenterZeroTwinReturnBridge.altLE ? ' / '+escapeHtml(r.audit.targetAnchorCenterZeroTwinReturnBridge.altLE) : ''}</li><li>Twin: ${escapeHtml(r.audit.targetAnchorCenterZeroTwinReturnBridge.twin || '-')}</li></ul></div>` : '';
  const targetTailZeroCenterTwinAnchorSumBridgeHtml = r.audit.targetTailZeroCenterTwinAnchorSumBridge ? `<div><b>Target tail-zero center-twin anchor-sum bridge</b><ul class="process-list small"><li>${escapeHtml(r.audit.targetTailZeroCenterTwinAnchorSumBridge.title)}</li><li>Digit: ${escapeHtml(r.audit.targetTailZeroCenterTwinAnchorSumBridge.digits)}</li><li>AK: ${escapeHtml(r.audit.targetTailZeroCenterTwinAnchorSumBridge.ak)}${r.audit.targetTailZeroCenterTwinAnchorSumBridge.altAK ? ' / '+escapeHtml(r.audit.targetTailZeroCenterTwinAnchorSumBridge.altAK) : ''}</li><li>LE: ${escapeHtml(r.audit.targetTailZeroCenterTwinAnchorSumBridge.le)}${r.audit.targetTailZeroCenterTwinAnchorSumBridge.altLE ? ' / '+escapeHtml(r.audit.targetTailZeroCenterTwinAnchorSumBridge.altLE) : ''}</li></ul></div>` : '';
  const targetAnchorLockTailZeroMirrorBridgeHtml = r.audit.targetAnchorLockTailZeroMirrorBridge ? `<div><b>Target anchor-lock tail-zero mirror bridge</b><ul class="process-list small"><li>${escapeHtml(r.audit.targetAnchorLockTailZeroMirrorBridge.title)}</li><li>Digit: ${escapeHtml(r.audit.targetAnchorLockTailZeroMirrorBridge.digits)}</li><li>AK: ${escapeHtml(r.audit.targetAnchorLockTailZeroMirrorBridge.ak)}${r.audit.targetAnchorLockTailZeroMirrorBridge.altAK ? ' / '+escapeHtml(r.audit.targetAnchorLockTailZeroMirrorBridge.altAK) : ''}</li><li>LE: ${escapeHtml(r.audit.targetAnchorLockTailZeroMirrorBridge.le)}${r.audit.targetAnchorLockTailZeroMirrorBridge.altLE ? ' / '+escapeHtml(r.audit.targetAnchorLockTailZeroMirrorBridge.altLE) : ''}</li></ul></div>` : '';
  const targetCenterZeroAnchorTailTwinEchoBridgeHtml = r.audit.targetCenterZeroAnchorTailTwinEchoBridge ? `<div><b>Target center-zero anchor-tail twin echo bridge</b><ul class="process-list small"><li>${escapeHtml(r.audit.targetCenterZeroAnchorTailTwinEchoBridge.title)}</li><li>Digit: ${escapeHtml(r.audit.targetCenterZeroAnchorTailTwinEchoBridge.digits)}</li><li>AK: ${escapeHtml(r.audit.targetCenterZeroAnchorTailTwinEchoBridge.ak)}${r.audit.targetCenterZeroAnchorTailTwinEchoBridge.altAK ? ' / '+escapeHtml(r.audit.targetCenterZeroAnchorTailTwinEchoBridge.altAK) : ''}</li><li>LE: ${escapeHtml(r.audit.targetCenterZeroAnchorTailTwinEchoBridge.le)}${r.audit.targetCenterZeroAnchorTailTwinEchoBridge.altLE ? ' / '+escapeHtml(r.audit.targetCenterZeroAnchorTailTwinEchoBridge.altLE) : ''}</li></ul></div>` : '';
  const targetZeroFrontCenterTwinCarryBridgeHtml = r.audit.targetZeroFrontCenterTwinCarryBridge ? `<div><b>Target zero-front center-twin carry bridge</b><ul class="process-list small"><li>${escapeHtml(r.audit.targetZeroFrontCenterTwinCarryBridge.title)}</li><li>Digit: ${escapeHtml(r.audit.targetZeroFrontCenterTwinCarryBridge.digits)}</li><li>AK: ${escapeHtml(r.audit.targetZeroFrontCenterTwinCarryBridge.ak)}${r.audit.targetZeroFrontCenterTwinCarryBridge.altAK ? ' / '+escapeHtml(r.audit.targetZeroFrontCenterTwinCarryBridge.altAK) : ''}</li><li>LE: ${escapeHtml(r.audit.targetZeroFrontCenterTwinCarryBridge.le)}${r.audit.targetZeroFrontCenterTwinCarryBridge.altLE ? ' / '+escapeHtml(r.audit.targetZeroFrontCenterTwinCarryBridge.altLE) : ''}</li></ul></div>` : '';
  const targetFrontTwinAnchorDeltaBridgeHtml = r.audit.targetFrontTwinAnchorDeltaBridge ? `<div><b>Target front-twin anchor-delta bridge</b><ul class="process-list small"><li>${escapeHtml(r.audit.targetFrontTwinAnchorDeltaBridge.title)}</li><li>Digit: ${escapeHtml(r.audit.targetFrontTwinAnchorDeltaBridge.digits)}</li><li>AK: ${escapeHtml(r.audit.targetFrontTwinAnchorDeltaBridge.ak)}${r.audit.targetFrontTwinAnchorDeltaBridge.altAK ? ' / '+escapeHtml(r.audit.targetFrontTwinAnchorDeltaBridge.altAK) : ''}</li><li>LE: ${escapeHtml(r.audit.targetFrontTwinAnchorDeltaBridge.le)}${r.audit.targetFrontTwinAnchorDeltaBridge.altLE ? ' / '+escapeHtml(r.audit.targetFrontTwinAnchorDeltaBridge.altLE) : ''}</li></ul></div>` : '';
  const targetBoundaryKAnchorLTwinMirrorBridgeHtml = r.audit.targetBoundaryKAnchorLTwinMirrorBridge ? `<div><b>Target boundary-K anchor-L twin-mirror bridge</b><ul class="process-list small"><li>${escapeHtml(r.audit.targetBoundaryKAnchorLTwinMirrorBridge.title)}</li><li>Digit: ${escapeHtml(r.audit.targetBoundaryKAnchorLTwinMirrorBridge.digits)}</li><li>AK: ${escapeHtml(r.audit.targetBoundaryKAnchorLTwinMirrorBridge.ak)}${r.audit.targetBoundaryKAnchorLTwinMirrorBridge.altAK ? ' / '+escapeHtml(r.audit.targetBoundaryKAnchorLTwinMirrorBridge.altAK) : ''}</li><li>LE: ${escapeHtml(r.audit.targetBoundaryKAnchorLTwinMirrorBridge.le)}${r.audit.targetBoundaryKAnchorLTwinMirrorBridge.altLE ? ' / '+escapeHtml(r.audit.targetBoundaryKAnchorLTwinMirrorBridge.altLE) : ''}</li><li>Twin: ${escapeHtml(r.audit.targetBoundaryKAnchorLTwinMirrorBridge.twin || '-')}</li></ul></div>` : '';
  const targetEdgeTwinAnchorZeroMirrorBridgeHtml = r.audit.targetEdgeTwinAnchorZeroMirrorBridge ? `<div><b>Target edge-twin anchor-zero mirror bridge</b><ul class="process-list small"><li>${escapeHtml(r.audit.targetEdgeTwinAnchorZeroMirrorBridge.title)}</li><li>Digit: ${escapeHtml(r.audit.targetEdgeTwinAnchorZeroMirrorBridge.digits)}</li><li>AK: ${escapeHtml(r.audit.targetEdgeTwinAnchorZeroMirrorBridge.ak)}${r.audit.targetEdgeTwinAnchorZeroMirrorBridge.altAK ? ' / '+escapeHtml(r.audit.targetEdgeTwinAnchorZeroMirrorBridge.altAK) : ''}</li><li>LE: ${escapeHtml(r.audit.targetEdgeTwinAnchorZeroMirrorBridge.le)}${r.audit.targetEdgeTwinAnchorZeroMirrorBridge.altLE ? ' / '+escapeHtml(r.audit.targetEdgeTwinAnchorZeroMirrorBridge.altLE) : ''}</li><li>Twin: ${escapeHtml(r.audit.targetEdgeTwinAnchorZeroMirrorBridge.twin || '-')}</li></ul></div>` : '';
  const targetTailTwinAnchorLRepeatReturnBridgeHtml = r.audit.targetTailTwinAnchorLRepeatReturnBridge ? `<div><b>Target tail-twin anchor-L repeat return bridge</b><ul class="process-list small"><li>${escapeHtml(r.audit.targetTailTwinAnchorLRepeatReturnBridge.title)}</li><li>Digit: ${escapeHtml(r.audit.targetTailTwinAnchorLRepeatReturnBridge.digits)}</li><li>AK: ${escapeHtml(r.audit.targetTailTwinAnchorLRepeatReturnBridge.ak)}${r.audit.targetTailTwinAnchorLRepeatReturnBridge.altAK ? ' / '+escapeHtml(r.audit.targetTailTwinAnchorLRepeatReturnBridge.altAK) : ''}</li><li>LE: ${escapeHtml(r.audit.targetTailTwinAnchorLRepeatReturnBridge.le)}${r.audit.targetTailTwinAnchorLRepeatReturnBridge.altLE ? ' / '+escapeHtml(r.audit.targetTailTwinAnchorLRepeatReturnBridge.altLE) : ''}</li><li>Twin: ${escapeHtml(r.audit.targetTailTwinAnchorLRepeatReturnBridge.twin || '-')}</li></ul></div>` : '';
  const targetCenterTwinTailZeroFrontTwinReturnBridgeHtml = r.audit.targetCenterTwinTailZeroFrontTwinReturnBridge ? `<div><b>Target center-twin tail-zero front-twin return bridge</b><ul class="process-list small"><li>${escapeHtml(r.audit.targetCenterTwinTailZeroFrontTwinReturnBridge.title)}</li><li>Digit: ${escapeHtml(r.audit.targetCenterTwinTailZeroFrontTwinReturnBridge.digits)}</li><li>AK: ${escapeHtml(r.audit.targetCenterTwinTailZeroFrontTwinReturnBridge.ak)}${r.audit.targetCenterTwinTailZeroFrontTwinReturnBridge.altAK ? ' / '+escapeHtml(r.audit.targetCenterTwinTailZeroFrontTwinReturnBridge.altAK) : ''}</li><li>LE: ${escapeHtml(r.audit.targetCenterTwinTailZeroFrontTwinReturnBridge.le)}${r.audit.targetCenterTwinTailZeroFrontTwinReturnBridge.altLE ? ' / '+escapeHtml(r.audit.targetCenterTwinTailZeroFrontTwinReturnBridge.altLE) : ''}</li><li>Twin: ${escapeHtml(r.audit.targetCenterTwinTailZeroFrontTwinReturnBridge.twin || '-')}</li></ul></div>` : '';
  const targetTailTwinFrontZeroDeltaReturnBridgeHtml = r.audit.targetTailTwinFrontZeroDeltaReturnBridge ? `<div><b>Target tail-twin front-zero delta return bridge</b><ul class="process-list small"><li>${escapeHtml(r.audit.targetTailTwinFrontZeroDeltaReturnBridge.title)}</li><li>Digit: ${escapeHtml(r.audit.targetTailTwinFrontZeroDeltaReturnBridge.digits)}</li><li>AK: ${escapeHtml(r.audit.targetTailTwinFrontZeroDeltaReturnBridge.ak)}${r.audit.targetTailTwinFrontZeroDeltaReturnBridge.altAK ? ' / '+escapeHtml(r.audit.targetTailTwinFrontZeroDeltaReturnBridge.altAK) : ''}</li><li>LE: ${escapeHtml(r.audit.targetTailTwinFrontZeroDeltaReturnBridge.le)}${r.audit.targetTailTwinFrontZeroDeltaReturnBridge.altLE ? ' / '+escapeHtml(r.audit.targetTailTwinFrontZeroDeltaReturnBridge.altLE) : ''}</li><li>Twin: ${escapeHtml(r.audit.targetTailTwinFrontZeroDeltaReturnBridge.twin || '-')}</li></ul></div>` : '';
  const targetSharedFrontZeroLineEdgeRepeatBridgeHtml = r.audit.targetSharedFrontZeroLineEdgeRepeatBridge ? `<div><b>Target shared-front zero-line edge-repeat bridge</b><ul class="process-list small"><li>${escapeHtml(r.audit.targetSharedFrontZeroLineEdgeRepeatBridge.title)}</li><li>Digit: ${escapeHtml(r.audit.targetSharedFrontZeroLineEdgeRepeatBridge.digits)}</li><li>AK: ${escapeHtml(r.audit.targetSharedFrontZeroLineEdgeRepeatBridge.ak)}${r.audit.targetSharedFrontZeroLineEdgeRepeatBridge.altAK ? ' / '+escapeHtml(r.audit.targetSharedFrontZeroLineEdgeRepeatBridge.altAK) : ''}</li><li>LE: ${escapeHtml(r.audit.targetSharedFrontZeroLineEdgeRepeatBridge.le)}${r.audit.targetSharedFrontZeroLineEdgeRepeatBridge.altLE ? ' / '+escapeHtml(r.audit.targetSharedFrontZeroLineEdgeRepeatBridge.altLE) : ''}</li><li>Twin: ${escapeHtml(r.audit.targetSharedFrontZeroLineEdgeRepeatBridge.twin || '-')}</li></ul></div>` : '';
  const targetDeepWeekdayCycleBalanceBridgeHtml = r.audit.targetDeepWeekdayCycleBalanceBridge ? `<div><b>Target deep weekday cycle balance bridge</b><ul class="process-list small"><li>${escapeHtml(r.audit.targetDeepWeekdayCycleBalanceBridge.title)}</li><li>Digit: ${escapeHtml(r.audit.targetDeepWeekdayCycleBalanceBridge.digits)}</li><li>Mode: ${escapeHtml(r.audit.targetDeepWeekdayCycleBalanceBridge.modes)}</li><li>${escapeHtml(r.audit.targetDeepWeekdayCycleBalanceBridge.detail || '')}</li></ul></div>` : '';
  const targetFullHistoryScannerRouterBridgeHtml = r.audit.targetFullHistoryScannerRouterBridge ? `<div><b>Full-history scanner formula router</b><ul class="process-list small"><li>${escapeHtml(r.audit.targetFullHistoryScannerRouterBridge.title)}</li><li>Digit: ${escapeHtml(r.audit.targetFullHistoryScannerRouterBridge.digits)}</li><li>AK router: ${escapeHtml(r.audit.targetFullHistoryScannerRouterBridge.ak)}</li><li>LE router: ${escapeHtml(r.audit.targetFullHistoryScannerRouterBridge.le)}</li><li>${escapeHtml(r.audit.targetFullHistoryScannerRouterBridge.detail || '')}</li></ul></div>` : '';
  const targetFullHistoryCoverageBalanceBridgeHtml = r.audit.targetFullHistoryCoverageBalanceBridge ? `<div><b>Sira full-history position scanner</b><ul class="process-list small"><li>${escapeHtml(r.audit.targetFullHistoryCoverageBalanceBridge.title)}</li><li>Digit coverage: ${escapeHtml(r.audit.targetFullHistoryCoverageBalanceBridge.digits)}</li><li>AK mining: ${escapeHtml(r.audit.targetFullHistoryCoverageBalanceBridge.ak)}</li><li>LE mining: ${escapeHtml(r.audit.targetFullHistoryCoverageBalanceBridge.le)}</li><li>Twin: ${escapeHtml(r.audit.targetFullHistoryCoverageBalanceBridge.twin)}</li><li>${escapeHtml(r.audit.targetFullHistoryCoverageBalanceBridge.detail || '')}</li></ul></div>` : '';
  const targetAnchorZeroFrontEchoMirrorBridgeHtml = r.audit.targetAnchorZeroFrontEchoMirrorBridge ? `<div><b>Target anchor-zero front-echo mirror bridge</b><ul class="process-list small"><li>${escapeHtml(r.audit.targetAnchorZeroFrontEchoMirrorBridge.title)}</li><li>Digit: ${escapeHtml(r.audit.targetAnchorZeroFrontEchoMirrorBridge.digits)}</li><li>AK: ${escapeHtml(r.audit.targetAnchorZeroFrontEchoMirrorBridge.ak)}${r.audit.targetAnchorZeroFrontEchoMirrorBridge.altAK ? ' / '+escapeHtml(r.audit.targetAnchorZeroFrontEchoMirrorBridge.altAK) : ''}</li><li>LE: ${escapeHtml(r.audit.targetAnchorZeroFrontEchoMirrorBridge.le)}${r.audit.targetAnchorZeroFrontEchoMirrorBridge.altLE ? ' / '+escapeHtml(r.audit.targetAnchorZeroFrontEchoMirrorBridge.altLE) : ''}</li></ul></div>` : '';
  const targetFrontCarryAnchorTwinBridgeHtml = r.audit.targetFrontCarryAnchorTwinBridge ? `<div><b>Target front-carry anchor-twin bridge</b><ul class="process-list small"><li>${escapeHtml(r.audit.targetFrontCarryAnchorTwinBridge.title)}</li><li>Digit: ${escapeHtml(r.audit.targetFrontCarryAnchorTwinBridge.digits)}</li><li>AK: ${escapeHtml(r.audit.targetFrontCarryAnchorTwinBridge.ak)}${r.audit.targetFrontCarryAnchorTwinBridge.altAK ? ' / '+escapeHtml(r.audit.targetFrontCarryAnchorTwinBridge.altAK) : ''}</li><li>LE: ${escapeHtml(r.audit.targetFrontCarryAnchorTwinBridge.le)}${r.audit.targetFrontCarryAnchorTwinBridge.altLE ? ' / '+escapeHtml(r.audit.targetFrontCarryAnchorTwinBridge.altLE) : ''}</li></ul></div>` : '';
  const formulaGateHtml = r.audit.formulaGate ? `<div><b>Scanner Formula Gate</b><ul class="process-list small"><li>${escapeHtml(r.audit.formulaGate.title)}</li><li><b>Lolos</b></li>${(r.audit.formulaGate.allowed || []).slice(0,8).map(x => `<li>${escapeHtml(x)}</li>`).join('') || '<li>Tidak ada bridge lama yang lolos; scanner-native mengambil alih.</li>'}<li><b>Diblokir</b></li>${(r.audit.formulaGate.blocked || []).slice(0,6).map(x => `<li>${escapeHtml(x)}</li>`).join('') || '<li>-</li>'}</ul></div>` : '';
  const decisionEngineHtml = r.audit.decisionEngine ? `<div><b>Decision Engine</b><ul class="process-list small"><li>${escapeHtml(r.audit.decisionEngine.title)}</li><li>Terpilih 6 digit: ${escapeHtml(r.audit.decisionEngine.selected)}</li><li>5 digit terkuat: ${escapeHtml(r.audit.decisionEngine.strongFive || '')}</li><li>Coverage decision: ${escapeHtml(r.audit.decisionEngine.coverageDecision || '-')}</li><li>Carry latest: ${escapeHtml(r.audit.decisionEngine.carry || '-')}</li><li>Formula gate: ${escapeHtml(r.audit.decisionEngine.gate || '-')}</li>${r.audit.decisionEngine.top.slice(0,8).map(x => `<li>${escapeHtml(x)}</li>`).join('')}</ul></div>` : '';
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
      ${targetCenterTwinAnchorLineReturnBridgeHtml}
      ${targetTailZeroAnchorFrameCenterBridgeHtml}
      ${targetDoubleTwinTailMirrorBridgeHtml}
      ${targetAnchorEchoLMirrorBridgeHtml}
      ${targetCenterSumTailLockBridgeHtml}
      ${targetAnchorNineZeroTailMirrorBridgeHtml}
      ${targetAnchorCrossLockCenterZeroBridgeHtml}
      ${targetTailZeroAnchorFrontSumBridgeHtml}
      ${targetBoundaryTailCenterRepeatBridgeHtml}
      ${targetCenterTwinFrontZeroReturnBridgeHtml}
      ${targetBoundaryKAnchorLTwinMirrorBridgeHtml}
      ${targetAnchorCenterZeroTwinReturnBridgeHtml}
      ${targetTailZeroCenterTwinAnchorSumBridgeHtml}
      ${targetAnchorLockTailZeroMirrorBridgeHtml}
      ${targetCenterZeroAnchorTailTwinEchoBridgeHtml}
      ${targetZeroFrontCenterTwinCarryBridgeHtml}
      ${targetFrontTwinAnchorDeltaBridgeHtml}
      ${targetEdgeTwinAnchorZeroMirrorBridgeHtml}
      ${targetTailTwinAnchorLRepeatReturnBridgeHtml}
      ${targetCenterTwinTailZeroFrontTwinReturnBridgeHtml}
      ${targetTailTwinFrontZeroDeltaReturnBridgeHtml}
      ${targetSharedFrontZeroLineEdgeRepeatBridgeHtml}
      ${targetAnchorZeroFrontEchoMirrorBridgeHtml}
      ${targetDeepWeekdayCycleBalanceBridgeHtml}
      ${targetFullHistoryScannerRouterBridgeHtml}
      ${targetFullHistoryCoverageBalanceBridgeHtml}
      ${targetFrontCarryAnchorTwinBridgeHtml}
      ${formulaGateHtml}
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
      <p class="tagline">Engine V11.2 memakai Scanner-Gated Formula Router + Coverage Quorum Rotor: seluruh riwayat dipindai dari tertua ke terbaru, setiap keluarga formula direplay, bridge tanpa bukti diblokir, carry latest dibatasi, lalu komposisi final wajib memenuhi kuorum coverage lintas-depth sebelum 6 digit dan 5 digit ditetapkan.</p>
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
