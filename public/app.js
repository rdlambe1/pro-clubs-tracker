const API_BASE = '/api';
let GLOBAL_MEMBERS = [], GLOBAL_MATCHES = [], GLOBAL_COMBINED_DATA = {}, GLOBAL_CLUB_ID = null;
let RECENT_FORM_MAP = {}, RECENT_10_STATS_MAP = {}, SESSION_MATCHES_CACHE = [];
let TOP_FIDGET_SPINNER_NAME = null, CURRENT_CLUB_CREST_URL = '', ACTIVE_MODAL_PLAYER = null;
let CURRENT_PITCH_MODE = 'lastMatch', CURRENT_RECAP_MODE = 'session';

const SKIN_HEX = ['f2d3b1', 'ecad80', 'd08b5b', '9e5622', '763900'];
const HAIR_HEX = ['0e0e0e', '562306', '6a4e35', 'e5d05c', 'cb6820', 'afafaf'];
const EA_NATION_TO_ISO = { '14':'gb-eng','25':'ie','42':'gb-sct','50':'gb-wls','35':'gb-nir','18':'fr','21':'de','45':'es','27':'it','34':'nl','38':'pt','7':'be','54':'br','52':'ar','95':'us','70':'ca','195':'au','133':'ng','13':'dk','46':'se','36':'no','37':'pl','10':'hr','47':'ch','4':'at' };

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

function applyStoredTheme() {
  const isLight = (localStorage.getItem('proClubsTheme') || 'dark') === 'light';
  document.body.classList.toggle('light-mode', isLight);
  document.querySelectorAll('.theme-icon').forEach(el => el.className = `theme-icon fa-solid ${isLight ? 'fa-moon text-indigo-500' : 'fa-sun text-yellow-400'}`);
  document.querySelectorAll('.theme-text').forEach(el => el.innerText = isLight ? 'Dark' : 'Light');
}

function toggleThemeMode() {
  localStorage.setItem('proClubsTheme', document.body.classList.contains('light-mode') ? 'dark' : 'light');
  applyStoredTheme();
}

function renderDivisionShieldHtml(divLabelOrNum, size = 'md') {
  const str = String(divLabelOrNum ?? 'Div 2').trim().toLowerCase();
  const num = (str.includes('elite') || str === '0') ? 0 : Math.max(1, Math.min(5, parseInt(str.replace(/[^0-9]/g, ''), 10) || 2));
  const uid = `eaDiv_${num}_${Math.random().toString(36).substring(2, 7)}`;
  const dims = size === 'lg' ? 'w-11 h-13 sm:w-12 sm:h-14' : (size === 'sm' ? 'w-6 h-7 sm:w-7 sm:h-8' : 'w-9 h-10');
  const palettes = {
    5: { bgTop: '#1c1917', bgBot: '#09090b', facet: '#292524', gem: null, wreath: false },
    4: { bgTop: '#1e293b', bgBot: '#090d16', facet: '#334155', gem: '#10b981', wreath: true },
    3: { bgTop: '#2e2318', bgBot: '#0c0a09', facet: '#443322', gem: '#d4af37', wreath: true },
    2: { bgTop: '#0d4a4e', bgBot: '#041316', facet: '#146c72', gem: '#2dd4bf', wreath: true },
    1: { bgTop: '#991b1b', bgBot: '#450a0a', facet: '#dc2626', gem: '#ef4444', wreath: true },
    0: { bgTop: '#5b21b6', bgBot: '#2e1065', facet: '#7c3aed', gem: '#a855f7', wreath: true }
  };
  const pal = palettes[num] || palettes[2];
  const innerWreath = pal.wreath ? `<path d="M 34 78 C 22 68 20 46 28 32" fill="none" stroke="url(#${uid}_gold)" stroke-width="2.5" stroke-dasharray="4 2" stroke-linecap="round" opacity="${num<=1?'0.95':'0.45'}"/><path d="M 66 78 C 78 68 80 46 72 32" fill="none" stroke="url(#${uid}_gold)" stroke-width="2.5" stroke-dasharray="4 2" stroke-linecap="round" opacity="${num<=1?'0.95':'0.45'}"/>` : '';
  const eliteWings = num === 0 ? `<path d="M 16 74 C 2 62 2 38 12 22 C 6 40 10 58 20 70 Z" fill="url(#${uid}_gold)"/><path d="M 18 82 C 4 72 0 52 8 34 C 6 50 12 66 24 78 Z" fill="url(#${uid}_gold)"/><path d="M 84 74 C 98 62 98 38 88 22 C 94 40 90 58 80 70 Z" fill="url(#${uid}_gold)"/><path d="M 82 82 C 96 72 100 52 92 34 C 94 50 88 66 76 78 Z" fill="url(#${uid}_gold)"/>` : '';
  const centerSym = num === 0
    ? `<polygon points="38,28 43,19 50,25 57,19 62,28" fill="url(#${uid}_num)"/><path d="M 46 34 C 52 32 58 35 58 41 C 58 45 55 47 57 52 C 60 56 64 54 64 59 C 64 63 58 63 55 61 L 58 72 L 52 72 L 49 62 L 44 62 L 41 72 L 36 72 L 40 58 C 36 55 34 49 38 45 C 35 42 36 37 41 38 L 46 34 Z" fill="url(#${uid}_num)"/>`
    : `<text x="50" y="64" font-family="'Cinzel', Georgia, serif" font-size="44" font-weight="900" fill="url(#${uid}_num)" text-anchor="middle">${num}</text>`;

  return `
    <div class="inline-flex items-center gap-1 select-none" title="EA Sports FC ${num===0?'Elite Division':`Division ${num}`}">
      <div class="${dims} relative flex-shrink-0 drop-shadow-md">
        <svg viewBox="0 0 100 114" class="w-full h-full overflow-visible">
          <defs>
            <linearGradient id="${uid}_gold" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#fef08a"/><stop offset="45%" stop-color="#e5c158"/><stop offset="100%" stop-color="#a17419"/></linearGradient>
            <linearGradient id="${uid}_core" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="${pal.bgTop}"/><stop offset="100%" stop-color="${pal.bgBot}"/></linearGradient>
            <linearGradient id="${uid}_num" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#ffffff"/><stop offset="35%" stop-color="#fde68a"/><stop offset="100%" stop-color="#b48628"/></linearGradient>
          </defs>
          ${eliteWings}
          <path d="M 50 4 L 86 18 L 86 42 L 82 46 L 86 50 C 86 78 68 94 50 106 C 32 94 14 78 14 50 L 18 46 L 14 42 L 14 18 Z" fill="url(#${uid}_gold)" stroke="#422c06" stroke-width="2"/>
          <path d="M 50 10 L 80 22 L 80 41 L 77 46 L 80 51 C 80 74 64 88 50 99 C 36 88 20 74 20 51 L 23 46 L 20 41 L 20 22 Z" fill="url(#${uid}_core)" stroke="url(#${uid}_gold)" stroke-width="1.5"/>
          <polygon points="50,10 80,22 65,42 50,28" fill="${pal.facet}" opacity="0.55"/>
          ${innerWreath}${centerSym}
          <path d="M 53 82 C 48 80 45 83 45 86 C 45 89 48 92 53 90" fill="none" stroke="url(#${uid}_num)" stroke-width="2.5" stroke-linecap="round"/>
          ${pal.gem ? `<circle cx="50" cy="105" r="4.5" fill="${pal.gem}" stroke="url(#${uid}_gold)" stroke-width="1.8"/>` : ''}
        </svg>
      </div>
      ${size === 'lg' ? `<span class="text-xs font-black uppercase tracking-wider text-emerald-400">${num===0?'Elite':`Div ${num}`}</span>` : ''}
    </div>`;
}

function renderMiniJerseySvg(colors = ['#10b981', '#ffffff', '#064e3b'], label = 'Home') {
  const [c1, c2, c3] = colors;
  return `<div class="flex items-center gap-1" title="${label} Kit"><svg viewBox="0 0 36 34" class="w-4 h-4 sm:w-5 sm:h-5"><path d="M 8 6 L 2 14 L 7 18 L 11 12 Z M 28 6 L 34 14 L 29 18 L 25 12 Z" fill="${c2}" stroke="#0f172a" stroke-width="1.5"/><path d="M 10 6 L 26 6 L 26 30 L 10 30 Z" fill="${c1}" stroke="#0f172a" stroke-width="1.5"/><rect x="16" y="6" width="4" height="24" fill="${c2}" opacity="0.85"/><path d="M 14 6 Q 18 11 22 6" fill="none" stroke="${c3}" stroke-width="2"/></svg><span class="text-[10px] font-bold text-gray-400">${label}</span></div>`;
}

function computeMatchGradeAndUnitRatings(myGoals, oppGoals, playerStats = []) {
  let shots = 0, pMade = 0, pAtt = 0, tackles = 0;
  playerStats.forEach(p => { shots += Number(p.shots||0); pMade += Number(p.passesmade||0); pAtt += Number(p.passattempts||p.passesmade||0); tackles += Number(p.tacklesmade||p.tackles||0); });
  const passPct = pAtt > 0 ? (pMade / pAtt) * 100 : 75;
  const shotConv = shots > 0 ? (myGoals / shots) : (myGoals > 0 ? 0.5 : 0);
  const atk = Math.min(9.9, Math.max(4.0, 5.6 + myGoals * 0.95 + shotConv * 1.6 + (passPct - 70) * 0.04));
  const def = Math.min(9.9, Math.max(3.8, 7.4 + (oppGoals === 0 ? 1.4 : 0) - oppGoals * 0.85 + Math.min(1.5, tackles * 0.14)));
  const gd = myGoals - oppGoals, comb = atk * 0.5 + def * 0.5 + gd * 0.35;

  if (comb >= 8.7 || (gd >= 3 && myGoals >= 4)) return { grade: 'S', gradeCls: 'bg-yellow-500/20 text-yellow-300 border-yellow-400/50', atk: atk.toFixed(1), def: def.toFixed(1) };
  if (comb >= 8.0 || gd >= 2) return { grade: 'A+', gradeCls: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40', atk: atk.toFixed(1), def: def.toFixed(1) };
  if (comb >= 7.3 || gd === 1) return { grade: 'A', gradeCls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30', atk: atk.toFixed(1), def: def.toFixed(1) };
  if (comb >= 6.4 || gd === 0) return { grade: 'B', gradeCls: 'bg-amber-500/15 text-amber-300 border-amber-500/30', atk: atk.toFixed(1), def: def.toFixed(1) };
  if (comb >= 5.5 || gd === -1) return { grade: 'C', gradeCls: 'bg-orange-500/15 text-orange-300 border-orange-500/30', atk: atk.toFixed(1), def: def.toFixed(1) };
  return { grade: 'D', gradeCls: 'bg-rose-500/15 text-rose-400 border-rose-500/30', atk: atk.toFixed(1), def: def.toFixed(1) };
}

function parsePlayerMatchEvents(p = {}) {
  const ev = {};
  for (let i = 0; i < 4; i++) {
    const s = p[`match_event_aggregate_${i}`];
    if (typeof s === 'string' && s.trim()) {
      s.split(',').forEach(pair => {
        const [k, v] = pair.split(':');
        const id = parseInt(k, 10), cnt = parseInt(v, 10);
        if (!isNaN(id) && !isNaN(cnt)) ev[id] = (ev[id] || 0) + cnt;
      });
    }
  }
  const beats = ev[38] || 0, takeOns = ev[112] || 0, dribbles = ev[174] || 0, flair = ev[147] || 0;
  let skills = beats + flair + Math.max(0, takeOns - beats);
  if (skills === 0 && dribbles > 0) skills = Math.max(1, Math.round(dribbles * 0.35));
  return { skillMoves: skills, dribblesCompleted: dribbles };
}

async function shareElementAsPng(elementId, filenamePrefix = 'ClubsTracker') {
  const el = document.getElementById(elementId);
  if (!el || typeof html2canvas === 'undefined') return;
  try {
    const canvas = await html2canvas(el, { backgroundColor: null, useCORS: true, scale: 2 });
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      const file = new File([blob], `${filenamePrefix}.png`, { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try { await navigator.share({ files: [file], title: filenamePrefix }); return; } catch (_) {}
      }
      if (navigator.clipboard && window.ClipboardItem) {
        try { await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]); alert('📸 Copied to clipboard!'); return; } catch (_) {}
      }
      const link = document.createElement('a');
      link.download = `${filenamePrefix}.png`; link.href = URL.createObjectURL(blob); link.click();
    }, 'image/png');
  } catch (e) { console.error(e); }
}

function getPlayerFunTag(player) {
  const name = player.name || player.proName || 'Unknown';
  const games = Math.max(1, Number(player.gamesPlayed ?? player.games ?? 1));
  const gpg = Number(player.goals ?? 0) / games, apg = Number(player.assists ?? 0) / games;
  const tpg = Number(player.tacklesmade ?? player.tackles ?? 0) / games;
  const tacklePct = Number(player.tacklesuccessrate ?? player.tackleSuccessRate ?? 0);
  const passPct = Number(player.passSuccessRate ?? player.passSuccess ?? 0);
  const rating = parseFloat(player.ratingAve || player.rating || 0);
  const motmRate = Number(player.manOfTheMatch ?? player.motm ?? 0) / games;
  const r10 = RECENT_10_STATS_MAP[name];

  if (r10 && r10.superSubGA >= 1) return { label: '🦸‍♂️ Super-Sub', cls: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/50' };
  if (name === TOP_FIDGET_SPINNER_NAME || (r10 && r10.games > 0 && r10.skillMoves / r10.games >= 3.5)) return { label: '🌀 Fidget Spinner', cls: 'bg-fuchsia-500/15 text-fuchsia-400 border-fuchsia-500/40' };
  if (motmRate >= 0.28 && games >= 5) return { label: '👑 MoTM Merchant', cls: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/40' };
  if (gpg >= 0.75) return { label: '🎯 Clinical Poacher', cls: 'bg-rose-500/15 text-rose-400 border-rose-500/40' };
  if (gpg >= 0.45 && apg <= gpg * 0.25) return { label: '🔫 Shoot on Sight', cls: 'bg-orange-500/15 text-orange-400 border-orange-500/40' };
  if (apg >= 0.5) return { label: '🎩 Chief Creator', cls: 'bg-purple-500/15 text-purple-400 border-purple-500/40' };
  if (passPct >= 84 && apg >= 0.25) return { label: '📐 Pass Master', cls: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/40' };
  if (tpg >= 1.8 && tacklePct >= 30) return { label: '🧱 Brick Wall', cls: 'bg-blue-500/15 text-blue-400 border-blue-500/40' };
  if (tpg >= 1.6 && tacklePct < 30) return { label: '🦵 Ankle Breaker', cls: 'bg-red-500/15 text-red-400 border-red-500/40' };
  if (gpg >= 0.35 && apg >= 0.35) return { label: '⚡ Double Threat', cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40' };
  if (passPct >= 82) return { label: '🧭 Metronome', cls: 'bg-teal-500/15 text-teal-400 border-teal-500/40' };
  if (player._normalizedPos === 'DEF') return { label: '🛡️ Backline Guardian', cls: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/40' };
  if (rating >= 7.6) return { label: '🔥 Big Game Player', cls: 'bg-amber-500/15 text-amber-400 border-amber-500/40' };
  return { label: '🫁 Box-to-Box Engine', cls: 'bg-slate-700/60 text-slate-300 border-slate-600' };
}

function getAppearanceMap() { try { return JSON.parse(localStorage.getItem('proClubsAppearanceV3') || '{}'); } catch (_) { return {}; } }

function getPlayerAppearance(playerObj) {
  const rawName = typeof playerObj === 'string' ? playerObj : (playerObj?.name || playerObj?.proName || '');
  const key = String(rawName).toLowerCase().trim();
  const saved = getAppearanceMap()[key] || {};
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = key.charCodeAt(i) + ((hash << 5) - hash);
  return { skin: saved.skin || SKIN_HEX[Math.abs(hash) % SKIN_HEX.length], hair: saved.hair || HAIR_HEX[Math.abs(hash >> 3) % HAIR_HEX.length] };
}

function updateProLook(type, hexValue) {
  if (!ACTIVE_MODAL_PLAYER) return;
  const key = String(ACTIVE_MODAL_PLAYER).toLowerCase().trim();
  const map = getAppearanceMap();
  map[key] = { ...getPlayerAppearance(ACTIVE_MODAL_PLAYER), [type]: hexValue };
  localStorage.setItem('proClubsAppearanceV3', JSON.stringify(map));
  renderMembers(GLOBAL_MEMBERS);
  buildDynamicPitchTactic(GLOBAL_MEMBERS, GLOBAL_MATCHES);
  openFutModal(ACTIVE_MODAL_PLAYER);
}

function getFlagUrl(nationId) { return `https://flagcdn.com/w40/${EA_NATION_TO_ISO[String(nationId || '')] || 'ie'}.png`; }

function getPlayerAvatarUrl(playerName) {
  const look = getPlayerAppearance(playerName);
  return `https://api.dicebear.com/9.x/adventurer/svg?seed=${encodeURIComponent(String(playerName || 'Pro').trim())}&skinColor=${look.skin}&hairColor=${look.hair}`;
}

function getCardTierTheme(ovr) {
  const r = Number(ovr || 75);
  if (r < 76) return { tier: 'BRONZE', badgeClass: 'bg-amber-900/40 text-amber-300 border-amber-600/50', textColor: '#271406', baseStops: ['#f7d4b6','#e29e6b','#c67a43','#9c5525','#5e2d0d'], plateStops: ['#f2c29b','#c87d48','#85461b'], rimStops: ['#ffffff','#f5cba7','#7c3f19','#f7d4b6'], beamMid: '#fae5d3', beamDark: '#7c3f19' };
  if (r < 85) return { tier: 'SILVER', badgeClass: 'bg-slate-700/50 text-slate-200 border-slate-400/50', textColor: '#1e293b', baseStops: ['#ffffff','#e2e8f0','#cbd5e1','#94a3b8','#475569'], plateStops: ['#f1f5f9','#cbd5e1','#64748b'], rimStops: ['#ffffff','#e2e8f0','#475569','#f8fafc'], beamMid: '#ffffff', beamDark: '#475569' };
  return { tier: 'GOLD', badgeClass: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/50', textColor: '#2b2108', baseStops: ['#fef08a','#facc15','#eab308','#ca8a04','#854d0e'], plateStops: ['#fde047','#eab308','#a16207'], rimStops: ['#ffffff','#fde047','#a16207','#fef08a'], beamMid: '#fef9c3', beamDark: '#ca8a04' };
}

function renderPlaystyleDiamondHtml(ps, isPlus = false) {
  const art = OFFICIAL_EA_PLAYSTYLE_VECTORS[ps.slug] || OFFICIAL_EA_PLAYSTYLE_VECTORS.technical;
  const gId = `psG_${ps.slug}_${isPlus?1:0}`;
  const stops = isPlus ? `<stop offset="0%" stop-color="#fde68a"/><stop offset="45%" stop-color="#f5c43c"/><stop offset="100%" stop-color="#c48b11"/>` : `<stop offset="0%" stop-color="#ffffff"/><stop offset="50%" stop-color="#e2e8f0"/><stop offset="100%" stop-color="#94a3b8"/>`;
  return `
    <div class="group ${isPlus ? 'ps-plus-badge' : 'ps-silver-badge'} cursor-pointer">
      <svg viewBox="0 0 100 92" class="w-full h-full text-[#1c1608]">
        <defs><linearGradient id="${gId}" x1="0%" y1="0%" x2="100%" y2="100%">${stops}</linearGradient></defs>
        <polygon points="22,6 78,6 96,34 50,88 4,34" fill="url(#${gId})" stroke="#1c1608" stroke-width="4.5" stroke-linejoin="round"/>
        <polygon points="25,13 75,13 88,34 50,79 12,34" fill="none" stroke="#1c1608" stroke-width="2" stroke-linejoin="round" opacity="0.8"/>
        <g transform="translate(0,-2)">${art}</g>
      </svg>
      <div class="pointer-events-none absolute left-12 top-1/2 -translate-y-1/2 hidden group-hover:flex flex-col bg-gray-950/95 text-white border border-yellow-400/60 px-2.5 py-1.5 rounded-lg shadow-2xl w-44 z-50">
        <span class="text-[10px] font-black ${isPlus?'text-yellow-400':'text-slate-200'} uppercase">${ps.name}${isPlus?'+':''}</span>
        <span class="text-[9px] text-gray-300 leading-tight mt-0.5">${ps.desc}</span>
      </div>
    </div>`;
}

function computeArchetypeAndPlaystyles(player) {
  const name = String(player.name || player.proName || 'Pro'), pos = player._normalizedPos || 'MID', rawPos = String(player._rawPos || '').toUpperCase();
  const games = Math.max(1, Number(player.gamesPlayed || 1)), gpg = Number(player.goals || 0) / games, apg = Number(player.assists || 0) / games, tpg = Number(player.tacklesmade || player.tackles || 0) / games;
  const tackleWinPct = Number(player.tacklesuccessrate || 25), passPct = Number(player.passSuccessRate || 75), rating = parseFloat(player.ratingAve || 7.2), height = parseInt(player.proHeight || 180, 10);

  let seed = 0; for (let i = 0; i < name.length; i++) seed = (seed * 31 + name.charCodeAt(i)) % 1000;
  const jit = (idx) => ((seed + idx * 17) % 11) * 0.8;

  let archetype = pos === 'FWD' ? (height >= 188 ? 'Target' : gpg >= 0.65 ? 'Finisher' : apg >= 0.42 ? 'Creator' : height <= 175 ? 'Spark' : 'Hawk')
    : pos === 'MID' ? (tpg >= 1.45 ? 'Destroyer' : passPct >= 83 && apg >= 0.35 ? 'Maestro' : gpg >= 0.38 ? 'Shadow Striker' : passPct >= 80 ? 'Architect' : 'Engine')
    : pos === 'DEF' ? (rawPos.includes('B') && !rawPos.includes('CB') ? 'Marauder' : height >= 188 ? 'Titan' : 'Guardian') : 'Sweeper Keeper';

  if (pos === 'GK') return { archetype, psPlus: { slug: 'footwork', name: 'Footwork', desc: 'Boosted close-range foot saves.' }, activePlaystyles: [{ slug: 'far_reach', name: 'Far Reach', desc: 'Extended reach on outside-box shots.' }, { slug: 'cross_claimer', name: 'Cross Claimer', desc: 'Intercepts high crosses cleanly.' }] };

  const pool = [
    { slug: 'finesse_shot', name: 'Finesse Shot', desc: 'Faster finesse shots with maximum curve.', score: (pos==='FWD'?40:18) + gpg*45 + jit(1) },
    { slug: 'power_shot', name: 'Power Shot', desc: 'Faster power shots with velocity boost.', score: gpg*38 + (height>=182?10:0) + jit(2) },
    { slug: 'chip_shot', name: 'Chip Shot', desc: 'Accurate chip shots over rushing keepers.', score: gpg*32 + (rating>=7.6?14:0) + jit(3) },
    { slug: 'dead_ball', name: 'Dead Ball', desc: 'Set pieces delivered with extra curve and speed.', score: apg*30 + gpg*20 + jit(4) },
    { slug: 'incisive_pass', name: 'Incisive Pass', desc: 'Through passes are far more accurate.', score: (pos==='MID'?32:15) + apg*55 + passPct*0.3 + jit(5) },
    { slug: 'tiki_taka', name: 'Tiki Taka', desc: 'Crisp first-time ground passes with high accuracy.', score: (passPct>=80?42:10) + passPct*0.45 + jit(6) },
    { slug: 'pinged_pass', name: 'Pinged Pass', desc: 'Driven ground passes travel faster.', score: (pos==='MID'?28:12) + passPct*0.4 + apg*25 + jit(7) },
    { slug: 'whipped_pass', name: 'Whipped Pass', desc: 'Accurate driven crosses with high curve.', score: ((rawPos.includes('W')||rawPos.includes('M')||rawPos.includes('B'))?28:5) + apg*38 + jit(8) },
    { slug: 'long_ball_pass', name: 'Long Ball Pass', desc: 'Lofted through passes are harder to intercept.', score: (pos!=='FWD'?26:6) + passPct*0.35 + jit(9) },
    { slug: 'technical', name: 'Technical', desc: 'Higher Controlled Sprint speed and tight turns.', score: rating*5.5 + (gpg+apg)*20 + jit(10) },
    { slug: 'rapid', name: 'Rapid', desc: 'Higher sprint speed while dribbling.', score: (pos==='FWD'?34:16) + (height<=180?15:4) + gpg*28 + jit(11) },
    { slug: 'quick_step', name: 'Quick Step', desc: 'Faster Explosive Sprint acceleration.', score: (height<=178?32:14) + (gpg+apg)*22 + jit(12) },
    { slug: 'first_touch', name: 'First Touch', desc: 'Reduced error when trapping under pressure.', score: passPct*0.38 + gpg*22 + jit(13) },
    { slug: 'trickster', name: 'Trickster', desc: 'Unique flicks and faster strafe dribbling.', score: (pos==='FWD'?25:12) + (name===TOP_FIDGET_SPINNER_NAME?35:0) + jit(14) },
    { slug: 'press_proven', name: 'Press Proven', desc: 'Shields ball effectively from pressers.', score: (pos==='MID'?30:15) + passPct*0.35 + tpg*10 + jit(15) },
    { slug: 'trivela', name: 'Trivela', desc: 'Outside-of-the-foot passes and shots.', score: apg*32 + gpg*26 + jit(16) },
    { slug: 'anticipate', name: 'Anticipate', desc: 'Standing tackles stop ball directly at feet.', score: (pos==='DEF'?45:10) + tpg*24 + tackleWinPct*0.4 + jit(17) },
    { slug: 'intercept', name: 'Intercept', desc: 'Increased reach and ball retention on interceptions.', score: (pos!=='FWD'?32:5) + tpg*26 + jit(18) },
    { slug: 'jockey', name: 'Jockey', desc: 'Increased max speed of Sprint Jockey.', score: (pos==='DEF'?38:12) + tackleWinPct*0.45 + jit(19) },
    { slug: 'block', name: 'Block', desc: 'Increased reach when performing blocks.', score: (pos==='DEF'?40:6) + tpg*18 + jit(20) },
    { slug: 'bruiser', name: 'Bruiser', desc: 'Greater physical strength in tackles.', score: (height>=184?28:8) + tpg*22 + jit(22) },
    { slug: 'aerial_fortress', name: 'Aerial Fortress', desc: 'Higher jumps and aerial dominance.', score: (height>=187?52:4) + gpg*15 + jit(23) },
    { slug: 'relentless', name: 'Relentless', desc: 'Reduces fatigue loss and boosts stamina recovery.', score: (games>=25?28:14) + (tpg+apg)*14 + jit(24) }
  ].sort((a, b) => b.score - a.score);

  return { archetype, psPlus: pool[0], activePlaystyles: [pool[1], pool[2]] };
}

function renderCrestHtml(name, crestId, sizeClass = 'w-7 h-7', clubId = '') {
  const platform = document.getElementById('platformSelect')?.value || 'common-gen5';
  const clubParam = clubId ? `&clubId=${encodeURIComponent(clubId)}&platform=${encodeURIComponent(platform)}` : '';
  return `<div class="${sizeClass} rounded-lg bg-gray-900 border border-gray-800 flex items-center justify-center p-0.5 overflow-hidden flex-shrink-0 shadow-md"><img src="${API_BASE}/crest/${crestId?String(crestId).trim():'0'}?name=${encodeURIComponent(name||'FC')}${clubParam}" class="w-full h-full object-contain" alt="${name}"></div>`;
}

function getChaosEmoji(myG, oppG, oppSR) {
  const tot = myG + oppG;
  if (Number(oppSR || 0) >= 1900) return { emoji: '🔥', label: 'SWEATFEST (1900+ SR)' };
  if (tot >= 8) return { emoji: '🏀', label: 'BASKETBALL MATCH (8+ Goals)' };
  if (myG < oppG && oppG >= 3) return { emoji: '🚨', label: 'DEFENSIVE DISASTERCLASS' };
  if (myG > oppG && tot <= 3) return { emoji: '🧱', label: 'HARAMBALL WIN (Gritty Defense)' };
  if (myG >= 4 && myG > oppG) return { emoji: '💥', label: 'GOAL CARNIVAL (4+ Scored)' };
  if (myG === oppG) return { emoji: '🤝', label: 'POINTS SHARED' };
  return { emoji: '⚽', label: 'COMPETITIVE FIXTURE' };
}

function setStatus(msg, isErr = false) {
  const b = document.getElementById('statusBanner');
  if (!msg) { b.classList.add('hidden'); return; }
  b.classList.remove('hidden'); b.innerText = msg;
  b.className = isErr ? 'text-xs sm:text-sm px-4 py-3 rounded bg-red-950/80 border border-red-800 text-red-200' : 'text-xs sm:text-sm px-4 py-3 rounded bg-gray-800 border border-gray-700 text-gray-300';
}

function normalizePosition(rawPos) {
  const p = String(rawPos || '').toLowerCase().trim();
  if (['forward','striker','st','cf','lw','rw','lf','rf','ls','rs'].includes(p)) return 'FWD';
  if (['defender','defence','cb','lb','rb','lwb','rwb','lcb','rcb'].includes(p)) return 'DEF';
  if (['goalkeeper','gk'].includes(p)) return 'GK';
  return 'MID';
}

async function handleSearch() {
  const input = document.getElementById('searchInput').value.trim();
  const platform = document.getElementById('platformSelect').value;
  document.getElementById('matchesCard').classList.add('hidden');
  if (!input) return setStatus('Please enter a club name or numeric ID.', true);
  if (/^\d+$/.test(input)) return loadClub(input, platform);

  setStatus(`Searching EA for "${input}"...`);
  try {
    const res = await fetch(`${API_BASE}/search?clubName=${encodeURIComponent(input)}&platform=${platform}`);
    const data = await res.json();
    if (!res.ok || !Array.isArray(data) || !data.length) return setStatus(`No clubs found matching "${input}".`, true);
    if (data.length === 1) return loadClub(data[0].id, platform);

    setStatus(`Found ${data.length} matching clubs. Select yours:`);
    const list = document.getElementById('matchesList');
    list.innerHTML = data.map(c => `<div onclick="document.getElementById('matchesCard').classList.add('hidden');loadClub('${c.id}','${platform}')" class="p-3 rounded bg-gray-800/80 hover:bg-gray-800 border border-gray-700 cursor-pointer flex justify-between items-center transition"><div><div class="font-bold text-white">${c.name}</div><div class="text-xs text-gray-400">ID: ${c.id}</div></div><button class="text-xs bg-emerald-500 text-black font-semibold px-2.5 py-1 rounded">Select</button></div>`).join('');
    document.getElementById('matchesCard').classList.remove('hidden');
  } catch (e) { setStatus(`Search failed: ${e.message}`, true); }
}

function switchRecapMode(mode) {
  CURRENT_RECAP_MODE = mode;
  document.getElementById('btnRecapSession').className = mode === 'session' ? 'px-2.5 py-1 rounded text-xs font-black bg-amber-400 text-black transition shadow' : 'px-2.5 py-1 rounded text-xs font-bold text-gray-300 hover:text-white transition';
  document.getElementById('btnRecapLast10').className = mode === 'last10' ? 'px-2.5 py-1 rounded text-xs font-black bg-amber-400 text-black transition shadow' : 'px-2.5 py-1 rounded text-xs font-bold text-gray-300 hover:text-white transition';
  updateRecapMetricsDisplay(GLOBAL_CLUB_ID, mode === 'session' ? SESSION_MATCHES_CACHE : GLOBAL_MATCHES.slice(0, 10), mode);
}

function updateRecapMetricsDisplay(clubId, fixtures = [], mode = 'session') {
  const sec = document.getElementById('sessionRecapSection');
  if (!fixtures.length) return sec.classList.add('hidden');
  sec.classList.remove('hidden');

  let sW = 0, sD = 0, sL = 0, sGF = 0, sGA = 0;
  const pMap = {};
  fixtures.forEach(m => {
    const clubs = m.clubs || m.aggregate || {}, cIds = Object.keys(clubs);
    const myId = cIds.find(id => String(id) === String(clubId)) || cIds[0], oppId = cIds.find(id => String(id) !== String(clubId)) || cIds[1];
    const mG = Number(clubs[myId]?.goals ?? clubs[myId]?.score ?? 0), oG = Number(clubs[oppId]?.goals ?? clubs[oppId]?.score ?? 0);
    sGF += mG; sGA += oG;
    if (mG > oG) sW++; else if (mG < oG) sL++; else sD++;
    Object.values(m.players?.[myId] || {}).forEach(p => {
      const n = p.playername || p.name || 'Pro';
      if (!pMap[n]) pMap[n] = { name: n, games: 0, goals: 0, assists: 0, ratingSum: 0 };
      pMap[n].games++; pMap[n].goals += Number(p.goals || 0); pMap[n].assists += Number(p.assists || 0); pMap[n].ratingSum += parseFloat(p.rating || 7.0);
    });
  });

  const gd = sGF - sGA, pfx = mode === 'session' ? 'Session' : 'Last 10';
  document.getElementById('recapRecordTitle').innerText = `${pfx} Record`;
  document.getElementById('recapMvpTitle').innerText = `👑 ${pfx} MVP`;
  document.getElementById('recapLiabilityTitle').innerText = `⚓ ${pfx} Passenger`;
  document.getElementById('sessionTimeWindow').innerText = mode === 'session' ? `${fixtures.length} Match Stint` : `Last ${fixtures.length} Matches`;
  document.getElementById('sessionRecordText').innerText = `${sW}W - ${sD}D - ${sL}L`;
  document.getElementById('sessionGoalDiffText').innerText = `${sGF} GF / ${sGA} GA (${gd>=0?`+${gd}`:gd} GD)`;

  const tb = document.getElementById('sessionTiltBadge');
  if (sL > sW && sL >= 2) { tb.className = 'px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-500/20 text-rose-400 border border-rose-500/40'; tb.innerText = '🚨 HIGH TILT'; }
  else if (sW > sL) { tb.className = 'px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'; tb.innerText = '🔥 VIBES IMMACULATE'; }
  else { tb.className = 'px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/40'; tb.innerText = '⚖️ MIXED BAG'; }

  const arr = Object.values(pMap).map(sp => ({ ...sp, avgRat: sp.ratingSum / sp.games, imp: (sp.ratingSum / sp.games) * 10 + sp.goals * 4 + sp.assists * 3 })).sort((a, b) => b.imp - a.imp);
  if (arr.length) {
    const mvp = arr[0], liab = arr[arr.length - 1];
    document.getElementById('sessionMvpName').innerText = mvp.name;
    document.getElementById('sessionMvpStats').innerText = `${mvp.avgRat.toFixed(1)} AVG • ${mvp.goals}G ${mvp.assists}A`;
    document.getElementById('sessionMvpAvatar').src = getPlayerAvatarUrl(mvp.name);
    document.getElementById('sessionLiabilityName').innerText = liab.name;
    document.getElementById('sessionLiabilityStats').innerText = `${liab.avgRat.toFixed(1)} AVG • ${liab.goals}G ${liab.assists}A`;
    document.getElementById('sessionLiabilityAvatar').src = getPlayerAvatarUrl(liab.name);
  }
}

function renderClubReviewReport(clubData = {}, members = [], matches = [], shameList = []) {
  const sec = document.getElementById('clubReviewSection');
  if (!members.length) return sec.classList.add('hidden');
  sec.classList.remove('hidden');

  const st = clubData.overall || {}, w = Number(st.wins ?? st.overallWins ?? 0), d = Number(st.ties ?? st.overallTies ?? 0), l = Number(st.losses ?? st.overallLosses ?? 0);
  const tot = Math.max(1, w + d + l), winPct = Math.round((w / tot) * 100), gpg = (Number(st.goals ?? 0) / tot).toFixed(2), gapg = (Number(st.goalsAgainst ?? 0) / tot).toFixed(2);
  let rW = 0, rL = 0, rGF = 0, rGA = 0;
  matches.slice(0, 10).forEach(m => {
    const c = m.clubs || m.aggregate || {}, ids = Object.keys(c);
    const myId = ids.find(id => String(id) === String(GLOBAL_CLUB_ID)) || ids[0], oppId = ids.find(id => String(id) !== String(GLOBAL_CLUB_ID)) || ids[1];
    const mG = Number(c[myId]?.goals ?? 0), oG = Number(c[oppId]?.goals ?? 0);
    rGF += mG; rGA += oG; if (mG > oG) rW++; else if (mG < oG) rL++;
  });

  const avgPass = Math.round(members.reduce((a, b) => a + Number(b.passSuccessRate || 75), 0) / members.length);
  const missedP = shameList.reduce((a, b) => a + (b.missedPasses || 0), 0), missedS = shameList.reduce((a, b) => a + Math.max(0, (b.shots || 0) - (b.goals || 0)), 0);

  const hb = document.getElementById('clubReviewGradeBadge');
  hb.className = winPct >= 52 && rW >= rL ? 'px-3 py-1 rounded-full text-[11px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'px-3 py-1 rounded-full text-[11px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/40';
  hb.innerText = winPct >= 52 && rW >= rL ? 'CLUB STATUS: PROMOTION CONTENDERS (A)' : 'CLUB STATUS: COMPETITIVE BATTLERS (B+)';

  const topScorer = [...members].sort((a, b) => Number(b.goals || 0) - Number(a.goals || 0))[0];
  const pillars = [
    { title: '📊 Current Status', icon: 'fa-signal text-sky-400', border: 'border-sky-500/30', items: [`Competing in <b>${clubData.division||'Div 2'}</b> (${st.skillRating||1500} SR • ${clubData.globalRank?.label||'Top 10%'}).`, `All-time win rate: <b>${winPct}%</b> (${w}W-${d}D-${l}L), averaging <b>${gpg} GF/g</b>.`, `Last 10 momentum: <b>${rW}W-${10-rW-rL}D-${rL}L</b> (${rGF} GF / ${rGA} GA).`] },
    { title: '💪 Key Strengths', icon: 'fa-dumbbell text-emerald-400', border: 'border-emerald-500/30', items: [Number(gpg)>=2.0?`<b>Attacking Threat:</b> Averaging ${gpg} goals/game.`:`<b> balanced Scoring:</b> Shared goal contributions.`, `<b>Ball Retention:</b> ${avgPass}% squad pass accuracy.`, topScorer?`<b>Focal Point:</b> ${topScorer.name||topScorer.proName} leads with ${topScorer.goals} goals.`:''] },
    { title: '⚠️ Weaknesses', icon: 'fa-triangle-exclamation text-rose-400', border: 'border-rose-500/30', items: [Number(gapg)>=2.0?`<b>Defensive Leakage:</b> Conceding ${gapg} goals/game.`:`<b>Tight Margins:</b> Narrow 1-goal defeats.`, `<b>Turnovers:</b> ${missedP} missed passes in the last 10 games.`, `<b>Finishing:</b> ${missedS} unconverted shots in recent fixtures.`] },
    { title: '🎯 Areas to Address', icon: 'fa-bullseye text-amber-400', border: 'border-amber-500/30', items: [`<b>Anchor the Midfield:</b> Keep one CDM behind the ball during wide attacks.`, `<b>Cut Out Hospital Passes:</b> Play short triangles before forcing through-balls.`, `<b>Extra Pass in Box:</b> Look for high-percentage cutbacks.`] }
  ];

  document.getElementById('clubReviewGrid').innerHTML = pillars.map(p => `<div class="bg-gray-900/60 border ${p.border} rounded-xl p-3.5 space-y-2"><div class="text-xs font-black uppercase text-white flex items-center gap-2 border-b border-gray-800 pb-1.5"><i class="fa-solid ${p.icon}"></i>${p.title}</div><ul class="space-y-1.5 text-xs text-gray-300">${p.items.filter(Boolean).map(i => `<li class="flex items-start gap-1.5"><span class="text-emerald-400 font-bold">•</span><span>${i}</span></li>`).join('')}</ul></div>`).join('');
}

function computeMatchIntelligence(clubId, matchesPayload) {
  RECENT_FORM_MAP = {}; RECENT_10_STATS_MAP = {}; TOP_FIDGET_SPINNER_NAME = null;
  const ratingBuckets = {}, duoContributions = {}, opponentCounts = {}, shameMap = {}, sessionMatches = [];
  let highestSrOpp = null, smallGames = 0, smallWins = 0, largeGames = 0, largeWins = 0, prevTs = null;
  const oppBuckets = { 2: { label: 'vs. 2-Man', w:0, d:0, l:0, total:0 }, 3: { label: 'vs. 3-Man', w:0, d:0, l:0, total:0 }, 4: { label: 'vs. 4-Man', w:0, d:0, l:0, total:0 }, 5: { label: 'vs. 5+ Man', w:0, d:0, l:0, total:0 } };

  const matchArr = Array.isArray(matchesPayload) ? matchesPayload : (matchesPayload?.matches || []);

  matchArr.slice(0, 10).forEach((m, idx) => {
    const ts = Number(m.timestamp || 0);
    if (idx === 0 || (prevTs && ts > 0 && Math.abs(prevTs - ts) <= 4 * 3600)) { sessionMatches.push(m); prevTs = ts; }

    const clubs = m.clubs || m.aggregate || {}, cIds = Object.keys(clubs);
    const thisId = cIds.find(id => String(id) === String(clubId)) || cIds[0], oppId = cIds.find(id => String(id) !== String(clubId)) || cIds[1];
    const myClub = clubs[thisId] || {}, oppClub = clubs[oppId] || {};
    const oppName = oppClub.details?.name || oppClub.name || 'Opponent FC', oppSR = Number(oppClub.skillRating || oppClub.details?.skillRating || 0);
    const oppCrestId = oppClub.crestId || oppClub.TEAM || oppClub.details?.customKit?.crestAssetId || oppClub.details?.crestAssetId || oppClub.details?.teamId;
    const myG = Number(myClub.goals ?? myClub.score ?? 0), oppG = Number(oppClub.goals ?? oppClub.score ?? 0);
    const isWin = myG > oppG, isLoss = myG < oppG;

    if (!opponentCounts[oppName]) opponentCounts[oppName] = { clubId: oppId, name: oppName, played: 0, wins: 0, losses: 0, draws: 0, sr: oppSR, crestId: oppCrestId };
    opponentCounts[oppName].played++;
    if (isWin) opponentCounts[oppName].wins++; else if (isLoss) opponentCounts[oppName].losses++; else opponentCounts[oppName].draws++;
    if (!highestSrOpp || oppSR > highestSrOpp.sr) highestSrOpp = opponentCounts[oppName];

    const oppCnt = Object.keys(m.players?.[oppId] || {}).length;
    if (oppCnt > 0) {
      const bk = oppCnt <= 2 ? 2 : oppCnt === 3 ? 3 : oppCnt === 4 ? 4 : 5;
      oppBuckets[bk].total++; if (isWin) oppBuckets[bk].w++; else if (isLoss) oppBuckets[bk].l++; else oppBuckets[bk].d++;
    }

    const lobbyPlayers = Object.values(m.players?.[thisId] || {});
    if (lobbyPlayers.length > 0 && lobbyPlayers.length <= 3) { smallGames++; if (isWin) smallWins++; }
    else if (lobbyPlayers.length >= 4) { largeGames++; if (isWin) largeWins++; }

    const activeContributors = [];
    const maxSecs = lobbyPlayers.reduce((mx, lp) => Math.max(mx, Number(lp.secondsPlayed || 0)), 0);

    lobbyPlayers.forEach(p => {
      const pName = p.playername || p.name || 'Pro', r = parseFloat(p.rating || 0), g = Number(p.goals || 0), a = Number(p.assists || 0);
      const t = Number(p.tacklesmade || p.tackles || 0), tAtt = Number(p.tackleattempts || Math.max(t, t * 2)), shots = Number(p.shots || 0);
      const pMade = Number(p.passesmade || 0), pAtt = Number(p.passattempts || pMade), missedP = Math.max(0, pAtt - pMade), reds = Number(p.redcards || 0);
      const secs = Number(p.secondsPlayed || maxSecs || 5400);
      const isSub = maxSecs > 600 && secs > 0 && secs <= maxSecs * 0.78 && reds === 0;
      const ev = parsePlayerMatchEvents(p);

      if (idx < 5 && r > 0) { if (!ratingBuckets[pName]) ratingBuckets[pName] = []; ratingBuckets[pName].push(r); }
      if (!RECENT_10_STATS_MAP[pName]) RECENT_10_STATS_MAP[pName] = { games:0, goals:0, assists:0, shots:0, tackles:0, totalRating:0, skillMoves:0, superSubGA:0, subGames:0, recentCleanSheets:0 };
      const r10 = RECENT_10_STATS_MAP[pName];
      r10.games++; r10.goals += g; r10.assists += a; r10.shots += shots; r10.tackles += t; r10.totalRating += r; r10.skillMoves += ev.skillMoves;
      if (isSub) r10.subGames++; if (isSub && (g + a > 0)) r10.superSubGA += (g + a); if (oppG === 0) r10.recentCleanSheets++;

      if (!shameMap[pName]) shameMap[pName] = { name: pName, games:0, missedPasses:0, skillMoves:0, dribblesCompleted:0, shots:0, goals:0, reds:0, tackles:0, tackleAtt:0, superSubGA:0, subGames:0, cleanSheets:0 };
      const sm = shameMap[pName];
      sm.games++; sm.missedPasses += missedP; sm.skillMoves += ev.skillMoves; sm.dribblesCompleted += ev.dribblesCompleted; sm.shots += shots; sm.goals += g; sm.reds += reds; sm.tackles += t; sm.tackleAtt += tAtt;
      if (isSub) sm.subGames++; if (isSub && (g + a > 0)) sm.superSubGA += (g + a); if (oppG === 0) sm.cleanSheets++;

      if (g + a > 0) activeContributors.push({ name: pName, ga: g + a });
    });

    for (let i = 0; i < activeContributors.length; i++) {
      for (let j = i + 1; j < activeContributors.length; j++) {
        const pair = [activeContributors[i].name, activeContributors[j].name].sort(), k = pair.join('|||');
        if (!duoContributions[k]) duoContributions[k] = { p1: pair[0], p2: pair[1], combinedGA: 0, gamesTogether: 0 };
        duoContributions[k].combinedGA += activeContributors[i].ga + activeContributors[j].ga; duoContributions[k].gamesTogether++;
      }
    }
  });

  Object.keys(ratingBuckets).forEach(n => RECENT_FORM_MAP[n] = ratingBuckets[n].reduce((a, b) => a + b, 0) / ratingBuckets[n].length);
  SESSION_MATCHES_CACHE = sessionMatches;

  const shameArr = Object.values(shameMap);
  const topSkiller = [...shameArr].sort((a, b) => b.skillMoves - a.skillMoves)[0];
  if (topSkiller && topSkiller.skillMoves > 0) TOP_FIDGET_SPINNER_NAME = topSkiller.name;

  updateRecapMetricsDisplay(clubId, CURRENT_RECAP_MODE === 'session' ? sessionMatches : matchArr.slice(0, 10), CURRENT_RECAP_MODE);

  const sPct = smallGames > 0 ? Math.round((smallWins / smallGames) * 100) : null, lPct = largeGames > 0 ? Math.round((largeWins / largeGames) * 100) : null;
  document.getElementById('squadFactorSmall').innerText = sPct !== null ? `2–3 Pros: ${sPct}% Win (${smallWins}/${smallGames})` : '2–3 Pros: No GP';
  document.getElementById('squadFactorLarge').innerText = lPct !== null ? `4+ Pros: ${lPct}% Win (${largeWins}/${largeGames})` : '4+ Pros: No GP';
  document.getElementById('squadFactorVerdict').innerText = (sPct !== null && lPct !== null) ? (sPct > lPct ? 'Small squad synergy!' : 'Full squad dominance!') : 'Balanced chemistry';

  document.getElementById('vsOpponentSizeGrid').innerHTML = [2, 3, 4, 5].map(k => {
    const b = oppBuckets[k], wp = b.total > 0 ? Math.round((b.w / b.total) * 100) : null;
    return `<div class="bg-gray-900/60 border border-gray-800 rounded-lg p-2.5 space-y-1"><div class="flex items-center justify-between"><span class="text-[10px] font-black uppercase text-gray-300">${b.label}</span><span class="text-xs font-black ${wp!==null&&wp>=50?'text-emerald-400':'text-gray-300'}">${wp!==null?`${wp}% Win`:'0 GP'}</span></div><div class="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden"><div class="h-full ${wp!==null&&wp>=50?'bg-emerald-500':'bg-rose-500'} rounded-full" style="width:${wp!==null?Math.max(8,wp):0}%"></div></div><div class="text-[10px] font-mono text-gray-400">Record: <b class="text-white">${b.w}W-${b.d}D-${b.l}L</b></div></div>`;
  }).join('');

  renderShameBoard(shameArr);

  const intelSec = document.getElementById('intelSection');
  if (matchArr.length) {
    intelSec.classList.remove('hidden');
    const topDuo = Object.values(duoContributions).sort((a, b) => b.combinedGA - a.combinedGA)[0];
    if (topDuo) {
      document.getElementById('duoNames').innerText = `${topDuo.p1} & ${topDuo.p2}`;
      document.getElementById('duoMeta').innerText = `${topDuo.combinedGA} combined G+A across ${topDuo.gamesTogether} shared goalscoring games`;
      document.getElementById('duoAvatars').innerHTML = `<img src="${getPlayerAvatarUrl(topDuo.p1)}" class="w-10 h-10 rounded-full border-2 border-emerald-400 bg-gray-900"><img src="${getPlayerAvatarUrl(topDuo.p2)}" class="w-10 h-10 rounded-full border-2 border-emerald-400 bg-gray-900">`;
    }
    const repeat = Object.values(opponentCounts).filter(o => o.played > 1).sort((a, b) => b.played - a.played);
    const tOpp = repeat[0] || highestSrOpp;
    if (tOpp) {
      document.getElementById('nemesisTitle').innerHTML = repeat.length ? `<i class="fa-solid fa-fire text-amber-400"></i> Repeat Rival (${tOpp.played}x)` : `<i class="fa-solid fa-skull text-rose-400"></i> Toughest Recent Opponent`;
      document.getElementById('nemesisName').innerText = tOpp.name;
      document.getElementById('nemesisMeta').innerText = `Record: ${tOpp.wins}W-${tOpp.draws}D-${tOpp.losses}L • SR: ${tOpp.sr||'--'}`;
      document.getElementById('nemesisCrest').innerHTML = renderCrestHtml(tOpp.name, tOpp.crestId, 'w-11 h-11', tOpp.clubId);
    }
  }
  return shameArr;
}

function renderShameBoard(shameList = []) {
  const sec = document.getElementById('shameBoardSection');
  if (!shameList.length) return sec.classList.add('hidden');
  sec.classList.remove('hidden');

  shameList.forEach(i => i.careerCS = Number(GLOBAL_MEMBERS.find(m => (m.name || m.proName) === i.name)?.totalCleanSheets || 0));
  const bySub = [...shameList].sort((a, b) => (b.superSubGA * 10 + b.subGames) - (a.superSubGA * 10 + a.subGames))[0];
  const byPad = [...shameList].sort((a, b) => (b.careerCS + b.cleanSheets * 3 + b.tackles * 0.1) - (a.careerCS + a.cleanSheets * 3 + a.tackles * 0.1))[0];
  const bySkill = [...shameList].sort((a, b) => b.skillMoves - a.skillMoves)[0];
  const byPass = [...shameList].sort((a, b) => b.missedPasses - a.missedPasses)[0];
  const byBarn = [...shameList].sort((a, b) => (b.shots - b.goals) - (a.shots - a.goals))[0];
  const byRed = [...shameList].sort((a, b) => (b.reds * 15 + (b.tackleAtt - b.tackles)) - (a.reds * 15 + (a.tackleAtt - a.tackles)))[0];

  const cards = [
    { title: '🦸‍♂️ The Super-Sub Award', w: bySub.name, st: bySub.superSubGA > 0 ? `${bySub.superSubGA} G+A off Bench` : `${bySub.subGames} Sub Apps`, sub: 'Mid-match joiner impact', b: 'border-emerald-500/40', c: 'text-emerald-400' },
    { title: '🔒 The Padlock (Clean Sheets)', w: byPad.name, st: `${Math.max(byPad.careerCS, byPad.cleanSheets)} Clean Sheets`, sub: `${byPad.cleanSheets} shutouts in last 10`, b: 'border-sky-500/40', c: 'text-sky-400' },
    { title: '🌀 Fidget Spinner', w: bySkill.name, st: `${bySkill.skillMoves} Skill Moves`, sub: `${bySkill.dribblesCompleted} dribbles completed`, b: 'border-fuchsia-500/40', c: 'text-fuchsia-400' },
    { title: '🏥 Hospital Pass Award', w: byPass.name, st: `${byPass.missedPasses} Missed Passes`, sub: `Across ${byPass.games} recent apps`, b: 'border-amber-500/40', c: 'text-amber-400' },
    { title: '🚪 The Barn Door Award', w: byBarn.name, st: `${byBarn.shots} Shots (${byBarn.goals}G)`, sub: `${byBarn.shots>0?Math.round((byBarn.goals/byBarn.shots)*100):0}% shot conversion`, b: 'border-rose-500/40', c: 'text-rose-400' },
    { title: '🟥 Sunday League Butcher', w: byRed.name, st: byRed.reds > 0 ? `${byRed.reds} Red Cards` : `${byRed.tackles} Tackles Won`, sub: 'Midfield enforcer', b: 'border-red-500/40', c: 'text-red-400' }
  ];

  document.getElementById('shameBoardGrid').innerHTML = cards.map(c => `<div class="bg-gray-900/60 border ${c.b} rounded-xl p-3.5 flex items-center justify-between"><div class="min-w-0 pr-2"><div class="text-[10px] font-black uppercase text-gray-400 truncate">${c.title}</div><div class="text-sm font-extrabold text-white mt-0.5 truncate">${c.w}</div><div class="text-xs font-bold ${c.c} mt-0.5">${c.st}</div><div class="text-[10px] text-gray-500 mt-0.5 truncate">${c.sub}</div></div><img src="${getPlayerAvatarUrl(c.w)}" class="w-11 h-11 rounded-full border border-gray-700 bg-gray-900 flex-shrink-0"></div>`).join('');
}

function renderCareerMilestones(members = []) {
  const sec = document.getElementById('milestonesSection');
  if (!members.length) return sec.classList.add('hidden');
  sec.classList.remove('hidden');

  const nextT = (v, steps = [25, 50, 75, 100, 150, 200, 250, 300, 500]) => steps.find(t => v < t) || Math.ceil((v + 1) / 100) * 100;
  const items = [];
  members.forEach(m => {
    const n = m.name || m.proName || 'Pro', gp = Number(m.gamesPlayed ?? 0), g = Number(m.goals ?? 0), a = Number(m.assists ?? 0), mo = Number(m.manOfTheMatch ?? 0);
    [[g, 'Club Goals', 'fa-futbol text-emerald-400', 'bg-emerald-500'], [a, 'Club Assists', 'fa-shoe-prints text-sky-400', 'bg-sky-500'], [gp, 'Appearances', 'fa-shirt text-amber-400', 'bg-amber-500'], [mo, 'MoTM Awards', 'fa-crown text-purple-400', 'bg-purple-500']].forEach(([val, cat, ic, bg]) => {
      const t = nextT(val); if (val > 0) items.push({ name: n, cat, ic, bg, cur: val, target: t, rem: t - val, pct: Math.round((val / t) * 100) });
    });
  });

  document.getElementById('milestonesGrid').innerHTML = items.sort((a, b) => b.pct - a.pct).slice(0, 4).map(i => `<div class="bg-gray-900/60 border border-gray-800 rounded-xl p-3.5 space-y-2"><div class="flex items-center justify-between"><div class="flex items-center gap-2 min-w-0"><img src="${getPlayerAvatarUrl(i.name)}" class="w-8 h-8 rounded-full border border-gray-700 bg-gray-900"><div class="min-w-0"><div class="text-xs font-extrabold text-white truncate">${i.name}</div><div class="text-[10px] font-bold text-gray-400"><i class="fa-solid ${i.ic} mr-1"></i>${i.cat}</div></div></div><span class="text-xs font-black text-white font-mono">${i.cur}/${i.target}</span></div><div class="w-full h-2 bg-gray-800 rounded-full overflow-hidden"><div class="h-full ${i.bg} rounded-full" style="width:${Math.min(100,i.pct)}%"></div></div><div class="text-[10px] text-gray-400">Only <b class="text-white">${i.rem}</b> away from <b class="text-emerald-400">${i.target}</b>!</div></div>`).join('');
}

function renderSeasonsHistory(seasonsHistory = [], trophies = {}) {
  const sec = document.getElementById('seasonsSection');
  if (!seasonsHistory.length) return sec.classList.add('hidden');
  sec.classList.remove('hidden');
  document.getElementById('seasonsSummaryMeta').innerText = `${seasonsHistory.length} FC 27 Seasons • ${trophies.promotions||0} Promos • ${trophies.relegations||0} Relegs`;

  document.getElementById('seasonsHistoryTable').innerHTML = seasonsHistory.map(s => {
    const tot = Math.max(1, s.wins + s.draws + s.losses), wp = Math.round((s.wins / tot) * 100), gd = s.goalsFor - s.goalsAgainst;
    const badge = s.badgeType === 'title' ? `<span class="px-2 py-0.5 rounded text-xs font-black bg-yellow-500/20 text-yellow-300 border border-yellow-500/40">🏆 ${s.outcome}</span>`
      : s.badgeType === 'promo' ? `<span class="px-2 py-0.5 rounded text-xs font-black bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">⬆️ ${s.outcome}</span>`
      : s.badgeType === 'active' ? `<span class="px-2 py-0.5 rounded text-xs font-black bg-sky-500/15 text-sky-300 border border-sky-500/30">▶️ ${s.outcome}</span>`
      : `<span class="px-2 py-0.5 rounded text-xs font-bold bg-gray-800 text-gray-300 border border-gray-700">${s.outcome}</span>`;
    return `<tr class="${s.isCurrent?'bg-emerald-950/15 font-semibold':'hover:bg-gray-800/40'} border-b border-gray-800/60"><td class="py-2.5 px-2 font-bold text-white">${s.label}</td><td class="py-2.5 px-2 text-center">${renderDivisionShieldHtml(s.divisionNum??s.division,'sm')}</td><td class="py-2.5 px-2 text-center font-mono text-white">${s.wins}-${s.draws}-${s.losses}</td><td class="py-2.5 px-2 text-center text-gray-300">${wp}%</td><td class="py-2.5 px-2 text-center text-gray-300">${s.goalsFor}/${s.goalsAgainst} (${gd>=0?`+${gd}`:gd})</td><td class="py-2.5 px-2 text-center font-black text-emerald-400">${s.points} pts</td><td class="py-2.5 px-2 text-right">${badge}</td></tr>`;
  }).join('');
}

async function loadClub(clubId, platform) {
  setStatus(`Loading club stats for ID #${clubId}...`);
  try {
    const [infoRes, memRes, matchesRes] = await Promise.all([
      fetch(`${API_BASE}/club/${clubId}/info?platform=${platform}`),
      fetch(`${API_BASE}/club/${clubId}/members?platform=${platform}`),
      fetch(`${API_BASE}/club/${clubId}/matches?platform=${platform}`)
    ]);
    const combined = await infoRes.json(), memData = await memRes.json(), matchesPayload = await matchesRes.json();
    if (!infoRes.ok) return setStatus(`Failed: ${combined.error || 'Club not found'}`, true);

    GLOBAL_CLUB_ID = clubId; GLOBAL_COMBINED_DATA = combined;
    GLOBAL_MEMBERS = Array.isArray(memData) ? memData : (memData?.members || Object.values(memData || {}));
    GLOBAL_MATCHES = Array.isArray(matchesPayload) ? matchesPayload : (matchesPayload?.matches || []);

    const shameList = computeMatchIntelligence(clubId, GLOBAL_MATCHES);
    const membersList = renderMembers(GLOBAL_MEMBERS);
    renderClub(clubId, combined, platform, membersList, GLOBAL_MATCHES);
    renderClubReviewReport(combined, membersList, GLOBAL_MATCHES, shameList);
    renderSeasonsHistory(combined.seasonsHistory, combined.trophies);
    renderCareerMilestones(membersList);
    buildDynamicPitchTactic(membersList, GLOBAL_MATCHES);
    initRadarComparison(membersList);
    renderRecentMatches(clubId, GLOBAL_MATCHES);
    setStatus('');
  } catch (e) { setStatus(`Error loading stats: ${e.message}`, true); }
}

function renderClub(clubId, data, platform, membersList = [], matchesPayload = []) {
  const infoObj = data.info || {}, statObj = data.overall || {}, name = infoObj.name || infoObj.clubName || statObj.name || 'Unknown Club';
  let wins = statObj.wins ?? statObj.overallWins ?? 0, ties = statObj.ties ?? statObj.overallTies ?? 0, losses = statObj.losses ?? statObj.overallLosses ?? 0;
  let goals = statObj.goals ?? statObj.overallGoals ?? 0, conceded = statObj.goalsAgainst ?? statObj.overallGoalsAgainst ?? 0, rating = statObj.skillRating ?? statObj.rating ?? '--';

  const gDiff = Number(goals) - Number(conceded);
  const myMatchClub = matchesPayload[0]?.clubs?.[clubId];
  const crestId = data.crestId || myMatchClub?.crestId || infoObj.customKit?.crestAssetId || infoObj.teamId || '0';

  CURRENT_CLUB_CREST_URL = `${API_BASE}/crest/${crestId}?name=${encodeURIComponent(name)}&clubId=${encodeURIComponent(clubId)}&platform=${encodeURIComponent(platform)}`;
  document.getElementById('heroCrestBox').innerHTML = `<img src="${CURRENT_CLUB_CREST_URL}" class="w-full h-full object-contain p-1 drop-shadow" alt="${name}">`;
  document.getElementById('clubName').innerText = name;

  const divShield = document.getElementById('clubDivShieldContainer');
  if (data.division) { divShield.innerHTML = renderDivisionShieldHtml(data.divisionNum ?? data.division, 'lg'); divShield.classList.remove('hidden'); }

  document.getElementById('clubIdentityBar').classList.remove('hidden');
  const reg = data.regionInfo || { name: 'British Isles', flag: 'ie' };
  document.getElementById('clubRegionFlag').src = `https://flagcdn.com/w40/${reg.flag}.png`;
  document.getElementById('clubRegionName').innerText = reg.name;
  document.getElementById('clubStadiumName').innerText = data.stadiumName || 'Pro Clubs Arena';

  const kits = data.kits || { home: ['#10b981','#ffffff','#064e3b'], away: ['#1e293b','#38bdf8','#0f172a'], third: ['#f59e0b','#111827','#ffffff'] };
  document.getElementById('clubKitsContainer').innerHTML = `${renderMiniJerseySvg(kits.home,'Home')}<span class="text-gray-700">|</span>${renderMiniJerseySvg(kits.away,'Away')}<span class="text-gray-700">|</span>${renderMiniJerseySvg(kits.third,'3rd')}`;

  if (data.globalRank) {
    const rb = document.getElementById('globalRankBadge');
    rb.innerText = `🌍 ${data.globalRank.label}`; rb.classList.remove('hidden');
  }

  if (data.trophies) {
    document.getElementById('trophyBar').classList.remove('hidden');
    document.getElementById('trophyTitles').innerText = data.trophies.titlesWon ?? 0;
    document.getElementById('trophyLeagues').innerText = data.trophies.leaguesWon ?? 0;
    document.getElementById('trophyPromos').innerText = data.trophies.promotions ?? 0;
    document.getElementById('trophyRelegs').innerText = data.trophies.relegations ?? 0;
    const pk = data.trophies.bestDivision || data.division || 'Div 2';
    document.getElementById('trophyPeakDivText').innerText = pk;
    document.getElementById('trophyPeakDivShield').innerHTML = renderDivisionShieldHtml(data.trophies.bestDivisionNum ?? pk, 'md');
  }

  document.getElementById('clubMeta').innerText = `Club ID: ${clubId} | ${platform.includes('gen5')?'PC / PS5 / XBOX SERIES X|S':platform.toUpperCase()}`;
  document.getElementById('clubRecord').innerText = `${wins} - ${ties} - ${losses}`;
  document.getElementById('skillRating').innerText = rating;
  document.getElementById('goalStats').innerHTML = `${goals}/${conceded} <span class="text-xs text-gray-400 font-normal">(${gDiff>=0?`+${gDiff}`:gDiff})</span>`;
}

function renderMembers(data) {
  const tbody = document.getElementById('membersTable');
  let list = Array.isArray(data) ? data : [];
  if (!list.length) { tbody.innerHTML = '<tr><td colspan="11" class="py-6 text-center text-gray-500">No member records returned.</td></tr>'; return []; }

  tbody.innerHTML = list.map(m => {
    const name = m.name || m.proName || 'Unknown', ovr = Number(m.proOverall || 85), tierInfo = getCardTierTheme(ovr);
    const normPos = normalizePosition(m.favoritePosition || m.pos || 'MID'), games = Number(m.gamesPlayed ?? 0), goals = Number(m.goals ?? 0), assists = Number(m.assists ?? 0);
    const careerRat = parseFloat(m.ratingAve || m.rating || 0), pass = m.passSuccessRate ?? 0, motm = m.manOfTheMatch ?? 0;
    const tackles = m.tacklesmade ?? m.tackles ?? 0, tWin = m.tacklesuccessrate ?? 0, gaPg = games > 0 ? ((goals + assists) / games).toFixed(2) : '0.00';

    const r10 = RECENT_10_STATS_MAP[name];
    const r10Conv = r10 && r10.shots > 0 ? Math.round((r10.goals / r10.shots) * 100) : null;
    const shotConv = Number(m.shotConvRate || 0) > 0 ? Number(m.shotConvRate) : (r10Conv ?? '--');
    const totalCS = Math.max(Number(m.totalCleanSheets || 0), Number(r10?.recentCleanSheets || 0));
    const csBadge = totalCS > 0 ? `<span class="ml-1 px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-300 text-[10px] font-bold">${totalCS} CS</span>` : '';

    const otherG = Number(m.otherClubGames ?? 0);
    const loyaltyBadge = otherG === 0
      ? `<span class="px-1.5 py-0.5 rounded text-[9px] font-black bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">🛡️ One-Club</span>`
      : `<span class="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/10 text-amber-300 border border-amber-500/30">💼 ${otherG}g Elsewhere</span>`;

    const recentAvg = RECENT_FORM_MAP[name];
    const formArr = (recentAvg !== undefined && careerRat > 0) ? (recentAvg - careerRat >= 0.15 ? '<span class="text-emerald-400 font-black ml-1">▲</span>' : recentAvg - careerRat <= -0.15 ? '<span class="text-rose-400 font-black ml-1">▼</span>' : '<span class="text-gray-500 ml-1">•</span>') : '';

    m._normalizedPos = normPos; m._rawPos = m.favoritePosition || m.pos || 'MID';
    const funTag = getPlayerFunTag(m);
    const bCol = normPos === 'FWD' ? 'text-rose-400 bg-rose-500/10' : normPos === 'MID' ? 'text-amber-400 bg-amber-500/10' : normPos === 'DEF' ? 'text-blue-400 bg-blue-500/10' : 'text-purple-400 bg-purple-500/10';
    const safeName = name.replace(/'/g, "\\'");

    return `<tr onclick="openFutModal('${safeName}')" class="hover:bg-gray-800/50 transition border-b border-gray-800/60 cursor-pointer"><td class="py-2.5 px-2 font-medium text-white"><div class="flex items-center gap-1.5"><img src="${getPlayerAvatarUrl(name)}" class="w-7 h-7 sm:w-8 sm:h-8 rounded-full border border-emerald-500/40 bg-gray-900 flex-shrink-0"><img src="${getFlagUrl(m.proNationality||'25')}" class="w-4 h-3 object-cover rounded-[2px] flex-shrink-0"><span class="hover:text-yellow-400 font-bold">${name}</span><span class="px-1.5 py-0.5 rounded-full text-[9px] sm:text-[10px] font-extrabold border ${funTag.cls}">${funTag.label}</span>${loyaltyBadge}</div></td><td class="py-2.5 px-2 text-center"><span class="px-2 py-0.5 rounded border font-black text-xs ${tierInfo.badgeClass}">${ovr}</span></td><td class="py-2.5 px-2 text-center"><span class="px-2 py-0.5 rounded text-xs font-semibold ${bCol}">${normPos}</span></td><td class="py-2.5 px-2 text-center text-gray-300">${games}</td><td class="py-2.5 px-2 text-center font-bold text-emerald-400">${goals} ${shotConv!=='--'?`<span class="text-[10px] text-gray-400 font-mono">(${shotConv}%)</span>`:''}</td><td class="py-2.5 px-2 text-center text-gray-300">${assists}</td><td class="py-2.5 px-2 text-center text-emerald-300 font-mono">${gaPg}</td><td class="py-2.5 px-2 text-center text-sky-400 font-medium">${tackles} <span class="text-xs text-gray-400">(${tWin}%)</span>${csBadge}</td><td class="py-2.5 px-2 text-center text-yellow-400 font-semibold">${careerRat.toFixed(1)}${formArr}</td><td class="py-2.5 px-2 text-center text-gray-300">${pass}%</td><td class="py-2.5 px-2 text-center text-purple-400">${motm}</td></tr>`;
  }).join('');
  return list;
}

function getPlayerRadarMetrics(p) {
  const ovr = Number(p.proOverall || 85), games = Math.max(1, Number(p.gamesPlayed || 1)), g = Number(p.goals || 0), a = Number(p.assists || 0), t = Number(p.tacklesmade || p.tackles || 0), passPct = Number(p.passSuccessRate || 78), rat = parseFloat(p.ratingAve || 7.2), motm = Number(p.manOfTheMatch || 0);
  const pac = Math.min(99, Math.max(60, Math.round(ovr + 3))), sho = Math.min(99, Math.max(55, Math.round(ovr - 4 + (g / games) * 14))), pas = Math.min(99, Math.max(58, Math.round(passPct + 6))), dri = Math.min(99, Math.max(62, Math.round(ovr + (rat - 7.0) * 5))), def = Math.min(99, Math.max(28, Math.round((p._normalizedPos === 'DEF' ? 82 : 42) + (t / games) * 15))), phy = Math.min(99, Math.max(58, Math.round(ovr - 3 + (t / games) * 6)));
  const gpg = g / games, apg = a / games, tpg = t / games, mPct = Math.round((motm / games) * 100);
  return {
    attributes: [{ label:'PAC', val:pac, raw:pac }, { label:'SHO', val:sho, raw:sho }, { label:'PAS', val:pas, raw:pas }, { label:'DRI', val:dri, raw:dri }, { label:'DEF', val:def, raw:def }, { label:'PHY', val:phy, raw:phy }],
    stats: [{ label:'G/G', val:Math.min(100,Math.round(gpg*95)), raw:gpg.toFixed(2) }, { label:'A/G', val:Math.min(100,Math.round(apg*110)), raw:apg.toFixed(2) }, { label:'RAT', val:Math.min(100,Math.round(rat*10)), raw:rat.toFixed(1) }, { label:'PAS%', val:Math.min(100,Math.round(passPct)), raw:`${passPct}%` }, { label:'TKL/G', val:Math.min(100,Math.round(tpg*38)), raw:tpg.toFixed(1) }, { label:'MoTM%', val:Math.min(100,Math.round(mPct*2.2)), raw:`${mPct}%` }]
  };
}

function buildRadarSvg(ax1, ax2) {
  const cx = 140, cy = 140, maxR = 94;
  const pt = (i, v) => { const a = (Math.PI * 2 * i) / 6 - Math.PI / 2, r = (Math.max(8, Math.min(100, v)) / 100) * maxR; return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`; };
  const grids = [0.25, 0.5, 0.75, 1].map(l => `<polygon points="${[0,1,2,3,4,5].map(i=>pt(i,l*100)).join(' ')}" fill="none" stroke="#475569" stroke-width="1" stroke-dasharray="${l<1?'3 3':''}"/>`).join('');
  const axes = [0,1,2,3,4,5].map(i => { const e = pt(i,100).split(','), lb = pt(i,120).split(','); return `<line x1="${cx}" y1="${cy}" x2="${e[0]}" y2="${e[1]}" stroke="#475569"/><text x="${lb[0]}" y="${Number(lb[1])+4}" text-anchor="middle" fill="#94a3b8" font-size="11" font-weight="800">${ax1[i].label}</text>`; }).join('');
  return `<svg viewBox="0 0 280 280" class="w-full h-full overflow-visible">${grids}${axes}<polygon points="${ax2.map((a,i)=>pt(i,a.val)).join(' ')}" fill="rgba(56,189,248,0.22)" stroke="#38bdf8" stroke-width="2.5"/><polygon points="${ax1.map((a,i)=>pt(i,a.val)).join(' ')}" fill="rgba(16,185,129,0.28)" stroke="#10b981" stroke-width="2.5"/></svg>`;
}

function initRadarComparison(members = []) {
  const sec = document.getElementById('radarSection');
  if (!members.length) return sec.classList.add('hidden');
  sec.classList.remove('hidden');
  const sorted = [...members].sort((a, b) => Number(b.gamesPlayed || 0) - Number(a.gamesPlayed || 0));
  const opts = sorted.map(m => `<option value="${m.name||m.proName}" class="bg-gray-900 text-white">${m.name||m.proName} (${m.proOverall||85} OVR)</option>`).join('');
  const s1 = document.getElementById('radarSelectP1'), s2 = document.getElementById('radarSelectP2');
  s1.innerHTML = opts; s2.innerHTML = opts;
  if (sorted.length >= 2) s2.selectedIndex = 1;
  updateRadarCharts();
}

function updateRadarCharts() {
  const p1 = GLOBAL_MEMBERS.find(m => (m.name||m.proName) === document.getElementById('radarSelectP1').value) || GLOBAL_MEMBERS[0];
  const p2 = GLOBAL_MEMBERS.find(m => (m.name||m.proName) === document.getElementById('radarSelectP2').value) || GLOBAL_MEMBERS[0];
  if (!p1 || !p2) return;
  const m1 = getPlayerRadarMetrics(p1), m2 = getPlayerRadarMetrics(p2);
  document.getElementById('radarChartAttributes').innerHTML = buildRadarSvg(m1.attributes, m2.attributes);
  document.getElementById('radarChartStats').innerHTML = buildRadarSvg(m1.stats, m2.stats);
  document.getElementById('radarLegendAttr').innerHTML = m1.attributes.map((a, i) => `<div class="flex flex-col items-center"><span class="text-[9px] text-gray-400 font-bold">${a.label}</span><div><span class="text-emerald-400 font-bold">${a.raw}</span>/<span class="text-sky-400 font-bold">${m2.attributes[i].raw}</span></div></div>`).join('');
  document.getElementById('radarLegendStats').innerHTML = m1.stats.map((s, i) => `<div class="flex flex-col items-center"><span class="text-[9px] text-gray-400 font-bold">${s.label}</span><div><span class="text-emerald-400 font-bold">${s.raw}</span>/<span class="text-sky-400 font-bold">${m2.stats[i].raw}</span></div></div>`).join('');
}

function openFutModal(playerName) {
  const p = GLOBAL_MEMBERS.find(m => (m.name || m.proName || m.gamertag) === playerName);
  if (!p) return;
  ACTIVE_MODAL_PLAYER = playerName;
  const name = p.name || p.proName || 'Player', ovr = Number(p.proOverall || 85), pos = p._rawPos && p._rawPos.length <= 4 ? p._rawPos.toUpperCase() : p._normalizedPos;
  const metrics = getPlayerRadarMetrics(p), buildInfo = computeArchetypeAndPlaystyles(p), theme = getCardTierTheme(ovr);

  ['1','2','3','4','5'].forEach((n, i) => document.getElementById(`stopBase${n}`).setAttribute('stop-color', theme.baseStops[i]));
  ['1','2','3'].forEach((n, i) => document.getElementById(`stopPlate${n}`).setAttribute('stop-color', theme.plateStops[i]));
  ['1','2','3','4'].forEach((n, i) => document.getElementById(`stopRim${n}`).setAttribute('stop-color', theme.rimStops[i]));
  document.getElementById('futTopLeftText').style.color = theme.textColor;
  document.getElementById('futLowerTextContainer').style.color = theme.textColor;

  document.getElementById('futArchetypeBadge').innerHTML = `<i class="fa-solid fa-crown text-[8px]"></i> ${buildInfo.archetype}`;
  document.getElementById('futLeftPlaystylesStack').innerHTML = [renderPlaystyleDiamondHtml(buildInfo.psPlus, true), ...buildInfo.activePlaystyles.map(ps => renderPlaystyleDiamondHtml(ps, false))].join('');
  document.getElementById('futOvr').innerText = ovr; document.getElementById('futPos').innerText = pos;
  document.getElementById('futAvatar').src = getPlayerAvatarUrl(name); document.getElementById('futName').innerText = name;
  ['Pac','Sho','Pas','Dri','Def','Phy'].forEach((k, i) => document.getElementById(`fut${k}`).innerText = metrics.attributes[i].raw);
  document.getElementById('futFlag').src = getFlagUrl(p.proNationality || '25');
  document.getElementById('futClubCrest').src = CURRENT_CLUB_CREST_URL || `${API_BASE}/crest/0?name=FC`;

  const modal = document.getElementById('futModal');
  modal.classList.remove('hidden'); modal.classList.add('flex');
}

function closeFutModal() { const m = document.getElementById('futModal'); m.classList.add('hidden'); m.classList.remove('flex'); }

function renderRecentMatches(clubId, matches) {
  const tbody = document.getElementById('recentMatchesTable'), formContainer = document.getElementById('formBadges');
  const matchArr = Array.isArray(matches) ? matches : (matches?.matches || []);
  if (!matchArr.length) { tbody.innerHTML = '<tr><td colspan="9" class="py-6 text-center text-gray-500">No recent matches found.</td></tr>'; return; }

  const formList = [];
  tbody.innerHTML = matchArr.slice(0, 10).map((m, idx) => {
    const clubs = m.clubs || m.aggregate || {}, cIds = Object.keys(clubs);
    const thisId = cIds.find(id => String(id) === String(clubId)) || cIds[0], oppId = cIds.find(id => String(id) !== String(clubId)) || cIds[1];
    const myClub = clubs[thisId] || {}, oppClub = clubs[oppId] || {};
    const myG = Number(myClub.goals ?? myClub.score ?? 0), oppG = Number(oppClub.goals ?? oppClub.score ?? 0), oppName = oppClub.details?.name || oppClub.name || 'Opponent FC';
    const oppDivShield = renderDivisionShieldHtml(oppClub.division || 'Div 2', 'sm');
    const oppSR = oppClub.skillRating || oppClub.details?.skillRating || null;
    const oppSRCell = oppSR ? `<span class="inline-block font-mono font-bold text-xs text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">${oppSR}</span>` : '--';
    const oppCrestHtml = renderCrestHtml(oppName, oppClub.crestId || oppClub.TEAM || oppClub.details?.crestAssetId, 'w-6 h-6 sm:w-7 sm:h-7', oppId);
    const oppCnt = Object.keys(m.players?.[oppId] || {}).length;
    const playerStats = Object.values(m.players?.[thisId] || {});

    const maxSecs = playerStats.reduce((mx, p) => Math.max(mx, Number(p.secondsPlayed || 0)), 0);
    const isRageQuit = (myG > oppG) && ((maxSecs > 0 && maxSecs < 4100) || (myG - oppG >= 4 && maxSecs < 4800) || Number(oppClub.winnerByDnf || myClub.winnerByDnf || 0) === 1);
    const rqBadge = isRageQuit ? `<span class="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[9px] font-black">💨 RAGE QUIT</span>` : '';

    const chaos = getChaosEmoji(myG, oppG, oppSR);
    let resLbl = 'DRAW', resCls = 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20', fBadge = '<span class="w-5 h-5 rounded-full bg-yellow-500/20 border border-yellow-500/40 text-yellow-400 text-[10px] font-black flex items-center justify-center">D</span>';
    if (myG > oppG) { resLbl = 'WIN'; resCls = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'; fBadge = '<span class="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-[10px] font-black flex items-center justify-center">W</span>'; }
    else if (myG < oppG) { resLbl = 'LOSS'; resCls = 'bg-rose-500/10 text-rose-400 border-rose-500/20'; fBadge = '<span class="w-5 h-5 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-400 text-[10px] font-black flex items-center justify-center">L</span>'; }
    if (formList.length < 5) formList.push(fBadge);

    const ts = Number(m.timestamp || 0), dHours = ts > 0 ? Math.round((Date.now() - ts * 1000) / 3600000) : -1;
    const dateText = (dHours >= 0 && dHours < 24) ? `${Math.max(1, dHours)}h ago` : (ts > 0 ? new Date(ts * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'Recent');

    const mg = computeMatchGradeAndUnitRatings(myG, oppG, playerStats);
    let bestMvp = null, hiScore = -Infinity;
    playerStats.forEach(p => {
      const made = Number(p.passesmade || 0), att = Number(p.passattempts || 0);
      p._passPct = att > 0 ? Math.round((made / att) * 100) : Number(p.passsuccessrate || 0);
      p._made = made; p._att = att; p._ev = parsePlayerMatchEvents(p);
      p._inf = parseFloat(p.rating || 0) * 12 + Number(p.goals || 0) * 5 + Number(p.assists || 0) * 4 + Number(p.tacklesmade || 0) * 2 + p._passPct * 0.05;
      if (p._inf > hiScore) { hiScore = p._inf; bestMvp = p.playername || p.name; }
    });

    playerStats.sort((a, b) => b._inf - a._inf);
    let crownGiven = false;
    const rowsHtml = playerStats.map(p => {
      const pName = p.playername || p.name || 'Pro', goals = Number(p.goals || 0), assists = Number(p.assists || 0), shots = Number(p.shots || 0);
      const sConv = shots > 0 ? `${Math.round((goals / shots) * 100)}%` : '--';
      const secs = Number(p.secondsPlayed || maxSecs || 5400), subbed = maxSecs > 600 && secs > 0 && secs <= maxSecs * 0.78 && Number(p.redcards || 0) === 0;
      const subBadge = (subbed && (goals + assists > 0)) ? `<span class="ml-1 px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-400/50 text-[9px] font-black">🦸‍♂️ SUPER-SUB</span>` : (subbed ? `<span class="ml-1 text-[9px] text-gray-400">🔄 Sub</span>` : '');
      let mvpBadge = '--';
      if (!crownGiven && pName === bestMvp && hiScore > 0) { mvpBadge = `<span class="px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-400 border border-yellow-500/40 text-[10px] font-black">👑 MVP</span>`; crownGiven = true; }
      return `<tr class="border-b border-gray-800/60"><td class="py-2 px-2 font-semibold text-white"><div class="flex items-center gap-1.5"><img src="${getPlayerAvatarUrl(pName)}" class="w-5 h-5 rounded-full bg-gray-900"><span>${pName}</span>${subBadge}</div></td><td class="py-2 px-2 text-center font-black text-yellow-400">${parseFloat(p.rating||0).toFixed(1)}</td><td class="py-2 px-2 text-center font-bold text-emerald-400">${goals}</td><td class="py-2 px-2 text-center font-bold text-sky-400">${assists}</td><td class="py-2 px-2 text-center font-mono">${shots} <span class="text-[10px] text-emerald-400">(${sConv})</span></td><td class="py-2 px-2 text-center font-mono text-cyan-400">${p._att>0?`${p._made}/${p._att} (${p._passPct}%)`:`${p._passPct}%`}</td><td class="py-2 px-2 text-center font-mono text-amber-400">${Math.max(0,p._att-p._made)}</td><td class="py-2 px-2 text-center font-mono text-fuchsia-400">${p._ev.skillMoves}</td><td class="py-2 px-2 text-center text-sky-400">${p.tacklesmade||0}</td><td class="py-2 px-2 text-right">${mvpBadge}</td></tr>`;
    }).join('');

    return `
      <tr onclick="document.getElementById('boxScore_${idx}').classList.toggle('hidden')" class="hover:bg-gray-800/40 transition border-b border-gray-800/60 cursor-pointer">
        <td class="py-2.5 px-2"><span class="px-2 py-0.5 rounded text-[11px] font-semibold bg-gray-800 text-gray-300 border border-gray-700">${m._inferredCategory||'League'}</span></td>
        <td class="py-2.5 px-2 font-medium text-white"><div class="flex items-center gap-1.5">${oppCrestHtml}<span>${oppName}</span>${oppCnt>0?`<span class="text-[10px] text-gray-400 font-mono">(${oppCnt}p)</span>`:''}${rqBadge}<i class="fa-solid fa-chevron-down text-[9px] text-gray-500"></i></div></td>
        <td class="py-2.5 px-2 text-center" title="${chaos.label}">${chaos.emoji}</td>
        <td class="py-2.5 px-2 text-center">${oppDivShield}</td>
        <td class="py-2.5 px-2 text-center">${oppSRCell}</td>
        <td class="py-2.5 px-2 text-center font-bold text-white">${myG} - ${oppG}</td>
        <td class="py-2.5 px-2 text-center"><div class="inline-flex items-center gap-1.5"><span class="w-6 h-5 rounded flex items-center justify-center text-[11px] font-black border ${mg.gradeCls}">${mg.grade}</span><span class="text-[10px] font-mono text-emerald-400">A:${mg.atk}</span><span class="text-[10px] font-mono text-sky-400">D:${mg.def}</span></div></td>
        <td class="py-2.5 px-2 text-center"><span class="px-2 py-0.5 rounded text-[11px] font-bold border ${resCls}">${resLbl}</span></td>
        <td class="py-2.5 px-2 text-right text-gray-400 text-xs">${dateText}</td>
      </tr>
      <tr id="boxScore_${idx}" class="hidden bg-gray-900/60 border-b border-gray-800"><td colspan="9" class="p-3"><div class="overflow-x-auto touch-scroll rounded border border-gray-800 bg-gray-950/80"><table class="w-full text-left text-xs whitespace-nowrap"><thead class="bg-gray-900 text-gray-400 uppercase text-[10px]"><tr><th class="py-1.5 px-2">Player</th><th class="py-1.5 px-2 text-center">Rat</th><th class="py-1.5 px-2 text-center">G</th><th class="py-1.5 px-2 text-center">A</th><th class="py-1.5 px-2 text-center">Shots (Conv%)</th><th class="py-1.5 px-2 text-center">Passes</th><th class="py-1.5 px-2 text-center">Missed</th><th class="py-1.5 px-2 text-center">Skills</th><th class="py-1.5 px-2 text-center">Tkl</th><th class="py-1.5 px-2 text-right">Award</th></tr></thead><tbody>${rowsHtml}</tbody></table></div></td></tr>`;
  }).join('');
  formContainer.innerHTML = formList.join('');
}

function switchPitchMode(mode) {
  CURRENT_PITCH_MODE = mode;
  document.getElementById('btnModeLastMatch').className = mode === 'lastMatch' ? 'flex-1 sm:flex-initial px-3 py-1.5 rounded-md text-xs font-bold bg-emerald-500 text-black transition shadow' : 'flex-1 sm:flex-initial px-3 py-1.5 rounded-md text-xs font-bold text-gray-300 hover:text-white transition';
  document.getElementById('btnModeSuggested').className = mode === 'suggestedXI' ? 'flex-1 sm:flex-initial px-3 py-1.5 rounded-md text-xs font-bold bg-emerald-500 text-black transition shadow' : 'flex-1 sm:flex-initial px-3 py-1.5 rounded-md text-xs font-bold text-gray-300 hover:text-white transition';
  buildDynamicPitchTactic(GLOBAL_MEMBERS, GLOBAL_MATCHES);
}

function buildDynamicPitchTactic(members = [], matches = []) {
  const rows = ['rowAttack','rowCAM','rowMidfield','rowDefense','rowGK'].map(id => { const el = document.getElementById(id); el.innerHTML = ''; return el; });
  if (!members.length) return;

  const latestMatch = matches[0] || null;
  let latestPlayersMap = {}, latestOpp = 'Opponent';
  if (latestMatch) {
    const clubs = latestMatch.clubs || latestMatch.aggregate || {}, cIds = Object.keys(clubs);
    const myId = cIds.find(id => String(id) === String(GLOBAL_CLUB_ID)) || cIds[0], oppId = cIds.find(id => String(id) !== String(GLOBAL_CLUB_ID)) || cIds[1];
    latestPlayersMap = latestMatch.players?.[myId] || {};
    latestOpp = clubs[oppId]?.details?.name || clubs[oppId]?.name || 'Opponent';
  }

  const fwdCnt = members.filter(m => m._normalizedPos === 'FWD').length;
  const tpl = fwdCnt >= 3 ? { name: '4-3-3 Attack', atk: ['LW','ST','RW'], cam: ['CAM'], mid: ['LCM','RCM'], def: ['LB','LCB','RCB','RB'], gk: ['GK'] }
    : fwdCnt === 2 ? { name: '4-1-2-1-2 Narrow', atk: ['LS','RS'], cam: ['CAM'], mid: ['LCM','CDM','RCM'], def: ['LB','LCB','RCB','RB'], gk: ['GK'] }
    : { name: '4-2-3-1 Narrow', atk: ['ST'], cam: ['LAM','CAM','RAM'], mid: ['LCDM','RCDM'], def: ['LB','LCB','RCB','RB'], gk: ['GK'] };

  document.getElementById('formationBadge').innerText = tpl.name;
  document.getElementById('formationSubtitle').innerText = CURRENT_PITCH_MODE === 'lastMatch' ? `Active Lineup vs ${latestOpp}` : `Suggested Best XI based on Pro OVR, Archetype & Build Attributes`;

  const scored = members.map(m => {
    const name = m.name || m.proName || 'Player', ovr = Number(m.proOverall || 85), rat = parseFloat(m.ratingAve || 7.0);
    const buildInfo = computeArchetypeAndPlaystyles(m);
    const lm = Object.values(latestPlayersMap).find(lp => (lp.playername || lp.name) === name);
    return { ...m, _displayName: name, _buildScore: ovr * 4 + rat * 12, _archetype: buildInfo.archetype, _lmScore: lm ? 1000 + parseFloat(lm.rating || 0) * 20 : -1, _lmRat: lm ? parseFloat(lm.rating || 0) : null, _lmGA: lm ? Number(lm.goals || 0) + Number(lm.assists || 0) : 0 };
  });

  const pool = CURRENT_PITCH_MODE === 'lastMatch' ? scored.filter(m => m._lmScore > 0).sort((a, b) => b._lmScore - a._lmScore) : [...scored].sort((a, b) => b._buildScore - a._buildScore);
  const used = new Set(), assigned = [];

  const claim = (pos, fallback = true) => {
    let i = pool.findIndex(p => !used.has(p._displayName) && p._normalizedPos === pos);
    if (i === -1 && fallback && pos !== 'GK') i = pool.findIndex(p => !used.has(p._displayName));
    if (i !== -1) { used.add(pool[i]._displayName); return pool[i]; }
    return null;
  };

  // Responsive Pitch Node (Compact on 360px Mobile so 4 Defenders Never Overlap!)
  const nodeHtml = (p, slot) => {
    if (!p) return `<div class="flex flex-col items-center opacity-35 select-none w-16 sm:w-24"><div class="w-9 h-9 sm:w-11 sm:h-11 rounded-full border-2 border-dashed border-gray-400 bg-gray-950/70 flex items-center justify-center text-[9px] text-gray-300 font-black">AI</div><span class="text-[9px] font-bold text-gray-300 mt-1">CPU</span><span class="text-[8px] text-gray-400 uppercase font-extrabold">${slot}</span></div>`;
    assigned.push(p);
    const name = p._displayName, ovr = Number(p.proOverall || 85), tier = getCardTierTheme(ovr);
    const rat = (CURRENT_PITCH_MODE === 'lastMatch' && p._lmRat !== null ? p._lmRat : parseFloat(p.ratingAve || 7.0)).toFixed(1);
    const pill = CURRENT_PITCH_MODE === 'lastMatch' && p._lmRat !== null ? `${p._lmGA} G+A` : p._archetype;
    return `<div onclick="openFutModal('${name.replace(/'/g,"\\'")}')" class="flex flex-col items-center hover:scale-105 transition cursor-pointer group w-[74px] sm:w-24"><div class="relative"><img src="${getPlayerAvatarUrl(name)}" class="w-10 h-10 sm:w-[52px] sm:h-[52px] rounded-full border-2 border-emerald-400 bg-gray-900 object-cover shadow-xl"><span class="absolute -top-1 -left-1.5 bg-gray-950 ${tier.badgeClass} border font-black text-[8px] sm:text-[9px] px-1 rounded">${ovr}</span><span class="absolute -bottom-1 -right-1 bg-yellow-500 text-black font-black text-[8px] sm:text-[9px] px-1 rounded-sm">${rat}</span></div><span class="text-[10px] sm:text-xs font-extrabold text-white mt-1 drop-shadow max-w-[70px] sm:max-w-[96px] truncate">${name}</span><div class="flex items-center gap-0.5 mt-0.5"><span class="text-[8px] sm:text-[9px] bg-black/60 text-emerald-300 px-1 rounded uppercase font-black">${slot}</span><span class="hidden sm:inline text-[9px] bg-black/60 text-gray-200 px-1 rounded font-semibold truncate max-w-[60px]">${pill}</span></div></div>`;
  };

  tpl.atk.forEach(s => rows[0].innerHTML += nodeHtml(claim('FWD', true), s));
  tpl.cam.forEach(s => rows[1].innerHTML += nodeHtml(claim('MID', true), s));
  tpl.mid.forEach(s => rows[2].innerHTML += nodeHtml(claim('MID', true), s));
  tpl.def.forEach(s => rows[3].innerHTML += nodeHtml(claim('DEF', true), s));
  rows[4].innerHTML = nodeHtml(claim('GK', false), 'GK');

  const hCnt = assigned.length;
  document.getElementById('pitchMetricHumans').innerText = `${hCnt} / 11 Pros`;
  document.getElementById('pitchMetricOvr').innerText = hCnt ? `${Math.round(assigned.reduce((a,b)=>a+Number(b.proOverall||85),0)/hCnt)} OVR` : '--';
  document.getElementById('pitchMetricRating').innerText = hCnt ? (assigned.reduce((a,b)=>a+parseFloat(b.ratingAve||7.0),0)/hCnt).toFixed(2) : '--';
  document.getElementById('pitchMetricZone').innerText = 'Midfield Engine';
}

window.onload = () => {
  applyStoredTheme();
  document.getElementById('skinSwatches').innerHTML = SKIN_HEX.map(h => `<button onclick="updateProLook('skin','${h}')" class="w-5 h-5 rounded-full border border-white/40 hover:scale-110 transition" style="background:#${h}"></button>`).join('');
  document.getElementById('hairSwatches').innerHTML = HAIR_HEX.map(h => `<button onclick="updateProLook('hair','${h}')" class="w-5 h-5 rounded-full border border-white/40 hover:scale-110 transition" style="background:#${h}"></button>`).join('');
  buildDynamicPitchTactic([], []);
};
