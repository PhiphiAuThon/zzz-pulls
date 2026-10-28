/**
 * ZZZ 50/50 TRACKER
 * Architecture unifiée : modèle direct, zéro code défensif, délégation d'événements.
 * Règle d'or : aucune liste hardcodée de personnages ou moteurs.
 */

// 1. CONFIGURATION DES CATEGORIES
const CATEGORIES = {
  character: { id: 'character', label: 'Agents', file: 'ZZZ - Character History.csv', isEngine: false },
  engine: { id: 'engine', label: 'Moteurs-W', file: 'ZZZ - Engine History.csv', isEngine: true },
  rescreen: { id: 'rescreen', label: 'Re-screens', file: 'ZZZ - Rescreen History.csv', isEngine: false, hasFirstGuar: true }
};

const ALL_CAT = { id: 'all', label: 'Tous' };

// 2. ETAT DE L'APPLICATION
const state = {
  category: 'character',
  filter: 'all',
  search: '',
  sort: 'newest',
  view: 'matrix',
  cycles: { character: [], engine: [], rescreen: [] },
  items: []
};

// 3. UTILITAIRES DE TEXTE & IMAGES (100% DYNAMIQUES)
const cleanName = s => (s || '').replace(/[\s\-_]+we$|\(we\)$/i, '').trim();
const isEngineName = s => /\bwe\b|\(we\)$|^w[-_ ]?engine|\bmoteur\b/i.test(s || '');

function getPortraitUrl(name, isEngine) {
  if (!name || name.includes('?')) return '';
  const s = cleanName(name).normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return isEngine
    ? `engines/W-Engine_${s.replace(/^(w[-_ ]?engine|moteur[-_ ]?w)\s*[:\-_]?\s*/i, '').replace(/\s+/g, '_')}.webp`
    : `characters/${s.toLowerCase().replace(/[\s\-]+/g, '_').replace(/[^a-z0-9_]/g, '')}.webp`;
}

window.handleImgError = (img, name, isEngine) => {
  if (!img.dataset.flipped) {
    img.dataset.flipped = '1';
    img.src = getPortraitUrl(name, !isEngine);
  }
};

const formatAgentHtml = name => (name || '').replace(/\?+/g, m => `<span class="agent-unknown">${m}</span>`);

// 4. PARSER CSV & GENERATION DU MODELE DIRECT
function parseCSVRows(text) {
  return text.split(/\r?\n/).filter(l => l.trim()).map(line => {
    const row = [];
    let inQ = false, cur = '';
    for (const ch of line) {
      if (ch === '"') inQ = !inQ;
      else if (ch === ',' && !inQ) { row.push(cur.trim()); cur = ''; }
      else cur += ch;
    }
    row.push(cur.trim());
    return row;
  });
}

function parseCyclesFromCSV(text, catKey) {
  const rows = parseCSVRows(text);
  if (rows.length < 2) return [];

  const cycles = [];
  let currentPatch = '1.0';
  const seenChars = new Set(), seenEngines = new Set();

  for (let i = 1; i < rows.length; i++) {
    const [patchRaw, agentRaw, p1Raw, p2Raw, totRaw, , lostRaw] = rows[i];
    if (!agentRaw) continue;

    const pull1 = parseInt(p1Raw, 10) || 0;
    const pull2 = parseInt(p2Raw, 10) || 0;
    let total = parseInt(totRaw, 10) || (pull1 + pull2);
    if (pull1 === 0 && pull2 === 0 && total === 0) continue;

    if (patchRaw) {
      currentPatch = patchRaw.replace(',', '.');
      if (currentPatch === '3') currentPatch = '3.0';
    }

    let bannerFrom = null, targetAgent = agentRaw;
    if (agentRaw.includes('->')) {
      const parts = agentRaw.split('->').map(p => p.trim());
      bannerFrom = parts[0];
      targetAgent = parts[1];
    }

    const isLoss = Boolean(lostRaw && lostRaw.trim());
    const isEngine = catKey === 'engine' || isEngineName(targetAgent) || isEngineName(agentRaw);
    let isGuaranteedFirst = false;

    if (catKey === 'rescreen' && !isLoss) {
      const patchKey = currentPatch.split('->')[0].trim();
      const seenSet = isEngine ? seenEngines : seenChars;
      if (!seenSet.has(patchKey)) {
        seenSet.add(patchKey);
        isGuaranteedFirst = true;
      }
    }

    cycles.push({
      patch: currentPatch,
      agent: targetAgent,
      bannerFrom,
      isLoss,
      lostAgent: isLoss ? lostRaw.trim() : null,
      lostPity: isLoss ? pull1 : 0,
      targetPity: isLoss ? (pull2 || pull1) : pull1,
      total,
      type: catKey,
      isEngine,
      isGuaranteedFirst
    });
  }
  return cycles;
}

function buildItemsFromCycles(cycles) {
  const items = [];
  cycles.forEach(c => {
    let lossPatch = c.patch, guarPatch = c.patch;
    if (c.patch && c.patch.includes('/')) {
      const parts = c.patch.split('/').map(s => s.trim());
      lossPatch = parts[0];
      guarPatch = parts[1] || parts[0];
    }

    if (c.isLoss) {
      items.push({
        id: items.length + 1,
        agent: c.lostAgent,
        pity: c.lostPity,
        status: 'loss',
        patch: lossPatch,
        isEngine: c.isEngine,
        cycle: c
      });
      items.push({
        id: items.length + 1,
        agent: c.agent,
        pity: c.targetPity,
        status: 'guaranteed',
        patch: guarPatch,
        isEngine: c.isEngine,
        cycle: c
      });
    } else {
      items.push({
        id: items.length + 1,
        agent: c.agent,
        pity: c.targetPity,
        status: c.isGuaranteedFirst ? 'guaranteed' : 'win',
        patch: c.patch,
        isEngine: c.isEngine,
        cycle: c
      });
    }
  });
  return items;
}

function getActiveCycles() {
  if (state.category === 'all') {
    const combined = [...state.cycles.character, ...state.cycles.engine, ...state.cycles.rescreen];
    const parsePatch = p => {
      const [M = 0, m = 0] = (p || '').split(/[/\->]/)[0].split('.').map(Number);
      return M * 100 + m;
    };
    return combined.sort((a, b) => parsePatch(a.patch) - parsePatch(b.patch));
  }
  return state.cycles[state.category] || [];
}

function updateActiveItems() {
  state.items = buildItemsFromCycles(getActiveCycles());
}

// 5. CALCUL DES STATISTIQUES
function computeStats(cycles, items) {
  const totalPulls = cycles.reduce((sum, c) => sum + c.total, 0);
  const fiftyPulls = cycles.filter(c => !c.isGuaranteedFirst);
  const wins = fiftyPulls.filter(c => !c.isLoss).length;
  const losses = fiftyPulls.filter(c => c.isLoss).length;
  const total5050 = wins + losses;
  const winRate = total5050 > 0 ? ((wins / total5050) * 100).toFixed(1) : null;
  const avgPity = items.length > 0 ? (totalPulls / items.length).toFixed(2) : '0';

  let currentStreak = 0, isCurrentWin = true, maxWin = 0, maxLoss = 0, winCount = 0, lossCount = 0;
  fiftyPulls.forEach(c => {
    if (!c.isLoss) {
      winCount++; lossCount = 0;
      if (winCount > maxWin) maxWin = winCount;
    } else {
      lossCount++; winCount = 0;
      if (lossCount > maxLoss) maxLoss = lossCount;
    }
  });

  if (fiftyPulls.length > 0) {
    const last = fiftyPulls[fiftyPulls.length - 1];
    isCurrentWin = !last.isLoss;
    currentStreak = isCurrentWin ? winCount : lossCount;
  }

  return { totalPulls, wins, losses, winRate, avgPity, totalSRanks: items.length, currentStreak, isCurrentWin, maxWin, maxLoss, has5050: fiftyPulls.length > 0 };
}

// 6. RENDU UI
function renderStatsUI(stats) {
  document.getElementById('stat-winrate').textContent = stats.winRate ? `${stats.winRate}%` : '—';
  document.getElementById('stat-win-count').textContent = stats.wins;
  document.getElementById('stat-loss-count').textContent = stats.losses;

  const streakEl = document.getElementById('stat-streak');
  const streakChip = document.querySelector('.chip-streak');
  if (stats.has5050 && stats.currentStreak > 0) {
    streakEl.textContent = `${stats.currentStreak}${stats.isCurrentWin ? 'W' : 'L'}`;
    streakChip.dataset.streakType = stats.isCurrentWin ? 'win' : 'loss';
  } else {
    streakEl.textContent = '—';
    delete streakChip.dataset.streakType;
  }
  document.getElementById('stat-streak-records').textContent = stats.has5050 ? `(Max: ${stats.maxWin}W / ${stats.maxLoss}L)` : '';

  document.getElementById('stat-total-pulls').textContent = stats.totalPulls.toLocaleString();
  const poly = stats.totalPulls * 160;
  document.getElementById('stat-poly-count').textContent = poly >= 1000 ? `${Math.round(poly / 1000)}k` : poly;
  document.getElementById('stat-avg-srank').textContent = stats.avgPity;
  document.getElementById('stat-srank-count').textContent = stats.totalSRanks;
}

function renderMedia(name, isEngine, className) {
  if (!name || name.includes('?')) return `<div class="${className}-unknown agent-unknown">???</div>`;
  const url = getPortraitUrl(name, isEngine);
  return `<img class="${className}-img ${isEngine ? 'is-engine' : ''}" src="${url}" alt="${name}" loading="lazy" onerror="handleImgError(this, '${name.replace(/'/g, "\\'")}', ${isEngine})" />`;
}

function renderMatrixTile(item) {
  return `
    <div class="matrix-tile" data-status="${item.status}" data-id="${item.id}" title="#${item.id} [v${item.patch}] ${item.agent} (${item.status}) - ${item.pity} pulls">
      ${renderMedia(item.agent, item.isEngine, 'matrix')}
      <div class="matrix-pity-badge" data-status="${item.status}">
        <span class="matrix-pity-num">${item.pity}</span>
      </div>
    </div>`;
}

function renderPullCard(item) {
  let badgeText = item.status === 'loss'
    ? `50/50 PERDU${item.cycle.bannerFrom || item.cycle.agent ? ` (${item.cycle.bannerFrom || item.cycle.agent})` : ''}`
    : (item.cycle.isGuaranteedFirst ? 'GARANTI (RESCREEN)' : (item.status === 'guaranteed' ? 'GARANTI' : '50/50 GAGNÉ'));

  return `
    <div class="pull-card" data-status="${item.status}" data-id="${item.id}">
      <div class="pull-card-banner">${renderMedia(item.agent, item.isEngine, 'pull-banner')}</div>
      <div class="pull-card-main">
        <div class="pull-index-cartridge"><span class="pull-index-num">#${item.id}</span></div>
        <div class="pull-card-row">
          <span class="pull-card-name">${formatAgentHtml(item.agent)}</span>
          ${item.isEngine ? '<span class="badge-we">MOTEUR W</span>' : ''}
          <span class="status-badge" data-status="${item.status}">${badgeText}</span>
          ${item.patch ? `<span class="pull-card-patch">v${item.patch}</span>` : ''}
        </div>
      </div>
      <div class="pull-total-capsule">${item.pity} Tirages</div>
    </div>`;
}

function renderPullsUI() {
  const container = document.getElementById('pulls-container');
  const q = state.search.toLowerCase().trim();

  const searched = state.items.filter(item => {
    if (!q) return true;
    const matchKw = (item.isEngine && (q.includes('we') || q.includes('moteur'))) || (item.cycle.type === 'rescreen' && q.includes('rescreen'));
    return item.agent.toLowerCase().includes(q) || item.patch.includes(q) || (item.cycle.lostAgent && item.cycle.lostAgent.toLowerCase().includes(q)) || matchKw;
  });

  const counts = { all: searched.length, win: 0, loss: 0, guaranteed: 0 };
  searched.forEach(i => counts[i.status]++);

  document.querySelectorAll('.filter-pill').forEach(pill => {
    const f = pill.dataset.filter;
    const cEl = pill.querySelector('.filter-count');
    if (cEl && counts[f] !== undefined) cEl.textContent = `(${counts[f]})`;
  });

  const filtered = state.filter === 'all' ? searched : searched.filter(i => i.status === state.filter);

  if (!filtered.length) {
    container.className = '';
    container.innerHTML = '<div class="empty-state"><p>Aucun tirage ne correspond à vos filtres.</p></div>';
    return;
  }

  filtered.sort((a, b) => {
    if (state.sort === 'newest') return b.id - a.id;
    if (state.sort === 'oldest') return a.id - b.id;
    if (state.sort === 'pity-high') return b.pity - a.pity;
    if (state.sort === 'pity-low') return a.pity - b.pity;
    return 0;
  });

  const isMatrix = state.view === 'matrix';
  container.className = isMatrix ? 'pulls-grid-matrix' : 'pulls-container';
  container.innerHTML = filtered.map(isMatrix ? renderMatrixTile : renderPullCard).join('');
}

function render() {
  const cycles = getActiveCycles();
  renderStatsUI(computeStats(cycles, state.items));
  renderPullsUI();
}

function renderCategoryTabs() {
  const container = document.getElementById('category-tabs');
  const tabs = [...Object.values(CATEGORIES), ALL_CAT];

  container.innerHTML = tabs.map(cat => {
    const cycles = cat.id === 'all' ? getActiveCycles() : (state.cycles[cat.id] || []);
    const isAll = cat.id === 'all';
    const valid = isAll ? null : [...cycles].reverse().find(c => c.agent && !c.agent.includes('?'));
    const agentName = isAll ? 'Soldier 11' : (valid ? valid.agent : 'Soldier 11');
    const isEngine = isAll ? false : (valid ? valid.isEngine : false);
    const url = getPortraitUrl(agentName, isEngine);

    return `
      <button class="cat-tab ${state.category === cat.id ? 'active' : ''}" data-category="${cat.id}">
        <span class="cat-tab-texture" aria-hidden="true">
          <svg class="cat-tab-halftone-svg" viewBox="0 0 160 50" preserveAspectRatio="none"><use href="#cat-tab-halftone" /></svg>
        </span>
        <img class="cat-tab-char" src="${url}" alt="${agentName}" loading="lazy" onerror="handleImgError(this, '${agentName}', ${isEngine})" />
        <span class="cat-tab-label">${cat.label}</span>
      </button>`;
  }).join('');
}

function openDetailModal(item) {
  const modal = document.getElementById('detail-modal');
  const c = item.cycle;
  const isLoss = c.isLoss;

  document.getElementById('detail-modal-title').innerHTML = `
    <span class="modal-title-main">TIRAGE #${item.id}</span>
    <span class="modal-patch-badge">v${c.patch}</span>`;

  const renderBox = (name, status, pity) => `
    <div class="detail-agent-box" data-status="${status}">
      <div class="detail-agent-frame ${c.isEngine ? 'is-engine' : ''}">${renderMedia(name, c.isEngine, 'detail')}</div>
      <div class="detail-agent-field">
        <div class="detail-field-name">${formatAgentHtml(name)}</div>
        <div class="detail-field-pulls" data-status="${status}">${pity} pulls</div>
      </div>
    </div>`;

  const bays = isLoss
    ? `<div class="detail-bays-grid">${renderBox(c.lostAgent, 'loss', c.lostPity)}${renderBox(c.agent, 'guaranteed', c.targetPity)}</div>`
    : `<div class="detail-bays-single">${renderBox(c.agent, item.status, item.pity)}</div>`;

  const statusLabel = isLoss ? '50/50 Perdu + Garanti' : (item.status === 'guaranteed' ? 'Garanti' : '50/50 Gagné');

  document.getElementById('detail-modal-content').innerHTML = `
    <div class="detail-console-interior">
      ${bays}
      <div class="detail-stats-grid">
        <div class="detail-stat-item"><span class="detail-stat-label">Pity du tirage</span><span class="detail-stat-val">${item.pity} tirages</span></div>
        <div class="detail-stat-item"><span class="detail-stat-label">Total du cycle</span><span class="detail-stat-val">${c.total} tirages</span></div>
        <div class="detail-stat-item"><span class="detail-stat-label">Coût polychromes</span><span class="detail-stat-val">${(c.total * 160).toLocaleString()}</span></div>
        <div class="detail-stat-item"><span class="detail-stat-label">Statut</span><span class="detail-stat-val" data-status="${item.status}">${statusLabel}</span></div>
      </div>
    </div>`;

  modal.classList.add('active');
}

// 7. CHARGEMENT RESEAU & IMPORT
async function loadCSVData() {
  await Promise.all(Object.entries(CATEGORIES).map(async ([k, cat]) => {
    try {
      const res = await fetch(encodeURI(cat.file), { cache: 'no-cache' });
      if (res.ok) state.cycles[k] = parseCyclesFromCSV(await res.text(), k);
    } catch (e) {
      console.warn(`Chargement ${cat.file} ignoré:`, e);
    }
  }));

  updateActiveItems();
  renderCategoryTabs();
  render();
}

// 8. DELEGATION D'EVENEMENTS & INITIALISATION
document.addEventListener('DOMContentLoaded', () => {
  // Render options d'import dynamiques
  document.getElementById('import-cat-options').innerHTML = Object.values(CATEGORIES).map((c, i) => `
    <label class="import-radio-label">
      <input type="radio" name="import-target" value="${c.id}" ${i === 0 ? 'checked' : ''} />
      <span>${c.label}</span>
    </label>`).join('');

  loadCSVData();

  // Navigation par catégorie
  document.getElementById('category-tabs').addEventListener('click', e => {
    const tab = e.target.closest('.cat-tab');
    if (!tab) return;
    state.category = tab.dataset.category;
    updateActiveItems();
    document.querySelectorAll('.cat-tab').forEach(t => t.classList.toggle('active', t === tab));
    render();
  });

  // Recherche & filtres
  document.getElementById('search-input').addEventListener('input', e => {
    state.search = e.target.value;
    renderPullsUI();
  });

  document.querySelector('.filter-pills').addEventListener('click', e => {
    const pill = e.target.closest('.filter-pill');
    if (!pill) return;
    document.querySelectorAll('.filter-pill').forEach(p => p.classList.toggle('active', p === pill));
    state.filter = pill.dataset.filter;
    renderPullsUI();
  });

  document.getElementById('sort-select').addEventListener('change', e => {
    state.sort = e.target.value;
    renderPullsUI();
  });

  // Bascule de vue (Grille vs Cartes)
  const btnMatrix = document.getElementById('btn-view-matrix');
  const btnCards = document.getElementById('btn-view-cards');
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

  // Clic sur un tirage (ouverture modale)
  document.getElementById('pulls-container').addEventListener('click', e => {
    const tile = e.target.closest('[data-id]');
    if (!tile) return;
    const item = state.items.find(i => i.id === parseInt(tile.dataset.id, 10));
    if (item) openDetailModal(item);
  });

  // Modales : fermeture unifiée
  document.addEventListener('click', e => {
    if (e.target.closest('.modal-close') || e.target.classList.contains('modal-backdrop')) {
      document.querySelectorAll('.modal-backdrop').forEach(m => m.classList.remove('active'));
    }
  });

  // Modale Import
  const uploadModal = document.getElementById('upload-modal');
  const fileInput = document.getElementById('csv-file-input');
  const uploadZone = document.getElementById('upload-zone');

  document.getElementById('btn-import-csv').addEventListener('click', () => uploadModal.classList.add('active'));
  uploadZone.addEventListener('click', () => fileInput.click());

  const handleFile = file => {
    const name = file.name.toLowerCase();
    const target = Object.keys(CATEGORIES).find(k => name.includes(k)) ||
      (document.querySelector('input[name="import-target"]:checked')?.value || 'character');

    const reader = new FileReader();
    reader.onload = ev => {
      state.cycles[target] = parseCyclesFromCSV(ev.target.result, target);
      state.category = target;
      updateActiveItems();
      renderCategoryTabs();
      render();
      uploadModal.classList.remove('active');
    };
    reader.readAsText(file);
  };

  uploadZone.addEventListener('dragover', e => { e.preventDefault(); uploadZone.classList.add('dragover'); });
  uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('dragover'));
  uploadZone.addEventListener('drop', e => {
    e.preventDefault();
    uploadZone.classList.remove('dragover');
    if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
  });
  fileInput.addEventListener('change', e => {
    if (e.target.files[0]) handleFile(e.target.files[0]);
  });
});
