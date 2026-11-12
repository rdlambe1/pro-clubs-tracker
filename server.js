import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { ProClubsClient } from 'proclubs-sdk';
import { eaFetch, valOf, unwrapEa, extractClubId, resolveCrestId, resolveClubDivisions, computeGlobalPercentile, computeClubRepAndFans, buildSeasonsHistory, generateFallbackSvg } from './eaHelpers.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const proclubs = new ProClubsClient({ cache: false });

// 0. Global Top 10 Clubs Leaderboard (30-Minute In-Memory Cache)
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

// 1. Search Clubs
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

// 2. Club Info
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
    const { currDivNum, divisionLabel, peakDivNum, peakDivisionLabel } = resolveClubDivisions(currSeasonLb, allTimeLb, statObj);
    const ck = infoObj.customKit || lbClubInfo.customKit || statObj.customKit || {};
    const kits = {
      home: [eaIntToHex(ck.kitColor1, '#10b981'), eaIntToHex(ck.kitColor2, '#ffffff'), eaIntToHex(ck.kitColor3, '#064e3b')],
      away: [eaIntToHex(ck.kitAColor1, '#1e293b'), eaIntToHex(ck.kitAColor2, '#38bdf8'), eaIntToHex(ck.kitAColor3, '#0f172a')],
      third: [eaIntToHex(ck.kitThrdColor1 || ck.dCustomKit || ck.kitColor3, '#f59e0b'), eaIntToHex(ck.kitThrdColor2 || ck.kitColor1, '#111827'), eaIntToHex(ck.kitThrdColor3 || ck.kitAColor2, '#ffffff')]
    };
    const sr = Number(statObj.skillRating ?? statObj.rating ?? allTimeLb.skillRating ?? 1500);
    const wins = Number(statObj.wins ?? statObj.overallWins ?? allTimeLb.wins ?? 0);
    const losses = Number(statObj.losses ?? statObj.overallLosses ?? allTimeLb.losses ?? 0);
    const ties = Number(statObj.ties ?? statObj.overallTies ?? allTimeLb.ties ?? 0);
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

// 3. Squad Members
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

// 4. Match History
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
    const { divisionLabel } = resolveClubDivisions(csLb, {}, st);
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

// 5. Crest Proxy
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
        const r = await fetch(`${b}${rawId}.png`);
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

// 6. Discord Webhook Integration
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
