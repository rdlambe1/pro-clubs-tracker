const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

const EA_BASE_URL = 'https://proclubs.ea.com/api/fc';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': 'https://www.ea.com/',
  'Origin': 'https://www.ea.com'
};

// 1. Search Club by Name (try byName route, with fallback)
app.get('/api/search', async (req, res) => {
  const { clubName, platform = 'common-gen5' } = req.query;
  
  // Try /clubs/search first, then fallback to /clubs/byName
  const endpoints = [
    `${EA_BASE_URL}/clubs/search?clubName=${encodeURIComponent(clubName)}&platform=${platform}`,
    `${EA_BASE_URL}/clubs/byName?clubName=${encodeURIComponent(clubName)}&platform=${platform}`
  ];

  for (const url of endpoints) {
    try {
      console.log(`[Search] Attempting: ${url}`);
      const response = await axios.get(url, { headers: HEADERS, timeout: 7000 });
      if (response.data && Object.keys(response.data).length > 0) {
        return res.json(response.data);
      }
    } catch (err) {
      console.log(`[Search] Failed on ${url}: ${err.response?.status || err.message}`);
    }
  }

  res.status(404).json({ error: `Could not resolve club name "${clubName}". Try searching by numeric Club ID directly.` });
});

// 2. Club Overall Info by numeric ID
app.get('/api/club/:clubId/info', async (req, res) => {
  const { clubId } = req.params;
  const { platform = 'common-gen5' } = req.query;
  try {
    const url = `${EA_BASE_URL}/clubs/info?clubIds=${clubId}&platform=${platform}`;
    console.log(`[Info] Querying: ${url}`);
    const response = await axios.get(url, { headers: HEADERS, timeout: 8000 });
    res.json(response.data);
  } catch (error) {
    console.error(`[Info Error] Status: ${error.response?.status} - ${error.message}`);
    res.status(error.response?.status || 500).json({ error: error.message });
  }
});

// 3. Member / Squad Stats by numeric ID
app.get('/api/club/:clubId/members', async (req, res) => {
  const { clubId } = req.params;
  const { platform = 'common-gen5' } = req.query;
  try {
    const url = `${EA_BASE_URL}/members/stats?clubId=${clubId}&platform=${platform}`;
    console.log(`[Members] Querying: ${url}`);
    const response = await axios.get(url, { headers: HEADERS, timeout: 8000 });
    res.json(response.data);
  } catch (error) {
    console.error(`[Members Error] Status: ${error.response?.status} - ${error.message}`);
    res.status(error.response?.status || 500).json({ error: error.message });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Running on port ${PORT}`));
