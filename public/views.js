let SQUAD_SORT_COL = 'games';
let SQUAD_SORT_ASC = false;
let NEXT_RADAR_SLOT = 1;

// Compact Hero Sparkline Renderer for Skill Rating Progression (Fits neatly inside the Hero Card)
function renderSkillRatingGraph(clubId, clubData = {}, matches = []) {
  const sec = document.getElementById('srGraphSection'), chartBox = document.getElementById('srChartContainer'), badge = document.getElementById('srTrendBadge'), metaEl = document.getElementById('srPeakLowMeta');
  const matchArr = Array.isArray(matches) ? matches.slice(0, 10) : [];
  if (!sec || !chartBox || !matchArr.length) { sec?.classList.add('hidden'); return; }
  sec.classList.remove('hidden');

  const currentSr = Number(clubData?.overall?.skillRating ?? clubData?.overall?.rating ?? 1500) || 1500;
  let runningSr = currentSr;
  const reversedPoints = [];

  for (let i = 0; i < matchArr.length; i++) {
    const m = matchArr[i];
    const clubs = m.clubs || m.aggregate || {}, cIds = Object.keys(clubs);
    const myId = cIds.find(id => String(id) === String(clubId)) || cIds[0];
    const oppId = cIds.find(id => String(id) !== String(clubId)) || cIds[1];
    const myClub = clubs[myId] || {}, oppClub = clubs[oppId] || {};
    const myG = Number(myClub.goals ?? myClub.score ?? 0), oppG = Number(oppClub.goals ?? oppClub.score ?? 0);
    const oppName = oppClub.details?.name || oppClub.name || 'Opponent';
    const oppSr = Number(oppClub.skillRating || oppClub.details?.skillRating || runningSr);
    const res = myG > oppG ? 'W' : (myG < oppG ? 'L' : 'D');
    const gd = Math.abs(myG - oppG);

    const srDiff = Math.max(-350, Math.min(350, oppSr - runningSr));
    const expected = 1 / (1 + Math.pow(10, srDiff / 400));
    const actual = res === 'W' ? 1 : (res === 'D' ? 0.5 : 0);
    const gdMult = gd >= 3 ? 1.25 : (gd === 2 ? 1.12 : 1.0);
    let delta = Math.round(28 * gdMult * (actual - expected));
    if (res === 'W' && delta < 8) delta = 12;
    if (res === 'L' && delta > -8) delta = -12;

    reversedPoints.push({
      sr: Math.round(runningSr),
      delta,
      res,
      score: `${myG}-${oppG}`,
      oppName,
      isLatest: i === 0
    });
    runningSr = Math.max(800, runningSr - delta);
  }

  reversedPoints.push({
    sr: Math.round(runningSr),
    delta: 0,
    res: 'START',
    score: 'Start',
    oppName: `${matchArr.length}G Ago`,
    isBaseline: true
  });

  const ptsChrono = reversedPoints.reverse();
  const srs = ptsChrono.map(p => p.sr);
  const peakSr = Math.max(...srs), lowSr = Math.min(...srs);
  const minSr = lowSr - 12, maxSr = peakSr + 12;
  const range = Math.max(24, maxSr - minSr);

  const netChange = ptsChrono[ptsChrono.length - 1].sr - ptsChrono[0].sr;
  if (metaEl) metaEl.innerText = `Low: ${lowSr} • Peak: ${peakSr}`;
  badge.className = netChange > 0
    ? 'px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
    : netChange < 0
    ? 'px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-black bg-rose-500/20 text-rose-400 border border-rose-500/40'
    : 'px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-black bg-gray-800 text-gray-300 border border-gray-700';
  badge.innerText = netChange > 0 ? `▲ +${netChange} SR` : (netChange < 0 ? `▼ ${netChange} SR` : `⚖️ 0 SR`);

  const w = 520, h = 88, padL = 18, padR = 22, padT = 18, padB = 12;
  const plotW = w - padL - padR, plotH = h - padT - padB;

  const coords = ptsChrono.map((pt, i) => {
    const x = +(padL + (i / Math.max(1, ptsChrono.length - 1)) * plotW).toFixed(1);
    const y = +(padT + plotH - ((pt.sr - minSr) / range) * plotH).toFixed(1);
    return { x, y, idx: i, ...pt };
  });

  const pathD = coords.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaD = `${pathD} L ${coords[coords.length - 1].x} ${padT + plotH} L ${coords[0].x} ${padT + plotH} Z`;
  const midY = +(padT + plotH * 0.5).toFixed(1);

  const nodesHtml = coords.map((p, i) => {
    const col = p.isBaseline ? '#64748b' : (p.res === 'W' ? '#10b981' : (p.res === 'L' ? '#f43f5e' : '#f59e0b'));
    const dStr = p.delta > 0 ? `+${p.delta}` : `${p.delta}`;
    const tip = p.isBaseline
      ? `Start (${matchArr.length} Games Ago): ${p.sr} SR`
      : `M${i} vs ${p.oppName} (${p.res} ${p.score}) • ${p.sr} SR (${dStr})`;

    const showLabel = p.isBaseline || p.isLatest || p.sr === peakSr || p.sr === lowSr;
    const lblHtml = showLabel
      ? `<text x="${p.x}" y="${p.y - 7}" fill="${p.isLatest ? '#34d399' : '#94a3b8'}" font-size="9.5" font-family="monospace" font-weight="800" text-anchor="middle">${p.sr}</text>`
      : '';

    return `<g class="group cursor-pointer">
      <title>${tip}</title>
      <circle cx="${p.x}" cy="${p.y}" r="${p.isLatest ? 7 : 5}" fill="${col}" opacity="0.22"/>
      <circle cx="${p.x}" cy="${p.y}" r="${p.isLatest ? 4 : 3}" fill="${col}" stroke="#0b0f19" stroke-width="1.5"/>
      ${lblHtml}
    </g>`;
  }).join('');

  chartBox.innerHTML = `<svg viewBox="0 0 ${w} ${h}" class="w-full h-full overflow-visible select-none" shape-rendering="geometricPrecision">
    <defs>
      <linearGradient id="srAreaGrad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#10b981" stop-opacity="0.28"/>
        <stop offset="100%" stop-color="#10b981" stop-opacity="0.0"/>
      </linearGradient>
    </defs>
    <line x1="${padL}" y1="${midY}" x2="${w - padR}" y2="${midY}" stroke="#1f2937" stroke-width="1" stroke-dasharray="3 3"/>
    <path d="${areaD}" fill="url(#srAreaGrad)"/>
    <path d="${pathD}" fill="none" stroke="#10b981" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
    ${nodesHtml}
  </svg>`;
}

// 3-Pillar Focused Tactical Scouting Report (Strengths, Weaknesses, Tactical Fixes)
function renderClubReviewReport(clubData = {}, members = [], matches = [], shameList = []) {
  const sec = document.getElementById('clubReviewSection');
  if (!members.length) return sec.classList.add('hidden');
  sec.classList.remove('hidden');

  const st = clubData.overall || {}, w = Number(st.wins ?? st.overallWins ?? 0), d = Number(st.ties ?? st.overallTies ?? 0), l = Number(st.losses ?? st.overallLosses ?? 0);
  const tot = Math.max(1, w + d + l), winPct = Math.round((w / tot) * 100), gpg = (Number(st.goals ?? 0) / tot).toFixed(2), gapg = (Number(st.goalsAgainst ?? 0) / tot).toFixed(2);
  let rW = 0, rL = 0;
  matches.slice(0, 10).forEach(m => {
    const c = m.clubs || m.aggregate || {}, ids = Object.keys(c);
    const myId = ids.find(id => String(id) === String(GLOBAL_CLUB_ID)) || ids[0], oppId = ids.find(id => String(id) !== String(GLOBAL_CLUB_ID)) || ids[1];
    const mG = Number(c[myId]?.goals ?? 0), oG = Number(c[oppId]?.goals ?? 0);
    if (mG > oG) rW++; else if (mG < oG) rL++;
  });

  const avgPass = Math.round(members.reduce((a, b) => a + Number(b.passSuccessRate || 75), 0) / members.length);
  const missedP = shameList.reduce((a, b) => a + (b.missedPasses || 0), 0), missedS = shameList.reduce((a, b) => a + Math.max(0, (b.shots || 0) - (b.goals || 0)), 0);
  const hb = document.getElementById('clubReviewGradeBadge');
  hb.className = winPct >= 52 && rW >= rL ? 'px-3 py-1 rounded-full text-[11px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'px-3 py-1 rounded-full text-[11px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/40';
  hb.innerText = winPct >= 52 && rW >= rL ? 'SCOUT GRADE: PROMOTION CONTENDERS (A)' : 'SCOUT GRADE: COMPETITIVE BATTLERS (B+)';

  const topScorer = [...members].sort((a, b) => Number(b.goals || 0) - Number(a.goals || 0))[0];
  const topPlaymaker = [...members].sort((a, b) => Number(b.assists || 0) - Number(a.assists || 0))[0];
  const pillars = [
    { title: '💪 Key Strengths', icon: 'fa-dumbbell text-emerald-400', border: 'border-emerald-500/30', items: [Number(gpg)>=2.0?`<b>Attacking Output:</b> Averaging ${gpg} goals/game across ${tot} fixtures.`:`<b>Balanced Scoring:</b> Shared goal threat across the front line.`, `<b>Ball Retention:</b> ${avgPass}% squad pass completion rate.`, topScorer?`<b>Clinical Finisher:</b> ${topScorer.name||topScorer.proName} leads with ${topScorer.goals}G (${topPlaymaker?.name||'Pro'}: ${topPlaymaker?.assists||0}A).`:''] },
    { title: '⚠️ Vulnerabilities', icon: 'fa-triangle-exclamation text-rose-400', border: 'border-rose-500/30', items: [Number(gapg)>=2.0?`<b>Defensive Exposure:</b> Conceding ${gapg} goals/game on counter-attacks.`:`<b>Fine Margins:</b> Dropping points in tight 1-goal games.`, `<b>Midfield Turnovers:</b> ${missedP} misplaced passes in the last 10 matches.`, `<b>Box Efficiency:</b> ${missedS} unconverted shots in the recent 10-game window.`] },
    { title: '🎯 Tactical Fixes', icon: 'fa-bullseye text-amber-400', border: 'border-amber-500/30', items: [`<b>Rest-Defense Discipline:</b> Keep 1 CDM/CM holding central space when fullbacks push.`, `<b>Eliminate Hospital Passes:</b> Work short triangles before forcing contested through-balls.`, `<b>Extra Pass in the Box:</b> Look for high-percentage cutbacks rather than tight-angle shots.`] }
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
      [...shameList].sort((a, b) => (b.woodwork * 15 + (b.shots - b.goals)) - (a.woodwork * 15 + (a.shots - a.goals)))[0],
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

function sortSquadBy(col) {
  if (SQUAD_SORT_COL === col) {
    SQUAD_SORT_ASC = !SQUAD_SORT_ASC;
  } else {
    SQUAD_SORT_COL = col;
    SQUAD_SORT_ASC = col === 'name';
  }
  renderMembers(GLOBAL_MEMBERS);
}

function quickComparePlayer(playerName, ev) {
  if (ev) ev.stopPropagation();
  const s1 = document.getElementById('radarSelectP1'), s2 = document.getElementById('radarSelectP2');
  if (!s1 || !s2) return;
  if (NEXT_RADAR_SLOT === 1) {
    s1.value = playerName;
    NEXT_RADAR_SLOT = 2;
  } else {
    s2.value = playerName;
    NEXT_RADAR_SLOT = 1;
  }
  updateRadarCharts();
  document.getElementById('radarSection')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function renderMembers(data) {
  const tbody = document.getElementById('membersTable'), rawList = Array.isArray(data) ? [...data] : [];
  if (!rawList.length) { tbody.innerHTML = '<tr><td colspan="11" class="py-6 text-center text-gray-500">No member records returned.</td></tr>'; return []; }

  const getVal = (m, c) => {
    const g = Math.max(1, Number(m.gamesPlayed ?? 0)), gl = Number(m.goals ?? 0), as = Number(m.assists ?? 0);
    const n = m.name || m.proName || '';
    const r10 = RECENT_10_STATS_MAP[n];
    if (c === 'name') return n.toLowerCase();
    if (c === 'ovr') return Number(m.proOverall || 85);
    if (c === 'games') return Number(m.gamesPlayed ?? 0);
    if (c === 'goals') return gl;
    if (c === 'assists') return as;
    if (c === 'gapg') return (gl + as) / g;
    if (c === 'tackles') return Number(m.tacklesMade ?? m.tacklesmade ?? m.tackles ?? r10?.tackles ?? 0);
    if (c === 'rating') return parseFloat(m.ratingAve || m.rating || 0);
    if (c === 'pass') return Number(m.passSuccessRate ?? 0);
    if (c === 'motm') return Number(m.manOfTheMatch ?? 0);
    return 0;
  };

  rawList.sort((a, b) => {
    const vA = getVal(a, SQUAD_SORT_COL), vB = getVal(b, SQUAD_SORT_COL);
    if (typeof vA === 'string') return SQUAD_SORT_ASC ? vA.localeCompare(vB) : vB.localeCompare(vA);
    return SQUAD_SORT_ASC ? vA - vB : vB - vA;
  });

  ['name','ovr','games','goals','assists','gapg','tackles','rating','pass','motm'].forEach(col => {
    const el = document.getElementById(`sortIcon_${col}`);
    if (el) {
      el.innerText = SQUAD_SORT_COL === col ? (SQUAD_SORT_ASC ? '▲' : '▼') : '';
      el.className = SQUAD_SORT_COL === col ? 'text-[9px] text-emerald-400 ml-0.5' : 'text-[9px] text-gray-600';
    }
  });

  tbody.innerHTML = rawList.map(m => {
    const name = m.name || m.proName || 'Unknown', ovr = Number(m.proOverall || 85), tierInfo = getCardTierTheme(ovr);
    const normPos = normalizePosition(m.favoritePosition || m.pos || 'MID'), exactPos = EA_PRO_POS_MAP[String(m.proPos ?? '')] || normPos;
    const games = Number(m.gamesPlayed ?? 0), goals = Number(m.goals ?? 0), assists = Number(m.assists ?? 0);
    const careerRat = parseFloat(m.ratingAve || m.rating || 0), pass = m.passSuccessRate ?? 0, motm = m.manOfTheMatch ?? 0;

    const r10 = RECENT_10_STATS_MAP[name];
    const sm = SHAME_LIST_CACHE.find(x => x.name === name);
    const tackles = Number(m.tacklesMade ?? m.tacklesmade ?? m.tackles ?? r10?.tackles ?? 0);
    const r10TklWin = (sm && sm.tackleAtt > 0) ? Math.round((sm.tackles / sm.tackleAtt) * 100) : 0;
    const tWin = Number(m.tackleSuccessRate ?? m.tacklesuccessrate ?? r10TklWin ?? 0);

    const gaPg = games > 0 ? ((goals + assists) / games).toFixed(2) : '0.00';
    const r10Conv = r10?.shots > 0 ? Math.round((r10.goals / r10.shots) * 100) : null;
    const shotConv = Number(m.shotConvRate || 0) > 0 ? Number(m.shotConvRate) : (r10Conv ?? '--');

    const totalCS = Math.max(Number(m.totalCleanSheets ?? m.cleanSheetsDef ?? 0), Number(r10?.recentCleanSheets || 0));
    const csBadge = totalCS > 0
      ? `<span class="ml-1.5 px-1.5 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[10px] font-bold" title="${totalCS} Clean Sheets">${totalCS} CS</span>`
      : '';

    const otherG = Number(m.otherClubGames ?? 0);
    const loyaltyBadge = otherG === 0
      ? `<span class="px-1.5 py-0.5 rounded text-[9px] font-black bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">🛡️ One-Club</span>`
      : `<span class="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/10 text-amber-300 border border-amber-500/30">💼 ${otherG}g Elsewhere</span>`;
    const recentAvg = RECENT_FORM_MAP[name];
    const formArr = (recentAvg !== undefined && careerRat > 0) ? (recentAvg - careerRat >= 0.15 ? '<span class="text-emerald-400 font-black ml-1">▲</span>' : recentAvg - careerRat <= -0.15 ? '<span class="text-rose-400 font-black ml-1">▼</span>' : '<span class="text-gray-500 ml-1">•</span>') : '';

    m._normalizedPos = normPos; m._rawPos = exactPos;
    const bCol = normPos === 'FWD' ? 'text-rose-400 bg-rose-500/10' : normPos === 'MID' ? 'text-amber-400 bg-amber-500/10' : normPos === 'DEF' ? 'text-blue-400 bg-blue-500/10' : 'text-purple-400 bg-purple-500/10';
    const escName = name.replace(/'/g, "\\'");

    return `<tr onclick="openFutModal('${escName}')" class="hover:bg-gray-800/50 transition border-b border-gray-800/60 cursor-pointer"><td class="py-2.5 px-2 font-medium text-white"><div class="flex items-center justify-between gap-2"><div class="flex items-center gap-2">${renderAvatarWithFlagHtml(name, 'w-8 h-8 sm:w-9 sm:h-9', 'border-emerald-500/40', 'w-3.5 h-2.5')}<span class="hover:text-yellow-400 font-bold">${name}</span>${loyaltyBadge}</div><button onclick="quickComparePlayer('${escName}', event)" class="text-[11px] bg-gray-800 hover:bg-sky-500/20 text-gray-400 hover:text-sky-300 border border-gray-700 hover:border-sky-500/40 px-1.5 py-0.5 rounded transition" title="Compare in Radar Chart">⚖️</button></div></td><td class="py-2.5 px-2 text-center"><span class="px-2 py-0.5 rounded border font-black text-xs ${tierInfo.badgeClass}">${ovr}</span></td><td class="py-2.5 px-2 text-center"><span class="px-2 py-0.5 rounded text-xs font-semibold ${bCol}">${exactPos}</span></td><td class="py-2.5 px-2 text-center text-gray-300">${games}</td><td class="py-2.5 px-2 text-center font-bold text-emerald-400">${goals} ${shotConv!=='--'?`<span class="text-[10px] text-gray-400 font-mono">(${shotConv}%)</span>`:''}</td><td class="py-2.5 px-2 text-center text-gray-300">${assists}</td><td class="py-2.5 px-2 text-center text-emerald-300 font-mono">${gaPg}</td><td class="py-2.5 px-2 text-center text-sky-400 font-medium" title="${tackles} Tackles Won (${tWin}% Success Rate)">${tackles} <span class="text-xs text-gray-400">(${tWin}%)</span>${csBadge}</td><td class="py-2.5 px-2 text-center text-yellow-400 font-semibold">${careerRat.toFixed(1)}${formArr}</td><td class="py-2.5 px-2 text-center text-gray-300">${pass}%</td><td class="py-2.5 px-2 text-center text-purple-400">${motm}</td></tr>`;
  }).join('');
  return rawList;
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
  document.getElementById('futAvatar').src = getPlayerAvatarUrl(name, true);
  document.getElementById('futName').innerText = name;
  ['Pac','Sho','Pas','Dri','Def','Phy'].forEach((k, i) => document.getElementById(`fut${k}`).innerText = metrics.attributes[i].raw);

  const fUrl = resolvePlayerFlagUrl(p), fEl = document.getElementById('futFlag');
  if (fUrl) { fEl.src = fUrl; fEl.classList.remove('hidden'); } else { fEl.classList.add('hidden'); }
  document.getElementById('futClubCrest').src = CURRENT_CLUB_CREST_URL || `${API_BASE}/crest/0?name=FC`;

  const m = document.getElementById('futModal'); m.classList.remove('hidden'); m.classList.add('flex');
}

function closeFutModal() { const m = document.getElementById('futModal'); m.classList.add('hidden'); m.classList.remove('flex'); }
