/* ================================================================
   ui.js – UI Controller
   Manages: screens, setup, lobby, role reveal, night, day, vote,
            elimination, win, rules, particles, toasts, modals
   ================================================================ */

/* ── Screen Management ─────────────────────────────────────────── */
let currentScreen = 'screen-loading';

function showScreen(id) {
  const prev = document.querySelector('.screen.active');
  if (prev) {
    prev.classList.remove('active');
  }
  const next = document.getElementById(id);
  if (next) {
    next.classList.add('active');
    currentScreen = id;
  }
}

/* ── Loading Screen ─────────────────────────────────────────── */
window.addEventListener('DOMContentLoaded', () => {
  createParticles();
  applyPreset(playerCountValue); // populates roleCounts AND builds the setup grid
  buildRulesRoles();
  buildSettingsGrids();
  Network.init(handleNetworkMessage);

  // Auto-advance loading screen
  setTimeout(() => {
    showScreen('screen-home');
  }, 2200);
});

/* ── Particles ──────────────────────────────────────────────── */
function createParticles() {
  const container = document.getElementById('particles');
  if (!container) return;
  for (let i = 0; i < 35; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    p.style.cssText = `
      left: ${Math.random() * 100}%;
      top: ${Math.random() * 100}%;
      --dur: ${4 + Math.random() * 6}s;
      --delay: ${-Math.random() * 6}s;
      width: ${1 + Math.random() * 3}px;
      height: ${1 + Math.random() * 3}px;
      opacity: ${0.2 + Math.random() * 0.6};
    `;
    container.appendChild(p);
  }
}

/* ── Toast Notifications ────────────────────────────────────── */
function showToast(msg, type = 'default') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3200);
}

/* ── Modal ──────────────────────────────────────────────────── */
function showModal({ header, body, buttons }) {
  document.getElementById('modal-header').innerHTML = header || '';
  document.getElementById('modal-body').innerHTML   = body   || '';

  const footer = document.getElementById('modal-footer');
  footer.innerHTML = '';
  (buttons || []).forEach(btn => {
    const b = document.createElement('button');
    b.className = `btn ${btn.class || 'btn-ghost'}`;
    b.textContent = btn.text;
    b.onclick = () => {
      closeModal();
      if (btn.action) btn.action();
    };
    footer.appendChild(b);
  });

  document.getElementById('modal-overlay').style.display = 'flex';
}

function closeModal() {
  document.getElementById('modal-overlay').style.display = 'none';
}

document.getElementById('modal-overlay')?.addEventListener('click', (e) => {
  if (e.target === document.getElementById('modal-overlay')) closeModal();
});

/* ── Dynamic Settings Renderer ───────────────────────────────── */
function buildSettingsGrids() {
  const localContainer = document.getElementById('local-settings-grid');
  const onlineContainer = document.getElementById('online-settings-grid');
  
  if (localContainer) localContainer.innerHTML = renderSettingsHTML(true);
  if (onlineContainer) onlineContainer.innerHTML = renderSettingsHTML(false);
}

function renderSettingsHTML(isLocal) {
  return Object.entries(SETTINGS_CONFIG).map(([key, config]) => {
    const id = isLocal ? `local-${config.id}` : config.id;
    if (config.type === 'select') {
      const optionsHTML = config.options.map(opt => {
        const selected = opt.value === config.default ? 'selected' : '';
        return `<option value="${opt.value}" ${selected}>${opt.label}</option>`;
      }).join('');
      
      return `
        <div class="setting-item">
          <div class="setting-label-block">
            <span class="setting-label">${config.label}</span>
            <span class="setting-desc">${config.desc}</span>
          </div>
          <select id="${id}" class="select-field">
            ${optionsHTML}
          </select>
        </div>
      `;
    } else if (config.type === 'toggle') {
      const checked = config.default ? 'checked' : '';
      return `
        <div class="setting-item toggle-item">
          <div class="setting-label-block">
            <span class="setting-label">${config.label}</span>
            <span class="setting-desc">${config.desc}</span>
          </div>
          <label class="toggle"><input type="checkbox" id="${id}" ${checked} /><span class="toggle-slider"></span></label>
        </div>
      `;
    }
    return '';
  }).join('');
}

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
let localModeSelectedRoles = new Set(['villager', 'mafioso', 'detective', 'doctor']);
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
  localModePlayers = [];
  localModePlayerCount = 6;
  localModeSelectedRoles = new Set(['villager', 'mafioso', 'detective', 'doctor']);

  document.getElementById('local-config-step').style.display = 'block';
  document.getElementById('local-players-step').style.display = 'none';

  buildLocalSetupRoles();
  updateLocalRecommendedRoles();

  const slider = document.getElementById('local-player-count');
  if (slider) { slider.value = 6; }
  document.getElementById('local-player-count-display').textContent = 6;
  document.getElementById('local-target-count').textContent = 6;

  showScreen('screen-local');
}

function buildLocalSetupRoles() {
  const grid = document.getElementById('local-roles-grid');
  if (!grid) return;
  grid.innerHTML = '';
  const alwaysOn = ['villager', 'mafioso'];
  for (const roleId of ROLE_ORDER) {
    const role = ROLES[roleId];
    if (!role) continue;
    const card = document.createElement('div');
    card.className = `role-toggle-card ${localModeSelectedRoles.has(roleId) ? 'selected' : ''} ${alwaysOn.includes(roleId) ? 'always-on' : ''}`;
    card.id = `local-role-toggle-${roleId}`;
    card.innerHTML = `
      <div class="r-icon">${role.icon}</div>
      <div class="r-name">${role.name}</div>
      <div class="r-team">${role.team.charAt(0).toUpperCase() + role.team.slice(1)}</div>
    `;
    if (!alwaysOn.includes(roleId)) {
      card.onclick = () => toggleLocalRoleSelection(roleId, card);
    }
    grid.appendChild(card);
  }
}

function toggleLocalRoleSelection(roleId, card) {
  if (localModeSelectedRoles.has(roleId)) {
    localModeSelectedRoles.delete(roleId);
    card.classList.remove('selected');
  } else {
    localModeSelectedRoles.add(roleId);
    card.classList.add('selected');
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

function updateLocalRecommendedRoles() {
  const el = document.getElementById('local-recommended-roles');
  if (!el) return;
  const preset = getPresetForCount(localModePlayerCount);
  const roleNames = Object.entries(preset)
    .map(([id, count]) => `${count}x ${ROLES[id]?.name || id}`)
    .join(', ');
  el.innerHTML = `<strong>💡 Suggested for ${localModePlayerCount} players:</strong> ${roleNames}`;
}

function goToLocalPlayerAdd() {
  // Save organizer name
  organizerName = document.getElementById('local-organizer-name')?.value.trim() || 'Organizer';

  gameSettings = {
    dayTime:      parseInt(document.getElementById('local-day-time').value),
    nightTime:    parseInt(document.getElementById('local-night-time').value),
    sheriffBadge: document.getElementById('local-sheriff-badge').checked,
    lastWill:     document.getElementById('local-last-will').checked,
    playerCount:  localModePlayerCount,
  };
  const preset = getPresetForCount(localModePlayerCount);
  gameRoleConfig = {};
  for (const roleId of localModeSelectedRoles) {
    const role = ROLES[roleId];
    if (!role) continue;
    const presetCount = preset[roleId] || 0;
    const baseCount = roleId === 'villager' ? Math.max(1, presetCount)
                    : roleId === 'mafioso'  ? Math.max(1, presetCount)
                    : presetCount;
    if (baseCount > 0) gameRoleConfig[roleId] = baseCount;
  }
  const others = Object.entries(gameRoleConfig)
    .filter(([id]) => id !== 'villager')
    .reduce((a, [, v]) => a + v, 0);
  gameRoleConfig.villager = Math.max(1, localModePlayerCount - others);

  localModePlayers = [];
  document.getElementById('local-players-list').innerHTML = '';
  document.getElementById('local-config-step').style.display = 'none';
  document.getElementById('local-players-step').style.display = 'block';
  updateLocalPlayerProgress();
  document.getElementById('local-add-name').value = '';
  setTimeout(() => document.getElementById('local-add-name')?.focus(), 100);
}

function addLocalPlayer() {
  const input = document.getElementById('local-add-name');
  const name = input.value.trim();
  if (!name) { showToast('Enter a name!', 'error'); return; }
  if (localModePlayers.length >= localModePlayerCount) { showToast('Max players reached!', 'error'); return; }
  if (localModePlayers.some(p => p.name.toLowerCase() === name.toLowerCase())) {
    showToast('Name already used!', 'error'); return;
  }
  const idx = localModePlayers.length;
  const player = { id: `p${idx}`, name, peerId: `p${idx}`, isHost: idx === 0 };
  localModePlayers.push(player);
  input.value = '';
  input.focus();
  renderLocalPlayersList();
  updateLocalPlayerProgress();
}

function removeLocalPlayer(idx) {
  localModePlayers.splice(idx, 1);
  localModePlayers.forEach((p, i) => { p.id = `p${i}`; p.peerId = `p${i}`; p.isHost = i === 0; });
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
  const target = localModePlayerCount;
  document.getElementById('local-players-added-count').textContent = count;
  const pct = Math.min(100, (count / target) * 100);
  document.getElementById('local-progress-fill').style.width = `${pct}%`;
  const startBtn = document.getElementById('btn-start-local');
  const hint = document.getElementById('local-start-hint');
  if (startBtn) {
    const canStart = count >= 5;
    startBtn.disabled = !canStart;
    if (hint) {
      if (count >= target) {
        hint.textContent = `All ${target} players added! Ready to start.`;
      } else if (canStart) {
        hint.textContent = `${count} players added. Add ${target - count} more or start now.`;
      } else {
        hint.textContent = `Add at least ${5 - count} more player${5 - count !== 1 ? 's' : ''} to start.`;
      }
    }
  }
}

function startLocalGame() {
  if (localModePlayers.length < 5) { showToast('Need at least 5 players!', 'error'); return; }
  isLocalMode = true;
  isOnlineMode = false;
  localPlayers = [...localModePlayers];
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
    // All players revealed — show "everyone open eyes" narration before night
    showAllOpenEyesScreen();
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

function showAllOpenEyesScreen() {
  // Show a brief organizer narration before starting night
  const stateA = document.getElementById('cover-state-a');
  const stateB = document.getElementById('cover-state-b');
  if (stateA) stateA.style.display = 'none';
  if (stateB) {
    stateB.style.display = 'block';
    const moon = stateB.querySelector('.role-cover-moon');
    if (moon) moon.textContent = '🌅';
    const instr = document.getElementById('org-done-instruction');
    if (instr) instr.textContent = 'All players have seen their roles! Tell everyone to open their eyes — Day 1 is about to begin.';
    const nextBtn = document.getElementById('btn-next-player');
    if (nextBtn) {
      nextBtn.innerHTML = '<span class="btn-icon">☀️</span> Begin Day 1';
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

/* ── Join Game ───────────────────────────────────────────────── */
function joinGame() {
  const name = document.getElementById('join-name').value.trim();
  const code = document.getElementById('room-code-input').value.trim().toUpperCase();

  if (!name) { showToast('Enter your name!', 'error'); return; }
  if (code.length !== 6) { showToast('Enter a 6-digit room code!', 'error'); return; }

  myPlayerData = { id: generatePlayerId(), name, peerId: null, isHost: false };
  showToast('Connecting to room...');

  Network.joinRoom(code, name, (result) => {
    if (result.success) {
      isOnlineMode = true;
      showLobby(code, false);
      Network.sendToHost({ type: 'player_join', player: myPlayerData });
    } else {
      showToast(result.error || 'Could not connect!', 'error');
    }
  });
}

function generatePlayerId() {
  return 'p_' + Math.random().toString(36).substr(2, 8);
}

/* ── Lobby ───────────────────────────────────────────────────── */
function showLobby(roomCode, hosting) {
  showScreen('screen-lobby');
  document.getElementById('lobby-room-code').textContent = roomCode;
  document.getElementById('host-controls').style.display = hosting ? 'block' : 'none';
  document.getElementById('waiting-msg').style.display  = hosting ? 'none'  : 'block';

  // Add host player
  if (hosting) {
    updateLobbyPlayers([myPlayerData]);
    generateQRCode(roomCode);
  }
}

function showOfflineLobby(count) {
  // Collect all player names locally
  const names = [];
  const addPlayersModal = (index) => {
    if (index >= count) {
      // Start game with all players
      startOfflineGame(names);
      return;
    }
    showModal({
      header: `Player ${index + 1} of ${count}`,
      body: `<input type="text" id="modal-name-input" class="input-field" placeholder="Enter your name..." maxlength="20" style="margin-top:0.5rem" />`,
      buttons: [
        {
          text: 'Confirm',
          class: 'btn-primary',
          action: () => {
            const val = document.getElementById('modal-name-input')?.value.trim();
            if (!val) { showModal({ header: 'Name required', body: 'Please enter a name.', buttons: [{ text: 'OK', action: () => addPlayersModal(index) }] }); return; }
            names.push(val);
            addPlayersModal(index + 1);
          }
        }
      ]
    });

    // Focus input after modal shown
    setTimeout(() => document.getElementById('modal-name-input')?.focus(), 100);
  };

  showScreen('screen-lobby');
  addPlayersModal(0);
}

function generateQRCode(roomCode) {
  const qrSection = document.getElementById('qr-section');
  if (!qrSection || !window.QRCode) return;
  qrSection.innerHTML = '';
  try {
    new QRCode(qrSection, {
      text: roomCode,
      width: 120,
      height: 120,
      colorDark: '#ffffff',
      colorLight: '#1e0f35',
      correctLevel: QRCode.CorrectLevel.M,
    });
  } catch(e) {
    console.warn('QR generation failed:', e);
  }
}

function updateLobbyPlayers(players) {
  const list = document.getElementById('lobby-players-list');
  if (!list) return;

  list.innerHTML = '';
  const targetCount = gameSettings.playerCount || playerCountValue;
  const playerEmojis = ['👤', '🧑', '👩', '🧔', '👴', '👵', '🧕', '🧑‍🦱', '🧑‍🦰', '🧑‍🦳', '🧑‍🦲', '🙂', '😄', '🤗', '😎', '🥸'];

  players.forEach((p, i) => {
    const slot = document.createElement('div');
    slot.className = 'player-slot';
    slot.innerHTML = `
      <div class="player-avatar">${playerEmojis[i % playerEmojis.length]}</div>
      <span class="player-name">${p.name}</span>
      ${p.isHost ? '<span class="player-host-tag">👑 HOST</span>' : ''}
    `;
    list.appendChild(slot);
  });

  // Empty slots
  for (let i = players.length; i < targetCount; i++) {
    const slot = document.createElement('div');
    slot.className = 'player-slot empty';
    slot.innerHTML = `
      <div class="player-avatar" style="font-size:1rem">···</div>
      <span class="player-name" style="color:var(--text-muted)">Waiting...</span>
    `;
    list.appendChild(slot);
  }

  const count = players.length;
  document.getElementById('lobby-player-count').textContent = count;
  const needed = Math.max(0, (gameSettings.playerCount || 5) - count);
  document.getElementById('need-count').textContent = needed;
  document.getElementById('players-needed').style.display = needed > 0 ? 'block' : 'none';

  // Enable start button
  const startBtn = document.getElementById('btn-start-game');
  const startHint = document.getElementById('start-hint');
  if (startBtn) {
    const canStart = count >= 5;
    startBtn.disabled = !canStart;
    if (startHint) startHint.textContent = canStart ? `Ready! ${count} players joined.` : `Need at least ${5 - count} more players.`;
  }
}

function copyRoomCode() {
  const code = document.getElementById('lobby-room-code')?.textContent;
  if (navigator.clipboard) {
    navigator.clipboard.writeText(code).then(() => showToast('Room code copied! 📋'));
  } else {
    showToast(`Room code: ${code}`);
  }
}

function leaveLobby() {
  Network.disconnect();
  showScreen('screen-home');
}

/* ── Network Message Handler ────────────────────────────────── */
function handleNetworkMessage(peerId, data) {
  if (!data || !data.type) return;

  if (Network.getIsHost()) {
    handleHostMessage(peerId, data);
  } else {
    handleClientMessage(peerId, data);
  }
}

function handleHostMessage(peerId, data) {
  switch (data.type) {
    case 'player_join':
      const player = { ...data.player, peerId };
      localPlayers.push(player);
      updateLobbyPlayers(localPlayers);
      Network.broadcast({ type: 'lobby_update', players: localPlayers });
      showToast(`${player.name} joined!`);
      break;

    case 'player_left':
      localPlayers = localPlayers.filter(p => p.peerId !== peerId);
      updateLobbyPlayers(localPlayers);
      Network.broadcast({ type: 'lobby_update', players: localPlayers });
      break;

    case 'night_action_submitted':
      Game.submitNightAction(data.actorId, data.targetId, data.actionType);
      checkAllNightActionsComplete();
      break;

    case 'vote_cast':
      Game.castVote(data.voterId, data.targetId);
      broadcastVoteUpdate();
      break;

    case 'nomination':
      Game.nominatePlayer(data.targetId);
      Network.broadcast({ type: 'nomination_update', nominations: Game.getState().nominatedPlayers });
      break;
  }
}

function handleClientMessage(peerId, data) {
  switch (data.type) {
    case 'lobby_update':
      updateLobbyPlayers(data.players);
      break;

    case 'game_start':
      receiveGameStart(data);
      break;

    case 'your_role':
      receiveYourRole(data);
      break;

    case 'night_start':
      receiveNightStart(data);
      break;

    case 'day_start':
      receiveDayStart(data);
      break;

    case 'vote_start':
      receiveVoteStart(data);
      break;

    case 'vote_update':
      receiveVoteUpdate(data);
      break;

    case 'nomination_update':
      // Update local nomination display
      break;

    case 'elimination':
      receiveElimination(data);
      break;

    case 'win':
      receiveWin(data);
      break;
  }
}

/* ── Start Game ─────────────────────────────────────────────── */
function startGame() {
  if (localPlayers.length < 5) {
    showToast('Need at least 5 players!', 'error');
    return;
  }

  const players = localPlayers.map((p, i) => ({
    id: p.id || `p${i}`,
    name: p.name,
    peerId: p.peerId || p.id,
    isHost: p.isHost || false,
  }));

  // Use gameRoleConfig set during setup; if empty fall back to preset
  let config = Object.keys(gameRoleConfig).length > 0 ? { ...gameRoleConfig } : {};
  if (Object.keys(config).length === 0) {
    const preset = getPresetForCount(players.length);
    Object.assign(config, preset);
  }

  // Always ensure villagers fill any gap
  const others = Object.entries(config).filter(([id]) => id !== 'villager').reduce((a, [, v]) => a + v, 0);
  if (!config.villager || (config.villager + others) !== players.length) {
    config.villager = Math.max(1, players.length - others);
  }

  const state = Game.initGame(players, gameSettings, config);

  // Send game state to all clients (without revealing roles)
  Network.broadcast({
    type: 'game_start',
    players: state.players.map(p => ({ id: p.id, name: p.name, peerId: p.peerId, alive: true })),
    settings: gameSettings,
  });

  // Send each player their role privately
  for (const player of state.players) {
    if (player.peerId && player.peerId !== 'host') {
      Network.send(player.peerId, {
        type: 'your_role',
        role: player.role,
        mafiaTeam: player.role.team === 'mafia'
          ? state.players.filter(p => p.role.team === 'mafia').map(p => ({ id: p.id, name: p.name, role: p.role.name }))
          : null,
        executionerTarget: player.role.id === 'executioner' ? state.executionerTarget : null,
      });
    }
  }

  // Online mode: host only flips their own card — clients get 'your_role' privately
  if (isOnlineMode) {
    const hostPlayer = state.players.find(p => p.isHost || p.peerId === 'host');
    beginRoleReveal(hostPlayer ? [hostPlayer] : [state.players[0]]);
  } else {
    beginRoleReveal(state.players);
  }
}

function startOfflineGame(names) {
  const players = names.map((name, i) => ({ id: `p${i}`, name, peerId: `p${i}`, isHost: i === 0 }));
  localPlayers = players;

  const preset = getPresetForCount(players.length);
  const others = Object.entries(preset).filter(([id]) => id !== 'villager').reduce((a, [, v]) => a + v, 0);
  const config = { ...preset, villager: Math.max(1, players.length - others) };

  Game.initGame(players, gameSettings, config);
  beginRoleReveal(Game.getPlayers());
}

function receiveGameStart(data) {
  // Client: store settings + player list — role reveal arrives via 'your_role' next
  gameSettings = data.settings || {};
  localPlayers  = data.players  || [];
  // Don't switch screen here; receiveYourRole() will trigger role reveal
}

function receiveYourRole(data) {
  myRole = data.role;
  // Build a single-entry reveal list so the client sees only their own card
  const me = { id: myPlayerData.id, name: myPlayerData.name, role: data.role };
  revealPlayers = [me];
  revealIndex   = 0;
  showCurrentReveal();
}

/* ── Role Reveal ─────────────────────────────────────────────── */
let revealPlayers = [];
let revealIndex  = 0;
let myRole = null;

function beginRoleReveal(players) {
  revealPlayers = players;
  revealIndex   = 0;
  showCurrentReveal();
}

function showCurrentReveal() {
  const player = revealPlayers[revealIndex];
  if (!player) {
    // All revealed – start first night
    startNightPhase();
    return;
  }

  showScreen('screen-role-reveal');

  const card = document.getElementById('role-card');
  const inner = document.getElementById('role-card-inner');
  const footer = document.getElementById('role-reveal-footer');

  // Reset card
  card.classList.remove('flipped');
  footer.style.display = 'none';

  // Set up card content (hidden until flip)
  const roleBack = document.getElementById('role-card-back');
  const role = player.role;
  const teamClass = `team-${role.team}`;

  roleBack.style.background = `linear-gradient(135deg, #1a0f2e, ${role.color}22)`;
  roleBack.style.borderColor = role.color + '55';

  document.getElementById('reveal-icon').textContent = role.icon;
  document.getElementById('reveal-name').textContent = role.name;

  const teamEl = document.getElementById('reveal-team');
  teamEl.textContent = role.team.charAt(0).toUpperCase() + role.team.slice(1);
  teamEl.className = `role-team ${teamClass}`;

  document.getElementById('reveal-desc').textContent = role.description;
  const abilityEl = document.getElementById('reveal-ability');
  abilityEl.textContent = role.ability;
  abilityEl.style.display = role.ability ? 'block' : 'none';

  // Add player name prompt
  const front = document.querySelector('.role-card-front p');
  if (front) front.textContent = `${player.name}, tap to reveal your role`;

  // Flip on click
  card.onclick = () => {
    if (!card.classList.contains('flipped')) {
      card.classList.add('flipped');
      setTimeout(() => {
        const isLast = revealIndex >= revealPlayers.length - 1;
        if (_localRevealMode) {
          // Local mode: always show "Next Player" button (or "Done — Start Night" if truly last player overall)
          const isAbsoluteLast = localRevealIndex >= localRevealPlayers.length - 1;
          footer.style.display = 'flex';
          const nextBtn = footer.querySelector('button');
          if (nextBtn) {
            nextBtn.textContent = isAbsoluteLast ? '🌙 Start Night Phase' : '➡️ Next Player';
          }
        } else {
          footer.style.display = isLast ? 'none' : 'flex';
          if (isLast) {
            if (!isOnlineMode || Network.getIsHost()) {
              // Offline or host: auto-advance to night after short delay
              setTimeout(startNightPhase, 2000);
            } else {
              // Online client: wait quietly — host will broadcast night_start
              const front = document.querySelector('.role-card-front p');
              if (front) front.textContent = 'Role memorised! Waiting for the game to begin...';
            }
          }
        }
      }, 600);
    }
  };

}

function nextRoleReveal() {
  if (_localRevealMode) {
    // Local mode: show State B (organizer "close eyes" instruction) on cover screen
    // before advancing to next player — organizer must confirm player closed eyes
    const stateA = document.getElementById('cover-state-a');
    const stateB = document.getElementById('cover-state-b');
    if (stateA) stateA.style.display = 'none';
    if (stateB) stateB.style.display = 'block';

    // Fix State B moon back to check mark (readyForReveal may have changed it)
    const moon = stateB?.querySelector('.role-cover-moon');
    if (moon) moon.textContent = '✅';

    // Update the State B Next button to call nextRoleRevealConfirm
    const nextBtn = document.getElementById('btn-next-player');
    if (nextBtn) {
      const isLast = localRevealIndex >= localRevealPlayers.length - 1;
      nextBtn.innerHTML = isLast
        ? '<span class="btn-icon">🌙</span> Start Night Phase'
        : '<span class="btn-icon">➡️</span> Next Player';
      nextBtn.onclick = () => nextRoleRevealConfirm();
    }

    showScreen('screen-role-cover');
    _localRevealMode = false;
  } else {
    revealIndex++;
    if (revealIndex < revealPlayers.length) {
      showCurrentReveal();
    } else {
      startNightPhase();
    }
  }
}

// Called when organizer taps "Next Player" from State B
function nextRoleRevealConfirm() {
  localRevealIndex++;
  // Reset btn-next-player onclick back to default
  const nextBtn = document.getElementById('btn-next-player');
  if (nextBtn) nextBtn.onclick = () => nextRoleReveal();
  showLocalCoverScreen();
}




/* ── Night Phase ─────────────────────────────────────────────── */
let nightTimerInterval = null;
let selectedNightTarget = null;
let nightActionQueue = [];
let nightQueueIdx = 0;

function startNightPhase() {
  nightActionQueue = Game.startNight();
  nightQueueIdx = 0;
  selectedNightTarget = null;

  showScreen('screen-night');
  document.getElementById('night-num').textContent = Game.getNightCount();
  document.getElementById('night-instructions').textContent = 'The town sleeps. Night roles will act one by one...';

  buildNightActionList();

  // In online mode: broadcast night data so each client can show their own action panel
  if (isOnlineMode && Network.getIsHost()) {
    const aliveList = Game.getAlivePlayers().map(p => ({ id: p.id, name: p.name, peerId: p.peerId }));
    const actorList = nightActionQueue.map(a => {
      const actor = Game.getPlayer(a.playerId);
      return {
        playerId:        a.playerId,
        peerId:          actor ? actor.peerId : null,
        actionType:      a.actionType,
        isTeamAction:    a.isTeamAction || false,
        roleIcon:        actor ? actor.role.icon        : '🌙',
        roleName:        actor ? actor.role.name        : 'Unknown',
        rolePrompt:      actor ? actor.role.prompt      : 'Choose a target',
        roleCanSelfTarget: actor ? actor.role.canSelfTarget : false,
      };
    });
    Network.broadcast({
      type:         'night_start',
      nightNum:     Game.getNightCount(),
      alivePlayers: aliveList,
      actors:       actorList,
    });
  }

  processNextNightActor();
}

function buildNightActionList() {
  const container = document.getElementById('night-actions');
  container.innerHTML = '';

  nightActionQueue.forEach((action, i) => {
    const player = Game.getPlayer(action.playerId);
    const role = player?.role;
    const item = document.createElement('div');
    item.className = 'night-action-item';
    item.id = `night-item-${i}`;
    item.innerHTML = `
      <span>${role?.icon || '🌙'}</span>
      <span>${action.isTeamAction ? 'Mafia' : (role?.name || 'Unknown')}</span>
    `;
    container.appendChild(item);
  });
}

function processNextNightActor() {
  if (nightQueueIdx >= nightActionQueue.length) {
    if (isOnlineMode && Network.getIsHost()) {
      // Online mode: show narrator panel so host waits for clients before resolving
      document.getElementById('action-panel').style.display = 'none';
      document.getElementById('narrator-panel').style.display = 'flex';
      document.getElementById('night-instructions').textContent =
        '⌛ Waiting for all players to finish their night actions... then press Continue.';
    } else if (isOnlineMode && !Network.getIsHost()) {
      // Online client: all local actions done — just wait for host to broadcast dawn/day
      document.getElementById('action-panel').style.display = 'none';
      document.getElementById('night-instructions').textContent =
        '✅ Done! Waiting for the host to resolve the night...';
    } else if (isLocalMode) {
      // Local mode: show organizer "resolve night" narrator step
      hideNarratorStep();
      document.getElementById('action-panel').style.display = 'none';
      document.getElementById('narrator-panel').style.display = 'flex';
      document.getElementById('night-instructions').textContent =
        '✅ All roles have acted. Tap Continue to reveal the night results.';
    } else {
      finishNightPhase();
    }
    return;
  }

  const action = nightActionQueue[nightQueueIdx];
  const player = Game.getPlayer(action.playerId);
  if (!player || !player.alive) {
    nightQueueIdx++;
    processNextNightActor();
    return;
  }

  // Online mode: skip remote players (they act on their own device)
  if (isOnlineMode && Network.getIsHost() && player.peerId !== 'host' && player.peerId !== myPlayerData.peerId) {
    nightQueueIdx++;
    processNextNightActor();
    return;
  }

  // Mark current in queue
  document.querySelectorAll('.night-action-item').forEach((el, i) => {
    el.className = `night-action-item ${i < nightQueueIdx ? 'done' : i === nightQueueIdx ? 'active' : ''}`;
  });

  // Local/Organizer mode: show narrator step BEFORE action panel
  if (isLocalMode) {
    const roleName = action.isTeamAction ? 'Mafia' : (player.role?.name || 'Unknown');
    const announcement = getNightAnnouncement(action.actionType, roleName);
    showNightNarratorStep(announcement, roleName, player.role?.icon || '🌙', () => {
      hideNarratorStep();
      showNightActionPanel(action, player);
    });
    return;
  }

  showNightActionPanel(action, player);
}

function showNightActionPanel(action, player) {
  const panel = document.getElementById('action-panel');
  const narrator = document.getElementById('narrator-panel');
  panel.style.display = 'block';
  narrator.style.display = 'none';

  document.getElementById('action-role-icon').textContent = player.role.icon;
  document.getElementById('action-role-name').textContent = action.isTeamAction ? 'Mafia' : player.role.name;
  document.getElementById('action-prompt').textContent    = player.role.prompt || 'Choose a target';

  // Populate target list
  const targetList = document.getElementById('target-list');
  targetList.innerHTML = '';
  selectedNightTarget = null;
  document.getElementById('btn-confirm-action').disabled = true;

  const alive = Game.getAlivePlayers();
  const filteredTargets = alive.filter(p => {
    if (!player.role.canSelfTarget && p.id === player.id) return false;
    // Mafia can't target each other
    if (action.actionType === 'mafia_kill' && p.role.team === 'mafia') return false;
    return true;
  });

  const emojis = ['🧑', '👩', '🧔', '👴', '👵', '🧕', '🧑‍🦱'];

  filteredTargets.forEach((target, i) => {
    const btn = document.createElement('button');
    btn.className = 'target-btn';
    btn.dataset.targetId = target.id;
    btn.innerHTML = `
      <div class="t-avatar">${emojis[i % emojis.length]}</div>
      <span>${target.name}</span>
    `;
    btn.onclick = () => selectNightTarget(target.id, btn);
    targetList.appendChild(btn);
  });

  // Timer
  startNightTimer(gameSettings.nightTime || 30);
}

function selectNightTarget(targetId, btn) {
  document.querySelectorAll('.target-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  selectedNightTarget = targetId;
  document.getElementById('btn-confirm-action').disabled = false;
}

function confirmNightAction() {
  if (!selectedNightTarget) return;

  clearNightTimer();

  const action = nightActionQueue[nightQueueIdx];

  if (Network.getIsHost() || !isOnlineMode) {
    // Host / offline: record action locally then advance queue
    Game.submitNightAction(action.playerId, selectedNightTarget, action.actionType);

    if (isLocalMode) {
      // Show post-action narration: "close eyes"
      const roleName = action.isTeamAction ? 'Mafia' : (Game.getPlayer(action.playerId)?.role?.name || 'Unknown');
      hideNightActionPanel();
      showPostActionNarration(roleName, () => {
        nightQueueIdx++;
        processNextNightActor();
      });
      return;
    }

    nightQueueIdx++;
    hideNightActionPanel();
    processNextNightActor();
  } else {
    // Online client: send to host and wait — DO NOT advance queue locally
    Network.sendToHost({
      type:       'night_action_submitted',
      actorId:    action.playerId,
      targetId:   selectedNightTarget,
      actionType: action.actionType,
    });
    hideNightActionPanel();
    document.getElementById('night-instructions').textContent =
      '✅ Action submitted! Waiting for dawn...';
  }
}

function skipNightAction() {
  clearNightTimer();
  if (Network.getIsHost() || !isOnlineMode) {
    if (isLocalMode) {
      const action = nightActionQueue[nightQueueIdx];
      const roleName = action
        ? (action.isTeamAction ? 'Mafia' : (Game.getPlayer(action.playerId)?.role?.name || 'Unknown'))
        : 'Unknown';
      hideNightActionPanel();
      showPostActionNarration(roleName, () => {
        nightQueueIdx++;
        processNextNightActor();
      });
      return;
    }
    nightQueueIdx++;
    hideNightActionPanel();
    processNextNightActor();
  } else {
    // Online client: just hide panel and wait
    hideNightActionPanel();
    document.getElementById('night-instructions').textContent =
      '⏭️ Skipped. Waiting for dawn...';
  }
}

function hideNightActionPanel() {
  document.getElementById('action-panel').style.display = 'none';
}

/* ── Organizer Night Narrator Helpers ──────────────────────── */

// Maps action type → what organizer announces
function getNightAnnouncement(actionType, roleName) {
  const map = {
    mafia_kill:              'Mafia, open your eyes',
    heal:                    'Doctor, open your eyes',
    investigate:             'Detective, open your eyes',
    escort:                  'Escort, open your eyes',
    consort:                 'Consort, open your eyes',
    protect:                 'Bodyguard, open your eyes',
    consigliere_investigate: 'Consigliere, open your eyes',
    vigilante_kill:          'Vigilante, open your eyes',
    sk_kill:                 'Serial Killer, open your eyes',
    survivor_vest:           'Survivor, activate your vest if you wish',
    executioner:             'Executioner, open your eyes',
  };
  return map[actionType] || `${roleName}, open your eyes`;
}

// Shows the organizer narrator step card before an action
function showNightNarratorStep(announcement, roleName, roleIcon, onReady) {
  _narratorReadyCallback = onReady;

  const el = document.getElementById('narrator-step');
  const textEl = document.getElementById('narrator-step-text');
  const iconEl = document.getElementById('narrator-step-icon');
  const labelEl = document.getElementById('btn-show-action-label');

  if (textEl) textEl.innerHTML = `<span class="org-quote">"${announcement}"</span>`;
  if (iconEl) iconEl.textContent = roleIcon || '📢';
  if (labelEl) labelEl.textContent = `Show ${roleName} Action`;

  document.getElementById('action-panel').style.display = 'none';
  document.getElementById('narrator-panel').style.display = 'none';
  if (el) el.style.display = 'flex';
}

function hideNarratorStep() {
  const el = document.getElementById('narrator-step');
  if (el) el.style.display = 'none';
}

// Called when organizer taps "Show Action Panel" button in HTML
function onNarratorReady() {
  hideNarratorStep();
  if (_narratorReadyCallback) {
    const cb = _narratorReadyCallback;
    _narratorReadyCallback = null;
    cb();
  }
}

// Shows "close your eyes" step after an action, then calls onNext
function showPostActionNarration(roleName, onNext) {
  _narratorReadyCallback = onNext;

  const el = document.getElementById('narrator-step');
  const textEl = document.getElementById('narrator-step-text');
  const iconEl = document.getElementById('narrator-step-icon');
  const labelEl = document.getElementById('btn-show-action-label');

  if (textEl) textEl.innerHTML = `<span class="org-quote">"${roleName}, close your eyes"</span>`;
  if (iconEl) iconEl.textContent = '😌';
  if (labelEl) labelEl.textContent = 'Next →';

  document.getElementById('action-panel').style.display = 'none';
  document.getElementById('narrator-panel').style.display = 'none';
  if (el) el.style.display = 'flex';
}



function startNightTimer(seconds) {
  clearNightTimer();
  const timerBlock = document.getElementById('action-timer');
  if (!seconds) {
    if (timerBlock) timerBlock.style.display = 'none';
    return;
  }
  if (timerBlock) timerBlock.style.display = 'block';

  let remaining = seconds;
  const fill = document.getElementById('timer-fill');
  const text = document.getElementById('timer-text');

  fill.style.width = '100%';
  fill.classList.remove('warning');
  text.textContent = remaining;

  nightTimerInterval = setInterval(() => {
    remaining--;
    text.textContent = remaining;
    const pct = (remaining / seconds) * 100;
    fill.style.width = `${pct}%`;
    if (remaining <= 10) fill.classList.add('warning');
    if (remaining <= 0) {
      clearNightTimer();
      skipNightAction();
    }
  }, 1000);
}

function clearNightTimer() {
  if (nightTimerInterval) {
    clearInterval(nightTimerInterval);
    nightTimerInterval = null;
  }
}

function advanceNight() {
  finishNightPhase();
}

function finishNightPhase() {
  const results = Game.resolveNightActions();
  showDawnScreen(results);
}

function checkAllNightActionsComplete() {
  // Called on host when all clients submit actions
  // (simplified: just check queue progress)
}

/* ── Dawn / Transition ──────────────────────────────────────── */
function showDawnScreen(results) {
  showScreen('screen-dawn');

  const newsContainer = document.getElementById('dawn-news');
  newsContainer.innerHTML = '';

  // Collect news items
  const newsItems = [];

  if (results.killed) {
    const p = Game.getPlayer(results.killed);
    if (p) newsItems.push({ icon: '💀', text: `<strong>${p.name}</strong> was found dead this morning.` });
  }

  if (results.skKill) {
    const p = Game.getPlayer(results.skKill);
    if (p) newsItems.push({ icon: '🗡️', text: `<strong>${p.name}</strong> was brutally murdered.` });
  }

  if (results.vigilanteKill) {
    const p = Game.getPlayer(results.vigilanteKill);
    if (p) newsItems.push({ icon: '🏹', text: `<strong>${p.name}</strong> was shot by an unknown vigilante.` });
  }

  if (results.guardianDied) {
    const p = Game.getPlayer(results.guardianDied);
    if (p) newsItems.push({ icon: '🛡️', text: `<strong>${p.name}</strong> (Bodyguard) heroically died protecting another.` });
  }

  if (results.saved && !results.killed) {
    newsItems.push({ icon: '✨', text: `Someone was attacked but miraculously survived!` });
  }

  if (newsItems.length === 0) {
    newsItems.push({ icon: '🌅', text: `It was a quiet night. <strong>No one died!</strong>` });
  }

  newsItems.forEach(item => {
    const el = document.createElement('div');
    el.className = 'news-item';
    el.innerHTML = `<div class="news-icon">${item.icon}</div><div class="news-text">${item.text}</div>`;
    newsContainer.appendChild(el);
  });

  // Check win — only the host runs win checks locally; clients wait for 'win' broadcast
  if (!isOnlineMode || Network.getIsHost()) {
    const winner = Game.checkWinCondition();
    if (winner) {
      if (isOnlineMode && Network.getIsHost()) {
        // Broadcast win to all clients with full player data for the roles reveal
        const winPlayers = Game.getPlayers().map(p => ({
          id: p.id, name: p.name, alive: p.alive,
          role: p.role ? { icon: p.role.icon, name: p.role.name, color: p.role.color } : null,
        }));
        Network.broadcast({ type: 'win', winner, players: winPlayers, dayCount: Game.getDayCount() });
      }
      setTimeout(() => showWinScreen(winner), 2000);
      return;
    }
  }
}

/* ── Day Phase ──────────────────────────────────────────────── */
let dayTimerInterval = null;
let votingTriggered = false;
let selectedVoteTarget = null;

function showDayPhase() {
  showScreen('screen-day');
  Game.startDay();
  votingTriggered = false;
  selectedVoteTarget = null;

  document.getElementById('day-num').textContent = Game.getDayCount();

  buildDayPlayersGrid();
  startDayTimer(gameSettings.dayTime || 120);
  updateVoteTally();

  Game.addLog(`☀️ Day ${Game.getDayCount()} begins.`, true);
}

// Called from dawn screen button
function showScreen_day() { showDayPhase(); }

// Override the continue button on dawn screen
document.addEventListener('DOMContentLoaded', () => {
  const dawnBtn = document.querySelector('#screen-dawn .btn');
  if (dawnBtn) dawnBtn.onclick = () => {
    // In online mode (host), tell clients to advance to day before doing so locally
    if (isOnlineMode && Network.getIsHost()) {
      const aliveList = Game.getAlivePlayers().map(p => ({ id: p.id, name: p.name, peerId: p.peerId, alive: true }));
      Network.broadcast({
        type:        'day_start',
        dayCount:    Game.getDayCount() + 1,
        alivePlayers: aliveList,
      });
    }
    showDayPhase();
  };
});

function buildDayPlayersGrid() {
  const grid = document.getElementById('day-players-grid');
  if (!grid) return;
  grid.innerHTML = '';

  const emojis = ['🧑', '👩', '🧔', '👴', '👵', '🧕', '🧑‍🦱', '🧑‍🦰', '🧑‍🦳', '🧑‍🦲'];
  const alive = Game.getAlivePlayers();

  document.getElementById('alive-count').textContent = alive.length;

  alive.forEach((p, i) => {
    const card = document.createElement('div');
    card.className = 'player-day-card';
    card.id = `day-player-${p.id}`;
    card.innerHTML = `
      <div class="p-avatar">${emojis[i % emojis.length]}</div>
      <div class="p-name">${p.name}</div>
      <div class="vote-badge" id="vote-badge-${p.id}" style="display:none">0 votes</div>
    `;
    card.onclick = () => nominateForVote(p.id);
    grid.appendChild(card);
  });
}

function nominateForVote(targetId) {
  if (votingTriggered) return;
  const player = Game.getPlayer(targetId);
  showToast(`Nominated ${player?.name}`);
  Game.nominatePlayer(targetId);

  if (Network.getIsHost()) {
    updateVoteTally();
  } else {
    Network.sendToHost({ type: 'nomination', targetId });
  }
}

function triggerVote() {
  if (votingTriggered) return;
  votingTriggered = true;
  clearDayTimer();
  showVoteScreen();
}

function updateVoteTally() {
  const alive = Game.getAlivePlayers();
  const tally = document.getElementById('vote-tally');
  if (!tally) return;

  const withVotes = alive.filter(p => p.voteCount > 0);

  if (withVotes.length === 0) {
    tally.innerHTML = '<p style="color:var(--text-muted);font-size:0.8rem;font-style:italic">No votes yet...</p>';
  } else {
    const maxVotes = Math.max(...withVotes.map(p => p.voteCount));
    tally.innerHTML = withVotes
      .sort((a, b) => b.voteCount - a.voteCount)
      .map(p => `
        <div class="tally-row">
          <span class="tally-name">${p.name}</span>
          <div class="tally-bar-bg">
            <div class="tally-bar-fill" style="width:${(p.voteCount / maxVotes) * 100}%"></div>
          </div>
          <span class="tally-count">${p.voteCount}</span>
        </div>
      `).join('');
  }
}

function broadcastVoteUpdate() {
  Network.broadcast({
    type: 'vote_update',
    votes: Game.getState().votes,
    players: Game.getPlayers().map(p => ({ id: p.id, voteCount: p.voteCount })),
  });
  updateVoteTally();
}

function receiveVoteUpdate(data) {
  updateVoteTally();
}

function startDayTimer(seconds) {
  clearDayTimer();
  if (!seconds) return;

  let remaining = seconds;
  const display = document.getElementById('day-timer-display');
  if (!display) return;

  const update = () => {
    const mins = Math.floor(remaining / 60);
    const secs = remaining % 60;
    display.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
    display.className = `day-timer ${remaining <= 10 ? 'danger' : ''}`;
    if (remaining <= 0) {
      clearDayTimer();
      triggerVote();
    }
    remaining--;
  };

  update();
  dayTimerInterval = setInterval(update, 1000);
}

function clearDayTimer() {
  if (dayTimerInterval) { clearInterval(dayTimerInterval); dayTimerInterval = null; }
}

/* ── Vote Screen ─────────────────────────────────────────────── */
function showVoteScreen() {
  showScreen('screen-vote');
  selectedVoteTarget = null;

  const candidates = document.getElementById('vote-candidates');
  candidates.innerHTML = '';

  const alive = Game.getAlivePlayers();
  const emojis = ['🧑', '👩', '🧔', '👴', '👵', '🧕', '🧑‍🦱'];

  alive.forEach((p, i) => {
    const btn = document.createElement('button');
    btn.className = 'candidate-btn';
    btn.dataset.candidateId = p.id;
    btn.innerHTML = `
      <div class="p-avatar" style="width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,var(--secondary),var(--primary));display:flex;align-items:center;justify-content:center;flex-shrink:0;">${emojis[i % emojis.length]}</div>
      <div>
        <div class="candidate-name">${p.name}</div>
        <div class="candidate-votes">${p.voteCount || 0} nomination(s)</div>
      </div>
    `;
    btn.onclick = () => selectVoteCandidate(p.id, btn);
    candidates.appendChild(btn);
  });

  document.getElementById('btn-cast-vote').disabled = true;
}

function selectVoteCandidate(targetId, btn) {
  document.querySelectorAll('.candidate-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  selectedVoteTarget = targetId;
  document.getElementById('btn-cast-vote').disabled = false;
}

function castVote() {
  if (!selectedVoteTarget) return;

  if (Network.getIsHost() || !isOnlineMode) {
    Game.castVote('local', selectedVoteTarget);
  } else {
    Network.sendToHost({ type: 'vote_cast', voterId: myPlayerData.id, targetId: selectedVoteTarget });
  }

  // In singleplayer/pass-device: all players vote, then resolve
  showVoteResults();
}

function abstainVote() {
  showVoteResults();
}

function showVoteResults() {
  const eliminated = Game.resolveVote();

  if (!eliminated) {
    showModal({
      header: '⚖️ No Verdict',
      body: 'The vote ended in a tie or no majority. No one is eliminated today.',
      buttons: [{ text: 'Continue to Night', class: 'btn-primary', action: () => startNightPhase() }]
    });
    return;
  }

  showEliminationScreen(eliminated, 'voted_out');
}

/* ── Elimination Screen ─────────────────────────────────────── */
function showEliminationScreen(player, cause) {
  Game.eliminatePlayer(player.id, cause);

  // In online mode (host), broadcast full elimination data to clients
  if (isOnlineMode && Network.getIsHost()) {
    Network.broadcast({
      type:       'elimination',
      playerId:   player.id,
      playerName: player.name,
      cause:      cause,
      role:       player.role ? {
        icon:  player.role.icon,
        name:  player.role.name,
        color: player.role.color,
        team:  player.role.team,
      } : null,
      lastWill: (gameSettings.lastWill && player.lastWill) ? player.lastWill : null,
    });
  }

  showScreen('screen-elimination');

  document.getElementById('elim-icon').textContent = cause === 'voted_out' ? '⚖️' : '💀';
  document.getElementById('elim-title').textContent = cause === 'voted_out' ? 'The Town Has Voted' : 'Player Eliminated';

  const playerCard = document.getElementById('elim-player-card');
  playerCard.innerHTML = `
    <div style="font-size:3rem">${player.role?.icon || '👤'}</div>
    <div class="elim-player-name">${player.name}</div>
    <div class="elim-role-reveal">
      <span>Was the</span>
      <strong style="color:${player.role?.color || '#fff'}">${player.role?.name || 'Unknown'}</strong>
    </div>
    <span class="badge" style="background:${player.role?.team === 'mafia' ? 'rgba(229,62,62,0.2);color:var(--accent-red)' : 'rgba(16,185,129,0.2);color:var(--accent-green)'}">${player.role?.team?.toUpperCase() || 'UNKNOWN'}</span>
  `;

  // Last will
  const lwSection = document.getElementById('last-will-section');
  const lwText = document.getElementById('last-will-text');
  if (gameSettings.lastWill && player.lastWill) {
    lwSection.style.display = 'block';
    lwText.textContent = player.lastWill || '(No last will left)';
  } else {
    lwSection.style.display = 'none';
  }
}

function continueAfterElimination() {
  // Online clients defer all win/phase decisions to the host
  if (isOnlineMode && !Network.getIsHost()) return;

  const winner = Game.checkWinCondition();
  if (winner) {
    if (isOnlineMode && Network.getIsHost()) {
      // Broadcast win with full player data for the roles reveal
      const winPlayers = Game.getPlayers().map(p => ({
        id: p.id, name: p.name, alive: p.alive,
        role: p.role ? { icon: p.role.icon, name: p.role.name, color: p.role.color } : null,
      }));
      Network.broadcast({ type: 'win', winner, players: winPlayers, dayCount: Game.getDayCount() });
    }
    showWinScreen(winner);
  } else {
    // startNightPhase() already broadcasts 'night_start' to all clients
    startNightPhase();
  }
}

/* ── Win Screen ─────────────────────────────────────────────── */
const WIN_DATA = {
  town:         { badge: '🏆', title: 'Town Wins!',          subtitle: 'Justice has prevailed',           color: '#10b981' },
  mafia:        { badge: '🔪', title: 'Mafia Wins!',         subtitle: 'The shadows have taken over',      color: '#ef4444' },
  jester:       { badge: '🃏', title: 'Jester Wins!',        subtitle: 'The fool has had the last laugh',  color: '#f6c90e' },
  serialKiller: { badge: '🗡️', title: 'Serial Killer Wins!', subtitle: 'No one survived the night',        color: '#a855f7' },
  executioner:  { badge: '⚔️', title: 'Executioner Wins!',   subtitle: 'The target has been eliminated',   color: '#6366f1' },
  survivor:     { badge: '🧲', title: 'Survivor Wins!',      subtitle: 'Against all odds, they made it',   color: '#84cc16' },
};

function showWinScreen(winner, winData) {
  showScreen('screen-win');

  const data = WIN_DATA[winner] || WIN_DATA.town;
  document.getElementById('win-badge').textContent   = data.badge;
  document.getElementById('win-title').textContent   = data.title;
  document.getElementById('win-subtitle').textContent = data.subtitle;

  // Stats — use winData from network message if local Game has no players (online client)
  const state = Game.getState();
  const players     = (winData && winData.players) || state.players || [];
  const totalPlayers = players.length;
  const eliminated   = players.filter(p => !p.alive).length;
  const rounds       = (winData && winData.dayCount) || Game.getDayCount();

  document.getElementById('win-stats').innerHTML = `
    <div class="stat-card"><div class="stat-value">${totalPlayers}</div><div class="stat-label">Players</div></div>
    <div class="stat-card"><div class="stat-value">${eliminated}</div><div class="stat-label">Eliminated</div></div>
    <div class="stat-card"><div class="stat-value">${rounds}</div><div class="stat-label">Days</div></div>
  `;

  // All roles reveal
  const list = document.getElementById('roles-reveal-list');
  list.innerHTML = players.map(p => `
    <div class="reveal-row ${p.alive ? '' : 'eliminated'}">
      <span>${p.role ? p.role.icon : '👤'}</span>
      <span class="rr-name">${p.name}</span>
      <span class="rr-role">
        <span style="color:${p.role ? p.role.color : '#fff'}">${p.role ? p.role.name : 'Unknown'}</span>
      </span>
      <span class="rr-status">${p.alive ? '✅ Alive' : '💀 Dead'}</span>
    </div>
  `).join('');

  // Confetti
  launchConfetti(data.color);
}

function launchConfetti(color) {
  const container = document.getElementById('confetti');
  if (!container) return;
  container.innerHTML = '';

  const colors = [color, '#ffffff', '#f6c90e', '#c62a88', '#7c3aed'];

  for (let i = 0; i < 80; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    piece.style.cssText = `
      left: ${Math.random() * 100}%;
      background: ${colors[Math.floor(Math.random() * colors.length)]};
      --dur: ${2 + Math.random() * 3}s;
      --delay: ${Math.random() * 2}s;
      width: ${6 + Math.random() * 8}px;
      height: ${6 + Math.random() * 8}px;
      border-radius: ${Math.random() > 0.5 ? '50%' : '2px'};
    `;
    container.appendChild(piece);
  }
}

function playAgain() {
  showModal({
    header: '🔄 Play Again?',
    body: 'Start a new game with the same players?',
    buttons: [
      {
        text: 'Same Players',
        class: 'btn-primary',
        action: () => {
          const players = Game.getPlayers().map(p => ({ id: p.id, name: p.name, peerId: p.peerId, isHost: p.isHost }));
          Game.initGame(players, gameSettings, gameRoleConfig);
          beginRoleReveal(Game.getPlayers());
        }
      },
      { text: 'New Game', class: 'btn-secondary', action: () => showScreen('screen-home') }
    ]
  });
}

/* ── Rules Screen ───────────────────────────────────────────── */
function showTab(tabId, btn) {
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(tabId)?.classList.add('active');
  btn?.classList.add('active');
}

function buildRulesRoles() {
  const list = document.getElementById('rules-roles-list');
  if (!list) return;

  list.innerHTML = ROLE_ORDER.map(id => {
    const role = ROLES[id];
    if (!role) return '';
    const teamClass = `team-${role.team}`;
    return `
      <div class="role-info-card" data-team="${role.team}">
        <div class="ric-icon">${role.icon}</div>
        <div class="ric-body">
          <div class="ric-header">
            <span class="ric-name">${role.name}</span>
            <span class="ric-team ${teamClass}">${role.team.charAt(0).toUpperCase() + role.team.slice(1)}</span>
          </div>
          <div class="ric-desc">${role.description}</div>
          <div class="ric-ability">${role.ability}</div>
        </div>
      </div>
    `;
  }).join('');
}

function filterRoles(team, btn) {
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');

  document.querySelectorAll('.role-info-card').forEach(card => {
    card.style.display = (team === 'all' || card.dataset.team === team) ? 'flex' : 'none';
  });
}

/* ── Network receive helpers ─────────────────────────────────── */
function receiveNightStart(data) {
  showScreen('screen-night');
  document.getElementById('night-num').textContent = data.nightNum;

  // Set up this client's night action queue from host data
  nightActionQueue = [];
  nightQueueIdx = 0;
  selectedNightTarget = null;

  if (data.actors && data.alivePlayers) {
    // Store alive players locally so target lists work
    const myPeerId = Network.getMyPeerId ? Network.getMyPeerId() : null;
    const myId = myPlayerData.id;

    // Find this client's action (matched by playerId or peerId)
    const myAction = data.actors.find(a =>
      a.playerId === myId ||
      (myPeerId && a.peerId === myPeerId)
    );

    if (myAction) {
      // Build a minimal player object for the action panel
      const fakePlayer = {
        id:   myAction.playerId,
        name: myPlayerData.name,
        role: {
          icon:         myAction.roleIcon,
          name:         myAction.roleName,
          prompt:       myAction.rolePrompt,
          canSelfTarget: myAction.roleCanSelfTarget,
          team:         myRole ? myRole.team : 'town',
        },
        alive: true,
      };

      // Build a target list from alivePlayers (no role info needed for display)
      const fakeAlive = (data.alivePlayers || []).map(p => ({
        ...p, role: { team: 'unknown', icon: '👤', name: 'Player' }
      }));

      nightActionQueue = [myAction];
      showNightActionPanelForClient(myAction, fakePlayer, fakeAlive);
    } else {
      // No action for this client — just show wait message
      document.getElementById('action-panel').style.display = 'none';
      document.getElementById('night-instructions').textContent =
        '🌙 You have no night action. Wait for dawn...';
    }
  }
}

// Shows the night action panel for online clients using data from host
function showNightActionPanelForClient(action, fakePlayer, alivePlayers) {
  const panel = document.getElementById('action-panel');
  const narrator = document.getElementById('narrator-panel');
  panel.style.display = 'block';
  narrator.style.display = 'none';

  document.getElementById('action-role-icon').textContent = fakePlayer.role.icon;
  document.getElementById('action-role-name').textContent = action.isTeamAction ? 'Mafia' : fakePlayer.role.name;
  document.getElementById('action-prompt').textContent    = fakePlayer.role.prompt || 'Choose a target';

  const targetList = document.getElementById('target-list');
  targetList.innerHTML = '';
  selectedNightTarget = null;
  document.getElementById('btn-confirm-action').disabled = true;

  const emojis = ['🧑', '👩', '🧔', '👴', '👵', '🧕', '🧑‍🦱'];

  const filteredTargets = alivePlayers.filter(p => {
    if (!fakePlayer.role.canSelfTarget && p.id === fakePlayer.id) return false;
    return true;
  });

  filteredTargets.forEach((target, i) => {
    const btn = document.createElement('button');
    btn.className = 'target-btn';
    btn.dataset.targetId = target.id;
    btn.innerHTML = `
      <div class="t-avatar">${emojis[i % emojis.length]}</div>
      <span>${target.name}</span>
    `;
    btn.onclick = () => selectNightTarget(target.id, btn);
    targetList.appendChild(btn);
  });

  startNightTimer(gameSettings.nightTime || 30);
}

function receiveDayStart(data) {
  // Clients receive day_start from host — show day UI without calling Game.startDay()
  showScreen('screen-day');
  votingTriggered = false;
  selectedVoteTarget = null;

  // Build day grid from localPlayers (populated via lobby_update / game_start)
  const grid = document.getElementById('day-players-grid');
  if (grid) {
    grid.innerHTML = '';
    const emojis = ['🧑', '👩', '🧔', '👴', '👵', '🧕', '🧑‍🦱', '🧑‍🦱', '🧑‍🦳', '🧑‍🦲'];
    const alive = (data.alivePlayers || localPlayers).filter(p => p.alive !== false);
    const aliveCount = document.getElementById('alive-count');
    if (aliveCount) aliveCount.textContent = alive.length;
    alive.forEach((p, i) => {
      const card = document.createElement('div');
      card.className = 'player-day-card';
      card.innerHTML = `
        <div class="p-avatar">${emojis[i % emojis.length]}</div>
        <div class="p-name">${p.name}</div>
        <div class="vote-badge" style="display:none">0 votes</div>
      `;
      grid.appendChild(card);
    });
  }

  const dayNum = document.getElementById('day-num');
  if (dayNum && data.dayCount) dayNum.textContent = data.dayCount;

  startDayTimer(gameSettings.dayTime || 120);
}

function receiveElimination(data) {
  // Show elimination screen using data sent from host (no local Game state needed)
  showScreen('screen-elimination');

  const cause = data.cause || 'voted_out';
  document.getElementById('elim-icon').textContent  = cause === 'voted_out' ? '⚖️' : '💀';
  document.getElementById('elim-title').textContent = cause === 'voted_out' ? 'The Town Has Voted' : 'Player Eliminated';

  const playerCard = document.getElementById('elim-player-card');
  const role = data.role || {};
  const teamColor = role.team === 'mafia'
    ? 'rgba(229,62,62,0.2);color:var(--accent-red)'
    : 'rgba(16,185,129,0.2);color:var(--accent-green)';
  playerCard.innerHTML = `
    <div style="font-size:3rem">${role.icon || '👤'}</div>
    <div class="elim-player-name">${data.playerName || 'Unknown'}</div>
    <div class="elim-role-reveal">
      <span>Was the</span>
      <strong style="color:${role.color || '#fff'}">${role.name || 'Unknown'}</strong>
    </div>
    <span class="badge" style="background:${teamColor}">${(role.team || 'unknown').toUpperCase()}</span>
  `;

  const lwSection = document.getElementById('last-will-section');
  const lwText    = document.getElementById('last-will-text');
  if (gameSettings.lastWill && data.lastWill) {
    lwSection.style.display = 'block';
    lwText.textContent = data.lastWill || '(No last will left)';
  } else {
    if (lwSection) lwSection.style.display = 'none';
  }
}

function receiveWin(data) {
  showWinScreen(data.winner, data);
}

/* ── Append Log ─────────────────────────────────────────────── */
const UI = {
  appendLog(msg, important) {
    const entries = document.getElementById('log-entries');
    if (!entries) return;
    const entry = document.createElement('div');
    entry.className = `log-entry ${important ? 'important' : ''}`;
    entry.textContent = msg;
    entries.appendChild(entry);
    entries.scrollTop = entries.scrollHeight;
  }
};

// Expose for game.js
window.UI = UI;
