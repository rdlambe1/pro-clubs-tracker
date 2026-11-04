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

const proclubs = new ProClubsClient({ cache: true });

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

// 4. Match History (Queries both leagueMatch and playoffMatch)
app.get('/api/club/:clubId/matches', async (req, res) => {
  const { clubId } = req.params;
  const { platform = 'common-gen5' } = req.query;

  const numericId = parseInt(clubId, 10);
  if (isNaN(numericId) || numericId <= 0) {
    return res.status(400).json({ error: `Invalid clubId: ${clubId}` });
  }

  const allMatches = [];
  const matchTypes = ['leagueMatch', 'playoffMatch'];

  for (const mType of matchTypes) {
    try {
      let data = null;

      // Method 1: proclubs.clubs.matches
      if (typeof proclubs.clubs?.matches === 'function') {
        data = await proclubs.clubs.matches({ clubId: numericId, platform, matchType: mType });
      } 
      // Method 2: proclubs.matches.get
      else if (typeof proclubs.matches?.get === 'function') {
        data = await proclubs.matches.get({ clubId: numericId, clubIds: numericId, platform, matchType: mType });
      }
      // Method 3: Direct internal request
      else if (typeof proclubs.request === 'function') {
        data = await proclubs.request({
          endpoint: 'clubsMatches',
          query: { clubIds: numericId, platform, matchType: mType }
        });
      }

      if (data) {
        const matchesList = Array.isArray(data) ? data : Object.values(data);
        matchesList.forEach(m => {
          if (m && typeof m === 'object') {
            m._inferredType = mType;
            allMatches.push(m);
          }
        });
      }
    } catch (err) {
      console.log(`[Matches query failed for ${mType}]:`, err.message);
    }
  }

  // Fallback: If no league/playoff matches returned, check overall match history without matchType filter
  if (allMatches.length === 0) {
    try {
      if (typeof proclubs.clubs?.matches === 'function') {
        const fallbackData = await proclubs.clubs.matches({ clubId: numericId, platform });
        const list = Array.isArray(fallbackData) ? fallbackData : Object.values(fallbackData || {});
        list.forEach(m => {
          if (m && typeof m === 'object') allMatches.push(m);
        });
      }
    } catch (e) {
      console.log('[Matches generic fallback skipped]:', e.message);
    }
  }

  console.log(`[Matches found for ID ${numericId}]: ${allMatches.length}`);

  // Sort newest first
  allMatches.sort((a, b) => {
    const tA = Number(a.timestamp || a.timeAgo?.number || 0);
    const tB = Number(b.timestamp || b.timeAgo?.number || 0);
    return tB - tA;
  });

  res.json(allMatches.slice(0, 10));
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Pro Clubs backend running on port ${PORT}`));
