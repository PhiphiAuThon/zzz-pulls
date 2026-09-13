/**
 * ZZZ 50/50 TRACKER (rng.moe style)
 * Logic for parsing, statistics computation, rendering, and filtering.
 * Each S-Rank has its own full square (37 items):
 * - Red [L] for 50/50 Lost (standard characters)
 * - Blue [G] for Guaranteed (limited characters)
 * - Yellow [W] for 50/50 Won (limited characters)
 */

/* ==========================================================================
 * ATTENTION / REGLE D'OR ABSOLUE :
 * NE JAMAIS HARDCODER DE DICTIONNAIRE OU LISTE D'AGENTS / DE MOTEURS ICI !
 * (Pas de PORTRAIT_MAP, ENGINE_MAP, ENGINE_TO_CHAR, ENGINE_ALIASES, etc.)
 *
 * Raison :
 * L'utilisateur met à jour ses bases de données CSV directement ("ZZZ - Character History.csv",
 * "ZZZ - Engine History.csv", "ZZZ - Rescreen History.csv") et ajoute des images dans
 * "characters/" et "engines/". Il ne doit JAMAIS avoir à éditer du code JS lors
 * de l'ajout de nouveaux personnages ou de nouveaux moteurs W.
 *
 * Toute la résolution d'URL d'images et de détection de type doit rester 100% DYNAMIQUE :
 * - Convention personnages : characters/<slug>.webp (minuscule, espaces/tirets -> underscores)
 * - Convention moteurs W   : engines/W-Engine_<Slug_Avec_Casse>.webp
 * - Gestion d'erreur (handleImgError) : bascule dynamique et automatique entre characters/ et engines/
 *   en cas de 404, puis fallback SVG dynamique avec initiales si le fichier est introuvable.
 * ========================================================================== */

// Clean helper to extract base name from legacy strings (e.g. "Yixuan WE" -> "Yixuan")
function getCleanAgentName(name) {
  if (!name) return '';
  return name.trim().replace(/[\s\-_]+we$/i, '').replace(/\(we\)$/i, '').trim();
}

// Detect if a string looks like an engine / W-Engine name
function isEngineName(name) {
  if (!name) return false;
  const raw = String(name).trim();
  return (/\bwe\b/i).test(raw) ||
         (/\(we\)$/i).test(raw) ||
         (/^w[-_ ]?engine/i).test(raw) ||
         (/\bmoteur\b/i).test(raw);
}

// Check if a pull item is an engine pull
function isEnginePull(pull) {
  if (!pull) return false;
  return Boolean(
    pull.isEngine ||
    pull.type === 'engine' ||
    isEngineName(pull.agent) ||
    (pull.targetAgent && isEngineName(pull.targetAgent))
  );
}

// Dynamic slug generator for characters:
// e.g. "Zhu Yuan" -> "zhu_yuan", "Soldier 11" -> "soldier_11", "Ellen" -> "ellen"
function formatCharSlug(name) {
  if (!name) return '';
  const clean = getCleanAgentName(name);
  return clean
    .toLowerCase()
    .replace(/[\s\-]+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}

// Dynamic slug generator for W-Engines:
// e.g. "Qingming Birdcage" -> "Qingming_Birdcage", "W-Engine: Cordis Germina" -> "Cordis_Germina"
function formatEngineSlug(name) {
  if (!name) return '';
  const clean = name.trim()
    .replace(/^(w[-_ ]?engine|moteur[-_ ]?w)\s*[:\-_]?\s*/i, '')
    .replace(/[\s\-_]+we$/i, '')
    .replace(/\(we\)$/i, '')
    .trim();
  return clean.replace(/[\s]+/g, '_');
}

// S-Rank initials SVG fallback generator (no external asset needed)
function getSvgFallback(name, isEngine = false) {
  const clean = getCleanAgentName(name);
  const label = clean ? clean.slice(0, 3).toUpperCase() : (name ? name.trim().slice(0, 3).toUpperCase() : '?');
  const bgColor = isEngine ? '%231a202c' : '%23252a3a';
  const textColor = isEngine ? '%2338bdf8' : '%23f8e119';
  return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect fill="${bgColor}" width="100" height="100"/><text fill="${textColor}" font-size="14" font-weight="bold" x="50%" y="50%" text-anchor="middle" dominant-baseline="middle">${encodeURIComponent(label)}</text></svg>`;
}

// Dynamic portrait URL resolver: pure dynamic path formatting without any hardcoded dictionary
function getPortraitUrl(name, isEngine = false) {
  if (!name) return getSvgFallback('', isEngine);
  const raw = name.trim();
  const treatAsEngine = Boolean(isEngine || isEngineName(raw));

  if (treatAsEngine) {
    const slug = formatEngineSlug(raw);
    return `engines/W-Engine_${slug}.webp`;
  }
  const slug = formatCharSlug(raw);
  return `characters/${slug}.webp`;
}

// Dynamic image error handler: tries the opposite folder (characters <-> engines)
// then normalized accents, before falling back to SVG initials. Self-healing and 100% dynamic.
window.handleImgError = function(img, name, isEngine = false) {
  const step = parseInt(img.dataset.errorStep) || 0;
  img.dataset.errorStep = step + 1;

  if (step === 0) {
    // 1st retry: try opposite folder in case type was inverted or not yet tagged
    if (isEngine) {
      img.src = `characters/${formatCharSlug(name)}.webp`;
      return;
    } else {
      img.src = `engines/W-Engine_${formatEngineSlug(name)}.webp`;
      return;
    }
  }

  if (step === 1) {
    // 2nd retry: try stripped accents (e.g. Joyau Doré -> Joyau Dore)
    const normalized = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (normalized !== name) {
      if (isEngine) {
        img.src = `engines/W-Engine_${formatEngineSlug(normalized)}.webp`;
      } else {
        img.src = `characters/${formatCharSlug(normalized)}.webp`;
      }
      return;
    }
  }

  // Final fallback: dynamic SVG initials (guaranteed display)
  img.onerror = null;
  img.src = getSvgFallback(name, isEngine);
};

function safeName(str) {
  if (!str) return '';
  return String(str).replace(/'/g, "\\'").replace(/"/g, '&quot;');
}
const INITIAL_CHAR_PULLS = [
  { id: 1, patch: '1.0', agent: 'Ellen', agentRaw: 'Ellen', bannerFrom: null, cost: 10, isLoss: true, lostAgent: 'Koleda', lostPity: 80, total: 90, type: 'character' },
  { id: 2, patch: '1.0', agent: 'Zhu Yuan', agentRaw: 'Zhu Yuan', bannerFrom: null, cost: 70, isLoss: false, lostAgent: null, lostPity: 0, total: 70, type: 'character' },
  { id: 3, patch: '1.1', agent: 'Jane', agentRaw: 'Jane', bannerFrom: null, cost: 80, isLoss: true, lostAgent: 'Grace', lostPity: 80, total: 160, type: 'character' },
  { id: 4, patch: '1.2', agent: 'Burnice', agentRaw: 'Burnice', bannerFrom: null, cost: 73, isLoss: true, lostAgent: 'Soldier 11', lostPity: 80, total: 153, type: 'character' },
  { id: 5, patch: '1.3 / 1.4', agent: 'Miyabi', agentRaw: 'Lighter -> Miyabi', bannerFrom: 'Lighter', cost: 75, isLoss: true, lostAgent: 'Nekomata', lostPity: 20, total: 95, type: 'character' },
  { id: 6, patch: '1.5', agent: 'Astra', agentRaw: 'Astra', bannerFrom: null, cost: 80, isLoss: true, lostAgent: 'Lycaon', lostPity: 30, total: 110, type: 'character' },
  { id: 7, patch: '1.5', agent: 'Evelyn', agentRaw: 'Evelyn', bannerFrom: null, cost: 75, isLoss: false, lostAgent: null, lostPity: 0, total: 75, type: 'character' },
  { id: 8, patch: '1.6', agent: 'SAnby', agentRaw: 'SAnby', bannerFrom: null, cost: 90, isLoss: true, lostAgent: 'Grace', lostPity: 75, total: 165, type: 'character' },
  { id: 9, patch: '1.6', agent: 'Trigger', agentRaw: 'Trigger', bannerFrom: null, cost: 65, isLoss: false, lostAgent: null, lostPity: 0, total: 65, type: 'character' },
  { id: 10, patch: '1.7', agent: 'Vivian', agentRaw: 'Vivian', bannerFrom: null, cost: 80, isLoss: false, lostAgent: null, lostPity: 0, total: 80, type: 'character' },
  { id: 11, patch: '2.0', agent: 'Yixuan', agentRaw: 'Yixuan', bannerFrom: null, cost: 60, isLoss: false, lostAgent: null, lostPity: 0, total: 60, type: 'character' },
  { id: 12, patch: '2.0', agent: 'Yixuan', agentRaw: 'Yixuan', bannerFrom: null, cost: 30, isLoss: false, lostAgent: null, lostPity: 0, total: 30, type: 'character' },
  { id: 13, patch: '2.0', agent: 'Jufufu', agentRaw: 'Jufufu', bannerFrom: null, cost: 80, isLoss: true, lostAgent: 'Grace', lostPity: 40, total: 120, type: 'character' },
  { id: 14, patch: '2.0', agent: 'Caesar', agentRaw: 'Caesar', bannerFrom: null, cost: 71, isLoss: false, lostAgent: null, lostPity: 0, total: 71, type: 'character' },
  { id: 15, patch: '2.2', agent: 'Seed', agentRaw: 'Seed', bannerFrom: null, cost: 80, isLoss: false, lostAgent: null, lostPity: 0, total: 80, type: 'character' },
  { id: 16, patch: '2.2', agent: 'Orphie', agentRaw: 'Orphie', bannerFrom: null, cost: 60, isLoss: false, lostAgent: null, lostPity: 0, total: 60, type: 'character' },
  { id: 17, patch: '2.3', agent: 'Lucia', agentRaw: 'Lucia', bannerFrom: null, cost: 20, isLoss: false, lostAgent: null, lostPity: 0, total: 20, type: 'character' },
  { id: 18, patch: '2.3 / 2.4', agent: 'Dialyn', agentRaw: 'Yidhari -> Dialyn', bannerFrom: 'Yidhari', cost: 70, isLoss: true, lostAgent: 'Lycaon', lostPity: 80, total: 150, type: 'character' },
  { id: 19, patch: '2.4 / 2.5', agent: 'YSG', agentRaw: 'Banyue -> YSG', bannerFrom: 'Banyue', cost: 70, isLoss: true, lostAgent: 'Grace', lostPity: 80, total: 150, type: 'character' },
  { id: 20, patch: '2.6', agent: 'Yixuan', agentRaw: 'Yixuan', bannerFrom: null, cost: 10, isLoss: false, lostAgent: null, lostPity: 0, total: 10, type: 'character' },
  { id: 21, patch: '2.6', agent: 'Yuzuha', agentRaw: 'Yuzuha', bannerFrom: null, cost: 80, isLoss: true, lostAgent: 'Soldier 11', lostPity: 80, total: 160, type: 'character' },
  { id: 22, patch: '2.8', agent: 'Promeia', agentRaw: 'Promeia', bannerFrom: null, cost: 80, isLoss: false, lostAgent: null, lostPity: 0, total: 80, type: 'character' },
  { id: 23, patch: '3.0', agent: 'Velina', agentRaw: 'Velina', bannerFrom: null, cost: 80, isLoss: false, lostAgent: null, lostPity: 0, total: 80, type: 'character' },
  { id: 24, patch: '3.1', agent: 'Remielle', agentRaw: 'Remielle', bannerFrom: null, cost: 10, isLoss: false, lostAgent: null, lostPity: 0, total: 10, type: 'character' },
  { id: 25, patch: '3.1', agent: 'Remielle', agentRaw: 'Remielle', bannerFrom: null, cost: 50, isLoss: false, lostAgent: null, lostPity: 0, total: 50, type: 'character' },
  { id: 26, patch: '3.1', agent: 'Remielle', agentRaw: 'Remielle', bannerFrom: null, cost: 70, isLoss: false, lostAgent: null, lostPity: 0, total: 70, type: 'character' },
  { id: 27, patch: '3.1', agent: 'Sigrid', agentRaw: 'Sigrid', bannerFrom: null, cost: 30, isLoss: false, lostAgent: null, lostPity: 0, total: 30, type: 'character' }
];

// Initial W-Engine dataset parsed from "ZZZ - Engine History.csv"
const INITIAL_ENGINE_PULLS = [
  { id: 1, patch: '2.6', agent: 'Qingming Birdcage', agentRaw: 'Qingming Birdcage', bannerFrom: null, cost: 40, isLoss: false, lostAgent: null, lostPity: 0, total: 40, type: 'engine', isEngine: true },
  { id: 2, patch: '2.7', agent: 'Cordis Germina', agentRaw: 'Cordis Germina', bannerFrom: null, cost: 50, isLoss: false, lostAgent: null, lostPity: 0, total: 50, type: 'engine', isEngine: true },
  { id: 3, patch: '3.1', agent: 'Ode of Resurrected Wings', agentRaw: 'Ode of Resurrected Wings', bannerFrom: null, cost: 50, isLoss: true, lostAgent: 'Tusks of Fury', lostPity: 50, total: 100, type: 'engine', isEngine: true }
];

// Initial Rescreen dataset parsed from "ZZZ - Rescreen History.csv"
// Rules: In each patch where a Rescreen banner appears, the 1st character and the 1st W-Engine are guaranteed.
const INITIAL_RESCREEN_PULLS = [
  { id: 1, patch: '2.5', agent: 'Alice', agentRaw: 'Alice', bannerFrom: null, cost: 78, isLoss: false, lostAgent: null, lostPity: 0, total: 78, type: 'rescreen', isEngine: false, isGuaranteedFirst: true },
  { id: 2, patch: '3.1', agent: 'Yuzuha', agentRaw: 'Yuzuha', bannerFrom: null, cost: 8, isLoss: false, lostAgent: null, lostPity: 0, total: 8, type: 'rescreen', isEngine: false, isGuaranteedFirst: true },
  { id: 3, patch: '3.1', agent: 'Metanukimorphosis', agentRaw: 'Metanukimorphosis', bannerFrom: null, cost: 68, isLoss: false, lostAgent: null, lostPity: 0, total: 68, type: 'rescreen', isEngine: true, isGuaranteedFirst: true }
];

// App state
let charPulls = [...INITIAL_CHAR_PULLS];
let enginePulls = [...INITIAL_ENGINE_PULLS];
let rescreenPulls = [...INITIAL_RESCREEN_PULLS];
let currentCategory = 'character'; // 'character', 'engine', 'rescreen', 'all'
let currentFilter = 'all'; // 'all', 'win', 'loss', 'guaranteed'
let currentSearch = '';
let currentSort = 'newest'; // 'newest', 'oldest', 'pity-high', 'pity-low'
let currentView = 'matrix'; // 'matrix' (default) or 'cards'

// Helpers
function getPityClass(pity) {
  if (pity < 30) return 'early';
  if (pity <= 73) return 'mid';
  if (pity <= 80) return 'high';
  return 'hard';
}

function getPatchNum(p) {
  if (!p) return 0;
  const first = p.split('/')[0].trim().replace(',', '.');
  const parts = first.split('.');
  const major = parseInt(parts[0]) || 0;
  const minor = parseInt(parts[1]) || 0;
  return major * 100 + minor;
}

function getCombinedPulls() {
  const combined = [...charPulls, ...enginePulls, ...rescreenPulls];
  const typeOrder = { 'character': 1, 'engine': 2, 'rescreen': 3 };
  combined.sort((a, b) => {
    const patchDiff = getPatchNum(a.patch) - getPatchNum(b.patch);
    if (patchDiff !== 0) return patchDiff;
    const typeDiff = (typeOrder[a.type] || 0) - (typeOrder[b.type] || 0);
    if (typeDiff !== 0) return typeDiff;
    return a.id - b.id;
  });
  return combined.map((p, index) => ({
    ...p,
    id: index + 1
  }));
}

function getActivePulls() {
  if (currentCategory === 'character') return charPulls;
  if (currentCategory === 'engine') return enginePulls;
  if (currentCategory === 'rescreen') return rescreenPulls;
  return getCombinedPulls();
}

// Build individual S-Rank pull items in exact chronological order
function buildAllSRankItems(pulls) {
  const items = [];
  pulls.forEach(p => {
    const isEngine = isEnginePull(p);
    if (p.isLoss) {
      // If patch contains a slash (e.g. "1.3 / 1.4"), the loss occurred in 1.3
      // and the player saved the guarantee to pull the limited character in 1.4.
      let lossPatch = p.patch;
      let guarPatch = p.patch;
      if (p.patch && p.patch.includes('/')) {
        const parts = p.patch.split('/').map(s => s.trim());
        lossPatch = parts[0] || p.patch;
        guarPatch = parts[1] || parts[0] || p.patch;
      }

      // 1) The standard character/engine pulled (50/50 LOST)
      items.push({
        id: items.length + 1,
        eventId: p.id,
        agent: p.lostAgent,
        pity: p.lostPity,
        status: 'LOST',
        patch: lossPatch,
        targetAgent: p.bannerFrom || p.agent,
        bannerFrom: p.bannerFrom,
        totalCycle: p.total,
        type: p.type || (isEngine ? 'engine' : 'character'),
        isEngine: isEngine,
        isRescreenFirst: false
      });
      // 2) The guaranteed limited character/engine pulled
      items.push({
        id: items.length + 1,
        eventId: p.id,
        agent: p.agent,
        pity: p.cost,
        status: 'GUARANTEED',
        patch: guarPatch,
        bannerFrom: p.bannerFrom,
        lostAgent: p.lostAgent,
        totalCycle: p.total,
        type: p.type || (isEngine ? 'engine' : 'character'),
        isEngine: isEngine,
        isRescreenFirst: false
      });
    } else if (p.isGuaranteedFirst) {
      // Rescreen rule: 1st character or 1st engine guaranteed in this version!
      items.push({
        id: items.length + 1,
        eventId: p.id,
        agent: p.agent,
        pity: p.cost,
        status: 'GUARANTEED',
        patch: p.patch,
        bannerFrom: p.bannerFrom,
        totalCycle: p.total,
        type: p.type || (isEngine ? 'engine' : 'rescreen'),
        isEngine: isEngine,
        isRescreenFirst: true
      });
    } else {
      // Won 50/50
      items.push({
        id: items.length + 1,
        eventId: p.id,
        agent: p.agent,
        pity: p.cost,
        status: 'WON',
        patch: p.patch,
        bannerFrom: p.bannerFrom,
        totalCycle: p.total,
        type: p.type || (isEngine ? 'engine' : 'character'),
        isEngine: isEngine,
        isRescreenFirst: false
      });
    }
  });
  return items;
}

function calculateStreaks(pulls) {
  // Direct guarantees (Rescreen 1st pulls) do not count towards 50/50 streaks
  const fiftyFiftyPulls = pulls.filter(p => !p.isGuaranteedFirst);
  const chrono = [...fiftyFiftyPulls].sort((a, b) => a.id - b.id);
  let currentStreak = 0;
  let isCurrentWin = true;
  let maxWinStreak = 0;
  let currentWinCounter = 0;

  for (const pull of chrono) {
    if (!pull.isLoss) {
      currentWinCounter++;
      if (currentWinCounter > maxWinStreak) maxWinStreak = currentWinCounter;
    } else {
      currentWinCounter = 0;
    }
  }

  if (chrono.length > 0) {
    const lastPull = chrono[chrono.length - 1];
    isCurrentWin = !lastPull.isLoss;
    for (let i = chrono.length - 1; i >= 0; i--) {
      if (!chrono[i].isLoss === isCurrentWin) {
        currentStreak++;
      } else {
        break;
      }
    }
  }

  return { currentStreak, isCurrentWin, maxWinStreak, hasFiftyFifty: chrono.length > 0 };
}

// Update Category Tabs Badges
function updateCategoryBadges() {
  const charItems = buildAllSRankItems(charPulls);
  const engineItems = buildAllSRankItems(enginePulls);
  const rescreenItems = buildAllSRankItems(rescreenPulls);
  const allItems = buildAllSRankItems(getCombinedPulls());

  const bChar = document.getElementById('badge-cat-character');
  const bEngine = document.getElementById('badge-cat-engine');
  const bRescreen = document.getElementById('badge-cat-rescreen');
  const bAll = document.getElementById('badge-cat-all');

  if (bChar) bChar.textContent = charItems.length;
  if (bEngine) bEngine.textContent = engineItems.length;
  if (bRescreen) bRescreen.textContent = rescreenItems.length;
  if (bAll) bAll.textContent = allItems.length;
}

// Update UI KPI Cards & Filters
function updateStats(pulls) {
  const allItems = buildAllSRankItems(pulls);
  const totalPulls = pulls.reduce((sum, p) => sum + p.total, 0);
  const wins = pulls.filter(p => !p.isLoss && !p.isGuaranteedFirst).length;
  const losses = pulls.filter(p => p.isLoss).length;
  const total5050 = wins + losses;
  const winRate = total5050 > 0 ? ((wins / total5050) * 100).toFixed(1) : null;
  const polychromes = totalPulls * 160;

  const totalSRanks = allItems.length;
  const avgPitySRank = totalSRanks > 0 ? (totalPulls / totalSRanks).toFixed(1) : 0;
  const avgPityLimited = pulls.length > 0 ? (totalPulls / pulls.length).toFixed(1) : 0;

  const { currentStreak, isCurrentWin, maxWinStreak, hasFiftyFifty } = calculateStreaks(pulls);

  const winrateEl = document.getElementById('stat-winrate');
  if (winrateEl) {
    winrateEl.textContent = total5050 > 0 ? `${winRate}%` : 'N/A';
  }
  document.getElementById('stat-win-count').textContent = wins;
  document.getElementById('stat-loss-count').textContent = losses;
  
  const barWin = document.getElementById('progress-win');
  const barLoss = document.getElementById('progress-loss');
  if (barWin && barLoss) {
    if (total5050 > 0) {
      barWin.style.width = `${winRate}%`;
      barLoss.style.width = `${100 - winRate}%`;
    } else {
      barWin.style.width = '0%';
      barLoss.style.width = '0%';
    }
  }

  const streakEl = document.getElementById('stat-streak');
  if (streakEl) {
    if (hasFiftyFifty) {
      streakEl.textContent = `${currentStreak} ${isCurrentWin ? 'Victoires' : 'Défaites'}`;
      document.getElementById('stat-streak-type').textContent = isCurrentWin ? '🔥 En cours' : '💀 En cours';
      document.getElementById('stat-max-streak').textContent = maxWinStreak;
    } else {
      streakEl.textContent = '—';
      document.getElementById('stat-streak-type').textContent = 'Aucun 50/50';
      document.getElementById('stat-max-streak').textContent = '0';
    }
  }

  document.getElementById('stat-total-pulls').textContent = totalPulls.toLocaleString();
  document.getElementById('stat-polychromes').textContent = polychromes.toLocaleString();

  document.getElementById('stat-total-sranks').textContent = totalSRanks;
  document.getElementById('stat-limited-sranks').textContent = pulls.length;
  document.getElementById('stat-standard-sranks').textContent = losses;

  document.getElementById('stat-avg-srank').textContent = avgPitySRank;
  document.getElementById('stat-avg-limited').textContent = avgPityLimited;

  // Render loss distribution
  renderLossDistribution(pulls);

  // Update filter counts
  const countWon = allItems.filter(i => i.status === 'WON').length;
  const countLost = allItems.filter(i => i.status === 'LOST').length;
  const countGuaranteed = allItems.filter(i => i.status === 'GUARANTEED').length;

  document.getElementById('count-all').textContent = totalSRanks;
  document.getElementById('count-won').textContent = countWon;
  document.getElementById('count-lost').textContent = countLost;
  const countGuaranteedEl = document.getElementById('count-guaranteed');
  if (countGuaranteedEl) countGuaranteedEl.textContent = countGuaranteed;

  // Update source file label
  const sourceLabel = document.getElementById('source-file-label');
  if (sourceLabel) {
    if (currentCategory === 'character') {
      sourceLabel.textContent = 'ZZZ - Character History.csv';
    } else if (currentCategory === 'engine') {
      sourceLabel.textContent = 'ZZZ - Engine History.csv';
    } else if (currentCategory === 'rescreen') {
      sourceLabel.textContent = 'ZZZ - Rescreen History.csv';
    } else {
      sourceLabel.textContent = 'ZZZ - Character History.csv + ZZZ - Engine History.csv + ZZZ - Rescreen History.csv';
    }
  }

  // Update search placeholder
  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    if (currentCategory === 'character') {
      searchInput.placeholder = 'Chercher un agent...';
    } else if (currentCategory === 'engine') {
      searchInput.placeholder = 'Chercher un moteur W...';
    } else if (currentCategory === 'rescreen') {
      searchInput.placeholder = 'Chercher un tirage Rescreen (agent ou WE)...';
    } else {
      searchInput.placeholder = 'Chercher un agent ou moteur W...';
    }
  }
}

function renderLossDistribution(pulls) {
  const container = document.getElementById('losses-grid');
  if (!container) return;
  container.innerHTML = '';

  const lossMap = {};
  for (const p of pulls) {
    if (p.isLoss && p.lostAgent) {
      const isEng = Boolean(p.isEngine || p.type === 'engine' || isEngineName(p.lostAgent));
      if (!lossMap[p.lostAgent]) {
        lossMap[p.lostAgent] = { count: 0, isEngine: isEng };
      }
      lossMap[p.lostAgent].count++;
    }
  }

  const sortedLosses = Object.entries(lossMap).sort((a, b) => b[1].count - a[1].count);

  if (sortedLosses.length === 0) {
    container.innerHTML = '<span style="color: var(--text-muted); font-size: 0.85rem;">Aucune perte 50/50 enregistrée !</span>';
    return;
  }

  for (const [agent, info] of sortedLosses) {
    const chip = document.createElement('div');
    chip.className = 'loss-agent-chip';
    chip.innerHTML = `
      <img src="${getPortraitUrl(agent, info.isEngine)}" alt="${agent}" loading="lazy" onerror="handleImgError(this, '${safeName(agent)}', ${info.isEngine})" />
      <span class="loss-agent-name">${agent}</span>
      <span class="loss-agent-count">${info.count}</span>
    `;
    container.appendChild(chip);
  }
}

// Render the grid (individual S-Ranks) or detailed cards list
function renderPulls() {
  const container = document.getElementById('pulls-container');
  if (!container) return;

  const activePulls = getActivePulls();

  if (currentView === 'matrix') {
    // Individual S-Rank squares
    const allItems = buildAllSRankItems(activePulls);

    // Filter
    let filtered = allItems.filter(item => {
      if (currentFilter === 'win' && item.status !== 'WON') return false;
      if (currentFilter === 'loss' && item.status !== 'LOST') return false;
      if (currentFilter === 'guaranteed' && item.status !== 'GUARANTEED') return false;

      if (currentSearch) {
        const q = currentSearch.toLowerCase().trim();
        const cleanAgent = getCleanAgentName(item.agent).toLowerCase();
        const matchAgent = item.agent.toLowerCase().includes(q) || cleanAgent.includes(q);
        const matchTarget = item.targetAgent ? item.targetAgent.toLowerCase().includes(q) : false;
        const matchPatch = item.patch.toLowerCase().includes(q);
        const isEngine = isEnginePull(item);
        const matchType = isEngine && (q.includes('we') || q.includes('moteur') || q.includes('engine'));
        const matchRescreen = item.type === 'rescreen' && q.includes('rescreen');
        if (!matchAgent && !matchTarget && !matchPatch && !matchType && !matchRescreen) return false;
      }
      return true;
    });

    // Sort
    filtered.sort((a, b) => {
      if (currentSort === 'newest') return b.id - a.id;
      if (currentSort === 'oldest') return a.id - b.id;
      if (currentSort === 'pity-high') return b.pity - a.pity;
      if (currentSort === 'pity-low') return a.pity - b.pity;
      return 0;
    });

    if (filtered.length === 0) {
      container.className = '';
      container.innerHTML = `<div class="empty-state"><p>Aucun tirage ne correspond à vos filtres.</p></div>`;
      return;
    }

    container.className = 'pulls-grid-matrix';
    container.innerHTML = filtered.map(item => renderMatrixTile(item)).join('');

    // Click listeners for square detail modal
    container.querySelectorAll('[data-item-id]').forEach(el => {
      el.addEventListener('click', () => {
        const id = parseInt(el.dataset.itemId);
        const item = allItems.find(i => i.id === id);
        if (item) openSRankDetailModal(item);
      });
    });

  } else {
    // Detailed cards view
    let filtered = activePulls.filter(p => {
      if (currentFilter === 'win' && (p.isLoss || p.isGuaranteedFirst)) return false;
      if (currentFilter === 'loss' && !p.isLoss) return false;
      if (currentFilter === 'guaranteed' && !p.isLoss && !p.isGuaranteedFirst) return false;
      if (currentSearch) {
        const q = currentSearch.toLowerCase().trim();
        const cleanAgent = getCleanAgentName(p.agent).toLowerCase();
        const matchAgent = p.agent.toLowerCase().includes(q) || cleanAgent.includes(q);
        const matchLost = p.lostAgent ? p.lostAgent.toLowerCase().includes(q) : false;
        const matchPatch = p.patch.toLowerCase().includes(q);
        const isEngine = isEnginePull(p);
        const matchType = isEngine && (q.includes('we') || q.includes('moteur') || q.includes('engine'));
        const matchRescreen = p.type === 'rescreen' && q.includes('rescreen');
        if (!matchAgent && !matchLost && !matchPatch && !matchType && !matchRescreen) return false;
      }
      return true;
    });

    filtered.sort((a, b) => {
      if (currentSort === 'newest') return b.id - a.id;
      if (currentSort === 'oldest') return a.id - b.id;
      if (currentSort === 'pity-high') return b.total - a.total;
      if (currentSort === 'pity-low') return a.total - b.total;
      return 0;
    });

    if (filtered.length === 0) {
      container.className = '';
      container.innerHTML = `<div class="empty-state"><p>Aucun tirage ne correspond à vos filtres.</p></div>`;
      return;
    }

    container.className = 'pulls-container';
    container.innerHTML = filtered.map(pull => renderPullCard(pull)).join('');

    container.querySelectorAll('[data-pull-id]').forEach(el => {
      el.addEventListener('click', () => {
        const id = parseInt(el.dataset.pullId);
        const pull = activePulls.find(p => p.id === id);
        if (pull) openPullDetailModal(pull);
      });
    });
  }
}

// HTML for TRUE SQUARE matrix tile (Each S-Rank has its own square)
function renderMatrixTile(item) {
  const isWon = item.status === 'WON';
  const isLost = item.status === 'LOST';
  const isGuaranteed = item.status === 'GUARANTEED';
  const isEngine = isEnginePull(item);

  let tileClass = 'is-won';
  let badgeClass = 'win';
  let letter = 'W';

  if (isLost) {
    tileClass = 'is-lost';
    badgeClass = 'loss';
    letter = 'L';
  } else if (isGuaranteed) {
    tileClass = 'is-guaranteed';
    badgeClass = 'guaranteed';
    letter = 'G';
  }

  const kindLabel = isEngine ? 'Moteur W' : 'Agent';
  let statusTitle = isWon ? '50/50 Gagné' : (isLost ? `50/50 Perdu (bannière ${item.targetAgent})` : 'Garanti');
  if (item.isRescreenFirst) {
    statusTitle = `1er ${kindLabel} garanti (Rescreen v${item.patch})`;
  }

  return `
    <div class="matrix-tile ${tileClass} ${isEngine ? 'is-engine' : ''}" data-item-id="${item.id}" title="#${item.id} [Patch ${item.patch}] ${kindLabel} : ${item.agent} (${statusTitle}) - ${item.pity} tirages">
      <!-- Image en fond couvrant tout le carré -->
      <img class="matrix-img" src="${getPortraitUrl(item.agent, isEngine)}" alt="${item.agent}" loading="lazy" onerror="handleImgError(this, '${safeName(item.agent)}', ${isEngine})" />

      <!-- En-tête supérieur au dessus de l'image -->
      <div class="matrix-top-bar">
        <span class="matrix-index-badge">#${item.id}</span>
        <span class="matrix-patch-badge">v${item.patch}</span>
      </div>

      <!-- Barre inférieure : W / L / G + chiffre de pity à gauche -->
      <div class="matrix-bottom-bar">
        <div class="matrix-badge-combined ${badgeClass}">
          <span class="matrix-tag-letter">${letter}</span>
          <span class="matrix-pity-num">${item.pity}</span>
        </div>
      </div>
    </div>
  `;
}

// HTML for detailed card view
function renderPullCard(pull) {
  const isWon = !pull.isLoss && !pull.isGuaranteedFirst;
  const isGuaranteedDirect = Boolean(pull.isGuaranteedFirst);
  const isEngine = isEnginePull(pull);
  const engineBadge = isEngine ? '<span class="badge-we">MOTEUR W</span>' : '';

  let cardClass = 'pull-card card-win';
  if (pull.isLoss) cardClass = 'pull-card card-loss';
  else if (isGuaranteedDirect) cardClass = 'pull-card card-guaranteed';

  let contentHtml = '';

  if (isGuaranteedDirect) {
    contentHtml = `
      <div class="character-entry">
        <div class="portrait-wrapper is-guaranteed">
          <img class="portrait-img" src="${getPortraitUrl(pull.agent, isEngine)}" alt="${pull.agent}" loading="lazy" onerror="handleImgError(this, '${safeName(pull.agent)}', ${isEngine})" />
          <div class="rank-badge">${isEngine ? 'WE' : 'S'}</div>
        </div>
        <div class="character-info">
          <div class="character-name">${pull.agent} ${engineBadge}</div>
          <span class="status-badge badge-guaranteed">★ 100% GARANTI</span>
          <span class="banner-notice">1er ${isEngine ? 'Moteur W' : 'Agent'} garanti de la version ${pull.patch} (Rescreen)</span>
        </div>
      </div>
    `;
  } else if (isWon) {
    contentHtml = `
      <div class="character-entry">
        <div class="portrait-wrapper is-won">
          <img class="portrait-img" src="${getPortraitUrl(pull.agent, isEngine)}" alt="${pull.agent}" loading="lazy" onerror="handleImgError(this, '${safeName(pull.agent)}', ${isEngine})" />
          <div class="rank-badge">${isEngine ? 'WE' : 'S'}</div>
        </div>
        <div class="character-info">
          <div class="character-name">${pull.agent} ${engineBadge}</div>
          <span class="status-badge badge-won">✓ 50/50 GAGNÉ</span>
          ${pull.bannerFrom ? `<span class="banner-notice">Bannière : ${pull.bannerFrom}</span>` : ''}
        </div>
      </div>
    `;
  } else {
    contentHtml = `
      <div class="character-entry">
        <div class="portrait-wrapper is-lost">
          <img class="portrait-img" src="${getPortraitUrl(pull.lostAgent, isEngine)}" alt="${pull.lostAgent}" loading="lazy" onerror="handleImgError(this, '${safeName(pull.lostAgent)}', ${isEngine})" />
          <div class="rank-badge">${isEngine ? 'WE' : 'S'}</div>
        </div>
        <div class="character-info">
          <div class="character-name">${pull.lostAgent} ${engineBadge}</div>
          <span class="status-badge badge-lost">✗ 50/50 PERDU</span>
          <span style="font-size: 0.72rem; color: var(--text-muted);">Pity : <strong style="color:var(--loss-color); font-family:var(--font-mono);">${pull.lostPity}</strong></span>
        </div>
      </div>

      <div class="flow-arrow">
        ➔
        <span>GARANTI</span>
      </div>

      <div class="character-entry">
        <div class="portrait-wrapper is-guaranteed">
          <img class="portrait-img" src="${getPortraitUrl(pull.agent, isEngine)}" alt="${pull.agent}" loading="lazy" onerror="handleImgError(this, '${safeName(pull.agent)}', ${isEngine})" />
          <div class="rank-badge">${isEngine ? 'WE' : 'S'}</div>
        </div>
        <div class="character-info">
          <div class="character-name">${pull.agent} ${engineBadge}</div>
          <span class="status-badge badge-guaranteed">★ GARANTI</span>
          ${pull.bannerFrom ? `<span class="banner-notice">${pull.bannerFrom} ➔ ${pull.agent}</span>` : ''}
        </div>
      </div>
    `;
  }

  const costPityClass = getPityClass(pull.cost);

  return `
    <div class="${cardClass}" data-pull-id="${pull.id}">
      <div class="pull-meta">
        <span class="pull-index">#${pull.id}</span>
        <span class="pull-patch">Patch ${pull.patch}</span>
      </div>

      <div class="pull-content">
        ${contentHtml}
      </div>

      <div class="pull-stats">
        <div class="pity-pill ${costPityClass}">
          ${pull.isLoss ? `+${pull.cost} Pity` : `${pull.cost} Pity`}
        </div>
        <div class="pull-total-cost">
          Total : <strong>${pull.total}</strong> tirages
        </div>
      </div>
    </div>
  `;
}

// Modal for individual S-Rank square click
function openSRankDetailModal(item) {
  const modal = document.getElementById('detail-modal');
  const title = document.getElementById('detail-modal-title');
  const content = document.getElementById('detail-modal-content');
  if (!modal || !title || !content) return;

  const isEngine = isEnginePull(item);
  const typePrefix = isEngine ? 'Moteur W — ' : '';
  title.textContent = `Tirage #${item.id} — ${typePrefix}${item.agent}`;

  let statusHtml = '';
  let borderColor = 'var(--win-color)';

  if (item.status === 'WON') {
    statusHtml = `<div style="color: var(--win-color); font-weight: 800;">✓ 50/50 GAGNÉ (Pity ${item.pity})</div>`;
    borderColor = 'var(--win-color)';
  } else if (item.status === 'LOST') {
    statusHtml = `
      <div style="color: var(--loss-color); font-weight: 800;">✗ 50/50 PERDU (Pity ${item.pity})</div>
      <div style="font-size: 0.8rem; color: var(--text-muted);">Tiré sur la bannière : ${item.targetAgent}</div>
    `;
    borderColor = 'var(--loss-color)';
  } else if (item.isRescreenFirst) {
    statusHtml = `
      <div style="color: var(--guaranteed-color); font-weight: 800;">★ RANG S GARANTI D'OFFICE (Pity ${item.pity})</div>
      <div style="font-size: 0.8rem; color: var(--text-muted);">1er ${isEngine ? 'Moteur W' : 'personnage'} garanti sur la bannière Rescreen en version ${item.patch}</div>
    `;
    borderColor = 'var(--guaranteed-color)';
  } else {
    statusHtml = `
      <div style="color: var(--guaranteed-color); font-weight: 800;">★ RANG S GARANTI (Pity ${item.pity})</div>
      <div style="font-size: 0.8rem; color: var(--text-muted);">Garanti après avoir perdu contre : ${item.lostAgent}</div>
    `;
    borderColor = 'var(--guaranteed-color)';
  }

  content.innerHTML = `
    <div class="detail-card-inner">
      <div class="detail-avatar" style="border-color: ${borderColor}; position: relative;">
        <img src="${getPortraitUrl(item.agent, isEngine)}" alt="${item.agent}" onerror="handleImgError(this, '${safeName(item.agent)}', ${isEngine})" />
      </div>
      <div class="detail-info">
        <div class="detail-title">
          ${item.agent}
          ${isEngine ? '<span class="badge-we">MOTEUR W</span>' : ''}
        </div>
        ${statusHtml}
        <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 2px;">Patch : v${item.patch}</div>
        ${isEngine ? `<div style="font-size: 0.78rem; color: var(--zzz-yellow); margin-top: 4px;">⚙️ Bannière de Moteur W (W-Engine)</div>` : ''}
      </div>
    </div>

    <div class="detail-stats-grid">
      <div class="detail-stat-item">
        <span class="detail-stat-label">Pity du tirage</span>
        <span class="detail-stat-val">${item.pity} tirages</span>
      </div>
      <div class="detail-stat-item">
        <span class="detail-stat-label">Coût polychromes</span>
        <span class="detail-stat-val">${(item.pity * 160).toLocaleString()}</span>
      </div>
      <div class="detail-stat-item">
        <span class="detail-stat-label">Total du cycle</span>
        <span class="detail-stat-val">${item.totalCycle || item.pity} tirages</span>
      </div>
      <div class="detail-stat-item">
        <span class="detail-stat-label">Statut</span>
        <span class="detail-stat-val" style="font-size: 0.88rem; color: ${borderColor};">
          ${item.status === 'WON' ? '50/50 Gagné' : (item.status === 'LOST' ? '50/50 Perdu' : 'Garanti')}
        </span>
      </div>
    </div>
  `;

  modal.classList.add('active');
}

// Modal for detailed card click
function openPullDetailModal(pull) {
  const modal = document.getElementById('detail-modal');
  const title = document.getElementById('detail-modal-title');
  const content = document.getElementById('detail-modal-content');
  if (!modal || !title || !content) return;

  const isWon = !pull.isLoss && !pull.isGuaranteedFirst;
  const isGuaranteedDirect = Boolean(pull.isGuaranteedFirst);
  const isEngine = isEnginePull(pull);
  const typePrefix = isEngine ? 'Moteur W — ' : '';
  title.textContent = `Tirage #${pull.id} — ${typePrefix}${pull.agent}`;

  let statusDetails = '';
  if (isGuaranteedDirect) {
    statusDetails = `
      <div class="detail-card-inner">
        <div class="detail-avatar" style="border-color: var(--guaranteed-color);">
          <img src="${getPortraitUrl(pull.agent, isEngine)}" alt="${pull.agent}" onerror="handleImgError(this, '${safeName(pull.agent)}', ${isEngine})" />
        </div>
        <div class="detail-info">
          <div class="detail-title">
            ${pull.agent}
            ${isEngine ? '<span class="badge-we">MOTEUR W</span>' : ''}
          </div>
          <div style="color: var(--guaranteed-color); font-weight: 800;">★ 100% GARANTI D'OFFICE</div>
          <div style="font-size: 0.8rem; color: var(--text-muted);">1er ${isEngine ? 'Moteur W' : 'Agent'} garanti en version ${pull.patch} (Bannière Rescreen)</div>
        </div>
      </div>
    `;
  } else if (isWon) {
    statusDetails = `
      <div class="detail-card-inner">
        <div class="detail-avatar" style="border-color: var(--win-color);">
          <img src="${getPortraitUrl(pull.agent, isEngine)}" alt="${pull.agent}" onerror="handleImgError(this, '${safeName(pull.agent)}', ${isEngine})" />
        </div>
        <div class="detail-info">
          <div class="detail-title">
            ${pull.agent}
            ${isEngine ? '<span class="badge-we">MOTEUR W</span>' : ''}
          </div>
          <div style="color: var(--win-color); font-weight: 800;">✓ 50/50 GAGNÉ</div>
          <div style="font-size: 0.8rem; color: var(--text-muted);">Version : Patch ${pull.patch}</div>
        </div>
      </div>
    `;
  } else {
    statusDetails = `
      <div class="detail-card-inner">
        <div class="detail-avatar" style="border-color: var(--loss-color);">
          <img src="${getPortraitUrl(pull.lostAgent, isEngine)}" alt="${pull.lostAgent}" onerror="handleImgError(this, '${safeName(pull.lostAgent)}', ${isEngine})" />
        </div>
        <div class="detail-info">
          <div class="detail-title">
            ${pull.lostAgent}
            ${isEngine ? '<span class="badge-we">MOTEUR W</span>' : ''}
          </div>
          <div style="color: var(--loss-color); font-weight: 800;">✗ 50/50 PERDU (Pity ${pull.lostPity})</div>
          <div style="font-size: 0.8rem; color: var(--text-muted);">${isEngine ? 'Moteur W standard obtenu' : 'Permanent obtenu'}</div>
        </div>
      </div>

      <div style="text-align: center; color: var(--guaranteed-color); font-weight: 800; margin: 6px 0; font-size: 0.85rem;">
        ➔ Rang S Garanti Obtenu :
      </div>

      <div class="detail-card-inner">
        <div class="detail-avatar" style="border-color: var(--guaranteed-color);">
          <img src="${getPortraitUrl(pull.agent, isEngine)}" alt="${pull.agent}" onerror="handleImgError(this, '${safeName(pull.agent)}', ${isEngine})" />
        </div>
        <div class="detail-info">
          <div class="detail-title">
            ${pull.agent}
            ${isEngine ? '<span class="badge-we">MOTEUR W</span>' : ''}
          </div>
          <div style="color: var(--guaranteed-color); font-weight: 800;">★ GARANTI (${pull.cost} tirages)</div>
          ${pull.bannerFrom ? `<div style="font-size: 0.75rem; color: var(--zzz-yellow);">Bannière : ${pull.bannerFrom} ➔ ${pull.agent}</div>` : ''}
        </div>
      </div>
    `;
  }

  content.innerHTML = `
    ${statusDetails}
    <div class="detail-stats-grid">
      <div class="detail-stat-item">
        <span class="detail-stat-label">Total du cycle</span>
        <span class="detail-stat-val">${pull.total} tirages</span>
      </div>
      <div class="detail-stat-item">
        <span class="detail-stat-label">Coût polychromes</span>
        <span class="detail-stat-val">${(pull.total * 160).toLocaleString()}</span>
      </div>
      <div class="detail-stat-item">
        <span class="detail-stat-label">Patch</span>
        <span class="detail-stat-val">v${pull.patch}</span>
      </div>
      <div class="detail-stat-item">
        <span class="detail-stat-label">Statut</span>
        <span class="detail-stat-val" style="color: ${isWon ? 'var(--win-color)' : 'var(--loss-color)'};">
          ${isWon ? 'Victoire 50/50' : 'Perte 50/50'}
        </span>
      </div>
    </div>
  `;

  modal.classList.add('active');
}

// CSV Parser robust for user uploads
function parseCSV(text, type = 'character') {
  const lines = text.split(/\r\n|\n/);
  if (lines.length < 2) return [];

  const items = [];
  let currentPatch = '1.0';

  // Per-patch tracking for Rescreen banners: 1st character and 1st engine guaranteed per patch
  const seenCharsByPatch = new Set();
  const seenEnginesByPatch = new Set();

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const row = [];
    let inQuotes = false;
    let token = '';

    for (let c = 0; c < line.length; c++) {
      const char = line[c];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        row.push(token.trim());
        token = '';
      } else {
        token += char;
      }
    }
    row.push(token.trim());

    if (!row[1] || row[1] === '') continue;

    const patchRaw = row[0] || '';
    const agentRaw = row[1] || '';
    const pull1Raw = row[2] || '';
    const pull2Raw = row[3] || '';
    const totalRaw = row[4] || '';
    const lostAgentRaw = row[6] || '';

    const pull1 = parseInt(pull1Raw.replace(',', '.')) || 0;
    const pull2 = parseInt(pull2Raw.replace(',', '.')) || 0;
    let total = parseInt(totalRaw.replace(',', '.')) || 0;

    if (pull1 === 0 && pull2 === 0 && total === 0) continue;

    if (patchRaw) {
      currentPatch = patchRaw.replaceAll(',', '.');
      if (currentPatch === '3') currentPatch = '3.0';
    }

    let bannerFrom = null;
    let targetAgent = agentRaw;
    if (agentRaw.includes('->')) {
      const parts = agentRaw.split('->').map(p => p.trim());
      bannerFrom = parts[0];
      targetAgent = parts[1];
    }

    const isLoss = Boolean(lostAgentRaw && lostAgentRaw.trim() !== '');
    if (total === 0) total = pull1 + pull2;

    const lostPity = isLoss ? pull1 : 0;
    const cost = isLoss ? (pull2 || pull1) : pull1;

    // Detect if this pull is an engine:
    // Either from the engine CSV, or containing the standardized 'WE' suffix
    const isEngine = type === 'engine' || isEngineName(targetAgent);

    // Rescreen rule: in each patch where there is a rescreen banner,
    // the 1st character and the 1st engine are 100% guaranteed.
    let isGuaranteedFirst = false;
    if (type === 'rescreen' && !isLoss) {
      if (isEngine) {
        if (!seenEnginesByPatch.has(currentPatch)) {
          seenEnginesByPatch.add(currentPatch);
          isGuaranteedFirst = true;
        }
      } else {
        if (!seenCharsByPatch.has(currentPatch)) {
          seenCharsByPatch.add(currentPatch);
          isGuaranteedFirst = true;
        }
      }
    }

    items.push({
      id: items.length + 1,
      patch: currentPatch,
      agent: targetAgent,
      agentRaw: agentRaw,
      bannerFrom: bannerFrom,
      cost: cost,
      isLoss: isLoss,
      lostAgent: isLoss ? lostAgentRaw.trim() : null,
      lostPity: lostPity,
      total: total,
      type: type,
      isEngine: isEngine,
      isGuaranteedFirst: isGuaranteedFirst
    });
  }

  return items;
}

// Switch Active Category
function setCategory(cat) {
  currentCategory = cat;
  document.querySelectorAll('.cat-tab').forEach(t => {
    if (t.dataset.category === cat) {
      t.classList.add('active');
    } else {
      t.classList.remove('active');
    }
  });

  const activePulls = getActivePulls();
  updateStats(activePulls);
  renderPulls();
  updateCategoryBadges();
}

// Auto-fetch CSV files when served over HTTP/HTTPS (GitHub Pages, Live Server, local dev server)
async function autoFetchCSVs() {
  let charUpdated = false;
  let engineUpdated = false;
  let rescreenUpdated = false;

  try {
    const resChar = await fetch(encodeURI('ZZZ - Character History.csv') + '?v=' + Date.now());
    if (resChar.ok) {
      const text = await resChar.text();
      const parsed = parseCSV(text, 'character');
      if (parsed.length > 0) {
        charPulls = parsed;
        charUpdated = true;
      }
    }
  } catch (err) {
    // Normal / expected when opened directly via file:// protocol
  }

  try {
    const resEngine = await fetch(encodeURI('ZZZ - Engine History.csv') + '?v=' + Date.now());
    if (resEngine.ok) {
      const text = await resEngine.text();
      const parsed = parseCSV(text, 'engine');
      if (parsed.length > 0) {
        enginePulls = parsed;
        engineUpdated = true;
      }
    }
  } catch (err) {
    // Normal / expected when opened directly via file:// protocol
  }

  try {
    const resRescreen = await fetch(encodeURI('ZZZ - Rescreen History.csv') + '?v=' + Date.now());
    if (resRescreen.ok) {
      const text = await resRescreen.text();
      const parsed = parseCSV(text, 'rescreen');
      if (parsed.length > 0) {
        // Dynamically probe whether items in Rescreen are engines (e.g. Metanukimorphosis)
        for (const p of parsed) {
          if (p.isEngine) continue;
          if (isEngineName(p.agent)) {
            p.isEngine = true;
          } else {
            try {
              const probe = await fetch(`engines/W-Engine_${formatEngineSlug(p.agent)}.webp`, { method: 'HEAD' });
              if (probe.ok) p.isEngine = true;
            } catch (e) {}
          }
        }
        // Re-calculate guaranteed status for Rescreen based on dynamically resolved isEngine
        const seenCharsByPatch = new Set();
        const seenEnginesByPatch = new Set();
        for (const p of parsed) {
          if (!p.isLoss) {
            if (p.isEngine) {
              if (!seenEnginesByPatch.has(p.patch)) {
                seenEnginesByPatch.add(p.patch);
                p.isGuaranteedFirst = true;
              } else {
                p.isGuaranteedFirst = false;
              }
            } else {
              if (!seenCharsByPatch.has(p.patch)) {
                seenCharsByPatch.add(p.patch);
                p.isGuaranteedFirst = true;
              } else {
                p.isGuaranteedFirst = false;
              }
            }
          }
        }
        rescreenPulls = parsed;
        rescreenUpdated = true;
      }
    }
  } catch (err) {
    // Normal / expected when opened directly via file:// protocol
  }

  if (charUpdated || engineUpdated || rescreenUpdated) {
    console.info(`✓ Données CSV chargées automatiquement (Personnages: ${charPulls.length}, Moteurs W: ${enginePulls.length}, Rescreen: ${rescreenPulls.length})`);
    updateCategoryBadges();
    setCategory(currentCategory);
  }
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
  updateCategoryBadges();
  setCategory('character');
  autoFetchCSVs();

  // Category Tabs (Personnages / Moteurs W / Rescreen / Tous)
  const catTabs = document.querySelectorAll('.cat-tab');
  catTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      setCategory(tab.dataset.category);
    });
  });

  // Search input
  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      currentSearch = e.target.value;
      renderPulls();
    });
  }

  // Filter Pills
  const filterPills = document.querySelectorAll('.filter-pill');
  filterPills.forEach(pill => {
    pill.addEventListener('click', () => {
      filterPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      currentFilter = pill.dataset.filter;
      renderPulls();
    });
  });

  // Sort Select
  const sortSelect = document.getElementById('sort-select');
  if (sortSelect) {
    sortSelect.addEventListener('change', (e) => {
      currentSort = e.target.value;
      renderPulls();
    });
  }

  // View Switcher (Grille active par défaut)
  const btnCards = document.getElementById('btn-view-cards');
  const btnMatrix = document.getElementById('btn-view-matrix');
  if (btnCards && btnMatrix) {
    btnMatrix.addEventListener('click', () => {
      btnMatrix.classList.add('active');
      btnCards.classList.remove('active');
      currentView = 'matrix';
      renderPulls();
    });

    btnCards.addEventListener('click', () => {
      btnCards.classList.add('active');
      btnMatrix.classList.remove('active');
      currentView = 'cards';
      renderPulls();
    });
  }

  // Detail Modal Close
  const detailModal = document.getElementById('detail-modal');
  const detailClose = document.getElementById('detail-modal-close');
  if (detailClose && detailModal) {
    detailClose.addEventListener('click', () => detailModal.classList.remove('active'));
    detailModal.addEventListener('click', (e) => {
      if (e.target === detailModal) detailModal.classList.remove('active');
    });
  }

  // CSV Modal Setup
  const modal = document.getElementById('upload-modal');
  const openBtn = document.getElementById('btn-import-csv');
  const closeBtn = document.getElementById('modal-close-btn');
  const fileInput = document.getElementById('csv-file-input');
  const uploadZone = document.getElementById('upload-zone');

  if (openBtn && modal) {
    openBtn.addEventListener('click', () => modal.classList.add('active'));
  }
  if (closeBtn && modal) {
    closeBtn.addEventListener('click', () => modal.classList.remove('active'));
  }
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.remove('active');
    });
  }

  if (uploadZone && fileInput) {
    uploadZone.addEventListener('click', () => fileInput.click());
    
    uploadZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      uploadZone.classList.add('dragover');
    });

    uploadZone.addEventListener('dragleave', () => {
      uploadZone.classList.remove('dragover');
    });

    uploadZone.addEventListener('drop', (e) => {
      e.preventDefault();
      uploadZone.classList.remove('dragover');
      if (e.dataTransfer.files.length > 0) {
        handleFileUpload(e.dataTransfer.files[0]);
      }
    });

    fileInput.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        handleFileUpload(e.target.files[0]);
      }
    });
  }

  function handleFileUpload(file) {
    const fileName = file.name.toLowerCase();
    let targetType = 'character';

    // Auto-detect target category by file name
    if (fileName.includes('rescreen')) {
      targetType = 'rescreen';
    } else if (fileName.includes('engine') || fileName.includes('moteur')) {
      targetType = 'engine';
    } else if (fileName.includes('character') || fileName.includes('perso')) {
      targetType = 'character';
    } else {
      const checkedRadio = document.querySelector('input[name="import-target"]:checked');
      if (checkedRadio) targetType = checkedRadio.value;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target.result;
        const newPulls = parseCSV(text, targetType);
        if (newPulls.length > 0) {
          if (targetType === 'engine') {
            enginePulls = newPulls;
            setCategory('engine');
          } else if (targetType === 'rescreen') {
            rescreenPulls = newPulls;
            setCategory('rescreen');
          } else {
            charPulls = newPulls;
            setCategory('character');
          }
          updateCategoryBadges();
          if (modal) modal.classList.remove('active');
        } else {
          alert('Impossible de trouver des lignes de tirages valides dans ce fichier CSV.');
        }
      } catch (err) {
        console.error(err);
        alert('Erreur lors de la lecture du fichier CSV.');
      }
    };
    reader.readAsText(file);
  }
});
