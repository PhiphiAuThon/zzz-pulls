/**
 * ZZZ 50/50 TRACKER (rng.moe style)
 * Logic for parsing, statistics computation, rendering, and filtering.
 * Each S-Rank has its own full square (37 items):
 * - Red [L] for 50/50 Lost (standard characters)
 * - Blue [G] for Guaranteed (limited characters)
 * - Yellow [W] for 50/50 Won (limited characters)
 */

// Known portrait mappings
const PORTRAIT_MAP = {
  'ellen': 'portraits/ellen.webp',
  'koleda': 'portraits/koleda.webp',
  'zhu yuan': 'portraits/zhu_yuan.webp',
  'zhuyuan': 'portraits/zhu_yuan.webp',
  'jane': 'portraits/jane.webp',
  'grace': 'portraits/grace.webp',
  'burnice': 'portraits/burnice.webp',
  'soldier 11': 'portraits/s11.webp',
  'soldier11': 'portraits/s11.webp',
  's11': 'portraits/s11.webp',
  'lighter': 'portraits/lighter.webp',
  'miyabi': 'portraits/miyabi.webp',
  'nekomata': 'portraits/nekomata.webp',
  'astra': 'portraits/astra.webp',
  'lycaon': 'portraits/lycaon.webp',
  'evelyn': 'portraits/evelyn.webp',
  'sanby': 'portraits/sanby.webp',
  's-anby': 'portraits/sanby.webp',
  'trigger': 'portraits/trigger.webp',
  'vivian': 'portraits/viivan.webp',
  'viivan': 'portraits/viivan.webp',
  'yixuan': 'portraits/yixuan.webp',
  'jufufu': 'portraits/jufufu.webp',
  'caesar': 'portraits/caesar.webp',
  'seed': 'portraits/seed.webp',
  'orphie': 'portraits/orphie.webp',
  'lucia': 'portraits/lucia.webp',
  'dialyn': 'portraits/dialyn.webp',
  'ysg': 'portraits/yeshunguang.webp',
  'yeshunguang': 'portraits/yeshunguang.webp',
  'ye shunguang': 'portraits/yeshunguang.webp',
  'yuzuha': 'portraits/yuzuha.webp',
  'promeia': 'portraits/promeia.webp',
  'velina': 'portraits/velina.webp',
  'remielle': 'portraits/remielle.webp',
  'sigrid': 'portraits/sigrid.webp',
  'rina': 'portraits/rina.webp',
  'yanagi': 'portraits/yanagi.webp',
  'alice': 'portraits/alice.webp',
  'cissia': 'portraits/cissia.webp',
  'claret': 'portraits/claret.webp',
  'hugo': 'portraits/hugo.webp',
  'norma': 'portraits/norma.webp',
  'roxy': 'portraits/roxy.webp',
  'silly': 'portraits/silly.webp'
};

// Initial dataset parsed from "ZZZ - Character History.csv"
const INITIAL_PULLS = [
  { id: 1, patch: '1.0', agent: 'Ellen', agentRaw: 'Ellen', bannerFrom: null, cost: 10, isLoss: true, lostAgent: 'Koleda', lostPity: 80, total: 90 },
  { id: 2, patch: '1.0', agent: 'Zhu Yuan', agentRaw: 'Zhu Yuan', bannerFrom: null, cost: 70, isLoss: false, lostAgent: null, lostPity: 0, total: 70 },
  { id: 3, patch: '1.1', agent: 'Jane', agentRaw: 'Jane', bannerFrom: null, cost: 80, isLoss: true, lostAgent: 'Grace', lostPity: 80, total: 160 },
  { id: 4, patch: '1.2', agent: 'Burnice', agentRaw: 'Burnice', bannerFrom: null, cost: 73, isLoss: true, lostAgent: 'Soldier 11', lostPity: 80, total: 153 },
  { id: 5, patch: '1.3 / 1.4', agent: 'Miyabi', agentRaw: 'Lighter -> Miyabi', bannerFrom: 'Lighter', cost: 75, isLoss: true, lostAgent: 'Nekomata', lostPity: 20, total: 95 },
  { id: 6, patch: '1.5', agent: 'Astra', agentRaw: 'Astra', bannerFrom: null, cost: 80, isLoss: true, lostAgent: 'Lycaon', lostPity: 30, total: 110 },
  { id: 7, patch: '1.5', agent: 'Evelyn', agentRaw: 'Evelyn', bannerFrom: null, cost: 75, isLoss: false, lostAgent: null, lostPity: 0, total: 75 },
  { id: 8, patch: '1.6', agent: 'SAnby', agentRaw: 'SAnby', bannerFrom: null, cost: 90, isLoss: true, lostAgent: 'Grace', lostPity: 75, total: 165 },
  { id: 9, patch: '1.6', agent: 'Trigger', agentRaw: 'Trigger', bannerFrom: null, cost: 65, isLoss: false, lostAgent: null, lostPity: 0, total: 65 },
  { id: 10, patch: '1.7', agent: 'Vivian', agentRaw: 'Vivian', bannerFrom: null, cost: 80, isLoss: false, lostAgent: null, lostPity: 0, total: 80 },
  { id: 11, patch: '2.0', agent: 'Yixuan', agentRaw: 'Yixuan', bannerFrom: null, cost: 60, isLoss: false, lostAgent: null, lostPity: 0, total: 60 },
  { id: 12, patch: '2.0', agent: 'Yixuan', agentRaw: 'Yixuan', bannerFrom: null, cost: 30, isLoss: false, lostAgent: null, lostPity: 0, total: 30 },
  { id: 13, patch: '2.0', agent: 'Jufufu', agentRaw: 'Jufufu', bannerFrom: null, cost: 80, isLoss: true, lostAgent: 'Grace', lostPity: 40, total: 120 },
  { id: 14, patch: '2.0', agent: 'Caesar', agentRaw: 'Caesar', bannerFrom: null, cost: 71, isLoss: false, lostAgent: null, lostPity: 0, total: 71 },
  { id: 15, patch: '2.2', agent: 'Seed', agentRaw: 'Seed', bannerFrom: null, cost: 80, isLoss: false, lostAgent: null, lostPity: 0, total: 80 },
  { id: 16, patch: '2.2', agent: 'Orphie', agentRaw: 'Orphie', bannerFrom: null, cost: 60, isLoss: false, lostAgent: null, lostPity: 0, total: 60 },
  { id: 17, patch: '2.3', agent: 'Lucia', agentRaw: 'Lucia', bannerFrom: null, cost: 20, isLoss: false, lostAgent: null, lostPity: 0, total: 20 },
  { id: 18, patch: '2.3 / 2.4', agent: 'Dialyn', agentRaw: 'Yidhari -> Dialyn', bannerFrom: 'Yidhari', cost: 70, isLoss: true, lostAgent: 'Lycaon', lostPity: 80, total: 150 },
  { id: 19, patch: '2.4 / 2.5', agent: 'YSG', agentRaw: 'Banyue -> YSG', bannerFrom: 'Banyue', cost: 70, isLoss: true, lostAgent: 'Grace', lostPity: 80, total: 150 },
  { id: 20, patch: '2.6', agent: 'Yixuan', agentRaw: 'Yixuan', bannerFrom: null, cost: 10, isLoss: false, lostAgent: null, lostPity: 0, total: 10 },
  { id: 21, patch: '2.6', agent: 'Yuzuha', agentRaw: 'Yuzuha', bannerFrom: null, cost: 80, isLoss: true, lostAgent: 'Soldier 11', lostPity: 80, total: 160 },
  { id: 22, patch: '2.8', agent: 'Promeia', agentRaw: 'Promeia', bannerFrom: null, cost: 80, isLoss: false, lostAgent: null, lostPity: 0, total: 80 },
  { id: 23, patch: '3.0', agent: 'Velina', agentRaw: 'Velina', bannerFrom: null, cost: 80, isLoss: false, lostAgent: null, lostPity: 0, total: 80 },
  { id: 24, patch: '3.1', agent: 'Remielle', agentRaw: 'Remielle', bannerFrom: null, cost: 10, isLoss: false, lostAgent: null, lostPity: 0, total: 10 },
  { id: 25, patch: '3.1', agent: 'Remielle', agentRaw: 'Remielle', bannerFrom: null, cost: 50, isLoss: false, lostAgent: null, lostPity: 0, total: 50 },
  { id: 26, patch: '3.1', agent: 'Remielle', agentRaw: 'Remielle', bannerFrom: null, cost: 70, isLoss: false, lostAgent: null, lostPity: 0, total: 70 },
  { id: 27, patch: '3.1', agent: 'Sigrid', agentRaw: 'Sigrid', bannerFrom: null, cost: 30, isLoss: false, lostAgent: null, lostPity: 0, total: 30 }
];

// App state
let currentPulls = [...INITIAL_PULLS];
let currentFilter = 'all'; // 'all', 'win', 'loss', 'guaranteed'
let currentSearch = '';
let currentSort = 'newest'; // 'newest', 'oldest', 'pity-high', 'pity-low'
let currentView = 'matrix'; // 'matrix' (default) or 'cards'

// Helpers
function getPortraitUrl(name) {
  if (!name) return 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect fill="%23222" width="100" height="100"/></svg>';
  const cleanName = name.toLowerCase().trim();
  return PORTRAIT_MAP[cleanName] || 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect fill="%23252a3a" width="100" height="100"/><text fill="%23f8e119" font-size="14" font-weight="bold" x="50%" y="50%" text-anchor="middle" dominant-baseline="middle">' + encodeURIComponent(name.slice(0, 3).toUpperCase()) + '</text></svg>';
}

function getPityClass(pity) {
  if (pity < 30) return 'early';
  if (pity <= 73) return 'mid';
  if (pity <= 80) return 'high';
  return 'hard';
}

// Build 37 S-Rank pull items in exact chronological order
function buildAllSRankItems(pulls) {
  const items = [];
  pulls.forEach(p => {
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

      // 1) The standard character pulled (50/50 LOST)
      items.push({
        id: items.length + 1,
        eventId: p.id,
        agent: p.lostAgent,
        pity: p.lostPity,
        status: 'LOST',
        patch: lossPatch,
        targetAgent: p.bannerFrom || p.agent,
        bannerFrom: p.bannerFrom,
        totalCycle: p.total
      });
      // 2) The guaranteed limited character pulled
      items.push({
        id: items.length + 1,
        eventId: p.id,
        agent: p.agent,
        pity: p.cost,
        status: 'GUARANTEED',
        patch: guarPatch,
        bannerFrom: p.bannerFrom,
        lostAgent: p.lostAgent,
        totalCycle: p.total
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
        totalCycle: p.total
      });
    }
  });
  return items;
}

function calculateStreaks(pulls) {
  const chrono = [...pulls].sort((a, b) => a.id - b.id);
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

  return { currentStreak, isCurrentWin, maxWinStreak };
}

// Update UI KPI Cards & Filters
function updateStats(pulls) {
  const totalPulls = pulls.reduce((sum, p) => sum + p.total, 0);
  const wins = pulls.filter(p => !p.isLoss).length;
  const losses = pulls.filter(p => p.isLoss).length;
  const total5050 = wins + losses;
  const winRate = total5050 > 0 ? ((wins / total5050) * 100).toFixed(1) : 0;
  const polychromes = totalPulls * 160;

  const totalSRanks = pulls.length + losses;
  const avgPitySRank = totalSRanks > 0 ? (totalPulls / totalSRanks).toFixed(1) : 0;
  const avgPityLimited = pulls.length > 0 ? (totalPulls / pulls.length).toFixed(1) : 0;

  const { currentStreak, isCurrentWin, maxWinStreak } = calculateStreaks(pulls);

  document.getElementById('stat-winrate').textContent = `${winRate}%`;
  document.getElementById('stat-win-count').textContent = wins;
  document.getElementById('stat-loss-count').textContent = losses;
  
  const barWin = document.getElementById('progress-win');
  const barLoss = document.getElementById('progress-loss');
  if (barWin && barLoss) {
    barWin.style.width = `${winRate}%`;
    barLoss.style.width = `${100 - winRate}%`;
  }

  const streakEl = document.getElementById('stat-streak');
  if (streakEl) {
    streakEl.textContent = `${currentStreak} ${isCurrentWin ? 'Victoires' : 'Défaites'}`;
    document.getElementById('stat-streak-type').textContent = isCurrentWin ? '🔥 En cours' : '💀 En cours';
    document.getElementById('stat-max-streak').textContent = maxWinStreak;
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
  document.getElementById('count-all').textContent = totalSRanks;
  document.getElementById('count-won').textContent = wins;
  document.getElementById('count-lost').textContent = losses;
  const countGuaranteedEl = document.getElementById('count-guaranteed');
  if (countGuaranteedEl) countGuaranteedEl.textContent = losses;
}

function renderLossDistribution(pulls) {
  const container = document.getElementById('losses-grid');
  if (!container) return;
  container.innerHTML = '';

  const lossMap = {};
  for (const p of pulls) {
    if (p.isLoss && p.lostAgent) {
      lossMap[p.lostAgent] = (lossMap[p.lostAgent] || 0) + 1;
    }
  }

  const sortedLosses = Object.entries(lossMap).sort((a, b) => b[1] - a[1]);

  if (sortedLosses.length === 0) {
    container.innerHTML = '<span style="color: var(--text-muted); font-size: 0.85rem;">Aucune perte 50/50 enregistrée !</span>';
    return;
  }

  for (const [agent, count] of sortedLosses) {
    const chip = document.createElement('div');
    chip.className = 'loss-agent-chip';
    chip.innerHTML = `
      <img src="${getPortraitUrl(agent)}" alt="${agent}" loading="lazy" />
      <span class="loss-agent-name">${agent}</span>
      <span class="loss-agent-count">${count}</span>
    `;
    container.appendChild(chip);
  }
}

// Render the grid (37 individual S-Ranks) or detailed cards list
function renderPulls() {
  const container = document.getElementById('pulls-container');
  if (!container) return;

  if (currentView === 'matrix') {
    // 37 individual S-Rank squares
    const allItems = buildAllSRankItems(currentPulls);

    // Filter
    let filtered = allItems.filter(item => {
      if (currentFilter === 'win' && item.status !== 'WON') return false;
      if (currentFilter === 'loss' && item.status !== 'LOST') return false;
      if (currentFilter === 'guaranteed' && item.status !== 'GUARANTEED') return false;

      if (currentSearch) {
        const q = currentSearch.toLowerCase();
        const matchAgent = item.agent.toLowerCase().includes(q);
        const matchTarget = item.targetAgent ? item.targetAgent.toLowerCase().includes(q) : false;
        const matchPatch = item.patch.toLowerCase().includes(q);
        if (!matchAgent && !matchTarget && !matchPatch) return false;
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
    let filtered = currentPulls.filter(p => {
      if (currentFilter === 'win' && p.isLoss) return false;
      if (currentFilter === 'loss' && !p.isLoss) return false;
      if (currentFilter === 'guaranteed') return false;
      if (currentSearch) {
        const q = currentSearch.toLowerCase();
        const matchAgent = p.agent.toLowerCase().includes(q);
        const matchLost = p.lostAgent ? p.lostAgent.toLowerCase().includes(q) : false;
        const matchPatch = p.patch.toLowerCase().includes(q);
        if (!matchAgent && !matchLost && !matchPatch) return false;
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
        const pull = currentPulls.find(p => p.id === id);
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

  const statusTitle = isWon ? '50/50 Gagné' : (isLost ? `50/50 Perdu (bannière ${item.targetAgent})` : `Garanti`);

  return `
    <div class="matrix-tile ${tileClass}" data-item-id="${item.id}" title="#${item.id} [Patch ${item.patch}] ${item.agent} (${statusTitle}) - ${item.pity} tirages">
      <!-- Image en fond couvrant tout le carré -->
      <img class="matrix-img" src="${getPortraitUrl(item.agent)}" alt="${item.agent}" loading="lazy" />

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
  const isWon = !pull.isLoss;
  const cardClass = isWon ? 'pull-card card-win' : 'pull-card card-loss';

  let contentHtml = '';

  if (isWon) {
    contentHtml = `
      <div class="character-entry">
        <div class="portrait-wrapper is-won">
          <img class="portrait-img" src="${getPortraitUrl(pull.agent)}" alt="${pull.agent}" loading="lazy" />
          <div class="rank-badge">S</div>
        </div>
        <div class="character-info">
          <div class="character-name">${pull.agent}</div>
          <span class="status-badge badge-won">✓ 50/50 GAGNÉ</span>
          ${pull.bannerFrom ? `<span class="banner-notice">Bannière : ${pull.bannerFrom}</span>` : ''}
        </div>
      </div>
    `;
  } else {
    contentHtml = `
      <div class="character-entry">
        <div class="portrait-wrapper is-lost">
          <img class="portrait-img" src="${getPortraitUrl(pull.lostAgent)}" alt="${pull.lostAgent}" loading="lazy" />
          <div class="rank-badge">S</div>
        </div>
        <div class="character-info">
          <div class="character-name">${pull.lostAgent}</div>
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
          <img class="portrait-img" src="${getPortraitUrl(pull.agent)}" alt="${pull.agent}" loading="lazy" />
          <div class="rank-badge">S</div>
        </div>
        <div class="character-info">
          <div class="character-name">${pull.agent}</div>
          <span class="status-badge badge-guaranteed">★ GARANTI</span>
          ${pull.bannerFrom ? `<span class="banner-notice">${pull.bannerFrom} ➔ ${pull.agent}</span>` : ''}
        </div>
      </div>
    `;
  }

  const costPityClass = isWon ? getPityClass(pull.cost) : getPityClass(pull.cost);

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
          ${isWon ? `${pull.cost} Pity` : `+${pull.cost} Pity`}
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

  title.textContent = `Tirage #${item.id} — ${item.agent}`;

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
  } else {
    statusHtml = `
      <div style="color: var(--guaranteed-color); font-weight: 800;">★ RANG S GARANTI (Pity ${item.pity})</div>
      <div style="font-size: 0.8rem; color: var(--text-muted);">Garanti après avoir perdu contre : ${item.lostAgent}</div>
    `;
    borderColor = 'var(--guaranteed-color)';
  }

  content.innerHTML = `
    <div class="detail-card-inner">
      <div class="detail-avatar" style="border-color: ${borderColor};">
        <img src="${getPortraitUrl(item.agent)}" alt="${item.agent}" />
      </div>
      <div class="detail-info">
        <div class="detail-title">${item.agent}</div>
        ${statusHtml}
        <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 2px;">Patch : v${item.patch}</div>
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

  const isWon = !pull.isLoss;
  title.textContent = `Tirage #${pull.id} — ${pull.agent}`;

  let statusDetails = '';
  if (isWon) {
    statusDetails = `
      <div class="detail-card-inner">
        <div class="detail-avatar" style="border-color: var(--win-color);">
          <img src="${getPortraitUrl(pull.agent)}" alt="${pull.agent}" />
        </div>
        <div class="detail-info">
          <div class="detail-title">${pull.agent}</div>
          <div style="color: var(--win-color); font-weight: 800;">✓ 50/50 GAGNÉ</div>
          <div style="font-size: 0.8rem; color: var(--text-muted);">Version : Patch ${pull.patch}</div>
        </div>
      </div>
    `;
  } else {
    statusDetails = `
      <div class="detail-card-inner">
        <div class="detail-avatar" style="border-color: var(--loss-color);">
          <img src="${getPortraitUrl(pull.lostAgent)}" alt="${pull.lostAgent}" />
        </div>
        <div class="detail-info">
          <div class="detail-title">${pull.lostAgent}</div>
          <div style="color: var(--loss-color); font-weight: 800;">✗ 50/50 PERDU (Pity ${pull.lostPity})</div>
          <div style="font-size: 0.8rem; color: var(--text-muted);">Permanent obtenu</div>
        </div>
      </div>

      <div style="text-align: center; color: var(--guaranteed-color); font-weight: 800; margin: 6px 0; font-size: 0.85rem;">
        ➔ Rang S Garanti Obtenu :
      </div>

      <div class="detail-card-inner">
        <div class="detail-avatar" style="border-color: var(--guaranteed-color);">
          <img src="${getPortraitUrl(pull.agent)}" alt="${pull.agent}" />
        </div>
        <div class="detail-info">
          <div class="detail-title">${pull.agent}</div>
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
function parseCSV(text) {
  const lines = text.split(/\r\n|\n/);
  if (lines.length < 2) return [];

  const items = [];
  let currentPatch = '1.0';

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

    // Chronological order:
    // When isLoss is true: pull1 is the 50/50 loss pity, pull2 is the guaranteed character pity.
    // When isLoss is false (50/50 won): pull1 is the won character pity.
    const lostPity = isLoss ? pull1 : 0;
    const cost = isLoss ? (pull2 || pull1) : pull1;

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
      total: total
    });
  }

  return items;
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
  updateStats(currentPulls);
  renderPulls();

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
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target.result;
        const newPulls = parseCSV(text);
        if (newPulls.length > 0) {
          currentPulls = newPulls;
          updateStats(currentPulls);
          renderPulls();
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
