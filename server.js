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
  'Accept-Language': 'en-GB,en;q=0.9',
  'Referer': 'https://www.ea.com/',
  'Origin': 'https://www.ea.com'
};

// 1. Search Any Club by Name Across Platforms
app.get('/api/search', async (req, res) => {
  const { clubName, platform = 'common-gen5' } = req.query;
  if (!clubName) return res.status(400).json({ error: 'Club name required' });

  const cleanName = clubName.trim();
  
  // Try direct search, lowercase search, and byName variations
  const candidateUrls = [
    `${EA_BASE_URL}/clubs/search?platform=${platform}&clubName=${encodeURIComponent(cleanName)}`,
    `${EA_BASE_URL}/clubs/search?platform=${platform}&clubName=${encodeURIComponent(cleanName.toLowerCase())}`,
    `${EA_BASE_URL}/clubs/byName?platform=${platform}&clubName=${encodeURIComponent(cleanName)}`
  ];

  for (const url of candidateUrls) {
    try {
      console.log(`[Search Attempt] Querying: ${url}`);
      const response = await axios.get(url, { headers: HEADERS, timeout: 6000 });
      
      if (response.data && typeof response.data === 'object' && Object.keys(response.data).length > 0) {
        console.log(`[Search Success] Matches found`);
        return res.json(response.data);
      }
    } catch (e) {
      console.log(`[Search Attempt Failed] ${url} - ${e.response?.status || e.message}`);
    }
  }

  res.status(404).json({ error: `No clubs found matching "${cleanName}". Check spelling or search directly with the numeric Club ID.` });
});

// 2. Club Info by Numeric ID
app.get('/api/club/:clubId/info', async (req, res) => {
  const { clubId } = req.params;
  const { platform = 'common-gen5' } = req.query;
  try {
    const response = await axios.get(`${EA_BASE_URL}/clubs/info?clubIds=${clubId}&platform=${platform}`, {
      headers: HEADERS,
      timeout: 7000
    });
    res.json(response.data);
  } catch (error) {
    res.status(error.response?.status || 500).json({ error: error.message });
  }
});

// 3. Squad & Player Performance Stats
app.get('/api/club/:clubId/members', async (req, res) => {
  const { clubId } = req.params;
  const { platform = 'common-gen5' } = req.query;
  try {
    const response = await axios.get(`${EA_BASE_URL}/members/stats?clubId=${clubId}&platform=${platform}`, {
      headers: HEADERS,
      timeout: 7000
    });
    res.json(response.data);
  } catch (error) {
    res.status(error.response?.status || 500).json({ error: error.message });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Clubs tracker running on port ${PORT}`));
