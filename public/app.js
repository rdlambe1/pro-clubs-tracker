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
    const byWood = [...SHAME_LIST_CACHE].sort((a, b) => (b.woodwork * 12 + (b.shots - b.goals)) - (a.woodwork * 12 + (a.shots - a.goals)))[0];
    const bySkill = [...SHAME_LIST_CACHE].sort((a, b) => b.skillMoves - a.skillMoves)[0];
    const byPass = [...SHAME_LIST_CACHE].sort((a, b) => b.missedPasses - a.missedPasses)[0];
    const byBarn = [...SHAME_LIST_CACHE].sort((a, b) => (b.shots - b.goals) - (a.shots - a.goals))[0];
    const byAllergy = [...SHAME_LIST_CACHE].sort((a, b) => (b.shots - b.assists * 2.5) - (a.shots - a.assists * 2.5))[0];
    const byBluetooth = [...SHAME_LIST_CACHE].sort((a, b) => Math.max(0, b.tackleAtt - b.tackles) - Math.max(0, a.tackleAtt - a.tackles))[0];

    if (bySub?.superSubGA > 0) banter.push({ title: '🦸‍♂️ Super-Sub', winner: bySub.name, stat: `${bySub.superSubGA} Bench G+A` });
    if (byMeat) banter.push({ title: '🥩 The Meat Wall', winner: byMeat.name, stat: `${byMeat.blocks} Blocks` });
    if (byWood && byWood.woodwork > 0) banter.push({ title: '🪵 Woodwork Merchant', winner: byWood.name, stat: `${byWood.woodwork}x Post & Crossbar` });
    if (bySkill) banter.push({ title: '🌀 Fidget Spinner', winner: bySkill.name, stat: `${bySkill.skillMoves} Skill Moves` });
    if (byPass) banter.push({ title: '🏥 Hospital Pass', winner: byPass.name, stat: `${byPass.missedPasses} Missed Passes` });
    if (byBarn) banter.push({ title: '🚪 Barn Door', winner: byBarn.name, stat: `${byBarn.shots} Shots (${byBarn.goals}G)` });
    if (byAllergy) banter.push({ title: '🚫 Allergy to Passing', winner: byAllergy.name, stat: `${byAllergy.shots} Shots vs ${byAllergy.assists}A` });
    if (byBluetooth) banter.push({ title: '💨 Bluetooth Tackler', winner: byBluetooth.name, stat: `${Math.max(0, byBluetooth.tackleAtt - byBluetooth.tackles)} Missed Tackles` });
  }

  btn.disabled = true; btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Sending...`; status.classList.add('hidden');
  try {
    const res = await fetch(`${API_BASE}/discord/send`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        webhookUrl, clubName: document.getElementById('clubName')?.innerText || 'Pro Clubs', clubId: GLOBAL_CLUB_ID,
        division: GLOBAL_COMBINED_DATA?.division || 'Div 4', skillRating: document.getElementById('skillRating')?.innerText || '--',
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

function parsePlayerMatchEvents(p = {}) {
  const ev = {};
  for (let i = 0; i < 6; i++) {
    String(p[`match_event_aggregate_${i}`] || '').split(',').forEach(pair => {
      const [k, v] = pair.split(':'), id = parseInt(k, 10), cnt = parseInt(v, 10);
      if (!isNaN(id) && !isNaN(cnt)) ev[id] = (ev[id] || 0) + cnt;
    });
  }
  const beats = ev[38] || 0, takeOns = ev[112] || 0, dribbles = ev[174] || 0, flair = ev[147] || 0;
  let skills = beats + flair + Math.max(0, takeOns - beats);
  if (skills === 0 && dribbles > 0) skills = Math.max(1, Math.round(dribbles * 0.35));

  const rawBlocks = (ev[12] || 0) + (ev[13] || 0) + (ev[14] || 0) + (ev[51] || 0) + (ev[56] || 0);
  const tackles = Number(p.tacklesmade || p.tackles || 0);
  const tackleAtt = Number(p.tackleattempts || tackles);
  const missedTackles = Math.max(0, tackleAtt - tackles);
  const posStr = String(p.pos || '').toLowerCase();
  const isDef = ['defender','cb','lb','rb','lcb','rcb','cdm'].includes(posStr);
  const blocks = rawBlocks > 0 ? rawBlocks : (isDef ? Math.max(1, Math.round(tackles * 0.65)) : Math.round(tackles * 0.4));

  const shots = Number(p.shots || 0), goals = Number(p.goals || 0), rating = parseFloat(p.rating || 7.0);
  const rawWoodwork = Number(p.woodwork ?? p.shotsHitWoodwork ?? 0) + (ev[9] || 0) + (ev[10] || 0) + (ev[42] || 0) + (ev[89] || 0);
  const woodwork = rawWoodwork > 0 ? rawWoodwork : ((shots >= 4 && goals === 0 && rating >= 7.2) ? 1 : (shots - goals >= 5 ? 1 : 0));

  const redCards = Number(p.redcards ?? p.redCards ?? p.red_cards ?? ev[19] ?? ev[5] ?? 0);
  const directYellow = Number(p.yellowcards ?? p.yellowCards ?? p.yellow_cards ?? p.cautions ?? p.bookings ?? 0);
  const eventYellow = (ev[18] || 0) + (ev[4] || 0) + (ev[83] || 0) + (ev[84] || 0) + (ev[105] || 0);
  const foulsCommitted = Number(p.foulscommitted ?? p.fouls ?? 0) + (ev[16] || 0) + (ev[17] || 0) + (ev[21] || 0);

  let yellowCards = directYellow > 0 ? directYellow : eventYellow;
  if (yellowCards === 0) {
    if (foulsCommitted >= 2) yellowCards = 1;
    else if (foulsCommitted === 1 && missedTackles >= 4) yellowCards = 1;
    else if (missedTackles >= 6 && rating > 0 && rating <= 6.4) yellowCards = 1;
  }
  yellowCards = redCards > 0 ? Math.min(2, yellowCards) : Math.min(1, yellowCards);

  return { skillMoves: skills, dribblesCompleted: dribbles, blocks, woodwork, yellowCards, redCards };
}

function renderCardBadgesHtml(yellows = 0, reds = 0) {
  if (!yellows && !reds) return `<span class="text-gray-600 font-mono text-xs">-</span>`;
  return `<div class="inline-flex items-center gap-1 justify-center">
    ${yellows > 0 ? `<span class="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-yellow-500/15 border border-yellow-500/40 text-yellow-300 font-mono font-black text-[10px]" title="${yellows} Yellow Card(s)"><span class="w-2 h-2.5 bg-yellow-400 rounded-[1px] inline-block"></span>${yellows}</span>` : ''}
    ${reds > 0 ? `<span class="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-rose-500/20 border border-rose-500/40 text-rose-300 font-mono font-black text-[10px]" title="${reds} Red Card(s)"><span class="w-2 h-2.5 bg-rose-500 rounded-[1px] inline-block"></span>${reds}</span>` : ''}
  </div>`;
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
  if (r10?.woodwork >= 2) return { label: '🪵 Woodwork Merchant', cls: 'bg-yellow-600/20 text-yellow-300 border-yellow-500/50' };
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
    { title: '📊 Current Status', icon: 'fa-signal text-sky-400', border: 'border-sky-500/30', items: [`Competing in <b>${clubData.division||'Div 4'}</b> (${st.skillRating||1500} SR • ${clubData.globalRank?.label||'Top 10%'}).`, `All-time win rate: <b>${winPct}%</b> (${w}W-${d}D-${l}L), averaging <b>${gpg} GF/g</b>.`, `Last 10 momentum: <b>${rW}W-${10-rW-rL}D-${rL}L</b> (${rGF} GF / ${rGA} GA).`] },
    { title: '💪 Key Strengths', icon: 'fa-dumbbell text-emerald-400', border: 'border-emerald-500/30', items: [Number(gpg)>=2.0?`<b>Attacking Threat:</b> Averaging ${gpg} goals/game.`:`<b>Balanced Scoring:</b> Shared goal contributions.`, `<b>Ball Retention:</b> ${avgPass}% squad pass accuracy.`, topScorer?`<b>Focal Point:</b> ${topScorer.name||topScorer.proName} leads with ${topScorer.goals} goals.`:''] },
    { title: '⚠️ Weaknesses', icon: 'fa-triangle-exclamation text-rose-400', border: 'border-rose-500/30', items: [Number(gapg)>=2.0?`<b>Defensive Leakage:</b> Conceding ${gapg} goals/game.`:`<b>Tight Margins:</b> Narrow 1-goal defeats.`, `<b>Turnovers:</b> ${missedP} missed passes in the last 10 games.`, `<b>Finishing:</b> ${missedS} unconverted shots in recent fixtures.`] },
    { title: '🎯 Areas to Address', icon: 'fa-bullseye text-amber-400', border: 'border-amber-500/30', items: [`<b>Anchor the Midfield:</b> Keep one CDM behind the ball during wide attacks.`, `<b>Cut Out Hospital Passes:</b> Play short triangles before forcing through-balls.`, `<b>Extra Pass in Box:</b> Look for high-percentage cutbacks.`] }
  ];
  document.getElementById('clubReviewGrid').innerHTML = pillars.map(p => `<div class="bg-gray-900/60 border ${p.border} rounded-xl p-3.5 space-y-2"><div class="text-xs font-black uppercase text-white flex items-center gap-2 border-b border-gray-800 pb-1.5"><i class="fa-solid ${p.icon}"></i>${p.title}</div><ul class="space-y-1.5 text-xs text-gray-300">${p.items.filter(Boolean).map(i => `<li class="flex items-start gap-1.5"><span class="text
