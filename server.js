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

// 2. Club Info + Overall W-D-L & Skill Rating
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

    res.json({ info, overall });
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

// 4. Match History (EA's exact clubsMatches endpoint)
app.get('/api/club/:clubId/matches', async (req, res) => {
  const { clubId } = req.params;
  const { platform = 'common-gen5' } = req.query;

  const numericId = parseInt(clubId, 10);
  if (isNaN(numericId) || numericId <= 0) {
    return res.status(400).json({ error: `Invalid clubId: ${clubId}` });
  }

  const allMatches = [];
  const logDetails = [];

  // Query clubsMatches directly using EA's valid query parameters
  const targets = [
    { url: `https://proclubs.ea.com/api/fc/clubsMatches?clubIds=${numericId}&platform=${platform}&matchType=gameType9`, label: 'League' },
    { url: `https://proclubs.ea.com/api/fc/clubsMatches?clubIds=${numericId}&platform=${platform}&matchType=gameType13`, label: 'Playoff' },
    { url: `https://proclubs.ea.com/api/fc/clubsMatches?clubIds=${numericId}&platform=${platform}`, label: 'Overall' }
  ];

  for (const t of targets) {
    try {
      const response = await fetch(t.url, { headers: EA_HEADERS });
      const statusText = `HTTP ${response.status}`;

      if (response.ok) {
        const data = await response.json();
        const list = Array.isArray(data) ? data : (typeof data === 'object' && data !== null ? Object.values(data) : []);
        logDetails.push(`${t.label}: ${list.length} (${statusText})`);

        list.forEach(item => {
          if (item && typeof item === 'object') {
            const key = item.matchId || item.timestamp;
            if (key && !allMatches.some(x => (x.matchId || x.timestamp) === key)) {
              item._inferredCategory = t.label;
              allMatches.push(item);
            }
          }
        });
      } else {
        logDetails.push(`${t.label}: ${statusText}`);
      }
    } catch (err) {
      logDetails.push(`${t.label} Error: ${err.message}`);
    }
  }

  // Sort newest first
  allMatches.sort((a, b) => {
    const tA = Number(a.timestamp || 0);
    const tB = Number(b.timestamp || 0);
    return tB - tA;
  });

  res.json({
    debugLogs: logDetails,
    matches: allMatches.slice(0, 10)
  });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Pro Clubs backend running on port ${PORT}`));
