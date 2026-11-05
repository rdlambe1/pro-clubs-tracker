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

  const raw = seasonItem?.currentDivision ?? seasonItem?.division ?? statObj?.currentDivision ?? infoObj?.currentDivision ?? null;
  if (raw === undefined || raw === null || raw === '') return null;
  
  const num = parseInt(raw, 10);
  if (isNaN(num)) return String(raw);
  if (num === 0) return 'Elite';
  return `Div ${num}`;
}

// Generates dynamic fallback shields for custom clubs
function generateFallbackSvg(name) {
  const initials = (name || 'FC').substring(0, 2).toUpperCase();
  const palettes = [
    { bg1: '#10b981', bg2: '#064e3b', stroke: '#34d399' }, // Emerald
    { bg1: '#3b82f6', bg2: '#1e3a8a', stroke: '#60a5fa' }, // Blue
    { bg1: '#f59e0b', bg2: '#78350f', stroke: '#fbbf24' }, // Amber
    { bg1: '#8b5cf6', bg2: '#4c1d95', stroke: '#a78bfa' }, // Purple
    { bg1: '#ef4444', bg2: '#7f1d1d', stroke: '#f87171' }, // Red
    { bg1: '#06b6d4', bg2: '#164e63', stroke: '#22d3ee' }  // Cyan
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

app.get('/api/club/:clubId/info', async (req, res) => {
  const { clubId } = req.params;
  const { platform = 'common-gen5' } = req.query;
  const numericId = parseInt(clubId, 10);
  if (isNaN(numericId) || numericId <= 0) return res.status(400).json({ error: `Invalid clubId` });

  try {
    const [infoRes, statsRes] = await Promise.allSettled([
      proclubs.clubs.get({ clubId: numericId, platform }),
      proclubs.clubs.overallStats({ clubId: numericId, platform })
    ]);

    const info = infoRes.status === 'fulfilled' ? infoRes.value : {};
    const overall = statsRes.status === 'fulfilled' ? statsRes.value : {};

    const statObj = Array.isArray(overall) ? (overall[0]
