const SKIN_HEX = ['f2d3b1', 'ecad80', 'd08b5b', '9e5622', '763900'];
const HAIR_HEX = ['0e0e0e', '562306', '6a4e35', 'e5d05c', 'cb6820', 'afafaf'];

const EA_NATION_TO_ISO = {
  '14':'gb-eng','25':'ie','42':'gb-sct','50':'gb-wls','35':'gb-nir','18':'fr','21':'de','45':'es',
  '27':'it','34':'nl','38':'pt','7':'be','54':'br','52':'ar','95':'us','70':'ca','195':'au',
  '133':'ng','13':'dk','46':'se','36':'no','37':'pl','10':'hr','47':'ch','4':'at'
};

const EA_PRO_POS_MAP = {
  '0':'GK','2':'RWB','3':'RB','4':'RCB','5':'CB','6':'LCB','7':'LB','8':'LWB',
  '9':'RDM','10':'CDM','11':'LDM','12':'RM','13':'RCM','14':'CM','15':'LCM','16':'LM',
  '17':'RAM','18':'CAM','19':'LAM','20':'RF','21':'CF','22':'LF','23':'RW',
  '24':'RS','25':'ST','26':'LS','27':'LW'
};

const FORMATION_TEMPLATES = {
  '4-1-2-1-2': { name: '4-1-2-1-2 (4-2-1-2)', atk: ['LS','RS'], cam: ['CAM'], mid: ['LCDM','RCDM'], def: ['LB','LCB','RCB','RB'], gk: ['GK'] },
  '4-2-3-1 Narrow': { name: '4-2-3-1 Narrow', atk: ['ST'], cam: ['LAM','CAM','RAM'], mid: ['LCDM','RCDM'], def: ['LB','LCB','RCB','RB'], gk: ['GK'] },
  '4-3-3 Attack': { name: '4-3-3 Attack', atk: ['LW','ST','RW'], cam: ['CAM'], mid: ['LCM','RCM'], def: ['LB','LCB','RCB','RB'], gk: ['GK'] },
  '4-3-3 Holding': { name: '4-3-3 Holding', atk: ['LW','ST','RW'], cam: ['LCM','RCM'], mid: ['CDM'], def: ['LB','LCB','RCB','RB'], gk: ['GK'] },
  '4-4-2 Flat': { name: '4-4-2 Flat', atk: ['LS','RS'], cam: [], mid: ['LM','LCM','RCM','RM'], def: ['LB','LCB','RCB','RB'], gk: ['GK'] },
  '3-5-2': { name: '3-5-2', atk: ['LS','RS'], cam: ['CAM'], mid: ['LM','LCDM','RCDM','RM'], def: ['LCB','CB','RCB'], gk: ['GK'] },
  '5-3-2': { name: '5-3-2', atk: ['LS','RS'], cam: ['CAM'], mid: ['LCM','RCM'], def: ['LWB','LCB','CB','RCB','RWB'], gk: ['GK'] }
};

const PRO_SILHOUETTE_DATA_URI = `data:image/svg+xml;utf8,` + encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 256 256" shape-rendering="geometricPrecision"><defs><radialGradient id="bgGlow" cx="50%" cy="38%" r="58%"><stop offset="0%" stop-color="#1e293b"/><stop offset="65%" stop-color="#0f172a"/><stop offset="100%" stop-color="#070a12"/></radialGradient><radialGradient id="emeraldHalo" cx="50%" cy="32%" r="42%"><stop offset="0%" stop-color="#10b981" stop-opacity="0.22"/><stop offset="100%" stop-color="#10b981" stop-opacity="0"/></radialGradient><linearGradient id="headGrad" x1="20%" y1="0%" x2="80%" y2="100%"><stop offset="0%" stop-color="#94a3b8"/><stop offset="45%" stop-color="#475569"/><stop offset="100%" stop-color="#1e293b"/></linearGradient><linearGradient id="jerseyGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#334155"/><stop offset="50%" stop-color="#1e293b"/><stop offset="100%" stop-color="#090d16"/></linearGradient><linearGradient id="rimLight" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#e2e8f0" stop-opacity="0.9"/><stop offset="50%" stop-color="#64748b" stop-opacity="0.4"/><stop offset="100%" stop-color="#10b981" stop-opacity="0.7"/></linearGradient></defs><rect width="256" height="256" fill="url(#bgGlow)"/><circle cx="128" cy="96" r="96" fill="url(#emeraldHalo)"/><path d="M 96 130 L 84 166 L 172 166 L 160 130 Z" fill="#1e293b"/><path d="M 102 130 L 96 164 L 128 176 L 160 164 L 154 130 Z" fill="url(#headGrad)" opacity="0.85"/><path d="M 12 256 C 16 192 50 166 94 156 L 128 188 L 162 156 C 206 166 240 192 244 256 Z" fill="url(#jerseyGrad)" stroke="url(#rimLight)" stroke-width="2.5" stroke-linejoin="round"/><path d="M 42 184 C 62 170 78 164 96 159" fill="none" stroke="#10b981" stroke-width="4" stroke-linecap="round" opacity="0.85"/><path d="M 214 184 C 194 170 178 164 160 159" fill="none" stroke="#10b981" stroke-width="4" stroke-linecap="round" opacity="0.85"/><path d="M 52 198 C 68 188 80 184 94 180" fill="none" stroke="#475569" stroke-width="2" stroke-linecap="round" opacity="0.5"/><path d="M 204 198 C 188 188 176 184 162 180" fill="none" stroke="#475569" stroke-width="2" stroke-linecap="round" opacity="0.5"/><path d="M 90 156 L 128 194 L 166 156 L 156 153 L 128 181 L 100 153 Z" fill="#0f172a" stroke="#10b981" stroke-width="1.8" stroke-linejoin="round"/><path d="M 128 32 C 100 32 84 48 84 74 L 84 86 C 79 86 76 91 77 98 C 78 105 81 109 85 109 C 88 124 98 138 112 145 C 118 148 123 149 128 149 C 133 149 138 148 144 145 C 158 138 168 124 171 109 C 175 109 178 105 179 98 C 180 91 177 86 172 86 L 172 74 C 172 48 156 32 128 32 Z" fill="url(#headGrad)" stroke="url(#rimLight)" stroke-width="2.5" stroke-linejoin="round"/><path d="M 94 64 C 94 48 108 38 128 38" fill="none" stroke="#f8fafc" stroke-width="2.2" stroke-linecap="round" opacity="0.45"/></svg>`
);

const BALL_SVG = (cx, cy, r) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="currentColor" stroke-width="2.8"/><polygon points="${cx},${cy-r*0.45} ${cx+r*0.42},${cy-r*0.12} ${cx+r*0.26},${cy+r*0.38} ${cx-r*0.26},${cy+r*0.38} ${cx-r*0.42},${cy-r*0.12}" fill="currentColor"/>`;

const OFFICIAL_EA_PLAYSTYLE_VECTORS = {
  cross_claimer: `${BALL_SVG(62,32,10.5)}<path d="M 24 68 L 42 46 L 52 54 L 34 74 Z" fill="currentColor"/><path d="M 40 44 C 38 36 44 30 50 34 L 56 42 C 58 46 54 52 48 50 Z" fill="currentColor"/>`,
  deflector: `<path d="M 44 18 L 68 27 L 68 48 C 68 64 44 76 44 76 C 44 76 20 64 20 48 L 20 27 Z" fill="none" stroke="currentColor" stroke-width="4.5" stroke-linejoin="round"/><path d="M 44 38 L 76 26 M 44 38 L 74 54" stroke="currentColor" stroke-width="4" stroke-linecap="round"/><polygon points="72,20 82,24 75,33" fill="currentColor"/><polygon points="71,48 80,57 69,59" fill="currentColor"/>`,
  far_reach: `${BALL_SVG(36,30,10)}<path d="M 30 48 C 32 42 40 40 46 44 L 66 56 L 58 72 L 36 58 Z" fill="currentColor"/><path d="M 24 38 Q 22 24 34 20" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>`,
  footwork: `<path d="M 22 22 L 38 22 L 46 52 L 62 56 C 66 57 68 62 64 66 L 34 66 L 26 42 Z" fill="currentColor"/>${BALL_SVG(62,42,10.5)}`,
  finesse_shot: `${BALL_SVG(64,32,10.5)}<path d="M 24 68 C 22 40 40 28 54 30" fill="none" stroke="currentColor" stroke-width="4.5" stroke-linecap="round"/><polygon points="50,23 61,30 50,37" fill="currentColor"/><path d="M 34 74 C 34 52 46 44 60 44" fill="none" stroke="currentColor" stroke-width="3" stroke-dasharray="4 4" stroke-linecap="round"/>`,
  power_shot: `${BALL_SVG(64,34,11)}<path d="M 18 70 L 50 44 M 18 54 L 42 34 M 34 74 L 58 54" stroke="currentColor" stroke-width="4.5" stroke-linecap="round"/>`,
  chip_shot: `${BALL_SVG(68,42,9.5)}<path d="M 20 66 Q 42 12 64 34" fill="none" stroke="currentColor" stroke-width="4.2" stroke-linecap="round"/><line x1="18" y1="68" x2="78" y2="68" stroke="currentColor" stroke-width="2.5" stroke-dasharray="4 4"/>`,
  dead_ball: `${BALL_SVG(42,54,10.5)}<path d="M 52 46 Q 68 26 78 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"/><polygon points="72,18 83,22 76,31" fill="currentColor"/><line x1="24" y1="66" x2="60" y2="66" stroke="currentColor" stroke-width="3.5"/>`,
  incisive_pass: `<circle cx="28" cy="42" r="6.5" fill="currentColor"/><circle cx="28" cy="66" r="6.5" fill="currentColor"/><path d="M 38 64 L 70 32" stroke="currentColor" stroke-width="4.5" stroke-linecap="round"/><polygon points="62,26 76,26 76,40" fill="currentColor"/><line x1="38" y1="42" x2="62" y2="42" stroke="currentColor" stroke-width="3.2" stroke-dasharray="4 4" stroke-linecap="round"/>`,
  tiki_taka: `<polygon points="50,22 74,64 26,64" fill="none" stroke="currentColor" stroke-width="3.8" stroke-dasharray="5 3" stroke-linejoin="round"/><circle cx="50" cy="22" r="7" fill="currentColor"/><circle cx="74" cy="64" r="7" fill="currentColor"/><circle cx="26" cy="64" r="7" fill="currentColor"/>`,
  whipped_pass: `${BALL_SVG(66,44,10)}<path d="M 20 62 Q 44 20 62 34" fill="none" stroke="currentColor" stroke-width="4.2" stroke-linecap="round"/><path d="M 20 46 Q 44 10 66 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round"/>`,
  pinged_pass: `${BALL_SVG(66,46,10.5)}<line x1="16" y1="46" x2="50" y2="46" stroke="currentColor" stroke-width="4.8" stroke-linecap="round"/><line x1="22" y1="34" x2="44" y2="34" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/><line x1="22" y1="58" x2="44" y2="58" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/>`,
  long_ball_pass: `${BALL_SVG(26,60,9)}<path d="M 34 52 Q 54 14 78 46" fill="none" stroke="currentColor" stroke-width="4.2" stroke-linecap="round"/><polygon points="73,40 83,50 70,51" fill="currentColor"/>`,
  technical: `${BALL_SVG(50,28,9.5)}<path d="M 26 68 Q 38 44 50 50 T 74 36" fill="none" stroke="currentColor" stroke-width="4.2" stroke-linecap="round"/><circle cx="31" cy="46" r="4" fill="currentColor"/><circle cx="69" cy="56" r="4" fill="currentColor"/>`,
  rapid: `<polygon points="56,16 28,48 47,48 39,76 72,40 52,40" fill="currentColor"/>`,
  quick_step: `<path d="M 22 60 L 48 60 L 62 42 L 78 42" fill="none" stroke="currentColor" stroke-width="4.5" stroke-linecap="round"/><polygon points="72,34 84,42 72,50" fill="currentColor"/><line x1="18" y1="46" x2="42" y2="46" stroke="currentColor" stroke-width="3.5" stroke-dasharray="4 4"/>`,
  trickster: `${BALL_SVG(50,46,10)}<path d="M 24 46 A 26 16 0 1 1 76 46" fill="none" stroke="currentColor" stroke-width="3.8" stroke-linecap="round"/><path d="M 76 46 A 26 16 0 1 1 24 46" fill="none" stroke="currentColor" stroke-width="3.8" stroke-dasharray="4 4" stroke-linecap="round"/>`,
  press_proven: `<path d="M 50 18 L 76 30 L 70 64 L 50 76 L 30 64 L 24 30 Z" fill="none" stroke="currentColor" stroke-width="4"/><circle cx="50" cy="46" r="9" fill="currentColor"/>`,
  first_touch: `${BALL_SVG(50,34,10.5)}<path d="M 26 62 L 74 62 M 34 71 L 66 71" stroke="currentColor" stroke-width="4.2" stroke-linecap="round"/><line x1="50" y1="47" x2="50" y2="59" stroke="currentColor" stroke-width="3.8" stroke-linecap="round"/>`,
  anticipate: `<path d="M 50 18 L 74 28 L 74 48 C 74 64 50 76 50 76 C 50 76 26 64 26 48 L 26 28 Z" fill="none" stroke="currentColor" stroke-width="4.2" stroke-linejoin="round"/>${BALL_SVG(50,46,10)}`,
  intercept: `<line x1="18" y1="46" x2="82" y2="46" stroke="currentColor" stroke-width="4" stroke-dasharray="5 4" stroke-linecap="round"/>${BALL_SVG(50,46,10.5)}<line x1="50" y1="18" x2="50" y2="31" stroke="currentColor" stroke-width="4.2" stroke-linecap="round"/><line x1="50" y1="74" x2="50" y2="61" stroke="currentColor" stroke-width="4.2" stroke-linecap="round"/>`,
  jockey: `<line x1="22" y1="50" x2="78" y2="50" stroke="currentColor" stroke-width="4.2" stroke-linecap="round"/><polygon points="16,50 28,40 28,60" fill="currentColor"/><polygon points="84,50 72,40 72,60" fill="currentColor"/><circle cx="50" cy="30" r="8.5" fill="currentColor"/>`,
  block: `<rect x="26" y="24" width="48" height="44" rx="6" fill="none" stroke="currentColor" stroke-width="4.2"/>${BALL_SVG(50,46,10)}`,
  slide_tackle: `<path d="M 18 62 L 62 62 L 76 44" fill="none" stroke="currentColor" stroke-width="4.8" stroke-linecap="round"/>${BALL_SVG(34,42,9.5)}`,
  bruiser: `<circle cx="38" cy="28" r="7" fill="currentColor"/><path d="M 24 64 L 30 40 L 52 40 L 58 64 Z" fill="currentColor"/><path d="M 58 36 L 78 28 M 60 48 L 80 48 M 58 60 L 78 68" stroke="currentColor" stroke-width="4.2" stroke-linecap="round"/>`,
  aerial_fortress: `<polygon points="50,16 74,42 59,42 59,70 41,70 41,42 26,42" fill="currentColor"/>`,
  relentless: `<path d="M 50 26 C 38 14 20 24 20 40 C 20 58 50 74 50 74 C 50 74 80 58 80 40 C 80 24 62 14 50 26 Z" fill="none" stroke="currentColor" stroke-width="4.2" stroke-linejoin="round"/><polyline points="28,44 42,44 47,32 54,56 59,44 72,44" fill="none" stroke="currentColor" stroke-width="3.8" stroke-linecap="round" stroke-linejoin="round"/>`,
  trivela: `${BALL_SVG(34,34,9.5)}<path d="M 66 70 C 78 46 66 28 48 32" fill="none" stroke="currentColor" stroke-width="4.2" stroke-linecap="round"/><polygon points="50,25 40,33 52,39" fill="currentColor"/>`
};

function renderDivisionShieldHtml(divLabelOrNum, size = 'md') {
  const str = String(divLabelOrNum ?? 'Div 5').trim().toLowerCase();
  const num = (str.includes('elite') || str === '0') ? 0 : Math.max(1, Math.min(5, parseInt(str.replace(/[^0-9]/g, ''), 10) || 5));
  const uid = `eaDiv_${num}_${Math.random().toString(36).substring(2, 7)}`;
  const dims = size === 'lg' ? 'w-11 h-13 sm:w-12 sm:h-14' : (size === 'sm' ? 'w-6 h-7 sm:w-7 sm:h-8' : 'w-9 h-10');
  const pals = {
    5: { t: '#1c1917', b: '#09090b', f: '#292524', g: null, w: false },
    4: { t: '#1e293b', b: '#090d16', f: '#334155', g: '#10b981', w: true },
    3: { t: '#2e2318', b: '#0c0a09', f: '#443322', g: '#d4af37', w: true },
    2: { t: '#0d4a4e', b: '#041316', f: '#146c72', g: '#2dd4bf', w: true },
    1: { t: '#991b1b', b: '#450a0a', f: '#dc2626', g: '#ef4444', w: true },
    0: { t: '#5b21b6', b: '#2e1065', f: '#7c3aed', g: '#a855f7', w: true }
  };
  const p = pals[num] || pals[5];
  const wreath = p.w ? `<path d="M 34 78 C 22 68 20 46 28 32 M 66 78 C 78 68 80 46 72 32" fill="none" stroke="url(#${uid}_g)" stroke-width="2.5" stroke-dasharray="4 2" stroke-linecap="round" opacity="${num<=1?'0.95':'0.45'}"/>` : '';
  const wings = num === 0 ? `<path d="M 16 74 C 2 62 2 38 12 22 C 6 40 10 58 20 70 Z M 18 82 C 4 72 0 52 8 34 C 6 50 12 66 24 78 Z M 84 74 C 98 62 98 38 88 22 C 94 40 90 58 80 70 Z M 82 82 C 96 72 100 52 92 34 C 94 50 88 66 76 78 Z" fill="url(#${uid}_g)"/>` : '';
  const sym = num === 0
    ? `<polygon points="38,28 43,19 50,25 57,19 62,28" fill="url(#${uid}_n)"/><path d="M 46 34 C 52 32 58 35 58 41 C 58 45 55 47 57 52 C 60 56 64 54 64 59 C 64 63 58 63 55 61 L 58 72 L 52 72 L 49 62 L 44 62 L 41 72 L 36 72 L 40 58 C 36 55 34 49 38 45 C 35 42 36 37 41 38 L 46 34 Z" fill="url(#${uid}_n)"/>`
    : `<text x="50" y="64" font-family="'Cinzel', Georgia, serif" font-size="44" font-weight="900" fill="url(#${uid}_n)" text-anchor="middle">${num}</text>`;

  return `<div class="inline-flex items-center gap-1 select-none" title="EA Sports FC ${num===0?'Elite Division':`Division ${num}`}"><div class="${dims} relative flex-shrink-0 drop-shadow-md"><svg viewBox="0 0 100 114" class="w-full h-full overflow-visible"><defs><linearGradient id="${uid}_g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#fef08a"/><stop offset="45%" stop-color="#e5c158"/><stop offset="100%" stop-color="#a17419"/></linearGradient><linearGradient id="${uid}_c" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="${p.t}"/><stop offset="100%" stop-color="${p.b}"/></linearGradient><linearGradient id="${uid}_n" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#ffffff"/><stop offset="35%" stop-color="#fde68a"/><stop offset="100%" stop-color="#b48628"/></linearGradient></defs>${wings}<path d="M 50 4 L 86 18 L 86 42 L 82 46 L 86 50 C 86 78 68 94 50 106 C 32 94 14 78 14 50 L 18 46 L 14 42 L 14 18 Z" fill="url(#${uid}_g)" stroke="#422c06" stroke-width="2"/><path d="M 50 10 L 80 22 L 80 41 L 77 46 L 80 51 C 80 74 64 88 50 99 C 36 88 20 74 20 51 L 23 46 L 20 41 L 20 22 Z" fill="url(#${uid}_c)" stroke="url(#${uid}_g)" stroke-width="1.5"/><polygon points="50,10 80,22 65,42 50,28" fill="${p.f}" opacity="0.55"/>${wreath}${sym}<path d="M 53 82 C 48 80 45 83 45 86 C 45 89 48 92 53 90" fill="none" stroke="url(#${uid}_n)" stroke-width="2.5" stroke-linecap="round"/>${p.g ? `<circle cx="50" cy="105" r="4.5" fill="${p.g}" stroke="url(#${uid}_g)" stroke-width="1.8"/>` : ''}</svg></div>${size === 'lg' ? `<span class="text-xs font-black uppercase tracking-wider text-emerald-400">${num===0?'Elite':`Div ${num}`}</span>` : ''}</div>`;
}

function renderMiniJerseySvg([c1, c2, c3] = ['#10b981', '#ffffff', '#064e3b'], label = 'Home') {
  return `<div class="flex items-center gap-1" title="${label} Kit"><svg viewBox="0 0 36 34" class="w-4 h-4 sm:w-5 sm:h-5"><path d="M 8 6 L 2 14 L 7 18 L 11 12 Z M 28 6 L 34 14 L 29 18 L 25 12 Z" fill="${c2}" stroke="#0f172a" stroke-width="1.5"/><path d="M 10 6 L 26 6 L 26 30 L 10 30 Z" fill="${c1}" stroke="#0f172a" stroke-width="1.5"/><rect x="16" y="6" width="4" height="24" fill="${c2}" opacity="0.85"/><path d="M 14 6 Q 18 11 22 6" fill="none" stroke="${c3}" stroke-width="2"/></svg><span class="text-[10px] font-bold text-gray-400">${label}</span></div>`;
}

function renderPlaystyleDiamondHtml(ps, isPlus = false) {
  const art = OFFICIAL_EA_PLAYSTYLE_VECTORS[ps.slug] || OFFICIAL_EA_PLAYSTYLE_VECTORS.technical;
  const gId = `psG_${ps.slug}_${isPlus?1:0}`;
  const stops = isPlus ? `<stop offset="0%" stop-color="#fde68a"/><stop offset="45%" stop-color="#f5c43c"/><stop offset="100%" stop-color="#c48b11"/>` : `<stop offset="0%" stop-color="#ffffff"/><stop offset="50%" stop-color="#e2e8f0"/><stop offset="100%" stop-color="#94a3b8"/>`;
  return `<div class="group ${isPlus ? 'ps-plus-badge' : 'ps-silver-badge'} cursor-pointer"><svg viewBox="0 0 100 92" class="w-full h-full text-[#1c1608]"><defs><linearGradient id="${gId}" x1="0%" y1="0%" x2="100%" y2="100%">${stops}</linearGradient></defs><polygon points="22,6 78,6 96,34 50,88 4,34" fill="url(#${gId})" stroke="#1c1608" stroke-width="4.5" stroke-linejoin="round"/><polygon points="25,13 75,13 88,34 50,79 12,34" fill="none" stroke="#1c1608" stroke-width="2" stroke-linejoin="round" opacity="0.8"/><g transform="translate(0,-2)">${art}</g></svg><div class="pointer-events-none absolute left-12 top-1/2 -translate-y-1/2 hidden group-hover:flex flex-col bg-gray-950/95 text-white border border-yellow-400/60 px-2.5 py-1.5 rounded-lg shadow-2xl w-44 z-50"><span class="text-[10px] font-black ${isPlus?'text-yellow-400':'text-slate-200'} uppercase">${ps.name}${isPlus?'+':''}</span><span class="text-[9px] text-gray-300 leading-tight mt-0.5">${ps.desc}</span></div></div>`;
}
