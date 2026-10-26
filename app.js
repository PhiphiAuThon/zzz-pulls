/**
 * ZZZ 50/50 TRACKER (rng.moe style)
 * Logic for parsing, statistics computation, rendering, and filtering.
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

// ==========================================================================
// 1. CONFIGURATION DECLARATIVE DES CATEGORIES
// ==========================================================================
const CATEGORIES = {
  character: {
    id: 'character',
    label: 'Agents',
    icon: '👤',
    file: 'ZZZ - Character History.csv',
    searchPlaceholder: 'Recherche',
    defaultIsEngine: false
  },
  engine: {
    id: 'engine',
    label: 'Moteurs-W',
    icon: '⚙️',
    file: 'ZZZ - Engine History.csv',
    searchPlaceholder: 'Recherche',
    defaultIsEngine: true
  },
  rescreen: {
    id: 'rescreen',
    label: 'Re-screens',
    icon: '🔄',
    file: 'ZZZ - Rescreen History.csv',
    searchPlaceholder: 'Recherche',
    hasFirstGuaranteed: true,
    defaultIsEngine: false
  }
};

const ALL_CATEGORY = {
  id: 'all',
  label: 'Tous',
  icon: '🔀',
  searchPlaceholder: 'Recherche',
  file: Object.values(CATEGORIES).map(c => c.file).join(' + ')
};

// Données initiales embarquées (fallback hors-ligne / protocole file://)
const FALLBACK_CSVS = {
  character: `Patch,Agent,Cost,,Total,Multi,50/50 L Agent
"1.0",Ellen,80,10,90,9,Koleda
,Zhu Yuan,70,,70,7,
"1.1",Jane,80,80,160,16,Grace
"1.2",Burnice,80,73,153,16,Soldier 11
"1.3 / 1.4",Lighter -> Miyabi,20,75,95,10,Nekomata
"1.5",Astra,30,80,110,11,Lycaon
,Evelyn,75,,75,8,
"1.6",SAnby,75,90,165,17,Grace
,Trigger,65,,65,7,
"1.7",Vivian,80,,80,8,
"2.0",Yixuan,60,,60,6,
,Yixuan,30,,30,3,
,Jufufu,40,80,120,12,Grace
,Caesar,71,,71,8,
"2.2",Seed,80,,80,8,
,Orphie,60,,60,6,
2.3,Lucia,20,,20,2,
"2.3 / 2.4",Yidhari -> Dialyn,80,70,150,15,Lycaon
"2.4 / 2.5",Banyue -> YSG,80,70,150,15,Grace
"2.6",Yixuan,10,,10,1,
"2.6",Yuzuha,80,80,160,16,Soldier 11
"2.8",Promeia,80,,80,8,
3.0,Velina,80,,80,8,
3.1,Remielle,10,,10,1,
,Remielle,50,,50,5,
,Remielle,70,,70,7,
,Sigrid,30,,30,3,`,
  engine: `Patch,Agent,Cost,,Total,Multi,50/50 L Agent
"2.6",Qingming Birdcage,40,,40,4,
"2.7",Cordis Germina,50,,50,5,
"3.1",Ode of Resurrected Wings,50,50,100,10,Tusks of Fury`,
  rescreen: `Patch,Agent,Cost,,Total,Multi,50/50 L Agent
"2.5",Alice,78,,78,8,
"3.1",Metanukimorphosis (WE),68,,68,7,
"3.1 -> 3.4",Yuzuha -> ???,8,,,0,`
};

// ==========================================================================
// 2. UTILITAIRES & RESOLUTION D'IMAGES DYNAMIQUE (REGLE D'OR)
// ==========================================================================
function cleanAgentName(name) {
  if (!name) return '';
  return name.trim().replace(/[\s\-_]+we$/i, '').replace(/\(we\)$/i, '').trim();
}

function isEngineName(name) {
  if (!name) return false;
  const raw = String(name).trim();
  return (/\bwe\b/i).test(raw) ||
         (/\(we\)$/i).test(raw) ||
         (/^w[-_ ]?engine/i).test(raw) ||
         (/\bmoteur\b/i).test(raw);
}

function isEnginePull(item) {
  if (!item) return false;
  return Boolean(
    item.isEngine ||
    item.type === 'engine' ||
    isEngineName(item.agent) ||
    (item.targetAgent && isEngineName(item.targetAgent))
  );
}

function formatCharSlug(name) {
  if (!name) return '';
  return cleanAgentName(name)
    .toLowerCase()
    .replace(/[\s\-]+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}

function formatEngineSlug(name) {
  if (!name) return '';
  return name.trim()
    .replace(/^(w[-_ ]?engine|moteur[-_ ]?w)\s*[:\-_]?\s*/i, '')
    .replace(/[\s\-_]+we$/i, '')
    .replace(/\(we\)$/i, '')
    .trim()
    .replace(/\s+/g, '_');
}

function getSvgFallback(name, isEngine = false) {
  const clean = cleanAgentName(name);
  const label = clean ? clean.slice(0, 3).toUpperCase() : (name ? name.trim().slice(0, 3).toUpperCase() : '?');
  const bgColor = '%230a0b0d';
  const textColor = (name && name.includes('?')) ? '%239ca3af' : (isEngine ? '%2338bdf8' : '%239ca3af');
  return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect fill="${bgColor}" width="100" height="100"/><text fill="${textColor}" font-family="Barlow Semi Condensed, Chakra Petch, sans-serif" font-size="36" font-weight="900" letter-spacing="1" x="50%" y="54%" text-anchor="middle" dominant-baseline="middle">${encodeURIComponent(label)}</text></svg>`;
}

function getPortraitUrl(name, isEngine = false) {
  if (!name) return getSvgFallback('', isEngine);
  const raw = name.trim();
  if (isEngine || isEngineName(raw)) {
    return `engines/W-Engine_${formatEngineSlug(raw)}.webp`;
  }
  return `characters/${formatCharSlug(raw)}.webp`;
}

window.handleImgError = function(img, name, isEngine = false) {
  const step = parseInt(img.dataset.errorStep, 10) || 0;
  img.dataset.errorStep = step + 1;

  if (step === 0) {
    // 1re tentative : basculer de dossier (personnage <-> moteur)
    img.src = isEngine ? `characters/${formatCharSlug(name)}.webp` : `engines/W-Engine_${formatEngineSlug(name)}.webp`;
    return;
  }

  if (step === 1) {
    // 2e tentative : supprimer les accents
    const normalized = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (normalized !== name) {
      img.src = isEngine ? `engines/W-Engine_${formatEngineSlug(normalized)}.webp` : `characters/${formatCharSlug(normalized)}.webp`;
      return;
    }
  }

  // Fallback ultime SVG avec initiales
  img.onerror = null;
  img.src = getSvgFallback(name, isEngine);
};

function safeName(str) {
  return String(str || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

function getPityClass(pity) {
  if (pity < 30) return 'early';
  if (pity <= 73) return 'mid';
  if (pity <= 80) return 'high';
  return 'hard';
}

function parsePatchNumber(patch) {
  if (!patch) return 0;
  const first = patch.split('/')[0].split('->')[0].trim().replace(',', '.');
  const [major = 0, minor = 0] = first.split('.').map(n => parseInt(n, 10) || 0);
  return major * 100 + minor;
}

// ==========================================================================
// 3. PARSER CSV ROBUSTE
// ==========================================================================
function parseCSVRows(text) {
  const rows = [];
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    if (!line.trim()) continue;
    const row = [];
    let inQuotes = false;
    let token = '';
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') inQuotes = !inQuotes;
      else if (ch === ',' && !inQuotes) {
        row.push(token.trim());
        token = '';
      } else {
        token += ch;
      }
    }
    row.push(token.trim());
    rows.push(row);
  }
  return rows;
}

function parsePullsFromCSV(csvText, categoryKey) {
  const rows = parseCSVRows(csvText);
  if (rows.length < 2) return [];

  const pulls = [];
  let currentPatch = '1.0';
  const seenCharsByPatch = new Set();
  const seenEnginesByPatch = new Set();

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const [patchRaw, agentRaw, pull1Raw, pull2Raw, totalRaw, , lostAgentRaw] = row;
    if (!agentRaw) continue;

    const pull1 = parseInt(String(pull1Raw || '').replace(',', '.'), 10) || 0;
    const pull2 = parseInt(String(pull2Raw || '').replace(',', '.'), 10) || 0;
    let total = parseInt(String(totalRaw || '').replace(',', '.'), 10) || 0;
    if (pull1 === 0 && pull2 === 0 && total === 0) continue;

    if (patchRaw) {
      currentPatch = patchRaw.replace(',', '.');
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
    const isEngine = categoryKey === 'engine' || isEngineName(targetAgent) || isEngineName(agentRaw);

    let isGuaranteedFirst = false;
    if (categoryKey === 'rescreen' && !isLoss) {
      const patchKey = currentPatch.split('->')[0].trim();
      const seenSet = isEngine ? seenEnginesByPatch : seenCharsByPatch;
      if (!seenSet.has(patchKey)) {
        seenSet.add(patchKey);
        isGuaranteedFirst = true;
      }
    }

    pulls.push({
      id: pulls.length + 1,
      patch: currentPatch,
      agent: targetAgent,
      agentRaw,
      bannerFrom,
      cost,
      isLoss,
      lostAgent: isLoss ? lostAgentRaw.trim() : null,
      lostPity,
      total,
      type: categoryKey,
      isEngine,
      isGuaranteedFirst
    });
  }

  return pulls;
}

function recalculateRescreenGuarantees(pulls) {
  const seenChars = new Set();
  const seenEngines = new Set();
  for (const p of pulls) {
    if (!p.isLoss) {
      const patchKey = p.patch.split('->')[0].trim();
      const seen = p.isEngine ? seenEngines : seenChars;
      if (!seen.has(patchKey)) {
        seen.add(patchKey);
        p.isGuaranteedFirst = true;
      } else {
        p.isGuaranteedFirst = false;
      }
    }
  }
}

// ==========================================================================
// 4. ETAT CENTRAL DE L'APPLICATION
// ==========================================================================
const state = {
  category: 'character',
  filter: 'all', // 'all', 'win', 'loss', 'guaranteed'
  search: '',
  sort: 'newest', // 'newest', 'oldest', 'pity-high', 'pity-low'
  view: 'matrix', // 'matrix', 'cards'
  data: {}
};

// Initialisation des données à partir des fallbacks
Object.keys(CATEGORIES).forEach(key => {
  state.data[key] = parsePullsFromCSV(FALLBACK_CSVS[key] || '', key);
});

// ==========================================================================
// 5. MODELE DE DONNEES & CALCUL DES STATISTIQUES (FONCTIONS PURES)
// ==========================================================================
function getCombinedPulls() {
  const combined = [];
  const typeOrder = { character: 1, engine: 2, rescreen: 3 };
  Object.keys(CATEGORIES).forEach(key => {
    if (state.data[key]) combined.push(...state.data[key]);
  });
  combined.sort((a, b) => {
    const patchDiff = parsePatchNumber(a.patch) - parsePatchNumber(b.patch);
    if (patchDiff !== 0) return patchDiff;
    const typeDiff = (typeOrder[a.type] || 99) - (typeOrder[b.type] || 99);
    if (typeDiff !== 0) return typeDiff;
    return a.id - b.id;
  });
  return combined.map((p, idx) => ({ ...p, id: idx + 1 }));
}

function getActivePulls() {
  if (state.category === 'all') return getCombinedPulls();
  return state.data[state.category] || [];
}

function getItemStatus(item) {
  if (item.status) return item.status.toLowerCase();
  if (item.isLoss) return 'loss';
  if (item.isGuaranteedFirst) return 'guaranteed';
  return 'win';
}

function expandPullsToSRanks(pulls) {
  const items = [];
  pulls.forEach(p => {
    const isEngine = isEnginePull(p);
    if (p.isLoss) {
      let lossPatch = p.patch;
      let guarPatch = p.patch;
      if (p.patch && p.patch.includes('/')) {
        const parts = p.patch.split('/').map(s => s.trim());
        lossPatch = parts[0] || p.patch;
        guarPatch = parts[1] || parts[0] || p.patch;
      }
      items.push({
        id: items.length + 1,
        pullId: p.id,
        agent: p.lostAgent,
        pity: p.lostPity,
        status: 'loss',
        patch: lossPatch,
        targetAgent: p.bannerFrom || p.agent,
        bannerFrom: p.bannerFrom,
        totalCycle: p.total,
        type: p.type,
        isEngine,
        isRescreenFirst: false
      });
      items.push({
        id: items.length + 1,
        pullId: p.id,
        agent: p.agent,
        pity: p.cost,
        status: 'guaranteed',
        patch: guarPatch,
        lostAgent: p.lostAgent,
        totalCycle: p.total,
        type: p.type,
        isEngine,
        isRescreenFirst: false
      });
    } else {
      items.push({
        id: items.length + 1,
        pullId: p.id,
        agent: p.agent,
        pity: p.cost,
        status: p.isGuaranteedFirst ? 'guaranteed' : 'win',
        patch: p.patch,
        bannerFrom: p.bannerFrom,
        totalCycle: p.total,
        type: p.type,
        isEngine,
        isRescreenFirst: Boolean(p.isGuaranteedFirst)
      });
    }
  });
  return items;
}

function computeStats(pulls, sRankItems) {
  const totalPulls = pulls.reduce((sum, p) => sum + p.total, 0);
  const wins = pulls.filter(p => !p.isLoss && !p.isGuaranteedFirst).length;
  const losses = pulls.filter(p => p.isLoss).length;
  const total5050 = wins + losses;
  const winRate = total5050 > 0 ? ((wins / total5050) * 100).toFixed(1) : null;

  const totalSRanks = sRankItems.length;
  const avgPitySRank = totalSRanks > 0 ? (totalPulls / totalSRanks).toFixed(2) : '0';

  const fiftyFiftyPulls = pulls.filter(p => !p.isGuaranteedFirst).sort((a, b) => a.id - b.id);
  let currentStreak = 0;
  let isCurrentWin = true;
  let maxWinStreak = 0;
  let currentWinCounter = 0;

  for (const p of fiftyFiftyPulls) {
    if (!p.isLoss) {
      currentWinCounter++;
      if (currentWinCounter > maxWinStreak) maxWinStreak = currentWinCounter;
    } else {
      currentWinCounter = 0;
    }
  }

  if (fiftyFiftyPulls.length > 0) {
    const lastPull = fiftyFiftyPulls[fiftyFiftyPulls.length - 1];
    isCurrentWin = !lastPull.isLoss;
    for (let i = fiftyFiftyPulls.length - 1; i >= 0; i--) {
      if (!fiftyFiftyPulls[i].isLoss === isCurrentWin) {
        currentStreak++;
      } else {
        break;
      }
    }
  }

  return {
    totalPulls,
    wins,
    losses,
    total5050,
    winRate,
    avgPitySRank,
    streak: { currentStreak, maxWinStreak, hasFiftyFifty: fiftyFiftyPulls.length > 0 }
  };
}

// ==========================================================================
// 6. PIPELINE DE FILTRAGE & DE TRI
// ==========================================================================
function filterAndSortEntries(entries, { filter, search, sort, isMatrix }) {
  const q = search ? search.toLowerCase().trim() : '';

  const filtered = entries.filter(item => {
    const status = getItemStatus(item);
    if (filter === 'win' && status !== 'win') return false;
    if (filter === 'loss' && status !== 'loss') return false;
    if (filter === 'guaranteed' && status !== 'guaranteed') return false;

    if (q) {
      const agent = (item.agent || '').toLowerCase();
      const clean = cleanAgentName(item.agent).toLowerCase();
      const targetAgent = (item.targetAgent || item.lostAgent || '').toLowerCase();
      const patch = (item.patch || '').toLowerCase();
      const isEngine = isEnginePull(item);
      const isEngKw = isEngine && (q.includes('we') || q.includes('moteur') || q.includes('engine'));
      const isRescreenKw = item.type === 'rescreen' && q.includes('rescreen');
      if (!agent.includes(q) && !clean.includes(q) && !targetAgent.includes(q) && !patch.includes(q) && !isEngKw && !isRescreenKw) {
        return false;
      }
    }
    return true;
  });

  filtered.sort((a, b) => {
    const costA = isMatrix ? a.pity : a.total;
    const costB = isMatrix ? b.pity : b.total;
    if (sort === 'newest') return b.id - a.id;
    if (sort === 'oldest') return a.id - b.id;
    if (sort === 'pity-high') return costB - costA;
    if (sort === 'pity-low') return costA - costB;
    return 0;
  });

  return filtered;
}

// ==========================================================================
// 7. RENDU HTML : TUILES, CARTES & MODALES
// ==========================================================================
function renderMatrixTile(item) {
  const status = getItemStatus(item);
  const isEngine = isEnginePull(item);
  const kindLabel = isEngine ? 'Moteur W' : 'Agent';
  const statusTitle = status === 'win'
    ? '50/50 Gagné'
    : (status === 'loss'
        ? `50/50 Perdu (bannière ${item.targetAgent})`
        : (item.isRescreenFirst ? `1er ${kindLabel} garanti (Rescreen v${item.patch})` : 'Garanti'));

  return `
    <div class="matrix-tile" data-status="${status}" data-item-id="${item.id}" title="#${item.id} [Patch ${item.patch}] ${kindLabel} : ${item.agent} (${statusTitle}) - ${item.pity} tirages">
      <img class="matrix-img" src="${getPortraitUrl(item.agent, isEngine)}" alt="${item.agent}" loading="lazy" onerror="handleImgError(this, '${safeName(item.agent)}', ${isEngine})" />
      <div class="matrix-pity-badge" data-status="${status}">
        <span class="matrix-pity-num">${item.pity}</span>
      </div>
    </div>
  `;
}

function renderPullCard(pull) {
  const status = getItemStatus(pull);
  const isEngine = isEnginePull(pull);
  const engineBadge = isEngine ? '<span class="badge-we">MOTEUR W</span>' : '';
  let contentHtml = '';

  if (status === 'guaranteed') {
    contentHtml = `
      <div class="character-entry">
        <div class="portrait-wrapper" data-status="guaranteed">
          <img class="portrait-img" src="${getPortraitUrl(pull.agent, isEngine)}" alt="${pull.agent}" loading="lazy" onerror="handleImgError(this, '${safeName(pull.agent)}', ${isEngine})" />
          <div class="rank-badge">${isEngine ? 'WE' : 'S'}</div>
        </div>
        <div class="character-info">
          <div class="character-name">${pull.agent} ${engineBadge}</div>
          <span class="status-badge" data-status="guaranteed">★ 100% GARANTI</span>
          <span class="banner-notice">1er ${isEngine ? 'Moteur W' : 'Agent'} garanti de la version ${pull.patch} (Rescreen)</span>
        </div>
      </div>
    `;
  } else if (status === 'win') {
    contentHtml = `
      <div class="character-entry">
        <div class="portrait-wrapper" data-status="win">
          <img class="portrait-img" src="${getPortraitUrl(pull.agent, isEngine)}" alt="${pull.agent}" loading="lazy" onerror="handleImgError(this, '${safeName(pull.agent)}', ${isEngine})" />
          <div class="rank-badge">${isEngine ? 'WE' : 'S'}</div>
        </div>
        <div class="character-info">
          <div class="character-name">${pull.agent} ${engineBadge}</div>
          <span class="status-badge" data-status="win">✓ 50/50 GAGNÉ</span>
          ${pull.bannerFrom ? `<span class="banner-notice">Bannière : ${pull.bannerFrom}</span>` : ''}
        </div>
      </div>
    `;
  } else {
    contentHtml = `
      <div class="character-entry">
        <div class="portrait-wrapper" data-status="loss">
          <img class="portrait-img" src="${getPortraitUrl(pull.lostAgent, isEngine)}" alt="${pull.lostAgent}" loading="lazy" onerror="handleImgError(this, '${safeName(pull.lostAgent)}', ${isEngine})" />
          <div class="rank-badge">${isEngine ? 'WE' : 'S'}</div>
        </div>
        <div class="character-info">
          <div class="character-name">${pull.lostAgent} ${engineBadge}</div>
          <span class="status-badge" data-status="loss">✗ 50/50 PERDU</span>
          <span class="pity-sub-text">Pity : <strong>${pull.lostPity}</strong></span>
        </div>
      </div>
      <div class="flow-arrow">➔<span>GARANTI</span></div>
      <div class="character-entry">
        <div class="portrait-wrapper" data-status="guaranteed">
          <img class="portrait-img" src="${getPortraitUrl(pull.agent, isEngine)}" alt="${pull.agent}" loading="lazy" onerror="handleImgError(this, '${safeName(pull.agent)}', ${isEngine})" />
          <div class="rank-badge">${isEngine ? 'WE' : 'S'}</div>
        </div>
        <div class="character-info">
          <div class="character-name">${pull.agent} ${engineBadge}</div>
          <span class="status-badge" data-status="guaranteed">★ GARANTI</span>
          ${pull.bannerFrom ? `<span class="banner-notice">${pull.bannerFrom} ➔ ${pull.agent}</span>` : ''}
        </div>
      </div>
    `;
  }

  const costPityClass = getPityClass(pull.cost);

  return `
    <div class="pull-card" data-status="${status}" data-pull-id="${pull.id}">
      <div class="pull-meta">
        <span class="pull-index">#${pull.id}</span>
        <span class="pull-patch">Patch ${pull.patch}</span>
      </div>
      <div class="pull-content">${contentHtml}</div>
      <div class="pull-stats">
        <div class="pity-pill ${costPityClass}">
          ${pull.isLoss ? `+${pull.cost} Pity` : `${pull.cost} Pity`}
        </div>
        <div class="pull-total-cost">Total : <strong>${pull.total}</strong> tirages</div>
      </div>
    </div>
  `;
}

function openDetailModal(entity, isSRankItem) {
  const modal = document.getElementById('detail-modal');
  const titleEl = document.getElementById('detail-modal-title');
  const contentEl = document.getElementById('detail-modal-content');
  if (!modal || !titleEl || !contentEl) return;

  const isEngine = isEnginePull(entity);
  const typePrefix = isEngine ? 'Moteur W — ' : '';
  titleEl.textContent = `Tirage #${entity.id} — ${typePrefix}${entity.agent}`;

  const status = getItemStatus(entity);
  const engineBadge = isEngine ? '<span class="badge-we">MOTEUR W</span>' : '';
  const costPulls = isSRankItem ? entity.pity : entity.total;
  const totalPulls = entity.totalCycle || entity.total || entity.pity;

  let statusLabel = '50/50 Gagné';
  let statusDetail = '✓ 50/50 GAGNÉ';

  if (status === 'loss') {
    statusLabel = '50/50 Perdu';
    statusDetail = `✗ 50/50 PERDU (Pity ${entity.lostPity || entity.pity})`;
  } else if (status === 'guaranteed') {
    statusLabel = entity.isRescreenFirst ? 'Garanti (Rescreen)' : 'Garanti';
    statusDetail = entity.isRescreenFirst
      ? `★ 100% GARANTI D'OFFICE (1er ${isEngine ? 'Moteur W' : 'Agent'} Rescreen v${entity.patch})`
      : `★ RANG S GARANTI (${costPulls} tirages)`;
  }

  const renderAvatarItem = (agentName, itemStatus, descText) => `
    <div class="detail-card-inner">
      <div class="detail-avatar" data-status="${itemStatus}">
        <img src="${getPortraitUrl(agentName, isEngine)}" alt="${agentName}" onerror="handleImgError(this, '${safeName(agentName)}', ${isEngine})" />
      </div>
      <div class="detail-info">
        <div class="detail-title">${agentName} ${engineBadge}</div>
        <div class="detail-status-text" data-status="${itemStatus}">${descText}</div>
        <div class="detail-sub-info">Patch : v${entity.patch}</div>
      </div>
    </div>
  `;

  let avatarBlockHtml = '';
  if (!isSRankItem && entity.isLoss) {
    avatarBlockHtml = `
      ${renderAvatarItem(entity.lostAgent, 'loss', `✗ 50/50 PERDU (Pity ${entity.lostPity})`)}
      <div class="detail-arrow">➔ Rang S Garanti :</div>
      ${renderAvatarItem(entity.agent, 'guaranteed', `★ GARANTI (${entity.cost} tirages)`)}
    `;
  } else {
    avatarBlockHtml = renderAvatarItem(entity.agent, status, statusDetail);
  }

  contentEl.innerHTML = `
    ${avatarBlockHtml}
    <div class="detail-stats-grid">
      <div class="detail-stat-item">
        <span class="detail-stat-label">${isSRankItem ? 'Pity du tirage' : 'Total du cycle'}</span>
        <span class="detail-stat-val">${costPulls} tirages</span>
      </div>
      <div class="detail-stat-item">
        <span class="detail-stat-label">Coût polychromes</span>
        <span class="detail-stat-val">${(costPulls * 160).toLocaleString()}</span>
      </div>
      <div class="detail-stat-item">
        <span class="detail-stat-label">${isSRankItem ? 'Total du cycle' : 'Patch'}</span>
        <span class="detail-stat-val">${isSRankItem ? `${totalPulls} tirages` : `v${entity.patch}`}</span>
      </div>
      <div class="detail-stat-item">
        <span class="detail-stat-label">Statut</span>
        <span class="detail-stat-val detail-status-text" data-status="${status}">${statusLabel}</span>
      </div>
    </div>
  `;

  modal.classList.add('active');
}

// ==========================================================================
// 8. SYNCHRONISATION DU DOM & RENDU PRINCIPAL
// ==========================================================================
function updateStatsUI(pulls, sRanks) {
  const stats = computeStats(pulls, sRanks);

  // 50/50 Win Rate
  const winrateEl = document.getElementById('stat-winrate');
  if (winrateEl) winrateEl.textContent = stats.winRate ? `${stats.winRate}%` : '—';
  const winCountEl = document.getElementById('stat-win-count');
  if (winCountEl) winCountEl.textContent = stats.wins;
  const lossCountEl = document.getElementById('stat-loss-count');
  if (lossCountEl) lossCountEl.textContent = stats.losses;

  // Active Streak
  const streakEl = document.getElementById('stat-streak');
  if (streakEl) {
    streakEl.textContent = stats.streak.hasFiftyFifty ? `${stats.streak.currentStreak}/${stats.streak.maxWinStreak || 0}` : '0/0';
  }

  // Totaux & Moyennes
  const totalPullsEl = document.getElementById('stat-total-pulls');
  if (totalPullsEl) totalPullsEl.textContent = stats.totalPulls.toLocaleString();
  const avgSrankEl = document.getElementById('stat-avg-srank');
  if (avgSrankEl) avgSrankEl.textContent = stats.avgPitySRank;

  // Placeholder barre de recherche
  const activeCatConfig = CATEGORIES[state.category] || ALL_CATEGORY;
  const searchInput = document.getElementById('search-input');
  if (searchInput) searchInput.placeholder = activeCatConfig.searchPlaceholder;
}

function renderPullsUI() {
  const container = document.getElementById('pulls-container');
  if (!container) return;

  const activePulls = getActivePulls();
  const isMatrix = state.view === 'matrix';
  const sourceItems = isMatrix ? expandPullsToSRanks(activePulls) : activePulls;

  const filtered = filterAndSortEntries(sourceItems, {
    filter: state.filter,
    search: state.search,
    sort: state.sort,
    isMatrix
  });

  if (filtered.length === 0) {
    container.className = '';
    container.innerHTML = `<div class="empty-state"><p>Aucun tirage ne correspond à vos filtres.</p></div>`;
    return;
  }

  if (isMatrix) {
    container.className = 'pulls-grid-matrix';
    container.innerHTML = filtered.map(item => renderMatrixTile(item)).join('');
    container.querySelectorAll('[data-item-id]').forEach(el => {
      el.addEventListener('click', () => {
        const id = parseInt(el.dataset.itemId, 10);
        const item = sourceItems.find(i => i.id === id);
        if (item) openDetailModal(item, true);
      });
    });
  } else {
    container.className = 'pulls-container';
    container.innerHTML = filtered.map(pull => renderPullCard(pull)).join('');
    container.querySelectorAll('[data-pull-id]').forEach(el => {
      el.addEventListener('click', () => {
        const id = parseInt(el.dataset.pullId, 10);
        const pull = activePulls.find(p => p.id === id);
        if (pull) openDetailModal(pull, false);
      });
    });
  }
}

function render() {
  const activePulls = getActivePulls();
  const sRanks = expandPullsToSRanks(activePulls);

  updateStatsUI(activePulls, sRanks);
  renderPullsUI();
}

function setCategory(catId) {
  state.category = catId;
  document.querySelectorAll('.cat-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.category === catId);
  });
  render();
}

// ==========================================================================
// 9. CHARGEMENT AUTOMATIQUE DES FICHIERS CSV (HTTP / GITHUB PAGES)
// ==========================================================================
async function autoFetchCSVs() {
  let updatedAny = false;

  await Promise.all(Object.entries(CATEGORIES).map(async ([catKey, cat]) => {
    try {
      const res = await fetch(encodeURI(cat.file) + '?v=' + Date.now());
      if (res.ok) {
        const text = await res.text();
        const parsed = parsePullsFromCSV(text, catKey);
        if (parsed.length > 0) {
          // Détection dynamique des moteurs W sans suffixe explicite
          for (const pull of parsed) {
            if (!pull.isEngine && !cat.defaultIsEngine) {
              if (isEngineName(pull.agent)) {
                pull.isEngine = true;
              } else {
                try {
                  const probe = await fetch(`engines/W-Engine_${formatEngineSlug(pull.agent)}.webp`, { method: 'HEAD' });
                  if (probe.ok) pull.isEngine = true;
                } catch (e) {}
              }
            }
          }

          if (cat.hasFirstGuaranteed) {
            recalculateRescreenGuarantees(parsed);
          }

          state.data[catKey] = parsed;
          updatedAny = true;
        }
      }
    } catch (err) {
      // Échec normal en local via le protocole file://
    }
  }));

  if (updatedAny) {
    console.info(`✓ Données CSV chargées automatiquement (${Object.keys(CATEGORIES).map(k => `${k}: ${state.data[k].length}`).join(', ')})`);
    render();
  }
}

// ==========================================================================
// 10. GENERATION DYNAMIQUE DE LA NAVIGATION ET ECOUTEURS D'EVENEMENTS
// ==========================================================================
function renderCategoryTabs() {
  const container = document.getElementById('category-tabs');
  if (!container) return;

  const entries = [...Object.values(CATEGORIES), ALL_CATEGORY];
  container.innerHTML = entries.map(cat => `
    <button id="tab-cat-${cat.id}" class="cat-tab ${state.category === cat.id ? 'active' : ''}" data-category="${cat.id}" title="Afficher les tirages : ${cat.label}">
      <span class="cat-text">${cat.label}</span>
    </button>
  `).join('');

  container.querySelectorAll('.cat-tab').forEach(tab => {
    tab.addEventListener('click', () => setCategory(tab.dataset.category));
  });
}

function renderImportRadios() {
  const container = document.getElementById('import-cat-options');
  if (!container) return;

  container.innerHTML = Object.values(CATEGORIES).map((cat, idx) => `
    <label class="import-radio-label">
      <input type="radio" name="import-target" value="${cat.id}" id="import-target-${cat.id}" ${idx === 0 ? 'checked' : ''} />
      <span>${cat.icon} ${cat.label}</span>
    </label>
  `).join('');
}

document.addEventListener('DOMContentLoaded', () => {
  renderCategoryTabs();
  renderImportRadios();
  render();
  autoFetchCSVs();

  // Recherche textuelle
  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.addEventListener('input', e => {
      state.search = e.target.value;
      renderPullsUI();
    });
  }

  // Filtres (Tous / Gagnés / Perdus / Garantis)
  const filterPills = document.querySelectorAll('.filter-pill');
  filterPills.forEach(pill => {
    pill.addEventListener('click', () => {
      filterPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      state.filter = pill.dataset.filter;
      renderPullsUI();
    });
  });

  // Tri
  const sortSelect = document.getElementById('sort-select');
  if (sortSelect) {
    sortSelect.addEventListener('change', e => {
      state.sort = e.target.value;
      renderPullsUI();
    });
  }

  // Bascule de vue (Grille de carrés vs Cartes)
  const btnMatrix = document.getElementById('btn-view-matrix');
  const btnCards = document.getElementById('btn-view-cards');
  if (btnMatrix && btnCards) {
    btnMatrix.addEventListener('click', () => {
      btnMatrix.classList.add('active');
      btnCards.classList.remove('active');
      state.view = 'matrix';
      renderPullsUI();
    });

    btnCards.addEventListener('click', () => {
      btnCards.classList.add('active');
      btnMatrix.classList.remove('active');
      state.view = 'cards';
      renderPullsUI();
    });
  }


  // Scrollbar auto-masquage sur le conteneur de tirages
  const pullsContainer = document.getElementById('pulls-container');
  if (pullsContainer) {
    let scrollTimeout;
    pullsContainer.addEventListener('scroll', () => {
      pullsContainer.classList.add('is-scrolling');
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        pullsContainer.classList.remove('is-scrolling');
      }, 1000);
    }, { passive: true });
  }

  // Modale de Détail
  const detailModal = document.getElementById('detail-modal');
  const detailClose = document.getElementById('detail-modal-close');
  if (detailClose && detailModal) {
    detailClose.addEventListener('click', () => detailModal.classList.remove('active'));
    detailModal.addEventListener('click', e => {
      if (e.target === detailModal) detailModal.classList.remove('active');
    });
  }

  // Modale d'Importation CSV
  const uploadModal = document.getElementById('upload-modal');
  const openImportBtn = document.getElementById('btn-import-csv');
  const closeImportBtn = document.getElementById('modal-close-btn');
  const fileInput = document.getElementById('csv-file-input');
  const uploadZone = document.getElementById('upload-zone');

  if (openImportBtn && uploadModal) {
    openImportBtn.addEventListener('click', () => uploadModal.classList.add('active'));
  }
  if (closeImportBtn && uploadModal) {
    closeImportBtn.addEventListener('click', () => uploadModal.classList.remove('active'));
  }
  if (uploadModal) {
    uploadModal.addEventListener('click', e => {
      if (e.target === uploadModal) uploadModal.classList.remove('active');
    });
  }

  if (uploadZone && fileInput) {
    uploadZone.addEventListener('click', () => fileInput.click());
    uploadZone.addEventListener('dragover', e => {
      e.preventDefault();
      uploadZone.classList.add('dragover');
    });
    uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('dragover'));
    uploadZone.addEventListener('drop', e => {
      e.preventDefault();
      uploadZone.classList.remove('dragover');
      if (e.dataTransfer.files.length > 0) handleFileUpload(e.dataTransfer.files[0]);
    });

    fileInput.addEventListener('change', e => {
      if (e.target.files.length > 0) handleFileUpload(e.target.files[0]);
    });
  }

  function handleFileUpload(file) {
    const fileName = file.name.toLowerCase();
    let targetType = 'character';

    // Détection automatique de la catégorie cible d'après le nom de fichier
    const foundCat = Object.keys(CATEGORIES).find(key => fileName.includes(key));
    if (foundCat) {
      targetType = foundCat;
    } else if (fileName.includes('perso')) {
      targetType = 'character';
    } else if (fileName.includes('moteur')) {
      targetType = 'engine';
    } else {
      const checkedRadio = document.querySelector('input[name="import-target"]:checked');
      if (checkedRadio) targetType = checkedRadio.value;
    }

    const reader = new FileReader();
    reader.onload = e => {
      try {
        const text = e.target.result;
        const newPulls = parsePullsFromCSV(text, targetType);
        if (newPulls.length > 0) {
          state.data[targetType] = newPulls;
          setCategory(targetType);
          if (uploadModal) uploadModal.classList.remove('active');
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
