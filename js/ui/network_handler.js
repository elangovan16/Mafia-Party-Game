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
      if (data.targetId === null) {
        Game.abstainVote(data.voterId);
      } else {
        Game.castVote(data.voterId, data.targetId);
      }
      broadcastVoteUpdate();
      if (typeof checkEndVoting === 'function') checkEndVoting();
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

    case 'no_verdict':
      if (typeof showNoVerdictScreen === 'function') showNoVerdictScreen();
      break;

    case 'win':
      receiveWin(data);
      break;
  }
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

  startNightTimer(gameSettings.nightTime ?? 30);

  // Note Input for killers
  const noteWrap = document.getElementById('night-note-wrap');
  const noteInput = document.getElementById('night-action-note');
  if (noteWrap && noteInput) {
    if (action.actionType === 'mafia_kill' || action.actionType === 'sk_kill') {
      noteWrap.style.display = 'block';
      noteInput.value = '';
    } else {
      noteWrap.style.display = 'none';
      noteInput.value = '';
    }
  }
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

  startDayTimer(gameSettings.dayTime ?? 120);
}

function receiveElimination(data) {
  // Show elimination screen using data sent from host (no local Game state needed)
  showScreen('screen-elimination');

  const cause = data.cause || 'voted_out';
  document.getElementById('elim-icon').textContent  = cause === 'voted_out' ? '⚖️' : '💀';
  document.getElementById('elim-title').textContent = cause === 'voted_out' ? 'The Town Has Voted' : 'Player Eliminated';

  const playerCard = document.getElementById('elim-player-card');
  if (gameSettings.revealRoles !== false) {
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
  } else {
    playerCard.innerHTML = `
      <div style="font-size:3rem">👻</div>
      <div class="elim-player-name">${data.playerName || 'Unknown'}</div>
      <div class="elim-role-reveal">
        <span>Their role remains a secret.</span>
      </div>
    `;
  }

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

