const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

const EA_BASE_URL = 'https://proclubs.ea.com/api/fc';

// Full desktop browser headers to bypass EA bot blocks
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': 'https://www.ea.com/',
  'Origin': 'https://www.ea.com'
};

// 1. Search Club by Name
app.get('/api/search', async (req, res) => {
  const { clubName, platform = 'common-gen5' } = req.query;
  try {
    const url = `${EA_BASE_URL}/clubs/search`;
    console.log(`[Search] Querying EA: ${url}?clubName=${clubName}&platform=${platform}`);
    
    const response = await axios.get(url, {
      params: { clubName, platform },
      headers: HEADERS,
      timeout: 8000
    });

    console.log(`[Search] Success. Result keys:`, Object.keys(response.data || {}));
    res.json(response.data);
  } catch (error) {
    console.error(`[Search Error] Status: ${error.response?.status} - ${error.message}`);
    res.status(error.response?.status || 500).json({ 
      error: error.message,
      status: error.response?.status || 500
    });
  }
});

// 2. Club Overall Info
app.get('/api/club/:clubId/info', async (req, res) => {
  const { clubId } = req.params;
  const { platform = 'common-gen5' } = req.query;
  try {
    const response = await axios.get(`${EA_BASE_URL}/clubs/info`, {
      params: { clubIds: clubId, platform },
      headers: HEADERS,
      timeout: 8000
    });
    res.json(response.data);
  } catch (error) {
    console.error(`[Info Error] Status: ${error.response?.status} - ${error.message}`);
    res.status(error.response?.status || 500).json({ error: error.message });
  }
});

// 3. Member / Squad Stats
app.get('/api/club/:clubId/members', async (req, res) => {
  const { clubId } = req.params;
  const { platform = 'common-gen5' } = req.query;
  try {
    const response = await axios.get(`${EA_BASE_URL}/members/stats`, {
      params: { clubId, platform },
      headers: HEADERS,
      timeout: 8000
    });
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
