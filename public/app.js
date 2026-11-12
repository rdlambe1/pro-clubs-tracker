let CURRENT_LEADERBOARD_MODE = 'season';

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
        <td class="py-2.5 px-2 text-right font-black text-yellow-400"><i class="fa-solid fa-trophy text-[10px] mr-1"></i>${c.titlesWon}</td>
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

function updateRecapMetricsDisplay(clubId, fixtures = [], mode = 'session') {
  const sec = document.getElementById('sessionRecapSection');
  if (!fixtures.length) return sec.classList.add('hidden');
  sec.classList.remove('hidden');

  let sW = 0, sD = 0, sL = 0, sGF = 0, sGA = 0;
  const pMap = {};
  const ownBuckets = { 2:{label:'2 Pros',w:0,total:0}, 3:{label:'3 Pros',w:0,total:0}, 4:{label:'4 Pros',w:0,total:0}, 5:{label:'5+ Pros',w:0,total:0} };
  const oppBuckets = { 2:{label:'vs. 2-Man',w:0,d:0,l:0,total:0}, 3:{label:'vs. 3-Man',w:0,d:0,l:0,total:0}, 4:{label:'vs. 4-Man',w:0,d:0,l:0,total:0}, 5:{label:'vs. 5+ Man',w:0,d:0,l:0,total:0} };

  fixtures.forEach(m => {
    const clubs = m.clubs || m.aggregate || {}, cIds = Object.keys(clubs);
    const myId = cIds.find(id => String(id) === String(clubId)) || cIds[0], oppId = cIds.find(id => String(id) !== String(clubId)) || cIds[1];
    const mG = Number(clubs[myId]?.goals ?? clubs[myId]?.score ?? 0), oG = Number(clubs[oppId]?.goals ?? clubs[oppId]?.score ?? 0);
    const isWin = mG > oG, isLoss = mG < oG;
    sGF += mG; sGA += oG; if (isWin) sW++; else if (isLoss) sL++; else sD++;

    const myPlayers = Object.values(m.players?.[myId] || {});
    const oppCnt = Object.keys(m.players?.[oppId] || {}).length;
    if (myPlayers.length > 0) { const obk = myPlayers.length <= 2 ? 2 : myPlayers.length === 3 ? 3 : myPlayers.length === 4 ? 4 : 5; ownBuckets[obk].total++; if (isWin) ownBuckets[obk].w++; }
    if (oppCnt > 0) { const bk = oppCnt <= 2 ? 2 : oppCnt === 3 ? 3 : oppCnt === 4 ? 4 : 5; oppBuckets[bk].total++; if (isWin) oppBuckets[bk].w++; else if (isLoss) oppBuckets[bk].l++; else oppBuckets[bk].d++; }

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

  const gd = sGF - sGA, pfx = mode === 'session' ? 'Session' : 'Last 10', windowName = mode === 'session' ? 'Latest Session' : `Last ${fixtures.length} Matches`;
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

  document.getElementById('ownPartyModeBadge').innerText = pfx;
  document.getElementById('ownPartySizeGrid').innerHTML = [2, 3, 4, 5].map(k => {
    const b = ownBuckets[k], wp = b.total > 0 ? Math.round((b.w / b.total) * 100) : null;
    const col = wp === null ? 'text-gray-500' : (wp >= 50 ? 'text-emerald-400' : 'text-rose-400');
    return `<div class="flex items-center justify-between text-[11px] bg-gray-950/50 border border-gray-800/80 rounded px-1.5 py-0.5"><span class="text-gray-300 font-bold">${b.label}:</span><span class="font-mono font-black ${col}">${wp !== null ? `${wp}% (${b.w}/${b.total})` : '--'}</span></div>`;
  }).join('');

  const activeParty = [2, 3, 4, 5].map(k => ownBuckets[k]).filter(b => b.total > 0).sort((a, b) => (b.w / b.total) - (a.w / a.total));
  document.getElementById('squadFactorVerdict').innerText = activeParty.length ? `Best synergy: ${activeParty[0].label} (${Math.round((activeParty[0].w / activeParty[0].total) * 100)}% Win)` : 'Balanced squad chemistry';

  document.getElementById('vsOpponentHeaderTitle').innerHTML = `<i class="fa-solid fa-people-arrows text-emerald-400"></i> Performance vs. Opponent Lobby Sizes (${windowName})`;
  document.getElementById('vsOpponentSizeGrid').innerHTML = [2, 3, 4, 5].map(k => {
    const b = oppBuckets[k], wp = b.total > 0 ? Math.round((b.w / b.total) * 100) : null;
    return `<div class="bg-gray-900/60 border border-gray-800 rounded-lg p-2.5 space-y-1"><div class="flex items-center justify-between"><span class="text-[10px] font-black uppercase text-gray-300">${b.label}</span><span class="text-xs font-black ${wp!==null&&wp>=50?'text-emerald-400':'text-gray-300'}">${wp!==null?`${wp}% Win`:'0 GP'}</span></div><div class="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden"><div class="h-full ${wp!==null&&wp>=50?'bg-emerald-500':'bg-rose-500'} rounded-full" style="width:${wp!==null?Math.max(8,wp):0}%"></div></div><div class="text-[10px] font-mono text-gray-400">Record: <b class="text-white">${b.w}W-${b.d}D-${b.l}L</b></div></div>`;
  }).join('');
}

// Generates Skill Rating Graph over Time (Last 10 Matches)
function renderSkillRatingGraph(matches = []) {
  const sec = document.getElementById('srGraphSection'), chartBox = document.getElementById('srChartContainer'), badge = document.getElementById('srTrendBadge');
  if (!sec || !chartBox || !matches.length) { sec?.classList.add('hidden'); return; }
  sec.classList.remove('hidden');

  const historyPoints = [];
  [...matches].reverse().forEach((m, idx) => {
    const clubs = m.clubs || m.aggregate || {}, cIds = Object.keys(clubs);
    const myId = cIds.find(id => String(id) === String(GLOBAL_CLUB_ID)) || cIds[0];
    const myClub = clubs[myId] || {};
    const sr = Number(myClub.skillRating ?? myClub.details?.skillRating ?? 0);
    const myG = Number(myClub.goals ?? myClub.score ?? 0);
    const oppId = cIds.find(id => String(id) !== String(myId)) || cIds[1];
    const oppClub = clubs[oppId] || {};
    const oppG = Number(oppClub.goals ?? oppClub.score ?? 0);
    if (sr > 0) {
      historyPoints.push({ matchIdx: idx + 1, sr, res: myG > oppG ? 'W' : (myG < oppG ? 'L' : 'D') });
    }
  });

  if (historyPoints.length < 2) {
    chartBox.innerHTML = `<span class="text-xs text-gray-500">Not enough historical skill rating points logged in recent matches yet.</span>`;
    badge.className = 'px-2.5 py-0.5 rounded text-[11px] font-black bg-gray-800 text-gray-400';
    badge.innerText = 'STABLE';
    return;
  }

  const srs = historyPoints.map(p => p.sr);
  const minSr = Math.floor(Math.min(...srs) / 25) * 25 - 25;
  const maxSr = Math.ceil(Math.max(...srs) / 25) * 25 + 25;
  const range = Math.max(50, maxSr - minSr);

  const startSr = historyPoints[0].sr, endSr = historyPoints[historyPoints.length - 1].sr, diff = endSr - startSr;
  badge.className = diff > 0 ? 'px-2.5 py-0.5 rounded text-[11px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : diff < 0 ? 'px-2.5 py-0.5 rounded text-[11px] font-black bg-rose-500/20 text-rose-400 border border-rose-500/40' : 'px-2.5 py-0.5 rounded text-[11px] font-black bg-gray-800 text-gray-400';
  badge.innerText = diff > 0 ? `▲ +${diff} SR Trend` : (diff < 0 ? `▼ ${diff} SR Trend` : '⚖️ Flat Trend');

  const w = 650, h = 210, padX = 45, padY = 25;
  const plotW = w - padX * 2, plotH = h - padY * 2;

  const pts = historyPoints.map((pt, i) => {
    const x = padX + (i / (historyPoints.length - 1)) * plotW;
    const y = padY + plotH - ((pt.sr - minSr) / range) * plotH;
    return { x, y, ...pt };
  });

  const pathD = pts.reduce((acc, p, i) => i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`, '');
  const areaD = `${pathD} L ${pts[pts.length - 1].x} ${padY + plotH} L ${pts[0].x} ${padY + plotH} Z`;

  const gridLines = [0, 0.25, 0.5, 0.75, 1].map(ratio => {
    const val = Math.round(minSr + range * (1 - ratio));
    const y = padY + plotH * ratio;
    return `<line x1="${padX}" y1="${y}" x2="${w - padX}" y2="${y}" stroke="#1f2937" stroke-dasharray="3 3"/><text x="${padX - 8}" y="${y + 4}" fill="#64748b" font-size="10" font-family="monospace" text-anchor="end">${val}</text>`;
  }).join('');

  const circles = pts.map(p => {
    const col = p.res === 'W' ? '#10b981' : (p.res === 'L' ? '#f43f5e' : '#f59e0b');
    return `<g class="group cursor-pointer">
      <circle cx="${p.x}" cy="${p.y}" r="5" fill="${col}" stroke="#0b0f19" stroke-width="2"/>
      <circle cx="${p.x}" cy="${p.y}" r="9" fill="${col}" opacity="0.25"/>
      <title>Match #${p.matchIdx}: ${p.sr} SR (${p.res})</title>
    </g>`;
  }).join('');

  chartBox.innerHTML = `<svg viewBox="0 0 ${w} ${h}" class="w-full h-full overflow-visible">
    <defs>
      <linearGradient id="srGlow" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#10b981" stop-opacity="0.35"/>
        <stop offset="100%" stop-color="#10b981" stop-opacity="0.0"/>
      </linearGradient>
    </defs>
    ${gridLines}
    <path d="${areaD}" fill="url(#srGlow)"/>
    <path d="${pathD}" fill="none" stroke="#10b981" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
    ${circles}
  </svg>`;
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
    document.getElementById('shameBoardSubtext').innerText = 'All-Time Club Career Awards & Banter • Hover over any award for details';
    const cList = GLOBAL_MEMBERS.map(m => {
      const name = m.name || m.proName || 'Pro', games = Math.max(1, Number(m.gamesPlayed ?? m.games ?? 1)), goals = Number(m.goals ?? 0), assists = Number(m.assists ?? 0);
      const pm = Number(m.passesMade ?? m.passesmade ?? 0), pPct = Math.max(1, Number(m.passSuccessRate ?? 75)), missedP = Math.max(0, Math.round(pm / (pPct / 100)) - pm);
      const sConv = Math.max(5, Number(m.shotConvRate ?? m.shotSuccessRate ?? 25)), estShots = goals > 0 ? Math.round(goals / (sConv / 100)) : games * 2, missedS = Math.max(0, estShots - goals);
      const tkl = Number(m.tacklesMade ?? m.tacklesmade ?? m.tackles ?? 0), tPct = Math.max(10, Number(m.tackleSuccessRate ?? m.tacklesuccessrate ?? 25)), estTAtt = Math.round(tkl / (tPct / 100));
      const missedTackles = Math.max(0, estTAtt - tkl), reds = Number(m.redCards ?? m.redcards ?? 0), cs = Number(m.totalCleanSheets ?? 0), r10 = RECENT_10_STATS_MAP[name] || {};
      const skills = Math.max(r10.skillMoves || 0, Math.round((r10.games > 0 ? r10.skillMoves / r10.games : ((goals + assists) / games) * 2.2) * games));
      const normPos = normalizePosition(m.favoritePosition || m.pos);
      const exactPos = EA_PRO_POS_MAP[String(m.proPos ?? '')] || '';
      const isAnchor = isDefensiveAnchorRole(normPos, exactPos, (tkl / games) * 1.8, goals / games, estShots / games);
      const careerBlocks = Math.max(r10.blocks || 0, Math.round(r10.games > 0 ? (r10.blocks / r10.games) * games : tkl * (isAnchor ? 0.68 : 0.35) + cs * 0.8));
      const careerInterceptions = Math.max(r10.interceptions || 0, Math.round(r10.games > 0 ? (r10.interceptions / r10.games) * games : tkl * (isAnchor ? 0.85 : 0.40) + cs * 0.6));
      const careerWoodwork = Math.max(r10.woodwork || 0, Math.round(r10.games > 0 && r10.woodwork > 0 ? (r10.woodwork / r10.games) * games : missedS * 0.11));
      return { name, normPos, isAnchor, games, goals, assists, missedP, estShots, missedS, sConv, tkl, tPct, missedTackles, reds, skills, careerBlocks, careerInterceptions, careerWoodwork, allergyScore: estShots - assists * 2.5, superSubGA: r10.superSubGA || 0 };
    });

    const nonFwds = cList.filter(x => x.normPos !== 'FWD' && x.normPos !== 'GK');
    const byInt = (nonFwds.length ? nonFwds : [...cList]).sort((a, b) => b.careerInterceptions - a.careerInterceptions)[0];
    const [bySub, byMeat, byWood, bySkill, byPass, byBarn, byAllergy, byBluetooth, byRed] = [
      [...cList].sort((a, b) => (b.superSubGA * 25 + ((b.goals + b.assists) / b.games) * 10) - (a.superSubGA * 25 + ((a.goals + a.assists) / a.games) * 10))[0],
      [...cList].sort((a, b) => b.careerBlocks - a.careerBlocks)[0],
      [...cList].sort((a, b) => (b.careerWoodwork * 10 + b.missedS * 0.2) - (a.careerWoodwork * 10 + a.missedS * 0.2))[0],
      [...cList].sort((a, b) => b.skills - a.skills)[0],
      [...cList].sort((a, b) => b.missedP - a.missedP)[0],
      [...cList].sort((a, b) => b.missedS - a.missedS)[0],
      [...cList].sort((a, b) => b.allergyScore - a.allergyScore)[0],
      [...cList].sort((a, b) => b.missedTackles - a.missedTackles)[0],
      [...cList].sort((a, b) => (b.reds * 25 + b.tkl * 0.4) - (a.reds * 25 + a.tkl * 0.4))[0]
    ];

    cards = [
      { title: '📡 All-Time Interceptor (Run-Tracker)', w: byInt.name, st: `~${byInt.careerInterceptions} Interceptions & Recoveries`, sub: `Reading lanes & cutting out through-balls (${byInt.games} GP)`, b: 'border-sky-500/40', c: 'text-sky-400' },
      { title: '🥩 All-Time Meat Wall (Blocks)', w: byMeat.name, st: `~${byMeat.careerBlocks} Career Body Blocks`, sub: `Putting face, ribs & shins in the firing line (${byMeat.games} GP)`, b: 'border-orange-500/40', c: 'text-orange-400' },
      { title: '🦸‍♂️ All-Time Impact / Super-Sub', w: bySub.name, st: bySub.superSubGA > 0 ? `${bySub.superSubGA} Bench G+A` : `${((bySub.goals+bySub.assists)/bySub.games).toFixed(2)} G+A / Game`, sub: `${bySub.goals}G & ${bySub.assists}A across ${bySub.games} career games`, b: 'border-emerald-500/40', c: 'text-emerald-400' },
      { title: '🪵 All-Time Woodwork Merchant', w: byWood.name, st: `~${byWood.careerWoodwork}x Post & Crossbar`, sub: `Allergic to the net across ${byWood.games} career games`, b: 'border-yellow-500/40', c: 'text-yellow-400' },
      { title: '🌀 All-Time Fidget Spinner', w: bySkill.name, st: `~${bySkill.skills} Career Skill Moves`, sub: `Averaging ${(bySkill.skills/bySkill.games).toFixed(1)} skill beats per match`, b: 'border-fuchsia-500/40', c: 'text-fuchsia-400' },
      { title: '🏥 All-Time Hospital Pass', w: byPass.name, st: `${byPass.missedP} Career Missed Passes`, sub: `Across ${byPass.games} all-time club appearances`, b: 'border-amber-500/40', c: 'text-amber-400' },
      { title: '🚪 All-Time Barn Door Award', w: byBarn.name, st: `${byBarn.missedS} Unconverted Shots`, sub: `${byBarn.goals} goals from ~${byBarn.estShots} shots (${byBarn.sConv}% conv)`, b: 'border-rose-500/40', c: 'text-rose-400' },
      { title: '🚫 All-Time Allergy to Passing', w: byAllergy.name, st: `~${byAllergy.estShots} Shots vs. ${byAllergy.assists} Assists`, sub: 'Pass button is purely decorative', b: 'border-pink-500/40', c: 'text-pink-400' },
      { title: '💨 All-Time Bluetooth Tackler', w: byBluetooth.name, st: `${byBluetooth.missedTackles} Missed Tackles`, sub: `Lunging at thin air (${byBluetooth.tPct}% tackle win rate)`, b: 'border-indigo-500/40', c: 'text-indigo-400' },
      { title: '🟥 All-Time Sunday League Butcher', w: byRed.name, st: byRed.reds > 0 ? `${byRed.reds} Career Red Cards` : `${byRed.tkl} Career Tackles`, sub: `Club enforcer across ${byRed.games} GP`, b: 'border-red-500/40', c: 'text-red-400' }
    ];
  } else if (shameList.length) {
    document.getElementById('shameBoardSubtext').innerText = 'Last 10 Matches Awards & Banter • Hover over any award for details';
    shameList.forEach(i => { i.missedTackles = Math.max(0, i.tackleAtt - i.tackles); i.tackleWinPct = i.tackleAtt > 0 ? Math.round((i.tackles / i.tackleAtt) * 100) : 0; });
    const nonFwds = shameList.filter(x => x.normPos !== 'FWD' && x.normPos !== 'GK');
    const byInt = (nonFwds.length ? nonFwds : [...shameList]).sort((a, b) => (b.interceptions * 10 + b.tackles) - (a.interceptions * 10 + a.tackles))[0];
    const [bySub, byMeat, byWood, bySkill, byPass, byBarn, byAllergy, byBluetooth, byRed] = [
      [...shameList].sort((a, b) => (b.superSubGA * 10 + b.subGames) - (a.superSubGA * 10 + a.subGames))[0],
      [...shameList].sort((a, b) => (b.blocks * 10 + b.tackles) - (a.blocks * 10 + a.tackles))[0],
      [...shameList].sort((a, b) => (b.woodwork * 15 + (b.shots - b.goals)) - (a.woodwork * 15 + (b.shots - b.goals)))[0],
      [...shameList].sort((a, b) => b.skillMoves - a.skillMoves)[0],
      [...shameList].sort((a, b) => b.missedPasses - a.missedPasses)[0],
      [...shameList].sort((a, b) => (b.shots - b.goals) - (a.shots - a.goals))[0],
      [...shameList].sort((a, b) => (b.shots - b.assists * 2.5) - (a.shots - a.assists * 2.5))[0],
      [...shameList].sort((a, b) => b.missedTackles - a.missedTackles)[0],
      [...shameList].sort((a, b) => (b.reds * 15 + b.yellows * 6 + b.tackles * 0.5) - (a.reds * 15 + a.yellows * 6 + a.tackles * 0.5))[0]
    ];

    cards = [
      { title: '📡 The Interceptor (Run-Tracker)', w: byInt.name, st: `${byInt.interceptions} Interceptions & Recoveries`, sub: `Covering runs & cutting passing lanes (${byInt.games}G)`, b: 'border-sky-500/40', c: 'text-sky-400' },
      { title: '🥩 The Meat Wall (Most Blocks)', w: byMeat.name, st: `${byMeat.blocks} Shot & Cross Blocks`, sub: `Human sandbag across ${byMeat.games} recent matches`, b: 'border-orange-500/40', c: 'text-orange-400' },
      { title: '🦸‍♂️ The Super-Sub Award', w: bySub.name, st: bySub.superSubGA > 0 ? `${bySub.superSubGA} G+A off Bench` : `${bySub.subGames} Sub Apps`, sub: 'Mid-match joiner impact (Last 10)', b: 'border-emerald-500/40', c: 'text-emerald-400' },
      { title: '🪵 Woodwork Merchant', w: byWood.name, st: byWood.woodwork > 0 ? `${byWood.woodwork}x Hit Post / Crossbar` : `${Math.max(0, byWood.shots - byWood.goals)} Agonizing Near-Misses`, sub: 'Rattling the frame instead of the net (Last 10)', b: 'border-yellow-500/40', c: 'text-yellow-400' },
      { title: '🌀 Fidget Spinner', w: bySkill.name, st: `${bySkill.skillMoves} Skill Moves`, sub: `${bySkill.dribblesCompleted} dribbles completed (Last 10)`, b: 'border-fuchsia-500/40', c: 'text-fuchsia-400' },
      { title: '🏥 Hospital Pass Award', w: byPass.name, st: `${byPass.missedPasses} Missed Passes`, sub: `Across ${byPass.games} recent appearances`, b: 'border-amber-500/40', c: 'text-amber-400' },
      { title: '🚪 The Barn Door Award', w: byBarn.name, st: `${byBarn.shots} Shots (${byBarn.goals}G)`, sub: `${byBarn.shots>0?Math.round((byBarn.goals/byBarn.shots)*100):0}% shot conversion in last 10`, b: 'border-rose-500/40', c: 'text-rose-400' },
      { title: '🚫 The Allergy to Passing Award', w: byAllergy.name, st: `${byAllergy.shots} Shots vs. ${byAllergy.assists} Assists`, sub: 'Pass button is purely decorative (Last 10)', b: 'border-pink-500/40', c: 'text-pink-400' },
      { title: '💨 The Bluetooth Tackler Award', w: byBluetooth.name, st: `${byBluetooth.missedTackles} Missed Tackles`, sub: `Lunging at thin air (${byBluetooth.tackleWinPct}% tackle win rate)`, b: 'border-indigo-500/40', c: 'text-indigo-400' },
      { title: '🟥 Sunday League Butcher', w: byRed.name, st: (byRed.reds > 0 || byRed.yellows > 0) ? `${byRed.yellows}🟨 ${byRed.reds}🟥 Cards` : `${byRed.tackles} Tackles Won`, sub: 'Midfield enforcer in last 10', b: 'border-red-500/40', c: 'text-red-400' }
    ];
  }

  document.getElementById('shameBoardGrid').innerHTML = cards.map(c => `<div title="${c.sub}" class="group relative bg-gray-900/60 border ${c.b} rounded-xl p-3.5 flex items-center justify-between hover:bg-gray-800/60 transition cursor-help"><div class="min-w-0 pr-2"><div class="text-[10px] font-black uppercase text-gray-400 truncate">${c.title}</div><div class="text-sm font-extrabold text-white mt-0.5 truncate">${c.w}</div><div class="text-xs font-bold ${c.c} mt-0.5">${c.st}</div></div>${renderAvatarWithFlagHtml(c.w, 'w-11 h-11', 'border-gray-700', 'w-4 h-3')}<div class="pointer-events-none absolute -top-2 left-1/2 -translate-x-1/2 -translate-y-full hidden group-hover:block bg-gray-950 text-gray-200 border border-gray-700 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold shadow-2xl whitespace-nowrap z-30">${c.sub}</div></div>`).join('');
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
  document.getElementById('milestonesGrid').innerHTML = items.sort((a, b) => b.pct - a.pct).slice(0, 4).map(i => `<div class="bg-gray-900/60 border border-gray-800 rounded-xl p-3.5 space-y-2"><div class="flex items-center justify-between"><div class="flex items-center gap-2 min-w-0">${renderAvatarWithFlagHtml(i.name, 'w-8 h-8', 'border-gray-700', 'w-3 h-2')}<div class="min-w-0"><div class="text-xs font-extrabold text-white truncate">${i.name}</div><div class="text-[10px] font-bold text-gray-400"><i class="fa-solid ${i.ic} mr-1"></i>${i.cat}</div></div></div><span class="text-xs font-black text-white font-mono">${i.cur}/${i.target}</span></div><div class="w-full h-2 bg-gray-800 rounded-full overflow-hidden"><div class="h-full ${i.bg} rounded-full" style="width:${Math.min(100,i.pct)}%"></div></div><div class="text-[10px] text-gray-400">Only <b class="text-white">${i.rem}</b> away from <b class="text-emerald-400">${i.target}</b>!</div></div>`).join('');
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
    renderClubReviewReport(combined, membersList, GLOBAL_MATCHES, shameList);
    renderSeasonsHistory(combined.seasonsHistory, combined.trophies);
    renderCareerMilestones(membersList);
    buildDynamicPitchTactic(membersList, GLOBAL_MATCHES);
    initRadarComparison(membersList);
    renderRecentMatches(clubId, GLOBAL_MATCHES);
    renderSkillRatingGraph(GLOBAL_MATCHES);
    setStatus('');
  } catch (e) { setStatus(`Error loading stats: ${e.message}`, true); }
}

function renderClub(clubId, data, platform, membersList = [], matchesPayload = [], updateHistory = true) {
  const infoObj = data.info || {}, statObj = data.overall || {}, name = infoObj.name || infoObj.clubName || statObj.name || 'Unknown Club';
  const wins = statObj.wins ?? statObj.overallWins ?? 0, ties = statObj.ties ?? statObj.overallTies ?? 0, losses = statObj.losses ?? statObj.overallLosses ?? 0;
  const goals = statObj.goals ?? statObj.overallGoals ?? 0, conceded = statObj.goalsAgainst ?? statObj.overallGoalsAgainst ?? 0, rating = statObj.skillRating ?? statObj.rating ?? '--';

  const gDiff = Number(goals) - Number(conceded), myMatchClub = matchesPayload[0]?.clubs?.[clubId];
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
  document.getElementById('clubLevelBadgeText').innerText = `Lvl ${rep.level} • ${rep.formattedFans} Fans`;

  const kits = data.kits || { home: ['#10b981','#ffffff','#064e3b'], away: ['#1e293b','#38bdf8','#0f172a'], third: ['#f59e0b','#111827','#ffffff'] };
  document.getElementById('clubKitsContainer').innerHTML = `${renderMiniJerseySvg(kits.home,'Home')}<span class="text-gray-700">|</span>${renderMiniJerseySvg(kits.away,'Away')}<span class="text-gray-700">|</span>${renderMiniJerseySvg(kits.third,'3rd')}`;
  if (data.globalRank) { const rb = document.getElementById('globalRankBadge'); rb.innerText = `🌍 ${data.globalRank.label}`; rb.classList.remove('hidden'); }

  if (data.trophies) {
    document.getElementById('trophyBar').classList.remove('hidden');
    document.getElementById('trophyTitles').innerText = data.trophies.titlesWon ?? 0;
    document.getElementById('trophyLeagues').innerText = data.trophies.leaguesWon ?? 0;
    document.getElementById('trophyPromos').innerText = data.trophies.promotions ?? 0;
    document.getElementById('trophyRelegs').innerText = data.trophies.relegations ?? 0;
    document.getElementById('trophyFansText').innerText = `${rep.formattedFans} Fans`;
    document.getElementById('trophyRepSubtext').innerText = `Lvl ${rep.level} • ${rep.tierTitle}`;
    const pk = data.trophies.bestDivision || data.division || 'Div 5';
    document.getElementById('trophyPeakDivShield').innerHTML = renderDivisionShieldHtml(data.trophies.bestDivisionNum ?? pk, 'md');
  }

  document.getElementById('clubMeta').innerText = `Club ID: ${clubId} | ${platform.includes('gen5')?'PC / PS5 / XBOX SERIES X|S':platform.toUpperCase()}`;
  document.getElementById('clubRecord').innerText = `${wins} - ${ties} - ${losses}`;
  document.getElementById('skillRating').innerText = rating;
  document.getElementById('goalStats').innerHTML = `${goals}/${conceded} <span class="text-xs text-gray-400 font-normal">(${gDiff>=0?`+${gDiff}`:gDiff})</span>`;
}
