const API_BASE = '/api';
let GLOBAL_MEMBERS = [], GLOBAL_MATCHES = [], GLOBAL_COMBINED_DATA = {}, GLOBAL_CLUB_ID = null;
let RECENT_FORM_MAP = {}, RECENT_10_STATS_MAP = {}, SESSION_MATCHES_CACHE = [], SHAME_LIST_CACHE = [];
let TOP_FIDGET_SPINNER_NAME = null, CURRENT_CLUB_CREST_URL = '', ACTIVE_MODAL_PLAYER = null;
let CURRENT_PITCH_MODE = 'lastMatch', CURRENT_RECAP_MODE = 'session', CURRENT_BANTER_MODE = 'last10', ACTIVE_TAB = 'team';

const SKIN_HEX = ['f2d3b1', 'ecad80', 'd08b5b', '9e5622', '763900'];
const HAIR_HEX = ['0e0e0e', '562306', '6a4e35', 'e5d05c', 'cb6820', 'afafaf'];
const EA_NATION_TO_ISO = { '14':'gb-eng','25':'ie','42':'gb-sct','50':'gb-wls','35':'gb-nir','18':'fr','21':'de','45':'es','27':'it','34':'nl','38':'pt','7':'be','54':'br','52':'ar','95':'us','70':'ca','195':'au','133':'ng','13':'dk','46':'se','36':'no','37':'pl','10':'hr','47':'ch','4':'at' };

const EA_PRO_POS_MAP = {
  '0': 'GK', '2': 'RWB', '3': 'RB', '4': 'RCB', '5': 'CB', '6': 'LCB', '7': 'LB', '8': 'LWB',
  '9': 'RDM', '10': 'CDM', '11': 'LDM', '12': 'RM', '13': 'RCM', '14': 'CM', '15': 'LCM', '16': 'LM',
  '17': 'RAM', '18': 'CAM', '19': 'LAM', '20': 'RF', '21': 'CF', '22': 'LF', '23': 'RW',
  '24': 'RS', '25': 'ST', '26': 'LS', '27': 'LW'
};

const FORMATION_TEMPLATES = {
  '4-1-2-1-2': { name: '4-1-2-1-2 (4-2-1-2)', atk: ['LS','RS'], cam: ['CAM'], mid: ['LCDM','RCDM'], def: ['LB','LCB','RCB','RB'], gk: ['GK'] },
  '4-2-3-1 Narrow': { name: '4-2-3-1 Narrow', atk: ['ST'], cam: ['LAM','CAM','RAM'], mid: ['LCDM','RCDM'], def: ['LB','LCB','RCB','RB'], gk: ['GK'] },
  '4-3-3 Attack': { name: '4-3-3 Attack', atk: ['LW','ST','RW'], cam: ['CAM'], mid: ['LCM','RCM'], def: ['LB','LCB','RCB','RB'], gk: ['GK'] },
  '4-3-3 Holding': { name: '4-3-3 Holding', atk: ['LW','ST','RW'], cam: ['LCM','RCM'], mid: ['CDM'], def: ['LB','LCB','RCB','RB'], gk: ['GK'] },
  '4-4-2 Flat': { name: '4-4-2 Flat', atk: ['LS','RS'], cam: [], mid: ['LM','LCM','RCM','RM'], def: ['LB','LCB','RCB','RB'], gk: ['GK'] },
  '3-5-2': { name: '3-5-2', atk: ['LS','RS'], cam: ['CAM'], mid: ['LM','LCDM','RCDM','RM'], def: ['LCB','CB','RCB'], gk: ['GK'] },
  '5-3-2': { name: '5-3-2', atk: ['LS','RS'], cam: ['CAM'], mid: ['LCM','RCM'], def: ['LWB','LCB','CB','RCB','RWB'], gk: ['GK'] }
};

function switchDashboardTab(tabKey) {
  ACTIVE_TAB = tabKey;
  const tabs = [
    { key: 'team', border: 'border-emerald-500 bg-emerald-500/10 shadow-lg' },
    { key: 'players', border: 'border-sky-500 bg-sky-500/10 shadow-lg' },
    { key: 'pitch', border: 'border-amber-500 bg-amber-500/10 shadow-lg' }
  ];

  tabs.forEach(t => {
    const pane = document.getElementById(`tabPane_${t.key}`); const btn = document.getElementById(`tabBtn_${t.key}`);
    if (t.key === tabKey) {
      pane.classList.remove('hidden');
      btn.className = `card p-3 sm:p-4 flex items-center justify-center gap-2.5 sm:gap-3.5 border-2 ${t.border} transition group cursor-pointer`;
    } else {
      pane.classList.add('hidden');
      btn.className = `card p-3 sm:p-4 flex items-center justify-center gap-2.5 sm:gap-3.5 border border-gray-800 hover:border-gray-700 transition group cursor-pointer opacity-75 hover:opacity-100`;
    }
  });
}

const BALL_SVG = (cx, cy, r) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="currentColor" stroke-width="2.8"/><polygon points="${cx},${cy-r*0.45}${cx+r*0.42},${cy-r*0.12}${cx+r*0.26},${cy+r*0.38}${cx-r*0.26},${cy+r*0.38}${cx-r*0.42},${cy-r*0.12}" fill="currentColor"/>`;  const OFFICIAL_EA_PLAYSTYLE_VECTORS = { cross_claimer: `${BALL_SVG(62,32,10.5)}<path d="M 24 68 L 42 46 L 52 54 L 34 74 Z" fill="currentColor"/><path d="M 40 44 C 38 36 44 30 50 34 L 56 42 C 58 46 54 52 48 50 Z" fill="currentColor"/>`,
  deflector: `<path d="M 44 18 L 68 27 L 68 48 C 68 64 44 76 44 76 C 44 76 20 64 20 48 L 20 27 Z" fill="none" stroke="currentColor" stroke-width="4.5" stroke-linejoin="round"/><path d="M 44 38 L 76 26 M 44 38 L 74 54" stroke="currentColor" stroke-width="4" stroke-linecap="round"/><polygon points="72,20 82,24 75,33" fill="currentColor"/><polygon points="71,48 80,57 69,59" fill="currentColor"/>`,
  far_reach: `${BALL_SVG(36,30,10)}<path d="M 30 48 C 32 42 40 40 46 44 L 66 56 L 58 72 L 36 58 Z" fill="currentColor"/><path d="M 24 38 Q 22 24 34 20" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>`,
  footwork: `<path d="M 22 22 L 38 22 L 46 52 L 62 56 C 66 57 68 62 64 66 L 34 66 L 26 42 Z" fill="currentColor"/>${BALL_SVG(62,42,10.5)}`, finesse_shot: `${BALL_SVG(64,32,10.5)}<path d="M 24 68 C 22 40 40 28 54 30" fill="none" stroke="currentColor" stroke-width="4.5" stroke-linecap="round"/><polygon points="50,23 61,30 50,37" fill="currentColor"/><path d="M 34 74 C 34 52 46 44 60 44" fill="none" stroke="currentColor" stroke-width="3" stroke-dasharray="4 4" stroke-linecap="round"/>`,
  power_shot: `${BALL_SVG(64,34,11)}<path d="M 18 70 L 50 44 M 18 54 L 42 34 M 34 74 L 58 54" stroke="currentColor" stroke-width="4.5" stroke-linecap="round"/>`,
  chip_shot: `${BALL_SVG(68,42,9.5)}<path d="M 20 66 Q 42 12 64 34" fill="none" stroke="currentColor" stroke-width="4.2" stroke-linecap="round"/><line x1="18" y1="68" x2="78" y2="68" stroke="currentColor" stroke-width="2.5" stroke-dasharray="4 4"/>`,
  dead_ball: `${BALL_SVG(42,54,10.5)}<path d="M 52 46 Q 68 26 78 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"/><polygon points="72,18 83,22 76,31" fill="currentColor"/><line x1="24" y1="66" x2="60" y2="66" stroke="currentColor" stroke-width="3.5"/>`,
  incisive_pass: `<circle cx="28" cy="42" r="6.5" fill="currentColor"/><circle cx="28" cy="66" r="6.5" fill="currentColor"/><path d="M 38 64 L 70 32" stroke="currentColor" stroke-width="4.5" stroke-linecap="round"/><polygon points="62,26 76,26 76,40" fill="currentColor"/><line x1="38" y1="42" x2="62" y2="42" stroke="currentColor" stroke-width="3.2" stroke-dasharray="4 4" stroke-linecap="round"/>`,
  tiki_taka: `<polygon points="50,22 74,64 26,64" fill="none" stroke="currentColor" stroke-width="3.8" stroke-dasharray="5 3" stroke-linejoin="round"/><circle cx="50" cy="22" r="7" fill="currentColor"/><circle cx="74" cy="64" r="7" fill="currentColor"/><circle cx="26" cy="64" r
