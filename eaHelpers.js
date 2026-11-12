export const EA_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': 'https://www.ea.com/',
  'Origin': 'https://www.ea.com'
};

export async function eaFetch(url, timeoutMs = 8000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { headers: EA_HEADERS, signal: ctrl.signal });
    return r.ok ? await r.json() : null;
  } catch (_) {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export const valOf = (res) => (res?.status === 'fulfilled' && res.value ? res.value : {});

export function unwrapEa(payload, clubId) {
  if (!payload) return {};
  if (Array.isArray(payload)) return payload[0] || {};
  if (typeof payload === 'object') {
    if (clubId && payload[clubId] && typeof payload[clubId] === 'object') return payload[clubId];
    const v = Object.values(payload);
    return (v.length === 1 && v[0] && typeof v[0] === 'object' && !Array.isArray(v[0])) ? v[0] : payload;
  }
  return {};
}

export function extractClubId(o, key = null) {
  const c = o?.clubId || o?.id || o?.clubInfo?.clubId || (key && /^\d+$/.test(String(key)) ? key : null);
  return c && Number(c) > 0 ? String(c) : null;
}

export function resolveCrestId(info = {}, stat = {}, matchClub = {}) {
  const det = matchClub?.details || {}, ck = info?.customKit || det?.customKit || stat?.customKit || matchClub?.customKit || {};
  if (String(ck.selectedKitType ?? info?.selectedKitType ?? det?.selectedKitType ?? '') === '0') {
    const auth = info?.teamId || det?.teamId || matchClub?.TEAM || stat?.teamId;
    if (auth && String(auth) !== '0') return String(auth);
  }
  const cands = [matchClub?.crestId, matchClub?.TEAM, ck.crestAssetId, ck.crestId, info?.crestAssetId, det?.crestAssetId, info?.teamId, det?.teamId, stat?.crestAssetId, stat?.teamId];
  const hit = cands.find(c => c !== undefined && c !== null && !['', '0', '-1'].includes(String(c).trim()));
  return hit ? String(hit).trim() : null;
}

export function mapEaOneToSixDivision(raw) {
  if (raw === undefined || raw === null || raw === '') return null;
  const s = String(raw).trim().toLowerCase();
  if (s === 'elite') return 0;
  const n = parseInt(s.replace(/[^0-9-]/g, ''), 10);
  return (isNaN(n) || n < 1 || n > 6) ? null : n - 1;
}

export const fmtDiv = (n) => (n === null || n === undefined || isNaN(n)) ? 'Div 5' : (n <= 0 ? 'Elite' : `Div ${Math.min(5, Math.max(1, n))}`);

export function resolveClubDivisions(currSeasonLb = {}, allTimeLb = {}, stat = {}) {
  const sr = Number(stat.skillRating ?? stat.rating ?? allTimeLb.skillRating ?? currSeasonLb.skillRating ?? 1500);
  const promos = Math.max(Number(currSeasonLb.promotions || 0), Number(stat.promotions || 0), Number(allTimeLb.promotions || 0));
  const relegs = Math.max(Number(currSeasonLb.relegations || 0), Number(stat.relegations || 0), Number(allTimeLb.relegations || 0));
  const totalGames = Number(stat.wins ?? stat.overallWins ?? 0) + Number(stat.ties ?? stat.overallTies ?? 0) + Number(stat.losses ?? stat.overallLosses ?? 0);

  const minByPromo = Math.max(0, 5 - promos);
  if (promos <= 0) return { currDivNum: 5, divisionLabel: 'Div 5', peakDivNum: 5, peakDivisionLabel: 'Div 5' };

  let curr = mapEaOneToSixDivision(currSeasonLb.currentDivision ?? allTimeLb.currentDivision ?? stat.currentDivision);
  if (curr === null) {
    const netClimb = Math.max(0, promos - relegs);
    const srEst = (totalGames >= 15 && sr >= 2050) ? 0 : (totalGames >= 12 && sr >= 1880) ? 1 : (totalGames >= 10 && sr >= 1700) ? 2 : (totalGames >= 8 && sr >= 1540) ? 3 : (promos >= 1 && sr >= 1320) ? 4 : 5;
    const daysIntoSeason = (Math.max(1, (Date.now() - new Date('2026-09-24T00:00:00Z').getTime()) / 86400000)) % 42;
    const estClimb = netClimb > 0 ? Math.min(netClimb, Math.max(1, Math.round(promos * Math.max(0.22, daysIntoSeason / 42)))) : 1;
    curr = Math.min(Math.max(0, 5 - estClimb), srEst);
  }
  curr = Math.min(5, Math.max(curr, minByPromo));

  const allowElite = (curr === 0 || (promos >= 5 && sr >= 1950));
  const bestCands = [curr, mapEaOneToSixDivision(currSeasonLb.bestDivision), mapEaOneToSixDivision(allTimeLb.bestDivision), mapEaOneToSixDivision(stat.bestDivision)]
    .filter(n => n !== null && n >= 0 && n <= 5 && (n !== 0 || allowElite))
    .map(n => Math.max(n, minByPromo));
  const peak = Math.min(curr, ...(bestCands.length ? bestCands : [curr]));
  return { currDivNum: curr, divisionLabel: fmtDiv(curr), peakDivNum: peak, peakDivisionLabel: fmtDiv(peak) };
}

export function eaIntToHex(val, fb = '#10b981') {
  const n = parseInt(val, 10);
  return (isNaN(n) || n < 0) ? fb : `#${(n & 0xFFFFFF).toString(16).padStart(6, '0')}`;
}

export function resolveClubRegion(infoObj = {}, statObj = {}, lbClubInfo = {}) {
  let num = parseInt(infoObj.regionId ?? lbClubInfo.regionId ?? statObj.regionId ?? 0, 10), ascii = '';
  while (num > 0) { const ch = num % 256; if (ch >= 32 && ch <= 126) ascii = String.fromCharCode(ch) + ascii; num = Math.floor(num / 256); }
  ascii = ascii.trim().toUpperCase();

  const codeMap = {
    'BRI':{name:'British Isles',flag:'eu'}, 'BI':{name:'British Isles',flag:'eu'}, 'WEU':{name:'Western Europe',flag:'eu'},
    'CEU':{name:'Central Europe',flag:'eu'}, 'NEU':{name:'Northern Europe',flag:'eu'}, 'SEU':{name:'Southern Europe',flag:'eu'},
    'EEU':{name:'Eastern Europe',flag:'eu'}, 'EUS':{name:'NA East',flag:'us'}, 'ENA':{name:'NA East',flag:'us'}, 'NAE':{name:'NA East',flag:'us'},
    'WUS':{name:'NA West',flag:'us'}, 'WNA':{name:'NA West',flag:'us'}, 'NAW':{name:'NA West',flag:'us'}, 'CUS':{name:'NA Central',flag:'us'},
    'CAM':{name:'Central America',flag:'mx'}, 'SAM':{name:'South America',flag:'br'}, 'SA':{name:'South America',flag:'br'},
    'MEA':{name:'Middle East',flag:'sa'}, 'ME':{name:'Middle East',flag:'sa'}, 'SAF':{name:'Southern Africa',flag:'za'},
    'NAF':{name:'Northern Africa',flag:'ma'}, 'EAS':{name:'East Asia',flag:'jp'}, 'SAS':{name:'South Asia',flag:'in'},
    'SEA':{name:'Southeast Asia',flag:'sg'}, 'ASIA':{name:'Asia',flag:'jp'}, 'ANZ':{name:'Australia & NZ',flag:'au'}, 'OCE':{name:'Oceania',flag:'au'}
  };
  if (ascii && codeMap[ascii]) return codeMap[ascii];

  const sdkLabel = String(infoObj.regionLabel ?? infoObj.derivedLabels?.regionLabel ?? lbClubInfo.regionLabel ?? '').trim();
  if (sdkLabel) {
    const low = sdkLabel.toLowerCase();
    const flag = (low.includes('british') || low.includes('europe')) ? 'eu' : (low.includes('us') || low.includes('america')) ? 'us' : low.includes('south america') ? 'br' : low.includes('middle east') ? 'sa' : low.includes('africa') ? 'za' : (low.includes('australia') || low.includes('oceania')) ? 'au' : low.includes('asia') ? 'jp' : null;
    return { name: sdkLabel, flag };
  }
  return { name: 'Global Matchmaking', flag: null };
}

export function computeGlobalPercentile(sr, w, l, d, currDiv) {
  const s = Number(sr || 0), tot = w + l + d;
  if (tot < 6) return { percentile: w > l ? 35 : 55, label: `Top ${w > l ? 35 : 55}% Worldwide` };
  let pct = s >= 2100 ? 0.5 : s >= 1950 ? 1 : s >= 1800 ? 2 : s >= 1700 ? 4 : s >= 1600 ? 7 : s >= 1500 ? 12 : s >= 1400 ? 18 : s >= 1300 ? 28 : s >= 1150 ? 42 : 55;
  if (currDiv === 0) pct = Math.min(pct, 2); else if (currDiv === 1) pct = Math.min(pct, 6); else if (currDiv === 2) pct = Math.min(pct, 12);
  if (tot > 0 && w / tot >= 0.6) pct = Math.max(0.5, pct - 2);
  return { percentile: pct, label: `Top ${pct}% Worldwide` };
}

export function computeClubRepAndFans(stat = {}, currSeasonLb = {}, info = {}, allTimeLb = {}, currDiv = 5, peakDiv = 5) {
  const w = Number(stat.wins ?? stat.overallWins ?? allTimeLb.wins ?? 0);
  const d = Number(stat.ties ?? stat.overallTies ?? allTimeLb.ties ?? 0);
  const l = Number(stat.losses ?? stat.overallLosses ?? allTimeLb.losses ?? 0);
  const gf = Number(stat.goals ?? stat.overallGoals ?? allTimeLb.goals ?? 0);
  const sr = Number(stat.skillRating ?? stat.rating ?? allTimeLb.skillRating ?? 1500);
  const promos = Math.max(Number(currSeasonLb.promotions || 0), Number(stat.promotions || 0), Number(allTimeLb.promotions || 0));
  const titles = Math.max(Number(currSeasonLb.titlesWon || 0), Number(stat.titlesWon || 0), Number(allTimeLb.titlesWon || 0));
  const totalGames = w + d + l;

  const LEVEL_BRACKETS = {
    1:{min:50000,max:349000,title:'Grassroots'}, 2:{min:350000,max:999000,title:'Hometown'},
    3:{min:1000000,max:2499000,title:'Emerging'}, 4:{min:2500000,max:4999000,title:'Up and Coming'},
    5:{min:5000000,max:7499000,title:'Up and Coming'}, 6:{min:7500000,max:11999000,title:'Established'},
    7:{min:12000000,max:18999000,title:'Established'}, 8:{min:19000000,max:28999000,title:'Renowned'},
    9:{min:29000000,max:44999000,title:'Renowned'}, 10:{min:45000000,max:95000000,title:'World Class'}
  };

  const rawFans = Number(stat.fans ?? stat.fanCount ?? allTimeLb.fans ?? info.fans ?? 0);
  const peakDivBonus = Math.max(0, (5 - peakDiv) * 145000);
  const srBonus = totalGames >= 10 ? Math.max(0, (sr - 1250) * 480) : 0;
  let calcFans = 85000 + (totalGames * 10900) + (w * 16000) + (d * 4600) + (gf * 1210) + (promos * 95000) + (titles * 280000) + peakDivBonus + srBonus;

  let calcLvl = 1;
  for (let lv = 10; lv >= 1; lv--) { if (calcFans >= LEVEL_BRACKETS[lv].min) { calcLvl = lv; break; } }

  const explicitLvl = Number(allTimeLb.reputationlevel ?? allTimeLb.reputationLevel ?? currSeasonLb.reputationlevel ?? stat.reputationlevel ?? 0);
  const level = (explicitLvl >= 1 && explicitLvl <= 10) ? Math.max(explicitLvl, calcLvl >= 5 && explicitLvl === 4 ? 5 : explicitLvl) : calcLvl;

  const b = LEVEL_BRACKETS[level] || LEVEL_BRACKETS[5];
  if (calcFans < b.min) calcFans = Math.round(b.min + (b.max - b.min) * 0.62);
  else if (calcFans > b.max) calcFans = Math.round(b.min + (b.max - b.min) * 0.66);

  const fans = rawFans > 10000 ? rawFans : Math.round(calcFans);
  const formattedFans = fans >= 1000000 ? `~${(fans / 1000000).toFixed(1)}M` : `~${Math.max(50, Math.round(fans / 10000) * 10)}K`;
  return { fans, formattedFans, level, tierTitle: b.title };
}

export function buildSeasonsHistory(currSeasonLb = {}, stat = {}, currDiv = 5, peakDiv = 5) {
  const promos = Math.max(Number(currSeasonLb.promotions || 0), Number(stat.promotions || 0));
  const relegs = Math.max(Number(currSeasonLb.relegations || 0), Number(stat.relegations || 0));
  const titles = Math.max(Number(currSeasonLb.titlesWon || 0), Number(stat.titlesWon || 0));
  const tW = Number(stat.wins ?? stat.overallWins ?? 0), tD = Number(stat.ties ?? stat.overallTies ?? 0), tL = Number(stat.losses ?? stat.overallLosses ?? 0);
  const tGF = Number(stat.goals ?? stat.overallGoals ?? 0), tGA = Number(stat.goalsAgainst ?? stat.overallGoalsAgainst ?? 0);
  const days = Math.max(1, (Date.now() - new Date('2026-09-24T00:00:00Z').getTime()) / 86400000);
  const count = (tW + tD + tL) < 10 ? 1 : Math.max(1, Math.min(10, Math.ceil(days / 42)));

  const csW = currSeasonLb.wins !== undefined ? Number(currSeasonLb.wins) : null;
  const csD = currSeasonLb.ties !== undefined ? Number(currSeasonLb.ties) : null;
  const csL = currSeasonLb.losses !== undefined ? Number(currSeasonLb.losses) : null;
  if (count <= 1) {
    return { totalSeasonsCount: 1, list: [{ seasonNumber: 1, label: 'Season 1 (Current)', divisionNum: currDiv, division: fmtDiv(currDiv), wins: tW, draws: tD, losses: tL, goalsFor: tGF, goalsAgainst: tGA, points: tW * 3 + tD, outcome: `IN PROGRESS (${promos}⬆️ ${relegs}⬇️)`, badgeType: 'active', isCurrent: true }] };
  }
  if (csW !== null && (csW + csD + csL) <= (tW + tD + tL) && count === 2) {
    const s1W = Math.max(0, tW - csW), s1D = Math.max(0, tD - csD), s1L = Math.max(0, tL - csL);
    const s1GF = Math.max(0, tGF - Number(currSeasonLb.goals || 0)), s1GA = Math.max(0, tGA - Number(currSeasonLb.goalsAgainst || 0));
    const csP = Number(currSeasonLb.promotions || 0), csR = Number(currSeasonLb.relegations || 0);
    return {
      totalSeasonsCount: 2,
      list: [
        { seasonNumber: 2, label: 'Season 2 (Current)', divisionNum: currDiv, division: fmtDiv(currDiv), wins: csW, draws: csD, losses: csL, goalsFor: Number(currSeasonLb.goals || 0), goalsAgainst: Number(currSeasonLb.goalsAgainst || 0), points: csW * 3 + csD, outcome: `IN PROGRESS (${csP}⬆️ ${csR}⬇️)`, badgeType: 'active', isCurrent: true },
        { seasonNumber: 1, label: 'Season 1', divisionNum: peakDiv, division: fmtDiv(peakDiv), wins: s1W, draws: s1D, losses: s1L, goalsFor: s1GF, goalsAgainst: s1GA, points: s1W * 3 + s1D, outcome: titles > 0 ? `TITLE WINNER (${Math.max(0,promos-csP)}⬆️ ${Math.max(0,relegs-csR)}⬇️)` : `COMPLETED (${Math.max(0,promos-csP)}⬆️ ${Math.max(0,relegs-csR)}⬇️)`, badgeType: titles > 0 ? 'title' : 'promo', isCurrent: false }
      ]
    };
  }
  return { totalSeasonsCount: 1, list: [{ seasonNumber: 1, label: 'All-Time Summary', divisionNum: currDiv, division: fmtDiv(currDiv), wins: tW, draws: tD, losses: tL, goalsFor: tGF, goalsAgainst: tGA, points: tW * 3 + tD, outcome: `ACTIVE (${promos}⬆️ ${relegs}⬇️)`, badgeType: 'active', isCurrent: true }] };
}

export function generateFallbackSvg(name) {
  const init = (name || 'FC').substring(0, 2).toUpperCase();
  const pals = [['#10b981','#064e3b','#34d399'], ['#3b82f6','#1e3a8a','#60a5fa'], ['#f59e0b','#78350f','#fbbf24'], ['#8b5cf6','#4c1d95','#a78bfa']];
  let h = 0; for (let i = 0; i < (name || '').length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  const [b1, b2, st] = pals[Math.abs(h) % pals.length];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 115"><defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="${b1}"/><stop offset="100%" stop-color="${b2}"/></linearGradient></defs><path d="M50 5 C80 5 95 15 95 35 C95 75 50 110 50 110 C50 110 5 75 5 35 C5 15 20 5 50 5 Z" fill="url(#g)" stroke="${st}" stroke-width="4"/><text x="50" y="66" font-family="sans-serif" font-size="29" font-weight="900" fill="#fff" text-anchor="middle">${init}</text></svg>`;
}
