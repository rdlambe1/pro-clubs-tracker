const API_BASE = '/api';

let GLOBAL_CLUB_ID = null;
let GLOBAL_COMBINED_DATA = null;
let GLOBAL_MEMBERS = [];
let GLOBAL_MATCHES = [];
let SESSION_MATCHES_CACHE = [];
let SHAME_LIST_CACHE = [];
let RECENT_FORM_MAP = {};
let RECENT_10_STATS_MAP = {};
let CURRENT_CLUB_CREST_URL = '';
let ACTIVE_MODAL_PLAYER = '';
let ACTIVE_TAB = 'team';
let CURRENT_RECAP_MODE = 'session';
let CURRENT_BANTER_MODE = 'last10';
let CURRENT_PITCH_MODE = 'lastMatch';

function slugifyClubName(name) {
  return String(name || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function normalizePosition(rawPos) {
  const s = String(rawPos || '').trim().toUpperCase();
  if (['0', 'GK', 'GOALKEEPER'].includes(s)) return 'GK';
  if (['1', '2', '3', '4', '5', '6', '7', '8', 'DEF', 'DEFENDER', 'CB', 'LB', 'RB', 'LWB', 'RWB', 'LCB', 'RCB'].includes(s)) return 'DEF';
  if (['9', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', 'MID', 'MIDFIELDER', 'CDM', 'CM', 'CAM', 'LM', 'RM', 'LDM', 'RDM', 'LCM', 'RCM', 'LAM', 'RAM'].includes(s)) return 'MID';
  if (['20', '21', '22', '23', '24', '25', '26', '27', 'FWD', 'FORWARD', 'ST', 'CF', 'LW', 'RW', 'LF', 'RF', 'LS', 'RS'].includes(s)) return 'FWD';
  return 'MID';
}

function findMemberMeta(playerName) {
  const key = String(playerName || '').toLowerCase().trim();
  return GLOBAL_MEMBERS.find(m =>
    String(m.name || '').toLowerCase().trim() === key ||
    String(m.proName || '').toLowerCase().trim() === key
  ) || null;
}

function getShirtLabel(name) {
  const parts = String(name || 'PRO').trim().split(/[\s_-]+/);
  return (parts[parts.length - 1] || name || 'PRO').substring(0, 10).toUpperCase();
}

function getPlayerAvatarUrl(name, highRes = false) {
  if (typeof CUSTOM_PLAYER_AVATARS !== 'undefined' && CUSTOM_PLAYER_AVATARS[name]) {
    return CUSTOM_PLAYER_AVATARS[name];
  }
  const sz = highRes ? 240 : 96;
  return `https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${encodeURIComponent(name || 'Pro')}&size=${sz}`;
}

function resolvePlayerFlagUrl(memberOrName) {
  const m = typeof memberOrName === 'object' && memberOrName !== null ? memberOrName : findMemberMeta(memberOrName);
  if (!m) return null;
  const natId = String(m.proNationality || m.nationalityId || m.nationality || '').trim();
  if (typeof EA_NATION_MAP !== 'undefined' && EA_NATION_MAP[natId]) {
    return `https://flagcdn.com/w40/${EA_NATION_MAP[natId].code}.png`;
  }
  return null;
}

function renderAvatarWithFlagHtml(playerName, sizeClass = 'w-9 h-9', borderClass = 'border-emerald-500/40', flagSize = 'w-3.5 h-2.5') {
  const avatarUrl = getPlayerAvatarUrl(playerName);
  const flagUrl = resolvePlayerFlagUrl(playerName);
  const flagHtml = flagUrl
    ? `<img src="${flagUrl}" class="absolute -bottom-0.5 -right-0.5 ${flagSize} object-cover rounded-[2px] border border-gray-950 shadow-sm" alt="Flag">`
    : '';
  return `<div class="relative inline-block flex-shrink-0"><img src="${avatarUrl}" class="${sizeClass} rounded-full avatar-circle border ${borderClass} bg-gray-900 object-cover" alt="${playerName}">${flagHtml}</div>`;
}

function getCardTierTheme(ovr = 85) {
  const n = Number(ovr || 85);
  if (n >= 90) {
    return {
      tier: 'TOTY / ICON',
      badgeClass: 'bg-sky-500/20 text-sky-300 border-sky-400/50',
      textColor: '#f8fafc',
      baseStops: ['#0f172a', '#1e3a8a', '#1d4ed8', '#1e293b', '#090d16'],
      plateStops: ['#1e293b', '#0f172a', '#020617'],
      rimStops: ['#e0f2fe', '#38bdf8', '#eab308', '#fef08a']
    };
  }
  if (n >= 85) {
    return {
      tier: 'RARE GOLD',
      badgeClass: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40',
      textColor: '#2b2108',
      baseStops: ['#fef08a', '#facc15', '#eab308', '#ca8a04', '#854d0e'],
      plateStops: ['#fde047', '#eab308', '#a16207'],
      rimStops: ['#ffffff', '#fde047', '#a16207', '#fef08a']
    };
  }
  return {
    tier: 'SILVER PRO',
    badgeClass: 'bg-slate-400/20 text-slate-200 border-slate-400/40',
    textColor: '#0f172a',
    baseStops: ['#f1f5f9', '#cbd5e1', '#94a3b8', '#64748b', '#334155'],
    plateStops: ['#e2e8f0', '#94a3b8', '#475569'],
    rimStops: ['#ffffff', '#cbd5e1', '#475569', '#f1f5f9']
  };
}

function isDefensiveAnchorRole(normPos, exactPos, tklPerGame = 0, goalsPerGame = 0, shotsPerGame = 0) {
  const ex = String(exactPos || '').toUpperCase();
  if (normPos === 'DEF' || ['CDM', 'LDM', 'RDM', 'CB', 'LB', 'RB', 'LWB', 'RWB'].includes(ex)) return true;
  if (normPos === 'MID' && tklPerGame >= 1.8 && goalsPerGame < 0.35 && shotsPerGame < 1.3) return true;
  return false;
}

function parsePlayerMatchEvents(p = {}, exactPos = '') {
  const goals = Number(p.goals || 0);
  const assists = Number(p.assists || 0);
  const shots = Number(p.shots || 0);
  const passesMade = Number(p.passesmade || p.passesMade || 0);
  const passAtt = Number(p.passattempts || p.passAttempts || passesMade);
  const tackles = Number(p.tacklesmade || p.tacklesMade || p.tackles || 0);
  const tackleAtt = Number(p.tackleattempts || p.tackleAttempts || tackles);
  const rat = parseFloat(p.rating || 7.0);
  const normPos = p.pos ? normalizePosition(p.pos) : 'MID';
  const isAnchor = isDefensiveAnchorRole(normPos, exactPos, tackles, goals, shots);

  const rawBlocks = Number(p.blocks ?? p.shotsBlocked ?? p.blockedShots ?? -1);
  const blocks = rawBlocks >= 0
    ? rawBlocks
    : Math.max(0, Math.round(tackles * (isAnchor ? 0.55 : 0.22) + (normPos === 'DEF' && rat >= 7.2 ? 1 : 0)));

  const rawInt = Number(p.interceptions ?? p.ballRecoveries ?? -1);
  const interceptions = rawInt >= 0
    ? rawInt
    : Math.max(0, Math.round(tackles * (isAnchor ? 0.75 : 0.35) + (passesMade >= 16 && isAnchor ? 2 : (isAnchor ? 1 : 0))));

  const rawSkills = Number(p.skillmoves ?? p.skillMoves ?? p.dribblesCompleted ?? -1);
  const skillMoves = rawSkills >= 0
    ? rawSkills
    : Math.max(0, Math.round((shots * 0.65) + (goals + assists) * 1.1 + (normPos !== 'DEF' && passesMade >= 12 ? 2 : 0)));

  const dribblesCompleted = Math.max(skillMoves, Math.round(passesMade * 0.25 + (goals + assists)));
  const MissedShots = Math.max(0, shots - goals);
  const rawWood = Number(p.woodwork ?? p.hitWoodwork ?? -1);
  const woodwork = rawWood >= 0 ? rawWood : (MissedShots >= 4 ? 1 : 0);

  const saves = Number(p.saves || 0);
  const goalsConceded = Number(p.goalsconceded || p.goalsConceded || 0);
  const offsides = Number(p.offsides || 0);
  const redCards = Number(p.redcards || p.redCards || 0);
  const yellowCards = Number(p.yellowcards || p.yellowCards || 0);

  return { blocks, interceptions, skillMoves, dribblesCompleted, woodwork, saves, goalsConceded, offsides, yellowCards, redCards };
}

function computePlayerImpactScore(u = {}) {
  const g = Math.max(1, Number(u.games || 1));
  const avgRat = Number(u.ratingSum || 7.0) / g;
  const gpg = Number(u.goals || 0) / g;
  const apg = Number(u.assists || 0) / g;
  const spg = Number(u.shots || 0) / g;
  const pPct = u.passAttempts > 0 ? (u.passesMade / u.passAttempts) : 0.78;
  const tpg = Number(u.tackles || 0) / g;
  const bpg = Number(u.blocks || 0) / g;
  const ipg = Number(u.interceptions || 0) / g;
  const csRate = Number(u.cleanSheets || 0) / g;
  const missedPassesPg = Math.max(0, (u.passAttempts || 0) - (u.passesMade || 0)) / g;
  const missedShotsPg = Math.max(0, (u.shots || 0) - (u.goals || 0)) / g;
  const cardsPenalty = ((Number(u.reds || 0) * 3.5) + (Number(u.yellows || 0) * 1.0)) / g;

  const isAnchor = isDefensiveAnchorRole(u.normPos, u.exactPos, tpg, gpg, spg);
  let score = avgRat * 10;

  if (u.normPos === 'GK') {
    score += (Number(u.saves || 0) / g) * 3.2 + csRate * 8.0 - (Number(u.goalsConceded || 0) / g) * 1.8;
  } else if (isAnchor) {
    score += (tpg * 2.8) + (ipg * 2.4) + (bpg * 2.5) + (csRate * 6.5) + (pPct * 12) + ((gpg + apg) * 5.0) - (missedPassesPg * 0.7) - cardsPenalty;
  } else if (u.normPos === 'MID') {
    score += ((gpg + apg) * 8.5) + (pPct * 14) + (tpg * 1.8) + (ipg * 1.5) - (missedPassesPg * 0.85) - (missedShotsPg * 0.6) - cardsPenalty;
  } else {
    score += (gpg * 10.5) + (apg * 7.5) + (pPct * 8) - (missedShotsPg * 1.1) - (missedPassesPg * 0.65) - cardsPenalty;
  }
  return +score.toFixed(2);
}

function formatHolisticPlayerSummary(u = {}, isLiability = false) {
  const g = Math.max(1, Number(u.games || 1));
  const avgRat = (Number(u.ratingSum || 7.0) / g).toFixed(1);
  const pPct = u.passAttempts > 0 ? Math.round((u.passesMade / u.passAttempts) * 100) : 78;
  const isAnchor = isDefensiveAnchorRole(u.normPos, u.exactPos, u.tackles / g, u.goals / g, u.shots / g);

  if (isLiability) {
    const missedP = Math.max(0, (u.passAttempts || 0) - (u.passesMade || 0));
    const missedS = Math.max(0, (u.shots || 0) - (u.goals || 0));
    if (u.reds > 0) return `${avgRat} Rat • ${u.reds} Red Card(s) & ${missedP} Turnovers`;
    if (missedP >= missedS && missedP > 2) return `${avgRat} Rat • ${missedP} Turnovers (${pPct}% Pass)`;
    if (missedS > 2) return `${avgRat} Rat • ${u.goals}G from ${u.shots} Shots (${missedP} Turnovers)`;
    return `${avgRat} Rat • ${u.goals}G ${u.assists}A (${pPct}% Pass)`;
  }

  if (isAnchor) {
    return `${avgRat} Rat • ${u.tackles} Tkl, ${u.interceptions + u.blocks} Int/Blk • ${pPct}% Pass`;
  }
  return `${avgRat} Rat • ${u.goals}G ${u.assists}A • ${pPct}% Pass (${u.tackles} Tkl)`;
}

function computeMatchGradeAndUnitRatings(myG, oppG, playerStats = []) {
  const gd = myG - oppG;
  const avgRat = playerStats.length
    ? playerStats.reduce((s, p) => s + parseFloat(p.rating || 7.0), 0) / playerStats.length
    : 7.0;

  const atkScore = Math.min(9.9, Math.max(4.5, 6.2 + myG * 0.85 + (avgRat - 7.0) * 0.7)).toFixed(1);
  const defScore = Math.min(9.9, Math.max(4.0, 7.8 - oppG * 0.90 + (oppG === 0 ? 1.2 : 0) + (avgRat - 7.0) * 0.5)).toFixed(1);
  const total = gd * 12 + avgRat * 10 + (oppG === 0 ? 8 : 0);

  let grade = 'B', gradeCls = 'bg-sky-500/20 text-sky-300 border-sky-500/40';
  if (total >= 95) { grade = 'S'; gradeCls = 'bg-yellow-500/25 text-yellow-300 border-yellow-400'; }
  else if (total >= 82) { grade = 'A'; gradeCls = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'; }
  else if (total >= 68) { grade = 'B'; gradeCls = 'bg-sky-500/20 text-sky-300 border-sky-500/40'; }
  else if (total >= 55) { grade = 'C'; gradeCls = 'bg-amber-500/20 text-amber-300 border-amber-500/40'; }
  else { grade = 'D'; gradeCls = 'bg-rose-500/20 text-rose-300 border-rose-500/40'; }

  return { grade, gradeCls, atk: atkScore, def: defScore };
}

function getChaosEmoji(myG, oppG, oppSR) {
  const tot = myG + oppG, diff = myG - oppG;
  if (diff >= 3) return { emoji: '🔥', label: 'Total Demolition' };
  if (diff <= -3) return { emoji: '💀', label: 'Defensive Collapse' };
  if (tot >= 6) return { emoji: '🍿', label: ' basketball Scoreline' };
  if (myG === 0 && oppG === 0) return { emoji: '🧱', label: 'Tactical Chess Match' };
  if (diff === 1 && Number(oppSR || 0) >= 1750) return { emoji: '🧊', label: 'Ice-Cold Giant Killing' };
  return { emoji: '⚔️', label: 'Competitive Battle' };
}

function getPlayerRadarMetrics(m = {}) {
  const ovr = Number(m.proOverall || 85);
  const games = Math.max(1, Number(m.gamesPlayed ?? 1));
  const goals = Number(m.goals ?? 0);
  const assists = Number(m.assists ?? 0);
  const tackles = Number(m.tacklesMade ?? m.tacklesmade ?? m.tackles ?? 0);
  const passPct = Number(m.passSuccessRate ?? 76);
  const tklPct = Number(m.tackleSuccessRate ?? 28);
  const shotConv = Number(m.shotConvRate ?? m.shotSuccessRate ?? 24);
  const rat = parseFloat(m.ratingAve || m.rating || 7.2);
  const motm = Number(m.manOfTheMatch ?? 0);
  const normPos = normalizePosition(m.favoritePosition || m.pos || 'MID');
  const exactPos = (typeof EA_PRO_POS_MAP !== 'undefined' && EA_PRO_POS_MAP[String(m.proPos ?? '')]) || normPos;
  const isAnchor = isDefensiveAnchorRole(normPos, exactPos, tackles / games, goals / games, 2);

  const clamp = (v, lo = 45, hi = 99) => Math.max(lo, Math.min(hi, Math.round(v)));

  const pac = clamp(ovr + (normPos === 'FWD' ? 4 : normPos === 'MID' ? 2 : 0) + ((goals + assists) / games) * 4);
  const sho = clamp((normPos === 'FWD' ? ovr + 2 : isAnchor ? ovr - 16 : ovr - 4) + (goals / games) * 14 + (shotConv * 0.18));
  const pas = clamp(ovr - 2 + (passPct - 75) * 0.7 + (assists / games) * 12);
  const dri = clamp(ovr + (normPos !== 'DEF' ? 3 : -6) + (rat - 7.0) * 6);
  const def = clamp((isAnchor ? ovr + 3 : normPos === 'MID' ? ovr - 14 : ovr - 36) + (tackles / games) * 10 + (tklPct * 0.15), 28, 99);
  const phy = clamp((isAnchor ? ovr + 2 : ovr - 5) + (tackles / games) * 7 + (Number(m.proWeight || 75) - 72) * 0.4, 52, 99);

  const attributes = [
    { label: 'PAC', val: pac, raw: pac },
    { label: 'SHO', val: sho, raw: sho },
    { label: 'PAS', val: pas, raw: pas },
    { label: 'DRI', val: dri, raw: dri },
    { label: 'DEF', val: def, raw: def },
    { label: 'PHY', val: phy, raw: phy }
  ];

  const stats = [
    { label: 'G/G', val: clamp((goals / games) * 115, 15, 99), raw: (goals / games).toFixed(2) },
    { label: 'A/G', val: clamp((assists / games) * 135, 15, 99), raw: (assists / games).toFixed(2) },
    { label: 'PASS%', val: clamp(passPct, 25, 99), raw: `${passPct}%` },
    { label: 'TKL/G', val: clamp((tackles / games) * 32, 15, 99), raw: (tackles / games).toFixed(1) },
    { label: 'RAT', val: clamp((rat - 5.5) * 28, 20, 99), raw: rat.toFixed(1) },
    { label: 'MOTM%', val: clamp((motm / games) * 220, 12, 99), raw: `${Math.round((motm / games) * 100)}%` }
  ];

  return { attributes, stats };
}

function computeArchetypeAndPlaystyles(m = {}) {
  const metrics = getPlayerRadarMetrics(m);
  const [pac, sho, pas, dri, def, phy] = metrics.attributes.map(a => a.raw);
  const normPos = normalizePosition(m.favoritePosition || m.pos || 'MID');
  const exactPos = (typeof EA_PRO_POS_MAP !== 'undefined' && EA_PRO_POS_MAP[String(m.proPos ?? '')]) || normPos;
  const games = Math.max(1, Number(m.gamesPlayed ?? 1));
  const isAnchor = isDefensiveAnchorRole(normPos, exactPos, Number(m.tacklesMade ?? 0) / games, Number(m.goals ?? 0) / games, 2);

  if (normPos === 'GK') {
    return { archetype: 'SHOT STOPPER', psPlus: 'FAR REACH+', activePlaystyles: ['FOOTWORK', 'CROSS CLAIMER'] };
  }
  if (isAnchor) {
    return {
      archetype: def >= 84 ? 'BALL-WINNING ANCHOR' : 'DEEP-LYING SHIELD',
      psPlus: 'INTERCEPT+',
      activePlaystyles: ['ANTICIPATE', 'BRUISER', 'LONG BALL PASS']
    };
  }
  if (normPos === 'FWD' || sho >= pas + 4) {
    return {
      archetype: pac >= 88 ? 'POACHER / SPEEDSTER' : 'CLINICAL FINISHER',
      psPlus: 'FINESSE SHOT+',
      activePlaystyles: ['RAPID', 'FIRST TOUCH', 'TECHNICAL']
    };
  }
  return {
    archetype: pas >= 84 ? 'PLAYMAKER MAESTRO' : 'BOX-TO-BOX ENGINE',
    psPlus: 'INCISIVE PASS+',
    activePlaystyles: ['TIKI TAKA', 'TECHNICAL', 'RELENTLESS']
  };
}

function buildRadarSvg(p1Metrics = [], p2Metrics = []) {
  const sz = 250, cx = 125, cy = 125, rMax = 86;
  const angles = p1Metrics.map((_, i) => -Math.PI / 2 + (i * 2 * Math.PI) / 6);

  const pt = (val, ang) => {
    const r = (Math.max(10, Math.min(100, val)) / 100) * rMax;
    return `${(cx + r * Math.cos(ang)).toFixed(1)},${(cy + r * Math.sin(ang)).toFixed(1)}`;
  };

  const rings = [0.25, 0.5, 0.75, 1].map(scale => {
    const pts = angles.map(a => `${(cx + rMax * scale * Math.cos(a)).toFixed(1)},${(cy + rMax * scale * Math.sin(a)).toFixed(1)}`).join(' ');
    return `<polygon points="${pts}" fill="none" stroke="#1f2937" stroke-width="1"/>`;
  }).join('');

  const axes = angles.map((a, i) => {
    const x2 = (cx + rMax * Math.cos(a)).toFixed(1), y2 = (cy + rMax * Math.sin(a)).toFixed(1);
    const lx = (cx + (rMax + 20) * Math.cos(a)).toFixed(1), ly = (cy + (rMax + 20) * Math.sin(a) + 3.5).toFixed(1);
    return `<line x1="${cx}" y1="${cy}" x2="${x2}" y2="${y2}" stroke="#1f2937" stroke-width="1"/><text x="${lx}" y="${ly}" fill="#94a3b8" font-size="10" font-weight="800" text-anchor="middle">${p1Metrics[i].label}</text>`;
  }).join('');

  const poly1 = p1Metrics.map((m, i) => pt(m.val, angles[i])).join(' ');
  const poly2 = p2Metrics.map((m, i) => pt(m.val, angles[i])).join(' ');

  return `<svg viewBox="0 0 ${sz} ${sz}" class="w-full h-full overflow-visible select-none">
    ${rings}${axes}
    <polygon points="${poly2}" fill="rgba(56, 189, 248, 0.20)" stroke="#38bdf8" stroke-width="2"/>
    <polygon points="${poly1}" fill="rgba(16, 185, 129, 0.25)" stroke="#10b981" stroke-width="2.2"/>
  </svg>`;
}

function computeMatchIntelligence(clubId, matches = []) {
  const recent10 = Array.isArray(matches) ? matches.slice(0, 10) : [];
  RECENT_FORM_MAP = {};
  RECENT_10_STATS_MAP = {};
  SESSION_MATCHES_CACHE = [];
  SHAME_LIST_CACHE = [];

  if (!recent10.length) {
    document.getElementById('intelSection')?.classList.add('hidden');
    document.getElementById('sessionRecapSection')?.classList.add('hidden');
    document.getElementById('shameBoardSection')?.classList.add('hidden');
    return [];
  }

  // Group Latest Session Matches (within 3.5 hours between consecutive matches)
  const sessionMatches = [recent10[0]];
  for (let i = 1; i < recent10.length; i++) {
    const prevTs = Number(recent10[i - 1].timestamp || 0);
    const currTs = Number(recent10[i].timestamp || 0);
    if (prevTs > 0 && currTs > 0 && (prevTs - currTs) <= 3.5 * 3600) {
      sessionMatches.push(recent10[i]);
    } else {
      break;
    }
  }
  SESSION_MATCHES_CACHE = sessionMatches;

  const pMap = {};
  const duoMap = {};
  const oppList = [];

  // Iterate oldest-to-newest so chronological ratings array is in exact time order
  [...recent10].reverse().forEach(m => {
    const clubs = m.clubs || m.aggregate || {}, cIds = Object.keys(clubs);
    const myId = cIds.find(id => String(id) === String(clubId)) || cIds[0];
    const oppId = cIds.find(id => String(id) !== String(clubId)) || cIds[1];
    const myClub = clubs[myId] || {}, oppClub = clubs[oppId] || {};
    const myG = Number(myClub.goals ?? myClub.score ?? 0), oppG = Number(oppClub.goals ?? oppClub.score ?? 0);

    const oppName = oppClub.details?.name || oppClub.name || 'Opponent FC';
    const oppSr = Number(oppClub.skillRating || oppClub.details?.skillRating || 1500);
    oppList.push({ oppId, oppName, oppSr, myG, oppG, crestId: oppClub.crestId || oppClub.TEAM || oppClub.details?.crestAssetId });

    const myPlayers = Object.values(m.players?.[myId] || {});
    const maxSecs = myPlayers.reduce((mx, p) => Math.max(mx, Number(p.secondsPlayed || 0)), 0);

    const activeNames = [];
    myPlayers.forEach(p => {
      const n = p.playername || p.name || 'Pro';
      activeNames.push(n);
      const memberMeta = findMemberMeta(n);
      const exactPos = (typeof EA_PRO_POS_MAP !== 'undefined' && EA_PRO_POS_MAP[String(memberMeta?.proPos ?? '')]) || '';
      const normPos = p.pos ? normalizePosition(p.pos) : normalizePosition(memberMeta?.favoritePosition || 'MID');
      const rat = parseFloat(p.rating || 7.0);
      const goals = Number(p.goals || 0), assists = Number(p.assists || 0), shots = Number(p.shots || 0);
      const pm = Number(p.passesmade || 0), pa = Number(p.passattempts || pm);
      const tm = Number(p.tacklesmade || p.tackles || 0), ta = Number(p.tackleattempts || tm);
      const ev = parsePlayerMatchEvents(p, exactPos);
      const isSub = maxSecs > 600 && Number(p.secondsPlayed || maxSecs) <= maxSecs * 0.78 && ev.redCards === 0;

      if (!pMap[n]) {
        pMap[n] = {
          name: n, normPos, exactPos, games: 0, subGames: 0, superSubGA: 0, ratSum: 0, ratings: [],
          goals: 0, assists: 0, shots: 0, passesMade: 0, passAtt: 0, missedPasses: 0,
          tackles: 0, tackleAtt: 0, blocks: 0, interceptions: 0, skillMoves: 0, dribblesCompleted: 0,
          woodwork: 0, saves: 0, goalsConceded: 0, offsides: 0, yellows: 0, reds: 0, recentCleanSheets: 0
        };
      }
      const u = pMap[n];
      u.games++; u.ratSum += rat; u.ratings.push(rat);
      if (isSub) { u.subGames++; u.superSubGA += (goals + assists); }
      u.goals += goals; u.assists += assists; u.shots += shots;
      u.passesMade += pm; u.passAtt += pa; u.missedPasses += Math.max(0, pa - pm);
      u.tackles += tm; u.tackleAtt += ta;
      u.blocks += ev.blocks; u.interceptions += ev.interceptions;
      u.skillMoves += ev.skillMoves; u.dribblesCompleted += ev.dribblesCompleted;
      u.woodwork += ev.woodwork; u.saves += ev.saves; u.goalsConceded += ev.goalsConceded || oppG;
      u.offsides += ev.offsides; u.yellows += ev.yellowCards; u.reds += ev.redCards;
      if (oppG === 0) u.recentCleanSheets++;
    });

    // Build Dynamic Duo Pairs
    const uniqueNames = [...new Set(activeNames)].sort();
    for (let i = 0; i < uniqueNames.length; i++) {
      for (let j = i + 1; j < uniqueNames.length; j++) {
        const key = `${uniqueNames[i]}|||${uniqueNames[j]}`;
        if (!duoMap[key]) duoMap[key] = { p1: uniqueNames[i], p2: uniqueNames[j], games: 0, wins: 0, combinedGA: 0 };
        duoMap[key].games++;
        if (myG > oppG) duoMap[key].wins++;
        const p1Obj = myPlayers.find(x => (x.playername || x.name) === uniqueNames[i]);
        const p2Obj = myPlayers.find(x => (x.playername || x.name) === uniqueNames[j]);
        duoMap[key].combinedGA += Number(p1Obj?.goals || 0) + Number(p1Obj?.assists || 0) + Number(p2Obj?.goals || 0) + Number(p2Obj?.assists || 0);
      }
    }
  });

  Object.values(pMap).forEach(u => {
    RECENT_FORM_MAP[u.name] = +(u.ratSum / Math.max(1, u.games)).toFixed(2);
    RECENT_10_STATS_MAP[u.name] = u;
  });

  SHAME_LIST_CACHE = Object.values(pMap);

  // Render Dynamic Duo & Toughest Opponent Intel Cards
  const intelSec = document.getElementById('intelSection');
  if (intelSec) {
    intelSec.classList.remove('hidden');
    const duos = Object.values(duoMap).sort((a, b) => (b.wins * 15 + b.combinedGA * 4 + b.games) - (a.wins * 15 + a.combinedGA * 4 + a.games));
    if (duos.length) {
      const topDuo = duos[0];
      const wp = Math.round((topDuo.wins / Math.max(1, topDuo.games)) * 100);
      document.getElementById('duoNames').innerText = `${topDuo.p1} & ${topDuo.p2}`;
      document.getElementById('duoMeta').innerText = `${topDuo.games} GP Together (${wp}% Win) • ${topDuo.combinedGA} Combined G+A`;
      document.getElementById('duoAvatars').innerHTML = `${renderAvatarWithFlagHtml(topDuo.p1, 'w-10 h-10', 'border-emerald-400', 'w-3.5 h-2.5')}${renderAvatarWithFlagHtml(topDuo.p2, 'w-10 h-10', 'border-emerald-400', 'w-3.5 h-2.5')}`;
    }
    if (oppList.length) {
      const toughest = [...oppList].sort((a, b) => (b.oppSr + (b.oppG - b.myG) * 60) - (a.oppSr + (a.oppG - a.myG) * 60))[0];
      const resChar = toughest.myG > toughest.oppG ? 'W' : (toughest.myG < toughest.oppG ? 'L' : 'D');
      document.getElementById('nemesisName').innerText = toughest.oppName;
      document.getElementById('nemesisMeta').innerText = `${toughest.oppSr} SR • Result: ${resChar} (${toughest.myG}-${toughest.oppG})`;
      if (typeof renderCrestHtml === 'function') {
        document.getElementById('nemesisCrest').innerHTML = renderCrestHtml(toughest.oppName, toughest.crestId, 'w-11 h-11', toughest.oppId);
      }
    }
  }

  if (typeof updateRecapMetricsDisplay === 'function') {
    updateRecapMetricsDisplay(clubId, CURRENT_RECAP_MODE === 'session' ? SESSION_MATCHES_CACHE : recent10, CURRENT_RECAP_MODE);
  }
  if (typeof renderShameBoard === 'function') {
    renderShameBoard(SHAME_LIST_CACHE);
  }

  return SHAME_LIST_CACHE;
}
