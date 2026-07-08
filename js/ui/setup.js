/* ── SETUP SCREEN ───────────────────────────────────────────── */
// ── Setup screen state ───────────────────────────────────────
let selectedRoles    = new Set(['villager', 'mafioso']);
let roleCounts       = { villager: 3, mafioso: 1 };  // manual count per role
let playerCountValue = 6;

function buildSetupRoles() {
  const grid = document.getElementById('roles-grid');
  if (!grid) return;
  grid.innerHTML = '';

  const countRoles  = ['villager', 'mafioso']; // always show stepper

  for (const roleId of ROLE_ORDER) {
    const role = ROLES[roleId];
    if (!role) continue;

    const isCountRole  = countRoles.includes(roleId);
    const isSelected   = selectedRoles.has(roleId);
    const count        = roleCounts[roleId] || 0;

    const card = document.createElement('div');
    card.id = `role-toggle-${roleId}`;

    if (isCountRole) {
      // Villager / Mafioso: always-visible count stepper, can't be toggled off
      card.className = 'role-toggle-card selected always-on has-stepper';
      card.innerHTML = `
        <div class="r-icon">${role.icon}</div>
        <div class="r-name">${role.name}</div>
        <div class="r-team">${role.team.charAt(0).toUpperCase() + role.team.slice(1)}</div>
        <div class="r-stepper" onclick="event.stopPropagation()">
          <button class="stepper-btn" onclick="stepRole('${roleId}', -1)">−</button>
          <span class="stepper-val" id="stepper-val-${roleId}">${count}</span>
          <button class="stepper-btn" onclick="stepRole('${roleId}', 1)">+</button>
        </div>
      `;
    } else {
      // Optional role: toggle on/off, then shows stepper when on
      card.className = `role-toggle-card ${isSelected ? 'selected has-stepper' : ''}`;
      card.innerHTML = `
        <div class="r-icon">${role.icon}</div>
        <div class="r-name">${role.name}</div>
        <div class="r-team">${role.team.charAt(0).toUpperCase() + role.team.slice(1)}</div>
        ${isSelected ? `
        <div class="r-stepper" onclick="event.stopPropagation()">
          <button class="stepper-btn" onclick="stepRole('${roleId}', -1)">−</button>
          <span class="stepper-val" id="stepper-val-${roleId}">${count}</span>
          <button class="stepper-btn" onclick="stepRole('${roleId}', 1)">+</button>
        </div>` : ''}
      `;
      card.onclick = () => toggleRoleSelection(roleId, card);
    }

    grid.appendChild(card);
  }

  updateRoleSummary();
}

function stepRole(roleId, delta) {
  const role = ROLES[roleId];
  if (!role) return;
  const isCore = roleId === 'villager' || roleId === 'mafioso';
  const current = roleCounts[roleId] || 0;
  const next = Math.max(isCore ? 1 : 1, current + delta);
  roleCounts[roleId] = next;
  const valEl = document.getElementById(`stepper-val-${roleId}`);
  if (valEl) valEl.textContent = next;
  updateRoleSummary();
}

function toggleRoleSelection(roleId, card) {
  if (selectedRoles.has(roleId)) {
    selectedRoles.delete(roleId);
    delete roleCounts[roleId];
    card.classList.remove('selected', 'has-stepper');
    // Remove stepper from card
    const stepper = card.querySelector('.r-stepper');
    if (stepper) stepper.remove();
    // Remove stepper-val span id
    const old = document.getElementById(`stepper-val-${roleId}`);
    if (old) old.removeAttribute('id');
  } else {
    selectedRoles.add(roleId);
    roleCounts[roleId] = 1;
    card.classList.add('selected', 'has-stepper');
    // Add stepper to card
    const stepperDiv = document.createElement('div');
    stepperDiv.className = 'r-stepper';
    stepperDiv.setAttribute('onclick', 'event.stopPropagation()');
    stepperDiv.innerHTML = `
      <button class="stepper-btn" onclick="stepRole('${roleId}', -1)">−</button>
      <span class="stepper-val" id="stepper-val-${roleId}">1</span>
      <button class="stepper-btn" onclick="stepRole('${roleId}', 1)">+</button>
    `;
    card.appendChild(stepperDiv);
  }
  updateRoleSummary();
}

function updatePlayerCount(val) {
  playerCountValue = parseInt(val);
  document.getElementById('player-count-display').textContent = val;
  applyPreset(playerCountValue);
  updateRoleSummary();
}

function applyPreset(count) {
  const preset = getPresetForCount(count);

  // Reset to preset counts
  selectedRoles = new Set(Object.keys(preset));
  selectedRoles.add('villager');
  selectedRoles.add('mafioso');
  roleCounts = {};

  for (const roleId of selectedRoles) {
    const presetCount = preset[roleId] || 0;
    roleCounts[roleId] = roleId === 'villager' || roleId === 'mafioso'
      ? Math.max(1, presetCount)
      : presetCount > 0 ? presetCount : 1;
  }

  // Auto-balance villagers to fill player count
  const others = Object.entries(roleCounts)
    .filter(([id]) => id !== 'villager')
    .reduce((a, [, v]) => a + v, 0);
  roleCounts.villager = Math.max(1, count - others);

  // Rebuild grid
  buildSetupRoles();
}

function updateRecommendedRoles() { updateRoleSummary(); }

function updateRoleSummary() {
  const el = document.getElementById('recommended-roles');
  if (!el) return;

  const total = Object.values(roleCounts).reduce((a, b) => a + b, 0);
  const needed = playerCountValue;
  const diff = total - needed;

  const parts = Object.entries(roleCounts)
    .filter(([, c]) => c > 0)
    .map(([id, c]) => `${c}× ${ROLES[id]?.name || id}`);

  const status = diff === 0
    ? `<span style="color:var(--accent-green)">✅ Exactly ${total} roles for ${needed} players</span>`
    : diff > 0
      ? `<span style="color:var(--accent-gold)">⚠️ ${total} roles for ${needed} players (+${diff} extra — villagers will be reduced)</span>`
      : `<span style="color:var(--accent-red)">⚠️ ${total} roles for ${needed} players (${Math.abs(diff)} short — villagers will be added)</span>`;

  el.innerHTML = `<strong>🃏 Role Breakdown:</strong> ${parts.join(', ')}<br>${status}`;
}

/* ── Create Game ─────────────────────────────────────────────── */
let localPlayers = []; // For hotspot/offline mode
let gameRoleConfig = {};
let gameSettings = {};
let isOnlineMode = false;
let myPlayerData = {};

/* ── LOCAL / PASS & PLAY MODE ──────────────────────────────────── */
let localModePlayerCount = 6;
let localModeSelectedRoles = new Set(['villager', 'mafioso']);
let localRoleCounts = { villager: 3, mafioso: 1 };
let localModePlayers = [];   // { id, name } objects added by admin
let isLocalMode = false;     // true when playing Local Pass & Play
let _localRevealMode = false; // flag: we came from local cover screen
let localRevealPlayers = [];
let localRevealIndex = 0;
let organizerName = 'Organizer'; // name of the narrator/organizer
let _narratorReadyCallback = null; // callback after organizer taps "Show Action"

function showLocalSetup() {
  isLocalMode = true;
  isOnlineMode = false;
  
  // Load saved players from localStorage
  const saved = localStorage.getItem('mafiaLocalRoster');
  if (saved) {
    try {
      localModePlayers = JSON.parse(saved);
    } catch(e) {
      localModePlayers = [];
    }
  } else {
    localModePlayers = [];
  }
  
  localModePlayerCount = Math.max(6, localModePlayers.length);
  const preset = getPresetForCount(localModePlayerCount);
  localModeSelectedRoles = new Set(Object.keys(preset));
  localModeSelectedRoles.add('villager');
  localModeSelectedRoles.add('mafioso');
  localRoleCounts = {};
  for (const roleId of localModeSelectedRoles) {
    localRoleCounts[roleId] = roleId === 'villager' || roleId === 'mafioso'
      ? Math.max(1, preset[roleId] || 1)
      : preset[roleId] || 1;
  }

  document.getElementById('local-config-step').style.display = 'none';
  document.getElementById('local-players-step').style.display = 'block';

  renderLocalPlayersList();
  updateLocalPlayerProgress();

  showScreen('screen-local');
}

function buildLocalSetupRoles() {
  const grid = document.getElementById('local-roles-grid');
  if (!grid) return;
  grid.innerHTML = '';
  
  const countRoles = ['villager', 'mafioso'];

  for (const roleId of ROLE_ORDER) {
    const role = ROLES[roleId];
    if (!role) continue;

    const isCountRole = countRoles.includes(roleId);
    const isSelected = localModeSelectedRoles.has(roleId);
    const count = localRoleCounts[roleId] || 0;

    const card = document.createElement('div');
    card.id = `local-role-toggle-${roleId}`;

    if (isCountRole) {
      card.className = 'role-toggle-card selected always-on has-stepper';
      card.innerHTML = `
        <div class="r-icon">${role.icon}</div>
        <div class="r-name">${role.name}</div>
        <div class="r-team">${role.team.charAt(0).toUpperCase() + role.team.slice(1)}</div>
        <div class="r-stepper" onclick="event.stopPropagation()">
          <button class="stepper-btn" onclick="stepLocalRole('${roleId}', -1)">−</button>
          <span class="stepper-val" id="local-stepper-val-${roleId}">${count}</span>
          <button class="stepper-btn" onclick="stepLocalRole('${roleId}', 1)">+</button>
        </div>
      `;
    } else {
      card.className = `role-toggle-card ${isSelected ? 'selected has-stepper' : ''}`;
      card.innerHTML = `
        <div class="r-icon">${role.icon}</div>
        <div class="r-name">${role.name}</div>
        <div class="r-team">${role.team.charAt(0).toUpperCase() + role.team.slice(1)}</div>
        ${isSelected ? `
        <div class="r-stepper" onclick="event.stopPropagation()">
          <button class="stepper-btn" onclick="stepLocalRole('${roleId}', -1)">−</button>
          <span class="stepper-val" id="local-stepper-val-${roleId}">${count}</span>
          <button class="stepper-btn" onclick="stepLocalRole('${roleId}', 1)">+</button>
        </div>` : ''}
      `;
      card.onclick = () => toggleLocalRoleSelection(roleId, card);
    }
    grid.appendChild(card);
  }
}

function stepLocalRole(roleId, delta) {
  const role = ROLES[roleId];
  if (!role) return;
  const isCore = roleId === 'villager' || roleId === 'mafioso';
  const current = localRoleCounts[roleId] || 0;
  const next = Math.max(isCore ? 1 : 1, current + delta);
  localRoleCounts[roleId] = next;
  const valEl = document.getElementById(`local-stepper-val-${roleId}`);
  if (valEl) valEl.textContent = next;
}

function toggleLocalRoleSelection(roleId, card) {
  if (localModeSelectedRoles.has(roleId)) {
    localModeSelectedRoles.delete(roleId);
    delete localRoleCounts[roleId];
    card.classList.remove('selected', 'has-stepper');
    const stepper = card.querySelector('.r-stepper');
    if (stepper) stepper.remove();
    const old = document.getElementById(`local-stepper-val-${roleId}`);
    if (old) old.removeAttribute('id');
  } else {
    localModeSelectedRoles.add(roleId);
    localRoleCounts[roleId] = 1;
    card.classList.add('selected', 'has-stepper');
    const stepperDiv = document.createElement('div');
    stepperDiv.className = 'r-stepper';
    stepperDiv.setAttribute('onclick', 'event.stopPropagation()');
    stepperDiv.innerHTML = `
      <button class="stepper-btn" onclick="stepLocalRole('${roleId}', -1)">−</button>
      <span class="stepper-val" id="local-stepper-val-${roleId}">1</span>
      <button class="stepper-btn" onclick="stepLocalRole('${roleId}', 1)">+</button>
    `;
    card.appendChild(stepperDiv);
  }
  updateLocalRecommendedRoles();
}

function updateLocalPlayerCount(val) {
  localModePlayerCount = parseInt(val);
  document.getElementById('local-player-count-display').textContent = val;
  document.getElementById('local-target-count').textContent = val;
  const preset = getPresetForCount(localModePlayerCount);
  localModeSelectedRoles = new Set(Object.keys(preset));
  localModeSelectedRoles.add('villager');
  localModeSelectedRoles.add('mafioso');
  for (const roleId of ROLE_ORDER) {
    const card = document.getElementById(`local-role-toggle-${roleId}`);
    if (card) card.classList.toggle('selected', localModeSelectedRoles.has(roleId));
  }
  updateLocalRecommendedRoles();
}

function goToLocalConfig() {
  if (localModePlayers.length < 5) { showToast('Need at least 5 players!', 'error'); return; }
  
  localModePlayerCount = localModePlayers.length;
  
  // Re-adjust roles to exactly match player count
  const preset = getPresetForCount(localModePlayerCount);
  localModeSelectedRoles = new Set(Object.keys(preset));
  localModeSelectedRoles.add('villager');
  localModeSelectedRoles.add('mafioso');
  localRoleCounts = {};
  for (const roleId of localModeSelectedRoles) {
    localRoleCounts[roleId] = roleId === 'villager' || roleId === 'mafioso'
      ? Math.max(1, preset[roleId] || 1)
      : preset[roleId] || 1;
  }
  // Auto-balance villagers
  const others = Object.entries(localRoleCounts)
    .filter(([id]) => id !== 'villager')
    .reduce((a, [, v]) => a + v, 0);
  localRoleCounts.villager = Math.max(1, localModePlayerCount - others);

  document.getElementById('local-players-step').style.display = 'none';
  document.getElementById('local-config-step').style.display = 'block';
  
  buildLocalSetupRoles();
  updateLocalRecommendedRoles();
}

function addLocalPlayer() {
  const input = document.getElementById('local-add-name');
  const name = input.value.trim();
  if (!name) { showToast('Enter a name!', 'error'); return; }
  if (localModePlayers.length >= 20) { showToast('Max players reached (20)!', 'error'); return; }
  if (localModePlayers.some(p => p.name.toLowerCase() === name.toLowerCase())) {
    showToast('Name already used!', 'error'); return;
  }
  const idx = localModePlayers.length;
  const player = { id: `p${idx}`, name, peerId: `p${idx}`, isHost: idx === 0 };
  localModePlayers.push(player);
  localStorage.setItem('mafiaLocalRoster', JSON.stringify(localModePlayers));
  input.value = '';
  input.focus();
  renderLocalPlayersList();
  updateLocalPlayerProgress();
}

function removeLocalPlayer(idx) {
  localModePlayers.splice(idx, 1);
  localModePlayers.forEach((p, i) => { p.id = `p${i}`; p.peerId = `p${i}`; p.isHost = i === 0; });
  localStorage.setItem('mafiaLocalRoster', JSON.stringify(localModePlayers));
  renderLocalPlayersList();
  updateLocalPlayerProgress();
}

function renderLocalPlayersList() {
  const list = document.getElementById('local-players-list');
  if (!list) return;
  const emojis = ['👤','🧑','👩','🧔','👴','👵','🧕','🧑‍🦱','🧑‍🦰','🧑‍🦳','🧑‍🦲','🙂','😄','🤗','😎','🥸'];
  list.innerHTML = localModePlayers.map((p, i) => `
    <div class="local-player-row">
      <div class="local-player-avatar">${emojis[i % emojis.length]}</div>
      <span class="local-player-name">${p.name}</span>
      ${p.isHost ? '<span class="player-host-tag">👑 HOST</span>' : ''}
      <button class="local-remove-btn" onclick="removeLocalPlayer(${i})" title="Remove">✕</button>
    </div>
  `).join('');
}

function updateLocalPlayerProgress() {
  const count = localModePlayers.length;
  document.getElementById('local-players-added-count').textContent = count;
  // In local mode, target is open-ended — just show filled bar based on a visual max of 16
  const pct = Math.min(100, (count / 16) * 100);
  document.getElementById('local-progress-fill').style.width = `${pct}%`;

  const nextBtn = document.getElementById('btn-next-local-config');
  const hint = document.getElementById('local-start-hint');
  if (nextBtn) {
    const canStart = count >= 5;
    nextBtn.disabled = !canStart;
    if (hint) {
      if (count >= 16) {
        hint.textContent = `Maximum 16 players added! Ready to configure game.`;
      } else if (canStart) {
        hint.textContent = `${count} player${count !== 1 ? 's' : ''} added. Add more or configure game.`;
      } else {
        hint.textContent = `Add at least ${5 - count} more player${5 - count !== 1 ? 's' : ''} to continue.`;
      }
    }
  }
}

function updateLocalRecommendedRoles() {
  const el = document.getElementById('local-recommended-roles');
  if (!el) return;

  const total = Object.values(localRoleCounts).reduce((a, b) => a + b, 0);
  const needed = localModePlayerCount;
  const diff = total - needed;

  const parts = Object.entries(localRoleCounts)
    .filter(([, c]) => c > 0)
    .map(([id, c]) => `${c}× ${ROLES[id]?.name || id}`);

  const status = diff === 0
    ? `<span style="color:var(--accent-green)">✅ Exactly ${total} roles for ${needed} players</span>`
    : diff > 0
      ? `<span style="color:var(--accent-gold)">⚠️ ${total} roles for ${needed} players (+${diff} extra — villagers will be reduced)</span>`
      : `<span style="color:var(--accent-red)">⚠️ ${total} roles for ${needed} players (${Math.abs(diff)} short — villagers will be added)</span>`;

  el.innerHTML = `<strong>🃏 Role Breakdown:</strong> ${parts.join(', ')}<br>${status}`;
}

function startLocalGame() {
  if (localModePlayers.length < 5) { showToast('Need at least 5 players!', 'error'); return; }
  
  organizerName = document.getElementById('local-organizer-name')?.value.trim() || 'Organizer';
  
  gameSettings = {
    dayTime:      parseInt(document.getElementById('local-day-time').value),
    nightTime:    parseInt(document.getElementById('local-night-time').value),
    sheriffBadge: document.getElementById('local-sheriff-badge').checked,
    lastWill:     document.getElementById('local-last-will').checked,
    revealRoles:  document.getElementById('local-reveal-roles').checked,
    playerCount:  localModePlayerCount,
  };
  gameRoleConfig = { ...localRoleCounts };
  
  isLocalMode = true;
  isOnlineMode = false;
  localPlayers = [...localModePlayers];
  
  const others = Object.entries(gameRoleConfig)
    .filter(([id]) => id !== 'villager')
    .reduce((a, [, v]) => a + v, 0);
    
  if (others > localModePlayerCount) {
    showToast(`Too many specific roles (${others}) for ${localModePlayerCount} players!`, 'error');
    return;
  }
  
  gameRoleConfig.villager = Math.max(0, localModePlayerCount - others);
  Game.initGame(localPlayers, gameSettings, gameRoleConfig);
  beginLocalRoleReveal(Game.getPlayers());
}

function beginLocalRoleReveal(players) {
  localRevealPlayers = players;
  localRevealIndex = 0;
  showLocalCoverScreen();
}

function showLocalCoverScreen() {
  const player = localRevealPlayers[localRevealIndex];
  if (!player) {
    // All players revealed — show transition screen before night
    showAllRolesRevealedScreen();
    return;
  }

  // Show State A: Organizer instruction panel
  const stateA = document.getElementById('cover-state-a');
  const stateB = document.getElementById('cover-state-b');
  if (stateA) stateA.style.display = 'block';
  if (stateB) stateB.style.display = 'none';

  const playerNum = localRevealIndex + 1;
  const total = localRevealPlayers.length;

  const instruction = document.getElementById('org-call-instruction');
  if (instruction) instruction.textContent =
    `Call "${player.name}'s" name. Tell everyone else to keep their eyes closed.`;

  const nameEl = document.getElementById('role-cover-player-name');
  if (nameEl) nameEl.textContent = `Player ${playerNum} of ${total}: ${player.name}`;

  const showBtn = document.getElementById('btn-ready-reveal');
  if (showBtn) showBtn.innerHTML = `<span class="btn-icon">👁️</span> Show ${player.name}'s Role`;

  showScreen('screen-role-cover');
}

function readyForReveal() {
  // Organizer tapped "Show Role" — show the role card, switch to State B
  const player = localRevealPlayers[localRevealIndex];
  if (!player) return;
  revealPlayers = [player];
  revealIndex = 0;
  _localRevealMode = true;

  // Pre-update State B so it's ready for nextRoleReveal
  const doneInstr = document.getElementById('org-done-instruction');
  if (doneInstr) doneInstr.textContent =
    `${player.name} has seen their role. Ask them to close their eyes, then tap Next Player.`;

  const nextBtn = document.getElementById('btn-next-player');
  const isLast = localRevealIndex >= localRevealPlayers.length - 1;
  if (nextBtn) nextBtn.innerHTML = isLast
    ? '<span class="btn-icon">🌙</span> Everyone Open Eyes — Start Night'
    : '<span class="btn-icon">➡️</span> Next Player';

  showCurrentReveal();
}

function showAllRolesRevealedScreen() {
  // Show a brief organizer narration before starting night
  const stateA = document.getElementById('cover-state-a');
  const stateB = document.getElementById('cover-state-b');
  if (stateA) stateA.style.display = 'none';
  if (stateB) {
    stateB.style.display = 'block';
    const moon = stateB.querySelector('.role-cover-moon');
    if (moon) moon.textContent = '🌙';
    const instr = document.getElementById('org-done-instruction');
    if (instr) instr.textContent = 'All players have seen their roles! Keep everyone\'s eyes closed — Night 1 is about to begin.';
    const nextBtn = document.getElementById('btn-next-player');
    if (nextBtn) {
      nextBtn.innerHTML = '<span class="btn-icon">🌙</span> Begin Night 1';
      nextBtn.onclick = () => startNightPhase();
    }
  }
  showScreen('screen-role-cover');
}


function createGame() {
  const hostName = document.getElementById('host-name').value.trim();
  if (!hostName) { showToast('Please enter your name!', 'error'); return; }

  const count = parseInt(document.getElementById('player-count').value);

  // Build role config from roleCounts (set by the stepper UI)
  gameRoleConfig = {};
  for (const [roleId, roleCount] of Object.entries(roleCounts)) {
    if (roleCount > 0) gameRoleConfig[roleId] = roleCount;
  }

  // Auto-balance: if total doesn't match player count, adjust villagers
  const totalRoles = Object.values(gameRoleConfig).reduce((a, b) => a + b, 0);
  if (totalRoles !== count) {
    const others = Object.entries(gameRoleConfig)
      .filter(([id]) => id !== 'villager')
      .reduce((a, [, v]) => a + v, 0);
    gameRoleConfig.villager = Math.max(1, count - others);
  }

  gameSettings = {
    dayTime:     parseInt(document.getElementById('day-time').value),
    nightTime:   parseInt(document.getElementById('night-time').value),
    sheriffBadge: document.getElementById('sheriff-badge').checked,
    lastWill:    document.getElementById('last-will').checked,
    revealRoles: document.getElementById('reveal-roles').checked,
    playerCount: count,
  };

  myPlayerData = { id: 'host', name: hostName, peerId: 'host', isHost: true };
  localPlayers = [myPlayerData];

  // Create online room
  showToast('Creating room...');

  Network.createRoom((result) => {
    if (result.success) {
      isOnlineMode = true;
      showLobby(result.roomCode, true);
    } else {
      showToast('Network error. Using offline mode.');
      // Offline mode - pass device around
      showOfflineLobby(count);
    }
  });
}

