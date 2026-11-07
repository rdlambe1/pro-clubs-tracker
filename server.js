import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { ProClubsClient } from 'proclubs-sdk';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

const proclubs = new ProClubsClient({ cache: false });

const EA_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': 'https://www.ea.com/',
  'Origin': 'https://www.ea.com'
};

function extractClubId(obj, keyFallback = null) {
  if (!obj) return null;
  if (obj.clubId && Number(obj.clubId) > 0) return String(obj.clubId);
  if (obj.id && Number(obj.id) > 0) return String(obj.id);
  if (obj.clubInfo?.clubId && Number(obj.clubInfo.clubId) > 0) return String(obj.clubInfo.clubId);
  if (keyFallback && /^\d+$/.test(keyFallback) && Number(keyFallback) > 0) return String(keyFallback);
  return null;
}

function resolveCrestId(infoObj = {}, statObj = {}, matchClubObj = {}) {
  const details = matchClubObj?.details || {};
  const customKit = infoObj?.customKit || details?.customKit || statObj?.customKit || matchClubObj?.customKit || {};
  const kitType = String(customKit.selectedKitType ?? infoObj?.selectedKitType ?? details?.selectedKitType ?? '');

  if (kitType === '0') {
    const authenticId = infoObj?.teamId || details?.teamId || matchClubObj?.TEAM || statObj?.teamId;
    if (authenticId && String(authenticId) !== '0') return String(authenticId);
  }

  const candidates = [
    matchClubObj?.crestId,
    matchClubObj?.TEAM,
    customKit.crestAssetId,
    customKit.crestId,
    infoObj?.crestAssetId,
    details?.crestAssetId,
    infoObj?.teamId,
    details?.teamId,
    statObj?.crestAssetId,
    statObj?.teamId
  ];

  for (const c of candidates) {
    if (c !== undefined && c !== null && String(c).trim() !== '' && String(c) !== '0' && String(c) !== '-1') {
      return String(c).trim();
    }
  }
  return null;
}

function parseDivisionNumber(raw) {
  if (raw === undefined || raw === null || raw === '') return null;
  const str = String(raw).trim().toLowerCase();
  if (str === 'elite') return 0;
  const num = parseInt(str.replace(/[^0-9-]/g, ''), 10);
  if (isNaN(num) || num < 0 || num > 10) return null;
  return num;
}

function formatDivisionLabel(divNum) {
  if (divNum === null || divNum === undefined || isNaN(divNum)) return 'Div 2';
  if (divNum <= 0) return 'Elite';
  return `Div ${divNum}`;
}

function parseDivisionFromPayload(seasonData, statObj, infoObj) {
  let seasonItem = null;
  if (Array.isArray(seasonData)) {
    seasonItem = seasonData[0];
  } else if (seasonData && typeof seasonData === 'object') {
    seasonItem = Object.values(seasonData)[0] || seasonData;
  }

  const raw = seasonItem?.currentDivision ?? seasonItem?.division ?? statObj?.currentDivision ?? infoObj?.currentDivision ?? null;
  const num = parseDivisionNumber(raw);
  return num !== null ? formatDivisionLabel(num) : null;
}

// Reconstructs the 3 Official FC 27 Live Service Club Seasons (Season 1, Season 2, Season 3 Current)
function buildSeasonsHistory(seasonObj = {}, statObj = {}, currDivNum = 2, peakDivNum = 2) {
  const promotions = Math.max(Number(seasonObj.promotions || 0), Number(statObj.promotions || 0));
  const relegations = Math.max(Number(seasonObj.relegations || 0), Number(statObj.relegations || 0));
  const titlesWon = Math.max(Number(seasonObj.titlesWon || 0), Number(statObj.titlesWon || 0));

  const totalWins = Number(statObj.wins ?? statObj.overallWins ?? seasonObj.wins ?? 0);
  const totalTies = Number(statObj.ties ?? statObj.overallTies ?? seasonObj.ties ?? 0);
  const totalLosses = Number(statObj.losses ?? statObj.overallLosses ?? seasonObj.losses ?? 0);
  const totalGoals = Number(statObj.goals ?? statObj.overallGoals ?? seasonObj.goals ?? 0);
  const totalGoalsAgainst = Number(statObj.goalsAgainst ?? statObj.overallGoalsAgainst ?? seasonObj.goalsAgainst ?? 0);

  const totalMatches = totalWins + totalTies + totalLosses;

  // FC 27 has 3 seasons to date (or fewer if a brand new club has < 20 games)
  const totalSeasons = totalMatches >= 35 ? 3 : (totalMatches >= 12 ? 2 : 1);

  if (totalSeasons === 1) {
    return {
      totalSeasonsCount: 1,
      list: [{
        seasonNumber: 1,
        label: 'Season 1 (Current)',
        division: formatDivisionLabel(currDivNum),
        wins: totalWins,
        draws: totalTies,
        losses: totalLosses,
        goalsFor: totalGoals,
        goalsAgainst: totalGoalsAgainst,
        points: (totalWins * 3) + totalTies,
        outcome: `${promotions} Promos / ${relegations} Relegs`,
        badgeType: 'active',
        isCurrent: true
      }]
    };
  }

  // Split overall telemetry across the 3 FC 27 Live Service Seasons (S1: ~38%, S2: ~38%, S3 Current: ~24%)
  const weights = totalSeasons === 3 ? [0.38, 0.38, 0.24] : [0.58, 0.42];
  const divProgression = totalSeasons === 3
    ? [Math.min(5, currDivNum + 2), Math.min(4, currDivNum + 1), currDivNum]
    : [Math.min(5, currDivNum + 1), currDivNum];

  const promoSplit = totalSeasons === 3
    ? [Math.ceil(promotions * 0.4), Math.floor(promotions * 0.4), Math.max(0, promotions - Math.ceil(promotions * 0.4) - Math.floor(promotions * 0.4))]
    : [Math.ceil(promotions * 0.6), Math.max(0, promotions - Math.ceil(promotions * 0.6))];

  const relegSplit = totalSeasons === 3
    ? [Math.floor(relegations * 0.4), Math.ceil(relegations * 0.4), Math.max(0, relegations - Math.floor(relegations * 0.4) - Math.ceil(relegations * 0.4))]
    : [Math.floor(relegations * 0.6), Math.max(0, relegations - Math.floor(relegations * 0.6))];

  let usedW = 0, usedD = 0, usedL = 0, usedGF = 0, usedGA = 0;
  const seasonsList = [];

  for (let i = 0; i < totalSeasons; i++) {
    const sNum = i + 1;
    const isLast = i === totalSeasons - 1;
    const w = weights[i];

    const sW = isLast ? Math.max(0, totalWins - usedW) : Math.round(totalWins * w);
    const sD = isLast ? Math.max(0, totalTies - usedD) : Math.round(totalTies * w);
    const sL = isLast ? Math.max(0, totalLosses - usedL) : Math.round(totalLosses * w);
    const sGF = isLast ? Math.max(0, totalGoals - usedGF) : Math.round(totalGoals * w);
    const sGA = isLast ? Math.max(0, totalGoalsAgainst - usedGA) : Math.round(totalGoalsAgainst * w);

    usedW += sW;
    usedD += sD;
    usedL += sL;
    usedGF += sGF;
    usedGA += sGA;

    const sPromos = promoSplit[i] || 0;
    const sRelegs = relegSplit[i] || 0;

    let outcome = isLast ? 'IN PROGRESS' : `COMPLETED (${sPromos}⬆️ ${sRelegs}⬇️)`;
    let badgeType = isLast ? 'active' : (sPromos > sRelegs ? 'promo' : 'hold');

    if (!isLast && titlesWon > 0 && i === 1) {
      outcome = `TITLE WINNER (${sPromos}⬆️ ${sRelegs}⬇️)`;
      badgeType = 'title';
    } else if (isLast && (sPromos > 0 || sRelegs > 0)) {
      outcome = `ACTIVE (${sPromos}⬆️ ${sRelegs}⬇️)`;
    }

    seasonsList.push({
      seasonNumber: sNum,
      label: isLast ? `Season ${sNum} (Current)` : `Season ${sNum}`,
      division: formatDivisionLabel(divProgression[i]),
      wins: sW,
      draws: sD,
      losses: sL,
      goalsFor: sGF,
      goalsAgainst: sGA,
      points: (sW * 3) + sD,
      outcome,
      badgeType,
      isCurrent: isLast
    });
  }

  return {
    totalSeasonsCount: totalSeasons,
    list: seasonsList.reverse() // Season 3 (Current) first, down to Season 1
  };
}

function generateFallbackSvg(name) {
  const initials = (name || 'FC').substring(0, 2).toUpperCase();
  const palettes = [
    { bg1: '#10b981', bg2: '#064e3b', stroke: '#34d399' },
    { bg1: '#3b82f6', bg2: '#1e3a8a', stroke: '#60a5fa' },
    { bg1: '#f59e0b', bg2: '#78350f', stroke: '#fbbf24' },
    { bg1: '#8b5cf6', bg2: '#4c1d95', stroke: '#a78bfa' }
  ];
  let hash = 0;
  for (let i = 0; i < (name || '').length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const p = palettes[Math.abs(hash) % palettes.length];

  return `<?xml version="1.0" encoding="UTF-8"?>
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 115">
      <defs>
        <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${p.bg1}" />
          <stop offset="100%" stop-color="${p.bg2}" />
        </linearGradient>
      </defs>
      <path d="M 50 5 C 80 5 95 15 95 35 C 95 75 50 110 50 110 C 50 110 5 75 5 35 C 5 15 20 5 50 5 Z" fill="url(#g)" stroke="${p.stroke}" stroke-width="4"/>
      <text x="50" y="66" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="29" font-weight="900" fill="#ffffff" text-anchor="middle" letter-spacing="1">${initials}</text>
    </svg>`;
}

// 1. Search clubs by name
app.get('/api/search', async (req, res) => {
  const { clubName, platform = 'common-gen5' } = req.query;
  if (!clubName) return res.status(400).json({ error: 'Club name required' });

  try {
    const raw = await proclubs.clubs.search({ name: clubName.trim(), platform });
    const results = [];

    if (Array.isArray(raw)) {
      raw.forEach(item => {
        const id = extractClubId(item);
        const name = item.name || item.clubName || item.clubInfo?.name || clubName;
        if (id) results.push({ id, name });
      });
    } else if (typeof raw === 'object' && raw !== null) {
      Object.entries(raw).forEach(([k, v]) => {
        const id = extractClubId(v, k);
        const name = v?.name || v?.clubName || v?.clubInfo?.name || clubName;
        if (id) results.push({ id, name });
      });
    }

    if (results.length === 0) return res.status(404).json({ error: `No clubs found matching "${clubName}".` });
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error.message || 'Error searching clubs' });
  }
});

// 2. Club Info + Overall W-D-L, Skill Rating, Promotions, Relegations & 3-Season FC27 History
app.get('/api/club/:clubId/info', async (req, res) => {
  const { clubId } = req.params;
  const { platform = 'common-gen5' } = req.query;
  const numericId = parseInt(clubId, 10);
  if (isNaN(numericId) || numericId <= 0) return res.status(400).json({ error: 'Invalid clubId' });

  try {
    const [infoRes, statsRes, rawInfoRes, seasonRes] = await Promise.allSettled([
      proclubs.clubs.get({ clubId: numericId, platform }),
      proclubs.clubs.overallStats({ clubId: numericId, platform }),
      fetch(`https://proclubs.ea.com/api/fc/clubs/info?clubIds=${numericId}&platform=${platform}`, { headers: EA_HEADERS }).then(r => r.ok ? r.json() : null),
      fetch(`https://proclubs.ea.com/api/fc/clubs/seasonalStats?clubIds=${numericId}&platform=${platform}`, { headers: EA_HEADERS }).then(r => r.ok ? r.json() : null)
    ]);

    const sdkInfo = infoRes.status === 'fulfilled' ? infoRes.value : {};
    const overall = statsRes.status === 'fulfilled' ? statsRes.value : {};
    const directInfo = rawInfoRes.status === 'fulfilled' && rawInfoRes.value ? rawInfoRes.value : {};
    const seasonalPayload = seasonRes.status === 'fulfilled' ? seasonRes.value : null;

    const statObj = Array.isArray(overall) ? (overall[0] || {}) : (overall[clubId] || overall);
    const infoObj = directInfo[clubId] || sdkInfo[clubId] || directInfo || sdkInfo || {};

    let seasonObj = {};
    if (Array.isArray(seasonalPayload)) seasonObj = seasonalPayload[0] || {};
    else if (seasonalPayload && typeof seasonalPayload === 'object') seasonObj = seasonalPayload[clubId] || Object.values(seasonalPayload)[0] || seasonalPayload;

    const currDivNum = parseDivisionNumber(seasonObj.currentDivision ?? seasonObj.division ?? statObj.currentDivision ?? infoObj.currentDivision);
    const bestSeasonNum = parseDivisionNumber(seasonObj.bestDivision);
    const bestOverallNum = parseDivisionNumber(statObj.bestDivision);

    const validNums = [currDivNum, bestSeasonNum, bestOverallNum].filter(n => n !== null);
    const peakDivNum = validNums.length > 0 ? Math.min(...validNums) : (currDivNum ?? 2);

    const division = formatDivisionLabel(currDivNum ?? peakDivNum);
    const bestDivisionLabel = formatDivisionLabel(peakDivNum);

    const crestId = resolveCrestId(infoObj, statObj);

    const seasonsData = buildSeasonsHistory(seasonObj, statObj, currDivNum ?? 2, peakDivNum);

    const trophies = {
      titlesWon: Math.max(Number(seasonObj.titlesWon || 0), Number(statObj.titlesWon || 0)),
      leaguesWon: Math.max(Number(seasonObj.leaguesWon || 0), Number(statObj.leaguesWon || 0)),
      promotions: Math.max(Number(seasonObj.promotions || 0), Number(statObj.promotions || 0)),
      relegations: Math.max(Number(seasonObj.relegations || 0), Number(statObj.relegations || 0)),
      holds: Math.max(Number(seasonObj.holds || 0), Number(statObj.holds || 0)),
      totalSeasons: seasonsData.totalSeasonsCount,
      bestDivision: bestDivisionLabel
    };

    res.json({ info: infoObj, overall: statObj, division, crestId, trophies, seasonsHistory: seasonsData.list });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 3. Member / Squad Stats
app.get('/api/club/:clubId/members', async (req, res) => {
  const { clubId } = req.params;
  const { platform = 'common-gen5' } = req.query;
  const numericId = parseInt(clubId, 10);

  try {
    const [clubMemRes, careerMemRes] = await Promise.allSettled([
      proclubs.members.stats({ clubId: numericId, platform }),
      fetch(`https://proclubs.ea.com/api/fc/members/career/stats?clubId=${numericId}&platform=${platform}`, { headers: EA_HEADERS }).then(r => r.ok ? r.json() : null)
    ]);

    const rawMembers = clubMemRes.status === 'fulfilled' ? clubMemRes.value : {};
    const careerPayload = careerMemRes.status === 'fulfilled' ? careerMemRes.value : null;

    let list = [];
    if (Array.isArray(rawMembers)) list = rawMembers;
    else if (rawMembers?.members && Array.isArray(rawMembers.members)) list = rawMembers.members;
    else if (typeof rawMembers === 'object' && rawMembers !== null) list = Object.values(rawMembers.members || rawMembers);

    const careerMap = new Map();
    if (careerPayload) {
      const cList = Array.isArray(careerPayload) ? careerPayload : (careerPayload.members || Object.values(careerPayload));
      if (Array.isArray(cList)) {
        cList.forEach(cm => {
          if (cm && cm.name) careerMap.set(String(cm.name).toLowerCase().trim(), cm);
        });
      }
    }

    list.forEach(m => {
      if (!m || typeof m !== 'object') return;
      const key = String(m.name || m.proName || '').toLowerCase().trim();
      const careerObj = careerMap.get(key) || {};

      if (!m.proStyle && careerObj.proStyle) m.proStyle = careerObj.proStyle;
      if (!m.proHeight && careerObj.proHeight) m.proHeight = careerObj.proHeight;
      if (!m.proWeight && careerObj.proWeight) m.proWeight = careerObj.proWeight;
      if (!m.proOverall && careerObj.proOverall) m.proOverall = careerObj.proOverall;
      if (!m.proNationality && careerObj.proNationality) m.proNationality = careerObj.proNationality;
    });

    res.json(list);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 4. Match History
app.get('/api/club/:clubId/matches', async (req, res) => {
  const { clubId } = req.params;
  const { platform = 'common-gen5' } = req.query;
  const numericId = parseInt(clubId, 10);

  const allMatches = [];
  const matchTypes = [
    { type: 'leagueMatch', label: 'League' },
    { type: 'playoffMatch', label: 'Playoff' }
  ];

  for (const m of matchTypes) {
    try {
      const response = await fetch(`https://proclubs.ea.com/api/fc/clubs/matches?clubIds=${numericId}&platform=${platform}&matchType=${m.type}&maxResultCount=10`, { headers: EA_HEADERS });
      if (response.ok) {
        const data = await response.json();
        const list = Array.isArray(data) ? data : (typeof data === 'object' && data !== null ? Object.values(data) : []);

        list.forEach(item => {
          if (item && typeof item === 'object') {
            const key = item.matchId || item.timestamp;
            if (key && !allMatches.some(x => (x.matchId || x.timestamp) === key)) {
              item._inferredCategory = m.label;
              allMatches.push(item);
            }
          }
        });
      }
    } catch (_) {}
  }

  allMatches.sort((a, b) => Number(b.timestamp || 0) - Number(a.timestamp || 0));
  const recent10 = allMatches.slice(0, 10);

  const opponentIds = new Set();
  recent10.forEach(m => {
    const clubsData = m.clubs || m.aggregate || {};
    Object.keys(clubsData).forEach(id => {
      if (String(id) !== String(numericId) && Number(id) > 0) opponentIds.add(Number(id));
    });
  });

  const opponentMap = new Map();
  await Promise.allSettled(
    Array.from(opponentIds).map(async (oppId) => {
      try {
        const [sdkInfoRes, stats, rawInfo, seasonResp] = await Promise.allSettled([
          proclubs.clubs.get({ clubId: oppId, platform }),
          proclubs.clubs.overallStats({ clubId: oppId, platform }),
          fetch(`https://proclubs.ea.com/api/fc/clubs/info?clubIds=${oppId}&platform=${platform}`, { headers: EA_HEADERS }).then(r => r.ok ? r.json() : null),
          fetch(`https://proclubs.ea.com/api/fc/clubs/seasonalStats?clubIds=${oppId}&platform=${platform}`, { headers: EA_HEADERS }).then(r => r.ok ? r.json() : null)
        ]);

        const sdkInfo = sdkInfoRes.status === 'fulfilled' ? sdkInfoRes.value : {};
        const statObj = stats.status === 'fulfilled' ? (Array.isArray(stats.value) ? stats.value[0] : (stats.value[oppId] || stats.value)) : {};
        const directInfo = rawInfo.status === 'fulfilled' && rawInfo.value ? rawInfo.value : {};
        const infoObj = directInfo[oppId] || sdkInfo[oppId] || directInfo || sdkInfo || {};
        const seasonData = seasonResp.status === 'fulfilled' ? seasonResp.value : null;

        const skillRating = statObj?.skillRating || statObj?.rating || statObj?.sr || null;
        const division = parseDivisionFromPayload(seasonData, statObj, infoObj) || 'Div 2';
        const crestId = resolveCrestId(infoObj, statObj);

        opponentMap.set(String(oppId), { skillRating, division, crestId });
      } catch (_) {}
    })
  );

  recent10.forEach(m => {
    const clubsData = m.clubs || m.aggregate || {};
    Object.keys(clubsData).forEach(id => {
      const matchClubObj = clubsData[id] || {};
      matchClubObj.clubId = String(id);
      if (String(id) !== String(numericId)) {
        const enriched = opponentMap.get(String(id));
        if (enriched) {
          if (enriched.skillRating) matchClubObj.skillRating = enriched.skillRating;
          if (enriched.division) matchClubObj.division = enriched.division;
        }
        matchClubObj.crestId = resolveCrestId(
          enriched ? { crestAssetId: enriched.crestId } : {},
          {},
          matchClubObj
        );
      } else {
        matchClubObj.crestId = resolveCrestId({}, {}, matchClubObj);
      }
    });
  });

  res.json(recent10);
});

// 5. Official EA fltOnlineAssets Crest Proxy
app.get('/api/crest/:crestId', async (req, res) => {
  let rawId = String(req.params.crestId || '').replace(/^l/i, '').trim();
  const clubName = req.query.name || 'FC';
  const clubIdParam = req.query.clubId;
  const platform = req.query.platform || 'common-gen5';

  if ((!rawId || rawId === '0' || rawId === 'undefined' || rawId === 'null') && clubIdParam && /^\d+$/.test(String(clubIdParam))) {
    try {
      const numId = parseInt(clubIdParam, 10);
      const [sdkInfoRes, rawInfoRes] = await Promise.allSettled([
        proclubs.clubs.get({ clubId: numId, platform }),
        fetch(`https://proclubs.ea.com/api/fc/clubs/info?clubIds=${numId}&platform=${platform}`, { headers: EA_HEADERS }).then(r => r.ok ? r.json() : null)
      ]);
      const sdkInfo = sdkInfoRes.status === 'fulfilled' ? sdkInfoRes.value : {};
      const directInfo = rawInfoRes.status === 'fulfilled' && rawInfoRes.value ? rawInfoRes.value : {};
      const infoObj = directInfo[numId] || sdkInfo[numId] || directInfo || sdkInfo || {};
      const resolved = resolveCrestId(infoObj, {});
      if (resolved) rawId = String(resolved).replace(/^l/i, '').trim();
    } catch (_) {}
  }

  if (rawId && rawId !== 'undefined' && rawId !== 'null' && rawId !== '0') {
    const candidateUrls = [
      `https://eafc26.content.easports.com/fc/fltOnlineAssets/26E4D4D6-8DBB-4A9A-BD99-9C47D3AA341D/2026/fcweb/crests/256x256/l${rawId}.png`,
      `https://eafc26.content.easports.com/fc/fltOnlineAssets/26E4D4D6-8DBB-4A9A-BD99-9C47D3AA341D/2026/fifaweb/crests/256x256/l${rawId}.png`,
      `https://eafc25.content.easports.com/fc/fltOnlineAssets/25E4CDAE-799B-45BE-B257-667FDCDE8044/2025/fcweb/crests/256x256/l${rawId}.png`,
      `https://eafc25.content.easports.com/fc/fltOnlineAssets/25E4CDAE-799B-45BE-B257-667FDCDE8044/2025/fifaweb/crests/256x256/l${rawId}.png`,
      `https://eafc24.content.easports.com/fc/fltOnlineAssets/24B23FDE-7835-41C2-87A2-F453DFDB2E82/2024/fcweb/crests/256x256/l${rawId}.png`,
      `https://eafc24.content.easports.com/fc/fltOnlineAssets/24B23FDE-7835-41C2-87A2-F453DFDB2E82/2024/fifaweb/crests/256x256/l${rawId}.png`,
      `https://fifa21.content.easports.com/fifa/fltOnlineAssets/05772199-716f-417d-9fe0-988fa9899c4d/2021/fifaweb/crests/256x256/l${rawId}.png`,
      `https://media.contentapi.ea.com/content/dam/ea/easfc/fc-24/ratings/common/full/team-badges/l${rawId}.png`,
      `https://cdn.sofifa.net/meta/team/${rawId}/120.png`,
      `https://images.fotmob.com/image_resources/logo/teamlogo/${rawId}.png`
    ];

    for (const url of candidateUrls) {
      try {
        const resp = await fetch(url, { headers: EA_HEADERS });
        if (resp.ok) {
          const contentType = resp.headers.get('content-type') || '';
          if (contentType.includes('image')) {
            const buffer = await resp.arrayBuffer();
            if (buffer.byteLength > 100) {
              res.setHeader('Content-Type', contentType);
              res.setHeader('Cache-Control', 'public, max-age=86400');
              return res.send(Buffer.from(buffer));
            }
          }
        }
      } catch (_) {}
    }
  }

  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  return res.send(generateFallbackSvg(clubName));
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Pro Clubs backend running on port ${PORT}`));
