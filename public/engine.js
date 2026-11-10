const API_BASE = '/api';
let GLOBAL_MEMBERS = [], GLOBAL_MATCHES = [], GLOBAL_COMBINED_DATA = {}, GLOBAL_CLUB_ID = null;
let RECENT_FORM_MAP = {}, RECENT_10_STATS_MAP = {}, SESSION_MATCHES_CACHE = [], SHAME_LIST_CACHE = [], MATCH_PLAYER_META = {};
let TOP_FIDGET_SPINNER_NAME = null, TOP_MEAT_WALL_NAME = null, CURRENT_CLUB_CREST_URL = '', ACTIVE_MODAL_PLAYER = null;
let CURRENT_PITCH_MODE = 'lastMatch', CURRENT_RECAP_MODE = 'session', CURRENT_BANTER_MODE = 'last10', ACTIVE_TAB = 'team';

const slugifyClubName = (name) => String(name || '').toLowerCase().trim().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const escXml = (s) => String(s || '').replace(/&/g, '&').replace(/</g, '<').replace(/>/g, '>').replace(/"/g, '"');

const COUNTRY_NAME_TO_ISO = {
  'ireland':'ie','republic of ireland':'ie','northern ireland':'gb-nir','england':'gb-eng','scotland':'gb-sct','wales':'gb-wls','united kingdom':'gb','great britain':'gb',
  'united states':'us','united states of america':'us','usa':'us','canada':'ca','mexico':'mx','haiti':'ht','jamaica':'jm','trinidad and tobago':'tt','costa rica':'cr','panama':'pa','honduras':'hn','el salvador':'sv','guatemala':'gt','cuba':'cu','dominican republic':'do','puerto rico':'pr','curacao':'cw','suriname':'sr','bermuda':'bm','barbados':'bb',
  'brazil':'br','argentina':'ar','colombia':'co','uruguay':'uy','chile':'cl','peru':'pe','ecuador':'ec','venezuela':'ve','paraguay':'py','bolivia':'bo','guyana':'gy',
  'france':'fr','germany':'de','spain':'es','italy':'it','netherlands':'nl','holland':'nl','portugal':'pt','belgium':'be','croatia':'hr','switzerland':'ch','austria':'at',
  'poland':'pl','denmark':'dk','sweden':'se','norway':'no','finland':'fi','iceland':'is','turkey':'tr','turkiye':'tr','greece':'gr','serbia':'rs','ukraine':'ua','czechia':'cz','czech republic':'cz','romania':'ro','hungary':'hu','slovakia':'sk','slovenia':'si','albania':'al','bosnia and herzegovina':'ba','bosnia-herzegovina':'ba','kosovo':'xk','north macedonia':'mk','montenegro':'me','bulgaria':'bg','georgia':'ge','armenia':'am','israel':'il','cyprus':'cy','luxembourg':'lu','malta':'mt','estonia':'ee','latvia':'lv','lithuania':'lt',
  'nigeria':'ng','morocco':'ma','senegal':'sn','ghana':'gh','egypt':'eg','algeria':'dz','cameroon':'cm','ivory coast':'ci','cote d\'ivoire':'ci','mali':'ml','tunisia':'tn','south africa':'za','dr congo':'cd','congo dr':'cd','guinea':'gn','burkina faso':'bf','cape verde':'cv','gabon':'ga','gambia':'gm','angola':'ao','zambia':'zm','zimbabwe':'zw','kenya':'ke','uganda':'ug',
  'japan':'jp','south korea':'kr','korea republic':'kr','australia':'au','new zealand':'nz','saudi arabia':'sa','iran':'ir','iraq':'iq','qatar':'qa','united arab emirates':'ae','uae':'ae','uzbekistan':'uz','china':'cn','china pr':'cn','india':'in','philippines':'ph','thailand':'th','vietnam':'vn','indonesia':'id','malaysia':'my','singapore':'sg','hong kong':'hk'
};

function extractNationFromVproAttr(vproattr) {
  if (!vproattr || typeof vproattr !== 'string') return null;
  const parts = vproattr.split('|').map(x => parseInt(x, 10));
  if (parts.length > 4 && parts[3] >= 1 && parts[3] <= 219 && (parts[0] > 140 || parts[1] > 140)) {
    return String(parts[3]);
  }
  return null;
}

function findMemberMeta(playerName) {
  const key = String(playerName || '').toLowerCase().trim();
  if (!key) return null;
  return GLOBAL_MEMBERS.find(m =>
    String(m.name || '').toLowerCase().trim() === key ||
    String(m.username || '').toLowerCase().trim() === key ||
    String(m.proName || '').toLowerCase().trim() === key
  ) || MATCH_PLAYER_META[key] || null;
}

function getShirtLabel(playerName) {
  const m = findMemberMeta(playerName);
  const mp = MATCH_PLAYER_META[String(playerName || '').toLowerCase().trim()];
  const raw = String(m?.proName || mp?.proName || m?.vproname || playerName || 'PRO').trim().toUpperCase();
  return raw.length > 12 ? raw.substring(0, 11) + '.' : raw;
}

function resolvePlayerFlagUrl(playerObjOrName) {
  const nameStr = typeof playerObjOrName === 'string' ? playerObjOrName : (playerObjOrName?.name || playerObjOrName?.playername || '');
  const memberObj = (playerObjOrName && typeof playerObjOrName === 'object') ? playerObjOrName : findMemberMeta(nameStr);
  const matchMeta = MATCH_PLAYER_META[String(nameStr).toLowerCase().trim()] || null;

  for (const target of [memberObj, matchMeta]) {
    if (!target) continue;

    const rawNum = String(
      target.proNationality ?? target.nationalityId ?? target.nationality?.id ??
      (typeof target.nationality === 'number' || /^\d+$/.test(String(target.nationality || '').trim()) ? target.nationality : '') ??
      target.nation ?? extractNationFromVproAttr(target.vproattr) ?? ''
    ).trim().replace(/^0+/, '');

    if (rawNum && EA_NATION_TO_ISO[rawNum]) {
      return `https://flagcdn.com/w40/${EA_NATION_TO_ISO[rawNum].toLowerCase()}.png`;
    }

    const sdkIso = String(target.nationality?.isoCode ?? target.nationality?.code ?? target.isoCode ?? target.countryCode ?? '').trim().toLowerCase();
    if (sdkIso) {
      const iso3Map = { eng:'gb-eng', sct:'gb-sct', wls:'gb-wls', nir:'gb-nir', gbr:'gb', irl:'ie', usa:'us', mex:'mx', hti:'ht', can:'ca', bra:'br', arg:'ar', col:'co', uru:'uy', chl:'cl', per:'pe', fra:'fr', ger:'de', deu:'de', esp:'es', ita:'it', ned:'nl', nld:'nl', por:'pt', prt:'pt', bel:'be', cro:'hr', hrv:'hr', sui:'ch', che:'ch', aut:'at', pol:'pl', den:'dk', dnk:'dk', swe:'se', nor:'no', tur:'tr', gre:'gr', grc:'gr', srb:'rs', ukr:'ua', jam:'jm', nga:'ng', mar:'ma', sen:'sn', gha:'gh', egy:'eg', alg:'dz', dza:'dz', cmr:'cm', civ:'ci', jpn:'jp', kor:'kr', aus:'au', nzl:'nz', ksa:'sa', sau:'sa' };
      const mapped = iso3Map[sdkIso] || ((sdkIso.length === 2 || sdkIso.startsWith('gb-')) ? sdkIso : null);
      if (mapped) return `https://flagcdn.com/w40/${mapped}.png`;
    }

    const rawCountry = String(typeof target.nationality === 'string' ? target.nationality : (target.nationality?.label ?? target.nationality?.name ?? target.country ?? '')).trim().toLowerCase();
    if (rawCountry) {
      if (COUNTRY_NAME_TO_ISO[rawCountry]) return `https://flagcdn.com/w40/${COUNTRY_NAME_TO_ISO[rawCountry]}.png`;
      if (rawCountry.length === 2) return `https://flagcdn.com/w40/${rawCountry}.png`;
    }
  }
  return null;
}

// Builds clean Mystery Pro Silhouette with Jersey Nameplate (transparentBg=true blends seamlessly onto UT Card foil!)
function getPlayerAvatarUrl(playerName, transparentBg = false) {
  const shirt = escXml(getShirtLabel(playerName));
  const fSize = shirt.length <= 5 ? 30 : shirt.length <= 8 ? 24 : shirt.length <= 10 ? 20 : 17;
  const bgLayers = transparentBg ? '' : `<rect width="256" height="256" fill="url(#bgG)"/><circle cx="128" cy="96" r="96" fill="url(#emH)"/>`;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 256 256" shape-rendering="geometricPrecision"><defs><radialGradient id="bgG" cx="50%" cy="38%" r="58%"><stop offset="0%" stop-color="#1e293b"/><stop offset="65%" stop-color="#0f172a"/><stop offset="100%" stop-color="#070a12"/></radialGradient><radialGradient id="emH" cx="50%" cy="32%" r="42%"><stop offset="0%" stop-color="#10b981" stop-opacity="0.22"/><stop offset="100%" stop-color="#10b981" stop-opacity="0"/></radialGradient><linearGradient id="hdG" x1="20%" y1="0%" x2="80%" y2="100%"><stop offset="0%" stop-color="#94a3b8"/><stop offset="45%" stop-color="#475569"/><stop offset="100%" stop-color="#1e293b"/></linearGradient><linearGradient id="jsG" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#334155"/><stop offset="50%" stop-color="#1e293b"/><stop offset="100%" stop-color="#090d16"/></linearGradient><linearGradient id="rmL" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#e2e8f0" stop-opacity="0.9"/><stop offset="50%" stop-color="#64748b" stop-opacity="0.4"/><stop offset="100%" stop-color="#10b981" stop-opacity="0.7"/></linearGradient></defs>${bgLayers}<path d="M 96 130 L 84 166 L 172 166 L 160 130 Z" fill="#1e293b"/><path d="M 102 130 L 96 164 L 128 176 L 160 164 L 154 130 Z" fill="url(#hdG)" opacity="0.85"/><path d="M 12 256 C 16 192 50 166 94 156 L 128 188 L 162 156 C 206 166 240 192 244 256 Z" fill="url(#jsG)" stroke="url(#rmL)" stroke-width="2.5" stroke-linejoin="round"/><path d="M 42 184 C 62 170 78 164 96 159" fill="none" stroke="#10b981" stroke-width="4" stroke-linecap="round" opacity="0.85"/><path d="M 214 184 C 194 170 178 164 160 159" fill="none" stroke="#10b981" stroke-width="4" stroke-linecap="round" opacity="0.85"/><path d="M 90 156 L 128 194 L 166 156 L 156 153 L 128 181 L 100 153 Z" fill="#0f172a" stroke="#10b981" stroke-width="1.8" stroke-linejoin="round"/><path d="M 128 32 C 100 32 84 48 84 74 L 84 86 C 79 86 76 91 77 98 C 78 105 81 109 85 109 C 88 124 98 138 112 145 C 118 148 123 149 128 149 C 133 149 138 148 144 145 C 158 138 168 124 171 109 C 175 109 178 105 179 98 C 180 91 177 86 172 86 L 172 74 C 172 48 156 32 128 32 Z" fill="url(#hdG)" stroke="url(#rmL)" stroke-width="2.5" stroke-linejoin="round"/><path d="M 94 64 C 94 48 108 38 128 38" fill="none" stroke="#f8fafc" stroke-width="2.2" stroke-linecap="round" opacity="0.45"/><rect x="44" y="201" width="168" height="34" rx="6" fill="#070a12" fill-opacity="0.68"/><text x="128" y="226" font-family="'Oswald','Arial Narrow',sans-serif" font-size="${fSize}" font-weight="900" letter-spacing="1.4" fill="#f8fafc" stroke="#070a12" stroke-width="2.5" paint-order="stroke" text-anchor="middle">${shirt}</text></svg>`;
  return `data:image/svg+xml;utf8,` + encodeURIComponent(svg);
}

function renderAvatarWithFlagHtml(playerName, sizeCls = 'w-8 h-8', borderCls = 'border-emerald-500/40', flagCls = 'w-3.5 h-2.5') {
  const flagUrl = resolvePlayerFlagUrl(playerName);
  const shirt = getShirtLabel(playerName);
  const flagImg = flagUrl
    ? `<img src="${flagUrl}" class="absolute -top-0.5 -right-0.5 ${flagCls} object-cover rounded-[2px] border border-gray-950 shadow-md z-10 pointer-events-none" alt="Flag">`
    : '';

  return `<div class="relative inline-flex flex-shrink-0" title="${playerName} (${shirt})">
    <img src="${getPlayerAvatarUrl(playerName)}" class="${sizeCls} rounded-full avatar-circle border ${borderCls} bg-gray-900 object-cover" alt="${playerName}">
    ${flagImg}
  </div>`;
}

function normalizePosition(rawPos) {
  const p = String(rawPos || '').toLowerCase().trim();
  if (['forward','striker','st','cf','lw','rw','lf','rf','ls','rs'].includes(p)) return 'FWD';
  if (['defender','defence','cb','lb','rb','lwb','rwb','lcb','rcb'].includes(p)) return 'DEF';
  return ['goalkeeper','gk'].includes(p) ? 'GK' : 'MID';
}

function getCardTierTheme(ovr) {
  const r = Number(ovr || 75);
  if (r < 76) return { tier: 'BRONZE', badgeClass: 'bg-amber-900/40 text-amber-300 border-amber-600/50', textColor: '#271406', baseStops: ['#f7d4b6','#e29e6b','#c67a43','#9c5525','#5e2d0d'], plateStops: ['#f2c29b','#c87d48','#85461b'], rimStops: ['#ffffff','#f5cba7','#7c3f19','#f7d4b6'] };
  if (r < 85) return { tier: 'SILVER', badgeClass: 'bg-slate-700/50 text-slate-200 border-slate-400/50', textColor: '#1e293b', baseStops: ['#ffffff','#e2e8f0','#cbd5e1','#94a3b8','#475569'], plateStops: ['#f1f5f9','#cbd5e1','#64748b'], rimStops: ['#ffffff','#e2e8f0','#475569','#f8fafc'] };
  return { tier: 'GOLD', badgeClass: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/50', textColor: '#2b2108', baseStops: ['#fef08a','#facc15','#eab308','#ca8a04','#854d0e'], plateStops: ['#fde047','#eab308','#a16207'], rimStops: ['#ffffff','#fde047','#a16207','#fef08a'] };
}

function computeMatchGradeAndUnitRatings(myG, oppG, stats = []) {
  let s = 0, pm = 0, pa = 0, t = 0;
  stats.forEach(p => { s += Number(p.shots||0); pm += Number(p.passesmade||0); pa += Number(p.passattempts||p.passesmade||0); t += Number(p.tacklesmade||p.tackles||0); });
  const atk = Math.min(9.9, Math.max(4.0, 5.6 + myG * 0.95 + (s > 0 ? myG / s : (myG > 0 ? 0.5 : 0)) * 1.6 + ((pa > 0 ? (pm / pa) * 100 : 75) - 70) * 0.04));
  const def = Math.min(9.9, Math.max(3.8, 7.4 + (oppG === 0 ? 1.4 : 0) - oppG * 0.85 + Math.min(1.5, t * 0.14)));
  const gd = myG - oppG, c = atk * 0.5 + def * 0.5 + gd * 0.35;
  const [grade, gradeCls] = (c >= 8.7 || (gd >= 3 && myG >= 4)) ? ['S', 'bg-yellow-500/20 text-yellow-300 border-yellow-400/50']
    : (c >= 8.0 || gd >= 2) ? ['A+', 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40']
    : (c >= 7.3 || gd === 1) ? ['A', 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30']
    : (c >= 6.4 || gd === 0) ? ['B', 'bg-amber-500/15 text-amber-300 border-amber-500/30']
    : (c >= 5.5 || gd === -1) ? ['C', 'bg-orange-500/15 text-orange-300 border-orange-500/30']
    : ['D', 'bg-rose-500/15 text-rose-400 border-rose-500/30'];
  return { grade, gradeCls, atk: atk.toFixed(1), def: def.toFixed(1) };
}

function parsePlayerMatchEvents(p = {}) {
  const ev = {};
  for (let i = 0; i < 6; i++) {
    String(p[`match_event_aggregate_${i}`] || '').split(',').forEach(pair => {
      const [k, v] = pair.split(':'), id = parseInt(k, 10), cnt = parseInt(v, 10);
      if (!isNaN(id) && !isNaN(cnt)) ev[id] = (ev[id] || 0) + cnt;
    });
  }
  const beats = ev[38] || 0, takeOns = ev[112] || 0, dribbles = ev[174] || 0, flair = ev[147] || 0;
  const skills = beats + flair + Math.max(0, takeOns - beats);

  const tackles = Number(p.tacklesmade || p.tackles || 0);
  const posStr = String(p.pos || '').toLowerCase();
  const isDef = ['defender','cb','lb','rb','lcb','rcb','lwb','rwb','cdm'].includes(posStr);

  const rawBlocks = (ev[156] || 0) + (ev[12] || 0) + (ev[51] || 0) + (ev[56] || 0);
  const blocks = rawBlocks > 0 ? rawBlocks : (isDef ? Math.max(1, Math.round(tackles * 0.5)) : Math.round(tackles * 0.3));
  const interceptions = Number(p.interceptions ?? 0) + (ev[6] || 0) + (ev[158] || 0);

  const saves = Math.max(Number(p.saves ?? 0), ev[202] || 0);
  const goalsConceded = Number(p.goalsconceded ?? p.goalsConceded ?? 0);

  const shots = Number(p.shots || 0), goals = Number(p.goals || 0), rating = parseFloat(p.rating || 7.0);
  const offsides = Number(p.offsides ?? ev[153] ?? 0);
  const rawWoodwork = Number(p.woodwork ?? p.shotsHitWoodwork ?? 0) + (ev[9] || 0) + (ev[42] || 0) + (ev[89] || 0);
  const woodwork = rawWoodwork > 0 ? rawWoodwork : ((shots >= 4 && goals === 0 && rating >= 7.2) ? 1 : (shots - goals >= 5 ? 1 : 0));

  const redCards = Number(p.redcards ?? p.redCards ?? p.red_cards ?? 0);
  const directYellow = Number(p.yellowcards ?? p.yellowCards ?? p.yellow_cards ?? 0);
  const verifiedEventYellows = (ev[95] || 0) + (ev[213] || 0);
  const yellowCards = directYellow > 0 ? directYellow : verifiedEventYellows;

  return { skillMoves: skills, dribblesCompleted: dribbles, blocks, interceptions, saves, goalsConceded, offsides, woodwork, yellowCards, redCards };
}

function computePlayerImpactScore(u) {
  const gp = Math.max(1, u.games || 1);
  const avgRat = u.ratingSum / gp;
  const normPos = u.normPos || 'MID';

  const ratingScore = avgRat * 10;
  const shotConv = u.shots > 0 ? (u.goals / u.shots) : 0;
  const wastedShots = Math.max(0, u.shots - u.goals);
  const convBonus = u.shots >= 2 ? (shotConv - 0.25) * 4.5 : (u.goals > 0 ? 1.0 : 0);
  const attackScore = ((u.goals * 3.8) + (u.assists * 3.2) - (wastedShots * 0.35)) / gp + convBonus;

  const passAtt = Math.max(u.passesMade, u.passAttempts || u.passesMade);
  const missedPasses = Math.max(0, passAtt - u.passesMade);
  const passPct = passAtt > 0 ? (u.passesMade / passAtt) * 100 : 75;
  const passAccBonus = passAtt >= 5 * gp ? ((passPct - 76) * 0.14) : 0;
  const playmakingScore = ((u.passesMade * 0.12) - (missedPasses * 0.22) + (u.skillMoves * 0.35)) / gp + passAccBonus;

  const tAtt = Math.max(u.tackles, u.tackleAttempts || u.tackles);
  const missedTackles = Math.max(0, tAtt - u.tackles);
  const csWeight = (normPos === 'DEF' || normPos === 'GK') ? 3.2 : 1.5;
  const defenseScore = ((u.tackles * 1.15) - (missedTackles * 0.25) + (u.blocks * 1.1) + (u.interceptions * 0.85) + (u.cleanSheets * csWeight)) / gp;

  const gkShotsFaced = u.saves + (u.goalsConceded || 0);
  const savePctBonus = (u.saves > 0 && gkShotsFaced >= 2) ? (((u.saves / gkShotsFaced) - 0.65) * 4.0) : 0;
  const gkScore = ((u.saves * 1.35) / gp) + savePctBonus;

  const disciplinePenalty = ((u.offsides * 0.65) + (u.yellows * 1.5) + (u.reds * 5.5)) / gp;
  return ratingScore + attackScore + playmakingScore + defenseScore + gkScore - disciplinePenalty;
}

function formatHolisticPlayerSummary(u, isPassenger = false) {
  const avg = (u.ratingSum / Math.max(1, u.games)).toFixed(1);
  const passAtt = Math.max(u.passesMade, u.passAttempts || u.passesMade);
  const passPct = passAtt > 0 ? Math.round((u.passesMade / passAtt) * 100) : 0;
  const missedPasses = Math.max(0, passAtt - u.passesMade);

  if (isPassenger) {
    const flaws = [];
    if (u.reds > 0 || u.yellows > 0) flaws.push(`${u.yellows > 0 ? `${u.yellows}🟨` : ''}${u.reds > 0 ? `${u.reds}🟥` : ''}`);
    if (u.shots >= 3 && u.goals === 0) flaws.push(`0/${u.shots} Shots`);
    else if (u.goals + u.assists > 0) flaws.push(`${u.goals}G ${u.assists}A`);
    if (missedPasses >= 4 * u.games) flaws.push(`${missedPasses} Turnovers (${passPct}%)`);
    else if (passAtt > 0) flaws.push(`${passPct}% Pass`);
    if (u.offsides >= 2) flaws.push(`${u.offsides} Offsides`);
    if (!flaws.length) flaws.push(`${u.tackles + u.interceptions} Def Act`);
    return `${avg} AVG • ${flaws.slice(0, 2).join(' • ')} (${u.games}G)`;
  }

  const highlights = [];
  if (u.saves >= 3) highlights.push(`${u.saves} Saves`);
  if (u.goals + u.assists > 0) {
    const convStr = u.shots >= 2 && u.goals > 0 ? ` (${Math.round((u.goals / u.shots) * 100)}%)` : '';
    highlights.push(`${u.goals}G ${u.assists}A${convStr}`);
  }
  const defTotal = u.tackles + u.blocks + u.interceptions;
  if (defTotal >= 2 * u.games) highlights.push(`${u.tackles}Tkl ${u.blocks + u.interceptions}Blk/Int`);
  if (u.cleanSheets > 0 && (u.normPos === 'DEF' || u.normPos === 'GK' || highlights.length < 2)) highlights.push(`${u.cleanSheets} CS`);
  if (highlights.length < 2 && passAtt > 0) highlights.push(`${passPct}% Pass`);
  return `${avg} AVG • ${highlights.slice(0, 2).join(' • ')} (${u.games}G)`;
}

function getPlayerFunTag(p) {
  const name = p.name || p.proName || 'Unknown', g = Math.max(1, Number(p.gamesPlayed ?? p.games ?? 1));
  const gpg = Number(p.goals ?? 0) / g, apg = Number(p.assists ?? 0) / g, tpg = Number(p.tacklesmade ?? p.tackles ?? 0) / g;
  const tPct = Number(p.tacklesuccessrate ?? p.tackleSuccessRate ?? 0), pPct = Number(p.passSuccessRate ?? p.passSuccess ?? 0);
  const rat = parseFloat(p.ratingAve || p.rating || 0), motm = Number(p.manOfTheMatch ?? p.motm ?? 0) / g, r10 = RECENT_10_STATS_MAP[name];

  if (r10?.superSubGA >= 1) return { label: '🦸‍♂️ Super-Sub', cls: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/50' };
  if (r10?.woodwork >= 2) return { label: '🪵 Woodwork Merchant', cls: 'bg-yellow-600/20 text-yellow-300 border-yellow-500/50' };
  if (name === TOP_MEAT_WALL_NAME || (r10?.games > 0 && r10.blocks / r10.games >= 1.5)) return { label: '🥩 Meat Wall', cls: 'bg-orange-500/20 text-orange-300 border-orange-400/50' };
  if (name === TOP_FIDGET_SPINNER_NAME || (r10?.games > 0 && r10.skillMoves / r10.games >= 3.5)) return { label: '🌀 Fidget Spinner', cls: 'bg-fuchsia-500/15 text-fuchsia-400 border-fuchsia-500/40' };
  if (motm >= 0.28 && g >= 5) return { label: '👑 MoTM Merchant', cls: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/40' };
  if (gpg >= 0.75) return { label: '🎯 Clinical Poacher', cls: 'bg-rose-500/15 text-rose-400 border-rose-500/40' };
  if (gpg >= 0.45 && apg <= gpg * 0.25) return { label: '🔫 Shoot on Sight', cls: 'bg-orange-500/15 text-orange-400 border-orange-500/40' };
  if (apg >= 0.5) return { label: '🎩 Chief Creator', cls: 'bg-purple-500/15 text-purple-400 border-purple-500/40' };
  if (pPct >= 84 && apg >= 0.25) return { label: '📐 Pass Master', cls: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/40' };
  if (tpg >= 1.8 && tPct >= 30) return { label: '🧱 Brick Wall', cls: 'bg-blue-500/15 text-blue-400 border-blue-500/40' };
  if (tpg >= 1.6 && tPct < 30) return { label: '🦵 Ankle Breaker', cls: 'bg-red-500/15 text-red-400 border-red-500/40' };
  if (gpg >= 0.35 && apg >= 0.35) return { label: '⚡ Double Threat', cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40' };
  if (pPct >= 82) return { label: '🧭 Metronome', cls: 'bg-teal-500/15 text-teal-400 border-teal-500/40' };
  if (p._normalizedPos === 'DEF') return { label: '🛡️ Backline Guardian', cls: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/40' };
  if (rat >= 7.6) return { label: '🔥 Big Game Player', cls: 'bg-amber-500/15 text-amber-400 border-amber-500/40' };
  return { label: '🫁 Box-to-Box Engine', cls: 'bg-slate-700/60 text-slate-300 border-slate-600' };
}

function computeArchetypeAndPlaystyles(p) {
  const name = String(p.name || p.proName || 'Pro'), pos = p._normalizedPos || 'MID', rawPos = String(p._rawPos || '').toUpperCase();
  const g = Math.max(1, Number(p.gamesPlayed || 1)), gpg = Number(p.goals || 0) / g, apg = Number(p.assists || 0) / g, tpg = Number(p.tacklesmade || p.tackles || 0) / g;
  const tWin = Number(p.tacklesuccessrate || 25), pPct = Number(p.passSuccessRate || 75), rat = parseFloat(p.ratingAve || 7.2), h = parseInt(p.proHeight || 180, 10);
  let seed = 0; for (let i = 0; i < name.length; i++) seed = (seed * 31 + name.charCodeAt(i)) % 1000;
  const jit = (idx) => ((seed + idx * 17) % 11) * 0.8;

  const archetype = pos === 'FWD' ? (h >= 188 ? 'Target' : gpg >= 0.65 ? 'Finisher' : apg >= 0.42 ? 'Creator' : h <= 175 ? 'Spark' : 'Hawk')
    : pos === 'MID' ? (tpg >= 1.45 ? 'Destroyer' : pPct >= 83 && apg >= 0.35 ? 'Maestro' : gpg >= 0.38 ? 'Shadow Striker' : pPct >= 80 ? 'Architect' : 'Engine')
    : pos === 'DEF' ? (rawPos.includes('B') && !rawPos.includes('CB') ? 'Marauder' : h >= 188 ? 'Titan' : 'Guardian') : 'Sweeper Keeper';

  if (pos === 'GK') return { archetype, psPlus: { slug: 'footwork', name: 'Footwork', desc: 'Boosted close-range foot saves.' }, activePlaystyles: [{ slug: 'far_reach', name: 'Far Reach', desc: 'Extended reach on outside-box shots.' }, { slug: 'cross_claimer', name: 'Cross Claimer', desc: 'Intercepts high crosses cleanly.' }] };

  const pool = [
    { slug: 'finesse_shot', name: 'Finesse Shot', desc: 'Faster finesse shots with maximum curve.', score: (pos==='FWD'?40:18) + gpg*45 + jit(1) },
    { slug: 'power_shot', name: 'Power Shot', desc: 'Faster power shots with velocity boost.', score: gpg*38 + (h>=182?10:0) + jit(2) },
    { slug: 'chip_shot', name: 'Chip Shot', desc: 'Accurate chip shots over rushing keepers.', score: gpg*32 + (rat>=7.6?14:0) + jit(3) },
    { slug: 'dead_ball', name: 'Dead Ball', desc: 'Set pieces delivered with extra curve and speed.', score: apg*30 + gpg*20 + jit(4) },
    { slug: 'incisive_pass', name: 'Incisive Pass', desc: 'Through passes are far more accurate.', score: (pos==='MID'?32:15) + apg*55 + pPct*0.3 + jit(5) },
    { slug: 'tiki_taka', name: 'Tiki Taka', desc: 'Crisp first-time ground passes with high accuracy.', score: (pPct>=80?42:10) + pPct*0.45 + jit(6) },
    { slug: 'pinged_pass', name: 'Pinged Pass', desc: 'Driven ground passes travel faster.', score: (pos==='MID'?28:12) + pPct*0.4 + apg*25 + jit(7) },
    { slug: 'whipped_pass', name: 'Whipped Pass', desc: 'Accurate driven crosses with high curve.', score: ((rawPos.includes('W')||rawPos.includes('M')||rawPos.includes('B'))?28:5) + apg*38 + jit(8) },
    { slug: 'long_ball_pass', name: 'Long Ball Pass', desc: 'Lofted through passes are harder to intercept.', score: (pos!=='FWD'?26:6) + pPct*0.35 + jit(9) },
    { slug: 'technical', name: 'Technical', desc: 'Higher Controlled Sprint speed and tight turns.', score: rat*5.5 + (gpg+apg)*20 + jit(10) },
    { slug: 'rapid', name: 'Rapid', desc: 'Higher sprint speed while dribbling.', score: (pos==='FWD'?34:16) + (h<=180?15:4) + gpg*28 + jit(11) },
    { slug: 'quick_step', name: 'Quick Step', desc: 'Faster Explosive Sprint acceleration.', score: (h<=178?32:14) + (gpg+apg)*22 + jit(12) },
    { slug: 'first_touch', name: 'First Touch', desc: 'Reduced error when trapping under pressure.', score: pPct*0.38 + gpg*22 + jit(13) },
    { slug: 'trickster', name: 'Trickster', desc: 'Unique flicks and faster strafe dribbling.', score: (pos==='FWD'?25:12) + (name===TOP_FIDGET_SPINNER_NAME?35:0) + jit(14) },
    { slug: 'press_proven', name: 'Press Proven', desc: 'Shields ball effectively from pressers.', score: (pos==='MID'?30:15) + pPct*0.35 + tpg*10 + jit(15) },
    { slug: 'trivela', name: 'Trivela', desc: 'Outside-of-the-foot passes and shots.', score: apg*32 + gpg*26 + jit(16) },
    { slug: 'anticipate', name: 'Anticipate', desc: 'Standing tackles stop ball directly at feet.', score: (pos==='DEF'?45:10) + tpg*24 + tWin*0.4 + jit(17) },
    { slug: 'intercept', name: 'Intercept', desc: 'Increased reach and ball retention on interceptions.', score: (pos!=='FWD'?32:5) + tpg*26 + jit(18) },
    { slug: 'jockey', name: 'Jockey', desc: 'Increased max speed of Sprint Jockey.', score: (pos==='DEF'?38:12) + tWin*0.45 + jit(19) },
    { slug: 'block', name: 'Block', desc: 'Increased reach when performing blocks.', score: (pos==='DEF'?40:6) + (name===TOP_MEAT_WALL_NAME?35:0) + tpg*18 + jit(20) },
    { slug: 'bruiser', name: 'Bruiser', desc: 'Greater physical strength in tackles.', score: (h>=184?28:8) + tpg*22 + jit(22) },
    { slug: 'aerial_fortress', name: 'Aerial Fortress', desc: 'Higher jumps and aerial dominance.', score: (h>=187?52:4) + gpg*15 + jit(23) },
    { slug: 'relentless', name: 'Relentless', desc: 'Reduces fatigue loss and boosts stamina recovery.', score: (g>=25?28:14) + (tpg+apg)*14 + jit(24) }
  ].sort((a, b) => b.score - a.score);

  return { archetype, psPlus: pool[0], activePlaystyles: [pool[1], pool[2]] };
}

function getChaosEmoji(myG, oppG, oppSR) {
  const tot = myG + oppG;
  if (Number(oppSR || 0) >= 1900) return { emoji: '🔥', label: 'SWEATFEST (1900+ SR)' };
  if (tot >= 8) return { emoji: '🏀', label: 'BASKETBALL MATCH (8+ Goals)' };
  if (myG < oppG && oppG >= 3) return { emoji: '🚨', label: 'DEFENSIVE DISASTERCLASS' };
  if (myG > oppG && tot <= 3) return { emoji: '🧱', label: 'HARAMBALL WIN (Gritty Defense)' };
  if (myG >= 4 && myG > oppG) return { emoji: '💥', label: 'GOAL CARNIVAL (4+ Scored)' };
  return myG === oppG ? { emoji: '🤝', label: 'POINTS SHARED' } : { emoji: '⚽', label: 'COMPETITIVE FIXTURE' };
}

function getPlayerRadarMetrics(p) {
  const ovr = Number(p.proOverall || 85), games = Math.max(1, Number(p.gamesPlayed || 1)), g = Number(p.goals || 0), a = Number(p.assists || 0), t = Number(p.tacklesmade || p.tackles || 0), passPct = Number(p.passSuccessRate || 78), rat = parseFloat(p.ratingAve || 7.2), motm = Number(p.manOfTheMatch || 0);
  const pac = Math.min(99, Math.max(60, Math.round(ovr + 3))), sho = Math.min(99, Math.max(55, Math.round(ovr - 4 + (g / games) * 14))), pas = Math.min(99, Math.max(58, Math.round(passPct + 6))), dri = Math.min(99, Math.max(62, Math.round(ovr + (rat - 7.0) * 5))), def = Math.min(99, Math.max(28, Math.round((p._normalizedPos === 'DEF' ? 82 : 42) + (t / games) * 15))), phy = Math.min(99, Math.max(58, Math.round(ovr - 3 + (t / games) * 6)));
  const gpg = g / games, apg = a / games, tpg = t / games, mPct = Math.round((motm / games) * 100);
  return {
    attributes: [{ label:'PAC', val:pac, raw:pac }, { label:'SHO', val:sho, raw:sho }, { label:'PAS', val:pas, raw:pas }, { label:'DRI', val:dri, raw:dri }, { label:'DEF', val:def, raw:def }, { label:'PHY', val:phy, raw:phy }],
    stats: [{ label:'G/G', val:Math.min(100,Math.round(gpg*95)), raw:gpg.toFixed(2) }, { label:'A/G', val:Math.min(100,Math.round(apg*110)), raw:apg.toFixed(2) }, { label:'RAT', val:Math.min(100,Math.round(rat*10)), raw:rat.toFixed(1) }, { label:'PAS%', val:Math.min(100,Math.round(passPct)), raw:`${passPct}%` }, { label:'TKL/G', val:Math.min(100,Math.round(tpg*38)), raw:tpg.toFixed(1) }, { label:'MoTM%', val:Math.min(100,Math.round(mPct*2.2)), raw:`${mPct}%` }]
  };
}

function buildRadarSvg(ax1, ax2) {
  const cx = 140, cy = 140, maxR = 94;
  const pt = (i, v) => { const a = (Math.PI * 2 * i) / 6 - Math.PI / 2, r = (Math.max(8, Math.min(100, v)) / 100) * maxR; return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`; };
  const grids = [0.25, 0.5, 0.75, 1].map(l => `<polygon points="${[0,1,2,3,4,5].map(i=>pt(i,l*100)).join(' ')}" fill="none" stroke="#475569" stroke-width="1" stroke-dasharray="${l<1?'3 3':''}"/>`).join('');
  const axes = [0,1,2,3,4,5].map(i => { const e = pt(i,100).split(','), lb = pt(i,120).split(','); return `<line x1="${cx}" y1="${cy}" x2="${e[0]}" y2="${e[1]}" stroke="#475569"/><text x="${lb[0]}" y="${Number(lb[1])+4}" text-anchor="middle" fill="#94a3b8" font-size="11" font-weight="800">${ax1[i].label}</text>`; }).join('');
  return `<svg viewBox="0 0 280 280" class="w-full h-full overflow-visible">${grids}${axes}<polygon points="${ax2.map((a,i)=>pt(i,a.val)).join(' ')}" fill="rgba(56,189,248,0.22)" stroke="#38bdf8" stroke-width="2.5"/><polygon points="${ax1.map((a,i)=>pt(i,a.val)).join(' ')}" fill="rgba(16,185,129,0.28)" stroke="#10b981" stroke-width="2.5"/></svg>`;
}

function computeMatchIntelligence(clubId, matchesPayload) {
  RECENT_FORM_MAP = {}; RECENT_10_STATS_MAP = {}; MATCH_PLAYER_META = {};
  TOP_FIDGET_SPINNER_NAME = null; TOP_MEAT_WALL_NAME = null;
  const ratingBuckets = {}, duoContributions = {}, opponentCounts = {}, shameMap = {}, sessionMatches = [];
  let highestSrOpp = null, prevTs = null;
  const matchArr = Array.isArray(matchesPayload) ? matchesPayload : (matchesPayload?.matches || []);

  matchArr.slice(0, 10).forEach((m, idx) => {
    const ts = Number(m.timestamp || 0);
    if (idx === 0 || (prevTs && ts > 0 && Math.abs(prevTs - ts) <= 4 * 3600)) { sessionMatches.push(m); prevTs = ts; }
    const clubs = m.clubs || m.aggregate || {}, cIds = Object.keys(clubs);
    const thisId = cIds.find(id => String(id) === String(clubId)) || cIds[0], oppId = cIds.find(id => String(id) !== String(clubId)) || cIds[1];
    const myClub = clubs[thisId] || {}, oppClub = clubs[oppId] || {}, oppName = oppClub.details?.name || oppClub.name || 'Opponent FC', oppSR = Number(oppClub.skillRating || oppClub.details?.skillRating || 0);
    const myG = Number(myClub.goals ?? myClub.score ?? 0), oppG = Number(oppClub.goals ?? oppClub.score ?? 0), isWin = myG > oppG, isLoss = myG < oppG;

    if (!opponentCounts[oppName]) opponentCounts[oppName] = { clubId: oppId, name: oppName, played: 0, wins: 0, losses: 0, draws: 0, sr: oppSR, crestId: oppClub.crestId || oppClub.TEAM || oppClub.details?.crestAssetId };
    opponentCounts[oppName].played++; if (isWin) opponentCounts[oppName].wins++; else if (isLoss) opponentCounts[oppName].losses++; else opponentCounts[oppName].draws++;
    if (!highestSrOpp || oppSR > highestSrOpp.sr) highestSrOpp = opponentCounts[oppName];

    const lobbyPlayers = Object.values(m.players?.[thisId] || {});
    const activeContributors = [], maxSecs = lobbyPlayers.reduce((mx, lp) => Math.max(mx, Number(lp.secondsPlayed || 0)), 0);

    lobbyPlayers.forEach(p => {
      const pName = p.playername || p.name || 'Pro';
      const pKey = String(pName).toLowerCase().trim();
      if (!MATCH_PLAYER_META[pKey]) {
        MATCH_PLAYER_META[pKey] = {
          name: pName,
          proName: p.vproname || p.proName || null,
          proNationality: p.proNationality || p.nationality || p.nation || extractNationFromVproAttr(p.vproattr) || null,
          vproattr: p.vproattr || null
        };
      }

      const r = parseFloat(p.rating || 0), g = Number(p.goals || 0), a = Number(p.assists || 0);
      const t = Number(p.tacklesmade || p.tackles || 0), tAtt = Number(p.tackleattempts || Math.max(t, t * 2)), shots = Number(p.shots || 0);
      const pMade = Number(p.passesmade || 0), pAtt = Number(p.passattempts || pMade), missedP = Math.max(0, pAtt - pMade);
      const ev = parsePlayerMatchEvents(p), reds = ev.redCards, yellows = ev.yellowCards;
      const isSub = maxSecs > 600 && Number(p.secondsPlayed || maxSecs) <= maxSecs * 0.78 && reds === 0;

      if (idx < 5 && r > 0) { if (!ratingBuckets[pName]) ratingBuckets[pName] = []; ratingBuckets[pName].push(r); }
      if (!RECENT_10_STATS_MAP[pName]) RECENT_10_STATS_MAP[pName] = { games:0, goals:0, assists:0, shots:0, tackles:0, totalRating:0, skillMoves:0, blocks:0, interceptions:0, woodwork:0, yellows:0, reds:0, superSubGA:0, subGames:0, recentCleanSheets:0 };
      const r10 = RECENT_10_STATS_MAP[pName];
      r10.games++; r10.goals += g; r10.assists += a; r10.shots += shots; r10.tackles += t; r10.totalRating += r; r10.skillMoves += ev.skillMoves; r10.blocks += ev.blocks; r10.interceptions += ev.interceptions; r10.woodwork += ev.woodwork; r10.yellows += yellows; r10.reds += reds;
      if (isSub) r10.subGames++; if (isSub && (g + a > 0)) r10.superSubGA += (g + a); if (oppG === 0) r10.recentCleanSheets++;

      if (!shameMap[pName]) shameMap[pName] = { name: pName, games:0, missedPasses:0, skillMoves:0, dribblesCompleted:0, blocks:0, interceptions:0, woodwork:0, shots:0, goals:0, assists:0, yellows:0, reds:0, tackles:0, tackleAtt:0, superSubGA:0, subGames:0, cleanSheets:0 };
      const sm = shameMap[pName];
      sm.games++; sm.missedPasses += missedP; sm.skillMoves += ev.skillMoves; sm.dribblesCompleted += ev.dribblesCompleted; sm.blocks += ev.blocks; sm.interceptions += ev.interceptions; sm.woodwork += ev.woodwork; sm.shots += shots; sm.goals += g; sm.assists += a; sm.yellows += yellows; sm.reds += reds; sm.tackles += t; sm.tackleAtt += tAtt;
      if (isSub) sm.subGames++; if (isSub && (g + a > 0)) sm.superSubGA += (g + a); if (oppG === 0) sm.cleanSheets++;
      if (g + a > 0) activeContributors.push({ name: pName, ga: g + a });
    });

    for (let i = 0; i < activeContributors.length; i++) {
      for (let j = i + 1; j < activeContributors.length; j++) {
        const pair = [activeContributors[i].name, activeContributors[j].name].sort(), k = pair.join('|||');
        if (!duoContributions[k]) duoContributions[k] = { p1: pair[0], p2: pair[1], combinedGA: 0, gamesTogether: 0 };
        duoContributions[k].combinedGA += activeContributors[i].ga + activeContributors[j].ga; duoContributions[k].gamesTogether++;
      }
    }
  });

  Object.keys(ratingBuckets).forEach(n => RECENT_FORM_MAP[n] = ratingBuckets[n].reduce((a, b) => a + b, 0) / ratingBuckets[n].length);
  SESSION_MATCHES_CACHE = sessionMatches;
  SHAME_LIST_CACHE = Object.values(shameMap);
  const topSkiller = [...SHAME_LIST_CACHE].sort((a, b) => b.skillMoves - a.skillMoves)[0];
  if (topSkiller?.skillMoves > 0) TOP_FIDGET_SPINNER_NAME = topSkiller.name;
  const topBlocker = [...SHAME_LIST_CACHE].sort((a, b) => b.blocks - a.blocks)[0];
  if (topBlocker?.blocks > 0) TOP_MEAT_WALL_NAME = topBlocker.name;

  updateRecapMetricsDisplay(clubId, CURRENT_RECAP_MODE === 'session' ? sessionMatches : matchArr.slice(0, 10), CURRENT_RECAP_MODE);
  renderShameBoard(SHAME_LIST_CACHE);

  if (matchArr.length) {
    document.getElementById('intelSection').classList.remove('hidden');
    const topDuo = Object.values(duoContributions).sort((a, b) => b.combinedGA - a.combinedGA)[0];
    if (topDuo) {
      document.getElementById('duoNames').innerText = `${topDuo.p1} & ${topDuo.p2}`;
      document.getElementById('duoMeta').innerText = `${topDuo.combinedGA} combined G+A across ${topDuo.gamesTogether} shared goalscoring games`;
      document.getElementById('duoAvatars').innerHTML = `${renderAvatarWithFlagHtml(topDuo.p1, 'w-10 h-10', 'border-emerald-400', 'w-3.5 h-2.5')}${renderAvatarWithFlagHtml(topDuo.p2, 'w-10 h-10', 'border-emerald-400', 'w-3.5 h-2.5')}`;
    }
    const repeat = Object.values(opponentCounts).filter(o => o.played > 1).sort((a, b) => b.played - a.played);
    const tOpp = repeat[0] || highestSrOpp;
    if (tOpp) {
      document.getElementById('nemesisTitle').innerHTML = repeat.length ? `<i class="fa-solid fa-fire text-amber-400"></i> Repeat Rival (${tOpp.played}x)` : `<i class="fa-solid fa-skull text-rose-400"></i> Toughest Recent Opponent`;
      document.getElementById('nemesisName').innerText = tOpp.name; document.getElementById('nemesisMeta').innerText = `Record: ${tOpp.wins}W-${tOpp.draws}D-${tOpp.losses}L • SR: ${tOpp.sr||'--'}`;
      document.getElementById('nemesisCrest').innerHTML = renderCrestHtml(tOpp.name, tOpp.crestId, 'w-11 h-11', tOpp.clubId);
    }
  }
  return SHAME_LIST_CACHE;
}
