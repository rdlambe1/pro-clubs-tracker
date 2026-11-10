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
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': 'https://www.ea.com/',
  'Origin': 'https://www.ea.com'
};

async function eaFetch(url, timeoutMs = 8000) {
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
  const c = o?.clubId || o?.id || o?.clubInfo?.clubId || (key && /^\d+$/.test(String(key)) ? key : null);
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

function mapEaOneToSixDivision(raw) {
  if (raw === undefined || raw === null || raw === '') return null;
  const s = String(raw).trim().toLowerCase();
  if (s === 'elite') return 0;
  const n = parseInt(s.replace(/[^0-9-]/g, ''), 10);
  if (isNaN(n) || n < 1 || n > 6) return null;
  return n - 1;
}

const fmtDiv = (n) => (n === null || n === undefined || isNaN(n)) ? 'Div 5' : (n <= 0 ? 'Elite' : `Div ${Math.min(5, Math.max(1, n))}`);

function resolveClubDivisions(currSeasonLb = {}, allTimeLb = {}, stat = {}, info = {}) {
  const sr = Number(stat.skillRating ?? stat.rating ?? allTimeLb.skillRating ?? currSeasonLb.skillRating ?? 1500);
  const promos = Math.max(Number(currSeasonLb.promotions || 0), Number(stat.promotions || 0), Number(allTimeLb.promotions || 0));
  const relegs = Math.max(Number(currSeasonLb.relegations || 0), Number(stat.relegations || 0), Number(allTimeLb.relegations || 0));
  const wins = Number(stat.wins ?? stat.overallWins ?? allTimeLb.wins ?? 0);
  const ties = Number(stat.ties ?? stat.overallTies ?? allTimeLb.ties ?? 0);
  const losses = Number(stat.losses ?? stat.overallLosses ?? allTimeLb.losses ?? 0);
  const totalGames = wins + ties + losses;

  const minByPromo = Math.max(0, 5 - promos);
  if (promos <= 0) {
    return { currDivNum: 5, divisionLabel: 'Div 5', peakDivNum: 5, peakDivisionLabel: 'Div 5' };
  }

  const rawCurr = currSeasonLb.currentDivision ?? allTimeLb.currentDivision ?? stat.currentDivision ?? null;
  let curr = mapEaOneToSixDivision(rawCurr);

  if (curr === null) {
    const netClimb = Math.max(0, promos - relegs);
    let srEst = 5;
    if (totalGames >= 15 && sr >= 2050) srEst = 0;
    else if (totalGames >= 12 && sr >= 1880) srEst = 1;
    else if (totalGames >= 10 && sr >= 1700) srEst = 2;
    else if (totalGames >= 8 && sr >= 1540) srEst = 3;
    else if (promos >= 1 && sr >= 1320) srEst = 4;

    const daysSinceLaunch = Math.max(1, (Date.now() - new Date('2026-09-24T00:00:00Z').getTime()) / 86400000);
    const daysIntoSeason = daysSinceLaunch % 42;
    const estCurrSeasonClimb = netClimb > 0 ? Math.min(netClimb, Math.max(1, Math.round(promos * Math.max(0.22, daysIntoSeason / 42)))) : 1;
    const promoEst = Math.max(0, 5 - estCurrSeasonClimb);

    curr = Math.min(promoEst, srEst);
  }

  curr = Math.min(5, Math.max(curr, minByPromo));

  const allowElite = (curr === 0 || (promos >= 5 && sr >= 1950));
  const bestCands = [
    curr,
    mapEaOneToSixDivision(currSeasonLb.bestDivision),
    mapEaOneToSixDivision(allTimeLb.bestDivision),
    mapEaOneToSixDivision(stat.bestDivision)
  ].filter(n => n !== null && n >= 0 && n <= 5 && (n !== 0 || allowElite))
   .map(n => Math.max(n, minByPromo));

  const peak = Math.min(curr, ...(bestCands.length ? bestCands : [curr]));
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
  if (tot < 6) {
    const starterPct = w > l ? 35 : 55;
    return { percentile: starterPct, label: `Top ${starterPct}% Worldwide` };
  }
  let pct = s >= 2100 ? 0.5 : s >= 1950 ? 1 : s >= 1800 ? 2 : s >= 1700 ? 4 : s >= 1600 ? 7 : s >= 1500 ? 12 : s >= 1400 ? 18 : s >= 1300 ? 28 : s >= 1150 ? 42 : 55;
  if (currDiv === 0) pct = Math.min(pct, 2); else if (currDiv === 1) pct = Math.min(pct, 6); else if (currDiv === 2) pct = Math.min(pct, 12);
  if (tot > 0 && w / tot >= 0.6) pct = Math.max(0.5, pct - 2);
  return { percentile: pct, label: `Top ${pct}% Worldwide` };
}

function computeClubRepAndFans(stat = {}, currSeasonLb = {}, info = {}, allTimeLb = {}, currDiv = 5, peakDiv = 5) {
  const w = Number(stat.wins ?? stat.overallWins ?? allTimeLb.wins ?? 0);
  const d = Number(stat.ties ?? stat.overallTies ?? allTimeLb.ties ?? 0);
  const l = Number(stat.losses ?? stat.overallLosses ?? allTimeLb.losses ?? 0);
  const gf = Number(stat.goals ?? stat.overallGoals ?? allTimeLb.goals ?? 0);
  const sr = Number(stat.skillRating ?? stat.rating ?? allTimeLb.skillRating ?? 1500);
  const promos = Math.max(Number(currSeasonLb.promotions || 0), Number(stat.promotions || 0), Number(allTimeLb.promotions || 0));
  const titles = Math.max(Number(currSeasonLb.titlesWon || 0), Number(stat.titlesWon || 0), Number(allTimeLb.titlesWon || 0));
  const totalGames = w + d + l;

  const rawFans = Number(stat.fans ?? stat.fanCount ?? allTimeLb.fans ?? info.fans ?? 0);
  const peakDivBonus = Math.max(0, (5 - peakDiv) * 185000);
  const srBonus = totalGames >= 10 ? Math.max(0, (sr - 1200) * 650) : 0;
  const calcFans = 100000 + (totalGames * 12800) + (w * 18500) + (d * 5500) + (gf * 1450) + (promos * 115000) + (titles * 350000) + peakDivBonus + srBonus;
  const fans = rawFans > 10000 ? rawFans : Math.round(calcFans);

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

  const explicitLvl = Number(allTimeLb.reputationlevel ?? stat.reputationlevel ?? stat.clubLevel ?? 0);
  const level = (explicitLvl >= 1 && explicitLvl <= 10) ? explicitLvl : calcLvl;

  const tierTitles = {
    1: 'Grassroots', 2: 'Hometown', 3: 'Emerging', 4: 'Up and Coming', 5: 'Up and Coming',
    6: 'Established', 7: 'Established', 8: 'Renowned', 9: 'Renowned', 10: 'World Class'
  };

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

function buildSeasonsHistory(currSeasonLb = {}, stat = {}, currDiv = 5, peakDiv = 5) {
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
  const csGF = currSeasonLb.goals !== undefined ? Number(currSeasonLb.goals) : null;
  const csGA = currSeasonLb.goalsAgainst !== undefined ? Number(currSeasonLb.goalsAgainst) : null;
  const hasExactCurrSeason = csW !== null && (csW + csD + csL) <= (tW + tD + tL);

  if (count <= 1) {
    return { totalSeasonsCount: 1, list: [{ seasonNumber: 1, label: 'Season 1 (Current)', divisionNum: currDiv, division: fmtDiv(currDiv), wins: tW, draws: tD, losses: tL, goalsFor: tGF, goalsAgainst: tGA, points: tW * 3 + tD, outcome: `IN PROGRESS (${promos}⬆️ ${relegs}⬇️)`, badgeType: 'active', isCurrent: true }] };
  }

  if (hasExactCurrSeason && count === 2) {
    const s1W = Math.max(0, tW - csW), s1D = Math.max(0, tD - csD), s1L = Math.max(0, tL - csL);
    const s1GF = Math.max(0, tGF - (csGF ?? 0)), s1GA = Math.max(0, tGA - (csGA ?? 0));
    const csPromos = Number(currSeasonLb.promotions ?? 0), csRelegs = Number(currSeasonLb.relegations ?? 0);
    const s1Promos = Math.max(0, promos - csPromos), s1Relegs = Math.max(0, relegs - csRelegs);
    return {
      totalSeasonsCount: 2,
      list: [
        { seasonNumber: 2, label: 'Season 2 (Current)', divisionNum: currDiv, division: fmtDiv(currDiv), wins: csW, draws: csD, losses: csL, goalsFor: csGF ?? 0, goalsAgainst: csGA ?? 0, points: csW * 3 + csD, outcome: `IN PROGRESS (${csPromos}⬆️ ${csRelegs}⬇️)`, badgeType: 'active', isCurrent: true },
        { seasonNumber: 1, label: 'Season 1', divisionNum: peakDiv, division: fmtDiv(peakDiv), wins: s1W, draws: s1D, losses: s1L, goalsFor: s1GF, goalsAgainst: s1GA, points: s1W * 3 + s1D, outcome: titles > 0 ? `TITLE WINNER (${s1Promos}⬆️ ${s1Relegs}⬇️)` : `COMPLETED (${s1Promos}⬆️ ${s1Relegs}⬇️)`, badgeType: titles > 0 ? 'title' : 'promo', isCurrent: false }
      ]
    };
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
  const rawQuery = String(req.query.clubName || '').trim();
  const platform = req.query.platform === 'nx' ? 'nx' : 'common-gen5';
  if (!rawQuery) return res.status(400).json({ error: 'Club name required' });

  try {
    const [sdkRes, directAllTime, directSeason] = await Promise.allSettled([
      proclubs.clubs.search({ name: rawQuery, platform }),
      eaFetch(`https://proclubs.ea.com/api/fc/allTimeLeaderboard/search?platform=${platform}&clubName=${encodeURIComponent(rawQuery)}`),
      eaFetch(`https://proclubs.ea.com/api/fc/currentSeasonLeaderboard/search?platform=${platform}&clubName=${encodeURIComponent(rawQuery)}`)
    ]);

    const seen = new Map();
    const ingest = (payload) => {
      if (!payload) return;
      const entries = Array.isArray(payload) ? payload.map(v => [null, v]) : Object.entries(payload);
      entries.forEach(([k, v]) => {
        const id = extractClubId(v, k);
        const name = v?.clubName || v?.name || v?.clubInfo?.name || rawQuery;
        if (id && !seen.has(id)) seen.set(id, { id, name });
      });
    };

    if (sdkRes.status === 'fulfilled') ingest(sdkRes.value);
    if (directSeason.status === 'fulfilled') ingest(directSeason.value);
    if (directAllTime.status === 'fulfilled') ingest(directAllTime.value);

    const results = Array.from(seen.values());
    return results.length
      ? res.json(results)
      : res.status(404).json({ error: `No clubs found matching "${rawQuery}".` });
  } catch (e) {
    res.status(500).json({ error: e.message || 'Search failed' });
  }
});

// 2. Club Info
app.get('/api/club/:clubId/info', async (req, res) => {
  const { clubId } = req.params;
  const platform = req.query.platform === 'nx' ? 'nx' : 'common-gen5';
  const numId = parseInt(clubId, 10);
  if (isNaN(numId) || numId <= 0) return res.status(400).json({ error: 'Invalid clubId' });

  try {
    const [iRes, sRes, rInfo, rStats] = await Promise.allSettled([
      proclubs.clubs.get({ clubId: numId, platform }),
      proclubs.clubs.overallStats({ clubId: numId, platform }),
      eaFetch(`https://proclubs.ea.com/api/fc/clubs/info?clubIds=${numId}&platform=${platform}`),
      eaFetch(`https://proclubs.ea.com/api/fc/clubs/overallStats?clubIds=${numId}&platform=${platform}`)
    ]);

    const sdkStat = unwrapEa(valOf(sRes), clubId);
    const dirStat = unwrapEa(valOf(rStats), clubId);
    const statObj = Object.keys(dirStat).length ? { ...sdkStat, ...dirStat } : sdkStat;

    const dUnwrapped = unwrapEa(valOf(rInfo), clubId);
    const infoObj = Object.keys(dUnwrapped).length ? dUnwrapped : unwrapEa(valOf(iRes), clubId);

    const cName = infoObj.name || statObj.name;
    if (!cName && !Object.keys(statObj).length) {
      return res.status(404).json({ error: `Club #${numId} not found.` });
    }

    let currSeasonLb = {}, allTimeLb = {};
    if (cName) {
      const [csRes, atRes] = await Promise.allSettled([
        eaFetch(`https://proclubs.ea.com/api/fc/currentSeasonLeaderboard/search?platform=${platform}&clubName=${encodeURIComponent(cName)}`),
        eaFetch(`https://proclubs.ea.com/api/fc/allTimeLeaderboard/search?platform=${platform}&clubName=${encodeURIComponent(cName)}`)
      ]);
      const csArr = valOf(csRes), atArr = valOf(atRes);
      if (Array.isArray(csArr)) currSeasonLb = csArr.find(x => String(extractClubId(x)) === String(numId)) || {};
      if (Array.isArray(atArr)) allTimeLb = atArr.find(x => String(extractClubId(x)) === String(numId)) || {};
    }

    const { currDivNum, divisionLabel, peakDivNum, peakDivisionLabel } = resolveClubDivisions(currSeasonLb, allTimeLb, statObj, infoObj);
    const ck = infoObj.customKit || statObj.customKit || {};
    const kits = {
      home: [eaIntToHex(ck.kitColor1, '#10b981'), eaIntToHex(ck.kitColor2, '#ffffff'), eaIntToHex(ck.kitColor3, '#064e3b')],
      away: [eaIntToHex(ck.kitAColor1, '#1e293b'), eaIntToHex(ck.kitAColor2, '#38bdf8'), eaIntToHex(ck.kitAColor3, '#0f172a')],
      third: [eaIntToHex(ck.kitThrdColor1 || ck.dCustomKit || ck.kitColor3, '#f59e0b'), eaIntToHex(ck.kitThrdColor2 || ck.kitColor1, '#111827'), eaIntToHex(ck.kitThrdColor3 || ck.kitAColor2, '#ffffff')]
    };
    const sr = Number(statObj.skillRating ?? statObj.rating ?? allTimeLb.skillRating ?? 1500);
    const wins = Number(statObj.wins ?? statObj.overallWins ?? allTimeLb.wins ?? 0);
    const losses = Number(statObj.losses ?? statObj.overallLosses ?? allTimeLb.losses ?? 0);
    const ties = Number(statObj.ties ?? statObj.overallTies ?? allTimeLb.ties ?? 0);
    const seasonsData = buildSeasonsHistory(currSeasonLb, statObj, currDivNum, peakDivNum);
    const clubRep = computeClubRepAndFans(statObj, currSeasonLb, infoObj, allTimeLb, currDivNum, peakDivNum);

    res.json({
      info: infoObj, overall: statObj, division: divisionLabel, divisionNum: currDivNum,
      crestId: resolveCrestId(infoObj, statObj), stadiumName: ck.stadName || infoObj.stadName || infoObj.stadiumName || 'Pro Clubs Arena',
      regionInfo: resolveClubRegion(infoObj.regionId || statObj.regionId), kits,
      globalRank: computeGlobalPercentile(sr, wins, losses, ties, currDivNum),
      clubRep,
      trophies: {
        titlesWon: Math.max(Number(allTimeLb.titlesWon || 0), Number(statObj.titlesWon || 0)),
        leaguesWon: Math.max(Number(allTimeLb.leaguesWon || 0), Number(statObj.leaguesWon || 0)),
        promotions: Math.max(Number(allTimeLb.promotions || 0), Number(statObj.promotions || 0)),
        relegations: Math.max(Number(allTimeLb.relegations || 0), Number(statObj.relegations || 0)),
        holds: Math.max(Number(allTimeLb.holds || 0), Number(statObj.holds || 0)),
        totalSeasons: seasonsData.totalSeasonsCount, bestDivision: peakDivisionLabel, bestDivisionNum: peakDivNum
      },
      seasonsHistory: seasonsData.list
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 3. Squad Members (Merges SDK + Direct EA Members + Direct EA Career Stats so proNationality & proName are NEVER lost)
app.get('/api/club/:clubId/members', async (req, res) => {
  const { clubId } = req.params;
  const platform = req.query.platform === 'nx' ? 'nx' : 'common-gen5';
  const numId = parseInt(clubId, 10);
  const toList = (p) => Array.isArray(p) ? p : (Array.isArray(p?.members) ? p.members : Object.values(p?.members || p || {}));

  try {
    const [cRes, dMemRes, carRes] = await Promise.allSettled([
      proclubs.members.stats({ clubId: numId, platform }),
      eaFetch(`https://proclubs.ea.com/api/fc/members/stats?clubId=${numId}&platform=${platform}`),
      eaFetch(`https://proclubs.ea.com/api/fc/members/career/stats?clubId=${numId}&platform=${platform}`)
    ]);

    const sdkList = toList(valOf(cRes));
    const dirList = toList(valOf(dMemRes));
    const carList = toList(valOf(carRes));

    const dirMap = new Map(), carMap = new Map();
    dirList.forEach(dm => dm?.name && dirMap.set(String(dm.name).toLowerCase().trim(), dm));
    carList.forEach(cm => cm?.name && carMap.set(String(cm.name).toLowerCase().trim(), cm));

    const baseList = sdkList.length ? sdkList : dirList;
    baseList.forEach(m => {
      if (!m || typeof m !== 'object') return;
      const key = String(m.name || m.proName || '').toLowerCase().trim();
      const dm = dirMap.get(key) || {};
      const co = carMap.get(key) || {};

      // Preserve raw EA fields that proclubs-sdk renames or omits
      ['proStyle','proHeight','proWeight','proOverall','proNationality','proPos','proName'].forEach(k => {
        const val = dm[k] ?? co[k] ?? m[k];
        if (val !== undefined && val !== null && String(val) !== '') m[k] = val;
      });
      if (!m.proNationality && m.nationality?.id) m.proNationality = String(m.nationality.id);

      m.totalCleanSheets = Number(m.cleanSheetsDef ?? dm.cleanSheetsDef ?? co.cleanSheetsDef ?? 0) + Number(m.cleanSheetsGK ?? dm.cleanSheetsGK ?? co.cleanSheetsGK ?? 0);
      m.shotConvRate = Number(m.shotSuccessRate ?? dm.shotSuccessRate ?? co.shotSuccessRate ?? 0);
      const cG = Number(m.gamesPlayed ?? dm.gamesPlayed ?? m.games ?? 0);
      const totG = Math.max(cG, Number(co.gamesPlayed ?? co.games ?? cG));
      m.careerTotalGames = totG;
      m.otherClubGames = Math.max(0, totG - cG);
      m.loyaltyPct = totG > 0 ? Math.round((cG / totG) * 100) : 100;
    });
    res.json(baseList);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 4. Match History
app.get('/api/club/:clubId/matches', async (req, res) => {
  const { clubId } = req.params;
  const platform = req.query.platform === 'nx' ? 'nx' : 'common-gen5';
  const numId = parseInt(clubId, 10);
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
    const [sRes, rInfo] = await Promise.allSettled([
      eaFetch(`https://proclubs.ea.com/api/fc/clubs/overallStats?clubIds=${oppId}&platform=${platform}`),
      eaFetch(`https://proclubs.ea.com/api/fc/clubs/info?clubIds=${oppId}&platform=${platform}`)
    ]);
    const st = unwrapEa(valOf(sRes), oppId), inf = unwrapEa(valOf(rInfo), oppId);
    let csLb = {};
    if (inf?.name) {
      const lbArr = await eaFetch(`https://proclubs.ea.com/api/fc/currentSeasonLeaderboard/search?platform=${platform}&clubName=${encodeURIComponent(inf.name)}`);
      if (Array.isArray(lbArr)) csLb = lbArr.find(x => String(extractClubId(x)) === String(oppId)) || {};
    }
    const { divisionLabel } = resolveClubDivisions(csLb, {}, st, inf);
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
  const { name = 'FC', clubId } = req.query;
  const platform = req.query.platform === 'nx' ? 'nx' : 'common-gen5';
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

app.use((req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'API route not found' });
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Pro Clubs backend running on port ${PORT}`));
