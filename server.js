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

function parseDivision(statObj, infoObj) {
  const rawDiv = statObj?.currentDivision ?? infoObj?.currentDivision ?? statObj?.division ?? infoObj?.division ?? null;
  if (!rawDiv || rawDiv === '0' || rawDiv === 0) return 'Elite';
  return `Div ${rawDiv}`;
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

    if (results.length === 0) {
      return res.status(404).json({ error: `No clubs found matching "${clubName}" on ${platform}.` });
    }

    res.json(results);
  } catch (error) {
    console.error('[Search Error]:', error);
    res.status(500).json({ error: error.message || 'Error searching clubs' });
  }
});

// 2. Club Info + Overall W-D-L, Skill Rating, Division & Badge ID
app.get('/api/club/:clubId/info', async (req, res) => {
  const { clubId } = req.params;
  const { platform = 'common-gen5' } = req.query;

  const numericId = parseInt(clubId, 10);
  if (isNaN(numericId) || numericId <= 0) {
    return res.status(400).json({ error: `Invalid clubId: ${clubId}` });
  }

  try {
    const [infoRes, statsRes] = await Promise.allSettled([
      proclubs.clubs.get({ clubId: numericId, platform }),
      proclubs.clubs.overallStats({ clubId: numericId, platform })
    ]);

    const info = infoRes.status === 'fulfilled' ? infoRes.value : {};
    const overall = statsRes.status === 'fulfilled' ? statsRes.value : {};

    const statObj = Array.isArray(overall) ? (overall[0] || {}) : (overall[clubId] || overall);
    const infoObj = info[clubId] || info;
    const division = parseDivision(statObj, infoObj);

    // Resolve team badge ID
    const crestId = infoObj.crestId || statObj.crestId || infoObj.teamId || statObj.teamId || infoObj.customKit?.crestId || statObj.customKit?.crestId || null;

    res.json({ info, overall, division, crestId });
  } catch (error) {
    console.error(`[Club Info Error ${clubId}]:`, error);
    res.status(500).json({ error: error.message || 'Failed to fetch club info' });
  }
});

// 3. Member / Squad Stats
app.get('/api/club/:clubId/members', async (req, res) => {
  const { clubId } = req.params;
  const { platform = 'common-gen5' } = req.query;

  const numericId = parseInt(clubId, 10);
  if (isNaN(numericId) || numericId <= 0) {
    return res.status(400).json({ error: `Invalid clubId: ${clubId}` });
  }

  try {
    const members = await proclubs.members.stats({ clubId: numericId, platform });
    res.json(members);
  } catch (error) {
    console.error(`[Squad Error ${clubId}]:`, error);
    res.status(500).json({ error: error.message || 'Failed to fetch squad stats' });
  }
});

// 4. Match History (Enriched with opponent live Skill Rating, Division & Crest IDs)
app.get('/api/club/:clubId/matches', async (req, res) => {
  const { clubId } = req.params;
  const { platform = 'common-gen5' } = req.query;

  const numericId = parseInt(clubId, 10);
  if (isNaN(numericId) || numericId <= 0) {
    return res.status(400).json({ error: `Invalid clubId: ${clubId}` });
  }

  const allMatches = [];
  const matchTypes = [
    { type: 'leagueMatch', label: 'League' },
    { type: 'playoffMatch', label: 'Playoff' }
  ];

  for (const m of matchTypes) {
    const url = `https://proclubs.ea.com/api/fc/clubs/matches?clubIds=${numericId}&platform=${platform}&matchType=${m.type}&maxResultCount=15`;
    try {
      const response = await fetch(url, { headers: EA_HEADERS });
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
    } catch (err) {
      console.log(`[Matches fetch error for ${m.label}]:`, err.message);
    }
  }

  allMatches.sort((a, b) => Number(b.timestamp || 0) - Number(a.timestamp || 0));
  const recent10 = allMatches.slice(0, 10);

  const opponentIds = new Set();
  recent10.forEach(m => {
    const clubsData = m.clubs || m.aggregate || {};
    Object.keys(clubsData).forEach(id => {
      if (String(id) !== String(numericId) && Number(id) > 0) {
        opponentIds.add(Number(id));
      }
    });
  });

  const opponentMap = new Map();
  await Promise.allSettled(
    Array.from(opponentIds).map(async (oppId) => {
      try {
        const [stats, info] = await Promise.allSettled([
          proclubs.clubs.overallStats({ clubId: oppId, platform }),
          proclubs.clubs.get({ clubId: oppId, platform })
        ]);

        const statObj = stats.status === 'fulfilled' ? (Array.isArray(stats.value) ? stats.value[0] : (stats.value[oppId] || stats.value)) : {};
        const infoObj = info.status === 'fulfilled' ? (info.value[oppId] || info.value) : {};

        const skillRating = statObj.skillRating || statObj.rating || statObj.sr || null;
        const division = parseDivision(statObj, infoObj);
        const crestId = infoObj.crestId || statObj.crestId || infoObj.teamId || statObj.teamId || infoObj.customKit?.crestId || statObj.customKit?.crestId || null;

        opponentMap.set(String(oppId), { skillRating, division, crestId });
      } catch (_) {}
    })
  );

  recent10.forEach(m => {
    const clubsData = m.clubs || m.aggregate || {};
    Object.keys(clubsData).forEach(id => {
      if (String(id) !== String(numericId)) {
        const enriched = opponentMap.get(String(id));
        if (enriched) {
          if (enriched.skillRating) clubsData[id].skillRating = enriched.skillRating;
          if (enriched.division) clubsData[id].division = enriched.division;
          if (enriched.crestId) clubsData[id].crestId = enriched.crestId;
        }
        if (!clubsData[id].crestId) {
          clubsData[id].crestId = clubsData[id].details?.crestId || clubsData[id].teamId || clubsData[id].details?.teamId || null;
        }
      }
    });
  });

  res.json(recent10);
});

// 5. Backend Crest Image Proxy with Multiple Resilient CDNs
app.get('/api/crest/:crestId', async (req, res) => {
  const { crestId } = req.params;
  if (!crestId || crestId === 'undefined' || crestId === 'null') {
    return res.status(404).send('No crest ID');
  }

  // Known high-availability EA FC logo CDNs
  const sources = [
    {
      url: `https://images.fotmob.com/image_resources/logo/teamlogo/${crestId}.png`,
      headers: { 'User-Agent': 'Mozilla/5.0' }
    },
    {
      url: `https://fifa21.content.easports.com/fifa/fltOnlineAssets/05772199-716f-417d-9fe0-988fa9899c4d/2024/fc/crests/light/previews/crest_${crestId}.png`,
      headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://www.ea.com/' }
    },
    {
      url: `https://cdn.sofifa.net/meta/team/${crestId}/60.png`,
      headers: { 'User-Agent': 'Mozilla/5.0' }
    },
    {
      url: `https://proclubshead.com/assets/img/club-crests/light/crest_${crestId}.png`,
      headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://proclubshead.com/' }
    }
  ];

  for (const src of sources) {
    try {
      const resp = await fetch(src.url, { headers: src.headers });
      if (resp.ok) {
        const contentType = resp.headers.get('content-type') || 'image/png';
        const buffer = await resp.arrayBuffer();
        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', 'public, max-age=86400');
        return res.send(Buffer.from(buffer));
      }
    } catch (_) {}
  }

  res.status(404).send('Crest not found');
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Pro Clubs backend running on port ${PORT}`));
