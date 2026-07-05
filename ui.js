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
  buildSetupRoles();
  buildRulesRoles();
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

/* ── SETUP SCREEN ───────────────────────────────────────────── */
let selectedRoles = new Set(['villager', 'mafioso', 'godfather', 'detective', 'doctor']);
let playerCountValue = 6;

function buildSetupRoles() {
  const grid = document.getElementById('roles-grid');
  if (!grid) return;
  grid.innerHTML = '';

  const alwaysOn = ['villager', 'mafioso', 'godfather'];

  for (const roleId of ROLE_ORDER) {
    const role = ROLES[roleId];
    if (!role) continue;

    const card = document.createElement('div');
    card.className = `role-toggle-card ${selectedRoles.has(roleId) ? 'selected' : ''} ${alwaysOn.includes(roleId) ? 'always-on' : ''}`;
    card.id = `role-toggle-${roleId}`;
    card.innerHTML = `
      <div class="r-icon">${role.icon}</div>
      <div class="r-name">${role.name}</div>
      <div class="r-team">${role.team.charAt(0).toUpperCase() + role.team.slice(1)}</div>
    `;

    if (!alwaysOn.includes(roleId)) {
      card.onclick = () => toggleRoleSelection(roleId, card);
    }

    grid.appendChild(card);
  }

  updateRecommendedRoles();
}

function toggleRoleSelection(roleId, card) {
  if (selectedRoles.has(roleId)) {
    selectedRoles.delete(roleId);
    card.classList.remove('selected');
  } else {
    selectedRoles.add(roleId);
    card.classList.add('selected');
  }
  updateRecommendedRoles();
}

function updatePlayerCount(val) {
  playerCountValue = parseInt(val);
  document.getElementById('player-count-display').textContent = val;
  applyPreset(playerCountValue);
  updateRecommendedRoles();
}

function applyPreset(count) {
  const preset = getPresetForCount(count);
  selectedRoles = new Set(Object.keys(preset));

  // Always include core roles
  selectedRoles.add('villager');
  selectedRoles.add('mafioso');
  selectedRoles.add('godfather');

  // Update UI
  for (const roleId of ROLE_ORDER) {
    const card = document.getElementById(`role-toggle-${roleId}`);
    if (card) {
      card.classList.toggle('selected', selectedRoles.has(roleId));
    }
  }
}

function updateRecommendedRoles() {
  const el = document.getElementById('recommended-roles');
  if (!el) return;
  const preset = getPresetForCount(playerCountValue);
  const roleNames = Object.entries(preset)
    .map(([id, count]) => `${count}x ${ROLES[id]?.name || id}`)
    .join(', ');
  el.innerHTML = `<strong>💡 Suggested for ${playerCountValue} players:</strong> ${roleNames}`;
}

/* ── Create Game ─────────────────────────────────────────────── */
let localPlayers = []; // For hotspot/offline mode
let gameRoleConfig = {};
let gameSettings = {};
let isOnlineMode = false;
let myPlayerData = {};

function createGame() {
  const hostName = document.getElementById('host-name').value.trim();
  if (!hostName) { showToast('Please enter your name!', 'error'); return; }

  const count = parseInt(document.getElementById('player-count').value);
  const preset = getPresetForCount(count);

  // Build role config from selected roles
  gameRoleConfig = {};
  for (const roleId of selectedRoles) {
    const role = ROLES[roleId];
    if (!role) continue;
    const presetCount = preset[roleId] || 0;
    const baseCount = roleId === 'villager' ? Math.max(1, presetCount) :
                      roleId === 'mafioso'  ? Math.max(1, presetCount) : presetCount;
    if (baseCount > 0) gameRoleConfig[roleId] = baseCount;
  }

  // Ensure we have enough roles
  const totalRoles = Object.values(gameRoleConfig).reduce((a, b) => a + b, 0);
  if (totalRoles !== count) {
    // Auto-balance villagers
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

    case 'night_start':
      receiveNightStart(data);
      break;

    case 'day_start':
      receiveDayStart(data);
      break;

    case 'vote_update':
      receiveVoteUpdate(data);
      break;

    case 'nomination_update':
      // Update local state
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

  const preset = getPresetForCount(players.length);
  const config = {};
  const others = Object.entries(preset).filter(([id]) => id !== 'villager').reduce((a, [, v]) => a + v, 0);
  Object.assign(config, preset);
  config.villager = Math.max(1, players.length - others);

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

  beginRoleReveal(state.players);
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
  // Client: game started, show role reveal for our player
  gameSettings = data.settings;
  showScreen('screen-role-reveal');
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
        footer.style.display = revealIndex < revealPlayers.length - 1 ? 'flex' : 'none';
        if (revealIndex >= revealPlayers.length - 1) {
          // Last player - show start button
          setTimeout(startNightPhase, 2000);
        }
      }, 600);
    }
  };
}

function nextRoleReveal() {
  revealIndex++;
  if (revealIndex < revealPlayers.length) {
    showCurrentReveal();
  } else {
    startNightPhase();
  }
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
    // All actions done – resolve
    finishNightPhase();
    return;
  }

  const action = nightActionQueue[nightQueueIdx];
  const player = Game.getPlayer(action.playerId);
  if (!player || !player.alive) {
    nightQueueIdx++;
    processNextNightActor();
    return;
  }

  // Mark current in queue
  document.querySelectorAll('.night-action-item').forEach((el, i) => {
    el.className = `night-action-item ${i < nightQueueIdx ? 'done' : i === nightQueueIdx ? 'active' : ''}`;
  });

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
  const player = Game.getPlayer(action.playerId);

  if (Network.getIsHost() || !isOnlineMode) {
    Game.submitNightAction(action.playerId, selectedNightTarget, action.actionType);
  } else {
    Network.sendToHost({
      type: 'night_action_submitted',
      actorId: action.playerId,
      targetId: selectedNightTarget,
      actionType: action.actionType,
    });
  }

  nightQueueIdx++;
  hideNightActionPanel();
  processNextNightActor();
}

function skipNightAction() {
  clearNightTimer();
  nightQueueIdx++;
  hideNightActionPanel();
  processNextNightActor();
}

function hideNightActionPanel() {
  document.getElementById('action-panel').style.display = 'none';
}

function startNightTimer(seconds) {
  clearNightTimer();
  let remaining = seconds;
  const fill = document.getElementById('timer-fill');
  const text = document.getElementById('timer-text');

  if (!seconds) return;

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

  // Check win
  const winner = Game.checkWinCondition();
  if (winner) {
    setTimeout(() => showWinScreen(winner), 2000);
    return;
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
  if (dawnBtn) dawnBtn.onclick = () => showDayPhase();
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
  const winner = Game.checkWinCondition();
  if (winner) {
    showWinScreen(winner);
  } else {
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

function showWinScreen(winner) {
  showScreen('screen-win');

  const data = WIN_DATA[winner] || WIN_DATA.town;
  document.getElementById('win-badge').textContent   = data.badge;
  document.getElementById('win-title').textContent   = data.title;
  document.getElementById('win-subtitle').textContent = data.subtitle;

  // Stats
  const state = Game.getState();
  const totalPlayers = state.players.length;
  const eliminated   = state.players.filter(p => !p.alive).length;
  const rounds       = Game.getDayCount();

  document.getElementById('win-stats').innerHTML = `
    <div class="stat-card"><div class="stat-value">${totalPlayers}</div><div class="stat-label">Players</div></div>
    <div class="stat-card"><div class="stat-value">${eliminated}</div><div class="stat-label">Eliminated</div></div>
    <div class="stat-card"><div class="stat-value">${rounds}</div><div class="stat-label">Days</div></div>
  `;

  // All roles reveal
  const list = document.getElementById('roles-reveal-list');
  list.innerHTML = state.players.map(p => `
    <div class="reveal-row ${p.alive ? '' : 'eliminated'}">
      <span>${p.role.icon}</span>
      <span class="rr-name">${p.name}</span>
      <span class="rr-role">
        <span style="color:${p.role.color}">${p.role.name}</span>
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
}

function receiveDayStart(data) {
  showDayPhase();
}

function receiveElimination(data) {
  const player = Game.getPlayer(data.playerId);
  if (player) showEliminationScreen(player, data.cause);
}

function receiveWin(data) {
  showWinScreen(data.winner);
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
