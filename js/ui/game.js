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
  if (!player) {
    nightQueueIdx++;
    processNextNightActor();
    return;
  }

  if (isOnlineMode) {
    if (!player.alive) {
      nightQueueIdx++;
      processNextNightActor();
      return;
    }
    // Online mode: skip remote players (they act on their own device)
    if (Network.getIsHost() && player.peerId !== 'host' && player.peerId !== myPlayerData.peerId) {
      nightQueueIdx++;
      processNextNightActor();
      return;
    }
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
  const noteInput = document.getElementById('night-action-note');
  const note = (noteInput && noteInput.value.trim() !== '') ? noteInput.value.trim() : null;

  if (Network.getIsHost() || !isOnlineMode) {
    // Host / offline: record action locally then advance queue
    Game.submitNightAction(action.playerId, selectedNightTarget, action.actionType, note);

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
      note:       note,
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
  const fill = document.getElementById('timer-fill');
  const text = document.getElementById('timer-text');

  if (timerBlock) timerBlock.style.display = 'block';

  if (!seconds || seconds <= 0) {
    if (fill) {
      fill.style.width = '100%';
      fill.classList.remove('warning');
    }
    if (text) text.textContent = '∞';
    return;
  }

  let remaining = seconds;

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
    if (p) {
      let text = `<strong>${p.name}</strong> was found dead this morning.`;
      if (results.deathNotes && results.deathNotes[p.id]) {
        text += `<div class="death-note">"${results.deathNotes[p.id]}"</div>`;
      }
      newsItems.push({ icon: '💀', text });
    }
  }

  if (results.skKill) {
    const p = Game.getPlayer(results.skKill);
    if (p) {
      let text = `<strong>${p.name}</strong> was brutally murdered.`;
      if (results.deathNotes && results.deathNotes[p.id]) {
        text += `<div class="death-note">"${results.deathNotes[p.id]}"</div>`;
      }
      newsItems.push({ icon: '🗡️', text });
    }
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
  startDayTimer(gameSettings.dayTime ?? 120);
  updateVoteTally();

  Game.addLog(`☀️ Day ${Game.getDayCount()} begins.`, true);

  if (isOnlineMode && Network.getIsHost()) {
    const aliveList = Game.getAlivePlayers().map(p => ({ id: p.id, name: p.name, peerId: p.peerId, alive: true }));
    Network.broadcast({
      type:        'day_start',
      dayCount:    Game.getDayCount(),
      alivePlayers: aliveList,
    });
  }
}

// Called from dawn screen button
function showScreen_day() { showDayPhase(); }

// Override the continue button on dawn screen
document.addEventListener('DOMContentLoaded', () => {
  const dawnBtn = document.querySelector('#screen-dawn .btn');
  if (dawnBtn) dawnBtn.onclick = () => {
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
  const display = document.getElementById('day-timer-display');
  if (!display) return;

  if (!seconds || seconds <= 0) {
    display.textContent = '∞';
    display.className = 'day-timer';
    return;
  }

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

  if (!isOnlineMode) {
    // Local mode: Render counter buttons for the organizer to input real votes
    alive.forEach((p, i) => {
      const row = document.createElement('div');
      row.className = 'candidate-btn';
      // Initialize a temporary local counter property if not exists
      p._localVotes = p._localVotes || 0;
      
      row.innerHTML = `
        <div class="p-avatar" style="width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,var(--secondary),var(--primary));display:flex;align-items:center;justify-content:center;flex-shrink:0;">${emojis[i % emojis.length]}</div>
        <div>
          <div class="candidate-name">${p.name}</div>
          <div class="candidate-votes">${p.voteCount || 0} nomination(s)</div>
        </div>
        <div class="candidate-counter-wrapper">
          <div class="counter-btn" onclick="updateLocalVote('${p.id}', -1)">-</div>
          <div class="counter-value" id="local-vote-val-${p.id}">${p._localVotes}</div>
          <div class="counter-btn" onclick="updateLocalVote('${p.id}', 1)">+</div>
        </div>
      `;
      candidates.appendChild(row);
    });
    
    document.getElementById('btn-cast-vote').textContent = "Resolve Votes";
    document.getElementById('btn-cast-vote').disabled = false;
  } else {
    // Online mode: Render standard selection buttons
    alive.forEach((p, i) => {
      const btn = document.createElement('button');
      btn.className = 'candidate-btn';
      btn.dataset.candidateId = p.id;
      btn.innerHTML = `
        <div class="p-avatar" style="width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,var(--secondary),var(--primary));display:flex;align-items:center;justify-content:center;flex-shrink:0;">${emojis[i % emojis.length]}</div>
        <div>
          <div class="candidate-name">${p.name}</div>
        </div>
      `;
      btn.onclick = () => selectVoteCandidate(p.id, btn);
      candidates.appendChild(btn);
    });

    document.getElementById('btn-cast-vote').textContent = "Cast Vote";
    document.getElementById('btn-cast-vote').disabled = true;
    
    // If Host, add a Force End button instead of Abstain
    if (Network.getIsHost()) {
      const actions = document.getElementById('vote-actions');
      let forceBtn = document.getElementById('btn-force-end-vote');
      if (!forceBtn) {
        forceBtn = document.createElement('button');
        forceBtn.id = 'btn-force-end-vote';
        forceBtn.className = 'btn btn-warning';
        forceBtn.textContent = 'Force End Voting (Host)';
        forceBtn.onclick = () => endVoting();
        actions.appendChild(forceBtn);
      }
      forceBtn.style.display = 'block';
    }
  }
}

function updateLocalVote(playerId, delta) {
  const p = Game.getPlayer(playerId);
  if (p) {
    p._localVotes = Math.max(0, (p._localVotes || 0) + delta);
    document.getElementById(`local-vote-val-${p.id}`).textContent = p._localVotes;
  }
}

function selectVoteCandidate(targetId, btn) {
  if (!isOnlineMode) return;
  document.querySelectorAll('.candidate-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  selectedVoteTarget = targetId;
  document.getElementById('btn-cast-vote').disabled = false;
}

function castVote() {
  if (!isOnlineMode) {
    // Local mode: apply all _localVotes directly to Game voteCount, then resolve
    const alive = Game.getAlivePlayers();
    alive.forEach(p => p.voteCount = 0);
    alive.forEach(p => {
      if (p._localVotes > 0) p.voteCount = p._localVotes;
      p._localVotes = 0; // reset for next time
    });
    showVoteResults();
  } else {
    // Online mode: client sends vote and waits
    if (!selectedVoteTarget) return;
    
    if (Network.getIsHost()) {
      Game.castVote(myPlayerData.id, selectedVoteTarget);
      checkEndVoting();
    } else {
      Network.sendToHost({ type: 'vote_cast', voterId: myPlayerData.id, targetId: selectedVoteTarget });
    }
    
    // Show waiting state
    document.getElementById('vote-candidates').innerHTML = '<div style="text-align:center; padding:2rem; color:var(--text-muted)">Waiting for others to vote...</div>';
    document.getElementById('btn-cast-vote').disabled = true;
    const actions = document.getElementById('vote-actions');
    const abstainBtn = actions.querySelector('.btn-ghost');
    if (abstainBtn) abstainBtn.style.display = 'none';
  }
}

function abstainVote() {
  if (!isOnlineMode) {
    // Local mode: skipping vote resolution (no verdict)
    showModal({
      header: '⚖️ No Verdict',
      body: 'The vote was skipped. No one is eliminated today.',
      buttons: [{ text: 'Continue to Night', class: 'btn-primary', action: () => startNightPhase() }]
    });
  } else {
    // Online mode: client abstains
    if (Network.getIsHost()) {
      Game.abstainVote(myPlayerData.id);
      checkEndVoting();
    } else {
      Network.sendToHost({ type: 'vote_cast', voterId: myPlayerData.id, targetId: null }); // null = abstain
    }
    
    document.getElementById('vote-candidates').innerHTML = '<div style="text-align:center; padding:2rem; color:var(--text-muted)">Waiting for others to vote...</div>';
    const actions = document.getElementById('vote-actions');
    const abstainBtn = actions.querySelector('.btn-ghost');
    if (abstainBtn) abstainBtn.style.display = 'none';
  }
}

function checkEndVoting() {
  if (!isOnlineMode || !Network.getIsHost()) return;
  // Auto-end if all alive players have cast a vote (or abstained, but abstain currently just deletes their vote, we'll assume the host tracks it differently or we just rely on Force End for abstains if they don't register).
  // Actually, easiest way is to let Host manually "Force End" if people abstain, or we can check if Object.keys(state.votes).length == alive.length.
  const state = Game.getState();
  const aliveCount = Game.getAlivePlayers().length;
  if (Object.keys(state.votes).length >= aliveCount) {
    endVoting();
  }
}

function endVoting() {
  if (!Network.getIsHost()) return;
  
  // Hide Force End button
  const forceBtn = document.getElementById('btn-force-end-vote');
  if (forceBtn) forceBtn.style.display = 'none';

  const eliminated = Game.resolveVote();
  
  if (!eliminated) {
    Network.broadcast({ type: 'no_verdict' });
    showNoVerdictScreen();
  } else {
    Network.broadcast({ 
      type: 'elimination', 
      playerId: eliminated.id, 
      playerName: eliminated.name,
      cause: 'voted_out',
      role: eliminated.role
    });
    showEliminationScreen(eliminated, 'voted_out');
  }
}

function showNoVerdictScreen() {
  showModal({
    header: '⚖️ No Verdict',
    body: 'The vote ended in a tie or no majority. No one is eliminated today.',
    buttons: [{ text: 'Continue to Night', class: 'btn-primary', action: () => startNightPhase() }]
  });
}

function showVoteResults() {
  // Only called by Local mode now
  const eliminated = Game.resolveVote();
  if (!eliminated) {
    showNoVerdictScreen();
  } else {
    showEliminationScreen(eliminated, 'voted_out');
  }
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
  if (gameSettings.revealRoles !== false) {
    playerCard.innerHTML = `
      <div style="font-size:3rem">${player.role?.icon || '👤'}</div>
      <div class="elim-player-name">${player.name}</div>
      <div class="elim-role-reveal">
        <span>Was the</span>
        <strong style="color:${player.role?.color || '#fff'}">${player.role?.name || 'Unknown'}</strong>
      </div>
      <span class="badge" style="background:${player.role?.team === 'mafia' ? 'rgba(229,62,62,0.2);color:var(--accent-red)' : 'rgba(16,185,129,0.2);color:var(--accent-green)'}">${player.role?.team?.toUpperCase() || 'UNKNOWN'}</span>
    `;
  } else {
    playerCard.innerHTML = `
      <div style="font-size:3rem">👻</div>
      <div class="elim-player-name">${player.name}</div>
      <div class="elim-role-reveal">
        <span>Their role remains a secret.</span>
      </div>
    `;
  }

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

