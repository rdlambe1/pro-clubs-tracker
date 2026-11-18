let CURRENT_LEADERBOARD_MODE = 'season';
let CURRENT_MATCH_FILTER = 'ALL';
let LATEST_POSTER_STATE = null;

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
  const bS = document.getElementById('btnLbSeason'), bA = document.getElementById('btnLbAllTime');
  if (bS) bS.className = mode === 'season' ? 'px-3 py-1 rounded text-xs font-black bg-emerald-500 text-black transition shadow' : 'px-3 py-1 rounded text-xs font-bold text-gray-300 hover:text-white transition';
  if (bA) bA.className = mode === 'allTime' ? 'px-3 py-1 rounded text-xs font-black bg-emerald-500 text-black transition shadow' : 'px-3 py-1 rounded text-xs font-bold text-gray-300 hover:text-white transition';
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

// 2-Tab Navigation Switcher (Team Overview & Squad/Banter)
function switchDashboardTab(tabKey) {
  ACTIVE_TAB = tabKey === 'players' ? 'players' : 'team';
  const borders = {
    team: 'border-emerald-500 bg-emerald-500/10 shadow-lg',
    players: 'border-sky-500 bg-sky-500/10 shadow-lg'
  };
  ['team', 'players'].forEach(k => {
    const pane = document.getElementById(`tabPane_${k}`);
    const btn = document.getElementById(`tabBtn_${k}`);
    if (pane) pane.classList.toggle('hidden', k !== ACTIVE_TAB);
    if (btn) {
      btn.className = k === ACTIVE_TAB
        ? `card p-3 sm:p-4 flex items-center justify-center gap-2.5 sm:gap-3.5 border-2 ${borders[k]} transition group cursor-pointer`
        : `card p-3 sm:p-4 flex items-center justify-center gap-2.5 sm:gap-3.5 border border-gray-800 hover:border-gray-700 transition group cursor-pointer opacity-75 hover:opacity-100`;
    }
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

// Generates a concise, accurate 1-line tactical/banter verdict for each player's session performance
function buildPlayerSessionMiniReport(u = {}, rankIdx = 0, totalPlayers = 1) {
  const g = Math.max(1, Number(u.games || 1));
  const avgRat = +(u.ratingSum / g).toFixed(1);
  const pPct = u.passAttempts > 0 ? Math.round((u.passesMade / u.passAttempts) * 100) : 78;
  const conv = u.shots > 0 ? Math.round((u.goals / u.shots) * 100) : 0;
  const defActions = (u.tackles || 0) + (u.interceptions || 0) + (u.blocks || 0);
  const ga = (u.goals || 0) + (u.assists || 0);
  const missedS = Math.max(0, (u.shots || 0) - (u.goals || 0));

  let verdict = 'Solid Shift';
  let vCol = 'text-sky-400';
  let hexCol = '#38bdf8';

  if (u.reds > 0) {
    verdict = `Walking Red Card (${u.reds}🟥 & ${u.missedPasses} Turnovers)`;
    vCol = 'text-rose-400'; hexCol = '#fb7185';
  } else if (rankIdx === 0 && ga >= g && avgRat >= 8.0) {
    verdict = u.goals >= u.assists ? `Clinical Carry (${ga} G+A, ${pPct}% Pass)` : `Maestro Pulling Strings (${u.assists}A, ${pPct}% Pass)`;
    vCol = 'text-emerald-400'; hexCol = '#34d399';
  } else if (u.normPos === 'GK' || u.saves >= 3) {
    verdict = `Shot-Stopper (${u.saves} Saves, ${u.cleanSheets} CS)`;
    vCol = 'text-teal-400'; hexCol = '#2dd4bf';
  } else if (u.goals >= g && conv >= 30) {
    verdict = `Lethal Finisher (${conv}% Shot Conv)`;
    vCol = 'text-emerald-400'; hexCol = '#34d399';
  } else if (u.assists >= g) {
    verdict = `Chief Creator (${u.assists} Assists, ${pPct}% Pass)`;
    vCol = 'text-emerald-400'; hexCol = '#34d399';
  } else if (defActions >= g * 3) {
    verdict = `Midfield Destroyer (${u.tackles} Tkl, ${u.interceptions + u.blocks} Int/Blk)`;
    vCol = 'text-sky-400'; hexCol = '#38bdf8';
  } else if (pPct >= 85 && u.passesMade >= g * 12) {
    verdict = `Metronome (${pPct}% Pass Accuracy)`;
    vCol = 'text-cyan-400'; hexCol = '#22d3ee';
  } else if (missedS >= g * 2.5 && u.goals === 0) {
    verdict = `Barn Door (${u.shots} Shots, 0 Goals)`;
    vCol = 'text-amber-400'; hexCol = '#fbbf24';
  } else if (u.missedPasses >= g * 6.5 || pPct < 70) {
    verdict = `Hospital Pass Merchant (${u.missedPasses} Turnovers)`;
    vCol = 'text-rose-400'; hexCol = '#fb7185';
  } else if (rankIdx === totalPlayers - 1 && totalPlayers > 1 && avgRat < 7.2) {
    verdict = `Quiet Passenger (${u.missedPasses} Turnovers)`;
    vCol = 'text-rose-400'; hexCol = '#fb7185';
  } else if (avgRat >= 7.8) {
    verdict = `All-Action Engine (${pPct}% Pass, ${defActions} Def)`;
    vCol = 'text-emerald-400'; hexCol = '#34d399';
  } else {
    verdict = `Steady Shift (${pPct}% Pass, ${u.tackles} Tkl)`;
    vCol = 'text-gray-300'; hexCol = '#cbd5e1';
  }

  const statLine = u.normPos === 'GK' || u.saves > 0
    ? `${u.saves} Sv • ${u.cleanSheets} CS • ${pPct}% Pass`
    : `${u.goals}G • ${u.assists}A • ${pPct}% Pass • ${u.tackles} Tkl`;

  return {
    name: u.name,
    games: g,
    avgRat: avgRat.toFixed(1),
    mvpCrowns: u.mvpCrowns || 0,
    poopCount: u.poopCount || 0,
    statLine,
    verdict,
    vCol,
    hexCol
  };
}

function drawCanvasRoundRect(ctx, x, y, w, h, r) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.lineTo(x + w - rad, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rad);
  ctx.lineTo(x + w, y + h - rad);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
  ctx.lineTo(x + rad, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rad);
  ctx.lineTo(x, y + rad);
  ctx.quadraticCurveTo(x, y, x + rad, y);
  ctx.closePath();
}

function loadImageAsync(url) {
  return new Promise((resolve) => {
    if (!url) return resolve(null);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

// Native 2x Retina HTML5 Canvas Poster Renderer (Dynamically scales height to fit every player's mini-report cleanly)
async function buildNativeSessionPosterCanvas(st) {
  const reports = (st.playerReports || []).slice(0, 8);
  const repRowH = 68;
  const repBoxH = reports.length ? (56 + reports.length * repRowH) : 0;
  const W = 750;
  const H = 1044 + (repBoxH > 0 ? repBoxH + 18 : 0);

  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');

  // 1. True Alpha Rounded Outer Mask
  drawCanvasRoundRect(ctx, 2, 2, W - 4, H - 4, 38);
  ctx.save();
  ctx.clip();

  // Background radial gradient
  const bgGrad = ctx.createRadialGradient(W / 2, 0, 20, W / 2, 0, 900);
  bgGrad.addColorStop(0, '#1e293b');
  bgGrad.addColorStop(0.75, '#0b111e');
  bgGrad.addColorStop(1, '#090d16');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  // Outer Border Rim
  drawCanvasRoundRect(ctx, 3, 3, W - 6, H - 6, 37);
  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(16, 185, 129, 0.55)';
  ctx.stroke();

  // Preload Crest, MVP/Passenger images, and all Squad Report Avatars + Flags in parallel
  const [crestImg, mvpAvImg, mvpFlImg, liabAvImg, liabFlImg, ...repAssets] = await Promise.all([
    loadImageAsync(st.crestUrl),
    loadImageAsync(st.mvp ? getPlayerAvatarUrl(st.mvp.name, true) : null),
    loadImageAsync(st.mvp ? resolvePlayerFlagUrl(st.mvp.name) : null),
    loadImageAsync(st.liab ? getPlayerAvatarUrl(st.liab.name, true) : null),
    loadImageAsync(st.liab ? resolvePlayerFlagUrl(st.liab.name) : null),
    ...reports.flatMap(r => [
      loadImageAsync(getPlayerAvatarUrl(r.name, false)),
      loadImageAsync(resolvePlayerFlagUrl(r.name))
    ])
  ]);

  // 2. Header Section
  drawCanvasRoundRect(ctx, 34, 32, 92, 92, 20);
  ctx.fillStyle = '#111827';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#334155';
  ctx.stroke();
  if (crestImg) ctx.drawImage(crestImg, 42, 40, 76, 76);

  ctx.font = '900 15px Inter, sans-serif';
  const modeW = Math.ceil(ctx.measureText(st.modeLabel).width) + 26;
  drawCanvasRoundRect(ctx, 142, 32, modeW, 30, 8);
  ctx.fillStyle = '#fbbf24';
  ctx.fill();
  ctx.fillStyle = '#0b0f19';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  ctx.fillText(st.modeLabel, 142 + modeW / 2, 47);

  const tiltX = 142 + modeW + 12;
  const tiltW = Math.ceil(ctx.measureText(st.tiltText).width) + 28;
  drawCanvasRoundRect(ctx, tiltX, 32, tiltW, 30, 15);
  ctx.fillStyle = st.tiltBg;
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = st.tiltBorder;
  ctx.stroke();
  ctx.fillStyle = st.tiltColor;
  ctx.fillText(st.tiltText, tiltX + tiltW / 2, 47);

  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffffff';
  ctx.font = '900 36px Inter, sans-serif';
  ctx.fillText(st.clubName.length > 20 ? st.clubName.substring(0, 19) + '…' : st.clubName, 142, 86);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '600 19px Inter, sans-serif';
  ctx.fillText(`${st.dateStr} • Division ${st.divNum} Telemetry`, 142, 115);

  // Division Shield
  const shX = W - 72, shY = 78;
  ctx.beginPath();
  ctx.moveTo(shX, shY - 36);
  ctx.lineTo(shX + 30, shY - 24);
  ctx.lineTo(shX + 30, shY + 6);
  ctx.quadraticCurveTo(shX + 30, shY + 28, shX, shY + 38);
  ctx.quadraticCurveTo(shX - 30, shY + 28, shX - 30, shY + 6);
  ctx.lineTo(shX - 30, shY - 24);
  ctx.closePath();
  ctx.fillStyle = '#1e293b';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#eab308';
  ctx.stroke();
  ctx.fillStyle = '#facc15';
  ctx.textAlign = 'center';
  ctx.font = '900 11px Inter, sans-serif';
  ctx.fillText('DIV', shX, shY - 12);
  ctx.font = '900 24px Oswald, Inter, sans-serif';
  ctx.fillText(String(st.divNum), shX, shY + 11);

  ctx.beginPath();
  ctx.moveTo(34, 144);
  ctx.lineTo(W - 34, 144);
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 2;
  ctx.stroke();

  // 3. Scoreboard Strip
  drawCanvasRoundRect(ctx, 34, 162, W - 68, 126, 22);
  ctx.fillStyle = 'rgba(17, 24, 39, 0.85)';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#1f2937';
  ctx.stroke();

  const colW = (W - 68) / 3;
  [1, 2].forEach(idx => {
    ctx.beginPath();
    ctx.moveTo(34 + colW * idx, 180);
    ctx.lineTo(34 + colW * idx, 270);
    ctx.strokeStyle = '#1f2937';
    ctx.lineWidth = 2;
    ctx.stroke();
  });

  const c1X = 34 + colW * 0.5;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#94a3b8'; ctx.font = '800 16px Inter, sans-serif'; ctx.fillText('RECORD', c1X, 188);
  ctx.fillStyle = '#ffffff'; ctx.font = '900 32px Inter, sans-serif'; ctx.fillText(st.recordStr, c1X, 226);
  ctx.fillStyle = '#38bdf8'; ctx.font = '800 19px monospace'; ctx.fillText(`${st.winPct}% Win Rate`, c1X, 260);

  const c2X = 34 + colW * 1.5;
  ctx.fillStyle = '#94a3b8'; ctx.font = '800 16px Inter, sans-serif'; ctx.fillText('SKILL RATING', c2X, 188);
  ctx.fillStyle = '#34d399'; ctx.font = '900 32px monospace'; ctx.fillText(`${st.curSr} SR`, c2X, 226);
  ctx.fillStyle = st.netSrDelta >= 0 ? '#34d399' : '#fb7185'; ctx.font = '900 19px monospace'; ctx.fillText(st.srDeltaStr, c2X, 260);

  const c3X = 34 + colW * 2.5;
  ctx.fillStyle = '#94a3b8'; ctx.font = '800 16px Inter, sans-serif'; ctx.fillText('GOALS (GD)', c3X, 188);
  ctx.fillStyle = '#ffffff'; ctx.font = '900 32px monospace'; ctx.fillText(st.goalsStr, c3X, 226);
  ctx.fillStyle = '#94a3b8'; ctx.font = '700 18px monospace'; ctx.fillText(st.gpgStr, c3X, 260);

  // 4. Match Momentum & Scoreline Step-Chain
  drawCanvasRoundRect(ctx, 34, 306, W - 68, 198, 22);
  ctx.fillStyle = 'rgba(17, 24, 39, 0.85)';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#1f2937';
  ctx.stroke();

  ctx.textAlign = 'left';
  ctx.fillStyle = '#94a3b8';
  ctx.font = '900 16px Inter, sans-serif';
  ctx.fillText('⚡ SESSION MOMENTUM & SCORELINES', 54, 334);

  if (st.sweetSpotText) {
    ctx.textAlign = 'right';
    ctx.fillStyle = '#38bdf8';
    ctx.font = '800 15px monospace';
    ctx.fillText(st.sweetSpotText.toUpperCase(), W - 54, 334);
  }

  const matches = st.matchLogChrono || [];
  if (matches.length) {
    const plotL = 75, plotR = W - 75, plotT = 376, plotB = 456;
    const plotW = plotR - plotL, plotH = plotB - plotT;
    let level = 0;
    const levels = matches.map(m => {
      if (m.resChar === 'W') level += 1;
      else if (m.resChar === 'L') level -= 1;
      return level;
    });
    const minL = Math.min(-1, ...levels), maxL = Math.max(1, ...levels);
    const rangeL = Math.max(2, maxL - minL);

    const pts = matches.map((m, i) => {
      const x = matches.length === 1 ? (plotL + plotR) / 2 : plotL + (i / (matches.length - 1)) * plotW;
      const y = plotB - ((levels[i] - minL) / rangeL) * plotH;
      return { x, y, ...m, idx: i + 1 };
    });

    ctx.beginPath();
    ctx.setLineDash([6, 6]);
    ctx.moveTo(54, (plotT + plotB) / 2);
    ctx.lineTo(W - 54, (plotT + plotB) / 2);
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.setLineDash([]);

    if (pts.length > 1) {
      ctx.beginPath();
      pts.forEach((p, i) => { if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); });
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 5;
      ctx.stroke();
    }

    pts.forEach(p => {
      const col = p.resChar === 'W' ? '#10b981' : (p.resChar === 'L' ? '#f43f5e' : '#f59e0b');
      const bgCol = p.resChar === 'W' ? '#064e3b' : (p.resChar === 'L' ? '#4c0519' : '#451a03');

      const scoreTxt = `${p.score}${p.isRageQuit ? ' 💨' : ''}`;
      ctx.font = '900 16px monospace';
      const sw = Math.max(54, Math.ceil(ctx.measureText(scoreTxt).width) + 18);
      drawCanvasRoundRect(ctx, p.x - sw / 2, p.y - 46, sw, 24, 7);
      ctx.fillStyle = bgCol; ctx.fill();
      ctx.lineWidth = 1.8; ctx.strokeStyle = col; ctx.stroke();
      ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center';
      ctx.fillText(scoreTxt, p.x, p.y - 34);

      ctx.beginPath();
      ctx.arc(p.x, p.y, 17, 0, Math.PI * 2);
      ctx.fillStyle = col; ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = '#0b111e'; ctx.stroke();
      ctx.fillStyle = '#0b111e'; ctx.font = '900 17px Inter, sans-serif';
      ctx.fillText(p.resChar, p.x, p.y + 1);

      const dTxt = p.delta > 0 ? `+${p.delta}` : `${p.delta}`;
      ctx.fillStyle = '#94a3b8'; ctx.font = '800 14px monospace';
      ctx.fillText(`M${p.idx} (${dTxt})`, p.x, p.y + 32);
    });
  }

  // 5. Head-to-Head Spotlight: 👑 MVP vs 💩 PASSENGER
  const cardW = (W - 86) / 2, cardY = 522, cardH = 250;

  const drawSpotlightCard = (x, title, titleCol, borderCol, bgCol, badgeTxt, badgeBg, badgeCol, player, avImg, flImg) => {
    drawCanvasRoundRect(ctx, x, cardY, cardW, cardH, 22);
    ctx.fillStyle = bgCol; ctx.fill();
    ctx.lineWidth = 2.5; ctx.strokeStyle = borderCol; ctx.stroke();

    ctx.textAlign = 'left'; ctx.fillStyle = titleCol; ctx.font = '900 18px Inter, sans-serif';
    ctx.fillText(title, x + 22, cardY + 32);

    if (badgeTxt) {
      ctx.font = '900 15px Inter, sans-serif';
      const bw = Math.ceil(ctx.measureText(badgeTxt).width) + 22;
      drawCanvasRoundRect(ctx, x + cardW - bw - 18, cardY + 17, bw, 28, 8);
      ctx.fillStyle = badgeBg; ctx.fill();
      ctx.lineWidth = 1.5; ctx.strokeStyle = borderCol; ctx.stroke();
      ctx.textAlign = 'center'; ctx.fillStyle = badgeCol;
      ctx.fillText(badgeTxt, x + cardW - bw / 2 - 18, cardY + 31);
    }

    const cx = x + cardW / 2, cy = cardY + 104, rad = 46;
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, rad, 0, Math.PI * 2); ctx.clip();
    if (avImg) ctx.drawImage(avImg, cx - rad, cy - rad, rad * 2, rad * 2);
    ctx.restore();

    ctx.beginPath(); ctx.arc(cx, cy, rad, 0, Math.PI * 2);
    ctx.lineWidth = 4; ctx.strokeStyle = titleCol; ctx.stroke();

    if (flImg) {
      ctx.drawImage(flImg, cx + 18, cy + 22, 30, 21);
      ctx.strokeStyle = '#0b111e'; ctx.lineWidth = 2;
      ctx.strokeRect(cx + 18, cy + 22, 30, 21);
    }

    const pName = player?.name || '--';
    ctx.textAlign = 'center'; ctx.fillStyle = '#ffffff'; ctx.font = '900 26px Inter, sans-serif';
    ctx.fillText(pName.length > 16 ? pName.substring(0, 15) + '…' : pName, cx, cardY + 184);

    ctx.fillStyle = '#e2e8f0'; ctx.font = '700 17px Inter, sans-serif';
    const statLine = player?.summary || '--';
    ctx.fillText(statLine.length > 34 ? statLine.substring(0, 33) + '…' : statLine, cx, cardY + 218);
  };

  drawSpotlightCard(
    34, '👑 MVP', '#34d399', 'rgba(16, 185, 129, 0.45)', 'rgba(6, 78, 59, 0.32)',
    st.mvpBadge, 'rgba(234, 179, 8, 0.22)', '#fde047', st.mvp, mvpAvImg, mvpFlImg
  );

  drawSpotlightCard(
    34 + cardW + 18, '💩 PASSENGER', '#fb7185', 'rgba(244, 63, 94, 0.45)', 'rgba(76, 5, 25, 0.32)',
    st.liabBadge, 'rgba(120, 53, 15, 0.45)', '#fcd34d', st.liab, liabAvImg, liabFlImg
  );

  // 6. Individual Squad Session Report Cards Section
  let nextY = 790;
  if (reports.length) {
    drawCanvasRoundRect(ctx, 34, nextY, W - 68, repBoxH, 22);
    ctx.fillStyle = 'rgba(17, 24, 39, 0.85)'; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = '#1f2937'; ctx.stroke();

    ctx.textAlign = 'left'; ctx.fillStyle = '#94a3b8'; ctx.font = '900 16px Inter, sans-serif';
    ctx.fillText('📋 SQUAD SESSION REPORT CARDS', 54, nextY + 30);

    ctx.textAlign = 'right'; ctx.fillStyle = '#64748b'; ctx.font = '800 14px monospace';
    ctx.fillText('STATS & VERDICT', W - 54, nextY + 30);

    reports.forEach((r, idx) => {
      const ry = nextY + 56 + idx * repRowH;
      const rAv = repAssets[idx * 2];
      const rFl = repAssets[idx * 2 + 1];

      ctx.beginPath();
      ctx.moveTo(54, ry);
      ctx.lineTo(W - 54, ry);
      ctx.strokeStyle = '#1f2937';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Avatar circle
      const acx = 76, acy = ry + 34, arad = 21;
      ctx.save();
      ctx.beginPath(); ctx.arc(acx, acy, arad, 0, Math.PI * 2); ctx.clip();
      if (rAv) ctx.drawImage(rAv, acx - arad, acy - arad, arad * 2, arad * 2);
      ctx.restore();
      ctx.beginPath(); ctx.arc(acx, acy, arad, 0, Math.PI * 2);
      ctx.lineWidth = 2; ctx.strokeStyle = '#334155'; ctx.stroke();

      if (rFl) {
        ctx.drawImage(rFl, acx + 8, acy + 9, 16, 11);
      }

      // Name + Award Icons + GP
      ctx.textAlign = 'left';
      ctx.fillStyle = '#ffffff';
      ctx.font = '900 20px Inter, sans-serif';
      const awards = `${r.mvpCrowns > 0 ? ` ${r.mvpCrowns}x👑` : ''}${r.poopCount > 0 ? ` ${r.poopCount}x💩` : ''}`;
      const dispName = (r.name.length > 15 ? r.name.substring(0, 14) + '…' : r.name) + awards;
      ctx.fillText(dispName, 110, ry + 22);

      // Verdict subline
      ctx.fillStyle = r.hexCol || '#38bdf8';
      ctx.font = '700 15px Inter, sans-serif';
      ctx.fillText(r.verdict, 110, ry + 47);

      // Right side: Rating Badge + Compact Stat Line
      const ratNum = parseFloat(r.avgRat);
      const ratBg = ratNum >= 8.0 ? 'rgba(16, 185, 129, 0.22)' : ratNum < 7.0 ? 'rgba(244, 63, 94, 0.22)' : 'rgba(234, 179, 8, 0.22)';
      const ratCol = ratNum >= 8.0 ? '#34d399' : ratNum < 7.0 ? '#fb7185' : '#facc15';

      drawCanvasRoundRect(ctx, W - 120, ry + 9, 66, 26, 8);
      ctx.fillStyle = ratBg; ctx.fill();
      ctx.lineWidth = 1.5; ctx.strokeStyle = ratCol; ctx.stroke();
      ctx.textAlign = 'center'; ctx.fillStyle = ratCol; ctx.font = '900 17px monospace';
      ctx.fillText(`${r.avgRat}★`, W - 87, ry + 22);

      ctx.textAlign = 'right';
      ctx.fillStyle = '#cbd5e1';
      ctx.font = '700 14px monospace';
      ctx.fillText(r.statLine, W - 54, ry + 48);
    });

    nextY += repBoxH + 18;
  }

  // 7. Highlights & Crimes Box
  const hlH = 172;
  drawCanvasRoundRect(ctx, 34, nextY, W - 68, hlH, 22);
  ctx.fillStyle = 'rgba(17, 24, 39, 0.85)'; ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = '#1f2937'; ctx.stroke();

  (st.highlights || []).slice(0, 3).forEach((h, i) => {
    const rowY = nextY + 36 + i * 50;
    if (i > 0) {
      ctx.beginPath();
      ctx.moveTo(54, rowY - 25);
      ctx.lineTo(W - 54, rowY - 25);
      ctx.strokeStyle = '#1f2937';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    ctx.textAlign = 'left'; ctx.fillStyle = '#cbd5e1'; ctx.font = '700 19px Inter, sans-serif';
    const leftTxt = `${h.icon} ${h.label}: `;
    ctx.fillText(leftTxt, 54, rowY);
    const lw = ctx.measureText(leftTxt).width;
    ctx.fillStyle = '#ffffff'; ctx.font = '900 20px Inter, sans-serif';
    ctx.fillText(h.player, 54 + lw, rowY);

    ctx.textAlign = 'right'; ctx.fillStyle = h.hexCol || '#34d399'; ctx.font = '900 19px monospace';
    ctx.fillText(h.stat, W - 54, rowY);
  });

  // 8. Footer Watermark
  ctx.textAlign = 'left'; ctx.fillStyle = '#34d399'; ctx.font = '900 18px Inter, sans-serif';
  ctx.fillText('🛡️ CLUBSTRACKER', 38, H - 34);

  ctx.textAlign = 'right'; ctx.fillStyle = '#64748b'; ctx.font = '800 15px monospace';
  ctx.fillText('EA SPORTS FC™ OFFICIAL TELEMETRY', W - 38, H - 34);

  ctx.restore();
  return canvas;
}

function applyRoundedCornerMask(sourceCanvas, radiusPx = 40) {
  if (!radiusPx || radiusPx <= 0) return sourceCanvas;
  const w = sourceCanvas.width, h = sourceCanvas.height;
  const out = document.createElement('canvas');
  out.width = w; out.height = h;
  const ctx = out.getContext('2d');
  drawCanvasRoundRect(ctx, 0, 0, w, h, radiusPx);
  ctx.clip();
  ctx.drawImage(sourceCanvas, 0, 0);
  return out;
}

async function shareElementAsPng(elementId, filenamePrefix = 'ClubsTracker', cornerRadiusCssPx = 20) {
  try {
    let finalCanvas = null;
    if (elementId === 'sessionPosterExportTarget' && LATEST_POSTER_STATE) {
      finalCanvas = await buildNativeSessionPosterCanvas(LATEST_POSTER_STATE);
    } else {
      const el = document.getElementById(elementId);
      if (!el || typeof html2canvas === 'undefined') return;
      const scaleFactor = 2;
      const rawCanvas = await html2canvas(el, {
        backgroundColor: null,
        useCORS: true,
        scale: scaleFactor,
        onclone: (clonedDoc) => {
          clonedDoc.querySelectorAll('.ut-modal-scaler').forEach(s => { s.style.transform = 'none'; });
        }
      });
      finalCanvas = cornerRadiusCssPx > 0
        ? applyRoundedCornerMask(rawCanvas, cornerRadiusCssPx * scaleFactor)
        : rawCanvas;
    }

    finalCanvas.toBlob(async (blob) => {
      if (!blob) return;
      const file = new File([blob], `${filenamePrefix}.png`, { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) {
        try { await navigator.share({ files: [file], title: filenamePrefix }); return; } catch (_) {}
      }
      if (navigator.clipboard && window.ClipboardItem) {
        try { await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]); alert('📸 Copied to clipboard!'); return; } catch (_) {}
      }
      const a = document.createElement('a');
      a.download = `${filenamePrefix}.png`;
      a.href = URL.createObjectURL(blob);
      a.click();
    }, 'image/png');
  } catch (e) { console.error(e); }
}

function openSessionPosterModal() {
  const m = document.getElementById('sessionPosterModal');
  if (m) { m.classList.remove('hidden'); m.classList.add('flex'); }
}

function closeSessionPosterModal() {
  const m = document.getElementById('sessionPosterModal');
  if (m) { m.classList.add('hidden'); m.classList.remove('flex'); }
}

function openDiscordModal() {
  document.getElementById('discordModalStatus')?.classList.add('hidden');
  const inp = document.getElementById('discordWebhookInput');
  if (inp) inp.value = localStorage.getItem(`discordWebhook_${GLOBAL_CLUB_ID || 'default'}`) || localStorage.getItem('discordWebhook_default') || '';
  const m = document.getElementById('discordModal');
  if (m) { m.classList.remove('hidden'); m.classList.add('flex'); }
}

function closeDiscordModal() {
  const m = document.getElementById('discordModal');
  if (m) { m.classList.add('hidden'); m.classList.remove('flex'); }
}

async function sendRecapToDiscord() {
  const input = document.getElementById('discordWebhookInput'), status = document.getElementById('discordModalStatus'), btn = document.getElementById('btnSendDiscord');
  const webhookUrl = (input?.value || '').trim();
  if (!webhookUrl) {
    if (status) {
      status.className = 'text-xs px-3 py-2 rounded font-semibold bg-rose-950/80 border border-rose-800 text-rose-200';
      status.innerText = '⚠️ Please paste your Discord Channel Webhook URL first.';
      status.classList.remove('hidden');
    }
    return;
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
    const byRed = [...SHAME_LIST_CACHE].sort((a, b) => (b.reds * 15 + b.yellows * 6 + b.tackles * 0.5) - (a.reds * 15 + a.yellows * 6 + a.tackles * 0.5))[0];

    if (byInt) banter.push({ title: '📡 The Interceptor', winner: byInt.name, stat: `${byInt.interceptions} Int & Recoveries` });
    if (byMeat) banter.push({ title: '🥩 The Meat Wall', winner: byMeat.name, stat: `${byMeat.blocks} Blocks` });
    if (bySub?.superSubGA > 0) banter.push({ title: '🦸‍♂️ Super-Sub', winner: bySub.name, stat: `${bySub.superSubGA} Bench G+A` });
    if (byWood && byWood.woodwork > 0) banter.push({ title: '🪵 Woodwork Merchant', winner: byWood.name, stat: `${byWood.woodwork}x Post & Crossbar` });
    if (bySkill) banter.push({ title: '🌀 Fidget Spinner', winner: bySkill.name, stat: `${bySkill.skillMoves} Skill Moves` });
    if (byPass) banter.push({ title: '🏥 Hospital Pass', winner: byPass.name, stat: `${byPass.missedPasses} Missed Passes` });
    if (byBarn) banter.push({ title: '🚪 Barn Door', winner: byBarn.name, stat: `${byBarn.shots} Shots (${byBarn.goals}G)` });
    if (byRed) banter.push({ title: '🟥 Sunday League Butcher', winner: byRed.name, stat: `${byRed.yellows}🟨 ${byRed.reds}🟥 • ${byRed.tackles} Tackles` });
  }

  if (btn) { btn.disabled = true; btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Sending...`; }
  status?.classList.add('hidden');
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
    if (status) {
      status.className = 'text-xs px-3 py-2 rounded font-semibold bg-emerald-950/80 border border-emerald-700 text-emerald-300';
      status.innerText = '✅ Recap & MVP posted to your Discord server!';
      status.classList.remove('hidden');
    }
    setTimeout(closeDiscordModal, 1400);
  } catch (err) {
    if (status) {
      status.className = 'text-xs px-3 py-2 rounded font-semibold bg-rose-950/80 border border-rose-800 text-rose-200';
      status.innerText = `❌ ${err.message}`;
      status.classList.remove('hidden');
    }
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = `<i class="fa-solid fa-paper-plane"></i> Send Recap Now`; }
  }
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
    const ml = document.getElementById('matchesList');
    if (ml) ml.innerHTML = data.map(c => `<div onclick="document.getElementById('matchesCard').classList.add('hidden');loadClub('${c.id}','${platform}')" class="p-3 rounded bg-gray-800/80 hover:bg-gray-800 border border-gray-700 cursor-pointer flex justify-between items-center transition"><div><div class="font-bold text-white">${c.name}</div><div class="text-xs text-gray-400">ID: ${c.id}</div></div><button class="text-xs bg-emerald-500 text-black font-semibold px-2.5 py-1 rounded">Select</button></div>`).join('');
    document.getElementById('matchesCard')?.classList.remove('hidden');
  } catch (e) { setStatus(`Search failed: ${e.message}`, true); }
}

function switchRecapMode(mode) {
  CURRENT_RECAP_MODE = mode;
  const bS = document.getElementById('btnRecapSession'), bL = document.getElementById('btnRecapLast10');
  if (bS) bS.className = mode === 'session' ? 'px-2.5 py-1 rounded text-xs font-black bg-amber-400 text-black transition shadow' : 'px-2.5 py-1 rounded text-xs font-bold text-gray-300 hover:text-white transition';
  if (bL) bL.className = mode === 'last10' ? 'px-2.5 py-1 rounded text-xs font-black bg-amber-400 text-black transition shadow' : 'px-2.5 py-1 rounded text-xs font-bold text-gray-300 hover:text-white transition';
  updateRecapMetricsDisplay(GLOBAL_CLUB_ID, mode === 'session' ? SESSION_MATCHES_CACHE : GLOBAL_MATCHES.slice(0, 10), mode);
}

// Broadcast Match Momentum & Scoreline Step-Chain SVG (No Opponent Names)
function buildSessionResultsGraphSvg(matchLogChrono = [], isCompactPoster = false) {
  if (!matchLogChrono.length) return '';
  const n = matchLogChrono.length;
  const w = isCompactPoster ? 335 : 640;
  const h = isCompactPoster ? 84 : 78;
  const padL = isCompactPoster ? 32 : 44;
  const padR = isCompactPoster ? 32 : 44;
  const plotT = 26, plotB = h - 22;
  const plotW = w - padL - padR, plotH = Math.max(18, plotB - plotT);

  let lvl = 0;
  const levels = matchLogChrono.map(m => {
    if (m.resChar === 'W') lvl += 1;
    else if (m.resChar === 'L') lvl -= 1;
    return lvl;
  });
  const minL = Math.min(-1, ...levels), maxL = Math.max(1, ...levels);
  const rangeL = Math.max(2, maxL - minL);

  const pts = matchLogChrono.map((item, i) => {
    const cx = n === 1 ? +(w / 2).toFixed(1) : +(padL + (i / (n - 1)) * plotW).toFixed(1);
    const cy = +(plotB - ((levels[i] - minL) / rangeL) * plotH).toFixed(1);
    return { ...item, cx, cy, idx: i + 1 };
  });

  const linePath = pts.length > 1
    ? pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.cx} ${p.cy}`).join(' ')
    : '';
  const areaPath = pts.length > 1
    ? `${linePath} L ${pts[pts.length - 1].cx} ${h - 6} L ${pts[0].cx} ${h - 6} Z`
    : '';

  const nodes = pts.map(p => {
    const col = p.resChar === 'W' ? '#10b981' : (p.resChar === 'L' ? '#f43f5e' : '#f59e0b');
    const bgCol = p.resChar === 'W' ? '#064e3b' : (p.resChar === 'L' ? '#4c0519' : '#451a03');
    const scoreTxt = `${p.score}${p.isRageQuit ? '💨' : ''}`;
    const pillW = isCompactPoster ? (n > 6 ? 26 : 32) : (n > 6 ? 34 : 40);
    const pillH = isCompactPoster ? 13 : 15;
    const r = isCompactPoster ? (n > 7 ? 7.5 : 9) : 10.5;
    const dStr = p.delta > 0 ? `+${p.delta}` : `${p.delta}`;

    return `<g>
      <rect x="${(p.cx - pillW / 2).toFixed(1)}" y="${(p.cy - r - pillH - 3).toFixed(1)}" width="${pillW}" height="${pillH}" rx="4" fill="${bgCol}" stroke="${col}" stroke-width="1.2"/>
      <text x="${p.cx}" y="${(p.cy - r - pillH / 2 - 2.5).toFixed(1)}" fill="#ffffff" font-size="${isCompactPoster ? 8.5 : 9.5}" font-family="monospace" font-weight="900" text-anchor="middle" dominant-baseline="central">${scoreTxt}</text>
      <circle cx="${p.cx}" cy="${p.cy}" r="${r}" fill="${col}" stroke="#0b111e" stroke-width="2"/>
      <text x="${p.cx}" y="${p.cy}" fill="#0b111e" font-size="${isCompactPoster ? 8.5 : 9.5}" font-family="Inter, sans-serif" font-weight="900" text-anchor="middle" dominant-baseline="central">${p.resChar}</text>
      <text x="${p.cx}" y="${(p.cy + r + 10).toFixed(1)}" fill="#94a3b8" font-size="${isCompactPoster ? 7.5 : 8.5}" font-family="monospace" font-weight="800" text-anchor="middle">M${p.idx}(${dStr})</text>
    </g>`;
  }).join('');

  return `<svg viewBox="0 0 ${w} ${h}" class="w-full h-full overflow-visible select-none">
    <defs>
      <linearGradient id="momAreaGrad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#10b981" stop-opacity="0.28"/>
        <stop offset="100%" stop-color="#10b981" stop-opacity="0.0"/>
      </linearGradient>
    </defs>
    <line x1="12" y1="${((plotT + plotB) / 2).toFixed(1)}" x2="${w - 12}" y2="${((plotT + plotB) / 2).toFixed(1)}" stroke="#1e293b" stroke-width="1.2" stroke-dasharray="3 3"/>
    ${areaPath ? `<path d="${areaPath}" fill="url(#momAreaGrad)"/>` : ''}
    ${linePath ? `<path d="${linePath}" fill="none" stroke="#10b981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>` : ''}
    ${nodes}
  </svg>`;
}

// Upgraded Session Recap & Broadcast Poster Engine (Includes Individual Player Mini-Reports)
function updateRecapMetricsDisplay(clubId, fixtures = [], mode = 'session') {
  const sec = document.getElementById('sessionRecapSection');
  if (!sec) return;
  if (!fixtures.length) return sec.classList.add('hidden');
  sec.classList.remove('hidden');

  let sW = 0, sD = 0, sL = 0, sGF = 0, sGA = 0, netSrDelta = 0;
  let runningSr = Number(GLOBAL_COMBINED_DATA?.overall?.skillRating ?? GLOBAL_COMBINED_DATA?.overall?.rating ?? 1500) || 1500;
  const pMap = {};
  const ownBuckets = { 2:{label:'2 Pros',w:0,d:0,l:0,total:0}, 3:{label:'3 Pros',w:0,d:0,l:0,total:0}, 4:{label:'4 Pros',w:0,d:0,l:0,total:0}, 5:{label:'5+ Pros',w:0,d:0,l:0,total:0} };
  const oppBuckets = { 2:{label:'vs 2-Man',w:0,total:0}, 3:{label:'vs 3-Man',w:0,total:0}, 4:{label:'vs 4-Man',w:0,total:0}, 5:{label:'vs 5+ Man',w:0,total:0} };
  const matchLogChrono = [];

  fixtures.forEach(m => {
    const clubs = m.clubs || m.aggregate || {}, cIds = Object.keys(clubs);
    const myId = cIds.find(id => String(id) === String(clubId)) || cIds[0], oppId = cIds.find(id => String(id) !== String(clubId)) || cIds[1];
    const myClub = clubs[myId] || {}, oppClub = clubs[oppId] || {};
    const mG = Number(myClub.goals ?? myClub.score ?? 0), oG = Number(oppClub.goals ?? oppClub.score ?? 0);
    const oppName = oppClub.details?.name || oppClub.name || 'Opponent';
    const oppSr = Number(oppClub.skillRating || oppClub.details?.skillRating || runningSr);
    const isWin = mG > oG, isLoss = mG < oG, isDraw = !isWin && !isLoss;
    const resChar = isWin ? 'W' : (isLoss ? 'L' : 'D');
    sGF += mG; sGA += oG; if (isWin) sW++; else if (isLoss) sL++; else sD++;

    const gdAbs = Math.abs(mG - oG);
    const srDiff = Math.max(-350, Math.min(350, oppSr - runningSr));
    const expected = 1 / (1 + Math.pow(10, srDiff / 400));
    const actual = isWin ? 1 : (isDraw ? 0.5 : 0);
    const gdMult = gdAbs >= 3 ? 1.25 : (gdAbs === 2 ? 1.12 : 1.0);
    let delta = Math.round(28 * gdMult * (actual - expected));
    if (isWin && delta < 8) delta = 12;
    if (isLoss && delta > -8) delta = -12;
    netSrDelta += delta;
    runningSr = Math.max(800, runningSr - delta);

    const myPlayers = Object.values(m.players?.[myId] || {});
    const oppCnt = Object.keys(m.players?.[oppId] || {}).length;
    const maxSecs = myPlayers.reduce((mx, p) => Math.max(mx, Number(p.secondsPlayed || 0)), 0);
    const isRageQuit = isWin && ((maxSecs > 0 && maxSecs < 4100) || (mG - oG >= 4 && maxSecs < 4800) || Number(oppClub.winnerByDnf || myClub.winnerByDnf || 0) === 1);

    matchLogChrono.unshift({ resChar, score: `${mG}-${oG}`, gd: mG - oG, oppName, isRageQuit, delta });

    if (myPlayers.length > 0) {
      const obk = myPlayers.length <= 2 ? 2 : myPlayers.length === 3 ? 3 : myPlayers.length === 4 ? 4 : 5;
      ownBuckets[obk].total++;
      if (isWin) ownBuckets[obk].w++; else if (isDraw) ownBuckets[obk].d++; else ownBuckets[obk].l++;
    }
    if (oppCnt > 0) {
      const bk = oppCnt <= 2 ? 2 : oppCnt === 3 ? 3 : oppCnt === 4 ? 4 : 5;
      oppBuckets[bk].total++;
      if (isWin) oppBuckets[bk].w++;
    }

    let matchBestName = null, matchHi = -Infinity, matchWorstName = null, matchLo = Infinity;

    myPlayers.forEach(p => {
      const n = p.playername || p.name || 'Pro', memberMeta = findMemberMeta(n);
      const exactPos = EA_PRO_POS_MAP[String(memberMeta?.proPos ?? '')] || '';
      const normPos = p.pos ? normalizePosition(p.pos) : normalizePosition(memberMeta?.favoritePosition || 'MID');
      const ev = parsePlayerMatchEvents(p, exactPos);
      const pm = Number(p.passesmade || 0), pa = Number(p.passattempts || pm), tm = Number(p.tacklesmade || p.tackles || 0), ta = Number(p.tackleattempts || tm);

      if (!pMap[n]) pMap[n] = { name:n, normPos, exactPos, games:0, goals:0, assists:0, shots:0, passesMade:0, passAttempts:0, missedPasses:0, tackles:0, tackleAttempts:0, blocks:0, interceptions:0, skillMoves:0, saves:0, goalsConceded:0, offsides:0, yellows:0, reds:0, cleanSheets:0, ratingSum:0, mvpCrowns:0, poopCount:0 };
      const u = pMap[n];
      u.games++; u.goals += Number(p.goals || 0); u.assists += Number(p.assists || 0); u.shots += Number(p.shots || 0);
      u.passesMade += pm; u.passAttempts += pa; u.missedPasses += Math.max(0, pa - pm);
      u.tackles += tm; u.tackleAttempts += ta;
      u.blocks += ev.blocks; u.interceptions += ev.interceptions; u.skillMoves += ev.skillMoves; u.saves += ev.saves; u.goalsConceded += ev.goalsConceded || oG;
      u.offsides += ev.offsides; u.yellows += ev.yellowCards; u.reds += ev.redCards; if (oG === 0) u.cleanSheets++; u.ratingSum += parseFloat(p.rating || 7.0);

      const mImp = computePlayerImpactScore({
        games: 1, normPos, exactPos, ratingSum: parseFloat(p.rating || 7.0),
        goals: Number(p.goals || 0), assists: Number(p.assists || 0), shots: Number(p.shots || 0),
        passesMade: pm, passAttempts: pa, tackles: tm, tackleAttempts: ta,
        blocks: ev.blocks, interceptions: ev.interceptions, skillMoves: ev.skillMoves,
        saves: ev.saves, goalsConceded: ev.goalsConceded || oG,
        offsides: ev.offsides, yellows: ev.yellowCards, reds: ev.redCards, cleanSheets: oG === 0 ? 1 : 0
      });
      if (mImp > matchHi) { matchHi = mImp; matchBestName = n; }
      if (mImp < matchLo) { matchLo = mImp; matchWorstName = n; }
    });

    if (matchBestName && pMap[matchBestName]) pMap[matchBestName].mvpCrowns++;
    if (myPlayers.length > 1 && matchWorstName && matchWorstName !== matchBestName && pMap[matchWorstName]) {
      pMap[matchWorstName].poopCount++;
    }
  });

  const totGames = Math.max(1, sW + sD + sL);
  const winPct = Math.round((sW / totGames) * 100);
  const gd = sGF - sGA, pfx = mode === 'session' ? 'Session' : 'Last 10';

  const rTitle = document.getElementById('recapRecordTitle'), mTitle = document.getElementById('recapMvpTitle'), lTitle = document.getElementById('recapLiabilityTitle');
  const sWin = document.getElementById('sessionTimeWindow'), sRec = document.getElementById('sessionRecordText'), sGd = document.getElementById('sessionGoalDiffText');
  const sWp = document.getElementById('sessionWinPctPill'), srDeltaEl = document.getElementById('sessionSrDeltaBadge');
  if (rTitle) rTitle.innerText = `${pfx} Record`;
  if (mTitle) mTitle.innerText = `👑 ${pfx} MVP`;
  if (lTitle) lTitle.innerText = `💩 ${pfx} Passenger`;
  if (sWin) sWin.innerText = mode === 'session' ? `${fixtures.length} Match Stint` : `Last ${fixtures.length} Matches`;
  if (sRec) sRec.innerText = `${sW}W - ${sD}D - ${sL}L`;
  if (sGd) sGd.innerText = `${sGF} GF / ${sGA} GA (${gd>=0?`+${gd}`:gd} GD)`;
  if (sWp) sWp.innerText = `${winPct}% Win`;

  const srDeltaStr = netSrDelta > 0 ? `▲ +${netSrDelta} SR` : (netSrDelta < 0 ? `▼ ${netSrDelta} SR` : `⚖️ 0 SR`);
  if (srDeltaEl) {
    srDeltaEl.className = netSrDelta > 0
      ? 'px-2 py-0.5 rounded-full text-[10px] font-black font-mono bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
      : netSrDelta < 0
      ? 'px-2 py-0.5 rounded-full text-[10px] font-black font-mono bg-rose-500/20 text-rose-400 border border-rose-500/40'
      : 'px-2 py-0.5 rounded-full text-[10px] font-black font-mono bg-gray-800 text-gray-300 border border-gray-700';
    srDeltaEl.innerText = srDeltaStr;
  }

  const tickerBox = document.getElementById('sessionMatchTicker');
  if (tickerBox) tickerBox.innerHTML = buildSessionResultsGraphSvg(matchLogChrono, false);

  const tb = document.getElementById('sessionTiltBadge');
  const isHighTilt = sL > sW && sL >= 2;
  const isImmaculate = sW > sL;
  const tiltText = isHighTilt ? '🚨 HIGH TILT' : isImmaculate ? '🔥 VIBES IMMACULATE' : '⚖️ MIXED BAG';
  const tiltCls = isHighTilt ? 'px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-500/20 text-rose-400 border border-rose-500/40' : isImmaculate ? 'px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/40';
  if (tb) { tb.className = tiltCls; tb.innerText = tiltText; }

  const arr = Object.values(pMap).map(u => ({ ...u, imp: computePlayerImpactScore(u) })).sort((a, b) => b.imp - a.imp);
  let mvp = null, liab = null;
  if (arr.length) {
    mvp = arr[0]; liab = arr[arr.length - 1];
    mvp.summary = formatHolisticPlayerSummary(mvp, false);
    liab.summary = formatHolisticPlayerSummary(liab, arr.length > 1);

    const mN = document.getElementById('sessionMvpName'), mS = document.getElementById('sessionMvpStats'), mA = document.getElementById('sessionMvpAvatarBox'), mCr = document.getElementById('sessionMvpCrownsBadge');
    const lN = document.getElementById('sessionLiabilityName'), lS = document.getElementById('sessionLiabilityStats'), lA = document.getElementById('sessionLiabilityAvatarBox'), lPp = document.getElementById('sessionPoopCountBadge');
    if (mN) mN.innerText = mvp.name;
    if (mS) mS.innerText = mvp.summary;
    if (mA) mA.innerHTML = renderAvatarWithFlagHtml(mvp.name, 'w-11 h-11', 'border-emerald-400', 'w-4 h-3');
    if (mCr) {
      if (mvp.mvpCrowns > 0) { mCr.innerText = `${mvp.mvpCrowns}x 👑`; mCr.classList.remove('hidden'); }
      else { mCr.classList.add('hidden'); }
    }

    if (lN) lN.innerText = liab.name;
    if (lS) lS.innerText = liab.summary;
    if (lA) lA.innerHTML = renderAvatarWithFlagHtml(liab.name, 'w-11 h-11', 'border-rose-400', 'w-4 h-3');
    if (lPp) {
      if (liab.poopCount > 0) { lPp.innerText = `${liab.poopCount}x 💩`; lPp.classList.remove('hidden'); }
      else { lPp.classList.add('hidden'); }
    }
  }

  // Build Individual Player Mini-Reports for Every Squad Member in the Session
  const playerReports = arr.map((u, idx) => buildPlayerSessionMiniReport(u, idx, arr.length));

  const onPageRepGrid = document.getElementById('sessionPlayerReportsGrid');
  if (onPageRepGrid) {
    onPageRepGrid.innerHTML = playerReports.map(r => {
      const ratNum = parseFloat(r.avgRat);
      const ratCls = ratNum >= 8.0
        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
        : ratNum < 7.0
        ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
        : 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40';
      const badges = `${r.mvpCrowns > 0 ? `<span class="px-1 py-0.2 rounded bg-yellow-500/20 text-yellow-300 text-[9px] font-black">${r.mvpCrowns}x👑</span>` : ''}${r.poopCount > 0 ? `<span class="px-1 py-0.2 rounded bg-amber-900/40 text-amber-300 text-[9px] font-black">${r.poopCount}x💩</span>` : ''}`;

      return `<div onclick="openFutModal('${r.name.replace(/'/g, "\\'")}')" class="bg-gray-900/60 hover:bg-gray-800/60 border border-gray-800 rounded-lg px-3 py-2 flex items-center justify-between gap-2.5 cursor-pointer transition">
        <div class="flex items-center gap-2.5 min-w-0">
          ${renderAvatarWithFlagHtml(r.name, 'w-9 h-9', 'border-gray-700', 'w-3 h-2')}
          <div class="min-w-0">
            <div class="flex items-center gap-1.5">
              <span class="text-xs font-extrabold text-white truncate">${r.name}</span>
              <span class="text-[9px] text-gray-500 font-mono">(${r.games}G)</span>
              ${badges}
            </div>
            <div class="text-[10px] font-bold ${r.vCol} truncate">${r.verdict}</div>
          </div>
        </div>
        <div class="text-right flex-shrink-0">
          <span class="inline-block px-1.5 py-0.5 rounded border text-[11px] font-mono font-black ${ratCls}">${r.avgRat}★</span>
          <div class="text-[9px] font-mono text-gray-400 mt-0.5 whitespace-nowrap">${r.statLine}</div>
        </div>
      </div>`;
    }).join('');
  }

  // Compute 3 Session Highlights & Crimes
  const highlights = [];
  if (arr.length) {
    const topThreat = [...arr].sort((a, b) => (b.goals * 3 + b.assists * 2) - (a.goals * 3 + a.assists * 2))[0];
    const rockPool = arr.length > 1 ? arr.filter(p => p.name !== topThreat.name) : arr;
    const topRock = [...rockPool].sort((a, b) => (b.tackles + b.interceptions + b.blocks) - (a.tackles + a.interceptions + a.blocks))[0] || arr[0];
    const topCrime = [...arr].sort((a, b) => (b.reds * 15 + b.missedPasses + Math.max(0, b.shots - b.goals) * 2) - (a.reds * 15 + a.missedPasses + Math.max(0, a.shots - a.goals) * 2))[0];

    if (topThreat) {
      const conv = topThreat.shots > 0 ? `${Math.round((topThreat.goals / topThreat.shots) * 100)}% Conv` : `${topThreat.games} GP`;
      highlights.push({ icon: '🎯', label: 'Attacking Threat', player: topThreat.name, stat: `${topThreat.goals}G & ${topThreat.assists}A (${conv})`, col: 'text-emerald-400', hexCol: '#34d399', border: 'border-emerald-500/30' });
    }
    if (topRock) {
      highlights.push({ icon: '🧱', label: 'Defensive Rock', player: topRock.name, stat: `${topRock.tackles} Tkl • ${topRock.interceptions + topRock.blocks} Int/Blk`, col: 'text-sky-400', hexCol: '#38bdf8', border: 'border-sky-500/30' });
    }
    if (topCrime) {
      const missedS = Math.max(0, topCrime.shots - topCrime.goals);
      const crimeStat = topCrime.reds > 0
        ? `${topCrime.reds}🟥 Red(s) & ${topCrime.missedPasses} Turnovers`
        : topCrime.missedPasses >= missedS * 2
        ? `${topCrime.missedPasses} Missed Passes`
        : `${missedS} Missed Shots & ${topCrime.missedPasses} Turnovers`;
      highlights.push({ icon: '🚨', label: 'Crime of the Stint', player: topCrime.name, stat: crimeStat, col: 'text-rose-400', hexCol: '#fb7185', border: 'border-rose-500/30' });
    }
  }

  const hlStrip = document.getElementById('sessionHighlightsStrip');
  if (hlStrip) {
    hlStrip.innerHTML = highlights.map(h => `<div class="bg-gray-900/50 border ${h.border} rounded-lg px-3 py-2 flex items-center justify-between gap-2"><div class="min-w-0"><div class="text-[9px] font-black uppercase text-gray-400">${h.icon} ${h.label}</div><div class="text-xs font-extrabold text-white truncate">${h.player}</div></div><span class="text-[11px] font-bold font-mono ${h.col} whitespace-nowrap">${h.stat}</span></div>`).join('');
  }

  const bestOwn = [2, 3, 4, 5].map(k => ownBuckets[k]).filter(b => b.total > 0).sort((a, b) => (b.w / b.total) - (a.w / a.total));
  const worstOpp = [2, 3, 4, 5].map(k => oppBuckets[k]).filter(b => b.total > 0).sort((a, b) => (a.w / a.total) - (b.w / b.total));

  const pBadge = document.getElementById('ownPartyModeBadge'), pGrid = document.getElementById('ownPartySizeGrid'), pVerd = document.getElementById('squadFactorVerdict');
  if (pBadge) pBadge.innerText = 'By Squad Size';
  if (pGrid) {
    pGrid.innerHTML = [2, 3, 4, 5].map(k => {
      const ob = ownBuckets[k];
      const wp = ob.total > 0 ? Math.round((ob.w / ob.total) * 100) : null;
      const col = wp === null ? 'text-gray-500' : (wp >= 50 ? 'text-emerald-400' : 'text-rose-400');
      return `<div class="flex items-center justify-between text-[10px] bg-gray-950/60 border border-gray-800/80 rounded px-2 py-1"><span class="text-gray-300 font-bold">${ob.label}:</span><span class="font-mono font-black ${col}">${wp !== null ? `${wp}% (${ob.w}/${ob.total})` : '--'}</span></div>`;
    }).join('');
  }

  const ownTxt = bestOwn.length ? `Sweet spot: ${bestOwn[0].label} (${Math.round((bestOwn[0].w / bestOwn[0].total) * 100)}% Win)` : '';
  const oppTxt = worstOpp.length ? `Toughest: ${worstOpp[0].label} (${Math.round((worstOpp[0].w / worstOpp[0].total) * 100)}% Win)` : '';
  if (pVerd) pVerd.innerText = [ownTxt, oppTxt].filter(Boolean).join(' • ') || 'Balanced squad size record';

  // Populate Modal Preview & Store State for Native 2x Canvas PNG Exporter
  const cName = GLOBAL_COMBINED_DATA?.info?.name || document.getElementById('clubName')?.innerText || 'Pro Clubs';
  const curSr = GLOBAL_COMBINED_DATA?.overall?.skillRating ?? GLOBAL_COMBINED_DATA?.overall?.rating ?? '--';
  const rawDiv = GLOBAL_COMBINED_DATA?.divisionNum ?? GLOBAL_COMBINED_DATA?.division ?? '5';
  const divNum = String(rawDiv).replace(/[^0-9]/g, '') || '5';
  const latestTs = Number(fixtures[0]?.timestamp || 0);
  const dateStr = latestTs > 0 ? new Date(latestTs * 1000).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) : 'Latest Stint';
  const modeLabel = mode === 'session' ? `${fixtures.length}-MATCH SESSION` : `LAST ${fixtures.length} MATCHES`;
  const mvpBadge = mvp ? (mvp.mvpCrowns > 0 ? `${mvp.mvpCrowns}x 👑` : `${(mvp.ratingSum / mvp.games).toFixed(1)}★`) : '';
  const liabBadge = liab ? (liab.poopCount > 0 ? `${liab.poopCount}x 💩` : `${(liab.ratingSum / liab.games).toFixed(1)}★`) : '';

  LATEST_POSTER_STATE = {
    clubName: cName,
    crestUrl: CURRENT_CLUB_CREST_URL || `${API_BASE}/crest/0?name=FC`,
    divNum,
    dateStr,
    modeLabel,
    tiltText,
    tiltBg: isHighTilt ? 'rgba(244, 63, 94, 0.2)' : isImmaculate ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)',
    tiltBorder: isHighTilt ? 'rgba(244, 63, 94, 0.45)' : isImmaculate ? 'rgba(16, 185, 129, 0.45)' : 'rgba(245, 158, 11, 0.45)',
    tiltColor: isHighTilt ? '#fb7185' : isImmaculate ? '#34d399' : '#fcd34d',
    recordStr: `${sW}W-${sD}D-${sL}L`,
    winPct,
    curSr,
    netSrDelta,
    srDeltaStr,
    goalsStr: `${sGF}-${sGA} (${gd >= 0 ? `+${gd}` : gd})`,
    gpgStr: `${(sGF / totGames).toFixed(1)} GF / ${(sGA / totGames).toFixed(1)} GA`,
    sweetSpotText: ownTxt,
    matchLogChrono,
    mvp,
    liab,
    mvpBadge,
    liabBadge,
    playerReports,
    highlights
  };

  // Update Live Modal Preview DOM
  const pCrest = document.getElementById('posterCrestBox');
  if (pCrest) pCrest.innerHTML = `<img src="${LATEST_POSTER_STATE.crestUrl}" crossorigin="anonymous" class="w-full h-full object-contain" alt="${cName}">`;
  const pMode = document.getElementById('posterModeTag');
  if (pMode) pMode.innerText = modeLabel;
  const pTilt = document.getElementById('posterTiltTag');
  if (pTilt) { pTilt.className = `${tiltCls} poster-safe-text`; pTilt.innerText = tiltText; }
  const pClub = document.getElementById('posterClubName');
  if (pClub) pClub.innerText = cName;
  const pDate = document.getElementById('posterDateSub');
  if (pDate) pDate.innerText = `${dateStr} • Official EA Match Telemetry`;
  const pDiv = document.getElementById('posterDivShield');
  if (pDiv && typeof renderDivisionShieldHtml === 'function') pDiv.innerHTML = renderDivisionShieldHtml(rawDiv, 'sm');

  const pRec = document.getElementById('posterRecord'), pWp = document.getElementById('posterWinPct');
  const pSr = document.getElementById('posterCurrentSr'), pSrD = document.getElementById('posterSrDelta');
  const pGls = document.getElementById('posterGoals'), pGpg = document.getElementById('posterGpg');
  if (pRec) pRec.innerText = LATEST_POSTER_STATE.recordStr;
  if (pWp) pWp.innerText = `${winPct}% Win Rate`;
  if (pSr) pSr.innerText = `${curSr} SR`;
  if (pSrD) {
    pSrD.className = netSrDelta >= 0 ? 'text-[10px] font-black font-mono text-emerald-400 poster-safe-text' : 'text-[10px] font-black font-mono text-rose-400 poster-safe-text';
    pSrD.innerText = srDeltaStr;
  }
  if (pGls) pGls.innerText = LATEST_POSTER_STATE.goalsStr;
  if (pGpg) pGpg.innerText = LATEST_POSTER_STATE.gpgStr;

  const pSweet = document.getElementById('posterLobbySweetSpot');
  if (pSweet) pSweet.innerText = ownTxt;
  const pTicker = document.getElementById('posterMatchTicker');
  if (pTicker) pTicker.innerHTML = buildSessionResultsGraphSvg(matchLogChrono, true);

  if (mvp && liab) {
    const pmAv = document.getElementById('posterMvpAvatar'), pmNm = document.getElementById('posterMvpName'), pmSt = document.getElementById('posterMvpStats'), pmCr = document.getElementById('posterMvpCrowns');
    const ppAv = document.getElementById('posterPoopAvatar'), ppNm = document.getElementById('posterPoopName'), ppSt = document.getElementById('posterPoopStats'), ppCt = document.getElementById('posterPoopCount');
    if (pmAv) pmAv.innerHTML = renderAvatarWithFlagHtml(mvp.name, 'w-12 h-12', 'border-emerald-400', 'w-4 h-3');
    if (pmNm) pmNm.innerText = mvp.name;
    if (pmSt) pmSt.innerText = mvp.summary;
    if (pmCr) pmCr.innerText = mvpBadge;

    if (ppAv) ppAv.innerHTML = renderAvatarWithFlagHtml(liab.name, 'w-12 h-12', 'border-rose-400', 'w-4 h-3');
    if (ppNm) ppNm.innerText = liab.name;
    if (ppSt) ppSt.innerText = liab.summary;
    if (ppCt) ppCt.innerText = liabBadge;
  }

  // Populate Modal Preview Squad Session Report Cards
  const pRepList = document.getElementById('posterPlayerReportsList');
  if (pRepList) {
    pRepList.innerHTML = playerReports.slice(0, 8).map(r => {
      const ratNum = parseFloat(r.avgRat);
      const ratCls = ratNum >= 8.0 ? 'text-emerald-400 bg-emerald-500/15 border-emerald-500/40' : ratNum < 7.0 ? 'text-rose-400 bg-rose-500/15 border-rose-500/40' : 'text-yellow-300 bg-yellow-500/15 border-yellow-500/40';
      const awards = `${r.mvpCrowns > 0 ? ` ${r.mvpCrowns}x👑` : ''}${r.poopCount > 0 ? ` ${r.poopCount}x💩` : ''}`;
      return `<div class="flex items-center justify-between gap-2 border-t border-gray-800/80 pt-1.5 first:border-t-0 first:pt-0">
        <div class="flex items-center gap-2 min-w-0">
          ${renderAvatarWithFlagHtml(r.name, 'w-7 h-7', 'border-gray-700', 'w-2.5 h-2')}
          <div class="min-w-0">
            <div class="text-[11px] font-black text-white poster-safe-text truncate">${r.name}<span class="text-[9px] text-amber-300">${awards}</span></div>
            <div class="text-[9px] font-bold ${r.vCol} poster-safe-text truncate">${r.verdict}</div>
          </div>
        </div>
        <div class="text-right flex-shrink-0">
          <span class="inline-block px-1.5 py-0.2 rounded border text-[10px] font-mono font-black ${ratCls} poster-safe-text">${r.avgRat}★</span>
          <div class="text-[8px] font-mono text-gray-400 poster-safe-text whitespace-nowrap">${r.statLine}</div>
        </div>
      </div>`;
    }).join('');
  }

  const pHl = document.getElementById('posterHighlightsList');
  if (pHl) {
    pHl.innerHTML = highlights.map(h => `<div class="flex items-center justify-between text-[11px] border-b border-gray-800/70 last:border-0 pb-1.5 last:pb-0 poster-safe-text"><span class="text-gray-300 font-bold pr-2 poster-safe-text">${h.icon} ${h.label}: <b class="text-white">${h.player}</b></span><span class="font-mono font-black ${h.col} whitespace-nowrap poster-safe-text">${h.stat}</span></div>`).join('');
  }
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
  const heroBox = document.getElementById('heroCrestBox');
  if (heroBox) heroBox.innerHTML = `<img src="${CURRENT_CLUB_CREST_URL}" class="w-full h-full object-contain p-1 drop-shadow" alt="${name}">`;
  const cNameEl = document.getElementById('clubName');
  if (cNameEl) cNameEl.innerText = name;

  const divShield = document.getElementById('clubDivShieldContainer');
  if (divShield && data.division) { divShield.innerHTML = renderDivisionShieldHtml(data.divisionNum ?? data.division, 'lg'); divShield.classList.remove('hidden'); }
  document.getElementById('clubIdentityBar')?.classList.remove('hidden');

  const reg = data.regionInfo || { name: 'Global Matchmaking', flag: null };
  const regFlagEl = document.getElementById('clubRegionFlag');
  if (regFlagEl) {
    if (reg.flag) {
      regFlagEl.src = `https://flagcdn.com/w40/${reg.flag}.png`;
      regFlagEl.classList.remove('hidden');
    } else {
      regFlagEl.classList.add('hidden');
    }
  }
  const regNameEl = document.getElementById('clubRegionName');
  if (regNameEl) regNameEl.innerText = reg.name;
  const stadEl = document.getElementById('clubStadiumName');
  if (stadEl) stadEl.innerText = data.stadiumName || 'Pro Clubs Arena';

  const rep = data.clubRep || { level: 5, tierTitle: 'Up and Coming' };
  const lvlEl = document.getElementById('clubLevelBadgeText');
  if (lvlEl) lvlEl.innerText = `Lvl ${rep.level} • ${rep.tierTitle}`;

  const kits = data.kits || { home: ['#10b981','#ffffff','#064e3b'], away: ['#1e293b','#38bdf8','#0f172a'], third: ['#f59e0b','#111827','#ffffff'] };
  const kitsBox = document.getElementById('clubKitsContainer');
  if (kitsBox) kitsBox.innerHTML = `${renderMiniJerseySvg(kits.home,'Home')}<span class="text-gray-700">|</span>${renderMiniJerseySvg(kits.away,'Away')}<span class="text-gray-700">|</span>${renderMiniJerseySvg(kits.third,'3rd')}`;
  if (data.globalRank) {
    const rb = document.getElementById('globalRankBadge');
    if (rb) { rb.innerText = `🌍 ${data.globalRank.label}`; rb.classList.remove('hidden'); }
  }

  if (data.trophies) {
    document.getElementById('trophyBar')?.classList.remove('hidden');
    const tP = document.getElementById('trophyPromos'), tR = document.getElementById('trophyRelegs'), tPk = document.getElementById('trophyPeakDivShield');
    if (tP) tP.innerText = data.trophies.promotions ?? 0;
    if (tR) tR.innerText = data.trophies.relegations ?? 0;
    const pk = data.trophies.bestDivision || data.division || 'Div 5';
    if (tPk) tPk.innerHTML = renderDivisionShieldHtml(data.trophies.bestDivisionNum ?? pk, 'sm');
  }

  const cMeta = document.getElementById('clubMeta'), cRec = document.getElementById('clubRecord'), wpSub = document.getElementById('clubWinPctSub');
  const sRat = document.getElementById('skillRating'), gSt = document.getElementById('goalStats'), gpgSub = document.getElementById('goalPerGameSub');
  if (cMeta) cMeta.innerText = `Club ID: ${clubId} | ${platform.includes('gen5')?'PC / PS5 / XBOX SERIES X|S':platform.toUpperCase()}`;
  if (cRec) cRec.innerText = `${wins} - ${ties} - ${losses}`;
  if (wpSub) wpSub.innerText = `${winPct}% Win • ${totalGames} GP`;
  if (sRat) sRat.innerText = rating;
  if (gSt) gSt.innerHTML = `${goals}/${conceded} <span class="text-xs text-gray-400 font-normal">(${gDiff>=0?`+${gDiff}`:gDiff})</span>`;
  if (gpgSub) gpgSub.innerText = `${totalGames > 0 ? (goals / totalGames).toFixed(1) : '0.0'} GF/g • ${totalGames > 0 ? (conceded / totalGames).toFixed(1) : '0.0'} GA/g`;

  if (typeof updateRecapMetricsDisplay === 'function') {
    updateRecapMetricsDisplay(clubId, CURRENT_RECAP_MODE === 'session' ? SESSION_MATCHES_CACHE : matchesPayload.slice(0, 10), CURRENT_RECAP_MODE);
  }
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

// Recent 10 Matches Renderer (Awards 👑 MVP to highest impact and 💩 to lowest impact player; Saves replaces Missed)
function renderRecentMatches(clubId, matches) {
  const tbody = document.getElementById('recentMatchesTable'), formContainer = document.getElementById('formBadges');
  if (!tbody) return;
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

    let bestMvp = null, hiScore = -Infinity, worstSpoon = null, loScore = Infinity, matchYellows = 0, matchReds = 0;
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
      if (p._inf < loScore) { loScore = p._inf; worstSpoon = pName; }
    });

    matchYellows = Math.max(matchYellows, Number(myClub.yellowcards ?? myClub.yellowCards ?? m.aggregate?.[thisId]?.yellowcards ?? 0));
    matchReds = Math.max(matchReds, Number(myClub.redcards ?? myClub.redCards ?? m.aggregate?.[thisId]?.redcards ?? 0));

    playerStats.sort((a, b) => b._inf - a._inf);
    let crownGiven = false, spoonGiven = false;
    const rowsHtml = playerStats.map(p => {
      const pName = p.playername || p.name || 'Pro', goals = Number(p.goals || 0), assists = Number(p.assists || 0), shots = Number(p.shots || 0);
      const saves = Number(p._ev.saves || 0);
      const subbed = maxSecs > 600 && Number(p.secondsPlayed || maxSecs) <= maxSecs * 0.78 && p._ev.redCards === 0;
      const subBadge = (subbed && (goals + assists > 0)) ? `<span class="ml-1 px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-400/50 text-[9px] font-black">🦸‍♂️ SUPER-SUB</span>` : (subbed ? `<span class="ml-1 text-[9px] text-gray-400">🔄 Sub</span>` : '');

      let awardBadge = '--';
      if (!crownGiven && pName === bestMvp && hiScore > -Infinity) {
        awardBadge = `<span class="px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-400 border border-yellow-500/40 text-[10px] font-black">👑 MVP</span>`;
        crownGiven = true;
      } else if (!spoonGiven && playerStats.length > 1 && pName === worstSpoon && worstSpoon !== bestMvp) {
        awardBadge = `<span class="px-1.5 py-0.5 rounded bg-amber-900/40 text-amber-300 border border-amber-600/50 text-[10px] font-black" title="Lowest Match Impact Score">💩</span>`;
        spoonGiven = true;
      }

      return `<tr class="border-b border-gray-800/60"><td class="py-2 px-2 font-semibold text-white"><div class="flex items-center gap-2">${renderAvatarWithFlagHtml(pName, 'w-6 h-6', 'border-gray-700', 'w-2.5 h-2')}<span>${pName}</span>${subBadge}</div></td><td class="py-2 px-2 text-center font-black text-yellow-400">${parseFloat(p.rating||0).toFixed(1)}</td><td class="py-2 px-2 text-center font-bold text-emerald-400">${goals}</td><td class="py-2 px-2 text-center font-bold text-sky-400">${assists}</td><td class="py-2 px-2 text-center font-mono">${shots} <span class="text-[10px] text-emerald-400">(${shots>0?`${Math.round((goals/shots)*100)}%`:'--'})</span></td><td class="py-2 px-2 text-center font-mono text-cyan-400">${p._att>0?`${p._made}/${p._att} (${p._passPct}%)`:`${p._passPct}%`}</td><td class="py-2 px-2 text-center font-mono text-fuchsia-400">${p._ev.skillMoves}</td><td class="py-2 px-2 text-center text-sky-400" title="${p.tacklesmade||0} Tackles • ${p._ev.blocks} Blocks • ${p._ev.interceptions} Interceptions">${p.tacklesmade||0} <span class="text-[10px] text-gray-400">(${p._ev.blocks+p._ev.interceptions} B/I)</span></td><td class="py-2 px-2 text-center font-mono ${saves > 0 ? 'font-bold text-teal-400' : 'text-gray-500'}">${saves}</td><td class="py-2 px-2 text-center">${renderCardBadgesHtml(p._ev.yellowCards, p._ev.redCards)}</td><td class="py-2 px-2 text-right">${awardBadge}</td></tr>`;
    }).join('');

    return `<tr onclick="document.getElementById('boxScore_${idx}').classList.toggle('hidden')" class="hover:bg-gray-800/40 transition border-b border-gray-800/60 cursor-pointer"><td class="py-2.5 px-2"><span class="px-2 py-0.5 rounded text-[11px] font-semibold bg-gray-800 text-gray-300 border border-gray-700">${m._inferredCategory||'League'}</span></td><td class="py-2.5 px-2 font-medium text-white"><div class="flex items-center gap-1.5">${renderCrestHtml(oppName, oppClub.crestId||oppClub.TEAM||oppClub.details?.crestAssetId, 'w-6 h-6 sm:w-7 sm:h-7', oppId)}<span>${oppName}</span>${oppCnt>0?`<span class="text-[10px] text-gray-400 font-mono">(${oppCnt}p)</span>`:''}${rqBadge}<i class="fa-solid fa-chevron-down text-[9px] text-gray-500"></i></div></td><td class="py-2.5 px-2 text-center" title="${chaos.label}">${chaos.emoji}</td><td class="py-2.5 px-2 text-center">${renderDivisionShieldHtml(oppClub.division||'Div 5','sm')}</td><td class="py-2.5 px-2 text-center">${oppSR?`<span class="inline-block font-mono font-bold text-xs text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">${oppSR}</span>`:'--'}</td><td class="py-2.5 px-2 text-center font-bold text-white">${myG} - ${oppG}</td><td class="py-2.5 px-2 text-center"><div class="inline-flex items-center gap-1.5"><span class="w-6 h-5 rounded flex items-center justify-center text-[11px] font-black border ${mg.gradeCls}">${mg.grade}</span><span class="text-[10px] font-mono text-emerald-400">A:${mg.atk}</span><span class="text-[10px] font-mono text-sky-400">D:${mg.def}</span></div></td><td class="py-2.5 px-2 text-center">${renderCardBadgesHtml(matchYellows, matchReds)}</td><td class="py-2.5 px-2 text-center"><span class="px-2 py-0.5 rounded text-[11px] font-bold border ${resCls}">${resLbl}</span></td><td class="py-2.5 px-2 text-right text-gray-400 text-xs">${dateText}</td></tr><tr id="boxScore_${idx}" class="hidden bg-gray-900/60 border-b border-gray-800"><td colspan="10" class="p-3"><div class="overflow-x-auto touch-scroll rounded border border-gray-800 bg-gray-950/80"><table class="w-full text-left text-xs whitespace-nowrap"><thead class="bg-gray-900 text-gray-400 uppercase text-[10px]"><tr><th class="py-1.5 px-2">Player</th><th class="py-1.5 px-2 text-center">Rat</th><th class="py-1.5 px-2 text-center">G</th><th class="py-1.5 px-2 text-center">A</th><th class="py-1.5 px-2 text-center">Shots (Conv%)</th><th class="py-1.5 px-2 text-center">Passes</th><th class="py-1.5 px-2 text-center">Skills</th><th class="py-1.5 px-2 text-center">Tkl (Blk/Int)</th><th class="py-1.5 px-2 text-center">Saves</th><th class="py-1.5 px-2 text-center">Cards</th><th class="py-1.5 px-2 text-right">Award</th></tr></thead><tbody>${rowsHtml}</tbody></table></div></td></tr>`;
  }).join('');
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
