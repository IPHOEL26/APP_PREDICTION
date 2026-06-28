'use strict';

const DIGITS = [0,1,2,3,4,5,6,7,8,9];
const DAYS = ['minggu','senin','selasa','rabu','kamis','jumat','sabtu'];
const MONTHS = {
  jan:1,january:1,januari:1,
  feb:2,february:2,februari:2,
  mar:3,march:3,maret:3,
  apr:4,april:4,
  may:5,mei:5,
  jun:6,june:6,juni:6,
  jul:7,july:7,juli:7,
  aug:8,august:8,agt:8,agustus:8,
  sep:9,sept:9,september:9,
  oct:10,okt:10,october:10,oktober:10,
  nov:11,november:11,
  dec:12,des:12,december:12,desember:12
};

const MARKET_META = {
  SGP4D:{label:'SGP 4D', aliases:['SGP','SINGAPORE','SINGAPURA','4D'], official:'Singapore Pools 4D', url:'https://www.singaporepools.com.sg/en/product/pages/4d_results.aspx', status:'verified', note:'Sumber resmi untuk 4D Singapore Pools.'},
  SGPTOTO:{label:'SGP TOTO', aliases:['TOTO SINGAPORE','SINGAPORE TOTO'], official:'Singapore Pools TOTO', url:'https://www.singaporepools.com.sg/en/product/pages/toto_results.aspx', status:'verified', note:'Untuk format 6 angka + additional number.'},
  SYD:{label:'SYD / SDY', aliases:['SYD','SDY','SYDNEY','SYL','SYL3P'], official:'The Lott Australia', url:'https://www.thelott.com/results', status:'verified-link', note:'Link resmi Australia. Format input 4D dari file tetap dapat dianalisis sebagai arsip riset.'},
  HKG:{label:'HK / HKG', aliases:['HK','HKG','HONGKONG','HONG KONG','HKL','HKL3P'], official:'HKJC Mark Six', url:'https://bet.hkjc.com/en/marksix/results', status:'verified', note:'Sumber resmi Mark Six. Format input 4D dari file tetap bisa diproses sebagai arsip riset.'},
  PCSO:{label:'PCSO', aliases:['PCSO','PCS','PJSO'], official:'PCSO', url:'https://www.pcso.gov.ph/searchlottoresult.aspx', status:'verified', note:'PCSO menyediakan pencarian hasil draw berdasarkan tanggal dan game.'},
  WSV:{label:'West Virginia', aliases:['WSV','WV','WEST VIRGINIA'], official:'West Virginia Lottery Daily 4', url:'https://wvlottery.com/games/draw-games/daily-4', status:'verified', note:'Sumber resmi Daily 4 West Virginia Lottery.'},
  INDIANA:{label:'Indiana', aliases:['INDIANA','INM','IDE'], official:'Hoosier Lottery Daily 4', url:'https://www.hoosierlottery.com/games/daily-4', status:'verified-link', note:'Link resmi Indiana. Fetch browser bisa saja diblokir oleh CORS.'},
  PENNSYLVANIA:{label:'Pennsylvania', aliases:['PENNSYLVANIA','PEN','PA','PICK 4'], official:'PA Lottery Pick 4', url:'https://www.palottery.com/', status:'verified', note:'Sumber resmi menampilkan PICK 4 dan riwayat pemenang.'},
  TOTO_MACAU:{label:'Toto Macau', aliases:['TOTO MACAU','MACAU','TM1','TM2','TM3','TM4','TM5'], official:'Belum terverifikasi', url:'', status:'unverified', note:'Saya belum menemukan operator resmi yang cukup jelas. Data tetap bisa dianalisis bila Anda tempel sendiri.'},
  TEXAS:{label:'Texas', aliases:['TEXAS','TXD','TXE','TXN','TXM'], official:'Texas Lottery', url:'https://www.texaslottery.com/export/sites/lottery/Games/Daily_4/index.html', status:'verified-link', note:'Link resmi Texas Daily 4.'},
  FLORIDA:{label:'Florida', aliases:['FLORIDA','FLM','FLE'], official:'Florida Lottery Pick 4', url:'https://floridalottery.com/games/draw-games/pick-4', status:'verified-link', note:'Link resmi Florida Pick 4.'},
  ILLINOIS:{label:'Illinois', aliases:['ILLINOIS','ILM','INE'], official:'Illinois Lottery Pick 4', url:'https://www.illinoislottery.com/dbg/results/pick4', status:'verified-link', note:'Link resmi Illinois Pick 4.'},
  NEWYORK:{label:'New York', aliases:['NEW YORK','NYM','NYE'], official:'New York Lottery Numbers', url:'https://nylottery.ny.gov/draw-game?game=win4', status:'verified-link', note:'Link resmi New York Win 4.'},
  VIRGINIA:{label:'Virginia', aliases:['VIRGINIA','VID','VIN'], official:'Virginia Lottery Pick 4', url:'https://www.valottery.com/draw-games/pick4', status:'verified-link', note:'Link resmi Virginia Pick 4.'},
  GEORGIA:{label:'Georgia', aliases:['GEORGIA','GRM','GRE','GRN'], official:'Georgia Lottery Cash 4', url:'https://www.galottery.com/en-us/play-games/draw-games/cash-4.html', status:'verified-link', note:'Link resmi Georgia Cash 4.'},
  CALIFORNIA:{label:'California', aliases:['CALIFORNIA','CLF'], official:'California Lottery Daily 4', url:'https://www.calottery.com/draw-games/daily-4', status:'verified-link', note:'Link resmi California Daily 4.'},
  OHIO:{label:'Ohio', aliases:['OHIO','OHM','OHE'], official:'Ohio Lottery Pick 4', url:'https://www.ohiolottery.com/games/draw-games/pick-4', status:'verified-link', note:'Link resmi Ohio Pick 4.'},
  MICHIGAN:{label:'Michigan', aliases:['MICHIGAN','MCM','MCE'], official:'Michigan Lottery Daily 4', url:'https://www.michiganlottery.com/games/daily4', status:'verified-link', note:'Link resmi Michigan Daily 4.'},
  OREGON:{label:'Oregon', aliases:['OREGON','OO4','O07','O10','O13'], official:'Oregon Lottery', url:'https://www.oregonlottery.org/pick-4/', status:'verified-link', note:'Link resmi Oregon Pick 4.'},
  UTAH:{label:'Utah', aliases:['UTAH','UTD','UTE','UTM'], official:'Utah Lottery tidak tersedia', url:'', status:'unverified', note:'Utah tidak memiliki lottery negara bagian tradisional. Data dari file tetap dapat dianalisis sebagai arsip Anda.'},
  OTHER:{label:'Lainnya', aliases:[], official:'Arsip pengguna', url:'', status:'user-data', note:'Market dibaca dari input pengguna.'}
};

const PRESET_MARKETS = ['SGP4D','SGPTOTO','SYD','HKG','PCSO','WSV','INDIANA','PENNSYLVANIA','TOTO_MACAU','TEXAS','FLORIDA','ILLINOIS','NEWYORK','VIRGINIA'];
let currentMarket = 'SGP4D';
let parsedRows = [];
let lastReportText = '';

const $ = (id) => document.getElementById(id);

function init(){
  renderMarketButtons(PRESET_MARKETS);
  bindEvents();
  updateSourceCard();
  updateCounter();
}

document.addEventListener('DOMContentLoaded', init);

function bindEvents(){
  $('btnProcess').addEventListener('click', () => processActive(false));
  $('btnProcessTop').addEventListener('click', () => processActive(false));
  $('btnBacktest').addEventListener('click', () => processActive(true));
  $('btnAllAudit').addEventListener('click', auditAllMarkets);
  $('btnScanMarkets').addEventListener('click', scanMarketsFromInput);
  $('btnOpenOfficial').addEventListener('click', openOfficial);
  $('btnTryFetch').addEventListener('click', tryFetchOfficial);
  $('btnFetchCustom').addEventListener('click', fetchCustomUrl);
  $('btnExportCsv').addEventListener('click', exportCsv);
  $('btnCopyReport').addEventListener('click', copyReport);
  $('btnSaveLocal').addEventListener('click', saveLocal);
  $('btnLoadLocal').addEventListener('click', loadLocal);
  $('btnClear').addEventListener('click', clearAll);
  $('dataInput').addEventListener('input', () => updateCounter());
  $('fileInput').addEventListener('change', importFile);
}

function renderMarketButtons(keys){
  const grid = $('marketGrid');
  const uniqueKeys = [...new Set(keys.filter(Boolean))];
  grid.innerHTML = uniqueKeys.map(key => {
    const meta = MARKET_META[key] || {label:key, official:'Arsip pengguna'};
    return `<button class="market-btn ${key===currentMarket?'active':''}" data-market="${escapeHtml(key)}">
      ${escapeHtml(meta.label || key)}<small>${escapeHtml(meta.official || 'Arsip pengguna')}</small>
    </button>`;
  }).join('');
  grid.querySelectorAll('.market-btn').forEach(btn => {
    btn.addEventListener('click', () => setMarket(btn.dataset.market));
  });
}

function setMarket(key){
  currentMarket = key;
  $('activeMarketPill').textContent = (MARKET_META[key]?.label || key);
  document.querySelectorAll('.market-btn').forEach(b => b.classList.toggle('active', b.dataset.market === key));
  updateSourceCard();
}

function updateSourceCard(){
  const meta = MARKET_META[currentMarket] || {label:currentMarket, official:'Arsip pengguna', note:'Market dari input pengguna.', status:'user-data', url:''};
  $('sourceDesc').innerHTML = `<b>${escapeHtml(meta.official || 'Arsip pengguna')}</b><br>${escapeHtml(meta.note || '')}`;
  const status = meta.status === 'verified' ? 'Terverifikasi sebagai link resmi.' : meta.status === 'unverified' ? 'Belum ada sumber resmi yang saya verifikasi.' : meta.status === 'verified-link' ? 'Link resmi tersedia, fetch otomatis bergantung CORS.' : 'Menggunakan arsip pengguna.';
  $('sourceHint').textContent = status;
  $('btnOpenOfficial').disabled = !meta.url;
  $('btnTryFetch').disabled = !meta.url;
}

function openOfficial(){
  const url = MARKET_META[currentMarket]?.url;
  if(!url) return alert('Sumber resmi untuk market ini belum terverifikasi.');
  window.open(url, '_blank', 'noopener,noreferrer');
}

async function tryFetchOfficial(){
  const url = MARKET_META[currentMarket]?.url;
  if(!url) return alert('Sumber resmi untuk market ini belum terverifikasi.');
  await fetchUrlToInput(url);
}

async function fetchCustomUrl(){
  const url = $('customUrl').value.trim();
  if(!url) return alert('Masukkan URL terlebih dahulu.');
  await fetchUrlToInput(url);
}

async function fetchUrlToInput(url){
  renderInfo('Mencoba membaca URL resmi. Jika gagal, biasanya karena CORS atau proteksi situs resmi.');
  try{
    const res = await fetch(url, {mode:'cors', cache:'no-store'});
    if(!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    const plain = htmlToText(text);
    $('dataInput').value = plain.slice(0, 300000);
    updateCounter();
    scanMarketsFromInput(false);
    renderInfo('Fetch berhasil. Data sudah dimasukkan ke textarea. Silakan jalankan analisis.');
  }catch(err){
    renderError(`Fetch otomatis gagal: ${err.message}. Pada GitHub Pages, banyak situs resmi memblokir pembacaan lintas domain oleh browser. Gunakan tombol Buka Situs Resmi, lalu salin hasil ke textarea, atau pakai backend proxy milik Anda sendiri.`);
  }
}

function htmlToText(html){
  try{
    const doc = new DOMParser().parseFromString(html, 'text/html');
    doc.querySelectorAll('script,style,noscript,svg').forEach(el => el.remove());
    return doc.body ? doc.body.innerText : html.replace(/<[^>]*>/g,' ');
  }catch(_){
    return String(html).replace(/<[^>]*>/g,' ');
  }
}

function importFile(ev){
  const file = ev.target.files?.[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    $('dataInput').value = String(reader.result || '');
    updateCounter();
    scanMarketsFromInput(false);
  };
  reader.readAsText(file);
}

function saveLocal(){
  localStorage.setItem('multiMarketResearchData', $('dataInput').value);
  localStorage.setItem('multiMarketResearchMarket', currentMarket);
  alert('Arsip lokal tersimpan di browser ini.');
}

function loadLocal(){
  $('dataInput').value = localStorage.getItem('multiMarketResearchData') || '';
  const savedMarket = localStorage.getItem('multiMarketResearchMarket');
  if(savedMarket) currentMarket = savedMarket;
  updateCounter();
  scanMarketsFromInput(false);
  setMarket(currentMarket);
}

function clearAll(){
  if(!confirm('Bersihkan input dan hasil?')) return;
  $('dataInput').value = '';
  parsedRows = [];
  updateCounter();
  $('output').className = 'empty-state';
  $('output').innerHTML = '<div><div class="empty-icon">∑</div><h3>Belum ada analisis</h3><p>Pilih pasaran, masukkan data historis, lalu klik analisis.</p></div>';
}

function cleanText(text){
  return String(text || '')
    .normalize('NFKC')
    .replace(/[\u200B-\u200D\uFEFF]/g,'')
    .replace(/[\u00A0\u202F]/g,' ')
    .replace(/[\u2013\u2014]/g,'-')
    .replace(/\r/g,'\n');
}

function normalizeLine(line){
  return cleanText(line).replace(/[|;]/g,' ').replace(/\s+/g,' ').trim();
}

function parseRows(rawText){
  const raw = cleanText(rawText);
  if(!raw.trim()) return [];
  const jsonRows = tryParseJson(raw);
  if(jsonRows.length) return normalizeParsedRows(jsonRows);
  const csvRows = tryParseCsv(raw);
  const blockRows = parseBlockRows(raw);
  const oneLineRows = parseOneLineRows(raw);
  const combined = [...blockRows, ...oneLineRows, ...csvRows];
  const seen = new Set();
  const rows = [];
  combined.forEach((r, i) => {
    const key = [r.market,r.code,r.period,r.date,r.digits.join(''),r.prizeRank || 1,i < blockRows.length ? 'b':'o'].join('|');
    if(seen.has(key)) return;
    seen.add(key);
    rows.push(r);
  });
  return sortRows(rows);
}

function tryParseJson(raw){
  try{
    const data = JSON.parse(raw);
    const arr = Array.isArray(data) ? data : (Array.isArray(data.results) ? data.results : []);
    return arr.map((x, idx) => ({
      market: canonicalMarket(x.market || x.code || x.game || x.name || ''),
      marketName: x.marketName || x.market || x.game || '',
      code: x.code || x.market || '',
      period: Number(x.period || x.draw || x.drawNo || idx + 1) || 0,
      date: x.date || x.drawDate || '',
      day: normalizeDay(x.day || ''),
      digits: parseDigitArray(x.digits || x.numbers || x.result || x.winningNumbers),
      additional: parseDigitArray(x.additional || x.extra || x.bonus),
      raw: JSON.stringify(x)
    })).filter(r => r.digits.length >= 4);
  }catch(_){ return []; }
}

function tryParseCsv(raw){
  const lines = raw.split(/\n+/).map(l => l.trim()).filter(Boolean);
  if(lines.length < 2 || !lines[0].includes(',')) return [];
  const header = splitCsvLine(lines[0]).map(h => h.toLowerCase().trim());
  const hasUseful = ['market','code','digits','result','numbers','date'].some(h => header.includes(h));
  if(!hasUseful) return [];
  return lines.slice(1).map((line, idx) => {
    const cols = splitCsvLine(line);
    const get = name => cols[header.indexOf(name)] || '';
    const result = get('digits') || get('result') || get('numbers') || cols.slice(-4).join(' ');
    const code = get('code') || get('market') || get('game');
    return {
      market: canonicalMarket(get('market') || code),
      marketName: get('marketname') || get('market') || code,
      code,
      period: Number(get('period') || get('draw') || get('drawno') || idx + 1) || 0,
      date: get('date') || get('drawdate') || '',
      day: normalizeDay(get('day')),
      digits: parseDigitsFromString(result),
      additional: parseDigitArray(get('additional') || get('extra')),
      raw: line
    };
  }).filter(r => r.digits.length >= 4);
}

function splitCsvLine(line){
  const out = [];
  let cur = '', quote = false;
  for(let i=0;i<line.length;i++){
    const ch = line[i];
    if(ch === '"') quote = !quote;
    else if(ch === ',' && !quote){ out.push(cur.trim().replace(/^"|"$/g,'')); cur=''; }
    else cur += ch;
  }
  out.push(cur.trim().replace(/^"|"$/g,''));
  return out;
}

function parseBlockRows(raw){
  const lines = raw.split(/\n+/).map(normalizeLine).filter(Boolean);
  const rows = [];
  let ctx = null;
  let pendingCode = null;
  let prizeRank = 0;
  for(const line of lines){
    if(isMarketHeader(line)){
      ctx = {
        marketName: line.replace(/\s+/g,' '),
        market: canonicalMarket(line),
        day: normalizeDay(line),
        date: '',
        timeT: '',
        timeB: ''
      };
      pendingCode = null;
      prizeRank = 0;
      continue;
    }
    if(!ctx) continue;
    const date = extractDate(line);
    if(date && !ctx.date) ctx.date = date;
    const t = line.match(/\bT\s*(\d{1,2}:\d{2})\s*WIB/i);
    const b = line.match(/\bB\s*(\d{1,2}:\d{2})\s*WIB/i);
    if(t) ctx.timeT = t[1];
    if(b) ctx.timeB = b[1];
    const codeMatch = line.match(/\b([A-Z]{2,5}\d*)\s*\[\s*(\d{1,8})\s*\]/i);
    if(codeMatch){
      pendingCode = {code:codeMatch[1].toUpperCase(), period:Number(codeMatch[2]) || 0};
      ctx.market = canonicalMarket(ctx.marketName + ' ' + pendingCode.code);
      prizeRank = 0;
      continue;
    }
    const digits = parseDigitsFromString(line);
    const justDigits = /^\d(?:\s+\d){3,9}$/.test(line);
    if(pendingCode && digits.length >= 4 && justDigits){
      prizeRank += 1;
      rows.push({
        market: canonicalMarket(ctx.marketName + ' ' + pendingCode.code),
        marketName: ctx.marketName,
        code: pendingCode.code,
        period: pendingCode.period,
        date: ctx.date,
        day: ctx.day,
        timeT: ctx.timeT,
        timeB: ctx.timeB,
        digits: digits.slice(0, 6),
        additional: digits.length > 6 ? digits.slice(6) : [],
        prizeRank,
        raw: `${ctx.marketName} ${ctx.date} ${pendingCode.code} [${pendingCode.period}] ${digits.join(' ')}`
      });
    }
  }
  return rows;
}

function parseOneLineRows(raw){
  const rows = [];
  const lines = raw.split(/\n+/).map(normalizeLine).filter(Boolean);
  lines.forEach((line, idx) => {
    const codeMatch = line.match(/\b([A-Z]{2,7}\d*)\s*\[\s*(\d{1,8})\s*\]/i);
    if(!codeMatch) return;
    const after = line.slice(line.lastIndexOf(']') + 1);
    const digits = parseDigitsFromString(after);
    if(digits.length < 4) return;
    const day = normalizeDay(line);
    rows.push({
      market: canonicalMarket(line + ' ' + codeMatch[1]),
      marketName: detectMarketNameFromCode(codeMatch[1]) || codeMatch[1].toUpperCase(),
      code: codeMatch[1].toUpperCase(),
      period: Number(codeMatch[2]) || idx + 1,
      date: extractDate(line),
      day,
      digits: digits.slice(0, 6),
      additional: digits.length > 6 ? digits.slice(6) : [],
      prizeRank: 1,
      raw: line
    });
  });
  return rows;
}

function isMarketHeader(line){
  if(/\[[0-9]{1,8}\]/.test(line)) return false;
  if(/\bT\s*\d{1,2}:\d{2}\s*WIB/i.test(line)) return false;
  const upper = line.toUpperCase();
  if(/\(\s*(SETIAP HARI|SENIN OFF|MINGGU OFF|SABTU OFF|JUMAT OFF)/i.test(line)) return true;
  return Object.values(MARKET_META).some(meta => (meta.aliases || []).some(a => upper.includes(a))) && !/^\d/.test(line);
}

function detectMarketNameFromCode(code){
  const upper = String(code || '').toUpperCase();
  for(const [key, meta] of Object.entries(MARKET_META)){
    if((meta.aliases || []).some(a => a.toUpperCase() === upper)) return meta.label;
  }
  return '';
}

function canonicalMarket(value){
  const upper = String(value || '').toUpperCase();
  if(/\bTOTO\s*MACAU\b|\bTM[1-5]\b/.test(upper)) return 'TOTO_MACAU';
  if(/\bSYL3P\b|\bSYL\b|\bSYD\b|\bSDY\b|SYDNEY/.test(upper)) return 'SYD';
  if(/\bHKL3P\b|\bHKL\b|\bHKG\b|\bHK\b|HONG\s*KONG/.test(upper)) return 'HKG';
  if(/\bPCS\b|\bPCSO\b|\bPJSO\b/.test(upper)) return 'PCSO';
  if(/\bWSV\b|WEST\s*VIRGINIA|\bWV\b/.test(upper)) return 'WSV';
  if(/\bINM\b|\bIDE\b|INDIANA/.test(upper)) return 'INDIANA';
  if(/PENNSYLVANIA|\bPEN\b|\bPA\b|PICK\s*4/.test(upper)) return 'PENNSYLVANIA';
  if(/SINGAPORE\s*TOTO|TOTO\s*SINGAPORE/.test(upper)) return 'SGPTOTO';
  if(/\bSGP\b|SINGAPURA|SINGAPORE/.test(upper)) return 'SGP4D';
  if(/TEXAS|\bTXD\b|\bTXE\b|\bTXN\b|\bTXM\b/.test(upper)) return 'TEXAS';
  if(/FLORIDA|\bFLM\b|\bFLE\b/.test(upper)) return 'FLORIDA';
  if(/ILLINOIS|\bILM\b|\bINE\b/.test(upper)) return 'ILLINOIS';
  if(/NEW\s*YORK|\bNYM\b|\bNYE\b/.test(upper)) return 'NEWYORK';
  if(/VIRGINIA|\bVID\b|\bVIN\b/.test(upper)) return 'VIRGINIA';
  if(/GEORGIA|\bGRM\b|\bGRE\b|\bGRN\b/.test(upper)) return 'GEORGIA';
  if(/CALIFORNIA|\bCLF\b/.test(upper)) return 'CALIFORNIA';
  if(/OHIO|\bOHM\b|\bOHE\b/.test(upper)) return 'OHIO';
  if(/MICHIGAN|\bMCM\b|\bMCE\b/.test(upper)) return 'MICHIGAN';
  if(/OREGON|\bOO4\b|\bO07\b|\bO10\b|\bO13\b/.test(upper)) return 'OREGON';
  if(/UTAH|\bUTD\b|\bUTE\b|\bUTM\b/.test(upper)) return 'UTAH';
  const code = upper.match(/\b([A-Z]{2,5}\d*)\s*\[/)?.[1] || upper.match(/\b([A-Z]{2,5}\d*)\b/)?.[1];
  return code || 'OTHER';
}

function normalizeParsedRows(rows){
  return sortRows(rows.map((r, idx) => ({
    market: canonicalMarket(r.market || r.marketName || r.code || ''),
    marketName: r.marketName || r.market || r.code || '',
    code: r.code || r.market || '',
    period: Number(r.period) || idx + 1,
    date: r.date || '',
    day: normalizeDay(r.day || r.date || ''),
    digits: parseDigitArray(r.digits),
    additional: parseDigitArray(r.additional),
    prizeRank: r.prizeRank || 1,
    raw: r.raw || ''
  })).filter(r => r.digits.length >= 4));
}

function sortRows(rows){
  return rows.slice().sort((a,b) => {
    const pd = (b.period || 0) - (a.period || 0);
    if(pd) return pd;
    const da = dateValue(a.date), db = dateValue(b.date);
    if(db !== da) return db - da;
    return (a.prizeRank || 1) - (b.prizeRank || 1);
  });
}

function parseDigitArray(value){
  if(Array.isArray(value)) return value.map(Number).filter(x => Number.isInteger(x) && x >= 0 && x <= 99);
  return parseDigitsFromString(String(value || ''));
}

function parseDigitsFromString(str){
  const s = String(str || '').trim();
  if(!s) return [];
  const spaced = s.match(/(?<!\d)\d{1,2}(?!\d)/g);
  if(spaced && spaced.length >= 4) return spaced.map(Number).filter(x => Number.isInteger(x));
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
  if(m1){
    const month = MONTHS[m1[2].toLowerCase().slice(0,3)] || MONTHS[m1[2].toLowerCase()] || 0;
    return new Date(Number(m1[3]), month - 1, Number(m1[1])).getTime() || 0;
  }
  const m2 = date.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if(m2) return new Date(Number(m2[3]), Number(m2[2]) - 1, Number(m2[1])).getTime() || 0;
  return 0;
}

function monthOf(date){
  const m1 = String(date || '').match(/\d{1,2}\/([A-Za-zÀ-ÿ]{3,12})\/\d{4}/i);
  if(m1) return MONTHS[m1[1].toLowerCase().slice(0,3)] || MONTHS[m1[1].toLowerCase()] || 0;
  const m2 = String(date || '').match(/\d{1,2}\/(\d{1,2})\/\d{4}/);
  return m2 ? Number(m2[1]) : 0;
}

function normalizeYear(y){
  y = String(y);
  return y.length === 2 ? '20' + y : y;
}
function pad2(x){ return String(x).padStart(2,'0'); }

function updateCounter(){
  const rows = parseRows($('dataInput').value);
  $('rowCounter').textContent = `${rows.length} baris`;
  parsedRows = rows;
}

function scanMarketsFromInput(showAlert = true){
  parsedRows = parseRows($('dataInput').value);
  const found = [...new Set(parsedRows.map(r => r.market))];
  const keys = [...PRESET_MARKETS, ...found];
  renderMarketButtons(keys);
  if(found.length && !found.includes(currentMarket)) setMarket(found[0]);
  else setMarket(currentMarket);
  updateCounter();
  if(showAlert) alert(`Terdeteksi ${found.length} market: ${found.join(', ') || '-'}`);
}

function processActive(includeBacktest){
  try{
    parsedRows = parseRows($('dataInput').value);
    if(!parsedRows.length) throw new Error('Data belum terbaca. Tempel data historis atau import file terlebih dahulu.');
    const rows = currentMarket === 'ALL' ? parsedRows : parsedRows.filter(r => r.market === currentMarket);
    if(!rows.length) throw new Error(`Tidak ada data untuk market ${currentMarket}. Klik Scan Market dari Input untuk melihat market yang terbaca.`);
    const report = buildReport(rows, currentMarket, includeBacktest);
    renderReport(report);
  }catch(err){ renderError(err.message || String(err)); }
}

function buildReport(rows, market, includeBacktest){
  const model = buildModel(rows, market);
  const backtest = includeBacktest ? runBacktest(rows, market) : null;
  return {...model, backtest};
}

function buildModel(rows, market){
  rows = sortRows(rows);
  const N = rows.length;
  const latest = rows[0];
  const targetDay = inferTargetDay(rows);
  const targetMonth = inferTargetMonth(rows);
  const latestSet = new Set(latest?.digits || []);
  const latestCounts = countMap(latest?.digits || []);
  const latestHasTwin = Object.values(latestCounts).some(v => v >= 2);
  const rowPresence = Array(10).fill(0);
  const rawCount = Array(10).fill(0);
  const gap = Array(10).fill(N + 1);
  rows.forEach((r, idx) => {
    const u = unique(r.digits.filter(d => d >= 0 && d <= 9));
    u.forEach(d => { rowPresence[d]++; if(gap[d] === N + 1) gap[d] = idx; });
    r.digits.forEach(d => { if(d >= 0 && d <= 9) rawCount[d]++; });
  });

  const totalSlots = rows.reduce((s,r) => s + r.digits.filter(d => d >= 0 && d <= 9).length, 0) || 1;
  const freq = rawCount.map(c => c / totalSlots);
  const presence = rowPresence.map(c => c / Math.max(N,1));
  const recent = weightedPresence(rows.slice(0, 12), 0.76);
  const mid = weightedPresence(rows.slice(12, 40), 0.92);
  const dayRows = targetDay ? rows.filter(r => r.day === targetDay) : [];
  const dayScore = weightedPresence(dayRows.slice(0, 20), 0.82);
  const monthRows = targetMonth ? rows.filter(r => monthOf(r.date) === targetMonth) : [];
  const monthScore = weightedPresence(monthRows.slice(0, 24), 0.88);
  const pairStats = buildPairStats(rows);
  const markov = buildMarkovScore(rows, latestSet);
  const golden = buildGoldenRatioScore(rows);
  const gapScore = gap.map(g => g === 0 ? 0.08 : g <= 2 ? 0.25 : g <= 8 ? g / 8 : g <= 21 ? 0.75 : 0.35);
  const repeatScore = buildRepeatScore(rows);
  const trendScore = DIGITS.map(d => clamp(recent[d] - mid[d] + 0.45, 0, 1));
  const latestPairSupport = DIGITS.map(d => {
    let s = 0, c = 0;
    latestSet.forEach(x => { if(x !== d){ s += pairStats.liftPositive(d, x); c++; } });
    return clamp((c ? s / c : 0) / 0.85, 0, 1);
  });

  /*
    FORMULA V2
    Kelemahan V1: digit yang kuat secara historis tetapi sedang dingin terlalu turun.
    V2 menambah lima pembaca pola:
    1. reboundScore: digit historis kuat yang absen 2-8 draw terakhir.
    2. neighborScore: rotasi tetangga dari angka terakhir, misalnya 9 membuka 8/0.
    3. shapeScore: Markov bentuk draw, memakai kemiripan sum, root, odd-even, high-low, dan status kembar.
    4. positionScore: sinyal posisi ribuan, ratusan, puluhan, satuan.
    5. antiScore: rem untuk digit yang terlalu padat dalam 3 draw terakhir.
  */
  const oldBaseScore = DIGITS.map(d => {
    return 0.16*presence[d] +
      0.11*freq[d]*2.5 +
      0.18*recent[d] +
      0.11*dayScore[d] +
      0.07*monthScore[d] +
      0.11*markov[d] +
      0.09*latestPairSupport[d] +
      0.07*gapScore[d] +
      0.05*golden[d] +
      0.05*trendScore[d];
  });
  const oldScore = normalizeArray(oldBaseScore);
  const positionPack = buildPositionScore(rows);
  const positionScore = positionPack.digitScore;
  const shapeScore = buildShapeMarkovScore(rows, latest);
  const reboundScore = buildGapReboundScore(rows, presence, recent, mid, gap, latestSet);
  const neighborScore = buildNeighborEchoScore(rows, latestSet);
  const antiScore = buildAntiSaturationScore(rows, latestSet);
  const survivorScore = buildSurvivorCarryScore(rows, latest, presence, dayScore, neighborScore);

  const score = DIGITS.map(d => {
    /*
      FORMULA V3.1
      Fokus utama tetap digit bebas posisi, bukan tebak urutan.
      Position Score menjadi pembisik kecil.
      Survivor Carry ditambahkan agar digit tunggal dari draw terakhir yang masih sehat tidak terlalu cepat dibuang.
    */
    return 0.36*oldScore[d] +
      0.23*reboundScore[d] +
      0.15*neighborScore[d] +
      0.12*shapeScore[d] +
      0.04*positionScore[d] +
      0.10*antiScore[d];
  });
  const normalizedScore = normalizeArray(score);
  const classMap = classifyDigits(presence);
  const finalDigits = chooseFinalDigits(normalizedScore, {
    dayScore,
    markov,
    golden,
    gapScore,
    latestPairSupport,
    classMap,
    reboundScore,
    neighborScore,
    shapeScore,
    antiScore,
    survivorScore,
    positionScore,
    presence,
    oldScore,
    latestHasTwin
  });
  const twinScores = buildTwinScoreV2(rows, normalizedScore, repeatScore, dayScore, recent, markov, {
    reboundScore,
    neighborScore,
    shapeScore,
    antiScore,
    survivorScore,
    presence
  });
  const twinDigit = finalDigits.slice().sort((a,b) => twinScores[b] - twinScores[a])[0];
  const chi = chiSquareDigitTest(rows);
  const pairs = topPairs(pairStats.pair, rows.length, 8);
  const daySummary = summarizeBy(rows, r => r.day || 'tidak-terbaca');
  const monthSummary = summarizeBy(rows, r => monthOf(r.date) ? `Bulan ${monthOf(r.date)}` : 'tidak-terbaca');
  const models = DIGITS.map(d => ({
    digit:d,
    score:normalizedScore[d],
    rawScore:score[d],
    oldScore:oldScore[d],
    presence:presence[d],
    freq:freq[d],
    recent:recent[d],
    day:dayScore[d],
    month:monthScore[d],
    markov:markov[d],
    pair:latestPairSupport[d],
    gap:gapScore[d],
    golden:golden[d],
    repeat:repeatScore[d],
    trend:trendScore[d],
    rebound:reboundScore[d],
    neighbor:neighborScore[d],
    shape:shapeScore[d],
    position:positionScore[d],
    anti:antiScore[d],
    survivor:survivorScore[d],
    twin:twinScores[d],
    className:classMap[d]
  })).sort((a,b) => b.score - a.score);
  return {
    market,
    marketLabel: MARKET_META[market]?.label || market,
    rows,
    N,
    latest,
    latestDraw: latest ? latest.digits.join('') : '-',
    targetDay,
    targetMonth,
    finalDigits,
    twinDigit,
    twinScores,
    models,
    chi,
    pairs,
    daySummary,
    monthSummary,
    meta: MARKET_META[market] || MARKET_META.OTHER
  };
}

function weightedPresence(rows, decay){
  const acc = Array(10).fill(0);
  let den = 0;
  rows.forEach((r, i) => {
    const w = Math.pow(decay, i);
    den += w;
    unique(r.digits.filter(d => d >= 0 && d <= 9)).forEach(d => acc[d] += w);
  });
  return acc.map(v => den ? v / den : 0);
}

function inferTargetDay(rows){
  const latest = rows[0]?.day;
  if(!latest) return '';
  const chrono = rows.slice().reverse();
  const counts = {};
  for(let i=0;i<chrono.length-1;i++){
    if(chrono[i].day === latest && chrono[i+1].day){
      counts[chrono[i+1].day] = (counts[chrono[i+1].day] || 0) + 1;
    }
  }
  const best = Object.entries(counts).sort((a,b) => b[1] - a[1])[0];
  if(best) return best[0];
  const idx = DAYS.indexOf(latest);
  return idx >= 0 ? DAYS[(idx + 1) % 7] : '';
}

function inferTargetMonth(rows){
  const m = monthOf(rows[0]?.date);
  return m || 0;
}

function buildPairStats(rows){
  const pair = Array.from({length:10}, () => Array(10).fill(0));
  const presence = Array(10).fill(0);
  rows.forEach(r => {
    const u = unique(r.digits.filter(d => d >= 0 && d <= 9));
    u.forEach(d => presence[d]++);
    for(let i=0;i<u.length;i++) for(let j=i+1;j<u.length;j++){
      pair[u[i]][u[j]]++; pair[u[j]][u[i]]++;
    }
  });
  const N = rows.length || 1;
  function lift(a,b){
    if(a === b) return 0;
    const pab = (1 + pair[a][b]) / (2 + N);
    const pa = (1 + presence[a]) / (2 + N);
    const pb = (1 + presence[b]) / (2 + N);
    return Math.log(pab / Math.max(pa * pb, 0.000001));
  }
  return {pair, presence, lift, liftPositive:(a,b) => Math.max(0, lift(a,b))};
}

function buildMarkovScore(rows, latestSet){
  const chrono = rows.slice().reverse();
  const acc = Array(10).fill(0);
  let den = 0;
  for(let i=0;i<chrono.length-1;i++){
    const prev = new Set(chrono[i].digits.filter(d => d >= 0 && d <= 9));
    const next = unique(chrono[i+1].digits.filter(d => d >= 0 && d <= 9));
    const inter = [...prev].filter(x => latestSet.has(x)).length;
    const union = new Set([...prev, ...latestSet]).size || 1;
    const sim = inter / union;
    if(sim > 0){
      const age = chrono.length - 2 - i;
      const w = Math.pow(sim, 1.15) * Math.pow(0.985, age);
      den += w;
      next.forEach(d => acc[d] += w);
    }
  }
  return acc.map(v => den ? v / den : 0);
}

function buildGoldenRatioScore(rows){
  const phi = 1.61803398875;
  return DIGITS.map(d => {
    const idxs = [];
    rows.forEach((r, idx) => { if(r.digits.includes(d)) idxs.push(idx); });
    if(idxs.length < 3) return 0;
    const gaps = [];
    for(let i=0;i<idxs.length-1;i++) gaps.push(Math.abs(idxs[i+1] - idxs[i]) || 1);
    let closeness = 0, c = 0;
    for(let i=0;i<gaps.length-1;i++){
      const ratio = Math.max(gaps[i], gaps[i+1]) / Math.max(1, Math.min(gaps[i], gaps[i+1]));
      closeness += 1 / (1 + Math.abs(ratio - phi));
      c++;
    }
    const recentBonus = idxs[0] <= 8 ? 0.12 : 0;
    return clamp((c ? closeness / c : 0) + recentBonus, 0, 1);
  });
}

function buildRepeatScore(rows){
  const acc = Array(10).fill(0);
  rows.slice(0, 14).forEach((r, idx) => {
    const counts = countMap(r.digits);
    DIGITS.forEach(d => { if((counts[d] || 0) >= 2) acc[d] += Math.pow(0.75, idx); });
  });
  return normalizeArray(acc);
}

function buildPositionScore(rows){
  const acc = Array.from({length:4}, () => Array(10).fill(0));
  const den = Array(4).fill(0);
  rows.slice(0, 24).forEach((r, idx) => {
    const w = Math.pow(0.82, idx);
    r.digits.slice(0, 4).forEach((d, pos) => {
      if(d >= 0 && d <= 9){
        acc[pos][d] += w;
        den[pos] += w;
      }
    });
  });
  const posFreq = acc.map((row, pos) => row.map(v => den[pos] ? v / den[pos] : 0));
  const digitScore = normalizeArray(DIGITS.map(d => {
    const vals = posFreq.map(row => row[d]);
    return 0.55*Math.max(...vals) + 0.45*(vals.reduce((s,v) => s+v, 0) / 4);
  }));
  return {digitScore, posFreq};
}

function sumRoot(n){
  const r = n % 9;
  return r === 0 ? 9 : r;
}

function drawShape(row){
  const digits = row?.digits || [];
  const sum = digits.reduce((s,d) => s + d, 0);
  const odd = digits.filter(d => d % 2 === 1).length;
  const high = digits.filter(d => d >= 5).length;
  const counts = countMap(digits);
  const twin = Object.values(counts).some(v => v >= 2) ? 1 : 0;
  return {sum, root:sumRoot(sum), odd, high, twin};
}

function buildShapeMarkovScore(rows, latest){
  if(!latest) return Array(10).fill(0.5);
  const chrono = rows.slice().reverse();
  const target = drawShape(latest);
  const acc = Array(10).fill(0);
  let den = 0;
  for(let i=0;i<chrono.length-1;i++){
    const s = drawShape(chrono[i]);
    let sim = 0;
    sim += 0.28*(1 - Math.abs(s.sum - target.sum) / 36);
    sim += 0.22*(1 - Math.abs(s.root - target.root) / 8);
    sim += 0.22*(1 - Math.abs(s.odd - target.odd) / 4);
    sim += 0.18*(1 - Math.abs(s.high - target.high) / 4);
    sim += 0.10*(s.twin === target.twin ? 1 : 0);
    sim = clamp(sim, 0, 1);
    if(sim > 0.52){
      const age = chrono.length - 2 - i;
      const w = Math.pow(sim, 2.1) * Math.pow(0.99, age);
      den += w;
      unique(chrono[i+1].digits.filter(d => d >= 0 && d <= 9)).forEach(d => acc[d] += w);
    }
  }
  return acc.map(v => den ? v / den : 0);
}

function buildGapReboundScore(rows, presence, recent, mid, gap, latestSet){
  const raw = DIGITS.map(d => {
    const g = gap[d] || 0;
    const sweetGap = Math.exp(-Math.pow(g - 5, 2) / (2 * Math.pow(3, 2)));
    const cold = clamp(mid[d] - recent[d] + 0.15, 0, 1);
    const notLatest = latestSet.has(d) ? 0.45 : 1;
    return presence[d] * (0.55*sweetGap + 0.45*cold) * (0.75 + 0.25*notLatest);
  });
  return normalizeArray(raw);
}

function buildNeighborEchoScore(rows, latestSet){
  const neighbor = new Set();
  latestSet.forEach(x => {
    neighbor.add((x + 9) % 10);
    neighbor.add((x + 1) % 10);
  });
  const chrono = rows.slice().reverse();
  const acc = Array(10).fill(0);
  let den = 0;
  for(let i=0;i<chrono.length-1;i++){
    const prev = new Set(chrono[i].digits.filter(d => d >= 0 && d <= 9));
    const inter = [...prev].filter(x => latestSet.has(x)).length;
    const union = new Set([...prev, ...latestSet]).size || 1;
    const sim = inter / union;
    if(sim > 0){
      const age = chrono.length - 2 - i;
      const w = Math.pow(sim, 1.2) * Math.pow(0.99, age);
      den += w;
      prev.forEach(x => {
        const a = (x + 9) % 10;
        const b = (x + 1) % 10;
        const next = new Set(chrono[i+1].digits.filter(d => d >= 0 && d <= 9));
        if(next.has(a)) acc[a] += w;
        if(next.has(b)) acc[b] += w;
      });
    }
  }
  const hist = normalizeArray(acc.map(v => den ? v / den : 0));
  return normalizeArray(DIGITS.map(d => 0.55*(neighbor.has(d) ? 1 : 0) + 0.45*hist[d]));
}

function buildAntiSaturationScore(rows, latestSet){
  const count = Array(10).fill(0);
  rows.slice(0, 3).forEach(r => {
    r.digits.forEach(d => { if(d >= 0 && d <= 9) count[d]++; });
  });
  const maxCount = Math.max(...count, 1);
  return DIGITS.map(d => clamp(1 - (count[d] / maxCount) + (latestSet.has(d) ? 0 : 0.18), 0, 1));
}

function buildSurvivorCarryScore(rows, latest, presence, dayScore, neighborScore){
  const latestCounts = countMap(latest?.digits || []);
  const raw = DIGITS.map(d => {
    const latestSingle = (latestCounts[d] || 0) === 1 ? 1 : 0;
    const latestTwin = (latestCounts[d] || 0) >= 2 ? 1 : 0;

    // Digit yang muncul tunggal di draw terakhir masih boleh dibawa.
    // Digit yang sudah kembar tidak langsung dibawa, karena sering sudah jenuh.
    return 0.40*latestSingle +
      0.25*(dayScore[d] || 0) +
      0.20*(presence[d] || 0) +
      0.15*(neighborScore[d] || 0) -
      0.10*latestTwin;
  });
  return normalizeArray(raw);
}

function buildTwinScoreV2(rows, digitScore, repeatScore, dayScore, recent, markov, ctx){
  const oldTwin = buildTwinScore(rows, digitScore, dayScore, recent, markov);
  return DIGITS.map(d => clamp(
    0.32*oldTwin[d] +
    0.22*ctx.reboundScore[d] +
    0.14*ctx.shapeScore[d] +
    0.11*ctx.antiScore[d] +
    0.08*ctx.neighborScore[d] +
    0.06*ctx.presence[d] +
    0.04*ctx.survivorScore[d] +
    0.05*repeatScore[d],
  0, 1));
}

function buildTwinScore(rows, digitScore, dayScore, recent, markov){
  const twinHist = Array(10).fill(0);
  const singleRecent = Array(10).fill(0);
  const twinRecent = Array(10).fill(0);
  rows.forEach(r => {
    const c = countMap(r.digits);
    DIGITS.forEach(d => { if((c[d] || 0) >= 2) twinHist[d]++; });
  });
  rows.slice(0, 12).forEach((r, idx) => {
    const c = countMap(r.digits);
    DIGITS.forEach(d => {
      if((c[d] || 0) === 1) singleRecent[d] += Math.pow(0.78, idx);
      if((c[d] || 0) >= 2) twinRecent[d] += Math.pow(0.78, idx);
    });
  });
  const h = normalizeArray(twinHist);
  const sr = normalizeArray(singleRecent);
  const tr = normalizeArray(twinRecent);
  return DIGITS.map(d => clamp(0.24*h[d] + 0.25*sr[d] + 0.17*tr[d] + 0.12*dayScore[d] + 0.10*recent[d] + 0.07*markov[d] + 0.05*digitScore[d], 0, 1));
}

function classifyDigits(presence){
  const order = DIGITS.slice().sort((a,b) => presence[b] - presence[a]);
  const out = {};
  order.forEach((d, idx) => out[d] = idx < 3 ? 'core' : idx < 7 ? 'mid' : 'bridge');
  return out;
}

function chooseFinalDigits(score, ctx){
  const selected = [];
  DIGITS.slice().sort((a,b) => score[b] - score[a]).forEach(d => {
    if(selected.length < 4) selected.push(d);
  });

  // Kuota 1: digit rebound. Ini menjaga digit dingin yang historisnya masih hidup.
  DIGITS.slice().sort((a,b) => {
    const sa = (ctx.reboundScore?.[a] || 0) + 0.35*(ctx.antiScore?.[a] || 0) + 0.20*(ctx.presence?.[a] || 0) + 0.15*score[a];
    const sb = (ctx.reboundScore?.[b] || 0) + 0.35*(ctx.antiScore?.[b] || 0) + 0.20*(ctx.presence?.[b] || 0) + 0.15*score[b];
    return sb - sa;
  }).forEach(d => {
    if(selected.length < 5 && !selected.includes(d)) selected.push(d);
  });

  // Kuota 2: digit rotasi tetangga atau shape. Ini membaca 9→8/0, 7→6/8, 1→0/2, dan bentuk draw serupa.
  DIGITS.slice().sort((a,b) => {
    const sa = 0.55*(ctx.neighborScore?.[a] || 0) + 0.25*(ctx.antiScore?.[a] || 0) + 0.20*(ctx.shapeScore?.[a] || 0);
    const sb = 0.55*(ctx.neighborScore?.[b] || 0) + 0.25*(ctx.antiScore?.[b] || 0) + 0.20*(ctx.shapeScore?.[b] || 0);
    return sb - sa;
  }).forEach(d => {
    if(selected.length < 6 && !selected.includes(d)) selected.push(d);
  });

  // Repair V3.1: ganti bridge yang terlalu spekulatif dengan digit yang punya dukungan dasar lebih kuat.
  // Tujuan: menjaga minimal 3 digit masuk, bukan mengejar satu modul yang terlalu agresif.
  repairWeakBridge(selected, score, ctx);
  forceStrongSurvivorAfterTwin(selected, score, ctx);

  // Fallback bila data terlalu pendek.
  DIGITS.slice().sort((a,b) => score[b] - score[a]).forEach(d => {
    if(selected.length < 6 && !selected.includes(d)) selected.push(d);
  });

  return selected.slice(0,6).sort((a,b) => score[b] - score[a]);
}

function repairWeakBridge(selected, score, ctx){
  const oldScore = ctx.oldScore || Array(10).fill(0);
  const dayScore = ctx.dayScore || Array(10).fill(0);
  const reboundScore = ctx.reboundScore || Array(10).fill(0);
  const neighborScore = ctx.neighborScore || Array(10).fill(0);
  const shapeScore = ctx.shapeScore || Array(10).fill(0);
  const antiScore = ctx.antiScore || Array(10).fill(0);
  const survivorScore = ctx.survivorScore || Array(10).fill(0);
  const presence = ctx.presence || Array(10).fill(0);

  const strength = d => score[d]
    + 0.18*oldScore[d]
    + 0.16*dayScore[d]
    + 0.12*presence[d]
    + 0.08*shapeScore[d]
    + 0.08*survivorScore[d];

  for(let pass=0; pass<2; pass++){
    const weak = selected.filter(d => {
      const protectedDigit =
        neighborScore[d] >= 0.72 ||
        (reboundScore[d] >= 0.72 && presence[d] >= 0.30) ||
        dayScore[d] >= 0.60 ||
        survivorScore[d] >= 0.72 ||
        (oldScore[d] >= 0.55 && score[d] >= 0.55);

      return !protectedDigit &&
        score[d] < 0.60 &&
        oldScore[d] < 0.30 &&
        presence[d] < 0.31;
    });

    if(!weak.length) break;

    const weakest = weak.slice().sort((a,b) => strength(a) - strength(b))[0];
    const candidates = DIGITS.filter(d => !selected.includes(d));
    if(!candidates.length) break;

    const challenger = candidates.sort((a,b) => strength(b) - strength(a))[0];
    const challengerHasBase =
      oldScore[challenger] > 0.50 ||
      dayScore[challenger] > 0.50 ||
      presence[challenger] > 0.34 ||
      shapeScore[challenger] > 0.50 ||
      survivorScore[challenger] > 0.62;

    if(challengerHasBase && strength(challenger) > strength(weakest) + 0.03){
      selected[selected.indexOf(weakest)] = challenger;
    }else{
      break;
    }
  }
}

function forceStrongSurvivorAfterTwin(selected, score, ctx){
  if(!ctx.latestHasTwin) return;
  const survivorScore = ctx.survivorScore || Array(10).fill(0);
  const oldScore = ctx.oldScore || Array(10).fill(0);
  const dayScore = ctx.dayScore || Array(10).fill(0);
  const reboundScore = ctx.reboundScore || Array(10).fill(0);
  const neighborScore = ctx.neighborScore || Array(10).fill(0);
  const presence = ctx.presence || Array(10).fill(0);
  const classMap = ctx.classMap || {};

  // Survivor paksa hanya aktif bila sinyalnya sangat kuat.
  // Tujuannya menangkap digit tunggal dari draw terakhir yang masih hidup, seperti 1 pada pola 9-1-7-7.
  const challengers = DIGITS.filter(d => !selected.includes(d) && survivorScore[d] >= 0.78);
  if(!challengers.length) return;

  const victims = selected.filter(d => {
    const protectedDigit =
      survivorScore[d] >= 0.70 ||
      oldScore[d] >= 0.64 ||
      dayScore[d] >= 0.60 ||
      presence[d] >= 0.43 ||
      reboundScore[d] >= 0.88;

    const rotasiOnly =
      neighborScore[d] >= 0.75 &&
      oldScore[d] < 0.45 &&
      dayScore[d] < 0.40 &&
      score[d] < 0.65;

    const weakBridge =
      classMap[d] === 'bridge' &&
      oldScore[d] < 0.42 &&
      dayScore[d] < 0.45;

    return !protectedDigit && (rotasiOnly || weakBridge);
  });
  if(!victims.length) return;

  const challenger = challengers.sort((a,b) => survivorScore[b] - survivorScore[a])[0];
  const victim = victims.sort((a,b) => {
    const sa = score[a] + 0.18*oldScore[a] + 0.16*dayScore[a] + 0.10*presence[a];
    const sb = score[b] + 0.18*oldScore[b] + 0.16*dayScore[b] + 0.10*presence[b];
    return sa - sb;
  })[0];

  // Penggantian hanya bila challenger benar-benar survivor kuat.
  if(survivorScore[challenger] >= 0.78 && survivorScore[challenger] > survivorScore[victim] + 0.20){
    selected[selected.indexOf(victim)] = challenger;
  }
}

function repairSurvivorAndStable(selected, score, ctx){
  const oldScore = ctx.oldScore || Array(10).fill(0);
  const dayScore = ctx.dayScore || Array(10).fill(0);
  const reboundScore = ctx.reboundScore || Array(10).fill(0);
  const neighborScore = ctx.neighborScore || Array(10).fill(0);
  const shapeScore = ctx.shapeScore || Array(10).fill(0);
  const antiScore = ctx.antiScore || Array(10).fill(0);
  const survivorScore = ctx.survivorScore || Array(10).fill(0);
  const presence = ctx.presence || Array(10).fill(0);
  const classMap = ctx.classMap || {};

  const strength = d => score[d]
    + 0.16*oldScore[d]
    + 0.14*dayScore[d]
    + 0.12*presence[d]
    + 0.10*shapeScore[d]
    + 0.12*survivorScore[d]
    + 0.06*neighborScore[d];

  for(let pass=0; pass<2; pass++){
    const challengers = DIGITS.filter(d => !selected.includes(d)).filter(d => {
      return survivorScore[d] >= 0.62 ||
        (oldScore[d] >= 0.48 && dayScore[d] >= 0.42) ||
        (presence[d] >= 0.34 && shapeScore[d] >= 0.45) ||
        (oldScore[d] >= 0.58 && presence[d] >= 0.32);
    });

    if(!challengers.length) break;

    const challenger = challengers.sort((a,b) => strength(b) - strength(a))[0];

    const replaceable = selected.filter(d => {
      const protectedDigit =
        survivorScore[d] >= 0.70 ||
        oldScore[d] >= 0.64 ||
        dayScore[d] >= 0.64 ||
        reboundScore[d] >= 0.82 ||
        neighborScore[d] >= 0.82 ||
        (presence[d] >= 0.42 && score[d] >= 0.55);

      const speculative =
        (classMap[d] === 'bridge' && oldScore[d] < 0.46) ||
        (antiScore[d] >= 0.70 && oldScore[d] < 0.50 && dayScore[d] < 0.50) ||
        (score[d] < 0.48 && survivorScore[d] < 0.50);

      return speculative && !protectedDigit;
    });

    if(!replaceable.length) break;

    const weakest = replaceable.sort((a,b) => strength(a) - strength(b))[0];

    if(strength(challenger) > strength(weakest) + 0.015){
      selected[selected.indexOf(weakest)] = challenger;
    }else{
      break;
    }
  }
}

function chiSquareDigitTest(rows){
  const counts = Array(10).fill(0);
  let total = 0;
  rows.forEach(r => r.digits.forEach(d => { if(d >= 0 && d <= 9){ counts[d]++; total++; } }));
  const expected = total / 10 || 1;
  const chi = counts.reduce((s,o) => s + Math.pow(o - expected, 2) / expected, 0);
  return {counts, chi, p: chiSquarePValueWilsonHilferty(chi, 9)};
}

function chiSquarePValueWilsonHilferty(x,k){
  const z = (Math.pow(x/k,1/3) - (1 - 2/(9*k))) / Math.sqrt(2/(9*k));
  return clamp(1 - normalCdf(z), 0, 1);
}
function erf(x){
  const sign = x >= 0 ? 1 : -1; x = Math.abs(x);
  const a1=.254829592,a2=-.284496736,a3=1.421413741,a4=-1.453152027,a5=1.061405429,p=.3275911;
  const t = 1/(1+p*x);
  const y = 1 - (((((a5*t+a4)*t)+a3)*t+a2)*t+a1)*t*Math.exp(-x*x);
  return sign*y;
}
function normalCdf(x){ return 0.5 * (1 + erf(x/Math.SQRT2)); }

function topPairs(pair, N, limit){
  const arr = [];
  for(let i=0;i<10;i++) for(let j=i+1;j<10;j++) arr.push({pair:`${i}-${j}`, count:pair[i][j], rate: pair[i][j] / Math.max(N,1)});
  return arr.sort((a,b) => b.count - a.count).slice(0, limit);
}

function summarizeBy(rows, fn){
  const map = {};
  rows.forEach(r => {
    const key = fn(r);
    if(!map[key]) map[key] = {rows:0, counts:Array(10).fill(0)};
    map[key].rows++;
    r.digits.forEach(d => { if(d >=0 && d <=9) map[key].counts[d]++; });
  });
  return Object.entries(map).map(([key, val]) => {
    const top = DIGITS.slice().sort((a,b) => val.counts[b] - val.counts[a]).slice(0,3).join(' ');
    return {key, rows:val.rows, top};
  }).sort((a,b) => b.rows - a.rows);
}

function runBacktest(rows, market){
  const minTrain = Math.min(25, Math.max(8, Math.floor(rows.length * 0.45)));
  const maxTests = Math.min(30, rows.length - minTrain);
  let tests=0,total=0,hit3=0,hit4=0,best=0,twinHit=0,twinDraw=0;
  for(let actualIndex=0; actualIndex<maxTests; actualIndex++){
    const train = rows.slice(actualIndex + 1);
    if(train.length < minTrain) continue;
    const model = buildModel(train, market);
    const actual = rows[actualIndex].digits;
    const hit = multisetHit([...model.finalDigits, model.twinDigit], actual);
    const c = countMap(actual);
    tests++; total += hit; best = Math.max(best, hit);
    if(hit >= 3) hit3++; if(hit >= 4) hit4++;
    if(Object.values(c).some(v => v >= 2)) twinDraw++;
    if((c[model.twinDigit] || 0) >= 2) twinHit++;
  }
  return {tests, avg: tests ? total/tests : 0, hit3: tests ? hit3/tests : 0, hit4: tests ? hit4/tests : 0, best, twinHit: tests ? twinHit/tests : 0, twinDraw: tests ? twinDraw/tests : 0};
}

function multisetHit(pred, actual){
  const pc = countMap(pred), ac = countMap(actual);
  let h = 0;
  DIGITS.forEach(d => h += Math.min(pc[d] || 0, ac[d] || 0));
  return h;
}

function auditAllMarkets(){
  try{
    parsedRows = parseRows($('dataInput').value);
    if(!parsedRows.length) throw new Error('Data belum terbaca.');
    const markets = [...new Set(parsedRows.map(r => r.market))];
    const cards = markets.map(m => {
      const rows = parsedRows.filter(r => r.market === m);
      const model = buildModel(rows, m);
      return `<div class="audit-card"><b>${escapeHtml(MARKET_META[m]?.label || m)}</b>
        <small>${rows.length} baris • Latest ${escapeHtml(model.latestDraw)} • Final ${model.finalDigits.join(' ')} • Kembar ${model.twinDigit}${model.twinDigit}</small></div>`;
    }).join('');
    $('output').className = '';
    $('output').innerHTML = `<div class="section"><h3>Audit Semua Market dari Input</h3><div class="audit-grid">${cards}</div></div>`;
  }catch(err){ renderError(err.message || String(err)); }
}

function renderReport(r){
  const digitsHtml = r.finalDigits.map(d => {
    const m = r.models.find(x => x.digit === d);
    return `<div class="digit ${m.className}">${d}<small>${m.className}</small></div>`;
  }).join('');
  const statsHtml = `
    <div class="stats">
      <div class="stat"><div class="k">Market</div><div class="v">${escapeHtml(r.marketLabel)}</div></div>
      <div class="stat"><div class="k">Data</div><div class="v">${r.N}</div></div>
      <div class="stat"><div class="k">Latest</div><div class="v">${escapeHtml(r.latestDraw)}</div></div>
      <div class="stat"><div class="k">Target Hari</div><div class="v">${escapeHtml(r.targetDay || '-')}</div></div>
      <div class="stat"><div class="k">Chi Square</div><div class="v">${fmt(r.chi.chi,2)}</div></div>
      <div class="stat"><div class="k">p-value</div><div class="v">${fmt(r.chi.p,3)}</div></div>
      <div class="stat"><div class="k">Bulan</div><div class="v">${r.targetMonth || '-'}</div></div>
      <div class="stat"><div class="k">Sumber</div><div class="v">${sourceBadge(r.meta.status)}</div></div>
    </div>`;
  const rankHtml = r.models.map(m => `<div class="rankitem">
    <b>${m.digit}</b>
    <div><div class="bar"><div class="fill" style="width:${clamp(m.score*100,3,100)}%"></div></div>
    <small>${m.className} • skor=${fmt(m.score,3)} • old=${pct(m.oldScore)} • rebound=${pct(m.rebound)} • rotasi=${pct(m.neighbor)} • shape=${pct(m.shape)} • survivor=${pct(m.survivor)} • posisi=${pct(m.position)} • anti=${pct(m.anti)} • recent=${pct(m.recent)} • markov=${pct(m.markov)}</small></div>
    <b>${fmt(m.score,3)}</b></div>`).join('');
  const twinHtml = r.models.slice().sort((a,b) => b.twin - a.twin).map(m => `<div class="rankitem">
    <b>${m.digit}</b><div><small>twin=${fmt(m.twin,3)} • repeat=${pct(m.repeat)} • rebound=${pct(m.rebound)} • shape=${pct(m.shape)} • anti=${pct(m.anti)} • markov=${pct(m.markov)} ${m.digit===r.twinDigit?'• TWIN':''}</small></div><b>${fmt(m.twin,3)}</b></div>`).join('');
  const pairHtml = r.pairs.map(p => `<div class="rankitem"><b>${p.pair}</b><div><small>Muncul bersama ${p.count} kali dalam ${r.N} baris</small></div><b>${pct(p.rate)}</b></div>`).join('');
  const dayHtml = r.daySummary.map(x => `<div class="rankitem"><b>${escapeHtml(x.key.slice(0,3))}</b><div><small>${escapeHtml(x.key)} • ${x.rows} baris • top digit: ${x.top}</small></div><b>${x.rows}</b></div>`).join('');
  const monthHtml = r.monthSummary.map(x => `<div class="rankitem"><b>${escapeHtml(x.key.replace('Bulan ',''))}</b><div><small>${escapeHtml(x.key)} • ${x.rows} baris • top digit: ${x.top}</small></div><b>${x.rows}</b></div>`).join('');
  const backtestHtml = r.backtest ? `<div class="section"><h3>Rolling Backtest</h3>
    <div class="stats">
      <div class="stat"><div class="k">Tests</div><div class="v">${r.backtest.tests}</div></div>
      <div class="stat"><div class="k">Avg Hit</div><div class="v">${fmt(r.backtest.avg,2)}</div></div>
      <div class="stat"><div class="k">Hit ≥3</div><div class="v">${pct(r.backtest.hit3)}</div></div>
      <div class="stat"><div class="k">Hit ≥4</div><div class="v">${pct(r.backtest.hit4)}</div></div>
      <div class="stat"><div class="k">Best</div><div class="v">${r.backtest.best}</div></div>
      <div class="stat"><div class="k">Twin Hit</div><div class="v">${pct(r.backtest.twinHit)}</div></div>
      <div class="stat"><div class="k">Twin Draw</div><div class="v">${pct(r.backtest.twinDraw)}</div></div>
      <div class="stat"><div class="k">Mode</div><div class="v">${escapeHtml(r.marketLabel)}</div></div>
    </div>
  </div>` : '';
  const tableHtml = renderDataTable(r.rows.slice(0, 80));
  lastReportText = makePlainReport(r);
  $('output').className = '';
  $('output').innerHTML = `<div class="result-block">
    <div class="final-card">
      <h3>Final 6 Digit Utama + 1 Kandidat Kembar</h3>
      <div class="digits">${digitsHtml}</div>
      <div class="twin-box"><small>Kandidat kembar berbasis riset</small><b>${r.twinDigit}${r.twinDigit}</b></div>
      <p class="tagline">Shortlist V3.1 membaca frekuensi lama, rebound digit dingin, rotasi tetangga, shape Markov, survivor carry, sinyal posisi kecil, anti-saturation, pair support, gap, repeat, dan golden ratio. Gunakan sebagai bahan belajar pola, bukan kepastian hasil.</p>
    </div>
    <div class="section"><h3>Diagnostik Market</h3>${statsHtml}</div>
    ${backtestHtml}
    <div class="section"><h3>Ranking Digit Utama</h3><div class="rank">${rankHtml}</div></div>
    <div class="section"><h3>Ranking Kandidat Kembar</h3><div class="rank">${twinHtml}</div></div>
    <div class="section"><h3>Pair Support Tertinggi</h3><div class="rank">${pairHtml}</div></div>
    <div class="section"><h3>Pengaruh Hari</h3><div class="rank">${dayHtml || '<p class="hint">Hari belum terbaca.</p>'}</div></div>
    <div class="section"><h3>Pengaruh Bulan</h3><div class="rank">${monthHtml || '<p class="hint">Bulan belum terbaca.</p>'}</div></div>
    <div class="section"><h3>Arsip Terbaru</h3>${tableHtml}</div>
  </div>`;
}

function renderDataTable(rows){
  if(!rows.length) return '<p class="hint">Tidak ada data.</p>';
  const body = rows.map(r => `<tr><td>${escapeHtml(r.date || '-')}</td><td>${escapeHtml(r.day || '-')}</td><td>${escapeHtml(r.code || r.market)}</td><td>${escapeHtml(String(r.period || '-'))}</td><td><b>${escapeHtml(r.digits.join(' '))}</b></td><td>${escapeHtml(r.marketName || '')}</td></tr>`).join('');
  return `<div class="table-wrap"><table class="data-table"><thead><tr><th>Tanggal</th><th>Hari</th><th>Kode</th><th>Periode</th><th>Digit</th><th>Market</th></tr></thead><tbody>${body}</tbody></table></div>`;
}

function sourceBadge(status){
  if(status === 'verified') return '<span class="badge-ok">Resmi</span>';
  if(status === 'verified-link') return '<span class="badge-ok">Link</span>';
  if(status === 'unverified') return '<span class="badge-warn">Cek</span>';
  return '<span class="badge-warn">Arsip</span>';
}

function makePlainReport(r){
  return [
    `Dashboard Riset Pola Keluaran Resmi Multi Pasaran`,
    `Market: ${r.marketLabel}`,
    `Data: ${r.N} baris`,
    `Latest: ${r.latestDraw}`,
    `Target hari: ${r.targetDay || '-'}`,
    `Final 6 Digit Utama: ${r.finalDigits.join(' ')}`,
    `Kandidat Kembar: ${r.twinDigit}${r.twinDigit}`,
    `Chi-square: ${fmt(r.chi.chi,2)}, p-value: ${fmt(r.chi.p,3)}`,
    `Catatan: shortlist riset statistik, bukan kepastian hasil.`
  ].join('\n');
}

function exportCsv(){
  const rows = parseRows($('dataInput').value);
  if(!rows.length) return alert('Tidak ada data untuk diekspor.');
  const header = ['market','marketName','code','period','date','day','digits','additional','prizeRank'];
  const csv = [header.join(',')].concat(rows.map(r => header.map(h => csvCell(h === 'digits' ? r.digits.join(' ') : h === 'additional' ? (r.additional || []).join(' ') : r[h] ?? '')).join(','))).join('\n');
  downloadText(csv, 'arsip_keluaran_multi_pasaran.csv', 'text/csv');
}

function copyReport(){
  if(!lastReportText) return alert('Belum ada report. Jalankan analisis dulu.');
  navigator.clipboard?.writeText(lastReportText).then(() => alert('Report disalin.'));
}

function downloadText(text, filename, type){
  const blob = new Blob([text], {type});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

function csvCell(v){
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g,'""') + '"' : s;
}

function renderInfo(message){
  $('output').className = '';
  $('output').innerHTML = `<div class="section"><h3>Info</h3><p class="hint">${escapeHtml(message)}</p></div>`;
}
function renderError(message){
  $('output').className = '';
  $('output').innerHTML = `<div class="section error"><h3>Error</h3><p>${escapeHtml(message)}</p></div>`;
}

function countMap(arr){ const m={}; arr.forEach(x => m[x] = (m[x] || 0) + 1); return m; }
function unique(arr){ return [...new Set(arr)]; }
function clamp(x,a,b){ return Math.max(a, Math.min(b, Number.isFinite(x) ? x : 0)); }
function fmt(x,n=3){ return (Number.isFinite(x) ? x : 0).toFixed(n); }
function pct(x){ return `${((Number.isFinite(x) ? x : 0)*100).toFixed(1)}%`; }
function normalizeArray(arr){
  const min = Math.min(...arr), max = Math.max(...arr);
  if(!Number.isFinite(min) || !Number.isFinite(max) || Math.abs(max-min) < 1e-9) return arr.map(() => 0.5);
  return arr.map(v => (v - min) / (max - min));
}
function escapeHtml(value){
  return String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
}
