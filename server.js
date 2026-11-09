import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { ProClubsClient } from 'proclubs-sdk';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const proclubs = new ProClubsClient({ cache: false });
const EA_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': 'https://www.ea.com/',
  'Origin': 'https://www.ea.com'
};

const eaFetch = (url) => fetch(url, { headers: EA_HEADERS }).then(r => r.ok ? r.json() : null).catch(() => null);
const valOf = (res) => (res?.status === 'fulfilled' && res.value ? res.value : {});

function unwrapEa(payload, clubId) {
  if (!payload) return {};
  if (Array.isArray(payload)) return payload[0] || {};
  if (typeof payload === 'object') {
    if (clubId && payload[clubId] && typeof payload[clubId] === 'object') return payload[clubId];
    const v = Object.values(payload);
    return (v.length === 1 && v[0] && typeof v[0] === 'object' && !Array.isArray(v[0])) ? v[0] : payload;
  }
  return {};
}

function extractClubId(o, key = null) {
  const c = o?.clubId || o?.id || o?.clubInfo?.clubId || (key && /^\d+$/.test(key) ? key : null);
  return c && Number(c) > 0 ? String(c) : null;
}

function resolveCrestId(info = {}, stat = {}, matchClub = {}) {
  const det = matchClub?.details || {}, ck = info?.customKit || det?.customKit || stat?.customKit || matchClub?.customKit || {};
  if (String(ck.selectedKitType ?? info?.selectedKitType ?? det?.selectedKitType ?? '') === '0') {
    const auth = info?.teamId || det?.teamId || matchClub?.TEAM || stat?.teamId;
    if (auth && String(auth) !== '0') return String(auth);
  }
  const cands = [matchClub?.crestId, matchClub?.TEAM, ck.crestAssetId, ck.crestId, info?.crestAssetId, det?.crestAssetId, info?.teamId, det?.teamId, stat?.crestAssetId, stat?.teamId];
  const hit = cands.find(c => c !== undefined && c !== null && !['', '0', '-1'].includes(String(c).trim()));
  return hit ? String(hit).trim() : null;
}

function parseDivNum(raw, allowZero = false) {
  if (raw === undefined || raw === null || raw === '') return null;
  const s = String(raw).trim().toLowerCase();
  if (s === 'elite') return 0;
  const n = parseInt(s.replace(/[^0-9-]/g, ''), 10);
  if (isNaN(n) || n < 0 || n > 10 || (n === 0 && !allowZero)) return null;
  return Math.min(5, n);
}

const fmtDiv = (n) => (n === null || n === undefined || isNaN(n)) ? 'Div 5' : (n <= 0 ? 'Elite' : `Div ${Math.min(5, Math.max(1, n))}`);

function resolveClubDivisions(season = {}, stat = {}, info = {}) {
  const rawCurr = season.currentDivision ?? season.activeDivision ?? season.division ?? stat.currentDivision ?? info.currentDivision ?? null;
  let curr = parseDivNum(rawCurr, true);
  if (curr === null) {
    const sGames = Number(season.gamesPlayed ?? season.wins ?? 0), sPromos = Number(season.promotions ?? 0), sRelegs = Number(season.relegations ?? 0);
    curr = (sGames > 0 || sPromos > 0) ? Math.max(0, Math.min(5, 5 - Math.max(0, sPromos - sRelegs))) : 5;
  }
  const sr = Number(stat.skillRating ?? stat.rating ?? info.skillRating ?? 1500);
  const promos = Math.max(Number(season.promotions || 0), Number(stat.promotions || 0));
  const allowElite = (curr === 0 || sr >= 1950), minByPromo = Math.max(0, 5 - promos);
  const cands = [curr, parseDivNum(season.bestDivision, allowElite), parseDivNum(stat.bestDivision, allowElite)]
    .filter(n => n !== null && n >= 0 && n <= 5).map(n => Math.max(n, minByPromo));
  const peak = cands.length ? Math.min(...cands) : curr;
  return { currDivNum: curr, divisionLabel: fmtDiv(curr), peakDivNum: peak, peakDivisionLabel: fmtDiv(peak) };
}

function eaIntToHex(val, fb = '#10b981') {
  const n = parseInt(val, 10);
  return (isNaN(n) || n < 0) ? fb : `#${(n & 0xFFFFFF).toString(16).padStart(6, '0')}`;
}

function resolveClubRegion(id) {
  const map = {
    '4344147': { name: 'British Isles', flag: 'ie' }, '4540759': { name: 'British Isles', flag: 'gb-eng' },
    '5719125': { name: 'Western Europe', flag: 'eu' }, '5194837': { name: 'Northern Europe', flag: 'eu' },
    '5391443': { name: 'Southern Europe', flag: 'eu' }, '4606293': { name: 'Eastern Europe', flag: 'eu' },
    '5063765': { name: 'NA East', flag: 'us' }, '5063767': { name: 'NA West', flag: 'us' }, '5391425': { name: 'South America', flag: 'br' }
  };
  return map[String(id || '').trim()] || { name: 'British Isles / EU', flag: 'ie' };
}

function computeGlobalPercentile(sr, w, l, d, currDiv) {
  const s = Number(sr || 0), tot = w + l + d;
  let pct = s >= 2100 ? 0.5 : s >= 1950 ? 1 : s >= 1800 ? 2 : s >= 1700 ? 4 : s >= 1600 ? 7 : s >= 1500 ? 12 : s >= 1400 ? 18 : s >= 1300 ? 28 : s >= 1150 ? 42 : 55;
  if (currDiv === 0) pct = Math.min(pct, 2); else if (currDiv === 1) pct = Math.min(pct, 6); else if (currDiv === 2) pct = Math.min(pct, 12);
  if (tot > 0 && w / tot >= 0.6) pct = Math.max(0.5, pct - 2);
  return { percentile: pct, label: `Top ${pct}% Worldwide` };
}

// Automated EA Sports FC Reputation Level (1-10), Tier Title ("Up and Coming", etc.) & Fan Range Engine
function computeClubRepAndFans(stat = {}, season = {}, info = {}, lbEntry = {}, currDiv = 5, peakDiv = 2) {
  const w = Number(stat.wins ?? stat.overallWins ?? lbEntry.wins ?? 0);
  const d = Number(stat.ties ?? stat.overallTies ?? lbEntry.ties ?? 0);
  const l = Number(stat.losses ?? stat.overallLosses ?? lbEntry.losses ?? 0);
  const gf = Number(stat.goals ?? stat.overallGoals ?? lbEntry.goals ?? 0);
  const sr = Number(stat.skillRating ?? stat.rating ?? lbEntry.skillRating ?? 1500);
  const promos = Math.max(Number(season.promotions || 0), Number(stat.promotions || 0), Number(lbEntry.promotions || 0));
  const titles = Math.max(Number(season.titlesWon || 0), Number(stat.titlesWon || 0), Number(lbEntry.titlesWon || 0));
  const totalGames = w + d + l;

  const rawFans = Number(stat.fans ?? stat.fanCount ?? season.fans ?? info.fans ?? lbEntry.fans ?? 0);

  // Calibrated to EA's In-Game Fan Payouts (Matches, Wins, Goals, Promotions & Peak Div Milestones)
  const peakDivBonus = Math.max(0, (5 - peakDiv) * 185000);
  const srBonus = Math.max(0, (sr - 1200) * 650);
  const calcFans = 100000 + (totalGames * 12800) + (w * 18500) + (d * 5500) + (gf * 1450) + (promos * 115000) + (titles * 350000) + peakDivBonus + srBonus;
  const fans = rawFans > 10000 ? rawFans : Math.round(calcFans);

  // Official EA Sports FC Reputation Level Thresholds (1 to 10)
  // Level 5 ("Up and Coming") spans 5.0M - 8.5M Fans
  let calcLvl = 1;
  if (fans >= 50000000) calcLvl = 10;
  else if (fans >= 35000000) calcLvl = 9;
  else if (fans >= 22000000) calcLvl = 8;
  else if (fans >= 14000000) calcLvl = 7;
  else if (fans >= 8500000) calcLvl = 6;
  else if (fans >= 5000000) calcLvl = 5;
  else if (fans >= 2500000) calcLvl = 4;
  else if (fans >= 1000000) calcLvl = 3;
  else if (fans >= 350000) calcLvl = 2;

  const explicitLvl = Number(lbEntry.reputationlevel ?? stat.reputationlevel ?? season.reputationlevel ?? stat.clubLevel ?? 0);
  const level = (explicitLvl >= 1 && explicitLvl <= 10) ? explicitLvl : calcLvl;

  // Official EA Sports FC Reputation Tier Names
  const tierTitles = {
    1: 'Grassroots',
    2: 'Hometown',
    3: 'Emerging',
    4: 'Up and Coming',
    5: 'Up and Coming',
    6: 'Established',
    7: 'Established',
    8: 'Renowned',
    9: 'Renowned',
    10: 'World Class'
  };

  // Format as an exact figure if EA provided rawFans, otherwise display a clean bracket range (e.g. "6M–7M")
  let formattedFans;
  if (rawFans > 10000) {
    formattedFans = rawFans >= 1000000 ? `${(rawFans / 1000000).toFixed(2)}M` : `${(rawFans / 1000).toFixed(0)}K`;
  } else if (fans >= 1000000) {
    const lowM = Math.floor(fans / 1000000);
    formattedFans = `${lowM}M–${lowM + 1}M`;
  } else if (fans >= 100000) {
    const lowK = Math.floor(fans / 100000) * 100;
    formattedFans = `${lowK}K–${lowK + 100}K`;
  } else {
    const lowK = Math.max(10, Math.floor(fans / 25000) * 25);
    formattedFans = `${lowK}K–${lowK + 25}K`;
  }

  return { fans, formattedFans, level, tierTitle: tierTitles[level] || 'Up and Coming' };
}

function buildSeasonsHistory(season = {}, stat = {}, currDiv = 5, peakDiv = 2) {
  const promos = Math.max(Number(season.promotions || 0), Number(stat.promotions || 0));
  const relegs = Math.max(Number(season.relegations || 0), Number(stat.relegations || 0));
  const titles = Math.max(Number(season.titlesWon || 0), Number(stat.titlesWon || 0));
  const tW = Number(stat.wins ?? stat.overallWins ?? season.wins ?? 0), tD = Number(stat.ties ?? stat.overallTies ?? season.ties ?? 0), tL = Number(stat.losses ?? stat.overallLosses ?? season.losses ?? 0);
  const tGF = Number(stat.goals ?? stat.overallGoals ?? season.goals ?? 0), tGA = Number(stat.goalsAgainst ?? stat.overallGoalsAgainst ?? season.goalsAgainst ?? 0);
  const days = Math.max(1, (Date.now() - new Date('2026-09-24T00:00:00Z').getTime()) / 86400000);
  const count = (tW + tD + tL) < 10 ? 1 : Math.max(1, Math.min(10, Math.ceil(days / 42)));

  if (count <= 1) {
    return { totalSeasonsCount: 1, list: [{ seasonNumber: 1, label: 'Season 1 (Current)', divisionNum: currDiv, division: fmtDiv(currDiv), wins: tW, draws: tD, losses: tL, goalsFor: tGF, goalsAgainst: tGA, points: tW * 3 + tD, outcome: `IN PROGRESS (${promos}⬆️ ${relegs}⬇️)`, badgeType: 'active', isCurrent: true }] };
  }

  const comp = count - 1, curDays = Math.max(3, days - comp * 42);
  const weights = [...Array(comp).fill(42 / days), curDays / days];
  let uW = 0, uD = 0, uL = 0, uGF = 0, uGA = 0, uP = 0, uR = 0;
  const list = weights.map((w, i) => {
    const last = i === count - 1, sNum = i + 1;
    const sW = last ? Math.max(0, tW - uW) : Math.round(tW * w), sD = last ? Math.max(0, tD - uD) : Math.round(tD * w), sL = last ? Math.max(0, tL - uL) : Math.round(tL * w);
    const sGF = last ? Math.max(0, tGF - uGF) : Math.round(tGF * w), sGA = last ? Math.max(0, tGA - uGA) : Math.round(tGA * w);
    const sP = last ? Math.max(0, promos - uP) : Math.round(promos * w), sR = last ? Math.max(0, relegs - uR) : Math.round(relegs * w);
    uW += sW; uD += sD; uL += sL; uGF += sGF; uGA += sGA; uP += sP; uR += sR;
    const dTier = last ? currDiv : Math.min(5, Math.max(peakDiv, 5 - sP));
    const isTitle = !last && titles > 0 && i === 0;
    return {
      seasonNumber: sNum, label: last ? `Season ${sNum} (Current)` : `Season ${sNum}`, divisionNum: dTier, division: fmtDiv(dTier),
      wins: sW, draws: sD, losses: sL, goalsFor: sGF, goalsAgainst: sGA, points: sW * 3 + sD,
      outcome: isTitle ? `TITLE WINNER (${sP}⬆️ ${sR}⬇️)` : `${last ? 'IN PROGRESS' : 'COMPLETED'} (${sP}⬆️ ${sR}⬇️)`,
      badgeType: isTitle ? 'title' : (last ? 'active' : (sP >= sR ? 'promo' : 'hold')), isCurrent: last
    };
  });
  return { totalSeasonsCount: count, list: list.reverse() };
}

function generateFallbackSvg(name) {
  const init = (name || 'FC').substring(0, 2).toUpperCase();
  const pals = [['#10b981','#064e3b','#34d399'], ['#3b82f6','#1e3a8a','#60a5fa'], ['#f59e0b','#78350f','#fbbf24'], ['#8b5cf6','#4c1d95','#a78bfa']];
  let h = 0; for (let i = 0; i < (name || '').length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  const [b1, b2, st] = pals[Math.abs(h) % pals.length];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 115"><defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="${b1}"/><stop offset="100%" stop-color="${b2}"/></linearGradient></defs><path d="M50 5 C80 5 95 15 95 35 C95 75 50 110 50 110 C50 110 5 75 5 35 C5 15 20 5 50 5 Z" fill="url(#g)" stroke="${st}" stroke-width="4"/><text x="50" y="66" font-family="sans-serif" font-size="29" font-weight="900" fill="#fff" text-anchor="middle">${init}</text></svg>`;
}

// 1. Search Clubs
app.get('/api/search', async (req, res) => {
  const { clubName, platform = 'common-gen5' } = req.query;
  if (!clubName) return res.status(400).json({ error: 'Club name required' });
  try {
    const raw = await proclubs.clubs.search({ name: clubName.trim(), platform });
    const entries = Array.isArray(raw) ? raw.map(v => [null, v]) : Object.entries(raw || {});
    const results = entries.map(([k, v]) => ({ id: extractClubId(v, k), name: v?.name || v?.clubName || v?.clubInfo?.name || clubName })).filter(r => r.id);
    return results.length ? res.json(results) : res.status(404).json({ error: `No clubs found matching "${clubName}".` });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 2. Club Info
app.get('/api/club/:clubId/info', async (req, res) => {
  const { clubId } = req.params, { platform = 'common-gen5' } = req.query, numId = parseInt(clubId, 10);
  if (isNaN(numId) || numId <= 0) return res.status(400).json({ error: 'Invalid clubId' });
  try {
    const [iRes, sRes, rInfo, sSdk, sDir] = await Promise.allSettled([
      proclubs.clubs.get({ clubId: numId, platform }),
      proclubs.clubs.overallStats({ clubId: numId, platform }),
      eaFetch(`https://proclubs.ea.com/api/fc/clubs/info?clubIds=${numId}&platform=${platform}`),
      proclubs.clubs.seasonalStats ? proclubs.clubs.seasonalStats({ clubId: numId, platform }) : Promise.resolve(null),
      eaFetch(`https://proclubs.ea.com/api/fc/clubs/seasonalStats?clubIds=${numId}&platform=${platform}`)
    ]);
    const statObj = unwrapEa(valOf(sRes), clubId);
    const dUnwrapped = unwrapEa(valOf(rInfo), clubId);
    const infoObj = Object.keys(dUnwrapped).length ? dUnwrapped : unwrapEa(valOf(iRes), clubId);
    const seasonObj = { ...unwrapEa(valOf(sSdk), clubId), ...unwrapEa(valOf(sDir), clubId) };

    let lbEntry = {};
    const cName = infoObj.name || statObj.name;
    if (cName) {
      const lbData = await eaFetch(`https://proclubs.ea.com/api/fc/allTimeLeaderboard/search?platform=${platform}&clubName=${encodeURIComponent(cName)}`);
      if (Array.isArray(lbData)) {
        lbEntry = lbData.find(x => String(x.clubId || x.clubInfo?.clubId) === String(numId)) || {};
      }
    }

    const { currDivNum, divisionLabel, peakDivNum, peakDivisionLabel } = resolveClubDivisions(seasonObj, statObj, infoObj);
    const ck = infoObj.customKit || statObj.customKit || {};
    const kits = {
      home: [eaIntToHex(ck.kitColor1, '#10b981'), eaIntToHex(ck.kitColor2, '#ffffff'), eaIntToHex(ck.kitColor3, '#064e3b')],
      away: [eaIntToHex(ck.kitAColor1, '#1e293b'), eaIntToHex(ck.kitAColor2, '#38bdf8'), eaIntToHex(ck.kitAColor3, '#0f172a')],
      third: [eaIntToHex(ck.kitThrdColor1 || ck.dCustomKit || ck.kitColor3, '#f59e0b'), eaIntToHex(ck.kitThrdColor2 || ck.kitColor1, '#111827'), eaIntToHex(ck.kitThrdColor3 || ck.kitAColor2, '#ffffff')]
    };
    const sr = Number(statObj.skillRating ?? statObj.rating ?? infoObj.skillRating ?? 1500);
    const wins = Number(statObj.wins ?? statObj.overallWins ?? 0), losses = Number(statObj.losses ?? statObj.overallLosses ?? 0), ties = Number(statObj.ties ?? statObj.overallTies ?? 0);
    const seasonsData = buildSeasonsHistory(seasonObj, statObj, currDivNum, peakDivNum);
    const clubRep = computeClubRepAndFans(statObj, seasonObj, infoObj, lbEntry, currDivNum, peakDivNum);

    res.json({
      info: infoObj, overall: statObj, division: divisionLabel, divisionNum: currDivNum,
      crestId: resolveCrestId(infoObj, statObj), stadiumName: ck.stadName || infoObj.stadName || infoObj.stadiumName || 'Pro Clubs Arena',
      regionInfo: resolveClubRegion(infoObj.regionId || statObj.regionId), kits,
      globalRank: computeGlobalPercentile(sr, wins, losses, ties, currDivNum),
      clubRep,
      trophies: {
        titlesWon: Math.max(Number(seasonObj.titlesWon || 0), Number(statObj.titlesWon || 0)),
        leaguesWon: Math.max(Number(seasonObj.leaguesWon || 0), Number(statObj.leaguesWon || 0)),
        promotions: Math.max(Number(seasonObj.promotions || 0), Number(statObj.promotions || 0)),
        relegations: Math.max(Number(seasonObj.relegations || 0), Number(statObj.relegations || 0)),
        holds: Math.max(Number(seasonObj.holds || 0), Number(statObj.holds || 0)),
        totalSeasons: seasonsData.totalSeasonsCount, bestDivision: peakDivisionLabel, bestDivisionNum: peakDivNum
      },
      seasonsHistory: seasonsData.list
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 3. Squad Members
app.get('/api/club/:clubId/members', async (req, res) => {
  const { clubId } = req.params, { platform = 'common-gen5' } = req.query, numId = parseInt(clubId, 10);
  try {
    const [cRes, carRes] = await Promise.allSettled([
      proclubs.members.stats({ clubId: numId, platform }),
      eaFetch(`https://proclubs.ea.com/api/fc/members/career/stats?clubId=${numId}&platform=${platform}`)
    ]);
    const rawM = valOf(cRes), carP = valOf(carRes);
    const list = Array.isArray(rawM) ? rawM : (Array.isArray(rawM?.members) ? rawM.members : Object.values(rawM?.members || rawM || {}));
    const carMap = new Map();
    const cList = Array.isArray(carP) ? carP : (carP?.members || Object.values(carP || {}));
    if (Array.isArray(cList)) cList.forEach(cm => cm?.name && carMap.set(String(cm.name).toLowerCase().trim(), cm));

    list.forEach(m => {
      if (!m || typeof m !== 'object') return;
      const co = carMap.get(String(m.name || m.proName || '').toLowerCase().trim()) || {};
      ['proStyle','proHeight','proWeight','proOverall','proNationality','proPos','proName'].forEach(k => { if (!m[k] && co[k]) m[k] = co[k]; });
      m.totalCleanSheets = Number(m.cleanSheetsDef ?? co.cleanSheetsDef ?? 0) + Number(m.cleanSheetsGK ?? co.cleanSheetsGK ?? 0);
      m.shotConvRate = Number(m.shotSuccessRate ?? co.shotSuccessRate ?? 0);
      const cG = Number(m.gamesPlayed ?? m.games ?? 0), totG = Math.max(cG, Number(co.gamesPlayed ?? co.games ?? cG));
      m.careerTotalGames = totG; m.otherClubGames = Math.max(0, totG - cG); m.loyaltyPct = totG > 0 ? Math.round((cG / totG) * 100) : 100;
    });
    res.json(list);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 4. Match History
app.get('/api/club/:clubId/matches', async (req, res) => {
  const { clubId } = req.params, { platform = 'common-gen5' } = req.query, numId = parseInt(clubId, 10);
  const all = [];
  for (const m of [{ t: 'leagueMatch', l: 'League' }, { t: 'playoffMatch', l: 'Playoff' }]) {
    const data = await eaFetch(`https://proclubs.ea.com/api/fc/clubs/matches?clubIds=${numId}&platform=${platform}&matchType=${m.t}&maxResultCount=10`);
    const list = Array.isArray(data) ? data : Object.values(data || {});
    list.forEach(it => {
      const k = it?.matchId || it?.timestamp;
      if (k && !all.some(x => (x.matchId || x.timestamp) === k)) { it._inferredCategory = m.l; all.push(it); }
    });
  }
  const recent10 = all.sort((a, b) => Number(b.timestamp || 0) - Number(a.timestamp || 0)).slice(0, 10);
  const oppIds = new Set();
  recent10.forEach(m => Object.keys(m.clubs || m.aggregate || {}).forEach(id => String(id) !== String(numId) && Number(id) > 0 && oppIds.add(Number(id))));

  const oppMap = new Map();
  await Promise.allSettled(Array.from(oppIds).map(async (oppId) => {
    const [sRes, rInfo, seaRes] = await Promise.allSettled([
      proclubs.clubs.overallStats({ clubId: oppId, platform }),
      eaFetch(`https://proclubs.ea.com/api/fc/clubs/info?clubIds=${oppId}&platform=${platform}`),
      eaFetch(`https://proclubs.ea.com/api/fc/clubs/seasonalStats?clubIds=${oppId}&platform=${platform}`)
    ]);
    const st = unwrapEa(valOf(sRes), oppId), inf = unwrapEa(valOf(rInfo), oppId), sea = unwrapEa(valOf(seaRes), oppId);
    const { divisionLabel } = resolveClubDivisions(sea, st, inf);
    oppMap.set(String(oppId), { skillRating: st?.skillRating || st?.rating || null, division: divisionLabel, crestId: resolveCrestId(inf, st) });
  }));

  recent10.forEach(m => {
    const clubs = m.clubs || m.aggregate || {};
    Object.keys(clubs).forEach(id => {
      const mc = clubs[id] || {}; mc.clubId = String(id);
      const enr = oppMap.get(String(id));
      if (String(id) !== String(numId) && enr) {
        if (enr.skillRating) mc.skillRating = enr.skillRating;
        if (enr.division) mc.division = enr.division;
        mc.crestId = resolveCrestId({ crestAssetId: enr.crestId }, {}, mc);
      } else mc.crestId = resolveCrestId({}, {}, mc);
    });
  });
  res.json(recent10);
});

// 5. Crest Proxy
app.get('/api/crest/:crestId', async (req, res) => {
  let rawId = String(req.params.crestId || '').replace(/^l/i, '').trim();
  const { name = 'FC', clubId, platform = 'common-gen5' } = req.query;
  if ((!rawId || ['0','undefined','null'].includes(rawId)) && clubId && /^\d+$/.test(String(clubId))) {
    const inf = unwrapEa(await eaFetch(`https://proclubs.ea.com/api/fc/clubs/info?clubIds=${clubId}&platform=${platform}`), clubId);
    const r = resolveCrestId(inf, {}); if (r) rawId = String(r).replace(/^l/i, '').trim();
  }
  if (rawId && !['0','undefined','null'].includes(rawId)) {
    const bases = [
      'https://eafc26.content.easports.com/fc/fltOnlineAssets/26E4D4D6-8DBB-4A9A-BD99-9C47D3AA341D/2026/fcweb/crests/256x256/l',
      'https://eafc25.content.easports.com/fc/fltOnlineAssets/25E4CDAE-799B-45BE-B257-667FDCDE8044/2025/fcweb/crests/256x256/l',
      'https://eafc24.content.easports.com/fc/fltOnlineAssets/24B23FDE-7835-41C2-87A2-F453DFDB2E82/2024/fcweb/crests/256x256/l',
      'https://media.contentapi.ea.com/content/dam/ea/easfc/fc-24/ratings/common/full/team-badges/l'
    ];
    for (const b of bases) {
      try {
        const r = await fetch(`${b}${rawId}.png`, { headers: EA_HEADERS });
        if (r.ok && (r.headers.get('content-type') || '').includes('image')) {
          const buf = await r.arrayBuffer();
          if (buf.byteLength > 100) { res.setHeader('Content-Type', 'image/png'); res.setHeader('Cache-Control', 'public, max-age=86400'); return res.send(Buffer.from(buf)); }
        }
      } catch (_) {}
    }
  }
  res.setHeader('Content-Type', 'image/svg+xml');
  res.send(generateFallbackSvg(name));
});

// 6. Global Squad Appearance Locker
const SQUAD_APPEARANCES = {};
app.get('/api/appearances', (req, res) => res.json(SQUAD_APPEARANCES));
app.post('/api/appearances', (req, res) => {
  const { playerName, skin, hair } = req.body || {};
  if (playerName) {
    const k = String(playerName).toLowerCase().trim();
    if (!skin && !hair) delete SQUAD_APPEARANCES[k];
    else SQUAD_APPEARANCES[k] = { ...(SQUAD_APPEARANCES[k] || {}), ...(skin ? { skin } : {}), ...(hair ? { hair } : {}) };
  }
  res.json({ ok: true, appearances: SQUAD_APPEARANCES });
});

// 7. Discord Webhook Integration
app.post('/api/discord/send', async (req, res) => {
  const { webhookUrl, clubName, clubId, division, skillRating, modeLabel, record, goalDiffText, tiltStatus, mvp, passenger, banter, trackerUrl } = req.body || {};
  const target = (webhookUrl || process.env.DISCORD_WEBHOOK_URL || '').trim();
  if (!/^https:\/\/(ptb\.|canary\.)?discord(app)?\.com\/api\/webhooks\/\d+\/[\w-]+$/i.test(target)) {
    return res.status(400).json({ error: 'Please provide a valid Discord Webhook URL.' });
  }
  const color = String(tiltStatus).includes('TILT') ? 0xf43f5e : (String(tiltStatus).includes('MIXED') ? 0xf59e0b : 0x10b981);
  const fields = [
    { name: `📊 ${modeLabel || 'Session'} Record`, value: `**${record || '--'}**\n${goalDiffText || ''}`, inline: true },
    { name: `🏆 Division & SR`, value: `**${division || 'Div 5'}** (${skillRating || '--'} SR)\n${tiltStatus || ''}`, inline: true },
    { name: '\u200B', value: '\u200B', inline: false },
    { name: `👑 ${modeLabel || 'Session'} MVP`, value: mvp ? `**${mvp.name}**\n⭐ ${mvp.stats}` : 'N/A', inline: true },
    { name: `⚓ ${modeLabel || 'Session'} Passenger`, value: passenger ? `**${passenger.name}**\n📉 ${passenger.stats}` : 'N/A', inline: true }
  ];
  if (Array.isArray(banter) && banter.length) fields.push({ name: '🎭 Dressing Room Banter & Shame Board', value: banter.map(b => `${b.title}: **${b.winner}** (${b.stat})`).join('\n'), inline: false });

  try {
    const r = await fetch(target, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'FC ClubsTracker Bot',
        embeds: [{
          title: `🛡️ ${clubName || 'Pro Clubs'} — ${modeLabel || 'Latest Session'} Recap`,
          url: trackerUrl || 'https://pro-clubs-tracker-v0-1.onrender.com/',
          description: `Live match telemetry, player ratings & dressing room awards via **[ClubsTracker](${trackerUrl || 'https://pro-clubs-tracker-v0-1.onrender.com/'})**.`,
          color, fields, footer: { text: `Club ID: #${clubId || '--'} • Unofficial FC Pro Clubs Tracker` }, timestamp: new Date().toISOString()
        }]
      })
    });
    if (!r.ok) return res.status(r.status).json({ error: `Discord error (${r.status})` });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Pro Clubs backend running on port ${PORT}`));
