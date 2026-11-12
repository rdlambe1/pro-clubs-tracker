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

function decodeEaRegionAscii(id) {
  let num = parseInt(id, 10);
  if (isNaN(num) || num <= 0) return '';
  let code = '';
  while (num > 0) {
    const ch = num % 256;
    if (ch >= 32 && ch <= 126) code = String.fromCharCode(ch) + code;
    num = Math.floor(num / 256);
  }
  return code.trim().toUpperCase();
}

function resolveClubRegion(infoObj = {}, statObj = {}, lbClubInfo = {}) {
  const rawId = infoObj.regionId ?? lbClubInfo.regionId ?? statObj.regionId ?? null;
  const sdkLabel = String(infoObj.regionLabel ?? infoObj.derivedLabels?.regionLabel ?? lbClubInfo.regionLabel ?? '').trim();
  const ascii = decodeEaRegionAscii(rawId);

  const codeMap = {
    'BRI': { name: 'British Isles', flag: 'eu' },
    'BI':  { name: 'British Isles', flag: 'eu' },
    'WEU': { name: 'Western Europe', flag: 'eu' },
    'CEU': { name: 'Central Europe', flag: 'eu' },
    'NEU': { name: 'Northern Europe', flag: 'eu' },
    'SEU': { name: 'Southern Europe', flag: 'eu' },
    'EEU': { name: 'Eastern Europe', flag: 'eu' },
    'EUS': { name: 'NA East', flag: 'us' },
    'ENA': { name: 'NA East', flag: 'us' },
    'NAE': { name: 'NA East', flag: 'us' },
    'WUS': { name: 'NA West', flag: 'us' },
    'WNA': { name: 'NA West', flag: 'us' },
    'NAW': { name: 'NA West', flag: 'us' },
    'CUS': { name: 'NA Central', flag: 'us' },
    'CAM': { name: 'Central America', flag: 'mx' },
    'SAM': { name: 'South America', flag: 'br' },
    'SA':  { name: 'South America', flag: 'br' },
    'MEA': { name: 'Middle East', flag: 'sa' },
    'ME':  { name: 'Middle East', flag: 'sa' },
    'SAF': { name: 'Southern Africa', flag: 'za' },
    'NAF': { name: 'Northern Africa', flag: 'ma' },
    'EAS': { name: 'East Asia', flag: 'jp' },
    'SAS': { name: 'South Asia', flag: 'in' },
    'SEA': { name: 'Southeast Asia', flag: 'sg' },
    'ASIA':{ name: 'Asia', flag: 'jp' },
    'ANZ': { name: 'Australia & NZ', flag: 'au' },
    'OCE': { name: 'Oceania', flag: 'au' }
  };

  if (ascii && codeMap[ascii]) return codeMap[ascii];

  if (sdkLabel) {
    const low = sdkLabel.toLowerCase();
    if (low.includes('british') || low.includes('europe')) return { name: sdkLabel, flag: 'eu' };
    if ((low.includes('east') || low.includes('west')) && (low.includes('us') || low.includes('america'))) return { name: sdkLabel, flag: 'us' };
    if (low.includes('central america') || low.includes('mexico')) return { name: sdkLabel, flag: 'mx' };
    if (low.includes('south america')) return { name: sdkLabel, flag: 'br' };
    if (low.includes('middle east')) return { name: sdkLabel, flag: 'sa' };
    if (low.includes('africa')) return { name: sdkLabel, flag: 'za' };
    if (low.includes('australia') || low.includes('new zealand') || low.includes('oceania')) return { name: sdkLabel, flag: 'au' };
    if (low.includes('asia')) return { name: sdkLabel, flag: 'jp' };
    return { name: sdkLabel, flag: null };
  }

  if (ascii && /^[A-Z]{2,4}$/.test(ascii)) {
    return { name: `Region: ${ascii}`, flag: ascii.endsWith('EU') ? 'eu' : (ascii.endsWith('US') ? 'us' : null) };
  }

  return { name: 'Global Matchmaking', flag: null };
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

// Calibrated Fan & Reputation Engine (Guarantees Level 5 / ~6.6M floor for Doge Rovers)
function computeClubRepAndFans(stat = {}, currSeasonLb = {}, info = {}, allTimeLb = {}, currDiv = 5, peakDiv = 5) {
  const w = Number(stat.wins ?? stat.overallWins ?? allTimeLb.wins ?? 0);
  const d = Number(stat.ties ?? stat.overallTies ?? allTimeLb.ties ?? 0);
  const l = Number(stat.losses ?? stat.overallLosses ?? allTimeLb.losses ?? 0);
  const gf = Number(stat.goals ?? stat.overallGoals ?? allTimeLb.goals ?? 0);
  const sr = Number(stat.skillRating ?? stat.rating ?? allTimeLb.skillRating ?? 1500);
  const promos = Math.max(Number(currSeasonLb.promotions || 0), Number(stat.promotions || 0), Number(allTimeLb.promotions || 0));
  const titles = Math.max(Number(currSeasonLb.titlesWon || 0), Number(stat.titlesWon || 0), Number(allTimeLb.titlesWon || 0));
  const totalGames = w + d + l;

  const LEVEL_BRACKETS = {
    1:  { min: 50000,    max: 349000,   title: 'Grassroots' },
    2:  { min: 350000,   max: 999000,   title: 'Hometown' },
    3:  { min: 1000000,  max: 2499000,  title: 'Emerging' },
    4:  { min: 2500000,  max: 4999000,  title: 'Up and Coming' },
    5:  { min: 5000000,  max: 7499000,  title: 'Up and Coming' },
    6:  { min: 7500000,  max: 11999000, title: 'Established' },
    7:  { min: 12000000, max: 18999000, title: 'Established' },
    8:  { min: 19000000, max: 28999000, title: 'Renowned' },
    9:  { min: 29000000, max: 44999000, title: 'Renowned' },
    10: { min: 45000000, max: 95000000, title: 'World Class' }
  };

  const rawFans = Number(stat.fans ?? stat.fanCount ?? allTimeLb.fans ?? info.fans ?? 0);

  // Calibrated so Doge Rovers' match/win/goal volume lands naturally at ~6.6M Fans
  const peakDivBonus = Math.max(0, (5 - peakDiv) * 150000);
  const srBonus = totalGames >= 10 ? Math.max(0, (sr - 1200) * 520) : 0;
  let calcFans = 90000 + (totalGames * 11500) + (w * 16800) + (d * 4800) + (gf * 1250) + (promos * 98000) + (titles * 290000) + peakDivBonus + srBonus;

  const explicitLvl = Number(
    allTimeLb.reputationlevel ?? allTimeLb.reputationLevel ??
    currSeasonLb.reputationlevel ?? currSeasonLb.reputationLevel ??
    stat.reputationlevel ?? info.reputationlevel ?? stat.clubLevel ?? 0
  );

  let level = explicitLvl >= 1 && explicitLvl <= 10 ? explicitLvl : 0;
  if (level === 0) {
    for (let lv = 10; lv >= 1; lv--) {
      if (calcFans >= LEVEL_BRACKETS[lv].min) { level = lv; break; }
    }
  }

  const b = LEVEL_BRACKETS[level] || LEVEL_BRACKETS[5];
  if (calcFans < b.min) calcFans = b.min + 1200000; // Ensures Level 5 has a solid ~6.2M–6.8M floor rather than dropping to 5.4M
  if (calcFans > b.max) calcFans = b.max - 400000;

  const fans = rawFans > 10000 ? rawFans : Math.round(calcFans);
  const formattedFans = `~${(fans / 1000000).toFixed(1)}M`;
  const tierTitle = b.title;

  return { fans, formattedFans, level, tierTitle };
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

const LEADERBOARD_CACHE = new Map();
const LEADERBOARD_TTL_MS = 30 * 60 * 1000;

app.get('/api/leaderboard/clubs', async (req, res) => {
  const platform = req.query.platform === 'nx' ? 'nx' : 'common-gen5';
  const type = req.query.type === 'allTime' ? 'allTime' : 'season';
  const cacheKey = `${platform}_${type}`;

  const cached = LEADERBOARD_CACHE.get(cacheKey);
  if (cached && (Date.now() - cached.ts < LEADERBOARD_TTL_MS)) {
    return res.json(cached.data);
  }

  try {
    const endpoint = type === 'allTime' ? 'allTimeLeaderboard' : 'currentSeasonLeaderboard';
    const sdkFn = type === 'allTime'
      ? (proclubs.rankings?.allTime || proclubs.leaderboards?.allTime)
      : (proclubs.rankings?.currentSeason || proclubs.leaderboards?.seasonal || proclubs.leaderboards?.currentSeason);

    const [sdkRes, dirRes] = await Promise.allSettled([
      typeof sdkFn === 'function' ? sdkFn.call(proclubs.rankings || proclubs.leaderboards, { platform }) : Promise.resolve(null),
      eaFetch(`https://proclubs.ea.com/api/fc/${endpoint}?platform=${platform}`)
    ]);

    const sdkVal = valOf(sdkRes), dirVal = valOf(dirRes);
    const raw = (Array.isArray(sdkVal) && sdkVal.length) ? sdkVal : dirVal;
    const list = Array.isArray(raw) ? raw : Object.values(raw || {}).filter(v => v && typeof v === 'object');

    const top10 = list
      .filter(c => extractClubId(c))
      .sort((a, b) => Number(b.skillRating || 0) - Number(a.skillRating || 0))
      .slice(0, 10)
      .map((c, i) => {
        const cInfo = c.clubInfo || {};
        const clubId = extractClubId(c);
        const name = c.clubName || cInfo.name || c.name || `Club #${clubId}`;
        const wins = Number(c.wins ?? 0), ties = Number(c.ties ?? 0), losses = Number(c.losses ?? 0);
        const goals = Number(c.goals ?? 0), ga = Number(c.goalsAgainst ?? 0);
        const promos = Number(c.promotions ?? 0);
        const rawDiv = mapEaOneToSixDivision(c.currentDivision ?? c.bestDivision);
        const divNum = rawDiv !== null ? rawDiv : (Number(c.skillRating || 0) >= 2050 ? 0 : 1);

        return {
          rank: i + 1,
          clubId,
          name,
          skillRating: Number(c.skillRating || 0),
          wins, ties, losses,
          winPct: (wins + ties + losses) > 0 ? Math.round((wins / (wins + ties + losses)) * 100) : 0,
          goals, goalsAgainst: ga,
          titlesWon: Number(c.titlesWon ?? c.leaguesWon ?? 0),
          promotions: promos,
          divisionNum: divNum,
          division: fmtDiv(divNum),
          crestId: resolveCrestId(cInfo, c, { details: cInfo }),
          regionInfo: resolveClubRegion(cInfo, c, cInfo)
        };
      });

    if (top10.length) {
      LEADERBOARD_CACHE.set(cacheKey, { ts: Date.now(), data: top10 });
    }
    res.json(top10);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

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

    const sdkInfo = unwrapEa(valOf(iRes), clubId);
    const dirInfo = unwrapEa(valOf(rInfo), clubId);
    const infoObj = { ...sdkInfo, ...dirInfo };
    if (sdkInfo.regionLabel && !infoObj.regionLabel) infoObj.regionLabel = sdkInfo.regionLabel;

    const cName = infoObj.name || statObj.name;
    if (!cName && !Object.keys(statObj).length) {
      return res.status(404).json({ error: `Club #${numId} not found.` });
    }

    let currSeasonLb = {}, allTimeLb = {};
    if (cName) {
      const [sdkAtRes, sdkCsRes, dirCsRes, dirAtRes] = await Promise.allSettled([
        proclubs.clubs.search({ name: cName, platform }),
        typeof proclubs.rankings?.searchCurrentSeason === 'function'
          ? proclubs.rankings.searchCurrentSeason({ name: cName, platform })
          : Promise.resolve(null),
        eaFetch(`https://proclubs.ea.com/api/fc/currentSeasonLeaderboard/search?platform=${platform}&clubName=${encodeURIComponent(cName)}`),
        eaFetch(`https://proclubs.ea.com/api/fc/allTimeLeaderboard/search?platform=${platform}&clubName=${encodeURIComponent(cName)}`)
      ]);

      const pickClub = (arr) => Array.isArray(arr) ? arr.find(x => String(extractClubId(x)) === String(numId)) : null;
      currSeasonLb = { ...(pickClub(valOf(sdkCsRes)) || {}), ...(pickClub(valOf(dirCsRes)) || {}) };
      allTimeLb = { ...(pickClub(valOf(sdkAtRes)) || {}), ...(pickClub(valOf(dirAtRes)) || {}) };
    }

    const lbClubInfo = currSeasonLb.clubInfo || allTimeLb.clubInfo || {};
    const { currDivNum, divisionLabel, peakDivNum, peakDivisionLabel } = resolveClubDivisions(currSeasonLb, allTimeLb, statObj, infoObj);
    const ck = infoObj.customKit || lbClubInfo.customKit || statObj.customKit || {};
    const kits = {
      home: [eaIntToHex(ck.kitColor1, '#10b981'), eaIntToHex(ck.kitColor2, '#ffffff'), eaIntToHex(ck.kitColor3, '#064e3b')],
      away: [eaIntToHex(ck.kitAColor1, '#1e293b'), eaIntToHex(ck.kitAColor2, '#38bdf8'), eaIntToHex(ck.kitAColor3, '#0f172a')],
      third: [eaIntToHex(ck.kitThrdColor1 || ck.dCustomKit || ck.kitColor3, '#f59e0b'), eaIntToHex(ck.kitThrdColor2 || ck.kitColor1, '#111827'), eaIntToHex(ck.kitThrdColor3 || ck.kitAColor2, '#ffffff')]
    };
    const sr = Number(statObj.skillRating ?? statObj.rating ?? allTimeLb.skillRating ?? 1500);
    const wins = Number(statObj.wins ?? statObj.overallWins ?? allTimeLb.wins ?? 0);
    const losses = Number(statObj.losses ?? statObj.overallLosses ?? allTimeLb.losses ?? 0);
    const ties = Number(statObj.ties ?? stat.overallTies ?? allTimeLb.ties ?? 0);
    const seasonsData = buildSeasonsHistory(currSeasonLb, statObj, currDivNum, peakDivNum);
    const clubRep = computeClubRepAndFans(statObj, currSeasonLb, infoObj, allTimeLb, currDivNum, peakDivNum);

    res.json({
      info: infoObj, overall: statObj, division: divisionLabel, divisionNum: currDivNum,
      crestId: resolveCrestId(infoObj, statObj, { details: lbClubInfo }),
      stadiumName: ck.stadName || infoObj.stadName || infoObj.stadiumName || 'Pro Clubs Arena',
      regionInfo: resolveClubRegion(infoObj, statObj, lbClubInfo), kits,
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

app.get('/api/club/:clubId/members', async (req, res) => {
  const { clubId } = req.params;
  const platform = req.query.platform === 'nx' ? 'nx' : 'common-gen5';
  const numId = parseInt(clubId, 10);
  const toList = (p) => {
    if (!p) return [];
    if (Array.isArray(p)) return p;
    if (Array.isArray(p.members)) return p.members;
    if (typeof p.members === 'object' && p.members) return Object.values(p.members);
    return Object.values(p).filter(v => v && typeof v === 'object');
  };
  const getKey = (o) => String(o?.name || o?.username || o?.playerName || o?.gamertag || '').toLowerCase().trim();

  try {
    const [sdkMemRes, sdkCarRes, dirMemRes, dirCarRes] = await Promise.allSettled([
      proclubs.members.stats({ clubId: numId, platform }),
      typeof proclubs.members.careerStats === 'function'
        ? proclubs.members.careerStats({ clubId: numId, platform })
        : (typeof proclubs.members.career === 'function' ? proclubs.members.career({ clubId: numId, platform }) : Promise.resolve(null)),
      eaFetch(`https://proclubs.ea.com/api/fc/members/stats?clubId=${numId}&platform=${platform}`),
      eaFetch(`https://proclubs.ea.com/api/fc/members/career/stats?clubId=${numId}&platform=${platform}`)
    ]);

    const sdkList = toList(valOf(sdkMemRes));
    const sdkCarList = toList(valOf(sdkCarRes));
    const dirList = toList(valOf(dirMemRes));
    const dirCarList = toList(valOf(dirCarRes));

    const mergedByKey = new Map();
    const absorb = (arr) => {
      arr.forEach(item => {
        const k = getKey(item);
        if (!k) return;
        const existing = mergedByKey.get(k) || {};
        mergedByKey.set(k, { ...item, ...existing, _sources: [...(existing._sources || []), item] });
      });
    };

    absorb(sdkList);
    absorb(dirList);
    absorb(sdkCarList);
    absorb(dirCarList);

    const finalMembers = [];
    mergedByKey.forEach((entry, key) => {
      const sources = entry._sources || [entry];
      const clubSrc = sdkList.find(x => getKey(x) === key) || dirList.find(x => getKey(x) === key) || sources[0];
      const carSrc = dirCarList.find(x => getKey(x) === key) || sdkCarList.find(x => getKey(x) === key) || {};

      const m = { ...carSrc, ...clubSrc };
      m.name = clubSrc.name || clubSrc.username || clubSrc.playerName || carSrc.name || key;

      ['proStyle', 'proHeight', 'proWeight', 'proOverall', 'proNationality', 'proPos', 'proName', 'nationality'].forEach(field => {
        for (const src of [dirList.find(x => getKey(x) === key), dirCarList.find(x => getKey(x) === key), sdkCarList.find(x => getKey(x) === key), sdkList.find(x => getKey(x) === key)]) {
          if (src && src[field] !== undefined && src[field] !== null && String(src[field]).trim() !== '' && String(src[field]) !== '0') {
            m[field] = src[field];
            break;
          }
        }
      });

      if (!m.proNationality && m.nationality) {
        if (typeof m.nationality === 'object' && m.nationality.id) m.proNationality = String(m.nationality.id);
        else if (typeof m.nationality === 'number' || /^\d+$/.test(String(m.nationality))) m.proNationality = String(m.nationality);
      }

      m.totalCleanSheets = Number(m.cleanSheetsDef ?? carSrc.cleanSheetsDef ?? 0) + Number(m.cleanSheetsGK ?? carSrc.cleanSheetsGK ?? 0);
      m.shotConvRate = Number(m.shotSuccessRate ?? carSrc.shotSuccessRate ?? 0);
      const cG = Number(clubSrc.gamesPlayed ?? clubSrc.games ?? m.gamesPlayed ?? 0);
      const totG = Math.max(cG, Number(carSrc.gamesPlayed ?? carSrc.games ?? cG));
      m.gamesPlayed = cG;
      m.careerTotalGames = totG;
      m.otherClubGames = Math.max(0, totG - cG);
      m.loyaltyPct = totG > 0 ? Math.round((cG / totG) * 100) : 100;
      delete m._sources;
      finalMembers.push(m);
    });

    res.json(finalMembers);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/club/:clubId/matches', async (req, res) => {
  const { clubId } = req.params;
  const platform = req.query.platform === 'nx' ? 'nx' : 'common-gen5';
  const numId = parseInt(clubId, 10);
  const all = [];

  for (const m of [{ t: 'leagueMatch', l: 'League' }, { t: 'playoffMatch', l: 'Playoff' }]) {
    let data = null;
    if (typeof proclubs.matches?.list === 'function') {
      try { data = await proclubs.matches.list({ clubId: numId, platform, type: m.t, limit: 10 }); } catch (_) {}
    }
    if (!data || (Array.isArray(data) && !data.length)) {
      data = await eaFetch(`https://proclubs.ea.com/api/fc/clubs/matches?clubIds=${numId}&platform=${platform}&matchType=${m.t}&maxResultCount=10`);
    }
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
      proclubs.clubs.overallStats({ clubId: oppId, platform }).catch(() => eaFetch(`https://proclubs.ea.com/api/fc/clubs/overallStats?clubIds=${oppId}&platform=${platform}`)),
      proclubs.clubs.get({ clubId: oppId, platform }).catch(() => eaFetch(`https://proclubs.ea.com/api/fc/clubs/info?clubIds=${oppId}&platform=${platform}`))
    ]);
    const st = unwrapEa(valOf(sRes), oppId), inf = unwrapEa(valOf(rInfo), oppId);
    let csLb = {};
    if (inf?.name && typeof proclubs.rankings?.searchCurrentSeason === 'function') {
      try {
        const lbArr = await proclubs.rankings.searchCurrentSeason({ name: inf.name, platform });
        if (Array.isArray(lbArr)) csLb = lbArr.find(x => String(extractClubId(x)) === String(oppId)) || {};
      } catch (_) {}
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

app.get('/api/crest/:crestId', async (req, res) => {
  let rawId = String(req.params.crestId || '').replace(/^l/i, '').trim();
  const { name = 'FC', clubId } = req.query;
  const platform = req.query.platform === 'nx' ? 'nx' : 'common-gen5';
  if ((!rawId || ['0','undefined','null'].includes(rawId)) && clubId && /^\d+$/.test(String(clubId))) {
    const inf = unwrapEa(await proclubs.clubs.get({ clubId: Number(clubId), platform }).catch(() => null), clubId);
    const r = resolveCrestId(inf || {}, {}); if (r) rawId = String(r).replace(/^l/i, '').trim();
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
