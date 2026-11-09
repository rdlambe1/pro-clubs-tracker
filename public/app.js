const API_BASE = '/api';
let GLOBAL_MEMBERS = [], GLOBAL_MATCHES = [], GLOBAL_COMBINED_DATA = {}, GLOBAL_CLUB_ID = null;
let RECENT_FORM_MAP = {}, RECENT_10_STATS_MAP = {}, SESSION_MATCHES_CACHE = [], SHAME_LIST_CACHE = [];
let TOP_FIDGET_SPINNER_NAME = null, TOP_MEAT_WALL_NAME = null, CURRENT_CLUB_CREST_URL = '', ACTIVE_MODAL_PLAYER = null;
let CURRENT_PITCH_MODE = 'lastMatch', CURRENT_RECAP_MODE = 'session', CURRENT_BANTER_MODE = 'last10', ACTIVE_TAB = 'team';

const slugifyClubName = (name) => String(name || '').toLowerCase().trim().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const getFlagUrl = (id) => `https://flagcdn.com/w40/${EA_NATION_TO_ISO[String(id || '')] || 'ie'}.png`;
const getAppearanceMap = () => { try { return JSON.parse(localStorage.getItem('proClubsAppearanceV3') || '{}'); } catch (_) { return {}; } };

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

async function copyShareableClubLink() {
  const url = window.location.href, el = document.getElementById('copyLinkText');
  try {
    await navigator.clipboard.writeText(url);
    if (el) { el.innerText = 'Copied!'; setTimeout(() => { el.innerText = 'Copy Club Link'; }, 2000); }
  } catch (_) { prompt('Copy your shareable club link:', url); }
}

function switchDashboardTab(tabKey) {
  ACTIVE_TAB = tabKey;
  const borders = { team: 'border-emerald-500 bg-emerald-500/10 shadow-lg', players: 'border-sky-500 bg-sky-500/10 shadow-lg', pitch: 'border-amber-500 bg-amber-500/10 shadow-lg' };
  ['team', 'players', 'pitch'].forEach(k => {
    document.getElementById(`tabPane_${k}`).classList.toggle('hidden', k !== tabKey);
    document.getElementById(`tabBtn_${k}`).className = k === tabKey
      ? `card p-3 sm:p-4 flex items-center justify-center gap-2.5 sm:gap-3.5 border-2 ${borders[k]} transition group cursor-pointer`
      : `card p-3 sm:p-4 flex items-center justify-center gap-2.5 sm:gap-3.5 border border-gray-800 hover:border-gray-700 transition group cursor-pointer opacity-75 hover:opacity-100`;
  });
}

function openDiscordModal() {
  document.getElementById('discordModalStatus')?.classList.add('hidden');
  document.getElementById('discordWebhookInput').value = localStorage.getItem(`discordWebhook_${GLOBAL_CLUB_ID || 'default'}`) || localStorage.getItem('discordWebhook_default') || '';
  const m = document.getElementById('discordModal'); m.classList.remove('hidden'); m.classList.add('flex');
}

function closeDiscordModal() { const m = document.getElementById('discordModal'); m.classList.add('hidden'); m.classList.remove('flex'); }

async function sendRecapToDiscord() {
  const input = document.getElementById('discordWebhookInput'), status = document.getElementById('discordModalStatus'), btn = document.getElementById('btnSendDiscord');
  const webhookUrl = (input?.value || '').trim();
  if (!webhookUrl) {
    status.className = 'text-xs px-3 py-2 rounded font-semibold bg-rose-950/80 border border-rose-800 text-rose-200';
    status.innerText = '⚠️ Please paste your Discord Channel Webhook URL first.'; status.classList.remove('hidden'); return;
  }
  if (GLOBAL_CLUB_ID) localStorage.setItem(`discordWebhook_${GLOBAL_CLUB_ID}`, webhookUrl);
  localStorage.setItem('discordWebhook_default', webhookUrl);

  const banter = [];
  if (SHAME_LIST_CACHE.length) {
    const bySub = [...SHAME_LIST_CACHE].sort((a, b) => (b.superSubGA * 10 + b.subGames) - (a.superSubGA * 10 + a.subGames))[0];
    const byMeat = [...SHAME_LIST_CACHE].sort((a, b) => (b.blocks * 10 + b.tackles) - (a.blocks * 10 + a.tackles))[0];
    const bySkill = [...SHAME_LIST_CACHE].sort((a, b) => b.skillMoves - a.skillMoves)[0];
    const byPass = [...SHAME_LIST_CACHE].sort((a, b) => b.missedPasses - a.missedPasses)[0];
    const byBarn = [...SHAME_LIST_CACHE].sort((a, b) => (b.shots - b.goals) - (a.shots - a.goals))[0];
    if (bySub?.superSubGA > 0) banter.push({ title: '🦸‍♂️ Super-Sub', winner: bySub.name, stat: `${bySub.superSubGA} Bench G+A` });
    if (byMeat) banter.push({ title: '🥩 The Meat Wall', winner: byMeat.name, stat: `${byMeat.blocks} Blocks` });
    if (bySkill) banter.push({ title: '🌀 Fidget Spinner', winner: bySkill.name, stat: `${bySkill.skillMoves} Skill Moves` });
    if (byPass) banter.push({ title: '🏥 Hospital Pass', winner: byPass.name, stat: `${byPass.missedPasses} Missed Passes` });
    if (byBarn) banter.push({ title: '🚪 Barn Door', winner: byBarn.name, stat: `${byBarn.shots} Shots (${byBarn.goals}G)` });
  }

  btn.disabled = true; btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Sending...`; status.classList.add('hidden');
  try {
    const res = await fetch(`${API_BASE}/discord/send`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        webhookUrl, clubName: document.getElementById('clubName')?.innerText || 'Pro Clubs', clubId: GLOBAL_CLUB_ID,
        division: GLOBAL_COMBINED_DATA?.division || 'Div 5', skillRating: document.getElementById('skillRating')?.innerText || '--',
        modeLabel: CURRENT_RECAP_MODE === 'session' ? 'Latest Session' : 'Last 10 Matches',
        record: document.getElementById('sessionRecordText')?.innerText || '--', goalDiffText: document.getElementById('sessionGoalDiffText')?.innerText || '',
        tiltStatus: document.getElementById('sessionTiltBadge')?.innerText || '',
        mvp: { name: document.getElementById('sessionMvpName')?.innerText || '--', stats: document.getElementById('sessionMvpStats')?.innerText || '--' },
        passenger: { name: document.getElementById('sessionLiabilityName')?.innerText || '--', stats: document.getElementById('sessionLiabilityStats')?.innerText || '--' },
        banter, trackerUrl: window.location.href
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to post to Discord');
    status.className = 'text-xs px-3 py-2 rounded font-semibold bg-emerald-950/80 border border-emerald-700 text-emerald-300';
    status.innerText = '✅ Recap & MVP posted to your Discord server!'; status.classList.remove('hidden');
    setTimeout(closeDiscordModal, 1400);
  } catch (err) {
    status.className = 'text-xs px-3 py-2 rounded font-semibold bg-rose-950/80 border border-rose-800 text-rose-200';
    status.innerText = `❌ ${err.message}`; status.classList.remove('hidden');
  } finally { btn.disabled = false; btn.innerHTML = `<i class="fa-solid fa-paper-plane"></i> Send Recap Now`; }
}

function getPlayerAppearance(playerObj) {
  const key = String(typeof playerObj === 'string' ? playerObj : (playerObj?.name || playerObj?.proName || '')).toLowerCase().trim();
  const saved = getAppearanceMap()[key];
  return (!saved || (!saved.skin && !saved.hair)) ? { isCustom: false, skin: null, hair: null } : { isCustom: true, skin: saved.skin || 'f2d3b1', hair: saved.hair || '0e0e0e' };
}

function getPlayerAvatarUrl(playerName) {
  const look = getPlayerAppearance(playerName);
  return !look.isCustom ? PRO_SILHOUETTE_DATA_URI : `https://api.dicebear.com/9.x/adventurer/svg?seed=${encodeURIComponent(String(playerName || 'Pro').trim())}&skinColor=${look.skin}&hairColor=${look.hair}`;
}

function updateProLook(type, hexValue) {
  if (!ACTIVE_MODAL_PLAYER) return;
  const key = String(ACTIVE_MODAL_PLAYER).toLowerCase().trim(), map = getAppearanceMap();
  if (type === 'reset') {
    delete map[key];
    fetch(`${API_BASE}/appearances`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ playerName: ACTIVE_MODAL_PLAYER, skin: null, hair: null }) }).catch(() => {});
  } else {
    const cur = getPlayerAppearance(ACTIVE_MODAL_PLAYER);
    map[key] = { skin: type === 'skin' ? hexValue : (cur.skin || 'f2d3b1'), hair: type === 'hair' ? hexValue : (cur.hair || '0e0e0e') };
    fetch(`${API_BASE}/appearances`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ playerName: ACTIVE_MODAL_PLAYER, ...map[key] }) }).catch(() => {});
  }
  localStorage.setItem('proClubsAppearanceV3', JSON.stringify(map));
  renderMembers(GLOBAL_MEMBERS); buildDynamicPitchTactic(GLOBAL_MEMBERS, GLOBAL_MATCHES); openFutModal(ACTIVE_MODAL_PLAYER);
}

function getCardTierTheme(ovr) {
  const r = Number(ovr || 75);
  if (r < 76) return { tier: 'BRONZE', badgeClass: 'bg-amber-900/40 text-amber-300 border-amber-600/50', textColor: '#271406', baseStops: ['#f7d4b6','#e29e6b','#c67a43','#9c5525','#5e2d0d'], plateStops: ['#f2c29b','#c87d48','#85461b'], rimStops: ['#ffffff','#f5cba7','#7c3f19','#f7d4b6'] };
  if (r < 85) return { tier: 'SILVER', badgeClass: 'bg-slate-700/50 text-slate-200 border-slate-400/50', textColor: '#1e293b', baseStops: ['#ffffff','#e2e8f0','#cbd5e1','#94a3b8','#475569'], plateStops: ['#f1f5f9','#cbd5e1','#64748b'], rimStops: ['#ffffff','#e2e8f0','#475569','#f8fafc'] };
  return { tier: 'GOLD', badgeClass: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/50', textColor: '#2b2108', baseStops: ['#fef08a','#facc15','#eab308','#ca8a04','#854d0e'], plateStops: ['#fde047','#eab308','#a16207'], rimStops: ['#ffffff','#fde047','#a16207','#fef08a'] };
}

function computeMatchGradeAndUnitRatings(myG, oppG, stats = []) {
  let s = 0, pm = 0, pa = 0, t = 0;
  stats.forEach(p => { s += Number(p.shots||0); pm += Number(p.passesmade||0); pa += Number(p.passattempts||p.passesmade||0); t += Number(p.tacklesmade||p.tackles||0); });
  const atk = Math.min(9.9, Math.max(4.0, 5.6 + myG * 0.95 + (s > 0 ? myG / s : (myG > 0 ? 0.5 : 0)) * 1.6 + ((pa > 0 ? (pm / pa) * 100 : 75) - 70) * 0.04));
  const def = Math.min(9.9, Math.max(3.8, 7.4 + (oppG === 0 ? 1.4 : 0) - oppG * 0.85 + Math.min(1.5, t * 0.14)));
  const gd = myG - oppG, c = atk * 0.5 + def * 0.5 + gd * 0.35;
  const [grade, gradeCls] = (c >= 8.7 || (gd >= 3 && myG >= 4)) ? ['S', 'bg-yellow-500/20 text-yellow-300 border-yellow-400/50']
    : (c >= 8.0 || gd >= 2) ? ['A+', 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40']
    : (c >= 7.3 || gd === 1) ? ['A', 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30']
    : (c >= 6.4 || gd === 0) ? ['B', 'bg-amber-500/15 text-amber-300 border-amber-500/30']
    : (c >= 5.5 || gd === -1) ? ['C', 'bg-orange-500/15 text-orange-300 border-orange-500/30']
    : ['D', 'bg-rose-500/15 text-rose-400 border-rose-500/30'];
  return { grade, gradeCls, atk: atk.toFixed(1), def: def.toFixed(1) };
}

// Extracts Skill Moves, Dribbles, and Shot/Cross Blocks ("Meat Wall") from EA Match Event Aggregates
function parsePlayerMatchEvents(p = {}) {
  const ev = {};
  for (let i = 0; i < 4; i++) {
    String(p[`match_event_aggregate_${i}`] || '').split(',').forEach(pair => {
      const [k, v] = pair.split(':'), id = parseInt(k, 10), cnt = parseInt(v, 10);
      if (!isNaN(id) && !isNaN(cnt)) ev[id] = (ev[id] || 0) + cnt;
    });
  }
  const beats = ev[38] || 0, takeOns = ev[112] || 0, dribbles = ev[174] || 0, flair = ev[147] || 0;
  let skills = beats + flair + Math.max(0, takeOns - beats);
  if (skills === 0 && dribbles > 0) skills = Math.max(1, Math.round(dribbles * 0.35));

  // EA Defensive Block & Clearance Event IDs (12, 13, 14, 51, 56) + fallback inference from tackles/clean-sheet grit
  const rawBlocks = (ev[12] || 0) + (ev[13] || 0) + (ev[14] || 0) + (ev[51] || 0) + (ev[56] || 0);
  const tackles = Number(p.tacklesmade || p.tackles || 0);
  const posStr = String(p.pos || '').toLowerCase();
  const isDef = ['defender','cb','lb','rb','lcb','rcb','cdm'].includes(posStr);
  const blocks = rawBlocks > 0 ? rawBlocks : (isDef ? Math.max(1, Math.round(tackles * 0.65)) : Math.round(tackles * 0.4));

  return { skillMoves: skills, dribblesCompleted: dribbles, blocks };
}

async function shareElementAsPng(elementId, filenamePrefix = 'ClubsTracker') {
  const el = document.getElementById(elementId);
  if (!el || typeof html2canvas === 'undefined') return;
  try {
    const canvas = await html2canvas(el, { backgroundColor: null, useCORS: true, scale: 2 });
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      const file = new File([blob], `${filenamePrefix}.png`, { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) { try { await navigator.share({ files: [file], title: filenamePrefix }); return; } catch (_) {} }
      if (navigator.clipboard && window.ClipboardItem) { try { await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]); alert('📸 Copied to clipboard!'); return; } catch (_) {} }
      const a = document.createElement('a'); a.download = `${filenamePrefix}.png`; a.href = URL.createObjectURL(blob); a.click();
    }, 'image/png');
  } catch (e) { console.error(e); }
}

function getPlayerFunTag(p) {
  const name = p.name || p.proName || 'Unknown', g = Math.max(1, Number(p.gamesPlayed ?? p.games ?? 1));
  const gpg = Number(p.goals ?? 0) / g, apg = Number(p.assists ?? 0) / g, tpg = Number(p.tacklesmade ?? p.tackles ?? 0) / g;
  const tPct = Number(p.tacklesuccessrate ?? p.tackleSuccessRate ?? 0), pPct = Number(p.passSuccessRate ?? p.passSuccess ?? 0);
  const rat = parseFloat(p.ratingAve || p.rating || 0), motm = Number(p.manOfTheMatch ?? p.motm ?? 0) / g, r10 = RECENT_10_STATS_MAP[name];

  if (r10?.superSubGA >= 1) return { label: '🦸‍♂️ Super-Sub', cls: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/50' };
  if (name === TOP_MEAT_WALL_NAME || (r10?.games > 0 && r10.blocks / r10.games >= 1.5)) return { label: '🥩 Meat Wall', cls: 'bg-orange-500/20 text-orange-300 border-orange-400/50' };
  if (name === TOP_FIDGET_SPINNER_NAME || (r10?.games > 0 && r10.skillMoves / r10.games >= 3.5)) return { label: '🌀 Fidget Spinner', cls: 'bg-fuchsia-500/15 text-fuchsia-400 border-fuchsia-500/40' };
  if (motm >= 0.28 && g >= 5) return { label: '👑 MoTM Merchant', cls: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/40' };
  if (gpg >= 0.75) return { label: '🎯 Clinical Poacher', cls: 'bg-rose-500/15 text-rose-400 border-rose-500/40' };
  if (gpg >= 0.45 && apg <= gpg * 0.25) return { label: '🔫 Shoot on Sight', cls: 'bg-orange-500/15 text-orange-400 border-orange-500/40' };
  if (apg >= 0.5) return { label: '🎩 Chief Creator', cls: 'bg-purple-500/15 text-purple-400 border-purple-500/40' };
  if (pPct >= 84 && apg >= 0.25) return { label: '📐 Pass Master', cls: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/40' };
  if (tpg >= 1.8 && tPct >= 30) return { label: '🧱 Brick Wall', cls: 'bg-blue-500/15 text-blue-400 border-blue-500/40' };
  if (tpg >= 1.6 && tPct < 30) return { label: '🦵 Ankle Breaker', cls: 'bg-red-500/15 text-red-400 border-red-500/40' };
  if (gpg >= 0.35 && apg >= 0.35) return { label: '⚡ Double Threat', cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40' };
  if (pPct >= 82) return { label: '🧭 Metronome', cls: 'bg-teal-500/15 text-teal-400 border-teal-500/40' };
  if (p._normalizedPos === 'DEF') return { label: '🛡️ Backline Guardian', cls: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/40' };
  if (rat >= 7.6) return { label: '🔥 Big Game Player', cls: 'bg-amber-500/15 text-amber-400 border-amber-500/40' };
  return { label: '🫁 Box-to-Box Engine', cls: 'bg-slate-700/60 text-slate-300 border-slate-600' };
}

function computeArchetypeAndPlaystyles(p) {
  const name = String(p.name || p.proName || 'Pro'), pos = p._normalizedPos || 'MID', rawPos = String(p._rawPos || '').toUpperCase();
  const g = Math.max(1, Number(p.gamesPlayed || 1)), gpg = Number(p.goals || 0) / g, apg = Number(p.assists || 0) / g, tpg = Number(p.tacklesmade || p.tackles || 0) / g;
  const tWin = Number(p.tacklesuccessrate || 25), pPct = Number(p.passSuccessRate || 75), rat = parseFloat(p.ratingAve || 7.2), h = parseInt(p.proHeight || 180, 10);
  let seed = 0; for (let i = 0; i < name.length; i++) seed = (seed * 31 + name.charCodeAt(i)) % 1000;
  const jit = (idx) => ((seed + idx * 17) % 11) * 0.8;

  const archetype = pos === 'FWD' ? (h >= 188 ? 'Target' : gpg >= 0.65 ? 'Finisher' : apg >= 0.42 ? 'Creator' : h <= 175 ? 'Spark' : 'Hawk')
    : pos === 'MID' ? (tpg >= 1.45 ? 'Destroyer' : pPct >= 83 && apg >= 0.35 ? 'Maestro' : gpg >= 0.38 ? 'Shadow Striker' : pPct >= 80 ? 'Architect' : 'Engine')
    : pos === 'DEF' ? (rawPos.includes('B') && !rawPos.includes('CB') ? 'Marauder' : h >= 188 ? 'Titan' : 'Guardian') : 'Sweeper Keeper';

  if (pos === 'GK') return { archetype, psPlus: { slug: 'footwork', name: 'Footwork', desc: 'Boosted close-range foot saves.' }, activePlaystyles: [{ slug: 'far_reach', name: 'Far Reach', desc: 'Extended reach on outside-box shots.' }, { slug: 'cross_claimer', name: 'Cross Claimer', desc: 'Intercepts high crosses cleanly.' }] };

  const pool = [
    { slug: 'finesse_shot', name: 'Finesse Shot', desc: 'Faster finesse shots with maximum curve.', score: (pos==='FWD'?40:18) + gpg*45 + jit(1) },
    { slug: 'power_shot', name: 'Power Shot', desc: 'Faster power shots with velocity boost.', score: gpg*38 + (h>=182?10:0) + jit(2) },
    { slug: 'chip_shot', name: 'Chip Shot', desc: 'Accurate chip shots over rushing keepers.', score: gpg*32 + (rat>=7.6?14:0) + jit(3) },
    { slug: 'dead_ball', name: 'Dead Ball', desc: 'Set pieces delivered with extra curve and speed.', score: apg*30 + gpg*20 + jit(4) },
    { slug: 'incisive_pass', name: 'Incisive Pass', desc: 'Through passes are far more accurate.', score: (pos==='MID'?32:15) + apg*55 + pPct*0.3 + jit(5) },
    { slug: 'tiki_taka', name: 'Tiki Taka', desc: 'Crisp first-time ground passes with high accuracy.', score: (pPct>=80?42:10) + pPct*0.45 + jit(6) },
    { slug: 'pinged_pass', name: 'Pinged Pass', desc: 'Driven ground passes travel faster.', score: (pos==='MID'?28:12) + pPct*0.4 + apg*25 + jit(7) },
    { slug: 'whipped_pass', name: 'Whipped Pass', desc: 'Accurate driven crosses with high curve.', score: ((rawPos.includes('W')||rawPos.includes('M')||rawPos.includes('B'))?28:5) + apg*38 + jit(8) },
    { slug: 'long_ball_pass', name: 'Long Ball Pass', desc: 'Lofted through passes are harder to intercept.', score: (pos!=='FWD'?26:6) + pPct*0.35 + jit(9) },
    { slug: 'technical', name: 'Technical', desc: 'Higher Controlled Sprint speed and tight turns.', score: rat*5.5 + (gpg+apg)*20 + jit(10) },
    { slug: 'rapid', name: 'Rapid', desc: 'Higher sprint speed while dribbling.', score: (pos==='FWD'?34:16) + (h<=180?15:4) + gpg*28 + jit(11) },
    { slug: 'quick_step', name: 'Quick Step', desc: 'Faster Explosive Sprint acceleration.', score: (h<=178?32:14) + (gpg+apg)*22 + jit(12) },
    { slug: 'first_touch', name: 'First Touch', desc: 'Reduced error when trapping under pressure.', score: pPct*0.38 + gpg*22 + jit(13) },
    { slug: 'trickster', name: 'Trickster', desc: 'Unique flicks and faster strafe dribbling.', score: (pos==='FWD'?25:12) + (name===TOP_FIDGET_SPINNER_NAME?35:0) + jit(14) },
    { slug: 'press_proven', name: 'Press Proven', desc: 'Shields ball effectively from pressers.', score: (pos==='MID'?30:15) + pPct*0.35 + tpg*10 + jit(15) },
    { slug: 'trivela', name: 'Trivela', desc: 'Outside-of-the-foot passes and shots.', score: apg*32 + gpg*26 + jit(16) },
    { slug: 'anticipate', name: 'Anticipate', desc: 'Standing tackles stop ball directly at feet.', score: (pos==='DEF'?45:10) + tpg*24 + tWin*0.4 + jit(17) },
    { slug: 'intercept', name: 'Intercept', desc: 'Increased reach and ball retention on interceptions.', score: (pos!=='FWD'?32:5) + tpg*26 + jit(18) },
    { slug: 'jockey', name: 'Jockey', desc: 'Increased max speed of Sprint Jockey.', score: (pos==='DEF'?38:12) + tWin*0.45 + jit(19) },
    { slug: 'block', name: 'Block', desc: 'Increased reach when performing blocks.', score: (pos==='DEF'?40:6) + (name===TOP_MEAT_WALL_NAME?35:0) + tpg*18 + jit(20) },
    { slug: 'bruiser', name: 'Bruiser', desc: 'Greater physical strength in tackles.', score: (h>=184?28:8) + tpg*22 + jit(22) },
    { slug: 'aerial_fortress', name: 'Aerial Fortress', desc: 'Higher jumps and aerial dominance.', score: (h>=187?52:4) + gpg*15 + jit(23) },
    { slug: 'relentless', name: 'Relentless', desc: 'Reduces fatigue loss and boosts stamina recovery.', score: (g>=25?28:14) + (tpg+apg)*14 + jit(24) }
  ].sort((a, b) => b.score - a.score);

  return { archetype, psPlus: pool[0], activePlaystyles: [pool[1], pool[2]] };
}

function renderCrestHtml(name, crestId, sizeClass = 'w-7 h-7', clubId = '') {
  const plat = document.getElementById('platformSelect')?.value || 'common-gen5';
  const cp = clubId ? `&clubId=${encodeURIComponent(clubId)}&platform=${encodeURIComponent(plat)}` : '';
  return `<div class="${sizeClass} rounded-lg bg-gray-900 border border-gray-800 flex items-center justify-center p-0.5 overflow-hidden flex-shrink-0 shadow-md"><img src="${API_BASE}/crest/${crestId?String(crestId).trim():'0'}?name=${encodeURIComponent(name||'FC')}${cp}" class="w-full h-full object-contain" alt="${name}"></div>`;
}

function getChaosEmoji(myG, oppG, oppSR) {
  const tot = myG + oppG;
  if (Number(oppSR || 0) >= 1900) return { emoji: '🔥', label: 'SWEATFEST (1900+ SR)' };
  if (tot >= 8) return { emoji: '🏀', label: 'BASKETBALL MATCH (8+ Goals)' };
  if (myG < oppG && oppG >= 3) return { emoji: '🚨', label: 'DEFENSIVE DISASTERCLASS' };
  if (myG > oppG && tot <= 3) return { emoji: '🧱', label: 'HARAMBALL WIN (Gritty Defense)' };
  if (myG >= 4 && myG > oppG) return { emoji: '💥', label: 'GOAL CARNIVAL (4+ Scored)' };
  return myG === oppG ? { emoji: '🤝', label: 'POINTS SHARED' } : { emoji: '⚽', label: 'COMPETITIVE FIXTURE' };
}

function setStatus(msg, isErr = false) {
  const b = document.getElementById('statusBanner');
  if (!msg) return b.classList.add('hidden');
  b.classList.remove('hidden'); b.innerText = msg;
  b.className = isErr ? 'text-xs sm:text-sm px-4 py-3 rounded bg-red-950/80 border border-red-800 text-red-200' : 'text-xs sm:text-sm px-4 py-3 rounded bg-gray-800 border border-gray-700 text-gray-300';
}

function normalizePosition(rawPos) {
  const p = String(rawPos || '').toLowerCase().trim();
  if (['forward','striker','st','cf','lw','rw','lf','rf','ls','rs'].includes(p)) return 'FWD';
  if (['defender','defence','cb','lb','rb','lwb','rwb','lcb','rcb'].includes(p)) return 'DEF';
  return ['goalkeeper','gk'].includes(p) ? 'GK' : 'MID';
}

async function handleSearch(overrideQuery = null, autoSelectExactSlug = false) {
  const searchEl = document.getElementById('searchInput');
  const input = (overrideQuery !== null ? overrideQuery : searchEl.value).trim();
  if (overrideQuery !== null && searchEl) searchEl.value = input;
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
    if (autoSelectExactSlug) {
      const exact = data.find(c => slugifyClubName(c.name) === slugifyClubName(input));
      if (exact) return loadClub(exact.id, platform, false);
    }
    setStatus(`Found ${data.length} matching clubs. Select yours:`);
    document.getElementById('matchesList').innerHTML = data.map(c => `<div onclick="document.getElementById('matchesCard').classList.add('hidden');loadClub('${c.id}','${platform}')" class="p-3 rounded bg-gray-800/80 hover:bg-gray-800 border border-gray-700 cursor-pointer flex justify-between items-center transition"><div><div class="font-bold text-white">${c.name}</div><div class="text-xs text-gray-400">ID: ${c.id}</div></div><button class="text-xs bg-emerald-500 text-black font-semibold px-2.5 py-1 rounded">Select</button></div>`).join('');
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

  let sW = 0, sD = 0, sL = 0, sGF = 0, sGA = 0; const pMap = {};
  fixtures.forEach(m => {
    const clubs = m.clubs || m.aggregate || {}, cIds = Object.keys(clubs);
    const myId = cIds.find(id => String(id) === String(clubId)) || cIds[0], oppId = cIds.find(id => String(id) !== String(clubId)) || cIds[1];
    const mG = Number(clubs[myId]?.goals ?? clubs[myId]?.score ?? 0), oG = Number(clubs[oppId]?.goals ?? clubs[oppId]?.score ?? 0);
    sGF += mG; sGA += oG; if (mG > oG) sW++; else if (mG < oG) sL++; else sD++;
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
  tb.className = sL > sW && sL >= 2 ? 'px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-500/20 text-rose-400 border border-rose-500/40' : sW > sL ? 'px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/40';
  tb.innerText = sL > sW && sL >= 2 ? '🚨 HIGH TILT' : sW > sL ? '🔥 VIBES IMMACULATE' : '⚖️ MIXED BAG';

  const arr = Object.values(pMap).map(sp => ({ ...sp, avgRat: sp.ratingSum / sp.games, imp: (sp.ratingSum / sp.games) * 10 + sp.goals * 4 + sp.assists * 3 })).sort((a, b) => b.imp - a.imp);
  if (arr.length) {
    const mvp = arr[0], liab = arr[arr.length - 1];
    document.getElementById('sessionMvpName').innerText = mvp.name; document.getElementById('sessionMvpStats').innerText = `${mvp.avgRat.toFixed(1)} AVG • ${mvp.goals}G ${mvp.assists}A`; document.getElementById('sessionMvpAvatar').src = getPlayerAvatarUrl(mvp.name);
    document.getElementById('sessionLiabilityName').innerText = liab.name; document.getElementById('sessionLiabilityStats').innerText = `${liab.avgRat.toFixed(1)} AVG • ${liab.goals}G ${liab.assists}A`; document.getElementById('sessionLiabilityAvatar').src = getPlayerAvatarUrl(liab.name);
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
    { title: '📊 Current Status', icon: 'fa-signal text-sky-400', border: 'border-sky-500/30', items: [`Competing in <b>${clubData.division||'Div 5'}</b> (${st.skillRating||1500} SR • ${clubData.globalRank?.label||'Top 10%'}).`, `All-time win rate: <b>${winPct}%</b> (${w}W-${d}D-${l}L), averaging <b>${gpg} GF/g</b>.`, `Last 10 momentum: <b>${rW}W-${10-rW-rL}D-${rL}L</b> (${rGF} GF / ${rGA} GA).`] },
    { title: '💪 Key Strengths', icon: 'fa-dumbbell text-emerald-400', border: 'border-emerald-500/30', items: [Number(gpg)>=2.0?`<b>Attacking Threat:</b> Averaging ${gpg} goals/game.`:`<b>Balanced Scoring:</b> Shared goal contributions.`, `<b>Ball Retention:</b> ${avgPass}% squad pass accuracy.`, topScorer?`<b>Focal Point:</b> ${topScorer.name||topScorer.proName} leads with ${topScorer.goals} goals.`:''] },
    { title: '⚠️ Weaknesses', icon: 'fa-triangle-exclamation text-rose-400', border: 'border-rose-500/30', items: [Number(gapg)>=2.0?`<b>Defensive Leakage:</b> Conceding ${gapg} goals/game.`:`<b>Tight Margins:</b> Narrow 1-goal defeats.`, `<b>Turnovers:</b> ${missedP} missed passes in the last 10 games.`, `<b>Finishing:</b> ${missedS} unconverted shots in recent fixtures.`] },
    { title: '🎯 Areas to Address', icon: 'fa-bullseye text-amber-400', border: 'border-amber-500/30', items: [`<b>Anchor the Midfield:</b> Keep one CDM behind the ball during wide attacks.`, `<b>Cut Out Hospital Passes:</b> Play short triangles before forcing through-balls.`, `<b>Extra Pass in Box:</b> Look for high-percentage cutbacks.`] }
  ];
  document.getElementById('clubReviewGrid').innerHTML = pillars.map(p => `<div class="bg-gray-900/60 border ${p.border} rounded-xl p-3.5 space-y-2"><div class="text-xs font-black uppercase text-white flex items-center gap-2 border-b border-gray-800 pb-1.5"><i class="fa-solid ${p.icon}"></i>${p.title}</div><ul class="space-y-1.5 text-xs text-gray-300">${p.items.filter(Boolean).map(i => `<li class="flex items-start gap-1.5"><span class="text-emerald-400 font-bold">•</span><span>${i}</span></li>`).join('')}</ul></div>`).join('');
}

function computeMatchIntelligence(clubId, matchesPayload) {
  RECENT_FORM_MAP = {}; RECENT_10_STATS_MAP = {}; TOP_FIDGET_SPINNER_NAME = null; TOP_MEAT_WALL_NAME = null;
  const ratingBuckets = {}, duoContributions = {}, opponentCounts = {}, shameMap = {}, sessionMatches = [];
  let highestSrOpp = null, smallGames = 0, smallWins = 0, largeGames = 0, largeWins = 0, prevTs = null;
  const oppBuckets = { 2: { label: 'vs. 2-Man', w:0, d:0, l:0, total:0 }, 3: { label: 'vs. 3-Man', w:0, d:0, l:0, total:0 }, 4: { label: 'vs. 4-Man', w:0, d:0, l:0, total:0 }, 5: { label: 'vs. 5+ Man', w:0, d:0, l:0, total:0 } };
  const matchArr = Array.isArray(matchesPayload) ? matchesPayload : (matchesPayload?.matches || []);

  matchArr.slice(0, 10).forEach((m, idx) => {
    const ts = Number(m.timestamp || 0);
    if (idx === 0 || (prevTs && ts > 0 && Math.abs(prevTs - ts) <= 4 * 3600)) { sessionMatches.push(m); prevTs = ts; }
    const clubs = m.clubs || m.aggregate || {}, cIds = Object.keys(clubs);
    const thisId = cIds.find(id => String(id) === String(clubId)) || cIds[0], oppId = cIds.find(id => String(id) !== String(clubId)) || cIds[1];
    const myClub = clubs[thisId] || {}, oppClub = clubs[oppId] || {}, oppName = oppClub.details?.name || oppClub.name || 'Opponent FC', oppSR = Number(oppClub.skillRating || oppClub.details?.skillRating || 0);
    const myG = Number(myClub.goals ?? myClub.score ?? 0), oppG = Number(oppClub.goals ?? oppClub.score ?? 0), isWin = myG > oppG, isLoss = myG < oppG;

    if (!opponentCounts[oppName]) opponentCounts[oppName] = { clubId: oppId, name: oppName, played: 0, wins: 0, losses: 0, draws: 0, sr: oppSR, crestId: oppClub.crestId || oppClub.TEAM || oppClub.details?.crestAssetId };
    opponentCounts[oppName].played++; if (isWin) opponentCounts[oppName].wins++; else if (isLoss) opponentCounts[oppName].losses++; else opponentCounts[oppName].draws++;
    if (!highestSrOpp || oppSR > highestSrOpp.sr) highestSrOpp = opponentCounts[oppName];

    const oppCnt = Object.keys(m.players?.[oppId] || {}).length;
    if (oppCnt > 0) { const bk = oppCnt <= 2 ? 2 : oppCnt === 3 ? 3 : oppCnt === 4 ? 4 : 5; oppBuckets[bk].total++; if (isWin) oppBuckets[bk].w++; else if (isLoss) oppBuckets[bk].l++; else oppBuckets[bk].d++; }

    const lobbyPlayers = Object.values(m.players?.[thisId] || {});
    if (lobbyPlayers.length > 0 && lobbyPlayers.length <= 3) { smallGames++; if (isWin) smallWins++; } else if (lobbyPlayers.length >= 4) { largeGames++; if (isWin) largeWins++; }

    const activeContributors = [], maxSecs = lobbyPlayers.reduce((mx, lp) => Math.max(mx, Number(lp.secondsPlayed || 0)), 0);
    lobbyPlayers.forEach(p => {
      const pName = p.playername || p.name || 'Pro', r = parseFloat(p.rating || 0), g = Number(p.goals || 0), a = Number(p.assists || 0);
      const t = Number(p.tacklesmade || p.tackles || 0), tAtt = Number(p.tackleattempts || Math.max(t, t * 2)), shots = Number(p.shots || 0);
      const pMade = Number(p.passesmade || 0), pAtt = Number(p.passattempts || pMade), missedP = Math.max(0, pAtt - pMade), reds = Number(p.redcards || 0);
      const isSub = maxSecs > 600 && Number(p.secondsPlayed || maxSecs) <= maxSecs * 0.78 && reds === 0, ev = parsePlayerMatchEvents(p);

      if (idx < 5 && r > 0) { if (!ratingBuckets[pName]) ratingBuckets[pName] = []; ratingBuckets[pName].push(r); }
      if (!RECENT_10_STATS_MAP[pName]) RECENT_10_STATS_MAP[pName] = { games:0, goals:0, assists:0, shots:0, tackles:0, totalRating:0, skillMoves:0, blocks:0, superSubGA:0, subGames:0, recentCleanSheets:0 };
      const r10 = RECENT_10_STATS_MAP[pName];
      r10.games++; r10.goals += g; r10.assists += a; r10.shots += shots; r10.tackles += t; r10.totalRating += r; r10.skillMoves += ev.skillMoves; r10.blocks += ev.blocks;
      if (isSub) r10.subGames++; if (isSub && (g + a > 0)) r10.superSubGA += (g + a); if (oppG === 0) r10.recentCleanSheets++;

      if (!shameMap[pName]) shameMap[pName] = { name: pName, games:0, missedPasses:0, skillMoves:0, dribblesCompleted:0, blocks:0, shots:0, goals:0, reds:0, tackles:0, tackleAtt:0, superSubGA:0, subGames:0, cleanSheets:0 };
      const sm = shameMap[pName];
      sm.games++; sm.missedPasses += missedP; sm.skillMoves += ev.skillMoves; sm.dribblesCompleted += ev.dribblesCompleted; sm.blocks += ev.blocks; sm.shots += shots; sm.goals += g; sm.reds += reds; sm.tackles += t; sm.tackleAtt += tAtt;
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
  SHAME_LIST_CACHE = Object.values(shameMap);
  const topSkiller = [...SHAME_LIST_CACHE].sort((a, b) => b.skillMoves - a.skillMoves)[0];
  if (topSkiller?.skillMoves > 0) TOP_FIDGET_SPINNER_NAME = topSkiller.name;
  const topBlocker = [...SHAME_LIST_CACHE].sort((a, b) => b.blocks - a.blocks)[0];
  if (topBlocker?.blocks > 0) TOP_MEAT_WALL_NAME = topBlocker.name;

  updateRecapMetricsDisplay(clubId, CURRENT_RECAP_MODE === 'session' ? sessionMatches : matchArr.slice(0, 10), CURRENT_RECAP_MODE);
  const sPct = smallGames > 0 ? Math.round((smallWins / smallGames) * 100) : null, lPct = largeGames > 0 ? Math.round((largeWins / largeGames) * 100) : null;
  document.getElementById('squadFactorSmall').innerText = sPct !== null ? `2–3 Pros: ${sPct}% Win (${smallWins}/${smallGames})` : '2–3 Pros: No GP';
  document.getElementById('squadFactorLarge').innerText = lPct !== null ? `4+ Pros: ${lPct}% Win (${largeWins}/${largeGames})` : '4+ Pros: No GP';
  document.getElementById('squadFactorVerdict').innerText = (sPct !== null && lPct !== null) ? (sPct > lPct ? 'Small squad synergy!' : 'Full squad dominance!') : 'Balanced chemistry';

  document.getElementById('vsOpponentSizeGrid').innerHTML = [2, 3, 4, 5].map(k => {
    const b = oppBuckets[k], wp = b.total > 0 ? Math.round((b.w / b.total) * 100) : null;
    return `<div class="bg-gray-900/60 border border-gray-800 rounded-lg p-2.5 space-y-1"><div class="flex items-center justify-between"><span class="text-[10px] font-black uppercase text-gray-300">${b.label}</span><span class="text-xs font-black ${wp!==null&&wp>=50?'text-emerald-400':'text-gray-300'}">${wp!==null?`${wp}% Win`:'0 GP'}</span></div><div class="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden"><div class="h-full ${wp!==null&&wp>=50?'bg-emerald-500':'bg-rose-500'} rounded-full" style="width:${wp!==null?Math.max(8,wp):0}%"></div></div><div class="text-[10px] font-mono text-gray-400">Record: <b class="text-white">${b.w}W-${b.d}D-${b.l}L</b></div></div>`;
  }).join('');

  renderShameBoard(SHAME_LIST_CACHE);
  if (matchArr.length) {
    document.getElementById('intelSection').classList.remove('hidden');
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
      document.getElementById('nemesisName').innerText = tOpp.name; document.getElementById('nemesisMeta').innerText = `Record: ${tOpp.wins}W-${tOpp.draws}D-${tOpp.losses}L • SR: ${tOpp.sr||'--'}`;
      document.getElementById('nemesisCrest').innerHTML = renderCrestHtml(tOpp.name, tOpp.crestId, 'w-11 h-11', tOpp.clubId);
    }
  }
  return SHAME_LIST_CACHE;
}

function switchBanterMode(mode) {
  CURRENT_BANTER_MODE = mode;
  document.getElementById('btnBanterLast10').className = mode === 'last10' ? 'px-3 py-1 rounded text-xs font-black bg-rose-500 text-white transition shadow' : 'px-3 py-1 rounded text-xs font-bold text-gray-300 hover:text-white transition';
  document.getElementById('btnBanterAllTime').className = mode === 'allTime' ? 'px-3 py-1 rounded text-xs font-black bg-rose-500 text-white transition shadow' : 'px-3 py-1 rounded text-xs font-bold text-gray-300 hover:text-white transition';
  renderShameBoard(SHAME_LIST_CACHE);
}

function renderShameBoard(shameList = []) {
  const sec = document.getElementById('shameBoardSection');
  if (!shameList.length && !GLOBAL_MEMBERS.length) return sec.classList.add('hidden');
  sec.classList.remove('hidden');

  let cards = [];
  if (CURRENT_BANTER_MODE === 'allTime' && GLOBAL_MEMBERS.length) {
    document.getElementById('shameBoardSubtext').innerText = 'All-Time Club Career leaders in Meat Wall blocks, impact, clean sheets, skill flair, missed passes, unconverted shots & bookings';
    const cList = GLOBAL_MEMBERS.map(m => {
      const name = m.name || m.proName || 'Pro', games = Math.max(1, Number(m.gamesPlayed ?? m.games ?? 1)), goals = Number(m.goals ?? 0), assists = Number(m.assists ?? 0);
      const pm = Number(m.passesMade ?? m.passesmade ?? 0), pPct = Math.max(1, Number(m.passSuccessRate ?? 75)), missedP = Math.max(0, Math.round(pm / (pPct / 100)) - pm);
      const sConv = Math.max(5, Number(m.shotConvRate ?? m.shotSuccessRate ?? 25)), estShots = goals > 0 ? Math.round(goals / (sConv / 100)) : games * 2, missedS = Math.max(0, estShots - goals);
      const tkl = Number(m.tacklesMade ?? m.tacklesmade ?? m.tackles ?? 0), tPct = Math.max(10, Number(m.tackleSuccessRate ?? 25)), estTAtt = Math.round(tkl / (tPct / 100));
      const reds = Number(m.redCards ?? m.redcards ?? 0), cs = Number(m.totalCleanSheets ?? 0), r10 = RECENT_10_STATS_MAP[name] || {};
      const skills = Math.max(r10.skillMoves || 0, Math.round((r10.games > 0 ? r10.skillMoves / r10.games : ((goals + assists) / games) * 2.2) * games));
      const isDef = normalizePosition(m.favoritePosition || m.pos) === 'DEF';
      const careerBlocks = Math.max(r10.blocks || 0, Math.round(r10.games > 0 ? (r10.blocks / r10.games) * games : tkl * (isDef ? 0.68 : 0.42) + cs * 0.8));
      return { name, games, goals, assists, missedP, estShots, missedS, sConv, tkl, estTAtt, reds, cs, skills, careerBlocks, superSubGA: r10.superSubGA || 0 };
    });
    const [bySub, byMeat, byPad, bySkill, byPass, byBarn, byRed] = [
      [...cList].sort((a, b) => (b.superSubGA * 25 + ((b.goals + b.assists) / b.games) * 10) - (a.superSubGA * 25 + ((a.goals + a.assists) / a.games) * 10))[0],
      [...cList].sort((a, b) => b.careerBlocks - a.careerBlocks)[0],
      [...cList].sort((a, b) => (b.cs * 5 + b.tkl * 0.1) - (a.cs * 5 + a.tkl * 0.1))[0],
      [...cList].sort((a, b) => b.skills - a.skills)[0],
      [...cList].sort((a, b) => b.missedP - a.missedP)[0],
      [...cList].sort((a, b) => b.missedS - a.missedS)[0],
      [...cList].sort((a, b) => (b.reds * 25 + (b.estTAtt - b.tkl)) - (a.reds * 25 + (a.estTAtt - a.tkl)))[0]
    ];
    cards = [
      { title: '🥩 All-Time Meat Wall (Blocks)', w: byMeat.name, st: `~${byMeat.careerBlocks} Career Body Blocks`, sub: `Putting face, ribs & shins in the firing line (${byMeat.games} GP)`, b: 'border-orange-500/40', c: 'text-orange-400' },
      { title: '🦸‍♂️ All-Time Impact / Super-Sub', w: bySub.name, st: bySub.superSubGA > 0 ? `${bySub.superSubGA} Bench G+A` : `${((bySub.goals+bySub.assists)/bySub.games).toFixed(2)} G+A / Game`, sub: `${bySub.goals}G & ${bySub.assists}A across ${bySub.games} career games`, b: 'border-emerald-500/40', c: 'text-emerald-400' },
      { title: '🔒 All-Time Padlock (Clean Sheets)', w: byPad.name, st: `${byPad.cs} Career Clean Sheets`, sub: `${byPad.tkl} career tackles won (${byPad.games} GP)`, b: 'border-sky-500/40', c: 'text-sky-400' },
      { title: '🌀 All-Time Fidget Spinner', w: bySkill.name, st: `~${bySkill.skills} Career Skill Moves`, sub: `Averaging ${(bySkill.skills/bySkill.games).toFixed(1)} skill beats per match`, b: 'border-fuchsia-500/40', c: 'text-fuchsia-400' },
      { title: '🏥 All-Time Hospital Pass', w: byPass.name, st: `${byPass.missedP} Career Missed Passes`, sub: `Across ${byPass.games} all-time club appearances`, b: 'border-amber-500/40', c: 'text-amber-400' },
      { title: '🚪 All-Time Barn Door Award', w: byBarn.name, st: `${byBarn.missedS} Unconverted Shots`, sub: `${byBarn.goals} goals from ~${byBarn.estShots} shots (${byBarn.sConv}% conv)`, b: 'border-rose-500/40', c: 'text-rose-400' },
      { title: '🟥 All-Time Sunday League Butcher', w: byRed.name, st: byRed.reds > 0 ? `${byRed.reds} Career Red Cards` : `${byRed.tkl} Career Tackles`, sub: `${Math.max(0, byRed.estTAtt - byRed.tkl)} missed lunges across ${byRed.games} GP`, b: 'border-red-500/40', c: 'text-red-400' }
    ];
  } else if (shameList.length) {
    document.getElementById('shameBoardSubtext').innerText = 'Last 10 Matches telemetry: Meat Wall shot blocks, super-subs, clean sheets, skill moves, missed passes, shot conversion & bookings';
    shameList.forEach(i => i.careerCS = Number(GLOBAL_MEMBERS.find(m => (m.name || m.proName) === i.name)?.totalCleanSheets || 0));
    const [bySub, byMeat, byPad, bySkill, byPass, byBarn, byRed] = [
      [...shameList].sort((a, b) => (b.superSubGA * 10 + b.subGames) - (a.superSubGA * 10 + a.subGames))[0],
      [...shameList].sort((a, b) => (b.blocks * 10 + b.tackles) - (a.blocks * 10 + a.tackles))[0],
      [...shameList].sort((a, b) => (b.cleanSheets * 10 + b.tackles * 0.2) - (a.cleanSheets * 10 + a.tackles * 0.2))[0],
      [...shameList].sort((a, b) => b.skillMoves - a.skillMoves)[0],
      [...shameList].sort((a, b) => b.missedPasses - a.missedPasses)[0],
      [...shameList].sort((a, b) => (b.shots - b.goals) - (a.shots - a.goals))[0],
      [...shameList].sort((a, b) => (b.reds * 15 + (b.tackleAtt - b.tackles)) - (a.reds * 15 + (a.tackleAtt - a.tackles)))[0]
    ];
    cards = [
      { title: '🥩 The Meat Wall (Most Blocks)', w: byMeat.name, st: `${byMeat.blocks} Shot & Cross Blocks`, sub: `Human sandbag across ${byMeat.games} recent matches`, b: 'border-orange-500/40', c: 'text-orange-400' },
      { title: '🦸‍♂️ The Super-Sub Award', w: bySub.name, st: bySub.superSubGA > 0 ? `${bySub.superSubGA} G+A off Bench` : `${bySub.subGames} Sub Apps`, sub: 'Mid-match joiner impact (Last 10)', b: 'border-emerald-500/40', c: 'text-emerald-400' },
      { title: '🔒 The Padlock (Clean Sheets)', w: byPad.name, st: `${byPad.cleanSheets} Clean Sheets (Last 10)`, sub: `${byPad.careerCS} all-time career shutouts`, b: 'border-sky-500/40', c: 'text-sky-400' },
      { title: '🌀 Fidget Spinner', w: bySkill.name, st: `${bySkill.skillMoves} Skill Moves`, sub: `${bySkill.dribblesCompleted} dribbles completed (Last 10)`, b: 'border-fuchsia-500/40', c: 'text-fuchsia-400' },
      { title: '🏥 Hospital Pass Award', w: byPass.name, st: `${byPass.missedPasses} Missed Passes`, sub: `Across ${byPass.games} recent appearances`, b: 'border-amber-500/40', c: 'text-amber-400' },
      { title: '🚪 The Barn Door Award', w: byBarn.name, st: `${byBarn.shots} Shots (${byBarn.goals}G)`, sub: `${byBarn.shots>0?Math.round((byBarn.goals/byBarn.shots)*100):0}% shot conversion in last 10`, b: 'border-rose-500/40', c: 'text-rose-400' },
      { title: '🟥 Sunday League Butcher', w: byRed.name, st: byRed.reds > 0 ? `${byRed.reds} Red Cards` : `${byRed.tackles} Tackles Won`, sub: 'Midfield enforcer in last 10', b: 'border-red-500/40', c: 'text-red-400' }
    ];
  }
  document.getElementById('shameBoardGrid').innerHTML = cards.map(c => `<div class="bg-gray-900/60 border ${c.b} rounded-xl p-3.5 flex items-center justify-between"><div class="min-w-0 pr-2"><div class="text-[10px] font-black uppercase text-gray-400 truncate">${c.title}</div><div class="text-sm font-extrabold text-white mt-0.5 truncate">${c.w}</div><div class="text-xs font-bold ${c.c} mt-0.5">${c.st}</div><div class="text-[10px] text-gray-500 mt-0.5 truncate">${c.sub}</div></div><img src="${getPlayerAvatarUrl(c.w)}" class="w-11 h-11 rounded-full border border-gray-700 bg-gray-900 flex-shrink-0"></div>`).join('');
}

function renderCareerMilestones(members = []) {
  const sec = document.getElementById('milestonesSection');
  if (!members.length) return sec.classList.add('hidden');
  sec.classList.remove('hidden');
  const nextT = (v, steps = [25, 50, 75, 100, 150, 200, 250, 300, 500]) => steps.find(t => v < t) || Math.ceil((v + 1) / 100) * 100;
  const items = [];
  members.forEach(m => {
    const n = m.name || m.proName || 'Pro';
    [[Number(m.goals??0), 'Club Goals', 'fa-futbol text-emerald-400', 'bg-emerald-500'], [Number(m.assists??0), 'Club Assists', 'fa-shoe-prints text-sky-400', 'bg-sky-500'], [Number(m.gamesPlayed??0), 'Appearances', 'fa-shirt text-amber-400', 'bg-amber-500'], [Number(m.manOfTheMatch??0), 'MoTM Awards', 'fa-crown text-purple-400', 'bg-purple-500']].forEach(([val, cat, ic, bg]) => {
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
    const badge = s.badgeType === 'title' ? `<span class="px-2 py-0.5 rounded text-xs font-black bg-yellow-500/20 text-yellow-300 border border-yellow-500/40">🏆 ${s.outcome}</span>` : s.badgeType === 'promo' ? `<span class="px-2 py-0.5 rounded text-xs font-black bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">⬆️ ${s.outcome}</span>` : s.badgeType === 'active' ? `<span class="px-2 py-0.5 rounded text-xs font-black bg-sky-500/15 text-sky-300 border border-sky-500/30">▶️ ${s.outcome}</span>` : `<span class="px-2 py-0.5 rounded text-xs font-bold bg-gray-800 text-gray-300 border border-gray-700">${s.outcome}</span>`;
    return `<tr class="${s.isCurrent?'bg-emerald-950/15 font-semibold':'hover:bg-gray-800/40'} border-b border-gray-800/60"><td class="py-2.5 px-2 font-bold text-white">${s.label}</td><td class="py-2.5 px-2 text-center">${renderDivisionShieldHtml(s.divisionNum??s.division,'sm')}</td><td class="py-2.5 px-2 text-center font-mono text-white">${s.wins}-${s.draws}-${s.losses}</td><td class="py-2.5 px-2 text-center text-gray-300">${wp}%</td><td class="py-2.5 px-2 text-center text-gray-300">${s.goalsFor}/${s.goalsAgainst} (${gd>=0?`+${gd}`:gd})</td><td class="py-2.5 px-2 text-center font-black text-emerald-400">${s.points} pts</td><td class="py-2.5 px-2 text-right">${badge}</td></tr>`;
  }).join('');
}

async function loadClub(clubId, platform, updateHistory = true) {
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
    renderClub(clubId, combined, platform, membersList, GLOBAL_MATCHES, updateHistory);
    renderClubReviewReport(combined, membersList, GLOBAL_MATCHES, shameList);
    renderSeasonsHistory(combined.seasonsHistory, combined.trophies);
    renderCareerMilestones(membersList);
    buildDynamicPitchTactic(membersList, GLOBAL_MATCHES);
    initRadarComparison(membersList);
    renderRecentMatches(clubId, GLOBAL_MATCHES);
    setStatus('');
  } catch (e) { setStatus(`Error loading stats: ${e.message}`, true); }
}

function renderClub(clubId, data, platform, membersList = [], matchesPayload = [], updateHistory = true) {
  const infoObj = data.info || {}, statObj = data.overall || {}, name = infoObj.name || infoObj.clubName || statObj.name || 'Unknown Club';
  const wins = statObj.wins ?? statObj.overallWins ?? 0, ties = statObj.ties ?? statObj.overallTies ?? 0, losses = statObj.losses ?? statObj.overallLosses ?? 0;
  const goals = statObj.goals ?? statObj.overallGoals ?? 0, conceded = statObj.goalsAgainst ?? statObj.overallGoalsAgainst ?? 0, rating = statObj.skillRating ?? statObj.rating ?? '--';

  const clubSlug = slugifyClubName(name);
  if (clubSlug) {
    document.title = `${name} | FC Pro Clubs Live Tracker`;
    const newPath = `/${clubSlug}${platform !== 'common-gen5' ? `?platform=${encodeURIComponent(platform)}` : ''}`;
    if (updateHistory && window.location.pathname !== `/${clubSlug}`) window.history.pushState({ clubId, platform, clubName: name }, '', newPath);
  }

  const gDiff = Number(goals) - Number(conceded), myMatchClub = matchesPayload[0]?.clubs?.[clubId];
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

  const rep = data.clubRep || { formattedFans: '50.0K', level: 5, tierTitle: 'Hometown Heroes' };
  const lvlBadge = document.getElementById('clubLevelBadgeText');
  if (lvlBadge) lvlBadge.innerText = `Lvl ${rep.level} • ${rep.formattedFans} Fans`;

  const kits = data.kits || { home: ['#10b981','#ffffff','#064e3b'], away: ['#1e293b','#38bdf8','#0f172a'], third: ['#f59e0b','#111827','#ffffff'] };
  document.getElementById('clubKitsContainer').innerHTML = `${renderMiniJerseySvg(kits.home,'Home')}<span class="text-gray-700">|</span>${renderMiniJerseySvg(kits.away,'Away')}<span class="text-gray-700">|</span>${renderMiniJerseySvg(kits.third,'3rd')}`;
  if (data.globalRank) { const rb = document.getElementById('globalRankBadge'); rb.innerText = `🌍 ${data.globalRank.label}`; rb.classList.remove('hidden'); }

  if (data.trophies) {
    document.getElementById('trophyBar').classList.remove('hidden');
    document.getElementById('trophyTitles').innerText = data.trophies.titlesWon ?? 0;
    document.getElementById('trophyLeagues').innerText = data.trophies.leaguesWon ?? 0;
    document.getElementById('trophyPromos').innerText = data.trophies.promotions ?? 0;
    document.getElementById('trophyRelegs').innerText = data.trophies.relegations ?? 0;
    const fansEl = document.getElementById('trophyFansText'), repSubEl = document.getElementById('trophyRepSubtext');
    if (fansEl) fansEl.innerText = `${rep.formattedFans} Fans`;
    if (repSubEl) repSubEl.innerText = `Lvl ${rep.level} • ${rep.tierTitle}`;
    const pk = data.trophies.bestDivision || data.division || 'Div 5';
    document.getElementById('trophyPeakDivText').innerText = pk;
    document.getElementById('trophyPeakDivShield').innerHTML = renderDivisionShieldHtml(data.trophies.bestDivisionNum ?? pk, 'md');
  }

  document.getElementById('clubMeta').innerText = `Club ID: ${clubId} | ${platform.includes('gen5')?'PC / PS5 / XBOX SERIES X|S':platform.toUpperCase()}`;
  document.getElementById('clubRecord').innerText = `${wins} - ${ties} - ${losses}`;
  document.getElementById('skillRating').innerText = rating;
  document.getElementById('goalStats').innerHTML = `${goals}/${conceded} <span class="text-xs text-gray-400 font-normal">(${gDiff>=0?`+${gDiff}`:gDiff})</span>`;
}

function renderMembers(data) {
  const tbody = document.getElementById('membersTable'), list = Array.isArray(data) ? data : [];
  if (!list.length) { tbody.innerHTML = '<tr><td colspan="11" class="py-6 text-center text-gray-500">No member records returned.</td></tr>'; return []; }

  tbody.innerHTML = list.map(m => {
    const name = m.name || m.proName || 'Unknown', ovr = Number(m.proOverall || 85), tierInfo = getCardTierTheme(ovr);
    const normPos = normalizePosition(m.favoritePosition || m.pos || 'MID'), exactPos = EA_PRO_POS_MAP[String(m.proPos ?? '')] || normPos;
    const games = Number(m.gamesPlayed ?? 0), goals = Number(m.goals ?? 0), assists = Number(m.assists ?? 0);
    const careerRat = parseFloat(m.ratingAve || m.rating || 0), pass = m.passSuccessRate ?? 0, motm = m.manOfTheMatch ?? 0;
    const tackles = m.tacklesmade ?? m.tackles ?? 0, tWin = m.tacklesuccessrate ?? 0, gaPg = games > 0 ? ((goals + assists) / games).toFixed(2) : '0.00';

    const r10 = RECENT_10_STATS_MAP[name], r10Conv = r10?.shots > 0 ? Math.round((r10.goals / r10.shots) * 100) : null;
    const shotConv = Number(m.shotConvRate || 0) > 0 ? Number(m.shotConvRate) : (r10Conv ?? '--');
    const totalCS = Math.max(Number(m.totalCleanSheets || 0), Number(r10?.recentCleanSheets || 0));
    const csBadge = totalCS > 0 ? `<span class="ml-1 px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-300 text-[10px] font-bold">${totalCS} CS</span>` : '';
    const otherG = Number(m.otherClubGames ?? 0);
    const loyaltyBadge = otherG === 0 ? `<span class="px-1.5 py-0.5 rounded text-[9px] font-black bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">🛡️ One-Club</span>` : `<span class="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/10 text-amber-300 border border-amber-500/30">💼 ${otherG}g Elsewhere</span>`;
    const recentAvg = RECENT_FORM_MAP[name];
    const formArr = (recentAvg !== undefined && careerRat > 0) ? (recentAvg - careerRat >= 0.15 ? '<span class="text-emerald-400 font-black ml-1">▲</span>' : recentAvg - careerRat <= -0.15 ? '<span class="text-rose-400 font-black ml-1">▼</span>' : '<span class="text-gray-500 ml-1">•</span>') : '';

    m._normalizedPos = normPos; m._rawPos = exactPos;
    const funTag = getPlayerFunTag(m);
    const bCol = normPos === 'FWD' ? 'text-rose-400 bg-rose-500/10' : normPos === 'MID' ? 'text-amber-400 bg-amber-500/10' : normPos === 'DEF' ? 'text-blue-400 bg-blue-500/10' : 'text-purple-400 bg-purple-500/10';
    return `<tr onclick="openFutModal('${name.replace(/'/g, "\\'")}')" class="hover:bg-gray-800/50 transition border-b border-gray-800/60 cursor-pointer"><td class="py-2.5 px-2 font-medium text-white"><div class="flex items-center gap-1.5"><img src="${getPlayerAvatarUrl(name)}" class="w-7 h-7 sm:w-8 sm:h-8 rounded-full border border-emerald-500/40 bg-gray-900 flex-shrink-0"><img src="${getFlagUrl(m.proNationality||'25')}" class="w-4 h-3 object-cover rounded-[2px] flex-shrink-0"><span class="hover:text-yellow-400 font-bold">${name}</span><span class="px-1.5 py-0.5 rounded-full text-[9px] sm:text-[10px] font-extrabold border ${funTag.cls}">${funTag.label}</span>${loyaltyBadge}</div></td><td class="py-2.5 px-2 text-center"><span class="px-2 py-0.5 rounded border font-black text-xs ${tierInfo.badgeClass}">${ovr}</span></td><td class="py-2.5 px-2 text-center"><span class="px-2 py-0.5 rounded text-xs font-semibold ${bCol}">${exactPos}</span></td><td class="py-2.5 px-2 text-center text-gray-300">${games}</td><td class="py-2.5 px-2 text-center font-bold text-emerald-400">${goals} ${shotConv!=='--'?`<span class="text-[10px] text-gray-400 font-mono">(${shotConv}%)</span>`:''}</td><td class="py-2.5 px-2 text-center text-gray-300">${assists}</td><td class="py-2.5 px-2 text-center text-emerald-300 font-mono">${gaPg}</td><td class="py-2.5 px-2 text-center text-sky-400 font-medium">${tackles} <span class="text-xs text-gray-400">(${tWin}%)</span>${csBadge}</td><td class="py-2.5 px-2 text-center text-yellow-400 font-semibold">${careerRat.toFixed(1)}${formArr}</td><td class="py-2.5 px-2 text-center text-gray-300">${pass}%</td><td class="py-2.5 px-2 text-center text-purple-400">${motm}</td></tr>`;
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
  s1.innerHTML = opts; s2.innerHTML = opts; if (sorted.length >= 2) s2.selectedIndex = 1;
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
  const name = p.name || p.proName || 'Player', ovr = Number(p.proOverall || 85), pos = EA_PRO_POS_MAP[String(p.proPos ?? '')] || (p._rawPos?.length <= 4 ? p._rawPos.toUpperCase() : p._normalizedPos);
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

  const m = document.getElementById('futModal'); m.classList.remove('hidden'); m.classList.add('flex');
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
    const myClub = clubs[thisId] || {}, oppClub = clubs[oppId] || {}, myG = Number(myClub.goals ?? myClub.score ?? 0), oppG = Number(oppClub.goals ?? oppClub.score ?? 0);
    const oppName = oppClub.details?.name || oppClub.name || 'Opponent FC', oppSR = oppClub.skillRating || oppClub.details?.skillRating || null;
    const oppCnt = Object.keys(m.players?.[oppId] || {}).length, playerStats = Object.values(m.players?.[thisId] || {});
    const maxSecs = playerStats.reduce((mx, p) => Math.max(mx, Number(p.secondsPlayed || 0)), 0);
    const isRageQuit = (myG > oppG) && ((maxSecs > 0 && maxSecs < 4100) || (myG - oppG >= 4 && maxSecs < 4800) || Number(oppClub.winnerByDnf || myClub.winnerByDnf || 0) === 1);
    const rqBadge = isRageQuit ? `<span class="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[9px] font-black">💨 RAGE QUIT</span>` : '';

    const chaos = getChaosEmoji(myG, oppG, oppSR);
    const [resLbl, resCls, fChar, fCol] = myG > oppG ? ['WIN', 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', 'W', 'emerald'] : myG < oppG ? ['LOSS', 'bg-rose-500/10 text-rose-400 border-rose-500/20', 'L', 'rose'] : ['DRAW', 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20', 'D', 'yellow'];
    if (formList.length < 5) formList.push(`<span class="w-5 h-5 rounded-full bg-${fCol}-500/20 border border-${fCol}-500/40 text-${fCol}-400 text-[10px] font-black flex items-center justify-center">${fChar}</span>`);

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
      const subbed = maxSecs > 600 && Number(p.secondsPlayed || maxSecs) <= maxSecs * 0.78 && Number(p.redcards || 0) === 0;
      const subBadge = (subbed && (goals + assists > 0)) ? `<span class="ml-1 px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-400/50 text-[9px] font-black">🦸‍♂️ SUPER-SUB</span>` : (subbed ? `<span class="ml-1 text-[9px] text-gray-400">🔄 Sub</span>` : '');
      let mvpBadge = '--';
      if (!crownGiven && pName === bestMvp && hiScore > 0) { mvpBadge = `<span class="px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-400 border border-yellow-500/40 text-[10px] font-black">👑 MVP</span>`; crownGiven = true; }
      return `<tr class="border-b border-gray-800/60"><td class="py-2 px-2 font-semibold text-white"><div class="flex items-center gap-1.5"><img src="${getPlayerAvatarUrl(pName)}" class="w-5 h-5 rounded-full bg-gray-900"><span>${pName}</span>${subBadge}</div></td><td class="py-2 px-2 text-center font-black text-yellow-400">${parseFloat(p.rating||0).toFixed(1)}</td><td class="py-2 px-2 text-center font-bold text-emerald-400">${goals}</td><td class="py-2 px-2 text-center font-bold text-sky-400">${assists}</td><td class="py-2 px-2 text-center font-mono">${shots} <span class="text-[10px] text-emerald-400">(${shots>0?`${Math.round((goals/shots)*100)}%`:'--'})</span></td><td class="py-2 px-2 text-center font-mono text-cyan-400">${p._att>0?`${p._made}/${p._att} (${p._passPct}%)`:`${p._passPct}%`}</td><td class="py-2 px-2 text-center font-mono text-amber-400">${Math.max(0,p._att-p._made)}</td><td class="py-2 px-2 text-center font-mono text-fuchsia-400">${p._ev.skillMoves}</td><td class="py-2 px-2 text-center text-sky-400">${p.tacklesmade||0}</td><td class="py-2 px-2 text-right">${mvpBadge}</td></tr>`;
    }).join('');

    return `<tr onclick="document.getElementById('boxScore_${idx}').classList.toggle('hidden')" class="hover:bg-gray-800/40 transition border-b border-gray-800/60 cursor-pointer"><td class="py-2.5 px-2"><span class="px-2 py-0.5 rounded text-[11px] font-semibold bg-gray-800 text-gray-300 border border-gray-700">${m._inferredCategory||'League'}</span></td><td class="py-2.5 px-2 font-medium text-white"><div class="flex items-center gap-1.5">${renderCrestHtml(oppName, oppClub.crestId||oppClub.TEAM||oppClub.details?.crestAssetId, 'w-6 h-6 sm:w-7 sm:h-7', oppId)}<span>${oppName}</span>${oppCnt>0?`<span class="text-[10px] text-gray-400 font-mono">(${oppCnt}p)</span>`:''}${rqBadge}<i class="fa-solid fa-chevron-down text-[9px] text-gray-500"></i></div></td><td class="py-2.5 px-2 text-center" title="${chaos.label}">${chaos.emoji}</td><td class="py-2.5 px-2 text-center">${renderDivisionShieldHtml(oppClub.division||'Div 5','sm')}</td><td class="py-2.5 px-2 text-center">${oppSR?`<span class="inline-block font-mono font-bold text-xs text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">${oppSR}</span>`:'--'}</td><td class="py-2.5 px-2 text-center font-bold text-white">${myG} - ${oppG}</td><td class="py-2.5 px-2 text-center"><div class="inline-flex items-center gap-1.5"><span class="w-6 h-5 rounded flex items-center justify-center text-[11px] font-black border ${mg.gradeCls}">${mg.grade}</span><span class="text-[10px] font-mono text-emerald-400">A:${mg.atk}</span><span class="text-[10px] font-mono text-sky-400">D:${mg.def}</span></div></td><td class="py-2.5 px-2 text-center"><span class="px-2 py-0.5 rounded text-[11px] font-bold border ${resCls}">${resLbl}</span></td><td class="py-2.5 px-2 text-right text-gray-400 text-xs">${dateText}</td></tr><tr id="boxScore_${idx}" class="hidden bg-gray-900/60 border-b border-gray-800"><td colspan="9" class="p-3"><div class="overflow-x-auto touch-scroll rounded border border-gray-800 bg-gray-950/80"><table class="w-full text-left text-xs whitespace-nowrap"><thead class="bg-gray-900 text-gray-400 uppercase text-[10px]"><tr><th class="py-1.5 px-2">Player</th><th class="py-1.5 px-2 text-center">Rat</th><th class="py-1.5 px-2 text-center">G</th><th class="py-1.5 px-2 text-center">A</th><th class="py-1.5 px-2 text-center">Shots (Conv%)</th><th class="py-1.5 px-2 text-center">Passes</th><th class="py-1.5 px-2 text-center">Missed</th><th class="py-1.5 px-2 text-center">Skills</th><th class="py-1.5 px-2 text-center">Tkl</th><th class="py-1.5 px-2 text-right">Award</th></tr></thead><tbody>${rowsHtml}</tbody></table></div></td></tr>`;
  }).join('');
  formContainer.innerHTML = formList.join('');
}

function getExactPlayerRole(m = {}, mp = {}) {
  const id = String(m.proPos ?? '');
  if (EA_PRO_POS_MAP[id]) return EA_PRO_POS_MAP[id];
  const raw = String(mp.pos || m.favoritePosition || 'MID').toLowerCase();
  return raw === 'forward' ? 'ST' : raw === 'midfielder' ? 'CAM' : raw === 'defender' ? 'CB' : raw === 'goalkeeper' ? 'GK' : raw.toUpperCase();
}

function handleFormationOverride(val) { localStorage.setItem(`clubFormation_${GLOBAL_CLUB_ID || 'default'}`, val); buildDynamicPitchTactic(GLOBAL_MEMBERS, GLOBAL_MATCHES); }

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

  const scored = members.map(m => {
    const name = m.name || 'Player', lm = Object.values(latestPlayersMap).find(lp => (lp.playername || lp.name) === name);
    return {
      ...m, _displayName: name, _proNickname: m.proName && m.proName !== name ? `"${m.proName}"` : '',
      _exactRole: getExactPlayerRole(m, lm || {}), _activeNormPos: CURRENT_PITCH_MODE === 'lastMatch' && lm?.pos ? normalizePosition(lm.pos) : m._normalizedPos,
      _buildScore: Number(m.proOverall || 85) * 4 + parseFloat(m.ratingAve || 7.0) * 12, _archetype: computeArchetypeAndPlaystyles(m).archetype,
      _lmScore: lm ? 1000 + parseFloat(lm.rating || 0) * 20 : -1, _lmRat: lm ? parseFloat(lm.rating || 0) : null, _lmGA: lm ? Number(lm.goals || 0) + Number(lm.assists || 0) : 0
    };
  });

  const savedOverride = localStorage.getItem(`clubFormation_${GLOBAL_CLUB_ID || 'default'}`) || 'auto';
  const selectEl = document.getElementById('formationOverrideSelect'); if (selectEl) selectEl.value = savedOverride;

  let tpl = FORMATION_TEMPLATES['4-1-2-1-2'];
  if (savedOverride !== 'auto' && FORMATION_TEMPLATES[savedOverride]) tpl = FORMATION_TEMPLATES[savedOverride];
  else {
    const activeSet = scored.filter(m => m._lmScore > 0).length ? scored.filter(m => m._lmScore > 0) : scored;
    const matchFwds = activeSet.filter(m => m._activeNormPos === 'FWD' || ['ST','LS','RS','CF'].includes(m._exactRole));
    const matchWingers = activeSet.filter(m => ['LW','RW','LF','RF'].includes(m._exactRole));
    tpl = (matchWingers.length >= 2 || matchFwds.length >= 3) ? FORMATION_TEMPLATES['4-3-3 Attack']
      : (matchFwds.length === 2 || (matchFwds.length === 1 && scored.filter(m => m._normalizedPos === 'FWD').length >= 2)) ? FORMATION_TEMPLATES['4-1-2-1-2']
      : FORMATION_TEMPLATES['4-2-3-1 Narrow'];
  }

  document.getElementById('formationBadge').innerText = tpl.name;
  document.getElementById('formationSubtitle').innerText = CURRENT_PITCH_MODE === 'lastMatch' ? `Active Lineup from your most recent match vs ${latestOpp} (${Object.keys(latestPlayersMap).length} Human Pros)` : `Suggested Best XI based on Pro OVR, Exact Position (proPos) & Build Attributes`;

  const pool = CURRENT_PITCH_MODE === 'lastMatch' ? scored.filter(m => m._lmScore > 0).sort((a, b) => b._lmScore - a._lmScore) : [...scored].sort((a, b) => b._buildScore - a._buildScore);
  const used = new Set(), assigned = [];

  const claim = (groupPos, slotLabel, fb = true) => {
    let i = pool.findIndex(p => !used.has(p._displayName) && p._exactRole === slotLabel);
    if (i === -1) i = pool.findIndex(p => !used.has(p._displayName) && p._activeNormPos === groupPos);
    if (i === -1 && fb && groupPos !== 'GK') i = pool.findIndex(p => !used.has(p._displayName));
    if (i !== -1) { used.add(pool[i]._displayName); return pool[i]; }
    return null;
  };

  const nodeHtml = (p, slot) => {
    if (!p) return `<div class="flex flex-col items-center opacity-35 select-none w-16 sm:w-24"><div class="w-9 h-9 sm:w-11 sm:h-11 rounded-full border-2 border-dashed border-gray-400 bg-gray-950/70 flex items-center justify-center text-[9px] text-gray-300 font-black">AI</div><span class="text-[9px] font-bold text-gray-300 mt-1">CPU</span><span class="text-[8px] text-gray-400 uppercase font-extrabold">${slot}</span></div>`;
    assigned.push(p);
    const name = p._displayName, ovr = Number(p.proOverall || 85), tier = getCardTierTheme(ovr);
    const rat = (CURRENT_PITCH_MODE === 'lastMatch' && p._lmRat !== null ? p._lmRat : parseFloat(p.ratingAve || 7.0)).toFixed(1);
    const pill = CURRENT_PITCH_MODE === 'lastMatch' && p._lmRat !== null ? `${p._lmGA} G+A` : p._archetype;
    return `<div onclick="openFutModal('${name.replace(/'/g,"\\'")}')" class="flex flex-col items-center hover:scale-105 transition cursor-pointer group w-[74px] sm:w-24"><div class="relative"><img src="${getPlayerAvatarUrl(name)}" class="w-10 h-10 sm:w-[52px] sm:h-[52px] rounded-full border-2 border-emerald-400 bg-gray-900 object-cover shadow-xl"><span class="absolute -top-1 -left-1.5 bg-gray-950 ${tier.badgeClass} border font-black text-[8px] sm:text-[9px] px-1 rounded">${ovr}</span><span class="absolute -bottom-1 -right-1 bg-yellow-500 text-black font-black text-[8px] sm:text-[9px] px-1 rounded-sm">${rat}</span></div><span class="text-[10px] sm:text-xs font-extrabold text-white mt-1 drop-shadow max-w-[70px] sm:max-w-[96px] truncate" title="${p._proNickname}">${name}</span><div class="flex items-center gap-0.5 mt-0.5"><span class="text-[8px] sm:text-[9px] bg-black/60 text-emerald-300 px-1 rounded uppercase font-black">${slot || p._exactRole}</span><span class="hidden sm:inline text-[9px] bg-black/60 text-gray-200 px-1 rounded font-semibold truncate max-w-[60px]">${pill}</span></div></div>`;
  };

  tpl.atk.forEach(s => rows[0].innerHTML += nodeHtml(claim('FWD', s, true), s));
  rows[1].classList.toggle('hidden', !tpl.cam.length);
  tpl.cam.forEach(s => rows[1].innerHTML += nodeHtml(claim('MID', s, true), s));
  tpl.mid.forEach(s => rows[2].innerHTML += nodeHtml(claim('MID', s, true), s));
  tpl.def.forEach(s => rows[3].innerHTML += nodeHtml(claim('DEF', s, true), s));
  rows[4].innerHTML = nodeHtml(claim('GK', 'GK', false), 'GK');

  const hCnt = assigned.length;
  document.getElementById('pitchMetricHumans').innerText = `${hCnt} / 11 Pros`;
  document.getElementById('pitchMetricOvr').innerText = hCnt ? `${Math.round(assigned.reduce((a,b)=>a+Number(b.proOverall||85),0)/hCnt)} OVR` : '--';
  document.getElementById('pitchMetricRating').innerText = hCnt ? (assigned.reduce((a,b)=>a+parseFloat(b.ratingAve||7.0),0)/hCnt).toFixed(2) : '--';
  document.getElementById('pitchMetricZone').innerText = 'Midfield Engine';
}

async function syncServerAppearances() {
  try {
    const res = await fetch(`${API_BASE}/appearances`);
    if (res.ok) {
      const serverMap = await res.json(), merged = { ...getAppearanceMap() };
      Object.entries(serverMap || {}).forEach(([k, v]) => { if (!v || (!v.skin && !v.hair)) delete merged[k]; else merged[k] = v; });
      localStorage.setItem('proClubsAppearanceV3', JSON.stringify(merged));
    }
  } catch (_) {}
}

function checkInitialUrlRoute() {
  const params = new URLSearchParams(window.location.search), platSelect = document.getElementById('platformSelect');
  if (params.get('platform') && platSelect) platSelect.value = params.get('platform');
  const rawPath = decodeURIComponent(window.location.pathname || '').replace(/^\/+|\/+$/g, '');
  if (!rawPath || rawPath === 'index.html' || rawPath.startsWith('api/')) return;
  if (/^\d+$/.test(rawPath)) { document.getElementById('searchInput').value = rawPath; loadClub(rawPath, platSelect?.value || 'common-gen5', false); }
  else handleSearch(rawPath.replace(/-/g, ' ').trim(), true);
}

window.addEventListener('popstate', (e) => e.state?.clubId ? loadClub(e.state.clubId, e.state.platform || 'common-gen5', false) : checkInitialUrlRoute());

window.onload = async () => {
  applyStoredTheme(); await syncServerAppearances();
  document.getElementById('skinSwatches').innerHTML = SKIN_HEX.map(h => `<button onclick="updateProLook('skin','${h}')" class="w-5 h-5 rounded-full border border-white/40 hover:scale-110 transition" style="background:#${h}"></button>`).join('') + `<button onclick="updateProLook('reset', null)" class="ml-1 px-1.5 py-0.5 rounded bg-gray-800 hover:bg-gray-700 text-[9px] font-bold text-gray-300 border border-gray-600 transition">🔄 Silhouette</button>`;
  document.getElementById('hairSwatches').innerHTML = HAIR_HEX.map(h => `<button onclick="updateProLook('hair','${h}')" class="w-5 h-5 rounded-full border border-white/40 hover:scale-110 transition" style="background:#${h}"></button>`).join('');
  buildDynamicPitchTactic([], []); checkInitialUrlRoute();
};
