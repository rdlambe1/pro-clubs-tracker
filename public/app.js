let CURRENT_LEADERBOARD_MODE = 'season';
let CURRENT_MATCH_FILTER = 'ALL';

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

function syncPlatformSelectors(val) {
  const p1 = document.getElementById('platformSelect'), p2 = document.getElementById('homePlatformSelect');
  if (p1 && p1.value !== val) p1.value = val;
  if (p2 && p2.value !== val) p2.value = val;
  if (!document.getElementById('homeView')?.classList.contains('hidden')) {
    loadTop10ClubsLeaderboard(CURRENT_LEADERBOARD_MODE);
  }
}

function setAppView(view) {
  const isHome = view === 'home';
  document.getElementById('homeView')?.classList.toggle('hidden', !isHome);
  document.getElementById('clubDashboardView')?.classList.toggle('hidden', isHome);
  const hdrSearch = document.getElementById('headerSearchControls');
  if (hdrSearch) {
    hdrSearch.classList.toggle('hidden', isHome);
    hdrSearch.classList.toggle('flex', !isHome);
  }
}

function goHome(pushHistory = true) {
  setStatus('');
  document.getElementById('matchesCard')?.classList.add('hidden');
  document.title = 'FC Pro Clubs Live Tracker';
  setAppView('home');
  renderRecentClubsChips();
  if (pushHistory && window.location.pathname !== '/') {
    window.history.pushState({ view: 'home' }, '', '/');
  }
}

function getRecentClubs() {
  try { return JSON.parse(localStorage.getItem('proClubsRecentV1') || '[]'); } catch (_) { return []; }
}

function saveRecentClub(clubId, name, crestId, platform) {
  if (!clubId || !name) return;
  const list = getRecentClubs().filter(c => String(c.id) !== String(clubId));
  list.unshift({ id: String(clubId), name, crestId: crestId || '0', platform: platform || 'common-gen5' });
  localStorage.setItem('proClubsRecentV1', JSON.stringify(list.slice(0, 6)));
}

function removeRecentClub(clubId, ev) {
  if (ev) ev.stopPropagation();
  const list = getRecentClubs().filter(c => String(c.id) !== String(clubId));
  localStorage.setItem('proClubsRecentV1', JSON.stringify(list));
  renderRecentClubsChips();
}

function renderRecentClubsChips() {
  const sec = document.getElementById('recentClubsSection'), box = document.getElementById('recentClubsList');
  if (!sec || !box) return;
  const list = getRecentClubs();
  if (!list.length) return sec.classList.add('hidden');
  sec.classList.remove('hidden');

  box.innerHTML = list.map(c => {
    const crestUrl = `${API_BASE}/crest/${encodeURIComponent(c.crestId || '0')}?name=${encodeURIComponent(c.name || 'FC')}&clubId=${encodeURIComponent(c.id)}&platform=${encodeURIComponent(c.platform || 'common-gen5')}`;
    return `<div onclick="loadClub('${c.id}', '${c.platform || 'common-gen5'}')" class="group inline-flex items-center gap-2 bg-gray-900/90 hover:bg-gray-800 border border-gray-700 hover:border-emerald-500/50 px-3 py-1.5 rounded-full text-xs font-bold text-white cursor-pointer transition shadow">
      <img src="${crestUrl}" class="w-4 h-4 object-contain" alt="${c.name}">
      <span>${c.name}</span>
      <button onclick="removeRecentClub('${c.id}', event)" class="text-gray-500 hover:text-rose-400 ml-0.5 text-[10px]" title="Remove"><i class="fa-solid fa-xmark"></i></button>
    </div>`;
  }).join('');
}

function switchLeaderboardMode(mode) {
  CURRENT_LEADERBOARD_MODE = mode;
  document.getElementById('btnLbSeason').className = mode === 'season' ? 'px-3 py-1 rounded text-xs font-black bg-emerald-500 text-black transition shadow' : 'px-3 py-1 rounded text-xs font-bold text-gray-300 hover:text-white transition';
  document.getElementById('btnLbAllTime').className = mode === 'allTime' ? 'px-3 py-1 rounded text-xs font-black bg-emerald-500 text-black transition shadow' : 'px-3 py-1 rounded text-xs font-bold text-gray-300 hover:text-white transition';
  loadTop10ClubsLeaderboard(mode);
}

async function loadTop10ClubsLeaderboard(mode = 'season') {
  const tbody = document.getElementById('top10ClubsTable');
  if (!tbody) return;
  const platform = document.getElementById('homePlatformSelect')?.value || document.getElementById('platformSelect')?.value || 'common-gen5';
  tbody.innerHTML = `<tr><td colspan="9" class="py-8 text-center text-gray-400"><i class="fa-solid fa-spinner fa-spin mr-2 text-emerald-400"></i>Loading Global Top 10 Clubs...</td></tr>`;

  try {
    const res = await fetch(`${API_BASE}/leaderboard/clubs?type=${encodeURIComponent(mode)}&platform=${encodeURIComponent(platform)}`);
    const list = await res.json();
    if (!res.ok || !Array.isArray(list) || !list.length) {
      tbody.innerHTML = `<tr><td colspan="9" class="py-6 text-center text-gray-500">Leaderboard temporarily unavailable from EA servers. Search any club above!</td></tr>`;
      return;
    }

    tbody.innerHTML = list.map(c => {
      const rankBadge = c.rank === 1
        ? `<span class="w-6 h-6 rounded-full bg-yellow-500/20 border border-yellow-400 text-yellow-300 font-black text-xs inline-flex items-center justify-center">1</span>`
        : c.rank === 2
        ? `<span class="w-6 h-6 rounded-full bg-slate-400/20 border border-slate-300 text-slate-200 font-black text-xs inline-flex items-center justify-center">2</span>`
        : c.rank === 3
        ? `<span class="w-6 h-6 rounded-full bg-amber-700/30 border border-amber-500 text-amber-300 font-black text-xs inline-flex items-center justify-center">3</span>`
        : `<span class="font-mono font-bold text-gray-400">${c.rank}</span>`;

      const gd = c.goals - c.goalsAgainst;
      const reg = c.regionInfo || { name: 'Global', flag: null };
      const regHtml = `<div class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-gray-900 border border-gray-800 text-[11px] text-gray-300">${reg.flag ? `<img src="https://flagcdn.com/w40/${reg.flag}.png" class="w-3.5 h-2.5 object-cover rounded-[1px]">` : ''}<span>${reg.name}</span></div>`;

      return `<tr onclick="loadClub('${c.clubId}', '${platform}')" class="hover:bg-gray-800/50 transition border-b border-gray-800/60 cursor-pointer group">
        <td class="py-2.5 px-2 text-center">${rankBadge}</td>
        <td class="py-2.5 px-2 font-bold text-white"><div class="flex items-center gap-2.5">${renderCrestHtml(c.name, c.crestId, 'w-7 h-7 sm:w-8 sm:h-8', c.clubId)}<span class="group-hover:text-emerald-400 transition">${c.name}</span></div></td>
        <td class="py-2.5 px-2 text-center">${regHtml}</td>
        <td class="py-2.5 px-2 text-center">${renderDivisionShieldHtml(c.divisionNum ?? c.division, 'sm')}</td>
        <td class="py-2.5 px-2 text-center"><span class="font-mono font-black text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded">${c.skillRating}</span></td>
        <td class="py-2.5 px-2 text-center font-mono text-gray-200">${c.wins}-${c.ties}-${c.losses}</td>
        <td class="py-2.5 px-2 text-center font-bold text-sky-400">${c.winPct}%</td>
        <td class="py-2.5 px-2 text-center text-gray-300 font-mono">${c.goals}/${c.goalsAgainst} <span class="text-[10px] text-gray-400">(${gd>=0?`+${gd}`:gd})</span></td>
        <td class="py-2.5 px-2 text-right font-black text-emerald-400"><i class="fa-solid fa-angles-up text-[10px] mr-1"></i>${c.promotions ?? 0}</td>
      </tr>`;
    }).join('');
  } catch (_) {
    tbody.innerHTML = `<tr><td colspan="9" class="py-6 text-center text-gray-500">Could not reach EA Leaderboard right now. Use the search bar above!</td></tr>`;
  }
}

function handleHomeSearch() {
  const q = document.getElementById('homeSearchInput')?.value || '';
  handleSearch(q, false);
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

function setStatus(msg, isErr = false) {
  const b = document.getElementById('statusBanner');
  if (!b) return;
  if (!msg) return b.classList.add('hidden');
  b.classList.remove('hidden'); b.innerText = msg;
  b.className = isErr ? 'text-xs sm:text-sm px-4 py-3 rounded bg-red-950/80 border border-red-800 text-red-200' : 'text-xs sm:text-sm px-4 py-3 rounded bg-gray-800 border border-gray-700 text-gray-300';
}

function renderCrestHtml(name, crestId, sizeClass = 'w-7 h-7', clubId = '') {
  const plat = document.getElementById('platformSelect')?.value || 'common-gen5';
  const cp = clubId ? `&clubId=${encodeURIComponent(clubId)}&platform=${encodeURIComponent(plat)}` : '';
  return `<div class="${sizeClass} rounded-lg bg-gray-900 border border-gray-800 flex items-center justify-center p-0.5 overflow-hidden flex-shrink-0 shadow-md"><img src="${API_BASE}/crest/${crestId?String(crestId).trim():'0'}?name=${encodeURIComponent(name||'FC')}${cp}" class="w-full h-full object-contain" alt="${name}"></div>`;
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
    const nonFwds = SHAME_LIST_CACHE.filter(x => x.normPos !== 'FWD' && x.normPos !== 'GK');
    const byInt = (nonFwds.length ? nonFwds : [...SHAME_LIST_CACHE]).sort((a, b) => (b.interceptions * 10 + b.tackles) - (a.interceptions * 10 + a.tackles))[0];
    const bySub = [...SHAME_LIST_CACHE].sort((a, b) => (b.superSubGA * 10 + b.subGames) - (a.superSubGA * 10 + a.subGames))[0];
    const byMeat = [...SHAME_LIST_CACHE].sort((a, b) => (b.blocks * 10 + b.tackles) - (a.blocks * 10 + a.tackles))[0];
    const byWood = [...SHAME_LIST_CACHE].sort((a, b) => (b.woodwork * 12 + (b.shots - b.goals)) - (a.woodwork * 12 + (a.shots - a.goals)))[0];
    const bySkill = [...SHAME_LIST_CACHE].sort((a, b) => b.skillMoves - a.skillMoves)[0];
    const byPass = [...SHAME_LIST_CACHE].sort((a, b) => b.missedPasses - a.missedPasses)[0];
    const byBarn = [...SHAME_LIST_CACHE].sort((a, b) => (b.shots - b.goals) - (a.shots - a.goals))[0];
    const byAllergy = [...SHAME_LIST_CACHE].sort((a, b) => (b.shots - b.assists * 2.5) - (a.shots - a.assists * 2.5))[0];
    const byBluetooth = [...SHAME_LIST_CACHE].sort((a, b) => Math.max(0, b.tackleAtt - b.tackles) - Math.max(0, a.tackleAtt - a.tackles))[0];

    if (byInt) banter.push({ title: '📡 The Interceptor', winner: byInt.name, stat: `${byInt.interceptions} Int & Recoveries` });
    if (byMeat) banter.push({ title: '🥩 The Meat Wall', winner: byMeat.name, stat: `${byMeat.blocks} Blocks` });
    if (bySub?.superSubGA > 0) banter.push({ title: '🦸‍♂️ Super-Sub', winner: bySub.name, stat: `${bySub.superSubGA} Bench G+A` });
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

async function handleSearch(overrideQuery = null, autoSelectExactSlug = false) {
  const searchEl = document.getElementById('searchInput');
  const homeSearchEl = document.getElementById('homeSearchInput');
  const rawInput = typeof overrideQuery === 'string' ? overrideQuery : (searchEl?.value || homeSearchEl?.value || '');
  const input = String(rawInput).trim();
  if (searchEl) searchEl.value = input;
  if (homeSearchEl) homeSearchEl.value = input;

  const platform = document.getElementById('platformSelect')?.value || document.getElementById('homePlatformSelect')?.value || 'common-gen5';
  document.getElementById('matchesCard')?.classList.add('hidden');
  if (!input) return setStatus('Please enter a club name or numeric ID.', true);
  if (/^\d+$/.test(input)) return loadClub(input, platform);

  setStatus(`Searching EA for "${input}"...`);
  try {
    const res = await fetch(`${API_BASE}/search?clubName=${encodeURIComponent(input)}&platform=${encodeURIComponent(platform)}`);
    const text = await res.text();
    let data = [];
    try { data = JSON.parse(text); } catch (_) { throw new Error('Server returned an invalid response.'); }

    if (!res.ok || !Array.isArray(data) || !data.length) return setStatus(data?.error || `No clubs found matching "${input}".`, true);
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

// Unified Lobby Size Card (Merges Own Party Win % and Opponent Lobby Win % into 1 compact card)
function updateRecapMetricsDisplay(clubId, fixtures = [], mode = 'session') {
  const sec = document.getElementById('sessionRecapSection');
  if (!fixtures.length) return sec.classList.add('hidden');
  sec.classList.remove('hidden');

  let sW = 0, sD = 0, sL = 0, sGF = 0, sGA = 0;
  const pMap = {};
  const ownBuckets = { 2:{label:'2 Pros',w:0,total:0}, 3:{label:'3 Pros',w:0,total:0}, 4:{label:'4 Pros',w:0,total:0}, 5:{label:'5+ Pros',w:0,total:0} };
  const oppBuckets = { 2:{label:'vs 2p',w:0,total:0}, 3:{label:'vs 3p',w:0,total:0}, 4:{label:'vs 4p',w:0,total:0}, 5:{label:'vs 5+p',w:0,total:0} };

  fixtures.forEach(m => {
    const clubs = m.clubs || m.aggregate || {}, cIds = Object.keys(clubs);
    const myId = cIds.find(id => String(id) === String(clubId)) || cIds[0], oppId = cIds.find(id => String(id) !== String(clubId)) || cIds[1];
    const mG = Number(clubs[myId]?.goals ?? clubs[myId]?.score ?? 0), oG = Number(clubs[oppId]?.goals ?? clubs[oppId]?.score ?? 0);
    const isWin = mG > oG, isLoss = mG < oG;
    sGF += mG; sGA += oG; if (isWin) sW++; else if (isLoss) sL++; else sD++;

    const myPlayers = Object.values(m.players?.[myId] || {});
    const oppCnt = Object.keys(m.players?.[oppId] || {}).length;
    if (myPlayers.length > 0) { const obk = myPlayers.length <= 2 ? 2 : myPlayers.length === 3 ? 3 : myPlayers.length === 4 ? 4 : 5; ownBuckets[obk].total++; if (isWin) ownBuckets[obk].w++; }
    if (oppCnt > 0) { const bk = oppCnt <= 2 ? 2 : oppCnt === 3 ? 3 : oppCnt === 4 ? 4 : 5; oppBuckets[bk].total++; if (isWin) oppBuckets[bk].w++; }

    myPlayers.forEach(p => {
      const n = p.playername || p.name || 'Pro', memberMeta = findMemberMeta(n);
      const exactPos = EA_PRO_POS_MAP[String(memberMeta?.proPos ?? '')] || '';
      const normPos = p.pos ? normalizePosition(p.pos) : normalizePosition(memberMeta?.favoritePosition || 'MID');
      const ev = parsePlayerMatchEvents(p, exactPos);

      if (!pMap[n]) pMap[n] = { name:n, normPos, exactPos, games:0, goals:0, assists:0, shots:0, passesMade:0, passAttempts:0, tackles:0, tackleAttempts:0, blocks:0, interceptions:0, skillMoves:0, saves:0, goalsConceded:0, offsides:0, yellows:0, reds:0, cleanSheets:0, ratingSum:0 };
      const u = pMap[n];
      u.games++; u.goals += Number(p.goals || 0); u.assists += Number(p.assists || 0); u.shots += Number(p.shots || 0);
      const pm = Number(p.passesmade || 0), pa = Number(p.passattempts || pm), tm = Number(p.tacklesmade || p.tackles || 0), ta = Number(p.tackleattempts || tm);
      u.passesMade += pm; u.passAttempts += pa; u.tackles += tm; u.tackleAttempts += ta;
      u.blocks += ev.blocks; u.interceptions += ev.interceptions; u.skillMoves += ev.skillMoves; u.saves += ev.saves; u.goalsConceded += ev.goalsConceded || oG;
      u.offsides += ev.offsides; u.yellows += ev.yellowCards; u.reds += ev.redCards; if (oG === 0) u.cleanSheets++; u.ratingSum += parseFloat(p.rating || 7.0);
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

  const arr = Object.values(pMap).map(u => ({ ...u, imp: computePlayerImpactScore(u) })).sort((a, b) => b.imp - a.imp);
  if (arr.length) {
    const mvp = arr[0], liab = arr[arr.length - 1];
    document.getElementById('sessionMvpName').innerText = mvp.name;
    document.getElementById('sessionMvpStats').innerText = formatHolisticPlayerSummary(mvp, false);
    document.getElementById('sessionMvpAvatarBox').innerHTML = renderAvatarWithFlagHtml(mvp.name, 'w-11 h-11', 'border-emerald-400', 'w-4 h-3');
    document.getElementById('sessionLiabilityName').innerText = liab.name;
    document.getElementById('sessionLiabilityStats').innerText = formatHolisticPlayerSummary(liab, arr.length > 1);
    document.getElementById('sessionLiabilityAvatarBox').innerHTML = renderAvatarWithFlagHtml(liab.name, 'w-11 h-11', 'border-rose-400', 'w-4 h-3');
  }

  const bestOwn = [2, 3, 4, 5].map(k => ownBuckets[k]).filter(b => b.total > 0).sort((a, b) => (b.w / b.total) - (a.w / a.total));
  const bestOpp = [2, 3, 4, 5].map(k => oppBuckets[k]).filter(b => b.total > 0).sort((a, b) => (b.w / b.total) - (a.w / a.total));

  document.getElementById('ownPartyModeBadge').innerText = pfx;
  document.getElementById('ownPartySizeGrid').innerHTML = [2, 3, 4, 5].map(k => {
    const ob = ownBuckets[k], op = oppBuckets[k];
    const owp = ob.total > 0 ? `${Math.round((ob.w / ob.total) * 100)}%` : '--';
    const pwp = op.total > 0 ? `${Math.round((op.w / op.total) * 100)}%` : '--';
    return `<div class="flex items-center justify-between text-[10px] bg-gray-950/50 border border-gray-800/80 rounded px-1.5 py-0.5"><span class="text-gray-300 font-bold">${k===5?'5+p':`${k}p`}:</span><span class="font-mono"><b class="text-emerald-400" title="Our Party Size Win %">${owp}</b> <span class="text-gray-600">|</span> <b class="text-sky-400" title="vs Opponent Size Win %">${pwp}</b></span></div>`;
  }).join('');

  const ownTxt = bestOwn.length ? `Best party: ${bestOwn[0].label} (${Math.round((bestOwn[0].w / bestOwn[0].total) * 100)}%)` : '';
  const oppTxt = bestOpp.length ? `Best vs: ${bestOpp[0].label} (${Math.round((bestOpp[0].w / bestOpp[0].total) * 100)}%)` : '';
  document.getElementById('squadFactorVerdict').innerText = [ownTxt, oppTxt].filter(Boolean).join(' • ') || 'Balanced lobby record';
}

async function loadClub(clubId, platform = 'common-gen5', updateHistory = true) {
  document.getElementById('matchesCard')?.classList.add('hidden');
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

    setAppView('dashboard');
    window.scrollTo({ top: 0, behavior: 'smooth' });

    const shameList = computeMatchIntelligence(clubId, GLOBAL_MATCHES);
    const membersList = renderMembers(GLOBAL_MEMBERS);
    renderClub(clubId, combined, platform, membersList, GLOBAL_MATCHES, updateHistory);
    renderSkillRatingGraph(clubId, combined, GLOBAL_MATCHES);
    renderClubReviewReport(combined, membersList, GLOBAL_MATCHES, shameList);
    renderCareerMilestones(membersList);
    buildDynamicPitchTactic(membersList, GLOBAL_MATCHES);
    initRadarComparison(membersList);
    CURRENT_MATCH_FILTER = 'ALL';
    renderRecentMatches(clubId, GLOBAL_MATCHES);
    setStatus('');
  } catch (e) { setStatus(`Error loading stats: ${e.message}`, true); }
}

function renderClub(clubId, data, platform, membersList = [], matchesPayload = [], updateHistory = true) {
  const infoObj = data.info || {}, statObj = data.overall || {}, name = infoObj.name || infoObj.clubName || statObj.name || 'Unknown Club';
  const wins = Number(statObj.wins ?? statObj.overallWins ?? 0);
  const ties = Number(statObj.ties ?? statObj.overallTies ?? 0);
  const losses = Number(statObj.losses ?? statObj.overallLosses ?? 0);
  const totalGames = wins + ties + losses;
  const winPct = totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0;
  const goals = Number(statObj.goals ?? statObj.overallGoals ?? 0);
  const conceded = Number(statObj.goalsAgainst ?? statObj.overallGoalsAgainst ?? 0);
  const rating = statObj.skillRating ?? statObj.rating ?? '--';

  const gDiff = goals - conceded, myMatchClub = matchesPayload[0]?.clubs?.[clubId];
  const crestId = data.crestId || myMatchClub?.crestId || infoObj.customKit?.crestAssetId || infoObj.teamId || '0';

  saveRecentClub(clubId, name, crestId, platform);

  const clubSlug = slugifyClubName(name);
  if (clubSlug) {
    document.title = `${name} | FC Pro Clubs Live Tracker`;
    const newPath = `/${clubSlug}${platform !== 'common-gen5' ? `?platform=${encodeURIComponent(platform)}` : ''}`;
    if (updateHistory && window.location.pathname !== `/${clubSlug}`) window.history.pushState({ view: 'dashboard', clubId, platform, clubName: name }, '', newPath);
  }

  CURRENT_CLUB_CREST_URL = `${API_BASE}/crest/${crestId}?name=${encodeURIComponent(name)}&clubId=${encodeURIComponent(clubId)}&platform=${encodeURIComponent(platform)}`;
  document.getElementById('heroCrestBox').innerHTML = `<img src="${CURRENT_CLUB_CREST_URL}" class="w-full h-full object-contain p-1 drop-shadow" alt="${name}">`;
  document.getElementById('clubName').innerText = name;

  const divShield = document.getElementById('clubDivShieldContainer');
  if (data.division) { divShield.innerHTML = renderDivisionShieldHtml(data.divisionNum ?? data.division, 'lg'); divShield.classList.remove('hidden'); }
  document.getElementById('clubIdentityBar').classList.remove('hidden');

  const reg = data.regionInfo || { name: 'Global Matchmaking', flag: null };
  const regFlagEl = document.getElementById('clubRegionFlag');
  if (reg.flag) {
    regFlagEl.src = `https://flagcdn.com/w40/${reg.flag}.png`;
    regFlagEl.classList.remove('hidden');
  } else {
    regFlagEl.classList.add('hidden');
  }
  document.getElementById('clubRegionName').innerText = reg.name;
  document.getElementById('clubStadiumName').innerText = data.stadiumName || 'Pro Clubs Arena';

  const rep = data.clubRep || { formattedFans: '~6.6M', level: 5, tierTitle: 'Up and Coming' };
  document.getElementById('clubLevelBadgeText').innerText = `Lvl ${rep.level} • ${rep.formattedFans} Fans (${rep.tierTitle})`;

  const kits = data.kits || { home: ['#10b981','#ffffff','#064e3b'], away: ['#1e293b','#38bdf8','#0f172a'], third: ['#f59e0b','#111827','#ffffff'] };
  document.getElementById('clubKitsContainer').innerHTML = `${renderMiniJerseySvg(kits.home,'Home')}<span class="text-gray-700">|</span>${renderMiniJerseySvg(kits.away,'Away')}<span class="text-gray-700">|</span>${renderMiniJerseySvg(kits.third,'3rd')}`;
  if (data.globalRank) { const rb = document.getElementById('globalRankBadge'); rb.innerText = `🌍 ${data.globalRank.label}`; rb.classList.remove('hidden'); }

  if (data.trophies) {
    document.getElementById('trophyBar').classList.remove('hidden');
    document.getElementById('trophyPromos').innerText = data.trophies.promotions ?? 0;
    document.getElementById('trophyRelegs').innerText = data.trophies.relegations ?? 0;
    const pk = data.trophies.bestDivision || data.division || 'Div 5';
    document.getElementById('trophyPeakDivShield').innerHTML = renderDivisionShieldHtml(data.trophies.bestDivisionNum ?? pk, 'sm');
  }

  document.getElementById('clubMeta').innerText = `Club ID: ${clubId} | ${platform.includes('gen5')?'PC / PS5 / XBOX SERIES X|S':platform.toUpperCase()}`;
  document.getElementById('clubRecord').innerText = `${wins} - ${ties} - ${losses}`;
  const wpSub = document.getElementById('clubWinPctSub');
  if (wpSub) wpSub.innerText = `${winPct}% Win • ${totalGames} GP`;
  document.getElementById('skillRating').innerText = rating;
  document.getElementById('goalStats').innerHTML = `${goals}/${conceded} <span class="text-xs text-gray-400 font-normal">(${gDiff>=0?`+${gDiff}`:gDiff})</span>`;
  const gpgSub = document.getElementById('goalPerGameSub');
  if (gpgSub) gpgSub.innerText = `${totalGames > 0 ? (goals / totalGames).toFixed(1) : '0.0'} GF/g • ${totalGames > 0 ? (conceded / totalGames).toFixed(1) : '0.0'} GA/g`;
}

function filterRecentMatches(category) {
  CURRENT_MATCH_FILTER = category;
  ['All','League','Playoff'].forEach(k => {
    const btn = document.getElementById(`btnFilter${k}`);
    if (!btn) return;
    const isAct = (k === 'All' && category === 'ALL') || k === category;
    btn.className = isAct ? 'px-2.5 py-1 rounded text-xs font-black bg-emerald-500 text-black transition shadow' : 'px-2.5 py-1 rounded text-xs font-bold text-gray-300 hover:text-white transition';
  });
  renderRecentMatches(GLOBAL_CLUB_ID, GLOBAL_MATCHES);
}

function renderRecentMatches(clubId, matches) {
  const tbody = document.getElementById('recentMatchesTable'), formContainer = document.getElementById('formBadges');
  const rawArr = Array.isArray(matches) ? matches : (matches?.matches || []);
  const matchArr = CURRENT_MATCH_FILTER === 'ALL'
    ? rawArr.slice(0, 10)
    : rawArr.filter(m => String(m._inferredCategory || 'League').toLowerCase() === CURRENT_MATCH_FILTER.toLowerCase()).slice(0, 10);

  if (!matchArr.length) {
    tbody.innerHTML = `<tr><td colspan="10" class="py-6 text-center text-gray-500">No recent ${CURRENT_MATCH_FILTER === 'ALL' ? '' : CURRENT_MATCH_FILTER} matches found.</td></tr>`;
    return;
  }

  const formList = [];
  rawArr.slice(0, 5).forEach(m => {
    const clubs = m.clubs || m.aggregate || {}, cIds = Object.keys(clubs);
    const thisId = cIds.find(id => String(id) === String(clubId)) || cIds[0], oppId = cIds.find(id => String(id) !== String(clubId)) || cIds[1];
    const myG = Number(clubs[thisId]?.goals ?? clubs[thisId]?.score ?? 0), oppG = Number(clubs[oppId]?.goals ?? clubs[oppId]?.score ?? 0);
    const [fChar, fCol] = myG > oppG ? ['W', 'emerald'] : myG < oppG ? ['L', 'rose'] : ['D', 'yellow'];
    formList.push(`<span class="w-5 h-5 rounded-full bg-${fCol}-500/20 border border-${fCol}-500/40 text-${fCol}-400 text-[10px] font-black flex items-center justify-center">${fChar}</span>`);
  });
  if (formContainer) formContainer.innerHTML = formList.join('');

  tbody.innerHTML = matchArr.map((m, idx) => {
    const clubs = m.clubs || m.aggregate || {}, cIds = Object.keys(clubs);
    const thisId = cIds.find(id => String(id) === String(clubId)) || cIds[0], oppId = cIds.find(id => String(id) !== String(clubId)) || cIds[1];
    const myClub = clubs[thisId] || {}, oppClub = clubs[oppId] || {}, myG = Number(myClub.goals ?? myClub.score ?? 0), oppG = Number(oppClub.goals ?? oppClub.score ?? 0);
    const oppName = oppClub.details?.name || oppClub.name || 'Opponent FC', oppSR = oppClub.skillRating || oppClub.details?.skillRating || null;
    const oppCnt = Object.keys(m.players?.[oppId] || {}).length, playerStats = Object.values(m.players?.[thisId] || {});
    const maxSecs = playerStats.reduce((mx, p) => Math.max(mx, Number(p.secondsPlayed || 0)), 0);
    const isRageQuit = (myG > oppG) && ((maxSecs > 0 && maxSecs < 4100) || (myG - oppG >= 4 && maxSecs < 4800) || Number(oppClub.winnerByDnf || myClub.winnerByDnf || 0) === 1);
    const rqBadge = isRageQuit ? `<span class="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[9px] font-black">💨 RAGE QUIT</span>` : '';

    const chaos = getChaosEmoji(myG, oppG, oppSR);
    const [resLbl, resCls] = myG > oppG ? ['WIN', 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'] : myG < oppG ? ['LOSS', 'bg-rose-500/10 text-rose-400 border-rose-500/20'] : ['DRAW', 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'];

    const ts = Number(m.timestamp || 0), dHours = ts > 0 ? Math.round((Date.now() - ts * 1000) / 3600000) : -1;
    const dateText = (dHours >= 0 && dHours < 24) ? `${Math.max(1, dHours)}h ago` : (ts > 0 ? new Date(ts * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'Recent');
    const mg = computeMatchGradeAndUnitRatings(myG, oppG, playerStats);

    let bestMvp = null, hiScore = -Infinity, matchYellows = 0, matchReds = 0;
    playerStats.forEach(p => {
      const pName = p.playername || p.name || 'Pro', made = Number(p.passesmade || 0), att = Number(p.passattempts || made);
      const tkl = Number(p.tacklesmade || p.tackles || 0), tAtt = Number(p.tackleattempts || tkl), memberMeta = findMemberMeta(pName);
      const exactPos = EA_PRO_POS_MAP[String(memberMeta?.proPos ?? '')] || '';
      const normPos = p.pos ? normalizePosition(p.pos) : normalizePosition(memberMeta?.favoritePosition || 'MID');

      p._passPct = att > 0 ? Math.round((made / att) * 100) : Number(p.passsuccessrate || 0);
      p._made = made; p._att = att; p._ev = parsePlayerMatchEvents(p, exactPos);
      matchYellows += p._ev.yellowCards; matchReds += p._ev.redCards;

      p._inf = computePlayerImpactScore({
        games: 1, normPos, exactPos, ratingSum: parseFloat(p.rating || 7.0),
        goals: Number(p.goals || 0), assists: Number(p.assists || 0), shots: Number(p.shots || 0),
        passesMade: made, passAttempts: att, tackles: tkl, tackleAttempts: tAtt,
        blocks: p._ev.blocks, interceptions: p._ev.interceptions, skillMoves: p._ev.skillMoves,
        saves: p._ev.saves, goalsConceded: p._ev.goalsConceded || oppG,
        offsides: p._ev.offsides, yellows: p._ev.yellowCards, reds: p._ev.redCards, cleanSheets: oppG === 0 ? 1 : 0
      });
      if (p._inf > hiScore) { hiScore = p._inf; bestMvp = pName; }
    });

    matchYellows = Math.max(matchYellows, Number(myClub.yellowcards ?? myClub.yellowCards ?? m.aggregate?.[thisId]?.yellowcards ?? 0));
    matchReds = Math.max(matchReds, Number(myClub.redcards ?? myClub.redCards ?? m.aggregate?.[thisId]?.redcards ?? 0));

    playerStats.sort((a, b) => b._inf - a._inf);
    let crownGiven = false;
    const rowsHtml = playerStats.map(p => {
      const pName = p.playername || p.name || 'Pro', goals = Number(p.goals || 0), assists = Number(p.assists || 0), shots = Number(p.shots || 0);
      const subbed = maxSecs > 600 && Number(p.secondsPlayed || maxSecs) <= maxSecs * 0.78 && p._ev.redCards === 0;
      const subBadge = (subbed && (goals + assists > 0)) ? `<span class="ml-1 px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-400/50 text-[9px] font-black">🦸‍♂️ SUPER-SUB</span>` : (subbed ? `<span class="ml-1 text-[9px] text-gray-400">🔄 Sub</span>` : '');
      let mvpBadge = '--';
      if (!crownGiven && pName === bestMvp && hiScore > -Infinity) { mvpBadge = `<span class="px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-400 border border-yellow-500/40 text-[10px] font-black">👑 MVP</span>`; crownGiven = true; }
      return `<tr class="border-b border-gray-800/60"><td class="py-2 px-2 font-semibold text-white"><div class="flex items-center gap-2">${renderAvatarWithFlagHtml(pName, 'w-6 h-6', 'border-gray-700', 'w-2.5 h-2')}<span>${pName}</span>${subBadge}</div></td><td class="py-2 px-2 text-center font-black text-yellow-400">${parseFloat(p.rating||0).toFixed(1)}</td><td class="py-2 px-2 text-center font-bold text-emerald-400">${goals}</td><td class="py-2 px-2 text-center font-bold text-sky-400">${assists}</td><td class="py-2 px-2 text-center font-mono">${shots} <span class="text-[10px] text-emerald-400">(${shots>0?`${Math.round((goals/shots)*100)}%`:'--'})</span></td><td class="py-2 px-2 text-center font-mono text-cyan-400">${p._att>0?`${p._made}/${p._att} (${p._passPct}%)`:`${p._passPct}%`}</td><td class="py-2 px-2 text-center font-mono text-amber-400">${Math.max(0,p._att-p._made)}</td><td class="py-2 px-2 text-center font-mono text-fuchsia-400">${p._ev.skillMoves}</td><td class="py-2 px-2 text-center text-sky-400" title="${p.tacklesmade||0} Tackles • ${p._ev.blocks} Blocks • ${p._ev.interceptions} Interceptions">${p.tacklesmade||0} <span class="text-[10px] text-gray-400">(${p._ev.blocks+p._ev.interceptions} B/I)</span></td><td class="py-2 px-2 text-center">${renderCardBadgesHtml(p._ev.yellowCards, p._ev.redCards)}</td><td class="py-2 px-2 text-right">${mvpBadge}</td></tr>`;
    }).join('');

    return `<tr onclick="document.getElementById('boxScore_${idx}').classList.toggle('hidden')" class="hover:bg-gray-800/40 transition border-b border-gray-800/60 cursor-pointer"><td class="py-2.5 px-2"><span class="px-2 py-0.5 rounded text-[11px] font-semibold bg-gray-800 text-gray-300 border border-gray-700">${m._inferredCategory||'League'}</span></td><td class="py-2.5 px-2 font-medium text-white"><div class="flex items-center gap-1.5">${renderCrestHtml(oppName, oppClub.crestId||oppClub.TEAM||oppClub.details?.crestAssetId, 'w-6 h-6 sm:w-7 sm:h-7', oppId)}<span>${oppName}</span>${oppCnt>0?`<span class="text-[10px] text-gray-400 font-mono">(${oppCnt}p)</span>`:''}${rqBadge}<i class="fa-solid fa-chevron-down text-[9px] text-gray-500"></i></div></td><td class="py-2.5 px-2 text-center" title="${chaos.label}">${chaos.emoji}</td><td class="py-2.5 px-2 text-center">${renderDivisionShieldHtml(oppClub.division||'Div 5','sm')}</td><td class="py-2.5 px-2 text-center">${oppSR?`<span class="inline-block font-mono font-bold text-xs text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">${oppSR}</span>`:'--'}</td><td class="py-2.5 px-2 text-center font-bold text-white">${myG} - ${oppG}</td><td class="py-2.5 px-2 text-center"><div class="inline-flex items-center gap-1.5"><span class="w-6 h-5 rounded flex items-center justify-center text-[11px] font-black border ${mg.gradeCls}">${mg.grade}</span><span class="text-[10px] font-mono text-emerald-400">A:${mg.atk}</span><span class="text-[10px] font-mono text-sky-400">D:${mg.def}</span></div></td><td class="py-2.5 px-2 text-center">${renderCardBadgesHtml(matchYellows, matchReds)}</td><td class="py-2.5 px-2 text-center"><span class="px-2 py-0.5 rounded text-[11px] font-bold border ${resCls}">${resLbl}</span></td><td class="py-2.5 px-2 text-right text-gray-400 text-xs">${dateText}</td></tr><tr id="boxScore_${idx}" class="hidden bg-gray-900/60 border-b border-gray-800"><td colspan="10" class="p-3"><div class="overflow-x-auto touch-scroll rounded border border-gray-800 bg-gray-950/80"><table class="w-full text-left text-xs whitespace-nowrap"><thead class="bg-gray-900 text-gray-400 uppercase text-[10px]"><tr><th class="py-1.5 px-2">Player</th><th class="py-1.5 px-2 text-center">Rat</th><th class="py-1.5 px-2 text-center">G</th><th class="py-1.5 px-2 text-center">A</th><th class="py-1.5 px-2 text-center">Shots (Conv%)</th><th class="py-1.5 px-2 text-center">Passes</th><th class="py-1.5 px-2 text-center">Missed</th><th class="py-1.5 px-2 text-center">Skills</th><th class="py-1.5 px-2 text-center">Tkl (Blk/Int)</th><th class="py-1.5 px-2 text-center">Cards</th><th class="py-1.5 px-2 text-right">Award</th></tr></thead><tbody>${rowsHtml}</tbody></table></div></td></tr>`;
  }).join('');
}

function getExactPlayerRole(m = {}, mp = {}) {
  const proRole = EA_PRO_POS_MAP[String(m.proPos ?? '')] || '';
  const matchBucket = mp.pos ? normalizePosition(mp.pos) : null;

  if (matchBucket === 'FWD') {
    return ['ST','LS','RS','CF','LW','RW','LF','RF'].includes(proRole) ? proRole : 'ST';
  }
  if (matchBucket === 'MID') {
    return ['CAM','LAM','RAM','CM','LCM','RCM','CDM','LDM','RDM','LM','RM'].includes(proRole) ? proRole : 'CAM';
  }
  if (matchBucket === 'DEF') {
    return ['CB','LCB','RCB','LB','RB','LWB','RWB'].includes(proRole) ? proRole : 'CB';
  }
  if (matchBucket === 'GK') return 'GK';

  if (proRole) return proRole;
  const raw = String(m.favoritePosition || 'MID').toLowerCase();
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
    const name = m.name || 'Player';
    const lm = Object.values(latestPlayersMap).find(lp => String(lp.playername || lp.name || '').toLowerCase().trim() === String(name).toLowerCase().trim());
    const matchNormPos = lm?.pos ? normalizePosition(lm.pos) : null;
    return {
      ...m, _displayName: name, _proNickname: m.proName && m.proName !== name ? `"${m.proName}"` : '',
      _matchNormPos: matchNormPos,
      _exactRole: getExactPlayerRole(m, lm || {}),
      _activeNormPos: CURRENT_PITCH_MODE === 'lastMatch' && matchNormPos ? matchNormPos : m._normalizedPos,
      _buildScore: Number(m.proOverall || 85) * 4 + parseFloat(m.ratingAve || 7.0) * 12,
      _archetype: computeArchetypeAndPlaystyles(m).archetype,
      _lmScore: lm ? 1000 + parseFloat(lm.rating || 0) * 20 : -1,
      _lmRat: lm ? parseFloat(lm.rating || 0) : null,
      _lmGA: lm ? Number(lm.goals || 0) + Number(lm.assists || 0) : 0
    };
  });

  const savedOverride = localStorage.getItem(`clubFormation_${GLOBAL_CLUB_ID || 'default'}`) || 'auto';
  const selectEl = document.getElementById('formationOverrideSelect'); if (selectEl) selectEl.value = savedOverride;

  let tpl = FORMATION_TEMPLATES['4-1-2-1-2'];
  if (savedOverride !== 'auto' && FORMATION_TEMPLATES[savedOverride]) {
    tpl = FORMATION_TEMPLATES[savedOverride];
  } else {
    const rawMatchPlayers = Object.values(latestPlayersMap);
    const actualMatchFwds = rawMatchPlayers.filter(lp => normalizePosition(lp.pos) === 'FWD');

    let maxFwdsRecent5 = actualMatchFwds.length;
    matches.slice(0, 5).forEach(m => {
      const clubs = m.clubs || m.aggregate || {}, cIds = Object.keys(clubs);
      const myId = cIds.find(id => String(id) === String(GLOBAL_CLUB_ID)) || cIds[0];
      const fCnt = Object.values(m.players?.[myId] || {}).filter(lp => normalizePosition(lp.pos) === 'FWD').length;
      if (fCnt > maxFwdsRecent5) maxFwdsRecent5 = fCnt;
    });

    if (actualMatchFwds.length === 2) {
      tpl = FORMATION_TEMPLATES['4-1-2-1-2'];
    } else if (actualMatchFwds.length >= 3) {
      tpl = FORMATION_TEMPLATES['4-3-3 Attack'];
    } else if (actualMatchFwds.length === 1) {
      const squadFwds = scored.filter(m => m._normalizedPos === 'FWD').length;
      tpl = (maxFwdsRecent5 === 2 || squadFwds >= 2) ? FORMATION_TEMPLATES['4-1-2-1-2'] : FORMATION_TEMPLATES['4-2-3-1 Narrow'];
    } else {
      tpl = FORMATION_TEMPLATES['4-1-2-1-2'];
    }
  }

  document.getElementById('formationBadge').innerText = tpl.name;
  document.getElementById('formationSubtitle').innerText = CURRENT_PITCH_MODE === 'lastMatch' ? `Active Lineup from your most recent match vs ${latestOpp} (${Object.keys(latestPlayersMap).length} Human Pros)` : `Suggested Best XI based on Pro OVR, Exact Position (proPos) & Build Attributes`;

  const pool = CURRENT_PITCH_MODE === 'lastMatch' ? scored.filter(m => m._lmScore > 0).sort((a, b) => b._lmScore - a._lmScore) : [...scored].sort((a, b) => b._buildScore - a._buildScore);
  const used = new Set(), assigned = [];

  const claim = (groupPos, slotLabel, fb = true) => {
    let i = pool.findIndex(p => !used.has(p._displayName) && p._activeNormPos === groupPos && p._exactRole === slotLabel);
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
    const shirt = getShirtLabel(name);
    const flagUrl = resolvePlayerFlagUrl(p);
    const flagNode = flagUrl ? `<img src="${flagUrl}" class="absolute -top-0.5 -right-1 w-3.5 h-2.5 sm:w-4 sm:h-3 object-cover rounded-[2px] border border-gray-950 shadow-md z-10" alt="Nation">` : '';

    return `<div onclick="openFutModal('${name.replace(/'/g,"\\'")}')" class="flex flex-col items-center hover:scale-105 transition cursor-pointer group w-[74px] sm:w-24"><div class="relative"><img src="${getPlayerAvatarUrl(name)}" class="w-10 h-10 sm:w-[52px] sm:h-[52px] rounded-full avatar-circle border-2 border-emerald-400 bg-gray-900 object-cover shadow-xl"><span class="absolute -top-1 -left-1.5 bg-gray-950 ${tier.badgeClass} border font-black text-[8px] sm:text-[9px] px-1 rounded z-10">${ovr}</span>${flagNode}<span class="absolute -bottom-1 -left-1.5 bg-yellow-500 text-black font-black text-[8px] sm:text-[9px] px-1 rounded-sm z-10">${rat}</span></div><span class="text-[10px] sm:text-xs font-extrabold text-white mt-1 drop-shadow max-w-[70px] sm:max-w-[96px] truncate" title="${p._proNickname || shirt}">${name}</span><div class="flex items-center gap-0.5 mt-0.5"><span class="text-[8px] sm:text-[9px] bg-black/60 text-emerald-300 px-1 rounded uppercase font-black">${slot || p._exactRole}</span><span class="hidden sm:inline text-[9px] bg-black/60 text-gray-200 px-1 rounded font-semibold truncate max-w-[60px]">${pill}</span></div></div>`;
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

function checkInitialUrlRoute() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('platform')) syncPlatformSelectors(params.get('platform'));
  const rawPath = decodeURIComponent(window.location.pathname || '').replace(/^\/+|\/+$/g, '');

  if (!rawPath || rawPath === 'index.html' || rawPath.startsWith('api/')) {
    goHome(false);
    loadTop10ClubsLeaderboard(CURRENT_LEADERBOARD_MODE);
    return;
  }

  const plat = document.getElementById('platformSelect')?.value || 'common-gen5';
  if (/^\d+$/.test(rawPath)) {
    loadClub(rawPath, plat, false);
  } else {
    handleSearch(rawPath.replace(/-/g, ' ').trim(), true);
  }
}

window.addEventListener('popstate', (e) => {
  if (e.state?.clubId) loadClub(e.state.clubId, e.state.platform || 'common-gen5', false);
  else checkInitialUrlRoute();
});

window.onload = () => {
  applyStoredTheme();
  renderRecentClubsChips();
  loadTop10ClubsLeaderboard('season');
  checkInitialUrlRoute();
};
