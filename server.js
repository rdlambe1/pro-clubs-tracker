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

function resolveCrestId(infoObj = {}, statObj = {}) {
  const customKit = infoObj?.customKit || statObj?.customKit || {};
  const candidates = [
    customKit.crestAssetId,
    customKit.crestId,
    infoObj.crestAssetId,
    infoObj.crestId,
    statObj.crestAssetId,
    statObj.crestId,
    infoObj.teamId,
    statObj.teamId
  ];
  for (const c of candidates) {
    if (c !== undefined && c !== null && String(c) !== '' && String(c) !== '0') {
      return String(c);
    }
  }
  return null;
}

function parseDivisionFromPayload(seasonData, statObj, infoObj) {
  let seasonItem = null;
  if (Array.isArray(seasonData)) {
    seasonItem = seasonData[0];
  } else if (seasonData && typeof seasonData === 'object') {
    seasonItem = Object.values(seasonData)[0] || seasonData;
  }

  const raw = seasonItem?.currentDivision ?? seasonItem?.division ?? statObj?.currentDivision ?? statObj?.bestDivision ?? infoObj?.currentDivision ?? null;
  if (raw === undefined || raw === null || raw === '') return null;
  
  const num = parseInt(raw, 10);
  if (isNaN(num)) return String(raw);
  if (num <= 0 || num === 1) return num === 0 ? 'Elite' : 'Div 1';
  return `Div ${num}`;
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

// 2. Club Info + Overall W-D-L, Skill Rating & Division
app.get('/api/club/:clubId/info', async (req, res) => {
  const { clubId } = req.params;
  const { platform = 'common-gen5' } = req.query;
  const numericId = parseInt(clubId, 10);
  if (isNaN(numericId) || numericId <= 0) return res.status(400).json({ error: 'Invalid clubId' });

  try {
    const [infoRes, statsRes] = await Promise.allSettled([
      proclubs.clubs.get({ clubId: numericId, platform }),
      proclubs.clubs.overallStats({ clubId: numericId, platform })
    ]);

    const info = infoRes.status === 'fulfilled' ? infoRes.value : {};
    const overall = statsRes.status === 'fulfilled' ? statsRes.value : {};

    const statObj = Array.isArray(overall) ? (overall[0] || {}) : (overall[clubId] || overall);
    const infoObj = info[clubId] || info;

    let seasonalPayload = null;
    try {
      const seasonResp = await fetch(`https://proclubs.ea.com/api/fc/clubs/seasonalStats?clubIds=${numericId}&platform=${platform}`, { headers: EA_HEADERS });
      if (seasonResp.ok) seasonalPayload = await seasonResp.json();
    } catch (_) {}

    const division = parseDivisionFromPayload(seasonalPayload, statObj, infoObj) || 'Div 2';
    const crestId = resolveCrestId(infoObj, statObj);

    const trophies = {
      titlesWon: Number(statObj.titlesWon ?? 0),
      leaguesWon: Number(statObj.leaguesWon ?? 0),
      promotions: Number(statObj.promotions ?? 0),
      bestDivision: parseDivisionFromPayload({ currentDivision: statObj.bestDivision }, {}, {}) || division
    };

    res.json({ info: infoObj, overall: statObj, division, crestId, trophies });
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
    const members = await proclubs.members.stats({ clubId: numericId, platform });
    res.json(members);
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
        const [stats, info, seasonResp] = await Promise.allSettled([
          proclubs.clubs.overallStats({ clubId: oppId, platform }),
          proclubs.clubs.get({ clubId: oppId, platform }),
          fetch(`https://proclubs.ea.com/api/fc/clubs/seasonalStats?clubIds=${oppId}&platform=${platform}`, { headers: EA_HEADERS }).then(r => r.ok ? r.json() : null)
        ]);

        const statObj = stats.status === 'fulfilled' ? (Array.isArray(stats.value) ? stats.value[0] : (stats.value[oppId] || stats.value)) : {};
        const infoObj = info.status === 'fulfilled' ? (info.value[oppId] || info.value) : {};
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
      if (String(id) !== String(numericId)) {
        const enriched = opponentMap.get(String(id));
        if (enriched) {
          if (enriched.skillRating) matchClubObj.skillRating = enriched.skillRating;
          if (enriched.division) matchClubObj.division = enriched.division;
          if (enriched.crestId) matchClubObj.crestId = enriched.crestId;
        }
        if (!matchClubObj.crestId) matchClubObj.crestId = resolveCrestId(matchClubObj, matchClubObj.details);
      } else {
        matchClubObj.crestId = resolveCrestId({}, {}, matchClubObj);
      }
    });
  });

  res.json(recent10);
});

// 5. Backend Crest Image Proxy
app.get('/api/crest/:crestId', async (req, res) => {
  const rawId = String(req.params.crestId || '').replace(/^l/i, '').trim();
  const clubName = req.query.name || 'FC';

  if (rawId && rawId !== 'undefined' && rawId !== 'null' && rawId !== '0') {
    const candidateUrls = [
      `https://images.fotmob.com/image_resources/logo/teamlogo/${rawId}.png`,
      `https://cdn.sofifa.net/meta/team/${rawId}/120.png`,
      `https://proclubshead.com/assets/img/club-crests/light/crest_${rawId}.png`,
      `https://fifa21.content.easports.com/fifa/fltOnlineAssets/05772199-716f-417d-9fe0-988fa9899c4d/2021/fifaweb/crests/256x256/l${rawId}.png`
    ];

    for (const url of candidateUrls) {
      try {
        const resp = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
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
