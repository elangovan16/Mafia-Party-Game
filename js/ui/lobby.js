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

  // Ensure villagers fill any gap and validate role counts
  const others = Object.entries(config).filter(([id]) => id !== 'villager').reduce((a, [, v]) => a + v, 0);
  if (others >= players.length) {
    showToast(`Too many specific roles (${others}) for ${players.length} players! Need room for at least 1 Villager.`, 'error');
    return;
  }
  config.villager = Math.max(1, players.length - others);

  const state = Game.initGame(players, gameSettings, config);
  
  // Update global gameRoleConfig with the final resolved config
  gameRoleConfig = config;

  // Send game state to all clients (without revealing roles)
  Network.broadcast({
    type: 'game_start',
    players: state.players.map(p => ({ id: p.id, name: p.name, peerId: p.peerId, alive: true })),
    settings: gameSettings,
    roleConfig: config,
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
        lovers: player.role.id === 'lover'
          ? state.players.filter(p => p.role.id === 'lover' && p.id !== player.id).map(p => p.name)
          : null,
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
  const me = { 
    id: myPlayerData.id, 
    name: myPlayerData.name, 
    role: data.role,
    mafiaTeam: data.mafiaTeam,
    executionerTarget: data.executionerTarget,
    lovers: data.lovers
  };
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
  
  // Add extra context (Teammates, Lovers, Targets)
  let extraInfo = '';
  
  if (role.team === 'mafia') {
    let mafiaNames = [];
    if (isOnlineMode && !Network.getIsHost()) {
      mafiaNames = (player.mafiaTeam || []).filter(p => p.id !== player.id).map(p => p.name);
    } else if (Game && Game.getState) {
      mafiaNames = Game.getState().players.filter(p => p.role.team === 'mafia' && p.id !== player.id).map(p => p.name);
    }
    if (mafiaNames.length > 0) {
      extraInfo = `<br><br><strong>Your Mafia Teammates:</strong> ${mafiaNames.join(', ')}`;
    }
  } else if (role.id === 'lover') {
    let loverNames = [];
    if (isOnlineMode && !Network.getIsHost()) {
      loverNames = player.lovers || [];
    } else if (Game && Game.getState) {
      loverNames = Game.getState().players.filter(p => p.role.id === 'lover' && p.id !== player.id).map(p => p.name);
    }
    if (loverNames.length > 0) {
      extraInfo = `<br><br><strong>Your Lover:</strong> ${loverNames.join(', ')}`;
    }
  } else if (role.id === 'executioner') {
    let targetName = null;
    if (isOnlineMode && !Network.getIsHost()) {
      // Find the name of the executioner target using the id provided
      const tId = player.executionerTarget;
      const tObj = localPlayers.find(p => p.id === tId);
      if (tObj) targetName = tObj.name;
    } else if (Game && Game.getState) {
      const targetId = Game.getState().executionerTarget;
      const targetObj = Game.getState().players.find(p => p.id === targetId);
      if (targetObj) targetName = targetObj.name;
    }
    if (targetName) {
      extraInfo = `<br><br><strong>Your Target:</strong> ${targetName}`;
    }
  }

  abilityEl.innerHTML = role.ability + extraInfo;
  abilityEl.style.display = 'block';

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

    const nextBtn = document.getElementById('btn-next-player');
    if (nextBtn) {
      const isLast = localRevealIndex >= localRevealPlayers.length - 1;
      nextBtn.innerHTML = isLast
        ? '<span class="btn-icon">✅</span> Finish Role Reveals'
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




